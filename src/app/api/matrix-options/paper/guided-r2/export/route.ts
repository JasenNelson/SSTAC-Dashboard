import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPaperAdminAccess } from '@/lib/matrix-options/paper-admin-guard';
import { getGuidedR2Manifest } from '@/lib/matrix-options/paper/guided-r2-manifest';
import { fetchGuidedAdminState } from '@/lib/matrix-options/paper/guided-r2-admin-query';
import { buildGuidedAdminCsv, normalizeGuidedAdminRows } from '@/lib/matrix-options/paper/guided-r2-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export async function GET(request: Request) {
  const store = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: {
    get(name: string) { return store.get(name)?.value; },
    set(name: string, value: string, options: CookieOptions) { try { store.set({ name, value, ...options }); } catch {} },
    remove(name: string, options: CookieOptions) { try { store.set({ name, value: '', ...options }); } catch {} },
  } });
  const access = await getPaperAdminAccess(supabase);
  if (!access.allowed) return Response.json({ error: access.reason }, { status: access.status, headers: noStore });
  const params = new URL(request.url).searchParams;
  const userId = params.get('userId') || '';
  const status = params.get('status') || '';
  if (userId && !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(userId) || status && !new Set(['saved-draft','submitted','changed-since-submit','completion-only']).has(status)) {
    return Response.json({ error: 'Invalid guided review filter' }, { status: 400, headers: noStore });
  }
  try {
    const manifest = getGuidedR2Manifest();
    const identity = { documentVersion: manifest.documentVersion, guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256 };
    const raw = await fetchGuidedAdminState(supabase as unknown as Parameters<typeof fetchGuidedAdminState>[0], identity);
    const rows = normalizeGuidedAdminRows(raw.entries, raw.completions, identity);
    if (rows === null) throw new Error('Guided review integrity failed');
    const filtered = rows.filter((row) => (!userId || row.userId === userId) && (!status || row.status === status));
    return new Response(buildGuidedAdminCsv(filtered, identity), { status: 200, headers: {
      ...noStore, 'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="matrix-guided-r2-reviews.csv"',
    } });
  } catch { return Response.json({ error: 'Guided review data unavailable' }, { status: 500, headers: noStore }); }
}
