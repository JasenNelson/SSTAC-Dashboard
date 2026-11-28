# RUN_STATE -- UI/UX audit remediation autonomous run (2026-08-16)

Supersedes the Matrix-Options run state preserved below. That section is PRIOR-RUN HISTORY and
is kept deliberately -- an earlier version of this commit left it as the only content of this
file, which would have made main's root state describe July while COMMAND_LOG described August.

## Status: COMPLETE. Six PRs open, none merged. The owner merges; this run merged nothing.

| PR | Branch | Base | CI | Contents |
|---|---|---|---|---|
| #782 | feat/section-b-wave0-20260815 | main | real | B14 44px ThemeToggle; B11 pre-paint theme bootstrap |
| #783 | feat/mo-batch2-20260816 | main | real | batch 2, five owner-decided items |
| #784 | feat/section-b-wavea-20260816 | #783 | NONE | Section B Wave A; owner decision D7 |
| #785 | feat/deferred-triage-20260816 | #784 | NONE | deferred triage; owner decision D8 |
| #786 | docs/ui-ux-autonomous-run-20260816 | main | real | this documentation |
| #787 | feat/theme-cookie-20260816 | #782 | NONE | owner decision D2, cookie-resolved theme |

Two independent stacks: #782 -> #787, and #783 -> #784 -> #785. MEASURED with
`git merge-tree --write-tree`: the two stacks share ZERO files, so they may merge in either
order; within each stack the order is strictly bottom-up.

## The load-bearing facts for whoever merges these

- **Merge method matters more than merge order.** On the MERGE-COMMIT path all 15 pairwise
  branch combinations are clean. On the SQUASH path, squashing #783 then merging #784 conflicts
  on page.test.tsx, and squashing #782 then merging #787 conflicts on SIX files. REBASE-MERGE
  was simulated separately and produces a byte-identical conflict to squash -- the hazard is
  history rewriting, not squash specifically.
- **#784, #785 and #787 have NO CI and are mergeable right now.** Branch protection guards main
  only, and `enforce_admins` is false, so the merge button is live and admin-bypassable on three
  PRs that have never run unit, build or e2e in CI.
- **Retargeting may not trigger CI by itself.** ci.yml declares no `types:` key, so default
  activity types apply (opened / synchronize / reopened). A base-branch change fires `edited`,
  which is NOT in that set. After retargeting, confirm with `gh pr checks` that the four required
  contexts actually ran; if they did not, push a rebase to fire `synchronize`.
- **required_status_checks.strict is false**, so a green PR is not re-tested against a moved
  main. Do not merge the next PR until the previous merge's push-CI on main is green.

## Not verified by this run

Nothing was measured in a real browser beyond Playwright assertions. jsdom implements neither
`@media print` nor WebKit pseudo-elements, so both headline changes in #785 are class-contract
only -- and the print change lives in ScrollFadeRegion, which reaches every calculator surface
through MathRenderer. No axe run. Contrast ratios were computed from Tailwind's documented hex
while v4 ships OKLCH.
---

## PRIOR RUN, PRESERVED BELOW (do not delete)

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
