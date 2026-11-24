// Self-check for the ZMAP checker core (docs/zmap-checker/index.html, <script id="zmap-core">).
// Run: node scripts/zmap_check_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../docs/zmap-checker/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="zmap-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'zmap-core script block not found');
const ctx = { window: {} };
vm.runInNewContext(m[1], ctx);
const Z = ctx.window.ZMAP;

// 3 rows x 4 cols, 4 nodes per line: one line per column (research notes example)
const CLEAN = `!
! Minimal ZMAP+ grid: 3 rows x 4 cols
!
@EXAMPLE, GRID, 4
15, 1.0E+30, , 7, 1
3, 4, 0.0, 300.0, 0.0, 200.0
0.0, 0.0, 0.0
@
   1000.0000000   1010.0000000   1020.0000000
   1100.0000000  1.0000000E+30   1120.0000000
   1200.0000000   1210.0000000   1220.0000000
   1300.0000000   1310.0000000   1320.0000000
`;
// 5 rows x 3 cols, 2 nodes per line: each column on 3 lines (2, 2, 1)
const fmt = v => v.toFixed(7).padStart(15);
const grid = (nr, nc, f) => { const L = []; for (let c = 0; c < nc; c++) { const col = []; for (let r = 0; r < nr; r++) col.push(f(r, c)); for (let i = 0; i < col.length; i += 2) L.push(col.slice(i, i + 2).map(fmt).join('')); } return L.join('\n') + '\n'; };
const WRAP = `@SURF HEADER , GRID, 2
15, 1.0E+30, , 7, 1
5, 3, 1000.0, 1100.0, 2000.0, 2200.0
0.0, 0.0, 0.0
@
` + grid(5, 3, (r, c) => 2000 + 10 * r + c);

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const rules = f => [...f].map(x => x.rule);
const ew = f => [...f].filter(x => x.sev !== 'I');
const run = t => { const z = Z.parse(t, 'x.zmap'); return { z, f: Z.check(z) }; };
const has = (t, ...want) => { const got = rules(run(t).f); for (const w of want) assert.ok(got.includes(w), `${w} missing; got ${got.join(', ')}`); };
const hasnt = (t, ...no) => { const got = rules(run(t).f); for (const w of no) assert.ok(!got.includes(w), `${w} present; got ${got.join(', ')}`); };
const FIXDEF = () => [...Z.FIXES].filter(x => x.defaultOn).map(x => x.id);

// ---- parse
test('clean grid: header, geometry and values in grid order', () => {
  const { z, f } = run(CLEAN);
  assert.deepEqual([...ew(f).map(x => `${x.rule} ${x.msg}`)], []);
  assert.equal(Z.verdict(f), 'pass');
  assert.equal(z.nrows, 3); assert.equal(z.ncols, 4); assert.equal(z.npl, 4); assert.equal(z.width, 15);
  assert.equal(z.dx, 100); assert.equal(z.dy, 100);
  // value(row, col): row 0 = top (ymax)
  assert.equal(Z.value(z, 0, 0), 1000); assert.equal(Z.value(z, 2, 0), 1020); assert.equal(Z.value(z, 0, 3), 1300);
  assert.ok(Z.isNull(z, Z.value(z, 1, 1)));
});
test('wrapped columns (2 nodes per line) parse and pass', () => {
  const { z, f } = run(WRAP);
  assert.deepEqual([...ew(f).map(x => `${x.rule} ${x.msg}`)], []);
  assert.equal(Z.value(z, 4, 2), 2042); assert.equal(z.label, 'SURF HEADER');
});

