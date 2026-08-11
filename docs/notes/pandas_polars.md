---
tags:
  - python
  - method
  - case
---

# Pandas, Polars, and the GeoPandas gap

In 2024, on Datamix (a public R&D deliverable under IFPen's Tellus programme, building geospatial ML pipelines for CCS/CCUS subsurface property mapping and multi-criteria storage-site selection), the pipeline was spending most of its time in group-by and join operations on GeoDataFrames. Polars was the obvious candidate, and I assumed a mature GeoPandas equivalent already existed for it. It didn't. Why it didn't is what this note is about.

The case for Polars rested on the db-benchmark suite (originally H2O.ai, now DuckDB Labs), which tracks group-by and join across dataframe libraries from 0.5 to 50 GB, precisely the two operations costing me time. Polars came out several times faster than pandas on both, and the reason is structural rather than incidental: pandas runs single-threaded and has no query optimiser. I have not been able to recover the figures I actually read at the time. The db-benchmark is a living leaderboard, not a dated archive, and today's secondary write-ups disagree with each other by a factor of three or more. The order of magnitude was enough to act on; the number is gone.

The natural objection is that none of this required a geospatial Polars at all. Set the geometry aside, run the group-bys and joins on the attribute columns, reattach afterwards. That doesn't work here for two reasons, and the first is decisive: the joins were spatial predicates, not attribute keys, so geometry was an operand of the slow operation rather than a passenger alongside it. There was nothing to park. The second reason is that a hybrid pipeline pays twice, once in conversion at every pandas/Polars handoff and once in maintenance, since the code then carries two sets of idioms for whoever picks it up next. Conversion churn scattered through a workflow is exactly what erases a gain measured in multiples on individual operations. A 1:1 replacement was the only version worth doing.

GeoPandas itself was not the problem, and it's worth being clear about that because it is the thing people assume. By 2024 geometry had long stopped being a numpy `object` dtype holding pointers to Shapely scalars; the `ExtensionArray` refactor gave `GeoSeries` a real `geometry` dtype, and GeoPandas 1.0 (June 2024) dropped Shapely 1.x and PyGEOS to standardise on vectorised Shapely 2, with Pyogrio for I/O. Those gains are real, and they are gains on geometry operations. A group-by or a join over a GeoDataFrame is still executed by pandas. The geometry engine was vectorised; the dataframe engine underneath it was not.

Which is what GeoPolars set out to fix, storing geometry via GeoArrow so that Polars could operate on it zero-copy. When I looked, the project was stalled, and not on effort or interest: Polars had no support for Arrow Extension Types, which GeoArrow needs to represent a geometry column at all. The blocker sat upstream, in Polars, with nothing to be done about it from the GeoPolars side. I kept the geometry-handling stages on pandas/GeoPandas and moved on.

Polars added Extension Type support in November 2025 and GeoPolars resumed, though its maintainers still call it a prototype rather than production-ready. The usable option today is `polars-st`, which sidesteps GeoArrow entirely by storing geometry as WKB (Well-Known Binary, the OGC standard binary serialisation for vector geometry) in an ordinary binary column and handing spatial operations to GEOS, the same engine GeoPandas uses. Every spatial operation therefore pays a serialise/deserialise round-trip. The project's documentation argues that cost is marginal next to the spatial operation itself, with Polars parallelisation still applying to everything around it, which is plausible and unverified. It is a workaround, and it should be read as one.

For an industrialisable pipeline the answer is still pandas/GeoPandas: a stack meant to be maintained and handed over has no business depending on a prototype. Polars earns its place on the purely tabular stages that never touch geometry. What I'd want to know, and haven't measured, is whether the WKB round-trip in `polars-st` nets out ahead of GeoPandas on the spatial joins that were the original bottleneck, or whether it eats the parallelisation gain outright. That's a benchmark on its own, separate from anything that ships.

---

*Written from the state of the ecosystem in 2024, with the November 2025 GeoPolars unblock noted as it stands. Pandas, GeoPandas and Polars have all had major releases since, and the performance picture will have moved with them. I have not re-run any of these benchmarks myself.*

---

## References

- db-benchmark (H2O.ai, now DuckDB Labs), group-by and join across dataframe libraries, 0.5 to 50 GB. Living leaderboard, re-run periodically; no dated 2024 snapshot located. RAPIDS reproduction (Nov. 2023) archived at [data.rapids.ai/duckdb-benchmark](https://data.rapids.ai/duckdb-benchmark/index.html)
- GeoPandas changelog and 1.0 release (June 2024): ExtensionArray refactor, Shapely 2 requirement, Pyogrio default. [geopandas.org/en/stable/docs.html](https://geopandas.org/en/stable/docs.html), [github.com/geopandas/geopandas/releases](https://github.com/geopandas/geopandas/releases)
- GeoPolars implementation status, upstream blocker and Nov. 2025 unblock: [github.com/geopolars/geopolars/issues/245](https://github.com/geopolars/geopolars/issues/245), [github.com/pola-rs/geopolars](https://github.com/pola-rs/geopolars)
- `polars-st`, WKB/GEOS-backed spatial extension for Polars: [pypi.org/project/polars-st](https://pypi.org/project/polars-st)
