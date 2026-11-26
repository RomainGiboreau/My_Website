// Self-check for the portfolio consolidation core (docs/portfolio/index.html, <script id="pf-core">).
// Run: node scripts/portfolio_test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../docs/portfolio/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="pf-core">([\s\S]*?)<\/script>/); assert.ok(m, 'pf-core block not found');
const w = {}; new Function('window', m[1])(w); const P = w.PF;
const rk = readFileSync(new URL('../docs/risking/index.html', import.meta.url), 'utf8').match(/<script id="risk-core">([\s\S]*?)<\/script>/);
const wr = {}; new Function('window', rk[1])(wr); const R = wr.RISK;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok   ' + name); };
const one = (o = {}) => Object.assign({ name: 'A', play: 'P', pPlay: .5, pPros: .5, p90: 20, p50: 60, p10: 180, u: 9, F: 220, D: 45, mefv: null, on: true }, o);
const port = (ps, o = {}) => Object.assign(P.defaults(), { prospects: ps, n: 60000, seed: 3 }, o);

test('prospect figures agree with the Prospect risking tool', () => {
  const f = P.figures(one(), .5), r = R.run(Object.assign(R.defaults(), { elements: [{ level: 'play', p: .5 }, { level: 'prospect', p: .5 }] }));
  near(f.gcos, r.gcos, 1e-12); near(f.ecos, r.ecos, 1e-9); near(f.emv, r.emv, 1e-9);
});
test('import of a Prospect risking file keeps the chances, volumes and costs; a volumetric file becomes P90 / P50 / P10', () => {
  const d = R.defaults(), a = P.fromRisking(d, 'Play X');
  near(a.pPlay, .85 * .8 * .75, 1e-12); near(a.pPros, .7 * .75 * .8, 1e-12); assert.equal(a.p50, 60); assert.equal(a.D, 45); assert.equal(a.play, 'Play X');
  d.vol.mode = 'vol'; const b = P.fromRisking(d); assert.ok(b.p90 < b.p50 && b.p50 < b.p10 && P.figures(b, b.pPlay).err == null);
  assert.throws(() => P.fromRisking({ format: 'other' }));
});
test('single prospect: Monte Carlo mean NPV equals the analytic EMV (within 3 standard errors)', () => {
  const p = one({ pPlay: .6, pPros: .5 }), M = port([p], { plays: { P: .6 }, rho: 0 }), s = P.simulate(M), f = P.figures(p, .6);
  near(s.mean, f.emv, 3 * s.sd / Math.sqrt(s.n), 'emv'); near(s.meanEcon, f.ecos, .01, 'eCOS = P(economic discovery)');
});
test('portfolio: the Monte Carlo mean equals the sum of the EMVs, with and without dependence', () => {
  const M = P.example(false), pc = P.playChances(M), sum = M.prospects.reduce((a, p) => a + P.figures(p, pc[p.play]).emv, 0);
  for (const indep of [false, true]) { const s = P.simulate(M, { n: 120000, indep }); near(s.mean, sum, 4 * s.sd / Math.sqrt(s.n), 'indep ' + indep) }
});
test('a shared play raises the probability of no discovery and the spread, volume correlation raises the spread', () => {
  const ps = [0, 1, 2].map(i => one({ name: 'P' + i, pPros: .6 })), M = port(ps, { plays: { P: .4 }, rho: 0 }), dep = P.simulate(M), ind = P.simulate(M, { indep: true });
  assert.ok(dep.pNone > ind.pNone + .02, `${dep.pNone} ${ind.pNone}`); assert.ok(dep.sd > ind.sd * 1.1);
  const hi = P.simulate(Object.assign({}, M, { rho: .9 })); assert.ok(hi.sd > dep.sd * 1.05, `${hi.sd} ${dep.sd}`);
  near(dep.mean, ind.mean, 4 * dep.sd / Math.sqrt(dep.n), 'same expected value');
});
test('a prospect that is switched off is left out of the simulation; count distribution sums to 1', () => {
  const ps = [one({ name: 'A' }), one({ name: 'B', on: false })], s = P.simulate(port(ps, { plays: { P: .5 } }));
  assert.equal(s.np, 1); near(s.countDist.reduce((a, b) => a + b, 0), 1, 1e-12);
});
test('knapsack equals brute force on random cases', () => {
  const r = P.rng(5);
  for (let t = 0; t < 40; t++) {
    const k = 3 + Math.floor(r() * 7), items = Array.from({ length: k }, () => ({ D: 5 + Math.round(r() * 60) / 2, emv: r() < .15 ? -3 : 1 + r() * 80 })), B = 30 + Math.floor(r() * 120);
    const sel = P.optimise(items, B); let best = 0;
    for (let mask = 0; mask < 1 << k; mask++) { let d = 0, v = 0; for (let i = 0; i < k; i++) if (mask >> i & 1) { d += Math.round(items[i].D * 10); v += items[i].emv } if (d <= B * 10 && v > best) best = v }
    let d = 0, v = 0; sel.forEach((s, i) => { if (s) { d += Math.round(items[i].D * 10); v += items[i].emv } });
    assert.ok(d <= Math.floor(B * 10)); near(v, best, 1e-9, 'case ' + t);
  }
  assert.deepEqual(P.optimise([{ D: 10, emv: 5 }, { D: 10, emv: -1 }], Infinity), [true, false]);
});
test('play chance defaults to the mean of the imported prospects, a typed value wins', () => {
  const M = port([one({ pPlay: .4 }), one({ pPlay: .6, name: 'B' })]); near(P.playChances(M).P, .5, 1e-12);
  M.plays = { P: .9 }; near(P.playChances(M).P, .9, 1e-12);
});
console.log(`${n}/${n} passed`);
