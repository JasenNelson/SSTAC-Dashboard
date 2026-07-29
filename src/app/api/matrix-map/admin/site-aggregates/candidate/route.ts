import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { checkCsrf } from '@/lib/engine-v2/csrf';
import { blankTrim } from '@/lib/matrix-map/blank-trim';
// NOTE: this route deliberately imports NOTHING from the pagination module any
// more. Post-commit verification is an EXACT-ID lookup (p_limit 1, p_offset 0),
// so it has no pagination envelope to share. See the readback block below.

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

interface CandidatePayload {
  source_dra_id: string;
  coordinate_cluster_id: string;
  member_display_label: string;
  reason: string;
}

/**
 * Canonicalizes a string for UUID-containment comparison: lowercase, then
 * discard everything that is not an ASCII hexadecimal character.
 *
 * A uuid therefore reduces to its bare 32-character hex run no matter what the
 * caller interleaves -- hyphens, braces, whitespace, punctuation, or zero-width
 * characters such as U+200B, U+200C, U+200D and U+FEFF. The earlier version
 * stripped only `[-{}]`, so a label carrying the uuid separated by invisible
 * characters passed this check while still RENDERING to members as the raw
 * identifier.
 *
 * Deliberately NOT implemented by widening the SQL `blank_trim` set: that set
 * excludes U+200C ZWNJ and U+200D ZWJ on purpose because they are meaningful in
 * legitimate persisted text. This value is a temporary comparison copy that is
 * never stored, so it can canonicalize far more aggressively without touching
 * the label that actually gets saved.
 *
 * The sixteen hex characters are ENUMERATED rather than written as the ranges
 * `0-9a-f`. A review argued that PostgreSQL bracket RANGES are defined by the
 * active collating sequence, so a non-ASCII character could fall inside `[a-f]`
 * and survive normalization. That was measured on the target platform
 * (PostgreSQL 17.10, database collation en_US.utf8, and again under explicit
 * COLLATE "C" and COLLATE "en-US-x-icu") and did NOT reproduce -- the range and
 * enumerated forms behaved identically for a-acute, e-acute, a-ring, c-cedilla,
 * sharp-s, Cyrillic a, fullwidth a, U+200B and U+200C. The enumeration is kept
 * anyway: it costs nothing and removes reliance on an engine detail the
 * PostgreSQL documentation does describe as collation-sensitive in principle.
 *
 * Exactly matches the SQL side's
 * `regexp_replace(lower(v), '[^0123456789abcdef]', '', 'g')`. A cross-layer
 * contract test pins the two together textually AND behaviourally.
 */
