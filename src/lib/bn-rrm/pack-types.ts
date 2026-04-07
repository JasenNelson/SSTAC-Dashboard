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

/** Canonical 20-node schema version (original BN-RRM sediment model) */
export const CANONICAL_SCHEMA_VERSION = 'canonical-20node-v1' as const;

/** Supported runtime schema versions */
export type RuntimeSchemaVersion = 'canonical-20node-v1' | 'generic-bn-rrm-v1';

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
  /** Benchmark packs: fish tissue sample count */
  n_fish_cases?: number;
  /** Benchmark packs: water sample count */
  n_water_cases?: number;
  cohort_rule: string;
  dataset_status: string;
}

export interface EvaluationProfile {
  decision_rule: DecisionRule;
  primary_metric: string;
  loo_accuracy?: number;
  loo_kappa?: number;
  /** Benchmark packs: fish-specific LOO metrics */
  loo_accuracy_fish?: number;
  loo_kappa_fish?: number;
  /** Benchmark packs: water-specific LOO metrics */
  loo_accuracy_water?: number;
  loo_kappa_water?: number;
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
  /** Benchmark packs: digitized published CPTs, sensitivity rankings, predictions */
  published_reference: string;
  /** Benchmark packs: structural comparison, sensitivity ranking comparison, LOO summary */
  comparison_results: string;
}

export interface MapArtifacts {
  basins_gsl?: string;
  basins_gbs?: string;
  advisory_lakes?: string;
  commercial_fisheries?: string;
  historic_mines?: string;
  large_mines?: string;
  mineral_claims?: string;
  oil_gas_claims?: string;
  hydro_facilities?: string;
  communities?: string;
  climate_stations?: string;
  thaw_slumps?: string;
}

export interface PackArtifacts {
  runtime_model: string;
  /** Benchmark packs: combined training data for read-only data viewer */
  training_data?: string;
  review: ReviewArtifacts;
  /** Optional pack-native map overlays (GeoJSON paths relative to pack base URL) */
  map?: MapArtifacts;
}

export interface PackManifest {
  pack_id: string;
  display_name: string;
  model_family: ModelFamily;
  scope_type: ScopeType;
  site_scope: SiteScope | null;
  site_inventory: SiteEntry[];
  runtime_schema_version: RuntimeSchemaVersion;
  dag_node_count: number;
  dag_edge_count: number;
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
  'published_reference',
  'comparison_results',
];

// ---------------------------------------------------------------------------
// Map artifact key type (for pack-native map overlays)
// ---------------------------------------------------------------------------

export type MapArtifactKey = keyof MapArtifacts;

export const MAP_ARTIFACT_KEYS: MapArtifactKey[] = [
  'basins_gsl',
  'basins_gbs',
  'advisory_lakes',
  'commercial_fisheries',
  'historic_mines',
  'large_mines',
  'mineral_claims',
  'oil_gas_claims',
  'hydro_facilities',
  'communities',
  'climate_stations',
  'thaw_slumps',
];

export const MAP_ARTIFACT_CATEGORIES: Record<MapArtifactKey, string> = {
  basins_gsl: 'basins',
  basins_gbs: 'basins',
  advisory_lakes: 'advisories',
  commercial_fisheries: 'fisheries',
  historic_mines: 'mining',
  large_mines: 'mining',
  mineral_claims: 'mining',
  oil_gas_claims: 'energy',
  hydro_facilities: 'energy',
  communities: 'communities',
  climate_stations: 'climate',
  thaw_slumps: 'permafrost',
};

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

/**
 * Validate a pack's schema version and structural counts.
 * - For 'canonical-20node-v1': enforces exactly 20 nodes / 24 edges.
 * - For 'generic-bn-rrm-v1': validates node_count > 0 and edge_count > 0.
 * - Throws for unknown schema versions.
 *
 * Backward-compatible: replaces assertCanonicalSchema with broader dispatch.
 */
export function validatePackSchema(manifest: PackManifest): void {
  switch (manifest.runtime_schema_version) {
    case 'canonical-20node-v1':
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
      break;

    case 'generic-bn-rrm-v1':
      if (manifest.dag_node_count <= 0) {
        throw new Error(
          `Pack '${manifest.pack_id}' has ${manifest.dag_node_count} nodes, expected > 0.`
        );
      }
      if (manifest.dag_edge_count <= 0) {
        throw new Error(
          `Pack '${manifest.pack_id}' has ${manifest.dag_edge_count} edges, expected > 0.`
        );
      }
      break;

    default:
      throw new Error(
        `Pack '${manifest.pack_id}' uses unsupported schema version ` +
        `'${manifest.runtime_schema_version}'.`
      );
  }
}

/**
 * @deprecated Use validatePackSchema instead. Kept for backward compatibility.
 */
export function assertCanonicalSchema(manifest: PackManifest): void {
  validatePackSchema(manifest);
}

/** Check if a pack is read-only (benchmark packs) */
export function isReadOnlyPack(manifest: PackManifest): boolean {
  return manifest.scope_type === 'benchmark';
}
