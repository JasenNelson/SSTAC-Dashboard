import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  cookies: vi.fn(),
  checkCsrf: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.mock('@/lib/engine-v2/csrf', () => ({
  checkCsrf: mocks.checkCsrf,
}));

import { POST } from '../route';
// NOTE: this suite deliberately imports NOTHING from the pagination module.
// Post-commit verification is an exact-ID lookup, so the route has no
// pagination envelope to share and nothing here should be expressed in pages.

const SOURCE_DRA_ID = '11111111-1111-4111-8111-111111111111';
// F2: a REAL canonical rendering, not a placeholder. The route parses this
// field through `parseServerClusterIdentity`, which rejects anything that is not
// two 'FM9990.00000' renderings joined by a comma -- so a placeholder would now
// make every test in this file exercise the rejection path instead of the route.
const CLUSTER_ID = '49.28270,-123.12070';
const REPRESENTATIVE_LATITUDE = 49.2827;
const REPRESENTATIVE_LONGITUDE = -123.1207;
const ADMIN_USER = '22222222-2222-4222-8222-222222222222';
const PUBLICATION_ID = '33333333-3333-4333-8333-333333333333';

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    source_dra_id: SOURCE_DRA_ID,
    // F2: the ASSERTED key plus the INDEPENDENT locator it must render from.
    expected_cluster_id: CLUSTER_ID,
    representative_latitude: REPRESENTATIVE_LATITUDE,
    representative_longitude: REPRESENTATIVE_LONGITUDE,
    member_display_label: 'Neutral Label 1',
    reason: 'initial candidate',
    ...overrides,
  };
}

function makeRequest(body: unknown) {
  return new NextRequest(
    'http://localhost/api/matrix-map/admin/site-aggregates/candidate',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify(body),
    },
  );
}

/**
 * Mirrors the publish-route template's chain mock, but additionally CAPTURES the
 * arguments passed to `.in()`. Asserting on those captured args is what makes the
 * role tests non-vacuous: a test that only stubs a null row proves nothing about
 * WHICH roles the route accepts, and would still pass if the allow-list changed.
 */
function roleChain(finalValue: unknown) {
  const captured: { column?: string; values?: unknown } = {};
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    in: vi.fn((column: string, values: unknown) => {
      captured.column = column;
      captured.values = values;
      return api;
    }),
    limit: vi.fn(() => api),
    maybeSingle: vi.fn(async () => finalValue),
    captured,
  };
  return api;
}

/**
 * THE ONE LEGAL VERIFICATION READBACK SHAPE.
 *
 * Post-commit verification is an EXACT-ID lookup, not pagination. The upsert
 * returns the persisted publication id; the route looks that id up directly.
 * `p_limit: 1, p_offset: 0` is the bounded shape of a single-row lookup, not a
 * first page -- there is no second page and no ceiling.
 *
 * This replaced a scan of the whole candidate collection. That scan was
 * unsound: OFFSET pages across independent statements are not a snapshot, so a
 * concurrent refresh could move a row across a page boundary and make the scan
 * report `verification_failed` for a candidate that WAS committed.
 */
function expectedReadbackArgs(publicationId: string) {
  return { p_publication_id: publicationId, p_limit: 1, p_offset: 0 };
}

/**
 * Asserts the readback made EXACTLY ONE call, with the exact expected
 * arguments -- never a bare call count, and never merely "the first call looked
 * right".
 */
function expectExactlyOneIdReadback(
  args: Array<Record<string, unknown>>,
  publicationId: string,
) {
  expect(args).toEqual([expectedReadbackArgs(publicationId)]);
  expect(args).toHaveLength(1);
  expect(args[1]).toBeUndefined();
}

/**
 * The HTTP status PostgREST reports for a given SQLSTATE -- for the SMALL set of
 * codes this suite actually uses and whose mapping is certain.
 *
 * It deliberately REFUSES to guess. Earlier versions tried to model PostgREST's
 * whole mapping table and were wrong six times running (custom `UE*` codes,
 * the `40*` rollback class, `PTxyz` overrides, the v12+ `53400` / `54*`
 * behaviour, PostgREST-native `PGRST***` codes). Each wrong entry silently
 * produced an impossible status/code pair and exercised the wrong branch of the
 * classifier -- the exact failure this helper exists to prevent.
 *
 * Modelling an upstream mapping that varies by PostgREST version, from a repo
 * with no PostgREST to test against, cannot be made reliable by adding more
 * entries. So an unmodelled code is a hard ERROR -- as is a MISSING code and a
 * malformed one (a SQLSTATE is exactly five uppercase alphanumerics). Pass
 * `rpcStatus` explicitly and state the pairing you mean to test.
 */
function realisticPostgrestStatus(code: unknown): number {
  const refuse = (why: string): never => {
    throw new Error(
      `realisticPostgrestStatus: ${why}. Pass an explicit rpcStatus instead of ` +
        'relying on a guessed default.',
    );
  };
  // A code-less error is NOT implicitly a 500: a code-less PostgREST or client
  // error can accompany several statuses, so guessing one silently invents the
  // pairing under test.
  if (typeof code !== 'string') refuse('the error carries no SQLSTATE');
  // A SQLSTATE is EXACTLY five uppercase alphanumerics. Anything else cannot be
  // one, so prefix matching must not accept it -- `UEfoobar` is not a code.
  if (!/^[A-Z0-9]{5}$/.test(code as string)) {
    refuse(`"${code as string}" is not a well-formed SQLSTATE`);
  }
  const sqlstate = code as string;
  // PostgREST's explicit override: the three characters after `PT` ARE the status.
  const ptOverride = /^PT(\d{3})$/.exec(sqlstate);
  if (ptOverride) return Number(ptOverride[1]);
  if (sqlstate === '55P03') return 500; // lock_not_available, the one 5xx pre-commit code
  if (sqlstate === '42501') return 403; // insufficient_privilege, authenticated
  if (sqlstate.startsWith('XX')) return 500; // internal_error class
  if (sqlstate.startsWith('UE')) return 400; // our own codes, via PostgREST's catch-all
  return refuse(`no certain mapping for SQLSTATE "${sqlstate}"`);
}

