import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  fetchSavedViews,
  fetchSavedViewsResult,
  createSavedView,
  deleteSavedView,
  importLegacySavedViews,
} from '../saved-views-sync';
import { createEvidenceLibraryFilters } from '../library';

// ---------------------------------------------------------------------------
// Supabase mock: a chainable query builder that is thenable and resolves to the
// next queued result. Each `from()` returns a fresh builder; every builder
// method returns the same builder, and awaiting it shifts `resultQueue`.
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
let resultQueue: Array<Record<string, unknown>> = [];
const eqCalls: unknown[][] = [];

function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'single']) {
    b[m] =
      m === 'eq'
        ? vi.fn((...args: unknown[]) => {
            eqCalls.push(args);
            return b;
          })
        : vi.fn(() => b);
  }
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve(resultQueue.shift() ?? { data: null, error: null });
  return b;
}

vi.mock('@/lib/supabase-auth', () => ({
  createAuthenticatedClient: vi.fn(() =>
    Promise.resolve({ auth: { getUser: mockGetUser }, from: mockFrom }),
  ),
}));

beforeEach(() => {
  resultQueue = [];
  eqCalls.length = 0;
  mockFrom.mockReset();
  mockFrom.mockImplementation(() => builder());
  mockGetUser.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

const baseFilters = createEvidenceLibraryFilters();

describe('saved-views-sync', () => {
  describe('fetchSavedViews', () => {
    it('scopes the fetch to the current user (admin-hydration tripwire)', async () => {
      resultQueue = [{ data: [], error: null }];
      await fetchSavedViews();
      // Must filter by user_id so an admin (covered by the admin SELECT-all RLS policy)
      // does not hydrate every user's saved views into their own list.
      expect(eqCalls).toContainEqual(['user_id', 'user-1']);
    });

    it('returns [] when signed out', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      expect(await fetchSavedViews()).toEqual([]);
    });

    it('returns mapped rows with normalized filters', async () => {
      resultQueue = [
        {
          data: [
            {
              id: 'v1',
              name: 'My view',
              filters: { substanceKeys: ['lead'], bogusKey: 1 },
              view_mode: 'values',
              created_at: 't1',
              updated_at: 't1',
            },
          ],
          error: null,
        },
      ];
      const rows = await fetchSavedViews();
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('v1');
      expect(rows[0].view_mode).toBe('values');
      // Known key preserved and the result is a complete, well-formed filters object
      // (createEvidenceLibraryFilters merges the defaults, so e.g. search is present).
      expect(rows[0].filters.substanceKeys).toEqual(['lead']);
      expect(rows[0].filters.search).toBe('');
      expect(Array.isArray(rows[0].filters.pathways)).toBe(true);
    });

    it('coerces an unknown view_mode to values', async () => {
      resultQueue = [
        {
          data: [
            { id: 'v2', name: 'x', filters: {}, view_mode: 'nonsense', created_at: 't', updated_at: 't' },
          ],
          error: null,
        },
      ];
      const rows = await fetchSavedViews();
      expect(rows[0].view_mode).toBe('values');
    });

    it('coerces a retired equations view_mode to values', async () => {
      // 'equations' was a real view mode before P2-2 moved equations into the Jurisdictional
      // Frameworks Quick Reference. Older saved views may still carry it; they must resolve to
      // the default Values view rather than a mode the library no longer renders.
      resultQueue = [
        {
          data: [
            { id: 'v3', name: 'eq', filters: {}, view_mode: 'equations', created_at: 't', updated_at: 't' },
          ],
          error: null,
        },
      ];
      const rows = await fetchSavedViews();
      expect(rows[0].view_mode).toBe('values');
    });

    it('returns [] on a Supabase error', async () => {
      resultQueue = [{ data: null, error: { message: 'relation does not exist' } }];
      expect(await fetchSavedViews()).toEqual([]);
    });
  });

  describe('createSavedView', () => {
    it('inserts and returns the mapped view on success', async () => {
      resultQueue = [
        { count: 3, error: null }, // cap check
        {
          data: {
            id: 'v9',
            name: 'New',
            filters: {},
            view_mode: 'sources',
            created_at: 't',
            updated_at: 't',
          },
          error: null,
        }, // insert.select.single
      ];
      const res = await createSavedView({ name: 'New', filters: baseFilters, view_mode: 'sources' });
      expect(res.success).toBe(true);
      expect(res.view?.id).toBe('v9');
      expect(res.view?.view_mode).toBe('sources');
    });

    it('returns unauthenticated when there is no user', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const res = await createSavedView({ name: 'x', filters: baseFilters, view_mode: 'values' });
      expect(res).toEqual({ success: false, view: null, error: 'unauthenticated' });
    });

    it('returns invalid_name for a blank name', async () => {
      const res = await createSavedView({ name: '   ', filters: baseFilters, view_mode: 'values' });
      expect(res.error).toBe('invalid_name');
    });

    it('returns limit_reached at the 50-view cap', async () => {
      resultQueue = [{ count: 50, error: null }];
      const res = await createSavedView({ name: 'x', filters: baseFilters, view_mode: 'values' });
      expect(res.error).toBe('limit_reached');
    });

    it('returns unknown on an insert error', async () => {
      resultQueue = [
        { count: 0, error: null },
        { data: null, error: { message: 'boom' } },
      ];
      const res = await createSavedView({ name: 'x', filters: baseFilters, view_mode: 'values' });
      expect(res.error).toBe('unknown');
    });
  });

  describe('deleteSavedView', () => {
    it('returns true on success', async () => {
      resultQueue = [{ error: null }];
      expect(await deleteSavedView('v1')).toBe(true);
    });
    it('returns false when there is no user', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      expect(await deleteSavedView('v1')).toBe(false);
    });
    it('returns false on a Supabase error', async () => {
      resultQueue = [{ error: { message: 'nope' } }];
      expect(await deleteSavedView('v1')).toBe(false);
    });
  });

  describe('importLegacySavedViews', () => {
    it('imports up to the remaining cap', async () => {
      const existing = Array.from({ length: 48 }, (_, i) => ({ name: `x${i}` }));
      resultQueue = [
        { data: existing, error: null }, // existing names (48 -> 2 remaining)
        { error: null }, // insert
      ];
      const res = await importLegacySavedViews([
        { name: 'a', filters: baseFilters, view_mode: 'values' },
        { name: 'b', filters: baseFilters, view_mode: 'values' },
        { name: 'c', filters: baseFilters, view_mode: 'values' },
      ]);
      expect(res).toEqual({ success: true, imported: 2 });
    });
    it('skips legacy views whose name already exists (dedupe)', async () => {
      resultQueue = [
        { data: [{ name: 'a' }], error: null }, // 'a' already present
        { error: null }, // insert
      ];
      const res = await importLegacySavedViews([
        { name: 'a', filters: baseFilters, view_mode: 'values' },
        { name: 'b', filters: baseFilters, view_mode: 'values' },
      ]);
      expect(res).toEqual({ success: true, imported: 1 });
    });
    it('imports nothing for an empty list', async () => {
      expect(await importLegacySavedViews([])).toEqual({ success: true, imported: 0 });
    });
    it('fails when signed out', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const res = await importLegacySavedViews([
        { name: 'a', filters: baseFilters, view_mode: 'values' },
      ]);
      expect(res).toEqual({ success: false, imported: 0 });
    });
  });

  describe('fetchSavedViewsResult', () => {
    it('reports signed-in + views on a successful non-empty read', async () => {
      resultQueue = [
        {
          data: [
            { id: 'v1', name: 'a', filters: {}, view_mode: 'values', created_at: 't', updated_at: 't' },
          ],
          error: null,
        },
      ];
      const r = await fetchSavedViewsResult();
      expect(r).toMatchObject({ signedIn: true, error: false });
      expect(r.views).toHaveLength(1);
    });
    it('reports signed-in + no error on a genuinely empty read', async () => {
      resultQueue = [{ data: [], error: null }];
      const r = await fetchSavedViewsResult();
      expect(r).toEqual({ signedIn: true, error: false, views: [] });
    });
    it('reports error=true on a Supabase read failure (preserves the fallback)', async () => {
      resultQueue = [{ data: null, error: { message: 'relation does not exist' } }];
      const r = await fetchSavedViewsResult();
      expect(r).toEqual({ signedIn: true, error: true, views: [] });
    });
    it('reports signed-out when there is no user', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const r = await fetchSavedViewsResult();
      expect(r).toEqual({ signedIn: false, error: false, views: [] });
    });
  });
});
