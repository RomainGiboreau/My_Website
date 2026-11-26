// Self-check for the log correlation core (docs/logcorr/index.html, <script id="lc-core">).
// Run: node scripts/logcorr_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../docs/logcorr/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="lc-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'lc-core script block not found');
const ctx = { window: {} };
vm.runInNewContext(m[1], ctx);
const LC = ctx.window.LC;
let n = 0;
const T = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const F = a => Float64Array.from(a);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);

// smooth seeded signal
function signal(len, seed) {
  const r = LC.rng(seed), c = Array.from({ length: 6 }, () => ({ l: 8 + r() * 40, p: r() * 6.28, a: 0.5 + r() }));
  return z => c.reduce((s, k) => s + k.a * Math.sin(2 * Math.PI * z / k.l + k.p), 0);
}
function monotone(res) {
  for (let k = 1; k < res.pi.length; k++) {
    const di = res.pi[k] - res.pi[k - 1], dj = res.pj[k] - res.pj[k - 1];
    if (di < 0 || dj < 0 || di > 1 || dj > 1 || (di === 0 && dj === 0)) return false;
  }
  return res.pi[0] === 0 && res.pj[0] === 0;
}

T('self DTW: diagonal path, zero cost (sym2 and sym1)', () => {
  const f = signal(0, 1), a = F(Array.from({ length: 120 }, (_, i) => f(i * 0.5)));
  for (const pattern of ['sym2', 'sym1']) {
    const r = LC.dtw([a], [a], { pattern });
    assert.equal(r.cost, 0); assert.equal(r.norm, 0); assert.equal(r.pi.length, 120);
    for (let k = 0; k < r.pi.length; k++) assert.equal(r.pi[k], r.pj[k]);
    const mt = LC.metrics([a], [a], r);
    near(mt.corrMean, 1, 1e-12); near(mt.straightness, 1, 1e-12); assert.equal(mt.extremeShare, 0); assert.equal(mt.oneToManyA, 0);
  }
});

T('cost equals a brute-force enumeration of every monotone path on tiny inputs', () => {
  const r = LC.rng(5);
  for (let trial = 0; trial < 40; trial++) {
    const n = 2 + Math.floor(r() * 4), m = 2 + Math.floor(r() * 4);
    const a = F(Array.from({ length: n }, () => r() * 4)), b = F(Array.from({ length: m }, () => r() * 4));
    for (const pat of ['sym2', 'sym1']) {
      let best = Infinity;
      const rec = (i, j, c) => { // c includes the cell (i,j)
        if (i === n - 1 && j === m - 1) { best = Math.min(best, c); return; }
        const w = (di, dj) => (pat === 'sym2' && di && dj ? 2 : 1);
        for (const [di, dj] of [[1, 0], [0, 1], [1, 1]]) {
          const ni = i + di, nj = j + dj; if (ni >= n || nj >= m) continue;
          rec(ni, nj, c + w(di, dj) * Math.abs(a[ni] - b[nj]));
        }
      };
      rec(0, 0, (pat === 'sym2' ? 2 : 1) * Math.abs(a[0] - b[0]));
      const res = LC.dtw([a], [b], { pattern: pat });
      near(res.cost, best, 1e-9, `trial ${trial} ${pat}`);
      near(LC.pathCost([a], [b], res.pi, res.pj, { pattern: pat }).cost, best, 1e-9, 'pathCost');
    }
  }
});

