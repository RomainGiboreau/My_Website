// Self-check for the Map interpolation core (docs/gridding/index.html, <script id="gridding-core">).
// Run: node scripts/gridding_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

function load(path, id) {
  const html = readFileSync(new URL(path, import.meta.url), 'utf8');
  const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`));
  assert.ok(m, `${id} script block not found`);
  const ctx = { window: {} };
  vm.runInNewContext(m[1], ctx);
  return ctx.window;
}
const G = load('../docs/gridding/index.html', 'gridding-core').GRD;
const ZMAP = load('../docs/zmap-checker/index.html', 'zmap-core').ZMAP;   // independent reader/checker for the ZMAP+ round trip

let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e.message).split('\n')[0]); } };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} got ${a}, want ${b} +- ${tol}`);

// independent dense solver for the hand-solved systems (partial pivoting, plain arrays)
function solve(A, b) {
  const m = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < m; c++) {
    let p = c; for (let r = c + 1; r < m; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < m; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= m; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(m).fill(0);
  for (let r = m - 1; r >= 0; r--) { let s = M[r][m]; for (let k = r + 1; k < m; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}
const sph = (h, c0, c, a) => h <= 0 ? 0 : h >= a ? c0 + c : c0 + c * (1.5 * h / a - 0.5 * (h / a) ** 3);
const mkT = pts => ({ X: Float64Array.from(pts, p => p[0]), Y: Float64Array.from(pts, p => p[1]), Z: Float64Array.from(pts, p => p[2]), n: pts.length });
const rngs = G.rng(7);

// ---------------------------------------------------------------- kriging against a hand-solved system
const P6 = [[0, 0, 10], [1, 0, 12.5], [0, 1, 9], [1, 1, 13], [0.5, 1.6, 11.2], [1.7, 0.6, 14]];
const V6 = { model: 'spherical', c0: 0.3, c: 2, a: 1.5 };
function okSolve(pts, x, y, v) {   // ordinary kriging system with Lagrange multiplier, written independently of the page
  const k = pts.length, A = [], b = [];
  for (let i = 0; i < k; i++) { A.push([...pts.map((q, j) => sph(Math.hypot(pts[i][0] - q[0], pts[i][1] - q[1]), v.c0, v.c, v.a)), 1]); b.push(sph(Math.hypot(pts[i][0] - x, pts[i][1] - y), v.c0, v.c, v.a)); }
  A.push([...new Array(k).fill(1), 0]); b.push(1);
  const w = solve(A, b);
  let z = 0, s2 = 0; for (let i = 0; i < k; i++) { z += w[i] * pts[i][2]; s2 += w[i] * b[i]; } s2 += w[k];
  return { z, s2, w: w.slice(0, k) };
}
test('ordinary kriging equals the hand-solved 6-point system (estimate and variance)', () => {
  const T = mkT(P6), kn = new G.KNN(T.X, T.Y), B = G.newBuf(6);
  for (const [x, y] of [[0.5, 0.3], [0.9, 0.9], [1.3, 0.2]]) {
    const ref = okSolve(P6, x, y, V6), r = G.krigAt(T, kn, x, y, 6, G.floorVm(V6), 'ok', 0, 0, B, -1, new Float64Array(1));
    near(r[0], ref.z, 1e-7, `z at ${x},${y}`); near(r[1], ref.s2, 1e-7, `variance at ${x},${y}`);
  }
});
test('ordinary kriging is exact at the data points and its variance is 0 there', () => {
  const T = mkT(P6), kn = new G.KNN(T.X, T.Y), B = G.newBuf(6);
  for (const p of P6) { const r = G.krigAt(T, kn, p[0], p[1], 6, G.floorVm(V6), 'ok', 0, 0, B, -1, new Float64Array(1)); near(r[0], p[2], 1e-6); near(r[1], 0, 1e-6); }
});
test('universal kriging (linear drift) and thin-plate spline reproduce a plane exactly', () => {
  const pts = Array.from({ length: 40 }, () => { const x = rngs() * 2 - 1, y = rngs() * 2 - 1; return [x, y, 3 + 2 * x - 5 * y]; });
  const tr = mkT(pts), qx = Float64Array.from({ length: 25 }, () => rngs() * 1.6 - .8), qy = Float64Array.from({ length: 25 }, () => rngs() * 1.6 - .8);
  const P = { krig: { k: 16, kedpoly: false, model: 'spherical', vmode: 'manual', mean: 0, aniso: { mode: 'none', ratio: 1, angle: 0 }, vario: { model: 'spherical', c0: 0.05, c: 1, a: 0.8 } }, rbf: { kernel: 'tps', lambda: 0, c: 0.1, maxN: 1200 } };
  const u = G.predictAt('uk1', tr, qx, qy, P), t = G.predictAt('rbf', tr, qx, qy, P);
  for (let i = 0; i < 25; i++) { const e = 3 + 2 * qx[i] - 5 * qy[i]; near(u.z[i], e, 1e-6, 'UK'); near(t.z[i], e, 1e-8, 'TPS'); }
});

// ---------------------------------------------------------------- minimum curvature on a plane
test('minimum curvature on a plane: inside the data hull the error is the snapping of the data to nodes (about slope x cell / 2)', () => {
  const r = G.rng(1), pts = Array.from({ length: 200 }, () => { const x = r() - .5, y = r() - .5; return [x, y, 3 + 2 * x - 5 * y]; });
  const tr = mkT(pts), nx = 41, ny = 41, g = { x0: -.5, y0: -.5, dx: 1 / 40, dy: 1 / 40, nx, ny }, QX = new Float64Array(nx * ny), QY = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { QX[j * nx + i] = g.x0 + i * g.dx; QY[j * nx + i] = g.y0 + j * g.dy; }
  const res = G.predictAt('mincurv', tr, QX, QY, { mc: { tension: 0, iters: 400 } }, g);
  let worst = 0; for (let k = 0; k < QX.length; k++) if (Math.abs(QX[k]) < .35 && Math.abs(QY[k]) < .35) worst = Math.max(worst, Math.abs(res.z[k] - (3 + 2 * QX[k] - 5 * QY[k])));
  assert.ok(worst < 0.1, 'max interior error ' + worst);   // 5 x 0.025 / 2 = 0.06 from snapping; the corners far from data are extrapolation, not tested
});

// ---------------------------------------------------------------- manual anisotropy (ratio = minor/major <= 1)
const cloud = (n, f) => { const r = G.rng(3); return Array.from({ length: n }, () => { const x = r(), y = r(); return [x, y, f(x, y)]; }); };
const manP = (ratio, angle) => ({ krig: { k: 12, kedpoly: false, model: 'spherical', vmode: 'manual', mean: 0, aniso: { mode: 'manual', ratio, angle }, vario: { model: 'spherical', c0: 0.1, c: 1, a: 0.5 } } });
test('manual anisotropy: ratio 0.5 (minor/major) is applied like the former ratio 2; ratio 1 and invalid values give a message', () => {
  const tr = mkT(cloud(40, (x, y) => Math.sin(5 * x) + y));
  const a = manP(0.5, 30), b = manP(2, 30);
  const pa = G.krigPrep('ok', tr, a), pb = G.krigPrep('ok', tr, b);
  assert.ok(pa.an, 'ratio 0.5 must be applied'); near(pa.an.ratio, 2, 1e-9); near(pa.an.ang, 30 * Math.PI / 180, 1e-12);
  assert.ok(pb.an); near(pb.an.ratio, 2, 1e-9); assert.match(b.krig.anisoMsg, /inverted/);
  assert.match(a.krig.anisoMsg, /minor\/major/);
  const one = manP(1, 30); assert.equal(G.krigPrep('ok', tr, one).an, null); assert.match(one.krig.anisoMsg, /isotropic/);
  for (const bad of [0, -2, NaN]) { const q = manP(bad, 30); assert.equal(G.krigPrep('ok', tr, q).an, null); assert.match(q.krig.anisoMsg, /ignored/); }
});
test('manualAniso helper', () => {
  assert.equal(G.manualAniso(0.25).f, 4); assert.equal(G.manualAniso(3).f, 3); assert.equal(G.manualAniso(1).f, null); assert.equal(G.manualAniso(NaN).f, null);
});

// ---------------------------------------------------------------- null values (contract C)
test('null values: -999 is excluded and counted, a candidate not in the list is only a warning', () => {
  const rows = [['1', '1', '10'], ['2', '1', '-999'], ['3', '1', '12'], ['4', '1', '-999.25'], ['5', '1', '1e30'], ['6', '1', '-99999'], ['7', '1', '-99999'], ['8', '1', '-99999'], ['9', '1', '13']];
  const nl = G.parseNullList(G.DEFAULT_NULLS).list;
  assert.equal(nl.length, 6); for (const s of [-999, -999.25, -9999, 9999, 1e30, 1.70141e38]) assert.ok(nl.includes(s), String(s));
  const R = G.decodeRows(rows, { cx: 0, cy: 1, cz: 2, nulls: nl });
  assert.equal(R.pts.length, 6); assert.ok(!R.pts.some(p => p[2] === -999 || p[2] === -999.25 || p[2] === 1e30));
  assert.equal(R.nulls[-999], 1); assert.equal(R.nulls[-999.25], 1);
  assert.equal(R.cand[-99999], 3); assert.ok(R.pts.some(p => p[2] === -99999), 'a candidate is kept');
  const d = G.describeLoad(R);
  assert.match(d.text, /9 rows read, 3 skipped/); assert.ok(d.notes.some(s => /-999 was excluded/.test(s))); assert.ok(d.notes.some(s => /-99999 appears 3 times/.test(s)));
  assert.equal(G.decodeRows(rows, { cx: 0, cy: 1, cz: 2, nulls: [] }).pts.length, 9, 'an empty list excludes nothing');
});
test('skipped rows are counted with reason and first line numbers', () => {
  const rows = [['1', '1', '10'], ['2', 'abc', '5'], ['3', '1', ''], ['4', '1', '<0.1'], ['5', '1', 'n.d.'], ['6', '1', '7']];
  const R = G.decodeRows(rows, { cx: 0, cy: 1, cz: 2, nulls: [], lineNos: [2, 3, 4, 5, 6, 7] });
  assert.equal(R.pts.length, 2); assert.equal(R.skip['non-numeric'].n, 1); assert.equal(JSON.stringify(R.skip['non-numeric'].lines), '[3]');
  assert.equal(R.skip.missing.n, 2); assert.equal(R.skip['below detection limit'].n, 1);
  assert.match(G.describeLoad(R).text, /6 rows read, 4 skipped/);
});

// ---------------------------------------------------------------- numbers and delimiters (contract A)
test('parseNumber: thousands, decimal comma, exponents, missing, below detection', () => {
  const v = (s, o) => G.parseNumber(s, o).value;
  near(v('1234.5'), 1234.5, 0); near(v('1,234.5'), 1234.5, 0); near(v('1 234.5'), 1234.5, 0); near(v('1.234,5'), 1234.5, 0); near(v('1 234,5'), 1234.5, 0);
  near(v('1,5'), 1.5, 0); near(v('0,55'), 0.55, 0); near(v('0,555'), 0.555, 0); near(v('1e-3'), 0.001, 0); near(v('1E+30'), 1e30, 0); near(v('−5.5'), -5.5, 0); near(v('+7'), 7, 0);
  near(v('12,345,678'), 12345678, 0);
  assert.equal(G.parseNumber('1,234').value, 1234); assert.equal(G.parseNumber('1,234').amb, true);
  near(G.parseNumber('1,234', { decimalComma: true }).value, 1.234, 0);
  for (const s of ['', '-', 'n.d.', 'nd', 'NA', 'NaN', 'null']) assert.equal(G.parseNumber(s).kind, 'missing', s);
  assert.equal(G.parseNumber('<0.1').kind, 'below'); near(G.parseNumber('<0,1').limit, 0.1, 0);
  assert.equal(G.parseNumber('abc').kind, 'text'); assert.equal(G.parseNumber('12abc').kind, 'text');
});
test('parseTable: delimiters, decimal comma, header, line numbers; a decimal comma is never a delimiter', () => {
  let t = G.parseTable('X;Y;Depth\n1,5;2,5;100,25\n2,5;3,5;101,5\n');
  assert.equal(t.sep, ';'); assert.equal(t.decComma, true); assert.equal(t.rows.length, 2);
  let t2 = G.parseTable('x y z\n100 0,55 3\n200 0,60 4\n300 0,70 5');
  assert.equal(t2.sep, 'ws'); assert.equal(JSON.stringify(t2.rows[0]), JSON.stringify(['100', '0,55', '3'])); assert.equal(t2.decComma, true);
  let t3 = G.parseTable('1,2,3\n4,5,6\n7,8,9'); assert.equal(t3.sep, ','); assert.equal(t3.hasHead, false); assert.equal(t3.rows.length, 3);
  let t4 = G.parseTable('# comment\nX\tY\tZ\n1\t2\t3\n'); assert.equal(t4.sep, '\t'); assert.equal(t4.lineNos[0], 3);
  assert.ok(G.parseTable('1 2\n3 4').err); assert.equal(G.parseTable('   \n'), null);
});

// ---------------------------------------------------------------- collinearity and point count
test('collinearity: points on a diagonal are detected, a cloud is not', () => {
  const X = Float64Array.from({ length: 30 }, (_, i) => i), Y = Float64Array.from({ length: 30 }, (_, i) => 2 * i + 1);
  assert.ok(G.collinearity(X, Y) < 1e-9);
  const c = cloud(50, () => 0); assert.ok(G.collinearity(Float64Array.from(c, p => p[0]), Float64Array.from(c, p => p[1])) > 0.5);
});
test('automatic kriging with too few points fails with a clear message that matches the load threshold', () => {
  for (const k of [4, 5, 10]) {
    const tr = mkT(cloud(k, (x, y) => x + y)), P = manP(1, 0); P.krig.vmode = 'auto'; P.krig.aniso.mode = 'none';
    assert.throws(() => G.krigPrep('ok', tr, P), /at least about 25 are needed/, 'n=' + k);
  }
  const tr = mkT(cloud(G.KRIG_MIN_AUTO, (x, y) => x + y + Math.sin(9 * x))), P = manP(1, 0); P.krig.vmode = 'auto'; P.krig.aniso.mode = 'none';
  G.krigPrep('ok', tr, P);
});

// ---------------------------------------------------------------- variogram model choice
test('automatic variogram: when models differ by less than 3 % the simplest one is chosen and the tie is reported', () => {
  const tr = mkT(cloud(150, (x, y) => 20 * Math.sin(3 * x) * Math.cos(2 * y) + 2 * (G.rng(5)() - .5)));
  const f = G.autoVariogram(tr, 'auto', 16), lo = Math.min(...f.cand.map(c => c.loo));
  const near3 = f.cand.filter(c => c.loo <= 1.03 * lo);
  if (near3.length > 1) {
    assert.ok(f.tie && f.tie.n === near3.length);
    const order = ['spherical', 'exponential', 'matern', 'gaussian'];
    assert.equal(f.best.model, near3.map(c => c.model).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0]);
  } else assert.equal(f.tie, null);
});

// ---------------------------------------------------------------- cross-validation summary
test('cross-validation: a method evaluated on a subset is not ranked on its own subset', () => {
  const z = Float64Array.from({ length: 10 }, (_, i) => i);
  const full = Float64Array.from(z, v => v + 1), part = Float64Array.from(z, (v, i) => i < 9 ? v + 0.1 : NaN);
  part[9] = NaN; part[8] = NaN;
  // `part` is better on its own 8 points (0.1) but worse than `full2` on the common ones
  const full2 = Float64Array.from(z, (v, i) => i < 8 ? v + 0.05 : v + 3);
  const S = G.cvSummary([{ m: 'A', pred: full }, { m: 'TIN', pred: part }, { m: 'B', pred: full2 }], z);
  assert.equal(S.rows[1].n, 8); assert.equal(S.unequal, true); assert.equal(S.nCommon, 8); assert.match(S.note, /TIN 8\/10/);
  assert.equal(S.rows[S.best].m, 'B');   // common-subset RMSE: B 0.05 < TIN 0.1 < A 1
  const eq = G.cvSummary([{ m: 'A', pred: full }, { m: 'B', pred: full2 }], z); assert.equal(eq.unequal, false); assert.equal(eq.note, '');
});

// ---------------------------------------------------------------- ZMAP+ export, read back by the ZMAP checker reader
test('ZMAP+ export round trip with the zmap-checker reader: orientation, nulls, no finding', () => {
  const nx = 23, ny = 17, dx = 25, dy = 40, x0 = 451000, y0 = 6781000, z = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) z[j * nx + i] = 1500 + 0.05 * i * dx - 0.02 * j * dy + 12 * Math.sin(i / 3) * Math.cos(j / 2);
  z[3 * nx + 4] = NaN; z[0] = NaN; z[ny * nx - 1] = NaN;
  const txt = G.writeZmap({ nx, ny, dx, dy, x0, y0, z }, { label: 'TOP_TEST' }), zz = ZMAP.parse(txt, 'x.zmap'), f = ZMAP.check(zz).filter(x => x.sev !== 'I');
  assert.equal(f.length, 0, f.map(x => x.rule + ' ' + x.msg).join('; '));
  assert.equal(zz.nrows, ny); assert.equal(zz.ncols, nx); near(zz.dx, dx, 1e-9); near(zz.dy, dy, 1e-9); near(zz.xmin, x0, 1e-9); near(zz.ymax, y0 + (ny - 1) * dy, 1e-9);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
    const v = ZMAP.value(zz, r, c), w = z[(ny - 1 - r) * nx + c];   // row 0 of the file is the northern row
    if (w !== w) assert.ok(ZMAP.isNull(zz, v), 'null at ' + r + ',' + c); else near(v, w, 1e-6);
  }
});

console.log(`\n${n} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
