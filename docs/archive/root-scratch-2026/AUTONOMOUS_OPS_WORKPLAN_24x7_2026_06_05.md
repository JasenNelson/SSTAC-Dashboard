# Autonomous ops workplan -- 24/7 -- SSTAC Dashboard -- started 2026-06-05

Plain ASCII. LIVING DOC: every loop iteration reads this first and updates it last. Owner directive
(2026-06-05): "get the app fully functional by running autonomously 24/7 with minimal downtime and
excellent quality, /codex-review all the way along (targeted, strategic, holistic iterative
adversarial loops) for work plans, code and documents."

## Mission + definition of done

FULLY FUNCTIONAL = every surface in `WHOLE_APP_READINESS_REPORT_2026_06_04.md` rated Working IN ITS
INTENDED ENVIRONMENT (hybrid demo: local primary, Vercel backup), all demo-blockers resolved, the
codex re-review queue cleared, and no known real bug (e.g. the queries.ts CHECK-violation) left
unfixed. Quality bar: NOTHING merges without Leg-1 Opus GREEN + Leg-2 codex-family GREEN.

## Standing rails (pointers, not duplicates)

`C:\Users\jasen\.claude\plans\can-you-explore-the-zazzy-mountain.md` (the reviewed session plan:
conflict discipline, worktrees+junctions, gates-in-fresh-worktree-only, docs-gate, CRLF guard,
LESSONS.md serialize-last, narrow AI-merge classes) + `CLAUDE.md` L0/L1 + `docs/GATE_MODE_SOP.md`.
Hard lines: AI never writes qa_status / verdicts / catalog / Supabase paste; never merges without
codex-family GREEN; never touches other sessions' worktrees or kills processes; max 3 background
subagents; owner-gated items execute ONLY on explicit owner go.
PROCESS-LEDGER RULE (owner directive 2026-06-05): every session ledgers the OS processes + codex
CLI instances it spawns (purpose, start time, PID when known); killing your OWN is REQUIRED at
close-out/handoff; killing FOREIGN processes requires deep investigation (PID tree, CommandLine,
start-time, owning-session evidence) PLUS explicit HITL approval with written safe-to-kill
rationale; never match by name alone. Memory anchor
[[feedback-session-process-ledger-and-cleanup]].
JUNCTION CASING RULE (it5, Lane F-proven): node_modules junction targets MUST use canonical
on-disk casing `C:\Projects\sstac-dashboard\node_modules` (capital P). The harness reports cwd as
lowercase c:\projects -- copying that casing into mklink breaks worktree e2e (webpack dual-casing
module storm). Verify inherited worktrees' junction Target casing BEFORE gates.

## Codex-availability protocol (24/7 reality)

it4 STATUS: codex USAGE LIMIT hit 2026-06-05 ~07:35 -- "try again at 10:23 AM". Lane E review was
interrupted mid-run (queue: Lane E 54b730d re-review + kit round-5 confirmation). Completed before
the limit: kit rounds 2-4, #254 targeted GREEN, Lane D 0819811 GREEN. Timer armed for 10:23.

Each iteration that needs Leg 2: (1) HARD GUARD `Get-CimInstance Win32_Process -Filter
"Name='codex.exe'"` -- if >0 the desktop app is open -> CLI FORBIDDEN; (2) when CLI free -> use it
(app-local shim, stdin pipe, stall-monitored, explicit VERDICT line); (3) when blocked -> cursor-
agent (out of usage until ~6/15) -> owner-app (when owner present) -> else Opus-GREEN + append to
re-review queue + PR stays OPEN (not merged). Work never stops; MERGES gate on codex availability.

