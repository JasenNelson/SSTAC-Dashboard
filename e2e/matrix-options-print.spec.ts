import { test, expect } from '@playwright/test';
import { gotoMatrixOptionsOrSkip, clickUntilVisible } from './fixtures/matrix-options-nav';

/**
 * Audit #16, PRINT medium.
 *
 * jsdom implements no print medium at all, so this defect class is invisible to every unit
 * test in the repo -- which is exactly how it shipped. The duplicate-H1 fix demotes each
 * document's leading `# ` to `##` on the correct observation that the shell supplies the page
 * <h1>. But that <h1> lives inside a toolbar carrying `print:hidden`, so on paper the shell
 * heading disappears and the demoted heading is an h2, leaving the printed regulatory document
 * with NO level-1 heading.
 *
 * These tests emulate the print medium and assert the heading outline on PAPER, which is the
 * only place the bug exists.
 *
 * Falsification record -- each was run against a deliberately broken build and watched failing:
 *  - Removing the `print:block` h1 from MatrixDashboard -> "prints exactly one level-1 heading"
 *    FAILS with a count of 0 on both tabs.
 *  - Changing the h1's classes to `print:hidden` -> same failure, which is the point: the
 *    assertion is on RENDERED VISIBILITY under print, not on a class string.
 *  - Removing `hidden` (so it shows on screen too) -> "does not add a second heading on screen"
 *    FAILS with a screen count of 2.
 */

const PROSE_TABS = ['Guide', 'Methodology by pathway'] as const;

test.describe('Matrix Options print heading outline', () => {
  for (const tab of PROSE_TABS) {
    test(`prints exactly one level-1 heading on "${tab}"`, async ({ page }) => {
      await gotoMatrixOptionsOrSkip(page);
      await clickUntilVisible(page, tab, page.locator('#matrix-dashboard-tabpanel'));

      await page.emulateMedia({ media: 'print' });

      // Count only headings the print medium actually renders. A print:hidden ancestor makes
      // its descendants invisible, so toBeVisible() is the discriminating check here --
      // counting elements in the DOM would pass with the defect present.
      const h1s = page.locator('h1');
      const total = await h1s.count();

      let visibleInPrint = 0;
      for (let i = 0; i < total; i += 1) {
        if (await h1s.nth(i).isVisible()) visibleInPrint += 1;
      }

      expect(
        visibleInPrint,
        `printed "${tab}" must carry exactly one level-1 heading; a regulatory document that ` +
          'prints with none has lost its document title on paper',
      ).toBe(1);
    });

    test(`does not add a second heading on screen for "${tab}"`, async ({ page }) => {
      await gotoMatrixOptionsOrSkip(page);
      await clickUntilVisible(page, tab, page.locator('#matrix-dashboard-tabpanel'));

      // The other side. The print-only h1 must stay out of the screen rendering, or it
      // reintroduces the duplicate-H1 defect the demotion exists to fix.
      const h1s = page.locator('h1');
      const total = await h1s.count();

      let visibleOnScreen = 0;
      for (let i = 0; i < total; i += 1) {
        if (await h1s.nth(i).isVisible()) visibleOnScreen += 1;
      }

      expect(
        visibleOnScreen,
        `on screen "${tab}" must still show exactly one level-1 heading (the shell's)`,
      ).toBe(1);

      await expect(page.getByTestId('matrix-print-title')).toBeHidden();
    });
  }
});

/**
 * Regression guard added after the print fix broke a tab it was never reasoned about.
 *
 * The first version rendered the replacement heading on EVERY tab. That was wrong twice over on
 * TWG Review: its toolbar carries `print:hidden` specifically so window.print() produces a
 * chrome-free PDF of the paper body (see the comment on that toolbar in MatrixDashboard), and
 * its document is rendered RAW -- demoteLeadingH1 is not applied there -- so the tab already
 * prints its own level-1 heading. The unconditional heading took it from 2 printed h1s to 3.
 *
 * Falsified: removing the DEMOTED_DOCUMENT_TABS guard fails this test with a count of 3.
 */
test.describe('Matrix Options print -- tabs that were NOT demoted', () => {
  test('TWG Review keeps its own heading and gains no injected chrome', async ({ page }) => {
    await gotoMatrixOptionsOrSkip(page);
    await clickUntilVisible(page, 'TWG Review', page.locator('#matrix-dashboard-tabpanel'));

    await page.emulateMedia({ media: 'print' });

    // The injected print heading must not appear here at all.
    await expect(page.getByTestId('matrix-print-title')).toHaveCount(0);

    // And the document's own headings must survive, so the printed paper still has a title.
    const h1s = page.locator('h1');
    const total = await h1s.count();
    let visibleInPrint = 0;
    for (let i = 0; i < total; i += 1) {
      if (await h1s.nth(i).isVisible()) visibleInPrint += 1;
    }
    expect(
      visibleInPrint,
      'TWG Review renders its paper raw, so it supplies its own printed heading; the audit #16 ' +
        'replacement heading must not be injected on top of it',
    ).toBeGreaterThan(0);
  });
});
