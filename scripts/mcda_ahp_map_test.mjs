// Self-check for the preference-map part of the MCDA AHP core (docs/mcda-ahp/index.html, <script id="mcda-ahp-core">).
// Run: node scripts/mcda_ahp_map_test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../docs/mcda-ahp/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="mcda-ahp-core">([\s\S]*?)<\/script>/); assert.ok(m, 'mcda-ahp-core block not found');
const w = {}; new Function('window', m[1])(w); const M = w.MCDA_AHP;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok   ' + name); };
const grid = (nx, ny, dx, dy, x0, y1, z) => M.makeGrid(nx, ny, dx, dy, x0, y1, Float64Array.from(z), 't');
const nulls = M.parseNulls(M.DEFAULT_NULLS);
const A = [1, 2, 3, 4, 5, 6, 7, 8, 9], B = [10, 20, 30, 40, 50, 60, 70, 80, 90];

test('standardise: min-max, lower is better reverses, bounds clamp, null stays null', () => {
  const s = M.standardise(Float64Array.from(A), 1, 9, true); near(s[0], 0, 1e-12); near(s[4], .5, 1e-12); near(s[8], 1, 1e-12);
  const r = M.standardise(Float64Array.from(B), 10, 90, false); near(r[0], 1, 1e-12); near(r[8], 0, 1e-12);
  const c = M.standardise(Float64Array.from(A), 3, 7, true); near(c[0], 0, 0); near(c[1], 0, 0); near(c[4], .5, 1e-12); near(c[8], 1, 0);
  assert.deepEqual(M.clampCount(Float64Array.from(A), 3, 7), { below: 2, above: 2 });
  assert.ok(Number.isNaN(M.standardise(Float64Array.of(1, NaN, 3), 1, 3, true)[1]));
  assert.throws(() => M.standardise(Float64Array.of(1, 2), 2, 2, true), /upper bound/);
});
test('bounds: min-max and 2-98 percentile (linear interpolation) on 1..101', () => {
  const z = Float64Array.from({ length: 101 }, (_, i) => i + 1);
  assert.deepEqual(M.boundsOf(z, 'minmax'), [1, 101]); const p = M.boundsOf(z, 'pct'); near(p[0], 3, 1e-9); near(p[1], 99, 1e-9);
});
test('weighted linear combination 3x3, 2 layers, w 0.7/0.3, layer B lower is better (hand computed)', () => {
  const sA = M.standardise(Float64Array.from(A), 1, 9, true), sB = M.standardise(Float64Array.from(B), 10, 90, false);
  const P = M.combine([sA, sB], [.7, .3]);
  near(P[0], .3, 1e-12); near(P[4], .5, 1e-12); near(P[8], .7, 1e-12); near(P[1], .7 * .125 + .3 * .875, 1e-12);
  for (const v of P) assert.ok(v >= 0 && v <= 1);
  const C = M.combine([sA, sB], [.7, .3]); C.forEach((v, i) => near(v, .7 * sA[i] + .3 * sB[i], 1e-15));
});
test('a cell null in any layer stays null (never 0), also for a zero weight', () => {
  const sA = M.standardise(Float64Array.from(A), 1, 9, true), b = Float64Array.from(B); b[4] = NaN; const sB = M.standardise(b, 10, 90, true);
  const P = M.combine([sA, sB], [1, 0]); assert.ok(Number.isNaN(P[4])); assert.equal(M.statsOf(P).nulls, 1); near(P[0], 0, 0);
});
test('weights: normalised, read from an AHP weights file by name (case, spaces), missing name is an error', () => {
  assert.deepEqual(M.normaliseWeights([2, 6]), [.25, .75]); assert.throws(() => M.normaliseWeights([0, 0]));
  const crit = [{ name: 'Oil', grp: '' }, { name: 'Depth', grp: '' }], f = JSON.parse(JSON.stringify(M.weightsFile(crit, { all: { '0,1': 3 } }, 'x')));
  const wt = M.weightsFromFile(f, ['depth', ' OIL ']); near(wt[0], .25, 1e-12); near(wt[1], .75, 1e-12);
  assert.throws(() => M.weightsFromFile(f, ['Oil', 'Gas']), /Gas/); assert.throws(() => M.weightsFromFile({ format: 'x' }, ['a']), /not an MCDA AHP/);
});
test('resampling: same geometry untouched; finer source reproduces a linear field exactly; nodes outside the source are null', () => {
  const ref = grid(3, 3, 1, 1, 0, 2, new Array(9).fill(0)); assert.ok(M.sameGeom(ref, ref));
  const f = (x, y) => 2 * x + 3 * y + 1, fine = grid(5, 5, .5, .5, 0, 2, Array.from({ length: 25 }, (_, k) => f((k % 5) * .5, 2 - Math.floor(k / 5) * .5)));
  assert.ok(!M.sameGeom(fine, ref)); const r = M.resample(fine, ref);
  for (let rr = 0; rr < 3; rr++) for (let c = 0; c < 3; c++) near(r.z[rr * 3 + c], f(c, 2 - rr), 1e-12);
  const shifted = grid(3, 3, 1, 1, .5, 2, Array.from({ length: 9 }, (_, k) => f(.5 + (k % 3), 2 - Math.floor(k / 3)))), s = M.resample(shifted, ref);
  assert.ok(Number.isNaN(s.z[0]) && Number.isNaN(s.z[3])); near(s.z[1], f(1, 2), 1e-12); near(s.info.overlap, 6 / 9, 1e-12);
  const far = grid(3, 3, 1, 1, 1.5, 2, new Array(9).fill(1)); assert.throws(() => M.resample(far, ref), /covers only/);
});
test('resampling: a null neighbour makes the node null, an exact node keeps its value', () => {
  const ref = grid(2, 2, 1, 1, 0, 1, [0, 0, 0, 0]), src = grid(3, 3, .5, .5, 0, 1, [1, 2, 3, 4, NaN, 6, 7, 8, 9]), r = M.resample(src, ref);
  near(r.z[0], 1, 1e-12); near(r.z[1], 3, 1e-12); near(r.z[2], 7, 1e-12); near(r.z[3], 9, 1e-12);
  const ref2 = grid(2, 2, .5, .5, .25, .75, [0, 0, 0, 0]), q = M.resample(src, ref2); assert.ok(q.z.every(Number.isNaN)); assert.equal(q.info.lost, 4);
});
test('sensitivity: perturbation renormalised, one-at-a-time, a dominant layer changes more', () => {
  near(M.perturbWeights([.5, .5], 0, 1.2).reduce((a, b) => a + b, 0), 1, 1e-12); near(M.perturbWeights([.5, .5], 0, 1.2)[0], .6 / 1.1, 1e-12);
  const sA = M.standardise(Float64Array.from(A), 1, 9, true), sB = M.standardise(Float64Array.from(B), 10, 90, false);
  const S = M.sensitivity([sA, sB], [.9, .1], { delta: .2, top: .34 }); assert.equal(S.rows.length, 4); assert.equal(S.valid, 9);
  const r0 = S.rows.find(r => r.i === 0 && r.factor > 1), r1 = S.rows.find(r => r.i === 1 && r.factor > 1);
  assert.ok(r0.meanAbs > 0 && r0.maxAbs >= r0.meanAbs); near(r0.weight, .9 * 1.2 / (.9 * 1.2 + .1), 1e-12);
  const d = M.deltaMap([sA, sB], [.5, .5], 0, 1.2); near(d[0], M.combine([sA, sB], M.perturbWeights([.5, .5], 0, 1.2))[0] - .5, 1e-12);
  const zero = M.sensitivity([sA, sB], [.5, .5], { delta: 0, top: .34 }); zero.rows.forEach(r => { near(r.maxAbs, 0, 1e-15); near(r.changedPct, 0, 0) });
});
test('contribution of each layer at a cell sums to the preference', () => {
  const sA = M.standardise(Float64Array.from(A), 1, 9, true), sB = M.standardise(Float64Array.from(B), 10, 90, false), P = M.combine([sA, sB], [.7, .3]);
  const c = M.contributions([sA, sB], [.7, .3], 1); near(c[0].c + c[1].c, P[1], 1e-12); near(c[0].c, .7 * .125, 1e-12);
});
test('readers: ZMAP+, ESRI and XYZ writers round-trip through parseGrid (orientation, null, geometry)', () => {
  const z = [.1, .2, NaN, .4, .5, .6, .7, NaN, .9], g = grid(3, 3, 10, 20, 100, 340, z);
  for (const [txt, fmt] of [[M.writeZmap(g, { label: 'T' }), 'ZMAP+'], [M.writeEsri(g), 'ESRI ASCII grid'], [M.writeXYZ(g), 'XYZ text']]) {
    const r = M.parseGrid(txt, 't', { nulls }); assert.equal(r.fmt, fmt);
    assert.equal(r.nx, 3); assert.equal(r.ny, 3); near(r.dx, 10, 1e-9); near(r.dy, 20, 1e-9); near(r.x0, 100, 1e-9); near(r.y1, 340, 1e-9);
    z.forEach((v, i) => { if (Number.isNaN(v)) assert.ok(Number.isNaN(r.z[i]), fmt + ' null ' + i); else near(r.z[i], v, 1e-9, fmt) });
  }
});
test('reader: Surfer ASCII (DSAA), file order is bottom row first', () => {
  const g = M.parseGrid('DSAA\n3 2\n0 2\n0 1\n1 6\n4 5 6\n1 2 1.70141e38\n', 's', { nulls });
  assert.equal(g.fmt, 'Surfer ASCII (DSAA)'); near(g.y1, 1, 0); assert.deepEqual([...g.z.slice(3, 6)], [4, 5, 6]); assert.deepEqual([...g.z.slice(0, 2)], [1, 2]); assert.ok(Number.isNaN(g.z[2])); assert.equal(g.info.nullNodes, 1);
});
test('null sentinels (contract C): -999 excluded and counted, -99999 only warned, native ESRI nodata kept null', () => {
  const g = M.parseGrid('ncols 3\nnrows 2\nxllcorner 0\nyllcorner 0\ncellsize 1\nNODATA_value -9999\n1 -999 3\n-99999 -99999 -99999\n'.replace('-99999 -99999 -99999', '-99999 -99999 -99999'), 'e', { nulls });
  assert.ok(Number.isNaN(g.z[1])); assert.equal(g.info.sentinel['-999'], 1); assert.equal(g.info.nullNodes, 1);
  assert.equal(g.z[3], -99999); assert.equal(g.info.candidates['-99999'], undefined); // 3 occurrences: below the warning threshold
  const rows = ['x y z']; for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) rows.push(`${c} ${r} ${r === 3 ? -99999 : c + r}`);
  const h = M.parseGrid(rows.join('\n'), 'x', { nulls }); assert.equal(h.info.candidates['-99999'], 6); assert.ok(/-99999 appears 6 times/.test(M.loadMessage(h)));
  const e = M.parseGrid(rows.join('\n'), 'x', { nulls: [...nulls, -99999] }); assert.equal(e.info.sentinel['-99999'], 6); assert.ok(Number.isNaN(e.z[0]));
});
test('XYZ CSV (contracts A and B): header, ; delimiter, decimal comma, missing and text rows counted with line numbers', () => {
  const t = 'X [m];Y [m];Depth\n0;0;1,5\n1;0;2,5\n0;1;n.d.\n1;1;abc\n0;2;4,5\n1;2;<0,1\nzz;2;1\n';
  const g = M.parseGrid(t, 'c', { nulls }); assert.equal(g.nx, 2); assert.equal(g.ny, 3); near(g.z[g.nx * 2 + 0], 1.5, 1e-12); near(g.z[g.nx * 2 + 1], 2.5, 1e-12);
  near(g.z[g.nx * 0 + 0], 4.5, 1e-12); assert.ok(Number.isNaN(g.z[1 * 2 + 0])); assert.equal(g.info.read, 7); assert.equal(g.info.skipped, 4);
  assert.equal(g.info.reasons['missing value'], 1); assert.equal(g.info.reasons['non-numeric value'], 1); assert.equal(g.info.reasons['below detection limit'], 1); assert.equal(g.info.reasons['non-numeric x or y'], 1);
  assert.deepEqual(g.info.first['non-numeric x or y'], [8]); assert.ok(/7 rows read, 4 skipped/.test(M.loadMessage(g)));
  assert.throws(() => M.parseGrid('1 2 3', 'z', { nulls }), /fewer than 4/); // a failed read throws: the page then clears the layer
});
test('XYZ with decimal point and comma delimiter, tab delimiter, 1,234 thousands vs decimal', () => {
  const g = M.parseGrid('x,y,v\n0,0,1.5\n1,0,2.5\n0,1,3.5\n1,1,4.5\n', 'd', { nulls }); assert.equal(g.nx, 2); near(g.z[0], 3.5, 1e-12); near(g.z[1], 4.5, 1e-12); near(g.z[3], 2.5, 1e-12);
  const t = M.parseGrid('0\t0\t1\n1\t0\t2\n0\t1\t3\n1\t1\t4\n', 't', { nulls }); assert.deepEqual([...t.z], [3, 4, 1, 2]);
  assert.equal(M.parseNumber('1,234').value, 1234); assert.equal(M.parseNumber('1,234', { decimalComma: true }).value, 1.234);
});
test('audit file: fields, null policy, JSON round trip', () => {
  const ref = grid(3, 3, 1, 1, 0, 2, A), a = M.auditFile({ ref, layers: [{ criterion: 'A', weight: .7, higherBetter: true, lo: 1, hi: 9, boundsMode: 'minmax' }], weightsSource: 'AHP', CR: NaN, computedBy: 'test' });
  const f = JSON.parse(JSON.stringify(a)); assert.equal(f.format, 'mcda-ahp-preference-map'); assert.equal(f.CR, null); assert.equal(f.referenceGeometry.xmax, 2); assert.equal(f.referenceGeometry.ymin, 0);
  assert.ok(/null in any layer/.test(f.nullPolicy)); assert.equal(f.layers[0].lo, 1);
});
console.log(`\n${n} tests passed`);
