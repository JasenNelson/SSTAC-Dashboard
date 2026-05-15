Source: https://docs.google.com/document/d/1TGWhTL_lAWDMPjMpMOl6zaArnHh8FFPhgDWtdPjh5o0/export?format=txt

---

﻿Algorithmic Methodologies and Algebraic Derivations for Benthic Sediment Quality Standards: A Cross-Jurisdictional Analysis
1. United States Environmental Protection Agency (US EPA) Derivation Frameworks
The United States Environmental Protection Agency (US EPA) derives Equilibrium Partitioning Sediment Benchmarks (ESBs) utilizing rigid mechanistic models that quantify the thermodynamic partitioning of toxicants across the solid sediment phase, the interstitial (pore) water phase, and the lipid membranes of benthic organisms. The mathematical architecture is strictly bifurcated into Tier 1 and Tier 2 criteria, differentiated entirely by the empirical robustness of the algebraic input parameters.1
1.1 Equilibrium Partitioning (EqP) Algorithms for Non-Ionic Organics
The EqP methodology operates on the fundamental thermodynamic assumption that non-ionic organic contaminants partition predictably and reversibly between sediment organic carbon, interstitial water, and biological lipids.4 Because the biological response of benthic organisms is highly correlated with the interstitial water concentration (  )—which represents the freely dissolved, uncomplexed, and bioavailable phase—the sediment standards are algebraically derived from water-only toxicity benchmarks.3
The foundational algebraic relationship governing this phase distribution is defined by the organic carbon-water partition coefficient (  ):


Where:
*    represents the partition coefficient, expressed in liters per kilogram of organic carbon (  ).4
*    designates the organic carbon-normalized sediment concentration, expressed in micrograms per kilogram of organic carbon (  ).6
*    represents the dissolved interstitial water concentration, standardized in milligrams per liter (  ).6
To operationalize this thermodynamic ratio for regulatory benchmark derivation, the US EPA mathematically forces the interstitial water concentration to equal an independently derived water-only effects concentration, specifically the Final Chronic Value (  ).6 The equation is algebraically rearranged and scalar conversions are applied to map the dimensional output to micrograms per gram of organic carbon (  ):


When isolating the specific benchmark limits for polycyclic aromatic hydrocarbons (PAHs), the algebraic derivation for a specific chemical (  ) is expressed directly as 4:


In this formulation,    strictly denotes the critical sediment concentration limit for an individual non-ionic organic compound.4
The    variable is highly sensitive to the specific chemical's hydrophobicity. Under US EPA Tier 1 protocols, this parameter must be mathematically derived from a highly rigorous octanol-water partition coefficient (  ).1 Di Toro's universal log-linear regression algebraically links    to    for non-ionic organics 4:


To maintain an internally consistent scale for PAH toxicity, the US EPA applies a universal slope of    to the toxicity/   relationship, which normalizes PAH-Specific Species Mean Acute Values (SMAVs) measured in    to calculate the SMAV at a    of    (expressed in    octanol).4
1.2 Default Organic Carbon (OC) Normalization Parameters for EqP
The US EPA EqP derivations absolutely reject the use of a static, universal default OC percentage (such as a hardcoded    or    baseline) across assessments. The algebraic framework dictates that measured, site-specific fractional organic carbon (  ) must be applied to determine total benchmark limits.6 The calculation of the total benchmark in bulk dry-weight terms is determined by multiplying the carbon-normalized benchmark by the site's   .3
However, the foundational mathematics of EqP theory possess strict boundary limits. The algorithms are strictly valid and applicable only to sediments exhibiting an organic carbon content of    by dry weight (  ).3 Below this critical    threshold, second-order physical parameters—such as particle size distribution, uncharacterized inorganic sorption, and fine-grain boundary friction—introduce unacceptable mathematical divergence, invalidating the linear partitioning assumptions required by the EqP thermodynamic mechanism.3
1.3 Toxic Unit (TU) Summation for Organic Mixtures

Because PAHs and analogous non-ionic organics operate jointly under a common narcosis mode of action, their cumulative biological effects are mathematically additive.4 The US EPA models this mixture toxicity via the Equilibrium Partitioning Sediment Benchmark Toxic Unit (  ) algorithm.4


