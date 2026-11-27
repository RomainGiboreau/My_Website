// Polygons from a class grid, and the export writers (ZMAP+, IRAP lines, GeoJSON, CSV, audit). Pure functions, no DOM.
// Grid convention (geometry.makeGrid): k = j * nx + i, j counts upward in y.

// ---- polygons: boundary loops of the cells of each class (interior on the left), holes by orientation, light smoothing ----
const simplifyClosed = (pts, tol) => {   // Douglas-Peucker on a closed ring (split at the two farthest vertices)
  if (pts.length < 8) return pts;
  let a = 0, b = 0, best = -1;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > best) { best = d; b = i; } }
  const dp = (lo, hi) => {
    const A = pts[lo], B = pts[hi % pts.length], ex = B[0] - A[0], ey = B[1] - A[1], L = Math.hypot(ex, ey) || 1;
    let m = -1, mi = -1;
    for (let i = lo + 1; i < hi; i++) { const d = Math.abs((pts[i][0] - A[0]) * ey - (pts[i][1] - A[1]) * ex) / L; if (d > m) { m = d; mi = i; } }
    return m > tol ? [...dp(lo, mi).slice(0, -1), ...dp(mi, hi)] : [A, B];
  };
  return [...dp(a, b).slice(0, -1), ...dp(b, pts.length).slice(0, -1)];
};
// Chaikin corner cutting; segments lying on the frame of the grid (both ends on the same side) stay untouched so the map keeps its square corners
const chaikin = (r, n, W, H) => {
  const edge = (p, q) => (p[0] === 0 && q[0] === 0) || (p[0] === W && q[0] === W) || (p[1] === 0 && q[1] === 0) || (p[1] === H && q[1] === H);
  for (let k = 0; k < n; k++) {
    const o = [];
    for (let i = 0; i < r.length; i++) {
      const p = r[i], q = r[(i + 1) % r.length], pr = r[(i + r.length - 1) % r.length];
      if (edge(p, q)) o.push(p);
      else { if (edge(pr, p)) o.push(p); o.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]); }
    }
    r = o;
  }
  return r;
};
export const ringArea = r => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const inside = (r, x, y) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

// codes: Uint8Array on grid g; returns [{ code, outer: [[x, y]...], holes: [...] }] in map units (rings not closed: last != first)
export function polygonize(codes, g, { tol = 0.6, smooth = 2, minCells = 2 } = {}) {
  const { nx, ny } = g, byCode = new Map(), key = (x, y) => x * (ny + 2) + y;
  const add = (c, x0, y0, x1, y1) => { let m = byCode.get(c); if (!m) byCode.set(c, m = new Map()); const k = key(x0, y0); (m.get(k) || m.set(k, []).get(k)).push([x0, y0, x1, y1]); };
  const at = (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny ? -1 : codes[j * nx + i]);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = codes[j * nx + i];
    if (at(i, j - 1) !== c) add(c, i, j, i + 1, j);
    if (at(i + 1, j) !== c) add(c, i + 1, j, i + 1, j + 1);
    if (at(i, j + 1) !== c) add(c, i + 1, j + 1, i, j + 1);
    if (at(i - 1, j) !== c) add(c, i, j + 1, i, j);
  }
  const out = [];
  for (const [code, m] of byCode) {
    const rings = [];
    for (const list of m.values()) for (const e0 of list) {
      if (e0.used) continue;
      const ring = []; let e = e0;
      while (e && !e.used) {
        e.used = true; ring.push([e[0], e[1]]);
        const nxt = (m.get(key(e[2], e[3])) || []).filter(q => !q.used);
        if (nxt.length > 1) { // saddle: turn left first (keeps cells of the class connected through the corner)
          const dx = e[2] - e[0], dy = e[3] - e[1], cr = q => dx * (q[3] - q[1]) - dy * (q[2] - q[0]);
          nxt.sort((p, q) => cr(q) - cr(p));
        }
        e = nxt[0];
      }
      if (ring.length >= 4) rings.push(ring);
    }
    const P = rings.map(r => { const s = simplifyClosed(r, tol); return { r: chaikin(s.length >= 3 ? s : r, smooth, nx, ny), a: ringArea(r) }; });
    for (const o of P.filter(p => p.a > 0 && p.a >= minCells)) {
      const holes = P.filter(h => h.a < 0 && inside(o.r, h.r[0][0], h.r[0][1])).map(h => h.r);
      out.push({ code, outer: o.r, holes });
    }
  }
  const T = ([x, y]) => [g.ext.xmin + x * g.dx, g.ext.ymin + y * g.dy];
  return out.map(p => ({ code: p.code, outer: p.outer.map(T), holes: p.holes.map(h => h.map(T)) }));
}

// ---- writers ----
const f6 = v => (Math.round(v * 1e6) / 1e6).toFixed(6), rp = v => Math.round(v * 100) / 100;
const closeRing = r => (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) ? [...r, r[0]] : r);
const orient = (r, ccw) => ((ringArea(r) > 0) === ccw ? r : r.slice().reverse());
export const oneLine = s => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim();