function setupAdminClient(options: {
  role?: string | null;
  roleError?: unknown;
  rpcError?: unknown;
  /** HTTP status postgrest-js reports for the RPC call. 0 = transport failure. */
  rpcStatus?: number;
  readbackRows?: unknown;
  /**
   * ADVERSARIAL RPC-BOUNDARY FIXTURE. Returned VERBATIM, deliberately bypassing
   * the mock's normal `p_publication_id` filtering.
   *
   * That bypass is the point, not a shortcut. The database is an UNTRUSTED
   * boundary as far as this route is concerned: the route must validate what
   * came back rather than assume the server honoured the id it asked for. A
   * mock that always filters correctly can never exercise that validation --
   * the offending row is removed before the route ever sees it.
   */
  rawReadbackRows?: unknown;
  readbackError?: unknown;
  /**
   * What the upsert RPC returns as `data`. The real function RETURNS uuid --
   * the persisted publication id -- and the route uses it for the exact-ID
   * readback. Overridden by tests that exercise a malformed or missing return.
   */
  upsertReturn?: unknown;
} = {}) {
  const {
    role = 'matrix_admin',
    roleError = null,
    rpcError = null,
    // Defaults to what PostgREST would REALLY return for that code, not 200.
    // A 200 default made every error test exercise an impossible status and
    // CONCEALED the interaction between the error mapper and the
    // indeterminate rule.
    rpcStatus = options.rpcError
      ? realisticPostgrestStatus((options.rpcError as { code?: unknown }).code)
      : 200,
    readbackRows = [
      {
        publication_id: PUBLICATION_ID,
        source_dra_id: SOURCE_DRA_ID,
        coordinate_cluster_id: CLUSTER_ID,
        member_display_label: 'Neutral Label 1',
      },
    ],
    readbackError = null,
  } = options;

  // NOT a destructuring default: `upsertReturn: undefined` must mean "the RPC
  // returned undefined", which is one of the malformed-return cases under test.
  // A default would silently rewrite it to the valid id and make that case
  // vacuous.
  const upsertReturn = 'upsertReturn' in options ? options.upsertReturn : PUBLICATION_ID;

  // THE READBACK MOCK IS KEYED ON `p_publication_id`, and answers ONLY that id.
  //
  // This is what makes the mutation controls below bite. A route that reverted
  // to `p_publication_id: null` (the old broad scan) is answered with an EMPTY
  // result rather than being quietly handed the fixture rows, so it fails
  // closed and the test fails -- instead of passing because the mock was
  // permissive about how the row was asked for.
  const readbackArgs: Array<Record<string, unknown>> = [];
  const rpc = vi.fn((name: string, args?: Record<string, unknown>) => {
    if (name === 'upsert_site_aggregate_candidate') {
      return Promise.resolve({ data: upsertReturn, error: rpcError, status: rpcStatus });
    }
    if (name === 'fetch_admin_site_aggregate_publications') {
      readbackArgs.push({
        p_publication_id: args?.p_publication_id,
        p_limit: args?.p_limit,
        p_offset: args?.p_offset,
      });
      if (readbackError) {
        return Promise.resolve({ data: null, error: readbackError });
      }
      // Adversarial boundary fixture: hand back exactly what the test supplied,
      // without honouring the requested id. Only used to prove the route
      // validates untrusted RPC output.
      if ('rawReadbackRows' in options) {
        return Promise.resolve({ data: options.rawReadbackRows, error: null });
      }
      // Only an exact-id request is answered. A null/absent id -- the retired
      // collection scan -- gets nothing.
      const requestedId = args?.p_publication_id;
      if (typeof requestedId !== 'string' || requestedId.length === 0) {
        return Promise.resolve({ data: [], error: null });
      }
      const rows = Array.isArray(readbackRows)
        ? (readbackRows as Array<Record<string, unknown>>).filter(
            (r) => r?.publication_id === requestedId,
          )
        : readbackRows; // non-array fixtures exercise the "not an array" path
      return Promise.resolve({ data: rows, error: null });
    }
    return Promise.resolve({ data: null, error: { message: `unexpected rpc: ${name}` } });
  });

  const chain = roleChain(
    roleError ? { data: null, error: roleError } : { data: role ? { role } : null, error: null },
  );

  const authClient = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: ADMIN_USER } },
        error: null,
      })),
    },
    from: vi.fn(() => chain),
    schema: vi.fn(() => ({ rpc })),
  };
  mocks.createServerClient.mockReturnValue(authClient);
  return { authClient, rpc, readbackArgs, chain };
}

