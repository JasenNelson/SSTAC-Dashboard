# The Guide: Matrix Options Workspace

This workspace supports the 2026 Matrix Sediment Standards Derivation Options Analysis for British Columbia. It brings the scientific framework, jurisdictional examples, map data, screening calculators, and Technical Working Group review tools into one place.

Use it to test options, compare pathways, and record review feedback. Calculator outputs are screening-level results, not final sediment standards.

---

## 1. How to Use This Workspace

Use the top tabs to move between the main review surfaces:

*   **The Guide** gives the project context, workflow, and key terms.
*   **Conceptual Model** explains how exposure pathways, receptors, and site conditions fit together.
*   **Jurisdictional Frameworks** compares examples from other regulatory programs.
*   **Interactive Map** shows available sediment sample locations and measurements.
*   **TWG Review** records Technical Working Group feedback on the options under review.
*   **Calculator** estimates preliminary values for ecological and human-health pathways.

A typical review flow is: read the Guide, check the conceptual model, compare jurisdictional approaches, inspect data on the map, test assumptions in the Calculator, then record feedback in TWG Review.

---

## 2. Project Roadmap

The sediment standards modernization work is moving through three broad phases:

*   **Phase 1 (2025): Scientific Framework Development**
    *   Included a Scientific Literature Search and Jurisdictional Scan.
    *   Collaboratively developed the scientific framework for developing modern sediment standards.
    *   Multi-faceted engagement informed the strategic phased approach currently underway.
*   **Phase 2 (2026): Foundational Research**
    *   Supports the Matrix Sediment Standards Derivation Options Analysis.
    *   Supports development of a scientific model for bioavailability adjustment, such as the Bayesian Network Relative Risk Model.
    *   Uses jurisdictional review, data analysis, calculators, map review, and Technical Working Group feedback to test practical derivation options.
*   **Phase 3 (2027): Framework Development and Prioritized Standards**
    *   May include development of Matrix Sediment Standards Derivation Frameworks.
    *   May end with new sediment standards for prioritized substances.
    *   Continues research and database development needed to support defensible standards over time.

---

## 3. Reviewer Checklist

Calculator outputs are preliminary screening results. They are useful for comparing options, testing assumptions, and identifying where a method needs more review. They are not final sediment standards.

Before relying on a result or submitting feedback:

*   Confirm the selected substance, pathway, and jurisdictional frame.
*   Check whether the result is driven by direct exposure, food-web exposure, or background.
*   Review warnings, assumptions, and technical details when a value changes materially.
*   Use the map to understand what data are available for the substance and medium.
*   Treat the Background Adjustment panel as a final reasonableness check, not a replacement for the pathway calculation.

---

## 4. Key Terms

*   **AVS/SEM**: Acid volatile sulfide and simultaneously extracted metals. A chemistry comparison used in some sediment bioavailability approaches.
*   **BC**: British Columbia.
*   **BN-RRM**: Bayesian Network Relative Risk Model. A probabilistic model being developed to support bioavailability adjustment.
*   **BSAF**: Biota-sediment accumulation factor. A value used to link sediment concentrations with tissue concentrations in food-web calculations.
*   **EqP**: Equilibrium partitioning. A method that estimates sediment values from water-quality toxicity benchmarks and sediment chemistry.
*   **Jurisdictional Scan**: Review of how other regulatory programs approach sediment standards, exposure pathways, and receptor protection.
*   **Matrix sediment standards**: A standards approach that considers more than one exposure pathway, receptor group, or site condition instead of relying only on a single generic value.
*   **Scientific Literature Search**: Review of technical and scientific sources used to support the framework and identify relevant methods.
*   **TRV**: Toxicity reference value. A dose or concentration used to evaluate potential effects for a receptor.
*   **Technical Working Group (TWG)**: The review group providing technical input on the sediment standards modernization work.
*   **Upper tolerance limit (UTL)**: A statistical estimate used to describe an upper bound for background concentrations.
*   **Screening-grade**: Useful for options analysis and internal review, but still requires professional judgment before regulator-facing use.

---

## 5. Calculator References and Provenance

Every active calculator now has a bottom-of-panel **References and provenance** disclosure. It shows the values used in the current calculation, whether each value is a source-backed default, user-entered value, derived value, or screening assumption, and the source/equation records currently linked to that value.

The provenance catalog is repo-managed under `matrix_research/reference_catalog/` and is intentionally metadata-only. It stores source IDs, citation fields, Zotero item-key placeholders, equation records, current calculator parameter records, extraction status, QA status, and review notes. It does not store PDFs, datasets, Word files, Zotero attachments, or other source reference files.

Zotero remains the reference manager and file vault. Google Drive and OneDrive reference folders can be inventoried as external source locations, but source files are not copied into the app repo or Supabase. Future Supabase work may mirror structured metadata for querying, but source files stay outside Supabase unless the owner explicitly changes that policy.

Starter calculator values lifted from the current substance library are not automatically "approved." Values that were already marked as placeholders, such as the B[a]P ecological TRV and the PCB FCV screening placeholder, are marked `needs_owner_review` in the catalog until the first source batch is extracted and reviewed.
