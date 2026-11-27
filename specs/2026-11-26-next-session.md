# Next session — handoff (updated 27 Nov 2026)

## START HERE (state at the end of the 26-27 Nov session)

Reply to the user in French. Push once per batch (several pushes within seconds make the GitHub Pages deploy fail: concurrency).
All work is on `main`; check `git status -sb` and `git worktree list` first. Tests: every `node scripts/<tool>_test.mjs`, plus
`node scripts/site_check.mjs` (31 tool pages: shared Method & sources script parses, Tools menu complete, nav complete) and `mkdocs build` (0 WARNING).

### What exists now
- 31 tools under `docs/<tool>/index.html` (self-contained pages, pure logic in a `<script id="...-core">` block, test in `scripts/<tool>_test.mjs`,
  "Method & sources" data object at the end of each page). New this session: risking, portfolio, fdp, wellpos (Contact and well POS; the folder was
  renamed because `docs/contact/` collided with the site's Contact page), distfit, psec, cvd, burial, logcorr, gridattr, logdigitizer.
- All tool pages are sourced with scientific publications only (verified in Crossref/OpenAlex/PMC; statuses: published (read) / published (metadata verified) /
  to verify / on the page (no publication) / de-facto format (no publication)). No vendor documents, no GitHub READMEs as sources.
- Expert reviews of all 31 tools were done on 26 Nov (cores are right; defects are at the edges). The fix plan is `specs/2026-11-26-review-fixes.md`:
  shared contracts A (number/table decoding), B (no stale results after a failed load), C (null sentinels), D (interchange files v2: prospect-risk summary
  with 21 quantiles, fdp-link with marginalValue / npvCurve) and a per-tool defect list with reproductions.

### Review fixes: progress (one agent per tool, worktree `../My_Website_fix_<tool>`, branch `fix-<tool>`, merge, push once per wave)
- Wave 1 merged and pushed: logcorr, source, digitizer (plot), las-checker, risking, fdp.
- Wave 2 merged and pushed: portfolio, wellpos, distfit, gridding, variogram, hull.
- Wave 3 merged and pushed: burial, bht, compaction, biomarkers, rockeval, trcycles (no fix-* branch or worktree should remain: check anyway with
  `git worktree list` and `git branch --list "fix-*"`).
- Wave 4 merged and pushed (27 Nov): chromatogram, ternary, clustering, gridattr, mapdigitizer, discretemap.
- Wave 5 merged and pushed (27 Nov): logdigitizer, zmap-checker, mcda, maturity, cvd (52-point viridis/cividis from matplotlib), psec unchanged.
- Wave 6 merged and pushed (27 Nov): gdemap verdict banner, how-honoured list, leave-one-out, suggested system. OPEN: after switching to another system, the starting key lines do not follow it (to check with real wells). Original item: gdemap. Fix the verdict banner (never a green "All N wells honoured" while some wells are unmatched or ✗; show how each well
  is honoured: belts / local warping / object created at the well; optional leave-one-out), suggest the system matching the wells, and correct "85 tests" to the real count.
  The user is testing GDE and thinking about it: ask before large GDE changes.
- Method for a wave: `git worktree add ../My_Website_fix_<tool> -b fix-<tool> main`, one agent per tool whose prompt says: read specs/2026-11-26-review-fixes.md
  (rules + contracts + its tool section), work only in its worktree, regression test first, update Method & sources, site_check, commit, never push, report in French.
  Then merge all branches, rerun all tests + site_check + `mkdocs build`, push once, remove worktrees and branches.
- Practical lessons: heredocs mangle backslashes (use the Write tool or index-based replacement with indexOf/slice, mind CRLF); the 5-hour usage limit can kill
  agents mid-run: resume them with SendMessage (their work is saved); `git push` several times in a few seconds makes the Pages deploy fail.

### Decisions / inputs still needed from the user
- BHT single-BHT correction: no published equation could be read (Harrison et al. 1983, Oklahoma Geological Survey Special Publication 83-1: equation not in any
  open source found). The constant +18.3 °C correction is labelled "unreliable, indicative only". If the user supplies the report, implement and test it.
- PDFs wanted to move statuses to "published (read)": Saaty 1987 (RI table), Brans & Vincke 1985, Cui & Blockley 1990, Rose 2001, White 1993, Otis & Schneidermann 1997,
  Sales 1997, Kaiser 2006, Jarvie et al. 2007, Nielsen et al. 2017, Burnham 2019, Radke & Welte 1983 / Radke 1988, Waples et al. 2004, Sclater & Christie 1980 (φ0, c table),
  Lai et al. 2026, Harris et al. 2014, Wilson 1973, Dyer & Huntley 1999, Blair & McPherson 1994, Burchette & Wright 1992, Douglas-Peucker 1973, Machado 2009, IEC 61966-2-1, CIE 15,
  Wong 2011, ISO 19125-1, CWLS LAS 1.2 / 3.0 and an official copy of LAS 2.0; Hughes et al. 1995 and Huang & Meinschein 1979 (biomarker charts still "memory (schematic)");
  Espitalié 1977/1985. Not findable online: Horner 1951, Allen & Allen 2013, Berndt & Clifford 1994, Kolmogorov 1933, several book chapters (Galloway 1975, Coleman & Wright 1975...).
- The Resources page still lists commercial tools and GitHub repositories: the user's "nothing corporate" rule was applied to the tool pages only; ask whether to apply it there.
- The CWLS LAS standard is an association specification, not a peer-reviewed paper: kept as the public reference of the format unless the user objects.
- ZMAP checker rules were never compared with real Petrel / Landmark files: ask the user for a few real exports.
- Ideas not done: SCOPE-CO2-like storage capacity tool, POS map on a structure (POS-Gridder idea), cross-validation residual map in Map interpolation, GDE items below.
- Optional: add a `concurrency:` group to `.github/workflows/deploy.yml` so overlapping deploys queue instead of failing.

## Earlier handoff content (25-26 Nov, partly superseded by the above)

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

## Added later on 26 Nov (Decision support)
- `docs/risking` (gCOS / eCOS / EMV), `docs/portfolio` (shared play risk, Monte Carlo, budget selection, imports risking files),
  `docs/fdp` (plateau + Arps profile, capex/opex/tax, NPV, IRR, break-even, MEFV). Tests: `scripts/risking_test.mjs`,
  `portfolio_test.mjs`, `fdp_test.mjs`. Each page has a copy of the "Tools" menu (CAT) — add a new tool to all pages with sed.
- GDE generator: paused at the user's request (they test and think). Left column now organised by map; consistency check in the verdict.
- Ideas not done: FDP → push the MEFV into a risking file; portfolio import of an FDP case; gas volumetrics; production sharing regimes.

## Added on 27 Nov (GDE, plan-view references)
- Reference images (concept only, AI-generated, never traced): `specs/ref-gde-*.png` (deltas river/wave/tide, submarine fan, carbonate platform and ramp, source-to-sink and carbonate block diagrams).
- Done and pushed: Source -> sink chain strip + grain-size ramp / carbonate components key + process-coloured arrows; delta regimes (river/wave/tide, global per map), detailed submarine fan (`sfan`) + Sand content view (`&sand=1`), reef-rimmed platform (`reefrim`), ramp zones (`rampzone`); examples deltariver, deltawave, deltatide, subfan, carbplat, rampzones.
- Not done: delta form per feeder (global only), swell arcs on the wave delta, meandering edges on river-delta fingers, detailed fan on non-canyon fan sources and by default on margins, ramp parameters frozen at generation (do not follow later belt edits), inner/mid/outer ramp not coloured differently on the EOD map.
- Still to check with real wells: after switching system, the starting key lines do not follow it.
- Remaining image wishes from the user: shoreface/shelf clastic plan, passive-margin overview plan (drifting example), fluvial / alluvial fan plan, mixed systems.

## GDE v3 (27 Nov) — state at the end of the session
- Why: the old GDE (`docs/gdemap/`, 3,600 lines, ~20 special object kinds) gave illogical maps and unstable ones when a well was moved. Design: `specs/2026-11-27-gde-v3-design.md`.
- Built and PUSHED: clean rewrite. Source modules in `gde3/src/` (geometry, field, keylines, systems as DATA, belts, calibrate with minimum change, warp, verdict, features, render, exports, wells, model) and `gde3/ui/`; `node scripts/build_gde3.mjs` assembles the self-contained page `docs/gdemap3/index.html` (`--check` verifies it is up to date). Tests: `scripts/gde3_test.mjs` (22). README with the 3 synthetic acceptance well sets: `gde3/README.md`; `gde3/tools/compare_old.mjs` compares with the old core.
- Measured: moving one well by 5 % changes 3-7 % of the cells (old core 10-13 %); the old core jumped 11.7 % of the cells for a 0.5 % move on a 5-well platform set.
- The page is behind a TEMPORARY client-side password gate (SHA-256 hash in `gde3/ui/page.html`, block "Temporary access gate"); remove it and rebuild to open the page. The old `docs/gdemap/` stays online until v3 replaces it.
- NEXT: the user tests v3 on the site (examples A/B/C, then real wells, moving a well) and reports what is wrong. Not in v3 yet: leave-one-out, attribute layers, model file, systems beyond shoreface-shelf / delta (river, wave, tide) / rimmed carbonate platform (fans, ramp, margins, fluvial, lacustrine, mixed still in the old tool), feature sizes and delta regime multipliers are "inference". Exports not yet opened in a GIS. Then: swap with the old page, remove the gate.
- Also open: after switching system in the OLD tool the starting key lines do not follow; clustering default is now the Gaussian mixture.
- Left over on disk: `../My_Website_ahp_map` (locked by a process, delete by hand). Unrelated stray branch `backup-local-44008ac` (not merged, from an earlier session). A patch of an unexplained uncommitted edit of the old exRift example is in the session scratchpad only (lost after the session).
