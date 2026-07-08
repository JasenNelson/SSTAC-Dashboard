# Matrix Options Next Lane Recommendation - 2026-07-08

## 1. Complete Work
- **Phase B:** Merged and GREEN.
- **Phase A3 (DL-PCB TEQ parallel screening card):** PR #545 is merged, CI is GREEN, and visual QA is GREEN.
- **Tooling & Docs:** PRs #548 (docs preservation), #549 (E2E auth visibility), and #550 (HC TRV and probe portability tooling) are merged.

## 2. Blocked Work
The following backlog items are explicitly blocked by missing evidence or pending owner decisions:
- **Phase C TEF/RPF Verification:** Blocked by missing primary PDFs (WHO-2005, WHO-1998, Health Canada PQRA H129-108-2021).
- **Organomercury (`phenylmercuric_acetate`) Wiring:** Blocked on owner decision for the `abs_dermal` value (e.g., `0.1`, `0.03`, or `0.001`), AND a decision on the contaminant class implementation approach (Option A1 vs Option A2).
- **PCB Key Alias/Deprecation:** Blocked by catalog migration strategy decision; cannot be executed as a simple code edit without forbidden catalog mutation.
- **Cyanide Speciation:** Blocked by policy/UX selection convention decision.
- **Inhalation Schema Support:** Blocked by lack of design.
- **Ontario MECP TRV Ingestion:** Blocked by lack of an approved ingestion plan.

## 3. Top Candidate Lanes

### Candidate A: Organomercury (`phenylmercuric_acetate`) Wiring
- **Scope:** Wire `phenylmercuric_acetate` into the runtime library with its approved HH RfD values, pending policy decisions.
- **Files Likely Touched:** `src/lib/matrix-options/substanceLibrary.ts`, `src/lib/matrix-options/__tests__/substanceLibrary.test.ts`, and potentially `types.ts`/`substanceApplicability.ts` (if Option A2 is chosen).
- **Owner Decisions Needed:**
  1. Pick the `abs_dermal` policy.
  2. Pick the implementation option (A1 vs A2).
- **Risks:** Low for Option A1 (strictly additive using existing `organic` class). Broader for Option A2 (requires changing the contaminant class union and applicability surface).
- **AGY Mechanical Work:** Yes.
- **Codex Review Required:** Yes.

## 4. Recommended Next Lane (Refined)
**Recommend Candidate A: Organomercury (`phenylmercuric_acetate`) Wiring**

Before wiring, we must acknowledge the current code precedent. Existing organometallics (`tetraethyl_lead` and `tributyltin_oxide_tbto`) use the pragmatic bucket `contaminantClass: 'organic'` along with a detailed `notes` explanation to avoid adding highly specific classes to the union.

Therefore, this lane requires two explicit owner decisions before implementation:
1. **The `abs_dermal` value.**
2. **The `contaminantClass` approach (Option A1 vs Option A2 below).**

## 5. File-by-File Implementation Plan (Organomercury)

### Option A1: Pragmatic `organic` Bucket (Aligns with existing organometallics)
Use this option to follow the precedent of `tetraethyl_lead` and `tributyltin_oxide_tbto`.

1. `src/lib/matrix-options/substanceLibrary.ts`
   - Add `phenylmercuric_acetate` to `SUBSTANCE_LIBRARY`.
   - Set class to `'organic'`.
   - Set oral RfD to `0.00008` (from the approved catalog value).
   - Set `abs_dermal` to the owner-supplied value.
   - Add explicit `notes` explaining that `organic` is used as a pragmatic bucket for this organomercury compound and that it should not be conflated with elemental mercury.
2. `src/lib/matrix-options/__tests__/substanceLibrary.test.ts`
   - Add test coverage asserting the entry's class, RfD, `abs_dermal`, and proper HH selectability.

### Option A2: Explicit `organomercury` Class
Use this option if strict structural categorization is preferred over the pragmatic bucket.

1. `src/lib/matrix-options/types.ts`
   - Add `'organomercury'` to the `ContaminantClass` union type.
2. `src/lib/matrix-options/substanceLibrary.ts`
   - Add `phenylmercuric_acetate` to `SUBSTANCE_LIBRARY`.
   - Set class to `'organomercury'`.
   - Set oral RfD to `0.00008`.
   - Set `abs_dermal` to the owner-supplied value.
3. `src/lib/matrix-options/substanceApplicability.ts`
   - Route `'organomercury'` to the appropriate applicability branch (e.g., the no-logKow eco-direct not-applicable branch).
4. `src/lib/matrix-options/__tests__/substanceLibrary.test.ts`
   - Add test coverage asserting the entry, the new class wiring, and selectability.

## 6. Forbidden Operations
Under no circumstances will this implementation touch:
- Gate2B or Regulatory Review files.
- `.mcp.json`.
- `src/lib/engine-v2/**`, `src/app/api/engine-v2/**`, or `src/app/(dashboard)/regulatory-review/**`.
- Supabase branches, MCP writes, migrations, SQL execution, or `matrix_reviews`.
- `src/data/**`, catalog JSON files, `qa_status`, `default_status`, review statuses, promotions, or demotions.
