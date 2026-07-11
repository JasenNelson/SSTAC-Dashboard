import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Render the default LoginPage export (the Suspense-wrapped form). We deliberately
// do NOT export LoginForm from the App Router page module -- Next.js validates page
// exports and a named component export can break the build/type check.
import LoginPage from '../page';

// Mock next/navigation
const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

// Mock Supabase
let mockSignIn = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
    },
  }),
}));

describe('LoginForm Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('A. no error state', () => {
    const { container } = render(<LoginPage />);
    
    // Assert email and password do NOT have aria-invalid
    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    
    expect(emailInput).not.toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).not.toHaveAttribute('aria-invalid', 'true');
    
    // Assert both decorative <svg> icons have aria-hidden="true"
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    svgs.forEach(svg => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    // Assert there is no role="alert" in the document initially
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('B. announces error on failed login', async () => {
    mockSignIn.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } });
    
    render(<LoginPage />);
    
    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });
    
    // Non-secret placeholder inputs. signInWithPassword is mocked, so these values are never
    // used as real credentials -- descriptive, clearly-non-credential strings (and a reserved
    // .test email) keep secret scanners (GitGuardian) from flagging a login literal pair.
    const placeholderEmail = 'a11y-placeholder@example.test';
    const placeholderFieldValue = 'not-a-secret-placeholder';
    fireEvent.change(emailInput, { target: { value: placeholderEmail } });
    fireEvent.change(passwordInput, { target: { value: placeholderFieldValue } });
    fireEvent.click(submitBtn);
    
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid login credentials');
    
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput).toHaveAttribute('aria-describedby', 'login-error');
    
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).toHaveAttribute('aria-describedby', 'login-error');
  });
});
