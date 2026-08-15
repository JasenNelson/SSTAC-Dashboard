import { expect, test } from '@playwright/test';
import { clickUntilVisible, gotoMatrixOptionsOrSkip } from './fixtures/matrix-options-nav';

// D3 regression guard (2026-08-15 adversarial review): the original P1 defect
// (main column collapsing to zero height on a phone, hiding every stage and
// the adjusted standard) was fixed by scoping one class on the Calculator's
// main content column -- `overflow-y-auto` -> `lg:overflow-y-auto` -- because
// an unscoped overflow-y-auto gives that flex-1 column an automatic minimum
// size of 0 per CSS Flexbox 4.5, and with both rails flex-shrink-0 and the
// shell height definite, the column was squeezed to near-zero px. Nothing
// guarded that fix: no existing e2e spec sets a phone viewport (`grep -r
// '375|viewport' e2e/` returned nothing before this file), so a future
// refactor that re-adds an unscoped overflow reproduces the defect and every
// gate stays green.
//
// IMPORTANT (found while writing this spec, verified empirically by
// temporarily reverting the fix and logging real numbers): `toBeVisible()`
// does NOT catch this bug, as the finding predicted -- but neither does a
// naive `boundingBox().height > 0` on a DESCENDANT of the squeezed element
// (e.g. the `hh-direct-contact-calculator` calculator body, or the summary
// bar's adjusted-standard chip). `getBoundingClientRect()` (what
// `boundingBox()` calls) reports an element's own LAYOUT box, which is
// computed from its own content/flow and is NOT reduced by an ANCESTOR's
// overflow:auto clipping -- overflow only affects painting/scrolling of the
// ancestor, not the descendant's intrinsic layout size. Reverting the P1 fix
// and re-running this spec's earlier draft (which asserted
// `hh-direct-contact-calculator`'s own boundingBox height > 0) still passed
// with a height of ~3681px, even though the element was genuinely squeezed
// into an invisible sliver -- a worthless test by this file's own
// two-sided-falsification standard.
//
// The element that IS actually squeezed by the defect is the ANCESTOR flex
// item itself -- the Main Content pane, `role="tabpanel"` -- because ITS
// height is what the flex-grow/automatic-minimum-size algorithm computes.
// Empirically: reverting the fix took this pane's own boundingBox height
// from ~11,257px down to ~32px (verified via a debug run against this exact
// spec before landing the assertions below); restoring the fix brought it
// back to ~11,257px. That is the discriminating signal this spec asserts on,
// with a wide safety margin (well above the ~32px squeezed reading, well
// below any real page's natural height) so a flaky few-px difference in
// content between runs can never accidentally flip the result.
//
// Uses the shared e2e/fixtures/matrix-options-nav.ts helpers rather than
// forking navigation logic (that duplication was itself a defect fixed
// earlier on this branch). Runs inside the existing chromium-auth project by
// setting the viewport explicitly in-test, rather than adding a new
// Playwright project to the matrix (see the testMatch update in
// playwright.config.ts that lets this filename run under chromium-auth).
const SQUEEZED_HEIGHT_CEILING_PX = 200;

