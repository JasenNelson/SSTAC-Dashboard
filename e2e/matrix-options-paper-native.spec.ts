import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { notationRuns } from '../src/lib/matrix-options/paper/figures';
import { getCohortManifest } from '../src/lib/matrix-options/cohort-contract';
import { sectionNumbersFromLocator } from '../src/lib/matrix-options/paper/cohort-portions';
import { V0991_PAPER_VERSION } from '../src/lib/matrix-options/paper/releases';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

const enabled = process.env.MATRIX_NATIVE_LOCAL_E2E === 'true';
if (enabled) {
  // Defense in depth for direct spec execution outside the reviewed wrapper.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./fixtures/native-local-runtime.cjs').assertNativeInvocation(process.env);
}
const root = process.env.MATRIX_NATIVE_LOCAL_CORPUS_ROOT;
const evidenceRoot = process.env.MATRIX_NATIVE_LOCAL_EVIDENCE_ROOT;
test.skip(!enabled || !root, 'Native route E2E requires the opted-in local private corpus and intercepted local auth.');

type Node = { id: string; label: string; heads: string[]; bullets: string[] };
type Edge = { from: string; to: string; label: string | null };
type Group = { id: string; members: string[] };
type Model = { id: string; title: string; source: { sha256: string }; nodes: Node[]; edges: Edge[]; groups: Group[] };
type Placement = { figureId: string; modelId: string; caption: string; sectionAnchor: string };
const privateSet: { models: Model[]; placements: Placement[] } = enabled && root
  ? JSON.parse(fs.readFileSync(path.join(root, 'v0.9.91', 'figures', 'native-figure-models.json'), 'ascii'))
  : { models: [], placements: [] };
const placements = privateSet.placements;
const models = new Map(privateSet.models.map((model) => [model.id, model]));
const base = '/matrix-options/paper/publication/v/v0.9.91';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const shown = (value: string) => notationRuns(value, 'math').map((run) => run.text).join('');
const evidenceFiles: string[] = [];
const pdfFiles: string[] = [];
let accessibleTableCaptionPassed = false;
async function capture(figure: import('@playwright/test').Locator, name: string) {
  if (!evidenceRoot) throw new Error('NATIVE_EVIDENCE_ROOT_MISSING');
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const bytes = await figure.screenshot({ path: path.join(evidenceRoot, name), animations: 'disabled' });
  const box = await figure.boundingBox();
  const metadata = await sharp(bytes).metadata();
  if (!box || Math.abs((metadata.width ?? 0) - box.width) > 2 || Math.abs((metadata.height ?? 0) - box.height) > 2) {
    throw new Error(`NATIVE_CAPTURE_CLIPPED image=${metadata.width}x${metadata.height} box=${Math.round(box?.width ?? 0)}x${Math.round(box?.height ?? 0)}`);
  }
  const stats = await sharp(bytes).stats();
  const contrast = stats.channels.slice(0, 3).reduce((total, channel) => total + channel.stdev, 0);
  if (contrast <= 3) {
    const details = await figure.evaluate((element) => ({
      visible: getComputedStyle(element).visibility,
      display: getComputedStyle(element).display,
      top: Math.round(element.getBoundingClientRect().top),
      height: Math.round(element.getBoundingClientRect().height),
      print: matchMedia('print').matches,
    }));
    throw new Error(`NATIVE_VISUAL_BLANK ${JSON.stringify(details)}`);
  }
  evidenceFiles.push(name);
}
function writeEvidenceManifest() {
  if (!evidenceRoot) throw new Error('NATIVE_EVIDENCE_ROOT_MISSING');
  const images = evidenceFiles.map((name) => ({ file: name,
    sha256: createHash('sha256').update(fs.readFileSync(path.join(evidenceRoot, name))).digest('hex') }));
  const pdfs = pdfFiles.map((name) => ({ file: name,
    sha256: createHash('sha256').update(fs.readFileSync(path.join(evidenceRoot, name))).digest('hex') }));
  fs.writeFileSync(path.join(evidenceRoot, 'R9_VISUAL_PDF_HASHES.json'), `${JSON.stringify({ schema: 'native-visual-pdf-evidence-v3', images, pdfs,
    accessibleTableCaptionPassed }, null, 2)}\n`, 'ascii');
}
function privateEqual(actual: string, expected: string, code: string) {
  const actualHash = sha256(actual);
  const expectedHash = sha256(expected);
  if (actualHash !== expectedHash) throw new Error(`${code} expected_sha256=${expectedHash} actual_sha256=${actualHash}`);
}
const expectedByCohort = (() => {
  if (!enabled || !root) return new Map<string, string[]>();
  const result = new Map<string, string[]>();
  for (const cohort of getCohortManifest(V0991_PAPER_VERSION).cohorts) {
    const numbers = cohort.sourceLocators.flatMap(sectionNumbersFromLocator);
    const ids = placements.filter((placement) => numbers.some((number) => {
      const anchor = `sec-${number.replaceAll('.', '-')}`;
      return placement.sectionAnchor === anchor || placement.sectionAnchor.startsWith(`${anchor}-`);
    })).map((placement) => placement.figureId);
    result.set(cohort.id, ids);
  }
  return result;
})();
async function hydrated(page: import('@playwright/test').Page) {
  await expect(page.locator('[data-testid="workspace-shell"][data-hydrated="true"]')).toBeVisible({ timeout: 120000 });
}

