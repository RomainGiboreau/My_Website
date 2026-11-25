# GDE map generator — margin profile (design addendum to v2)

## Why
User: "On a margin you go progressively from a continental system, then coastal, open marine to
deep marine. That is also what gives the realism." A v2 map uses one template; real GDE maps of a
margin chain several systems along the source-to-sink profile, each in its domain, with gradual
transitions and linked feeders (a river feeds a delta, the delta's shelf-edge position feeds a
canyon and a basin-floor fan).

## Model
- **Domains along the profile**, separated by the key lines already in v2:
  continental (landward of the shoreline) | coastal & shallow marine (shoreline → offshore
  transition) | shelf / open marine (→ shelf edge) | slope (→ toe of slope) | deep marine (basin
  floor). A domain without its line is omitted (e.g. a lake margin, an epicontinental sea without
  shelf edge).
- **One system per domain**, chosen from the library (filtered to the systems valid in that
  domain): e.g. continental = fluvial (alluvial fan → braided → meandering → coastal plain) or
  aeolian; coastal = river-, wave- or tide-dominated delta / strandplain / estuary at each source,
  shoreface between sources; shelf = siliciclastic shelf, carbonate ramp or rimmed platform, mixed;
  slope = slope apron / MTC; deep = sand-rich / mud-rich / mixed fan(s) and basin plain.
  "Margin presets" fill all domains at once: siliciclastic passive margin (fluvial → deltas +
  shoreface → shelf → slope → fans), carbonate rimmed margin (coastal plain/sabkha → lagoon →
  rim → slope → basin with pinnacles), mixed margin, rift lake (alluvial/fan delta → shoreline →
  littoral → profundal with border-fault fans), arid margin (erg → sabkha → shelf…).
- **Gradual transitions** between domains and between belts: transition widths (mixed zones v2)
  default on at domain boundaries (e.g. coastal plain ↔ lower delta plain, shelf ↔ upper slope),
  so the map grades instead of jumping.
- **Linked feeders (source-to-sink)**: a river source on the shoreline draws a fluvial valley /
  channel belt landward (into the continental domain, not a spike of delta plain) and, optionally,
  a shelf-edge delta / canyon in line with it that feeds a deep-water fan at the toe of slope. One
  "feeder" object holds river → delta → canyon → fan, editable as a whole or per element.
- **Delta shape fix**: the delta plain spreads seaward from the apex at the valley mouth as a fan
  of distributaries; landward of the apex there is the fluvial valley (continental domain), not
  delta plain. Delta front wraps the seaward edge; drift asymmetry as in v2.
- **Fan-delta fix** (rift): elongated, coalescing lobes along the border fault (bajada), not
  concentric targets; size from the fault segment / relay ramp.

## UI
Concept section: "Margin" preset select + per-domain system selects (collapsed by default), feeder
list (river / delta / canyon / fan toggles per feeder). Legend groups classes by domain.

## Examples
Replace the two-delta example by a full passive margin: fluvial hinterland with two rivers, two
deltas of different polarity, interdeltaic shoreface, shelf, shelf edge with one canyon in line
with the larger delta, slope with an MTC apron, basin-floor fan, basin plain; 6 wells across the
domains. Update the rift example (bajada of fan deltas). Carbonate margin preset with continental
sabkha/coastal plain landward.

## Tests
Domain assignment from key lines; each domain uses its system's belts; presets fill all domains;
transitions present at domain boundaries; river source produces valley belts landward and delta
belts seaward (no delta plain landward of the apex); linked canyon + fan aligned with the feeder;
examples honour all wells; all existing tests pass.
