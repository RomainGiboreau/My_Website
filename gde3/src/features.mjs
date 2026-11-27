// ONE generic Feature type: { id, name, color, shape, host, n, pos, size, orientation, relation }
//   host: belt ids the feature may sit in (a contiguous run of belts, validated in belts.mjs); the polygon is shrunk (lens shapes) or
//         truncated (ribbons) until every point of it, and of its interior samples, lies in a host belt: host rule by construction.
//   shape: lobe | finger | funnel | bar | bank | patch | ribbon;  size {l, w}: length and width as fractions of the finite belt span;
//   orientation: 'dip' | 'strike' | degrees from the dip direction;  relation: null | 'levees' (ribbon gets a levee ring around the channel);
//   n: how many, spread along strike with a seeded jitter;  pos [p0, p1]: position across the host run (0 = proximal limit, 1 = distal limit).
// Positions follow the CALIBRATED thresholds (they are given in belt coordinates), so features move continuously when a boundary moves.
import { mulberry32, valueNoise } from './rng.mjs';

export const FEATURE_SHAPES = ['lobe', 'finger', 'funnel', 'bar', 'bank', 'patch', 'ribbon'];

export function featureDefs(rs) {
  const R = rs.sys.regimes, ro = R && rs.regime ? R.options[rs.regime] : null;
  return (ro && ro.features) || rs.sys.features || [];
}

function shade(hex, k) {
  const v = parseInt(hex.slice(1), 16);
  return '#' + [16, 8, 0].map(s => Math.round(255 - (255 - ((v >> s) & 255)) * k).toString(16).padStart(2, '0')).join('');
}
const leveeColor = f => f.leveeColor || shade(f.color, 0.55);

// legend of raster codes: belts keep 0..n-1, every (feature, role) gets the next code
export function featureLegend(defs, nBelts) {
  const out = [];
  defs.forEach((f, i) => {
    if (f.relation === 'levees') out.push({ code: nBelts + out.length, def: i, id: f.id, role: 'levee', name: f.name + ' levee', color: leveeColor(f) });
    out.push({ code: nBelts + out.length, def: i, id: f.id, role: 'main', name: f.name, color: f.color });
  });
  return out;
}

const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
const hash = (...n) => n.reduce((a, v) => (Math.imul(a ^ (v | 0), 0x9e3779b1) + 0x7f4a7c15) >>> 0, 17);
const PROFILE = {   // half width / (W/2) at t in (0, 1) along the axis
  lobe: t => Math.sin(Math.PI * t ** 1.5),
  finger: t => Math.sqrt(Math.sin(Math.PI * t)) * (1 - 0.4 * t),
  funnel: t => t ** 1.2 * Math.sqrt(Math.max(0, 1 - t ** 8)),
  bar: t => Math.sin(Math.PI * t) ** 0.8,
  bank: t => Math.sin(Math.PI * t) ** 0.45
};

// unit distal direction from the gradient of the field d, and the gradient length
function dipAt(D, x, y, h) {
  const gx = D(x + h, y) - D(x - h, y), gy = D(x, y + h) - D(x, y - h), l = Math.hypot(gx, gy) || 1;
  return [gx / l, gy / l, l / (2 * h)];
}

function lensRing(def, shape, C, dir, k, S, noise) {
  const L = k * def.size.l * S, W = k * def.size.w * S, a = dir, b = [-dir[1], dir[0]], N = 28, up = [], dn = [];
  if (shape === 'patch') {
    const ring = [];
    for (let i = 0; i < 36; i++) {
      const th = (i / 36) * 2 * Math.PI, r = 1 + 0.22 * noise(Math.cos(th) * 3, Math.sin(th) * 3), u = 0.5 * L * r * Math.cos(th), v = 0.5 * W * r * Math.sin(th);
      ring.push([C[0] + a[0] * u + b[0] * v, C[1] + a[1] * u + b[1] * v]);
    }
    return ring;
  }
  const prof = PROFILE[shape];
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = (t - 0.5) * L, hw = 0.5 * W * prof(t) * (1 + 0.12 * noise(t * 5, 0.5));
    up.push([C[0] + a[0] * u + b[0] * hw, C[1] + a[1] * u + b[1] * hw]);
    dn.push([C[0] + a[0] * u - b[0] * hw, C[1] + a[1] * u - b[1] * hw]);
  }
  return up.concat(dn.reverse());
}

