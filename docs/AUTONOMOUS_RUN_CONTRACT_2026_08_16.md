# Autonomous overnight run contract -- 2026-08-16

**Mode: AUTONOMOUS MULTI-HOUR** (L0 CLAUDE.md 1.21). This is the complete launch contract.
The owner is asleep. Do not ask for approvals covered here. Do not produce a sequence of
micro-prompts for the owner to paste back -- that is the prompt-courier failure 1.21 forbids.

**Timebox:** 8 hours, or until the stop conditions in section 9 fire, whichever is first.

**Mission, in one sentence:** continue the UI/UX audit remediation to the point where the
owner wakes to (a) merged-or-mergeable PRs for everything unambiguous, and (b) ONE batched
decision artifact covering everything that needed their judgment.

---

## 1. WHAT ALREADY HAPPENED (do not redo)

Read `FRESH_SESSION_HANDOFF_2026_08_15c_BATCH1_READY_TO_SHIP.md` fully before acting. Then:

| Item | State |
|---|---|
| Batch 1 (18 design items + Vision page + audit remediation) | **PR #781**, pushed, 6 review rounds, all gates green |
| Owner's Guide roadmap edits + tab-reference fix | **PR #780**, pushed |
| B14 ThemeToggle 44px | Committed `b92a3103` on `feat/section-b-wave0-20260815`, NOT pushed, full gates + codex owed |
| Batch 2, Section B, deferred triage | Planned in `docs/NEXT_BATCHES_PLAN_2026_08_15.md` and `docs/DEFERRED_TRIAGE_2026_08_15.md` |

**Do NOT re-decide:** the `find()` throw-vs-placeholder question (shipped), decision #1b/#1c
deviation (accepted), P2-1 tones (shipped), #16 scope (both surfaces), P1 receipt (lift to
parent).

**Do NOT implement `docs/EXPOSURE_FACTOR_BOUNDS_SPEC.md` as written** -- read its STOP
banner. Its premise was false.

---

## 2. THE BRANCHING UNLOCK (read this before planning anything)

Most remaining work touches files in PR #781 (`MatrixDashboard.tsx`, `page.tsx`,
`ProjectPhases.tsx`, `globals.css`, `ScrollFadeRegion.tsx`, `MathRenderer.tsx`,
`EvidenceLibrary.tsx`). Branching off `main` would guarantee conflicts.

