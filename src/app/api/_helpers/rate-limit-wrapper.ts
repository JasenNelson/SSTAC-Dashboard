/**
 * Helper function to wrap API route handlers with rate limiting
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitIdentifier, RATE_LIMIT_CONFIGS, RateLimitOptions } from '@/lib/rate-limit';
import { createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth';

export async function getRateLimitHeaders(
  request: NextRequest,
  userId: string | null,
  config: RateLimitOptions
): Promise<{ response: NextResponse | null; headers: Record<string, string> }> {
  const identifier = getRateLimitIdentifier(request, userId);
  const rateLimitResult = checkRateLimit(identifier, config);
  
  if (!rateLimitResult.success) {
    const errorResponse = NextResponse.json(
      { error: rateLimitResult.message || 'Rate limit exceeded', resetTime: rateLimitResult.resetTime },
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': config.max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
        },
      }
    );
    return { response: errorResponse, headers: {} };
  }
  
  const headers = {
    'X-RateLimit-Limit': config.max.toString(),
    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
    'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
  };
  
  return { response: null, headers };
}

export async function getAuthAndRateLimit(
  request: NextRequest,
  configKey: keyof typeof RATE_LIMIT_CONFIGS = 'default'
): Promise<{
  user: Awaited<ReturnType<typeof getAuthenticatedUser>> | null;
  supabase: Awaited<ReturnType<typeof createAuthenticatedClient>>;
  rateLimitResponse: NextResponse | null;
  rateLimitHeaders: Record<string, string>;
}> {
  const supabase = await createAuthenticatedClient();
  const user = await getAuthenticatedUser(supabase);
  const config = RATE_LIMIT_CONFIGS[configKey];
  
  const { response, headers } = await getRateLimitHeaders(request, user?.id || null, config);
  
  return {
    user,
    supabase,
    rateLimitResponse: response,
    rateLimitHeaders: headers,
  };
}