async function noOverflow(figure: import('@playwright/test').Locator, context: string) {
  await figure.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const metrics = await figure.evaluate((element) => {
    const canvas = element.querySelector('.paper-figure__canvas')!;
    const figureRect = element.getBoundingClientRect();
    const descendants = [...element.querySelectorAll('.paper-figure__node, .paper-figure__edge-label, .paper-figure__title, .paper-figure__note, .paper-figure__caption')];
    return {
      documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      figureOverflow: element.scrollWidth > element.clientWidth + 1,
      figureVerticalOverflow: element.scrollHeight > element.clientHeight + 1,
      canvasOverflow: canvas.scrollWidth > canvas.clientWidth + 1,
      canvasVerticalOverflow: canvas.scrollHeight > canvas.clientHeight + 1,
      hiddenNodes: [...element.querySelectorAll('.paper-figure__node')].filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width < 1 || rect.height < 1 || style.visibility !== 'visible' || style.display === 'none';
      }).length,
      clippedDescendants: descendants.filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.left < figureRect.left - 1 || rect.right > figureRect.right + 1 ||
          rect.top < figureRect.top - 1 || rect.bottom > figureRect.bottom + 1;
      }).length,
      figure: { left: Math.round(figureRect.left), right: Math.round(figureRect.right), width: Math.round(figureRect.width) },
    };
  });
  if (metrics.figure.width < 1 || metrics.documentOverflow || metrics.figureOverflow || metrics.figureVerticalOverflow ||
      metrics.canvasOverflow || metrics.canvasVerticalOverflow || metrics.clippedDescendants || metrics.hiddenNodes) {
    throw new Error(`Native figure overflow ${context}: ${JSON.stringify(metrics)}`);
  }
}

async function noMobileScrollButtonOverlap(page: import('@playwright/test').Page, figure: import('@playwright/test').Locator) {
  const button = page.getByRole('button', { name: 'Scroll to top', includeHidden: true });
  await expect(button).toBeHidden();
  const buttonBox = await button.count() ? await button.boundingBox() : null;
  const figureBox = await figure.boundingBox();
  expect(buttonBox && figureBox && buttonBox.x < figureBox.x + figureBox.width &&
    buttonBox.x + buttonBox.width > figureBox.x && buttonBox.y < figureBox.y + figureBox.height &&
    buttonBox.y + buttonBox.height > figureBox.y).toBeFalsy();
}