// polygons: [{ code, name, outer, holes }] -> IRAP Classic lines: x y z per vertex (z = code), 999 after each closed ring
export function irapPolygons(P) {
  const L = [];
  for (const p of P) for (const r of [p.outer, ...p.holes]) { for (const q of closeRing(r)) L.push(`${f6(q[0])} ${f6(q[1])} ${f6(p.code)}`); L.push('999.000000 999.000000 999.000000'); }
  return L.join('\n') + '\n';
}
export function irapLines(lines) {
  const L = [];
  lines.forEach((l, i) => { for (const q of l.pts) L.push(`${f6(q[0])} ${f6(q[1])} ${f6(i + 1)}`); L.push('999.000000 999.000000 999.000000'); });
  return L.join('\n') + '\n';
}
export function geojson(P, { lines = [], features = [] } = {}) {
  const F = P.map(p => ({ type: 'Feature', properties: { kind: 'belt', code: p.code, class: oneLine(p.name), area: rp(Math.abs(ringArea(p.outer)) - p.holes.reduce((a, h) => a + Math.abs(ringArea(h)), 0)) },
    geometry: { type: 'Polygon', coordinates: [orient(p.outer, true), ...p.holes.map(h => orient(h, false))].map(r => closeRing(r).map(q => [rp(q[0]), rp(q[1])])) } }));
  for (const f of features) F.push({ type: 'Feature', properties: { kind: 'feature', id: f.id, class: oneLine(f.name), role: f.role, host: f.host.join(',') }, geometry: { type: 'Polygon', coordinates: [closeRing(orient(f.ring, true)).map(q => [rp(q[0]), rp(q[1])])] } });
  lines.forEach((l, i) => F.push({ type: 'Feature', properties: { kind: 'keyline', name: l.name, code: i + 1 }, geometry: { type: 'LineString', coordinates: l.pts.map(q => [rp(q[0]), rp(q[1])]) } }));
  return '{"type":"FeatureCollection","features":[\n' + F.map(f => JSON.stringify(f)).join(',\n') + '\n]}\n';
}

// ZMAP+ of belt codes (code = belt index + 1) on the node grid nodes xmin, xmin + cell ... <= xmax; legend in ! lines
export function nodeGrid(classAt, ext, cell, legend, name = 'GDE') {
  const nx = Math.max(2, Math.floor((ext.xmax - ext.xmin) / cell + 1e-9) + 1), ny = Math.max(2, Math.floor((ext.ymax - ext.ymin) / cell + 1e-9) + 1), codes = new Int16Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) codes[j * nx + i] = classAt(ext.xmin + i * cell, ext.ymin + j * cell) + 1;
  return { name, nx, ny, x0: ext.xmin, y0: ext.ymin, dx: cell, dy: cell, codes, legend };
}
const crd = v => String(Math.round(v * 1000) / 1000);
export function zmap(G) {
  const nm = String(G.name || 'GDE').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'GDE';
  const L = ['! GDE map generator v3: belt codes'].concat((G.legend || []).map(([c, n]) => `! ${c} = ${oneLine(n)}`));
  L.push(`@${nm}, GRID, 5`, '15, 1.0E+30, , 7, 1', `${G.ny}, ${G.nx}, ${crd(G.x0)}, ${crd(G.x0 + (G.nx - 1) * G.dx)}, ${crd(G.y0)}, ${crd(G.y0 + (G.ny - 1) * G.dy)}`, '0.0, 0.0, 0.0', '@');
  for (let i = 0; i < G.nx; i++) {   // column by column from the upper-left node (ymax) downwards
    let line = '', n = 0;
    for (let j = G.ny - 1; j >= 0; j--) { line += (+G.codes[j * G.nx + i]).toFixed(7).padStart(15); if (++n === 5) { L.push(line); line = ''; n = 0; } }
    if (n) L.push(line);
  }
  return L.join('\r\n') + '\r\n';
}

const csvq = s => { s = oneLine(s); return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const HOW_TXT = { belts: 'belts', warping: 'warping', not: 'not honoured', unmatched: 'not matched' };
// wells: model.wells with verdicts: name, x, y, environment given, belt on the map
export function wellsCsv(m) {
  const bn = m.rs.belts.map(b => b.name), L = ['name,x,y,environment_given,class_on_map,honoured,how'];
  m.wells.forEach((w, i) => { const c = m.classAt(w.x, w.y), v = m.verdicts[i]; L.push([csvq(w.name), crd(w.x), crd(w.y), csvq(w.env || (w.range ? bn[w.range[0]] : '')), csvq(bn[c]), v === 'belts' || v === 'warping' ? 'yes' : v === 'not' ? 'no' : '', HOW_TXT[v]].join(',')); });
  return L.join('\n') + '\n';
}
export function auditJson(m, inputs) {
  const bn = m.rs.belts.map(b => b.name);
  return JSON.stringify({
    tool: 'GDE map generator v3 (concept map, not a prediction)', date: '2026-11-27', inputs,
    belts: bn, thresholds: { prior: m.prior.map(Math.round), calibrated: m.t.map(Math.round), feasible_lo: m.lo.map(v => (isFinite(v) ? Math.round(v) : null)), feasible_hi: m.hi.map(v => (isFinite(v) ? Math.round(v) : null)), unit: 'metres along the proximal-distal field d' },
    wells: m.wells.map((w, i) => ({ name: w.name, x: w.x, y: w.y, environment: w.env || null, class_on_map: bn[m.classAt(w.x, w.y)], d: Math.round(m.d[i]), verdict: m.verdicts[i], kept_in_calibration: m.kept.includes(i) })),
    conflicts: m.conflicts, banner: m.banner, warping: m.warp, features: m.features().length
  }, null, 1) + '\n';
}
