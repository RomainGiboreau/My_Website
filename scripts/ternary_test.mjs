// Self-check for the ternary diagram core (docs/ternary/index.html, <script id="tern-core">).
// Run: node scripts/ternary_test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../docs/ternary/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="tern-core">([\s\S]*?)<\/script>/); assert.ok(m, 'tern-core block not found');
const w = {}; new Function('window', m[1])(w); const T = w.TERN;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok   ' + name); };
const load = (text, zero) => { const t = T.parseTable(text, 3); assert.ok(!t.err, t.err); const g = T.guessCols(t.head); return { t, g, r: T.buildRows(t, g, { zero: !!zero }) } };

test('coordinates: (50,30,20) -> (0.45, 0.4330) and (20,30,50) -> (0.6, 0.1732)', () => {
  const [x, y] = T.xy(50, 30, 20); near(x, 0.45, 1e-12); near(y, 0.4330127, 1e-6);
  const [x2, y2] = T.xy(20, 30, 50); near(x2, 0.6, 1e-12); near(y2, 0.1732051, 1e-6);
});
test('closure: rows sum to 100 whatever the input scale', () => {
  const { r } = load('A\tB\tC\n0.5\t0.3\t0.2\n5\t3\t2\n50\t30\t20');
  for (const row of r.rows) { near(row.p.reduce((a, b) => a + b, 0), 100, 1e-9); near(row.p[0], 50, 1e-9) }
});
test('Aitchison centre of (50,30,20) and (20,30,50) = 33.913 / 32.173 / 33.913; arithmetic mean 35/30/35', () => {
  const { r } = load('A\tB\tC\n50\t30\t20\n20\t30\t50'); const s = T.groupStats(r.rows, r.groups)[0];
  near(s.gm[0], 33.913, 1e-3); near(s.gm[1], 32.173, 1e-3); near(s.gm[2], 33.913, 1e-3); near(s.am[0], 35, 1e-9); near(s.am[1], 30, 1e-9);
});
test('a zero part in the group suppresses the geometric centre (null), not a bogus value', () => {
  const { r } = load('A\tB\tC\n50\t50\t0\n20\t30\t50'); assert.equal(T.groupStats(r.rows, r.groups)[0].gm, null);
});
test('column guess: "Age" is not apex A (columns Age, Sample, Q, F, L)', () => {
  const g = T.guessCols(['Age', 'Sample', 'Q', 'F', 'L']); assert.deepEqual([g.a, g.b, g.c], [2, 3, 4]); assert.deepEqual(g.guessed.slice(0, 3), [false, false, false]);
  const g2 = T.guessCols(['Sample', 'Age', 'Sand (%)', 'Silt (%)', 'Clay (%)', 'Facies']); assert.deepEqual([g2.a, g2.b, g2.c, g2.g], [2, 3, 4, 5]);
  const g3 = T.guessCols(['Quartz_wt%', 'Feldspar_wt%', 'Lithics_wt%']); assert.deepEqual([g3.a, g3.b, g3.c], [0, 1, 2]);
});
test('column guess: no recognised names -> positional fallback flagged as guessed (so the page can say so)', () => {
  const g = T.guessCols(['x', 'y', 'z']); assert.deepEqual([g.a, g.b, g.c], [0, 1, 2]); assert.ok(g.guessed[0] && g.guessed[1] && g.guessed[2]);
});
test('missing / n.d. / <1 rows are dropped and counted by reason with line numbers (default)', () => {
  const { r } = load('Q\tF\tL\n50\t30\t20\n\t30\t20\nn.d.\t30\t20\n<1\t30\t70\nabc\t1\t1\n10\t20\t70');
  assert.equal(r.rows.length, 2); assert.equal(r.skipped, 4); assert.equal(r.read, 6);
  assert.equal(r.reasons['missing'].count, 2); assert.equal(r.reasons['below detection'].count, 1); assert.equal(r.reasons['non-numeric'].count, 1);
  assert.deepEqual(r.reasons['missing'].lines, [3, 4]);
});
test('option "treat missing/below detection as 0": rows kept with zeros, count shown, zero suppresses geometric centre', () => {
  const { r } = load('Q\tF\tL\n50\t30\t20\n\t30\t70\nn.d.\t30\t70\n<1\t30\t70', true);
  assert.equal(r.rows.length, 4); assert.equal(r.zeroed.missing, 2); assert.equal(r.zeroed.below, 1); assert.deepEqual(r.rows[1].p, [0, 30, 70]);
  assert.equal(T.groupStats(r.rows, r.groups)[0].gm, null);
});
test('negative values and all-zero rows are skipped with a reason', () => {
  const { r } = load('A\tB\tC\n-5\t30\t20\n0\t0\t0\n10\t20\t70'); assert.equal(r.rows.length, 1); assert.equal(r.reasons['negative'].count, 1); assert.equal(r.reasons['zero sum'].count, 1);
});
test('numbers: decimal comma, thousands, unicode minus, exponent, below detection', () => {
  const v = (s, o) => T.parseNumber(s, o);
  assert.equal(v('1,5').value, 1.5); assert.equal(v('0,55').value, 0.55); assert.equal(v('1.234,5').value, 1234.5); assert.equal(v('1 234,5').value, 1234.5);
  assert.equal(v('1,234.5').value, 1234.5); assert.equal(v('1 234.5').value, 1234.5); assert.equal(v('1e-3').value, 0.001); assert.equal(v('−5').value, -5); assert.equal(v('+7').value, 7);
  assert.equal(v('1,234').value, 1234); assert.equal(v('1,234', { decComma: true }).value, 1.234);
  for (const s of ['', '-', 'n.d.', 'nd', 'NA', 'NaN', 'null']) assert.equal(v(s).kind, 'missing', s);
  assert.equal(v('<0,1').kind, 'below'); assert.equal(v('<0,1').value, null); assert.equal(v('<0.1').limit, 0.1); assert.equal(v('abc').kind, 'text');
});
test('decimal-comma table (whitespace separated) is not split on the comma', () => {
  const { t, r } = load('Q F L\n60,5 30,2 9,3\n20,1 30,4 49,5'); assert.equal(t.nc, 3); assert.equal(r.rows.length, 2); near(r.rows[0].v[0], 60.5, 1e-12); near(r.rows[1].v[2], 49.5, 1e-12);
});
test('decimal-comma table with ";" delimiter, and ambiguous 1,234 read as decimal there', () => {
  const { t, r } = load('Q;F;L\n60,5;30,2;9,3\n1,234;30;40'); assert.equal(t.sep, ';'); near(r.rows[1].v[0], 1.234, 1e-12);
});
test('plain comma CSV with decimal points still works; ambiguity 1,234 reported once as thousands', () => {
  const a = load('Q,F,L,Group\n60.5,30.2,9.3,x\n20.1,30.4,49.5,y'); assert.equal(a.t.sep, ','); assert.equal(a.r.rows.length, 2); assert.equal(a.r.groups.length, 2);
  const b = load('Q\tF\tL\n1,234\t30\t40\n50\t30\t20'); assert.equal(b.t.ambig, 1); near(b.r.rows[0].v[0], 1234, 1e-9);
});
test('header optional: headerless table gives "col n" names and positional guess', () => {
  const { t, g } = load('50\t30\t20\n20\t30\t50'); assert.deepEqual(t.head, ['col 1', 'col 2', 'col 3']); assert.deepEqual([g.a, g.b, g.c], [0, 1, 2]);
});
test('failed load: too few columns / empty input return an error (page clears the previous dataset)', () => {
  assert.ok(T.parseTable('a\tb\n1\t2', 3).err); assert.ok(T.parseTable('   \n', 3).err);
});
console.log(`${n} tests passed`);
