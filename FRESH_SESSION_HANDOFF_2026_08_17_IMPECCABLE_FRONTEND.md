# FRESH SESSION HANDOFF -- 2026-08-17 -- Impeccable frontend lane COMPLETE

Root session anchor for SSTAC-Dashboard. Supersedes
`FRESH_SESSION_HANDOFF_2026_08_09_SSTAC_CURRENT.md` as the newest dated anchor. That file was NOT
edited and NOT archived, because this is a new dated anchor rather than an edit of an existing one;
archive-before-edit therefore did not trigger.

PRODUCT STATUS: **COMPLETE**. Do not reopen this lane for implementation, review findings, UI work,
or deferred issues. Reopening conditions are enumerated in section 10.

---

## 1. Outcome

    main   120c6f9a04de7e689c54579919f60144466e7f79
       ->  0ef90f48b663dbab3af7e1527995ff1747896b33

| PR | Title area | Disposition | Landed via |
|----|-----------|-------------|------------|
| #782 | Section B Wave 0 -- 44px theme toggle, synchronous theme bootstrap | MERGED | merge commit 22ef4532 |
| #787 | theme resolved from a cookie on the server (owner decision D2) | MERGED | via wave0, ATOMICALLY with #782 |
| #783 | batch 2 -- duplicate H1, header auth links, candidate-defaults, padding | MERGED | merge commit 0ef90f48 |
| #784 | Section B Wave A -- landmarks, headings, gated-link labels, acronyms, footer | MERGED | via batch2 |
| #785 | deferred-findings triage -- print-safety, caption honesty, WebKit disclosure | MERGED | via wavea |
| #788 | stop three P0 surfaces hiding or misstating regulatory data | MERGED | via deferred-triage |
| #786 | docs: autonomous UI/UX run records | **OPEN, EXPLICITLY OUTSIDE THIS LANE** | not merged (head 7e465cca) |

#786 is docs-only (28 files, zero code-bearing). It sits inside the literal "#782 through #788"
range but was never part of this lane, was never gated by it, and was deliberately left open by
owner decision. Its head SHA is recorded so a later session can confirm it was untouched.

## 2. All intended landed commit identities

Every one verified present on `main` with `git merge-base --is-ancestor`:

    f0f5633066b9390db922cc3e6c6c98274ef381a9   #783 batch2 tip
    c41f1463c8bb91ef2a3687e5d82040cef1b14f8d   #784 waveA tip
    87b8d2c82d0ade1f3208d01115a32f3eaccb20b8   #785 triage tip
    04c9cc1062d6dc9b08c2494dfc4792f87e1104db   #788 original tip (pre-correction)
    1628181481653161bc32b4b4d8b7527d14ff44ca   #788 correction round 1
    ae678fdf16dc7b5f3477e19ee25be8b9ef8e8306   #788 correction round 2 (final tip)
    6caaa34e508cafc174f77b1f666e5bf6289e7e24   #782 wave0 tip
    2c38c6a61216b522793c8af60f58079c82f13592   #787 seedTheme commit
    45293f1ae4f72f4a06007464a89ad2f7e532a310   #787 pre-correction tip
    887d9265d2949cd49dfde5428ad24ce97526e6b2   #787 correction (final tip)

No unintended reversion was found.

NOTE ON SHA LABELS: the ten values above are the last OWN commit of each PR's work, which is what
the corrections and reviews refer to. They are NOT the PR head SHAs at merge time, because merging
each child into its parent advanced the parent's head. Anyone comparing against
`gh api .../pulls/<n>` head.sha will therefore see different values for #782/#783/#784/#785 -- that
is expected, and the full chain (head at merge, base, merge commit) is tabulated in the mapping
document named below.

Per-PR merge commits, bases and timestamps:
`docs/continuity/impeccable-frontend-20260817/evidence/verification/pr-commit-mapping-and-merge-evidence.md`.

## 3. Final landed-tree gates -- main @ 0ef90f48, ALL SIX GREEN

    lint 0 errors | tsc clean | unit 6935 passed / 19 skipped / 2 todo (364 files)
    build exit 0, BUILD_CORROBORATION=OK
    e2e 215 passed / 0 failed, 32 chromium-auth refs
    docs gate STATUS: PASS
    ALL_SIX_GATES_RAN=YES | TREE_UNCHANGED=YES

This was the FIRST gate ever run on the union of both stacks; the inherited checkpoint had gated
each stack separately against main and never their combination.
Receipt: `docs/continuity/impeccable-frontend-20260817/evidence/gates/landed-main-GREEN.txt`.

## 4. Rendered-browser evidence

