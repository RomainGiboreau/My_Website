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
- Checks (LAS 1.2 / 2.0, CWLS spec):
  - Structure: `~V` first, `~W` `~C` `~A` present, `~A` last; known section names.
  - `~V`: VERS ∈ {1.2, 2.0, 3.0}; WRAP ∈ {YES, NO}.
  - Header lines: `MNEM.UNIT  VALUE : DESCRIPTION` — dot present, no space between dot and unit,
    colon present.
  - `~W` mandatory items: STRT STOP STEP NULL COMP WELL FLD LOC SRVC DATE, one of PROV/CNTY/STAT/CTRY,
    one of UWI/API. Empty WELL is an error (Petrel needs a name), other empties are warnings.
  - `~C`: first curve DEPT/DEPTH/TIME/INDEX; no duplicate mnemonics; units consistent with
    STRT/STOP/STEP.
  - `~A`: column count = curve count on every row (or per wrapped record); all values numeric;
    index strictly monotonic, no duplicates.
  - Consistency: STRT/STOP = first/last index; STEP = constant data step (or 0 if irregular);
    NULL declared vs other sentinels found (-999.25, -9999, -999…); curves entirely NULL.
  - Report only: possible spikes (robust z-score), unknown mnemonics/units, tabs, non-ASCII chars,
    LAS 3.0 extras.
- Auto-fixes (each a checkbox, listed in the change log): STRT/STOP/STEP from data, unwrap
  (WRAP NO), normalise header line syntax, rewrite VERS 2.0, harmonise other null sentinels to the
  declared NULL (off by default: it touches values), drop fully empty rows.
- Outputs: corrected `.las`, report as CSV (file, line, severity, rule, message, fixed?).
- Preview: header tables + one curve vs depth plot (canvas) to eyeball spikes.
- Site wiring: new category "Data preparation" (home card + thumbnail, `mkdocs.yml` nav, `CAT`
  list in every tool page's Tools menu), Method & sources citing the CWLS LAS 2.0 standard.

## Left to the builder
- Exact spike threshold, parser internals, page layout details within the existing style.
