// Self-check for the BHT correction core (docs/bht/index.html, <script id="bht-core">).
// Run: node scripts/bht_test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../docs/bht/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="bht-core">([\s\S]*?)<\/script>/); assert.ok(m, 'bht-core block not found');
const names = 'toN,toC,parseTable,guess,ols,horner,tcrit,waples,waplesU,fitGrad,LR,wapOut,groupRows,plaus';
const C = new Function(m[1] + `\nreturn {${names.split(',').map(n => `${n}:typeof ${n}==='undefined'?undefined:${n}`).join(',')}}`)();
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok   ' + name); };

test('Horner: exact recovery of Tf=100, m=8, tc=5 h with dt = 4, 8, 16 h', () => {
  const pts = [4, 8, 16].map(dt => ({ dt, tc: 5, T: 100 - 8 * Math.log((5 + dt) / dt) }));
  const h = C.horner(pts); near(h.Tf, 100, 1e-9, 'Tf'); near(h.m, 8, 1e-9, 'm'); near(h.r2, 1, 1e-12, 'R2');
});
test('Horner: tc scale changes Tf in the expected direction', () => {
  const pts = [4, 8, 16].map(dt => ({ dt, tc: 5, T: 100 - 8 * Math.log((5 + dt) / dt) }));
  assert.ok(Math.abs(C.horner(pts, 2).Tf - 100) > 0.1);
});
test('unit conversions: degF to degC, decimal comma, unicode minus', () => {
  near(C.toC(212, 'F'), 100, 1e-12); near(C.toC(32, 'F'), 0, 1e-12); near(C.toC(75, 'C'), 75, 0);
  near(C.toN('68,2'), 68.2, 0); near(C.toN('1.234,5'), 1234.5, 0); near(C.toN('−5'), -5, 0); assert.ok(isNaN(C.toN('n.d.')));
  near(C.LR, 18.3333, 1e-3, 'last resort offset 33 degF');
});
test('unit conversions in groupRows: minutes, feet, degF', () => {
  const rows = [['6561.68', '360', '158'], ['6561.68', '720', '160']];   // 2000 m, 6 h and 12 h, 70 and 71.1 degC
  const r = C.groupRows(rows, { cz: 0, cd: 1, cT: 2, cc: -1, tu: 1 / 60, zu: 0.3048, Tu: 'F', tc0: 6 });
  assert.equal(r.gr.length, 1); near(r.gr[0].z, 2000, 0.01); near(r.gr[0].pts[0].dt, 6, 1e-9); near(r.gr[0].pts[0].T, 70, 1e-9);
});
test('no header (2000 6 68.2): depth column kept, not lost (cz = -1)', () => {
  const t = C.parseTable('2000 6 68.2\n2000 12 70.1\n2000 24 71.0', 2); assert.equal(t.hasHead, false);
  const g = C.guess(t.head, t.hasHead); assert.deepEqual(g.slice(0, 3), [0, 1, 2]); assert.equal(g[3], -1);
  const r = C.groupRows(t.rows, { cz: g[0], cd: g[1], cT: g[2], cc: g[3], tu: 1, zu: 1, Tu: 'C', tc0: 6 });
  assert.equal(r.gr.length, 1); assert.equal(r.gr[0].z, 2000); assert.equal(r.gr[0].pts.length, 3);
});
test('header with an unrecognised depth name still maps column 0 to depth', () => {
  const g = C.guess(['Cote', 'Dt (h)', 'BHT (C)'], true); assert.equal(g[0], 0); assert.equal(g[1], 1); assert.equal(g[2], 2);
});
test('whitespace table with decimal commas is not split on the comma', () => {
  const t = C.parseTable('Depth Dt T\n2000 6 68,2\n2000 12 70,1', 2); assert.equal(t.nc, 3); assert.equal(C.toN(t.rows[0][2]), 68.2);
  const u = C.parseTable('2000 6 68,2\n2000 12 70,1', 2); assert.equal(u.nc, 3);
  const c = C.parseTable('Depth,Dt,T\n2000,6,68.2\n2000,12,70.1', 2); assert.equal(c.nc, 3); assert.equal(c.rows[1][2], '70.1');
  const c2 = C.parseTable('2000, 6, 68.2\n2000, 12, 70.1', 2); assert.equal(c2.nc, 3);
});
test('tc0 = 0 and no tc column: error names t_c; skips counted with reasons and row numbers', () => {
  const rows = [['2000', '6', '68'], ['2000', '12', '70']];
  const r = C.groupRows(rows, { cz: 0, cd: 1, cT: 2, cc: -1, tu: 1, zu: 1, Tu: 'C', tc0: 0 });
  assert.equal(r.gr.length, 0); assert.equal(r.bad, 2); assert.match(r.why.join(' '), /t_c/); assert.match(r.why.join(' '), /Default t_c/);
  const r2 = C.groupRows([['2000', '6', '68'], ['2000', 'x', '70'], ['2000', '12', '']], { cz: 0, cd: 1, cT: 2, cc: -1, tu: 1, zu: 1, Tu: 'C', tc0: 6 });
  assert.equal(r2.bad, 2); assert.equal(r2.nread, 3); assert.match(r2.why.join(' '), /data row 2/); assert.match(r2.why.join(' '), /data row 3/);
});
test('Waples domain: 2000 m is outside 3500-6500 m, 5000 m inside', () => {
  assert.equal(C.wapOut(2000), true); assert.equal(C.wapOut(3500), false); assert.equal(C.wapOut(6500), false); assert.equal(C.wapOut(7000), true);
  // value from the abstract coefficients (2000 m, 24 h, 80 degC, surface 15)
  near(C.waples(80, 2000, 24, 15), 15 + 1.32866 * Math.exp(-0.005289 * 24) * 65 - 0.001391 * (2000 - 4498), 1e-9);
});
test('plausibility: T below surface temperature and aberrant gradient are reported', () => {
  const res = [{ pts: [{ T: 10 }, { T: 40 }], h: { Tf: 12 } }];
  const w = C.plaus(res, { g: 150 }, 15).join(' | '); assert.match(w, /colder than the surface/); assert.match(w, /aberrant/);
  assert.equal(C.plaus([{ pts: [{ T: 60 }], h: { Tf: 80 } }], { g: 30 }, 15).length, 0);
});
test('gradient fit through the surface temperature and free intercept', () => {
  const g = C.fitGrad([1, 2, 3], [45, 75, 105], 15, true); near(g.g, 30, 1e-9);
  const f = C.fitGrad([1, 2, 3], [45, 75, 105], 15, false); near(f.g, 30, 1e-9); near(f.a, 15, 1e-9);
});
console.log(`\n${n} tests passed`);
