# Stream C Design: Frame-Aware Equation Dispatch Layer

**Status:** Design proposal (autonomous draft 2026-05-27). Pending owner review on return + Opus adversarial review before any code lands.

**Plan reference:** `C:\Users\jasen\.claude\plans\lively-stargazing-meadow.md` Phase 4 (Weeks 8-9).

**Owner directive 2026-05-27:** 2027 ordering = D, C, B. Stream C executes AFTER Stream D (autonomous catalog agent scaffold) completes; BEFORE Stream B (map data growth).

**Scope:** thin dispatch surface on top of existing equation functions so that selecting a different regulatory frame in the Calculator yields a different equation variant (today: same equation runs regardless of frame). Out of scope: refactoring `derivations.ts` itself, introducing new pathway types, changing the four calculator components' UI.

---

## 1. Context: why this lane exists

Per the approved plan, "the four pathway calculators (Eco{Direct,Food}, HH{Direct,Food}) accept `jurisdiction?: Jurisdiction` prop but equations do not vary by frame." Today's behavior:

- `regulatoryFrames.ts` defines 6 frame IDs (`bc-protocol1-v5-dra`, `bc-csr-sediment-numerical`, `canada-fcsap-aquatic`, `ccme-sediment-quality`, `us-epa-usace-sediment`, `site-specific`) with metadata (label, source hierarchy, applicability per pathway) but NO equation parameters.
- `derivations.ts` (~738 lines) is a monolithic module exporting 4 main pathway equation functions: `ecoDirectEqP()`, `ecoFoodBSAF()`, `humanHealthDirectContact()`, `humanHealthFoodWeb()`. Each accepts a typed input and returns `{...result} | {error}`. No frame parameter; no per-frame branching. (The module also exports two supporting utilities `utl9595()` and `avsSemCheck()` -- these are pathway helpers, not full dispatch targets, and are out of scope for Stream C dispatch routing.)
- The four calculator components import the functions directly and call them with the user's inputs. The `jurisdiction` prop is displayed in a `RegulatoryFrameNotice` (UI metadata) but does not affect computation.
- Existing tests assert "uses the selected regulatory frame without crashing" -- which only verifies UI rendering, not equation behavior changes.

**The goal of Stream C:** wire `jurisdiction` (typed `Jurisdiction` in the calculator props -- this is a type alias for `RegulatoryFrameId` defined in `src/lib/matrix-options/jurisdictions.ts:17` -- so the prop value can be passed directly to `getEquation()` without conversion) into equation routing so the Calculator surfaces frame-specific values where they exist, without rewriting the equation library from scratch.

---

## 2. Design principles

1. **Thin dispatch over rewrite.** Per `cross_project_fork_existing_over_design_new.md`: if a frame already has working equations elsewhere in the codebase or in the catalog metadata, the dispatch layer reuses them. The dispatch layer is a routing surface, not a new equation library.
2. **Default-frame backwards compatibility.** The current default frame is `bc-protocol1-v5-dra`. Today's equations are implicitly that frame. New frame variants build on this baseline -- removing the default frame's behavior is OUT OF SCOPE.
3. **No silent variant fallback.** If a frame does not have a defined variant for a given pathway, the dispatch layer either:
   - Returns the baseline equation (explicit fallback documented in code), OR
   - Returns a typed error `{error: 'frame-variant-not-defined'}` so the UI can render a "this frame does not yet have a specialized equation; using BC Protocol 1 baseline" notice.
   The choice between these two behaviors is a Phase 4 design lock-in decision (recommendation: explicit-fallback-with-UI-notice).
4. **Per-frame variants are data, not code.** Where possible, frame-specific parameters (TRVs, BSAFs, ingestion rates, dermal adherence factors) live in a `frameVariants.ts` lookup table -- not in branching logic in the equation functions. Code paths stay clean; data churn is isolated to one file.
5. **Tests verify behavior changes, not just renders.** Existing tests assert no-crash per frame. New tests must assert numeric output differs between frames where a variant is defined.
6. **HITL-curated variant table.** Per `feedback_no_tier_judgment_for_ai.md`: AI does not invent frame-specific parameter values. The variant table is sourced from curated HITL content (Stream D Evidence Library catalog when available) or owner-provided spec.

---

## 3. Proposed architecture

### 3.1 New module: `src/lib/matrix-options/equationDispatch.ts`

