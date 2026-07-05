# AGY 15-Hour Execution Plan: Matrix-Options Integrity, Coverage, and Decision-Prep

This execution plan outlines the concrete, ordered batches to be shipped for the three work streams defined in the brief AGY_AUTONOMOUS_15H_BRIEF_2026_07_04.md. It ensures all changes are safe, doc-truth only, properly gated, and non-disruptive.

Total Batches: 12

---

## Work Stream A: Whole-Library Provenance and Consistency Audit

Goal: Verify all 424 entries in SUBSTANCE_LIBRARY against approved catalogs. Author a read-only audit script, generate a findings document, and fix doc-truth issues in safe, path-scoped batches. Never change any wired toxicity values.

### Batch A1: Audit Script and Verification Suite
- **Scope**: Author the read-only audit script and its accompanying test file. The script will compare SUBSTANCE_LIBRARY entries against the approved catalogs.
  - Checks value consistency: verifies every non-null rfd_oral and sf_oral value matches one or more approved catalog rows for that substance_key, pathway=human-health-direct, and the matching input_key.
  - Concordant handling: if a value matches multiple approved rows that all share the same value (e.g. concordant US EPA and Health Canada rows), it is classified as a valid match. It reports entries with 0 matches (drift) or matches against differing approved values (conflict).
  - Checks citations: flags entries where sources do not cite the parameter_value_id of the matching catalog row.
  - Checks notes consistency: flags entries with stale notes (e.g., "HH RfD not wired" when the value is non-null).
  - Checks enum/field types: verifies contaminantClass is a valid enum value and abs_dermal/ba_oral are present.
- **Files Touched**:
  - `scripts/matrix-options/audit-library-provenance.mjs`
  - `tests/matrix-options/audit-library-provenance.test.ts`
- **Acceptance Checks**:
  - Run `node scripts/matrix-options/audit-library-provenance.mjs --test-run` to output verification results to a temporary target `.tmp/audit_integrity_test_run.json`.
  - `npx vitest run tests/matrix-options/audit-library-provenance.test.ts` passes.
  - `npx tsc --noEmit` returns 0 errors.

### Batch A2: Generate Audit Findings Document
- **Scope**: Run the audit script in production mode to produce the final findings document under the official path. Divide findings clearly into:
  - SAFE-TO-FIX (missing citations to append, stale notes to update).
  - OWNER-GATED (value mismatch, multiple competing approved rows with differing values, or owner-gated substances).
- **Files Touched**:
  - `docs/MATRIX_OPTIONS_INTEGRITY_AUDIT_2026_07_04.md`
- **Acceptance Checks**:
  - Run `node scripts/matrix-options/audit-library-provenance.mjs` to write `docs/MATRIX_OPTIONS_INTEGRITY_AUDIT_2026_07_04.md`.
  - Verify that the audit findings file is generated and contains the expected structured Markdown. No code is modified in this batch.

### Batch A3: Safe-To-Fix Implementation - Cohort 1 (Substances a-g)
- **Scope**: Apply doc-truth corrections (sources appending and notes updates only) for substances starting with a-g as listed in the SAFE-TO-FIX list of Batch A2. No value changes are made.
- **Files Touched**:
  - `src/lib/matrix-options/substanceLibrary.ts`
- **Acceptance Checks**:
  - `npx tsc --noEmit` returns 0 errors.
  - `npx vitest run substanceLibrary.test.ts` passes.
  - `npx eslint src/lib/matrix-options/substanceLibrary.ts` passes.

### Batch A4: Safe-To-Fix Implementation - Cohort 2 (Substances h-p)
- **Scope**: Apply doc-truth corrections for substances starting with h-p. No value changes are made.
- **Files Touched**:
  - `src/lib/matrix-options/substanceLibrary.ts`
- **Acceptance Checks**: Same as Batch A3.

### Batch A5: Safe-To-Fix Implementation - Cohort 3 (Substances q-z)
- **Scope**: Apply doc-truth corrections for substances starting with q-z. No value changes are made.
- **Files Touched**:
  - `src/lib/matrix-options/substanceLibrary.ts`
- **Acceptance Checks**: Same as Batch A3.

### Batch A6: Re-run Audit and Verify Clean State
- **Scope**: Re-run the audit script to generate an updated findings document. Confirm that the SAFE-TO-FIX section of the findings document is completely empty.
- **Files Touched**:
  - `docs/MATRIX_OPTIONS_INTEGRITY_AUDIT_2026_07_04.md`
- **Acceptance Checks**:
  - Run `node scripts/matrix-options/audit-library-provenance.mjs` to write `docs/MATRIX_OPTIONS_INTEGRITY_AUDIT_2026_07_04.md`.
  - Verify that the SAFE-TO-FIX section in `docs/MATRIX_OPTIONS_INTEGRITY_AUDIT_2026_07_04.md` contains 0 entries (completely empty findings).
  - No code changes are introduced in this batch.

