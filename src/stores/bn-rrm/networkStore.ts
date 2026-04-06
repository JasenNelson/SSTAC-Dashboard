/**
 * Network Store
 *
 * Zustand store managing the Bayesian Network structure and inference state.
 * All inference uses the general DAG engine — no model-specific code paths.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  NetworkModel,
  NetworkNodeData,
  ContainerData,
  Evidence,
  BeliefDistribution,
  NodeCategory,
} from '@/types/bn-rrm/network';
import { createDummyNetwork } from '@/lib/bn-rrm/dummy-data';
import { createTrainedNetwork, createGenericNetwork } from '@/lib/bn-rrm/trained-network';
import { dagForwardInference, dagBackwardInference } from '@/lib/bn-rrm/bn-inference';
import type { PackManifest } from '@/lib/bn-rrm/pack-types';

// =============================================================================
// STORE INTERFACE
// =============================================================================

interface NetworkState {
  // Model data
  model: NetworkModel | null;

  // Derived/computed
  nodeMap: Map<string, NetworkNodeData>;
  containerMap: Map<string, ContainerData>;

  // Evidence state
  evidence: Evidence;

  // UI state
  selectedNodeId: string | null;
  selectedContainerId: string | null;
  highlightedPath: string[];

  // Loading state
  isLoading: boolean;
  isInferenceRunning: boolean;
  /** Monotonic counter to detect stale loadPackModel fetches */
  _loadGeneration: number;

  // Actions - Model
  loadModel: (model: NetworkModel) => void;
  loadDummyModel: () => void;
  loadTrainedModel: (source?: 'expert' | 'learned') => void;
  loadPackModel: (packBaseUrl: string, manifest: PackManifest) => Promise<void>;

  // Actions - Inference
  runInference: (mode: 'forward' | 'backward') => void;

  // Actions - Nodes
  selectNode: (nodeId: string | null) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;

  // Actions - Containers
  selectContainer: (containerId: string | null) => void;
  toggleContainer: (containerId: string) => void;
  expandAllContainers: () => void;
  collapseAllContainers: () => void;

  // Actions - Evidence
  setEvidence: (nodeId: string, state: string) => void;
  clearEvidence: (nodeId: string) => void;
  clearAllEvidence: () => void;

  // Actions - Beliefs
  updateBeliefs: (beliefs: Record<string, BeliefDistribution>) => void;

  // Actions - Highlighting
  highlightCausalPath: (nodeId: string) => void;
  clearHighlight: () => void;

  // Helpers
  getNodesByCategory: (category: NodeCategory) => NetworkNodeData[];
  getNodesInContainer: (containerId: string) => NetworkNodeData[];
  getParentNodes: (nodeId: string) => NetworkNodeData[];
  getChildNodes: (nodeId: string) => NetworkNodeData[];
}

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

