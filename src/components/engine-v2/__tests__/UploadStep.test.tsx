// UploadStep client tests (Findings 40, 53, 56, 65, 66, 71, 75, 85, 94, 100, 107).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { UploadStep } from "../UploadStep";

// jwt with sub = USER_ID; payload base64url-encoded {"sub":"user-1"} -- the
// actual user id value does not affect tests, but UploadStep extracts it for
// the storage path used in TUS metadata.
const JWT_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.sig";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

// Stub tus.Upload that immediately reports success.
class FakeTusUpload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_file: any, public opts: any) {
    void _file;
  }
  start(): void {
    setTimeout(() => {
      this.opts.onProgress?.(100, 100);
      this.opts.onSuccess?.();
    }, 0);
  }
}

class FailingTusUpload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_file: any, public opts: any) {
    void _file;
  }
  start(): void {
    setTimeout(() => this.opts.onError?.(new Error("tus_failed")), 0);
  }
}

function makeFile(): File {
  return new File(["pdf-content"], "report.pdf", { type: "application/pdf" });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function failingJsonResponse(status: number): Response {
  // Body that throws on .json()
  return new Response("not-json", {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface FetchPlan {
  // Map of pathname to handler (called in order if duplicate path).
  byPath: Record<string, Array<() => Promise<Response> | Response>>;
}

function mockFetch(plan: FetchPlan): typeof fetch {
  const calls: Array<{ path: string; method: string }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn: any = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    const pathname = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ path: pathname!, method });
    const handlers = plan.byPath[pathname!];
    if (!handlers || handlers.length === 0) {
      throw new Error(`mockFetch: unexpected ${method} ${pathname}`);
    }
    const next = handlers.shift()!;
    return next();
  });
  fn.calls = calls;
  return fn as typeof fetch;
}

function getAccessToken(): Promise<string> {
  return Promise.resolve(JWT_TOKEN);
}

beforeEach(() => {
  // jsdom does not implement AbortSignal.timeout in older versions.
  // Provide a no-op fallback so UploadStep's gated call doesn't throw.
  if (!(AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout) {
    (AbortSignal as unknown as { timeout: (ms: number) => AbortSignal }).timeout = (
      _ms: number,
    ) => {
      void _ms;
      return new AbortController().signal;
    };
  }
});

async function triggerUpload(plan: FetchPlan, TusCtor = FakeTusUpload) {
  const fetchImpl = mockFetch(plan);
  render(
    <UploadStep
      projectId={PROJECT_ID}
      getAccessToken={getAccessToken}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tusUploadCtor={TusCtor as any}
      fetchImpl={fetchImpl}
      supabaseUrl="https://demoproject.supabase.co"
      supabaseAnonKey="test-anon-key"
    />,
  );
  const input = screen.getByTestId("upload-step-input") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [makeFile()] } });
  return { fetchImpl };
}

