'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { User } from '@supabase/supabase-js';

// It's crucial to import the Supabase client configured for client-side use.
// Ensure this path is correct for your project structure.
import { supabase } from '../utils/supabase/client';

export default function Header() {
  // State to hold the user object
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  // On component mount, check for a user session
  useEffect(() => {
    const fetchUser = async () => {
      // supabase.auth.getUser() fetches the user from the current session
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error fetching user:', error.message);
        return;
      }
      setUser(data.user);
    };

    fetchUser();
  }, []);

  // Function to handle user logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    // A page reload is a simple way to ensure all state is cleared
    // and the user is redirected correctly after logout.
    router.reload();
  };

  return (
    <header className="bg-gray-800 text-white p-4">
      <nav className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold hover:text-gray-300">
          Home
        </Link>
        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <span className="text-sm">Signed in as {user.email}</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              >
                Logout
              </button>
            </>
          ) : (
            <Link href="/login">
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                Login
              </button>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}