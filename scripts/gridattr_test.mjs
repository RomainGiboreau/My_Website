// Self-check for the Grid attributes core (docs/gridattr/index.html, <script id="ga-core">).
// Run: node scripts/gridattr_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

function load(path, id) {
  const html = readFileSync(new URL(path, import.meta.url), 'utf8');
  const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`));
  assert.ok(m, `${id} script block not found`);
  const ctx = { window: {} };
  vm.runInNewContext(m[1], ctx);
  return ctx.window;
}
const GA = load('../docs/gridattr/index.html', 'ga-core').GA;
const ZMAP = load('../docs/zmap-checker/index.html', 'zmap-core').ZMAP;   // independent reader/checker for the round trip

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} got ${a}, want ${b} +- ${tol}`);
const DEG = 180 / Math.PI;
// grid from f(x, y): x east, y north; node (r, c) at x = c*dx, y = (ny-1-r)*dy
function mk(nx, ny, dx, dy, f) {
  const z = new Float64Array(nx * ny);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) z[r * nx + c] = f(c * dx, (ny - 1 - r) * dy);
  return GA.makeGrid(nx, ny, dx, dy, 0, (ny - 1) * dy, z, 't');
}
const at = (g, r, c) => r * g.nx + c;
const interior = (g, m, fn) => { for (let r = m; r < g.ny - m; r++) for (let c = m; c < g.nx - m; c++) fn(r, c, r * g.nx + c); };

// ---- slope / aspect
test('slope of a tilted plane = atan(sqrt(a^2+b^2)), anisotropic cells, edges included', () => {
  const a = 0.3, b = -0.2, g = mk(30, 25, 20, 10, (x, y) => a * x + b * y + 100);
  const s = GA.slope(g), want = Math.atan(Math.hypot(a, b)) * DEG;
  for (let i = 0; i < s.length; i++) near(s[i], want, 1e-9, 'slope');
});
test('aspect (dip azimuth) of planes: clockwise from north, direction of steepest descent', () => {
  const cases = [[0.5, 0, 270], [-0.5, 0, 90], [0, 0.5, 180], [0, -0.5, 0], [0.3, 0.3, 225], [-0.3, 0.3, 135]];   // z = a x + b y
  for (const [a, b, az] of cases) {
    const g = mk(12, 12, 10, 10, (x, y) => a * x + b * y), A = GA.aspect(g);
    interior(g, 0, (r, c, i) => { const d = Math.abs(((A[i] - az + 540) % 360) - 180); assert.ok(d < 1e-9, `a=${a} b=${b}: ${A[i]} vs ${az}`); });
  }
  const flat = GA.aspect(mk(5, 5, 1, 1, () => 3)); assert.ok(flat.every(v => Number.isNaN(v)), 'flat cell has no aspect');
});
test('slope: Horn weights on a non-planar surface (z = x^2) equal the analytic central value', () => {
  const g = mk(20, 20, 5, 5, x => x * x / 100), s = GA.slope(g);   // dz/dx = 2x/100, central differences exact for quadratics
  interior(g, 1, (r, c, i) => near(Math.tan(s[i] / DEG), 2 * (c * 5) / 100, 1e-12));
});

