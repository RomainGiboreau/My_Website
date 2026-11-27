// UI of the GDE map generator v3: three steps (1 wells, 2 system, 3 result). All state in S; every change recomputes the whole model (fast enough).
import { SYSTEMS } from '../src/systems.mjs';
import { buildModel } from '../src/model.mjs';
import { makeGrid, smooth, signedDist } from '../src/geometry.mjs';
import { matchBelt } from '../src/belts.mjs';
import { HOW } from '../src/verdict.mjs';
import { polygonize, irapPolygons, irapLines, geojson, nodeGrid, zmap, wellsCsv, auditJson } from '../src/exports.mjs';
import { drawMap, layoutFor, chainOf, drawChain, renderPng, present } from '../src/render.mjs';
import { parseWells, wellsToText, fitExtent } from '../src/wells.mjs';
import { SETS, EXT, setOpts, setWells } from '../tools/acceptance.mjs';

const NGRID = 100;   // default grid of the screen map
const $ = id => document.getElementById(id);
const EXAMPLES = { A: SETS.A, B: SETS.B, C: SETS.C };
const SYSLIST = Object.keys(SYSTEMS);

export function init() {
  const S = { system: 'shoreface', regime: 'river', km: 60, az: 0, seed: 7, wobble: 0.03, lobe: 0, ext: { ...EXT }, wells: [], keyLines: null, features: true, arrows: false, warp: false, showLines: false, hl: null, adding: false, ms: 0 };
  let M = null, G = null, codes = null, polys = null, L = null, drag = null, raf = 0, chainHits = [];
  const msg = (id, t, err) => { const e = $(id); e.textContent = t || ''; e.classList.toggle('err', !!err); };
  const regimeIds = () => (SYSTEMS[S.system].regimes ? Object.keys(SYSTEMS[S.system].regimes.options) : []);

  // ---------- model ----------
  function compute() {
    const t0 = performance.now(), ext = S.ext, span = Math.max(ext.xmax - ext.xmin, ext.ymax - ext.ymin);
    const sys = SYSTEMS[S.system], opts = { system: S.system, regime: sys.regimes ? S.regime : undefined, km: S.km, ext, az: S.az, seed: S.seed, wobble: S.wobble, lobe: S.lobe, wells: S.wells, features: S.features, keyLines: S.keyLines || undefined, warp: S.warp ? { radius: 0.2 * span, maxAmp: 0.25 * S.km * 1000 } : null };
    M = buildModel(opts); G = makeGrid(ext, NGRID); codes = M.classGrid(G); polys = polygonize(codes, G, { tol: 0.9, smooth: 3 }); M.features();
    S.ms = performance.now() - t0; window.GDE3APP = { S, get model() { return M; }, ms: S.ms };
    draw(); drawResult();
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; compute(); }); };
  const stState = () => ({ model: M, polys, codes, ext: S.ext, az: S.az, arrows: S.arrows, showLines: S.showLines, keyLines: S.showLines ? handlesOf(M.keyLines) : null, hl: S.hl, title: sysTitle() });
  const handlesOf = ls => ls.map(l => ({ ...l, handles: l.ctrl || [] }));
  const sysTitle = () => SYSTEMS[S.system].name + (SYSTEMS[S.system].regimes ? ', ' + S.regime + '-dominated' : '') + ' · ' + S.km + ' km · azimuth ' + S.az + '°';

  // ---------- drawing ----------
  function fitCanvas(cv, w, h) { const d = window.devicePixelRatio || 1; cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = Math.round(w * d); cv.height = Math.round(h * d); const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); return c; }
  function draw() {
    if (!M) return;
    const st = $('stage'), w = st.clientWidth, h = st.clientHeight; if (!w || !h) return;
    const c = fitCanvas($('cv'), w, h), wells = drag && drag.k === 'well' ? S.wells : undefined;
    L = drawMap(c, w, h, { ...stState(), wells }, {});
    $('ro').textContent = 'recompute ' + Math.round(S.ms) + ' ms · grid ' + NGRID + ' × ' + NGRID;
  }
  function drawResult() {
    const b = M.banner, v = $('verdict'), icon = { pass: '✓', warn: '!', bad: '✗', none: '·' }[b.state];
    v.className = 'verdict ' + (b.state === 'pass' ? '' : b.state);
    const subs = [];
    if (b.state === 'none') subs.push('No well yet: the map is the concept alone (prior belt widths). Add wells in step 1 to calibrate it.');
    else if (!M.conflicts.length) subs.push(M.cost > 0 ? 'Boundaries moved by the minimum needed to honour the wells.' : 'The wells fall in the belts of the concept: no boundary had to move.');
    for (const c of M.conflicts) subs.push('<span class="c">' + esc(c.msg) + '</span>');
    v.innerHTML = '<span class="ic">' + icon + '</span><h2>' + esc(b.head) + '</h2><div class="sub">' + subs.join('<br>') + '</div><div class="reminder">Concept map, not a prediction.</div>';
    const tb = $('tb'); tb.innerHTML = '';
    const bn = M.rs.belts.map(x => x.name);
    M.wells.forEach((w, i) => {
      const vd = M.verdicts[i], ok = vd === 'belts' || vd === 'warping', tr = document.createElement('tr');
      tr.innerHTML = '<td class="l">' + esc(w.name) + '</td><td class="l">' + esc(w.env || '—') + ' → ' + esc(bn[M.classAt(w.x, w.y)]) + '</td><td class="l ' + (ok ? 'yes' : vd === 'not' ? 'no' : '') + '">' + (ok ? '✓ ' : vd === 'not' ? '✗ ' : '? ') + HOW[vd] + '</td>';
      tb.appendChild(tr);
    });
    $('wtab').hidden = !M.wells.length;
    drawChainDom();
  }
  function drawChainDom() {
    const w = $('chainw'), W = Math.max(300, w.clientWidth), cn = $('chain'), ch = chainOf(M, present(codes, M.rs.belts.length)), probe = document.createElement('canvas').getContext('2d');
    const h = Math.ceil(drawChain(probe, W, 0, 0, ch, S.hl).h), c = fitCanvas(cn, W, h); c.fillStyle = '#fff'; c.fillRect(0, 0, W, h); chainHits = drawChain(c, W, 0, 0, ch, S.hl).hits;
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ---------- step 1: wells ----------
  function renderWells() {
    const box = $('wList'); box.innerHTML = '';
    const bn = SYSTEMS[S.system].belts.map(b => b.name);
    S.wells.forEach((w, i) => {
      const row = document.createElement('div'), r = matchBelt(w.env, SYSTEMS[S.system].belts);
      row.className = 'wr';
      const opts = bn.map((n, k) => '<option value="' + k + '"' + (r && r[0] === k && r[1] === k ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
      row.innerHTML = '<input type="text" value="' + esc(w.name) + '" aria-label="Well name"><select aria-label="Environment of ' + esc(w.name) + '">' + (r && r[0] === r[1] ? '' : '<option value="-1" selected>' + esc(w.env || '?') + (r ? '' : ' (not matched)') + '</option>') + opts + '</select><button title="Remove this well" aria-label="Remove ' + esc(w.name) + '">✕</button>';
      const [inp, sel, btn] = row.children;
      inp.onchange = () => { w.name = inp.value || w.name; schedule(); };
      sel.onchange = () => { if (+sel.value >= 0) { w.env = bn[+sel.value]; schedule(); } };
      btn.onclick = () => { S.wells.splice(i, 1); renderWells(); schedule(); };
      box.appendChild(row);
    });
    $('wTxt').value = wellsToText(S.wells);
  }
  function applyTable(text, fit) {
    const { wells, skipped } = parseWells(text);
    S.wells = wells;
    if (fit && wells.length) { S.ext = fitExtent(wells); S.km = Math.max(1, Math.min(300, Math.round((0.6 * (S.ext.xmax - S.ext.xmin)) / 1000))); S.keyLines = null; syncSystem(); }
    const un = wells.filter(w => !matchBelt(w.env, SYSTEMS[S.system].belts)).length;
    msg('wMsg', wells.length + ' wells read' + (skipped.length ? ', line ' + skipped.join(', ') + ' skipped' : '') + (un ? ', ' + un + ' environment(s) not matched to a belt of this system' : '') + '.', skipped.length || un);
    renderWells(); compute();
  }
  $('bWApply').onclick = () => applyTable($('wTxt').value, true);
  $('bWClear').onclick = () => { S.wells = []; renderWells(); msg('wMsg', ''); compute(); };
  $('bWAdd').onclick = () => { S.adding = !S.adding; $('bWAdd').classList.toggle('on', S.adding); $('cv').style.cursor = S.adding ? 'crosshair' : ''; msg('wMsg', S.adding ? 'Click on the map where the well is.' : ''); };

  // ---------- step 2: system ----------
  function loadSystemUI() {
    $('sSys').innerHTML = SYSLIST.map(id => '<option value="' + id + '">' + esc(SYSTEMS[id].name) + '</option>').join('');
    $('ex').innerHTML = '<option value="">Load an example…</option>' + Object.entries(EXAMPLES).map(([k, e]) => '<option value="' + k + '">' + k + '. ' + esc(e.title) + '</option>').join('');
  }
  function syncSystem() {
    const sys = SYSTEMS[S.system], rg = regimeIds();
    $('sSys').value = S.system; $('sKm').value = S.km; $('vKm').textContent = S.km + ' km'; $('sAz').value = S.az; $('vAz').textContent = S.az + '°';
    $('sReg').disabled = !rg.length; $('sReg').max = Math.max(0, rg.length - 1); $('sReg').value = Math.max(0, rg.indexOf(S.regime));
    $('vReg').textContent = rg.length ? S.regime : 'n/a for this system'; $('regL').hidden = !rg.length;
    $('regL').textContent = rg.length ? '(' + rg.join(' · ') + ')' : ''; $('sSeed').value = S.seed; $('eFeat').checked = S.features; $('eArr').checked = S.arrows; $('eWarp').checked = S.warp; $('eLines').checked = S.showLines;
    $('sysNote').textContent = sys.refs[0].text.split(' (')[0];
  }
  const sysChanged = () => { S.keyLines = null; syncSystem(); renderWells(); compute(); };
  $('sSys').onchange = () => { S.system = $('sSys').value; if (SYSTEMS[S.system].regimes && !regimeIds().includes(S.regime)) S.regime = SYSTEMS[S.system].regimes.default; if (!SYSTEMS[S.system].regimes) S.regime = 'river'; S.km = SYSTEMS[S.system].scale.km; S.lobe = 0; sysChanged(); };
  $('sKm').oninput = () => { S.km = +$('sKm').value; S.keyLines = null; syncSystem(); schedule(); };
  $('sAz').oninput = () => { S.az = +$('sAz').value; S.keyLines = null; syncSystem(); schedule(); };
  $('sReg').oninput = () => { const r = regimeIds(); if (r.length) { S.regime = r[+$('sReg').value]; S.keyLines = null; syncSystem(); schedule(); } };
  $('bEdit').onclick = () => { const o = $('editBox').hidden; $('editBox').hidden = !o; $('bEdit').setAttribute('aria-expanded', o); };
  $('sSeed').onchange = () => { S.seed = Math.max(1, Math.round(+$('sSeed').value) || 1); S.keyLines = null; compute(); };
  $('bSeed').onclick = () => { S.seed = 1 + Math.floor(Math.random() * 9999); S.keyLines = null; syncSystem(); compute(); };
  $('eFeat').onchange = () => { S.features = $('eFeat').checked; compute(); };
  $('eArr').onchange = () => { S.arrows = $('eArr').checked; draw(); };
  $('eWarp').onchange = () => { S.warp = $('eWarp').checked; compute(); };
  $('eLines').onchange = () => { S.showLines = $('eLines').checked; draw(); };
  $('bLReset').onclick = () => { S.keyLines = null; msg('lMsg', 'Key lines proposed again.'); compute(); };
  $('ex').onchange = () => {
    const e = EXAMPLES[$('ex').value]; if (!e) return;
    Object.assign(S, { system: e.system, regime: e.regime || 'river', km: e.km, az: 0, seed: 7, wobble: e.wobble, lobe: e.lobe, ext: { ...EXT }, keyLines: null, hl: null });
    S.wells = setWells(e); syncSystem(); renderWells(); msg('wMsg', 'Example ' + $('ex').value + ': ' + e.title + '. Well 3 sits beyond the prior limit of its belt: drag it and watch the boundary move.'); compute();
  };

  // ---------- canvas interaction ----------
  const pos = e => { const r = $('cv').getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const world = p => [L.ix(p[0]), L.iy(p[1])];
  function linesOK(lines) {   // adjacent key lines may not cross: every point of the proximal one lies on the proximal side of the next
    const s = lines.slice().sort((a, b) => a.v - b.v);
    for (let i = 0; i + 1 < s.length; i++) for (let q = 0; q < s[i].pts.length; q += 3) if (signedDist(s[i + 1].pts, s[i].pts[q][0], s[i].pts[q][1]) >= 0) return false;
    return true;
  }
  $('cv').addEventListener('pointerdown', e => {
    if (!M || !L) return; const p = pos(e), w = world(p);
    if (S.adding) { openPop(p, w); return; }
    const bn = M.wells.findIndex(q => Math.hypot(L.X(q.x) - p[0], L.Y(q.y) - p[1]) < 11);
    if (bn >= 0) { drag = { k: 'well', i: bn }; $('cv').setPointerCapture(e.pointerId); return; }
    if (S.showLines) {
      const lines = S.keyLines || M.keyLines;
      for (let li = 0; li < lines.length; li++) { const vi = (lines[li].ctrl || []).findIndex(q => Math.hypot(L.X(q[0]) - p[0], L.Y(q[1]) - p[1]) < 10); if (vi >= 0) { if (!S.keyLines) S.keyLines = M.keyLines.map(l => ({ ...l, ctrl: l.ctrl.map(q => q.slice()) })); drag = { k: 'line', li, vi }; $('cv').setPointerCapture(e.pointerId); return; } }
    }
  });
  $('cv').addEventListener('pointermove', e => {
    if (!L) return; const p = pos(e), w = world(p);
    $('ro').textContent = 'x ' + Math.round(w[0]) + '  y ' + Math.round(w[1]) + ' · ' + Math.round(S.ms) + ' ms';
    if (!drag) { const near = M.wells.some(q => Math.hypot(L.X(q.x) - p[0], L.Y(q.y) - p[1]) < 11); $('cv').style.cursor = S.adding ? 'crosshair' : near ? 'grab' : ''; return; }
    if (drag.k === 'well') { const q = S.wells[drag.i]; q.x = Math.min(S.ext.xmax, Math.max(S.ext.xmin, w[0])); q.y = Math.min(S.ext.ymax, Math.max(S.ext.ymin, w[1])); schedule(); }
    else { const l = S.keyLines[drag.li], old = l.ctrl[drag.vi].slice(), oldPts = l.pts; l.ctrl[drag.vi] = [w[0], w[1]]; l.pts = smooth(l.ctrl);
      if (!linesOK(S.keyLines)) { l.ctrl[drag.vi] = old; l.pts = oldPts; msg('lMsg', 'Key lines may not cross.', true); } else { msg('lMsg', ''); schedule(); } }
  });
  const end = () => { if (drag && drag.k === 'well') renderWells(); drag = null; };
  $('cv').addEventListener('pointerup', end); $('cv').addEventListener('pointercancel', end);
  // new well popup
  function openPop(p, w) {
    const pop = $('pop'); pop.hidden = false; pop.style.left = Math.min(p[0], $('stage').clientWidth - 240) + 'px'; pop.style.top = Math.min(p[1], $('stage').clientHeight - 150) + 'px';
    $('pName').value = 'W-' + (S.wells.length + 1); $('pEnv').innerHTML = SYSTEMS[S.system].belts.map(b => '<option>' + esc(b.name) + '</option>').join('');
    // preselect the belt the map shows at that point
    $('pEnv').selectedIndex = M.classAt(w[0], w[1]); pop.dataset.x = w[0]; pop.dataset.y = w[1];
  }
  $('pOk').onclick = () => { const pop = $('pop'); S.wells.push({ name: $('pName').value || 'W', x: +pop.dataset.x, y: +pop.dataset.y, env: $('pEnv').value }); pop.hidden = true; S.adding = false; $('bWAdd').classList.remove('on'); $('cv').style.cursor = ''; msg('wMsg', ''); renderWells(); compute(); };
  $('pCancel').onclick = () => { $('pop').hidden = true; S.adding = false; $('bWAdd').classList.remove('on'); $('cv').style.cursor = ''; msg('wMsg', ''); };
  $('chain').addEventListener('click', e => {
    const r = $('chain').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, h = chainHits.find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
    if (!h || h.l.missing) return; S.hl = S.hl === h.l.k ? null : h.l.k; draw(); drawChainDom();
  });

  // ---------- exports ----------
  function save(name, data, mime) { const a = document.createElement('a'), u = URL.createObjectURL(new Blob([data], { type: mime || 'text/plain' })); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
  const base = () => 'gde3_' + S.system + (SYSTEMS[S.system].regimes ? '_' + S.regime : '');
  const exportPolys = () => { const g = makeGrid(S.ext, 200), c = M.classGrid(g); return polygonize(c, g).map(p => ({ ...p, code: p.code + 1, name: M.rs.belts[p.code].name })); };
  const lines = () => (S.keyLines || M.keyLines).map(l => ({ name: l.name, pts: l.pts }));
  const X = {
    bPng: () => renderPng((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }, stState(), 2000).toBlob(b => save(base() + '.png', b, 'image/png')),
    bZmap: () => { const cell = (S.ext.xmax - S.ext.xmin) / 100; save(base() + '.zmap', zmap(nodeGrid(M.classAt, S.ext, cell, M.rs.belts.map((b, i) => [i + 1, b.name]), base().toUpperCase())), 'text/plain'); },
    bGeo: () => save(base() + '.geojson', geojson(exportPolys(), { lines: lines(), features: M.features() }), 'application/geo+json'),
    bIrap: () => save(base() + '_polygons.irap', irapPolygons(exportPolys()), 'text/plain'),
    bLines: () => save(base() + '_keylines.irap', irapLines(lines()), 'text/plain'),
    bWcsv: () => save(base() + '_wells.csv', wellsCsv(M), 'text/csv'),
    bAudit: () => save(base() + '_audit.json', auditJson(M, { system: S.system, regime: SYSTEMS[S.system].regimes ? S.regime : null, km: S.km, azimuth: S.az, seed: S.seed, extent: S.ext, features: S.features, warping: S.warp, custom_key_lines: !!S.keyLines }), 'application/json')
  };
  for (const [id, fn] of Object.entries(X)) $(id).onclick = () => { try { fn(); msg('exportMsg', 'Exported.'); } catch (err) { msg('exportMsg', 'Export failed: ' + err.message, true); } $('xmenu').hidden = true; $('bExp').setAttribute('aria-expanded', 'false'); };
  $('bExp').onclick = e => { e.stopPropagation(); const o = $('xmenu').hidden; $('xmenu').hidden = !o; $('bExp').setAttribute('aria-expanded', o); };
  document.addEventListener('click', e => { if (!$('xm').contains(e.target)) { $('xmenu').hidden = true; $('bExp').setAttribute('aria-expanded', 'false'); } });
  window.addEventListener('resize', () => { draw(); if (M) drawChainDom(); });

  loadSystemUI(); syncSystem(); renderWells(); $('ex').value = 'A'; $('ex').onchange();
}

if (typeof document !== 'undefined') init();
