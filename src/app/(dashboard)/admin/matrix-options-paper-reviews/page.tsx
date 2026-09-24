import { fetchTrustedReviewRows } from '@/lib/matrix-options/paper/review-admin-query';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminReviewsClient from './AdminReviewsClient';
import { getPaperAdminAccess, getTrustedPaperReviewIdentity, validateTrustedReviewFilters } from '@/lib/matrix-options/paper-admin-guard';
import { normalizeReviewRows } from '@/lib/matrix-options/paper/review-csv';

type SearchParams = Record<string, string | string[] | undefined>;
const keys = ['documentVersion', 'manifestSha256', 'cohortId', 'questionId', 'userId', 'status'] as const;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || '' : value || '';
const STATUSES = new Set(['not-started', 'drafted', 'submitted', 'changed-since-submit']);

export default async function MatrixOptionsPaperReviewsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const store = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: {
    get(name: string) { return store.get(name)?.value; },
    set(name: string, value: string, options: CookieOptions) { try { store.set({ name, value, ...options }); } catch {} },
    remove(name: string, options: CookieOptions) { try { store.set({ name, value: '', ...options }); } catch {} },
  } });
  const access = await getPaperAdminAccess(supabase);
  if (!access.allowed) redirect(access.status === 401 ? '/login' : '/dashboard');
  const params = searchParams ? await searchParams : {};
  const initialFilters = Object.fromEntries(keys.map((key) => [key, first(params[key])])) as Record<string, string>;
  let trusted;
  try { trusted = await getTrustedPaperReviewIdentity(); } catch { return <AdminReviewsClient rows={[]} state={{ kind: 'integrity-error' }} initialFilters={initialFilters} />; }
  const identityFilters = { documentVersion: initialFilters.documentVersion || undefined, manifestSha256: initialFilters.manifestSha256 || undefined, cohortId: initialFilters.cohortId || undefined, questionId: initialFilters.questionId || undefined };
  if ((identityFilters.manifestSha256 && !/^[0-9a-f]{64}$/i.test(identityFilters.manifestSha256)) || !validateTrustedReviewFilters(identityFilters, trusted)) return <AdminReviewsClient rows={[]} state={{ kind: 'integrity-error' }} initialFilters={initialFilters} />;
  if (initialFilters.status && !STATUSES.has(initialFilters.status)) return <AdminReviewsClient rows={[]} state={{ kind: 'integrity-error' }} initialFilters={initialFilters} />;
  let result: Awaited<ReturnType<typeof fetchTrustedReviewRows>>;
  try {
    result = await fetchTrustedReviewRows(supabase as unknown as Parameters<typeof fetchTrustedReviewRows>[0], trusted, { cohortId: initialFilters.cohortId || undefined, questionId: initialFilters.questionId || undefined, userId: initialFilters.userId || undefined });
  } catch { return <AdminReviewsClient rows={[]} state={{ kind: 'query-error' }} initialFilters={initialFilters} />; }
  if ('error' in result) return <AdminReviewsClient rows={[]} state={{ kind: 'query-error' }} initialFilters={initialFilters} />;
  const rows = normalizeReviewRows(result.rows, trusted);
  if (rows === null) return <AdminReviewsClient rows={[]} state={{ kind: 'integrity-error' }} initialFilters={initialFilters} />;
  const filtered = initialFilters.status ? rows.filter((row) => row.status === initialFilters.status) : rows;
  return <AdminReviewsClient rows={filtered} state={{ kind: filtered.length ? 'ready' : 'empty' }} initialFilters={initialFilters} />;
}
