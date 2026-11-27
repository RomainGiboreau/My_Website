# GDE map generator v3 — clean rewrite (design draft, 27 Nov 2026)

Supersedes the code structure of v1/v2 (`2026-11-24-gde-generator-design.md`, `2026-11-25-gde-v2-design.md`). Kept from v1/v2: wells + calibration + honoured verdict,
depositional systems, source → sink chain strip, exports (PNG, ZMAP+, grids, polygons). Old `docs/gdemap/` stays online until v3 covers these.

## Why (user feedback, 27 Nov)
- The maps are not LOGICAL: the relations between facies / depositional environments are not respected.
- Moving one well gives a stupid map: the result is not stable.
- The code (3,600 lines, one file, ~20 special object kinds) and the UI (panels and modes piled up) grew wave after wave.

## Success tests (written first, they decide the rewrite)
1. **Logic invariants** on every output of every system: environments only touch the neighbours allowed by the system's adjacency graph
   (no delta plain against deep basin, no shoreface against slope without a shelf, no reef margin against a continental belt…),
   ordered proximal → distal along any transport path; isolated bodies sit inside an allowed host environment.
2. **Stability**: moving a well by a small distance (or swapping a well for another consistent one) changes the map by a bounded, small area
   (measured as the % of cells whose class changes); no sudden reorganisation. A well that contradicts the ordering is reported, never allowed
   to scramble the whole map.
3. **Wells**: a consistent well set is honoured; the verdict says how (belts / local warping / object at the well) and leave-one-out is available.
4. **Reproducible**: same input + seed = same map.

## Model (three layers)
1. **Key lines + proximal–distal field d(x, y)**: shoreline, shelf / slope break, toe of slope (editable polylines), from v2.
2. **Belts on d, calibrated on the wells**: the calibration solves for thresholds with explicit feasible intervals and a prior
   (template widths); the solution is the one closest to the prior (minimum change), which makes it continuous in the well positions
   (this is what gives the stability test). Local warping only for residual conflicts, with a bounded amplitude and radius.
3. **One generic Feature type** replaces the special object kinds: `{host, shape, size, orientation, relation}` with presets
   (lobe, bar, channel + levees, shoreline ribbon, patch reef, bank, canyon, fan…). A feature may only be placed in its allowed host belts.

## Systems as data
Each system is a record, not code: ordered belts with default widths and colours, the **adjacency graph** (allowed neighbours, allowed
interfingering), features with parameters and their host belts, regime parameters (e.g. delta: river / wave / tide), scale range, references and
status (published / memory). Delta river / wave / tide, fans, platforms, ramps, margins, fluvial, lacustrine = records. Adding or tuning a system
from a reference image = editing a record. The adjacency graph is validated by the tests above.

## UI
Three steps: 1 Wells (paste or click), 2 System (one choice + 3 sliders: scale, dominant regime, transport direction), 3 Result (map, verdict,
source → sink chain, exports). Fine editing of key lines and features under an "Edit" menu. No other panels.

## Code layout
Source modules (geometry, field, belts, calibration, features, systems data, exports, render, UI) each with their own tests, assembled into
the self-contained page by a small build script (`scripts/build_gde.mjs`); the built `docs/gdemap/index.html` stays self-contained. During the
transition v3 lives at `docs/gdemap3/` (menu entry "GDE map generator (new)") and replaces `docs/gdemap/` once the four user requirements above are met.

## Build order
1. Core: adjacency graph format, d-field from key lines, calibration with minimum change + the stability and logic tests (no UI).
2. Systems data for the three examples the user cares about first (to confirm with the user): shoreface-shelf, delta (river / wave / tide), carbonate platform.
3. Features, then the UI (three steps), exports, chain strip.
4. Remaining systems (fans, ramp, margins, fluvial, lacustrine), then swap with the old page.

## Open questions
- Which three systems first, and which real examples with wells to use as acceptance cases (the user to provide real or realistic wells).
- Whether v3 replaces the old page at once or the two coexist for a while.
