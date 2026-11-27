// Proximal-distal field d(x, y) from key lines. Each key line carries the value v of d it sits at
// (the prior threshold of the belt boundary it marks). Landward of the first line d = v0 + signed distance (negative);
// between two lines d runs linearly in the normalised coordinate a / (a + b) (belts widen where the lines are far apart);
// beyond the last line d = vL + signed distance. d is continuous and increases from the land side to the distal side.
import { signedDist } from './geometry.mjs';

export function makeField(lines) {
  const L = lines.slice().sort((p, q) => p.v - q.v);
  if (!L.length) throw new Error('at least one key line is required');
  return (x, y) => {
    let s = signedDist(L[0].pts, x, y);
    if (s < 0) return L[0].v + s;
    for (let i = 0; i + 1 < L.length; i++) {
      const s1 = signedDist(L[i + 1].pts, x, y);
      if (s1 < 0) return L[i].v + (s / (s - s1)) * (L[i + 1].v - L[i].v);
      s = s1;
    }
    return L[L.length - 1].v + s;
  };
}
