/**
 * Redis-Based Rate Limiting for Production Deployments
 * Task 2.4 - Distributed Rate Limiting
 *
 * Supports both Upstash Redis (production) and local Redis (development)
 * Falls back to in-memory if Redis unavailable
 *
 * Configuration:
 * - Production: REDIS_URL and REDIS_TOKEN (Upstash)
 * - Development: Use local Redis or in-memory fallback
 *
 * Environment Variables:
 * REDIS_URL=https://redis-url.upstash.io
 * REDIS_TOKEN=your-token
 */

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  message?: string;
}

interface RateLimitOptions {
  max: number;
  windowMs: number;
  message?: string;
}

// Redis client instance (lazy-loaded)
let redisClient: any = null;
let redisAvailable = false;

/**
 * Initialize Redis client if credentials available
 */
async function initializeRedis() {
  if (redisAvailable !== undefined && redisAvailable !== null) {
    return redisAvailable;
  }

  try {
    // Only try to import if Redis credentials are available
    if (!process.env.REDIS_URL || !process.env.REDIS_TOKEN) {
      console.log('⚠️ Redis credentials not configured - using in-memory fallback');
      redisAvailable = false;
      return false;
    }

    // Lazy import Upstash Redis client
    const { Redis } = await import('@upstash/redis');

    redisClient = new Redis({
      url: process.env.REDIS_URL,
      token: process.env.REDIS_TOKEN,
    });

    // Test connection
    await redisClient.ping();
    console.log('✅ Redis rate limiting initialized');
    redisAvailable = true;
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error);
    console.log('⚠️ Falling back to in-memory rate limiting');
    redisAvailable = false;
    return false;
  }
}

/**
 * Check rate limit using Redis (or fallback to in-memory)
 *
 * Implementation uses a sliding window counter approach:
 * - Key: "{identifier}:rl"
 * - Value: JSON with count and resetTime
 * - TTL: Window duration
 */
export async function checkRateLimitRedis(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const isRedisAvailable = await initializeRedis();

  if (!isRedisAvailable || !redisClient) {
    // Fallback to in-memory implementation
    return checkRateLimitInMemory(identifier, options);
  }

  try {
    const key = `rl:${identifier}`;
    const now = Date.now();
    const windowEnd = now + options.windowMs;

    // Get current entry from Redis
    const entry = await redisClient.get(key);
    let data: { count: number; resetTime: number };

    if (!entry) {
      // New window
      data = { count: 1, resetTime: windowEnd };
      await redisClient.setex(
        key,
        Math.ceil(options.windowMs / 1000),
        JSON.stringify(data)
      );

      return {
        success: true,
        remaining: options.max - 1,
        resetTime: windowEnd,
      };
    }

    // Parse existing entry
    try {
      data = JSON.parse(entry as string);
    } catch {
      // Corrupted data, reset
      data = { count: 1, resetTime: windowEnd };
      await redisClient.setex(
        key,
        Math.ceil(options.windowMs / 1000),
        JSON.stringify(data)
      );
      return {
        success: true,
        remaining: options.max - 1,
        resetTime: windowEnd,
      };
    }

    // Check if limit exceeded
    if (data.count >= options.max) {
      return {
        success: false,
        remaining: 0,
        resetTime: data.resetTime,
        message: options.message || 'Rate limit exceeded',
      };
    }

    // Increment counter
    data.count++;
    await redisClient.setex(
      key,
      Math.ceil(options.windowMs / 1000),
      JSON.stringify(data)
    );

    return {
      success: true,
      remaining: options.max - data.count,
      resetTime: data.resetTime,
    };
  } catch (error) {
    console.error('❌ Redis rate limit check failed:', error);
    // Fallback to in-memory on error
    return checkRateLimitInMemory(identifier, options);
  }
}

// =============================================================================
// In-Memory Fallback Implementation
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
if (typeof global !== 'undefined') {
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  (global as unknown as { rateLimitCleanupInterval?: NodeJS.Timeout }).rateLimitCleanupInterval =
    cleanupInterval;
}

/**
 * In-memory fallback for rate limiting
 * Used when Redis is unavailable or not configured
 */
function checkRateLimitInMemory(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const key = identifier;

  const entry = rateLimitStore.get(key);

  // New window
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + options.windowMs,
    };
    rateLimitStore.set(key, newEntry);

    return {
      success: true,
      remaining: options.max - 1,
      resetTime: newEntry.resetTime,
    };
  }

  // Check limit
  if (entry.count >= options.max) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      message: options.message || 'Rate limit exceeded',
    };
  }

  // Increment
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    success: true,
    remaining: options.max - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get rate limit identifier from request
 * Prefers authenticated user ID, falls back to IP
 */
export function getRateLimitIdentifier(
  request: Request,
  userId?: string | null
): string {
  if (userId) {
    return `user:${userId}`;
  }

  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';

  return `ip:${ip}`;
}

/**
 * Rate limiting configuration for different API categories
 */
export const RATE_LIMIT_CONFIGS = {
  admin: {
    max: 100,
    windowMs: 60 * 1000,
    message: 'Too many admin requests. Please try again later.',
  },
  userManagement: {
    max: 50,
    windowMs: 60 * 1000,
    message: 'Too many user management requests. Please try again later.',
  },
  discussion: {
    max: 200,
    windowMs: 60 * 1000,
    message: 'Too many discussion requests. Please try again later.',
  },
  document: {
    max: 100,
    windowMs: 60 * 1000,
    message: 'Too many document requests. Please try again later.',
  },
  default: {
    max: 200,
    windowMs: 60 * 1000,
    message: 'Too many requests. Please try again later.',
  },
} as const satisfies Record<string, RateLimitOptions>;
