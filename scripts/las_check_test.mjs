// Self-check for the LAS checker core (docs/las-checker/index.html, <script id="las-core">).
// Run: node scripts/las_check_test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../docs/las-checker/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="las-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'las-core script block not found');
const ctx = { window: {} };
vm.runInNewContext(m[1], ctx);
const LAS = ctx.window.LAS;

const CLEAN = `~VERSION INFORMATION
 VERS.                 2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
 WRAP.                  NO : ONE LINE PER DEPTH STEP
~WELL INFORMATION
#MNEM.UNIT       DATA                    DESCRIPTION
 STRT.M        1000.0000               : START DEPTH
 STOP.M        1001.0000               : STOP DEPTH
 STEP.M           0.2500               : STEP
 NULL.         -999.2500               : NULL VALUE
 COMP.         ACME OIL                : COMPANY
 WELL.         ACME-1                  : WELL
 FLD .         NORTH FIELD             : FIELD
 LOC .         12-34-56                : LOCATION
 CTRY.         NORWAY                  : COUNTRY
 SRVC.         LOGCO                   : SERVICE COMPANY
 DATE.         2024-05-01              : LOG DATE
 UWI .         NO-1234                 : UNIQUE WELL ID
 X   .M        512345.0                : SURFACE X
 Y   .M        6712345.0               : SURFACE Y
 EKB .M        25.0                    : KB ELEVATION
~CURVE INFORMATION
 DEPT.M                                : DEPTH
 GR  .GAPI                             : GAMMA RAY
 RHOB.G/C3                             : BULK DENSITY
 NPHI.V/V                              : NEUTRON POROSITY
 RT  .OHMM                             : DEEP RESISTIVITY
~PARAMETER INFORMATION
 BHT .DEGC        85.0                 : BOTTOM HOLE TEMPERATURE
~A  DEPT     GR      RHOB    NPHI    RT
1000.00   45.2   2.45   0.21   12.5
1000.25   47.8   2.44   0.22   11.9
1000.50   80.1   2.52   0.30    3.2
1000.75  -999.25 2.50   0.29    3.5
1001.00   52.0   2.46   0.23   10.1
`;

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const rules = f => [...f].map(x => x.rule);
const ew = f => f.filter(x => x.sev !== 'I');

test('clean LAS 2.0 parses with no errors or warnings', () => {
  const las = LAS.parse(CLEAN, 'clean.las');
  const f = LAS.check(las);
  assert.deepEqual([...ew(f).map(x => `${x.rule} ${x.msg}`)], []);
  assert.equal(las.curves.length, 5);
  assert.equal(las.data.length, 5);
  assert.equal(las.ver.VERS, '2.0');
  assert.equal(LAS.verdict(f), 'pass');
  assert.ok(Number.isNaN(las.data[3][1]) === false && las.data[3][1] === -999.25);
});

test('header line with colons in unit and value, dotted unit', () => {
  const t = CLEAN.replace(' BHT .DEGC', ' TIME.hh:mm      23:15 21-JAN-2001 : TIME LOGGER AT BOTTOM\n TDEP..1IN        5 : TOOL\n BHT .DEGC');
  const las = LAS.parse(t, 'c.las');
  const tm = las.params.find(p => p.mnem === 'TIME');
  assert.equal(tm.unit, 'hh:mm');
  assert.equal(tm.value, '23:15 21-JAN-2001');
  assert.equal(tm.desc, 'TIME LOGGER AT BOTTOM');
  assert.equal(las.params.find(p => p.mnem === 'TDEP').unit, '.1IN');
});

test('wrapped file is read into the same rows', () => {
  const w = CLEAN.replace('WRAP.                  NO', 'WRAP.                 YES')
    .replace(/~A[\s\S]*$/, '~A\n1000.00\n 45.2 2.45 0.21\n 12.5\n1000.25\n 47.8 2.44 0.22\n 11.9\n1000.50\n 80.1 2.52 0.30\n 3.2\n1000.75\n -999.25 2.50 0.29\n 3.5\n1001.00\n 52.0 2.46 0.23\n 10.1\n');
  const las = LAS.parse(w, 'w.las');
  assert.equal(las.data.length, 5);
  assert.deepEqual([...las.data[2]], [1000.5, 80.1, 2.52, 0.30, 3.2]);
});

// ---- checks: each broken variant must raise the named rule(s)
const run = (t, name = 'x.las') => { const las = LAS.parse(t, name); return { las, f: LAS.check(las) }; };
const has = (t, ...want) => { const got = rules(run(t).f); for (const w of want) assert.ok(got.includes(w), `${w} missing; got ${got.join(', ')}`); };
const A = CLEAN.indexOf('~A');
const withData = d => CLEAN.slice(0, A) + '~A\n' + d;

