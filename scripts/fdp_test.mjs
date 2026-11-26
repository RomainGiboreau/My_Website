// Self-check for the field development screening core (docs/fdp/index.html, <script id="fdp-core">).
// Run: node scripts/fdp_test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../docs/fdp/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="fdp-core">([\s\S]*?)<\/script>/); assert.ok(m, 'fdp-core block not found');
const w = {}; new Function('window', m[1])(w); const F = w.FDP;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok   ' + name); };
const base = (o = {}) => F.clean(Object.assign({}, F.defaults(), o));

test('the solved profile produces the reserves (0.5 %) for plateau and decline cases', () => {
  for (const o of [{}, { b: 0 }, { b: 1 }, { plateauFrac: .6, reserves: 50 }, { plateauFrac: 0, qmin: 0 }, { wells: 3 }]) {
    const p = base(o), pr = F.profile(p); near(pr.cum, p.reserves, .005 * p.reserves, JSON.stringify(o));
  }
});
test('plateau = min(target, wells x rate); plateau length reflects the plateau fraction', () => {
  const p = base({ wells: 3, wellIP: 8, plateau: 40, ramp: 0, plateauFrac: .3 }), pr = F.profile(p); assert.equal(pr.qpl, 24);
  assert.ok(pr.q.slice(0, 5).every(x => x === 24));
  const n24 = pr.q.filter(x => x === 24).length; near(n24 * 24 * F.DPM / 1000, .3 * p.reserves, 24 * F.DPM / 1000 + 1e-6);
});
test('exponential decline without plateau and economic limit: Di = q0 / EUR (closed form)', () => {
  const p = base({ plateauFrac: 0, b: 0, qmin: 0, ramp: 0, plateau: 20, wells: 10, wellIP: 5, reserves: 60 }), pr = F.profile(p);
  near(pr.Di, 20 * 365.25 / 1000 / 60, 0.01 * pr.Di + 1e-3);
});
test('no fiscal terms, no discounting, one capex lump: NPV = price x reserves - costs', () => {
  const p = base({ royalty: 0, tax: 0, disc: 0, opexFixed: 0, opexVar: 0, abex: 0, phasing: [100], facilities: 500, wellCost: 0, price: 50 }), r = F.economics(p);
  near(r.npv, 50 * r.total - 500, 1e-6); near(r.total, p.reserves, .005 * p.reserves);
});
test('royalty and tax lower the NPV; losses are carried forward (no tax while the cumulative taxable income is negative)', () => {
  assert.ok(F.economics(base({ royalty: 10, tax: 35 })).npv < F.economics(base({ royalty: 0, tax: 0 })).npv);
  const p = base({ tax: 50, royalty: 0, dep: 5 }), r = F.economics(p), cap = p.facilities + p.wells * p.wellCost, m0 = 12 * p.phasing.length;
  let ti = 0, bad = 0;
  for (const x of r.rows) { ti += x.rev - x.royal - x.opex - (x.m >= m0 && x.m < m0 + 60 ? cap / 60 : 0); if (x.tax > 0 && ti < -1e-6) bad++ }
  assert.equal(bad, 0); assert.ok(r.rows.some(x => x.tax > 0));
});
test('IRR: flows -100 at month 0 and +110 twelve months later give the rate that equates them at mid-month discounting; no sign change gives NaN', () => {
  const cf = [-100, ...Array(11).fill(0), 110], x = F.irr(cf);
  near(Math.pow(1 + x, -(12.5) / 12) * 110 + Math.pow(1 + x, -(.5) / 12) * -100, 0, 1e-6);
  near(x, .1, 1e-6); assert.ok(Number.isNaN(F.irr([-1, -1, -1])));
});
test('break-even price and MEFV return NPV = 0; NPV rises with price and with reserves', () => {
  const p = base(), be = F.breakeven(p), mv = F.mefv(p);
  near(F.economics(Object.assign({}, p, { price: be })).npv, 0, 1e-3); near(F.economics(Object.assign({}, p, { reserves: mv })).npv, 0, 1e-2);
  assert.ok(be > 0 && be < p.price, 'the base case is profitable'); assert.ok(mv > 0 && mv < p.reserves);
  assert.ok(F.economics(Object.assign({}, p, { price: p.price + 10 })).npv > F.economics(p).npv);
});
test('sensitivities: base NPV matches, price and capex move NPV the right way; ranked by swing', () => {
  const p = base(), s = F.sensitivities(p), g = n => s.items.find(i => i.name.startsWith(n));
  near(s.base, F.economics(p).npv, 1e-9); assert.ok(g('Oil price').hi > s.base && g('Oil price').lo < s.base); assert.ok(g('Capex').hi > s.base && g('Capex').lo < s.base);
  for (let i = 1; i < s.items.length; i++) assert.ok(s.items[i].swing <= s.items[i - 1].swing + 1e-9);
});
test('annual aggregation conserves volume and cash flow; run() is complete on the defaults', () => {
  const r = F.run(F.defaults()), A = r.ann; near(A.reduce((a, x) => a + x.prod, 0), r.res.total, 1e-9); near(A.reduce((a, x) => a + x.cf, 0), r.res.rows.reduce((a, x) => a + x.cf, 0), 1e-6);
  assert.ok(r.res.npv > 0 && isFinite(r.res.irr) && isFinite(r.res.payback) && r.res.peak > 0);
});
// ---- 1. interchange file ----
test('fdp-link: exact format, values consistent with the computed tiles', () => {
  const p = base({ name: 'Test field' }), L = F.link(p), r = F.economics(p);
  assert.deepEqual(Object.keys(L), ['format', 'version', 'name', 'mefv', 'breakeven', 'utc', 'capex', 'npv', 'reserves', 'price']);
  assert.equal(L.format, 'fdp-link'); assert.equal(L.version, 1); assert.equal(L.name, 'Test field');
  near(L.mefv, F.mefv(p), 1e-9); near(L.breakeven, F.breakeven(p), 1e-9); near(L.utc, r.utc, 1e-12); near(L.capex, p.facilities + p.wells * p.wellCost, 1e-9);
  near(L.npv, r.npv, 1e-9); assert.equal(L.reserves, p.reserves); assert.equal(L.price, p.price);
  const back = JSON.parse(JSON.stringify(L)); assert.deepEqual(back, L);
  near(F.economics(Object.assign({}, p, { reserves: L.mefv })).npv, 0, 1e-2);
});
// ---- 2. Monte Carlo ----
const deg = m => ({ min: m, mode: m, max: m });
test('Monte Carlo: degenerate distributions return the base NPV in every trial', () => {
  const p = base(), r = F.mc(p, { n: 20, reserves: deg(100), price: deg(100), capex: deg(100), opex: deg(100) }), b = F.economics(p).npv;
  assert.ok(r.vals.every(v => Math.abs(v - b) < 1e-6)); near(r.mean, b, 1e-6); near(r.p50, b, 1e-6); near(r.sd, 0, 1e-4); assert.equal(r.pNeg, 0); near(r.base, b, 1e-9);
});
test('Monte Carlo: price only, no tax, no royalty: the mean NPV equals the NPV at the mean price (NPV linear in price)', () => {
  const p = base({ royalty: 0, tax: 0 }), d = { min: 60, mode: 90, max: 150 }, r = F.mc(p, { n: 4000, seed: 7, reserves: deg(100), price: d, capex: deg(100), opex: deg(100) });
  const pm = p.price * (d.min + d.mode + d.max) / 300, ana = F.economics(Object.assign({}, p, { price: pm })).npv;
  near(r.mean, ana, 4 * r.sd / Math.sqrt(r.n), 'mean vs analytic');
  assert.ok(r.p90 < r.p50 && r.p50 < r.p10, 'P90 < P50 < P10'); assert.ok(r.sd > 0);
});
test('Monte Carlo: seeded and reproducible; P(NPV<0) is the fraction of negative trials; histogram holds every trial', () => {
  const p = base({ price: 40 }), a = F.mc(p, { n: 300, seed: 3 }), b = F.mc(p, { n: 300, seed: 3 }), c = F.mc(p, { n: 300, seed: 4 });
  assert.deepEqual(a.vals, b.vals); assert.notDeepEqual(a.vals, c.vals);
  near(a.pNeg, a.vals.filter(v => v < 0).length / 300, 1e-12); assert.ok(a.pNeg > 0 && a.pNeg < 1, 'price 40 straddles zero: ' + a.pNeg);
  assert.equal(a.hist.counts.reduce((s, x) => s + x, 0), 300);
});
test('Monte Carlo: lognormal reserves from P90 / P50 / P10 reproduce the quantiles; triangular sampler has the right mean', () => {
  const p = base(), ln = { on: true, p90: 80, p50: 120, p10: 190 }, d = deg(100), r = F.mc(p, { n: 3000, seed: 5, ln, price: d, capex: d, opex: d });
  assert.ok(r.lnUsed); const q = F.mc(Object.assign({}, p), { n: 1, ln }); assert.ok(q.lnUsed);
  // NPV is monotonic in reserves here, so the NPV quantiles are the NPVs at the reserves quantiles
  for (const [k, res] of [['p90', 80], ['p50', 120], ['p10', 190]]) near(r[k], F.economics(Object.assign({}, p, { reserves: res })).npv, 0.06 * Math.abs(r.p10 - r.p90), k);
  const R = F.rng(9); let s = 0; const N = 20000; for (let i = 0; i < N; i++) s += F.tri(R(), 70, 100, 140); near(s / N, 310 / 3, .6);
});
test('Monte Carlo: 2000 trials of the default case finish in a few seconds', () => {
  const t = Date.now(), r = F.mc(base(), { n: 2000 }); assert.equal(r.vals.length, 2000); assert.ok(Date.now() - t < 20000, 'took ' + (Date.now() - t) + ' ms');
});
// ---- 3. production-sharing contract ----
const psc = (o = {}) => base(Object.assign({ regime: 'psc', pscTax: 0 }, o));
test('PSC: ceiling 100 % and contractor share 100 % without tax equals the pre-tax, royalty-free NPV of the royalty / tax regime', () => {
  const a = F.economics(psc({ pscCeiling: 100, pscShare: 100, pscShare2: 100 })), b = F.economics(base({ royalty: 0, tax: 0 }));
  near(a.npv, b.npv, 1e-6); near(a.gov, 0, 1e-6);
});
test('PSC: conservation, contractor cash flow + government take = revenue - costs paid, month by month and in total', () => {
  for (const o of [{}, { pscTax: 30 }, { pscCeiling: 30, pscShare: 20, pscTax: 25 }, { pscR: 0, pscCeiling: 100 }]) {
    const r = F.economics(psc(o)); let ok = 0;
    for (const x of r.rows) { near(x.cf + x.gov, x.rev - x.opex - x.capex - x.abex, 1e-6, JSON.stringify(o) + ' m' + x.m); ok++ }
    const tot = k => r.rows.reduce((s, x) => s + x[k], 0); near(tot('cf') + r.gov, tot('rev') - tot('opex') - tot('capex') - tot('abex'), 1e-6);
    const ce = (o.pscCeiling ?? 60) / 100; assert.ok(r.rows.every(x => x.co <= ce * x.rev + 1e-9), 'cost oil within the ceiling'); near(tot('ent') + tot('pog'), tot('rev'), 1e-6, 'contractor entitlement + government profit oil = revenue');
    const costs = tot('opex') + tot('capex') + tot('abex'); assert.ok(tot('co') <= costs + 1e-6, 'cost oil never exceeds the costs'); near(tot('co') + r.unrecovered, costs, 1e-6, 'cost oil + unrecovered pool = costs');
    assert.ok(ok > 100);
  }
});
test('PSC: the contractor NPV decreases when the government profit-oil share increases; the government take increases', () => {
  let prevN = Infinity, prevG = -Infinity;
  for (const sh of [100, 80, 60, 40, 20]) { const r = F.economics(psc({ pscShare: sh, pscShare2: sh, pscTax: 20 })); assert.ok(r.npv < prevN, 'npv at ' + sh); assert.ok(r.govPV > prevG); prevN = r.npv; prevG = r.govPV }
  const lowCeil = F.economics(psc({ pscCeiling: 20 })).npv, hiCeil = F.economics(psc({ pscCeiling: 80 })).npv; assert.ok(lowCeil < hiCeil, 'a lower ceiling delays cost recovery');
});
test('PSC: the R-factor tier applies the second contractor share only once R reaches the threshold', () => {
  const lo = F.economics(psc({ pscR: 1e6, pscShare: 50, pscShare2: 10 })), hi = F.economics(psc({ pscR: 1e-3, pscShare: 50, pscShare2: 10 })), off = F.economics(psc({ pscR: 0, pscShare: 50, pscShare2: 10 }));
  near(lo.npv, off.npv, 1e-9, 'threshold never reached = single tier'); assert.ok(hi.npv < lo.npv, 'tier reached early lowers the contractor NPV');
  const r = F.economics(psc({ pscR: 1.5, pscShare: 50, pscShare2: 10 })); assert.ok(r.rows.some(x => x.Rf >= 1.5) && r.rows.some(x => x.Rf > 0 && x.Rf < 1.5));
  assert.ok(F.economics(psc({ pscR: 1.5, pscShare: 50, pscShare2: 10 })).npv < lo.npv && F.economics(psc({ pscR: 1.5, pscShare: 50, pscShare2: 10 })).npv > hi.npv - 1e-9);
});
test('PSC: break-even price, MEFV and sensitivities work under the production-sharing regime; royalty / tax results are unchanged by the PSC fields', () => {
  const p = psc({ pscShare: 40, pscShare2: 40, pscTax: 10 }), be = F.breakeven(p); near(F.economics(Object.assign({}, p, { price: be })).npv, 0, 1e-3);
  assert.ok(isFinite(F.sensitivities(p).base)); const a = F.economics(base()).npv, b = F.economics(base({ pscCeiling: 5, pscShare: 1, pscTax: 90 })).npv; near(a, b, 1e-12);
  assert.equal(F.clean({ regime: 'zzz' }).regime, 'rt');
});
// ---- 4. drilling schedule ----
test('drilling schedule: plateau capacity = wells online x rate, rising each year; one lump of wells equals the fixed number', () => {
  const p = base({ wellMode: 'sched', drill: [2, 2, 2], wellIP: 8, plateau: 100, ramp: 0, plateauFrac: .6, wells: 99 }), pr = F.profile(p);
  assert.equal(F.wellsOn(p, 0), 2); assert.equal(F.wellsOn(p, 1), 4); assert.equal(F.wellsOn(p, 5), 6); assert.equal(F.wellsTot(p), 6); assert.equal(pr.qpl, 48);
  assert.ok(pr.q[0] === 16 && pr.q[11] === 16 && pr.q[12] === 32 && pr.q[24] === 48, 'steps 16, 32, 48');
  near(pr.cum, p.reserves, .005 * p.reserves);
  const a = F.economics(base({ wellMode: 'sched', drill: [6], wells: 1 })), b = F.economics(base({ wells: 6 })); near(a.npv, b.npv, 1e-9); near(a.capTot, b.capTot, 1e-9);
});
test('drilling schedule: later wells are paid when drilled (not before first oil); a slower ramp-up lowers NPV; total capex counts every well', () => {
  const s = base({ wellMode: 'sched', drill: [2, 2, 2] }), f = base({ wells: 6 }), rs = F.economics(s), rf = F.economics(f), m0 = 36;
  near(rs.capTot, s.facilities + 6 * s.wellCost, 1e-9); near(rs.rows.reduce((a, x) => a + x.capex, 0), rs.capTot, 1e-6);
  near(rs.rows.filter(x => x.m < m0).reduce((a, x) => a + x.capex, 0), s.facilities + 2 * s.wellCost, 1e-6);
  near(rs.rows.filter(x => x.m >= m0 && x.m < m0 + 12).reduce((a, x) => a + x.capex, 0), 2 * s.wellCost, 1e-6);
  assert.ok(rs.npv < rf.npv, 'late wells reduce NPV when plateau is capacity-limited: ' + rs.npv + ' vs ' + rf.npv);
  assert.deepEqual(F.clean({ wellMode: 'sched', drill: ['x'] }).drill, F.defaults().drill);
});
console.log(`${n}/${n} passed`);
