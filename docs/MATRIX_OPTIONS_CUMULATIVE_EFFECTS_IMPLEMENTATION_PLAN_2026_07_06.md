# Matrix Options -- Cumulative-Effects Implementation Plan (A1-A4)

Status: PLAN (not for implementation this session -- develop + harden + codex-review only). Executes the
verified spec `MATRIX_OPTIONS_CUMULATIVE_EFFECTS_IMPLEMENTATION_SPEC_2026_07_06.md`. Grounded in the
actual MO calculation architecture (see Section 1). Every value stays needs_review / owner-attested per
the dashboard rules; this plan adds INFRASTRUCTURE (reference tables + reducer functions + a pathway),
which is additive and build-first, not a mutation of any approved catalog value or default.

## 0. Scope + guardrails

- **Build-first, zero policy mutation.** A1 (factor tables), A3 (reducer functions + a new pathway +
  provenance records) are ADDITIVE. They do NOT change any existing approved catalog value, default,
  or qa_status. Reference-table numbers carry a per-row `verified | needs_review` flag; the calc runs
  build-first with provisional factors clearly labeled (per
  `feedback_needs_review_values_usable_build_first_review_later`).
- **Owner-attestation required (A4 = dry-runs only).** Promoting the dioxin/DL-PCB TEQ TDI (2.3e-9) as
  an approved catalog row, resolving the benzo_a_pyrene EPA-2.0 SF, and any PCB-key/default decision END
  at owner inline attestation. This plan only prepares before/after dry-runs.
- **Verify-before-trust.** All non-HC research numbers are unverified until A2 checks them against the
  primary source. HC-side (DeVito-2024 TEF edition, 2.3e-9 TDI, BaP SF 1.289) is already verified vs the
  HC v4.0 PDF (2026-07-06).

## 1. Integration surface (VERIFIED against the codebase, 2026-07-06)

- `matrix_research/reference_catalog/equations.json` is **provenance/citation scaffolding only**;
  `equation_latex` is display metadata, never eval'd. The executable math is hand-written TypeScript in
  `src/lib/matrix-options/derivations.ts`. So a new equation = (a) a JSON provenance record AND (b) a
  real TS function -- decoupled. Existing equation_ids: eq-eco-direct-eqp-di-toro, eq-eco-food-bsaf,
  eq-background-utl-95-95, eq-human-health-direct-contact, eq-human-health-food-web.
- Calculators call `getEquation(frameId, pathway)` from `src/lib/matrix-options/equationDispatch.ts`
  (returns `{run, usedBaselineFallback, fallbackReason}`), binding to pure fns in `derivations.ts`
  (`humanHealthDirectContact(input)`, `ecoDirectEqP(input)`, ...). Dispatch maps `(frameId, pathway)`
  -> variant; `ProvenancePathway = 'eco-direct-eqp' | 'eco-food-bsaf' | 'human-health-direct' |
  'human-health-food'`. Equation-variant selection uses `EquationVariantId` + `frameVariants.ts`.
- **NO multi-substance / summation pattern exists** -- every calculator is single-substance, taking a
  single site concentration `Cs`. Closest analog is `contaminantClass`-keyed branching inside
  `ecoFoodBSAF`/`humanHealthFoodWeb`.
- **Factor-table pattern = `src/lib/matrix-options/utlTable.ts`**: a typed `readonly` const array
  (`K_95_95_TABLE`) + a `lookupK9595(n)` helper + `__tests__`, imported directly by `derivations.ts`.
  This is the model for the TEF / RPF / ADAF tables (NOT JSON, NOT Supabase). `abs_dermal` is a
  per-substance scalar on `SubstanceEntry`; no ADAF table exists yet.
- Frame wiring: `frameDefaults.ts` (FRAME_DEFAULT_PROFILES, SEEDABLE_KEYS) seeds inputs;
  `regulatoryFrames.ts` (`sourceHierarchy`) surfaces which authority a frame uses;
  `RegulatoryFrameNotice.tsx` renders it.
- Tests: `src/lib/matrix-options/__tests__/derivations.test.ts` -- Vitest, numeric pins to design-doc
  "Anchor Case" worked examples, `toBeCloseTo`, `toThrow` validation, `warnings[]` assertions.

## 2. The load-bearing design decision (RESOLVE FIRST -- feeds every task)

The existing calculators take a substance's TRV and a SINGLE site concentration and screen it. A TEQ /
BaP-eq calc is different in kind: it takes MANY per-congener/per-PAH SITE concentrations, multiplies
each by a potency factor, and SUMS them into one equivalent concentration -- which is then compared to a
single reference TRV (TCDD TDI, or a BaP criterion). Two sub-decisions the codex review must pressure:

- **DECISION D1 -- where the summed equivalent goes.** Option (a) the reducer returns ONLY the summed
  TEQ / BaP-eq value (a pure potency-weighting utility), and comparison-to-criterion stays in the
  existing single-substance screening path (feed TEQ as the "concentration" of TCDD, BaP-eq as the
  "concentration" of BaP). Option (b) the reducer also does the criterion comparison + verdict.
  RECOMMENDATION: Option (a) -- keep the reducer a pure `sum(C_i * factor_i)` and reuse the existing
  screening path for the criterion comparison (TCDD RfD/TDI, BaP SF). Smaller surface, no new verdict
  logic, and it composes with the current calculators. Codex to confirm this composes cleanly.
