// Checks that the map digitizer is split into two tools with one mode each:
// docs/mapdigitizer/index.html (continuous, colour bar) and docs/discretemap/index.html (discrete, colour boxes, polygons).
// Run: node scripts/mapdigitizer_split_test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const cont = read('docs/mapdigitizer/index.html'), disc = read('docs/discretemap/index.html');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('continuous page: title, colour bar UI and its example', () => {
  assert.match(cont, /<title>Continuous map digitizer<\/title>/);
  assert.match(cont, /<h1>Continuous map digitizer<\/h1>/);
  for (const id of ['bMin', 'bMax', 'bMid', 'lutC', 'bExample']) assert.ok(cont.includes(`id="${id}"`), id);
  assert.ok(cont.includes('href="../discretemap/"'), 'link to the discrete page');
});
test('continuous page: nothing of the discrete mode', () => {
  assert.ok(!cont.includes('md-discrete-core'), 'md-discrete-core');
  assert.ok(!cont.includes('Turbidite example') && !cont.includes('Facies example'), 'discrete examples');
  assert.ok(!cont.includes('Legend type') && !cont.includes('id="legType"'), 'legend type select');
  for (const id of ['bCls', 'bDetect', 'clsList', 'bPoly', 'bZmap', 'bIrap', 'bGeo', 'bPcsv', 'fillGaps'])
    assert.ok(!cont.includes(`id="${id}"`), id);
  assert.ok(!/\bDISC\(|\bMDD\b|S\.mode/.test(cont), 'discrete code');
});
test('discrete page: title, core, class editor, polygons and both examples', () => {
  assert.match(disc, /<title>Discrete map digitizer<\/title>/);
  assert.match(disc, /<h1>Discrete map digitizer<\/h1>/);
  assert.ok(disc.includes('<script id="md-discrete-core">'), 'md-discrete-core');
  assert.ok(disc.includes('>Facies example</button>') && disc.includes('>Turbidite example</button>'), 'examples');
  for (const id of ['bCls', 'bDetect', 'clsList', 'bPoly', 'bZmap', 'bIrap', 'bGeo', 'bPcsv', 'fillGaps'])
    assert.ok(disc.includes(`id="${id}"`), id);
  assert.ok(disc.includes('href="../mapdigitizer/"'), 'link to the continuous page');
});
test('discrete page: no colour bar UI, no legend type switch', () => {
  for (const id of ['bMin', 'bMax', 'bMid', 'vMin', 'vMax', 'tickList', 'lutC', 'legType', 'legCont', 'bExample'])
    assert.ok(!disc.includes(`id="${id}"`), id);
  assert.ok(!disc.includes('Legend type'), 'Legend type');
  assert.ok(!/\bbuildLUT\b|\bS\.T\b|S\.mode/.test(disc), 'colour bar code');
});
test('both pages are in the Tools menu of each other', () => {
  const entry = "['Continuous map digitizer','mapdigitizer'],['Discrete map digitizer','discretemap']";
  assert.ok(cont.includes(entry) && disc.includes(entry));
});

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ', name); }
  catch (e) { fail++; console.log('FAIL ', name, '\n     ', e.message.split('\n').slice(0, 6).join('\n      ')); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