// ribbon: a centreline marched from C in both directions until a point (or its edges) leaves the host; width tapered at both ends
function ribbonRings(def, C, theta, D, ok, S, ext, r, widths) {
  const step = S / 120, lh = 0.5 * def.size.l * S, strike = def.orientation === 'strike', A = strike ? 0.1 : 0.5, lam = (strike ? 0.3 : 0.2) * S, ph = r() * 6.28;
  const d0 = D(C[0], C[1]), wmax = Math.max(...widths);
  const inside = (x, y) => x > ext.xmin && x < ext.xmax && y > ext.ymin && y < ext.ymax;
  const march = sgn => {
    const pts = []; let [x, y] = C;
    for (let s = step; s <= lh; s += step) {
      const [nx, ny, gl] = dipAt(D, x, y, step * 0.5), ang = theta + A * Math.sin((2 * Math.PI * sgn * s) / lam + ph), v = rot([nx, ny], ang);
      x += sgn * v[0] * step; y += sgn * v[1] * step;
      if (strike) { const c = Math.max(-step, Math.min(step, (d0 - D(x, y)) / gl)); x += nx * c; y += ny * c; }
      const px = -v[1], py = v[0];
      if (!inside(x, y) || !ok(x, y) || !ok(x + px * wmax / 2, y + py * wmax / 2) || !ok(x - px * wmax / 2, y - py * wmax / 2)) break;
      pts.push([x, y]);
    }
    return pts;
  };
  const f = march(1), b = march(-1), line = b.reverse().concat([C], f);
  if (line.length < 0.25 * lh / step) return null;
  const n = line.length;
  return widths.map(w => {
    const L = [], R = [];
    line.forEach((p, i) => {
      const q = line[Math.min(n - 1, i + 1)], o = line[Math.max(0, i - 1)], tx = q[0] - o[0], ty = q[1] - o[1], tl = Math.hypot(tx, ty) || 1, u = i / (n - 1), tp = Math.min(1, 4 * u, 4 * (1 - u)) ** 0.7;
      L.push([p[0] - (ty / tl) * w * tp / 2, p[1] + (tx / tl) * w * tp / 2]);
      R.push([p[0] + (ty / tl) * w * tp / 2, p[1] - (tx / tl) * w * tp / 2]);
    });
    return L.concat(R.reverse());
  });
}

export const inRing = (ring, x, y) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};

// the point of the line at strike coordinate s (perpendicular to the transport azimuth through the extent centre) where the field d equals dT, or null
export function locateAtD(D, ext, az, s, dT) {
  const a = (az * Math.PI) / 180, ux = Math.sin(a), uy = Math.cos(a), ex = -uy, ey = ux, cx = (ext.xmin + ext.xmax) / 2, cy = (ext.ymin + ext.ymax) / 2, diag = Math.hypot(ext.xmax - ext.xmin, ext.ymax - ext.ymin);
  const at = q => [cx + ex * s + ux * q, cy + ey * s + uy * q];
  let qa = -diag, qb = diag;
  if (!(D(...at(qa)) < dT && D(...at(qb)) > dT)) return null;
  for (let q = 0; q < 40; q++) { const mid = (qa + qb) / 2; if (D(...at(mid)) < dT) qa = mid; else qb = mid; }
  return at((qa + qb) / 2);
}
export const dipDirection = (D, x, y, h) => dipAt(D, x, y, h).slice(0, 2);