This algorithm sums the quotients of the measured organic carbon-normalized concentration of individual PAHs divided by their respective organic carbon-normalized benchmarks.4 A specific sediment environment exhibits protective conditions for benthic aquatic life when the sum is   .4 The resolution of this algorithm requires evaluating a minimum of 34 specific target PAHs to satisfy Tier 1 accuracy requirements.4 If the summation yields a value   , the combined narcosis threshold is breached, and sensitive benthic organisms may be unacceptably affected.4
1.4 Acid Volatile Sulfide / Simultaneously Extracted Metals (AVS/SEM) Algorithms
For metallic contaminants residing in anoxic sediment regimes, phase distribution is not controlled by organic carbon partitioning. Instead, it is fundamentally controlled by the stoichiometric precipitation of insoluble metal sulfides, primarily reacting with Acid Volatile Sulfide (AVS).9 The analytical architecture isolates bivalent metals (and specific monovalent transition metals) extracted simultaneously during cold hydrochloric acid digestion to quantify the bioavailable metallic pool, termed Simultaneously Extracted Metals (SEM).9
The total competitive binding potential of the metallic pool is represented by the algebraic sum of the individual molar concentrations of the constituent metals 1:


The stoichiometric coefficient applied to silver (  ) represents a critical mathematical adjustment. Silver operates as a monovalent cation (  ) in these anoxic environments, whereas cadmium, copper, lead, nickel, and zinc act as bivalent cations (  ). Because the precipitation of silver sulfide requires exactly two moles of silver per mole of available sulfide to form   , one mole of silver consumes exactly    moles of the available AVS pool.1 Thus, the US EPA strictly enforces the    scalar multiplier for $$ to maintain molar valency parity across the summation.1 To facilitate these equations, raw gravimetric concentrations (  ) must be converted to molar concentrations (  ) by dividing by the atomic weight of the respective metal.15
1.4.1 AVS/SEM Normalization Architectures
To parameterize the biological risk of these metal mixtures, the mathematical relationship between    and    is modeled using three progressive algebraic architectures, each addressing the limitations of the previous 14:
1. The Molar Ratio Model:


If the quotient   , the available extractable metals are theoretically locked within solid sulfide matrices and are completely biologically unavailable.9 If the ratio exceeds   , the sulfide pool is exhausted, forcing metals into the bioavailable interstitial pore water.9 However, this fractional ratio suffers from mathematical instability when the denominator (  ) approaches absolute zero, yielding asymptotes that wildly misrepresent the actual absolute metallic loading and masking the true magnitude of the exceedance.1
2. The Molar Difference Model:


To rectify the quotient instability inherent in the ratio model, the absolute difference isolates the precise excess micromoles of metals not bound to sulfide per gram of sediment.1 If   , the binding capacity is sufficient, and no uncomplexed metals exist.1 The difference model is particularly informative in environments with extremely low AVS concentrations, where the ratio model would falsely indicate high relative risk despite numerically negligible total metal concentrations.1
3. The Organic Carbon-Normalized Difference Model: Because excess metals (those existing in the domain where   ) sequentially partition out of the exhausted sulfide matrix and into the secondary organic carbon binding phase, the final and most robust US EPA algebraic derivation normalizes the absolute molar difference against the fractional organic carbon (  ) parameter 1:


This normalization step drastically narrows the uncertainty bounds associated with predicting toxicity.1 The mathematical output of this equation establishes two absolute threshold limits utilized by the US EPA for site assessment 1:
   *   : This boundary is highly predictive of non-toxic regimes, indicating low risk of adverse biological effects from metals.

*   : This boundary is highly predictive of acute biological toxicity, indicating an extreme hazard.
   * Mathematical values intersecting the intermediate domain between    and    denote a transitional uncertainty band demanding secondary biological toxicity testing, as exact bioavailability within this phase space relies on undefined tertiary binding mechanisms.1
Notably, the US EPA notes a specific mathematical failure within this normalization step: organic carbon normalization appears ineffective for silver. Empirical spiked-sediment data suggests that because sulfur groups dominate silver complexation chemistry so completely, secondary partitioning into organic carbon does not reliably occur, collapsing the normalization efficacy for highly silver-contaminated matrices.1
1.5 Tier 1 vs Tier 2 Methodological Distinctions
The US EPA enforces strict mathematical and empirical data requirements differentiating Tier 1 and Tier 2 criteria.1


