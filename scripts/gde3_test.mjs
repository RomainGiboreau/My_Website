// Tests of the GDE v3 core (gde3/src). Run: node scripts/gde3_test.mjs
import assert from 'node:assert/strict';
import { buildModel, changedFraction } from '../gde3/src/model.mjs';
import { SYSTEMS } from '../gde3/src/systems.mjs';
import { validateSystem, resolveSystem, matchBelt, classify } from '../gde3/src/belts.mjs';
import { makeGrid, signedDist } from '../gde3/src/geometry.mjs';
import { mulberry32 } from '../gde3/src/rng.mjs';
import { banner } from '../gde3/src/verdict.mjs';
import { SETS, EXT, setOpts, setWells } from '../gde3/tools/acceptance.mjs';

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const SYS = Object.keys(SYSTEMS);
const GRID = makeGrid(EXT, 100), SGRID = makeGrid(EXT, 60);
const pct = f => (100 * f).toFixed(2) + '%';
// bounds set after measuring (see gde3/README.md): share of cells changed. step: one row of the 60 x 60 grid is 1.7 %, a boundary
// crossing a row centre moves a whole row, so two boundaries at once = 3.3 %
const BOUNDS = { move5: 0.08, step: 0.035, warp: 0.05, onset: 0.08 };

// ---------- data ----------
test('systems: records valid (belts, adjacency, fringes), exactly 3 systems', () => {
  assert.deepEqual(SYS, ['shoreface', 'delta', 'platform']);
  for (const id of SYS) assert.deepEqual(validateSystem(SYSTEMS[id]), [], id);
  for (const id of SYS) for (const r of SYSTEMS[id].refs) assert.ok(['published', 'memory', 'to verify', 'inference'].includes(r.status));
});
test('matchBelt: names, aliases, "A / B" pairs, unknown', () => {
  const b = SYSTEMS.shoreface.belts;
  assert.deepEqual(matchBelt('Shoreface', b), [1, 1]);
  assert.deepEqual(matchBelt('HCS sandstone', b), [2, 2]);
  assert.deepEqual(matchBelt('shoreface / offshore transition', b), [1, 2]);
  assert.equal(matchBelt('reef', b), null);
  assert.equal(matchBelt('coastal plain / slope', b), null);
});
test('geometry: signed distance, right side positive, rays extend the ends', () => {
  const L = [[0, 0], [10, 0]];
  assert.ok(signedDist(L, 5, -3) > 0 && signedDist(L, 5, 3) < 0, 'right of travel (+x) is -y');
  assert.equal(Math.abs(signedDist(L, 50, 2)), 2);
});

