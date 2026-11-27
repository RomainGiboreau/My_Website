// Regression tests of the Compaction fit page (docs/compaction/index.html, <script id="compaction-core">): number decoding and delimiter
// (contract A), counted skipped rows, percent hint, Athy exact recovery, decompaction against a closed form, linear floor, failed load (contract B).
// Run: node scripts/compaction_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../docs/compaction/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="compaction-core">([\s\S]*?)<\/script>/); assert.ok(m, 'compaction-core not found');
const ctx = {};
vm.runInNewContext(m[1] + '\nthis.OUT={parseNumber,detectDelimiter,parseTable,readPoints,MODELS,fitModel,modelPhi,decompact,solidFn,guess};', ctx);
const C = ctx.OUT;
const tests = []; const test = (n, f) => tests.push([n, f]);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const pn = (s, o) => { const r = C.parseNumber(s, o); return r.kind === 'ok' ? r.value : r.kind; };
const read = (text, opt) => { const t = C.parseTable(text, 2); assert.ok(!t.err, t.err); const [z, p, g] = C.guess(t.head); return { t, R: C.readPoints(t, z, p, g, Object.assign({ zk: 1, pu: 'auto' }, opt)) }; };

test('parseNumber: thousands, European, decimal comma, exponent, missing, below', () => {
  assert.equal(pn('1,234.5'), 1234.5); assert.equal(pn('1.234,5'), 1234.5); assert.equal(pn('0,55'), 0.55); assert.equal(pn('1e-3'), 0.001);
  assert.equal(pn('1,234'), 1234); assert.equal(pn('1,234', { decimalComma: true }), 1.234);
  assert.equal(pn('n.d.'), 'missing'); assert.equal(pn('<5'), 'below'); assert.equal(pn('abc'), 'text');
});
test('"100 0,55" (space delimited, decimal comma, no header) is depth 100 and porosity 0.55, not split on the comma', () => {
  assert.equal(C.detectDelimiter(['100 0,55', '200 0,50', '300 0,42']), ' ');
  const { t, R } = read('100 0,55\n200 0,50\n300 0,42\n400 0,35');
  assert.equal(t.nc, 2); assert.equal(t.head[0], 'col 1');
  assert.equal(R.pts.length, 4); assert.equal(R.pts[0].z, 100); near(R.pts[0].phi, 0.55, 1e-12); assert.equal(R.pu, 1);
});
test('decimal comma with a header and ; or tab delimiters, csv with points', () => {
  assert.equal(read('Depth;Porosity\n100;0,55\n200;0,5\n300;0,4').R.pts[2].phi, 0.4);
  assert.equal(read('Depth (m)\tPorosity\n100\t0,55\n200\t0,5\n300\t0,4').R.pts[1].phi, 0.5);
  const r = read('depth,por\n100,0.55\n200,0.5\n300,0.4').R; assert.equal(r.pts.length, 3); assert.equal(r.pts[0].z, 100);
});
test('dropped rows are counted with the reason and the first row numbers', () => {
  const { R } = read('Depth\tPorosity\n100\t0.5\n-50\t0.4\n200\tabc\n300\t<5\n400\tn.d.\n500\t0.3\n600\t0.25\n800\t0.2');
  assert.equal(R.nRead, 8); assert.equal(R.pts.length, 4); assert.equal(R.skipped, 4);
  const by = Object.fromEntries(R.reasons.map(r => [r.label, r])); const labels = R.reasons.map(r => r.label).join('|');
  assert.ok(by['negative depth'] && by['negative depth'].first[0] === 2, labels);
  assert.ok(by['porosity is not a number'] && by['porosity is not a number'].first[0] === 3, labels);
  assert.ok(by['porosity below detection (<)'] && by['porosity missing'], labels);
});
test('percent hint: header with % is read as percent even when the maximum is <= 1.5; values >= 1 suggest percent otherwise', () => {
  const a = read('Depth (m)\tPorosity (%)\n100\t1.2\n200\t0.9\n300\t0.7\n400\t0.5\n500\t0.4').R;
  assert.equal(a.pu, 100); assert.equal(a.pts.length, 5); near(a.pts[0].phi, 0.012, 1e-12);
  const b = read('Depth\tPhi\n100\t1.2\n200\t1.1\n300\t0.9\n400\t0.8\n500\t0.7').R;     // no unit in the name: fraction, 2 rejected, hint
  assert.equal(b.pu, 1); assert.equal(b.pts.length, 3); assert.equal(b.suggestPercent, true);
  assert.equal(read('Depth\tPhi\n100\t0.5\n200\t0.4\n300\t0.3').R.suggestPercent, false);
});
test('ambiguous 1,234 is flagged once in the read result', () => {
  const R = read('Depth\tPorosity\n1,234\t0.5\n2,000\t0.4\n3,000\t0.3').R; assert.equal(R.ambiguous, 3); assert.equal(R.pts[0].z, 1234);
});
test('exhumation: burial depth = present depth + uplift, units to km', () => {
  const R = read('Depth\tPorosity\n100\t0.5\n200\t0.4\n300\t0.3', { zk: 0.001, uplift: 0.5 }).R; near(R.pts[0].zk, 0.6, 1e-12); assert.equal(R.pts[0].z, 100);
});
const ENV = { rhos: 2650, rhow: 1000 };
test('Athy: exact recovery of phi0 = 0.6, c = 0.5 on exact data (both unweighted and ln residuals)', () => {
  const z = Array.from({ length: 30 }, (_, i) => 0.1 + i * 0.15), y = z.map(v => 0.6 * Math.exp(-0.5 * v));
  for (const ln of [false, true]) { const r = C.fitModel(C.MODELS[0], z, y, ln, ENV); near(r.p[0], 0.6, 1e-6, 'phi0'); near(r.p[1], 0.5, 1e-6, 'c'); }
});
test('decompaction 1000-1500 m, phi0 0.6457, c 0.5023: solid 327.23 m, base 715.18 m (closed form recomputed here)', () => {
  const p0 = 0.6457, c = 0.5023, S = z => z - p0 / c * (1 - Math.exp(-c * z));          // km, integral of (1 - phi)
  const sol = S(1.5) - S(1.0); near(sol * 1000, 327.23, 0.01, 'closed form solid');
  let lo = 0, hi = 5; for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (S(mid) < sol) lo = mid; else hi = mid; }
  near(lo * 1000, 715.18, 0.01, 'closed form base');
  const R = C.decompact({ M: C.MODELS[0], r: { p: [p0, c] } }, 1.0, 1.5, 0, ENV);
  near(R.sol * 1000, 327.23, 0.1, 'page solid'); near(R.z2n * 1000, 715.18, 0.1, 'page base');
});
test('decompaction input check', () => { assert.ok(C.decompact({ M: C.MODELS[0], r: { p: [0.6, 0.5] } }, 1.5, 1.0, 0, ENV).err); });
test('linear model: the 0.001 floor is reported when it is hit inside the data', () => {
  const z = Array.from({ length: 25 }, (_, i) => 0.2 + i * 0.2), y = z.map(v => 0.6 * Math.exp(-1.2 * v) + 0.005);
  const r = C.fitModel(C.MODELS[3], z, y, false, ENV); assert.equal(r.floorHit, true); assert.ok(r.floorKm < 5);
  const zz = [0.1, 0.5, 1, 1.5], yy = zz.map(v => 0.6 - 0.2 * v); assert.equal(C.fitModel(C.MODELS[3], zz, yy, false, ENV).floorHit, false);
});
test('page: failed load clears the previous data (contract B); resNote, exhumation field present', () => {
  assert.match(html, /function clearAll/); assert.match(html, /id="resNote"/); assert.match(html, /id="up"/); assert.match(html, /lower bounds<\/b>/);
});

let fail = 0;
for (const [n, f] of tests) { try { f(); console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } }
console.log(fail ? `${fail} failure(s)` : `all ${tests.length} tests passed`);
process.exit(fail ? 1 : 0);