- **DECISION D2 -- multi-substance input source.** Congener/PAH SITE concentrations are user/site data,
  not catalog TRVs. The calculators do not currently accept a multi-row concentration grid. So A3's UI
  is a NEW component (per-congener/per-PAH concentration grid) -- bigger than the reducer. RECOMMENDATION:
  split A3 into A3a (reducer + tables + tests, headless, shippable now) and A3b (the input-grid UI +
  wiring, a follow-on). A3a delivers the computable core; A3b is a separate PR.

## 3. A1 -- Reference tables (build-first; HC rows verified, others needs_review)

New files, each following the `utlTable.ts` pattern (typed `readonly` const + lookup helper + provenance
header + per-row `qa: 'verified' | 'needs_review'` + `sourceId`), with `__tests__`:
- `src/lib/matrix-options/tefTable.ts` -- congener (by IUPAC/BZ number for PCBs; standard name for
  PCDD/PCDF) -> TEF, keyed by edition: `who-2005`, `who-1998-mammal`, `who-1998-avian`, `who-1998-fish`,
  `who-2022-devito-2024`. Seed the WHO-2005/1998 columns from spec Section 2; TRANSCRIBE the
  DeVito-2024 column from HC TRV v4.0 Table 4 (pp. 54-55) via the .venv extractor (this is the A1
  extraction step; delegate the PDF read).
- `src/lib/matrix-options/rpfTable.ts` -- PAH (by CAS) -> RPF, keyed by scheme: `nisbet-1992`,
  `hc-pqra-v3`, `epa-2010-draft`. Seed from spec Section 3; flag every row needs_review pending A2.
- `src/lib/matrix-options/adafTable.ts` -- age bin -> ADAF (0-<2 = 10, 2-<16 = 3, 16+ = 1), for the
  mutagenic-MoA PAH path. Source: US EPA 2005 supplemental guidance + HC v4.0 BaP ADAF note.
- Lookup helpers return `{factor, qa, warning}` and warn (not throw) on an unknown congener/PAH/edition
  so the reducer can surface a `warnings[]` entry rather than silently dropping a component.

## 4. A2 -- Verification of the non-HC research numbers

Delegate primary-source reads (Sonnet) per spec Section 7; mark each reference-table row verified or
leave needs_review:
- PAH RPF tables: HC PQRA v3 (Table 2 rec / Table 3 prov), EPA 2010 draft (EPA/635/R-08/012A), Nisbet &
  LaGoy 1992.
- BaP anchor CSFs: HC v4.0 1.289 (already verified), EPA IRIS-2017 (1.0 oral CSF / 6e-4 IUR); PIN the
  provenance of our catalog's existing benzo_a_pyrene EPA "2.0" SF row (research says IRIS-2017=1.0,
  pre-2017=7.3 -- neither is 2.0). Feeds A4.
- Framework criteria (for the framework->criterion mapping + any future criterion wiring): CCME SQG /
  SedQG, BC CSR Sched 3.1/3.4 + Protocol 28, Ontario O.Reg 153/04 + PSQG, EPA NRWQC. Resolve the CCME
  "21.5" ambiguity (total-PCB ISQG ug/kg vs dioxin-TEQ sediment value) flagged in the spec.
- Output: update the reference tables' per-row qa flags + a short verification-results appendix.

## 5. A3 -- Calculation core

A3a (headless core -- SHIPPABLE build-first):
- `src/lib/matrix-options/provenance/types.ts`: add `'cumulative-teq'` and `'cumulative-bap-eq'` to
  `ProvenancePathway`. WARNING: this union is referenced widely (equationDispatch conditional-type map,
  SEEDABLE_KEYS, frameDefaults, resolver, possibly exhaustive switches) -- codex must enumerate every
  site that must handle the new members so nothing breaks the build or silently mishandles them.
- `derivations.ts`:
  - `computeTEQ(entries: {congenerId; concentration; isNonDetect?; mdl?}[], edition, opts): {teq;
    contributions: {congenerId; factor; contribution}[]; warnings[]; blocked?}` -- `sum(C_i * TEF_i)`;
    non-detect option = 0.5*MDL; unit guard (all entries same unit); empty-input and unknown-congener
    handled via warnings/blocked, never a silent 0.
  - `computeBaPeq(entries: {pahKey; concentration}[], scheme, opts: {applyAdaf?; ageBin?; dermalRaf?}):
    {bapEq; contributions[]; warnings[]; blocked?}` -- `sum(C_i * RPF_i)`; optional ADAF age-binning;
    optional dermal RAF (reuse `abs_dermal`). Excluded (non-carcinogenic) PAHs contribute 0 and are
    surfaced as an informational warning, not silently dropped.
  - Both pure, fail-closed on malformed input (mirror the existing RangeError/TypeError validation +
    `warnings[]` conventions), no catalog mutation.
