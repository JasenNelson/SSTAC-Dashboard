/**
 * Trained BN-RRM Network Model — Landis Causal Framework
 *
 * 20-node causal DAG following Landis (2021) BN-RRM methodology:
 *   Substance (Source) → Conditions (Habitat) → Exposure/Effect (Response) → Impact (Consequence)
 *
 * Substance nodes: individual contaminant parameters (Cu, Zn, Pb, Cd, Hg, As, Cr, PAHs, PCBs)
 * Condition nodes: environmental modifiers (TOC, AVS, grain size)
 * Effect nodes: intermediate causal steps (contamination, bioavailability, toxicity, community)
 * Impact node: integrated ecological risk
 *
 * CPTs at intermediate nodes are expert-elicited (interim).
 * Each expert CPT is flagged as pending replacement with data-learned CPTs
 * when sufficient co-located training data becomes available.
 *
 * Current training data status (from bnrrm_training.db):
 *   - Chemistry: 233 stations (excellent)
 *   - TOC/Fines: 31 stations (sparse)
 *   - Toxicity: 56 stations with chemistry (partial)
 *   - Community: 16 stations with full triad (bottleneck)
 */

import type {
  NetworkModel,
  SubstanceNodeData,
  ConditionNodeData,
  EffectNodeData,
  ImpactNodeData,
  ContainerData,
  NetworkEdge,
  ConditionalProbabilityTable,
} from '@/types/bn-rrm/network';

// =============================================================================
// SUBSTANCE NODES — Individual Contaminant Parameters
// =============================================================================

