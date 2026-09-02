# Verified bibliography — petroleum systems analysis and basin modeling

v3 — 2026-08-13 — supersedes the same-day v2; adds section 3 on organic geochemistry and oil-source rock correlation

Every entry below has been checked by web search: authors, title, year, journal, volume, pagination, DOI or ISBN. Entries from v1 that could not be verified were removed, not moved to an appendix.

Industry affiliations are flagged when they condition how a source should be read.

---

## 1. Foundations

**Wangen, M. (2010).** *Physical Principles of Sedimentary Basin Analysis.* Cambridge University Press, 527 p. ISBN 978-0-521-76125-3.
Author at the Institute for Energy Technology, Norway — no commercial software to defend. Derivations from first principles, Matlab/Octave illustrations. Ch. 12 (overpressure and compaction, exact solutions) provides analytical test cases for checking a solver. Contents: porous media, linear elasticity, compressibility, burial histories, heat flow, subsidence, rheology, flexure, gravity, quartz cementation, overpressure, flow, wells.

**Allen, P.A. & Allen, J.R. (2013).** *Basin Analysis: Principles and Application to Petroleum Play Assessment*, 3rd ed. Wiley-Blackwell, 632 p. ISBN 978-0-470-67377-5.
Geodynamic side of the field. Appendices with mathematical derivations and worked exercises — that's the useful part.

**Hantschel, T. & Kauerauf, A.I. (2009).** *Fundamentals of Basin and Petroleum Systems Modeling.* Springer, 476 p. ISBN 978-3-540-72317-2, DOI 10.1007/978-3-540-72318-9.
Industry link: both authors were at Integrated Exploration Systems (Aachen), a Schlumberger company. Read this as the theoretical documentation of PetroMod. Main value: the rock and fluid property tables and the kinetic parameters.

**Magoon, L.B. & Dow, W.G. (eds, 1994).** *The Petroleum System — From Source to Trap.* AAPG Memoir 60. ISBN 0-89181-338-1.
19 foundational chapters plus 18 case studies. Reference for naming discipline and for the system / play / prospect distinction.

---

## 2. Critical counterweight

**Düppenbecker, S.J. & Iliffe, J.E. (eds, 1998).** *Basin Modelling: Practice and Progress.* Geological Society, London, Special Publication 141, 256 p. ISBN 978-1-86239-008-9.
Edited by BP Exploration and PGS Tigress, outside the IFP and IES lineages. Two chapters:
- **Giles, M.R., Indrelid, L. & James, D.M.D.** — *Compaction — the great unknown in basin modelling*, p. 15–43.
- **Thomsen, R.O.** — *Aspects of applied basin modelling: sensitivity analysis and scientific risk*, p. 209–221. DOI 10.1144/GSL.SP.1998.141.01.13.

**Peters, K.E., Curry, D.J. & Kacewicz, M. (eds, 2012).** *Basin Modeling: New Horizons in Research and Applications.* AAPG Hedberg Series 4, viii + 338 p. ISBN 0-89181-903-7.
18 contributions from the Hedberg Conference in Napa, May 2009. Introductory chapter p. 1–16.

---

## 3. Organic geochemistry and oil-source rock correlation

### 3.1 General framework

**Tissot, B.P. & Welte, D.H. (1984).** *Petroleum Formation and Occurrence*, 2nd ed. Springer. DOI 10.1007/978-3-642-87813-8.

**Dembicki, H. (2022).** *Practical Petroleum Geochemistry for Exploration and Production*, 2nd ed. Elsevier, 424 p. ISBN 978-0-323-95924-7.
Chapters 8 (basin modeling) and 9 (petroleum system concepts).

**Peters, K.E., Walters, C.C. & Moldowan, J.M. (2005).** *The Biomarker Guide*, 2nd ed., 2 vols., 1132 p. Cambridge University Press. Vol. 1 ISBN 0-521-78158-2; vol. 2 ISBN 0-521-83762-6.
Vol. 2 (*Biomarkers and Isotopes in Petroleum Exploration and Earth History*) is the volume relevant here. A reference work, consulted rather than read cover to cover.

### 3.2 Oil-source rock correlation — read this one first

**Curiale, J.A. (2008).** Oil–source rock correlations — limitations and recommendations. *Organic Geochemistry* 39(8), 1150–1161. DOI 10.1016/j.orggeochem.2008.02.001.
Central thesis: chemical correlation has become easy, almost automatic once statistical approaches are used, and that is precisely the problem. The limiting factor is not analytical but the state of knowledge of the natural variability — lateral and vertical — of organic matter deposition in the candidate source rock. A defensible correlation ties a rock sample to an individual oil through mutually consistent genetic parameters, not through a similarity score. Operational recommendation: work from composite isotopic profiles of the source rock rather than a single sample. An analytical uncertainty tied to the rock extraction method also remains.

The point most textbooks skip: what gets compared is a rock extract against an expelled oil — two objects already separated by expulsion fractionation, charge mixing, and the maturity overprint, before any measurement is even made.

### 3.3 Screening and pyrolysis

