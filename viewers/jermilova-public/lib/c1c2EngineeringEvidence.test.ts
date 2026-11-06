import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dagForwardInference } from '../../../src/lib/bn-rrm/bn-inference';
import { createGenericNetwork } from '../../../src/lib/bn-rrm/trained-network';
import type { Evidence, NetworkModel } from '../../../src/types/bn-rrm/network';
import { useNetworkStore } from '../forked/networkStore';
import { JERMILOVA_VIEWER_CAPABILITIES } from '../viewer-capabilities';

const C1_THRESHOLD = 1e-12;
const C2_THRESHOLD = 0.005;
const repoRoot = path.resolve(__dirname, '../../..');
const runtimePath = path.join(
  repoRoot,
  'viewers',
  'jermilova-public',
  'public',
  'bn-rrm',
  'packs',
  JERMILOVA_VIEWER_CAPABILITIES.packId,
  'runtime',
  'learned-model.json',
);
const evidenceDir = path.join(repoRoot, '.tmp', 'bnrrm-about-c1c2-r1');

interface RawNode {
  id: string;
  states: Array<{ id: string }>;
  beliefs: Record<string, number>;
}

interface RawCptRow {
  parentStates: Record<string, string>;
  probabilities: Record<string, number>;
}

interface RawCpt {
  nodeId: string;
  parentIds: string[];
  table: RawCptRow[];
}

interface RawRuntime {
  nodes: RawNode[];
  edges: Array<{ source: string; target: string }>;
  cpts: RawCpt[];
}

interface Difference {
  error: number;
  nodeId: string;
  stateId: string;
  scenario: string;
}

interface C1Report {
  threshold: number;
  status: 'PASS' | 'FAIL';
  collectedCases: number;
  executedCases: number;
  probabilityComparisons: number;
  maximumError: number;
  maximumLocation: Difference | null;
  offender: Difference | null;
  scenarios: string[];
  failedCases: Array<{ scenario: string; maximumError: number; offender: Difference }>;
}

interface C2Report {
  threshold: number;
  status: 'PASS' | 'FAIL';
  storedValuesCollected: number;
  independentlyRecomputedValues: number;
  inputOnlyValues: number;
  absentComparisonValues: Array<{ nodeId: string; stateId: string; reason: string }>;
  maximumAbsoluteDifference: number;
  maximumLocation: Difference | null;
  offender: Difference | null;
}

function readRuntime(): RawRuntime {
  return JSON.parse(fs.readFileSync(runtimePath, 'utf8')) as RawRuntime;
}

function freshModel(): NetworkModel {
  return createGenericNetwork(readRuntime() as unknown as Parameters<typeof createGenericNetwork>[0]);
}

