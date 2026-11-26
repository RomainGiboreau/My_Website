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
const GOLD = { mean: 90.11648448554068, sd: 805.9849146776662, pNone: 0.4627 }; // example(false), n 20000, recorded before play correlation / learning existed
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

test('Prospect risking summary is preferred when present, else the current computation; a bad summary falls back', () => {
  const d = R.defaults(), base = P.fromRisking(d, 'X');
  d.summary = { p90: 10, p50: 30, p10: 100, mean: 45, gcos: .2, pPlay: .5, pPros: .4, mefv: 33 };
  const a = P.fromRisking(d, 'X'); assert.equal(a.p90, 10); assert.equal(a.p50, 30); assert.equal(a.p10, 100); assert.equal(a.pPlay, .5); assert.equal(a.pPros, .4); assert.equal(a.mefv, 33); assert.equal(a.D, base.D);
  d.vol.mode = 'vol'; d.summary = { p90: 7, p50: 21, p10: 60 }; const b = P.fromRisking(d); assert.equal(b.p50, 21); near(b.pPlay, base.pPlay, 1e-12);
  d.summary = { p90: 'x', p50: -1 }; const c = P.fromRisking(d); assert.ok(c.p90 > 0 && c.p90 < c.p50 && c.p50 < c.p10);
  const d2 = R.defaults(); d2.summary = { mefv: 0 }; assert.equal(P.fromRisking(d2).p50, 60);
});
test('fdp-link file: the prospect takes its MEFV, F = mefv x u, marker kept, clear restores F / u; wrong files rejected', () => {
  const p = one({ u: 8, F: 300 }), link = { format: 'fdp-link', version: 1, name: 'Dev A', mefv: 25, breakeven: 55, utc: 12, capex: 400, npv: 90, reserves: 40, price: 70 };
  P.applyFdp(p, link); assert.equal(p.mefv, 25); assert.equal(p.F, 200); assert.equal(p.fdp.name, 'Dev A');
  const f = P.figures(p, .5); near(f.mef, 25, 1e-12); near(f.F, 200, 1e-12);
  const g = P.figures(one({ u: 8, F: 300 }), .5); assert.ok(g.mef > 25);
  P.clearFdp(p); assert.equal(p.fdp, undefined); near(P.figures(p, .5).mef, 200 / 8, 1e-9);
  assert.throws(() => P.applyFdp(one(), { format: 'x', mefv: 3 })); assert.throws(() => P.applyFdp(one(), { format: 'fdp-link', mefv: 0 }));
});
test('play correlation 0 reproduces the previous results exactly (same seed)', () => {
  const M = P.example(false), a = P.simulate(M, { n: 20000 }), b = P.simulate(Object.assign({}, M, { rhoPlay: 0, learn: 1 }), { n: 20000 });
  assert.equal(a.mean, b.mean); assert.equal(a.sd, b.sd); assert.equal(a.pNone, b.pNone); assert.deepEqual(a.countDist, b.countDist);
  // golden value recorded before the feature existed
  assert.equal(a.pNone, GOLD.pNone); assert.equal(a.mean, GOLD.mean);
});
test('play correlation raises P(no play succeeds) and the spread, marginal play chances unchanged', () => {
  const ps = ['A', 'B', 'C'].map(k => one({ name: k, play: k, pPros: .6 })), M = port(ps, { plays: { A: .4, B: .4, C: .4 }, rho: 0, n: 100000 });
  const r0 = P.simulate(M), r5 = P.simulate(Object.assign({}, M, { rhoPlay: .5 })), r9 = P.simulate(Object.assign({}, M, { rhoPlay: .9 }));
  near(r0.pNoPlay, .6 ** 3, .01); assert.ok(r5.pNoPlay > r0.pNoPlay + .05 && r9.pNoPlay > r5.pNoPlay + .05, [r0.pNoPlay, r5.pNoPlay, r9.pNoPlay].join());
  assert.ok(r5.sd > r0.sd * 1.02 && r9.sd > r5.sd * 1.02, [r0.sd, r5.sd, r9.sd].join());
  for (const r of [r5, r9]) for (const k of 'ABC') near(r.playFreq[k], .4, .01, 'marginal ' + k);
  near(r9.mean, r0.mean, 4 * r9.sd / Math.sqrt(r9.n), 'expected value unchanged');
});
// exact enumeration of a play with sequential learning: odds of the prospect chance x k per earlier discovery, / k per dry hole
function exactLearn(c, ps, k) {
  const go = (i, mult, pDry) => { if (i === ps.length) return { allDry: 1, disc: 0 };
    const od = ps[i] / (1 - ps[i]) * mult, p = od / (1 + od), a = go(i + 1, mult * k, 0), b = go(i + 1, mult / k, 0);
    return { allDry: (1 - p) * b.allDry, disc: p * (1 + a.disc) + (1 - p) * b.disc } };
  const x = go(0, 1); return { pNone: (1 - c) + c * x.allDry, meanDisc: c * x.disc };
}
const lp = (n, pp, c) => port(Array.from({ length: n }, (_, i) => one({ name: 'L' + i, pPros: pp, F: 0, u: 9, mefv: null })), { plays: { P: c }, rho: 0, n: 200000 });
test('learning factor 1 reproduces the previous results (golden values)', () => {
  const a = P.simulate(P.example(false), { n: 20000 }), b = P.simulate(Object.assign(P.example(false), { learn: 1 }), { n: 20000 });
  assert.equal(a.mean, b.mean); assert.equal(a.mean, GOLD.mean); assert.equal(a.sd, GOLD.sd);
});
test('learning, two prospects: simulation matches the exact enumeration', () => {
  for (const [pp, k] of [[.4, 3], [.6, 2.5], [.5, .5]]) {
    const M = Object.assign(lp(2, pp, .7), { learn: k }), s = P.simulate(M), ex = exactLearn(.7, [pp, pp], k);
    near(s.pNone, ex.pNone, .006, 'pNone ' + pp + ' ' + k); near(s.meanDisc, ex.meanDisc, .008, 'meanDisc ' + pp + ' ' + k);
  }
});
test('learning, three prospects: matches enumeration; a factor above 1 clusters outcomes (P(>=1 discovery) falls, P(all 3) rises), below 1 spreads them', () => {
  const M1 = lp(3, .5, 1), M3 = Object.assign(lp(3, .5, 1), { learn: 3 }), Mh = Object.assign(lp(3, .5, 1), { learn: 1 / 3 }), s1 = P.simulate(M1), s3 = P.simulate(M3), sh = P.simulate(Mh);
  const e1 = exactLearn(1, [.5, .5, .5], 1), e3 = exactLearn(1, [.5, .5, .5], 3), eh = exactLearn(1, [.5, .5, .5], 1 / 3);
  // the first prospect is not affected, a dry hole lowers the next chances: with k > 1 the all-dry path is more likely, so P(>= 1) can only fall
  assert.ok(e3.pNone > e1.pNone && eh.pNone < e1.pNone, 'exact ordering');
  near(s1.pNone, e1.pNone, .004); near(s3.pNone, e3.pNone, .004); near(sh.pNone, eh.pNone, .004);
  assert.ok(s3.pNone > s1.pNone + .1 && sh.pNone < s1.pNone - .05);
  assert.ok(s3.countDist[3] > s1.countDist[3] + .1, 'all three discoveries more likely with learning');
});
test('with learning on the Monte Carlo mean differs from the sum of the EMVs; it equals it with factor 1', () => {
  const M = Object.assign(lp(3, .7, .8), { learn: 4 }), pc = P.playChances(M), sum = M.prospects.reduce((a, p) => a + P.figures(p, pc.P).emv, 0), s = P.simulate(M), s1 = P.simulate(Object.assign({}, M, { learn: 1 }));
  assert.ok(Math.abs(s.mean - sum) > 6 * s.sd / Math.sqrt(s.n), 'not additive'); near(s1.mean, sum, 4 * s1.sd / Math.sqrt(s1.n));
});
test('selection CSV lists only the drilled prospects with totals', () => {
  const M = port([one({ name: 'A,1' }), one({ name: 'B', on: false }), one({ name: 'C' })], { plays: { P: .5 } }), c = P.selectionCsv(M).trim().split(/\r?\n/);
  assert.equal(c.length, 4); assert.ok(c[1].startsWith('"A,1",P,0.5')); assert.ok(c[2].startsWith('C,') && c[3].startsWith('total,'));
  const f = P.figures(M.prospects[0], .5); near(+c[3].split(',')[7], 2 * f.emv, 1e-9);
});
console.log(`${n}/${n} passed`);
