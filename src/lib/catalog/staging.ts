'use server';

/**
 * Server-side helpers for the catalog_extraction_staging HITL approval queue.
 *
 * The Catalog Extraction Agent (scripts/catalog-overnight/) writes proposed
 * catalog rows here via service_role. This module is the HITL approval
 * surface: admins / matrix_admins read the queue, then promote (insert into
 * production table) or reject. The agent never calls these helpers.
 *
 * Pattern decisions:
 *
 *   - Read helpers (listPendingStagingRows) return a safe fallback ([] on any
 *     error, including missing table / missing auth) -- consistent with the
 *     existing qa-review-sync.ts / evidence-sync.ts pattern in this codebase.
 *
 *   - Write helpers (approveStagingRow, rejectStagingRow, markSupersededStagingRows)
 *     THROW on auth/validation failure. This is a deliberate departure from the
 *     fallback-only pattern because HITL actions are explicit human verdicts;
 *     silent fallback would mask bugs (an admin clicks "approve" and nothing
 *     happens, with no UI signal). The CatalogStagingReview UI catches these
 *     throws and surfaces them in the toast layer.
 *
 *   - All write helpers call the structured logger (src/lib/logger.ts) so
 *     production observability captures admin actions in JSON form.
 *
 *   - The target production tables and the columns the agent payload should
 *     map to:
 *       proposed_kind = 'parameter_value' -> promoted_parameter_values
 *       proposed_kind = 'evidence_item'   -> catalog_evidence_items
 *       proposed_kind = 'source_lead'     -> source_lead_triage
 *
 *   - The agent is responsible for producing proposed_payload shapes that
 *     match the target table's column shape. Mismatch surfaces as a Supabase
 *     error from the INSERT, which is propagated to the caller.
 *
 * Authored 2026-05-27 by Stream D autonomous session (Opus 4.7); part of
 * the catalog extraction agent scaffold (Stream D sub-track D.2). See
 * docs/STREAM_D_AUTONOMOUS_AGENT.md for the end-to-end architecture.
 */

import { createAuthenticatedClient } from '@/lib/supabase-auth';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ProposedKind = 'parameter_value' | 'evidence_item' | 'source_lead';

export type StagingHitlStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'superseded';

/**
 * Mirror of the catalog_extraction_staging row shape -- public API.
 *
 * Server-side selects strip null-defaulted columns; we expose the
 * application-level type with empty-string defaults to match the UI's
 * expectations.
 */
export interface CatalogStagingRow {
  id: string;
  source_zotero_key: string;
  source_attachment_path: string | null;
  extraction_pass_id: string;
  extraction_pass_started_at: string;
  extraction_pass_finished_at: string | null;
  extracted_at: string;
  proposed_kind: ProposedKind;
  proposed_payload: Record<string, unknown>;
  confidence: number | null;
  extraction_notes: string | null;
  extraction_model: string | null;
  hitl_status: StagingHitlStatus;
  hitl_reviewed_by: string | null;
  hitl_reviewed_at: string | null;
  hitl_review_notes: string | null;
  promoted_to_id: string | null;
  created_by: string | null;
  created_by_role: 'agent_service_role' | 'admin_ui';
  created_at: string;
}

export interface ListPendingStagingRowsArgs {
  extractionPassId?: string;
  limit?: number;
  offset?: number;
}

export interface ApproveStagingRowArgs {
  stagingId: string;
  hitlNotes?: string;
}

export interface ApproveStagingRowResult {
  ok: true;
  promotedToId: string;
}

export interface ApproveAllPendingStagingRowsArgs {
  /** Restrict to one proposed_kind; omit to approve all pending kinds. */
  kind?: ProposedKind;
  hitlNotes?: string;
}

export interface ApproveAllPendingStagingRowsResult {
  ok: true;
  approved: number;
  skippedDuplicates: number;
  failed: number;
}

export interface RejectStagingRowArgs {
  stagingId: string;
  hitlNotes?: string;
}

export interface RejectStagingRowResult {
  ok: true;
}

export interface MarkSupersededStagingRowsArgs {
  extractionPassId: string;
}

export interface MarkSupersededStagingRowsResult {
  ok: true;
  count: number;
}

// ---------------------------------------------------------------------------
// Internal: row mapping + admin gate
// ---------------------------------------------------------------------------

