Source: https://docs.google.com/document/d/1fB7EgVEtr9C79rgc8aPa_fyoKMGRBK83xSUfBWYnzOA/export?format=txt

---

﻿Mathematical Frameworks for Back-Calculating Safe Sediment Concentrations from Tissue Residue Guidelines
The derivation of safe sediment concentrations intended to protect apex ecological predators requires the rigorous mathematical resolution of multidimensional thermodynamic, kinetic, and trophic variables. Rather than relying on direct empirical toxicological testing of sediment matrices—an approach that fundamentally fails to account for the spatial and temporal compounding of persistent, bioaccumulative, and toxic (PBT) compounds—advanced ecotoxicological frameworks utilize retrograde mathematical derivations. These frameworks back-calculate from established, receptor-specific Tissue Residue Guidelines (TRGs) through complex trophic webs to ascertain a maximum allowable sediment quality benchmark. The mathematical mechanics of these reverse derivations involve deterministic steady-state kinetic modeling, fugacity capacity ratios, matrix algebra for cross-trophic predation, and the rigid mathematical application of Biota-Sediment Accumulation Factors (BSAFs).1
This exhaustive research report extracts, normalizes, and details the algebraic equations and deterministic food web models utilized by three highly advanced environmental assessment methodologies: the United States Environmental Protection Agency (US EPA) Great Lakes Water Quality Guidance 4, Fisheries and Oceans Canada (DFO) Apex Marine Mammal Framework 5, and the Athabasca Chipewyan First Nation (ACFN) Biota-Based Sediment Guideline Value (BBSGV) methodology.6
1. Thermodynamic Partitioning and Biota-Sediment Accumulation Factors (BSAFs)
The foundational mathematical objective of these ecotoxicological frameworks is to connect a defined, maximum acceptable tissue concentration in an apex receptor to a targeted sediment concentration limit. Because the physical chemistry of highly hydrophobic organic contaminants drives them to partition selectively into specific organic matrices rather than aqueous phases, the operative algebraic equations mandate strict mathematical normalization to these binding phases. Specifically, the mathematics isolate lipid content in biological tissues and organic carbon in benthic sediments as the primary thermodynamic reservoirs.1
1.1 Derivation of the Biota-Sediment Accumulation Factor
The Biota-Sediment Accumulation Factor (BSAF) operates as the definitive thermodynamic ratio utilized to quantify the steady-state bioaccumulation of nonpolar organic chemicals.1 By mathematically normalizing for the specific physical compartments where hydrophobic chemicals partition, the BSAF establishes a dimensionless proxy for the fugacity gradient between benthic zones and biological receptors. When an ecosystem achieves pure thermodynamic equilibrium, the chemical fugacity within the biological lipid phase theoretically equals the chemical fugacity within the sediment organic carbon phase, resulting in a theoretical baseline BSAF of unity or a functionally constant value depending on the specific molar volume and hydrophobicity of the compound.10
The fundamental derivation of the BSAF formula operates exclusively on lipid-normalized tissue concentrations and organic carbon-normalized sediment concentrations 1:


To operationalize this highly theoretical equation for the back-calculation of empirical mass-based concentrations, the normalized parameters—the lipid-normalized tissue concentration (  ) and the organic carbon-normalized sediment concentration (  )—must be algebraically expanded into their constituent field-measurable variables.1 The lipid-normalized tissue concentration is mathematically derived by dividing the total wet-weight tissue concentration by the lipid fraction of the specific organism:


Correspondingly, the organic carbon-normalized sediment concentration is derived by dividing the total dry-weight sediment concentration by the fraction of organic carbon present in the surrounding benthic matrix 1:


Substituting these expanded mathematical definitions back into the fundamental BSAF equation yields the explicit empirical relationship linking macroscopic tissue and sediment matrices, enabling the parameterization of field data into a standardized thermodynamic index 8:


1.2 Algebraic Back-Calculation of the Sediment Target

When establishing protective environmental criteria, the theoretical tissue concentration (  ) is replaced by the Tissue Residue Guideline (TRG), which represents the safe toxicological threshold derived from controlled dose-response data. The objective function is therefore to solve the equation for the maximal allowable sediment concentration (  ), which is often denoted in regulatory contexts as the Sediment Quality Guideline (  ) or Biota-Based Sediment Guideline Value (  ).2
Through the algebraic rearrangement of the expanded BSAF empirical relationship, the mathematical formula for back-calculating the exact safe sediment concentration is explicitly defined 2:


