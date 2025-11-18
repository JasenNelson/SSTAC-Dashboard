import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitMiddleware,
  RATE_LIMIT_CONFIGS,
  type RateLimitOptions,
} from '../rate-limit';

describe('rate-limit', () => {
  beforeEach(() => {
    // Note: Rate limit store is in-memory and shared across tests
    // Each test should use unique identifiers to avoid conflicts
    // Clear the store before each test to ensure isolation
    // Access the internal store via the module (if possible) or use unique IDs
  });

  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      // Use timestamp to ensure unique identifier per test run
      const identifier = `test-user-first-${Date.now()}-${Math.random()}`;
      const result = checkRateLimit(identifier, RATE_LIMIT_CONFIGS.default);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(199); // 200 - 1
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should track multiple requests within window', () => {
      // Use timestamp to ensure unique identifier per test run
      const identifier = `test-user-track-multiple-${Date.now()}-${Math.random()}`;
      const config = RATE_LIMIT_CONFIGS.default;

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(identifier, config);
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(200 - (i + 1));
      }
    });

    it('should block requests when limit exceeded', () => {
      const identifier = 'test-user-blocked';
      const config: RateLimitOptions = {
        max: 3,
        windowMs: 60000,
        message: 'Rate limit exceeded',
      };

      // Make 3 requests (should succeed)
      checkRateLimit(identifier, config);
      checkRateLimit(identifier, config);
      checkRateLimit(identifier, config);

      // 4th request should fail
      const result = checkRateLimit(identifier, config);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.message).toBe('Rate limit exceeded');
    });

    it('should reset after window expires', async () => {
      // Use timestamp to ensure unique identifier per test run
      const identifier = `test-user-reset-window-${Date.now()}-${Math.random()}`;
      const config: RateLimitOptions = {
        max: 2,
        windowMs: 100, // Very short window for testing
      };

      // Exhaust limit
      checkRateLimit(identifier, config);
      checkRateLimit(identifier, config);
      const blocked = checkRateLimit(identifier, config);
      expect(blocked.success).toBe(false);

      // Wait for window to expire (add buffer for timing precision)
      await new Promise(resolve => setTimeout(resolve, 250));

      // Should allow new requests (window expired, new entry created)
      const result = checkRateLimit(identifier, config);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it('should handle different identifiers separately', () => {
      const config = RATE_LIMIT_CONFIGS.default;

      // User 1 makes requests
      const user1Result1 = checkRateLimit('user-1', config);
      const user1Result2 = checkRateLimit('user-1', config);

      // User 2 makes requests
      const user2Result1 = checkRateLimit('user-2', config);
      const user2Result2 = checkRateLimit('user-2', config);

      // Both should be tracked separately
      expect(user1Result1.remaining).toBe(199);
      expect(user1Result2.remaining).toBe(198);
      expect(user2Result1.remaining).toBe(199);
      expect(user2Result2.remaining).toBe(198);
    });

    it('should use custom message when provided', () => {
      const identifier = 'test-user-custom-message';
      const config: RateLimitOptions = {
        max: 1,
        windowMs: 60000,
        message: 'Custom rate limit message',
      };

      checkRateLimit(identifier, config);
      const result = checkRateLimit(identifier, config);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Custom rate limit message');
    });

    it('should handle admin config limits', () => {
      const result = checkRateLimit('admin-user', RATE_LIMIT_CONFIGS.admin);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(99); // 100 - 1
    });

    it('should handle discussion config limits', () => {
      const result = checkRateLimit('user', RATE_LIMIT_CONFIGS.discussion);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(199); // 200 - 1
    });
  });

  describe('getRateLimitIdentifier', () => {
    it('should use user ID when provided', () => {
      const request = new Request('http://localhost/api/test');
      const identifier = getRateLimitIdentifier(request, 'user-123');
      expect(identifier).toBe('user:user-123');
    });

    it('should use IP address when user ID not provided', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '192.168.1.1');
      const request = new Request('http://localhost/api/test', { headers });
      const identifier = getRateLimitIdentifier(request, null);
      expect(identifier).toBe('ip:192.168.1.1');
    });

    it('should use x-real-ip when x-forwarded-for not available', () => {
      const headers = new Headers();
      headers.set('x-real-ip', '10.0.0.1');
      const request = new Request('http://localhost/api/test', { headers });
      const identifier = getRateLimitIdentifier(request, null);
      expect(identifier).toBe('ip:10.0.0.1');
    });

    it('should use first IP from x-forwarded-for comma-separated list', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '192.168.1.1, 10.0.0.1, 172.16.0.1');
      const request = new Request('http://localhost/api/test', { headers });
      const identifier = getRateLimitIdentifier(request, null);
      expect(identifier).toBe('ip:192.168.1.1');
    });

    it('should fallback to "unknown" when no IP headers available', () => {
      const request = new Request('http://localhost/api/test');
      const identifier = getRateLimitIdentifier(request, null);
      expect(identifier).toBe('ip:unknown');
    });

    it('should prefer user ID over IP address', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '192.168.1.1');
      const request = new Request('http://localhost/api/test', { headers });
      const identifier = getRateLimitIdentifier(request, 'user-456');
      expect(identifier).toBe('user:user-456');
    });
  });

  describe('rateLimitMiddleware', () => {
    it('should return null when rate limit not exceeded', () => {
      const request = new Request('http://localhost/api/test');
      const result = rateLimitMiddleware(request, 'user-123', 'default');
      expect(result).toBeNull();
    });

    it('should return 429 response when rate limit exceeded', async () => {
      const request = new Request('http://localhost/api/test');
      // Use timestamp to ensure unique identifier per test run
      const userId = `user-429-test-${Date.now()}-${Math.random()}`;
      
      // Exhaust the rate limit by making multiple requests
      // Using admin config which has lower limit (100)
      for (let i = 0; i < 101; i++) {
        rateLimitMiddleware(request, userId, 'admin');
      }
      
      // Next request should be blocked
      const result = rateLimitMiddleware(request, userId, 'admin');
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.status).toBe(429);
        // Response.body is a ReadableStream, need to read it
        const bodyText = await result.text();
        const json = JSON.parse(bodyText);
        expect(json.error).toBeDefined();
      }
    });

    it('should include rate limit headers in response when exceeded', () => {
      const request = new Request('http://localhost/api/test');
      // Use timestamp to ensure unique identifier per test run
      const userId = `user-headers-${Date.now()}-${Math.random()}`;
      
      // Exhaust the rate limit
      for (let i = 0; i < 101; i++) {
        rateLimitMiddleware(request, userId, 'admin');
      }
      
      const result = rateLimitMiddleware(request, userId, 'admin');
      
      if (result) {
        expect(result.headers.get('X-RateLimit-Limit')).toBe('100');
        expect(result.headers.get('X-RateLimit-Remaining')).toBe('0');
        expect(result.headers.get('X-RateLimit-Reset')).toBeDefined();
        expect(result.headers.get('Retry-After')).toBeDefined();
        expect(Number.parseInt(result.headers.get('Retry-After') || '0')).toBeGreaterThan(0);
      }
    });

    it('should use correct config key', () => {
      const request = new Request('http://localhost/api/test');
      
      // Test admin config
      const adminResult = rateLimitMiddleware(request, 'admin-user', 'admin');
      expect(adminResult).toBeNull(); // Should pass first request
      
      // Test discussion config
      const discussionResult = rateLimitMiddleware(request, 'user', 'discussion');
      expect(discussionResult).toBeNull(); // Should pass first request
    });

    it('should handle null userId', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '192.168.1.1');
      const request = new Request('http://localhost/api/test', { headers });
      const result = rateLimitMiddleware(request, null, 'default');
      expect(result).toBeNull(); // Should pass first request
    });
  });

  describe('RATE_LIMIT_CONFIGS', () => {
    it('should have all required config keys', () => {
      expect(RATE_LIMIT_CONFIGS).toHaveProperty('admin');
      expect(RATE_LIMIT_CONFIGS).toHaveProperty('userManagement');
      expect(RATE_LIMIT_CONFIGS).toHaveProperty('discussion');
      expect(RATE_LIMIT_CONFIGS).toHaveProperty('document');
      expect(RATE_LIMIT_CONFIGS).toHaveProperty('default');
    });

    it('should have correct admin config limits', () => {
      expect(RATE_LIMIT_CONFIGS.admin.max).toBe(100);
      expect(RATE_LIMIT_CONFIGS.admin.windowMs).toBe(60000);
      expect(RATE_LIMIT_CONFIGS.admin.message).toBeDefined();
    });

    it('should have correct discussion config limits', () => {
      expect(RATE_LIMIT_CONFIGS.discussion.max).toBe(200);
      expect(RATE_LIMIT_CONFIGS.discussion.windowMs).toBe(60000);
    });

    it('should have correct default config limits', () => {
      expect(RATE_LIMIT_CONFIGS.default.max).toBe(200);
      expect(RATE_LIMIT_CONFIGS.default.windowMs).toBe(60000);
    });
  });
});

