'use server';

/**
 * Supabase sync functions for the user_saved_views table (Matrix Options
 * Evidence Library "saved views"). Per-user UI state only -- never touches the
 * default-policy library, QA verdicts, or catalog reference data.
 *
 * These are Next.js server actions callable from client code. They never throw;
 * on error they log and return a safe fallback ([] for reads, a structured
 * result for writes). The table may not exist yet (owner pastes the migration
 * separately), so every function handles the missing-table / signed-out case
 * gracefully -- the client keeps a localStorage fallback either way.
 */

import { createAuthenticatedClient } from '@/lib/supabase-auth';
import { createEvidenceLibraryFilters } from '@/lib/matrix-options/provenance/library';
import type {
  EvidenceLibraryFilters,
  EvidenceLibraryFilterRequest,
  EvidenceLibraryViewMode,
} from '@/lib/matrix-options/provenance/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const MAX_SAVED_VIEWS = 50;

export interface SavedViewRow {
  id: string;
  name: string;
  filters: EvidenceLibraryFilters; // always re-normalized via createEvidenceLibraryFilters
  view_mode: EvidenceLibraryViewMode;
  created_at: string;
  updated_at: string;
}

export interface SaveViewRequest {
  name: string;
  filters: EvidenceLibraryFilters;
  view_mode: EvidenceLibraryViewMode;
}

export type SaveViewError =
  | 'unauthenticated'
  | 'invalid_name'
  | 'limit_reached'
  | 'unknown';

export interface SaveViewResult {
  success: boolean;
  view: SavedViewRow | null;
  error: SaveViewError | null;
}

interface SavedViewDbRow {
  id: string;
  name: string;
  filters: unknown;
  view_mode: string | null;
  created_at: string;
  updated_at: string;
}

const VIEW_MODES: readonly EvidenceLibraryViewMode[] = [
  'by-parameter',
  'sources',
  'source-leads',
  'values',
  'equations',
  'assumptions',
];

function coerceViewMode(value: string | null | undefined): EvidenceLibraryViewMode {
  return value && (VIEW_MODES as readonly string[]).includes(value)
    ? (value as EvidenceLibraryViewMode)
    : 'values';
}

// Re-normalize the stored JSONB through createEvidenceLibraryFilters so the
// returned filters are always a complete, well-formed object (drops unknown
// keys, ensures arrays) -- the same defense the old localStorage loader applied.
function rowToSavedView(row: SavedViewDbRow): SavedViewRow {
  const raw =
    row.filters && typeof row.filters === 'object'
      ? (row.filters as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    name: row.name,
    filters: createEvidenceLibraryFilters(raw as EvidenceLibraryFilterRequest),
    view_mode: coerceViewMode(row.view_mode),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// fetchSavedViews -- the current user's views, newest first. [] on any error.
// ---------------------------------------------------------------------------

export async function fetchSavedViews(): Promise<SavedViewRow[]> {
  try {
    const supabase = await createAuthenticatedClient();
    const { data, error } = await supabase
      .from('user_saved_views')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[saved-views-sync] fetchSavedViews error:', error.message);
      return [];
    }
    if (!data) return [];
    return (data as SavedViewDbRow[]).map(rowToSavedView);
  } catch (err) {
    console.error('[saved-views-sync] fetchSavedViews unexpected error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// createSavedView -- insert one view for the current user (50-view cap).
// ---------------------------------------------------------------------------

export async function createSavedView(
  request: SaveViewRequest,
): Promise<SaveViewResult> {
  try {
    const supabase = await createAuthenticatedClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, view: null, error: 'unauthenticated' };
    }

    const name = request.name.trim();
    if (!name) {
      return { success: false, view: null, error: 'invalid_name' };
    }

    const { count, error: countError } = await supabase
      .from('user_saved_views')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (countError) {
      console.error('[saved-views-sync] createSavedView count error:', countError.message);
      return { success: false, view: null, error: 'unknown' };
    }
    if ((count ?? 0) >= MAX_SAVED_VIEWS) {
      return { success: false, view: null, error: 'limit_reached' };
    }

    const { data, error } = await supabase
      .from('user_saved_views')
      .insert({
        user_id: user.id,
        name,
        filters: request.filters,
        view_mode: request.view_mode,
      })
      .select('*')
      .single();

    if (error || !data) {
      console.error('[saved-views-sync] createSavedView error:', error?.message);
      return { success: false, view: null, error: 'unknown' };
    }
    return { success: true, view: rowToSavedView(data as SavedViewDbRow), error: null };
  } catch (err) {
    console.error('[saved-views-sync] createSavedView unexpected error:', err);
    return { success: false, view: null, error: 'unknown' };
  }
}

// ---------------------------------------------------------------------------
// deleteSavedView -- remove one of the current user's views by id.
// RLS guarantees a user can only delete their own row. false on any error.
// ---------------------------------------------------------------------------

export async function deleteSavedView(viewId: string): Promise<boolean> {
  try {
    const supabase = await createAuthenticatedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('user_saved_views')
      .delete()
      .eq('id', viewId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[saved-views-sync] deleteSavedView error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[saved-views-sync] deleteSavedView unexpected error:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// importLegacySavedViews -- one-shot bulk import of localStorage views into
// Supabase for a user who has none yet. Capped at MAX_SAVED_VIEWS.
// ---------------------------------------------------------------------------

export async function importLegacySavedViews(
  views: SaveViewRequest[],
): Promise<{ success: boolean; imported: number }> {
  try {
    if (views.length === 0) return { success: true, imported: 0 };
    const supabase = await createAuthenticatedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, imported: 0 };

    const { count } = await supabase
      .from('user_saved_views')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const remaining = MAX_SAVED_VIEWS - (count ?? 0);
    if (remaining <= 0) return { success: true, imported: 0 };

    const payloads = views
      .filter((v) => v.name.trim().length > 0)
      .slice(0, remaining)
      .map((v) => ({
        user_id: user.id,
        name: v.name.trim(),
        filters: v.filters,
        view_mode: v.view_mode,
      }));
    if (payloads.length === 0) return { success: true, imported: 0 };

    const { error } = await supabase.from('user_saved_views').insert(payloads);
    if (error) {
      console.error('[saved-views-sync] importLegacySavedViews error:', error.message);
      return { success: false, imported: 0 };
    }
    return { success: true, imported: payloads.length };
  } catch (err) {
    console.error('[saved-views-sync] importLegacySavedViews unexpected error:', err);
    return { success: false, imported: 0 };
  }
}