// ---- curvature
test('paraboloid z = k (x^2+y^2): curvature constants, convention positive = convex-up', () => {
  for (const k of [0.002, -0.002]) {
    const g = mk(41, 41, 10, 10, (x, y) => k * ((x - 200) ** 2 + (y - 200) ** 2)), C = GA.curvatures(g);
    interior(g, 1, (r, c, i) => {
      near(C.mean[i], -2 * k, 1e-12, 'mean');          // -(z_xx + z_yy)/2 = -2k
      const rr = Math.hypot(c * 10 - 200, (40 - r) * 10 - 200);
      if (rr > 15) { near(C.profile[i], -2 * k, 1e-12, 'profile'); near(C.plan[i], -2 * k, 1e-12, 'plan'); }
      near(C.gauss[i], 4 * k * k / (1 + 4 * k * k * rr * rr) ** 2, 1e-12, 'gauss');
    });
    near(C.gauss[at(g, 20, 20)], 4 * k * k, 1e-12, 'gauss at the apex');
  }
});
test('saddle z = k (x^2 - y^2): Gaussian curvature negative, mean zero', () => {
  const k = 0.001, g = mk(21, 21, 10, 10, (x, y) => k * ((x - 100) ** 2 - (y - 100) ** 2)), C = GA.curvatures(g);
  near(C.gauss[at(g, 10, 10)], -4 * k * k, 1e-12); near(C.mean[at(g, 10, 10)], 0, 1e-12);
});
test('a ridge (z = -|x|-like parabola along x) has positive plan curvature across, zero along the profile it climbs', () => {
  const g = mk(31, 31, 10, 10, (x, y) => -0.002 * (x - 150) ** 2 + 0.1 * y), C = GA.curvatures(g);   // dome across x, tilted along y
  const i = at(g, 15, 22);
  assert.ok(C.plan[i] > 0 && C.mean[i] > 0, 'convex-up gives positive');
});

// ---- TPI
test('TPI: plane = 0 in the interior, single spike > 0, hole < 0; square, disc and annulus', () => {
  const g = mk(41, 41, 10, 10, (x, y) => 0.4 * x - 0.1 * y + 50);
  for (const shape of ['square', 'disc', 'annulus']) {
    const T = GA.tpi(g, 5, shape, 2);
    interior(g, 5, (r, c, i) => near(T[i], 0, 1e-8, shape + ' plane'));
  }
  const s = mk(41, 41, 10, 10, () => 10); s.z[at(s, 20, 20)] = 25;
  for (const shape of ['square', 'disc', 'annulus']) {
    const T = GA.tpi(s, 4, shape, 1); near(T[at(s, 20, 20)], 15, 1e-9, shape + ' spike'); if (shape !== 'annulus') assert.ok(T[at(s, 20, 21)] < 0, 'neighbour of a spike is lower than its window mean');
  }
  s.z[at(s, 20, 20)] = 0; assert.ok(GA.tpi(s, 4, 'square')[at(s, 20, 20)] < 0);
});

// ---- rugosity
test('rugosity (Jenness): flat = 1, tilted plane = 1/cos(slope), also with a window and anisotropic cells', () => {
  const f = mk(20, 20, 10, 10, () => 7), R0 = GA.rugosity(f, 0), R2 = GA.rugosity(f, 2);
  interior(f, 0, (r, c, i) => { near(R0[i], 1, 1e-12); near(R2[i], 1, 1e-12) });
  const a = 0.5, b = 0.25, p = mk(20, 20, 20, 10, (x, y) => a * x + b * y), want = 1 / Math.cos(Math.atan(Math.hypot(a, b)));
  for (const R of [0, 1, 3]) { const Rg = GA.rugosity(p, R); interior(p, 1, (r, c, i) => near(Rg[i], want, 1e-12, 'R=' + R)); }
  const edge = GA.rugosity(p, 0); near(edge[0], want, 1e-12, 'corner cell (triangles inside the grid only)');
  const rough = mk(20, 20, 10, 10, (x, y) => ((x / 10 + y / 10) % 2) * 5); assert.ok(GA.rugosity(rough, 0)[at(rough, 10, 10)] > 1.2);
});

// ---- roughness
test('roughness: std of z and of plane residuals', () => {
  const p = mk(40, 40, 10, 10, (x, y) => 0.7 * x + 0.3 * y), S = GA.roughness(p, 4, 'std'), P = GA.roughness(p, 4, 'plane');
  interior(p, 4, (r, c, i) => { assert.ok(S[i] > 1); near(P[i], 0, 1e-6, 'plane residual of a plane') });
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const n = mk(60, 60, 10, 10, () => (rnd() - 0.5) * 2 * Math.sqrt(3)), Sn = GA.roughness(n, 5, 'std'); let mean = 0, k = 0;
  interior(n, 5, (r, c, i) => { mean += Sn[i]; k++ }); near(mean / k, 1, 0.05, 'unit-variance noise');
});

