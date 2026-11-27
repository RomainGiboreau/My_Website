// Drawing on a Canvas 2D context (screen and PNG use the same code): vector belts from polygonize, features, wells with honoured marks,
// key lines, process arrows, legend, scale bar, coordinates, and the Source -> sink chain strip. No DOM access.
import { locateAtD, dipDirection } from './features.mjs';

const FONT = 'Inter, system-ui, sans-serif', INK = '#232220', MUT = '#5c5a52';
export const MARK = { belts: ['✓', '#2e7d32'], warping: ['✓', '#2e7d32'], not: ['✗', '#c62828'], unmatched: ['?', '#8c8a80'] };
const PROC = { river: ['River flow', '#2a6fb0', 0], wave: ['Wave reworking', '#7b4fa8', 0], tide: ['Tidal reworking', '#7b4fa8', 0], storm: ['Storm reworking', '#7b4fa8', 0], gravity: ['Gravity flows', '#c0392b', 0], settling: ['Settling', '#8c8a80', 1] };

export const processOf = rs => {
  const R = rs.sys.regimes, ro = R && rs.regime ? R.options[rs.regime] : null;
  return { ...(rs.sys.process || {}), ...((ro && ro.process) || {}) };
};
const niceStep = r => { const p = Math.pow(10, Math.floor(Math.log10(r))), f = r / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };
const fmtN = v => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : String(Math.round(v * 100) / 100));
const lum = hex => { const v = parseInt(hex.slice(1), 16); return (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255; };

// layout of the map rectangle in a W x H canvas (legend column on the right when legendW > 0); metres per pixel equal on both axes
export function layoutFor(W, H, ext, legendW = 0) {
  const left = 62, right = 16, top = 34, bottom = 44, aw = W - left - right - legendW, ah = H - top - bottom, ew = ext.xmax - ext.xmin, eh = ext.ymax - ext.ymin;
  const k = Math.max(1e-9, Math.min(aw / ew, ah / eh)), px0 = left, py0 = top, px1 = px0 + ew * k, py1 = py0 + eh * k;
  return { px0, py0, px1, py1, k, legendX: px1 + 24, legendW, W, H, X: x => px0 + (x - ext.xmin) * k, Y: y => py1 - (y - ext.ymin) * k, ix: px => ext.xmin + (px - px0) / k, iy: py => ext.ymin + (py1 - py) / k };
}

export function present(codes, n) { const s = new Set(); for (let i = 0; i < codes.length; i++) s.add(codes[i]); return s; }

function ringPath(c, L, ring) { ring.forEach((q, i) => (i ? c.lineTo(L.X(q[0]), L.Y(q[1])) : c.moveTo(L.X(q[0]), L.Y(q[1])))); c.closePath(); }

function arrow(c, x0, y0, x1, y1, col, dotted) {
  const a = Math.atan2(y1 - y0, x1 - x0), hl = 11, hw = 8;
  c.save(); c.lineJoin = 'round'; c.strokeStyle = col; c.fillStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2;
  if (dotted) c.setLineDash([2, 4]);
  const L = Math.hypot(x1 - x0, y1 - y0) - hl, ux = Math.cos(a), uy = Math.sin(a);
  c.beginPath(); c.moveTo(x0 + uy * 3, y0 - ux * 3); c.lineTo(x0 + ux * L + uy * 3, y0 + uy * L - ux * 3); c.lineTo(x0 + ux * L + uy * hw, y0 + uy * L - ux * hw); c.lineTo(x1, y1);
  c.lineTo(x0 + ux * L - uy * hw, y0 + uy * L + ux * hw); c.lineTo(x0 + ux * L - uy * 3, y0 + uy * L + ux * 3); c.lineTo(x0 - uy * 3, y0 + ux * 3); c.closePath(); c.fill(); c.stroke(); c.restore();
}

const halo = (c, t, x, y, col = INK) => { c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.9)'; c.strokeText(t, x, y); c.fillStyle = col; c.fillText(t, x, y); };

// st: { model, polys (belt polygons from polygonize), ext, wells (positions to draw; default model.wells), showLines, arrows, title, hl (belt index to highlight) }
export function drawMap(c, W, H, st, o = {}) {
  const m = st.model, ext = st.ext, B = m.rs.belts, nB = B.length, leg = o.legend === false ? 0 : Math.min(230, Math.max(150, W * 0.26)), L = layoutFor(W, H, ext, leg);
  const feats = m.features(), codes = st.codes, pres = present(codes, nB);
  c.save(); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
  c.save(); c.beginPath(); c.rect(L.px0, L.py0, L.px1 - L.px0, L.py1 - L.py0); c.clip();
  c.fillStyle = B[nB - 1].color; c.fillRect(L.px0, L.py0, L.px1 - L.px0, L.py1 - L.py0);
  c.lineJoin = 'round';
  for (const p of st.polys) {
    const col = B[p.code] ? B[p.code].color : '#ccc'; c.beginPath(); ringPath(c, L, p.outer); p.holes.forEach(h => ringPath(c, L, h));
    c.fillStyle = col; c.fill('evenodd'); c.strokeStyle = col; c.lineWidth = 1; c.stroke();
  }
  for (const f of feats) { c.beginPath(); ringPath(c, L, f.ring); c.fillStyle = f.color; c.fill(); c.strokeStyle = 'rgba(35,34,32,.55)'; c.lineWidth = 0.8; c.stroke(); }
  if (st.arrows) {
    const proc = processOf(m.rs), S = m.rs.p[m.rs.p.length - 1], t = m.t, az = st.az || 0;
    B.forEach((b, k) => {
      const pr = PROC[proc[b.id]]; if (!pr || !pres.has(k)) return;
      const lo = k > 0 ? t[k - 1] : t[0] - m.rs.w[0], hi = k < t.length ? t[k] : t[t.length - 1] + m.rs.w[k], dT = (lo + hi) / 2;
      for (const sf of [-0.3, 0.3]) {
        const P = locateAtD(m.D, ext, az, sf * S * 1.6, dT); if (!P || P[0] < ext.xmin || P[0] > ext.xmax || P[1] < ext.ymin || P[1] > ext.ymax) continue;
        const [dx, dy] = dipDirection(m.D, P[0], P[1], S / 200), len = Math.max(26, Math.min(60, (hi - lo) * L.k * 0.55)) / L.k;
        arrow(c, L.X(P[0] - dx * len / 2), L.Y(P[1] - dy * len / 2), L.X(P[0] + dx * len / 2), L.Y(P[1] + dy * len / 2), pr[1], pr[2]);
      }
    });
  }
  if (st.hl != null) {   // veil everything but the highlighted belt
    const pa = new Path2D(), bg = new Path2D(); bg.rect(L.px0, L.py0, L.px1 - L.px0, L.py1 - L.py0);
    for (const p of st.polys) if (p.code === st.hl) for (const r of [p.outer, ...p.holes]) { r.forEach((q, i) => (i ? pa.lineTo(L.X(q[0]), L.Y(q[1])) : pa.moveTo(L.X(q[0]), L.Y(q[1])))); pa.closePath(); }
    bg.addPath(pa); c.fillStyle = 'rgba(255,255,255,.62)'; c.fill(bg, 'evenodd'); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(pa);
  }
  if (st.showLines) {
    c.setLineDash([7, 5]); c.strokeStyle = '#1d3f8a'; c.lineWidth = 1.6;
    for (const l of st.keyLines || m.keyLines) { c.beginPath(); l.pts.forEach((q, i) => (i ? c.lineTo(L.X(q[0]), L.Y(q[1])) : c.moveTo(L.X(q[0]), L.Y(q[1])))); c.stroke(); }
    c.setLineDash([]);
    for (const l of st.keyLines || m.keyLines) for (const q of l.handles || []) { c.fillStyle = '#fff'; c.strokeStyle = '#1d3f8a'; c.lineWidth = 1.6; c.fillRect(L.X(q[0]) - 4, L.Y(q[1]) - 4, 8, 8); c.strokeRect(L.X(q[0]) - 4, L.Y(q[1]) - 4, 8, 8); }
  }
  c.restore();
  // wells
  c.font = '600 12px ' + FONT; c.textBaseline = 'middle'; c.textAlign = 'left';
  (st.wells || m.wells).forEach((w, i) => {
    const x = L.X(w.x), y = L.Y(w.y), mk = MARK[m.verdicts[i]] || MARK.unmatched;
    c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.arc(x, y, 5.5, 0, 2 * Math.PI); c.fill(); c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(x, y, 1.6, 0, 2 * Math.PI); c.fill();
    c.font = '600 12px ' + FONT; halo(c, w.name, x + 9, y - 9); const tw = c.measureText(w.name).width;
    c.font = '700 13px ' + FONT; halo(c, mk[0], x + 12 + tw, y - 9, mk[1]);
  });
  // title, north arrow, scale bar
  c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = INK; c.font = '600 14px "Space Grotesk",' + FONT;
  c.fillText(st.title || '', L.px0, L.py0 - 12);
  const nx = L.px1 - 22, ny = L.py0 + 14; c.fillStyle = INK; c.beginPath(); c.moveTo(nx, ny); c.lineTo(nx + 6, ny + 16); c.lineTo(nx, ny + 12); c.lineTo(nx - 6, ny + 16); c.closePath(); c.fill();
  c.font = '700 11px ' + FONT; c.textAlign = 'center'; halo(c, 'N', nx, ny + 28);
  const sl = niceStep((L.px1 - L.px0) / L.k / 5), sp = sl * L.k, bx = L.px0 + 14, by = L.py1 - 16;
  c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(bx - 6, by - 20, sp + 12, 30);
  for (let q = 0; q < 4; q++) { c.fillStyle = q % 2 ? '#fff' : '#111'; c.fillRect(bx + (q * sp) / 4, by, sp / 4, 5); }
  c.strokeStyle = '#111'; c.lineWidth = 1; c.strokeRect(bx, by, sp, 5); c.fillStyle = INK; c.font = '500 11px ' + FONT; c.fillText(sl >= 1000 ? sl / 1000 + ' km' : sl + ' m', bx + sp / 2, by - 7);
  // frame, coordinates
  c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(L.px0 + 0.5, L.py0 + 0.5, L.px1 - L.px0, L.py1 - L.py0);
  c.font = '11px ' + FONT; c.fillStyle = MUT;
  const tx = niceStep((ext.xmax - ext.xmin) / ((L.px1 - L.px0) / 110)), ty = niceStep((ext.ymax - ext.ymin) / ((L.py1 - L.py0) / 70));
  c.textAlign = 'center'; c.textBaseline = 'top';
  for (let v = Math.ceil(ext.xmin / tx) * tx; v <= ext.xmax + 1e-9; v += tx) { const x = L.X(v); c.beginPath(); c.moveTo(x, L.py1); c.lineTo(x, L.py1 + 5); c.stroke(); c.fillText(fmtN(v), x, L.py1 + 7); }
  c.textAlign = 'right'; c.textBaseline = 'middle';
  for (let v = Math.ceil(ext.ymin / ty) * ty; v <= ext.ymax + 1e-9; v += ty) { const y = L.Y(v); c.beginPath(); c.moveTo(L.px0, y); c.lineTo(L.px0 - 5, y); c.stroke(); c.fillText(fmtN(v), L.px0 - 7, y); }
  c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText('X', (L.px0 + L.px1) / 2, L.py1 + 24);
  c.save(); c.translate(12, (L.py0 + L.py1) / 2); c.rotate(-Math.PI / 2); c.textBaseline = 'middle'; c.fillText('Y', 0, 0); c.restore();
  if (leg) drawLegend(c, L, st, pres);
  c.restore();
  return L;
}

function drawLegend(c, L, st, pres) {
  const m = st.model, B = m.rs.belts, lx = Math.min(L.W - L.legendW + 6, L.legendX), lw = L.legendW - 12; let ly = L.py0;
  c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = INK; c.font = '600 13px "Space Grotesk",' + FONT; c.fillText('Environments', lx, ly); ly += 18;
  c.font = '11px ' + FONT; c.fillStyle = MUT; c.fillText('proximal → distal; grey = absent', lx, ly); ly += 17;
  const wrapText = (t, x, y, maxW, lh) => { let line = '', yy = y; for (const w of t.split(' ')) { const tst = line ? line + ' ' + w : w; if (c.measureText(tst).width > maxW && line) { c.fillText(line, x, yy); line = w; yy += lh; } else line = tst; } c.fillText(line, x, yy); return yy + lh; };
  c.font = '12px ' + FONT;
  B.forEach((b, i) => {
    const has = pres.has(i); c.fillStyle = has ? b.color : '#ecebe5'; c.fillRect(lx, ly, 18, 13); c.strokeStyle = 'rgba(35,34,32,.5)'; c.strokeRect(lx + 0.5, ly + 0.5, 17, 12);
    c.fillStyle = has ? INK : '#8c8a80'; ly = wrapText(b.name, lx + 24, ly, lw - 26, 14) + 5;
  });
  const fl = m.featureLegend.filter(l => m.features().some(p => p.id === l.id && p.role === l.role));
  if (fl.length) {
    ly += 4; c.fillStyle = MUT; c.font = '600 11px ' + FONT; c.fillText('FEATURES', lx, ly); ly += 15; c.font = '12px ' + FONT;
    for (const l of fl) { c.fillStyle = l.color; c.fillRect(lx, ly, 18, 11); c.strokeStyle = 'rgba(35,34,32,.55)'; c.strokeRect(lx + 0.5, ly + 0.5, 17, 10); c.fillStyle = INK; ly = wrapText(l.name, lx + 24, ly, lw - 26, 14) + 4; }
  }
  ly += 6; c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.arc(lx + 9, ly + 7, 5, 0, 2 * Math.PI); c.fill(); c.stroke();
  c.fillStyle = INK; c.font = '12px ' + FONT; c.fillText('Well', lx + 24, ly); c.fillStyle = '#2e7d32'; c.font = '700 12px ' + FONT; c.fillText('✓', lx + 62, ly);
  c.fillStyle = MUT; c.font = '11px ' + FONT; c.fillText('honoured', lx + 76, ly + 1); ly += 17;
  c.fillStyle = '#c62828'; c.font = '700 12px ' + FONT; c.fillText('✗', lx + 62, ly); c.fillStyle = MUT; c.font = '11px ' + FONT; c.fillText('not honoured', lx + 76, ly + 1); ly += 22;
  if (st.arrows) {
    const proc = processOf(m.rs), used = [...new Set(B.filter((b, i) => pres.has(i)).map(b => proc[b.id]).filter(Boolean))];
    for (const p of used) { const pr = PROC[p]; arrow(c, lx, ly + 6, lx + 26, ly + 6, pr[1], pr[2]); c.fillStyle = INK; c.font = '12px ' + FONT; c.fillText(pr[0], lx + 34, ly); ly += 17; }
  }
  if (st.showLines) { c.setLineDash([7, 5]); c.strokeStyle = '#1d3f8a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(lx, ly + 7); c.lineTo(lx + 18, ly + 7); c.stroke(); c.setLineDash([]); c.fillStyle = INK; c.font = '12px ' + FONT; c.fillText('Key line (basin →)', lx + 24, ly); ly += 17; }
  c.fillStyle = MUT; c.font = 'italic 11px ' + FONT; wrapText('Concept map, not a prediction.', lx, ly + 4, lw, 14);
}

// ---- Source -> sink chain: every belt of the system in order, greyed when absent from the map; the dominant process under each link ----
export function chainOf(m, pres) {
  const proc = processOf(m.rs);
  return { links: m.rs.belts.map((b, i) => ({ k: i, name: b.name, color: b.color, missing: !pres.has(i), process: proc[b.id] || null })) };
}
export function drawChain(c, W, x0, y0, ch, hl) {
  const pad = 10, bh = 26; let x = x0 + pad, y = y0 + 8, any = false; const hits = [];
  c.save(); c.textBaseline = 'top'; c.textAlign = 'left'; c.fillStyle = INK; c.font = '600 13px "Space Grotesk",' + FONT; c.fillText('Source → sink', x, y);
  const tw = c.measureText('Source → sink').width; c.fillStyle = MUT; c.font = '11px ' + FONT;
  c.fillText('concept map, not a prediction · belts of the system, proximal → distal, grey = not on this map · click a link to highlight its zone', x + tw + 10, y + 2); y += 24;
  for (const l of ch.links) {
    c.font = (l.missing ? 'italic ' : '') + '11.5px ' + FONT;
    const w = Math.min(150, Math.max(78, c.measureText(l.name).width + 16));
    if (x + w > x0 + W - pad && any) { x = x0 + pad; y += 56; }
    if (any) { c.fillStyle = '#8c8a80'; c.font = '14px ' + FONT; c.fillText('›', x - 14, y + 4); }
    const on = hl === l.k && !l.missing;
    c.beginPath(); c.roundRect(x, y, w, bh, 6); c.fillStyle = l.missing ? '#f1f0ea' : l.color; c.fill();
    if (l.missing) { c.setLineDash([4, 3]); c.strokeStyle = '#a9a79d'; c.lineWidth = 1.2; } else { c.strokeStyle = on ? INK : 'rgba(35,34,32,.45)'; c.lineWidth = on ? 2.6 : 1; }
    c.stroke(); c.setLineDash([]);
    c.fillStyle = l.missing ? '#8c8a80' : lum(l.color) > 0.58 ? INK : '#fff'; c.font = (l.missing ? 'italic ' : '') + '11.5px ' + FONT; c.textBaseline = 'middle';
    let t = l.name; while (t.length > 3 && c.measureText(t).width > w - 10) t = t.slice(0, -2); if (t !== l.name) t = t.trim() + '…';
    c.fillText(t, x + 7, y + bh / 2 + 0.5); c.textBaseline = 'top';
    const pr = l.process && PROC[l.process]; c.font = '10px ' + FONT;
    if (l.missing) { c.fillStyle = '#a9a79d'; c.fillText('missing link', x, y + bh + 4); } else if (pr) { c.fillStyle = pr[1]; c.fillText(pr[0].toLowerCase(), x, y + bh + 4); }
    hits.push({ x, y, w, h: bh + 16, l }); x += w + 18; any = true;
  }
  c.restore();
  return { h: y + bh + 24 - y0, hits };
}

// PNG: the map with legend, scale bar and coordinates, then the chain strip; returns the canvas drawn on (create(W, H) makes a canvas)
export function renderPng(create, st, W = 2000) {
  const Hm = Math.round(W * 0.6), probe = create(10, 10).getContext('2d'), ch = chainOf(st.model, present(st.codes, st.model.rs.belts.length)), hc = Math.ceil(drawChain(probe, W, 0, 0, ch).h);
  const cv = create(W, Hm + hc), c = cv.getContext('2d');
  drawMap(c, W, Hm, { ...st, arrows: st.arrows }, {}); c.fillStyle = '#fff'; c.fillRect(0, Hm, W, hc); drawChain(c, W, 0, Hm, ch, null);
  return cv;
}