**Peters, K.E. (1986).** Guidelines for evaluating petroleum source rock using programmed pyrolysis. *AAPG Bulletin* 70(3), 318–329. DOI 10.1306/94885688-1704-11D7-8645000102C1865D.
Short, and still the reference on interpretation pitfalls. Mineral matrix effect: organic-lean, clay-rich rocks degrade pyrolysate through adsorption, giving a lower HI and a higher Tmax than on isolated kerogen. Coal potential is systematically overestimated by pyrolysis (S2/S3 > 5 and HI < 300 mg HC/g TOC are typical) and is better determined by elemental analysis and organic petrography. Contamination diagnostics on an immature sample: bimodal S2, PI above 0.2. Recommended sampling density: one pyrogram every 9 to 18 m.

**Behar, F., Beaumont, V. & De B. Penteado, H.L. (2001).** Rock-Eval 6 technology: performances and developments. *Oil & Gas Science and Technology — Revue de l'IFP* 56(2), 111–134. DOI 10.2516/ogst:2001013.
Double industry link: IFP research, instrument marketed by Vinci Technologies since 1996. Dataset of 147 source rocks. Practical point when merging data from different eras: Tmax values from Rock-Eval 6 run higher than Rock-Eval 2, with a growing offset at higher Tmax, because the temperature probe sits in contact with the crucible instead of being embedded in the furnace wall. The carrier gas also changes (nitrogen instead of helium), which shifts measured carbon values by 5 to 10% relative on most samples. The furnace reaches 800 °C instead of 600 °C.

### 3.4 Isotopes

**Sofer, Z. (1984).** Stable carbon isotope compositions of crude oils: application to source depositional environments and petroleum alteration. *AAPG Bulletin* 68(1), 31–49. DOI 10.1306/AD460963-16F7-11D7-8645000102C1865D.
339 oils. A result routinely miscited: the absolute δ¹³C value of a fraction does not discriminate marine from terrigenous source. C15+ aromatics from the two families are isotopically identical; saturates from terrigenous oils average only 0.9‰ more negative — too small a gap to serve as an indicator on its own. The signal lies in the relationship between saturates and aromatics, hence the canonical variable. Any "marine" conclusion drawn from a single global δ¹³C value is a misreading. Stable isotopes can also, in some cases, correlate a biodegraded oil to its non-degraded equivalent.

### 3.5 Maturity and fluid composition

**Sweeney, J.J. & Burnham, A.K. (1990).** Evaluation of a simple model of vitrinite reflectance based on chemical kinetics. *AAPG Bulletin* 74(10), 1559–1570. DOI 10.1306/0C9B251F-1710-11D7-8645000102C1865D.
EASY%Ro: parallel first-order reactions, distribution of activation energies. Stated range of validity: Ro from 0.3 to 4.5%; heating rates from 1 °C/week (laboratory) to 1 °C/10 Ma (slowly subsiding basin).

**di Primio, R. & Horsfield, B. (2006).** From petroleum-type organofacies to hydrocarbon phase prediction. *AAPG Bulletin* 90(7), 1031–1058. DOI 10.1306/02140605129.
GFZ Potsdam group. The PhaseKinetics approach combines open- and closed-system pyrolysis, with a gas composition correction. Central argument: compositional kinetics built solely on open-system pyrolysis do not reproduce natural gas composition, and therefore do not predict phase behavior correctly.

---

## 4. Thermal

**Beardsmore, G.R. & Cull, J.P. (2001).** *Crustal Heat Flow: A Guide to Measurement and Modelling.* Cambridge University Press, 324 p. ISBN 0-521-79289-4 (hardback), 0-521-79703-9 (paperback).
Crustal heat sources, accuracy of temperature data, measurement of rock thermal properties, maturity indicators, then thermodynamic models of the lithosphere. Independent of any simulator.

---

## 5. Compaction and overpressure

**Athy, L.F. (1930).** Density, porosity, and compaction of sedimentary rocks. *AAPG Bulletin* 14(1), 1–24. DOI 10.1306/3D93289E-16B1-11D7-8645000102C1865D.
The relationship is established between burial depth and porosity, not between effective stress and porosity. Data from north-central Oklahoma.

**Schneider, F., Potdevin, J.L., Wolf, S. & Faille, I. (1996).** Mechanical and chemical compaction model for sedimentary basin simulators. *Tectonophysics* 263(1–4), 307–317. DOI 10.1016/S0040-1951(96)00027-3.
Industry link: IFP. Elastoplastic hardening model, plastic limit set by the maximum vertical effective stress reached, plus a viscoplastic term. Uniaxial strain assumed. The chemical compaction component is contested — see section 8.

**Osborne, M.J. & Swarbrick, R.E. (1997).** Mechanisms for generating overpressure in sedimentary basins: a reevaluation. *AAPG Bulletin* 81(6), 1023–1041. DOI 10.1306/522B49C9-1727-11D7-8645000102C1865D.
Three mechanism families: stress increase, fluid or matrix volume change, fluid movement or buoyancy. Conclusion: stress-related mechanisms dominate in many basins; aquathermal expansion and clay dehydration are insufficient except under near-perfect sealing; hydrocarbon buoyancy and osmosis produce only small, local overpressures. Open debate in the Bulletin, with an authors' reply in 1999 and a discussion by Waples in 2001 (v. 85, no. 12).

