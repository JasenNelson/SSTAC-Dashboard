/**
 * Dummy Network Data
 *
 * Creates a representative Benthic Risk BN-RRM for UI development.
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

const substanceNodes: SubstanceNodeData[] = [
  {
    id: 'sed_cu',
    label: 'Sediment Copper',
    category: 'substance',
    parameter: 'Copper',
    unit: 'mg/kg',
    mediaType: 'sediment',
    description: 'Total copper concentration in bulk sediment',
    states: [
      { id: 'below_isqg', label: '<ISQG', minValue: 0, maxValue: 35.7, color: '#22c55e' },
      { id: 'isqg_pel', label: 'ISQG-PEL', minValue: 35.7, maxValue: 197, color: '#eab308' },
      { id: 'above_pel', label: '>PEL', minValue: 197, maxValue: 1000, color: '#ef4444' },
    ],
    beliefs: { 'below_isqg': 0.60, 'isqg_pel': 0.30, 'above_pel': 0.10 },
    evidence: null,
    guidelines: [
      { name: 'ISQG', value: 35.7, source: 'CCME 1999' },
      { name: 'PEL', value: 197, source: 'CCME 1999' },
    ],
    containerId: 'container_substance',
  },
  {
    id: 'sed_zn',
    label: 'Sediment Zinc',
    category: 'substance',
    parameter: 'Zinc',
    unit: 'mg/kg',
    mediaType: 'sediment',
    description: 'Total zinc concentration in bulk sediment',
    states: [
      { id: 'below_isqg', label: '<ISQG', minValue: 0, maxValue: 123, color: '#22c55e' },
      { id: 'isqg_pel', label: 'ISQG-PEL', minValue: 123, maxValue: 315, color: '#eab308' },
      { id: 'above_pel', label: '>PEL', minValue: 315, maxValue: 2000, color: '#ef4444' },
    ],
    beliefs: { 'below_isqg': 0.55, 'isqg_pel': 0.35, 'above_pel': 0.10 },
    evidence: null,
    guidelines: [
      { name: 'ISQG', value: 123, source: 'CCME 1999' },
      { name: 'PEL', value: 315, source: 'CCME 1999' },
    ],
    containerId: 'container_substance',
  },
  {
    id: 'sed_pahs',
    label: 'Total PAHs',
    category: 'substance',
    parameter: 'Total PAHs',
    unit: 'ug/kg',
    mediaType: 'sediment',
    description: 'Sum of 16 priority PAH compounds',
    states: [
      { id: 'low', label: 'Low', minValue: 0, maxValue: 1684, color: '#22c55e' },
      { id: 'moderate', label: 'Moderate', minValue: 1684, maxValue: 16770, color: '#eab308' },
      { id: 'high', label: 'High', minValue: 16770, maxValue: 100000, color: '#ef4444' },
    ],
    beliefs: { 'low': 0.50, 'moderate': 0.35, 'high': 0.15 },
    evidence: null,
    containerId: 'container_substance',
  },
];

const conditionNodes: ConditionNodeData[] = [
  {
    id: 'toc',
    label: 'TOC',
    category: 'condition',
    parameter: 'Total Organic Carbon',
    unit: '%',
    description: 'Organic carbon content - higher values reduce metal bioavailability',
    typicalRange: { min: 0.5, max: 10 },
    effectDirection: 'decreases',
    states: [
      { id: 'low', label: 'Low (<1%)', minValue: 0, maxValue: 1, color: '#fca5a5' },
      { id: 'medium', label: 'Medium (1-3%)', minValue: 1, maxValue: 3, color: '#fde047' },
      { id: 'high', label: 'High (>3%)', minValue: 3, maxValue: 20, color: '#86efac' },
    ],
    beliefs: { 'low': 0.25, 'medium': 0.50, 'high': 0.25 },
    evidence: null,
    containerId: 'container_condition',
  },
  {
    id: 'avs',
    label: 'AVS',
    category: 'condition',
    parameter: 'Acid Volatile Sulfide',
    unit: 'umol/g',
    description: 'Sulfide binding capacity for divalent metals',
    typicalRange: { min: 0, max: 50 },
    effectDirection: 'decreases',
    states: [
      { id: 'low', label: 'Low (<5)', minValue: 0, maxValue: 5, color: '#fca5a5' },
      { id: 'medium', label: 'Medium (5-20)', minValue: 5, maxValue: 20, color: '#fde047' },
      { id: 'high', label: 'High (>20)', minValue: 20, maxValue: 100, color: '#86efac' },
    ],
    beliefs: { 'low': 0.40, 'medium': 0.40, 'high': 0.20 },
    evidence: null,
    containerId: 'container_condition',
  },
  {
    id: 'grain_size',
    label: 'Grain Size',
    category: 'condition',
    parameter: 'Percent Fines',
    unit: '% <63um',
    description: 'Proportion of fine sediment particles',
    typicalRange: { min: 0, max: 100 },
    effectDirection: 'variable',
    states: [
      { id: 'coarse', label: 'Coarse (<20%)', minValue: 0, maxValue: 20 },
      { id: 'mixed', label: 'Mixed (20-60%)', minValue: 20, maxValue: 60 },
      { id: 'fine', label: 'Fine (>60%)', minValue: 60, maxValue: 100 },
    ],
    beliefs: { 'coarse': 0.30, 'mixed': 0.45, 'fine': 0.25 },
    evidence: null,
    containerId: 'container_condition',
  },
];

const effectNodes: EffectNodeData[] = [
  {
    id: 'metal_bioavail',
    label: 'Metal Bioavailability',
    category: 'effect',
    endpoint: 'Bioavailable Fraction',
    description: 'Estimated bioavailable metal fraction based on modifying factors',
    responseDirection: 'higher_is_worse',
    states: [
      { id: 'low', label: 'Low', color: '#22c55e' },
      { id: 'moderate', label: 'Moderate', color: '#eab308' },
      { id: 'high', label: 'High', color: '#ef4444' },
    ],
    beliefs: { 'low': 0.35, 'moderate': 0.45, 'high': 0.20 },
    evidence: null,
    containerId: 'container_effect',
  },
  {
    id: 'tox_amphipod',
    label: 'Amphipod Survival',
    category: 'effect',
    endpoint: 'Survival',
    testType: '10-day amphipod bioassay',
    description: 'Survival in standardized toxicity test',
    responseDirection: 'lower_is_worse',
    states: [
      { id: 'not_toxic', label: 'Not Toxic (>80%)', color: '#22c55e' },
      { id: 'toxic', label: 'Toxic (<80%)', color: '#ef4444' },
    ],
    beliefs: { 'not_toxic': 0.70, 'toxic': 0.30 },
    evidence: null,
    containerId: 'container_effect',
  },
  {
    id: 'taxa_richness',
    label: 'Taxa Richness',
    category: 'effect',
    endpoint: 'Taxa Richness',
    testType: 'Benthic community survey',
    description: 'Number of unique taxa in benthic sample',
    responseDirection: 'lower_is_worse',
    states: [
      { id: 'high', label: 'High (>75th %ile)', color: '#22c55e' },
      { id: 'moderate', label: 'Moderate (25-75th)', color: '#eab308' },
      { id: 'low', label: 'Low (<25th %ile)', color: '#ef4444' },
    ],
    beliefs: { 'high': 0.30, 'moderate': 0.45, 'low': 0.25 },
    evidence: null,
    containerId: 'container_effect',
  },
  {
    id: 'diversity',
    label: 'Shannon Diversity',
    category: 'effect',
    endpoint: 'Diversity Index',
    testType: 'Benthic community survey',
    description: "Shannon-Wiener diversity index (H')",
    responseDirection: 'lower_is_worse',
    states: [
      { id: 'high', label: 'High (>2.5)', color: '#22c55e' },
      { id: 'moderate', label: 'Moderate (1.5-2.5)', color: '#eab308' },
      { id: 'low', label: 'Low (<1.5)', color: '#ef4444' },
    ],
    beliefs: { 'high': 0.35, 'moderate': 0.40, 'low': 0.25 },
    evidence: null,
    containerId: 'container_effect',
  },
];

const impactNodes: ImpactNodeData[] = [
  {
    id: 'benthic_impact',
    label: 'Benthic Impact',
    category: 'impact',
    impactType: 'integrated',
    description: 'Overall impact on benthic community integrating all evidence',
    states: [
      { id: 'none', label: 'None', color: '#22c55e' },
      { id: 'minor', label: 'Minor', color: '#eab308' },
      { id: 'moderate', label: 'Moderate', color: '#f97316' },
      { id: 'severe', label: 'Severe', color: '#ef4444' },
    ],
    beliefs: { 'none': 0.25, 'minor': 0.35, 'moderate': 0.30, 'severe': 0.10 },
    evidence: null,
    containerId: 'container_impact',
  },
];

const containers: ContainerData[] = [
  { id: 'container_substance', label: 'Substance', category: 'substance', collapsed: false, childNodeIds: ['sed_cu', 'sed_zn', 'sed_pahs'], position: { x: 50, y: 100 } },
  { id: 'container_condition', label: 'Environmental Conditions', category: 'condition', collapsed: false, childNodeIds: ['toc', 'avs', 'grain_size'], position: { x: 350, y: 100 } },
  { id: 'container_effect', label: 'Effect', category: 'effect', collapsed: false, childNodeIds: ['metal_bioavail', 'tox_amphipod', 'taxa_richness', 'diversity'], position: { x: 650, y: 100 } },
  { id: 'container_impact', label: 'Impact', category: 'impact', collapsed: false, childNodeIds: ['benthic_impact'], position: { x: 950, y: 100 } },
];

const edges: NetworkEdge[] = [
  { id: 'e1', source: 'sed_cu', target: 'metal_bioavail' },
  { id: 'e2', source: 'sed_zn', target: 'metal_bioavail' },
  { id: 'e3', source: 'toc', target: 'metal_bioavail' },
  { id: 'e4', source: 'avs', target: 'metal_bioavail' },
  { id: 'e5', source: 'sed_pahs', target: 'tox_amphipod' },
  { id: 'e6', source: 'metal_bioavail', target: 'tox_amphipod' },
  { id: 'e7', source: 'tox_amphipod', target: 'taxa_richness' },
  { id: 'e8', source: 'tox_amphipod', target: 'diversity' },
  { id: 'e9', source: 'grain_size', target: 'taxa_richness' },
  { id: 'e10', source: 'metal_bioavail', target: 'benthic_impact' },
  { id: 'e11', source: 'tox_amphipod', target: 'benthic_impact' },
  { id: 'e12', source: 'taxa_richness', target: 'benthic_impact' },
  { id: 'e13', source: 'diversity', target: 'benthic_impact' },
];

const cpts: ConditionalProbabilityTable[] = [
  {
    nodeId: 'metal_bioavail',
    parentNodeIds: ['sed_cu', 'toc', 'avs'],
    entries: [
      { parentStates: { sed_cu: 'below_isqg', toc: 'high', avs: 'high' }, distribution: { low: 0.90, moderate: 0.08, high: 0.02 } },
      { parentStates: { sed_cu: 'above_pel', toc: 'low', avs: 'low' }, distribution: { low: 0.05, moderate: 0.25, high: 0.70 } },
    ],
  },
];

export function createDummyNetwork(): NetworkModel {
  const allNodes = [...substanceNodes, ...conditionNodes, ...effectNodes, ...impactNodes];
  return {
    id: 'dummy-benthic-risk-model',
    name: 'Benthic Risk Assessment Model',
    description: 'BN-RRM for evaluating contamination impacts on benthic communities',
    version: '1.0.0-dummy',
    nodes: allNodes,
    edges,
    containers,
    cpts,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'OpenPRA Development',
  };
}

export function calculateNodePositions(model: NetworkModel): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const nodeSpacing = 160;

  model.containers.forEach((container) => {
    container.childNodeIds.forEach((nodeId, nodeIndex) => {
      positions[nodeId] = { x: 0, y: nodeIndex * nodeSpacing };
    });
  });

  return positions;
}
