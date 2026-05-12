// engine_v2 frontend Lane 1: filename safety (Findings 12, 78).
// L1-1 foundation utility consumed by Zod boundary validators and /files/complete.
// Moved from L1-3 per Finding 78 to resolve cross-module test-ownership ambiguity.

const RESERVED_WINDOWS_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);

const MAX_UTF8_BYTES = 255;

export interface FilenameSafetyResult {
  ok: boolean;
  reason?:
    | "empty"
    | "path_separator"
    | "control_char"
    | "null_byte"
    | "too_long_utf8"
    | "dotdot"
    | "reserved_windows_name";
  normalized?: string; // NFC-normalized original on success
}

// Validates a user-supplied filename against the Lane 1 safety rules.
// Returns the NFC-normalized form on success; returns a structured reason on rejection.
// Server stores normalized form in v2_submission_files.original_filename verbatim.
// Storage path uses safe scheme `<user_id>/<project_id>/<file_id>/<file_id>.<ext>` separately.
export function validateFilename(input: string): FilenameSafetyResult {
  if (typeof input !== "string" || input.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const normalized = input.normalize("NFC"); // Finding 12

  // Path separators (POSIX + Windows).
  if (normalized.includes("/") || normalized.includes("\\")) {
    return { ok: false, reason: "path_separator" };
  }

  // Control chars 0x00-0x1f and 0x7f.
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code === 0x00) {
      return { ok: false, reason: "null_byte" };
    }
    if ((code >= 0x00 && code <= 0x1f) || code === 0x7f) {
      return { ok: false, reason: "control_char" };
    }
  }

  // Length: 255 UTF-8 bytes (Finding 12; NOT .length which counts UTF-16 code units).
  if (Buffer.byteLength(normalized, "utf8") > MAX_UTF8_BYTES) {
    return { ok: false, reason: "too_long_utf8" };
  }

  // ".." substring (any position).
  if (normalized.includes("..")) {
    return { ok: false, reason: "dotdot" };
  }

  // Reserved Windows names (case-insensitive; also matches "con.pdf").
  const lower = normalized.toLowerCase();
  const baseName = lower.split(".")[0]!; // before first dot
  if (RESERVED_WINDOWS_NAMES.has(baseName)) {
    return { ok: false, reason: "reserved_windows_name" };
  }

  return { ok: true, normalized };
}