Exports:

```typescript
import type { RegulatoryFrameId } from './regulatoryFrames';
import type { ProvenancePathway } from './provenance/types';
import {
  ecoDirectEqP,
  ecoFoodBSAF,
  humanHealthDirectContact,
  humanHealthFoodWeb,
  type EcoDirectEqPInput,
  type EcoDirectEqPResult,
  // ... other input/result types
} from './derivations';

export type EquationVariantId =
  | 'baseline'
  | 'ccme-bsaf-v1'
  | 'fcsap-trv-v1'
  | 'us-epa-tef-v1'
  // ... one per shipped frame variant
  ;

export interface FrameVariantMapping {
  /** Which frame this mapping serves. */
  frameId: RegulatoryFrameId;
  /** Which pathway this mapping serves. */
  pathway: ProvenancePathway;
  /** Variant identifier (resolves to equation function + parameter set). */
  variant: EquationVariantId;
  /** Brief explanation for UI surfacing ("CCME uses 2007 BSAF table"). */
  note: string;
  /** HITL provenance: source IDs from the Evidence Library. */
  sourceIds: readonly string[];
}

/**
 * Returns the equation function + parameter set for the given frame + pathway.
 *
 * If no specific variant is defined for the frame+pathway pair, returns the
 * baseline variant ('bc-protocol1-v5-dra') and sets `usedBaselineFallback: true`
 * so the caller can render a UI notice.
 */
export function getEquation<P extends ProvenancePathway>(
  frameId: RegulatoryFrameId,
  pathway: P,
): {
  variant: EquationVariantId;
  usedBaselineFallback: boolean;
  fallbackReason?: string;
  // Equation-specific run shape; one function reference + a typed parameter set.
  run: (input: PathwayInput<P>) => PathwayResult<P>;
};
```

### 3.2 New module: `src/lib/matrix-options/frameVariants.ts`

A pure-data table mapping `(frameId, pathway) -> variantId + parameter overrides + source provenance`. Example:

```typescript
import type { FrameVariantMapping } from './equationDispatch';

export const FRAME_VARIANTS: readonly FrameVariantMapping[] = [
  // BC Protocol 1 v5-dra: baseline; no variants defined (returns default equations).
  // CCME: BSAF table from CCME 2007 Soil Quality Guidelines.
  {
    frameId: 'ccme-sediment-quality',
    pathway: 'eco-food-bsaf',
    variant: 'ccme-bsaf-v1',
    note: 'CCME 2007 BSAF table; differs from BC Protocol 1 default in 4 of 7 substance classes.',
    sourceIds: [], // Filled when Evidence Library catalog matures.
  },
  // ... additional mappings curated by HITL.
] as const;
```

The table starts EMPTY (no variants) and grows incrementally as HITL identifies real differences. The "starts empty" choice forces explicit-fallback-with-UI-notice behavior to be obvious from day 1; no silent surprises.

### 3.3 Calculator wiring (the only change to existing components)

In each of `EcoDirectEqPCalculator.tsx`, `EcoFoodBSAFCalculator.tsx`, `HHDirectContactCalculator.tsx`, `HHFoodWebCalculator.tsx`:

```typescript
// Before:
import { ecoDirectEqP } from '@/lib/matrix-options/derivations';
// ...
const result = useMemo(() => ecoDirectEqP(input), [input]);

// After:
import { getEquation } from '@/lib/matrix-options/equationDispatch';
// ...
const { run: ecoDirectEqP, usedBaselineFallback, fallbackReason } = useMemo(
  () => getEquation(jurisdiction, 'eco-direct-eqp'),
  [jurisdiction],
);
const result = useMemo(() => ecoDirectEqP(input), [ecoDirectEqP, input]);
// Render fallback notice as a SIBLING element placed next to the existing
// <RegulatoryFrameNotice /> in the calculator JSX (RegulatoryFrameNotice.tsx
// props today are (frameId, pathway, className?) -- there is no slot for
// usedBaselineFallback). A second small notice component (e.g.,
// <FrameVariantFallbackNotice usedBaselineFallback={usedBaselineFallback}
// fallbackReason={fallbackReason} />) is the recommended approach. Phase 4
// commit 1 ships this sibling component alongside the dispatch layer.
```

