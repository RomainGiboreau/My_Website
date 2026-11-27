// Loads the OLD GDE core headlessly (docs/gdemap/index.html, block gde-core) to compare its stability with v3. Read-only use.
import { readFileSync } from 'node:fs';
export function loadOld() {
  const html = readFileSync(new URL('../../docs/gdemap/index.html', import.meta.url), 'utf8');
  const m = html.match(/<script id="gde-core">([\s\S]*?)<\/script>/);
  const w = {};
  new Function('window', m[1])(w);
  return w.GDE;
}
// class grid (belt index per cell) of the old model on an n x n grid over ext
export function oldGrid(G, M, wells, n) {
  const mod = G.build(M, wells, { fast: true, dist: false }), e = M.ext, out = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) out[j * n + i] = mod.beltAt(e.xmin + (i + .5) * (e.xmax - e.xmin) / n, e.ymin + (j + .5) * (e.ymax - e.ymin) / n);
  return { grid: out, mod };
}
