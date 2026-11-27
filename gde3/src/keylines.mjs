// Proposed key lines: lines perpendicular to the transport azimuth, spaced like the prior thresholds, with a seeded smooth wobble
// (and an optional lobe) so the shoreline is not straight. Returns [{ name, k, v, pts }]; every line has its distal side on the right.
import { smooth } from './geometry.mjs';
import { mulberry32 } from './rng.mjs';

export function proposeKeyLines(rs, ext, { az = 0, seed = 1, wobble = 0.03, lobe = 0 } = {}) {
  const a = az * Math.PI / 180, ux = Math.sin(a), uy = Math.cos(a), ex = -uy, ey = ux;
  const cx = (ext.xmin + ext.xmax) / 2, cy = (ext.ymin + ext.ymax) / 2, diag = Math.hypot(ext.xmax - ext.xmin, ext.ymax - ext.ymin);
  const r = mulberry32(seed), ks = rs.sys.keyLines, ph = [r() * 6.28, r() * 6.28];
  const pivot = ks.reduce((s, [, k]) => s + rs.p[k], 0) / ks.length;
  // the lines share the same wobble (a shelf edge follows the shoreline); the total amplitude is capped so that neighbouring lines stay apart
  const gapMin = Math.min(...ks.slice(1).map(([, k], i) => rs.p[k] - rs.p[ks[i][1]]), Infinity);
  const amp = wobble * diag + lobe * diag, cap = Math.min(1, isFinite(gapMin) && amp > 0 ? 2 * gapMin / amp : 1);
  return ks.map(([name, k], li) => {
    const f = cap * (1 - 0.15 * li), pts = [];
    for (let i = -6; i <= 6; i++) {
      const s = (i / 6) * 0.75 * diag, off = rs.p[k] - pivot;
      const o = f * (wobble * diag * (Math.sin(s / (0.35 * diag) * 6.28 + ph[0]) + 0.5 * Math.sin(s / (0.17 * diag) * 6.28 + ph[1])) + lobe * diag * Math.exp(-((s / (0.18 * diag)) ** 2)));
      pts.push([cx + ex * s + ux * (off + o), cy + ey * s + uy * (off + o)]);
    }
    return { name, k, v: rs.p[k], pts: smooth(pts) };
  });
}
