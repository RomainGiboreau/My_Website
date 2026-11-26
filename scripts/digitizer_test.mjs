// Regression test of the pure image logic of the Plot digitizer (docs/digitizer/index.html, <script id="dg-core">, var DGC).
// Synthetic charts are drawn into RGBA typed arrays (anti-aliased by 4x4 supersampling, optional JPEG-like noise and chroma
// subsampling) and run through the same pipeline as the page: pick colour -> colour mask -> connected part -> curve tracker -> checks.
// Run: node scripts/digitizer_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../docs/digitizer/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="dg-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'dg-core script block not found');
const ctx = {};
vm.runInNewContext(m[1], ctx);
const DGC = ctx.DGC;
const tests = [];
const test = (n, f) => tests.push([n, f]);

// ---------- synthetic images ----------
const W = 400, H = 300;
function blank(bg = [255, 255, 255]) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { d[i * 4] = bg[0]; d[i * 4 + 1] = bg[1]; d[i * 4 + 2] = bg[2]; d[i * 4 + 3] = 255; }
  return d;
}
function blend(d, x, y, col, a) { const o = (y * W + x) * 4; for (let k = 0; k < 3; k++) d[o + k] = d[o + k] * (1 - a) + col[k] * a; }
// anti-aliased curve y=f(x) of the given width (distance measured perpendicular to the curve)
function drawFn(d, f, width, col, x0 = 20, x1 = 380) {
  for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) {
    let c = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const X = x + (sx + .5) / 4, Y = y + (sy + .5) / 4, s = (f(X + .01) - f(X - .01)) / .02;
      if (Math.abs(Y - f(X)) / Math.sqrt(1 + s * s) <= width / 2) c++;
    }
    if (c) blend(d, x, y, col, c / 16);
  }
}
function drawGrid(d, col = [200, 200, 200]) {
  for (let g = 50; g < 400; g += 50) for (let y = 20; y < 280; y++) blend(d, g, y, col, 1);
  for (let g = 50; g < 300; g += 50) for (let x = 20; x < 380; x++) blend(d, x, g, col, 1);
}
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
// JPEG-like damage: 2x2 chroma averaging + noise
function jpegLike(d, sigma = 7) {
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const idx = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]].map(([a, b]) => (b * W + a) * 4);
    const Y = idx.map(o => .299 * d[o] + .587 * d[o + 1] + .114 * d[o + 2]);
    let cb = 0, cr = 0;
    idx.forEach((o, k) => { cb += (d[o + 2] - Y[k]) / 4; cr += (d[o] - Y[k]) / 4; });
    idx.forEach((o, k) => { const r = Y[k] + cr, b = Y[k] + cb, g = (Y[k] - .299 * r - .114 * b) / .587; d[o] = r; d[o + 1] = g; d[o + 2] = b; });
  }
  for (let i = 0; i < W * H * 4; i++) if (i % 4 !== 3) d[i] += gauss() * sigma;
}
const box = { x0: 0, y0: 0, x1: W, y1: H };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pickAt = (d, x, y) => DGC.pickColor(d, W, H, x, y, DGC.bgColor ? DGC.bgColor(d, W, H) : null);
// same pipeline as the page
function run(d, f, { tol = 60, step = 2, gap = 2, conn = true, clickX = 200, region = box } = {}) {
  const cy = Math.round(f(clickX));
  const col = pickAt(d, clickX, cy);
  let mk = DGC.colorMask(d, W, H, col, tol, region);
  if (conn) mk = DGC.keepConnected(mk, W, region, [clickX, cy], gap);
  const r = DGC.extractCurve(mk, W, region, step, [clickX, cy]);
  return { col, mk, ...r };
}
function err(pts, f) { let s = 0, mx = 0; for (const [x, y] of pts) { const e = Math.abs(y - f(x)); s += e; mx = Math.max(mx, e); } return { mean: pts.length ? s / pts.length : Infinity, max: mx }; }
const sine = x => 150 + 70 * Math.sin((x - 20) / 55);
const RED = [192, 57, 43];

