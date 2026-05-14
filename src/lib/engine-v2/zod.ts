// engine_v2 frontend Lane 1: Zod schemas at API boundaries.
// Structural validation only; filename deep safety lives in filename_safety.ts (also L1-1).

import { z } from "zod";
import { ALLOWED_MIME_TYPES } from "./types";

const uuid = z.string().uuid();

// ProjectCreatePayload (POST /api/engine-v2/projects).
// Finding 81: NO max_files / max_total_bytes overrides in Lane 1; defaults always used.
// .strict() rejects arbitrary extra keys -- no legitimate client use case per Finding 81.
export const ProjectCreatePayloadSchema = z.object({
  name: z.string().min(1).max(255),
  application_types: z.array(z.unknown()).default([]),
  selected_services: z.array(z.unknown()).default([]),
  media_types: z.array(z.unknown()).default([]),
  submission_context_overrides: z.record(z.string(), z.unknown()).default({}),
  model: z.string().nullable().optional(),
}).strict();
export type ProjectCreatePayload = z.infer<typeof ProjectCreatePayloadSchema>;

// FileCompletePayload (POST /api/engine-v2/files/complete).
// NO client-claimed SHA256: server computes via streaming hash (Finding 2, 29).
// file_id is the TUS client-supplied UUID; persisted as v2_submission_files.id (Finding 58).
// .strict() rejects arbitrary extra keys (e.g., client-supplied sha256) -- Finding 2.
export const FileCompletePayloadSchema = z.object({
  project_id: uuid,
  file_id: uuid,
  original_filename: z.string().min(1).max(1024), // deep filename safety in filename_safety.ts
  size_bytes: z.number().int().nonnegative(),
  content_type: z.enum(ALLOWED_MIME_TYPES),
}).strict();
export type FileCompletePayload = z.infer<typeof FileCompletePayloadSchema>;

// OrphanCleanupPayload (POST /api/engine-v2/files/orphan).
// NO client-supplied storage_path; server derives from {user_id, project_id, file_id}.
// .strict() rejects extra keys (e.g., client-supplied storage_path) -- server derives it.
export const OrphanCleanupPayloadSchema = z.object({
  project_id: uuid,
  file_id: uuid,
}).strict();
export type OrphanCleanupPayload = z.infer<typeof OrphanCleanupPayloadSchema>;

// ExtractStatusSyncPayload (POST /api/engine-v2/projects/[id]/extract-status, Finding 37).
// .strict() rejects extra keys -- the body carries only run_id per Finding 37 spec.
export const ExtractStatusSyncPayloadSchema = z.object({
  run_id: uuid,
}).strict();
export type ExtractStatusSyncPayload = z.infer<typeof ExtractStatusSyncPayloadSchema>;

// FileExistsQuery (GET /api/engine-v2/files/exists, Finding 60).
// Query params arrive as strings; UUID validation enforces shape.
export const FileExistsQuerySchema = z.object({
  project_id: uuid,
  file_id: uuid,
});
export type FileExistsQuery = z.infer<typeof FileExistsQuerySchema>;

// ExtractionStatusUpsert: shape of the JSON status file written by dashboard_extract.py.
// Used by L1-6 status_parsing.ts. All 5 status values; chunkProgress is a scalar string per
// Finding 17 verification against dashboard_extract.py:48.
export const ExtractionStatusUpsertSchema = z.object({
  status: z.enum([
    "pending",
    "extracting",
    "completed",
    "completed_with_errors",
    "error",
  ]),
  totalFiles: z.number().int().nonnegative(),
  completedFiles: z.number().int().nonnegative(),
  currentFile: z.string(),
  progress: z.number().int().min(0).max(100),
  errors: z.array(z.string()),
  updatedAt: z.string(),
  chunkProgress: z.string().optional(),
});
export type ExtractionStatusUpsert = z.infer<typeof ExtractionStatusUpsertSchema>;
