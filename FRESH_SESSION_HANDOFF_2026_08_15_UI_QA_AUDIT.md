# FRESH SESSION HANDOFF -- 2026-08-15 -- UI/UX audit lane (Matrix Options Calculator)

Supersedes `FRESH_SESSION_HANDOFF_2026_08_09_SSTAC_CURRENT.md` as the current continuity anchor.
Worktree: `C:\Projects\SSTAC-Dashboard-worktrees\ui-qa-audit-20260814`
Branch: `feat/mo-calculator-tokens-20260814`, tip `666376b5`.

---

## 1. Where things stand

**BOTH PRs ARE MERGED. `origin/main` is `65228472`.**

**PR #778 MERGED** (merge commit `d87be2a1`, 2026-08-15 15:41 UTC). Keyboard access, write-failure
handling, a stuck calculation, calculator a11y announcements, and the authenticated Playwright
project. All 10 required CI checks passed before merge. Merged as a MERGE COMMIT rather than a
squash, deliberately: #779 stood on its six commits, and a squash would have replaced them with one
new commit whose content matched but whose history did not, conflicting on retarget. Result: 18
commits unique to #779, none duplicated.

**PR #779 MERGED** (squash, 2026-08-15 17:16 UTC). The Calculator redesign: staged derivation,
shared number formatter, responsive shell, Stage-3-gated reference rail, and all nine defect fixes.
All 11 required CI checks green. Squash was correct here because nothing was stacked on it once it
had been retargeted to main.

**CURRENT WORK: branch `feat/mo-design-batch-20260815`**, cut fresh off `65228472`. Implementing the
18 owner-decided UI items from `docs/UI_DECISIONS_2026_08_15.md` (15 DECIDED + 3 HYBRID). Decisions
#16, #18 and #20 are SKIPPED -- they are OPEN and await owner input; each is briefed in the
scratchpad `OPEN_QUESTIONS.md`.

---

## 2. What was built

- **Numbered four-stage derivation** with a four-state machine: COMPUTED / PENDING (nothing entered)
  / WAITING (blocked upstream) / BLOCKED (error is here). A blocked operand refuses to compute
  rather than quietly producing a number.
- **`src/lib/matrix-options/formatMagnitude.ts`** -- shared formatter. The previous display collapsed
  real screening standards to `0.0000`; the repo asserts values like 0.000098592 mg/kg dry. Its
  invariant, stated precisely: byte-identical to legacy `toFixed(4)` on the HALF-OPEN interval
  `[0.1, 1e9)` only. It deliberately diverges at and above 1e9 to bound display width.
- **Responsive shell (owner chose "Option A" from three rendered layouts):** three desktop zones
  stack to one column below `lg`; rails become drawers via the existing header toggles. Pure CSS,
  not a JS breakpoint, because the subtree is server-rendered before React attaches.
- **Reference rail follows Stage 3** per owner instruction. DERIVED
  (`calcRailOverride ?? backgroundReferenceNeedsAttention`), never effect-written, so the first
  frame paints correctly. A manual toggle sticks until the stage or pathway changes.

**Calculation integrity: `src/lib/matrix-options/derivations.ts` never appears in the diff.**
Confirmed independently by four reviewers, each re-deriving it rather than accepting the claim.

---

## 2b. Owner decisions ANSWERED 2026-08-15 (see docs/UI_DECISIONS_2026_08_15.md)

The owner reviewed all 21 batched design decisions and answered. 15 DECIDED, 3 HYBRID, 3 OPEN.

