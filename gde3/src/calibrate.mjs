// Calibration of the belt thresholds on wells. Thresholds t[k] (between belt k and k + 1) must satisfy
//   well in belts [a, b] at d:  t[a-1] <= d - gap   and   t[b] >= d + gap;      belt k keeps a width >= minW[k].
// Among the feasible solutions, the one MINIMISING sum(((t - prior) / scale)^2) is returned (a projection of the prior on a convex set,
// so it varies continuously with the well positions). With c[k] = cumulated minimum widths, s = t - c must be non-decreasing:
// bounded isotonic regression = weighted pool-adjacent-violators, then clipped to the tightened bounds.
// Contradictory wells: the smallest set of wells whose removal makes the rest feasible (ties: lowest cost) is excluded and reported.

export function calibrate({ d, belts, p, w, gap, minFrac = 0.1, maxExclude = 4 }) {
  const n1 = p.length, N = d.length;
  gap = gap || p.map(() => 0);
  const minW = w.map(v => minFrac * v), c = [0];
  for (let k = 1; k < n1; k++) c.push(c[k - 1] + minW[k]);
  const om = p.map((_, k) => 1 / ((w[k] + w[k + 1]) / 2) ** 2);
  const usable = [];
  for (let i = 0; i < N; i++) if (belts[i] && Number.isFinite(d[i])) usable.push(i);

  const solve = idx => {
    const l = new Array(n1).fill(-Infinity), u = new Array(n1).fill(Infinity);
    for (const i of idx) {
      const [a, b] = belts[i];
      if (a > 0) u[a - 1] = Math.min(u[a - 1], d[i] - gap[a - 1]);
      if (b < n1) l[b] = Math.max(l[b], d[i] + gap[b]);
    }
    const L = [], U = new Array(n1);
    for (let k = 0, m = -Infinity; k < n1; k++) { m = Math.max(m, l[k] - c[k]); L.push(m); }
    for (let k = n1 - 1, m = Infinity; k >= 0; k--) { m = Math.min(m, u[k] - c[k]); U[k] = m; }
    const bad = []; for (let k = 0; k < n1; k++) if (L[k] > U[k]) bad.push(k);
    if (bad.length) return { ok: false, bad };
    // weighted PAVA on q = p - c
    const blocks = [];
    for (let k = 0; k < n1; k++) {
      blocks.push({ s: om[k] * (p[k] - c[k]), w: om[k], n: 1 });
      while (blocks.length > 1) {
        const B = blocks[blocks.length - 1], A = blocks[blocks.length - 2];
        if (A.s / A.w <= B.s / B.w) break;
        blocks.splice(-2, 2, { s: A.s + B.s, w: A.w + B.w, n: A.n + B.n });
      }
    }
    const t = []; for (const B of blocks) for (let q = 0; q < B.n; q++) t.push(B.s / B.w);
    for (let k = 0; k < n1; k++) t[k] = Math.min(U[k], Math.max(L[k], t[k])) + c[k];
    const cost = t.reduce((a, v, k) => a + om[k] * (v - p[k]) ** 2, 0);
    return { ok: true, t, cost, lo: L.map((v, k) => v + c[k]), hi: U.map((v, k) => v + c[k]) };
  };

  // smallest excluded set, ties broken by the lowest cost (closest to the prior)
  let best = null;
  const subsets = (arr, k, start = 0, cur = [], out = []) => {
    if (cur.length === k) { out.push(cur.slice()); return out; }
    for (let i = start; i < arr.length; i++) { cur.push(arr[i]); subsets(arr, k, i + 1, cur, out); cur.pop(); }
    return out;
  };
  for (let k = 0; k <= Math.min(maxExclude, usable.length) && !best; k++) {
    for (const ex of subsets(usable, k)) {
      const s = solve(usable.filter(i => !ex.includes(i)));
      if (s.ok && (!best || s.cost < best.cost - 1e-12)) best = { ...s, excluded: ex };
    }
  }
  let keep = usable.slice();
  if (!best) { // greedy fallback for many contradictions: drop the well that clears most infeasible thresholds
    const ex = [];
    for (;;) {
      const s = solve(keep); if (s.ok) { best = { ...s, excluded: ex }; break; }
      let pick = keep[0], m = Infinity;
      for (const i of keep) { const r = solve(keep.filter(j => j !== i)); const v = r.ok ? 0 : r.bad.length; if (v < m) { m = v; pick = i; } }
      keep = keep.filter(i => i !== pick); ex.push(pick);
    }
  }
  keep = usable.filter(i => !best.excluded.includes(i));
  return { t: best.t, lo: best.lo, hi: best.hi, cost: best.cost, kept: keep, excluded: best.excluded, minW };
}

// why a well is contradictory: the kept well it cannot coexist with
export function explain(i, d, belts, kept, names, beltNames) {
  const [a, b] = belts[i];
  for (const j of kept) {
    const [a2, b2] = belts[j];
    if (b2 < a && d[j] >= d[i]) return `${names[i]} (${beltNames[a]}) lies more proximal than ${names[j]} (${beltNames[b2]}) along the proximal-distal direction, although its environment is more distal.`;
    if (b < a2 && d[i] >= d[j]) return `${names[i]} (${beltNames[b]}) lies more distal than ${names[j]} (${beltNames[a2]}) along the proximal-distal direction, although its environment is more proximal.`;
  }
  return `${names[i]} (${beltNames[a]}) does not fit the belt order together with the other wells (minimum belt widths or gaps).`;
}
