# Fresh-session handoff -- SSTAC-Dashboard, 2026-06-09 (morning)

Plain ASCII. Single anchor for the next session. Supersedes
FRESH_SESSION_HANDOFF_2026_06_08.md. Role: Claude = thin ORCHESTRATOR;
codex = reviewer; owner merges.

## 1. FOUR PRs shipped 2026-06-08 night -- ALL awaiting owner merge (CI runs on each)

Base for all four = main tip 5910ce3 (after #274). Each is independent; merge order
below avoids surprises. All have codex GREEN + local gates; confirm GitHub CI green
before merging.

| PR | Branch | What | Gates |
|----|--------|------|-------|
| #275 | ci/build-runtime-node22-2026-06-08 | CI: build + performance-analysis jobs Node 24 -> 22 (Vercel deploy-runtime parity) | codex GREEN (5.4-mini + 5.5-xhigh); PR CI is the authoritative gate for a workflow change |
| #276 | chore/manifest-vitest-3340-2026-06-08 | docs-manifest vitest_test_count 3291 -> 3340 (+ facts_history entry for the superseded value) | codex 5.5-xhigh GREEN; docs:gate PASS; backed by test:ci 3340 passed |
| #277 | feat/frame-variant-override-injection-2026-06-08 | Frame-variant override-injection INFRASTRUCTURE (FRAME_VARIANTS stays empty, behaviorally neutral) | codex GREEN (mutual agreement); lint + test:ci(220 files) + monitored build + e2e(89) + tsc all GREEN |
| #278 | test/matrix-options-coverage-2026-06-08 | Tests: source-sync.ts server actions 12% -> 100% coverage (additions-only) | codex 5.5-xhigh GREEN; lint + test:ci(220) + tsc GREEN |

### Suggested merge order
#275 (CI) and #276 (docs) first -- trivial, independent. Then #278 (test-only).
Then #277 (the substantive feature). No conflicts expected (disjoint files); each
will need a rebase/merge only if you merge another first (GitHub will say so).

### Per-PR notes
- #275: only the two jobs that run `npm run build` changed to 22. Unit stays 24
  (vitest maxWorkers=1 OOM fix), e2e stays 20 (Playwright-container constraint).
- #277: FRAME_VARIANTS is still `[]` -- ZERO production behavior change. It only
  lands the injection MECHANISM + API. codex caught + I folded 2 P2 + 1 P3, and a
  3rd P2 (calculator wiring) was argued down to a non-blocking follow-up by mutual
  agreement: the empty table + the new "override row must be non-baseline variant"
  guard make the raw-vs-overridden inconsistency unreachable until the first real
  variant ships. The first-variant PR's calculator-wiring step is now documented in
  frameVariants.ts header + PHASE_4_FRAMEVARIANTS_SHAPE_SPEC.md section 8.

## 2. Owner-gated (NOT autonomous) -- carried from the 2026-06-08 handoff
- Visual checks of now-live UI (Phase 2 collapsible; Download(PDF) print-wrap; table styling).
- Options Paper 9.4 governance: confirm internal body names (marked "(Owner to confirm...)").
- Real FRAME_VARIANTS variant data (needs HITL parameter values + verified catalog_sources UUIDs).
- Any qa_status promotion / default-policy / catalog mutation.

## 3. Cleanup (after merges, junction-safe per L0 1.15)
Four worktrees were created this session (each has a node_modules JUNCTION to the
shared store -- DO NOT recursive-delete through the junction):
`SSTAC-Dashboard-worktrees\{ci-node22,manifest-vitest,frame-injection,mo-coverage}-2026-06-08`.
Cleanup each: `fsutil reparsepoint delete "<wt>\node_modules"` (or `cmd /c rmdir`),
VERIFY the junction is gone AND the shared store dir count is unchanged, THEN
`git worktree remove <wt>` + `git worktree prune`. (Plus ~15 older stale worktrees
predating this session.)

## 4. Process note
At session end ~6 node + ~4 python alive, StartTimes 10:27 AM-6:05 PM (predate this
session's work -> persistent codex app-server children / parallel sessions / dev
server, not my orphans). Not auto-killed. `cleanup-orphans.ps1 -Force` if desired
after confirming no parallel session needs them.

## 5. Lessons this session
- codex grind tier: Spark is EXHAUSTED (weekly limit, resets Jun 12) -> grind fell
  back to gpt-5.4-mini (draws the healthy general pool), as the L0 1.3 banner prescribes.
- Manifest live-fact updates: a superseded value must move to facts_history per the
  manifest's own facts_policy.live_vs_history_rule. The sanctioned updater script
  (update-manifest-facts.mjs) does NOT do this -- it overwrites in place -- so a manual
  facts_history entry is required (codex caught this on #276).
- EvidenceLibrary render test crosses the 15s LOCAL vitest timeout under full-suite
  CPU contention (passes isolated + under the 60s CI timeout); not a regression.
  Use test:ci (CI=true, 60s) as the unit gate, never a bare `vitest run`.

## 6. Pointers
- AGY orchestration: AGY_ORCHESTRATION_HANDOFF_2026_06_06.md.
- Ship gates authority: docs/GATE_MODE_SOP.md; L0/L1 CLAUDE.md.
- Memory: agy_antigravity_cli_usage.md, feedback_codex_review_process_discipline_2026_06_08,
  dashboard_4pr_lane_2026_06_08.md.