function normalizeForUuidContainment(value: string): string {
  return value.toLowerCase().replace(/[^0123456789abcdef]/g, '');
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
  // EARLY DUPLICATE PRECHECK for the member-label guard -- NOT the security
  // authority. `member_display_label` is stored and served to members verbatim,
  // so it must not carry raw DRA provenance. The authoritative check is the
  // identical one inside `matrix_map.upsert_site_aggregate_candidate`, which
  // runs for EVERY caller including one going straight to PostgREST and
  // bypassing this route entirely. This copy exists only to reject an obvious
  // violation early, with a clearer message, before a round trip.
  //
  // Canonicalized on both sides (see normalizeForUuidContainment) so a compact,
  // mixed-case, brace-wrapped, or invisible-character-interleaved rendering of
  // the uuid cannot slip through -- but the comparison is still containment of
  // the FULL canonical 32-hex-char uuid, so an innocuous label that merely
  // shares a few hex characters with the id is not rejected.
  if (
    normalizeForUuidContainment(body.member_display_label).includes(
      normalizeForUuidContainment(body.source_dra_id),
    )
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

/**
 * Shape of a row returned by the `fetch_admin_site_aggregate_publications`
 * readback RPC, as seen from this route. Every field is `unknown` because the
 * row crosses a trust boundary (it comes back from Postgres via PostgREST);
 * each field is validated at its point of use rather than trusted from this
 * type alone.
 */
interface ReadbackCandidateRow {
  publication_id?: unknown;
  source_dra_id?: unknown;
  coordinate_cluster_id?: unknown;
  member_display_label?: unknown;
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

  const { data: upsertData, error, status } = await authClient
    .schema('matrix_map')
    .rpc('upsert_site_aggregate_candidate', {
      p_source_dra_id: payload.source_dra_id,
      p_coordinate_cluster_id: payload.coordinate_cluster_id,
      p_member_display_label: payload.member_display_label,
      p_actor_id: auth.user.id,
      p_reason: payload.reason,
    });

  if (error) {
    // TRANSPORT FAILURE vs SERVER-REPORTED ERROR. postgrest-js reports a lost
    // or aborted connection as `status: 0` with no SQLSTATE `code`. That case
    // is COMMIT-INDETERMINATE: the statement may well have committed and only
    // the response was lost. Mapping it to a generic retryable 500 let the
    // client re-enable the control, and a retry then performs the second upsert
    // plus duplicate audit entry this whole path exists to prevent.
    //
    // A server-reported SQLSTATE (42501, UE404, UE409, UE422, 55P03) is
    // different: the server answered, so nothing committed. Those keep their
    // existing PRE-commit mapping and must NOT be labelled committed.
    // INDETERMINATE covers two shapes, not one:
    //   * `status === 0` -- postgrest-js's transport failure.
    //   * a code-less 5xx -- a gateway/proxy (502/503/504) answering AFTER the
    //     request may already have reached the database. postgrest-js preserves
    //     that nonzero status, so a `status === 0` test alone misread it as a
    //     pre-commit `rpc_failed` and invited a duplicate write.
    // A SQLSTATE `code` means PostgREST itself reported the error, so the
    // statement genuinely did not commit: that keeps its pre-commit mapping.
    // NO code heuristic. `error.code` arrives from upstream and is not a trust
    // boundary: any five-character string satisfied the SQLSTATE shape, so a
    // proxy could make an indeterminate 5xx look pre-commit. And PostgREST maps
    // genuine SQLSTATEs to 4xx, so a 5xx carrying one is already anomalous.
    // Rule: transport failure OR any 5xx => INDETERMINATE. Conservative by
    // design -- the cost of a false "unknown" is one page reload; the cost of a
    // false "pre-commit" is a duplicate write.
    const isIndeterminate =
      status === 0 ||
      (typeof status === 'number' && status >= 500 && !isPreCommitAnswer(status, error.code));
    if (isIndeterminate) {
      return NextResponse.json(
        {
          error: 'commit_indeterminate',
          detail:
            'No trustworthy result came back (the connection failed, or an intermediary returned a server error), so it is UNKNOWN whether the candidate was written. Do not retry: if it did commit, a retry performs another upsert and writes another refresh audit entry. Reload the page and check whether the candidate exists before acting again.',
          committed: null,
          verified: false,
          retry_safe: false,
        },
        // 409, not 5xx: 5xx invites automated retry, which is precisely what
        // must not happen while the outcome is unknown.
        { status: 409 },
      );
    }
    return mapRpcErrorToResponse(error);
  }

  // EXACT-ID POST-COMMIT VERIFICATION.
  //
  // This used to PAGE the whole candidate collection looking for a matching
  // (source_dra_id, coordinate_cluster_id) tuple. That was unsound, and a
  // review proved why: OFFSET pages across INDEPENDENT statements are not a
  // database snapshot. The fetch RPC's ORDER BY is a total order within ONE
  // statement, but `sample_count_total` and `member_display_label` are part of
  // that sort key, so a concurrent refresh between two page requests can move a
  // row across an OFFSET boundary -- returning one row twice and another never.
  // The scan could therefore report `verification_failed` for a candidate that
  // WAS committed, which is exactly the false negative this whole block exists
  // to prevent.
  //
  // The upsert now RETURNS the persisted publication id, so verification is a
  // single exact-ID lookup that no concurrent reordering can move. It is also
  // strictly cheaper: one bounded row instead of up to 25 full pages.
  const returnedPublicationId = typeof upsertData === 'string' ? upsertData : null;

  if (returnedPublicationId === null || !UUID_RE.test(returnedPublicationId)) {
    // The RPC reported SUCCESS but did not hand back a usable id. The write has
    // therefore already COMMITTED and we simply cannot address it for
    // verification. Fail closed as post-commit, and -- deliberately -- do NOT
    // fall back to a broad scan: that fallback would reintroduce the exact
    // unsound paged search this change removes, on the least-understood path.
    return NextResponse.json(
      {
        error: 'verification_id_missing',
        detail:
          'The candidate was written and COMMITTED, but the upsert did not return a usable publication id, so the persisted values could not be confirmed. Do not retry this action: a retry performs another upsert and writes another refresh audit entry. Reload the page and reconcile the candidate against live data before acting again.',
        committed: true,
        verified: false,
        retry_safe: false,
      },
      // 409, deliberately NOT 5xx: the upsert already committed, and 5xx
      // conventionally invites the automated retry that would duplicate it.
      { status: 409 },
    );
  }

  // EXACTLY ONE verification RPC, addressed by id. p_limit 1 / p_offset 0 is
  // not pagination: it is the bounded shape of a single-row lookup.
  const { data: readbackRows, error: readErr } = await authClient
    .schema('matrix_map')
    .rpc('fetch_admin_site_aggregate_publications', {
      p_publication_id: returnedPublicationId,
      p_limit: 1,
      p_offset: 0,
    });

  const rows: ReadbackCandidateRow[] = Array.isArray(readbackRows) ? readbackRows : [];
  const candidate: ReadbackCandidateRow | undefined = rows[0];

  if (readErr) {
    // POST-COMMIT. The upsert RPC above already COMMITTED before this readback
    // was attempted, so a bare 500 was actively harmful: 5xx conventionally
    // reads as "transient, safe to retry", the UI re-enabled the control, and a
    // retry performed a SECOND upsert plus a spurious refresh audit row against
    // an already-persisted candidate. Say plainly what happened instead.
    return NextResponse.json(
      {
        error: 'readback_failed',
        detail:
          'The candidate was written and COMMITTED, but the verification readback failed, so the persisted values could not be confirmed. Do not retry this action: a retry performs another upsert and writes another refresh audit entry. Reload the page and reconcile the candidate against live data before acting again.',
        committed: true,
        verified: false,
        retry_safe: false,
      },
      // 409, deliberately NOT 5xx, for the reason above.
      { status: 409 },
    );
  }

  // `verification_incomplete` is GONE, deliberately. It existed only to say
  // "the paged search hit its ceiling before finding the row, so absence is not
  // proven". An exact-ID lookup has no ceiling and no pages, so that state is
  // now unreachable rather than merely unused -- there is no path that can
  // produce it. Absence here is genuine absence of that id.
  if (!candidate) {
    return NextResponse.json(
      {
        error: 'verification_failed',
        committed: true,
        retry_safe: false,
        detail: 'Candidate row was not found after upsert.',
        verified: false,
      },
      { status: 409 },
    );
  }

  // The row must be the one we just wrote, addressed by the id the upsert
  // returned. An id-addressed lookup already constrains this, but asserting it
  // here means a future change that loosened the lookup cannot silently start
  // verifying a DIFFERENT row.
  const rowPublicationId =
    typeof candidate.publication_id === 'string' ? candidate.publication_id : null;
  const rowSourceDraId =
    typeof candidate.source_dra_id === 'string' ? candidate.source_dra_id.toLowerCase() : null;
  const rowClusterId =
    typeof candidate.coordinate_cluster_id === 'string' ? candidate.coordinate_cluster_id : null;

  if (
    rowPublicationId !== returnedPublicationId ||
    rowSourceDraId !== payload.source_dra_id ||
    rowClusterId !== payload.coordinate_cluster_id
  ) {
    // Same post-commit posture as every other verification failure below: the
    // write landed, but what came back is not the row we wrote.
    return NextResponse.json(
      {
        error: 'verification_failed',
        committed: true,
        retry_safe: false,
        detail:
          'The verification readback returned a row that does not match the candidate just written. The upsert already committed. Do not retry blindly: reload and reconcile instead.',
        verified: false,
      },
      { status: 409 },
    );
  }

  // LABEL-APPLIED verification. Matching on (source_dra_id, coordinate_cluster_id)
  // alone is not sufficient: on a REFRESH that row already existed before this
  // request, so a stale/no-op RPC or a concurrent overwrite can leave the
  // requested label unapplied while the tuple match above still succeeds. The
  // persisted `member_display_label` must equal the canonical validated
  // `payload.member_display_label` (already trimmed) before this route claims
  // `verified: true`.
  const persistedLabel =
    typeof candidate.member_display_label === 'string' ? candidate.member_display_label : null;
  // Compare against what the DATABASE will have stored, not against the raw
  // request. The SQL normalizes with matrix_map.blank_trim, whose TrimString set
  // is wider than JavaScript `.trim()`. `.trim()` does strip U+FEFF (it is
  // whitespace per spec) but NOT U+200B, and it does not track the SQL's
  // explicitly enumerated set. Comparing the raw payload would report
  // `verification_label_mismatch` for a label that committed exactly as
  // intended. `blankTrim` mirrors the SQL set, and a contract test asserts the
  // two sets are identical so they cannot drift apart.
  const expectedLabel = blankTrim(payload.member_display_label);
  if (persistedLabel !== expectedLabel) {
    // The upsert RPC has already COMMITTED by this point, so this is not a
    // transient server fault: 5xx conventionally invites an automated retry,
    // and a retry here would write a spurious refresh + audit row against an
    // already-persisted candidate whose label mismatch is a real, standing
    // condition, not a fluke of this one request. Distinct code from
    // `verification_failed` (no row for that id, or a row that is not the one
    // written) and from `verification_id_missing` (the upsert returned no
    // usable id), matching the existing `verification_*` naming style.
    return NextResponse.json(
      {
        error: 'verification_label_mismatch',
        detail:
          'The persisted candidate label does not match the requested label; the upsert already committed. Do not retry blindly: a retry performs another upsert and writes another refresh audit entry. Reload and reconcile instead.',
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
      publication_id: candidate.publication_id,
      verified: true,
      candidate,
    },
    { status: 200 },
  );
}