const metalNodes: SubstanceNodeData[] = [
  {
    id: 'sed_cu',
    label: 'Sediment Cu',
    category: 'substance',
    parameter: 'Copper',
    unit: 'mg/kg',
    mediaType: 'sediment',
    description: 'Total copper in bulk sediment (N=151 stations in DB)',
    states: [
      { id: 'below_isqg', label: '<ISQG (18.7)', minValue: 0, maxValue: 18.7, color: '#22c55e' },
      { id: 'isqg_pel', label: 'ISQG-PEL', minValue: 18.7, maxValue: 108, color: '#eab308' },
      { id: 'above_pel', label: '>PEL (108)', minValue: 108, maxValue: 5000, color: '#ef4444' },
    ],
    beliefs: { below_isqg: 0.40, isqg_pel: 0.35, above_pel: 0.25 },
    evidence: null,
    guidelines: [
      { name: 'ISQG', value: 18.7, source: 'CCME 1999' },
      { name: 'PEL', value: 108, source: 'CCME 1999' },
    ],
    containerId: 'container_metals',
  },
  {
    id: 'sed_zn',
    label: 'Sediment Zn',
    category: 'substance',
    parameter: 'Zinc',
    unit: 'mg/kg',
    mediaType: 'sediment',
    description: 'Total zinc in bulk sediment (N=133 stations in DB)',
    states: [
      { id: 'below_isqg', label: '<ISQG (124)', minValue: 0, maxValue: 124, color: '#22c55e' },
      { id: 'isqg_pel', label: 'ISQG-PEL', minValue: 124, maxValue: 271, color: '#eab308' },
      { id: 'above_pel', label: '>PEL (271)', minValue: 271, maxValue: 5000, color: '#ef4444' },
    ],
    beliefs: { below_isqg: 0.45, isqg_pel: 0.35, above_pel: 0.20 },
    evidence: null,
    guidelines: [
      { name: 'ISQG', value: 124, source: 'CCME 1999' },
      { name: 'PEL', value: 271, source: 'CCME 1999' },
    ],
    containerId: 'container_metals',
  },
  {
    id: 'sed_pb',
    label: 'Sediment Pb',
    category: 'substance',
    parameter: 'Lead',
    unit: 'mg/kg',
    mediaType: 'sediment',
    description: 'Total lead in bulk sediment (N=141 stations in DB)',
    states: [
      { id: 'below_isqg', label: '<ISQG (30.2)', minValue: 0, maxValue: 30.2, color: '#22c55e' },
      { id: 'isqg_pel', label: 'ISQG-PEL', minValue: 30.2, maxValue: 112, color: '#eab308' },
      { id: 'above_pel', label: '>PEL (112)', minValue: 112, maxValue: 2000, color: '#ef4444' },
    ],
    beliefs: { below_isqg: 0.50, isqg_pel: 0.35, above_pel: 0.15 },
    evidence: null,
    guidelines: [
      { name: 'ISQG', value: 30.2, source: 'CCME 1999' },
      { name: 'PEL', value: 112, source: 'CCME 1999' },
    ],
    containerId: 'container_metals',
  },
  {
    id: 'sed_cd',
    label: 'Sediment Cd',
    category: 'substance',
    parameter: 'Cadmium',
    unit: 'mg/kg',
    mediaType: 'sediment',
    description: 'Total cadmium in bulk sediment (N=140 stations in DB)',
    states: [
      { id: 'below_isqg', label: '<ISQG (0.7)', minValue: 0, maxValue: 0.7, color: '#22c55e' },
      { id: 'isqg_pel', label: 'ISQG-PEL', minValue: 0.7, maxValue: 4.2, color: '#eab308' },
      { id: 'above_pel', label: '>PEL (4.2)', minValue: 4.2, maxValue: 50, color: '#ef4444' },
    ],
    beliefs: { below_isqg: 0.45, isqg_pel: 0.40, above_pel: 0.15 },
    evidence: null,
    guidelines: [
      { name: 'ISQG', value: 0.7, source: 'CCME 1999' },
      { name: 'PEL', value: 4.2, source: 'CCME 1999' },
    ],
    containerId: 'container_metals',
  },
  {
    id: 'sed_hg',
    label: 'Sediment Hg',
    category: 'substance',
    parameter: 'Mercury',
    unit: 'mg/kg',
    mediaType: 'sediment',
    description: 'Total mercury in bulk sediment (N=133 stations in DB)',
    states: [
      { id: 'below_isqg', label: '<ISQG (0.13)', minValue: 0, maxValue: 0.13, color: '#22c55e' },
      { id: 'isqg_pel', label: 'ISQG-PEL', minValue: 0.13, maxValue: 0.7, color: '#eab308' },
      { id: 'above_pel', label: '>PEL (0.7)', minValue: 0.7, maxValue: 10, color: '#ef4444' },
    ],
    beliefs: { below_isqg: 0.50, isqg_pel: 0.35, above_pel: 0.15 },
    evidence: null,
    guidelines: [
      { name: 'ISQG', value: 0.13, source: 'CCME 1999' },
      { name: 'PEL', value: 0.7, source: 'CCME 1999' },
    ],
    containerId: 'container_metals',
  },
  {
    id: 'sed_as',
    label: 'Sediment As',
    category: 'substance',
    parameter: 'Arsenic',
    unit: 'mg/kg',
    mediaType: 'sediment',
    description: 'Total arsenic in bulk sediment (N=136 stations in DB)',
    states: [
      { id: 'below_isqg', label: '<ISQG (7.24)', minValue: 0, maxValue: 7.24, color: '#22c55e' },
      { id: 'isqg_pel', label: 'ISQG-PEL', minValue: 7.24, maxValue: 41.6, color: '#eab308' },
      { id: 'above_pel', label: '>PEL (41.6)', minValue: 41.6, maxValue: 500, color: '#ef4444' },
    ],
    beliefs: { below_isqg: 0.40, isqg_pel: 0.45, above_pel: 0.15 },
    evidence: null,
    guidelines: [
      { name: 'ISQG', value: 7.24, source: 'CCME 1999' },
      { name: 'PEL', value: 41.6, source: 'CCME 1999' },
    ],
    containerId: 'container_metals',
  },
  {
    id: 'sed_cr',
    label: 'Sediment Cr',
    category: 'substance',
    parameter: 'Chromium',
    unit: 'mg/kg',
    mediaType: 'sediment',
    description: 'Total chromium in bulk sediment (N=136 stations in DB)',
    states: [
      { id: 'below_isqg', label: '<ISQG (52.3)', minValue: 0, maxValue: 52.3, color: '#22c55e' },
      { id: 'isqg_pel', label: 'ISQG-PEL', minValue: 52.3, maxValue: 160, color: '#eab308' },
      { id: 'above_pel', label: '>PEL (160)', minValue: 160, maxValue: 1000, color: '#ef4444' },
    ],
    beliefs: { below_isqg: 0.55, isqg_pel: 0.35, above_pel: 0.10 },
    evidence: null,
    guidelines: [
      { name: 'ISQG', value: 52.3, source: 'CCME 1999' },
      { name: 'PEL', value: 160, source: 'CCME 1999' },
    ],
    containerId: 'container_metals',
  },
];

