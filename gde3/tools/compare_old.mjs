// Old core vs v3 on the same acceptance sets (A shoreface, C platform: both linear in the old tool; the old delta is radial, not comparable).
// Run: node gde3/tools/compare_old.mjs
import { loadOld, oldGrid } from './old_core.mjs';
import { buildModel, changedFraction } from '../src/model.mjs';
import { makeGrid } from '../src/geometry.mjs';
import { SETS, EXT, setOpts, setWells } from './acceptance.mjs';

const G = loadOld(), N = 60, grid = makeGrid(EXT, N), TPL = { A: 'shelf', C: 'carbonate' };
const pct = f => (100 * f).toFixed(1).padStart(5) + '%';
for (const key of ['A', 'C']) {
  const S = SETS[key], wells = setWells(S), m0 = buildModel({ ...setOpts(S), wells: [] });
  const M = G.makeModel(TPL[key], { ext: EXT, az: 0, src: [50000, 50000 - m0.keyLines.reduce((s, l) => s + l.v, 0) / m0.keyLines.length], span: S.km * 1000, cell: 1000, noise: { amp: 0, wl: 5000, seed: 1 } });
  const runNew = ws => { const m = buildModel({ ...setOpts(S), wells: ws }); return { g: m.classGrid(grid), ok: !m.excluded.length, honoured: m.banner.state === 'pass' }; };
  const runOld = ws => { const { grid: g, mod } = oldGrid(G, M, ws, N); return { g, ok: mod.cal.ok, honoured: mod.check.every(c => c.honoured) }; };
  console.log(`\nSet ${key} (${S.title}); base: new honoured=${runNew(wells).honoured}, old honoured=${runOld(wells).honoured}`);
  for (const [tool, run] of [['old', runOld], ['new', runNew]]) {
    const g0 = run(wells).g; let m5 = 0, worst = 0, steps = 0, big = 0, where = '';
    for (let wi = 0; wi < wells.length; wi++) for (const ax of ['x', 'y']) {
      let prev = null;
      for (let s = -0.04; s <= 0.04 + 1e-9; s += 0.001) {
        const r = run(wells.map((w, i) => (i === wi ? { ...w, [ax]: w[ax] + s * 100000 } : w)));
        if (prev && prev.ok && r.ok) { const f = changedFraction(prev.g, r.g); steps++; if (f > 0.02) big++; if (f > worst) { worst = f; where = `W${wi + 1} ${ax} at ${(100 * s).toFixed(1)}%`; } }
        prev = r;
      }
      for (const sg of [-1, 1]) { const r = run(wells.map((w, i) => (i === wi ? { ...w, [ax]: w[ax] + sg * 5000 } : w))); if (r.ok) m5 = Math.max(m5, changedFraction(g0, r.g)); }
    }
    console.log(`  ${tool}: 5 % move max change ${pct(m5)}; sweeps +-4 % step 0.1 %: worst step ${pct(worst)} (${where}), steps above 2 %: ${big}/${steps}`);
  }
}

// Case found by scanning the old tool: 5 wells on a shelf (old source at y = 0, so d = y), W1 (coastal plain) moved in y in steps of 0.5 % of the width.
{
  const wells = [['W1', 50000, 20000, 'coastal plain'], ['W2', 40000, 38000, 'shoreface'], ['W3', 60000, 45000, 'offshore transition'], ['W4', 45000, 62000, 'offshore shelf'], ['W5', 55000, 85000, 'slope']].map(([name, x, y, env]) => ({ name, x, y, env }));
  const M = G.makeModel('shelf', { ext: EXT, az: 0, src: [50000, 0], span: 60000, cell: 1000, noise: { amp: 0, wl: 5000, seed: 1 } });
  const cy = buildModel({ system: 'shoreface', km: 60, ext: EXT, az: 0, wobble: 0, wells: [] }).keyLines.reduce((s, l) => s + l.v, 0) / 3;   // new ext centred so that d = y as well
  const E2 = { xmin: 0, xmax: 100000, ymin: cy - 50000, ymax: cy + 50000 }, g2 = makeGrid(E2, N);
  console.log('\nCase "old absurd": W1 (coastal plain) moved in y, steps of 0.5 % of the width, -10 % .. +10 %');
  for (const tool of ['old', 'new']) {
    let prev = null, worst = 0, at = '';
    for (let s = -20; s <= 20; s++) {
      const ws = wells.map((w, i) => (i ? w : { ...w, y: w.y + s * 500 }));
      let r;
      if (tool === 'old') { const o = oldGrid(G, M, ws, N); r = { g: o.grid, ok: o.mod.cal.ok, t0: o.mod.cal.t[0] }; }
      else { const m = buildModel({ system: 'shoreface', km: 60, ext: E2, az: 0, wobble: 0, wells: ws }); r = { g: m.classGrid(g2), ok: !m.excluded.length, t0: m.t[0] }; }
      if (prev && prev.ok && r.ok) { const f = changedFraction(prev.g, r.g); if (f > worst) { worst = f; at = `${(s * 0.5).toFixed(1)} %: first threshold ${Math.round(prev.t0)} -> ${Math.round(r.t0)}`; } }
      prev = r;
    }
    console.log(`  ${tool}: worst step ${pct(worst)} (at ${at})`);
  }
}
