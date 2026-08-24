---
tags:
  - decision
  - method
  - MCDA
---

# MCDA: PROMETHEE and AHP

Multi-criteria decision analysis is useful when several criteria matter, when they are different in nature (technical, economic, risk, regulatory), and when reducing them to a single number such as NPV would lose information worth keeping. It structures expert judgment rather than replacing it, and makes it explicit enough to check and discuss.

PROMETHEE and AHP are the two methods I use most for this. They are not competing choices. They answer slightly different questions and, in some workflows, feed into each other.

## Where this comes up in petroleum geoscience

The recurring use case is ranking zones or opportunities: leads, prospects, exploration blocks, or CO2 storage sites. The criteria are heterogeneous by nature, covering charge and maturity, seal integrity, estimated volume, access and logistics, cost, geopolitical risk, and environmental footprint.

## PROMETHEE

PROMETHEE compares alternatives pairwise, criterion by criterion. For each pair and each criterion, a preference function (six standard shapes exist: usual, quasi, linear, level, linear with indifference area, Gaussian) converts the difference into a preference degree between 0 and 1, bounded by an indifference threshold q and a strict preference threshold p. These pairwise preferences are aggregated per weighted criterion into a positive and a negative outranking flow. The net flow combines the two.

There is no single absolute score. The result is a partial ranking (PROMETHEE I) or a complete one (PROMETHEE II, based on the net flow). The method does not force full compensation between criteria, unlike a classic weighted sum.

In practice, running PROMETHEE means going through the same handful of steps regardless of the case:

```
decision matrix: alternatives x criteria
   complete (no gaps), direction set per criterion (higher better or worse)
   text or categorical criteria converted to numeric values first
        ↓
standardize each criterion onto a 0 to 1 scale
   not normalization: needed because criteria are often not comparable
   in raw units yet are still allowed to compensate each other
   (water depth for drilling vs hydrocarbon volume, for example)
        ↓
preference function per criterion
   one of six shapes, thresholds q (indifference) and p (strict preference)
        ↓
weighted aggregation per criterion
   weights equal or expert-set, not required to be equal
        ↓
positive flow + negative flow → net flow
        ↓
ranking: partial (PROMETHEE I) or complete (PROMETHEE II)
```

A few things matter beyond the diagram itself. The decision matrix has to be complete: a missing value for one alternative on one criterion breaks every pairwise comparison that touches it, so gaps get filled or that alternative gets dropped before anything else happens. Text and categorical criteria, a qualitative rating such as reservoir quality (good, medium, poor), have to become numeric first, since PROMETHEE has no built-in way to compare labels.

The step that matters most is standardizing before the preference function ever runs, not normalizing. These methods rank alternatives across criteria that are often not directly comparable in their raw units, water depth for drilling against hydrocarbon volume, for instance, yet the method still lets one compensate for the other in the final ranking. That compensation only means something once both criteria sit on the same scale. Skip the step and the method ends up comparing metres of water depth directly against billions of barrels, and the units, not the actual trade-off, decide how much one offsets the other. The preference function itself then plays a role close to an activation function in a neural network: it takes the standardized difference between two alternatives on one criterion and squashes it into a bounded preference degree between 0 and 1. Below q it does not matter at all, above p it matters fully, and the shape chosen in between decides how gently or sharply preference builds up.

Weights come last and do not have to be equal. Equal weights are a legitimate starting point when there is no strong reason to favour one criterion over another, but in most real cases some criteria genuinely matter more, seal integrity over access logistics, say, and the net flow is a weighted sum of preference degrees, so the weighting scheme decides the final order as much as the preference functions do.

Standardization is not always a straight line from bad to good, though. Some criteria have an interior sweet spot rather than a direction that keeps improving toward one end. A gas-oil ratio in the condensate window, for unconventional screening, is the clearest example: too low and the fluid is closer to black oil, too high and it is closer to dry gas, and only a band in the middle is what you are actually looking for. The standardized value sits at its best across that window and tapers off on both sides as the raw value moves away from it, in either direction. This is a genuinely different shape from maximize or minimize, and it comes up often enough in fluid typing to be worth naming rather than forcing into a standardization that assumes one end of the scale is always better.

## AHP

