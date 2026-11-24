# LAS checker — Implementation Plan

**Spec:** specs/2026-11-24-las-checker-design.md · executed inline (native).

**Architecture:** one standalone page `docs/las-checker/index.html` (skeleton copied from
`docs/bht/index.html`). Pure logic lives in its own `<script id="las-core">` block, no DOM
access, exposing `window.LAS`; the UI script uses it. A Node script extracts that block and runs
assertions on fixture strings.

## Global constraints
- No external JS library, no upload: everything client-side (same as the other tools).
- Site language English; style tokens and `rgm` "Method & sources" block as in bht.
- Never change a measured value unless the user ticks the fix; "harmonise null sentinels" off by default.

## Interfaces (`window.LAS`)
- `parse(text: string, name: string) -> Las`
  `Las = {name, lines: string[], sections: [{tag, title, start, end}], ver: {VERS, WRAP},
  well: Item[], curves: Item[], params: Item[], data: number[][] (rows×curves, NaN for bad tokens),
  raw: {line, tokens}[], findings: Finding[]}` — parse-time findings already included.
  `Item = {mnem, unit, value, desc, line}`.
- `check(las: Las) -> Finding[]` — all spec checks except batch.
  `Finding = {sev: 'E'|'W'|'I', rule: string, line: number|null, msg: string, fix: string|null}`
  (`fix` = id of an auto-fix that resolves it).
- `checkBatch(lases: Las[]) -> Finding[]` (adds `file` field).
- `FIXES: {id, label, defaultOn}[]` — ids: `bom`, `eol`, `tabs`, `syntax`, `wrap`, `vers`,
  `strtstop`, `step`, `nulls` (defaultOn false), `emptyrows`.
- `write(las: Las, fixIds: string[]) -> {text: string, log: string[]}` — LAS 2.0, WRAP NO.
- `verdict(findings) -> 'pass'|'warn'|'fail'`.

## Tasks
1. [ ] **Core parser** (`las-core`): sections, `~V`, header-line split (first dot = mnemonic end;
   unit runs to first space; last ` :`-style colon separates description — colons inside
   values/units allowed; LAS 1.2 `~W` layout detected), `~A` unwrapped and wrapped, tokens kept.
   Test `scripts/las_check_test.mjs`: clean LAS 2.0 fixture → 0 E/W findings, 5 curves, N rows.
2. [ ] **Checks** — every bullet of the spec catalogue, rule ids `file.*`, `struct.*`, `ver.*`,
   `hdr.*`, `well.*`, `curve.*`, `data.*`, `plaus.*`, `batch.*`. Test: one broken fixture per
   group asserting the expected rule ids appear (run-on `7.330-19508.961`, `OHM.M`, NPHI 25 in V/V,
   duplicate `sflu`/`SFLU`, STEP 0 on regular data, two `~V`, CSV renamed).
3. [ ] **Fixes + writer**: `write` applies ticked fixes, emits change log. Test: broken fixture →
   write with all default fixes → re-parse → no finding whose `fix` was applied; values unchanged
   unless `nulls` ticked.
4. [ ] **UI**: drop/open several files, summary table (file, version, wells, curves, depth range,
   E/W/I counts, verdict), details pane (findings table sortable by severity, header tables,
   curve-vs-depth canvas with curve select), fix checkboxes, Download corrected `.las`
   (one file, or each for a batch), Report CSV, Example button (synthetic broken file).
   Method & sources (CWLS LAS 2.0, KGS, lasio, VRGS; [exp] items tagged *memory*).
5. [ ] **Site wiring**: `mkdocs.yml` nav "Data preparation → LAS checker"; home card in
   `docs/index.md` (new section) + `docs/assets/tools/las-checker.webp` (640×400 screenshot);
   add the category to `CAT` in all 16 tool pages.
6. [ ] Verify: Node test passes; `mkdocs build` clean; page in a browser (example file, phone width,
   real-world LAS); commit, push.

## Review focus
- Huge files (50 MB, 100 k rows): parse stays responsive; preview plot decimates.
- Latin-1 files: read as text without crashing; non-ASCII flagged, not mangled on write.
- Headers with colons in values (`TIME.hh:mm 23:15 : ...`) and units with dots (`.1IN`).
- Wrapped file where the last record is incomplete.
- Batch of mixed good/bad files: one bad file never blocks the others.
