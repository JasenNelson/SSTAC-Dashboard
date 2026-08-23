import { expect, test } from '@playwright/test';
import { clickUntilVisible, gotoMatrixOptionsOrSkip } from './fixtures/matrix-options-nav';

test.describe('Matrix Options default-policy review shortcuts', () => {
  test('matrix-options route is either authenticated or redirects to /login', async ({ page }, testInfo) => {
    await page.goto('/matrix-options', { waitUntil: 'domcontentloaded' });

    if (testInfo.project.name === 'chromium-auth') {
      // Authenticated project: must NOT bounce to /login and must render the page
      // (the MatrixDashboard h1 is exactly "Matrix Options").
      await expect(page).not.toHaveURL(/\/login/);
      await expect(
        page.getByRole('heading', { name: 'Matrix Options', exact: true }),
      ).toBeVisible();
    } else {
      // Unauthenticated projects: /matrix-options is middleware-gated -> /login.
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('opens References & Values from the calculator candidate-default shortcut', async ({
    page,
  }) => {
    await gotoMatrixOptionsOrSkip(page);

    await clickUntilVisible(page, 'Calculator', 'calculator-tab-content');
    await page.getByTestId('category-selector-hh-food').click();

    // Audit P1 (2026-08-16): this test used to open the right rail via the header toggle
    // first, purely because "Review candidate defaults" was reachable only from inside the
    // Stage-3-gated Value Search panel. That workaround is gone: the action now also renders
    // in the calculator body, which is the point of the fix, so the test exercises the real
    // user flow. The rail's gating of reference DATA is unchanged.
    // Scoped by testid because the button deliberately exists twice now; an unscoped
    // getByRole would be ambiguous and fail on strict mode rather than on the behaviour.
    const reviewButton = page.getByTestId('calculator-candidate-defaults-button-body');
    await expect(reviewButton).toBeVisible();
    await reviewButton.click();

    const refTab = page.getByTestId('references-values-tab');
    await expect(refTab).toBeVisible();

    // The calculator candidate-default shortcut renders a read-only "Calculator
    // request" receipt. NOTE: the prior 'Input: sf oral per mg per kg bw per day'
    // assertion was stale (never run in CI under auth) -- the banner now renders
    // '<n> input key(s): ...', so assert the stable receipt header instead.
    await expect(page.getByText('Calculator request')).toBeVisible();

    // Core invariant: the AI never surfaces promotion controls in this view.
    await expect(refTab).not.toContainText('Promote default');
    await expect(refTab).not.toContainText('Approve default');
  });

  test('filters References by candidate defaults without promotion language', async ({
    page,
  }) => {
    await gotoMatrixOptionsOrSkip(page);

    await clickUntilVisible(page, 'Catalogue', 'references-values-tab');

    const candidateDefaultsButton = page.getByRole('button', {
      name: /Candidate defaults/i,
    });
    await expect(candidateDefaultsButton).toBeVisible();

    const box = await candidateDefaultsButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await candidateDefaultsButton.click();

    await expect(candidateDefaultsButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('evidence-library-values')).toBeVisible();
    await expect(page.locator('body')).toContainText('Evidence: approved source-backed');
    await expect(page.locator('body')).toContainText('Default: available option');
    await expect(page.locator('body')).not.toContainText('Promote default');
    await expect(page.locator('body')).not.toContainText('Approve default');
  });
});

test.describe('Calculator pathway navigation', () => {
  test('HH Food Web shows substance values and provenance panel', async ({
    page,
  }) => {
    await gotoMatrixOptionsOrSkip(page);

    await clickUntilVisible(page, 'Calculator', 'calculator-tab-content');
    await page.getByTestId('category-selector-hh-food').click();

    await expect(page.getByTestId('calculator-tab-content')).toContainText(
      'Human Health Food Web',
    );

    // Substance selection is now a type-to-search combobox (item 1b) not a native select.
    const substanceSelector = page.getByTestId('substance-combobox-input');
    await expect(substanceSelector).toBeVisible();

    const calculator = page.getByTestId('hh-food-web-calculator');
    const provenancePanel = calculator.getByTestId('calculator-provenance-panel');
    await expect(provenancePanel).toBeVisible();
    await provenancePanel.click();
    await expect(provenancePanel).toContainText('Values used in this calculation');
    await expect(provenancePanel).toContainText('equation');
    await expect(provenancePanel).toContainText('source');
    await expect(provenancePanel).toContainText('Oral RfD');

    const valueSearchPanel = page.getByTestId('calculator-value-search-panel');
    await expect(valueSearchPanel).toContainText('Human Health Food Web');
    const reviewButton = valueSearchPanel.getByRole('button', {
      name: /Review candidate defaults/,
    });
    await expect(reviewButton).toBeVisible();
  });

  test('Cyanide advisory warning appears when a cyanide candidate is selected', async ({
    page,
  }) => {
    await gotoMatrixOptionsOrSkip(page);

    await clickUntilVisible(page, 'Calculator', 'calculator-tab-content');
    await page.getByTestId('category-selector-hh-food').click();

    const substanceSelector = page.getByTestId('substance-combobox-input');
    await substanceSelector.click();
    await substanceSelector.fill('cyanide');
    await page.getByTestId('substance-option-cyanide_free').click();

    const warning = page.getByTestId('cyanide-guidance-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('Caution: These endpoints represent equivalent cyanide exposure');

    // Switch to another substance
    await substanceSelector.click();
    await substanceSelector.fill('benzene');
    await page.getByTestId('substance-option-benzene').click();

    await expect(warning).toBeHidden();
  });
});

// A11y (2026-08-14 audit): the primary 8-tab tablist ('The Guide' ...
// 'References & Values') claims manual activation (ArrowLeft/ArrowRight/
// Home/End move focus only; Enter/Space/click activate) with a roving
// tabindex, while the Jurisdictional Frameworks side tablist claims
// automatic activation (arrows both move focus and select). These tests use
// real page.keyboard.press() events -- not clicks -- because that is the
// only way to verify focus movement, tabindex desync, and the `inert`
// attribute; jsdom-based unit tests cannot observe any of these.
test.describe('Matrix Options primary tablist keyboard navigation (manual activation)', () => {
  test('ArrowRight moves focus without changing the active tab', async ({ page }) => {
    await gotoMatrixOptionsOrSkip(page);

    const guideTab = page.getByRole('tab', { name: 'Guide', exact: true });
    const conceptualTab = page.getByRole('tab', { name: 'Modernizing Schedule 3.4', exact: true });

    await guideTab.focus();
    await expect(guideTab).toBeFocused();
    await expect(guideTab).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowRight');

    // Focus moved to the next tab...
    await expect(conceptualTab).toBeFocused();
    // ...but selection did NOT follow it. This is the entire point of manual
    // activation and the thing no unit test can cover.
    await expect(guideTab).toHaveAttribute('aria-selected', 'true');
    await expect(conceptualTab).toHaveAttribute('aria-selected', 'false');
  });

  test('Enter activates the focused tab and swaps the panel content', async ({ page }) => {
    await gotoMatrixOptionsOrSkip(page);

    const guideTab = page.getByRole('tab', { name: 'Guide', exact: true });
    const calculatorTab = page.getByRole('tab', { name: 'Calculator', exact: true });

    await guideTab.focus();
    // TABS order: The Guide(0), Vision for Modernizing Schedule 3.4(1), Methodology by pathway
    // aka Jurisdictional Frameworks(2), TWG Review(3), Interactive Map(4),
    // Calculator(5). 5 ArrowRight presses walks focus there without
    // activating any of the intermediate tabs.
    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press('ArrowRight');
    }
    await expect(calculatorTab).toBeFocused();
    await expect(calculatorTab).toHaveAttribute('aria-selected', 'false');
    await expect(guideTab).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Enter');

    await expect(calculatorTab).toHaveAttribute('aria-selected', 'true');
    await expect(guideTab).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByTestId('calculator-tab-content')).toBeVisible();
  });

  test('Space also activates the focused tab', async ({ page }) => {
    await gotoMatrixOptionsOrSkip(page);

    const guideTab = page.getByRole('tab', { name: 'Guide', exact: true });
    const ssdTab = page.getByRole('tab', { name: 'SSD Workbench', exact: true });

    await guideTab.focus();
    // Index 6: The Guide -> Vision for Modernizing Schedule 3.4 -> Methodology by pathway ->
    // TWG Review -> Interactive Map -> Calculator -> SSD Workbench.
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('ArrowRight');
    }
    await expect(ssdTab).toBeFocused();
    await expect(ssdTab).toHaveAttribute('aria-selected', 'false');

    await page.keyboard.press(' ');

    await expect(ssdTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('ssd-workbench')).toBeVisible();
  });

  test('Home and End jump focus to the first and last tab', async ({ page }) => {
    await gotoMatrixOptionsOrSkip(page);

    const guideTab = page.getByRole('tab', { name: 'Guide', exact: true });
    const conceptualTab = page.getByRole('tab', { name: 'Modernizing Schedule 3.4', exact: true });
    const referencesTab = page.getByRole('tab', { name: 'Catalogue', exact: true });

    await guideTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(conceptualTab).toBeFocused();

    await page.keyboard.press('End');
    await expect(referencesTab).toBeFocused();
    // End is a focus move only, same as Arrow -- selection stays put.
    await expect(guideTab).toHaveAttribute('aria-selected', 'true');
    await expect(referencesTab).toHaveAttribute('aria-selected', 'false');

    await page.keyboard.press('Home');
    await expect(guideTab).toBeFocused();
  });

  test('ArrowRight from the last tab wraps focus to the first tab', async ({ page }) => {
    await gotoMatrixOptionsOrSkip(page);

    const guideTab = page.getByRole('tab', { name: 'Guide', exact: true });
    const referencesTab = page.getByRole('tab', { name: 'Catalogue', exact: true });

    await guideTab.focus();
    await page.keyboard.press('End');
    await expect(referencesTab).toBeFocused();

    // handlePrimaryTabKeyDown computes nextIdx = (safeIdx + 1) % TABS.length,
    // so this is real modular-arithmetic wraparound, not a clamp. Verifying
    // actual behaviour rather than assuming it.
    await page.keyboard.press('ArrowRight');
    await expect(guideTab).toBeFocused();
  });

  test('exactly one primary tab has tabindex=0 at any time, including after arrowing', async ({ page }) => {
    await gotoMatrixOptionsOrSkip(page);

    const guideTab = page.getByRole('tab', { name: 'Guide', exact: true });
    await guideTab.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');

    const tablist = page.getByRole('tablist', { name: 'Matrix Options' });
    // CSS attribute selector on the tab element itself (not a descendant
    // search) -- role="tab" combined with tabindex="0" identifies exactly
    // the tabbable tab(s) within this tablist.
    const tabbableTabs = tablist.locator('[role="tab"][tabindex="0"]');

    // A desync that left zero (or more than one) tabbable tab would break
    // Tab-into-the-tablist for every subsequent keyboard user; assert the
    // exact count rather than just "at least one". Uses Playwright's
    // web-first (auto-retrying) count assertion rather than a plain
    // expect() on a one-shot evaluateAll() snapshot, since a plain expect
    // does not retry and this check runs immediately after the final
    // ArrowLeft keypress.
    await expect(tabbableTabs).toHaveCount(1);
  });

  test('aria-controls on the active tab resolves to a real tabpanel element (References & Values)', async ({
    page,
  }) => {
    await gotoMatrixOptionsOrSkip(page);

    // The References & Values panel was, until recently, missing its
    // tabpanel wrapper -- aria-controls pointed at nothing. That kind of
    // dangling IDREF is invisible without asserting the target actually
    // resolves in the DOM.
    await clickUntilVisible(page, 'Catalogue', 'references-values-tab');

    const activeTab = page.getByRole('tab', { name: 'Catalogue', exact: true });
    await expect(activeTab).toHaveAttribute('aria-selected', 'true');

    const controlsId = await activeTab.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    await expect(page.locator(`#${controlsId}`)).toHaveAttribute('role', 'tabpanel');
  });

  test('collapsing the left panel makes its contents unreachable by Tab (inert)', async ({ page }) => {
    await gotoMatrixOptionsOrSkip(page);

    await clickUntilVisible(page, 'Calculator', 'calculator-tab-content');

    // Calculator left guide panel starts collapsed (effectiveShowLeftPanel = false).
    // Open it first, then collapse it to verify inert behavior.
    const showButton = page.getByRole('button', { name: 'Show Guide panel', exact: true });
    await expect(showButton).toBeVisible();
    await showButton.click();

    const hideButton = page.getByRole('button', { name: 'Hide Guide panel', exact: true });
    await expect(hideButton).toBeVisible();
    await hideButton.click();

    await expect(showButton).toBeVisible();

    const wrapper = page.getByTestId('left-sidebar-wrapper');
    // Confirms the mechanism (the `inert` DOM property is actually set),
    // in addition to the behavioural check below.
    await expect(wrapper).toHaveJSProperty('inert', true);

    // This loop is the ONLY way to verify `inert` actually removes the
    // collapsed sidebar from the tab order -- jsdom cannot observe real
    // focus traversal at all. Bounded (not unbounded): 40 Tab presses is
    // comfortably more than the number of focusable elements between the
    // toolbar and the end of the page, so a regression that left the
    // collapsed sidebar's children tabbable would be caught well within
    // the loop instead of requiring an open-ended scan.
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      const focusInsideWrapper = await wrapper.evaluate((wrapperEl) =>
        wrapperEl.contains(document.activeElement),
      );
      expect(focusInsideWrapper).toBe(false);
    }
  });

  test('toggling the Catalogue filters panel closes on first click and reopens', async ({ page }) => {
    await gotoMatrixOptionsOrSkip(page);

    await clickUntilVisible(page, 'Catalogue', 'references-values-tab');

    // Catalogue left panel is open by default (effectiveShowLeftPanel = true).
    const hideButton = page.getByRole('button', { name: 'Hide Filters panel', exact: true });
    await expect(hideButton).toBeVisible();
    await hideButton.click();

    // First click must toggle to closed (Show button visible).
    const showButton = page.getByRole('button', { name: 'Show Filters panel', exact: true });
    await expect(showButton).toBeVisible();

    // Clicking Show reopens it.
    await showButton.click();
    await expect(hideButton).toBeVisible();
  });
});