Production build of the landed tree, served locally. With JavaScript ABSENT (plain curl of the
served bytes):

    Cookie: theme=dark   -> <html class="dark">   aria-label="Switch to light mode"   sun glyph
    Cookie: theme=light  -> <html class="light">  aria-label="Switch to dark mode"    moon glyph

In headless Chromium with a dark cookie: `document.documentElement.className` = `dark`, body
computed background `rgb(15, 23, 42)`, toggle accessible name "Switch to light mode", and the
toggle's measured bounding box 44 x 44 px -- geometry, not a class-name assertion, which matters
because this repo has a recorded defect class of class-name assertions passing while the rendered
element was wrong.

Print verified through Playwright real print-media emulation on the landed tree, including
"no height-capped data table clips under the print medium" and "species-aggregate table is not
height-clipped when printed".

Detail and stated limits: `.../evidence/verification/browser-verification.md`.

## 5. NO DEPLOYMENT CLAIM

No deployed environment was exercised or verified by this lane. All runtime evidence is (a) local
build of merged main and (b) GitHub Actions CI on the PRs. There is no production or preview URL
evidence. Do not represent this lane as production-verified.

## 6. What was actually fixed (and why it was not already fixed)

The session inherited a checkpoint presenting both stacks as gated and merge-ready. Independent
review found THREE P1 defects that a full green six-gate battery had already passed, all of the
same class: a green suite coexisting with the silent loss of a correct regulatory disclosure.

1. `TWGReviewPortal.tsx` -- clicking Save Draft permanently destroyed the unknown-provenance
   disclosure that #788 exists to create, after which possibly-clipped review text could be
   submitted with no disclosure at all. Fixed by persisting the unknown-provenance set under its
   own storage key.
2. The cancelled-submit note occluded the Dismiss controls it instructs the reviewer to use, and
   nothing else clears the record. Fixed by bounding the note (`max-h-40`, `overflow-y-auto`,
   `tabIndex={0}`) and raising the reservation to `pb-72`, with the arithmetic documented in code.
3. The same disclosure was also erased by a FAILED save. Fixed by ordering the writes
   antidote -> poison -> draft, aborting the save on any failure.

Plus: the `unresolvedCensoring` argument at the `stats.ts` call site is now pinned by a test (before,
deleting it silently restored a false ProUCL provenance citation with every test still green), and
three regression tests that #787's rebase had deleted while their code remained were restored.

Process finding: `.github/workflows/ci.yml` has no `types:` key, so retargeting a stacked PR to
main emits `edited` and would NEVER fire the four required contexts. The inherited plan would have
left all four stacked PRs permanently blocked. Each stack was therefore merged bottom-up into its
parent branch so only the two base-main PRs merged into main; `gpt-5.6-sol` at xhigh judged this
"a legitimate exact-tip CI strategy rather than a gate bypass". A side benefit: #782 and #787 landed
atomically, so the main BRANCH never had an intermediate state containing #782 without #787.
That is a statement about git history, not about users: no deployment occurred, so actual user
exposure was never measured and is not claimed here.

## 7. Accepted deferrals -- none blocking, all owner-decided

1. **Theme cookie-less migration window.** A returning browser with `localStorage.theme='dark'` and
   no cookie yet gets ONE request with a wrong ThemeToggle accessible name; the bootstrap writes the
   cookie on that same visit and every later request is server-correct. Root cause: `layout.tsx`
   passes an authoritative `'light'` when the cookie is absent, so `seedTheme`'s DOM-class fallback
   at `ThemeContext.tsx:85` is unreachable in production. A fix would pass `undefined` when the
   cookie is ABSENT rather than present-and-light, which trades the wrong label for a first-render
   hydration mismatch -- a design decision, not a bug fix. Raised by the sol xhigh ship gate,
   confirmed as a code fact, and consciously accepted.
2. TWG: dismissing an unknown-provenance notice BEFORE any save is not durable; the next mount
   re-derives it. Over-warns only; cannot suppress a disclosure.
3. TWG: unpaired truncation marker -- if the unknown-provenance record is selectively lost while the
   truncation record survives, the disclosure is discarded. This is a CODE-PATH assessment, not
   deployment evidence: the state is not reachable from the landed main tree or by any ordinary
   single-tab sequence.
4. Pre-existing, untouched: the `stats.ts` statistical TREATMENT decision for an unresolved
   censoring row; cross-tab concurrent save; four BN-RRM findings (`RiskComparison.tsx:463` print
   clip, `:456` vs `:350` predicate mismatch, `BNRRMClient.tsx:438` count-after-slice,
   `memo-generator.ts` dead third-state guards); 26 remaining audit findings.

