# SSTAC-Dashboard -- Session Handoff 2026-06-21 (HC TRV v4.0 + test-infra)

Supersedes: FRESH_SESSION_HANDOFF_2026_06_20c_SIX_PR_MO_BATCH.md (PR #371 anchor).
Main at session close: 74ac70a.
Plain ASCII only.

---

## What merged this session (3 PRs)

### PR #376 -- 17-row owner-attested promotion (squash 5314851)
feat(matrix-options): promote 17 owner-attested needs_review rows to approved + direct_source_verified.
- parameter_values.json (7): pv-wlrs-2023-ir-food-low-level-bc + HC PQRA v4.0 lifestage 3 BW (infant/
  child/teen) + 3 SA-total (infant/child/teen).
- human_health_trv_values.json (10): 6 IRIS carcinogen RfD (HCB/PCP/1,4-dioxane direct+food) + 4 US
  EPA 2024 PFOA/PFOS RfD (direct+food).
- sources.json: PFOA/PFOS source-note update.
- 2 new promote scripts (promote-iris-carcinogen-rfd.mjs + promote-us-epa-pfas.mjs) + tests (+73).
- Rebased onto post-WIRE main 2f048a9; manifest vitest_test_count reconciled 4283 -> 4296 (WIRE #375)
  -> 4369 (this PR).

### PR #377 -- test-infra hardening (squash 7b1c0db)
chore(test-infra): exclude .claude/** in vitest + parameter_values mass-promotion tripwire.
- vitest.config.ts: .claude/** added to exclude (kills the worktree test-count pollution class
  permanently; CI clean checkout was always unaffected).
- catalog.test.ts: new parameter_values.json allowlist-equality tripwire (union of the 12 owner-run
  promote-script allowlists; mirrors the HH TRV tripwire; closes the prior count-only fidelity gap).
- manifest 4369 -> 4370 (+1 tripwire test).

### PR #378 -- Health Canada TRV v4.0 (2025) 92-row promotion (squash 74ac70a)
feat(matrix-options): promote 92 Health Canada TRV v4.0 (2025) rows to approved + direct_source_verified.
- Owner-attested (J. Nelson, 2026-06-21) promotion of all 92 HC TRV v4.0 rows
  (src-health-canada-trv-v4-2025): 34 substances x {oral RfD, oral SF, inhalation RfC, inhalation unit
  risk}, direct + food. qa_status needs_review -> approved; canonical_source_status
  needs_direct_source_check -> direct_source_verified. evidence_support_status was already
  approved_source_backed (UNCHANGED); default_status unchanged (available_option). Source already
  direct_source_verified (SKIP).
- New owner-run promote-hc-trv-v4-2025.mjs (data-driven 92-row table, fail-closed, idempotent;
  exports HC_TRV_V4_2025_PROMOTION_VALUE_IDS) + 37-case test.
- catalog.test.ts: HC TRV ids added to the HH tripwire union (now FOUR tools) + an HC-TRV per-record
  exact-source assertion.
- manifest 4370 -> 4407 (+37).

---

## State of main after session (74ac70a)

- vitest_test_count: 4407 (all passing; 11 skipped, 2 todo).
- human_health_trv_values.json: 206 approved / 1371 needs_review / 1577 total.
- parameter_values.json: 30 approved / 80 needs_review / 110 total.
- Promote-script family (owner-run, each exports an id allowlist for the catalog.test tripwires):
  - parameter_values tools (12, unioned in the parameter_values tripwire): promote-wlrs-default /
    -bw-default / -subsistence / -low-level, promote-epa-ir-food / -bw-default, promote-acfn-foodweb,
    promote-hc-pqra-direct / -adult / -worker / -lifestage, promote-twn-foodweb-toddler.
  - human_health_trv tools (4, unioned in the HH tripwire): apply-qa-promotion (20 IRIS),
    promote-iris-carcinogen-rfd (6), promote-us-epa-pfas (4), promote-hc-trv-v4-2025 (92).
- Two mass-promotion tripwires in catalog.test.ts: HH TRV set-equality (4-tool union) + parameter_values
  set-equality (12-tool union). A reverted/dropped --apply or an unsanctioned promotion fails either.

---

## Deferred / parked (do NOT build autonomously without owner directive)

- Map-LOAD consumer-contract + data load: migration #373 + ETL #374 are the merged FOUNDATION (event_date
  nullable + date_precision + CHECK; ETL --allow-undated). NOT applied/loaded. The actual load needs the
  owner to paste SQL into Supabase (MCP write path dead). RPC/UI/export for undated rows is UI-risky --
  owner-gated. Untracked scratch in the working tree: scripts/matrix-map/etl_*_PATH_B.sql,
  scripts/matrix-map/etl_output_chunks/, sql_runbook/ (codex flagged the chunks as stale v1.0.0 and the
  50_multimedia_schema_delta env_modifier medium note -- regenerate from PATH_B before any load).
- Remaining needs_review HH TRV groups (1371 rows): US EPA IRIS RfD live (~720 after this batch; lower
  authority for BC), US EPA IRIS chem-details (290), BC Protocol 28 2021-jan (355, BLOCKED -- source
  unpinned + all pending_source_locator). HC-priority groups are now exhausted; next batches are US EPA
  IRIS (owner-directed) or unblock P28 source first.
- Untracked .mcp.json at root: the owner's intentional project-scoped Supabase MCP (read-only approved
  per memory). codex flags it contradicts the SQL-Editor-only protocol if committed -- keep it untracked
  (it is gitignored-by-omission / not staged). Do NOT commit it.

---

## Key lessons this session

- Manifest rebase conflicts are MULTI-PART: the live vitest_test_count value AND each branch's
  facts_history entry both conflict. Resolution = reconcile the chain (e.g. 4283 ->WIRE 4296 ->promo
  4369), fix the superseded entry's value + superseded_by + note, keep the other branch's entry.
- Local `npm run lint` (eslint .) reports ~48 "errors" that are ALL the untracked
  scripts/catalog-overnight/.venv minified JS. CI's clean checkout never has .venv, so CI lint is GREEN
  (verified vs merged PRs). For a true local read use `eslint . --ignore-pattern "scripts/catalog-overnight/**"`
  (0 errors). Do NOT bake that ignore into the gate command -- it is local-only diagnosis.
- Promoting rows that are ALREADY evidence_support_status=approved_source_backed (IRIS chem-details, HC
  TRV) does NOT shift library.test approvedSourceBacked/pendingSourceLocator counts -- only qa_status +
  canonical_source_status move. So library.test stays green; only the catalog.test HH tripwire union must
  gain the new allowlist. (Mixed batches with pending_source_locator rows -- like the 17-row #376 -- DO
  shift the counts.)
- New promote-script pattern: data-driven table (PROMOTION_ROWS) -> derive VALUE_IDS + EXPECTED_IDENTITIES,
  rather than hand-typing N identity objects. Export PROMOTION_ROWS so the test builds all-N fixtures
  (planPromotion iterates every id, so the fixture must contain every record). Embed EXACT catalog float
  values (e.g. 0.004200000000000001) so the strict identity check is real drift-detection.
- Deferring the catalog.test.ts edit until AFTER rebasing a data-promotion branch onto a test-infra
  branch that also edits catalog.test.ts avoids a rebase conflict entirely.

---

## Session close checks

- Orphaned processes: see session ledger (node/python checked at close; report-only -- owner runs
  parallel sessions, do not kill by name).
- All session branches merged + deleted; git worktree prune run. .claude/worktrees left clean.
