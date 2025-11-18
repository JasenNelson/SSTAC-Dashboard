import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger } from '../logger';

describe('logger', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleLogSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleWarnSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleErrorSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleDebugSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('info', () => {
    it('should log info messages in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      logger.info('Test info message', { key: 'value' });
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleLogSpy.mock.calls[0][0] as string;
      expect(logCall).toContain('Test info message');
      // Parse JSON to check structure (pretty-printed JSON has newlines)
      const parsed = JSON.parse(logCall);
      expect(parsed.level).toBe('info');
      expect(parsed.key).toBe('value');
    });

    it('should not log info messages in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      logger.info('Test info message');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should format message as JSON in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      logger.info('Test message', { userId: '123', action: 'create' });
      
      const logCall = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logCall);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Test message');
      expect(parsed.userId).toBe('123');
      expect(parsed.action).toBe('create');
      expect(parsed.timestamp).toBeDefined();
    });

    it('should use pretty formatting in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      logger.info('Test');
      
      const logCall = consoleLogSpy.mock.calls[0][0] as string;
      // Pretty format includes newlines (indentation)
      expect(logCall).toContain('\n');
    });
  });

  describe('warn', () => {
    it('should log warn messages in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      logger.warn('Test warning', { warning: 'data' });
      
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleWarnSpy.mock.calls[0][0] as string;
      expect(logCall).toContain('Test warning');
      // Parse JSON to check structure (pretty-printed JSON has newlines)
      const parsed = JSON.parse(logCall);
      expect(parsed.level).toBe('warn');
    });

    it('should not log warn messages in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      logger.warn('Test warning');
      
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should always log error messages regardless of environment', () => {
      vi.stubEnv('NODE_ENV', 'production');
      logger.error('Test error');
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should log error with Error object', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const error = new Error('Test error message');
      logger.error('Operation failed', error, { operation: 'test' });
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleErrorSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logCall);
      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('Operation failed');
      expect(parsed.errorName).toBe('Error');
      expect(parsed.errorMessage).toBe('Test error message');
      expect(parsed.errorStack).toBeDefined();
      expect(parsed.operation).toBe('test');
    });

    it('should log error with string error', () => {
      vi.stubEnv('NODE_ENV', 'development');
      logger.error('Operation failed', 'String error', { context: 'test' });
      
      const logCall = consoleErrorSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logCall);
      expect(parsed.error).toBe('String error');
      expect(parsed.context).toBe('test');
    });

    it('should log error without error object', () => {
      vi.stubEnv('NODE_ENV', 'development');
      logger.error('Operation failed', undefined, { context: 'test' });
      
      const logCall = consoleErrorSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logCall);
      expect(parsed.message).toBe('Operation failed');
      expect(parsed.context).toBe('test');
      expect(parsed.errorName).toBeUndefined();
    });

    it('should use compact JSON in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = new Error('Test');
      logger.error('Error message', error);
      
      const logCall = consoleErrorSpy.mock.calls[0][0] as string;
      // Compact format has no newlines
      expect(logCall).not.toContain('\n');
      const parsed = JSON.parse(logCall);
      expect(parsed.level).toBe('error');
    });
  });

  describe('debug', () => {
    it('should log debug messages in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      logger.debug('Debug message', { debug: 'data' });
      
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleDebugSpy.mock.calls[0][0] as string;
      expect(logCall).toContain('Debug message');
      // Parse JSON to check structure (pretty-printed JSON has newlines)
      const parsed = JSON.parse(logCall);
      expect(parsed.level).toBe('debug');
    });

    it('should not log debug messages in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      logger.debug('Debug message');
      
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });
  });

  describe('context handling', () => {
    it('should include all context fields in log', () => {
      vi.stubEnv('NODE_ENV', 'development');
      logger.info('Test', {
        userId: '123',
        action: 'create',
        resource: 'document',
        metadata: { key: 'value' },
      });
      
      const logCall = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logCall);
      expect(parsed.userId).toBe('123');
      expect(parsed.action).toBe('create');
      expect(parsed.resource).toBe('document');
      expect(parsed.metadata).toEqual({ key: 'value' });
    });

    it('should handle empty context', () => {
      vi.stubEnv('NODE_ENV', 'development');
      logger.info('Test');
      
      const logCall = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logCall);
      expect(parsed.message).toBe('Test');
      expect(parsed.level).toBe('info');
      expect(parsed.timestamp).toBeDefined();
    });

    it('should handle undefined context', () => {
      vi.stubEnv('NODE_ENV', 'development');
      logger.info('Test', undefined);
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logCall);
      expect(parsed.message).toBe('Test');
    });
  });

  describe('timestamp', () => {
    it('should include ISO timestamp in all logs', () => {
      vi.stubEnv('NODE_ENV', 'development');
      logger.info('Test');
      
      const logCall = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logCall);
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      
      // Should be valid ISO date
      const date = new Date(parsed.timestamp);
      expect(date.toISOString()).toBe(parsed.timestamp);
    });
  });

  describe('production vs development formatting', () => {
    it('should use compact JSON in production for errors', () => {
      vi.stubEnv('NODE_ENV', 'production');
      logger.error('Error');
      
      const logCall = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logCall).not.toContain('\n');
      expect(logCall).not.toContain('  '); // No indentation
    });

    it('should use pretty JSON in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      logger.info('Info');
      
      const logCall = consoleLogSpy.mock.calls[0][0] as string;
      expect(logCall).toContain('\n');
      expect(logCall).toContain('  '); // Has indentation
    });
  });
});