T('stretched / compressed copy: the known depth mapping is recovered within a few samples', () => {
  const f = signal(0, 3), step = 0.5, n = 241;
  const g = z => z + 8 * Math.sin(2 * Math.PI * z / 120);           // known increasing mapping A -> B, g(0)=0, g(120)=120
  const ginv = y => { let lo = 0, hi = 120; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; (g(mid) < y ? (lo = mid) : (hi = mid)); } return (lo + hi) / 2; };
  const a = F(Array.from({ length: n }, (_, i) => f(i * step)));
  const b = F(Array.from({ length: n }, (_, j) => f(ginv(j * step))));
  const r = LC.dtw([a], [b], { pattern: 'sym2' });
  assert.ok(monotone(r));
  const mj = LC.mapAtoB(r.pi, r.pj, n);
  let worst = 0, sum = 0;
  for (let i = 0; i < n; i++) { const e = Math.abs(mj[i] * step - g(i * step)) / step; worst = Math.max(worst, e); sum += e; }
  console.log(`      mean error ${(sum / n).toFixed(2)} samples, worst ${worst.toFixed(2)}`);
  assert.ok(sum / n < 1.5, 'mean error ' + sum / n);
  assert.ok(worst < 6, 'worst error ' + worst);
});

T('noisy example pair (2 curves, different gain): mapping recovered; metrics sensible', () => {
  const ex = LC.exampleLogs(7, 0.5);
  const o = { step: 0.5, smooth: 3, norm: 'zscore' };
  const pa = LC.prepare(ex.A, [0, 1], { ...o, z0: 2000, z1: 2150 }), pb = LC.prepare(ex.B, [0, 1], { ...o, z0: 2030, z1: 2190 });
  const r = LC.dtw(pa.norm, pb.norm, { pattern: 'sym2' });
  assert.ok(monotone(r));
  const mj = LC.mapAtoB(r.pi, r.pj, pa.n);
  let err = [];
  for (let i = 0; i < pa.n; i++) err.push(Math.abs((2030 + mj[i] * 0.5) - LC.mapAB(2000 + i * 0.5)));
  err.sort((x, y) => x - y);
  console.log(`      median depth error ${err[err.length >> 1].toFixed(2)} m, 90th pct ${err[Math.floor(err.length * 0.9)].toFixed(2)} m`);
  assert.ok(err[err.length >> 1] < 2, 'median error');
  assert.ok(err[Math.floor(err.length * 0.9)] < 6, 'p90 error');
  const mt = LC.metrics(pa.norm, pb.norm, r);
  assert.ok(mt.corrMean > 0.8, 'correlation along path ' + mt.corrMean);
  assert.ok(mt.pathLen >= Math.max(pa.n, pb.n));
});

T('monotonicity of every path (random inputs, all patterns, with and without band)', () => {
  const r = LC.rng(11);
  for (let t = 0; t < 30; t++) {
    const n = 20 + Math.floor(r() * 60), m = 20 + Math.floor(r() * 60);
    const a = F(Array.from({ length: n }, () => r())), b = F(Array.from({ length: m }, () => r()));
    for (const pattern of ['sym1', 'sym2']) for (const band of [0, 15]) {
      const res = LC.dtw([a], [b], { pattern, band });
      assert.ok(res && monotone(res), `t${t} ${pattern} band ${band}`);
      assert.equal(res.pi[res.pi.length - 1], n - 1); assert.equal(res.pj[res.pj.length - 1], m - 1);
    }
  }
});

T('datum constraints are honoured exactly; segment path is monotone and passes through every datum', () => {
  const f = signal(0, 4), n = 200, m = 220;
  const a = F(Array.from({ length: n }, (_, i) => f(i * 0.5))), b = F(Array.from({ length: m }, (_, j) => f(j * 0.45)));
  const datums = [{ a: 120, b: 30 }, { a: 50, b: 60 }, { a: 90, b: 150 }]; // deliberately wrong and unsorted: constraints must still win
  assert.throws(() => LC.dtwSegments([a], [b], datums, {}), /cross/);
  const ok = [{ a: 120, b: 140 }, { a: 50, b: 60 }, { a: 90, b: 100 }];
  const r = LC.dtwSegments([a], [b], ok, { pattern: 'sym2' });
  assert.ok(monotone(r));
  for (const d of ok) {
    let hit = false; for (let k = 0; k < r.pi.length; k++) if (r.pi[k] === d.a && r.pj[k] === d.b) hit = true;
    assert.ok(hit, `datum ${d.a}/${d.b} on the path`);
  }
  // inside a segment the path never leaves the datum rectangle
  for (let k = 0; k < r.pi.length; k++) if (r.pi[k] > 50 && r.pi[k] < 90) assert.ok(r.pj[k] >= 60 && r.pj[k] <= 100);
  // the reported cost is the cost of the concatenated path
  near(r.cost, LC.pathCost([a], [b], r.pi, r.pj, { pattern: 'sym2' }).cost, 1e-9);
  // with no datum the segment solver equals the global one
  const g = LC.dtw([a], [b], {}), s = LC.dtwSegments([a], [b], [], {});
  near(s.cost, g.cost, 1e-9);
});

