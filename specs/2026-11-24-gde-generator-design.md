# GDE map generator — design

## Intent
Produce a Gross Depositional Environment (GDE) map for one interval from (1) the depositional
environment interpreted at one or several wells and (2) the depositional system assumed a priori.
With one to a few wells, interpolation between wells cannot make a credible map: the conceptual
model does most of the work, the wells calibrate it — the way a geologist draws a GDE by hand.

## Goals / non-goals / anti-goals
- Goal: a defensible first-pass GDE map in minutes, honouring every consistent well, with the
  model choices visible and editable (template, transport direction, source, belt widths).
- Goal: exports usable elsewhere: PNG, polygons (IRAP lines for Petrel, GeoJSON), class grid
  (ZMAP+, CSV), wells check table.
- Non-goal: stochastic facies modelling, palaeogeographic reconstruction, 3D.
- Anti-goal: a map that silently contradicts a well. Every well is reported honoured / not honoured.

## Approaches considered
1. **Conceptual belts on a proximal–distal coordinate, calibrated on the wells** — chosen.
2. Indicator interpolation of well facies (nearest neighbour / indicator kriging) — rejected:
   meaningless with 1–5 wells, ignores the depositional model.
3. Free drawing with snapping to wells — rejected: no model, nothing a user cannot do in a GIS.

## Model
- **Templates** (ordered belts, proximal → distal, default relative widths, colours from a
  conventional GDE palette):
  - Wave-dominated shelf: coastal plain, shoreface, offshore transition, offshore shelf, slope, basin.
  - River-dominated delta: delta plain, delta front, prodelta, shelf, slope, basin (radial).
  - Deep-water fan: slope / canyon, channel–levee complex, proximal lobes, distal lobes / lobe
    fringe, basin plain (radial).
  - Carbonate platform: inner platform / lagoon, platform margin (reef / shoal), fore-reef slope,
    basin.
  - Fluvial: alluvial fan / proximal, braided plain, meandering belt, floodplain–coastal plain.
  - Custom: user-editable list of belts (names, order, colours, relative widths).
- **Geometry** — a proximal–distal coordinate d(x, y) over the map:
  - Linear (shoreline-parallel belts): d = projection on the transport azimuth.
  - Radial (delta, fan): d = distance from a source point, belts limited to a fan opening angle
    around the transport azimuth; outside the fan the most distal belt (or basin) applies.
  - Boundary irregularity: seeded smooth noise added to d (amplitude and wavelength set by the
    user, 0 = straight belts), so boundaries look natural and the result is reproducible.
- **Calibration on wells**:
  - Each well is assigned a belt index from its environment.
  - Thresholds t1 < … < tn−1 on d: for each boundary the feasible interval is
    (max d of wells in more proximal belts, min d of wells in more distal belts); the threshold is
    put at the template's prior position when it falls inside the interval, otherwise at the
    middle of the interval. Unconstrained boundaries keep the prior widths, scaled to the
    constrained ones.
  - Auto-fit of the transport azimuth (and source point for radial) by scanning, maximising the
    number of wells whose order is consistent, then the feasible margin.
  - Wells still inconsistent with the ordering: optional local warping — a smooth residual field
    (Gaussian RBF of the d offsets needed at those wells) added to d so they fall in their belt;
    the radius of influence is shown and adjustable. Without warping they are reported as
    conflicts.
- **Outputs**: belt grid on a regular grid (user cell size), polygons traced from it (same tracing
  and shared-arc simplification as the Discrete map digitizer), wells table (environment, belt
  given by the map, honoured yes/no, distance to the nearest boundary).

## UI
Standalone page `docs/gdemap/index.html` in the site's tool style: side panels (1 Map extent and
grid; 2 Wells: paste table name, x, y, environment or click on the map; 3 Depositional model:
template, belts editor, geometry linear/radial, azimuth, source point, fan angle, irregularity,
seed; 4 Calibration: auto-fit, warping on/off and radius), main map canvas (belts, boundaries,
wells with labels and a tick/cross for honoured, source point and azimuth arrow, legend, scale),
wells check table, exports in the top bar, Method & sources. Example: a deltaic system with 4 wells
and a deep-water fan with 3 wells.

## Left to the builder
Palette details, noise implementation, exact scanning steps, page layout within the site style.