const organicNodes: SubstanceNodeData[] = [
  {
    id: 'sed_pahs',
    label: 'Total PAHs',
    category: 'substance',
    parameter: 'Total PAHs',
    unit: 'μg/kg',
    mediaType: 'sediment',
    description: 'Sum of 16 priority PAH compounds (N=162 stations in DB)',
    states: [
      { id: 'below_isqg', label: '<ISQG', minValue: 0, maxValue: 1684, color: '#22c55e' },
      { id: 'isqg_pel', label: 'ISQG-PEL', minValue: 1684, maxValue: 16770, color: '#eab308' },
      { id: 'above_pel', label: '>PEL', minValue: 16770, maxValue: 200000, color: '#ef4444' },
    ],
    beliefs: { below_isqg: 0.50, isqg_pel: 0.35, above_pel: 0.15 },
    evidence: null,
    guidelines: [
      { name: 'ISQG', value: 1684, source: 'CCME 1999' },
      { name: 'PEL', value: 16770, source: 'CCME 1999' },
    ],
    containerId: 'container_organics',
  },
  {
    id: 'sed_pcbs',
    label: 'Total PCBs',
    category: 'substance',
    parameter: 'Total PCBs',
    unit: 'μg/kg',
    mediaType: 'sediment',
    description: 'Total polychlorinated biphenyls (sparse data — available at select sites)',
    states: [
      { id: 'below_isqg', label: '<ISQG', minValue: 0, maxValue: 21.5, color: '#22c55e' },
      { id: 'isqg_pel', label: 'ISQG-PEL', minValue: 21.5, maxValue: 189, color: '#eab308' },
      { id: 'above_pel', label: '>PEL', minValue: 189, maxValue: 5000, color: '#ef4444' },
    ],
    beliefs: { below_isqg: 0.60, isqg_pel: 0.30, above_pel: 0.10 },
    evidence: null,
    guidelines: [
      { name: 'ISQG', value: 21.5, source: 'CCME 1999' },
      { name: 'PEL', value: 189, source: 'CCME 1999' },
    ],
    containerId: 'container_organics',
  },
];

// =============================================================================
// CONDITION NODES — Environmental Modifiers
// =============================================================================

const conditionNodes: ConditionNodeData[] = [
  {
    id: 'toc',
    label: 'TOC',
    category: 'condition',
    parameter: 'Total Organic Carbon',
    unit: '%',
    description: 'Organic carbon content — higher values reduce metal bioavailability (N=31 stations in DB)',
    typicalRange: { min: 0.5, max: 10 },
    effectDirection: 'decreases',
    states: [
      { id: 'low', label: 'Low (<1%)', minValue: 0, maxValue: 1, color: '#fca5a5' },
      { id: 'medium', label: 'Medium (1-3%)', minValue: 1, maxValue: 3, color: '#fde047' },
      { id: 'high', label: 'High (>3%)', minValue: 3, maxValue: 20, color: '#86efac' },
    ],
    beliefs: { low: 0.25, medium: 0.50, high: 0.25 },
    evidence: null,
    containerId: 'container_condition',
  },
  {
    id: 'sulfide_binding',
    label: 'Sulfide Binding',
    category: 'condition',
    parameter: 'SEM/AVS Ratio',
    unit: 'ratio',
    description: 'Sulfide metal binding state (4-state). Replaces AVS node in v4.0. Modifies divalent metal bioavailability.',
    typicalRange: { min: 0, max: 4 },
    effectDirection: 'decreases',
    states: [
      { id: 'bound_measured', label: 'Bound (measured)', minValue: 0, maxValue: 1, color: '#86efac' },
      { id: 'excess_measured', label: 'Excess (measured)', minValue: 1, maxValue: 4, color: '#fca5a5' },
      { id: 'bound_proxy', label: 'Bound (proxy)', minValue: 0, maxValue: 1, color: '#bbf7d0' },
      { id: 'uncertain_proxy', label: 'Uncertain (proxy)', minValue: 0, maxValue: 4, color: '#fde68a' },
    ],
    beliefs: { bound_measured: 0.25, excess_measured: 0.25, bound_proxy: 0.25, uncertain_proxy: 0.25 },
    evidence: null,
    containerId: 'container_condition',
  },
  {
    id: 'grain_size',
    label: 'Grain Size',
    category: 'condition',
    parameter: 'Percent Fines',
    unit: '% <63μm',
    description: 'Proportion of fine sediment — affects contaminant binding and habitat (N=32 stations in DB)',
    typicalRange: { min: 0, max: 100 },
    effectDirection: 'variable',
    states: [
      { id: 'coarse', label: 'Coarse (<20%)', minValue: 0, maxValue: 20 },
      { id: 'mixed', label: 'Mixed (20-60%)', minValue: 20, maxValue: 60 },
      { id: 'fine', label: 'Fine (>60%)', minValue: 60, maxValue: 100 },
    ],
    beliefs: { coarse: 0.30, mixed: 0.45, fine: 0.25 },
    evidence: null,
    containerId: 'container_condition',
  },
];

// =============================================================================
// EFFECT NODES — Exposure, Bioavailability, Biological Responses
// =============================================================================

// Contamination aggregation nodes — visually grouped with their source substances
const metalContaminationNode: EffectNodeData = {
  id: 'metal_contamination',
  label: 'Metal Contamination',
  category: 'substance' as unknown as 'effect',
  endpoint: 'Aggregate Metal Severity',
  description: 'Combined metal contamination severity across all measured metals.',
  responseDirection: 'higher_is_worse',
  states: [
    { id: 'low', label: 'Low', color: '#22c55e' },
    { id: 'moderate', label: 'Moderate', color: '#eab308' },
    { id: 'high', label: 'High', color: '#ef4444' },
  ],
  beliefs: { low: 0.35, moderate: 0.40, high: 0.25 },
  evidence: null,
  containerId: 'container_metals',
};

