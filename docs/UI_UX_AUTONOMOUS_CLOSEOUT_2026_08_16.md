# UI/UX Autonomous Closeout - 2026-08-16

## Run

Autonomous overnight UI/UX run, 2026-08-16, started 04:50 UTC.

Contract:

```text
docs/AUTONOMOUS_RUN_CONTRACT_2026_08_16.md
```

## Verdict

Four PRs were opened. None were merged -- the owner merges. All four are pushed with gates run
and reviewed; the merge order below is fixed and must be followed.

## NOT VERIFIED -- read this before merging anything

This section is deliberately first, not buried at the end.

- NOTHING in these four PRs was measured in a real browser. All geometry, contrast, print and
  WebKit claims are asserted at the class-contract or DOM level only.
- jsdom implements neither `@media print` nor WebKit pseudo-elements, so BOTH headline changes in
  #785 (systemic print-safety in `ScrollFadeRegion`, WebKit disclosure markers) are unproven at
  the visual level. A print-preview check and a Safari/WebKit check are owed.
- The 375px header fit in #783, the P2 hint's disappearance at >=1024px, and the padding reduction
  are class-level assertions only. No layout engine confirmed any of them.
- The B4 contrast ratios in the decision artifact were computed from Tailwind's documented hex
  values. Tailwind v4 defines its palette in OKLCH, so the shipped values may differ slightly.
  Re-measure in a browser before merging any contrast change.
- No accessibility tool (axe) was run against any changed surface.

## PRs Opened

| PR | Branch | Base | CI | Contents |
|---|---|---|---|---|
| #782 | `feat/section-b-wave0-20260815` | `main` | real | B14 44px ThemeToggle; B11 synchronous theme bootstrap |
| #783 | `feat/mo-batch2-20260816` | `main` | real | #16 duplicate H1 (2 surfaces), #18 header auth links, P1 body-reachable candidate defaults, P2 narrow-screen hint, #20 padding |
| #784 | `feat/section-b-wavea-20260816` | #783 branch | NONE | B1, B2, B3, B6, B7a, B9 (B8 verified as no-op) |
| #785 | `feat/deferred-triage-20260816` | #784 branch | NONE | systemic print-safety in `ScrollFadeRegion`, 1px caption honesty, WebKit disclosure markers (8 sites) |

## Merge Order (FIXED)

1. #782 may merge at any time. It is independent of the other three.
2. Then #783 -> #784 -> #785, in that exact order.

They are a linear stack. All three touch `page.tsx` and `MatrixDashboard.tsx`, so merging out of
order will produce conflicts or silently drop work.

### Retarget requirement

#784 and #785 currently get ZERO CI. The workflow triggers only on PRs whose base is `main` or
`develop`, and these two are based on the PR branch below them. Each must be retargeted to `main`
once the PR below it merges, so that it actually runs CI before it is merged.

## Gate Results

Every gate below was verified against pass COUNTS, not exit codes alone, and the tree hash was
proven unchanged across each run.

| PR | lint | unit | build | e2e | chromium-auth |
|---|---|---|---|---|---|
| #782 | 0 err / 76 warn | 6797 passed / 356 files | ok | 172 passed / 138 skipped | 25 refs |
| #783 | 0 err / 76 warn | 6804 passed / 354 files | ok | 160 passed / 138 skipped | 25 refs |
| #784 | 0 err / 76 warn | 6812 passed / 354 files | ok | 160 passed / 138 skipped | 25 refs |
| #785 | 0 err / 76 warn | 6817 passed / 358 files | ok | 160 passed / 138 skipped | 25 refs |

The e2e delta reconciles: #782 shows 12 more than the others, which is exactly its 4 new
theme-flash tests across 3 browsers.

### New post-merge baseline

The pre-merge handoff numbers are stale now that batch 1 is in `main`. The current baseline is:

```text
lint: 0 errors / 76 warnings
```

## Review

Every branch got a fresh read-only adversarial review before push.

- wave0: GREEN with 3 P2s, all fixed.
- batch 2: RED, 1 P1 + 3 P2/P3, all fixed.
- Wave A: RED, 1 P1 + 5 P2, all fixed.

Both P1s were defects the run's OWN changes introduced.

### batch 2 P1 -- stale candidate-review receipt

Lifting the candidate-review timestamp up to `MatrixDashboard` removed an ACCIDENTAL reset: the
state used to die with the panel's unmount. The parent stays mounted for the whole page, so a
stale timestamp rendered against a NEW substance's recomputed candidate count -- claiming
candidates were opened for a substance where they never were.

Fixed by making the receipt carry its own context and input keys.

### Wave A P1 -- ageing year on a prerendered page

`new Date().getFullYear()` does not fix an ageing year on a statically prerendered page. It would
be the BUILD's clock baked into the HTML, plus a hydration mismatch each New Year.

Fixed by resolving after mount.

## Two Tests The Run Wrote Were Proven Vacuous

Both were replaced.

- The B3 heading-hierarchy walk passed with the defect present, because `ProjectPhases` renders
  h3s before the card grid, so deleting the new h2 still left every level delta <= 1.
- The B9 `next/link` check passed after reverting all three Links to raw anchors, because
  `next/link` renders a bare `<a href>` in jsdom.

## Audit Round 2

```text
docs/UI_AUDIT_ROUND2_2026_08_16.md
```

34 findings across 6 views: References & Values, SSD Workbench, Interactive Map, The Guide,
Methodology by pathway, TWG Review. 30 DEFECT / 4 DESIGN CHOICE.

FINDINGS ONLY. Nothing in that document was implemented.

## Decision Artifact

```text
https://claude.ai/code/artifact/d16a3012-6f27-4aaa-a8b9-86691c5d84f2
```

11 decisions. 2 of them touch a regulatory value and are flagged as needing a domain reviewer.

## Process Failures In This Run

Recorded so they are not repeated.

1. Python's text-mode `open(path, 'w')` on Windows rewrote LF files as CRLF, turning a 73-line
   change into a 2335-line diff and repointing `git blame` for a 2300-line file. The FIRST repair
   was also wrong -- it normalised everything to LF, including files that were already CRLF in
   `main`. The correct rule is MATCH THE BASELINE per file; this repo has no `.gitattributes` and
   is genuinely mixed.
2. A literal backspace byte (0x08) was baked into a test regex by shell escaping, making it
   permanently unmatchable. Every file touched was then scanned for bytes >127 or <32.
3. Two full green gate suites were discarded because `main` moved underneath them mid-run. Gate
   evidence does not survive a rebase.
4. Roughly eight pointless polls of unchanged gate logs before the owner intervened on token
   efficiency. See `docs/UI_UX_AUTONOMOUS_TOKEN_PROCEDURES_2026_08_16.md`.

## Next Recommended Action

1. Owner merges #782 whenever convenient.
2. Owner merges #783, then retargets #784 to `main` and waits for real CI, then merges it.
3. Owner retargets #785 to `main`, waits for real CI, then merges it.
4. Before or shortly after merging #785, run a print-preview check and a Safari/WebKit check --
   both of that PR's headline changes are currently unproven at the visual level.
5. Re-measure the B4 contrast ratios in a browser before acting on any contrast decision.
6. Triage `docs/UI_AUDIT_ROUND2_2026_08_16.md` into a follow-up lane; it is findings only.

Claude-token spend risk for next step: low -- remaining work is owner-side merging plus browser
verification.

AGY delegation opportunity: yes. The audit round 2 triage and any mechanical follow-up fixes are
AGY-eligible once the owner ranks the 30 defect findings.
