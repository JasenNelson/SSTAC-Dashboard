# Case Study: Bioaccumulation Frameworks (BSAF)

**Purpose:** This case study covers Biota-Sediment Accumulation Factor (BSAF) methodology and trophic transfer modeling for deriving food-web sediment values, including the human-health fish-consumption back-calculation pattern used by SWRCB and OEHHA. Reference for the Phase 2 (2026) Matrix Sediment Standards Derivation Options Analysis.

This case study examines the mathematical architectures used by environmental regulatory bodies, specifically the **California State Water Resources Control Board (SWRCB)** and the **Office of Environmental Health Hazard Assessment (OEHHA)**, to derive human health risk criteria for sediment through the aquatic food web. 

Unlike direct exposure pathways, bioaccumulation modeling requires a complex inverse methodology: risk assessors must first calculate a safe biological tissue threshold for consumed fish, and then back-calculate the allowable abiotic sediment concentration utilizing thermodynamic partition ratios.

---

## Deriving Target Tissue Thresholds: Fish Contaminant Goals (FCGs)

The operational foundation of the back-calculation framework begins with establishing precise **Fish Contaminant Goals (FCGs)**. These goals represent the target tissue concentration at which human consumption equates to an established physiological toxicological limit. 

### Carcinogenic Endpoints
For stochastic carcinogenic effects, the target tissue concentration limit ($FCG_{carcinogen}$) is derived using a designated target risk probability level alongside standard deterministic anthropometric variables:

$$ FCG_{carcinogen} = \frac{TRL \times BW \times 1000}{CSF \times CR \times \left(\frac{ED}{AT}\right) \times CRF} $$

*   **$TRL$ (Target Risk Level):** Frequently set at $1 \times 10^{-6}$ (a one-in-a-million excess cancer risk).
*   **$CSF$ (Cancer Slope Factor):** Represents the chemical's specific carcinogenic potency.
*   **$CRF$ (Cooking Reduction Factor):** To enforce maximum conservatism, recent frameworks have shifted this variable to **$1.0$**, functionally assuming no contaminant mass is lost during domestic food preparation.

### Non-Carcinogenic Systemic Toxicity
For chemicals exhibiting deterministic, non-carcinogenic toxicity (where biological damage operates on a threshold basis), the lifetime amortization variables ($ED/AT$) are mathematically eliminated. The acceptable physiological threshold is governed entirely by the **Reference Dose ($RfD$)**:

$$ FCG_{non-carcinogen} = \frac{RfD \times BW \times 1000}{CR} $$

The absence of the temporal variables indicates that the hazard is evaluated strictly on **chronic daily intake ceilings**, ensuring that the total daily physiological exposure does not exceed the capacity to safely metabolize the contaminant.

---

## The Biota-Sediment Accumulation Factor (BSAF)

To bridge the physiological biological limit back to the physical geologic sediment matrix, risk assessors utilize the **Biota-Sediment Accumulation Factor (BSAF)**. This specialized, unitless ratio quantifies the thermodynamic partitioning and subsequent trophic biomagnification of a contaminant as it transfers from sediment into an organism's tissue.

The primary operational equation for the bulk accumulation factor is:

$$ BSAF = \frac{C_{tissue}}{C_{sediment}} $$

### Lipid and Organic Carbon Normalization
Because the phase partitioning of highly hydrophobic organic contaminants (like PCBs and DDTs) depends heavily upon the lipid fractions within biological tissue and the organic carbon fractions within the sediment matrix, deterministic frameworks frequently mandate mathematical normalization:

$$ BSAF_{normalized} = \frac{C_{tissue} / f_{lipid}}{C_{sediment} / f_{oc}} $$

*   **$f_{lipid}$:** Adjusts for the target species' edible muscle tissue fat content.
*   **$f_{oc}$:** Inversely adjusts for the Total Organic Carbon (TOC) mass fraction inherent to the benthic matrix that binds organic toxicants.

---

## Target Sediment Threshold Back-Calculation

The terminal mathematical objective is to actively isolate the maximum permissible bulk sediment concentration limit ($C_{sed}$). By algebraically rearranging the BSAF ratio and directly substituting the human-health derived $FCG$ for the estimated tissue concentration variable, risk assessors derive the critical **Tier 1 Sediment Threshold**:

$$ C_{sed} = \frac{FCG}{BSAF} $$

In this definitive equation, the regulatory sediment screening threshold ($C_{sed}$) represents the ultimate abiotic target concentration. The denominator actively utilizes the **highest available guild-specific BSAF** (e.g., piscivorous vs. benthic-foraging species) to enforce maximum mathematical conservatism.

---

## Advanced Probabilistic Site-Linkage Models

In **Tier 2 assessments**, static constants are replaced with complex spatial and probabilistic models to evaluate highly variable environmental conditions. The site-linkage bioaccumulation algorithm operates via the following integration:

$$ C_{tissue} = \sum \left( C_{sed, spatial} \times SUF_{spatial} \right) \times BSAF_{species} $$

*   **Lognormal Distribution:** Integrates the continuous variability of the sediment concentration ($C_{sed, spatial}$).
*   **Site Use Factor ($SUF_{spatial}$):** Mathematically calculates the fractional area the target species actually forages within the contaminated boundary versus clean, off-site zones.

Executed computationally across massive Monte Carlo simulations, this spatial integration confirms whether the theoretical deterministic back-calculation legitimately holds true under complex ecological loading dynamics and structural variability.

---

## References

*   [OEHHA: Fish Contaminant Goals and Advisory Tissue Levels](https://oehha.ca.gov/fish/fish-contaminant-goals-and-advisory-tissue-levels)
*   [SWRCB: Water Quality Control Plan for Enclosed Bays and Estuaries - Sediment Quality](https://www.waterboards.ca.gov/water_issues/programs/bptcp/sediment.html)

---

**See also:** Test specific values for this pathway in the **Calculator** tab (eco-food-bsaf and human-health-food pathways).