Parameter
	Mathematical Definition
	Dimensional Units


	Target safe sediment concentration (SQG or BBSGV)
	mg chemical / kg dry sediment


	Tissue Residue Guideline (TRG) or maximum safe tissue concentration
	mg chemical / kg wet tissue


	Mass fraction of organic carbon in the specific sediment matrix
	kg organic carbon / kg dry sediment


	Biota-Sediment Accumulation Factor
	kg organic carbon / kg lipid


	Mass fraction of lipid within the specific biological receptor
	kg lipid / kg wet tissue
	This formula isolates the necessary sediment concentration under the rigid assumption that the BSAF remains functionally linear at the trace concentrations relevant to ecotoxicology. However, this equation requires an accurate BSAF input, which must be derived empirically or through deterministic models if the target ecosystem is not in a state of thermodynamic equilibrium.13
1.3 Theoretical Bioaccumulation Potential (TBP)
In specific predictive modeling applications—such as evaluating the environmental impact of dredged materials or mapping the risk of localized benthic contamination plumes—the fundamental BSAF framework is mathematically inverted to predict the upper physiological limit of contaminant accumulation in a receptor, assuming a known sediment profile.11 This inverse calculation is mathematically expressed by the US EPA as the Theoretical Bioaccumulation Potential (TBP).11
The TBP equation represents the deterministic transformation of sediment organic carbon-bound chemical mass into biological lipid-bound chemical mass:


The derivation of the BSAF and the TBP, however, relies inherently on the strict assumption of thermodynamic equilibrium across all environmental compartments.10 For apex predators and upper-trophic species, true thermodynamic equilibrium is virtually never achieved due to the continual addition of dietary mass, stringent kinetic elimination restraints, biological half-lives that exceed the organism's lifespan, and species-specific metabolic biotransformations.14 Therefore, deriving a purely equilibrium-based BSAF is mathematically insufficient for modeling apex species. To bridge this gap, complex deterministic Food Web Models (FWMs) must be utilized to parameterize the trophic transfer coefficients, enabling the calculation of kinetic, rather than purely thermodynamic, accumulation factors.14
2. Deterministic Food Web Model (FWM) Equations
Deterministic food web models, notably the foundational mathematical architectures developed by Thomann (1989) and Gobas (1993), deliberately bypass simple thermodynamic partitioning.17 Instead, these frameworks calculate precise mass balances of chemical uptake and elimination across interconnected, multi-species trophic levels.15 These models represent the bioaccumulation behavior of hydrophobic organic chemicals as a continuous differential function of multiple, independent kinetic vectors operating simultaneously within the organism.18
2.1 The Differential Mass Balance Equation
The net change in the concentration of a chemical in biological tissue over time (  ) is mathematically expressed as the algebraic sum of all kinetic uptake pathways minus the algebraic sum of all kinetic elimination pathways.15 The foundational differential equation models the individual organism as a single, contiguous biological compartment exchanging mass with the ambient water and with dietary sources:


To derive functional predictive accumulation factors for the establishment of environmental guidelines, the differential equation must be evaluated at the point of steady state. Steady state is mathematically defined as the exact condition where the rate of chemical uptake matches the rate of chemical elimination, resulting in a net concentration change of zero (  ).3

Setting the time derivative to zero and factoring out the organism tissue concentration (  ) yields the deterministic, steady-state bioaccumulation equation that forms the backbone of modern ecological risk assessment 15:


Parameter
	Mathematical Definition
	Dimensional Units


	Steady-state concentration of chemical in biological tissue

g / kg wet weight


	Freely dissolved concentration of chemical in the ambient water

g / L


	Concentration of chemical in the organism's diet (prey items)

g / kg wet weight


	Rate constant for chemical uptake via gills or respiratory surfaces
	L / kg    day


	Rate constant for dietary uptake via gastrointestinal tract
	kg prey / kg predator    day


	Rate constant for elimination via gills or respiratory surfaces
	day$^{-1}$


	Rate constant for elimination via fecal egestion
	day$^{-1}$


	Rate constant for physiological growth dilution
	day$^{-1}$


	Rate constant for metabolic biotransformation
	day$^{-1}$






