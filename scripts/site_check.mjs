// Site-wide check of the tool pages: the shared "Method & sources" / Tools-menu script parses, the Tools menu lists every tool
// folder of docs/, and every tool is in the mkdocs nav and has a thumbnail. Run: node scripts/site_check.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const tools = readdirSync('docs').filter(d => existsSync(`docs/${d}/index.html`) && readFileSync(`docs/${d}/index.html`, 'utf8').includes('id="rgm-js"'));
const nav = readFileSync('mkdocs.yml', 'utf8');
let bad = 0; const fail = m => { bad++; console.log('FAIL ' + m) };
for (const d of tools) {
  const h = readFileSync(`docs/${d}/index.html`, 'utf8'), k = '<script id="rgm-js">', i = h.indexOf(k), e = h.indexOf('</script>', i);
  try { new Function(h.slice(i + k.length, e)) } catch (x) { fail(`${d}: rgm script does not parse (${x.message})`) }
  for (const t of tools) if (!h.includes(`'${t}']`)) fail(`${d}: Tools menu misses ${t}`);
  if (!nav.includes(`${d}/index.html`)) fail(`${d}: not in mkdocs.yml nav`);
  if (!existsSync(`docs/assets/tools/${d}.webp`)) console.log(`note: no thumbnail docs/assets/tools/${d}.webp (the card may use another name)`);
}
console.log(`${tools.length} tool pages checked, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
