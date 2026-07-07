# Matrix Options -- Cumulative-Effects Implementation Plan (A1-A4)

Status: PLAN (not for implementation this session -- develop + harden + codex-review only). Executes the
verified spec `MATRIX_OPTIONS_CUMULATIVE_EFFECTS_IMPLEMENTATION_SPEC_2026_07_06.md`. Grounded in the
actual MO calculation architecture (see Section 1). Every value stays needs_review / owner-attested per
the dashboard rules; this plan adds INFRASTRUCTURE (reference tables + reducer functions + a pathway),
which is additive and build-first, not a mutation of any approved catalog value or default.

## 0. Scope + guardrails

- **Build-first, zero policy mutation.** A1 (factor tables) and A3a (standalone reducer functions +
  compare step + tests) are purely ADDITIVE new files/functions. Because the reducers are standalone
  utilities and DO NOT extend `ProvenancePathway` (D0), they touch no `Record<ProvenancePathway,...>`
  map, no frame literal, no Evidence-Library facet, and no existing calculator -- so "zero change to
  existing calculator output / catalog value / default / qa_status / the seed==default invariant" is
  genuinely true (this was overstated in the pre-review draft, which had extended the union).
  Reference-table numbers carry a per-row `verified | needs_review` flag; the calc runs build-first with
  provisional factors clearly labeled (per `feedback_needs_review_values_usable_build_first_review_later`).
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
  (`humanHealthDirectContact(input)`, `ecoDirectEqP(input)`, ...). `getEquation` returns a
  SINGLE-ARGUMENT `run(input: PathwayInput<P>) => PathwayResult<P>` (equationDispatch.ts:87).
- **`ProvenancePathway` is a RUNTIME const array** `PROVENANCE_PATHWAYS` in
  `src/lib/matrix-options/provenance/pathways.ts:30-38` with **5 members** (it already includes
  `'background-adjustment'`); `types.ts` only re-exports it. Membership is SEMANTIC, not just a type:
  `isProvenancePathway()` (pathways.ts:69) gates "may be assigned as a single-substance calculator
  default / fed into equation dispatch / default-selection", and `resolver.ts:109` passes the pathway
  straight into `getParameterValueRecordsForSubstance`. A cumulative (multi-substance) calc is NOT that
  kind of pathway. Adding a member has a ~10-site compile + semantic blast radius across 5 files
  (`regulatoryFrames.ts` `Record<ProvenancePathway,...>` x6 frame literals; two `PATHWAY_LABELS` maps in
  `EvidenceLibrary.tsx` + `library.ts`; `OVERRIDE_BLOCK_KEY`/`OVERRIDABLE_KEYS`; `SEEDABLE_KEYS`; the
  `PathwayInput/Result` conditional types silently resolving to `never`). **=> DO NOT extend
  `ProvenancePathway` (see Section 2 / A3a).**
- **Precedent for the cumulative reducers:** `utl9595` and `avsSemCheck` are pure calc functions in
  `derivations.ts` that are NOT dispatch targets -- `getEquation` throws on their "pathways" and callers
  invoke them DIRECTLY. `background-adjustment` is likewise a pathway that bypasses dispatch. The
  cumulative reducers should follow this model exactly: standalone exported functions, called directly.
  Also: TEF/RPF potency weighting already exists in the taxonomy as the `hh-toxicity-weighting`
  `CatalogEvidencePathway` (pathways.ts:88-105), which `isProvenancePathway` correctly returns FALSE for
  -- the provenance/equations.json home already exists without touching the calculator-pathway union.
- **NO multi-substance / summation pattern exists** -- every calculator is single-substance. The HH
  functions (`humanHealthDirectContact`, derivations.ts:504) do NOT take a site concentration and do NOT
  emit a verdict; they BACK-CALCULATE a screening standard `sedS` from RfD/SF + exposure factors. Only
  `ecoDirectEqP` takes a `Cs` and emits PASS/FAIL. This asymmetry is load-bearing for D1 below.
