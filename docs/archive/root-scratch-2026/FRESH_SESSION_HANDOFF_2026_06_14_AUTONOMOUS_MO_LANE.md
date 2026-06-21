# Fresh-session handoff -- Autonomous MO lane (15h, codex-hardened) -- 2026-06-14

Plain ASCII. Read `CLAUDE.md` (L1) + `docs/GATE_MODE_SOP.md` first. Owner AWAY; reachable only for rare
quick remote approvals (prefer zero). Protocol-gated auto-merge GRANTED (merge when commit-protocol +
push-protocol + CI-SUCCESS all complete; no per-PR human approval).

## START HERE
1. Read the codex-hardened PLAYBOOK (authoritative): `~/.claude/plans/autonomous-mo-15h-2026-06-14.md`.
2. Read the live RUN LOG (resume from its top `RESUME:` line): `~/.claude/plans/autonomous-mo-15h-RUNLOG.md`.
3. Follow the per-PR ship protocol + token-survival discipline in the playbook. Update the run log
   transactionally (BEFORE+AFTER each irreversible phase). Stop-when-dry; closeout when the manifest
   is terminal.

## Immediate in-flight item (M0)
PR #317 (ACFN community-specific food-web receptor) is PUSHED + PR'd (head `c0abef6`), all 6 local
gates + Opus + codex (5.5-xhigh) GREEN, CI running, NOT yet merged.
- When `gh pr view 317 --json mergeStateStatus` == `CLEAN`:
  `gh pr merge 317 --squash --match-head-commit c0abef6ca2465ae57de45544388d10efd8236ee5`
- THEN junction-safe cleanup of `C:\Projects\SSTAC-Dashboard-worktrees\acfn-foodweb-2026-06-14`
  (cmd /c rmdir the node_modules junction FIRST, verify shared store ~722 dirs, THEN git worktree
  remove + prune). If `rmdir` errors "not empty" / junction persists -> STOP that cleanup + log.
- THEN start M1 (gated on #317 being on main).

## What this session (2026-06-14) shipped + produced
- PR #317 built end-to-end: ACFN 388 g/day food-web receptor; new per-seed `FrameDefaultSeed.sourceIds`
  (first mixed-source frame-default row: IR=WQCIU, BW=shared BC 70.7 via WLRS); new canonical source
  `src-acfn-wqciu-2023` (tier_3, honest non-government) + value `pv-acfn-wqciu-2023-ir-food-community-specific`
  (general jurisdiction, own __general slot); promote-acfn-foodweb.mjs (34-case test incl. a
  nested-source provenance guard); 388 verified against the WQCIU primary (acfn.com, Eq 3.2 p.154,
  Figure 3.2 p.206). Owner-attested promotion. vitest_test_count 3758 -> 3848.
- The codex-hardened autonomous PLAYBOOK + this handoff + the run log. codex challenge (gpt-5.5 xhigh)
  returned RED on v1 with 18 findings; ALL folded into the v2 playbook (merge-authority precision,
  airtight no-self-promote, transactional run-log, junction-cleanup abort-on-failure, finite manifest,
  multi-point budget gates, strict verdict parsing, token-survival files-as-bus, park-to-HITL).

## The work queue (full detail in the playbook manifest M1-M6)
M1 single-value promote-script nested-source-guard backport (approval-free); M2 hc-pqra multi-value
backport (verify shape); M3 LESSONS + manifest closeout; M4 1 bounded coverage PR (conditional);
M5/M6 TWN + HC-2017 receptors = PREP-ONLY -> draft PR + `AUTONOMOUS_APPROVAL_QUEUE_2026_06_14.md`
(promotion is owner-attested only; NEVER run `promote-*.mjs --apply` unattended).

## Non-negotiables (codex-hardened)
- NEVER run `promote-*.mjs --apply` unattended (ABSOLUTE). Dry-run + queue only.
- Merge ONLY at `mergeStateStatus == CLEAN` + head-pinned `--match-head-commit`; never `--admin`;
  repo auto-merge is disabled.
- Junction-safe worktree cleanup: rmdir junction FIRST, verify, abort on any failure.
- Token survival: subagents return <=10 lines + write detail to FILES; slice-read (grep VERDICT);
  resume pointer at run-log top; stop cleanly when budget < ~60k.
- <=3 concurrent subagents; path-scoped staging; ASCII-only; verify any blocker before designing around it.
