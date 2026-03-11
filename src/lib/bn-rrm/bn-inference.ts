/**
 * Bayesian Network Inference Engine
 *
 * General-purpose DAG inference for the BN-RRM causal model.
 * All inference operates on NetworkModel structures — no hardcoded model assumptions.
 * Operates entirely in the browser — no backend needed.
 */

import type {
  NetworkModel,
  ConditionalProbabilityTable,
  BeliefDistribution,
  Evidence,
  InferenceResult,
  BackwardInferenceRequest,
  BackwardInferenceResult,
} from '@/types/bn-rrm/network';
import type { SiteData } from '@/types/bn-rrm/site-data';

// =============================================================================
// CCME ISQG/PEL THRESHOLDS (Marine sediment quality guidelines)
// =============================================================================

export const CCME_THRESHOLDS: Record<string, { isqg: number; pel: number; unit: string }> = {
  copper:    { isqg: 18.7,  pel: 108,   unit: 'mg/kg' },
  zinc:      { isqg: 124,   pel: 271,   unit: 'mg/kg' },
  lead:      { isqg: 30.2,  pel: 112,   unit: 'mg/kg' },
  cadmium:   { isqg: 0.70,  pel: 4.2,   unit: 'mg/kg' },
  mercury:   { isqg: 0.13,  pel: 0.70,  unit: 'mg/kg' },
  arsenic:   { isqg: 7.24,  pel: 41.6,  unit: 'mg/kg' },
  chromium:  { isqg: 52.3,  pel: 160,   unit: 'mg/kg' },
  totalPAHs: { isqg: 1684,  pel: 16770, unit: 'μg/kg' },
  totalPCBs: { isqg: 21.5,  pel: 189,   unit: 'μg/kg' },
};

// =============================================================================
// TOPOLOGICAL SORT
// =============================================================================

/**
 * Topological sort of nodes in a NetworkModel DAG.
 * Returns node IDs in order such that parents come before children.
 */
function topologicalSort(model: NetworkModel): string[] {
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  for (const node of model.nodes) {
    inDegree[node.id] = 0;
    adj[node.id] = [];
  }
  for (const edge of model.edges) {
    adj[edge.source]?.push(edge.target);
    inDegree[edge.target] = (inDegree[edge.target] ?? 0) + 1;
  }

  const queue = Object.keys(inDegree).filter(id => inDegree[id] === 0);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const child of (adj[node] ?? [])) {
      inDegree[child]--;
      if (inDegree[child] === 0) queue.push(child);
    }
  }

  return sorted;
}

/**
 * Get the CPT for a node, or null if it's a root node (uses priors).
 */
function getCPT(model: NetworkModel, nodeId: string): ConditionalProbabilityTable | null {
  return model.cpts.find(c => c.nodeId === nodeId) ?? null;
}

// =============================================================================
// FORWARD INFERENCE (Variable Elimination on DAG)
// =============================================================================

/**
 * Forward inference on any NetworkModel DAG using variable elimination.
 *
 * Given evidence on any node(s), propagates beliefs through the entire DAG.
 * Nodes with evidence are clamped to delta distributions.
 * Nodes without evidence are computed by marginalizing over parent distributions × CPT.
 */
export function dagForwardInference(
  model: NetworkModel,
  evidence: Evidence,
): InferenceResult {
  const start = performance.now();
  const beliefs: Record<string, BeliefDistribution> = {};
  const sorted = topologicalSort(model);

  for (const nodeId of sorted) {
    const node = model.nodes.find(n => n.id === nodeId);
    if (!node) continue;

    const evidenceState = evidence[nodeId];

    if (evidenceState) {
      // Clamped to observed state
      const dist: BeliefDistribution = {};
      node.states.forEach(s => { dist[s.id] = s.id === evidenceState ? 1.0 : 0.0; });
      beliefs[nodeId] = dist;
      continue;
    }

    const cpt = getCPT(model, nodeId);
    if (!cpt || cpt.entries.length === 0) {
      // Root node without CPT — use prior beliefs from the node
      beliefs[nodeId] = { ...node.beliefs };
      continue;
    }

    // Marginalize: sum over all parent state combos
    const dist: BeliefDistribution = {};
    node.states.forEach(s => { dist[s.id] = 0; });

    for (const entry of cpt.entries) {
      // Weight = product of parent beliefs for this parent state combo
      let weight = 1;
      for (const parentId of cpt.parentNodeIds) {
        const parentState = entry.parentStates[parentId];
        const parentBeliefs = beliefs[parentId];
        if (!parentBeliefs) { weight = 0; break; }
        weight *= parentBeliefs[parentState] ?? 0;
      }

      if (weight === 0) continue;

      // Add weighted contribution
      for (const stateId of Object.keys(entry.distribution)) {
        dist[stateId] = (dist[stateId] ?? 0) + weight * (entry.distribution[stateId] ?? 0);
      }
    }

    // Normalize
    const sum = Object.values(dist).reduce((a, b) => a + b, 0);
    if (sum > 0) {
      for (const key of Object.keys(dist)) {
        dist[key] /= sum;
      }
    }

    beliefs[nodeId] = dist;
  }

  return {
    beliefs,
    computationTimeMs: performance.now() - start,
    algorithm: 'variable-elimination-dag',
  };
}

