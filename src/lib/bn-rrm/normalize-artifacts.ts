/**
 * BN-RRM Artifact Normalizers
 *
 * Each function takes raw JSON from a pack artifact (general OR site-specific)
 * and returns a stable typed object with safe defaults. Components consume ONLY
 * the normalized shape - all raw-shape detection lives here.
 */

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
    dataset_counts: Record<string, any> | null;
    site_name: string;
    registry_id: string;
    waterbody: string;
    n_stations: number | null;
    stations: Array<{ station_id: number; name: string; type: string }>;
    site_breakdown: any[];
  };
  architecture: { tiers: any[] } | null;
  intended_use: { primary: string; not_suitable_for: string[] } | null;
  limitations: string[];
  anti_overclaim: string;
  marginal_highlights: Array<{ node: string; states: Record<string, number> }>;
  publication_baseline: any | null;
}

export function normalizeModelOverview(raw: any): NormalizedModelOverview {
  if (!raw) {
    return emptyModelOverview();
  }

  const meta = raw._meta ?? {};
  // General: performance; Site: diagnostic
  const perf = raw.performance ?? raw.diagnostic ?? {};
  const data = raw.training_data ?? {};
  const datasetCounts = data.dataset_counts ?? data.record_counts ?? null;

  return {
    meta: {
      dataset_status: meta.dataset_status ?? '',
      export_date: meta.export_date ?? '',
      db_hash: meta.db_hash ?? '',
      model_version: meta.model_version ?? '',
      handoff_version: meta.handoff_version ?? '',
      scope: meta.scope ?? 'general',
      site_registry_id: meta.site_registry_id ?? '',
    },
    identity: {
      name: raw.model_identity?.name ?? '',
      framework: raw.model_identity?.framework ?? '',
      nodes: raw.model_identity?.nodes ?? 0,
      edges: raw.model_identity?.edges ?? 0,
      states_per_node: raw.model_identity?.states_per_node ?? 0,
      parent_model: raw.model_identity?.parent_model ?? '',
    },
    performance: {
      type: raw.diagnostic?.type ?? 'loo_cross_validation',
      accuracy: perf.loo_accuracy ?? perf.accuracy ?? null,
      kappa: perf.loo_kappa ?? perf.kappa ?? null,
      n_complete: perf.n_complete ?? perf.n_eligible ?? null,
      disclaimer: perf.disclaimer ?? '',
      per_class: perf.per_class ?? null,
      kappa_interpretation: perf.kappa_interpretation
        ? {
            scale: perf.kappa_interpretation.scale ?? [],
            narrative: perf.kappa_interpretation.narrative ?? '',
          }
        : null,
      performance_plateau: perf.performance_plateau
        ? {
            previous_n: perf.performance_plateau.previous_n ?? 0,
            current_n: perf.performance_plateau.current_n ?? 0,
            interpretation: perf.performance_plateau.interpretation ?? '',
          }
        : null,
    },
    training: {
      total_sites: data.total_sites ?? datasetCounts?.sites ?? null,
      dataset_counts: datasetCounts,
      site_name: data.site ?? '',
      registry_id: data.registry_id ?? '',
      waterbody: data.waterbody ?? '',
      n_stations: data.n_stations ?? datasetCounts?.stations ?? null,
      stations: Array.isArray(data.stations)
        ? data.stations.map((station: any) => ({
            station_id: station.station_id ?? 0,
            name: station.name ?? '',
            type: station.type ?? '',
          }))
        : [],
      site_breakdown: Array.isArray(data.site_breakdown) ? data.site_breakdown : [],
    },
    architecture: raw.architecture?.tiers ? { tiers: raw.architecture.tiers } : null,
    intended_use: raw.intended_use
      ? {
          primary: raw.intended_use.primary ?? '',
          not_suitable_for: raw.intended_use.not_suitable_for ?? [],
        }
      : null,
    limitations: raw.limitations ?? raw.applicability_boundaries ?? [],
    anti_overclaim: raw.anti_overclaim ?? '',
    marginal_highlights: Object.entries(raw.marginal_highlights ?? {}).map(([node, states]) => ({
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

export function normalizeValidation(raw: any): NormalizedValidation {
  if (!raw) {
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
  const predictions: NormalizedPrediction[] = Array.isArray(rawPredictions)
    ? rawPredictions.map((p: any) => ({
        station_id: p.station_id ?? 0,
        station_name: p.station_name ?? '',
        predicted: p.predicted ?? '',
        observed: p.observed ?? '',
        ...(p.posterior ? { posterior: p.posterior } : {}),
      }))
    : [];

  return {
    n_complete: raw.n_complete ?? predictions.length,
    accuracy: raw.loo_accuracy ?? raw.accuracy ?? null,
    kappa: raw.loo_kappa ?? raw.kappa ?? null,
    predictions,
    per_class: raw.per_class ?? null,
    disclaimer: raw.disclaimer ?? '',
    status: raw.status ?? '',
    semanticScope: raw.semantic_scope ?? '',
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

export function normalizeDecisions(raw: any): NormalizedDecisions {
  if (!raw) {
    return {
      decision_records: [],
      known_limitations: [],
      issue_summary: null,
      spec_versions: {},
      applicability_boundaries: [],
      meta: { export_date: '', source_docs: [] },
    };
  }

  const decisions: NormalizedDecisionRecord[] = (raw.decision_records ?? []).map((d: any) => ({
    id: d.id ?? '',
    title: d.title ?? '',
    status: d.status ?? '',
    date: d.date ?? '',
    severity: d.severity ?? 'MEDIUM',
    summary: d.summary ?? '',
    rationale: d.rationale ?? '',
    impact: d.impact ?? '',
    reopen_criteria: d.reopen_criteria ?? '',
    related_issues: d.related_issues ?? [],
  }));

  const limitations: NormalizedLimitation[] = (raw.known_limitations ?? []).map((l: any) => ({
    id: l.id ?? '',
    title: l.title ?? '',
    severity: l.severity ?? 'MEDIUM',
    category: l.category ?? '',
    description: l.description ?? '',
    mitigation: l.mitigation ?? '',
    related: l.related ?? '',
  }));

  const issueSummary = raw.issue_summary
    ? {
        total_issues: raw.issue_summary.total_issues ?? 0,
        fixed: raw.issue_summary.fixed ?? 0,
        active_limitations: raw.issue_summary.active_limitations ?? 0,
        accepted: raw.issue_summary.accepted ?? 0,
        note: raw.issue_summary.note ?? '',
      }
    : null;

  return {
    decision_records: decisions,
    known_limitations: limitations,
    issue_summary: issueSummary,
    spec_versions: raw.spec_versions ?? {},
    applicability_boundaries: raw.applicability_boundaries ?? [],
    meta: {
      export_date: raw._meta?.export_date ?? '',
      source_docs: raw._meta?.source_docs ?? [],
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

export function normalizeCptTransparency(raw: any): NormalizedCptTransparency {
  if (!raw) {
    return { nodes: [], tier_summary: [], dr001_callout: null, expert_dominance_disclosure: '', meta: { export_date: '', db_hash: '' } };
  }

  const nodes: NormalizedCptNode[] = (raw.nodes ?? []).map((n: any) => ({
    // General pack fields
    id: n.id ?? n.node_id ?? '',
    label: n.label ?? n.node_id ?? '',
    tier: n.tier ?? 0,
    cpt_source: n.cpt_source ?? n.method ?? '',
    sample_count: n.sample_count ?? n.n_site_stations ?? 0,
    parameter: n.parameter ?? null,
    unit: n.unit ?? null,
    dr001_affected: n.dr001_affected ?? false,
    config_coverage: n.config_coverage ?? null,
    expert_distribution: n.expert_distribution ?? null,
    learned_distribution: n.learned_distribution ?? null,
    ess_prior_weight: n.ess_prior_weight ?? null,
    // Site-specific fields
    method: n.method ?? null,
    alpha: n.alpha ?? null,
    data_weight_pct: n.data_weight_pct ?? null,
    expert_weight_pct: n.expert_weight_pct ?? null,
    n_site_stations: n.n_site_stations ?? null,
    assessment: n.assessment ?? null,
  }));

  const tierSummary: NormalizedTierSummary[] = (raw.tier_summary ?? []).map((ts: any) => ({
    tier: ts.tier ?? 0,
    name: ts.name ?? '',
    node_count: ts.node_count ?? 0,
    cpt_methods: ts.cpt_methods ?? [],
  }));

  const dr001 = raw.dr001_callout
    ? {
        id: raw.dr001_callout.id ?? '',
        title: raw.dr001_callout.title ?? '',
        affected_nodes: raw.dr001_callout.affected_nodes ?? [],
        description: raw.dr001_callout.description ?? '',
        severity: raw.dr001_callout.severity ?? '',
      }
    : null;

  return {
    nodes,
    tier_summary: tierSummary,
    dr001_callout: dr001,
    expert_dominance_disclosure: raw.expert_dominance_disclosure ?? '',
    meta: {
      export_date: raw._meta?.export_date ?? '',
      db_hash: raw._meta?.db_hash ?? '',
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

export function normalizeProvenance(raw: any): NormalizedProvenance {
  if (!raw) {
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
  const documents: NormalizedDocument[] = (raw.documents ?? raw.source_documents ?? []).map((d: any) => ({
    doc_id: d.doc_id ?? 0,
    site_id: d.site_id ?? 0,
    filename: d.filename ?? null,
    title: d.title ?? '',
    author: d.author ?? '',
    date: d.date ?? '',
    type: d.type ?? '',
    pages: d.pages ?? null,
  }));

  const stations: NormalizedStation[] = (raw.stations ?? []).map((s: any) => ({
    station_id: s.station_id ?? 0,
    station_name: s.station_name ?? '',
    site_name: s.site_name ?? '',
    registry_id: s.registry_id ?? '',
    waterbody_type: s.waterbody_type ?? '',
    data_counts: {
      chemistry: s.data_counts?.chemistry ?? 0,
      toxicity: s.data_counts?.toxicity ?? 0,
      community: s.data_counts?.community ?? 0,
    },
    co_location: s.co_location ?? '',
    provenance_quality: s.provenance_quality ?? 'no_data',
    provenance_coverage: s.provenance_coverage ?? null,
    provenance_records: (s.provenance_records ?? []).map((pr: any) => ({
      target_table: pr.target_table ?? '',
      page_number: pr.page_number ?? null,
      table_number: pr.table_number ?? null,
      figure_number: pr.figure_number ?? null,
      extraction_method: pr.extraction_method ?? null,
      confidence: pr.confidence ?? null,
      reviewer_verified: pr.reviewer_verified ?? null,
      doc_title: pr.doc_title ?? '',
      doc_author: pr.doc_author ?? '',
      doc_type: pr.doc_type ?? '',
    })),
  }));

  const summary = raw.summary ?? {
    total_documents: documents.length,
    total_stations: stations.length,
    stations_with_provenance: 0,
    co_location_breakdown: {},
  };

  return {
    documents,
    stations,
    summary: {
      total_documents: summary.total_documents ?? documents.length,
      total_stations: summary.total_stations ?? stations.length,
      stations_with_provenance: summary.stations_with_provenance ?? 0,
      co_location_breakdown: summary.co_location_breakdown ?? {},
    },
    n_provenance_records: raw.n_provenance_records ?? 0,
    coverage: raw.coverage ?? '',
    meta: {
      export_date: raw._meta?.export_date ?? '',
      db_hash: raw._meta?.db_hash ?? '',
    },
  };
}

// Site Reports

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
  spatial_context: any | null;
  source_documents: any[] | null;
  station_details: any[] | null;
  co_location_quality: Record<string, number>;
  woe_risk_distribution: Record<string, number>;
  chemistry_summary: any[] | null;
  toxicity_summary: any[] | null;
  community_summary: { n: number; metrics: any[] } | null;
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

export function normalizeSiteReports(raw: any): NormalizedSiteReports {
  if (!raw) {
    return {
      sites: [],
      summary: { total_sites: 0, total_stations: 0, sites_with_chemistry: 0, sites_with_toxicity: 0, sites_with_community: 0 },
      meta: { export_date: '', db_hash: '' },
    };
  }

  let sites: NormalizedSite[];

  if (Array.isArray(raw.sites)) {
    // General pack shape: { sites: [...] }
    sites = raw.sites.map((s: any) => normalizeSingleSite(s));
  } else if (Array.isArray(raw.stations)) {
    // Site pack shape: { site: string, n_stations: number, stations: [...] }
    sites = [{
      site_id: 0,
      name: raw.site ?? 'Site',
      registry_id: raw._meta?.site_registry_id ?? '',
      waterbody_type: '',
      region: null,
      station_count: raw.n_stations ?? raw.stations.length,
      campaign_dates: null,
      temporal_note: null,
      spatial_context: null,
      source_documents: null,
      station_details: raw.stations,
      co_location_quality: {},
      woe_risk_distribution: {},
      chemistry_summary: null,
      toxicity_summary: null,
      community_summary: null,
    }];
  } else {
    sites = [];
  }

  const summary = raw.summary ?? {
    total_sites: sites.length,
    total_stations: sites.reduce((sum: number, s: NormalizedSite) => sum + s.station_count, 0),
    sites_with_chemistry: 0,
    sites_with_toxicity: 0,
    sites_with_community: 0,
  };

  return {
    sites,
    summary: {
      total_sites: summary.total_sites ?? sites.length,
      total_stations: summary.total_stations ?? 0,
      sites_with_chemistry: summary.sites_with_chemistry ?? 0,
      sites_with_toxicity: summary.sites_with_toxicity ?? 0,
      sites_with_community: summary.sites_with_community ?? 0,
    },
    meta: {
      export_date: raw._meta?.export_date ?? '',
      db_hash: raw._meta?.db_hash ?? '',
    },
  };
}

function normalizeSingleSite(s: any): NormalizedSite {
  return {
    site_id: s.site_id ?? 0,
    name: s.name ?? '',
    registry_id: s.registry_id ?? '',
    waterbody_type: s.waterbody_type ?? '',
    region: s.region ?? null,
    station_count: s.station_count ?? 0,
    campaign_dates: s.campaign_dates
      ? {
          earliest: s.campaign_dates.earliest ?? '',
          latest: s.campaign_dates.latest ?? '',
          n_unique_dates: s.campaign_dates.n_unique_dates ?? 0,
          n_years: s.campaign_dates.n_years ?? 0,
          cross_year: s.campaign_dates.cross_year ?? false,
        }
      : null,
    temporal_note: s.temporal_note ?? null,
    spatial_context: s.spatial_context ?? null,
    source_documents: s.source_documents ?? null,
    station_details: s.station_details ?? null,
    co_location_quality: s.co_location_quality ?? {},
    woe_risk_distribution: s.woe_risk_distribution ?? {},
    chemistry_summary: s.chemistry_summary ?? null,
    toxicity_summary: s.toxicity_summary ?? null,
    community_summary: s.community_summary ?? null,
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

export function normalizeRiskComparison(raw: any): NormalizedRiskComparison {
  if (!raw) {
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
    siteComparisons = raw.siteComparisons.map((sc: any) => ({
      siteId: sc.siteId ?? 0,
      siteName: sc.siteName ?? '',
      registryId: sc.registryId ?? '',
      stationComparisons: (sc.stationComparisons ?? []).map(normalizeStationComparison),
      excludedStations: {
        noLOOPrediction: sc.excludedStations?.noLOOPrediction ?? [],
        noWOERecord: sc.excludedStations?.noWOERecord ?? [],
      },
    }));
  } else if (Array.isArray(raw.station_comparisons)) {
    // Site pack shape: station_comparisons at top level
    siteComparisons = [{
      siteId: 0,
      siteName: raw.site ?? '',
      registryId: raw._meta?.site_registry_id ?? '',
      stationComparisons: raw.station_comparisons.map((sc: any) => ({
        stationId: sc.station_id ?? 0,
        stationName: sc.station_name ?? '',
        bnrrmPredicted: sc.site_model_map ?? null,
        bnrrmObserved: sc.observed_risk ?? null,
        reportEstimate: {
          originalLabel: sc.general_model_map ?? '',
          mappedBNClass: sc.general_model_map ?? null,
          mappingConfidence: '',
          mappingJustification: '',
          comparatorType: raw.comparison_type ?? 'general_vs_site_risk',
          frameworkType: '',
          provenance: { sourceDocument: '', sourcePage: null },
        },
      })),
      excludedStations: { noLOOPrediction: [], noWOERecord: [] },
    }];
  } else {
    siteComparisons = [];
  }

  const summary = raw.summary ?? {
    matchedStations: siteComparisons.reduce((sum, sc) => sum + sc.stationComparisons.length, 0),
    excludedNoLOO: 0,
    excludedNoWOE: 0,
    sitesWithWOE: 0,
    sitesWithoutWOE: 0,
    sitesWithoutWOENames: [],
  };

  const externalSites = Array.isArray(raw.externalSites)
    ? raw.externalSites.map(normalizeExternalSite)
    : [];

  return {
    siteComparisons,
    summary: {
      totalWOERecords: summary.totalWOERecords ?? 0,
      matchedStations: summary.matchedStations ?? 0,
      excludedNoLOO: summary.excludedNoLOO ?? 0,
      excludedNoWOE: summary.excludedNoWOE ?? 0,
      sitesWithWOE: summary.sitesWithWOE ?? 0,
      sitesWithoutWOE: summary.sitesWithoutWOE ?? 0,
      sitesWithoutWOENames: summary.sitesWithoutWOENames ?? [],
    },
    mappingTable: raw.mappingTable ?? { source: '', mappings: {} },
    meta: {
      governanceSpec: raw._meta?.governanceSpec ?? '',
      modelVersion: raw._meta?.modelVersion ?? raw._meta?.model_version ?? '',
      note: raw._meta?.note ?? '',
      status: raw._meta?.status ?? '',
      evaluationRule: raw._meta?.evaluationRule ?? '',
      noteExternalSites: raw._meta?.note_externalSites ?? '',
      externalSitesStatus: raw._meta?.externalSitesStatus ?? '',
      externalSitesNote: raw._meta?.externalSitesNote ?? '',
      externalComparisonClassDefinitions: raw._meta?.externalComparisonClassDefinitions ?? {},
      externalInterpretationRules: raw._meta?.externalInterpretationRules
        ? {
            defaultOutputGranularity: raw._meta.externalInterpretationRules.defaultOutputGranularity ?? '',
            pooledStatisticsAuthorized: raw._meta.externalInterpretationRules.pooledStatisticsAuthorized ?? false,
            benchmarkComparable: raw._meta.externalInterpretationRules.benchmarkComparable ?? false,
            interpretationNote: raw._meta.externalInterpretationRules.interpretationNote ?? '',
          }
        : null,
      pooledStatsPolicy: raw._meta?.pooledStatsPolicy
        ? {
            includedClasses: raw._meta.pooledStatsPolicy.included_classes ?? [],
            excludedClasses: raw._meta.pooledStatsPolicy.excluded_classes ?? [],
            interpretationNote: raw._meta.pooledStatsPolicy.interpretation_note ?? '',
          }
        : null,
    },
    comparisonType: raw.comparison_type ?? '',
    site: raw.site ?? '',
    interpretation: raw.interpretation ?? '',
    externalSites,
  };
}

function normalizeExternalSite(site: any): NormalizedExternalSite {
  return {
    siteId: site.siteId ?? '',
    siteName: site.siteName ?? '',
    registryId: site.registryId ?? '',
    region: site.region ?? '',
    waterbody: site.waterbody ?? '',
    gateOutcome: site.gateOutcome ?? '',
    gateReason: site.gateReason ?? '',
    consultant: site.consultant ?? '',
    reportDate: site.reportDate ?? '',
    reportTitle: site.reportTitle ?? '',
    comparisonType: site.comparisonType ?? '',
    bnInferenceStatus: site.bnInferenceStatus ?? '',
    externalComparisonClass: site.externalComparisonClass ?? '',
    outputGranularity: site.outputGranularity ?? '',
    interpretationAuthorization: site.interpretationAuthorization ?? '',
    contaminantOverlap: site.contaminantOverlap ?? '',
    modifierEffectsStatus: site.modifierEffectsStatus
      ? {
          modifiers: site.modifierEffectsStatus.modifiers ?? '',
          effectsEvidence: site.modifierEffectsStatus.effectsEvidence ?? '',
        }
      : null,
    uncertaintyFlags: Array.isArray(site.uncertaintyFlags) ? site.uncertaintyFlags : [],
    uncertaintyNote: site.uncertaintyNote ?? '',
    bnInputCoverage: {
      metals: site.bnInputCoverage?.metals ?? false,
      pahs: site.bnInputCoverage?.pahs ?? false,
      pcbs: site.bnInputCoverage?.pcbs ?? false,
      toc: site.bnInputCoverage?.toc ?? false,
      grainSize: site.bnInputCoverage?.grainSize ?? false,
      sulfideBinding: site.bnInputCoverage?.sulfideBinding ?? false,
      toxicity: site.bnInputCoverage?.toxicity ?? false,
      community: site.bnInputCoverage?.community ?? false,
      note: site.bnInputCoverage?.note ?? '',
    },
    pooledStatsEligible: site.pooledStatsEligible ?? false,
    benchmarkComparable: site.benchmarkComparable ?? false,
    bnInputAssembly: site.bnInputAssembly
      ? {
          assemblySpecVersion: site.bnInputAssembly.assemblySpecVersion ?? '',
          authorizedSpatialUnit: site.bnInputAssembly.authorizedSpatialUnit
            ? {
                type: site.bnInputAssembly.authorizedSpatialUnit.type ?? '',
                id: site.bnInputAssembly.authorizedSpatialUnit.id ?? '',
                basis: site.bnInputAssembly.authorizedSpatialUnit.basis ?? '',
              }
            : null,
        }
      : null,
    bnRunRecord: site.bnRunRecord
      ? {
          runMethod: site.bnRunRecord.runMethod ?? '',
          evidenceSourceSummary: site.bnRunRecord.evidenceSourceSummary ?? '',
          encodingBasis: site.bnRunRecord.encodingBasis ?? '',
          runDate: site.bnRunRecord.runDate ?? '',
          limitations: Array.isArray(site.bnRunRecord.limitations) ? site.bnRunRecord.limitations : [],
          evidenceMode: site.bnRunRecord.evidenceMode ?? '',
          modelPackId: site.bnRunRecord.modelPackId ?? '',
          modelVersion: site.bnRunRecord.modelVersion ?? '',
          posteriorSummary: site.bnRunRecord.posteriorSummary
            ? {
                low: site.bnRunRecord.posteriorSummary.low ?? 0,
                moderate: site.bnRunRecord.posteriorSummary.moderate ?? 0,
                high: site.bnRunRecord.posteriorSummary.high ?? 0,
                map: site.bnRunRecord.posteriorSummary.map ?? '',
              }
            : null,
        }
      : null,
    reportConclusions: Array.isArray(site.reportConclusions)
      ? site.reportConclusions.map((conclusion: any) => ({
          receptor: conclusion.receptor ?? '',
          loeCount: conclusion.loeCount ?? 0,
          loes: Array.isArray(conclusion.loes) ? conclusion.loes : [],
          woeConclusion: conclusion.woeConclusion ?? '',
          woeIntegrationNote: conclusion.woeIntegrationNote ?? '',
          mappedBNClass: conclusion.mappedBNClass ?? null,
          mappingConfidence: conclusion.mappingConfidence ?? '',
          mappingJustification: conclusion.mappingJustification ?? '',
          comparisonLevel: conclusion.comparisonLevel ?? '',
          provenance: {
            sourceDocument: conclusion.provenance?.sourceDocument ?? '',
            sourcePage: conclusion.provenance?.sourcePage ?? null,
            sourceTableFigure: conclusion.provenance?.sourceTableFigure ?? '',
            extractedLabel: conclusion.provenance?.extractedLabel ?? '',
            extractionMethod: conclusion.provenance?.extractionMethod ?? '',
            extractionDate: conclusion.provenance?.extractionDate ?? '',
            extractor: conclusion.provenance?.extractor ?? '',
          },
          isTrainingTarget: conclusion.isTrainingTarget ?? false,
        }))
      : [],
    toxicityStations: Array.isArray(site.toxicityStations)
      ? site.toxicityStations.map((station: any) => ({
          stationId: station.stationId ?? '',
          amphipodSurvival: station.amphipodSurvival ?? 0,
          polychaeteSurvival: station.polychaeteSurvival ?? 0,
          polychaeteGrowth: station.polychaeteGrowth ?? 0,
          bivalveDev: station.bivalveDev ?? 0,
        }))
      : [],
    statisticalAuthorization: {
      kappa: site.statisticalAuthorization?.kappa ?? false,
      confusionMatrix: site.statisticalAuthorization?.confusionMatrix ?? false,
      agreement: site.statisticalAuthorization?.agreement ?? false,
      mcNemar: site.statisticalAuthorization?.mcNemar ?? false,
      reason: site.statisticalAuthorization?.reason ?? '',
    },
  };
}

function normalizeStationComparison(sc: any): NormalizedStationComparison {
  return {
    stationId: sc.stationId ?? 0,
    stationName: sc.stationName ?? '',
    bnrrmPredicted: sc.bnrrmPredicted ?? null,
    bnrrmObserved: sc.bnrrmObserved ?? null,
    predictionRule: sc.prediction_rule ?? sc.predictionRule ?? null,
    comparisonClass: sc.comparison_class ?? sc.comparisonClass ?? null,
    evaluationView: sc.evaluation_view ?? sc.evaluationView ?? null,
    statisticalAuthorization: sc.statistical_authorization ?? sc.statisticalAuthorization ?? null,
    reportEstimate: {
      originalLabel: sc.reportEstimate?.originalLabel ?? '',
      mappedBNClass: sc.reportEstimate?.mappedBNClass ?? null,
      mappingConfidence: sc.reportEstimate?.mappingConfidence ?? '',
      mappingJustification: sc.reportEstimate?.mappingJustification ?? '',
      comparatorType: sc.reportEstimate?.comparatorType ?? '',
      frameworkType: sc.reportEstimate?.frameworkType ?? '',
      provenance: {
        sourceDocument: sc.reportEstimate?.provenance?.sourceDocument ?? '',
        sourcePage: sc.reportEstimate?.provenance?.sourcePage ?? null,
      },
    },
  };
}