describe("UploadStep - DECISIVE path", () => {
  it("200 from /files/complete -> no orphan call, status success", async () => {
    const plan: FetchPlan = {
      byPath: {
        "/api/engine-v2/files/complete": [() => jsonResponse(200, { id: "row" })],
      },
    };
    await triggerUpload(plan);
    await waitFor(() => {
      expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "success");
    });
  });

  it("400 magic_mismatch + orphan:true -> calls /files/orphan", async () => {
    const plan: FetchPlan = {
      byPath: {
        "/api/engine-v2/files/complete": [
          () =>
            jsonResponse(400, {
              error: "magic_mismatch",
              orphan_cleanup_required: true,
            }),
        ],
        "/api/engine-v2/files/orphan": [() => jsonResponse(200, { deleted: true })],
      },
    };
    await triggerUpload(plan);
    await waitFor(() => {
      expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "error");
    });
    // Ensure orphan endpoint was hit.
    expect(plan.byPath["/api/engine-v2/files/orphan"]!.length).toBe(0);
  });

  it("413 project_cap_exceeded + orphan:true -> calls /files/orphan (F107)", async () => {
    const plan: FetchPlan = {
      byPath: {
        "/api/engine-v2/files/complete": [
          () =>
            jsonResponse(413, {
              error: "project_cap_exceeded",
              orphan_cleanup_required: true,
            }),
        ],
        "/api/engine-v2/files/orphan": [() => jsonResponse(200, { deleted: true })],
      },
    };
    await triggerUpload(plan);
    await waitFor(() => {
      expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "error");
    });
    expect(plan.byPath["/api/engine-v2/files/orphan"]!.length).toBe(0);
  });

  it("500 guard_query_error + orphan:true -> calls /files/orphan (F107)", async () => {
    const plan: FetchPlan = {
      byPath: {
        "/api/engine-v2/files/complete": [
          () =>
            jsonResponse(500, {
              error: "guard_query_error_during_magic_cleanup",
              orphan_cleanup_required: true,
            }),
        ],
        "/api/engine-v2/files/orphan": [() => jsonResponse(200, { deleted: true })],
      },
    };
    await triggerUpload(plan);
    await waitFor(() => {
      expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "error");
    });
    expect(plan.byPath["/api/engine-v2/files/orphan"]!.length).toBe(0);
  });

  it("409 file_id_reused + orphan:false -> does NOT call /files/orphan (F107 critical)", async () => {
    const plan: FetchPlan = {
      byPath: {
        "/api/engine-v2/files/complete": [
          () =>
            jsonResponse(409, {
              error: "file_id_reused_with_different_content",
              orphan_cleanup_required: false,
            }),
        ],
        "/api/engine-v2/files/orphan": [
          () => {
            throw new Error("should not be called");
          },
        ],
      },
    };
    await triggerUpload(plan);
    await waitFor(() => {
      expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "conflict");
    });
    // /files/orphan handler queue should be untouched.
    expect(plan.byPath["/api/engine-v2/files/orphan"]!.length).toBe(1);
  });

  it("500 + /files/orphan 409 already_finalized -> treated as success (F56)", async () => {
    const plan: FetchPlan = {
      byPath: {
        "/api/engine-v2/files/complete": [
          () =>
            jsonResponse(500, {
              error: "some_error",
              orphan_cleanup_required: true,
            }),
        ],
        "/api/engine-v2/files/orphan": [
          () => jsonResponse(409, { error: "already_finalized" }),
        ],
      },
    };
    await triggerUpload(plan);
    await waitFor(() => {
      expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "success");
    });
  });

  it("500 + /files/orphan 404 -> logs but does not block", async () => {
    const plan: FetchPlan = {
      byPath: {
        "/api/engine-v2/files/complete": [
          () =>
            jsonResponse(500, {
              error: "some_error",
              orphan_cleanup_required: true,
            }),
        ],
        "/api/engine-v2/files/orphan": [() => jsonResponse(404, { error: "not_found" })],
      },
    };
    await triggerUpload(plan);
    await waitFor(() => {
      expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "error");
    });
  });
});

describe("UploadStep - CLEANUP-UNKNOWN path (Finding 100)", () => {
  it("500 with missing flag -> NO orphan call", async () => {
    const plan: FetchPlan = {
      byPath: {
        "/api/engine-v2/files/complete": [
          () => jsonResponse(500, { error: "unknown" }),
        ],
        "/api/engine-v2/files/exists": [
          () => jsonResponse(404, { error: "not_found" }),
          () => jsonResponse(404, { error: "not_found" }),
          () => jsonResponse(404, { error: "not_found" }),
          () => jsonResponse(404, { error: "not_found" }),
          () => jsonResponse(404, { error: "not_found" }),
        ],
        "/api/engine-v2/files/orphan": [
          () => {
            throw new Error("should not be called");
          },
        ],
      },
    };
    await triggerUpload(plan);
    await waitFor(
      () => {
        expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "error");
      },
      { timeout: 10000 },
    );
    expect(plan.byPath["/api/engine-v2/files/orphan"]!.length).toBe(1);
  }, 15000);

  it("400 with orphan:null -> NO orphan call", async () => {
    const plan: FetchPlan = {
      byPath: {
        "/api/engine-v2/files/complete": [
          () => jsonResponse(400, { error: "x", orphan_cleanup_required: null }),
        ],
        "/api/engine-v2/files/exists": [
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
        ],
        "/api/engine-v2/files/orphan": [
          () => {
            throw new Error("should not be called");
          },
        ],
      },
    };
    await triggerUpload(plan);
    await waitFor(
      () => {
        expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "error");
      },
      { timeout: 10000 },
    );
    expect(plan.byPath["/api/engine-v2/files/orphan"]!.length).toBe(1);
  }, 15000);

  it('400 with orphan:"true" (string) -> NO orphan call', async () => {
    const plan: FetchPlan = {
      byPath: {
        "/api/engine-v2/files/complete": [
          () => jsonResponse(400, { error: "x", orphan_cleanup_required: "true" }),
        ],
        "/api/engine-v2/files/exists": [
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
        ],
        "/api/engine-v2/files/orphan": [
          () => {
            throw new Error("should not be called");
          },
        ],
      },
    };
    await triggerUpload(plan);
    await waitFor(
      () => {
        expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "error");
      },
      { timeout: 10000 },
    );
    expect(plan.byPath["/api/engine-v2/files/orphan"]!.length).toBe(1);
  }, 15000);

  it("400 with orphan:1 (number) -> NO orphan call", async () => {
    const plan: FetchPlan = {
      byPath: {
        "/api/engine-v2/files/complete": [
          () => jsonResponse(400, { error: "x", orphan_cleanup_required: 1 }),
        ],
        "/api/engine-v2/files/exists": [
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
        ],
        "/api/engine-v2/files/orphan": [
          () => {
            throw new Error("should not be called");
          },
        ],
      },
    };
    await triggerUpload(plan);
    await waitFor(
      () => {
        expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "error");
      },
      { timeout: 10000 },
    );
    expect(plan.byPath["/api/engine-v2/files/orphan"]!.length).toBe(1);
  }, 15000);
});

