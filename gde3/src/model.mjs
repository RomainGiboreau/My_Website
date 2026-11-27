// Model = system record + key lines + wells -> thresholds (calibrated, minimum change), optional warping, classifier, verdicts.
import { SYSTEMS } from './systems.mjs';
import { resolveSystem, fringeAmps, makeClassifier, matchBelt } from './belts.mjs';
import { makeField } from './field.mjs';
import { proposeKeyLines } from './keylines.mjs';
import { calibrate, explain } from './calibrate.mjs';
import { neededOffset, makeWarp } from './warp.mjs';
import { wellVerdict, banner } from './verdict.mjs';

// opts: system (id), regime, km (scale), ext, az, seed, keyLines (default: proposed), wells [{name, x, y, env | b}],
//       warp {radius, maxAmp} | null, fringe (interfingering, default true)
export function buildModel(opts) {
  const sys = SYSTEMS[opts.system], seed = opts.seed || 1;
  const rs = resolveSystem(sys, { regime: opts.regime, spanM: (opts.km || sys.scale.km) * 1000 });
  const keyLines = opts.keyLines || proposeKeyLines(rs, opts.ext, { az: opts.az || 0, seed, wobble: opts.wobble, lobe: opts.lobe });
  const F = makeField(keyLines);
  const wells = (opts.wells || []).map((w, i) => ({ name: w.name || 'W-' + (i + 1), ...w, range: Array.isArray(w.b) ? w.b : typeof w.b === 'number' ? [w.b, w.b] : matchBelt(w.env, rs.belts) }));
  const d = wells.map(w => F(w.x, w.y));
  const useFringe = opts.fringe !== false, g0 = 0.005 * rs.p[rs.p.length - 1];   // g0: a well sits at least g0 inside its belt
  const gap = (useFringe ? fringeAmps(rs, rs.p) : rs.p.map(() => 0)).map(a => Math.max(a, g0));
  const cal = calibrate({ d, belts: wells.map(w => w.range), p: rs.p, w: rs.w, gap });
  const amps = useFringe ? fringeAmps(rs, cal.t).map((a, k) => Math.min(a, gap[k])) : null;   // never wider than the room kept for wells
  const wl = (rs.p[rs.p.length - 1] || 1) / 3;
  const cls = makeClassifier(cal.t, amps, { seed, wl }), wref = rs.w.slice(1, -1).reduce((a, v) => a + v, 0) / Math.max(1, rs.w.length - 2);

  let warp = null;
  const wo = opts.warp, bad = cal.excluded;
  if (wo && bad.length) {
    const targets = bad.map(i => ({ x: wells[i].x, y: wells[i].y, delta: neededOffset(d[i], wells[i].range, cal.t, wref, wo.maxAmp) }));
    warp = makeWarp(targets, cal.kept.map(i => wells[i]), wo);
  }
  const D = warp ? (x, y) => F(x, y) + warp(x, y) : F;
  const classPlain = (x, y) => cls(x, y, F(x, y)), classAt = (x, y) => cls(x, y, D(x, y));
  const names = wells.map(w => w.name), bn = rs.belts.map(b => b.name);
  const verdicts = wells.map(w => wellVerdict(w.range, classPlain(w.x, w.y), classAt(w.x, w.y)));
  const conflicts = bad.map(i => ({ well: wells[i].name, msg: explain(i, d, wells.map(w => w.range), cal.kept, names, bn) }));
  return { rs, keyLines, F, D, wells, d, t: cal.t, prior: rs.p, lo: cal.lo, hi: cal.hi, kept: cal.kept, excluded: bad, conflicts, warp: !!warp,
    classAt, classPlain, verdicts, banner: banner(verdicts), cost: cal.cost,
    classGrid: g => { const o = new Uint8Array(g.nx * g.ny); for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) o[j * g.nx + i] = classAt(g.x(i), g.y(j)); return o; } };
}

export const changedFraction = (a, b) => { let n = 0; for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) n++; return n / a.length; };