Requirement
	Tier 1 Parameters
	Tier 2 Parameters

 Derivation
	Demands highly precise, empirically measured    metrics derived exclusively from physical slow-stir, generator column, or shake flask empirical studies.1
	Tolerates higher statistical uncertainty, permitting the use of algorithmically generated    metrics (e.g., SPARC modeled parameters or Quantitative Structure-Activity Relationships).2
	Water-Only Effects
	Requires strict Final Chronic Values (FCVs) stemming from comprehensive, multi-taxa empirical aquatic toxicity matrices meeting explicit national data quality guidelines.1
	Permits the use of mathematically estimated Secondary Chronic Values (SCVs) derived via narcosis theory, AQUIRE database extraction, or incomplete acute-to-chronic ratio conversions.2
	EqP Confirmation
	Mandatory confirmatory sediment toxicity tests to validate the theoretical partitioning algorithms.2
	EqP confirmation tests are recommended but mathematically not required for the development of the benchmark.2
	Chemical Scope
	Applied to specific PAH mixtures, complex metal mixtures (Cd, Cu, Pb, Ni, Ag, Zn), and heavily studied insecticides like endrin and dieldrin.2
	Applied to a broader compendium of 32 non-ionic organics where data density cannot satisfy the rigid statistical demands of Tier 1 processing.3
	The lesser requirements of Tier 2 introduce greater mathematical uncertainty into the EqP prediction of the sediment effect concentration, forcing regulators to rely on larger safety margins or supplementary weight-of-evidence testing.2
2. Canadian Council of Ministers of the Environment (CCME) Protocols
Unlike the mechanistic, thermodynamic phase-partitioning approach engineered by the US EPA, the Canadian Council of Ministers of the Environment (CCME) fundamentally relies on an empirical, statistical derivation framework known as the National Status and Trends Program (NSTP) modified approach.11 The methodology isolates specific co-occurrence statistical percentiles from the highly comprehensive Biological Effects Database for Sediments (BEDS) to plot concentration-response relationships.11
2.1 Derivation of ISQG (TEL) and PEL Parameters
The CCME algorithms establish three discrete ranges of chemical concentrations—rarely, occasionally, and frequently associated with adverse biological effects.11 These boundaries are dictated by two exact mathematical derivations: the Threshold Effect Level (TEL), which functions as the formal Interim Sediment Quality Guideline (ISQG), and the Probable Effect Level (PEL).22
The empirical data distributions from BEDS are mathematically parsed into two distinct, intersecting data subsets 20:
      1. The "Effect" Data Set: A distribution of concentrations where adverse biological responses (e.g., reduced survival, impaired growth) were explicitly observed.
      2. The "No-Effect" Data Set: A distribution of concentrations exhibiting baseline survival and growth, effectively representing the null hypothesis matrix.
The CCME equations calculate the geometric mean of highly specific percentiles drawn from these divergent sets to systematically buffer outlier skewness and log-normal variance characteristics inherently common in massive benthic field arrays.20
Threshold Effect Level (TEL / ISQG): The TEL bounds the upper limit of the no-effect domain. It is algebraically defined as the geometric mean of the 15th percentile of the effect data set (  ) and the 50th percentile (median) of the no-effect data set (  ) 23:

When evaluating highly skewed datasets, this derivation is often expressed logarithmically to emphasize the exponential distance minimization achieved by the geometric mean, which pulls the threshold toward the center of gravity of the combined distributions 25:


By intersecting the extreme lower tail of the deleterious matrix (  ) with the median tendency of the benign matrix (  ), the algorithm isolates the concentration below which adverse biological effects are expected to occur rarely.20
Probable Effect Level (PEL): The PEL mathematically defines the lower limit of the probable effect domain, representing the threshold above which toxicity is frequently observed.20 It is derived via the geometric mean of the 50th percentile (median) of the effect data set (  ) and the 85th percentile of the no-effect data set (  ) 23:










