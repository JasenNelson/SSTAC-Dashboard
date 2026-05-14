import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, LogLevel } from './logging';

// Mock global fetch so sendToAggregationService tests do not hit the network.
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('Logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function parseJsonCall(method: 'log' | 'warn' | 'error' | 'debug'): Record<string, unknown> {
    const spy = vi.mocked(console[method]);
    expect(spy).toHaveBeenCalled();
    return JSON.parse(spy.mock.calls[0][0] as string);
  }

  describe('logApiRequest', () => {
    it('should log INFO for 2xx status codes', () => {
      logger.logApiRequest('GET', '/api/test', 200, 100);

      const entry = parseJsonCall('log');
      expect(entry.level).toBe(LogLevel.INFO);
      expect(entry.message).toBe('API GET /api/test');
      expect(entry.context).toMatchObject({
        method: 'GET',
        path: '/api/test',
        statusCode: 200,
        duration: 100,
      });
    });

    it('should log WARN for 4xx status codes', () => {
      logger.logApiRequest('POST', '/api/data', 404, 50);

      const entry = parseJsonCall('warn');
      expect(entry.level).toBe(LogLevel.WARN);
      expect(entry.message).toBe('API POST /api/data');
      expect(entry.context).toMatchObject({ statusCode: 404 });
    });

    it('should log ERROR for 5xx status codes', () => {
      logger.logApiRequest('PUT', '/api/update', 500, 200);

      const entry = parseJsonCall('error');
      expect(entry.level).toBe(LogLevel.ERROR);
      expect(entry.context).toMatchObject({ statusCode: 500 });
    });
  });

  describe('logDatabaseQuery', () => {
    it('should log DEBUG for successful queries', () => {
      logger.logDatabaseQuery('SELECT * FROM users', 10, true);

      const entry = parseJsonCall('debug');
      expect(entry.level).toBe(LogLevel.DEBUG);
      expect(entry.message).toBe('Database query executed');
      expect(entry.context).toMatchObject({
        query: 'SELECT * FROM users',
        success: true,
      });
    });

    it('should log ERROR for failed queries', () => {
      logger.logDatabaseQuery('INSERT INTO logs', 5, false);

      const entry = parseJsonCall('error');
      expect(entry.level).toBe(LogLevel.ERROR);
      expect(entry.message).toBe('Database query failed');
      expect(entry.context).toMatchObject({ success: false });
    });
  });

  describe('logSecurityEvent', () => {
    it('should log with correct severity', () => {
      logger.logSecurityEvent('unauthorized_access', 'critical');

      const entry = parseJsonCall('error');
      expect(entry.level).toBe(LogLevel.CRITICAL);
      expect(entry.message).toBe('Security: unauthorized_access');
    });

    it('should log info severity correctly', () => {
      logger.logSecurityEvent('rate_limit', 'info');

      const entry = parseJsonCall('log');
      expect(entry.level).toBe(LogLevel.INFO);
      expect(entry.message).toBe('Security: rate_limit');
    });

    it('should log warn severity correctly', () => {
      logger.logSecurityEvent('suspicious_activity', 'warn');

      const entry = parseJsonCall('warn');
      expect(entry.level).toBe(LogLevel.WARN);
      expect(entry.message).toBe('Security: suspicious_activity');
    });
  });
});

