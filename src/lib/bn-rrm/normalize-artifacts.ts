/**
 * BN-RRM Artifact Normalizers
 *
 * Each function takes raw JSON from a pack artifact (general OR site-specific)
 * and returns a stable typed object with safe defaults. Components consume ONLY
 * the normalized shape - all raw-shape detection lives here.
 */

/** Generic JSON object from pack artifact files. */
type RawObject = Record<string, unknown>;

/** Helper to safely access a nested property on an unknown value. */
function isObj(v: unknown): v is RawObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Helper to safely treat unknown as array. */
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

// Model Overview

export interface NormalizedModelOverview {
  meta: {
    dataset_status: string;
    export_date: string;
    db_hash: string;
    model_version: string;
    handoff_version: string;
    scope: string;
    site_registry_id: string;
  };
  identity: {
    name: string;
    framework: string;
    nodes: number;
    edges: number;
    states_per_node: number;
    parent_model: string;
  };
  performance: {
    type: string;
    accuracy: number | null;
    kappa: number | null;
    n_complete: number | null;
    disclaimer: string;
    per_class: Record<string, { precision: number; recall: number; f1: number; support: number }> | null;
    kappa_interpretation: {
      scale: Array<{ range: [number, number]; label: string; color: string }>;
      narrative: string;
    } | null;
    performance_plateau: {
      previous_n: number;
      current_n: number;
      interpretation: string;
    } | null;
  };
  training: {
    total_sites: number | null;
    dataset_counts: Record<string, unknown> | null;
    site_name: string;
    registry_id: string;
    waterbody: string;
    n_stations: number | null;
    stations: Array<{ station_id: number; name: string; type: string }>;
    site_breakdown: unknown[];
  };
  architecture: { tiers: unknown[] } | null;
  intended_use: { primary: string; not_suitable_for: string[] } | null;
  limitations: string[];
  anti_overclaim: string;
  marginal_highlights: Array<{ node: string; states: Record<string, number> }>;
  publication_baseline: unknown;
}

export function normalizeModelOverview(raw: unknown): NormalizedModelOverview {
  if (!raw || !isObj(raw)) {
    return emptyModelOverview();
  }

  const meta = isObj(raw._meta) ? raw._meta : {} as RawObject;
  // General: performance; Site: diagnostic
  const perf = isObj(raw.performance) ? raw.performance : isObj(raw.diagnostic) ? raw.diagnostic : {} as RawObject;
  const data = isObj(raw.training_data) ? raw.training_data : {} as RawObject;
  const datasetCounts = isObj(data.dataset_counts) ? data.dataset_counts : isObj(data.record_counts) ? data.record_counts : null;

  const identity = isObj(raw.model_identity) ? raw.model_identity : {} as RawObject;
  const diag = isObj(raw.diagnostic) ? raw.diagnostic : {} as RawObject;
  const kappaInterp = isObj(perf.kappa_interpretation) ? perf.kappa_interpretation : null;
  const perfPlateau = isObj(perf.performance_plateau) ? perf.performance_plateau : null;
  const arch = isObj(raw.architecture) ? raw.architecture : null;
  const intendedUse = isObj(raw.intended_use) ? raw.intended_use : null;
  const marginals = isObj(raw.marginal_highlights) ? raw.marginal_highlights : {};

  return {
    meta: {
      dataset_status: (meta.dataset_status as string) ?? '',
      export_date: (meta.export_date as string) ?? '',
      db_hash: (meta.db_hash as string) ?? '',
      model_version: (meta.model_version as string) ?? '',
      handoff_version: (meta.handoff_version as string) ?? '',
      scope: (meta.scope as string) ?? 'general',
      site_registry_id: (meta.site_registry_id as string) ?? '',
    },
    identity: {
      name: (identity.name as string) ?? '',
      framework: (identity.framework as string) ?? '',
      nodes: (identity.nodes as number) ?? 0,
      edges: (identity.edges as number) ?? 0,
      states_per_node: (identity.states_per_node as number) ?? 0,
      parent_model: (identity.parent_model as string) ?? '',
    },
    performance: {
      type: (diag.type as string) ?? 'loo_cross_validation',
      accuracy: (perf.loo_accuracy as number) ?? (perf.accuracy as number) ?? null,
      kappa: (perf.loo_kappa as number) ?? (perf.kappa as number) ?? null,
      n_complete: (perf.n_complete as number) ?? (perf.n_eligible as number) ?? null,
      disclaimer: (perf.disclaimer as string) ?? '',
      per_class: (perf.per_class as NormalizedModelOverview['performance']['per_class']) ?? null,
      kappa_interpretation: kappaInterp
        ? {
            scale: asArray(kappaInterp.scale) as Array<{ range: [number, number]; label: string; color: string }>,
            narrative: (kappaInterp.narrative as string) ?? '',
          }
        : null,
      performance_plateau: perfPlateau
        ? {
            previous_n: (perfPlateau.previous_n as number) ?? 0,
            current_n: (perfPlateau.current_n as number) ?? 0,
            interpretation: (perfPlateau.interpretation as string) ?? '',
          }
        : null,
    },
    training: {
      total_sites: (data.total_sites as number) ?? (datasetCounts?.sites as number) ?? null,
      dataset_counts: datasetCounts as Record<string, unknown> | null,
      site_name: (data.site as string) ?? '',
      registry_id: (data.registry_id as string) ?? '',
      waterbody: (data.waterbody as string) ?? '',
      n_stations: (data.n_stations as number) ?? (datasetCounts?.stations as number) ?? null,
      stations: asArray(data.stations).map((station: unknown) => {
        const s = isObj(station) ? station : {} as RawObject;
        return {
          station_id: (s.station_id as number) ?? 0,
          name: (s.name as string) ?? '',
          type: (s.type as string) ?? '',
        };
      }),
      site_breakdown: asArray(data.site_breakdown),
    },
    architecture: arch && Array.isArray(arch.tiers) ? { tiers: arch.tiers as unknown[] } : null,
    intended_use: intendedUse
      ? {
          primary: (intendedUse.primary as string) ?? '',
          not_suitable_for: (intendedUse.not_suitable_for as string[]) ?? [],
        }
      : null,
    limitations: (raw.limitations as string[]) ?? (raw.applicability_boundaries as string[]) ?? [],
    anti_overclaim: (raw.anti_overclaim as string) ?? '',
    marginal_highlights: Object.entries(marginals).map(([node, states]) => ({
      node,
      states: typeof states === 'object' && states !== null ? states as Record<string, number> : {},
    })),
    publication_baseline: raw.publication_baseline ?? null,
  };
}

