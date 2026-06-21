# Matrix Map -- PR-MAP-4 + PR-MAP-5 fresh-session handoff (2026-05-21 evening)

State of main: commit `b98bfb3`. PR #157, #158, #159, #160, #161, #162 all merged. Path A ETL loaded (282 samples / 7472 measurements live). identifyStore + selectionStore both live with mount-time lifecycle resets. Mobile fallback banner live at <768px.

## Scope: PR-MAP-4 + PR-MAP-5

Two side-panel content workstreams per `docs/design/matrix-map/PLAN_V3_4_2.md` sections 3.5 + 3.6.

### PR-MAP-4 (left "Selection Stats" panel content, spec section 3.5)

Sub-pieces, separated by R-13 methodology-signoff dependency:

| Sub-piece | R-13 dep? | Spec | Notes |
|---|---|---|---|
| **PR-MAP-4a Selection summary line** | NO | `"47 selected (5 reference, 12 impacted, 30 unknown)"` | Quick win. Read selectedSampleIds + initialMapData; compute composition counts; render above the State A placeholder. ~30-60 min. |
| PR-MAP-4b Substance + Medium controls | NO | Substance pulled from SharedGlobalInputs; Medium radio (Sediment/Water/Tissue/Toxicity/Community; only-with-data enabled) | Wired to selection but data-check requires touching the new RPC from PR-MAP-5. |
| PR-MAP-4c Provincial Background stats | **YES** | n, mean, median, sd, min, max, p95, UTL 95/95, 90% UCL of UTL, censoring fraction; "screening-only -- not regulator-submission-grade" label | Blocked on R-13 methodology lock. Defer. |
| PR-MAP-4d Site-specific Background stats | **YES** | Same 10 stats | Defer with 4c. |
| PR-MAP-4e Unclassified-excluded note + override link | NO (link is placeholder) | `"30 selected stations have unclassified status and are EXCLUDED from UTL computation. Override their classification {here} to include."` | Link is a placeholder in v1; safe to ship. |
| PR-MAP-4f Methodology badge | **YES** | `"UTL via K-table (utlTable.ts); censoring via 1/2 DL (ROS in v1.x); see methodology appendix {link}"` | Tied to R-13 decision; defer. |
| PR-MAP-4g Calculator action buttons | partial | "Use Provincial/Site-specific Background in Calculator" | Button wiring is R-13-independent; on-click compute is R-13-dependent. Ship as disabled buttons in v1a; enable post-R-13. |
| PR-MAP-4h Admin-only CSV export | NO | "Export selection as CSV" | Straightforward export of selected sample IDs + properties. |

**Shippable in this autonomous session: 4a + 4e + 4h. Possibly 4b + 4g (disabled).**

### PR-MAP-5 (right "Measurement Workbench" panel content, spec section 3.6)

| Sub-piece | R-13 dep? | Spec | Notes |
|---|---|---|---|
| PR-MAP-5 RPC | NO | New `matrix_map.fetch_measurements_for_samples(p_sample_ids uuid[])` -- joins measurements + sample_events + substances + dras; admin-bypass mirroring fetch_samples RPC pattern | Build it. Apply via MCP. |
| PR-MAP-5 Table | NO | 10 columns: Sample / Date / Medium / Substance / Value / Unit / DL Flag / Censoring / Coord Quality / Source DRA | Hand-rolled (no table lib in project deps). |
| PR-MAP-5 Filter chips | NO | Medium / QA flag / Date range / Classification | Client-side filter against fetched rows. |
| PR-MAP-5 Pagination | NO | 100 rows/page | Client-side after fetch. |
| PR-MAP-5 Click row -> map | NO | Highlight sample + pan via existing selectSample store action | Reuse selectionStore.selectSample + existing panTo logic. |
| PR-MAP-5 Admin CSV export | NO | Same export pattern as 4h | Same. |

**PR-MAP-5 is FULLY shippable without R-13.** This is the bigger chunk: new RPC + new component + table + filters + pagination + tests.

## Recommended autonomous-session sequence (~2h budget)