2.2 Mathematical Extraction and Parameterization of Rate Constants
The steady-state predictive model is mathematically functional only if each individual rate constant is independently parameterized using reliable empirical data or highly structured sub-models. These rate constants are mathematically defined by the organism's allometric bioenergetics and the thermodynamic properties of the chemical, most notably the octanol-water partition coefficient (  ).
Aqueous Uptake and Elimination (   and   )
The gill uptake rate constant (  ) is mathematically dependent on the ventilation rate of the organism and the physical diffusion resistance across the aqueous unstirred layer and the lipid epithelial membranes of the gills.15 Empirical models utilize temperature parameters and allometric weight scaling to define this rate.
The corresponding aqueous elimination rate (  ) is mathematically coupled to the uptake rate through the chemical's strict thermodynamic partitioning preference.21 At theoretical thermodynamic equilibrium, assuming no dietary intake or growth dilution, the lipid-normalized bioconcentration factor (  ) is mathematically approximated by the chemical's   . Because    is defined as the ratio of    to   , the equation yields the following rigorous relationship used to solve for the elimination rate 21:


This inverse proportionality indicates that as the hydrophobicity (log   ) of a chemical increases, its rate of passive respiratory elimination (  ) exponentially decreases, forcing the organism to rely on slower secondary elimination pathways like fecal egestion.20
Dietary Uptake (  )
For upper-trophic species, the dietary uptake rate constant (  ) dominates the bioaccumulation equation.15 This constant scales deterministically with the feeding rate of the organism and the extraction efficiency of the chemical from the digested prey matrix.24 The fundamental equation is formulated as:


Where    is the total wet weight of the organism (kg),    is the bulk feeding rate of the organism (kg/day), and    is the dietary pesticide or chemical transfer efficiency, which represents the fraction of ingested chemical that successfully crosses the gastrointestinal tract.24
The feeding rate (  ) itself must be derived from structured allometric scaling equations and temperature dependencies.19 For non-filter-feeding aquatic animals (such as piscivorous fish), the bioenergetic equation utilized by the Arnot and Gobas adaptation mathematically isolates the relationship between body weight and water temperature 24:


For filter-feeding organisms, the feeding rate relies heavily on the total volume of water filtered over time (  ), the concentration of suspended particulate solids (  ), and the biological filtration efficiency (  ) 24:


The filtration volume (  ) is similarly dependent on body weight and dissolved oxygen demand (  ), structured mathematically as 24:


The dietary transfer efficiency (  ) mathematically defines the thermodynamic limitation of absorbing highly hydrophobic compounds from the gut tract into the organism's lipid tissues. As the    of a contaminant increases into the superhydrophobic range (log   ), steric hindrance and immense phase partitioning resistance fundamentally limit cellular absorption. This biochemical bottleneck is modeled algebraically as an inverse function of the partition coefficient 24:


Metabolic Biotransformation (  )

The metabolic biotransformation rate (  ) introduces significant predictive variability into the mathematical frameworks, as it quantifies the enzymatic destruction or modification of the parent compound within the organism's liver or equivalent organ system (often driven by cytochrome P450 activity).15 This rate constant is inherently species- and chemical-specific. When exact empirical    values are absent from the scientific literature—which is common for emerging contaminants—the term is frequently suppressed mathematically (  ) within regulatory frameworks to generate the maximum conservative exposure estimations.3
Fecal Egestion (  ) and Growth Dilution (  )
The fecal egestion rate (  ) operates inversely to dietary uptake, acting as a thermodynamic pump. As dietary lipid is digested and biologically extracted from the prey mass within the gut, the fugacity of the remaining chemical in the shrinking gut tract increases dramatically, forcing a concentration gradient that drives excretion.19 The Gobas model often simplifies this mathematically by scaling    directly as a fraction of the ingestion rate.19
Growth dilution (  ) acts as a pseudo-elimination pathway within the differential equation.15 The mass of the persistent chemical does not physically leave the organism; rather, the rapidly increasing biological volume of the organism (  ) over time mathematically dilutes the overall tissue concentration (  ). The rate of growth is modeled as the time-derivative of the organism's allometric growth curve.19
2.3 Matrix Algebra for Complex Trophic Webs
In complex multi-trophic environments, apex predators consume a highly varied array of prey, which in turn feed on multiple lower-trophic guilds.27 The Gobas and Campfens applications of the deterministic food web model transition the individual steady-state equation into a rigorous matrix algebra format.3 This allows the mathematics to automatically account for complex dietary proportioning, intra-species cannibalism, and cross-trophic scavenging, which are impossible to resolve with simple linear ratios.3
Let the integer    equal the total number of distinct trophic guilds interacting within the modeled food web. The bulk dietary concentration (  ) is algebraically expanded into a summation of the dietary proportions (  ) and the internal chemical concentrations (  ) of each specific prey item consumed.3 The non-food web terms representing the basal environmental inputs (phytoplankton and detritus) are mathematically segregated from the dynamic faunal terms.
The matrix representation for the concentration in any specific trophic guild    is formulated as a two-part summation 3:


