// Check of the pure logic of the Biomarkers page (docs/biomarkers/index.html, <script id="bm-core">, window.BM):
// ternary transform, point-in-ellipse / point-in-polygon classification, log-log line equations, and the field
// constants digitised from four figures of Ogbesejana et al. (2023), RSC Adv. 13, 25635-25659 (values read off images,
// precision about +/-1 % ternary, +/-0.01 TAS ratio, +/-0.02 decade). Transcription / self-consistency check only.
// Run: node scripts/biomarkers_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../docs/biomarkers/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="bm-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'bm-core script block not found');
const ctx = {};
vm.runInNewContext(m[1], ctx);
const BM = ctx.BM;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const tests = [];
const test = (n, f) => tests.push([n, f]);

// ---- ternary transform
test('ternary: vertices map to the corners of the unit triangle', () => {
  const v = [[[100, 0, 0], [0, 0]], [[0, 100, 0], [0.5, BM.SQ3 / 2]], [[0, 0, 100], [1, 0]]];
  for (const [abc, [x, y]] of v) { const q = BM.xy(...abc); near(q[0], x, 1e-12); near(q[1], y, 1e-12); }
});
test('ternary: centroid of the triangle is (1/2, sqrt3/6); inputs are normalised', () => {
  const q = BM.xy(1, 1, 1); near(q[0], 0.5, 1e-12); near(q[1], BM.SQ3 / 6, 1e-12);
  const r = BM.xy(20, 20, 20); near(r[0], q[0], 1e-12);
});
test('ternary: inverse transform round-trips random points', () => {
  for (let i = 0; i < 50; i++) { const a = Math.random(), b = Math.random() * (1 - a), c = 1 - a - b; const [x, y] = BM.xy(a, b, c), r = BM.bary(x, y); near(r[0], a, 1e-12); near(r[1], b, 1e-12); near(r[2], c, 1e-12); }
});
test('ternary: edge midpoints (a=c=50 -> bottom edge middle)', () => { const q = BM.xy(50, 0, 50); near(q[0], 0.5, 1e-12); near(q[1], 0, 1e-12); });

// ---- geometry
test('inPoly / inEllipse / centroid on simple shapes', () => {
  const sq = [[0, 0], [2, 0], [2, 2], [0, 2]];
  assert.ok(BM.inPoly(1, 1, sq)); assert.ok(!BM.inPoly(3, 1, sq));
  const c = BM.centroid(sq); near(c[0], 1, 1e-12); near(c[1], 1, 1e-12);
  const E = { cx: 1, cy: 1, a: 2, b: 1, rot: 90 };
  assert.ok(BM.inEllipse(1, 2.9, E)); assert.ok(!BM.inEllipse(2.9, 1, E));
});
test('ellipsePts lie on the ellipse', () => {
  const E = { cx: 0.3, cy: 0.5, a: 0.1, b: 0.2, rot: 30 };
  for (const [x, y] of BM.ellipsePts(E, 36)) { const th = Math.PI / 6, u = (x - E.cx) * Math.cos(th) + (y - E.cy) * Math.sin(th), v = -(x - E.cx) * Math.sin(th) + (y - E.cy) * Math.cos(th); near((u / E.a) ** 2 + (v / E.b) ** 2, 1, 1e-9); }
});

// ---- (a) TAS ellipses: extents agree with the pixel bounding boxes read in the image (x: 0.00 at px 152.5, 0.70 at 909.5; y: 0.00 at px 642, 1.00 at px 42)
const X = px => (px - 152.5) / 1081.43, Y = py => (642 - py) / 600;
test('TAS: ellipse extents match the outline bounding boxes of the image (+/-0.01)', () => {
  const bb = { A: [317, 601, 255, 406], B: [553, 783, 104, 303], C: [382, 543, 125, 245] };
  for (const E of BM.TAS.fields) { const [x0, x1, y0, y1] = bb[E.id]; near(E.cx - E.a, X(x0), 0.01, E.id + ' left'); near(E.cx + E.a, X(x1), 0.01, E.id + ' right'); near(E.cy + E.b, Y(y0), 0.01, E.id + ' top'); near(E.cy - E.b, Y(y1), 0.01, E.id + ' bottom'); }
});
test('TAS: centre of each field classifies into it and only it; outside points into none', () => {
  for (const E of BM.TAS.fields) { const c = BM.classTAS(E.cx, E.cy); assert.deepEqual(Array.from(c), [E.id]); }
  for (const l of BM.TAS.labels) assert.ok(BM.classTAS(l.x, l.y).includes(l.t), 'label ' + l.t);
  assert.deepEqual(Array.from(BM.classTAS(0.6, 0.1)), []);
});
test('TAS: the fields do not overlap', () => { const n = 200; for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) assert.ok(BM.classTAS(i / n * 0.7, j / n).length <= 1); });