The intermediate zone between the TEL and the PEL represents the occasional effect range. Within this boundary, adverse biological effects are possible, but the severity and magnitude of potential effects become exceedingly difficult to gauge purely mathematically, demanding weight-of-evidence site investigations.20
2.2 Trace Element Adjustments and Organic Carbon Defaults
The CCME formally prohibits the blanket application of global OC normalization to all sediment types. Due to the high uncertainty in generic phase-partitioning modeling across diverse Canadian geologies, the CCME dictates that criteria typically remain reported on a bulk dry-weight basis.21 However, for specific persistent, bioaccumulative, and non-polar toxic organic substances (e.g., Polychlorinated biphenyls, specific PAHs, and Dioxins) derived under equivalent equilibrium partitioning frameworks, the CCME establishes a baseline mathematical default mapping to exactly    Total Organic Carbon (TOC).28 This allows the values to be uniformly tabulated while representing the standard baseline of organic matter.28
When evaluating trace element toxicity within exceptionally high organic carbon environments (where TOC   ), the CCME abandons strict bulk metrics and integrates an algebraic scaling adjustment. This algorithm compensates for the elevated binding affinity of the natural organic matrix, which significantly limits heavy metal bioavailability.20 The normalized trace element concentration (  ) is formulated as 20:


Where:
      *    denotes the intercept of the regression curve modeling the metal's background state.
      *    represents the elemental scaling slope against lithium (  ), which the CCME utilizes as a highly stable, conservative crustal reference tracer that does not participate in biological uptake or toxicological complexation.20
      *    designates the localized fractional deviation attributed strictly to the excessive organic fraction above the    threshold.20
2.3 AVS/SEM Integration Constraints
While the CCME recognizes AVS/SEM phase modeling for evaluating anoxic site-specific toxicity potentials, these parameters strictly act as secondary interpretive modifiers rather than primary threshold derivations.11 The CCME framework severely limits application to the baseline ratio inequality:
         * If   , the mathematical model predicts that metals will not be bioavailable due to complexation with the available reactive pool of solid-phase sulphide.11
         * If   , the model predicts a high potential for bioavailability, but the CCME formally acknowledges extreme limitations in this assumption, noting it mathematically ignores tertiary binding phases (such as iron and manganese oxides) that also heavily limit heavy metal mobility.11
Consequently, the absolute molar difference algorithms (  ) and the complex organic carbon-normalization steps enforced by the US EPA are not systematically standardized into explicit national tier frameworks under the CCME protocol.11
3. Australian and New Zealand Guidelines (ANZG)
The Australian and New Zealand Guidelines for Fresh and Marine Water Quality (ANZG) utilize a hybrid methodological system that bridges North American empirical distribution analyses with strict regional organic carbon algorithms.7 Originally constrained by an absence of high-resolution regional whole-sediment chronic toxicity species sensitivity distributions (SSDs), the ANZG architecture mathematically ranks biological-effects databases.29
3.1 DGV and GV-high Percentile Methodologies

The ANZG establishes two primary tiered metrics through direct percentile extraction from the Long et al. (1995) and MacDonald et al. (2000) combined empirical distributions 7:
            1. Default Guideline Value (DGV): Mathematically derived as the exact 10th percentile of the biological-effects data distribution (an adaptation of the Effects Range Low, ERL, or TEL).7 The DGV functions as the foundational protective standard; concentrations trending below this bound rarely exhibit effects on sediment biota.7
            2. Upper Guideline Value (GV-high): Computed exclusively as the 50th percentile (median) of the biological-effects distribution (an adaptation of the Effects Range Median, ERM, or PEL).7 This bound establishes the domain where toxicity-related adverse effects are frequently observed.7
In systems where specific DGVs are unlisted, or where localized background matrices naturally exceed the established DGV baselines, the ANZG implements a regional scalar derivation. This mechanism generates a site-specific numerical guideline by mapping the 80th percentile of geographically relevant, unimpacted reference site data.7 The use of the 80th percentile allows for a conservative margin of natural variability while strictly preventing anthropogenic loading from skewing the baseline.31
3.2 Explicit Organic Carbon Normalization Parameters
Unlike the US EPA's fluid    insertion or the CCME's primary reliance on bulk dry-weight constants, the ANZG mathematically mandates strict normalization procedures for all Hydrophobic Organic Contaminants (HOCs) utilizing a definitive    OC default benchmark.7
The ANZG algebraic adjustment forces the measured HOC field concentration to a mathematical equivalent at    OC using inverse proportionality 7:


