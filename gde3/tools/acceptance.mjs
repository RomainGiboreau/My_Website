// Three synthetic acceptance well sets (documented in gde3/README.md). Wells are placed from (environment, x, position in the prior belt):
// y is found so that the field d lies at that fraction of the belt's PRIOR extent (0 = proximal limit, 1 = distal limit); a fraction
// above 1 makes the well pull the thresholds away from the prior (the calibration has to move a boundary).
import { buildModel } from '../src/model.mjs';

export const EXT = { xmin: 0, xmax: 100000, ymin: 0, ymax: 100000 };
const W = 100000;

// wells: [environment, x (fraction of the width), position in the prior belt]; moved = index of the well that is moved in the tests
export const SETS = {
  A: { title: 'Shoreface-shelf, straight shoreline', system: 'shoreface', km: 60, wobble: 0, lobe: 0, moved: 2,
    wells: [['Coastal plain', 0.50, 0.5], ['Shoreface', 0.30, 0.5], ['Offshore transition', 0.65, 1.2], ['Offshore shelf', 0.40, 0.5], ['Slope', 0.55, 0.5]] },
  B: { title: 'Wave-dominated delta, lobate shoreline', system: 'delta', regime: 'wave', km: 60, wobble: 0.02, lobe: 0.08, moved: 2,
    wells: [['Delta plain', 0.50, 0.5], ['Delta front', 0.35, 0.5], ['Prodelta', 0.65, 1.2], ['Shelf', 0.45, 0.5], ['Slope', 0.55, 0.5]] },
  C: { title: 'Rimmed carbonate platform, straight margin', system: 'platform', km: 60, wobble: 0, lobe: 0, moved: 2,
    wells: [['Tidal flat / sabkha', 0.50, 0.5], ['Platform interior / lagoon', 0.35, 0.5], ['Open platform / back-reef', 0.65, 1.1], ['Platform margin (reef / shoal)', 0.45, 0.8], ['Fore-reef slope', 0.55, 0.5]] }
};

export function setOpts(S) { return { system: S.system, regime: S.regime, km: S.km, ext: EXT, az: 0, seed: 7, wobble: S.wobble, lobe: S.lobe }; }

// resolved wells [{ name, x, y, env }] for a set
export function setWells(S) {
  const m0 = buildModel({ ...setOpts(S), wells: [] }), rs = m0.rs, ids = rs.belts.map(b => b.name);
  return S.wells.map(([env, xf, f], i) => {
    const k = ids.indexOf(env), lo = k > 0 ? rs.p[k - 1] : rs.p[0] - rs.w[0], hi = k < rs.p.length ? rs.p[k] : rs.p[k - 1] + rs.w[k];
    const target = lo + f * (hi - lo), x = xf * W;
    let a = 0, b = W;
    for (let q = 0; q < 50; q++) { const mid = (a + b) / 2; if (m0.F(x, mid) < target) a = mid; else b = mid; }
    return { name: 'W' + (i + 1), x: Math.round(x), y: Math.round((a + b) / 2), env };
  });
}
