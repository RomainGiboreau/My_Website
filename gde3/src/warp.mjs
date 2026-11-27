// Optional local warping of d around contradictory wells: bounded amplitude (|offset| <= maxAmp) and bounded radius (zero beyond radius).
// Offset = sum(delta_i bump_i) / max(1, sum bump_i), a weighted average so it never exceeds the largest delta; it is switched off
// near the consistent wells (protect zone, 0.4 radius), so warping can never break a well that the belts already honour.
const bump = u => (u >= 1 ? 0 : (1 - u * u) ** 2);
const ramp = u => (u >= 1 ? 1 : u * u * (3 - 2 * u));

// needed offset of d so that a well described as belts [a, b] falls well inside them (margin 35 % of the interval), clipped to +-maxAmp
export function neededOffset(d, [a, b], t, w, maxAmp) {
  const lo = a > 0 ? t[a - 1] : -Infinity, hi = b < t.length ? t[b] : Infinity;
  let target;
  if (isFinite(lo) && isFinite(hi)) { const m = 0.35 * (hi - lo); target = Math.min(hi - m, Math.max(lo + m, d)); }
  else if (isFinite(lo)) target = Math.max(d, lo + 0.35 * w);
  else target = Math.min(d, hi - 0.35 * w);
  return Math.min(maxAmp, Math.max(-maxAmp, target - d));
}

export function makeWarp(targets, protect, { radius, maxAmp }) {
  if (!targets.length) return null;
  const Rp = 0.4 * radius;
  return (x, y) => {
    let s = 0, f = 0;
    for (const q of targets) { const b = bump(Math.hypot(x - q.x, y - q.y) / radius); s += q.delta * b; f += b; }
    if (!f) return 0;
    let h = 1;
    for (const q of protect) h *= ramp(Math.hypot(x - q.x, y - q.y) / Rp);
    return Math.min(maxAmp, Math.max(-maxAmp, (s / Math.max(1, f)) * h));
  };
}
