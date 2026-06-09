# Phase C design proposal -- frame variants as per-frame default assumption sets (2026-06-09)

Status: OWNER-APPROVED 2026-06-09 (dual-review GREEN: codex gpt-5.5 xhigh + Opus). Plain ASCII.

OWNER DECISIONS LOCKED (2026-06-09):
1. First applied frame = BC-FIRST (seed BC Protocol 1 HH-food from WLRS recreational; non-BC later).
2. Seed gating = PROMOTE-FIRST (owner promotes the WLRS value to qa_status approved before a frame
   seeds from it; no pending value silently drives the calc).
3. Seed semantics = IR_food is a user-ADJUSTABLE seed (not a hard lock); BW_kg ALLOWED as a seed
   (receptor assumption); site-measured foc/fLipid EXCLUDED unless owner-approved.
4. Build C0 (seed infrastructure, NO production value change) authorized now.

## 0. Owner vision (the anchor)

"Frame variants [should] include default assumptions, values, approaches." -- owner, 2026-06-09.

A regulatory frame (BC Protocol 1, BC CSR, CCME, FCSAP, US EPA/USACE, site-specific) is
not just a label; selecting it should bring that frame's DEFAULT modelling choices into the
calculator: default parameter VALUES (e.g. fish ingestion rate), default ASSUMPTIONS
(receptor, exposure terms), and the default APPROACH (which equation/method). The user can
then still adjust within the frame.

## 1. What exists (verified)

- `FRAME_VARIANTS` (`src/lib/matrix-options/frameVariants.ts:191`) is `[]` (empty by design).
- `EquationVariantId` (`equationDispatch.ts:42`) = `'baseline'` only; `VARIANT_FUNCTIONS`
  maps variantId -> pathway -> fn; `getEquation(frameId, pathway)` resolves a row or falls
  back to baseline (`usedBaselineFallback: true` -> `FrameVariantFallbackNotice`).
- `applyFrameVariantOverrides` + the `getEquation` wrapper HARD-apply a row's
  `parameterOverrides` to the input at run() time (idempotent). `DispatchResult.parameterOverrides`
  is surfaced so a calculator can also apply them before validation/provenance.
- The tripwire (`equationDispatch.ts:422`) rejects a `baseline` row carrying overrides.
- The 4 calculators currently consume only `run()`; they do NOT yet read `parameterOverrides`
  (deliberately deferred -- spec sec 8 step 4).
- HH-food calculator default IR is a HARDCODED, UNSOURCED `useState('0.142')`
  (`HHFoodWebCalculator.tsx:67`); receptor scenarios are user-input quick-set buttons
  (0.032/0.142/0.388).