const organicContaminationNode: EffectNodeData = {
  id: 'organic_contamination',
  label: 'Organic Contamination',
  category: 'substance' as unknown as 'effect',
  endpoint: 'Aggregate Organic Severity',
  description: 'Combined organic contaminant severity (PAHs + PCBs).',
  responseDirection: 'higher_is_worse',
  states: [
    { id: 'low', label: 'Low', color: '#22c55e' },
    { id: 'moderate', label: 'Moderate', color: '#eab308' },
    { id: 'high', label: 'High', color: '#ef4444' },
  ],
  beliefs: { low: 0.50, moderate: 0.35, high: 0.15 },
  evidence: null,
  containerId: 'container_organics',
};

const effectNodes: EffectNodeData[] = [
  {
    id: 'metal_bioavail',
    label: 'Metal Bioavailability',
    category: 'effect',
    endpoint: 'Bioavailable Metal Fraction',
    description: 'Estimated bioavailable metal fraction after accounting for TOC/AVS binding. Expert-elicited CPT (interim).',
    responseDirection: 'higher_is_worse',
    states: [
      { id: 'low', label: 'Low', color: '#22c55e' },
      { id: 'moderate', label: 'Moderate', color: '#eab308' },
      { id: 'high', label: 'High', color: '#ef4444' },
    ],
    beliefs: { low: 0.35, moderate: 0.45, high: 0.20 },
    evidence: null,
    containerId: 'container_effect',
  },
  {
    id: 'organic_bioavail',
    label: 'Organic Bioavailability',
    category: 'effect',
    endpoint: 'Bioavailable Organic Fraction',
    description: 'Estimated bioavailable organic fraction after TOC partitioning. Expert-elicited CPT (interim).',
    responseDirection: 'higher_is_worse',
    states: [
      { id: 'low', label: 'Low', color: '#22c55e' },
      { id: 'moderate', label: 'Moderate', color: '#eab308' },
      { id: 'high', label: 'High', color: '#ef4444' },
    ],
    beliefs: { low: 0.50, moderate: 0.35, high: 0.15 },
    evidence: null,
    containerId: 'container_effect',
  },
  {
    id: 'tox_amphipod',
    label: 'Amphipod Toxicity',
    category: 'effect',
    endpoint: 'Survival',
    testType: '10-day amphipod bioassay',
    description: 'Predicted toxicity from bioavailable metals and organics (N=47 stations in DB). Expert-elicited CPT (interim).',
    responseDirection: 'higher_is_worse',
    states: [
      { id: 'low', label: 'Low', color: '#22c55e' },
      { id: 'moderate', label: 'Moderate', color: '#eab308' },
      { id: 'high', label: 'High', color: '#ef4444' },
    ],
    beliefs: { low: 0.50, moderate: 0.30, high: 0.20 },
    evidence: null,
    containerId: 'container_effect',
  },
  {
    id: 'taxa_richness',
    label: 'Taxa Richness',
    category: 'effect',
    endpoint: 'Taxa Richness',
    testType: 'Benthic community survey',
    description: 'Number of unique taxa (N=21 stations in DB). Expert-elicited CPT (interim).',
    responseDirection: 'lower_is_worse',
    states: [
      { id: 'high', label: 'High (>75th)', color: '#22c55e' },
      { id: 'moderate', label: 'Moderate (25-75th)', color: '#eab308' },
      { id: 'low', label: 'Low (<25th)', color: '#ef4444' },
    ],
    beliefs: { high: 0.30, moderate: 0.45, low: 0.25 },
    evidence: null,
    containerId: 'container_effect',
  },
  {
    id: 'diversity',
    label: 'Shannon Diversity',
    category: 'effect',
    endpoint: 'Diversity Index',
    testType: 'Benthic community survey',
    description: "Shannon-Wiener diversity index H' (N=21 stations in DB). Expert-elicited CPT (interim).",
    responseDirection: 'lower_is_worse',
    states: [
      { id: 'high', label: 'High (>2.5)', color: '#22c55e' },
      { id: 'moderate', label: 'Moderate (1.5-2.5)', color: '#eab308' },
      { id: 'low', label: 'Low (<1.5)', color: '#ef4444' },
    ],
    beliefs: { high: 0.35, moderate: 0.40, low: 0.25 },
    evidence: null,
    containerId: 'container_effect',
  },
];

// =============================================================================
// IMPACT NODE — Integrated Ecological Risk
// =============================================================================

