// Self-check for the distribution-fitting core (docs/distfit/index.html, <script id="df-core">).
// Run: node scripts/distfit_test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../docs/distfit/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="df-core">([\s\S]*?)<\/script>/); assert.ok(m, 'df-core block not found');
const w = {}; new Function('window', m[1])(w); const D = w.DF;
const rk = readFileSync(new URL('../docs/risking/index.html', import.meta.url), 'utf8').match(/<script id="risk-core">([\s\S]*?)<\/script>/);
const wr = {}; new Function('window', rk[1])(wr); const R = wr.RISK;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const rel = (a, b, tol, msg) => near(a, b, tol * Math.abs(b), msg);
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok   ' + name); };

// independent samplers (not the library inverse cdfs): Box-Muller, Marsaglia-Tsang, closed-form transforms
const mk = seed => { const u = D.rng(seed), r = () => { let v = u(); while (v <= 0) v = u(); return v };
  const norm = () => Math.sqrt(-2 * Math.log(r())) * Math.cos(2 * Math.PI * r());
  const gam = k => { if (k < 1) return gam(k + 1) * Math.pow(r(), 1 / k); const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d); for (;;) { const x = norm(), v = Math.pow(1 + c * x, 3); if (v <= 0) continue; const uu = r(); if (Math.log(uu) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v } };
  return { r, norm, gam } };
const gen = {
  normal: (g, p) => p.mu + p.sigma * g.norm(),
  lognormal: (g, p) => Math.exp(p.mu + p.sigma * g.norm()),
  gamma: (g, p) => p.scale * g.gam(p.shape),
  weibull: (g, p) => p.scale * Math.pow(-Math.log(g.r()), 1 / p.shape),
  exponential: (g, p) => -p.theta * Math.log(g.r()),
  uniform: (g, p) => p.a + (p.b - p.a) * g.r(),
  logistic: (g, p) => { const u = g.r(); return p.mu + p.s * Math.log(u / (1 - u)) },
  gumbel: (g, p) => p.mu - p.beta * Math.log(-Math.log(g.r())),
  pareto: (g, p) => p.xm * Math.pow(g.r(), -1 / p.alpha),
  beta: (g, p) => { const x = g.gam(p.a), y = g.gam(p.b); return p.lo + (p.hi - p.lo) * x / (x + y) },
  triangular: (g, p) => { const u = g.r(), f = (p.c - p.a) / (p.b - p.a); return u < f ? p.a + Math.sqrt(u * (p.b - p.a) * (p.c - p.a)) : p.b - Math.sqrt((1 - u) * (p.b - p.a) * (p.b - p.c)) },
};
const TRUE = { normal: { mu: 5, sigma: 2 }, lognormal: { mu: 1, sigma: .6 }, gamma: { shape: 2.5, scale: 4 }, weibull: { shape: 1.8, scale: 10 }, exponential: { theta: 7 }, uniform: { a: 2, b: 9 },
  logistic: { mu: 3, s: 1.5 }, gumbel: { mu: 10, beta: 3 }, pareto: { xm: 2, alpha: 1.5 }, beta: { a: 1.5, b: 1.2, lo: 10, hi: 30 }, triangular: { a: 0, c: 3, b: 10 } };
const sample = (id, N, seed, p = TRUE[id]) => { const g = mk(seed), x = []; for (let i = 0; i < N; i++) x.push(gen[id](g, p)); return x.sort((a, b) => a - b) };

