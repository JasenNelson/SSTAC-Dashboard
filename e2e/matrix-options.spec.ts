import { expect, type Page, test } from '@playwright/test';

async function clickUntilVisible(
  page: Page,
  triggerName: string,
  visibleTestId: string,
) {
  const trigger = page.getByRole('button', {
    name: triggerName,
    exact: true,
  });
  const target = page.getByTestId(visibleTestId);

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