Two were resolved AGAINST the owner's first instinct, with the owner's agreement ("recommend best
options ... go with them for now"). Both are recorded in the decisions doc with rationale, because a
future reader would otherwise see the record contradicting the owner's stated choice:

- **#11 -> Option C.** The owner's "hamburger, too much content" reasoning describes a DIFFERENT
  surface: the authenticated dashboard header (`src/components/Header.tsx`, 15 links across 5
  categories), which already has a hamburger and is not part of this audit. Decision #11 is the
  PUBLIC logged-out landing page (`src/app/page.tsx:85-129`), which has exactly 3 cards and no
  volume problem at all.
- **#17 -> Option A layout, WITHOUT the requested colour inversion.** The owner asked for
  active=green / complete=blue. Rejected because `--db-pass` (green) already means "approved /
  passed / done" app-wide (`EvidenceLibrary.tsx:387-408`), and there is NO blue semantic token in
  the `--db-*` set at all -- the sky-blue currently marking "active" is a bare Tailwind default.
  A green "Active" chip would sit near the green "Approved" pills of decision #6 and read as
  finished. The owner's actual goal (active dominates, complete recedes) is met through WEIGHT and
  SATURATION instead.

SEPARATE, NOT DONE, needs its own scoping: the logged-out landing page has ZERO header navigation
(`page.tsx:9-16` is logo + theme toggle only).

## 3. OWNER DECISIONS WAITING (nothing proceeds on these without an answer)

1. **21 batched design decisions**, three rendered options each, both themes, desktop + 375px:
   https://claude.ai/code/artifact/1cdfb3db-a003-497b-b1e7-7f2284f91470
   Owner reviews once and answers in the form "3B, 7A, 12C".
2. **"Review candidate defaults" is now behind one extra click.** It lives inside the Value Search
   rail (`CalculatorValueSearchPanel.tsx:612`), which is now Stage-3-gated. The owner's instruction
   was about reference DATA; this is an ACTION. The e2e test was updated to open the panel first
   rather than relocating the control -- moving it is a product decision.
3. **The Stage-3 auto-open may be a no-op on phones.** Stacked, the rail sits ~11,000px BELOW the
   main content, so when Stage 3 becomes actionable nothing visible happens. Works as intended on
   desktop.
4. **Merge of #779.**
5. Pre-existing, unchanged: the site-comparison section's fate (owner said the meaningful comparison
   is against CSR Schedule 3.4, which is NOT in this codebase); exposure-factor bounds (inputs still
   accept a negative body weight); Protocol 28 preset sourcing.

---

## 4. THE LESSON OF THIS SESSION -- read before trusting a green gate

**Nine real defects were found. EVERY ONE passed a full green gate suite first. FIVE of them did not
corrupt a value -- they HID a correct one:**

1. Stage 3 reported COMPUTED from a UTL derived from an ACCEPTED SUBSET when reference tokens were
   rejected; that partial-set value flowed into `max(preliminary, UTL)` as the adjusted standard.
2. The entire Calculator rendered at ZERO HEIGHT below `lg` on a phone.
3. A `max-h-[2400px]` cap clipped Value Search results (no inner scroller to compensate).
4. The same cap truncated printed PDFs -- `lg:` is `min-width:1024px`, the print page box is smaller,
   so `lg:max-h-none` never applies in print.
5. A user-facing ACTION was sealed inside a panel gated on a data condition.

**Why the gates cannot see this class:** jsdom has no layout engine, so no unit test can observe
computed height. Lint and the build see class strings. `toBeVisible()` passes on a zero-height
ancestor. Gates prove nothing REGRESSED; they do not prove a NEW thing is right.

**Each round's fix created the next round's defect.** The zero-height fix introduced the height cap;
the cap fix introduced an inferred focus flag; the focus fix left a cross-engine gap. Review every
fix for what IT introduced, not only whether it closed the prior finding.

**The value-presence-infers-state anti-pattern recurred NINE times on this branch**, twice inside
code written to fix a review finding. Search for the PROPERTY, not the FORM you already saw -- two
sweeps scoped to the known shape each missed the next instance.

---

## 5. GATE HYGIENE -- two traps that made green meaningless

**`E2E_AUTH_ENABLED` must be set locally or the authenticated project silently never runs.**
`playwright.config.ts` requires it (`=== 'true'`) IN ADDITION to credentials. `.env.local` has the
credentials but not the flag; CI has it as a repo variable. A local run reported `132 passed` having
never executed `chromium-auth`. Correct command:

    $env:E2E_AUTH_ENABLED='true'; npm run test:e2e

