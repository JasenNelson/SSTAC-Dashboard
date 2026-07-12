// Regression test for T38 (2026-07-11): GET /api/milestones previously had NO
// in-route auth gate (it called createAuthenticatedClient() directly and relied
// entirely on RLS), while POST/PUT/DELETE on the same route already called
// getAuthAndRateLimit(request, 'admin'). This asserts GET now requires an
// authenticated user (401 when absent) consistent with the rest of the route,
// via the same getAuthAndRateLimit helper (default rate-limit tier: milestones
// data is general authenticated dashboard content, not admin-only -- see
// ProjectTimeline.tsx consumer on the main dashboard page).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getAuthAndRateLimit: vi.fn(),
}));

vi.mock('@/app/api/_helpers/rate-limit-wrapper', () => ({
  getAuthAndRateLimit: mocks.getAuthAndRateLimit,
}));

import { GET } from '../route';

function makeRequest() {
  return new NextRequest('http://localhost/api/milestones', { method: 'GET' });
}

function chain(finalValue: unknown) {
  const api = {
    select: vi.fn(() => api),
    order: vi.fn(async () => finalValue),
  };
  return api;
}

describe('GET /api/milestones', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when there is no authenticated user', async () => {
    mocks.getAuthAndRateLimit.mockResolvedValue({
      user: null,
      supabase: { from: vi.fn() },
      rateLimitResponse: null,
      rateLimitHeaders: {},
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('returns 200 with milestones for an authenticated user', async () => {
    const milestones = [{ id: 1, title: 'M1', target_date: '2026-01-01' }];
    const supabase = {
      from: vi.fn(() => chain({ data: milestones, error: null })),
    };
    mocks.getAuthAndRateLimit.mockResolvedValue({
      user: { id: 'u1' },
      supabase,
      rateLimitResponse: null,
      rateLimitHeaders: { 'X-RateLimit-Limit': '200' },
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual(milestones);
    expect(supabase.from).toHaveBeenCalledWith('milestones');
  });

  it('returns the rate-limit response when the caller is throttled', async () => {
    const throttled = new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
    mocks.getAuthAndRateLimit.mockResolvedValue({
      user: { id: 'u1' },
      supabase: { from: vi.fn() },
      rateLimitResponse: throttled,
      rateLimitHeaders: {},
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(429);
  });

  it('returns 500 when the milestones query errors', async () => {
    const supabase = {
      from: vi.fn(() => chain({ data: null, error: { message: 'boom' } })),
    };
    mocks.getAuthAndRateLimit.mockResolvedValue({
      user: { id: 'u1' },
      supabase,
      rateLimitResponse: null,
      rateLimitHeaders: {},
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
  });
});
