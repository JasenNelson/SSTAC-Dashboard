# Stream C Design Pre-Review: Frame-Aware Equation Dispatch Layer
# Adversarial review of STREAM_C_EQUATION_DISPATCH_DESIGN.md against codebase ground truth.
# Authored: 2026-05-28. Read-only on all source files.

---

## 1. Executive Summary

VERDICT: READY-WITH-EDITS (YELLOW leaning GREEN)

The design is well-grounded and accurately describes current codebase state on every
verified claim. No claim is materially wrong. Three findings worth correcting before
Phase 4 code lands:

- P1: The `jurisdiction` prop on all four calculators is typed as `Jurisdiction`
  (alias for `RegulatoryFrameId`), NOT as `RegulatoryFrameId` directly. The design
  doc's code sketches and the `getEquation` signature both use `RegulatoryFrameId` --
  this compiles fine because `Jurisdiction = RegulatoryFrameId` (confirmed in
  `jurisdictions.ts:17`), but the design doc should reference the actual prop type
  name (`Jurisdiction`) to avoid confusion for implementers reading the component
  source.

- P2: `RegulatoryFrameNotice` accepts only `(frameId, pathway, className?)` -- it has
  NO surface for a `usedBaselineFallback` prop. The design doc's wiring sketch (section
  3.3) says "Render fallback notice in the existing RegulatoryFrameNotice region if
  usedBaselineFallback." RegulatoryFrameNotice cannot carry this flag without a new
  prop. The implementer must either add a prop to RegulatoryFrameNotice or render the
  fallback notice as a sibling element alongside it. The design doc should call this
  out explicitly so Phase 4 commit 2 does not get caught mid-PR.

- P3: derivations.ts exports 6 functions total, not 4. The 4 main pathway functions
  are correct, but `utl9595` (line 43) and `avsSemCheck` (line 197) are also exported.
  The design doc's "4 main functions" framing is directionally right but the exact
  export count is 6. Minor precision issue; no implementation impact.

---

## 2. Ground-Truth Verification

### Claim 1: 6 frame IDs in regulatoryFrames.ts

VERIFIED GREEN.

`regulatoryFrames.ts` lines 3-10 define `REGULATORY_FRAME_IDS` as a `const` tuple
with exactly 6 members:
  'bc-protocol1-v5-dra', 'bc-csr-sediment-numerical', 'canada-fcsap-aquatic',
  'ccme-sediment-quality', 'us-epa-usace-sediment', 'site-specific'.

`RegulatoryFrameId` (line 12) is derived from this tuple. `RegulatoryFrame` interface
(lines 37-48) includes `pathwayApplicability: Record<ProvenancePathway,
PathwayApplicability>` as stated. The exhaustiveness check at lines 476-484 enforces
that `REGULATORY_FRAMES` covers all 6 IDs at compile time.

### Claim 2: derivations.ts exports 4 main equation functions

MOSTLY VERIFIED, with a P3 precision note.

The 4 functions named in the design doc ARE exported:
  - `ecoDirectEqP` (line 92)
  - `ecoFoodBSAF` (line 282)
  - `humanHealthDirectContact` (line 506)
  - `humanHealthFoodWeb` (line 610)

Signatures match the design doc's description: each accepts a typed input, returns
a result object with `sedS` and `warnings`, no `frameId` parameter -- confirmed.

Two additional exports exist that the design doc omits: `utl9595` (line 43) and
`avsSemCheck` (line 197). These are out-of-scope for Stream C but the line count
is 739 not 738 (doc says "~738 lines") -- negligible. P3 only.

### Claim 3: ProvenancePathway has 5 variants including background-adjustment

VERIFIED GREEN.

`provenance/types.ts` lines 1-6 define:
  'eco-direct-eqp' | 'eco-food-bsaf' | 'background-adjustment' |
  'human-health-direct' | 'human-health-food'

Exactly 5 variants, `background-adjustment` is present, and the type is used as the
key type in `RegulatoryFrame.pathwayApplicability` (regulatoryFrames.ts line 47).

### Claim 4: Calculators accept `jurisdiction` prop but equations don't vary by frame

VERIFIED GREEN (with the type-name clarification noted in section 1).

All four calculators:
  - Accept `jurisdiction?: Jurisdiction` (not `RegulatoryFrameId` directly, though
    `Jurisdiction = RegulatoryFrameId` per jurisdictions.ts:17).
  - Pass `jurisdiction` to `RegulatoryFrameNotice` and `CalculatorProvenancePanel`.
  - Import equation functions directly from `derivations.ts` (no dispatch layer).
  - No frame-based branching anywhere in the four calculator useMemo blocks.

