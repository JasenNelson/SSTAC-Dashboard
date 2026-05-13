// engine_v2 frontend Lane 2d / Phase D: GET /chat/models route tests.
//
// Covers:
//   - 403 non-admin.
//   - 503 LOCAL_ENGINE_ENABLED!='true' with normalized
//     { error: 'local_engine_disabled' } shape.
//   - 404 cross-owner / missing evaluation.
//   - 500 ownership probe error.
//   - happy path: returns { fast, thinking } shape with availability
//     dots that match the cached tags probe.
//   - Goes through getOllamaTags() (cached); does NOT call fetch
//     directly against /api/tags.
//
// ASCII only.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/engine-v2/admin_guards", () => ({
  requireAdminForApi: vi.fn(),
}));
vi.mock("@/lib/api-guards", () => ({
  requireLocalEngine: vi.fn(),
}));
vi.mock("@/lib/engine-v2/ollama_tags_cache", () => ({
  getOllamaTags: vi.fn(),
}));

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { requireLocalEngine } from "@/lib/api-guards";
import { getOllamaTags } from "@/lib/engine-v2/ollama_tags_cache";
import { GET } from "../route";

const mockedAdmin = vi.mocked(requireAdminForApi);
const mockedLocalEngine = vi.mocked(requireLocalEngine);
const mockedTags = vi.mocked(getOllamaTags);

const EVAL_ID = "11111111-2222-3333-4444-555555555555";
const USER_ID = "admin-user";

function makeReq(): import("next/server").NextRequest {
  return {
    headers: new Headers(),
    nextUrl: new URL(
      `http://localhost:3000/api/engine-v2/evaluations/${EVAL_ID}/chat/models`,
    ),
  } as unknown as import("next/server").NextRequest;
}
function makeContext(): { params: Promise<{ evalId: string }> } {
  return { params: Promise.resolve({ evalId: EVAL_ID }) };
}

interface ClientCfg {
  ownershipRow?: { id: string; v2_projects: { user_id: string } } | null;
  ownershipError?: { message: string };
}

function makeClient(cfg: ClientCfg) {
  return {
    from(table: string) {
      if (table === "v2_evaluations") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            if (cfg.ownershipError) {
              return { data: null, error: cfg.ownershipError };
            }
            const defaultRow =
              cfg.ownershipRow === undefined
                ? { id: EVAL_ID, v2_projects: { user_id: USER_ID } }
                : cfg.ownershipRow;
            return { data: defaultRow, error: null };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

function adminOk(client: unknown = makeClient({})): void {
  mockedAdmin.mockResolvedValue({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: client as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: { id: USER_ID } as any,
  });
}
function adminForbidden(): void {
  mockedAdmin.mockResolvedValue(
    NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  );
}
function localEngineOk(): void {
  mockedLocalEngine.mockReturnValue(null);
}
function localEngineDisabled(): void {
  mockedLocalEngine.mockReturnValue(
    NextResponse.json(
      { error: "This feature requires the local evaluation engine." },
      { status: 503 },
    ),
  );
}

let originalLocalEngineEnv: string | undefined;
const fetchSpy = vi.spyOn(global, "fetch");
beforeEach(() => {
  originalLocalEngineEnv = process.env.LOCAL_ENGINE_ENABLED;
  process.env.LOCAL_ENGINE_ENABLED = "true";
  vi.clearAllMocks();
  fetchSpy.mockReset();
});
afterEach(() => {
  if (originalLocalEngineEnv === undefined) {
    delete process.env.LOCAL_ENGINE_ENABLED;
  } else {
    process.env.LOCAL_ENGINE_ENABLED = originalLocalEngineEnv;
  }
  fetchSpy.mockReset();
});

describe("GET /api/engine-v2/evaluations/[evalId]/chat/models", () => {
  it("403 when non-admin", async () => {
    adminForbidden();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(403);
  });

  it("503 local_engine_disabled when LOCAL_ENGINE_ENABLED!='true'", async () => {
    adminOk();
    localEngineDisabled();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("local_engine_disabled");
  });

  it("500 when ownership probe errors", async () => {
    const client = makeClient({ ownershipError: { message: "db down" } });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(500);
  });

  it("404 when ownership probe returns null", async () => {
    const client = makeClient({ ownershipRow: null });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(404);
  });

  it("happy path: returns availability matching the cached probe", async () => {
    const client = makeClient({});
    adminOk(client);
    localEngineOk();
    mockedTags.mockResolvedValue([
      "gemma4:e4b",
      "qwen2.5:14b-instruct-q4_K_M",
    ]);
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      fast: { model_id: "gemma4:e4b", available: true },
      thinking: { model_id: "qwen2.5:14b-instruct-q4_K_M", available: true },
    });
    expect(mockedTags).toHaveBeenCalledTimes(1);
  });

  it("walks fallbacks when default missing", async () => {
    const client = makeClient({});
    adminOk(client);
    localEngineOk();
    mockedTags.mockResolvedValue(["mistral-nemo:latest"]);
    const res = await GET(makeReq(), makeContext());
    const body = await res.json();
    expect(body.fast).toEqual({
      model_id: "mistral-nemo:latest",
      available: true,
    });
    expect(body.thinking).toEqual({
      model_id: "mistral-nemo:latest",
      available: true,
    });
  });

  it("marks unavailable when no model matches; surfaces default id", async () => {
    const client = makeClient({});
    adminOk(client);
    localEngineOk();
    mockedTags.mockResolvedValue([]);
    const res = await GET(makeReq(), makeContext());
    const body = await res.json();
    expect(body.fast.available).toBe(false);
    expect(body.thinking.available).toBe(false);
    expect(body.fast.model_id).toBe("gemma4:e4b");
    expect(body.thinking.model_id).toBe("qwen2.5:14b-instruct-q4_K_M");
  });

  it("does NOT call fetch directly against /api/tags (uses cached helper)", async () => {
    const client = makeClient({});
    adminOk(client);
    localEngineOk();
    mockedTags.mockResolvedValue(["gemma4:e4b"]);
    await GET(makeReq(), makeContext());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
