import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkCsrf } from "../csrf";
import type { NextRequest } from "next/server";

// Minimal NextRequest stand-in: only the properties checkCsrf reads.
function makeReq(opts: {
  contentType?: string;
  origin?: string;
  referer?: string;
  selfOrigin?: string;
}): NextRequest {
  const headers = new Map<string, string>();
  if (opts.contentType !== undefined) headers.set("content-type", opts.contentType);
  if (opts.origin !== undefined) headers.set("origin", opts.origin);
  if (opts.referer !== undefined) headers.set("referer", opts.referer);
  return {
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    nextUrl: { origin: opts.selfOrigin ?? "https://prod.example.com" },
  } as unknown as NextRequest;
}

const env = process.env as Record<string, string | undefined>;
const origEnv = { ...env };
beforeEach(() => {
  // Clean slate per test
  delete env.VERCEL_ENV;
  delete env.NEXT_PUBLIC_SITE_URL;
  delete env.VERCEL_PROJECT_PRODUCTION_URL;
  env.NODE_ENV = "test";
});
afterEach(() => {
  for (const k of Object.keys(env)) delete env[k];
  Object.assign(env, origEnv);
});

describe("Content-Type enforcement (Finding 11)", () => {
  it("rejects missing Content-Type", () => {
    const r = checkCsrf(makeReq({ origin: "https://prod.example.com" }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("missing_content_type");
  });

  it("rejects non-JSON Content-Type", () => {
    const r = checkCsrf(
      makeReq({ contentType: "application/x-www-form-urlencoded", origin: "https://prod.example.com" })
    );
    expect(r.reason).toBe("wrong_content_type");
  });

  it("rejects application/jsonp (no prefix collision)", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://prod.example.com";
    const r = checkCsrf(
      makeReq({ contentType: "application/jsonp", origin: "https://prod.example.com" })
    );
    expect(r.reason).toBe("wrong_content_type");
  });

  it("rejects application/json-patch+json (exact media type only)", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://prod.example.com";
    const r = checkCsrf(
      makeReq({
        contentType: "application/json-patch+json",
        origin: "https://prod.example.com",
      })
    );
    expect(r.reason).toBe("wrong_content_type");
  });

  it("accepts application/json with charset suffix", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://prod.example.com";
    const r = checkCsrf(
      makeReq({
        contentType: "application/json; charset=utf-8",
        origin: "https://prod.example.com",
      })
    );
    expect(r.ok).toBe(true);
  });
});

describe("Production origin allowance (Finding 24)", () => {
  beforeEach(() => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://prod.example.com";
  });

  it("accepts exact NEXT_PUBLIC_SITE_URL", () => {
    const r = checkCsrf(
      makeReq({ contentType: "application/json", origin: "https://prod.example.com" })
    );
    expect(r.ok).toBe(true);
  });

  it("normalizes NEXT_PUBLIC_SITE_URL before matching the production origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://prod.example.com/admin";
    const r = checkCsrf(
      makeReq({ contentType: "application/json", origin: "https://prod.example.com" })
    );
    expect(r.ok).toBe(true);
  });

  it("accepts same-origin Vercel production requests when NEXT_PUBLIC_SITE_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const r = checkCsrf(
      makeReq({
        contentType: "application/json",
        origin: "https://sstac-dashboard.vercel.app",
        selfOrigin: "https://sstac-dashboard.vercel.app",
      })
    );
    expect(r.ok).toBe(true);
  });

  it("rejects same-origin production aliases when NEXT_PUBLIC_SITE_URL is configured", () => {
    const r = checkCsrf(
      makeReq({
        contentType: "application/json",
        origin: "https://preview-deploy.vercel.app",
        selfOrigin: "https://preview-deploy.vercel.app",
      })
    );
    expect(r.reason).toBe("origin_mismatch");
  });

  it("rejects mismatched origin", () => {
    const r = checkCsrf(
      makeReq({ contentType: "application/json", origin: "https://evil.example.com" })
    );
    expect(r.reason).toBe("origin_mismatch");
  });

  it("rejects Vercel preview origin from production deploy", () => {
    const r = checkCsrf(
      makeReq({
        contentType: "application/json",
        origin: "https://preview-deploy.vercel.app",
      })
    );
    expect(r.reason).toBe("origin_mismatch");
  });
});

