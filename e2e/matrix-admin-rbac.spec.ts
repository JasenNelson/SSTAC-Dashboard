import { test, expect } from '@playwright/test'

test.describe('Matrix Admin Dashboard RBAC', () => {
  test('unauthenticated users are redirected from /admin/matrix-review', async ({ page }) => {
    // Attempt to access the admin review page directly
    const response = await page.goto('/admin/matrix-review')

    // Depending on the exact Next.js version and routing, it may be a 307 or 308 redirect,
    // or just a client-side navigation. Playwright automatically follows redirects.
    
    // Assert that the URL has changed to the login page (or dashboard if that's the fallback)
    // The server component `page.tsx` redirect('/login') if no user.
    await expect(page).toHaveURL(/.*\/login.*/)

    // Alternatively, if the app falls back to /dashboard if unauthenticated, 
    // it would match /dashboard. Our page.tsx explicitly uses redirect('/login') if !user.
  })

  test.skip('authenticated users without admin role are redirected from /admin/matrix-review', async ({ page }) => {
    // Requires pre-authenticated non-admin fixture
  })
})
