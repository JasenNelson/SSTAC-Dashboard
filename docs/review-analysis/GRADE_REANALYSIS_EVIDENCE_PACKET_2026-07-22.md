# current_grade re-analysis -- EVIDENCE PACKET (2026-07-22)

Status: EVIDENCE/DESIGN PACKET ONLY (Top-50 row 12, owner ruling 2026-07-22: "prepare the fresh
7-category grade re-analysis as an evidence/design packet only; do not fabricate a new grade or
rewrite curated facts"). This packet computes the inputs, determines the drift, and proposes the
EXACT manifest edit for owner sanction. It mutates NOTHING: `docs/_meta/docs-manifest.json` is
untouched by this PR.

Methodology authority: `docs/review-analysis/HOW_TO_CONDUCT_GRADE_ANALYSIS.md` (7 weighted
categories; metric commands; grade scale). VERDICT ON SUFFICIENCY: the methodology IS sufficient
for a fresh re-analysis -- every structural metric it names was reproducibly re-computed below with
a stdlib census script plus this run's full local gate-suite logs. No blocker packet is needed.

## 1. Where the drift stands

The manifest's `current_grade` is the 2026-07-18 A- (89%) snapshot pinned to `origin/main 73203c5`,
status `stale_unreconciled`, with a `staleness_note` (flagged 2026-07-22) demanding a fresh
7-category pass before the grade is treated as current. Since that pin, main has advanced through
the 2026-07-20/21 lanes and the 2026-07-22 KB + continuation lanes (#706-#742).

## 2. Computed inputs (2026-07-22, tip 362e402a*)

*census executed at 70f4bc74 = 362e402a + one docs-only banner commit (zero effect on code
metrics); test/gate counts from this run's full local six-gate suites (logs in the run worktrees'
`.tmp/gate-logs/`).

| Metric | 2026-07-18 snapshot (pinned 73203c5) | 2026-07-22 (this packet) | Delta |
|---|---|---|---|
| Source ts/tsx files (non-test) | 616 | 622 (524 .ts + 392 .tsx = 916 total, minus 294 test files) | +6 |
| Unit-test files | 286 | 294 | +8 |
| E2E spec files | 13 | 14 | +1 |
| Vitest tests | 5635 passing (fact later refreshed to 5821, 2026-07-20) | **5926 passed / 17 skipped / 2 todo (5945 total)** | +291 vs the 2026-07-18 snapshot; +105 vs the current 5821 manifest fact |
| Playwright (local run) | 228 (fact, 2026-07-18) | 132 passed / 102 skipped locally (local env skips authed tiers; CI runs the full matrix -- see Limitations) | see note |
| k6 | 6 (fact `k6_script_count`, last verified 2026-04-20) | 23 `k6-*.js` FILES under `tests/` (recursive census) | counting-method mismatch -- FLAG, see section 5 |
| `: any` annotations in src/ | 51 | **29** (+ 89 `eslint-disable...no-explicit-any` suppressions, counted separately) | -22 (burn-down PRs #725 etc.) |
| ESLint | warnings-only | **0 errors / 40 warnings** (fresh lint gate) | consistent |
| tsc errors | 0 | **0** (fresh tsc gate) | unchanged |
| Files > 500 lines | 137 | **137** (top: substanceLibrary.ts 7634; EvidenceLibrary.tsx 4552; SsdWorkbench.tsx 2216; MatrixMap.tsx 1943) | unchanged |
| console.* sites | 443 | 445 | +2 |
| Gate suites | all 8 CI jobs green on 73203c5 | lint/tsc/test:ci/build/e2e/docs:gate ALL PASS locally x4 suites today (tips 8bfe7d06, 84e7a125, 28da1753, 70f4bc74 among others); PR-branch CI green on every 2026-07-22 PR through #743 at packet-writing time (e.g. 13/13 on #735/#736, 10/10 on #740) | consistent |

## 3. Category-by-category assessment against the 2026-07-18 calculation_basis

Every structural driver of the 2026-07-18 category scores is UNCHANGED or IMPROVED:

- documentation_and_setup (92%): docs:gate + INDEX + manifest discipline unchanged; substantial new
  dated design/evidence docs landed (KB lane, Top-50 reconciliation). No degradation.
- database_schema (90%): no schema change since the pin (this run verified live, read-only, that
  the dras privilege/trigger/RPC hardening stands). Unchanged.
- frontend_architecture (85%): god-component set unchanged (137 files > 500; same top offenders).
  Unchanged.
- api_architecture (88%): no API-architecture change of note; engine-v2 import-path fix (#740
  pending) is a correctness fix, not architectural. Unchanged.
- testing_and_qa (95%): vitest 5635 -> 5926 passing, e2e specs 13 -> 14, python tooling suite
  48 -> 57 (outside the rubric's counts but supportive). Improved-or-flat at the ceiling already
  scored.
- code_quality (86%): `: any` 51 -> 29 (the snapshot's own dock rationale shrank); 0 tsc errors;
  0 lint errors / 40 warnings; console.* 445 (~flat); god-file debt unchanged. Improved-or-flat.
- architecture_patterns (88%): unchanged.

**Arithmetic under UNCHANGED category scores: 89.35% -> A- (89%), identical to the 2026-07-18
snapshot.** The inputs moved flat-to-favorable, so A- (89%) remains a defensible floor; any
UPGRADE of category scores (e.g. code_quality for the any-burn-down) is a scoring judgment this
packet deliberately does NOT make -- that is the owner-sanction step.

## 4. Proposed EXACT manifest edit (owner-sanctioned; NOT applied by this PR)

On owner approval (merge of a follow-up PR making exactly this edit, or owner edit):
in `docs/_meta/docs-manifest.json` `facts.grades.current_grade`, set EXACTLY:
- `status`: `"verified"`
- `value`: `"A- (89%)"` (unchanged)
- `source`: `"Re-analysis 2026-07-22 (resolves the 2026-07-22 stale_unreconciled flag) using the
  7-category weighted rubric in docs/review-analysis/HOW_TO_CONDUCT_GRADE_ANALYSIS.md. Metrics
  gathered against origin/main 362e402a with four full local six-gate suites green that day and
  green GitHub CI on every 2026-07-22 PR branch through #743 at packet-writing time (later same-day PRs #744/#745 must be re-verified green before this text is sanctioned). Structural metrics: 622 source ts/tsx
  + 294 unit-test files + 14 e2e specs; vitest 5926 passed / 17 skipped / 2 todo; 29 ': any'
  annotations (down from 51; plus 89 no-explicit-any suppressions counted separately); 0 tsc
  errors; 0 lint errors / 40 warnings; 137 files over 500 lines (unchanged); 445 console.* sites.
  Category scores carried over UNCHANGED from the 2026-07-18 analysis per
  docs/review-analysis/GRADE_REANALYSIS_EVIDENCE_PACKET_2026-07-22.md section 3 (all drivers
  flat-or-improved). Owner-sanctioned on merge."`
- `calculation_basis`: keep all seven category percentage strings VERBATIM from the current fact;
  within them replace only these embedded numbers: `616 source ts/tsx` -> `622 source ts/tsx`,
  `286 unit-test files` -> `294 unit-test files`, `13 e2e specs` -> `14 e2e specs`,
  `vitest 5635` -> `vitest 5926`, `51 ': any'` -> `29 ': any'`. (`137 files over 500 lines` and
  the category percentages themselves are unchanged.)
- `weighted_average`: `"89.35% -> A- (89%)"` (unchanged)
- `reanalysis_ref`: `"2026-07-22 grade re-analysis; evidence packet
  docs/review-analysis/GRADE_REANALYSIS_EVIDENCE_PACKET_2026-07-22.md; ref origin/main 362e402a"`
- `last_verified`: `"2026-07-22"`
- `staleness_note`: `"The A- (89%) snapshot and all calculation_basis structural metrics are
  PINNED to origin/main 362e402a (2026-07-22). Do NOT cite these structural metrics as current
  once the tip has materially advanced; a fresh 7-category re-analysis (HOW_TO_CONDUCT_GRADE_
  ANALYSIS.md, against the then-current tip + a green CI run) is due before the grade is treated
  as current again."`
If the owner prefers to RE-SCORE any category in light of section 3, that supersedes the
keep-scores-unchanged default above; the packet takes no position beyond flagging code_quality as
the only category whose drivers moved enough to plausibly warrant a bump.

## 5. Separate fact-drift flag (NOT part of the grade edit)

`facts.testing.k6_script_count` = 6 (last verified 2026-04-20) vs 23 `k6-*.js` files found under
`tests/` by this packet's recursive census. These are DIFFERENT counting methods, and the fact is
NOT stale under its own method: the updater (`scripts/verify/update-manifest-facts.mjs`
`extractK6Count()`, invoked by `docs:manifest:update:k6`) counts NON-RECURSIVE top-level
`tests/k6-*.js` files -- and exactly 6 such files exist today (verified). The census's 23 includes
subdirectory/archived variants. No refresh is needed; recorded so the 6-vs-23 difference is not
misread as drift. `vitest_test_count` (5821, 2026-07-20) DOES lag today's 5926 -- refresh via
`docs:manifest:update:vitest` in a future fact-refresh PR if desired (+105 delta).

## 6. Limitations

- Playwright locally passed 132 with 102 skipped (auth-gated tiers skip outside CI); the 228-class
  full-matrix number is a CI-side count. This packet cites local pass + green PR-branch CI rather
  than claiming a fresh full-matrix count.
- The main-tip CI/CD Pipeline run for 362e402a (id 29958008169) was IN PROGRESS at packet-writing
  time; every completed check on every 2026-07-22 PR branch through #743 was green (later same-day PRs #744/#745 need their own green CI re-verification). Re-check before the owner
  sanctions the edit.
- The census script (`.tmp_grade_metrics.py`, AGY-authored, orchestrator-run) is untracked scratch;
  its counting rules are stated in section 2 and reproducible from the methodology doc's commands.

## 7. References

- `docs/review-analysis/HOW_TO_CONDUCT_GRADE_ANALYSIS.md` -- methodology (sufficient; section 3).
- `docs/_meta/docs-manifest.json` `facts.grades.current_grade` -- the 2026-07-18 snapshot + its
  staleness_note (the drift this packet answers).
- `docs/TOP50_CONTINUATION_STATUS_2026-07-22.md` -- row 12 scope ruling + queue state.
- Gate logs: `.tmp/gate-logs/` in the 2026-07-22 run worktrees (four full six-gate suites).
