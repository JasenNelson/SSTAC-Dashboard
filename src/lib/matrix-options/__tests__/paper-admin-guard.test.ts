import { describe, expect, it, vi } from 'vitest';
import { getPaperAdminAccess, getTrustedPaperReviewIdentity, isPaperAdminRole, validateTrustedReviewFilters } from '../paper-admin-guard';
import { getCohortManifest } from '../cohort-contract';
import { getReviewManifest } from '../paper/review-manifest';
import { DEFAULT_PAPER_VERSION, getPaperRelease, paperReleaseIdentity } from '../paper/releases';
import { getReviewerGuideBinding } from '../reviewer-guide';
function client(user: { id: string } | null, roles: unknown[] = [], error?: unknown) { const query: any = { select: vi.fn(() => query), eq: vi.fn(() => query), in: vi.fn(async () => ({ data: roles, error })) }; return { auth: { getUser: vi.fn(async () => ({ data: { user } })) }, from: vi.fn(() => query) } as any; }
describe('paper admin guard', () => {
  it.each(['admin', 'matrix_admin'])('allows %s', async (role) => { await expect(getPaperAdminAccess(client({ id: 'u1' }, [{ role }]))).resolves.toMatchObject({ allowed: true, role }); });
  it('rejects unauthenticated, forbidden, and role-query errors', async () => { await expect(getPaperAdminAccess(client(null))).resolves.toMatchObject({ status: 401 }); await expect(getPaperAdminAccess(client({ id: 'u1' }, [{ role: 'reviewer' }]))).resolves.toMatchObject({ status: 403 }); await expect(getPaperAdminAccess(client({ id: 'u1' }, [], new Error('RLS')))).resolves.toMatchObject({ status: 403 }); });
  it('recognizes only explicit admin roles', () => { expect(isPaperAdminRole('admin')).toBe(true); expect(isPaperAdminRole('matrix_admin')).toBe(true); expect(isPaperAdminRole('owner')).toBe(false); });
  it('binds the default v0.9.91 identity to the exact release, manifest, guide, and five cohorts', async () => {
    const identity = await getTrustedPaperReviewIdentity();
    const release = getPaperRelease(DEFAULT_PAPER_VERSION)!;
    const manifest = getReviewManifest(DEFAULT_PAPER_VERSION);
    const guide = getReviewerGuideBinding(DEFAULT_PAPER_VERSION);
    const cohorts = getCohortManifest(DEFAULT_PAPER_VERSION);
    expect(identity.documentVersion).toBe('v0.9.91');
    expect(identity.documentVersion).toBe(release.documentVersion);
    expect(identity.manifestSha256).toBe('6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272');
    expect(identity.manifestSha256).toBe(manifest.sha256);
    expect(identity.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(identity.releaseIdentity).toBe('matrix-options-paper:v0.9.91:a5b1d81d11af23d3437bba4cadcf0a0fa555001be27e9227c6015ff0bad6599e');
    expect(identity.releaseIdentity).toBe(paperReleaseIdentity(release));
    expect(identity.questionIds).toEqual(new Set(guide.questions.map((question) => question.id)));
    expect([...identity.cohortIds]).toEqual(cohorts.cohorts.map((cohort) => cohort.id));
    expect(identity.cohortIds).toEqual(new Set(['categories', 'pathway-grid', 'exposure-assumptions', 'inputs-evidence', 'methods-water-type']));
    expect(identity.cohortIds.size).toBe(5);
    expect([...identity.cohortQuestionIds].map(([cohortId, members]) => [cohortId, [...members]])).toEqual(
      cohorts.cohorts.map((cohort) => [cohort.id, manifest.cohortQuestionIds[cohort.id]]),
    );
    expect(() => getReviewManifest('unknown-release')).toThrow(/Unknown paper release/);
  });
  it('fails incompatible document, manifest, unknown identities, and cross-membership closed', async () => {
    const identity = await getTrustedPaperReviewIdentity();
    expect(validateTrustedReviewFilters({ documentVersion: 'wrong' }, identity)).toBe(false);
    expect(validateTrustedReviewFilters({ manifestSha256: 'b'.repeat(64) }, identity)).toBe(false);
    expect(validateTrustedReviewFilters({ cohortId: 'missing' }, identity)).toBe(false);
    expect(validateTrustedReviewFilters({ questionId: 'missing' }, identity)).toBe(false);
    expect(validateTrustedReviewFilters({ documentVersion: identity.documentVersion, manifestSha256: identity.manifestSha256 }, identity)).toBe(true);
    const entries = [...identity.cohortQuestionIds.entries()];
    const first = entries[0];
    const other = entries.find((entry) => entry[0] !== first[0] && [...entry[1]].some((question) => !first[1].has(question)));
    expect(other).toBeDefined();
    const question = [...other![1]].find((value) => !first[1].has(value))!;
    expect(validateTrustedReviewFilters({ cohortId: first[0], questionId: question }, identity)).toBe(false);
  });
});
