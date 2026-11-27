// Belts on d: prior thresholds from a system record, classification, adjacency validation, matching of well descriptions.
import { valueNoise } from './rng.mjs';
import { SYSTEMS } from './systems.mjs';

// effective system for a regime: widths scaled so the finite belts add up to spanM (metres), fringe amplitudes, adjacency set
export function resolveSystem(sys, { regime, spanM } = {}) {
  const R = sys.regimes, ro = R ? R.options[regime || R.default] : null;
  if (R && !ro) throw new Error('unknown regime ' + regime);
  const w0 = sys.belts.map(b => b.w * ((ro && ro.widths && ro.widths[b.id]) || 1));
  const k = spanM / w0.slice(0, -1).reduce((a, v) => a + v, 0);
  const w = w0.map(v => v * k);
  const fringe = {};
  for (const [a, b, f] of sys.fringe || []) fringe[a + '|' + b] = (ro && ro.fringe && ro.fringe[a + '|' + b] != null) ? ro.fringe[a + '|' + b] : f;
  const adj = new Set(sys.adj.flatMap(([a, b]) => [a + '|' + b, b + '|' + a]));
  const p = []; let s = 0;
  for (let i = 0; i < w.length - 1; i++) p.push(s += w[i]);
  return { sys, belts: sys.belts, w, p, fringe, adj, regime: ro ? (regime || R.default) : null };
}

// fringe half-amplitude of every threshold k (between belts k and k + 1), in d units, from thresholds t:
// f x the narrower adjacent belt (the first and last belts are open-ended and do not count)
export function fringeAmps(rs, t) {
  return t.map((_, k) => {
    const f = Math.min(0.3, rs.fringe[rs.belts[k].id + '|' + rs.belts[k + 1].id] || 0), c = [];
    if (k >= 1) c.push(t[k] - t[k - 1]);
    if (k + 1 < t.length) c.push(t[k + 1] - t[k]);
    return c.length ? f * Math.min(...c) : 0;
  });
}

export const classify = (d, t) => { let k = 0; while (k < t.length && d >= t[k]) k++; return k; };

// classifier (x, y, d) -> belt index; thresholds wobble by amps[k] x smooth noise (interfingering), amps = 0 gives plain thresholds
export function makeClassifier(t, amps, { seed = 1, wl = 1 } = {}) {
  const N = t.map((_, k) => (amps && amps[k] > 0 ? valueNoise(seed * 977 + k * 131, wl) : null));
  return (x, y, d) => { let k = 0; while (k < t.length && d >= t[k] + (N[k] ? amps[k] * N[k](x, y) : 0)) k++; return k; };
}

// well description -> [first, last] belt index (null if unknown); "A / B" gives two adjacent belts
const norm = s => ' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/ies\b/g, 'y').replace(/s\b/g, '') + ' ';
export function matchBelt(env, belts) {
  const best = part => {
    const e = norm(part); if (e.trim() === '') return -1;
    let hit = -1, len = 0;
    belts.forEach((b, i) => { for (const nm of [b.name, b.id, ...b.alias]) { const n = norm(nm); if (n.trim() && (e === n || e.includes(n)) && n.length > len) { hit = i; len = n.length; } } });
    return hit;
  };
  for (let i = 0; i < belts.length; i++) if ([belts[i].name, belts[i].id, ...belts[i].alias].some(n => norm(n) === norm(env))) return [i, i];   // names may contain "/"
  const parts = String(env || '').split(/\s*(?:\/|\+|&)\s*/).filter(s => s.trim());
  const m = parts.map(best);
  if (!m.length || m.includes(-1)) return null;
  const lo = Math.min(...m), hi = Math.max(...m);
  return hi - lo > 1 ? null : [lo, hi];
}

// graph checks: the adjacency pairs name existing belts, are a connected chain-compatible graph, fringes are allowed pairs
export function validateSystem(sys) {
  const ids = sys.belts.map(b => b.id), errs = [];
  if (new Set(ids).size !== ids.length) errs.push('duplicate belt id');
  for (const [a, b] of sys.adj) if (!ids.includes(a) || !ids.includes(b)) errs.push(`adjacency ${a}|${b}: unknown belt`);
  const has = (a, b) => sys.adj.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  for (let i = 0; i + 1 < ids.length; i++) if (!has(ids[i], ids[i + 1])) errs.push(`consecutive belts ${ids[i]}|${ids[i + 1]} not allowed to touch`);
  for (const [a, b, f] of sys.fringe || []) if (!has(a, b) || !(f > 0 && f <= 0.3)) errs.push(`fringe ${a}|${b} invalid`);
  for (const [, k] of sys.keyLines) if (!(k >= 0 && k < ids.length - 1)) errs.push('key line threshold out of range');
  sys.belts.forEach(b => { if (!/^#[0-9a-f]{6}$/i.test(b.color) || !(b.w > 0)) errs.push('belt ' + b.id + ': colour or width'); });
  return errs;
}

export const systemIds = () => Object.keys(SYSTEMS);
