import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// admin_guards uses @supabase/ssr + next/headers + next/navigation. Mock those at the module
// boundary so we can exercise the three branches (unauth -> redirect/401, non-admin ->
// redirect/403, admin -> {client, user}).

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createServerClient: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

function buildSupabaseStub(opts: {
  user: { id: string } | null;
  authError?: boolean;
  isAdmin?: boolean;
}) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: opts.user },
        error: opts.authError ? { message: "x" } : null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: opts.isAdmin ? { role: "admin" } : null,
            })),
          })),
        })),
      })),
    })),
  };
}

beforeEach(() => {
  mocks.cookies.mockReturnValue({
    get: () => undefined,
    set: () => {},
  });
});
afterEach(() => {
  vi.resetAllMocks();
});

describe("requireAdminForApi", () => {
  it("returns 401 NextResponse on unauthenticated", async () => {
    mocks.createServerClient.mockReturnValue(buildSupabaseStub({ user: null }));
    const { requireAdminForApi } = await import("../admin_guards");
    const r = await requireAdminForApi();
    // NextResponse instance is hard to identify here without next/server import; assert by shape.
    expect((r as Response).status).toBe(401);
  });

  it("returns 403 NextResponse on non-admin", async () => {
    mocks.createServerClient.mockReturnValue(
      buildSupabaseStub({ user: { id: "u1" }, isAdmin: false })
    );
    const { requireAdminForApi } = await import("../admin_guards");
    const r = await requireAdminForApi();
    expect((r as Response).status).toBe(403);
  });

  it("returns {client, user} on admin", async () => {
    const stub = buildSupabaseStub({ user: { id: "u1" }, isAdmin: true });
    mocks.createServerClient.mockReturnValue(stub);
    const { requireAdminForApi } = await import("../admin_guards");
    const r = await requireAdminForApi();
    expect("user" in (r as object)).toBe(true);
    expect("client" in (r as object)).toBe(true);
    expect((r as { user: { id: string } }).user.id).toBe("u1");
  });
});

describe("requireAdminForServerComponent", () => {
  it("redirects to /login on unauthenticated", async () => {
    mocks.createServerClient.mockReturnValue(buildSupabaseStub({ user: null }));
    const { requireAdminForServerComponent } = await import("../admin_guards");
    await expect(requireAdminForServerComponent()).rejects.toThrow(/REDIRECT:\/login/);
  });

  it("redirects to /dashboard?error=admin_required on non-admin", async () => {
    mocks.createServerClient.mockReturnValue(
      buildSupabaseStub({ user: { id: "u1" }, isAdmin: false })
    );
    const { requireAdminForServerComponent } = await import("../admin_guards");
    await expect(requireAdminForServerComponent()).rejects.toThrow(
      /REDIRECT:\/dashboard\?error=admin_required/
    );
  });

  it("returns {client, user} on admin", async () => {
    mocks.createServerClient.mockReturnValue(
      buildSupabaseStub({ user: { id: "u1" }, isAdmin: true })
    );
    const { requireAdminForServerComponent } = await import("../admin_guards");
    const r = await requireAdminForServerComponent();
    expect(r.user.id).toBe("u1");
  });
});
