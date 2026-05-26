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

test.describe('Matrix Options default-policy review shortcuts', () => {
  test('opens References & Values from the calculator candidate-default shortcut', async ({
    page,
  }) => {
    await page.goto('/matrix-options', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    await clickUntilVisible(page, 'Calculator', 'calculator-tab-content');
    await page.getByTestId('category-selector-hh-food').click();

    const reviewButton = page.getByRole('button', {
      name: 'Review candidate defaults',
      exact: true,
    });
    await expect(reviewButton).toBeVisible();
    await reviewButton.click();

    await expect(page.getByTestId('references-values-tab')).toBeVisible();
    await expect(page.getByTestId('evidence-library-default-policy-audit')).toBeVisible();
    await expect(page.locator('body')).toContainText(
      'Input: sf oral per mg per kg bw per day',
    );
    await expect(page.locator('body')).not.toContainText('Promote default');
    await expect(page.locator('body')).not.toContainText('Approve default');
  });

  test('filters References by candidate defaults without promotion language', async ({
    page,
  }) => {
    await page.goto('/matrix-options', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

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