// =============================================================================
// BACKWARD INFERENCE (Belief Propagation on DAG)
// =============================================================================

/**
 * Backward inference on any NetworkModel DAG.
 *
 * Given a target state on the impact node, back-propagates to find
 * parent state probabilities consistent with that target.
 * Uses Bayes' theorem: P(Parent | Target) ∝ P(Target | Parent) × P(Parent)
 */
export function dagBackwardInference(
  model: NetworkModel,
  evidence: Evidence,
): InferenceResult {
  const start = performance.now();

  // First, do forward inference to get baseline beliefs
  const forwardResult = dagForwardInference(model, evidence);
  const beliefs = { ...forwardResult.beliefs };

  // Find impact nodes with evidence set (these are the backward targets)
  const impactNodes = model.nodes.filter(n => n.category === 'impact' && evidence[n.id]);

  if (impactNodes.length === 0) {
    return { ...forwardResult, algorithm: 'backward-variable-elimination-dag' };
  }

  // For each non-evidence node, compute posterior given the impact evidence
  // using iterative belief propagation (simplified)
  const sorted = topologicalSort(model);
  const reverseSorted = [...sorted].reverse();

  // Multiple passes to propagate backward through the chain
  for (let pass = 0; pass < 3; pass++) {
    for (const nodeId of reverseSorted) {
      if (evidence[nodeId]) continue;

      const node = model.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      // Find children of this node
      const childEdges = model.edges.filter(e => e.source === nodeId);
      if (childEdges.length === 0) continue;

      // For each child, compute likelihood of child's current beliefs given this parent's states
      const posterior: BeliefDistribution = {};
      node.states.forEach(s => { posterior[s.id] = node.beliefs[s.id] ?? (1 / node.states.length); });

      for (const childEdge of childEdges) {
        const childId = childEdge.target;
        const childBeliefs = beliefs[childId];
        if (!childBeliefs) continue;

        const childCPT = getCPT(model, childId);
        if (!childCPT) continue;

        // For each state of this parent, compute P(child evidence | parent=state)
        for (const state of node.states) {
          let likelihood = 0;
          const relevantEntries = childCPT.entries.filter(
            e => e.parentStates[nodeId] === state.id,
          );

          for (const entry of relevantEntries) {
            // Product of other parent beliefs
            let otherParentProb = 1;
            for (const pid of childCPT.parentNodeIds) {
              if (pid === nodeId) continue;
              const pBeliefs = beliefs[pid];
              if (pBeliefs) {
                otherParentProb *= pBeliefs[entry.parentStates[pid]] ?? 0;
              }
            }

            // Sum over child states weighted by child beliefs
            let childLikelihood = 0;
            for (const [childState, prob] of Object.entries(entry.distribution)) {
              childLikelihood += prob * (childBeliefs[childState] ?? 0);
            }

            likelihood += otherParentProb * childLikelihood;
          }

          posterior[state.id] = (posterior[state.id] ?? 0) * Math.max(likelihood, 1e-10);
        }
      }

      // Normalize
      const sum = Object.values(posterior).reduce((a, b) => a + b, 0);
      if (sum > 0) {
        for (const key of Object.keys(posterior)) {
          posterior[key] /= sum;
        }
      }

      beliefs[nodeId] = posterior;
    }

    // Re-run forward on updated root beliefs for next pass
    for (const nodeId of sorted) {
      if (evidence[nodeId]) continue;
      const cpt = getCPT(model, nodeId);
      if (!cpt || cpt.entries.length === 0) continue;

      const dist: BeliefDistribution = {};
      const node = model.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      node.states.forEach(s => { dist[s.id] = 0; });

      for (const entry of cpt.entries) {
        let weight = 1;
        for (const parentId of cpt.parentNodeIds) {
          weight *= beliefs[parentId]?.[entry.parentStates[parentId]] ?? 0;
        }
        if (weight === 0) continue;
        for (const stateId of Object.keys(entry.distribution)) {
          dist[stateId] = (dist[stateId] ?? 0) + weight * (entry.distribution[stateId] ?? 0);
        }
      }

      const sum = Object.values(dist).reduce((a, b) => a + b, 0);
      if (sum > 0) {
        for (const key of Object.keys(dist)) dist[key] /= sum;
      }
      beliefs[nodeId] = dist;
    }
  }

  return {
    beliefs,
    computationTimeMs: performance.now() - start,
    algorithm: 'backward-variable-elimination-dag',
  };
}

