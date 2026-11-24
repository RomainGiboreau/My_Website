# GDE map generator v2 — realistic palaeogeography (design)

Supersedes the geometry part of `2026-11-24-gde-generator-design.md`; library, calibration,
exports and UI conventions of v1 stay.

## Why
User feedback on v1: maps are geometric bands, not realistic. Real systems are **polarised**
(organised around sediment entry points, asymmetric), the **shoreline is not straight**,
**isolated bodies** exist (carbonate pinnacles, isolated platforms, offshore bars, islands), and
**two environments are often mixed** (interfingering). The user also wants an optional **trend
map** to steer the result.

## Approach chosen: hybrid (C)
The tool proposes a first sketch from the wells and the chosen system (shoreline, shelf edge,
sources), then the user edits everything by hand like on a light table. Approach A (draw all from
scratch) is a special case. Approach B (purely procedural) rejected: results stay "generated".

## Model
1. **Key lines** (editable polylines, drag vertices, add/remove vertices, import as CSV x,y or
   IRAP lines / GeoJSON LineString):
   - shoreline (or depositional limit / lake margin / platform margin, named per system),
   - optional shelf edge / slope break, optional basin-floor limit (toe of slope).
   - Initial sketch: a smooth, slightly irregular line placed from the wells and the template
     (between the most proximal marine well and the most proximal continental well, orientation
     from the transport azimuth), with seeded irregularity.
2. **Proximal–distal field d(x, y)** built from the lines instead of a straight axis:
   signed distance to the shoreline on the land side; between shoreline and shelf edge a
   normalised coordinate (0 at shoreline, 1 at shelf edge) so belts widen where the shelf is wide;
   beyond the shelf edge, distance to the shelf edge scaled to the slope/basin belts (same with the
   toe-of-slope line if given). Belt thresholds stay on this coordinate and are calibrated on the
   wells exactly as in v1.
3. **Sources (polarity)**: point sources placed on the shoreline or shelf edge (initial ones
   proposed from the template, e.g. a delta source; a fan source at the shelf edge), each with a
   type from the system (river / wave / tide-dominated delta, fan, alluvial fan…), supply
   (lobe size), asymmetry (longshore drift: lobe deflected and elongated to one side), and opening
   angle. A source pushes the belts basinward locally (d is shifted by a smooth lobe function), so
   facies are more proximal in front of it and thinner away from it. Along strike, away from
   sources, the template may switch belt names (e.g. delta front → interdeltaic shoreface /
   strandplain) when the template defines "interfluve" variants.
4. **Isolated bodies**: click to place; shape ellipse (size, elongation, orientation) or freehand
   polygon; type from a library (carbonate pinnacle / patch reef: reef core, reef flank / talus,
   off-reef halo; isolated carbonate platform: margin, interior; offshore sand bar / tidal sand
   ridge; island with its own beach / shoreface halo; salt-related high…). Each body has its own
   concentric belts (widths editable) and overrides the regional map inside its outermost halo.
   Wells inside a body are honoured by the body's belts (body size adjusts if needed, reported).
5. **Mixed environments**: transition zones between two adjacent belts with a user width
   (0 = sharp contact), exported as their own class "A + B" (code and colour = mix, drawn hatched);
   option per boundary. A well described "A / B" or "A + B" is honoured if it falls in A, B or the
   A+B zone.
6. **Trend map (optional)**: steers d.
   - Load a grid (ZMAP+, CSV x,y,z, Surfer ASCII .grd): palaeobathymetry, isopach, seismic
     attribute, distance to source…; resampled bilinearly to the map grid; nulls → no trend there.
   - Direction: high values = distal or proximal. Weight 0–100 % between the trend (normalised to
     the d range) and the geometric model; optional smoothing.
   - Paint mode: brush that pushes d proximal or distal locally (radius, strength), stored as a
     grid in the model file.
   - Wells still calibrate thresholds on the blended field.
7. **Wells** as v1 + mixed descriptions ("A / B"); honoured / not table; warping kept as last resort.

## UI
Map editing tools in a small toolbar over the map: Select/drag, Edit line (shoreline, shelf
edge, toe), Add source, Add body, Paint trend (+/−), Pan/zoom (needed now: mouse wheel + drag).
Side panels: 1 Extent & grid; 2 Wells; 3 Depositional system (template, belts, mixed zones);
4 Lines & sources (list with parameters); 5 Isolated bodies (list); 6 Trend map (load, direction,
weight, smoothing, paint); 7 Calibration (auto-fit, warping). "Propose a sketch" button rebuilds
the initial lines/sources from the wells. Undo/redo (at least 20 steps). Model file (JSON v2)
stores everything (lines, sources, bodies, trend grid or painted grid, mixed zones); v1 files still
open.

## Exports
As v1 (PNG, IRAP lines polygons, GeoJSON, polygons CSV, ZMAP+ class grid, grid CSV, wells CSV) +
key lines (IRAP lines / GeoJSON LineString) + mixed classes with their own codes.

## Examples
- Curved coast with two deltas of different polarity (one deflected by longshore drift) and
  interdeltaic shoreface; 5 wells.
- Rimmed carbonate shelf with an irregular margin and three pinnacle reefs in the basin, one
  penetrated by a well; 4 wells.
- Deep-water fan fed from a canyon at an irregular shelf edge, with a trend map (synthetic
  isopach) steering the lobes; 3 wells.

## Tests (TDD)
Signed distance to a polyline (sign, both sides, vertices); normalised shelf coordinate between
two lines; source lobe shifts d basinward and asymmetry deflects it; body overrides with its
halos and honours an inside well; mixed zone class and "A / B" well honoured; trend blending
(weight 0 = model, 100 = trend; direction flip); paint grid round trip in the model file; v1 model
file opens; every example honours all wells; existing tests pass.

## Non-goals
Process-based simulation; 3D; stochastic multiple realisations (possible later).
