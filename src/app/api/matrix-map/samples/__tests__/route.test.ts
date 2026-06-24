// Unit tests for GET /api/matrix-map/samples (bbox-lane Stage 2 route).
// Covers the pure bbox parser + the auth/fetch handler paths. The route is
// AUTH-ONLY by design (no user_roles gate): authorization is delegated to the
// SECDEF RPC's email-allowlist so the client refetch matches the SSR fetch on
// both consumer pages (codex IMPORTANT 2026-06-23). Plain ASCII.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }));
vi.mock('@/lib/matrix-map/fetch-samples-server', () => ({
  fetchMatrixMapSamplesServerSide: vi.fn(),
}));

import { createServerClient } from '@supabase/ssr';
import { fetchMatrixMapSamplesServerSide } from '@/lib/matrix-map/fetch-samples-server';
import { EMPTY_MATRIX_MAP_DATA } from '@/app/(dashboard)/matrix-map/types';
import { parseBboxParams } from '@/lib/matrix-map/bbox';
import { GET } from '../route';

function mkSupabase(opts: { user: { id: string } | null }) {
  const { user } = opts;
  return {
    auth: { getUser: async () => ({ data: { user } }) },
  } as unknown as ReturnType<typeof createServerClient>;
}

function mkReq(query: string) {
  return {
    nextUrl: { searchParams: new URLSearchParams(query) },
    cookies: { getAll: () => [] },
  } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchMatrixMapSamplesServerSide).mockResolvedValue({
    initialMapData: EMPTY_MATRIX_MAP_DATA,
    fetchErrorMessage: null,
  });
});

describe('parseBboxParams', () => {
  it('returns a MatrixMapBbox when all 4 edges are present', () => {
    expect(
      parseBboxParams(new URLSearchParams('min_lng=-124&min_lat=48&max_lng=-122&max_lat=50')),
    ).toEqual({ minLng: -124, minLat: 48, maxLng: -122, maxLat: 50 });
  });
  it('returns null when any edge is missing', () => {
    expect(parseBboxParams(new URLSearchParams('min_lng=-124&min_lat=48&max_lng=-122'))).toBeNull();
  });
  it('returns null when an edge is empty', () => {
    expect(
      parseBboxParams(new URLSearchParams('min_lng=&min_lat=48&max_lng=-122&max_lat=50')),
    ).toBeNull();
  });
  it('returns null for a non-numeric edge (strict fail-safe to province-wide)', () => {
    expect(
      parseBboxParams(new URLSearchParams('min_lng=x&min_lat=48&max_lng=-122&max_lat=50')),
    ).toBeNull();
  });
  it('returns null for a whitespace-only edge (codex P3: Number(" ")===0 trap)', () => {
    expect(
      parseBboxParams(new URLSearchParams('min_lng=%20&min_lat=48&max_lng=-122&max_lat=50')),
    ).toBeNull();
  });
});

describe('GET /api/matrix-map/samples', () => {
  it('401 when not authenticated', async () => {
    vi.mocked(createServerClient).mockReturnValue(mkSupabase({ user: null }));
    const res = await GET(mkReq(''));
    expect(res.status).toBe(401);
    expect(fetchMatrixMapSamplesServerSide).not.toHaveBeenCalled();
  });

  it('200 for an authenticated user with NO role (auth-only gate; RPC is the authority)', async () => {
    // Consistency fix: the route must not be stricter than the SSR fetch on the
    // any-authenticated-user /matrix-options surface. A no-role authed user gets
    // the (RPC-scoped) payload, not a 403 that would strand viewport refetches.
    vi.mocked(createServerClient).mockReturnValue(mkSupabase({ user: { id: 'u1' } }));
    const res = await GET(mkReq(''));
    expect(res.status).toBe(200);
    expect(fetchMatrixMapSamplesServerSide).toHaveBeenCalled();
  });

  it('200 + forwards the parsed bbox to the helper for an authenticated user', async () => {
    vi.mocked(createServerClient).mockReturnValue(mkSupabase({ user: { id: 'u1' } }));
    const res = await GET(mkReq('min_lng=-124&min_lat=48&max_lng=-122&max_lat=50'));
    expect(res.status).toBe(200);
    expect(fetchMatrixMapSamplesServerSide).toHaveBeenCalledWith(expect.anything(), {
      minLng: -124,
      minLat: 48,
      maxLng: -122,
      maxLat: 50,
    });
    const body = await res.json();
    expect(body).toHaveProperty('visible_samples');
    expect(body).toHaveProperty('fetchErrorMessage', null);
  });

  it('200 + passes null bbox (province-wide) when params are absent', async () => {
    vi.mocked(createServerClient).mockReturnValue(mkSupabase({ user: { id: 'u1' } }));
    const res = await GET(mkReq(''));
    expect(res.status).toBe(200);
    expect(fetchMatrixMapSamplesServerSide).toHaveBeenCalledWith(expect.anything(), null);
  });
});
