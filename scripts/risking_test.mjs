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
// ---- Evidence Support Logic
const flagEl = (level, g, r) => ({ level, g, r, p: g });
test('ESL roll-up algebra: green = prod g, red = 1 - prod(1-r), white = rest, sums to 1, P = green + s white', () => {
  const fl = [{ g: .6, r: .1, w: .3 }, { g: .5, r: .2, w: .3 }], x = R.eslRoll(fl, .5);
  near(x.green, .3, 1e-12); near(x.red, 1 - .9 * .8, 1e-12); near(x.green + x.red + x.white, 1, 1e-12); near(x.white, 1 - .3 - .28, 1e-12); near(x.p, .3 + .5 * .42, 1e-12);
  const one = R.eslRoll([fl[0]], .7); near(one.green, .6, 1e-12); near(one.red, .1, 1e-12); near(one.p, .6 + .7 * .3, 1e-12, 'a single element rolls up to itself');
  near(R.eslRoll([], .5).p, 1, 0, 'empty series = certain');
  const pf = R.eslFlag({ p: .7 }); near(pf.g, .7, 1e-12); near(pf.r, .3, 1e-12); near(pf.w, 0, 1e-12); // a plain chance p is the flag (p, 1-p, 0)
  const nf = R.eslFlag({ g: .8, r: .6 }); near(nf.g + nf.r, 1, 1e-12, 'g + r > 1 is normalised');
});
test('ESL: with no white mass, P(ESL) equals the classic product', () => {
  const els = [flagEl('play', .8, .2), flagEl('play', .6, .4), flagEl('prospect', .7, .3), flagEl('prospect', .9, .1)];
  for (const esl of [{ on: true, stance: 'neutral' }, { on: true, stance: 'custom', s: .2 }, { on: true, stance: 'base', b: .9 }]) {
    const g = R.gcos(els, esl); near(g.esl.pESL, g.esl.pClassic, 1e-12); near(g.esl.gap, 0, 1e-12); near(g.gcos, .8 * .6 * .7 * .9, 1e-12); near(g.esl.white, 0, 1e-12);
  }
});
test('ESL: all-white elements give s^n for the classic product while P(ESL) stays between green and 1 - red', () => {
  const n = 4, els = Array.from({ length: n }, (_, i) => flagEl(i < 2 ? 'play' : 'prospect', 0, 0));
  for (const s of [.2, .5, .9]) {
    const g = R.gcos(els, { on: true, stance: 'custom', s }), e = g.esl;
    near(e.pClassic, Math.pow(s, n), 1e-12); near(e.green, 0, 0); near(e.red, 0, 0); near(e.white, 1, 1e-12); near(e.pESL, s, 1e-12);
    assert.ok(e.pESL >= e.green - 1e-12 && e.pESL <= 1 - e.red + 1e-12); assert.ok(e.gap > 0, 'ESL above the classic product when elements are unknown');
  }
  const mix = [flagEl('play', .5, .2), flagEl('prospect', .4, .1), flagEl('prospect', .3, .3)], e = R.gcos(mix, { on: true, stance: 'neutral' }).esl;
  assert.ok(e.pESL >= e.green && e.pESL <= 1 - e.red);
});
test('ESL stances: neutral 0.5, custom s, base rate b, and element policy chance g + s w', () => {
  near(R.eslStance({ stance: 'neutral', s: .9, b: .1 }), .5, 0); near(R.eslStance({ stance: 'custom', s: .9, b: .1 }), .9, 0); near(R.eslStance({ stance: 'base', s: .9, b: .1 }), .1, 0);
  near(R.eslStance({ stance: 'custom', s: 7 }), 1, 0, 'clamped'); near(R.eslStance({ stance: 'custom', s: '' }), .5, 0); near(R.eslStance(undefined), .5, 0);
  const els = [flagEl('play', .5, .3)]; // w = .2
  near(R.gcos(els, { on: true, stance: 'neutral' }).eff[0], .6, 1e-12); near(R.gcos(els, { on: true, stance: 'custom', s: 1 }).eff[0], .7, 1e-12); near(R.gcos(els, { on: true, stance: 'base', b: .25 }).eff[0], .55, 1e-12);
  near(R.gcos(els, { on: true, stance: 'base', b: .25 }).esl.s, .25, 0);
});
test('ESL: off by default, old files unchanged, headline switch, summary stays consistent', () => {
  const m = R.defaults(), base = R.run(m); assert.equal(m.esl.on, false); assert.equal(base.chances.esl, undefined);
  delete m.esl; near(R.run(m).gcos, base.gcos, 0, 'file without esl');
  const m2 = R.defaults(); m2.esl.on = true; near(R.run(m2).gcos, base.gcos, 1e-12, 'plain chances become (p, 1-p, 0) flags: same gCOS');
  m2.elements.forEach(e => { e.g = .5; e.r = .2 }); const c = R.run(m2), s = R.summary(c); near(c.gcos, c.chances.esl.pClassic, 1e-12); near(s.gcos, s.pPlay * s.pPros, 1e-12);
  m2.esl.use = 'esl'; const e = R.run(m2), s2 = R.summary(e); near(e.gcos, e.chances.esl.pESL, 1e-12); near(s2.gcos, s2.pPlay * s2.pPros, 1e-12); assert.ok(e.gcos !== c.gcos);
});