interface StagingRowDb {
  id: string;
  source_zotero_key: string;
  source_attachment_path: string | null;
  extraction_pass_id: string;
  extraction_pass_started_at: string;
  extraction_pass_finished_at: string | null;
  extracted_at: string;
  proposed_kind: ProposedKind;
  proposed_payload: Record<string, unknown> | null;
  confidence: number | null;
  extraction_notes: string | null;
  extraction_model: string | null;
  hitl_status: StagingHitlStatus;
  hitl_reviewed_by: string | null;
  hitl_reviewed_at: string | null;
  hitl_review_notes: string | null;
  promoted_to_id: string | null;
  created_by: string | null;
  created_by_role: 'agent_service_role' | 'admin_ui';
  created_at: string;
}

function dbRowToStagingRow(row: StagingRowDb): CatalogStagingRow {
  return {
    id: row.id,
    source_zotero_key: row.source_zotero_key,
    source_attachment_path: row.source_attachment_path ?? null,
    extraction_pass_id: row.extraction_pass_id,
    extraction_pass_started_at: row.extraction_pass_started_at,
    extraction_pass_finished_at: row.extraction_pass_finished_at ?? null,
    extracted_at: row.extracted_at,
    proposed_kind: row.proposed_kind,
    proposed_payload: row.proposed_payload ?? {},
    confidence: row.confidence ?? null,
    extraction_notes: row.extraction_notes ?? null,
    extraction_model: row.extraction_model ?? null,
    hitl_status: row.hitl_status,
    hitl_reviewed_by: row.hitl_reviewed_by ?? null,
    hitl_reviewed_at: row.hitl_reviewed_at ?? null,
    hitl_review_notes: row.hitl_review_notes ?? null,
    promoted_to_id: row.promoted_to_id ?? null,
    created_by: row.created_by ?? null,
    created_by_role: row.created_by_role,
    created_at: row.created_at,
  };
}

/**
 * Resolve the authenticated user + admin role. Throws if either fails.
 *
 * Throws (not returns false) so that write helpers fail loudly. Read helpers
 * call a separate non-throwing variant.
 */
async function requireAdminContext(supabase: ReturnType<typeof createAuthenticatedClient> extends Promise<infer T> ? T : never) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('catalog-staging: no authenticated user');
  }

  const { data: roles, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'matrix_admin']);

  if (roleError) {
    throw new Error(`catalog-staging: failed to resolve user role: ${roleError.message}`);
  }
  if (!roles || roles.length === 0) {
    throw new Error('catalog-staging: user lacks admin or matrix_admin role');
  }

  return { user, roles };
}

// ---------------------------------------------------------------------------
// Production-table mapping for promote (documentation only).
// The authoritative mapping lives in the catalog_approve_staging_row RPC at
// supabase/migrations/20260527000005_catalog_approve_staging_rpc.sql which
// resolves proposed_kind -> target table inside the transactional approve flow:
//   parameter_value -> promoted_parameter_values
//   evidence_item   -> catalog_evidence_items
//   source_lead     -> source_lead_triage
// ---------------------------------------------------------------------------
// listPendingStagingRows
// ---------------------------------------------------------------------------

/**
 * List staging rows in hitl_status='pending', optionally filtered by
 * extraction_pass_id. Sorted by confidence DESC, NULLS LAST, then by
 * extracted_at ASC (oldest first within a confidence band).
 *
 * Returns [] on any error (missing auth, missing table, RLS reject).
 * Does NOT throw -- the UI degrades gracefully to "empty queue" rather
 * than surfacing a backend error to a user who can't act on it anyway.
 */
export async function listPendingStagingRows(
  args: ListPendingStagingRowsArgs = {},
): Promise<CatalogStagingRow[]> {
  const { extractionPassId, limit, offset } = args;
  // Short-circuit limit<=0 before any Supabase work. PostgREST .range(start, end)
  // is inclusive on both ends, so limit=0 with .range(start, start) would
  // erroneously return one row; returning [] here is both correct and skips
  // the round-trip entirely.
  if (typeof limit === 'number' && limit <= 0) {
    return [];
  }
  try {
    const supabase = await createAuthenticatedClient();

    let query = supabase
      .from('catalog_extraction_staging')
      .select('*')
      .eq('hitl_status', 'pending')
      .order('confidence', { ascending: false, nullsFirst: false })
      .order('extracted_at', { ascending: true });

    if (extractionPassId) {
      query = query.eq('extraction_pass_id', extractionPassId);
    }
    if (typeof limit === 'number') {
      const start = typeof offset === 'number' && offset >= 0 ? offset : 0;
      query = query.range(start, start + limit - 1);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('catalog-staging.listPendingStagingRows error', error, {
        extractionPassId,
        limit,
        offset,
      });
      return [];
    }
    if (!data) return [];

    return (data as StagingRowDb[]).map(dbRowToStagingRow);
  } catch (err) {
    logger.error('catalog-staging.listPendingStagingRows unexpected', err, {
      extractionPassId,
      limit,
      offset,
    });
    return [];
  }
}

