// Self-check for the discrete-legend core of the map digitizer (docs/mapdigitizer/index.html, <script id="md-discrete-core">).
// Run: node scripts/mapdigitizer_discrete_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../docs/mapdigitizer/index.html', import.meta.url), 'utf8');
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

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ', name); }
  catch (e) { fail++; console.log('FAIL ', name, '\n     ', e.message.split('\n').slice(0, 6).join('\n      ')); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
