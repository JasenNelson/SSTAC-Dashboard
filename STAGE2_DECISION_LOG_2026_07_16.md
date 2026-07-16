# Stage 2 Owner Decision Log -- 2026-07-16 (append-only)

Continues `docs/STAGE1_DECISION_LOG_2026_07_15.md` (authoritative Stage 1 rulings). Every
PRODUCTION-WRITE ruling still requires a SEPARATE exact-operation approval before any write.
Orchestrator verifies each load-bearing value against the cited source before presenting.

| # | Row | Item | Owner decision | Write authorized | Status |
|---|-----|------|----------------|------------------|--------|
| -- | -- | (rulings appended below as made) | -- | -- | -- |

## S2-1 -- Copper #18 reconciliation (2026-07-16, orchestrator verify; Ruling 9 already made in Stage 1)

Live read of the 8 copper rows (worktree c5b32fb):
- PROMOTE half CONFIRMED DONE: `pv-hc-copper-hh-direct-rfd-tdi` + `pv-hc-copper-hh-food-rfd-tdi` =
  0.426 mg/kg-bw/day, `default_status=current_default`, `qa_status=approved`, evidence approved,
  src `src-health-canada-trv-v4-2025`. (Landed commit 27a5d72, 2026-07-13.)
- DISPOSE half STILL NEEDED (6 rows, all `available_option` + `qa_status=needs_review` + 1 evidence
  item each at needs_review):
  - `pv-p28-copper-hh-direct-rfd` (0.09), `pv-p28-copper-hh-food-rfd` (0.09),
    `pv-p28-copper-hh-direct-rfd-copper-rfd-water` (0.141),
    `pv-p28-copper-hh-food-rfd-copper-rfd-water` (0.141) -- src `src-bc-protocol-28-v3-0-2024`.
  - `pv-copper-hh-direct-rfd` (0.426), `pv-copper-hh-food-rfd` (0.426) -- src
    `src-current-calculator-design-v1` (scaffold).
- SCAFFOLD-VALUE DISCREPANCY RESOLVED: scaffold rows currently hold **0.426**, NOT the "0.04
  unsupportable starter" the Stage 1 text described. Dispose rationale stated against the ACTUAL
  value: the HC row is the canonical 0.426 source (`src-health-canada-trv-v4-2025`), so the
  design-scaffold duplicates (`src-current-calculator-design-v1`) are redundant -> supersede.
- DETERMINATION: "Ruling 9 promote CONFIRMED done; dispose follow-up still needed." The dispose is an
  owner-gated PRODUCTION WRITE: flip top-level `qa_status` needs_review -> superseded AND each row's
  1 nested `evidence_items[].qa_status` -> superseded, on the 6 rows. `default_status` untouched
  (already available_option, never current_default -> no calculator-default risk). Prep the Node
  script, STOP for owner exact-op approval + `--apply`.

## S2-2 -- IRIS #17 inventory re-verify + per-group analysis (2026-07-16, orchestrator verify)

Live re-verify CONFIRMS the prepped inventory: 41 `pv-iris-*` needs_review rows / 8 substances /
20 candidate_group_ids, 0 current_default, all in `human_health_trv_values.json`.

Per-group analysis (approved canonical sibling value vs needs_review alternates):
- 16 of 20 groups: every needs_review alternate is HIGHER (less protective) than the already-approved
  canonical sibling -> routine supersede.
- 4 groups contain a LOWER (more-protective) alternate: G13 + G14 (RDX direct/food, approved 0.004 vs
  alternate `...oral-rfd-2` = 0.0008); G19 + G20 (PFHxA direct/food, approved 0.0005 vs alternate
  `...oral-rfd-5` = 0.0004).
- PROVENANCE (decisive): ALL 41 alternates AND their approved canonical siblings share the SAME
  source `src-us-epa-iris-rfd-table-live`, robot-extracted 2026-06-02 from the SAME "US EPA IRIS
  Chemicals_Details export" for the SAME CASRN. The approved sibling in each group is
  `canonical_source_status=direct_source_verified`; the alternates are `needs_direct_source_check`.
  IRIS publishes ONE RfD per chemical -> the multiple values per group are unverified extraction
  variants of a single source, NOT independent more-protective values. So the "more-protective"
  alternates are extraction noise; uniform supersede is the defensible disposition (keeping an
  unverified extraction duplicate as a selectable `available_option` would surface a spurious value).
