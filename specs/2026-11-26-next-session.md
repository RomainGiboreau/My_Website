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
- Wave 4 TO DO: chromatogram, ternary, clustering, gridattr, mapdigitizer (continuous), discretemap.
- Wave 5 TO DO: logdigitizer, zmap-checker, mcda (move engine into a core block + add scripts/mcda_test.mjs), maturity (small), cvd (only if accurate viridis/cividis tables
  can be obtained from an open source), psec (no change needed).
- Wave 6 LAST (the user asked for it last): gdemap. Fix the verdict banner (never a green "All N wells honoured" while some wells are unmatched or ✗; show how each well
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
