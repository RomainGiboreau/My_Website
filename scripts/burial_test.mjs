// Self-check for the burial-history core (docs/burial/index.html, <script id="bh-core">).
// Run: node scripts/burial_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const load = (page, id) => {
  const html = readFileSync(new URL(`../docs/${page}/index.html`, import.meta.url), 'utf8');
  const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)<\\/script>`));
  assert.ok(m, `${id} script block not found`);
  const ctx = { window: {} };
  vm.runInNewContext(m[1], ctx);
  return ctx.window;
};
const BH = load('burial', 'bh-core').BH;
const DG = load('maturity', 'mat-core').DG;

const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (tol ${tol})`);
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const fin = Number.isFinite;

// independent numerical integration (composite Simpson) of (1 - phi) between y1 and y2
const simpson = (f, a, b, n = 4000) => { const h = (b - a) / n; let s = f(a) + f(b); for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2); return s * h / 3; };
const solidNum = (L, y1, y2) => simpson(y => 1 - L.phi0 * Math.exp(-L.c / 1000 * y), y1, y2);

const L0 = BH.cloneLith();
const U = (name, top, base, ageBase, ageTop, lith, wd) => ({ name, kind: 'U', top, base, ageBase, ageTop, lith, wd: wd ?? NaN, E: NaN, tEs: NaN });
const model = (rows, over = {}) => ({ rows, lith: JSON.parse(JSON.stringify(L0)), rhoW: 1030, rhoM: 3300, dt: 5, sl: [], thermal: { on: false }, ...over });
const sumSolid = (R, ti) => R.el.reduce((s, e, k) => s + (fin(e.top[ti]) && e.kind === 'U' ? BH.solid(R.els[k].L, e.top[ti], e.base[ti]) : 0), 0);