// ---------------------------------------------------------------------------
// sendToAggregationService -- Items 3 (absolute URL) and 4 (CRITICAL filter)
// ---------------------------------------------------------------------------
describe('sendToAggregationService', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    fetchMock.mockReset();
    // fetchMock returns a resolved promise by default so the .catch() absorbs it.
    fetchMock.mockResolvedValue({ ok: true });
    // Snapshot relevant env vars so we can restore them.
    originalEnv = {
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      NODE_ENV: process.env.NODE_ENV,
    };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalEnv.NEXT_PUBLIC_SITE_URL === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalEnv.NEXT_PUBLIC_SITE_URL;
    }
    vi.restoreAllMocks();
  });

  // Helper: temporarily remove window to simulate server-side context.
  // The output() method only calls sendToAggregationService when typeof window
  // === 'undefined', so all server-side tests must operate in this context.
  async function withServerContext<T>(
    fn: () => Promise<T>,
    extraSetup?: () => void,
  ): Promise<T> {
    const savedWindow = globalThis.window;
    // @ts-expect-error -- deliberately deleting window to test server branch
    delete globalThis.window;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.example.com';
    extraSetup?.();
    try {
      return await fn();
    } finally {
      globalThis.window = savedWindow;
      delete process.env.NEXT_PUBLIC_SITE_URL;
    }
  }

  // --- Item 4: CRITICAL events must reach persistence (P2 fix) ---
  // All tests run in server context (window deleted) so sendToAggregationService is called.

  it('server-side: persists ERROR events', async () => {
    await withServerContext(async () => {
      logger.error('test error');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).toHaveBeenCalledWith(
        'https://app.example.com/api/logs/store',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('server-side: persists CRITICAL events (Item 4 fix -- previously silently dropped)', async () => {
    // CRITICAL was excluded from persistence before this fix (filter was === ERROR only).
    await withServerContext(async () => {
      logger.critical('critical security event');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).toHaveBeenCalledWith(
        'https://app.example.com/api/logs/store',
        expect.objectContaining({ method: 'POST' }),
      );
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.level).toBe(LogLevel.CRITICAL);
    });
  });

  it('server-side: does NOT persist DEBUG events', async () => {
    await withServerContext(async () => {
      logger.debug('debug message');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('server-side: does NOT persist INFO events', async () => {
    await withServerContext(async () => {
      logger.info('info message');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('server-side: does NOT persist WARN events', async () => {
    await withServerContext(async () => {
      logger.warn('warn message');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // --- Item 3: server-side absolute URL (P2 fix) ---
  // The output() method only calls sendToAggregationService server-side (typeof window
  // === 'undefined'). We simulate server context by deleting globalThis.window.

  it('server-side: fetch uses absolute URL when NEXT_PUBLIC_SITE_URL is set (Item 3 fix)', async () => {
    await withServerContext(async () => {
      logger.error('server-side error');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).toHaveBeenCalledWith(
        'https://app.example.com/api/logs/store',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('server-side: CRITICAL uses absolute URL (Item 3 + Item 4 combined)', async () => {
    await withServerContext(async () => {
      // Trailing slash in SITE_URL must not produce double-slash in the path.
      process.env.NEXT_PUBLIC_SITE_URL = 'https://app.example.com/';
      logger.critical('critical server-side event');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).toHaveBeenCalledWith(
        'https://app.example.com/api/logs/store',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('server-side: warns and skips when NEXT_PUBLIC_SITE_URL is missing in production', async () => {
    const savedWindow = globalThis.window;
    // @ts-expect-error -- deliberately deleting window to test server branch
    delete globalThis.window;
    const savedNodeEnv = process.env.NODE_ENV;
    // @ts-expect-error -- overriding readonly NODE_ENV for test
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_SITE_URL;

    try {
      logger.error('error without site url');
      await new Promise((resolve) => setTimeout(resolve, 0));
      // fetch must NOT be called (skip, not throw).
      expect(fetchMock).not.toHaveBeenCalled();
      // A warning must be emitted.
      expect(vi.mocked(console.warn)).toHaveBeenCalledWith(
        expect.stringContaining('NEXT_PUBLIC_SITE_URL'),
      );
    } finally {
      globalThis.window = savedWindow;
      // @ts-expect-error -- restoring NODE_ENV
      process.env.NODE_ENV = savedNodeEnv;
    }
  });

  it('server-side: uses localhost:3000 fallback in development when NEXT_PUBLIC_SITE_URL is missing', async () => {
    const savedWindow = globalThis.window;
    // @ts-expect-error -- deliberately deleting window to test server branch
    delete globalThis.window;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    // NODE_ENV is 'test' in vitest; set to 'development' to test the fallback.
    const savedNodeEnv = process.env.NODE_ENV;
    // @ts-expect-error -- overriding readonly NODE_ENV for test
    process.env.NODE_ENV = 'development';

    try {
      logger.error('error in dev without site url');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/logs/store',
        expect.anything(),
      );
    } finally {
      globalThis.window = savedWindow;
      // @ts-expect-error -- restoring NODE_ENV
      process.env.NODE_ENV = savedNodeEnv;
    }
  });
});