function emptyModelOverview(): NormalizedModelOverview {
  return {
    meta: { dataset_status: '', export_date: '', db_hash: '', model_version: '', handoff_version: '', scope: '', site_registry_id: '' },
    identity: { name: '', framework: '', nodes: 0, edges: 0, states_per_node: 0, parent_model: '' },
    performance: { type: '', accuracy: null, kappa: null, n_complete: null, disclaimer: '', per_class: null, kappa_interpretation: null, performance_plateau: null },
    training: { total_sites: null, dataset_counts: null, site_name: '', registry_id: '', waterbody: '', n_stations: null, stations: [], site_breakdown: [] },
    architecture: null,
    intended_use: null,
    limitations: [],
    anti_overclaim: '',
    marginal_highlights: [],
    publication_baseline: null,
  };
}

// Validation

export interface NormalizedPrediction {
  station_id: number;
  station_name: string;
  predicted: string;
  observed: string;
  posterior?: Record<string, number>;
}

export interface NormalizedValidation {
  n_complete: number;
  accuracy: number | null;
  kappa: number | null;
  predictions: NormalizedPrediction[];
  per_class: Record<string, { precision: number; recall: number; f1: number; support: number }> | null;
  disclaimer: string;
  status: string;
  semanticScope: string;
}

export function normalizeValidation(raw: unknown): NormalizedValidation {
  if (!raw || !isObj(raw)) {
    return {
      n_complete: 0,
      accuracy: null,
      kappa: null,
      predictions: [],
      per_class: null,
      disclaimer: '',
      status: '',
      semanticScope: '',
    };
  }

  // General: predictions; Site: station_results
  const rawPredictions = raw.predictions ?? raw.station_results ?? [];
  const predictions: NormalizedPrediction[] = asArray(rawPredictions)
    .map((item: unknown) => {
      const p = isObj(item) ? item : {} as RawObject;
      return {
        station_id: (p.station_id as number) ?? 0,
        station_name: (p.station_name as string) ?? '',
        predicted: (p.predicted as string) ?? '',
        observed: (p.observed as string) ?? '',
        ...(p.posterior ? { posterior: p.posterior as Record<string, number> } : {}),
      };
    });

  return {
    n_complete: (raw.n_complete as number) ?? predictions.length,
    accuracy: (raw.loo_accuracy as number) ?? (raw.accuracy as number) ?? null,
    kappa: (raw.loo_kappa as number) ?? (raw.kappa as number) ?? null,
    predictions,
    per_class: (raw.per_class as NormalizedValidation['per_class']) ?? null,
    disclaimer: (raw.disclaimer as string) ?? '',
    status: (raw.status as string) ?? '',
    semanticScope: (raw.semantic_scope as string) ?? '',
  };
}

// Decisions

export interface NormalizedDecisionRecord {
  id: string;
  title: string;
  status: string;
  date: string;
  severity: string;
  summary: string;
  rationale: string;
  impact: string;
  reopen_criteria: string;
  related_issues: string[];
}

export interface NormalizedLimitation {
  id: string;
  title: string;
  severity: string;
  category: string;
  description: string;
  mitigation: string;
  related: string;
}

export interface NormalizedIssueSummary {
  total_issues: number;
  fixed: number;
  active_limitations: number;
  accepted: number;
  note: string;
}

export interface NormalizedDecisions {
  decision_records: NormalizedDecisionRecord[];
  known_limitations: NormalizedLimitation[];
  issue_summary: NormalizedIssueSummary | null;
  spec_versions: Record<string, string>;
  applicability_boundaries: string[];
  meta: { export_date: string; source_docs: string[] };
}

export function normalizeDecisions(raw: unknown): NormalizedDecisions {
  if (!raw || !isObj(raw)) {
    return {
      decision_records: [],
      known_limitations: [],
      issue_summary: null,
      spec_versions: {},
      applicability_boundaries: [],
      meta: { export_date: '', source_docs: [] },
    };
  }

  const decisions: NormalizedDecisionRecord[] = asArray(raw.decision_records).map((item: unknown) => {
    const d = isObj(item) ? item : {} as RawObject;
    return {
      id: (d.id as string) ?? '',
      title: (d.title as string) ?? '',
      status: (d.status as string) ?? '',
      date: (d.date as string) ?? '',
      severity: (d.severity as string) ?? 'MEDIUM',
      summary: (d.summary as string) ?? '',
      rationale: (d.rationale as string) ?? '',
      impact: (d.impact as string) ?? '',
      reopen_criteria: (d.reopen_criteria as string) ?? '',
      related_issues: (d.related_issues as string[]) ?? [],
    };
  });

  const limitations: NormalizedLimitation[] = asArray(raw.known_limitations).map((item: unknown) => {
    const l = isObj(item) ? item : {} as RawObject;
    return {
      id: (l.id as string) ?? '',
      title: (l.title as string) ?? '',
      severity: (l.severity as string) ?? 'MEDIUM',
      category: (l.category as string) ?? '',
      description: (l.description as string) ?? '',
      mitigation: (l.mitigation as string) ?? '',
      related: (l.related as string) ?? '',
    };
  });

  const rawIssueSummary = isObj(raw.issue_summary) ? raw.issue_summary : null;
  const issueSummary = rawIssueSummary
    ? {
        total_issues: (rawIssueSummary.total_issues as number) ?? 0,
        fixed: (rawIssueSummary.fixed as number) ?? 0,
        active_limitations: (rawIssueSummary.active_limitations as number) ?? 0,
        accepted: (rawIssueSummary.accepted as number) ?? 0,
        note: (rawIssueSummary.note as string) ?? '',
      }
    : null;

  const rawMeta = isObj(raw._meta) ? raw._meta : {} as RawObject;

  return {
    decision_records: decisions,
    known_limitations: limitations,
    issue_summary: issueSummary,
    spec_versions: (raw.spec_versions as Record<string, string>) ?? {},
    applicability_boundaries: (raw.applicability_boundaries as string[]) ?? [],
    meta: {
      export_date: (rawMeta.export_date as string) ?? '',
      source_docs: (rawMeta.source_docs as string[]) ?? [],
    },
  };
}