- **`equations.json` is type-coupled to the union:** `EquationRecord.pathway: ProvenancePathway`
  (types.ts:169). A new `eq-cumulative-*` record therefore CANNOT carry a new pathway string without
  extending the union -- so the records must reuse an existing pathway or the `hh-toxicity-weighting`
  evidence category, per the union-avoidance decision. (Section 1's earlier "freely decoupled" framing
  was wrong: the executable math is decoupled, but the provenance record's `pathway` field is not.)
- **Factor-table pattern = `src/lib/matrix-options/utlTable.ts`**: a typed `readonly` const array
  (`K_95_95_TABLE`) + a `lookupK9595(n)` helper + `__tests__`, imported directly by `derivations.ts`.
  This is the model for the TEF / RPF / ADAF tables (NOT JSON, NOT Supabase). `abs_dermal` is a
  per-substance scalar on `SubstanceEntry`; no ADAF table exists yet.
- Frame wiring: `frameDefaults.ts` (FRAME_DEFAULT_PROFILES, SEEDABLE_KEYS) seeds inputs;
  `regulatoryFrames.ts` (`sourceHierarchy`) surfaces which authority a frame uses;
  `RegulatoryFrameNotice.tsx` renders it.
- Tests: `src/lib/matrix-options/__tests__/derivations.test.ts` -- Vitest, numeric pins to design-doc
  "Anchor Case" worked examples, `toBeCloseTo`, `toThrow` validation, `warnings[]` assertions.

## 2. The load-bearing design decisions (RESOLVED post Leg-1 review; feed every task)

A TEQ / BaP-eq calc takes MANY per-congener/per-PAH SITE concentrations, multiplies each by a potency
factor, and SUMS them into one equivalent concentration, then compares that to a single reference
benchmark (TCDD TDI, or a BaP-anchored standard). Three decisions, corrected after the Leg-1 review
verified the code:

- **D0 -- DO NOT extend `ProvenancePathway`; make the reducers standalone utilities.** (Supersedes the
  original "add cumulative pathways + register in dispatch" idea, which mis-modeled the union and had a
  ~10-site blast radius -- see Section 1.) `computeTEQ`/`computeBaPeq` are plain exported functions in
  (or beside) `derivations.ts`, called DIRECTLY by the UI, exactly like `utl9595`/`avsSemCheck`. They
  are NOT registered in `equationDispatch.ts` / `BASELINE_FUNCTIONS` (dispatch's single-arg
  `run(input)` signature structurally cannot hold a multi-arg array-input reducer anyway). Edition/
  scheme is a plain function argument chosen by a small resolver -- `resolveTefEdition(frameId, receptor)`
  (RECEPTOR-AWARE, because TEF editions are taxa-specific) and a frame-only `FRAME_RPF_SCHEME` (RPF is
  human-health only) -- NOT the `EquationVariantId`/`frameVariants.ts` machinery, which is dispatch-bound.
  Details in A3a.
- **D1 -- the reducer emits an equivalent CONCENTRATION; a small NEW compare step consumes it.**
  (Corrected: the original "feed TEQ as the concentration of TCDD into the existing HH calculator" was
  wrong -- the HH functions produce a screening STANDARD, not a verdict-from-concentration.) So: the
  reducer returns `{teq | bapEq, contributions[], warnings[]}`; comparison to the benchmark is a
  distinct step -- for the HH cases, derive the TCDD/BaP screening standard via the existing HH path,
  then compare the summed equivalent against that standard. Keep the reducer PURE (no verdict); the
  compare step is new, small, and testable. Do NOT try to force the N-congener concept through the
  single-substance calculator input.
- **D2 -- N-congener provenance attribution has no existing shape; A3a MUST define it.** `CalculatorUsedValue`
  carries a single `substance_key` and `resolveTupleRecord` resolves one tuple; there is no used-value/
  provenance-row shape for N congener contributions. A3a therefore defines the
  contributions-to-provenance mapping (each congener contribution -> a provenance row, factor cited from
  the TEF/RPF table + its `hh-toxicity-weighting` evidence source) so A3b's UI can render the
  contribution table. This is part of the SHIPPABLE core, not deferred.
- **D3 -- split A3 into A3a (headless, shippable now) + A3b (input-grid UI, follow-on PR).** Congener/PAH
  SITE concentrations are user/site data, not catalog TRVs; the calculators have no multi-row input
  grid. A3a = reducers + factor tables + the provenance-contribution shape + the compare step + tests
  (all headless). A3b = the new per-congener/per-PAH input-grid component. A3a must expose the
  contribution + provenance shape A3b consumes (per D2), else A3b stalls.

## 3. A1 -- Reference tables (build-first; HC rows verified, others needs_review)

New files, each following the `utlTable.ts` pattern (typed `readonly` const + lookup helper + provenance
header + per-row `qa: 'verified' | 'needs_review'` + `sourceId`), with `__tests__`:
- `src/lib/matrix-options/tefTable.ts` -- congener (by IUPAC/BZ number for PCBs; standard name for
  PCDD/PCDF) -> TEF, keyed by edition: `who-2005`, `who-1998-mammal`, `who-1998-avian`, `who-1998-fish`,
  `who-2022-devito-2024`. Seed the WHO-2005/1998 columns from spec Section 2; TRANSCRIBE the
  DeVito-2024 column from HC TRV v4.0 Table 4 (pp. 54-55) via the .venv extractor (this is the A1
  extraction step; delegate the PDF read).
- `src/lib/matrix-options/rpfTable.ts` -- PAH (by CAS) -> RPF, keyed by scheme. The `RpfScheme` union is
  the CANONICAL scheme list and MUST match the keys used by `FRAME_RPF_SCHEME` in A3a:
  `nisbet-1992 | hc-pqra-v3 | epa-1993 | epa-2010-draft | ccme-2010 | who-1998-pah`. Seed the
  well-defined columns from spec Section 3; add the framework-specific schemes (epa-1993, ccme-2010,
  who-1998-pah) from A2 verification; flag every row needs_review pending A2.
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

A3a (headless core -- SHIPPABLE build-first; NO union / dispatch changes per D0):
- **Do NOT touch `ProvenancePathway` / `PROVENANCE_PATHWAYS` / `equationDispatch.ts` / `frameVariants.ts`.**
  The reducers are standalone (the `utl9595`/`avsSemCheck` precedent).
- **UNIT CONTRACT (explicit -- per codex Leg-2 + `feedback_always_report_and_normalize_units`; the
  #1 pre-execution requirement).** TEF/RPF are UNITLESS scalars. Every concentration entry MUST carry
  its own `unit` (e.g. `pg/g`, `ng/kg`, `ug/kg`, `mg/kg`); the reducer normalizes ALL entries to one
  canonical mass-per-mass base (recommend `mg/kg`) BEFORE summing -- never sum raw values across mixed
  units. The equivalent (`teq`/`bapEq`) is reported IN that canonical unit, explicitly labeled. The
  compare step (D1) must normalize BOTH the summed equivalent AND the HH-derived standard to the same
  unit before comparing (the HH `sedS` is mg/kg-style; a TEQ in the same medium unit is required). MDL
  (for the 0.5*MDL non-detect substitution) carries a unit too and is normalized identically. Unit
  guard: an unrecognized/missing unit, or a standard/equivalent unit mismatch, is `blocked` with a
  warning -- never a silent coercion. Reuse or extend the existing unit-normalization helper if one
  exists (`isUnitBlocked`/unit utils in `defaultSelectionPolicy.ts`); else add a small
  `normalizeConcentration(value, fromUnit, toUnit)` with its own tests.
- New reducers (in `derivations.ts` or a new `cumulative.ts` sibling it re-exports):
  - `computeTEQ(entries: {congenerId; concentration; unit; isNonDetect?; mdl?; mdlUnit?}[], edition,
    opts): {teq; teqUnit; contributions: {congenerId; factor; concentrationNorm; contribution}[];
    warnings[]; blocked?}` -- normalize -> `sum(C_i_norm * TEF_i)`; non-detect option = 0.5*MDL;
    empty-input and unknown-congener handled via warnings/blocked, never a silent 0.
  - `computeBaPeq(entries: {pahKey; concentration; unit}[], scheme, opts: {applyAdaf?; ageBin?;
    dermalRaf?}): {bapEq; bapEqUnit; contributions[]; warnings[]; blocked?}` -- normalize ->
    `sum(C_i_norm * RPF_i)`; optional ADAF age-binning; optional dermal RAF (reuse `abs_dermal`).
    Excluded (non-carcinogenic) PAHs contribute 0 and are surfaced as an informational warning, not
    silently dropped.
  - Both pure, fail-closed on malformed input (mirror the existing RangeError/TypeError validation +
    `warnings[]` conventions), no catalog mutation.
- **Compare step (per D1):** a small pure `compareEquivalentToStandard(equivalent, standard)` (or fold
  into the reducer's caller) -- for HH cases, derive the TCDD/BaP screening standard via the existing HH
  path, then compare the summed equivalent against it and emit PASS/FAIL + margin. Tested with anchors.
- **Provenance-contribution shape (per D2):** define a `CumulativeContributionRow` (congenerId/pahKey,
  `concentration` + `unit` (as entered), `concentrationNorm` (canonical mg/kg), factor,
  edition/scheme, `contribution` + `unit`, factor-source-id) and a mapping to renderable provenance
  rows, so A3b's UI + the provenance panel can attribute all N inputs WITH their units. This is part of
  A3a.
- Edition/scheme selection (RECEPTOR-AWARE for TEF -- resolved per codex, Section 8 Q5): TEF editions
  are taxa-specific, so a frame-only map CANNOT work (CCME needs mammal + avian + fish simultaneously by
  receptor). Use a resolver `resolveTefEdition(frameId, receptor): TefEdition` returning one of the real
  edition keys `who-2022-devito-2024 | who-2005 | who-1998-mammal | who-1998-avian | who-1998-fish`
  (there is NO `who-1998-taxa` key). Mapping (implements spec Section 4): HC-HH -> who-2022-devito-2024;
  BC/EPA/Ontario-HH -> who-2005; CCME/FCSAP eco -> who-1998-{mammal|avian|fish} by the eco receptor;
  HH-mammalian for CCME/FCSAP human-health -> who-1998-mammal. RPF is human-health-carcinogenic ONLY
  (no taxa split), so `FRAME_RPF_SCHEME: Record<RegulatoryFrameId, RpfScheme>` frame-only is fine, using
  the SAME `RpfScheme` union keys defined in A1 (HC -> hc-pqra-v3; EPA -> epa-2010-draft with epa-1993
  fallback; BC -> who-1998-pah; CCME/Ontario -> ccme-2010; per spec Section 4 -- verify exact
  per-framework choice in A2). Both are plain const maps/resolvers, NOT dispatch/EquationVariantId.
  Surface the active edition in the UI via `regulatoryFrames.ts` `sourceHierarchy` (read-only; no union
  change).
- `equations.json` provenance records (OPTIONAL): `EquationRecord.pathway` is typed to
  `ProvenancePathway`, so a record can ONLY carry an EXISTING calculator pathway (e.g.
  `human-health-direct`). Do NOT try to put `hh-toxicity-weighting` in `EquationRecord.pathway` -- it is
  a `CatalogEvidencePathway` (evidence category), not a `ProvenancePathway`, so it is usable for EVIDENCE
  attribution on the factor rows but not as an equation record's pathway. Practical call: either reuse
  `human-health-direct` for the two `eq-cumulative-*` records, or DEFER the JSON records entirely -- the
  TS math + the factor-table source citations (+ the `hh-toxicity-weighting` evidence tagging on factor
  rows) already carry the provenance. Recommend DEFER unless the Evidence Library needs the records.
- Tests (`__tests__/derivations.test.ts` or a new sibling): ANCHOR CASES with hand-computed expected
  values -- e.g. a 3-congener TEQ under WHO-2005 (TCDD 1.0 + PCB-126 0.1 + OCDD 0.0003 at known
  concentrations) and a small BaP-eq under HC-PQRA-v3; the compare step against a known standard; plus
  a MIXED-UNIT normalization case (entries in pg/g + ug/kg summed correctly after normalization to
  mg/kg), a standard-vs-equivalent UNIT-MISMATCH case (must `block`, not silently compare), non-detect
  (0.5*MDL with a unit), unit-block, empty-input, unknown-congener, edition-with-no-factor (fail-closed,
  no silent drop), ADAF-applied, and excluded-PAH edge cases.

A3b (input-grid UI -- FOLLOW-ON PR, deferred): a new component paralleling `HHDirectContactCalculator.tsx`
rendering a per-congener / per-PAH concentration grid -> calls the reducer + the compare step (D1) ->
renders the contribution/provenance table (the shape A3a defined per D2). A standalone view (not shoe-
horned into a single-substance calculator). Ships separately after A3a.

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

## 8. Design decisions status + remaining questions for Leg 2 codex

RESOLVED by the Leg-1 review (2026-07-06), reflected above: D0 (standalone utilities, do NOT extend
`ProvenancePathway`), D1 (reducer emits equivalent concentration + a new small compare step; HH
functions produce standards not verdicts), D2 (A3a defines the N-congener provenance-contribution
shape), D3 (A3a headless / A3b UI split). The union-expansion blast radius is now AVOIDED, not managed.

Remaining for Leg 2 codex to pressure-test:
1. Confirm the standalone-utility approach fully composes: does the compare step (D1) have clean access
   to the HH-derived standard, or does deriving that standard itself require inputs the cumulative view
   would have to collect anyway? Is `hh-toxicity-weighting` genuinely the right evidence home?
2. Congener/PAH identity: do the TEF/RPF entries need real `SubstanceEntry` rows (for the provenance
   panel), or can the `CumulativeContributionRow` shape (D2) carry attribution without them? What breaks
   in the provenance panel if a congener has no `SubstanceEntry`?
3. Non-detect / MDL handling: user input vs default; per-framework convention (spec notes 0.5*MDL is the
   Ontario standard) -- is 0.5*MDL a safe default, and should it be a per-frame setting?
4. Edition/scheme mismatch safety: if a frame's edition has no factor for a supplied congener (e.g. a
   mono-ortho PCB under a fish TEF, or an excluded PAH), the lookup must fail-closed with a warning --
   confirm the reducer surfaces it and never silently drops a component or coerces a missing factor to 0
   without a warning.
5. Eco vs human-health TEF split -- RESOLVED (codex Leg-2, 2026-07-06): YES, edition selection must be
   receptor-aware. Replaced the frame-only `FRAME_TEF_EDITION` with `resolveTefEdition(frameId, receptor)`
   over the real edition keys (who-2022-devito-2024 / who-2005 / who-1998-mammal|avian|fish; there is no
   `who-1998-taxa` key). RPF stays frame-only (human-health-carcinogenic only). See A3a.
6. Is building the calc core BEFORE all non-HC reference numbers are A2-verified acceptable under
   build-first, given every factor row is qa-flagged and any equations.json record is needs_review?