- Catalog (PR #281, needs_review): 3 BC WLRS 2023 fish-ingestion-rate candidates
  (subsistence 0.220 / recreational 0.111 / low-level 0.021 kg/day), substance_key=generic,
  input_key=IR_food_kg_per_day, sharing one slot. They are NOT yet reachable from any
  substance-scoped calculator path (Phase B codex criterion: do not orphan them).

## 2. The core design fork -- override semantics

The owner's word "DEFAULT assumptions" is load-bearing. There are two possible semantics for
what a frame variant does to a parameter, and they behave very differently:

- (A) HARD OVERRIDE (what the current mechanism literally does): selecting the frame FORCES
  the value; the user cannot change it in-frame. Good for a parameter a frame mandates
  (e.g. a frame-prescribed TRV or a fixed equation), wrong for a "default" the user may tune.
- (B) DEFAULT SEED: selecting the frame SETS the initial/default value of the input field;
  the user can still override it via the existing input. Matches "default assumptions" and
  resolves receptor-vs-frame cleanly -- the FRAME picks the default receptor rate, the USER
  can switch receptor via the input.

RECOMMENDATION: frame variants should distinguish the two. Most parameter values
(IR_food_kg_per_day, BW, exposure terms) are DEFAULT SEEDS (B). A few may be HARD (A) when a
frame genuinely mandates a value or a different EQUATION (the "approach" axis -- see sec 4).
The row shape should mark each override's binding strength (e.g. `binding: 'seed' | 'hard'`),
or seeds live in a new `parameterDefaults` block while `parameterOverrides` stays hard.

OPEN QUESTION FOR OWNER: confirm IR_food (and receptor rates generally) are SEED defaults the
user can still change in-frame, not hard locks.

## 3. Three candidate first-moves (pick one to ship first)

- (C1) Correct the unsourced baseline default FIRST. Replace `useState('0.142')` with a
  sourced default (e.g. WLRS recreational 0.111 for the BC baseline frame), citing the
  catalog value. This is a calculator-default fix, not a variant. Smallest honest step;
  makes the BC baseline sourced before any variant is layered. Does NOT exercise the variant
  pipeline.
- (C2) First variant on a NON-BC frame whose IR genuinely differs (e.g. US EPA per-capita
  6.5 g/day = 0.0065). Keeps receptors user-input; exercises the full variant pipeline
  (EquationVariantId + row + calculator wiring + fallback-notice suppression + tests)
  end-to-end on a case where the cross-frame difference is unambiguous. Best pipeline proof.
- (C3) BC frame variant supplies a WLRS default IR (frame carries its default). Directly
  matches the vision but layers onto the still-unsourced 0.142 baseline and needs the
  verified production catalog_sources UUID for the WLRS row.

RECOMMENDATION (to be pressure-tested by codex): do C1 THEN C2.
- C1 first makes the baseline honest (sourced) and is independently valuable.
- C2 proves the frame-variant-as-default-assumption pipeline on a clean cross-frame case,
  establishing the SEED semantics, the calculator wiring, and the test patterns -- so the
  later BC/CCME/FCSAP frames (richer assumption sets) are mechanical.
This sequences "make the baseline sourced" -> "prove the per-frame default mechanism" ->
"populate each frame's assumption set", which is lower-risk than starting with the BC frame
on top of an unsourced baseline.

## 4. The "approaches" axis (per-frame equations)

"Approaches" = a frame may use a different EQUATION/method, not just different values. The
`EquationVariantId` + `VARIANT_FUNCTIONS` mechanism already supports per-frame variant
functions (a frame can register a different fn for a pathway). So:
- VALUES/ASSUMPTIONS -> parameterOverrides/parameterDefaults (seed or hard).
- APPROACH -> a non-baseline EquationVariantId mapped to a frame-specific function.
A frame variant row can do either or both. The first move (C1/C2) should NOT introduce a new
equation (keep baseline fn re-registered, Type A) to isolate the variable; equation variants
come when a frame actually prescribes a different method.

## 5. Catalog linkage (close the Phase B loop)

A frame's default value should ultimately CITE an approved catalog value (the WLRS rows once
HITL-promoted), not a hardcoded literal. Proposal:
- Short term: the frame default references the catalog candidate by parameter_value_id /
  candidate_group_id; while the row is needs_review it is shown as "frame default (pending
  source verification)".
- This gives the Phase B generic exposure-factor rows their consumer (the frame-variant
  default path), satisfying the "do not orphan" acceptance criterion -- via a frame/exposure
  surface, NOT substance-scoped TRV lookups.
OPEN QUESTION: should the frame-default -> catalog link be by candidate_group_id (slot) with
a frame-level selection of which candidate is that frame's default? (e.g. BC frame default =
WLRS recreational; a user can pick subsistence/low-level via input.)

## 6. Owner-gated inputs still required before ANY variant code

1. Confirm override semantics (sec 2): IR_food = SEED default (user-adjustable in-frame)?
2. Confirm the first-move sequence (sec 3): C1 then C2? Or go straight to the BC frame (C3)?
3. For any real variant row: the verified production Supabase `catalog_sources` UUID(s)
   (validateFrameVariants rejects empty sourceIds; AI must not invent UUIDs).
4. For C1: authorize changing the calculator's hardcoded default (an AI-never-sets-default
   nuance: a hardcoded UI seed is not a catalog default, but the owner should bless the change
   and the sourced value).

## 7. Acceptance criteria (carry into implementation)

- Variant returns `usedBaselineFallback:false`; sedS differs from baseline for the same site
  inputs; fallback notice suppressed for the variant frame.