T('band constraint limits how far the path leaves the diagonal', () => {
  const r0 = LC.rng(2), n = 150, m = 150;
  const a = F(Array.from({ length: n }, () => r0())), b = F(Array.from({ length: m }, () => r0()));
  const free = LC.dtw([a], [b], {}), band = LC.dtw([a], [b], { band: 8 });
  const dev = r => { let d = 0; for (let k = 0; k < r.pi.length; k++) d = Math.max(d, Math.abs(r.pj[k] - r.pi[k])); return d; };
  assert.ok(dev(band) <= band.rEff, 'band respected: ' + dev(band) + ' <= ' + band.rEff);
  assert.ok(band.rEff >= 8 && band.rEff <= 10);
  assert.ok(dev(free) > dev(band), 'unconstrained path strays further (' + dev(free) + ')');
  assert.ok(band.cost >= free.cost - 1e-9, 'a constraint cannot lower the cost');
  // very different lengths: the effective radius widens so that a path still exists
  const short = F([1, 2]), long = F(Array.from({ length: 50 }, (_, i) => i / 25));
  assert.ok(LC.dtw([short], [long], { band: 1 }));
});

T('multivariate DTW with weights; weight 0 ignores a curve', () => {
  const f = signal(0, 6), n = 100;
  const a1 = F(Array.from({ length: n }, (_, i) => f(i))), a2 = F(Array.from({ length: n }, (_, i) => Math.sin(i / 5)));
  const b1 = a1, b2 = F(Array.from({ length: n }, () => 99)); // second curve of B is garbage
  const bad = LC.dtw([a1, a2], [b1, b2], {}), good = LC.dtw([a1, a2], [b1, b2], { weights: [1, 0] });
  assert.equal(good.cost, 0); assert.ok(bad.cost > 0);
});

T('resampling, gap filling, smoothing, standardisation', () => {
  const z = F([0, 1, 2, 5, 6, 7]), v = F([0, 1, 2, NaN, 6, 7]);
  const r = LC.resample(z, v, 0, 1, 8);               // sample at z=3,4 is bracketed by 2 and 6 (the NaN row is dropped)
  near(r[3], 3, 1e-12); near(r[4], 4, 1e-12); assert.ok(Number.isNaN(r[7]) === false);
  const x = F([NaN, NaN, 1, NaN, 3, NaN]); const c = LC.fillNaN(x);
  assert.equal(c, 4); near(x[0], 1, 0); near(x[3], 2, 1e-12); near(x[5], 3, 0);
  near(LC.smooth(F([0, 0, 9, 0, 0]), 3)[2], 3, 1e-12);
  const zs = LC.normalise(F([1, 2, 3, 4, 5]), 'zscore'), st = LC.stats(zs); near(st.mean, 0, 1e-12); near(st.sd, 1, 1e-12);
  const mm = LC.normalise(F([2, 4, 6]), 'minmax'); near(mm[0], 0, 0); near(mm[2], 1, 0);
  // depth in decreasing order is accepted
  const rr = LC.resample(F([3, 2, 1, 0]), F([3, 2, 1, 0]), 0, 1, 4); near(rr[2], 2, 1e-12);
});

