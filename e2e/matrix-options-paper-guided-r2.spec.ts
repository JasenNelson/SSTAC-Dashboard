import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Separate authenticated candidate gate. Requires a reviewed environment and
// a fixture user whose invite state is set outside this spec. No account writes.
const authorized = process.env.MATRIX_R2_POLICY_E2E_AUTHORIZED === 'true';
const role = process.env.MATRIX_R2_POLICY_E2E_ROLE;
const runId = process.env.MATRIX_R2_POLICY_E2E_RUN_ID;
const evidenceDir = process.env.MATRIX_R2_POLICY_E2E_EVIDENCE_DIR;
if (authorized && role !== 'invited' && role !== 'not-invited') {
  throw new Error('MATRIX_R2_POLICY_E2E_ROLE must be exactly invited or not-invited for an authorized run.');
}
if (authorized && (!runId || !/^[A-Za-z0-9_-]+$/.test(runId) || !evidenceDir || !path.isAbsolute(evidenceDir))) {
  throw new Error('An authorized guided R2 E2E run requires a safe run ID and absolute private evidence directory.');
}
test.describe('guided R2 admission canary scaffold', () => {
  test.skip(!authorized, 'Requires separate authenticated E2E authority.');
  test.beforeEach(({}, testInfo) => {
    expect(testInfo.project.name).toBe('chromium-auth');
  });
  test.afterEach(({}, testInfo) => {
    if (!authorized || testInfo.status !== 'passed' || !testInfo.title.startsWith(`[${role}]`)) return;
    fs.mkdirSync(evidenceDir!, { recursive: true });
    const receipt = {
      runId, role, project: testInfo.project.name, title: testInfo.title,
      status: testInfo.status, completedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(evidenceDir!, `${runId}-${role}.json`), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', encoding: 'utf8' });
  });

  test('[invited] shows the paper and account-data notice with read-only state', async ({ page }) => {
    test.skip(role !== 'invited', 'Requires invited fixture user.');
    await page.goto('/matrix-options/paper/publication/v/phase2-review-2026-11-fa356b89');
    await expect(page.getByRole('heading', { name: 'Phase 2 review draft' })).toBeVisible();
    await expect(page.getByText(/Feedback is optional, linked to your account/).first()).toBeVisible();
    await expect(page.getByText('Review responses are not open right now. The paper remains readable.')).toBeVisible();
    await page.getByRole('button', { name: 'My Review' }).click();
    await expect(page.getByText(/Soft deletion retains them until permanent deletion/).last()).toBeVisible();
  });

  test('[not-invited] keeps the paper readable and withholds guided data', async ({ page }) => {
    test.skip(role !== 'not-invited', 'Requires noninvited fixture user.');
    await page.goto('/matrix-options/paper/publication/v/phase2-review-2026-11-fa356b89');
    await expect(page.getByRole('heading', { name: 'Phase 2 review draft' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Guided responses are available only to invited reviewers.');
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  });
});
