// Regression tests of the Source rock potential page (docs/source/index.html, <script id="src-core">): thickness column guess,
// number decoding (contract A), delimiter detection, null sentinels (contract C), skipped-row counts, thickness checks.
// Run: node scripts/source_test.mjs   (the class-limit tests are in scripts/rockeval_test.mjs)
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../docs/source/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="src-core">([\s\S]*?)<\/script>/); assert.ok(m, 'src-core not found');
const ctx = {};
vm.runInNewContext(m[1] + '\nthis.OUT={parseNumber,detectDelimiter,guessThickness,parseNullList,readSource,NULLS_DEF};', ctx);
const S = ctx.OUT;
const tests = []; const test = (n, f) => tests.push([n, f]);
const pn = (s, o) => { const r = S.parseNumber(s, o); return r.kind === 'ok' ? r.value : r.kind; };

test('thickness guess: HI is never a thickness (Rock-Eval file without thickness column)', () => {
  const head = ['Depth (m)', 'TOC (wt%)', 'S1', 'S2', 'S3', 'Tmax', 'HI', 'OI', 'PI'];
  assert.equal(S.guessThickness(head, [0]), -1);
  assert.equal(S.guessThickness(['Depth', 'HI', 'OI', 'PI'], [0]), -1);
});
test('thickness guess: real thickness names still found', () => {
  for (const [h, i] of [[['Depth', 'Thickness (m)', 'TOC'], 1], [['Depth', 'h (m)', 'TOC'], 1], [['Depth', 'H', 'TOC'], 1], [['Depth', 'h_m', 'TOC'], 1], [['Depth', 'Epaisseur', 'TOC'], 1], [['Depth', 'thick', 'TOC'], 1]])
    assert.equal(S.guessThickness(h, [0]), i, h.join('|'));
});
test('parseNumber: plain, thousands, European, decimal comma, exponent, unicode minus', () => {
  assert.equal(pn('1234.5'), 1234.5); assert.equal(pn('1,234.5'), 1234.5); assert.equal(pn('1 234.5'), 1234.5);
  assert.equal(pn('1.234,5'), 1234.5); assert.equal(pn('1 234,5'), 1234.5); assert.equal(pn('1,5'), 1.5); assert.equal(pn('0,55'), 0.55);
  assert.equal(pn('1e-3'), 0.001); assert.equal(pn('1E+30'), 1e30); assert.equal(pn('\u22125.5'), -5.5); assert.equal(pn('+3'), 3);
});
test('parseNumber: ambiguous 1,234 is thousands unless the table uses a decimal comma', () => {
  assert.equal(pn('1,234'), 1234); assert.equal(pn('1,234', { decimalComma: true }), 1.234);
  assert.equal(S.parseNumber('1,234').ambiguous, true);
});
test('parseNumber: missing, below detection, text', () => {
  for (const s of ['', '-', 'n.d.', 'nd', 'NA', 'NaN', 'null']) assert.equal(pn(s), 'missing', s);
  const b = S.parseNumber('<0,1'); assert.equal(b.kind, 'below'); assert.equal(b.value, null); assert.equal(b.limit, 0.1);
  assert.equal(S.parseNumber('<0.1').kind, 'below'); assert.equal(pn('abc'), 'text'); assert.equal(pn('12abc'), 'text');
});
test('detectDelimiter: never splits "100 0,55" on the comma; csv and tab still work', () => {
  assert.equal(S.detectDelimiter(['Depth TOC S2', '2000 1,6 5,5', '2020 0,55 2,1'], 3), ' ');
  assert.equal(S.detectDelimiter(['Depth,TOC,S2', '2000,1.6,5.5'], 3), ',');
  assert.equal(S.detectDelimiter(['a\tb\tc', '1,5\t2\t3'], 3), '\t');
  assert.equal(S.detectDelimiter(['a;b;c', '1,5;2;3'], 3), ';');
});
const tbl = (head, rows) => ({ head, rows, nc: head.length, sep: '\t' });
const cols = (o) => [o.z ?? -1, o.toc ?? -1, o.s1 ?? -1, o.s2 ?? -1, o.s3 ?? -1, o.tm ?? -1, o.h ?? -1, o.g ?? -1];
test('readSource: decimal comma table is read, not turned into NaN', () => {
  const t = tbl(['Depth', 'TOC', 'S1', 'S2'], [['2000', '1,6', '0,5', '5,5'], ['2020', '0,55', '0,2', '2,1']]);
  const R = S.readSource(t, cols({ z: 0, toc: 1, s1: 2, s2: 3 }), S.NULLS_DEF, {});
  assert.equal(R.rows.length, 2); assert.equal(R.rows[0].toc, 1.6); assert.equal(R.rows[1].s2, 2.1);
});
test('readSource: text, below-detection and sentinel values are counted with row numbers, not silent', () => {
  const t = tbl(['TOC', 'S1', 'S2'], [['1', '<0.1', '5'], ['2', 'n.d.', '6'], ['-999.25', '1', '7'], ['3', '1', 'abc'], ['4', '1', '8'], ['2', '-999', '4']]);
  const R = S.readSource(t, cols({ toc: 0, s1: 1, s2: 2 }), S.NULLS_DEF, {});
  assert.equal(R.rows.length, 4); assert.equal(R.skipped, 2);
  assert.equal(R.below.n, 1); assert.equal(R.sentinel.n, 2); assert.equal(R.text.n, 1);
  assert.ok(R.sentinel.items.some(x => x.value === -999)); assert.equal(R.sentinel.first[0], 3);
  assert.ok(R.reasons.length >= 1);
});
test('readSource: candidate sentinel not in the list gives a warning, not an exclusion', () => {
  const rows = []; for (let i = 0; i < 5; i++) rows.push(['2', '-99999', '5']); rows.push(['2', '1', '5']);
  const R = S.readSource(tbl(['TOC', 'S1', 'S2'], rows), cols({ toc: 0, s1: 1, s2: 2 }), S.NULLS_DEF, {});
  assert.equal(R.rows.length, 6); assert.equal(R.rows[0].s1, -99999); assert.equal(JSON.stringify(R.candidates.map(c => c.value)), '[-99999]'); assert.equal(R.candidates[0].n, 5);
});
test('readSource: missing thickness is counted; thickness outside 0.01..1000 m is counted', () => {
  const t = tbl(['TOC', 'S2', 'h'], [['1', '5', '10'], ['1', '5', ''], ['1', '5', '2000'], ['1', '5', '0.001']]);
  const R = S.readSource(t, cols({ toc: 0, s2: 1, h: 2 }), S.NULLS_DEF, {});
  assert.equal(R.hMissing, 1); assert.equal(R.hOut, 2);
});
test('parseNullList: default list and emptied list', () => {
  assert.equal(S.parseNullList('-999, -999.25; 1e30').length, 3); assert.equal(S.parseNullList('').length, 0);
});
test('page: failed load clears the previous results (contract B), resources title carries the note', () => {
  assert.match(html, /function clearAll/); assert.match(html, /not volume in place/);
});

let fail = 0;
for (const [n, f] of tests) { try { f(); console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } }
console.log(fail ? `${fail} failure(s)` : `all ${tests.length} tests passed`);
process.exit(fail ? 1 : 0);
