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
  await expect(page.getByText('Review the proposed approach and share feedback where you have a view. All questions are optional.')).toBeVisible();
  const disclosure = page.locator('header details');
  await expect(disclosure).not.toHaveAttribute('open');
  await disclosure.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('open');
  await expect(disclosure.getByText(/Soft deletion retains them until permanent deletion/)).toBeVisible();
  const navigation = page.getByRole('complementary', { name: 'Review navigation' });
  const panel = page.getByRole('complementary', { name: 'Review this section' });
  await navigation.getByRole('button', { name: /Overall approach and paper structure/ }).click();
  await expect(panel.getByRole('heading', { name: 'Overall approach and paper structure' })).toBeVisible();
  await panel.getByRole('radio', { name: 'Sound as proposed' }).check();
  await expect(panel.getByText('Marking an area reviewed does not save a response.')).toBeVisible();
  await panel.locator('#desktop-structure-approach-rationale').fill('Keep the structure');
  await expect(panel.getByText('Unsaved - save before finishing').first()).toBeVisible();
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

test('restored R2 controls resize, count and navigate within the paper without moving the page', async ({ page }) => {
  const blocked: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || url.pathname.startsWith('/api/matrix-options/paper/guided-r2')) {
      blocked.push(url.href);
      await route.abort();
    } else await route.continue();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.goto('/r2-guided-fixture'))?.status()).toBe(200);
  const navigation = page.getByRole('complementary', { name: 'Review navigation' });
  const panel = page.getByRole('complementary', { name: 'Review this section' });
  const paper = page.getByTestId('r2-paper-scrollport');
  const layout = page.getByTestId('r2-workspace-layout');
  const before = await page.evaluate(() => window.scrollY);
  const paperBefore = await paper.evaluate((element) => element.scrollTop);
  await navigation.getByRole('button', { name: /Overall approach and paper structure/ }).click();
  await expect.poll(() => paper.evaluate((element) => element.scrollTop)).toBeGreaterThan(paperBefore);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await expect(navigation.getByRole('button', { name: /Overall approach and paper structure/ })).toHaveAttribute('aria-current', 'step');

  const handle = page.getByRole('separator', { name: 'Resize review panel' });
  const widthBefore = await layout.evaluate((element) => Number.parseInt(element.style.getPropertyValue('--paper-right-width'), 10));
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x - 40, handleBox!.y + handleBox!.height / 2, { steps: 5 });
  await page.mouse.up();
  const widthAfter = await layout.evaluate((element) => Number.parseInt(element.style.getPropertyValue('--paper-right-width'), 10));
  expect(widthAfter).toBeGreaterThan(widthBefore);
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  const keyboardWidth = await layout.evaluate((element) => Number.parseInt(element.style.getPropertyValue('--paper-right-width'), 10));
  expect(keyboardWidth).toBe(widthAfter - 16);
  await page.reload();
  await expect(layout).toHaveCSS('--paper-right-width', `${keyboardWidth}px`);
  await page.getByRole('button', { name: 'Reset panel widths' }).click();
  await expect(layout).toHaveCSS('--paper-right-width', '400px');
  const comfortableWidth = await page.getByTestId('r2-reading-frame').evaluate((element) => element.getBoundingClientRect().width);
  await page.getByRole('radio', { name: 'Wide' }).click();
  await expect(page.getByTestId('r2-reading-frame')).toHaveAttribute('data-reader-width', 'wide');
  const wideWidth = await page.getByTestId('r2-reading-frame').evaluate((element) => element.getBoundingClientRect().width);
  expect(wideWidth).toBeGreaterThan(comfortableWidth + 60);

  const rationale = panel.locator('#desktop-structure-approach-rationale');
  await rationale.fill('A short rationale');
  await expect(panel.locator('#desktop-structure-approach-rationale-count')).toHaveText('17 / 20000');
  const field = rationale.locator('xpath=ancestor::section[1]');
  await field.getByRole('button', { name: 'Expand editor' }).click();
  await expect(rationale).toHaveAttribute('data-expanded', 'true');
  await expect(rationale).toHaveCSS('resize', 'vertical');
  await field.getByRole('button', { name: 'Collapse editor' }).click();
  await expect(rationale).not.toHaveAttribute('data-expanded');
  await rationale.scrollIntoViewIfNeeded();
  const textareaBox = await rationale.boundingBox();
  expect(textareaBox).not.toBeNull();
  await page.mouse.move(textareaBox!.x + textareaBox!.width - 4, textareaBox!.y + textareaBox!.height - 4);
  await page.mouse.down();
  await page.mouse.move(textareaBox!.x + textareaBox!.width - 4, textareaBox!.y + textareaBox!.height + 40, { steps: 5 });
  await page.mouse.up();
  const resizedBox = await rationale.boundingBox();
  expect(resizedBox!.height).toBeGreaterThan(textareaBox!.height);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText('Review the proposed approach and share feedback where you have a view. All questions are optional.')).toBeVisible();
  await expect(page.locator('header details')).not.toHaveAttribute('open');
  const mobileBefore = await page.evaluate(() => window.scrollY);
  await page.getByLabel('Go to a focus area').selectOption('uses-waterbodies');
  expect(await page.evaluate(() => window.scrollY)).toBe(mobileBefore);
  const action = page.getByTestId('r2-mobile-review-action');
  await action.click();
  const dialog = page.getByTestId('r2-mobile-review-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#mobile-site-assignment-count')).toHaveText('0 / 20000');
  await dialog.getByRole('button', { name: 'Close review panel' }).click();
  await expect(action).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(mobileBefore);
  expect(blocked).toEqual([]);
});
