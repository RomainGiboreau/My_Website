# Tools

Small utilities that run entirely in your browser: nothing you load leaves your machine. Most of them are protected by a password.

| Tool | What it does |
|---|---|
| [TR Cycles](https://RomainGiboreau.github.io/My_Website/tr-cycles/) | Transgressive–regressive cycle curves, benchmarks and user data |
| [Plot digitizer](https://RomainGiboreau.github.io/My_Website/digitizer/) | Extract data from a plot image (linear/log axes, automatic curve detection) |
| [Map digitizer](https://RomainGiboreau.github.io/My_Website/mapdigitizer/) | Read a continuous property from a map image and its colour legend, on a regular grid |
| [Map interpolation](https://RomainGiboreau.github.io/My_Website/gridding/) | Grid scattered points: kriging variants, IDW, splines, TIN, with secondary variables |
| [Rock-Eval QC](https://RomainGiboreau.github.io/My_Website/rockeval/) | Quality control of Rock-Eval data and standard crossplots |
| [Compaction fit](https://RomainGiboreau.github.io/My_Website/compaction/) | Porosity–depth fits (Athy and others) and layer decompaction |
| [Thermal maturity](https://RomainGiboreau.github.io/My_Website/maturity/) | EASY%Ro vitrinite reflectance and Lopatin TTI from a burial and temperature history |
| [Biomarkers](https://RomainGiboreau.github.io/My_Website/biomarkers/) | Biomarker ratios, ternary C27–C28–C29, maturity indicators |
| [Chromatogram](https://RomainGiboreau.github.io/My_Website/chromatogram/) | Peak detection, baseline and areas from a chromatogram |
| [Clustering](https://RomainGiboreau.github.io/My_Website/clustering/) | k-means, hierarchical, DBSCAN and Gaussian mixture, with silhouette, elbow/BIC and PCA view |
| [Convex & concave hulls](https://RomainGiboreau.github.io/My_Website/hull/) | Convex hull and alpha-shape concave hull per group, with area, perimeter, WKT and GeoJSON export |
| [BHT correction](https://RomainGiboreau.github.io/My_Website/bht/) | Horner extrapolation of bottom-hole temperatures, last-resort correction, geothermal gradient |
| [Source rock potential](https://RomainGiboreau.github.io/My_Website/source/) | Pyrolysis richness, kerogen quality and maturity classes, HI–Tmax and TOC–S2 plots, source potential index |
| [Ternary diagram](https://RomainGiboreau.github.io/My_Website/ternary/) | Ternary plots by group with arithmetic and compositional (geometric) centres |
| [Variogram](https://RomainGiboreau.github.io/My_Website/variogram/) | Directional experimental variogram of scattered data and spherical / exponential / Gaussian fit |

## Methods, sources and validation

Last updated 12 October 2026. Each line says where the method or the numbers come from and how the code was checked. Status tags: **published** (the source was read), **figure** (values read off a published figure, not from a table), **supplied** (numbers supplied by the site author, not checked against the paper), **derived** (own derivation from a mass balance or from first principles), **memory** (written from memory, not checked), **classical** (standard method, reference still to add). A reference is listed only when its existence was confirmed; when only the bibliographic record is known, the details are left out rather than guessed.

### Vitrinite reflectance and thermal maturity

| Item | Source | Status |
|---|---|---|
| EASY%Ro (20 parallel first-order reactions, A = 10¹³ s⁻¹, Ea 34–72 kcal/mol, factors summing to 0.85, %Ro = exp(−1.6 + 3.7 F)) | Sweeney & Burnham (1990), AAPG Bulletin 74(10), 1559–1570, Table 1 | published |
| Temperature integral | Same paper, Appendix 1, eq. 10 (approximation of Braun & Burnham 1987) | published |
| Easy%RoDL (A = 2×10¹⁴ s⁻¹, Ea 38–76, factors summing to 0.95, %Ro = exp(−1.5 + 3.7 F)) | Schenk, Peters & Burnham (EAGE 2017); Burnham, *Global Chemical Kinetics of Fossil Fuels* (2017) | figure (bar chart; no table is published) |
| Basin%Ro (A = exp(60.9856) Ma⁻¹, Ea 34–72, factors summing to 0.9215, %Ro = 0.2104 exp(3.7 F)) | Nielsen, Clausen & McGregor (2015), Basin Research, doi 10.1111/bre.12160 | supplied (paper not read; paywalled) |
| F not renormalised by the sum of the factors (as in EASY%Ro) | With this convention the largest Easy − Basin difference between 0.5 and 1.7 %Ro at 3 °C/Ma is 0.35 %Ro, the value stated in the abstract of Nielsen et al. | derived check |
| TTI (Lopatin) | Waples (1980), AAPG Bulletin (exact reference to complete) | memory (formula not checked) |

Validation: JavaScript against brute-force numerical integration of the same kinetics, largest difference 0.0006 %Ro (EASY%Ro) and 0.001 %Ro (Easy%RoDL, Basin%Ro) for constant heating rates of 1 to 50 °C/Ma.

### Bottom-hole temperature

| Item | Source | Status |
|---|---|---|
| Horner extrapolation T = T<sub>f</sub> − m ln((t<sub>c</sub> + Δt)/Δt), intercept by least squares with a Student-t interval | Horner (1951), Proc. 3rd World Petroleum Congress, 34, 316 (as cited by ZetaWare) | classical |
| "Last resort" correction, T<sub>eq</sub> = BHT + 33 °F (18.3 °C), 1σ about 9 °C; Horner 1σ about 8 °C | Corrigan (1997), AEPT Research Memo RM 97-0007, as reported by [ZetaWare](https://zetaware.com/utilities/bht/default.html) | published (second hand) |
| Waples et al. correction T<sub>true</sub> = T<sub>surf</sub> + f (T<sub>meas</sub> − T<sub>surf</sub>) − 0.001391 (Z − 4498) | Waples, Pacheco & Vera (2004), Petroleum Geoscience 10, 239–245, as reported by [ZetaWare](https://zetaware.com/utilities/bht/waples_gom.html) | published (second hand) |
| f = 1.32866 exp(−0.005289 TSC) | A summary of the same paper; its Fig. 3 gives a slightly different regression, 1.3433 exp(−0.0059 TSC) | supplied (not checked against the paper) |

Validation: intercept, 95 % interval, slope, R² and gradient identical to scipy to 4 significant digits. The Waples formula was recomputed independently; its coefficients were not checked.

### Source rock potential

| Item | Source | Status |
|---|---|---|
| TOC richness limits 0.5 / 1 / 2 / 4 wt % | Reproduced in open reports, after Peters (1986) | published (second hand) |
| S1, S2, HI and Tmax class limits | Peters & Cassa (1994), *Applied Source Rock Geochemistry*, AAPG Memoir 60; other authors use different S2 limits | memory (editable in the page) |
| Source potential index SPI = Σ h (S1 + S2) ρ / 1000 | Demaison & Huizinga (1991) (reference not retrieved here) | memory |
| Transformation ratio from HI and PI | Jarvie et al. (2007), AAPG Bulletin 91(4), 475–499, as presented by [ZetaWare](https://zetaware.com/utilities/srp/index.html) | published (second hand) |
| TOC0 from a carbon mass balance (generated hydrocarbons, 83.3 % carbon, leave the rock) | The TOC0 equation as written on the ZetaWare page does not return TOC0 = TOC at TR = 0 and was not used | derived |
| Original TOC0 and TR, He method | As given on the ZetaWare page (author named there: Zhiyong He) | published (second hand) |
| Tight oil from S1 (S1 × rock density / oil density) | Downey (2011), AAPG Annual Convention, as described by ZetaWare | published (second hand) |
| Gas / oil split by GOGI, gas fraction = GOGI/(1 + GOGI) | ZetaWare page, which cites Pepper & Corvi (1995), Marine and Petroleum Geology 12, 291–319. The expulsion model of that paper is not implemented | published (second hand) |
| PI<sub>0</sub> = 0.02, gas density 0.7 kg/m³ at standard conditions | Assumptions, editable in the page | memory |

Validation: HI and SPI against numpy; the ZetaWare tight-oil example (S1 = 5 mg/g, 35 °API, 2.5 g/cm³) is reproduced: 114.1 stb/acre-ft and 92 514 stb/km²·m.

### Geostatistics, compositions, geometry, clustering

| Tool | Method | Status | Validation |
|---|---|---|---|
| Variogram | Matheron estimator, Cressie–Hawkins estimator, weights N/γ² in the fit (Cressie 1985), spherical, exponential, Gaussian, cubic, pentaspherical, circular, linear, stable and power models, geometric anisotropy | classical (references to add) | experimental variogram and variogram map identical to numpy (10⁻¹¹); fits and the joint anisotropic fit identical to scipy |
| Ternary | Closure to 100 %, arithmetic mean and compositional centre (geometric mean, Aitchison) | classical (reference to add) | group means identical to numpy |
| Convex & concave hulls | Andrew monotone chain; alpha shape from a Bowyer–Watson Delaunay triangulation | classical (references to add) | convex hull (17 vertices, 3 948 796 m²) and alpha shape (494 of 581 triangles, 1 283 546 m²) identical to scipy |
| Clustering | k-means++, hierarchical (Lance–Williams, Ward), DBSCAN, Gaussian mixture by EM with BIC, silhouette, PCA | classical (references to add) | hierarchical, DBSCAN and mixture: adjusted Rand index 1.0 against scipy / scikit-learn; k-means reaches another local optimum (ARI 0.989); silhouette and PCA identical |

### Other tools

The methods of TR Cycles, the two digitizers, Map interpolation, Rock-Eval QC, Compaction fit, Biomarkers and Chromatogram are described in the help text of each page. Their source tables are still to be documented here.
