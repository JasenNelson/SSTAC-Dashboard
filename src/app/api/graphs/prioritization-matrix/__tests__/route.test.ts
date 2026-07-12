import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';

// Mock next/headers (createAuthenticatedClient reads cookies via this)
const mockCookies = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

// Mock @supabase/ssr (both createAnonymousClient and createAuthenticatedClient
// go through createServerClient from this module)
const mockCreateServerClient = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111';
const CEW_USER_ID = 'CEW2025_abcdef1234567890';

const POLL_IDS = {
  cewImportance: 'poll-cew-imp',
  cewFeasibility: 'poll-cew-feas',
  surveyImportance: 'poll-survey-imp',
  surveyFeasibility: 'poll-survey-feas',
};

const pollsTable = [
  { id: POLL_IDS.cewImportance, page_path: '/cew-polls/prioritization', poll_index: 0 },
  { id: POLL_IDS.cewFeasibility, page_path: '/cew-polls/prioritization', poll_index: 1 },
  { id: POLL_IDS.surveyImportance, page_path: '/survey-results/prioritization', poll_index: 0 },
  { id: POLL_IDS.surveyFeasibility, page_path: '/survey-results/prioritization', poll_index: 1 },
];

const pollResults = [
  { id: POLL_IDS.cewImportance, page_path: '/cew-polls/prioritization', poll_index: 0, total_votes: 1, results: [{ option_index: 3, votes: 1 }] },
  { id: POLL_IDS.cewFeasibility, page_path: '/cew-polls/prioritization', poll_index: 1, total_votes: 1, results: [{ option_index: 2, votes: 1 }] },
  { id: POLL_IDS.surveyImportance, page_path: '/survey-results/prioritization', poll_index: 0, total_votes: 1, results: [{ option_index: 4, votes: 1 }] },
  { id: POLL_IDS.surveyFeasibility, page_path: '/survey-results/prioritization', poll_index: 1, total_votes: 1, results: [{ option_index: 1, votes: 1 }] },
];

const votesTable = [
  // Authenticated ("TWG") voter -- carries a raw user_id UUID.
  { user_id: AUTH_USER_ID, option_index: 4, voted_at: '2026-01-01T00:00:00Z', poll_id: POLL_IDS.surveyImportance },
  { user_id: AUTH_USER_ID, option_index: 1, voted_at: '2026-01-01T00:01:00Z', poll_id: POLL_IDS.surveyFeasibility },
  // CEW voter -- already pseudonymized (CEW2025_ prefix), safe to expose publicly.
  { user_id: CEW_USER_ID, option_index: 3, voted_at: '2026-01-01T00:02:00Z', poll_id: POLL_IDS.cewImportance },
  { user_id: CEW_USER_ID, option_index: 2, voted_at: '2026-01-01T00:03:00Z', poll_id: POLL_IDS.cewFeasibility },
];

// Minimal fake query-builder covering exactly the chains route.ts issues:
//  - poll_results: .select('*').in('page_path', [...])
//  - polls (id lookup): .select('id').eq('page_path', x).eq('poll_index', y).single()
//  - polls (metadata):  .select('id, poll_index, page_path').in('id', ids)
//  - poll_votes:        .select('user_id, option_index, voted_at, poll_id').in('poll_id', ids)
function makeSupabaseClient(getUserResult: { data: { user: { id: string } | null }; error: null }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(getUserResult),
    },
    from: vi.fn((table: string) => {
      if (table === 'poll_results') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: pollResults, error: null }),
          }),
        };
      }
      if (table === 'polls') {
        return {
          select: (cols: string) => {
            if (cols === 'id') {
              let pagePath: string | undefined;
              let pollIndex: number | undefined;
              const builder = {
                eq(col: string, val: string | number) {
                  if (col === 'page_path') pagePath = val as string;
                  if (col === 'poll_index') pollIndex = val as number;
                  return builder;
                },
                single() {
                  const found = pollsTable.find(
                    (p) => p.page_path === pagePath && p.poll_index === pollIndex
                  );
                  return Promise.resolve({ data: found ? { id: found.id } : null, error: null });
                },
              };
              return builder;
            }
            // metadata lookup
            return {
              in: (_col: string, ids: string[]) => {
                const found = pollsTable.filter((p) => ids.includes(p.id));
                return Promise.resolve({ data: found, error: null });
              },
            };
          },
        };
      }
      if (table === 'poll_votes') {
        return {
          select: () => ({
            in: (_col: string, ids: string[]) =>
              Promise.resolve({
                data: votesTable.filter((v) => ids.includes(v.poll_id)),
                error: null,
              }),
          }),
        };
      }
      throw new Error(`Unexpected table in test mock: ${table}`);
    }),
  };
}

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    NODE_ENV: 'test',
  };
  vi.clearAllMocks();
  mockCookies.mockResolvedValue({ get: () => undefined });
});

