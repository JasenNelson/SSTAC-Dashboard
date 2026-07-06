# Fresh Session Handoff -- 2026-07-06b -- Continuation Checkpoint (budget-constrained close-out)

**Status:** 2 PRs merged, 1 PR open (unmerged, deliberate gate deviation flagged), 2 tasks with
code+tests complete but not yet gated/shipped. This session hit its token budget; the following is a
precise resume point for a fresh session.

---

## What shipped this session (in order)

1. **PR #518** (merged) -- HC TRV v4.0 catalog cross-check + reversed PR #513's chlorobenzene error.
   See `FRESH_SESSION_HANDOFF_2026_07_06_HC_V4_CROSSCHECK.md` (PR #519, merged) for full detail.
2. **PR #519** (merged) -- session handoff doc for #518.
3. **PR #520** (merged) -- chlorobenzene `current_default` flipped from EPA/IRIS (0.02) to HC v4.0
   (0.43), owner-approved after explicit confirmation.
4. **PR #521** (merged) -- CI one-line fix: `e2e-tests` job `needs: build` -> `needs: unit-tests`.
   Verified on the actual run: E2E and Production Build now start at the same instant (both right
   after Unit Tests), cutting ~4 min off the pipeline critical path (~26min -> ~22min).
5. **PR #522** (OPEN, NOT MERGED) -- closes zinc/manganese cross-check ambiguities from #518's report;
   correctly LEAVES methylmercury + vinyl_chloride's 2 rows AMBIGUOUS (2 codex rounds caught that
   "resolving" them via qualifier wording would silently paper over a real population/value tension --
   these rows are tagged `population_groups: ["screening child"]` but hold HC's less-protective
   adult/non-sensitive value, not the more-conservative sensitive/from-birth value; flagged in
   `review_notes` for owner decision, not resolved). Also fixes a real extractor bug (zinc/selenium's
   stacked age-bracket cells were all getting the same qualifier text instead of positional pairing).
   **Gate deviation (disclosed in the PR body and commit message):** only 2 of the usual codex rounds
   ran (both found real P2 issues, both fixed and verified) -- a 3rd confirmation round was skipped to
   conserve session token budget. **Recommend running one more `/codex-review` round on this PR before
   merging.** All other gates (lint, 5080 unit tests, build, 117 e2e) are green.

## What's built but NOT yet shipped (next session should finish these)

Both have their code changes AND passing local tests already in place, in existing worktrees. Neither
has had build/e2e/codex run on the FINAL content, and neither has a PR yet.

