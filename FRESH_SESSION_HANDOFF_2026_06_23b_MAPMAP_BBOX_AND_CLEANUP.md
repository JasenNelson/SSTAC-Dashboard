# SSTAC-Dashboard -- Session Handoff 2026-06-23b (Map-2a investigation + AGY doc cleanup + bbox-lane Stage 1)

Supersedes FRESH_SESSION_HANDOFF_2026_06_23 (which covered #402/#403/#404). Plain ASCII. main tip post-#407.
Method this session: AGY workhorse + codex (5.5 xhigh) ship gate + Claude thin orchestrator + project-scoped
Supabase MCP for live-DB reads.

## PRs merged this session (8 total)
- #402 PFDA chronic 2e-9 oral RfD promotion; #403 Batch E chlorinated-VOC wiring (103->111); #404 handoff
  (see the prior 2026-06-23 handoff for those).
- **#405** -- AGY doc cleanup: NEW canonical `docs/AGY_USAGE.md` (prominent "NEVER --dangerously-skip-permissions");
  SUPERSEDED banners on the misleading catalog-robot/AGY docs (incl. already-archived ones, since search
  surfaces archived files); archived 3 stale root docs; removed stale .tmp scratch. (A parallel engine-v2
  session had been misled by the old docs into trying `--dangerously-skip-permissions`.)
- **#406** -- Map-2a final investigation doc + bbox/pagination lane spec.
- **#407** -- bbox-lane Stage 1 (backend): migration `20260623000001` makes the fetch RPC honor `p_bbox`.

manifest vitest_test_count: 4515 -> 4523 (#403) -> **4526** (#407, +3 fetch-samples-server tests).

## SUPABASE -- project-scoped MCP IS LIVE (resolves a doc contradiction)
`mcp__supabase-project-scoped__*` (project qyrhsieynzfgyuqzznap) WORKS: reads free, writes owner-OK + scoped
to matrix_map/storage (never engine-v2). The CLAUDE.md "Supabase MCP is dead -> SQL Editor" warning is about
the OTHER (claude.ai-integrated) Supabase MCP, which does fail. Prior sessions used the project-scoped MCP to
load matrix_map data directly (no owner copy-paste). [memory: dashboard_supabase_project_scoped_mcp_live]

## Map-2a dataset -- INVESTIGATED, load DEFERRED (no DB writes made)
Live matrix_map = the 9-site SEED (19 DRAs, 290 stations, 7472 sed/334 tox/175 comm, ALL public=false).
The 2026-06-22 DB2 export = full 345-site (574 DRAs, 7562 stations). VERIFIED (live MCP + codex):
- The seed is a clean SUBSET of DB2's same source-ID lineage (NOT disjoint -> an overlay would NOT
  duplicate; the first AGY draft's "disjoint IDs" claim was WRONG; codex + live ID-range check refuted it).
- Overlapping measurement values are IDENTICAL (6/6 spot-check) -> no staleness.
- Dated-only DB2 load adds ~0 measured data (6772/14244 sediment statements are no-ops on undated events) --
  only registry expansion (mostly EMPTY stations). Real growth needs the `--allow-undated` path (+ migration
  20260620000001).
- Admins BYPASS public=false -> full load = a real 7562-row admin payload; the fetch RPC had NO bbox/pagination.
- CONSENSUS (Claude + codex): defer the load; do bbox/pagination FIRST; then full clean reload + `--allow-undated`
  (or a bounded `--site-ids` pilot). Skip dated-only. Records: docs/design/matrix-map/MAP_2A_DATASET_INVESTIGATION_2026_06_23.md
  + BBOX_PAGINATION_LANE_2026_06_23.md.

## bbox-lane Stage 1 (#407, MERGED) -- backend foundation
Migration `20260623000001` (CREATE OR REPLACE fetch_samples_with_hidden_summary):
- visible_samples filtered to optional `p_bbox` ({min_lng,min_lat,max_lng,max_lat}) + LIMIT 2500 + additive
  return keys total_in_bbox/returned_sample_count/truncated/bbox_applied.
- hidden_* kept PROVINCE-WIDE (codex P1: bbox-scoping them = a spatial oracle for private DRA locations).
- bbox parse wrapped EXCEPTION->province-wide + WGS84 bounds (fail-safe); ALL SECDEF/auth/admin/visibility
  invariants preserved; null bbox == v1 (backward compatible). codex GREEN round 2.
- Server helper surfaces the new fields (optional, pre-migration fallbacks); types extended.

## OWNER-GATED / NEXT
1. **Migration 20260623000001 -- APPLIED + verified live 2026-06-23** (via project-scoped MCP apply_migration;
   verified SECDEF + owner matrix_map_owner + EXECUTE=authenticated-only + new bbox keys + fail-safe parse +
   hidden_* province-wide). The server still passes null bbox (Stage 2 not done), so live behavior is
   UNCHANGED (province-wide, capped at 2500 > current 290). DONE -- nothing further to apply for Stage 1.
2. **bbox-lane Stage 2 (the real next lane; best as a FRESH session):** client viewport-debounced refetch on
   Leaflet moveend/zoomend + marker CLUSTERING + truncated->"zoom in" hint + min-zoom-for-fetch; thread the
   bbox through fetch-samples-server (it already accepts p_bbox); reconcile budget_caps for pan-heavy use;
   tests + e2e. Spec: docs/design/matrix-map/BBOX_PAGINATION_LANE_2026_06_23.md.
3. **THEN** the full DB2 undated load (snapshot-backed clean reload + migration 20260620000001 + index
   preflight), or a bounded `--site-ids` pilot first.
4. Map-2a / PFDA-subchronic / further MO wiring batches (~380 unwired-but-approved substances remain) -- all
   deferred, none blocking.

## Gate cheatsheet (docs/GATE_MODE_SOP.md)
codex (Spark grind [exhausted till Jun 24 -> 5.4-mini or straight 5.5 xhigh] -> 5.5 xhigh stamp) -> commit
(path-scoped) -> test:ci (4-shard) -> npx next typegen + tsc --noEmit -> lint (changed files; repo .venv
lint noise is CI-clean) -> docs:gate -> build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10 ->
test:e2e -> push -> PR -> merge on green (gh pr merge <n> --squash --match-head-commit <FULL-sha>). Manifest
base **4526**. Known CI flake: Node-24 vitest `write EPIPE` -> one `gh run rerun <id> --failed`.

## Method notes
- codex review EARNED ITS KEEP: caught the PFDA plan id-swap, AGY's disjoint-ID error, and a P1 spatial-oracle
  leak in the bbox migration. Run it hard on security-sensitive SQL.
- codex 5.5 xhigh tool-use runs can exceed the 9-min foreground cap -> run in BACKGROUND (run_in_background)
  + read the verdict file; it does not get killed.
- AGY drove the mechanical builds; AGY has NO web access -> live verification stays on Claude WebFetch/MCP.
- Squash-merge + branch-off-the-merged-branch trap: always re-branch off the freshly-pulled main (CRLF on
  archived docs can block `git checkout main` -> `git checkout -- <files>` the line-ending noise first).
