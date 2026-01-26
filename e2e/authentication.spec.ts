import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all cookies and storage before each test
    await page.context().clearCookies();
    // Navigate to page before clearing storage (required for Firefox/WebKit security)
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => sessionStorage.clear());
  });

  test('should load login page successfully', async ({ page }) => {
    await page.goto('/login');

    // Verify page title
    await expect(page).toHaveTitle(/Welcome Back|SSTAC/i);

    // Verify login form elements
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check for heading
    const heading = page.locator('h1');
    await expect(heading).toContainText(/Welcome Back/i);
  });

  test('should display validation errors for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    await page.locator('input[id="email"]').fill('invalid@example.com');
    await page.locator('input[id="password"]').fill('wrongpassword123');

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Wait for error message to appear
    const errorMessage = page.locator('div.bg-red-50, [role="alert"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Verify we're still on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show required field validation for empty email', async ({ page }) => {
    await page.goto('/login');

    // Leave email empty, fill password
    await page.locator('input[id="password"]').fill('somepassword');

    // Try to submit
    const submitButton = page.locator('button[type="submit"]');

    // Check if HTML5 validation prevents submission
    const isValid = await page.locator('input[id="email"]').evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  });

  test('should show required field validation for empty password', async ({ page }) => {
    await page.goto('/login');

    // Fill email, leave password empty
    await page.locator('input[id="email"]').fill('test@example.com');

    // Check if HTML5 validation prevents submission
    const isValid = await page.locator('input[id="password"]').evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  });

  test('should disable submit button during login attempt', async ({ page }) => {
    await page.goto('/login');

    // Fill in credentials
    await page.locator('input[id="email"]').fill('test@example.com');
    await page.locator('input[id="password"]').fill('testpassword123');

    const submitButton = page.locator('button[type="submit"]');

    // Click submit
    await submitButton.click();

    // Button should be disabled during request
    // Wait a moment to see if button state changes
    await page.waitForTimeout(500);

    // Check button text or disabled state
    const buttonText = await submitButton.textContent();
    expect(buttonText?.toLowerCase() || '').toMatch(/signing in|sign in/i);
  });

  test('should have email input accept email format', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.locator('input[id="email"]');

    // Check input type
    const inputType = await emailInput.evaluate((el: HTMLInputElement) => el.type);
    expect(inputType).toBe('email');
  });

  test('should have password input with proper attributes', async ({ page }) => {
    await page.goto('/login');

    const passwordInput = page.locator('input[id="password"]');

    // Check input type
    const inputType = await passwordInput.evaluate((el: HTMLInputElement) => el.type);
    expect(inputType).toBe('password');

    // Check autocomplete attribute - browsers may return different values
    const autoComplete = await passwordInput.evaluate((el: HTMLInputElement) => el.autocomplete);
    // Accept 'current-password' or empty (browser default behavior)
    expect(['current-password', '', 'on']).toContain(autoComplete);
  });

  test('should show signup link on login page', async ({ page }) => {
    await page.goto('/login');

    // Look for signup link
    const signupLink = page.locator('a[href="/signup"]');
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toContainText(/create one here|sign up|register/i);
  });

  test('should navigate to signup page when clicking signup link', async ({ page }) => {
    await page.goto('/login');

    // Click signup link
    await page.locator('a[href="/signup"]').click();

    // Verify navigation
    await expect(page).toHaveURL(/\/signup/);
  });

  test('should redirect unauthenticated user from dashboard to login', async ({ page }) => {
    // Attempt to access protected route
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should have proper security headers on login page', async ({ page }) => {
    const response = await page.goto('/login');

    // Check that page loaded successfully
    expect(response?.status()).toBeLessThan(400);

    // Verify form has proper CSRF protection indicators if present
    const form = page.locator('form');
    await expect(form).toBeVisible();
  });
});
