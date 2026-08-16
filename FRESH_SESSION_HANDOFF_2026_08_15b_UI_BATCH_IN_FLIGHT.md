# FRESH SESSION HANDOFF -- 2026-08-15b -- UI/UX design batch 1 IN FLIGHT (uncommitted)

Supersedes `FRESH_SESSION_HANDOFF_2026_08_15_UI_QA_AUDIT.md` as the current continuity anchor.
That predecessor is NOT obsolete -- its sections 4-7 (the gate-hygiene lessons) are restated and
extended below because they still govern this branch. Read this file fully before touching the
working tree.

Worktree: `C:\Projects\SSTAC-Dashboard-worktrees\ui-qa-audit-20260814`
Branch: `feat/mo-design-batch-20260815`, cut fresh off `origin/main` at `65228472`.

---

## 1. Where things stand right now

`origin/main` is `65228472`. **PR #778 and PR #779 are BOTH MERGED.** #778 landed as a genuine
merge commit (`d87be2a1`) deliberately, to protect the then-stacked #779's 18 commits from a
squash-induced retarget conflict. #779 landed squashed once nothing was stacked on it. Nothing
about that history needs revisiting.

**Current branch `feat/mo-design-batch-20260815`** implements the 16 owner-DECIDED/HYBRID UI
items (of 21 total; #16/#18/#20 were OPEN at plan time and explicitly skipped) from
`docs/UI_DECISIONS_2026_08_15.md`, partitioned per `docs/UI_BATCH_PLAN_2026_08_15.md` into three
file-disjoint groups (A: Interactive Map: B: References & Values + shared scroll affordance; C:
SSD Workbench + Conceptual Model + Landing Page), then hardened through two rounds of adversarial
review fixes.

**40 files are UNCOMMITTED in the working tree right now.** This is deliberate, not an accident
or lost work: the commit protocol (`docs/GATE_MODE_SOP.md` + this repo's ship-protocols skill)
requires an adversarial `/codex-review` loop to mutual-agreement GREEN BEFORE a commit is made,
and Leg 1 (Opus adversarial review) round 3 was still running at the moment this handoff was
written. Do not `git stash`, `git checkout --`, `git clean`, or otherwise discard this tree. Do
not re-run the batch from scratch -- it is finished and gated, only the commit-time review is
incomplete.

**All six gates are green on this exact uncommitted tree** (see section 3). The file set was
verified byte-for-byte unchanged from the start to the end of that six-gate run.

---

## 2. What a fresh session must do first

1. `git status --short` and confirm the same ~40 files are still uncommitted, matching the diff
   described in `docs/BATCH_REPORT_GROUP_A.md`, `_B.md`, `_C.md` (read `_C.md`'s CORRECTION
   section -- see section 6 below), `docs/BATCH_FIXES_ROUND1.md`, `docs/BATCH_FIXES_ROUND2.md`.
   Do not assume the tree is clean or that a prior session's work is gone just because you don't
   remember it.
2. Resume/finish Leg 1 (Opus adversarial review) round 3 on the current diff. If it returns RED,
   fix the finding, then re-run Leg 1 from round 1 is NOT required -- continue the round sequence,
   but re-verify the specific claim that was RED.
3. Once Leg 1 is GREEN: run the codex grind tier (`gpt-5.3-codex-spark` or `gpt-5.4-mini` fallback
   per L0 section 1.3), then the codex ship gate (`gpt-5.6-sol` at `model_reasoning_effort=xhigh`,
   pinned explicitly -- do not trust "the default"). Both must return GREEN with no unresolved
   P0/P1/P2 before commit.
4. Only then commit (path-scoped staging, never `git add .`/`-A`/`-u`) and run the full push
   protocol (lint, unit, monitored build, e2e -- see `docs/GATE_MODE_SOP.md`).
5. Do NOT fold batch 2 (section 5 below) or the N1/N2 typography batch (section 5) into this
   commit. Land this batch first.

---

## 3. Gate evidence on the current uncommitted tree

- `npm run lint`: 0 errors, 76 warnings (matches the stated repo baseline exactly; a transient
  77th warning was caught and removed during round 2).
- `npx tsc --noEmit`: clean, no errors in any touched file.
- Unit tests (`npm run test:ci` equivalent scoped run): 352 files / 6756 tests passed.
- `npm run build:monitored:clean`: exit 0.
- e2e (`npm run test:e2e` with `E2E_AUTH_ENABLED=true`): 159 passed. `chromium-auth` project
  CONFIRMED present in the log (grepped, not assumed -- see section 4 item 2 for why this check
  is load-bearing).
- Docs gate: PASS.
- File set integrity: verified UNCHANGED from the start of this six-gate run to its end (no
  agent silently touched a file mid-gate).

This is real evidence for THIS tree at THIS moment. It does not substitute for the Leg 1 / codex
review still owed before commit (section 2). A green gate suite has repeatedly proven insufficient
on this branch -- see section 4.

---

## 4. What a fresh session will get wrong without being told

1. **Gates are structurally blind to a whole defect class.** On the predecessor branch (before
   this one), nine defects all passed a full green gate suite; five of them did not corrupt a
   regulatory value, they HID a correct one. jsdom has no layout engine: `toBeVisible()` passes on
   a zero-height ancestor, and lint/build only ever see class strings, never rendered geometry.
   Every "NEEDS BROWSER VERIFICATION" note left in `docs/BATCH_REPORT_GROUP_A.md` / `_B.md` /
   `_C.md` is real and still open -- 44px tap targets, sticky-column behavior, scroll-fade
   appearance/disappearance, print clipping, and toolbar overlap at 375px/768px have NOT been
   confirmed in a real browser on this batch. Do that before telling the owner this is done.
2. **`E2E_AUTH_ENABLED` must be set locally** (`$env:E2E_AUTH_ENABLED='true'; npm run test:e2e`)
   or the authenticated Playwright project is never created and every auth-gated spec silently
   skips while the run still reports "N passed." Grep the e2e log for `chromium-auth` before
   quoting any pass count as evidence -- this exact trap produced a false-green report on the
   predecessor branch.
3. **Run e2e with `--workers=4`.** At the Playwright default of 10 workers against a single
   `next dev` server on this machine, consecutive runs failed 2, then 10 DIFFERENT tests, purely
   from contention. The same spec passed 15/15 at 1 worker. 4 workers is the balance that has been
   validated; don't "fix" a flaky e2e failure by assuming it's a real regression before checking
   worker count.
4. **Stacked PRs get NO required CI.** `.github/workflows/ci.yml` triggers only on
   `pull_request: branches: [main, develop]`. A PR based on a feature branch (not main/develop)
   only runs docs/archive/secret-scan workflows -- Lint+TS, Unit, Build, and E2E never fire, and
   the PR can sit "green" on checks that prove nothing. Not directly relevant until this batch is
   pushed, but do not repeat the mistake of treating a stacked-PR green as real CI evidence.
5. **The fix-creates-defect pattern recurred on THIS batch, not just the predecessor.** Round 1's
   fixes to P1-1 (sticky column), P2-2 (print clipping), P2-3 (ScrollFadeRegion effect deps), and
   P2-4 (matchMedia listener) each introduced or left open a NEW defect that round 2 had to find
   and fix -- see `docs/BATCH_FIXES_ROUND2.md`'s "What the reviewer got wrong" section for the two
   places round 1's own diagnosis was itself partly incorrect. Review every fix for what IT broke,
   not only whether it closed the prior finding.
6. **Fix the CLASS, not the instance.** Round 1 restored one deleted word ("Indigenous") from a
   copy rewrite in `ConceptualMatrix.tsx`. Round 2 discovered that same rewrite pass had silently
   dropped substantive terminology from THREE other cards plus a hero sentence on the landing page
   -- see the full inventory table in `docs/BATCH_FIXES_ROUND2.md` P1-1. Every user-facing copy
   change in a diff must be checked against `git diff HEAD`, not spot-checked from memory of what
   "looked wrong."
7. **Two-sided falsification is mandatory** on every regression test added to this batch: break
   the guarded behavior, confirm THAT specific test fails with a readable diff, then restore and
   confirm green again. This caught several vacuous tests on this batch alone, including a
   `ProjectPhases.test.tsx` color assertion (`not.toMatch(/bg-blue-/)`) that could never fail in
   either direction because the real chip is `bg-sky-600`, not literally "blue" -- see round 1's
   "Tests that didn't discriminate" section.
8. **Plan/report line citations drift as files change.** The batch plan doc itself flags this
   (e.g. its speculative `isMobile` line-1814 citation for MatrixMap.tsx, which Group A's
   implementer grepped and found did not exist). Verify against the actual current file before
   editing at a cited line; do not trust a line number carried over from an earlier read.

---

## 5. Owner decisions -- status, precisely

### Batch 1 (this branch, in flight) -- 16 decided/hybrid items
Fully described in `docs/UI_DECISIONS_2026_08_15.md` and implemented per group reports. Do not
reopen; do not re-litigate #11 or #17's resolved-against-first-instinct rationale (both are
recorded there with the reasoning a future reader needs).

### Batch 2 -- DECIDED, own commit, do NOT fold into batch 1
Recorded in the session scratchpad `DECISIONS_ROUND2_APPROVED.md` (owner replied "Recommendations
approved" on every item; not yet copied into a repo doc -- do that as part of implementing this
batch, folding it into `docs/UI_DECISIONS_2026_08_15.md`):
- **#16** -- option (b): scope the duplicate-H1 fix to the methodology tab only, not a global
  `MathRenderer` change (protects the Jermilova review portal's own document heading).
- **#18** -- option (a): move Log In / Create Account into the header.
- **P1** ("Review candidate defaults" behind the Stage-3 gate) -- option (b): surface it in the
  calculator body so it is always reachable. **This REVERSES a consequence of the owner's earlier
  Stage-3 gating instruction** -- the gating of reference DATA stands, only this ACTION moves out
  from behind it. `e2e/matrix-options.spec.ts:21` was previously edited to open the panel first as
  a workaround for the gating; that step must be REMOVED when P1 lands or the test asserts a flow
  the product no longer has.
- **P2** (Stage-3 auto-open is a no-op on phones) -- option (b): a short inline Stage-3 hint in
  the main column on narrow screens. Flagged to the owner as a WEAK recommendation and approved
  anyway -- all three options were compromises (the rail sits ~11,000px below the main content
  when stacked); this one is cheap and reversible if it reads as clutter in practice.
- **#20** -- option (a): fix BOTH padding layers (`MatrixDashboard.tsx:2234` outer wrapper AND
  `:1395` per-section `cardClassName`), not just the outer one a literal reading of option A
  implies.

### N1/N2 typography batch -- DECIDED, own batch, touches every surface
Recorded in the session scratchpad `DECISIONS_N1_N2_APPROVED.md` (not yet copied into
`docs/UI_NEW_FINDINGS_2026_08_15.md` -- do that as part of implementing this batch):
- **N1** = option C: re-derive the 11 pastel gradient patterns from the app's `--db-*` palette.
  **BINDING CONSTRAINT: implement as TOKENS** (e.g. `--db-gradient-*` with light AND dark values
  defined together in the token layer), **NOT as Tailwind utility classes plus a hand-maintained
  dark-mode override list** -- the whole risk argument for choosing C over flattening depends on
  this. Scope is small: only 3 of the 11 listed patterns are actually in use (~14 sites,
  concentrated in survey-results); the other 8 are dead CSS whose override rules should be
  removed too.
  **MUST ALSO FIX regardless of sequencing:** `purple-50 via-violet-50 to-sky-50` and
  `green-50 via-emerald-50 to-teal-50` are not covered by the dark-mode override at
  `globals.css:158-169` AT ALL and render pastel in dark mode right now. That is a live defect,
  not a preference to weigh.
- **N2** = **Public Sans**, self-hosted via `next/font`. Never a linked webfont/CDN URL -- the
  app's CSP would silently fall back and the chosen face would never render.
- **N2b** = regulatory VALUES render in Public Sans with `font-variant-numeric: tabular-nums`
  (not monospace -- tabular figures, not fixed-width glyphs, are what column alignment actually
  needs). Monospace is RETAINED only for identifiers/keys a user might copy or retype (e.g.
  `rfc_inhalation_mg_per_m3`, `src-health-canada-trv-v4-2025`) and raw unrendered LaTeX source.
  Audit every `font-mono` usage in `src/` and classify VALUE vs IDENTIFIER/SOURCE before changing
  anything; `EvidenceLibrary.tsx` and the calculator value renderers are the primary VALUE sites.
  Do not change any displayed value, unit, or rounding while doing this -- verify by diffing
  rendered text, not just class names. Check column widths after the change (a proportional face
  is narrower than monospace for the same digit count; note batch 1 already widened the value
  column from 9% to 16% for an unrelated overlap defect, per round 2's P2-5).
- Downloaded font specimen files used to produce the owner's comparison page live in the session
  scratchpad under `fonts/` and will NOT survive session/scratchpad cleanup -- re-download from
  jsdelivr fontsource if needed for the actual N2 implementation.

### Still open, unanswered
- **P2-1**: 41 rows in the References & Values table are both `qa_status=superseded` and
  `evidence_support_status=approved_source_backed`, showing two green-reading indicators with the
  warning demoted to 12px grey text. Suggested fix inside decision #6: tone that line amber for
  `needs_review`, rose for `superseded`. Asked of the owner twice; unanswered both times. The
  current `EvidenceLibrary.test.tsx` assertion covering this combination is marked PROVISIONAL in
  a code comment per round 2 -- it pins current rendering only and must not be cited as evidence
  the behavior is agreed.
- Permission widening in `.claude/settings.local.json` -- the auto-mode classifier correctly
  blocked the assistant from doing this itself; still needs the owner or `/update-config`.
- Site-comparison section's fate (owner said the meaningful comparison is against CSR Schedule
  3.4, which is NOT in this codebase).
- Exposure-factor bounds (inputs still accept a negative body weight).
- Protocol 28 preset sourcing.
- The logged-out landing page has NO header navigation at all (`page.tsx:9-16` is logo + theme
  toggle only) -- surfaced by decision #11's analysis, explicitly out of scope there, needs its
  own scoping if the owner wants it addressed (note: batch 2's #18 header-auth-links decision will
  add SOME header content to this page, but a full nav bar is a separate, larger call).

---

## 6. The Group C stall-and-overwrite incident -- read before trusting anything in `BATCH_REPORT_GROUP_C.md`

The original Group C agent appeared stalled for 92 minutes with no file writes and no report. Its
work was treated as abandoned and completed by two replacement agents. The ORIGINAL agent then
returned roughly 2.5 hours later and OVERWROTE `docs/BATCH_REPORT_GROUP_C.md` with its own account
of what it had done -- an account that is WRONG about what actually shipped for decision #1c
(Endpoint filters). No source code was corrupted (all writes landed in a verified sequence; only
the report doc was clobbered), but the report itself was silently wrong until a CORRECTION section
was appended.

**Read the CORRECTION section at the bottom of `docs/BATCH_REPORT_GROUP_C.md` before trusting its
`#1c` section.** What actually ships: a `<details>` disclosure with a `min-h-[44px]` `<summary>`
plus a checkbox `<fieldset>` for the multi-select Endpoint filters, coexisting with a uniform 44px
floor on the shared `ToggleButton` component for the other three (single-select) groups.

**Process lesson, restated because it will recur:** "no file writes for N minutes" is not evidence
an agent has terminated. Confirm a background worker has actually stopped (task status, process
table, or an explicit termination signal) before dispatching a replacement onto the same files. It
was harmless this time because the writes happened to land in a verifiable sequence; it will not
always be harmless.

---

## 7. Artifact URLs the owner is using

- Batched design decisions (the 21-item spec, three rendered options each):
  https://claude.ai/code/artifact/1cdfb3db-a003-497b-b1e7-7f2284f91470
- Phone/round-2 decisions page: https://claude.ai/code/artifact/f5bd2acb-5f89-41a4-8557-3ab6253a0edb
- Colour/gradient options (N1): https://claude.ai/code/artifact/5f16d4d3-df73-41ba-811e-f9ec22884516
- Typeface specimens (N2): https://claude.ai/code/artifact/802f128f-026c-43eb-865c-39f964745fc0
- **NOTE:** the N2 half of an EARLIER artifact,
  https://claude.ai/code/artifact/b5000b57-fca5-421e-a057-bc0be5203e88, is SUPERSEDED -- it shows
  system font stacks, but the real decision (Public Sans, self-hosted) came from the later
  typeface-specimens artifact above. Do not resurface the superseded one as if it were current.

---

## 8. Next work after batch 1 lands, in the agreed sequence

1. Land batch 1 (this branch): finish Leg 1, codex grind, codex ship gate, commit, push, PR, CI
   green, owner merge.
2. Implement batch 2 (section 5) as its own PR.
3. Implement the N1/N2 typography batch (section 5) as its own PR -- needs its own gate run and
   review given it touches every surface in the app.
4. Continue the view-by-view audit sequence stated in the predecessor handoff: References &
   Values, Interactive Map, SSD Workbench, The Guide, Methodology by pathway, Conceptual Model,
   TWG Review. Each gets: audit, then three RENDERED options for the owner to choose between.
   Phone support is a stated requirement, not an afterthought.

Deferred and tracked, unchanged from the predecessor handoff: a `side-tab` accent-border AI tell
on Jurisdictional Frameworks (now an option set in the batched decision page, unresolved). Two
`gray-on-color` design-hook findings on `MatrixDashboard.tsx` panel toggles (currently ~L1818 and
~L1832, line numbers drift as the file changes) are known FALSE POSITIVES -- the detector pairs
the inactive state's gray text with the active state's sky background, which never co-occur. Left
UN-SUPPRESSED on purpose: the ignore-value shape was guessed wrong twice already, and a too-broad
entry would blind the detector to genuine contrast defects. Three lines of hook output per turn is
the cheaper price.

---

*Authored 2026-08-15. Predecessor: `FRESH_SESSION_HANDOFF_2026_08_15_UI_QA_AUDIT.md`. References
L0: `C:\Projects\CLAUDE.md`. Project L1: `CLAUDE.md`. Gate SOP: `docs/GATE_MODE_SOP.md`.*