// ---------- (1) logic invariants ----------
function randomWells(rs, r, n, truth) {
  const names = rs.belts.map(b => b.name), w = [];
  for (let i = 0; i < n; i++) w.push({ x: EXT.xmax * r(), y: EXT.ymax * r(), env: names[truth ? truth(i) : Math.floor(r() * names.length)] });
  return w;
}
let skips = 0;   // belts thinner than one cell stepped over (resolution, not logic)
function checkLogic(m, label) {
  const g = GRID, c = m.classGrid(g), d = new Float64Array(c.length), rs = m.rs;
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) d[j * g.nx + i] = m.D(g.x(i), g.y(j));
  const ids = rs.belts.map(b => b.id), fr = new Set(Object.keys(rs.fringe).filter(k => rs.fringe[k] > 0));
  const pair = (a, b) => ids[a] + '|' + ids[b];
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const k = j * g.nx + i;
    for (const k2 of [i + 1 < g.nx ? k + 1 : -1, j + 1 < g.ny ? k + g.nx : -1]) {
      if (k2 < 0 || c[k] === c[k2]) continue;
      const a = Math.min(c[k], c[k2]), b = Math.max(c[k], c[k2]);
      if (b - a > 1) {   // a belt thinner than a cell can be stepped over: allowed only if d is continuous (jump <= 3 cells) and every consecutive pair is allowed
        assert.ok(Math.abs(d[k] - d[k2]) <= 3 * g.dx, `${label}: d jumps by ${Math.abs(d[k] - d[k2])}`);
        for (let q = a; q < b; q++) assert.ok(rs.adj.has(pair(q, q + 1)), `${label}: ${ids[q]} next to ${ids[q + 1]} not allowed`);
        skips++; continue;
      }
      assert.ok(rs.adj.has(pair(c[k], c[k2])), `${label}: ${ids[c[k]]} touches ${ids[c[k2]]} (not allowed)`);
      const [lo, hi] = d[k] < d[k2] ? [c[k], c[k2]] : [c[k2], c[k]];   // the proximal side carries the more proximal belt (except fringes)
      assert.ok(lo < hi || fr.has(pair(hi, lo)), `${label}: order inverted ${ids[lo]} / ${ids[hi]}`);
    }
  }
}
test('logic: every system, many seeds / key-line shapes / well sets: allowed neighbours only, proximal -> distal order', () => {
  let n = 0;
  for (const id of SYS) {
    const regs = SYSTEMS[id].regimes ? Object.keys(SYSTEMS[id].regimes.options) : [undefined];
    for (const regime of regs) for (let seed = 1; seed <= 14; seed++) {
      const r = mulberry32(seed * 31 + id.length), rs = resolveSystem(SYSTEMS[id], { regime, spanM: 60000 });
      const wells = randomWells(rs, r, 3 + Math.floor(r() * 6), seed % 2 ? null : i => i % rs.belts.length);   // odd seeds: arbitrary, possibly contradictory
      const m = buildModel({ system: id, regime, km: 40 + 30 * r(), ext: EXT, az: 360 * r(), seed, wobble: 0.04 * r(), lobe: 0.1 * r(), wells, warp: seed % 3 ? { radius: 12000, maxAmp: 5000 } : null });
      checkLogic(m, `${id}/${regime}/${seed}`); n++;
    }
  }
  console.log(`   ${n} random configurations checked (${skips} sub-cell belt pinches stepped over)`);
});
test('logic: contradictory wells with warping still give allowed neighbours only', () => {
  const w = [{ x: 50000, y: 30000, env: 'Basin' }, { x: 50000, y: 70000, env: 'Tidal flat / sabkha' }, { x: 52000, y: 31000, env: 'Platform margin (reef / shoal)' }];
  checkLogic(buildModel({ system: 'platform', ext: EXT, az: 0, km: 60, wells: w, warp: { radius: 15000, maxAmp: 9000 } }), 'contradictory');
});