// ---------- colour picking ----------
test('pick: 2 px line #c0392b keeps its own colour (old 3x3 mean gave #d57a71)', () => {
  const d = blank(); drawFn(d, sine, 2, RED);
  const col = pickAt(d, 200, Math.round(sine(200)));
  assert.ok(dist(col, RED) < 25, 'picked ' + col.map(Math.round) + ' vs ' + RED);
});
test('pick: 1 px line, clicked one pixel off the line', () => {
  const d = blank(); drawFn(d, sine, 1, RED);
  const col = pickAt(d, 200, Math.round(sine(200)) + 1);
  assert.ok(dist(col, RED) < 90, 'picked ' + col.map(Math.round));
});
test('pick: thick (6 px) line keeps its colour', () => {
  const d = blank(); drawFn(d, sine, 6, RED);
  const col = pickAt(d, 200, Math.round(sine(200)));
  assert.ok(dist(col, RED) < 10, 'picked ' + col.map(Math.round));
});
test('pick: light line on a dark background (background is the image mode, not white)', () => {
  const d = blank([30, 30, 40]); drawFn(d, sine, 2, [240, 200, 60]);
  const col = pickAt(d, 200, Math.round(sine(200)));
  assert.ok(dist(col, [240, 200, 60]) < 30, 'picked ' + col.map(Math.round));
});

// ---------- extraction accuracy ----------
test('extraction: 1 px anti-aliased line, tolerance 40/60/80: error below 1.5 px', () => {
  for (const tol of [40, 60, 80]) {
    const d = blank(); drawFn(d, sine, 1, RED);
    const r = run(d, sine, { tol }), e = err(r.pts, sine);
    assert.ok(r.pts.length > 30 && e.mean < 1.5, `tol ${tol}: ${r.pts.length} pts, mean error ${e.mean.toFixed(2)} px`);
    if (r.pts.length * 2 < 0.5 * 360) { const a = DGC.assess({ mode: 'curve', pts: r.pts, mask: r.mk, w: W, box, tol, tolAtPick: tol, step: 2, amb: r.amb, ambFirst: r.ambFirst, plotW: 360, plotH: 260 }); assert.ok(a.warnings.length, `tol ${tol}: ${r.pts.length} points and no warning`); }
  }
});
test('extraction: 2 px line, JPEG-like damage, tolerance 80: error below 2 px', () => {
  const d = blank(); drawFn(d, sine, 2, RED); jpegLike(d);
  const r = run(d, sine, { tol: 80 }), e = err(r.pts, sine);
  assert.ok(r.pts.length > 100 && e.mean < 2, `${r.pts.length} pts, mean error ${e.mean.toFixed(2)} px`);
});
test('extraction: grid lines present, tolerance 60 on a 2 px line: grid is ignored', () => {
  const d = blank(); drawGrid(d); drawFn(d, sine, 2, RED);
  const r = run(d, sine, { tol: 60 }), e = err(r.pts, sine);
  assert.ok(e.mean < 1.5, `mean error ${e.mean.toFixed(2)}`);
});

// ---------- crossing curves of the same colour ----------
const A = x => 150 + 110 * Math.sin((x - 20) / 25 + .5), B = x => 150 - 110 * Math.sin((x - 20) / 25 + .5);   // two same-colour sines crossing steeply (every ~78 px)
test('crossing: two same-colour lines, the tracker keeps following the same line (continuity prior)', () => {
  const d = blank(); drawFn(d, A, 2, RED); drawFn(d, B, 2, RED);
  const r = run(d, A, { tol: 60, clickX: 40 }), ea = err(r.pts, A);
  const bad = r.pts.filter(([x, y]) => Math.abs(y - A(x)) > 4).length;
  assert.ok(bad / r.pts.length < 0.05, `${bad}/${r.pts.length} points off line A`);
  assert.ok(ea.mean < 1.5, 'mean ' + ea.mean.toFixed(2));
});
test('crossing: columns with several candidate segments are counted and reported', () => {
  const d = blank(); drawFn(d, A, 2, RED); drawFn(d, B, 2, RED);
  const r = run(d, A, { tol: 60, clickX: 40 });
  assert.ok(r.amb > 50, 'ambiguous columns ' + r.amb);
});

