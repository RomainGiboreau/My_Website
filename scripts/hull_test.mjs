// Regression test of the pure logic of Convex & concave hulls (docs/hull/index.html, <script id="hull-core">, var HC).
// Run: node scripts/hull_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../docs/hull/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="hull-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'hull-core script block not found');
const ctx = {};
vm.runInNewContext(m[1], ctx);
const H = ctx.HC;
const tests = [];
const test = (n, f) => tests.push([n, f]);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg || ''} ${a} vs ${b}`);
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

function randPts(n, seed, sc = 100, off = [0, 0]) { const r = H.rng(seed); return Array.from({ length: n }, () => [off[0] + sc * r(), off[1] + sc * r()]); }
// gift wrapping (Jarvis march), independent of the monotone chain
function giftWrap(P) {
  let s = 0; for (let i = 1; i < P.length; i++) if (P[i][0] < P[s][0] || (P[i][0] === P[s][0] && P[i][1] < P[s][1])) s = i;
  const hull = []; let p = s;
  do { hull.push(P[p]); let q = (p + 1) % P.length; for (let i = 0; i < P.length; i++) { const c = cross(P[p], P[q], P[i]); if (c < 0 || (c === 0 && Math.hypot(P[i][0] - P[p][0], P[i][1] - P[p][1]) > Math.hypot(P[q][0] - P[p][0], P[q][1] - P[p][1]))) q = i; } p = q; } while (p !== s && hull.length <= P.length);
  return hull;
}
test('convex hull area equals gift wrapping on random sets (also projected-size coordinates)', () => {
  for (let k = 0; k < 40; k++) {
    const P = randPts(5 + (k * 7) % 120, 100 + k, k % 2 ? 1 : 5000, k % 3 ? [0, 0] : [500000, 4200000]);
    near(H.ringArea(H.convexHull(P)), H.ringArea(giftWrap(P)), 1e-9, 'case ' + k);
  }
});

// brute-force Delaunay: every triple whose circumcircle holds no other point (generic positions)
function bruteTriangles(P) {
  const n = P.length, T = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    const A = P[i], B = P[j], C = P[k], d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
    if (Math.abs(d) < 1e-12) continue;
    const a2 = A[0] ** 2 + A[1] ** 2, b2 = B[0] ** 2 + B[1] ** 2, c2 = C[0] ** 2 + C[1] ** 2;
    const cx = (a2 * (B[1] - C[1]) + b2 * (C[1] - A[1]) + c2 * (A[1] - B[1])) / d, cy = (a2 * (C[0] - B[0]) + b2 * (A[0] - C[0]) + c2 * (B[0] - A[0])) / d, r2 = (A[0] - cx) ** 2 + (A[1] - cy) ** 2;
    let ok = true; for (let q = 0; q < n && ok; q++) if (q !== i && q !== j && q !== k && (P[q][0] - cx) ** 2 + (P[q][1] - cy) ** 2 < r2 * (1 - 1e-9)) ok = false;
    if (ok) T.push({ r: Math.sqrt(r2), a: Math.abs(cross(A, B, C)) / 2 });
  }
  return T;
}
test('alpha shape area equals brute-force Delaunay on 45 points for 100/80/60/40 %', () => {
  for (const seed of [3, 4, 5]) {
    const P = randPts(45, seed, 100);
    const T = bruteTriangles(P).sort((a, b) => a.r - b.r);
    for (const pct of [100, 80, 60, 40]) {
      const q = Math.min(T.length - 1, Math.max(0, Math.ceil(pct / 100 * T.length) - 1)), R = T[q].r * (1 + 1e-9);
      const want = T.filter(t => t.r <= R).reduce((s, t) => s + t.a, 0);
      const h = H.hullOf(P, pct, false), got = h.ccv.reduce((s, r) => s + H.ringArea(r), 0);
      near(got, want, 1e-7, `seed ${seed} ${pct}%`);
      if (pct === 100) near(got, H.ringArea(H.convexHull(P)), 1e-9, '100% = convex hull');
    }
  }
});

test('radius rule: explicit R keeps the triangles with circumradius <= R (same as the matching share)', () => {
  const P = randPts(45, 7, 100), T = bruteTriangles(P).sort((a, b) => a.r - b.r), R = T[Math.floor(T.length * .6)].r * 1.0000001;
  const want = T.filter(t => t.r <= R).reduce((s, t) => s + t.a, 0);
  const h = H.hullOf(P, 90, false, { radius: R });
  near(h.ccv.reduce((s, r) => s + H.ringArea(r), 0), want, 1e-7);
  near(h.R, R, 1e-12);
});
test('minimum area drops small islands only', () => {
  // two clusters far apart: big square cloud + 4-point tiny island
  const r = H.rng(5), P = [];
  for (let i = 0; i < 60; i++) P.push([100 * r(), 100 * r()]);
  P.push([300, 300], [301, 300], [300, 301], [301.2, 301.3]);
  const R = 15, a = H.hullOf(P, 100, false, { radius: R }), b = H.hullOf(P, 100, false, { radius: R, minArea: 5 });
  const ext = h => h.ccv.filter(q => H.ringArea(q) > 0).length;
  assert.equal(ext(a), 2); assert.equal(ext(b), 1); assert.equal(b.dropped, 1);
  const A = h => h.ccv.reduce((s, q) => s + H.ringArea(q), 0);
  assert.ok(A(b) < A(a)); assert.ok(A(a) - A(b) < 3);
});

test('parseNumber: separators, decimal comma, missing, below detection, exponent, unicode minus', () => {
  const v = (s, o) => H.parseNumber(s, o);
  assert.equal(v('1234.5').value, 1234.5); assert.equal(v('1,234.5').value, 1234.5); assert.equal(v('1 234.5').value, 1234.5);
  assert.equal(v('1.234,5').value, 1234.5); assert.equal(v('1 234,5').value, 1234.5); assert.equal(v('1,5').value, 1.5); assert.equal(v('0,55').value, 0.55);
  assert.equal(v('1e-3').value, 0.001); assert.equal(v('1E+30').value, 1e30); assert.equal(v('−5.5').value, -5.5); assert.equal(v('+7').value, 7);
  for (const s of ['', '-', 'n.d.', 'nd', 'NA', 'NaN', 'null']) assert.equal(v(s).kind, 'missing', s);
  assert.equal(v('<0.1').kind, 'below'); assert.equal(v('<0,1').limit, 0.1); assert.equal(v('abc').kind, 'text');
  // ambiguity "1,234": thousands unless the file uses a decimal comma
  assert.equal(v('1,234').value, 1234); assert.equal(v('1,234').ambiguous, true);
  assert.equal(v('1,234', { decimalComma: true }).value, 1.234);
});
test('detectDelimiter never splits "100 0,55" on the comma; comma files and ; files still work', () => {
  assert.equal(H.detectDelimiter(['x y', '100 0,55', '101 0,60', '102 0,70']), 'ws');
  assert.equal(H.detectDelimiter(['x;y', '100;0,55', '101;0,6']), ';');
  assert.equal(H.detectDelimiter(['x,y', '12.5,40.1', '13.5,41.2']), ',');
  assert.equal(H.detectDelimiter(['x\ty', '1\t2']), '\t');
  const t = H.parseTable('X Y\n100 0,55\n101 0,60\n102 0,70\n103 0,9', 2);
  assert.equal(t.rows.length, 4); assert.equal(t.rows[0][1], '0,55');
});
test('decimal-comma coordinates are read as such (semicolon file) and the ambiguity is reported once', () => {
  const t = H.parseTable('X;Y\n1,5;2,5\n3,25;1,234\n4,5;5,5\n', 2), b = H.buildGroups(t, 0, 1, -1, []);
  assert.equal(b.npts, 3); assert.equal(JSON.stringify(b.groups[0].P[1]), '[3.25,1.234]');
  const t2 = H.parseTable('X,Y\n"1,234",5\n"2,345",6\n"3,456",7', 2), b2 = H.buildGroups(t2, 0, 1, -1, []);
  assert.equal(JSON.stringify(b2.groups[0].P[0]), '[1234,5]'); assert.equal(b2.ambiguous, 3);
  assert.ok(H.loadWarnings(b2).some(w => /1,234/.test(w)));
});
test('load message counts rows and skip reasons with line numbers', () => {
  const t = H.parseTable('X Y\n1 2\n3 4\nfoo 5\n6 -\n7 <0.1\n8 9\n9 3', 2), b = H.buildGroups(t, 0, 1, -1, []);
  assert.equal(b.read, 7); assert.equal(b.skipped, 3); assert.equal(b.sk.text, 1); assert.equal(b.sk.missing, 1); assert.equal(b.sk.below, 1);
  assert.equal(JSON.stringify(b.first.text), '[4]');
  const msg = H.loadMessage(b); assert.ok(/7 rows read, 3 skipped/.test(msg) && /non-numeric/.test(msg) && /missing/.test(msg) && /below detection/.test(msg), msg);
});
test('null values (-999 ...) are excluded and counted; candidate sentinels only warn', () => {
  const rows = ['X Y']; for (let i = 0; i < 6; i++) rows.push(`${i * 10} ${i * 7 % 5 + i}`);
  rows.push('-999 4', '12 -999.25', '-99999 3', '-99999 8', '-99999 9', '1e30 1');
  const nulls = H.parseNulls(H.DEFAULT_NULLS);
  assert.ok(nulls.includes(-999) && nulls.includes(1.70141e38) && nulls.length === 6);
  const t = H.parseTable(rows.join('\n'), 2), b = H.buildGroups(t, 0, 1, -1, nulls);
  assert.equal(b.sk.sentinel, 3); assert.equal(b.npts, 6 + 3);           // -99999 rows are NOT excluded
  assert.ok(H.loadMessage(b).includes('null value -999'));
  assert.equal(JSON.stringify(b.cands), '[{"v":-99999,"n":3}]'); assert.ok(H.loadWarnings(b)[0].includes('-99999 appears 3 times'));
  const b0 = H.buildGroups(t, 0, 1, -1, H.parseNulls(''));               // emptied list: nothing excluded
  assert.equal(b0.sk.sentinel, 0);
});
test('unitInfo: degrees detected for lon/lat, projected stays m, explicit choice wins', () => {
  const geo = [[1, 1], [2, 1], [2, 2], [1, 2]], proj = [[500000, 4200000], [500100, 4200000], [500100, 4200200]];
  const g = H.unitInfo('auto', geo); assert.equal(g.area, 'deg²'); assert.ok(g.warnDeg);
  const p = H.unitInfo('auto', proj); assert.equal(p.area, 'm²'); assert.ok(!p.warnDeg);
  assert.equal(H.unitInfo('ft', geo).area, 'ft²'); assert.equal(H.unitInfo('km', proj).area, 'km²');
  near(H.ringArea(H.convexHull(geo)), 1, 1e-12);
});
test('fragmentation: 3000 random points at 70 % of triangles give many polygons (the page reports it)', () => {
  const h = H.hullOf(randPts(3000, 11, 1000), 70, false), np = h.ccv.filter(q => H.ringArea(q) > 0).length;
  assert.ok(np > 5, 'polygons: ' + np);
});

let fail = 0;
for (const [n, f] of tests) { try { f(); console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + (e.message || e)); } }
console.log(fail ? `${fail} failed` : 'all passed'); process.exit(fail ? 1 : 0);
