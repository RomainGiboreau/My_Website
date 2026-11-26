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
console.log(`${n}/${n} passed`);