## LIVE SUPABASE CHANGES THIS SESSION (via project-scoped MCP, project qyrhsieynzfgyuqzznap) -- NOT YET IN REPO MIGRATIONS
MCP is LIVE now (overrides the stale "MCP dead" rule). Preflight showed the prod DB was ~96%
already migrated (all app/CEW/catalog/role/matrix_reviews/document_tags/engine-v2 objects PRESENT).
Applied via MCP execute_sql (owner-approved each):
1. storage bucket 'documents' (private) + 5 RLS policies on storage.objects: documents_review_
   {insert,select_own,update_own,delete_own} (own-files CRUD) + documents_review_select_admin
   (admin/matrix_admin read-all). TWG uploads now work end-to-end.
2. matrix_map.measurements: ADD COLUMN bnrrm_toxicity_id int, bnrrm_community_id int (mirror
   bnrrm_chemistry_id). Unique idx: measurements_bnrrm_toxicity_id_key (single, tox is 1-row-per-id)
   + measurements_bnrrm_community_id_substance_id_key (COMPOSITE -- community has multi-metric per
   event; my initial single-col idx was WRONG, fixed). env_modifier EXCLUDED as a medium (it's
   sediment-characterization metadata: grain size/TOC/pH/AVS/SEM/sulphide/redox/ammonia).
3. PENDING owner paste: .tmp/matrix-map-load/toxicity_community_MINIMAL.sql (182 substances + 509
   measurements = 334 tox + 175 community; deps already live). Then verify counts via MCP.
FOLLOW-UP OWED: author repo migration files capturing #1 + #2 (+ #3 once loaded) so supabase/
migrations/ stays source of truth; path-2 = rebuild the LOST v1.1.0 multimedium ETL (on-disk
etl_bnrrm_to_supabase.py is v1.0.0 single-medium; source SQLite EXISTS at C:\Projects\Regulatory-
Review\...\bnrrm_training.db). UI: front-end medium selector was NEVER built -- the real visible gap.

## BACKLOG (priority order; update every iteration)

P0 IN FLIGHT
- [x] Manifest refresh PR #254 MERGED to main 2026-06-05T14:58Z (squash; owner-confirmed). CI was
      ALL-GREEN incl required E2E 13m38s; codex CLI targeted review GREEN.
- [x] E2E ENV FIXED (Lane F root cause): junction target CASING -- lowercase
      C:\projects\...\node_modules target makes webpack key next-internals under two spellings
      (1351 dup blocks) -> cold-page timeouts. Fix: mklink target MUST be canonical
      C:\Projects\sstac-dashboard\node_modules. Verified: 0 warnings, e2e 138P/69S/0F (baseline).
      Lane D + E worktree junctions REPAIRED (store intact 722). RULE now in standing rails below.
- [ ] P1 queries.ts fix IMPLEMENTED in worktree p1-review-status-2026-06-05 (branch
      fix/p1-review-submission-status-2026-06-05 off a6f617a, dirty, uncommitted): 4 CHECK-violating
      literals fixed (queries.ts 'draft'/'submitted', api/client.ts same) + stale type narrowed +
      REVIEW_SUBMISSION_STATUSES const + new regression test 6/6 PASS, tsc 0. Zero runtime callers
      (dead-code layer; live routes already correct). AWAITS codex commit-review then full gates.
- [ ] LOCAL E2E ENV DEFECT -- OWNER DECIDED it4: HOLD ALL PUSHES until root-caused + fixed
      (quality-first). Lane F investigation RUNNING (controlled one-variable experiments on the
      casing hypothesis; env-level fix preferred; propose-not-apply for config changes).
      EXCEPTION GRANDFATHERED: #254 already pushed under its per-PR approval, CI arbitrates it.
- [x] Lane D queries.ts fix = PR #255 OPEN (0819811). FULL TRUE-GREEN local gates: lint 0err /
      tsc 0 / unit 2998 CI=true / build exit0 / e2e 138P-69S-0F casing=0 / docs:gate PASS.
      codex GREEN. OWNER MERGES after CI green (production-source class; do not auto-merge).
      Note: branch base pre-#254; GitHub merge-base diff correct (5 files); rebase optional.
