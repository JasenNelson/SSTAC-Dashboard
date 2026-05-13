// engine_v2 frontend Lane 2d / Phase D: Ollama /api/tags probe cache.
//
// Both the POST chat route and the GET /chat/models route need to know
// which models Ollama has loaded. Without a cache, every chat request
// hits /api/tags first, which spams the local engine. This helper
// memoizes the probe for 30s in-process.
//
// Resilience: on a transient probe failure, the cache returns the
// previous (possibly stale) tag list rather than empty, so a brief
// Ollama hiccup does not down the chat surface. On a permanent failure
// with no prior probe, returns [].
//
// Tests reset the cache via __resetOllamaTagsCache().
//
// ASCII only.

import { getOllamaBaseUrl } from "@/lib/ollama/model-registry";

interface CachedTags {
  tags: string[];
  expiresAt: number;
}

let cached: CachedTags | null = null;

export const OLLAMA_TAGS_TTL_MS = 30_000;
export const OLLAMA_TAGS_PROBE_TIMEOUT_MS = 5_000;

interface RawTagsResponse {
  models?: Array<{ name: string }>;
}

/**
 * Fetch /api/tags from Ollama with a 30s in-process cache. On probe
 * failure, returns the previous cached value if any (does not clear);
 * if no prior value exists, returns [].
 */
export async function getOllamaTags(): Promise<string[]> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.tags;
  }
  try {
    const resp = await fetch(`${getOllamaBaseUrl()}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(OLLAMA_TAGS_PROBE_TIMEOUT_MS),
    });
    if (!resp.ok) {
      // Surface stale-on-failure: keep previous cache value if any.
      return cached?.tags ?? [];
    }
    const data = (await resp.json()) as RawTagsResponse;
    const tags = (data.models ?? [])
      .map((m) => m.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0);
    cached = { tags, expiresAt: now + OLLAMA_TAGS_TTL_MS };
    return tags;
  } catch {
    // Network error / timeout. Stale-on-failure.
    return cached?.tags ?? [];
  }
}

/** Test helper: clear the in-process cache between cases. */
export function __resetOllamaTagsCache(): void {
  cached = null;
}