**Bjørlykke, K. & Høeg, K. (1997).** Effects of burial diagenesis on stresses, compaction and fluid flow in sedimentary basins. *Marine and Petroleum Geology* 14(3), 267–276. DOI 10.1016/S0264-8172(96)00051-7.
Below 2–3 km, compaction becomes primarily chemical. The effective stresses driving mechanical compaction are then small, and rapid expulsion of pore water from mudstones is impossible given the permeabilities involved.

---

## 6. Regional flow — the hydrogeological school

**Bethke, C.M. (1985).** A numerical model of compaction-driven groundwater flow and heat transfer and its application to the paleohydrology of intracratonic sedimentary basins. *Journal of Geophysical Research* 90(B8), 6817–6828. DOI 10.1029/JB090iB08p06817.
Lagrangian formulation, heterogeneous and anisotropic accreting domain, deformable-medium continuity and aquathermal pressuring made explicit. Result: slow movement over long durations, with conclusions unfavorable to compaction-driven flow as a driver of secondary migration within intracratonic basins.

**Person, M., Raffensperger, J.P., Ge, S. & Garven, G. (1996).** Basin-scale hydrogeologic modeling. *Reviews of Geophysics* 34(1), 61–87. DOI 10.1029/95RG03286.
Synthesis of coupled flow / heat / chemical transport at basin scale: mathematical formulations, solution methods, applications. The hydrogeological counterpart to what Hantschel & Kauerauf provides on the petroleum side.

---

## 7. Migration

**England, W.A., Mackenzie, A.S., Mann, D.M. & Quigley, T.M. (1987).** The movement and entrapment of petroleum fluids in the subsurface. *Journal of the Geological Society* 144(2), 327–347. DOI 10.1144/gsjgs.144.2.0327.
Industry link: BP Research Centre, Sunbury-on-Thames. Subsurface fluid phase behavior, engineering correlations for fluid properties, combined buoyancy + water-flow forces expressed as fluid potential, lateral vs. vertical carrier distinction. Independent of any simulator.

**Ungerer, P., Burrus, J., Doligez, B., Chenet, P.Y. & Bessis, F. (1990).** Basin evaluation by integrated two-dimensional modeling of heat transfer, fluid flow, hydrocarbon generation, and migration. *AAPG Bulletin* 74(3), 309–335. DOI 10.1306/0C9B22DB-1710-11D7-8645000102C1865D.
Industry link: IFP, Beicip, CILIA. Coupling of compaction law / Darcy's law / natural hydraulic fracturing criterion, two-phase migration. Applications to the Mahakam delta and the North Sea. A historical document of one lineage (ancestor of Temis).

---

## 8. Diagenesis — an open controversy

The disagreement concerns what drives quartz dissolution: effective stress, or temperature and the presence of clay at grain interfaces. It changes the porosity predicted at depth.

**Bjørkum, P.A. (1996).** How important is pressure in causing dissolution of quartz in sandstones? *Journal of Sedimentary Research* 66(1), 147–154. DOI 10.1306/D42682DE-2B26-11D7-8648000102C1865D.
Micas penetrate quartz grains with negligible deformation on the Norwegian shelf; calculating their mechanical properties implies dissolution under less than 10 bar, a small fraction of the lithostatic load.

**Walderhaug, O. (1996).** Kinetic modeling of quartz cementation and porosity loss in deeply buried sandstone reservoirs. *AAPG Bulletin* 80(5), 731–745. DOI 10.1306/64ED88A4-1724-11D7-8645000102C1865D.
Silica sourced from dissolution at stylolites and clay contacts, short diffusion distance, precipitation onto clean quartz surfaces. Precipitation rate expressed as an empirical logarithmic function of temperature. Available surface area is recalculated at every time step.

**Lander, R.H. & Walderhaug, O. (1999).** Predicting porosity through simulating sandstone compaction and quartz cementation. *AAPG Bulletin* 83(3), 433–449. DOI 10.1306/00AA9BC4-1730-11D7-8645000102C1865D.
The *Exemplar* model. Compaction as exponential decay of intergranular volume with effective stress; quartz cementation follows Walderhaug (1996). Inputs: effective-stress and temperature histories from a basin model, plus depositional composition and texture from point counting. Validated on the Gulf of Mexico, the Norwegian shelf, Illinois, and the Baltic.

---

## 9. Subsidence

**McKenzie, D. (1978).** Some remarks on the development of sedimentary basins. *Earth and Planetary Science Letters* 40(1), 25–32. DOI 10.1016/0012-821X(78)90071-7.
Two-stage model: rapid stretching with passive asthenosphere upwelling, followed by slow conductive subsidence. Slow subsidence and heat flow depend only on the stretching factor, which makes the model testable.

**Sclater, J.G. & Christie, P.A.F. (1980).** Continental stretching: an explanation of the post-mid-Cretaceous subsidence of the central North Sea basin. *Journal of Geophysical Research* 85(B7), 3711–3739. DOI 10.1029/JB085iB07p03711.
