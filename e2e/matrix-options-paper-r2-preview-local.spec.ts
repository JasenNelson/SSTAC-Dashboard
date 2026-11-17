import { expect, test } from '@playwright/test';

test('exact fixture page uses only loopback preview state through save, conflict, completion and reload', async ({ page }) => {
  const blocked: string[] = [];
  const requests: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.href);
    if (url.hostname !== '127.0.0.1' || url.pathname.startsWith('/api/matrix-options/paper/guided-r2')) {
      blocked.push(url.href);
      await route.abort();
    } else await route.continue();
  });
  const stateResponse = page.waitForResponse((response) => response.url().endsWith('/api/matrix-options/paper/preview-r2')
    && response.request().postDataJSON()?.operation === 'state');
  const pageResponse = await page.goto('/r2-guided-fixture');
  expect(pageResponse?.status()).toBe(200);
  const firstStateResponse = await stateResponse;
  expect(firstStateResponse.status()).toBe(200);
  const firstState = await firstStateResponse.json();
  const identity = firstStateResponse.request().postDataJSON().identity;
  await expect(page.getByRole('heading', { name: 'Phase 2 review draft' })).toBeVisible();
  const navigation = page.getByRole('complementary', { name: 'Review navigation' });
  const panel = page.getByRole('complementary', { name: 'Review this section' });
  await navigation.getByRole('button', { name: /Overall approach and paper structure/ }).click();
  await expect(panel.getByRole('heading', { name: 'Overall approach and paper structure' })).toBeVisible();
  await panel.getByRole('radio', { name: 'Sound as proposed' }).check();
  await panel.locator('#desktop-structure-approach-rationale').fill('Keep the structure');
  const firstSaveResponse = page.waitForResponse((response) => response.url().endsWith('/api/matrix-options/paper/preview-r2')
    && response.request().postDataJSON()?.operation === 'save');
  await panel.locator('#desktop-structure-approach-rationale').locator('xpath=ancestor::section[1]').getByRole('button', { name: 'Save' }).click();
  const firstSave = await firstSaveResponse;
  expect(firstSave.status()).toBe(200);
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await panel.getByRole('button', { name: 'Mark area reviewed on this page' }).click();
  await expect(navigation.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');

  await navigation.getByRole('button', { name: /Where standards apply/ }).click();
  await panel.locator('#desktop-site-assignment').fill('Site assignment answer');
  await panel.locator('#desktop-site-assignment').locator('xpath=ancestor::section[1]').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await panel.locator('#desktop-sec-phase2-5').fill('Section five comment');
  await panel.locator('#desktop-sec-phase2-5').locator('xpath=ancestor::section[1]').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();

  await navigation.getByRole('button', { name: 'Whole-paper comments' }).click();
  await panel.locator('#desktop-whole-paper').fill('Whole paper comment');
  await panel.locator('#desktop-whole-paper').locator('xpath=ancestor::section[1]').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();

  await navigation.getByRole('button', { name: /Overall approach and paper structure/ }).click();
  const direct = await page.evaluate(async ({ identity, userKey }: { identity: Record<string, string>; userKey: string }) => {
    const response = await fetch('/api/matrix-options/paper/preview-r2', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation: 'save', targetId: 'structure-approach', body: {
        ...identity, targetKind: 'choice-prompt', expectedRevision: 1, expectedUserId: userKey,
        draft: { choiceId: 'sound', rationale: 'Other tab edit' },
      } }),
    });
    return response.status;
  }, { identity, userKey: firstState.userKey });
  expect(direct).toBe(200);
  await panel.locator('#desktop-structure-approach-rationale').fill('My newer edit');
  await panel.locator('#desktop-structure-approach-rationale').locator('xpath=ancestor::section[1]').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'This item changed elsewhere' })).toBeVisible();
  await panel.locator('#desktop-structure-approach-rationale').locator('xpath=ancestor::section[1]').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();

  await navigation.getByRole('button', { name: 'My Review' }).click();
  const main = page.getByRole('main');
  await expect(page.getByRole('heading', { name: 'My Review' })).toBeVisible();
  await expect(page.getByText('1 of 6 focus areas marked reviewed on this page.')).toBeVisible();
  await expect(main.getByText('Reason: My newer edit')).toBeVisible();
  await expect(main.getByText('Site assignment answer')).toBeVisible();
  await expect(main.getByText('Section five comment')).toBeVisible();
  await expect(main.getByText('Whole paper comment')).toBeVisible();
  await page.getByRole('button', { name: 'Finish review' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Review finished.' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/r2-guided-fixture');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'My Review' })).toBeVisible();
  await expect(main.getByText('Reason: My newer edit')).toBeVisible();
  await expect(main.getByText('Site assignment answer')).toBeVisible();
  await expect(main.getByText('Section five comment')).toBeVisible();
  await expect(main.getByText('Whole paper comment')).toBeVisible();
  await expect(page.getByText(/^Last finished /)).toBeVisible();
  expect(requests.some((url) => url.includes('/api/matrix-options/paper/preview-r2'))).toBe(true);
  expect(blocked).toEqual([]);
});
