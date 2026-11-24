// Self-check for the discrete-legend core of the discrete map digitizer (docs/discretemap/index.html, <script id="md-discrete-core">).
// Run: node scripts/mapdigitizer_discrete_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../docs/discretemap/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="md-discrete-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'md-discrete-core script block not found');
const ctx = { window: {} };
vm.runInNewContext(m[1], ctx);
const MDD = ctx.window.MDD;

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const arr = a => Array.from(a);

// ---------- colour matching ----------
const RED = MDD.lab(220, 30, 30), BLUE = MDD.lab(30, 60, 200), YEL = MDD.lab(240, 220, 60);
const LABS = [RED, BLUE, YEL];

test('lab: white is L=100, a=b=0; black is L=0', () => {
  const w = MDD.lab(255, 255, 255), k = MDD.lab(0, 0, 0);
  assert.ok(Math.abs(w[0] - 100) < 0.05 && Math.abs(w[1]) < 0.05 && Math.abs(w[2]) < 0.05, String(w));
  assert.ok(Math.abs(k[0]) < 1e-6, String(k));
});
test('nearest: a slightly darker red is nearest to the red class', () => {
  const r = MDD.nearest(MDD.lab(200, 35, 35), LABS);
  assert.equal(r.i, 0);
  assert.ok(r.d2 > 0 && r.d2 < 20 ** 2, String(r.d2));
});
test('match: within tolerance gives the class, beyond tolerance gives -1', () => {
  const near = MDD.lab(215, 32, 30), far = MDD.lab(130, 130, 130);
  assert.equal(MDD.match(near, LABS, 10 ** 2), 0);
  assert.equal(MDD.match(far, LABS, 10 ** 2), -1);
  assert.equal(MDD.match(MDD.lab(240, 220, 60), LABS, 1), 2);
});
test('match: the nearest class wins even when two are within tolerance', () => {
  const a = MDD.lab(100, 100, 100), b = MDD.lab(110, 110, 110);
  assert.equal(MDD.match(MDD.lab(108, 108, 108), [a, b], 40 ** 2), 1);
});

// ---------- majority vote ----------
test('vote: window 60 % class A / 40 % class B gives A (mode, not median)', () => {
  // 25-pixel window: 15 A, 10 B. Centre pixel nearest to B must not matter.
  assert.equal(MDD.vote([15, 10], 25, 8, [50, 1]), 0);
  assert.equal(MDD.vote([10, 0, 15], 25, 8, [1, 9, 50]), 2);
});
test('vote: tie goes to the class nearest to the centre pixel colour', () => {
  assert.equal(MDD.vote([10, 10], 20, 8, [30, 4]), 1);
  assert.equal(MDD.vote([10, 10], 20, 8, [4, 30]), 0);
  // the nearest class is not one of the tied ones: the closest tied one wins
  assert.equal(MDD.vote([8, 8, 2], 18, 8, [40, 20, 1]), 1);
});
test('vote: matching share below the minimum gives an empty node (-1)', () => {
  assert.equal(MDD.vote([5, 2], 7, 8, [1, 2]), -1);
  assert.equal(MDD.vote([0, 0], 0, 1, [1, 2]), -1);
  assert.equal(MDD.vote([8, 0], 8, 8, [1, 2]), 0);
});