For example, if a sediment matrix contains    of total PAHs and exhibits a    organic carbon load, the normalized concentration is algebraically derived as    of total PAHs mapped to the    OC baseline.7
Normalization Boundary Constraints: Crucially, the ANZG strictly limits the mathematical validity of this extrapolation formula to environments possessing an organic carbon mass fraction precisely between    and    by dry weight.7
            * If the physical sediment parameter exhibits   , the denominator in the equation is locked at the absolute lower boundary of   .7 This prevents asymptotic mathematical explosion of the normalized value, as second-order physical effects (like particle size and grain boundary friction) completely overwhelm carbon partitioning at highly depleted carbon levels.7
            * If the physical sediment parameter exhibits   , the denominator is aggressively truncated at   .7 Above this threshold, the linear partition assumptions diverge in extreme-carbon phase matrices (e.g., heavily decaying peat environments), invalidating the EqP assumptions.7
(Note: ANZG strictly limits this specific normalization protocol to organic toxicants. Metals, such as copper, are assessed strictly on non-normalized bulk frameworks because    OC mapping fundamentally under-predicts the protective capacity of existing baseline DGVs for inorganics 7).
3.3 AVS-SEM Algorithmic Variances
When evaluating site-specific bioavailability of metals, the ANZG framework deploys the AVS-SEM normalization model but introduces significant molar scaling discrepancies compared to the US EPA methodology.13
The summation of simultaneously extracted bivalent metals mirrors standard US protocols; however, regional literature and technical derivations applied in these jurisdictional assessments introduce a profound valency-multiplier anomaly for silver. Instead of the US EPA's    scalar, specific applications define the molar ratio as 13:


The substitution of    radically alters the mass balance equation. It attempts to account for the physical stoichiometry where silver strongly bonds twice to available sulfide.13 Furthermore, excess metal calculations track closely with EPA metrics by utilizing both the absolute difference (  ) and the organic carbon-normalized parameter    augmented by a standard intercept of    to define the boundaries of potential toxicity.18
4. Netherlands RIVM Environmental Risk Limits (ERLs)

The Dutch National Institute for Public Health and the Environment (RIVM) engineers a profoundly interconnected set of algorithmic Environmental Risk Limits (ERLs) that span multiple environmental compartments simultaneously. RIVM operates primarily to derive the Maximum Permissible Concentration (  ) and the Negligible Concentration (  ).33 The formula linking these limits is purely statistical:


The application of the explicit divisor of 100 buffers against unpredictable combination toxicity mechanisms and unquantified mixture synergies.33
4.1 Compartment-Specific Equilibrium Partitioning
If extensive experimental benthic ecotoxicity matrices are absent, RIVM mathematically translates aquatic ecosystem benchmarks into sediment metrics using highly advanced multi-compartment EqP functions.33
The baseline partition coefficient for the sediment or suspended matter compartment (  ) is isolated first through multiplication:


Where    defines the precise fraction of organic carbon assigned to the physical phase, and    is the established carbon-water partition coefficient.35
RIVM calculates the wet-weight benchmark mapping (  ) utilizing bulk density constants and the equilibrium aquatic standard (  ) derived for fresh water 35:


Where    represents the total volumetric partition coefficient across boundaries (combining solids, interstitial water, and air voids),    defines the structural bulk density of the suspended compartment (   default), and the    multiplier converts cubic meters to liters.35
Because bulk wet-weight concentrations fail to account for variable hydration states in field sediments, the ultimate standard must be transformed into a functional dry-weight variable (  ) via matrix conversion factoring the solid fractional density (  ) and total solid phase mass density (  ) 35:


4.2 The Biomagnification Ingestion Scalar
RIVM engineers a critical boundary algorithm not globally replicated by the US EPA, CCME, or ANZG. The foundational EqP thermodynamic model strictly assumes biological uptake proceeds exclusively via osmotic transfer from the dissolved interstitial water phase across the respiratory membranes.35 However, highly lipophilic compounds transcend this constraint via extensive bio-ingestion and direct sediment grazing pathways.
Consequently, if the un-adjusted hydrophobicity parameter indicates   , RIVM applies a fixed divisor scalar to mathematically override EqP limits, heavily penalizing the benchmark 35:


