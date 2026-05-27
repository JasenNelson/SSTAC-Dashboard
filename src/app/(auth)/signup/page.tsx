// src/app/(auth)/signup/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { NextPage } from 'next';
import Link from 'next/link';

const SignupPage: NextPage = () => {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [accountCreated, setAccountCreated] = useState<boolean>(false);

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`
        }
      });

      if (error) {
        setError(error.message);
      } else if (data.user) {
        setSuccess('Account created successfully! Redirecting you to login...');
        setAccountCreated(true);

        // Clear form
        setEmail('');
        setPassword('');
        setConfirmPassword('');

        // Redirect to login page after 2 seconds
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // If account was created, show success message and redirect info
  if (accountCreated) {
    return (
      <div
        className="mx-auto mt-24 max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-none"
      >
        <div className="mb-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500">
            <span className="text-3xl text-white">&#10003;</span>
          </div>
          <h2 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">
            Account Created Successfully!
          </h2>
          <p className="text-base text-gray-500 dark:text-slate-400">
            Your account has been created and you can now access the dashboard.
          </p>
        </div>

        <div className="mb-6 rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-900/20">
          <p className="text-sm text-sky-700 dark:text-sky-300">
            Redirecting you to login page in a few seconds...
          </p>
        </div>

        <Link
          href="/login"
          className="inline-block rounded-lg bg-blue-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-600 dark:hover:bg-blue-400"
        >
          Go to Login Now
        </Link>
      </div>
    );
  }

  return (
    <div
      className="mx-auto mt-24 max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-none"
    >
      <h2 className="mb-8 text-center text-3xl font-semibold text-gray-900 dark:text-white">
        Create Account
      </h2>

      <form onSubmit={handleSignup}>
        <div className="mb-5">
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-200"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-400 dark:focus:border-blue-400"
            placeholder="Enter your email address"
          />
        </div>

        <div className="mb-5">
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-200"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-400 dark:focus:border-blue-400"
            placeholder="Enter your password (min 6 characters)"
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="confirmPassword"
            className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-200"
          >
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-400 dark:focus:border-blue-400"
            placeholder="Confirm your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mb-6 w-full rounded-lg bg-blue-500 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400 dark:hover:bg-blue-400 dark:disabled:bg-slate-600"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-900/20">
          <p className="text-center text-sm text-green-600 dark:text-green-400">
            {success}
          </p>
        </div>
      )}

      <div className="text-center">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
