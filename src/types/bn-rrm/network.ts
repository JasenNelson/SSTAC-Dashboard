/**
 * OpenPRA Network Types
 *
 * Defines the data structures for the Bayesian Network visualization
 * following the Substance -> Environmental Conditions -> Effect -> Impact framework
 */

// =============================================================================
// NODE TYPES
// =============================================================================

export type NodeCategory = 'substance' | 'condition' | 'effect' | 'impact';

export interface NodeState {
  id: string;
  label: string;
  minValue?: number;
  maxValue?: number;
  color?: string;
}

export interface BeliefDistribution {
  [stateId: string]: number;
}

export interface GuidelineReference {
  name: string;
  value: number;
  source: string;
}

export interface BaseNodeData {
  id: string;
  label: string;
  description?: string;
  category: NodeCategory;
  states: NodeState[];
  beliefs: BeliefDistribution;
  evidence: string | null;
  isHighlighted?: boolean;
  containerId?: string;

}

export interface SubstanceNodeData extends BaseNodeData {
  category: 'substance';
  parameter: string;
  unit: string;
  guidelines?: GuidelineReference[];
  mediaType: 'sediment' | 'porewater' | 'tissue' | 'water';
}

export interface ConditionNodeData extends BaseNodeData {
  category: 'condition';
  parameter: string;
  unit: string;
  typicalRange?: { min: number; max: number };
  effectDirection?: 'increases' | 'decreases' | 'variable';
}

export interface EffectNodeData extends BaseNodeData {
  category: 'effect';
  endpoint: string;
  testType?: string;
  responseDirection: 'higher_is_worse' | 'lower_is_worse';
}

export interface ImpactNodeData extends BaseNodeData {
  category: 'impact';
  impactType: 'community' | 'ecosystem' | 'integrated';
}

export type NetworkNodeData =
  | SubstanceNodeData
  | ConditionNodeData
  | EffectNodeData
  | ImpactNodeData;

// =============================================================================
// CONTAINER TYPES
// =============================================================================

export interface ContainerData {
  id: string;
  label: string;
  category: NodeCategory;
  collapsed: boolean;
  childNodeIds: string[];
  position: { x: number; y: number };
  summaryBelief?: {
    worstCase: string;
    probability: number;
  };
}

// =============================================================================
// EDGE TYPES
// =============================================================================

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  animated?: boolean;
  contextual?: boolean;
  style?: {
    stroke?: string;
    strokeWidth?: number;
  };
}

// =============================================================================
// CPT
// =============================================================================

export interface CPTEntry {
  parentStates: Record<string, string>;
  distribution: BeliefDistribution;
}

export interface ConditionalProbabilityTable {
  nodeId: string;
  parentNodeIds: string[];
  entries: CPTEntry[];
}

// =============================================================================
// NETWORK MODEL
// =============================================================================

export interface NetworkModel {
  id: string;
  name: string;
  description?: string;
  version?: string;
  nodes: NetworkNodeData[];
  edges: NetworkEdge[];
  containers: ContainerData[];
  cpts: ConditionalProbabilityTable[];
  createdAt: string;
  updatedAt: string;
  author?: string;
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

// =============================================================================
// INFERENCE TYPES
// =============================================================================

export interface Evidence {
  [nodeId: string]: string;
}

export interface InferenceResult {
  beliefs: {
    [nodeId: string]: BeliefDistribution;
  };
  computationTimeMs: number;
  algorithm: string;
}

export interface BackwardInferenceRequest {
  targetNode: string;
  acceptableStates: string[];
  targetProbability: number;
  queryNode: string;
  fixedEvidence: Evidence;
}

export interface BackwardInferenceResult {
  protectiveState: string;
  protectiveValue?: number;
  achievedProbability: number;
  comparisonToGuideline?: number;
  computationSteps: string[];
}

export interface SensitivityResult {
  parameter: string;
  lowValueImpact: number;
  highValueImpact: number;
  range: number;
}

// =============================================================================
// UI STATE TYPES
// =============================================================================

export type ViewMode = 'conceptual' | 'detailed' | 'map' | 'data';

export interface UIState {
  viewMode: ViewMode;
  selectedNodeId: string | null;
  selectedContainerId: string | null;
  showMinimap: boolean;
  showNodeInspector: boolean;
  showResultsPanel: boolean;
  inferenceMode: 'forward' | 'backward';
}

// =============================================================================
// IMPACT CATEGORY HELPERS
// =============================================================================

export const IMPACT_CATEGORIES = ['None', 'Minor', 'Moderate', 'Severe'] as const;
export type ImpactCategory = typeof IMPACT_CATEGORIES[number];

export const IMPACT_COLORS: Record<ImpactCategory, string> = {
  None: '#22c55e',
  Minor: '#eab308',
  Moderate: '#f97316',
  Severe: '#ef4444',
};

export const NODE_CATEGORY_COLORS: Record<NodeCategory, string> = {
  substance: '#3b82f6',
  condition: '#8b5cf6',
  effect: '#f59e0b',
  impact: '#ef4444',
};