// m: model { rs, t, D, classAt }; opts { ext, az, seed }. Returns [{ id, name, color, role, host, ring }]
export function generateFeatures(m, { ext, az = 0, seed = 1 }) {
  const rs = m.rs, defs = featureDefs(rs), S = rs.p[rs.p.length - 1], ids = rs.belts.map(b => b.id), out = [];
  const a = (az * Math.PI) / 180, ex = -Math.cos(a), ey = Math.sin(a);
  const hw = (Math.abs(ex) * (ext.xmax - ext.xmin) + Math.abs(ey) * (ext.ymax - ext.ymin)) / 2;
  const t = m.t || rs.p;
  defs.forEach((def, di) => {
    const hostIdx = def.host.map(h => ids.indexOf(h)), hs = new Set(hostIdx), a0 = Math.min(...hostIdx), b0 = Math.max(...hostIdx);
    const lo = a0 > 0 ? t[a0 - 1] : t[0] - rs.w[0], hi = b0 < t.length ? t[b0] : t[t.length - 1] + rs.w[rs.w.length - 1];
    const ok = (x, y) => hs.has(m.classAt(x, y));
    for (let i = 0; i < def.n; i++) {
      const r = mulberry32(hash(seed, di, i, 7)), nz = valueNoise(hash(seed, di, i), 0.5), noise = (u, v) => nz(u, v);
      const s = (((i + 0.5 + (r() - 0.5) * 0.7) / def.n) * 1.6 - 0.8) * hw, p = def.pos[0] + r() * (def.pos[1] - def.pos[0]), dT = lo + p * (hi - lo);
      const C = locateAtD(m.D, ext, az, s, dT);
      if (!C || !(C[0] > ext.xmin && C[0] < ext.xmax && C[1] > ext.ymin && C[1] < ext.ymax) || !ok(C[0], C[1])) continue;
      const [nx, ny] = dipAt(m.D, C[0], C[1], S / 200), theta = def.orientation === 'dip' ? 0 : def.orientation === 'strike' ? Math.PI / 2 : (def.orientation * Math.PI) / 180;
      const dir = rot([nx, ny], theta);
      const push = (role, ring) => out.push({ id: def.id, name: role === 'levee' ? def.name + ' levee' : def.name, color: role === 'levee' ? leveeColor(def) : def.color, role, host: def.host, ring });
      if (def.shape === 'ribbon') {
        const w = def.size.w * S, widths = def.relation === 'levees' ? [w * 3.4, w] : [w], rings = ribbonRings(def, C, theta, m.D, ok, S, ext, r, widths);
        if (!rings) continue;
        rings.forEach((ring, q) => push(def.relation === 'levees' && q === 0 ? 'levee' : 'main', ring));
        continue;
      }
      // lens shapes: the largest scale k in [0.35, 1] such that the ring and its inner samples lie in the host run (bisection: continuous in the thresholds)
      const fits = k => {
        const ring = lensRing(def, def.shape, C, dir, k, S, noise);
        return ok(C[0], C[1]) && ring.every(q => ok(q[0], q[1]) && ok(C[0] + 0.5 * (q[0] - C[0]), C[1] + 0.5 * (q[1] - C[1])));
      };
      let k = 1;
      if (!fits(1)) {
        if (!fits(0.35)) continue;
        let kl = 0.35, kh = 1;
        for (let q = 0; q < 12; q++) { const mid = (kl + kh) / 2; if (fits(mid)) kl = mid; else kh = mid; }
        k = kl;
      }
      push('main', lensRing(def, def.shape, C, dir, k, S, noise));
    }
  });
  return out;
}

// raster codes of the features over a base class grid (cells whose centre lies inside a ring); later features paint over earlier ones
export function rasterize(polys, g, base, legend) {
  const out = Uint8Array.from(base), code = new Map(legend.map(l => [l.id + '|' + l.role, l.code]));
  for (const p of polys) {
    const c = code.get(p.id + '|' + p.role); let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of p.ring) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const i0 = Math.max(0, Math.floor((x0 - g.ext.xmin) / g.dx - 0.5)), i1 = Math.min(g.nx - 1, Math.ceil((x1 - g.ext.xmin) / g.dx));
    const j0 = Math.max(0, Math.floor((y0 - g.ext.ymin) / g.dy - 0.5)), j1 = Math.min(g.ny - 1, Math.ceil((y1 - g.ext.ymin) / g.dy));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (inRing(p.ring, g.x(i), g.y(j))) out[j * g.nx + i] = c;
  }
  return out;
}