The first term represents the baseline bioaccumulation of the chemical originating strictly from non-food-web sources (aqueous respiration and primary detrital consumption), whereas the second term represents the iterative escalation of mass through the upper food web interactions.3 Solving this large system of linear equations across all    species simultaneously generates the interconnected interaction matrices required to definitively track a contaminant from detrital sediment partitioning up through multiple cascading linkages to an apex marine mammal or piscivorous bird.3
3. Mathematical Derivation of the Biomagnification Factor (BMF)
While the BSAF mathematically bridges tissue directly to sediment, the Biomagnification Factor (BMF) is utilized to exclusively quantify the isolated trophic transfer event from a prey organism to its predator.15 By structurally analyzing the steady-state equation, the dietary components can be mathematically isolated. Assuming aqueous uptake (  ) is negligible compared to massive dietary intake—a standard and robust assumption for apex air-breathing predators, marine mammals, and very high-trophic mature fish—the theoretical BMF is extracted as a simple ratio 15:


However, utilizing the explicit rate constants derived from the deterministic food web model, the BMF can be calculated kinetically rather than relying solely on paired field samples. Algebraic substitution of the mass balance terms yields the explicit deterministic BMF formula 15:

This mathematical expression proves that biomagnification is not simply a function of how much an organism eats (  ), but rather a competition between the rate of feeding and the combined efficiencies of respiratory, excretory, metabolic, and growth-based dilution pathways. If    numerically exceeds the sum of the denominator components, the BMF is greater than 1, and the chemical is actively biomagnifying.15
4. Jurisdictional Framework Mathematical Extractions
Environmental regulatory bodies adapt these fundamental deterministic mass-balance equations and thermodynamic partitioning algorithms to suit highly specific ecological protection goals. The mathematical extraction of methodologies from the US EPA, Fisheries and Oceans Canada, and the Athabasca Chipewyan First Nation demonstrates profound variations in how thermodynamic gradients and trophic escalations are algebraically encoded into enforceable policy criteria.
4.1 US EPA Great Lakes Water Quality Guidance (GLWQG)
The United States Environmental Protection Agency methodology, explicitly outlined in the comprehensive Great Lakes Water Quality Initiative Technical Support Document for the Procedure to Determine Bioaccumulation Factors (EPA-820-B-95-005), seeks to mathematically define the absolute Bioaccumulation Factor (BAF) for specific trophic tiers.14 Because field-measured BAFs are rarely available for all chemicals across all species, the EPA mathematical hierarchy relies heavily on calculating structured Food Chain Multipliers (FCMs) derived directly from the Thomann (1989) trophic model to project chemical accumulation sequentially from the ambient water column up to top predator fish (designated as Trophic Level 4).17
Calculation of Food Chain Multipliers (FCM)
The FCM mathematically captures the precise extent to which a chemical biomagnifies within a food web beyond simple, passive aqueous bioconcentration (BCF). Utilizing the continuous differential modeling of trophic stepwise increases, the US EPA mathematically establishes the FCM for specific ascending trophic levels (  ,   ,   ) as a ratio of the gross Bioaccumulation Factor to the base Bioconcentration Factor of baseline zooplankton (  ).17 The explicit formulas are extracted as follows:






For functional integration into broader back-calculations, the EPA mathematically defines the theoretical freely dissolved baseline BAF by relating the chemical's octanol-water partition coefficient (  ) to the dynamically predicted biomagnification capacity.17 The fundamental ratio is:


Rearranging this theoretical formula yields the specific derivation for the predicted freely-dissolved baseline Bioaccumulation Factor (  ) for any given targeted trophic level:


The National BAF Equation
To finalize the derivation of a site-specific or national BAF for regulatory application, the US EPA mathematics must reincorporate the lipid normalization phase and formally address the freely dissolved fraction of the chemical in the ambient water. Because highly hydrophobic chemicals preferentially partition to dissolved organic carbon (DOC) and particulate organic carbon (POC) suspended in the water column, a significant fraction of the chemical is structurally bound and rendered biologically non-bioavailable to gill structures.
The final deterministic equation to calculate the national BAF for a specific trophic level integrates the calculated baseline BAF, the empirical lipid fraction of the target trophic organism (  ), and the freely dissolved chemical fraction in the water column (  ).10 The complete algebraic formulation is:


This finalized    value functionally bridges the vast mathematical gap between extremely low aqueous ambient water criteria and highly concentrated target tissue guidelines, ensuring the regulatory threshold accurately accounts for exponential trophic ascension.10
4.2 Fisheries and Oceans Canada (DFO) - Apex Marine Mammal POPs Framework
The Fisheries and Oceans Canada (DFO) framework, specifically researched and published in the Canadian Technical Report of Fisheries and Aquatic Sciences 3582, focuses intensely on the extreme biomagnification potential of Persistent Organic Pollutants (POPs) in apex marine mammals, such as the St. Lawrence estuary beluga whales and the Northern and Southern Resident killer whales.5

Unlike the US EPA framework, which frequently targets piscivorous fish relying heavily on combined aqueous and dietary partitioning models, the DFO framework specifically addresses cetaceans and other marine mammals. These apex species lack aqueous gill exchange completely, relying absolutely on dietary uptake (  ) and maternal offloading (lactation/placental transfer) for toxicant loading.28 This alters the kinetic denominators heavily, forcing the mathematical derivation to center entirely on the diet.
Toxicity Reference Value (TRV) Derivation
The DFO mathematical derivation necessarily begins with translating surrogate human health and toxicological data (frequently derived from murine/rodent testing) to massive marine mammals using stringent, deterministic uncertainty multipliers. The Point of Departure (POD)—which represents the Benchmark Dose Lower Limit (BMDL), Lowest Observed Adverse Effect Level (LOAEL), or No Observed Adverse Effect Level (NOAEL) recorded in the laboratory—is algebraically divided by highly specific Uncertainty Factors (UF).28
The explicit mathematical derivation for the baseline Toxicity Reference Value (TRV) is:


Parameter
	Mathematical Definition


	Toxicity Reference Value representing the safe threshold for marine mammals


	Empirical Point of Departure derived from dose-response toxicity data


	Uncertainty Factor mathematically accounting for intraspecies variability


	Uncertainty Factor mathematically accounting for interspecies variability (e.g., rodent to cetacean)


	Uncertainty Factor mathematically accounting for dataset quality, sample size, and limitations
	Diet Guideline (  ) Derivation
Once the absolute maximum tolerable TRV is established mathematically, the DFO framework mandates the back-calculation of a safe prey tissue concentration. Because marine mammals sit completely disjointed from direct aqueous or sediment uptake, their entire chemical exposure pathway is dictated uniquely by the Biomagnification Factor (BMF) acting on their food source.
The formula mathematically linking the established TRV to the required prey concentration represents the formal Diet Guideline (  ) 28:


The execution of the    calculation effectively yields the absolute maximum target concentration of the prey tissue (e.g., establishing the contaminant limit in Chinook salmon to ensure the protection of Resident killer whales).28 From this intermediate dietary benchmark, standard continuous FWMs or empirical BSAF ratios are re-engaged to mathematically push the derivation further down through the lower trophic levels. This calculates the corresponding safe Water Quality Guideline (  ) and the ultimate Sediment Quality Guideline (  ), ensuring that the fundamental benthic foundation of the marine food web does not load unacceptable toxicant mass into the pelagic system.28
4.3 Athabasca Chipewyan First Nation (ACFN) WQCIU Report - BBSGV Methodology
The Water Quality Criteria for Indigenous Use (WQCIU) report, produced in meticulous conjunction with the Athabasca Chipewyan First Nation (ACFN), Mikisew Cree First Nation, and Fort McKay First Nation, provides a highly formalized mathematical derivation of Biota-Based Sediment Guideline Values (BBSGVs).6 This rigorous regional framework heavily integrates the foundational toxicological logic of Newell et al. (1987) and subsequent New York State Department of Environmental Conservation (NYSDEC) methodologies to specifically mathematically isolate risk to human receptors consuming exceptionally high diets of localized aquatic country food.7
The ACFN mathematical framework executes an unyielding, step-by-step sequence of explicit algebraic formulas to calculate the final target sediment concentration necessary to protect high-consumption Indigenous users.7
Equation 4.2: Derivation of the Risk Specific Dose (  )
For documented carcinogenic contaminants, the standard Acceptable Daily Intake (ADI) is quantified strictly as the Risk Specific Dose (  ). The mathematical calculation structurally translates an acceptable target population risk level into a daily mass dosage via the chemical's toxicological slope factor.7