describe("Preview project-slug origin (Finding 24)", () => {
  beforeEach(() => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "sstac-dashboard.vercel.app";
  });

  it("accepts <slug>-<suffix>.vercel.app HTTPS", () => {
    const r = checkCsrf(
      makeReq({
        contentType: "application/json",
        origin: "https://sstac-dashboard-git-feat-x.vercel.app",
      })
    );
    expect(r.ok).toBe(true);
  });

  it("accepts same-origin via request.nextUrl.origin", () => {
    const r = checkCsrf(
      makeReq({
        contentType: "application/json",
        origin: "https://my-preview.example.com",
        selfOrigin: "https://my-preview.example.com",
      })
    );
    expect(r.ok).toBe(true);
  });

  it("rejects unrelated *.vercel.app (slug mismatch)", () => {
    const r = checkCsrf(
      makeReq({
        contentType: "application/json",
        origin: "https://evil.vercel.app",
      })
    );
    expect(r.reason).toBe("origin_mismatch");
  });

  it("rejects another project's preview <other>-<suffix>.vercel.app", () => {
    const r = checkCsrf(
      makeReq({
        contentType: "application/json",
        origin: "https://other-project-git-main.vercel.app",
      })
    );
    expect(r.reason).toBe("origin_mismatch");
  });

  it("rejects bare <slug>.vercel.app (no preview suffix)", () => {
    const r = checkCsrf(
      makeReq({
        contentType: "application/json",
        origin: "https://sstac-dashboard.vercel.app",
      })
    );
    expect(r.reason).toBe("origin_mismatch");
  });

  it("rejects HTTP *.vercel.app (must be HTTPS)", () => {
    const r = checkCsrf(
      makeReq({
        contentType: "application/json",
        origin: "http://sstac-dashboard-git-x.vercel.app",
      })
    );
    expect(r.reason).toBe("origin_mismatch");
  });

  it("rejects all *.vercel.app when VERCEL_PROJECT_PRODUCTION_URL unset", () => {
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const r = checkCsrf(
      makeReq({
        contentType: "application/json",
        origin: "https://sstac-dashboard-git-x.vercel.app",
      })
    );
    expect(r.reason).toBe("origin_mismatch");
  });
});

describe("Local dev localhost allowance", () => {
  beforeEach(() => {
    env.NODE_ENV = "development";
    delete process.env.VERCEL_ENV;
  });

  it("accepts http://localhost", () => {
    const r = checkCsrf(
      makeReq({ contentType: "application/json", origin: "http://localhost:3000" })
    );
    expect(r.ok).toBe(true);
  });

  it("accepts http://127.0.0.1", () => {
    const r = checkCsrf(
      makeReq({ contentType: "application/json", origin: "http://127.0.0.1:3000" })
    );
    expect(r.ok).toBe(true);
  });

  it("rejects https://localhost (HTTP only in dev)", () => {
    const r = checkCsrf(
      makeReq({ contentType: "application/json", origin: "https://localhost:3000" })
    );
    expect(r.reason).toBe("origin_mismatch");
  });
});

describe("Referer fallback when Origin absent", () => {
  beforeEach(() => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://prod.example.com";
  });

  it("uses Referer to derive origin", () => {
    const r = checkCsrf(
      makeReq({
        contentType: "application/json",
        referer: "https://prod.example.com/dashboard/engine-v2/abc",
      })
    );
    expect(r.ok).toBe(true);
  });

  it("rejects when both Origin and Referer absent", () => {
    const r = checkCsrf(makeReq({ contentType: "application/json" }));
    expect(r.reason).toBe("missing_origin_and_referer");
  });
});
