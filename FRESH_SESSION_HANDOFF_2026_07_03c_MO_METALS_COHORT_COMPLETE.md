# FRESH SESSION HANDOFF -- 2026-07-03c -- MO Lane 1 metals cohort COMPLETE (6/6)

**Continues** `FRESH_SESSION_HANDOFF_2026_07_03b_MO_PROVENANCE_AND_URLS.md`. This session shipped the
one remaining task from 07_03b (PR-B). **Main tip at close: `e931ed9`** (PR #464 merged). vitest 4882.

---

## SHIPPED this session (1 PR)
### PR #464 -- re-wire beryllium + selenium (Lane 1 metals cohort now 6/6)
Branch `fix/mo-lane1-beryllium-selenium-2026-07-03` (merged + deleted). Both were deferred in #458 as
unsourced scaffolds; the #461 approved-tiebreak + #462 frame-aware jurisdiction tiebreak now resolve
them SOURCED, so their oral RfD was wired build-first:
- **selenium** `rfd_oral 0.005` -> single approved US EPA IRIS (`pv-iris-selenium-hh-direct-rfd`); BC
  P28 sibling is needs_review. Frame-independent (approved-tiebreak).
- **beryllium** `rfd_oral 0.002` -> dual-approved IRIS (US_federal) + HC (Canada_federal) at the same
  value; displayed default follows the active frame -- HC under BC/default, IRIS under US
  (frame-aware tiebreak). sf_oral null for both.
- Tests: removed beryllium from the Cluster E dormant block; added beryllium + selenium to the Lane 1
  metals cohort HH wiring block; NEW `resolver.integration.test.ts` describe block (3 SOURCED cases)
  asserting exact pvids/jurisdictions + `evidence_support_status=approved_source_backed` + sources>0.
  Manifest 4878 -> 4882 (net +4).
- CRITICAL GUARD satisfied: the 3 new resolver cases PASS -- both substances empirically resolve
  SOURCED (not scaffold). Verified live-catalog before wiring (beryllium exactly 2 approved + 1
  needs_review on the hh-direct rfd tuple; selenium exactly 1 approved + 1 needs_review; no 3rd
  same-value approved row that would break the tiebreak).
- Gates: tsc clean / test:ci 4882 / monitored build exit 0 / e2e 117 passed / codex 5.5 xhigh GREEN
  (holistic plan review + targeted diff review) + Leg 1 Opus GREEN. GitHub CI: all 11 checks pass.

The Lane 1 metals cohort (chromium_hexavalent, mercury_inorganic, uranium, vanadium_pentoxide,
beryllium, selenium) is now **6/6 wired and SOURCED**.

---

## REMAINING BACKLOG (owner-decision gated -- surfaced, NOT guessed)
From `docs/MATRIX_OPTIONS_OWNER_DECISIONS_QUEUE_2026_07_02.md`. Each needs an owner judgment.

### Highest-value single decision: MeHg eco-TRV (Section A)
`methylmercury.trv_eco_mg_per_kg_bw_day` is null (a fabricated 0.000064 CCME citation was removed
2026-07-02). This is an ECO-ACTIVATION decision, NOT a simple backfill: `methylmercury.bsaf_loc_freshwater`
is non-null (15), so writing a static trv_eco goes LIVE and drives eco-food output (the static-driven
path #449/#453 suppressed). Real CCME wildlife TRVs found: mammal 0.000022 / avian 0.000031 (+ a 33
ug/kg tissue guideline). OPTIONS: (1) wire mammal 0.000022 [conservative default]; (2) wire avian
0.000031; (3) keep null and force the dynamic catalog resolver / explicit HITL receptor choice (needs
resolveEcoSeed species-group rows + resolver work; out of scope for a static wire). MUST confirm the
CCME value against the LIVE source first AND re-establish a real catalog/provenance row (the fabricated
`pv-mehg-trv-eco` was deleted -- a value with no evidence row is not shippable).

### ~35 unwired organic cohorts (D-sections)
Per-substance abs_dermal volatility -- DO NOT guess a class default (re-opens the #451 defect). Each
needs an owner source/class pick: D1 jurisdiction conflict on oral field (17: arsenic_inorganic,
barium, benzo_a_pyrene 0.0003/0.0004/0.002, cadmium, ...); D2 cyanide speciation (9-10); D3 metal-salt
backfills onto elemental key (6); D4 organometallics (tetraethyl_lead/TBTO/aluminum_phosphide -- own
key + class call); D6 discrepancies (mirex logKow, toluene, xylenes); D7 dup-keys/value-mismatch
(antimony, dichloroethane_1_2, polychlorinated_biphenyls_pcbs).

### 92 queued items -- incl. D8 schema gap (48 inhalation-only)
48 substances have only clean inhalation rfc_inh/iur_inh values that `SubstanceEntry` cannot hold --
they need a new rfc_inh/iur_inh field + calculator support BEFORE any can wire (schema work).

Also open from 07_03b: Section C PCB-key consolidation ruling (recommended Option A); Section B
verified-null records (BaP FCV, total_pcbs_aroclor_1254 trv_eco -- stay null unless a real source is found).

---

## Process notes (this session)
- Verify values AND the catalog shape against the LIVE file, never memory (confirmed beryllium/selenium
  candidate counts directly before wiring; the #458-era test comment saying they were "DEFERRED" was
  stale and had to be corrected).
- AGY authored the mechanical 3-file diff from a file-based brief; orchestrator verified verbatim via
  `git diff` (AGY reproduced every string exactly) + ran all gates. codex 5.5 xhigh gated (plan +
  diff), both GREEN.
- Manifest math: net +4 = Cluster E -1 (beryllium removed) + Lane 1 wiring +2 + resolver.integration
  +3. The handoff-era "+2" estimate was stale (selenium was never in Cluster E; +3 resolver cases
  added). Empirical test:ci count is authoritative -- landed 4882 as predicted.
- facts_history entry is MANUAL per bump (added `vitest_test_count_2026_07_03_pre_lane1_beryllium_selenium`).
- Local `npm run lint` shows ~48 pre-existing false-positive errors from untracked `.venv` bundled JS
  (bootstrap/jquery/torch) -- CI ignores them; CI lint is authoritative. Do not chase them.

## Orphan-process note
Session close found several node/python processes (MCP servers, codex, likely a parallel session +
some 2026-07-02 leftovers). NOT auto-killed (L0 1.9: ask owner; never kill MCP/codex/desktop by name).
Owner: run `C:\Projects\.claude\scripts\safe-cleanup-orphans.ps1` (DRY-RUN first) if a sweep is wanted.
