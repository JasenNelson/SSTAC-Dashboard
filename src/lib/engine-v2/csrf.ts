// engine_v2 frontend Lane 1: CSRF protection (Findings 11, 24, 45).
// L1-1 foundation utility consumed by all v2 POST/DELETE API routes.
// Moved from L1-3 per Finding 45 (shared across L1-3, L1-4, L1-6 parallel modules).

import type { NextRequest } from "next/server";

export interface CsrfCheckResult {
  ok: boolean;
  reason?:
    | "missing_content_type"
    | "wrong_content_type"
    | "missing_origin_and_referer"
    | "origin_mismatch";
  detail?: string;
}

// Environment-aware Origin check (Finding 24):
// - production: strict against NEXT_PUBLIC_SITE_URL when set; otherwise same-origin
// - preview: same-origin (request.nextUrl.origin) OR <project-slug>-*.vercel.app
//   where slug is derived from VERCEL_PROJECT_PRODUCTION_URL
// - dev: allow http://localhost:* and http://127.0.0.1:*
function getProjectSlug(): string | null {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!prod) return null;
  const dot = prod.indexOf(".");
  const slug = dot > 0 ? prod.slice(0, dot) : prod;
  return /^[a-z0-9-]+$/.test(slug) ? slug : null;
}

function configuredSiteOriginMatches(origin: string): boolean | null {
  const expected = process.env.NEXT_PUBLIC_SITE_URL;
  if (!expected) return null;
  try {
    return origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

function isOriginAllowed(origin: string, request: NextRequest): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  const nodeEnv = process.env.NODE_ENV;

  if (vercelEnv === "production") {
    const configuredMatch = configuredSiteOriginMatches(origin);
    if (configuredMatch !== null) return configuredMatch;
    return origin === request.nextUrl.origin;
  }

  if (vercelEnv === "preview") {
    if (origin === request.nextUrl.origin) return true; // same-origin pass-through
    const slug = getProjectSlug();
    if (!slug) return false;
    try {
      const u = new URL(origin);
      if (u.protocol !== "https:") return false;
      if (!u.hostname.endsWith(".vercel.app")) return false;
      const bare = u.hostname.slice(0, -".vercel.app".length);
      // Must be "<slug>-<deployment-suffix>" with non-empty suffix.
      return bare.startsWith(slug + "-") && bare.length > slug.length + 1;
    } catch {
      return false;
    }
  }

  // Local dev fallback (VERCEL_ENV undefined and NODE_ENV === 'development').
  if (!vercelEnv && nodeEnv === "development") {
    try {
      const u = new URL(origin);
      const isHttpLocalhost =
        u.protocol === "http:" &&
        (u.hostname === "localhost" || u.hostname === "127.0.0.1");
      return isHttpLocalhost;
    } catch {
      return false;
    }
  }

  // Self-hosted prod (no VERCEL_ENV but no localhost either): strict against NEXT_PUBLIC_SITE_URL.
  return configuredSiteOriginMatches(origin) === true;
}

// Verify Content-Type + Origin/Referer on POST/DELETE requests.
// Returns ok=true on pass; structured reason on failure.
// Callers MUST reject with HTTP 415 on missing/wrong Content-Type, 403 on Origin mismatch.
export function checkCsrf(request: NextRequest): CsrfCheckResult {
  const contentType = request.headers.get("content-type");
  if (!contentType) {
    return { ok: false, reason: "missing_content_type" };
  }
  // Parse media type before parameters; require exact application/json.
  // Rejects application/jsonp and other prefix collisions.
  const mediaType = contentType.split(";")[0]!.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return { ok: false, reason: "wrong_content_type", detail: contentType };
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  let candidate = origin;
  if (!candidate && referer) {
    try {
      candidate = new URL(referer).origin;
    } catch {
      candidate = null;
    }
  }
  if (!candidate) {
    return { ok: false, reason: "missing_origin_and_referer" };
  }

  if (!isOriginAllowed(candidate, request)) {
    return { ok: false, reason: "origin_mismatch", detail: candidate };
  }

  return { ok: true };
}
