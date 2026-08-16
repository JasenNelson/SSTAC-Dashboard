# FRESH SESSION HANDOFF -- 2026-08-15c -- batch 1 gated, reviewed, ready to ship

Supersedes `FRESH_SESSION_HANDOFF_2026_08_15b_UI_BATCH_IN_FLIGHT.md`. That file's sections
4 and 6 (gate-hygiene lessons, the Group C overwrite incident) still apply and are not
repeated here.

Worktree: `C:\Projects\SSTAC-Dashboard-worktrees\ui-qa-audit-20260814`
Branch: `feat/mo-design-batch-20260815`, cut from `origin/main` at `65228472`.

---

## 1. STATE: BATCH 1 IS SHIPPED

| Branch / PR | State |
|---|---|
| `feat/mo-design-batch-20260815` -> **PR #781** | **SHIPPED.** Commit `370d756a`, 51 files, pushed. Six review rounds, all gates green. |
| `docs/guide-roadmap-20260815` -> **PR #780** | PUSHED. Owner's Guide roadmap edits + the stale-tab-reference fix. |
| `feat/section-b-wave0-20260815` | B14 (ThemeToggle 40->44px) done, tested, falsified. **UNCOMMITTED -- commit this early.** |

**MERGE ORDER MATTERS: #780 must merge before or alongside #781.** #781 renames the
"Conceptual Model" tab; #780 carries the Guide content fix that stops the Guide pointing
at a tab that no longer exists. Merging #781 alone leaves user-facing copy naming a
nonexistent tab.

**Do not `git stash`, `checkout --`, or `clean` any of these worktrees. Do NOT recursively
delete a worktree** -- `node_modules` is a JUNCTION into the main checkout and a recursive
delete follows it and empties the shared store (L0 1.15; it has happened three times in
this project). Remove the junction first, verify, then delete.

## 2. IMMEDIATE NEXT STEPS

1. Watch CI on **#781** and **#780**; merge #780 first (or together).
2. Commit and push `feat/section-b-wave0-20260815` (B14) so it is not lost.
3. Then pick up section 8. Nothing else is in flight.

Gate evidence for #781 (already run, tree hash verified unchanged): lint 0 errors / 76
warnings, tsc clean, unit **6782 passed** across 353 files, monitored build clean, e2e
**160 passed / 0 failed** with `chromium-auth` confirmed present.

## 3. WHAT BATCH 1 CONTAINS

18 owner-decided UI items, plus everything four adversarial review rounds found. Highlights
of what was FIXED beyond the original 18:

- **Regulatory equation corruption (catalog edit, owner-approved).** Decision #8 routed
  `equation_latex` through KaTeX, but 3 of 5 catalog entries were not valid LaTeX -- bare
  multi-character subscripts. `IR_sed` typeset as "IR" subscript-s plus a literal "ed";
  same for `AF_sed`, `C_tissue`, `IR_food`, `BSAF_effective`. The old `<pre>` had rendered
  them correctly, so the decision silently corrupted variable names on the derivation
  equations. Fixed by bracing the subscripts and using `\log`. **Encoding only -- no
  number, symbol, operator or structure changed**, verified token-by-token. Guarded by
  `equationCatalogLatex.test.ts` (no bare multi-char subscripts, `\log` usage, brace
  balance, equation_latex == value_text, and fixture/catalog drift).
- **Decision #3's axis colour encoding never rendered.** All four Vision quadrants painted
  identical slate: all-sides `border-emerald-600` lost to CARD's `border-slate-200` under
  plain template-literal composition (no twMerge), decided by stylesheet order. Fixed with
  directional `border-t-*`. Browser-verified in BOTH modes (light emerald-600/sky-600;
  dark emerald-400/sky-400).
- **Print leak**: screen-only fade gradients and the "Swipe to see more" caption were
  printing onto paper over the very tables a prior fix had stopped clipping.
- **WCAG contrast**: Active chip was 2.77:1 dark / 4.09:1 light. Now sky-700 both modes,
  browser-measured at **5.86:1**.
- **Decision #1a's missing half**: the zoom/layer stack had the 44px floor but no visible
  labels -- `title` tooltips do not exist on touch devices. Now In/Out/Fit/Layers/Export.
