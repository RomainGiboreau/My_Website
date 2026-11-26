# Review fixes (26 Nov 2026) — one agent per tool

Source: five expert reviews run on 26 Nov 2026 (read-only, synthetic data). The calculation cores were recomputed independently and are
right; the defects are at the edges: input decoding, validation, stale state, interchange files, and verdicts that reassure wrongly.
Each tool is fixed by one agent in its own git worktree/branch. GDE generator is fixed last.

## Rules for every agent

1. Work only in your worktree (path given in your prompt), only on your tool's page `docs/<tool>/index.html` and its test `scripts/<tool>_test.mjs`
   (create the test if none exists; extract the `<script id="...-core">` block like the other tests do; if the page has no separate core block,
   add one only if straightforward, else test by extracting functions). Never edit other tools' pages, `mkdocs.yml`, `docs/index.md`.
2. For every defect listed for your tool: (a) reproduce it first (write the failing test or script, keep it as a regression test), (b) fix it,
   (c) check the test now passes. Fixes that change a number a user sees must say so in the page's Method & sources "validation" or "limits".
   Do not change calculations that were verified as right. Do not add features beyond the listed fixes unless trivial and clearly needed.
3. Keep the visual style. No external libraries, no Python (not installed; use node for scripted edits). The pages may mix LF and CRLF line endings:
   handle both in multi-line replacements. UI language English.
4. After editing run: your tool's test, `node scripts/site_check.mjs` (0 problems), and a headless Edge check of the page with the example loaded and
   with the failing inputs of your list ("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --user-data-dir=<fresh temp dir>
   --window-size=1400,1000 --virtual-time-budget=15000 --screenshot=<png> file:///<abs path>; drive the page with an injected `<script>` in a temporary copy
   kept in your private temp dir). Use a private temp dir for scratch files (never generic names like core.js in the shared scratchpad).
5. Update the page's "Method & sources" data object (`({"what":..., "method":..., "sources":..., "validation":..., "limits":..., "date":...})` at the end of the page)
   honestly: new behaviour in method/validation, removed limits, date "26 November 2026". Sources stay scientific publications only (no vendor documents, no GitHub READMEs);
   statuses use the existing vocabulary. The Method script must still parse (`site_check`).
