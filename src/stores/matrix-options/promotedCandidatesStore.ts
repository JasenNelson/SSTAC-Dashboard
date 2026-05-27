import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { PromotedParameterValueRecord } from '@/lib/matrix-options/provenance/promotion';
import { addAuditEntry } from '@/lib/matrix-options/provenance/promotion';
import type { ProvenancePathway } from '@/lib/matrix-options/provenance/types';

interface PromotedCandidatesState {
  candidates: Record<string, PromotedParameterValueRecord>;

  addCandidate: (record: PromotedParameterValueRecord) => void;
  updatePathway: (id: string, pathway: ProvenancePathway, actor: string) => void;
  updateSubstanceKey: (id: string, substanceKey: string, actor: string) => void;
  removeCandidate: (id: string) => void;
  isPromoted: (candidateGroupId: string) => boolean;
  getCandidateCount: () => number;
  getUnscopedCount: () => number;
}

export const usePromotedCandidatesStore = create<PromotedCandidatesState>()(
  devtools(
    persist(
      (set, get) => ({
        candidates: {},

        addCandidate: (record) =>
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
          ),

        updatePathway: (id, pathway, actor) =>
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
          ),

        updateSubstanceKey: (id, substanceKey, actor) =>
          set(
            (state) => {
              const existing = state.candidates[id];
              if (!existing) return state;
              const updated = { ...existing, substance_key: substanceKey };
              addAuditEntry(updated, 'substance_key_assigned', actor, `Substance key set to ${substanceKey}`);
              return {
                candidates: { ...state.candidates, [id]: updated },
              };
            },
            false,
            'updateSubstanceKey',
          ),

        removeCandidate: (id) =>
          set(
            (state) => {
              const next = { ...state.candidates };
              delete next[id];
              return { candidates: next };
            },
            false,
            'removeCandidate',
          ),

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