const TARGET_TITLE = 'Site-Specific Standards (Bioavailability)';

describe('GET /api/graphs/prioritization-matrix', () => {
  it('anonymous caller: gets aggregate data with no raw user_id / individual authenticated votes', async () => {
    const client = makeSupabaseClient({ data: { user: null }, error: null });
    mockCreateServerClient.mockReturnValue(client);

    const request = new Request('http://localhost/api/graphs/prioritization-matrix?filter=all');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const entry = body.find((e: { title: string }) => e.title === TARGET_TITLE);
    expect(entry).toBeDefined();

    // Aggregate stats must still be populated (never identity-bearing).
    expect(entry.avgImportance).toBeGreaterThan(0);
    expect(entry.avgFeasibility).toBeGreaterThan(0);
    expect(entry.responses).toBeGreaterThan(0);

    // No authenticated individual vote rows at all.
    const authenticatedRows = entry.individualPairs.filter(
      (p: { userType: string }) => p.userType === 'authenticated'
    );
    expect(authenticatedRows).toHaveLength(0);

    // CEW rows (already pseudonymized) are still allowed through for public charts.
    const cewRows = entry.individualPairs.filter((p: { userType: string }) => p.userType === 'cew');
    expect(cewRows.length).toBeGreaterThan(0);

    // Explicit no-leak assertion: the raw authenticated UUID must not appear
    // anywhere in the serialized public response body.
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(AUTH_USER_ID);

    // Public tier must not be cached as a shared/CDN-cacheable response with
    // authenticated data baked in -- this response IS safe to cache publicly.
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=600, s-maxage=600');
  });

  it('authenticated caller: receives individual authenticated vote rows (existing survey-results consumer behavior)', async () => {
    const client = makeSupabaseClient({ data: { user: { id: AUTH_USER_ID } }, error: null });
    mockCreateServerClient.mockReturnValue(client);

    const request = new Request('http://localhost/api/graphs/prioritization-matrix?filter=all');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const entry = body.find((e: { title: string }) => e.title === TARGET_TITLE);
    expect(entry).toBeDefined();

    const authenticatedRows = entry.individualPairs.filter(
      (p: { userType: string }) => p.userType === 'authenticated'
    );
    expect(authenticatedRows).toHaveLength(1);
    expect(authenticatedRows[0].userId).toBe(AUTH_USER_ID);

    // Authenticated/detail tier must never be shared/CDN-cacheable.
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('cew filter never includes authenticated rows regardless of caller auth state', async () => {
    const client = makeSupabaseClient({ data: { user: { id: AUTH_USER_ID } }, error: null });
    mockCreateServerClient.mockReturnValue(client);

    const request = new Request('http://localhost/api/graphs/prioritization-matrix?filter=cew');
    const response = await GET(request);
    const body = await response.json();

    const entry = body.find((e: { title: string }) => e.title === TARGET_TITLE);
    expect(entry.individualPairs.every((p: { userType: string }) => p.userType === 'cew')).toBe(true);
  });

  it('does not cross-leak: an anonymous request after an authenticated request for the same filter stays sanitized', async () => {
    const authedClient = makeSupabaseClient({ data: { user: { id: AUTH_USER_ID } }, error: null });
    mockCreateServerClient.mockReturnValue(authedClient);
    const authedReq = new Request('http://localhost/api/graphs/prioritization-matrix?filter=all');
    await GET(authedReq); // warms the "auth" tier cache entry

    const anonClient = makeSupabaseClient({ data: { user: null }, error: null });
    mockCreateServerClient.mockReturnValue(anonClient);
    const anonReq = new Request('http://localhost/api/graphs/prioritization-matrix?filter=all');
    const anonResponse = await GET(anonReq);
    const anonBody = await anonResponse.json();

    const raw = JSON.stringify(anonBody);
    expect(raw).not.toContain(AUTH_USER_ID);
  });
});
