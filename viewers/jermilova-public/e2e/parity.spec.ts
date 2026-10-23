// Rendered parity: anonymous viewer (/Jermilova) vs authenticated original (/bn-rrm with
// the Jermilova pack selected). Projects in ../playwright.config.ts:
//   viewer-anon (@viewer) -> original-auth (@original) -> compare (@compare)
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const EVIDENCE = process.env.PARITY_EVIDENCE_DIR as string;
const JERMILOVA = 'Jermilova 2025 Mackenzie Mercury BN-RRM';
const TABS = ['Guide', 'Conceptual', 'Detailed BN', 'CPT', 'Map', 'Data'];
const WIDTHS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
];
// Lines the viewer intentionally removes (deleted export/identify controls).
const REMOVED_LINES = new Set(['Export', 'Identify', 'Identify Area']);
// External hosts the owner approved (original basemaps + BC WMS).
const APPROVED_HOSTS = [/(^|\.)tile\.openstreetmap\.org$/, /^server\.arcgisonline\.com$/, /(^|\.)tile\.opentopomap\.org$/, /^stamen-tiles\.a\.ssl\.fastly\.net$/, /^openmaps\.gov\.bc\.ca$/];
// The export is served under /Jermilova/ (basePath): by the preview server, and by the
// root deployment, which answers /Jermilova/ with a single 308 to /Jermilova. Nothing may
// reach the authenticated app's own /_next/ or /bn-rrm/ paths.
const VIEWER_PATHS = [/^\/Jermilova\/?$/, /^\/Jermilova\/index\.txt$/, /^\/Jermilova\/_next\//, /^\/Jermilova\/bn-rrm\//, /^\/favicon\.ico$/];

interface Snapshot {
  tabs: string[];
  chrome: string;
  canvas: Record<string, { containers: number; children: number; edges: string[] }>;
  text: Record<string, string>;
}

// next/dynamic placeholders (verbatim from the original shell). The original runs on
// `next dev`, which compiles each dynamic chunk on first request, so capture only once
// the tab's own content is rendered, never on a fixed delay.
const LOADING = /Loading (canvas|map|CPT explorer|guide|training data)\.\.\./;
const READY: Record<string, (page: Page) => Promise<unknown>> = {
  // GettingStartedView always renders its title h2 (audience-specific sections are opt-in).
  Guide: (page) => mainArea(page).locator('h2').first().waitFor(),
  Conceptual: (page) => mainArea(page).locator('h2').first().waitFor(),
  'Detailed BN': (page) => page.locator('.react-flow__node').first().waitFor(),
  CPT: (page) => mainArea(page).getByText(/With CPT/).first().waitFor(),
  // Attached, not visible: at phone width the layout (the original's SiteMap layout, reused)
  // keeps both fixed side panels, which leaves the Leaflet container 0 px wide (measured on
  // the clone at 390 px). Desktop visibility is asserted separately in snapshot().
  Map: (page) => page.locator('.leaflet-container').first().waitFor({ state: 'attached' }),
  Data: (page) => page.getByPlaceholder('Filter values...').waitFor(),
};

const wrapper = (page: Page) => page.locator('.bn-rrm-wrapper');
const mainArea = (page: Page) => page.locator('.bn-rrm-wrapper > main');
// The shell's node-count status in its sub-header (first child of the wrapper). A
// page-wide getByText('14 nodes') is ambiguous: the ResultsPanel model-info badge in
// <main> (Detailed BN tab, right panel) also contains "14 nodes, 7 CPTs, 15 causal edges".
const nodeCountStatus = (page: Page) => wrapper(page).locator('> div').first().getByText(/^\d+ nodes$/);
async function expectNodeCountStatus(page: Page, text: string) {
  await expect(nodeCountStatus(page)).toHaveText(text);
  await expect(nodeCountStatus(page)).toBeVisible();
}

async function tabLabels(page: Page) {
  return (await wrapper(page).locator('nav button').allInnerTexts()).map((t) => t.trim());
}

async function openTab(page: Page, label: string) {
  await wrapper(page).locator('nav button').filter({ hasText: label }).first().click();
  await READY[label](page);
  await expect(mainArea(page)).not.toContainText(LOADING);
  await page.waitForTimeout(300);
}

// Header + PackBanner + any error banner (everything outside <main>), minus the tab nav
// (compared separately) and the original's pack selector (intentionally removed).
async function chromeText(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('.bn-rrm-wrapper');
    if (!root) return '';
    const parts: string[] = [];
    for (const child of Array.from(root.children)) {
      if (child.tagName === 'MAIN') continue;
      const clone = child.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('nav').forEach((nav) => nav.remove());
      clone.querySelectorAll('div.relative:has(> button svg.lucide-chevron-down)').forEach((selector) => selector.remove());
      parts.push((clone.textContent ?? '').replace(/\s+/g, ' ').trim());
    }
    return parts.filter(Boolean).join('\n');
  });
}

