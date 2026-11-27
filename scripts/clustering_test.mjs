// Self-check for the core of docs/clustering/index.html (<script id="clu-core">).
// Run: node scripts/clustering_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../docs/clustering/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="clu-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'clu-core script block not found');
const ctx = { window: {} };
vm.runInNewContext(m[1], ctx);
const C = ctx.window.CLU;

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (tol ${tol})`);

// adjusted Rand index (Hubert & Arabie 1985)
function ari(a, b) {
  const n = a.length, tab = new Map(), ra = new Map(), rb = new Map();
  for (let i = 0; i < n; i++) {
    const k = a[i] + '|' + b[i];
    tab.set(k, (tab.get(k) || 0) + 1); ra.set(a[i], (ra.get(a[i]) || 0) + 1); rb.set(b[i], (rb.get(b[i]) || 0) + 1);
  }
  const c2 = (x) => x * (x - 1) / 2;
  let s = 0, sa = 0, sb = 0;
  for (const v of tab.values()) s += c2(v);
  for (const v of ra.values()) sa += c2(v);
  for (const v of rb.values()) sb += c2(v);
  const e = sa * sb / c2(n), mx = (sa + sb) / 2;
  return mx === e ? 1 : (s - e) / (mx - e);
}
const blobs = (centres, per, sd, seed) => {
  const r = C.rng(seed), X = [], truth = [];
  centres.forEach((c, k) => { for (let i = 0; i < per; i++) { X.push(Float64Array.from(c.map(v => v + sd * (r() - 0.5) * 2))); truth.push(k); } });
  return { X, truth };
};

test('k-means on well separated blobs: ARI 1', () => {
  const { X, truth } = blobs([[0, 0], [10, 0], [0, 10]], 40, 0.8, 3);
  const b = C.kmeans(X, 3, C.rng(5), 10);
  close(ari(truth, Array.from(b.lab)), 1, 1e-12, 'ARI');
});

test('silhouette of [0,1,10,11] point 0 = 0.9048 (hand: a=1, b=10.5)', () => {
  const X = [0, 1, 10, 11].map(v => Float64Array.from([v]));
  const S = C.silhouette(X, Int32Array.from([0, 0, 1, 1]));
  close(S.s[0], (10.5 - 1) / 10.5, 1e-12, 's0');
  close(+S.s[0].toFixed(4), 0.9048, 1e-12, 's0 rounded');
});

test('hierarchical linkages recover the blobs', () => {
  const { X, truth } = blobs([[0, 0], [10, 0], [0, 10]], 25, 0.8, 4);
  for (const link of ['ward', 'single', 'average', 'complete']) {
    const M = C.hclust(X, link);
    close(ari(truth, Array.from(C.hcut(M, X.length, 3))), 1, 1e-12, link);
  }
});

test('DBSCAN: components and noise', () => {
  const { X, truth } = blobs([[0, 0], [10, 0]], 30, 0.6, 8);
  X.push(Float64Array.from([5, 12]), Float64Array.from([-6, 9])); truth.push(-1, -1);
  const lab = Array.from(C.dbscan(X, 1.0, 4));
  assert.equal(new Set(lab.filter(c => c >= 0)).size, 2);
  assert.equal(lab[60], -1); assert.equal(lab[61], -1);
  close(ari(truth.slice(0, 60), lab.slice(0, 60)), 1, 1e-12, 'ARI blobs');
});

test('Gaussian mixture recovers the blobs', () => {
  const { X, truth } = blobs([[0, 0], [10, 0], [0, 10]], 30, 0.8, 6);
  const g = C.gmm(X, 3, 'full', C.rng(2));
  close(ari(truth, Array.from(g.lab)), 1, 1e-12, 'ARI');
});

test('null values (contract C): list parsing, matching, candidates', () => {
  const list = C.parseNulls(C.DEFAULT_NULLS);
  assert.equal(JSON.stringify(list.slice(0, 4)), '[-999,-999.25,-9999,9999]');
  assert.ok(C.isNull(-999, list) && C.isNull(-999.25, list) && C.isNull(1e30, list) && C.isNull(1.70141e38, list));
  assert.ok(!C.isNull(-998, list) && !C.isNull(0, list));
  assert.equal(C.parseNulls('').length, 0);
  const c = C.candidateNulls([1, 2, -99999, -99999, -99999, -99999, 5, 99999], list);
  assert.equal(JSON.stringify(c), '[{"value":-99999,"count":4}]');
  assert.equal(C.candidateNulls([-999, -999, -999], list).length, 0);   // already a null value: no warning
});

test('parseNumber: formats and kinds', () => {
  const v = (s, o) => C.parseNumber(s, o);
  const ok = (s, x, o) => { const p = v(s, o); assert.equal(p.kind, 'ok', s); close(p.value, x, 1e-12, s); };
  ok('1234.5', 1234.5); ok('1,234.5', 1234.5); ok('1 234.5', 1234.5); ok('1.234,5', 1234.5); ok('1 234,5', 1234.5);
  ok('0,55', 0.55); ok('1,5', 1.5); ok('1e-3', 0.001); ok('1E+30', 1e30); ok('−2.5', -2.5); ok('+3', 3);
  ok('1,234', 1234); ok('1,234', 1.234, { decimalComma: true }); ok('0,123', 0.123);
  for (const s of ['', '-', 'n.d.', 'nd', 'NA', 'NaN', 'null']) assert.equal(v(s).kind, 'missing', s);
  assert.equal(JSON.stringify(v('<0,1')), '{"value":null,"kind":"below","limit":0.1}');
  assert.equal(v('<5').kind, 'below');
  assert.equal(v('abc').kind, 'text');
});

test('delimiter: never split "100 0,55" on the comma', () => {
  assert.equal(C.detectDelimiter(['100 0,55', '200 0,60', '300 0,48']), ' ');
  assert.equal(C.detectDelimiter(['a,b,c', '1.5,2.5,3', '4,5,6']), ',');
  assert.equal(C.detectDelimiter(['a;b', '1,5;2,5']), ';');
  assert.equal(C.detectDelimiter(['a\tb', '1,5\t2']), '\t');
  assert.equal(C.detectDelimiter(['x, y', '1.5, 2.5', '3, 4']), ',');
  const info = C.tableCommaInfo([['1,234', '2'], ['5,5', '3']], ' ');
  assert.ok(info.decimalComma && info.ambiguous === 1);
  assert.ok(!C.tableCommaInfo([['1,234', '2']], ' ').decimalComma);
});

test('skip report: counts, reasons, first rows, null values', () => {
  const R = { missing: [2], text: [4, 9], below: [], nul: [1, 3, 5], log: [] };
  const s = C.describeSkips(10, R, { '-999': 4 }, [{ value: -99999, count: 3 }], 4);
  assert.ok(s.startsWith('10 rows read, 6 skipped'), s);
  assert.ok(s.includes('2 non-numeric (rows 4, 9)') && s.includes('3 with a null value (rows 1, 3, 5)'), s);
  assert.ok(s.includes('4 values equal to the null value -999 were excluded'), s);
  assert.ok(s.includes('-99999 appears 3 times'), s);
});

test('k-distance and suggested eps on blobs plus sparse noise', () => {
  const { X } = blobs([[0, 0], [10, 0], [0, 10]], 40, 0.8, 11);
  const r = C.rng(99);
  for (let i = 0; i < 12; i++) X.push(Float64Array.from([-5 + 20 * r(), -5 + 20 * r()]));
  const kd = C.kdist(X, 5);
  assert.equal(kd.length, X.length);
  for (let i = 1; i < kd.length; i++) assert.ok(kd[i] >= kd[i - 1]);
  const eps = C.suggestEps(kd);
  assert.ok(eps > 0.2 && eps < 3, 'eps ' + eps);
  const lab = Array.from(C.dbscan(X, eps, 5));
  assert.equal(new Set(lab.filter(c => c >= 0)).size, 3, 'three components');
  assert.ok(lab.filter(c => c < 0).length <= 30, 'noise ' + lab.filter(c => c < 0).length);
  // a too small eps puts most points in noise (what the page now warns about)
  assert.ok(Array.from(C.dbscan(X, 0.05, 5)).filter(c => c < 0).length > X.length * 0.8);
  assert.equal(C.suggestEps([1, 1, 1]), null);
});

let bad = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ' + name); } catch (e) { bad++; console.log('FAIL ' + name + '\n     ' + e.message); }
}
console.log(bad ? `${bad} failed` : `${tests.length} passed`);
process.exit(bad ? 1 : 0);