// ---- decompaction
test('solid-thickness formula equals a numerical (Simpson) integral of (1 - phi) dz, for every lithology, c = 0 included', () => {
  for (const k in L0) { const L = L0[k]; close(BH.solid(L, 700, 2300), solidNum(L, 700, 2300), 1e-6, k); }
  const L = { phi0: .5, c: 0, rho: 2650, k: 3 }; close(BH.solid(L, 0, 1000), 500, 1e-9, 'c=0');
});
test('bottom() is the inverse of solid(): round trip for all lithologies and depths', () => {
  for (const k in L0) for (const y1 of [0, 500, 3000]) for (const S of [1, 120, 2500]) { const y2 = BH.bottom(L0[k], y1, S); close(BH.solid(L0[k], y1, y2), S, 1e-6, `${k} ${y1} ${S}`); assert.ok(y2 > y1 + S - 1e-9); }
});
test('single layer: decompacted thickness at the surface matches an independent numerical solution (bisection on a Simpson integral)', () => {
  // unit B (sandstone 800-2000 m) under unit A; before A exists B sits at the surface
  const R = BH.run(model([U('A', 0, 800, 50, 0, 'shale'), U('B', 800, 2000, 100, 50, 'sandstone')]));
  assert.equal(R.errors.length, 0);
  const L = L0.sandstone, S = solidNum(L, 800, 2000);
  let lo = 0, hi = 5000; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; (solidNum(L, 0, m) < S ? (lo = m) : (hi = m)); }
  const iB = 1, i50 = R.times.findIndex(t => t === 50);   // A has not started at 50 Ma
  close(R.el[iB].base[i50] - R.el[iB].top[i50], lo, 0.05, 'decompacted thickness of B at the surface');
  assert.ok(lo > 1200, 'B thicker than at present');
});
test('solid thickness is conserved at every time step (single layer, multi-layer, with an unconformity gap)', () => {
  const rows = [U('A', 0, 600, 20, 0, 'sandstone'), U('B', 600, 1500, 70, 30, 'shale'), U('C', 1500, 2400, 120, 90, 'limestone'), U('D', 2400, 3300, 200, 150, 'chalk')];
  const R = BH.run(model(rows, { dt: 2 })); assert.equal(R.errors.length, 0);
  const S = R.els.map(e => e.S);
  R.times.forEach((t, ti) => R.els.forEach((e, k) => {
    if (!fin(R.el[k].top[ti])) return;
    close(BH.solid(e.L, R.el[k].top[ti], R.el[k].base[ti]), BH.solidAt(e, t), 1e-6, `${e.name} at ${t} Ma`);
  }));
  const last = R.times.length - 1; close(sumSolid(R, last), S.reduce((a, b) => a + b, 0), 1e-6, 'total solid at 0 Ma');
  // present-day depths reproduced
  R.el.forEach((e, k) => { close(e.top[last], rows[k].top, 1e-6, e.name + ' top'); close(e.base[last], rows[k].base, 1e-6, e.name + ' base'); });
  const single = BH.run(model([U('A', 0, 2500, 100, 0, 'shale')])); close(sumSolid(single, single.times.length - 1), single.els[0].S, 1e-6, 'single layer');
});
test('no compaction (c = 0): thickness is constant in time', () => {
  const lith = JSON.parse(JSON.stringify(L0)); for (const k in lith) lith[k].c = 0;
  const R = BH.run(model([U('A', 0, 700, 30, 0, 'sandstone'), U('B', 700, 1900, 90, 30, 'shale')], { lith, dt: 3 }));
  R.times.forEach((t, ti) => { if (fin(R.el[1].top[ti]) && R.el[1].base[ti] > R.el[1].top[ti] && t <= 30) close(R.el[1].base[ti] - R.el[1].top[ti], 1200, 1e-6, `B at ${t}`); });
  R.times.forEach((t, ti) => { if (t <= 0) close(R.el[0].base[ti] - R.el[0].top[ti], 700, 1e-6, 'A'); });
});
test('compaction makes deeply buried units thinner than at the surface (monotonic burial, no erosion)', () => {
  const rows = [U('A', 0, 800, 30, 0, 'sandstone'), U('B', 800, 1800, 80, 30, 'shale'), U('C', 1800, 3000, 150, 80, 'limestone')];
  const R = BH.run(model(rows, { dt: 2 }));
  R.el.forEach(e => { let prev = -Infinity; for (let i = 0; i < R.times.length; i++) if (fin(e.base[i])) { assert.ok(e.base[i] >= prev - 1e-6, `${e.name} base depth decreases at ${R.times[i]}`); prev = e.base[i]; } });
  const b = R.el[1], i30 = R.times.findIndex(t => t === 30); assert.ok(b.base[i30] - b.top[i30] > 1000 + 1, 'B thicker before burial');
});
test('eroded section: thickness E at erosion start, removed by the end of erosion, column goes up while eroding', () => {
  const rows = [U('A', 0, 500, 20, 0, 'sandstone'), { name: 'ero', kind: 'E', top: NaN, base: NaN, ageBase: 60, ageTop: 20, lith: 'shale', wd: NaN, E: 400, tEs: 40 }, U('B', 500, 1500, 100, 60, 'shale')];
  const R = BH.run(model(rows, { dt: 5 })); assert.equal(R.errors.length, 0);
  const i40 = R.times.findIndex(t => t === 40), i60 = R.times.findIndex(t => t === 60), i20 = R.times.findIndex(t => t === 20);
  close(R.el[1].base[i40] - R.el[1].top[i40], 400, 1e-6, 'ghost thickness at erosion start');
  assert.ok(R.el[2].top[i40] > R.el[2].top[i20] && R.el[2].top[i40] > 399, 'B top buried 400 m at 40 Ma, shallower at 20 Ma');
  close(R.el[1].base[i20] - R.el[1].top[i20], 0, 1e-6, 'ghost gone');
  assert.ok(R.el[2].base[i60] < R.el[2].base[i40]);
});