// CPT Transparency

export interface NormalizedCptNode {
  id: string;
  label: string;
  tier: number;
  cpt_source: string;
  sample_count: number;
  parameter: string | null;
  unit: string | null;
  dr001_affected: boolean;
  config_coverage: { observed: number; possible: number; coverage_pct: number } | null;
  expert_distribution: { states: string[]; marginal: Record<string, number> } | null;
  learned_distribution: { states: string[]; marginal: Record<string, number> } | null;
  ess_prior_weight: { ess: number | null; method: string; note: string } | null;
  // Site-specific fields
  method: string | null;
  alpha: number | null;
  data_weight_pct: number | null;
  expert_weight_pct: number | null;
  n_site_stations: number | null;
  assessment: string | null;
}

export interface NormalizedTierSummary {
  tier: number;
  name: string;
  node_count: number;
  cpt_methods: string[];
}

export interface NormalizedDr001Callout {
  id: string;
  title: string;
  affected_nodes: string[];
  description: string;
  severity: string;
}

export interface NormalizedCptTransparency {
  nodes: NormalizedCptNode[];
  tier_summary: NormalizedTierSummary[];
  dr001_callout: NormalizedDr001Callout | null;
  expert_dominance_disclosure: string;
  meta: { export_date: string; db_hash: string };
}

export function normalizeCptTransparency(raw: unknown): NormalizedCptTransparency {
  if (!raw || !isObj(raw)) {
    return { nodes: [], tier_summary: [], dr001_callout: null, expert_dominance_disclosure: '', meta: { export_date: '', db_hash: '' } };
  }

  const nodes: NormalizedCptNode[] = asArray(raw.nodes).map((item: unknown) => {
    const n = isObj(item) ? item : {} as RawObject;
    return {
      // General pack fields
      id: (n.id as string) ?? (n.node_id as string) ?? '',
      label: (n.label as string) ?? (n.node_id as string) ?? '',
      tier: (n.tier as number) ?? 0,
      cpt_source: (n.cpt_source as string) ?? (n.method as string) ?? '',
      sample_count: (n.sample_count as number) ?? (n.n_site_stations as number) ?? 0,
      parameter: (n.parameter as string) ?? null,
      unit: (n.unit as string) ?? null,
      dr001_affected: (n.dr001_affected as boolean) ?? false,
      config_coverage: (n.config_coverage as NormalizedCptNode['config_coverage']) ?? null,
      expert_distribution: (n.expert_distribution as NormalizedCptNode['expert_distribution']) ?? null,
      learned_distribution: (n.learned_distribution as NormalizedCptNode['learned_distribution']) ?? null,
      ess_prior_weight: (n.ess_prior_weight as NormalizedCptNode['ess_prior_weight']) ?? null,
      // Site-specific fields
      method: (n.method as string) ?? null,
      alpha: (n.alpha as number) ?? null,
      data_weight_pct: (n.data_weight_pct as number) ?? null,
      expert_weight_pct: (n.expert_weight_pct as number) ?? null,
      n_site_stations: (n.n_site_stations as number) ?? null,
      assessment: (n.assessment as string) ?? null,
    };
  });

  const tierSummary: NormalizedTierSummary[] = asArray(raw.tier_summary).map((item: unknown) => {
    const ts = isObj(item) ? item : {} as RawObject;
    return {
      tier: (ts.tier as number) ?? 0,
      name: (ts.name as string) ?? '',
      node_count: (ts.node_count as number) ?? 0,
      cpt_methods: (ts.cpt_methods as string[]) ?? [],
    };
  });

  const rawDr001 = isObj(raw.dr001_callout) ? raw.dr001_callout : null;
  const dr001 = rawDr001
    ? {
        id: (rawDr001.id as string) ?? '',
        title: (rawDr001.title as string) ?? '',
        affected_nodes: (rawDr001.affected_nodes as string[]) ?? [],
        description: (rawDr001.description as string) ?? '',
        severity: (rawDr001.severity as string) ?? '',
      }
    : null;

  const cptMeta = isObj(raw._meta) ? raw._meta : {} as RawObject;

  return {
    nodes,
    tier_summary: tierSummary,
    dr001_callout: dr001,
    expert_dominance_disclosure: (raw.expert_dominance_disclosure as string) ?? '',
    meta: {
      export_date: (cptMeta.export_date as string) ?? '',
      db_hash: (cptMeta.db_hash as string) ?? '',
    },
  };
}

// Provenance

export interface NormalizedDocument {
  doc_id: number;
  site_id: number;
  filename: string | null;
  title: string;
  author: string;
  date: string;
  type: string;
  pages: number | null;
}

export interface NormalizedProvenanceRecord {
  target_table: string;
  page_number: number | string | null;
  table_number: string | null;
  figure_number: string | null;
  extraction_method: string | null;
  confidence: number | null;
  reviewer_verified: boolean | null;
  doc_title: string;
  doc_author: string;
  doc_type: string;
}

export interface NormalizedStation {
  station_id: number;
  station_name: string;
  site_name: string;
  registry_id: string;
  waterbody_type: string;
  data_counts: { chemistry: number; toxicity: number; community: number };
  co_location: string;
  provenance_quality: string;
  provenance_coverage: { data_records: number; provenance_linked: number; coverage_pct: number } | null;
  provenance_records: NormalizedProvenanceRecord[];
}

export interface NormalizedProvenance {
  documents: NormalizedDocument[];
  stations: NormalizedStation[];
  summary: {
    total_documents: number;
    total_stations: number;
    stations_with_provenance: number;
    co_location_breakdown: Record<string, number>;
  };
  n_provenance_records: number;
  coverage: string;
  meta: { export_date: string; db_hash: string };
}

