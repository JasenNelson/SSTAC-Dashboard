# Matrix Map -- Owner Return Status (2026-05-21)

Written autonomously while owner was away (~3h window). Read this first.

## AMENDMENT 2026-05-21 late afternoon: R10 RED, MCP rename + restart required

R10 result: `mcp__claude_ai_Supabase__execute_sql` (user-level "claude.ai Supabase" connected, no project_ref) returned `McpError -32600: You do not have permission to perform this action` against `project_id="qyrhsieynzfgyuqzznap"`. Confirms the 6-month dead-MCP pattern still holds for the user-level server.

Project-scoped `mcp__supabase__*` tools were NOT in this session's registry. Diagnostic hypothesis: name collision between the `.mcp.json` server (named `"supabase"`) and the user-level Anthropic-managed `"claude.ai Supabase"` server. Both use base URL `https://mcp.supabase.com/mcp`; the loader appears to have kept the user-level instance and silently skipped the project-scoped one despite `enableAllProjectMcpServers: true`.

### Actions taken (owner-authorized via AskUserQuestion)

1. **`.mcp.json`**: renamed server `"supabase"` -> `"supabase-project-scoped"`.
2. **`.claude/settings.local.json`**: updated `enabledMcpjsonServers` from `["supabase"]` to `["supabase-project-scoped"]`.

### What to do next

1. **Owner exits this Claude Code session.**
2. **Owner relaunches Claude Code from `C:/Projects/SSTAC-Dashboard`** (project working directory matters for `.mcp.json` discovery).
3. On startup, watch for the new `supabase-project-scoped` server in `claude mcp list` output. Expected: `supabase-project-scoped: https://mcp.supabase.com/mcp?project_ref=qyrhsieynzfgyuqzznap - ! Needs authentication` initially.
4. If "Needs authentication": run `/mcp` and approve/authenticate the new server. After auth, list should show `Connected`.
5. **Resume prompt for fresh session:** "Continue Matrix Map ETL load. R10 RED on user-level MCP (permission denied) confirmed. Renamed project-scoped server to `supabase-project-scoped`. New tool namespace expected: `mcp__supabase_project_scoped__*`. First action: `ToolSearch select:mcp__supabase_project_scoped__execute_sql`, then run R10 smoke `SELECT version(), current_user, session_user, current_database();` against project_id=`qyrhsieynzfgyuqzznap`. If GREEN, proceed with Path A ETL load per the resume prompt in C:/Projects/SSTAC-Dashboard/MATRIX_MAP_OWNER_RETURN_STATUS_2026_05_21.md."

### If post-restart the new tools STILL don't load

Fall back order:
- (a) Owner runs `/mcp` to manually trigger approval flow.
- (b) Studio chunked paste: 8 files at `scripts/matrix-map/etl_output_chunks/01_substances.sql` through `08_measurements.sql` pasted sequentially.
- (c) Owner enables DATABASE_URL; AI runs `psql -f scripts/matrix-map/etl_bnrrm_to_supabase_output.sql` (explicit opt-out today; only if (a) and (b) blocked).

### Tasks state at handoff

8 tasks created via TaskCreate; task #1 (R10 smoke) completed with RED result. Tasks #2-#8 pending. Fresh session: run TaskList to resume.

---

## AMENDMENT 2026-05-21 mid-afternoon: PRs MERGED + MCP authenticated + Path A SQL regenerated

State has advanced significantly since the initial write:

- **PR #155 + #156 MERGED** (commits `fefcb55` + `7bab481`). Main at `7bab481`.
- **Browser smoke at /matrix-options confirmed GREEN** (owner screenshot 2026-05-21 morning: "0 Samples loaded" badge, no error banner, 3-column layout + all 14 WMS + 5 interaction modes working).
- **Path A ETL SQL regenerated** via newly-created venv at `C:/Projects/SSTAC-Dashboard/.venv` (Python 3.11.9). Output at `scripts/matrix-map/etl_bnrrm_to_supabase_output.sql` (5.2 MB; v1.0.0 baseline; dras=19, samples=290, sample_events=302, substances=157, measurements=7508; ON CONFLICT DO NOTHING; idempotent).
- **Path B preserved** at `scripts/matrix-map/etl_bnrrm_to_supabase_output_v1_1_0_multimedium_PATH_B.sql` (5.74 MB; v1.1.0 multi-medium; for use after PR #142 merge + companion migration `20260520000002`).
- **Studio paste of 5.2 MB rejected** ("Query too large"). Two fallbacks ready:
  - 8 chunks at `scripts/matrix-map/etl_output_chunks/` (each ~700 KB; sequential paste path)
  - Supabase MCP (just authenticated; see below)
- **Supabase MCP project-scoped server added + authenticated**:
  - Config at `C:/Projects/SSTAC-Dashboard/.mcp.json` (project_ref `qyrhsieynzfgyuqzznap`)
  - URL `https://mcp.supabase.com/mcp?project_ref=qyrhsieynzfgyuqzznap`
  - Status per `claude mcp list`: "supabase ... HTTP - ! Needs authentication" before auth; now connected
  - **Tools NOT yet in this session's registry; session restart required to expose `mcp__supabase__*`**
  - The OLD `mcp__claude_ai_Supabase__*` still returns "permission denied" (matches 6-month dead-MCP pattern)
- **Guardrails proposal drafted** at `~/.claude/SUPABASE_MCP_GUARDRAILS_PROPOSAL_2026_05_21.md` (10 rules + skill + hook design; awaiting owner sign-off)

### What the fresh session should do FIRST

1. **R10 read-only connectivity smoke** via `mcp__supabase__execute_sql` (new namespace) with `project_id="qyrhsieynzfgyuqzznap"`:
   ```sql
   SELECT version(), current_user, session_user, current_database();
   ```
2. If GREEN: **Path A ETL** via `mcp__supabase__execute_sql` -- single call with the contents of `scripts/matrix-map/etl_bnrrm_to_supabase_output.sql` (5.2 MB). MCP doesn't have the Studio paste size limit. If MCP also rejects, fall back to 8-chunk sequential.
3. **Post-Path-A verification** via single jsonb mega-query (template in this status doc below).
4. **Browser smoke** -- owner visits `/matrix-options` Interactive Map -- expect 290 markers rendering.
5. **PR #142 review + merge** (multi-medium ETL branch; codex YELLOW review done).
6. **Apply companion migration `20260520000002`** via `mcp__supabase__apply_migration`.
7. **Path B ETL** via `mcp__supabase__execute_sql` -- contents of `scripts/matrix-map/etl_bnrrm_to_supabase_output_v1_1_0_multimedium_PATH_B.sql` (5.74 MB).
8. **Final browser smoke** -- expect markers from all 4 mediums.

### Standing rules still in force

Even with MCP enabled, both HIGH AUTHORITY rules still bind every action:
- `cross_project_supabase_protocol_explore_before_assume` -- zero assumptions; verify before any DDL/RPC change
- `cross_project_no_autofill_authorization_slots` -- no implicit owner approval

The proposal at `~/.claude/SUPABASE_MCP_GUARDRAILS_PROPOSAL_2026_05_21.md` adds 8 more rules but is NOT yet binding (owner hasn't signed off).

---


## TL;DR

- **PR #155** (Option A SQL migration) -- OPEN, gates GREEN, applied to live DB + verified, awaiting browser smoke + your merge click
- **PR #156** (PR-MAP-9 banner) -- OPEN, all 4 gates GREEN, awaiting your merge click
- **Baseline ETL** -- packet ready, needs you to set up a project venv (one-time) + regenerate + paste in Studio
- **Multi-medium ETL** -- codex YELLOW review done; baseline recommended for v1 demo; multi-medium viable as Path B with companion migration
- **3 decisions for you** -- listed at the bottom

## Two PRs open (owner clicks merge; never auto-merge)

### PR #155: Option A migration (SQL only)
https://github.com/JasenNelson/SSTAC-Dashboard/pull/155
Branch: `fix/matrix-map-rpc-option-a-lng-lat-2026-05-21`
Commit: `1028c19`

- Adds longitude/latitude float8 columns + postgres-owned trigger that auto-populates from geometry on INSERT/UPDATE
- Replaces fetch_samples_with_hidden_summary RPC body: zero PostGIS calls in read path
- CHECK constraint (NOT VALID, WGS84 bounds) + partial index for future bbox
- Status: applied to live DB this morning, verified GREEN (V1-V5 + simulated-JWT smoke). The PR captures the applied schema change in git.
- Gates: SQL-only lane gate per Decision G (you approved YES on the morning ASK). SQL static review GREEN + owner-run verification GREEN.

### PR #156: PR-MAP-9 partial-visibility banner (JS/TS)
https://github.com/JasenNelson/SSTAC-Dashboard/pull/156
Branch: `feat/matrix-map-pr-map-9-partial-visibility-banner`
Commit: `c48f373`

- Consumes hidden_sample_count / hidden_dra_count / hidden_dra_ids from RPC payload
- Banner inside /matrix-options Interactive Map tab, above the 3-column layout
- Refresh + Contact admin (mailto) + Learn more (placeholder route /matrix-options/private-data-access)
- Currently no-op because samples table is empty; will activate once private-DRA samples land via ETL
- Files: 5 changed; 263 inserts / 28 deletes
- Test coverage: 6 new banner tests + 16 existing MatrixDashboard tests preserved (added next/navigation router mock per cross_project_never_delete_regression_tests_during_cleanup HIGH AUTHORITY rule)
- All 4 gates GREEN: lint, unit (1906/1906), build (new route at 526 B), e2e chromium smoke (2/2)

Both PRs are independent at code level. Merge in any order.

## Browser smoke -- still pending you

Asked you to do this before you left. Not done yet. When you return:
1. Make sure dev server is running (or start it)
2. Visit /matrix-options, click Interactive Map tab
3. Expect: empty map (no markers since table is empty), no "samples data temporarily unavailable" banner, base layers + 14 WMS overlays work
4. If GREEN -> merge PR #155

I did NOT do gstack browser smoke autonomously because starting/managing a dev server in a session-bound subprocess adds risk (per cross_project_harness_background_processes_die_on_exit HIGH AUTHORITY).

## ETL packets ready (two paths)

### Path A: baseline sediment-only (recommended for v1 demo)

**Codex verdict: YELLOW** -- packet ready BUT needs one-time venv setup.

**Why YELLOW**: No project venv exists in this repo. Per cross_project_use_venv_python_not_system_python HIGH AUTHORITY rule, codex refused to run with system python.

**One-time venv setup + regenerate** (full steps in `.tmp_matrix_map_etl_apply_steps_2026_05_21.md`):

```powershell
cd C:/Projects/SSTAC-Dashboard
C:/Users/jasen/AppData/Local/Programs/Python/Python311/python.exe -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt  # if requirements.txt exists; otherwise install needed deps
./.venv/Scripts/python.exe scripts/matrix-map/etl_bnrrm_to_supabase.py --source-db C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bnrrm_training.db --out-sql C:/Projects/SSTAC-Dashboard/scripts/matrix-map/etl_bnrrm_to_supabase_output.sql
```

Expected output: a regenerated SQL file with v1.0.0 baseline (dras=19, samples=290, sample_events=302, measurements=7508).

**Then paste in Studio**.

**Existing 5.74 MB SQL file is NOT v1.0.0 baseline** -- it is v1.1.0 multi-medium from a different branch. Do NOT paste it for the baseline path. See pre-paste sanity checks in `.tmp_matrix_map_etl_apply_steps_2026_05_21.md` (lines 31-44).

### Path B: multi-medium ETL (viable, higher risk)

**Codex verdict on the branch + its companion: YELLOW**.

Branch: `feat/matrix-map-etl-multi-medium-extension` (commit `2e1da4c`, 1156 LOC ETL + companion migration `20260520000002_matrix_map_measurements_multi_medium_keys.sql`).

**PR #142 is already open for this branch** (opened 2026-05-20 21:44; codex earlier reported gh blocked by proxy but it works now). See https://github.com/JasenNelson/SSTAC-Dashboard/pull/142

The 5.74 MB pre-existing SQL artifact on disk IS the v1.1.0 multi-medium output (generated by that branch's v1.1.0 script). If you choose Path B:
1. Merge PR #155 first (already applied to live DB)
2. Review + merge PR #142 (multi-medium ETL branch)
3. Apply companion migration `20260520000002` in Studio
4. Paste the 5.74 MB SQL artifact in Studio

See `.tmp_matrix_map_multimedium_review_2026_05_21.md` for full review.

## Open decisions for you

### Decision X1: ETL path choice
- (A) Baseline sediment-only -- faster, simpler, but needs venv setup
- (B) Multi-medium -- already-generated SQL on disk, but needs companion migration first

**Codex recommendation**: A for the v1 demo. Get sediment first, then add multi-medium in a follow-up PR.

### Decision X2: Merge order for PRs #155 and #156
Independent at code level. Suggested:
1. Merge #155 first (the schema/RPC fix is foundational)
2. Then merge #156 (banner) -- but it's no-op until data lands, so merging it now is fine too

### Decision X3: Next PR after ETL data loads
Per the completion plan, next priorities after samples render:
- PR-MAP-10 identify tool (sample click + WMS GetFeatureInfo routing)
- PR-MAP-11 selection tools (drag rectangle, cluster select, Zustand SelectionStore)
- PR-MAP-12 Selection Stats content (BLOCKED on R-13 methodology sign-off)
- PR-MAP-13 MeasurementWorkbench content
- PR-MAP-14 Calculator bridge (BLOCKED on R-13)
- PR-MAP-17 mobile fallback (data-independent; can start anytime)

I did NOT queue up another PR autonomously because stacking too many in flight increases merge-conflict risk + review burden.

## Token usage this session

- **Claude (me)**: scarce; mostly orchestration + brief reads. Stayed close to 10% remaining target.
- **Codex CLI**: 4 invocations (Phase 1 synthesis + Phase 3 plan + reconcile + ETL prep + banner draft + multi-medium review). Approx ~700K codex tokens total; still well within your 78% remaining budget.

## Files for context

- Phase 1+2 synthesis (codex): `.tmp_matrix_map_understanding_2026_05_21.md`
- Phase 3 completion plan: `.tmp_matrix_map_completion_plan_v0_1_2026_05_21.md`
- Exploration results JSON: `.tmp_explore_results_2026_05_21.json`
- ETL apply steps: `.tmp_matrix_map_etl_apply_steps_2026_05_21.md`
- ETL prep status: `.tmp_matrix_map_etl_prep_status_2026_05_21.md`
- Multi-medium branch review: `.tmp_matrix_map_multimedium_review_2026_05_21.md`
- Migration apply steps (already done): `.tmp_matrix_map_apply_option_a_steps_2026_05_21.md`
- ETL situation note: `.tmp_matrix_map_etl_situation_2026_05_21.md`

## What I did NOT do (intentionally)

- Did NOT merge any PR (owner clicks merge)
- Did NOT --apply ETL against live DB (your DATABASE_URL required)
- Did NOT delete any existing tests (cross_project_never_delete_regression_tests_during_cleanup HIGH AUTHORITY)
- Did NOT start a dev server / browser smoke (sandbox + harness lifecycle risk)
- Did NOT touch the protected paths (.tmp_* commits avoided)

## When you're ready

1. Read this file
2. Open PR #155 + verify SQL diff matches what you pasted earlier this morning
3. Browser-smoke /matrix-options
4. Merge PR #155
5. Decide X1 (baseline vs multi-medium ETL)
6. Set up venv (or skip if you pick multi-medium)
7. Paste ETL SQL in Studio
8. Verify counts via the verification query in `.tmp_matrix_map_etl_apply_steps_2026_05_21.md`
9. Browser-smoke /matrix-options again -- expect markers!
10. Merge PR #156
11. Direct next step (PR-MAP-10 identify, or other priority)