AHP, the Analytic Hierarchy Process, breaks the problem into a hierarchy: objective, then criteria, then alternatives. Judgments are made through pairwise comparison using Saaty's scale from 1 to 9. The principal eigenvector of the resulting comparison matrix gives the weights, and its largest eigenvalue is used to compute a consistency ratio, which should stay under 0.10. Once weights are obtained at each level, the alternatives are aggregated through a classic weighted sum.

Unlike PROMETHEE, AHP is fully compensatory. A poor score on one criterion can be offset by a strong score elsewhere.

The workflow follows the hierarchy down, one level at a time:

```
hierarchy: goal → criteria → alternatives
        ↓
pairwise comparison matrix (criteria level)
   Saaty scale 1-9, complete, reciprocal (A vs B = 3 implies B vs A = 1/3)
        ↓
principal eigenvector → weights
        ↓
consistency ratio check
   CR < 0.10 accepted, CR ≥ 0.10 → judgments revisited, not the arithmetic
        ↓
same comparison, one level down, alternatives under each criterion
   or, when criteria are measured maps: weight x standardized map,
   summed across criteria, then the sum re-standardized to 0 to 1
        ↓
weighted sum → ranking or favourability map
```

A few things matter beyond the diagram here too. The comparison matrix has to be complete and reciprocal, every criterion compared against every other one, with the reverse comparison fixed by construction rather than judged separately. Weights come out of the matrix itself rather than being assigned by hand the way PROMETHEE weights are, which is the main structural difference between the two methods; equal weighting only happens if the comparison matrix itself says every criterion is equally important, which is rare once real judgments go in.

The consistency ratio is worth being precise about. It checks the internal coherence of the judgments, not whether the weights are right, and that distinction is not academic. Maghsoudi Moud et al. (2022, *Arabian Journal of Geosciences*, DOI: 10.1007/s12517-022-10913-w) make the units problem concrete rather than theoretical: they built an AHP-based mineral prospectivity map combining one layer measured in nanotesla with another in percent, and note plainly that feeding raw layers with different units into the weighted matrix biases the result regardless of how consistent the pairwise judgments were. Their fix was the same one described above, normalizing every layer onto a common scale before the weights ever touch it.

## Where they complement each other

In practice, I have used AHP to derive criteria weights through structured pairwise judgment, then fed those weights into PROMETHEE for the actual ranking. AHP is well suited to building consensus on weights among several experts, since the consistency ratio flags disagreement early. PROMETHEE is better suited to the ranking itself once weights are set, since it avoids full compensation between criteria and handles thresholds and indifference zones that a plain weighted sum cannot.

Both methods, along with most of their variants (PROMETHEE I through VI, classic and fuzzy AHP), are implemented and documented in pyDecision, a public Python library. This means the code behind either example can be shown as is, without reimplementation.

## Two illustrations

For PROMETHEE, I use a synthetic case rather than a real one, for confidentiality reasons. Five fictitious prospects, five criteria: oil volume, gas-oil ratio (GOR), drilling depth, ownership share, and tax per barrel. The structure, the kinds of criteria and their spread, mirrors a real ranking exercise closely enough to demonstrate two things that matter in practice: sensitivity to weights, and rank reversal when an alternative is added or removed.

