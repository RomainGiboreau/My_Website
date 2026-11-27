// Self-check for the GDE map generator core (docs/gdemap/index.html, <script id="gde-core">).
// Run: node scripts/gde_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const html = read('docs/gdemap/index.html');
const m = html.match(/<script id="gde-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'gde-core script block not found');
// loaded in this context (a vm sandbox makes every global lookup slow: Math, typed arrays...)
const ctx = { window: {} };
new Function('window', m[1])(ctx.window);
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
const STATUS = /^(published|existence confirmed|memory|on the page|to verify)( (.*))?$/;
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

// =====================================================================================
// ---------- v2: key lines, sources, bodies, mixed zones, layers (lithology, faults, objects) ----------
const linesModel = (key, o = {}) => G.makeModel(key, Object.assign({ geom: 'lines', ext: { xmin: -20000, xmax: 20000, ymin: -20000, ymax: 20000 }, noise: { amp: 0, wl: 5000, seed: 1 }, warp: { on: false, R: 2000 } }, o));
const clsIdx = (M, name) => arr(G.allBelts(M)).findIndex(b => b.name === name);
test('signed distance to a polyline: sign on both sides, segments, vertices, ends extended', () => {
  const L = [[0, 0], [10, 0], [20, 10]];
  near(G.sdist(L, 5, -3), 3, 1e-9, 'right of the direction of travel is positive');
  near(G.sdist(L, 5, 4), -4, 1e-9, 'left is negative');
  near(G.sdist(L, 10.5, -3), Math.hypot(.5, 3), 1e-9, 'convex side of a vertex');
  near(G.sdist(L, 10, 1), -Math.SQRT1_2, 1e-9, 'concave side');
  near(G.sdist(L, -5, 2), -2, 1e-9, 'before the first vertex: the first segment extended');
  near(G.sdist(L, 25, 20), -5 / Math.SQRT2, 1e-9, 'after the last vertex: the last segment extended');
  near(G.sdist([[0, 0], [10, 0]], 3, 7), -7, 1e-9);
});
test('normalised shelf coordinate between two lines: 0 at the shoreline, 1 at the shelf edge, belts widen with the shelf', () => {
  const S = [[-100, 0], [100, 0]], E = [[-100, -10], [0, -10], [100, -40]];
  near(G.shelfCoord(S, E, -50, -2.5), .25, 1e-9);
  near(G.shelfCoord(S, E, -50, -5), .5, 1e-9);
  assert.ok(G.shelfCoord(S, E, 80, -5) < .25, 'wide shelf: the same distance from the coast is less far across the shelf');
  assert.equal(G.shelfCoord(S, E, 0, 5), 0); assert.equal(G.shelfCoord(S, E, -50, -20), 1);
  // in a model, d = prior position of the shoreline at the coast, of the shelf edge at the edge, proportional between
  const M = linesModel('shelf', { lines: [{ name: 'Shoreline', k: 0, pts: [[-30000, 0], [30000, 0]] }, { name: 'Shelf edge', k: 3, pts: [[-30000, -4000], [-15000, -4000], [-5000, -4000], [30000, -16000]] }] });
  const p = arr(G.prior(M)), F = G.geoField(M);
  near(F(-20000, 0), p[0], 1e-6); near(F(-20000, -4000), p[3], 1e-6); near(F(-20000, -2000), (p[0] + p[3]) / 2, 1e-6);
  near(F(-20000, 3000), p[0] - 3000, 1e-6, 'land side: signed distance');
  const u = (p[1] - p[0]) / (p[3] - p[0]), mod = G.build(M, []);
  assert.equal(mod.beltAt(-20000, -4000 * u * .9), 1, 'narrow shelf: shoreface'); assert.equal(mod.beltAt(25000, -4000 * u * .9), 1);
  assert.ok(mod.beltAt(-20000, -4000 * u * 1.5) === 2 && mod.beltAt(25000, -4000 * u * 1.5) === 1, 'the belt is wider where the shelf is wider');
});
test('source lobe shifts d basinward in front of it, not along strike; asymmetry deflects it to one side', () => {
  const base = { lines: [{ name: 'Shoreline', k: 0, pts: [[-30000, 0], [30000, 0]] }] };
  const M0 = linesModel('delta', base), F0 = G.geoField(M0);
  const src = a => linesModel('delta', Object.assign({}, base, { sources: [{ kind: 'coast', line: 0, x: 0, y: 0, az: 180, L: 3000, open: 60, asym: a }] }));
  const F = G.geoField(src(0));
  assert.ok(F(0, -2000) < F0(0, -2000) - 2000, 'in front of the source: more proximal ' + F(0, -2000) + ' vs ' + F0(0, -2000));
  near(F(18000, -2000), F0(18000, -2000), 1e-6, 'far along strike: unchanged');
  near(F(0, 6000), F0(0, 6000), 1e-6, 'landward: unchanged');
  const drop = (FF, x, y) => F0(x, y) - FF(x, y);
  near(drop(F, -2500, -3000), drop(F, 2500, -3000), 1e-6, 'no drift: symmetric');
  const Fa = G.geoField(src(.6)), Fb = G.geoField(src(-.6));
  // axis towards the south (az 180): its right side is the west (x < 0)
  assert.ok(drop(Fa, -3500, -3000) > drop(Fa, 3500, -3000) + 500, 'asym > 0: deflected to the right of the axis');
  assert.ok(drop(Fb, 3500, -3000) > drop(Fb, -3500, -3000) + 500, 'asym < 0: to the left');
  // variant classes away from the source
  const M1 = src(0), mod = G.build(M1, []);
  assert.equal(mod.beltAt(0, -3500), 1, 'delta front in front of the source, beyond the 3 km protrusion'); assert.equal(mod.beltAt(0, -1500), 0, 'the delta plain protrudes');
  assert.equal(mod.beltAt(15000, -600), clsIdx(M1, 'Interdeltaic shoreface'), 'interdeltaic shoreface along strike');
});
test('fan source at the shelf edge: lobe in front, most distal belt beside it, shelf landward, canyon notch', () => {
  const M = linesModel('fansand', { lines: [{ name: 'Shelf edge', k: -1, pts: [[-30000, 10000], [30000, 10000]] }], sources: [{ kind: 'fan', line: 0, x: 0, y: 10000, az: 180, L: 15000, open: 50, asym: 0 }] });
  const mod = G.build(M, []), n = M.belts.length;
  assert.equal(mod.beltAt(0, 9000), 0, 'canyon / slope at the mouth');
  assert.equal(mod.beltAt(0, 2000), 2, 'suprafan lobes down the axis');
  assert.equal(mod.beltAt(16000, 4000), n - 1, 'basin plain beside the fan');
  assert.equal(mod.beltAt(8000, 14000), clsIdx(M, 'Shelf'), 'shelf landward of the shelf edge');
  assert.equal(mod.beltAt(0, 10600), 0, 'canyon cut into the shelf');
});
test('isolated body: core and halos override the regional map, an inside well is honoured by enlarging the body', () => {
  const M = G.makeModel('carbonate', { geom: 'linear', az: 90, src: [-20000, 0], span: 9000, ext: { xmin: -20000, xmax: 10000, ymin: -10000, ymax: 10000 }, noise: { amp: 0, wl: 5000, seed: 1 }, warp: { on: false, R: 1000 },
    bodies: [{ type: 'pinnacle', shape: 'ellipse', x: 0, y: 0, a: 600, e: 1, rot: 0, w: [250, 700], irr: 0 }] });
  const mod = G.build(M, []), n = M.belts.length;
  assert.equal(mod.beltAt(0, 0), clsIdx(M, 'Reef core'));
  assert.equal(mod.beltAt(700, 0), clsIdx(M, 'Reef flank / talus'));
  assert.equal(mod.beltAt(0, -1200), clsIdx(M, 'Off-reef halo'));
  assert.equal(mod.beltAt(3000, 0), n - 1, 'regional basin outside the halo');
  const W = [{ name: 'P-1', x: 900, y: 0, env: 'Reef core' }, { name: 'B-1', x: 5000, y: 0, env: 'Basin' }];
  const m2 = G.build(M, W);
  assert.ok(m2.check.every(c => c.honoured), JSON.stringify(m2.check.map(c => [c.name, c.belt])));
  assert.ok(m2.bodies.adj.length === 1 && m2.bodies.adj[0].scale > 1.5, 'body enlarged and reported');
  const P = G.polygons(m2, M.ext, 100);
  assert.ok(P.some(p => p.name === 'Reef core' && p.code === clsIdx(M, 'Reef core') + 1), 'exported with its own code');
});
test('traced channel (polyline with a width) and freehand polygon bodies: area, environment and code', () => {
  const M = G.makeModel('fan', { geom: 'linear', az: 180, src: [0, 10000], span: 20000, ext: { xmin: -10000, xmax: 10000, ymin: -10000, ymax: 10000 }, noise: { amp: 0, wl: 5000, seed: 1 }, warp: { on: false, R: 1000 },
    bodies: [{ type: 'custom', shape: 'ribbon', x: 0, y: 0, line: [[-5000, 0], [5000, 0]], width: 430, env: 'Channel fill', color: '#c0602a', w: [], irr: 0 },
      { type: 'custom', shape: 'poly', x: 0, y: 5000, pts: [[-1000, -1000], [1000, -1000], [1000, 1000], [-1000, 1000]], env: 'Lobe sand', color: '#f0c040', w: [], irr: 0 }] });
  const mod = G.build(M, []), g = G.nodeGrid(mod, M.ext, 25), ci = clsIdx(M, 'Channel fill') + 1, li = clsIdx(M, 'Lobe sand') + 1;
  let a = 0, b = 0; for (const c of g.codes) { if (c === ci) a++; if (c === li) b++; } a *= 625 / 2500; b *= 625 / 2500;
  near(a * 2500, 10000 * 430 + Math.PI * 215 * 215, 0.06 * 4e6, 'ribbon area');
  near(b * 2500, 4e6, 0.06 * 4e6, 'polygon area');
  assert.ok(arr(g.legend).some(([c, nm]) => c === ci && nm === 'Channel fill'));
});
test('mixed zone between two belts: own class “A + B”; wells “A / B” honoured in A, B or the mix', () => {
  const M = G.makeModel('shelf', { geom: 'linear', az: 90, src: [-5000, 0], span: 6000, ext: { xmin: -5000, xmax: 5000, ymin: -5000, ymax: 5000 }, noise: { amp: 0, wl: 3000, seed: 1 }, warp: { on: false, R: 1000 }, mix: [{ k: 1, w: 200 }] });
  const mi = clsIdx(M, 'Shoreface + Offshore transition');
  assert.ok(mi > 0 && G.allBelts(M)[mi].kind === 'mix');
  const mod = G.build(M, []), x = -5000 + mod.t[1];
  assert.equal(mod.beltAt(x + 40, 0), mi); assert.equal(mod.beltAt(x - 40, 0), mi); assert.equal(mod.beltAt(x + 250, 0), 2); assert.equal(mod.beltAt(x - 250, 0), 1);
  const W = [{ name: 'A', x: -4000, y: 0, env: 'shoreface' }, { name: 'AB', x: -2800, y: 0, env: 'Shoreface / offshore transition' }, { name: 'C', x: 0, y: 0, env: 'offshore shelf' }];
  const m2 = G.build(M, W);
  assert.ok(m2.check.every(c => c.honoured), JSON.stringify(m2.check.map(c => [c.name, c.b, c.belt])));
  assert.equal(m2.check[1].belt, mi, 'the A / B well sits in the mixed zone');
  // without a mixed zone the A / B well is honoured in A or B
  const M0 = Object.assign({}, M, { mix: [] }), m0 = G.build(M0, W);
  assert.ok(m0.check.every(c => c.honoured)); assert.ok([1, 2].includes(m0.check[1].belt));
  const P = G.polygons(mod, M.ext, 50); assert.ok(P.some(p => p.code === mi + 1 && p.name === 'Shoreface + Offshore transition'));
});
const lithLayer = (o = {}) => Object.assign({ id: 'L1', name: 'test', role: 'lith', on: true, trend: { on: true, dir: 'distal', w: 1, smooth: 0 },
  grid: (() => { const nx = 21, ny = 21, z = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) z.push(-5000 + j * 500); return { nx, ny, x0: -5000, y0: -5000, dx: 500, dy: 500, z }; })() }, o);