// ---------- (3) wells ----------
// wells sampled from a truth map whose thresholds are the prior widths jittered by +-40 % (so the prior is NOT the truth)
function truthWells(id, seed, n) {
  const r = mulberry32(seed), rs = resolveSystem(SYSTEMS[id], { spanM: 60000 }), m0 = buildModel({ system: id, km: 60, ext: EXT, az: 0, seed, wobble: 0.02, wells: [] });
  let acc = rs.p[0]; const tt = rs.p.map((v, k) => (k ? acc += (v - rs.p[k - 1]) * (0.6 + 0.8 * r()) : acc));
  const wells = [], marg = 0.3 * Math.max(...rs.w.slice(1, -1));   // keep clear of the boundaries: a well inside an interfingering zone cannot be guaranteed
  while (wells.length < n) {
    const x = EXT.xmax * r(), y = 0.65 * EXT.ymax * r(), d = m0.F(x, y);
    if (tt.some(t => Math.abs(d - t) < marg)) continue;
    wells.push({ name: 'T' + wells.length, x, y, b: classify(d, tt) });
  }
  return wells;
}
test('wells: a consistent set (sampled from a truth map) is honoured by the belts, no conflict, banner green', () => {
  for (const id of SYS) for (let seed = 1; seed <= 25; seed++) {
    const m = buildModel({ system: id, km: 60, ext: EXT, az: 0, seed, wobble: 0.02, wells: truthWells(id, seed, 8) });
    assert.equal(m.excluded.length, 0, `${id}/${seed}: ${m.conflicts.map(c => c.msg)}`);
    assert.equal(m.banner.state, 'pass', `${id}/${seed}`);
    assert.ok(m.verdicts.every(v => v === 'belts'));
  }
});
test('calibration: minimum change (no feasible perturbation is closer to the prior), solution inside the feasible intervals', () => {
  const r = mulberry32(5);
  for (const id of SYS) for (let seed = 1; seed <= 6; seed++) {
    const m = buildModel({ system: id, km: 60, ext: EXT, az: 0, seed, wobble: 0.02, wells: truthWells(id, seed, 6), fringe: false });
    const om = m.prior.map((_, k) => 1 / ((m.rs.w[k] + m.rs.w[k + 1]) / 2) ** 2), cost = t => t.reduce((a, v, k) => a + om[k] * (v - m.prior[k]) ** 2, 0);
    const g0 = 0.005 * m.prior[m.prior.length - 1];
    const feas = t => t.every((v, k) => k === 0 || v - t[k - 1] >= 0.1 * m.rs.w[k] - 1e-6) && m.kept.every(i => classify(m.d[i] - g0, t) === m.wells[i].range[0] && classify(m.d[i] + g0, t) === m.wells[i].range[0]);
    assert.ok(feas(m.t));
    m.t.forEach((v, k) => assert.ok(v >= m.lo[k] - 1e-6 && v <= m.hi[k] + 1e-6));
    let tried = 0;
    for (let q = 0; q < 600; q++) { const t2 = m.t.map((v, k) => v + (r() - 0.5) * 0.3 * m.rs.w[k]); if (feas(t2)) { tried++; assert.ok(cost(t2) >= cost(m.t) - 1e-9, `${id}/${seed}`); } }
  }
});
test('wells: a contradictory well is reported, the map is not scrambled (no warping: only the bad well differs; warping: bounded)', () => {
  let worst = 0, worstW = 0, cnt = 0;
  for (const id of SYS) for (let seed = 1; seed <= 20; seed++) {
    const wells = truthWells(id, seed, 8), o = { system: id, km: 60, ext: EXT, az: 0, seed, wobble: 0.02 };
    const m0 = buildModel({ ...o, wells });
    const bad = { name: 'BAD', x: 20000 + 10000 * (seed % 5), y: 88000, b: 0 };   // the most proximal belt far out in the basin
    if (wells.every(w => w.b === 0)) continue;   // nothing for the bad well to contradict
    const mc = buildModel({ ...o, wells: [...wells, bad] }), mw = buildModel({ ...o, wells: [...wells, bad], warp: { radius: 12000, maxAmp: 30000 } });
    assert.ok(mc.conflicts.some(c => c.well === 'BAD'), `${id}/${seed} not reported: ${mc.excluded}`);
    assert.equal(mc.banner.state, 'bad');
    const f = changedFraction(m0.classGrid(SGRID), mc.classGrid(SGRID)), fw = changedFraction(m0.classGrid(SGRID), mw.classGrid(SGRID));
    worst = Math.max(worst, f); worstW = Math.max(worstW, fw); cnt++;
    assert.ok(mw.warp);
  }
  console.log(`   ${cnt} cases; map change vs the set without the bad well: no warping max ${pct(worst)}, warping max ${pct(worstW)}`);
  assert.ok(cnt >= 20 && worst <= BOUNDS.warp && worstW <= BOUNDS.warp, `change ${worst} ${worstW}`);
});
test('verdict: banner rule (green only if all matched and honoured); unmatched well', () => {
  assert.equal(banner([]).state, 'none');
  assert.equal(banner(['belts', 'warping']).state, 'pass');
  assert.equal(banner(['belts', 'unmatched']).state, 'warn');
  assert.equal(banner(['belts', 'unmatched', 'not']).state, 'bad');
  const m = buildModel({ system: 'shoreface', km: 60, ext: EXT, az: 0, wells: [{ x: 50000, y: 40000, env: 'moon dust' }] });
  assert.deepEqual(m.verdicts, ['unmatched']); assert.equal(m.banner.state, 'warn');
});
test('verdict: a warped well is "honoured by warping", without warping "not honoured"; consistent wells stay on the belts', () => {
  const w = [{ name: 'a', x: 50000, y: 20000, env: 'Coastal plain' }, { name: 'b', x: 50000, y: 30000, env: 'Offshore shelf' }, { name: 'c', x: 50000, y: 40000, env: 'Coastal plain' }, { name: 'd', x: 50000, y: 60000, env: 'Slope' }];
  const o = { system: 'shoreface', km: 60, ext: EXT, az: 0, wells: w };
  const a = buildModel(o), b = buildModel({ ...o, warp: { radius: 20000, maxAmp: 30000 } });
  assert.equal(a.excluded.length, 1); const e = a.excluded[0];
  assert.equal(a.verdicts[e], 'not'); assert.equal(a.banner.state, 'bad');
  assert.equal(b.verdicts[e], 'warping'); assert.equal(b.banner.state, 'pass');
  b.verdicts.forEach((v, i) => i === e || assert.equal(v, 'belts'));
});

