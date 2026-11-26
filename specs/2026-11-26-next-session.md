# Next session — handoff (26 Nov 2026)

State: everything is merged and pushed on `main` (last commit c5334b1). All tests pass
(`node scripts/<x>_test.mjs`: gde 99, las 51, discrete 33, split 5, maturity 19, zmap 36), `mkdocs build` 0 WARNING.
Reply to the user in French. Push as soon as something is done and verified.

## Done on 25–26 Nov
- Rock-Eval QC (`docs/rockeval/index.html`): interpretation charts, switch "Interpretation charts" in Display.
  HI–Tmax kerogen I/II/III curves + Ro 0.6/1.0/1.3 (Jarvie 2001) + windows; HI–OI pseudo-Van Krevelen I–IV;
  S2–TOC HI 600/300/200/50 type fields; PI–Tmax zones.
- Biomarkers (`docs/biomarkers/index.html`): same switch. Pr/C17–Ph/C18 fields, Pr/Ph–DBT/P zones (Hughes 1995,
  zones 2 and 3 merged), sterane ternary fields (Huang & Meinschein 1979), C29 sterane maturity, C29/C30–gammacerane,
  MPI-1–Rc line and 1.35 % reversal.
- GDE map generator (`docs/gdemap/index.html`):
  - speed (facies labels 6 s → 30 ms, coarse preview 40k nodes editing / 160k idle, full build for exports),
    frame fitted to the extent, `&bench=n` hash hook;
  - simplified UI (start screen, panels wells → concept → seismic → edit → calibration, Edit and Export menus,
    "Next" hint);
  - atlas-style EOD / facies views, examples select, no deposit / bypass, faults drawn (synrift / inherited),
    fault-tip taper, footwall fans, shoreline sand ribbons, contourites, carbonate mudstone patches, transport arrows,
    "Marine blues" palette, three synrift-stage examples.
- Resources: AGS Atlas of the Western Canada Sedimentary Basin added.

## To do
1. GDE: synthetic drifting / forced-regression example (bands continental → neritic → shallow marine → marine →
   deep marine, shoreline sand ribbons, canyons with lobe clusters, contourites). Style reference: user's Orphan Basin
   drifting image (style only, never trace the geography).
2. GDE: compare the three rift stages side by side with the user's Orphan Basin synrift image; fix realism gaps.
3. GDE: report before/after timings of each stage (only the label timing is known); check interactive edits < 200 ms.
4. GDE: a 3-line uncommitted change from the stopped agent is in `git stash` ("agent wip uncommitted") — look at it,
   apply or drop.
5. GDE known gaps: mobile shale / calcareous patches / strand plains / intra-rift grabens as objects, brick fill over a
   whole carbonate belt, coordinates on top/right frame edges, rivers not following a dragged lobe, ZMAP / grid CSV
   exports still write belt codes (not EOD codes), crowded object labels.
6. Rock-Eval and Biomarkers charts are schematic, from memory: recalibrate when the user sends the original figures
   (Espitalié 1977/1985, Hughes 1995, Huang & Meinschein 1979…).
7. Thermal maturity: check the EASY%Ro table against Sweeney & Burnham (1990) Table 1 when the user sends the PDF.
8. ZMAP checker: the user is to test real Petrel ZMAP+ / IRAP exports.

## Working notes
- Tools are self-contained pages; pure logic in a `<script id="...-core">` block tested by `scripts/*_test.mjs`.
- Headless Edge screenshots are flaky when several Edge instances run: use a fresh `--user-data-dir` per call and retry.
- Work in sibling git worktrees (`../My_Website_xxx`), ff-merge into main, run all tests with `set -o pipefail`, build, push.