T('null test (phase-randomised and IAAFT surrogates): small p for a real match, reproducible (seeded)', () => {
  const f = signal(0, 8), n = 160, r0 = LC.rng(21);
  const a = F(Array.from({ length: n }, (_, i) => f(i * 0.5)));
  const b = F(Array.from({ length: n }, (_, j) => f(0.5 * (j + 6 * Math.sin(j / 25))) + 0.1 * LC.gauss(r0)));
  const A = LC.normalise(a, 'zscore'), B = LC.normalise(b, 'zscore');
  for (const type of ['phase', 'iaaft']) {
    const real = LC.nullTest([A], [B], { nsim: 59, seed: 42, type, band: 0 });
    console.log(`      ${type}: p=${real.p.toFixed(3)} real cost ${real.real.toFixed(3)} vs null mean ${real.mean.toFixed(3)}; r along path ${real.corrReal.toFixed(2)} (surrogates ${real.corrMean.toFixed(2)}), p(r)=${real.pCorr.toFixed(3)}`);
    assert.ok(real.p <= 0.05, type + ' p ' + real.p);
    assert.ok(real.pCorr <= 0.05, type + ' p(r) ' + real.pCorr);
    assert.equal(real.nulls.length, 59);
    assert.equal(LC.nullTest([A], [B], { nsim: 59, seed: 42, type }).p, real.p);
  }
  assert.equal(LC.pValue(1, [2, 3, 4]), 0.25); // (1+0)/(3+1)
  // the removed null models are mapped to the valid one (old session files)
  assert.equal(LC.nullTest([A], [B], { nsim: 19, seed: 3, type: 'block' }).p, LC.nullTest([A], [B], { nsim: 19, seed: 3, type: 'phase' }).p);
});

T('DFT (any length) equals the direct sum; surrogates keep amplitude spectrum, mean, values (IAAFT) and cross-curve phases', () => {
  for (const n of [8, 12, 31, 50]) {
    const r = LC.rng(n), x = F(Array.from({ length: n }, () => r() - 0.5)), z = new Float64Array(n), S = LC.dft(x, z, false);
    for (let k = 0; k < n; k++) {
      let re = 0, im = 0; for (let t = 0; t < n; t++) { re += x[t] * Math.cos(2 * Math.PI * k * t / n); im -= x[t] * Math.sin(2 * Math.PI * k * t / n); }
      near(S.re[k], re, 1e-9, `re n=${n} k=${k}`); near(S.im[k], im, 1e-9, `im n=${n} k=${k}`);
    }
    const back = LC.dft(S.re, S.im, true).re; for (let t = 0; t < n; t++) near(back[t], x[t], 1e-10, 'round trip');
  }
  const n = 101, r = LC.rng(4), mk = () => { const x = new Float64Array(n); let p = 0; for (let i = 0; i < n; i++) { p = 0.9 * p + LC.gauss(r); x[i] = p; } return x; };
  const x1 = mk(), x2 = F(Array.from(x1, v => 2 * v + 1));                  // second curve is an exact affine copy of the first
  const amp = v => { const S = LC.dft(v, new Float64Array(n), false); return Array.from(S.re, (a, k) => Math.hypot(a, S.im[k])); };
  const ph = LC.surrogator([x1, x2], 'phase')(LC.rng(9));
  const a0 = amp(x1), a1 = amp(ph[0]);
  for (let k = 0; k < n; k++) near(a1[k], a0[k], 1e-8, 'amplitude ' + k);
  near(LC.stats(ph[0]).mean, LC.stats(x1).mean, 1e-9);
  assert.ok(Math.abs(LC.pearson(ph[0], x1)) < 0.9, 'phases changed');
  near(LC.pearson(ph[0], ph[1]), 1, 1e-9, 'cross-curve relation kept');
  const ia = LC.surrogator([x1], 'iaaft')(LC.rng(9))[0];
  assert.deepEqual(Array.from(ia).sort((p, q) => p - q), Array.from(x1).sort((p, q) => p - q));
});