// ---------- plausibility checks ----------
const asm = (d, f, o = {}) => {
  const r = run(d, f, o);
  const a = DGC.assess({ mode: 'curve', pts: r.pts, mask: r.mk, w: W, box: o.region || box, tol: o.tol ?? 60, tolAtPick: o.tolAtPick ?? o.tol ?? 60, step: o.step ?? 2, amb: r.amb, ambFirst: r.ambFirst, plotW: 360, plotH: 260 });
  return { r, a };
};
test('checks: clean extraction gives no warning', () => {
  const d = blank(); drawFn(d, sine, 2, RED);
  const { a } = asm(d, sine);
  assert.equal(a.warnings.length, 0, a.warnings.join(' | '));
  assert.ok(a.coverage > 0 && a.coverage < 0.03 && a.n > 100);
});
test('checks: tolerance 320 (everything matches) warns', () => {
  const d = blank(); drawGrid(d); drawFn(d, sine, 2, RED); jpegLike(d);
  const { a } = asm(d, sine, { tol: 320, conn: false });
  assert.ok(a.warnings.length >= 1 && a.coverage > 0.3, a.warnings.join(' | '));
});
test('checks: tolerance 120 on a JPEG-like image with a grey grid warns', () => {
  const d = blank(); drawGrid(d, [150, 150, 150]); drawFn(d, sine, 2, RED); jpegLike(d, 10);
  const { a } = asm(d, sine, { tol: 120, conn: false });
  assert.ok(a.warnings.length >= 1, 'no warning, coverage ' + a.coverage);
});
test('checks: grid lines in the mask are detected', () => {
  const d = blank(); drawGrid(d, RED); drawFn(d, sine, 2, RED);
  const { a } = asm(d, sine, { tol: 60, conn: false });
  assert.ok(a.warnings.some(w => /grid|axes|straight/i.test(w)), a.warnings.join(' | '));
});
test('checks: far too few points warns', () => {
  const d = blank(); drawFn(d, sine, 1, RED, 20, 90);
  const { a } = asm(d, sine, { clickX: 50 });
  assert.ok(a.warnings.some(w => /fewer|expected/i.test(w)), a.warnings.join(' | '));
});
test('checks: tolerance edited after the click warns', () => {
  const d = blank(); drawFn(d, sine, 2, RED);
  const { a } = asm(d, sine, { tol: 60, tolAtPick: 40 });
  assert.ok(a.warnings.some(w => /tolerance/i.test(w)), a.warnings.join(' | '));
});
test('checks: large jump between consecutive points warns', () => {
  const pts = []; for (let x = 20; x < 380; x += 2) pts.push([x + .5, x < 200 ? 60 : 250]);
  const a = DGC.assess({ mode: 'curve', pts, mask: new Uint8Array(W * H), w: W, box, tol: 60, tolAtPick: 60, step: 2, amb: 0, ambFirst: [], plotW: 360, plotH: 260 });
  assert.ok(a.warnings.some(w => /jump/i.test(w)), a.warnings.join(' | '));
});
test('checks: several candidate segments are reported as a warning', () => {
  const pts = []; for (let x = 20; x < 380; x += 2) pts.push([x + .5, 100]);
  const a = DGC.assess({ mode: 'curve', pts, mask: new Uint8Array(W * H), w: W, box, tol: 60, tolAtPick: 60, step: 2, amb: 40, ambFirst: [150], plotW: 360, plotH: 260 });
  assert.ok(a.warnings.some(w => /candidate|several/i.test(w)), a.warnings.join(' | '));
});

// ---------- resolution and export precision ----------
test('pixel size in data units follows the calibration', () => {
  const f = p => [p[0] * 0.25, 10 - p[1] * 0.1];
  const r = DGC.pixelSize(f, [100, 100]);
  assert.ok(Math.abs(r[0] - 0.25) < 1e-9 && Math.abs(r[1] - 0.1) < 1e-9);
});
test('export: no 15-digit doubles, precision follows the pixel size', () => {
  assert.equal(DGC.fmtRes(12.3456789012345, 0.25), '12.35');
  assert.equal(DGC.fmtRes(0.000123456789, 1e-5), '0.000123');
  assert.equal(DGC.fmtRes(1234567.891, 500), '1234568');
  assert.equal(DGC.fmtRes(5.5, NaN), '5.5');
  assert.ok(DGC.fmtRes(1 / 3, 0.001).length <= 7);
});
test('audit header lists calibration, scales and extraction parameters', () => {
  const lines = DGC.auditLines({ cal: { pts: [[10, 200], [310, 200], [10, 200], [10, 20]], vals: ['0', '100', '0', '50'] }, xlog: false, ylog: true,
    sets: [{ name: 'Dataset 1', n: 120, extract: { color: [192, 57, 43], tol: 60, mode: 'curve', step: 2, conn: true, gap: 2 } }], date: '2026-11-26' });
  const t = lines.join('\n');
  assert.ok(lines.every(l => l.startsWith('#')));
  assert.ok(/X1/.test(t) && /log/.test(t) && /tolerance/i.test(t) && /192/.test(t));
});

let fail = 0;
for (const [n, f] of tests) { try { f(); console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } }
console.log(fail ? `\n${fail} of ${tests.length} failed` : `\nall ${tests.length} passed`);
process.exit(fail ? 1 : 0);
