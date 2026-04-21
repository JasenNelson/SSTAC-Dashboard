import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, LogLevel } from './logging';

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
