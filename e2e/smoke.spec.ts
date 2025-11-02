import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check that page loads without errors
    await expect(page).not.toHaveTitle(/Error/i);
    
    // Check that page has some content
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('login page is accessible', async ({ page }) => {
    await page.goto('/login');
    
    // Check that page loads
    await expect(page).not.toHaveTitle(/Error/i);
    
    // Check for login-related content
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

