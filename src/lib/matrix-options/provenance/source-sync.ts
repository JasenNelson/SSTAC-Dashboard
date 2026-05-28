'use server';

/**
 * Supabase sync functions for catalog_sources table.
 *
 * These are Next.js server actions callable from client code.
 * They never throw; on error they log and return a safe fallback value.
 *
 * The table may not exist yet (owner creates it separately).
 * All functions handle the missing-table case gracefully by returning
 * { success: false, ... } (writes) or [] (reads) on any Supabase error.
 */

import { createAuthenticatedClient } from '@/lib/supabase-auth';

// ---------------------------------------------------------------------------
// CatalogSourceRow -- the public-facing type for HITL-added sources
// ---------------------------------------------------------------------------

export interface CatalogSourceRow {
  id: string;
  source_id: string;
  short_citation: string;
  title: string;
  year: number | null;
  publisher: string;
  doi: string | null;
  url: string | null;
  zotero_key: string | null;
  zotero_item_type: string | null;
  zotero_parent_key: string | null;
  authority_scope: string;
  authority_tier: string;
  currentness_status: string;
  bc_protocol_alignment: string;
  canonical_source_status: string;
  role: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// SubmitSourceRequest -- user-provided fields only (no server-generated fields)
// ---------------------------------------------------------------------------

export interface SubmitSourceRequest {
  source_id: string;          // optional: auto-generated if empty
  short_citation: string;     // required
  title: string;              // required
  year: number | null;
  publisher: string;
  doi: string | null;
  url: string | null;
  zotero_key: string | null;
  authority_scope: string;    // BC | Canada_federal | US_federal | general
  authority_tier: string;     // tier_1_government_or_regulatory | tier_2_peer_reviewed_literature | tier_3_supporting_science | implementation_scaffold
  canonical_source_status: string; // direct_source_verified | needs_direct_source_check | needs_exact_source_locator | not_applicable
  role: string;               // canonical_candidate | reference_mining | policy_compilation | implementation_scaffold
}

// ---------------------------------------------------------------------------
// SubmitSourceResult -- structured return from submitSource
// ---------------------------------------------------------------------------

export interface SubmitSourceResult {
  success: boolean;
  source_id: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Row shape as returned by Supabase
// ---------------------------------------------------------------------------

interface CatalogSourceDbRow {
  id: string;
  source_id: string;
  short_citation: string;
  title: string;
  year: number | null;
  publisher: string | null;
  doi: string | null;
  url: string | null;
  zotero_key: string | null;
  zotero_item_type: string | null;
  zotero_parent_key: string | null;
  authority_scope: string | null;
  authority_tier: string | null;
  currentness_status: string | null;
  bc_protocol_alignment: string | null;
  canonical_source_status: string | null;
  role: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Mapper: Supabase row -> CatalogSourceRow
// ---------------------------------------------------------------------------

function rowToSource(row: CatalogSourceDbRow): CatalogSourceRow {
  return {
    id: row.id,
    source_id: row.source_id,
    short_citation: row.short_citation,
    title: row.title,
    year: row.year ?? null,
    publisher: row.publisher ?? '',
    doi: row.doi ?? null,
    url: row.url ?? null,
    zotero_key: row.zotero_key ?? null,
    zotero_item_type: row.zotero_item_type ?? null,
    zotero_parent_key: row.zotero_parent_key ?? null,
    authority_scope: row.authority_scope ?? '',
    authority_tier: row.authority_tier ?? '',
    currentness_status: row.currentness_status ?? '',
    bc_protocol_alignment: row.bc_protocol_alignment ?? '',
    canonical_source_status: row.canonical_source_status ?? '',
    role: row.role ?? '',
    created_at: row.created_at,
    created_by: row.created_by ?? null,
    updated_at: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// slugify helper -- produces a lowercase alphanumeric-hyphen string
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// slugifyForSourceId -- normalizes a user-supplied source_id.
// Idempotent: already-slug-safe IDs like "src-custom-2024" pass through
// unchanged.  Special characters such as "/", whitespace, and quotes are
// replaced with hyphens and consecutive hyphens are collapsed.
// Returns an empty string when the input contains no slug-safe characters
// (e.g. "////"), which callers must treat as invalid.
function slugifyForSourceId(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// submitSource
// ---------------------------------------------------------------------------

/**
 * Inserts a HITL-added source into catalog_sources.
 *
 * Requires the authenticated user to have admin or matrix_admin role.
 *
 * If request.source_id is empty, auto-generates:
 *   'src-hitl-' + slugify(short_citation) + '-' + timestamp
 *
 * Returns:
 *   { success: true, source_id: <assigned id>, error: null } on success.
 *   { success: false, source_id: null, error: 'admin_required' } if not admin.
 *   { success: false, source_id: null, error: 'duplicate_source_id' } on conflict.
 *   { success: false, source_id: null, error: 'unknown' } on other errors.
 */
export async function submitSource(
  request: SubmitSourceRequest,
): Promise<SubmitSourceResult> {
  try {
    const supabase = await createAuthenticatedClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[source-sync] submitSource: no authenticated user');
      return { success: false, source_id: null, error: 'admin_required' };
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'matrix_admin']);

    if (!roles || roles.length === 0) {
      console.warn('[source-sync] submitSource: user lacks admin or matrix_admin role');
      return { success: false, source_id: null, error: 'admin_required' };
    }

    const manualId = request.source_id.trim();
    const assignedSourceId = manualId
      ? slugifyForSourceId(manualId)
      : 'src-hitl-' + slugify(request.short_citation) + '-' + Date.now();

    if (!assignedSourceId) {
      console.warn('[source-sync] submitSource: manual source_id slugified to empty string');
      return { success: false, source_id: null, error: 'invalid_source_id' };
    }

    const payload = {
      source_id: assignedSourceId,
      short_citation: request.short_citation,
      title: request.title,
      year: request.year,
      publisher: request.publisher,
      doi: request.doi,
      url: request.url,
      zotero_key: request.zotero_key,
      zotero_item_type: null,
      zotero_parent_key: null,
      authority_scope: request.authority_scope,
      authority_tier: request.authority_tier,
      currentness_status: 'unknown',
      bc_protocol_alignment: 'none',
      canonical_source_status: request.canonical_source_status,
      role: request.role,
      created_by: user.id,
    };

    const { error } = await supabase
      .from('catalog_sources')
      .insert(payload);

    if (error) {
      // Unique constraint violation
      if (error.code === '23505') {
        console.warn('[source-sync] submitSource: duplicate source_id', assignedSourceId);
        return { success: false, source_id: null, error: 'duplicate_source_id' };
      }
      console.error('[source-sync] submitSource error:', error.message);
      return { success: false, source_id: null, error: 'unknown' };
    }

    return { success: true, source_id: assignedSourceId, error: null };
  } catch (err) {
    console.error('[source-sync] submitSource unexpected error:', err);
    return { success: false, source_id: null, error: 'unknown' };
  }
}

// ---------------------------------------------------------------------------
// fetchHitlSources
// ---------------------------------------------------------------------------

/**
 * Fetches all HITL-added sources from catalog_sources, newest first.
 *
 * Returns an empty array on any error (including table-not-found).
 */
export async function fetchHitlSources(): Promise<CatalogSourceRow[]> {
  try {
    const supabase = await createAuthenticatedClient();
    const { data, error } = await supabase
      .from('catalog_sources')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[source-sync] fetchHitlSources error:', error.message);
      return [];
    }

    if (!data) {
      return [];
    }

    return (data as CatalogSourceDbRow[]).map(rowToSource);
  } catch (err) {
    console.error('[source-sync] fetchHitlSources unexpected error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// deleteHitlSource
// ---------------------------------------------------------------------------

/**
 * Deletes a HITL-added source by source_id.
 *
 * Requires the authenticated user to have admin or matrix_admin role.
 * Returns true on success, false on error.
 */
export async function deleteHitlSource(sourceId: string): Promise<boolean> {
  try {
    const supabase = await createAuthenticatedClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[source-sync] deleteHitlSource: no authenticated user');
      return false;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'matrix_admin']);

    if (!roles || roles.length === 0) {
      console.warn('[source-sync] deleteHitlSource: user lacks admin or matrix_admin role');
      return false;
    }

    const { error } = await supabase
      .from('catalog_sources')
      .delete()
      .eq('source_id', sourceId);

    if (error) {
      console.error('[source-sync] deleteHitlSource error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[source-sync] deleteHitlSource unexpected error:', err);
    return false;
  }
}
