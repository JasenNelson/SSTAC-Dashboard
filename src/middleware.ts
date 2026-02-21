// src/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Task 2.2: Add Security Headers
 * Comprehensive security headers for production-grade protection
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Content Security Policy: Restrict resource loading to same-origin + trusted CDNs
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.tailwindcss.com; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.tailwindcss.com; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://*.supabase.co; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  )

  // X-Content-Type-Options: Prevent MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // X-Frame-Options: Prevent clickjacking attacks
  response.headers.set('X-Frame-Options', 'DENY')

  // X-XSS-Protection: Enable browser XSS protection
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // Referrer-Policy: Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions-Policy: Disable unnecessary browser features
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  )

  // Strict-Transport-Security: Force HTTPS (only for production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Refresh and validate the session for protected routes
  const { data: { user }, error } = await supabase.auth.getUser()

  // Handle authentication errors (like invalid refresh token)
  if (error) {
    console.error('[Middleware] Auth error:', {
      message: error.message,
      status: error.status,
      path: request.nextUrl.pathname
    })

    // If it's a refresh token error or any auth error, sign out and redirect to login
    // This ensures clean state and forces user to re-authenticate
    if (error.message?.includes('Refresh Token') || 
        error.message?.includes('Invalid refresh token') ||
        error.message?.includes('JWT') ||
        error.status === 401) {
      
      // Clear session by calling signOut (this handles all cookie cleanup)
      try {
        await supabase.auth.signOut()
      } catch (signOutError) {
        // Ignore signOut errors - we're redirecting anyway
        console.warn('[Middleware] Error during signOut (can be ignored):', signOutError)
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[Middleware] Auth error detected, redirecting to login')
      }
      const loginUrl = new URL('/login', request.url)
      // Preserve the original path as a query param so user can be redirected back after login
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // If the user is not signed in on a protected route, redirect to login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    // Preserve the original path as a query param
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin role enforcement for regulatory-review pages
  if (request.nextUrl.pathname.startsWith('/regulatory-review')) {
    const isAdmin = user.app_metadata?.role === 'admin'
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/twg/:path*',
    '/survey-results/:path*',
    '/cew-2025/:path*',
    '/regulatory-review/:path*',
  ],
}