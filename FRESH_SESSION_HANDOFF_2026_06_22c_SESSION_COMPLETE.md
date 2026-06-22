# SSTAC-Dashboard -- Session Handoff 2026-06-22c (full session: 9 PRs)

Supersedes FRESH_SESSION_HANDOFF_2026_06_22b. Plain ASCII. main at close: post-#394.

Large autonomous MO + Map session. NINE PRs shipped.

## PRs merged this session
- #386 apply-qa VALUE-LEVEL provenance stamp (40 fields).
- #387 EvidenceLibrary Values-table PAGINATION (dep-free; durable #380 render-timeout fix).
- #388 docs (Map-LOAD open-questions addendum).
- #389 EvidenceLibrary pagination INTEGRATION test (60-row mock).
- #390 Map-LOAD undated-rows consumer APP-LAYER (event_date nullable + date_precision; null-guards;
  RPC migration 20260622000001 authored, OWNER-PASTE-GATED).
- #391 docs handoff 22b.
- #392 14 EPA-VERIFIED canonical dupe-cg IRIS rows promoted (TMBs/1,1,1-TCA/RDX). Catalog 1161->1175.
- #393 docs/sediment-standards-phase2/PROJECT_PLAN_PHASE_2.md (from a parallel session; WORKING DRAFT,
  owner decisions D-1/D-2 open).
- #394 Map QA hardening (null-censored filter symmetry + accurate selected-sample count).

Catalog: HH 1175 approved / 402 needs_review. vitest_test_count 4479. main contradiction-free
(0 approved-but-pending rows). MO calculators audited CLEAN (no correctness bugs).

## OWNER-GATED / REMAINING (nothing blocked on AI)
1. **Map-LOAD DATA LOAD** (Supabase paste, when ready): apply migration 20260620000001 (if not done)
   + 20260622000001 (RPC date_precision); verify bnrrm_env_modifier_id UNIQUE; paste PATH_B chunks
   (split_etl_output.py --source <PATH_B monolith>; medium='sediment' + notes='env_modifier', NO enum
   change); run etl_bnrrm_to_supabase.py --allow-undated. App-layer is live + backward-compatible.
2. **PFAS dupe-cg (PFBA/PFDA/PFHxA, ~21 rows):** genuinely sex/endpoint-stratified 2024 IRIS values --
   owner picks the headline value or approves an extended input-key schema. (Verify vs live IRIS first.)
3. **BC Protocol 28 (355 rows): DEPRIORITIZED.** Source already pinned (gov.bc.ca URL + Zotero LPZUVAC2)
   but: version ambiguity (Jan 2021 vs v3.0 Apr 2024 republished to same URL -- open the local PDF);
   prior 4 packets all DISCREPANCY/AMBIGUOUS; conflict_rule = compilation superseded by HC/EPA originals
   (already promoted). Largely low-value. Multi-session owner-judgment if pursued.
4. **Phase 2 plan (#393):** resolve D-1 (acknowledge dashboard progress in estimates) + D-2 ($23K SABCS
   baseline in pitch); it is a WORKING DRAFT.
5. Optional: EvidenceLibrary windowed virtualization (UX pref vs the shipped pagination).

## Lessons (new this session, high-signal)
- VERIFY regulatory values vs LIVE source, not memory: a verification subagent CORRECTED 2 memory picks
  (RDX RfD 0.01->0.004; 1,2,4-TMB RfC 0.2->0.06). The EPA snapshot stores all candidates but does not
  tag canonical. NEVER promote a memory-based pick.
- A VALUE-only promotion lane must REQUIRE its sources already direct_source_verified + never write
  sources.json (codex P2) -- else --apply expands the attestation beyond the value rows.
- censored is boolean|null: filter with explicit !== false / !== true so a null (unknown) is excluded
  from both detected + censored, never silently a detect.
- Branch-off-pre-sibling-merge-main while a sibling is in CI: both bump vitest_test_count (same manifest
  line); land the sibling first then rebase, and bump the manifest AFTER rebase. gh pr merge
  --match-head-commit needs the FULL headRefOid.
- AGY + 2-3 bounded Sonnet research/audit subagents (NOT a mass spawn); research subagents = read-only
  finding/verification, AGY/Claude = the attested edits, codex = the gate.

## Gate cheatsheet (docs/GATE_MODE_SOP.md)
test:ci (4-shard) -> npx next typegen + tsc --noEmit -> lint -> docs:gate -> build:monitored:clean
-- -TimeoutSeconds 360 -PollSeconds 10 -> test:e2e -> codex (Spark grind -> 5.5 xhigh) GREEN -> push
-> PR -> merge on green (gh pr merge <n> --squash --match-head-commit <FULL-sha>). Manifest: 4479.
