---
description: Romain Giboreau — petroleum systems analysis, basin modeling and applied AI for geoscience. Notes, talks, CV and tools.
hide:
  - navigation
  - toc
---

<div class="hero" markdown>

<svg class="hero-contours" viewBox="0 0 1000 420" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
<g class="contacts">
<path class="oil" d="M1001,120 L996,137 L982,152 L965,165 L946,176 L928,187 L911,197 L894,207 L874,215 L851,221 L827,224 L803,225 L780,225 L756,225 L731,227 L704,228 L675,227 L646,223 L622,213 L606,199 L599,182 L600,164 L606,147 L611,133 L613,120 L611,107 L608,93 L607,78 L610,62 L621,48 L637,36 L658,26 L680,18 L703,10 L727,4 L753,-1 L780,-3 L807,-1 L832,6 L852,17 L868,30 L882,42 L896,52 L913,60 L934,68 L958,77 L980,88 L995,103Z"/>
<path class="gas" d="M886,120 L890,129 L889,137 L883,145 L873,151 L861,156 L848,160 L837,164 L827,167 L816,171 L804,174 L792,175 L780,175 L768,174 L756,172 L744,171 L732,169 L718,167 L704,165 L691,160 L682,153 L677,145 L677,136 L682,128 L689,120 L695,113 L699,107 L701,101 L702,93 L704,86 L709,78 L717,72 L728,67 L740,64 L753,62 L767,60 L780,59 L794,59 L807,60 L820,63 L831,69 L838,75 L844,82 L848,89 L853,95 L859,101 L868,106 L878,112Z"/>
<path class="owc" pathLength="1" d="M1001,120 L996,137 L982,152 L965,165 L946,176 L928,187 L911,197 L894,207 L874,215 L851,221 L827,224 L803,225 L780,225 L756,225 L731,227 L704,228 L675,227 L646,223 L622,213 L606,199 L599,182 L600,164 L606,147 L611,133 L613,120 L611,107 L608,93 L607,78 L610,62 L621,48 L637,36 L658,26 L680,18 L703,10 L727,4 L753,-1 L780,-3 L807,-1 L832,6 L852,17 L868,30 L882,42 L896,52 L913,60 L934,68 L958,77 L980,88 L995,103Z"/>
<path class="goc" pathLength="1" d="M886,120 L890,129 L889,137 L883,145 L873,151 L861,156 L848,160 L837,164 L827,167 L816,171 L804,174 L792,175 L780,175 L768,174 L756,172 L744,171 L732,169 L718,167 L704,165 L691,160 L682,153 L677,145 L677,136 L682,128 L689,120 L695,113 L699,107 L701,101 L702,93 L704,86 L709,78 L717,72 L728,67 L740,64 L753,62 L767,60 L780,59 L794,59 L807,60 L820,63 L831,69 L838,75 L844,82 L848,89 L853,95 L859,101 L868,106 L878,112Z"/>
<text class="lbl-goc" x="806" y="192">GOC</text>
<text class="lbl-owc" x="690" y="246">OWC</text>
</g>
<g class="iso">
<path pathLength="1" style="--i:0" d="M831,120 L834,124 L836,129 L834,133 L830,137 L824,140 L817,142 L810,143 L804,145 L798,146 L792,147 L786,148 L780,149 L774,148 L768,147 L762,146 L756,145 L750,143 L743,142 L736,140 L730,137 L726,133 L724,129 L726,124 L729,120 L733,116 L737,113 L740,110 L742,107 L743,103 L745,99 L748,96 L753,93 L759,91 L766,89 L773,89 L780,89 L787,89 L794,89 L801,91 L807,93 L812,96 L815,99 L817,103 L818,107 L820,110 L823,113 L827,116Z"/>
<path pathLength="1" style="--i:1" d="M886,120 L890,129 L889,137 L883,145 L873,151 L861,156 L848,160 L837,164 L827,167 L816,171 L804,174 L792,175 L780,175 L768,174 L756,172 L744,171 L732,169 L718,167 L704,165 L691,160 L682,153 L677,145 L677,136 L682,128 L689,120 L695,113 L699,107 L701,101 L702,93 L704,86 L709,78 L717,72 L728,67 L740,64 L753,62 L767,60 L780,59 L794,59 L807,60 L820,63 L831,69 L838,75 L844,82 L848,89 L853,95 L859,101 L868,106 L878,112Z"/>
<path pathLength="1" style="--i:2" d="M944,120 L946,133 L939,145 L926,156 L910,164 L894,172 L879,178 L865,185 L850,191 L834,196 L816,200 L798,201 L780,200 L762,199 L745,198 L726,197 L705,196 L683,194 L663,189 L646,180 L637,169 L634,155 L638,142 L645,130 L652,120 L656,110 L656,101 L656,90 L657,78 L662,67 L672,57 L687,48 L704,42 L722,38 L741,34 L760,30 L780,28 L800,28 L820,32 L838,38 L851,47 L861,58 L870,67 L878,76 L890,83 L905,90 L921,98 L935,108Z"/>
<path pathLength="1" style="--i:3" d="M1001,120 L996,137 L982,152 L965,165 L946,176 L928,187 L911,197 L894,207 L874,215 L851,221 L827,224 L803,225 L780,225 L756,225 L731,227 L704,228 L675,227 L646,223 L622,213 L606,199 L599,182 L600,164 L606,147 L611,133 L613,120 L611,107 L608,93 L607,78 L610,62 L621,48 L637,36 L658,26 L680,18 L703,10 L727,4 L753,-1 L780,-3 L807,-1 L832,6 L852,17 L868,30 L882,42 L896,52 L913,60 L934,68 L958,77 L980,88 L995,103Z"/>
<path pathLength="1" style="--i:4" d="M1050,120 L1038,140 L1021,158 L1002,174 L983,189 L965,203 L945,217 L922,229 L896,238 L867,244 L838,247 L809,249 L780,252 L750,256 L716,260 L680,263 L643,260 L610,250 L586,234 L573,213 L570,191 L572,171 L574,152 L573,136 L567,120 L560,103 L554,84 L556,65 L565,47 L582,31 L604,16 L628,4 L655,-8 L682,-19 L713,-28 L746,-33 L780,-32 L813,-26 L841,-14 L864,0 L884,14 L904,25 L928,33 L956,41 L988,49 L1018,62 L1041,79 L1052,99Z"/>
<path pathLength="1" style="--i:5" d="M1091,120 L1076,143 L1058,164 L1041,184 L1023,203 L1003,221 L979,237 L949,250 L916,258 L882,264 L848,269 L815,275 L780,283 L741,292 L699,299 L654,299 L613,290 L580,273 L559,250 L549,224 L546,200 L543,178 L537,158 L526,140 L513,120 L503,99 L500,76 L507,53 L523,33 L545,14 L570,-4 L597,-20 L627,-36 L660,-50 L698,-59 L739,-62 L780,-57 L817,-45 L848,-30 L875,-15 L902,-4 L932,4 L968,10 L1008,17 L1046,30 L1077,48 L1096,70 L1100,95Z"/>
<path pathLength="1" style="--i:6" d="M1128,120 L1114,146 L1100,170 L1085,194 L1066,217 L1041,238 L1009,255 L972,267 L934,277 L896,285 L860,295 L822,308 L780,322 L732,334 L681,338 L631,332 L588,315 L558,290 L540,261 L529,233 L521,208 L508,186 L491,166 L471,144 L455,120 L447,94 L449,68 L463,43 L483,19 L507,-3 L533,-25 L562,-47 L597,-66 L639,-81 L686,-87 L734,-84 L780,-74 L820,-59 L855,-45 L888,-34 L925,-28 L968,-24 L1016,-19 L1063,-8 L1104,10 L1130,35 L1141,63 L1139,92Z"/>
<path pathLength="1" style="--i:7" d="M1166,120 L1157,149 L1146,178 L1130,205 L1106,231 L1073,252 L1034,269 L992,283 L952,296 L914,310 L875,329 L831,348 L780,366 L723,376 L665,373 L613,358 L572,332 L544,301 L524,270 L508,243 L488,219 L463,197 L436,174 L412,148 L398,120 L395,90 L404,61 L420,32 L440,5 L463,-23 L490,-50 L525,-76 L568,-96 L620,-107 L676,-108 L731,-100 L780,-86 L823,-73 L864,-64 L907,-60 L956,-59 L1011,-57 L1068,-49 L1117,-32 L1153,-7 L1173,24 L1178,57 L1174,89Z"/>
<path pathLength="1" style="--i:8" d="M1210,120 L1205,153 L1194,185 L1172,216 L1140,242 L1099,264 L1056,282 L1014,300 L976,320 L937,343 L894,370 L841,394 L780,410 L715,412 L653,399 L601,374 L561,343 L532,310 L506,281 L478,256 L445,234 L410,210 L378,183 L356,153 L346,120 L349,87 L360,54 L374,21 L392,-12 L414,-45 L445,-77 L489,-103 L544,-120 L607,-126 L670,-121 L729,-110 L780,-98 L827,-92 L876,-91 L931,-95 L993,-97 L1058,-93 L1117,-78 L1163,-53 L1193,-20 L1207,16 L1212,52 L1212,87Z"/>
<path pathLength="1" style="--i:9" d="M220,300 L219,304 L217,307 L214,310 L210,312 L207,315 L204,317 L200,319 L197,321 L193,322 L189,323 L184,323 L180,323 L176,323 L171,323 L166,323 L161,323 L156,322 L151,320 L148,317 L147,314 L147,310 L148,306 L149,303 L150,300 L150,297 L149,294 L149,291 L150,287 L151,284 L154,282 L158,279 L162,278 L166,276 L170,275 L175,274 L180,273 L185,273 L189,275 L193,277 L196,280 L199,283 L201,285 L204,287 L208,289 L212,291 L216,293 L219,296Z"/>
<path pathLength="1" style="--i:10" d="M266,300 L262,308 L257,315 L251,321 L245,327 L239,332 L233,338 L225,342 L217,346 L208,348 L198,349 L189,350 L180,351 L170,353 L160,354 L148,355 L136,354 L126,350 L118,344 L114,336 L113,328 L114,320 L114,313 L114,306 L112,300 L110,293 L108,286 L108,279 L111,272 L117,265 L124,260 L132,255 L140,250 L149,246 L159,243 L169,241 L180,241 L190,244 L199,248 L207,254 L213,259 L220,263 L227,266 L236,269 L246,273 L256,278 L263,284 L267,292Z"/>
<path pathLength="1" style="--i:11" d="M307,300 L301,311 L294,322 L287,332 L280,341 L272,350 L262,358 L249,365 L236,369 L222,372 L208,375 L194,378 L180,382 L164,387 L146,390 L128,390 L111,385 L98,376 L90,364 L86,352 L84,339 L83,329 L80,319 L75,310 L69,300 L65,289 L64,278 L67,267 L74,256 L83,247 L93,238 L105,230 L117,222 L131,215 L146,210 L163,209 L180,212 L195,218 L208,226 L219,233 L230,238 L243,241 L258,244 L275,248 L291,254 L303,264 L310,275 L311,288Z"/>
<path pathLength="1" style="--i:12" d="M345,300 L339,315 L333,329 L326,343 L317,356 L304,368 L289,378 L271,385 L253,390 L236,396 L219,403 L200,411 L180,420 L157,426 L132,428 L109,423 L89,412 L76,397 L67,380 L62,365 L57,351 L50,339 L40,327 L30,314 L23,300 L20,285 L22,270 L28,255 L38,241 L49,228 L61,215 L75,202 L92,191 L112,183 L135,181 L158,183 L180,190 L199,198 L215,205 L232,210 L250,213 L272,215 L295,218 L318,225 L336,236 L347,251 L351,267 L350,284Z"/>
<path pathLength="1" style="--i:13" d="M383,300 L379,319 L374,337 L365,355 L351,371 L333,384 L312,394 L291,403 L271,413 L252,424 L232,437 L208,451 L180,462 L149,466 L119,462 L93,450 L73,432 L59,413 L48,394 L38,378 L25,364 L10,350 L-5,335 L-17,319 L-23,300 L-23,281 L-18,262 L-10,244 L-0,226 L11,207 L25,189 L44,173 L68,162 L97,156 L126,157 L155,163 L180,172 L202,178 L224,182 L248,182 L276,181 L306,183 L335,189 L360,202 L376,219 L385,239 L387,260 L386,281Z"/>
</g>
<g class="wells">
<g transform="translate(780,118)"><g class="well" style="--d:3.4s"><circle r="5" class="full"/><line x1="7.0" y1="0.0" x2="11.0" y2="0.0"/><line x1="4.9" y1="4.9" x2="7.8" y2="7.8"/><line x1="0.0" y1="7.0" x2="0.0" y2="11.0"/><line x1="-4.9" y1="4.9" x2="-7.8" y2="7.8"/><line x1="-7.0" y1="0.0" x2="-11.0" y2="0.0"/><line x1="-4.9" y1="-4.9" x2="-7.8" y2="-7.8"/><line x1="-0.0" y1="-7.0" x2="-0.0" y2="-11.0"/><line x1="4.9" y1="-4.9" x2="7.8" y2="-7.8"/><text x="10" y="-9">W-1</text></g></g>
<g transform="translate(910,100)"><g class="well" style="--d:4.4s"><circle r="5" class="full"/><text x="10" y="-9">A-1</text></g></g>
<g transform="translate(862,236)"><g class="well" style="--d:5.0s"><circle r="5"/><line x1="-8" y1="-8" x2="8" y2="8"/><line x1="-8" y1="8" x2="8" y2="-8"/><text x="10" y="-9">A-2</text></g></g>
</g>
</svg>