test('authenticated native paper route preserves all placements and the separate source image', async ({ page }) => {
  test.setTimeout(900000);
  // Deep links render their target figure on the server. Suppress unrelated
  // client section/review prefetches during the 20-page sweep so the local
  // app's normal request limiter does not mask native figure assertions.
  let allowClientRequests = false;
  await page.route((url) => url.pathname.startsWith('/api/matrix-options/paper/v/v0.9.91/sections/') ||
    url.pathname === '/api/matrix-options/paper/reviews', async (route) => {
    if (allowClientRequests) await route.continue();
    else await route.abort('blockedbyclient');
  });
  const flowchartRequests: string[] = [];
  const reviewedGroups = new Set<string>();
  const capturedModels = new Set<string>();
  page.on('request', (request) => {
    if (/\/figures\/FIG[A-Z0-9-]+\.png(?:\?|$)/.test(request.url())) flowchartRequests.push(request.url());
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('form[data-hydrated="true"]').waitFor({ timeout: 30000 });
  await page.locator('#email').fill('native-local@example.test');
  await page.locator('#password').fill('local-synthetic-password');
  const tokenResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/auth/v1/token', { timeout: 30000 });
  await page.locator('button[type="submit"]').click();
  expect((await tokenResponse).status()).toBe(200);
  await expect.poll(async () => (await page.context().cookies()).some((cookie) => cookie.name.startsWith('sb-') &&
    cookie.name.includes('auth-token')), { timeout: 30000 }).toBe(true);

  expect(placements).toHaveLength(20);
  expect(models.size).toBe(17);
  for (const [placementIndex, placement] of placements.entries()) {
    const model = models.get(placement.modelId)!;
    expect(model).toBeDefined();
    await page.goto(`${base}?mode=working-draft&section=${encodeURIComponent(placement.sectionAnchor)}`, { waitUntil: 'domcontentloaded' });
    await hydrated(page);
    const figure = page.locator(`figure[data-native-figure="${placement.figureId}"]:visible`).first();
    await expect(figure).toBeVisible({ timeout: 60000 });
    if (placementIndex === 0) {
      if (await page.locator('html').evaluate((node) => node.classList.contains('dark'))) {
        await page.getByRole('button', { name: 'Switch to light mode' }).first().click();
      }
      await expect(page.locator('html')).toHaveClass(/\blight\b/);
      const lightCanvas = await figure.locator('.paper-figure__canvas').evaluate((node) => getComputedStyle(node).backgroundColor);
      for (const [name, width] of [['mobile', 360], ['laptop', 1280], ['wide', 1920]] as const) {
        await page.setViewportSize({ width, height: 900 });
        await noOverflow(figure, `light-${name}`);
        if (name === 'mobile') {
          await noMobileScrollButtonOverlap(page, figure);
          if (evidenceRoot) await page.screenshot({ path: path.join(evidenceRoot, 'visual-light-mobile-viewport.png'), animations: 'disabled' });
          evidenceFiles.push('visual-light-mobile-viewport.png');
        }
        await capture(figure, `visual-light-${name}.png`);
      }
      await page.getByRole('button', { name: 'Switch to dark mode' }).first().click();
      await expect(page.locator('html')).toHaveClass(/\bdark\b/);
      const darkCanvas = await figure.locator('.paper-figure__canvas').evaluate((node) => getComputedStyle(node).backgroundColor);
      expect(darkCanvas).not.toBe(lightCanvas);
      for (const [name, width] of [['mobile', 360], ['laptop', 1280], ['wide', 1920]] as const) {
        await page.setViewportSize({ width, height: 900 });
        await noOverflow(figure, `dark-${name}`);
        if (name === 'mobile') {
          await noMobileScrollButtonOverlap(page, figure);
          if (evidenceRoot) await page.screenshot({ path: path.join(evidenceRoot, 'visual-dark-mobile-viewport.png'), animations: 'disabled' });
          evidenceFiles.push('visual-dark-mobile-viewport.png');
        }
        await capture(figure, `visual-dark-${name}.png`);
      }
    }
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    const caption = await figure.locator('figcaption').textContent();
    privateEqual(caption?.replace(/\s+/g, ' ').trim() ?? '', placement.caption, 'NATIVE_CAPTION_MISMATCH');
    privateEqual(await figure.getAttribute('data-source-sha256') ?? '', model.source.sha256, 'NATIVE_SOURCE_MISMATCH');
    await expect(figure.locator('[data-figure-node]')).toHaveCount(model.nodes.length);
    const labelById = new Map(model.nodes.map((node) => [node.id, shown(node.label)]));
    const renderedNodes = await figure.locator('[data-figure-node]').evaluateAll((elements) => elements.map((element) => ({
      id: element.getAttribute('data-figure-node'),
      label: element.querySelector('.paper-figure__node-label')?.textContent ?? '',
      heads: [...element.querySelectorAll('.paper-figure__node-head')].map((item) => item.textContent ?? ''),
      bullets: [...element.querySelectorAll('.paper-figure__bullets > li')].map((item) => item.textContent ?? ''),
    })));
    const renderedById = new Map(renderedNodes.map((node) => [node.id, node]));
    for (const node of model.nodes) {
      const rendered = renderedById.get(node.id);
      expect(Boolean(rendered)).toBe(true);
      privateEqual(rendered?.label ?? '', shown(node.label), 'NATIVE_LABEL_MISMATCH');
      expect(rendered?.heads.length).toBe(node.heads.length);
      for (let index = 0; index < node.heads.length; index++) {
        privateEqual(rendered?.heads[index] ?? '', shown(node.heads[index]), 'NATIVE_HEAD_MISMATCH');
      }
      expect(rendered?.bullets.length).toBe(node.bullets.length);
      for (let index = 0; index < node.bullets.length; index++) {
        privateEqual(rendered?.bullets[index] ?? '', shown(node.bullets[index]), 'NATIVE_BULLET_MISMATCH');
      }
    }
    const descriptionId = await figure.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    const description = await figure.locator(`#${descriptionId}`).textContent() ?? '';
    expect(description.includes(`Diagram with ${model.nodes.length} boxes.`)).toBe(true);
    for (const edge of model.edges) {
      const relationship = `${labelById.get(edge.from)} leads to ${labelById.get(edge.to)}` +
        (edge.label ? ` (${shown(edge.label)})` : '');
      expect(description.includes(relationship)).toBe(true);
    }
    await expect(figure.locator('[data-figure-group], [data-group-member], .paper-figure__groups')).toHaveCount(0);
    expect(description.includes('Groups:')).toBe(false);
    for (const [groupIndex, group] of model.groups.entries()) {
      reviewedGroups.add(`${model.id}:${groupIndex}`);
      const parentOf = (id: string) => model.edges.find((edge) => edge.to === id)?.from;
      const siblingGroup = group.members.every((id) => parentOf(id) === parentOf(group.members[0]));
      const chainGroup = group.members.length === 2 && group.members.some((id) =>
        model.edges.some((edge) => edge.from === id && group.members.includes(edge.to)));
      expect(siblingGroup || chainGroup, 'Every private group must be conveyed by an authenticated tree relation').toBe(true);
      const conveyed = await figure.locator('.paper-figure__tree').evaluate((tree, members) => {
        const nodes = members.map((id) => [...tree.querySelectorAll('[data-figure-node]')]
          .find((node) => node.getAttribute('data-figure-node') === id));
        if (nodes.some((node) => !node)) return { sibling: false, chain: false };
        const branches = nodes.map((node) => node!.closest('li.paper-figure__branch'));
        return {
          sibling: branches.every((branch) => branch?.parentElement === branches[0]?.parentElement),
          chain: branches.length === 2 && (branches[0]?.contains(branches[1]) || branches[1]?.contains(branches[0])) === true,
        };
      }, group.members);
      expect(siblingGroup ? conveyed.sibling : conveyed.chain).toBe(true);
      // A substituted parent or child cannot pass the same structure check.
      const altered = [...group.members.slice(0, -1), '__missing_member__'];
      const alteredConveyed = await figure.locator('.paper-figure__tree').evaluate((tree, members) =>
        members.every((id) => [...tree.querySelectorAll('[data-figure-node]')]
          .some((node) => node.getAttribute('data-figure-node') === id)), altered);
      expect(alteredConveyed).toBe(false);
    }
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const visibleFigure = page.locator(`figure[data-native-figure="${placement.figureId}"]:visible`).first();
      await expect(visibleFigure).toBeVisible();
      await noOverflow(visibleFigure, `placement-${placementIndex} at ${width}px`);
    }
    if (!capturedModels.has(model.id)) {
      await page.emulateMedia({ media: 'print' });
      await capture(figure, `native-print-${model.id}.png`);
      await page.emulateMedia({ media: 'screen' });
      capturedModels.add(model.id);
    }
    process.stdout.write('NATIVE_SPEC_PLACEMENT_COMPLETE\n');
  }
  expect(flowchartRequests).toEqual([]);
  expect(reviewedGroups.size).toBe(11);

  const depth = (model: Model) => {
    const children = new Map(model.nodes.map((node) => [node.id, model.edges.filter((edge) => edge.from === node.id).map((edge) => edge.to)]));
    const visit = (id: string, seen = new Set<string>()): number => seen.has(id) ? 0
      : 1 + Math.max(0, ...(children.get(id) ?? []).map((child) => visit(child, new Set([...seen, id]))));
    return Math.max(...model.nodes.map((node) => visit(node.id)));
  };
  const ranked = (score: (model: Model) => number) => privateSet.models.reduce((best, model) => score(model) > score(best) ? model : best);
  const representatives = [
    ranked((model) => model.nodes.reduce((total, node) => total + node.label.length + node.heads.join('').length + node.bullets.join('').length, 0)),
    ranked((model) => Math.max(0, ...model.nodes.map((node) => model.edges.filter((edge) => edge.from === node.id).length))),
    ranked(depth),
    ranked((model) => model.groups.reduce((total, group) => total + group.members.length, 0)),
  ];
  for (const [index, model] of representatives.entries()) {
    const placement = placements.find((entry) => entry.modelId === model.id)!;
    await page.setViewportSize({ width: 1920, height: 1000 });
    await page.goto(`${base}?mode=working-draft&section=${encodeURIComponent(placement.sectionAnchor)}`, { waitUntil: 'domcontentloaded' });
    await hydrated(page);
    const figure = page.locator(`figure[data-native-figure="${placement.figureId}"]:visible`).first();
    await expect(figure).toBeVisible({ timeout: 60000 });
    for (const width of [575, 577, 615, 617, 863, 865]) {
      await figure.evaluate((element, pixels) => {
        (element.closest('[data-testid="paper-reading-frame"]') as HTMLElement).style.maxWidth = 'none';
        (element as HTMLElement).style.width = `${pixels}px`;
      }, width);
      const measured = await figure.evaluate((element) => Math.round(element.getBoundingClientRect().width));
      expect(measured).toBe(width);
      await noOverflow(figure, `breakpoint-${index}-${width}`);
    }
    await figure.evaluate((element) => { (element as HTMLElement).style.width = ''; });
    await page.emulateMedia({ media: 'print' });
    await expect(figure).toBeVisible();
    const printMetrics = await figure.evaluate((element) => ({
      width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height,
      breakInside: getComputedStyle(element).breakInside,
      canvasOverflow: element.querySelector('.paper-figure__canvas')!.scrollWidth > element.querySelector('.paper-figure__canvas')!.clientWidth + 1,
    }));
    expect(printMetrics.width).toBeGreaterThan(0);
    expect(printMetrics.height).toBeGreaterThan(0);
    expect(printMetrics.height).toBeLessThan(1000);
    expect(printMetrics.breakInside).toBe('avoid');
    expect(printMetrics.canvasOverflow).toBe(false);
    await noOverflow(figure, `print-${index}`);
    await figure.evaluate((element) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'reader-prose';
      wrapper.setAttribute('data-native-print-preview', '');
      wrapper.style.cssText = 'position:fixed;top:0;left:0;width:760px;max-width:100vw;background:white;z-index:2147483647';
      wrapper.appendChild(element.cloneNode(true));
      document.body.appendChild(wrapper);
    });
    const printPreview = page.locator('[data-native-print-preview] figure');
    await expect(printPreview).toBeVisible();
    await capture(printPreview, `visual-print-${String(index + 1).padStart(2, '0')}.png`);
    await page.locator('[data-native-print-preview]').evaluate((element) => element.remove());
    await page.emulateMedia({ media: 'screen' });
    process.stdout.write('NATIVE_SPEC_PRINT_SAMPLE_COMPLETE\n');
  }

  allowClientRequests = true;
  await page.goto(`${base}?mode=working-draft`, { waitUntil: 'domcontentloaded' });
  await hydrated(page);
  const lazySection = page.locator('[data-paper-section-placeholder="app-a"]');
  await expect(lazySection).toBeAttached();
  await lazySection.scrollIntoViewIfNeeded();
  await expect(page.locator('[data-paper-section="app-a"] figure[data-native-figure="A-1"]')).toBeVisible({ timeout: 60000 });
  for (const width of [360, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const visibleFigure = page.locator('figure[data-native-figure="A-1"]:visible').first();
    await expect(visibleFigure).toBeVisible();
    await noOverflow(visibleFigure, `A-1 dark at ${width}px`);
  }
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('figure[data-native-figure="A-1"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.emulateMedia({ media: 'screen' });

  await page.goto(`${base}?mode=working-draft&section=app-l`, { waitUntil: 'domcontentloaded' });
  await hydrated(page);
  const sourceImage = page.locator('[data-appendix-source-media] img');
  await expect(sourceImage).toBeVisible({ timeout: 60000 });
  await expect.poll(() => sourceImage.evaluate((node) => (node as HTMLImageElement).complete &&
    (node as HTMLImageElement).naturalWidth > 0), { timeout: 60000 }).toBe(true);

  await page.goto(`${base}?mode=my-review`, { waitUntil: 'domcontentloaded' });
  await hydrated(page);
  const topics = page.locator('nav[aria-label="Review topics"] > ul > li > button');
  await expect(topics).toHaveCount(5);
  expect(expectedByCohort.size).toBe(5);
  const cohortIds = [...expectedByCohort.keys()];
  for (let index = 0; index < 5; index++) {
    await topics.nth(index).click();
    const actual = await page.locator('[data-testid="cohort-paper-stack"] figure[data-native-figure]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-native-figure') ?? ''));
    const expected = expectedByCohort.get(cohortIds[index]) ?? [];
    expect(actual.length).toBe(expected.length);
    privateEqual(JSON.stringify(actual), JSON.stringify(expected), 'NATIVE_COHORT_PLACEMENTS_MISMATCH');
  }

  expect(flowchartRequests).toEqual([]);
  // Negative control: reproduce R6's partial PDF before the application's
  // Print action. This must contain the partial-print notice when extracted.
  allowClientRequests = false;
  await page.goto(`${base}?mode=working-draft`, { waitUntil: 'domcontentloaded' });
  await hydrated(page);
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('paper-partial-print-notice')).toBeVisible();
  if (!evidenceRoot) throw new Error('NATIVE_EVIDENCE_ROOT_MISSING');
  const partialPdf = 'route-print-partial-control.pdf';
  const partialBytes = await page.pdf({ path: path.join(evidenceRoot, partialPdf), format: 'Letter', printBackground: true });
  expect(partialBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  pdfFiles.push(partialPdf);
  process.stdout.write('NATIVE_SPEC_PARTIAL_CONTROL_COMPLETE\n');

  // Positive proof: open the real Print path with all section requests
  // enabled, wait for its own full-document readiness, then capture the PDF.
  await page.emulateMedia({ media: 'screen' });
  allowClientRequests = true;
  await page.evaluate(() => {
    (window as typeof window & { __nativePrintCalls: number }).__nativePrintCalls = 0;
    window.print = () => { (window as typeof window & { __nativePrintCalls: number }).__nativePrintCalls += 1; };
  });
  await page.getByTestId('paper-print-button').click();
  await expect(page.getByTestId('paper-load-progress')).toHaveText(
    'Entire paper loaded. Browser Find (Ctrl+F) searches all of it.', { timeout: 600000 });
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { __nativePrintCalls: number }).__nativePrintCalls), { timeout: 60000 }).toBe(1);
  await expect(page.locator('figure[data-native-figure]')).toHaveCount(20);
  await expect(page.locator('[data-paper-section-status="error"], [data-testid="paper-section-load-error"]')).toHaveCount(0);
  const displayText = await page.locator('[data-testid="paper-document-column"]').innerText();
  expect(displayText).not.toContain('Table: Table');
  expect(displayText).not.toContain('{#tbl-');
  expect(displayText).not.toContain('{.underline}');
  await expect(page.locator('table#tbl-4-1 caption')).toContainText('Table 4-1. Proposed Sediment Use Categories');
  const axSession = await page.context().newCDPSession(page);
  const axTree = await axSession.send('Accessibility.getFullAXTree');
  const tableName = 'Table 4-1. Proposed Sediment Use Categories';
  const namedTables = axTree.nodes.filter((node) => node.role?.value === 'table' &&
    typeof node.name?.value === 'string' && node.name.value.startsWith(tableName));
  const duplicateHeaders = axTree.nodes.filter((node) =>
    (node.role?.value === 'columnheader' || node.role?.value === 'rowheader') &&
    typeof node.name?.value === 'string' && node.name.value.startsWith(tableName));
  expect(namedTables.length).toBeGreaterThan(0);
  expect(duplicateHeaders).toHaveLength(0);
  const { root: axDocument } = await axSession.send('DOM.getDocument');
  const { nodeId: titleRowId } = await axSession.send('DOM.querySelector', {
    nodeId: axDocument.nodeId, selector: 'table#tbl-4-1 .paper-table-caption-row',
  });
  expect(titleRowId).toBeGreaterThan(0);
  const { node: titleRow } = await axSession.send('DOM.describeNode', { nodeId: titleRowId });
  const titleRowAx = await axSession.send('Accessibility.getPartialAXTree', {
    backendNodeId: titleRow.backendNodeId, fetchRelatives: false,
  });
  expect(titleRowAx.nodes.some((node) => node.ignored)).toBe(true);
  await axSession.detach();
  accessibleTableCaptionPassed = true;
  await expect(page.locator('u', { hasText: 'January - March 2027' }).first()).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  const namedPageScope = await page.evaluate(() => ({
    paper: getComputedStyle(document.querySelector('[data-testid="paper-document-column"]')!).getPropertyValue('page').trim(),
    body: getComputedStyle(document.body).getPropertyValue('page').trim(),
  }));
  expect(namedPageScope.paper).toBe('matrix-paper');
  expect(namedPageScope.body).toBe('auto');
  await expect(page.getByTestId('paper-partial-print-notice')).toHaveCount(0);
  const fullPdf = 'route-print-full-document.pdf';
  const fullBytes = await page.pdf({ path: path.join(evidenceRoot, fullPdf), format: 'Letter', printBackground: true });
  expect(fullBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  pdfFiles.push(fullPdf);
  await page.emulateMedia({ media: 'screen' });
  process.stdout.write('NATIVE_SPEC_FULL_PRINT_COMPLETE\n');
  writeEvidenceManifest();
});

test('private assertion mutation emits hashes and code only', () => {
  const privateValue = 'synthetic-private-copy-sentinel';
  let message = '';
  try { privateEqual(privateValue, `${privateValue}-mutated`, 'NATIVE_SYNTHETIC_MISMATCH'); }
  catch (error) { message = (error as Error).message; }
  expect(message.startsWith('NATIVE_SYNTHETIC_MISMATCH expected_sha256=')).toBe(true);
  expect(message.includes(privateValue)).toBe(false);
  expect(message).toMatch(/^NATIVE_SYNTHETIC_MISMATCH expected_sha256=[a-f0-9]{64} actual_sha256=[a-f0-9]{64}$/);
});