- [x] Lane E coverage tests = PR #256 OPEN (54b730d). FULL TRUE-GREEN gates: lint 0err / tsc 0 /
      unit 3038 CI=true (one v8-coverage .tmp ENOENT flake, single retry clean) / build 84/84 /
      e2e 138P-69S-0F casing=0 / docs:gate PASS. Opus Leg-1 GREEN (5 lenses). AWAITS codex Leg-2
      at 10:23 window + CI green -> then narrow-class AI-merge.
- [x] P1 dead-code sweep DONE (report-only): DEAD_CODE_SWEEP_REPORT_2026_06_05.md at root.
      Broken imports CLEAN. Owner decisions: html2canvas removal (package.json = Tier-1 gated);
      api/db dead layer live-vs-retire (PR #255 test now imports it); 18 dead API types
      conditional on that. Autonomous-safe backlog now EXHAUSTED pending 10:23 codex window.
- [ ] KIT rev5 in flight: r4 verify caught ONE residual gap -- document_tags join table (no-DDL
      class, same as matrix_reviews) -- targeted fix+verify workflow running. Then codex round-5.
- [ ] NEW BACKLOG from kit loop: (a) land canonical matrix_reviews DDL in a migration (live-written
      table has NO CREATE TABLE anywhere in repo); (b) reconcile stale database_schema.sql
      (review_files, documents) with live code. Both owner-gated schema-doc PRs.

P0 OWNER-OWED INPUTS (blocked on owner; surface in checkpoint, do not nag)
- [ ] STEP 1 pre-flight SQL results (kit) -- unlocks remedies; hybrid => run against BOTH projects
      if local and Vercel point at different Supabase projects.
- [ ] codex desktop verdict on the 4 deliverables (CODEX_DESKTOP_PROMPT_4_DELIVERABLES_2026_06_05.md).
- [ ] Eco yes/no; qa-flip run (Card A); Type-B blanks (Card B) -- OWNER_ACTION_CARDS_2026_06_05.md.

PHASE-0 RESEARCH FINDINGS (2026-06-05, MO_PHASE0_DECISION_BRIEFS doc; owner caught 2 real bugs):
- PATH B map data = REGENERATE-FIRST, do NOT paste: the multimedium monolith (8675 meas, v1.1.0
  2026-05-20) inserts cols bnrrm_toxicity_id/community_id/env_modifier_id that DO NOT EXIST in the
  live matrix_map schema (only bnrrm_chemistry_id); 8 chunks are stale v1.0.0 sediment-only. NEEDS:
  additive schema migration (add the 3 medium-FK cols) + regen, THEN paste. Rollback = DELETE WHERE
  medium<>'sediment' (290-sample baseline survives; inserts ON CONFLICT DO NOTHING).
- QA TWO-DIM (owner correction): qa_status overloads AI-verified + HITL-approved. The 84 "approved"
  records were AI-SELF-CERTIFIED by codex 2026-05-23 (reviewed_by=codex), NOT HITL-reviewed. REC
  Option A (no migration): canonical_source_status = AI axis, qa_status = HITL-only, FLIP 84 ->
  needs_review + relabel ai_verified_*. The 20-IRIS qa-flip is ON HOLD pending this. (Was Card A.)
- EQUATION LABEL WRONG: "BC Protocol 1 v5 DRA baseline equation" is misleading -- the 4 eqns are
  sediment-correct (Di Toro EqP, ERDC/ACFN BSAF, HC/EPA HHRA) but from generic science + Phase 2
  research, NOT Protocol 1 v5 (a 2027 DRAFT target; current std = Protocol 28). Catalog cites a
  placeholder marked "not an evidence source". FIX = one-line string (owner picks final wording);
  regulatory-correctness, owner-confirm. AWAITING owner decisions on all 3.

P1-TOP OWNER DIRECTIVE (2026-06-05): Interactive Map MULTI-MEDIA COMPLETION is first-class MO work.
Map currently sediment-only despite multi-media front-end design; lane stalled (PATH_B multimedium
ETL artifacts in scripts/matrix-map/, untracked; MATRIX_MAP_*.md handoffs from 05-20/21). Deep-dive
assessment angle running (mo-e6); roadmap doc will carry the phased completion plan. ANTI-PATTERN
RULE: do NOT schedule polish-class items (e.g. The Guide refresh) in consecutive autonomous
sessions while core components sit incomplete; rank completion over polish, always.

P1 AUTONOMOUS-SAFE CODE (one PR each; own worktree; full gates; PR-open unless narrow-class)
- [ ] Fix src/lib/db/queries.ts createReviewSubmission status:'draft' -- violates
      review_submissions CHECK (IN_PROGRESS|SUBMITTED). Verified real. Decide fix-vs-remove by
      whether anything imports it (grep first); align tests.
- [ ] Test-coverage adds: bn-rrm siteDataStore.validateChemistry breadth; other low-coverage libs
      (sqlite/queries ~77%). Pure additions = AI-merge class after codex GREEN.
- [ ] Repo-wide broken-import / dead-code sweep OUTSIDE engine-v2 + reg-review-FE + shared files.

P2 OWNER-JUDGMENT (build only on owner go; default PR-open)
- [ ] Agentic OS card visibility on Vercel (key off SERVER spawn flag, not NEXT_PUBLIC_*).
- [ ] Admin "All Systems Operational" -> honest status. 
- [ ] Password-reset / email-verification flows. Standalone SSD route scope.

P3 REVIEW-DEBT (clear when codex available)
- [ ] Queue: session plan + 4 deliverables (2026-06-04/05 entry); #252 LOW; #211 (2026-05-31).

P4 PERIODIC (every iteration)
- [ ] Conflict re-scan (parallel lanes, worktree mtimes) BEFORE touching any lane.
- [ ] Checkpoint `WHOLE_APP_DEMO_READINESS_PROGRESS_2026_06_04.md` every ~2-3h.
- [ ] Re-probe codex guard once per major task. Orphan count read-only at session boundaries.

## Loop mechanics

Dynamic /loop (self-paced). Wake signals: harness task-notifications (bg tasks, workflows) + owner
messages (remote control). Fallback heartbeat 1200-1800s when idle-waiting on owner/codex; 270s only
when actively driving a local gate sequence. Context summarization WILL happen on a 24/7 run -- this
doc + the checkpoint + the kit are the continuity anchors; trust them over memory. If the session
dies: owner relaunches and pastes this file (or sets up /schedule cloud routine as a supervisor).

## CODEX LEG-2 = RED on the 4 deliverables (2026-06-05; full log .tmp/plan-review/codex_cli_verdict_4_deliverables.log) -- FIX BEFORE OWNER ACTS ON THE KIT

All findings VALID (agree, no argument-back). The KIT currently has unsafe/incomplete owner steps:
- [P1] Remedy B "paste whole database_schema.sql" is UNSAFE: on main it makes POLICIES without IF
  NOT EXISTS (db_schema:240), inserts sample announcements/milestones (881-896), GRANTs
  INSERT/UPDATE/DELETE on ALL public tables (904) -> can duplicate demo content + broaden privileges.
  FIX: give guarded CREATE TABLE IF NOT EXISTS blocks only / a vetted migration, NOT a wholesale paste.
- [P2] STEP 1 SQL not safe when tables absent: 1d "select count(*) from user_roles" errors if 1b
  shows it missing. FIX: use to_regclass()/pg_constraint guarded probes; 1c must check the CHECK
  constraint via pg_constraint, not just columns.
- [P2] Pre-flight MISSES CEW poll tables (polls, poll_votes, ranking_polls/votes, wordcloud_*) --
  db_schema:920-995, not in migrations; CEW is a rated demo surface. Add them or mark out-of-scope.
- [P2] Matrix Map Remedy D incomplete: needs the full ordered chain incl 20260520000004,
  20260521000001/2/3 (right panel calls fetch_measurements_for_samples from ...003) + RLS-before-RPC.
- [P2] Local-demo env gates incomplete: Agentic OS PTY also needs AGENTIC_OS_PTY_SECRET
  (pty-token/route.ts:65-71, agentic-os-pty-server.mjs:48-56) -- a THIRD gate beyond the two flags;
  engine-v2 evaluate/extract 503s unless LOCAL_ENGINE_ENABLED=true. Add to checklist.
- [P2] Report line ~154-156 still cites dirty 2696 test count as main evidence; main committed = 481.
ACTION: fix kit+report per above, then re-run codex Leg-2 to GREEN before owner uses the kit.
STATUS 2026-06-05 it3: round-1 (6 findings) FIXED + Opus-verified GREEN; codex Leg-2 re-run came
back RED with 4 NEW findings (report still pointed at whole-schema paste; v2_projects table-vs-
column probe; review_files LIVE contract filename/mimetype/file_size/uploaded_at vs STALE
database_schema.sql:480 file_name/mime_type -- REAL code-vs-schema drift; Agentic OS 3-gate in
report). ALL 4 FIXED + independently verified GREEN (round-2 workflow; also caught extra
`documents` drift: live insert uses user_id/user_email absent from stale schema). KIT+REPORT now
rev2. Codex Leg-2 ROUND 3 QUEUED (blocked: desktop app reopened + parallel session mid
codex-review). FOLLOW-UP BACKLOG: reconcile stale database_schema.sql (review_files, documents)
with live code -- separate owner-gated PR.

## FRESH-SESSION RESUME (2026-06-05 ~05:40 -- session poisoned, Usage-Policy false-positives)

Per memory dashboard_usage_policy_poisoned_context_fresh_session: START FRESH, paste THIS file.
1. Manifest refresh DONE (count=2992; the real number -- 481 committed + 2696 dirty were both
   stale). Worktree manifest-refresh-2026-06-05 has 2 clean changes: docs/_meta/docs-manifest.json
   (vitest fields only, numstat 3/4, NO CRLF flip) + scripts/verify/update-manifest-facts.mjs
   (stripAnsi fix that made extraction work, 10/2). NEXT (fresh session): path-scoped stage ONLY
   those 2 files, full gates + docs:gate, PR-open; codex Leg-2 then AI-merge (narrow class) on GREEN.
   Also update the readiness report's stale count reference to 2992 (codex P2-6).
2. Re-run codex Leg-2: sed -n '/^---$/,$p' CODEX_DESKTOP_PROMPT_4_DELIVERABLES_2026_06_05.md |
   codex review -  [it2 CAUTION: the earlier "CLI is SAFE" note is STALE -- re-probe found 2 of 8
   codex.exe are app-server (DESKTOP APP OPEN) -> CLI FORBIDDEN until app closed; owner confirmed
   close-app-then-CLI route via remote control. Re-probe guard before every codex run.]
3. IN FLIGHT it2: 3 HITL walkthroughs building via workflow (3 writers + adversarial verify loop);
   prompts in .tmp/ops-prompts/lane-c*.md; outputs HITL_WALKTHROUGH_{QA_FLIP,TYPE_B_VARIANT,
   ECO_DECISION}_2026_06_05.md.
4. DONE it2: /grill-me-codex + /grill-with-docs-codex installed user-level (security review CLEAN:
   pure markdown, byte-identical to upstream MIT fork). Bundled third skill named "codex-review"
   deliberately NOT installed -- it would clobber the existing /codex-review gate skill.
5. Owner still owes: STEP 1 SQL results (kit), eco yes/no, qa-flip run, Type-B blanks.

## MAP PANEL REDESIGN (owner direction 2026-06-05, evening) -- SUPERSEDES #257
Owner clarified the panel roles + wants a ProUCL-equivalent stats engine:
- LEFT panel = "SELECTION STATS" = STATISTICS ONLY (no filters). REMOVE the medium selector AND
  the substance selector from the left panel (both are filters -> belong in the RIGHT panel which
  already has them). -> THIS SUPERSEDES PR #257 (which WIRED the left medium selector; the selector
  is being REMOVED instead). Close #257 when the redesign PR lands (don't merge it).