export const useNetworkStore = create<NetworkState>()(
  devtools(
    (set, get) => ({
      // Initial state
      model: null,
      nodeMap: new Map(),
      containerMap: new Map(),
      evidence: {},
      selectedNodeId: null,
      selectedContainerId: null,
      highlightedPath: [],
      isLoading: false,
      isInferenceRunning: false,
      _loadGeneration: 0,

      // =======================================================================
      // MODEL ACTIONS
      // =======================================================================

      loadModel: (model) => {
        const nodeMap = new Map(model.nodes.map(n => [n.id, n]));
        const containerMap = new Map(model.containers.map(c => [c.id, c]));

        set({
          model,
          nodeMap,
          containerMap,
          evidence: {},
          selectedNodeId: null,
          selectedContainerId: null,
          highlightedPath: [],
        });
      },

      loadDummyModel: () => {
        const dummyModel = createDummyNetwork();
        get().loadModel(dummyModel);
      },

      loadTrainedModel: async (source: 'expert' | 'learned' = 'expert') => {
        if (source === 'learned') {
          try {
            const learnedJson = await import('@/data/bn-rrm/learned-model.json');
            const trainedModel = createTrainedNetwork('learned', learnedJson.default ?? learnedJson);
            get().loadModel(trainedModel);
          } catch {
            // Fallback to expert if learned model not available
            const trainedModel = createTrainedNetwork('expert');
            get().loadModel(trainedModel);
          }
        } else {
          const trainedModel = createTrainedNetwork('expert');
          get().loadModel(trainedModel);
        }
      },

      loadPackModel: async (packBaseUrl: string, manifest: PackManifest) => {
        const generation = get()._loadGeneration + 1;
        set({ isLoading: true, _loadGeneration: generation });
        try {
          const modelUrl = `${packBaseUrl}/${manifest.artifacts.runtime_model}`;
          const res = await fetch(modelUrl);
          if (!res.ok) {
            throw new Error(`Failed to load runtime model: ${res.status} ${res.statusText}`);
          }
          const learnedJson = await res.json();
          // Guard against stale fetch: if another loadPackModel was called, discard this result
          if (get()._loadGeneration !== generation) return;

          // Dispatch: generic packs build entirely from JSON; canonical packs
          // use the hardcoded 20-node skeleton with learned CPTs overlaid.
          const model = manifest.runtime_schema_version === 'generic-bn-rrm-v1'
            ? createGenericNetwork(learnedJson)
            : createTrainedNetwork('learned', learnedJson);

          get().loadModel(model);
        } catch (err) {
          if (get()._loadGeneration !== generation) return;
          console.error('[NetworkStore] Pack model load failed:', err);
          // Fallback to expert model (only meaningful for canonical packs)
          const trainedModel = createTrainedNetwork('expert');
          get().loadModel(trainedModel);
        } finally {
          // Only clear loading if this is still the active generation
          if (get()._loadGeneration === generation) {
            set({ isLoading: false });
          }
        }
      },

      runInference: (mode) => {
        const { evidence, model } = get();
        if (!model) return;

        set({ isInferenceRunning: true });

        // All models use the general DAG inference engine
        const result = mode === 'forward'
          ? dagForwardInference(model, evidence)
          : dagBackwardInference(model, evidence);

        const beliefs: Record<string, Record<string, number>> = {};
        for (const [nodeId, dist] of Object.entries(result.beliefs)) {
          beliefs[nodeId] = dist;
        }

        get().updateBeliefs(beliefs);
        set({ isInferenceRunning: false });
      },

      // =======================================================================
      // NODE ACTIONS
      // =======================================================================

      selectNode: (nodeId) => {
        set({ selectedNodeId: nodeId });
        if (nodeId) {
          get().highlightCausalPath(nodeId);
        } else {
          get().clearHighlight();
        }
      },

      updateNodePosition: (_nodeId, _position) => {
        // Position updates are handled by React Flow
      },

      // =======================================================================
      // CONTAINER ACTIONS
      // =======================================================================

      selectContainer: (containerId) => {
        set({ selectedContainerId: containerId });
      },

      toggleContainer: (containerId) => {
        const { model, containerMap } = get();
        if (!model) return;

        const container = containerMap.get(containerId);
        if (!container) return;

        const updatedContainers = model.containers.map(c =>
          c.id === containerId ? { ...c, collapsed: !c.collapsed } : c
        );

        const newContainerMap = new Map(updatedContainers.map(c => [c.id, c]));

        set({
          model: { ...model, containers: updatedContainers },
          containerMap: newContainerMap,
        });
      },

      expandAllContainers: () => {
        const { model } = get();
        if (!model) return;

        const updatedContainers = model.containers.map(c => ({
          ...c,
          collapsed: false,
        }));

        const newContainerMap = new Map(updatedContainers.map(c => [c.id, c]));

        set({
          model: { ...model, containers: updatedContainers },
          containerMap: newContainerMap,
        });
      },

      collapseAllContainers: () => {
        const { model } = get();
        if (!model) return;

        const updatedContainers = model.containers.map(c => ({
          ...c,
          collapsed: true,
        }));

        const newContainerMap = new Map(updatedContainers.map(c => [c.id, c]));

        set({
          model: { ...model, containers: updatedContainers },
          containerMap: newContainerMap,
        });
      },

      // =======================================================================
      // EVIDENCE ACTIONS
      // =======================================================================

      setEvidence: (nodeId, state) => {
        const { evidence, model } = get();
        if (!model) return;

        const newEvidence = { ...evidence, [nodeId]: state };

        const updatedNodes = model.nodes.map(n => {
          if (n.id === nodeId) {
            const newBeliefs: BeliefDistribution = {};
            n.states.forEach(s => {
              newBeliefs[s.id] = s.id === state ? 1.0 : 0.0;
            });
            return { ...n, evidence: state, beliefs: newBeliefs };
          }
          return n;
        });

        const newNodeMap = new Map(updatedNodes.map(n => [n.id, n]));

        set({
          evidence: newEvidence,
          model: { ...model, nodes: updatedNodes },
          nodeMap: newNodeMap,
        });

        setTimeout(() => get().runInference('forward'), 0);
      },

      clearEvidence: (nodeId) => {
        const { evidence, model } = get();
        if (!model) return;

        const { [nodeId]: _, ...newEvidence } = evidence;

        const updatedNodes = model.nodes.map(n => {
          if (n.id === nodeId) {
            const uniformProb = 1.0 / n.states.length;
            const newBeliefs: BeliefDistribution = {};
            n.states.forEach(s => {
              newBeliefs[s.id] = uniformProb;
            });
            return { ...n, evidence: null, beliefs: newBeliefs };
          }
          return n;
        });

        const newNodeMap = new Map(updatedNodes.map(n => [n.id, n]));

        set({
          evidence: newEvidence,
          model: { ...model, nodes: updatedNodes },
          nodeMap: newNodeMap,
        });

        setTimeout(() => get().runInference('forward'), 0);
      },

      clearAllEvidence: () => {
        const { model } = get();
        if (!model) return;

        const updatedNodes = model.nodes.map(n => {
          const uniformProb = 1.0 / n.states.length;
          const newBeliefs: BeliefDistribution = {};
          n.states.forEach(s => {
            newBeliefs[s.id] = uniformProb;
          });
          return { ...n, evidence: null, beliefs: newBeliefs };
        });

        const newNodeMap = new Map(updatedNodes.map(n => [n.id, n]));

        set({
          evidence: {},
          model: { ...model, nodes: updatedNodes },
          nodeMap: newNodeMap,
        });
      },

      // =======================================================================
      // BELIEF ACTIONS
      // =======================================================================

      updateBeliefs: (beliefs) => {
        const { model } = get();
        if (!model) return;

        const updatedNodes = model.nodes.map(n => {
          if (beliefs[n.id]) {
            return { ...n, beliefs: beliefs[n.id] };
          }
          return n;
        });

        const newNodeMap = new Map(updatedNodes.map(n => [n.id, n]));

        set({
          model: { ...model, nodes: updatedNodes },
          nodeMap: newNodeMap,
        });
      },

      // =======================================================================
      // HIGHLIGHTING ACTIONS
      // =======================================================================

      highlightCausalPath: (nodeId) => {
        const { model } = get();
        if (!model) return;

        const ancestors = new Set<string>();
        const queue = [nodeId];

        while (queue.length > 0) {
          const current = queue.shift()!;
          model.edges.forEach(edge => {
            if (edge.target === current && !ancestors.has(edge.source)) {
              ancestors.add(edge.source);
              queue.push(edge.source);
            }
          });
        }

        set({ highlightedPath: [nodeId, ...Array.from(ancestors)] });
      },

      clearHighlight: () => {
        set({ highlightedPath: [] });
      },

      // =======================================================================
      // HELPER METHODS
      // =======================================================================

      getNodesByCategory: (category) => {
        const { model } = get();
        if (!model) return [];
        return model.nodes.filter(n => n.category === category);
      },

      getNodesInContainer: (containerId) => {
        const { model, containerMap } = get();
        if (!model) return [];

        const container = containerMap.get(containerId);
        if (!container) return [];

        return model.nodes.filter(n => container.childNodeIds.includes(n.id));
      },

      getParentNodes: (nodeId) => {
        const { model, nodeMap } = get();
        if (!model) return [];

        const parentIds = model.edges
          .filter(e => e.target === nodeId)
          .map(e => e.source);

        return parentIds
          .map(id => nodeMap.get(id))
          .filter((n): n is NetworkNodeData => n !== undefined);
      },

      getChildNodes: (nodeId) => {
        const { model, nodeMap } = get();
        if (!model) return [];

        const childIds = model.edges
          .filter(e => e.source === nodeId)
          .map(e => e.target);

        return childIds
          .map(id => nodeMap.get(id))
          .filter((n): n is NetworkNodeData => n !== undefined);
      },
    }),
    { name: 'bn-rrm-network-store' }
  )
);
