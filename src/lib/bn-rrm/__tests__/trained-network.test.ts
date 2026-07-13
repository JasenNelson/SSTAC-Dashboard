import { describe, it, expect } from 'vitest';
import { createTrainedNetwork, createGenericNetwork } from '../trained-network';
import type { NetworkModel } from '@/types/bn-rrm/network';

describe('trained-network', () => {
  describe('createTrainedNetwork', () => {
    it('returns the 20-node DAG and deep-copies models', () => {
      const model1 = createTrainedNetwork('expert');
      expect(model1.nodes.length).toBe(20);

      const model2 = createTrainedNetwork('expert');
      // Mutating one's node beliefs does NOT affect the other
      model1.nodes[0].beliefs['test_state'] = 0.99;
      expect(model2.nodes[0].beliefs['test_state']).toBeUndefined();
    });
  });

  describe('createGenericNetwork', () => {
    it('throws on empty nodes', () => {
      const badJson: any = {
        nodes: [],
        edges: [{ source: 'A', target: 'B' }],
        containers: [],
        cpts: []
      };
      expect(() => createGenericNetwork(badJson)).toThrow('Generic network JSON must contain at least one node.');
    });

    it('throws on empty edges', () => {
      const badJson: any = {
        nodes: [{ id: 'A', category: 'substance', states: [], beliefs: {} }],
        edges: [],
        containers: [],
        cpts: []
      };
      expect(() => createGenericNetwork(badJson)).toThrow('Generic network JSON must contain at least one edge.');
    });

    it('accepts canonical CPT key convention (parentNodeIds/entries)', () => {
      const json: any = {
        nodes: [{ id: 'A', category: 'substance', states: [], beliefs: {} }, { id: 'B', category: 'effect', states: [], beliefs: {} }],
        edges: [{ source: 'A', target: 'B' }],
        containers: [],
        cpts: [
          {
            nodeId: 'B',
            parentNodeIds: ['A'],
            entries: [{ parentStates: { A: 'state1' }, distribution: { state2: 1 } }]
          }
        ]
      };
      const model = createGenericNetwork(json);
      expect(model.cpts[0].parentNodeIds).toEqual(['A']);
      expect(model.cpts[0].entries[0].distribution).toEqual({ state2: 1 });
    });

    it('accepts alternate CPT key convention (parentIds/table)', () => {
      const json: any = {
        nodes: [{ id: 'A', category: 'substance', states: [], beliefs: {} }, { id: 'B', category: 'effect', states: [], beliefs: {} }],
        edges: [{ source: 'A', target: 'B' }],
        containers: [],
        cpts: [
          {
            nodeId: 'B',
            parentIds: ['A'],
            table: [{ parentStates: { A: 'state1' }, probabilities: { state2: 1 } }]
          }
        ]
      };
      const model = createGenericNetwork(json);
      expect(model.cpts[0].parentNodeIds).toEqual(['A']);
      expect(model.cpts[0].entries[0].distribution).toEqual({ state2: 1 });
    });
  });
});
