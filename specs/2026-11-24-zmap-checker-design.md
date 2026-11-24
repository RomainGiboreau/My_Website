# ZMAP checker — QC of transmitted ZMAP+ grid files

## Intent
Same need as the LAS checker, for grids: ZMAP+ files received from partners must be checked before
loading (Petrel as the practical target). A conforming file needs nothing; otherwise every problem
is listed with its line, and mechanical problems are fixed in a downloaded copy.

## Goals / non-goals / anti-goals
- Goal: verdict per file (ready / to review / will not load cleanly), problems in plain words with
  their line, corrected copy, report CSV — same page model as the LAS checker (verdict, grouped
  problems with inline fix toggles, tabs).
- Goal: a map preview of the grid (colour scale, nulls transparent, hover read-out x, y, z), since
  a transposed or shifted grid is often visible at a glance.
- Non-goal: ZMAP+ point / line / fault / contour files (DATA, CNTR, FALT, VERT, TEXT): detected and
  reported as "non-grid ZMAP+ file", not checked.
- Non-goal: rotated grids (the format has no rotation), CRS (not stored in the file).
- Anti-goal: changing a grid value, the geometry or the null value without the user ticking it.

## Approaches considered
1. **Standalone page `docs/zmap-checker/index.html` built on the LAS checker page** — chosen.
   Same skeleton, styles, verdict/problems/tabs UI; a separate `zmap-core` script (parse / check /
   write) with a Node self-check `scripts/zmap_check_test.mjs`.
2. One shared "file checker" page for LAS and ZMAP — rejected: the user wants separate tools.
3. Shared JS file for the UI of both checkers — rejected for now: every tool page on the site is
   self-contained; revisit if a third checker comes.

## Format as implemented (sources in `specs/2026-11-24-zmap-research.md`)
- `!` comment lines, then exactly two `@` markers: `@name, GRID, nodes_per_line` /
  `field_width, null_value, null_string, decimals, start_column` /
  `nrows, ncols, xmin, xmax, ymin, ymax` (**rows first**) / `0.0, 0.0, 0.0` / `@`.
- Data column-major from the upper-left node (ymax) down each column, columns left to right; each
  column starts on a new line; at most nodes_per_line values per line; fixed-width fields.
- Node registration: dx = (xmax−xmin)/(ncols−1), dy = (ymax−ymin)/(nrows−1).

## Checks (E blocking / W to review / I information; fix = mechanical correction offered)
**File**: not ZMAP+ (no `@`) E; non-grid type (DATA/CNTR/FALT/VERT/TEXT/other) E; BOM W fix; tabs W
fix; CR-only line endings W fix; non-ASCII W; UTF-16 W.
**Header**
- `@` markers ≠ 2 E; comment or blank line inside the header W fix; RMS `+…` line I.
- Line 1: tokens ≠ 3 E; type `grid` lower-case W fix; nodes_per_line not a positive integer E.
- Line 2: tokens ≠ 5 E; empty field written `,,` (GDAL drops it) W fix; null value blank with only
  a null string W fix; field width outside 1–39 E; decimals ≥ width W; start column ≠ 1 W.
- Line 3: not 6 numbers E; nrows or ncols < 2 or not integer E; xmax ≤ xmin or ymax ≤ ymin E.
- Line 4 missing W fix; not three zeros I (meaning undocumented).
**Data**
- Value count ≠ nrows × ncols E (too many: trailing junk; too few: truncated).
- Line with more than nodes_per_line values E fix (rewrap).
- Column line breaks not as expected (ceil(nrows/npl) lines per column) W fix (rewrap).
- Line length not a multiple of the field width / value wider than the field W fix (rewrite fixed
  width; widen the field in the header if a value does not fit).
- Non-numeric token E; comma decimal separator E.
- Values without a decimal point (implied decimals apply) W.
- Null written differently from the header (same number, other text, e.g. `1E+30` vs
  `0.1000000E+31`) I; other null-like values (−99999, −9999, 9999999…) W fix (off by default).
**Geometry**
- Spacing not round with node registration but round with cell-edge (pixel-is-area) extents W —
  "grid is half a cell off" (GDAL default export).
- Spacing round only with rows/columns swapped W — "rows and columns probably swapped".
- dx ≠ dy I.
**Plausibility (report only)**
- All values positive while name/comments say depth/TVDSS: Petrel counts Z positive up I.
- Grid entirely null E; null share > 50 % I; constant grid I.
**Batch**: same grid name in several files I; files with different geometry I (listed).

## Fixes (downloaded copy only, each a checkbox, change log)
`bom`, `eol` (CRLF), `tabs`, `header` (normalise header lines: `,,` → `, ,`, `GRID` upper-case,
numeric null, missing line 4 → `0.0, 0.0, 0.0`, remove blank/comment lines inside the header),
`layout` (rewrite data: column-major, one column per block of lines, nodes_per_line per line,
fixed width right-justified; values copied as text, never reformatted; field width widened if
needed), `nulls` (other null-like values → header null; off by default).
Never offered as a fix: geometry (half-cell, swapped rows/cols), Z sign — reported only.

## UI
LAS checker model: welcome screen with drop zone and example, file list, verdict card (name, grid
size, spacing, extent, null share, verdict, "Download corrected file"), problems grouped
Blocking / To review / For information with plain titles and inline fix toggles, tabs **Map**
(canvas, colour scale, nulls transparent, hover read-out), **Header**, **File text** (line viewer,
problem lines shaded), **Changes**. Example: two synthetic files (one clean, one with a swapped-rows
header, a truncated column and an extra null marker).

## Site wiring
Home card + thumbnail in "Data preparation", `mkdocs.yml` nav, `CAT` Tools menu in every tool page,
Method & sources citing the research sources, with the unverified points (Petrel export header,
line 4 meaning, Petrel Z sign) stated as such.

## Left to the builder
Colour scale choice, exact tolerance for "round spacing" (relative 1e-6 on the step, or step a
multiple of 1, 5, 10… within 1e-6), page details within the LAS checker style.
