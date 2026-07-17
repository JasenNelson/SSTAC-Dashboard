# RUN_STATE -- Matrix-Options top-50 autonomous run (updated 2026-07-16/17)

Mode: Autonomous Multi-Hour. Phase transitions are NOT stop points. Only stop for true owner gates
(exact prod/Supabase writes not pre-approved; secrets/admin creds; owner-only UI publish flips; merge
authorization; QP/site-data decisions un-inferable from evidence; destructive/junction hazards;
repeated gate failure after bounded retry). If blocked by an owner gate, move to the next independent
safe top-50 task rather than idling.

## Baseline
- origin/main = c21ab08 (copper #18 + IRIS #17 disposals live; PRs #666/#667/#668 merged).

## Lanes
- COPPER #18: DONE + merged (#666 prep, #667 apply; merge 2f85b65).
- IRIS #17: DONE + merged (#668 apply; merge c21ab08). PFDA 2e-9 verified correct vs live IRIS.
- PCB #15 EqP/logKow: BLOCKED (owner site-data gate). Evidence scout packet done:
  .tmp/pcb15-evidence/PCB_15_SITE_EVIDENCE_PACKET_DRAFT.md (Site 3130 IOCO, EPA 8082 Aroclor data,
  mixed 1248/1254/1260, NO site logKow -> REQUEST MORE DATA).
- PCB HH-default (HC 1.0e-5): IN PROGRESS. Owner ran --apply + applied coupled patch. Branch
  feat/pcb-hh-default-2026-07-16 (prep commit fc1eff4). Diff verified correct; 2 coupled test ripples
  (defaultSelectionPolicy.test + HHFoodWebCalculator.test) being fixed to green. Then build/e2e/codex/
  commit/push/PR. Do NOT merge without explicit per-PR authorization.

## Current head / branch / blocker / next command
- Branch feat/pcb-hh-default-2026-07-16 @ fc1eff4 + uncommitted apply (2 catalog JSON + 3 code files
  + 2 test-ripple fixes).
- Last gate: lint 0-err, tsc 0; test:ci was 2-failed (coupled ripple) -> fixing to green.
- Next after green: monitored build -> test:e2e (or defer per rule) -> /codex-review to GREEN ->
  commit exact paths -> push -> open PR -> monitor CI once.

## Owner gates remaining
- PCB HH-default PR merge (after CI green) -- explicit per-PR authorization.
- PCB #15 EqP/logKow site data (blocks D3 re-key #13/#15 + #23 dl-PCB TEQ full).
- IOCO publish flip #7; T40 admin user + E2E_ADMIN_* secrets #29; RLS hardening migration #27.