// ---------------------------------------------------------------------------
// approveStagingRow
// ---------------------------------------------------------------------------

/**
 * Approve a pending staging row: lock it, insert into the production table
 * identified by proposed_kind, then mark the staging row as approved with
 * promoted_to_id set to the new production row's id. All three steps run
 * inside a Postgres transaction via the catalog_approve_staging_row RPC
 * (supabase/migrations/20260527000005_catalog_approve_staging_rpc.sql), so
 * concurrent approvals on the same staging row are serialized via
 * SELECT ... FOR UPDATE and the SELECT-then-UPDATE race is eliminated.
 *
 * Throws on:
 *   - no authenticated user
 *   - user lacks admin / matrix_admin role
 *   - staging row not found / already non-pending
 *   - unknown proposed_kind
 *   - production INSERT fails (e.g. schema mismatch on proposed_payload)
 *
 * Admin gating is enforced both client-side (requireAdminContext) and inside
 * the RPC (SECURITY DEFINER + explicit role check). The client check gives
 * fail-fast UX; the RPC check is the load-bearing security boundary.
 */
export async function approveStagingRow(
  args: ApproveStagingRowArgs,
): Promise<ApproveStagingRowResult> {
  const { stagingId, hitlNotes } = args;
  if (!stagingId) {
    throw new Error('catalog-staging.approveStagingRow: stagingId is required');
  }

  const supabase = await createAuthenticatedClient();
  const { user } = await requireAdminContext(supabase);

  // Validate kind client-side ONLY when the caller has already loaded the row
  // (UI flow). The RPC re-validates kind authoritatively, so we don't load
  // the row here just to check kind -- that would re-introduce the race.

  // Call the transactional RPC. Returns the promoted_to_id (UUID) on success.
  const { data, error } = await supabase.rpc('catalog_approve_staging_row', {
    p_staging_id: stagingId,
    p_hitl_notes: hitlNotes ?? null,
  });

  if (error) {
    logger.error('catalog-staging.approveStagingRow rpc error', error, {
      stagingId,
      reviewerId: user.id,
    });
    // Surface the RPC's PostgreSQL exception message verbatim. The RPC
    // raises distinct ERRCODEs per failure mode:
    //   42501  -> no auth / not admin
    //   P0002  -> staging row not found
    //   P0001  -> already non-pending / unknown proposed_kind / no payload columns / no id returned
    // The UI presents the message verbatim; specialized routing by ERRCODE
    // can be added later if a downstream caller needs typed handling.
    const msg = error.message ?? String(error);
    throw new Error(`catalog-staging.approveStagingRow: ${msg}`);
  }

  // The RPC returns a scalar UUID. supabase.rpc returns the scalar directly
  // (not wrapped in {data:{id}}) when the function has a scalar return type.
  const promotedToId = typeof data === 'string'
    ? data
    : (data as { catalog_approve_staging_row?: string } | null)?.catalog_approve_staging_row;

  if (!promotedToId) {
    throw new Error(
      `catalog-staging.approveStagingRow: RPC returned no promoted_to_id for staging row ${stagingId}`,
    );
  }

  logger.info('catalog-staging.approveStagingRow ok', {
    stagingId,
    promotedToId,
    reviewerId: user.id,
  });

  return { ok: true, promotedToId };
}

/**
 * Bulk-approve every pending staging row (optionally one proposed_kind) in a
 * single authenticated round-trip via the catalog_approve_staging_rows_bulk RPC
 * (supabase/migrations/20260530000001_catalog_approve_staging_rows_bulk.sql).
 *
 * The RPC loops server-side, approving each pending row in its own
 * subtransaction and SKIPPING rows whose target was already promoted
 * (unique_violation), so one duplicate never rolls back the batch. Returns the
 * counts so the UI can report what happened. Throws (like approveStagingRow) on
 * auth/role failure so the UI surfaces it rather than failing silently.
 */