test.describe('Matrix Options Calculator phone layout (D3 regression guard)', () => {
  test('Calculator main pane and its contents are actually laid out at a phone viewport, not squeezed to near-zero height', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await gotoMatrixOptionsOrSkip(page);

    await clickUntilVisible(page, 'Calculator', 'calculator-tab-content');
    await page.getByTestId('category-selector-hh-direct').click();

    // Seeded HH Direct Contact defaults compute the preliminary standard and
    // the background UTL immediately (same baseline
    // MatrixDashboard.test.tsx's "Calculator reference rail follows Stage 3"
    // describe block relies on), so the adjusted-standard chip should read
    // computed without any further input.
    const calculatorBody = page.getByTestId('hh-direct-contact-calculator');
    await expect(calculatorBody).toBeVisible();
    const adjustedChip = page.getByTestId('calculator-summary-bar-adjusted-chip');
    await expect(adjustedChip).toBeVisible();

    // The actual discriminating assertion: the Main Content flex item
    // (role="tabpanel", the ancestor whose height the P1 defect squeezed)
    // must resolve to a real, page-scale height, not the ~32px sliver the
    // defect produces. See the file-header comment for how this was
    // empirically derived and why the descendant-only checks below are not
    // sufficient on their own.
    const tabpanel = page.getByRole('tabpanel');
    const tabpanelBox = await tabpanel.boundingBox();
    expect(tabpanelBox).not.toBeNull();
    expect(tabpanelBox!.height).toBeGreaterThan(SQUEEZED_HEIGHT_CEILING_PX);

    // Belt-and-suspenders per the task's literal requirement: the stage
    // container / calculator body and the adjusted-standard chip each have
    // non-zero layout height. These alone would NOT catch the defect (see
    // the header comment), but they do catch a genuinely different failure
    // mode -- the content collapsing to zero height in its OWN right (e.g. a
    // CSS regression scoped to the calculator component itself), which the
    // tabpanel-height check above would not notice if the tabpanel's own
    // height happened to stay large for unrelated reasons.
    const calculatorBox = await calculatorBody.boundingBox();
    const adjustedChipBox = await adjustedChip.boundingBox();
    expect(calculatorBox).not.toBeNull();
    expect(calculatorBox!.height).toBeGreaterThan(0);
    expect(adjustedChipBox).not.toBeNull();
    expect(adjustedChipBox!.height).toBeGreaterThan(0);

    // E4 fix (third adversarial round, 2026-08-15): SQUEEZED_HEIGHT_CEILING_PX
    // (200) is content-dependent -- the ~32px squeezed reading was only ever
    // observed because the left rail's own content currently exceeds ~570px
    // at this viewport, and the squeezed tabpanel is whatever height the
    // flex-shrink-0 rails leave over. If the rail's content ever shrinks, a
    // squeezed layout could clear 200px while this assertion keeps passing,
    // silently losing its ability to discriminate. Add a content-independent
    // companion: regardless of the absolute number, the tabpanel must never
    // be laid out SHORTER than the content it is supposed to contain -- a
    // squeezed tabpanel clips its own child (calculatorBody), so this holds
    // even if a future refactor changes what "squeezed" measures as in px.
    expect(tabpanelBox!.height).toBeGreaterThanOrEqual(calculatorBox!.height);

    // No horizontal page overflow at 375px -- a stacked-rail layout that
    // clips or scrolls horizontally is its own (separate) defect class.
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });

  // E2 fix (third adversarial round, 2026-08-15): the reference rail's focus
  // rescue (MatrixDashboard.tsx, the effect keyed on effectiveShowRightPanel)
  // depends on `HTMLElement.inert`, which jsdom 27.1.0 does not implement --
  // `event.currentTarget.inert` is always `undefined` in Vitest, so a unit
  // test cannot tell a correct guard from a broken one. This spec runs in a
  // real Chromium, which does implement `inert`, so it is the only place
  // this behaviour can be verified end to end.
  //
  // Scenario: open the rail (make Stage 3 "actionable" by dropping the
  // reference-sample count below 2, which flips backgroundReferenceNeedsAttention
  // to true and opens the rail with no user click needed), focus the rail's
  // own Value Search input, then restore a valid (>= 2) sample set so the UTL
  // computes and the rail auto-closes. Focus should land on the rail's own
  // toggle button, not be left orphaned on <body> or stuck in the collapsed
  // rail.
  //
  // The reference-sample field lives in the MAIN pane (BackgroundAdjustment),
  // not inside the rail, so a normal `.fill()`/`.click()` on it would itself
  // move DOM focus there before the rail closes, exercising a different
  // (already-working) voluntary-blur path. The sample-count changes below are
  // dispatched out-of-band instead -- via the textarea's native value setter
  // plus a bubbling `input` event -- so React's onChange fires and Stage 3's
  // computed state updates, without moving document.activeElement away from
  // the Value Search input, so this test exercises the auto-close-while-
  // still-focused-inside case specifically.
  //
  // DISCRIMINATION, VERIFIED (per this task's two-sided-falsification
  // standard): this assertion fails when the rescue effect's whole condition
  // (MatrixDashboard.tsx, the `if (...)` inside the effect keyed on
  // effectiveShowRightPanel) is forced false -- confirmed by temporarily
  // adding `false &&` to that condition and re-running this test, which then
  // failed on `toBeFocused()`. It does NOT discriminate the onBlur handler's
  // `inert` check specifically -- confirmed by temporarily replacing that
  // whole onBlur body with an unconditional `rightPanelFocusInsideRef.current
  // = false;` and re-running: this test still PASSED. Root cause: in this
  // exact scenario, document.activeElement is still the (about-to-go-inert)
  // Value Search input when the passive rescue effect runs, so the effect's
  // own `rightPanelWrapperRef.current?.contains(document.activeElement)`
  // branch (E1's reconciliation) already succeeds before the browser's own
  // asynchronous inert-triggered blur (see E3) has fired at all -- the
  // onBlur handler never gets a chance to run before the rescue completes,
  // so its guard is not reachable by this deterministic interaction. This
  // test is real, verified coverage for the E1 rescue-effect reconciliation;
  // it is not proof the onBlur `inert` check itself is correct, only that it
  // is inert (no pun intended) in this flow. No reliable way to force a real,
  // deterministic browser to fire that blur before the passive effect was
  // found -- the ordering is exactly the race the effect's own comment says
  // was never established either way.
  test('rail focus rescue fires when the rail auto-closes while focus is still inside it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await gotoMatrixOptionsOrSkip(page);

    await clickUntilVisible(page, 'Calculator', 'calculator-tab-content');
    await page.getByTestId('category-selector-hh-direct').click();

    const samplesField = page.locator('#bg-adjust-samples');
    await expect(samplesField).toBeVisible();

    const setSamplesWithoutFocus = async (value: string) => {
      await samplesField.evaluate((el, next) => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value',
        )?.set;
        setter?.call(el, next);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, value);
    };

    // Drop below the n >= 2 threshold: UTL stops being computed, Stage 3
    // becomes actionable, and the rail auto-opens.
    await setSamplesWithoutFocus('1');

    const searchInput = page.getByPlaceholder('Search parameter or source');
    await expect(searchInput).toBeVisible();
    await searchInput.click();
    await expect(searchInput).toBeFocused();

    // Restore a valid sample set: UTL computes, the rail auto-closes, and
    // focus was never moved away from searchInput by this step.
    await setSamplesWithoutFocus('10, 12, 14');

    const toggleButton = page.getByRole('button', { name: /Value Search panel/ });
    await expect(toggleButton).toBeFocused();
  });
});
