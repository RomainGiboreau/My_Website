# ZMAP+ grid format — research notes (24 Nov 2026)

No formal public spec. Rules rebuilt from David Baker's description (gdal-dev 2011), reader/writer
source code and vendor help. Petrel's own documentation is not public: Petrel-specific points are
marked UNVERIFIED.

## Sources
- [BAKER] https://lists.osgeo.org/pipermail/gdal-dev/2011-June/029173.html
- [GDALDOC] https://gdal.org/en/stable/drivers/raster/zmap.html
- [GDALSRC] https://github.com/OSGeo/gdal/blob/master/frmts/zmap/zmapdataset.cpp
- [ZMAPIO] https://github.com/abduhbm/zmapio (issues #1, #2, #6, #9)
- [XTGEO] https://github.com/equinor/xtgeo (_regsurf_export.py, _regsurf_import.py)
- [RESQPY] https://resqpy.readthedocs.io/en/stable/_modules/resqpy/olio/zmap_reader.html
- [DT] https://gist.github.com/derrickturk/15847e7ad89c830a38faa419a5955f32
- [SURF] https://surferhelp.goldensoftware.com/subsys/ZMAP_Zmap_Grid_File_Format.htm
- [SURFIMP] https://surferhelp.goldensoftware.com/ZMap-Import.htm
- [DCALC] DoubletCalc 2D manual §6.1.3
- [GRASS], [GGS] real headers posted online (osgeo discourse; geoglobesoft blog)
- [FME] Safe Software ZMAP reader docs (feature types CNTR, DATA, FALT, VERT, TEXT, GRID)
- [MIGRIX] https://migris.no/migrix-userguide/input-subfixes.html
- [AASPI] OU AASPI surface_import documentation (Petrel Z positive up)
- [NITOR] https://www.nitorinfotech.com/blog/what-is-zmap-plus-file-format/

## Header
- `!` comment lines before the first `@`; number varies — never parse by fixed line number.
- Exactly two `@` markers; data start after the second [BAKER][RESQPY][GDALSRC].
- Line 1 `@<label>, GRID, <nodes_per_line>`: 3 tokens; label free text (`HEADER` is label text);
  GDAL requires the 2nd token to start with `GRID` (case-sensitive) [GDALSRC].
- Line 2 `width, null, null_string, decimals, start_col`: GDAL wants 5 tokens, 0<width<40,
  0<decimals<width, start_col = 1; its tokenizer drops empty tokens so `,,` breaks it; blank
  numeric null also breaks GDAL (zmapio/DT fall back to the string) [GDALSRC][ZMAPIO][DT].
- Line 3 `nrows, ncols, xmin, xmax, ymin, ymax` — **rows first**: [BAKER], GDAL, zmapio, resqpy,
  xtgeo writer; confirmed on two real files where only rows-first gives round spacing. DoubletCalc
  manual says columns first (documentation error).
- Line 4: three values, usually `0.0, 0.0, 0.0`; meaning undocumented; real files have non-zero
  first value [GRASS][GGS] → information only.
- Roxar RMS adds `+Grid data starts after this line` after the second `@` [ZMAPIO #1][RESQPY].

## Data
- Column-major from the upper-left node (ymax), down each column, columns left to right
  [BAKER][SURF][DCALC][GDALSRC][XTGEO].
- Each column starts on a new line; ceil(nrows/npl) lines per column [BAKER][DT][XTGEO]; GDAL
  tolerates spill-over.
- Max nodes_per_line values per line; fixed-width fields, right-justified; GDAL slices by width
  ("line length not a multiple of width" error); zmapio/resqpy split on whitespace; Surfer has a
  whitespace mode for non-conforming files [GDALSRC][SURFIMP].
- Values without `.` use implied decimals (GDAL multiplies instead of dividing — bug) → ambiguous.
- Scientific notation normal (`0.1000000E+31`, `1E+030`); zmapio writer overflows the field with
  1e30 [ZMAPIO #9].
- Nulls written as the header null; compare numerically, note text mismatch.
- Value count must be nrows × ncols.

## Geometry
- Node registration: dx = (xmax−xmin)/(ncols−1) [real files][XTGEO][DCALC].
- GDAL default writes pixel-is-area extents (step = range/n) → half-cell offset in node readers
  [GDALDOC][ZMAPIO #6].
- No rotation field; rotated surfaces must be resampled [XTGEO][GDALSRC][FME].
- No CRS stored.

## Petrel (UNVERIFIED unless stated)
- Petrel imports "Zmap+ grid (ASCII)" and "Zmap+ lines" (training material snippet).
- Typical Landmark-style export header: `! ZIMS FILE NAME…` block, `@name HEADER , GRID, 5`,
  `15,0.1000000E+31 , , 7, 1` — not confirmed as Petrel's exact output.
- Petrel counts Z positive up [AASPI]; depth grids positive down may load inverted.

## Non-grid ZMAP+
- One data type per file; type keyword in the 2nd field of the `@` line: CNTR, DATA, FALT, VERT,
  TEXT, GRID [FME][MIGRIX].

## Minimal valid example (3 rows × 4 cols)
```
!
! Minimal ZMAP+ grid: 3 rows x 4 cols
!
@EXAMPLE, GRID, 4
15, 1.0E+30, , 7, 1
3, 4, 0.0, 300.0, 0.0, 200.0
0.0, 0.0, 0.0
@
   1000.0000000   1010.0000000   1020.0000000
   1100.0000000  1.0000000E+30   1120.0000000
   1200.0000000   1210.0000000   1220.0000000
   1300.0000000   1310.0000000   1320.0000000
```