// ---- Airy backstripping
test('Airy backstripping, zero water depth and zero sea level: Y = S (rm - rs)/(rm - rw) (hand computation 2000 x 900/2300 = 782.61 m)', () => {
  close(BH.backstrip(2000, 2400, 0, 0, 3300, 1000), 2000 * 900 / 2300, 1e-9, 'formula');
  close(BH.backstrip(2000, 2400, 0, 0, 3300, 1000), 782.6087, 1e-4, 'number');
  // with water depth and sea level: + Wd - dSL rm/(rm - rw)
  close(BH.backstrip(2000, 2400, 200, 50, 3300, 1000), 782.6087 + 200 - 50 * 3300 / 2300, 1e-4, 'with Wd and SL');
});
test('run(): one non-porous layer of grain density 2400 (phi0 = 0, c = 0) gives Y = S (rm - rs)/(rm - rw) at every time', () => {
  const lith = JSON.parse(JSON.stringify(L0)); lith.sandstone = { phi0: 0, c: 0, rho: 2400, k: 3, color: '#fff' };
  const R = BH.run(model([U('A', 0, 2000, 40, 0, 'sandstone', 0)], { lith, rhoW: 1000, rhoM: 3300 }));
  const last = R.times.length - 1; close(R.Y[last], 2000 * 900 / 2300, 1e-6, 'Y at 0 Ma'); close(R.rhoBar[last], 2400, 1e-9, 'mean density');
  const mid = R.times.findIndex(t => t <= 20); close(R.Y[mid], 1000 * 900 / 2300, 1e-6, 'Y when half deposited');
});
test('run(): bulk density uses pore water: mean density between water and grain density; sea-level and water-depth terms enter', () => {
  const a = BH.run(model([U('A', 0, 1500, 40, 0, 'shale', 0)])), b = BH.run(model([U('A', 0, 1500, 40, 0, 'shale', 300)], { sl: [[0, 0], [100, 60]] }));
  const l = a.times.length - 1; assert.ok(a.rhoBar[l] > 1030 && a.rhoBar[l] < 2720);
  close(b.Y[l] - a.Y[l], 300, 1e-6, 'Wd adds to Y (sea level 0 at 0 Ma)');
  const i = b.times.findIndex(t => t <= 20 + 1e-9); close(b.Y[i] - a.Y[i] - (b.wd[i] - a.wd[i]), -(b.sl[i]) * 3300 / (3300 - 1030), 1e-6, 'sea-level term');
});

// ---- geotherm
test('geotherm: T(z0) = surface temperature and gradient = q/k (constant k)', () => {
  const lith = JSON.parse(JSON.stringify(L0)); lith.sandstone.k = 3;
  const m = model([U('A', 0, 2000, 40, 0, 'sandstone')], { lith, thermal: { on: true, q0: 60, Ts0: 10, kmode: 'matrix', table: [] } });
  const R = BH.run(m); assert.equal(R.errors.length, 0);
  const P = R.prof0; close(BH.tempAt(P, 0), 10, 1e-12, 'T at z = 0'); close((BH.tempAt(P, 1500) - BH.tempAt(P, 500)) / 1000, 0.060 / 3, 1e-9, 'gradient K/m');
  close(BH.tempAt(P, 2000), 10 + 0.06 * 2000 / 3, 1e-9, 'T at 2000 m');
  // porosity-corrected mode with c = 0 is also a constant k = km^(1-phi0) kw^phi0
  lith.sandstone.c = 0; const m2 = model([U('A', 0, 2000, 40, 0, 'sandstone')], { lith, thermal: { on: true, q0: 60, Ts0: 10, kmode: 'geo', table: [] } });
  const k = Math.pow(3, 1 - .49) * Math.pow(0.6, .49), P2 = BH.run(m2).prof0; close((BH.tempAt(P2, 1800) - BH.tempAt(P2, 200)) / 1600, 0.06 / k, 1e-9, 'geo-mean gradient');
});
test('geotherm through layers: temperature drop = q sum(h/k); heat flow continuous (gradient inversely proportional to k)', () => {
  const lith = JSON.parse(JSON.stringify(L0)); lith.sandstone.k = 4; lith.shale.k = 1.5;
  const m = model([U('A', 0, 1000, 40, 0, 'sandstone'), U('B', 1000, 2200, 90, 40, 'shale')], { lith, thermal: { on: true, q0: 70, Ts0: 15, kmode: 'matrix', table: [] }, dt: 10 });
  const R = BH.run(m), P = R.prof0, a = R.el[0], b = R.el[1], l = R.times.length - 1;
  const hA = a.base[l] - a.top[l], hB = b.base[l] - b.top[l];
  close(BH.tempAt(P, b.base[l]), 15 + 0.07 * (hA / 4 + hB / 1.5), 1e-9, 'T at base');
  const gA = (BH.tempAt(P, 800) - BH.tempAt(P, 200)) / 600, gB = (BH.tempAt(P, 2000) - BH.tempAt(P, 1200)) / 800;
  close(gA * 4, gB * 1.5, 1e-9, 'q equal in both layers'); close(gA * 4, 0.07, 1e-9, 'q');
});
test('time-varying heat flow is interpolated; surface temperature table is used', () => {
  const th = { on: true, q0: 60, Ts0: 10, table: [[100, 80, 20], [0, 40, 5]] };
  close(BH.qAt(th, 50), 60, 1e-12, 'q at 50 Ma'); close(BH.tsAt(th, 50), 12.5, 1e-12, 'Ts'); close(BH.qAt(th, 150), 80, 1e-12, 'clamp');
});

