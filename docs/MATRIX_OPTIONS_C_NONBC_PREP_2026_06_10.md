# C-nonBC prep -- second frame default (cross-frame smoke test) -- 2026-06-10

Plain ASCII. Prep artifact for the next Phase C increment after C-BC (shipped, PR #286).
C-nonBC proves the frame-default-seed pipeline on a NON-BC frame, per the design's
cross-frame smoke-test recommendation (docs/MATRIX_OPTIONS_PHASE_C_FRAME_VARIANT_DESIGN_2026_06_09.md
sec 9.3). It is OWNER-GATED -- do not code until the prerequisites below are met.

## Blocker discovered 2026-06-10 (catalog scan)

There are exactly 3 `IR_food_kg_per_day` rows in the catalog, ALL jurisdiction=BC (the WLRS
subsistence/recreational/low-level set). There is **NO non-BC HH-food IR_food candidate** in the
catalog (no US_federal, Canada_federal, or general row). So C-nonBC cannot cite an existing record
the way C-BC cited the WLRS recreational row -- the non-BC value must be ADDED to the catalog FIRST.

This makes C-nonBC a THREE-step path, not the one-step "promote then code" that C-BC was:

## Step A (owner-approved CATALOG ADDITION) -- add the non-BC IR candidate

Per the design, the natural choice is a US EPA default fish-consumption rate for the
`us-epa-usace-sediment` frame (HH-food is needs_review, not unsupported, for that frame -- a clean
cross-frame delta vs BC's 0.111). OWNER MUST CONFIRM the exact value + primary source (regulatory
data -- AI will not guess it). Candidate values seen in the literature/design notes:
  - US EPA default adult fish consumption ~17.5 g/day (0.0175 kg/day) (EPA 2000 / current default), OR
  - 6.5 g/day (0.0065 kg/day) (older EPA national default; the design doc's example).
ACTION: owner picks the value + cites the primary US EPA source. Then add ONE catalog row
(matrix_research/reference_catalog/parameter_values.json) mirroring the WLRS row shape:
  - substance_key 'generic', pathway 'human-health-food', input_key 'IR_food_kg_per_day',
    value <chosen>, unit 'kg/day', value_type 'single_value', jurisdiction 'US_federal',
    candidate_group_id 'human-health-food__generic__IR_food_kg_per_day__US_federal',
    default_status 'available_option', qa_status 'needs_review',
    evidence_support_status 'pending_source_locator', canonical_source_status
    'needs_direct_source_check', source_ids ['<new us-epa source id>'].
  Add the matching catalog_sources row (sources.json) for the US EPA document (url/zotero later).
  This is catalog mutation -> owner approval required (dashboard CLAUDE.md "No catalog mutation").
  Adding a needs_review candidate is the same pattern as PR #281 (WLRS rows). Update the
  library.test.ts audit counts for +1 value group + the pending/available counts as #281 did.

## Step B (owner promotion) -- verify + promote the new value

Same promote-first gate as #285. Owner verifies the value against the primary US EPA source, then
runs a promotion (a generalized version of scripts/matrix-options/promote-wlrs-default.mjs, or a new
analogous helper) so the row reaches qa_status=approved + approved_source_backed +
direct_source_verified with a durable locator. AI never writes qa_status. Bump library.test.ts
approvedSourceBacked +1 / pendingSourceLocator -1 in the promotion commit.

NOTE: the `us-epa-usace-sediment` frame's eligibleCatalogJurisdictions MUST include 'US_federal'
for the seed to resolve 'active' (verify in regulatoryFrames.ts; if not, that frame's jurisdiction
eligibility is the gate, analogous to the BC_provincial blocker C-BC hit).

## Step C (AI build -- small, once A+B land) -- profile row + LABEL FIX + tests

The SEEDING wiring is frame-agnostic (seedIrFor/activeIrDefaultFor/the during-render reseed key
off the active jurisdiction's frame default generically), so the value seeds + attributes
correctly for any frame. BUT there is ONE required component change (codex 2026-06-10, P2):

  CORRECTION: the frame-default LABEL is HARDCODED to BC. HHFoodWebCalculator.tsx (~line 414)
  renders: "Frame default {value} kg/day (BC WLRS 2023, recreational). Adjustable." -- the
  "(BC WLRS 2023, recreational)" descriptor is a literal. A US EPA default would seed + attribute
  the right value but DISPLAY THE WRONG SOURCE ("BC WLRS 2023") -- a provenance-label lie.
  C-nonBC MUST generalize the label: derive the source descriptor from the active default rather
  than hardcode it. Options: (a) add a short `label`/`sourceLabel` field to FrameDefaultProfileRow
  (and surface it on ResolvedFrameDefault) so each profile carries its own human descriptor; or
  (b) resolve the cited source's short_citation via getSourceRecord(activeIrDefault sourceIds[0]).
  Option (a) is cleaner + keeps the label a pure function of the profile. Backfill the BC row's
  label so C-BC's displayed text is unchanged.

So C-nonBC = :
  1. Generalize the frame-default label (above) so it shows the correct per-frame source. Keep the
     BC row rendering identically ("BC WLRS 2023, recreational").
  2. Add a second FRAME_DEFAULT_PROFILES row (frameDefaults.ts): us-epa-usace-sediment +
     human-health-food, citing the new US_federal parameterValueId + candidate_group_id +
     sourceIds (in-repo source_id, per the C-BC precedent + the getSourceRecord/subset invariant).
     us-epa-usace-sediment ALREADY lists 'US_federal' in eligibleCatalogJurisdictions (codex
     confirmed 2026-06-10) -- so no jurisdiction-gate blocker (unlike the BC_provincial case).
  3. Tests: frameDefaults.integration.test.ts -- US EPA frame resolves an ACTIVE IR seed of the
     chosen value; component test -- the label shows the US EPA source (NOT "BC WLRS"); switching
     BC <-> US EPA reseeds the value correctly (prevJurisdiction during-render logic handles it).
  4. Full gates + codex; AI-merge after CI green.

AI gate before coding C (same correction as C-BC): do NOT check the live FRAME_DEFAULT_PROFILES
table emptiness; verify the new US_federal record is promoted (approved + eligible) via a synthetic
profile through getActiveFrameDefaults(...,{profiles:[synthetic]}) against live records.

## Summary for owner

C-nonBC is blocked on TWO owner actions that don't exist yet: (A) add a non-BC IR catalog candidate
(owner picks value + source), (B) promote it. Once both land, the AI build (Step C) is small but
NOT zero-component: generalize the hardcoded "BC WLRS 2023" frame-default LABEL (codex P2) +
add the profile row + tests. The SEEDING/attribution wiring is already frame-agnostic; only the
displayed source label needs generalizing. If you'd rather prove the pipeline on a value that is
EASIER to source, BW_kg is the other seedable key -- but it has the same "no non-BC value in catalog
yet" situation. Recommend: pick the US EPA fish-consumption value + source, and I'll author the
Step A candidate row (needs_review) for your review, then you promote, then I ship Step C.
