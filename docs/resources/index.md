# Resources

Tools, libraries, references and sites used across this site — kept here rather than scattered per page.

---

## Tools

- [Ollama](https://ollama.com/) — local LLM runtime
- [BasinVis](https://github.com/jonovotny/BasinVis) — MATLAB · stratigraphic & subsidence modelling
- [Badlands](https://github.com/badlands-model/badlands) — landscape evolution model · sediment transport · basin formation
- [Paleolatitude.org](https://paleolatitude.org/) — paleolatitude calculator · plate tectonic reconstruction
- [GPlates](https://www.gplates.org/) — plate tectonic reconstruction · GIS visualisation · open-source
- [GMG](https://btozer.github.io/gmg/html/gmg_documentation.html) — 2D gravity & magnetic modelling GUI · open-source Python
- [PyGMI](https://github.com/Patrick-Cole/pygmi) — potential field modelling & interpretation (gravity, magnetic, remote sensing) · open-source Python
- [Open Geoscience Repository (yohanesnuwara)](https://github.com/yohanesnuwara/open-geoscience-repository) — notebooks d'accès aux bases géoscience ouvertes (Google Drive, SEG Wiki, US DoE Geothermal)
- [GSQ Open Data API (Queensland)](https://github.com/geological-survey-of-queensland/open-data-api) — Queensland, Australia · API CKAN · 20 000+ rapports & datasets publics
- [QGIS MCP](https://github.com/nkarasiak/qgis-mcp) — connecteur MCP entre QGIS et agents IA (Claude, etc.) — gestion de couches, édition, traitements
- [SeismicFlow](https://seismicflow.github.io/) — GUI Python open-source, workflows géoscience intégrés · gratuit, Windows uniquement, papier *Geophysics* annoncé "in press" (non vérifié)
- [Danomics](https://www.danomics.com/) — plateforme SaaS commerciale (Devon, TGS, Coterra, OXY, Hilcorp) · framework structural/stratigraphique, pétrophysique, modèles 3D à l'échelle de milliers de puits
- [Scrapling](https://github.com/d4vinci/Scrapling) — framework de web scraping adaptatif, contournement anti-bot (Cloudflare), MCP server inclus · 77k stars · usage prévu : automatiser la récolte des pages presse NOC/IOC et portails de données publiques listés sur ce site
- [FracSTAT](https://sachi5908.github.io/FracSTAT_Presentation/#home) — analyse de réseaux de fractures/failles : géométrie, réponse mécanique (slip tendency, Mohr/stéréonet), incertitude (MCS/LHS, SRC/PRCC) · plateforme académique (WIHG-Dehradun, Univ. Palerme, CSIR-NGRI)

---

## Libraries

- [NumPy](https://numpy.org/) — numerical computing
- [pandas](https://pandas.pydata.org/) — data analysis
- [Polars](https://pola.rs/) — data analysis · fast dataframes
- [Dash](https://dash.plotly.com/) — dashboards · data viz
- [GeoPandas](https://geopandas.org/) — geospatial data analysis
- [pyDecision](https://github.com/Valdecy/pyDecision) — multi-criteria decision analysis (AHP, PROMETHEE)
- [PyKrige](https://github.com/GeoStat-Framework/PyKrige) — kriging · geostatistics
- [SciPy](https://scipy.org/) — scientific computing
- [GeoPolars](https://github.com/pola-rs/geopolars) — geospatial extension for Polars · prototype, not production-ready
- [PyGWalker](https://github.com/Kanaries/pygwalker) — exploration visuelle de dataframes pandas/polars (Tableau-style, Jupyter)
- [SDIP](https://github.com/zahidaramai/sdip) — convertisseur SEG-Y → MDIO/Zarr v3 avec certificat d'équivalence vérifiable · projet jeune, 1 star

---

## Papers / Books

*Livres et articles fondamentaux du domaine (Tissot & Welte, Allen & Allen, Wangen, Peters/Walters/Moldowan) sont couverts en version annotée et vérifiée dans la [bibliographie](bibliography/petroleum-systems-basin-modeling.md) — pas dupliqués ici.*

- [Global Crustal Thickness and Velocity Structure From Geostatistical Analysis of Seismic Data (Szwillus et al., 2019)](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2018JB016593) — Global · geostatistics · kriging · crustal structure
- [New Insights Into the Crust and Lithospheric Mantle Structure of Africa (Globig et al., 2016)](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1002/2016JB012972) — Africa · crustal & lithospheric structure · thermal modeling
- [Petroleum Geochemistry (Mei & Katz, 2022)](https://www.intechopen.com/chapters/81757) — Global · source rocks, generation, migration · open access
- [Global Chemical Kinetics of Fossil Fuels (Burnham, 2017)](https://link.springer.com/book/10.1007/978-3-319-49634-4) — Global · kerogen kinetics · maturation & pyrolysis
- [Structural Geology (Fossen, 2016)](https://www.cambridge.org/9781107057647) — Global · structural geology · petroleum & groundwater applications
- [The Nature of the Lithosphere-Asthenosphere Boundary (Rychert et al., 2020)](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2018JB016463) — Global · lithosphere-asthenosphere boundary · review
- [A Fully Integrated and Updated Geothermal Gradient Atlas of the World (Nash, Friend & Brommer, 2022)](https://www.researchgate.net/publication/355506471_A_Fully_Integrated_And_Updated_Geothermal_Gradient_Atlas_Of_The_World) — Global · Global Heat Flow Database · geothermal gradient
- [Graph Neural Networks for an Accurate and Interpretable Prediction of the Properties of Polycrystalline Materials (Dai et al., 2021, npj Computational Materials)](https://www.nature.com/articles/s41524-021-00574-w) — GNN · materials science · pertinent §9
- [A Gentle Introduction to Graph Neural Networks (Distill, 2021)](https://distill.pub/2021/gnn-intro/) — GNN · pédagogique · pertinent §9

---

## News & Blogs

- [GeoExpro](https://geoexpro.com/) — Global · subsurface geoscience magazine · industry news
- [Oil & Gas Journal](https://www.ogj.com/) — Global · upstream/midstream/downstream industry news
- [World Oil](https://www.worldoil.com/news) — Global · upstream industry news
- [Rigzone](https://www.rigzone.com/news/) — Global · oil & gas industry news
- [OilPrice — World News](https://oilprice.com/Latest-Energy-News/World-News/) — Global · energy market news
- [Upstream Online](https://www.upstreamonline.com/) — Global · upstream oil & gas news (Oslo, since 1996)

*Official [company press releases](company-announcements.md) — exploration & discovery announcements — are tracked on a dedicated page.*
- [Petroleum & Energy Insights](https://www.petroleumenergyinsights.com) — Guyana-Suriname Basin, Caribbean · petroleum systems analysis blog
- [The Petroleum System Blog](https://petroleumsystem.blogspot.com/) — Global · petroleum systems, migration & seal analysis blog
- [lhjelm-dk — Streamlit apps](https://share.streamlit.io/user/lhjelm-dk) — personal projects · to watch
- [EarthScan — Insights](https://www.earthscan.io/v2/insights/the-overburden-is-the-asset-aramco-subsurface-stack-transition-zone) — blog technique vendeur (IA pour l'énergie) · analyse critique de la JV Aramco-Ma'aden (transfert de corpus sismique pétrole → minéraux)
- [Seismic Data Storage 101 (Medium, The Shadow Observer, 2026)](https://medium.com/@TheShadowObserver/seismic-data-storage-101-formats-compression-and-archival-strategy-63d6f873a7a9) — SEG-Y, OpenVDS, MDIO, OSDU · bien référencé, auteur généraliste IA/business (pas domain expert)

---

## Public Data & Atlases

- [Africa Geological Atlas](https://www.africageologicalatlas.com/) — Africa · paleotectonics · paleogeography
- [GEBCO Gridded Bathymetry Data](https://www.gebco.net/data-products/gridded-bathymetry-data) — Global · bathymetry · public dataset
- [Nova Scotia Offshore Oil and Gas Geoscience Research](https://novascotia.ca/offshore-oil-and-gas-geoscience-research/) — Nova Scotia, Canada · petroleum systems · play fairway analysis
- [CNSOER — Geoscience and Data](https://cnsoer.ca/oil-gas-energy/petroleum-related-call-for-bids/geoscience-and-data) — Nova Scotia, Canada · regulator · public reports & well/seismic data
- [OilCo NL — Exploration Reports](https://oilconl.com/overview/) — Newfoundland and Labrador, Canada · exploration reports
- [Staatsolie GeoAtlas of Suriname](https://www.staatsolie.com/en/shi/geoatlas/) — Suriname, Guiana Basin · petroleum systems · stratigraphy
- [ANCAP — Offshore Uruguay: Geology and Prospectivity (2020)](https://exploracionyproduccion.ancap.com.uy/innovaportal/file/8495/1/offshore-geology-rua-2020.pdf) — Uruguay (Punta del Este, Pelotas basins) · petroleum systems · public atlas
- [ANCAP — Onshore Uruguay: Geology and Prospectivity (2021)](https://www.ancap.com.uy/innovaportal/file/8544/1/_onshore-geology-rua-2021.pdf) — Uruguay · petroleum systems · public atlas
- [GNS Science — Atlas of Petroleum Prospectivity](https://www.gns.cri.nz/data-and-resources/atlas-of-petroleum-prospectivity/) — New Zealand · petroleum systems · basin-by-basin GIS atlas
- [ONHYM — Hydrocarbon Exploration Opportunities, Atlantic Offshore](https://hydrocarbons.onhym.com/sites/all/themes/hydrocarbure/images/pdf_offshore/Hydrocarbon%20Exploration%20Opportunities_Atlantic%20Offshore_2023.pdf) — Morocco · petroleum systems · play types
- [ONHYM — Hydrocarbon Exploration Opportunities, Mediterranean](https://hydrocarbons.onhym.com/sites/all/themes/hydrocarbure/images/pdf_offshore/Hydrocarbon%20Exploration%20Opportunities_Mediterranean.pdf) — Morocco (Mediterranean margin) · petroleum systems · public atlas
- [ONHYM — Hydrocarbon Exploration Opportunities, Onshore (2023)](https://hydrocarbons.onhym.com/sites/all/themes/hydrocarbure/images/pdf_onshore/Hydrocarbon%20Exploration%20Opportunities_Onshore_2023.pdf) — Morocco · petroleum systems · public atlas
- [ANH — Geological and Geophysical Information](https://www.anh.gov.co/en/hidrocarburos/informacion-geologica-y-geofisica/) — Colombia (23 cuencas) · petroleum systems · public studies & maps
- [PAD/Ireland — Standard Stratigraphic Nomenclature of Offshore Ireland Atlas (2020)](http://spatial.dcenr.gov.ie/PAD_DOWNLOAD/PAD_1-21/1-21_Summary%20Report_2020.pdf) — Ireland (Atlantic margin) · stratigraphy · basin atlas
- [Geoscience Australia — Petroleum Geology of Offshore Basins](https://www.ga.gov.au/scientific-topics/energy/province-sedimentary-basin-geology/petroleum) — Australia · petroleum systems · basin-by-basin overviews
- [NAMCOR — GIS Portal](https://gisportal.namcor.com.na/viewer/) — Namibia (Orange, Lüderitz, Walvis basins) · blocks, wells, seismic · interactive
- [ALNAFT](https://www.alnaft.dz/) — Algeria · national hydrocarbon data bank · regulatory
- [Seismic Atlas of SE Asian Basins](https://geoseismic-seasia.blogspot.com/p/home.html) — Southeast Asia · seismic interpretation · regional geology
- [Lithosphere.info](https://www.lithosphere.info/) — Global · lithosphere & crustal structure · basin subsidence
- [Sodir CO2 Atlases](https://www.sodir.no/en/whats-new/publications/co2-atlases/) — Norway (North Sea, Norwegian Sea, Barents Sea) · CCS · storage capacity
- [Norwegianpetroleum.no — Facts](https://www.norskpetroleum.no/en/facts/) — Norway · fields, reserves, licences · official statistics
- [Sodir — What's New / Publications](https://www.sodir.no/en/whats-new/) — Norway · reports, NPD bulletins, scientific articles
- [NLOG — Dutch Subsurface Portal](https://www.nlog.nl/en/data) — Netherlands · wells, seismic, production data · public dataset
- [South Australia Energy & Mining Data Centre](https://www.energymining.sa.gov.au/industry/energy-resources/data-centre) — South Australia · wells, seismic, basin data (Cooper, Otway)
- [U.S. Energy Information Administration (EIA)](https://www.eia.gov/) — United States · energy statistics, open data API
- [USGS Science Data Catalog](https://data.usgs.gov/datacatalog/) — United States · earth science data catalog · public dataset
- [s-Ink — Lithosphere Thickness Map](https://s-ink.org/lithosphere-thickness-map) — Global · lithosphere thickness · accessible science graphics
- [s-Ink — Sediment Thickness (GlobSed)](https://s-ink.org/sediment-thickness) — Global oceans · sediment thickness
- [IRIS EMC — CRUST1.0](https://ds.iris.edu/ds/products/emc-crust10/) — Global · crustal model, 1°×1° grid
- [HyDRA — Database of Geological Properties for EU Porous Reservoir Gas Storage Sites](https://zenodo.org/records/17787644) — Europe · 134 sites · underground hydrogen storage geological database (depth, lithology, porosity, permeability) · pertinent corpus H₂ bibliographie

---

## Reference

- [EarthByte Resources](https://www.earthbyte.org/category/resources/) — Global · plate tectonics · geodynamics · open-source geoscience software hub
- [AAPG Wiki](https://wiki.aapg.org/Main_Page) — Global · petroleum geoscience reference
- [SEG Wiki](https://wiki.seg.org/wiki/Main_Page) — Global · geophysics reference
- [dGB Earth Sciences — Library](https://dgbes.com/library/) — Global · OpendTect documentation, ML in seismic interpretation, tutorials

---

*PPP references handled separately.*
