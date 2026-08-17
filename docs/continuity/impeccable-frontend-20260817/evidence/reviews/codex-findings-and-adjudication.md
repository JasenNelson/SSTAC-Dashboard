# Codex rounds -- bounded receipt and mutual-agreement adjudication

The raw transcripts are preserved alongside this file. They are large and mostly tool-call noise;
this is the bounded receipt of what was actually found and what was done about it.

    codex-luna-round1-SANDBOX-BLOCKED.txt   83143 bytes   NO REVIEW PRODUCED
    codex-luna-round2.txt                  176691 bytes   3 findings
    codex-sol-xhigh-shipgate.txt           201731 bytes   3 findings (the ship gate)

## Round 1 (gpt-5.6-luna, high) -- SILENT BAIL, no verdict

Exit code 0, but no review. Codex's own tool router rejected essentially every command it tried:

    rejected: The executor may not inspect or mutate Git. Mission Control captures status, diff,
              and ref evidence.
    rejected: Explicit interpreter and shell wrappers can bypass direct Git, secret, cloud, and
              cleanup rules. Use the exact npm/npx gates.

The prompt had pointed codex at `git diff <range>` targets, which that policy forbids, so it burned
its turn retrying and emitted only context dumps. This is recorded because it is a reusable lesson:
in this environment codex CANNOT run git and cannot use compound/pipelined PowerShell. Diffs must be
INLINE in the prompt, and only plain single-file reads succeed. Round 2 was re-run that way and
logged zero rejections.

## Round 2 (gpt-5.6-luna, high) -- 2 P1 + 1 P2

No literal `VERDICT:` line was emitted. That is the documented codex reporting quirk, so the
dispositions were read from the body rather than inferred from tone.

Confirmed by luna: the antidote-before-poison-before-draft save order closes the ordinary single-tab
save and failure paths; submission cleanup is safe; the pb-72 / max-h-40 arithmetic is sufficient;
the parent-branch merge plan is legitimate; the force-with-lease is safe and recoverable.

1. [P1] "Seed the pre-mount theme context from the bootstrap result", ThemeContext.tsx:81-82.
   ADJUDICATION: **REFUTED.** The round read the WRONG TREE -- the worktree it inspected is checked
   out at PR#785 and contains ZERO occurrences of `seedTheme`. At the actual candidate `887d9265`:
       line  95   const [theme, setThemeState] = useState<Theme>(() => seedTheme(initialTheme));
       line 170   if (!mounted) {
       line 172     <ThemeContext.Provider value={{ theme, ... }}>
   so the initial context value IS the seed and the unmounted branch hands out `theme`, not
   `DEFAULT_THEME`. That is precisely the falsifier the finding itself named.

2. [P1] "Do not trust an unpaired truncation marker", TWGReviewPortal.tsx:212-217.
   ADJUDICATION: **DOWNGRADED to P2.** The premise requires a DEPLOYED population carrying a stale
   `{}` truncation record. `main` at 120c6f9a contains ZERO occurrences of the string "truncation"
   in TWGReviewPortal.tsx, so the truncation record has never existed on a shipped build and no such
   population can exist. Residual accepted: after this build ships, the disclosure is lost if the
   unknown-provenance record is selectively lost while the truncation record survives.

3. [P2] "Persist dismissal independently of at-limit re-derivation", TWGReviewPortal.tsx:357-365.
   ADJUDICATION: **ACCEPTED, unrefuted.** Over-warns only; cannot suppress a disclosure.

## Round 3 (gpt-5.6-sol, xhigh) -- THE SHIP GATE -- 1 P1 + 2 P2

This round was given the round-2 findings plus the adjudication above and asked to DEFEND / REVISE /
WITHDRAW each. It agreed with both of the orchestrator's P2 positions and did not restate the
refuted theme claim in its original form.

Confirmed by sol, verbatim in substance:
  - the antidote-before-poison-before-draft order closes ordinary single-tab save and failure paths;
  - submission cleanup is safe;
  - the `pb-72` / `max-h-40` arithmetic is sufficient;
  - parent-branch aggregation is "a legitimate exact-tip CI strategy rather than a gate bypass";
  - the exact force-with-lease is safe and recoverable through the preserved tag;
  - "no Stack A P1 was found";
  - the correction tests are mutation-sensitive (i.e. not vacuous) except the ThemeProvider
    first-render test, which exercises a non-production invocation.

1. [P1] "Seed cookie-less migration from the bootstrap class", ThemeContext.tsx:83.
   This is a DIFFERENT and more precise claim than luna's. For a returning browser with
   `localStorage.theme = 'dark'` and no theme cookie, `layout.tsx` resolves and passes an
   authoritative `'light'`, the bootstrap then sets `<html class="dark">`, and the `parseTheme`
   early return in `seedTheme` wins before the DOM-class branch -- so the toggle initially exposes
   "Switch to dark mode" and a moon on an already-dark page, and the DOM-class fallback is
   effectively unreachable in production.
   ADJUDICATION: **CONFIRMED AS A CODE FACT** by the orchestrator, by reading
   `layout.tsx:49,68` and `ThemeContext.tsx:82-85` at `887d9265`.
   OWNER DECISION 2026-08-17: land Stack B and carry this as a follow-up. Rationale recorded at
   decision time: it is disclosed in #787's own comment at ThemeContext.tsx:78-80 and in the scope
   doc's section 7; it lasts ONE request per browser because the bootstrap writes the cookie on that
   same visit; it is strictly better than #782 landing alone (which has the same mismatch on every
   request forever); and the obvious fix -- passing `undefined` when the cookie is ABSENT rather
   than present-and-light -- trades the wrong label for a first-render hydration mismatch on the
   same one request, making it a design decision rather than a bug fix.

2. [P2] "Fail closed when unknown provenance cannot be trusted", TWGReviewPortal.tsx:167-168.
   Sol explicitly endorsed the P2 downgrade: "not reachable from deployed main or an ordinary
   single-tab application sequence, supporting the P2 downgrade". Accepted as a follow-up.

3. [P2] "Persist pre-save dismissal without re-deriving it", TWGReviewPortal.tsx:354.
   "over-warning only and cannot suppress disclosure". Accepted as a follow-up.

## Gate status

The sol xhigh round RAN and produced findings, so this lane IS fully codex-gated. It is NOT a
"luna GREEN, sol deferred on budget" case, and must not be reported as one. No codex round was
skipped for quota; no quota or rate-limit error appeared in any transcript.

Sol's own summary line was that the candidate "should not land unchanged" on account of its P1.
The owner was shown that finding, with the code fact confirmed and the trade-off stated, and
decided to land and defer. That decision is the reason the lane closed GREEN-with-accepted-residual
rather than on an unqualified GREEN, and it is recorded here so no later reader mistakes one for the
other.
