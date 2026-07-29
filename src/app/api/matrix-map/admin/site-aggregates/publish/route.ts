import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { checkCsrf } from '@/lib/engine-v2/csrf';

export const runtime = 'nodejs';

const ADMIN_ROLES = ['admin', 'matrix_admin'];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
      // Provably PRE-commit: this returns before the mutation RPC is invoked,
      // so nothing was written. Without these fields the client's boolean
      // requirement would latch the control and tell the operator the outcome
      // is unknown, which is false.
      { error: 'admin_role_query_failed', committed: false, retry_safe: true },
      { status: 500 },
    );
  }

  if (!role) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  return { user };
}

interface PublishPayload {
  publication_id: string;
  public: boolean;
  reason: string;
  /**
   * The publication version the operator actually reviewed, echoed back
   * verbatim. REQUIRED to publish; optional to unpublish, because retraction
   * only reduces member visibility and must stay reachable from a stale view.
   *
   * Passed through as an opaque string. The route deliberately does NOT parse
   * or reformat it: a round trip through Date drops sub-millisecond precision
   * and would turn every publish into a spurious conflict.
   */
  expected_updated_at: string | null;
}

function parsePublishPayload(value: unknown): PublishPayload {
  if (!value || typeof value !== 'object') {
    throw new Error('body must be an object');
  }
  const body = value as Record<string, unknown>;

  if (typeof body.publication_id !== 'string' || !UUID_RE.test(body.publication_id)) {
    throw new Error('publication_id must be a UUID string');
  }
  if (typeof body.public !== 'boolean') {
    throw new Error('public must be a boolean');
  }
  if (typeof body.reason !== 'string' || body.reason.trim().length === 0) {
    throw new Error('reason must be a non-empty string');
  }
  const expectedUpdatedAt =
    body.expected_updated_at === null || body.expected_updated_at === undefined
      ? null
      : body.expected_updated_at;
  if (expectedUpdatedAt !== null && typeof expectedUpdatedAt !== 'string') {
    throw new Error('expected_updated_at must be a string or null');
  }
  // Publishing without the reviewed-version token is rejected HERE as well as
  // in SQL. The SQL check is the real boundary -- a direct PostgREST caller
  // never reaches this code -- but failing early gives the operator a 400 with
  // a clear cause instead of a UE409 surfaced as a conflict.
  if (body.public === true && !expectedUpdatedAt) {
    throw new Error('expected_updated_at is required when publishing');
  }

  return {
    publication_id: body.publication_id,
    public: body.public,
    reason: body.reason.trim(),
    expected_updated_at: expectedUpdatedAt,
  };
}


/**
 * Maps a SERVER-REPORTED SQLSTATE to a response. Every branch here is
 * PRE-COMMIT: PostgREST answered with a SQLSTATE, so the statement did not
 * execute. Each response says so explicitly with `committed: false` and
 * `retry_safe: true`, because the client cannot infer it from the status alone
 * -- these routes also return 409 for POST-commit outcomes, and the two must
 * not be confused. Silence would (correctly) make the client fail closed and
 * latch, which would needlessly block a genuinely retryable action.
 */
/**
 * The ONLY SQLSTATE that both (a) PostgREST can actually report at a 5xx and
 * (b) is definitionally pre-commit.
 *
 * PostgREST derives HTTP status from SQLSTATE, and the mapping matters here:
 *   - `55P03` (lock_not_available, raised by our `LOCK ... NOWAIT`) falls under
 *     the `55*` class -> 500. The lock failing means the mutation never ran.
 *   - our custom `UE*` codes hit PostgREST's catch-all -> 400, NOT 5xx, so they
 *     never reach this branch and need no exemption.
 *   - `42501` -> 403 (authenticated) / 401, likewise never 5xx.
 *   - `XX*` internal errors -> 500 and are genuinely unknown: NOT exempt.
 *
 * So the exemption is deliberately ONE code at ONE status. Widening it -- to
 * codes PostgREST cannot emit at 5xx, or to 5xx statuses PostgREST does not
 * pair with this code -- would buy nothing and would re-open the earlier
 * defect: an anomalous gateway response carrying a forged application code
 * would be read as pre-commit when the mutation may in fact have committed.
 *
 * Consulted ONLY at exactly 500, never at another 5xx and never at
 * `status === 0`, where no server response exists and any `code` present is
 * client-side (e.g. ECONNRESET).
 */
const PRE_COMMIT_SQLSTATE_AT_500 = '55P03';

