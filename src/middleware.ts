// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Security headers applied to every outbound response (pass-through and redirects).
// Must be called on the final response object before every return.
function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdn.tailwindcss.com https://va.vercel-scripts.com; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.tailwindcss.com; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com https://openmaps.gov.bc.ca; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  )
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  )
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
  return res
}

// Returns true for errors that are transient (network blip, gateway hiccup).
// On retryable errors we do NOT signOut -- that would destroy a valid session
// that will recover on the next request once connectivity is restored.
function isRetryableAuthError(error: { name?: string; status?: number }): boolean {
  if (error.name === 'AuthRetryableFetchError') return true
  if (error.status === 0) return true
  if (error.status === 502 || error.status === 503 || error.status === 504) return true
  return false
}

// Returns true for errors that definitively indicate the refresh token is dead.
// Only on these do we call signOut() to clear stale cookies.
function isTerminalAuthError(error: { message?: string; status?: number }): boolean {
  // Case-insensitive: Supabase emits both 'Invalid Refresh Token' and the
  // lowercase 'Invalid refresh token' variant (the latter often with status 400),
  // plus the 'refresh_token_not_found' code. All are dead-token = terminal.
  const msg = (error.message ?? '').toLowerCase()
  if (
    msg.includes('invalid refresh token') ||
    msg.includes('refresh_token_not_found') ||
    msg.includes('refresh token not found')
  ) {
    return true
  }
  // 401/403 (not a retryable status) -- genuinely expired/revoked.
  if ((error.status === 401 || error.status === 403) && !isRetryableAuthError(error)) return true
  return false
}

// Build a redirect to /login that CARRIES any cookies setAll wrote onto `carryFrom`
// (e.g. the signOut() expirations on the terminal path) so the browser actually
// receives the Set-Cookie removals. On paths where setAll did not fire (retryable,
// clean no-user), carryFrom.cookies is empty -- nothing is copied, so the browser's
// existing cookies are preserved (which is what the retryable path wants).
function redirectToLogin(request: NextRequest, carryFrom: NextResponse): NextResponse {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
  const redirectRes = NextResponse.redirect(loginUrl)
  carryFrom.cookies.getAll().forEach((cookie) => redirectRes.cookies.set(cookie))
  return applySecurityHeaders(redirectRes)
}

export async function middleware(request: NextRequest) {
  // let -- setAll may recreate this; applySecurityHeaders is called before every return.
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Propagate updated cookies into the request (for downstream server components)
          // then recreate the response so the Set-Cookie headers are written to the client.
          // Security headers are applied to the final response object before return.
          // Forward-compat: @supabase/ssr@0.6.1 SetAllCookies yields only { name, value,
          // options }. If a future @supabase/ssr passes cache-control headers into setAll,
          // forward them to the response to avoid CDN cache poisoning / cross-user leakage.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    const isExpectedAnonymous = error.message === 'Auth session missing!'
    if (!isExpectedAnonymous) {
      console.error('[Middleware] Auth error:', {
        message: error.message,
        status: error.status,
        name: error.name,
        path: request.nextUrl.pathname,
      })
    }

    if (isRetryableAuthError(error)) {
      // Transient network error -- do NOT sign out. Redirect to /login without
      // clearing cookies so a valid session survives the blip and can be recovered.
      if (process.env.NODE_ENV === 'development') {
        console.log('[Middleware] Retryable auth error -- redirecting without signOut:', error.name ?? error.status)
      }
      // setAll did not fire (getUser errored, no refresh) -> no cookies carried -> session preserved.
      return redirectToLogin(request, response)
    }

    if (isTerminalAuthError(error)) {
      // Refresh token is definitively dead -- sign out to clear stale cookies,
      // then redirect to login so the user gets a clean session.
      try {
        await supabase.auth.signOut()
      } catch (signOutError) {
        console.warn('[Middleware] Error during signOut (can be ignored):', signOutError)
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('[Middleware] Terminal auth error -- signed out and redirecting to login')
      }
      // signOut() wrote cookie EXPIRATIONS onto `response` via setAll; carry them
      // onto the redirect so the browser actually clears the dead token cookies.
      return redirectToLogin(request, response)
    }
  }

  // Clean no-session case: no error, just no authenticated user.
  if (!user) {
    return redirectToLogin(request, response)
  }

  // Authenticated pass-through. response may have been recreated by setAll above.
  return applySecurityHeaders(response)
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/twg/:path*',
    '/survey-results/:path*',
    '/cew-2025/:path*',
    '/regulatory-review/:path*',
    '/bn-rrm/:path*',
    '/demo-matrix-graph/:path*',
  ],
}
