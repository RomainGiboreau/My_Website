// Self-check for the colour-blind check core (docs/cvd/index.html, <script id="cv-core">).
// Run: node scripts/cvd_test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../docs/cvd/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="cv-core">([\s\S]*?)<\/script>/); assert.ok(m, 'cv-core block not found');
const w = {}; new Function('window', m[1])(w); const C = w.CV;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok   ' + name); };
const T3 = ['protan', 'deutan', 'tritan'];
// Sharma, Wu & Dalal (2005) supplementary test data, 34 pairs: L1 a1 b1 L2 a2 b2 dE00
const SHARMA = [[50,2.6772,-79.7751,50,0,-82.7485,2.0425],[50,3.1571,-77.2803,50,0,-82.7485,2.8615],[50,2.8361,-74.02,50,0,-82.7485,3.4412],[50,-1.3802,-84.2814,50,0,-82.7485,1],[50,-1.1848,-84.8006,50,0,-82.7485,1],[50,-0.9009,-85.5211,50,0,-82.7485,1],[50,0,0,50,-1,2,2.3669],[50,-1,2,50,0,0,2.3669],[50,2.49,-0.001,50,-2.49,0.0009,7.1792],[50,2.49,-0.001,50,-2.49,0.001,7.1792],[50,2.49,-0.001,50,-2.49,0.0011,7.2195],[50,2.49,-0.001,50,-2.49,0.0012,7.2195],[50,-0.001,2.49,50,0.0009,-2.49,4.8045],[50,-0.001,2.49,50,0.001,-2.49,4.8045],[50,-0.001,2.49,50,0.0011,-2.49,4.7461],[50,2.5,0,50,0,-2.5,4.3065],[50,2.5,0,73,25,-18,27.1492],[50,2.5,0,61,-5,29,22.8977],[50,2.5,0,56,-27,-3,31.903],[50,2.5,0,58,24,15,19.4535],[50,2.5,0,50,3.1736,0.5854,1],[50,2.5,0,50,3.2972,0,1],[50,2.5,0,50,1.8634,0.5757,1],[50,2.5,0,50,3.2592,0.335,1],[60.2574,-34.0099,36.2677,60.4626,-34.1751,39.4387,1.2644],[63.0109,-31.0961,-5.8663,62.8187,-29.7946,-4.0864,1.263],[61.2901,3.7196,-5.3901,61.4292,2.248,-4.962,1.8731],[35.0831,-44.1164,3.7933,35.0232,-40.0716,1.5901,1.8645],[22.7233,20.0904,-46.694,23.0331,14.973,-42.5619,2.0373],[36.4612,47.858,18.3852,36.2715,50.5065,21.2231,1.4146],[90.8027,-2.0831,1.441,91.1528,-1.6435,0.0447,1.4441],[90.9257,-0.5406,-0.9208,88.6381,-0.8985,-0.7239,1.5381],[6.7747,-0.2908,-2.4247,5.8714,-0.0985,-2.2286,0.6377],[2.0776,0.0795,-1.135,0.9033,-0.0636,-0.5514,0.9082]];

