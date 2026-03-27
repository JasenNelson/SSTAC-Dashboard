import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, LogLevel } from './logging';

describe('Logger', () => {
  let consoleSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Spy on console.log which is used in development environment
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Also spy on other console methods just in case
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logApiRequest', () => {
    it('should log INFO for 2xx status codes', () => {
      logger.logApiRequest('GET', '/api/test', 200, 100);

      expect(consoleSpy).toHaveBeenCalled();
      const lastCall = consoleSpy.mock.calls[0];
      expect(lastCall[0]).toContain(`[${LogLevel.INFO}]`);
      expect(lastCall[0]).toContain('API GET /api/test');
      expect(lastCall[1]).toMatchObject({
        method: 'GET',
        path: '/api/test',
        statusCode: 200,
        duration: 100,
      });
    });

    it('should log WARN for 4xx status codes', () => {
      logger.logApiRequest('POST', '/api/data', 404, 50);

      expect(consoleSpy).toHaveBeenCalled();
      const lastCall = consoleSpy.mock.calls[0];
      expect(lastCall[0]).toContain(`[${LogLevel.WARN}]`);
      expect(lastCall[0]).toContain('API POST /api/data');
      expect(lastCall[1]).toMatchObject({
        statusCode: 404,
      });
    });

    it('should log ERROR for 5xx status codes', () => {
      logger.logApiRequest('PUT', '/api/update', 500, 200);

      expect(consoleSpy).toHaveBeenCalled();
      const lastCall = consoleSpy.mock.calls[0];
      expect(lastCall[0]).toContain(`[${LogLevel.ERROR}]`);
      expect(lastCall[1]).toMatchObject({
        statusCode: 500,
      });
    });
  });

  describe('logDatabaseQuery', () => {
    it('should log DEBUG for successful queries', () => {
      logger.logDatabaseQuery('SELECT * FROM users', 10, true);

      expect(consoleSpy).toHaveBeenCalled();
      const lastCall = consoleSpy.mock.calls[0];
      expect(lastCall[0]).toContain(`[${LogLevel.DEBUG}]`);
      expect(lastCall[0]).toContain('Database query executed');
      expect(lastCall[1]).toMatchObject({
        query: 'SELECT * FROM users',
        success: true,
      });
    });

    it('should log ERROR for failed queries', () => {
      logger.logDatabaseQuery('INSERT INTO logs', 5, false);

      expect(consoleSpy).toHaveBeenCalled();
      const lastCall = consoleSpy.mock.calls[0];
      expect(lastCall[0]).toContain(`[${LogLevel.ERROR}]`);
      expect(lastCall[0]).toContain('Database query failed');
      expect(lastCall[1]).toMatchObject({
        success: false,
      });
    });
  });

  describe('logSecurityEvent', () => {
    it('should log with correct severity', () => {
      logger.logSecurityEvent('unauthorized_access', 'critical');

      expect(consoleSpy).toHaveBeenCalled();
      const lastCall = consoleSpy.mock.calls[0];
      expect(lastCall[0]).toContain(`[${LogLevel.CRITICAL}]`);
      expect(lastCall[0]).toContain('Security: unauthorized_access');
    });

    it('should log info severity correctly', () => {
      logger.logSecurityEvent('rate_limit', 'info');

      expect(consoleSpy).toHaveBeenCalled();
      const lastCall = consoleSpy.mock.calls[0];
      expect(lastCall[0]).toContain(`[${LogLevel.INFO}]`);
    });

    it('should log warn severity correctly', () => {
      logger.logSecurityEvent('suspicious_activity', 'warn');

      expect(consoleSpy).toHaveBeenCalled();
      const lastCall = consoleSpy.mock.calls[0];
      expect(lastCall[0]).toContain(`[${LogLevel.WARN}]`);
    });
  });
});
