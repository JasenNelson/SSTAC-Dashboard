import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPaperAdminAccess, getTrustedPaperReviewIdentity, validateTrustedReviewFilters } from '@/lib/matrix-options/paper-admin-guard';
import { buildReviewCsv, normalizeReviewRows, REVIEW_RESPONSE_SELECT } from '@/lib/matrix-options/paper/review-csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const STATUSES = new Set(['not-started', 'drafted', 'submitted', 'changed-since-submit']);

function clientFor(store: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: {
    get(name: string) { return store.get(name)?.value; },
    set(name: string, value: string, options: CookieOptions) { try { store.set({ name, value, ...options }); } catch {} },
    remove(name: string, options: CookieOptions) { try { store.set({ name, value: '', ...options }); } catch {} },
  } });
}

export async function GET(request: Request) {
  const supabase = clientFor(await cookies());
  const access = await getPaperAdminAccess(supabase);
  if (!access.allowed) return Response.json({ error: access.reason === 'unauthenticated' ? 'Unauthorized' : 'Forbidden' }, { status: access.status });
  let trusted;
  try { trusted = await getTrustedPaperReviewIdentity(); } catch { return Response.json({ error: 'Review release manifest unavailable' }, { status: 500 }); }
  const url = new URL(request.url);
  const filters = {
    documentVersion: url.searchParams.get('documentVersion') || undefined,
    manifestSha256: url.searchParams.get('manifestSha256') || undefined,
    cohortId: url.searchParams.get('cohortId') || undefined,
    questionId: url.searchParams.get('questionId') || undefined,
  };
  const status = url.searchParams.get('status') || undefined;
  if (filters.manifestSha256 && !/^[0-9a-f]{64}$/i.test(filters.manifestSha256)) return Response.json({ error: 'Invalid manifestSha256' }, { status: 400 });
  if (status && !STATUSES.has(status)) return Response.json({ error: 'Invalid status' }, { status: 400 });
  if (!validateTrustedReviewFilters(filters, trusted)) return Response.json({ error: 'Incompatible review identity filter' }, { status: 409 });
  let query: any;
  try {
    query = supabase.from('matrix_paper_review_responses').select(REVIEW_RESPONSE_SELECT);
    const databaseFilters = [['documentVersion', 'document_version'], ['manifestSha256', 'manifest_sha256'], ['cohortId', 'cohort_id'], ['questionId', 'question_id'], ['userId', 'user_id']] as const;
    for (const [key, column] of databaseFilters) { const value = url.searchParams.get(key); if (value) query = query.eq(column, value); }
  } catch { return Response.json({ error: 'Unable to query reviews' }, { status: 500 }); }
  let result: { data?: unknown; error?: unknown };
  try { result = await query; } catch { return Response.json({ error: 'Unable to query reviews' }, { status: 500 }); }
  if (result.error || !Array.isArray(result.data)) return Response.json({ error: 'Unable to query reviews' }, { status: 500 });
  const rows = normalizeReviewRows(result.data, trusted);
  if (rows === null) return Response.json({ error: 'Review data failed release integrity validation' }, { status: 500 });
  const filtered = status ? rows.filter((row) => row.status === status) : rows;
  return new Response(buildReviewCsv(filtered), { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="matrix-paper-reviews.csv"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
