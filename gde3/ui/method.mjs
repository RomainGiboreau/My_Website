// Data object of the shared "Method & sources" panel (same convention as the other tool pages): what, method, sources [item, source, status],
// validation, limits, date. Source rows of the systems are taken from the references of the system records (gde3/src/systems.mjs).
import { SYSTEMS } from '../src/systems.mjs';

const own = (item, src, status) => [item, src, status];
const sysRows = Object.values(SYSTEMS).flatMap(s => s.refs.map(r => [s.name, r.text, r.status]));

export const METHOD = {
  what: 'Runs entirely in your browser: nothing you type or load leaves your machine. Draws a first-pass gross depositional environment (GDE) map from the environments interpreted at a few wells and ONE depositional system chosen among three (wave-dominated shoreface–shelf, delta with river / wave / tide regimes, rimmed carbonate platform). Three steps: wells (pasted table or clicks), system (one choice and three sliders: scale, dominant regime, transport direction), result (map, verdict, how each well is honoured, source → sink chain, exports). This is a <b>concept map, not a prediction</b>: it draws the geometry a geologist would sketch by hand, with logical neighbours, and says which wells it honours. It is the new, rewritten version of the GDE map generator; the previous version stays online.',
  method: [
    '<b>Systems are data.</b> Each system is a record: belts from proximal to distal with relative widths and colours, the <em>adjacency graph</em> (which belts may touch), the interfingering allowed between neighbours, the key lines, the features and the references. Adding or tuning a system is editing a record, not code.',
    '<b>Key lines and proximal–distal field.</b> The shoreline, shelf (or platform) edge and toe of slope are smooth curves (draggable under Edit). Between two lines the distance field d runs linearly in the normalised coordinate, so belts widen where the lines are far apart; d increases from land to basin and is continuous.',
    '<b>Belts on d, calibrated with the minimum change.</b> The belt boundaries are thresholds on d. Each well imposes bounds on the thresholds around it; among all threshold sets that honour the wells (and keep every belt a minimum width) the one closest to the concept widths is taken: a projection on a convex set, computed by pool-adjacent-violators on bounds. This solution varies <b>continuously</b> with the well positions, which is why moving a well changes the map by a small, bounded area.',
    '<b>Contradictory wells.</b> If no map honours all wells, the smallest set of wells whose removal makes the rest feasible is excluded and reported with the reason (which kept well it cannot coexist with); the map is not rearranged for it. The optional local warping bends d around that well with a bounded amplitude and radius and never moves a boundary near a consistent well.',
    '<b>Features.</b> One generic type, {host, shape, size, orientation, relation}: lobes (arcuate, bird-foot, funnel), bars, banks, patch reefs, ribbons (channels with levees, shoreline sand ribbons). A feature may only be placed in its allowed host belts: lens shapes are shrunk, ribbons truncated, until every point of them lies in a host belt. They are positioned in belt coordinates, so they follow a boundary that moves. The delta regime slider selects the feature set (river: distributary channels, bird-foot lobes, mouth bars; wave: arcuate lobes, beach-ridge ribbons; tide: tidal bars, funnel-shaped distributaries).',
    '<b>Verdict.</b> Green only if every well is matched to a belt and honoured; amber if some are not matched; red if a matched well is not honoured. Each well is reported as honoured by the calibrated belts, by local warping, or not honoured.',
    '<b>Source → sink chain.</b> The belts of the system in order, greyed when absent from the current map, with the dominant process of each (river, wave, tide, storm, gravity flows, settling); optional process arrows on the map.',
    '<b>Exports.</b> PNG (map, legend, wells, scale bar, coordinates, chain strip); belt and feature polygons as GeoJSON and IRAP Classic lines (grid boundaries traced and lightly smoothed); ZMAP+ grid of belt codes; key lines; wells CSV; audit JSON with the inputs, prior and calibrated thresholds, feasible intervals and verdicts. Reproducible: the same input and seed give the same map.'
  ],
  sources: [
    ...sysRows,
    own('Minimum-change calibration', 'Projection of the prior thresholds on the order-restricted feasible set by weighted pool-adjacent-violators (isotonic regression with bounds), Barlow, Bartholomew, Bremner & Brunk (1972), Statistical Inference under Order Restrictions, Wiley', 'memory'),
    own('Delta regime multipliers and feature sets', 'Judgement of this page (shapes after the concept reference images, which are AI-generated illustrations, not scientific sources); to calibrate on published examples', 'inference'),
    own('Feature sizes and positions', 'Plausible orders of magnitude as fractions of the belt span; no published statistics were applied', 'inference'),
    own('Interfingering amplitudes', 'Fraction of the narrower neighbouring belt, capped at 0.3; a judgement', 'inference')
  ],
  validation: [
    'Self-check script scripts/gde3_test.mjs (22 tests). Logic: on every output of every system and regime (random key-line shapes, seeds, well sets, with and without warping) belts touch only the neighbours allowed by the adjacency graph and are ordered proximal → distal; features lie in their host belts (every ring point, inner samples and every covered cell). Reproducibility: same input and seed give the same map, features and verdicts.',
    'Wells: consistent well sets sampled from a truth map (thresholds jittered by ±40 % from the concept) are always honoured by the belts, with no conflict; the calibration is checked to be the minimum change (no feasible perturbation is closer to the concept); a contradictory well is always reported and changes at most 5 % of the cells.',
    'Stability on the three acceptance sets (the examples of this page), share of cells whose class changes when one well is moved by 5 % of the map width: 4.9 % (set A), 5.1 % (B), 3.3 % (C); with the features on, 5.3 %, 6.7 % and 3.3 %. Sweep of ±4 % in steps of 0.1 %: worst step 0.4 % with or without features. Bounds in the test: 8 % for the 5 % move, 3.5 % for a sweep step. The previous version moves 13 % of the cells in the same test on set A.',
    'Examples with wells: A shoreface–shelf, B wave-dominated delta with a lobate shoreline, C rimmed carbonate platform; in each, well 3 lies beyond the concept limit of its belt, so a boundary has to move.'
  ],
  limits: [
    'A concept map: belt widths and feature sizes are generic proportions, not measurements. The wells calibrate the boundaries between the belts they constrain; the rest stays the concept.',
    'Three systems only (shoreface–shelf, delta, rimmed platform); fans, ramps, margins, fluvial and lacustrine systems are not yet in this version. Use the previous GDE map generator for them.',
    'No attribute layers, faults, sources of sediment as objects, EOD or facies atlas levels, leave-one-out or model file: not carried over yet.',
    'The map is planar, projected coordinates in metres are assumed (the scale bar says metres or km). Belts are parallel to the key lines, so complete deltaic radial geometry is represented by lobes and key-line shape, not by a radial coordinate.',
    'Exported polygons are traced from a 200 × 200 grid and smoothed; neighbouring polygons are simplified independently, so slivers of the order of half a cell can appear between them. Features are exported as separate polygons and may overlap the belt polygons.',
    'The wells are matched to belts by name and aliases; an environment that matches no belt is reported as not matched, never guessed. Features are not used as constraints: a well in a feature is only checked against its belt.'
  ],
  date: '27 November 2026'
};
