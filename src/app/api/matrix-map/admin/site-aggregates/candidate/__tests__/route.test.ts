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

const SOURCE_DRA_ID = '11111111-1111-4111-8111-111111111111';
const CLUSTER_ID = 'cluster-alpha';
const ADMIN_USER = '22222222-2222-4222-8222-222222222222';
const PUBLICATION_ID = '33333333-3333-4333-8333-333333333333';

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    source_dra_id: SOURCE_DRA_ID,
    coordinate_cluster_id: CLUSTER_ID,
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

/** One page's worth of PostgREST rows for the readback RPC's `.range()` chain. */
const READBACK_PAGE_SIZE = 1000;

/**
 * Builds a full (READBACK_PAGE_SIZE-row) page of non-matching filler rows, so a
 * test can force the readback loop to advance past page 0 without literally
 * authoring a thousand distinct fixtures by hand.
 */
function fullNonMatchingPage(): Array<{
  publication_id: string;
  source_dra_id: string;
  coordinate_cluster_id: string;
}> {
  return Array.from({ length: READBACK_PAGE_SIZE }, (_, i) => ({
    publication_id: `filler-${i}`,
    source_dra_id: SOURCE_DRA_ID,
    coordinate_cluster_id: `cluster-filler-${i}`,
  }));
}