1. **PR-MAP-4a** Selection summary line first (~45 min). Quick win + establishes the "MatrixMapLeftPanel reads from selectionStore" pattern.
2. **PR-MAP-5 RPC** -- author migration, read-only verify packet first (per `cross_project_supabase_protocol_explore_before_assume`), apply via MCP (~30-45 min including verify).
3. **PR-MAP-5 component** -- create `MatrixMapRightPanel.tsx` (extract from MatrixDashboard.tsx's inline scaffold; mirror PR-MAP-10 left-panel extraction). Table + columns + click-row-to-map (~45-60 min).
4. **PR-MAP-5 filters + pagination + CSV export** -- iterate (~30-45 min).
5. **PR-MAP-4h** Admin-only CSV export on left panel (~15-20 min).
6. **Codex iterate-to-GREEN** at each step + after each commit. Mutual-agreement methodology if codex flags anything.
7. **4 gates GREEN** before each push. Lint + unit (vitest run) + build (next build) + e2e (playwright chromium).

If time pressed, ship just PR-MAP-4a + PR-MAP-5 RPC + PR-MAP-5 table (no filters/pagination/CSV). That's already a major UX upgrade.

## Critical infrastructure already in place

- **selectionStore** at `src/stores/matrix-map/selectionStore.ts` (PR #160). Reads: `selectedSampleId`, `selectedSampleIds`. Lifecycle-reset on mount (so SPA-navigation-back-to-/matrix-options resets to empty -- DON'T break this).
- **identifyStore** at `src/stores/matrix-map/identifyStore.ts` (PR #159). Same lifecycle pattern (PR #161).
- **fetch_samples_with_hidden_summary RPC** (live; PR #157) returns `visible_samples[]` with classification + coord-quality + source_dra_id. The fetch-measurements RPC should mirror its admin-bypass + allowlist + SECURITY DEFINER pattern.
- **MatrixMapLeftPanel** at `src/components/matrix-options/MatrixMapLeftPanel.tsx` (PR #158/#159). Currently shows PR-MAP-4 + State A placeholders. Subscribe selectionStore here for PR-MAP-4a.
- **MatrixDashboard** at `src/components/MatrixDashboard.tsx`. The right-panel scaffold `MatrixMapRightPanelScaffold()` is INLINE around lines ~600-636. Extract to `MatrixMapRightPanel.tsx` per the PR-MAP-10 extraction pattern.
- **PartialVisibilityBanner** at `src/app/(dashboard)/matrix-map/PartialVisibilityBanner.tsx`. Reference for the banner-style component pattern.
- **IdentifiedFeaturesList** at `src/components/bn-rrm/map/IdentifiedFeaturesList.tsx`. Reference for the "presentational + accepts store data via props" pattern.

## Live DB facts (verified end of 2026-05-21)

- 282 samples (290 in DB; 8 orphans with source_dra_id IS NULL are dropped by RPC INNER JOIN -- expected).
- 7472 measurements across 1 medium (sediment).
- 302 sample_events.
- 157 substances.
- 19 dras (8 sample-bearing; 11 zero-sample document records).
- All DRAs `public=false`. Admin bypass via `fetch_samples_with_hidden_summary` returns all 282 visible to admin.
- 1 row in `service_role_audit` (the Path A load).
- 0 rows in `dra_visibility_audit` (no flip_dra_public calls yet).
- 0 rows in `private_data_grants`.

## Standing rules (REQUIRED reading at fresh-session start)

- `cross_project_supabase_protocol_explore_before_assume` (HIGH AUTHORITY) -- surface read-only verify packet FIRST before any new RPC / DDL.
- `cross_project_no_autofill_authorization_slots` (HIGH AUTHORITY) -- do NOT auto-merge PRs. Owner clicks merge. ALSO: do NOT apply migrations without explicit "apply" / "go" in current turn.
- `cross_project_codex_iterate_to_green_before_commit_plus_4_gates_before_push` (HIGH AUTHORITY) -- codex review iterate-to-GREEN before EVERY commit; 4 gates GREEN before EVERY push.
- `cross_project_push_protocol_all_gates_must_be_green` (HIGH AUTHORITY) -- ALL 4 gates GREEN. WAIVERED is NOT GREEN. NOT-RUN is NOT GREEN.
- `cross_project_never_delete_regression_tests_during_cleanup` (HIGH AUTHORITY) -- don't delete existing tests; if a test fails after a change, investigate the underlying breakage.
- `cross_project_use_venv_python_not_system_python` (HIGH AUTHORITY) -- venv at `.venv/Scripts/python.exe`.
- `cross_project_path_scope_at_commit` -- never `git add .` / `-A` / `-u`. Path-scoped staging.
- `cross_project_subagent_tool_unavailable_claims_need_verification` -- if an Explore subagent says "file X is the live implementation", VERIFY by reading the actual mount path. The MatrixMap.tsx Path-B fork bit me twice this session (PR #158 wiring bug + PR #161 lifecycle parity carry-over). Be extra suspicious about which map component is wired.
- Plain ASCII only. No em-dashes.

## Hard constraints carried forward

- Branch off main. Do NOT branch off another open PR branch.
- ASCII only in all output + commit messages + PR bodies.
- Per `feedback_smoke_test_before_splitting_branches`: smoke-test prior PR before branching new features.
- AI does NOT start dev server (per `cross_project_harness_background_processes_die_on_exit`); owner will browser-smoke when back.
- Do NOT touch existing tests during cleanup unless investigating root cause (per regression guard rule).
- Per `cross_project_quality_first_no_speed_shortcuts`: if a clean fix takes 2x as long as a band-aid, propose the clean fix.

## Token budget guidance

Cash overage on Claude tokens at handoff time. Fresh session should:
- Delegate heavy-context exploration to the Explore subagent (protects main session context).
- Delegate code review to **codex CLI** (`codex review --uncommitted` via heredoc-piped prompt). Prefer codex over Claude self-review. Iterate-to-GREEN with mutual-agreement methodology.
- Use Cursor as fallback only if codex CLI is offline (verified per L0 fallback ladder; correct invocation: `& 'agent.ps1' --print --mode ask --model gpt-5.3-codex-xhigh '<prompt>'` from PowerShell).
- Run 4 gates in parallel as background processes (`run_in_background: true`).
- For tests of new SQL RPC, prefer pgTAP-style assertions via mcp__supabase-project-scoped__execute_sql read-only verify.

## Open follow-up tasks (NOT this session's scope)

- **Task #17** Multi-medium ETL replay (when MeasurementWorkbench/Calculator need toxicity/community/env_modifier rows; superseded PR #142 will land as a fresh PR off post-#157 main).
- **Task #22** PR-MAP-17b read-only mobile summary view (needs owner direction on which fields to show / sort / pagination shape).
- **R-13 methodology sign-off** -- gates PR-MAP-4c / 4d / 4f / 4g-on-click; bring up at next owner sync.

## Browser-smoke checklist for fresh-session work

(Non-blocking; owner does after merge.)

- `/matrix-options` desktop: 282 markers + admin sees all (banner suppressed). Pan-click a marker -> popup + Sample Locations panel shows "1 selected" + left panel summary line shows composition counts.
- Click "All" in Sample Locations -> all 282 selected; composition counts match (15 reference / 99 impacted / 168 unknown -- per the health page in screenshot from earlier session). Right panel renders measurement rows for the selection; filter chips work; pagination shows N pages.
- Click a row in the right panel -> marker on map highlights and map pans to it.
- Click Clear -> selection clears; panels return to State A placeholders.
- Resize to <768px -> mobile banner replaces 3-column layout.

## Resume prompt for fresh session

Below is the literal text to paste into the new session.

```
Resume Matrix Map lane: PR-MAP-4 + PR-MAP-5 side-panel content. Read these files IN FULL before any action:

1. C:/Projects/sstac-dashboard/MATRIX_MAP_PR_MAP_4_5_HANDOFF_2026_05_21_EVENING.md (THIS handoff; canonical)
2. C:/Projects/sstac-dashboard/docs/design/matrix-map/PLAN_V3_4_2.md sections 3.5 + 3.6 (spec)
3. C:/Users/jasen/.claude/projects/C--Projects-Regulatory-Review/memory/cross_project_supabase_protocol_explore_before_assume.md
4. C:/Users/jasen/.claude/projects/C--Projects-Regulatory-Review/memory/cross_project_no_autofill_authorization_slots.md
5. C:/Users/jasen/.claude/projects/C--Projects-Regulatory-Review/memory/cross_project_codex_iterate_to_green_before_commit_plus_4_gates_before_push.md
6. C:/Users/jasen/.claude/projects/C--Projects-Regulatory-Review/memory/cross_project_subagent_tool_unavailable_claims_need_verification.md

State summary (post-2026-05-21 EOD):
- main at b98bfb3. PR #157, #158, #159, #160, #161, #162 all merged.
- Path A ETL loaded: 282 samples / 7472 measurements / 302 sample_events / 157 substances / 19 dras live in Supabase project qyrhsieynzfgyuqzznap.
- selectionStore + identifyStore both live with mount-time lifecycle resets.
- Mobile fallback banner live at <768px.
- All DRAs public=false; admin sees all via fetch_samples_with_hidden_summary RPC admin-bypass.

This session's goal:
1. PR-MAP-4a Selection summary line (left panel composition counts; quick win)
2. PR-MAP-5 RPC + table + filters + pagination + click-to-map + admin CSV export (right panel; full scope)
3. PR-MAP-4h Admin-only CSV export on left panel
4. Defer PR-MAP-4c/4d/4f/4g (R-13 methodology sign-off blocked)

Token budget: Claude tokens on overage. Heavily prefer codex CLI for review (heredoc-piped); use Explore subagent for codebase mapping; run 4 gates in parallel as background.

Hard constraints (carried):
- Do NOT auto-merge PRs (owner clicks merge)
- Per supabase-explore-before-assume: read-only verify packet FIRST before any new RPC
- Per no-autofill-authorization-slots: do NOT apply migrations without explicit "apply"
- Per push-protocol-all-gates-green: ALL 4 gates GREEN before push; no waivers
- Per never-delete-regression-tests: don't delete existing tests during cleanup
- Per subagent-tool-unavailable: VERIFY explore claims about live files; MatrixMap.tsx is the Path-B fork at src/app/(dashboard)/matrix-map/MatrixMap.tsx, NOT src/components/bn-rrm/map/SiteMap.tsx
- ASCII only

First action: read the handoff doc above, then propose a step-by-step execution plan back to the owner for confirmation BEFORE writing code. Owner is away ~2h; if you have explicit go-ahead in this prompt (you do), proceed autonomously through PR-MAP-4a + PR-MAP-5; pause for owner input on R-13-blocked sections.
```
