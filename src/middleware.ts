// src/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

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

      console.log('[Middleware] Auth error detected, redirecting to login')
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

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/twg/:path*',
    '/survey-results/:path*',
    '/cew-2025/:path*',
  ],
}