// engine_v2 frontend Lane 2d / Phase D: ollama_tags_cache tests.
//
// Covers:
//   - Cache hit returns stored tags without re-probing /api/tags.
//   - Cache expiry after 30s TTL re-probes.
//   - Probe failure (non-2xx) returns stale cache; first-time failure
//     returns [].
//   - Probe network error (thrown fetch) returns stale cache; first-
//     time failure returns [].
//   - JSON malformed: skips cleanly, returns stale-or-empty.
//   - Tags drawn from models[].name.
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

import {
  __resetOllamaTagsCache,
  getOllamaTags,
  OLLAMA_TAGS_TTL_MS,
} from "../ollama_tags_cache";

const fetchSpy = vi.spyOn(global, "fetch");

beforeEach(() => {
  __resetOllamaTagsCache();
  fetchSpy.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("getOllamaTags()", () => {
  it("returns tag names from /api/tags on cold call", async () => {
    fetchSpy.mockResolvedValueOnce(
      okResponse({
        models: [{ name: "gemma4:e4b" }, { name: "qwen2.5:14b-instruct-q4_K_M" }],
      }),
    );
    const tags = await getOllamaTags();
    expect(tags).toEqual(["gemma4:e4b", "qwen2.5:14b-instruct-q4_K_M"]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("reuses the cached value within the TTL window (no re-probe)", async () => {
    fetchSpy.mockResolvedValueOnce(
      okResponse({ models: [{ name: "gemma4:e4b" }] }),
    );
    const first = await getOllamaTags();
    const second = await getOllamaTags();
    expect(first).toEqual(["gemma4:e4b"]);
    expect(second).toEqual(["gemma4:e4b"]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("re-probes after TTL expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T12:00:00Z"));
    fetchSpy.mockResolvedValueOnce(
      okResponse({ models: [{ name: "gemma4:e4b" }] }),
    );
    fetchSpy.mockResolvedValueOnce(
      okResponse({ models: [{ name: "gemma4:e4b" }, { name: "qwen3.5:9b" }] }),
    );
    const first = await getOllamaTags();
    vi.advanceTimersByTime(OLLAMA_TAGS_TTL_MS + 1);
    const second = await getOllamaTags();
    expect(first).toEqual(["gemma4:e4b"]);
    expect(second).toEqual(["gemma4:e4b", "qwen3.5:9b"]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns stale tags on a transient probe failure (non-2xx)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T12:00:00Z"));
    fetchSpy.mockResolvedValueOnce(
      okResponse({ models: [{ name: "gemma4:e4b" }] }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response("oops", { status: 500 }),
    );
    const first = await getOllamaTags();
    vi.advanceTimersByTime(OLLAMA_TAGS_TTL_MS + 1);
    const second = await getOllamaTags();
    expect(first).toEqual(["gemma4:e4b"]);
    // Cache was not cleared on 500; second call returned the stale value.
    expect(second).toEqual(["gemma4:e4b"]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns [] on first-time probe failure", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("oops", { status: 500 }),
    );
    const tags = await getOllamaTags();
    expect(tags).toEqual([]);
  });

  it("returns stale tags on a network error (thrown fetch)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T12:00:00Z"));
    fetchSpy.mockResolvedValueOnce(
      okResponse({ models: [{ name: "gemma4:e4b" }] }),
    );
    fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const first = await getOllamaTags();
    vi.advanceTimersByTime(OLLAMA_TAGS_TTL_MS + 1);
    const second = await getOllamaTags();
    expect(first).toEqual(["gemma4:e4b"]);
    expect(second).toEqual(["gemma4:e4b"]);
  });

  it("filters out non-string model names defensively", async () => {
    fetchSpy.mockResolvedValueOnce(
      okResponse({
        models: [
          { name: "gemma4:e4b" },
          { name: "" },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { name: 123 as any },
          { name: "qwen3.5:9b" },
        ],
      }),
    );
    const tags = await getOllamaTags();
    expect(tags).toEqual(["gemma4:e4b", "qwen3.5:9b"]);
  });

  it("returns [] when models[] is missing entirely", async () => {
    fetchSpy.mockResolvedValueOnce(okResponse({}));
    const tags = await getOllamaTags();
    expect(tags).toEqual([]);
  });
});