// =============================================================================
// SENSITIVITY ANALYSIS
// =============================================================================

/**
 * Compute DAG sensitivity: for each root node, vary from its "best" to "worst"
 * state and measure change in P(impact worst state).
 */
export function dagComputeSensitivity(
  model: NetworkModel,
  impactNodeId: string,
  worstState: string,
  fixedEvidence: Evidence = {},
): { parameter: string; label: string; lowValueImpact: number; highValueImpact: number; range: number }[] {
  const results: { parameter: string; label: string; lowValueImpact: number; highValueImpact: number; range: number }[] = [];

  // Find root nodes (no incoming edges)
  const hasIncoming = new Set(model.edges.map(e => e.target));
  const rootNodes = model.nodes.filter(n => !hasIncoming.has(n.id) && !fixedEvidence[n.id]);

  for (const rootNode of rootNodes) {
    const states = rootNode.states;
    if (states.length < 2) continue;

    const bestState = states[0].id; // First state = "best" (low/below_isqg)
    const worstNodeState = states[states.length - 1].id; // Last = worst

    const bestResult = dagForwardInference(model, { ...fixedEvidence, [rootNode.id]: bestState });
    const worstResult = dagForwardInference(model, { ...fixedEvidence, [rootNode.id]: worstNodeState });

    const pBest = bestResult.beliefs[impactNodeId]?.[worstState] ?? 0;
    const pWorst = worstResult.beliefs[impactNodeId]?.[worstState] ?? 0;

    results.push({
      parameter: rootNode.id,
      label: rootNode.label,
      lowValueImpact: pBest,
      highValueImpact: pWorst,
      range: pWorst - pBest,
    });
  }

  results.sort((a, b) => b.range - a.range);
  return results;
}

// =============================================================================
// PROTECTIVE CONCENTRATION SOLVER
// =============================================================================

/**
 * Solve for the protective state of a query node that achieves
 * a target probability on the impact node.
 */