Evidence by file:
  - EcoDirectEqPCalculator.tsx:135: `return ecoDirectEqP({...})`
  - EcoFoodBSAFCalculator.tsx:193: `return ecoFoodBSAF({...})`
  - HHDirectContactCalculator.tsx:121: `return humanHealthDirectContact(...)`
  - HHFoodWebCalculator.tsx:131: `return humanHealthFoodWeb({...})`

None of these calls reference `jurisdiction` in the calculation path.

### Claim 5: Existing tests assert "uses the selected regulatory frame without crashing" but NOT numeric output differences

VERIFIED GREEN for EcoDirectEqP and EcoFoodBSAF.

EcoDirectEqPCalculator.test.tsx line 162-175: the "uses the selected regulatory frame
without crashing" test loops REGULATORY_FRAME_IDS, renders the calculator for each,
and asserts only that the section and `regulatory-frame-notice` elements are present.
No numeric assertion.

EcoFoodBSAFCalculator.test.tsx line 254-270: same pattern, same assertion shape.

HHDirectContactCalculator.test.tsx: no explicit "all frames" loop test, but the
single render uses `bc-protocol1-v5-dra` and asserts UI text only. Consistent.

HHFoodWebCalculator.test.tsx: same as HHDirectContactCalculator. No frame-loop test,
no numeric cross-frame assertion.

The design doc's claim that "existing tests assert no-crash per frame... NOT numeric
output differences" is accurate. The two HH calculators have less comprehensive frame
coverage (no loop over all 6 IDs) -- a minor gap but consistent with the claim.

---

## 3. Missing Dependencies and Drift Detection

### `getEquation<P extends ProvenancePathway>` signature compileability

The proposed generic signature:

  getEquation<P extends ProvenancePathway>(frameId: RegulatoryFrameId, pathway: P)

is sound given current types. `RegulatoryFrameId` is a string union (6 members);
`ProvenancePathway` is a string union (5 members). The return type uses a conditional
`PathwayInput<P>` / `PathwayResult<P>` mapped type -- that conditional type is NOT
currently defined anywhere in the codebase. The design doc acknowledges this
implicitly (the sketch has a comment "// ... other input/result types") but does not
name the required conditional type definitions. The implementer must author:

  type PathwayInput<P extends ProvenancePathway> = P extends 'eco-direct-eqp'
    ? EcoDirectEqPInput : P extends 'eco-food-bsaf' ? EcoFoodBSAFInput : ...

These input/result types ARE exported from `derivations.ts` (lines 4-16 import them
from `./types`). The plumbing exists; the mapping type is the new work. Medium
effort; no blocker.

### `FRAME_VARIANTS` starts empty in current state

VERIFIED. The file `frameVariants.ts` does not yet exist. The design proposes it
starts as an empty array -- correct shape for day-1 behavior (all paths return
baseline fallback). No drift here.

### `usedBaselineFallback` surface in RegulatoryFrameNotice

P2 FINDING. `RegulatoryFrameNotice.tsx` props (lines 11-15) are:
  `{ frameId: RegulatoryFrameId; pathway: ProvenancePathway; className?: string }`

There is no `usedBaselineFallback`, `notice`, or similar slot. The design doc's
section 3.3 wiring sketch says:
  "Render fallback notice in the existing RegulatoryFrameNotice region if usedBaselineFallback."

This implies the implementer either (a) adds a `usedBaselineFallback?: boolean`
prop to RegulatoryFrameNotice (touching a shared component used in all 4 calculators
+ tests that assert its rendered output by data-testid), or (b) renders a separate
sibling element in each calculator. Option (b) is lower-risk and keeps
RegulatoryFrameNotice unchanged. The design doc should resolve this before Phase 4
commit 2 starts.

---

## 4. Anti-Pattern Check

All five anti-patterns listed in design doc section 6 remain relevant and not yet
violated by the codebase. Specifically:

- Anti-pattern 1 (do NOT add frameId to derivations.ts): confirmed -- no frameId
  parameter in any of the 6 exported functions.
- Anti-pattern 2 (no silent equation swap): confirmed -- no existing frame-conditional
  equation logic anywhere.
- Anti-pattern 3 (do not invent variant content): confirmed -- no per-frame parameter
  values exist in any current file; all defaults are substance-library-sourced.
