# Autonomous MO Lane -- Owner Approval Queue (2026-06-14)

Prepared by the autonomous Matrix-Options lane (owner away). Items M5/M6 are PREP-ONLY: they need an
owner decision and/or an owner-run `promote-*.mjs --apply` (the AI never ran `--apply`). Values below
were AI-verified against primary sources; what remains is professional judgment + the attested apply.

Lane outcome this session: M0 re-sync (PR #317 already merged 5baa953); M1+M2 generic nested-source
provenance guard across all 8 promote scripts -- MERGED PR #318 (82dc33d); M3 closeout (4 lessons +
manifest vitest 3848->3856) -- MERGED PR #319 (9ce06a4); M4 coverage PR -- SKIPPED (no current
coverage-summary.json; documented MO coverage exhaustion; conditional low-priority). M5/M6 below.

---

## M5-A -- TWN WOCBA 220 g/day food-web receptor -> OWNER DECISION (recommend: do NOT build)

Finding (verified): the 220 g/day rate is IDENTICAL to the already-approved + already-shipped
`pv-wlrs-2023-ir-food-subsistence-bc` (220 g/day, wired into the `subsistence-fisher` scenario in
PR #316). The TWN Burrard Inlet WQO (BIWQO 2021) corroboration of that exact value + Richardson 1997
basis is ALREADY recorded in that catalog entry's applicability field. The only genuinely new content
a "WOCBA" receptor would add is a different body weight: BW = 69.8 kg (TWN female) vs 70.7 kg.

- Option A (RECOMMENDED, zero build cost): do not add a separate WOCBA receptor. A user who wants the
  WOCBA case selects `subsistence-fisher` (220 g/day) and adjusts BW to 69.8 kg. Optionally add a one
  line note to the subsistence scenario label mentioning the 69.8 kg WOCBA BW.
- Option B (only if you want a named WOCBA scenario): add one new catalog BW record
  `pv-twn-biwqo-2021-bw-wocba-bc` (69.8 kg, human-health-food pathway) + a `twn-wocba` frameDefaults
  row that REUSES the existing 220 g/day IR record. Small delta (one new BW record). Gated on the same
  TWN source export as M5-B (below).

OWNER ACTION: pick Option A or B. (A needs nothing; B teed up in the M5-B build spec's appendix.)

---

## M5-B -- TWN toddler 94 g/day food-web receptor -> BUILT as DRAFT PR #320, then owner --apply

STATUS: BUILT + shipped as draft PR #320 (head 331fc3d, base main). All 5 local gates GREEN (tsc,
lint, CI test:ci 234 files/0 failed/3905 tests, monitored build, e2e 138). Reviews GREEN: a multi-lens
review workflow + codex (Spark + 5.5-xhigh) mutual-agreement across 4 rounds (caught + fixed: a BW
provenance mis-attribution, a missing blocking-relationship-role guard, a missing read-only HC-source
precondition, the catalog evidence.qa_status invariant via a uniform pre-state, and a contradictory
provenance-text clause). Scenario resolves PENDING / not-selectable (pre-promotion); tests assert it.
The PR is a DRAFT and was NOT merged. OWNER: review #320, then do the two activation steps below.

Verdict: GENUINELY NEW, values AI-verified.

Verified values (TWN Burrard Inlet WQO Tissue Quality Objectives, ENV + HLTH 2021, Table 1; same
primary verified in the #316 session):
- IR_food = 94 g/day = 0.094 kg/day (toddler subsistence)
- BW = 16.5 kg (toddler)
- Basis: aspirational Indigenous-subsistence (Richardson 1997). CAVEAT (carry into applicability):
  TWN tissue values are ambient WQO, NOT remediation/CSR guidelines -- the safe use is the receptor
  consumption-rate EXPOSURE FACTOR only (same caveat already embedded in the subsistence entry).

Build spec (fork the #316 subsistence + #317 ACFN pattern; all paths relative to repo root):
1. `matrix_research/reference_catalog/sources.json` -- source `src-bc-twn-burrard-inlet-wqo-tissue-2021`
   ALREADY EXISTS (canonical_source_status = needs_direct_source_check; zotero_status =
   pending_owner_export; URL = open gov.bc.ca PDF). No new source row; the promote script upgrades its
   status on `--apply`.
2. `matrix_research/reference_catalog/parameter_values.json` -- add:
   - `pv-twn-biwqo-2021-ir-food-toddler-bc` (0.094 kg/day, input_key IR_food_kg_per_day,
     pathway human-health-food, jurisdiction BC, qa_status needs_review, evidence -> the TWN source).
   - `pv-twn-biwqo-2021-bw-toddler-food-bc` (16.5 kg, BW_kg, pathway human-health-FOOD -- a NEW
     food-pathway BW record; cannot reuse the PQRA v4.0 toddler BW which is human-health-DIRECT).
3. `scripts/matrix-options/promote-twn-foodweb-toddler.mjs` -- fork promote-wlrs-subsistence.mjs; two
   target records (IR + BW toddler); MUST include the generic nested-source provenance guard (now the
   standard, per #318) + the attestation guard; upgrades the TWN source to direct_source_verified on
   apply.
4. `scripts/matrix-options/__tests__/promote-twn-foodweb-toddler.test.mjs` -- ~30-35 cases mirroring
   promote-acfn-foodweb.test.mjs (incl. nested-source + attestation guard regression cases).
5. `src/lib/matrix-options/frameDefaults.ts` -- new 4th bc-protocol1-v5-dra / human-health-food
   scenario: receptorScenarioId `twn-toddler-subsistence`, scenarioLabel "TWN toddler subsistence
   (Burrard Inlet)", sourceIds [src-bc-twn-burrard-inlet-wqo-tissue-2021], defaults IR=0.094 + BW=16.5;
   explicit TWN-Burrard-Inlet + aspirational-basis label/note.
6. `src/components/matrix-options/HHFoodWebCalculator.tsx` -- scenario seeding already auto-handles a
   4th scenario; confirm seedBwFor handles the toddler BW.
7. Tests: frameDefaults.test.ts (scenario count 3->4 for the food-web frame), library.test.ts (bump
   the affected FROZEN audit counts to the value the test ACTUALLY reports -- run the test, read the
   failing actual, set to that; never blind-set), HHFoodWebCalculator.test.tsx (selector option +
   pre-promotion pending assertion).

PRE-PROMOTION GATING (critical): with the TWN source at needs_direct_source_check and the records at
needs_review, the scenario resolves PENDING / not-selectable. The draft PR's 6 gates must pass on that
PRE-promotion state (assert pending / not-selectable; do NOT assert active/selectable). Post-promotion
active assertions land only after the owner `--apply`.

OWNER ACTIONS to activate after the draft PR merges:
1. File the TWN BIWQO 2021 PDF (open gov.bc.ca URL) into Zotero (-> zotero_status linked).
2. Run `node scripts/matrix-options/promote-twn-foodweb-toddler.mjs --apply` (reviewer J. Nelson),
   which flips the 2 records to approved + the TWN source to direct_source_verified -> scenario
   becomes selectable. (Per the 2026-06-12 inline-approval policy, the AI may run this `--apply` on
   your inline approval in a future attended session; it was NOT run unattended here.)

Appendix (Option B for M5-A): the same draft PR could add `pv-twn-biwqo-2021-bw-wocba-bc` (69.8 kg,
human-health-food) + a `twn-wocba` frameDefaults row reusing the existing 220 g/day IR -- only if you
chose Option B above.

---

## M6 -- HC 2017 sediment direct-contact receptor -> OWNER JUDGMENT (not mechanically buildable)

Verdict: DISTINCT from the HC PQRA v4.0 (2024) direct-contact lane, source is CURRENT, but the
receptor is NOT a clean fixed-default scenario -- it needs a risk-assessor judgment to operationalize.

AI-verified from the HC 2017 primary (Health Canada, "Supplemental Guidance on HHRA of Contaminated
Sediments: Direct Contact Pathway", H144-41/2017E-PDF, fetched from publications.gc.ca; canada.ca 403s
agents, publications.gc.ca PDF is the canonical full text):
- Dermal adherence factor (AF, Table 3, p.9): NO single default. Field-study ranges by body part +
  sediment type + age. Intertidal MUD, barefoot toddler (Kissel 1996): hands 35-58, lower legs
  9.5-36, feet 6.7-24 mg/cm2. Sandy intertidal (Shoaf 2005a): hands 0.38-0.62, feet 17-26 mg/cm2.
- Sediment ingestion (IR_sed, Table 4, p.11): toddler on-land hand-to-mouth 72 mg/HOUR (Wilson 2015);
  in-water all-ages 7.7 mg/HOUR. Note units are mg/HOUR -- converting to mg/day needs an exposure-time
  assumption.
- EF/ED: HC 2017 gives NO defaults (site-specific only).
- BW/SA: HC 2017 Table 2 cites HC 2012 (reuse; verify whether PQRA v4.0 Appendix E updated these).
- Currentness: CURRENT. PQRA v4.0 (March 2024) is a soil/terrestrial doc; its Summary of Revisions
  lists no sediment-specific changes and Section 1.2 cites HC 2017 as a companion still in use; no
  newer sediment direct-contact supplement found (search June 2026).

Why this is NOT an AI auto-build: a frame-default scenario needs SINGLE seed values. HC 2017
deliberately supplies AF RANGES, mg/HOUR ingestion (needs an exposure-time assumption), and no EF/ED
defaults. Choosing a representative AF, an exposure time (mg/hr -> mg/day), and EF/ED is a
professional risk-assessment decision -- exactly the kind of judgment the AI must not make for a
regulatory calculator default.

OWNER DECISION required to proceed with M6:
1. One browser check: confirm the 2017 sediment supplement is still listed as current (not archived)
   on the HC guidance index
   (https://www.canada.ca/en/health-canada/services/environmental-workplace-health/contaminated-sites/guidance-documents.html),
   then the source can be set canonical_source_status = current (+ pdf_url, notes).
2. Decide HOW to operationalize for a calculator default: which AF value (e.g. a chosen body-part /
   sediment-type representative), what exposure time to convert 72 mg/hr to a daily IR_sed, and
   whether EF/ED are seeded or left site-specific -- OR decide to leave HC 2017 as a documented
   site-specific reference (no fixed-default scenario). Once those seed values are owner-chosen, the
   build mirrors the M5-B spec (catalog records + promote-hc-2017-sed-direct.mjs + a 4th
   canada-fcsap-aquatic / human-health-direct scenario + tests).

Detail: `.tmp_m6_verify.txt` (this session's verification report; gitignored scratch).

---

## Bright line

The AI did NOT run any `promote-*.mjs --apply` in this autonomous session. All promotions above are
owner-gated. M5-B is ready to build as a draft PR (pre-promotion state); M6 needs the two owner
decisions above before any catalog entry is authored.

---

## FOLLOW-UP (filed 2026-06-14) -- SSD live ecotox_mirror mixed-unit guard

Context: PR (mixed-unit fail-closed block on UPLOADED SSD input) shipped the guard for
uploaded CSVs. codex review found it does NOT protect the LIVE ecotox_mirror path:
`ECOTOX_OPERATIONAL_COLUMNS` (src/lib/matrix-options/ssd/supabase.ts) omits the `unit`
column, so live rows have `raw.unit === undefined`, reach `inferAnalysisUnit`'s
`units.length === 0` branch, and are NOT blocked even if their underlying units are mixed
-> the live SSD path can still silently blend mixed-unit concentrations into a finite HCp
labeled the default unit. An in-code SCOPE-LIMITATION comment marks this (ssd/hcp.ts).

This is potentially the BIGGER data-integrity risk (the live mirror is the primary source).

OWNER DECISION NEEDED (Supabase explore-before-assume protocol -- do NOT assume the schema):
1. Confirm whether the ecotox mirror table has a per-row unit column (likely `unit` or
   `conc1_unit`). Read-only check (owner pastes in Supabase Studio; AI never runs MCP):
   `select column_name from information_schema.columns where table_name = '<ecotox_mirror_table>' and column_name ilike '%unit%';`
   (Replace <ecotox_mirror_table> with the actual mirror table name.)
2. If a unit column exists: add it to `ECOTOX_OPERATIONAL_COLUMNS` (+ map to
   RawEcotoxRecord.unit), so `inferAnalysisUnit` sees live units and the existing
   fail-closed guard covers the live route; add a live-route test. THEN the guard is
   complete for both paths.
3. If the mirror is pre-normalized to a single unit (no per-row unit / all one unit),
   confirm that -> the live path cannot have mixed units and the guard is correctly
   upload-only; remove/soften the SCOPE-LIMITATION comment to say so.

Until resolved: do NOT rely on the absence of a block to mean "units are consistent" for
live ecotox_mirror SSD analyses.