test('lithology layer as trend: weight 0 = model, 100 % = trend (normalised), direction flips, toggling the layer off restores the model', () => {
  const M0 = G.makeModel('shelf', { geom: 'linear', az: 90, src: [-5000, 0], span: 8000, ext: { xmin: -5000, xmax: 5000, ymin: -5000, ymax: 5000 }, noise: { amp: 0, wl: 3000, seed: 1 }, warp: { on: false, R: 1000 } });
  const D0 = G.build(M0, []).D, pts = [[-3000, -2000], [0, 0], [2500, 3500], [4000, -4000]];
  const mk = (w, dir, on = true) => G.build(Object.assign({}, M0, { layers: [lithLayer({ on, trend: { on: true, dir, w, smooth: 0 } })] }), []).D;
  const Dw0 = mk(0, 'distal'); for (const [x, y] of pts) near(Dw0(x, y), D0(x, y), 1e-6);
  const D1 = mk(1, 'distal');
  assert.ok(D1(0, 3000) > D1(0, -3000) + 1000, 'high values distal'); near(D1(-3000, 1000), D1(3000, 1000), 1e-6, 'model direction gone at 100 %');
  near(D1(0, 4900) - D1(0, -4900), D0(4900, 0) - D0(-4900, 0), 0.06 * 9800, 'trend normalised to the range of d');
  const Dp = mk(1, 'proximal'); assert.ok(Dp(0, 3000) < Dp(0, -3000) - 1000, 'direction flipped');
  const Dh = mk(.5, 'distal'); near(Dh(1000, 2000), (D0(1000, 2000) + D1(1000, 2000)) / 2, 1e-6, 'half weight');
  const Doff = mk(1, 'distal', false); for (const [x, y] of pts) near(Doff(x, y), D0(x, y), 1e-6, 'layer off');
});
test('trend grids: ZMAP+, Surfer ASCII and CSV x,y,z read back the same values; bilinear resampling', () => {
  const nx = 5, ny = 4, z = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) z.push(i * 10 + j);
  const Gd = { name: 't', nx, ny, x0: 100, y0: 200, dx: 50, dy: 50, codes: z, legend: [] };
  const a = G.parseGrid(G.zmap(Gd));
  assert.deepEqual([a.nx, a.ny, a.x0, a.y0, a.dx, a.dy], [nx, ny, 100, 200, 50, 50]); assert.deepEqual(arr(a.z), z);
  let s = `DSAA\n${nx} ${ny}\n100 300\n200 350\n0 43\n`; for (let j = 0; j < ny; j++) s += z.slice(j * nx, j * nx + nx).join(' ') + '\n';
  const b = G.parseGrid(s); assert.deepEqual(arr(b.z), z); assert.equal(b.dx, 50);
  let c = 'x,y,z\n'; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) c += `${100 + 50 * i},${200 + 50 * j},${z[j * nx + i]}\n`;
  const cc = G.parseGrid(c); assert.deepEqual(arr(cc.z), z); assert.equal(cc.x0, 100);
  near(G.sampleGrid(a, 125, 225), (0 + 10 + 1 + 11) / 4, 1e-9);
  const nul = Object.assign({}, a, { z: arr(a.z).map((v, i) => i === 0 ? null : v) }); assert.ok(isFinite(G.sampleGrid(nul, 110, 205)));
  assert.ok(Number.isNaN(G.sampleGrid(a, 0, 0)), 'outside: no value');
});
test('paint grid (brush) round trip in the model file; pushes d distal where painted', () => {
  const ex = G.examples.coast, M = JSON.parse(JSON.stringify(ex.M));
  M.paint = G.paintGrid(M.ext, 64); G.paintStroke(M.paint, 30000, 20000, 6000, 1500);
  const txt = G.saveModel(M, ex.wells), r = G.openModel(txt);
  assert.deepEqual(arr(r.errors), []); assert.deepEqual(JSON.parse(JSON.stringify(r.M.paint)), JSON.parse(JSON.stringify(G.normModel(M).paint)));
  assert.equal(G.saveModel(r.M, r.wells), txt);
  const a = G.build(ex.M, [], { dist: false }).D, b = G.build(r.M, [], { dist: false }).D;
  near(b(30000, 20000) - a(30000, 20000), 1500, 40); near(b(5000, 45000), a(5000, 45000), 1e-6);
});
test('v1 model file opens (no lines, no layers) and gives the v1 map', () => {
  const v1 = JSON.stringify({ format: 'gde-model', version: 1, generator: 'GDE map generator', model: { template: 'delta', belts: G.templates.delta.belts.map(b => ({ name: b.name, color: b.color, w: b.w, alias: b.alias })),
    geom: 'radial', az: 165, src: [12000, 30000], fan: 50, span: 32000, outside: 'strike', protrude: 9000, noise: { amp: 1500, wl: 8000, seed: 7 }, warp: { on: true, R: 4000 }, ext: { xmin: 0, xmax: 40000, ymin: 0, ymax: 30000 }, cell: 100,
    channels: { on: false, n: 3, w: 530, sin: 1.3, host: [0, 0], name: 'Distributary channel', color: '#e8a33d' } }, wells: G.examples.delta.wells });
  const r = G.openModel(v1); assert.deepEqual(arr(r.errors), []);
  assert.equal(r.M.geom, 'radial'); assert.deepEqual(arr(r.M.lines), []); assert.deepEqual(arr(r.M.layers), []);
  const a = G.build(r.M, r.wells), b = G.build(G.examples.delta.M, G.examples.delta.wells);
  assert.deepEqual(arr(a.t), arr(b.t)); for (const [x, y] of [[5000, 5000], [20000, 20000], [35000, 10000]]) assert.equal(a.beltAt(x, y), b.beltAt(x, y));
});
test('image layer: affine georeferencing from 2, 3 and 4 points; colour bar inverted by CIE Lab; luminance fallback', () => {
  const a2 = G.affine([[0, 0, 1000, 5000], [200, 100, 3000, 4000]]); near(a2.f([100, 50])[0], 2000, 1e-9); near(a2.f([100, 50])[1], 4500, 1e-9);
  const P3 = [[0, 0], [100, 0], [0, 100], [100, 100]].map(([u, v]) => { const X = 10 + 2 * u * Math.cos(.3) - 2 * v * Math.sin(.3), Y = 20 - 2 * u * Math.sin(.3) - 2 * v * Math.cos(.3); return [u, v, X, Y]; });
  const a4 = G.affine(P3), q = a4.inv(...a4.f([37, 61])); near(q[0], 37, 1e-6); near(q[1], 61, 1e-6); near(a4.rms, 0, 1e-6);
  near(G.affine(P3.slice(0, 3)).f([50, 50])[0], (P3[1][2] + P3[2][2]) / 2, 1e-6);
  // an image 40 x 10: colours blue -> red from left to right; the colour bar is row 8
  const w = 40, h = 10, data = new Uint8ClampedArray(w * h * 4), col = t => [Math.round(255 * t), 40, Math.round(255 * (1 - t))];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = col(i / (w - 1)); data.set([c[0], c[1], c[2], 255], 4 * (j * w + i)); }
  const img = { w, h, data }, lut = G.barLut(img, [0, 8], [39, 8], 0, 100);
  near(G.imgValue(img, 20, 2, { lut, tol: 10 }), 20 / 39 * 100, 3, 'value from the colour bar');
  const lum = G.imgValue(img, 39, 2, {}), lum0 = G.imgValue(img, 0, 2, {}); assert.ok(lum > lum0 && lum <= 1 && lum0 >= 0, 'luminance 0..1');
  const cal = G.affine([[0, 0, 0, 600], [40, 6, 4000, 0]]), g = G.imageGrid(img, cal, { lut, tol: 10 }, { nx: 5, ny: 3, x0: 0, y0: 0, dx: 1000, dy: 300 });
  assert.ok(g.z.filter(v => v != null && isFinite(v)).length >= 10); near(g.z[2], 2000 / 4000 * 40 / 39 * 100, 6);
});
const blobs = () => { const nx = 120, ny = 100, z = new Array(nx * ny).fill(0);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i;
    if (Math.abs(j - (30 + 8 * Math.sin(i / 9))) < 2.5 && i > 5 && i < 115) z[k] = 1;   // sinuous channel
    if ((i - 60) ** 2 + (j - 75) ** 2 < 12 ** 2) z[k] = 1;                                // round blob
    if (Math.abs(i - 100) < 2 && Math.abs(j - 90) < 2) z[k] = 1; }                       // speck
  return { nx, ny, x0: 0, y0: 0, dx: 10, dy: 10, z }; };
