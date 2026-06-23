# SSTAC-Dashboard -- Session Handoff 2026-06-22d (5 PRs: #396-#400)

Supersedes FRESH_SESSION_HANDOFF_2026_06_22c. Plain ASCII. main at close: post-#400 (tip 415fe9c).

Large autonomous Matrix-Options session. FIVE PRs shipped + merged. AGY (Gemini 3.1 Pro High) proven as
both a mechanical workhorse AND a competent free adversarial pre-reviewer; codex remained the ship gate.

## PRs merged this session
- #396 PFAS dupe-cg promotion: PFBA 1e-3 + PFHxA 5e-4 (EPA-DESIGNATED PRIMARY chronic oral RfDs, direct+
  food = 4 rows). PFDA DEFERRED (EPA designates NO single overall RfD -> a policy pick, not verification).
  Dual blind live-IRIS passes agreed on every value. Catalog 1175 -> 1179 approved.
- #397 Phase 2 D-1/D-2: resolved both owner decisions in PROJECT_PLAN_PHASE_2.md (Section-4 head-start
  note; qualitative budget framing). Appendix A stays tooling-agnostic.
- #398 Map-2a runbook: env_modifiers EXCLUDED (owner decision -- the bnrrm_env_modifier_id column does not
  exist in any migration + owner excluded env_modifiers as a map medium 2026-06-05). Self-contained
  paste runbook at sql_runbook/MAP_2A_DATA_LOAD_RUNBOOK_2026_06_22.md.
- #399 BC Protocol 28 source DEDUP: retired the mislabeled src-bc-protocol-28-2021-jan; deleted 4 exact-
  duplicate HH twins of the verification-packet rows + re-keyed 351 HH rows to canonical
  src-bc-protocol-28-v3-0-2024; generator (generate-catalog-records.mjs) remap so regeneration is
  idempotent. needs_review 398 -> 394 (4 deleted); approved unchanged.
- #400 retired-source currentness fix (from the holistic codex checkpoint): the #399 dedup marked the
  retired source via an UNMODELED `status` key; the app reads the MODELED `currentness_status`. Set
  currentness_status='superseded' + removed the unmodeled key.

Catalog: HH 1179 approved / 394 needs_review. manifest vitest_test_count = 4502. main contradiction-free.

## OWNER-GATED / REMAINING (nothing blocked on AI)
1. **Map-LOAD DATA LOAD** (Supabase paste, owner-only): follow sql_runbook/MAP_2A_DATA_LOAD_RUNBOOK_2026_06_22.md
   -- apply migrations 20260620000001 + 20260622000001 (env-mod column NOT needed under Map-2a); regenerate
   the no-envmod monolith + split + paste chunks 01..26; optional --allow-undated load. Supabase MCP dead ->
   SQL Editor. AI can re-generate the chunks on request (they are gitignored local scratch).
2. **PFDA promotion** (policy decision): EPA designates no overall RfD; pick a convention (e.g. most-
   protective lowest-chronic 2e-9) and AGY can extend the PFAS promoter for PFDA's 8 rows.
3. **Phase 2 plan**: D-1/D-2 resolved (#397); the doc remains a WORKING DRAFT for the broader Phase 2 content.

## AGY capability findings (owner asked 2026-06-22; saved to [[agy-antigravity-cli-usage]])
- Exact --model strings (from AGY logs; `agy models` prints nothing non-interactively): **"Gemini 3.1 Pro
  (High)"** = strong reasoning/numerical tier; **"Gemini 3.5 Flash (High)"** = fast/mechanical (default).
- AGY has UNLIMITED tokens (owner) -> route SUBSTANTIVE work + a FREE read-only adversarial PRE-REVIEW pass
  to 3.1 Pro High; mechanical scaffolding on Flash; Claude thin; codex is the gate.
- EMPIRICAL: 3.1 Pro High scored 2/2 on a planted-bug review (boolean/null asymmetry + inverted unit
  conversion) with 0 false positives, AND did a genuine multi-point diff pre-review WITH a repo grep to
  confirm no other reader of a removed field. It is a real pre-reviewer, not a rubber-stamp. Headless print
  mode can hang on first-use/cold-start (one probe hung; the next run on the same model worked) -- give it a
  generous --print-timeout and verify via the file it writes, not stdout.

## Lessons (new this session, high-signal)
- EPA IRIS designates a PRIMARY RfD for some PFAS (PFBA, PFHxA) but NOT others (PFDA = stratified only) --
  picking the latter is a POLICY choice; verify live, never promote a memory pick.
- When curating a GENERATED catalog, fix the GENERATOR config too (SOURCE_ID_REMAP), not just the JSON --
  codex caught that regeneration would re-emit deleted rows (idempotence verified `generated NEW records: 0`).
- Mark retired sources via the MODELED field (currentness_status), not a custom key the app ignores
  (holistic-checkpoint P2). A holistic codex pass over the CUMULATIVE multi-PR diff catches integration
  gaps the per-PR reviews miss -- run it at end-of-session.
- A plain `grep src/ scripts/` for an id MISSED real references (library.ts + generator); codex tool-use
  found them. Verify-twice (L0 1.5).
- Owner confirmed (supersedes the script banner): AI runs promote --apply on the owner's INLINE approval
  (reviewer "J. Nelson") per [[feedback-inline-approval-is-the-attestation-not-ps-commands]].

## Gate cheatsheet (docs/GATE_MODE_SOP.md)
codex (Spark grind -> 5.5 xhigh; + optional AGY 3.1-Pro-High pre-review) -> commit -> test:ci (4-shard) ->
npx next typegen + tsc --noEmit -> lint -> docs:gate -> build:monitored:clean -- -TimeoutSeconds 360
-PollSeconds 10 -> test:e2e -> push -> PR -> merge on green (gh pr merge <n> --squash --match-head-commit
<FULL-sha>). Known CI flake: Node-24 vitest worker `write EPIPE` -> one rerun (`gh run rerun <id> --failed`).
Manifest base 4502.

## Process note
Orphaned-process check at close: many node/python from MCP/desktop/parallel sessions -- terminated NONE
(foreign needs owner OK). Flagged PID was a ~1.6 GB python (8:08 PM) -- owner to check if it is a live
MCP/ingest. AGY/codex scratch (.tmp_*) cleaned.