---

## Work Stream B: Meaningful Test-Coverage Hardening

Goal: Add comprehensive unit and integration tests pinning the real behavior of under-covered matrix-options files. Measure and log before/after coverage per batch.

### Batch B1: Provenance Resolver Cascades and Pathway Scoping
- **Scope**: Add unit and integration tests for `src/lib/matrix-options/provenance/resolver.ts`. Focus on:
  - `resolveTupleRecord` tie-break cascade: single value-match -> current_default -> single approved -> frame-jurisdiction rank -> null fallback.
  - Pathway scoping checks: hh-direct vs hh-food with identical values.
  - Value-match tolerance behavior (margins of float comparison).
- **Files Touched**:
  - `src/lib/matrix-options/provenance/__tests__/resolver.integration.test.ts`
- **Acceptance Checks**:
  - `npx vitest run resolver.integration.test.ts` passes.
  - Record and verify that coverage of `resolver.ts` increases.

### Batch B2: Frame Defaults Gating and Filtering
- **Scope**: Add tests for `src/lib/matrix-options/frameDefaults.ts`. Focus on:
  - Gating behavior: verify `needs_review` promotes to `pending` and never drives calculation.
  - Rejection of substance-specific rows for generic-only definitions.
- **Files Touched**:
  - `src/lib/matrix-options/__tests__/frameDefaults.test.ts`
- **Acceptance Checks**:
  - `npx vitest run frameDefaults.test.ts` passes.
  - Record coverage increase for `frameDefaults.ts`.

### Batch B3: Eco-Seed Priority, Eligibility, and Fallbacks
- **Scope**: Add tests for `src/lib/matrix-options/ecoSeed.ts`. Focus on:
  - Source priority ranking by jurisdiction.
  - Provisional eligibility gate logic.
  - Fallback sequence when dynamic lookup fails (falling back to static fields in substanceLibrary).
- **Files Touched**:
  - `src/lib/matrix-options/__tests__/ecoSeed.test.ts`
- **Acceptance Checks**:
  - `npx vitest run ecoSeed.test.ts` passes.
  - Record coverage increase for `ecoSeed.ts`.

### Batch B4: Derivations Endpoint Selection and Unit Normalization
- **Scope**: Add tests for `src/lib/matrix-options/derivations.ts` and `src/lib/matrix-options/unitNormalization.ts`. Focus on:
  - `pickHumanHealthEndpoint`: cancer SF vs non-cancer RfD conservativeness selection.
  - Normalization cases (unit handling logic).
- **Files Touched**:
  - `src/lib/matrix-options/__tests__/derivations.test.ts`
  - `src/lib/matrix-options/__tests__/unitNormalization.test.ts`
- **Acceptance Checks**:
  - Run target tests.
  - Record coverage increase.

### Batch B5: Calculator Seeding and Component Provenance Tests
- **Scope**: Add component tests for `src/components/matrix-options/` calculators. Focus on:
  - Input-seeding from `findSubstance`.
  - Proper UI construction of the provenance row table.
- **Files Touched**:
  - `src/components/matrix-options/__tests__/matrixOptionsCalculator.test.tsx` (or new component test file).
- **Acceptance Checks**:
  - Run the component tests using Vitest.
  - Verify coverage increase for touched component files.

---

## Work Stream C: Jurisdiction-Conflict Decision-Support Document

Goal: Create a clear decision support document for the owner, analyzing substances where competing values exist. No picks will be made and no code changes will be wired.

### Batch C1: Author Decision-Support Document
- **Scope**: 
  - Generate the latest candidates by running `node scripts/matrix-options/wire-recon.mjs` to create `scripts/matrix-options/_recon/wire_candidates.json`.
  - Parse the generated JSON file for entries with `selection_status: 'jurisdiction_conflict'` (within the `rfd_oral` or `sf_oral` values object).
  - Join these conflict candidates with the approved catalog `matrix_research/reference_catalog/human_health_trv_values.json` matching on `substance_key`, mapped input_key, and value, to look up each competitor's exact `parameter_value_id`.
  - Compile the results into a markdown comparison table for each of the ~18 RfD and ~4 SF candidates, outlining substance_key, value, source_id, jurisdiction, pathway, parameter_value_id, and a note on principles in tension (ECCC/HC/FCSAP > US EPA vs. most protective).
- **Files Touched**:
  - `docs/MATRIX_OPTIONS_JURISDICTION_CONFLICTS_DECISION_SUPPORT_2026_07_04.md`
- **Acceptance Checks**:
  - Verify that the output markdown contains tables for all candidates with all columns populated.
  - No code changes are introduced in this batch.
