// engine_v2 frontend Lane 1: defensive parser for .extraction_status.json (Findings 17, 43).
//
// dashboard_extract.py writes JSON of shape ExtractionStatusJson; chunkProgress is a scalar
// string (Finding 17 verified against dashboard_extract.py:48), errors is an array of strings
// only. This parser is intentionally permissive: a malformed file MUST NOT crash the status
// route; instead, return a sentinel Partial that the route can map to status='error'.
//
// Returns a Partial<ExtractionStatusJson> so the route can merge fields onto the DB row
// without assuming every field is present.

import type { ExtractionStatus, ExtractionStatusJson } from "./types";

const STATUS_VALUES: readonly ExtractionStatus[] = [
  "pending",
  "extracting",
  "completed",
  "completed_with_errors",
  "error",
] as const;

function isStatus(v: unknown): v is ExtractionStatus {
  return typeof v === "string" && (STATUS_VALUES as readonly string[]).includes(v);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v >= 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((e) => typeof e === "string");
}

// Defensive parse of the status JSON file contents. Contract:
// - null input -> empty Partial (caller treats as "missing/empty").
// - non-JSON / JSON parse error -> sentinel `{status: 'error', errors: ['status_json_parse_error']}`.
// - otherwise: every well-typed field is copied; ill-typed fields are dropped.
//
// chunkProgress is enforced as a scalar string (Finding 17). errors must be string[]
// (Finding 45 / status JSON shape parity).
export function parseStatusJson(
  rawJson: string | null,
): Partial<ExtractionStatusJson> {
  if (rawJson === null) {
    return {};
  }

  let obj: unknown;
  try {
    obj = JSON.parse(rawJson);
  } catch {
    return { status: "error", errors: ["status_json_parse_error"] };
  }

  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return { status: "error", errors: ["status_json_parse_error"] };
  }

  const src = obj as Record<string, unknown>;
  const out: Partial<ExtractionStatusJson> = {};

  if (isStatus(src.status)) {
    out.status = src.status;
  }
  if (isNonNegativeInt(src.totalFiles)) {
    out.totalFiles = src.totalFiles;
  }
  if (isNonNegativeInt(src.completedFiles)) {
    out.completedFiles = src.completedFiles;
  }
  if (isString(src.currentFile)) {
    out.currentFile = src.currentFile;
  }
  if (
    typeof src.progress === "number" &&
    Number.isFinite(src.progress) &&
    src.progress >= 0 &&
    src.progress <= 100
  ) {
    out.progress = src.progress;
  }
  if (isStringArray(src.errors)) {
    out.errors = src.errors;
  }
  if (isString(src.updatedAt)) {
    out.updatedAt = src.updatedAt;
  }
  // chunkProgress: scalar string only (Finding 17). Drop if any other type.
  if (isString(src.chunkProgress)) {
    out.chunkProgress = src.chunkProgress;
  }

  return out;
}
