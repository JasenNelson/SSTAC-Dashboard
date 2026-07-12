# MATRIX OPTIONS INHALATION MODEL DECISION PACKET (refreshed 2026-07-12)

Status: REFRESH of `docs/MATRIX_OPTIONS_INHALATION_MODEL_DECISION_PACKET_2026_07_11.md` (PR #610
merged since; main tip at refresh time = 1073568). This refresh re-verifies every claim directly
against `origin/main` code + the live reference catalog (not memory) and adds the T33 unit-boundary
evidence the 07-11 packet asked for but did not yet quote. READ-ONLY drafting artifact: no code,
catalog, or Supabase writes were made while producing this packet.

## 1. CURRENT SHIPPED BEHAVIOR (verified against origin/main, commit 1073568)

- `src/lib/matrix-options/inhalation/calculator.ts` (landed in #610) is a fail-closed SHELL:
  - `HumanHealthInhalationInput` has `rfc_inhalation_mg_per_m3`, `iur_inhalation_per_mg_per_m3`,
    `targetRisk`, `hazardQuotient`, plus two RESERVED fields the code comment explicitly marks as
    unconsumed: `volatilization_factor_m3_per_kg` and `particulate_emission_factor_m3_per_kg`.
  - `deriveInhalationStandards()` returns `blocked=true`, `nonCancerBlocked=true`,
    `cancerBlocked=true`, `airConcentration_mg_per_m3: null`, `nonCancerAirS: null`,
    `cancerAirS: null` UNCONDITIONALLY -- confirmed by reading the function body: there is no branch
    that ever sets `blocked = false`. Populating RfC, IUR, VF, and PEF all at once (all four inputs
    non-null) still returns `blocked: true` with 4 warning strings; the source only pushes advisory
    warning strings ("... but ... is not yet implemented" / "... transport-model decision is
    pending; values are not consumed") and never changes the derivation.
  - `calculator.test.ts` (7 tests, verified by direct count -- codex review round 3 caught this
    packet originally overstating it as 8) locks exactly this: blocked stays true across the tested
    combinations of null/populated RfC, IUR, VF, PEF (not the full 16-case matrix -- selected
    combinations only), including a dedicated "ALL fields populated" test asserting
    `warnings.length === 4` and every output field still null. This is a regression guard against a
    future edit accidentally flipping `blocked` when VF/PEF get populated without a model decision,
    for the combinations it covers; a future implementer should add the remaining matrix cases (see
    section 5 item 3) rather than assume full coverage already exists.
  - Not called from `derivations.ts` -- grep confirms zero inhalation references in
    `src/lib/matrix-options/derivations.ts`. No dispatch path reaches this module at all today.
- `src/lib/matrix-options/types.ts` (lines 232-235): `SubstanceEntry.rfc_inhalation_mg_per_m3` and
  `.iur_inhalation_per_mg_per_m3` are both `readonly number | null`.
- `src/lib/matrix-options/substanceLibrary.ts`: verified by direct grep across the full file --
  `grep -c "rfc_inhalation_mg_per_m3: [0-9]"` = 0, `grep -c "iur_inhalation_per_mg_per_m3: [0-9]"` = 0.
  Every one of the 425 substance entries carries `rfc_inhalation_mg_per_m3: null,
  iur_inhalation_per_mg_per_m3: null`. Confirmed: 0/425 populated.
- No `HHInhalationCalculator` UI component exists in `src/components/`. The only non-test,
  non-inhalation-module references to inhalation in `src/` are: `CalculatorValueSearchPanel.tsx`
  (search-term hints for `rfc_inhalation_mg_per_m3` / `unit_risk_inhalation_per_ug_m3`, display-only)
  and `MatrixDashboard.test.tsx` (an existing catalog-value-search assertion for the benzene RfC
  display string). Neither wires a computed value.
- 97 needs_review candidate rows are waiting in the reference catalog (verified directly, see
  section 3) -- not yet promoted, not yet wired into `substanceLibrary.ts`.

## 2. THE MODEL DECISION: Option A / B / C

The inhalation pathway needs a volatilization factor (VF) and/or particulate emission factor (PEF)
to convert a soil/sediment concentration into an air concentration before RfC/IUR can produce a
standard. Three architecturally distinct ways to get VF/PEF:

### Option A: Dynamic/derived VF-PEF (computed from soil/sediment properties + site params)
- Implementation cost: LARGEST. Needs a named transport-model equation (e.g. EPA Johnson & Ettinger,
  or SSL VFss/PEF equations), new per-substance physicochemical properties (Henry's law constant,
  diffusion coefficients -- none of which exist in `SubstanceEntry` today), and a new site-input UI
  surface (organic carbon fraction, bulk density, porosity, foundation/building parameters for J&E).
- Regulatory risk: LOWEST once correctly implemented -- most technically defensible, matches how
  EPA/HC actually derive site-specific VF/PEF. But highest risk of a silent formula bug given the
  equation complexity (multi-term, several unit conversions internally).
- Data requirements: new physchem properties per substance (a second catalog expansion beyond RfC/
  IUR), new site-parameter inputs, a named transport-model source.
- Fail-closed behavior: must block per-substance on missing physchem properties AND per-site on
  missing soil parameters -- two independent block conditions to implement and test correctly.

### Option B: User-supplied VF-PEF (QP enters site-specific values directly)
- Implementation cost: SMALLEST. The reserved `volatilization_factor_m3_per_kg` and
  `particulate_emission_factor_m3_per_kg` fields already exist on `HumanHealthInhalationInput`
  (landed in #610 specifically as placeholders for this option) -- Option B is largely "consume the
  fields that are already there" rather than adding new schema.
  Requires only the calculator formula changes + a small UI input pair.
- Regulatory risk: shifts defensibility of the VF/PEF number entirely to the QP, consistent with
  this dashboard's existing "AI surfaces evidence, QP judges site-specific values" posture
  (`feedback_no_tier_judgment_for_ai.md` principle, and the "QP owns professional judgement" framing
  already used for the TRV hierarchy per `catalog_trv_hierarchy_protocol1_s44.md`).
- Data requirements: NONE beyond the two fields already reserved. No new catalog rows, no new
  physchem properties, no named transport-model source strictly required by the tool itself.
- Fail-closed behavior: identical pattern to the existing null-RfC/null-IUR gate -- blocks until the
  QP fills VF and/or PEF in. Straightforward to test (mirrors the 8 existing shell tests).
- What Option B explicitly does NOT do: no tool-side sanity check on the QP's entered VF/PEF value
  (no plausible-range guard, no cross-check against a default). A wrong VF/PEF typed in by the QP is
  not caught by the calculator.

### Option C: Hardcoded default VF-PEF (single conservative constant)
- Implementation cost: SMALL (similar magnitude to B) but carries an ongoing research/maintenance
  cost the other two do not: the constant must be justified against ONE specific named guidance
  document, and if that guidance is later revised the hardcoded constant goes silently stale.
- Regulatory risk: HIGHEST of the three for silent error -- there is no fail-closed trigger for "the
  constant is wrong" the way there is for "the QP left a field null." A stale or mis-transcribed
  constant would silently propagate into every inhalation standard computed with it, across all
  substances, with no warning.
- Data requirements: one named regulatory default source, applied uniformly across all substances and
  presumably all site types (soil vs sediment; a value derived for soil general-use may not be
  defensible for a sediment-specific context without saying so explicitly).
- Fail-closed behavior: no missing-input block for VF/PEF itself since it is a constant, not a user
  input -- only the null-RfC/IUR gate still applies. This is the weakest fail-closed posture of the
  three options.

## 3. RECOMMENDATION: Option B (user-supplied VF/PEF)

Recommend Option B, for reasons that go beyond the 07-11 packet's engineering-sequencing framing --
this refresh finds Option B is ALSO the best-fit option on defensibility grounds, not just speed:

1. **Smallest scope, and the scope that already exists.** The `volatilization_factor_m3_per_kg` /
   `particulate_emission_factor_m3_per_kg` fields are already reserved on
   `HumanHealthInhalationInput` specifically for this decision (per the #610 code comment). Choosing
   B means consuming fields that already shipped, rather than adding new schema (A) or a new sourced
   constant (C).
2. **Fully fail-closed, with a regression guard already in place.** The existing 8-test shell suite
   already proves the calculator stays blocked when VF/PEF are populated without RfC/IUR (and vice
   versa) -- Option B's implementation is additive to that guard, not a rewrite of it.
3. **Consistent with the dashboard's standing "QP owns site-specific judgment" posture.** Matches how
   the TRV hierarchy and cumulative-effects lanes already treat site-specific and professional-
   judgment values: AI/tool surfaces evidence and structure; the QP supplies and defends
   site-specific numbers. This is the same posture already applied to the oral pathway's
   `current_default` selection.
4. **No new primary-source research burden to UNBLOCK the calculator.** Option A requires locating
   and primary-verifying a transport-model equation AND per-substance physchem properties before a
   single inhalation standard can compute. Option C requires locating and primary-verifying one
   named default source. Option B needs neither to become minimally functional.

What Option B does NOT do (repeating explicitly, since this is the main defensibility gap the owner
should weigh): no tool-side plausibility check on the QP's entered VF/PEF. If the owner wants a
future safety net, a bounded Option A or C sanity-check layer (e.g. "warn if entered VF/PEF is >10x a
reference default") could be added later as a non-blocking advisory, without changing B's core
fail-closed gate. That is out of scope for this packet's approval ask.

**The VF/PEF source-anchor question remains open even under Option B.** The QP enters values, but the
dashboard's documentation and any future Option-C-style default/sanity-check layer still need the
owner to name which guidance anchors VF/PEF: EPA J&E / RAGS Part F family, Health Canada, or a
BC-specific source. This is a documentation/future-tooling question, not a blocker for shipping
Option B's user-input path, but it should be answered in the same approval round so the UI can label
the input fields correctly (e.g. "VF (m3/kg), per [named guidance]" instead of an unattributed number
box).

## 4. T33 UNIT BOUNDARY -- verified directly against the live catalog

Verified by loading `matrix_research/reference_catalog/human_health_trv_values.json` from
`origin/main` (1574 total parameter_value rows) and filtering by `input_key`.

**Catalog storage units (100% consistent within each input_key -- no mixed-unit surprises):**
- `input_key: "rfc_inhalation_mg_per_m3"` -- 188 rows total (113 approved, 75 needs_review). EVERY
  ONE of the 188 rows carries `"unit": "mg/m3"`. Example (approved, for cross-check):
  ```
  parameter_value_id: pv-iris-benzene-hh-direct-rfc
  substance_key: benzene, value: 0.03, unit: "mg/m3", qa_status: approved
  ```
  Example (needs_review, one of the 75):
  ```
  parameter_value_id: pv-p28-acetone_cyanohydrin-hh-direct-rfc
  substance_key: acetone_cyanohydrin, value: 0.002, unit: "mg/m3", qa_status: needs_review
  source: src-bc-protocol-28-v3-0-2024
  ```
- `input_key: "unit_risk_inhalation_per_ug_m3"` -- 94 rows total (72 approved, 22 needs_review).
  EVERY ONE of the 94 rows carries `"unit": "per ug/m3"` (NOT per-mg/m3). Example (approved):
  ```
  parameter_value_id: pv-iris-benzene-hh-direct-iur
  substance_key: benzene, value: "2.2e-6 to 7.8e-6" (range), unit: "per ug/m3", qa_status: approved
  ```
  Example (needs_review, one of the 22 -- all 22 needs_review IUR rows are value_type: single_value,
  none are ranges, so there is no range-collapse ambiguity blocking promotion):
  ```
  parameter_value_id: pv-p28-acetaldehyde-hh-direct-iur
  substance_key: acetaldehyde, value: 2.2e-06, unit: "per ug/m3", qa_status: needs_review
  source: src-bc-protocol-28-v3-0-2024
  ```
- **97 = 75 + 22, confirmed exactly** (matches the count already cited in the 07-11 packet; this
  refresh independently re-derived it from the live JSON rather than trusting the prior doc).

**Runtime/library field units (from `types.ts` doc comments, lines 232-235):**
- `rfc_inhalation_mg_per_m3` -- "Inhalation Reference Concentration (non-cancer). mg/m3."
- `iur_inhalation_per_mg_per_m3` -- "Inhalation Unit Risk (cancer). (mg/m3)^-1."

**The boundary, stated exactly:**
- RfC: catalog unit "mg/m3" == library unit "mg/m3". NO conversion needed; a straight promotion of
  the numeric `value` is correct for all 75 needs_review RfC rows.
- IUR: catalog unit "per ug/m3" != library unit "(mg/m3)^-1" == "per mg/m3". A x1000 conversion IS
  required: `library_value = catalog_value * 1000`. Getting this backwards (dividing instead of
  multiplying, or promoting the raw catalog number unconverted) silently produces a library IUR that
  is 1,000,000x wrong in the wrong direction (missing the x1000 AND inverting reciprocal sense would
  compound), or 1000x wrong if only the multiplier is dropped -- either way a materially non-
  conservative (or absurdly over-conservative) cancer-risk-based standard with no fail-closed catch,
  because a wrong-but-plausible-looking number does not trip the existing null-gate.

**A conversion utility for exactly this case ALREADY EXISTS and is already tested against this exact
pair of units -- this is the key new finding of this refresh, not present in the 07-11 packet:**
`src/lib/matrix-options/unitNormalization.ts::normalizeToBase()`. Its own test suite
(`unitNormalization.test.ts`) includes a case literally named for this: `'normalizes inhalation unit
risk across reciprocal bases (benzene IUR case)'`, asserting
`normalizeToBase('7.8e-6', 'per ug/m3', 'inhalation_unit_risk')` returns
`{ value: 7.8e-3, baseUnit: '(mg/m3)-1' }` -- i.e. 7.8e-6 * 1000 = 7.8e-3, exactly the library's
target unit and exactly the x1000 factor described above. It also has the RfC case (`'mg/m3'` and
`'ug/m3'` both normalize to base `'mg/m3'`) and is FAIL-CLOSED by design (unrecognized units return
null; the module's own header comment states this explicitly). Today `normalizeToBase` is called
only from `defaultSelectionPolicy.ts` and `provenance/library.ts` for cross-source comparability
checks (deciding whether a set of candidate rows can be safely compared/ranked) -- it is NOT currently
called from any promotion script. CORRECTION (caught by codex review of this packet): two existing
`promote-*.mjs` scripts DO already target inhalation input_keys, but only for the catalog-side
qa_status flip, not for library-wiring or unit conversion -- `promote-hc-trv-v4-2025.mjs` and
`promote-iris-chemdetails.mjs` both write `rfc_inhalation_mg_per_m3` / `unit_risk_inhalation_per_ug_m3`
rows into `matrix_research/reference_catalog/human_health_trv_values.json` (verified: their only
`fs.writeFileSync` targets are the catalog JSON files, never `substanceLibrary.ts`, and neither calls
`normalizeToBase` or performs any `* 1000` conversion -- confirmed by direct grep of both files).
`wire-recon.mjs` is the one script that reads `substanceLibrary.ts` for inhalation candidates, but it
is read-only recon (writes only to `scripts/matrix-options/_recon/wire_candidates*`), and its
`checkUnit()` helper only validates that a candidate row's stored unit string matches an expected
constant -- it does not convert values or write to the library either. So the packet's underlying point
still holds: no script today performs the library-wiring write with unit conversion into
`substanceLibrary.ts` for inhalation rows; the promotion script described below (section 4's
"Recommended single canonical conversion point") is new work, not a rename of an existing one.

**Recommended single canonical conversion point:** reuse `normalizeToBase()` inside the future
inhalation promotion script (a new `promote-*-inhalation-*.mjs`, following the existing dry-run/
`--apply` convention used by every other promote script), calling it once per candidate row at
promotion time. CORRECTION (caught by codex review round 2): `SubstanceEntry.rfc_inhalation_mg_per_m3`
and `.iur_inhalation_per_mg_per_m3` are `number | null` scalars (see `types.ts` lines 232-235), not
objects -- write ONLY the normalized `.value` scalar into `substanceLibrary.ts`; use the returned
`.baseUnit` solely as an assertion/validation check (assert it equals the expected target unit string
for that input_key, e.g. `'(mg/m3)-1'` for IUR or `'mg/m3'` for RfC) before writing the scalar, then
discard it -- never persist a `{value, baseUnit}` object into the library field. Do NOT re-derive the
x1000 conversion inline in the promotion script with a hand-written multiplier -- call the existing
tested function so there is exactly one conversion implementation in the codebase. Do NOT convert
again at read time (the library field is already in target units once promoted); a second conversion
at read time would be the double-conversion failure mode described below.

**Tests needed before ANY IUR row is promoted (to prevent a 1000x error reaching a shipped default):**
1. A golden-row round-trip test: given the real benzene-shaped catalog input
   (`7.8e-6`, `"per ug/m3"`), assert the promoted library value is exactly `7.8e-3` -- i.e. literally
   reuse the existing `unitNormalization.test.ts` assertion as the promotion script's golden case,
   not a fresh hand-computed expectation that could itself be miscalculated.
2. A "no double-conversion" guard: a value already expressed in `"(mg/m3)-1"` / `"per mg/m3"` fed
   into the promotion path must NOT be multiplied by 1000 again -- assert `normalizeToBase` (or the
   promotion wrapper) is idempotent-safe by unit-string dispatch, not by re-running the conversion
   unconditionally.
3. An RfC identity guard: a `"mg/m3"` RfC row promotes with value UNCHANGED (multiplier of 1), and a
   hypothetical `"ug/m3"` RfC row (none currently exist in the 75, but the normalizer supports it)
   would correctly divide by 1000 -- covering both directions of the mass-prefix table.
4. A fail-closed unit guard: any row whose `unit` string is NOT one of the two catalog-confirmed
   strings (`"mg/m3"` for RfC, `"per ug/m3"` for IUR) must cause the promotion script to REFUSE that
   row (print/flag, do not silently promote with a best-guess conversion) -- this protects against a
   future catalog entry using a novel unit string (e.g. a hypothetical `"(ug/m3)-1"` HC row) that
   `normalizeToBase` might mis-classify or reject; fail-closed here means "flag for owner", never
   "guess and promote."
5. A full-97 dry-run assertion: run the promotion script in dry-run over all 97 candidate rows and
   assert (a) all 75 RfC rows classify as identity-multiplier and (b) all 22 IUR rows classify as
   x1000, with zero rows falling into the "unit unrecognized, refuse" branch -- proving in one test
   that the live catalog data genuinely matches the two-unit-string assumption documented above,
   not just the two example rows quoted here.

## 5. WHAT WOULD BE IMPLEMENTED AFTER APPROVAL (exact list, Option B path)

1. **Headless formulas** in `src/lib/matrix-options/inhalation/calculator.ts`:
   - Non-cancer: air concentration -> HQ using RfC (`hazardQuotient = airConc / RfC`, or the inverse
     "back-solve max allowable air/soil concentration" direction depending on which way the dashboard's
     other HH calculators run -- confirm against `directContact`/`foodWeb` calculator conventions
     before implementing, do not assume).
   - Cancer: air concentration -> risk using IUR and `targetRisk`, using the promoted
     `iur_inhalation_per_mg_per_m3` (already in library target units per section 4 -- no conversion
     needed at calculator-call time, only at promotion time).
   - Soil/sediment-to-air conversion consumes the (now real, QP-supplied) VF/PEF fields.
   - `blocked` must become conditional (false when RfC/IUR + VF/PEF as applicable are all present),
     replacing today's unconditional `true` -- this is the one line the current 8-test shell suite is
     specifically guarding; those tests will need deliberate, reviewed updates, not a blanket relax.
2. **UI**: VF/PEF numeric input pair on the inhalation input form, plus a new
   `HHInhalationCalculator` component (does not exist today) wired into the Matrix Options UI tree
   alongside the existing direct-contact / food-web calculators.
3. **Tests**: the 5 T33 conversion/guard tests in section 4, PLUS calculator-level tests for the new
   non-cancer/cancer formula paths (including a fail-closed case: VF/PEF present but RfC/IUR absent,
   and vice versa), PLUS updated/superseding versions of the current 8 shell tests reflecting the new
   conditional-blocked behavior.
4. **Provenance display**: surface the `needs_review` flag on promoted rfc/iur values in whatever UI
   shows provenance/QA status for other promoted values today (matches existing pattern; do not
   invent a new provenance UI just for inhalation).
5. **needs_review handling**: promoted needs_review rows remain usable-but-flagged in the calculator
   per the standing `feedback_needs_review_values_usable_build_first_review_later.md` policy --
   build first, keep the honest flag, do not gate the calculator itself on qa_status.
6. **Promotion**: a new `promote-*-inhalation-*.mjs` script following the existing dry-run-default /
   `--apply`-with-`--reviewer`/`--date` convention (see `promote-eco-source.mjs` for the pattern). AI
   authors the script and runs DRY-RUN only, presenting the before/after plan for all 97 rows. The
   OWNER runs `--apply` (this is an explicit instruction constraint for this packet's scope, not
   negotiable by this session).

## 6. EXACT STOP CONDITIONS (when to stop and ask, once implementation starts)

- No VF/PEF source anchor named by the owner (needed at minimum for correct UI field labeling; see
  section 3's open question).
- Any T33 unit ambiguity that does not resolve cleanly against the two confirmed catalog unit strings
  (`"mg/m3"` for RfC, `"per ug/m3"` for IUR) -- e.g. a future catalog addition using a third unit
  string for either input_key.
- Any IUR row (in the 22 needs_review or any future addition) whose stored unit is anything other
  than the two confirmed strings, OR whose `value_type` is `range` rather than `single_value` (all 22
  current needs_review IUR rows are single_value; a range row needs an owner-directed selection rule
  before it can promote, same as the existing TRV-hierarchy range handling).
- Any catalog value that fails primary-source re-verification during the promotion dry-run (matches
  the standing "AI finds + verifies values" policy -- verify against the live source, not memory).
- Anything requiring a catalog VALUE change (not just a promotion/wiring action) -- catalog mutation
  beyond promotion is out of scope for this lane per CLAUDE.md's "no catalog mutation" rule.
- Ambiguity about which direction the HQ/risk formula runs (see section 5 item 1) relative to the
  existing direct-contact/food-web calculator conventions -- confirm, do not assume, before coding.

## 7. PASTE-READY OWNER APPROVAL SENTENCE

"I approve Option B (user-supplied VF/PEF) as the inhalation transport-model path; the VF/PEF source
anchor for documentation/UI labeling is [EPA J&E/RAGS Part F | Health Canada | BC-specific -- owner to
select]; and I confirm the T33 unit boundary as documented (catalog RfC 'mg/m3' promotes unchanged,
catalog IUR 'per ug/m3' promotes via the existing normalizeToBase x1000 conversion to library
'(mg/m3)-1', with the 5 listed guard tests required before any of the 97 rows promote) -- proceed with
implementation per section 5."