// ---- checks
test('not a ZMAP file', () => has('x,y,z\n1,2,3\n', 'file.notzmap'));
test('non-grid ZMAP+ file (FALT)', () => { const { f } = run(CLEAN.replace('GRID, 4', 'FALT, 4')); assert.ok(rules(f).includes('file.nongrid')); assert.equal(Z.verdict(f), 'fail'); });
test('lower-case grid keyword', () => { const { f } = run(CLEAN.replace('GRID, 4', 'grid, 4')); assert.equal(f.find(x => x.rule === 'hdr.gridcase').fix, 'header'); });
test('BOM, tabs, non-ASCII', () => has('﻿' + CLEAN.replace('Minimal', 'Minimal\tgrid é'), 'file.bom', 'file.tabs', 'file.nonascii'));
test('header: wrong token counts', () => { has(CLEAN.replace('@EXAMPLE, GRID, 4', '@EXAMPLE GRID 4'), 'hdr.l1'); has(CLEAN.replace('15, 1.0E+30, , 7, 1', '15, 1.0E+30, 7, 1'), 'hdr.l2'); has(CLEAN.replace('3, 4, 0.0, 300.0, 0.0, 200.0', '3, 4, 0.0, 300.0, 0.0'), 'hdr.l3'); });
test('header: ",," empty field and blank null', () => { has(CLEAN.replace('15, 1.0E+30, , 7, 1', '15,1.0E+30,,7,1'), 'hdr.emptyfield'); has(CLEAN.replace('15, 1.0E+30, , 7, 1', '15, , 1.0E+30, 7, 1'), 'hdr.nullblank'); });
test('header: width, decimals, start column', () => { has(CLEAN.replace('15, 1.0E+30, , 7, 1', '45, 1.0E+30, , 7, 1'), 'hdr.width'); has(CLEAN.replace('15, 1.0E+30, , 7, 1', '15, 1.0E+30, , 7, 2'), 'hdr.startcol'); });
test('header: nrows < 2, extent inverted', () => { has(CLEAN.replace('3, 4, 0.0, 300.0', '1, 4, 0.0, 300.0'), 'hdr.size'); has(CLEAN.replace('0.0, 300.0, 0.0, 200.0', '300.0, 0.0, 0.0, 200.0'), 'hdr.extent'); });
test('header: missing line 4, non-zero line 4, blank line inside, RMS + line, @ count', () => {
  has(CLEAN.replace('0.0, 0.0, 0.0\n', ''), 'hdr.l4');
  const { f } = run(CLEAN.replace('0.0, 0.0, 0.0', '200.0, 0.0, 0.0')); assert.equal(f.find(x => x.rule === 'hdr.l4values').sev, 'I');
  has(CLEAN.replace('15, 1.0E+30', '\n15, 1.0E+30'), 'hdr.inner');
  const r = run(CLEAN.replace('@\n   1000', '@\n+Grid data starts after this line\n   1000')); assert.ok(rules(r.f).includes('hdr.rms')); assert.equal(Z.verdict(r.f), 'pass');
  has(CLEAN.replace(/\n@\n/, '\n'), 'hdr.at');
});
test('data: value count, non-numeric, comma decimal', () => {
  has(CLEAN.replace('   1300.0000000   1310.0000000   1320.0000000\n', ''), 'data.count');
  has(CLEAN.replace('1210.0000000', '   ERR'), 'data.nonnumeric');
  has(CLEAN.replace('1210.0000000', '   1210,00000'), 'data.comma');
});
test('data: too many values on a line, column breaks', () => {
  const p = CLEAN.split('\n@\n'); const one = p[0] + '\n@\n' + p[1].trim().split('\n').join('') + '\n';
  has(one, 'data.perline');
  const t = WRAP.split('\n@\n'); const vals = t[1].trim().split(/\s+/); const rew = []; for (let i = 0; i < vals.length; i += 2) rew.push(vals.slice(i, i + 2).map(v => v.padStart(15)).join(''));
  has(t[0] + '\n@\n' + rew.join('\n') + '\n', 'data.breaks');
});
test('data: fixed width broken, value wider than field, no decimal point', () => {
  has(CLEAN.replace('   1000.0000000', ' 1000.0000000'), 'data.width');
  has(CLEAN.replace('   1000.0000000', '1000.00000000000000'), 'data.width');
  has(CLEAN.replace('   1000.0000000', '           1000'), 'data.nodecimal');
});
test('data: null text differs (info) and other null-like values (fixable, off)', () => {
  const { f } = run(CLEAN.replace(' 1.0000000E+30', ' 0.1000000E+31')); assert.equal(f.find(x => x.rule === 'data.nulltext').sev, 'I');
  const r = run(CLEAN.replace('   1310.0000000', ' -99999.0000000')); const n = r.f.find(x => x.rule === 'data.nulls'); assert.ok(n); assert.equal(n.fix, 'nulls');
  assert.equal(Z.FIXES.find(x => x.id === 'nulls').defaultOn, false);
});
test('geometry: half-cell (pixel-is-area) extents', () => has(CLEAN.replace('3, 4, 0.0, 300.0, 0.0, 200.0', '3, 4, -50.0, 350.0, -50.0, 250.0'), 'geo.halfcell'));
test('geometry: rows and columns swapped', () => has(`@G, GRID, 5
15, 1.0E+30, , 7, 1
4, 6, 0.0, 300.0, 0.0, 500.0
0.0, 0.0, 0.0
@
` + grid(4, 6, () => 5).replace(/^(.*)$/gm, '$1'), 'geo.swapped'));
test('geometry: dx != dy is info', () => { const { f } = run(CLEAN.replace('0.0, 200.0', '0.0, 100.0')); assert.equal(f.find(x => x.rule === 'geo.aniso').sev, 'I'); });
test('plausibility: all null, constant, positive depth', () => {
  has(CLEAN.replace(/\d{4}\.0000000/g, '1.0000000E+30'), 'data.allnull');
  has(CLEAN.replace(/1\d{3}\.0000000/g, '1000.0000000'), 'data.constant');
  has(CLEAN.replace('@EXAMPLE', '@TOP_RESERVOIR_DEPTH'), 'plaus.zsign');
});

