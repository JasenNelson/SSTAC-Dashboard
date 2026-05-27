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

test.describe('SSD Workbench', () => {
  test('renders SSD Workbench with default validation fixture', async ({
    page,
  }) => {
    await page.goto('/matrix-options', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    await clickUntilVisible(page, 'SSD Workbench', 'ssd-workbench');

    await expect(page.locator('body')).toContainText(
      'Species Sensitivity Distribution candidate generator',
    );
    await expect(page.locator('body')).toContainText('Derived candidate only');

    await expect(
      page.getByRole('button', { name: 'Run SSD', exact: true }),
    ).toBeVisible();

    await expect(
      page.getByTestId('ssd-species-aggregate-table'),
    ).toBeVisible();

    await expect(page.locator('body')).toContainText('Daphnia magna');

    const datasetCombobox = page.getByRole('combobox', {
      name: /Validation dataset/i,
    });
    await expect(datasetCombobox).toHaveValue('copper_preview');

    await expect(page.locator('body')).toContainText('Preview dataset');
  });

  test('switches to CCME Boron validation dataset and verifies reference check', async ({
    page,
  }) => {
    await page.goto('/matrix-options', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    await clickUntilVisible(page, 'SSD Workbench', 'ssd-workbench');

    const datasetCombobox = page.getByRole('combobox', {
      name: /Validation dataset/i,
    });
    await datasetCombobox.selectOption('ccme_boron_validation');

    await expect(page.locator('body')).toContainText('28 source rows');
    await expect(page.getByDisplayValue('Boron')).toBeVisible();

    await page.getByRole('button', { name: 'Run SSD', exact: true }).click();

    const validationPanel = page.getByTestId('ssd-validation-panel');
    await expect(validationPanel).toBeVisible();
    await validationPanel.getByText('Validation and verification').click();
    await expect(validationPanel).toHaveAttribute('open', '');

    const referenceChecks = validationPanel.getByText('Reference checks');
    await expect(referenceChecks).toBeVisible();
    await expect(validationPanel.getByText('Within tolerance')).toBeVisible();
  });

  test('runs SSD on copper preview and shows HCp result', async ({ page }) => {
    await page.goto('/matrix-options', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    await clickUntilVisible(page, 'SSD Workbench', 'ssd-workbench');

    await page.getByRole('button', { name: 'Run SSD', exact: true }).click();

    await expect(page.locator('body')).not.toContainText('Needs data');

    const aggregateTable = page.getByTestId('ssd-species-aggregate-table');
    await expect(aggregateTable).toBeVisible();
    await expect(aggregateTable.locator('tbody tr').first()).toBeVisible();

    const diagnosticsSummary = page.getByText('Model diagnostics');
    await expect(diagnosticsSummary).toBeVisible();
    await diagnosticsSummary.click();

    await expect(
      page.getByTestId('ssd-model-diagnostics-table'),
    ).toBeVisible();
  });

  test('shows not-configured state for ECOTOX mirror', async ({ page }) => {
    await page.route('**/api/matrix-options/ssd/records', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'ecotox_supabase_not_configured',
          configured: false,
          missing: ['ECOTOX_SUPABASE_URL', 'ECOTOX_SUPABASE_ANON_KEY'],
          invalid: [],
          table: 'toxicology_data',
          rowCount: null,
          rowCountAvailable: false,
          readable: false,
        }),
      }),
    );

    await page.goto('/matrix-options', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    await clickUntilVisible(page, 'SSD Workbench', 'ssd-workbench');

    await page
      .getByRole('button', { name: /ECOTOX mirror/i })
      .click();

    const healthPanel = page.getByTestId('ssd-ecotox-health-panel');
    await expect(healthPanel).toBeVisible();

    await expect(healthPanel).toContainText('Mirror not configured');
    await expect(healthPanel).toContainText('ECOTOX_SUPABASE_URL');

    await expect(
      page.getByRole('button', { name: /Search mirror/i }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: /Load records/i }),
    ).toBeDisabled();

    await expect(healthPanel).toContainText(
      'No service-role key is used or required',
    );
  });
});