// ---- EASY%Ro agrees with the maturity page
test('EASY%Ro of the burial page equals the function of the maturity page (same table, same integration): constant heating', () => {
  const rows = [{ t: 100, T: 20 }, { t: 0, T: 200 }];
  const a = BH.easyRo(rows), b = DG.integrate(rows, true, false, [DG.EASY]).filter(q => q.node >= 0).map(q => q.Ro.easy);
  assert.equal(a.length, b.length); a.forEach((v, i) => close(v, b[i], 1e-12, 'node ' + i));
  assert.equal(JSON.stringify([...BH.EASY.EA]), JSON.stringify([...DG.EASY.EA])); assert.equal(JSON.stringify([...BH.EASY.FR]), JSON.stringify([...DG.EASY.FR])); assert.equal(BH.EASY.A, DG.EASY.A);
});
test('EASY%Ro equals the maturity page on a burial / uplift history with an instantaneous change', () => {
  const rows = [{ t: 150, T: 15 }, { t: 90, T: 95 }, { t: 90, T: 100 }, { t: 40, T: 160 }, { t: 10, T: 80 }, { t: 0, T: 60 }];
  const a = BH.easyRo(rows), b = DG.integrate(rows, true, false, [DG.EASY]).filter(q => q.node >= 0).map(q => q.Ro.easy);
  a.forEach((v, i) => close(v, b[i], 1e-12, 'node ' + i)); close(a[a.length - 1], DG.integrate(rows, true, false, [DG.EASY]).at(-1).Ro.easy, 1e-12, 'final');
});
test('page run(): %Ro of a material point equals easyRo of its own temperature history; never decreases; 0.5 %Ro at plausible depth', () => {
  const R = BH.run(model([U('A', 0, 1200, 60, 0, 'sandstone'), U('B', 1200, 3000, 150, 60, 'shale')], { thermal: { on: true, q0: 60, Ts0: 10, kmode: 'geo', table: [] }, dt: 5 }));
  const p = R.pts.find(q => q.el === 1 && q.s === 0);
  const idx = []; R.times.forEach((t, i) => { if (fin(p.T[i])) idx.push(i) });
  const ro = BH.easyRo(idx.map(i => ({ t: R.times[i], T: p.T[i] })));
  idx.forEach((i, j) => close(p.Ro[i], ro[j], 1e-12, 'Ro'));
  for (let j = 1; j < ro.length; j++) assert.ok(ro[j] >= ro[j - 1] - 1e-12, 'Ro decreases');
  assert.ok(p.RoEnd > 0.5 && p.RoEnd < 3, 'Ro at 3000 m with 60 mW/m2: ' + p.RoEnd);
});

