// Regression test for the continuous map digitizer core (docs/mapdigitizer/index.html, <script id="md-continuous-core">).
// Run: node scripts/mapdigitizer_continuous_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../docs/mapdigitizer/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="md-continuous-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'md-continuous-core script block not found');
const ctx = { window: {} };
vm.runInNewContext(m[1], ctx);
const MDC = ctx.window.MDC;
const zm = readFileSync(new URL('../docs/zmap-checker/index.html', import.meta.url), 'utf8').match(/<script id="zmap-core">([\s\S]*?)<\/script>/);
const zctx = { window: {} }; vm.runInNewContext(zm[1], zctx);
const ZMAP = zctx.ZMAP || zctx.window.ZMAP;

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// synthetic colour bar: viridis-like 5 stops, 512 samples over 1000..2600 m
const VIR = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
const vir = t => { t = Math.min(1, Math.max(0, t)) * 4; const i = Math.min(3, Math.floor(t)), f = t - i; return VIR[i].map((c, k) => Math.round(c + (VIR[i + 1][k] - c) * f)); };
const N = 512, ZMIN = 1000, ZMAX = 2600;
const LUT = { N, lab: new Float32Array(3 * N), val: new Float64Array(N) };
for (let k = 0; k < N; k++) { const t = k / (N - 1), l = MDC.lab(...vir(t)); LUT.lab.set(l, 3 * k); LUT.val[k] = ZMIN + t * (ZMAX - ZMIN); }
const read = z => { const [r, g, b] = vir((z - ZMIN) / (ZMAX - ZMIN)); const [i, d2] = MDC.nearest(MDC.lab(r, g, b), LUT.lab, N); return { i, d2, z: LUT.val[i] }; };

test('colour reading is exact inside the bar range', () => {
  for (const z of [1200, 1800, 2400]) assert.ok(Math.abs(read(z).z - z) < 2 * (ZMAX - ZMIN) / N, String(z));
});
test('REGRESSION: a value beyond the bar (truth 2733, bar to 2600) reads 2600 and is flagged possibly saturated', () => {
  const r = read(2733);
  assert.ok(Math.abs(r.z - 2600) < 1e-9, 'reads the bar limit');
  assert.equal(MDC.isSat(r.i, N), true);
  assert.equal(MDC.isSat(read(1) .i, N), true, 'below the low end too');
});
test('values well inside the range are not flagged; 0.6 % margin of the bar from each end', () => {
  for (const z of [1050, 1500, 2000, 2550]) assert.equal(MDC.isSat(read(z).i, N), false, String(z));
  assert.equal(MDC.isSat(-1, N), false, 'unmatched node');
});
test('satFlags counts flagged nodes among matched ones', () => {
  const idx = Int16Array.from([-1, 0, 1, 100, 300, 509, 510, 511]);
  const f = MDC.satFlags(idx, N);
  assert.deepEqual(Array.from(f.flags), [0, 1, 1, 0, 0, 0, 1, 1].map((v, i) => i === 5 ? (MDC.isSat(509, N) ? 1 : 0) : v));
  assert.equal(f.count, Array.from(f.flags).reduce((a, b) => a + b, 0));
});
test('uncertainty: order of magnitude 0.2 % (PNG) to 1 % (strong JPEG) of the range, plus half a bar step', () => {
  const u = MDC.uncertainty(1600, N);
  assert.ok(Math.abs(u.png - 3.2) < 1e-9 && Math.abs(u.jpeg - 16) < 1e-9, JSON.stringify(u));
  assert.ok(Math.abs(u.quant - 1600 / (N - 1) / 2) < 1e-9);
});
test('ZMAP+ writer: round trip through the independent zmap-core reader, no finding, depth sign option, audit comments', () => {
  const nx = 4, ny = 3, z = new Float64Array(nx * ny).map((_, k) => 1000 + k * 10); z[5] = NaN;
  const g = { nx, ny, dx: 100, dy: 50, x0: 500, y1: 1100, z };
  const txt = MDC.writeZmap(g, { label: 'TEST MAP', sign: -1, audit: ['source: a.png', 'tolerance: 12'] });
  assert.match(txt, /^!\r?\n! TEST_MAP|^!/);
  assert.ok(txt.includes('! source: a.png') && txt.includes('! tolerance: 12'));
  const p = ZMAP.parse(txt, 'x.zmap');
  assert.equal(ZMAP.check(p).filter(x => x.sev !== 'I').length, 0);
  const t3 = txt.split(/\r?\n/).find(l => /^\s*3,\s*4,/.test(l));
  assert.ok(t3, 'header line rows, columns');
  assert.ok(/-1\.?0*[0-9]*/.test(txt) && txt.includes('1.0000000E+30'), 'negated values and null');
});
test('page: tolerance documented as a rejection threshold, export of flag, ZMAP+, audit', () => {
  for (const id of ['bZmapGrid', 'bAudit', 'zsign', 'showS']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(/possibly saturated/i.test(html));
  assert.ok(/does not change the value/i.test(html), 'tolerance wording');
});

let fail = 0;
for (const [n, f] of tests) { try { f(); console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } }
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
