---
tags:
  - python
  - method
  - case
---

# Pandas, Polars, and the GeoPandas gap

In 2024 I was working on Datamix, a public R&D deliverable under IFPen's Tellus programme, building geospatial ML pipelines for CCS/CCUS subsurface property mapping and multi-criteria storage-site selection. The pipeline was spending most of its time in group-by and join operations on GeoDataFrames. Polars looked like the obvious next move, and I assumed a mature GeoPandas equivalent already existed for it. It didn't, and why it didn't is what this note is about.

**Why Polars looked worth it.** The promise came from the db-benchmark suite (originally H2O.ai, now maintained by DuckDB Labs), which tracks group-by and join performance across dataframe libraries from 0.5 to 50 GB. Those are exactly the two operations that were costing me time. Polars was reported as several times faster than pandas on both, with the gap widening as data grew, and the reason was structural: pandas runs single-threaded and has no query optimiser.

I can't put a defensible number on what I read at the time. The db-benchmark is a living leaderboard rather than a dated archive, and the figures circulating today come from later secondary write-ups that don't agree with each other, with reported speedups on group-by and join ranging from roughly 3× to well over 10× depending on the author, the scale and the versions tested. The order of magnitude was enough to justify trying. The precise figure I acted on isn't something I can reconstruct honestly.

**Why not just split the geometry out.** The obvious workaround is to set geometry aside, run the group-bys and joins in Polars on the attributes alone, then reattach it afterwards. Two things ruled that out.

First, geometry took part in the joins themselves. These were spatial predicates, not attribute keys, so geometry couldn't be parked on the side while the slow operations ran.

Second, a hybrid pipeline pays for itself twice. Every pandas/Polars handoff costs a conversion, and the code ends up carrying two sets of idioms for whoever maintains it next. When the gain is measured in multiples on individual operations, conversion churn scattered through the workflow is exactly what erases it. A 1:1 replacement was the only version worth doing.

**Where it stalled: GeoPandas' own internals.** GeoPandas had already come a long way by 2024. Geometry was no longer a plain numpy `object` dtype, an array of pointers to Shapely scalars iterated in a Python loop, since the refactor onto pandas' `ExtensionArray` interface gave a `GeoSeries` a proper `geometry` dtype. GeoPandas 1.0, released in June 2024, went further: it dropped Shapely 1.x and PyGEOS entirely to standardise on the vectorised Shapely 2 engine, and switched I/O to Pyogrio by default.

Those were real gains, but they addressed the geometry operations. None of it touches how the dataframe around the geometry executes a group-by or a join. That part is still pandas, single-threaded and without a query optimiser. The geometry engine got vectorised; the dataframe engine underneath stayed what it was.

**Why there was no drop-in GeoPolars in 2024.** A Polars-native equivalent to GeoPandas, storing geometry via GeoArrow for zero-copy operations, is exactly what the GeoPolars project set out to build. When I looked, it was stalled on a real upstream gap: Polars didn't support Arrow Extension Types, which GeoArrow needs to represent geometry columns at all. The project sat effectively inactive on that blocker, and there was no way around it from the GeoPolars side. It needed a fix in Polars itself. So I kept the geometry-handling parts of the Datamix pipeline on pandas/GeoPandas and moved on.

**The blocker lifted in November 2025, but as a workaround rather than a fix.** Polars added Arrow Extension Type support that month, which unblocked GeoPolars. Development has resumed since, though its own maintainers still describe it as a prototype rather than production-ready.

What is usable today is `polars-st`, which covers similar ground by storing geometry as WKB (Well-Known Binary, the OGC standard binary serialisation for vector geometry) in a plain binary column and delegating the spatial operations to GEOS, the same engine GeoPandas uses. Every spatial operation therefore pays a serialise/deserialise round-trip through WKB. Its documentation argues that cost is usually marginal next to the spatial operation itself, and that Polars' parallelisation still applies to everything around it. Whether that holds on a given workload is an empirical question, not something to take on trust from a project's own README.

**Where this leaves things.** For an official, industrialisable pipeline, pandas/GeoPandas is still the right call. GeoPolars isn't production-ready, and a stack meant to be maintained and handed over is no place to depend on a prototype. Polars is worth reaching for on the purely tabular stages that don't touch geometry, where the gap is real and the tool is mature.

That said, I'm curious enough about `polars-st` to want an actual number rather than a guess. On the spatial joins and group-bys that were the original bottleneck, does the WKB/GEOS round-trip still net out ahead of GeoPandas, or does it cancel the parallelisation gain? That's a benchmark worth running on its own, separate from anything that ships.

---

*Written from the state of the ecosystem in 2024, with the November 2025 GeoPolars unblock noted as it stands. Versions have moved since. Pandas, GeoPandas and Polars have all had major releases, and the performance picture will have shifted with them. I haven't re-run any of these benchmarks myself.*

---

## References

- db-benchmark (H2O.ai, now DuckDB Labs), group-by and join across dataframe libraries, 0.5 to 50 GB. Living leaderboard, re-run periodically; no dated 2024 snapshot located. A RAPIDS reproduction (Nov. 2023) is archived at [data.rapids.ai/duckdb-benchmark](https://data.rapids.ai/duckdb-benchmark/index.html)
- GeoPandas changelog and 1.0 release (June 2024), covering the ExtensionArray refactor, Shapely 2 requirement and Pyogrio default: [geopandas.org/en/stable/docs.html](https://geopandas.org/en/stable/docs.html), [github.com/geopandas/geopandas/releases](https://github.com/geopandas/geopandas/releases)
- GeoPolars implementation status, upstream blocker and Nov. 2025 unblock: [github.com/geopolars/geopolars/issues/245](https://github.com/geopolars/geopolars/issues/245), [github.com/pola-rs/geopolars](https://github.com/pola-rs/geopolars)
- `polars-st`, WKB/GEOS-backed spatial extension for Polars: [pypi.org/project/polars-st](https://pypi.org/project/polars-st)
