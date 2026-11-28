# feat/section-b-wave0-20260815 -- theme flash elimination, theme sanitization, ThemeToggle touch target

## What this changes

A reader who has a dark-theme preference stored will no longer see a flash of the light
theme on first paint -- previously ThemeProvider defaulted to 'light' and only read
`localStorage` in a post-mount effect, so the page painted light, then switched to dark
after hydration. A new synchronous bootstrap script, injected into `<head>`, sets the theme
class before the browser paints any body content. Separately, if the stored theme value is
ever something other than 'light' or 'dark' (a corrupted or hand-edited value), the app no
longer silently ends up with NO theme class applied at all -- the runtime context now
sanitizes the stored value the same way the pre-paint bootstrap already did, closing a gap
where the two halves of the theme contract disagreed. The theme toggle button itself grows
from 40px to 44px, matching this project's touch-target floor used elsewhere
(MatrixDashboard, MatrixMap, EvidenceLibrary); the icon inside stays 20px, so only the hit
area grows.

## Commits

| sha | subject |
|---|---|
| cd8422b0 | fix(a11y): raise ThemeToggle to the 44px touch floor (audit B14) |
| 6c25f740 | fix(theme): eliminate the light-theme flash with a synchronous bootstrap (audit B11) |
| d6d4fa0f | fix(theme): sanitize the stored theme in ThemeContext, not only in the bootstrap |

## Why it matters

This lane remediates a UI/UX and accessibility audit of a regulatory dashboard. These three
commits are not instances of the value-hiding defect class this lane tracks elsewhere
(a correct regulatory number clipped or truncated) -- they are a rendering-correctness fix
(the flash), a state-integrity fix (an unsanitized stored value could leave the document
with no theme class and re-persist the bad value), and an accessibility touch-target fix.
Per the d6d4fa0f commit message, the sanitization gap was found by adversarial review of
the B11 bootstrap commit: the pre-paint bootstrap script sanitized correctly, but
`ThemeContext` read the persisted value with a bare type cast rather than a check, so the
two halves of the contract could disagree, and the module's own comment claimed they could
not.

## Gates

GATE EVIDENCE: NOT YET RUN AT THIS TIP -- fill before publishing

No RESULT.txt in the gate-evidence scratchpad matches this branch's tip
(`d6d4fa0f3313da11f6a8c1fcec8be9ece399c2e2`). `g5-themecookie-tip/RESULT.txt` exists in the
same scratchpad and covers theme-related work, but its FROZEN_HEAD
(`239a4e270b64a5455b91afd6952e6b536a869887`) is a different commit on a different branch
(`theme-cookie-20260816`), with 3 dirty files at start -- it is not this branch and its
numbers (including a FAILED build corroboration: `BUILD_EXIT=1`,
`BUILD_CORROBORATION=FAILED -- exit 0 but no route table; do NOT quote this build as
evidence`) must not be attributed to wave0.

| Gate | Result |
|---|---|
| Lint | NOT YET RUN AT THIS TIP |
| Typecheck | NOT YET RUN AT THIS TIP |
| Unit | NOT YET RUN AT THIS TIP |
| Build | NOT YET RUN AT THIS TIP |
| E2E | NOT YET RUN AT THIS TIP |

## Not verified

- No gate run (lint, typecheck, unit, build, or e2e) exists for this branch's exact tip.
  A same-day theme-related gate run exists in the scratchpad (`g5-themecookie-tip`) but it
  is for a different commit on a different branch and its build gate itself failed
  corroboration, so it cannot stand in for this branch's evidence.
- The theme-sanitization fix in d6d4fa0f and the flash-elimination bootstrap in 6c25f740
  are described in their commit messages as verified against specific behaviour, but no
  gate log in the available evidence independently corroborates either commit for this
  branch tip.
- The 44px touch-target change in cd8422b0 is not cross-checked here against any e2e
  assertion of rendered element size for this tip.