function isPreCommitAnswer(status: number, code: unknown): boolean {
  // The pairing must match EXACTLY what PostgREST can emit. PostgREST maps
  // 55P03 to 500 specifically, so 55P03 arriving at 502/503/504 did not come
  // from PostgREST -- it is a gateway anomaly and must fail closed exactly like
  // a forged application code, because a response lost AFTER commit would
  // otherwise be reported as safe to retry.
  return status === 500 && code === PRE_COMMIT_SQLSTATE_AT_500;
}

function mapRpcErrorToResponse(error: { code?: string; message?: string }) {
  if (error.code === '42501') {
    return NextResponse.json(
      { error: 'rpc_forbidden', committed: false, retry_safe: true },
      { status: 403 },
    );
  }
  if (error.code === 'UE404') {
    return NextResponse.json(
      { error: 'not_found', committed: false, retry_safe: true },
      { status: 404 },
    );
  }
  if (error.code === 'UE409' || error.code === '55P03') {
    return NextResponse.json(
      { error: 'conflict', committed: false, retry_safe: true },
      { status: 409 },
    );
  }
  if (error.code === 'UE422') {
    return NextResponse.json(
      { error: 'validation_failed', committed: false, retry_safe: true },
      { status: 422 },
    );
  }
  return NextResponse.json(
    { error: 'rpc_failed', committed: false, retry_safe: true },
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

  let payload: PublishPayload;
  try {
    payload = parsePublishPayload(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_payload', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const { error, status } = await authClient
    .schema('matrix_map')
    .rpc('flip_site_aggregate_public', {
      p_publication_id: payload.publication_id,
      p_new_value: payload.public,
      p_actor_id: auth.user.id,
      p_reason: payload.reason,
      p_expected_updated_at: payload.expected_updated_at,
    });

  if (error) {
    // TRANSPORT failure (postgrest-js reports status 0, no SQLSTATE) is
    // COMMIT-INDETERMINATE: the flip may have landed and only the response was
    // lost. A retryable 5xx here would let the operator re-issue a visibility
    // change. A server-reported SQLSTATE means nothing committed and keeps its
    // existing pre-commit mapping.
    // See the candidate route: no code heuristic -- transport failure or any
    // 5xx is INDETERMINATE, because `error.code` is untrusted upstream input.
    if (
      status === 0 ||
      (typeof status === 'number' && status >= 500 && !isPreCommitAnswer(status, error.code))
    ) {
      return NextResponse.json(
        {
          error: 'commit_indeterminate',
          detail:
            'No trustworthy result came back (the connection failed, or an intermediary returned a server error), so it is UNKNOWN whether the publication state changed. Do not retry: reload the page and check the current state before acting again.',
          committed: null,
          verified: false,
          retry_safe: false,
        },
        { status: 409 },
      );
    }
    return mapRpcErrorToResponse(error);
  }

  const { data: readbackRows, error: readErr } = await authClient
    .schema('matrix_map')
    // Exact-id readback: at most one row can match, but the bounds are still
    // stated explicitly because the RPC has no argument defaults -- every
    // caller declares what it wants rather than inheriting a page size.
    .rpc('fetch_admin_site_aggregate_publications', {
      p_publication_id: payload.publication_id,
      p_limit: 1,
      p_offset: 0,
    });

  if (readErr) {
    // POST-COMMIT: flip_site_aggregate_public already committed. A 5xx invited
    // a retry that would issue a SECOND visibility change plus another audit
    // entry against an already-changed publication.
    return NextResponse.json(
      {
        error: 'readback_failed',
        detail:
          'The publication state was changed and COMMITTED, but the verification readback failed, so the resulting state could not be confirmed. Do not retry: reload the page and check the current state before acting again.',
        committed: true,
        verified: false,
        retry_safe: false,
      },
      { status: 409 },
    );
  }

  const readback = Array.isArray(readbackRows) ? readbackRows[0] : null;
  if (!readback || typeof readback.is_published !== 'boolean') {
    // Also POST-COMMIT, for the same reason as readback_failed above.
    return NextResponse.json(
      {
        error: 'readback_missing',
        detail:
          'The publication state was changed and COMMITTED, but the verification readback returned no usable row. Do not retry: reload the page and check the current state before acting again.',
        committed: true,
        verified: false,
        retry_safe: false,
      },
      { status: 409 },
    );
  }

  const actualPublic = readback.is_published;
  const verified = actualPublic === payload.public;

  if (!verified) {
    return NextResponse.json(
      {
        error: 'verification_failed',
        detail:
          'The publication state after the change does not match what was requested; the change already committed. Do not retry: reload the page and reconcile before acting again.',
        publication_id: payload.publication_id,
        public: actualPublic,
        committed: true,
        verified: false,
        retry_safe: false,
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      publication_id: payload.publication_id,
      public: payload.public,
      verified: true,
    },
    { status: 200 },
  );
}
