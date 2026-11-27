// Self-check for the Variogram core (docs/variogram/index.html, <script id="vg-core">).
// Run: node scripts/variogram_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../docs/variogram/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="vg-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'vg-core script block not found');
const ctx = { window: {} };
vm.runInNewContext(m[1], ctx);
const V = ctx.window.VG;

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} got ${a}, want ${b} +- ${tol}`);
const rnd = V.rng(5), gauss = () => { let s = 0; for (let i = 0; i < 12; i++) s += rnd(); return s - 6; };
const bounded = V.BOUNDED;

function bestFits(P, { order = 0, nl = 15 } = {}) {
  const d = V.detrend(P, order).P, zs = d.map(p => p[2]);
  const xs = d.map(p => p[0]), ys = d.map(p => p[1]);
  const ext = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)), cut = ext / 3;
  const ex = V.experimental(d, [{ az: null, name: 'omni' }], nl, cut, 22.5, 0, 'm')[0];
  const sets = [{ h: ex.pts.map(p => p.h), g: ex.pts.map(p => p.g), N: ex.pts.map(p => p.N), az: null }];
  const hm = Math.max(...sets[0].h);
  let b = null; for (const k of bounded) { const f = V.fitGen(sets, [k], true, false, hm); if (!b || f.wsse < b.wsse) b = f; }
  return { fit: b, varz: V.sampleVar(zs), ex, cut };
}

// ---- numbers (contract A)
test('parseNumber: formats, decimal comma, thousands, missing, below detection', () => {
  const p = (s, o) => V.parseNumber(s, o);
  const ok = (s, v, o) => { const r = p(s, o); assert.equal(r.kind, 'ok', s); near(r.value, v, 1e-9 * Math.max(1, Math.abs(v)), s); };
  ok('1234.5', 1234.5); ok('1,234.5', 1234.5); ok('1 234.5', 1234.5); ok('1.234,5', 1234.5); ok('1 234,5', 1234.5);
  ok('1,5', 1.5); ok('0,55', 0.55); ok('1e-3', 1e-3); ok('1E+30', 1e30); ok('−3.5', -3.5); ok('+4', 4);
  ok('1,234', 1234); ok('1,234', 1.234, { decimalComma: true });
  for (const s of ['', '-', 'n.d.', 'nd', 'NA', 'NaN', 'null']) assert.equal(p(s).kind, 'missing', s);
  const b = p('<0,1'); assert.equal(b.kind, 'below'); assert.equal(b.value, null); near(b.limit, 0.1, 1e-12);
  assert.equal(p('abc').kind, 'text'); assert.equal(p('12 34').kind, 'text');
});
test('parseTable: never splits "100 0,55" on the comma; decimal-comma whitespace file', () => {
  const t = V.parseTable('X Y Z\n100 200 0,55\n110 210 1,5\n120 220 2,25\n', 3);
  assert.equal(t.nc, 3); assert.equal(t.sep, ' ');
  const d = V.decodeRows(t.rows, t.ln, [0, 1, 2], []);
  assert.equal(d.pts.length, 3); near(d.pts[0][2], 0.55, 1e-12);
});
test('decodeRows: skipped rows counted with reasons and first line numbers', () => {
  const t = V.parseTable('X\tY\tZ\n1\t1\t5\n2\t2\tabc\n3\t3\t\n4\t4\t<0.1\n5\t5\t7\n', 3);
  const d = V.decodeRows(t.rows, t.ln, [0, 1, 2], []);
  assert.equal(d.read, 5); assert.equal(d.skipped, 3); assert.equal(JSON.stringify(d.first.text), "[3]"); assert.equal(JSON.stringify(d.first.missing), "[4]"); assert.equal(JSON.stringify(d.first.below), "[5]");
  const msg = V.loadMessage(d); assert.match(msg, /5 rows read, 3 skipped/); assert.match(msg, /below detection/);
});

// ---- null sentinels (contract C): -999 on 10 % of points
test('null value -999 on 10 % of points is excluded and counted (variance not polluted)', () => {
  const rows = [], ln = []; const P = [];
  for (let i = 0; i < 300; i++) { const x = 1000 * rnd(), y = 1000 * rnd(), z = 10 + 2 * gauss(); P.push([x, y, z]); rows.push([String(x), String(y), i % 10 === 0 ? '-999' : String(z)]); ln.push(i + 2); }
  const nulls = V.parseNullList(V.NULL_DEFAULT); assert.equal(nulls.length, 6);
  const d = V.decodeRows(rows, ln, [0, 1, 2], nulls);
  assert.equal(d.pts.length, 270); assert.equal(d.cnt.sentinel, 30); assert.equal(d.nullHits['-999'], 30);
  assert.match(V.loadMessage(d), /30 values equal to the null value -999 were excluded/);
  assert.ok(V.sampleVar(d.pts.map(p => p[2])) < 10, 'variance sane');
  // not excluded when the list is emptied, but reported as a candidate
  const d2 = V.decodeRows(rows, ln, [0, 1, 2], []); assert.equal(d2.pts.length, 300);
  assert.equal(d2.cands.length, 1); assert.equal(d2.cands[0].v, -999);
  assert.match(V.loadMessage(d2), /-999 appears 30 times and is not in the null list/);
  // an undeclared sentinel -99999 is warned about, not excluded
  const d3 = V.decodeRows(rows.map((r, i) => i % 10 === 0 ? [r[0], r[1], '-99999'] : r), ln, [0, 1, 2], nulls);
  assert.equal(d3.pts.length, 300); assert.equal(d3.cands[0].v, -99999);
});

// ---- trend
test('trend z = 0.1 x + noise: warning raised, linear detrend removes it', () => {
  const P = []; for (let i = 0; i < 150; i++) { const x = 1000 * rnd(), y = 1000 * rnd(); P.push([x, y, 0.1 * x + 5 * gauss()]); }
  const a = bestFits(P);
  assert.ok(V.fitSill(a.fit) > 1.2 * a.varz, `sill ${V.fitSill(a.fit)} vs var ${a.varz}`);
  assert.match(V.trendWarning([a.fit], a.varz, 0), /probable trend \/ non-stationarity.*detrend/);
  const b = bestFits(P, { order: 1 });
  assert.equal(V.trendWarning([b.fit], b.varz, 1), null);
  assert.ok(b.varz < 60, 'residual variance close to the noise variance (25), got ' + b.varz);
});
test('detrend: quadratic surface is removed exactly, order 0 is identity', () => {
  const P = []; for (let i = 0; i < 80; i++) { const x = 100 * rnd(), y = 100 * rnd(); P.push([x, y, 3 + 0.2 * x - 0.1 * y + 0.01 * x * x + 0.005 * x * y - 0.003 * y * y]); }
  const r = V.detrend(P, 2); for (const p of r.P) near(p[2], 0, 1e-6);
  assert.equal(V.detrend(P, 0).P, P);
});
test('stationary data: no trend warning', () => {
  const P = []; for (let i = 0; i < 200; i++) P.push([1000 * rnd(), 1000 * rnd(), 5 * gauss()]);
  const a = bestFits(P); assert.equal(V.trendWarning([a.fit], a.varz, 0), null, 'sill ' + V.fitSill(a.fit) + ' var ' + a.varz);
});

// ---- anisotropy ratio from a common model
test('anisotropy ratio uses one common model, not ranges of different models', () => {
  const mk = (kind, r, w) => ({ c0: 0, st: [{ kind, c: 1, r, p: null }], wsse: w });
  // direction A: exp best (r 3000), sph second (r 1000); direction B: sph best (r 500), exp second (r 1500)
  const perDir = [[mk('sph', 1000, 5), mk('exp', 3000, 1)], [mk('sph', 500, 1), mk('exp', 1500, 6)]];
  const r = V.commonModelRatio(perDir);
  assert.equal(r.c, 1 - 1 + 0); // totals: sph 6, exp 7 -> sph
  near(r.ratio, 0.5, 1e-12);                       // 500/1000, not 500/3000 (mixed models)
  assert.equal(V.commonModelRatio([perDir[0]]), null);
  assert.equal(V.commonModelRatio([[null], [mk('sph', 1, 1)]]), null);
  assert.ok(/Ratio \(minor\/major range, <= 1\)/.test(html), 'label wording shared with the Map interpolation tool');
});

// ---- machine-readable export
test('modelJSON: parsable, conventions stated, joint anisotropy', () => {
  const f = { c0: 0.1, st: [{ kind: 'exp', c: 2, r: 900, p: null }, { kind: 'sph', c: 1, r: 3000, p: null }], wsse: 3 };
  const ex = [{ dir: { az: null, name: 'omni' }, pts: [{ N: 10 }, { N: 20 }] }];
  const j = JSON.parse(JSON.stringify(V.modelJSON({ ex, fits: [f], joint: Object.assign({ th: 45, k: 0.5 }, f), estimator: 'Matheron', varz: 3, cut: 5000, detrend: 'linear' })));
  assert.equal(j.format, 'variogram-model'); assert.equal(j.version, 1); assert.equal(j.anisotropyRatioConvention, 'minor/major range, <= 1');
  assert.equal(j.directions[0].model.structures[0].rangeType, 'practical (95 % of the sill)'); near(j.directions[0].model.totalSill, 3.1, 1e-12);
  assert.equal(j.joint.anisotropy.ratio, 0.5); assert.equal(j.detrend, 'linear');
});

// ---- numerical core (independent brute-force check; the numpy/scipy comparison quoted on the page cannot be rerun without Python)
test('experimental variogram equals a brute-force double loop (omni and directional, Matheron and Cressie-Hawkins)', () => {
  const P = []; for (let i = 0; i < 120; i++) P.push([1000 * rnd(), 1000 * rnd(), gauss()]);
  const nl = 10, cut = 400, w = cut / nl;
  for (const est of ['m', 'c']) for (const az of [null, 30]) {
    const ex = V.experimental(P, [{ az, name: 'd' }], nl, cut, 22.5, 0, est)[0];
    const S = Array(nl).fill(0), N = Array(nl).fill(0), H = Array(nl).fill(0);
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], h = Math.hypot(dx, dy); if (h === 0 || h >= cut) continue;
      if (az !== null) { let a = Math.atan2(dx, dy) * 180 / Math.PI; a = ((a % 180) + 180) % 180; let d = Math.abs(a - az); d = Math.min(d, 180 - d); if (d > 22.5 + 1e-9) continue; }
      const k = Math.floor(h / w), dz = P[j][2] - P[i][2]; N[k]++; H[k] += h; S[k] += est === 'c' ? Math.sqrt(Math.abs(dz)) : dz * dz;
    }
    const want = []; for (let k = 0; k < nl; k++) if (N[k]) want.push({ h: H[k] / N[k], N: N[k], g: est === 'c' ? Math.pow(S[k] / N[k], 4) / (2 * (0.457 + 0.494 / N[k])) : S[k] / (2 * N[k]) });
    assert.equal(ex.pts.length, want.length);
    ex.pts.forEach((p, i) => { assert.equal(p.N, want[i].N); near(p.g, want[i].g, 1e-9 * Math.max(1, want[i].g)); near(p.h, want[i].h, 1e-9 * want[i].h); });
  }
});
test('fit recovers a known spherical model from its exact variogram', () => {
  const h = Array.from({ length: 15 }, (_, i) => 50 * (i + 1)), g = h.map(v => 0.3 + 2 * V.KIND.sph.f(v / 400));
  const f = V.fitGen([{ h, g, N: h.map(() => 100), az: null }], ['sph'], true, false, 750);
  near(f.c0, 0.3, 0.02); near(f.st[0].c, 2, 0.03); near(f.st[0].r, 400, 8);
});

let fail = 0;
for (const [n, fn] of tests) { try { fn(); console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + (e && e.message)); } }
console.log(fail ? `\n${fail} test(s) failed` : `\nall ${tests.length} tests passed`);
process.exit(fail ? 1 : 0);
