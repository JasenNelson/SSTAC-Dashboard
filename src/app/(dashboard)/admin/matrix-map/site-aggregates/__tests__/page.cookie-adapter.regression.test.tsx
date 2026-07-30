/**
 * REGRESSION: the admin site-aggregate page's Supabase cookie adapter must not
 * crash the page when a token refresh lands mid-render.
 *
 * PRODUCTION INCIDENT, 2026-07-30T16:37:33Z, digest 4193104151, route
 * /admin/matrix-map/site-aggregates:
 *
 *   Error: Cookies can only be modified in a Server Action or Route Handler.
 *     at Object.set (page.js)                     <- the page's own cookie adapter
 *     at setAll (@supabase/ssr)
 *     at applyServerStorage
 *     at SupabaseAuthClient._notifyAllSubscribers
 *     at SupabaseAuthClient._callRefreshToken     <- a token refresh triggered it
 *
 * The adapter (introduced by b84a7b44 / PR #711, 2026-07-20) used the legacy
 * get/set/remove shape with an UNGUARDED `cookieStore.set`. When @supabase/ssr
 * refreshed an expiring access token during the Server Component render it tried
 * to persist the token, Next.js refused, and the throw escaped EVERY loader
 * try/catch -- it originates inside the auth client's refresh, not in a query
 * result, so no `if (error)` check can see it. The page fell through to the
 * global error boundary and rendered an unstyled full-viewport warning icon
 * instead of the bounded InlineError this surface is designed to show.
 *
 * WHY THESE TESTS EXECUTE THE ADAPTER INSTEAD OF READING THE SOURCE. The sibling
 * contract test states the mission-control ruling plainly: regex / AST /
 * token-window source analysis was RETIRED because it claimed more than it
 * enforced. So this file captures the REAL adapter object the page hands to
 * `createServerClient` and CALLS it. A source-text assertion could pass against
 * code that still throws; an executed one cannot.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// The adapter the page passes to createServerClient, captured per render.
let capturedCookieAdapter: Record<string, unknown> | null = null;

// Records attempts so a test can prove a write was genuinely attempted and
// swallowed, rather than never attempted at all (which would pass vacuously).
let setAttempts: Array<{ name: string }> = [];

// When true, the mocked auth client persists a refreshed token during render,
// which is the exact sequence that crashed production.
let refreshDuringRender = false;

/**
 * Mocks Next.js's Server Component cookie store: reads work, writes THROW with
 * the exact production message. This is what makes the test a reproduction
 * rather than an approximation.
 */
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => [{ name: 'sb-access-token', value: 'v' }],
    get: () => undefined,
    set: (nameOrObj: unknown) => {
      const name =
        typeof nameOrObj === 'string'
          ? nameOrObj
          : ((nameOrObj as { name?: string })?.name ?? 'unknown');
      setAttempts.push({ name });
      throw new Error(
        'Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options'
      );
    },
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('redirect should not be reached in these tests');
  },
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: Record<string, unknown> }) => {
    capturedCookieAdapter = opts.cookies;
    return {
      auth: {
        // REPRODUCES THE PRODUCTION TRIGGER. In the incident, @supabase/ssr
        // refreshed an expiring access token during the Server Component render
        // (`_callRefreshToken` -> `applyServerStorage` -> the page's cookie
        // adapter) and tried to persist it. Simulating that here -- rather than
        // only inspecting the adapter's shape -- is what makes the end-to-end
        // test below an actual reproduction: with the legacy unguarded adapter
        // this write escapes and the whole page throws.
        getUser: async () => {
          if (refreshDuringRender) {
            const c = capturedCookieAdapter as Record<string, unknown> | null;
            if (typeof c?.setAll === 'function') {
              (c.setAll as (v: unknown[]) => void)([
                { name: 'sb-access-token', value: 'refreshed', options: {} },
              ]);
            } else if (typeof c?.set === 'function') {
              (c.set as (n: string, v: string, o: unknown) => void)(
                'sb-access-token',
                'refreshed',
                {}
              );
            }
          }
          return { data: { user: { id: 'admin-user' } }, error: null };
        },
      },
      // Mirrors the page's real chain:
      //   .from('user_roles').select('role').eq(..).in(..).limit(1).maybeSingle()
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: { role: 'admin' }, error: null }),
              }),
            }),
          }),
        }),
      }),
      // THE MISSING-RPC CONDITION, which is the live production state until D2
      // is applied: PostgREST's code for an absent function. The loaders reach
      // the RPC via `client.schema('matrix_map').rpc(...)`, so both spellings
      // return the same absent-function error.
      schema: () => ({
        rpc: async () => ({
          data: null,
          error: {
            code: 'PGRST202',
            message:
              'Could not find the function matrix_map.fetch_admin_site_aggregate_live_preview',
          },
        }),
      }),
    };
  },
}));

