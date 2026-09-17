import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { middleware, config } from '../middleware'
import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}))

describe('middleware config', () => {
  it('contains all protected route prefixes', () => {
    const expectedRoutes = [
      '/dashboard/:path*',
      '/twg/:path*',
      '/survey-results/:path*',
      '/cew-2025/:path*',
      '/regulatory-review/:path*',
      '/bn-rrm/:path*',
      '/demo-matrix-graph/:path*',
      '/matrix-options/:path*',
    ]

    expectedRoutes.forEach((route) => {
      expect(config.matcher).toContain(route)
    })

    expect(config.matcher).not.toEqual(['/:path*'])
    expect(config.matcher.length).toBe(8)
  })
})

describe('middleware auth gating', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock-project.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'mock-anon-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetAllMocks()
  })

  it('redirects an unauthenticated request to /login carrying the redirect path', async () => {
    ;(createServerClient as unknown as Mock).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })

    const req = new NextRequest(new URL('http://localhost/matrix-options/foo'))
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?redirect=%2Fmatrix-options%2Ffoo')
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy()
  })

  it('redirects an unauthenticated request to /login preserving the full path and query string (D9)', async () => {
    ;(createServerClient as unknown as Mock).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })

    const req = new NextRequest(
      new URL('http://localhost/matrix-options/paper/publication/v/x?mode=my-review&q=y'),
    )
    const res = await middleware(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toBeTruthy()
    const redirectUrl = new URL(location!)
    expect(redirectUrl.pathname).toBe('/login')
    // Decode via URLSearchParams and assert the EXACT value (not a substring/
    // toContain match) -- pre-D9, redirectToLogin() set only
    // `request.nextUrl.pathname` (see git show HEAD:src/middleware.ts), which
    // would decode here to '/matrix-options/paper/publication/v/x' with the
    // query string silently dropped. This assertion fails against that code.
    expect(redirectUrl.searchParams.get('redirect')).toBe(
      '/matrix-options/paper/publication/v/x?mode=my-review&q=y',
    )
  })

  it('passes an authenticated request through with security headers', async () => {
    ;(createServerClient as unknown as Mock).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
    })

    const req = new NextRequest(new URL('http://localhost/matrix-options/foo'))
    const res = await middleware(req)

    expect(res.headers.get('location')).toBeNull()
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy()
  })
})