// ---- Mexican hat
test('Mexican hat: flat and planes give 0; a Gaussian bump (sigma b = 6 cells) responds most at the matching scale, amplitude A/2', () => {
  assert.ok(GA.cwt(mk(40, 40, 10, 10, () => 5), 3).every(v => Math.abs(v) < 1e-9));
  const pl = GA.cwt(mk(60, 60, 10, 10, (x, y) => 0.3 * x - 0.1 * y), 3); interior(GA.makeGrid(60, 60, 1, 1, 0, 0, pl), 12, (r, c, i) => near(pl[i], 0, 1e-9, 'plane'));
  const A = 10, b = 6, N = 129, g = mk(N, N, 10, 10, (x, y) => A * Math.exp(-((x - 640) ** 2 + (y - 640) ** 2) / (2 * (b * 10) ** 2)));
  const scales = [2, 3, 4, 5, 6, 7, 8, 10, 12, 16], c0 = at(g, 64, 64), resp = scales.map(s => GA.cwt(g, s)[c0]);
  const k = resp.indexOf(Math.max(...resp));
  assert.ok(Math.abs(scales[k] - b) <= 1, `peak scale ${scales[k]} vs ${b} (tolerance: one step of the scale list)`);
  near(resp[scales.indexOf(6)], A / 2, 0.05 * A / 2, 'response at s = b is A/2 within 5 %');
  for (const s of [3, 12]) near(resp[scales.indexOf(s)], 2 * A * s * s * b * b / (s * s + b * b) ** 2, 0.06, 'analytic response at s=' + s);
  assert.ok(GA.cwt(g, 6)[at(g, 64, 100)] < 0.5, 'far from the bump the response is ~0');
  const best = GA.compute(g, 'cwtbest', null, { scales })[c0]; assert.ok(Math.abs(best - b) <= 1);
});

// ---- fractal dimension
function fbm(N, H, seed) {   // spectral synthesis: |F(k)| ~ k^-(H+1), random phases, real part of the inverse FFT (periodic)
  const rnd = (() => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  const gs = () => { let u = 0; do { u = rnd() } while (!u); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  const re = new Float64Array(N * N), im = new Float64Array(N * N);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const kx = c <= N / 2 ? c : c - N, ky = r <= N / 2 ? r : r - N, k = Math.hypot(kx, ky); if (!k) continue; const a = Math.pow(k, -(H + 1)) * gs(), p = 2 * Math.PI * rnd(); re[r * N + c] = a * Math.cos(p); im[r * N + c] = a * Math.sin(p); }
  const fft1 = (xr, xi) => { const n = xr.length; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [xr[i], xr[j]] = [xr[j], xr[i]];[xi[i], xi[j]] = [xi[j], xi[i]]; } }
    for (let len = 2; len <= n; len <<= 1) { const ang = 2 * Math.PI / len; for (let i = 0; i < n; i += len) for (let j = 0; j < len / 2; j++) { const wr = Math.cos(ang * j), wi = Math.sin(ang * j), ur = xr[i + j], ui = xi[i + j], vr = xr[i + j + len / 2] * wr - xi[i + j + len / 2] * wi, vi = xr[i + j + len / 2] * wi + xi[i + j + len / 2] * wr; xr[i + j] = ur + vr; xi[i + j] = ui + vi; xr[i + j + len / 2] = ur - vr; xi[i + j + len / 2] = ui - vi; } } };
  const xr = new Float64Array(N), xi = new Float64Array(N);
  for (let r = 0; r < N; r++) { for (let c = 0; c < N; c++) { xr[c] = re[r * N + c]; xi[c] = im[r * N + c]; } fft1(xr, xi); for (let c = 0; c < N; c++) { re[r * N + c] = xr[c]; im[r * N + c] = xi[c]; } }
  for (let c = 0; c < N; c++) { for (let r = 0; r < N; r++) { xr[r] = re[r * N + c]; xi[r] = im[r * N + c]; } fft1(xr, xi); for (let r = 0; r < N; r++) { re[r * N + c] = xr[r]; } }
  return GA.makeGrid(N, N, 1, 1, 0, N - 1, re, 'fbm');
}
test('fractal dimension: plane = 2 (also tilted, anisotropic), fBm surfaces within 0.12 of 3 - H (lags 2,4,8, window 33 x 33)', () => {
  const D = GA.fractal(mk(100, 90, 10, 25, (x, y) => 0.4 * x + 0.1 * y), 8); interior(GA.makeGrid(100, 90, 1, 1, 0, 0, D), 26, (r, c, i) => near(D[i], 2, 1e-9, 'plane'));   // more than window + lag away from the edges: there the x and y pair counts differ between lags
  const F = GA.fractal(mk(30, 30, 1, 1, () => 4), 8); assert.ok(F.every(v => v === 2), 'flat = 2 by convention');
  for (const [H, seed] of [[0.3, 11], [0.5, 12], [0.8, 13]]) {
    const g = fbm(128, H, seed), Df = GA.fractal(g, 16, [2, 4, 8]); let s = 0, k = 0;
    interior(g, 16, (r, c, i) => { s += Df[i]; k++ });
    near(s / k, 3 - H, 0.12, `H=${H}: mean D ${(s / k).toFixed(3)}`);
  }
});