beforeEach(() => {
  capturedCookieAdapter = null;
  setAttempts = [];
  refreshDuringRender = false;
  vi.clearAllMocks();
});

async function renderPage() {
  const mod = await import('../page');
  // The real signature takes NO parameters (`export default async function
  // SiteAggregatesPreviewPage()`); do not assert a props contract it lacks.
  const Page = mod.default as () => Promise<React.ReactElement>;
  const element = await Page();
  return render(element);
}

describe('site-aggregates page cookie adapter (production regression)', () => {
  it('hands createServerClient the modern getAll/setAll adapter', async () => {
    await renderPage();
    expect(capturedCookieAdapter, 'the page must construct a Supabase server client').not.toBeNull();
    expect(typeof capturedCookieAdapter!.getAll).toBe('function');
    expect(typeof capturedCookieAdapter!.setAll).toBe('function');
  });

  it('EXPOSES NO legacy get/set/remove adapter, so the unguarded path cannot return', async () => {
    await renderPage();
    // ASSERTED WITH `in`, NOT `toBeUndefined()`. @supabase/ssr dispatches on KEY
    // PRESENCE, not on value: `if ("get" in cookies)` and
    // `if ("set" in cookies && "remove" in cookies)`. So an adapter shaped
    // `{ getAll, setAll, get: undefined, set: undefined, remove: undefined }` --
    // which a future conditional spread could easily produce -- would satisfy a
    // `toBeUndefined()` check while still routing the real library into the
    // legacy branch, where it calls `cookies.get(...)` and throws. Testing
    // presence is what actually matches the dispatch.
    expect('set' in capturedCookieAdapter!, 'legacy unguarded set must not be reintroduced').toBe(false);
    expect('remove' in capturedCookieAdapter!).toBe(false);
    expect('get' in capturedCookieAdapter!).toBe(false);
  });

  it('getAll delegates to the Next.js cookie store', async () => {
    await renderPage();
    const all = (capturedCookieAdapter!.getAll as () => Array<{ name: string }>)();
    expect(all).toEqual([{ name: 'sb-access-token', value: 'v' }]);
  });

  it('setAll SWALLOWS the Server Component cookie-write refusal instead of throwing', async () => {
    await renderPage();
    const setAll = capturedCookieAdapter!.setAll as (
      c: Array<{ name: string; value: string; options: Record<string, unknown> }>
    ) => void;

    // This is the exact production trigger: @supabase/ssr persisting a refreshed
    // token during a Server Component render.
    expect(() =>
      setAll([{ name: 'sb-access-token', value: 'refreshed', options: {} }])
    ).not.toThrow();

    // NOT VACUOUS: prove the write was actually attempted and then swallowed.
    // Without this, an adapter whose setAll did nothing at all would also pass.
    expect(setAttempts.map((a) => a.name)).toEqual(['sb-access-token']);
  });

  it('setAll still swallows when several cookies are written in one refresh', async () => {
    await renderPage();
    const setAll = capturedCookieAdapter!.setAll as (
      c: Array<{ name: string; value: string; options: Record<string, unknown> }>
    ) => void;
    expect(() =>
      setAll([
        { name: 'sb-access-token', value: 'a', options: {} },
        { name: 'sb-refresh-token', value: 'r', options: {} },
      ])
    ).not.toThrow();
    // EXACTLY one: the guard wraps the whole forEach, and the mocked store throws
    // on the first write, so the batch is abandoned there. Asserting the precise
    // number rather than `>= 1` keeps this from passing under a future adapter
    // that retried or partially succeeded.
    expect(setAttempts.length).toBe(1);
  });
});

describe('missing live-preview RPC stays inside the bounded error path', () => {
  it('SURVIVES a token refresh mid-render and still renders the bounded InlineError', async () => {
    // THE END-TO-END REPRODUCTION. With the legacy unguarded adapter this render
    // throws "Cookies can only be modified in a Server Action or Route Handler"
    // and the page falls through to the global error boundary -- the production
    // incident. With the guarded adapter the refusal is swallowed and the page
    // still reaches its own bounded error UI.
    refreshDuringRender = true;
    const { container } = await renderPage();
    const text = container.textContent ?? '';
    // Proves the write was genuinely attempted during render, so this is not
    // passing merely because no refresh occurred.
    expect(setAttempts.length).toBeGreaterThanOrEqual(1);
    expect(text).toContain('Failed to load aggregate preview');
  });

  it('renders the InlineError banner and does NOT throw to the error boundary', async () => {
    // If this page threw, `renderPage()` would reject and the test would fail --
    // which is exactly the production behaviour this hotfix removes.
    const { container } = await renderPage();
    const text = container.textContent ?? '';
    expect(text).toContain('Failed to load aggregate preview');
  });
});
