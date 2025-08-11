// components/Header.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Session } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function Header() {
  const [session, setSession] = useState<Session | null>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/') // Redirect to home page after logout
  }

  return (
    <header className="flex items-center justify-between p-4 bg-gray-800 text-white">
      <Link href="/" className="text-xl font-bold">
        SSTAC Dashboard
      </Link>
      <div className="flex items-center gap-4">
        {session ? (
          <>
            <p className="text-sm">{session.user.email}</p>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  )
}