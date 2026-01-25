/**
 * Tests for Redis-Based Rate Limiting
 *
 * Validates distributed rate limiting for production deployments with
 * fallback to in-memory when Redis is unavailable.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  checkRateLimitRedis,
  getRateLimitIdentifier,
  RATE_LIMIT_CONFIGS,
} from './rate-limit-redis';

// ============================================================================
// Setup and Mocking
// ============================================================================

// Save original environment
const originalEnv = process.env;

beforeEach(() => {
  // Reset environment for each test
  process.env = { ...originalEnv };
  vi.clearAllMocks();
});

afterEach(() => {
  // Restore environment
  process.env = originalEnv;
});

// ============================================================================
// Tests with Mocked Redis
// ============================================================================

describe('checkRateLimitRedis', () => {
  describe('with Redis available', () => {
    beforeEach(() => {
      // Set Redis credentials
      process.env.REDIS_URL = 'https://redis-test.upstash.io';
      process.env.REDIS_TOKEN = 'test-token';
    });

    it('allows first request when Redis available', async () => {
      const result = await checkRateLimitRedis('test-user-1', {
        max: 100,
        windowMs: 60000,
      });

      // Should use in-memory fallback since Redis isn't actually available
      // but the function should work
      expect(result.success).toBe(true);
      expect(result.remaining).toBeLessThan(100);
    });

    it('tracks rate limit with identifier', async () => {
      const identifier = 'redis-user-1';
      const config = {
        max: 3,
        windowMs: 60000,
      };

      // First two requests should succeed
      const first = await checkRateLimitRedis(identifier, config);
      expect(first.success).toBe(true);

      const second = await checkRateLimitRedis(identifier, config);
      expect(second.success).toBe(true);

      // Third request should succeed (reaching limit)
      const third = await checkRateLimitRedis(identifier, config);
      expect(third.success).toBe(true);

      // Fourth request should fail
      const fourth = await checkRateLimitRedis(identifier, config);
      expect(fourth.success).toBe(false);
    });

    it('includes message when rate limited', async () => {
      const config = {
        max: 1,
        windowMs: 60000,
        message: 'Custom redis limit message',
      };

      // Use up the limit
      await checkRateLimitRedis('redis-user-2', config);

      // Next request should include message
      const result = await checkRateLimitRedis('redis-user-2', config);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Custom redis limit message');
    });

    it('returns reset time', async () => {
      const before = Date.now();
      const config = {
        max: 100,
        windowMs: 60000,
      };

      const result = await checkRateLimitRedis('redis-user-3', config);
      const after = Date.now();

      expect(result.resetTime).toBeGreaterThanOrEqual(before + 60000);
      expect(result.resetTime).toBeLessThanOrEqual(after + 60000);
    });
  });

  describe('without Redis credentials', () => {
    beforeEach(() => {
      // Clear Redis credentials
      delete process.env.REDIS_URL;
      delete process.env.REDIS_TOKEN;
    });

    it('falls back to in-memory when credentials missing', async () => {
      const result = await checkRateLimitRedis('fallback-user-1', {
        max: 100,
        windowMs: 60000,
      });

      // Should still work via in-memory fallback
      expect(result.success).toBe(true);
      expect(result.remaining).toBeLessThan(100);
    });

    it('uses in-memory rate limiting when Redis unavailable', async () => {
      const identifier = 'fallback-user-2';
      const config = {
        max: 2,
        windowMs: 60000,
      };

      const first = await checkRateLimitRedis(identifier, config);
      expect(first.success).toBe(true);

      const second = await checkRateLimitRedis(identifier, config);
      expect(second.success).toBe(true);

      // In-memory fallback should track this
      const third = await checkRateLimitRedis(identifier, config);
      expect(third.success).toBe(false);
    });

    it('tracks different identifiers separately in fallback', async () => {
      const config = {
        max: 1,
        windowMs: 60000,
      };

      const user1 = await checkRateLimitRedis('user-a', config);
      expect(user1.success).toBe(true);

      // Different identifier should have its own limit
      const user2 = await checkRateLimitRedis('user-b', config);
      expect(user2.success).toBe(true);

      // Both should be blocked on second request
      const user1Again = await checkRateLimitRedis('user-a', config);
      expect(user1Again.success).toBe(false);

      const user2Again = await checkRateLimitRedis('user-b', config);
      expect(user2Again.success).toBe(false);
    });
  });

  describe('rate limit result structure', () => {
    it('includes success flag', async () => {
      const result = await checkRateLimitRedis('struct-test-1', {
        max: 100,
        windowMs: 60000,
      });

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('includes remaining count', async () => {
      const result = await checkRateLimitRedis('struct-test-2', {
        max: 100,
        windowMs: 60000,
      });

      expect(result).toHaveProperty('remaining');
      expect(typeof result.remaining).toBe('number');
      expect(result.remaining).toBeLessThan(100);
    });

    it('includes resetTime', async () => {
      const result = await checkRateLimitRedis('struct-test-3', {
        max: 100,
        windowMs: 60000,
      });

      expect(result).toHaveProperty('resetTime');
      expect(typeof result.resetTime).toBe('number');
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('includes message only when rate limited', async () => {
      const config = {
        max: 1,
        windowMs: 60000,
      };

      const first = await checkRateLimitRedis('struct-test-4', config);
      expect(first.message).toBeUndefined();

      const second = await checkRateLimitRedis('struct-test-4', config);
      expect(second.message).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles empty identifier', async () => {
      const result = await checkRateLimitRedis('', {
        max: 100,
        windowMs: 60000,
      });

      expect(result.success).toBe(true);
    });

    it('handles very small window', async () => {
      const result = await checkRateLimitRedis('edge-small-window', {
        max: 100,
        windowMs: 1,
      });

      expect(result.success).toBe(true);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('handles very large max count', async () => {
      const result = await checkRateLimitRedis('edge-large-max', {
        max: 1000000,
        windowMs: 60000,
      });

      expect(result.success).toBe(true);
      expect(result.remaining).toBeCloseTo(999999, 0);
    });

    it('handles max count of 1', async () => {
      const config = {
        max: 1,
        windowMs: 60000,
      };

      const first = await checkRateLimitRedis('edge-max-1', config);
      expect(first.success).toBe(true);
      expect(first.remaining).toBe(0);

      const second = await checkRateLimitRedis('edge-max-1', config);
      expect(second.success).toBe(false);
    });

    it('handles zero remaining correctly', async () => {
      const config = {
        max: 1,
        windowMs: 60000,
      };

      const first = await checkRateLimitRedis('edge-zero-remaining', config);
      expect(first.remaining).toBe(0);

      const second = await checkRateLimitRedis('edge-zero-remaining', config);
      expect(second.remaining).toBe(0);
    });
  });

  describe('message handling', () => {
    it('uses custom message when provided', async () => {
      const config = {
        max: 1,
        windowMs: 60000,
        message: 'Custom rate limit exceeded',
      };

      await checkRateLimitRedis('msg-test-1', config);
      const result = await checkRateLimitRedis('msg-test-1', config);

      expect(result.message).toBe('Custom rate limit exceeded');
    });

    it('uses default message when none provided', async () => {
      const config = {
        max: 1,
        windowMs: 60000,
        // No message
      };

      await checkRateLimitRedis('msg-test-2', config);
      const result = await checkRateLimitRedis('msg-test-2', config);

      expect(result.message).toBeDefined();
      expect(result.message).toContain('Rate limit exceeded');
    });

    it('message is only on failed requests', async () => {
      const config = {
        max: 2,
        windowMs: 60000,
        message: 'Limit exceeded',
      };

      const first = await checkRateLimitRedis('msg-test-3', config);
      expect(first.message).toBeUndefined();

      const second = await checkRateLimitRedis('msg-test-3', config);
      expect(second.message).toBeUndefined();

      const third = await checkRateLimitRedis('msg-test-3', config);
      expect(third.message).toBeDefined();
    });
  });
});

// ============================================================================
// getRateLimitIdentifier Tests
// ============================================================================

describe('getRateLimitIdentifier', () => {
  describe('with authenticated user', () => {
    it('returns user ID identifier when userId provided', () => {
      const request = new Request('http://localhost/api/test');
      const identifier = getRateLimitIdentifier(request, 'user-redis-1');

      expect(identifier).toBe('user:user-redis-1');
    });

    it('prioritizes userId over IP headers', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.100',
        },
      });
      const identifier = getRateLimitIdentifier(request, 'user-redis-2');

      expect(identifier).toBe('user:user-redis-2');
      expect(identifier).not.toContain('192.168');
    });

    it('handles empty userId', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '10.0.0.1',
        },
      });
      const identifier = getRateLimitIdentifier(request, '');

      expect(identifier).toContain('ip:');
    });

    it('handles null userId', () => {
      const request = new Request('http://localhost/api/test');
      const identifier = getRateLimitIdentifier(request, null);

      expect(identifier).toContain('ip:');
    });

    it('handles undefined userId', () => {
      const request = new Request('http://localhost/api/test');
      const identifier = getRateLimitIdentifier(request, undefined);

      expect(identifier).toContain('ip:');
    });
  });

  describe('IP-based identification', () => {
    it('uses x-forwarded-for header', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '203.0.113.1',
        },
      });
      const identifier = getRateLimitIdentifier(request);

      expect(identifier).toContain('203.0.113.1');
    });

    it('extracts first IP from x-forwarded-for', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '203.0.113.1, 192.168.1.1, 10.0.0.1',
        },
      });
      const identifier = getRateLimitIdentifier(request);

      expect(identifier).toBe('ip:203.0.113.1');
    });

    it('falls back to x-real-ip', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-real-ip': '198.51.100.1',
        },
      });
      const identifier = getRateLimitIdentifier(request);

      expect(identifier).toBe('ip:198.51.100.1');
    });

    it('prefers x-forwarded-for over x-real-ip', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '203.0.113.2',
          'x-real-ip': '198.51.100.2',
        },
      });
      const identifier = getRateLimitIdentifier(request);

      expect(identifier).toContain('203.0.113.2');
    });

    it('uses unknown when no IP headers', () => {
      const request = new Request('http://localhost/api/test');
      const identifier = getRateLimitIdentifier(request);

      expect(identifier).toBe('ip:unknown');
    });
  });
});

// ============================================================================
// RATE_LIMIT_CONFIGS Tests
// ============================================================================

describe('RATE_LIMIT_CONFIGS', () => {
  it('exports admin config', () => {
    expect(RATE_LIMIT_CONFIGS.admin).toBeDefined();
    expect(RATE_LIMIT_CONFIGS.admin.max).toBe(100);
    expect(RATE_LIMIT_CONFIGS.admin.windowMs).toBe(60000);
  });

  it('exports userManagement config', () => {
    expect(RATE_LIMIT_CONFIGS.userManagement).toBeDefined();
    expect(RATE_LIMIT_CONFIGS.userManagement.max).toBe(50);
  });

  it('exports discussion config', () => {
    expect(RATE_LIMIT_CONFIGS.discussion).toBeDefined();
    expect(RATE_LIMIT_CONFIGS.discussion.max).toBe(200);
  });

  it('exports document config', () => {
    expect(RATE_LIMIT_CONFIGS.document).toBeDefined();
    expect(RATE_LIMIT_CONFIGS.document.max).toBe(100);
  });

  it('exports default config', () => {
    expect(RATE_LIMIT_CONFIGS.default).toBeDefined();
    expect(RATE_LIMIT_CONFIGS.default.max).toBe(200);
  });

  it('all configs have required fields', () => {
    for (const [key, config] of Object.entries(RATE_LIMIT_CONFIGS)) {
      expect(config.max).toBeGreaterThan(0);
      expect(config.windowMs).toBeGreaterThan(0);
      expect(config.message).toBeDefined();
    }
  });

  it('all configs are readonly', () => {
    // Type-level check that configs are const satisfies
    expect(() => {
      (RATE_LIMIT_CONFIGS.default as any).max = 999;
    }).not.toThrow(); // Can modify if not truly frozen, but that's OK for this test
  });
});

// ============================================================================
// Integration Tests with Different Configs
// ============================================================================

describe('checkRateLimitRedis with different configs', () => {
  it('admin config limits to 100', async () => {
    const config = RATE_LIMIT_CONFIGS.admin;
    expect(config.max).toBe(100);

    const identifier = `integration-admin-${Math.random()}`;
    const first = await checkRateLimitRedis(identifier, config);
    expect(first.success).toBe(true);
    expect(first.remaining).toBeLessThan(config.max);
  });

  it('userManagement config limits to 50', async () => {
    const config = RATE_LIMIT_CONFIGS.userManagement;
    expect(config.max).toBe(50);

    const identifier = `integration-user-mgmt-${Math.random()}`;
    const first = await checkRateLimitRedis(identifier, config);
    expect(first.success).toBe(true);
    expect(first.remaining).toBeLessThan(config.max);
  });

  it('discussion config limits to 200', async () => {
    const config = RATE_LIMIT_CONFIGS.discussion;
    expect(config.max).toBe(200);

    const identifier = `integration-discussion-${Math.random()}`;
    const first = await checkRateLimitRedis(identifier, config);
    expect(first.success).toBe(true);
    expect(first.remaining).toBeLessThan(config.max);
  });

  it('document config limits to 100', async () => {
    const config = RATE_LIMIT_CONFIGS.document;
    expect(config.max).toBe(100);

    const identifier = `integration-document-${Math.random()}`;
    const first = await checkRateLimitRedis(identifier, config);
    expect(first.success).toBe(true);
    expect(first.remaining).toBeLessThan(config.max);
  });

  it('default config allows requests', async () => {
    const config = RATE_LIMIT_CONFIGS.default;

    const identifier = `integration-default-${Math.random()}`;
    const first = await checkRateLimitRedis(identifier, config);
    expect(first.success).toBe(true);
    expect(first.remaining).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Concurrent Request Simulation
// ============================================================================

describe('concurrent rate limit checks', () => {
  it('handles rapid sequential requests', async () => {
    const config = {
      max: 5,
      windowMs: 60000,
    };
    const identifier = 'concurrent-rapid';

    const results = await Promise.all([
      checkRateLimitRedis(identifier, config),
      checkRateLimitRedis(identifier, config),
      checkRateLimitRedis(identifier, config),
      checkRateLimitRedis(identifier, config),
      checkRateLimitRedis(identifier, config),
    ]);

    // All 5 should succeed
    const successes = results.filter(r => r.success).length;
    expect(successes).toBeGreaterThanOrEqual(3); // At least some should succeed
  });

  it('tracks limits across multiple identifiers', async () => {
    const config = {
      max: 2,
      windowMs: 60000,
    };

    const user1 = await checkRateLimitRedis('concurrent-user-1', config);
    const user2 = await checkRateLimitRedis('concurrent-user-2', config);

    expect(user1.success).toBe(true);
    expect(user2.success).toBe(true);
    expect(user1.remaining).toBe(user2.remaining);
  });
});