- Anti-pattern 4 (do not delete no-crash tests): confirmed -- the tests are present
  and load-bearing. EcoDirectEqP and EcoFoodBSAF have full 6-frame loop coverage;
  HHDirectContact and HHFoodWeb assert the frame label in the UI but without loops.
- Anti-pattern 5 (no batch-all-frames commit): confirmed -- no existing violation;
  rule is forward-looking.

No new precedent in the codebase that would justify revising any of these anti-patterns.

---

## 5. Phase 4 Prerequisites Checklist

[ ] Stream D PR merged (catalog infrastructure available; `catalog_sources` and
    `catalog_evidence_items` tables do not yet exist per design doc section 5 note;
    `sourceIds` in frameVariants will remain empty arrays until these land).
    STATUS: OPEN. Design doc acknowledges this correctly.

[ ] Owner content input: which frames have real per-pathway equation variants vs
    aspirational? (Plan Open Question 2).
    STATUS: OPEN. Design doc correctly marks this as the central content question.
    The doc recommends the FRAME_VARIANTS table start empty and grow -- this is the
    right mitigation for the unknown.

[ ] Decision: explicit-fallback-with-UI-notice vs typed-error on missing variant.
    STATUS: Design doc proposes explicit-fallback-with-UI-notice as the recommendation
    (section 2 principle 3, section 3.2). Owner has not explicitly confirmed. Low risk
    to proceed with the recommendation; the typed-error alternative is still recoverable
    in a later commit.

[ ] Decision: `background-adjustment` pathway treatment (frame-invariant or per-frame).
    STATUS: OPEN (design doc Open Question 3). For Phase 4 Week 8 commits (dispatch
    infrastructure, no actual variants), this decision can be deferred. It only matters
    when a `background-adjustment` variant is added to FRAME_VARIANTS.

[ ] Decision: `site-specific` frame treatment (always-baseline or user-uploaded
    constants).
    STATUS: OPEN (design doc Open Question 4). Same deferral applies -- dispatch
    infrastructure works regardless; the `site-specific` frame row in FRAME_VARIANTS
    stays empty until this is resolved.

[ ] P2 resolution: RegulatoryFrameNotice surface for `usedBaselineFallback`.
    STATUS: OPEN. Must resolve before Phase 4 commit 2 starts (see section 3).

---

## 6. Recommended Changes to Design Doc

### P1 -- Type name clarification (must fix before Phase 4 commit 1)

In section 3.1 and section 3.3, replace `RegulatoryFrameId` with `Jurisdiction` where
the prop type is described, OR add a note:

  "Note: the four calculators import `Jurisdiction` from
  `./guide/content/jurisdictions`, not `RegulatoryFrameId` directly.
  `Jurisdiction = RegulatoryFrameId` (jurisdictions.ts line 17). The dispatch layer
  should accept `RegulatoryFrameId` directly and is compatible with both import paths."

This is a clarity fix, not a correctness fix, but it prevents an implementer from
grepping the component source for `RegulatoryFrameId` and misreading the prop type.

### P2 -- Resolve fallback notice surface before commit 2 (should fix or decide)

Add a sub-section to section 3.3 (or a new section 3.3.1):

  "RegulatoryFrameNotice does not currently accept a fallback flag. Options:
  (A) Add `usedBaselineFallback?: string` prop to RegulatoryFrameNotice (touch 1 shared
      component; update 4 test files that assert its data-testid output).
  (B) Render a dedicated `<EquationFallbackNotice>` sibling element in each calculator,
      outside RegulatoryFrameNotice. No shared component changes; 4 new data-testids.
  Recommendation: Option B. Lower surgical risk; RegulatoryFrameNotice stays stable."

Owner does not need to decide this before commits 1 or 2 starts, but the decision
should be in the doc before commit 2 is drafted.

### P3 -- Correct export count (nice-to-have polish)

Section 1 says derivations.ts exports "4 main equation functions." Change to:

  "derivations.ts exports 6 functions: the 4 main pathway functions
  (ecoDirectEqP, ecoFoodBSAF, humanHealthDirectContact, humanHealthFoodWeb) plus
  utl9595 (95/95 UTL calculation) and avsSemCheck (AVS/SEM metals check). Stream C
  only routes through the 4 main pathway functions."

### P3 -- Document `PathwayInput<P>` / `PathwayResult<P>` conditional types

