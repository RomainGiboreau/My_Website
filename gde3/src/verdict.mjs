// Per-well verdict and the banner rule (from the old page): green only if ALL wells are matched to a class AND honoured;
// amber if none is contradicted but some are not matched; red if a matched well is not honoured.
export const HOW = { belts: 'honoured by the calibrated belts', warping: 'honoured by local warping', not: 'not honoured', unmatched: 'not matched to a class' };

export function wellVerdict(range, beltPlain, beltWarped) {
  if (!range) return 'unmatched';
  const ok = b => b >= range[0] && b <= range[1];
  return ok(beltPlain) ? 'belts' : ok(beltWarped) ? 'warping' : 'not';
}

export function banner(verdicts) {
  const N = verdicts.length, un = verdicts.filter(v => v === 'unmatched').length, bad = verdicts.filter(v => v === 'not').length, k = N - un - bad;
  const state = !N ? 'none' : bad ? 'bad' : un ? 'warn' : 'pass';
  const head = state === 'pass' ? (N === 1 ? 'The well is honoured' : `All ${N} wells honoured`) : `${k} of ${N} ${N === 1 ? 'well' : 'wells'} honoured` + (un ? `, ${un} not matched to a class` : '');
  return { state, k, N, un, bad, head };
}
