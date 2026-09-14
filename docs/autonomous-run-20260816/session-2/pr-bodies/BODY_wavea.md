# feat/section-b-wavea-20260816 -- Section B Wave A accessibility pass + footer year removal

## What this changes

A reader of the landing page will notice: the three landing cards that point at
authenticated routes now say a sign-in is required, rather than looking like open links
that then bounce to `/login`. The page now has a `<main>` landmark and a skip link, both
derived from a single constant so the skip link's target and the landmark's id cannot
drift apart. Headings and acronyms on the landing page get corrected structure and
expansion. The footer no longer shows a copyright year at all -- not a build-time year, not
a client-resolved one -- following the owner's decision to drop it entirely rather than
pick between a stale build-time year and a flash-prone client-resolved one.

## Commits

| sha | subject |
|---|---|
| 90e48dee | feat(a11y): Section B Wave A -- landmarks, headings, gated-link labels, acronyms, footer |
| c41f1463 | fix(ui): drop the copyright year entirely (owner decision D7 = option C) |

## Why it matters

This lane remediates a UI/UX and accessibility audit of a regulatory dashboard. Both
commits in this range are copy/markup/structure fixes, not the value-hiding defect class
this lane also tracks elsewhere (clipped or truncated regulatory data). c41f1463 is
explicitly a simplification: per the commit message, removing the year removes the state,
the effect, the hydration consideration, and the no-JS/JS asymmetry in one step, rather
than trading one defect for another between a build-time year (wrong clock) and a
mount-resolved year (invisible to no-JS readers and crawlers).

## Gates

Source: `g5-wavea-tip/RESULT.txt` (FROZEN_HEAD `c41f1463c8bb91ef2a3687e5d82040cef1b14f8d`,
matches this branch's tip), supplemented by `g5-wavea-tip/unit.log` and
`g5-wavea-tip/e2e.log` where the RESULT.txt itself did not capture a summary line (see
notes below -- this is stated honestly, not filled in from another branch).

| Gate | Result | Source |
|---|---|---|
| Lint | PASS -- exit 0, 0 errors | `g5-wavea-tip/RESULT.txt` |
| Typecheck | PASS -- exit 0 | `g5-wavea-tip/RESULT.txt` |
| Unit | exit 0. RESULT.txt's own UNIT_SUMMARY/UNIT_FILES fields are blank (a gate-script capture gap, not a failure). Pulled from the underlying log: 354 Test Files passed, 3 skipped (357); 6813 Tests passed, 19 skipped, 2 todo (6834) | `g5-wavea-tip/unit.log` |
| Build | PASS -- BUILD_CORROBORATION=OK, markers route_table=1 static_pages=5 first_load_js=2 | `g5-wavea-tip/RESULT.txt` |
| E2E | exit 0. RESULT.txt's own E2E section is truncated: the gate script hit a shell error (`unexpected EOF while looking for matching backtick-quote`, line 78) before it wrote a summary line, so no pass count or chromium-auth reference count was captured there. Pulled from the underlying log: 165 passed (4.6m), 153 skipped; `chromium-auth` appears 30 times across matched test lines | `g5-wavea-tip/e2e.log` |

## Not verified

- The RESULT.txt for this tip has a script-level gap in both the UNIT and E2E sections
  (blank summary fields for unit; a shell error before the e2e summary line was written).
  The numbers above were recovered from the raw logs in the same directory, not from the
  structured RESULT.txt fields the other branches in this stack report from, so treat the
  unit/e2e numbers here as log-derived, not gate-script-corroborated the same way the lint,
  typecheck, and build rows are.
- No e2e-chromium-auth reference count field exists in this RESULT.txt to cross-check the
  30 counted directly in the log; other RESULT.txt files in this scratchpad use a field
  called `E2E_CHROMIUM_AUTH_REFS` (32 for the triage tip) that this run did not produce.
- Nothing in this range's gate evidence specifically isolates the footer-year removal or
  the landmark/skip-link change as individually tested; the numbers above are whole-suite
  totals for the branch tip, not per-commit evidence.
