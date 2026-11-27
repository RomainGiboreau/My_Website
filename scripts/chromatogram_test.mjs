// Regression test for docs/chromatogram/index.html (the page has no separate core block:
// the main <script> is run in a vm with a stub DOM, then loadText()/compute() are driven directly).
// Run: node scripts/chromatogram_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../docs/chromatogram/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const main = scripts.find(s => s.includes('function parseChrom'));
assert.ok(main, 'main script not found');

// ids of the form <... id="x" ... value="v"> -> default values; checkboxes -> checked
const defaults = {}, checks = {};
for (const m of html.matchAll(/<input\b[^>]*>/g)) {
  const id = (m[0].match(/\bid="([^"]+)"/) || [])[1]; if (!id) continue;
  if (/type="checkbox"/.test(m[0])) checks[id] = /\bchecked\b/.test(m[0]);
  else defaults[id] = (m[0].match(/\bvalue="([^"]*)"/) || [, ''])[1];
}
defaults.bmode = 'auto'; defaults.tu = 'min'; defaults.ct = '0'; defaults.cs = '1';

function makePage() {
  const els = {};
  const mk = id => {
    const e = { id, value: defaults[id] ?? '', checked: !!checks[id], textContent: '', innerHTML: '', className: '', style: {}, dataset: {},
      classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {}, getContext: () => new Proxy({}, { get: () => () => ({ width: 10 }), set: () => true }),
      getBoundingClientRect: () => ({ left: 0, top: 0 }), appendChild() {}, setAttribute() {}, click() {}, querySelectorAll: () => [], clientWidth: 800, clientHeight: 400 };
    return e;
  };
  const document = { getElementById: id => els[id] || (els[id] = mk(id)), createElement: () => mk('x'), querySelectorAll: () => [], addEventListener() {}, body: { appendChild() {} } };
  const window = { addEventListener() {}, devicePixelRatio: 1 };
  const ctx = { document, window, console, setTimeout: () => 0, clearTimeout() {}, Float64Array, URL: { createObjectURL: () => '' }, Blob: class {}, navigator: {}, FileReader: class {}, localStorage: {} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(main + '\n;globalThis.__D=D;globalThis.__loadText=loadText;globalThis.__compute=compute;globalThis.__els=(id)=>document.getElementById(id);', ctx);
  return { D: ctx.__D, load: ctx.__loadText, el: ctx.__els, compute: ctx.__compute };
}

const tests = [];
const test = (n, f) => tests.push([n, f]);
const close = (a, b, tol, w) => assert.ok(Math.abs(a - b) <= tol, `${w}: ${a} vs ${b} (tol ${tol})`);

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const gauss = (t, mu, s, h) => h * Math.exp(-0.5 * ((t - mu) / s) ** 2);
function text(n, dt, f) { const L = ['Time (min)\tSignal']; for (let i = 0; i < n; i++) L.push(`${(i * dt).toFixed(4)}\t${f(i * dt, i).toFixed(4)}`); return L.join('\n'); }
const area = (h, s) => h * s * Math.sqrt(2 * Math.PI);

test('areas of synthetic Gaussians within 1 % of h*sigma*sqrt(2pi)', () => {
  const pg = makePage(), pk = [[3, 0.05, 1000], [6, 0.08, 3000], [9, 0.1, 500]];
  pg.load(text(1501, 0.01, t => 50 + pk.reduce((a, [m, s, h]) => a + gauss(t, m, s, h), 0)));
  assert.equal(pg.D.peaks.length, 3);
  pk.forEach(([m, s, h], i) => { close(pg.D.peaks[i].rt, m, 0.01, 'rt'); close(pg.D.peaks[i].area / area(h, s), 1, 0.01, 'area ratio'); });
});

test('two peaks 4 sigma apart are separated, areas within 3 %', () => {
  const pg = makePage(), s = 0.05;
  pg.load(text(1201, 0.01, t => 20 + gauss(t, 5, s, 1000) + gauss(t, 5 + 4 * s, s, 1000)));
  assert.equal(pg.D.peaks.length, 2, 'two peaks');
  const tot = pg.D.peaks[0].area + pg.D.peaks[1].area;
  close(tot / (2 * area(1000, s)), 1, 0.03, 'total area');
});

test('one-point spike: no phantom peaks, count reported, area of real peak kept', () => {
  const pg = makePage();
  pg.load(text(1501, 0.01, (t, i) => 1000 + gauss(t, 7, 0.08, 4000) + (i === 400 ? 90000 : 0) + 3 * Math.sin(i * 7.3)));
  assert.equal(pg.D.peaks.length, 1, 'only the real peak: ' + JSON.stringify(pg.D.peaks.map(p => [p.rt, p.h])));
  close(pg.D.peaks[0].rt, 7, 0.02, 'rt');
  close(pg.D.peaks[0].area / area(4000, 0.08), 1, 0.02, 'area');
  assert.ok(pg.D.sigma < 20, 'noise floor not contaminated: ' + pg.D.sigma);
  assert.ok(/1 spike/i.test(pg.el('dataMsg').textContent + pg.el('detMsg').textContent), 'spike count shown');
});

test('spike filter can be switched off', () => {
  const pg = makePage();
  pg.el('spk').checked = false;
  pg.load(text(1501, 0.01, (t, i) => 1000 + gauss(t, 7, 0.08, 4000) + (i === 400 ? 90000 : 0) + 3 * Math.sin(i * 7.3)));
  assert.ok(pg.D.peaks.length > 1, 'spike kept when the filter is off');
});

test('spike filter leaves a clean narrow real peak (>= 8 points wide) alone', () => {
  const pg = makePage();
  pg.load(text(1001, 0.01, (t, i) => 100 + gauss(t, 5, 0.05, 2000) + 2 * Math.sin(i * 5.1)));
  close(pg.D.peaks[0].area / area(2000, 0.05), 1, 0.02, 'area');
});

test('constant signal gives no peak (several constants, with and without tiny noise)', () => {
  for (const c of [1234.5, 3e5 / 7, 0.1 + 0.2, 1e6 / 3]) {
    const pg = makePage();
    pg.load(text(800, 0.01, () => c));
    assert.equal(pg.D.peaks.length, 0, 'constant ' + c);
  }
  const pg = makePage();
  pg.load(text(800, 0.01, (t, i) => 5000 + 1e-9 * Math.sin(i)));
  assert.equal(pg.D.peaks.length, 0, 'near-constant');
});

test('400 000 points load without a stack overflow', () => {
  const pg = makePage();
  pg.load(text(+(process.env.NPTS||400000), 400/+(process.env.NPTS||400000), t => 100 + gauss(t, 200, 2, 5000) + gauss(t, 300, 2, 2000)));
  assert.equal(pg.D.n, +(process.env.NPTS||400000));
  assert.ok(!/err/.test(pg.el('dataMsg').className), pg.el('dataMsg').textContent);
  assert.ok(pg.D.peaks.length >= 2);
});

test('contract B: a failed load clears the previous chromatogram', () => {
  const pg = makePage();
  pg.load(text(800, 0.01, t => 50 + gauss(t, 4, 0.05, 1000)));
  assert.equal(pg.D.peaks.length, 1);
  const ok = pg.load('Time\tSignal\n1\t2\n2\t3\n');
  assert.equal(ok, false);
  assert.equal(pg.D.t, null, 'data cleared');
  assert.equal(pg.D.peaks.length, 0, 'peaks cleared');
  assert.ok(/err/.test(pg.el('dataMsg').className));
});

let fail = 0;
for (const [n, f] of tests) { if (process.env.ONLY && !n.includes(process.env.ONLY)) continue; const t0 = Date.now(); try { f(); console.log('ok   ' + n + ' (' + (Date.now() - t0) + ' ms)'); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } }
console.log(fail ? `${fail} failed` : `all ${tests.length} passed`);
process.exit(fail ? 1 : 0);
