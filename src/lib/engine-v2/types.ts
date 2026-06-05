// engine_v2 frontend Lane 1: TypeScript types.
// Mirrors database/Zod boundaries. See plan v7.19.

export type ExtractionStatus =
  | "pending"
  | "extracting"
  | "completed"
  | "completed_with_errors"
  | "error";

export const TERMINAL_EXTRACTION_STATUSES: readonly ExtractionStatus[] = [
  "completed",
  "completed_with_errors",
  "error",
] as const;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// Row shapes (mirror v2_* tables).

export interface V2Project {
  id: string;
  user_id: string;
  name: string;
  application_types: unknown[];
  selected_services: unknown[];
  media_types: unknown[];
  // HITL-CONFIRMED applicable-policy id list (engine v2 M1a Phase 2).
  // The engine PROPOSES candidates; the reviewer confirms/edits (M1b wizard);
  // the confirmed set becomes the evaluator cohort verbatim (S14 invariant).
  // [] = not yet confirmed.
  applicable_policy_ids: unknown[];
  submission_context_overrides: Record<string, unknown>;
  applicability_mode: string;
  evaluation_backend: string;
  embedder_backend: string;
  reranker_backend: string;
  model: string | null;
  max_files: number;
  max_total_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface V2SubmissionFile {
  id: string; // TUS client-supplied file_id (Finding 58)
  project_id: string;
  original_filename: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string;
  sha256: string;
  uploaded_at: string;
  deleted_at: string | null;
}

export interface V2ExtractionRun {
  id: string;
  project_id: string;
  status: ExtractionStatus;
  total_files: number;
  completed_files: number;
  current_file: string | null;
  progress: number;
  errors: string[]; // JSONB array of strings only
  chunk_progress: string | null;
  updated_at: string;
  started_at: string;
  completed_at: string | null;
}

// Extraction status JSON shape (mirrors dashboard_extract.py output).

export interface ExtractionStatusJson {
  status: ExtractionStatus;
  totalFiles: number;
  completedFiles: number;
  currentFile: string;
  progress: number;
  errors: string[];
  updatedAt: string;
  chunkProgress?: string;
}

// /files/complete universal error response schema (Findings 99, 105).
// Every non-2xx body MUST include `orphan_cleanup_required: boolean`.

export interface FileCompleteErrorBody {
  error: string;
  orphan_cleanup_required: boolean;
  [key: string]: unknown;
}

// /files/orphan response shapes.

export interface OrphanCleanupOkBody {
  deleted: true;
}

export interface OrphanCleanupConflictBody {
  error: "already_finalized";
  file_id: string;
  storage_path: string;
}

export interface OrphanCleanupErrorBody {
  error: string;
  detail?: string;
}

// /files/exists response (Finding 60).

export interface FileExistsOkBody {
  exists: true;
  file: V2SubmissionFile;
}

// storage_safe_delete helper result (Findings 69, 73, 74).

export interface DeleteUnfinalizedStorageObjectResult {
  deleted: boolean;
  reason?:
    | "finalized_row_references_path"
    | `guard_query_error:${string}`
    | `storage_error:${string}`;
}

// quarantineUploadsDir helper result (Findings 38, 49, 54).

export interface QuarantineUploadsDirResult {
  moved: boolean;
  reason?: "source_missing";
  targetPath?: string;
}