function setupAdminClient(options: {
  role?: string | null;
  roleError?: unknown;
  rpcError?: unknown;
  readbackRows?: unknown;
  /**
   * Sequential pages returned by successive `.range()` calls on the readback
   * RPC, in call order. Takes precedence over `readbackRows` when provided.
   * Each entry is the raw `data` value for that page (may be a non-array to
   * exercise the "readback payload is not an array" path).
   */
  readbackPages?: unknown[];
  readbackError?: unknown;
} = {}) {
  const {
    role = 'matrix_admin',
    roleError = null,
    rpcError = null,
    readbackRows = [
      {
        publication_id: PUBLICATION_ID,
        source_dra_id: SOURCE_DRA_ID,
        coordinate_cluster_id: CLUSTER_ID,
      },
    ],
    readbackPages,
    readbackError = null,
  } = options;

  const pages = readbackPages ?? [readbackRows];
  let readbackCallIndex = 0;
  const range = vi.fn(async (_from: number, _to: number) => {
    if (readbackError) {
      return { data: null, error: readbackError };
    }
    const page = readbackCallIndex < pages.length ? pages[readbackCallIndex] : [];
    readbackCallIndex += 1;
    return { data: page, error: null };
  });

  const rpc = vi.fn((name: string) => {
    if (name === 'upsert_site_aggregate_candidate') {
      return Promise.resolve({ data: null, error: rpcError });
    }
    if (name === 'fetch_admin_site_aggregate_publications') {
      return { range };
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
  return { authClient, rpc, range, chain };
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
      expect(await response.json()).toEqual({ error: 'admin_role_query_failed' });
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
      ['an empty coordinate_cluster_id', { coordinate_cluster_id: '   ' }],
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

    it('trims the label, reason and cluster id before sending them to the RPC', async () => {
      const { rpc } = setupAdminClient();

      await POST(
        makeRequest(
          validBody({
            coordinate_cluster_id: `  ${CLUSTER_ID}  `,
            member_display_label: '  Neutral Label 1  ',
            reason: '  initial candidate  ',
          }),
        ),
      );

      expect(rpc).toHaveBeenCalledWith('upsert_site_aggregate_candidate', {
        p_source_dra_id: SOURCE_DRA_ID,
        p_coordinate_cluster_id: CLUSTER_ID,
        p_member_display_label: 'Neutral Label 1',
        p_actor_id: ADMIN_USER,
        p_reason: 'initial candidate',
      });
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
      ])('rejects %s with 400 invalid_payload and never calls the RPC', async (_label, embedded) => {
        const { authClient } = setupAdminClient();

        const response = await POST(
          makeRequest(validBody({ member_display_label: embedded })),
        );

        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe('invalid_payload');
        expect(authClient.schema).not.toHaveBeenCalled();
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
  });

  describe('deterministic RPC error mapping', () => {
    it.each([
      ['42501', 403, 'rpc_forbidden'],
      ['UE404', 404, 'not_found'],
      ['UE409', 409, 'conflict'],
      ['55P03', 409, 'conflict'],
      ['UE422', 422, 'validation_failed'],
      ['XX000', 500, 'rpc_failed'],
    ])('maps %s to %i %s', async (code, status, error) => {
      setupAdminClient({ rpcError: { code, message: `rpc error ${code}` } });

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(status);
      expect((await response.json()).error).toBe(error);
    });

    it('maps an error with no code to 500 rpc_failed', async () => {
      setupAdminClient({ rpcError: { message: 'unknown failure' } });

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(500);
      expect((await response.json()).error).toBe('rpc_failed');
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
    it('returns 500 readback_failed when the readback RPC errors', async () => {
      setupAdminClient({ readbackError: { message: 'read failed' } });

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'readback_failed' });
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
        },
      });
      expect(rpc).toHaveBeenCalledWith('fetch_admin_site_aggregate_publications', {
        p_publication_id: null,
      });
    });

    it('returns 200 when the just-written candidate is found on a LATER readback page', async () => {
      // The write has already committed by the time this readback runs. If the
      // written candidate falls beyond page 0 of the PostgREST row cap, a
      // single unpaged read would report it "not found" even though it
      // exists. Page 0 is a full (non-short) page of filler rows so the
      // pagination loop is forced to advance to page 1, where the real match
      // lives.
      const matchingRow = {
        publication_id: PUBLICATION_ID,
        source_dra_id: SOURCE_DRA_ID,
        coordinate_cluster_id: CLUSTER_ID,
      };
      const { range } = setupAdminClient({
        readbackPages: [fullNonMatchingPage(), [matchingRow]],
      });

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        ok: true,
        publication_id: PUBLICATION_ID,
        verified: true,
        candidate: matchingRow,
      });
      // Proves genuine pagination happened: a single-page read would only ever
      // call .range() once.
      expect(range).toHaveBeenCalledTimes(2);
    });

    it('returns a NON-RETRYABLE verification_incomplete when the readback hits its page ceiling', async () => {
      // 25 FULL pages with no match: the loop stops at READBACK_MAX_PAGES, not at
      // the end of the data. Reaching the ceiling is not evidence of absence, so
      // reporting 409 verification_failed would falsely call an already-committed
      // mutation missing and invite a retry that writes a spurious refresh row.
      const otherRow = {
        publication_id: 'other',
        source_dra_id: SOURCE_DRA_ID,
        coordinate_cluster_id: 'a-different-cluster',
      };
      const fullPage = Array.from({ length: 1000 }, () => otherRow);
      const { range } = setupAdminClient({
        readbackPages: Array.from({ length: 25 }, () => fullPage),
      });

      const response = await POST(makeRequest(validBody()));
      const body = await response.json();

      // NOT a 5xx: the upsert already committed, and 5xx conventionally invites
      // an automated retry that would write a spurious refresh + audit row.
      expect(response.status).toBe(409);
      expect(response.status).toBeLessThan(500);
      expect(body.error).toBe('verification_incomplete');
      expect(body.verified).toBe(false);
      // Distinct from genuine exhaustion, which still returns 409.
      expect(body.error).not.toBe('verification_failed');
      expect(range).toHaveBeenCalledTimes(25);
      expect(range).toHaveBeenNthCalledWith(1, 0, READBACK_PAGE_SIZE - 1);
      expect(range).toHaveBeenNthCalledWith(2, READBACK_PAGE_SIZE, 2 * READBACK_PAGE_SIZE - 1);
    });

    it('returns 409 verification_failed when the candidate is genuinely absent across ALL readback pages', async () => {
      // Page 0 is a full page (forces a second .range() call); page 1 is a
      // short, non-matching page (signals genuine exhaustion, not merely a
      // single missing page). Neither page contains a matching row, so this
      // must NOT resolve to a false positive on either page -- only a real
      // 409 after the loop has genuinely run out of data.
      const { range } = setupAdminClient({
        readbackPages: [
          fullNonMatchingPage(),
          [
            {
              publication_id: 'other-publication',
              source_dra_id: SOURCE_DRA_ID,
              coordinate_cluster_id: 'cluster-not-the-one-we-wrote',
            },
          ],
        ],
      });

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error).toBe('verification_failed');
      expect(body.verified).toBe(false);
      expect(range).toHaveBeenCalledTimes(2);
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
          },
        ],
      });

      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(200);
      expect((await response.json()).publication_id).toBe(PUBLICATION_ID);
    });
  });
});
