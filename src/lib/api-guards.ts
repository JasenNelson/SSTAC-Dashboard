import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Verify the request comes from an authenticated admin user.
 * Call at the top of every regulatory-review API route handler.
 *
 * Uses createServerClient from @supabase/ssr with Next.js cookies()
 * (same pattern as src/lib/supabase/middleware.ts).
 */
export async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin = user.app_metadata?.role === 'admin'
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null // proceed
}

/**
 * Verify the local engine is available (server-side).
 * Call after requireAdmin() in engine-dependent routes.
 */
export function requireLocalEngine() {
  if (process.env.LOCAL_ENGINE_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'This feature requires the local evaluation engine.' },
      { status: 503 }
    )
  }
  return null // proceed
}
