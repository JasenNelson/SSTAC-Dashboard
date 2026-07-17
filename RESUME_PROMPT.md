# RESUME PROMPT -- Matrix-Options top-50 autonomous run

Continue Autonomous Multi-Hour. origin/main = c21ab08 (verify live). Do NOT micro-gate; phase
transitions are not stop points. If blocked by a true owner gate, move to the next independent safe
top-50 task rather than idling. Only stop for: exact prod/Supabase writes not pre-approved,
secrets/admin creds, owner-only UI publish flips, per-PR merge authorization, QP/site-data decisions
un-inferable from evidence, destructive/junction hazards, repeated gate failure after bounded retry.

## In-flight lane: PCB HH-default (HC 1.0e-5)
Branch feat/pcb-hh-default-2026-07-16 (prep fc1eff4). Owner ran the --apply + applied the coupled
patch. Working tree = 2 catalog JSON (human_health_trv_values, parameter_values) + 3 code files
(substanceLibrary, catalog.test, library.test) + 2 test-ripple fixes (defaultSelectionPolicy.test,
HHFoodWebCalculator.test). Finish: test:ci green -> monitored build -> e2e (or defer per rule) ->
/codex-review to GREEN -> commit exact paths (no git add .) -> push -> open PR -> monitor CI once.
Do NOT merge without explicit per-PR authorization.

## Next safe top-50 units after PCB HH-default PR is opened (pick independent, non-owner-gated)
- #22 cumulative TEQ/BaP-eq scoring UI (A3b): register computeTEQ/computeBaPeq in equationDispatch +
  build component. Now that D1 done + this HH-default lands; verify current state first.
- #23 dl-PCB TEQ full HHDirectContact integration -- GATED on D3 (#13) which is GATED on PCB #15
  site data (owner). Do NOT start without D3.
- Tier 8 HITL groups #32-36 (owner-gated values) / #37 T39 worked-example (owner provides) -- owner-gated.
- #26 read-back pattern (found comprehensive), #44 Agents tab (done), #50 (done).
- Hygiene: #45 worktree triage (owner+careful), #47 root-scratch cleanup (owner).
Most remaining top-50 are owner-gated; if all safe autonomous units are exhausted, checkpoint + hand
the owner packet.

## Owner packet (batched)
1. Merge PCB HH-default PR (after CI green).
2. PCB #15 EqP/logKow site data (Site 3130 IOCO: EPA 8082 Aroclor mix 1248/1254/1260, no site logKow;
   see .tmp/pcb15-evidence/PCB_15_SITE_EVIDENCE_PACKET_DRAFT.md) -> unblocks #13/#15/#23.
3. IOCO publish flip #7; T40 secrets #29; RLS migration #27.
