// engine_v2 frontend Lane 2d / Phase B Round 2 (v0.5 BLOCKER 1 fix):
// service-role Supabase client helper for server-side writes that must
// bypass RLS.
//
// Why this exists:
//   The Phase B submission chunks indexer writes to v2_submission_chunks,
//   v2_chunk_policy_citations, and v2_submission_chunks_indexing_status.
//   Their migrations expose ONLY service-role writes (no end-user
//   INSERT/UPDATE/DELETE policy). The authenticated user (admin) client
//   used by route handlers can only SELECT from these tables. Indexer
//   writes therefore require a service-role client.
//
// Constraints:
//   - Server-only. NEVER import from a client component (the service-role
//     key is a server secret and must never reach the browser bundle).
//   - The helper instantiates a fresh client each call (no module-scope
//     singleton) so tests can mock-replace the @supabase/supabase-js
//     factory deterministically. Supabase JS clients are cheap to create.
//   - Throws a typed error when SUPABASE_SERVICE_ROLE_KEY is not in env.
//     Production builds without this env var will fail loudly at first
//     indexer invocation rather than silently dropping writes.
//
// Read pattern: callers use this helper for ALL writes against the three
// new Phase B tables. Reads (ownership probes, raw envelope fetches)
// stay on the authenticated user client so RLS continues to enforce
// project ownership.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class ServiceRoleConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceRoleConfigError";
  }
}

// Construct a service-role Supabase client. Bypasses RLS by virtue of the
// service-role JWT; therefore CALLERS MUST gate their own auth (this
// helper trusts the caller). The auth.persistSession=false /
// autoRefreshToken=false flags prevent the SDK from trying to write to
// browser storage in environments where it would be ambient.
export function getServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new ServiceRoleConfigError(
      "service_role_client_missing_url: NEXT_PUBLIC_SUPABASE_URL not set",
    );
  }
  if (!key) {
    throw new ServiceRoleConfigError(
      "service_role_client_missing_key: SUPABASE_SERVICE_ROLE_KEY not set",
    );
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