Parameter
	Mathematical Definition
	Dimensional Units


	Risk Specific Dose (equivalent to maximum acceptable exposure dose)
	mg / kg body-weight    day


	Acceptable Risk Level (e.g.,    statistical incidence of cancer)
	Unitless probability


	Oral Slope Factor detailing carcinogenic potency

(mg / kg    day)  
	Equation 4.3: Derivation of the Baseline Bioaccumulation Factor (  )
Following the rigid architectural structure of the US EPA hierarchy, the ACFN mathematical framework determines the foundational bioaccumulation potential purely based on pristine thermodynamic partitioning and the defined trophic scale parameter. It algebraically links the n-octanol/water partition coefficient directly to the expected biomagnification potential utilizing the designated Food Chain Multiplier.7


Equation 4.4: Derivation of the Freely Dissolved Fraction (  )
The ACFN framework enforces absolute mathematical accountability for the true bioavailability of the contaminant resting in the water column. Contaminants that are physiochemically bound to dissolved organic carbon (DOC) or particulate organic carbon (POC) are mathematically subtracted from the total water concentration to isolate the bioavailable, freely dissolved fraction (  ).7
The derivation operates on the empirically observed assumption that the partitioning coefficient to DOC is approximately one-tenth the partitioning coefficient to pure octanol (  ), and that the partitioning coefficient to POC is structurally equal to   .7 This yields the following normalization formula:


Parameter
	Mathematical Definition
	Dimensional Units


	Freely dissolved, bioavailable fraction of chemical in water
	Unitless fraction


	Empirical concentration of dissolved organic carbon
	kg DOC / L water


	Empirical concentration of particulate organic carbon
	kg POC / L water


	Chemical-specific octanol-water partitioning coefficient
	Unitless ratio
	Equation 4.5: Trophic Level Specific Bioaccumulation Factor (  )
To successfully transition the theoretical    into an empirical mathematical projection for a specifically consumed fish species operating at a designated trophic level, the formula multiplies the baseline thermodynamic factor by the freely dissolved availability metric and the specific measured lipid content of the target dietary item.7 This finalizes the tissue-specific exposure parameter.


Equation 4.6: Organic Carbon Normalized Sediment Quality Criteria (  )
The final ACFN mathematical derivation aggressively aggregates all previous cascading equations into the terminal objective function: calculating the precise allowable contaminant mass in the sediment, thoroughly normalized to the surrounding organic carbon matrix. This capstone formula bridges the human dietary intake limits directly to the benthic reservoir.7
The extensive derivation perfectly accounts for the total acceptable daily intake (   or   ), an applied allocation factor (  ) designating the precise percentage of human exposure mathematically attributed specifically to sediment-derived pathways (excluding air or terrestrial food exposure), and the complex summation of all consumed dietary items based on their individual trophic-specific bioaccumulation factors (  ) multiplied by the empirical percentage they constitute within the user's total diet (  ). A standard mathematical unit conversion factor of 1000 is applied at the conclusion of the formula to standardize the final regulatory output.7


Parameter
	Mathematical Definition
	Dimensional Units


	Final Sediment Quality Criteria normalized to organic carbon
	mg / kg organic carbon


	Acceptable Daily Intake (or RsD) calculated for the specific receptor
	mg / kg body-weight    day


	Allocation Factor attributing proportional exposure to the sediment pathway
	Unitless fraction


	Target-specific bioaccumulation factor for the consumed item
	L / kg lipid


	Proportion of specific trophic level item within the total diet
	Unitless fraction
	5. Synthesis of Thermodynamic and Kinetic Parameterizations
The strict mechanical extraction of these algebraic formulas highlights the immense mathematical rigor required to protect upper-tier ecological receptors and specific human populations from the devastating effects of persistent organic pollutants. Traditional toxicological approaches that rely on simple empirical observations of toxicity in localized sediment samples cannot capture the multi-generational, highly non-linear amplification of chemicals as they climb the trophic ladder.

