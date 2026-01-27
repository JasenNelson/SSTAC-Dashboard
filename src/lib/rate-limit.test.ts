/**
 * Tests for Rate Limiting Utility
 *
 * Validates in-memory rate limiting for protecting admin and management APIs
 * from abuse while allowing legitimate users.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitMiddleware,
  RATE_LIMIT_CONFIGS,
  type RateLimitOptions,
} from './rate-limit';

// ============================================================================
// Test Setup
// ============================================================================

// Mock the global setInterval to prevent test interference
beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// checkRateLimit Tests
// ============================================================================

describe('checkRateLimit', () => {
  describe('first request in window', () => {
    it('allows first request', () => {
      const result = checkRateLimit('test-user-1', RATE_LIMIT_CONFIGS.default);

      expect(result.success).toBe(true);
      expect(result.remaining).toBeLessThan(RATE_LIMIT_CONFIGS.default.max);
    });

    it('sets resetTime in future', () => {
      const before = Date.now();
      const result = checkRateLimit('test-user-2', RATE_LIMIT_CONFIGS.default);
      const after = Date.now();

      expect(result.resetTime).toBeGreaterThanOrEqual(before + RATE_LIMIT_CONFIGS.default.windowMs);
      expect(result.resetTime).toBeLessThanOrEqual(after + RATE_LIMIT_CONFIGS.default.windowMs);
    });

    it('returns max-1 remaining requests', () => {
      const result = checkRateLimit('test-user-3', RATE_LIMIT_CONFIGS.default);

      expect(result.remaining).toBe(RATE_LIMIT_CONFIGS.default.max - 1);
    });

    it('does not include message on success', () => {
      const result = checkRateLimit('test-user-4', RATE_LIMIT_CONFIGS.default);

      expect(result.message).toBeUndefined();
    });
  });

  describe('multiple requests in same window', () => {
    it('increments count on successive requests', () => {
      const identifier = 'test-user-5';
      const config = RATE_LIMIT_CONFIGS.default;

      const first = checkRateLimit(identifier, config);
      const second = checkRateLimit(identifier, config);
      const third = checkRateLimit(identifier, config);

      expect(first.remaining).toBeGreaterThan(second.remaining);
      expect(second.remaining).toBeGreaterThan(third.remaining);
    });

    it('decrements remaining count correctly', () => {
      const identifier = 'test-user-6';
      const config = RATE_LIMIT_CONFIGS.default;

      const first = checkRateLimit(identifier, config);
      expect(first.remaining).toBe(config.max - 1);

      const second = checkRateLimit(identifier, config);
      expect(second.remaining).toBe(config.max - 2);

      const third = checkRateLimit(identifier, config);
      expect(third.remaining).toBe(config.max - 3);
    });

    it('maintains same resetTime for requests in same window', () => {
      const identifier = 'test-user-7';
      const config = RATE_LIMIT_CONFIGS.default;

      const first = checkRateLimit(identifier, config);
      const second = checkRateLimit(identifier, config);

      expect(second.resetTime).toBe(first.resetTime);
    });
  });

  describe('rate limit exceeded', () => {
    it('blocks request when max count reached', () => {
      const identifier = 'test-user-8';
      const config: RateLimitOptions = {
        max: 3,
        windowMs: 60000,
      };

      // Use up all requests
      const first = checkRateLimit(identifier, config);
      expect(first.success).toBe(true);

      const second = checkRateLimit(identifier, config);
      expect(second.success).toBe(true);

      const third = checkRateLimit(identifier, config);
      expect(third.success).toBe(true);

      // Fourth request should fail
      const fourth = checkRateLimit(identifier, config);
      expect(fourth.success).toBe(false);
    });

    it('returns remaining=0 when limit exceeded', () => {
      const identifier = 'test-user-9';
      const config: RateLimitOptions = {
        max: 2,
        windowMs: 60000,
      };

      checkRateLimit(identifier, config);
      checkRateLimit(identifier, config);

      const exceeded = checkRateLimit(identifier, config);

      expect(exceeded.remaining).toBe(0);
    });

    it('returns error message when limit exceeded', () => {
      const identifier = 'test-user-10';
      const config: RateLimitOptions = {
        max: 1,
        windowMs: 60000,
        message: 'Custom rate limit message',
      };

      checkRateLimit(identifier, config);

      const exceeded = checkRateLimit(identifier, config);

      expect(exceeded.message).toBe('Custom rate limit message');
    });

    it('includes resetTime when limit exceeded', () => {
      const identifier = 'test-user-11';
      const config: RateLimitOptions = {
        max: 1,
        windowMs: 60000,
      };

      const first = checkRateLimit(identifier, config);
      const exceeded = checkRateLimit(identifier, config);

      expect(exceeded.resetTime).toBe(first.resetTime);
    });

    it('returns default message when none provided', () => {
      const identifier = 'test-user-12';
      const config: RateLimitOptions = {
        max: 1,
        windowMs: 60000,
        // No message field
      };

      checkRateLimit(identifier, config);
      const exceeded = checkRateLimit(identifier, config);

      expect(exceeded.message).toBeDefined();
      expect(exceeded.message).toContain('Rate limit exceeded');
    });
  });

  describe('different identifiers are independent', () => {
    it('tracks separate identifiers separately', () => {
      const config: RateLimitOptions = {
        max: 2,
        windowMs: 60000,
      };

      const user1First = checkRateLimit('user-1', config);
      const user2First = checkRateLimit('user-2', config);
      const user1Second = checkRateLimit('user-1', config);

      expect(user1First.remaining).toBe(1);
      expect(user2First.remaining).toBe(1);
      expect(user1Second.remaining).toBe(0);

      // user-2 should still have 1 remaining
      const user2Second = checkRateLimit('user-2', config);
      expect(user2Second.success).toBe(true);
      expect(user2Second.remaining).toBe(0);
    });

    it('does not share limits across identifiers', () => {
      const config: RateLimitOptions = {
        max: 1,
        windowMs: 60000,
      };

      const user1 = checkRateLimit('user-a', config);
      expect(user1.success).toBe(true);

      // user-b should still get through
      const user2 = checkRateLimit('user-b', config);
      expect(user2.success).toBe(true);

      // Both should be blocked on next attempt
      const user1Again = checkRateLimit('user-a', config);
      const user2Again = checkRateLimit('user-b', config);

      expect(user1Again.success).toBe(false);
      expect(user2Again.success).toBe(false);
    });
  });

  describe('different configs for same identifier', () => {
    it('allows different rate limits for same user with different configs', () => {
      const identifier = 'test-user-13';
      const strictConfig: RateLimitOptions = {
        max: 1,
        windowMs: 60000,
      };
      const lenientConfig: RateLimitOptions = {
        max: 100,
        windowMs: 60000,
      };

      // With strict config, second request fails
      const strict1 = checkRateLimit(identifier, strictConfig);
      expect(strict1.success).toBe(true);

      const strict2 = checkRateLimit(identifier, strictConfig);
      expect(strict2.success).toBe(false);

      // But a different key with lenient config should work
      const lenient1 = checkRateLimit(identifier + ':lenient', lenientConfig);
      expect(lenient1.success).toBe(true);
    });
  });

  describe('default options', () => {
    it('uses default config when not provided', () => {
      const identifier = 'test-user-14';
      const result = checkRateLimit(identifier);

      expect(result.success).toBe(true);
      expect(result.remaining).toBeLessThan(RATE_LIMIT_CONFIGS.default.max);
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
      const identifier = getRateLimitIdentifier(request, 'user-123');

      expect(identifier).toBe('user:user-123');
    });

    it('prioritizes userId over IP', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      });
      const identifier = getRateLimitIdentifier(request, 'user-456');

      expect(identifier).toBe('user:user-456');
      expect(identifier).not.toContain('192.168.1.1');
    });

    it('handles empty userId string', () => {
      const request = new Request('http://localhost/api/test');
      const identifier = getRateLimitIdentifier(request, '');

      // Empty string is falsy, should fall back to IP
      expect(identifier).toContain('ip:');
    });

    it('handles null userId', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-real-ip': '10.0.0.1',
        },
      });
      const identifier = getRateLimitIdentifier(request, null);

      expect(identifier).toContain('ip:');
      expect(identifier).toContain('10.0.0.1');
    });

    it('handles undefined userId', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '172.16.0.1',
        },
      });
      const identifier = getRateLimitIdentifier(request, undefined);

      expect(identifier).toContain('ip:');
    });
  });

  describe('IP-based identification', () => {
    it('uses x-forwarded-for header when available', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.100',
        },
      });
      const identifier = getRateLimitIdentifier(request);

      expect(identifier).toContain('192.168.1.100');
    });

    it('extracts first IP from x-forwarded-for with multiple IPs', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.100, 10.0.0.1, 172.16.0.1',
        },
      });
      const identifier = getRateLimitIdentifier(request);

      expect(identifier).toBe('ip:192.168.1.100');
    });

    it('falls back to x-real-ip when x-forwarded-for unavailable', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-real-ip': '203.0.113.42',
        },
      });
      const identifier = getRateLimitIdentifier(request);

      expect(identifier).toBe('ip:203.0.113.42');
    });

    it('prefers x-forwarded-for over x-real-ip', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.50',
          'x-real-ip': '203.0.113.42',
        },
      });
      const identifier = getRateLimitIdentifier(request);

      expect(identifier).toContain('192.168.1.50');
      expect(identifier).not.toContain('203.0.113.42');
    });

    it('uses "unknown" when no IP headers present', () => {
      const request = new Request('http://localhost/api/test');
      const identifier = getRateLimitIdentifier(request);

      expect(identifier).toBe('ip:unknown');
    });

    it('handles empty header values', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '',
        },
      });
      const identifier = getRateLimitIdentifier(request);

      // Should fall back gracefully
      expect(identifier).toMatch(/^ip:/);
    });
  });
});

// ============================================================================
// rateLimitMiddleware Tests
// ============================================================================

describe('rateLimitMiddleware', () => {
  describe('allowed requests', () => {
    it('returns null when request is allowed', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      });

      const response = rateLimitMiddleware(request, undefined, 'default');

      expect(response).toBeNull();
    });

    it('uses provided userId when checking rate limit', () => {
      const request = new Request('http://localhost/api/test');

      // First request as user-1
      const response1 = rateLimitMiddleware(request, 'user-1', 'admin');
      expect(response1).toBeNull();

      // First request as user-2 (different identifier)
      const response2 = rateLimitMiddleware(request, 'user-2', 'admin');
      expect(response2).toBeNull();
    });

    it('uses default config when configKey not provided', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.2',
        },
      });

      const response = rateLimitMiddleware(request);

      expect(response).toBeNull();
    });
  });

  describe('rate limited requests', () => {
    it('returns 429 response when rate limited', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.3',
        },
      });

      // Exhaust limit with admin config (100 max)
      const identifier = 'ip:192.168.1.3';
      for (let i = 0; i < RATE_LIMIT_CONFIGS.admin.max; i++) {
        checkRateLimit(identifier, RATE_LIMIT_CONFIGS.admin);
      }

      // Next request should be rate limited
      const response = rateLimitMiddleware(request, undefined, 'admin');

      expect(response).not.toBeNull();
      expect(response?.status).toBe(429);
    });

    it('includes error message in response body', async () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.4',
        },
      });

      // Exhaust limit
      const identifier = 'ip:192.168.1.4';
      for (let i = 0; i < RATE_LIMIT_CONFIGS.admin.max; i++) {
        checkRateLimit(identifier, RATE_LIMIT_CONFIGS.admin);
      }

      const response = rateLimitMiddleware(request, undefined, 'admin')!;
      const body = await response.json();

      expect(body.error).toBeDefined();
      expect(body.error).toContain('Too many admin requests');
    });

    it('includes Content-Type application/json header', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.5',
        },
      });

      // Exhaust limit
      const identifier = 'ip:192.168.1.5';
      for (let i = 0; i < RATE_LIMIT_CONFIGS.admin.max; i++) {
        checkRateLimit(identifier, RATE_LIMIT_CONFIGS.admin);
      }

      const response = rateLimitMiddleware(request, undefined, 'admin')!;

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('includes rate limit headers', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.6',
        },
      });

      // Exhaust limit
      const identifier = 'ip:192.168.1.6';
      for (let i = 0; i < RATE_LIMIT_CONFIGS.admin.max; i++) {
        checkRateLimit(identifier, RATE_LIMIT_CONFIGS.admin);
      }

      const response = rateLimitMiddleware(request, undefined, 'admin')!;

      expect(response.headers.has('X-RateLimit-Limit')).toBe(true);
      expect(response.headers.has('X-RateLimit-Remaining')).toBe(true);
      expect(response.headers.has('X-RateLimit-Reset')).toBe(true);
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('includes Retry-After header', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.7',
        },
      });

      // Exhaust limit
      const identifier = 'ip:192.168.1.7';
      for (let i = 0; i < RATE_LIMIT_CONFIGS.admin.max; i++) {
        checkRateLimit(identifier, RATE_LIMIT_CONFIGS.admin);
      }

      const response = rateLimitMiddleware(request, undefined, 'admin')!;
      const retryAfter = response.headers.get('Retry-After');

      expect(retryAfter).toBeDefined();
      const retryAfterSeconds = parseInt(retryAfter!);
      expect(retryAfterSeconds).toBeGreaterThan(0);
      expect(retryAfterSeconds).toBeLessThanOrEqual(60); // Window is 60 seconds
    });

    it('includes resetTime in response body', async () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.8',
        },
      });

      // Exhaust limit
      const identifier = 'ip:192.168.1.8';
      for (let i = 0; i < RATE_LIMIT_CONFIGS.admin.max; i++) {
        checkRateLimit(identifier, RATE_LIMIT_CONFIGS.admin);
      }

      const response = rateLimitMiddleware(request, undefined, 'admin')!;
      const body = await response.json();

      expect(body.resetTime).toBeDefined();
      expect(typeof body.resetTime).toBe('number');
      expect(body.resetTime).toBeGreaterThan(Date.now());
    });
  });

  describe('different rate limit configs', () => {
    it('applies admin config when specified', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.2.1',
        },
      });

      // Admin config has 100 max
      for (let i = 0; i < RATE_LIMIT_CONFIGS.admin.max; i++) {
        const response = rateLimitMiddleware(request, undefined, 'admin');
        expect(response).toBeNull();
      }

      // 101st request should fail
      const response = rateLimitMiddleware(request, undefined, 'admin');
      expect(response?.status).toBe(429);
    });

    it('applies userManagement config when specified', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.2.2',
        },
      });

      // userManagement config has 50 max
      for (let i = 0; i < RATE_LIMIT_CONFIGS.userManagement.max; i++) {
        const response = rateLimitMiddleware(request, undefined, 'userManagement');
        expect(response).toBeNull();
      }

      // 51st request should fail
      const response = rateLimitMiddleware(request, undefined, 'userManagement');
      expect(response?.status).toBe(429);
    });

    it('applies discussion config when specified', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.2.3',
        },
      });

      const response = rateLimitMiddleware(request, undefined, 'discussion');
      expect(response).toBeNull();
    });

    it('applies document config when specified', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.2.4',
        },
      });

      const response = rateLimitMiddleware(request, undefined, 'document');
      expect(response).toBeNull();
    });
  });

  describe('request header processing', () => {
    it('respects userId parameter', () => {
      const request = new Request('http://localhost/api/test');

      // First call with user-A
      const response1 = rateLimitMiddleware(request, 'user-A', 'default');
      expect(response1).toBeNull();

      // Second call with user-B (different identifier)
      const response2 = rateLimitMiddleware(request, 'user-B', 'default');
      expect(response2).toBeNull();
    });

    it('handles missing IP headers gracefully', () => {
      const request = new Request('http://localhost/api/test');
      // No x-forwarded-for or x-real-ip headers

      const response = rateLimitMiddleware(request, undefined, 'default');
      expect(response).toBeNull();
    });
  });
});

// ============================================================================
// RATE_LIMIT_CONFIGS Tests
// ============================================================================

describe('RATE_LIMIT_CONFIGS', () => {
  it('exports admin configuration', () => {
    expect(RATE_LIMIT_CONFIGS.admin).toBeDefined();
    expect(RATE_LIMIT_CONFIGS.admin.max).toBe(100);
    expect(RATE_LIMIT_CONFIGS.admin.windowMs).toBe(60 * 1000);
  });

  it('exports userManagement configuration', () => {
    expect(RATE_LIMIT_CONFIGS.userManagement).toBeDefined();
    expect(RATE_LIMIT_CONFIGS.userManagement.max).toBe(50);
  });

  it('exports discussion configuration', () => {
    expect(RATE_LIMIT_CONFIGS.discussion).toBeDefined();
    expect(RATE_LIMIT_CONFIGS.discussion.max).toBe(200);
  });

  it('exports document configuration', () => {
    expect(RATE_LIMIT_CONFIGS.document).toBeDefined();
    expect(RATE_LIMIT_CONFIGS.document.max).toBe(100);
  });

  it('exports default configuration', () => {
    expect(RATE_LIMIT_CONFIGS.default).toBeDefined();
    expect(RATE_LIMIT_CONFIGS.default.max).toBe(200);
  });

  it('all configs have required fields', () => {
    for (const [_key, config] of Object.entries(RATE_LIMIT_CONFIGS)) {
      expect(config.max).toBeGreaterThan(0);
      expect(config.windowMs).toBeGreaterThan(0);
      expect(config.message).toBeDefined();
    }
  });
});
