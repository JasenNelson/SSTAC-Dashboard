/**
 * Rate Limiting Utility for Non-Poll APIs
 * 
 * Provides in-memory rate limiting to protect admin and management APIs
 * from abuse while avoiding blocking legitimate users.
 * 
 * IMPORTANT: This is an in-memory solution suitable for single-instance deployments.
 * For multi-instance deployments, consider Redis-based rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (clears on server restart)
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

  // Store interval reference to prevent garbage collection
  (global as unknown as { rateLimitCleanupInterval?: NodeJS.Timeout }).rateLimitCleanupInterval = cleanupInterval;
}

export interface RateLimitOptions {
  /**
   * Maximum number of requests allowed in the window
   */
  max: number;
  /**
   * Time window in milliseconds
   */
  windowMs: number;
  /**
   * Message to return when rate limit is exceeded
   */
  message?: string;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  message?: string;
}

/**
 * Rate limiting configuration for different API categories
 */
export const RATE_LIMIT_CONFIGS = {
  // Admin operations - more restrictive
  admin: {
    max: 100, // 100 requests
    windowMs: 60 * 1000, // per minute
    message: 'Too many admin requests. Please try again later.',
  },
  // User management operations
  userManagement: {
    max: 50, // 50 requests
    windowMs: 60 * 1000, // per minute
    message: 'Too many user management requests. Please try again later.',
  },
  // Discussion operations
  discussion: {
    max: 200, // 200 requests
    windowMs: 60 * 1000, // per minute
    message: 'Too many discussion requests. Please try again later.',
  },
  // Document operations
  document: {
    max: 100, // 100 requests
    windowMs: 60 * 1000, // per minute
    message: 'Too many document requests. Please try again later.',
  },
  // General API requests (default)
  default: {
    max: 200, // 200 requests
    windowMs: 60 * 1000, // per minute
    message: 'Too many requests. Please try again later.',
  },
} as const satisfies Record<string, RateLimitOptions>;

/**
 * Checks if a request should be rate limited
 * 
 * @param identifier - Unique identifier for the rate limit (e.g., user ID, IP address)
 * @param options - Rate limit configuration
 * @returns Rate limit result with success status and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = RATE_LIMIT_CONFIGS.default
): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  
  const entry = rateLimitStore.get(key);
  
  // If no entry exists or the window has expired, create a new one
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
  
  // Entry exists and is still valid
  if (entry.count >= options.max) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      message: options.message || 'Rate limit exceeded',
    };
  }
  
  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return {
    success: true,
    remaining: options.max - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Gets rate limit identifier from request
 * Uses user ID if authenticated, otherwise falls back to IP address
 */
export function getRateLimitIdentifier(request: Request, userId?: string | null): string {
  // Prefer authenticated user ID for better accuracy
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fall back to IP address for unauthenticated requests
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  
  return `ip:${ip}`;
}

/**
 * Rate limit middleware helper for Next.js API routes
 * 
 * @param request - Next.js request object
 * @param userId - Optional authenticated user ID
 * @param configKey - Key from RATE_LIMIT_CONFIGS (defaults to 'default')
 * @returns NextResponse with rate limit headers if exceeded, null if allowed
 */
export function rateLimitMiddleware(
  request: Request,
  userId?: string | null,
  configKey: keyof typeof RATE_LIMIT_CONFIGS = 'default'
): Response | null {
  const identifier = getRateLimitIdentifier(request, userId);
  const config = RATE_LIMIT_CONFIGS[configKey];
  
  const result = checkRateLimit(identifier, config);
  
  if (!result.success) {
    return new Response(
      JSON.stringify({ 
        error: result.message || 'Rate limit exceeded',
        resetTime: result.resetTime,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': config.max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetTime.toString(),
          'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
        },
      }
    );
  }
  
  // Add rate limit headers to successful requests
  // These will be added by middleware to the response
  return null;
}

