// Assembles the ES modules of the GDE map generator v3 (gde3/src, gde3/tools/acceptance.mjs, gde3/ui/app.mjs) into ONE self-contained page,
// docs/gdemap3/index.html. Run: node scripts/build_gde3.mjs        (write)     node scripts/build_gde3.mjs --check   (exit 1 if out of date)
// Each module becomes a function scope returning its exports; imports become destructuring of the already built modules.
// The shared "Method & sources" + Tools menu script is gde3/ui/rgm_prefix.js (same text as the other tool pages) followed by the data object
// of gde3/ui/method.mjs. The page is written with LF; git converts it like the other pages.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), OUT = resolve(ROOT, 'docs/gdemap3/index.html');
const read = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// ---- bundler ----
const IMPORT = /^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?[ \t]*$/gm;
export function bundle(entry) {
  const order = [], seen = new Set(), src = new Map();
  const visit = f => {
    if (seen.has(f)) return; seen.add(f);
    const s = read(f); src.set(f, s);
    for (const m of s.matchAll(IMPORT)) visit(resolve(dirname(f), m[2]));
    order.push(f);
  };
  visit(entry);
  const id = f => relative(ROOT, f).replace(/\\/g, '/');
  let out = 'const __M = {};\n';
  for (const f of order) {
    let s = src.get(f); const names = [];
    s = s.replace(IMPORT, (_, list, from) => 'const {' + list.split(',').map(x => x.trim()).filter(Boolean).map(x => x.replace(/\s+as\s+/, ': ')).join(', ') + '} = __M[' + JSON.stringify(id(resolve(dirname(f), from))) + '];');
    s = s.replace(/^export\s+(const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm, (_, k, n) => { names.push(n); return k + ' ' + n; });
    s = s.replace(/^export\s*\{([^}]*)\};?[ \t]*$/gm, (_, l) => { l.split(',').map(x => x.trim()).filter(Boolean).forEach(n => names.push(n)); return ''; });
    if (/^export\s/m.test(s)) throw new Error(id(f) + ': unsupported export form');
    out += '__M[' + JSON.stringify(id(f)) + '] = (function () {\n' + s.trimEnd() + '\nreturn { ' + [...new Set(names)].join(', ') + ' };\n})();\n';
  }
  out += 'globalThis.GDE3 = Object.assign({}, ...Object.values(__M));\n';
  return '(function () {\n' + out + '})();\n';
}

export async function buildPage() {
  const core = bundle(resolve(ROOT, 'gde3/ui/app.mjs'));
  const { METHOD } = await import(pathToFileURL(resolve(ROOT, 'gde3/ui/method.mjs')).href);
  const rgm = read(resolve(ROOT, 'gde3/ui/rgm_prefix.js')) + '(' + JSON.stringify(METHOD).replace(/<\//g, '<\\/') + ')\n';
  const safe = s => s.replace(/<\/script/gi, '<\\/script');
  let page = read(resolve(ROOT, 'gde3/ui/page.html'));
  const put = (mark, text) => { const i = page.indexOf(mark); if (i < 0) throw new Error('marker ' + mark); page = page.slice(0, i) + text + page.slice(i + mark.length); };
  put('/*CORE*/', safe(core)); put('/*RGM*/', safe(rgm));
  return page;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const page = await buildPage();
  if (process.argv.includes('--check')) {
    const cur = existsSync(OUT) ? read(OUT) : '';
    if (cur !== page) { console.log('docs/gdemap3/index.html is out of date: run node scripts/build_gde3.mjs'); process.exit(1); }
    console.log('docs/gdemap3/index.html is up to date');
  } else {
    mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, page);
    console.log('written docs/gdemap3/index.html (' + page.length + ' characters)');
  }
}
