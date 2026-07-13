import { expect, test } from '@playwright/test';

// T40 Lane 3: Matrix Map publish-flow RBAC (PR #612 built the admin publish page + audit-history).
// Skip-safe: the authenticated project (chromium-auth) runs the MEMBER fixture (role member) and is
// only present when E2E creds + E2E_AUTH_ENABLED are set; otherwise only the unauthenticated
// projects run and assert the /login redirect. All requests below are NEGATIVE (member/unauth) and
// are REJECTED by the server before any write -- no DRA is published/flipped/unpublished. The
// admin-side POSITIVE publish flow (a real flip_dra_public) needs an admin-role test user and is an
// OWNER GATE (see docs/MATRIX_OPTIONS_T40_ADMIN_TIER_OWNER_GATE_2026_07_12.md); it is NOT exercised here.

const PUBLISH_API = '/api/matrix-map/admin/publish';

test.describe('Matrix Map publish RBAC (T40)', () => {
  test('publish page: authenticated member is redirected to /dashboard; unauthenticated to /login', async ({ page }, testInfo) => {
    await page.goto('/admin/matrix-map/publish', { waitUntil: 'domcontentloaded' });
    if (testInfo.project.name === 'chromium-auth') {
      // Authenticated MEMBER (non-admin): the server component redirects non-admins to /dashboard.
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page).not.toHaveURL(/\/admin\/matrix-map\/publish/);
      // The admin publish control must NOT have rendered for the member.
      await expect(page.getByTestId('dra-publish-control')).toHaveCount(0);
    } else {
      // Unauthenticated: component redirect to /login.
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('publish API is locked: member POST -> 403 forbidden; unauthenticated POST -> 401 (no write occurs)', async ({ page }, testInfo) => {
    // NEGATIVE server-side RBAC probe. requireMatrixMapAdmin() rejects on role BEFORE any
    // flip_dra_public call, so this never mutates a DRA. dra_id is a dummy all-zero UUID as
    // defense-in-depth (the gate never reaches it).
    const resp = await page.request.post(PUBLISH_API, {
      data: { dra_id: '00000000-0000-0000-0000-000000000000', public: false, reason: 'e2e-rbac-negative' },
      failOnStatusCode: false,
    });
    if (testInfo.project.name === 'chromium-auth') {
      // Authenticated member: forbidden.
      expect(resp.status()).toBe(403);
    } else {
      // No session cookie: unauthorized.
      expect(resp.status()).toBe(401);
    }
    // Either way the request was rejected -- confirm it did NOT report a successful publish.
    const body = await resp.text().catch(() => '');
    expect(body).not.toMatch(/successfully/i);
  });
});