test('file: not a LAS (CSV renamed)', () => has('DEPT,GR,RHOB\n1000,45,2.4\n', 'file.notlas'));
test('file: two ~V (concatenated)', () => has(CLEAN + CLEAN, 'file.concat'));
test('file: empty ~A', () => has(withData(''), 'file.nodata'));
test('file: BOM, tabs, non-ASCII', () => has('﻿' + CLEAN.replace('NORTH FIELD', 'NORTH\tFIELD').replace('BOTTOM HOLE', 'BOTTOM HOLE °'), 'file.bom', 'file.tabs', 'file.nonascii'));
test('struct: missing ~C, ~V not first', () => has(CLEAN.replace(/~CURVE[\s\S]*?(?=~PARAMETER)/, '').replace(/^(~VERSION[\s\S]*?)(~WELL[\s\S]*?)(?=~PARAMETER)/, '$2$1'), 'struct.missing', 'struct.order'));
test('struct: unknown section', () => has(CLEAN.replace('~PARAMETER', '~ZZZ'), 'struct.unknown'));
test('ver: VERS missing, WRAP bad', () => has(CLEAN.replace(/ VERS\..*\n/, '').replace('WRAP.                  NO', 'WRAP.                  MAYBE'), 'ver.vers', 'ver.wrap'));
test('ver: wrapped file warns with unwrap fix', () => { const { f } = run(CLEAN.replace('WRAP.                  NO', 'WRAP.                 YES').replace(/~A[\s\S]*$/, '~A\n1000.00\n 45.2 2.45 0.21 12.5\n1000.25\n 47.8 2.44 0.22 11.9\n')); assert.ok(f.some(x => x.rule === 'ver.wrapyes' && x.fix === 'wrap')); });
test('ver: 2.0 file with 1.2 ~W layout', () => has(CLEAN.replace(' COMP.         ACME OIL                : COMPANY', ' COMP.  : ACME OIL').replace(' WELL.         ACME-1                  : WELL', ' WELL.  : ACME-1').replace(' FLD .         NORTH FIELD             : FIELD', ' FLD .  : NORTH FIELD'), 'ver.layout'));
test('hdr: missing dot, missing colon, dotted mnemonic, duplicate case-insensitive', () => has(CLEAN.replace(' BHT .DEGC', ' DRILLED  :12/11/2010\n MUDW.G/C3  1.2\n SP.COND .US/M 3 : COND\n bht .DEGC 80 : again\n BHT .DEGC'), 'hdr.nodot', 'hdr.nocolon', 'hdr.dotmnem', 'hdr.dup'));
test('hdr: unparseable line', () => has(CLEAN.replace(' BHT .DEGC', '"quoted line"\n BHT .DEGC'), 'hdr.parse'));
test('well: STRT missing, WELL empty, COMP missing, no UWI, no location', () => has(CLEAN.replace(/ STRT\..*\n/, '').replace('ACME-1', '').replace(/ COMP\..*\n/, '').replace(/ UWI .*\n/, '').replace(/ CTRY.*\n/, ''), 'well.required', 'well.name', 'well.recommended', 'well.uwi', 'well.location'));
test('well: STRT/STOP mismatch, STEP 0 on regular data', () => { const { f } = run(CLEAN.replace('1000.0000 ', '999.0000  ').replace('0.2500', '0.0000')); const r = rules(f); assert.ok(r.includes('well.strtstop') && r.includes('well.step')); assert.ok(f.find(x => x.rule === 'well.step').fix === 'step'); });
test('well: STEP sign inconsistent', () => has(CLEAN.replace('0.2500', '-0.2500'), 'well.step'));
test('well: depth unit differs from index unit, implausible metres', () => has(CLEAN.replace('STOP.M        1001.0000', 'STOP.F        1001.0000').replace(/1001\.00 /, '15001.00').replace('STOP.F        1001.0000', 'STOP.F        15001.0000').replace(/ DEPT\.M/, ' DEPT.M'), 'well.units'));
test('well: implausible depth for unit M', () => { const t = CLEAN.replace(/1000\./g, '14000.').replace(/1001\./g, '14001.'); has(t, 'well.depthunit'); });
test('well: no coordinates, no KB', () => has(CLEAN.replace(/ X   .*\n/, '').replace(/ Y   .*\n/, '').replace(/ EKB .*\n/, ''), 'well.xy', 'well.kb'));
test('curve: first curve not an index, duplicates, empty unit', () => has(CLEAN.replace(' DEPT.M', ' XXXX.M').replace(' RT  .OHMM', ' gr  .').replace(/1000\.00 /, '1000.00 '), 'curve.index', 'curve.dup', 'curve.nounit'));
test('curve: count differs from data columns', () => has(withData('1000.00 45 2.4 0.2\n1000.25 46 2.4 0.2\n'), 'curve.count'));
test('data: wrong row length, non-numeric, run-on', () => has(withData('1000.00 45.2 2.45 0.21 12.5\n1000.25 45.2 2.45 0.21\n1000.50 ERR 2.45 0.21 12.5\n1000.75 7.330-19508.961 0.21 12.5\n1001.00 45.2 2.45 0.21 12.5\n'), 'data.rowlen', 'data.nonnumeric', 'data.runon'));
test('data: index not monotonic, duplicate, null in index', () => has(withData('1000.00 1 2 0.2 1\n1000.50 1 2 0.2 1\n1000.25 1 2 0.2 1\n1000.25 1 2 0.2 1\n-999.25 1 2 0.2 1\n'), 'data.monotonic', 'data.dupindex', 'data.nullindex'));
test('data: comments, exponent, other null sentinels', () => { const { f } = run(withData('1000.00 45.2 2.45 0.21 1.25E+01\n# note\n1000.25 -9999 2.44 0.22 11.9\n1000.50 NA 2.52 0.30 3.2\n1000.75 47 2.50 0.29 3.5\n1001.00 52.0 2.46 0.23 10.1\n')); const r = rules(f); for (const w of ['data.comment', 'data.exponent', 'data.nulls']) assert.ok(r.includes(w), w); assert.ok(!r.includes('data.nonnumeric')); assert.equal(f.find(x => x.rule === 'data.nulls').fix, 'nulls'); });
test('data: wrapped record malformed', () => has(CLEAN.replace('WRAP.                  NO', 'WRAP.                 YES').replace(/~A[\s\S]*$/, '~A\n1000.00 45.2\n 2.45 0.21 12.5\n1000.25\n 47.8 2.44 0.22 11.9\n'), 'data.wrap'));
test('data: all-null and constant curves', () => has(withData('1000.00 -999.25 2.45 0.21 5\n1000.25 -999.25 2.44 0.22 5\n1000.50 -999.25 2.52 0.30 5\n'), 'data.allnull', 'data.constant'));
test('plaus: NPHI in % with unit V/V, negative GR, RHOB out of range, resistivity <= 0', () => has(withData('1000.00 -5 3.9 25 0\n1000.25 40 2.44 30 2\n1000.50 45 2.5 28 3\n'), 'plaus.range'));
test('plaus: spike', () => { const rows = []; for (let i = 0; i < 60; i++) rows.push(`${(1000 + i * 0.25).toFixed(2)} ${i === 30 ? 900 : 50 + Math.sin(i / 3) * 5} 2.45 0.21 10`); const t = withData(rows.join('\n') + '\n').replace('1001.0000 ', (1000 + 59 * 0.25).toFixed(4) + ' '); has(t, 'plaus.spike'); });
test('LAS 3.0 detected as info', () => { const { f } = run(CLEAN.replace(' 2.0 : CWLS', ' 3.0 : CWLS')); assert.ok(f.some(x => x.rule === 'ver.las3' && x.sev === 'I')); });
test('verdict: fail / warn', () => { assert.equal(LAS.verdict(run(withData('1000 x\n')).f), 'fail'); assert.equal(LAS.verdict(run(CLEAN.replace(/ COMP\..*\n/, '')).f), 'warn'); });