test('severity 0 is the identity matrix and leaves colours unchanged', () => {
  for (const t of T3) { const mm = C.matrix(t, 0); [1, 0, 0, 0, 1, 0, 0, 0, 1].forEach((v, i) => near(mm[i], v, 1e-12, t)); }
  for (const c of [[12, 200, 77], [255, 0, 0], [3, 3, 250]]) for (const t of T3) C.simulateRGB(c, t, 0).forEach((v, i) => near(v, c[i], 1e-6, t));
});
test('white and black are preserved by every simulation, at every severity', () => {
  for (const t of [...T3, 'achroma']) for (const s of [0, .3, .55, 1]) {
    C.simulateRGB([255, 255, 255], t, s).forEach(v => near(v, 255, .6, t + ' white ' + s));
    C.simulateRGB([0, 0, 0], t, s).forEach(v => near(v, 0, 1e-9, t + ' black'));
  }
});
test('rows of every tabulated matrix sum to about 1 (white preserved)', () => {
  for (const t of T3) C.TAB[t].forEach((r, k) => { for (let i = 0; i < 3; i++) near(r[3 * i] + r[3 * i + 1] + r[3 * i + 2], 1, 2e-3, t + ' sev ' + k / 10 + ' row ' + i) });
  for (const t of T3) { const mm = C.matrix(t, 1); for (let i = 0; i < 3; i++) near(mm[3 * i] + mm[3 * i + 1] + mm[3 * i + 2], 1, 1e-5, t) }
});
test('table has 11 severities of 9 values; the dichromat matrices equal the published severity-1 values; interpolation is linear', () => {
  for (const t of T3) { assert.equal(C.TAB[t].length, 11); C.TAB[t].forEach(r => assert.equal(r.length, 9)) }
  assert.deepEqual(C.matrix('protan', 1).map(v => +v.toFixed(6)), [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998]);
  assert.deepEqual(C.matrix('tritan', 1).map(v => +v.toFixed(6)), [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039]);
  const a = C.matrix('deutan', .3), b = C.matrix('deutan', .4), c = C.matrix('deutan', .35); c.forEach((v, i) => near(v, (a[i] + b[i]) / 2, 1e-12));
});
test('sRGB decode / encode round trip', () => {
  for (let v = 0; v < 256; v++) near(C.linearToSrgb(C.srgbToLinear(v)), v, 1e-9, 'v=' + v);
  near(C.srgbToLinear(255), 1, 1e-12); near(C.srgbToLinear(0), 0, 0); near(C.srgbToLinear(128), 0.2158605, 1e-6);
});
test('image simulation agrees with the per-colour simulation, keeps alpha, severity 0 is the identity', () => {
  const d = new Uint8ClampedArray([255, 0, 0, 255, 10, 200, 90, 128, 255, 255, 255, 7, 0, 0, 0, 255]);
  const o = C.simulateImage(d, 'deutan', 1);
  for (let p = 0; p < 4; p++) { const e = C.simulateRGB([d[4 * p], d[4 * p + 1], d[4 * p + 2]], 'deutan', 1); for (let k = 0; k < 3; k++) near(o[4 * p + k], e[k], 1.01, 'px ' + p); assert.equal(o[4 * p + 3], d[4 * p + 3]) }
  assert.deepEqual([...C.simulateImage(d, 'tritan', 0)], [...d]);
});
test('achromatopsia gives grey (R = G = B) of the same luminance', () => {
  const g = C.simulateRGB([200, 30, 90], 'achroma', 1); near(g[0], g[1], 1e-9); near(g[1], g[2], 1e-9);
  near(C.rgbToLab(g)[0], C.rgbToLab([200, 30, 90])[0], .02, 'same L*');
});
test('sRGB to Lab known values', () => {
  const W = C.rgbToLab([255, 255, 255]), K = C.rgbToLab([0, 0, 0]), G = C.rgbToLab([128, 128, 128]);
  near(W[0], 100, 1e-3); near(W[1], 0, 2e-3); near(W[2], 0, 2e-3); near(K[0], 0, 1e-9);
  near(G[0], 53.585, .02, '#808080 L*'); near(G[1], 0, 2e-3); near(G[2], 0, 2e-3);
  const R = C.rgbToLab([255, 0, 0]); near(R[0], 53.24, .05); near(R[1], 80.09, .15); near(R[2], 67.20, .15);
  const B = C.rgbToLab([0, 0, 255]); near(B[0], 32.30, .05); near(B[1], 79.19, .15); near(B[2], -107.86, .2);
});
test('CIEDE2000 reproduces the 34 published test pairs of Sharma, Wu & Dalal (2005) to 1e-4, in both orders', () => {
  assert.equal(SHARMA.length, 34);
  SHARMA.forEach((r, i) => { near(C.deltaE2000(r.slice(0, 3), r.slice(3, 6)), r[6], 1e-4, 'pair ' + (i + 1)); near(C.deltaE2000(r.slice(3, 6), r.slice(0, 3)), r[6], 1e-4, 'pair ' + (i + 1) + ' reversed') });
});
test('CIEDE2000 properties: zero for identical colours, black / white large, triangle sanity', () => {
  assert.equal(C.dE('#336699', '#336699'), 0); near(C.dE('#000000', '#FFFFFF'), 100, .5, 'black / white');
  const a = '#FF0000', b = '#FF4040', c = '#0000FF'; assert.ok(C.dE(a, b) < C.dE(a, c)); assert.ok(C.dE(a, c) <= C.dE(a, b) + C.dE(b, c) + 1e-9);
  near(C.dE(a, c), C.dE(c, a), 1e-12);
});
test('protanopia / deuteranopia make red and green of equal lightness hard to tell apart; a blue / yellow pair stays distinct', () => {
  const r = '#C03030', g = '#2F8A2F', bl = '#2040C0', ye = '#C0C020';
  assert.ok(C.dE(r, g) > 30);
  for (const t of ['protan', 'deutan']) { const a = C.analysePalette([r, g, bl, ye], t, 1, 10); assert.ok(a.pairs[0].dE < C.dE(r, g) / 2, t + ' ' + a.pairs[0].dE); assert.ok(a.pairs.find(p => p.i === 2 && p.j === 3).dE > 20) }
  const an = C.analysePalette([r, g], 'deutan', 1, 40); assert.equal(an.hard.length, 1); assert.equal(an.hard[0].lost, true);
  const same = C.analysePalette([r, g, bl], 'deutan', 0, 10); same.pairs.forEach(p => near(p.dE, p.dE0, 1e-6));
});
test('parseColors: hex, #RGB, separators, rejects', () => {
  const p = C.parseColors('#ff0000, 0f0\n#0000FF;  zzz  12345'); assert.deepEqual(p.colors, ['#FF0000', '#00FF00', '#0000FF']); assert.deepEqual(p.bad, ['zzz', '12345']);
});
test('greyscale check: rainbow is not monotonic in lightness, viridis, cividis, grey and a plain ramp are', () => {
  assert.equal(C.lightnessCheck(C.sampleMap('jet', 32)).mono, 'non-monotonic');
  for (const id of ['viridis', 'cividis', 'grey']) assert.equal(C.lightnessCheck(C.sampleMap(id, 32)).mono, 'increasing', id);
  assert.equal(C.lightnessCheck(['#FFFFFF', '#808080', '#000000']).mono, 'decreasing');
  assert.equal(C.lightnessCheck(['#808080', '#808080']).mono, 'flat');
  assert.ok(C.lightnessCheck(C.sampleMap('seismic', 33)).reversals >= 1);
});
test('built-in maps: ends, sample counts, valid hex', () => {
  assert.equal(C.sampleMap('viridis', 7).length, 7); assert.equal(C.sampleMap('tab10').length, 10); assert.equal(C.sampleMap('okabe').length, 8);
  assert.equal(C.sampleMap('viridis', 5)[0], '#440154'); assert.equal(C.sampleMap('viridis', 5)[4], '#FDE725'); assert.equal(C.sampleMap('grey', 3)[1], '#808080');
  for (const id of Object.keys(C.MAPS)) C.sampleMap(id, 12).forEach(h => assert.ok(C.hexToRgb(h), id + ' ' + h));
});
console.log(n + ' tests passed');
