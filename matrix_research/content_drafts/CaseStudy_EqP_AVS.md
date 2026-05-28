# Case Study: Ecological Direct Contact (EqP & AVS/SEM)

**Purpose:** This case study compares Equilibrium Partitioning (EqP) and Acid Volatile Sulfide (AVS) methodologies for deriving ecological direct-contact sediment values. Reference for the Phase 2 (2026) Matrix Sediment Standards Derivation Options Analysis.

This case study examines the algorithmic methodologies and thermodynamic derivations utilized by four major international regulatory bodies to establish benthic sediment quality standards for ecological direct contact. By evaluating the mathematical frameworks applied to both **non-ionic organic compounds** and **heavy metals**, we can understand how different jurisdictions balance mechanistic precision against statistical uncertainty and localized environmental variables.

---

## United States Environmental Protection Agency (US EPA)

The US EPA employs a highly mechanistic framework grounded in **Equilibrium Partitioning (EqP)** theory for non-ionic organics and **Acid Volatile Sulfide (AVS)** normalization for metals. 

*   **EqP Methodology:** Assumes that toxicity is primarily driven by the freely dissolved interstitial water concentration ($C_{iw}$), mathematically linked to the organic carbon partition coefficient ($K_{oc}$):
    $$ K_{oc} = \frac{C_{soc}}{C_{iw}} $$
*   **Site-Specific Adjustment:** Rather than utilizing a static default for organic carbon, the US EPA requires the application of site-specific fractional organic carbon ($f_{oc}$) to determine the final threshold. 
*   **Complex Mixtures:** For Polycyclic Aromatic Hydrocarbons (PAHs), the US EPA employs a Toxic Unit ($TU$) summation to model additive narcosis:
    $$ \sum TU = \sum \frac{C_{soc, PAH_i}}{C_{soc, EqP, PAH_i}} $$

For metals in anoxic sediments, the US EPA calculates the stoichiometric precipitation of insoluble metal sulfides using the **AVS/SEM** framework. A critical distinction is the application of a **0.5 molar valency multiplier for silver**, as it requires two moles of silver per mole of available sulfide ($Ag_2S$):

$$ \sum [SEM] = [Cd] + [Cu] + [Pb] + [Ni] + 0.5[Ag] + [Zn] $$

To accurately predict toxicity risks, especially in environments with extremely low AVS concentrations, the US EPA utilizes the organic carbon-normalized difference model:

$$ \frac{\sum [SEM] - [AVS]}{f_{oc}} $$

---

## Canadian Council of Ministers of the Environment (CCME)

In contrast to the US EPA's mechanistic modeling, the CCME utilizes an empirical, statistical derivation framework based on the **National Status and Trends Program (NSTP)**. Standards are derived directly from the **Biological Effects Database for Sediments (BEDS)**.

*   **Threshold Effect Level (TEL):** Functions as the Interim Sediment Quality Guideline (ISQG), using the geometric mean of the 15th percentile of the effect data ($Effect_{15}$) and the 50th percentile of the no-effect data ($No Effect_{50}$):
    $$ TEL = \sqrt{Effect_{15} \times No Effect_{50}} $$
*   **Probable Effect Level (PEL):** Derived from the geometric mean of the 50th percentile of the effect data and the 85th percentile of the no-effect data:
    $$ PEL = \sqrt{Effect_{50} \times No Effect_{85}} $$

The CCME broadly rejects universal organic carbon normalization across diverse geologies, maintaining that criteria should remain reported on a bulk dry-weight basis. Furthermore, the CCME severely limits the application of AVS/SEM models to a basic predictive ratio ($\sum [SEM] / [AVS]$).

---

## Australian and New Zealand Guidelines (ANZG)

The ANZG methodology presents a hybrid approach, bridging North American empirical distribution analyses with strict regional organic carbon algorithms. 

*   **Percentile Benchmarks:** The ANZG utilizes the 10th percentile for its **Default Guideline Value (DGV)** and the 50th percentile for its **Upper Guideline Value (GV-high)**.
*   **HOC Normalization:** A defining characteristic is its mandatory strict normalization procedure for all Hydrophobic Organic Contaminants (HOCs), mapping measured field concentrations ($C_{measured}$) to a mathematically equivalent 1% organic carbon baseline ($C_{normalized}$):
    $$ C_{normalized} = \frac{C_{measured}}{OC_{measured}} \times 1\% $$
    *   *Constraint:* The ANZG strictly bounds the validity of this normalization to environments with an organic carbon fraction precisely between **0.2% and 10%**.

Regarding AVS-SEM modeling, the ANZG diverges from the US EPA by introducing a **2.0 valency multiplier for silver** to account for the physical stoichiometry of silver complexation:

$$ \sum [SEM] = [Cd] + [Cu] + [Pb] + [Ni] + 2.0[Ag] + [Zn] $$

---

## Netherlands RIVM Environmental Risk Limits (ERLs)

The Dutch RIVM framework engineers interconnected algorithmic limits calibrated specifically for a highly standardized national baseline.

*   **Dutch Standard Sediment:** RIVM standardizes all multi-compartment normalizations exclusively to a rigid baseline, hardcoded with **10% organic matter** ($OM_{std}$) and **25% clay** ($Lutum_{std}$):
    $$ OM = 1.7 \times OC $$
*   **EU Baseline Mapping:** RIVM introduces an automated scalar multiplier to mathematically map broader EU standards (10% OC) back to its strict 5.88% organic carbon equivalent:
    $$ C_{sed, Dutch} = C_{sed, EU} \times \frac{0.0588}{0.10} $$

A critical inclusion in the RIVM methodology is the application of a **fixed biomagnification ingestion scalar** for highly lipophilic compounds ($\log K_{ow} > 5$). RIVM mathematically overrides standard EqP limits by applying a divisor of 10 to heavily penalize the benchmark:

$$ MPC_{sed, final} = \frac{MPC_{sed, EqP}}{10} $$

Furthermore, despite global utilization, RIVM has formally **rejected** the incorporation of AVS/SEM thermodynamics, choosing to rely exclusively on Species Sensitivity Distributions (SSDs) and bulk background normalization.

---

## References

*   [US EPA: Equilibrium Partitioning Sediment Benchmarks for the Protection of Benthic Organisms](https://www.epa.gov/sites/default/files/2015-08/documents/equilibrium_partitioning_sediment_benchmarks_for_the_protection_of_benthic_organisms_metal_mixtures.pdf)
*   [CCME: Canadian Sediment Quality Guidelines for the Protection of Aquatic Life](https://ccme.ca/en/resources/sediment)
*   [ANZG: Australian and New Zealand Guidelines for Fresh and Marine Water Quality](https://www.waterquality.gov.au/anz-guidelines)

---

**See also:** Test specific values for this pathway in the **Calculator** tab (eco-direct-eqp pathway).
