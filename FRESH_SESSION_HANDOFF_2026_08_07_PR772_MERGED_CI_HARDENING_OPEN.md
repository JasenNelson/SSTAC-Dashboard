# FRESH SESSION HANDOFF -- 2026-08-06

**Status: PR #772 OPEN and BLOCKED on a GitHub Actions major outage. Nothing is wrong with the code.**

Start from `C:\Projects\sstac-dashboard` (exact lowercase casing -- session memory lives under that
project key). Read `CLAUDE.md`, then this file.

Treat every claim below as a claim. Reverify live state before acting. That instruction is not
boilerplate: this session spent five review rounds correcting docs whose defect was precisely that
they asserted live state transcribed from a prior summary rather than derived from a probe.

---

## 1. Where things stand

### PR #772 -- docs, open, blocked

| | |
|---|---|
| URL | https://github.com/JasenNelson/SSTAC-Dashboard/pull/772 |
| Branch | `docs/wiki-autofollow-session-notes-20260806` |
| Head | `ea073364f531536368d35a12d59c4c54f805b8c2` |
| Base | `main` @ `a821e51968982c0b3dfe2b40e910e9aac1c112c6` (verified equal to live tip at close) |
| Scope | 6 files, all `docs/**`, +632/-15 |
| Mergeable | `MERGEABLE` (no conflicts); `mergeStateStatus: BLOCKED` |

Check state at close:

- GREEN: Lint & TypeScript Check, Unit Tests, Run docs gate, Run archive investigation gate,
  Security Scan, GitGuardian, Vercel.
- NOT REPORTING: Production Build, E2E Tests, CI Status Check -- all three were CANCELLED with
  `runner_name:""` and `steps:0` (never acquired a runner, executed nothing), then re-run.
- The re-run of run `31123692717` was issued and was still `queued` with zero jobs dispatched
  48+ minutes later.

### Root cause -- CONFIRMED EXTERNALLY

GitHub Actions was in a **major outage**: incident "Incident with Actions", impact Critical, started
**2026-08-06 15:22:49 UTC**, still `Investigating` at 19:43:21 UTC, with
"capacity remains constrained and jobs may still be delayed or fail while it recovers gradually."
Our run was created 17:38:07Z, well inside the incident.

This is why some jobs got runners (17:38, 17:42, 17:44, 18:00) and others starved -- partial
capacity, not a repo problem. Do NOT go looking for a config bug.

### The one retry is SPENT

`docs/GATE_MODE_SOP.md:165`: "One retry maximum per known machine failure class. Do not retry more
than once. Stop and escalate after the retry fails." The retry has been issued. **Do not issue
another.** If the queued re-run ultimately fails, the PR simply stays blocked until a future run is
green -- that is not permanent.

---

## 2. What to do next

1. **Check GitHub status first**: https://www.githubstatus.com/api/v2/summary.json. If Actions is
   still degraded, do nothing and wait. There is no deadline on this PR.
2. **When Actions recovers**, check whether the queued re-run dispatched and passed. Verify with the
   full evidence packet, not the green tick:
   - job conclusions, `runner_name` (must be non-empty), `steps` count (must be > 0)
   - BOTH the live base SHA and head SHA still match the values above
   - that the intended gate step actually executed rather than all conditional steps skipping
3. **If green**: bring the owner the consolidated gate block and ask for explicit approval of
   `ea073364`. Approval never carries across SHAs.
4. **Alternative path the owner may choose**: `ship-protocols` provides an OWNER WAIVER --
   "owner may explicitly waive parts for NON-CODE changes (pure docs, generated facts) -- record the
   waiver in the PR body." #772 is pure docs and qualifies. This is the OWNER's call to exercise; an
   agent must not self-authorize an admin merge.
5. **After #772 merges**: commit this handoff onto `main` (see section 5), then run `/update-docs`
   scoped to the CI incident -- see section 4 for why it is deferred.

---

## 3. CI findings discovered this session (RECORDED, NOT ACTIONED)

All verified. None of these are caused by the outage; the outage merely surfaced them. The owner
asked for these to be recorded rather than actioned. Do NOT bundle them into a docs PR.

- **[P2] `Security Scan` cannot fail on vulnerabilities.** `ci.yml:237/251/252` carry job-level
  `continue-on-error: true`, `npm audit --audit-level=moderate || true`, AND step-level
  `continue-on-error: true`. Enforcement requires removing ALL THREE; dropping one is cosmetic
  because job-level continue-on-error forces the job conclusion to `success`.
- **[P2] 22 production vulnerabilities / 11 high / 0 critical** (`npm audit --omit=dev`). The 6
  criticals in the default audit are all dev-tree and split three ways -- vitest-family (UI-server
  precondition), `tar` (path traversal), `shell-quote`/`concurrently` (ReDoS). The one-shot fix is a
  PRODUCTION runtime bump (`next` 15.5.9 -> 15.5.22, Sentry graph swap including a semver-major
  `@sentry/webpack-plugin` 4.6.1 -> 5.4.0, duplicate `zustand 4.5.7` beside declared `^5.0.11`), and
  it also moves `vitest`, which would perturb the `vitest_test_count: 6618` manifest fact PR #772
  just landed. It cannot be verified locally (test:ci/build/e2e exceed the tool timeout).
  Dependabot/Renovate is the only option that stops these re-accumulating.