Whether an environmental agency adopts the Gobas (1993) continuous matrix algebra to account for the complex internal diets of highly localized aquatic food webs, utilizes the DFO point-of-departure safety scaling specifically geared to isolate and protect cetacean marine mammals, or enforces the ACFN stepwise fraction derivations to yield perfectly explicit Biota-Based Sediment Guideline Values for high-consumption Indigenous human users, the core mathematical dynamic across all advanced frameworks remains continuous and fundamentally unified.
The unyielding thermodynamic drive of the octanol-water partition coefficient (  ) and the absolute necessity of organic carbon and lipid mass normalization dictate the foundational environmental reservoir potential. Simultaneously, the deterministic bioenergetic flux vectors—encompassing variables   —govern the biological culmination of that chemical mass into living tissue. Integrating these highly specific algebraic frameworks allows toxicologists, risk assessors, and environmental chemists to accurately navigate backwards from an absolute biological toxicity threshold to a legally actionable, highly protective environmental media target.
Works cited
1. TOGS 1.1.4: Procedures for Derivation of Bioaccumulation Factors - NY.gov, accessed May 14, 2026, https://extapps.dec.ny.gov/docs/water_pdf/togs114.pdf
2. A Guidance Manual to Support the Assessment of Contaminated Sediments in Freshwater Ecosystems - Florida Department of Environmental Protection, accessed May 14, 2026, https://floridadep.gov/sites/default/files/GM_Vol_III.pdf
3. Development and application of a model describing the bioaccumulation and metabolism of polycyclic aromatic hydrocarbons in a ma - SciSpace, accessed May 14, 2026, https://scispace.com/pdf/development-and-application-of-a-model-describing-the-4oc206ortk.pdf
4. 40 CFR Part 132 -- Water Quality Guidance for the Great Lakes System - eCFR, accessed May 14, 2026, https://www.ecfr.gov/current/title-40/chapter-I/subchapter-D/part-132
5. A framework for the derivation of environmental quality guidelines that protect apex marine mammals from persistent organic pollutants (POPS) / Kathleen McTavish, Juan José Alava, Tanya Brown, Magaidh... - à www.publications.gc.ca, accessed May 14, 2026, https://publications.gc.ca/site/eng/9.931293/publication.html
6. State of the Environment Technical Report 2025 Surface Water Quality and Quantity in Alberta's Oil Sands Region - Open Government program, accessed May 14, 2026, https://open.alberta.ca/dataset/d3c0cd55-85ff-4b5d-985d-cb0b460a1505/resource/9b397292-e9fe-4d7f-beb1-1505226525cf/download/epa-state-of-the-environment-technical-report-2025-surface-water-quality-and-quantity-in-alberta.pdf
7. Lower Athabasca Surface Water and Sediment Quality Criteria for Protection of Indigenous Use, accessed May 14, 2026, https://acfn.com/wp-content/uploads/2023/10/wqciu_report.pdf
8. Bioavailability of Contaminants in Soils and Sediments: Processes, Tools, and Applications (2003) - National Academies of Sciences, Engineering, and Medicine, accessed May 14, 2026, https://www.nationalacademies.org/read/10523/chapter/4
9. Final Staff Report Water Quality Control Plan for Enclosed Bays and Estuaries Part 1. Sediment Quality - California State Water Resources Control Board, accessed May 14, 2026, http://www.waterboards.ca.gov/board_decisions/adopted_orders/resolutions/2008/rs2008_0014_ceqa.pdf
10. Methodology for Deriving Ambient Water Quality Criteria for the Protection of Human Health (2000) Technical Support Document Volume 2: Development of National Bioaccumulation Factors - epa nepis, accessed May 14, 2026, https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P1005EZQ.TXT
11. Methodology For Integrating And Evaluating Sediment Chemistry And Biological Data Housed In The National Sediment Inventory: An Issue Paper - epa nepis, accessed May 14, 2026, https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=94008ZKE.TXT
12. BIOACCUMULATION RISK ASSESSMENT MODELING SYSTEM (BRAMS) - DOTS, accessed May 14, 2026, https://dots.el.erdc.dren.mil/elmodels/brams/BRAMS_UserManual(May2019).pdf
13. SEDIMENT QUALITY GUIDELINES IN BRITISH COLUMBIA, CANADA - SFU Summit, accessed May 14, 2026, https://summit.sfu.ca/_flysystem/fedora/sfu_migrate/12095/etd7014_JArblaster.pdf

