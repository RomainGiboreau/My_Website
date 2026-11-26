// Self-check for the prospect risking core (docs/risking/index.html, <script id="risk-core">).
// Run: node scripts/risking_test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../docs/risking/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="risk-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'risk-core block not found');
const w = {}; new Function('window', m[1])(w);
const R = w.RISK;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const rel = (a, b, tol, msg) => near(a, b, tol * Math.abs(b), msg);
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok   ' + name); };

test('normal cdf and quantile are inverse and match known values', () => {
  near(R.Phi(0), .5, 1e-9); near(R.Phi(1.2815515655), .9, 2e-7); near(R.PhiInv(.975), 1.959964, 1e-5);
  for (const p of [.001, .05, .3, .5, .8, .999]) near(R.Phi(R.PhiInv(p)), p, 3e-7, 'p ' + p);
});
test('gCOS is the product of play and prospect chances', () => {
  const g = R.gcos([{ level: 'play', p: .8 }, { level: 'play', p: .5 }, { level: 'prospect', p: .5 }, { level: 'prospect', p: .6 }]);
  near(g.play, .4, 1e-12); near(g.prospect, .3, 1e-12); near(g.gcos, .12, 1e-12);
  near(R.gcos([{ level: 'play', p: 2 }, { level: 'prospect', p: -1 }]).gcos, 0, 0, 'chances clamped to 0..1');
});
test('lognormal reproduces P50 exactly and P90 / P10 on a symmetric case, and rejects unordered input', () => {
  const d = R.lognormalDist(20, 60, 180);
  near(d.pct(.5), 60, 1e-9); near(d.pct(.9), 20, 1e-6); near(d.pct(.1), 180, 1e-6);
  near(d.sf(60), .5, 1e-9); assert.equal(R.lognormalDist(60, 20, 180), null);
});
test('analytic lognormal agrees with a one-million-sample simulation to within 1 %', () => {
  const d = R.lognormalDist(8, 22, 90), rng = R.rng(7), N = 1e6;
  let s = 0, c = 0, ex = 0; const K = 25;
  for (let i = 0; i < N; i++) { const u1 = rng() || 1e-12, u2 = rng(), z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2), v = Math.exp(d.mu + d.sg * z); s += v; if (v > K) { c++; ex += v - K } }
  rel(s / N, d.mean, .01, 'mean'); near(c / N, d.sf(K), .003, 'exceedance'); rel(ex / N, d.call(K), .01, 'call');
});
test('volumetric Monte Carlo: mean of the product of independent triangulars, seeded and reproducible', () => {
  const t = { grv: [150, 300, 600], ntg: [.5, .7, .85], phi: [.15, .2, .25], sw: [.25, .35, .5], bo: [1.15, 1.25, 1.4], rf: [.2, .3, .4] };
  const a = R.sampleDist(t, 200000, 3), b = R.sampleDist(t, 200000, 3);
  assert.equal(a.mean, b.mean);
  const tm = x => (x[0] + x[1] + x[2]) / 3; // exact except Bo, whose mean of 1/Bo is estimated by the sample itself
  const inv = (() => { const r = R.rng(11); let s = 0, N = 400000; for (let i = 0; i < N; i++) { const u = r(), [lo, m, hi] = t.bo, f = (m - lo) / (hi - lo); s += 1 / (u < f ? lo + Math.sqrt(u * (hi - lo) * (m - lo)) : hi - Math.sqrt((1 - u) * (hi - lo) * (hi - m))) } return s / N })();
  rel(a.mean, tm(t.grv) * 6.2898 * tm(t.ntg) * tm(t.phi) * (1 - tm(t.sw)) * inv * tm(t.rf), .01);
  assert.ok(a.pct(.9) < a.pct(.5) && a.pct(.5) < a.pct(.1));
  near(a.sf(a.pct(.3)), .3, .002);
});
test('Monte Carlo E[(V-K)+] matches a direct sum', () => {
  const t = { grv: [150, 300, 600], ntg: [.5, .7, .85], phi: [.15, .2, .25], sw: [.25, .35, .5], bo: [1.15, 1.25, 1.4], rf: [.2, .3, .4] }, d = R.sampleDist(t, 5000, 5), K = d.pct(.4);
  let s = 0; for (const v of d.v) if (v > K) s += v - K; rel(d.call(K), s / d.n, 1e-9);
});
test('eCOS = gCOS x P(V > MEFV), with the limits 1 and 0 and a consistent EMV', () => {
  const d = R.lognormalDist(20, 60, 180), g = .3, e = { u: 9, F: 220, D: 45, mefv: null }, r = R.economics(d, g, e);
  rel(r.mefv, 220 / 9, 1e-12); near(r.ecos, g * d.sf(220 / 9), 1e-12);
  near(R.economics(d, g, { u: 9, F: 0, D: 0, mefv: null }).ecos, g, 1e-6, 'no fixed cost: every success is economic');
  near(R.economics(d, g, { u: 9, F: 1e9, D: 0, mefv: null }).ecos, 0, 1e-9, 'huge MEFV');
  near(R.economics(d, g, { u: 9, F: 220, D: 45, mefv: 40 }).F, 360, 1e-9, 'a typed MEFV sets F = MEFV x u');
  near(r.emv, g * 9 * d.call(220 / 9) - 45, 1e-9);
  const free = R.economics(d, 1, { u: 9, F: 0, D: 0, mefv: null }); near(free.emv, 9 * d.mean, 1e-6, 'EMV with no cost is u x mean');
  assert.ok(R.economics(d, g, { u: 0, F: 10, D: 5, mefv: null }).ecos === 0 && R.economics(d, g, { u: 0, F: 10, D: 5, mefv: null }).emv === -5);
});
test('run(): defaults give a plausible prospect, and bad input is reported, not thrown', () => {
  const m0 = R.defaults(), r = R.run(m0);
  assert.ok(r.gcos > .1 && r.gcos < .3 && r.ecos < r.gcos && r.ecos > 0 && isFinite(r.emv));
  m0.vol.mode = 'vol'; const r2 = R.run(m0); assert.ok(r2.ecos > 0 && r2.ecos <= r2.gcos);
  m0.vol.tri.grv = [600, 300, 150]; assert.ok(R.run(m0).err);
  const m1 = R.defaults(); m1.vol.p90 = 100; assert.ok(R.run(m1).err);
});
test('curve: risked curve is gCOS times the success curve and both decrease', () => {
  const r = R.run(R.defaults()), c = R.curve(r.dist, r.gcos);
  for (let i = 1; i < c.length; i++) { assert.ok(c[i][1] <= c[i - 1][1] + 1e-12); near(c[i][2], r.gcos * c[i][1], 1e-12) }
  assert.ok(c[0][1] > .99 && c[c.length - 1][1] < .01);
});

