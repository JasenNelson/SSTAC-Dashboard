# The Guide: TWG Onboarding & Project Overview

Welcome to the collaborative workspace for the Technical Working Group (TWG). This dashboard is designed to facilitate transparent, data-driven discussions regarding the modernization of sediment quality standards.

---

## 1. The 2026 Objective

The primary objective of this phase is to research, synthesize, and develop the **Matrix Sediment Standards Derivation Options Paper for BC**. As sediment contamination operates across highly complex ecological and human pathways, a one-size-fits-all approach is insufficient. Our goal is to leverage advanced mathematical derivations, localized exposure vectors, and international best practices to engineer a flexible, multi-dimensional policy framework that adequately protects both apex ecological receptors and highly-exposed human populations.

---

## 2. How to Use This Workspace

This dashboard serves as the central hub for policy review, mathematical analysis, and active TWG collaboration. Navigate through the top tabs to access specific project components:

*   **Conceptual Model:** Explore the visual architecture of the four matrix quadrants. This section outlines the structural pathways connecting the benthic environment to both Ecological and Human Health endpoints.
*   **Jurisdictional Frameworks:** Drill down into the specific mathematical derivations used by major regulatory bodies. You can toggle the sidebar to review how the US EPA (EqP & AVS/SEM), the California SWRCB (BSAF back-calculations), and Indigenous frameworks (WQCIU) handle complex exposure variables and thermodynamic ratios.
*   **Interactive Map:** Work directly with the embedded province-wide sediment map. The map now renders sample points, honest partial-visibility counts for hidden private-DRA rows, identify results in the left panel, selection stats, medium controls, and a Measurement Workbench in the right panel. The workbench supports a resizable/focused table view, measurement filters, substance multi-select, CSV export, and map marker filtering from the full matching result set rather than from the current table page. The future Calculator bridge remains deferred, so map findings are observational and do not silently write values into the Calculator.
*   **Calculator:** Derive a Preliminary Toxicity-Based Standard for a site under review. Pick one of four matrix categories at the top (Ecological: Direct Contact via EqP; Ecological: Food Web via BSAF; Human Health Direct Contact; Human Health Food Web), choose a substance and a jurisdictional frame, then read the prominent hero result with the full chain of reasoning available under a collapsible Technical details disclosure. A Background Adjustment panel below the calculator lets the reviewer apply a Provincial or Regional UTL post-derivation, transparent adjustment. The left sidebar now provides a tiered Calculator Guide for General, Practitioner, and Technical audiences.
*   **TWG Review:** Utilize this active workspace to provide formal evaluation and feedback. The dynamic "Quick Reference / Polls" tray on the right side of your screen allows you to vote on key derivation variables (e.g., AVS/SEM molar valency multipliers) in real-time during our working sessions.

---

## 3. Project Roadmap

To ensure rigorous scientific review and policy alignment, the project will follow a structured developmental timeline:

*   **Phase 1: Discovery & Synthesis**
    *   Ingestion of international policy derivations (US EPA, CCME, ANZG, RIVM).
    *   Translation of raw mathematical frameworks into accessible TWG case studies.
    *   *Status: Complete*
*   **Phase 2: TWG Review & Polling**
    *   Active dashboard collaboration.
    *   Review of proposed derivation options and localized parameter modifications (e.g., Indigenous consumption rates).
    *   *Status: In Progress*
*   **Phase 3: Final Options Paper Drafting**
    *   Consolidation of TWG feedback.
    *   Final formulation of the Matrix Sediment Standards Derivation Options Paper for implementation.
    *   *Status: Pending*

---

## 4. Recently Added on the Calculator Tab