// ---- example, parsing, Monte Carlo
const parsed = BH.parseColumn(BH.EXAMPLE, L0);
const exModel = () => model(parsed.rows, { thermal: { on: true, q0: 60, Ts0: 12, kmode: 'geo', table: [[215, 75, NaN], [150, 65, NaN], [100, 58, NaN], [0, 55, NaN]] }, sl: [[0, 0], [30, 40], [90, 120], [150, 60], [215, 0]], dt: 2 });
test('example column parses: 9 rows, 1 eroded section, no unknown lithology', () => {
  assert.equal(parsed.rows.length, 9); assert.equal(parsed.errs.length, 0); assert.equal(parsed.rows.filter(r => r.kind === 'E').length, 1);
  const hl = BH.parseColumn('unit;top;base;age base;age top;lith\nX;0;100;10;0;sand\nY;100;300;30;10;mudstone', L0); assert.equal(hl.errs.length, 0); assert.equal(hl.rows[0].lith, 'sandstone'); assert.equal(hl.rows[1].lith, 'shale');
});
test('example runs without NaN: depths, thicknesses, Y, temperatures, %Ro, summary, rates; present-day depths reproduced', () => {
  const R = BH.run(exModel()); assert.equal(R.errors.length, 0);
  const nt = R.times.length;
  R.el.forEach((e, k) => { for (let i = 0; i < nt; i++) { assert.ok(!(fin(e.top[i]) !== fin(e.base[i])), 'half-defined'); if (fin(e.top[i])) assert.ok(e.base[i] >= e.top[i] - 1e-9, e.name) } });
  for (let i = 0; i < nt; i++) { assert.ok(fin(R.Sed[i]) && fin(R.wd[i]) && fin(R.sl[i]) && fin(R.q[i]) && fin(R.Ts[i])); if (R.Sed[i] > 1e-6) assert.ok(fin(R.Y[i]) && fin(R.rhoBar[i]), 'Y at ' + R.times[i]) }
  assert.ok(R.pts.length === 8 * 5 + 0 || R.pts.length === 8 * 5, 'material points');
  for (const p of R.pts) for (let i = 0; i < nt; i++) assert.ok(fin(p.T[i]) === fin(p.Ro[i]) && (!fin(p.T[i]) || (p.T[i] > -5 && p.T[i] < 400 && p.Ro[i] > 0.19 && p.Ro[i] < 5)), 'point');
  for (const o of BH.summary(R)) for (const k of ['top0', 'base0', 'thick0', 'S', 'dur', 'thickEnd', 'rateDec', 'rateSolid', 'maxBase', 'tMax', 'Tmax', 'RoEnd', 'Tnow']) assert.ok(fin(o[k]), `${o.name} ${k}`);
  for (const r of BH.rates(R)) assert.ok(fin(r.rate) && (fin(r.rateY) || !(fin(r.Y0) && fin(r.Y1))));
  R.el.forEach((e, k) => { if (e.kind === 'U') { close(e.top[nt - 1], parsed.rows[k].top, 1e-6, e.name + ' top'); close(e.base[nt - 1], parsed.rows[k].base, 1e-6, e.name + ' base') } });
  assert.ok(R.pts.every(p => p.s !== undefined)); assert.ok(R.prof0.Y.every(fin) && R.prof0.T.every(fin));
});
test('example: eroded section is 350 m decompacted at erosion start (28 Ma) and gone at 23 Ma; solid thickness of the whole column conserved at 0 Ma', () => {
  const R = BH.run(exModel()), nt = R.times.length, g = R.el[2];
  const i28 = R.times.findIndex(t => t === 28), i23 = R.times.findIndex(t => t === 23);
  close(g.base[i28] - g.top[i28], 350, 1e-6, 'ghost at 28 Ma'); close(g.base[i23] - g.top[i23], 0, 1e-6, 'ghost at 23 Ma');
  close(sumSolid(R, nt - 1), R.els.filter(e => e.kind === 'U').reduce((s, e) => s + e.S, 0), 1e-6, 'solid');
});
test('Monte Carlo: reproducible for a seed, different for another seed, ordered percentiles, sigma 0 collapses on the base run', () => {
  const m = exModel(), o = { el: 1, lith: 'shale', sigmaQ: .1, sigmaC: .1, n: 25, seed: 7 };
  const a = BH.monteCarlo(m, o), b = BH.monteCarlo(m, o), c = BH.monteCarlo(m, { ...o, seed: 8 });
  assert.equal(a.errors.length, 0); assert.equal(JSON.stringify(a.Tmax), JSON.stringify(b.Tmax)); assert.notEqual(JSON.stringify(a.Tmax), JSON.stringify(c.Tmax));
  assert.ok(a.TmaxP[0] <= a.TmaxP[1] && a.TmaxP[1] <= a.TmaxP[2] && a.TmaxP[0] < a.TmaxP[2]); assert.ok(a.RoP[0] < a.RoP[2]);
  const base = BH.run(m, { only: { el: 1, s: .5 } }).pts[0], z = BH.monteCarlo(m, { ...o, sigmaQ: 0, sigmaC: 0, n: 5 });
  close(z.TmaxP[0], base.Tmax, 1e-9, 'P10 sigma 0'); close(z.TmaxP[2], base.Tmax, 1e-9, 'P90 sigma 0'); close(z.RoP[1], base.RoEnd, 1e-9, 'Ro sigma 0');
  // higher heat flow gives hotter and more mature
  const hot = JSON.parse(JSON.stringify(m)); hot.thermal.qScale = 1.2; const h = BH.run(hot, { only: { el: 1, s: .5 } }).pts[0]; assert.ok(h.Tmax > base.Tmax && h.RoEnd > base.RoEnd);
});
test('invalid input is reported, not thrown: base shallower than top, unknown lithology', () => {
  assert.ok(BH.run(model([U('A', 500, 100, 10, 0, 'shale')])).errors.length > 0);
  assert.ok(BH.parseColumn('A,0,100,10,0,granite', L0).errs.length > 0);
});

let fail = 0;
for (const [name, fn] of tests) { try { fn(); console.log('ok   ', name); } catch (e) { fail++; console.log('FAIL ', name, '\n     ', e.message); } }
console.log(`\n${tests.length - fail}/${tests.length} checks passed`);
process.exit(fail ? 1 : 0);