test('summary: matches the run, in MMboe with P90 as the low case, and is null on bad input', () => {
  const m = R.defaults(), r = R.run(m), s = R.summary(r);
  assert.deepEqual(Object.keys(s).sort(), ['gcos', 'mean', 'mefv', 'p10', 'p50', 'p90', 'pPlay', 'pPros']);
  near(s.p90, r.p90, 0); near(s.mean, r.meanSuccess, 0); near(s.gcos, s.pPlay * s.pPros, 1e-12); near(s.mefv, 220 / 9, 1e-12);
  assert.ok(s.p90 < s.p50 && s.p50 < s.p10);
  const bad = R.defaults(); bad.vol.p90 = 999; assert.equal(R.summary(R.run(bad)), null);
  m.econ.F = 0; m.econ.mefv = null; assert.equal(R.summary(R.run(m)).mefv, 0);
});
test('fdp-link import: sets a usable MEFV and rejects other files', () => {
  const l = R.fdpLink({ format: 'fdp-link', version: 1, name: 'Case 1', mefv: 42.5, breakeven: 31 });
  near(l.mefv, 42.5, 0); assert.equal(l.name, 'Case 1'); near(l.breakeven, 31, 0);
  assert.throws(() => R.fdpLink({ format: 'prospect-risk' })); assert.throws(() => R.fdpLink({ format: 'fdp-link', mefv: 0 })); assert.throws(() => R.fdpLink(null));
  const m = R.defaults(); m.econ.mefv = l.mefv; near(R.run(m).mefv, 42.5, 0);
});
test('gas volumetrics: a deterministic case matches the formula (Bcf / 6 = MMboe) and oil is unchanged', () => {
  const d = k => [k, k, k], t = { grv: d(300), ntg: d(.7), phi: d(.2), sw: d(.35), bo: d(1.25), bg: d(.005), rf: d(.7) };
  const g = R.sampleDist(t, 1000, 1, 'gas'), sm3 = 300e6 * .7 * .2 * .65 / .005 * .7, mmboe = sm3 * 35.3147 / 6e9;
  near(g.mean, mmboe, 1e-9); near(g.pct(.5), mmboe, 1e-9); near(mmboe, 22.5, .1, 'sanity: about 22 MMboe');
  const o = R.sampleDist(t, 1000, 1), o2 = R.sampleDist(t, 1000, 1, 'oil'); near(o.mean, 300 * 6.2898 * .7 * .2 * .65 / 1.25 * .7, 1e-9); assert.equal(o.mean, o2.mean);
  const m = R.defaults(); m.vol.mode = 'vol'; const a = R.run(m).meanSuccess; m.vol.fluid = 'gas'; const b = R.run(m).meanSuccess; assert.ok(b > 0 && b !== a);
  delete m.vol.tri.bg; assert.ok(R.run(m).meanSuccess > 0, 'old file without Bg falls back to the default');
  m.vol.tri.bg = [.006, .005, .004]; assert.ok(R.run(m).err);
});
test('conditional chances: product rule, marginal, conditioning on 1 = independent, bad links ignored, old files unchanged', () => {
  const ind = [{ level: 'play', p: .8 }, { level: 'prospect', p: .6 }, { level: 'prospect', p: .5 }];
  const base = R.gcos(ind); near(base.gcos, .24, 1e-12);
  const c = ind.map(e => Object.assign({}, e)); c[2].on = 1; // P(C | B) = .5 given P(B) = .6
  const g = R.gcos(c); near(g.gcos, .8 * .6 * .5, 1e-12); near(g.marg[2], .3, 1e-12); near(g.marg[1], .6, 1e-12);
  const one = [{ level: 'play', p: 1 }, { level: 'prospect', p: .7, on: 0 }]; near(R.gcos(one).gcos, R.gcos([{ level: 'play', p: 1 }, { level: 'prospect', p: .7 }]).gcos, 1e-15); near(R.gcos(one).marg[1], .7, 1e-15);
  const ch = [{ level: 'prospect', p: .5 }, { level: 'prospect', p: .5, on: 0 }, { level: 'prospect', p: .5, on: 1 }]; near(R.gcos(ch).marg[2], .125, 1e-12);
  const cyc = [{ level: 'play', p: .5, on: 1 }, { level: 'play', p: .5, on: 0 }, { level: 'prospect', p: .5, on: 2 }, { level: 'prospect', p: .5, on: 9 }];
  near(R.gcos(cyc).gcos, .0625, 1e-12); near(R.gcos(cyc).marg[3], .5, 1e-12); // cycle and self / out-of-range links do not break anything
  const m = R.defaults(); const r0 = R.run(m).gcos; m.elements[4].on = 3; near(R.run(m).gcos, r0, 1e-12); near(R.run(m).chances.marg[4], .75 * .7, 1e-12);
});
test('Bayes on the odds: odds posterior = odds prior x LR, sequential updates multiply, feeds gCOS', () => {
  near(R.bayes(.5, 3), .75, 1e-12); near(R.bayes(.2, 1), .2, 1e-15); near(R.bayes(.3, 0), 0, 0); near(R.bayes(1, 5), 1, 0); near(R.bayes(0, 5), 0, 0);
  for (const [p, lr] of [[.1, 4], [.7, .25], [.35, 2.5]]) { const q = R.bayes(p, lr); near(q / (1 - q), p / (1 - p) * lr, 1e-12) }
  near(R.bayes(R.bayes(.3, 2), 3), R.bayes(.3, 6), 1e-12); near(R.bayes(R.bayes(.4, 2), .5), .4, 1e-12, 'LR 2 then 1/2 cancels');
  near(R.gcos([{ level: 'prospect', p: .5, lr: 3 }, { level: 'prospect', p: .8 }]).gcos, .75 * .8, 1e-12);
  near(R.gcos([{ level: 'prospect', p: .5, lr: null }, { level: 'prospect', p: .8, lr: '' }]).gcos, .4, 1e-12, 'no LR = unchanged');
});
console.log(`${n}/${n} passed`);