### Task A: Evidence-vs-substance CAS/name mismatch guard
**Worktree:** `C:/Projects/SSTAC-Dashboard-worktrees/cas-name-guard-2026-07-06` (branch
`feat/mo-cas-name-guard-2026-07-06`, cut from a slightly older main tip -- rebase or re-cut from
current main before shipping since #520/#521/#522 have since landed on main).

**What it does:** new "wrong-SUBSTANCE mode" guard in `scripts/matrix-options/audit-library-provenance.mjs`
(the divergence check added in PR #514 catches wrong-VALUE mode; this catches evidence text citing a
DIFFERENT substance than the row it's attached to -- the failure class the chlorobenzene 1,2-DCB theory
worried about, even though that specific theory turned out unfounded). Scoped to HC TRV v4.0 rows
(locator format `Table 1, <name>, Type=...`).

**Codex found and I fixed:** the original locator regex `[^,]+` stopped at the FIRST comma, silently
skipping 23 of 92 real HC locators whose substance name itself has a comma (e.g. "Dichlorobenzene,
1,2-", "Chromium, hexavalent"). Fixed with a non-greedy `.+?` capture; verified 92/92 locators now
match. 2 regression tests added pinning this fix.

**Status:** 15 unit tests added, all passing; 0 false positives on the live catalog (confirmed via a
synthetic mismatch fixture that the check correctly fires). Lint clean. Build + e2e were run once
(green) BEFORE the regex fix -- re-run build/e2e/lint/full-suite on the current content, then codex
review (2 rounds minimum per normal protocol), then ship as its own PR.

### Task B: Extend cross-source divergence guard to rfc/iur/eco pathways
**Worktree:** `C:/Projects/SSTAC-Dashboard-worktrees/divergence-extend-2026-07-06` (branch
`feat/mo-divergence-extend-2026-07-06`, cut from main AFTER #521 merged -- should not need rebasing
against #520/#521, but DOES need Task A's changes reconciled if Task A ships first, since both touch
`scripts/matrix-options/audit-library-provenance.mjs` in different, probably non-overlapping sections
(Task A adds a new check function block; Task B extends the existing divergence check's filter sets) --
check for merge conflicts, should be a clean auto-merge but verify.

**What it does:** the PR #514 divergence guard (>=10x value spread across approved sources) was scoped
to only `human-health-direct` pathway and `rfd_oral_mg_per_kg_bw_day`/`sf_oral_per_mg_per_kg_bw_per_day`
input keys. Extended to also cover `human-health-food` pathway, the two HH inhalation input keys
(`rfc_inhalation_mg_per_m3`, `unit_risk_inhalation_per_ug_m3`), and both eco pathways
(`eco-direct-eqp`, `eco-food-bsaf`) with their two input keys (`fcv_ug_per_L`, `trv_eco_mg_per_kg_bw_day`).

**Verified against the live catalog:** 8 total divergence findings now (up from 4) -- the original 4
(arsenic, TCE, dichloroethylene_1_1, xylenes) plus chlorobenzene (22x, EXPECTED now that both HC 0.43
and EPA 0.02 are both approved candidates, per #520) plus 3 new eco findings (toxaphene 195x, vanadium
12x, benzo_a_pyrene 3600x). These are all `severity: info` -- surfaced for HITL review, not a hard
failure; no action taken on them this session (out of scope, that's the guard doing its job).

**Status:** 5 new unit tests added (rfc, unit-risk, 2 eco pathways, 1 negative "out of scope input_key"
test), all 15 total tests in the file passing. Lint clean. Build + e2e NOT yet run on this worktree at
all -- run the full gate suite, codex review (2 rounds), then ship as its own PR.

## Recommended next-session order
1. `git fetch && git rebase origin/main` (or re-cut) both worktrees if origin/main has moved since
   `333f9cc` (PR #521's merge commit) -- confirm no conflicts from #522 if it's merged by then.
2. Ship Task A (CAS/name guard) first -- smaller, more isolated change.
3. Ship Task B (divergence extension) second -- rebase onto Task A's merge if needed.
4. Consider running the deferred 3rd codex round on PR #522 before merging it (see gate note above).
5. Owner-gated items still open (unrelated to tonight's work, from the original roadmap): benzo_a_pyrene,
   PCBs, phenylmercuric_acetate value decisions; broader current_default sweep for remaining multi-option
   substances; eco pathway completion.

## Worktree cleanup reminder
When Task A and Task B ship (merge), clean up their worktrees the SAME safe way used all session:
`fsutil reparsepoint delete "<worktree>\node_modules"` FIRST (verify shared `node_modules` count
unchanged after), THEN `git worktree remove`, THEN delete the remote+local branch. Do NOT
`Remove-Item -Recurse` on a worktree with the junction still in place -- it empties the shared store.

## Process/token-budget note for the fresh session
This session ran a very high number of codex review rounds (5 on PR #518 alone, 2 each on #520/#521,
2 on #522) because it was deliberately thorough on a data-correctness lane (TRV catalog values feeding
real risk-assessment calculators). That discipline paid off -- codex caught 2 genuinely real bugs (an
extractor letter-spacing bug, a report-regeneration bug) on #518, plus 3 population/value-tension
findings across #522's two passes that would otherwise have shipped as silently-resolved false
confidence. Keep that bar for Tasks A/B, but budget accordingly: expect each to take 2+ codex rounds.
