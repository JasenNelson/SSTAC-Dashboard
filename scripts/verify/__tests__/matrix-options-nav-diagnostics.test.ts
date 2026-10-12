import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '@playwright/test';

const { playwrightExpect, playwrightTest } = vi.hoisted(() => ({
  playwrightExpect: vi.fn(),
  playwrightTest: { info: vi.fn(() => ({ project: { name: 'chromium-auth' } })), skip: vi.fn() },
}));
vi.mock('@playwright/test', () => ({ expect: playwrightExpect, test: playwrightTest }));

import {
  clientErrorClass,
  gotoMatrixOptionsOrSkip,
  navigationTimeoutDiagnostic,
  navigationUrlCategory,
} from '../../../e2e/fixtures/matrix-options-nav';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  playwrightExpect.mockReset();
  playwrightTest.info.mockClear();
  playwrightTest.skip.mockClear();
});

function fakePage(events: string[], errorsToEmit = 0) {
  const handlers = new Set<(error: Error) => void>();
  const page = {
    on: vi.fn((_event: string, handler: (error: Error) => void) => {
      events.push('on');
      handlers.add(handler);
    }),
    off: vi.fn((_event: string, handler: (error: Error) => void) => {
      events.push('off');
      handlers.delete(handler);
    }),
    goto: vi.fn(async () => {
      events.push('goto');
      for (let n = 0; n < errorsToEmit; n += 1) {
        const error = n === 0 ? new TypeError('secret page error') : new Error('secret page error');
        for (const handler of handlers) handler(error);
      }
    }),
    url: vi.fn(() => 'http://127.0.0.1:3100/matrix-options?token=secret-query'),
    getByRole: vi.fn(() => ({ count: vi.fn(async () => 1) })),
    locator: vi.fn((selector: string) => selector.includes('data-primary-tablist-ready')
      ? { count: vi.fn(async () => 0) }
      : { count: vi.fn(async () => 1), first: () => ({ getAttribute: vi.fn(async () => 'secret-attribute') }) }),
    evaluate: vi.fn(async () => ({ readyState: 'complete', readyAttribute: 'secret-attribute', hydrationSentinel: 'secret-sentinel' })),
  };
  return { page: page as unknown as Page, handlers, raw: page };
}

describe('Matrix Options navigation timeout diagnostics', () => {
  it('uses fixed categories for URLs and client errors', () => {
    expect(navigationUrlCategory('https://example.test/matrix-options?token=secret')).toBe('matrix-options');
    expect(navigationUrlCategory('https://example.test/login?token=secret')).toBe('login');
    expect(navigationUrlCategory('https://example.test/private/secret')).toBe('other');
    expect(navigationUrlCategory('not a URL')).toBe('unknown');
    expect(clientErrorClass(new TypeError('secret'))).toBe('type');
    expect(clientErrorClass({ name: 'PrivateSecretError', message: 'secret' })).toBe('other');
    expect(clientErrorClass({ get name() { throw new Error('secret'); } })).toBe('other');
  });

  it('registers before navigation, bounds and redacts diagnostics, then rethrows the original assertion', async () => {
    const events: string[] = [];
    const { page, handlers, raw } = fakePage(events, 10);
    const original = new Error('original assertion secret');
    playwrightExpect.mockReturnValue({
      toBeVisible: vi.fn(async () => undefined),
      toBeAttached: vi.fn(async () => { throw original; }),
    });
    const output = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(gotoMatrixOptionsOrSkip(page)).rejects.toBe(original);

    expect(events).toEqual(['on', 'goto', 'off']);
    expect(handlers.size).toBe(0);
    expect(raw.on).toHaveBeenCalledWith('pageerror', expect.any(Function));
    expect(raw.off).toHaveBeenCalledWith('pageerror', expect.any(Function));
    expect(output).toHaveBeenCalledTimes(1);
    const rendered = String(output.mock.calls[0][0]);
    expect(rendered.length).toBeLessThan(400);
    expect(rendered).not.toMatch(/secret|token=|original assertion/i);
    const diagnostic = JSON.parse(rendered.slice('MATRIX_OPTIONS_NAV_TIMEOUT '.length));
    expect(Object.keys(diagnostic).sort()).toEqual([
      'clientErrorClasses', 'clientErrorOverflow', 'documentReadyState', 'headingCount',
      'hydrationSentinel', 'ready', 'readyAttribute', 'tablistCount', 'urlCategory',
    ].sort());
    expect(diagnostic).toMatchObject({
      urlCategory: 'matrix-options', headingCount: 1, tablistCount: 1,
      ready: false, readyAttribute: 'other', documentReadyState: 'complete',
      hydrationSentinel: 'unknown', clientErrorOverflow: true,
    });
    expect(diagnostic.clientErrorClasses).toEqual(['type', 'other', 'other', 'other']);
  });

  it('removes the listener on success and keeps unavailable states fixed', async () => {
    const events: string[] = [];
    const { page, handlers, raw } = fakePage(events);
    playwrightExpect.mockReturnValue({
      toBeVisible: vi.fn(async () => undefined),
      toBeAttached: vi.fn(async () => undefined),
    });
    const output = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await gotoMatrixOptionsOrSkip(page);
    expect(events).toEqual(['on', 'goto', 'off']);
    expect(handlers.size).toBe(0);
    expect(output).not.toHaveBeenCalled();

    raw.url.mockReturnValue('bad secret URL');
    raw.evaluate.mockImplementation(async () => { throw new Error('private failure'); });
    raw.getByRole.mockReturnValue({ count: vi.fn(async () => 10_000) });
    raw.locator.mockImplementation((selector: string) => selector.includes('data-primary-tablist-ready')
      ? { count: vi.fn(async () => 0) }
      : { count: vi.fn(async () => 10_000), first: () => ({ getAttribute: vi.fn(async () => 'secret-attribute') }) });
    const diagnostic = await navigationTimeoutDiagnostic(page, [], false);
    expect(diagnostic.urlCategory).toBe('unknown');
    expect(diagnostic.headingCount).toBe(99);
    expect(diagnostic.tablistCount).toBe(99);
    expect(diagnostic.documentReadyState).toBe('unknown');
    expect(diagnostic.hydrationSentinel).toBe('unknown');
    expect(JSON.stringify(diagnostic)).not.toMatch(/secret|private/i);

    raw.evaluate.mockResolvedValue({ readyState: 'interactive', readyAttribute: 'true', hydrationSentinel: 'true' });
    const ready = await navigationTimeoutDiagnostic(page, [], false);
    expect(ready.documentReadyState).toBe('interactive');
    expect(ready.hydrationSentinel).toBe('ready');
  });

  it('rethrows the original assertion within the diagnostic deadline when a browser operation never resolves', async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    const { page, handlers, raw } = fakePage(events);
    const original = new Error('original assertion secret');
    raw.getByRole.mockReturnValue({ count: vi.fn(() => new Promise<number>(() => undefined)) });
    playwrightExpect.mockReturnValue({
      toBeVisible: vi.fn(async () => undefined),
      toBeAttached: vi.fn(async () => { throw original; }),
    });
    const output = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const navigation = gotoMatrixOptionsOrSkip(page);
    const rejection = expect(navigation).rejects.toBe(original);
    await vi.advanceTimersByTimeAsync(1_500);
    await rejection;

    expect(events).toEqual(['on', 'goto', 'off']);
    expect(handlers.size).toBe(0);
    expect(output).toHaveBeenCalledWith('MATRIX_OPTIONS_NAV_TIMEOUT {"capture":"unavailable"}');
    expect(String(output.mock.calls[0][0])).not.toMatch(/secret/);
  });
});