export function normalizeProvenance(raw: unknown): NormalizedProvenance {
  if (!raw || !isObj(raw)) {
    return {
      documents: [],
      stations: [],
      summary: { total_documents: 0, total_stations: 0, stations_with_provenance: 0, co_location_breakdown: {} },
      n_provenance_records: 0,
      coverage: '',
      meta: { export_date: '', db_hash: '' },
    };
  }

  // General: documents + stations; Site: source_documents + n_provenance_records
  const documents: NormalizedDocument[] = asArray(raw.documents ?? raw.source_documents).map((item: unknown) => {
    const d = isObj(item) ? item : {} as RawObject;
    return {
      doc_id: (d.doc_id as number) ?? 0,
      site_id: (d.site_id as number) ?? 0,
      filename: (d.filename as string) ?? null,
      title: (d.title as string) ?? '',
      author: (d.author as string) ?? '',
      date: (d.date as string) ?? '',
      type: (d.type as string) ?? '',
      pages: (d.pages as number) ?? null,
    };
  });

  const stations: NormalizedStation[] = asArray(raw.stations).map((item: unknown) => {
    const s = isObj(item) ? item : {} as RawObject;
    const dataCounts = isObj(s.data_counts) ? s.data_counts : {} as RawObject;
    return {
      station_id: (s.station_id as number) ?? 0,
      station_name: (s.station_name as string) ?? '',
      site_name: (s.site_name as string) ?? '',
      registry_id: (s.registry_id as string) ?? '',
      waterbody_type: (s.waterbody_type as string) ?? '',
      data_counts: {
        chemistry: (dataCounts.chemistry as number) ?? 0,
        toxicity: (dataCounts.toxicity as number) ?? 0,
        community: (dataCounts.community as number) ?? 0,
      },
      co_location: (s.co_location as string) ?? '',
      provenance_quality: (s.provenance_quality as string) ?? 'no_data',
      provenance_coverage: (s.provenance_coverage as NormalizedStation['provenance_coverage']) ?? null,
      provenance_records: asArray(s.provenance_records).map((prItem: unknown) => {
        const pr = isObj(prItem) ? prItem : {} as RawObject;
        return {
          target_table: (pr.target_table as string) ?? '',
          page_number: (pr.page_number as number | string) ?? null,
          table_number: (pr.table_number as string) ?? null,
          figure_number: (pr.figure_number as string) ?? null,
          extraction_method: (pr.extraction_method as string) ?? null,
          confidence: (pr.confidence as number) ?? null,
          reviewer_verified: (pr.reviewer_verified as boolean) ?? null,
          doc_title: (pr.doc_title as string) ?? '',
          doc_author: (pr.doc_author as string) ?? '',
          doc_type: (pr.doc_type as string) ?? '',
        };
      }),
    };
  });

  const rawSummary = isObj(raw.summary) ? raw.summary : null;
  const summary = rawSummary ?? {
    total_documents: documents.length,
    total_stations: stations.length,
    stations_with_provenance: 0,
    co_location_breakdown: {},
  };

  const provMeta = isObj(raw._meta) ? raw._meta : {} as RawObject;

  return {
    documents,
    stations,
    summary: {
      total_documents: (summary.total_documents as number) ?? documents.length,
      total_stations: (summary.total_stations as number) ?? stations.length,
      stations_with_provenance: (summary.stations_with_provenance as number) ?? 0,
      co_location_breakdown: (summary.co_location_breakdown as Record<string, number>) ?? {},
    },
    n_provenance_records: (raw.n_provenance_records as number) ?? 0,
    coverage: (raw.coverage as string) ?? '',
    meta: {
      export_date: (provMeta.export_date as string) ?? '',
      db_hash: (provMeta.db_hash as string) ?? '',
    },
  };
}

// Site Reports

export interface NormalizedSpatialSummary {
  total_stations: number;
  georeferenced: number;
  by_class: Record<string, number>;
  methods_used: string[];
  accuracy_range_m: [number, number] | null;
  confidence_range: [number, number] | null;
}

export interface NormalizedSpatialContext {
  location_label: string;
  spatial_reference_type: string;
  spatial_source_ref: string;
  spatial_audit_note: string;
  spatial_summary?: NormalizedSpatialSummary | null;
}

export interface NormalizedSourceDocument {
  doc_id: number;
  title: string;
  author: string;
  date: string;
  type: string;
}

export interface NormalizedStationDetail {
  station_id: number;
  station_name: string;
  station_type: string;
  depth_m: number | null;
  latitude: number | null;
  longitude: number | null;
  date_earliest: string | null;
  date_latest: string | null;
  n_sample_dates: number;
  chemistry_records: number;
  toxicity_records: number;
  community_records: number;
  co_location: string;
  cross_year_merge: boolean;
  spatial_reference_type?: string;
  location_label?: string;
  spatial_audit_note?: string;
  spatial_class?: 'EXACT' | 'APPROXIMATE' | 'RELATIVE' | 'ZONE' | null;
  extraction_method?: string | null;
  confidence?: number | null;
  estimated_accuracy_m?: number | null;
  source_reference?: string | null;
  upgrade_path?: string | null;
}

export interface NormalizedChemRow {
  parameter: string;
  contaminant?: string;
  group: string | null;
  unit: string;
  isqg: number | null;
  pel: number | null;
  min: number | null;
  max: number | null;
  mean: number | null;
  n: number;
  exceed_isqg: number;
  exceed_pel: number;
}

export interface NormalizedToxRow {
  test_type: string;
  species: string;
  endpoint: string;
  unit: string;
  min: number | null;
  max: number | null;
  mean: number | null;
  n: number;
  sig_different_count: number;
}

export interface NormalizedCommunityMetric {
  name: string;
  min: number | null;
  max: number | null;
  mean: number | null;
}