```python
import numpy as np
import pandas as pd
from pyDecision.algorithm import promethee_ii

prospects = ["P1", "P2", "P3", "P4", "P5"]
criteria  = ["oil_volume_mmbbl", "gor_scf_bbl", "drilling_depth_m", "ownership_pct", "tax_per_bbl_usd"]

raw = pd.DataFrame(
    [
        [120,  450, 3200, 60,  8.5],
        [ 85,  900, 2100, 100, 5.0],
        [200,  300, 4500, 40, 12.0],
        [ 60, 1800, 1500, 80,  6.5],
        [150,  600, 3800, 55,  9.0],
    ],
    index=prospects, columns=criteria,
)

# True = higher is better, False = lower is better
maximize = {"oil_volume_mmbbl": True, "gor_scf_bbl": False, "drilling_depth_m": False,
            "ownership_pct": True, "tax_per_bbl_usd": False}

# standardize to 0-1 and orient every criterion so higher always means better,
# since pyDecision reads distance as dataset[i] - dataset[j] with no separate
# min/max flag: it assumes the sign of that difference already means something
std = pd.DataFrame(index=raw.index, columns=raw.columns, dtype=float)
for c in criteria:
    lo, hi = raw[c].min(), raw[c].max()
    scaled = (raw[c] - lo) / (hi - lo)
    std[c] = scaled if maximize[c] else 1 - scaled

dataset = std.to_numpy()

W = [0.35, 0.15, 0.20, 0.10, 0.20]   # weights, sum to 1
Q = [0.05, 0.05, 0.05, 0.00, 0.05]   # indifference threshold, standardized units
P = [0.30, 0.30, 0.30, 0.20, 0.30]   # strict preference threshold
S = [0.15, 0.15, 0.15, 0.15, 0.15]   # gaussian sigma, unused here since F is t5/t1
F = ['t5', 't5', 't5', 't1', 't5']   # t5 = linear w/ indifference, t1 = usual criterion

result = promethee_ii(dataset, W=W, Q=Q, S=S, P=P, F=F, sort=True, verbose=False)
```

Running this gives P2 on top, then P1, P5, P3, P4 by net flow. P2 wins on the back of low GOR, shallow drilling depth, and low tax per barrel, even though it has neither the largest oil volume (that is P3) nor the highest ownership (P4). That is the point of the exercise: nudge the weight on oil volume up by a few points, or push ownership's threshold from t1 to something with an indifference zone, and watch whether P2 still leads or P1 overtakes it. If it flips easily, the ranking was never robust to begin with, whatever the deterministic-sounding output implies.

One detail worth flagging since it is easy to get backwards: pyDecision's `preference_degree` function has no explicit minimize or maximize flag. It reads the raw difference between two rows on a criterion and treats a positive difference as preference. Orienting every criterion to "higher is better" before the data ever reaches the function is not optional here, it is how direction gets encoded at all. This is the same standardize-and-orient step described earlier in this note, done concretely.

For AHP, I point to Datamix, cited here as an example (Lebrun et al., 2022, Second EAGE Digitalization Conference and Exhibition, DOI: 10.3997/2214-4609.202239014). The workflow behind that favourability map runs like this: AHP gives the weight of each criterion, each criterion map is standardized onto a 0 to 1 scale on its own, then the favourability map is the sum of weight times standardized map, criterion by criterion. That sum is not automatically bounded between 0 and 1 once several criteria are added together, so it gets standardized once more at the end to read as a favourability score. The workflow described in that paper goes further and runs multiple realisations of the whole chain: each criterion map is perturbed according to its own uncertainty range, the weighted sum recomputed for each draw, and the resulting set of favourability maps summarised as Q10, Q50, and Q90. This is not a stochastic variant of AHP. It is the same deterministic chain run repeatedly on different inputs.

The case described in that paper evaluates geothermal potential in British Columbia, using heat flow, faults, volcanoes, and hot springs as criteria, with weights defined per geological domain.

## What actually breaks

Every method above looks solid on a slide until something moves. For PROMETHEE, the two questions worth asking on any real ranking are how much the order changes when weights shift within a defensible range, and whether adding or removing one alternative flips the order of the others. Rank reversal is not a corner case. It shows up quickly once criteria are correlated, which they usually are in practice.

For AHP, the equivalent question is not whether the ranking is stable, but how wide the Q10 to Q90 envelope becomes once input uncertainty is propagated through the method. A narrow envelope means the ranking is robust to what you don't know. A wide one means the favourability map is really a statement about uncertainty, not about which prospect comes out on top.

## Calibration, uncertainty propagation, and criteria selection

Both methods present themselves as objective once the machinery runs: standardized inputs, a defined preference function or a consistency-checked matrix, a reproducible ranking. That objectivity stops at the weights. Weights are chosen by someone, and whoever sets them can steer the outcome toward a conclusion decided in advance, deliberately or not. Calling the output deterministic only means the same weights produce the same ranking for the same inputs. It says nothing about whether those inputs and weights were picked to reflect priorities honestly or to justify a result someone already wanted. This is not a hypothetical concern. Singh et al. (2026, *Scientific Reports*, DOI: 10.1038/s41598-026-45064-5) say it directly about their own AHP-based groundwater study: the pairwise judgments carry subjectivity in allocating weights regardless of what the consistency ratio confirms. A consistent matrix is an internally coherent set of opinions, not proof those opinions were the right ones. Maghsoudi Moud et al. (2022, cited above) went a step further and checked their AHP weights against an independent, data-driven method (weight of evidence) rather than trusting the pairwise judgments alone, specifically to catch cases where expert opinion and what the data actually show diverge.