function requireFiniteProbability(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} is non-finite.`);
  return value;
}

function maxDifference(
  expected: Record<string, Record<string, number>>,
  actual: Record<string, Record<string, number>>,
  scenario: string,
): { maximum: Difference | null; comparisons: number } {
  let maximum: Difference | null = null;
  let comparisons = 0;
  for (const [nodeId, distribution] of Object.entries(expected)) {
    for (const [stateId, expectedValue] of Object.entries(distribution)) {
      requireFiniteProbability(expectedValue, `C1 expected probability '${nodeId}.${stateId}'`);
      const actualValue = actual[nodeId]?.[stateId];
      if (actualValue !== undefined) requireFiniteProbability(actualValue, `C1 actual probability '${nodeId}.${stateId}'`);
      const error = actualValue === undefined ? Number.POSITIVE_INFINITY : Math.abs(actualValue - expectedValue);
      if (actualValue !== undefined) requireFiniteProbability(error, `C1 probability error '${nodeId}.${stateId}'`);
      comparisons += 1;
      if (!maximum || error > maximum.error) maximum = { error, nodeId, stateId, scenario };
    }
  }
  return { maximum, comparisons };
}

function currentBeliefs(): Record<string, Record<string, number>> {
  const model = useNetworkStore.getState().model;
  if (!model) throw new Error('Viewer store has no model.');
  return Object.fromEntries(model.nodes.map((node) => [node.id, { ...node.beliefs }]));
}

function resetViewerStore(): void {
  useNetworkStore.setState(useNetworkStore.getInitialState(), true);
  useNetworkStore.getState().loadModel(freshModel());
}

async function settleViewerInference(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

async function executeC1(): Promise<C1Report> {
  const scenarios: string[] = [];
  let comparisons = 0;
  const maxima: Difference[] = [];
  let collectedCases = 0;
  let executedCases = 0;
  const failedCases: C1Report['failedCases'] = [];

  const compare = (scenario: string, evidence: Evidence) => {
    collectedCases += 1;
    const expected = dagForwardInference(freshModel(), evidence).beliefs;
    const result = maxDifference(expected, currentBeliefs(), scenario);
    comparisons += result.comparisons;
    scenarios.push(scenario);
    executedCases += 1;
    if (result.maximum && result.maximum.error > C1_THRESHOLD) {
      failedCases.push({ scenario, maximumError: result.maximum.error, offender: result.maximum });
    }
    if (result.maximum) maxima.push(result.maximum);
  };

  resetViewerStore();
  useNetworkStore.getState().runInference('forward');
  compare('fresh baseline recompute', {});

  const model = freshModel();
  const roots = JERMILOVA_VIEWER_CAPABILITIES.evidenceNodeIds.map((id) => {
    const node = model.nodes.find((candidate) => candidate.id === id);
    if (!node) throw new Error(`Approved root '${id}' is absent.`);
    return node;
  });

  for (const root of roots) {
    for (const state of root.states) {
      resetViewerStore();
      useNetworkStore.getState().setEvidence(root.id, state.id);
      await settleViewerInference();
      compare(`single root ${root.id}=${state.id}`, { [root.id]: state.id });
    }

    resetViewerStore();
    const first = root.states[0].id;
    const last = root.states[root.states.length - 1].id;
    useNetworkStore.getState().setEvidence(root.id, first);
    await settleViewerInference();
    compare(`set ${root.id}=${first}`, { [root.id]: first });
    useNetworkStore.getState().setEvidence(root.id, last);
    await settleViewerInference();
    compare(`change ${root.id}=${last}`, { [root.id]: last });
  }

  const firstRoot = roots[0];
  const secondRoot = roots[1];
  const thirdRoot = roots[2];
  const firstState = firstRoot.states[firstRoot.states.length - 1].id;
  const secondState = secondRoot.states[secondRoot.states.length - 1].id;
  const thirdState = thirdRoot.states[thirdRoot.states.length - 1].id;

  resetViewerStore();
  useNetworkStore.getState().setEvidence(firstRoot.id, firstState);
  await settleViewerInference();
  useNetworkStore.getState().setEvidence(secondRoot.id, secondState);
  await settleViewerInference();
  compare('bounded multi-root set', { [firstRoot.id]: firstState, [secondRoot.id]: secondState });

  useNetworkStore.getState().clearEvidence(firstRoot.id);
  await settleViewerInference();
  compare('clear one after multi-root set', { [secondRoot.id]: secondState });

  useNetworkStore.getState().clearAllEvidence();
  compare('clear all after multi-root set', {});

  useNetworkStore.getState().setEvidence(thirdRoot.id, thirdState);
  await settleViewerInference();
  compare('fresh-baseline isolation after clear all and new evidence', { [thirdRoot.id]: thirdState });

  const maximumLocation = maxima.reduce<Difference | null>(
    (current, candidate) => !current || candidate.error > current.error ? candidate : current,
    null,
  );
  const maximumError = maximumLocation?.error ?? 0;
  return {
    threshold: C1_THRESHOLD,
    status: maximumError <= C1_THRESHOLD ? 'PASS' : 'FAIL',
    collectedCases,
    executedCases,
    probabilityComparisons: comparisons,
    maximumError,
    maximumLocation,
    offender: maximumError > C1_THRESHOLD ? maximumLocation : null,
    scenarios,
    failedCases,
  };
}

function independentRecompute(runtime: RawRuntime): Record<string, Record<string, number>> {
  const nodeIds = runtime.nodes.map((node) => node.id);
  const indegree = Object.fromEntries(nodeIds.map((id) => [id, 0]));
  const children = Object.fromEntries(nodeIds.map((id) => [id, [] as string[]]));
  for (const edge of runtime.edges) {
    indegree[edge.target] += 1;
    children[edge.source].push(edge.target);
  }
  const queue = nodeIds.filter((id) => indegree[id] === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift();
    if (!id) break;
    order.push(id);
    for (const child of children[id]) {
      indegree[child] -= 1;
      if (indegree[child] === 0) queue.push(child);
    }
  }
  if (order.length !== nodeIds.length) throw new Error('Frozen runtime graph is not a DAG.');

  const nodes = new Map(runtime.nodes.map((node) => [node.id, node]));
  const cpts = new Map(runtime.cpts.map((cpt) => [cpt.nodeId, cpt]));
  const beliefs: Record<string, Record<string, number>> = {};
  for (const nodeId of order) {
    const node = nodes.get(nodeId);
    if (!node) throw new Error(`Missing runtime node '${nodeId}'.`);
    const cpt = cpts.get(nodeId);
    if (!cpt) {
      beliefs[nodeId] = Object.fromEntries(Object.entries(node.beliefs).map(([stateId, probability]) => [
        stateId,
        requireFiniteProbability(probability, `C2 root probability '${nodeId}.${stateId}'`),
      ]));
      continue;
    }
    const distribution = Object.fromEntries(node.states.map((state) => [state.id, 0]));
    for (const row of cpt.table) {
      let weight = 1;
      for (const parentId of cpt.parentIds) {
        const parentProbability = beliefs[parentId]?.[row.parentStates[parentId]] ?? 0;
        requireFiniteProbability(parentProbability, `C2 parent probability '${parentId}.${row.parentStates[parentId]}'`);
        weight *= parentProbability;
        requireFiniteProbability(weight, `C2 row weight for '${nodeId}'`);
      }
      for (const [stateId, probability] of Object.entries(row.probabilities)) {
        requireFiniteProbability(probability, `C2 CPT probability '${nodeId}.${stateId}'`);
        distribution[stateId] = (distribution[stateId] ?? 0) + weight * probability;
        requireFiniteProbability(distribution[stateId], `C2 reconstructed probability mass '${nodeId}.${stateId}'`);
      }
    }
    const total = Object.values(distribution).reduce((sum, probability) => sum + probability, 0);
    requireFiniteProbability(total, `C2 normalization mass for '${nodeId}'`);
    if (total <= 0) throw new Error(`Independent reconstruction produced zero mass for '${nodeId}'.`);
    for (const stateId of Object.keys(distribution)) {
      distribution[stateId] /= total;
      requireFiniteProbability(distribution[stateId], `C2 normalized probability '${nodeId}.${stateId}'`);
    }
    beliefs[nodeId] = distribution;
  }
  return beliefs;
}

function executeC2(runtime: RawRuntime): C2Report {
  const recomputed = independentRecompute(runtime);
  const cptNodes = new Set(runtime.cpts.map((cpt) => cpt.nodeId));
  const absentComparisonValues: C2Report['absentComparisonValues'] = [];
  let storedValuesCollected = 0;
  let independentlyRecomputedValues = 0;
  let inputOnlyValues = 0;
  let offender: Difference | null = null;

  for (const node of runtime.nodes) {
    for (const [stateId, storedValue] of Object.entries(node.beliefs)) {
      requireFiniteProbability(storedValue, `C2 stored probability '${node.id}.${stateId}'`);
      storedValuesCollected += 1;
      if (!cptNodes.has(node.id)) {
        inputOnlyValues += 1;
        continue;
      }
      const independentValue = recomputed[node.id]?.[stateId];
      if (independentValue === undefined) {
        absentComparisonValues.push({ nodeId: node.id, stateId, reason: 'independent reconstruction produced no value' });
        continue;
      }
      requireFiniteProbability(independentValue, `C2 reconstructed probability '${node.id}.${stateId}'`);
      independentlyRecomputedValues += 1;
      const error = Math.abs(independentValue - storedValue);
      requireFiniteProbability(error, `C2 probability error '${node.id}.${stateId}'`);
      if (!offender || error > offender.error) {
        offender = { error, nodeId: node.id, stateId, scenario: 'C2 fresh no-evidence reconstruction' };
      }
    }
  }

  const maximumAbsoluteDifference = offender?.error ?? 0;
  return {
    threshold: C2_THRESHOLD,
    status: absentComparisonValues.length === 0 && maximumAbsoluteDifference <= C2_THRESHOLD ? 'PASS' : 'FAIL',
    storedValuesCollected,
    independentlyRecomputedValues,
    inputOnlyValues,
    absentComparisonValues,
    maximumAbsoluteDifference,
    maximumLocation: offender,
    offender: maximumAbsoluteDifference > C2_THRESHOLD ? offender : null,
  };
}

describe('Jermilova C1/C2 engineering evidence', () => {
  it('executes C1 through the viewer store and records the current threshold result', async () => {
    const c1 = await executeC1();
    expect(c1.collectedCases).toBe(c1.executedCases);
    expect(c1.executedCases).toBeGreaterThan(30);
    expect(c1.probabilityComparisons).toBeGreaterThan(1_000);
    expect(c1.maximumError).toBeLessThanOrEqual(C1_THRESHOLD);
    expect(c1.failedCases).toEqual([]);
    expect(c1.status).toBe('PASS');

    const c2 = executeC2(readRuntime());
    const evidencePath = path.join(evidenceDir, c1.status === 'FAIL' ? 'C1_C2_RESULTS_PRE_FIX.json' : 'C1_C2_RESULTS_POST_FIX.json');
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    fs.writeFileSync(evidencePath, `${JSON.stringify({ generatedBy: 'c1c2EngineeringEvidence.test.ts', c1, c2 }, null, 2)}\n`, 'utf8');
  });

  it('independently reconstructs C2 from the fresh frozen model within 0.005', () => {
    const c2 = executeC2(readRuntime());
    expect(c2.absentComparisonValues).toEqual([]);
    expect(c2.independentlyRecomputedValues).toBeGreaterThan(0);
    expect(c2.inputOnlyValues).toBeGreaterThan(0);
    expect(c2.independentlyRecomputedValues + c2.inputOnlyValues).toBe(c2.storedValuesCollected);
    expect(c2.maximumAbsoluteDifference).toBeLessThanOrEqual(C2_THRESHOLD);
    expect(c2.status).toBe('PASS');
  });

  it('detects planted in-memory defects without changing the frozen asset', () => {
    const clean = readRuntime();
    const mutated = structuredClone(clean);
    const cpt = mutated.cpts[0];
    for (const row of cpt.table) {
      const states = Object.keys(row.probabilities);
      states.forEach((stateId, index) => {
        row.probabilities[stateId] = index === 0 ? 1 : 0;
      });
    }
    const mutatedC2 = executeC2(mutated);
    expect(mutatedC2.maximumAbsoluteDifference).toBeGreaterThan(C2_THRESHOLD);

    const expected = dagForwardInference(freshModel(), {}).beliefs;
    const uniformRootModel = freshModel();
    const rootIds = new Set<string>(JERMILOVA_VIEWER_CAPABILITIES.evidenceNodeIds);
    for (const node of uniformRootModel.nodes.filter((candidate) => rootIds.has(candidate.id))) {
      const uniform = 1 / node.states.length;
      node.beliefs = Object.fromEntries(node.states.map((state) => [state.id, uniform]));
    }
    const planted = dagForwardInference(uniformRootModel, {}).beliefs;
    expect(maxDifference(expected, planted, 'planted uniform-root defect').maximum?.error).toBeGreaterThan(C1_THRESHOLD);
    expect(readRuntime()).toEqual(clean);
  });

  it('fails closed on non-finite C1 and C2 probabilities', () => {
    expect(() => maxDifference(
      { probe: { state: Number.NaN } },
      { probe: { state: 0 } },
      'non-finite expected probe',
    )).toThrow(/C1 expected probability.*non-finite/);
    expect(() => maxDifference(
      { probe: { state: 0 } },
      { probe: { state: Number.POSITIVE_INFINITY } },
      'non-finite actual probe',
    )).toThrow(/C1 actual probability.*non-finite/);

    const nonFiniteStored = structuredClone(readRuntime());
    const storedNode = nonFiniteStored.nodes.find((node) => nonFiniteStored.cpts.some((cpt) => cpt.nodeId === node.id));
    if (!storedNode) throw new Error('Negative probe requires a stored C2 node.');
    storedNode.beliefs[Object.keys(storedNode.beliefs)[0]] = Number.NaN;
    expect(() => executeC2(nonFiniteStored)).toThrow(/C2 stored probability.*non-finite/);

    const nonFiniteReconstruction = structuredClone(readRuntime());
    const reconstructedCpt = nonFiniteReconstruction.cpts[0];
    const reconstructedState = Object.keys(reconstructedCpt.table[0].probabilities)[0];
    reconstructedCpt.table[0].probabilities[reconstructedState] = Number.POSITIVE_INFINITY;
    expect(() => executeC2(nonFiniteReconstruction)).toThrow(/C2 CPT probability.*non-finite/);
  });
});
