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

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ', name); }
  catch (e) { fail++; console.log('FAIL ', name, '\n     ', e.message.split('\n').slice(0, 6).join('\n      ')); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
