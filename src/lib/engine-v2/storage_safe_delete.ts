// engine_v2 frontend Lane 1: safe Storage delete helper (Findings 69, 73, 74).
//
// Universal guard for ALL Storage DELETE paths in /files/complete and /files/orphan.
// Refuses to DELETE any Storage object that an active v2_submission_files row references.
// FAILS CLOSED on guard-query error (Finding 74 BLOCKER closure): if the SELECT errors,
// do NOT proceed to delete -- return guard_query_error so callers can decide to retry or skip.
//
// Used by /files/complete (magic-mismatch, cap-preflight, 23505 cleanup, 23514 cleanup)
// AND /files/orphan. Callers MUST inspect the return value and handle the three failure
// reasons (`guard_query_error:*`, `finalized_row_references_path`, `storage_error:*`)
// without proceeding as if the object was deleted.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeleteUnfinalizedStorageObjectResult } from "./types";

const BUCKET = "v2-submissions";

export async function deleteUnfinalizedStorageObject(
  supabase: SupabaseClient,
  expectedPath: string,
): Promise<DeleteUnfinalizedStorageObjectResult> {
  const { data: row, error: guardErr } = await supabase
    .from("v2_submission_files")
    .select("id, storage_path")
    .eq("storage_path", expectedPath)
    .is("deleted_at", null)
    .maybeSingle();

  if (guardErr) {
    // Fail closed: do not delete when we cannot verify finalization status.
    return {
      deleted: false,
      reason: `guard_query_error:${guardErr.message}` as DeleteUnfinalizedStorageObjectResult["reason"],
    };
  }

  if (row) {
    return { deleted: false, reason: "finalized_row_references_path" };
  }

  const { error: removeErr } = await supabase.storage.from(BUCKET).remove([expectedPath]);
  if (removeErr) {
    return {
      deleted: false,
      reason: `storage_error:${removeErr.message}` as DeleteUnfinalizedStorageObjectResult["reason"],
    };
  }

  return { deleted: true };
}