export interface NormalizedSite {
  site_id: number;
  name: string;
  registry_id: string;
  waterbody_type: string;
  region: string | null;
  station_count: number;
  campaign_dates: {
    earliest: string;
    latest: string;
    n_unique_dates: number;
    n_years: number;
    cross_year: boolean;
  } | null;
  temporal_note: string | null;
  spatial_context: NormalizedSpatialContext | null;
  source_documents: NormalizedSourceDocument[] | null;
  station_details: NormalizedStationDetail[] | null;
  co_location_quality: Record<string, number>;
  woe_risk_distribution: Record<string, number>;
  chemistry_summary: NormalizedChemRow[] | null;
  toxicity_summary: NormalizedToxRow[] | null;
  community_summary: { n: number; metrics: NormalizedCommunityMetric[] } | null;
}

export interface NormalizedSiteReports {
  sites: NormalizedSite[];
  summary: {
    total_sites: number;
    total_stations: number;
    sites_with_chemistry: number;
    sites_with_toxicity: number;
    sites_with_community: number;
  };
  meta: { export_date: string; db_hash: string };
}

export function normalizeSiteReports(raw: unknown): NormalizedSiteReports {
  if (!raw || !isObj(raw)) {
    return {
      sites: [],
      summary: { total_sites: 0, total_stations: 0, sites_with_chemistry: 0, sites_with_toxicity: 0, sites_with_community: 0 },
      meta: { export_date: '', db_hash: '' },
    };
  }

  let sites: NormalizedSite[];

  if (Array.isArray(raw.sites)) {
    // General pack shape: { sites: [...] }
    sites = raw.sites.map((s: unknown) => normalizeSingleSite(s));
  } else if (Array.isArray(raw.stations)) {
    // Site pack shape: { site: string, n_stations: number, stations: [...] }
    const siteMeta = isObj(raw._meta) ? raw._meta : {} as RawObject;
    sites = [{
      site_id: 0,
      name: (raw.site as string) ?? 'Site',
      registry_id: (siteMeta.site_registry_id as string) ?? '',
      waterbody_type: '',
      region: null,
      station_count: (raw.n_stations as number) ?? raw.stations.length,
      campaign_dates: null,
      temporal_note: null,
      spatial_context: null,
      source_documents: null,
      station_details: raw.stations as NormalizedStationDetail[],
      co_location_quality: {},
      woe_risk_distribution: {},
      chemistry_summary: null,
      toxicity_summary: null,
      community_summary: null,
    }];
  } else {
    sites = [];
  }

  const rawSummary = isObj(raw.summary) ? raw.summary : null;
  const summary = rawSummary ?? {
    total_sites: sites.length,
    total_stations: sites.reduce((sum: number, s: NormalizedSite) => sum + s.station_count, 0),
    sites_with_chemistry: 0,
    sites_with_toxicity: 0,
    sites_with_community: 0,
  };

  const srMeta = isObj(raw._meta) ? raw._meta : {} as RawObject;

  return {
    sites,
    summary: {
      total_sites: (summary.total_sites as number) ?? sites.length,
      total_stations: (summary.total_stations as number) ?? 0,
      sites_with_chemistry: (summary.sites_with_chemistry as number) ?? 0,
      sites_with_toxicity: (summary.sites_with_toxicity as number) ?? 0,
      sites_with_community: (summary.sites_with_community as number) ?? 0,
    },
    meta: {
      export_date: (srMeta.export_date as string) ?? '',
      db_hash: (srMeta.db_hash as string) ?? '',
    },
  };
}

function normalizeSingleSite(raw: unknown): NormalizedSite {
  const s = isObj(raw) ? raw : {} as RawObject;
  const cd = isObj(s.campaign_dates) ? s.campaign_dates : null;
  return {
    site_id: (s.site_id as number) ?? 0,
    name: (s.name as string) ?? '',
    registry_id: (s.registry_id as string) ?? '',
    waterbody_type: (s.waterbody_type as string) ?? '',
    region: (s.region as string) ?? null,
    station_count: (s.station_count as number) ?? 0,
    campaign_dates: cd
      ? {
          earliest: (cd.earliest as string) ?? '',
          latest: (cd.latest as string) ?? '',
          n_unique_dates: (cd.n_unique_dates as number) ?? 0,
          n_years: (cd.n_years as number) ?? 0,
          cross_year: (cd.cross_year as boolean) ?? false,
        }
      : null,
    temporal_note: (s.temporal_note as string) ?? null,
    spatial_context: (s.spatial_context as NormalizedSpatialContext) ?? null,
    source_documents: (s.source_documents as NormalizedSourceDocument[]) ?? null,
    station_details: (s.station_details as NormalizedStationDetail[]) ?? null,
    co_location_quality: (s.co_location_quality as Record<string, number>) ?? {},
    woe_risk_distribution: (s.woe_risk_distribution as Record<string, number>) ?? {},
    chemistry_summary: (s.chemistry_summary as NormalizedChemRow[]) ?? null,
    toxicity_summary: (s.toxicity_summary as NormalizedToxRow[]) ?? null,
    community_summary: (s.community_summary as NormalizedSite['community_summary']) ?? null,
  };
}

// Risk Comparison

export interface NormalizedStationComparison {
  stationId: number;
  stationName: string;
  bnrrmPredicted: string | null;
  bnrrmObserved: string | null;
  predictionRule: string | null;
  comparisonClass: string | null;
  evaluationView: string | null;
  statisticalAuthorization: string | null;
  reportEstimate: {
    originalLabel: string;
    mappedBNClass: string | null;
    mappingConfidence: string;
    mappingJustification: string;
    comparatorType: string;
    frameworkType: string;
    provenance: {
      sourceDocument: string;
      sourcePage: number | null;
    };
  };
}

export interface NormalizedSiteComparison {
  siteId: number;
  siteName: string;
  registryId: string;
  stationComparisons: NormalizedStationComparison[];
  excludedStations: {
    noLOOPrediction: string[];
    noWOERecord: string[];
  };
}

