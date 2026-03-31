/**
 * BN-RRM Model Pack Types
 *
 * TypeScript definitions for the manifest-driven model pack system.
 * These types mirror pack.schema.json and pack-registry.schema.json.
 *
 * @see bn_learning/pack_schema/pack.schema.json
 * @see bn_learning/pack_schema/pack-registry.schema.json
 * @see bn_learning/pack_schema/PACK_GOVERNANCE_CONVENTION.md
 */

// ---------------------------------------------------------------------------
// Enums / Literals
// ---------------------------------------------------------------------------

export type ScopeType = 'general' | 'benchmark' | 'site_specific' | 'experimental';

export type ModelFamily = 'general' | 'benchmark' | 'site' | 'experimental';

export type ReleaseStage = 'scaffold' | 'prototype' | 'internal' | 'review' | 'published';

export type DecisionRule = 'MAP' | 'entropy';

export type WaterbodyType = 'marine' | 'freshwater';

/** MVP: all packs use this schema version */
export const CANONICAL_SCHEMA_VERSION = 'canonical-20node-v1' as const;

// ---------------------------------------------------------------------------
// Pack Manifest (pack.json)
// ---------------------------------------------------------------------------

export interface SiteEntry {
  registry_id: string;
  name: string;
  waterbody: WaterbodyType;
}

export interface SiteScope {
  registry_id: string;
  name: string;
  waterbody: WaterbodyType;
}

export interface TrainingCorpus {
  n_stations: number;
  n_co_located: number;
  n_sites: number;
  cohort_rule: string;
  dataset_status: string;
}

export interface EvaluationProfile {
  decision_rule: DecisionRule;
  primary_metric: string;
  loo_accuracy?: number;
  loo_kappa?: number;
}

export interface VersionHistory {
  created: string; // ISO 8601 date
  model_version: string;
  architecture_version: string;
}

export interface ReviewArtifacts {
  model_overview: string;
  validation: string;
  comparison: string;
  decisions: string;
  cpt_transparency: string;
  provenance: string;
  site_reports: string;
  risk_comparison: string;
  explainer: string;
  sensitivity: string;
}

export interface PackArtifacts {
  runtime_model: string;
  review: ReviewArtifacts;
}

export interface PackManifest {
  pack_id: string;
  display_name: string;
  model_family: ModelFamily;
  scope_type: ScopeType;
  site_scope: SiteScope | null;
  site_inventory: SiteEntry[];
  runtime_schema_version: typeof CANONICAL_SCHEMA_VERSION;
  dag_node_count: 20;
  dag_edge_count: 24;
  training_corpus: TrainingCorpus;
  evaluation_profile: EvaluationProfile;
  release_stage: ReleaseStage;
  is_default: boolean;
  parent_pack_id: string | null;
  applicability_boundaries: string[];
  version_history: VersionHistory;
  artifacts: PackArtifacts;
}

// ---------------------------------------------------------------------------
// Pack Registry (pack-registry.json)
// ---------------------------------------------------------------------------

export interface PackRegistryEntry {
  pack_id: string;
  display_name: string;
  scope_type: ScopeType;
  release_stage: ReleaseStage;
  is_default: boolean;
  path: string;
}

export interface PackRegistry {
  schema_version: '1.0';
  default_pack_id: string;
  packs: PackRegistryEntry[];
}

// ---------------------------------------------------------------------------
// Review artifact key type (for usePackArtifact hook)
// ---------------------------------------------------------------------------

export type ReviewArtifactKey = keyof ReviewArtifacts;

export const REVIEW_ARTIFACT_KEYS: ReviewArtifactKey[] = [
  'model_overview',
  'validation',
  'comparison',
  'decisions',
  'cpt_transparency',
  'provenance',
  'site_reports',
  'risk_comparison',
  'explainer',
  'sensitivity',
];

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

export interface ScopeBadge {
  text: string;
  variant: 'default' | 'benchmark' | 'site' | 'experimental';
}

export function getScopeBadge(manifest: PackManifest): ScopeBadge {
  switch (manifest.scope_type) {
    case 'general':
      return { text: 'General', variant: 'default' };
    case 'benchmark':
      return { text: 'Benchmark (read-only)', variant: 'benchmark' };
    case 'site_specific':
      return {
        text: manifest.site_scope?.name ? `Site: ${manifest.site_scope.name}` : 'Site-Specific',
        variant: 'site',
      };
    case 'experimental':
      return { text: 'Experimental', variant: 'experimental' };
  }
}

export interface ReleaseBadge {
  text: string;
  color: 'gray' | 'yellow' | 'blue' | 'orange' | 'green';
  showBanner: boolean;
  bannerText?: string;
}

export function getReleaseBadge(stage: ReleaseStage): ReleaseBadge {
  switch (stage) {
    case 'scaffold':
      return {
        text: 'Scaffold',
        color: 'gray',
        showBanner: true,
        bannerText: 'Scaffold — not a fitted model',
      };
    case 'prototype':
      return {
        text: 'Prototype',
        color: 'yellow',
        showBanner: true,
        bannerText: 'Prototype — under development',
      };
    case 'internal':
      return { text: 'Internal', color: 'blue', showBanner: false };
    case 'review':
      return {
        text: 'Under Review',
        color: 'orange',
        showBanner: true,
        bannerText: 'Under external review',
      };
    case 'published':
      return { text: 'Published', color: 'green', showBanner: false };
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Assert that a pack uses the canonical 20-node schema. Throws if not. */
export function assertCanonicalSchema(manifest: PackManifest): void {
  if (manifest.runtime_schema_version !== CANONICAL_SCHEMA_VERSION) {
    throw new Error(
      `Pack '${manifest.pack_id}' uses schema '${manifest.runtime_schema_version}', ` +
      `but only '${CANONICAL_SCHEMA_VERSION}' is supported.`
    );
  }
  if (manifest.dag_node_count !== 20) {
    throw new Error(
      `Pack '${manifest.pack_id}' has ${manifest.dag_node_count} nodes, expected 20.`
    );
  }
  if (manifest.dag_edge_count !== 24) {
    throw new Error(
      `Pack '${manifest.pack_id}' has ${manifest.dag_edge_count} edges, expected 24.`
    );
  }
}

/** Check if a pack is read-only (benchmark packs) */
export function isReadOnlyPack(manifest: PackManifest): boolean {
  return manifest.scope_type === 'benchmark';
}
