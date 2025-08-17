// src/app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
// Import the new client helper
import { createClient } from '../supabase-client';
import type { NextPage } from 'next';
import Link from 'next/link';

const LoginPage: NextPage = () => {
  const router = useRouter();
  // Initialize the client by calling the function
  const supabase = createClient();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Refresh the page to sync session state
      router.refresh();
      router.push('/dashboard');
    }
  };

  // ... rest of the JSX remains the same
  return (
    <div style={{ maxWidth: '420px', margin: '96px auto' }}>
      <h2>Log In</h2>
      <form onSubmit={handleLogin}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginBottom: '16px' }}
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginBottom: '16px' }}
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          style={{ width: '100%', padding: '10px', cursor: 'pointer' }}
        >
          {loading ? 'Logging In...' : 'Log In'}
        </button>
      </form>
      {error && <p style={{ color: 'red', marginTop: '16px' }}>{error}</p>}
      
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <p style={{ marginBottom: '16px' }}>
          Don't have an account?{' '}
          <Link href="/signup" style={{ color: '#3b82f6', textDecoration: 'none' }}>
            Create one here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
