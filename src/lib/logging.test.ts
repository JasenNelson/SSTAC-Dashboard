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
// server-side aggregation -- endpoint removed (round-3 finding A)
//
// sendToAggregationService was removed in the round-3 Gemini review fix
// because /api/logs/store does not exist. The tests below assert the new
// contract: no fetch call is ever issued server-side, regardless of level.
// Console output (error/warn/debug/log) is the only sink.
// ---------------------------------------------------------------------------
describe('server-side aggregation (endpoint removed)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper: temporarily remove window to simulate server-side context.
  async function withServerContext<T>(fn: () => Promise<T>): Promise<T> {
    const savedWindow = globalThis.window;
    // @ts-expect-error -- deliberately deleting window to test server branch
    delete globalThis.window;
    try {
      return await fn();
    } finally {
      globalThis.window = savedWindow;
    }
  }

  it('server-side ERROR: does NOT call fetch (endpoint removed)', async () => {
    await withServerContext(async () => {
      logger.error('test error');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('server-side CRITICAL: does NOT call fetch (endpoint removed)', async () => {
    await withServerContext(async () => {
      logger.critical('critical security event');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('server-side DEBUG: does NOT call fetch', async () => {
    await withServerContext(async () => {
      logger.debug('debug message');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('server-side INFO: does NOT call fetch', async () => {
    await withServerContext(async () => {
      logger.info('info message');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('server-side WARN: does NOT call fetch', async () => {
    await withServerContext(async () => {
      logger.warn('warn message');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('server-side ERROR: console.error is still called in production mode', async () => {
    await withServerContext(async () => {
      const savedNodeEnv = process.env.NODE_ENV;
      // @ts-expect-error -- overriding readonly NODE_ENV for test
      process.env.NODE_ENV = 'production';
      try {
        logger.error('prod error');
        expect(vi.mocked(console.error)).toHaveBeenCalled();
      } finally {
        // @ts-expect-error -- restoring NODE_ENV
        process.env.NODE_ENV = savedNodeEnv;
      }
    });
  });
});
