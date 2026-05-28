'use server';

/**
 * Supabase sync functions for source_lead_triage table.
 *
 * These are Next.js server actions callable from client code.
 * They never throw; on error they log and return a safe fallback value.
 *
 * The table may not exist yet (owner creates it separately).
 * All functions handle the missing-table case gracefully by returning
 * false (writes) or {} (reads) on any Supabase error.
 */

import { createAuthenticatedClient } from '@/lib/supabase-auth';

// ---------------------------------------------------------------------------
// TriageStatus -- the allowed triage status values
// ---------------------------------------------------------------------------

export type TriageStatus = 'untriaged' | 'promoted' | 'dismissed' | 'deferred';

// ---------------------------------------------------------------------------
// SourceLeadTriageRow -- public-facing type for triage records
// ---------------------------------------------------------------------------

export interface SourceLeadTriageRow {
  id: string;
  lead_set_id: string;
  triage_status: TriageStatus;
  triage_note: string;
  triaged_by: string | null;
  triaged_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Row shape as returned by Supabase
// ---------------------------------------------------------------------------

interface SourceLeadTriageDbRow {
  id: string;
  lead_set_id: string;
  triage_status: string | null;
  triage_note: string | null;
  triaged_by: string | null;
  triaged_at: string | null;
  updated_at: string | null;
}

// ---------------------------------------------------------------------------
// Mapper: Supabase row -> SourceLeadTriageRow
// ---------------------------------------------------------------------------

function rowToTriageRow(row: SourceLeadTriageDbRow): SourceLeadTriageRow {
  const validStatuses: TriageStatus[] = ['untriaged', 'promoted', 'dismissed', 'deferred'];
  const status = validStatuses.includes(row.triage_status as TriageStatus)
    ? (row.triage_status as TriageStatus)
    : 'untriaged';
  return {
    id: row.id,
    lead_set_id: row.lead_set_id,
    triage_status: status,
    triage_note: row.triage_note ?? '',
    triaged_by: row.triaged_by ?? null,
    triaged_at: row.triaged_at ?? new Date(0).toISOString(),
    updated_at: row.updated_at ?? new Date(0).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// fetchTriageState
// ---------------------------------------------------------------------------

/**
 * Fetches all triage records and returns them keyed by lead_set_id.
 *
 * Returns an empty object on any error (including table-not-found).
 */
export async function fetchTriageState(): Promise<Record<string, SourceLeadTriageRow>> {
  try {
    const supabase = await createAuthenticatedClient();
    const { data, error } = await supabase
      .from('source_lead_triage')
      .select('*');

    if (error) {
      console.error('[triage-sync] fetchTriageState error:', error.message);
      return {};
    }

    if (!data) {
      return {};
    }

    const result: Record<string, SourceLeadTriageRow> = {};
    for (const row of data as SourceLeadTriageDbRow[]) {
      const mapped = rowToTriageRow(row);
      result[mapped.lead_set_id] = mapped;
    }
    return result;
  } catch (err) {
    console.error('[triage-sync] fetchTriageState unexpected error:', err);
    return {};
  }
}

// ---------------------------------------------------------------------------
// setTriageStatus
// ---------------------------------------------------------------------------

const VALID_TRIAGE_STATUSES: TriageStatus[] = ['untriaged', 'promoted', 'dismissed', 'deferred'];

/**
 * Upserts a triage record for a source lead.
 *
 * Requires the authenticated user to have admin or matrix_admin role.
 * Returns true on success, false on error (including table-not-found or
 * missing admin role).
 *
 * Performs runtime validation on status and leadSetId before any DB call
 * because server actions are RPC endpoints that receive serialized client
 * input -- TypeScript types alone do not protect the server boundary.
 */
export async function setTriageStatus(
  leadSetId: string,
  status: TriageStatus,
  note: string,
): Promise<boolean> {
  const trimmedLeadSetId = leadSetId.trim();
  if (!trimmedLeadSetId) {
    console.warn('[triage-sync] setTriageStatus rejected empty lead_set_id');
    return false;
  }

  if (!VALID_TRIAGE_STATUSES.includes(status as TriageStatus)) {
    console.warn('[triage-sync] setTriageStatus rejected invalid status:', status);
    return false;
  }

  try {
    const supabase = await createAuthenticatedClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[triage-sync] setTriageStatus: no authenticated user');
      return false;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'matrix_admin']);

    if (!roles || roles.length === 0) {
      console.warn('[triage-sync] setTriageStatus: user lacks admin or matrix_admin role');
      return false;
    }

    const now = new Date().toISOString();
    const payload = {
      lead_set_id: trimmedLeadSetId,
      triage_status: status,
      triage_note: note,
      triaged_by: user.id,
      triaged_at: now,
      updated_at: now,
    };

    const { error } = await supabase
      .from('source_lead_triage')
      .upsert(payload, { onConflict: 'lead_set_id' });

    if (error) {
      console.error('[triage-sync] setTriageStatus error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[triage-sync] setTriageStatus unexpected error:', err);
    return false;
  }
}
