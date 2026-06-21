# Matrix Map Morning Ask -- 2026-05-21

Status: the Matrix Options Interactive Map lane is close to showing samples, but the current live blocker is SQL, not React. The BN-RRM-style map shell, 4 base layers, 14 WMS overlays, 9-state sample symbology code, and left/right panel scaffolds exist, but samples still fail behind the RPC coordinate cascade. I prepared both SQL paths for your morning decision: Option A is the cleaner longitude/latitude schema correction; Option B is the existing migration 08 fast unblock.

## Decisions

1. Decision A: choose SQL unblock path. Recommended: YES to Option A. Why: it stops runtime PostGIS cast iteration and gives future bbox/analytics ordinary numeric columns. Say YES to proceed; say NO to discuss Option B first.
2. Decision B: authorize the exploratory SQL first. Recommended: YES. Why: Supabase protocol is zero assumptions before schema/RPC work. Say YES to proceed; say NO to discuss.
3. Decision G: approve SQL-only gate text. Recommended: YES. Why: SQL-only PRs need a narrow signed gate; JS/TS PRs still require lint, unit, build, and e2e all GREEN. Say YES to proceed; say NO to discuss.
4. Decision C: R-13 methodology timing. Recommended: YES that computed UTL waits for R-13, while SQL, banner, identify, selection, raw workbench, admin, telemetry, and pending scaffold can proceed. Say YES to proceed; say NO to discuss.
5. Decision E: smallest demo scope. Recommended: YES to samples, banner, selection, pending-or-signed stats, and MeasurementWorkbench as minimum demo. Why: dots alone are not the tool you asked for. Say YES to proceed; say NO to discuss.
6. Decision D: token-budget split. Recommended: YES that Codex implements bounded packets, Claude reviews and mediates, owner runs Studio SQL. Why: Claude is near weekly limit and should not spend tokens on broad rereads. Say YES to proceed; say NO to discuss.
7. Decision F: owner mediation points. Recommended: YES to pauses before path choice, after exploration, before live SQL, at R-13, before bridge token freeze, and before SQL-only gate use. Say YES to proceed; say NO to discuss.
8. Decision H: `grants_used` in `bridge_audit`. Recommended: YES. Why: immutable grant snapshots protect token meaning after DRA/grant changes. Say YES to proceed; say NO to discuss.
9. Decision I: selected impacted triangle visual. Recommended: YES. Why: PLAN says selected state applies to any classification, and current triangle markers do not restyle yet. Say YES to proceed; say NO to discuss.

## Files To Open

- Completion plan: C:/Projects/SSTAC-Dashboard/.tmp_matrix_map_completion_plan_v0_1_2026_05_21.md
- Exploratory SQL, run first: C:/Projects/SSTAC-Dashboard/.tmp_matrix_map_explore_sql_2026_05_21.sql
- Option A migration draft, do not merge until chosen: C:/Projects/SSTAC-Dashboard/supabase/migrations/20260521000001_matrix_map_lng_lat_columns_OPTION_A_DRAFT.sql
- Option A backfill packet, run only after Option A migration applies: C:/Projects/SSTAC-Dashboard/.tmp_matrix_map_option_a_backfill_2026_05_21.sql

## What Claude/Codex Does After You Answer

If YES to Option A: owner runs the exploratory SQL and pastes output back; Codex reconciles the draft; Claude reviews; the draft is renamed to a real migration; gates run; owner pastes migration in Studio; owner runs the backfill packet; then PR-MAP-9 starts.

If NO to Option A and YES to Option B: owner runs the same exploratory SQL; Codex merges/reviews the existing migration 08 branch; owner pastes migration 08 in Studio; samples render is browser-smoked; Option A becomes follow-up hardening.

After sample unblock: PR-MAP-9 banner, PR-MAP-10 identify, PR-MAP-11 selection, PR-MAP-12 pending-or-signed stats, PR-MAP-13 MeasurementWorkbench, PR-MAP-14 Calculator bridge, PR-MAP-15 admin grants, PR-MAP-16 telemetry, PR-MAP-17 mobile fallback, PR-MAP-18 tests.

Estimated remaining work: 10 to 14 PRs depending on Option A/B and whether tests are bundled or final. Rough delta: 5,000 to 9,000 LOC including tests and SQL. Calendar estimate with Codex implementing and Claude reviewing: 6 to 10 focused days for demo scope, 10 to 18 focused days for full v1.