## 8. Rollback tags and hazards

    p787-prerebase-3a5eb26f  -> 3a5eb26fefaee9e7644dbca0a980987519b0069e   KEEP -- LOCAL ONLY
    p0-precommit-87b8d2c8    -> 87b8d2c82d0ade1f3208d01115a32f3eaccb20b8   KEEP -- LOCAL ONLY

Both tags exist ONLY in the local clone; `git ls-remote origin refs/tags/...` returns nothing for
either. They were deliberately not pushed (this preservation unit was scoped not to alter tags), so
unlike the rest of this package they do NOT survive loss of this machine. The commits they point at
are ancestors of `main`, so the history itself is safe on the remote either way; it is only the
named rollback labels that are local.

Both re-verified after the force-with-lease push of #787. `main` was never force-pushed. Every
pre-correction commit is an ancestor of its corrected tip, so nothing was lost by landing.

Retained branches: `trial/stackA2`, `trial/stackA3`, `trial/stackB2`, `landed/main-verify`.

**JUNCTION HAZARD -- read before any cleanup.**
`C:\Projects\SSTAC-Dashboard-worktrees\trial-refreeze-20260817` was created by this lane and its
`node_modules` is a JUNCTION to the shared store `C:\Projects\SSTAC-Dashboard\node_modules`
(721 entries at creation). A recursive delete or `git worktree remove` FOLLOWS the junction and
EMPTIES the shared store. Remove the junction first, verify with `Get-Item ... | LinkType` per item
(never a `dir /AL` count), confirm the shared store's child count is unchanged, then delete and
`git worktree prune`. Recovery if emptied: `npm ci` in the primary checkout. See L0 rule 1.15.

## 9. Durable evidence paths and hashes

Committed mirror (this branch): `docs/continuity/impeccable-frontend-20260817/`
Local authoritative checkpoint:
`C:\Projects\SSTAC-Dashboard-worktrees\triage-20260816\.tmp\mission-control\impeccable-frontend-20260817\`

    EVIDENCE_MANIFEST.json    48 entries, SHA-256 per file (authoritative count is the manifest's
                              own `file_count` field -- read it rather than trusting this line)
    EVIDENCE_SHA256.txt       the same hashes in sha256sum format, one line per entry
    CLOSEOUT_2026_08_17.md    the full closeout
    RESUME.md                 fresh-session entry point, lane status COMPLETE

Every manifest entry was verified to exist and to reproduce its recorded SHA-256, and the sha256sum
cross-check returned zero failures. Five third-party transcripts appear in the committed mirror as
ASCII-SANITIZED COPIES rather than verbatim bytes, to satisfy the repo's plain-ASCII rule. The
verbatim originals live only in the local checkpoint; their raw SHA-256 values are recorded in
`evidence/README.md` so those originals can be matched. `landed-print.pdf` is the
only manifest entry with no counterpart in the committed mirror, which `evidence/README.md` states.

Reviewer rounds were additionally logged to the codex re-review queue at
`C:\Users\jasen\.claude\projects\C--Projects-Regulatory-Review\memory\codex_rereview_queue_2026_05_17.md`.
That entry records explicitly that the sol xhigh ship gate RAN, so this lane is fully codex-gated
and is NOT a "luna GREEN, sol deferred on budget" case.

## 10. Reopening conditions

Open a NEW lane (do not reopen this one) if any of these becomes true:

- a wrong theme-toggle label is reported that does NOT self-correct on the next page load;
- a TWG reviewer reports a submitted comment that was silently shortened;
- a UCL result cites a ProUCL section for a dataset whose censoring status is not fully resolved;
- `censored` is made nullable in the schema (the exact event the fail-closed guard exists for; pair
  it with the deferred treatment decision);
- `ci.yml` gains a `types:` key or its trigger changes, invalidating the merge-strategy reasoning
  recorded here for any future stacked-PR family.

## 11. Content and deployment residuals

- Nothing in this lane touched Supabase, migrations, RLS, `v2_judgments`, `src/data/` catalogs, or
  any regulatory value. No verdict was ever written. No protected path was modified.
- The landed changes are frontend-only and are live on `main` but NOT verified in any deployed
  environment. If a deployment follows, re-verify the theme cookie path and the TWG truncation
  surfaces there before treating them as production-confirmed.

## 12. Process state

No session-owned processes remain. The local production server (port 3544) and the headless browser
were stopped and the port confirmed closed. Long-lived `codex` / `node` / `python` processes on this
machine belong to other live sessions and were never touched.
