// Self-check for the MCDA AHP core (docs/mcda-ahp/index.html, <script id="mcda-ahp-core">).
// Run: node scripts/mcda_ahp_test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../docs/mcda-ahp/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="mcda-ahp-core">([\s\S]*?)<\/script>/); assert.ok(m, 'mcda-ahp-core block not found');
const w = {}; new Function('window', m[1])(w); const M = w.MCDA_AHP;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok   ' + name); };

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

test('AHP: two-level groups, global weight = group weight x local weight; the judgment matrix is reciprocal', () => {
  const crit = [{ name: 'a', grp: 'G1' }, { name: 'b', grp: 'G1' }, { name: 'c', grp: 'G2' }], J = { top: { '0,1': 3 }, 'g:G1': { '0,1': 2 } };
  const r = M.ahpAll(crit, J); near(r.gw[2], 0.25, 1e-9); near(r.gw[0], 0.75 * 2 / 3, 1e-9); near(r.gw.reduce((a, b) => a + b, 0), 1, 1e-12);
  const A = M.ahpMat(J, 'g:G1', 2); near(A[0][1] * A[1][0], 1, 1e-12);
});
test('AHP: the weights file holds global weights, lambda max, CI, CR (null when not available) and the judgments', () => {
  const crit = ['A', 'B', 'C'].map(name => ({ name, grp: '' })), J = { all: { '0,1': 3, '0,2': 5, '1,2': 3 } }, f = JSON.parse(JSON.stringify(M.weightsFile(crit, J, 'MCDA AHP test')));
  assert.equal(f.format, 'mcda-ahp-weights'); assert.equal(f.version, 1); assert.equal(f.n, 3); assert.equal(f.computedBy, 'MCDA AHP test');
  near(f.criteria[0].weight, 0.6370, 5e-5); near(f.criteria[1].weight, 0.2583, 5e-5); near(f.criteria[2].weight, 0.1047, 5e-5);
  near(f.lambdaMax, 3.0385, 5e-5); near(f.CR, 0.0332, 5e-5); assert.deepEqual(f.judgments, J);
  const big = Array.from({ length: 11 }, (_, i) => ({ name: 'c' + i, grp: '' })), g = JSON.parse(JSON.stringify(M.weightsFile(big, {}, '')));
  assert.equal(g.CR, null); assert.equal(g.criteria.length, 11); near(g.criteria[0].weight, 1 / 11, 1e-12);
});
test('AHP: the criteria list parses (comments, groups after a tab or a semicolon, duplicate names numbered) and the file reloads', () => {
  const c = M.parseCriteria('# criteria\nVolume\tEconomics\nCost;Economics\n\nRisk\nRisk\n');
  assert.deepEqual(c, [{ name: 'Volume', grp: 'Economics' }, { name: 'Cost', grp: 'Economics' }, { name: 'Risk', grp: '' }, { name: 'Risk (2)', grp: '' }]);
  const J = { all: { '0,1': 2 } }, s = M.readSession(JSON.parse(JSON.stringify(M.weightsFile(c, J, 'x'))));
  assert.deepEqual(s.crit, c); assert.deepEqual(s.ahp, J);
  assert.throws(() => M.readSession({ format: 'other' }), /not an MCDA AHP weights file/);
});
console.log(`\n${n} tests passed`);
