import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Render the default LoginPage export (the Suspense-wrapped form), following the
// same pattern as login-a11y.test.tsx in this directory: LoginForm is not a named
// export from the App Router page module.
import LoginPage from '../page';

// D9: safeRedirectPath() in ../page.tsx validates the `redirect` query param is a
// same-origin relative path before router.push() ever sees it. These tests prove
// that gate end-to-end through the rendered form, not by importing the unexported
// helper directly.

let redirectParam: string | null = null;

// Mock next/navigation. useSearchParams().get('redirect') is driven by the mutable
// `redirectParam` above so each test can set its own query value before rendering.
const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'redirect' ? redirectParam : null),
  }),
}));

// Mock Supabase
const mockSignIn = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
    },
  }),
}));

// Non-secret placeholder credentials. signInWithPassword is mocked, so these
// values are never used as real credentials.
const PLACEHOLDER_EMAIL = 'page-test-placeholder@example.test';
const PLACEHOLDER_PASSWORD = 'not-a-secret-placeholder';

async function submitLogin() {
  render(<LoginPage />);
  const emailInput = screen.getByLabelText(/Email Address/i);
  const passwordInput = screen.getByLabelText(/Password/i);
  const submitBtn = screen.getByRole('button', { name: /Sign In/i });

  fireEvent.change(emailInput, { target: { value: PLACEHOLDER_EMAIL } });
  fireEvent.change(passwordInput, { target: { value: PLACEHOLDER_PASSWORD } });
  fireEvent.click(submitBtn);
}

describe('LoginPage redirect handling (D9 safeRedirectPath)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectParam = null;
  });

  it('pushes an unchanged relative path+query+hash on successful sign-in', async () => {
    mockSignIn.mockResolvedValueOnce({ error: null });
    redirectParam = '/matrix-options/paper/publication/v/x?mode=my-review&q=y#section-3';

    await submitLogin();

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith(
      '/matrix-options/paper/publication/v/x?mode=my-review&q=y#section-3',
    );
  });

  it("falls back to '/dashboard' for a protocol-relative '//evil.com'", async () => {
    mockSignIn.mockResolvedValueOnce({ error: null });
    redirectParam = '//evil.com';

    await submitLogin();

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it("falls back to '/dashboard' for an absolute 'https://evil.com'", async () => {
    mockSignIn.mockResolvedValueOnce({ error: null });
    redirectParam = 'https://evil.com';

    await submitLogin();

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it("falls back to '/dashboard' for a backslash-smuggled '/\\\\evil.com'", async () => {
    mockSignIn.mockResolvedValueOnce({ error: null });
    redirectParam = '/\\evil.com';

    await submitLogin();

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it("falls back to '/dashboard' for a tab-smuggled '/\\t/evil.com' (WHATWG URL strips the tab, exposing a protocol-relative host that the origin check then catches)", async () => {
    mockSignIn.mockResolvedValueOnce({ error: null });
    redirectParam = '/\t/evil.com';

    await submitLogin();

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it("falls back to '/dashboard' for an empty redirect value", async () => {
    mockSignIn.mockResolvedValueOnce({ error: null });
    redirectParam = '';

    await submitLogin();

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it("falls back to '/dashboard' for a missing redirect param", async () => {
    mockSignIn.mockResolvedValueOnce({ error: null });
    redirectParam = null;

    await submitLogin();

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it('does not push on a failed sign-in', async () => {
    mockSignIn.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } });
    redirectParam = '/matrix-options';

    await submitLogin();

    await screen.findByRole('alert');
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
