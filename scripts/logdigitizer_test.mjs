// Self-check for the Well-log digitizer core (docs/logdigitizer/index.html, <script id="ld-core">).
// Run: node scripts/logdigitizer_test.mjs
// The LAS written by the digitizer is parsed back with the LAS checker's own parser (docs/las-checker/index.html, <script id="las-core">).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const load = (file, id, g) => {
  const html = readFileSync(new URL(file, import.meta.url), 'utf8');
  const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`));
  assert.ok(m, `${id} script block not found`);
  const ctx = { window: {} };
  vm.runInNewContext(m[1], ctx);
  return ctx.window[g];
};
const LD = load('../docs/logdigitizer/index.html', 'ld-core', 'LD');
const LAS = load('../docs/las-checker/index.html', 'las-core', 'LAS');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// ---- the synthetic log: 3 tracks (GR linear, RT log 0.2-2000, RHOB/NPHI), 10 px per m, 1500-1600 m
const L = LD.synthLog();
const sp = L.truth.spec;
const trackOf = i => { const t = sp.tracks[i]; return { x0: t.x0, x1: t.x1, left: t.left, right: t.right, log: t.log }; };
const band = { yTop: L.truth.yOf(1500), yBot: L.truth.yOf(1600) };
const ticks = [1500, 1550, 1600].map(d => ({ y: L.truth.yOf(d), depth: d }));
const dc = LD.fitDepth(ticks);
const depths = LD.makeDepths(1500.5, 1599.5, 0.5);
const base = { mode: 'color', tol: 30, metric: 'lab', maxJump: 15, maxGap: 10 };
const run = (img, tr, cfg, truthFn) => {
  const u = LD.digitise(img, band, tr, cfg);
  assert.ok(u, 'digitise returned nothing');
  const v = LD.sampleCurve(u, dc, tr, depths, band);
  return { u, v, truth: depths.map(truthFn), n: v.filter(x => x !== LD.NULL).length };
};
const stat = (v, t, f) => { let mx = 0, s = 0, n = 0; v.forEach((x, i) => { if (x === LD.NULL) return; const e = f(x, t[i]); mx = Math.max(mx, e); s += e; n++; }); return { max: mx, mean: s / n, n }; };
const count = a => a.a.reduce((s, x) => s + x, 0);

test('depth calibration: round trip, least squares with noisy ticks', () => {
  assert.ok(Math.abs(dc.yOf(1537.3) - L.truth.yOf(1537.3)) < 1e-9);
  assert.ok(Math.abs(dc.dOf(L.truth.yOf(1581)) - 1581) < 1e-9);
  assert.ok(dc.rms < 1e-9);
  const noisy = LD.fitDepth([{ y: 100, depth: 0 }, { y: 200.4, depth: 10 }, { y: 299.8, depth: 20 }]);
  assert.ok(Math.abs(noisy.b - 0.1) < 0.002 && noisy.rms < 0.05);
  assert.equal(LD.fitDepth([{ y: 1, depth: 1 }]), null);
  assert.equal(LD.fitDepth([{ y: 5, depth: 1 }, { y: 5, depth: 2 }]), null);
});

test('track scale: x -> value exact at the edges, linear and logarithmic, reversed scale', () => {
  const lin = { x0: 50, x1: 250, left: 0, right: 150, log: false }, lg = { x0: 270, x1: 470, left: 0.2, right: 2000, log: true };
  assert.equal(LD.xToValue(lin, 50), 0); assert.equal(LD.xToValue(lin, 250), 150); assert.equal(LD.xToValue(lin, 150), 75);
  assert.ok(Math.abs(LD.xToValue(lg, 270) - 0.2) < 1e-12); assert.ok(Math.abs(LD.xToValue(lg, 470) / 2000 - 1) < 1e-12);
  assert.ok(Math.abs(LD.xToValue(lg, 370) - 20) < 1e-9, 'middle of 0.2-2000 is 20');
  assert.ok(Math.abs(LD.xToValue(lg, 320) / Math.sqrt(0.2 * 20) - 1) < 1e-9);
  const rev = { x0: 0, x1: 100, left: 0.45, right: -0.15, log: false };
  assert.ok(Math.abs(LD.xToValue(rev, 0) - 0.45) < 1e-12 && Math.abs(LD.xToValue(rev, 100) + 0.15) < 1e-12);
  assert.ok(Math.abs(LD.valueToU(lg, LD.uToValue(lg, 0.37)) - 0.37) < 1e-12);
  assert.ok(LD.validScale(lin) && !LD.validScale({ left: 0, right: 10, log: true }) && !LD.validScale({ left: 1, right: 1 }));
});

test('colour mask excludes grid lines (light grey) and other colours', () => {
  const tr = trackOf(0), rect = { x0: 52, x1: 248, y0: 62, y1: 1058 };
  const gr = [26, 154, 58];
  // very generous tolerance: grey grid lines are still excluded when the ink is coloured
  const m = LD.colourMask(L.img, rect, gr, 85, { grid: true });
  const m0 = LD.colourMask(L.img, rect, gr, 85, { grid: false });
  assert.ok(count(m0) > count(m) * 1.5, `grid exclusion should remove many pixels (${count(m0)} vs ${count(m)})`);
  // a major grid row (1525 m): no masked pixel on it apart from the curve itself
  const row = Math.floor(L.truth.yOf(1525)) - rect.y0;
  let n = 0; for (let i = 0; i < m.w; i++) n += m.a[row * m.w + i]; assert.ok(n <= 12, `grid row has ${n} masked pixels`);
  const red = LD.colourMask(L.img, { x0: 272, x1: 468, y0: 62, y1: 1058 }, gr, 30, {});
  assert.equal(count(red), 0, 'the green ink is not found in the resistivity track');
  assert.ok(count(LD.colourMask(L.img, rect, gr, 60, { metric: 'rgb' })) > 400);
  assert.ok(tr.x0 === 50);
});

test('linear track (GR, colour mode): error below 1% of the track width', () => {
  const sc = sp.curves[0], r = run(L.img, trackOf(0), { ...base, ink: sc.color }, sc.fn);
  const e = stat(r.v, r.truth, (x, t) => Math.abs(x - t) / 150);
  console.log(`      GR: n=${e.n}/${depths.length}, mean ${(e.mean * 100).toFixed(3)} %, max ${(e.max * 100).toFixed(3)} % of track width`);
  assert.ok(e.n >= depths.length - 1);
  assert.ok(e.max < 0.01, `max error ${e.max}`);
});

test('log track (RT 0.2-2000): error below 0.03 decade (7 % relative)', () => {
  const sc = sp.curves[1], r = run(L.img, trackOf(1), { ...base, ink: sc.color }, sc.fn);
  const e = stat(r.v, r.truth, (x, t) => Math.abs(Math.log10(x / t)));
  console.log(`      RT: n=${e.n}/${depths.length}, mean ${e.mean.toFixed(4)} decade, max ${e.max.toFixed(4)} decade`);
  assert.ok(e.n >= depths.length - 1);
  assert.ok(e.max < 0.03, `max error ${e.max} decade`);
});

test('second curve in the same track as a dashed one: no leakage between the inks', () => {
  const sc = sp.curves[2], r = run(L.img, trackOf(2), { ...base, ink: sc.color }, sc.fn);
  const e = stat(r.v, r.truth, (x, t) => Math.abs(x - t) / 1.0);
  console.log(`      RHOB: mean ${(e.mean * 100).toFixed(3)} %, max ${(e.max * 100).toFixed(3)} % of track width`);
  assert.ok(e.max < 0.01, `max error ${e.max}`);
});

test('gaps: dashed curve is filled by interpolation up to maxGap, left null beyond', () => {
  const sc = sp.curves[3], tr = { ...trackOf(2), left: 0.45, right: -0.15 };
  const raw = LD.digitise(L.img, band, tr, { ...base, ink: sc.color, maxGap: 0 });
  const holes = raw.slice(Math.ceil(band.yTop) + 3, Math.floor(band.yBot) - 3).filter(x => x !== x).length;
  assert.ok(holes > 100, `the dashes should leave holes in the raw trace (${holes})`);
  const r = run(L.img, tr, { ...base, ink: sc.color, maxGap: 10 }, sc.fn);
  const e = stat(r.v, r.truth, (x, t) => Math.abs(x - t) / 0.6);
  console.log(`      NPHI dashed: n=${e.n}/${depths.length}, mean ${(e.mean * 100).toFixed(3)} %, max ${(e.max * 100).toFixed(3)} % of track width`);
  assert.ok(e.n >= depths.length - 2 && e.max < 0.02, `n ${e.n} max ${e.max}`);
  const r2 = run(L.img, tr, { ...base, ink: sc.color, maxGap: 2 }, sc.fn);
  assert.ok(r2.n < r.n - 20, `short maxGap leaves nulls (${r2.n} vs ${r.n})`);
  assert.ok(r2.v.some(v => v === -999.25));
  const u = Float32Array.from({ length: 40 }, (_, i) => (i >= 10 && i < 20) ? NaN : i / 100);
  LD.interpGaps(u, 12); assert.ok(Math.abs(u[15] - 0.15) < 1e-6);
  const u2 = Float32Array.from({ length: 40 }, (_, i) => i >= 10 && i < 20 ? NaN : i / 100); LD.interpGaps(u2, 5); assert.ok(Number.isNaN(u2[15]));
  const u3 = Float32Array.from({ length: 10 }, (_, i) => i < 3 ? NaN : i / 100); LD.interpGaps(u3, 12); assert.ok(Number.isNaN(u3[0]), 'leading gap is not extrapolated');
});

test('wrap: curve leaving the track on the right and returning on the left, backup scale 100-200', () => {
  const spec = LD.DEFAULT_SPEC();
  spec.tracks = [{ x0: 50, x1: 250, left: 0, right: 100, log: false }];
  const fn = d => 85 + 70 * Math.sin((d - 1500) / 7.5);
  spec.curves = [{ track: 0, mnem: 'GR', color: [26, 154, 58], lw: 2.2, wrap: true, fn }];
  const Wp = LD.renderLog(spec), tr = { x0: 50, x1: 250, left: 0, right: 100, log: false, scale2: { left: 100, right: 200 } };
  const cfg = { ...base, ink: [26, 154, 58], wrap: true };
  const u = LD.digitise(Wp.img, band, tr, cfg);
  const v = LD.sampleCurve(u, dc, tr, depths, band), t = depths.map(fn);
  assert.ok(t.some(x => x > 110) && t.some(x => x < 20), 'the truth must exceed the primary scale');
  const e = stat(v, t, (x, y) => Math.abs(x - y) / 100);
  console.log(`      wrap: n=${e.n}/${depths.length}, mean ${(e.mean * 100).toFixed(3)} %, max ${(e.max * 100).toFixed(3)} % of primary scale`);
  assert.ok(e.n >= depths.length - 2 && e.max < 0.025, `n ${e.n} max ${e.max}`);
  const u0 = LD.digitise(Wp.img, band, tr, { ...cfg, wrap: false }), v0 = LD.sampleCurve(u0, dc, tr, depths, band);
  const e0 = stat(v0, t, (x, y) => Math.abs(x - y) / 100);
  assert.ok(e0.max > 0.2 || e0.n < e.n - 10, 'without wrap handling the wrapped part is lost or wrong');
  const v2 = LD.sampleCurve(u, dc, { ...tr, scale2: null }, depths, band);
  assert.ok(stat(v2, t, (x, y) => Math.abs(x - y) / 100).max < 0.025, 'without a second scale the primary scale is continued');
});

test('black-and-white tracker follows a dashed, noisy, black curve among grid lines', () => {
  const spec = LD.DEFAULT_SPEC();
  spec.tracks = [spec.tracks[0]]; spec.noise = 0.004; spec.gridMinor = [120, 120, 120]; spec.gridMajor = [70, 70, 70];
  const fn = sp.curves[0].fn;
  spec.curves = [{ track: 0, mnem: 'GR', color: [0, 0, 0], lw: 2.4, dash: [14, 6], fn }];
  const B = LD.renderLog(spec), tr = trackOf(0);
  const yc = d => B.truth.yOf(d), xc = d => tr.x0 + fn(d) / 150 * 200;
  const cfg = { mode: 'bw', maxJump: 12, maxGap: 12, thr: 45, wps: [[xc(1540), yc(1540)]] };
  const u = LD.digitise(B.img, band, tr, cfg), v = LD.sampleCurve(u, dc, tr, depths, band), t = depths.map(fn);
  const e = stat(v, t, (x, y) => Math.abs(x - y) / 150);
  console.log(`      B&W dashed+noise, 1 click: n=${e.n}/${depths.length}, mean ${(e.mean * 100).toFixed(3)} %, max ${(e.max * 100).toFixed(3)} % of track width`);
  assert.ok(e.n >= depths.length - 3);
  assert.ok(e.mean < 0.01 && e.max < 0.05, `mean ${e.mean} max ${e.max}`);
  const wps2 = [1505, 1530, 1560, 1590, 1595].map(d => [xc(d), yc(d)]);
  const u2 = LD.digitise(B.img, band, tr, { ...cfg, wps: wps2 }), v2 = LD.sampleCurve(u2, dc, tr, depths, band);
  const e2 = stat(v2, t, (x, y) => Math.abs(x - y) / 150);
  assert.ok(e2.max < 0.02 && e2.n >= depths.length - 1, `waypoints: max ${e2.max} n ${e2.n}`);
});

test('manual correction replaces a stretch and keeps the rest', () => {
  const tr = trackOf(0), u0 = LD.digitise(L.img, band, tr, { ...base, ink: sp.curves[0].color });
  const u = u0.slice(), pts = [[100, 300.5], [150, 320.5], [120, 340.5]];
  LD.replaceStretch(u, pts, tr);
  assert.ok(Math.abs(u[300] - 0.25) < 0.003 && Math.abs(u[340] - 0.35) < 0.003 && Math.abs(u[320] - 0.5) < 0.01);
  assert.equal(u[299], u0[299]); assert.equal(u[341], u0[341]);
});

test('auto detection: horizontal grid lines, track borders', () => {
  const g = LD.detectHLines(L.img, { x0: 52, x1: 688, y0: 40, y1: 1080 });
  assert.ok(Math.abs(g.spacing - 50) < 1, `minor spacing ${g.spacing}`);
  assert.ok(Math.abs(g.majorSpacing - 250) < 2, `major spacing ${g.majorSpacing}`);
  assert.ok(Math.abs(g.ys[0] - L.truth.yOf(1500)) < 1);
  assert.ok(Math.abs(LD.snapTo(g.ys, L.truth.yOf(1550) + 3, 6) - L.truth.yOf(1550)) < 1);
  const xs = LD.detectVLines(L.img, { x0: 0, x1: L.img.w, y0: 40, y1: 1080 });
  assert.equal(xs.length, 6, `borders: ${xs}`);
  const tracks = LD.proposeTracks(xs, 40);
  assert.equal(tracks.length, 3);
  [[50, 250], [270, 470], [490, 690]].forEach(([a, b], i) => assert.ok(Math.abs(tracks[i].x0 - a) < 1.5 && Math.abs(tracks[i].x1 - b) < 1.5));
});

test('rotate / deskew: two clicks on a tilted vertical line restore it; crop', () => {
  const R = LD.rotateImage(L.img, 2.5);
  const f = 2.5 * Math.PI / 180, cx = L.img.w / 2, cy = L.img.h / 2, rot = (x, y) => [(x - cx) * Math.cos(f) - (y - cy) * Math.sin(f) + cx, (x - cx) * Math.sin(f) + (y - cy) * Math.cos(f) + cy];
  const p1 = rot(50, 100), p2 = rot(50, 1000), deg = LD.deskewDeg(p1, p2);
  assert.ok(Math.abs(deg + 2.5) < 1e-6, `deskew angle ${deg}`);
  const back = LD.rotateImage(R, deg);
  const xs = LD.detectVLines(back, { x0: 0, x1: back.w, y0: 100, y1: 1000 });
  assert.ok(xs.length >= 5 && Math.abs(xs[0] - 50) < 1, `borders after deskew: ${xs}`);
  const sc = sp.curves[0], r = run(back, trackOf(0), { ...base, ink: sc.color, tol: 45 }, sc.fn);
  assert.ok(stat(r.v, r.truth, (x, t) => Math.abs(x - t) / 150).mean < 0.01);
  const c = LD.cropImage(L.img, 40, 50, 300, 400); assert.equal(c.w, 300); assert.equal(c.h, 400);
  assert.equal(c.data[(10 * 300 + 10) * 4], L.img.data[(60 * L.img.w + 50) * 4]);
});

test('LAS 2.0 output parses back with the LAS checker and gives the same values', () => {
  const step = 0.5, ds = LD.makeDepths(1498, 1602, step), cur = [];
  for (const [i, mn, un] of [[0, 'GR', 'GAPI'], [1, 'RT', 'OHMM'], [2, 'RHOB', 'G/C3']]) {
    const sc = sp.curves[i], tr = trackOf(sc.track), u = LD.digitise(L.img, band, tr, { ...base, ink: sc.color });
    cur.push({ mnem: mn, unit: un, values: LD.sampleCurve(u, dc, tr, ds, band) });
  }
  assert.ok(cur.every(c => c.values.some(v => v === LD.NULL)), 'depths outside the traced band are null');
  const text = LD.buildLAS({ depthUnit: 'M', step, depths: ds, well: 'FICTITIOUS-1', comp: 'NONE', field: 'NONE', date: '2026-11-26', curves: cur });
  const las = LAS.parse(text, 'out.las'), f = LAS.check(las);
  assert.deepEqual([...f.filter(x => x.sev === 'E').map(x => `${x.rule} ${x.msg}`)], []);
  assert.equal(las.ver.VERS, '2.0'); assert.equal(las.curves.length, 4); assert.equal(las.data.length, ds.length);
  assert.deepEqual([...las.curves.map(c => c.mnem)], ['DEPT', 'GR', 'RT', 'RHOB']);
  assert.equal(las.nullVal, -999.25);
  let worst = 0;
  las.data.forEach((row, i) => {
    assert.ok(Math.abs(row[0] - ds[i]) < 1e-9);
    cur.forEach((c, k) => { const w = c.values[i]; if (w === LD.NULL) assert.equal(row[k + 1], -999.25); else worst = Math.max(worst, Math.abs(row[k + 1] - w)); });
  });
  assert.ok(worst <= 5e-5 + 1e-12, `values differ by up to ${worst}`);
  assert.equal(+las.well.find(h => h.mnem === 'STRT').value, 1498); assert.equal(+las.well.find(h => h.mnem === 'STEP').value, 0.5);
  const csv = LD.buildCSV({ depthUnit: 'M', depths: ds, curves: cur }).split('\r\n');
  assert.equal(csv[0], 'DEPT_M,GR_GAPI,RT_OHMM,RHOB_G/C3'); assert.equal(csv.length, ds.length + 2);
  assert.equal(csv[1], '1498,,,');
});

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ', name); }
  catch (e) { fail++; console.log('FAIL ', name, '\n     ', (e.stack || e.message).split('\n').slice(0, 6).join('\n      ')); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
