// Self-check for the thermal maturity core (docs/maturity/index.html, <script id="mat-core">).
// Run: node scripts/maturity_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../docs/maturity/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="mat-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'mat-core script block not found');
const ctx = { window: {} };
vm.runInNewContext(m[1], ctx);
const DG = ctx.window.DG;

// ---- independent reference: EASY%Ro written from Sweeney & Burnham (1990, Table 1) parameters, brute-force integration
// (exact first-order decay over 0.01 K sub-steps at the mid temperature; no temperature-integral approximation).
const REF_E = [34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72];
const REF_F = [.03, .03, .04, .04, .05, .05, .06, .04, .04, .07, .06, .06, .06, .05, .05, .04, .03, .02, .02, .01];
const R_KCAL = 1.98720425864083e-3, MYR_S = 365.25 * 86400 * 1e6;
function refEasy(rate, Tend) { // linear heating from 20 °C at `rate` °C/Myr, returns {T: %Ro} every 10 °C
  const w = REF_E.map(() => 1), dT = 0.01, dt = dT / rate * MYR_S, out = {};
  for (let k = 1, n = Math.round((Tend - 20) / dT); k <= n; k++) {
    const Tk = 20 + (k - 0.5) * dT + 273.15;
    for (let i = 0; i < REF_E.length; i++) w[i] *= Math.exp(-1e13 * Math.exp(-REF_E[i] / (R_KCAL * Tk)) * dt);
    if (k % 1000 === 0) { let F = 0; for (let i = 0; i < REF_E.length; i++) F += REF_F[i] * (1 - w[i]); out[20 + k * dT] = Math.exp(-1.6 + 3.7 * F); }
  }
  return out;
}
// page model at a constant heating rate, from 20 °C, %Ro every 1 °C
function pageCurve(M, rate, Tend) {
  const s = DG.integrate([{ t: 0, T: 20 }, { t: (Tend - 20) / rate, T: Tend }], false, false, [M]);
  const out = {}; for (const q of s) out[Math.round(q.T)] = q.Ro[M.id]; return out;
}
const tAt = (curve, ro) => { const ks = Object.keys(curve).map(Number).sort((a, b) => a - b); for (const k of ks) if (curve[k] >= ro) return k; return NaN; };
const final = (rows, ms, age = true) => DG.integrate(rows, age, true, ms || [DG.EASY]).at(-1);
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (tol ${tol})`);

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// ---- kinetics
test('EASY%Ro parameters: 20 reactions 34-72 kcal/mol, factors sum 0.85, A = 1e13 /s, Ro(F=0) = 0.20', () => {
  assert.deepEqual([...DG.EASY.EA], REF_E);
  assert.deepEqual([...DG.EASY.FR], REF_F);
  assert.equal(DG.EASY.A, 1e13);
  close(DG.RoOf(0, DG.EASY), Math.exp(-1.6), 1e-12, 'Ro at F=0');
  close(DG.RoOf(0.85, DG.EASY), 4.69, 0.005, 'Ro at F=0.85');
});
test('EASY%Ro at 1, 2, 10 °C/Myr matches the independent brute-force integration within 0.005 %Ro', () => {
  for (const r of [1, 2, 10]) {
    const ref = refEasy(r, 250), pg = pageCurve(DG.EASY, r, 250);
    for (const T of [60, 80, 100, 120, 140, 160, 180, 200, 220, 240]) close(pg[T], ref[T], 0.005, `${r} °C/Myr, ${T} °C`);
  }
});
test('EASY%Ro at 1 °C/Myr: plausibility ranges 0.5 %Ro at 80-100 °C, 1.0 at 135-150 °C, 2.0 at 180-200 °C (not numbers stated in the paper)', () => {
  const c = pageCurve(DG.EASY, 1, 260);
  const t05 = tAt(c, 0.5), t1 = tAt(c, 1.0), t2 = tAt(c, 2.0);
  assert.ok(t05 >= 80 && t05 <= 100, `0.5 %Ro at ${t05}`); assert.ok(t1 >= 135 && t1 <= 150, `1.0 %Ro at ${t1}`); assert.ok(t2 >= 180 && t2 <= 200, `2.0 %Ro at ${t2}`);
});
test('very slow (0.1 °C/Myr) and very fast (1000 °C/Myr) heating agree with brute force within 0.005 %Ro', () => {
  for (const r of [0.1, 1000]) { const ref = refEasy(r, 250), pg = pageCurve(DG.EASY, r, 250); for (const T of [100, 150, 200, 250]) close(pg[T], ref[T], 0.005, `${r} °C/Myr ${T} °C`); }
});
test('isothermal step: 100 Myr at 100 °C equals the exact first-order solution', () => {
  let F = 0; for (let i = 0; i < 20; i++) F += REF_F[i] * (1 - Math.exp(-1e13 * Math.exp(-REF_E[i] / (R_KCAL * 373.15)) * 100 * MYR_S));
  close(final([{ t: 100, T: 100 }, { t: 0, T: 100 }]).Ro.easy, Math.exp(-1.6 + 3.7 * F), 0.001, 'iso Ro');
  // a near-isothermal segment (0.002 °C change) is not treated differently
  close(final([{ t: 100, T: 100 }, { t: 0, T: 100.002 }]).Ro.easy, Math.exp(-1.6 + 3.7 * F), 0.001, 'near-iso Ro');
});
test('1 Myr = 3.15576e13 s', () => close(DG.SEC_MA, MYR_S, 1, 'SEC_MA'));
test('convergence: subdividing the rows of a history does not change %Ro (< 0.002)', () => {
  const coarse = [{ t: 150, T: 20 }, { t: 80, T: 140 }, { t: 30, T: 165 }, { t: 0, T: 90 }];
  const fine = []; for (let j = 0; j < coarse.length - 1; j++) { const a = coarse[j], b = coarse[j + 1]; for (let k = 0; k < 10; k++) fine.push({ t: a.t + (b.t - a.t) * k / 10, T: a.T + (b.T - a.T) * k / 10 }); } fine.push(coarse.at(-1));
  for (const M of DG.MODELS) close(final(coarse, [M]).Ro[M.id], final(fine, [M]).Ro[M.id], 0.002, M.name);
});
test('%Ro never decreases during cooling / uplift (all models)', () => {
  const s = DG.integrate([{ t: 100, T: 20 }, { t: 50, T: 180 }, { t: 20, T: 20 }, { t: 0, T: 60 }], true, true, DG.MODELS);
  for (let i = 1; i < s.length; i++) for (const M of DG.MODELS) assert.ok(s[i].Ro[M.id] >= s[i - 1].Ro[M.id] - 1e-12, `${M.id} decreases at ${i}`);
});
test('age and elapsed-time conventions give the same result', () => {
  const a = final([{ t: 100, T: 20 }, { t: 40, T: 150 }, { t: 0, T: 110 }], null, true), f = final([{ t: 0, T: 20 }, { t: 60, T: 150 }, { t: 100, T: 110 }], null, false);
  close(a.Ro.easy, f.Ro.easy, 1e-12, 'Ro'); close(a.tti, f.tti, 1e-9, 'TTI');
});

// ---- published reference values read in Sweeney & Burnham (1990, AAPG Bull. 74, 1559-1570)
test('Table 1 and eq. 1 as printed: factors sum 0.85, maximum %Ro 4.7 (F = 0.85), 3.145 = 0.85 x 3.7, stated range 0.3-4.5 %Ro', () => {
  close(DG.EASY.FR.reduce((a, b) => a + b, 0), 0.85, 1e-9, 'sum of factors');
  close(DG.RoOf(0.85, DG.EASY), 4.7, 0.02, 'maximum %Ro ("4.7%")');
  close(0.85 * 3.7, 3.145, 1e-12, 'rescaled exponent');
  close(DG.RoOf(0, DG.EASY), 0.2, 0.005, 'initial %Ro');
});
test('Fig. 8 spreadsheet of the paper (printed F and %Ro): 2 °C/Myr to 60 °C, 1 °C/Myr to 140 °C, cooling, 0.1 °C step, 1.5 °C/Myr to 180 °C', () => {
  const H = [[0, 20], [20, 60], [40, 80], [60, 100], [80, 120], [100, 140], [120, 100], [140, 59.9], [160, 60], [180, 90], [200, 120], [220, 150], [240, 180]];
  const s = DG.integrate(H.map(([t, T]) => ({ t, T })), false, false, [DG.EASY]), at = t => s.find(q => q.t === t && q.node >= 0);
  // F as printed (3 digits) and %Ro as printed (2 digits). The sheet uses 3.16e13 s per Myr, the page 3.15576e13 (0.1 %): negligible.
  const P = [[0, 0, 0.20], [20, 0.150, 0.35], [40, 0.225, 0.46], [60, 0.298, 0.61], [100, 0.415, 0.94], [120, 0.427, 0.98], [220, 0.461, 1.11], [240, 0.565, 1.64]];
  for (const [t, F, Ro] of P) { close(at(t).F.easy, F, 0.0015, 'F at ' + t + ' Myr'); close(at(t).Ro.easy, Ro, 0.006, '%Ro at ' + t + ' Myr'); }
  close(at(80).Ro.easy, 0.74, 0.006, '%Ro at 80 Myr');
});
test('isothermal nomogram (Fig. 5 and text): 10 Myr at 110 °C gives 0.7 %Ro, at 162 °C 1.3 %Ro, at 189 °C 2.0 %Ro (text); 1 and 100 Myr lines read on the figure', () => {
  const Tfor = (ro, t) => { let lo = 20, hi = 400; for (let i = 0; i < 50; i++) { const T = (lo + hi) / 2; (final([{ t, T }, { t: 0, T }]).Ro.easy < ro ? (lo = T) : (hi = T)); } return lo; };
  for (const [ro, T] of [[0.7, 110], [1.3, 162], [2.0, 189]]) close(Tfor(ro, 10), T, 5, `10 Myr, ${ro} %Ro`);   // text: "about 100 °C ... 110 °C", "162 and 189 °C"
  for (const [ro, T] of [[0.7, 124], [1.3, 174], [2.0, 206], [3.0, 241]]) close(Tfor(ro, 1), T, 5, `1 Myr, ${ro} %Ro`);   // read on the figure
  for (const [ro, T] of [[0.7, 98], [1.3, 145], [2.0, 174], [3.0, 205]]) close(Tfor(ro, 100), T, 6, `100 Myr, ${ro} %Ro`);  // read on the figure
});
test('Fig. 4 text: oil window (0.65-1.30 %Ro) lies at TTI 20-1000 at 1 °C/Myr and 1.5-100 at 100 °C/Myr (within a factor 1.6; values read in a log chart)', () => {
  for (const [r, lo, hi] of [[1, 20, 1000], [100, 1.5, 100]]) {
    const s = DG.integrate([{ t: 0, T: 20 }, { t: 400 / r, T: 420 }], false, true, [DG.EASY]);
    const a = s.find(q => q.Ro.easy >= 0.65).tti, b = s.find(q => q.Ro.easy >= 1.3).tti;
    assert.ok(a / lo < 1.6 && lo / a < 1.6, `TTI at 0.65 %Ro, ${r} °C/Myr: ${a} vs ${lo}`); assert.ok(b / hi < 1.6 && hi / b < 1.6, `TTI at 1.30 %Ro, ${r} °C/Myr: ${b} vs ${hi}`);
  }
});
// ---- Kaneki & Noda (2020, J. Geol. Soc. Japan 126, 655-661): their eq. 14 (Tmax from Ro, Table 2 coefficients, rows t_d = 1 and 10 Myr, constant T)
// was fitted on an independent Python EASY%Ro (T0 = 0 °C); they report errors below 3 °C. Boxcar history = t_d at Tmax.
test('Kaneki & Noda (2020) eq. 14 recovers Tmax from the page %Ro within 3 °C (boxcar of 1 and 10 Myr, 60-300 °C, 0.3-4.6 %Ro)', () => {
  const C = { 1: [89.6217, 157.8367, 73.5687, 155.3964, 43.2171, 5.1890, 228.4330], 10: [86.4091, 142.3313, 70.9247, 139.9326, 41.6867, 5.1936, 210.4055] };
  const tm = (R, c) => R < 0.95 ? c[0] * Math.log(R) + c[1] : R < 2.23 ? c[2] * Math.log(R) + c[3] : c[4] * Math.log(R / (c[5] - R)) + c[6];
  let n = 0;
  for (const td of [1, 10]) for (let T = 60; T <= 300; T += 5) {
    const Ro = final([{ t: td, T }, { t: 0, T }]).Ro.easy; if (Ro < 0.3 || Ro > 4.6) continue; n++;
    assert.ok(Math.abs(tm(Ro, C[td]) - T) < 3, `td ${td} Myr, ${T} °C: Ro ${Ro.toFixed(3)} -> ${tm(Ro, C[td]).toFixed(1)}`);
  }
  assert.ok(n > 80, 'enough points compared');
});

// ---- Easy%RoDL and Basin%Ro: compared with published figures (no table found), see Method & sources
test('Easy%RoDL (Burnham 2017 preprint, Fig. 4: bar chart, sum 0.95, %Ro = 0.223 exp(3.7 F)): A = 2e14 /s, 20 reactions 38-76 kcal/mol, factors sum 0.95, Ro(F=0) = 0.223', () => {
  assert.equal(DG.DL.A, 2e14); assert.equal(DG.DL.EA[0], 38); assert.equal(DG.DL.EA.at(-1), 76);
  close(DG.DL.FR.reduce((a, b) => a + b, 0), 0.95, 1e-9, 'sum'); close(DG.RoOf(0, DG.DL), 0.223, 0.0005, 'Ro0');
});
test('2 °C/Myr (Burnham 2019 Fig.): EASY above Easy%RoDL and Basin%Ro at 125 °C, below them at 225 °C; all within 0.6-0.8 at 125 °C and 2.5-3.6 at 225 °C', () => {
  const c = {}; for (const M of DG.MODELS) c[M.id] = pageCurve(M, 2, 230);
  for (const id of ['dl', 'basin']) { assert.ok(c.easy[125] > c[id][125], `125 °C ${id}`); assert.ok(c.easy[225] < c[id][225], `225 °C ${id}`); }
  for (const id of ['easy', 'dl', 'basin']) { assert.ok(c[id][125] > 0.55 && c[id][125] < 0.8, `${id} 125 °C ${c[id][125]}`); assert.ok(c[id][225] > 2.5 && c[id][225] < 3.6, `${id} 225 °C ${c[id][225]}`); }
});
test('Basin%Ro: largest EASY - Basin difference between 0.5 and 1.7 %Ro at 3 °C/Myr is 0.35 ± 0.05 (Nielsen et al. abstract)', () => {
  const e = pageCurve(DG.EASY, 3, 250), b = pageCurve(DG.BASIN, 3, 250); let mx = 0;
  for (const T in e) if (e[T] >= 0.5 && e[T] <= 1.7) mx = Math.max(mx, e[T] - b[T]);
  close(mx, 0.35, 0.05, 'max difference');
});

// ---- TTI (Lopatin; Waples 1980): sum of dt (Myr) x 2^n, n = 0 for 100-110 °C
test('TTI: linear 20 -> 220 °C over 100 Myr = 5 x (2^12 - 2^-8); isothermal 100 Myr at 100 °C = 100', () => {
  close(final([{ t: 100, T: 20 }, { t: 0, T: 220 }]).tti, 5 * (4096 - 1 / 256), 1e-6, 'ramp');
  close(final([{ t: 100, T: 100 }, { t: 0, T: 100 }]).tti, 100, 1e-9, 'iso 100');
  close(final([{ t: 100, T: 99.9 }, { t: 0, T: 99.9 }]).tti, 50, 1e-9, 'iso 99.9');
});
test('TTI is exact when a segment changes by less than 1 °C across a class boundary (99.5 -> 100.5 °C in 10 Myr = 7.5)', () => {
  close(final([{ t: 10, T: 99.5 }, { t: 0, T: 100.5 }]).tti, 7.5, 1e-9, 'TTI');
});

// ---- table preparation
const rec = (g, t, T) => ({ g, t, T, z: NaN });
test('auto time convention: an "Age" column is an age even when the youngest row comes first', () => {
  const p = DG.prepare([rec('h', 0, 20), rec('h', 10, 150), rec('h', 100, 20)], 'auto', 'Age (Ma)');
  assert.equal(p.groups.length, 1); assert.equal(p.groups[0].age, true);
  assert.deepEqual([...p.groups[0].rows.map(r => r.t)], [100, 10, 0]);
});
test('auto time convention is the same for every group (decided once for the table)', () => {
  const p = DG.prepare([rec('A', 100, 20), rec('A', 0, 120), rec('B', 0, 120), rec('B', 100, 20)], 'auto', 'col 1');
  assert.deepEqual([...p.groups.map(o => o.age)], [true, true]);
  close(final(p.groups[1].rows, null, p.groups[1].age).Ro.easy, final(p.groups[0].rows, null, true).Ro.easy, 1e-12, 'B = A');
});
test('elapsed-time column ("Time", increasing) is read as elapsed time', () => {
  const p = DG.prepare([rec('h', 0, 20), rec('h', 100, 120)], 'auto', 'Time (Ma)');
  assert.equal(p.groups[0].age, false);
});
test('two rows at the same age = instantaneous temperature change, kept in file order', () => {
  const p = DG.prepare([rec('h', 100, 20), rec('h', 50, 150), rec('h', 50, 60), rec('h', 0, 60)], 'auto', 'Age');
  const o = p.groups[0]; assert.equal(o.rows.length, 4); assert.equal(o.dupT, 1);
  const s = DG.integrate(o.rows, o.age, true, [DG.EASY]);
  const ref = DG.integrate([{ t: 100, T: 20 }, { t: 50, T: 150 }], true, true, [DG.EASY]).at(-1);
  close(s.at(-1).Ro.easy, ref.Ro.easy, 0.002, 'no extra maturation after the jump to 60 °C');
  for (let j = 0; j < 4; j++) assert.ok(s.some(q => q.node === j), `row ${j} has a result`);
  assert.equal(s.find(q => q.node === 2).T, 60);
});
test('column guess: "z (m)" is depth, "T (K)" sets kelvin, a °C header sets celsius', () => {
  assert.deepEqual([...DG.guessCols(['Age', 'z (m)', 'Tc'])], [0, 2, 1, -1, 'C']);
  assert.equal(DG.guessCols(['Age', 'T (K)'])[4], 'K');
  assert.equal(DG.guessCols(['Age (Ma)', 'Temperature (°C)'])[4], 'C');
});

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ', name); }
  catch (e) { fail++; console.log('FAIL ', name, '\n     ', e.message.split('\n').slice(0, 6).join('\n      ')); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