export interface NormalizedExternalSite {
  siteId: string;
  siteName: string;
  registryId: string;
  region: string;
  waterbody: string;
  gateOutcome: string;
  gateReason: string;
  consultant: string;
  reportDate: string;
  reportTitle: string;
  comparisonType: string;
  bnInferenceStatus: string;
  externalComparisonClass: string;
  outputGranularity: string;
  interpretationAuthorization: string;
  contaminantOverlap: string;
  modifierEffectsStatus: {
    modifiers: string;
    effectsEvidence: string;
  } | null;
  uncertaintyFlags: string[];
  uncertaintyNote: string;
  bnInputCoverage: {
    metals: boolean;
    pahs: boolean;
    pcbs: boolean;
    toc: boolean;
    grainSize: boolean;
    sulfideBinding: boolean;
    toxicity: boolean;
    community: boolean;
    note: string;
  };
  pooledStatsEligible: boolean;
  benchmarkComparable: boolean;
  bnInputAssembly: {
    assemblySpecVersion: string;
    authorizedSpatialUnit: {
      type: string;
      id: string;
      basis: string;
    } | null;
  } | null;
  bnRunRecord: {
    runMethod: string;
    evidenceSourceSummary: string;
    encodingBasis: string;
    runDate: string;
    limitations: string[];
    evidenceMode: string;
    modelPackId: string;
    modelVersion: string;
    posteriorSummary: {
      low: number;
      moderate: number;
      high: number;
      map: string;
    } | null;
  } | null;
  reportConclusions: Array<{
    receptor: string;
    loeCount: number;
    loes: string[];
    woeConclusion: string;
    woeIntegrationNote?: string;
    mappedBNClass: string | null;
    mappingConfidence: string;
    mappingJustification: string;
    comparisonLevel: string;
    provenance: {
      sourceDocument: string;
      sourcePage: number | null;
      sourceTableFigure?: string;
      extractedLabel: string;
      extractionMethod: string;
      extractionDate: string;
      extractor: string;
    };
    isTrainingTarget: boolean;
  }>;
  toxicityStations: Array<{
    stationId: string;
    amphipodSurvival: number;
    polychaeteSurvival: number;
    polychaeteGrowth: number;
    bivalveDev: number;
  }>;
  statisticalAuthorization: {
    kappa: boolean;
    confusionMatrix: boolean;
    agreement: boolean;
    mcNemar: boolean;
    reason: string;
  };
}

export interface NormalizedRiskComparison {
  siteComparisons: NormalizedSiteComparison[];
  summary: {
    totalWOERecords: number;
    matchedStations: number;
    excludedNoLOO: number;
    excludedNoWOE: number;
    sitesWithWOE: number;
    sitesWithoutWOE: number;
    sitesWithoutWOENames: string[];
  };
  mappingTable: {
    source: string;
    mappings: Record<string, { mapped: string; confidence: string; justification: string }>;
  };
  meta: {
    governanceSpec: string;
    modelVersion: string;
    note: string;
    status: string;
    evaluationRule: string;
    noteExternalSites: string;
    externalSitesStatus: string;
    externalSitesNote: string;
    externalComparisonClassDefinitions: Record<string, string>;
    externalInterpretationRules: {
      defaultOutputGranularity: string;
      pooledStatisticsAuthorized: boolean;
      benchmarkComparable: boolean;
      interpretationNote: string;
    } | null;
    pooledStatsPolicy: {
      includedClasses: string[];
      excludedClasses: string[];
      interpretationNote: string;
    } | null;
  };
  // Site-specific fields
  comparisonType: string;
  site: string;
  interpretation: string;
  externalSites: NormalizedExternalSite[];
}