const impactNode: ImpactNodeData = {
  id: 'ecological_risk',
  label: 'Ecological Risk',
  category: 'impact',
  impactType: 'integrated',
  description: 'Integrated ecological risk derived from causal pathway propagation through substance → exposure → effect chain. Expert-elicited CPT (interim).',
  states: [
    { id: 'low', label: 'Low', color: '#22c55e' },
    { id: 'moderate', label: 'Moderate', color: '#f97316' },
    { id: 'high', label: 'High', color: '#ef4444' },
  ],
  beliefs: { low: 0.65, moderate: 0.25, high: 0.10 },
  evidence: null,
  containerId: 'container_impact',
};

// =============================================================================
// CONTAINERS (5-column causal chain layout)
// =============================================================================

const containers: ContainerData[] = [
  {
    id: 'container_metals',
    label: 'Metals (Source)',
    category: 'substance',
    collapsed: true,
    childNodeIds: ['sed_cu', 'sed_zn', 'sed_pb', 'sed_cd', 'sed_hg', 'sed_as', 'sed_cr', 'metal_contamination'],
    position: { x: 50, y: 50 },
  },
  {
    id: 'container_organics',
    label: 'Organics (Source)',
    category: 'substance',
    collapsed: true,
    childNodeIds: ['sed_pahs', 'sed_pcbs', 'organic_contamination'],
    position: { x: 50, y: 500 },
  },
  {
    id: 'container_condition',
    label: 'Conditions (Habitat)',
    category: 'condition',
    collapsed: true,
    childNodeIds: ['toc', 'sulfide_binding', 'grain_size'],
    position: { x: 420, y: 100 },
  },
  {
    id: 'container_effect',
    label: 'Exposure & Effects',
    category: 'effect',
    collapsed: true,
    childNodeIds: ['metal_bioavail', 'organic_bioavail', 'tox_amphipod', 'taxa_richness', 'diversity'],
    position: { x: 800, y: 50 },
  },
  {
    id: 'container_impact',
    label: 'Ecological Risk',
    category: 'impact',
    collapsed: false,
    childNodeIds: ['ecological_risk'],
    position: { x: 1180, y: 200 },
  },
];

// =============================================================================
// EDGES — Causal pathways through the DAG
// =============================================================================

const edges: NetworkEdge[] = [
  // === Metals → Metal Contamination (aggregation) ===
  { id: 'e_cu_mcon', source: 'sed_cu', target: 'metal_contamination' },
  { id: 'e_zn_mcon', source: 'sed_zn', target: 'metal_contamination' },
  { id: 'e_pb_mcon', source: 'sed_pb', target: 'metal_contamination' },
  { id: 'e_cd_mcon', source: 'sed_cd', target: 'metal_contamination' },
  { id: 'e_hg_mcon', source: 'sed_hg', target: 'metal_contamination' },
  { id: 'e_as_mcon', source: 'sed_as', target: 'metal_contamination' },
  { id: 'e_cr_mcon', source: 'sed_cr', target: 'metal_contamination' },

  // === Organics → Organic Contamination ===
  { id: 'e_pahs_ocon', source: 'sed_pahs', target: 'organic_contamination' },
  { id: 'e_pcbs_ocon', source: 'sed_pcbs', target: 'organic_contamination' },

  // === Contamination + Conditions → Bioavailability ===
  { id: 'e_mcon_bioavail', source: 'metal_contamination', target: 'metal_bioavail' },
  { id: 'e_toc_mbioavail', source: 'toc', target: 'metal_bioavail' },
  { id: 'e_sulfide_metal_bioavail', source: 'sulfide_binding', target: 'metal_bioavail' },

  { id: 'e_ocon_obioavail', source: 'organic_contamination', target: 'organic_bioavail' },
  { id: 'e_toc_obioavail', source: 'toc', target: 'organic_bioavail' },

  // === Bioavailability → Toxicity ===
  { id: 'e_mbioavail_tox', source: 'metal_bioavail', target: 'tox_amphipod' },
  { id: 'e_obioavail_tox', source: 'organic_bioavail', target: 'tox_amphipod' },

  // === Toxicity → Community ===
  { id: 'e_tox_taxa', source: 'tox_amphipod', target: 'taxa_richness' },
  { id: 'e_tox_div', source: 'tox_amphipod', target: 'diversity' },
  { id: 'e_grain_taxa', source: 'grain_size', target: 'taxa_richness' },

  // === All effects → Ecological Risk ===
  { id: 'e_mbioavail_risk', source: 'metal_bioavail', target: 'ecological_risk' },
  { id: 'e_obioavail_risk', source: 'organic_bioavail', target: 'ecological_risk' },
  { id: 'e_tox_risk', source: 'tox_amphipod', target: 'ecological_risk' },
  { id: 'e_taxa_risk', source: 'taxa_richness', target: 'ecological_risk' },
  { id: 'e_div_risk', source: 'diversity', target: 'ecological_risk' },
];

// =============================================================================
// CPTs — Expert-Elicited (All Interim, Pending Data-Learned Replacement)
// =============================================================================

