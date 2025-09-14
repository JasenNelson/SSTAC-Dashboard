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
      <div style={{ 
        maxWidth: '420px', 
        margin: '96px auto',
        padding: '32px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#10b981',
            borderRadius: '50%',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: 'white', fontSize: '32px' }}>✓</span>
          </div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '8px'
          }}>Account Created Successfully!</h2>
          <p style={{
            color: '#6b7280',
            fontSize: '16px',
            margin: '0'
          }}>Your account has been created and you can now access the dashboard.</p>
        </div>
        
        <div style={{
          padding: '16px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          marginBottom: '24px'
        }}>
          <p style={{
            color: '#0369a1',
            margin: '0',
            fontSize: '14px'
          }}>
            Redirecting you to login page in a few seconds...
          </p>
        </div>
        
        <Link href="/login" style={{
          display: 'inline-block',
          padding: '12px 24px',
          backgroundColor: '#3b82f6',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '8px',
          fontWeight: '500',
          transition: 'background-color 0.2s'
        }}>
          Go to Login Now
        </Link>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '420px', 
      margin: '96px auto',
      padding: '32px',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e5e7eb'
    }}>
      <h2 style={{
        fontSize: '28px',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '32px',
        textAlign: 'center'
      }}>Create Account</h2>
      
      <form onSubmit={handleSignup}>
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="email" style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '8px'
          }}>Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ 
              width: '100%', 
              padding: '12px 16px', 
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px',
              backgroundColor: '#ffffff',
              color: '#111827',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            placeholder="Enter your email address"
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="password" style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '8px'
          }}>Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ 
              width: '100%', 
              padding: '12px 16px', 
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px',
              backgroundColor: '#ffffff',
              color: '#111827',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            placeholder="Enter your password (min 6 characters)"
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
        </div>
        
        <div style={{ marginBottom: '24px' }}>
          <label htmlFor="confirmPassword" style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '8px'
          }}>Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={{ 
              width: '100%', 
              padding: '12px 16px', 
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px',
              backgroundColor: '#ffffff',
              color: '#111827',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            placeholder="Confirm your password"
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '14px 16px', 
            cursor: loading ? 'not-allowed' : 'pointer',
            backgroundColor: loading ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            transition: 'background-color 0.2s',
            marginBottom: '24px'
          }}
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
      
      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <p style={{ color: '#dc2626', margin: '0', fontSize: '14px', textAlign: 'center' }}>
            {error}
          </p>
        </div>
      )}
      
      {success && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <p style={{ color: '#16a34a', margin: '0', fontSize: '14px', textAlign: 'center' }}>
            {success}
          </p>
        </div>
      )}
      
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ 
            color: '#3b82f6', 
            textDecoration: 'none',
            fontWeight: '500'
          }}>
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
