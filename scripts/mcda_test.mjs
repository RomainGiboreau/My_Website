// Self-check for the MCDA core (docs/mcda/index.html, <script id="mcda-core">).
// Run: node scripts/mcda_test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../docs/mcda/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="mcda-core">([\s\S]*?)<\/script>/); assert.ok(m, 'mcda-core block not found');
const w = {}; new Function('window', m[1])(w); const M = w.MCDA;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok   ' + name); };
const P = (s, o) => M.parseNumber(s, o);

// ---- AHP -------------------------------------------------------------------------------------------------------
test('AHP Saaty 3x3: w 0.6370/0.2583/0.1047, lambda 3.0385, CR 0.0332', () => {
  const r = M.ahpSolve([[1, 3, 5], [1 / 3, 1, 3], [1 / 5, 1 / 3, 1]]);
  near(r.w[0], 0.6370, 5e-5); near(r.w[1], 0.2583, 5e-5); near(r.w[2], 0.1047, 5e-5); near(r.lam, 3.0385, 5e-5); near(r.CR, 0.0332, 5e-5);
});
test('AHP consistent 4x4 (a_ij = w_i/w_j): CR 0 and exact weights', () => {
  const v = [8, 4, 2, 1], A = v.map(a => v.map(b => a / b)), r = M.ahpSolve(A);
  near(r.CR, 0, 1e-9); near(r.lam, 4, 1e-9); r.w.forEach((x, i) => near(x, v[i] / 15, 1e-9));
});
test('AHP above 10 criteria: CR is NaN (no verified RI), not a wrong number', () => {
  const r = M.ahpSolve(Array.from({ length: 11 }, () => new Array(11).fill(1))); assert.ok(Number.isNaN(r.CR));
});

// ---- PROMETHEE ---------------------------------------------------------------------------------------------------
const vshape = (k) => Array.from({ length: k }, () => ({ rule: 'max', pf: 3, q: 0, p: 2, s: 0 }));
test('PROMETHEE V-shape, 4 alternatives, 2 criteria, w 0.6/0.4, p = 2: flows 0.3667/0.3000/0.1667/-0.8333, sum 0', () => {
  const X = [[2, 2], [1, 4], [2, 1], [0, 0]], F = M.flows(X, [0.6, 0.4], vshape(2));
  [0.3667, 0.3, 0.1667, -0.8333].forEach((v, i) => near(F.phi[i], v, 5e-5, 'phi' + i));
  near(F.phi.reduce((a, b) => a + b, 0), 0, 1e-12); near(F.pp.reduce((a, b) => a + b, 0), F.pm.reduce((a, b) => a + b, 0), 1e-12);
});
const critRR = () => [0, 1].map(() => ({ rule: 'max', pf: 5, q: 0, p: 0, s: 0 }));
const phiOn = (raw, thr, th) => { // thresholds fixed once (q = 5 %, p = 30 % of the range of the first three alternatives), as the page does at load
  const crit = critRR(), i3 = [0, 1, 2], base = M.prefMatrix(raw.slice(0, 3), crit, i3, 'minmax', thr);
  crit.forEach((c, k) => { const v = base.pm.map(r => r[k]), rg = Math.max(...v) - Math.min(...v); c.q = .05 * rg; c.p = .3 * rg });
  const pm = M.prefMatrix(raw, crit, raw.map((_, i) => i), 'minmax', thr).pm; return M.flows(pm, [.5, .5], crit).phi;
};
test('rank dependence: standardised thresholds make A = C after adding a dominated alternative; criterion units keep A > C', () => {
  const R3 = [[10, 5], [8, 9], [6, 10]], R4 = R3.concat([[0, 0]]);
  const s3 = phiOn(R3, 'std'), s4 = phiOn(R4, 'std'), u3 = phiOn(R3, 'units'), u4 = phiOn(R4, 'units');
  assert.ok(s3[0] > s3[2] + 1e-9, 'std: A > C with 3'); near(s4[0], s4[2], 1e-9, 'std: A = C with 4 (documented defect of the standardised scale)');
  assert.ok(u3[0] > u3[2] + 1e-9, 'units: A > C with 3'); assert.ok(u4[0] > u4[2] + 1e-6, 'units: A > C still with 4');
});
test('units mode: "lower is better" is a sign flip of the raw value, windows stay on 0..1', () => {
  const crit = [{ rule: 'min', pf: 3, p: 10 }, { rule: 'bp', a: 0, b: 1, c: 2, d: 3, pf: 3, p: .5 }], raw = [[5, 1.5], [8, 0.5]];
  const r = M.prefMatrix(raw, crit, [0, 1], 'minmax', 'units'); assert.deepEqual(r.pm[0], [-5, 1]); near(r.pm[1][1], .5, 1e-12); near(r.sc[0][0], 1, 1e-12);
});

