// Self-check for the petroleum system events chart core (docs/psec/index.html, <script id="pe-core">).
// Run: node scripts/psec_test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../docs/psec/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="pe-core">([\s\S]*?)<\/script>/); assert.ok(m, 'pe-core block not found');
const w = {}; new Function('window', m[1])(w); const P = w.PE;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok   ' + name); };
const ev = (name, cat, start, end, o = {}) => Object.assign(P.normEvent({ name, cat, start, end }), o);
// charge event (index 0) and one other event whose time is compared with the anchor
const pair = (x, c = {}, anchor = 'start', o = {}) => P.timing([ev('charge', 'generation-migration', 50, 25, c), x], Object.assign({ charge: 0, anchor, seed: 4, n: 200000 }, o));

test('ICS table: contiguous, ordered, from 0 Ma, durations add up to the total span (three levels)', () => {
  const [t0, t1] = P.ICS.span; assert.equal(t0, 0); near(t1, 538.8, 0, 'span');
  for (const lv of ['eras', 'periods', 'epochs']) {
    const L = P.ICS[lv]; assert.equal(L[0].top, t0, lv); assert.equal(L[L.length - 1].base, t1, lv); let sum = 0;
    L.forEach((u, i) => { assert.ok(u.base > u.top, `${lv} ${u.name} has a positive duration`); if (i) assert.equal(u.top, L[i - 1].base, `${lv}: ${u.name} top = previous base`); sum += u.base - u.top; assert.match(u.color, /^#[0-9a-f]{6}$/i, u.name) });
    near(sum, t1 - t0, 1e-9, lv + ' sum of durations');
  }
});
test('ICS table: every era and period boundary is also an epoch boundary; spot values from the chart', () => {
  const eb = new Set(P.ICS.epochs.flatMap(u => [u.top, u.base]));
  for (const lv of ['eras', 'periods']) for (const u of P.ICS[lv]) { assert.ok(eb.has(u.top) && eb.has(u.base), `${lv} ${u.name}`) }
  const by = (lv, nm) => P.ICS[lv].find(u => u.name === nm);
  assert.equal(by('periods', 'Cretaceous').top, 66.0); assert.equal(by('periods', 'Cretaceous').base, 143.1); assert.equal(by('periods', 'Jurassic').base, 201.4);
  assert.equal(by('periods', 'Triassic').base, 251.902); assert.equal(by('periods', 'Permian').base, 298.9); assert.equal(by('periods', 'Devonian').base, 419.62);
  assert.equal(by('eras', 'Mesozoic').base, 251.902); assert.equal(by('epochs', 'Eocene').base, 56.0); assert.equal(by('periods', 'Cambrian').base, 538.8);
  assert.equal(P.unitAt('periods', 100).name, 'Cretaceous'); assert.equal(P.unitAt('periods', 66.0).name, 'Cretaceous'); assert.equal(P.unitAt('epochs', 0).name, 'Holocene'); assert.equal(P.unitAt('periods', 600), null);
});
test('uniform A and B: the analytic probability equals the closed form and a numerical double integral', () => {
  near(P.pUniform({ lo: 0, hi: 2 }, { lo: 1, hi: 3 }), 1 / 8, 1e-12); near(P.pUniform({ lo: 1, hi: 3 }, { lo: 0, hi: 2 }), 7 / 8, 1e-12); near(P.pUniform({ lo: 0, hi: 1 }, { lo: 0, hi: 1 }), .5, 1e-12);
  assert.equal(P.pUniform({ lo: 5, hi: 6 }, { lo: 0, hi: 1 }), 1); assert.equal(P.pUniform({ lo: 0, hi: 1 }, { lo: 5, hi: 6 }), 0);
  // nested ranges: A in [0,10], B in [4,6] is symmetric about 5
  near(P.pUniform({ lo: 0, hi: 10 }, { lo: 4, hi: 6 }), .5, 1e-12);
  const r = P.rng(9); for (let t = 0; t < 30; t++) {
    const a1 = r() * 50, a2 = a1 + .5 + r() * 30, b1 = r() * 50, b2 = b1 + .5 + r() * 30, N = 600; let s = 0;
    for (let i = 0; i < N; i++) { const a = a1 + (i + .5) / N * (a2 - a1); s += Math.min(1, Math.max(0, (a - b1) / (b2 - b1))) } // P(B <= a) averaged over a
    near(P.pUniform({ lo: a1, hi: a2 }, { lo: b1, hi: b2 }), s / N, 2e-4, 'case ' + t);
  }
});
test('certain timings give exactly 0 or 1, for every anchor and reference time', () => {
  for (const anchor of ['start', 'mid', 'end']) for (const ref of ['start', 'mid', 'end']) {
    const a = anchor === 'start' ? 50 : anchor === 'mid' ? 37.5 : 25, t = ref === 'start' ? 90 : ref === 'mid' ? 80 : 70;
    const early = pair(ev('x', 'trap', 90, 70, { ref }), {}, anchor).rows[0], late = pair(ev('x', 'trap', 20, 5, { ref }), {}, anchor).rows[0];
    assert.equal(early.p, 1, `${anchor}/${ref}`); assert.equal(early.pMC, 1); assert.equal(late.p, 0); assert.equal(late.pMC, 0); assert.ok(a < t);
  }
  const eq = pair(ev('x', 'trap', 60, 50), {}, 'start').rows[0]; assert.equal(eq.p, 1, 'same age counts as in time');
});
test('two uniform ranges: the timing table gives the closed form P(A >= B), and the seeded Monte Carlo agrees', () => {
  // charge start U[44,56]; trap end U[45,65] (older = before charge)
  const t = pair(ev('trap', 'trap', 70, 55, { dist: 'uni', endMin: 45, endMax: 65 }), { dist: 'uni', startMin: 44, startMax: 56 }, 'start'), r = t.rows[0];
  assert.equal(r.method, 'analytic'); near(r.p, P.pUniform({ lo: 45, hi: 65 }, { lo: 44, hi: 56 }), 1e-12);
  near(r.pMC, r.p, 4 * Math.sqrt(r.p * (1 - r.p) / t.n), 'MC vs analytic');
  // midpoint of the charge event with certain ends: still analytic
  const mid = P.timing([ev('charge', 'generation-migration', 50, 30), ev('trap', 'trap', 70, 45, { dist: 'uni', endMin: 35, endMax: 55 })], { charge: 0, anchor: 'mid' }).rows[0];
  assert.equal(mid.method, 'analytic'); near(mid.p, (55 - 40) / (55 - 35), 1e-12);
});
test('triangular and midpoint cases use the seeded Monte Carlo, which matches a numerical integration of the CDFs', () => {
  const x = ev('trap', 'trap', 70, 55, { endMin: 45, endMax: 68 }), c = { startMin: 44, startMax: 60 }, t = pair(x, c, 'start'), r = t.rows[0];
  assert.equal(r.method, 'Monte Carlo'); const A = P.varOf(x, 'end'), B = P.varOf(ev('c', 'generation-migration', 50, 25, c), 'start');
  let s = 0, N = 20000; for (let i = 0; i < N; i++) { const b = B.lo + (i + .5) / N * (B.hi - B.lo), h = 1e-6; s += (P.cdfVar(B, b + h) - P.cdfVar(B, b - h)) / (2 * h) * (1 - P.cdfVar(A, b)) * (B.hi - B.lo) / N } // P(A >= B) = int f_B(b) (1 - F_A(b)) db
  near(r.p, s, 4 * Math.sqrt(s * (1 - s) / t.n), 'MC vs quadrature'); assert.ok(s > .3 && s < .95, 'a non-trivial case: ' + s);
  const again = pair(x, c, 'start').rows[0]; assert.equal(again.p, r.p, 'same seed, same result');
  const other = pair(x, c, 'start', { seed: 11 }).rows[0]; assert.notEqual(other.p, r.p);
  // the samplers reproduce the analytic means
  const rg = P.rng(2); for (const v of [P.varOf(x, 'end'), P.varOf(ev('u', 'trap', 60, 40, { dist: 'uni', endMin: 30, endMax: 45 }), 'end')]) { let a = 0; for (let i = 0; i < 100000; i++) a += P.sampleVar(v, rg()); near(a / 100000, P.meanVar(v), .1, v.kind) }
});
test('monotonicity: moving the trap later (younger) lowers the probability, a later charge raises it', () => {
  let prev = 2; for (const shift of [0, 5, 10, 15, 20, 30]) {
    const p = pair(ev('trap', 'trap', 70 - shift, 55 - shift, { endMin: 50 - shift, endMax: 60 - shift }), { startMin: 44, startMax: 56 }, 'start').rows[0].p; assert.ok(p <= prev + 1e-3, `shift ${shift}: ${p} > ${prev}`); prev = p
  } assert.ok(prev < .01);
  let q = -1; for (const cs of [60, 52, 45, 38, 30]) { const p = pair(ev('trap', 'trap', 70, 40, { endMin: 35, endMax: 48 }), { start: cs, end: 10, startMin: cs - 5, startMax: cs + 5 }, 'start').rows[0].p; assert.ok(p >= q - 1e-3, 'charge ' + cs); q = p }
  // a wider uncertainty on a certain-late trap cannot make it certain
  const wide = pair(ev('trap', 'trap', 70, 40, { dist: 'uni', endMin: 20, endMax: 60 }), {}, 'start').rows[0]; assert.ok(wide.p > 0 && wide.p < 1);
});
test('overall timing risk is the product of the included events; the joint probability stays within [product-ish bounds]', () => {
  const evs = [ev('charge', 'generation-migration', 50, 25, { startMin: 44, startMax: 58 }), ev('trap', 'trap', 70, 55, { endMin: 48, endMax: 62 }), ev('seal', 'seal', 100, 90, { endMin: 80, endMax: 96 }), ev('res', 'reservoir', 120, 100, { inc: false })];
  const t = P.timing(evs, { charge: 0, anchor: 'start', seed: 3, n: 200000 }), inc = t.rows.filter(r => r.inc);
  assert.equal(inc.length, 2); near(t.product, inc[0].p * inc[1].p, 1e-12); assert.equal(t.nInc, 2);
  assert.ok(t.joint != null && t.joint >= Math.max(0, inc[0].p + inc[1].p - 1) - .01 && t.joint <= Math.min(inc[0].p, inc[1].p) + .01, 'Frechet bounds ' + t.joint);
  const none = P.timing(evs.map(e => Object.assign({}, e, { inc: false })), { charge: 0 }); assert.equal(none.product, null); assert.equal(none.joint, null);
  const flag = P.timing(evs, { charge: 0, anchor: 'start', threshold: .99 }); assert.ok(flag.flagged >= 1); assert.equal(P.timing(evs, { charge: 0, threshold: 0 }).flagged, 0);
  assert.ok(P.timing([ev('a', 'trap', 10, 20)], { charge: 0 }).err, 'invalid charge event'); assert.ok(P.timing(evs, { charge: 9 }).err);
  assert.ok(P.timing([evs[0], ev('bad', 'trap', 10, 20)], { charge: 0 }).rows[0].err, 'invalid other event reported, not computed');
});
test('validation of events', () => {
  assert.match(P.validateEvent(ev('a', 'trap', 10, 20)), /older/); assert.match(P.validateEvent(ev('a', 'trap', 20, 10, { startMin: 25 })), /min/); assert.match(P.validateEvent(ev('a', 'trap', 20, 10, { endMax: 5 })), /max/);
  assert.equal(P.validateEvent(ev('a', 'trap', 20, 10, { startMin: 18, startMax: 25, endMin: 8, endMax: 12 })), null); assert.match(P.validateEvent(ev('a', 'trap', 20, -1)), /≥ 0/);
});
test('CSV export then import returns the same events; quotes, ; delimiter, unknown categories and bad rows are handled', () => {
  const E = P.example('A').events; E[0].name = 'Source, "Upper" Jurassic'; const back = P.parseCSV(P.toCSV(E));
  assert.deepEqual(back.events, E); assert.equal(back.warn.length, 0);
  const semi = P.parseCSV('name;category;start;end\nA;seal;100;90\nB;weird;50;60\n'); assert.equal(semi.events.length, 2); assert.equal(semi.events[1].cat, 'other'); assert.equal(semi.warn.length, 2);
  assert.throws(() => P.parseCSV('name,start\nA,1\n')); assert.throws(() => P.parseCSV('name,start,end\n'));
});
test('JSON round trip, format check, charge index repaired, critical-moment default', () => {
  const M = P.example('B'); M.critical = 33; const back = P.fromJSON(JSON.parse(JSON.stringify(M))); assert.deepEqual(back, M);
  assert.throws(() => P.fromJSON({ format: 'other' })); const bad = JSON.parse(JSON.stringify(M)); bad.risk.charge = 99; assert.equal(P.fromJSON(bad).events[P.fromJSON(bad).risk.charge].cat, 'generation-migration');
  near(P.criticalDefault(M.events), 37.5, 1e-12); assert.equal(P.criticalDefault([ev('x', 'trap', 10, 5)]), null);
});
test('examples are valid; example A has a better timing chance than example B', () => {
  const run = k => { const M = P.example(k); for (const e of M.events) assert.equal(P.validateEvent(e), null, e.name); return P.timing(M.events, Object.assign({}, M.risk)) };
  const a = run('A'), b = run('B'); assert.ok(a.product > .5 && b.product < .1 && a.product > b.product, `${a.product} ${b.product}`);
});
test('axis helpers: nice ticks inside the range, automatic range covers the events and their uncertainty', () => {
  const t = P.ticks(160, 0, 8); assert.ok(t.every(x => x >= 0 && x <= 160)); assert.deepEqual(t.slice(0, 3), [0, 20, 40]); const r = P.autoRange(P.example('A').events, 37.5);
  assert.ok(r.from >= 163 && r.to === 0 && r.from <= 538.8); assert.deepEqual(P.autoRange([], null), { from: 200, to: 0 });
});
console.log(`\n${n} tests passed`);