/**
 * Generate full CPT entries for all combinations of parent states.
 * `logicFn` maps parent state combo → child state distribution.
 */
function generateCPT(
  nodeId: string,
  parentNodeIds: string[],
  parentStates: Record<string, string[]>,
  logicFn: (combo: Record<string, string>) => Record<string, number>,
): ConditionalProbabilityTable {
  const entries: { parentStates: Record<string, string>; distribution: Record<string, number> }[] = [];

  function recurse(idx: number, current: Record<string, string>) {
    if (idx === parentNodeIds.length) {
      entries.push({ parentStates: { ...current }, distribution: logicFn(current) });
      return;
    }
    const pid = parentNodeIds[idx];
    for (const s of parentStates[pid]) {
      current[pid] = s;
      recurse(idx + 1, current);
    }
  }

  recurse(0, {});
  return { nodeId, parentNodeIds, entries };
}

// Helper: map state names to ordinal severity (0=low/good, 1=medium, 2=high/bad)
function severity(state: string): number {
  const map: Record<string, number> = {
    below_isqg: 0, isqg_pel: 1, above_pel: 2,
    low: 0, medium: 1, high: 2, moderate: 1,
    coarse: 0, mixed: 1, fine: 2,
    // sulfide_binding 4-state (v4.0): protectiveness encoded as inverse severity
    bound_measured: 0, bound_proxy: 0.15, uncertain_proxy: 2, excess_measured: 2,
  };
  return map[state] ?? 1;
}

// Inverse severity for protective factors (high TOC/AVS = low bioavailability)
function protectiveness(state: string): number {
  return 2 - severity(state);
}

// Normalize a 3-state distribution
function normalize3(pLow: number, pMod: number, pHigh: number): Record<string, number> {
  const lo = Math.max(0.02, pLow);
  const md = Math.max(0.02, pMod);
  const hi = Math.max(0.02, pHigh);
  const sum = lo + md + hi;
  return { low: lo / sum, moderate: md / sum, high: hi / sum };
}

const cuZnStates = ['below_isqg', 'isqg_pel', 'above_pel'];
const threeStates = ['low', 'medium', 'high'];
const grainStates = ['coarse', 'mixed', 'fine'];
const effectThree = ['low', 'moderate', 'high'];
const communityStates = ['high', 'moderate', 'low']; // high=good, low=bad

// metal_contamination = f(Cu, Zn, Pb, Cd, Hg, As, Cr)
// Uses max-severity logic: the most contaminated metal drives the overall rating
const metalContaminationCPT = generateCPT(
  'metal_contamination',
  ['sed_cu', 'sed_zn', 'sed_pb', 'sed_cd', 'sed_hg', 'sed_as', 'sed_cr'],
  {
    sed_cu: cuZnStates, sed_zn: cuZnStates, sed_pb: cuZnStates,
    sed_cd: cuZnStates, sed_hg: cuZnStates, sed_as: cuZnStates, sed_cr: cuZnStates,
  },
  (combo) => {
    const scores = Object.values(combo).map(severity);
    const maxScore = Math.max(...scores);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    // Blend max (dominant) with average (cumulative) — max-weighted
    const net = maxScore * 0.7 + avgScore * 0.3;
    const norm = net / 2;
    const pHigh = Math.min(0.95, norm * norm);
    const pLow = Math.min(0.95, (1 - norm) * (1 - norm));
    const pMod = 1 - pHigh - pLow;
    return normalize3(pLow, pMod, pHigh);
  },
);

// organic_contamination = f(PAHs, PCBs)
const organicContaminationCPT = generateCPT(
  'organic_contamination',
  ['sed_pahs', 'sed_pcbs'],
  { sed_pahs: cuZnStates, sed_pcbs: cuZnStates },
  (combo) => {
    const maxScore = Math.max(severity(combo.sed_pahs), severity(combo.sed_pcbs));
    const norm = maxScore / 2;
    const pHigh = Math.min(0.95, norm * norm);
    const pLow = Math.min(0.95, (1 - norm) * (1 - norm));
    return normalize3(pLow, 1 - pHigh - pLow, pHigh);
  },
);

// metal_bioavail = f(metal_contamination, TOC, sulfide_binding)
// Higher metals + lower TOC/sulfide binding → higher bioavailability
const sulfideStates = ['bound_measured', 'excess_measured', 'bound_proxy', 'uncertain_proxy'];
const metalBioavailCPT = generateCPT(
  'metal_bioavail',
  ['metal_contamination', 'toc', 'sulfide_binding'],
  { metal_contamination: effectThree, toc: threeStates, sulfide_binding: sulfideStates },
  (combo) => {
    const metalScore = severity(combo.metal_contamination);
    const protScore = (protectiveness(combo.toc) + protectiveness(combo.sulfide_binding)) / 2;
    const net = Math.max(0, Math.min(2, metalScore - protScore * 0.6 + 0.3));
    const norm = net / 2;
    const pHigh = Math.min(0.95, norm * norm);
    const pLow = Math.min(0.95, (1 - norm) * (1 - norm));
    return normalize3(pLow, 1 - pHigh - pLow, pHigh);
  },
);

