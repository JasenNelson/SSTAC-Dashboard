'use server';

/**
 * Supabase sync functions for catalog_evidence_items table.
 *
 * These are Next.js server actions callable from client code.
 * They never throw; on error they log and return a safe fallback value.
 *
 * The table may not exist yet (owner creates it separately).
 * All functions handle the missing-table case gracefully by returning
 * false (writes) or [] (reads) on any Supabase error.
 */

import { createAuthenticatedClient } from '@/lib/supabase-auth';

// ---------------------------------------------------------------------------
// CatalogEvidenceItem -- the public-facing type for HITL-added evidence items
// ---------------------------------------------------------------------------

export interface CatalogEvidenceItem {
  id: string;
  parameter_value_id: string;
  source_id: string;
  locator: string;
  locator_type: string;
  value_text: string | null;
  extraction_method: string;
  extracted_by: string;
  qa_status: string;
  note: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// SubmitEvidenceItemRequest -- user-provided fields only (no server-generated fields)
// ---------------------------------------------------------------------------

export interface SubmitEvidenceItemRequest {
  parameter_value_id: string;
  source_id: string;
  locator: string;
  locator_type: string;
  value_text: string | null;
  note: string;
}

// ---------------------------------------------------------------------------
// Row shape as returned by Supabase
// ---------------------------------------------------------------------------

interface CatalogEvidenceItemRow {
  id: string;
  parameter_value_id: string;
  source_id: string;
  locator: string;
  locator_type: string;
  value_text: string | null;
  extraction_method: string | null;
  extracted_by: string | null;
  qa_status: string | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Mapper: Supabase row -> CatalogEvidenceItem
// ---------------------------------------------------------------------------

function rowToEvidenceItem(row: CatalogEvidenceItemRow): CatalogEvidenceItem {
  return {
    id: row.id,
    parameter_value_id: row.parameter_value_id,
    source_id: row.source_id,
    locator: row.locator,
    locator_type: row.locator_type,
    value_text: row.value_text ?? null,
    extraction_method: row.extraction_method ?? 'hitl_manual',
    extracted_by: row.extracted_by ?? '',
    qa_status: row.qa_status ?? 'needs_review',
    note: row.note ?? '',
    created_at: row.created_at,
    created_by: row.created_by ?? null,
    updated_at: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// submitEvidenceItem
// ---------------------------------------------------------------------------

/**
 * Inserts a HITL-added evidence locator into catalog_evidence_items.
 *
 * Requires the authenticated user to have admin or matrix_admin role.
 * Returns true on success, false on error (including table-not-found or
 * missing admin role).
 */
export async function submitEvidenceItem(
  item: SubmitEvidenceItemRequest,
): Promise<boolean> {
  try {
    const supabase = await createAuthenticatedClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[evidence-sync] submitEvidenceItem: no authenticated user');
      return false;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'matrix_admin']);

    if (!roles || roles.length === 0) {
      console.warn('[evidence-sync] submitEvidenceItem: user lacks admin or matrix_admin role');
      return false;
    }

    const payload = {
      parameter_value_id: item.parameter_value_id,
      source_id: item.source_id,
      locator: item.locator,
      locator_type: item.locator_type,
      value_text: item.value_text,
      note: item.note,
      extraction_method: 'hitl_manual',
      extracted_by: user.id,
      qa_status: 'needs_review',
      created_by: user.id,
    };

    const { error } = await supabase
      .from('catalog_evidence_items')
      .insert(payload);

    if (error) {
      console.error('[evidence-sync] submitEvidenceItem error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[evidence-sync] submitEvidenceItem unexpected error:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// fetchEvidenceItems
// ---------------------------------------------------------------------------

/**
 * Fetches HITL-added evidence items for a single parameter value, newest first.
 *
 * Returns an empty array on any error (including table-not-found).
 */
export async function fetchEvidenceItems(
  parameterValueId: string,
): Promise<CatalogEvidenceItem[]> {
  try {
    const supabase = await createAuthenticatedClient();
    const { data, error } = await supabase
      .from('catalog_evidence_items')
      .select('*')
      .eq('parameter_value_id', parameterValueId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[evidence-sync] fetchEvidenceItems error:', error.message);
      return [];
    }

    if (!data) {
      return [];
    }

    return (data as CatalogEvidenceItemRow[]).map(rowToEvidenceItem);
  } catch (err) {
    console.error('[evidence-sync] fetchEvidenceItems unexpected error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// deleteEvidenceItem
// ---------------------------------------------------------------------------

/**
 * Deletes a HITL-added evidence item by id.
 *
 * Requires the authenticated user to have admin or matrix_admin role.
 * Returns true on success, false on error.
 */
export async function deleteEvidenceItem(id: string): Promise<boolean> {
  try {
    const supabase = await createAuthenticatedClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[evidence-sync] deleteEvidenceItem: no authenticated user');
      return false;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'matrix_admin']);

    if (!roles || roles.length === 0) {
      console.warn('[evidence-sync] deleteEvidenceItem: user lacks admin or matrix_admin role');
      return false;
    }

    const { error } = await supabase
      .from('catalog_evidence_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[evidence-sync] deleteEvidenceItem error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[evidence-sync] deleteEvidenceItem unexpected error:', err);
    return false;
  }
}