export function dagProtectiveConcentration(
  model: NetworkModel,
  request: BackwardInferenceRequest,
): BackwardInferenceResult {
  const queryNode = model.nodes.find(n => n.id === request.queryNode);
  if (!queryNode) {
    return {
      protectiveState: 'unknown',
      achievedProbability: 0,
      computationSteps: ['Query node not found'],
    };
  }

  const steps: string[] = [];

  // Try each state of the query node and find the one that achieves
  // the target probability for acceptable states
  let bestState = queryNode.states[0].id;
  let bestProb = 0;

  for (const state of queryNode.states) {
    const evidence: Evidence = { ...request.fixedEvidence, [request.queryNode]: state.id };
    const result = dagForwardInference(model, evidence);

    const targetBeliefs = result.beliefs[request.targetNode];
    if (!targetBeliefs) continue;

    const acceptableProb = request.acceptableStates.reduce(
      (sum, s) => sum + (targetBeliefs[s] ?? 0), 0,
    );

    steps.push(`${state.label}: P(${request.acceptableStates.join('|')}) = ${(acceptableProb * 100).toFixed(1)}%`);

    if (acceptableProb >= request.targetProbability && acceptableProb >= bestProb) {
      bestState = state.id;
      bestProb = acceptableProb;
    }
  }

  // If no state achieves the target, pick the one with highest acceptable prob
  if (bestProb < request.targetProbability) {
    let maxProb = 0;
    for (const state of queryNode.states) {
      const evidence: Evidence = { ...request.fixedEvidence, [request.queryNode]: state.id };
      const result = dagForwardInference(model, evidence);
      const targetBeliefs = result.beliefs[request.targetNode];
      if (!targetBeliefs) continue;
      const p = request.acceptableStates.reduce((s, st) => s + (targetBeliefs[st] ?? 0), 0);
      if (p > maxProb) { maxProb = p; bestState = state.id; bestProb = p; }
    }
    steps.push(`Target ${(request.targetProbability * 100).toFixed(0)}% not fully achievable; best: ${(bestProb * 100).toFixed(1)}%`);
  }

  const stateObj = queryNode.states.find(s => s.id === bestState);

  return {
    protectiveState: bestState,
    protectiveValue: stateObj?.maxValue,
    achievedProbability: bestProb,
    computationSteps: steps,
  };
}

// =============================================================================
// SITE DATA CLASSIFICATION — Raw measurements → BN node evidence
// =============================================================================

/**
 * Classify a single chemistry parameter value against CCME thresholds.
 * Returns the appropriate state ID for the substance node.
 */
function classifyChemistry(value: number, param: string): string {
  const thresholds = CCME_THRESHOLDS[param];
  if (!thresholds) return 'isqg_pel'; // default to middle state if unknown
  if (value <= thresholds.isqg) return 'below_isqg';
  if (value <= thresholds.pel) return 'isqg_pel';
  return 'above_pel';
}

/**
 * Classify raw site monitoring data into evidence for the causal BN-RRM.
 *
 * Maps raw chemistry, toxicity, and community measurements directly to
 * MSSHEI node states. Unlike the former WOE classifier, this feeds
 * raw measurements into causal pathways.
 */
