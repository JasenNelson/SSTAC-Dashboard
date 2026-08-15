import { expect, type Locator, type Page, test } from '@playwright/test';

async function clickUntilVisible(
  page: Page,
  triggerName: string,
  visibleTarget: string | Locator,
) {
  const trigger = page.getByRole('tab', {
    name: triggerName,
    exact: true,
  });
  const target =
    typeof visibleTarget === 'string'
      ? page.getByTestId(visibleTarget)
      : visibleTarget;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expect(trigger).toBeVisible();
    await trigger.click();
    await page.waitForTimeout(500);
    if (await target.isVisible({ timeout: 1000 }).catch(() => false)) {
      return;
    }
  }

  await expect(target).toBeVisible();
}

// /matrix-options is auth-gated (middleware matcher) as of 2026-06-15. CI has no
// shared auth storageState, so auth-dependent assertions are explicitly guarded and
// skipped if we land on /login.
async function gotoMatrixOptionsOrSkip(page: Page) {
  await page.goto('/matrix-options', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) {
    test.skip(true, 'Not authenticated; /matrix-options is gated. Skipping authenticated assertions.');
  }
  // Deterministic readiness (replaces a blind 3s settle): the authenticated page
  // renders the MatrixDashboard h1 exactly "Matrix Options". Waiting on it resolves
  // as soon as the dashboard is interactive instead of after a fixed timeout, and
  // fails loudly if the authed page never renders. Runs only under auth (post-skip).
  await expect(
    page.getByRole('heading', { name: 'Matrix Options', exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  // ...but that h1 is present in the SSR markup, so it resolves BEFORE React
  // has client-rendered the dashboard. In that window every tab button exists
  // with correct role/ARIA/tabindex yet carries NO event handlers, and the
  // client render then REPLACES those nodes (dropping DOM focus to <body>).
  // A keyboard test that focused a tab and pressed a key there was pressing
  // against inert markup: focus() succeeded, the keydown reached a node with
  // no handler, and nothing moved. Gate on the mount-only readiness marker
  // that MatrixDashboard sets on the primary tablist, which by construction
  // can only exist on the live, interactive render.
  await expect(
    page.locator('[role="tablist"][data-primary-tablist-ready="true"]'),
  ).toBeAttached({ timeout: 15_000 });
}

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

    const reviewButton = page.getByRole('button', {
      name: 'Review candidate defaults',
      exact: true,
    });
    await expect(reviewButton).toBeVisible();
    await reviewButton.click();

    await expect(page.getByTestId('references-values-tab')).toBeVisible();

    const policyAudit = page.getByTestId('evidence-library-default-policy-audit');
    await expect(policyAudit).toBeVisible();

    // The calculator candidate-default shortcut renders a read-only "Calculator
    // request" receipt. NOTE: the prior 'Input: sf oral per mg per kg bw per day'
    // assertion was stale (never run in CI under auth) -- the banner now renders
    // '<n> input key(s): ...', so assert the stable receipt header instead.
    await expect(page.getByText('Calculator request')).toBeVisible();

    // Core invariant: the AI never surfaces promotion controls in this view.
    await expect(policyAudit).not.toContainText('Promote default');
    await expect(policyAudit).not.toContainText('Approve default');
  });

  test('filters References by candidate defaults without promotion language', async ({
    page,
  }) => {
    await gotoMatrixOptionsOrSkip(page);

    await clickUntilVisible(page, 'References & Values', 'references-values-tab');

    const candidateDefaultsButton = page.getByRole('button', {
      name: /Candidate defaults/i,
    });
    await expect(candidateDefaultsButton).toBeVisible();
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

    const guideTab = page.getByRole('tab', { name: 'The Guide', exact: true });
    const conceptualTab = page.getByRole('tab', { name: 'Conceptual Model', exact: true });

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

    const guideTab = page.getByRole('tab', { name: 'The Guide', exact: true });
    const calculatorTab = page.getByRole('tab', { name: 'Calculator', exact: true });

    await guideTab.focus();
    // TABS order: The Guide(0), Conceptual Model(1), Methodology by pathway
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

    const guideTab = page.getByRole('tab', { name: 'The Guide', exact: true });
    const ssdTab = page.getByRole('tab', { name: 'SSD Workbench', exact: true });

    await guideTab.focus();
    // Index 6: The Guide -> Conceptual Model -> Methodology by pathway ->
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

    const guideTab = page.getByRole('tab', { name: 'The Guide', exact: true });
    const conceptualTab = page.getByRole('tab', { name: 'Conceptual Model', exact: true });
    const referencesTab = page.getByRole('tab', { name: 'References & Values', exact: true });

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

    const guideTab = page.getByRole('tab', { name: 'The Guide', exact: true });
    const referencesTab = page.getByRole('tab', { name: 'References & Values', exact: true });

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

    const guideTab = page.getByRole('tab', { name: 'The Guide', exact: true });
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
    await clickUntilVisible(page, 'References & Values', 'references-values-tab');

    const activeTab = page.getByRole('tab', { name: 'References & Values', exact: true });
    await expect(activeTab).toHaveAttribute('aria-selected', 'true');

    const controlsId = await activeTab.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    await expect(page.locator(`#${controlsId}`)).toHaveAttribute('role', 'tabpanel');
  });

  test('collapsing the left panel makes its contents unreachable by Tab (inert)', async ({ page }) => {
    await gotoMatrixOptionsOrSkip(page);

    await clickUntilVisible(page, 'Calculator', 'calculator-tab-content');

    const hideButton = page.getByRole('button', { name: 'Hide left panel', exact: true });
    await expect(hideButton).toBeVisible();
    await hideButton.click();

    const showButton = page.getByRole('button', { name: 'Show left panel', exact: true });
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