// ---------- (2) stability on the 3 acceptance sets ----------
const sweep = (S, wells, wi, axis, from, to, step) => {
  const out = [];
  for (let s = from; s <= to + 1e-9; s += step) {
    const m = buildModel({ ...setOpts(S), wells: wells.map((w, i) => (i === wi ? { ...w, [axis]: w[axis] + s * 100000 } : w)) });
    out.push({ s, g: m.classGrid(SGRID), ok: m.excluded.length === 0 });
  }
  return out;
};
const maxStep = sw => { let mx = 0; for (let i = 1; i < sw.length; i++) if (sw[i].ok && sw[i - 1].ok) mx = Math.max(mx, changedFraction(sw[i - 1].g, sw[i].g)); return mx; };
test('stability: moving one well by 1-5 % of the map width changes a bounded share of cells; the sweep has no jump', () => {
  for (const [key, S] of Object.entries(SETS)) {
    const wells = setWells(S), base = buildModel({ ...setOpts(S), wells }), g0 = base.classGrid(SGRID);
    assert.equal(base.banner.state, 'pass', key + ' base set must be consistent and honoured');
    let w5 = 0, all = 0;
    for (let wi = 0; wi < wells.length; wi++) for (const axis of ['x', 'y']) for (const sg of [-1, 1]) for (const p of [0.01, 0.03, 0.05]) {
      const m = buildModel({ ...setOpts(S), wells: wells.map((w, i) => (i === wi ? { ...w, [axis]: w[axis] + sg * p * 100000 } : w)) });
      if (m.excluded.length) continue;                       // a move that creates a contradiction is tested separately
      const f = changedFraction(g0, m.classGrid(SGRID)); all = Math.max(all, f); if (p === 0.05) w5 = Math.max(w5, f);
    }
    const sw = sweep(S, wells, S.moved, 'y', -0.04, 0.04, 0.001), ms = maxStep(sw);
    console.log(`   set ${key}: max change for 1-5 % moves ${pct(all)} (5 %: ${pct(w5)}); sweep +-4 % step 0.1 %: max step change ${pct(ms)}, consistent ${sw.filter(q => q.ok).length}/${sw.length}`);
    assert.ok(w5 <= BOUNDS.move5, `${key} 5% move ${w5}`);
    assert.ok(ms <= BOUNDS.step, `${key} step ${ms}`);
  }
});
test('stability: onset of a contradiction (a well crossing its neighbour) is reported, the change at the onset stays bounded', () => {
  const S = SETS.A, wells = setWells(S), sw = sweep(S, wells, 3, 'y', -0.5, 0.0, 0.005);
  let jump = 0, flips = 0;
  for (let i = 1; i < sw.length; i++) if (sw[i].ok !== sw[i - 1].ok) { flips++; jump = Math.max(jump, changedFraction(sw[i - 1].g, sw[i].g)); }
  console.log(`   onset: ${flips} switch(es) consistent <-> contradictory, change at the switch ${pct(jump)}`);
  assert.ok(sw.some(q => !q.ok) && jump <= BOUNDS.onset);
});

// ---------- (4) reproducibility ----------
test('reproducible: same input + seed = same map and verdicts; another seed = another shoreline', () => {
  const S = SETS.B, o = { ...setOpts(S), wells: setWells(S), warp: { radius: 9000, maxAmp: 4000 } };
  const a = buildModel(o), b = buildModel(o), c = buildModel({ ...o, seed: 8 });
  assert.deepEqual(Array.from(a.classGrid(GRID)), Array.from(b.classGrid(GRID)));
  assert.deepEqual(a.verdicts, b.verdicts); assert.deepEqual(a.t, b.t);
  assert.ok(changedFraction(a.classGrid(GRID), c.classGrid(GRID)) > 0.001);
});

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n' + String(e.stack || e).split('\n').slice(0, 6).join('\n')); }
}
console.log(fail ? `${fail} failed` : `${tests.length} tests passed`);
process.exit(fail ? 1 : 0);