test.describe('Jurisdictional Frameworks side tabs (automatic activation)', () => {
  test('arrow keys change selection immediately, unlike the primary tablist', async ({ page }) => {
    await gotoMatrixOptionsOrSkip(page);

    // The primary tab's accessible name for this section is its display
    // label, not the internal TABS identifier (see TAB_LABELS in
    // MatrixDashboard.tsx).
    const sideTablist = page.getByRole('tablist', { name: 'Pathway sections' });
    await clickUntilVisible(page, 'Methodology by pathway', sideTablist);

    const firstSideTab = page.getByRole('tab', { name: 'Ecological: EqP & AVS', exact: true });
    const secondSideTab = page.getByRole('tab', {
      name: 'Ecological: Food Web (BSAF)',
      exact: true,
    });

    await expect(firstSideTab).toHaveAttribute('aria-selected', 'true');

    await firstSideTab.focus();
    await page.keyboard.press('ArrowDown');

    // Deliberately different contract from the primary tablist: here the
    // arrow key itself moves BOTH focus and selection, because these three
    // panels are cheap to swap (see handleSideTabKeyDown's comment).
    await expect(secondSideTab).toBeFocused();
    await expect(secondSideTab).toHaveAttribute('aria-selected', 'true');
    await expect(firstSideTab).toHaveAttribute('aria-selected', 'false');
  });
});