- **Vision page** (#22): `ConceptualMatrix` rewritten from a decorative numbered 2x2 into
  a content-bearing matrix with rendered axis labels, collapsible detail, the three-part
  Schedule 3.4 structure, and compressed Phase 2 objectives. Tab renamed to "Vision for
  Modernizing Schedule 3.4". Sourced from the SABCS project plan sections 1.2/1.3/1.4.
- Sticky-column opacity, MathRenderer memoization, tabpanel `tabIndex` per APG, and a
  render-time `throw` replaced with a visible placeholder cell.

Full detail: `docs/BATCH_FIXES_ROUND4.md`, `docs/UI_DECISIONS_2026_08_15.md` (#22 and the
#1 amendment), `docs/UI_AUDIT_2026_08_14_RECONCILIATION.md`.

## 4. OWNER DECISIONS MADE THIS SESSION

- P2-1: amber for `needs_review`, rose for `superseded`; keep the green provenance pill.
- #22: the whole Vision page rebuild, revised three times to the owner's direction.
- #1b/#1c: ACCEPT the "bigger, not collapsed" deviation; recorded in the decisions doc.
- #16: fix the duplicate H1 at BOTH surfaces (methodology tab AND The Guide).
- P1 receipt: lift `candidateReviewedAt` to the shared parent (option B).
- Exposure factors: definitional bounds + refuse-to-compute -- **BUT SEE SECTION 5, the
  premise behind that decision was wrong and it needs re-deciding.**
- `find()`: visible placeholder cell instead of a render-time throw. DONE, in batch 1.

## 5. WHAT A FRESH SESSION MUST NOT REPEAT

**A false-green gate harness.** Gate commands were written as
`<cmd> | tail -N; echo "EXIT=$?"`. In a pipeline `$?` is the exit status of `tail`, which
always succeeds -- so the harness printed `E2E_EXIT=0` while a Playwright test was failing
in the same log. **Never pipe a gate command through `tail`.** Redirect to a log, read the
tail from the file, and corroborate every exit code with a pass COUNT.

**I gave the owner a false premise.** I told them exposure-factor inputs "accept any value
at all, including a negative body weight". **That is wrong.** Every exposure factor already
routes through `positiveInput()` (`HHDirectContactCalculator.tsx:330-338`), which rejects
<= 0 and non-numeric and returns a named error (`parseDecimal.ts`), and there is an
existing test covering it. The audit was describing the MARKUP (no `type`/`min`/`max`) and
I generalised it into a data-integrity claim without reading the code. The owner approved a
batch that is ~70% already built. **Correct this before any exposure-factor work.**
What is genuinely missing: upper bounds (`1e9` really does pass -- `positiveInput` has no
ceiling), `EF <= 365`, `ED <= AT`, the fraction/probability ceilings (`abs_dermal <= 1`,
`ba_oral <= 1`, `targetRisk <= 1`), and `type="number"`/`inputMode` for mobile keyboards.
Note there are ZERO `<form>` elements in these calculators, so `min`/`max` attributes would
never fire native validation at all.

**TWO OTHER DOCS STILL CARRY THE DEBUNKED CLAIM -- fix or ignore accordingly:**
`docs/UI_AUDIT_2026_08_14_RECONCILIATION.md` (Section D) states verbatim that a negative
body weight "flows straight into a screening value". The `1e9` half is true; the negative
half is FALSE. `docs/EXPOSURE_FACTOR_BOUNDS_SPEC.md` now carries a STOP banner at the top
correcting itself, but its body below that banner still reflects the original premise --
read the banner, not the body. Field count is **30**, not the 23 the spec enumerates (it
lists only the testid'd ones).

**Falsify BEFORE believing, not after.** Three tests written this session passed on first
run and then FAILED falsification. Worst case: the decision-#3 colour test asserted
`/border-emerald-600/` -- the class string -- and passed while the colour was overridden and
never rendered. It certified the exact defect it was written to prevent. Write the
assertion, break the code, watch it fail, THEN fix.

**A frozen tree must be a mechanism, not an intention.** Three gate runs were invalidated by
editing the tree mid-run (twice by writing a doc, once by a fix). The hash is now persisted
to `.tmp/gate-logs/FROZEN_HASH.txt` -- compare against it before quoting any gate result.

**Leg 1 is an iterative loop and a precondition.** Codex was launched twice before Leg 1
returned GREEN; the hook caught it both times. Rounds 1 and 2 both returned RED with real
findings, so the round that validates your fixes is the one most likely to find something.

**Review calibration.** Across four rounds, the confidently-argued architectural findings
were the FALSE ones (twice: "display equations lose their left half", disproven by three
independent geometry measurements). The REAL findings were quiet specifics: a translucent
background, a CSS class-order override, malformed data, a stale doc reference. Weight
accordingly.

## 6. GATE + REVIEW INVOCATIONS

```
# gates -- NEVER pipe through tail
npm run lint                > .tmp/gate-logs/g-lint.log 2>&1;  echo "EXIT=$?"
npx tsc --noEmit            > .tmp/gate-logs/g-tsc.log  2>&1;  echo "EXIT=$?"
npm run test:ci             > .tmp/gate-logs/g-unit.log 2>&1;  echo "EXIT=$?"
npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10 > ... ; echo "EXIT=$?"
E2E_AUTH_ENABLED=true npm run test:e2e -- --workers=4 > ...; echo "EXIT=$?"
```
E2E: the env var is REQUIRED or the authenticated project silently produces zero tests --
grep the log for `chromium-auth` (expect ~24 refs) before quoting a pass count. Use
`--workers=4`; the default 10 causes contention failures. One flake was observed and
disproven by a clean re-run. Playwright uses port 3100 and starts its own server, but
`build:monitored:clean` WIPES `.next` -- stop any dev server on 3000 before building.

```
# codex, after Leg 1 is GREEN
codex review - -c model="gpt-5.3-codex-spark" -c windows.sandbox="unelevated" < input.txt
codex review - -c model="gpt-5.6-luna" -c model_reasoning_effort=high -c windows.sandbox="unelevated" < input.txt
```

Baselines (from `.tmp/gate-logs/g6-*`, the final run on the shipped tree): lint 0 errors /
**76 warnings** (a 77th means you added one). Unit **6782 passed** / **353 files**. E2E
**160 passed / 138 skipped**, `chromium-auth` ~25 refs.

## 7. FOR THE PR BODY -- state these plainly, do not overclaim

- The catalog edit is encoding-only, owner-approved, token-identity proven. It arguably
  belongs in its OWN PR (different review standard: regulatory data reviewed for
  meaning-preservation, not UI correctness). Strongly consider extracting it.
- **Print was verified at the CSS-RULE level only** (`.print\:hidden { display:none }`
  exists). The rendered print output has NOT been checked.
- **Unverified**: sticky-column behaviour in a browser; whether KaTeX fits the narrow
  drawer (decision #8's own "confirm" instruction); the tab bar at 768/1024.
- Verified in a real browser: contrast 5.86:1; matrix geometry at 1440 and 375; zero
  horizontal overflow at 375; the 44px disclosure; zoom-stack labels at 48x46; axis colours
  in BOTH light and dark.

## 8. NEXT WORK, PLANNED AND READY

Full execution plans are COMMITTED in `docs/` (they were in the session scratchpad and
would not have survived migration):
- `docs/NEXT_BATCHES_PLAN_2026_08_15.md` -- batch 2 (5 items) + Section B (14 items, 4
  waves), with corrected line numbers and both owner decisions recorded.
- `docs/DEFERRED_TRIAGE_2026_08_15.md` -- 6 fold-forward items, 3 needing scoping, and the
  systemic recommendation to bake print-safety into `ScrollFadeRegion` itself.
- `docs/EXPOSURE_FACTOR_BOUNDS_SPEC.md` -- **RESCOPE FIRST per section 5**; the premise it
  was written against was wrong.
- `docs/UI_AUDIT_2026_08_14_RECONCILIATION.md` -- which audit items are done vs never
  scheduled.

1. **Batch 2** -- #16 (both surfaces), #18, P1, P2, #20. ONE PR: four of five touch
   `MatrixDashboard.tsx`. Every line number in the old docs has DRIFTED; re-read first.
2. **Section B** -- 14 landing-page audit requirements, never scheduled. Wave 0 (B14 done,
   B11 theme-flash -- CSP already allows inline scripts) has zero collision. Waves A/B are
   blocked on batch 1 merging. **B4's two contrast failures are STILL OPEN** at 3.07:1 and
   2.45:1; the Active-chip fix was a different issue.
3. **Deferred triage** -- 6 fold-forward items. Systemic recommendation: bake print-safety
   into `ScrollFadeRegion` itself rather than patching callers (three caller-side print gaps
   were found in one day).
4. **Exposure-factor bounds** -- RESCOPE first (section 5), then implement.

## 9. STILL OPEN FOR THE OWNER

- Upper plausibility ranges per exposure factor (the genuinely owner-gated half).
- Whether to extract the catalog edit into its own PR.
- Section B Wave C: `/contact` and `/accessibility` routes do not exist; creating them is
  new surface area needing an auth-gating decision.

---

*Authored 2026-08-15. Predecessor: `FRESH_SESSION_HANDOFF_2026_08_15b_UI_BATCH_IN_FLIGHT.md`.
L0: `C:\Projects\CLAUDE.md`. L1: `CLAUDE.md`. Gates: `docs/GATE_MODE_SOP.md`.*
