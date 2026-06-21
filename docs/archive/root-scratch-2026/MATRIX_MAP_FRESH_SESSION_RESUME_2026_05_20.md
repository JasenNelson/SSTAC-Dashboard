# Matrix Map Fresh Session Resume Prompt (2026-05-20 EOS)

**Paste this prompt at the start of the fresh session.** Owner's explicit ask is comprehensive understanding FIRST, plan SECOND, code LAST.

---

## Prompt to paste

> Resuming the SSTAC-Dashboard Matrix Map lane after 2026-05-20 owner-stopped checkpoint. Read these files IN FULL in order before anything else:
>
> 1. `~/.claude/projects/C--Projects-Regulatory-Review/memory/dashboard_matrix_map_session_handoff_2026_05_20_eos.md` (this lane's load-bearing handoff)
> 2. `~/.claude/projects/C--Projects-Regulatory-Review/memory/dashboard_matrix_map_pr_map_3_post_mortem_2026_05_20.md` (morning Path-B recovery context)
> 3. `~/.claude/projects/C--Projects-Regulatory-Review/memory/cross_project_fork_existing_over_design_new.md` (HIGH AUTHORITY)
> 4. `~/.claude/projects/C--Projects-Regulatory-Review/memory/cross_project_supabase_mcp_dead_skip_to_sql_editor.md` (HIGH AUTHORITY)
> 5. `~/.claude/projects/C--Projects-Regulatory-Review/memory/cross_project_supabase_protocol_explore_before_assume.md` (HIGH AUTHORITY)
>
> **DO NOT start writing code immediately.** Owner explicitly required this 4-phase flow:
>
> ### Phase 1 -- comprehensive understanding (NO code; subagents only)
>
> Spawn up to 3 parallel Explore subagents to research:
>
> - **Subagent A: design spec** -- read `C:/Projects/SSTAC-Dashboard/docs/design/matrix-map/PLAN_V3_4_2.md` sections 3 (UX architecture), 3.1-3.8, 4 (data architecture), 5 (methodology), 6 (stack), 7 (PR sequencing). Synthesize the full feature inventory + the spec for Selection Stats panel + MeasurementWorkbench panel + Calculator bridge + partial-visibility banner + admin features.
>
> - **Subagent B: code reality** -- read the BN-RRM reference (`src/components/bn-rrm/map/SiteMap.tsx` 1666 LOC; `src/app/(dashboard)/bn-rrm/BNRRMClient.tsx`) + the current matrix-map state (`src/components/MatrixDashboard.tsx`; `src/app/(dashboard)/matrix-map/MatrixMap.tsx`; `src/lib/matrix-map/fetch-samples-server.ts`; `src/app/(dashboard)/matrix-options/page.tsx`). Document: what's shipped, what's scaffolded with placeholders, what's missing entirely.
>
> - **Subagent C: SQL state** -- read all `supabase/migrations/2026051*` + `2026052*` matrix_map migrations chronologically. Document: what's deployed to live DB (migrations 01-06 applied per handoff), what's merged but not applied (07), what's drafted but not merged (08). Document the constraint cascade (matrix_map_owner cannot reference extensions schema types; ST_X/ST_Y geography missing; ST_AsText is the proposed path). Propose alternative paths (schema change to add lng/lat columns; ETL rewrite to populate them; etc.) for fresh evaluation.
>
> After subagents return, synthesize all three into a `.tmp_matrix_map_comprehensive_understanding_2026_05_2X.md` doc. Surface to owner for review + alignment.
>
> ### Phase 2 -- holistic codex strategic checkpoint
>
> Run a HOLISTIC codex review (xhigh reasoning; codex CLI not MCP; cross_project_codex_review_targeted_vs_holistic_2026_05_13) on the understanding doc:
>
> - Strategic: does this understanding actually capture the END GOAL owner has described (over 2+ prior sessions including 2026-05-19 + 2026-05-20)?
> - Gaps: any features owner mentioned that subagents missed?
> - Constraints: are the SQL constraints empirically correct or are there untried paths?
> - Architectural: is the BN-RRM fork still the right pattern, or have requirements drifted past it?
>
> Apply mutual-agreement methodology (cross_project_codex_review_mutual_agreement_methodology_2026_05_16). Document the round + verdict in the understanding doc. Iterate if needed until owner + codex + Claude all agree the understanding is complete.
>
> ### Phase 3 -- plan draft + multi-round codex
>
> Author detailed plan as `.tmp_matrix_map_completion_plan_v0_1_2026_05_2X.md`. Plan must:
>
> - Sequence the remaining PRs (fix samples-rendering; Selection Stats content; MeasurementWorkbench content; Calculator bridge; partial-visibility banner; admin features). Be explicit about which PR blocks which.
> - Honor the empirical SQL constraints (don't propose more `::geometry` casts; consider schema changes if needed).
> - PR-sized commits (each PR < 500 LOC where possible; large refactors split into scaffold + content like PR-MAP-4 did).
> - Mitigation for each known blocker (turbopack cache, MCP failure, USAGE on extensions).
> - Co-development checkpoints (where owner reviews + signs off mid-plan).
>
> Run TARGETED codex per section (medium effort). Then HOLISTIC strategic codex on full plan (xhigh effort). Iterate to owner + codex agreement.
>
> ### Phase 4 -- execute
>
> Once plan signed off, execute PR by PR with standard per-commit codex iterate-to-GREEN + 4-gate cadence. Stop for owner check-ins at lane boundaries. Holistic codex at each lane completion.
>
> ## Hard constraints (carry forward from this lane)
>
> - **NEVER run `npm run build` while a dev server is alive** -- the build's `.next` artifacts contaminate turbopack's dev cache and force a dev-server restart. For SQL-only migrations, skip the build gate explicitly + document as `WAIVERED: build-skip-to-avoid-turbopack-cache-corruption`. For TS/JSX changes, kill the dev server before running build.
> - **NEVER attempt Supabase MCP `apply_migration` / `execute_sql`** -- fails 100% in owner's setup. Author SQL + push to PR; owner pastes into Studio + reports output back. See [[cross_project_supabase_mcp_dead_skip_to_sql_editor]].
> - **Codex-iterate-to-GREEN before EVERY commit.** Argument-back methodology (mutual agreement) -- don't silently accept codex findings you disagree with.
> - **Path-scoped staging only.** Never `git add .` / `-A`.
> - **Never auto-merge.** Owner clicks the merge button (or says "merge" explicitly).
> - **ASCII only** in all docs / commits / comments. No em-dashes / smart quotes / Unicode arrows.

---

## Status snapshot at handoff

| | |
|---|---|
| Main HEAD | `2a10806` (Merge PR #152 panel scaffold) |
| Total PRs merged this session | 10 (#143-#152) |
| Local checkout | `main` clean |
| Unmerged branch | `fix/matrix-map-rpc-stastext-wkt-parse` -- migration 08 draft (codex GREEN, gates NOT run, NOT applied to live DB) |
| Dev server | `b4dq2t13j` background, `localhost:3004` (safe to leave; safe to kill) |

## What's visible at `localhost:3004/matrix-options` Interactive Map tab right now

- Map embedded in tab with matrix-options top tabs visible (Guide / Conceptual Model / Jurisdictional Frameworks / **Interactive Map** / TWG Review / Calculator)
- 3-column layout: left placeholder panel (Selection Stats scaffold) | map | right placeholder panel (MeasurementWorkbench scaffold)
- Dark-mode header readable
- All BN-RRM SiteMap floating widgets (zoom / layer switcher / 5 interaction modes / 14 BC WMS overlays / classification legend / coord-quality legend / image export)
- Panel-toggle buttons in dashboard sub-header (collapse panels to 0px)
- "Samples data temporarily unavailable" notice STILL showing (RPC errors; samples don't render)

## What's needed to ship the complete vision

Per PLAN_V3_4_2 + this session:

1. **Samples render** -- fix the RPC. Migration 08 (ST_AsText) is drafted; OR consider schema change (add lng/lat columns).
2. **Selection Stats content** -- populate left panel per PLAN sec 3.5 (composition, Provincial / Site-specific Background stats with UTL 95/95 + censoring, methodology badge, Calculator action buttons, admin CSV export).
3. **MeasurementWorkbench content** -- populate right panel per PLAN sec 3.6 (tabular view with filter chips + pagination + click-to-zoom).
4. **Calculator bridge** -- per PLAN sec 3.7 (audit token + bridge_audit table + Calculator-tab integration).
5. **Partial-visibility banner** -- re-implement per PR-MAP-3c design (uses RPC's hidden_sample_count + hidden_dra_count + hidden_dra_ids fields).
6. **Admin features** -- per PR-MAP-7 design (admin grants UI for matrix_admin to manage private_data_grants).
7. **Cost-control telemetry** -- `/admin/matrix-map/budget` page + daily caps enforcement.
