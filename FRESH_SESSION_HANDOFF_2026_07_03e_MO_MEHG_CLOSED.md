# FRESH SESSION HANDOFF -- 2026-07-03e -- MO session close (metals 6/6 + MeHg eco fully closed)

**Supersedes** `FRESH_SESSION_HANDOFF_2026_07_03d_MO_MEHG_ECO_SHIPPED.md`. **Main tip at close: `b8f41c1`**
(PR #468 merged). vitest 4883.

---

## SHIPPED this session (5 PRs, all self-merged on all-green)
- **#464** -- Lane 1 metals cohort 6/6: beryllium 0.002 + selenium 0.005 re-wired SOURCED (#461
  approved-tiebreak + #462 frame-aware tiebreak now resolve them).
- **#465** -- handoff 07_03c.
- **#466** -- methylmercury eco-food wildlife TRV wired DYNAMICALLY (CCME 2000; mammal 0.022 + bird
  0.031 mg/kg-bw/day; selenium-parity dynamic catalog rows, owner Option 3). Rows generated
  needs_review.
- **#467** -- docs: owner-decisions-queue Section A marked RESOLVED + the 1000x-error fix recorded +
  handoff 07_03d.
- **#468** -- promoted the 2 MeHg eco rows to APPROVED (HITL J. Nelson inline-approved
  promote-eco-source.mjs --apply). Source pinned current/direct_source_verified; rows
  approved/approved_source_backed. **MeHg eco-food lane is now fully closed (approved, non-provisional).**

## Key facts / catches
- MeHg values: CCME 2000 wildlife TDIs are mammal 22 / avian 31 **ug**/kg-bw/day = **0.022 / 0.031
  mg/kg-bw/day**. The owner-decisions-queue "0.000022/0.000031" was a **1000x unit error** (now
  corrected + flagged in the queue doc so it can't be re-wired). The 33 ug/kg CCME value is a
  TISSUE-residue guideline, not a dietary dose.
- Metals cohort (chromium_hexavalent, mercury_inorganic, uranium, vanadium_pentoxide, beryllium,
  selenium) = 6/6 wired + SOURCED.

## REMAINING BACKLOG (owner-decision gated; docs/MATRIX_OPTIONS_OWNER_DECISIONS_QUEUE_2026_07_02.md)
Section A (MeHg) = RESOLVED + promoted. Still open, each needs an owner judgment:
- **Section C** -- PCB-key consolidation ruling (recommended Option A + a Total-PCBs-default congener policy).
- **Section D -- ~35 organic cohorts + the 92 queue.** DO NOT guess abs_dermal per-substance (re-opens
  #451). D1 jurisdiction-conflict oral field (17: arsenic_inorganic, barium, benzo_a_pyrene 0.0003/
  0.0004/0.002, cadmium, ...); D2 cyanide speciation (9-10); D3 metal-salt backfills onto elemental key
  (6: mercuric_chloride->mercury_inorganic, selenious_acid->selenium, uranium_soluble_salts->uranium,
  nickel salts pick-one); D4 organometallics (tetraethyl_lead 1e-7 / TBTO 3e-4 / aluminum_phosphide
  4e-4 -- own key + class call); D6 discrepancies (mirex logKow ~40x, toluene 0.08/0.0097, xylenes
  0.2/0.013); D7 dup-keys/value-mismatch (antimony, dichloroethane_1_2, polychlorinated_biphenyls_pcbs).
- **Section D8 -- 48 inhalation-only substances** need a `SubstanceEntry` rfc_inh/iur_inh field +
  calculator support (SCHEMA work) BEFORE any can wire -- the single biggest structural unlock.
- **Section B** -- verified-null (BaP FCV, total_pcbs_aroclor_1254 trv_eco): stay null unless a real
  source is found.

## Patterns confirmed this session (for the next session)
- Verify values AND units against the LIVE source, never memory or a secondary doc (the 1000x MeHg catch).
- eco_values.json is GENERATED from eco_staging/*.json via generate-eco-catalog-records.mjs -- edit the
  STAGING file + regenerate (--write --preserve-approvals); the generator requires each source_id resolve
  in sources.json with a source_authority_tier and has a fail-closed SOURCE_SHORT collision guard.
- Adding/promoting eco rows ripples several frozen audit counts in library.test.ts + eco-catalog-load +
  promote-eco-source config -- run full test:ci and recompute each, don't blind-bump.
- Promotion to approved is the sanctioned promote-eco-source.mjs --apply (owner inline-approval = the
  attestation; AI dry-runs, shows before/after, runs --apply as reviewer J. Nelson, updates the
  provisional/pending/approved test assertions).
- AGY authored the mechanical diffs from file-based briefs; orchestrator ran the generator + gates; codex
  5.5-xhigh gated. codex can over-explore and skip the literal VERDICT token -> re-run with a tight
  "END with VERDICT:" prompt.

## Orphan-process note
Many node/python processes running (MCP/codex + parallel session + 2026-07-02 leftovers). NOT auto-killed
(L0 1.9). Owner: run `C:\Projects\.claude\scripts\safe-cleanup-orphans.ps1` (DRY-RUN first) for a sweep.