*   **Four-category selector at the top.** A horizontal row of buttons -- Ecological: Direct Contact, Ecological: Food Web, Human Health: Direct Contact, Human Health: Food Web -- lets the reviewer pick the regulatory pathway under review. Ecological categories ship with full calculators; the two Human Health categories ship with methodology-gated panels that explain why numeric HH output is intentionally blocked until the exposure assumptions, receptor assumptions, and endpoint mapping are signed off. The real HH calculators are deferred to a future slice.
*   **Shared substance and jurisdictional frame controls.** The substance dropdown and jurisdiction selector below the category row are now global: changing either applies to whichever calculator is active. The substance default re-seeds the per-pathway library values (FCV for Eco-Direct; TRV and BSAF for Eco-Food) automatically; if you edit a field manually a "User override" badge appears with a Reset button that re-syncs to the library value.
*   **Preliminary Toxicity-Based Standard hero card.** The calculator's prominent result is now labeled "Preliminary Toxicity-Based Standard" (not the bare "SedS" identifier) and includes a PASS/FAIL verdict pill when a measured sediment concentration is provided. The label and the in-card disclaimer make it explicit that the value is preliminary -- HITL professional judgment plus the Background Adjustment panel determine the final defensible standard.
*   **Technical details disclosure.** The formula, intermediate quantities, and screening warnings now live in a collapsible disclosure below the hero so reviewers see the bottom-line result first and can drill into the math on demand.
*   **Tiered Calculator Guide.** The left sidebar provides General, Practitioner, and Technical guide modes. The selection persists across visits so reviewers can keep the level of detail that matches their current task.

---

## 4.5 Background Adjustment Panel

A **Background Adjustment** panel renders below every active calculator so the Preliminary Toxicity-Based Standard from section 4 above is never set lower than what would already occur naturally on a regional reference site. This matters because for some substances the natural background concentration in BC sediments exceeds the Tier 1 lookup value -- without an adjustment, the regulator-facing threshold would be impossible to meet at sites whose contamination is indistinguishable from background.

*   **What the panel computes.** The reviewer pastes (or accepts the seeded defaults for) a list of comma- or whitespace-separated reference-set concentrations in mg/kg. The panel computes the sample mean, the (n - 1) standard deviation, and the one-sided 95 percent coverage / 95 percent confidence tolerance factor `K` for the sample size `n`, then surfaces the upper tolerance limit `UTL_{95/95} = mean + K * sd` as a hero card. `K` is looked up by linear interpolation from a small NIST/SEMATECH e-Handbook 7.2.6.3 table (n = 5, 10, 20, 30, 50, 100) stored in `src/lib/matrix-options/utlTable.ts`; values for `n` outside the tabulated range are clamped and flagged with a K-factor screening qualifier banner. For regulatory submissions the assessor should compute `K` exactly from the noncentral t-distribution rather than relying on this lookup.
*   **The max(Tier 1 generic, UTL) adjustment rule.** Per BC CSR practice (Phase 2 Paper Appendix D.4), the regulator-facing adjusted standard is `max(Tier 1 generic, UTL)`. The Background Adjustment panel surfaces the UTL hero card and the literal adjustment string ("Apply as adjustment: max(Tier 1 generic, ...)") so the reviewer can read the adjusted value off the panel directly. If the measured site concentration `C_s` is provided, the panel also tells the reviewer whether `C_s` is at or below the active scope's UTL -- diagnostic only; it does NOT determine compliance, which always runs against `max(Tier 1 generic, UTL)`.
*   **Provincial vs Regional scope.** A radio group switches the panel between a BC province-wide reference set (fallback when regional reference data is unavailable) and a site-specific Regional reference set (preferred where geochemical equivalence is met). Both reference sample sets are persisted across scope flips so flipping the radio does not lose the reviewer's work.
*   **Censored data handling (v1).** Censored values (below detection limit) are substituted at one-half of the detection limit before they enter the mean and standard deviation calculation. This `1/2 DL` substitution is a screening-grade convention; v1.x will graduate to a ROS (regression on order statistics) estimator under ProUCL.
*   **Screening-only label.** Every UTL the panel produces is labeled "screening-only -- not regulator-submission-grade" per R-4 and R-8 of the matrix-options scope. The label propagates through the K-factor qualifier banner, through Matrix Map selection stats, and through any future Calculator bridge audit token. The label is lifted only when ProUCL validation lands in v1.x and the R-13 methodology appendix sign-off gate has been cleared.
*   **Full methodology.** The complete UTL methodology -- censoring policy, ROS-vs-substitution flag, K-factor source, screening-vs-submission posture, and the contract for the future map-to-Calculator bridge token -- remains a methodology-gated item before regulator-submission-grade use.

---

## 5. Coming Soon

*   **Human Health calculators** (Direct Contact + Food Web). The HH category buttons are already live and route to methodology-gated panels; the real calculators replace those panel bodies in a future slice without re-routing the UI surface.
*   **Map-to-Calculator bridge.** The Interactive Map and Measurement Workbench are live as observational tools. A later bridge can carry selected map context into the Calculator only after audit and methodology gates are complete.