// ---- (b) tricyclic terpane zones
test('TT: every vertex sums to 100 % and round-trips through the plane', () => {
  for (const z of BM.TT.zones) for (const p of z.pts) { near(p[0] + p[1] + p[2], 100, 0.11, `zone ${z.id} vertex ${p}`); const [x, y] = BM.xy(...p), r = BM.bary(x, y); p.forEach((v, i) => near(r[i] * 100, v * 100 / (p[0] + p[1] + p[2]), 1e-9)); }
});
test('TT: area centroid of each zone classifies into that zone', () => {
  for (const z of BM.TT.zones) { const [cx, cy] = BM.centroid(BM.zonePlane(z)), [a, b, c] = BM.bary(cx, cy); assert.ok(BM.classTT(a, b, c).includes(z.id), 'zone ' + z.id); }
});
test('TT: zone 1 / 2 / 3 / 4 sides are the constant-percentage lines read in the image', () => {
  const zs = Object.fromEntries(BM.TT.zones.map(z => [z.id, z.pts]));
  assert.ok(zs[2].filter(p => p[1] === 60.3).length === 2);            // top side of zone 2 at C21 = 60 %
  assert.ok(zs[4].every(p => p[1] === 30 || p[1] === 20.1));           // zone 4: C21 20-30 %
  assert.ok(zs[1].every(p => p[1] === 35.1 || p[1] === 15));           // zone 1: C21 15-35 %
  assert.ok(zs[3].filter(p => p[2] === 19.8).length === 2);            // zone 3 right side at C23 = 20 %
});
test('TT: points outside every zone, and a point of the overlap of zones 2 and 4', () => {
  assert.deepEqual(Array.from(BM.classTT(5, 5, 90)), []);
  assert.ok(BM.classTT(40, 28, 32).includes(2) && BM.classTT(40, 28, 32).includes(4));
});

// ---- (c) sterane ellipses (Fig. 13 of the review)
test('sterane: field centres classify into their group; triangle bounds; III has no boundary', () => {
  for (const E of BM.STER.fields) { const [a, b, c] = BM.bary(E.cx, E.cy); assert.ok(a > 0 && b > 0 && c > 0); assert.ok(BM.classSter(a, b, c).includes(E.grp), E.id); }
  const lab = Object.fromEntries(BM.STER.labels.map(l => [l.t, l]));
  const at = l => BM.classSter(...BM.bary(l.x, l.y));
  assert.deepEqual(Array.from(at(lab.III)), []);
  assert.ok(at(lab.IV).includes('IV')); assert.ok(at(lab.I).includes('I')); assert.ok(at(lab.II).includes('II'));
});
test('sterane: centre percentages read from the figure (C27/C28/C29, +/-1 %)', () => {
  const pct = id => BM.bary(BM.STER.fields.find(f => f.id === id).cx, BM.STER.fields.find(f => f.id === id).cy).map(v => v * 100);
  const exp = { II: [30.3, 41.8, 27.9], T: [17.2, 42.4, 40.4], I: [16.8, 21.9, 61.3] };
  for (const k in exp) pct(k).forEach((v, i) => near(v, exp[k][i], 1, k));
});
test('sterane: ellipses touch the triangle sides only where the figure shows it (no vertex outside)', () => {
  for (const E of BM.STER.fields) for (const [x, y] of BM.ellipsePts(E, 60)) { const [a, b, c] = BM.bary(x, y); assert.ok(a > -0.03 && b > -0.03 && c > -0.03, E.id); }
});