T('false-positive rate on UNCORRELATED strongly autocorrelated logs (AR(1)) is near the nominal 5 % (the old block-shuffle null gave 75 %)', () => {
  const n = 100, trials = 100, nsim = 39;
  const mk = (seed, phi) => { const r = LC.rng(seed), x = new Float64Array(n); let p = 0; for (let i = 0; i < 100; i++) p = phi * p + LC.gauss(r); for (let i = 0; i < n; i++) { p = phi * p + LC.gauss(r); x[i] = p; } return LC.normalise(x, 'zscore'); };
  for (const phi of [0.9, 0.98]) {
    let rej = 0, rejr = 0, rsum = 0;
    for (let t = 0; t < trials; t++) {
      const res = LC.nullTest([mk(1000 + t, phi)], [mk(5000 + t, phi)], { nsim, seed: 11 + t, type: 'phase' });
      if (res.p < 0.05) rej++; if (res.pCorr < 0.05) rejr++; rsum += res.corrReal;
    }
    console.log(`      phi ${phi}: ${trials} trials of ${nsim} surrogates: cost test rejects ${(rej / trials * 100).toFixed(0)} %, calibrated r test ${(rejr / trials * 100).toFixed(0)} % (nominal 5 %); raw Pearson r along the path of unrelated logs ${(rsum / trials).toFixed(2)} on average`);
    assert.ok(rej / trials <= 0.10, `cost test false-positive rate ${rej / trials} at phi ${phi}`);
    assert.ok(rejr / trials <= 0.12, `r test false-positive rate ${rejr / trials} at phi ${phi}`);
    assert.ok(rsum / trials > 0.5, 'unrelated smooth logs have a high Pearson r along the DTW path (so it is not evidence)');
  }
});

T('parseNumber: thousands and decimal separators, missing, below detection, unicode minus (contract A)', () => {
  const v = (s, o) => LC.parseNumber(s, o);
  const ok = (s, x, o) => { const r = v(s, o); assert.equal(r.kind, 'ok', s); near(r.value, x, 1e-12, s); };
  ok('1234.5', 1234.5); ok('1,234.5', 1234.5); ok('1 234.5', 1234.5); ok('1.234,5', 1234.5); ok('1 234,5', 1234.5);
  ok('1,5', 1.5); ok('0,55', 0.55); ok('0,500', 0.5); ok('1e-3', 0.001); ok('1E+30', 1e30); ok('−3.5', -3.5); ok('+4', 4); ok('1,234,567', 1234567); ok('1.234.567', 1234567);
  ok('1,234', 1234); ok('1,234', 1.234, { comma: true });
  assert.equal(v('1,234').ambiguous, true);
  for (const s of ['', '-', 'n.d.', 'nd', 'NA', 'NaN', 'null']) assert.equal(v(s).kind, 'missing', s);
  const b = v('<0,1'); assert.equal(b.kind, 'below'); assert.equal(b.value, null); near(b.limit, 0.1, 0);
  assert.equal(v('<0.1').kind, 'below');
  assert.equal(v('abc').kind, 'text'); assert.equal(v('1,2,3').kind, 'text'); assert.equal(v('12 5').kind, 'text');
});

