// Self-check for the contact distribution and well POS core (docs/wellpos/index.html, <script id="ct-core">).
// Run: node scripts/wellpos_test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../docs/wellpos/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="ct-core">([\s\S]*?)<\/script>/); assert.ok(m, 'ct-core block not found');
const w = {}; new Function('window', m[1])(w); const C = w.CT;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok   ' + name); };
const mk = (limits, o = {}) => Object.assign(C.defaults(), { crest: 2000, base: 2400, zmax: 2500, pG: .4, n: 200000, seed: 7, limits }, o);
const U = (name, a, b, p = 1) => ({ name, kind: 'Other', p, dist: 'uniform', a, b });

test('a single certain limit gives a deterministic contact and a step POS', () => {
  const M = mk([{ name: 'Spill', p: 1, dist: 'fixed', a: 2200 }]), S = C.sample(M), s = C.summarize(S);
  assert.equal(s.p90, 2200); assert.equal(s.p50, 2200); assert.equal(s.p10, 2200); assert.equal(s.col.p50, 200); assert.equal(s.shares[0], 1);
  near(C.pos(S, .4, 2199), .4, 1e-12); assert.equal(C.pos(S, .4, 2200), 0); assert.equal(C.pos(S, .4, 2300), 0);
});
test('no active limit: the contact is the base case; a limit above the crest gives an empty trap at the crest', () => {
  const S = C.sample(mk([{ name: 'x', p: 0, dist: 'fixed', a: 2100 }])); assert.equal(C.summarize(S).p50, 2400); assert.equal(C.summarize(S).shares[1], 1);
  const T = C.sample(mk([{ name: 'x', p: 1, dist: 'fixed', a: 1900 }])); assert.equal(C.summarize(T).p50, 2000);
});
test('two uniform limits, both certain: Monte Carlo matches the closed form of the minimum and of the controlling share', () => {
  const a1 = 2100, b1 = 2300, a2 = 2150, b2 = 2250, M = mk([U('L1', a1, b1), U('L2', a2, b2)]), S = C.sample(M), s = C.summarize(S);
  const F = (x, a, b) => x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a), Fmin = x => 1 - (1 - F(x, a1, b1)) * (1 - F(x, a2, b2));
  for (const z of [2110, 2150, 2180, 2200, 2230, 2260]) { const p = 1 - Fmin(z); near(C.exceed(S, z), p, 4 * Math.sqrt(p * (1 - p) / S.n) + 1e-9, 'P(contact > ' + z + ')') }
  let q = 0; const N = 20000; for (let i = 0; i < N; i++) { const x = a1 + (i + .5) / N * (b1 - a1); q += (1 - F(x, a2, b2)) / N }   // P(L1 < L2) = integral of f1 (1 - F2)
  near(s.shares[0], q, 4 * Math.sqrt(q * (1 - q) / S.n), 'share L1'); near(s.shares[0] + s.shares[1], 1, 1e-12);
  let mu = a1; const K = 20000; for (let i = 0; i < K; i++) { const x = a1 + (i + .5) / K * (b1 - a1); mu += (1 - Fmin(x)) * (b1 - a1) / K } near(s.mean, mu, 1.0, 'mean');
});
test('controlling shares sum to 1 on the example, base share = prod(1 - p), percentiles ordered (P90 shallow)', () => {
  const M = C.example('a'); M.n = 100000; const S = C.sample(M), s = C.summarize(S), sum = s.shares.reduce((a, b) => a + b, 0);
  near(sum, 1, 1e-12); assert.ok(s.p90 < s.p50 && s.p50 < s.p10, `${s.p90} ${s.p50} ${s.p10}`); assert.ok(s.p90 >= M.crest);
  assert.equal(C.validate(M), null); assert.ok(C.validate(Object.assign({}, M, { base: 1900 })));
  const L = M.limits; let none = 1; for (const l of L) none *= 1 - l.p; near(s.shares[L.length], none, 4 * Math.sqrt(none * (1 - none) / S.n), 'base share');
});
test('POS(z) is non-increasing in z and equals P(G) above the shallowest possible contact', () => {
  const M = mk([U('L1', 2100, 2300, .7), U('L2', 2150, 2250, .5)], { base: 2400 }), S = C.sample(M), c = C.curve(S, .4, 2000, 2500, 200);
  for (let i = 1; i < c.length; i++) { assert.ok(c[i].pos <= c[i - 1].pos + 1e-15); assert.ok(c[i].F <= c[i - 1].F + 1e-15) }
  near(C.pos(S, .4, 2050), .4, 1e-12); near(C.pos(S, .4, 2099.9), .4, 1e-12); assert.ok(C.pos(S, .4, 2200) < .4); assert.equal(C.pos(S, .4, 2400.1), 0);
  near(c[0].F, 1, 1e-12);
});
test('the well proves the contact is at least z: conditional distribution, wet share, closed form', () => {
  const M = mk([U('L1', 2100, 2300)]), S = C.sample(M), z = 2150, p = C.proves(S, .4, z), cp = (2300 - z) / 200;
  near(p.pCond, cp, 4 * Math.sqrt(cp * (1 - cp) / S.n)); near(p.pSuccess, .4 * p.pCond, 1e-12); near(p.wetGivenG + p.pCond, 1, 1e-12); near(p.wetAbsolute, .4 * (1 - p.pCond), 1e-12);
  assert.ok(p.p90 > z); near(p.mean, (z + 2300) / 2, 1.5); near(p.shares.reduce((a, b) => a + b, 0), 1, 1e-12);
});
test('two wells: a success at the deeper depth implies success at the shallower one; probabilities add up', () => {
  const M = mk([U('L1', 2100, 2300, .8), { name: 'N', p: .6, dist: 'normal', a: 2200, b: 40 }]), S = C.sample(M), z1 = 2250, z2 = 2150;   // first is the deep well
  const t = C.twoWells(S, .4, z1, z2); near(t.secondGivenFirst, 1, 1e-12); near(t.both, t.p1, 1e-12); near(t.firstOnly, 0, 1e-12);
  near(t.both + t.firstOnly + t.secondOnly + t.neither, 1, 1e-12); near(t.p2, C.pos(S, .4, z2), 1e-12); near(t.p1, C.pos(S, .4, z1), 1e-12); near(t.failThenSucceed, t.p2 - t.p1, 1e-12);
  assert.ok(t.failThenSucceed > 0);
  const u = C.twoWells(S, .4, z2, z1);   // first is the shallow well
  near(u.firstGivenSecond, 1, 1e-12); assert.ok(u.secondGivenFirst < 1 && u.secondGivenFirst > 0); near(u.failThenSucceed, 0, 1e-12);
  near(u.secondGivenFirst, C.pos(S, .4, z1) / C.pos(S, .4, z2), 1e-12);   // P(deep | shallow) = P(deep) / P(shallow)
});
test('DHI: the update follows the Bayes odds rule and is invertible', () => {
  const o = .3 / .7 * 4; near(C.bayes(.3, 4), o / (1 + o), 1e-12); near(C.bayes(.3, 1), .3, 1e-15); assert.ok(C.bayes(.3, .5) < .3); assert.equal(C.bayes(0, 5), 0); assert.equal(C.bayes(1, 5), 1);
  near(C.bayes(C.bayes(.3, 4), .25), .3, 1e-12);
  const M = C.example('a'); M.dhi = { mode: 'class', cls: 'strong', table: { strong: 6, moderate: 3, weak: 1.5, absent: .4 }, value: 3 }; near(C.lrOf(M), 6, 0); M.dhi.mode = 'number'; M.dhi.value = 2; near(C.lrOf(M), 2, 0); M.dhi.mode = 'none'; near(C.lrOf(M), 1, 0);
});
test('truncated normal and triangular draws stay inside their bounds with the right centre', () => {
  const R = C.rng(5); let s = 0, t = 0; const N = 100000;
  for (let i = 0; i < N; i++) { const x = C.drawDepth({ dist: 'normal', a: 2200, b: 60 }, R(), 2100, 2300); assert.ok(x >= 2100 && x <= 2300); s += x; const y = C.drawDepth({ dist: 'triangular', a: 2100, b: 2150, c: 2300 }, R(), 2000, 2500); assert.ok(y >= 2100 && y <= 2300); t += y }
  near(s / N, 2200, 1); near(t / N, (2100 + 2150 + 2300) / 3, 1);
});
test('same seed, same result; different seed, different draws', () => {
  const M = C.example('a'); const a = C.summarize(C.sample(M)), b = C.summarize(C.sample(M)); assert.deepEqual(a, b); assert.notEqual(C.summarize(C.sample(M, { seed: 99 })).mean, a.mean);
});
test('gross rock volume: a cone-shaped table matches the closed form, a prism and a linear area match exactly, contact percentiles read the volume', () => {
  const z0 = 2000, H = 300, A0 = 12, pts = []; for (let z = z0; z <= z0 + H; z += 10) pts.push([z, A0 * ((z - z0) / H) ** 2]);
  const T = C.grvTable(pts), cone = c => A0 / (H * H) * (c - z0) ** 3 / 3;
  for (const c of [2050, 2100, 2137, 2200, 2299]) near(C.grv(T, c), cone(c), 0.002 * cone(z0 + H), 'cone ' + c);
  assert.equal(C.grv(T, 1990), 0); near(C.grv(T, 9999), C.grv(T, z0 + H), 1e-9);
  const P = C.grvTable([[2000, 5], [2400, 5]]); near(C.grv(P, 2123), 5 * 123, 1e-9);
  const L = C.grvTable([[2000, 0], [2400, 8]]); near(C.grv(L, 2200), 0.5 * 4 * 200, 1e-9);
  const S = C.sample(mk([U('L1', 2100, 2300)])), g = C.grvStats(S, T); assert.ok(g.p90 < g.p50 && g.p50 < g.p10); near(g.p50, C.grv(T, C.pctOf(S.sorted, .5)), 1e-12);
  let mu = 0; for (let i = 0; i < 20000; i++) mu += cone(2100 + (i + .5) / 20000 * 200) / 20000; near(g.mean / mu, 1, 0.01, 'mean GRV'); near(g.clipped, 0, 0);
  const t = C.parseTable('depth, area\n2000, 0\n2100\t4\n2200 ; 9\n'); assert.equal(t.err, null); assert.equal(t.pts.length, 3); assert.ok(C.parseTable('2000, 1').err);
});
test('import of a Prospect risking file: summary.gcos preferred, else the product of the element chances', () => {
  const a = C.fromRisking({ format: 'prospect-risk', name: 'X', elements: [{ level: 'play', p: .5 }, { level: 'prospect', p: .4 }], summary: { gcos: .31, p50: 60, mean: 80 } }); near(a.pG, .31, 0); assert.equal(a.summary.mean, 80);
  const b = C.fromRisking({ format: 'prospect-risk', elements: [{ level: 'play', p: .5 }, { level: 'prospect', p: .4 }] }); near(b.pG, .2, 1e-12); assert.equal(b.summary, null);
  assert.throws(() => C.fromRisking({ format: 'other' }));
  const rk = readFileSync(new URL('../docs/risking/index.html', import.meta.url), 'utf8').match(/<script id="risk-core">([\s\S]*?)<\/script>/), wr = {}; new Function('window', rk[1])(wr);
  const R = wr.RISK, d = R.defaults(), res = R.run(d), o = Object.assign({}, d, { summary: R.summary(res) }); near(C.fromRisking(o).pG, res.gcos, 1e-12);
});
test('CSV export has the contact statistics, the shares and the POS curve', () => {
  const M = C.example('a'); M.n = 5000; const S = C.sample(M), s = C.summarize(S), t = C.csv(M, S, s, 20);
  assert.ok(/P90,/.test(t) && /controlling_limit,share/.test(t) && /POS_posterior/.test(t)); assert.equal(t.trim().split('\n').filter(l => /^\d/.test(l)).length, 21);
});
console.log(`\n${n} tests passed`);
