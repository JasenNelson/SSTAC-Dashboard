import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { PromotedParameterValueRecord } from '@/lib/matrix-options/provenance/promotion';
import { addAuditEntry } from '@/lib/matrix-options/provenance/promotion';
import type { ProvenancePathway } from '@/lib/matrix-options/provenance/types';
import {
  fetchPromotedValues,
  upsertPromotedValue,
  deletePromotedValue,
} from '@/lib/matrix-options/provenance/supabase-sync';

// ---------------------------------------------------------------------------
// Per-candidate write queue
//
// Serialises writes for the same parameter_value_id so that rapid edits
// (e.g. edit -> remove before the first upsert returns) cannot produce
// out-of-order Supabase mutations. Each enqueue chains off the previous
// promise for that id, and self-prunes once the tail settles.
// ---------------------------------------------------------------------------

export const pendingWrites = new Map<string, Promise<void>>();

export function hasPendingWrite(id: string): boolean {
  return pendingWrites.has(id);
}

/** For test teardown only -- clears all in-flight queue entries. */
export function clearPendingWritesForTesting(): void {
  pendingWrites.clear();
}

function enqueueWrite(id: string, fn: () => Promise<unknown>): void {
  const prev = pendingWrites.get(id) ?? Promise.resolve();
  const next = prev
    .then(() => fn().catch(console.error))
    .then(() => {
      if (pendingWrites.get(id) === next) pendingWrites.delete(id);
    });
  pendingWrites.set(id, next);
}

interface PromotedCandidatesState {
  candidates: Record<string, PromotedParameterValueRecord>;

  addCandidate: (record: PromotedParameterValueRecord) => void;
  updatePathway: (id: string, pathway: ProvenancePathway, actor: string) => void;
  updateSubstanceKey: (id: string, substanceKey: string, actor: string) => void;
  removeCandidate: (id: string) => void;
  isPromoted: (candidateGroupId: string) => boolean;
  getCandidateCount: () => number;
  getUnscopedCount: () => number;

  /**
   * Fetches all records from Supabase and merges with localStorage state.
   *
   * Merge strategy:
   * - Supabase records are authoritative and always included.
   * - Local records not in Supabase are kept ONLY if they have a pending
   *   write (i.e. they were just promoted and have not synced yet).
   * - Local records not in Supabase and NOT in the write queue are pruned
   *   (they were deleted by another session server-side).
   */
  hydrateFromSupabase: () => Promise<void>;

  /**
   * Upserts the candidate identified by `id` to Supabase.
   * Fire-and-forget: errors are logged but do not block the UI.
   */
  syncCandidateToSupabase: (id: string) => Promise<void>;
}

export const usePromotedCandidatesStore = create<PromotedCandidatesState>()(
  devtools(
    persist(
      (set, get) => ({
        candidates: {},

        addCandidate: (record) => {
          set(
            (state) => {
              const isDuplicate = Object.values(state.candidates).some(
                (c) => c.candidate_group_id === record.candidate_group_id,
              );
              if (isDuplicate) return state;
              return {
                candidates: {
                  ...state.candidates,
                  [record.parameter_value_id]: record,
                },
              };
            },
            false,
            'addCandidate',
          );
          // Serialised Supabase write
          const added = get().candidates[record.parameter_value_id];
          if (added) {
            enqueueWrite(record.parameter_value_id, () => upsertPromotedValue(added));
          }
        },

        updatePathway: (id, pathway, actor) => {
          set(
            (state) => {
              const existing = state.candidates[id];
              if (!existing) return state;
              const updated = { ...existing, pathway };
              addAuditEntry(updated, 'pathway_assigned', actor, `Pathway set to ${pathway}`);
              return {
                candidates: { ...state.candidates, [id]: updated },
              };
            },
            false,
            'updatePathway',
          );
          // Serialised Supabase write
          const updated = get().candidates[id];
          if (updated) {
            enqueueWrite(id, () => upsertPromotedValue(updated));
          }
        },

        updateSubstanceKey: (id, substanceKey, actor) => {
          set(
            (state) => {
              const existing = state.candidates[id];
              if (!existing) return state;
              const updated = { ...existing, substance_key: substanceKey };
              addAuditEntry(
                updated,
                'substance_key_assigned',
                actor,
                `Substance key set to ${substanceKey}`,
              );
              return {
                candidates: { ...state.candidates, [id]: updated },
              };
            },
            false,
            'updateSubstanceKey',
          );
          // Serialised Supabase write
          const updated = get().candidates[id];
          if (updated) {
            enqueueWrite(id, () => upsertPromotedValue(updated));
          }
        },

        removeCandidate: (id) => {
          set(
            (state) => {
              const next = { ...state.candidates };
              delete next[id];
              return { candidates: next };
            },
            false,
            'removeCandidate',
          );
          // Serialised Supabase delete
          enqueueWrite(id, () => deletePromotedValue(id));
        },

        isPromoted: (candidateGroupId) => {
          const all = get().candidates;
          return Object.values(all).some(
            (c) => c.candidate_group_id === candidateGroupId,
          );
        },

        getCandidateCount: () => Object.keys(get().candidates).length,

        getUnscopedCount: () =>
          Object.values(get().candidates).filter(
            (c) => c.pathway === 'eco-direct-eqp' && c.substance_key === '',
          ).length,

        hydrateFromSupabase: async () => {
          try {
            const remoteRecords = await fetchPromotedValues();
            const remoteIds = new Set(remoteRecords.map((r) => r.parameter_value_id));

            set(
              (state) => {
                const merged: Record<string, PromotedParameterValueRecord> = {};
                // Supabase records are always authoritative
                for (const record of remoteRecords) {
                  merged[record.parameter_value_id] = record;
                }
                // Keep local records that are NOT yet in Supabase only if
                // they still have a pending write (just promoted, not synced).
                // Records absent from both Supabase and the write queue were
                // deleted server-side by another session -- prune them.
                for (const [id, record] of Object.entries(state.candidates)) {
                  if (!remoteIds.has(id) && pendingWrites.has(id)) {
                    merged[id] = record;
                  }
                }
                return { candidates: merged };
              },
              false,
              'hydrateFromSupabase',
            );
          } catch (err) {
            console.error('[promotedCandidatesStore] hydrateFromSupabase error:', err);
          }
        },

        syncCandidateToSupabase: async (id) => {
          const candidate = get().candidates[id];
          if (!candidate) return;
          try {
            await upsertPromotedValue(candidate);
          } catch (err) {
            console.error('[promotedCandidatesStore] syncCandidateToSupabase error:', err);
          }
        },
      }),
      {
        name: 'sstac-matrix-options-promoted-candidates',
        partialize: (state) => ({ candidates: state.candidates }),
        skipHydration: true,
      },
    ),
    { name: 'promoted-candidates-store' },
  ),
);
