# SSTAC Matrix Options -- Top-50 Progress Ledger (2026-07-13d)

Note it is generated from the two source docs (`MATRIX_OPTIONS_TOP50_PRIORITY_TASKS_2026_07_13.md` and `MATRIX_OPTIONS_LIVE_STATUS_2026_07_13.md`) plus the verified Phase-0 run facts, and that it supersedes the approximate counts in the LIVE_STATUS doc.

**Authoritative Phase-0 FACTS applied:**
- `origin/main` after the 2026-07-13d run = f3868ee.
- Live Supabase counts VERIFIED read-only 2026-07-13d: sample_events 4737 / measurements 19383 / samples 4494 / substances 340 / dras 574 (3 public / 571 private).

| # | Title | Status | Evidence | Next action | Owner-gated | AGY-safe | Value |
|---|---|---|---|---|---|---|---|
| 1 | Merge PR #620 | done | PR #620 / df7db68 | None | no | yes | high |
| 2 | Work from a fresh worktree off post-#620 origin/main | done | L0 1.15 | None | no | yes | high |
| 3 | D1 dioxin-TEQ promote `--apply` | done | PR #627 | None | yes | no | high |
| 4 | Expand DRA pilot: publish IOCO Shoreline | owner-gated | DRA/IOCO packet s1 | Owner execution via app | yes | no | high |
| 5 | Confirm cadmium + methylmercury current_default | owner-gated | consolidated sA item2 | Owner confirmation | yes | no | high |
| 6 | T31 undated-measurement STEP-2 apply | done | liveload_apply_closeout.md | None | yes | no | high |
| 7 | DRA publication expansion policy | owner-gated | completion-status item2 | Decide expansion tier/criteria | yes | no | high |
| 8 | D2 benzo_a_pyrene anchor + ADAF scenario ruling | owner-gated | consolidated sA item6 | Owner tox judgment | yes | no | high |
| 9 | D3 PCB Option A/B/C ruling | owner-gated | consolidated sA item5 | Owner policy | yes | no | high |
| 10 | 41 IRIS needs_review alternates | owner-gated | consolidated sA item3 | Per-group reject/retain ruling | yes | no | high |
| 11 | copper + sodium_ion Protocol-28 route-split disposition | owner-gated | consolidated sA item4 | Rule among options | yes | no | high |
| 12 | Reconcile catalog-count ambiguity | owner-gated | consolidated sA item8 | Owner clarify ambiguity | yes | no | high |
| 13 | 357 P28 verify-vs-primary sweep | owner-gated | consolidated sA item7 | Vision-first PDF sweep | yes | no | high |
| 14 | Audit 83 current_default rows for resolveTupleRecord gap | done | LIVE STATUS sec 3.16 | None | no | yes | high |
| 15 | Wire cumulative TEQ/BaP-eq scoring UI (A3b) | blocked | completion-status HITL item7 | Register computeTEQ/computeBaPeq | no | yes | high |
| 16 | Extend dl-PCB TEQ-TDI to full HHDirectContact integration | blocked | code: dlPcbTeqTdi | Wait for D3 to land | yes | no | high |
| 17 | Coordinate-extraction lane for 4 centroid-only DRAs | PR-open | PR #629 | Owner extraction RUN | yes | no | high |
| 18 | Surface surveyed-vs-centroid tier in exports/reporting | not-started | COORDINATE_PROVENANCE_QA_2026_07_11 | Code the export | no | yes | high |
| 19 | Evaluate extracted + other located DRAs for publish-readiness | blocked | DRA/IOCO packet s3 | Evaluate publish-readiness | yes | no | high |
| 20 | Add reviewer/admin role gate to /api/hitl-packets/* | done | PR #628 | None | yes | no | high |
| 21 | Re-verify + close non-CEW voter user_id granularity question | done | PR #628 | None | yes | no | high |
| 22 | Tighten RLS-bypass: dras_admin_all allows un-audited UPDATE | not-started | completion-status item5 | RLS hardening design | yes | no | high |
| 23 | Enable authenticated (member-tier) E2E | owner-gated | T40 admin-tier gate | Add GH secrets + var | yes | no | high |
| 24 | Admin-tier E2E fixture + specs | owner-gated | T40 readiness s3b | Create test user + storageState | yes | no | high |
| 25 | Inhalation VF/PEF model decision | owner-gated | inhalation packet | Await owner architecture decision | yes | no | med |
| 26 | Build inhalation calculator + UI post-decision | blocked | completion-status s3 | Wire deriveInhalationStandards | yes | no | med |
| 27 | Re-triage 07-01 HITL Groups 1-5 vs current catalog state | done | LIVE STATUS sec 3.18 | None | yes | no | med |
| 28 | Group 4: approve 'inorganic' ContaminantClass | owner-gated | HITL 07-01 Group4 | Approve inorganic class | yes | no | med |
| 29 | Group 3: wire ~90 substance/field gaps post Group-4 | in-progress | HITL 07-01 Group3 | Wire 90 substance gaps | yes | no | med |
| 30 | Group 1: 11 value corrections | owner-gated | HITL 07-01 Group1 | Apply value corrections | yes | no | med |
| 31 | Group 2: abs_dermal anomalies | owner-gated | HITL 07-01 Group2 | Revert-to-class-default vs confirm RAF | yes | no | med |
| 32 | Group 5: provenance/text HITL | owner-gated | HITL 07-01 Group5 | Complete truncated sources | yes | no | med |
| 33 | T39 calculator cross-check vs a PRIMARY worked example | owner-gated | completion-status s5 | Owner provides HC/EPA example | yes | no | med |
| 34 | T20 design ruling: exclude medium-tier from station UCL | owner-gated | MATRIX_MAP_STATUS item5 | Owner ruling | yes | no | med |
| 35 | SSD workbench: verify end-to-end against a known dataset | not-started | code: SSD under lib | Verify end-to-end | no | yes | med |
| 36 | Verify Export CSV/MD/HTML + export-memo against real data | not-started | NEXT_STEPS 07-09 | Verify against real data | no | yes | low |
| 37 | One real judgment save + one real "Ask AI" chat query | not-started | NEXT_STEPS 07-09 | Run eval | no | yes | low |
| 38 | Resolve pyramid-navigation status | not-started | PHASE1_PYRAMID doc | Resolve status | no | yes | low |
| 39 | Submission-search performance plan | not-started | CHAT_AND_SEARCH plan Phase B | Denormalize/FTS | no | yes | low |
| 40 | Remove deprecated /api/regulatory-review/run-engine route | not-started | NEXT_STEPS route-inventory | Remove route | no | yes | low |
| 41 | Refresh Agentic OS "Agents" tab placeholder copy | not-started | code: TerminalPanel.tsx | Refresh copy | no | yes | low |
| 42 | Worktree cleanup triage: ~50 worktrees | owner-gated | git worktree list | Owner review and prune | yes | no | low |
| 43 | Resolve primary-checkout dirty state | owner-gated | git status | Disposition of uncommitted edits | yes | no | low |
| 44 | Untracked root-scratch cleanup | owner-gated | git status | Move loose files out of root | yes | no | low |
| 45 | Re-verify Subscriptions "PR-2" scope | not-started | subscriptions handoff 05-16 | Confirm superseded | no | yes | low |
| 46 | Add unit test for MatrixMapStatsShell.tsx | not-started | code: matrix-options __tests__ gap | Add test | no | yes | low |
| 47 | Add direct unit tests for matrix-map ad-table.ts / ks-table.ts | not-started | code: matrix-map lib gap | Add tests | no | yes | low |
| 48 | Refresh docs-manifest live test-count fact | done | PR #625 | None | no | yes | low |
| 49 | Reconcile AGENTS.md Supabase Protocol vs stale CLAUDE.md | owner-gated | handoff s4 / CLAUDE.md L1 | Remove contradiction | yes | no | low |
| 50 | Stand up ONE living "MO completion status" doc | done | PR #631 | None | no | yes | low |

- done: 10
- PR-open: 1
- in-progress: 1
- owner-gated: 22
- blocked: 4
- not-started: 12

Also: AGY-safe-yes count: 17; owner-gated-yes count: 33; high-value count: 24.

## Token-Proportionality Judgment (Claude-owned)

**Is Claude/Opus token spend proportional to project progress? Partially -- and the
mix should shift.**

1. **Real progress is shipping.** 10/50 done + 4 merged PRs this run (#631/#628/#630/
   #632). Live data is loaded and VERIFIED (measurements 19383, sample_events 4737,
   dras 3 public / 571 private). Security gaps #20/#21 are closed. This is genuine,
   verifiable movement, not doc churn.

2. **The dominant blocker is OWNER DECISIONS, not engineering.** 22 items sit in
   `owner-gated` status and 33 carry an owner-gated flag. The entire catalog-arbitration
   cluster (#8-#13, #28-#32) is owner-ruling-blocked -- further Opus spend drafting or
   re-arbitrating those is low-yield until the owner rules. Prior sessions repeatedly
   burned Claude budget re-touching this cluster; that is the proportionality leak.

3. **A real, safe, high-USER-value backlog remains** -- contradicting the prior
   `NO_SAFE_WORK_REMAINS` claim (which was scoped only to MO catalog auto-shipping).
   AGY-safe, non-owner-gated, buildable now: #18 (map/export usefulness), #35/#36
   (SSD/export verify), #46/#47 (matrix-map stats-lib tests), #41 (copy), #38/#45
   (investigations), plus derived hitl-packets role-gate regression tests and the
   #629 harness advancement. ~11-13 engineering items, >10h of work.

4. **Reweight (this run's correction):** move Opus spend OFF owner-gated catalog
   micro-arbitration and ONTO the safe user-facing/test surface, executed AGY-first
   (AGY writes, orchestrator runs, bounded codex gates). Opus stays orchestration-only.
   Owner-gated items are surfaced as one-step-decidable, not re-drafted.

**Verdict:** progress is real; proportionality is restored by spending the remaining
budget on the safe engineering backlog above rather than on decisions only the owner
can make.