- **[P2] PR retarget does not trigger CI.** `ci.yml` uses default `pull_request` types, which omit
  `edited`; retargeting a base emits `edited`. Required contexts then never report. A naive
  `github.event.changes.base != null` guard would suppress ordinary CI -- it must be action-aware
  (`action != 'edited' || changes.base != null`). Any concurrency group added alongside must not let
  a title/body edit cancel a valid run and replace required jobs with skipped checks.
- **[P3] `CI Status Check` launders `cancelled`/`skipped` into a pass** (`ci.yml:361-374`, gates only
  on `= "failure"` under `if: always()`). Decorative today -- it is NOT a required context. If fixed,
  name the four jobs explicitly rather than `needs.*`, which would sweep in `performance-analysis`
  (legitimately `skipped`).
- **[P3] Seven of eight `ci.yml` jobs lack `timeout-minutes`** (default 360). Would NOT have
  prevented this incident: timeouts start only after a runner is assigned.
- **[P3] Do not promote the docs checks to required.** Both carry `paths:` filters, and a required
  workflow filtered out stays Pending forever. If ever promoted, use an always-run job that skips
  work internally.

Required contexts on `main` are exactly `["Lint & TypeScript Check","Unit Tests","Production Build",
"E2E Tests"]`, `strict:false`, `enforce_admins:false`, no rulesets.

---

## 4. Why `/update-docs` is deferred

There is real new material to capture (the outage, the CI findings above, the process lessons). It is
deferred for two reasons:

1. **Mechanical:** `/update-docs` writes to `docs/`, which is exactly what #772 carries. Committing
   its output on that branch changes the head SHA, discards the green checks, and re-queues the whole
   pipeline.
2. **Substantive:** a root-cause review this session concluded `/update-docs` is itself implicated --
   it transcribes live state into prose rather than deriving it from probes, and that prose is then
   restated in 7-12 places across four files, so one correction needs an 11-way edit while reviews
   only see changed lines. That is `NEXT_STEPS.md` item 7 (landed in #772). Running it again unchanged
   re-seeds the same defect class.

Run it after #772 merges, scoped to the CI incident, and probe-verify every state claim it emits.
Better: do the structural fix first (emit live-state facts from a probe script into one dated
generated block; have prose cross-reference it).

---

## 5. This handoff is committed on its own branch, NOT on #772

`CLAUDE.md` requires the handoff be refreshed AND committed at close-out. Committing it on #772's
branch would have destroyed that PR's green checks and its queued re-run, and the primary checkout is
30 commits behind with 5 dirty tracked files owned by another session (do NOT reset or clean it).

So this file is committed on `docs/session-handoff-20260806` off `origin/main` and pushed WITHOUT a
PR. Verified safe: `ci.yml` and `docs-gate.yml` trigger only on pushes to `main`/`develop`, so a
feature-branch push starts no workflows and adds no load during the outage.

**Next session: open a PR for that branch (or fold it into the post-merge docs pass).**

---

## 6. Wiki runtime / nightly -- UNAFFECTED, but two standing hazards

Nothing this session touched the runtime, `tooling/wiki`, the scheduled task, or the venv. `docs/**`
and `.github/**` are both outside the auto-follow protected pathspec, and the nightly runs no npm
commands (verified). The nightly is a local Windows scheduled task and does not use GitHub Actions,
so the outage does not affect it.

Standing hazards to carry forward:

- **The task runs as `LogonType=InteractiveToken`, not Contract D's mandated `Password`.** It only
  fires while someone is signed in. A logout or an unattended reboot before 05:30 silently costs a
  counted night. The counted streak was at DAY 1 of 10. The owner elected to keep a session signed in
  rather than change the task.
- **Process custody:** the N0 baseline flags any process whose command line carries the runtime path
  as a delimited token, or whose executable lives under the runtime root. An ordinary working shell
  can trip it. When checking, build the search pattern at runtime from parts -- a literal query
  matches ITSELF and reports a false positive (observed twice this session). Verified 0
  runtime-referencing processes at close.

---

## 7. Corrections this session made to its own reporting (read before trusting anything)

Recorded because the pattern matters more than the individual errors:

- Called a `cancelled` job a "failure"; reported the run-level rollup without opening the job object,
  where the actual proof lived (`steps:[]`, `runner_name:""`).
- Asserted "provable transient infra failure" before running the query that proved it.
- Listed `Security Scan` as a passing gate when it is structurally incapable of failing on
  vulnerabilities.
- Said "6 criticals" twice as the reason the vulnerabilities mattered; production has ZERO criticals.
- Claimed a per-job re-run had the "smallest blast radius"; both `--job` and `--failed` include
  dependencies.
- Asserted "the pool has not recovered", then over-corrected to "no evidence exists", then to
  "per-account concurrency saturation" -- all three wrong. It was a declared GitHub outage. The
  correct position throughout was "cause undetermined".
- Proposed a recovery probe (`Docs archive investigation`) that had already passed DURING the
  incident and therefore could not discriminate.
- Argued the SOP retry stop-rule was aimed at code failures and did not apply; it explicitly covers
  "machine failure class". Also missed the OWNER WAIVER that the same SOP provides for pure-docs PRs.
- Used the codex MCP path instead of the CLI based on a desktop-app guard retired 2026-08-06.

Every one of these was caught by an adversarial reviewer, not by self-check. Run the review legs.