test('extract bodies: threshold + minimum area + elongation keeps a channel and drops a round blob and a speck', () => {
  const r = G.extractBodies(blobs(), { mode: 'above', thr: .5, smooth: 0, minArea: 1000, minElong: 3, env: 'Channel fill', color: '#c0602a' });
  assert.equal(r.bodies.length, 1, JSON.stringify(r.stats)); const b = r.bodies[0];
  assert.equal(b.env, 'Channel fill'); assert.equal(b.shape, 'poly'); assert.ok(r.dropped >= 2);
  const r2 = G.extractBodies(blobs(), { mode: 'above', thr: .5, smooth: 0, minArea: 1000, minElong: 0, env: 'Lobe' }); assert.equal(r2.bodies.length, 2);
  const r3 = G.extractBodies(blobs(), { mode: 'above', pct: 90, smooth: 0, minArea: 100, minElong: 0, env: 'x' }); assert.ok(r3.bodies.length >= 1);
});
test('fault extraction: two straight faults in a discontinuity grid recovered as polylines, specks dropped', () => {
  const nx = 150, ny = 120, z = new Array(nx * ny).fill(.1);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i;
    if (Math.abs((j - 10) - 0.8 * (i - 20)) < 1.2 && i >= 20 && i <= 110) z[k] = .9;
    if (Math.abs(i - 130) < 1.1 && j >= 15 && j <= 105) z[k] = .9;
    if ((i - 60) ** 2 + (j - 100) ** 2 < 4) z[k] = .9; }
  const F = G.extractFaults({ nx, ny, x0: 0, y0: 0, dx: 10, dy: 10, z }, { mode: 'above', thr: .5, minLen: 300, tol: 15 });
  assert.equal(F.faults.length, 2, JSON.stringify(F.faults.map(f => f.pts.length)));
  for (const f of F.faults) { const p = f.pts, a = p[0], b = p[p.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    assert.ok(L > 700, 'long ' + L);
    for (const q of p) { const dd = Math.abs((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) / L; assert.ok(dd < 25, 'straight ' + dd); } }
  const vert = F.faults.find(f => Math.abs(f.pts[0][0] - 1300) < 30); assert.ok(vert, 'the vertical fault at x = 1300');
});
test('fault offset: d shifted distal on the downthrown side only, decaying to zero at the tips', () => {
  const M0 = G.makeModel('lake', { geom: 'linear', az: 90, src: [-10000, 0], span: 16000, ext: { xmin: -10000, xmax: 10000, ymin: -10000, ymax: 10000 }, noise: { amp: 0, wl: 3000, seed: 1 }, warp: { on: false, R: 1000 } });
  const M = Object.assign({}, M0, { faults: [{ pts: [[0, -6000], [0, 6000]], side: 1, off: 2000, taper: 4000 }] });   // heading north: right side = east downthrown
  const a = G.build(M0, []).D, b = G.build(M, []).D;
  near(b(300, 0) - a(300, 0), 2000, 60, 'hanging wall, mid fault'); near(b(-300, 0), a(-300, 0), 1e-6, 'footwall unchanged');
  const tip = b(300, 5800) - a(300, 5800); assert.ok(tip < 300 && tip >= 0, 'decays to the tip ' + tip);
  near(b(300, 9000), a(300, 9000), 1e-6, 'beyond the tip'); assert.ok(b(300, 3000) - a(300, 3000) > 1000);
  const Mf = Object.assign({}, M, { faults: [Object.assign({}, M.faults[0], { side: -1 })] }), c = G.build(Mf, []).D;
  near(c(-300, 0) - a(-300, 0), 2000, 60, 'side flipped');
});
test('fault-bounded source: a fan-delta lobe from the border fault into the hanging wall', () => {
  const M = G.makeModel('lake', { geom: 'lines', ext: { xmin: -15000, xmax: 15000, ymin: -15000, ymax: 15000 }, noise: { amp: 0, wl: 3000, seed: 1 }, warp: { on: false, R: 1000 }, span: 16000,
    lines: [{ name: 'Lake margin', k: 0, pts: [[-12000, -20000], [-12000, 20000]] }],
    faults: [{ pts: [[12000, -12000], [12000, 12000]], side: -1, off: 0, taper: 3000 }], sources: [{ kind: 'fault', fault: 0, x: 12000, y: 0, az: 270, L: 3000, open: 70, asym: 0 }] });
  const mod = G.build(M, []), n = M.belts.length;
  assert.equal(mod.beltAt(11000, 0), 0, 'fan delta in front of the fault source'); assert.equal(mod.beltAt(11000, 9000), n - 1, 'profundal along the fault away from it');
  assert.equal(mod.beltAt(-13000, 0), 0, 'flexural margin side unchanged');
});
test('layer toggling: bodies and faults of a layer switched off leave the map', () => {
  const ex = G.examples.canyon, M = JSON.parse(JSON.stringify(G.normModel(ex.M)));
  const lid = M.bodies.find(b => b.layer).layer, on = G.build(M, []), off = G.build(Object.assign({}, M, { layers: M.layers.map(l => l.id === lid ? Object.assign({}, l, { on: false }) : l) }), []);
  assert.notEqual(G.nodeGrid(on, M.ext, 400).codes.join(), G.nodeGrid(off, M.ext, 400).codes.join());
  const ri = G.examples.rift, Mr = JSON.parse(JSON.stringify(G.normModel(ri.M))), fl = Mr.faults.find(f => f.layer).layer;
  const a1 = G.build(Mr, []), a0 = G.build(Object.assign({}, Mr, { layers: Mr.layers.map(l => l.id === fl ? Object.assign({}, l, { on: false }) : l) }), []);
  assert.notEqual(G.nodeGrid(a1, Mr.ext, 400).codes.join(), G.nodeGrid(a0, Mr.ext, 400).codes.join());
});
test('key line import: CSV x,y, IRAP lines (999 separators) and GeoJSON LineString; export -> import round trip', () => {
  const a = G.parseLines(`x,y
0,0
100,50
200,40
`);
  assert.equal(a.lines.length, 1); assert.deepEqual(arr(a.lines[0]).map(arr), [[0, 0], [100, 50], [200, 40]]);
  const b = G.parseLines(`0 0 1
10 0 1
20 5 1
999 999 999
0 9 2
10 9 2
999.000000 999.000000 999.000000
`);
  assert.equal(b.lines.length, 2); assert.deepEqual(arr(b.lines[1][1]), [10, 9]);
  const L = G.lineFeatures(G.examples.coast.M), c = G.parseLines(G.geojsonLines(L)), d = G.parseLines(G.irapPolylines(L));
  assert.equal(c.lines.length, L.length); assert.equal(d.lines.length, L.length);
  near(c.lines[0][5][0], L[0].pts[5][0], 1e-3); near(d.lines[1][3][1], L[1].pts[3][1], 1e-3);
  assert.ok(G.parseLines('hello').errors.length);
});
test('key lines and faults export: IRAP lines and GeoJSON LineString', () => {
  const ex = G.examples.coast, L = G.lineFeatures(ex.M);
  assert.ok(L.length >= 2 && L.every(l => l.pts.length >= 10));
  const ir = G.irapPolylines(L).trim().split('\n'); assert.equal(ir.filter(s => s === '999.000000 999.000000 999.000000').length, L.length);
  const gj = JSON.parse(G.geojsonLines(L)); assert.equal(gj.features[0].geometry.type, 'LineString'); assert.ok(gj.features[0].properties.name);
});
test('propose a sketch: lines and sources from the wells honour them (delta, shelf, fan)', () => {
  for (const [key, W] of [['delta', [{ name: 'a', x: 5000, y: 25000, env: 'Delta plain' }, { name: 'b', x: 9000, y: 17000, env: 'Delta front' }, { name: 'c', x: 12000, y: 9000, env: 'Prodelta' }, { name: 'd', x: 30000, y: 8000, env: 'Shelf' }]],
    ['shelf', [{ name: 'a', x: 4000, y: 20000, env: 'coastal plain' }, { name: 'b', x: 15000, y: 15000, env: 'shoreface' }, { name: 'c', x: 25000, y: 10000, env: 'offshore shelf' }]],
    ['fan', [{ name: 'a', x: 20000, y: 25000, env: 'channel-levee' }, { name: 'b', x: 18000, y: 15000, env: 'proximal lobes' }, { name: 'c', x: 22000, y: 6000, env: 'lobe fringe' }]]]) {
    const M = G.makeModel(key, { ext: { xmin: 0, xmax: 40000, ymin: 0, ymax: 32000 }, noise: { amp: 600, wl: 6000, seed: 3 }, warp: { on: false, R: 2000 }, az: 135 });
    const s = G.proposeSketch(M, W); Object.assign(M, s, { geom: 'lines' });
    assert.ok(M.lines.length >= 1 && M.lines.every(l => l.pts.length >= 8), key);
    const mod = G.build(M, W); assert.ok(mod.check.every(c => c.honoured), key + ' ' + JSON.stringify(mod.check.map(c => [c.name, c.b, c.belt])));
  }
});
for (const k of ['coast', 'rimmed', 'canyon', 'rift']) test(`v2 example ${k}: uses key lines, every well honoured without warping`, () => {
  const ex = G.examples[k]; assert.ok(ex, 'missing ' + k); const M = ex.M;
  assert.equal(M.geom, 'lines'); assert.ok(M.lines.length >= 1);
  const mod = G.build(M, ex.wells); for (const c of mod.check) assert.ok(c.honoured, `${c.name}: ${c.env} -> ${G.allBelts(M)[c.belt].name}`);
  assert.deepEqual(arr(mod.warp.wells), []);
  if (k === 'coast') { assert.equal(ex.wells.length, 6); assert.equal(M.feeders.length, 2); assert.ok(Math.abs(M.feeders[0].delta.asym - M.feeders[1].delta.asym) >= .4, 'different polarity'); }
  if (k === 'rimmed') { assert.equal(ex.wells.length, 4); assert.equal(M.bodies.filter(b => b.type === 'pinnacle').length, 3); assert.ok(ex.wells.some(w => /reef core/i.test(w.env))); }
  if (k === 'canyon') { assert.equal(ex.wells.length, 3); assert.ok(M.layers.some(l => l.role === 'lith' && l.trend.on && l.trend.w > 0)); assert.ok(M.bodies.some(b => b.layer) && M.bodies.some(b => b.shape === 'ribbon')); }
  if (k === 'rift') { assert.ok(M.faults.length >= 2 && M.faults.some(f => f.layer)); assert.ok(M.sources.some(s => s.kind === 'fault')); assert.ok(M.faults.some(f => f.off > 0)); }
  const g = G.nodeGrid(mod, M.ext, 600), used = new Set(arr(g.codes)); assert.ok(used.size >= 5, 'classes ' + [...used]);
  assert.equal(G.scaleHint(M), null);
});


// =====================================================================================
// ---------- margin profile: domains, one system per domain, presets, transitions, linked feeders ----------
const DOMS = ['cont', 'coast', 'shelf', 'slope', 'deep'];
// straight margin: mountain front y = 36 km, shoreline 20 km, shelf edge 0, toe of slope -8 km; basin to the south (lines drawn eastward)
const marginModel = (preset = 'passive', o = {}) => {
  const sp = G.marginSpec(G.MARGINS[preset].doms), Y = { mf: 36000, sh: 20000, se: 0, toe: -8000 };
  const lines = sp.lines.map(([name, k, role]) => ({ name, k, pts: [[-60000, Y[role]], [60000, Y[role]]] }));
  return G.makeMargin(preset, Object.assign({ ext: { xmin: -30000, xmax: 30000, ymin: -30000, ymax: 40000 }, noise: { amp: 0, wl: 5000, seed: 1 }, warp: { on: false, R: 2000 }, lines }, o));
};
const nameAt = (mod, x, y) => G.allBelts(mod.M)[mod.beltAt(x, y)].name;
test('margin: domains along the profile from the key lines (continental, coastal, shelf, slope, deep; a domain without its line is omitted)', () => {
  const M = marginModel(), mod = G.build(M, []);
  assert.equal(G.domainAt(mod, 0, 30000), 'cont'); assert.equal(G.domainAt(mod, 0, 24000), 'cont');
  assert.equal(G.domainAt(mod, 0, 19000), 'coast'); assert.equal(G.domainAt(mod, 0, 5000), 'shelf');
  assert.equal(G.domainAt(mod, 0, -4000), 'slope'); assert.equal(G.domainAt(mod, 0, -15000), 'deep');
  assert.equal(G.domainAt(mod, 0, 38000), 'cont', 'hinterland beyond the mountain front');
  const sp = G.marginSpec(G.MARGINS.passive.doms);
  assert.deepEqual(sp.lines.map(l => l[2]), ['mf', 'sh', 'se', 'toe']);
  // rift lake: no slope domain, so no toe-of-slope line; the slope break separates littoral (shelf) and profundal (deep)
  const r = G.marginSpec(G.MARGINS.rift.doms);
  assert.ok(!r.belts.some(b => b.dom === 'slope')); assert.ok(!r.lines.some(l => l[2] === 'toe'));
  const Mr = marginModel('rift'), mr = G.build(Mr, []);
  assert.equal(G.domainAt(mr, 0, 10000), 'shelf'); assert.equal(G.domainAt(mr, 0, -2000), 'deep');
});
test('margin: one system per domain, each domain uses its system’s belts; selects filtered by domain', () => {
  for (const d of DOMS) { const keys = G.domSystems(d); assert.ok(keys.length >= 2, d); for (const k of keys) assert.equal(G.DOMSYS[d][k].dom, d); }
  const M = marginModel(), sp = G.marginSpec(G.MARGINS.passive.doms);
  for (const d of DOMS) {
    const want = G.DOMSYS[d][G.MARGINS.passive.doms[d]].belts.map(b => b[0]);
    assert.deepEqual(M.belts.filter(b => b.dom === d).map(b => b.name), want, d);
  }
  // domains in profile order, belts of a domain contiguous
  const order = M.belts.map(b => DOMS.indexOf(b.dom)); for (let i = 1; i < order.length; i++) assert.ok(order[i] >= order[i - 1]);
  // another continental system: only the continental belts change
  const doms = Object.assign({}, G.MARGINS.passive.doms, { cont: 'aeolian' }), s2 = G.marginSpec(doms);
  assert.deepEqual(s2.belts.filter(b => b.dom === 'cont').map(b => b.name), G.DOMSYS.cont.aeolian.belts.map(b => b[0]));
  assert.deepEqual(s2.belts.filter(b => b.dom !== 'cont').map(b => b.name), sp.belts.filter(b => b.dom !== 'cont').map(b => b.name));
  // the map: a point in each domain is drawn with a belt of that domain's system
  const mod = G.build(M, []);
  for (const [y, d] of [[30000, 'cont'], [17000, 'coast'], [5000, 'shelf'], [-4000, 'slope'], [-15000, 'deep']]) {
    const c = G.allBelts(M)[mod.beltAt(25000, y)]; assert.equal(c.dom, d, `${y}: ${c.name}`);
  }
});
test('margin presets fill all domains (siliciclastic passive, carbonate rimmed, mixed, rift lake, arid) and build', () => {
  for (const k of ['passive', 'carbonate', 'mixed', 'rift', 'arid']) {
    const P = G.MARGINS[k]; assert.ok(P && P.name, k);
    for (const d of DOMS) { assert.ok(d in P.doms, k + ' ' + d); if (P.doms[d]) assert.ok(G.DOMSYS[d][P.doms[d]], k + ' ' + d + ' ' + P.doms[d]); }
    if (k !== 'rift') for (const d of DOMS) assert.ok(P.doms[d], k + ' fills ' + d);
    const M = marginModel(k); assert.equal(M.template, 'margin'); assert.equal(M.margin.preset, k);
    const doms = new Set(M.belts.map(b => b.dom)); for (const d of DOMS) assert.equal(doms.has(d), !!P.doms[d], k + ' ' + d);
    const mod = G.build(M, []), g = G.nodeGrid(mod, M.ext, 1000), used = new Set(arr(g.codes).map(c => G.allBelts(M)[c - 1].dom));
    for (const d of DOMS) if (P.doms[d]) assert.ok(used.has(d), `${k}: domain ${d} on the map`);
  }
  assert.equal(G.MARGINS.carbonate.doms.shelf, 'rimmed'); assert.equal(G.MARGINS.passive.doms.cont, 'fluvial');
});
test('margin transitions: mixed zones on by default at the domain boundaries, the map grades across them', () => {
  const M = marginModel(), sp = G.marginSpec(G.MARGINS.passive.doms), B = M.belts;
  const bnd = []; for (let k = 0; k < B.length - 1; k++) if (B[k].dom !== B[k + 1].dom) bnd.push(k);
  const mk = M.mix.map(m => m.k);
  for (const k of bnd) if (!(B[k].dom === 'slope' && sp.inf != null)) assert.ok(mk.includes(k), 'mixed zone at ' + B[k].name + ' | ' + B[k + 1].name);
  assert.ok(M.mix.every(m => m.w > 0));
  const mod = G.build(M, []);
  assert.equal(nameAt(mod, 0, 0), B[mk.find(k => B[k].dom === 'shelf')].name + ' + ' + B[mk.find(k => B[k].dom === 'shelf') + 1].name, 'hatched transition on the shelf edge');
  const sharp = G.build(Object.assign({}, M, { mix: [] }), []); assert.ok(!/\+/.test(nameAt(sharp, 0, 0)));
  // the interdeltaic coast grades too: transition of the along-strike variants
  const cls = new Set(); for (let y = 14000; y < 26000; y += 100) cls.add(nameAt(mod, 25000, y));
  assert.ok([...cls].some(n => /\+/.test(n)), [...cls].join(', '));
});
const feeder = (o = {}) => Object.assign({ line: 1, x: 0, y: 20000, az: 180, river: { on: true, w: 1500, sin: 1.25 }, delta: { on: true, L: 6000, open: 55, asym: 0 }, canyon: { on: false, w: 900 }, fan: { on: false, L: 14000, open: 50, asym: 0 } }, o);
test('feeder: a river valley landward of the delta apex, the delta plain spreads seaward from the apex (no delta plain landward of it)', () => {
  const M = marginModel('passive', { feeders: [feeder()] }), mod = G.build(M, []), apexY = 20000 + .6 * 6000;
  const valley = G.allBelts(M).find(c => c.kind === 'valley'); assert.ok(valley && valley.dom === 'cont', 'valley class');
  let onV = 0; for (let x = -8000; x <= 8000; x += 100) if (nameAt(mod, x, 26000) === valley.name) onV++;
  assert.ok(onV >= 8, 'the valley crosses the floodplain (y = 26 km) near the feeder axis ' + onV);
  assert.equal(nameAt(mod, 22000, 26000), 'Floodplain–coastal plain'); assert.equal(G.domainAt(mod, 22000, 26000), 'cont');
  for (let y = apexY + 300; y < 34000; y += 400) for (let x = -7000; x <= 7000; x += 500) assert.notEqual(nameAt(mod, x, y), 'Delta plain', `delta plain landward of the apex at ${x}, ${y}`);
  assert.equal(nameAt(mod, 0, 17000), 'Delta plain', 'delta plain seaward of the apex');
  const seq = []; for (let y = 19800; y > 2000; y -= 200) { const n = nameAt(mod, 0, y); if (seq[seq.length - 1] !== n) seq.push(n); }
  const core = seq.filter(n => !/\+/.test(n));
  assert.deepEqual(core.slice(0, 3), ['Delta plain', 'Delta front', 'Prodelta'], seq.join(' > '));
  assert.ok(!seq.some(n => G.allBelts(M).find(c => c.name === n).dom === 'cont'), 'no continental belt seaward of the shoreline on the axis');
  // the delta plain fans out: wider at the shoreline than near the apex
  const width = y => { let c = 0; for (let x = -9000; x <= 9000; x += 100) if (nameAt(mod, x, y) === 'Delta plain') c++; return c; };
  assert.ok(width(17000) > width(22500) + 10, `fan: ${width(22500)} near the apex, ${width(17000)} seaward`);
  const M0 = marginModel('passive', { feeders: [feeder({ river: { on: false, w: 1500, sin: 1.25 } })] }), g0 = G.nodeGrid(G.build(M0, []), M0.ext, 500);
  assert.ok(!arr(g0.codes).some(c => G.allBelts(M0)[c - 1].kind === 'valley'), 'no valley without the river');
});
test('feeder: canyon at the shelf edge in line with the delta, basin-floor fan at the toe of slope at the canyon mouth', () => {
  const f = feeder({ canyon: { on: true, w: 900 }, fan: { on: true, L: 14000, open: 50, asym: 0 } }), M = marginModel('passive', { feeders: [f] }), FG = G.feederGeom(M);
  assert.equal(FG.canyons.length, 1); const C = FG.canyons[0].pts, h = C[0], e = C[C.length - 1];
  assert.ok(Math.abs(h[0]) < 300 && h[1] > 0 && h[1] < 6000, 'canyon head on the axis, cut into the outer shelf ' + h);
  assert.ok(Math.abs(e[1] + 8000) < 400 && Math.abs(e[0]) < 1500, 'canyon mouth at the toe of slope ' + e);
  const fan = FG.sources.find(s => s.kind === 'fan'); assert.ok(fan, 'fan source');
  assert.ok(Math.abs(fan.x - e[0]) < 400 && Math.abs(fan.y - e[1]) < 400 && Math.abs(((fan.az - 180) + 540) % 360 - 180) < 15, JSON.stringify(fan));
  assert.equal(M.lines[fan.line].name, 'Toe of slope');
  const mod = G.build(M, []), cn = G.allBelts(M).find(c => c.kind === 'canyon').name;
  assert.equal(nameAt(mod, 0, -4000), cn); assert.notEqual(nameAt(mod, 10000, -4000), cn); assert.equal(G.domainAt(mod, 10000, -4000), 'slope');
  assert.equal(G.allBelts(M)[mod.beltAt(0, -12000)].dom, 'deep'); assert.notEqual(nameAt(mod, 0, -12000), 'Basin plain', 'fan in front of the canyon');
  assert.equal(nameAt(mod, 22000, -15000), 'Basin plain', 'basin plain beside the fan');
  // an oblique feeder: the canyon head stays on the feeder axis
  const a = 200 * Math.PI / 180, f2 = feeder({ az: 200, canyon: { on: true, w: 900 }, fan: { on: true, L: 14000, open: 50, asym: 0 } }), C2 = G.feederGeom(marginModel('passive', { feeders: [f2] })).canyons[0].pts[0];
  const off = Math.abs((C2[0] - 0) * Math.cos(a) - (C2[1] - 20000) * Math.sin(a)); assert.ok(off < 400, 'head on the oblique axis ' + off);
});
test('fan deltas along a border fault: lobes elongated along the fault and coalescing (bajada), not concentric targets', () => {
  const base = { geom: 'lines', ext: { xmin: -15000, xmax: 15000, ymin: -15000, ymax: 15000 }, noise: { amp: 0, wl: 3000, seed: 1 }, warp: { on: false, R: 1000 }, span: 16000,
    lines: [{ name: 'Lake margin', k: 0, pts: [[-12000, -20000], [-12000, 20000]] }], faults: [{ pts: [[12000, -14000], [12000, 14000]], side: -1, off: 0, taper: 3000 }] };
  const one = G.build(G.makeModel('lake', Object.assign({}, base, { sources: [{ kind: 'fault', fault: 0, x: 12000, y: 0, az: 270, L: 3000, open: 70, asym: 0 }] })), []);
  let along = 0, across = 0; for (let y = 0; y < 14000; y += 50) if (one.beltAt(11900, y) === 0) along = y;
  for (let x = 12000; x > 0; x -= 50) if (one.beltAt(x, 0) === 0) across = 12000 - x;
  assert.ok(along > 1.8 * across, `elongated along the fault: ${along} along vs ${across} across`);
  const two = G.build(G.makeModel('lake', Object.assign({}, base, { sources: [-3500, 3500].map(y => ({ kind: 'fault', fault: 0, x: 12000, y, az: 270, L: 3000, open: 70, asym: 0 })) })), []);
  for (let y = -3500; y <= 3500; y += 250) assert.equal(two.beltAt(11500, y), 0, 'coalesced fan-delta apron along the fault at ' + y);
});
test('legend grouped by domain: every class once, domains in profile order', () => {
  const M = marginModel('passive', { feeders: [feeder({ canyon: { on: true, w: 900 }, fan: { on: true, L: 14000, open: 50, asym: 0 } })] });
  const Gr = G.legendGroups(M), AB = G.allBelts(M);
  assert.deepEqual(Gr.map(g => g.dom), DOMS); assert.ok(Gr.every(g => g.name));
  const all = Gr.flatMap(g => g.items); assert.deepEqual([...all].sort((a, b) => a - b), AB.map((c, i) => i));
  for (const g of Gr) for (const i of g.items) if (AB[i].kind === 'belt' || AB[i].kind === 'variant') assert.equal(AB[i].dom, g.dom, AB[i].name);
  const v2 = G.legendGroups(G.examples.canyon.M); assert.equal(v2.length, 1); assert.equal(v2[0].items.length, G.allBelts(G.examples.canyon.M).length);
});
test('margin model file: save -> open identical (margin, belts with domains, feeders); v2 files without them still open', () => {
  const M = marginModel('passive', { feeders: [feeder({ canyon: { on: true, w: 900 }, fan: { on: true, L: 14000, open: 50, asym: .2 } })] });
  const W = [{ name: 'A', x: 0, y: 17000, env: 'delta plain' }], txt = G.saveModel(M, W), r = G.openModel(txt);
  assert.deepEqual(arr(r.errors), []); assert.equal(r.M.template, 'margin'); assert.equal(r.M.margin.preset, 'passive');
  assert.deepEqual(r.M.belts.map(b => b.dom), M.belts.map(b => b.dom)); assert.equal(r.M.feeders.length, 1);
  assert.equal(G.saveModel(r.M, r.wells), txt, 'byte-identical second round trip');
  const a = G.build(M, W), b = G.build(r.M, r.wells); for (const [x, y] of [[0, 17000], [0, -4000], [5000, -12000], [-20000, 30000]]) assert.equal(a.beltAt(x, y), b.beltAt(x, y));
  const v2 = G.openModel(G.saveModel(G.examples.canyon.M, G.examples.canyon.wells)); assert.deepEqual(arr(v2.errors), []); assert.equal(v2.M.template, 'fansand'); assert.ok(!v2.M.margin);
});
for (const k of ['margin', 'carbmargin', 'rift']) test(`margin example ${k}: every well honoured without warping, one map from hinterland to basin`, () => {
  const ex = G.examples[k]; assert.ok(ex, 'missing ' + k); const M = ex.M;
  const mod = G.build(M, ex.wells); for (const c of mod.check) assert.ok(c.honoured, `${c.name}: ${c.env} -> ${G.allBelts(M)[c.belt].name}`);
  assert.deepEqual(arr(mod.warp.wells), []);
  const g = G.nodeGrid(mod, M.ext, 800), doms = new Set(arr(g.codes).map(c => G.allBelts(M)[c - 1].dom));
  if (k === 'margin') {
    assert.equal(M.template, 'margin'); assert.equal(ex.wells.length, 6); for (const d of DOMS) assert.ok(doms.has(d), 'domain ' + d);
    assert.equal(M.feeders.length, 2); assert.ok(Math.abs(M.feeders[0].delta.asym - M.feeders[1].delta.asym) >= .4, 'two deltas of different polarity');
    assert.ok(M.feeders.every(f => f.river.on)); assert.equal(M.feeders.filter(f => f.canyon.on && f.fan.on).length, 1, 'one canyon and fan, in line with the larger delta');
    const big = M.feeders.reduce((a, b) => b.delta.L > a.delta.L ? b : a); assert.ok(big.canyon.on);
    assert.ok(M.bodies.some(b => b.type === 'mtc'), 'MTC apron on the slope');
    const wd = new Set(ex.wells.map(w => G.allBelts(M)[mod.check.find(c => c.name === w.name).belt].dom)); assert.ok(wd.size >= 5, 'wells across the domains ' + [...wd]);
    assert.equal(G.examples.coast, ex, 'the old #coast link opens the passive margin');
  }
  if (k === 'carbmargin') { assert.equal(M.margin.preset, 'carbonate'); assert.equal(M.bodies.filter(b => b.type === 'pinnacle').length, 3); assert.ok(doms.has('cont')); assert.equal(G.examples.rimmed, ex, 'the old #rimmed link opens the carbonate margin'); }
  if (k === 'rift') { assert.ok(M.sources.filter(s => s.kind === 'fault').length >= 3); }
});

// ---------- atlas style: smoothing, EOD and facies maps, facies objects, examples ----------
const inRing = (r, x, y) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[j], b = r[i]; if ((a[1] > y) !== (b[1] > y) && x < a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) c = !c; } return c; };
const inPoly = (p, x, y) => inRing(p.outer, x, y) && !p.holes.some(h => inRing(h, x, y));
const extA = e => (e.xmax - e.xmin) * (e.ymax - e.ymin);
// right-angle turns (pixel stair steps; junctions where three classes meet keep theirs)
const rightTurns = P => { let t = 0; for (const p of P) for (const r of [p.outer, ...p.holes]) for (let i = 0; i < r.length; i++) { const a = r[(i + r.length - 1) % r.length], b = r[i], c = r[(i + 1) % r.length]; const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]]; if (Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])) > 1.2) t++; } return t; };
const tilingErrors = (P, e, N = 3000) => { const R = rng(5); let bad = 0; for (let i = 0; i < N; i++) { const x = e.xmin + R() * (e.xmax - e.xmin), y = e.ymin + R() * (e.ymax - e.ymin); if (P.filter(p => inPoly(p, x, y)).length !== 1) bad++; } return bad / N; };
test('smoothing: rings closed, polygons tile the extent (no gap, no overlap), areas within 2 %, no pixel stair steps', () => {
  const ex = G.examples.margin, mod = G.build(ex.M, ex.wells), e = ex.M.ext, cell = 600;
  const raw = G.polygons(mod, e, cell, { smooth: 0 }), sm = G.polygons(mod, e, cell);
  near(sm.reduce((s, p) => s + p.area, 0), extA(e), extA(e) * 1e-9, 'tiling: areas add up to the extent');
  const byCode = P => { const m = new Map(); for (const p of P) m.set(p.code, (m.get(p.code) || 0) + p.area); return m; };
  const a0 = byCode(raw), a1 = byCode(sm);
  for (const [c, a] of a0) if (a > .01 * extA(e)) assert.ok(Math.abs(a1.get(c) - a) / a < .02, `class ${c}: ${a} -> ${a1.get(c)}`);
  for (const p of sm) for (const r of [p.outer, ...p.holes]) assert.ok(r.length >= 3 && r.every(q => isFinite(q[0]) && isFinite(q[1])), 'ring with >= 3 vertices');
  assert.ok(tilingErrors(sm, e) < .002, 'points in 0 or 2 polygons');
  const px = G.polygons(mod, e, cell, { smooth: 0, tol: 0 });
  assert.ok(rightTurns(sm) < .1 * rightTurns(px) && rightTurns(sm) < rightTurns(raw), `right-angle turns: pixels ${rightTurns(px)}, simplified ${rightTurns(raw)}, smoothed ${rightTurns(sm)}`);
});
test('irregularity defaults: large wavelength, low amplitude, little small-scale roughness', () => {
  const M = G.makeMargin('passive', { ext: { xmin: 0, xmax: 200000, ymin: 0, ymax: 150000 } }), d = Math.hypot(200000, 150000);
  assert.ok(M.noise.wl >= d / 12, 'wavelength ' + M.noise.wl); assert.ok(M.noise.amp <= .015 * d, 'amplitude ' + M.noise.amp);
  assert.ok(M.noise.rough > 0 && M.noise.rough < .5, 'roughness ' + M.noise.rough);
  assert.ok(G.makeModel('shelf').noise.rough < .5);
});
test('EOD domains: the belts of every system map to EOD domains; rename, recolour and remap by the user', () => {
  const keys = new Set(G.EOD.map(d => d.key));
  for (const k of ['basement', 'fluvdelta', 'clastshelf', 'carbshelf', 'isslope', 'slope', 'deep', 'abyssal']) assert.ok(keys.has(k), 'EOD domain ' + k);
  for (const d of G.EOD) assert.ok(d.name && /^#[0-9a-f]{6}$/i.test(d.color), d.key);
  const lined = M => Object.assign({}, M, { geom: 'lines', lines: [{ k: -1, pts: [[0, 0], [1, 1]] }, { k: 0, pts: [[0, 1], [1, 2]] }] });
  const eodOf = (M, nm) => { const AB = G.allBelts(lined(M)), i = AB.findIndex(c => c.name === nm); assert.ok(i >= 0, 'class ' + nm); return G.EOD[G.eodMap(lined(M))[i]].key; };
  const P = G.makeMargin('passive');
  const exp = { 'Alluvial fan': 'fluvdelta', 'Floodplain–coastal plain': 'fluvdelta', 'Delta plain': 'fluvdelta', 'Delta front': 'fluvdelta', 'Interdeltaic shoreface': 'fluvdelta',
    'Prodelta': 'clastshelf', 'Inner shelf': 'clastshelf', 'Outer shelf': 'clastshelf', 'Upper slope (bypass, gullies)': 'slope', 'Lower slope': 'slope', 'Proximal lobes': 'deep', 'Basin plain': 'deep',
    'Hinterland (erosion, bypass)': 'basement' };
  for (const [nm, k] of Object.entries(exp)) assert.equal(eodOf(P, nm), k, nm);
  const C = G.makeMargin('carbonate');
  for (const [nm, k] of Object.entries({ 'Platform interior / lagoon': 'carbshelf', 'Platform margin (reef / shoal)': 'carbshelf', 'Fore-reef slope': 'slope', 'Basin': 'deep', 'Intertidal flat': 'carbshelf' })) assert.equal(eodOf(C, nm), k, nm);
  assert.equal(eodOf(G.makeMargin('rift'), 'Profundal'), 'lake');
  assert.equal(eodOf(G.makeMargin('arid'), 'Dune field (erg)'), 'arid');
  // every class of every template and margin system has a domain
  for (const [k, t] of Object.entries(G.templates)) { const M = G.makeModel(k); const m = G.eodMap(M); assert.equal(m.length, G.allBelts(M).length); assert.ok(m.every(i => i >= 0 && i < G.EOD.length), k); }
  // the user renames / recolours a domain and remaps a belt
  const U = G.makeMargin('passive'); U.eod = { doms: { slope: { name: 'Continental slope', color: '#aabbcc' } }, map: { 'Prodelta': 'fluvdelta' } };
  const cl = G.eodClasses(U); assert.equal(cl.find(c => c.key === 'slope').name, 'Continental slope'); assert.equal(cl.find(c => c.key === 'slope').color, '#aabbcc');
  assert.equal(eodOf(U, 'Prodelta'), 'fluvdelta');
});
test('EOD map: few large smoothed domains tiling the extent, consistent with the belts; abyssal basin beyond the toe of slope', () => {
  const ex = G.examples.margin, M = Object.assign({}, ex.M, { eod: { abyss: 6000 } }), mod = G.build(M, ex.wells), e = M.ext;
  const E = G.eodPolygons(mod, e, 500);
  near(E.reduce((s, p) => s + p.area, 0), extA(e), extA(e) * 1e-9, 'EOD polygons tile the extent');
  assert.ok(E.every(p => p.level === 'EOD'));
  const doms = new Set(E.map(p => p.key)); assert.ok(doms.size >= 5 && doms.size <= 8, [...doms].join());
  for (const k of ['basement', 'fluvdelta', 'clastshelf', 'slope', 'deep', 'abyssal']) assert.ok(doms.has(k), 'domain ' + k);
  // few polygons: large domains, specks merged
  assert.ok(E.length <= 3 * doms.size, E.length + ' polygons');
  assert.ok(tilingErrors(E, e) < .002);
  const at = G.eodAt(mod), R = rng(9); let agree = 0, n = 0;
  for (let i = 0; i < 1500; i++) { const x = e.xmin + R() * (e.xmax - e.xmin), y = e.ymin + R() * (e.ymax - e.ymin), p = E.find(q => inPoly(q, x, y)); if (!p) continue; n++; if (G.EOD[at(x, y)].key === p.key) agree++; }
  assert.ok(agree / n > .97, `EOD polygons agree with the classes at ${agree} of ${n} points`);
  // abyssal only well beyond the toe of slope
  const toe = M.lines.find(l => /toe/i.test(l.name)).pts;
  for (let i = 0; i < 400; i++) { const x = e.xmin + R() * (e.xmax - e.xmin), y = e.ymin + R() * (e.ymax - e.ymin), s = G.sdist(toe, x, y), k = G.EOD[at(x, y)].key;
    if (k === 'abyssal') assert.ok(s > 3000, 'abyssal near the toe ' + s); if (s > 0 && s < 2000 && k !== 'slope') assert.notEqual(k, 'abyssal'); }
});
test('EOD labels: one spot inside each large domain, far from its edges and from the wells', () => {
  const ex = G.examples.margin, mod = G.build(ex.M, ex.wells), e = ex.M.ext, E = G.eodPolygons(mod, e, 500), R = E.raster;
  const spots = G.labelSpots(R.L, R.nx, R.ny, { minCells: .03 * R.nx * R.ny, avoid: ex.wells.map(w => [(w.x - e.xmin) / R.cx, (e.ymax - w.y) / R.cy]), avoidR: 6 });
  const big = new Set(E.filter(p => p.area > .03 * extA(e)).map(p => p.code - 1));
  for (const l of big) assert.ok(spots.some(s => s.label === l), 'label for domain ' + l);
  for (const s of spots) { const x = e.xmin + s.x * R.cx, y = e.ymax - s.y * R.cy, p = E.find(q => inPoly(q, x, y)); assert.ok(p && p.code - 1 === s.label, 'spot inside its domain'); assert.ok(s.r >= 3, 'room ' + s.r);
    for (const w of ex.wells) assert.ok(Math.hypot(w.x - x, w.y - y) > 2 * R.cx, 'spot away from well ' + w.name); }
});
const segX = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
const simpleRing = r => { const n = r.length; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(r[i], r[(i + 1) % n], r[j], r[(j + 1) % n])) return false; } return true; };
const ringArea = r => Math.abs(G.sArea(r));
const axisPt = (o, f) => [o.x + f * o.L * Math.sin(o.az * Math.PI / 180), o.y + f * o.L * Math.cos(o.az * Math.PI / 180)];
test('facies objects: generated from the concept (lobes, rivers, fairway, fan), deterministic from the seed, another seed another shape', () => {
  const ex = G.examples.margin, mod = G.build(ex.M, ex.wells), F = mod.facies;
  assert.ok(Array.isArray(F) && F.length >= 6, 'objects ' + (F && F.length));
  const n = t => F.filter(o => o.type === t).length;
  assert.equal(n('lobe'), 2); assert.equal(n('river'), 2); assert.equal(n('fairway'), 1); assert.equal(n('fan'), 1);
  for (const o of F) { assert.ok(o.id && G.FTYPE[o.type], 'type ' + o.type); assert.ok(o.g && (o.g.ring || o.g.lines.length), o.id); }
  const again = G.build(ex.M, ex.wells).facies; assert.equal(JSON.stringify(again.map(o => o.g)), JSON.stringify(F.map(o => o.g)), 'same seed, same objects');
  const M2 = Object.assign({}, ex.M, { facies: Object.assign({}, ex.M.facies, { seed: 77 }) }), F2 = G.build(M2, ex.wells).facies;
  const l1 = F.find(o => o.type === 'lobe'), l2 = F2.find(o => o.id === l1.id); assert.ok(l2, 'same ids'); assert.notEqual(JSON.stringify(l1.g.ring), JSON.stringify(l2.g.ring), 'another seed, another lobe');
  // a lobe covers each delta mouth
  for (const f of ex.M.feeders) assert.ok(F.filter(o => o.type === 'lobe').some(o => inRing(o.g.ring, f.x + 1000 * Math.sin(f.az * Math.PI / 180), f.y + 1000 * Math.cos(f.az * Math.PI / 180))), 'a lobe at the delta ' + f.x);
});
test('facies geometry: lobes, fans, platforms, MTCs and ponded areas closed and simple; lobes with distributaries; fairways of n braided channels; river networks with tributaries', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const shapes = [{ type: 'lobe', x: 0, y: 0, az: 180, L: 30000, open: 70, seed }, { type: 'fan', x: 0, y: 0, az: 20, L: 20000, open: 60, seed }, { type: 'platform', x: 0, y: 0, a: 8000, e: .6, rot: 30, seed },
      { type: 'mtc', x: 0, y: 0, az: 300, L: 15000, w: 7000, seed }, { type: 'ponded', x: 0, y: 0, a: 5000, e: .7, rot: 0, seed }];
    for (const o of shapes) { const g = G.faciesShape(o); assert.ok(g.ring && g.ring.length >= 12, o.type); assert.ok(simpleRing(g.ring), o.type + ' self-intersects, seed ' + seed); assert.ok(ringArea(g.ring) > 0);
      const c = o.L ? axisPt(o, .4) : [o.x, o.y]; assert.ok(inRing(g.ring, c[0], c[1]), o.type + ' contains its axis'); }
    const lobe = G.faciesShape(shapes[0]); assert.ok(lobe.lines.length >= 3, 'distributaries'); for (const l of lobe.lines) assert.ok(l.pts.every(p => inRing(lobe.ring, p[0], p[1]) || Math.hypot(p[0], p[1]) < 2000), 'distributaries inside the lobe');
    const path = []; for (let i = 0; i <= 40; i++) path.push([i * 1000, -i * 300 + 2000 * Math.sin(i / 6)]);
    const fw = G.faciesShape({ type: 'fairway', path, n: 6, w: 500, W: 9000, cl: 6000, seed });
    assert.ok(simpleRing(fw.ring), 'fairway envelope simple, seed ' + seed); const ch = fw.lines.filter(l => l.kind === 'channel'); assert.equal(ch.length, 6, 'n channels');
    let crossings = 0; for (let a = 0; a < ch.length; a++) for (let b = a + 1; b < ch.length; b++) for (let i = 0; i + 1 < ch[a].pts.length; i++) for (let j = 0; j + 1 < ch[b].pts.length; j++) if (segX(ch[a].pts[i], ch[a].pts[i + 1], ch[b].pts[j], ch[b].pts[j + 1])) crossings++;
    assert.ok(crossings >= 3, 'braided: channels cross ' + crossings);
    for (const l of ch) for (const p of l.pts) assert.ok(inRing(fw.ring, p[0], p[1]) || Math.hypot(p[0] - path[0][0], p[1] - path[0][1]) < 7000, 'channels inside the fairway');
    const rv = G.faciesShape({ type: 'river', path: path.map(p => [-p[0], p[1]]), w: 800, seed }); assert.ok(!rv.ring); assert.ok(rv.lines.filter(l => l.kind === 'tributary').length >= 3, 'tributaries');
  }
});
test('facies objects editable: move, delete, regenerate one object; extra objects added by hand', () => {
  const ex = G.examples.margin, F0 = G.build(ex.M, ex.wells).facies, lobe = F0.find(o => o.type === 'lobe'), fan = F0.find(o => o.type === 'fan');
  const M = JSON.parse(JSON.stringify(ex.M)); M.facies.edits = { [lobe.id]: { dx: 3000, dy: -1000 }, [fan.id]: { del: true } };
  M.facies.extra = [{ type: 'platform', x: 20000, y: 40000, a: 3000, e: .6, rot: 0, seed: 3 }];
  const F1 = G.build(M, ex.wells).facies, l1 = F1.find(o => o.id === lobe.id);
  near(l1.x, lobe.x + 3000, 1e-6); near(l1.y, lobe.y - 1000, 1e-6); near(l1.g.ring[5][0], lobe.g.ring[5][0] + 3000, 1e-6);
  assert.ok(!F1.some(o => o.id === fan.id), 'deleted'); assert.ok(F1.some(o => o.type === 'platform' && o.extra), 'extra object');
  M.facies.edits = { [lobe.id]: { seed: 99 } }; const l2 = G.build(M, ex.wells).facies.find(o => o.id === lobe.id);
  assert.notEqual(JSON.stringify(l2.g.ring), JSON.stringify(lobe.g.ring), 'regenerated'); near(l2.x, lobe.x, 1e-6);
  const n = G.normModel(M); assert.deepEqual(n.facies.edits, M.facies.edits); assert.equal(n.facies.extra.length, 1);
  const r = G.openModel(G.saveModel(M, ex.wells)); assert.deepEqual(r.M.facies, n.facies, 'facies in the model file');
  const A = G.examples.atlas.M, ra = G.openModel(G.saveModel(A, G.examples.atlas.wells)); assert.deepEqual(ra.M.eod, G.normModel(A).eod, 'EOD settings in the model file'); assert.equal(ra.M.eod.title, A.eod.title); assert.equal(ra.M.eod.abyss, A.eod.abyss);
});
test('facies wells: a well described as a facies object ends inside one (moved, enlarged or created); a regional well inside a foreign object shrinks it', () => {
  const ex = G.examples.margin, F0 = G.build(ex.M, ex.wells).facies, fan = F0.find(o => o.type === 'fan'), lobe = F0.find(o => o.type === 'lobe');
  assert.equal(G.ftypeOf('Basin-floor fan'), 'fan'); assert.equal(G.ftypeOf('carbonate platforms'), 'platform'); assert.equal(G.ftypeOf('MTC'), 'mtc'); assert.equal(G.ftypeOf('Turbidite fairway'), 'fairway'); assert.equal(G.ftypeOf('Shelf'), null);
  // a fan well just beyond the fan, a platform well with no platform yet, a turbidite well off the fairway
  const fw = F0.find(o => o.type === 'fairway'), mid = fw.path[Math.floor(fw.path.length / 2)], fp = axisPt(fan, 1.15);
  const W = ex.wells.concat([{ name: 'F-1', x: fp[0], y: fp[1], env: 'Basin-floor fan' }, { name: 'P-1', x: 20000, y: 36000, env: 'Carbonate platform' }, { name: 'T-1', x: mid[0] + 4000, y: mid[1], env: 'Turbidite fairway' }]);
  const M = JSON.parse(JSON.stringify(ex.M)); M.facies.n = Object.assign({}, M.facies.n, { platform: 0 });
  const mod = G.build(M, W);
  for (const nm of ['F-1', 'P-1', 'T-1']) { const c = mod.check.find(q => q.name === nm); assert.ok(c.ft, nm + ' facies well'); assert.ok(c.honoured, nm + ' honoured'); }
  assert.ok(mod.facies.some(o => o.type === 'platform' && G.inFacies(o, 20000, 36000)));
  // a regional well (basin plain) inside a lobe: the lobe is shrunk until the well is outside
  const tip = axisPt(lobe, .75);
  assert.ok(G.inFacies(lobe, tip[0], tip[1]), 'the test point is inside the lobe');
  const m2 = G.build(ex.M, ex.wells.concat([{ name: 'S-1', x: tip[0], y: tip[1], env: 'Basin plain' }]));
  assert.ok(!G.inFacies(m2.facies.find(o => o.id === lobe.id), tip[0], tip[1]), 'the lobe no longer covers the deep-water well');
});
test('facies export: GeoJSON with EOD and facies levels (polygons and centrelines), IRAP lines with both', () => {
  const ex = G.examples.margin, mod = G.build(ex.M, ex.wells), E = G.eodPolygons(mod, ex.M.ext, 800), F = G.faciesFeatures(mod);
  assert.ok(F.polys.length >= 4 && F.lines.length >= 3);
  const g = JSON.parse(G.geojsonLevels(E, F)), lv = new Set(g.features.map(f => f.properties.level));
  assert.deepEqual([...lv].sort(), ['EOD', 'facies']);
  assert.ok(g.features.some(f => f.properties.level === 'facies' && f.geometry.type === 'Polygon' && f.properties.type === 'lobe'));
  assert.ok(g.features.some(f => f.properties.level === 'facies' && f.geometry.type === 'LineString' && f.properties.type === 'fairway'));
  for (const f of g.features) if (f.geometry.type === 'Polygon') { const r = f.geometry.coordinates[0]; assert.deepEqual(r[0], r[r.length - 1]); }
  const ir = G.irapLevels(E, F).trim().split('\n'); assert.equal(ir.filter(l => l.startsWith('999')).length, E.reduce((s, p) => s + 1 + p.holes.length, 0) + F.polys.length + F.lines.length);
  assert.ok(ir.some(l => / 1(0[1-9]|1[0-9])\.000000$/.test(l)), 'facies polygon codes 101+');
});
test('examples select: every example listed once and named, grouped by type, buttons replaced; each example loads with all its wells honoured', () => {
  const keys = Object.keys(G.examples), listed = G.EXGROUPS.flatMap(g => g[1]);
  assert.deepEqual([...listed].sort(), [...keys].sort(), 'the select lists every example'); assert.equal(new Set(listed).size, listed.length, 'once');
  for (const k of listed) assert.ok(G.EXNAMES[k], 'name ' + k);
  assert.deepEqual(G.EXGROUPS[0][1], ['atlas', 'atlastr'], 'atlas-style margins first');
  assert.ok(/id="iEx"/.test(html) && /id="tbEx"/.test(html) && !/id="iCoast"/.test(html) && !/id="iDelta"/.test(html), 'a select replaces the example buttons');
  assert.ok(/GDE\.EXGROUPS/.test(html) && /loadExample\(k\)/.test(html), 'the select is filled from the catalogue and loads without asking');
  for (const k of ['coast', 'rimmed']) assert.ok(G.examples[k], 'old hash link #' + k);
  for (const k of listed) { const ex = G.examples[k], mod = G.build(ex.M, ex.wells); for (const c of mod.check) assert.ok(c.honoured, `${k}: ${c.name} (${c.env}) not honoured`); }
});
test('consistency: on every example the EOD domain drawn under each well is the one of its belt (thin belts are pinned), and the check flags a misplaced facies object', () => {
  for (const [k, ex] of Object.entries(G.examples)) {
    const M = JSON.parse(JSON.stringify(ex.M)), mod = G.build(M, ex.wells, { dist: true }), e = M.ext;
    const P = G.polygons(mod, e, Math.sqrt((e.xmax - e.xmin) * (e.ymax - e.ymin) / 160000), { stride: 3, minArea: 4 }), R = G.eodPolygons(mod, e, 0, { raster: P.raster }).raster, at = G.eodAt(mod);
    for (const c of mod.check) if (c.b >= 0 && !c.ft && c.honoured) assert.equal(R.L[Math.floor((e.ymax - c.y) / R.cy) * R.nx + Math.floor((c.x - e.xmin) / R.cx)], at.of(c.b, c.x, c.y), k + ' ' + c.name);
  }
  const ex = G.examples.atlas, mod = G.build(ex.M, ex.wells), C0 = G.consistency(mod);
  assert.ok(C0.objects.length && C0.objects.every(o => o.ok), 'generated objects are in their usual domains');
  const lobe = mod.facies.find(o => o.type === 'lobe'); assert.ok(lobe);
  lobe.x = (ex.M.ext.xmin + ex.M.ext.xmax) / 2; lobe.y = ex.M.ext.ymax - 1000;
  assert.ok(G.consistency(mod).objects.some(o => o.type === 'lobe' && !o.ok), 'a deltaic lobe in deep water is flagged');
});