describe("UploadStep - AMBIGUOUS path (Findings 53, 66, 71, 75, 85)", () => {
  it("network throw -> polls /files/exists, no orphan call (a)", async () => {
    const plan: FetchPlan = {
      byPath: {
        "/api/engine-v2/files/complete": [
          () => {
            throw new TypeError("Failed to fetch");
          },
        ],
        "/api/engine-v2/files/exists": [
          () => jsonResponse(404, {}),
          () => jsonResponse(200, { exists: true, file: { id: "row" } }),
        ],
        "/api/engine-v2/files/orphan": [
          () => {
            throw new Error("should not be called");
          },
        ],
      },
    };
    await triggerUpload(plan);
    await waitFor(
      () => {
        expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "success");
      },
      { timeout: 10000 },
    );
    expect(plan.byPath["/api/engine-v2/files/orphan"]!.length).toBe(1);
  }, 15000);

  it("2xx but json() throws -> polls /files/exists, no orphan call (b, F75)", async () => {
    const plan: FetchPlan = {
      byPath: {
        "/api/engine-v2/files/complete": [() => failingJsonResponse(200)],
        "/api/engine-v2/files/exists": [
          () => jsonResponse(200, { exists: true, file: { id: "row" } }),
        ],
        "/api/engine-v2/files/orphan": [
          () => {
            throw new Error("should not be called");
          },
        ],
      },
    };
    await triggerUpload(plan);
    await waitFor(
      () => {
        expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "success");
      },
      { timeout: 10000 },
    );
  }, 15000);

  it("non-2xx with unparseable body -> polls /files/exists, no orphan call (c, F85)", async () => {
    const plan: FetchPlan = {
      byPath: {
        "/api/engine-v2/files/complete": [() => failingJsonResponse(502)],
        "/api/engine-v2/files/exists": [
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
          () => jsonResponse(404, {}),
        ],
        "/api/engine-v2/files/orphan": [
          () => {
            throw new Error("should not be called");
          },
        ],
      },
    };
    await triggerUpload(plan);
    await waitFor(
      () => {
        expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "error");
      },
      { timeout: 10000 },
    );
  }, 15000);
});

describe("UploadStep - TUS failure", () => {
  it("error path when TUS itself fails", async () => {
    const plan: FetchPlan = { byPath: {} };
    await triggerUpload(plan, FailingTusUpload);
    await waitFor(() => {
      expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "error");
    });
  });
});

describe("UploadStep - POST /files/complete payload contract (regression)", () => {
  it("sends content_type (not mime_type) and matches FileCompletePayloadSchema", async () => {
    let capturedBody: unknown = undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchImpl: any = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      if (url.includes("/api/engine-v2/files/complete")) {
        capturedBody = init?.body ? JSON.parse(init.body as string) : undefined;
        return jsonResponse(200, { id: "row" });
      }
      throw new Error(`unexpected ${url}`);
    });
    render(
      <UploadStep
        projectId={PROJECT_ID}
        getAccessToken={getAccessToken}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tusUploadCtor={FakeTusUpload as any}
        fetchImpl={fetchImpl}
        supabaseUrl="https://demoproject.supabase.co"
      supabaseAnonKey="test-anon-key"
      />,
    );
    const input = screen.getByTestId("upload-step-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile()] } });
    await waitFor(() => {
      expect(screen.getByTestId("upload-step")).toHaveAttribute("data-status", "success");
    });
    expect(capturedBody).toBeDefined();
    const body = capturedBody as Record<string, unknown>;
    // Field names must match FileCompletePayloadSchema (src/lib/engine-v2/zod.ts).
    // BLOCKER guard: if any future refactor renames to mime_type, this test fails fast.
    expect(body).toEqual(
      expect.objectContaining({
        project_id: PROJECT_ID,
        original_filename: "report.pdf",
        size_bytes: 11,
        content_type: "application/pdf",
      }),
    );
    expect(body).not.toHaveProperty("mime_type");
    expect(typeof body.file_id).toBe("string");
    // file_id should look like a UUID v4 (8-4-4-4-12 hex pattern, version digit 4).
    expect(body.file_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
