import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { checkCsrf } from '@/lib/engine-v2/csrf';

export const runtime = 'nodejs';

const ADMIN_ROLES = ['admin', 'matrix_admin'];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const READBACK_PAGE_SIZE = 1000;
const READBACK_MAX_PAGES = 25;

async function createAuthenticatedClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    },
  );
}

async function requireMatrixMapAdmin(
  client: SupabaseClient,
): Promise<{ user: User } | NextResponse> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: role, error: roleError } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ADMIN_ROLES)
    .limit(1)
    .maybeSingle();

  if (roleError) {
    return NextResponse.json(
      { error: 'admin_role_query_failed' },
      { status: 500 },
    );
  }

  if (!role) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  return { user };
}

interface CandidatePayload {
  source_dra_id: string;
  coordinate_cluster_id: string;
  member_display_label: string;
  reason: string;
}

function parseCandidatePayload(value: unknown): CandidatePayload {
  if (!value || typeof value !== 'object') {
    throw new Error('body must be an object');
  }
  const body = value as Record<string, unknown>;

  if (typeof body.source_dra_id !== 'string' || !UUID_RE.test(body.source_dra_id)) {
    throw new Error('source_dra_id must be a UUID string');
  }
  if (typeof body.coordinate_cluster_id !== 'string' || body.coordinate_cluster_id.trim().length === 0) {
    throw new Error('coordinate_cluster_id must be a non-empty string');
  }
  if (typeof body.member_display_label !== 'string' || body.member_display_label.trim().length === 0) {
    throw new Error('member_display_label must be a non-empty string');
  }
  // SERVER-SIDE member-label guard. `member_display_label` is stored and served
  // to members verbatim, so it must not carry raw DRA provenance. The admin page
  // previously seeded this field from the aggregate's display name, which is the
  // private DRA title or -- when no title resolves -- the raw DRA UUID. The UI
  // no longer does that, but a client is not a trust boundary: reject it here.
  if (
    body.member_display_label.toLowerCase().includes(body.source_dra_id.toLowerCase())
  ) {
    throw new Error('member_display_label must not contain the source DRA id');
  }
  if (typeof body.reason !== 'string' || body.reason.trim().length === 0) {
    throw new Error('reason must be a non-empty string');
  }

  return {
    // Canonicalise to lowercase. The UUID regex accepts uppercase hex and
    // PostgreSQL accepts it too, but it SERIALISES uuid values back in
    // lowercase. Keeping the caller's spelling would make the strict readback
    // comparison below fail after the mutation had already committed, returning
    // a false 409 and inviting a duplicate retry.
    source_dra_id: body.source_dra_id.toLowerCase(),
    coordinate_cluster_id: body.coordinate_cluster_id.trim(),
    member_display_label: body.member_display_label.trim(),
    reason: body.reason.trim(),
  };
}

function mapRpcErrorToResponse(error: { code?: string; message?: string }) {
  if (error.code === '42501') {
    return NextResponse.json(
      { error: 'rpc_forbidden' },
      { status: 403 },
    );
  }
  if (error.code === 'UE404') {
    return NextResponse.json(
      { error: 'not_found' },
      { status: 404 },
    );
  }
  if (error.code === 'UE409' || error.code === '55P03') {
    return NextResponse.json(
      { error: 'conflict' },
      { status: 409 },
    );
  }
  if (error.code === 'UE422') {
    return NextResponse.json(
      { error: 'validation_failed' },
      { status: 422 },
    );
  }
  return NextResponse.json(
    { error: 'rpc_failed' },
    { status: 500 },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authClient = await createAuthenticatedClient();
  const auth = await requireMatrixMapAdmin(authClient);
  if (auth instanceof NextResponse) return auth;

  const csrf = checkCsrf(request);
  if (!csrf.ok) {
    const status =
      csrf.reason === 'missing_content_type' ||
      csrf.reason === 'wrong_content_type'
        ? 415
        : 403;
    return NextResponse.json({ error: csrf.reason, detail: csrf.detail }, { status });
  }

  let payload: CandidatePayload;
  try {
    payload = parseCandidatePayload(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_payload', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const { error } = await authClient
    .schema('matrix_map')
    .rpc('upsert_site_aggregate_candidate', {
      p_source_dra_id: payload.source_dra_id,
      p_coordinate_cluster_id: payload.coordinate_cluster_id,
      p_member_display_label: payload.member_display_label,
      p_actor_id: auth.user.id,
      p_reason: payload.reason,
    });

  if (error) {
    return mapRpcErrorToResponse(error);
  }

  // Verification readback, PAGED to exhaustion. The write above has already
  // COMMITTED by this point. A single unpaged read silently omits rows once
  // publications exceed the PostgREST row cap, which would make a just-written
  // candidate falling beyond the cap look "not found" even though it exists --
  // reporting verification_failed and inviting a retry that writes a spurious
  // refresh + audit row against an already-persisted candidate. Page through
  // until the matching tuple is found, or genuinely exhaust the pages.
  let candidate:
    | { source_dra_id?: unknown; coordinate_cluster_id?: unknown; publication_id?: unknown }
    | undefined;
  let readbackFailed = false;
  let readbackTruncated = false;

  for (let page = 0; page < READBACK_MAX_PAGES; page += 1) {
    const from = page * READBACK_PAGE_SIZE;
    const to = from + READBACK_PAGE_SIZE - 1;
    const { data: readbackRows, error: readErr } = await authClient
      .schema('matrix_map')
      .rpc('fetch_admin_site_aggregate_publications', {
        p_publication_id: null,
      })
      .range(from, to);

    if (readErr) {
      readbackFailed = true;
      break;
    }

    const rows = Array.isArray(readbackRows) ? readbackRows : [];
    candidate = rows.find(
      (row) =>
        typeof row?.source_dra_id === 'string' &&
        row.source_dra_id.toLowerCase() === payload.source_dra_id &&
        row.coordinate_cluster_id === payload.coordinate_cluster_id,
    );

    if (candidate) break;
    if (rows.length < READBACK_PAGE_SIZE) break; // genuinely exhausted
    // Every page so far was full and this was the last permitted page, so the
    // search stopped at the CEILING, not at the end of the data.
    if (page === READBACK_MAX_PAGES - 1) readbackTruncated = true;
  }

  if (readbackFailed) {
    return NextResponse.json(
      { error: 'readback_failed' },
      { status: 500 },
    );
  }

  if (!candidate && readbackTruncated) {
    // Reaching the page ceiling is NOT evidence of absence. Reporting
    // verification_failed here would falsely call an already-COMMITTED mutation
    // missing and invite a retry that writes a spurious refresh + audit row.
    // Surface the cap explicitly instead.
    return NextResponse.json(
      {
        error: 'verification_incomplete',
        detail:
          'Readback hit its page ceiling before locating the candidate; the upsert committed but could not be confirmed. Do not retry blindly.',
        verified: false,
      },
      // 409, deliberately NOT 5xx. The upsert has already COMMITTED, so this is
      // not a transient server fault: 503/500 conventionally invite automated
      // retry, and a retry here would write a spurious refresh plus audit row
      // against an already-persisted candidate. The distinct
      // `verification_incomplete` code (vs `verification_failed`) is what tells
      // the caller the row may well exist beyond the readback ceiling.
      { status: 409 },
    );
  }

  if (!candidate) {
    return NextResponse.json(
      {
        error: 'verification_failed',
        detail: 'Candidate row was not found after upsert.',
        verified: false,
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      publication_id: candidate.publication_id,
      verified: true,
      candidate,
    },
    { status: 200 },
  );
}
