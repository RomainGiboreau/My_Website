// Self-check for the spectral core of docs/tr-cycles/index.html (<script id="trc-core">).
// Run: node scripts/trcycles_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../docs/tr-cycles/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="trc-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'trc-core script block not found');
const ctx = { window: {} };
vm.runInNewContext(m[1], ctx);
const T = ctx.window.TRC;

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (tol ${tol})`);

// deterministic generators
const rng = (seed) => T.mulberry(seed);
const P0 = { unit: 'kyr', mode: 'proxy', window: 31, minPhase: 20, minRep: 4, plotMax: 0, name: 'x' };
const rowsOf = (age, val) => age.map((a, i) => [String(a), String(val[i])]);
const synth = (n, dt, amps = [1, 1, 1, 1], noise = 0.05, seed = 7) => {
  const r = rng(seed), age = [], val = [];
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    age.push(t);
    val.push(amps[0] * Math.sin(2 * Math.PI * t / 405 + 1) + amps[1] * Math.sin(2 * Math.PI * t / 100 + 2) +
      amps[2] * Math.sin(2 * Math.PI * t / 41 + 3) + amps[3] * Math.sin(2 * Math.PI * t / 23 + 4) + noise * r());
  }
  return [age, val];
};
const nearPeak = (res, period, tol = 0.04) => res.peaks.find(p => Math.abs(p.period - period) / period < tol);

test('FFT periodogram equals the direct DFT (power of two and other lengths)', () => {
  for (const N of [512, 777, 1000, 1023]) {
    const r = rng(N), x = Array.from({ length: N }, () => r());
    const { P } = T.periodogram(x, 1);
    // naive DFT with the same Hann window and scipy 'spectrum' scaling
    let mean = 0; for (const v of x) mean += v; mean /= N;
    let sw = 0; const xs = x.map((v, n) => { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / N); sw += w; return (v - mean) * w; });
    const K = Math.floor(N / 2);
    for (const k of [1, 2, 7, Math.floor(K / 3), K - 1, K]) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) { re += xs[n] * Math.cos(2 * Math.PI * k * n / N); im -= xs[n] * Math.sin(2 * Math.PI * k * n / N); }
      let p = (re * re + im * im) / (sw * sw); if (!(N % 2 === 0 && k === K)) p *= 2;
      close(P[k - 1] / p, 1, 1e-9, `N=${N} k=${k}`);
    }
  }
});

test('synthetic 405/100/41/23 kyr series: periods recovered, all significant, in their bands', () => {
  const [age, val] = synth(2000, 2);
  const res = T.computeUser(rowsOf(age, val), P0);
  assert.ok(!res.error, res.error);
  for (const [per, band] of [[405, 'Long eccentricity'], [100, 'Short eccentricity'], [41, 'Obliquity'], [23, 'Precession']]) {
    const p = nearPeak(res, per);
    assert.ok(p, `no peak near ${per} kyr`);
    close(p.period, per, per * 0.04, 'period ' + per);
    assert.equal(p.sig, true, `${per} kyr must be significant`);
    assert.equal(p.band, band);
  }
});

test('equal-amplitude sines have equal power by default (no smoothing attenuation); smoothing on shows the gain', () => {
  const [age, val] = synth(1000, 1, [0, 1, 0, 1], 0.02);
  const off = T.computeUser(rowsOf(age, val), P0);
  const a = nearPeak(off, 100), b = nearPeak(off, 23);
  assert.ok(a && b);
  // Hann scalloping alone can cost up to 28 % of the power of a sine that falls between two frequency bins
  assert.ok(b.power / a.power > 0.6 && b.power / a.power < 1.4, 'power ratio 23/100 with unsmoothed spectrum: ' + b.power / a.power);
  const on = T.computeUser(rowsOf(age, val), { ...P0, smoothSpec: true });
  const a2 = nearPeak(on, 100), b2 = nearPeak(on, 23);
  assert.ok(b2.power / a2.power < 0.3, 'smoothing attenuates the 23 kyr peak: ' + b2.power / a2.power);
  const expect = (b.power / a.power) * (b2.gain / a2.gain);
  close(b2.power / a2.power, expect, 0.15 * expect, 'reported filter gain explains the attenuation');
  assert.ok(b2.gain < 0.3 && a2.gain > 0.95);
});

test('white noise: significant-peak rate is about alpha (measured), series with a false band rare', () => {
  let peaks = 0, sig = 0, seriesWithSig = 0;
  const R = 80;
  for (let s = 0; s < R; s++) {
    const r = rng(1000 + s), age = [], val = [];
    for (let i = 0; i < 1000; i++) { age.push(i); val.push(r()); }
    const res = T.computeUser(rowsOf(age, val), { ...P0, nsur: 200, seed: 5000 + s });
    peaks += res.peaks.length;
    const k = res.peaks.filter(p => p.sig).length;
    sig += k; if (k) seriesWithSig++;
    for (const p of res.peaks) assert.ok(p.sig || p.band === '', 'a non-significant peak must carry no band');
  }
  const rate = sig / peaks;
  console.log(`    white noise: ${sig}/${peaks} peaks significant (${(100 * rate).toFixed(1)} %), ${seriesWithSig}/${R} series with at least one`);
  assert.ok(rate < 0.09, 'significant-peak rate ' + rate);
});

test('AR(1) red noise phi = 0.95 is not labelled Short eccentricity / precession as significant', () => {
  let peaks = 0, sig = 0;
  const R = 30;
  for (let s = 0; s < R; s++) {
    const r = rng(77 + s), age = [], val = []; let x = 0;
    for (let i = 0; i < 1000; i++) { x = 0.95 * x + r(); age.push(i); val.push(x); }
    const res = T.computeUser(rowsOf(age, val), { ...P0, nsur: 200, seed: 9000 + s });
    peaks += res.peaks.length; sig += res.peaks.filter(p => p.sig).length;
    assert.ok(res.red.phi > 0.85 && res.red.phi < 1, 'fitted phi ' + res.red.phi);
  }
  const rate = sig / peaks;
  console.log(`    red noise (phi 0.95): ${sig}/${peaks} peaks significant (${(100 * rate).toFixed(1)} %)`);
  assert.ok(rate < 0.10, 'rate ' + rate);
});

test('time unit: the same series in Ma and in kyr gives the same periods (in kyr)', () => {
  const [age, val] = synth(1000, 4, [1, 1, 1, 0], 0.02);
  const a = T.computeUser(rowsOf(age, val), P0);
  const b = T.computeUser(rowsOf(age.map(x => x / 1000), val), { ...P0, unit: 'Ma' });
  assert.equal(a.peaks.length, b.peaks.length);
  for (let i = 0; i < a.peaks.length; i++) close(a.peaks[i].period, b.peaks[i].period, 1e-6 * a.peaks[i].period, 'period ' + i);
  close(a.dt, b.dt, 1e-9, 'dt');
});

test('Samples/cycle is counted on the input step, not on the interpolated one', () => {
  const r = rng(3), age = [], val = [];
  for (let i = 0; i < 100; i++) { age.push(i * 10); val.push(Math.sin(2 * Math.PI * i * 10 / 100) + 0.02 * r()); }
  const res = T.computeUser(rowsOf(age, val), { ...P0, nsur: 100 });
  const p = nearPeak(res, 100);
  assert.ok(p);
  close(p.spc, 10, 0.6, 'samples per cycle (true)');
  assert.ok(p.spcResampled > 15, 'interpolated step would give ' + p.spcResampled);
  assert.ok(res.warnings.some(w => /resampled/.test(w)));
});

test('constant series: warning and no peak', () => {
  const age = Array.from({ length: 50 }, (_, i) => i), val = age.map(() => 3);
  const res = T.computeUser(rowsOf(age, val), P0);
  assert.equal(res.peaks.length, 0);
  assert.ok(res.warnings.some(w => /constant/.test(w)));
});

test('sea-level mode says rising / falling, not transgression / regression', () => {
  const [age, val] = synth(300, 5);
  const res = T.computeUser(rowsOf(age, val), { ...P0, mode: 'sea-level', nsur: 50 });
  assert.equal(res.up, 'Sea level rising');
  assert.equal(res.down, 'Sea level falling');
});

test('editable band limits: parsing and use', () => {
  const ok = T.parseBands('Precession 15-30; Obliquity 30–55;Eccentricity 80-130');
  assert.deepEqual(JSON.parse(JSON.stringify(ok.bands)), { Precession: [15, 30], Obliquity: [30, 55], Eccentricity: [80, 130] });
  assert.ok(T.parseBands('nonsense').error);
  assert.ok(T.parseBands('A 50-20').error);
  const rt = T.parseBands(T.bandsText(T.DEFAULT_BANDS));
  assert.deepEqual(JSON.parse(JSON.stringify(rt.bands)), JSON.parse(JSON.stringify(T.DEFAULT_BANDS)));
  const [age, val] = synth(2000, 2, [0, 0, 1, 0], 0.02);
  const res = T.computeUser(rowsOf(age, val), { ...P0, bands: { 'Deep-time obliquity': [35, 45] } });
  assert.equal(nearPeak(res, 41).band, 'Deep-time obliquity');
});

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message); }
}
console.log(failed ? `${failed} failed` : `all ${tests.length} passed`);
process.exit(failed ? 1 : 0);