// ---- writer
test('no fixes = identical content (modulo CRLF); defaults on a clean file change nothing', () => {
  assert.equal(Z.write(Z.parse(CLEAN, 'c'), []).text.replace(/\r\n/g, '\n'), CLEAN);
  const w = Z.write(Z.parse(CLEAN, 'c'), FIXDEF()); assert.equal(w.log.length, 0, w.log.join('\n')); assert.equal(w.text.replace(/\r\n/g, '\n'), CLEAN);
});
test('layout fix rewraps per column, keeps value text, widens the field when needed', () => {
  const t = WRAP.split('\n@\n'); const vals = t[1].trim().split(/\s+/);
  vals[3] = '2012.00000000000001'; // 19 characters: wider than 15
  const bad = t[0] + '\n@\n' + vals.join(' ') + '\n';
  const z = Z.parse(bad, 'b'); const w = Z.write(z, FIXDEF());
  const z2 = Z.parse(w.text, 'b2'), f2 = Z.check(z2);
  assert.deepEqual([...ew(f2).map(x => x.rule)], []);
  assert.ok(z2.width >= 20, 'width ' + z2.width);
  assert.ok(w.text.includes('2012.00000000000001'));
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) assert.equal(Z.value(z2, r, c), Z.value(z, r, c));
});
test('header fix: ",,", lower-case grid, missing line 4, blank line inside', () => {
  const bad = CLEAN.replace('GRID, 4', 'grid, 4').replace('15, 1.0E+30, , 7, 1', '15,1.0E+30,,7,1').replace('0.0, 0.0, 0.0\n', '').replace('3, 4,', '\n3, 4,');
  const w = Z.write(Z.parse(bad, 'h'), FIXDEF()); const f2 = Z.check(Z.parse(w.text, 'h2'));
  assert.deepEqual([...ew(f2).map(x => x.rule)], []);
  assert.ok(w.log.length >= 3, w.log.join('\n'));
});
test('nulls fix replaces other null-like values by the header null text', () => {
  const z = Z.parse(CLEAN.replace('   1310.0000000', ' -99999.0000000'), 'n');
  const w = Z.write(z, [...FIXDEF(), 'nulls']); const z2 = Z.parse(w.text, 'n2');
  assert.ok(Z.isNull(z2, Z.value(z2, 1, 3))); assert.ok(!rules(Z.check(z2)).includes('data.nulls'));
});
test('write does not modify the parsed file', () => {
  const z = Z.parse(CLEAN.replace('15, 1.0E+30, , 7, 1', '15,1.0E+30,,7,1'), 'm'); const n0 = Z.check(z).length;
  Z.write(z, FIXDEF()); assert.equal(Z.check(z).length, n0); assert.equal(Z.write(z, []).log.length, 0);
});
test('large grid (1000 x 1000) checks and writes', () => {
  const L = []; for (let c = 0; c < 1000; c++) for (let i = 0; i < 1000; i += 5) { const s = []; for (let k = i; k < i + 5; k++) s.push(fmt(1000 + k + c)); L.push(s.join('')); }
  const t = '@BIG, GRID, 5\n15, 1.0E+30, , 7, 1\n1000, 1000, 0.0, 24975.0, 0.0, 24975.0\n0.0, 0.0, 0.0\n@\n' + L.join('\n') + '\n';
  const z = Z.parse(t, 'big'); const f = Z.check(z); assert.equal(Z.verdict(f), 'pass', rules(f).join(', '));
  assert.ok(Z.write(z, FIXDEF()).text.length > 1e7);
});

test('line breaks that match the swapped size: swapped reported, layout fix not applied', () => {
  // data written for 5 rows x 3 cols (2 per line, column breaks), header says 3 rows x 5 cols
  const t = WRAP.replace('5, 3, 1000.0, 1100.0, 2000.0, 2200.0', '3, 5, 1000.0, 1100.0, 2000.0, 2200.0');
  const z = Z.parse(t, 's'), f = Z.check(z), sw = f.find(x => x.rule === 'geo.swapped');
  assert.ok(sw, rules(f).join(', '));
  assert.ok(!f.some(x => x.rule === 'data.breaks' && x.fix), 'breaks still fixable');
  const w = Z.write(z, FIXDEF()); assert.ok(!w.log.some(l => /Rewrote the data/.test(l)), w.log.join('\n'));
});

// ---- batch
test('batch: same name, different geometry', () => {
  const r = rules(Z.checkBatch([Z.parse(CLEAN, 'a'), Z.parse(CLEAN.replace('0.0, 200.0', '0.0, 100.0'), 'b')]));
  assert.ok(r.includes('batch.name') && r.includes('batch.geometry'), r.join(', '));
});

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ', name); }
  catch (e) { fail++; console.log('FAIL ', name, '\n     ', e.message.split('\n').slice(0, 6).join('\n      ')); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