export async function approveAllPendingStagingRows(
  args: ApproveAllPendingStagingRowsArgs = {},
): Promise<ApproveAllPendingStagingRowsResult> {
  const { kind, hitlNotes } = args;

  const supabase = await createAuthenticatedClient();
  const { user } = await requireAdminContext(supabase);

  const { data, error } = await supabase.rpc('catalog_approve_staging_rows_bulk', {
    p_kind: kind ?? null,
    p_hitl_notes: hitlNotes ?? null,
  });

  if (error) {
    logger.error('catalog-staging.approveAllPendingStagingRows rpc error', error, {
      kind: kind ?? 'all',
      reviewerId: user.id,
    });
    const msg = error.message ?? String(error);
    throw new Error(`catalog-staging.approveAllPendingStagingRows: ${msg}`);
  }

  // RETURNS TABLE(...) surfaces as a one-element array of the count row.
  const row = Array.isArray(data) ? data[0] : data;
  const result: ApproveAllPendingStagingRowsResult = {
    ok: true,
    approved: Number(row?.approved ?? 0),
    skippedDuplicates: Number(row?.skipped_duplicates ?? 0),
    failed: Number(row?.failed ?? 0),
  };

  logger.info('catalog-staging.approveAllPendingStagingRows ok', {
    kind: kind ?? 'all',
    reviewerId: user.id,
    ...result,
  });

  return result;
}

// ---------------------------------------------------------------------------
// rejectStagingRow
// ---------------------------------------------------------------------------

/**
 * Mark a staging row as rejected. No production write happens; the agent's
 * proposal stays in the staging table for audit but is excluded from the
 * pending queue.
 *
 * Throws on auth failure, missing staging row, or non-pending status.
 */
export async function rejectStagingRow(
  args: RejectStagingRowArgs,
): Promise<RejectStagingRowResult> {
  const { stagingId, hitlNotes } = args;
  if (!stagingId) {
    throw new Error('catalog-staging.rejectStagingRow: stagingId is required');
  }

  const supabase = await createAuthenticatedClient();
  const { user } = await requireAdminContext(supabase);

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('catalog_extraction_staging')
    .update({
      hitl_status: 'rejected',
      hitl_reviewed_by: user.id,
      hitl_reviewed_at: nowIso,
      hitl_review_notes: hitlNotes ?? null,
    })
    .eq('id', stagingId)
    .eq('hitl_status', 'pending')
    .select('id')
    .single();

  if (error) {
    logger.error('catalog-staging.rejectStagingRow update failed', error, {
      stagingId,
      reviewerId: user.id,
    });
    throw new Error(
      `catalog-staging.rejectStagingRow: UPDATE failed for ${stagingId}: ${error.message}`,
    );
  }
  if (!data) {
    throw new Error(
      `catalog-staging.rejectStagingRow: staging row ${stagingId} not found or not pending`,
    );
  }

  logger.info('catalog-staging.rejectStagingRow ok', {
    stagingId,
    reviewerId: user.id,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// markSupersededStagingRows
// ---------------------------------------------------------------------------

/**
 * Bulk-mark all pending staging rows in a given extraction_pass_id as
 * superseded. Called when a later extraction pass replaces an earlier
 * pass's proposals (e.g., the agent re-ran on the same Zotero collection
 * with a refined LLM prompt).
 *
 * The CHECK constraint on catalog_extraction_staging allows superseded rows
 * to leave hitl_reviewed_by / hitl_reviewed_at null (this is not a human
 * review event). We still write hitl_review_notes with a stock supersede
 * marker so audit logs can distinguish supersede vs natural transition.
 *
 * Throws on auth failure or UPDATE failure.
 */
export async function markSupersededStagingRows(
  args: MarkSupersededStagingRowsArgs,
): Promise<MarkSupersededStagingRowsResult> {
  const { extractionPassId } = args;
  if (!extractionPassId) {
    throw new Error(
      'catalog-staging.markSupersededStagingRows: extractionPassId is required',
    );
  }

  const supabase = await createAuthenticatedClient();
  const { user } = await requireAdminContext(supabase);

  const { data, error } = await supabase
    .from('catalog_extraction_staging')
    .update({
      hitl_status: 'superseded',
      hitl_review_notes:
        `Superseded by later extraction pass; bulk-marked by ${user.id} at ${new Date().toISOString()}`,
    })
    .eq('extraction_pass_id', extractionPassId)
    .eq('hitl_status', 'pending')
    .select('id');

  if (error) {
    logger.error('catalog-staging.markSupersededStagingRows update failed', error, {
      extractionPassId,
      reviewerId: user.id,
    });
    throw new Error(
      `catalog-staging.markSupersededStagingRows: UPDATE failed for pass ${extractionPassId}: ${error.message}`,
    );
  }

  const count = Array.isArray(data) ? data.length : 0;
  logger.info('catalog-staging.markSupersededStagingRows ok', {
    extractionPassId,
    count,
    reviewerId: user.id,
  });

  return { ok: true, count };
}