test('special functions against known values', () => {
  near(D.lgamma(5), Math.log(24), 1e-12); near(D.lgamma(.5), .5 * Math.log(Math.PI), 1e-12);
  near(D.gammaP(1, 2), 1 - Math.exp(-2), 1e-13); near(D.gammaP(2, 3), 1 - Math.exp(-3) * 4, 1e-13); near(D.gammaP(30, 25) + D.gammaQ(30, 25), 1, 1e-13);
  near(D.Phi(1.96), 0.9750021048517795, 1e-12); near(D.Phi(0), .5, 1e-15); near(D.PhiInv(.975), 1.959963984540054, 1e-9); near(D.PhiInv(1e-6), -4.753424308822899, 1e-8);
  for (const x of [.3, .7]) near(D.betaI(2, 2, x), 3 * x * x - 2 * x ** 3, 1e-13);
  near(D.betaI(1, 3, .4), 1 - Math.pow(.6, 3), 1e-13);
  near(D.digamma(1), -0.5772156649015329, 1e-12); near(D.trigamma(1), Math.PI ** 2 / 6, 1e-11);
});
test('cdf, pdf and quantile are consistent for every distribution: quantile(cdf(x)) = x, d cdf / dx = pdf, closed-form spot checks', () => {
  for (const id of D.ORDER) { const d = D.DIST[id], p = TRUE[id];
    for (const u of [.001, .01, .1, .3, .5, .7, .9, .99, .999]) { const x = d.inv(p, u); near(d.cdf(p, x), u, 1e-9, id + ' cdf(inv(' + u + '))'); rel(d.inv(p, d.cdf(p, x)), x, 1e-6, id + ' inv(cdf)') }
    for (const u of [.2, .5, .8]) { const x = d.inv(p, u), h = 1e-5 * (Math.abs(x) + 1), dd = (d.cdf(p, x + h) - d.cdf(p, x - h)) / (2 * h); if (id === 'triangular' && Math.abs(x - p.c) < 1e-3) continue; rel(dd, d.pdf(p, x), 1e-4, id + ' pdf at u=' + u) } }
  rel(D.DIST.gamma.cdf({ shape: 2, scale: 3 }, 6), 1 - Math.exp(-2) * 3, 1e-12); rel(D.DIST.weibull.cdf({ shape: 2, scale: 3 }, 3), 1 - Math.exp(-1), 1e-12);
  rel(D.DIST.pareto.cdf({ xm: 2, alpha: 3 }, 4), 1 - .125, 1e-12); rel(D.DIST.lognormal.inv({ mu: 0, sigma: 1 }, .5), 1, 1e-12); rel(D.DIST.triangular.cdf({ a: 0, c: 1, b: 2 }, 1), .5, 1e-12);
});
test('maximum likelihood recovers the known parameters on large seeded samples (n = 20000, logistic 8000; tolerance 3 % relative, 4 % for the shapes of the beta and for the Gumbel location)', () => {
  const tol = { normal: .03, lognormal: .03, gamma: .03, weibull: .03, exponential: .03, uniform: .01, logistic: .03, gumbel: .03, pareto: .03, beta: .04, triangular: .03 };
  for (const id of D.ORDER) { const N = id === 'logistic' ? 8000 : 20000, x = sample(id, N, 100 + D.ORDER.indexOf(id)), r = D.fitAll(x).find(q => q.id === id); assert.ok(r.ok, id + ' fit failed: ' + r.why);
    for (const k of Object.keys(TRUE[id])) { const t = TRUE[id][k], v = r.p[k], scale = k === 'mu' || k === 'lo' || k === 'a' || k === 'b' || k === 'c' || k === 'hi' ? Math.max(Math.abs(t), (TRUE[id].sigma || TRUE[id].s || TRUE[id].beta || (TRUE[id].hi - TRUE[id].lo) || TRUE[id].b || 1)) : Math.abs(t); near(v, t, tol[id] * scale, id + '.' + k) } }
});
test('KS statistic is small for the true distribution and large for a mismatched one; the approximate p-value agrees', () => {
  for (const id of ['normal', 'lognormal', 'gamma', 'weibull', 'gumbel']) { const x = sample(id, 20000, 7), r = D.fitAll(x).find(q => q.id === id); assert.ok(r.ks < .015, id + ' KS ' + r.ks); assert.ok(r.ksp > .01, id + ' p ' + r.ksp) }
  const x = sample('lognormal', 5000, 3, { mu: 0, sigma: 1 }), res = D.fitAll(x), no = res.find(q => q.id === 'normal'), un = res.find(q => q.id === 'uniform');
  assert.ok(no.ks > .1, 'normal KS ' + no.ks); assert.ok(un.ks > .3, 'uniform KS ' + un.ks); assert.ok(no.ksp < 1e-6 && un.ksp < 1e-6);
  near(D.ksP(1.358 / Math.sqrt(100), 100), .05, .01, 'asymptotic 5 % point of the Kolmogorov distribution'); assert.ok(no.ad > 20 * res.find(q => q.id === 'lognormal').ad);
});
test('AIC ranking prefers the true family: lognormal sample against normal and uniform (and ranks it first among all with n = 3000)', () => {
  const x = sample('lognormal', 3000, 21, { mu: 2, sigma: .6 }), res = D.fitAll(x), by = id => res.find(q => q.id === id);
  assert.ok(by('lognormal').aic < by('normal').aic - 100 && by('lognormal').aic < by('uniform').aic - 100); assert.ok(by('lognormal').bic < by('normal').bic);
  assert.equal(res[0].id, 'lognormal'); assert.equal(res[0].rank, 1); near(res.filter(q => q.ok).reduce((a, q) => a + q.w, 0), 1, 1e-12);
  const y = sample('normal', 3000, 22); assert.equal(D.fitAll(y)[0].id, 'normal'); assert.equal(D.fitAll(sample('weibull', 3000, 23))[0].id, 'weibull');
});
test('distributions needing data outside their support are skipped with a reason; invalid fits never enter the ranking', () => {
  const res = D.fitAll([-3, -1, 0, 2, 4, 8, 9].sort((a, b) => a - b)), by = id => res.find(q => q.id === id);
  for (const id of ['lognormal', 'gamma', 'weibull', 'pareto', 'exponential']) { assert.equal(by(id).ok, false); assert.ok(/positive|non-negative/.test(by(id).why), id) }
  assert.ok(by('normal').ok && by('uniform').ok); assert.ok(res.slice(0, res.filter(q => q.ok).length).every(q => q.ok));
  assert.equal(D.fitAll([2, 2, 2, 2])[0].ok, false);
});
test('exceedance convention: P90 < P50 < P10 for every fit; the cumulative convention reverses the labels', () => {
  const x = sample('gamma', 5000, 5);
  for (const r of D.fitAll(x).filter(q => q.ok)) { const t = D.p90p50p10(r.id, r.p); assert.ok(t.p90 < t.p50 && t.p50 < t.p10, r.id);
    const e = D.pctTable(r.id, r.p, 'exceed'), c = D.pctTable(r.id, r.p, 'cum'), g = P => e.find(z => z.P === P).v, h = P => c.find(z => z.P === P).v;
    assert.ok(g(99) < g(90) && g(90) < g(50) && g(50) < g(10) && g(10) < g(1)); near(g(90), t.p90, 1e-12 * Math.abs(t.p90) + 1e-12); near(h(10), t.p90, 1e-9 * Math.abs(t.p90) + 1e-12); near(h(90), t.p10, 1e-9 * Math.abs(t.p10) + 1e-12) }
  const d = D.describe(x, 'exceed'), c = D.describe(x, 'cum'); assert.ok(d.p90 < d.p50 && d.p50 < d.p10); near(d.p90, c.p10, 1e-12); near(d.p10, c.p90, 1e-12);
});
test('Pareto type I: xm = sample minimum, alpha from the closed form, on a known sample; heavy tail ranks above lognormal for a Pareto sample', () => {
  const x = sample('pareto', 20000, 41, { xm: 2, alpha: 1.5 }), r = D.fitAll(x), p = r.find(q => q.id === 'pareto');
  assert.equal(p.p.xm, x[0]); near(p.p.xm, 2, .01); rel(p.p.alpha, 1.5, .03); assert.equal(r[0].id, 'pareto'); assert.equal(D.DIST.pareto.mean({ xm: 2, alpha: .9 }), Infinity); rel(D.DIST.pareto.mean({ xm: 2, alpha: 3 }), 3, 1e-12);
  const s = 5, z = [3, 4, 6, 9, 20]; near(D.fitAll(z).find(q => q.id === 'pareto').p.alpha, 5 / z.reduce((a, v) => a + Math.log(v / 3), 0), 1e-12);
});
test('beta scaled to the data range: shapes recovered on a known sample, bounds close to the true ones, scale-invariance of the shapes', () => {
  const x = sample('beta', 20000, 51, { a: 1.5, b: 1.2, lo: 0, hi: 1 }), p = D.fitAll(x).find(q => q.id === "beta").p;
  rel(p.a, 1.5, .04); rel(p.b, 1.2, .04); near(p.lo, 0, 5e-3); near(p.hi, 1, 5e-3);
  const y = x.map(v => 100 + 40 * v), q = D.fitAll(y).find(z => z.id === 'beta').p; near(q.a, p.a, 1e-6); near(q.b, p.b, 1e-6); near(q.lo, 100 + 40 * p.lo, 1e-6);
  assert.equal(D.fitAll(sample('beta', 3000, 52, { a: .6, b: .8, lo: 0, hi: 1 }))[0].id, 'beta');
  const t = D.fitAll(sample('triangular', 20000, 53)).find(z => z.id === 'triangular').p; near(t.c, 3, .25); near(t.a, 0, .1); near(t.b, 10, .1);
});
test('input parsing: flat lists, tables with a header, decimal comma, comments, non-numeric cells', () => {
  assert.deepEqual(D.table('1, 2 3\n4\t5;6').cols[0].values, [1, 2, 3, 4, 5, 6]);
  let t = D.table('name,size,x\nA,1.5,10\nB,2.5,20\nC,x,30'); assert.deepEqual(t.cols.map(c => c.name), ['size', 'x']); assert.deepEqual(t.cols[0].values, [1.5, 2.5]); assert.deepEqual(t.cols[1].values, [10, 20, 30]); assert.equal(t.header, true);
  t = D.table('a;b\n1,5;2\n3,5;4'); assert.deepEqual(t.cols[0].values, [1.5, 3.5]); assert.deepEqual(D.table('# note\n1e3 2.5e-1 -4 abc').cols[0].values, [1000, .25, -4]); assert.equal(D.table('abc def').cols.length, 0);
  assert.equal(D.table('1\n2\n3').flat, true); assert.deepEqual(D.table('1\n2\n3').cols[0].values, [1, 2, 3]);
});
test('descriptive statistics, KDE mode, examples', () => {
  const d = D.describe([1, 2, 3, 4, 10], 'exceed'); assert.equal(d.n, 5); assert.equal(d.median, 3); assert.equal(d.mean, 4); near(d.sd, Math.sqrt(12.5), 1e-12); assert.ok(d.skew > 0);
  const x = sample('normal', 5000, 61, { mu: 50, sigma: 5 }), q = D.describe(x, 'exceed'); near(q.mode, 50, 1.5); near(q.skew, 0, .1); near(q.kurt, 0, .2); near(q.p50, 50, .3);
  for (const k of ['fields', 'poro', 'cost']) { const e = D.example(k); assert.ok(e.values.length >= 60 && /Fictitious/.test(e.name)); assert.ok(e.values.every(v => v > 0)); assert.ok(D.fitAll(e.values.slice().sort((a, b) => a - b)).filter(r => r.ok).length >= 6) }
  assert.deepEqual(D.example('fields').values, D.example('fields').values);
});
test('prospect file is a valid Prospect risking file built on its defaults; the fitted P90 / P50 / P10 go into the direct volumes', () => {
  const x = sample('lognormal', 2000, 71, { mu: 3, sigma: .8 }), r = D.fitAll(x)[0], t = D.p90p50p10(r.id, r.p), f = D.prospectFile('Test', t.p90, t.p50, t.p10), dflt = R.defaults();
  assert.equal(f.format, 'prospect-risk'); assert.equal(f.version, 1); assert.equal(f.name, 'Test'); assert.deepEqual(f.elements, dflt.elements); assert.deepEqual(f.econ, dflt.econ);
  assert.equal(f.vol.mode, 'direct'); const v = Object.assign({}, f.vol); for (const k of ['p90', 'p50', 'p10']) { rel(v[k], t[k], 1e-4); v[k] = dflt.vol[k] } assert.deepEqual(v, dflt.vol);
  const run = R.run(Object.assign(R.defaults(), f)); assert.ok(isFinite(run.gcos)); assert.throws(() => D.prospectFile('x', 5, 3, 9)); assert.throws(() => D.prospectFile('x', -1, 3, 9));
});
test('ranking CSV: one row per distribution, skipped ones carry the reason', () => {
  const res = D.fitAll([1, 3, 4, 6, 8, 9, 11, 14, 15, 19, -2].sort((a, b) => a - b)), rows = D.csvRank(res, 'exceed').trim().split('\n');
  assert.equal(rows.length, 1 + D.ORDER.length); assert.ok(rows[0].startsWith('rank,distribution')); assert.ok(rows.some(r => /skipped: needs strictly positive/.test(r)));
  assert.ok(rows.slice(1).every(r => r.split(',').length >= 16 || /skipped/.test(r)));
});
const QP = [.99, .95, .9, .85, .8, .75, .7, .6, .5, .4, .3, .25, .2, .15, .1, .05, .03, .02, .01, .005, .001];
const run_ok = f => { const m = R.fromFile(JSON.parse(JSON.stringify(f))).model, r = R.run(m); return !r.err && isFinite(r.gcos) };
test('contract A: decimal comma, thousands separators, European numbers, with the detected delimiter / decimal mark reported (regression: 1,5 per line gave two columns)', () => {
  let t = D.table('1,5\n2,5\n3,5\n4,5'); assert.equal(t.cols.length, 1); assert.deepEqual(t.cols[0].values, [1.5, 2.5, 3.5, 4.5]); assert.equal(t.decimal, 'comma');
  t = D.table('1,5 2,5 3,5'); assert.deepEqual(t.cols[0].values, [1.5, 2.5, 3.5]);
  t = D.table('1,5;2,5;3,5'); assert.deepEqual(t.cols[0].values, [1.5, 2.5, 3.5]);
  t = D.table('1 234,5\n2 345,5\n10,25'); assert.deepEqual(t.cols[0].values, [1234.5, 2345.5, 10.25]);
  t = D.table('1,234.5\n2,345.5\n7'); assert.deepEqual(t.cols[0].values, [1234.5, 2345.5, 7]);
  t = D.table('1.234,5\n2.345,5\n7,5'); assert.deepEqual(t.cols[0].values, [1234.5, 2345.5, 7.5]);
  t = D.table('depth;phi\n100;0,55\n200;0,25'); assert.deepEqual(t.cols.map(c => c.name), ['depth', 'phi']); assert.deepEqual(t.cols[1].values, [.55, .25]); assert.equal(t.delimiter, 'semicolon');
  t = D.table('100 0,55\n200 0,25\n300 0,31'); assert.equal(t.cols.length, 2); assert.deepEqual(t.cols[1].values, [.55, .25, .31]); assert.equal(t.delimiter, 'whitespace');
  t = D.table('name,size,x\nA,1.5,10\nB,2.5,20'); assert.equal(t.delimiter, 'comma'); assert.deepEqual(t.cols[0].values, [1.5, 2.5]);
  t = D.table('1,234\n2,345\n3,456'); assert.deepEqual(t.cols[0].values, [1234, 2345, 3456]); assert.ok(t.ambiguous, 'ambiguity must be reported');
  t = D.table('1,234\n2,5\n3,456'); assert.deepEqual(t.cols[0].values, [1.234, 2.5, 3.456]); assert.equal(t.decimal, 'comma');
  t = D.table('+5 −3 1E+3 1e-3'); assert.deepEqual(t.cols[0].values, [5, -3, 1000, .001]);
  assert.deepEqual(D.parseNumber('<0,1'), { value: null, kind: 'below', limit: .1 }); assert.equal(D.parseNumber('n.d.').kind, 'missing'); assert.equal(D.parseNumber('abc').kind, 'text');
});
test('contract A: every skipped entry is counted with its reason and its first line numbers', () => {
  const t = D.table('size\n1.5\nn.d.\n<0.1\nabc\n2.5\n\n-\n3.5');
  assert.deepEqual(t.cols[0].values, [1.5, 2.5, 3.5]); assert.equal(t.read, 7); assert.equal(t.skipped, 4);
  assert.equal(t.reasons.missing.n, 2); assert.equal(t.reasons.below.n, 1); assert.equal(t.reasons.text.n, 1); assert.deepEqual(t.reasons.missing.lines, [3, 8]); assert.deepEqual(t.reasons.text.lines, [5]);
  const f = D.table('1 2 x 4 n.d.'); assert.deepEqual(f.cols[0].values, [1, 2, 4]); assert.equal(f.skipped, 2); assert.equal(f.reasons.text.n, 1); assert.equal(f.reasons.missing.n, 1);
  assert.match(D.loadMessage(t, t.cols[0]), /7 rows read, 4 skipped/);
});
test('contract D: exported file carries summary v2 with the 21 quantiles of the SELECTED fit (regression: gamma sample, best fit Weibull, only P90/P50/P10 read back as lognormal)', () => {
  const x = sample('gamma', 400, 801, { shape: 1.2, scale: 40 }), res = D.fitAll(x);
  for (const id of [res[0].id, 'lognormal', 'gamma', 'weibull']) {
    const r = res.find(q => q.id === id), t = D.p90p50p10(r.id, r.p), f = D.prospectFile('T', t.p90, t.p50, t.p10, { id: r.id, p: r.p }), s = f.summary, d = D.DIST[r.id];
    assert.equal(f.format, 'prospect-risk'); assert.equal(f.version, 1); assert.equal(s.version, 2); assert.equal(s.quantiles.length, 21);
    assert.deepEqual(s.quantiles.map(q => q[0]), QP, 'same exceedance probabilities as Prospect risking');
    for (let i = 0; i < 21; i++) { rel(s.quantiles[i][1], d.inv(r.p, 1 - s.quantiles[i][0]), 1e-9, r.id + ' q' + i); if (i) assert.ok(s.quantiles[i][1] > s.quantiles[i - 1][1]) }
    rel(s.mean, d.mean(r.p), 1e-12); assert.equal(s.dist.family, r.id); assert.ok(/^Distribution fitting, \d{4}-\d\d-\d\d$/.test(s.computedBy));
    assert.deepEqual(Object.keys(s).sort(), Object.keys(R.summary(R.run(Object.assign(R.defaults(), f)))).sort(), 'same keys as the summary written by Prospect risking');
    rel(s.p90, f.vol.p90, 1e-4); assert.ok(run_ok(f), 'valid for R.run'); }
  assert.equal(D.exportWarning('lognormal'), ''); assert.match(D.exportWarning('weibull'), /not lognormal.*quantiles/);
});
test('contract D: a fit giving non-positive volumes refuses to export', () => {
  assert.throws(() => D.prospectFile('x', 1, 2, 3, { id: 'normal', p: { mu: 1, sigma: 3 } }));
});
test('KS p-value with fitted parameters: asymptotic p never rejects (regression), bootstrap p is calibrated (Lilliefors type, seeded)', () => {
  let asy = 0, bks = 0, bad = 0; const T = 120;
  for (let k = 0; k < T; k++) { const x = sample('lognormal', 30, 5000 + k, { mu: 1, sigma: .6 }), r = D.fitAll(x).find(q => q.id === 'lognormal'); if (r.ksp < .05) asy++;
    const b = D.bootGof('lognormal', r.p, 30, { ks: r.ks, ad: r.ad }, { nsim: 99, seed: 9 + k }); if (b.ksp < .05) bks++; if (b.adp < .05) bad++ }
  console.log('     rejection rates at 0.05 (n = 30, true lognormal, ' + T + ' trials): asymptotic KS ' + asy / T + ', bootstrap KS ' + bks / T + ', bootstrap AD ' + bad / T);
  assert.ok(asy / T < .02, 'asymptotic rejections ' + asy); assert.ok(bks / T < .13, 'bootstrap KS rejection rate ' + bks / T); assert.ok(bad / T < .13, 'bootstrap AD rejection rate ' + bad / T);
  assert.ok(bks / T > .005 && bad / T > .005, 'bootstrap should reject sometimes');
  const x = sample('lognormal', 200, 77, { mu: 0, sigma: 1 }), n = D.fitAll(x).find(q => q.id === 'normal'), b = D.bootGof('normal', n.p, 200, { ks: n.ks, ad: n.ad }, { nsim: 99, seed: 1 }); assert.ok(b.ksp <= .02 && b.adp <= .02); assert.equal(b.nsim, 99);
  assert.deepEqual(b, D.bootGof('normal', n.p, 200, { ks: n.ks, ad: n.ad }, { nsim: 99, seed: 1 }), 'seeded');
});
test('AIC ranking marks the models that are not comparable (triangular by moments, beta with data-derived bounds)', () => {
  const res = D.fitAll(sample('lognormal', 300, 31)); for (const r of res.filter(q => q.ok)) assert.equal(!!r.nc, r.id === 'triangular' || r.id === 'beta', r.id); assert.ok(/not comparable/i.test(D.NC_NOTE));
});
test('bootstrap confidence intervals on P90 / P50 / P10 (nonparametric, refit, seeded)', () => {
  const x = sample('lognormal', 300, 91, { mu: 3, sigma: .5 }), r = D.fitAll(x).find(q => q.id === 'lognormal'), ci = D.bootQuantiles('lognormal', x, { nsim: 200, seed: 4 });
  assert.equal(ci.nsim, 200); const t = D.p90p50p10('lognormal', r.p);
  for (const k of ['p90', 'p50', 'p10']) { assert.ok(ci[k].lo < ci[k].hi); assert.ok(ci[k].lo <= t[k] * 1.02 && ci[k].hi >= t[k] * .98, k) }
  const tru = { p90: Math.exp(3 - 1.28155 * .5), p50: Math.exp(3), p10: Math.exp(3 + 1.28155 * .5) }; for (const k of ['p90', 'p50', 'p10']) assert.ok(ci[k].lo < tru[k] * 1.05 && ci[k].hi > tru[k] * .95, 'covers truth ' + k);
  assert.deepEqual(ci, D.bootQuantiles('lognormal', x, { nsim: 200, seed: 4 }));
});
console.log(`\n${n} tests passed`);