const eodKeysOf = (mod, M, cell) => { const E = G.eodPolygons(mod, M.ext, cell), a = new Map(); for (const p of E) a.set(p.key, (a.get(p.key) || 0) + p.area); return { E, a }; };
test('atlas example 1: equatorial passive margin with a marginal plateau — eight EOD domains, slope wrapping the plateau, deltas, fairways, fans, platforms, MTCs; wells honoured', () => {
  const ex = G.examples.atlas, M = ex.M, mod = G.build(M, ex.wells), e = M.ext, A = extA(e);
  assert.equal(ex.view, 'facies'); assert.ok(ex.wells.length >= 7 && ex.wells.length <= 10, ex.wells.length + ' wells');
  for (const c of mod.check) assert.ok(c.honoured && !c.warped, `${c.name} (${c.env})`);
  assert.ok(new Set(mod.check.filter(c => c.ft).map(c => c.ft)).size >= 3, 'wells described as facies objects of 3 types or more');
  const { E, a } = eodKeysOf(mod, M, 1500);
  for (const k of ['basement', 'fluvdelta', 'clastshelf', 'isslope', 'carbshelf', 'slope', 'deep', 'abyssal']) assert.ok((a.get(k) || 0) > .004 * A, 'EOD domain ' + k);
  // the slope wraps around the plateau: its domain spans most of the map both ways; the carbonate shelf is much wider on the plateau
  const sl = E.filter(p => p.key === 'slope'), bb = sl.flatMap(p => p.outer), xs = bb.map(q => q[0]), ys = bb.map(q => q[1]);
  assert.ok(Math.max(...xs) - Math.min(...xs) > .8 * (e.xmax - e.xmin) && Math.max(...ys) - Math.min(...ys) > .45 * (e.ymax - e.ymin), 'slope wraps the plateau');
  const at = G.eodAt(mod), wid = x => { let n = 0; for (let y = e.ymin; y < e.ymax; y += 1000) if (G.EOD[at(x, y)].key === 'carbshelf') n++; return n; };
  assert.ok(wid(e.xmin + .7 * (e.xmax - e.xmin)) > 3 * wid(e.xmin + .1 * (e.xmax - e.xmin)), 'plateau: wide carbonate shelf');
  const F = mod.facies, n = t => F.filter(o => o.type === t).length;
  assert.ok(n('lobe') >= 4 && n('river') >= 4, 'several rivers and deltaic lobes along the coast'); assert.ok(n('fairway') >= 2, 'canyon-fed fairways'); assert.ok(n('fan') >= 4, 'a string of basin-floor fans');
  assert.ok(n('mtc') >= 1 && n('platform') >= 2, 'MTCs, carbonate platforms');
  for (const o of F.filter(o => o.type === 'platform')) assert.equal(G.EOD[at(o.x, o.y)].key, 'carbshelf', 'platform on the carbonate shelf');
  for (const o of F.filter(o => o.type === 'mtc')) assert.ok(['slope', 'deep', 'abyssal'].includes(G.EOD[at(o.x, o.y)].key), 'MTC on the slope or at its toe');
});
test('atlas example 2: the same margin at a transgressive interval — carbonate platform belt near the coast, fluvial-deltaic restricted landward, shelf shales, fairways fed from the west', () => {
  const ex = G.examples.atlastr, M = ex.M, mod = G.build(M, ex.wells), e = M.ext, A = extA(e), W = e.xmax - e.xmin;
  assert.equal(ex.view, 'facies'); for (const c of mod.check) assert.ok(c.honoured && !c.warped, `${c.name} (${c.env})`);
  const { a } = eodKeysOf(mod, M, 1500), a1 = eodKeysOf(G.build(G.examples.atlas.M, G.examples.atlas.wells), G.examples.atlas.M, 1500).a;
  assert.ok((a.get('fluvdelta') || 0) < .75 * (a1.get('fluvdelta') || 0), 'fluvial-deltaic restricted landward');
  const sh = M.lines.find(l => /shoreline/i.test(l.name)), at = G.eodAt(mod); let carb = 0, tot = 0;
  for (let x = e.xmin + .05 * W; x < e.xmax; x += .05 * W) { for (let y = e.ymin; y < e.ymax; y += 500) if (G.sdist(sh.pts, x, y) > 6000) { tot++; if (G.EOD[at(x, y)].key === 'carbshelf') carb++; break; } }
  assert.ok(carb >= .8 * tot, `carbonate platform belt just basinward of the coast (${carb}/${tot})`);
  assert.ok(M.belts.some(b => /shale/i.test(b.name)), 'shelf shales');
  const fw = mod.facies.filter(o => o.type === 'fairway'); assert.ok(fw.length >= 2);
  for (const o of fw) assert.ok(o.path[0][0] < e.xmin + .45 * W, 'fairway fed from the west ' + o.path[0][0]);
  assert.equal(JSON.stringify(G.examples.atlas.M.lines.find(l => /toe/i.test(l.name)).pts), JSON.stringify(M.lines.find(l => /toe/i.test(l.name)).pts), 'same margin (toe of slope)');
});
test('facies objects from bodies: reefs and isolated platforms become platforms, an MTC apron an MTC; lakes get no toe-of-slope fans or MTCs', () => {
  const C = G.examples.carbmargin, fc = G.build(C.M, C.wells).facies, pin = C.M.bodies.filter(b => b.type === 'pinnacle');
  for (const b of pin) assert.ok(fc.some(o => o.type === 'platform' && G.inFacies(o, b.x, b.y)), 'pinnacle drawn as a platform at ' + b.x);
  const Mg = G.examples.margin, fm = G.build(Mg.M, Mg.wells).facies, mb = Mg.M.bodies.find(b => b.type === 'mtc');
  assert.ok(fm.some(o => o.type === 'mtc' && G.inFacies(o, mb.x, mb.y)), 'the MTC apron drawn as an MTC');
  const R = G.examples.rift, fr = G.build(R.M, R.wells).facies; assert.ok(!fr.some(o => o.type === 'mtc' || /^bff/.test(o.id)), 'no toe-of-slope objects in a lake');
});
// ---------- speed ----------
test('speed: label spots kept off many avoid points in linear time, same spots as the brute-force distance', () => {
  const nx = 400, ny = 300, L = new Int16Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) L[j * nx + i] = i < 150 ? 0 : j < 140 ? 1 : 2;
  const r = rng(7), avoid = []; for (let k = 0; k < 4000; k++) avoid.push([r() * nx, r() * 120]);
  const t0 = performance.now(), sp = G.labelSpots(L, nx, ny, { minCells: 100, avoid, avoidR: 6 }), dt = performance.now() - t0;
  assert.ok(dt < 400, 'labelSpots with 4000 avoid points: ' + dt.toFixed(0) + ' ms');
  assert.equal(sp.length, 3);
  for (const s of sp) { const dmin = Math.min(...avoid.map(q => Math.hypot(q[0] - s.x, q[1] - s.y))); assert.ok(dmin >= 6 || s.r < 8, `spot ${s.label} off the avoid points (${dmin.toFixed(1)})`); }
  const few = [[200, 220]], a = G.labelSpots(L, nx, ny, { minCells: 100, avoid: few, avoidR: 10 }).find(s => s.label === 2);
  assert.ok(Math.hypot(a.x - 200, a.y - 220) > 10, 'spot of region 2 moved off the single avoid point');
});
test('speed: signed distance to a long curve is fast (sign resolved once)', () => {
  const pts = []; for (let i = 0; i <= 60; i++) pts.push([i * 1000, 3000 * Math.sin(i / 4)]);
  const P = G.curve(pts), t0 = performance.now(); let s = 0;
  for (let k = 0; k < 40000; k++) s += G.sdistF(P, (k % 200) * 300, ((k / 200) | 0) * 60 - 6000);
  assert.ok(isFinite(s)); assert.ok(performance.now() - t0 < 600, (performance.now() - t0).toFixed(0) + ' ms');
  assert.ok(G.sdistF(P, 30000, 3000 * Math.sin(7.5) + 500) < 0 === G.sdistF(P, 30000, 3000 * Math.sin(7.5) + 2500) < 0, 'consistent side');
});
test('view: the plot frame fits the extent (no empty margin around the map), the view never zooms out past it nor pans off it', () => {
  const e = { xmin: 0, xmax: 320000, ymin: 0, ymax: 260000 };
  for (const [W, H, leg] of [[1180, 700, 210], [1180, 1400, 210], [600, 420, 0], [2400, 500, 210]]) {
    const b = G.fitBox(W, H, e, { leg });
    near((b.px1 - b.px0) / (b.py1 - b.py0), 320 / 260, 1e-6, `aspect ${W}x${H}`);
    assert.ok(b.px0 >= 0 && b.px1 <= W - leg && b.py0 >= 0 && b.py1 <= H, `inside ${W}x${H}`);
    assert.ok(b.px1 - b.px0 > .97 * Math.min(W - leg - 80, (H - 54) * 320 / 260), `fills the room ${W}x${H}`);
  }
  const v = G.clampView({ z: .4, cx: -90000, cy: 500000 }, e); assert.deepEqual(v, { z: 1, cx: 160000, cy: 130000 }, 'zoomed out: back to the extent');
  const w = G.clampView({ z: 4, cx: -5000, cy: 255000 }, e); near(w.cx, 40000, 1e-6); near(w.cy, 260000 - 32500, 1e-6); assert.equal(w.z, 4);
  const u = G.clampView({ z: 4, cx: 100000, cy: 90000 }, e); assert.deepEqual(u, { z: 4, cx: 100000, cy: 90000 }, 'inside: unchanged');
});
// ---------- no deposit / bypass ----------
const clone = o => JSON.parse(JSON.stringify(o));
test('no deposit / bypass: EOD domain drawn with a grid hatch, appended (old EOD codes unchanged); hinterland stays basement', () => {
  assert.deepEqual(G.EOD.slice(0, 10).map(d => d.key), ['basement', 'arid', 'fluvdelta', 'lake', 'clastshelf', 'isslope', 'carbshelf', 'slope', 'deep', 'abyssal']);
  const b = G.EOD.find(d => d.key === 'bypass'); assert.ok(b && b.pat === 'grid' && /no deposit/i.test(b.name));
  assert.equal(G.eodKey({ kind: 'ctx', name: 'Hinterland (erosion, bypass)', alias: ['hinterland'] }), 'basement');
  assert.equal(G.eodKey({ kind: 'belt', name: 'Upper slope (bypass, gullies)', alias: [], dom: 'slope' }), 'slope');
  for (const e of ['Eroded', 'no deposit', 'Non-deposition', 'hiatus', 'bypass', 'erosion', 'No deposits / Bypass']) assert.ok(G.isNodep(e), e);
  for (const e of ['Upper slope (bypass, gullies)', 'Delta front', 'Hinterland']) assert.ok(!G.isNodep(e), e);
});
test('no deposit / bypass: landward of a key line flagged “no deposit”, inside a no-deposit body; elsewhere the map is unchanged', () => {
  const ex = G.examples.margin, M = clone(ex.M), ref = G.build(ex.M, ex.wells);
  M.lines.push({ name: 'Erosional limit', k: -1, nodep: true, pts: [[-5000, 67000], [30000, 69000], [60000, 66500], [95000, 68000]] });   // a limit, not a key line of the field
  M.bodies.push({ type: 'nodep', shape: 'poly', x: 75000, y: 45000, pts: [[-4000, -3000], [4000, -3500], [5000, 3000], [-3500, 4000]] });
  const mod = G.build(M, ex.wells), nd = mod.belts.findIndex(c => c.name === 'No deposit / bypass');
  assert.ok(nd >= 0, 'class present'); assert.equal(mod.belts[nd].pat, 'grid');
  for (const [x, y] of [[10000, 74000], [50000, 72000], [85000, 71000]]) assert.equal(mod.beltAt(x, y), nd, `landward of the limit at ${x}, ${y}`);
  assert.equal(mod.beltAt(75000, 45000), nd, 'inside the body');
  for (const [x, y] of [[20000, 40000], [40000, 20000], [60000, 55000]]) assert.equal(mod.belts[mod.beltAt(x, y)].name, ref.belts[ref.beltAt(x, y)].name, `unchanged at ${x}, ${y}`);
  for (const c of mod.check) assert.ok(c.honoured, c.name);
  const at = G.eodAt(mod); assert.equal(G.EOD[at(50000, 72000)].key, 'bypass'); assert.equal(G.EOD[at(75000, 45000)].key, 'bypass');
  const R = G.openModel(G.saveModel(M, ex.wells)).M; assert.ok(R.lines.some(l => l.nodep === true), 'flag saved'); assert.ok(R.bodies.some(b => b.type === 'nodep'), 'body saved');
});
test('no deposit / bypass: wells described as eroded, hiatus, non-deposition or bypass are honoured (an eroded hole around them), the others unchanged', () => {
  const ex = G.examples.margin, W = ex.wells.concat([{ name: 'Hole-1', x: 15000, y: 46000, env: 'Eroded' }, { name: 'Hole-2', x: 80000, y: 15000, env: 'non-deposition' }, { name: 'Hole-3', x: 60000, y: 62000, env: 'Hiatus' }]);
  const mod = G.build(ex.M, W), nd = mod.belts.findIndex(c => c.name === 'No deposit / bypass'), ref = G.build(ex.M, ex.wells);
  assert.ok(nd >= 0);
  for (const c of mod.check) assert.ok(c.honoured && !c.warped, `${c.name} (${c.env})`);
  for (const h of W.slice(-3)) assert.equal(mod.beltAt(h.x, h.y), nd, h.name);
  // a hole, not a sea of bypass: 3 km away from the wells the map is unchanged
  for (const h of W.slice(-3)) for (const [dx, dy] of [[6000, 0], [-6000, 0], [0, 6000]]) assert.equal(mod.belts[mod.beltAt(h.x + dx, h.y + dy)].name, ref.belts[ref.beltAt(h.x + dx, h.y + dy)].name, `${h.name} + ${dx}, ${dy}`);
});
// ---------- rift ----------
test('fault tips: the throw and the footwall uplift taper gradually along the fault (no band of belts stacked across the strike at the tips)', () => {
  const M0 = G.makeModel('lake', { geom: 'linear', az: 90, src: [-20000, 0], span: 30000, ext: { xmin: -20000, xmax: 20000, ymin: -25000, ymax: 25000 }, noise: { amp: 0, wl: 3000, seed: 1 }, warp: { on: false, R: 1000 } });
  const M = Object.assign({}, M0, { faults: [{ pts: [[0, -15000], [0, 15000]], side: 1, off: 6000, taper: 2000, fw: 1 }] }), mod = G.build(M, []), ref = G.build(M0, []);
  let all = 0;
  for (const x of [-1500, -4000, 1500, 4000]) { const ch = []; let prev = null; for (let y = 0; y <= 22000; y += 50) { const c = mod.beltAt(x, y); if (prev != null && c !== prev) ch.push(y); prev = c; }
    all += ch.length; for (let i = 1; i < ch.length; i++) assert.ok(ch[i] - ch[i - 1] >= 3000, `x ${x}: belts change at ${ch.join(', ')} along the fault`); }
  assert.ok(all >= 2, 'the throw does decay towards the tips');
  for (const x of [-1500, 1500]) assert.equal(mod.beltAt(x, 21000), ref.beltAt(x, 21000), 'beyond the tip: unfaulted');
});
test('faults on the EOD and facies maps: a tapered stroke (zero width at the tips, widest in the middle); inherited escarpments kept in the model file', () => {
  const pts = [[0, 0], [1000, 4000], [0, 8000], [500, 12000]], R = G.faultRibbon(pts, 300), n = R.length / 2;
  assert.ok(R.length >= 40 && R.length % 2 === 0);
  const w = i => Math.hypot(R[i][0] - R[R.length - 1 - i][0], R[i][1] - R[R.length - 1 - i][1]);
  assert.ok(w(0) < 1 && w(n - 1) < 30, 'pointed tips ' + w(0).toFixed(1) + ' ' + w(n - 1).toFixed(1));
  const mid = Math.max(...Array.from({ length: n }, (_, i) => w(i))); near(mid, 300, 30, 'widest = max width');
  const M = JSON.parse(JSON.stringify(G.examples.rift.M)); M.faults[0].inh = true;
  assert.equal(G.openModel(G.saveModel(M, [])).M.faults[0].inh, true, 'inherited flag saved');
});
// ---------- palette ----------
test('palettes: Atlas (pastel) by default, Marine blues (continental orange, neritic green, marine blues, navy deep marine, lacustrine greens, bypass grid); user colours win; saved', () => {
  assert.deepEqual(G.EOD.slice(10).map(d => d.key), ['bypass', 'alluvial', 'deeplake', 'neritic'], 'new domains appended');
  assert.deepEqual(Object.keys(G.PALETTES), ['atlas', 'marine']); assert.ok(G.PALETTES.marine.name && G.PALETTES.atlas.name);
  const rgb = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16)), lum = c => { const [r, g, b] = rgb(c); return (.3 * r + .59 * g + .11 * b) / 255; };
  const M = G.makeMargin('passive'), A = G.eodClasses(M), byA = Object.fromEntries(A.map(d => [d.key, d]));
  assert.equal(byA.deep.color, G.EOD.find(d => d.key === 'deep').color, 'atlas by default');
  M.eod = { palette: 'marine' }; const B = Object.fromEntries(G.eodClasses(M).map(d => [d.key, d]));
  assert.ok(lum(B.deep.color) < .25 && lum(B.abyssal.color) < lum(B.deep.color) + .01, 'navy deep marine'); const [r1, g1, b1] = rgb(B.clastshelf.color); assert.ok(b1 > r1 && lum(B.clastshelf.color) > .6, 'light blue shallow marine');
  const [r2, g2, b2] = rgb(B.slope.color); assert.ok(b2 > r2 + 60 && lum(B.slope.color) < lum(B.clastshelf.color), 'marine blue');
  const [r3, g3, b3] = rgb(B.fluvdelta.color); assert.ok(r3 > g3 && g3 > b3, 'continental orange'); const [r4, g4, b4] = rgb(B.lake.color); assert.ok(g4 > r4 && g4 > b4, 'lacustrine green');
  const [r5, g5, b5] = rgb(B.neritic.color); assert.ok(g5 > b5 && g5 >= r5, 'neritic green'); assert.equal(B.bypass.pat, 'grid'); assert.equal(B.alluvial.pat, 'stipple'); assert.equal(B.deep.name, 'Deep marine');
  M.eod.doms = { deep: { color: '#123456' } }; assert.equal(G.eodClasses(M).find(d => d.key === 'deep').color, '#123456', 'user colour wins');
  assert.equal(G.normModel(M).eod.palette, 'marine'); M.eod.palette = 'nope'; assert.equal(G.normModel(M).eod.palette, undefined);
});
// ---------- new facies objects ----------
const ang = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
const cen = r => [r.reduce((s, q) => s + q[0], 0) / r.length, r.reduce((s, q) => s + q[1], 0) / r.length];
test('facies objects: sand ribbons along the shoreline, contourite drifts beyond the toe of slope, carbonate mudstone patches, hollow transport arrows from the feeders', () => {
  assert.deepEqual(G.FKEYS.slice(0, 7), ['lobe', 'river', 'fairway', 'fan', 'platform', 'mtc', 'ponded'], 'old object codes unchanged');
  for (const k of ['afan', 'ribbon', 'contourite', 'carbmud', 'arrow']) assert.ok(G.FTYPE[k], k);
  const ex = G.examples.margin, M = clone(ex.M); M.facies = Object.assign({}, M.facies, { n: Object.assign({}, M.facies.n, { ribbon: 3, contourite: 2, carbmud: 2 }), arrows: true });
  const mod = G.build(M, ex.wells), F = mod.facies, of = t => F.filter(o => o.type === t), e = M.ext, dg = Math.hypot(e.xmax - e.xmin, e.ymax - e.ymin);
  const sh = M.lines.find(l => /shoreline/i.test(l.name)).pts, toe = M.lines.find(l => /toe/i.test(l.name)).pts;
  assert.equal(of('ribbon').length, 3);
  for (const o of of('ribbon')) { assert.ok(o.g.rings.length >= 2, 'strips'); for (const r of o.g.rings) { const c = cen(r), d = G.sdist(sh, c[0], c[1]); assert.ok(d > -.01 * dg && d < .07 * dg, 'strip along the shoreline, seaward ' + d); } }
  assert.equal(of('contourite').length, 2);
  for (const o of of('contourite')) { assert.ok(o.g.rings.length >= 4, 'crescent streaks'); for (const r of o.g.rings) { const c = cen(r); assert.ok(G.sdist(toe, c[0], c[1]) > 0, 'beyond the toe of slope'); } }
  const at = G.eodAt(mod); assert.equal(of('carbmud').length, 2); for (const o of of('carbmud')) assert.ok(['slope', 'deep', 'abyssal', 'neritic', 'clastshelf'].includes(G.EOD[at(o.x, o.y)].key));
  const ar = of('arrow'); assert.ok(ar.length >= M.feeders.length, 'an arrow per feeder');
  for (const f of M.feeders) assert.ok(ar.some(o => ang(o.az, f.az) < 25 && Math.hypot(o.x - f.x, o.y - f.y) < .25 * dg), 'arrow along feeder ' + f.az);
  // exports: the strips and streaks are polygons of the facies level
  const FF = G.faciesFeatures(mod); assert.ok(FF.polys.filter(p => p.type === 'contourite').length >= 8 && FF.polys.some(p => p.type === 'ribbon') && FF.polys.some(p => p.type === 'arrow'));
  assert.ok(/"type":"contourite"/.test(G.geojsonLevels([], FF)));
  const N = G.normModel(M).facies; assert.equal(N.arrows, true); assert.equal(N.n.contourite, 2);
});
test('facies objects: fan deltas on the faults — a stippled sand-rich alluvial fan and a small deltaic lobe at each fault-bounded source, on the hanging-wall side', () => {
  const ex = G.examples.rift, mod = G.build(ex.M, ex.wells), F = mod.facies, src = ex.M.sources.filter(s => s.kind === 'fault');
  for (const s of src) {
    const a = F.find(o => o.type === 'afan' && Math.hypot(o.x - s.x, o.y - s.y) < 1.2 * s.L), l = F.find(o => o.type === 'lobe' && Math.hypot(o.x - s.x, o.y - s.y) < 1.5 * s.L);
    assert.ok(a && l, `fan and lobe at the source ${s.x}, ${s.y}`);
    const c = cen(l.g.ring); assert.ok((c[0] - s.x) * Math.sin(s.az * Math.PI / 180) + (c[1] - s.y) * Math.cos(s.az * Math.PI / 180) > 0, 'lobe on the hanging-wall side');
  }
  assert.equal(G.FTYPE.afan.pat, 'stipple');
});
test('facies objects: wells described as sand ribbon, contourite drift, carbonate mudstone or alluvial fan are honoured without warping', () => {
  const ex = G.examples.margin, M = clone(ex.M), W = ex.wells.concat([{ name: 'Rib-1', x: 20000, y: 51500, env: 'Channel bar sandstone' }, { name: 'Ct-1', x: 60000, y: 8000, env: 'Contourite drift' },
    { name: 'Cm-1', x: 15000, y: 27500, env: 'Carbonate mudstone' }]);
  const mod = G.build(M, W); for (const c of mod.check) assert.ok(c.honoured && !c.warped, `${c.name} (${c.env})`);
  const R = G.examples.rift, Wr = R.wells.concat([{ name: 'Af-1', x: 25200, y: 8000, env: 'Alluvial fan (sand-rich)' }]), mr = G.build(R.M, Wr);
  for (const c of mr.check) assert.ok(c.honoured && !c.warped, `${c.name} (${c.env})`);
});
test('resample: evenly spaced points along long segments too (a two-point line gives a point every step to its end)', () => {
  const R = G.resample([[0, 0], [12000, 0]], 100); assert.equal(R.P.length, 121); near(R.P[120][0], 12000, 1e-6); near(R.S[60], 6000, 1e-6);
});
test('rift stages: three synthetic synrift intervals on one area with the same wells — non-marine, marine incursion, deep marine with inherited escarpments; wells honoured without warping', () => {
  const ks = ['riftearly', 'riftmid', 'riftlate'], g = G.EXGROUPS.find(q => /rift stages/i.test(q[0])); assert.ok(g); assert.deepEqual(g[1], ks);
  const pos = k => JSON.stringify(G.examples[k].wells.map(w => [w.name, w.x, w.y]));
  assert.equal(pos('riftmid'), pos('riftearly')); assert.equal(pos('riftlate'), pos('riftearly'));
  const area = {}, mods = {};
  for (const k of ks) { const ex = G.examples[k], M = ex.M, mod = G.build(M, ex.wells); mods[k] = mod; assert.equal(ex.view, 'facies'); assert.equal(M.eod.palette, 'marine');
    for (const c of mod.check) assert.ok(c.honoured && !c.warped, `${k}: ${c.name} (${c.env})`);
    const a = new Map(); for (const p of G.eodPolygons(mod, M.ext, 600)) a.set(p.key, (a.get(p.key) || 0) + p.area); area[k] = a; }
  const A = (k, d) => (area[k].get(d) || 0) / (60000 * 50000);
  for (const d of ['bypass', 'alluvial', 'lake', 'deeplake']) assert.ok(A('riftearly', d) > .01, 'early: ' + d);
  for (const d of ['clastshelf', 'slope', 'deep']) assert.ok(A('riftearly', d) === 0, 'early non-marine: no ' + d);
  assert.ok(A('riftmid', 'lake') > .05 && A('riftmid', 'clastshelf') + A('riftmid', 'slope') + A('riftmid', 'deep') > .15, 'mid: lakes and marine');
  assert.ok(A('riftlate', 'deep') > .3 && A('riftlate', 'lake') === 0, 'late: deep marine');
  // en-echelon synrift segments: overlapping along strike, stepping sideways; inherited (grey) in the late stage
  const F = G.examples.riftearly.M.faults; assert.ok(F.length >= 6 && F.every(f => !f.inh && f.off > 0));
  let ech = 0; for (let i = 0; i < F.length; i++) for (let j = 0; j < F.length; j++) { const a = F[i].pts, b = F[j].pts; if (i !== j && b[0][1] < a[a.length - 1][1] && b[0][1] > a[0][1] && Math.abs(b[0][0] - a[a.length - 1][0]) < 6000) ech++; }
  assert.ok(ech >= 3, 'en-echelon relays ' + ech); assert.ok(G.examples.riftlate.M.faults.every(f => f.inh));
  for (const k of ['riftearly', 'riftmid']) { const fo = mods[k].facies; assert.ok(fo.filter(o => o.type === 'afan').length >= 6 && fo.filter(o => o.type === 'lobe').length >= 6, k + ': fan deltas along the faults'); }
  const fl = mods.riftlate.facies; assert.ok(fl.filter(o => o.type === 'fairway').length >= 2 && fl.filter(o => o.type === 'fan').length >= 3, 'late: turbidite channels and sandy lobes');
});
// ---------- verdict of the wells check (review fix): green only when every well is matched AND honoured ----------
test('verdict: 5 wells on the default shelf system, 3 unmatched -> amber "2 of 5 wells honoured, 3 not matched to a class"', () => {
  const M = G.makeModel('shelf', {}), r = G.parseWells('W1 0 0 delta plain\nW2 1000 0 shelf\nW3 2000 0 delta front\nW4 3000 0 slope\nW5 4000 0 delta plain');
  const v = G.verdictOf(G.build(M, r.wells).check);
  assert.equal(v.state, 'warn'); assert.equal(v.head, '2 of 5 wells honoured, 3 not matched to a class'); assert.equal(v.N, 5); assert.equal(v.un, 3);
});
test('verdict: 3 wells with 2 unmatched is never green; red when a matched well is not honoured; green only when all are matched and honoured', () => {
  const M = G.makeModel('shelf', {}), r = G.parseWells('W1 0 0 delta plain\nW2 1000 0 delta front\nW3 3000 0 slope');
  const v = G.verdictOf(G.build(M, r.wells).check);
  assert.notEqual(v.state, 'pass'); assert.equal(v.head, '1 of 3 wells honoured, 2 not matched to a class');
  const mk = (b, h, pair) => ({ b, honoured: h, pair: pair || null });
  assert.equal(G.verdictOf([mk(1, true), mk(2, true)]).state, 'pass');
  assert.equal(G.verdictOf([mk(1, true), mk(2, false)]).state, 'bad');
  assert.equal(G.verdictOf([mk(1, true), mk(-1, false)]).state, 'warn');
  assert.equal(G.verdictOf([mk(1, false), mk(-1, false)]).state, 'bad');
  assert.equal(G.verdictOf([]).state, 'none'); assert.equal(G.verdictOf([mk(1, true)]).head, 'The well is honoured');
});
test('howHonoured / leaveOneOut / suggestSystem', () => {
  assert.equal(G.howHonoured({ b: 2, honoured: true, warped: true }).how, 'warping');
  assert.equal(G.howHonoured({ b: 2, honoured: true }).how, 'belts');
  assert.equal(G.howHonoured({ b: -1, honoured: false }).how, 'unmatched');
  assert.equal(G.howHonoured({ b: -1, ft: 'lobe', honoured: true, fobj: 'a' }, { facies: [{ id: 'a', well: true }] }).txt, 'object created at the well');
  const ex = G.examples.delta, loo = G.leaveOneOut(ex.M, G.build(ex.M, ex.wells).wells);
  assert.ok(loo.length >= 2 && loo.every(o => typeof o.hit === 'boolean' && o.predicted), 'one result per matched well');
  const r = G.parseWells('W1 0 0 delta plain\nW2 1000 0 delta front\nW3 3000 0 prodelta\nW4 5000 0 distributary mouth bar');
  const s = G.suggestSystem(r.wells, 'shelf'); assert.ok(s && s.count > s.curCount, JSON.stringify(s));
  assert.equal(G.suggestSystem(G.parseWells('A 0 0 shoreface\nB 1 1 slope').wells, 'shelf'), null);
});
// ---------- source-to-sink chain, grain size / carbonate components, transport arrows by process ----------
const synth = names => { const M = G.makeModel('shelf', {}); M.belts = names.map((n, i) => ({ name: n, color: '#' + (i + 1) + '0a0a0', w: 1, alias: [] })); return M; };
test('sinkChain: clastic chain follows the belt order, own colours, grain per link; delta without shelf is greyed with a tooltip', () => {
  const M = synth(['Delta plain', 'Delta front', 'Prodelta', 'Slope', 'Basin plain']);
  let c = G.sinkChain(M); assert.equal(c.mode, 'clastic');
  assert.deepEqual(c.links.map(l => l.name), ['Delta plain', 'Delta front', 'Prodelta', 'Slope', 'Basin plain']);
  assert.equal(c.links[0].color, M.belts[0].color); assert.ok(c.links.every(l => !l.missing));
  assert.deepEqual(c.links.map(l => l.grain), ['sand', 'sand', 'silt', 'silt', 'clay']);
  const M2 = synth(['Delta plain', 'Delta front', 'Basin plain']); c = G.sinkChain(M2);
  const miss = c.links.filter(l => l.missing); assert.deepEqual(miss.map(l => l.name), ['Shelf', 'Slope']);
  assert.ok(/No shelf between/.test(miss[0].tip) && miss[0].color === '#d9d7cf' && !miss[0].k.length);
  assert.deepEqual(c.links.map(l => l.name), ['Delta plain', 'Delta front', 'Shelf', 'Slope', 'Basin plain']);
  c = G.sinkChain(M2, { present: new Set([0, 2]) }); assert.deepEqual(c.links.filter(l => !l.missing).map(l => l.name), ['Delta plain', 'Basin plain']);
});
test('sinkChain: carbonate platform to basin uses the existing carbonate belts, components instead of grain size, reef missing is flagged, ramp is not', () => {
  const M = G.makeModel('carbonate', {}); let c = G.sinkChain(M);
  assert.equal(c.mode, 'carbonate'); assert.deepEqual(c.links.map(l => l.stage), [0, 1, 1, 3, 4, 5]); assert.ok(c.links.every(l => !l.missing));
  assert.deepEqual(c.links[3].comps, ['reef']); assert.deepEqual(c.links[4].comps, ['debris']); assert.deepEqual(c.links[5].comps, ['mud']);
  const M2 = G.makeModel('carbonate', {}); M2.belts = M2.belts.filter(b => !/margin/i.test(b.name)); c = G.sinkChain(M2);
  assert.deepEqual(c.links.filter(l => l.missing).map(l => l.name), ['Reef margin']);
  c = G.sinkChain(G.makeModel('ramp', {})); assert.equal(c.mode, 'carbonate'); assert.ok(c.ramp && c.links.every(l => !l.missing));
  assert.equal(G.sinkChain(G.makeModel('shelf', {})).mode, 'clastic');
});
test('sinkChain: EOD level merges consecutive links of the same domain and takes the EOD colours', () => {
  const M = G.makeModel('delta', {}), c = G.sinkChain(M, { eod: true }), cl = G.eodClasses ? G.eodClasses(M) : null;
  assert.ok(c.links.length >= 1 && c.links.every(l => l.eod && l.k.length >= 1));
  if (cl) assert.ok(c.links.every(l => l.color === cl[l.eod[0]].color));
});
test('transport arrows carry a process; carbonate and clastic maps get wave/tide, gravity and settling arrows along the chain', () => {
  const ex = G.examples.delta; ex.M.facies = Object.assign(G.faciesDefaults(), { arrows: true });
  let mod = G.build(ex.M, ex.wells), A = (mod.facies || []).filter(o => o.type === 'arrow');
  assert.ok(A.length >= 1 && A.every(o => ['river', 'wave', 'gravity', 'settle'].includes(o.proc)), JSON.stringify(A.map(o => o.proc)));
  const Mc = G.makeModel('carbonate', {}); Mc.facies = Object.assign(G.faciesDefaults(), { arrows: true });
  mod = G.build(Mc, []); A = (mod.facies || []).filter(o => o.type === 'arrow');
  assert.deepEqual(A.map(o => o.proc).sort(), ['gravity', 'settle', 'wave']);
  const pr = A.find(o => o.proc === 'gravity'), q = A.find(o => o.proc === 'wave');
  assert.ok(Number.isFinite(pr.x) && Number.isFinite(pr.az));
  const b = (o) => mod.beltAt(o.x + Math.sin(o.az * Math.PI / 180) * .5 * o.L, o.y + Math.cos(o.az * Math.PI / 180) * .5 * o.L);
  assert.ok(b(pr) >= b(q), 'gravity-flow arrow lies more distal than the wave/tide arrow');
});
// ---------- delta forms (river / wave / tide) ----------
const dobj = (rg, extra) => Object.assign({ id: 'd', type: 'lobe', x: 20000, y: 30000, az: 180, L: 14000, open: 60, seed: 4, regime: rg }, extra || {});
const kinds = g => g.parts.map(p => p.kind);
const cnt = (a, k) => a.filter(x => x === k).length;
test('delta regime: forced, generic, or auto from the single-system template', () => {
  assert.equal(G.deltaRegime({ template: 'delta' }, {}), 'river');
  assert.equal(G.deltaRegime({ template: 'wavedelta' }, { regime: 'auto' }), 'wave');
  assert.equal(G.deltaRegime({ template: 'estuary' }, {}), 'tide');
  assert.equal(G.deltaRegime({ template: 'estuary' }, { regime: 'river' }), 'river');
  assert.equal(G.deltaRegime({ template: 'estuary' }, { regime: 'generic' }), null);
  assert.equal(G.deltaRegime({ template: 'margin' }, {}), null);
  assert.equal(G.normFacies({ regime: 'tide' }).regime, 'tide');
  assert.equal(G.normFacies({ regime: 'bogus' }).regime, undefined);
});
test('river-dominated delta: bird-foot fingers, each with a levee strip and a mouth bar, interdistributary bay, channels reach the tips', () => {
  const g = G.faciesShape(dobj('river')), k = kinds(g), ch = g.lines.filter(l => l.kind === 'chan');
  assert.ok(g.ring.length > 100 && g.ring.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1])));
  assert.ok(cnt(k, 'bar') >= 3 && cnt(k, 'bar') === cnt(k, 'levee') && cnt(k, 'bay') === 1);
  assert.equal(ch.length, cnt(k, 'bar') + 1);                       // trunk + one channel per finger
  const apex = [20000, 30000], reach = ch.slice(1).map(l => Math.hypot(l.pts.at(-1)[0] - apex[0], l.pts.at(-1)[1] - apex[1]) / 14000);
  assert.ok(reach.every(r => r > .65 && r < 1.05), reach.join());   // elongate: the channels run to the tips
  const bay = g.parts.find(p => p.kind === 'bay'), a = Math.abs(G.sArea(g.ring)), b = Math.abs(G.sArea(bay.ring));
  assert.ok(b > a * 1.0, 'bays lie between the fingers (the bay region is wider than the finger envelope)');
});
test('wave-dominated delta: smooth arcuate front, a single channel, beach ridges parallel to the coast, longshore drift arrows', () => {
  const g = G.faciesShape(dobj('wave')), ridges = g.lines.filter(l => l.kind === 'ridge');
  assert.equal(g.lines.filter(l => l.kind === 'chan').length, 1);
  assert.ok(ridges.length >= 8 && kinds(g).includes('beach'));
  // arcuate: the front is at an almost constant distance from the apex (idealised arc, <= 12 % variation over the opening)
  const d = g.ring.slice(1).map(p => Math.hypot(p[0] - 20000, p[1] - 30000)), mx = Math.max(...d);
  assert.ok(d.filter(v => v > .85 * mx).length > .4 * d.length);
  // ridges parallel to the front: each ridge point keeps a stable ratio to the front radius (nearly concentric)
  const rr = ridges[0].pts.map(p => Math.hypot(p[0] - 20000, p[1] - 30000)); assert.ok((Math.max(...rr) - Math.min(...rr)) / Math.max(...rr) < .15);
  assert.equal(g.info.drift.length, 2);
});
test('tide-dominated delta: funnels flare seaward, tidal bars elongate along the flow (perpendicular to the coast), mud flat behind', () => {
  const g = G.faciesShape(dobj('tide')), k = kinds(g), fun = g.parts.filter(p => p.kind === 'funnel');
  assert.ok(fun.length >= 3 && cnt(k, 'tbar') >= fun.length && cnt(k, 'flat') === 1);
  // flare: the funnel is wider at the sea end than at the landward end (rings from a strip: compare the extents across the axis near both ends)
  const f = fun[0].ring, mx = f.reduce((s, p) => s + p[0], 0) / f.length, my = f.reduce((s, p) => s + p[1], 0) / f.length;
  let sxx = 0, sxy = 0, syy = 0; for (const p of f) { const x = p[0] - mx, y = p[1] - my; sxx += x * x; sxy += x * y; syy += y * y; }
  const th = .5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(th), uy = Math.sin(th), S = f.map(p => (p[0] - mx) * ux + (p[1] - my) * uy), Tn = f.map(p => -(p[0] - mx) * uy + (p[1] - my) * ux);
  const s0 = Math.min(...S), s1 = Math.max(...S), wid = (a, b) => { const q = Tn.filter((v, i) => S[i] >= a && S[i] <= b); return Math.max(...q) - Math.min(...q) };
  const e0 = wid(s0, s0 + .15 * (s1 - s0)), e1 = wid(s1 - .15 * (s1 - s0), s1);
  assert.ok(Math.max(e0, e1) > 2.5 * Math.min(e0, e1), `funnel ends ${e0} vs ${e1}`);
  const bar = g.parts.filter(p => p.kind === 'tbar').map(p => { const xs = p.ring.map(q => q[0]), ys = p.ring.map(q => q[1]); return (Math.max(...ys) - Math.min(...ys)) / (Math.max(...xs) - Math.min(...xs)) });
  assert.ok(bar.filter(r => r > 1.2).length >= 2, 'bars elongate along the flow (az 180: north-south), perpendicular to the coast');
});
test('delta forms: examples build, honour every well, carry their process arrows (wave purple drift, flood / ebb pairs for tides)', () => {
  for (const k of ['deltariver', 'deltawave', 'deltatide']) {
    const ex = G.examples[k], mod = G.build(ex.M, ex.wells), lobe = mod.facies.find(o => o.type === 'lobe');
    assert.ok(ex.wells.length >= 4 && mod.check.every(c => c.honoured), k + ' wells');
    assert.equal(lobe.regime, { deltariver: 'river', deltawave: 'wave', deltatide: 'tide' }[k]);
    assert.ok(G.EXGROUPS.some(g => g[1].includes(k)) && G.EXNAMES[k], k + ' in the selector');
  }
  let mod = G.build(G.examples.deltatide.M, G.examples.deltatide.wells), A = mod.facies.filter(o => o.type === 'arrow');
  const fl = A.filter(o => o.proc === 'flood'), eb = A.filter(o => o.proc === 'ebb');
  assert.ok(fl.length >= 3 && fl.length === eb.length);
  assert.ok(fl.every((o, i) => Math.abs((((o.az - eb[i].az) % 360) + 360) % 360 - 180) < .5), 'flood opposite to ebb');
  mod = G.build(G.examples.deltawave.M, G.examples.deltawave.wells);
  assert.ok(mod.facies.filter(o => o.proc === 'wave' && /^drift/.test(o.id)).length === 2);
  mod = G.build(G.examples.deltariver.M, G.examples.deltariver.wells);
  assert.ok(!mod.facies.some(o => o.proc === 'flood' || o.proc === 'ebb' || /^drift/.test(o.id)), 'flood / ebb only for the tide-dominated delta');
});
test('delta forms: generating the shape is fast (< 40 ms each), exports carry the parts as polygons', () => {
  for (const rg of ['river', 'wave', 'tide']) { const t0 = performance.now(); for (let i = 0; i < 5; i++) G.faciesShape(dobj(rg, { seed: i })); assert.ok((performance.now() - t0) / 5 < 40, rg); }
  const ex = G.examples.deltatide, mod = G.build(ex.M, ex.wells), F = G.faciesFeatures(mod);
  assert.ok(F.polys.some(p => /funnel/.test(p.id)) && F.polys.some(p => /tbar/.test(p.id)));
});
// ---------- detailed submarine fan and sand-content view ----------
test('submarine fan (detailed): canyon, sinuous leveed channel with overbank fines, transition, distributaries, lobes with sand axis and fringes, abandoned channel', () => {
  const o = { id: 's', type: 'sfan', x: 25000, y: 39000, az: 180, L: 30000, open: 50, seed: 3 }, g = G.faciesShape(o), k = g.parts.map(p => p.kind), L = g.lines.map(l => l.kind);
  assert.ok(g.ring && g.ring.length > 10 && L.includes('canyon') && L.includes('abandoned'));
  const ch = g.lines.find(l => l.kind === 'schan').pts, len = ch.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - ch[i][0], p[1] - ch[i][1]), 0), chord = Math.hypot(ch.at(-1)[0] - ch[0][0], ch.at(-1)[1] - ch[0][1]);
  assert.ok(len / chord > 1.05, 'sinuous channel ' + len / chord);
  const nd = L.filter(x => x === 'dist').length;
  assert.ok(nd >= 2 && k.filter(x => x === 'lobe').length === nd && L.filter(x => x === 'sandaxis').length === nd, 'one lobe and one sand axis per distributary');
  assert.ok(k.includes('levee') && k.includes('overbank') && k.includes('cltrans') && k.filter(x => x === 'fringe').length >= nd);
  assert.equal(G.faciesShape(Object.assign({}, o, { ab: 0 })).lines.some(l => l.kind === 'abandoned'), false);
  // the lobes lie beyond the channel (down the fan axis, az 180 = towards decreasing y)
  const lobeY = g.parts.filter(p => p.kind === 'lobe').map(p => p.ring.reduce((s, q) => s + q[1], 0) / p.ring.length), endY = ch.at(-1)[1];
  assert.ok(lobeY.every(y => y < endY));
  const t0 = performance.now(); for (let i = 0; i < 5; i++) G.faciesShape(Object.assign({}, o, { seed: i })); assert.ok((performance.now() - t0) / 5 < 40);
});
test('sand content view: low / intermediate / high classes (blue, pale yellow, orange); unknown = not represented; parts rank overbank < levee < channel-lobe < sand lobe', () => {
  assert.deepEqual([.05, .45, .9].map(v => G.sandClass(v).k), ['low', 'mid', 'high']);
  assert.equal(G.sandClass(null), null); assert.equal(G.sandClass(undefined), null);
  assert.deepEqual(G.SAND.map(q => q.color), ['#5b8fd0', '#f3e9a0', '#e8892a']);
  const P = G.PARTS; assert.ok(P.overbank[3] < P.levee[3] && P.levee[3] < P.cltrans[3] && P.cltrans[3] <= P.lobe[3]);
  for (const k of ['reef', 'sandbank', 'tongue', 'oobank', 'storm', 'shelter']) assert.equal(P[k][3], null, k + ' is carbonate: not represented');
  assert.equal(G.normFacies({ sandView: true }).sandView, true); assert.equal(G.normFacies({}).sandView, undefined);
  const M = G.makeModel('fan', {}); M.facies.sandView = true; assert.equal(G.openModel(G.saveModel(M, [])).M.facies.sandView, true);
});
test('detailed fan: example builds and honours its wells; with the option on, a margin gets one detailed fan per canyon-fed feeder instead of the fairway and fan', () => {
  const ex = G.examples.subfan, mod = G.build(ex.M, ex.wells);
  assert.ok(mod.facies.some(o => o.type === 'sfan') && !mod.facies.some(o => o.type === 'fan') && mod.check.every(c => c.honoured));
  assert.ok(G.EXGROUPS.some(g => g[1].includes('subfan')) && G.EXNAMES.subfan);
  const m = G.examples.margin.M, a = G.build(m, []).facies, nf = a.filter(o => o.type === 'fairway').length;
  assert.ok(nf >= 1 && !a.some(o => o.type === 'sfan'));
  const m2 = JSON.parse(JSON.stringify(m)); m2.facies.n.sfan = 1; const b = G.build(m2, []).facies;
  assert.equal(b.filter(o => o.type === 'sfan').length, nf);
  assert.ok(!b.some(o => /^fairway\d/.test(o.id)) && !b.some(o => /^fan\d/.test(o.id)));
});
// ---------- carbonate platform: scalloped reef rim, pass, patch reefs, sand banks, slope tongues ----------
const rimObj = (extra) => Object.assign({ id: 'r', type: 'reefrim', path: [[30000, 0], [30000, 20000], [30000, 40000]], lag: 12000, sl: 4000, w: 600, np: 1, patch: 6, nb: 3, tg: 6, seed: 5 }, extra || {});
test('reef-rimmed margin: scalloped (not smooth) rim, cut by a pass, patch reefs and sand banks on the lagoon side, debris tongues on the slope side', () => {
  const g = G.faciesShape(rimObj()), w = 600, X0 = 30000;
  assert.equal(g.rings.length, 2, 'one pass cuts the rim in two segments');
  const gapLo = Math.max(...g.rings[0].map(p => p[1])), gapHi = Math.min(...g.rings[1].map(p => p[1])), lo = gapLo < gapHi ? [gapLo, gapHi] : [Math.max(...g.rings[1].map(p => p[1])), Math.min(...g.rings[0].map(p => p[1]))];
  assert.ok(lo[1] - lo[0] > 3 * w, 'pass gap ' + (lo[1] - lo[0]));
  const outer = g.rings.flat().filter(p => p[0] > X0 + .25 * w).map(p => p[0] - X0), mean = outer.reduce((s, v) => s + v, 0) / outer.length, sd = Math.sqrt(outer.reduce((s, v) => s + (v - mean) ** 2, 0) / outer.length);
  assert.ok(sd > .2 * w && Math.max(...outer) - Math.min(...outer) > .9 * w, `scalloped outer edge: sd ${sd}`);
  const cx = p => p.ring.reduce((s, q) => s + q[0], 0) / p.ring.length, of = k => g.parts.filter(p => p.kind === k);
  assert.ok(of('reef').length >= 4 && of('reef').every(p => cx(p) < X0), 'patch reefs behind the rim (lagoon = left of a north-going line has basin on the right)');
  assert.ok(of('sandbank').length === 3 && of('sandbank').every(p => cx(p) < X0));
  assert.ok(of('tongue').length === 6 && of('tongue').every(p => cx(p) > X0 + w), 'tongues on the basin side');
  const nopass = G.faciesShape(rimObj({ np: 0 })); assert.equal(nopass.rings.length, 1);
  const t0 = performance.now(); for (let i = 0; i < 5; i++) G.faciesShape(rimObj({ seed: i })); assert.ok((performance.now() - t0) / 5 < 40);
});
test('carbonate platform example: the margin line gets its reef rim, pass arrows (wave / tide purple, both ways) and gravity arrows down the slope, wells honoured', () => {
  const ex = G.examples.carbplat, mod = G.build(ex.M, ex.wells), rim = mod.facies.find(o => o.type === 'reefrim');
  assert.ok(rim && rim.lag > 0 && rim.sl > 0 && mod.check.every(c => c.honoured));
  assert.ok(G.EXGROUPS.some(g => g[1].includes('carbplat')) && G.EXNAMES.carbplat);
  const A = mod.facies.filter(o => o.type === 'arrow'), pin = A.find(o => o.id === 'passin0'), pout = A.find(o => o.id === 'passout0'), gr = A.filter(o => /^arrG/.test(o.id));
  assert.ok(pin && pout && pin.proc === 'wave' && pout.proc === 'wave' && Math.abs((((pin.az - pout.az) % 360) + 360) % 360 - 180) < .5);
  assert.ok(gr.length >= 1 && gr.every(o => o.proc === 'gravity'));
  assert.ok(gr.every(o => Math.abs(((o.az - pout.az + 540) % 360) - 180) < 75), 'gravity transfer points down the slope (basinward, like the outflow, within the curvature of the margin)');
  const m2 = JSON.parse(JSON.stringify(ex.M)); m2.facies.n.rim = 0; assert.ok(!G.build(m2, ex.wells).facies.some(o => o.type === 'reefrim'));
});
let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ', name); }
  catch (e) { fail++; console.log('FAIL ', name, '\n     ', String(e.message).split('\n').slice(0, 6).join('\n      ')); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