// ---- number decoding (contract A) -----------------------------------------------------------------------------------------
test('parseNumber: plain, thousands, European, decimal comma, exponent, unicode minus, plus', () => {
  const ok = (s, v, o) => { const r = P(s, o); assert.equal(r.kind, 'ok', s); near(r.value, v, 1e-12, s) };
  ok('1234.5', 1234.5); ok('1,234.5', 1234.5); ok('1 234.5', 1234.5); ok('1.234,5', 1234.5); ok('1 234,5', 1234.5); ok('1,5', 1.5); ok('0,55', 0.55);
  ok('1e-3', 1e-3); ok('1E+30', 1e30); ok('−3.5', -3.5); ok('+7', 7); ok('1,234,567', 1234567); ok('1.234', 1.234);
});
test('parseNumber: 1,234 is thousands by default, decimal when the column uses a decimal comma; flagged ambiguous', () => {
  assert.equal(P('1,234').value, 1234); assert.ok(P('1,234').ambiguous);
  assert.equal(P('1,234', { decimalComma: true }).value, 1.234);
});
test('parseNumber: missing, below detection (limit kept), text', () => {
  for (const s of ['', '-', 'n.d.', 'nd', 'NA', 'NaN', 'null']) assert.equal(P(s).kind, 'missing', s);
  const b = P('<0,1'); assert.equal(b.kind, 'below'); assert.equal(b.value, null); assert.equal(b.limit, 0.1); assert.equal(P('<5').limit, 5);
  assert.equal(P('abc').kind, 'text'); assert.equal(P('12abc').kind, 'text');
});
test('parseTable: "100 0,55" is two whitespace fields, not split on the comma', () => {
  const t = M.parseTable('P1 100 0,55\nP2 200 0,60\nP3 150 0,41', 2); assert.equal(t.nc, 3); assert.equal(t.sep, ' ');
  assert.equal(M.toN(t.rows[0][2], t.decimalComma), 0.55); assert.equal(M.toN(t.rows[0][1], t.decimalComma), 100);
});
test('parseTable: ";" file with decimal commas, "1,234" read as 1.234 there; comma CSV with 1,234.5 not split wrongly', () => {
  const t = M.parseTable('Name;A;B\nx;1,234;5,5\ny;2,5;3,25', 2); assert.equal(t.decimalComma, true); assert.equal(M.toN(t.rows[0][1], t.decimalComma), 1.234);
  const c = M.parseTable('Name,A,B\nx,12.5,3\ny,7,4.25\nz,3,1', 2); assert.equal(c.sep, ','); assert.equal(c.nc, 3);
  const q = M.parseTable('Name\tA\tB\nx\t"1,234.5"\t3\ny\t2,000\t4', 2); assert.equal(q.sep, '\t'); assert.equal(M.toN(q.rows[0][1], q.decimalComma), 1234.5);
});
test('parseTable: header optional, line numbers kept; units row detected', () => {
  const t = M.parseTable('# c\nName\tV\tG\n\n(m)\t(MMbbl)\t(scf)\nA\t1\t2\nB\t3\t4', 2); assert.deepEqual(t.head, ['Name', 'V', 'G']); assert.ok(t.units); assert.deepEqual(t.lineNo, [5, 6]);
  const h = M.parseTable('1\t2\n3\t4', 2); assert.deepEqual(h.head, ['col 1', 'col 2']); assert.equal(h.rows.length, 2);
});
test('null sentinels: default list parses, matching tolerant', () => {
  const l = M.parseNulls(M.DEFAULT_NULLS); assert.ok(l.includes(-999) && l.includes(-999.25) && l.includes(1e30) && l.includes(1.70141e38));
  assert.ok(M.isNull(-999, l)); assert.ok(!M.isNull(-998, l)); assert.deepEqual(M.parseNulls(''), []);
});
test('constant criterion gives identical scores (no discrimination), no NaN', () => {
  const st = M.colStats([4, 4, 4]); [ 'minmax', 'vector', 'z' ].forEach(nm => { const s = M.cScore(4, { rule: 'max' }, st, nm); assert.ok(Number.isFinite(s)) });
});
console.log(`\n${n} tests passed`);