- OBSERVATION (out of #17 dispose scope): PFDA (G17/G18) approved canonical = 2e-9 mg/kg-bw/day looks
  anomalous vs its alternates (6e-7 .. 3e-6). It is an APPROVED row, not a needs_review alternate, so
  it is NOT part of this disposition; flagged for a separate owner verify-vs-primary follow-up.
### OWNER RULING (2026-07-16): SUPERSEDE ALL 41
- Owner ruled: supersede all 41 needs_review IRIS alternates (across all 20 groups); keep each group's
  verified `direct_source_verified` canonical sibling. Rationale accepted: alternates are unverified
  same-source extraction variants, not authoritative independent values; none are current_default so
  no calculator-default change. Exact operation: for each of the 41 rows, flip top-level `qa_status`
  needs_review -> superseded AND every nested `evidence_items[].qa_status` -> superseded; leave
  `default_status` (available_option) untouched. PRODUCTION-WRITE via Node script -> STOP for owner
  `--apply` (prep only this session).
- PFDA follow-up RESOLVED (owner chose verify-now): live EPA IRIS (finalized July 2024, CASRN
  335-76-2, chemicalLanding substance_nmbr=702) gives chronic oral RfD = 2e-9 mg/kg-day, EXACTLY
  matching the approved canonical `pv-iris-perfluorodecanoic_acid_pfda-hh-direct/food-rfd` (2e-9).
  The approved value is CONFIRMED CORRECT (not an extraction error); the higher alternates ARE the
  errors -> supersede stands. No correction to the approved row; no separate follow-up needed.

## S2-1 (copper) STATUS: PREPPED + STOPPED
- Dry-run script authored: `scripts/matrix-options/promote-copper-hc0426.mjs` (mirrors
  promote-hc-trv-v4-2025.mjs; fail-closed; top-level + nested evidence flip; idempotent HC confirm;
  dry-run verified exit 0, no JSON writes). Owner-gated: owner runs `--apply`.
- GUARD-TEST COUPLING (must ship in the SAME apply PR, not count-shifts but per-record policy
  assertions that break once rows are disposed): `catalog.test.ts` "keeps Protocol 28 TRV candidates
  pending until original sources are checked" (asserts all src-bc-protocol-28 rows needs_review ->
  the 4 P28 copper rows must be excepted); `library.test.ts` "keeps HH scaffolds as current-calculator
  needs-review records" + "catalogs every current HH calculator default input as a review scaffold"
  (assert the 2 scaffold rows / copper direct+food cells needs_review). These test edits encode the
  Ruling-9 exception (HC 0.426 canonical) and are drafted-with-the-apply-PR, gated together.

## S2-3 (IRIS #17) STATUS: PREPPED + STOPPED
- Dry-run script authored: `scripts/matrix-options/supersede-iris-17-alternates.mjs` (mirrors the
  copper dispose pattern; hardcoded 41-id allowlist asserted length===41 + 20 canonical-confirm;
  top-level + nested evidence flip needs_review->superseded; default_status untouched; dry-run
  verified exit 0, 41 dispose + 20 confirm, no JSON writes). Owner-gated: owner runs `--apply`.
- GUARD-TEST COUPLING: NONE. No test asserts these pv-iris-* rows stay needs_review; the disposal
  moves them to superseded which no test filters on. The IRIS apply is a clean standalone.

## S2-4 -- PCB QP #15 (2026-07-16): OWNER RULING = REQUEST MORE DATA (codex-consulted)
- Owner requested a codex opinion first; codex (gpt-5.5 xhigh, read the packet + substanceLibrary +
  catalogs) recommended REQUEST-MORE-DATA: FCV 0.014 + logKow 6.5 is not a conservative default (can
  under-protect lower-Kow mixtures); prefer HC 1.0e-5 over IRIS 2.0e-5 as the HH default; need site
  congener/Aroclor profile + representative logKow (or lower-Kow sensitivity) + a deliberate HH
  default-selection call.
- OWNER RULED: REQUEST MORE DATA. PCB re-key (#13 D3) + relabel + HH-default switch REMAIN BLOCKED.
  No draft migration authored this session. Consequence: #23 dl-PCB TEQ full integration stays gated
  (depends on D3 landing) -> no #23 code PR this session.
- VERIFIED FACTS (orchestrator, codex's correctness catches CONFIRMED):
  - Under substance_key `total_pcbs_aroclor_1254`, human_health_trv_values.json already holds BOTH
    approved RfD options: HC non-dioxin 1.0e-5 (`pv-hc-pcb-hh-direct/food-rfd-nondioxin`) AND IRIS
    Aroclor-1254 2.0e-5 (`pv-iris-pcb-hh-direct/food-rfd-aroclor1254`), both `available_option`
    (neither current_default). So the more-protective HC value is ALREADY a wired option; the HH
    decision is "which to promote to current_default," not "add a missing value."
  - FCV 0.014 exists in TWO places: `pv-pcb-fcv` (parameter_values.json) and
    `pv-eco-polychlorinated_biphenyls_total_pcbs-direct-fcv-nrwqc` (eco_values.json) -- ID-split to
    reconcile in any future re-key.
- SCOPED FOLLOW-UP (owner queue): obtain site PCB analytical basis + dominant Aroclor/congener
  (homolog) profile + site-weighted (or lower-Kow sensitivity) logKow; make the deliberate HH
  default call (promote HC 1.0e-5 vs keep IRIS 2.0e-5); reconcile the two FCV rows; THEN revisit the
  QP attestation + D3 re-key.

## S2-5 -- Step 4 (ruling-unblocked code) DISPOSITION
- No autonomous code PR this session. Copper (#18) + IRIS (#17) are owner-gated CATALOG writes
  (dry-run scripts prepped-and-stopped, not code PRs). The PCB chain (#13/#15/#23) is BLOCKED by the
  request-more-data ruling. Shippable this session = the two dry-run apply scripts + these decision
  docs (inert / no-write), as a report-ready docs+scripts PR for owner review.