test.describe('Vision page -- axis colour encoding (decision #3)', () => {
  test('renders DIFFERENT computed border colours per receptor axis', async ({ page }) => {
    // THIS TEST EXISTS BECAUSE A CLASS-NAME ASSERTION CANNOT CATCH THIS BUG.
    //
    // The shipped defect was precisely a class-present / colour-absent mismatch: the
    // quadrants carried `border-emerald-600`, and a unit test asserting that class
    // string passed -- while every quadrant actually painted identical slate, because
    // the all-sides colour utility lost to CARD's `border-slate-200` on stylesheet
    // order. The unit test certified the exact defect it was written to prevent.
    //
    // jsdom computes no colour from an external stylesheet, so the only place this can
    // be checked for real is a browser with the compiled CSS loaded. Asserting the two
    // axes DIFFER (rather than pinning exact oklch values) keeps this robust against a
    // deliberate palette change while still failing the moment the encoding collapses
    // to one colour again.
    await gotoMatrixOptionsOrSkip(page);

    await clickUntilVisible(
      page,
      'Modernizing Schedule 3.4',
      page.getByTestId('schedule-34-matrix'),
    );

    const eco = page.getByTestId('pathway-ecological-direct');
    const hh = page.getByTestId('pathway-human-health-direct');
    await expect(eco).toBeVisible();
    await expect(hh).toBeVisible();

    const ecoColour = await eco.evaluate((el) => getComputedStyle(el).borderTopColor);
    const hhColour = await hh.evaluate((el) => getComputedStyle(el).borderTopColor);

    // The encoding is only meaningful if the two axes are visually distinguishable.
    expect(ecoColour).not.toBe(hhColour);

    // And neither may collapse to the neutral card border, which is what the bug did.
    const cardBorder = await eco.evaluate((el) => getComputedStyle(el).borderRightColor);
    expect(ecoColour).not.toBe(cardBorder);
    expect(hhColour).not.toBe(cardBorder);
  });
});