async function canvasState(page: Page) {
  const nodes = page.locator('.react-flow__node');
  const containers = await page.locator('.react-flow__node-containerNode').count();
  const edges = await page.locator('[data-testid^="rf__edge-"]').evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-testid') ?? '').sort(),
  );
  return { containers, children: (await nodes.count()) - containers, edges };
}

// React Flow renders nodes and edges only after measuring them, so a read on a fixed delay
// can catch the canvas mid-update. Read until three consecutive samples, 250 ms apart,
// agree.
async function settledCanvasState(page: Page) {
  const samples: string[] = [];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const state = await canvasState(page);
    samples.push(JSON.stringify(state));
    if (samples.length >= 3 && samples.slice(-3).every((sample) => sample === samples[samples.length - 1])) return state;
    await page.waitForTimeout(250);
  }
  throw new Error(`Canvas did not settle: ${samples.slice(-3).join(' | ')}`);
}

async function snapshot(page: Page, label: string): Promise<Snapshot> {
  const snap: Snapshot = { tabs: await tabLabels(page), chrome: '', canvas: {}, text: {} };
  await openTab(page, 'Detailed BN');
  await page.locator('.react-flow__node-containerNode').first().waitFor();
  snap.chrome = await chromeText(page);
  snap.canvas.collapsed = await settledCanvasState(page);
  await page.locator('[data-id="container_4"]').click();
  snap.canvas.mixed = await settledCanvasState(page);
  await page.getByTitle('Expand all containers').click();
  snap.canvas.expanded = await settledCanvasState(page);
  await page.locator('[data-id="fish_tissue_hg"]').click();
  await page.waitForTimeout(300);
  snap.text['inspector-desktop'] = await mainArea(page).innerText();
  await page.getByTitle('Collapse all containers').click();
  for (const size of WIDTHS) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const tab of TABS) {
      await openTab(page, tab);
      if (tab === 'Map' && size.name === 'desktop') await expect(page.locator('.leaflet-container').first()).toBeVisible();
      snap.text[`${tab}-${size.name}`] = await mainArea(page).innerText();
      await page.screenshot({ path: path.join(EVIDENCE, `${label}-${tab.replace(/\W+/g, '_')}-${size.name}.png`), fullPage: true });
    }
  }
  fs.writeFileSync(path.join(EVIDENCE, `${label}-snapshot.json`), JSON.stringify(snap, null, 2));
  return snap;
}

// Counts every browser-storage, IndexedDB and cookie write from the first script on, so a
// write that is later cleared still fails (a final-state check alone would miss it).
async function installWriteSpies(page: Page) {
  await page.addInitScript(() => {
    const counts = { storage: 0, indexedDB: 0, cookie: 0 };
    const installed = { storage: false, indexedDB: false, cookie: false };
    (window as unknown as { __writes: typeof counts }).__writes = counts;
    (window as unknown as { __spiesInstalled: typeof installed }).__spiesInstalled = installed;
    for (const name of ['setItem', 'removeItem', 'clear'] as const) {
      const original = Storage.prototype[name] as (...args: unknown[]) => unknown;
      (Storage.prototype as unknown as Record<string, unknown>)[name] = function (this: Storage, ...args: unknown[]) {
        counts.storage += 1;
        return original.apply(this, args);
      };
    }
    installed.storage = true;
    const factory = window.indexedDB;
    if (factory) {
      const open = factory.open.bind(factory);
      const remove = factory.deleteDatabase.bind(factory);
      factory.open = ((...args: Parameters<IDBFactory['open']>) => { counts.indexedDB += 1; return open(...args); }) as IDBFactory['open'];
      factory.deleteDatabase = ((...args: Parameters<IDBFactory['deleteDatabase']>) => { counts.indexedDB += 1; return remove(...args); }) as IDBFactory['deleteDatabase'];
      installed.indexedDB = true;
    }
    const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    if (cookie && cookie.get && cookie.set) {
      const setCookie = cookie.set;
      Object.defineProperty(Document.prototype, 'cookie', {
        configurable: true,
        get: cookie.get,
        set(this: Document, value: string) { counts.cookie += 1; setCookie.call(this, value); },
      });
      installed.cookie = true;
    }
  });
}
// Counts, plus whether each spy installed (an uninstalled spy would make a 0 count vacuous).
const writeCounts = (page: Page) =>
  page.evaluate(() => {
    const view = window as unknown as { __writes: unknown; __spiesInstalled: unknown };
    return { writes: view.__writes, installed: view.__spiesInstalled };
  });
const NO_WRITES = { writes: { storage: 0, indexedDB: 0, cookie: 0 }, installed: { storage: true, indexedDB: true, cookie: true } };

