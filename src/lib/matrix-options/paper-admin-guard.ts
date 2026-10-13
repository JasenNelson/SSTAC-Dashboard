import { getReviewerGuideBinding } from './reviewer-guide';
import { getCohortManifest } from './cohort-contract';
import { getReviewManifest } from './paper/review-manifest';
import { DEFAULT_PAPER_VERSION, getPaperRelease, paperReleaseIdentity, type PaperReleaseVersion } from './paper/releases';

export const PAPER_ADMIN_ROLES = ['admin', 'matrix_admin'] as const;
export type PaperAdminRole = (typeof PAPER_ADMIN_ROLES)[number];
export type PaperAdminUser = { id: string };
export type PaperAdminAccess = { allowed: true; user: PaperAdminUser; role: PaperAdminRole } | { allowed: false; status: 401 | 403; reason: 'unauthenticated' | 'forbidden' };
export type TrustedPaperReviewIdentity = { readonly documentVersion: PaperReleaseVersion; readonly manifestSha256: string; readonly releaseIdentity: string; readonly cohortIds: ReadonlySet<string>; readonly questionIds: ReadonlySet<string>; readonly cohortQuestionIds: ReadonlyMap<string, ReadonlySet<string>> };
export type ReviewIdentityFilters = { documentVersion?: string; manifestSha256?: string; cohortId?: string; questionId?: string };
type SupabaseLike = { auth: { getUser: () => Promise<{ data?: { user?: PaperAdminUser | null }; error?: unknown }> }; from: (table: string) => any };
export function isPaperAdminRole(role: unknown): role is PaperAdminRole { return role === 'admin' || role === 'matrix_admin'; }
export async function getPaperAdminAccess(client: SupabaseLike): Promise<PaperAdminAccess> { let authResult: Awaited<ReturnType<SupabaseLike['auth']['getUser']>>; try { authResult = await client.auth.getUser(); } catch { return { allowed: false, status: 401, reason: 'unauthenticated' }; } const user = authResult.data?.user; if (authResult.error || !user?.id) return { allowed: false, status: 401, reason: 'unauthenticated' }; let roleResult: { data?: Array<{ role?: unknown }>; error?: unknown }; try { roleResult = await client.from('user_roles').select('role').eq('user_id', user.id).in('role', PAPER_ADMIN_ROLES); } catch { return { allowed: false, status: 403, reason: 'forbidden' }; } if (roleResult.error) return { allowed: false, status: 403, reason: 'forbidden' }; const role = roleResult.data?.map((row) => row.role).find(isPaperAdminRole); return role ? { allowed: true, user, role } : { allowed: false, status: 403, reason: 'forbidden' }; }
export async function getTrustedPaperReviewIdentity(): Promise<TrustedPaperReviewIdentity> {
  const release = getPaperRelease(DEFAULT_PAPER_VERSION);
  if (!release || release.documentVersion !== DEFAULT_PAPER_VERSION || release.activation !== 'DEFAULT') {
    throw new Error('Trusted paper release identity mismatch');
  }

  const manifest = getReviewManifest(release.documentVersion);
  const guide = getReviewerGuideBinding(release.documentVersion);
  const cohorts = getCohortManifest(release.documentVersion);
  if (
    manifest.documentVersion !== release.documentVersion ||
    manifest.paperSha256 !== release.sha256 ||
    manifest.reviewerGuideReleaseIdentity !== release.documentVersion ||
    manifest.cohortsReleaseIdentity !== release.documentVersion ||
    guide.releaseIdentity !== release.documentVersion ||
    cohorts.releaseIdentity !== release.documentVersion ||
    !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
    manifest.sha256 === release.sha256
  ) {
    throw new Error('Trusted review manifest mismatch');
  }

  const questionByNumber = new Map(guide.questions.map((question) => [question.number, question.id]));
  const questionIds = new Set(manifest.questionIds);
  if (
    questionByNumber.size !== guide.questions.length ||
    questionIds.size !== guide.questions.length ||
    manifest.questionIds.some((id, index) => id !== guide.questions[index]?.id)
  ) {
    throw new Error('Trusted contract contains duplicate or mismatched questions');
  }

  const cohortQuestionIds = new Map<string, ReadonlySet<string>>();
  for (const cohort of cohorts.cohorts) {
    const expected = cohort.questionNumbers.map((number) => questionByNumber.get(number));
    const members = manifest.cohortQuestionIds[cohort.id];
    if (
      expected.some((id) => id === undefined) ||
      !members ||
      members.length !== expected.length ||
      members.some((id, index) => id !== expected[index] || !questionIds.has(id)) ||
      new Set(members).size !== members.length
    ) {
      throw new Error('Trusted cohort question membership mismatch');
    }
    cohortQuestionIds.set(cohort.id, new Set(members));
  }
  if (
    cohortQuestionIds.size !== cohorts.cohorts.length ||
    Object.keys(manifest.cohortQuestionIds).length !== cohortQuestionIds.size
  ) {
    throw new Error('Trusted contract contains duplicate or mismatched cohorts');
  }

  return Object.freeze({
    documentVersion: release.documentVersion,
    manifestSha256: manifest.sha256,
    releaseIdentity: paperReleaseIdentity(release),
    cohortIds: new Set(cohortQuestionIds.keys()),
    questionIds,
    cohortQuestionIds,
  });
}
export function validateTrustedReviewFilters(filters: ReviewIdentityFilters, trusted: TrustedPaperReviewIdentity): boolean { if (filters.documentVersion !== undefined && filters.documentVersion !== trusted.documentVersion) return false; if (filters.manifestSha256 !== undefined && filters.manifestSha256.toLowerCase() !== trusted.manifestSha256) return false; if (filters.cohortId !== undefined && !trusted.cohortIds.has(filters.cohortId)) return false; if (filters.questionId !== undefined && !trusted.questionIds.has(filters.questionId)) return false; if (filters.cohortId !== undefined && filters.questionId !== undefined && !trusted.cohortQuestionIds.get(filters.cohortId)?.has(filters.questionId)) return false; return true; }
