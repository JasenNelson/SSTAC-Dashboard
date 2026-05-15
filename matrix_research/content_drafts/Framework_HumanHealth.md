# Framework: Human Health and Indigenous Exposure Pathways

Standard deterministic human health risk assessment equations consistently rely on central-tendency exposure variables formulated for generalized regional populations and terrestrial environments. However, when these rigid default parameters are applied to specific geographic jurisdictions heavily reliant on traditional subsistence foraging, or to environments governed by aquatic physical dynamics, they systematically fail to protect the target population. 

This framework outlines the specific mathematical modifications required to account for **high-volume Indigenous traditional food consumption rates** and the unique mechanics of **wetted-sediment dermal contact**.

---

## Mathematical Integration of Indigenous Traditional Dietary Parameters

Standard baseline fish ingestion rates utilized in general federal frameworks are frequently pegged to recreational angler averages, traditionally cited at a low volumetric intake of roughly **17.5 grams per day ($0.0175$ kg/day)**. The **Athabasca Chipewyan First Nation (ACFN) Water Quality Criteria for Indigenous Use (WQCIU)** framework provides the scientific and algebraic modifications required to override these generalized inputs to protect subsistence populations.

The foundational derivation equation for the **Health Risk Criteria ($C_{wqciu}$)** calculates the allowable environmental concentration by dividing the safe physiological capacity by the aggregate volumetric intake:

$$ C_{wqciu} = \frac{TV \times RSC \times BW}{DWI + \sum (FIR_i \times BAF_i)} \times 1000 $$

*   **$TV$ (Toxicity Value):** Defines the physiological dose capacity limit.
*   **$RSC$ (Relative Source Contribution):** Scales back permissible limits to account for independent background exposure pathways.
*   **Denominator (Total Intake):** Calculates the aggregate intake through direct Drinking Water Intake ($DWI$) and indirect food web loading.

### Parameter Isolation: The 388 g/day Multiplier
To accurately model subsistence behavior, the WQCIU framework extracts highly localized statistical survey data. 

*   The default $17.5$ g/day variable is forcefully replaced by a pooled statistical consumption rate of **$388$ grams per day ($0.388$ kg/day)** for the Fish Ingestion Rate ($FIR_i$). 

Because the target environmental threshold ($C_{wqciu}$) is governed by an inverse proportionality to the total ingestion rate denominator, substituting a high-volume $388$ g/day parameter structurally increases the denominator by an order of magnitude. This **exponential expansion fundamentally suppresses** the resulting $C_{wqciu}$ output limit, enforcing a drastically lower allowable concentration threshold in the supporting aquatic matrix to protect the highly-exposed demographic receptor.

---

## Dermal Contact Mechanics and Wetted Sediment Adherence

When evaluating direct exposure pathways, modern guidelines, such as **Health Canada’s Supplemental Guidance on Human Health Risk Assessment of Contaminated Sediments**, strictly isolate the fluid dynamics of aquatic matrices from standard terrestrial dry soil physics.

To calculate the systemic physiological impact, risk assessors formulate the **Instantaneous Dermal Dose per Event ($D_{event}$)**:

$$ D_{event} = C_{sed} \times CF \times AF_d \times ABS_d $$

Where $C_{sed}$ is the contaminant concentration and $ABS_d$ represents the biological absorption fraction. The critical physical variable governing actual mass transfer is the **Dermal Adherence Factor ($AF_d$)**.

### Scaling Adjustments for Aquatic Environments
Unlike dry soils, wetted sediment adherence is governed entirely by capillary action and hydrostatic forces. The framework necessitates a strict mathematical bifurcation between physical sediment states:

1.  **Exposed (Intertidal) Sediments:** Contact with exposed mudflats lacking ambient bulk water creates maximum capillary adhesion. Thick sediment layers persistently bind to the dermis, requiring the highest $AF_d$ multipliers.
2.  **Underwater Bedded Sediments:** Human contact with fully submerged bedded sediments incurs a mathematically lower adherence rate. As the receptor emerges vertically through the water column, hydrostatic forces and turbulent shear continuously wash away the loosely bound particulate mass. 

Applying standard exposed tidal flat $AF_d$ inputs to purely submerged pathways fundamentally violates fluid mechanics. Consequently, the formulas mandate **severe scalar reductions** for submerged contact scenarios. For instance, the $AF_d$ multiplier applied specifically to the feet of adults in submerged bedded sediment scenarios is reduced exponentially by a **factor of 10** relative to standard intertidal values, while adherence to upper body regions is frequently **zeroed out entirely**.

---

## References

*   [Health Canada: Supplemental Guidance on Human Health Risk Assessment of Contaminated Sediments](https://publications.gc.ca/site/eng/9.832535/publication.html)
*   [ACFN: Lower Athabasca Surface Water and Sediment Quality Criteria for Protection of Indigenous Use](https://acfn.com/wp-content/uploads/2023/10/wqciu_report.pdf)