// ---- (d) Pr/n-C17 vs Ph/n-C18
const LX = px => -1 + (px - 310.5) / 294, LY = py => 2 - (py - 18.5) / 181.333;   // frame 0.1-10 x 0.1-100 : px 310.5-897.5, py 562.5-18.5
test('Pr/n-C17: line equations reproduce the end points and are ordered', () => {
  for (const L of BM.PRPH.lines) { for (let i = 0; i < 2; i++) near(BM.lineY(L, L.x[i]), L.y[i], 1e-9 * L.y[i]); }
  const x = 1; const ys = BM.PRPH.lines.map(L => BM.lineY(L, x)); for (let i = 1; i < ys.length; i++) assert.ok(ys[i] < ys[i - 1]);
});
test('Pr/n-C17: end points agree with the pixels read in the image (+/-0.03 decade)', () => {
  const px = [[[310, 322.8], [763, 18.6]], [[310, 444], [898, 95.7]], [[310, 540.1], [898, 190.9]], [[487, 561.1], [898, 320.8]]];
  BM.PRPH.lines.forEach((L, k) => px[k].forEach((p, i) => { near(Math.log10(L.x[i]), LX(p[0]), 0.03, 'x'); near(Math.log10(L.y[i]), LY(p[1]), 0.03, 'y'); }));
  // slopes (log-log) of the hand-drawn lines, read off the image: not exactly 1
  const k = BM.PRPH.lines.map(L => BM.lineEq(L).k); near(k[0], 1.09, 0.03); [1, 2, 3].forEach(i => near(k[i], 0.95, 0.03));
});
test('Pr/n-C17: the printed labels fall in the region they name', () => {
  const R = BM.PRPH.regions, f = t => BM.PRPH.labels.find(l => l.t === t), c = t => BM.classPrPh(f(t).x, f(t).y);
  assert.equal(R[c('Terrestrial (coals)')], 'terrestrial (coals)');
  assert.equal(R[c('Mixed organic matter')], 'mixed organic matter, transitional');
  assert.equal(R[c('Algal marine')], 'algal marine, reducing');
  assert.equal(R[c('Biodegradation')], 'biodegradation');
  assert.equal(R[c('Maturation')], 'above the upper line');
  assert.equal(BM.classPrPh(0, 1), -1);
});
test('Pr/n-C17: arrows keep the directions of the figure (maturation to lower left, oxidizing up-left, reducing down-right)', () => {
  const A = Object.fromEntries(BM.PRPH.arrows.map(a => [a.id, a]));
  assert.ok(A.maturation.x[1] < A.maturation.x[0] && A.maturation.y[1] < A.maturation.y[0]);
  assert.ok(A.oxidizing.x[1] < A.oxidizing.x[0] && A.oxidizing.y[1] > A.oxidizing.y[0]);
  assert.ok(A.reducing.x[1] > A.reducing.x[0] && A.reducing.y[1] < A.reducing.y[0]);
});