test('@viewer anonymous viewer: faithful shell, read-only network, no storage, no errors', async ({ page, context }) => {
  await installWriteSpies(page);
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const location = message.location().url;
    const host = location ? new URL(location).hostname : '';
    if (!APPROVED_HOSTS.some((re) => re.test(host))) problems.push(`console: ${message.text()}`);
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() !== 'GET') problems.push(`non-GET ${request.method()} ${url.href}`);
    const sameOrigin = url.origin === new URL(process.env.PARITY_VIEWER_URL as string).origin;
    if (sameOrigin && !VIEWER_PATHS.some((re) => re.test(url.pathname))) problems.push(`unexpected path ${url.pathname}`);
    if (!sameOrigin && url.protocol !== 'data:' && !APPROVED_HOSTS.some((re) => re.test(url.hostname))) problems.push(`unapproved host ${url.hostname}`);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/Jermilova');
  await expect(wrapper(page).locator('nav button')).toHaveCount(6);
  await expectNodeCountStatus(page, '14 nodes');
  expect(await tabLabels(page)).toEqual(TABS);
  // No pack/model selector in the header (the original's selector is a chevron dropdown).
  await expect(wrapper(page).locator('> div').first().locator('svg.lucide-chevron-down')).toHaveCount(0);

  const snap = await snapshot(page, 'viewer');
  expect(snap.canvas.collapsed).toMatchObject({ containers: 7, children: 0 });
  expect(snap.canvas.collapsed.edges).toHaveLength(6);
  expect(snap.canvas.mixed).toMatchObject({ containers: 7, children: 2 });
  expect(snap.canvas.expanded).toMatchObject({ containers: 7, children: 14 });
  // The model has 15 edges and the original Canvas hands all 15 to React Flow (unit parity
  // test), but React Flow draws 14: the original node component for mehg_ingested renders
  // only a target handle, so MeHg Ingested -> pTWI Exceedance has no source handle to draw
  // from. Same in the original page (the @compare test requires identical edge lists).
  expect(snap.canvas.expanded.edges).toHaveLength(14);
  expect(snap.canvas.expanded.edges.some((id) => id.startsWith('rf__edge-mehg_ingested_ptwi_exceedance'))).toBe(false);

  // A reload restores the initial (all collapsed) state.
  await page.setViewportSize({ width: 1440, height: 900 });
  await openTab(page, 'Detailed BN');
  await page.getByTitle('Expand all containers').click();
  // No storage, IndexedDB or cookie write across every tab, width and interaction above,
  // read immediately before the reload resets the counters.
  expect(await writeCounts(page)).toEqual(NO_WRITES);
  await page.reload();
  await expectNodeCountStatus(page, '14 nodes');
  await page.locator('.react-flow__node-containerNode').first().waitFor();
  expect((await settledCanvasState(page)).children).toBe(0);

  const storage = await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    idb: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).length : 0,
  }));
  expect(storage).toEqual({ local: 0, session: 0, idb: 0 });
  // The spies were re-installed by the reload; the reloaded page wrote nothing either.
  expect(await writeCounts(page)).toEqual(NO_WRITES);
  // The viewer itself sets no cookies (third-party tile hosts are out of scope here).
  expect((await context.cookies(process.env.PARITY_VIEWER_URL as string)).length).toBe(0);
  fs.writeFileSync(path.join(EVIDENCE, 'viewer-problems.json'), JSON.stringify(problems, null, 2));
  expect(problems).toEqual([]);
});

test('@original authenticated original with the Jermilova pack selected', async ({ page }) => {
  // Throwaway browser context: drop the original's persisted site uploads so they cannot
  // differ from the viewer. Nothing outside this context is touched.
  await page.addInitScript(() => localStorage.removeItem('sstac-bn-rrm-site-data'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/bn-rrm');
  await wrapper(page).locator('nav button').first().waitFor();
  await wrapper(page).locator('> div').first().locator('button:has(svg.lucide-chevron-down)').first().click();
  await page.getByRole('button', { name: new RegExp(JERMILOVA) }).click();
  await expectNodeCountStatus(page, '14 nodes');
  await snapshot(page, 'original');
});

test('@compare viewer equals original apart from the removed tabs and controls', async () => {
  const read = (label: string) => JSON.parse(fs.readFileSync(path.join(EVIDENCE, `${label}-snapshot.json`), 'utf8')) as Snapshot;
  const viewer = read('viewer');
  const original = read('original');
  const normalize = (text: string) => text.split('\n').map((line) => line.trim()).filter((line) => line && !REMOVED_LINES.has(line)).join('\n');

  expect(viewer.tabs).toEqual(original.tabs.filter((tab) => tab !== 'Review' && tab !== 'Case Studies'));
  expect(viewer.chrome).toContain('Frozen benchmark');
  expect(viewer.chrome).toEqual(original.chrome);
  expect(viewer.canvas).toEqual(original.canvas);
  const diffs: string[] = [];
  for (const key of Object.keys(original.text)) {
    if (normalize(viewer.text[key] ?? '') !== normalize(original.text[key])) diffs.push(key);
  }
  fs.writeFileSync(path.join(EVIDENCE, 'compare-result.json'), JSON.stringify({ diffs, tabs: viewer.tabs }, null, 2));
  expect(diffs).toEqual([]);
});
