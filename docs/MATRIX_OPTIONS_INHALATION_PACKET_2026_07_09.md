# Matrix Options: Inhalation Schema Design Packet (2026-07-09)

## Executive Summary
This design packet outlines the data schema and component routing requirements for integrating inhalation endpoints into the Matrix Options calculator suite. **This is a docs-only design deliverable. No runtime code or UI components are wired in this phase.**

## Objective
To extend the `SUBSTANCE_LIBRARY` schema and the `matrix-options` routing architecture to support inhalation exposure pathways for both volatile and particulate-bound contaminants, while strictly separating this pathway from the existing mass-based oral/dermal (direct contact) calculator.

## Data Schema Requirements

The `SubstanceRow` in `src/lib/matrix-options/substanceLibrary.ts` must be extended to support inhalation-specific toxicity reference values (TRVs). The required fields are:

1. **`rfc_inhalation_mg_per_m3` (number | null)**
   - Represents the non-cancer Reference Concentration (RfC).
   - Units: $\text{mg/m}^3$
   - Required for evaluating non-cancer hazard quotients (HQ) via inhalation.

2. **`iur_inhalation_per_mg_per_m3` (number | null)**
   - Represents the Inhalation Unit Risk (IUR) for carcinogenic effects.
   - Units: $(\text{mg/m}^3)^{-1}$
   - Required for evaluating incremental lifetime cancer risk (ILCR) via inhalation.

*Note: Inhalation pathways bypass the `abs_dermal` and `ba_oral` factors used in direct contact scenarios. Instead, they rely on breathing rates and site-specific air concentrations (or volatilization factors for soil-to-air models).*

## Component Routing & UX Design

Inhalation risk assessment involves fundamentally different exposure factors (e.g., inhalation rate, lung deposition fraction) and environmental transport models (e.g., soil-to-air volatilization, vapor intrusion) compared to ingestion or dermal contact.

Therefore, the inhalation pathway must be implemented as a **separate, distinct calculator component** rather than being shoehorned into `HHDirectContactCalculator`.

### Proposed Routing

- **Current Direct Contact Component**: `HHDirectContactCalculator` handles ingestion and dermal pathways.
- **New Inhalation Component**: `HHInhalationCalculator` (to be implemented).
- **MatrixMapRightPanel Integration**:
  - The inhalation calculator will be rendered conditionally based on the active `viewMode` or a new tab/toggle within the Human Health dashboard.
  - The `SubstanceCombobox` and `SharedGlobalInputs` will remain shared across all calculators, ensuring context is preserved when switching between Direct Contact, Food Web, and Inhalation pathways.

### Phased Implementation Strategy

1. **Phase 1 (This Packet)**: Schema design and routing strategy approval.
2. **Phase 2**: Add `rfc_inhalation_mg_per_m3` and `iur_inhalation_per_mg_per_m3` to `SubstanceRow` and populate initial values for high-priority volatile organics (e.g., TCE, Benzene) and particulate metals (e.g., Chromium VI) from the validated data catalogs.
3. **Phase 3**: Implement the `HHInhalationCalculator` UI component with corresponding frame-aware derivations.
4. **Phase 4**: Add test coverage and integrate into `MatrixMapRightPanel`.

## Guardrails

- **Do not mix pathways**: Inhalation risk must not be summed with oral/dermal risk within the individual calculators. Cumulative multi-pathway risk calculations are reserved for future engine-v2 capabilities.
- **Schema constraints**: The new fields must default to `null` to safely handle substances lacking inhalation TRVs without triggering false zeros in the calculation logic.