export function normalizeRiskComparison(raw: unknown): NormalizedRiskComparison {
  if (!raw || !isObj(raw)) {
    return {
      siteComparisons: [],
      summary: {
        totalWOERecords: 0,
        matchedStations: 0,
        excludedNoLOO: 0,
        excludedNoWOE: 0,
        sitesWithWOE: 0,
        sitesWithoutWOE: 0,
        sitesWithoutWOENames: [],
      },
      mappingTable: { source: '', mappings: {} },
      meta: {
        governanceSpec: '',
        modelVersion: '',
        note: '',
        status: '',
        evaluationRule: '',
        noteExternalSites: '',
        externalSitesStatus: '',
        externalSitesNote: '',
        externalComparisonClassDefinitions: {},
        externalInterpretationRules: null,
        pooledStatsPolicy: null,
      },
      comparisonType: '',
      site: '',
      interpretation: '',
      externalSites: [],
    };
  }

  let siteComparisons: NormalizedSiteComparison[];

  if (Array.isArray(raw.siteComparisons)) {
    // General pack shape
    siteComparisons = raw.siteComparisons.map((item: unknown) => {
      const sc = isObj(item) ? item : {} as RawObject;
      const excl = isObj(sc.excludedStations) ? sc.excludedStations : {} as RawObject;
      return {
        siteId: (sc.siteId as number) ?? 0,
        siteName: (sc.siteName as string) ?? '',
        registryId: (sc.registryId as string) ?? '',
        stationComparisons: asArray(sc.stationComparisons).map(normalizeStationComparison),
        excludedStations: {
          noLOOPrediction: (excl.noLOOPrediction as string[]) ?? [],
          noWOERecord: (excl.noWOERecord as string[]) ?? [],
        },
      };
    });
  } else if (Array.isArray(raw.station_comparisons)) {
    // Site pack shape: station_comparisons at top level
    const rcMeta = isObj(raw._meta) ? raw._meta : {} as RawObject;
    siteComparisons = [{
      siteId: 0,
      siteName: (raw.site as string) ?? '',
      registryId: (rcMeta.site_registry_id as string) ?? '',
      stationComparisons: (raw.station_comparisons as unknown[]).map((item: unknown) => {
        const sc = isObj(item) ? item : {} as RawObject;
        return {
          stationId: (sc.station_id as number) ?? 0,
          stationName: (sc.station_name as string) ?? '',
          bnrrmPredicted: (sc.site_model_map as string) ?? null,
          bnrrmObserved: (sc.observed_risk as string) ?? null,
          predictionRule: null,
          comparisonClass: null,
          evaluationView: null,
          statisticalAuthorization: null,
          reportEstimate: {
            originalLabel: (sc.general_model_map as string) ?? '',
            mappedBNClass: (sc.general_model_map as string) ?? null,
            mappingConfidence: '',
            mappingJustification: '',
            comparatorType: (raw.comparison_type as string) ?? 'general_vs_site_risk',
            frameworkType: '',
            provenance: { sourceDocument: '', sourcePage: null },
          },
        };
      }),
      excludedStations: { noLOOPrediction: [], noWOERecord: [] },
    }];
  } else {
    siteComparisons = [];
  }

  const rawSummary = isObj(raw.summary) ? raw.summary : null;
  const summary: RawObject = rawSummary ?? {
    matchedStations: siteComparisons.reduce((sum, sc) => sum + sc.stationComparisons.length, 0),
    excludedNoLOO: 0,
    excludedNoWOE: 0,
    sitesWithWOE: 0,
    sitesWithoutWOE: 0,
    sitesWithoutWOENames: [] as string[],
  };

  const externalSites = Array.isArray(raw.externalSites)
    ? raw.externalSites.map((item: unknown) => normalizeExternalSite(item))
    : [];

  const riskMeta = isObj(raw._meta) ? raw._meta : {} as RawObject;
  const extIntRules = isObj(riskMeta.externalInterpretationRules) ? riskMeta.externalInterpretationRules : null;
  const pooledPolicy = isObj(riskMeta.pooledStatsPolicy) ? riskMeta.pooledStatsPolicy : null;

  return {
    siteComparisons,
    summary: {
      totalWOERecords: (summary.totalWOERecords as number) ?? 0,
      matchedStations: (summary.matchedStations as number) ?? 0,
      excludedNoLOO: (summary.excludedNoLOO as number) ?? 0,
      excludedNoWOE: (summary.excludedNoWOE as number) ?? 0,
      sitesWithWOE: (summary.sitesWithWOE as number) ?? 0,
      sitesWithoutWOE: (summary.sitesWithoutWOE as number) ?? 0,
      sitesWithoutWOENames: (summary.sitesWithoutWOENames as string[]) ?? [],
    },
    mappingTable: (raw.mappingTable as NormalizedRiskComparison['mappingTable']) ?? { source: '', mappings: {} },
    meta: {
      governanceSpec: (riskMeta.governanceSpec as string) ?? '',
      modelVersion: (riskMeta.modelVersion as string) ?? (riskMeta.model_version as string) ?? '',
      note: (riskMeta.note as string) ?? '',
      status: (riskMeta.status as string) ?? '',
      evaluationRule: (riskMeta.evaluationRule as string) ?? '',
      noteExternalSites: (riskMeta.note_externalSites as string) ?? '',
      externalSitesStatus: (riskMeta.externalSitesStatus as string) ?? '',
      externalSitesNote: (riskMeta.externalSitesNote as string) ?? '',
      externalComparisonClassDefinitions: (riskMeta.externalComparisonClassDefinitions as Record<string, string>) ?? {},
      externalInterpretationRules: extIntRules
        ? {
            defaultOutputGranularity: (extIntRules.defaultOutputGranularity as string) ?? '',
            pooledStatisticsAuthorized: (extIntRules.pooledStatisticsAuthorized as boolean) ?? false,
            benchmarkComparable: (extIntRules.benchmarkComparable as boolean) ?? false,
            interpretationNote: (extIntRules.interpretationNote as string) ?? '',
          }
        : null,
      pooledStatsPolicy: pooledPolicy
        ? {
            includedClasses: (pooledPolicy.included_classes as string[]) ?? [],
            excludedClasses: (pooledPolicy.excluded_classes as string[]) ?? [],
            interpretationNote: (pooledPolicy.interpretation_note as string) ?? '',
          }
        : null,
    },
    comparisonType: (raw.comparison_type as string) ?? '',
    site: (raw.site as string) ?? '',
    interpretation: (raw.interpretation as string) ?? '',
    externalSites,
  };
}

