// Lane 2b / Module L2b-6 bugfix: Supabase JS <-> PostgreSQL BYTEA codec.
//
// Background
// ----------
// The L2b-6 memo route stores generated .docx bytes in
// v2_memo_exports.content_blob (PostgreSQL BYTEA). Going through the Supabase
// JS client (which speaks PostgREST/JSON), binary data cannot ride the wire
// as raw bytes -- everything is JSON. Two failure modes have bitten us:
//
// 1) Insert side: passing a Node `Buffer` (or `Uint8Array`) to
//    supabase-js `.insert({content_blob: buf})` lets JSON.stringify turn it
//    into either `{"type":"Buffer","data":[...]}` (Node Buffer) or
//    `{"0":..,"1":..,...}` (Uint8Array). Neither is a valid BYTEA literal,
//    so Postgres either rejects the row or stores garbage.
//
// 2) Read side: PostgreSQL's default `bytea_output = hex` makes PostgREST
//    return BYTEA columns as a JSON string of the form `\x<hex>` (e.g.
//    `"\\x504b0304..."`). The legacy decoder optimistically fell through
//    to a `Buffer.from(raw, "base64")` branch when the prefix didn't match,
//    which silently corrupts non-base64 input. It also did not handle the
//    Buffer-shaped JSON object some clients still emit.
//
// Fix
// ---
// Round-trip BYTEA as a hex-escape string: `encodeByteaHex(bytes)` on the
// insert side, `decodeSupabaseBytea(raw)` on the read side. Postgres parses
// `\x<hex>` literals natively as BYTEA, so this is the canonical PostgREST
// representation.
//
// This module is exhaustively unit-tested in
// `__tests__/bytea_decode.test.ts` (regression guard for the docx download
// corruption observed on 2026-05-12).

const HEX_RE = /^[0-9a-fA-F]*$/;

/**
 * Encode a byte buffer for storage in a PostgreSQL BYTEA column over the
 * Supabase JS / PostgREST wire (JSON). Produces a `\x<hex>` literal which
 * Postgres parses natively as BYTEA.
 */
export function encodeByteaHex(bytes: Buffer | Uint8Array): string {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return `\\x${buf.toString("hex")}`;
}

/**
 * Decode the shape supabase-js returns for a BYTEA column. Handles the three
 * forms we have observed in the wild:
 *
 *   1. `"\x<hex>"`     -- PostgREST default `bytea_output = hex` (most common)
 *   2. `Buffer` / `Uint8Array` -- direct binary (some adapters / mocked tests)
 *   3. `{type:"Buffer", data:[...]}` -- Buffer.toJSON() output, if a
 *      serializer round-tripped through JSON without our encoder
 *
 * Returns null for null/undefined input. Throws on any other shape so a
 * regression surfaces as an explicit 500 rather than silent corruption.
 */
export function decodeSupabaseBytea(raw: unknown): Buffer | null {
  if (raw === null || raw === undefined) return null;

  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw);

  if (typeof raw === "string") {
    // PostgREST hex form: leading "\x" then hex digits. In a JS string the
    // two-character escape `"\\x"` is the literal backslash + x.
    if (raw.startsWith("\\x")) {
      const hex = raw.slice(2);
      if (!HEX_RE.test(hex)) {
        throw new Error("bytea_decode_invalid_hex");
      }
      return Buffer.from(hex, "hex");
    }
    // Some clients strip the leading "\x" but still hand back a hex string.
    if (HEX_RE.test(raw) && raw.length % 2 === 0 && raw.length > 0) {
      return Buffer.from(raw, "hex");
    }
    throw new Error("bytea_decode_unrecognized_string_format");
  }

  if (typeof raw === "object") {
    const obj = raw as { type?: unknown; data?: unknown };
    if (obj.type === "Buffer" && Array.isArray(obj.data)) {
      // Buffer.toJSON() output. Validate each entry is a byte.
      const arr = obj.data as unknown[];
      for (const v of arr) {
        if (typeof v !== "number" || v < 0 || v > 255 || !Number.isInteger(v)) {
          throw new Error("bytea_decode_invalid_buffer_json");
        }
      }
      return Buffer.from(arr as number[]);
    }
  }

  throw new Error("bytea_decode_unsupported_shape");
}
