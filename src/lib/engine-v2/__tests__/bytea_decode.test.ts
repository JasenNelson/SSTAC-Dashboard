// Regression guard for Lane 2b memo export docx corruption (2026-05-12).
//
// The original L2b-6 route stored docx bytes in a BYTEA column by passing a
// Node Buffer to supabase-js .insert(), which JSON-serialized it into an
// object PostgreSQL could not parse as BYTEA, corrupting the stored bytes.
// The GET handler then fell through to a base64 decode branch that silently
// produced garbage. End-user symptom: Word refused to open the downloaded
// .docx and Notepad++ showed gibberish.
//
// This test pins:
//   - encodeByteaHex round-trips raw bytes through Postgres `\x<hex>` form.
//   - decodeSupabaseBytea handles the three wire shapes we expect AND rejects
//     anything else loudly rather than silently corrupting binary data.

import { describe, it, expect } from "vitest";

import {
  decodeSupabaseBytea,
  encodeByteaHex,
} from "../bytea_codec";

describe("encodeByteaHex", () => {
  it("emits the PostgreSQL `\\x<hex>` literal form for a Node Buffer", () => {
    const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // ZIP/.docx magic
    expect(encodeByteaHex(buf)).toBe("\\x504b0304");
  });

  it("accepts a Uint8Array and produces identical output", () => {
    const u8 = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    expect(encodeByteaHex(u8)).toBe("\\x504b0304");
  });

  it("emits `\\x` for empty input", () => {
    expect(encodeByteaHex(Buffer.alloc(0))).toBe("\\x");
  });

  it("preserves the full byte range 0x00..0xff", () => {
    const all = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) all[i] = i;
    const encoded = encodeByteaHex(all);
    expect(encoded.startsWith("\\x")).toBe(true);
    expect(encoded.slice(2).length).toBe(512);
    // Round-trip through the decoder for symmetry.
    const decoded = decodeSupabaseBytea(encoded)!;
    expect(decoded.length).toBe(256);
    expect(Buffer.compare(decoded, all)).toBe(0);
  });
});

describe("decodeSupabaseBytea", () => {
  it("returns null for null/undefined", () => {
    expect(decodeSupabaseBytea(null)).toBeNull();
    expect(decodeSupabaseBytea(undefined)).toBeNull();
  });

  it("decodes the PostgREST `\\x<hex>` string form", () => {
    const out = decodeSupabaseBytea("\\x504b0304deadbeef");
    expect(out).not.toBeNull();
    expect(Buffer.compare(out!, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xde, 0xad, 0xbe, 0xef]))).toBe(0);
  });

  it("decodes a bare hex string (no leading `\\x`) when even-length and pure hex", () => {
    const out = decodeSupabaseBytea("504b0304");
    expect(Buffer.compare(out!, Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(0);
  });

  it("passes through a Node Buffer untouched", () => {
    const buf = Buffer.from([1, 2, 3]);
    const out = decodeSupabaseBytea(buf);
    expect(out).toBe(buf);
  });

  it("converts a Uint8Array into a Buffer with identical bytes", () => {
    const u8 = new Uint8Array([1, 2, 3]);
    const out = decodeSupabaseBytea(u8);
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(Buffer.compare(out!, Buffer.from([1, 2, 3]))).toBe(0);
  });

  it("decodes the Buffer.toJSON() shape `{type:'Buffer', data:[...]}`", () => {
    const payload = { type: "Buffer", data: [0x50, 0x4b, 0x03, 0x04] };
    const out = decodeSupabaseBytea(payload);
    expect(Buffer.compare(out!, Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(0);
  });

  it("throws on a Buffer.toJSON() shape containing non-byte entries", () => {
    expect(() =>
      decodeSupabaseBytea({ type: "Buffer", data: [0, 999, 1] }),
    ).toThrow(/invalid_buffer_json/);
    expect(() =>
      decodeSupabaseBytea({ type: "Buffer", data: [0, -1, 1] }),
    ).toThrow(/invalid_buffer_json/);
    expect(() =>
      decodeSupabaseBytea({ type: "Buffer", data: [0, 1.5, 1] }),
    ).toThrow(/invalid_buffer_json/);
  });

  it("throws on `\\x<not-hex>` rather than silently corrupting", () => {
    expect(() => decodeSupabaseBytea("\\xZZZZ")).toThrow(/invalid_hex/);
  });

  it("throws on an unrecognized string format rather than guessing", () => {
    // Looks like base64 but is not a valid bytea wire form. The original
    // route fell through to a base64 decode here, silently producing
    // wrong bytes -- that was the root cause of the docx corruption.
    expect(() => decodeSupabaseBytea("hello world")).toThrow(
      /unrecognized_string_format/,
    );
  });

  it("throws on an arbitrary object shape (not Buffer.toJSON())", () => {
    expect(() => decodeSupabaseBytea({ random: "thing" })).toThrow(
      /unsupported_shape/,
    );
  });

  it("throws on numbers / booleans / other primitives", () => {
    expect(() => decodeSupabaseBytea(42)).toThrow(/unsupported_shape/);
    expect(() => decodeSupabaseBytea(true)).toThrow(/unsupported_shape/);
  });
});

describe("encode/decode round-trip (docx-shaped payload)", () => {
  it("preserves a realistic .docx-like ZIP header + payload exactly", () => {
    // Plausible ZIP/.docx magic + central-directory marker scaffold + random
    // body. We exercise the full Postgres BYTEA round trip the L2b-6 route
    // performs: builder bytes -> hex string -> stored in BYTEA -> read back
    // as the same hex string -> decoded back to bytes.
    const payload = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00]),
      Buffer.from(
        "fake docx content with some non-ascii bytes \x00\x01\xff\xfe",
        "binary",
      ),
      Buffer.from([0x50, 0x4b, 0x05, 0x06]), // end-of-central-directory
    ]);
    const wire = encodeByteaHex(payload);
    expect(wire.startsWith("\\x")).toBe(true);

    const decoded = decodeSupabaseBytea(wire);
    expect(decoded).not.toBeNull();
    expect(decoded!.byteLength).toBe(payload.byteLength);
    expect(Buffer.compare(decoded!, payload)).toBe(0);
  });
});
