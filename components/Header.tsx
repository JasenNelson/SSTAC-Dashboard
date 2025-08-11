'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient'; // Adjust the import path to your Supabase client file

export default function Header() {
  const [session, setSession] = useState<Session | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Fetch the user session on component mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Set up a listener for authentication state changes (e.g., login, logout)
    // This keeps the component's state in sync with the user's auth status
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Clean up the subscription when the component unmounts
    return () => {
      subscription?.unsubscribe();
    };
  }, []); // The empty dependency array ensures this effect runs only once

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Redirect to the home page after logout to ensure a clean state
    router.push('/');
  };

  return (
    <header>
      <nav>
        {session ? (
          <div>
            <span>Signed in as: <strong>{session.user.email}</strong></span>
            <button onClick={handleLogout} style={{ marginLeft: '1rem' }}>
              Logout
            </button>
          </div>
        ) : (
          <Link href="/login">
            <button>Login</button>
          </Link>
        )}
      </nav>
    </header>
  );
}