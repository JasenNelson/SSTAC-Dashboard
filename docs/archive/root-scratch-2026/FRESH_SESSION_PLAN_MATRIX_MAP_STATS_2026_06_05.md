# FRESH SESSION HANDOFF -- Matrix Map Selection-Stats panel + panel redesign (2026-06-05)

Plain ASCII. This migrates EXECUTION of the matrix-map stats + panel-redesign plan to a fresh
session. The current session did all research + planning; it wrote NO code for this feature.

## HOW TO USE THIS (start in PLAN MODE)
1. Start the fresh session in PLAN MODE. Do NOT touch code first.
2. READ, in order: this file -> MATRIX_MAP_STATS_ENGINE_DESIGN_2026_06_05.md (the full design +
   locked decisions + scaling addendum) -> CLAUDE.md (L0 at C:\Projects\CLAUDE.md + L1) ->
   docs/GATE_MODE_SOP.md -> the key code files listed below.
3. Plan the implementation at the FILE level (Phase 1 first). ExitPlanMode for owner approval
   BEFORE writing any code.
4. Stay in the matrix-options / matrix-map lane only (see conflict discipline).

## MISSION
Build the Interactive Map "Selection Stats" panel as a credible USEPA ProUCL-equivalent, and
redesign the two map panels. Two threads, plan them together:
A. PANEL REDESIGN (no stats math -- can be Phase 0, ships independently):
   - LEFT panel = STATISTICS ONLY. REMOVE the medium selector AND the substance selector from it
     (both are filters; the RIGHT panel already owns them). Left panel becomes "Selection Stats".
   - RIGHT panel = filters + measurement table. Keep medium + substance filters here. UX: the
     EXPAND button -> covers nearly the full map container (thin edge so the map is barely visible,
     table fully readable); DRAG-to-extend -> much more range (cover most of the map). Also DISABLE
     empty-data medium chips (water/tissue currently have no data -> not selectable; mirror the left
     panel's old enabled=availableMedia.has(medium) pattern).
   - LEFT panel also DRAG-to-extend by its edge.
   - "Excellent UI/UX that looks nice." Consider /plan-design-review before building.
B. STATS ENGINE (ProUCL-equivalent) -- per the design doc, client-side TypeScript:
   src/lib/matrix-map/stats.ts (+ Web Worker for heavy iterations). Phased P1-P4.

## LOCKED OWNER DECISIONS (2026-06-05) -- do NOT re-litigate
1. UCLM default = ProUCL recommended-logic (auto-pick by distribution/n/skew); all methods selectable.
2. Censored handling = runtime SELECTOR (KM / ROS / DL-half); initial = KM.
3. Fidelity = BIT-FOR-BIT ProUCL v5.2 parity -> verify every formula/table/cutoff vs the v5.2
   Technical Guide before hardcoding + build a validation suite against ProUCL's published examples.
4. Local-only Python parity mode = YES (future add-on, gated like requireLocalEngine; not on demo path).
Architecture: CLIENT-JS stats (Vercel can't run Python -- requireLocalEngine 503s on cloud). Data is
in Supabase and will grow large, but stats are always on a FILTERED SELECTION (one substance+unit+
medium+area) which stays bounded; the scaling lever is pushing FILTERING server-side into the
fetch_measurements RPC (return only matching rows), NOT moving stats to the server. See the design
doc's Scaling Addendum.

## PHASED PLAN (fresh session plans the file-level detail in plan mode)
- Phase 0: PANEL REDESIGN (left=stats shell, remove left filters, right resize/drag UX, left drag,
  disable empty-media chips). Autonomous-safe. Ships on Vercel. ~2-3d human / fast w/ CC.
- Phase 1: descriptive stats (min/max/mean/median/SD/CV/P90/P95/n/detection-freq) + Student's-t +
  Chebyshev UCL, wired into the stats panel. Autonomous-safe, no owner method spec needed. Ships.
- Phase 2: GOF (Shapiro-Wilk+Lilliefors normal/lognormal; AD+KS gamma) + recommended-UCL decision
  logic + bootstrap (percentile/BCA/bootstrap-t). Owner confirms the sigma-band cutoffs.
- Phase 3: gamma (approx/adjusted) + Land H lognormal + outlier tests (Dixon n<=25, Rosner n>25) +
  censored handling (KM/ROS/DL2 selector). Highest parity-verification care.
- Phase 4 (optional/future): local-only Python parity + validation mode.
Each phase = own worktree, full gates, codex review, PR-open for owner merge.

## CURRENT STATE (what the 2026-06-05 session did)
PRs MERGED to main today: #254 (manifest vitest_count -> 2992 + stripAnsi fact-extractor fix),
#255 (review_submissions status literals aligned to the DB CHECK + regression test), #256
(siteDataStore + sqlite/queries coverage ~100%). #257 (left-panel medium-selector wiring) CLOSED as
superseded by this redesign (left selector is being REMOVED, not wired).

LIVE SUPABASE CHANGES (via project-scoped MCP, project qyrhsieynzfgyuqzznap) -- NOT YET in repo
migrations (FOLLOW-UP OWED): (1) storage bucket 'documents' (private) + 5 RLS policies on
storage.objects: documents_review_{insert,select_own,update_own,delete_own,select_admin} -> TWG
uploads now work; (2) matrix_map.measurements ADD COLUMN bnrrm_toxicity_id int (unique idx
measurements_bnrrm_toxicity_id_key) + bnrrm_community_id int (COMPOSITE unique idx
measurements_bnrrm_community_id_substance_id_key); (3) DATA: loaded 334 toxicity + 175 community
measurements + 25 new substances. Map now has 3 media: sediment 7472, toxicity 334, community 175.
env_modifier intentionally EXCLUDED as a medium (it is sediment-characterization metadata:
grain size/TOC/pH/AVS/SEM/sulphide/redox/ammonia -- not a contaminant layer).

FOLLOW-UP OWED (own PR, owner-gated): author repo migration file(s) in supabase/migrations/
capturing the storage bucket+policies and the matrix_map schema delta, so the repo stays the source
of truth. The toxicity/community DATA load file is at
.tmp/matrix-map-load/toxicity_community_MINIMAL.sql (and the full Path B at
scripts/matrix-map/etl_bnrrm_to_supabase_output_v1_1_0_multimedium_PATH_B.sql).
ALSO OWED (separate): rebuild the LOST v1.1.0 multimedium ETL as committed code -- the on-disk
scripts/matrix-map/etl_bnrrm_to_supabase.py is v1.0.0 single-medium; the multimedium logic that
produced Path B was never committed. Source SQLite EXISTS at
C:\Projects\Regulatory-Review\2026_Database_Development\data_acquisition\bnrrm_extraction\bnrrm_training.db.

## KEY CODE FILES
- src/components/matrix-options/MatrixMapLeftPanel.tsx -- the left panel (becomes Selection Stats;
  currently has the medium radio (local) + substance + a SELECTION STATS heading + selectedSamples).
- src/components/matrix-options/MatrixMapRightPanel.tsx -- right panel: MultiChipGroup medium filter
  (~line 401), filterMeasurementRows (~849), MeasurementRow fields, expand/extend logic. The
  empty-media-disable fix goes here.
- src/stores/matrix-map/filterStore.ts -- MATRIX_MAP_MEDIA, MatrixMapMedium, filterState (mediums,
  substance_ids, qa), setFilterState. (Note: #257 added a now-unused setSelectedMedium; it was
  closed, so that action is NOT on main -- ignore it.)
- src/stores/matrix-map/measurementStore.ts -- MeasurementRow shape incl value, unit, censored,
  detection_limit, qualifier (~lines 7-28). Stats must bucket per (substance+unit) and treat
  censored values via the chosen estimator, NOT raw value.
- supabase/migrations/20260521000003_*.sql -- fetch_measurements_for_samples RPC (the server-side
  filter-scoping refinement for scaling goes here).
- src/lib/matrix-map/stats.ts -- NEW (the stats engine).
- src/lib/api-guards.ts:56 requireLocalEngine() -- the Vercel/local Python gate (why stats are client-JS).

## HARD RULES (conflict discipline -- 4 PARALLEL SESSIONS LIVE)
Sessions: (1) Regulatory-Review engine-v2 ACTIVE; (2) DRA-KB in C:\Projects\Sediment-DRA-Pipeline;
(3) this SSTAC session (migrating); (4) idle.
- NEVER touch engine-v2 trees/worktrees/routes (src/**/engine-v2, src/lib/engine-v2, m1a/m1b/s4
  worktrees, dashboard engine-v2 routes) or engine-v2 Supabase tables (v2_projects, etc).
- NEVER touch / create / remove worktrees you did not create. Owner: "if you didn't create them
  leave them the f alone." Clean ONLY your own, only after PRs land, only with owner OK.
- SUPABASE MCP IS LIVE (project qyrhsieynzfgyuqzznap) -- overrides the stale "MCP dead" memory rule.
  READ-ONLY freely. WRITES need owner per-action OK and stay scoped to matrix_map + storage ONLY
  (never engine-v2 / shared tables). For BULK data loads, give the owner a .sql FILE to paste
  (pushing >100KB through MCP costs ~150K+ context tokens -- wasteful).
- JUNCTION CASING: mklink target MUST be canonical C:\Projects\sstac-dashboard\node_modules (capital
  P). The harness reports cwd as lowercase c:\projects -- copying that breaks worktree e2e (turbopack
  rejects the junction; webpack/next dev WITHOUT --turbopack follows it). Worktree dev server: use
  `npx next dev -p <port>` (NO --turbopack).
- JUNCTION TEARDOWN: `fsutil reparsepoint delete "<wt>\node_modules"` FIRST (cmd/c rmdir + Remove-Item
  may be blocked by the harness safety guard; fsutil works), verify shared store dir count unchanged
  (was 722), THEN git worktree remove + prune. Recursive delete over a live junction empties the
  shared store.
- GATES (in fresh worktree only): lint -> npx tsc --noEmit -> CI=true npm run test:ci ->
  build:monitored:clean -> npm run test:e2e (expect 138P/69S/0F, casing-lines=0 if junction casing
  is right) -> npm run docs:gate. codex iterate-to-GREEN before commit; 4 gates before push.
- CODEX is a SHARED single-consumer backend across the 4 sessions. Re-probe before EVERY run
  (Get-CimInstance Win32_Process Name='codex.exe'); if any app-server OR an active `review -` is
  present -> DEFER (it is likely engine-v2 or DRA-KB). Never barge in, never kill codex/node by name.
  DO NOT over-iterate the codex loop -- STOP at GREEN (a 2026-06-05 lesson: 5 wasted rounds chasing
  doc-staleness against our own same-session merges).
- ASCII only (code point <= 127). AI never writes qa_status / promotes catalog / writes verdicts.
- Stats math is REGULATORY: bit-for-bit ProUCL v5.2 parity + validation suite; owner confirms the
  method cutoffs flagged "verify before hardcode" in the design doc.

## CONTEXT POINTERS
- MATRIX_MAP_STATS_ENGINE_DESIGN_2026_06_05.md -- the full design (methods, libs, architecture,
  decisions, scaling, phases).
- AUTONOMOUS_OPS_WORKPLAN_24x7_2026_06_05.md -- the living workplan (map progress, redesign section,
  live-DB changes, iteration log).
- WHOLE_APP_READINESS_REPORT_2026_06_04.md + DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md (rev11) +
  WHOLE_APP_DEMO_READINESS_PROGRESS_2026_06_04.md -- demo readiness + the STEP-1 SQL preflight
  (NOTE: the live preflight this session showed the prod DB is ~96% already migrated; only the
  storage bucket (now fixed) + the map multi-media columns (now added) were missing).
- Memory: feedback-mo-complete-incomplete-components-over-polish; feedback-session-process-ledger-
  and-cleanup; dashboard-worktree-e2e-env-red-and-gate-orchestration (junction casing root cause).