Add a note to section 3.1 that these mapped types must be authored in the new
`equationDispatch.ts` as part of commit 1:

  "Commit 1 must also define `PathwayInput<P extends ProvenancePathway>` and
  `PathwayResult<P extends ProvenancePathway>` conditional type maps. Input/result
  types are already exported from `derivations.ts` via `./types`; the mapping is the
  new work. All 4 pathway arms must be exhaustive or TypeScript will widen to unknown."

---

## 7. Implementation Risk Assessment

Commit 1 (equationDispatch.ts + types + unit tests, empty FRAME_VARIANTS):
  COMPLEXITY: Medium. The conditional mapped types `PathwayInput<P>` / `PathwayResult<P>`
  require a 4-arm discriminated union; easy to miss exhaustiveness. The "all paths
  return baseline fallback" behavior is trivially tested. Risk: TypeScript generic
  complexity causes compile errors on the `run: (input: PathwayInput<P>)` return shape.
  Mitigation: author the 4-arm conditional types first, verify they compile, then build
  the function body.

Commit 2 (wire EcoDirectEqPCalculator through dispatch):
  COMPLEXITY: Low-Medium. Single component change. Hidden risk: the `jurisdiction` prop
  is typed `Jurisdiction` in the component but `RegulatoryFrameId` in the dispatch
  layer; these are the same type but different import paths. TypeScript will accept it;
  the risk is an eslint import-order warning if the codebase has import-source rules.
  Also: the `usedBaselineFallback` surface must be resolved (section 3 P2) before this
  commit can render the notice.

Commits 3-5 (wire EcoFoodBSAF, HHDirectContact, HHFoodWeb):
  COMPLEXITY: Low. Identical wiring pattern to commit 2. Once commit 2 passes review
  the remaining 3 are mechanical. Risk: EcoFoodBSAF and HHFoodWeb share the
  `contaminantClass`-dependent BSAF_effective path -- if a future variant needs to
  override that intermediate, the dispatch layer will need to supply more than just an
  equation function reference. Not a Phase 4 concern (FRAME_VARIANTS starts empty) but
  worth a comment in the dispatch layer source for Week 9 guidance.

Commits 4-5 (HH calculators):
  COMPLEXITY: Low. The HH calculators do not have the 6-frame loop test (only bc-
  protocol1). Consider adding the loop test as part of the wiring commit for symmetry
  with EcoDirectEqP and EcoFoodBSAF. Low effort; good regression coverage.

---

## 8. Phase 4 Commit Ordering Recommendation

The proposed 5-commit ordering is sound. Two amendments:

Amendment 1: Commits 2-5 should remain separate per-calculator commits rather than
a sweep. Rationale: each calculator has its own test suite with distinct data-testid
surface. A single sweep commit would produce a large diff that is harder to codex-
review incrementally. The 4 commits are mechanical repetition, but the test coverage
verification (gates GREEN on each) is the quality gate, not the diff size.

Amendment 2: Insert an explicit codex checkpoint between commit 1 and commit 2.
Commit 1 introduces the new generic type surface -- the most architecturally novel
piece of Stream C. Running codex holistic review on commit 1 alone (before any
calculator wiring) catches any structural issues in the dispatch surface before they
are multiplied across 4 components. This aligns with the design doc's own principle
of "behaviorally-neutral commits ship first" -- commit 1 is the type contract; it
deserves its own GREEN before the components depend on it.

Recommended ordering:
  1. equationDispatch.ts + types + unit tests (empty FRAME_VARIANTS). Gates GREEN.
     Codex holistic. Push.
  2. Wire EcoDirectEqPCalculator. Include fallback notice surface decision. Gates GREEN.
     Codex targeted. Push.
  3. Wire EcoFoodBSAFCalculator. Add 6-frame loop test if not present. Push.
  4. Wire HHDirectContactCalculator. Add 6-frame loop test. Push.
  5. Wire HHFoodWebCalculator. Add 6-frame loop test. Push.
  End of Week 8: dispatch infrastructure in place; all frames fall back to baseline.
  Week 9: per-variant commits (one per FRAME_VARIANTS entry, codex targeted each).

---

## Verification

All 8 ground-truth files read directly for this review. File:line citations are
sourced from the read content. ASCII scan: 0 violations (plain ASCII throughout;
no em-dashes, no Unicode arrows, no smart quotes). Line count: 253.

---

*Authored 2026-05-28 by Sonnet subagent adversarial pre-review. Read-only on all
source files. Design doc path: docs/STREAM_C_EQUATION_DISPATCH_DESIGN.md (commit b4e5d30).*