Enabling it immediately failed `matrix-options.spec.ts:21` -- a real defect (item 5 above) invisible
until then. **Grep the e2e log for `chromium-auth` before quoting a pass count as evidence.**

**Stacked PRs get NO required CI.** `.github/workflows/ci.yml` triggers only on
`pull_request: branches: [main, develop]`. A PR based on a feature branch runs only the docs,
archive and secret-scan workflows -- Lint+TS, Unit, Build and E2E never fire. #779 sat "green" on
three irrelevant checks. Retargeting to main fires an `edited` event the workflow ignores; the
legitimate trigger is a real push (merge `origin/main` into the branch -- never an empty commit).

**Playwright's HTML reporter hung a background gate** on "Serving HTML report ... Press Ctrl+C".
Fixed at the config layer with `reporter: [['html', { open: 'never' }]]`.

---

## 6. Test discipline that must not be dropped

Falsify every regression test TWO-SIDED: break the guarded behaviour, confirm THAT test fails,
restore. This caught four vacuous tests that would otherwise have shipped as guards guarding nothing:

- A one-sided probe cannot fail a test asserting the opposite state. Force true AND false.
- RTL flushes passive effects inside `act()`, so a plain post-click assertion cannot see an
  open-then-close flash. A `MutationObserver` with `takeRecords()` can.
- **Assert on the element whose CSS property is implicated, never a descendant.**
  `getBoundingClientRect()` reports an element's own box and is unaffected by an ancestor's overflow
  clipping: a descendant measured 3681px tall while the defect was fully present; the squeezed flex
  item measured 32px.
- jsdom does not implement `HTMLElement.inert` (TypeScript still declares it `boolean`, so tsc
  cannot see it either). Deleting an `.inert`-reading guard passes every unit test while breaking
  every real browser. When a branch is untestable at a layer, SAY SO.

---

## 7. Review pipeline as actually run

| Leg | Result |
|---|---|
| Leg 1 (Opus) rounds 1-3 | RED -- each found a real defect |
| Leg 1 round 4 + delta round | GREEN |
| cursor `--model auto` (free) | GREEN on rounds 2 and 3, but MISSED what cross-engine probing found |
| codex spark (grind) | GREEN after withdrawing a scope-error P1 |
| codex luna (ship gate) | GREEN, 29 reads, no findings |

A reasoning-only GREEN is not an independent strong gate. Leg 1 round 3 settled the decisive
questions by PROBING three browser engines rather than recalling: `focusout` does not fire in
Firefox/WebKit when a focused element is removed from the DOM, and `inert` does not blur
synchronously in any engine.

The grind tier's P1 was disputed with evidence and formally withdrawn -- it had reviewed the files'
current state rather than the unstaged diff, attributing an already-gated commit to this round.
Mutual agreement means arguing back, not silent acceptance, in BOTH directions.

---

## 8. Next work, in the agreed sequence

References & Values, Interactive Map, SSD Workbench, The Guide, Methodology by pathway, Conceptual
Model, TWG Review. Each gets the same treatment: audit, then three RENDERED options for the owner to
choose between. Phone support is a stated requirement, not an afterthought.

Deferred and tracked: a `side-tab` accent-border AI tell on Jurisdictional Frameworks (now an option
set in the batched decision page). Unconfirmed P3: `focus({ preventScroll: true })` may leave the
rescued toggle off-screen HORIZONTALLY at 375px, since the header is `overflow-x-auto` and the
toggle sits at its right edge; the targeted fix if ever needed is `scrollIntoView({ block: 'nearest',
inline: 'nearest' })` after the focus call.

Two `gray-on-color` design-hook findings on the panel toggles are known FALSE POSITIVES (the
detector pairs the inactive-state gray with the active-state sky ground; they never co-occur). They
are left UN-SUPPRESSED on purpose -- the ignore-value shape was guessed wrong twice, and a
too-broad entry would blind the detector to genuine contrast defects.