// organic_bioavail = f(organic_contamination, TOC)
// Higher organics + lower TOC → higher organic bioavailability
const organicBioavailCPT = generateCPT(
  'organic_bioavail',
  ['organic_contamination', 'toc'],
  { organic_contamination: effectThree, toc: threeStates },
  (combo) => {
    const orgScore = severity(combo.organic_contamination);
    const tocProtect = protectiveness(combo.toc);
    const net = Math.max(0, Math.min(2, orgScore - tocProtect * 0.5 + 0.25));
    const norm = net / 2;
    const pHigh = Math.min(0.95, norm * norm);
    const pLow = Math.min(0.95, (1 - norm) * (1 - norm));
    return normalize3(pLow, 1 - pHigh - pLow, pHigh);
  },
);

// tox_amphipod = f(metal_bioavail, organic_bioavail)
const toxCPT = generateCPT(
  'tox_amphipod',
  ['metal_bioavail', 'organic_bioavail'],
  { metal_bioavail: effectThree, organic_bioavail: effectThree },
  (combo) => {
    const metalTox = severity(combo.metal_bioavail);
    const orgTox = severity(combo.organic_bioavail);
    const net = Math.max(metalTox, orgTox) * 0.7 + Math.min(metalTox, orgTox) * 0.3;
    const norm = net / 2;
    const pHigh = Math.min(0.95, norm * norm);
    const pLow = Math.min(0.95, (1 - norm) * (1 - norm));
    return normalize3(pLow, 1 - pHigh - pLow, pHigh);
  },
);

// taxa_richness = f(tox_amphipod, grain_size)
const taxaCPT = generateCPT(
  'taxa_richness',
  ['tox_amphipod', 'grain_size'],
  { tox_amphipod: effectThree, grain_size: grainStates },
  (combo) => {
    const toxEffect = severity(combo.tox_amphipod);
    const grainEffect = severity(combo.grain_size) * 0.3;
    const net = Math.min(2, toxEffect * 0.8 + grainEffect);
    const norm = net / 2;
    const pLow = Math.min(0.95, norm * norm);
    const pHigh = Math.min(0.95, (1 - norm) * (1 - norm));
    const pMod = Math.max(0.02, 1 - pHigh - pLow);
    const sum = pHigh + pMod + pLow;
    return { high: pHigh / sum, moderate: pMod / sum, low: pLow / sum };
  },
);

// diversity = f(tox_amphipod)
const divCPT = generateCPT(
  'diversity',
  ['tox_amphipod'],
  { tox_amphipod: effectThree },
  (combo) => {
    const toxEffect = severity(combo.tox_amphipod);
    const norm = toxEffect / 2;
    const pLow = Math.min(0.95, norm * norm);
    const pHigh = Math.min(0.95, (1 - norm) * (1 - norm));
    const pMod = Math.max(0.02, 1 - pHigh - pLow);
    const sum = pHigh + pMod + pLow;
    return { high: pHigh / sum, moderate: pMod / sum, low: pLow / sum };
  },
);

// ecological_risk = f(metal_bioavail, organic_bioavail, tox_amphipod, taxa_richness, diversity)
// Weighted integration: toxicity and community weighted higher than exposure
const ecologicalRiskCPT = generateCPT(
  'ecological_risk',
  ['metal_bioavail', 'organic_bioavail', 'tox_amphipod', 'taxa_richness', 'diversity'],
  {
    metal_bioavail: effectThree,
    organic_bioavail: effectThree,
    tox_amphipod: effectThree,
    taxa_richness: communityStates,
    diversity: communityStates,
  },
  (combo) => {
    const bioavailScore = (severity(combo.metal_bioavail) + severity(combo.organic_bioavail)) / 2;
    const toxScore = severity(combo.tox_amphipod);
    const commMap: Record<string, number> = { high: 0, moderate: 1, low: 2 };
    const taxaScore = commMap[combo.taxa_richness] ?? 1;
    const divScore = commMap[combo.diversity] ?? 1;

    // Landis-style weighting: exposure=2, toxicity=4, community=4
    const net = (bioavailScore * 2 + toxScore * 4 + taxaScore * 2 + divScore * 2) / 10;
    const norm = net / 2;
    const pHigh = Math.min(0.95, norm * norm * 1.2);
    const pLow = Math.min(0.95, (1 - norm) * (1 - norm));
    const pMod = Math.max(0.02, 1 - pHigh - pLow);
    const sum = pLow + pMod + pHigh;
    return { low: pLow / sum, moderate: pMod / sum, high: pHigh / sum };
  },
);