export function classifyRawSiteData(site: SiteData): Evidence {
  const evidence: Evidence = {};
  const chem = site.sedimentChemistry;

  if (chem.length > 0) {
    // For each metal/organic parameter, use the maximum observed value
    // across all samples to determine the evidence state (conservative approach)
    const maxValues: Record<string, number> = {};

    for (const sample of chem) {
      if (sample.copper !== undefined) maxValues.copper = Math.max(maxValues.copper ?? 0, sample.copper);
      if (sample.zinc !== undefined) maxValues.zinc = Math.max(maxValues.zinc ?? 0, sample.zinc);
      if (sample.lead !== undefined) maxValues.lead = Math.max(maxValues.lead ?? 0, sample.lead);
      if (sample.cadmium !== undefined) maxValues.cadmium = Math.max(maxValues.cadmium ?? 0, sample.cadmium);
      if (sample.mercury !== undefined) maxValues.mercury = Math.max(maxValues.mercury ?? 0, sample.mercury);
      if (sample.arsenic !== undefined) maxValues.arsenic = Math.max(maxValues.arsenic ?? 0, sample.arsenic);
      if (sample.chromium !== undefined) maxValues.chromium = Math.max(maxValues.chromium ?? 0, sample.chromium);
      if (sample.totalPAHs !== undefined) maxValues.totalPAHs = Math.max(maxValues.totalPAHs ?? 0, sample.totalPAHs);
      if (sample.totalPCBs !== undefined) maxValues.totalPCBs = Math.max(maxValues.totalPCBs ?? 0, sample.totalPCBs);
    }

    // Map parameter names to node IDs
    const paramToNode: Record<string, string> = {
      copper: 'sed_cu', zinc: 'sed_zn', lead: 'sed_pb',
      cadmium: 'sed_cd', mercury: 'sed_hg', arsenic: 'sed_as',
      chromium: 'sed_cr', totalPAHs: 'sed_pahs', totalPCBs: 'sed_pcbs',
    };

    for (const [param, value] of Object.entries(maxValues)) {
      const nodeId = paramToNode[param];
      if (nodeId) {
        evidence[nodeId] = classifyChemistry(value, param);
      }
    }

    // Environmental condition nodes — use average across samples
    const tocValues = chem.map(s => s.toc).filter((v): v is number => v !== undefined);
    if (tocValues.length > 0) {
      const avgToc = tocValues.reduce((a, b) => a + b, 0) / tocValues.length;
      if (avgToc < 1) evidence.toc = 'low';
      else if (avgToc <= 3) evidence.toc = 'medium';
      else evidence.toc = 'high';
    }

    // sulfide_binding (v4.0): 4-state classification from AVS + SEM data
    const avsValues = chem.map(s => s.avs).filter((v): v is number => v !== undefined);
    const semValues = chem.map(s => s.sem).filter((v): v is number => v !== undefined);
    if (avsValues.length > 0 && semValues.length > 0) {
      // Both SEM and AVS measured — use SEM/AVS ratio
      const avgAvs = avsValues.reduce((a, b) => a + b, 0) / avsValues.length;
      const avgSem = semValues.reduce((a, b) => a + b, 0) / semValues.length;
      evidence.sulfide_binding = avgAvs > 0 && avgSem / avgAvs < 1
        ? 'bound_measured'
        : 'excess_measured';
    } else if (avsValues.length > 0) {
      // AVS only — proxy classification
      const avgAvs = avsValues.reduce((a, b) => a + b, 0) / avsValues.length;
      evidence.sulfide_binding = avgAvs >= 5 ? 'bound_proxy' : 'uncertain_proxy';
    } else {
      evidence.sulfide_binding = 'uncertain_proxy';
    }

    const finesValues = chem.map(s => s.percentFines).filter((v): v is number => v !== undefined);
    if (finesValues.length > 0) {
      const avgFines = finesValues.reduce((a, b) => a + b, 0) / finesValues.length;
      if (avgFines < 20) evidence.grain_size = 'coarse';
      else if (avgFines <= 60) evidence.grain_size = 'mixed';
      else evidence.grain_size = 'fine';
    }
  }

  // Toxicity — directly set amphipod toxicity if data available
  if (site.toxicityTests && site.toxicityTests.length > 0) {
    const amphipodTests = site.toxicityTests.filter(t => t.testType === 'amphipod_survival');
    if (amphipodTests.length > 0) {
      const minSurvival = Math.min(...amphipodTests.map(t => t.result));
      if (minSurvival >= 80) evidence.tox_amphipod = 'low';
      else if (minSurvival >= 50) evidence.tox_amphipod = 'moderate';
      else evidence.tox_amphipod = 'high';
    }
  }

  // Community — directly set taxa richness and diversity if data available
  if (site.benthicCommunity && site.benthicCommunity.length > 0) {
    const avgDiversity = site.benthicCommunity.reduce(
      (sum, b) => sum + (b.shannonDiversity ?? 0), 0,
    ) / site.benthicCommunity.length;

    if (avgDiversity > 0) {
      if (avgDiversity >= 2.5) evidence.diversity = 'high';
      else if (avgDiversity >= 1.5) evidence.diversity = 'moderate';
      else evidence.diversity = 'low';
    }

    const avgRichness = site.benthicCommunity.reduce(
      (sum, b) => sum + b.taxaRichness, 0,
    ) / site.benthicCommunity.length;

    if (avgRichness > 0) {
      // Use relative thresholds (these would ideally be site-specific reference-normalized)
      if (avgRichness >= 20) evidence.taxa_richness = 'high';
      else if (avgRichness >= 10) evidence.taxa_richness = 'moderate';
      else evidence.taxa_richness = 'low';
    }
  }

  return evidence;
}

/**
 * Classify multiple sites and aggregate evidence.
 * Combines data from multiple sites to produce aggregate evidence for the causal DAG.
 */
export function classifyMultipleSites(sites: SiteData[]): Evidence {
  // Merge all site data into one virtual site
  const merged: SiteData = {
    location: sites[0]?.location ?? { id: 'merged', name: 'Merged', latitude: 0, longitude: 0, siteType: 'exposure', dateCollected: '' },
    sedimentChemistry: sites.flatMap(s => s.sedimentChemistry),
    toxicityTests: sites.flatMap(s => s.toxicityTests ?? []),
    benthicCommunity: sites.flatMap(s => s.benthicCommunity ?? []),
  };
  return classifyRawSiteData(merged);
}