// ---------- gap filling ----------
const E = -1;
test('fillGaps: an empty node with 5 of 8 neighbours agreeing is filled', () => {
  const g = [0, 0, 0,
             0, E, 1,
             1, 0, 1];   // neighbours: 0 x5, 1 x3
  const out = MDD.fillGaps(g, 3, 3);
  assert.equal(out[4], 0);
  assert.deepEqual(arr(out).filter((v, k) => k !== 4), g.filter((v, k) => k !== 4));
});
test('fillGaps: 4 agreeing neighbours are not enough', () => {
  const g = [0, 0, 1,
             0, E, 1,
             1, 0, 2];   // 0 x4, 1 x3, 2 x1
  assert.equal(MDD.fillGaps(g, 3, 3)[4], E);
  const h = [0, 0, E,
             0, E, 1,
             E, E, 1];   // 0 x3, 1 x2
  assert.equal(MDD.fillGaps(h, 3, 3)[4], E);
});
test('fillGaps: one pass only, from the original grid, input left untouched', () => {
  const g = [0, 0, 0, 0,
             0, E, E, 0,
             0, 0, 0, 0];  // each gap sees 7 neighbours of class 0 (other gap is empty)
  const out = MDD.fillGaps(g, 4, 3);
  assert.deepEqual(arr(out), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(g[5], E);
  // a gap surrounded only by gaps that get filled in the same pass stays empty
  const c = new Array(25).fill(0); [6, 7, 8, 11, 12, 13, 16, 17, 18].forEach(k => c[k] = E);
  const o2 = MDD.fillGaps(c, 5, 5);
  assert.equal(o2[12], E);
  assert.equal(o2[6], 0);  // corner gap: 5 class-0 neighbours
  assert.equal(o2[7], E);  // edge-middle gap: 3 class-0 neighbours
});
test('fillGaps: border node needs 5 agreeing among its available neighbours', () => {
  const g = [E, 1, 0,
             1, 1, 0];   // corner (0,0) has 3 neighbours only -> never 5
  assert.equal(MDD.fillGaps(g, 3, 2)[0], E);
  const h = [1, E, 1,
             1, 1, 1];   // top-middle: 5 neighbours, all class 1
  assert.equal(MDD.fillGaps(h, 3, 2)[1], 1);
});

// ---------- writers ----------
// grid: nx=3 columns, ny=2 rows; storage k = j*nx + i, j = 0 at ymin
const G = {
  name: 'facies', nx: 3, ny: 2, x0: 100, y0: 10, dx: 50, dy: 5,
  codes: [1, 2, null,     // y = 10 (ymin)
          3, null, 1],    // y = 15 (ymax)
  legend: [[1, 'Sand'], [2, 'Shale, silty'], [3, 'Carbonate']],
};
test('zmap: legend comments and exact header lines', () => {
  const L = MDD.zmap(G).split('\n');
  assert.deepEqual(L.slice(0, 3), ['! 1 = Sand', '! 2 = Shale, silty', '! 3 = Carbonate']);
  assert.deepEqual(L.slice(3, 8), ['@facies, GRID, 5', '15, 1E+30, , 0, 1', '2, 3, 100, 200, 10, 15', '0.0, 0.0, 0.0', '@']);
});
test('zmap: data column-major from the upper-left node, nulls 1E+30, width 15, column breaks', () => {
  const L = MDD.zmap(G).split('\n').filter(l => l !== '');
  const data = L.slice(8);
  // column x=100: ymax then ymin -> 3, 1 ; x=150: null, 2 ; x=200: 1, null
  assert.deepEqual(data, [
    '              3              1',
    '          1E+30              2',
    '              1          1E+30']);
  data.forEach(l => assert.equal(l.length % 15, 0));
});
test('zmap: 5 values per line, each column starts on a new line, value count = nrows*ncols', () => {
  const nx = 4, ny = 7, codes = Array.from({ length: nx * ny }, (_, k) => (k % 5 === 0 ? null : 1 + (k % 3)));
  const txt = MDD.zmap({ name: 'g', nx, ny, x0: 0, y0: 0, dx: 1, dy: 1, codes, legend: [[1, 'a'], [2, 'b'], [3, 'c']] });
  const L = txt.split('\n').filter(l => l !== '');
  const at = L.indexOf('@', 1), data = L.slice(at + 1);
  assert.equal(data.length, nx * 2);           // 7 values per column -> 5 + 2
  data.forEach((l, i) => assert.equal(l.length, 15 * (i % 2 === 0 ? 5 : 2)));
  const vals = data.flatMap(l => l.match(/.{15}/g).map(s => s.trim()));
  assert.equal(vals.length, nx * ny);
  // first column read top-down = j from ny-1 to 0 at i = 0
  const col0 = Array.from({ length: ny }, (_, r) => codes[(ny - 1 - r) * nx]);
  assert.deepEqual(vals.slice(0, ny), col0.map(v => v == null ? '1E+30' : String(v)));
  assert.equal(vals.filter(v => v === '1E+30').length, codes.filter(v => v == null).length);
});
test('zmap: a name with spaces or commas is sanitised in the @ line', () => {
  const L = MDD.zmap({ ...G, name: 'my map, v2' }).split('\n');
  assert.equal(L[3], '@my_map_v2, GRID, 5');
});
test('csv: x,y,code,class rows, empty nodes omitted, names quoted when needed', () => {
  const L = MDD.csv(G).split('\n');
  assert.deepEqual(L, [
    'x,y,code,class',
    '100,10,1,Sand',
    '150,10,2,"Shale, silty"',
    '100,15,3,Carbonate',
    '200,15,1,Sand']);
});
test('csv: tab separator for clipboard copy', () => {
  const L = MDD.csv(G, '\t').split('\n');
  assert.equal(L[0], 'x\ty\tcode\tclass');
  assert.equal(L[2], '150\t10\t2\tShale, silty');
});

// ---------- colour sampling & detection ----------
function img(w, h, f) { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = f(x, y), o = (y * w + x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; } return d; }
test('avg: mean colour of the window, clipped at the image edge', () => {
  const d = img(10, 10, (x) => (x < 5 ? [200, 0, 0] : [0, 0, 200]));
  assert.deepEqual(arr(MDD.avg(d, 10, 10, 2, 2, 2)), [200, 0, 0]);
  assert.deepEqual(arr(MDD.avg(d, 10, 10, 5, 5, 0)), [0, 0, 200]);
  assert.deepEqual(arr(MDD.avg(d, 10, 10, 0, 0, 1)), [200, 0, 0]);
});
test('detect: dominant colours of a 3-colour image, black lines ignored as minor', () => {
  const d = img(60, 40, (x, y) => (y === 20 ? [0, 0, 0] : x < 20 ? [230, 200, 80] : x < 45 ? [90, 160, 210] : [60, 90, 150]));
  const c = MDD.detect(d, 60, 40, { x0: 0, y0: 0, x1: 60, y1: 40 }, { minShare: 0.03 });
  assert.equal(c.length, 3, JSON.stringify(c));
  assert.deepEqual(arr(c[0].rgb), [90, 160, 210]);   // sorted by share
  assert.ok(c.every(k => k.share > 0.2));
});

// ---------- polygons ----------
const sArea = r => { let s = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
const raster = (nx, ny, f) => Int16Array.from({ length: nx * ny }, (_, k) => f(k % nx, Math.floor(k / nx)));
const ID = p => [p[0], p[1]];
const simple = r => new Set(r.map(p => p[0] + ',' + p[1])).size === r.length;
const close = (a, b, e = 1e-9) => Math.abs(a - b) <= e * Math.max(1, Math.abs(b));

test('pixLabels: samples the cell centre, -1 for unmatched colour, -2 outside the mask', () => {
  const d = img(6, 4, (x) => (x < 3 ? [200, 0, 0] : [0, 0, 200]));
  const m = (r, g, b) => (r > 100 ? 0 : b > 100 ? 1 : -1);
  const L = MDD.pixLabels(d, 6, 4, { x0: 1, y0: 0, nx: 5, ny: 2, step: 1 }, m, (x, y) => x < 5.5);
  assert.deepEqual(arr(L), [0, 0, 1, 1, -2, 0, 0, 1, 1, -2]);
  const L2 = MDD.pixLabels(d, 6, 4, { x0: 0, y0: 0, nx: 3, ny: 2, step: 2 }, m);   // cell (0,0) samples pixel (1,1), cell (1,0) pixel (3,1)
  assert.deepEqual(arr(L2), [0, 1, 1, 0, 1, 1]);
});
test('modeFilter: a 1-pixel unmatched line inside a class disappears, -2 is kept', () => {
  const L = raster(7, 7, (x, y) => (x === 3 ? -1 : x < 3 ? 0 : 1));
  L[0] = -2;
  const o = MDD.modeFilter(L, 7, 7, 1, 3, 2);
  assert.equal(o[0], -2);
  for (let y = 0; y < 7; y++) { assert.ok(o[y * 7 + 3] >= 0, 'line pixel filled'); assert.equal(o[y * 7 + 1], 0); assert.equal(o[y * 7 + 5], 1); }
});
test('fillHoles: iterates until an unmatched blob is filled from its neighbours; -2 is never filled', () => {
  const L = raster(9, 9, (x, y) => (x >= 2 && x <= 6 && y >= 2 && y <= 6 ? -1 : 0));
  L[80] = -2;
  const r = MDD.fillHoles(L, 9, 9, 10);
  assert.equal(r.left, 0);
  assert.ok(r.passes >= 3, String(r.passes));
  assert.ok(arr(r.L).slice(0, 80).every(v => v === 0));
  assert.equal(r.L[80], -2);
  assert.equal(L[40], -1, 'input untouched');
  const s = MDD.fillHoles(raster(9, 1, x => (x === 0 ? 0 : -1)), 9, 1, 3);   // max passes reached
  assert.equal(s.left, 5);
});
test('fillHoles: unmatched patches larger than maxSize (8-connected) stay unclassified', () => {
  // a 2-pixel label at (2,2)-(3,2) and a 4-column white margin on the right, joined diagonally to a 1-pixel speck at (5,6)
  const L = raster(10, 8, (x, y) => (x >= 6 || (y === 2 && (x === 2 || x === 3)) || (x === 5 && y === 6) ? -1 : 0));
  const r = MDD.fillHoles(L, 10, 8, 64, 6);
  assert.equal(r.L[2 * 10 + 2], 0); assert.equal(r.L[2 * 10 + 3], 0);
  assert.ok([...Array(8).keys()].every(y => [6, 7, 8, 9].every(x => r.L[y * 10 + x] === -1)), 'margin left empty');
  assert.equal(r.L[6 * 10 + 5], -1, 'speck touching the margin belongs to it');
  assert.equal(r.left, 33);
});

// class A (0) everywhere, class B (1) square of 2 x 2 inside
const AB = raster(6, 5, (x, y) => (x >= 2 && x <= 3 && y >= 1 && y <= 2 ? 1 : 0));
test('polygonize: A with a B square inside -> one A polygon with one hole + one B polygon', () => {
  const { polys } = MDD.polygonize(AB, 6, 5, { minArea: 0, tol: 0 });
  const A = polys.filter(p => p.label === 0), B = polys.filter(p => p.label === 1);
  assert.equal(A.length, 1); assert.equal(B.length, 1);
  assert.equal(A[0].holes.length, 1); assert.equal(B[0].holes.length, 0);
  assert.equal(B[0].outer.length, 4);
  [A[0].outer, A[0].holes[0], B[0].outer].forEach(r => assert.ok(simple(r)));
});
test('toMap: exact areas in pixel units and after an affine transform; exterior CCW, hole CW', () => {
  const { polys } = MDD.polygonize(AB, 6, 5, { minArea: 0, tol: 0 });
  const grp = [{ code: 7, name: 'A' }, { code: 9, name: 'B' }];
  const P = MDD.toMap(polys, ID, grp), A = P.find(p => p.code === 7), B = P.find(p => p.code === 9);
  assert.equal(A.area, 26); assert.equal(B.area, 4);
  assert.equal(A.name, 'A'); assert.equal(B.perimeter, 8); assert.equal(A.perimeter, 22 + 8);
  assert.ok(sArea(A.outer) > 0 && sArea(A.holes[0]) < 0 && sArea(B.outer) > 0);
  const f = p => [1000 + 2 * p[0] + 0.5 * p[1], 50 + 0.3 * p[0] - 1.5 * p[1]];   // det = -3.15 (flips y like a map)
  const Q = MDD.toMap(polys, f, grp), A2 = Q.find(p => p.code === 7), B2 = Q.find(p => p.code === 9);
  assert.ok(close(A2.area, 26 * 3.15)); assert.ok(close(B2.area, 4 * 3.15));
  assert.ok(sArea(A2.outer) > 0 && sArea(A2.holes[0]) < 0 && sArea(B2.outer) > 0);
});
test('polygonize: 4-connectivity, two B squares touching only at a corner are two polygons', () => {
  const L = raster(6, 6, (x, y) => ((x >= 1 && x <= 2 && y >= 1 && y <= 2) || (x >= 3 && x <= 4 && y >= 3 && y <= 4) ? 1 : 0));
  const P = MDD.toMap(MDD.polygonize(L, 6, 6, { minArea: 0, tol: 0 }).polys, ID, [{ code: 1 }, { code: 2 }]);
  const B = P.filter(p => p.code === 2), A = P.filter(p => p.code === 1);
  assert.equal(B.length, 2);
  B.forEach(p => { assert.equal(p.area, 4); assert.equal(p.holes.length, 0); assert.equal(p.outer.length, 4); });
  assert.equal(A.length, 1); assert.equal(A[0].holes.length, 2); assert.equal(A[0].area, 28);
  [A[0].outer, ...A[0].holes].forEach(r => assert.ok(simple(r), 'simple ring ' + JSON.stringify(r)));
});
test('polygonize: min-area merge removes a 1-pixel speck and leaves no hole', () => {
  const L = raster(5, 5, (x, y) => (x === 2 && y === 2 ? 1 : 0));
  const { polys } = MDD.polygonize(L, 5, 5, { minArea: 2, tol: 0 });
  assert.equal(polys.length, 1);
  assert.equal(polys[0].label, 0); assert.equal(polys[0].holes.length, 0);
  assert.equal(MDD.toMap(polys, ID, [{ code: 1 }])[0].area, 25);
  // an unmatched (-1) speck is merged too; a large one stays and makes a hole
  const U = raster(8, 8, (x, y) => (x === 1 && y === 1 ? -1 : x >= 4 && x <= 6 && y >= 4 && y <= 6 ? -1 : 0));
  const q = MDD.polygonize(U, 8, 8, { minArea: 4, tol: 0 }).polys;
  assert.equal(q.length, 1); assert.equal(q[0].holes.length, 1);
  assert.equal(MDD.toMap(q, ID, [{ code: 1 }])[0].area, 64 - 9);
});
test('dp: Douglas-Peucker on a known polyline', () => {
  const P = [[0, 0], [1, 0.5], [2, -0.6], [3, 0], [4, 3], [5, 0]];
  assert.deepEqual(MDD.dp(P, 1), [[0, 0], [3, 0], [4, 3], [5, 0]]);
  assert.deepEqual(MDD.dp(P, 0.4), P);
  assert.deepEqual(MDD.dp(P, 5), [[0, 0], [5, 0]]);
});
test('polygonize: shared-arc simplification leaves no gap nor overlap between neighbours', () => {
  // staircase boundary between A (left) and B (right), plus a B island in A
  const L = raster(40, 30, (x, y) => (x > 10 + Math.floor(y * 0.7) ? 1 : (x - 5) ** 2 + (y - 22) ** 2 < 9 ? 1 : 0));
  const raw = MDD.toMap(MDD.polygonize(L, 40, 30, { minArea: 0, tol: 0 }).polys, ID, [{ code: 1 }, { code: 2 }]);
  const { polys } = MDD.polygonize(L, 40, 30, { minArea: 0, tol: 1.5 });
  const P = MDD.toMap(polys, ID, [{ code: 1 }, { code: 2 }]);
  const nv = Q => Q.reduce((s, p) => s + p.outer.length + p.holes.reduce((t, h) => t + h.length, 0), 0);
  assert.ok(nv(P) < nv(raw) / 2, `simplified ${nv(P)} vs ${nv(raw)} vertices`);
  assert.ok(close(P.reduce((s, p) => s + p.area, 0), 1200), 'areas add up to the raster');
  const vs = new Set(), add = r => r.forEach(p => vs.add(p[0] + ',' + p[1]));
  P.filter(p => p.code === 1).forEach(p => { add(p.outer); p.holes.forEach(add); });
  P.filter(p => p.code === 2).forEach(p => p.outer.forEach(q => assert.ok(vs.has(q[0] + ',' + q[1]) || q[0] === 40 || q[1] === 0 || q[1] === 30, 'B vertex ' + q + ' shared with A')));
  const island = P.find(p => p.code === 2 && p.outer.every(q => q[0] < 12));
  assert.ok(island && island.outer.length >= 3);
});

test('polygonize: simplification keeps the raster corners (map rectangle exact)', () => {
  const L = raster(3, 6, (x, y) => (y >= 1 && (x === 0 || y >= 4) && !(x === 2 && y === 4) ? 0 : 1));
  const P = MDD.toMap(MDD.polygonize(L, 3, 6, { minArea: 0, tol: 1.5 }).polys, ID, [{ code: 1 }, { code: 2 }]);
  assert.ok(close(P.reduce((s, p) => s + p.area, 0), 18));
  const vs = P.flatMap(p => p.outer.map(q => q + ''));
  ['0,0', '3,0', '0,6', '3,6'].forEach(c => assert.ok(vs.includes(c), 'corner ' + c));
});

// writers: one polygon with one hole, map coordinates, already oriented
const PP = [{ code: 2, name: 'Lobe, sandy', outer: [[0, 0], [10, 0], [10, 5]], holes: [[[6, 1], [8, 1.5], [8, 1]]], area: 24.5, perimeter: 30 }];
test('irapLines: x y z per vertex, z = code, rings closed, 999 separator after each ring', () => {
  assert.equal(MDD.irapLines(PP), [
    '0.000000 0.000000 2.000000', '10.000000 0.000000 2.000000', '10.000000 5.000000 2.000000', '0.000000 0.000000 2.000000',
    '999.000000 999.000000 999.000000',
    '6.000000 1.000000 2.000000', '8.000000 1.500000 2.000000', '8.000000 1.000000 2.000000', '6.000000 1.000000 2.000000',
    '999.000000 999.000000 999.000000', ''].join('\n'));
});
test('geojson: FeatureCollection, closed rings, exterior CCW and holes CW whatever the input order', () => {
  const bad = [{ ...PP[0], outer: PP[0].outer.slice().reverse(), holes: [PP[0].holes[0].slice().reverse()] }];
  const J = JSON.parse(MDD.geojson(bad));
  assert.equal(J.type, 'FeatureCollection'); assert.equal(J.features.length, 1);
  const F = J.features[0];
  assert.equal(F.type, 'Feature'); assert.equal(F.geometry.type, 'Polygon');
  assert.deepEqual(F.properties, { code: 2, class: 'Lobe, sandy', area: 24.5, perimeter: 30 });
  const [ext, hole] = F.geometry.coordinates;
  assert.equal(F.geometry.coordinates.length, 2);
  [ext, hole].forEach(r => { assert.deepEqual(r[0], r[r.length - 1]); assert.equal(r.length, 4); });
  assert.ok(sArea(ext.slice(0, -1)) > 0, 'exterior CCW'); assert.ok(sArea(hole.slice(0, -1)) < 0, 'hole CW');
});
test('polyCsv: header, one row per vertex (ring not repeated), ring types, quoted names', () => {
  const L = MDD.polyCsv(PP).split('\n');
  assert.equal(L[0], 'polygon,ring,ring_type,code,class,vertex,x,y');
  assert.equal(L.length, 1 + 3 + 3);
  assert.equal(L[1], '1,1,outer,2,"Lobe, sandy",1,0,0');
  assert.equal(L[4], '1,2,hole,2,"Lobe, sandy",1,6,1');
  assert.equal(L[6], '1,2,hole,2,"Lobe, sandy",3,8,1');
});

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ', name); }
  catch (e) { fail++; console.log('FAIL ', name, '\n     ', e.message.split('\n').slice(0, 6).join('\n      ')); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