test('a truncated row does not make the step irregular', () => {
  const { f } = run(withData('1000.00 45 2.4 0.2 1\n1000.25 46 2.4 0.2\n1000.50 47 2.4 0.2 1\n1000.75 47 2.4 0.2 1\n1001.00 47 2.4 0.2 1\n'));
  assert.ok(!rules(f).includes('well.step'), rules(f).join(', '));
});

// ---- batch
test('batch: same WELL different UWI, overlapping runs, mixed depth units', () => {
  const a = LAS.parse(CLEAN, 'a.las'), b = LAS.parse(CLEAN.replace('NO-1234', 'NO-9999'), 'b.las');
  const c = LAS.parse(CLEAN.replace(/ACME-1/, 'ACME-2').replace(/STRT\.M|STOP\.M|STEP\.M|DEPT\.M/g, s => s.replace('.M', '.F')), 'c.las');
  const r = rules(LAS.checkBatch([a, b, c]));
  for (const w of ['batch.uwi', 'batch.overlap', 'batch.units']) assert.ok(r.includes(w), `${w}; got ${r.join(', ')}`);
});

// ---- fixes + writer
const BROKEN = '﻿' + CLEAN
  .replace('WRAP.                  NO', 'WRAP.                 YES')
  .replace('1000.0000 ', '999.0000  ').replace('0.2500', '0.0000')
  .replace(' COMP.         ACME OIL                : COMPANY', ' COMP.         ACME\tOIL')
  .replace(/~A[\s\S]*$/, '~A\n1000.00\n 45.2 2.45 0.2100\n 12.5\n1000.25\n -9999 2.44 0.22\n 11.9\n1000.50\n 80.1 2.52 0.30\n 3.2\n1000.75\n -999.25 2.50 0.29\n 3.5\n1001.00\n 52.0 2.46 0.23\n 10.1\n');
