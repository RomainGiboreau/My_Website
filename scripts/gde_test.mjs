// Self-check for the GDE map generator core (docs/gdemap/index.html, <script id="gde-core">).
// Run: node scripts/gde_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const html = read('docs/gdemap/index.html');
const m = html.match(/<script id="gde-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'gde-core script block not found');
const ctx = { window: {} };
vm.runInNewContext(m[1], ctx);
const G = ctx.window.GDE;
// the site's ZMAP checker, to validate the ZMAP+ writer independently
const zm = read('docs/zmap-checker/index.html').match(/<script id="zmap-core">([\s\S]*?)<\/script>/);
const zctx = { window: {} };
vm.runInNewContext(zm[1], zctx);
const Z = zctx.window.ZMAP;

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const arr = a => Array.from(a);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const rng = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

// ---------- templates and matching ----------
test('templates: every template has ordered belts with name, colour and positive width', () => {
  for (const k of ['shelf', 'delta', 'fan', 'carbonate', 'fluvial', 'custom']) {
    const t = G.templates[k];
    assert.ok(t && t.belts.length >= 3, k);
    for (const b of t.belts) { assert.ok(b.name && /^#[0-9a-f]{6}$/i.test(b.color) && b.w > 0, k + ' ' + b.name); }
  }
  assert.equal(G.templates.delta.geom, 'radial');
  assert.equal(G.templates.fan.geom, 'radial');
  assert.equal(G.templates.shelf.geom, 'linear');
});
test('matchBelt: case-insensitive, punctuation and plural tolerant, slash parts accepted, unknown = -1', () => {
  const B = G.templates.fan.belts;
  assert.equal(G.matchBelt('CHANNEL-LEVEE COMPLEX', B), 1);
  assert.equal(G.matchBelt('  proximal lobe ', B), 2);
  assert.equal(G.matchBelt('lobe fringe', B), 3);
  assert.equal(G.matchBelt('Basin plain', B), 4);
  assert.equal(G.matchBelt('reef', B), -1);
  assert.equal(G.matchBelt('Delta Front', G.templates.delta.belts), 1);
});
test('parseWells: tab, semicolon (decimal comma) and comma tables, header skipped, environment with spaces', () => {
  const a = G.parseWells('name\tx\ty\tenvironment\nW-1\t1000\t2000\tDelta front\nW-2\t1500.5\t2500\tprodelta');
  assert.equal(a.wells.length, 2);
  assert.deepEqual([a.wells[1].name, a.wells[1].x, a.wells[1].y, a.wells[1].env], ['W-2', 1500.5, 2500, 'prodelta']);
  const b = G.parseWells('A;10,5;20;shelf\nB;11;21;offshore shelf');
  assert.equal(b.wells[0].x, 10.5); assert.equal(b.wells[1].env, 'offshore shelf');
  const c = G.parseWells('A, 10, 20, shoreface\nbad line');
  assert.equal(c.wells.length, 1); assert.equal(c.errors.length, 1);
  const d = G.parseWells('A 10 20 delta front');
  assert.equal(d.wells[0].env, 'delta front');
});

// ---------- library of depositional systems ----------
const GROUPS = ['Continental', 'Coastal & deltaic', 'Shelf & carbonate', 'Deep water', 'Lacustrine', 'Custom'];
const STATUS = /^(published|published \(abstract\)|published \(second hand\)|existence confirmed|memory|on the page)$/;
test('library: every system and group present, grouped in the UI order', () => {
  for (const k of ['fluvial', 'aeolian', 'estuary', 'wavedelta', 'delta', 'shelf', 'carbonate', 'ramp', 'mixed', 'glacial', 'fan', 'fansand', 'fanmud', 'apron', 'lake', 'playa', 'custom'])
    assert.ok(G.templates[k], 'missing template ' + k);
  assert.deepEqual(arr(G.groups), GROUPS);
  for (const g of GROUPS) assert.ok(Object.values(G.templates).some(t => t.group === g), 'empty group ' + g);
});
test('library: >= 3 belts, unique names, valid colours, widths > 0, a group, a source entry, a typical scale', () => {
  for (const [k, t] of Object.entries(G.templates)) {
    assert.ok(t.belts.length >= 3, k);
    assert.ok(GROUPS.includes(t.group), k + ' group ' + t.group);
    assert.equal(new Set(t.belts.map(b => G.norm(b.name))).size, t.belts.length, k + ' duplicate belt names');
    for (const b of t.belts) assert.ok(/^#[0-9a-f]{6}$/i.test(b.color) && b.w > 0 && b.name, k + ' ' + b.name);
    assert.ok(Array.isArray(t.refs) && t.refs.length >= 1, k + ' sources');
    for (const r of t.refs) { assert.equal(r.length, 3, k); assert.ok(r[0] && r[1], k); assert.ok(STATUS.test(r[2]), k + ' status ' + r[2]); }
    if (k !== 'custom') { assert.ok(t.scale && t.scale[0] > 0 && t.scale[1] > t.scale[0], k + ' scale'); }
    assert.ok(['linear', 'radial'].includes(t.geom) && ['distal', 'strike'].includes(t.outside), k);
  }
});
test('library: aliases unique within a template (no name or alias shared by two belts)', () => {
  for (const [k, t] of Object.entries(G.templates)) {
    const seen = new Map();
    t.belts.forEach((b, i) => { for (const key of new Set(G.keysOf(b))) { assert.ok(!seen.has(key) || seen.get(key) === i, `${k}: “${key}” in ${seen.has(key) ? t.belts[seen.get(key)].name : ''} and ${b.name}`); seen.set(key, i); } });
  }
});
test('matching: common well descriptions find the expected belt', () => {
  const cases = [['shelf', 'upper shoreface', 'Shoreface'], ['shelf', 'Lower shoreface', 'Shoreface'], ['shelf', 'HCS sandstone', 'Offshore transition'], ['shelf', 'foreshore', 'Shoreface'],
    ['delta', 'mouth bar', 'Delta front'], ['delta', 'Mouth-bar sandstones', 'Delta front'], ['wavedelta', 'beach ridges', 'Beach-ridge strandplain'],
    ['estuary', 'tidal bar', 'Tidal sand bars'], ['estuary', 'tidal flat', 'Tidal flats and meanders'], ['estuary', 'tidal sand ridge', 'Tidal sand ridges'],
    ['aeolian', 'interdune', 'Interdune-dominated erg margin'], ['aeolian', 'aeolian dune sandstone', 'Dune field (erg)'], ['aeolian', 'dry wadi', 'Wadi plain'], ['aeolian', 'sabkha', 'Sabkha / playa'],
    ['ramp', 'outer ramp', 'Outer ramp'], ['ramp', 'ooid shoal', 'Inner-ramp shoal'], ['ramp', 'mid-ramp tempestites', 'Mid ramp'],
    ['carbonate', 'reef', 'Platform margin (reef / shoal)'], ['carbonate', 'lagoon', 'Platform interior / lagoon'],
    ['lake', 'profundal', 'Profundal'], ['lake', 'fan delta', 'Alluvial fan / fan delta'], ['lake', 'littoral', 'Littoral'], ['playa', 'saline mudflat', 'Saline mudflat'],
    ['fan', 'lobe fringe', 'Distal lobes / lobe fringe'], ['fansand', 'suprafan lobe', 'Suprafan lobes'], ['fanmud', 'channel-levee', 'Channel–levee complex'],
    ['apron', 'mass transport complex', 'Slope (mass-transport complexes)'], ['glacial', 'grounding-line fan', 'Grounding-line proximal'], ['mixed', 'patch reef', 'Carbonate shoals / patch reefs'],
    ['fluvial', 'point bar', 'Meandering belt']];
  for (const [k, env, want] of cases) {
    const B = G.templates[k].belts, i = G.matchBelt(env, B);
    assert.ok(i >= 0 && B[i].name === want, `${k}: “${env}” -> ${i >= 0 ? B[i].name : 'no match'}, expected ${want}`);
  }
  assert.equal(G.matchBelt('reef', G.templates.fan.belts), -1, 'no partial match across words');
  assert.equal(G.matchBelt('sandstone', G.templates.shelf.belts), -1, 'a lithology alone matches nothing');
});
// ---------- scale hint ----------
test('scale hint: a 10x mismatch with the typical scale gives a note, within 3x none', () => {
  const t = G.templates.fanmud, lo = t.scale[0] * 1000, hi = t.scale[1] * 1000;
  const M = s => G.makeModel('fanmud', { ext: { xmin: 0, xmax: s, ymin: 0, ymax: s * .7 } });
  assert.ok(G.scaleHint(M(lo / 10)), 'map 10x smaller than the smallest typical');
  assert.equal(G.scaleHint(M(lo / 3)), null, 'within 3x');
  assert.equal(G.scaleHint(M(Math.sqrt(lo * hi))), null);
  assert.equal(G.scaleHint(M(hi * 2.9)), null);
  assert.ok(G.scaleHint(M(hi * 10)), 'map 10x larger');
  assert.match(G.scaleHint(M(lo / 10)), /km/);
  assert.equal(G.scaleHint(G.makeModel('custom', { ext: { xmin: 0, xmax: 10, ymin: 0, ymax: 10 } })), null, 'custom: no typical scale');
});
// ---------- save / open model ----------
test('model file: save -> open gives an identical model and wells; bad files are rejected', () => {
  const ex = G.examples.delta, M = JSON.parse(JSON.stringify(ex.M));
  M.template = 'custom'; M.belts[1].name = 'Delta front sands'; M.belts.push({ name: 'Abyssal plain', color: '#22446a', w: 3, alias: [] });
  M.channels = Object.assign(G.channelDefaults(M), { on: true, n: 4, w: 350, sin: 1.4 });
  const W = ex.wells.map(w => Object.assign({}, w)); W[0].b = 0;
  const txt = G.saveModel(M, W), r = G.openModel(txt);
  assert.deepEqual(arr(r.errors), []);
  assert.deepEqual(JSON.parse(JSON.stringify(r.M)), JSON.parse(JSON.stringify(G.normModel(M))));
  assert.deepEqual(JSON.parse(JSON.stringify(r.wells)), arr(W).map(w => ({ name: w.name, x: w.x, y: w.y, env: w.env, ...(w.b != null ? { b: w.b } : {}) })));
  assert.equal(G.saveModel(r.M, r.wells), txt, 'second round trip byte-identical');
  assert.deepEqual(arr(G.build(r.M, r.wells).t), arr(G.build(M, W).t));
  assert.ok(G.openModel('not json').errors.length);
  assert.ok(G.openModel('{"format":"something else"}').errors.length);
  assert.ok(G.openModel(JSON.stringify({ format: 'gde-model', version: 1, model: { belts: [{ name: 'A', color: 'red', w: 1 }] } })).errors.length);
});
// ---------- channels (sub-environments) ----------
test('channels: ribbons only inside their host belts, a channel well is honoured, other wells avoided', () => {
  const ex = G.examples.delta, M = JSON.parse(JSON.stringify(ex.M));
  M.channels = Object.assign(G.channelDefaults(M), { on: true, n: 3, w: 400, sin: 1.3 });
  const nb = M.belts.length, AB = G.allBelts(M);
  assert.equal(AB.length, nb + 1); assert.equal(AB[nb].name, 'Distributary channel');
  const W = ex.wells.concat([{ name: 'Ch-1', x: 13000, y: 26500, env: 'distributary channel' }]);
  const mod = G.build(M, W);
  for (const c of mod.check) assert.ok(c.honoured, `${c.name}: ${c.belt} vs ${c.b}`);
  assert.equal(mod.check[4].b, nb);
  const g = G.nodeGrid(mod, M.ext, 200);
  let inCh = 0, bad = 0;
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) { if (g.codes[j * g.nx + i] !== nb + 1) continue; inCh++;
    const x = g.x0 + i * g.dx, y = g.y0 + j * g.dy, base = G.classify(mod.D(x, y), mod.t); if (base < M.channels.host[0] || base > M.channels.host[1]) bad++; }
  assert.ok(inCh > 50, 'channels drawn: ' + inCh); assert.equal(bad, 0, 'channel cells outside the host belts');
  const off = G.build(Object.assign({}, M, { channels: Object.assign({}, M.channels, { on: false }) }), ex.wells);
  assert.deepEqual(arr(off.t), arr(mod.t), 'channel wells do not move the belt boundaries');
  const P = G.polygons(mod, M.ext, 150);
  assert.ok(P.some(p => p.code === nb + 1 && p.name === 'Distributary channel'));
  const e = M.ext, cell = Math.sqrt((e.xmax - e.xmin) * (e.ymax - e.ymin) / 250000);
  const a = G.polygons(mod, e, cell, { minArea: 0, tol: 0 }).raster.L, b = G.polygons(mod, e, cell, { minArea: 0, tol: 0, stride: 3 }).raster.L;
  let diff = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  assert.ok(diff / a.length < 0.005, `preview with channels: ${diff} of ${a.length}`);
});
test('channels: sinuosity of the drawn centreline matches the requested value', () => {
  for (const s of [1.1, 1.5, 2]) { const A = G.sineAmp(s, 1000); let L = 0, px = 0, py = 0;
    for (let i = 1; i <= 4000; i++) { const x = i / 4000 * 1000, y = A * Math.sin(2 * Math.PI * x / 1000); L += Math.hypot(x - px, y - py); px = x; py = y; }
    near(L / 1000, s, 0.01, 'sinuosity ' + s); }
  assert.equal(G.sineAmp(1, 1000), 0);
});

// ---------- threshold calibration ----------
const P5 = [1000, 2000, 3000, 4000, 5000];        // 6 belts, prior boundaries
test('calibrate: wells in belts 1, 2, 4 compatible with the prior keep the prior', () => {
  const r = G.calibrate([1500, 2500, 4500], [1, 2, 4], P5);
  assert.ok(r.ok); assert.deepEqual(arr(r.conflicts), []);
  assert.deepEqual(arr(r.t), P5);
});
test('calibrate: prior infeasible -> every threshold inside its feasible interval, increasing', () => {
  const d = [2200, 2600, 3300], b = [1, 2, 4], r = G.calibrate(d, b, P5);
  assert.ok(r.ok);
  const t = arr(r.t);
  for (let k = 0; k < t.length; k++) {
    const lo = Math.max(-Infinity, ...d.filter((v, i) => b[i] <= k)), hi = Math.min(Infinity, ...d.filter((v, i) => b[i] >= k + 1));
    assert.ok(t[k] > lo && t[k] < hi, `t${k}=${t[k]} not in (${lo}, ${hi})`);
    if (k) assert.ok(t[k] > t[k - 1], 'increasing');
  }
  near(t[1], 2400, 1e-9, 'single boundary at the middle of its interval');
  // every well falls in its belt
  d.forEach((v, i) => assert.equal(G.classify(v, t), b[i]));
});
test('calibrate: all wells in one belt -> belt widened around them, prior kept elsewhere when feasible', () => {
  const r = G.calibrate([2100, 2900], [2, 2], P5);
  const t = arr(r.t);
  assert.ok(t[1] < 2100 && t[2] > 2900);
  assert.equal(G.classify(2500, t), 2);
  assert.deepEqual(arr(G.calibrate([2200, 2800], [2, 2], P5).t), P5);
});
test('calibrate: inconsistent order detected and reported', () => {
  const r = G.calibrate([1500, 2500, 3500], [2, 1, 3], P5);
  assert.equal(r.ok, false);
  assert.equal(r.conflicts.length, 1);
  assert.ok(r.msgs.length >= 1 && /proximal|distal/.test(r.msgs[0]), String(r.msgs[0]));
  // the consistent wells are honoured
  const keep = [0, 1, 2].filter(i => !arr(r.conflicts).includes(i));
  for (const i of keep) assert.equal(G.classify([1500, 2500, 3500][i], arr(r.t)), [2, 1, 3][i]);
});
test('calibrate: no wells -> prior', () => {
  assert.deepEqual(arr(G.calibrate([], [], P5).t), P5);
});

// ---------- geometry ----------
const base = o => G.makeModel(o.template || 'shelf', Object.assign({ ext: { xmin: -5000, xmax: 5000, ymin: -5000, ymax: 5000 }, cell: 100, noise: { amp: 0, wl: 3000, seed: 1 } }, o));
test('linear: d = projection on the transport azimuth from the source point', () => {
  const M = base({ geom: 'linear', az: 90, src: [0, 0] });
  near(G.dBase(M, 1000, 500), 1000, 1e-9); near(G.dBase(M, -300, 7), -300, 1e-9);
  const M2 = base({ geom: 'linear', az: 45, src: [100, 100] });
  near(G.dBase(M2, 100 + 1000 / Math.SQRT2, 100 + 1000 / Math.SQRT2), 1000, 1e-6);
});
test('radial: d = distance from the source inside the fan, distal belt outside', () => {
  const M = base({ template: 'delta', geom: 'radial', az: 90, fan: 90, src: [0, 0], span: 6000, outside: 'distal' });
  const pol = (r, deg) => [r * Math.sin(deg * Math.PI / 180), r * Math.cos(deg * Math.PI / 180)];
  for (const [r, a] of [[1000, 90], [2500, 120], [3000, 60], [4000, 134]]) near(G.dBase(M, ...pol(r, a)), r, 1e-6, `r ${r} az ${a}`);
  const mod = G.build(M, []);
  const nb = M.belts.length;
  for (const [r, a] of [[1500, 180], [3000, 10], [2000, 270], [1000, 0]]) assert.equal(mod.beltAt(...pol(r, a)), nb - 1, `outside r ${r} az ${a}`);
  assert.equal(mod.beltAt(...pol(100, 90)), 0);
});

test('radial, belts along strike outside the fan: d = min(radial d, projection + protrusion)', () => {
  const M = base({ template: 'delta', geom: 'radial', az: 90, fan: 60, src: [0, 0], span: 6000, outside: 'strike', protrude: 1500 });
  const pol = (r, deg) => [r * Math.sin(deg * Math.PI / 180), r * Math.cos(deg * Math.PI / 180)];
  near(G.dBase(M, ...pol(3000, 90)), 3000, 1e-6, 'on the axis');
  near(G.dBase(M, ...pol(3000, 0)), 1500, 1e-6, 'along strike: projection 0 + protrusion');
  near(G.dBase(M, ...pol(2000, 180)), 1500 - 2000 * Math.cos(Math.PI / 2), 1e-6);
  near(G.dBase(M, -1000, 0), 500, 1e-6, 'behind the source: projection -1000 + 1500');
  const mod = G.build(M, []);
  assert.equal(mod.beltAt(-3000, 4000), 0, 'land behind the source, not basin');
  assert.equal(G.templates.delta.outside, 'strike'); assert.equal(G.templates.fan.outside, 'distal');
});
// ---------- noise ----------
test('noise: same seed -> identical grid, other seed -> different grid, amplitude 0 -> straight belts', () => {
  const M = base({ geom: 'linear', az: 30, src: [-4000, -4000], span: 9000, noise: { amp: 800, wl: 2500, seed: 42 } });
  const g1 = G.nodeGrid(G.build(M, []), M.ext, 200), g2 = G.nodeGrid(G.build(M, []), M.ext, 200);
  assert.deepEqual(arr(g1.codes), arr(g2.codes));
  const M3 = base({ geom: 'linear', az: 30, src: [-4000, -4000], span: 9000, noise: { amp: 800, wl: 2500, seed: 43 } });
  assert.notDeepEqual(arr(G.nodeGrid(G.build(M3, []), M.ext, 200).codes), arr(g1.codes));
  const F = G.field(M), F0 = G.field(base({ geom: 'linear', az: 30, src: [-4000, -4000], span: 9000 }));
  let mx = 0; for (let i = 0; i < 200; i++) { const x = -5000 + 50 * i, y = 3000 - 20 * i; mx = Math.max(mx, Math.abs(F(x, y) - F0(x, y))); }
  assert.ok(mx > 100 && mx <= 1600, 'noise shift ' + mx);
});

// ---------- auto-fit ----------
test('auto-fit: azimuth of a known linear model recovered within 5 degrees', () => {
  for (const az0 of [60, 200, 315]) {
    const truth = base({ geom: 'linear', az: az0, src: [0, 0], span: 6000 });
    truth.src = [-3000 * Math.sin(az0 * Math.PI / 180), -3000 * Math.cos(az0 * Math.PI / 180)];
    const mt = G.build(truth, []), r = rng(az0), W = [];
    for (let i = 0; i < 30; i++) { const x = -5000 + 10000 * r(), y = -5000 + 10000 * r(); W.push({ name: 'w' + i, x, y, b: mt.beltAt(x, y) }); }
    const M = Object.assign({}, truth, { az: (az0 + 110) % 360 });
    const f = G.fitAzimuth(M, W, { source: false });
    let e = Math.abs(((f.az - az0) % 360 + 540) % 360 - 180);
    assert.ok(e <= 5, `az0 ${az0} fitted ${f.az}`);
    assert.equal(f.count, 30);
  }
});
test('auto-fit radial: source and azimuth found so that every well is consistent', () => {
  const truth = base({ template: 'fan', geom: 'radial', az: 180, fan: 80, src: [0, 5500], span: 9000 });
  const mt = G.build(truth, []);
  const W = [[0, 3000], [-800, 0], [600, -2500], [1500, -4500]].map(([x, y], i) => ({ name: 'F' + i, x, y, b: mt.beltAt(x, y) }));
  const M = Object.assign({}, truth, { az: 120, src: [3000, 4000] });
  const f = G.fitAzimuth(M, W, { source: true });
  assert.equal(f.count, W.length);
  const mod = G.build(Object.assign({}, M, { az: f.az, src: f.src }), W);
  assert.ok(mod.check.every(c => c.honoured), JSON.stringify(mod.check.map(c => [c.belt, c.b])));
});

// ---------- warping ----------
test('warping: a conflicting well ends in its belt, the map beyond 3 radii is unchanged', () => {
  const M = base({ geom: 'linear', az: 90, src: [-5000, 0], span: 8000 });
  // four wells in order along y = 4000 + one conflicting well C (slope, more proximal than the offshore-transition and shelf wells)
  const W = [{ name: 'A', x: -3500, y: 4000, env: 'shoreface' }, { name: 'D', x: -1800, y: 4000, env: 'offshore transition' },
    { name: 'E', x: 0, y: 4000, env: 'offshore shelf' }, { name: 'B', x: 2500, y: 4000, env: 'slope' }, { name: 'C', x: -2600, y: -3500, env: 'slope' }];
  const R = 900, ic = 4;
  const off = G.build(Object.assign({}, M, { warp: { on: false, R } }), W), on = G.build(Object.assign({}, M, { warp: { on: true, R } }), W);
  assert.deepEqual(arr(off.cal.conflicts), [ic]);
  assert.equal(off.check[ic].honoured, false, 'conflict without warping');
  assert.ok(on.check.every(c => c.honoured), 'all honoured with warping');
  assert.ok(on.warp.wells.includes(ic));
  assert.deepEqual(arr(on.t), arr(off.t), 'same thresholds');
  const ext = M.ext, g0 = G.nodeGrid(off, ext, 100), g1 = G.nodeGrid(on, ext, 100);
  let changedNear = 0, changedFar = 0;
  for (let j = 0; j < g0.ny; j++) for (let i = 0; i < g0.nx; i++) {
    const k = j * g0.nx + i; if (g0.codes[k] === g1.codes[k]) continue;
    const x = g0.x0 + i * g0.dx, y = g0.y0 + j * g0.dy;
    if (Math.hypot(x - W[ic].x, y - W[ic].y) > 3 * R) changedFar++; else changedNear++;
  }
  assert.ok(changedNear > 0, 'warping changes the map near the well');
  assert.equal(changedFar, 0, 'unchanged beyond 3 radii');
});

// ---------- examples ----------
for (const k of ['delta', 'fan', 'estuary', 'ramp', 'lake']) test(`example ${k}: every well honoured without warping, belts in order away from the source`, () => {
  const ex = G.examples[k];
  assert.ok(ex, 'missing example ' + k);
  if (k === 'delta') assert.equal(ex.wells.length, 4); else if (k === 'fan') assert.equal(ex.wells.length, 3); else assert.ok(ex.wells.length >= 3);
  const mod = G.build(ex.M, ex.wells);
  for (const c of mod.check) { assert.ok(c.b >= 0, c.name + ' matched'); assert.ok(c.honoured, `${c.name}: ${c.belt} vs ${c.b}`); assert.ok(c.dist > 0); }
  assert.deepEqual(arr(mod.warp.wells), [], 'no warping needed');
  const t = arr(mod.t); for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1]);
  const g = G.nodeGrid(mod, ex.M.ext, 500);
  const used = new Set(arr(g.codes)); assert.ok(used.size >= 4, 'belts on the map ' + [...used]);
  assert.equal(G.scaleHint(ex.M), null, 'example at a typical scale');
});

// ---------- distance to the nearest boundary ----------
test('distance to the nearest boundary: straight belts, exact value', () => {
  const M = base({ geom: 'linear', az: 90, src: [-5000, 0], span: 6000 });
  const mod = G.build(M, []), t = arr(mod.t), x = -5000 + t[1] + 300;
  near(G.distToBoundary(mod, x, 0, M.ext), 300, 15);
});

// ---------- polygons and writers ----------
test('polygons: straight belts give one polygon per belt, areas add up to the extent', () => {
  const M = base({ geom: 'linear', az: 90, src: [-5000, 0], span: 6000 });
  const P = G.polygons(G.build(M, []), M.ext, 100);
  const tot = P.reduce((s, p) => s + p.area, 0);
  near(tot, 1e8, 1e-3);
  assert.equal(new Set(P.map(p => p.code)).size, P.length);
  for (const p of P) assert.ok(G.sArea(p.outer) > 0, 'exterior counter-clockwise (y up)');
});
test('preview polygons (d interpolated every 3 cells) agree with the exact raster on > 99.5 % of the cells', () => {
  for (const k of Object.keys(G.examples)) {
    const ex = G.examples[k], mod = G.build(ex.M, ex.wells), e = ex.M.ext, cell = Math.sqrt((e.xmax - e.xmin) * (e.ymax - e.ymin) / 250000);
    const a = G.polygons(mod, ex.M.ext, cell, { minArea: 0, tol: 0 }).raster.L, b = G.polygons(mod, ex.M.ext, cell, { minArea: 0, tol: 0, stride: 3 }).raster.L;
    let diff = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
    assert.ok(diff / a.length < 0.005, `${k}: ${diff} of ${a.length}`);
  }
});
test('IRAP lines: closed rings, z = belt code, 999 separator lines', () => {
  const P = [{ code: 3, name: 'Shoreface', outer: [[0, 0], [10, 0], [10, 10]], holes: [], area: 50, perimeter: 34 }];
  const L = G.irapLines(P).trim().split('\n');
  assert.deepEqual(L, ['0.000000 0.000000 3.000000', '10.000000 0.000000 3.000000', '10.000000 10.000000 3.000000', '0.000000 0.000000 3.000000', '999.000000 999.000000 999.000000']);
});
test('GeoJSON: exterior counter-clockwise, hole clockwise, rings closed, belt in properties', () => {
  const P = [{ code: 2, name: 'Delta front', outer: [[0, 0], [0, 10], [10, 10], [10, 0]], holes: [[[2, 2], [4, 2], [4, 4], [2, 4]]], area: 96, perimeter: 48 }];
  const g = JSON.parse(G.geojson(P)), c = g.features[0].geometry.coordinates;
  assert.equal(g.features[0].properties.class, 'Delta front'); assert.equal(g.features[0].properties.code, 2);
  const sa = r => { let s = 0; for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return s / 2; };
  assert.ok(sa(c[0]) > 0 && sa(c[1]) < 0);
  assert.deepEqual(c[0][0], c[0][c[0].length - 1]);
});
test('ZMAP+: header and column-major order from the upper-left node; accepted by the ZMAP checker', () => {
  const Gd = { name: 'gde belts', nx: 3, ny: 2, x0: 0, y0: 0, dx: 100, dy: 50, codes: [1, 2, 3, 4, 5, 6], legend: [[1, 'A'], [2, 'B']] };
  const txt = G.zmap(Gd), L = txt.split('\n');
  const h = L.indexOf('@gde_belts, GRID, 5');
  assert.ok(h >= 0, txt);
  assert.deepEqual(L.slice(h, h + 5), ['@gde_belts, GRID, 5', '15, 1.0E+30, , 7, 1', '2, 3, 0, 200, 0, 50', '0.0, 0.0, 0.0', '@']);
  assert.ok(L[0].startsWith('!'));
  // nodes: row j=0 is ymin. Upper-left = (i=0, j=1) = 4, then down the column: 1; next column 5, 2; then 6, 3
  const vals = L.slice(h + 5).join(' ').trim().split(/\s+/).map(Number);
  assert.deepEqual(vals, [4, 1, 5, 2, 6, 3]);
  assert.equal(L[h + 5], '      4.0000000      1.0000000');
  const z = Z.parse(txt, 'g.zmap'), f = Z.check(z);
  assert.deepEqual([...f].filter(x => x.sev !== 'I').map(x => x.rule), []);
  assert.equal(Z.value(z, 0, 0), 4); assert.equal(Z.value(z, 1, 2), 3);
});
test('grid CSV: x, y, code, belt', () => {
  const Gd = { nx: 2, ny: 1, x0: 10, y0: 20, dx: 5, dy: 5, codes: [1, 2], legend: [[1, 'Coastal plain'], [2, 'Shoreface, upper']] };
  assert.equal(G.gridCsv(Gd), 'x,y,code,belt\n10,20,1,Coastal plain\n15,20,2,"Shoreface, upper"');
});

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ', name); }
  catch (e) { fail++; console.log('FAIL ', name, '\n     ', String(e.message).split('\n').slice(0, 6).join('\n      ')); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
