# FRESH SESSION HANDOFF -- 2026-07-03d -- MO MeHg eco-food shipped + backlog

**Continues** `FRESH_SESSION_HANDOFF_2026_07_03c_MO_METALS_COHORT_COMPLETE.md`. This session shipped the
metals cohort completion (PR #464) AND the methylmercury eco-food activation (PR #466). **Main tip at
close: `399703d`** (PR #466 merged). vitest 4883.

---

## SHIPPED this session (main tip 399703d)
- **PR #464** -- Lane 1 metals cohort 6/6 (beryllium 0.002 + selenium 0.005 re-wired SOURCED). [detail in 07_03c]
- **PR #465** -- 07_03c handoff.
- **PR #466** -- methylmercury eco-food wildlife TRV wired DYNAMICALLY (owner chose Option 3,
  selenium-parity). Two generated eco_values.json rows: `pv-eco-methylmercury-food-trveco-mammal-ccmetrg`
  = 0.022 + `-bird-ccmetrg` = 0.031 mg/kg-bw/day (CCME 2000 wildlife TDIs). needs_review/provisional ->
  `resolveEcoSeed` seeds per receptor build-first; library scalar `methylmercury.trv_eco` stays null.
  vitest 4882 -> 4883. Gates all GREEN (test:ci 4883, build, e2e 117, codex no-issues, Leg1 GREEN + byte-verified regen). CI all 11 pass.

### MeHg -- the 1000x catch (important)
The owner-decisions-queue Section A said wire "0.000022 / 0.000031 mg/kg-bw/day". Verifying against the
LIVE CCME 2000 PDF showed the TDIs are 22 / 31 **ug**/kg-bw/day = **0.022 / 0.031 mg/kg-bw/day** -- the
queue's mg conversion was a 1000x error (ug misread as ng). Section A is now marked RESOLVED with the
corrected values so the bad numbers can't be wired later. The 33 ug/kg CCME "guideline" is a TISSUE
residue (avian-derived), NOT a dietary dose -- not the eco-food TRV.

### MeHg -- open follow-up (owner HITL, optional)
The 2 MeHg eco rows are needs_review/provisional (functional build-first). To promote to approved
(selenium-parity end state), owner runs / inline-approves:
`node scripts/matrix-options/promote-eco-source.mjs --source src-ccme-wildlife-trv-mehg --reviewer "J. Nelson" --date 2026-07-03 --apply`
(dry-run without --apply first; expectedCount 2; flips the source currentness/canonical + both rows to
approved_source_backed). Per feedback_inline_approval_is_the_attestation, AI dry-runs + shows before/after,
owner inline-approves, AI runs --apply. This will change library.test audit counts (pendingSourceLocator
-2, approvedSourceBacked +2) + the source pre/post state -- update those assertions in the promote PR.

---

## REMAINING BACKLOG (owner-decision gated; docs/MATRIX_OPTIONS_OWNER_DECISIONS_QUEUE_2026_07_02.md)
Section A (MeHg) = RESOLVED. Still open:
- **Section C** -- PCB-key consolidation ruling (recommended Option A).
- **Section D -- ~35 unwired organic cohorts + the 92 queue.** Each needs an owner source/class pick;
  DO NOT guess abs_dermal per-substance (re-opens #451). D1 jurisdiction-conflict oral field (17);
  D2 cyanide speciation (9-10); D3 metal-salt backfills onto elemental key (6); D4 organometallics
  (tetraethyl_lead/TBTO/aluminum_phosphide); D6 discrepancies (mirex/toluene/xylenes); D7 dup-keys.
- **Section D8 -- 48 inhalation-only substances** need a `SubstanceEntry` rfc_inh/iur_inh field +
  calculator support (schema work) BEFORE any can wire.
- **Section B** -- verified-null records (BaP FCV, total_pcbs_aroclor_1254 trv_eco): stay null unless a
  real source is found.

---

## Process notes / patterns confirmed this session
- Verify values AND units against the LIVE source, never memory or a secondary doc (the 1000x MeHg
  catch; the naphthalene/pyrene catalog shape for #464).
- eco_values.json is GENERATED from eco_staging/*.json via generate-eco-catalog-records.mjs -- edit the
  STAGING file + regenerate (--write --preserve-approvals), never hand-edit the generated file. The
  generator REQUIRES every source_id resolve in sources.json with a source_authority_tier, and has a
  fail-closed SOURCE_SHORT collision guard (reusing 'ccme' threw -> used 'ccmetrg').
- Adding N eco rows ripples several frozen audit counts in library.test.ts (valueGroups +1 per shared
  candidate_group_id; pendingSourceLocator/availableOptions +N per row) + eco-catalog-load counts +
  promote-eco-source ECO_SOURCE_CONFIG. Run full test:ci and fix each; recompute, don't blind-bump.
- AGY authored both mechanical diffs (#464, #466) from file-based briefs; orchestrator verified via git
  diff + ran the generator + all gates. codex 5.5-xhigh gated both. codex can over-explore and skip the
  literal VERDICT line -> re-run with a tight "END with VERDICT:" prompt if the first run doesn't emit one.
- Self-merge-on-all-green worked for all 4 PRs (owner pre-approved); auto-merge is DISABLED on the repo
  (poll E2E then merge manually).

## Orphan-process note
Session had many node/python processes (MCP/codex + parallel session + 2026-07-02 leftovers). NOT
auto-killed (L0 1.9). Owner: run `C:\Projects\.claude\scripts\safe-cleanup-orphans.ps1` (DRY-RUN first).