function normalizeExternalSite(raw: unknown): NormalizedExternalSite {
  const site = isObj(raw) ? raw : {} as RawObject;
  const modStatus = isObj(site.modifierEffectsStatus) ? site.modifierEffectsStatus : null;
  const inputCov = isObj(site.bnInputCoverage) ? site.bnInputCoverage : {} as RawObject;
  const assembly = isObj(site.bnInputAssembly) ? site.bnInputAssembly : null;
  const spatialUnit = assembly && isObj(assembly.authorizedSpatialUnit) ? assembly.authorizedSpatialUnit : null;
  const runRec = isObj(site.bnRunRecord) ? site.bnRunRecord : null;
  const postSum = runRec && isObj(runRec.posteriorSummary) ? runRec.posteriorSummary : null;
  const statAuth = isObj(site.statisticalAuthorization) ? site.statisticalAuthorization : {} as RawObject;

  return {
    siteId: (site.siteId as string) ?? '',
    siteName: (site.siteName as string) ?? '',
    registryId: (site.registryId as string) ?? '',
    region: (site.region as string) ?? '',
    waterbody: (site.waterbody as string) ?? '',
    gateOutcome: (site.gateOutcome as string) ?? '',
    gateReason: (site.gateReason as string) ?? '',
    consultant: (site.consultant as string) ?? '',
    reportDate: (site.reportDate as string) ?? '',
    reportTitle: (site.reportTitle as string) ?? '',
    comparisonType: (site.comparisonType as string) ?? '',
    bnInferenceStatus: (site.bnInferenceStatus as string) ?? '',
    externalComparisonClass: (site.externalComparisonClass as string) ?? '',
    outputGranularity: (site.outputGranularity as string) ?? '',
    interpretationAuthorization: (site.interpretationAuthorization as string) ?? '',
    contaminantOverlap: (site.contaminantOverlap as string) ?? '',
    modifierEffectsStatus: modStatus
      ? {
          modifiers: (modStatus.modifiers as string) ?? '',
          effectsEvidence: (modStatus.effectsEvidence as string) ?? '',
        }
      : null,
    uncertaintyFlags: Array.isArray(site.uncertaintyFlags) ? site.uncertaintyFlags as string[] : [],
    uncertaintyNote: (site.uncertaintyNote as string) ?? '',
    bnInputCoverage: {
      metals: (inputCov.metals as boolean) ?? false,
      pahs: (inputCov.pahs as boolean) ?? false,
      pcbs: (inputCov.pcbs as boolean) ?? false,
      toc: (inputCov.toc as boolean) ?? false,
      grainSize: (inputCov.grainSize as boolean) ?? false,
      sulfideBinding: (inputCov.sulfideBinding as boolean) ?? false,
      toxicity: (inputCov.toxicity as boolean) ?? false,
      community: (inputCov.community as boolean) ?? false,
      note: (inputCov.note as string) ?? '',
    },
    pooledStatsEligible: (site.pooledStatsEligible as boolean) ?? false,
    benchmarkComparable: (site.benchmarkComparable as boolean) ?? false,
    bnInputAssembly: assembly
      ? {
          assemblySpecVersion: (assembly.assemblySpecVersion as string) ?? '',
          authorizedSpatialUnit: spatialUnit
            ? {
                type: (spatialUnit.type as string) ?? '',
                id: (spatialUnit.id as string) ?? '',
                basis: (spatialUnit.basis as string) ?? '',
              }
            : null,
        }
      : null,
    bnRunRecord: runRec
      ? {
          runMethod: (runRec.runMethod as string) ?? '',
          evidenceSourceSummary: (runRec.evidenceSourceSummary as string) ?? '',
          encodingBasis: (runRec.encodingBasis as string) ?? '',
          runDate: (runRec.runDate as string) ?? '',
          limitations: Array.isArray(runRec.limitations) ? runRec.limitations as string[] : [],
          evidenceMode: (runRec.evidenceMode as string) ?? '',
          modelPackId: (runRec.modelPackId as string) ?? '',
          modelVersion: (runRec.modelVersion as string) ?? '',
          posteriorSummary: postSum
            ? {
                low: (postSum.low as number) ?? 0,
                moderate: (postSum.moderate as number) ?? 0,
                high: (postSum.high as number) ?? 0,
                map: (postSum.map as string) ?? '',
              }
            : null,
        }
      : null,
    reportConclusions: asArray(site.reportConclusions)
      .map((item: unknown) => {
        const conclusion = isObj(item) ? item : {} as RawObject;
        const prov = isObj(conclusion.provenance) ? conclusion.provenance : {} as RawObject;
        return {
          receptor: (conclusion.receptor as string) ?? '',
          loeCount: (conclusion.loeCount as number) ?? 0,
          loes: Array.isArray(conclusion.loes) ? conclusion.loes as string[] : [],
          woeConclusion: (conclusion.woeConclusion as string) ?? '',
          woeIntegrationNote: (conclusion.woeIntegrationNote as string) ?? '',
          mappedBNClass: (conclusion.mappedBNClass as string) ?? null,
          mappingConfidence: (conclusion.mappingConfidence as string) ?? '',
          mappingJustification: (conclusion.mappingJustification as string) ?? '',
          comparisonLevel: (conclusion.comparisonLevel as string) ?? '',
          provenance: {
            sourceDocument: (prov.sourceDocument as string) ?? '',
            sourcePage: (prov.sourcePage as number) ?? null,
            sourceTableFigure: (prov.sourceTableFigure as string) ?? '',
            extractedLabel: (prov.extractedLabel as string) ?? '',
            extractionMethod: (prov.extractionMethod as string) ?? '',
            extractionDate: (prov.extractionDate as string) ?? '',
            extractor: (prov.extractor as string) ?? '',
          },
          isTrainingTarget: (conclusion.isTrainingTarget as boolean) ?? false,
        };
      }),
    toxicityStations: asArray(site.toxicityStations)
      .map((item: unknown) => {
        const station = isObj(item) ? item : {} as RawObject;
        return {
          stationId: (station.stationId as string) ?? '',
          amphipodSurvival: (station.amphipodSurvival as number) ?? 0,
          polychaeteSurvival: (station.polychaeteSurvival as number) ?? 0,
          polychaeteGrowth: (station.polychaeteGrowth as number) ?? 0,
          bivalveDev: (station.bivalveDev as number) ?? 0,
        };
      }),
    statisticalAuthorization: {
      kappa: (statAuth.kappa as boolean) ?? false,
      confusionMatrix: (statAuth.confusionMatrix as boolean) ?? false,
      agreement: (statAuth.agreement as boolean) ?? false,
      mcNemar: (statAuth.mcNemar as boolean) ?? false,
      reason: (statAuth.reason as string) ?? '',
    },
  };
}

function normalizeStationComparison(raw: unknown): NormalizedStationComparison {
  const sc = isObj(raw) ? raw : {} as RawObject;
  const re = isObj(sc.reportEstimate) ? sc.reportEstimate : {} as RawObject;
  const prov = isObj(re.provenance) ? re.provenance : {} as RawObject;
  return {
    stationId: (sc.stationId as number) ?? 0,
    stationName: (sc.stationName as string) ?? '',
    bnrrmPredicted: (sc.bnrrmPredicted as string) ?? null,
    bnrrmObserved: (sc.bnrrmObserved as string) ?? null,
    predictionRule: (sc.prediction_rule as string) ?? (sc.predictionRule as string) ?? null,
    comparisonClass: (sc.comparison_class as string) ?? (sc.comparisonClass as string) ?? null,
    evaluationView: (sc.evaluation_view as string) ?? (sc.evaluationView as string) ?? null,
    statisticalAuthorization: (sc.statistical_authorization as string) ?? (sc.statisticalAuthorization as string) ?? null,
    reportEstimate: {
      originalLabel: (re.originalLabel as string) ?? '',
      mappedBNClass: (re.mappedBNClass as string) ?? null,
      mappingConfidence: (re.mappingConfidence as string) ?? '',
      mappingJustification: (re.mappingJustification as string) ?? '',
      comparatorType: (re.comparatorType as string) ?? '',
      frameworkType: (re.frameworkType as string) ?? '',
      provenance: {
        sourceDocument: (prov.sourceDocument as string) ?? '',
        sourcePage: (prov.sourcePage as number) ?? null,
      },
    },
  };
}