const expertCPTs: ConditionalProbabilityTable[] = [
  metalContaminationCPT,
  organicContaminationCPT,
  metalBioavailCPT,
  organicBioavailCPT,
  toxCPT,
  taxaCPT,
  divCPT,
  ecologicalRiskCPT,
];

// =============================================================================
// LEARNED CPT LOADER
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LearnedModelJSON = any;

/**
 * Load data-learned CPTs from the exported JSON model.
 * Converts the JSON structure to ConditionalProbabilityTable[] format
 * expected by the DAG inference engine.
 */
function loadLearnedCPTs(model: LearnedModelJSON): ConditionalProbabilityTable[] {
  // Array format from export_for_frontend.py
  if (Array.isArray(model.cpts)) {
    return (model.cpts as Array<{
      nodeId: string;
      parentNodeIds: string[];
      entries: Array<{
        parentStates: Record<string, string>;
        distribution: Record<string, number>;
      }>;
    }>).map((cpt) => ({
      nodeId: cpt.nodeId,
      parentNodeIds: cpt.parentNodeIds,
      entries: cpt.entries,
    }));
  }
  // Object-keyed format from fit_causal_model.py / fit_site_model.py
  // Shape: {node_id: {parents: string[], states: string[], method: string, table: {config_key: {state: prob}}}}
  return Object.entries(model.cpts as Record<string, any>).map(([nodeId, cptData]) => ({
    nodeId,
    parentNodeIds: cptData.parents as string[],
    entries: Object.entries(cptData.table as Record<string, Record<string, number>>).map(
      ([configKey, dist]) => ({
        parentStates: Object.fromEntries(
          (cptData.parents as string[]).map((pid: string, i: number) => [pid, configKey.split('|')[i]])
        ),
        distribution: dist,
      })
    ),
  }));
}

/**
 * Build edges from learned model JSON (may differ from expert DAG).
 */
function loadLearnedEdges(model: LearnedModelJSON): NetworkEdge[] {
  const rawEdges = model.structure?.edges ?? model.edges ?? [];
  return rawEdges.map((e: any, i: number) => ({
    id: e.id ?? `${e.source}_${e.target}`,
    source: e.source,
    target: e.target,
  }));
}

// =============================================================================
// CREATE TRAINED NETWORK
// =============================================================================

/**
 * Create the trained BN-RRM network.
 * @param source - 'expert' for interim expert-elicited CPTs, 'learned' for data-learned CPTs
 * @param learnedModel - Required when source='learned'. The parsed JSON from learned-model.json
 */
export function createTrainedNetwork(
  source: 'expert' | 'learned' = 'expert',
  learnedModel?: LearnedModelJSON,
): NetworkModel {
  const allNodes = [...metalNodes, metalContaminationNode, ...organicNodes, organicContaminationNode, ...conditionNodes, ...effectNodes, impactNode];

  if (source === 'learned' && learnedModel) {
    const learnedCPTs = loadLearnedCPTs(learnedModel);
    const learnedEdges = loadLearnedEdges(learnedModel);

    // Update node priors from data-derived marginals if available
    const learnedNodes = (learnedModel.structure?.nodes ?? learnedModel.nodes ?? []) as Array<{ id: string; beliefs?: Record<string, number>; priors?: Record<string, number> }>;
    for (const learnedNode of learnedNodes) {
      const beliefs = learnedNode.beliefs ?? learnedNode.priors;
      if (beliefs) {
        const node = allNodes.find((n) => n.id === learnedNode.id);
        if (node) {
          node.beliefs = beliefs;
        }
      }
    }

    return {
      id: 'bnrrm-landis-causal',
      name: 'BN-RRM Causal Model (Tiered: Data + Expert)',
      description: `20-node causal DAG with tiered CPTs from ${learnedModel.nStations ?? 245} stations. ` +
        `Metal pathway partially data-learned (49 BDeu obs). Organic pathway expert-dominant (DR-001). ` +
        `Tiered learning: Noisy-OR (contamination), BDeu+expert (bioavailability/effects), expert-dominated (risk).`,
      version: learnedModel.version ?? '3.1',
      nodes: allNodes,
      edges: learnedEdges,
      containers,
      cpts: learnedCPTs,
      createdAt: learnedModel.createdAt ?? '2026-03-07',
      updatedAt: new Date().toISOString(),
      author: 'Data-learned (tiered CPTs from bnrrm_training.db)',
    };
  }

  return {
    id: 'bnrrm-landis-causal',
    name: 'BN-RRM Causal Model (Landis)',
    description: '20-node causal DAG: Substance → Conditions → Exposure → Effects → Risk. Expert-elicited CPTs (interim — pending data-learned replacement).',
    version: '3.0',
    nodes: allNodes,
    edges,
    containers,
    cpts: expertCPTs,
    createdAt: '2026-03-07',
    updatedAt: new Date().toISOString(),
    author: 'Expert Elicitation (interim)',
  };
}