<p class="hero-kicker">Petroleum systems · Basin modeling · Applied AI</p>

# Romain Giboreau

Lead Geoscientist at Beicip-Franlab. 15 years of petroleum systems assessment and basin modeling across 20+ basins on five continents, with a growing focus on applied AI/ML for geoscience workflows.

[CV](cv.md){ .md-button .md-button--primary } [Talks & publications](talks.md){ .md-button } [Notes](notes/index.md){ .md-button } [LinkedIn](https://www.linkedin.com/in/romain-giboreau){ .md-button }

</div>

!!! info "Upcoming talks — November 2026"
    **APGCE 2026, Kuala Lumpur — Monday 16 & Tuesday 17 November.**
    I'll be at the [Asia Petroleum Geoscience Conference & Exhibition](https://icep.com.my/apgce/conference/programme) both days. Come and say hello.

    *Closing the Exploration Gap: Probabilistic Petroleum Systems Analysis from Basin to Prospect* — Oral Session 9 (Basin Modelling and Reservoir Characterisation), Tuesday 17 November, 9:00–9:20, MR 302–303.

    **First EAGE Conference on Basin and Petroleum Systems Modeling, Houston — Wednesday 18 November.**

    *From Basin Modeling to Storage Fairway Mapping: AI-Assisted Smart Maps for Offshore Norway CCUS Screening* — Session VII (Basin modeling applications to the energy transition, Part I), 14:35–14:55. Presented by a colleague while I'm in Kuala Lumpur.

    [All talks & publications](talks.md)

## Tools

Personal side projects, built for fun. Free to use in the browser; your data stays on your computer.

<div class="grid cards" markdown>

-   :material-chart-scatter-plot: **Digitization**

    ---

    [Plot digitizer](digitizer/index.html) · [Map digitizer](mapdigitizer/index.html)

    Pull numbers back out of published plots and maps.

-   :material-map-outline: **Mapping & spatial statistics**

    ---

    [Map interpolation](gridding/index.html) · [Variogram](variogram/index.html) · [Convex & concave hulls](hull/index.html) · [Clustering](clustering/index.html)

    Gridding, spatial correlation and grouping of point data.

-   :material-flask-outline: **Organic geochemistry**

    ---

    [Rock-Eval QC](rockeval/index.html) · [Source rock potential](source/index.html) · [Thermal maturity](maturity/index.html) · [Biomarkers](biomarkers/index.html) · [Chromatogram](chromatogram/index.html) · [Ternary diagram](ternary/index.html)

    Screening and interpreting source rock and oil data.

-   :material-layers-triple-outline: **Basin modelling & petrophysics**

    ---

    [Compaction fit](compaction/index.html) · [BHT correction](bht/index.html) · [TR cycles](tr-cycles/index.html)

    Inputs for burial and thermal history models.

-   :material-scale-balance: **Decision support**

    ---

    [MCDA — AHP & PROMETHEE](mcda/index.html)

    Ranking options against several criteria. [Background note](notes/mcda_promethee_ahp.md).

-   :material-chess-knight: **Chess**

    ---

    [Chess training](chess/index.html)

    A side project: game analysis and training.

</div>

---

*These pages reflect my own understanding, built over time. Errors are mine — if you spot one, [I'd like to hear about it](contact.md).*