T('detectDelimiter and decimal-comma tables (contract A): `100 0,55`, comma-only column, semicolon', () => {
  assert.equal(LC.detectDelimiter(['100 0,55', '110 0,50', '120 0,48']).delim, 'ws');
  assert.equal(LC.detectDelimiter(['depth,gr', '1,10', '2,20', '3,30']).delim, ',');
  assert.equal(LC.detectDelimiter(['1000,5;55,2', '1001;56,1', '1002;57']).delim, ';');
  assert.equal(LC.detectDelimiter(['1\t2\t3', '4\t5\t6']).delim, '\t');
  // the reported bug: decimal comma values were turned into NaN ("depth range is empty")
  const t = LC.parseAny('depth;gr\n1000,5;55,2\n1001,0;56,1\n1001,5;57,9\n1002,0;58,0');
  near(t.depth[0], 1000.5, 0); near(t.curves[0].v[1], 56.1, 0); assert.equal(t.depth.length, 4);
  const u = LC.parseAny('100 0,55\n110 0,50\n120 0,48\n');
  assert.equal(u.curves.length, 1); near(u.depth[2], 120, 0); near(u.curves[0].v[0], 0.55, 0);
  const w = LC.parseAny('1000,5 55,2\n1001,0 56,1\n1001,5 57,9\n');
  near(w.depth[0], 1000.5, 0); near(w.curves[0].v[2], 57.9, 0);
  const th = LC.parseAny('depth;gr\n1 000,5;1 234,5\n1 001,0;56,1\n1 001,5;57,9\n');
  near(th.depth[0], 1000.5, 0); near(th.curves[0].v[0], 1234.5, 0);
  // ambiguity 1,234: thousands if the file has no decimal comma elsewhere, decimal comma if it does
  const a2 = LC.parseAny('depth;gr\n1;1,234\n2;1,5\n3;1,75\n');
  near(a2.curves[0].v[0], 1.234, 0);
  const a3 = LC.parseAny('depth;gr\n1;1,234\n2;1,235\n3;1,236\n');
  assert.equal(a3.report.decimal, 'comma'); assert.equal(a3.report.ambiguity, true);
  const a4 = LC.parseAny('depth\tgr\n1\t1,234\n2\t1,235\n3\t1,236\n');
  near(a4.curves[0].v[0], 1234, 0); assert.equal(a4.report.ambiguity, true);
});

T('load report: rows read / skipped with reasons and line numbers, never a silent drop (contract A)', () => {
  const txt = 'depth,gr\n1000,50\n1001,abc\nxx,12\n1002,<5\n1003,n.d.\n1004,60\n1005,61\n';
  const t = LC.parseAny(txt), r = t.report;
  assert.equal(r.read, 7); assert.equal(r.skipped, 1); assert.equal(t.depth.length, 6);
  assert.deepEqual(Array.from(r.firstLines['non-numeric depth']), [4]);
  assert.equal(r.cells.text, 1); assert.equal(r.cells.below, 1); assert.equal(r.cells.missing, 1);
  const d = LC.describeReport(r); assert.ok(/7 rows read, 1 skipped/.test(d) && /line 4/.test(d), d);
  // a table with no usable depth: an explicit error that says why
  assert.throws(() => LC.parseAny('a,b\nx,1\ny,2\nz,3'), /Fewer than 2 usable depth rows.*non-numeric depth/);
});

T('null sentinels excluded and counted (contract C); undeclared candidates only warned', () => {
  const lines = ['depth gr']; for (let i = 0; i < 20; i++) lines.push(`${1000 + i} ${i % 5 === 0 ? -999.25 : 50 + i}`);
  for (let i = 0; i < 6; i++) lines[2 + i] = `${1001 + i} -99999`;
  const t = LC.parseAny(lines.join('\n'));
  assert.equal(t.report.sentinelCounts['-999.25'], 3); // i = 0 is the header row shift: rows 1005, 1010, 1015
  assert.ok(t.curves[0].v.every(x => x !== -999.25));
  assert.ok(Array.from(t.curves[0].v).includes(-99999), 'candidate is kept, not excluded');
  assert.ok(t.report.candidates.some(c => c.v === -99999 && c.k >= 5));
  assert.ok(/-99999 appears 6 times/.test(LC.describeReport(t.report)));
  assert.ok(/values equal to the null value -999.25 were excluded/.test(LC.describeReport(t.report)));
  // emptying the list keeps -999.25 as data; adding -99999 excludes it
  const t2 = LC.parseAny(lines.join('\n'), 'x', { nulls: [] }); assert.ok(Array.from(t2.curves[0].v).includes(-999.25));
  const t3 = LC.parseAny(lines.join('\n'), 'x', { nulls: [-99999, -999.25] }); assert.ok(!Array.from(t3.curves[0].v).includes(-99999));
});