- Calculator reads the frame default BEFORE validation/provenance so displayed "values used"
  match what produced sedS.
- The generic WLRS exposure-factor rows are reachable through the frame-default path (Phase B
  codex criterion -- add a test).
- Codex iterate-to-GREEN + 4 gates; one variant per PR.

## 8. Question for codex (holistic)

Given the owner vision (frame variants carry per-frame default assumptions/values/approaches)
and the verified infra/tensions above: what is the BEST first-move + override-semantics design?
Pressure-test C1-then-C2 vs C3; the seed-vs-hard fork; the catalog-linkage approach; and
whether the existing parameterOverrides mechanism should be extended (binding strength /
parameterDefaults) or kept hard with a separate seed layer. Identify failure modes and the
lowest-risk path that still realizes the vision.

## 9. Review synthesis -- codex (gpt-5.5 xhigh) + Opus, both holistic (2026-06-09)

Two independent holistic reviews. Both VERDICT: SOUND/GREEN ("proceed with refinements").
They CONVERGED on the architecture; they diverged only on which frame to seed first.
NOTE: both reviewed `main`, which does NOT yet have the Phase B WLRS rows (PR #281 unmerged),
so both reported "0 generic IR records in the repo catalog" -- resolved when #281 merges; the
needs_review-cannot-silently-seed concern is independent of that.

### 9.1 CONVERGED architecture (both reviews agree -- this is the design)

1. OVERRIDE SEMANTICS = Option C, PHYSICALLY SEPARATE LAYERS (not a binding marker):
   - Keep `parameterOverrides` HARD / run-enforced (genuinely frame-MANDATED values or a different
     equation). It injects at run() and locks the field.
   - Add a SEPARATE `parameterDefaults` (frame-default-profile) layer that SEEDS user-adjustable
     calculator input state and NEVER runs inside getEquation. This is the channel for the owner's
     "default assumptions/values".
   - Reason (P1, both): hard-overriding IR while the field shows the user's typed value is a
     PROVENANCE LIE -- run() replaces IR (equationDispatch.ts:312-323) but the panel reports
     foodIrInput (HHFoodWebCalculator.tsx:221-226). Result and displayed "values used" diverge.
2. SEED IMPLEMENTATION: a useEffect([jurisdiction]) re-seeds the input on frame change, mirroring the
   existing useEffect([substanceKey]) (HHFoodWebCalculator.tsx:91-109). codex: seed only a PRISTINE
   field + a "reset to frame default" affordance for dirty fields (safer). Seed flows through normal
   setState, so provenance auto-reports the correct value.
3. EquationVariantId is ONLY for true EQUATION/METHOD differences -- NOT value seeding. Do NOT
   re-register baseline under a fake variant id to carry defaults. The first move introduces NO new
   equation.
4. CATALOG LINKAGE: a frame default CITES a catalog record (store parameter_value_id for the active
   default + candidate_group_id for the slot/alternatives), NOT a literal. Requires a NEW
   generic-exposure resolver (substance_key=generic) because existing lookups are substance-scoped
   (defaultSelectionPolicy.ts:304-309; resolver.ts:80-86). This gives the Phase B generic rows their
   consumer (resolves "do not orphan").
5. needs_review LIFECYCLE (P1, both): a needs_review row may be a VISIBLE, CITABLE, ADJUSTABLE
   PENDING seed, but MUST NOT silently become an active calculation-driving default. An ACTIVE seed
   requires owner promotion (qa_status approved) OR an explicit owner override artifact. Preserves
   AI-never-sets-default + no-QA-promotion. RegulatoryFrameNotice copy must split "pending display"
   vs "active seed".
6. GUARDS to add: reject parameterDefaults/parameterOverrides on an `unsupported` (frameId,pathway)
   (human-health-food is `unsupported` for bc-csr-sediment-numerical + ccme-sediment-quality);
   require non-empty sourceIds for any parameterDefaults row; fail-closed validation on
   missing/mismatched catalog refs + stale parameter_value_id after promotion.
7. SEEDABLE-KEY ALLOWLIST (codex P2): the hard OVERRIDABLE_KEYS excludes BW_kg. The SEED layer needs
   its OWN allowlist that MAY include user-adjustable receptor assumptions (BW_kg) while excluding
   site-measured inputs (foc/fLipid) unless owner-approved.

### 9.2 REVISED SEQUENCE (synthesized; leans codex BC-first for owner-vision alignment)

- C0: build the seed INFRASTRUCTURE -- parameterDefaults/frame-default-profile shape (catalog refs +
  status policy) + validator + generic-exposure resolver + HHFood seeded-input plumbing + tests. NO
  production value change.
- C1 (optional, owner-blessed): correct the unsourced hardcoded 0.142 baseline -- but only AFTER the
  chosen WLRS value is owner-approved (else it swaps one unsourced default for a pending one).
- C-BC (vision realized): seed the BC Protocol 1 v5 HH-food frame from the WLRS recreational (0.111)
  catalog record AS A USER-ADJUSTABLE DEFAULT, gated on owner promotion of that value. No artificial
  EquationVariantId needed.
- C-nonBC (later): a non-BC frame default as a cross-frame smoke test once a real approved non-BC
  value exists.

### 9.3 The ONE divergence to settle (owner)

- Opus: prove the pipeline on a NON-BC frame FIRST (US EPA 6.5 g/day -- unambiguous delta; US-EPA
  HH-food is needs_review, not unsupported).
- codex: BC-first directly realizes the owner's BC-centric vision; non-BC-first is a distraction.
- Recommendation: BC-first; keep non-BC as the second cross-frame test.

### 9.4 Net for the owner -- decisions that remain genuinely yours

1. Confirm SEED semantics for IR (user-adjustable default), NOT a hard lock. [rec: yes]
2. Confirm BC-first vs non-BC-first for the first applied frame profile. [rec: BC-first]
3. The seed of a needs_review WLRS value is BLOCKED until you PROMOTE it (qa_status approved) or sign
   an explicit pending-seed override. Which path?
4. Confirm the seedable-key allowlist may include BW_kg (receptor assumption), excluding
   site-measured foc/fLipid.

Both reviews are GREEN on this revised design. No code until 1-4 are settled (Phase C stays gated).

### 9.5 C0 hardening (codex Leg 2, 2026-06-09) + a C-BC blocker it surfaced

The codex ship-gate review of the C0 commit added two guardrails to the resolver (both
folded in; the empty table means no current impact, but the infra must be safe before
C-BC adds a real row):
- DEFAULT-ELIGIBILITY: 'active' now requires NOT JUST qa_status=approved but also full
  default-eligibility. To avoid drift, frameDefaults REUSES the canonical gate via a new
  export defaultSelectionPolicy.getFrameSeedCandidateEligibility (wraps classifyCandidate);
  a seed is 'active' only at disposition 'eligible_pending_approval' (source-backed +
  source-verified + QA-approved + scalar single_value + non-excluded default_status + no
  policy-compilation/reference-mining source role + jurisdiction eligible + a direct-current
  source record). Any approved-but-blocked record -> status 'blocked' (never seeds). This
  stops an approved-but-policy-blocked row from becoming calculation-driving and keeps the
  seed gate in lockstep with default selection (codex 2nd-round P2: a partial hand-rolled
  mirror missed source-role / value_type / direct-current-source checks).
- UNIT GUARD: a cited record must store its value in the canonical seed unit
  (IR_food_kg_per_day -> kg/day, BW_kg -> kg); a unit mismatch (e.g. 111 g/day) resolves to
  'invalid', never seeding a scale-wrong value.

C-BC BLOCKER surfaced: the Phase B WLRS rows use jurisdiction "BC_provincial", but the BC
Protocol 1 frame's eligibleCatalogJurisdictions is ["BC", ...] (NOT "BC_provincial"). So a
BC-frame profile citing a WLRS row would resolve to 'blocked' (jurisdiction ineligible).
C-BC MUST reconcile this before the BC seed can go active: either (a) the WLRS rows use
jurisdiction "BC" (a Phase B revision), or (b) add "BC_provincial" to the BC frame's
eligibleCatalogJurisdictions, or (c) a jurisdiction-normalization mapping. Owner/HITL call.
