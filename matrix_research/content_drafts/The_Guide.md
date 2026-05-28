# The Guide: Matrix Options Workspace

This workspace supports the 2026 Matrix Sediment Standards Derivation Options Analysis for British Columbia. It brings the scientific framework, jurisdictional examples, map data, screening calculators, and Technical Working Group review tools into one place.

Use it to test options, compare pathways, and record review feedback. Calculator outputs are screening-level results, not final sediment standards.

---

## 1. How to Use This Workspace

Use the top tabs to move between the main review surfaces:

*   **The Guide** gives the project context, workflow, and key terms. (2026 scope)
*   **Conceptual Model** explains how exposure pathways, receptors, and site conditions fit together. (2026 scope)
*   **Jurisdictional Frameworks** compares examples from other regulatory programs. (2026 scope)
*   **TWG Review** records Technical Working Group feedback on the options under review. (2026 scope)
*   **Interactive Map** shows available sediment sample locations and measurements. (2027 scope)
*   **Calculator** estimates preliminary values for ecological and human-health pathways. (2027 scope)
*   **SSD Workbench** lets you build species sensitivity distributions for toxicity data review. (2027 scope)
*   **References & Values** shows the repo-local metadata catalog for sources, values, equations, assumptions, and QA states. (2027 scope)

A typical 2026 review flow is: read the Guide, check the conceptual model, compare jurisdictional approaches, test assumptions in the Calculator, and record feedback in TWG Review. The Interactive Map, SSD Workbench, and References & Values surfaces become primary in 2027.

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
    *   Dashboard tabs serving Phase 2: The Guide, Conceptual Model, Jurisdictional Frameworks, TWG Review.
*   **Phase 3 (2027): Framework Development and Prioritized Standards**
    *   May include development of Matrix Sediment Standards Derivation Frameworks.
    *   May end with new sediment standards for prioritized substances.
    *   Continues research and database development needed to support defensible standards over time.
    *   Dashboard tabs serving Phase 3: Interactive Map, Calculator, SSD Workbench, References & Values.

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

Every active calculator now has a bottom-of-panel **References and provenance** disclosure. It stays compact: values used in the current calculation, role, review status, and the first linked source. Use **References & Values** for the larger evidence library.

The provenance catalog is repo-managed under `matrix_research/reference_catalog/` and is intentionally metadata-only. It stores source IDs, citation fields, pending Zotero item keys, equation records, current calculator parameter records, extraction status, QA status, default status, currentness status, applicability, uncertainty, and review notes. It does not store PDFs, datasets, Word files, Zotero attachments, or other source reference files.

Zotero remains the reference manager and file vault. Google Drive and OneDrive reference folders can be inventoried as external source locations, but source files are not copied into the app repo or Supabase. Future Supabase work may mirror structured metadata for querying, but source files stay outside Supabase unless the owner explicitly changes that policy.

Starter calculator values lifted from the current substance library are not automatically "approved." Values that were already flagged as interim screening defaults, such as the B[a]P ecological TRV and the PCB FCV screening value, are marked `needs_owner_review` in the catalog until the first source batch is extracted and reviewed.

---

## 6. HITL Workflow with Evidence Library

The Evidence Library is the workspace surface for linking parameter values back to canonical sources. It supports transparent HITL review by keeping a traceable record of where each value comes from and what QA action has been taken on it.

Six workflows are shipped:

*   **Source registration** via the Add Source form -- register canonical sources (papers, reports, datasets) with citation metadata into the catalog before linking values.
*   **Source-locator entry** -- link an existing parameter value to a registered source with a page, table, or section locator.
*   **QA review workflow** -- HITL reviewers promote candidate values into `approved_source_backed` status after review; verdicts are HITL professional judgments only.
*   **Source-lead triage** -- triage incoming source leads (DOIs, titles, references that surfaced during review) as untriaged, promoted, dismissed, or deferred for later canonical registration.
*   **Zotero integration** -- the workspace reads your local Zotero library (desktop API at `http://localhost:23119`) to surface DOI and title matches when you are registering a source. Zotero integration is read-only; the workspace never writes to your Zotero library.
*   **Cross-pathway audit** -- inspect which sources are cited across multiple pathways (eco-direct, eco-food, hh-direct, hh-food) to spot single-point-of-failure citations.

No value moves to `approved_source_backed` without explicit HITL action. No source is mutated automatically. The Evidence Library is readable by all signed-in TWG members; only admin reviewers can register sources, link locators, promote candidates, or triage source leads.

**Persistence status (as of 2026-05-28):** The QA review workflow persists to Supabase (`promoted_parameter_values` + `parameter_value_reviews`). Source registration, source-locator entry, and source-lead triage are UI-complete but their backing tables (`catalog_sources`, `catalog_evidence_items`, `source_lead_triage`) are pending migration -- actions taken in those workflows do not persist until migrations land. Zotero integration is read-only and does not require a backing table. Cross-pathway audit is an analysis surface; no persistence required.

---

## 7. Onboarding Pointers for New TWG Members

If you are joining the Technical Working Group and opening this workspace for the first time, start here.

*   **Where to start:** Read this Guide top to bottom before navigating to other tabs.
*   **Where to record feedback:** Use the TWG Review tab. It is the designated surface for logging technical input on the options under review.
*   **Where outputs go:** TWG feedback is logged for the project record. The published Matrix Options Paper provides the larger context and formal framing and is distributed separately by the project lead.
*   **Important reminder:** Calculator outputs are screening-grade preliminary values, not final sediment standards. They are useful for comparing options and testing assumptions; professional judgment is required before any regulator-facing use.
*   **Where to ask questions:** Contact the project lead with any questions about scope, process, or how to interpret a result.