// ---- review fixes (26 Nov 2026): decoding, column mapping, domain of Rc, mixed units, failed load
const PN = (t, o) => BM.parseNumber(t, o);
test("parseNumber: plain, thousands, European, decimal comma, exponent, unicode minus", () => {
  const ok = [["1234.5", 1234.5], ["1,234.5", 1234.5], ["1 234.5", 1234.5], ["1.234,5", 1234.5], ["1 234,5", 1234.5], ["1,5", 1.5], ["0,55", 0.55], ["1e-3", 1e-3], ["1E+30", 1e30], ["−3.5", -3.5], ["+2", 2], ["1,234,567", 1234567]];
  for (const [t, v] of ok) { const r = PN(t); assert.equal(r.kind, "ok", t); near(r.value, v, 1e-9 * Math.max(1, Math.abs(v)), t); }
});
test("parseNumber: missing, below detection, text", () => {
  for (const t of ["", "-", "n.d.", "nd", "NA", "NaN", "null"]) assert.equal(PN(t).kind, "missing", t);
  const b = PN("<0,1"); assert.equal(b.kind, "below"); assert.equal(b.value, null); near(b.limit, 0.1, 1e-12);
  assert.equal(PN("<0.1").kind, "below"); assert.equal(PN("abc").kind, "text"); assert.equal(PN("1.2.3").kind, "text");
});
test("parseNumber: 1,234 is thousands by default, decimal only when the file uses a decimal comma", () => {
  assert.equal(PN("1,234").value, 1234); assert.ok(PN("1,234").ambiguous);
  assert.equal(PN("1,234", { decimalComma: true }).value, 1.234);
  assert.equal(BM.detectDecimalComma(["1,234", "0,55"]), true); assert.equal(BM.detectDecimalComma(["1,234", "2,500"]), false);
});
test("detectDelimiter: never splits 100 0,55 on the comma; semicolon, tab, comma files", () => {
  assert.equal(BM.detectDelimiter(["Depth Value", "100 0,55", "200 0,60", "300 0,65"]), " ");
  assert.equal(BM.detectDelimiter(["a;b;c", "1;2,5;3", "4;5,5;6"]), ";");
  assert.equal(BM.detectDelimiter(["a\tb\tc", "1\t2\t3"]), "\t");
  assert.equal(BM.detectDelimiter(["a,b,c", "1,2.5,3", "4,5.5,6"]), ",");
  const t = BM.parseTable("Sample Depth Pr Ph\nA 100 0,55 1,2\nB 200 0,60 1,3\nC 300 0,65 1,4", 2); assert.equal(t.nc, 4); assert.equal(t.rows[0][2], "0,55");
});
const mapOf = (heads) => { const spec = [["pc27", BM.RE.pc27], ["pc28", BM.RE.pc28], ["pc29", BM.RE.pc29], ["p_st27", BM.RE.st27], ["p_st28", BM.RE.st28], ["p_st29", BM.RE.st29], ["p_st29s", BM.RE.st29s], ["p_st29bbr", BM.RE.st29bbr], ["p_st29bbs", BM.RE.st29bbs]]; return BM.detectMap(heads, spec); };
test("columns: %C27 %C28 %C29 and C27 C28 C29 map to the sterane percentages, not to nothing", () => {
  for (const H of [["%C27", "%C28", "%C29"], ["C27", "C28", "C29"], ["C27 sterane", "C28 sterane", "C29 sterane"]]) {
    const m = mapOf(H); assert.deepEqual([m.pc27, m.pc28, m.pc29], [0, 1, 2], H.join());
  }
});
test("columns: St27/St28/St29 and 20R / aaa / area forms are peaks; C29 20S, C29 aaa 20S, beta-beta forms are distinct", () => {
  let m = mapOf(["St27", "St28", "St29"]); assert.deepEqual([m.p_st27, m.p_st28, m.p_st29], [0, 1, 2]);
  m = mapOf(["C27 aaa 20R", "C28 aaa 20R", "C29 aaa 20R"]); assert.deepEqual([m.p_st27, m.p_st28, m.p_st29], [0, 1, 2]);
  m = mapOf(["C27 20R area", "C28 20R area", "C29 20R area", "C29 20S", "C29 αββ 20R", "C29 αββ 20S"]);
  assert.deepEqual([m.p_st27, m.p_st28, m.p_st29, m.p_st29s, m.p_st29bbr, m.p_st29bbs], [0, 1, 2, 3, 4, 5]);
  m = mapOf(["C29 aaa 20S", "C29 aaa 20R"]); assert.deepEqual([m.p_st29s, m.p_st29], [0, 1]);
});
test("Rc: value only inside the calibrated domain (Ro 0.65-1.35), forced on request", () => {
  assert.ok(Number.isNaN(BM.rc(0.15))); assert.ok(Number.isNaN(BM.rc(5.45)));
  near(BM.rc(0.15, true), 0.49, 1e-12); near(BM.rc(5.45, true), 3.67, 1e-12); near(BM.rc(1, false), 1.0, 1e-12);
  near(BM.rc(BM.RC.lo), 0.65, 1e-12); near(BM.rc(BM.RC.hi), 1.35, 1e-12);
});
test("mixed units: each row summing to 0.9-1.1 is converted to percent, percent rows are left", () => {
  const a = BM.normPct([0.3, 0.2, 0.5]); assert.ok(a.scaled); near(a.vals[0], 30, 1e-9); near(a.vals[2], 50, 1e-9);
  const b = BM.normPct([30, 20, 50]); assert.ok(!b.scaled); assert.deepEqual(b.vals, [30, 20, 50]);
  assert.ok(!BM.normPct([0.3, NaN, 0.5]).scaled);
});
test("failed load clears the previous dataset (contract B)", () => {
  const good = BM.tryLoad("Sample\tPr\tPh\nA\t1\t2\nB\t3\t4"); assert.ok(good.table && !good.err);
  for (const bad of ["", "Sample\tPr\tPh", "single"]) { const r = BM.tryLoad(bad); assert.ok(r.err, bad); assert.equal(r.table, null); }
});
test("sentinels: null list parsing and matching", () => {
  const L = BM.parseNulls("-999, -999.25, 1e30"); assert.equal(L.length, 3);
  assert.ok(BM.isNull(-999.25, L)); assert.ok(BM.isNull(1e30, L)); assert.ok(!BM.isNull(-998, L)); assert.equal(BM.parseNulls("").length, 0);
});

let fail = 0;
for (const [n, f] of tests) { try { f(); console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } }
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