// ---- nulls
test('null masking: NaN stays within the window of the null, never spreads further', () => {
  const g = mk(41, 41, 10, 10, (x, y) => 0.2 * x + 0.1 * y + Math.sin(x / 50) * 3); const i0 = at(g, 20, 20); g.z[i0] = NaN;
  const nan = a => { let k = 0; const where = []; a.forEach((v, i) => { if (v !== v) { k++; where.push(i) } }); return { k, where } };
  const win = (R, i) => { const r = Math.floor(i / g.nx), c = i % g.nx; return Math.max(Math.abs(r - 20), Math.abs(c - 20)) <= R; };
  const lim = { slope: 0, aspect: 0, cprofile: 1, cplan: 1, cmean: 1, cgauss: 1, tpi: 0, rstd: 0, rplane: 0, rug: 0, cwt: 0, fractal: 0 };
  for (const a of GA.ATTRS) {
    if (a.id === 'cwtbest') continue;
    const out = GA.compute(g, a.id, a.scaled ? 4 : null, { shape: 'square', rin: 1, lags: [1, 2] }), { k, where } = nan(out);
    if (a.id === 'cprofile' || a.id === 'cplan' || a.id === 'cmean' || a.id === 'cgauss') {
      // curvatures: the outer ring (no 3x3 window) plus the null and its 8 neighbours
      const inner = where.filter(i => { const r = Math.floor(i / g.nx), c = i % g.nx; return r > 0 && c > 0 && r < g.ny - 1 && c < g.nx - 1; });
      assert.equal(inner.length, 9, a.id); assert.ok(inner.every(i => win(1, i)), a.id);
    } else if (a.id === 'aspect') { assert.equal(k, 1, 'aspect'); }   // the plane + sine has no flat cell
    else { assert.equal(k, 1, `${a.id}: ${k} NaN`); assert.equal(where[0], i0, a.id); }
    void lim;
  }
  // a block of nulls does not blank the valid cells around it for window attributes
  const h = mk(41, 41, 10, 10, (x, y) => 0.2 * x); for (let r = 15; r < 25; r++) for (let c = 15; c < 25; c++) h.z[at(h, r, c)] = NaN;
  const T = GA.tpi(h, 3, 'square'); let bad = 0; for (let r = 0; r < 41; r++) for (let c = 0; c < 41; c++) { const nul = r >= 15 && r < 25 && c >= 15 && c < 25; if (nul === (T[at(h, r, c)] === T[at(h, r, c)])) bad++; } assert.equal(bad, 0);
});