- `equationDispatch.ts`: register the two reducers in `BASELINE_FUNCTIONS` + the conditional-type map.
- `equations.json`: add `eq-cumulative-teq` + `eq-cumulative-bap-eq` provenance records (display latex +
  input_keys + source_ids + `qa_status: needs_review`) -- provenance only, decoupled from the TS math.
- Edition/scheme selection: add an `EquationVariantId` per edition + `frameVariants.ts` rows keyed by
  `(frameId, pathway)` implementing the spec Section 4 mapping (HC=who-2022-devito-2024;
  BC/EPA/Ontario=who-2005; CCME=who-1998-taxa). Surface the active edition via `regulatoryFrames.ts`
  `sourceHierarchy` so the UI can show "this frame uses the DeVito-2024 TEFs".
- Tests (`__tests__/derivations.test.ts` or a new sibling): ANCHOR CASES with hand-computed expected
  values -- e.g. a 3-congener TEQ under WHO-2005 (TCDD 1.0 + PCB-126 0.1 + OCDD 0.0003 at known
  concentrations) and a small BaP-eq under HC-PQRA-v3; plus non-detect (0.5*MDL), unit-block,
  empty-input, unknown-congener, ADAF-applied, and excluded-PAH edge cases (all fail-closed).

A3b (input-grid UI -- FOLLOW-ON PR, deferred): a new component paralleling `HHDirectContactCalculator.tsx`
rendering a per-congener / per-PAH concentration grid -> calls the reducer -> feeds the summed
equivalent into the existing single-substance screening path (per D1). Ships separately after A3a.

## 6. A4 -- Owner-attestation packets (dry-runs only)

1. **Dioxin / DL-PCB TEQ TDI 2.3e-9 mg TEQ/kgBW-day** (verified: HC v4.0 p.42, Faqi & Chahoud 1998):
   prepare the catalog row(s) + a promote-script dry-run. OPEN sub-question for the packet: representation
   -- a new `substance_key` (e.g. `dioxin_teq` / `dioxin_like_pcbs_teq`) with input_key
   `oral_tdi_teq_mg_per_kg_bw_day`, vs annotating the existing `pcbs_non_coplanar`. Recommend a dedicated
   TEQ key so the unit (mg TEQ/kg) is unambiguous. Owner attests value + representation.
2. **benzo_a_pyrene EPA-2.0 SF resolution**: present the A2 provenance finding + options
   (keep / correct / current_default pick between HC 1.289 and the EPA value). Owner decides. Ties to the
   HELD decision.
3. **PCB policy alignment**: the research BACKS Option A (total-default; congener/Aroclor alternatives;
   never additive) + HC's ICES-7 non-DL scoring + the 50% apportionment. Prepare the consolidation packet
   referencing `MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md`. Owner rules.

## 7. Sequencing, delegation, gates

- Order: A2 verify -> A1 tables (HC-verified rows first; DeVito-2024 transcription now) -> A3a core+tests
  -> A4 packets. A3b UI last (separate PR).
- Delegation (AGY-first): AGY authors the factor-table files + the reducer scaffolding + test skeletons
  from this plan's exact specs; the ORCHESTRATOR runs the DeVito-2024 PDF extraction + the gates + codex;
  Sonnet subagents do A2 verification reads; Opus does orchestration + D1/D2 judgment + the A4 packets.
  Per the AGY #1 rule: AGY writes, orchestrator runs + verifies via git diff + gates.
- Each shippable increment (A1, A3a) runs the full ship discipline: `/codex-review` loop (Leg 1 Opus +
  Leg 2 codex/cursor to mutual-agreement GREEN) -> lint / test:ci / monitored build / e2e -> PR -> owner
  merge. A3b likewise. A4 produces packets only (no ship until owner attests).

## 8. Open questions for the codex review to pressure-test

1. D1 (does feeding TEQ/BaP-eq as a pseudo-single-substance concentration into the existing screening
   path actually compose, or does it need a bespoke comparison?) and D2 (multi-row site-concentration
   input -- is a new component the right call, or is there a lighter path?).
2. ProvenancePathway union expansion blast radius: which files have exhaustive switches / `Record<
   ProvenancePathway, ...>` maps (SEEDABLE_KEYS, dispatch, frameDefaults, resolver) that MUST be updated,
   and could any silently mis-default the new members?
3. Non-detect / MDL handling: user input vs default; per-framework convention (spec notes 0.5*MDL is the
   Ontario standard) -- is 0.5*MDL a safe default, and should it be a per-frame setting?
4. Congener/PAH identity: do the TEF/RPF entries need real `SubstanceEntry` rows in `substanceLibrary.ts`
   (for provenance-panel attribution), or can they be pure factor-table keys? What breaks if a congener
   has no SubstanceEntry?
5. Edition mismatch safety: if a frame maps to an edition that a congener has no factor for (e.g. a
   mono-ortho PCB under a fish TEF), the lookup must fail-closed with a warning -- confirm no silent drop.
6. Is building the calc core BEFORE all reference numbers are A2-verified acceptable under build-first,
   given every factor row is qa-flagged and the equations.json record is qa_status=needs_review?