6. Commit on your branch (small commits fine), never push, never touch main. End every commit message with:
   `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
7. Final report in French, concise: for each listed defect: fixed / not fixed (why) + the regression test name; new behaviour a user will notice; anything left or uncertain.

## Shared contract A — decoding numbers and tables (implement in your own page, the pages are self-contained)

Applies to every tool that reads pasted text or files of numbers. Implement as a small pure function block in the page's core and test it.

- `parseNumber(text)` returns `{value, kind}`; kinds: `ok`, `missing` (empty, `-`, `n.d.`, `nd`, `NA`, `NaN`, `null`), `below` (`<0.1`, `<0,1`: value null, flagged "below detection limit", the numeric limit kept if the tool can use it), `text`.
  Accept: `1234.5`, `1,234.5` and `1 234.5` (thousands separators), `1.234,5` and `1 234,5` (European), `1,5` and `0,55` (decimal comma),
  `1e-3`, `1E+30`, unicode minus, leading `+`. A single comma followed by exactly three digits and nothing else (`1,234`) is ambiguous: treat it as decimal comma ONLY if the whole
  column uses a decimal comma elsewhere (some value with a comma followed by a number of digits other than three, or a `;` delimited file), otherwise as a thousands separator; and report the ambiguity once in the load message.
- `detectDelimiter(lines)`: choose among tab, `;`, whitespace runs, `,` the one giving the same number of fields on the large majority of non-empty lines and at least 2 fields; a comma is a delimiter only if no line of the file uses a decimal comma pattern (`\d,\d{1,2}(?!\d)`) with another delimiter available. Never split `100 0,55` on the comma.
- Header detection: a first line with a non-numeric field is a header; a header is optional. Column names are matched case-insensitively, trimmed, ignoring units in brackets, and with the tool's own synonyms.
- Skipped rows are COUNTED AND SHOWN: after every load show `N rows read, M skipped` and the reasons (non-numeric, missing, below detection, sentinel, out of range) with the first line numbers.
- Never silently clip, round or reinterpret a value.

## Shared contract B — failed load must not leave stale results

When a load/parse fails or yields too few rows: clear the previous dataset, tables and charts (or grey them with a visible banner "showing the previous data, the last load failed") and show the error. Default: clear. Test it.

## Shared contract C — null sentinels

Tools that read numeric data from the user get a "null value(s)" field, default list `-999, -999.25, -9999, 9999, 1e30, 1.70141e38` (shown, editable, can be emptied). Values equal to a sentinel are excluded (not used as data) and counted in the load message ("12 values equal to the null value -999 were excluded"). A candidate sentinel found in the data but not in the list ("-99999 appears 40 times") produces a warning, not an exclusion.

## Shared contract D — interchange files (risking, distfit, fdp, portfolio, wellpos)

`prospect-risk` files keep `format:'prospect-risk', version:1` and the optional `summary` object. Version 2 of the summary (backward compatible: readers must still accept v1) adds:
`summary.version: 2`, `summary.quantiles: [[pExceed, volumeMMboe], ...]` — 21 points at exceedance probabilities 0.99, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0.03, 0.02, 0.01, 0.005, 0.001 (success case, volume strictly decreasing with p increasing... i.e. increasing volume as pExceed decreases),
`summary.mean`, `summary.dist: {family, params}` (informative), `summary.computedBy` (tool name + date). Writers: Prospect risking (from its own distribution: lognormal analytic, or the Monte Carlo sample) and Distribution fitting (from the selected fitted distribution; add a warning at export when the family is not lognormal that the chosen distribution is exported through its quantiles). Reader: Portfolio rebuilds each prospect's volume distribution by monotone interpolation of the quantiles (log-linear in volume between points, exponential tail beyond the last point is not allowed: truncate at the last point and say so) and uses `summary.mean` only as a check; if `quantiles` is absent it falls back to the lognormal from P90/P50/P10 and shows a visible per-row marker "approximate volumes (lognormal from P90/P50/P10)". Whenever a file has no summary at all, the readers show a per-prospect warning: "no summary: gas, correlation, likelihood ratios, conditional chances and ESL are ignored".
`fdp-link` files keep `format:'fdp-link', version:1` and gain `version:2` fields: `marginalValue` (dNPV/dV at the MEFV in USD per boe, central difference over ±5 % of reserves, same fiscal terms), `npvCurve: [[reservesMMboe, npvMMUSD], ...]` (9 points from 0.4x to 2.5x of the base reserves, log spaced), `fiscal` (a short text: regime, royalty, tax or PSC settings), `computedBy`. Readers (risking, portfolio) take MEFV as before and may offer `marginalValue` as the net value u (with the visible note that u is the slope of the NPV near the MEFV, not an average).

## Per tool findings

Severity: C critical, M major, m minor. Repro as observed by the reviewers.

### logcorr (Log correlation, DTW)
- C: the "block shuffle" null test gives p < 0.05 for 18/24 pairs of UNCORRELATED AR(1) logs (phi 0.9) and 19/24 (phi 0.98): shuffled blocks have discontinuities so their DTW cost is always higher than a smooth B; p measures smoothness, not correspondence. Remove it or replace it by a valid null: phase-randomised / IAAFT surrogates that preserve the amplitude spectrum, calibrated; add a test that measures the false-positive rate on uncorrelated AR(1) logs (target at most ~10 % at alpha 0.05 over >=100 trials, state the measured rate on the page).
- M: the AR(1) null is anticonservative for strongly autocorrelated logs (phi 0.98: 21 % rejections at alpha 0.05). Same replacement and test.
- M: Pearson r along the DTW path is shown as a quality metric but is high for unrelated smooth logs (r = 0.88 for two uncorrelated AR(1) phi 0.95). Keep it only with an explicit warning next to it, or replace by a rank-based or null-calibrated score; never present it as evidence of correlation.
- m: decimal comma in two-column tables turns every value into NaN and ends with a misleading "depth range is empty": use contract A. Sentinel -999.25 in tables is kept as a real value: contract C. Depth unit of B (ft vs m) is not checked: add a unit field per log and a warning when ranges/steps suggest ft vs m.
- Contract B for stale results after a failed load.

### source (Source rock potential)
- M (silent wrong numbers): the thickness column is guessed with `/^(thick|thickness|h|epaisseur)/` which matches "HI". A standard Rock-Eval file with a HI column and no thickness gives thickness 400 m per sample, SPI 18 t HC/m2 and potential 16 Mt/km2 (about 40x too high). Anchor to `^(thick|thickness|epaisseur|h)$` or `^h\s*\(` / `^h_m`, exclude HI, OI, PI, never default to a guessed column that is not clearly a thickness; and when the chosen thickness column has values outside 0.01..1000 m warn.
- m: if one thickness is missing, SPI and resources become "-" silently and averages become unweighted without a message: show a message with the count.
- m: a failed load leaves the old dataset (contract B). Text values (`<0.1`, `n.d.`) become NaN silently: contract A with counts.
- m: the Resources section converts all S2 into oil bbl or gas bcf: add a visible note in the table title ("potential, not volume in place: no expulsion efficiency or retention").

### digitizer (Plot digitizer)
- M: automatic extraction fails silently when the tolerance is wrong, the line is thin, or the image is JPEG. The picked colour is the mean of a 3x3 around the click, which mixes with the background (a 2 px line #c0392b gives #d57a71). With a 1 px anti-aliased line and tolerance 40 to 80, mean error about 90 px (22 units of 100); JPEG q 0.6 and tolerance 80: 179 px; tolerance 120: all 297 points wrong; the message is only "299 points added". Fix: pick the colour as the purest/most saturated pixel (or the median of the darkest-distance pixels) in a small neighbourhood; after extraction run plausibility checks and show a warning (not "N points added") when: vertical jump between consecutive columns exceeds a set fraction of the plot height, the mask covers more than 3-5 % of the plot area or touches grid lines, the number of points is far from the expected (the plot width in px), or the tolerance was edited after the click; show the number of points, the mask coverage and the pixel size in data units (resolution) with every extraction.
- M: two curves of the same colour that cross: the tracker jumps from one to the other (mean error 99 px, 185/299 points wrong): add a continuity prior (nearest to the previous point's slope) and a warning when several candidate segments exist in a column; add the limit to the page.
- m: CSV exports raw JavaScript doubles (15 digits) while the table shows 7: export at a precision consistent with the pixel resolution; "curve" mode is one point per column (bad for near-vertical curves): add to limits.
- Export the calibration (axis points, log flags) and parameters (colour, tolerance, mode) in the file header/JSON for an audit trail. Contract B.

### las-checker
- M: a gap in depth is never detected. STEP 0.25, depths 1000, 1000.25, 1000.5, 1002.5, 1003 gives only "W well.step ... irregular: it should be 0". The auto-fix (on by default) then writes STEP=0, erasing the only clue. Add a rule `data.gap`: list each interval where dz exceeds the step by more than a set factor (default 1.5x), with line number and size; report the number and the largest gap; do not let the STEP fix hide it (when gaps exist the fix must not write STEP=0 silently: say it).
- M: the verdict "Ready to load / No problem found" ignores everything classified "I": GR from -5000 to 500000, constant RHOB 0, an all-null curve, an isolated GR spike all give "pass". Change the headline: when any data-plausibility "I" exists, show "Loads. N points to look at" (amber), not the green ready badge; keep green only when nothing at all is flagged.
- M: feet labelled M are not detected below 12000 (depth 9000-15000 labelled M only gives "I well.depthunit"). Add a cross-check of depth range and step against the unit (step 0.1524/0.3048/0.6096 hint of ft, 0.1/0.2/0.5 hint of m, KB-like depths) as a warning "unit may be feet".
- m: `~A` column order does not match `~C` curve order (e.g. `DEPT RHOB` vs `DEPT GR`): warn when ~A has a header line that differs from ~C names. Placeholder well names like UNKNOWN/NONE/N/A pass the well-name check: flag them as "I". The list of candidate nulls (9999, 32767, 999.25...) can flag real values: keep as W but say it is a candidate.
- Add an exportable QC report (CSV/text): per curve n valid, % null, min/max, interval covered, flags; plus the list of changes made by the fixes.

### risking (Prospect risking)
- M: an empty element list gives gCOS 100 % with EMV 525 $MM and no warning: block with a red banner and no tiles (or tiles dashed) until at least one element exists.
- M: F negative accepted (F = -100, u = 9: MEFV -11.1, eCOS 100 %, EMV 835); D negative accepted (EMV +167); u <= 0 gives MEFV infinity silently. Validate: F >= 0, D >= 0, u > 0, reserves/volumes > 0; red banner with the reason and results hidden or dashed.
- M (design trap): ESL with all-white elements and neutral stance gives gCOS 50 % (classic 1.56 %). Keep classic as default (it is); when ESL is the source of gCOS and the total white mass exceeds 50 % show an amber warning "most of the chance rests on the unknown mass".
- m: probability not numeric or outside 0..1 is clipped silently (1.5 to 1, -1 to 0, 'abc' to 0): show a per-element red marker and a message; do not clip silently.
- m: QC only exists for the volumetric mode: add QC for u, F, D, MEFV, element count. The P90 > P10 error should explain the exceedance convention (P90 is the LOW case) in the message.
- Contract D (writer): add `summary.version: 2`, `quantiles`, `dist`, `computedBy` to the saved file; keep v1 fields. Test round trip with the existing portfolio reader (portfolio will accept both).
- Contract A for pasted numbers if any.

### fdp (Field development screening)
- M: an empty capex phasing list clears the capex (phasing [] gives NPV +2407 instead of -1336, MEFV 7.3) with no message. Validate: phasing must have at least one non-negative number summing to > 0; otherwise red banner and the default [100].
- M (interchange): the MEFV assumes a nonlinear NPV(reserves): NPV at 40/60/80/100/120/160/240 MMboe = -422/-67/226/457/661/993/1480; local slope 14.6 $/boe near the MEFV, 8.3 between 120 and 160. Risking computes F = MEFV x u with a typed u, so at V = 120 it gets 504 against 661 in the FDP. Implement contract D (`marginalValue`, `npvCurve`, `fiscal`, `computedBy`), and show the marginal value in a tile next to the MEFV ("NPV slope at MEFV, $/boe").
- m: price <= 0, reserves <= 0, tax or royalty outside 0..100 % are computed without a warning; "short" is true for reserves 1e6. Validate with red messages. Document that price and discount rate are real (no inflation) in the input help, not only in the label.
- m: depreciation truncation leaves undeducted remainder when the producing life is shorter than the depreciation period: say so in limits or deduct the remainder in the last year (state which).

### portfolio
- M: importing several Prospect risking files puts all of them in "Play A" and silently replaces each prospect's displayed gCOS (two files with gCOS 0.2142 (play 0.51) and 0.0756 (play 0.18) both show 0.1449 after import with the averaged play 0.345). Fix: each imported file gets its own play named after the prospect (or file) by default, never averaged silently; if the user types the same play name for several prospects whose play chances differ, show a per-row warning and use a clearly labelled rule (mean) in the play table with both values visible; the displayed gCOS must equal the file's gCOS unless the user changed it.
- M/m (interchange): the volume distribution is refitted as a lognormal from P90/P50/P10 (a triangular Monte Carlo prospect: EMV -3.35 in portfolio against -4.37 in risking). Implement contract D (reader): rebuild from `summary.quantiles`; per-row marker when approximate; ignore `mean` except as a check.
- m: files without summary: per-row warning (contract D) listing what is ignored; gas without summary gives P50 43.0 instead of 10.2.
- m: non-numeric rho/rhoPlay from JSON gives NaN (EMV 94.7 vs 91.9) — sanitise on load; play names are whitespace-sensitive ("Play A " is another play): trim; pPros with a decimal comma in a file gives NaN gCOS: contract A.
- m: learning does not preserve marginals (k = 3: 1.469 discoveries vs 1.4475 sum of gCOS): documented; keep, make the message visible next to the tile.
- Document that the drilling cost is spent for all prospects of a play even after the play fails (no sequential stop rule): add a visible note in the Method and next to the budget.

### wellpos (Contact and well POS)
- M: decimal comma in the area-depth table: `2000;0,5` becomes 0 and `2100;4,5` becomes 4, silently (the splitter `[\s,;]+` cuts on the comma): contract A; GRV was wrong.
- m: a well above the crest (z = 1900) gives POS = P(G) without a warning: warn that the well is above the crest of the structure.
- m: P(G) read from a Prospect risking file without summary ignores likelihood ratios, conditional chances and ESL (0.2142 instead of 0.2818 / 0.1314): contract D per-file warning; use the summary when present.
- m (method): importing the risking gCOS as P(G) already contains trap/seal/reservoir effectiveness, while the limits (spill, seal capacity) model them again: add a visible warning box "double counting: remove trap/seal elements from P(G) or the corresponding limits" with an option to type P(G) without those elements.
- m: a normal limit truncated to [crest, zmax] piles mass at the crest unlike the other distributions (empty trap): make the treatment consistent (or document it prominently).

### distfit (Distribution fitting)
- M: decimal comma misread: `1,5\n2,5\n3,5\n4,5` gives two columns [1,2,3,4] and [5,5,5,5]; `1,5 2,5 3,5` gives 6 values; only `1,5;2,5;3,5` works. Contract A, with a message on the detected delimiter, decimal mark and column.
- M (interchange): "Save as prospect volumes" keeps only P90/P50/P10 which risking reads as a lognormal (400 gamma(1.2, 40) points, best fit Weibull: mean exported 58.5 vs 45.8, P(V>150) 7.6 % vs 2.7 %). Implement contract D (writer): quantiles from the selected fit plus a visible warning at export when the family is not lognormal.
- m: the KS p-value with fitted parameters is far too large (rejection rate 0.000 at nominal 0.05 on 300 samples of n = 30 from the true lognormal) and the page calls it "conservative": reword (it lets bad fits pass) and add a parametric-bootstrap p-value (Lilliefors-type) for KS and AD, seeded, default 200 simulations, on demand.
- m: AIC compares non-comparable models (triangular by moments, beta with data-derived bounds counted in k = 4): mark them "not comparable by AIC" in the ranking.
- Add bootstrap confidence intervals on P90/P50/P10 (on demand).

### mcda
- M: number parsing ambiguity: `1,234` is read as 1.234 and `1,234.5` as NaN: contract A.
- M (method): min-max standardisation before PROMETHEE with thresholds q/p/sigma as a fraction of the standardised range makes the ranking depend on the set of alternatives (3 alternatives [10,5],[8,9],[6,10]: A>C; adding a dominated alternative [0,0] makes A = C). Offer thresholds in the criterion's own units (the standard PROMETHEE practice) as an option and make it the default for a new session unless the user chooses the standardised scale; add a visible note and the existing rank-reversal check button stays.
- m: CR is NaN above 10 criteria (RI table to n = 10): say so or extend with a published RI table only if you can verify it (else keep the message); a constant criterion gets score 0 for all with no warning: warn.
- Move the engine into a `<script id="mcda-core">` block and add scripts/mcda_test.mjs: Saaty 3x3 [[1,3,5],[1/3,1,3],[1/5,1/3,1]] -> w 0.6370/0.2583/0.1047, lambda 3.0385, CR 0.0332; consistent 4x4 CR 0; PROMETHEE V-shape example with flows 0.3667/0.3000/0.1667/-0.8333 (the reviewer's example: 4 alternatives, two criteria, weights 0.6/0.4, p = 2: build it so the numbers are those); sum of flows = 0.

### gridding (Map interpolation)
- M: the manual anisotropy ratio is labelled "minor/major range <= 1" but the code tests `ratio>1.0001` and treats it as major/minor: ratio 0.5 at 30 degrees does nothing and no message; ratio 2 gives "Anisotropy applied: ratio 2.00". Fix the code to follow the label (ratio <= 1 = minor/major, used like the Variogram tool) and show a message whenever the entered value is ignored; accept > 1 by inverting with a note.
- M: no numeric null value: a -999 is used as data. Contract C.
- m: collinear points give "max must be larger than min" (no cause); on a diagonal the mask silently gives 12 nodes of 5151: detect (near-)collinearity and say so. The message "at least 4 points" is inconsistent with automatic kriging that fails with 4 or 5 points ("Too few point pairs"): align thresholds.
- m: cross-validation can highlight TIN as best RMSE on its 91 % subset (the rest is outside the hull): show the number of points evaluated per method and do not rank methods evaluated on different subsets without a note.
- m: the four variogram models differ by 1-2 % in LOO (noise); the example picks Gaussian, unstable with a near-zero nugget: add a note when the best-vs-others gap is below 3 % and prefer the simpler model; minimum-curvature on a plane z = 3+2x-5y shows 0.16 max error: document or fix the iteration/boundary; the kriging standard error is offered without caveat: add "assumes the variogram is known and the field stationary".
- Add `scripts/gridding_test.mjs` (kriging against a hand-solved 6-point system: 11.302647934 / variance 1.070414047 for the reviewer's case spherical c0 0.3, c 2, a 1.5, target (0.5, 0.3) with the reviewer's six points: construct your own six points and solve the system independently in the test; exactness at data points; plane reproduction by universal kriging and TPS).
- Add ZMAP+ export if the zmap writer of docs/gridattr (verified there) can be copied; add a residual map of the cross-validation if cheap.

### variogram
- M: no trend detection: z = 0.1 x + noise (150 points, x 0..1000) gives a fitted sill 1514 and range 1289 for a sample variance 801 with no warning. Add a warning when the fitted sill exceeds the sample variance by more than ~20 % ("probable trend / non-stationarity: detrend") and an optional linear/quadratic detrend.
- M: no numeric null value: -999 on 10 % of points gives variance 90 404, sill 99 165, ratio "circular": contract C.
- m: the "ratio of the independent directional ranges" compares ranges of different models: compute the anisotropy ratio only from a common model and say so; conventions differ between tools (here minor/major <= 1; Map interpolation was major/minor): use the same label text in both.
- m: after an error the previous table stays displayed (contract B). Export of the model should be machine readable (JSON that the interpolation tool can read) in addition to text.

### hull
- m: area without unit: lon/lat 1x1 degree gives "convex area 1": show the unit (m2 or deg2 according to a coordinate-system field or a heuristic) and warn when coordinates look like degrees; stale result after "At least 3 distinct points" (contract B); numeric null -999 used as coordinate (contract C); `limits` is empty although Method mentions planarity and O(n2): fill; fragmentation (96 rings for 3000 points at 70 % of triangles kept) should be mentioned.
- Add a radius threshold in distance (the concave parameter is a percentage of triangles) as an option, plus a minimum-area filter to drop islands.
- Add scripts/hull_test.mjs if absent (convex area vs gift wrapping on random sets; alpha shape area vs brute-force Delaunay on 45 points for 100/80/60/40 %).

### clustering
- M: numeric null values (-999) used as measurements: contract C.
- m: k clamped silently (k = 30 gives 20 clusters): say so; DBSCAN default eps 0.5 puts 52 of 160 samples in noise on the example: add a k-distance plot and a suggested eps; stale message after a failed run; `limits` empty.
- Add a map (X-Y) coloured by cluster when two columns are chosen as coordinates, and a note that spatial autocorrelation is not accounted for. Add scripts/clustering_test.mjs (k-means on well-separated blobs ARI 1, silhouette 0.9048 for [0,1,10,11] point 0, DBSCAN components).

### gridattr
- m (trap): a grid of positive-down depths without the Z factor gives dip azimuth 270 instead of 90 and inverted curvature signs. Documented but the default is 1 and the label is "Dip azimuth": add a "z is a depth (positive downward)" checkbox that applies -1 automatically and show a warning when values increase downward on average and the box is unchecked ("z looks like a depth").
- m: scales are in cells, not in distance (stated): show the equivalent distance next to each scale. Low priority: nothing else.

### zmap-checker
- m: the rules rely on software behaviour that could not be compared to real files: add a visible statement at the top of the report; add to the test file a few additional synthetic header variants already described in the page; batch report export (CSV/text) of all findings. Otherwise unchanged.

### logdigitizer (Well-log digitizer)
- m: without a well name the LAS writes WELL/COMP/FLD "UNKNOWN" (the LAS checker does not flag these): require well name and UWI (or an explicit "unknown" tick box) before export; add UWI, KB and depth-reference fields; show the curve-unit resolution (pixel size in curve units per track) and export the calibration/parameters (JSON beside the LAS); add known-depth check (a typed top/TD compared with the calibrated depth at a clicked pixel).

### mapdigitizer (Continuous map digitizer)
- M: a value beyond the colour-bar range is shown as the bar limit as if measured (truth 2733 m, bar to 2600: exported 2600, max error 133 m). Flag nodes whose colour is at the bar's extreme as "possibly saturated" (count and overlay), and export a flag column/attribute; show the estimated reading uncertainty (colour quantisation and JPEG: about 0.2 % of the range for PNG, up to about 1 % for strong JPEG, as measured by the reviewer: say these are the order of magnitude measured on synthetic maps).
- m: the colour tolerance has no measurable effect (tol 4, 12, 40 give identical results): either remove the control or document that nearest-colour matching dominates; no ZMAP+/IRAP grid export (only XYZ, matrix CSV, Surfer): add ZMAP+ using the writer verified in docs/gridattr (copy it) and a depth-sign option; save the calibration, legend, tolerance and source file name in the export (audit trail).

### discretemap (Discrete map digitizer)
- M (not measured): the real accuracy at anti-aliased boundaries and on JPEG is not quantified: build a synthetic test map with known polygons (rasterised with anti-aliasing, then JPEG-compressed with a node encoder you write or canvas in headless Edge), measure the fraction of correctly classified pixels/nodes and the polygon area error, show the share of unclassified/ambiguous nodes on screen before export, and put the measured numbers in the page's validation.
- m: IRAP polygons have no holes (workaround: GeoJSON): keep; add a message at export when holes exist.

### compaction
- M: `100 0,55` (space delimited, decimal comma, no header) is read with the comma as delimiter: depth 1000-5000, porosity "55 percent", silently: contract A.
- m: dropped rows (negative depths, text like `abc`, `<5`) are not reported: contract A counts. Porosity in percent with a maximum <= 1.5 is read as fractions and valid values >= 1 are rejected ("Only 2 valid points"): suggest "percent" when values look like percent. The linear model with a floor of 0.001 gives phi = 0.001 at depth silently: warn when the floor is hit.
- m: the standard errors are lower bounds (residuals independent): put that next to the result, not only in the tooltip. Fitting a well with exhumed (over-compacted) or overpressured section is misleading: add a field for the maximum burial depth (uplift) so the fit uses max burial depth, and a warning near the result.
- Add scripts/compaction_test.mjs (Athy exact recovery phi0 0.6, c 0.5 on exact data; decompaction 1000-1500 m with phi0 0.6457, c 0.5023 gives solid thickness 327.23 m and base 715.18 m by the reviewer's hand computation: recompute independently in the test).

### bht
- M: the case of one BHT per run at increasing depths (the common case) gets no Horner correction ("single run: no extrapolation") and then only the constant +18.3 degC regardless of depth (on the example 90.5 for a true 75). Implement a depth-dependent correction: the Harrison et al. (1983) correction as used for AAPG data (find the published equation: Harrison, W. E., Luza, K. V., Prater, M. L. and Cheung, P. K. (1983), Geothermal resource assessment of Oklahoma, Oklahoma Geological Survey Special Publication 83-1, and Harrison and Luza; verify in Crossref/OpenAlex/the survey's open publication before citing; if you cannot read the equation in an open source, do NOT invent it: instead relabel the constant correction prominently as "unreliable, indicative only (no published basis)" in the table and the export, and say in your report what you could not verify).
- M: Waples et al. (2004) is applied outside its stated domain (2000 m, domain 3500-6500 m: 89.1 vs true 75) with one global message: mark the out-of-domain rows in the table itself (colour + symbol) and do not show a value without the mark.
- m: data without header (`2000 6 68.2`) loses the depth silently (cz = -1): contract A header handling; tc0 = 0 gives "No valid row" that does not mention tc: say so; add plausibility checks (gradient aberrant, T below surface temperature).
- Add scripts/bht_test.mjs (Horner exact recovery Tf=100, m=8, tc=5 h, delta t 4/8/16 h; unit conversions).

### tr-cycles
- M: no significance test: white noise (1000 points) gives 12 peaks all "QC yes" labelled Obliquity/Precession; AR(1) red noise phi 0.95 gives 125 kyr "Short eccentricity" and 200 kyr "QC yes". Add a red-noise (AR(1)) significance level with a confidence line on the spectrum computed by Monte Carlo surrogates fitted to the series (seeded, default 500), and show "Candidate band" only for peaks above it; others get "not significant". Test: white noise gives at most ~5 % significant peaks at alpha 0.05 over repeated seeds (state the measured rate); the synthetic 405/100/41/23 kyr series stays significant.
- M: the Savitzky-Golay smoothing before the spectrum attenuates high frequencies (default 31 points at dt = 1 kyr: power of the 23 kyr sine 0.066 vs 0.497 for the 100 kyr sine of equal amplitude; the 19 kyr peak vanishes). Make smoothing optional (default off for the spectrum; keep it for display/phase detection), and when on, compute "Power" from the unsmoothed series or show the attenuation factor per peak.
- M (judgement): "Transgression" is assigned to any positive derivative of sea level; in the T-R model of Embry & Johannessen, T-R depends on accommodation versus sediment supply, not on the sign of the eustatic derivative: rename to "sea-level rising/falling" and say the tool does not infer T-R cycles.
- m: the spectrum is resampled to N = max(512, n) and "Samples/cycle" is inflated by interpolation: show the true samples/cycle from the original sampling. Constant series gives 0 peaks without warning: warn. Fixed band limits are for the Quaternary; deep-time obliquity/precession periods shorten (Berger and Loutre 1994, Laskar et al. 2004: already cited): say so next to the table and let the user edit the band limits (they already exist as page settings if present).
- Add scripts/trcycles_test.mjs (periods of a synthetic 405/100/41/23 kyr series, units Ma->kyr equivalence).

### burial
- M: the depth of the top of the first unit must be the depth below the seafloor (0), otherwise porosity is evaluated at absolute depth: the same column shifted by 1000 m (Young 1000-2000, Old 2000-3000) gives Old = 1151.5 m instead of 1303.5 m and base temperature 90.1 versus 107.5 degC, without a warning. Add: a warning when the top of the first unit is not 0 ("depths are measured from the sediment surface: the top of the first unit should be 0; set a reference (KB, sea level) offset in 'Reference depth'"), plus an explicit "reference offset" field (default 0) subtracted from all depths, and a water-depth field used for the surface temperature when given.
- m: a unit with zero duration (age of base = age of top) is accepted: warn; 50 000 m depth accepted: warn above a plausible limit. The "siltstone" parameters (0.56/0.39) correspond to the "shaly sand" of the published compilation (the reviewer's judgement): relabel or verify and say so; the reviewer also judged that the defaults for sandstone, shale, limestone, dolomite and chalk equal the published Sclater and Christie (1980) table values while the page says "not traced to a published table": check against an open source if you can fetch one (do not rely on memory), and update the Method accordingly if verified.
- m: put an "assumptions" box next to the results (steady-state heat flow, constant surface temperature, no radiogenic heat, hydrostatic compaction).

### rockeval
- M: standards control charts crash when a parameter is constant: six lines STD-01 with identical S3 = 0.8 plus one sample: RangeError "Invalid array length" in `lin()` (floating mean 0.7999999999999999 differs from 0.8, so the y range is about 1e-16 and the tick loop explodes) and the whole Standards tab (other parameters included) is not drawn. Use a relative tolerance on the range and a guard on the number of ticks; test with constant parameters.
- M (statistics): the +-2 SD limit is computed on the displayed runs including the outlier: with n <= 5 no point can exceed 2 SD (max z = (n-1)/sqrt(n) = 1.79 for n = 5; 5 runs with one at +10 degC: SD 4.47, no flag). Offer reference limits (certified value and SD typed by the user) and use robust statistics (median and MAD x 1.4826) when no reference is given; show the minimum number of runs needed and a note when n is too small to detect anything.
- m: text values (`<0.1`, `n.d.`) become NaN silently: contract A with counts; emptying the textarea does not clear the data and charts (contract B); two different samples at the same depth are both flagged "duplicate" (flag only identical name+depth, or say "same depth").
- m: TOC given as a fraction (0.02) yields HI 25000, flagged but without hint: add the hint "TOC in fraction? expected wt %".
- Add the standards-chart regression to scripts/rockeval_test.mjs.

### biomarkers
- M: the classic headers `%C27`, `%C28`, `%C29` (or `C27 C28 C29`): after normalisation `c27` and `c28` map as peaks (alpha-alpha-alpha 20R) but `c29` maps to nothing, so no sterane ternary can be formed ("no ratio can be formed"); with `St27/St28/St29` it works. Recognise `%C27`, `%C28`, `%C29`, `C27 sterane`, etc. as the sterane percentages (and as peaks only when named with 20R/aaa/area), and `C29 20S`, `C29 20R`, `C29 aaa 20S` forms; show which columns were mapped to which quantity before computing, and list unmapped columns.
- m: a negative peak area is accepted (Pr = -3, Ph = 5 gives Pr/Ph = -0.6) and text becomes NaN silently: contract A + reject negatives with a flag. Rc = 0.6 MPI-1 + 0.4 is computed for any MPI-1 (0.15 gives 0.49, outside the Radke domain Ro 0.65-1.35; 5.45 gives 3.67 absurd): flag the row "outside the calibrated domain" and do not display a value outside it unless the user asks. Mixed units (fractions and percentages in the same file) are not normalised: normalise per row when the three values sum to 0.9-1.1, and say so.
- Missing for an expert (add only the cheap ones with a verified formula): Ts/(Ts+Tm); C30 diasterane/sterane ratio only if a published definition is in the page's sources.

### chromatogram
- M: crash above about 120 000 points although the page advertises 400 000: `Math.min(...y)` and `Math.max(...y)` in setData overflow the stack ("Maximum call stack size exceeded", threshold measured at 120 000 OK / 125 000 fail). Replace by loops everywhere in the page; test with 400 000 points.
- m/M for integration: a one-point spike (90 000 on a signal at 1000) creates three "peaks" (the spike area 1008 plus two phantom peaks of height ~2950 and areas ~3880/~3600); no spike filter; the S/N floor is contaminated (sigma 575). Add an optional spike filter (Hampel/median-based, default ON with the number of replaced points reported) before baseline and peak detection.
- m: a perfectly constant signal gives a phantom peak (4.338 min, height 0, S/N 7.5, area 0): guard (no peaks when the signal range is below the noise floor); a shoulder peak (8 % of height at 2.5 sigma) is not detected and its area goes into the main peak: document in limits; fewer than 20 lines: error message but the previous chromatogram stays (contract B).
- Add scripts/chromatogram_test.mjs: synthetic Gaussians with truth h*sigma*sqrt(2*pi) (areas within 1 %), two peaks at 4 sigma, spike filter, constant signal, 400 000 points.

### ternary
- M: stale axis labels: load Sand/Silt/Clay then paste an A/B/C or Q/F/L table: axis labels stay "Sand / Silt / Clay" because auto-labelling only runs when the three fields still hold A/B/C; an exported PNG can carry wrong labels. Update labels from the detected headers at every load unless the user edited them; if the user edited them and the new headers differ, show a visible warning.
- m: the column regex takes "Age" as apex A (columns Age, Sample, Q, F, L: A = Age, B = F, C = L): require a whole-word match for apex names and show which columns were taken before plotting; rows with an empty field, `n.d.` or `<1` are dropped instead of being treated as zero: offer the option "treat missing/below detection as 0" (default off, count shown); a failed load leaves the old dataset (contract B).
- Add scripts/ternary_test.mjs (coordinates: (50,30,20) -> X 0.45, Y 0.433; (20,30,50) -> (0.6, 0.1732); closure; Aitchison centre of (50,30,20) and (20,30,50) = 33.913/32.173/33.913; zeros suppress the geometric centre).

### maturity
- m: Basin%Ro (user-supplied parameters, not verified) and Easy%RoDL (read from a bar chart) are drawn with the same status as EASY%Ro: show the spread among the models as a "model uncertainty" band/label, draw the secondary models with a lighter/dashed style and a legend line "not verified against the paper"; the core with T = -300 degC or NaN (outside the UI) gives NaN or 0.2019 without an error: return an explicit error from the core. Nothing else (the core was validated against an independent re-implementation to 0.0005 %Ro).

### psec
- No defect found. Optional small improvements only if trivial: a visible note that the default critical moment is a judgement. Leave the tool unchanged otherwise and report "no change needed".

### cvd (Colour-blind check)
- m: the cividis (6 points) and viridis (10 points) approximations deviate up to about 14 and 3 dE*ab from the published tables: replace them by compact accurate tables ONLY if you can obtain the published 256-entry tables from an open source (the matplotlib/viridis data are open: CC0) and verify a handful of entries; otherwise leave unchanged. Everything else was verified (Machado matrices, CIEDE2000 on the Sharma pairs).

### gdemap (GDE map generator) — LAST
- M: the verdict banner says "All 2 wells honoured. Every well falls in its class" in green while 3 of 5 wells are marked as not honoured / not matched (5 wells W1 delta plain, W2 shelf, W3 delta front, W4 slope, W5 delta plain on the default shoreface-shelf system: W1, W3, W5 are ✗ and the banner counts only the matched ones); with 3 wells "The well is honoured" while W1 and W2 are ✗. Fix: the green "pass" state only when ALL wells are matched and honoured; when some wells are unmatched, an amber state "k of N wells honoured, m not matched to a class", counting all wells.
- M (framing): "honoured" is tautological (the boundaries are placed between the wells and local warping or "created at the well" objects force them to be honoured); show next to the banner whether each well is honoured by the calibrated belts, by local warping or by an object created at the well, and a one-line reminder "concept map, not a prediction". Optionally a leave-one-out check (hold one well out, recompute, report whether its class is predicted) as a button.
- m: "Start from my wells" picks a shoreface-shelf system that does not recognise "delta front"/"delta plain": suggest the system that matches the most well environments and ask; the Method text announces "85 tests" while the suite has 100: correct to the actual count.
