import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";
import { computeStreamingSha256AndMagic } from "../streaming_sha256";

// Build a ReadableStream<Uint8Array> from an array of Uint8Array chunks.
function chunkStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i]!);
        i++;
      } else {
        controller.close();
      }
    },
  });
}

function shaOf(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

const origFetch = globalThis.fetch;

describe("computeStreamingSha256AndMagic (Findings 21, 29, 36)", () => {
  beforeEach(() => {
    // installed per test
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("computes SHA256 of a known fixture", async () => {
    const fixture = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x0a]);
    const expected = shaOf(fixture);
    globalThis.fetch = vi.fn(async () =>
      new Response(chunkStream([fixture]), { status: 200 }),
    ) as unknown as typeof fetch;
    const r = await computeStreamingSha256AndMagic("https://example.test/object");
    expect(r.sha256).toBe(expected);
    expect(Array.from(r.firstBytes.slice(0, 5))).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
  });

  it("captures first 8 bytes correctly when first chunk is 1 byte each", async () => {
    const bytes = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x01, 0x02];
    const chunks = bytes.map((b) => new Uint8Array([b]));
    globalThis.fetch = vi.fn(async () =>
      new Response(chunkStream(chunks), { status: 200 }),
    ) as unknown as typeof fetch;
    const r = await computeStreamingSha256AndMagic("https://example.test/object");
    expect(Array.from(r.firstBytes)).toEqual([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
    ]);
    expect(r.firstBytes.length).toBe(8);
  });

  it("detects PDF magic (25 50 44 46 2d)", async () => {
    const data = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0xff,
    ]);
    globalThis.fetch = vi.fn(async () =>
      new Response(chunkStream([data]), { status: 200 }),
    ) as unknown as typeof fetch;
    const r = await computeStreamingSha256AndMagic("https://example.test/obj");
    expect(Array.from(r.firstBytes.slice(0, 5))).toEqual([
      0x25, 0x50, 0x44, 0x46, 0x2d,
    ]);
  });

  it("detects DOCX magic (50 4b 03 04)", async () => {
    const data = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00,
    ]);
    globalThis.fetch = vi.fn(async () =>
      new Response(chunkStream([data]), { status: 200 }),
    ) as unknown as typeof fetch;
    const r = await computeStreamingSha256AndMagic("https://example.test/obj");
    expect(Array.from(r.firstBytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("detects DOC magic (d0 cf 11 e0 a1 b1 1a e1)", async () => {
    const data = new Uint8Array([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00,
    ]);
    globalThis.fetch = vi.fn(async () =>
      new Response(chunkStream([data]), { status: 200 }),
    ) as unknown as typeof fetch;
    const r = await computeStreamingSha256AndMagic("https://example.test/obj");
    expect(Array.from(r.firstBytes)).toEqual([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
    ]);
  });

  it("returns firstBytes shorter than 8 on truncated stream", async () => {
    const data = new Uint8Array([0x25, 0x50, 0x44]);
    globalThis.fetch = vi.fn(async () =>
      new Response(chunkStream([data]), { status: 200 }),
    ) as unknown as typeof fetch;
    const r = await computeStreamingSha256AndMagic("https://example.test/obj");
    expect(r.firstBytes.length).toBeLessThan(8);
  });

  it("throws on non-2xx fetch", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("nope", { status: 500, statusText: "Server Error" }),
    ) as unknown as typeof fetch;
    await expect(
      computeStreamingSha256AndMagic("https://example.test/obj"),
    ).rejects.toThrow(/streaming_sha_fetch_failed/);
  });

  it("does not mask a release-lock throw with original error", async () => {
    // Simulate a ReadableStream whose reader.releaseLock() throws.
    const data = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0x00, 0x00]);
    const realStream = chunkStream([data]);
    const realReader = realStream.getReader();
    const wrapped: ReadableStream<Uint8Array> = {
      ...realStream,
      getReader() {
        return {
          ...realReader,
          read: () => realReader.read(),
          releaseLock() {
            throw new Error("forced_release_lock_failure");
          },
          cancel: realReader.cancel.bind(realReader),
        } as unknown as ReadableStreamDefaultReader<Uint8Array>;
      },
    } as ReadableStream<Uint8Array>;
    globalThis.fetch = vi.fn(async () =>
      new Response(wrapped as ReadableStream<Uint8Array>, { status: 200 }),
    ) as unknown as typeof fetch;
    // Should NOT throw despite releaseLock failing.
    const r = await computeStreamingSha256AndMagic("https://example.test/obj");
    expect(r.firstBytes.length).toBe(8);
  });
});