This applied assessment factor of    rigorously compensates for secondary trophic biomagnification and dietary accumulation that is fundamentally ignored by pure phase-transfer physics.35 Without this penalty divisor, the EqP calculation would yield an unsafe, artificially high permissible concentration for extreme-hydrophobicity toxicants.35
4.3 Default Dutch Standard Sediment Normalizations
Unlike the ANZG    OC variable threshold (which truncates at field extremes) or the US EPA's purely site-specific continuous models, RIVM enforces rigid static baseline characteristics specifically calibrated to "Dutch standard sediment" to facilitate uniform regulatory derivation across all national zones.
RIVM standard compartmental parameters are explicitly hardcoded as 33:
               * Organic Matter (  ) =   
               * Organic Carbon (  ) =   
               * Clay (lutum) =   
The conversion algebra mathematically locking organic matter to organic carbon fractions dictates the ratio 33:


Because broader European Union guidelines (such as REACH and Water Framework Directive parameters) frequently model suspended sediment defaults at    organic carbon, RIVM introduces an automated scalar multiplier to mathematically translate overarching EU standards back into the strict    Dutch baseline (  ) 35:


This proportional shift ensures that international toxicity limits are locally calibrated to the dense organic matrices typical of Netherlands waterways.33
4.4 AVS/SEM Exclusions
Crucially, despite global adoption of sulfide binding modeling in North America and Oceania, RIVM has formally rejected the incorporation of AVS/SEM thermodynamics into its primary algorithmic criteria derivation.33 The Framework for Harmonized Intervention (FHI) technical manuals specifically document a legislative and mathematical decision not to utilize the molar ratio (  ) or molar differences in the calculation of baseline metals targets.33

While historical Dutch datasets once utilized lutum (clay) normalizations to temper absolute metallic toxicity variance, contemporary Dutch mathematical derivation focuses exclusively on Species Sensitivity Distributions (SSDs) utilizing multi-species NOECs (No Observed Effect Concentrations) and bulk background normalization, purposefully bypassing complex anoxic sulfide binding scalars.33
5. Synthesis of Algorithmic Methodologies and OC Parameter Bounds
The mathematical scaffolding of benthic sediment quality standards exposes a pronounced structural divide across global regulatory architectures. The US EPA and RIVM frameworks are fundamentally mechanistic, engineering standards from phase-transfer thermodynamics via    and    partition limits.1 The arithmetic rigor required—such as the EPA's precision modeling of molar silver valency variations in AVS 1 and RIVM's   -fold ingestion penalty algorithmic trigger 35—reveals an intense prioritization on simulating exact physiochemical environments at the molecular level.
Conversely, the CCME and ANZG standards are anchored in empirical stochastic probability.7 Rather than relying entirely on partition thermodynamics, they deploy statistical arrays, harvesting specific percentiles (e.g., 10th, 15th, 50th, 85th) from massive global co-occurrence datasets.7 The application of the geometric mean algebraically subdues extreme variance within biological arrays.20
Furthermore, carbon normalization treatments exhibit sharp geographic discrepancies. While ANZG enforces mathematically rigid limits truncating adjustments below    and above    7, RIVM locks all multi-compartment conversions exclusively into an artificial    organic carbon parameter to forge an optimized 'standard sediment' baseline.35