14. Great Lakes Water Quality Initiative Technical Support Document For The Procedure To Determine Bioaccumulation Factors - epa nepis, accessed May 14, 2026, https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=2000GYUC.TXT
15. Developing a trophic bioaccumulation model for PFOA and PFOS in a marine food web - SFU Summit, accessed May 14, 2026, https://summit.sfu.ca/_flysystem/fedora/sfu_migrate/17518/etd9706_MMcDougall.pdf
16. Science Support for Evaluating Natural Recovery of Polychlorinated Biphenyl Concentrations in Fish from Crab Orchard Lake, Crab, accessed May 14, 2026, https://pubs.usgs.gov/of/2018/1006/ofr20181006.pdf
17. Bioaccumulation Testing And Interpretation For The Purpose Of Sediment Quality Assessment Status and Needs - EPA Archive, accessed May 14, 2026, https://archive.epa.gov/water/archive/polwaste/web/pdf/bioaccum.pdf
18. 40 CFR Part 132 -- Water Quality Guidance for the Great Lakes System - Title 40, accessed May 14, 2026, https://extapps.dec.ny.gov/fs/projects/spdes/eCFR40CFRPart132.pdf
19. Review of bioaccumulation models for use in environmental standards - GOV.UK, accessed May 14, 2026, https://assets.publishing.service.gov.uk/media/5a7b930f40f0b645ba3c5337/scho0507bmpo-e-e.pdf
20. Bioaccumulation assessment of superhydrophobic substances - Umweltbundesamt, accessed May 14, 2026, https://www.umweltbundesamt.de/system/files/medien/479/publikationen/texte_40-2023_bioaccumulation_assessment_of_superhydrophobic_substances.pdf
21. Total Risk Integrated Methodology TRIM.FaTE Technical Support Document - EPA, accessed May 14, 2026, https://www.epa.gov/sites/default/files/2014-03/documents/tsd-v2-2002.pdf
22. Bioaccumulation and Aquatic System Simulator (BASS) User's Manual Beta Test Version 2.1 - EPA, accessed May 14, 2026, https://www.epa.gov/sites/default/files/2016-02/documents/bass21_manual.pdf
23. The impact of precursors on aquatic exposure assessment for PFAS: Insights from bioaccumulation modeling, accessed May 14, 2026, https://academic.oup.com/ieam/article-pdf/17/4/705/59422240/ieam4414.pdf
24. KABAM Version 1.0 User's Guide and Technical Documentation - Appendix A - Description of Bioaccumulation Model - EPA, accessed May 14, 2026, https://www.epa.gov/pesticide-science-and-assessing-pesticide-risks/kabam-version-10-users-guide-and-technical-7
25. User's Guide and Technical Documentation KABAM version 1.0 (KOW (based) Aquatic BioAccumulation Model) - EPA, accessed May 14, 2026, https://www.epa.gov/sites/default/files/2015-07/documents/kabam_v1_0_users_guide.pdf
26. A food web bioaccumulation model for the accumulation of per- and polyfluoroalkyl substances (PFAS) in fish: how important is renal elimination? - PMC, accessed May 14, 2026, https://pmc.ncbi.nlm.nih.gov/articles/PMC9384792/
27. The currently-known geographical ranges of northern (left) and southern... | Download Scientific Diagram - ResearchGate, accessed May 14, 2026, https://www.researchgate.net/figure/The-currently-known-geographical-ranges-of-northern-left-and-southern-right-resident_fig1_232660451
28. (PDF) A Framework For The Derivation Of Environmental Quality ..., accessed May 14, 2026, https://www.researchgate.net/publication/380000747_A_Framework_For_The_Derivation_Of_Environmental_Quality_Guidelines_That_Protect_Apex_Marine_Mammals_From_Persistent_Organic_Pollutants_POPS
29. Water Quality Guidance for the Great Lakes System: Supplementary Information Document (SID) - EPA, accessed May 14, 2026, https://www.epa.gov/sites/default/files/2015-12/documents/1995_water_quality_guidance_for_great_lakes_sid.pdf
30. Federal Register/Vol. 63, No. 157/Friday, August 14, 1998/Notices - GovInfo, accessed May 14, 2026, https://www.govinfo.gov/content/pkg/FR-1998-08-14/pdf/98-21517.pdf
31. Flow chart depicting input into the food web bioaccumulation model... - ResearchGate, accessed May 14, 2026, https://www.researchgate.net/figure/Flow-chart-depicting-input-into-the-food-web-bioaccumulation-model-required-to-make_fig6_232660451
32. A STUDY OF WATER AND SEDIMENT QUALITY AS RELATED TO PUBLIC HEALTH ISSUES, FORT CHIPEWYAN, ALBERTA - ohchr, accessed May 14, 2026, https://www.ohchr.org/sites/default/files/lib-docs/HRBodies/UPR/Documents/Session4/CA/ACFN_CAN_UPR_S4_2009_anx_DrTimoneyReportonFortChip.pdf

