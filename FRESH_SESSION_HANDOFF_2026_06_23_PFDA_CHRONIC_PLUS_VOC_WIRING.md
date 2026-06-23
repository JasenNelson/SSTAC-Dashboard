# SSTAC-Dashboard -- Session Handoff 2026-06-23 (PFDA chronic + Batch E VOC wiring)

Supersedes FRESH_SESSION_HANDOFF_2026_06_22d. Plain ASCII. Orchestrator thin; AGY (Gemini 3.1 Pro
High) workhorse; codex (Spark grind + 5.5 xhigh) the ship gate. Continued the 2026-06-22d remaining
items (PFDA + Map-2a + a new MO value lane).

## PRs this session
- **#402 (MERGED) -- PFDA chronic 2e-9 oral RfD promotion.** Resolved last session's PFDA deferral.
  Live dual-WebFetch verification vs EPA IRIS 2024 final (EPA/635/R-23/027f, CASRN 335-76-2): EPA
  designates NO single overall RfD, but BOTH chronic organ-specific RfDs converge on 2e-9 mg/kg-bw/day
  (immune: decreased child serum antibody; developmental: decreased birth weight). The other 3 catalog
  PFDA values are SUBCHRONIC (6e-7 hepatic, 1e-6 repro-F, 3e-6 repro-M) -- NOT equal policy options.
  Owner picked 2e-9 chronic. Promoted the 2 chronic base-id rows; 6 subchronic stay needs_review.
  Forked promote-iris-pfas-dupe-cg-canonical.mjs -> -pfda (AGY-built). PFDA id map: 2e-9=base id;
  6e-7=`--pfda-oral-rfd-2`; 3e-6=`--pfda-oral-rfd-3`; 1e-6=`--pfda-oral-rfd-4` (codex caught a
  1e-6/3e-6 SWAP in the plan). Catalog approved HH 1179 -> 1181.
- **#403 (MERGED) -- Batch E chlorinated-VOC/organic wiring.**
  Build-first (no qa_status mutation): wired 8 unwired-but-approved HH substances into
  SUBSTANCE_LIBRARY (103 -> 111): dichloromethane, 1,1-DCE, 1,2-DCA, 1,1,2-TCA, 1,1,1,2-TeCA, DEHP,
  TNT, formaldehyde. rfd/sf = approved catalog canonicals. **abs_dermal 0.03** = HC TRV v4.0 Table 5
  VOC RAF (matches benzene/TCE/PCE) -- NOT the 0.1 organic-halogenated default. logKow/eco null ->
  Eco filtered (HH-only).

manifest vitest_test_count: 4502 -> 4515 (#402) -> 4523 (#403).

## Map-2a (Stream B) -- verified-ready for owner paste
The 26 no-envmod paste chunks + monolith on disk re-verified: medium set sediment/toxicity/community
only (14244/334/178), 0 `bnrrm_env_modifier_id`, counts match the runbook. The Supabase paste +
migrations 20260620000001 + 20260622000001 are OWNER-ONLY (MCP dead -> SQL Editor); follow
sql_runbook/MAP_2A_DATA_LOAD_RUNBOOK_2026_06_22.md. AI can re-generate chunks on request.

## KEY FINDING -- promotion backlog EXHAUSTED (do NOT hunt for promote targets)
All HH + eco canonicals are already approved. The 392 needs_review HH rows are either (a) intentional
ALTERNATIVES in candidate_groups that already have an approved canonical (promoting one would create a
2nd approved member = fail-closed violation), or (b) 351 BC Protocol 28 rows (policy-compilation, not
promotable without the underlying primary source). Eco = 0 needs_review. **The forward MO value-
expansion lane is build-first WIRING** -- 388 unwired catalog substances WITH approved values remain;
Batch E wired 8. See [[feedback-needs-review-values-usable-build-first-review-later]].

## OWNER-GATED / REMAINING
1. **Map-LOAD DATA LOAD** (Supabase paste, owner-only) -- chunks verified-ready; paste 01..26 +
   migrations per the runbook.
2. **More wiring batches** (build-first, AI-actionable) -- ~380 unwired-but-approved substances remain.
   Next sensible batches: more chlorinated/aromatic VOCs, energetics (RDX already has an approved
   canonical), additional metals/pesticides. abs_dermal = match the nearest wired neighbor (HC Table 5
   0.03 for VOCs/aromatics), NOT a generic class default.
3. **Phase 2 plan** -- working draft; D-1/D-2 resolved (#397).

## Gate cheatsheet (docs/GATE_MODE_SOP.md)
codex (Spark grind -> 5.5 xhigh; optional AGY 3.1-Pro-High pre-review) -> commit (path-scoped) ->
test:ci (4-shard) -> npx next typegen + tsc --noEmit -> lint (changed files; repo .venv lint noise is
CI-clean) -> docs:gate -> build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10 -> test:e2e ->
push -> PR -> merge on green (gh pr merge <n> --squash --match-head-commit <FULL-sha>). Manifest base
**4523**. Known flake: Node-24 vitest `write EPIPE` -> one `gh run rerun <id> --failed`.

## Process note
Orphan sweep at close: 0 orphaned / 0 suspicious. AGY scratch (.tmp_agy_*) cleaned. AGY headless
(Gemini 3.1 Pro High) drove both mechanical builds cleanly; verify closeouts via git diff (not stdout).