// ---- readers / writers
const sample = () => { const g = mk(37, 23, 25, 25, (x, y) => 1500 + 0.05 * x - 0.02 * y + 12 * Math.sin(x / 90) * Math.cos(y / 70)); g.x0 = 451000; g.y1 = 6781000; g.z[at(g, 3, 4)] = NaN; g.z[at(g, 22, 36)] = NaN; return g; };
const sameGrid = (a, b, tol) => { assert.equal(a.nx, b.nx); assert.equal(a.ny, b.ny); near(a.dx, b.dx, 1e-9 * a.dx); near(a.dy, b.dy, 1e-9 * a.dy); near(a.x0, b.x0, 1e-6); near(a.y1, b.y1, 1e-6); for (let i = 0; i < a.z.length; i++) { if (a.z[i] !== a.z[i]) assert.ok(b.z[i] !== b.z[i], 'null at ' + i); else near(b.z[i], a.z[i], tol, 'value ' + i); } };
test('ZMAP+ round trip, read back by this core and by the independent zmap-core reader; checker finds nothing', () => {
  const g = sample(), txt = GA.writeZmap(g, { label: 'TOP_TEST' });
  sameGrid(g, GA.parseZmap(txt), 1e-6);
  const z = ZMAP.parse(txt, 'x.zmap'), f = ZMAP.check(z).filter(x => x.sev !== 'I');
  assert.equal(f.length, 0, f.map(x => x.rule + ' ' + x.msg).join('; '));
  assert.equal(z.nrows, 23); assert.equal(z.ncols, 37); near(z.dx, 25, 1e-9);
  for (let r = 0; r < 23; r++) for (let c = 0; c < 37; c++) { const v = ZMAP.value(z, r, c), w = g.z[at(g, r, c)]; if (w !== w) assert.ok(ZMAP.isNull(z, v)); else near(v, w, 1e-6); }
  const small = mk(8, 6, 10, 10, (x, y) => 1e-5 * x * y);   // tiny values: decimals adapt
  sameGrid(small, GA.parseZmap(GA.writeZmap(small)), 1e-12);
  const wide = GA.makeGrid(7, 5, 12.5, 12.5, 100, 200, Float64Array.from({ length: 35 }, (_, i) => -2000 - i * 0.123456789), 'w');   // 5 rows, npl = 5: one line per column
  sameGrid(wide, GA.parseZmap(GA.writeZmap(wide)), 1e-4);
});
test('Surfer ASCII (DSAA) and Esri ASCII round trips; autodetection', () => {
  const g = sample(); sameGrid(g, GA.parseGrid(GA.writeSurfer(g)), 1e-6); sameGrid(g, GA.parseGrid(GA.writeEsri(g)), 1e-6);
  assert.ok(/^DSAA/.test(GA.writeSurfer(g))); assert.ok(/ncols 37/.test(GA.writeEsri(g)));
  assert.ok(GA.writeEsri(g).includes('xllcorner ' + (451000 - 12.5)));
  sameGrid(g, GA.parseGrid(GA.writeZmap(g)), 1e-6);
  const an = GA.makeGrid(6, 4, 10, 20, 0, 60, Float64Array.from({ length: 24 }, (_, i) => i), 'an'); sameGrid(an, GA.parseGrid(GA.writeEsri(an)), 1e-9);
});
test('x y z text on a lattice (comma, header line, missing nodes)', () => {
  const g = sample(), L = ['x,y,z']; for (let r = 0; r < g.ny; r++) for (let c = 0; c < g.nx; c++) { const v = g.z[at(g, r, c)]; if (v === v) L.push(`${g.x0 + c * g.dx},${g.y1 - r * g.dy},${v}`); }
  L.sort(() => 0); sameGrid(g, GA.parseGrid(L.join('\n')), 1e-9);
  assert.throws(() => GA.parseGrid('0 0 1\n1.3 0 2\n0 1.7 3\n1.3 1.7 4\n0.4 0.9 5\n0.77 0.2 1\n'), /lattice|cell size|regular/);
});
test('readers reject broken files', () => {
  assert.throws(() => GA.parseZmap('hello'), /@/);
  const t = GA.writeZmap(sample()).replace(/\r\n/g, '\n').split('\n'); t.splice(20, 1);
  assert.throws(() => GA.parseZmap(t.join('\n')), /values/);
  assert.throws(() => GA.parseSurfer('DSAA\n3 3\n0 2\n0 2\n0 1\n1 2 3'), /values/);
});
test('example grid: fictitious, has nulls and structure; degrees warning', () => {
  const e = GA.example(), st = GA.stats(e.z); assert.ok(st.n < e.z.length && st.n > 0.9 * e.z.length && st.std > 10);
  assert.ok(GA.looksLikeDegrees(GA.makeGrid(10, 10, 0.01, 0.01, 5, 50, new Float64Array(100)))); assert.ok(!GA.looksLikeDegrees(e));
});
test('attribute registry runs on the example and statistics are finite', () => {
  const e = GA.example(120, 90); const rows = GA.summary(e, [2, 4], { shape: 'square', rin: 1, lags: [1, 2, 4], scales: [2, 4] });
  assert.ok(rows.length >= 13 && rows.every(r => r.n > 0 && Number.isFinite(r.mean)), JSON.stringify(rows.filter(r => !(r.n > 0 && Number.isFinite(r.mean)))));
  const sl = rows.find(r => r.id === 'slope'); assert.ok(sl.mean > 0 && sl.mean < 20);
});
test('performance: 1000 x 1000 grid, one attribute each (soft limit 6 s)', () => {
  const g = mk(1000, 1000, 10, 10, (x, y) => 50 * Math.sin(x / 700) * Math.cos(y / 900) + 3 * Math.sin(x / 31 + y / 17)); const times = [];
  for (const [id, s] of [['slope', null], ['cmean', null], ['tpi', 8], ['rstd', 8], ['rplane', 8], ['rug', 3], ['cwt', 6], ['fractal', 8]]) { const t = Date.now(); const out = GA.compute(g, id, s, { shape: 'square', lags: [1, 2, 4] }); const dt = Date.now() - t; times.push(`${id} ${dt} ms`); assert.ok(out.length === 1e6 && dt < 6000, `${id} took ${dt} ms`); }
  console.log('     ' + times.join(', '));
});