const defaults = () => [...LAS.FIXES].filter(x => x.defaultOn).map(x => x.id);

test('FIXES: ids and defaults', () => {
  assert.deepEqual([...LAS.FIXES].map(x => x.id), ['bom', 'eol', 'tabs', 'syntax', 'wrap', 'vers', 'strtstop', 'step', 'nulls', 'emptyrows']);
  assert.equal(LAS.FIXES.find(x => x.id === 'nulls').defaultOn, false);
});
test('write with default fixes resolves every fixable finding except nulls; values unchanged', () => {
  const las = LAS.parse(BROKEN, 'b.las');
  const before = new Set(rules(LAS.check(las)));
  for (const r of ['file.bom', 'file.tabs', 'ver.wrapyes', 'well.strtstop', 'well.step', 'hdr.nocolon', 'data.nulls']) assert.ok(before.has(r), 'fixture lacks ' + r);
  const { text, log } = LAS.write(las, defaults());
  const las2 = LAS.parse(text, 'b2.las'), after = LAS.check(las2);
  const fixed = [...after].filter(x => x.fix && x.fix !== 'nulls');
  assert.deepEqual(fixed.map(x => x.rule), []);
  assert.ok(rules(after).includes('data.nulls'));
  assert.equal(las2.ver.WRAP, 'NO');
  assert.deepEqual(JSON.stringify(las2.data), JSON.stringify(las.data));
  assert.ok(log.length >= 5, log.join('\n'));
  assert.ok(text.includes(' 0.2100'), 'number text reformatted');
  assert.ok(!text.includes('\t') && text.charCodeAt(0) !== 0xFEFF);
});
test('write with nulls fix replaces sentinels by the declared NULL', () => {
  const las = LAS.parse(BROKEN, 'b.las');
  const { text } = LAS.write(las, [...defaults(), 'nulls']);
  const las2 = LAS.parse(text, 'b2.las');
  assert.ok(!rules(LAS.check(las2)).includes('data.nulls'));
  assert.equal(las2.data[1][1], -999.25);
  assert.ok(!/-9999\b/.test(text.split('~A')[1]));
});
test('write without fixes keeps the file content (modulo line endings)', () => {
  const t = CLEAN;
  const { text, log } = LAS.write(LAS.parse(t, 'c.las'), []);
  assert.equal(text.replace(/\r\n/g, '\n'), t);
  assert.equal(log.length, 0);
});
test('emptyrows trims leading/trailing all-null rows and STRT follows', () => {
  const t = withData('999.75 -999.25 -999.25 -999.25 -999.25\n1000.00 45 2.4 0.2 1\n1000.25 46 2.4 0.2 1\n1000.50 47 2.4 0.2 1\n1000.75 -999.25 -999.25 -999.25 -999.25\n1001.00 -999.25 -999.25 -999.25 -999.25\n').replace('1000.0000 ', '999.7500  ');
  const { text } = LAS.write(LAS.parse(t, 'e.las'), defaults());
  const las2 = LAS.parse(text, 'e2.las');
  assert.equal(las2.data.length, 3);
  assert.equal(+las2.well.find(h => h.mnem === 'STRT').value, 1000);
  assert.equal(+las2.well.find(h => h.mnem === 'STOP').value, 1000.5);
});
test('1.2 layout rewritten as 2.0 with vers fix', () => {
  const t = CLEAN.replace(' 2.0 : CWLS', ' 1.2 : CWLS').replace(' COMP.         ACME OIL                : COMPANY', ' COMP.  : ACME OIL').replace(' WELL.         ACME-1                  : WELL', ' WELL.  : ACME-1').replace(' FLD .         NORTH FIELD             : FIELD', ' FLD .  : NORTH FIELD');
  const { text } = LAS.write(LAS.parse(t, 'o.las'), defaults());
  const las2 = LAS.parse(text, 'o2.las');
  assert.equal(las2.ver.VERS, '2.0');
  assert.equal(las2.layout12, false);
  assert.equal(las2.well.find(h => h.mnem === 'WELL').value, 'ACME-1');
});

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ', name); }
  catch (e) { fail++; console.log('FAIL ', name, '\n     ', e.message.split('\n').slice(0, 6).join('\n      ')); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
