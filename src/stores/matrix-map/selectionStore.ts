/**
 * Matrix-map Selection Store
 *
 * Cross-component pub/sub for sample-marker selection state in the
 * matrix-options Interactive Map. MatrixMap.tsx is the authoritative
 * WRITER (via the Pan / Select / Area mode handlers + cluster-pin
 * click handler). The Sample Locations panel (currently inlined in
 * MatrixMap.tsx) is the primary READER; future PR-MAP-12 Selection
 * Stats + PR-MAP-13 MeasurementWorkbench + PR-MAP-14 Calculator bridge
 * also subscribe.
 *
 * Why a separate store from src/stores/matrix-map/identifyStore:
 *   Two semantically distinct domains -- identify-tool results vs
 *   sample selection. Keeping them in separate small stores avoids
 *   the "god slice" anti-pattern and matches the design intent
 *   foreshadowed in MatrixMap.tsx lines 16-23 ("Zustand SelectionStore"
 *   listed as a separate PR-MAP-11 deliverable from PR-MAP-10).
 *
 * State shape mirrors the prior MatrixMap.tsx local useState exactly:
 *   selectedSampleId  -- single-select / pan-to highlight; null when
 *                        the user is in multi-select mode.
 *   selectedSampleIds -- multi-select array; covers Shift-add,
 *                        Ctrl-remove, Area drag-rectangle, and
 *                        cluster-pin selection.
 *
 * Action contracts preserved from MatrixMap.tsx:285-320 (the prior
 * useCallback declarations):
 *   selectSample(id):           selectedSampleId = id;
 *                               selectedSampleIds = [id]
 *                               (BN-RRM siteDataStore.selectSite
 *                                semantics; single click replaces any
 *                                prior multi-select per codex PR-MAP-1
 *                                P2-1).
 *   addSampleSelection(id):     adds id to selectedSampleIds via Set
 *                               dedup; clears selectedSampleId.
 *   addMultipleSamples(ids):    adds ids to selectedSampleIds via Set
 *                               dedup; clears selectedSampleId.
 *   removeSampleSelection(id):  removes id from selectedSampleIds;
 *                               clears selectedSampleId.
 *   removeMultipleSamples(ids): removes ids from selectedSampleIds;
 *                               clears selectedSampleId.
 *   toggleSampleSelection(id):  legacy toggle wrapper used by older
 *                               call sites/tests; clears selectedSampleId.
 *   requestPanToSample(id):     requests a map pan/highlight without changing
 *                               selectedSampleIds. The workbench uses this
 *                               so row clicks do not collapse a multi-sample
 *                               selection.
 *   selectAllSamples(allIds):   replaces selectedSampleIds with allIds;
 *                               clears selectedSampleId. Caller passes
 *                               the full sample-ID list -- the store
 *                               intentionally does not know about
 *                               samples, keeping the dependency
 *                               surface narrow.
 *   clearSampleSelection():     resets both fields.
 *
 * Selection state is NOT persisted (no persist middleware) -- a
 * reloaded session should reset to "no selection" so the Selection
 * Stats panel (PR-MAP-12) does not surface stale aggregates against
 * the live RPC sample list.
 *
 * Plain ASCII only.
 */

import { create } from 'zustand';

export interface SelectionState {
  selectedSampleId: string | null;
  selectedSampleIds: string[];
  panRequestedSampleId: string | null;
  panRequestSeq: number;
  selectSample: (id: string) => void;
  requestPanToSample: (id: string) => void;
  addSampleSelection: (id: string) => void;
  addMultipleSamples: (ids: string[]) => void;
  removeSampleSelection: (id: string) => void;
  removeMultipleSamples: (ids: string[]) => void;
  toggleSampleSelection: (id: string) => void;
  selectMultipleSamples: (ids: string[]) => void;
  selectAllSamples: (allIds: string[]) => void;
  clearSampleSelection: () => void;
}

export const useMatrixMapSelectionStore = create<SelectionState>()((set) => ({
  selectedSampleId: null,
  selectedSampleIds: [],
  panRequestedSampleId: null,
  panRequestSeq: 0,

  selectSample: (id) => {
    set({ selectedSampleId: id, selectedSampleIds: [id] });
  },

  requestPanToSample: (id) => {
    set((state) => ({
      selectedSampleId: id,
      panRequestedSampleId: id,
      panRequestSeq: state.panRequestSeq + 1,
    }));
  },

  addSampleSelection: (id) => {
    set((state) => ({
      selectedSampleIds: Array.from(new Set([...state.selectedSampleIds, id])),
      selectedSampleId: null,
    }));
  },

  addMultipleSamples: (ids) => {
    set((state) => ({
      selectedSampleIds: Array.from(new Set([...state.selectedSampleIds, ...ids])),
      selectedSampleId: null,
    }));
  },

  removeSampleSelection: (id) => {
    set((state) => ({
      selectedSampleIds: state.selectedSampleIds.filter((x) => x !== id),
      selectedSampleId: null,
    }));
  },

  removeMultipleSamples: (ids) => {
    const idsToRemove = new Set(ids);
    set((state) => ({
      selectedSampleIds: state.selectedSampleIds.filter((id) => !idsToRemove.has(id)),
      selectedSampleId: null,
    }));
  },

  toggleSampleSelection: (id) => {
    set((state) => ({
      selectedSampleIds: state.selectedSampleIds.includes(id)
        ? state.selectedSampleIds.filter((x) => x !== id)
        : [...state.selectedSampleIds, id],
      selectedSampleId: null,
    }));
  },

  selectMultipleSamples: (ids) => {
    set((state) => ({
      selectedSampleIds: Array.from(new Set([...state.selectedSampleIds, ...ids])),
      selectedSampleId: null,
    }));
  },

  selectAllSamples: (allIds) => {
    set({ selectedSampleIds: allIds, selectedSampleId: null });
  },

  clearSampleSelection: () => {
    set({ selectedSampleId: null, selectedSampleIds: [], panRequestedSampleId: null });
  },
}));