That last point cuts deeper than the weights alone. The criterion values themselves are often uncertain, and each run of PROMETHEE or AHP is deterministic only for the specific numbers it is fed. A prospect's expected volume, for instance, is rarely a single figure. It comes with a P10, P50, and P90. Rank on the P50 and one order comes out. Rank on the P10 or the P90 instead, everything else unchanged, and a different order can come out just as easily. This is the same logic behind the Q10 to Q90 favourability maps in the AHP example above, and it applies just as directly to PROMETHEE: running either method once, on a single point estimate per criterion, hides how much the ranking actually depends on which vintage of an uncertain number went in. Propagating that uncertainty through, rather than picking one value and moving on, is not an optional refinement once volumes, costs, or risk factors carry real ranges.

The practical risk is that percentile choice becomes another lever for tuning the outcome, P10 on this criterion, P50 on that one, criterion by criterion, until the ranking lands where someone wanted it before the exercise started. The discipline against that is the same one as for weights and criteria: state which percentile fed each criterion, and if the ranking is sensitive to that choice, show the range instead of hiding behind a single deterministic run.

There is also an organizational side to this that is easy to underestimate. Introducing PROMETHEE or AHP into how a portfolio of opportunities gets ranked means competing with whatever ranking already exists, usually built in Excel, sometimes on criteria nobody ever wrote down. A formal method that produces a different order than the informal one in use is rarely read as a neutral second opinion. It is read as a challenge to decisions already made, and the friction that creates is part of the calibration problem, not separate from it.

The other recurring issue, in both methods, is picking the right number of criteria and the right ones. There is no clean rule for this. In practice, criteria get added or dropped repeatedly through calibration, and not always for a principled reason. A criterion sometimes gets added or removed specifically because it counteracts the effect of another one on the ranking, which tunes the outcome by adjusting the criteria set instead of the weights. It produces the same effect as biased weighting, just one step removed and harder to spot on review.

None of this is a reason to avoid either method. It is a reason to document the criteria list and the weights as explicitly as the ranking itself, and to expect the same scrutiny on both.

## References

- Saaty, R.W. (1987). The Analytic Hierarchy Process: What It Is and How It Is Used. *Mathematical Modelling*, 9(3), 161-176.
- Lebrun, L., Delbos, F., Rasolofosaon, P.N.J., Dehghan, K., Gomez, J., Siccardi, O. (2022). Advanced Geothermal Prospectivity Mapping with Machine Learning Using Multi-Model Regression and Geology-Dependent Multi-Criteria Decision Analysis. *Second EAGE Digitalization Conference and Exhibition*. DOI: 10.3997/2214-4609.202239014
- Kimball, S. (2010). Favourability Map of British Columbia Geothermal Resources. MSc thesis, University of British Columbia.
- Maghsoudi Moud, F., Abbaszadeh Shahri, A., van Ruitenbeek, F., Hewson, R., van der Meijde, M. (2022). Evaluation of the Modified AHP-VIKOR for Mapping and Ranking Copper Mineralized Areas, a Case Study from the Kerman Metallogenic Belt, SE Iran. *Arabian Journal of Geosciences*, 15, 1756. DOI: 10.1007/s12517-022-10913-w
- Singh, K., Sharma, A., Sharma, A., Gupta, R., Bhowmik, A., Senagah, A., Al-Ansari, N., Juneja, G., Mattar, M.A. (2026). AHP Integrated Geospatial Application for Identifying Groundwater Recharge Zones Accounting for Temporal Variations Through Multi-Criterion Weighted Overlay Analysis. *Scientific Reports*, 16, 16431. DOI: 10.1038/s41598-026-45064-5
- pyDecision (Python library): https://github.com/Valdecy/pyDecision

---

*These pages reflect my own understanding, built over time. Errors are mine, if you spot one, I'd like to hear about it.*
