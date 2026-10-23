import { expect, test } from '@playwright/test';

// The anonymous, read-only Jermilova viewer served by this app from the committed export
// under public/Jermilova/ (src/lib/jermilova-public/route-config.ts). Runs without a
// session: it must never redirect to /login, never write, and never touch the
// authenticated app's own paths.
const TABS = ['Guide', 'Conceptual', 'Detailed BN', 'CPT', 'Map', 'Data'];

test.describe('anonymous /Jermilova viewer', () => {
  test('loads without login, shows the six read-only tabs and the Jermilova model, and makes no writes', async ({ page, baseURL }) => {
    // Room for the per-step waits below, so a slow step names its locator instead of the
    // whole test hitting the config's 60 s ceiling.
    test.setTimeout(180_000);
    const origin = new URL(baseURL as string).origin;
    // Count every storage, IndexedDB and cookie write from the first script on (a write that
    // is later cleared still fails), and record that each spy installed.
    await page.addInitScript(() => {
      const counts = { storage: 0, indexedDB: 0, cookie: 0 };
      const installed = { storage: false, indexedDB: false, cookie: false };
      (window as unknown as { __writes: unknown }).__writes = { counts, installed };
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
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (request.method() !== 'GET') problems.push(`non-GET ${request.method()} ${url.pathname}`);
      if (url.origin === origin && !/^\/Jermilova(\/|$)|^\/favicon\.ico$/.test(url.pathname)) problems.push(`unexpected path ${url.pathname}`);
    });

    const response = await page.goto('/Jermilova/');
    expect(response?.status()).toBe(200);
    // Exactly one trailing-slash redirect to the mount; never the login page.
    expect(new URL(page.url()).pathname).toBe('/Jermilova');
    const redirectedFrom = response?.request().redirectedFrom();
    expect(redirectedFrom ? new URL(redirectedFrom.url()).pathname : null).toBe('/Jermilova/');
    expect(redirectedFrom?.redirectedFrom() ?? null).toBeNull();
    const headers = response?.headers() ?? {};
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-frame-options']).toBe('DENY');
    // The page is revalidated on every load (route-config.ts).
    expect(headers['cache-control']).toBe('no-cache');

    const wrapper = page.locator('.bn-rrm-wrapper');
    await expect(wrapper.locator('nav button')).toHaveCount(6, { timeout: 60_000 });
    expect((await wrapper.locator('nav button').allInnerTexts()).map((text) => text.trim())).toEqual(TABS);
    // The shell's node-count status (scoped: the results badge also mentions "14 nodes").
    await expect(wrapper.locator('> div').first().getByText(/^\d+ nodes$/)).toHaveText('14 nodes', { timeout: 60_000 });
    await expect(page.getByText('Frozen benchmark', { exact: false }).first()).toBeVisible();
    await expect(wrapper.locator('nav button', { hasText: 'Review' })).toHaveCount(0);
    await expect(wrapper.locator('nav button', { hasText: 'Case Studies' })).toHaveCount(0);

    // Every tab loads its own lazy chunk and content under the route's CSP.
    const main = page.locator('.bn-rrm-wrapper > main');
    const ready: Record<string, () => Promise<unknown>> = {
      Guide: () => main.locator('h2').first().waitFor({ timeout: 60_000 }),
      Conceptual: () => main.locator('h2').first().waitFor({ timeout: 60_000 }),
      'Detailed BN': () => page.locator('.react-flow__node').first().waitFor({ timeout: 60_000 }),
      CPT: () => main.getByText(/With CPT/).first().waitFor({ timeout: 60_000 }),
      Map: () => page.locator('.leaflet-container').first().waitFor({ timeout: 60_000 }),
      Data: () => page.getByPlaceholder('Filter values...').waitFor({ timeout: 60_000 }),
    };
    for (const tab of TABS) {
      await wrapper.locator('nav button').filter({ hasText: tab }).first().click();
      await ready[tab]();
    }

    const storage = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }));
    expect(storage).toEqual({ local: 0, session: 0 });
    // No cookie on this origin either (the anonymous context starts empty).
    expect(await page.context().cookies(origin)).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __writes: unknown }).__writes)).toEqual({
      counts: { storage: 0, indexedDB: 0, cookie: 0 },
      installed: { storage: true, indexedDB: true, cookie: true },
    });
    expect(problems).toEqual([]);
  });
});