- LEFT panel shows stats for the filtered selection: min, max, mean, median, P90, 95% UCLM, n, etc.
  ProUCL-EQUIVALENT (owner's industry uses USEPA ProUCL). Wants: UCLM basis shown + options
  (Student's-t / Chebyshev / bootstrap / gamma / Land-H), distribution-fit tests, outlier tests,
  censored-data handling. Research workflow RUNNING (ProUCL methods + R EnvStats/Python libs +
  stack integration w/ Vercel constraint) -> MATRIX_MAP_STATS_ENGINE_DESIGN_2026_06_05.md.
- RIGHT panel = filters + table. UX: expand button -> near-full map container (thin edge so map
  barely visible, table fully readable); drag-extend -> much more range (cover most of map); also
  disable empty-data medium chips (water/tissue have no data -> shouldn't be selectable). LEFT panel
  also drag-to-extend. "Excellent UI/UX that looks nice."
- KEY ARCH CONSTRAINT (foreseen): if Python is local-only (like engine-v2 503s on cloud), the stats
  must be CLIENT-JS to work on the Vercel/hybrid demo path; Python "advanced stats" mode optional
  local-only add-on. Research will confirm.
- OPEN: UCLM default method (owner leaning ProUCL recommended-logic + bootstrap option); censored
  handling default; stat list confirm. NEEDS owner spec before building stats math.

## MAP LANE PROGRESS (owner P1-TOP, 2026-06-05) -- substantially COMPLETE
- Data: loaded toxicity 334 + community 175 (+ sediment 7472) via owner Edge paste; verified. 3 media live.
- Schema: bnrrm_toxicity_id (single uniq idx) + bnrrm_community_id (COMPOSITE uniq idx w/ substance_id) added; env_modifier excluded (it's sediment-characterization metadata).
- UI: right-panel medium filter ALREADY worked (built pre-stall). Left-panel selector was DECORATIVE
  (local state, drove nothing) -> WIRED to filterStore = PR #257 OPEN (true-green gates incl e2e
  138P/69S/0F casing=0; Opus Leg-1 GREEN). codex Leg-2 PENDING (app open + active review at push) ->
  DO NOT MERGE until codex GREEN; owner merges (UI behavior change). 2 UX notes in PR body for owner.
- TODO: codex Leg-2 #257 when guard clears; visual verification (app run + screenshot multi-media);
  path-2 rebuild lost v1.1.0 multimedium ETL as committed code (source SQLite confirmed); repo
  migration files for tonight's live changes (storage bucket+policies, map schema delta).

## SESSION CLOSEOUT (2026-06-05 evening) -- PLANNING DONE, EXECUTION MIGRATES TO FRESH SESSION
Owner directive: finish research+planning here, checkpoint, /update-docs, migrate execution to a
FRESH session that starts in PLAN MODE. NO code written for the stats/redesign feature this session.
DELIVERABLES THIS SESSION: MATRIX_MAP_STATS_ENGINE_DESIGN_2026_06_05.md (ProUCL-equivalent design +
4 locked decisions + scaling addendum) + FRESH_SESSION_PLAN_MATRIX_MAP_STATS_2026_06_05.md (the
plan-mode handoff w/ hard rules, current state, phased plan, key files, conflict discipline for 4
parallel sessions). DECISIONS LOCKED: (1) ProUCL recommended-logic default + all methods selectable;
(2) censored = runtime selector KM/ROS/DL2; (3) bit-for-bit ProUCL v5.2 parity + validation suite;
(4) local-only Python parity mode = future. ARCH: client-JS stats (Vercel can't run Python),
server-side filter-scoping for scale. NEXT: fresh session reads the handoff + design + codebase in
PLAN MODE -> plans Phase 0 (panel redesign) + Phase 1 (descriptive + Student's-t/Chebyshev) ->
ExitPlanMode for owner approval -> execute. FOLLOW-UPS OWED: repo migration files for the live
Supabase changes (bucket+policies, map schema delta); rebuild the lost v1.1.0 multimedium ETL.

## Iteration log (newest first; keep to one line each)
- 2026-06-05 it-close: map data loaded (3 media live via MCP+owner paste) + TWG storage fixed
  (bucket+5 policies) + #257 closed superseded (junction-safe worktree cleanup, store intact 722);
  ProUCL stats-engine RESEARCHED (client-JS, Vercel-gated) + design doc + 4 decisions locked +
  fresh-session plan-mode handoff written; conflict map clarified (4 sessions: engine-v2/DRA-KB/
  mine/idle). Execution migrates to fresh plan-mode session.

- 2026-06-05 it6: Lane D PR #255 OPEN (true-green gates incl e2e 138P-0F; owner merges) + Lane E
  PR #256 OPEN (true-green gates; Opus Leg-1 GREEN; codex Leg-2 at 10:23 -> AI-merge); kit rev5
  GREEN (document_tags Remedy H verified; matrix row-8 aligned) awaiting codex round-5 at 10:23;
  dead-code sweep workflow launched (report-only).
- 2026-06-05 it5: Lane F ROOT-CAUSED e2e env (junction target casing; fix verified 138P/69S/0F,
  no config change) -> D+E junctions repaired (store 722 intact); #254 CI ALL-GREEN incl E2E ->
  owner-confirmed merge -> MERGED 14:58Z; Lane G running Lane D full gates (true-green standard,
  no exceptions); junction-casing rule added to standing rails + memory.
- 2026-06-05 it4: kit r3 fixes GREEN (scenario-simulated verify; NOT NULL audit exact) -> codex r4
  RED 4 NEW (CEW RPCs, matrix_reviews no-DDL, 1h nullability, matrix-map data rows) -> r4 fix
  workflow RUNNING w/ dependency-matrix class-closer; #254 codex GREEN + CI watcher on; Lane D
  0819811 codex GREEN; Lane E 54b730d committed, codex INTERRUPTED (usage limit til 10:23, timer
  set); OWNER DECIDED hold-pushes-until-e2e-env-fixed -> Lane F root-cause investigation RUNNING.
- 2026-06-05 it3: kit Leg-2 r2 RED (4 new, all valid incl review_files live-contract drift) ->
  fixed + Opus-verified GREEN (rev2); manifest e2e RED x2 environmental -> owner approved
  CI-arbitrates exception -> PR #254 OPEN (5 gates GREEN + docs:gate); Lane D queries.ts fix
  implemented (tsc 0, 6/6 new tests); owner approved + executed e2e-residue cleanup (report server
  13276); codex queue (kit r3, #254, Lane D) HELD: app reopened + PARALLEL session mid codex-review
  (Drift Log lane) -- no stomping.
- 2026-06-05 it2 (fresh session, ultracode): 7-agent explore workflow -> full briefing; conflict
  scan SAFE (PR #253 engine-v2 lane HANDS-OFF); grill-me-codex installed (CLEAN, collision-safe);
  kit+report 6 RED fixes APPLIED + Opus adversarial verify GREEN r1; Lane A (manifest commit+gates+
  PR) and Lane C (3 HITL walkthroughs) running parallel; codex guard HOT (app-server x2) -> owner
  opted close-app-then-CLI; all merges held for codex-family GREEN.
- 2026-06-05 it1: manifest task FAILED -> root-caused (vitest emits ANSI under CI=true pipe; regex
  cannot bridge escapes) -> fixed update-manifest-facts.mjs with stripAnsi() on both extractors ->
  relaunched as b6mi4vze8. PR scope now = script fix + manifest refresh (both mechanical).
- 2026-06-05 it0: loop started; workplan authored; manifest task running; owner cards + codex
  desktop prompt delivered; awaiting owner STEP 1 SQL + codex verdict.
