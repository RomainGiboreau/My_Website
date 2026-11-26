// Check of the constants of the Rock-Eval QC page (docs/rockeval/index.html, <script id="re-core">) and of the Source rock
// potential page (docs/source/index.html, <script id="src-core">) against the values read in Peters (1986),
// AAPG Bulletin 70(3), 318-329 (Reference_PDF/Peters_86.pdf). Transcription check, not an independent implementation.
// Run: node scripts/rockeval_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const load = (page, id, names) => {
  const html = readFileSync(new URL(`../docs/${page}/index.html`, import.meta.url), 'utf8');
  const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`));
  assert.ok(m, `${id} script block not found`);
  const ctx = {};
  vm.runInNewContext(m[1] + `\nthis.OUT={${names}};`, ctx);
  return { html, out: ctx.OUT };
};
// vm contexts have their own Array/Object prototypes: compare through JSON
const eq = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
const tests = [];
const test = (n, f) => tests.push([n, f]);

const re = load('rockeval', 're-core', 'PETERS,FIG5,ABQ,TYPE_IV');
const src = load('source', 'src-core', 'PETERS,DEF,NAMES,classOf');
const P = re.out.PETERS;

// ---- Peters (1986) tables, as read in the PDF
test('Table 1: TOC 0.5/1/2 wt %, S1 0.5/1/2, S2 2.5/5/10 (poor, fair, good, very good)', () => {
  eq(P.toc, [0.5, 1, 2]); eq(P.s1, [0.5, 1, 2]); eq(P.s2, [2.5, 5, 10]);
});
test('Table 2: HI 150/300 mg HC/g TOC, S2/S3 3/5', () => { eq(P.hi, [150, 300]); eq(P.s2s3, [3, 5]); });
test('Table 3: PI 0.1 / 0.4, Tmax 435-445 / 470 C, Ro 0.6 / 1.4 %', () => {
  assert.equal(P.pi.top, 0.1); assert.equal(P.pi.bottom, 0.4);
  eq(P.tmax, { immature: 435, topHi: 445, bottom: 470 }); eq(P.ro, { top: 0.6, bottom: 1.4 });
});
test('text: PI > 0.2 for immature rock = contamination; Tmax unreliable for S2 < 0.2; TOC about 0.5 wt % low limit', () => {
  assert.equal(P.pi.contam, 0.2); assert.equal(P.s2minTmax, 0.2); assert.equal(P.tocLow, 0.5);
});

// ---- Figure 5 pathways (read off the figure): ordering, ranges and the features visible on the figure
test('Figure 5: type I rises steeply at OI < 35 up to HI ~ 900+, II tops out near 610, III stays below 80', () => {
  const { I, II, III } = re.out.FIG5;
  assert.ok(Math.max(...I.map(p => p[1])) >= 900 && Math.max(...I.map(p => p[0])) <= 35);
  assert.ok(Math.max(...II.map(p => p[1])) >= 600 && Math.max(...II.map(p => p[1])) <= 620);
  assert.ok(Math.max(...III.map(p => p[1])) <= 80 && Math.max(...III.map(p => p[0])) >= 150 && Math.max(...III.map(p => p[0])) <= 200);
  for (const c of [I, II, III]) for (let i = 1; i < c.length; i++) assert.ok(c[i][0] > c[i - 1][0], 'OI increasing along the path');
  // type II lies between I and III in HI at equal OI (I is only defined up to OI 30)
  assert.ok(re.out.FIG5.II[2][1] > Math.max(...III.map(p => p[1])) * 5);
});
test('HI-OI abaque uses the published pathways for I, II, III; IV is tagged schematic', () => {
  const h = re.out.ABQ.hiOI;
  eq(h[0][2], re.out.FIG5.I); eq(h[1][2], re.out.FIG5.II); eq(h[2][2], re.out.FIG5.III);
  assert.match(h[3][0], /schematic/);
});
test('Ro lines on HI-Tmax: Jarvie et al. (2001) relation Ro = 0.0180 Tmax - 7.16 (not Peters; differs by ~5 C from Table 3 at Ro 1.4)', () => {
  const T = re.out.ABQ.roT;
  assert.ok(Math.abs(T(0.6) - 431.11) < 0.1); assert.ok(Math.abs(T(1.4) - 475.56) < 0.1); eq(re.out.ABQ.roList, [0.6, 1.0, 1.4]);
});

// ---- the Rock-Eval page uses the published constants for its default rules
test('Rock-Eval rules default to the Peters values', () => {
  const h = re.html;
  assert.match(h, /id:'s2low'[^\n]*PETERS\.s2minTmax/);
  assert.match(h, /id:'toclow'[^\n]*PETERS\.tocLow/);
  assert.match(h, /id:'picont'[^\n]*PETERS\.tmax\.immature[^\n]*PETERS\.pi\.contam/);
});

// ---- Source rock potential page
test('Source page defaults = Peters (1986) tables', () => {
  const { DEF, PETERS: SP } = src.out;
  eq(DEF.toc, [0.5, 1, 2]); eq(DEF.s1, [0.5, 1, 2]); eq(DEF.s2, [2.5, 5, 10]);
  eq(DEF.hi, [150, 300]); eq(DEF.tmax, [435, 470]);
  for (const k of ['toc', 's1', 's2']) eq(SP[k], P[k]);
  eq(SP.hi, P.hi); eq(SP.tmax, [P.tmax.immature, P.tmax.bottom]);
});
test('Source page classes: boundaries and names', () => {
  const { DEF, NAMES, classOf } = src.out, c = (v, k) => classOf(v, DEF[k], NAMES[k]);
  assert.equal(c(0.3, 'toc'), 'poor'); assert.equal(c(0.5, 'toc'), 'fair'); assert.equal(c(1, 'toc'), 'good');
  assert.equal(c(2, 'toc'), 'very good'); assert.equal(c(9, 'toc'), 'very good');
  assert.equal(c(2.4, 's2'), 'poor'); assert.equal(c(2.5, 's2'), 'fair'); assert.equal(c(5, 's2'), 'good'); assert.equal(c(10, 's2'), 'very good');
  assert.equal(c(100, 'hi'), 'gas prone'); assert.equal(c(150, 'hi'), 'gas and oil'); assert.equal(c(299, 'hi'), 'gas and oil'); assert.equal(c(300, 'hi'), 'oil prone');
  assert.equal(c(430, 'tmax'), 'immature'); assert.equal(c(435, 'tmax'), 'oil window'); assert.equal(c(469, 'tmax'), 'oil window'); assert.match(c(471, 'tmax'), /wet gas/);
  assert.equal(c(NaN, 'toc'), '–');
  for (const k of Object.keys(DEF)) assert.equal(NAMES[k].length, DEF[k].length + 1, k + ': one more class than limits');
});

let fail = 0;
for (const [n, f] of tests) { try { f(); console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } }
console.log(fail ? `${fail} failure(s)` : `all ${tests.length} tests passed`);
process.exit(fail ? 1 : 0);