// ---- correlation of the volumetric parameters
const T0 = { grv: [150, 300, 600], ntg: [.5, .7, .85], phi: [.15, .2, .25], sw: [.25, .35, .5], bo: [1.15, 1.25, 1.4], rf: [.2, .3, .4] };
const eye = () => Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => i === j ? 1 : 0));
const withC = (pairs) => { const C = eye(); for (const [i, j, r] of pairs) { C[i][j] = r; C[j][i] = r } return C };
const spearman = (a, b) => { const rk = x => { const o = Array.from(x.keys()).sort((i, j) => x[i] - x[j]), r = new Float64Array(x.length); o.forEach((k, i) => r[k] = i); return r }, A = rk(a), B = rk(b), n = a.length, m = (n - 1) / 2; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (A[i] - m) * (B[i] - m); saa += (A[i] - m) ** 2; sbb += (B[i] - m) ** 2 } return sab / Math.sqrt(saa * sbb) };
test('correlation: identity (or none) reproduces the independent samples exactly', () => {
  const a = R.sampleDist(T0, 5000, 4), b = R.sampleDist(T0, 5000, 4, 'oil', eye()), c = R.sampleDist(T0, 5000, 4, 'oil', null);
  // reference: the original independent sampler, written out
  const tri = (u, a, m, b) => { if (!(b > a)) return a; const f = (m - a) / (b - a); return u < f ? a + Math.sqrt(u * (b - a) * (m - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - m)) }, r = R.rng(4), ref = new Float64Array(5000);
  for (let i = 0; i < 5000; i++) { const g = k => tri(r(), T0[k][0], T0[k][1], T0[k][2]); ref[i] = g('grv') * 6.2898 * g('ntg') * g('phi') * (1 - g('sw')) / Math.max(1e-9, g('bo')) * g('rf') }
  for (let i = 0; i < 5000; i++) { assert.equal(a.raw[i], ref[i]); assert.equal(b.raw[i], ref[i]); assert.equal(c.raw[i], ref[i]) }
  assert.equal(a.mean, b.mean); assert.ok(b.corr.identity);
});
test('correlation: +0.8 between two parameters gives a Spearman correlation near 0.8; -0.7 NTG-Sw is possible; others stay uncorrelated', () => {
  const d = R.sampleDist(T0, 40000, 9, 'oil', withC([[1, 2, .8]])); // NTG-porosity
  near(spearman(d.par[1], d.par[2]), .8, .03, 'rho NTG-phi'); near(spearman(d.par[0], d.par[1]), 0, .03, 'GRV-NTG untouched');
  const e = R.sampleDist(T0, 40000, 9, 'oil', withC([[1, 3, -.7]]));
  near(spearman(e.par[1], e.par[3]), -.7, .03, 'rho NTG-Sw');
  for (let k = 0; k < 6; k++) { const mn = Math.min(...e.par[k]), mx = Math.max(...e.par[k]); assert.ok(mn >= T0[e.keys[k]][0] - 1e-12 && mx <= T0[e.keys[k]][2] + 1e-12, 'marginals stay within [min, max]') }
  const ind = R.sampleDist(T0, 40000, 9);
  assert.ok(d.mean > ind.mean, 'positive NTG-phi correlation raises the mean of the product');
  const f = R.sampleDist(Object.assign({}, T0, { bg: [.004, .005, .006] }), 20000, 9, 'gas', withC([[0, 4, .5]])); near(spearman(f.par[0], f.par[4]), .5, .04, 'gas: Bg in the fifth place');
});
test('correlation: a non positive semi-definite matrix is projected and flagged, a valid one is not', () => {
  const bad = withC([[0, 1, .9], [1, 2, .9], [0, 2, -.9]]), f = R.corrFactor(bad);
  assert.ok(f.projected && !f.identity && f.L); for (let i = 0; i < 6; i++) near(f.used[i][i], 1, 1e-12);
  const d = R.sampleDist(T0, 2000, 1, 'oil', bad); assert.ok(isFinite(d.mean) && d.mean > 0);
  assert.ok(!R.corrFactor(withC([[0, 1, .5]])).projected); near(R.corrFactor(withC([[0, 1, .5]])).used[0][1], .5, 1e-9, 'round trip of the Spearman / Pearson conversion');
  assert.ok(R.corrFactor('x').identity && R.corrFactor([[1]]).identity); // malformed -> ignored
  const m = R.defaults(); m.vol.mode = 'vol'; const r0 = R.run(m).meanSuccess; m.vol.corr = eye(); assert.equal(R.run(m).meanSuccess, r0, 'run(): identity matrix unchanged');
  m.vol.corr = withC([[1, 3, -.6]]); assert.notEqual(R.run(m).meanSuccess, r0);
});
// ---- sensitivity
test('sensitivity: a degenerate parameter contributes 0, a dominant one dominates, shares sum to 1, signs follow the formula', () => {
  const t = { grv: [100, 300, 900], ntg: [.7, .7, .7], phi: [.19, .2, .21], sw: [.34, .35, .36], bo: [1.24, 1.25, 1.26], rf: [.29, .3, .31] };
  const s = R.sensitivity(R.sampleDist(t, 20000, 2)), by = Object.fromEntries(s.map(o => [o.key, o]));
  near(by.ntg.rho, 0, 0); near(by.ntg.share, 0, 0); assert.ok(by.grv.share > .9 && by.grv.rho > .9); near(s.reduce((a, o) => a + o.share, 0), 1, 1e-12);
  assert.ok(by.sw.rho < 0 && by.bo.rho < 0 && by.phi.rho > 0 && by.rf.rho > 0, 'signs: Sw and Bo reduce the volume');
  const all = R.sensitivity(R.sampleDist(T0, 20000, 2)); assert.ok(all.every(o => isFinite(o.rho) && Math.abs(o.rho) <= 1));
  const deg = R.sensitivity(R.sampleDist(Object.fromEntries(Object.keys(T0).map(k => [k, [1, 1, 1]])), 1000, 1)); assert.ok(deg.every(o => o.rho === 0 && o.share === 0), 'all constant: no NaN');
  assert.equal(R.sensitivity(R.lognormalDist(20, 60, 180)), null);
});
// ---- input QC
test('input QC: implausible volumetric inputs produce warnings, defaults and gas defaults produce none', () => {
  assert.deepEqual(R.qcVol(R.defaults().vol.tri, 'oil'), []); assert.deepEqual(R.qcVol(R.defaults().vol.tri, 'gas'), []);
  const w = (k, a, fl) => { const t = JSON.parse(JSON.stringify(R.defaults().vol.tri)); t[k] = a; return R.qcVol(t, fl || 'oil') };
  assert.equal(w('phi', [.15, .2, .46]).length, 1); assert.equal(w('phi', [.15, .2, .45]).length, 0);
  assert.equal(w('ntg', [.5, .7, 1.1]).length, 1); assert.equal(w('sw', [-.1, .35, .5]).length, 1); assert.equal(w('sw', [.25, .35, 1.2]).length, 1);
  assert.equal(w('bo', [.9, 1.2, 1.4]).length, 1); assert.equal(w('bo', [.9, 1.2, 1.4], 'gas').length, 0, 'Bo is not used for gas');
  assert.equal(w('rf', [.2, .3, .85]).length, 1); assert.equal(w('rf', [.2, .3, .8]).length, 0);
  assert.equal(w('grv', [150, 700, 600]).length, 1, 'mode above max'); assert.ok(/mode/.test(w('grv', [150, 100, 600])[0]));
  assert.equal(w('bg', [0, .005, .006], 'gas').length, 1);
  assert.equal(w('phi', [.15, .2, ''], 'oil').length, 1, 'incomplete input');
  assert.ok(R.qcVol({ phi: [.1, .6, .5], ntg: [.5, 1.2, 1.2] }, 'oil').length >= 4, 'several problems are all reported, none throws');
});
console.log(`${n}/${n} passed`);