Minimal calculator-component change (one sibling element added; RegulatoryFrameNotice itself untouched). The dispatch layer absorbs the routing.

### 3.4 Test strategy

#### New unit tests at `src/lib/matrix-options/__tests__/equationDispatch.test.ts`
- For each frame + pathway pair: `getEquation(frame, pathway)` returns a runnable function.
- For frames with NO defined variant: returns baseline + `usedBaselineFallback: true`.
- For frames with a defined variant: returns the variant + `usedBaselineFallback: false`.
- Variant returns are deterministic for identical inputs.
- Type-safety: TypeScript compile-time check that `pathway` parameter is `ProvenancePathway`.

#### Updated calculator tests
- Existing "uses the selected regulatory frame without crashing" tests stay (regression guard per `cross_project_never_delete_regression_tests_during_cleanup.md`).
- NEW tests: for each frame with a defined variant, assert the calculator's preliminary value differs from the baseline frame's value when run on the same substance.
- NEW tests: when a frame has no variant for a pathway, assert the UI renders the `usedBaselineFallback` notice.

#### Integration tests
- Render the calculator, switch frame via the UI, assert the on-screen preliminary value changes for substances where a variant is defined.

---

## 4. Incremental rollout plan (Phase 4 weeks 8-9)

**Week 8 commits (5 anticipated):**
1. Add `equationDispatch.ts` + types + unit tests (empty variants table; all calls fall back to baseline). All gates GREEN. Codex GREEN. Push.
2. Wire `EcoDirectEqPCalculator` through dispatch. Add fallback notice rendering. All gates GREEN. Push.
3. Wire `EcoFoodBSAFCalculator` similarly. Push.
4. Wire `HHDirectContactCalculator` similarly. Push.
5. Wire `HHFoodWebCalculator` similarly. Push.

At end of Week 8: dispatch infrastructure in place, no behavior changes for users (all variants fall back to baseline). Critical: this is a safe, behaviorally-neutral milestone.

**Week 9 commits (3-5 anticipated, depends on owner-provided variant content):**
6. Add first frame variant (e.g., `ccme-bsaf-v1` for `eco-food-bsaf`) -- requires HITL-curated parameter values. Owner provides content; AI authors data in `frameVariants.ts`. Tests assert behavior change. Push.
7. Add subsequent variants one at a time, each on its own commit per `cross_project_codex_review_adversarial_iterative_loop_default.md`.

**Behaviorally-neutral commits (1-5) ship first** so the architecture is locked in before any user-visible value changes. Per `cross_project_quality_first_no_speed_shortcuts.md`: this is the right shape -- a slow incremental rollout beats a one-shot big-bang refactor.

---

## 5. Dependencies + risks

