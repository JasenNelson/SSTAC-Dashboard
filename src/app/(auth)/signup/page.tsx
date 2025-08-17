// src/app/(auth)/signup/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../supabase-client';
import type { NextPage } from 'next';
import Link from 'next/link';

const SignupPage: NextPage = () => {
  // const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

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
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

             if (error) {
         setError(error.message);
       } else if (data.user) {
         // Try to create a pending user role
         try {
           const { error: roleError } = await supabase
             .from('user_roles')
             .insert({
               user_id: data.user.id,
               role: 'member',
               status: 'pending'
             });
           
           if (roleError) {
             console.warn('Role creation warning:', roleError);
           }
         } catch (roleErr) {
           console.warn('Role creation error:', roleErr);
         }
         
         if (!data.user.email_confirmed_at) {
           setSuccess('Account created successfully! Please check your email to confirm your account. Your account will be reviewed by an administrator before you can access the system.');
         } else {
           setSuccess('Account created successfully! Your account will be reviewed by an administrator before you can access the system.');
         }
         
         // Clear form
         setEmail('');
         setPassword('');
         setConfirmPassword('');
       }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '96px auto' }}>
      <h2>Create Account</h2>
      <form onSubmit={handleSignup}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginBottom: '16px' }}
            placeholder="Enter your email address"
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
            placeholder="Enter your password (min 6 characters)"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginBottom: '16px' }}
            placeholder="Confirm your password"
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '10px', 
            cursor: 'pointer',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px'
          }}
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
      
      {error && (
        <p style={{ color: 'red', marginTop: '16px', textAlign: 'center' }}>
          {error}
        </p>
      )}
      
      {success && (
        <p style={{ color: 'green', marginTop: '16px', textAlign: 'center' }}>
          {success}
        </p>
      )}
      
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <p style={{ marginBottom: '16px' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#3b82f6', textDecoration: 'none' }}>
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
