// Polylines, signed distance, regular grid. Points are [x, y]; a line splits the plane in two:
// signedDist > 0 on the RIGHT of the direction of travel (by convention the distal side).
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Catmull-Rom smoothing (passes through the vertices); returns [[x, y], ...]
export function smooth(pts, sub = 8) {
  const n = pts.length;
  if (n < 3) return pts.map(p => [p[0], p[1]]);
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(n - 1, i + 2)];
    for (let s = 0; s < sub; s++) {
      const t = s / sub, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(q => 0.5 * (2 * b[q] + (-a[q] + c[q]) * t + (2 * a[q] - 5 * b[q] + 4 * c[q] - d[q]) * t2 + (-a[q] + 3 * b[q] - 3 * c[q] + d[q]) * t3)));
    }
  }
  out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
}

export const length = pts => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

// signed distance to a polyline; first and last segments are extended as rays so the line splits the plane.
// Nearest point on a vertex: the sign follows the sum of the normals of its two segments.
export function signedDist(pts, x, y) {
  const n = pts.length;
  let best = Infinity, sign = 1, vertex = -1;
  for (let i = 0; i < n - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey;
    if (!(L2 > 0)) continue;
    const wx = x - ax, wy = y - ay;
    let t = (wx * ex + wy * ey) / L2, v = -1;
    if (t < 0 && i > 0) { t = 0; v = i; } else if (t > 1 && i < n - 2) { t = 1; v = i + 1; }
    const px = wx - t * ex, py = wy - t * ey, d2 = px * px + py * py;
    if (d2 < best) { best = d2; vertex = v; if (v < 0) sign = wx * ey - wy * ex >= 0 ? 1 : -1; }
  }
  if (vertex >= 0) {
    let nx = 0, ny = 0;
    for (let a = vertex - 1; a <= vertex; a++) {
      const ex = pts[a + 1][0] - pts[a][0], ey = pts[a + 1][1] - pts[a][1], l = Math.hypot(ex, ey);
      if (l > 0) { nx += ey / l; ny -= ex / l; }
    }
    sign = (x - pts[vertex][0]) * nx + (y - pts[vertex][1]) * ny >= 0 ? 1 : -1;
  }
  return sign * Math.sqrt(best);
}

// regular grid of cell centres over ext {xmin, xmax, ymin, ymax}; index k = j * nx + i, j counts upward in y
export function makeGrid(ext, nx, ny = nx) {
  const dx = (ext.xmax - ext.xmin) / nx, dy = (ext.ymax - ext.ymin) / ny;
  return { nx, ny, dx, dy, ext, x: i => ext.xmin + (i + 0.5) * dx, y: j => ext.ymin + (j + 0.5) * dy };
}

export function sampleGrid(g, f) {
  const out = new Float64Array(g.nx * g.ny);
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) out[j * g.nx + i] = f(g.x(i), g.y(j));
  return out;
}
