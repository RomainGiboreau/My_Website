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
console.log(`${n}/${n} passed`);