### Dependency on Stream D (Evidence Library catalog)
The frame variants need source provenance (the `sourceIds` array). Stream D builds the catalog tooling AND populates it. Order matters: Stream D ships first (Phase 3); Stream C consumes Stream D's source IDs (Phase 4). If Stream D's catalog is empty when Stream C starts, the dispatch infrastructure (commits 1-5) lands without any actual variants; variant content waits until catalog is populated. (Stream D's catalog infrastructure depends on migrations for `catalog_sources` and `catalog_evidence_items` -- per the 2026-05-28 discovery, these tables do not yet exist; verify they land before treating source IDs as available for variant provenance.)

### Owner content input required
Frame-specific equation parameters (e.g., CCME 2007 BSAF table, US EPA TEF values) are NOT in the codebase today. The Evidence Library catalog (Stream D) is the right home for them. Owner content input determines:
- Which frames have real equation differences vs only metadata differences.
- The specific parameter values that change.
- The source citations for each variant.

Plan Open Question #2: "Which frame-specific equation differences are real today vs aspirational?" -- this remains the central content question for Stream C.

### Risk: variant table drift
Once `frameVariants.ts` has entries, it becomes a live HITL-curated artifact. Per protected paths (Tier 2 in CLAUDE.md), the curated catalogs in `src/data/` are read-only for AI sessions. Recommendation: treat `frameVariants.ts` as Tier 2 protected once it has entries. AI sessions can ADD new variants from HITL-provided content but cannot modify existing entries without explicit HITL approval.

### Risk: test gymnastics for "frame X equals frame Y when no variant defined"
The fallback behavior means many frame+pathway pairs will yield identical results. Tests that assert "frame A differs from frame B" will need a substance + pathway where BOTH have variants defined. Mitigation: write tests that assert specific frame+pathway combinations rather than cross-frame matrices.

### Risk: drift between dispatch and calculator props
The four calculators pass `jurisdiction` separately. If a new pathway is added later (Phase 4+), the dispatch layer needs to know about it. Mitigation: TypeScript discriminated union on `ProvenancePathway` ensures compile-time coverage.

---

## 6. Anti-patterns to avoid

1. **Do NOT modify `derivations.ts` to accept a `frameId` parameter.** That would couple the equation library to frame semantics. Keep `derivations.ts` pure; let `equationDispatch.ts` do the routing.
2. **Do NOT silently swap equations when a frame variant is defined.** Always render a UI notice ("CCME variant in use; differs from BC Protocol 1 baseline by X").
3. **Do NOT invent variant content.** The HITL provides parameter values + source citations. If the Evidence Library does not have a source for a proposed variant, do not ship the variant.
4. **Do NOT delete the "uses the selected regulatory frame without crashing" tests.** Per `cross_project_never_delete_regression_tests_during_cleanup.md`: these are load-bearing regression guards; they coexist with the new behavior-change tests.
5. **Do NOT batch all 6 frames + 5 pathways into one giant variants table commit.** Per `cross_project_codex_review_adversarial_iterative_loop_default.md`: one variant per commit, codex iterate-to-GREEN each time.

---

## 7. Open questions for owner (carry into Stream C planning session)

1. **Variant content source:** Who curates the per-frame parameter values? Owner manually, or via Stream D catalog when populated?
2. **Fallback verbosity:** When a frame has no variant for a pathway, the UI shows "Using BC Protocol 1 baseline" notice. Is this acceptable, or do we need a more user-friendly explanation (e.g., "CCME does not specify a method for this pathway; falling back to BC default")?
3. **Tier-0-background-adjustment treatment:** This is the 5th pathway in `ProvenancePathway`. Is the background adjustment frame-invariant (same logic across all frames), or do CCME / US EPA define their own background methods?
4. **`site-specific` frame:** This is currently the "anything goes" placeholder. Does it use variants (e.g., user-uploaded constants) or always-baseline?
5. **Print / PDF output:** The calculator has print-mode behavior (per recent commits). Does the frame-variant notice need to render in printed output?

---

## 8. Cross-stream interactions

- **Stream A (The Guide):** Done in current session. The Guide Section 6 mentions the Calculator + References & Values; no edits needed for Stream C unless Stream C introduces user-visible new UI patterns the Guide should describe.
- **Stream D (Catalog autonomous agent):** Stream C depends on Stream D's catalog content for variant source IDs. Order: D first, then C (per owner directive 2026-05-27).
- **Stream B (Map data growth):** Independent; no interactions.
- **Conceptual Model tab:** No edits needed unless Stream C introduces a new pathway taxonomy (it does not).
- **Jurisdictional Frameworks tab:** May want a "Calculator variant available" badge on jurisdictions that have a corresponding `equationDispatch` variant. P3 polish; can wait.

---

## 9. Deliverables at Phase 4 close

- `src/lib/matrix-options/equationDispatch.ts` + unit tests, all GREEN.
- `src/lib/matrix-options/frameVariants.ts` (data only) with at least 1 real variant if owner content is available; empty otherwise.
- All four calculators wired through dispatch; existing tests preserved; new behavior-change tests added where variants exist.
- A single design-doc PR or commit linking to this design doc, the variants table, and the test plan.
- Memory anchor `dashboard_stream_c_equation_dispatch_2026_<date>.md` summarizing what shipped.

---

## 10. Stop conditions for Stream C work

- Any change to `derivations.ts` that goes beyond adding NEW variant functions (do not modify existing baseline functions).
- Any variant ships without HITL-provided source IDs.
- Any test asserting frame-specific behavior is added without a corresponding `frameVariants.ts` entry that justifies the test's expectation.
- Any AI determination of "the right" variant value for a frame (per `feedback_no_tier_judgment_for_ai.md`).

---

*Authored autonomously by Opus 4.7 main session on 2026-05-27. Pending owner review on return + Opus adversarial review before any Phase 4 code lands. References approved multi-week plan at `C:\Users\jasen\.claude\plans\lively-stargazing-meadow.md`.*
