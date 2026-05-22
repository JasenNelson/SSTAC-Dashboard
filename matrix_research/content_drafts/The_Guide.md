# The Guide: Matrix Options Workspace

This workspace supports the 2026 Matrix Sediment Standards Derivation Options Analysis for British Columbia. It brings the current scientific framework, jurisdictional examples, map data, calculators, and Technical Working Group review tools into one place.

The dashboard is a working analysis environment. Some tools already calculate screening values. Some tools show methodology-gated pathways where the science is still under review. The goal is to make that distinction obvious, so reviewers can use the live tools without mistaking a screening result for a final sediment standard.

---

## 1. Project Roadmap

The sediment standards modernization work is moving through three broad phases:

*   **Phase 1 (2025): Scientific Framework Development**
    *   Developed the scientific foundation for considering matrix sediment standards.
    *   Organized the main exposure pathways, receptor groups, and decision points.
    *   Established the framework that the current options analysis builds on.
*   **Phase 2 (2026): Foundational Research**
    *   Supports the **Matrix Sediment Standards Derivation Options Analysis**.
    *   Supports development of a scientific model for bioavailability adjustment, such as the **Bayesian Network Relative Risk Model (BN-RRM)**.
    *   Uses jurisdictional review, data analysis, calculator prototypes, map review, and Technical Working Group feedback to test practical derivation options.
*   **Phase 3 (2027): Framework Development and Prioritized Standards**
    *   May include development of Matrix Sediment Standards Derivation Frameworks.
    *   May end with new sediment standards for prioritized substances.
    *   Continues research and database development needed to support defensible standards over time.

---

## 2. How to Use This Workspace

Use the top tabs to move between the main review surfaces. Each tab is meant to answer a different question.

*   **Conceptual Model** explains the structure of the matrix approach. Use it first when you need to understand the exposure pathways and why a single generic sediment number may not be enough.
*   **Jurisdictional Frameworks** compares examples from other regulatory programs. Use it to see how different jurisdictions handle sediment chemistry, bioavailability, food-web exposure, and receptor protection.
*   **Interactive Map** shows available sediment sample locations and measurements. Use the map to inspect samples, filter the Measurement Workbench, export current views, and understand where available data are complete or incomplete.
*   **Calculator** estimates preliminary, screening-level values for active derivation pathways. Use it to test assumptions, compare pathway-specific results, and see the calculation steps. Human Health pathways are visible in the same interface, but numeric results remain methodology-gated until the exposure assumptions and endpoint mapping are signed off.
*   **TWG Review** supports Technical Working Group feedback. Use it for structured review, voting, and discussion of key assumptions.

The workspace is designed so the map, calculators, and review tools can be read together. For example, a reviewer can inspect measurements on the map, test a screening calculation, then record feedback in the review tab.

---

## 3. What Is Working Now

The current dashboard includes:

*   A visual conceptual model for the matrix approach.
*   Jurisdictional comparison material for sediment standards methods.
*   A province-wide sediment map with sample selection, visible/private-data indicators, medium controls, and a Measurement Workbench.
*   A Measurement Workbench with table scrolling, focused view, substance filtering, CSV export, and map marker filtering based on the full active filter result set.
*   Ecological calculator pathways for direct contact and food-web screening calculations.
*   A Background Adjustment panel that compares preliminary values with provincial or regional upper tolerance limits.
*   Methodology-gated Human Health panels for direct contact and food-web pathways.
*   A tiered Calculator Guide for general, practitioner, and technical audiences.
*   Technical Working Group review and polling tools.

---

## 4. Reading Calculator Results

Calculator outputs are preliminary screening results. They are useful for comparing options, testing assumptions, and identifying where a method needs more review. They are not final sediment standards.

When reading a calculator result:

*   Start with the large result card.
*   Check whether the pathway is fully active or methodology-gated.
*   Open the technical details only when you need the formula and intermediate values.
*   Review the Background Adjustment panel if natural or regional background concentrations may be higher than the generic screening value.
*   Treat warnings and qualifiers as part of the result, not as fine print.

The Background Adjustment panel applies the practical rule that a screening value should not be lower than an appropriate background concentration estimate. This keeps the tool aligned with the reality that some substances can occur naturally at concentrations above a generic Tier 1 value.

---

## 5. Key Terms

*   **BC**: British Columbia.
*   **BN-RRM**: Bayesian Network Relative Risk Model. A probabilistic model being developed to support bioavailability adjustment.
*   **Matrix sediment standards**: A standards approach that considers more than one exposure pathway, receptor group, or site condition instead of relying only on a single generic value.
*   **Technical Working Group (TWG)**: The review group providing technical input on the sediment standards modernization work.
*   **Upper tolerance limit (UTL)**: A statistical estimate used to describe an upper bound for background concentrations.
*   **Methodology-gated**: Visible in the workspace, but not yet allowed to produce final numeric output because the underlying scientific assumptions still need review or sign-off.