These distinct algorithmic boundaries underscore that universal benthic standard-setting remains deeply reliant on highly divergent interpretations of foundational physical partition mechanics and statistical risk tolerance.
Works cited
                  1. Procedures for the Derivation of Equilibrium Partitioning Sediment Benchmarks (ESBS) for the Protection of Benthic Organisms Metal Mixtures (Cadmium, Copper, Lead, Nickel, Silver, and Zinc) - epa nepis, accessed May 14, 2026, https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P1008GZA.TXT
                  2. procedures-derivation-equilibrium-pah-mixtures.pdf - EPA, accessed May 14, 2026, https://www.epa.gov/sites/default/files/2018-10/documents/procedures-derivation-equilibrium-pah-mixtures.pdf
                  3. Procedures for the Derivation of Equilibrium Partitioning Sediment Benchmarks (ESBs) for the Protection of Benthic Organisms Compendium of Tier 2 Values for Nonionic Organics - Records Collections, accessed May 14, 2026, https://semspub.epa.gov/work/10/500006301.pdf
                  4. Procedures for the Derivation of Equilibrium Partitioning ... - CLU-IN, accessed May 14, 2026, https://clu-in.org/conf/tio/porewater1/resources/EPA-ESB-Procedures-PAH-mixtures.pdf
                  5. Evaluation of Equilibrium Partitioning Sediment Benchmarks (ESBs) for Assessing Sediment Quality in California Bays and Estuarie, accessed May 14, 2026, https://www.waterboards.ca.gov/water_issues/programs/bptcp/docs/sediment/eqpe_valuationsummary091208.pdf
                  6. Equilibrium partitioning sediment benchmark - Wikipedia, accessed May 14, 2026, https://en.wikipedia.org/wiki/Equilibrium_partitioning_sediment_benchmark
                  7. Toxicant default guideline values for sediment quality, accessed May 14, 2026, https://www.waterquality.gov.au/anz-guidelines/guideline-values/default/sediment-quality-toxicants
                  8. An evaluation of sediment quality conditions in Presque Isle Bay: assessing compliance with eco - PA Walter, accessed May 14, 2026, https://pawalter.psu.edu/sites/default/files/resources/PIB%20Sediment%20Evaluation%20%282015%29.pdf
                  9. Simultaneously extracted metals and acid-volatile sulfide - Wikipedia, accessed May 14, 2026, https://en.wikipedia.org/wiki/Simultaneously_extracted_metals_and_acid-volatile_sulfide
                  10. EPA-OW/OST: 376.3: Acid Volatile Sulfide (AVS) in Sediment by Acidification, accessed May 14, 2026, https://www.nemi.gov/methods/method_summary/10268/