**So branch off `origin/feat/mo-design-batch-20260815` (batch 1's branch), not `main`,** and
open PRs TARGETING that branch. Stacked PRs.

**Known cost, verified:** `.github/workflows/ci.yml` triggers only on
`pull_request: branches: [main, develop]`. **A stacked PR gets NO required CI at all** --
Lint, Unit, Build and E2E never fire, and the PR can sit "green" on checks that prove
nothing. Therefore:
- Run the FULL local gate suite on every stacked branch before opening its PR, and paste
  the real numbers into the PR body.
- State in every stacked PR body: "CI does not run on this PR (base is not main). Gate
  evidence is local, reproduced below."
- Record in `PR_MANIFEST.md` that each stacked PR must be RETARGETED to `main` once #781
  merges, which is what makes CI fire.

Use a fresh worktree per branch (L0 1.15):
`git worktree add C:/Projects/SSTAC-Dashboard-worktrees/<lane>-20260816 -b <branch> origin/feat/mo-design-batch-20260815`
then junction node_modules and copy `.env.local`:
`cmd /c mklink /J "<wt>\node_modules" "C:\Projects\SSTAC-Dashboard\node_modules"`

**NEVER recursively delete a worktree** -- node_modules is a junction into the main
checkout and a recursive delete empties the shared store. This has happened three times.

---

## 3. EXECUTION UNITS, RANKED

Work them in order. Each unit = its own branch, own worktree, own PR. Finish and push a
unit before starting the next; a half-finished unit at timeout is worse than a missing one.

**U1 -- Ship B14 (30 min).** Branch already exists with the commit. Run the full suite
(ThemeToggle renders inside the app-wide Header, so e2e matters), `/codex-review` to GREEN,
push, PR. Base: `main` -- this one does NOT touch batch-1 files, so it gets real CI.

**U2 -- Section B Wave 0 remainder: B11 theme-flash (1-2 h).** Same branch as U1 or a new
one off `main` (layout.tsx / ThemeContext.tsx are not in #781). CSP already permits inline
scripts (`middleware.ts:11`). UNVERIFIED: whether App Router accepts a literal `<head>` with
raw inline script in this root layout -- check first. Not unit-testable; verify with
Playwright (pre-seed `localStorage.theme='dark'`, assert the dark class before the client
bundle runs).

**U3 -- Batch 2, all five items, ONE PR (3-4 h).** Stacked off batch 1. Full spec in
`docs/NEXT_BATCHES_PLAN_2026_08_15.md`. Items: #16 (duplicate H1 at BOTH surfaces via a
`demoteLeadingH1` helper -- do NOT touch MathRenderer, it would delete Jermilova's only h1),
#18 (auth links into header; delete the Get Involved box at `page.tsx:128-150`, NOT 130-152),
P1 (surface Review-candidate-defaults in the calculator body; lift `candidateReviewedAt` to
the shared parent; MUST delete `e2e/matrix-options.spec.ts:37` in the same commit), P2
(narrow-screen Stage-3 hint -- use CSS `lg:hidden`, NOT `useIsMobile()` which is 768px while
the layout stacks at 1024px), #20 (both padding layers, `MatrixDashboard.tsx:2257` and
`:1406`). **Re-read every line number before editing; they drift.**

**U4 -- Section B Wave A, ONE PR (2-3 h).** Stacked off batch 1. Copy/markup only:
B1 sign-in-required labels, B2 `<main>` + skip link (assert the skip link's href matches the
landmark id), B3 heading hierarchy (4 orphaned h3s), B6 acronyms (TWG and BN-RRM never
expanded; SSTAC expanded only on its second occurrence), B7a footer (dynamic year, drop
"all rights reserved"), B8 phase stated twice not thrice, B9 five raw `<a>` to `next/link`.

**U5 -- Deferred triage fold-forward, ONE PR (1-2 h).** Stacked off batch 1. The six
safe items in `docs/DEFERRED_TRIAGE_2026_08_15.md`, and prefer the SYSTEMIC fix recorded
there: bake `print:overflow-visible print:max-w-none` into `ScrollFadeRegion` itself rather
than patching each caller (three caller-side print gaps were found in one day).

**U6 -- View-by-view UI/UX audit (remaining budget).** This is the AUDIT CONTINUATION and
it feeds tomorrow's decisions. Audit these views, in this order, and produce findings ONLY
-- do not implement: References & Values, Interactive Map, SSD Workbench, The Guide,
Methodology by pathway, TWG Review. For each view assess: information hierarchy, mobile at
375px, keyboard path, contrast in BOTH modes, empty/error/loading states, and whether any
regulatory value can be hidden, clipped, or truncated. Measure in a real browser -- jsdom
cannot see this class. Write findings to `docs/UI_AUDIT_ROUND2_2026_08_16.md`.

---

## 4. THE DECISION ARTIFACT (the owner's main deliverable)

Everything that needs owner judgment goes into ONE artifact, published at the end of the
run. Do not spread decisions across PR comments.

**Format that worked before:** a single HTML artifact, one section per decision, each with
2-3 RENDERED options (actual markup, not descriptions), a clear recommendation with reason,
and the evidence behind it. Publish via the Artifact tool and put the URL in the final
report and in `RUN_STATE.md`.

**What belongs in it:**
- Every U6 audit finding that is a design choice rather than a defect.
- Exposure-factor UPPER bounds: propose defensible ranges per field WITH sources, marked
  clearly as proposals. This is the owner-gated half; do not implement.
- B4's two open contrast failures (3.07:1 amber note, 2.45:1 sub-bullets): show 2-3
  corrected palettes with measured ratios.
- Section B Wave C: `/contact` and `/accessibility` routes do not exist. Propose scope
  (mailto stub vs real form) and the auth-gating question.
- Anything you hit where two reasonable implementations exist and the decision is aesthetic
  or product, not technical.

**Rules for the artifact:** every option must be genuinely viable (no strawmen); state the
recommendation FIRST with a one-line reason; include measured evidence (contrast ratios,
px, counts) not adjectives; and flag any option that would touch regulatory values as
requiring a domain reviewer.

---

## 5. GATE PROTOCOL

**Proportionate gating -- do not run a 17-minute suite on a doc change:**

| Change | Gates |
|---|---|
| Docs only | None. ASCII check + accuracy read |
| Test only | that test file |
| One component | its tests + tsc |
| Before ANY push | FULL suite, once |

**NEVER pipe a gate command through `tail`.** In a pipeline `$?` is tail's exit status. A
prior session reported "all gates exit 0" while a Playwright test failed in the same log.
Redirect to a log file; read the file; corroborate every exit code with a pass COUNT.

```
npm run lint     > .tmp/gate-logs/lint.log 2>&1; echo "EXIT=$?"
npx tsc --noEmit > .tmp/gate-logs/tsc.log  2>&1; echo "EXIT=$?"
npm run test:ci  > .tmp/gate-logs/unit.log 2>&1; echo "EXIT=$?"
npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10 > ...; echo "EXIT=$?"
E2E_AUTH_ENABLED=true npm run test:e2e -- --workers=4 > ...; echo "EXIT=$?"
```

E2E: the env var is REQUIRED or the authenticated project produces zero tests silently --
grep for `chromium-auth` (expect ~25) before quoting a pass count. Use `--workers=4`; the
default 10 causes contention failures. Stop any dev server on port 3000 before building --
`build:monitored:clean` wipes `.next`.

**Freeze the tree before gating:** write the content hash to `.tmp/gate-logs/FROZEN_HASH.txt`
and re-check it after. Three gate runs were invalidated in the prior session by editing a
tree mid-run. Write scratch output OUTSIDE the worktree.

**Baselines:** lint 0 errors / 76 warnings (a 77th means you added one). Unit 6782 passed /
353 files. E2E 160 passed / 138 skipped. These are batch-1 numbers; they will grow.

---

## 6. REVIEW PROTOCOL

Per commit: **Leg 1 first, then codex.** Leg 1 is a real iterative loop with a FRESH
read-only subagent each round, run to GREEN. Codex is never a substitute for it and must not
be launched before Leg 1 is GREEN this round -- that was attempted three times in the prior
session and the gate caught it every time.

- **Leg 1a:** self-contained diff review (subagent cannot see your conversation).
- **Leg 1b:** context-inheriting fork attacking the premise, operational consequences, and
  YOUR OWN verification claims. Required whenever deployed behaviour changes.
- **codex grind:** `-c model="gpt-5.3-codex-spark" -c windows.sandbox="unelevated"`
- **codex ship gate:** `-c model="gpt-5.6-luna" -c model_reasoning_effort=high -c windows.sandbox="unelevated"`

**Calibration from six prior rounds:** the confidently-argued ARCHITECTURAL findings were
false three times (twice "display equations lose their left half", once "toolbar overflows at
375px") -- all disproven by direct browser measurement. The REAL findings were quiet
specifics: a translucent background, a CSS class-order override, malformed data, a stale doc
reference, an unreachable assertion. **Measure geometry claims before accepting them.**

**Test discipline, non-negotiable:** FALSIFY BEFORE BELIEVING. Write the assertion, break
the code, watch that test fail with a readable error, then fix and watch it pass. Five tests
in the prior session passed on first write and were later proven unable to fail -- including
one asserting a CSS class that passed while the colour it guarded never rendered. Where jsdom
cannot see the effect (computed colour, layout, print, paint timing), say so IN the test and
assert the real effect in e2e or measure it in a browser.

---

## 7. RESILIENCE ARTIFACTS (L0 1.21)

Maintain these in the ui-qa-audit worktree root, committed at each unit boundary:

- **`RUN_STATE.md`** -- current unit, what is done, what is next, the decision-artifact URL.
  Update at every unit boundary. This is what a crashed run resumes from.
- **`PR_MANIFEST.md`** -- every PR opened: number, branch, base, gate numbers, review status,
  and whether it needs RETARGETING to main after #781 merges.
- **`HEARTBEAT.log`** -- append a timestamped line every ~30 min: current unit + status.
- **`COMMAND_LOG.md`** -- every gate and review invocation with its real exit code.
- **`RESUME_PROMPT.md`** -- a complete launch prompt to restart from the current state.
  Rewrite it whenever `RUN_STATE.md` changes materially.

---

## 8. AUTONOMY -- proceed without asking

Do NOT stop for: worktree creation, file edits, test authoring, gate runs, `/codex-review`,
commits, pushes, opening PRs (including stacked ones), polling CI, updating docs, publishing
the decision artifact, or moving to the next planned unit.

## 9. STOP CONDITIONS -- halt and write RUN_STATE.md

- Any merge of a PR. **Never merge. The owner merges.**
- Any change to `supabase/migrations/`, RLS, service_role keys, `DATABASE_URL`, or any
  Supabase write. Out of scope entirely for this run.
- Any change to `src/data/` catalogs or `matrix_research/reference_catalog/` beyond what an
  already-recorded owner decision authorises. The equations.json edit was owner-approved and
  is DONE; do not extend it.
- Writing a real verdict value into `v2_judgments`. Forbidden, no exceptions.
- Any destructive git operation: `reset --hard`, `checkout --`, `clean`, `stash` on a dirty
  tree, force-push, or a recursive worktree delete.
- The same gate failing twice after a genuine fix attempt.
- Leg 1 oscillating past ~5 rounds on one unit -- escalate to a holistic review instead.
- Token budget below ~15% -- stop, checkpoint, rewrite RESUME_PROMPT.md.
- Anything touching a regulatory VALUE, coefficient, unit, or rounding rule.

## 10. FINAL REPORT CONTRACT

At the end, produce one report containing:
1. Units completed vs planned, with PR numbers.
2. The consolidated gate block per PR, with REAL exit codes and pass counts.
3. Review rounds run per PR and what each found.
4. The decision-artifact URL and a one-line summary of each decision awaiting the owner.
5. **What is NOT verified** -- stated plainly, not buried. Anything checked only at the
   class-contract level, anything unmeasured in a browser.
6. Anything you got wrong mid-run and corrected, with the correction.
7. Retarget list: which stacked PRs need rebasing onto main after #781 merges.
8. `Claude-token spend risk for next step: low/medium/high` and
   `AGY delegation opportunity: yes/no`.
