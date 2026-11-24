# LAS checker — QC of transmitted LAS files

## Intent
LAS files received from partners/data rooms must be checked before loading (Petrel as the
practical target). A file that follows the standard needs nothing. A file that breaks a
convention or contains errors must be flagged, with the exact problem, and — when the fix is
mechanical — a corrected file proposed.

## Goals / non-goals / anti-goals
- Goal: pass/warn/fail verdict per file, with a list of findings (line, rule, message, fix).
- Goal: download a corrected LAS 2.0 file plus a change log, for mechanical fixes only.
- Goal: everything runs in the browser, no data leaves the machine.
- Non-goal: full LAS 3.0 validation (version detected, basic checks only, flagged as such).
- Non-goal: petrophysical interpretation, depth matching, curve editing.
- Anti-goal: silently changing a measured value. Interpretive issues are reported, never fixed.

## Approaches considered
1. **Standalone HTML page, hand-written JS parser** — chosen. Same model as the other tools
   (bht, gridding…), no dependency, instant load.
2. Python `lasio` via Pyodide — rejected: ~10 MB to load, and does not help the ZMAP checker.
3. One combined LAS + ZMAP page — rejected: the user wants two separate tools.

## Design
- `docs/las-checker/index.html`, same skeleton as `docs/bht/index.html` (top bar, side panels,
  `rgm` "Method & sources" block, Tools menu).
- Input: drop/open one or **several** files (data rooms send batches) → summary table, one row per
  file with its verdict; clicking a row shows its details. Example file button (synthetic LAS with
  deliberate errors).