T('depth unit: kind and ft/m plausibility warnings', () => {
  assert.equal(LC.unitKind('M'), 'm'); assert.equal(LC.unitKind('FT'), 'ft'); assert.equal(LC.unitKind('feet'), 'ft'); assert.equal(LC.unitKind(''), '');
  const mk = (z0, step, n) => ({ depth: F(Array.from({ length: n }, (_, i) => z0 + i * step)) });
  assert.ok(LC.unitWarnings(mk(1000, 0.1524, 50), 'm').some(w => /feet/.test(w)));
  assert.ok(LC.unitWarnings(mk(8000, 0.5, 50), 'm').length === 0);
  assert.ok(LC.unitWarnings(mk(12000, 0.5, 50), 'm').some(w => /deeper/.test(w)));
  assert.ok(LC.unitWarnings(mk(1000, 0.5, 50), 'ft').some(w => /metres/.test(w)));
  assert.equal(LC.unitWarnings(mk(1000, 0.5, 50), 'm').length, 0);
});

T('LAS parse / write round trip; table parsing', () => {
  const z = F(Array.from({ length: 30 }, (_, i) => 1000 + i * 0.5));
  const gr = F(Array.from({ length: 30 }, (_, i) => 50 + 10 * Math.sin(i))); gr[5] = NaN;
  const txt = LC.writeLAS({ well: 'T-1', depth: z, depthUnit: 'M', curves: [{ mnem: 'GR', unit: 'GAPI', v: gr }, { mnem: 'RHOB', unit: 'G/C3', v: gr.map(x => x / 40) }] });
  const l = LC.parseAny(txt);
  assert.equal(l.depthUnit, 'M'); assert.equal(l.curves.length, 2); assert.equal(l.curves[0].mnem, 'GR'); assert.equal(l.curves[1].unit, 'G/C3');
  assert.equal(l.depth.length, 30);
  for (let i = 0; i < 30; i++) { near(l.depth[i], z[i], 1e-9); if (i === 5) assert.ok(Number.isNaN(l.curves[0].v[i])); else near(l.curves[0].v[i], gr[i], 5e-5); }
  assert.throws(() => LC.parseLAS(txt.replace('WRAP.   NO', 'WRAP.   YES')), /Wrapped/);
  const t1 = LC.parseAny('depth,gr\n1,10\n2,20\n3,30\n4,40');
  assert.equal(t1.curves[0].mnem, 'gr'); assert.equal(t1.depth.length, 4); assert.equal(t1.curves[0].v[3], 40);
  const t2 = LC.parseAny('1000.0  55.5\n1000.5  60.1\n1001.0  58.2\n');
  assert.equal(t2.curves.length, 1); near(t2.curves[0].v[1], 60.1, 0);
  const t3 = LC.parseAny('# comment\nz;a;b\n1;2;3\n2;4;5\n3;6;7');
  assert.equal(t3.curves.length, 2); assert.equal(t3.curves[1].v[2], 7);
});

T('performance: 2000 x 2000 DTW in about a second', () => {
  const r = LC.rng(1), n = 2000, a = new Float64Array(n), b = new Float64Array(n);
  for (let i = 0; i < n; i++) { a[i] = Math.sin(i / 40) + 0.2 * r(); b[i] = Math.sin((i + 30 * Math.sin(i / 300)) / 40) + 0.2 * r(); }
  const t0 = Date.now(), res = LC.dtw([a], [b], {}), dt = Date.now() - t0;
  console.log(`      ${n}x${n}: ${dt} ms, path ${res.pi.length}`);
  assert.ok(dt < 4000, 'too slow: ' + dt + ' ms');
});

console.log(`\n${n} test groups passed`);
