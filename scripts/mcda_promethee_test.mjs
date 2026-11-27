// Self-check for the MCDA PROMETHEE core (docs/mcda-promethee/index.html, <script id="mcda-promethee-core">), including the weights file written by the MCDA AHP page.
// Run: node scripts/mcda_promethee_test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const load = (page, id, name) => {
  const html = readFileSync(new URL('../docs/' + page + '/index.html', import.meta.url), 'utf8');
  const m = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>')); assert.ok(m, id + ' block not found');
  const w = {}; new Function('window', m[1])(w); return w[name];
};
const M = load('mcda-promethee', 'mcda-promethee-core', 'MCDA_PRO'), AHP = load('mcda-ahp', 'mcda-ahp-core', 'MCDA_AHP');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok   ' + name); };
const P = (s, o) => M.parseNumber(s, o);

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

// ---- weights file: AHP page -> PROMETHEE page ------------------------------------------------------------------------------------
const CR5 = ['Oil volume (MMbbl)', 'GOR (scf/bbl)', 'Drilling depth (m)', 'Ownership (%)', 'Tax (USD/bbl)'].map(name => ({ name, grp: '' }));
const J5 = { all: { '0,1': 2, '0,2': 2, '0,3': 3, '0,4': 2, '1,3': 2, '2,3': 2, '3,4': 0.5 } };
test('round trip AHP -> file -> PROMETHEE: same weights, matched by name even if the order and the case differ', () => {
  const file = JSON.parse(JSON.stringify(AHP.weightsFile(CR5, J5, 'test'))), A = AHP.ahpAll(CR5, J5);
  const f = M.ahpWeightsRead(file); near(f.criteria.reduce((a, c) => a + c.weight, 0), 1, 1e-12);
  const names = ['tax (usd/bbl)', 'Oil volume (MMbbl)', 'Ownership (%)', 'GOR (scf/bbl)', 'Drilling depth (m)'], order = [4, 0, 3, 1, 2];
  const q = M.matchWeights(f, names); assert.deepEqual(q.missing, []); assert.deepEqual(q.unused, []);
  order.forEach((k, i) => near(q.w[i], A.gw[k], 1e-12, names[i]));
  near(f.CR, A.res[0].r.CR, 1e-12);
});
test('weights file: unmatched names are reported, not guessed; the matched weights are renormalized', () => {
  const f = M.ahpWeightsRead(AHP.weightsFile(CR5, J5, 'test'));
  const q = M.matchWeights(f, ['Oil volume (MMbbl)', 'GOR (scf/bbl)', 'Depth', 'Ownership (%)', 'Tax (USD/bbl)']);
  assert.deepEqual(q.missing, ['Depth']); assert.deepEqual(q.unused, ['Drilling depth (m)']); near(q.w.reduce((a, b) => a + b, 0), 1, 1e-12);
  near(q.w[1], f.criteria[1].weight / (1 - f.criteria[2].weight), 1e-12);
});
test('weights file: a unit written differently still matches on the name before the bracket', () => {
  const f = M.ahpWeightsRead(AHP.weightsFile(CR5, J5, 'test')), q = M.matchWeights(f, ['Oil volume (bbl)', 'GOR', 'Drilling depth (ft)', 'Ownership', 'Tax']);
  assert.deepEqual(q.missing, []); f.criteria.forEach((c, k) => near(q.w[k], c.weight, 1e-12));
});
test('weights file with groups: the file carries the global weights and the PROMETHEE reader keeps them', () => {
  const crit = [{ name: 'a', grp: 'G1' }, { name: 'b', grp: 'G1' }, { name: 'c', grp: 'G2' }], J = { top: { '0,1': 3 }, 'g:G1': { '0,1': 2 } };
  const f = M.ahpWeightsRead(JSON.parse(JSON.stringify(AHP.weightsFile(crit, J, 'test'))));
  near(f.criteria[2].weight, 0.25, 1e-9); near(f.criteria[0].weight, 0.75 * 2 / 3, 1e-9); near(f.criteria.reduce((a, c) => a + c.weight, 0), 1, 1e-12);
});
test('weights file: other formats and bad weights are refused with a reason', () => {
  assert.throws(() => M.ahpWeightsRead({ format: 'fdp-link' }), /not an MCDA AHP weights file/);
  assert.throws(() => M.ahpWeightsRead({ format: 'mcda-ahp-weights', criteria: [] }), /no criteria/);
  assert.throws(() => M.ahpWeightsRead({ format: 'mcda-ahp-weights', criteria: [{ name: 'a', weight: null }] }), /valid weight/);
  assert.throws(() => M.ahpWeightsRead({ format: 'mcda-ahp-weights', criteria: [{ name: 'a', weight: 0 }, { name: 'b', weight: 0 }] }), /zero/);
});
console.log(`\n${n} tests passed`);