- Checks. Severity: **E** error (import fails or data is wrong), **W** warning (non-conforming,
  imports with risk), **I** info (worth a look). **fix** = mechanical auto-fix offered.
  Source tags: [KGS] KGS LAS 2.0/3.0 help, [lasio] lasio docs, [VRGS] VRGS import guide,
  [exp] field experience / memory, to check against the CWLS LAS 2.0 PDF.

  **File level**
  - E: not a LAS at all (no `~` sections; CSV renamed .las: commas, no tags) [VRGS].
  - E: two `~V` in one file (concatenated runs) [exp]. E: empty file / empty `~A` [exp].
  - W fix: UTF-8 BOM; CR-only line endings; tabs; trailing whitespace [exp].
  - W: non-ASCII characters (°, µ, accented names; Latin-1 vs UTF-8) [exp].

  **Structure**
  - E: `~V`, `~W`, `~C`, `~A` each present; `~V` first; `~A` last [KGS].
  - W: `~W` not second; unknown section name (allowed but ignored) [KGS][lasio].
  - W: duplicate sections (two `~C`, two `~W`) [exp].
  - I: LAS 3.0 detected — typed sections (`~Log`, `~Core`, `~Tops`…), Definition/Data pairs;
    only basic checks run [KGS].

  **`~V`**
  - E: VERS missing or not 1.2/2.0/3.0 [VRGS]. E: WRAP missing or not YES/NO.
  - W fix: WRAP YES — some importers reject wrapped files [VRGS]; offer unwrap.
  - W: VERS says 2.0 but `~W` uses the 1.2 layout (value after the colon) or vice versa [KGS].

  **Header line syntax (all sections except `~A`/`~O`)**
  - E: line not parseable as `MNEM.UNIT VALUE : DESC` (no dot and no colon, column-title line,
    line starting with a quote) [lasio].
  - W fix: missing dot; missing colon; space between dot and unit [lasio].
  - W: mnemonic containing a dot (`SP.COND`), unit containing a dot that splits it (`OHM.M`)
    or a space (only `1000 LBF` is tolerated) [lasio][exp].
  - W: duplicate mnemonic in a section, compared case-insensitively (SFLU / Sflu) [lasio].
  - I: comment lines `#` (fine in headers) [lasio].

  **`~W`**
  - E: STRT, STOP, STEP, NULL missing or non-numeric [VRGS].
  - E: WELL empty (Petrel / VRGS fall back to the file name) [VRGS].
  - W: COMP, FLD, LOC, SRVC, DATE missing or empty; none of PROV/CNTY/STAT/CTRY; none of UWI/API
    [KGS][lasio].
  - W fix: STRT ≠ first index, STOP ≠ last index (beyond half a step) [VRGS][exp].
  - W fix: STEP ≠ data step; STEP ≠ 0 but data irregular; STEP = 0 but data regular;
    STEP sign inconsistent with STRT→STOP direction [exp].
  - W: STRT/STOP/STEP unit differs from the index curve unit; depth unit not M/FT/F [exp].
  - I: implausible depth for the unit (STOP > 12 000 with unit M, likely feet) [exp].
  - I: no surface X/Y (X, XCOORD, SURFX…), lat/lon out of range, no KB/EKB/EREF/EGL —
    well placed at origin or offset 0 by importers [VRGS].

  **`~C`**
  - E: no curve; first curve not DEPT/DEPTH/TIME/INDEX (or equivalent) [VRGS][KGS].
  - E: curve count ≠ data columns [VRGS][lasio].
  - W: duplicate curve mnemonics, case-insensitive (Petrel/lasio rename or fail) [lasio].
  - W: curve with empty unit; same mnemonic with different units across files of the batch [exp].
  - I: unit spelling variants (OHMM / OHM.M / OHMM; GAPI / API) [VRGS].

  **`~A` data**
  - E: row with wrong number of values (truncated last line, missing column) [VRGS].
  - E: non-numeric token (ERR, (null), #N/A, -1.#IND, text dates) [lasio][KGS].
  - E: run-on numbers — two values glued (`101130.188`, `7.330-19508.961`), detected by token
    count + digit pattern [lasio].
  - E: index not monotonic; duplicate index values [exp].
  - W: index contains NULL [exp].
  - W: wrapped record malformed (index not alone on its line, line > 80 chars in wrap mode) [exp].
  - W: comment lines `#` inside `~A` [lasio][KGS].
  - W: exponent notation (1.2E+03) — legal for most readers, not for some [KGS].
  - W fix (off by default): other null sentinels present besides the declared NULL
    (-999, -9999, 9999.25, 999.25, -999.99, 32767, 2147483647, NA, INF…) [lasio].
  - W: NULL declared but never used while a flat value at a curve's minimum looks like one [VRGS].
  - I: curve entirely NULL; constant curve [exp].
  - I: index step jitter from rounding (0.1524 accumulated) — tolerance shown [exp].

  **Plausibility (report only, never fixed)** [exp]
  - Values outside a typical range for common mnemonics: GR < 0 or > 1000 GAPI; RHOB outside
    1.0–3.2 G/C3; NPHI > 1 with unit V/V (probably %) or < 1 with unit % (probably fraction);
    resistivity ≤ 0; DT outside 40–200 US/F (or 130–650 US/M); CALI < 0.
  - Possible spikes (robust z-score on the first difference).

  **Batch level (several files)** [exp]
  - Same WELL with different UWI, or same UWI with different WELL names.
  - Same well, overlapping depth ranges on the same curve (duplicate runs).
  - Mixed depth units across the batch.
- Auto-fixes (each a checkbox, listed in the change log): STRT/STOP/STEP from data, unwrap
  (WRAP NO), normalise header line syntax, rewrite VERS 2.0, harmonise other null sentinels to the
  declared NULL (off by default: it touches values), drop fully empty rows.
- Outputs: corrected `.las`, report as CSV (file, line, severity, rule, message, fixed?).
- Preview: header tables + one curve vs depth plot (canvas) to eyeball spikes.
- Site wiring: new category "Data preparation" (home card + thumbnail, `mkdocs.yml` nav, `CAT`
  list in every tool page's Tools menu), Method & sources citing the CWLS LAS 2.0 standard.

## Left to the builder
- Exact spike threshold, parser internals, page layout details within the existing style.
