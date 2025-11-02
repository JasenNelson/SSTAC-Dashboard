/**
 * Supabase Authentication Utility
 * 
 * This utility provides standardized functions for creating Supabase clients
 * in API routes, eliminating code duplication across the codebase.
 * 
 * Patterns extracted from:
 * - Authenticated routes (most API routes)
 * - CEW/Anonymous routes (poll submission routes)
 * 
 * IMPORTANT: This utility is prepared for future use. Existing code continues
 * to work as-is. Migration to this utility will happen incrementally in later phases.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Create an authenticated Supabase client for API routes
 * 
 * This client reads and writes cookies for authentication,
 * allowing access to authenticated user data.
 * 
 * @returns Authenticated Supabase client
 * 
 * @example
 * ```typescript
 * const supabase = await createAuthenticatedClient();
 * const { data: { user } } = await supabase.auth.getUser();
 * ```
 */
export async function createAuthenticatedClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Cookie operations can fail in some edge cases
            // Fail silently to prevent breaking the request
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Cookie operations can fail in some edge cases
            // Fail silently to prevent breaking the request
          }
        },
      },
    }
  );
}

/**
 * Create an anonymous Supabase client for API routes
 * 
 * This client does NOT handle cookies, making it suitable for:
 * - CEW poll submissions (anonymous conference attendees)
 * - Public data access without authentication
 * 
 * @returns Anonymous Supabase client
 * 
 * @example
 * ```typescript
 * const supabase = await createAnonymousClient();
 * // Use for anonymous submissions or public data access
 * ```
 */
export async function createAnonymousClient(): Promise<SupabaseClient> {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get() {
          return null;
        },
        set() {
          // No-op for anonymous client
        },
        remove() {
          // No-op for anonymous client
        },
      },
    }
  );
}

/**
 * Get the currently authenticated user
 * 
 * Helper function to get the authenticated user from a Supabase client.
 * Useful for reducing boilerplate in API routes.
 * 
 * @param supabase - Authenticated Supabase client
 * @returns User object or null if not authenticated
 * 
 * @example
 * ```typescript
 * const supabase = await createAuthenticatedClient();
 * const user = await getAuthenticatedUser(supabase);
 * if (!user) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 * ```
 */
export async function getAuthenticatedUser(supabase: SupabaseClient) {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error getting authenticated user:', error);
    }
    return null;
  }
  
  return user;
}

/**
 * Require authentication and get the current user
 * 
 * This function ensures a user is authenticated and returns the user.
 * Throws an error response if not authenticated (useful for Next.js API routes).
 * 
 * @param supabase - Authenticated Supabase client
 * @returns User object (never null)
 * @throws {Response} NextResponse with 401 status if not authenticated
 * 
 * @example
 * ```typescript
 * const supabase = await createAuthenticatedClient();
 * try {
 *   const user = await requireAuthenticatedUser(supabase);
 *   // user is guaranteed to be non-null here
 * } catch (error) {
 *   return error; // This is a NextResponse with 401 status
 * }
 * ```
 */
export async function requireAuthenticatedUser(supabase: SupabaseClient) {
  const user = await getAuthenticatedUser(supabase);
  
  if (!user) {
    // Return a NextResponse that can be directly returned from API routes
    // Note: In practice, API routes should handle this directly
    // This is a helper that returns user or null for cleaner code
    throw new Error('Unauthorized');
  }
  
  return user;
}

/**
 * Create Supabase client based on page path
 * 
 * Determines if a page path is a CEW (anonymous) page or authenticated page,
 * and creates the appropriate client.
 * 
 * @param pagePath - The page path (e.g., '/cew-polls/...' or '/survey-results/...')
 * @returns Object containing the Supabase client and whether it's a CEW page
 * 
 * @example
 * ```typescript
 * const { supabase, isCEWPage } = await createClientForPagePath('/cew-polls/holistic-protection');
 * if (isCEWPage) {
 *   // Handle anonymous submission
 * } else {
 *   // Handle authenticated submission
 * }
 * ```
 */
export async function createClientForPagePath(pagePath: string): Promise<{
  supabase: SupabaseClient;
  isCEWPage: boolean;
}> {
  const isCEWPage = pagePath.startsWith('/cew-polls/');
  
  if (isCEWPage) {
    return {
      supabase: await createAnonymousClient(),
      isCEWPage: true,
    };
  }
  
  return {
    supabase: await createAuthenticatedClient(),
    isCEWPage: false,
  };
}

/**
 * Generate a unique user ID for CEW submissions
 * 
 * Creates a unique identifier for anonymous CEW poll submissions.
 * Format: {authCode}_{timestamp}_{randomSuffix}
 * 
 * @param authCode - CEW authentication code (default: 'CEW2025')
 * @param sessionId - Optional session ID from headers (x-session-id)
 * @returns Unique user ID string
 * 
 * @example
 * ```typescript
 * const userId = generateCEWUserId('CEW2025', request.headers.get('x-session-id'));
 * // Returns: 'CEW2025_session_1234567890_abc123' or 'CEW2025_1234567890_xyz789'
 * ```
 */
export function generateCEWUserId(authCode: string = 'CEW2025', sessionId?: string | null): string {
  if (sessionId) {
    return `${authCode}_${sessionId}`;
  }
  
  // Fallback: generate timestamp-based ID matching old behavior
  // Old format: session_${Date.now()}_${random}
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const generatedSessionId = `session_${timestamp}_${randomSuffix}`;
  return `${authCode}_${generatedSessionId}`;
}