describe('POST /api/matrix-map/admin/site-aggregates/candidate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    mocks.cookies.mockResolvedValue({ get: vi.fn(), set: vi.fn() });
    mocks.checkCsrf.mockReturnValue({ ok: true });
  });

  describe('authorization', () => {
    it('returns 401 when there is no user, without touching the matrix_map schema', async () => {
      const authClient = {
        auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
        schema: vi.fn(),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'unauthorized' });
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('returns 401 when getUser reports an error', async () => {
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: null },
            error: { message: 'jwt expired' },
          })),
        },
        schema: vi.fn(),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'unauthorized' });
    });

    it('returns 403 for an authenticated non-admin, without touching the matrix_map schema', async () => {
      const { authClient } = setupAdminClient({ role: null });

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'forbidden' });
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('returns 500 when the role lookup itself errors (fails closed, no RPC)', async () => {
      const { authClient } = setupAdminClient({ roleError: { message: 'db down' } });

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: 'admin_role_query_failed',
        committed: false,
        retry_safe: true,
      });
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it.each(['admin', 'matrix_admin'])('accepts the %s role', async (role) => {
      const { rpc } = setupAdminClient({ role });

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith(
        'upsert_site_aggregate_candidate',
        expect.anything(),
      );
    });

    it('restricts the role query to exactly admin and matrix_admin', async () => {
      // Non-vacuous: asserts the actual allow-list the route filters on, so this
      // test fails if a third role is ever added or the filter is removed.
      const { chain } = setupAdminClient({ role: 'admin' });

      await POST(makeRequest(validBody()));

      expect(chain.captured.column).toBe('role');
      expect(chain.captured.values).toEqual(['admin', 'matrix_admin']);
    });

    it('rejects a role outside the allow-list', async () => {
      // The `.in()` filter is what excludes this role server-side; the route sees
      // no matching row and must return 403.
      const { authClient } = setupAdminClient({ role: null });

      const response = await POST(makeRequest(validBody({ reason: 'member attempt' })));

      expect(response.status).toBe(403);
      expect(authClient.schema).not.toHaveBeenCalled();
    });
  });

  describe('CSRF', () => {
    it('returns 415 for a missing content type', async () => {
      mocks.checkCsrf.mockReturnValue({
        ok: false,
        reason: 'missing_content_type',
        detail: 'no content-type header',
      });
      const { authClient } = setupAdminClient();

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(415);
      expect((await response.json()).error).toBe('missing_content_type');
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('returns 415 for a wrong content type', async () => {
      mocks.checkCsrf.mockReturnValue({
        ok: false,
        reason: 'wrong_content_type',
        detail: 'text/plain',
      });
      const { authClient } = setupAdminClient();

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(415);
      expect((await response.json()).error).toBe('wrong_content_type');
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('returns 403 for an origin mismatch, before any RPC', async () => {
      mocks.checkCsrf.mockReturnValue({
        ok: false,
        reason: 'origin_mismatch',
        detail: 'http://evil.example',
      });
      const { authClient } = setupAdminClient();

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(403);
      expect((await response.json()).error).toBe('origin_mismatch');
      expect(authClient.schema).not.toHaveBeenCalled();
    });
  });

  describe('payload validation', () => {
    it.each([
      ['a non-UUID source_dra_id', { source_dra_id: 'not-a-uuid' }],
      ['a non-string source_dra_id', { source_dra_id: 12345 }],
      ['an empty expected_cluster_id', { expected_cluster_id: '   ' }],
      ['a non-canonical expected_cluster_id', { expected_cluster_id: 'cluster-alpha' }],
      ['a whitespace-padded expected_cluster_id', { expected_cluster_id: ` ${CLUSTER_ID} ` }],
      ['a missing expected_cluster_id', { expected_cluster_id: undefined }],
      ['a missing representative_latitude', { representative_latitude: undefined }],
      ['a missing representative_longitude', { representative_longitude: undefined }],
      ['a NaN representative_latitude', { representative_latitude: Number.NaN }],
      ['an out-of-range representative_latitude', { representative_latitude: 500 }],
      ['an out-of-range representative_longitude', { representative_longitude: -180.5 }],
      ['a string representative_latitude', { representative_latitude: '49.2827' }],
      ['an empty member_display_label', { member_display_label: '   ' }],
      ['an empty reason', { reason: '   ' }],
      ['an array source_dra_id (bulk attempt)', { source_dra_id: [SOURCE_DRA_ID] }],
    ])('rejects %s with 400 and never calls the RPC', async (_label, override) => {
      const { authClient } = setupAdminClient();

      const response = await POST(makeRequest(validBody(override)));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('invalid_payload');
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('trims the label and reason -- but NOT the cluster id -- before sending them to the RPC', async () => {
      const { rpc } = setupAdminClient();

      await POST(
        makeRequest(
          validBody({
            member_display_label: '  Neutral Label 1  ',
            reason: '  initial candidate  ',
          }),
        ),
      );

      // F2: SEVEN named arguments. The assertion is exact rather than partial,
      // so a renamed or extra parameter cannot pass unnoticed -- PostgREST binds
      // by NAME, and the 5-argument overload is dropped in the same transaction
      // that creates this one.
      expect(rpc).toHaveBeenCalledWith('upsert_site_aggregate_candidate', {
        p_source_dra_id: SOURCE_DRA_ID,
        p_expected_cluster_id: CLUSTER_ID,
        p_representative_latitude: REPRESENTATIVE_LATITUDE,
        p_representative_longitude: REPRESENTATIVE_LONGITUDE,
        p_member_display_label: 'Neutral Label 1',
        p_actor_id: ADMIN_USER,
        p_reason: 'initial candidate',
      });
    });

    it('REJECTS a whitespace-padded cluster id rather than repairing it', async () => {
      // Deliberately NOT trimmed, unlike the label and reason. A canonical id is
      // a fixed rendering: padding means the value did not come from
      // `canonical_five_decimal_cluster`, and silently normalising it would
      // manufacture agreement with the server's derivation instead of detecting
      // the disagreement. The anchored shape check rejects it before any RPC.
      const { authClient } = setupAdminClient();

      const response = await POST(
        makeRequest(validBody({ expected_cluster_id: `  ${CLUSTER_ID}  ` })),
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('invalid_payload');
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('never echoes the offending cluster id or coordinates in the error detail (D-F2-6)', async () => {
      setupAdminClient();

      const response = await POST(
        makeRequest(
          validBody({ expected_cluster_id: '12.34567,-98.76543', representative_latitude: 500 }),
        ),
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(String(body.detail ?? '')).not.toContain('12.34567');
      expect(String(body.detail ?? '')).not.toContain('98.76543');
      expect(String(body.detail ?? '')).not.toContain('500');
    });

    it('uses the server-resolved actor id, never a client-supplied one', async () => {
      const { rpc } = setupAdminClient();

      await POST(
        makeRequest(validBody({ p_actor_id: 'attacker', actor_id: 'attacker' })),
      );

      expect(rpc).toHaveBeenCalledWith(
        'upsert_site_aggregate_candidate',
        expect.objectContaining({ p_actor_id: ADMIN_USER }),
      );
    });

    describe('member_display_label must not carry the source DRA id', () => {
      // The label is served to members verbatim, so it must never carry raw DRA
      // provenance -- neither an exact copy nor the id embedded in a longer
      // string, and the check must not be defeated by letter-case alone.
      it.each([
        ['an exact match', SOURCE_DRA_ID],
        ['the id embedded in a longer string', `Site ${SOURCE_DRA_ID} West`],
        ['the id in a different letter case', SOURCE_DRA_ID.toUpperCase()],
        ['the id with hyphens stripped (compact rendering)', SOURCE_DRA_ID.replace(/-/g, '')],
        ['the id compact AND mixed/upper-cased', SOURCE_DRA_ID.replace(/-/g, '').toUpperCase()],
        ['the id brace-wrapped', `{${SOURCE_DRA_ID}}`],
        ['the id brace-wrapped, compact, and upper-cased', `{${SOURCE_DRA_ID.replace(/-/g, '').toUpperCase()}}`],
      ])('rejects %s with 400 invalid_payload and never calls the RPC', async (_label, embedded) => {
        const { authClient } = setupAdminClient();

        const response = await POST(
          makeRequest(validBody({ member_display_label: embedded })),
        );

        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe('invalid_payload');
        expect(authClient.schema).not.toHaveBeenCalled();
      });

      it('accepts an innocuous label that merely shares a few hex characters with the source DRA id', async () => {
        // Non-overbroad: the guard rejects containment of the FULL normalized
        // 32-hex-char uuid, not any shared substring, so a label that happens
        // to share a short hex fragment must still be allowed through.
        const partialHexFragment = SOURCE_DRA_ID.replace(/-/g, '').slice(0, 6);
        const innocuousLabel = `Site ${partialHexFragment} North`;
        const { rpc } = setupAdminClient({
          readbackRows: [
            {
              publication_id: PUBLICATION_ID,
              source_dra_id: SOURCE_DRA_ID,
              coordinate_cluster_id: CLUSTER_ID,
              member_display_label: innocuousLabel,
            },
          ],
        });

        const response = await POST(
          makeRequest(validBody({ member_display_label: innocuousLabel })),
        );

        expect(response.status).toBe(200);
        expect(rpc).toHaveBeenCalledWith(
          'upsert_site_aggregate_candidate',
          expect.anything(),
        );
      });
    });

    it('canonicalises an uppercase-hex source_dra_id to lowercase before calling the RPC', async () => {
      const { rpc } = setupAdminClient();

      await POST(
        makeRequest(validBody({ source_dra_id: SOURCE_DRA_ID.toUpperCase() })),
      );

      expect(rpc).toHaveBeenCalledWith(
        'upsert_site_aggregate_candidate',
        expect.objectContaining({ p_source_dra_id: SOURCE_DRA_ID }),
      );
    });

    /**
     * THE ROUTE MUST ACCEPT POSTGRESQL'S UUID DOMAIN, NOT RFC 4122's SUBSET.
     *
     * `UUID_RE` previously carried RFC 4122 `[1-5]` version and `[89ab]` variant
     * classes. The PostgreSQL `uuid` type stores any 128-bit value and no
     * constraint on these columns enforces conformance -- `gen_random_uuid()`
     * emitting v4 is a fact about the generator, not about the domain.
     *
     * The consequence was a SEAM FAILURE, not a theoretical one: the live-preview
     * RPC returns whatever id the row holds, the admin page renders a control for
     * it, and the route then refused the write for ids the database had just
     * handed out. Every value below is a legitimate PostgreSQL uuid, and several
     * are taken from this repository's own replay and perf fixtures.
     */
    it.each([
      ['all-ones, non-RFC version and variant nibbles', '11111111-1111-1111-1111-111111111111'],
      ['leading a, non-RFC variant nibble', 'a1111111-1111-1111-1111-111111111111'],
      ['the nil uuid', '00000000-0000-0000-0000-000000000000'],
      ['the max uuid', 'ffffffff-ffff-ffff-ffff-ffffffffffff'],
      ['a v7-style id, version nibble 7', '018f0000-0000-7000-8000-000000000001'],
    ])('ACCEPTS %s and forwards it to the RPC', async (_label, id) => {
      const { rpc } = setupAdminClient();

      const res = await POST(makeRequest(validBody({ source_dra_id: id })));

      expect(res.status).not.toBe(400);
      expect(rpc).toHaveBeenCalledWith(
        'upsert_site_aggregate_candidate',
        expect.objectContaining({ p_source_dra_id: id }),
      );
    });

    it('still canonicalises case for a non-RFC uuid, so normalisation was not lost', async () => {
      // Widening the domain must not disturb the transport-boundary lowercasing
      // that keeps the strict readback comparison from producing a false 409.
      const { rpc } = setupAdminClient();

      await POST(
        makeRequest(validBody({ source_dra_id: 'A1111111-1111-1111-1111-111111111111' })),
      );

      expect(rpc).toHaveBeenCalledWith(
        'upsert_site_aggregate_candidate',
        expect.objectContaining({ p_source_dra_id: 'a1111111-1111-1111-1111-111111111111' }),
      );
    });

    /**
     * DISCRIMINATING: widening the VALUE domain must not weaken the SPELLING
     * check. Without these the acceptance table above could pass against a route
     * that validates nothing at all.
     */
    it.each([
      ['a group of the wrong length', '11111111-111-1111-1111-111111111111'],
      ['a non-hex character', '1111111g-1111-1111-1111-111111111111'],
      ['missing separators', '11111111111111111111111111111111'],
      ['a trailing character', '11111111-1111-1111-1111-1111111111111'],
      ['surrounding whitespace', ' 11111111-1111-1111-1111-111111111111 '],
    ])('still REJECTS %s as malformed spelling', async (_label, id) => {
      const { rpc } = setupAdminClient();

      const res = await POST(makeRequest(validBody({ source_dra_id: id })));

      expect(res.status).toBe(400);
      expect(rpc).not.toHaveBeenCalled();
    });
  });

  describe('deterministic RPC error mapping', () => {
    // Each runs at the status PostgREST would really return for that code
    // (UE* -> 400 via the catch-all, 42501 -> 403, 55P03 -> 500), so the 55P03
    // row doubles as proof that the single 5xx exemption keeps the one
    // legitimately-5xx pre-commit path reachable.
    it.each([
      ['42501', 403, 'rpc_forbidden'],
      ['UE404', 404, 'not_found'],
      ['UE409', 409, 'conflict'],
      ['55P03', 409, 'conflict'],
      ['UE422', 422, 'validation_failed'],
    ])('maps %s to %i %s at its realistic PostgREST status', async (code, status, error) => {
      setupAdminClient({ rpcError: { code, message: `rpc error ${code}` } });

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(status);
      const body = await response.json();
      expect(body.error).toBe(error);
      expect(body.committed).toBe(false);
      expect(body.retry_safe).toBe(true);
    });

    // UE412 is DELIBERATELY NOT in the table above: it is the one pre-commit
    // branch with `retry_safe: FALSE`, so folding it in would have required
    // loosening the shared assertion and would have hidden exactly the property
    // that matters. A review found this branch had no route-level coverage at
    // all -- the table omits it and the D-F2-6 test only exercises client-side
    // payload rejection -- so a regression in the code, the status, the retry
    // semantics or the no-leak body would have left the suite green.
    it('maps UE412 to 409 cluster_identity_mismatch with retry_safe FALSE and no leaked values', async () => {
      const { rpc } = setupAdminClient({
        rpcError: { code: 'UE412', message: 'cluster identity mismatch' },
      });

      const response = await POST(makeRequest(validBody()));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toBe('cluster_identity_mismatch');
      expect(body.committed).toBe(false);
      // FALSE, not true. Retrying an identical payload fails identically forever:
      // the client's view of cluster identity has diverged from the server's and
      // it must re-read the live preview to obtain a fresh pair. Marking this
      // retry_safe would invite a retry loop that cannot terminate.
      expect(body.retry_safe).toBe(false);

      // D-F2-6: no raw cluster id and no coordinate anywhere in the response.
      const serialised = JSON.stringify(body);
      expect(serialised).not.toContain(CLUSTER_ID);
      expect(serialised).not.toContain(String(REPRESENTATIVE_LATITUDE));
      expect(serialised).not.toContain(String(REPRESENTATIVE_LONGITUDE));

      // And it really did reach the RPC -- so this is the SERVER's UE412 being
      // mapped, not the route's own payload validation short-circuiting first.
      expect(rpc).toHaveBeenCalledWith('upsert_site_aggregate_candidate', expect.objectContaining({
        p_expected_cluster_id: CLUSTER_ID,
      }));
    });

    // An UNRECOGNIZED code is the case where we genuinely cannot tell whether
    // the statement committed. At 5xx that must NOT become a confidently
    // retryable rpc_failed; the mapper's fallback stays reachable only where
    // PostgREST answered with a 4xx.
    // PostgREST's PTxyz override: the three characters after PT ARE the status.
    // Exercised through the helper's default so a regression in the mapping
    // itself surfaces here rather than silently producing an impossible pair.
    // The helper must FAIL LOUDLY rather than default, and say WHICH rule it
    // tripped. Every entry is a real input an earlier version accepted and
    // silently mapped to an impossible status.
    it.each([
      // not well-formed: a SQLSTATE is exactly five uppercase alphanumerics
      ['PGRST000', /not a well-formed SQLSTATE/],
      ['PGRST202', /not a well-formed SQLSTATE/],
      ['UE40', /not a well-formed SQLSTATE/],
      ['UEfoobar', /not a well-formed SQLSTATE/],
      // well-formed, but this helper cannot claim the mapping with confidence
      ['53400', /no certain mapping/],
      ['54001', /no certain mapping/],
      ['40001', /no certain mapping/],
      ['40P01', /no certain mapping/],
    ])('refuses to guess a status for %s', (code, reason) => {
      expect(() => setupAdminClient({ rpcError: { code, message: 'x' } })).toThrow(reason);
    });

    it('refuses to guess a status when the error carries no SQLSTATE', () => {
      // A code-less error is not implicitly a 500 -- it can accompany several
      // statuses, so guessing one invents the pairing under test.
      expect(() => setupAdminClient({ rpcError: { message: 'x' } })).toThrow(
        /carries no SQLSTATE/,
      );
    });

    it('accepts an unmodelled code when the pairing is stated explicitly', () => {
      // The escape hatch: say what you mean and the helper steps aside.
      expect(() =>
        setupAdminClient({ rpcError: { code: 'PGRST000', message: 'x' }, rpcStatus: 503 }),
      ).not.toThrow();
    });

    it('treats a PT500 custom-status code as commit-INDETERMINATE at its own status', async () => {
      setupAdminClient({ rpcError: { code: 'PT500', message: 'custom status' } });

      const response = await POST(makeRequest(validBody()));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toBe('commit_indeterminate');
      expect(body.committed).toBeNull();
    });

    it('maps a PT400 custom-status code as PRE-commit at its own status', async () => {
      setupAdminClient({ rpcError: { code: 'PT400', message: 'custom status' } });

      const response = await POST(makeRequest(validBody()));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('rpc_failed');
      expect(body.committed).toBe(false);
      expect(body.retry_safe).toBe(true);
    });

    it.each([
      ['an unrecognized code', { code: 'XX000', message: 'unknown failure' }, 500],
      ['no code at all', { message: 'unknown failure' }, 500],
      // FORGED application codes: PostgREST reports UE* at 400, so these did
      // not come from PostgREST and the outcome is genuinely unknown.
      ['a forged UE409', { code: 'UE409', message: 'gateway' }, 500],
      ['a forged UE422', { code: 'UE422', message: 'gateway' }, 500],
      // 55P03 is exempt ONLY at exactly 500. PostgREST never pairs it with
      // another 5xx, so these are gateway anomalies and must fail closed --
      // a response lost AFTER commit must not be reported as retryable.
      ['55P03 at 502', { code: '55P03', message: 'bad gateway' }, 502],
      ['55P03 at 503', { code: '55P03', message: 'unavailable' }, 503],
      ['55P03 at 504', { code: '55P03', message: 'timeout' }, 504],
    ])('treats %s as commit-INDETERMINATE', async (_label, rpcError, rpcStatus) => {
      setupAdminClient({ rpcError, rpcStatus });

      const response = await POST(makeRequest(validBody()));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toBe('commit_indeterminate');
      expect(body.committed).toBeNull();
      expect(body.retry_safe).toBe(false);
    });

    it.each([
      ['an unrecognized code', { code: 'XX000', message: 'unknown failure' }],
      ['no code at all', { message: 'unknown failure' }],
    ])('maps %s at a 4xx to 500 rpc_failed (pre-commit)', async (_label, rpcError) => {
      setupAdminClient({ rpcError, rpcStatus: 400 });

      const response = await POST(makeRequest(validBody()));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('rpc_failed');
      expect(body.committed).toBe(false);
      expect(body.retry_safe).toBe(true);
    });

    it('does not leak the raw RPC message to the caller', async () => {
      setupAdminClient({
        rpcError: { code: 'XX000', message: 'relation matrix_map.secret_table does not exist' },
      });

      const response = await POST(makeRequest(validBody()));
      const body = await response.json();

      expect(JSON.stringify(body)).not.toContain('secret_table');
    });
  });

  describe('readback verification', () => {
    it('returns a NON-RETRYABLE 409 readback_failed, explicitly committed-but-unverified', async () => {
      // The upsert has ALREADY COMMITTED before the readback runs. A 500 read
      // as "transient, safe to retry": the UI re-enabled the control and a
      // retry performed a second upsert plus another refresh audit entry
      // against an already-persisted candidate.
      setupAdminClient({ readbackError: { message: 'read failed' } });

      const response = await POST(makeRequest(validBody()));
      const body = await response.json();

      // 409, deliberately NOT 5xx -- this is not a transient server fault.
      expect(response.status).toBe(409);
      expect(response.status).not.toBe(500);

      expect(body.error).toBe('readback_failed');
      expect(body.committed).toBe(true);
      expect(body.verified).toBe(false);
      expect(body.retry_safe).toBe(false);
      // The operator-facing instruction must actually say what to do.
      expect(body.detail).toMatch(/committed/i);
      expect(body.detail).toMatch(/do not retry/i);
      expect(body.detail).toMatch(/reload/i);
    });

    it('marks every POST-COMMIT outcome retry_safe: false, so the client has one rule', async () => {
      // readback_failed, verification_id_missing, verification_failed and
      // verification_label_mismatch all occur AFTER the upsert committed.
      // ALL FOUR, not a sample. The comment used to claim four while the array
      // exercised two, so removing the fields from either of the other two
      // responses would have left the suite green and broken the client's
      // single latch rule.
      //
      // `verification_incomplete` is deliberately absent: it reported that a
      // PAGED search hit its ceiling, and exact-ID verification has no ceiling,
      // so that state is unreachable. It is replaced here by
      // `verification_id_missing` -- the upsert succeeded but returned no
      // usable id, so the write committed and cannot be addressed.
      const rowFor = (over: Record<string, unknown> = {}) => ({
        publication_id: PUBLICATION_ID,
        source_dra_id: SOURCE_DRA_ID,
        coordinate_cluster_id: CLUSTER_ID,
        member_display_label: 'Neutral Label 1',
        ...over,
      });
      const postCommit = [
        { name: 'readback_failed', setup: { readbackError: { message: 'read failed' } } },
        { name: 'verification_failed', setup: { readbackRows: [] } },
        { name: 'verification_id_missing', setup: { upsertReturn: null } },
        {
          name: 'verification_label_mismatch',
          setup: { readbackRows: [rowFor({ member_display_label: 'A DIFFERENT LABEL' })] },
        },
      ];
      for (const scenario of postCommit) {
        setupAdminClient(scenario.setup);
        const response = await POST(makeRequest(validBody()));
        const body = await response.json();
        expect(body.retry_safe, `${scenario.name} must be non-retryable`).toBe(false);
        expect(body.committed, `${scenario.name} must report committed`).toBe(true);
        expect(response.status, `${scenario.name} must not be 5xx`).toBeLessThan(500);
      }
    });

    it('treats a TRANSPORT failure (status 0, no SQLSTATE) as commit-INDETERMINATE and non-retryable', async () => {
      // postgrest-js reports a lost/aborted connection as status 0 with no
      // `code`. The statement may well have COMMITTED and only the response was
      // lost, so a generic retryable 500 here invited the duplicate upsert this
      // whole path exists to prevent.
      setupAdminClient({ rpcError: { message: 'fetch failed' }, rpcStatus: 0 });

      const response = await POST(makeRequest(validBody()));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(response.status).not.toBe(500);
      expect(body.error).toBe('commit_indeterminate');
      expect(body.retry_safe).toBe(false);
      // Indeterminate is NOT the same as committed: it must not assert either.
      expect(body.committed).toBeNull();
      expect(body.detail).toMatch(/unknown whether/i);
      expect(body.detail).toMatch(/do not retry/i);
    });

    it('treats a CODE-LESS upstream 5xx as commit-INDETERMINATE, not a pre-commit rpc_failed', async () => {
      // A gateway/proxy 502/503/504 can be returned AFTER the request reached
      // the database. postgrest-js preserves that nonzero status, so a
      // `status === 0` test alone misread it as pre-commit and allowed a retry
      // that could duplicate the upsert and its audit entry.
      for (const upstream of [502, 503, 504]) {
        setupAdminClient({ rpcError: { message: 'bad gateway' }, rpcStatus: upstream });
        const response = await POST(makeRequest(validBody()));
        const body = await response.json();
        expect(response.status, `upstream ${upstream}`).toBe(409);
        expect(body.error).toBe('commit_indeterminate');
        expect(body.retry_safe).toBe(false);
        expect(body.committed).toBeNull();
      }
    });

    it('treats a 5xx carrying an UNRECOGNIZED SQLSTATE-shaped code as INDETERMINATE', async () => {
      // `error.code` is UNTRUSTED upstream input: any five-character string has
      // the SQLSTATE shape, so a shape check alone would let an intermediary
      // make a genuinely indeterminate 5xx look pre-commit. Only the explicit
      // PRE_COMMIT_SQLSTATES allow-list overrides, and this code is not on it.
      setupAdminClient({ rpcError: { code: 'XX999', message: 'gateway' }, rpcStatus: 500 });
      const response = await POST(makeRequest(validBody()));
      const body = await response.json();
      expect(response.status).toBe(409);
      expect(body.error).toBe('commit_indeterminate');
      expect(body.committed).toBeNull();
      expect(body.retry_safe).toBe(false);
    });

    it('does NOT trust a forged application code in an anomalous 5xx body', async () => {
      // PostgREST reports UE* codes at 400, so UE422 arriving at 500 did not
      // come from PostgREST. The outcome is genuinely unknown -- trusting the
      // code here would be the exact defect the exemption is scoped to avoid.
      setupAdminClient({ rpcError: { code: 'UE422', message: 'validation' }, rpcStatus: 500 });
      const response = await POST(makeRequest(validBody()));
      const body = await response.json();
      expect(response.status).toBe(409);
      expect(body.error).toBe('commit_indeterminate');
      expect(body.committed).toBeNull();
      expect(body.retry_safe).toBe(false);
    });

    it('maps 55P03 lock contention to a retryable 409, not commit_indeterminate', async () => {
      // `LOCK ... NOWAIT` in lock_site_aggregate_publication_sources() raises
      // 55P03, which PostgREST reports as HTTP 500. The lock failing means the
      // mutation never ran, so this is retryable contention -- reporting it as
      // an unknown outcome would latch the UI on a routine collision.
      setupAdminClient({ rpcError: { code: '55P03', message: 'lock not available' }, rpcStatus: 500 });
      const response = await POST(makeRequest(validBody()));
      const body = await response.json();
      expect(response.status).toBe(409);
      expect(body.error).toBe('conflict');
      expect(body.committed).toBe(false);
      expect(body.retry_safe).toBe(true);
    });

    it('states PRE-commit semantics when the admin role lookup fails', async () => {
      // Returns before the mutation RPC is invoked: nothing was written.
      setupAdminClient({ roleError: { message: 'role lookup exploded' } });
      const response = await POST(makeRequest(validBody()));
      const body = await response.json();
      expect(response.status).toBe(500);
      expect(body.error).toBe('admin_role_query_failed');
      expect(body.committed).toBe(false);
      expect(body.retry_safe).toBe(true);
    });

    it('does NOT mislabel a PRE-commit failure as committed', async () => {
      // The RPC itself failing means nothing was written; that path must carry
      // neither committed nor retry_safe semantics.
      setupAdminClient({ rpcError: { code: 'UE422', message: 'validation' } });

      const response = await POST(makeRequest(validBody()));
      const body = await response.json();

      // Pre-commit must say committed:false / retry_safe:true -- never
      // committed:true, and never silence (which would latch the client).
      expect(body.committed).toBe(false);
      expect(body.retry_safe).toBe(true);
    });

    it('returns 409 verification_failed when the readback contains no matching row', async () => {
      setupAdminClient({ readbackRows: [] });

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error).toBe('verification_failed');
      expect(body.verified).toBe(false);
      expect(body.ok).toBeUndefined();
    });

    it('returns 409 when the readback holds only a DIFFERENT candidate', async () => {
      // Guards the match predicate: a row for another cluster must not be
      // mistaken for successful persistence of this one.
      setupAdminClient({
        readbackRows: [
          {
            publication_id: PUBLICATION_ID,
            source_dra_id: SOURCE_DRA_ID,
            coordinate_cluster_id: 'cluster-beta',
          },
        ],
      });

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe('verification_failed');
    });

    it('returns 409 when the readback payload is not an array', async () => {
      setupAdminClient({ readbackRows: null });

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe('verification_failed');
    });

    it('returns 200 with the verified candidate on success', async () => {
      const { rpc } = setupAdminClient();

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        ok: true,
        publication_id: PUBLICATION_ID,
        verified: true,
        candidate: {
          publication_id: PUBLICATION_ID,
          source_dra_id: SOURCE_DRA_ID,
          coordinate_cluster_id: CLUSTER_ID,
          member_display_label: 'Neutral Label 1',
        },
      });
      expect(rpc).toHaveBeenCalledWith('fetch_admin_site_aggregate_publications', {
        p_publication_id: PUBLICATION_ID,
        p_limit: 1,
        p_offset: 0,
      });
    });

    // -----------------------------------------------------------------------
    // EXACT-ID POST-COMMIT VERIFICATION (2026-07-28).
    //
    // The readback used to page the whole candidate collection. That was
    // unsound: OFFSET pages across independent statements are not a snapshot,
    // so a concurrent refresh could move a row across a page boundary and make
    // the scan report verification_failed for a candidate that WAS committed.
    // The upsert now returns the persisted id and the route looks it up
    // directly. These tests assert the ACTUAL calls made.
    // -----------------------------------------------------------------------
    it('calls EXACTLY the two expected RPCs, in order: the audited upsert, then one exact-ID readback', async () => {
      // THE HONEST FORM OF THE OLD ALLOW-LIST CLAIM.
      //
      // A source-text/AST scanner used to assert "the only .rpc(...) literals
      // in this file are these two". That claimed more than it enforced: a call
      // reached through an alias or a bound function is not a call expression
      // whose callee is named `rpc`, so the real call escaped the scanner while
      // the allowed ones kept it green.
      //
      // This asserts what actually matters and cannot be evaded by spelling:
      // the RPC names this route ACTUALLY invoked, in order, on a real request.
      // Scoped honestly -- it speaks for THIS request path, not for the module
      // as a static universe.
      const { rpc } = setupAdminClient();

      const response = await POST(makeRequest(validBody()));
      expect(response.status).toBe(200);

      expect(rpc.mock.calls.map((c) => c[0])).toEqual([
        'upsert_site_aggregate_candidate',
        'fetch_admin_site_aggregate_publications',
      ]);
    });

    it('invokes NO RPC beyond those two on any post-commit failure path', async () => {
      // Each failure path is post-commit, so an extra RPC here would be an
      // unaudited write or the retired collection scan creeping back in.
      const scenarios: Array<{ name: string; setup: Parameters<typeof setupAdminClient>[0] }> = [
        { name: 'verification_id_missing', setup: { upsertReturn: null } },
        { name: 'readback_failed', setup: { readbackError: { message: 'read failed' } } },
        { name: 'verification_failed', setup: { readbackRows: [] } },
      ];
      for (const scenario of scenarios) {
        const { rpc } = setupAdminClient(scenario.setup);
        await POST(makeRequest(validBody()));
        const names = rpc.mock.calls.map((c) => c[0]);
        expect(new Set(names), scenario.name).toEqual(
          new Set(names.filter((n) =>
            n === 'upsert_site_aggregate_candidate' ||
            n === 'fetch_admin_site_aggregate_publications',
          )),
        );
        expect(names.length, `${scenario.name} must not fan out`).toBeLessThanOrEqual(2);
      }
    });

    it('verifies via EXACTLY ONE exact-ID readback using the id the upsert returned', async () => {
      const { readbackArgs } = setupAdminClient();

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(200);
      // ONE call, addressed by the returned id, bounded to a single row.
      // A count alone would not distinguish this from a one-page scan.
      expectExactlyOneIdReadback(readbackArgs, PUBLICATION_ID);
    });

    it('uses the id the upsert ACTUALLY returned, not a value derived from the request', async () => {
      // The natural key in the request is unchanged; only the returned id
      // differs. A route that rebuilt the lookup from the payload, or that
      // hard-coded a constant, would ask for the wrong id and fail.
      const OTHER_ID = '9f3c1d2e-4b5a-4c6d-8e7f-0a1b2c3d4e5f';
      const { readbackArgs } = setupAdminClient({
        upsertReturn: OTHER_ID,
        readbackRows: [
          {
            publication_id: OTHER_ID,
            source_dra_id: SOURCE_DRA_ID,
            coordinate_cluster_id: CLUSTER_ID,
            member_display_label: 'Neutral Label 1',
          },
        ],
      });

      const response = await POST(makeRequest(validBody()));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.publication_id).toBe(OTHER_ID);
      expectExactlyOneIdReadback(readbackArgs, OTHER_ID);
    });

    it('NEVER pages the collection: no readback call omits the publication id or exceeds one row', async () => {
      // The whole point of the change. Stated as a property over every recorded
      // call so a future reintroduction of the scan fails here even if it also
      // happened to find the row.
      const { readbackArgs } = setupAdminClient();

      await POST(makeRequest(validBody()));

      expect(readbackArgs.length).toBeGreaterThan(0);
      for (const call of readbackArgs) {
        expect(call.p_publication_id, 'readback must be addressed by id').toBe(PUBLICATION_ID);
        expect(call.p_limit, 'readback must be bounded to a single row').toBe(1);
        expect(call.p_offset, 'readback must not walk an offset').toBe(0);
      }
    });

    it('returns 409 verification_id_missing, committed and non-retryable, when the upsert returns no usable id', async () => {
      // The RPC reported success, so the write COMMITTED -- but without an id
      // it cannot be addressed. This must fail closed, and must NOT fall back
      // to the retired collection scan.
      for (const bad of [null, undefined, '', 'not-a-uuid', 42, {}]) {
        const { readbackArgs } = setupAdminClient({ upsertReturn: bad });

        const response = await POST(makeRequest(validBody()));
        const body = await response.json();

        expect(response.status, `upsertReturn=${JSON.stringify(bad)}`).toBe(409);
        expect(response.status).toBeLessThan(500);
        expect(body.error).toBe('verification_id_missing');
        expect(body.committed).toBe(true);
        expect(body.verified).toBe(false);
        expect(body.retry_safe).toBe(false);
        // NO BROAD SCAN as a fallback -- not even one call.
        expect(readbackArgs, 'must not attempt any readback without an id').toHaveLength(0);
      }
    });

    it('returns 409 verification_failed when the returned id resolves to no row', async () => {
      const { readbackArgs } = setupAdminClient({ readbackRows: [] });

      const response = await POST(makeRequest(validBody()));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toBe('verification_failed');
      expect(body.committed).toBe(true);
      expect(body.verified).toBe(false);
      expectExactlyOneIdReadback(readbackArgs, PUBLICATION_ID);
    });

    it('rejects a readback row whose publication_id differs, when source, cluster AND label all match', async () => {
      // ISOLATES THE PUBLICATION-ID COMPARISON, and nothing else.
      //
      // Every other validated field is deliberately CORRECT: source_dra_id,
      // coordinate_cluster_id and member_display_label all match the request.
      // The publication_id is the ONLY thing wrong. So this test fails if and
      // only if the route's `rowPublicationId !== returnedPublicationId`
      // comparison is present and working -- no other predicate can mask it.
      //
      // An earlier version of this test was named for this property but also
      // varied source and cluster, so deleting the id comparison still left it
      // failing on those. It proved nothing about the id guard.
      //
      // `rawReadbackRows` bypasses the mock's own id filtering on purpose: the
      // RPC result is an untrusted boundary, and a mock that always filters
      // correctly can never exercise the route's validation of it.
      const { readbackArgs } = setupAdminClient({
        rawReadbackRows: [
          {
            publication_id: '9f3c1d2e-4b5a-4c6d-8e7f-0a1b2c3d4e5f',
            source_dra_id: SOURCE_DRA_ID,
            coordinate_cluster_id: CLUSTER_ID,
            member_display_label: 'Neutral Label 1',
          },
        ],
      });

      const response = await POST(makeRequest(validBody()));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toBe('verification_failed');
      expect(body.verified).toBe(false);
      expect(body.ok).toBeUndefined();
      // And it must never echo the impostor row's id back as if verified.
      expect(body.publication_id).toBeUndefined();
      expectExactlyOneIdReadback(readbackArgs, PUBLICATION_ID);
    });

    it('rejects a readback row whose source_dra_id differs, when the publication id matches', async () => {
      // The complementary isolation: only source_dra_id is wrong. Together with
      // the test above and the label tests, each validated field is covered by a
      // case where it is the SOLE defect.
      const { readbackArgs } = setupAdminClient({
        rawReadbackRows: [
          {
            publication_id: PUBLICATION_ID,
            source_dra_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            coordinate_cluster_id: CLUSTER_ID,
            member_display_label: 'Neutral Label 1',
          },
        ],
      });

      const response = await POST(makeRequest(validBody()));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toBe('verification_failed');
      expect(body.verified).toBe(false);
      expectExactlyOneIdReadback(readbackArgs, PUBLICATION_ID);
    });

    it('rejects a readback row whose coordinate_cluster_id differs, when the publication id matches', async () => {
      const { readbackArgs } = setupAdminClient({
        rawReadbackRows: [
          {
            publication_id: PUBLICATION_ID,
            source_dra_id: SOURCE_DRA_ID,
            coordinate_cluster_id: 'a-different-cluster',
            member_display_label: 'Neutral Label 1',
          },
        ],
      });

      const response = await POST(makeRequest(validBody()));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toBe('verification_failed');
      expect(body.verified).toBe(false);
      expectExactlyOneIdReadback(readbackArgs, PUBLICATION_ID);
    });

    it('matches the readback case-insensitively on source_dra_id', async () => {
      // The RPC call is canonicalised to lowercase, but the readback rows come
      // straight from Postgres and must match regardless of the caller's
      // original casing. Previously this produced a false 409 verification
      // failure after the mutation had already committed.
      setupAdminClient({
        readbackRows: [
          {
            publication_id: PUBLICATION_ID,
            source_dra_id: SOURCE_DRA_ID.toLowerCase(),
            coordinate_cluster_id: CLUSTER_ID,
            member_display_label: 'Neutral Label 1',
          },
        ],
      });

      const response = await POST(
        makeRequest(validBody({ source_dra_id: SOURCE_DRA_ID.toUpperCase() })),
      );

      expect(response.status).toBe(200);
      expect((await response.json()).publication_id).toBe(PUBLICATION_ID);
    });

    it('selects the matching row even when other candidates are present', async () => {
      setupAdminClient({
        readbackRows: [
          {
            publication_id: 'other',
            source_dra_id: SOURCE_DRA_ID,
            coordinate_cluster_id: 'cluster-beta',
          },
          {
            publication_id: PUBLICATION_ID,
            source_dra_id: SOURCE_DRA_ID,
            coordinate_cluster_id: CLUSTER_ID,
            member_display_label: 'Neutral Label 1',
          },
        ],
      });

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(200);
      expect((await response.json()).publication_id).toBe(PUBLICATION_ID);
    });

    it('returns 200 verified true when the persisted label matches the requested label', async () => {
      setupAdminClient({
        readbackRows: [
          {
            publication_id: PUBLICATION_ID,
            source_dra_id: SOURCE_DRA_ID,
            coordinate_cluster_id: CLUSTER_ID,
            member_display_label: 'Neutral Label 1',
          },
        ],
      });

      const response = await POST(makeRequest(validBody({ member_display_label: 'Neutral Label 1' })));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.verified).toBe(true);
      expect(body.ok).toBe(true);
    });

    it('returns a distinct NON-RETRYABLE error, not 200, when the persisted label does not match the requested label', async () => {
      // Guards against a stale/no-op RPC or a concurrent overwrite on a REFRESH:
      // the tuple (source_dra_id, coordinate_cluster_id) already existed, so
      // matching on it alone is not evidence the requested label was applied.
      setupAdminClient({
        readbackRows: [
          {
            publication_id: PUBLICATION_ID,
            source_dra_id: SOURCE_DRA_ID,
            coordinate_cluster_id: CLUSTER_ID,
            member_display_label: 'A stale, different label',
          },
        ],
      });

      const response = await POST(makeRequest(validBody({ member_display_label: 'Neutral Label 1' })));
      const body = await response.json();

      expect(response.status).not.toBe(200);
      // NOT a 5xx: the upsert already committed, so this must not look like a
      // transient fault that invites an automated retry.
      expect(response.status).toBeLessThan(500);
      expect(body.error).toBe('verification_label_mismatch');
      expect(body.verified).toBe(false);
      expect(body.ok).toBeUndefined();
      // Distinct from the other two verification_* codes that still exist.
      expect(body.error).not.toBe('verification_failed');
      expect(body.error).not.toBe('verification_id_missing');
    });

    it('returns verification_label_mismatch when the persisted row has no label at all', async () => {
      setupAdminClient({
        readbackRows: [
          {
            publication_id: PUBLICATION_ID,
            source_dra_id: SOURCE_DRA_ID,
            coordinate_cluster_id: CLUSTER_ID,
            // member_display_label omitted entirely (e.g. a version-skewed row).
          },
        ],
      });

      const response = await POST(makeRequest(validBody({ member_display_label: 'Neutral Label 1' })));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toBe('verification_label_mismatch');
      expect(body.verified).toBe(false);
    });
  });
});
