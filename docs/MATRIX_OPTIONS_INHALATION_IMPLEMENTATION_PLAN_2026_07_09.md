# Matrix Options: Inhalation Schema Implementation Plan (2026-07-09)

## Executive Summary
This design packet outlines the finalized data schema, component routing, and execution plan for integrating inhalation endpoints into the Matrix Options calculator suite. **This is a docs-only design deliverable representing implementation readiness.** No runtime code or UI components are wired in this PR.

## 1. Current Type and Data Limitations
Presently, `SubstanceEntry` in `src/lib/matrix-options/types.ts` is strictly tailored for direct contact (oral/dermal) and eco-food pathways. It lacks the fields required to handle inhalation pathways, specifically RfC (Reference Concentration) and IUR (Inhalation Unit Risk).

Furthermore, existing calculators (`HHDirectContactCalculator`, `HHFoodWebCalculator`) inherently assume mass-based exposure (mg/kg/day) and rely on oral absorption (`ba_oral`) and dermal absorption (`abs_dermal`) factors, which are completely inapplicable to inhalation exposure (mg/m3).

## 2. Exact Candidate Fields
The following fields must be appended to `SubstanceEntry` and the backend `SubstanceRow` definitions:

1. **`rfc_inhalation_mg_per_m3` (number | null)**
   - Represents the non-cancer Reference Concentration (RfC).
   - Required for evaluating non-cancer hazard quotients via inhalation.
2. **`iur_inhalation_per_mg_per_m3` (number | null)**
   - Represents the Inhalation Unit Risk (IUR) for carcinogenic effects.
   - Required for evaluating incremental lifetime cancer risk via inhalation.

## 3. Pathway Routing Model
The inhalation pathway involves fundamentally different transport models (e.g., vapor intrusion, particulate emission) and receptor exposure parameters (e.g., inhalation rate) compared to oral/dermal contact.

**Routing Architecture:**
- **New Component**: A dedicated `HHInhalationCalculator` will be created.
- **Component Isolation**: It will not share derivation logic with `HHDirectContactCalculator`.
- **UI Integration**: Within `MatrixMapRightPanel`, `HHInhalationCalculator` will be rendered conditionally (likely as a distinct tab or via the `viewMode` toggle) alongside Direct Contact and Food Web. `SubstanceCombobox` and `SharedGlobalInputs` will remain shared to preserve context.

## 4. Fail-Closed Behavior
To ensure safety and prevent erroneous derivations:
- `rfc_inhalation_mg_per_m3` and `iur_inhalation_per_mg_per_m3` will strictly default to `null`.
- The `HHInhalationCalculator` will explicitly check for `null` values on a per-derivation basis. If `rfc_inhalation_mg_per_m3` is `null`, the non-cancer hazard quotient derivation must return a `blocked = true` state. If `iur_inhalation_per_mg_per_m3` is `null`, the incremental lifetime cancer risk derivation must return a `blocked = true` state.
- **No Risk Summation**: Inhalation risk will *not* be summed with oral/dermal risk at the individual calculator level. Multi-pathway aggregation is reserved for the engine-v2 cumulative capabilities.

## 5. Test Plan
Before merging the runtime code, the following test coverage must be provided:
1. **Type Definitions**: Assert `rfc_inhalation_mg_per_m3` and `iur_inhalation_per_mg_per_m3` types are enforced as `number | null`.
2. **Fail-Closed Logic**: Unit tests for `HHInhalationCalculator` asserting that supplying a substance with `null` inhalation values yields a gracefully blocked state.
3. **Calculation Integrity**: Unit tests asserting HQ and ILCR derivations match known verified test cases using golden fixtures.
4. **UI Isolation**: Component tests asserting `HHInhalationCalculator` does not leak state into or read state from `HHDirectContactCalculator`.

## 6. Migration and Catalog Implications
The addition of these fields will require a schema migration in Supabase.
The `matrix_map_data_ingestion` pipelines will need to be updated to map and seed `rfc_inhalation_mg_per_m3` and `iur_inhalation_per_mg_per_m3` from the underlying regulatory catalogs (e.g. US EPA IRIS, Health Canada).

## 7. Owner Decisions Needed Before Value Ingestion
Before values are actively ingested into the library, the owner must decide:
- **Volatilization Factors**: How will soil-to-air volatilization factors (VF) or particulate emission factors (PEF) be handled? Will they be dynamically calculated, supplied by the user, or hardcoded per regulatory frame?
- **Pathway Exclusions**: Will the UI allow disabling the inhalation pathway entirely for specific jurisdictions that do not assess it independently?
- **Data Provenance**: Confirm which source catalogs (e.g., IRIS, HC TRV v4.0) are approved as the canonical sources for RfC and IUR values.