11. Canadian Sediment Quality Guidelines for the Protection of Aquatic Life - Lead - CCME, accessed May 14, 2026, https://ccme.ca/en/res/lead-canadian-sediment-quality-guidelines-for-the-protection-of-aquatic-life-en.pdf
                  12. Screening and Assessment of Contaminated Sediment - NY.Gov, accessed May 14, 2026, https://extapps.dec.ny.gov/docs/fish_marine_pdf/screenasssedfin.pdf
                  13. Appendix B: SEM/AVS Calculations - King County, accessed May 14, 2026, https://your.kingcounty.gov/dnrp/library/wastewater/iw/SourceControl/studies/sed/GreenRiverSediment-FinalReport-AppendixB.pdf
                  14. Characterizing sediment acid volatile sulfide concentrations in European streams - PubMed, accessed May 14, 2026, https://pubmed.ncbi.nlm.nih.gov/17269454/
                  15. Guidance on Evaluating Sediment Contaminant Results - Ohio.gov, accessed May 14, 2026, https://dam.assets.ohio.gov/image/upload/epa.ohio.gov/Portals/35/guidance/sediment_evaluation_jan10.pdf
                  16. Simultaneously Extracted Metals/ Acid-Volatile Sulfide and Total Metals in Surface Sediment from the Hanford Reach of the Colum - Pacific Northwest National Laboratory, accessed May 14, 2026, https://www.pnnl.gov/main/publications/external/technical_reports/pnnl-13417.pdf
                  17. Acid Volatile Sulfide / Simultaneously Extracted Metals (AVS/SEM) - Alpha Analytical, accessed May 14, 2026, https://alphalab.com/analytical-services/sediment-tissue-analysis/inorganics-physical-parameters-analysis/acid-volatile-sulfide-simultaneously-extracted-metals-avs-sem
                  18. Acid Volatile Sulfide Method (SEM-A, accessed May 14, 2026, https://www.waterboards.ca.gov/rwqcb3/water_issues/programs/stormwater/docs/lid/Casmalia_Superfund_Site/Remedial%20Investigation%20Report/Appendix%20U/Tables/Table%20U-14.pdf
                  19. Sediment Investigation Report, 2010 Sampling Event Howard's Bay - St. Louis River AOC, accessed May 14, 2026, https://www.pca.state.mn.us/sites/default/files/c-rem5-05.pdf
                  20. Protocol for the Derivation of Canadian Sediment Quality Guidelines for the Protection of Aquatic Life | CCME, accessed May 14, 2026, https://ccme.ca/en/res/protocol-for-the-derivation-of-canadian-sediment-quality-guidelines-for-the-protection-of-aquatic-life-en.pdf
                  21. (PDF) Methods for Deriving Pesticide Aquatic Life Criteria for Sediments - ResearchGate, accessed May 14, 2026, https://www.researchgate.net/publication/233901376_Methods_for_Deriving_Pesticide_Aquatic_Life_Criteria_for_Sediments
                  22. Chemical-Specific Sediment Quality Guidelines - à www.publications.gc.ca, accessed May 14, 2026, https://publications.gc.ca/collections/collection_2024/eccc/En13-11-2-2003-eng.pdf
                  23. Summary of Guidelines for Contaminated Freshwater Sediments - Washington State Department of Ecology, accessed May 14, 2026, https://apps.ecology.wa.gov/publications/documents/95308.pdf
                  24. Region 4 Ecological Risk Assessment Supplemental Guidance | EPA, accessed May 14, 2026, https://www.epa.gov/sites/default/files/2018-03/documents/era_regional_supplemental_guidance_report-march-2018_update.pdf
                  25. Intuition and derivation of the geometric mean - Mathematics Stack Exchange, accessed May 14, 2026, https://math.stackexchange.com/questions/138589/intuition-and-derivation-of-the-geometric-mean
                  26. Calculating Geometric Means - State Water Resources Control Board, accessed May 14, 2026, https://www.waterboards.ca.gov/water_issues/programs/swamp/docs/cwt/guidance/3413.pdf
                  27. The geometric mean? - CDN, accessed May 14, 2026, https://bpb-us-e1.wpmucdn.com/sites.tufts.edu/dist/a/4406/files/2020/04/Geometric-Mean-2020.pdf
                  28. Criteria for the Assessment of Sediment Quality in Quebec and Application Frameworks: Prevention, Dredging and Remediation, accessed May 14, 2026, https://publications.gc.ca/collections/collection_2008/ec/En154-50-2008E.pdf
                  29. Methodology for deriving toxicant guideline values for sediments - Water Quality Australia, accessed May 14, 2026, https://www.waterquality.gov.au/anz-guidelines/guideline-values/derive/field-effects/method-toxicants-sediments

30. Information Guidelines Explanatory Note - Deriving site-specific guideline values for physico-chemical parameters and toxicants, accessed May 14, 2026, https://www.iesc.gov.au/sites/default/files/2022-07/information-guidelines-explanatory-note-site-specific-guidelines-values.pdf
                  31. Revision of the ANZECC/ARMCANZ Sediment Quality Guidelines - CSIRO people, accessed May 14, 2026, https://people.csiro.au/-/media/People-Finder/S/S/Stuart-Simpson/Revision-of-SQGs-Final-Report-2013--Final.pdf
                  32. Deriving guideline values using reference-site data - Water Quality Australia, accessed May 14, 2026, https://www.waterquality.gov.au/anz-guidelines/guideline-values/derive/reference-data
                  33. Guidance for the derivation of environmental risk limits - Risico's van stoffen, accessed May 14, 2026, https://rvs.rivm.nl/sites/default/files/2019-05/ERL%20Guidance_04_151031%20beveiligd.pdf
                  34. RIVM report 601501020 Guidance for deriving Dutch Environmental Risk Limits from EU-Risk Assessment Reports of existing substanc, accessed May 14, 2026, https://www.rivm.nl/bibliotheek/rapporten/601501020.pdf
                  35. RIVM Guidance for the derivation of environmental risk limits Recalculation to Dutch characteristics Equilibrium partitioning method, accessed May 14, 2026, https://rvs.rivm.nl/sites/default/files/2025-02/ERL%20Guidance_09_v2.0_250203.pdf
                  36. Technical Guidance for Deriving Environmental Quality Standards - RIVM, accessed May 14, 2026, https://rvs.rivm.nl/sites/default/files/2019-04/Guidance%20No%2027%20-%20Deriving%20Environmental%20Quality%20Standards%20-%20version%202018.pdf
                  37. RIVM rapport 601782001 Guidance for the derivation of environmental risk limits within the framework of International and nation, accessed May 14, 2026, https://www.rivm.nl/bibliotheek/rapporten/601782001.pdf

