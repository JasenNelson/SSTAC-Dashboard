import { expect, test } from '@playwright/test';
import { clickUntilVisible, gotoMatrixOptionsOrSkip } from './fixtures/matrix-options-nav';

test.describe('SSD Workbench', () => {
  test('renders SSD Workbench with default validation fixture', async ({
    page,
  }) => {
    await gotoMatrixOptionsOrSkip(page);

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
    await gotoMatrixOptionsOrSkip(page);

    await clickUntilVisible(page, 'SSD Workbench', 'ssd-workbench');

    const datasetCombobox = page.getByRole('combobox', {
      name: /Validation dataset/i,
    });
    await datasetCombobox.selectOption('ccme_boron_validation');

    await expect(page.locator('body')).toContainText('28 source rows');
    await expect(
      page.getByRole('textbox', { name: /Chemical search/i }),
    ).toHaveValue('Boron');

    await page.getByRole('button', { name: 'Run SSD', exact: true }).click();
    await expect(page.locator('body')).toContainText(
      'Results match the current staged settings',
    );

    const validationPanel = page.getByTestId('ssd-validation-panel');
    await expect(validationPanel).toBeVisible();
    await validationPanel.locator('summary').click();
    await expect(validationPanel).toHaveAttribute('open', '');

    const referenceChecks = validationPanel.getByText('Reference checks');
    await expect(referenceChecks).toBeVisible();
    await expect(validationPanel.getByText('Within tolerance')).toBeVisible();
  });

  test('runs SSD on copper preview and shows HCp result', async ({ page }) => {
    await gotoMatrixOptionsOrSkip(page);

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

    await gotoMatrixOptionsOrSkip(page);

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

/**
 * Audit round 2 triage, P0-3 -- REAL print-render check.
 *
 * The print de-clipping fix (print:max-h-none on the SSD result containers and on
 * ScrollFadeRegion) was previously verified only by unit tests asserting the utility classes are
 * present. An external holistic review correctly objected that this proves the class is applied,
 * not that the printed page is un-clipped -- jsdom implements no `@media print` at all, so the
 * "no clipping on paper" claim had no rendering evidence behind it.
 *
 * This measures the real thing: under emulateMedia({ media: 'print' }), a container that clips
 * vertically has scrollHeight > clientHeight. The species-aggregate table is capped at max-h-72
 * (288px) on screen and holds the per-species toxicity rows the HCp regulatory output is derived
 * from, so a clipped print is a silently truncated evidence table.
 *
 * Falsification record: removing `print:max-h-none` from the container at SsdWorkbench.tsx:2089
 * makes this fail with scrollHeight exceeding clientHeight.
 */
test.describe('SSD Workbench print fidelity', () => {
  /**
   * Generalised sweep, added after an external reviewer objected that guarding ONE table leaves
   * the other capped result regions unguarded -- `max-h-64` diagnostics, `max-h-44` exclusions,
   * and the same pattern anywhere it appears later.
   *
   * Rather than one test per container, this asserts the INVARIANT: under the print medium, no
   * height-capped container that holds a data table may clip. Any future capped table is covered
   * automatically, which is the point -- the per-container approach is what let three of these
   * ship un-de-clipped in the first place.
   *
   * Scoped to containers holding a <table> deliberately: chrome and layout wrappers may
   * legitimately stay capped on paper; a table is the regulatory-evidence surface.
   */
  test('no height-capped data table clips under the print medium', async ({ page }) => {
    await gotoMatrixOptionsOrSkip(page);
    await clickUntilVisible(page, 'SSD Workbench', 'ssd-workbench');

    await page.emulateMedia({ media: 'print' });

    const swept = await page.evaluate(() => {
      const offenders: { cls: string; scrollH: number; clientH: number }[] = [];
      let examined = 0;
      document.querySelectorAll('[class*="max-h-"]').forEach((el) => {
        const node = el as HTMLElement;
        if (!node.querySelector('table')) return;
        // `examined` counts only containers that are actually LAID OUT. A container inside a
        // closed <details> is in the DOM but its children are not laid out, so scrollHeight and
        // clientHeight are both 0: it can never be an offender, and counting it would pad the
        // existence assertion below with something incapable of failing.
        //
        // But this ONLY gates the count. An earlier version returned early here, which also
        // skipped the offender check -- and a container collapsed to zero height by an ANCESTOR
        // has clientHeight 0 with scrollHeight > 0, i.e. it is maximally clipped. Skipping it
        // would have hidden the worst case while claiming to sharpen the guard.
        if (node.clientHeight > 0) examined += 1;
        if (node.scrollHeight > node.clientHeight) {
          offenders.push({
            cls: node.className,
            scrollH: node.scrollHeight,
            clientH: node.clientHeight,
          });
        }
      });
      return { offenders, examined };
    });

    // EXISTENCE HALF -- assert the sweep actually found something it could have failed on.
    // Without it this test is offenders-only: on a view where no laid-out height-capped table
    // container is present it returns an empty array and reports green having measured NOTHING.
    // An absence check unpaired with an existence check certifies the very drift it was written
    // to prevent, which is a defect this project has shipped before. It matters doubly because
    // the print-clipping backlog recommends EXTENDING this sweep to other views; extended
    // without this line it would silently pass on any view whose capped table it never reached.
    //
    // Scope, stated precisely: THIS test does NOT open any disclosure. Its whole preamble is
    // goto + click the SSD Workbench tab + emulate print. Another test in this file clicks the
    // "Model diagnostics" summary, but each test gets a fresh page fixture and there is no
    // serial mode, so that <details> is CLOSED here and the diagnostics container it holds is
    // not laid out. That is exactly why `examined` skips zero-height nodes above -- otherwise
    // this container would inflate the count while being incapable of ever failing.
    expect(
      swept.examined,
      'the print sweep found zero height-capped table containers on this view, so it proved ' +
        'nothing -- check the view actually rendered before trusting a green result here',
    ).toBeGreaterThan(0);

    expect(
      swept.offenders,
      'these height-capped containers hold data tables and still clip under print, so rows ' +
        'would be silently missing from the printed page',
    ).toEqual([]);
  });


  test('species-aggregate table is not height-clipped when printed', async ({ page }) => {
    await gotoMatrixOptionsOrSkip(page);
    await clickUntilVisible(page, 'SSD Workbench', 'ssd-workbench');

    const table = page.getByTestId('ssd-species-aggregate-table');
    await expect(table).toBeVisible();

    // Screen: the cap is expected to be in force. This is the control -- if the element never
    // overflows on screen either, the print assertion below would pass vacuously.
    const screenState = await table.evaluate((el) => {
      const scroller = el.closest('[class*="max-h-"]') as HTMLElement | null;
      return scroller
        ? { found: true, scrollH: scroller.scrollHeight, clientH: scroller.clientHeight }
        : { found: false, scrollH: 0, clientH: 0 };
    });
    expect(screenState.found, 'expected a max-h-* scroll container around the aggregate table').toBe(true);

    // THE PRECONDITION, without which this whole test is vacuous. An external reviewer caught
    // that the original version only checked a container was FOUND -- so with a short fixture
    // both measurements would be equal and the print assertion would pass even if the
    // de-clipping regressed. Assert the container genuinely overflows ON SCREEN first; if this
    // fails, the dataset is too small to exercise clipping and the test must be given a taller
    // one rather than left to pass for the wrong reason.
    expect(
      screenState.scrollH,
      'the aggregate table does not overflow its cap on screen, so this fixture cannot ' +
        'demonstrate print de-clipping -- the print assertion below would pass vacuously',
    ).toBeGreaterThan(screenState.clientH);

    await page.emulateMedia({ media: 'print' });

    const printState = await table.evaluate((el) => {
      const scroller = el.closest('[class*="max-h-"]') as HTMLElement | null;
      return scroller
        ? { scrollH: scroller.scrollHeight, clientH: scroller.clientHeight }
        : { scrollH: 0, clientH: 0 };
    });

    // Under print the cap must be lifted: the container shows its full content height, so no row
    // is silently dropped off the bottom of the page.
    expect(
      printState.clientH,
      'printed species-aggregate container clips vertically -- rows of per-species toxicity ' +
        'data would be silently missing from the printed page',
    ).toBeGreaterThanOrEqual(printState.scrollH);
  });
});