// ---- depth positive down (review fix)
test('depth positive downward: applyZ(depth=true) gives the true dip azimuth and curvature sign; looksLikeDepth warns', () => {
  const d = mk(12, 12, 10, 10, (x, y) => 2000 + 0.5 * x);            // depth grows eastward: surface dips WEST (270 as a raw elevation), real dip is toward the deeper side = east (90)
  const raw = GA.aspect(d); near(raw[at(d, 5, 5)], 270, 1e-9, 'raw (wrong for a depth)');
  assert.equal(GA.looksLikeDepth(d), true, 'all-positive grid flagged');
  const f = GA.applyZ(d, 1, true), A = GA.aspect(f);
  near(A[at(f, 5, 5)], 90, 1e-9, 'aspect after depth sign');
  assert.equal(GA.looksLikeDepth(f), false, 'negative values are not flagged');
  assert.equal(GA.applyZ(d, 0.3048, false).z[0], d.z[0] * 0.3048);
  assert.equal(GA.applyZ(d, 0.3048, true).z[0], -d.z[0] * 0.3048);
  const bowl = mk(21, 21, 10, 10, (x, y) => 1000 + 0.002 * ((x - 100) ** 2 + (y - 100) ** 2));   // depth bowl = structural high? values grow outward => as depth it is a dome (crest, positive)
  near(GA.curvatures(GA.applyZ(bowl, 1, true)).mean[at(bowl, 10, 10)], 0.004, 1e-12, 'convex-up crest after sign flip');
});
test('scaleDistance text shows both cell sizes', () => {
  assert.equal(GA.scaleDistTxt(4, 25, 25), '4 cells (100 map units)');
  assert.equal(GA.scaleDistTxt(4, 25, 10), '4 cells (100 × 40 map units, x × y)');
});

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ', name); }
  catch (e) { fail++; console.log('FAIL ', name, '\n     ', e.message.split('\n').slice(0, 6).join('\n      ')); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
