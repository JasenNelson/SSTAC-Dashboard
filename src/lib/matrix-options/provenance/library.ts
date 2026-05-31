import { SUBSTANCE_LIBRARY } from '../substanceLibrary';
import {
  assessSlotUnitConsistency,
  type SlotUnitConsistency,
} from '../unitNormalization';
import {
  EQUATION_RECORDS,
  PARAMETER_VALUE_RECORDS,
  SOURCE_LEAD_SETS,
  SOURCE_RECORDS,
  getEquationRecord,
  getSourceRecord,
} from './catalog';
import type {
  CatalogPathway,
  EquationRecord,
  EvidenceSupportStatus,
  EvidenceLibraryFilterRequest,
  EvidenceLibraryFilters,
  ParameterValueRecord,
  ProvenancePathway,
  CalculatorSourceRole,
  CanonicalSourceStatus,
  SourceAuthorityTier,
  SourceCurrentnessStatus,
  SourceRelationship,
  SourceRelationshipRole,
  SourceRecord,
} from './types';
import { isProvenancePathway } from './pathways';

export interface EvidenceLibraryValueRow {
  record: ParameterValueRecord;
  substanceLabel: string;
  sources: SourceRecord[];
  equations: EquationRecord[];
  sourceRelationships: SourceRelationship[];
  receptorGroups: string[];
  populationGroups: string[];
  speciesGroups: string[];
  assumptionTags: string[];
}

export interface EvidenceLibraryEquationRow {
  record: EquationRecord;
  sources: SourceRecord[];
  sourceRelationships: SourceRelationship[];
  receptorGroups: string[];
  populationGroups: string[];
  speciesGroups: string[];
  assumptionTags: string[];
}

export interface EvidenceLibrarySourceRow {
  record: SourceRecord;
  linkedValueCount: number;
  linkedEquationCount: number;
}

export interface EvidenceLibraryFacetOption {
  value: string;
  label: string;
  count: number;
}

export interface EvidenceLibraryFacetOptions {
  pathways: EvidenceLibraryFacetOption[];
  substances: EvidenceLibraryFacetOption[];
  inputKeys: EvidenceLibraryFacetOption[];
  qaStatuses: EvidenceLibraryFacetOption[];
  defaultStatuses: EvidenceLibraryFacetOption[];
  evidenceSupportStatuses: EvidenceLibraryFacetOption[];
  extractionStatuses: EvidenceLibraryFacetOption[];
  jurisdictions: EvidenceLibraryFacetOption[];
  authorityScopes: EvidenceLibraryFacetOption[];
  sourceAuthorityTiers: EvidenceLibraryFacetOption[];
  sourceRoles: EvidenceLibraryFacetOption[];
  canonicalSourceStatuses: EvidenceLibraryFacetOption[];
  bcProtocolAlignments: EvidenceLibraryFacetOption[];
  currentnessStatuses: EvidenceLibraryFacetOption[];
  zoteroStatuses: EvidenceLibraryFacetOption[];
  receptorGroups: EvidenceLibraryFacetOption[];
  populationGroups: EvidenceLibraryFacetOption[];
  speciesGroups: EvidenceLibraryFacetOption[];
}

export interface EvidenceLibrarySourceLeadSummary {
  leadSetId: string;
  label: string;
  status: string;
  rule: string | null;
  primarySourceId: string | null;
  primarySourceRole: CalculatorSourceRole | null;
  counts: {
    equationLeads: number;
    parameterValueLeads: number;
    canonicalSourceLeads: number;
    documentLeads: number;
    hubPages: number;
  };
  nextActions: string[];
}

export interface EvidenceLibraryProtocol28ReviewSummary {
  candidateValueCount: number;
  blockedCandidateCount: number;
  currentDefaultCount: number;
  sourceLeadSetCount: number;
  nextActions: string[];
  canDriveCalculatorDefaults: false;
}

export interface EvidenceLibraryValueGroup {
  groupId: string;
  // Catalog grouping spans calculator pathways and evidence categories, so this is the
  // wider CatalogPathway. It is rendered (humanizeCatalogLabel) and used as a string key,
  // never passed into a calculator-only API without an isProvenancePathway() guard.
  pathway: CatalogPathway;
  substanceKey: string;
  substanceLabel: string;
  inputKey: string;
  // A source-agnostic candidate group can span multiple source jurisdictions, so this is
  // the de-duplicated set of all jurisdictions present in the group's records (not just
  // the first record's). Rendered as a joined label.
  jurisdictions: string[];
  records: EvidenceLibraryValueRow[];
  currentDefault: EvidenceLibraryValueRow | null;
  evidenceSupportStatuses: EvidenceSupportStatus[];
  qaStatuses: string[];
  sourceRelationships: SourceRelationship[];
  // A1 unit guard (canonical-mapping proposal Section D / verifier check 12). A source-agnostic
  // group can hold values in different units 1000x apart (e.g. inhalation_rfc in mg/m3 AND
  // ug/m3). comparable=false means a consumer MUST NOT run a most-stringent / min / max across
  // this group. Computed from the group's rows; never mutates the catalog. AI surfaces; HITL
  // selects (the calculator default recommendation has its own A1 guard in defaultSelectionPolicy).
  unitConsistency: SlotUnitConsistency;
  relatedSourceLeads: EvidenceLibrarySourceLeadSummary[];
}

export interface EvidenceLibraryAudit {
  values: {
    total: number;
    approvedSourceBacked: number;
    pendingSourceLocator: number;
    currentCalculatorScaffold: number;
    referenceMiningLead: number;
    currentDefaults: number;
    availableOptions: number;
    notDefaults: number;
  };
  equations: {
    total: number;
    pendingReview: number;
    approvedSourceBacked: number;
    pendingSourceLocator: number;
    currentCalculatorScaffold: number;
  };
  sources: {
    total: number;
    zoteroLinked: number;
    zoteroPending: number;
    referenceMining: number;
    policyCompilations: number;
    implementationScaffold: number;
  };
  sourceLeads: {
    leadSets: number;
    equationLeads: number;
    parameterValueLeads: number;
    canonicalSourceLeads: number;
    documentLeads: number;
  };
}

export interface EvidenceLibraryView {
  values: EvidenceLibraryValueRow[];
  valueGroups: EvidenceLibraryValueGroup[];
  equations: EvidenceLibraryEquationRow[];
  sources: EvidenceLibrarySourceRow[];
  sourceLeads: EvidenceLibrarySourceLeadSummary[];
  facets: EvidenceLibraryFacetOptions;
  audit: EvidenceLibraryAudit;
  totalCounts: {
    values: number;
    equations: number;
    sources: number;
    sourceLeads: number;
  };
}

export interface EvidenceReviewDisposition {
  label: string;
  detail: string;
  blocksCalculatorDefault: boolean;
  tone: 'approved' | 'blocked' | 'derived' | 'scaffold';
}

export const PROTOCOL28_POLICY_ALIGNMENT =
  'protocol_28_v3_0_policy_compilation';
const PROTOCOL28_SOURCE_ID = 'src-bc-protocol-28-v3-0-2024';
// Jan-2021 revision source added 2026-05-31 (d0c00003 HH-soil TRVs).
const PROTOCOL28_JAN2021_ALIGNMENT = 'protocol_28_crystallized_bc_policy_trv';
const PROTOCOL28_JAN2021_SOURCE_ID = 'src-bc-protocol-28-2021-jan';

const EMPTY_FILTERS: EvidenceLibraryFilters = {
  search: '',
  pathways: [],
  substanceKeys: [],
  inputKeys: [],
  qaStatuses: [],
  defaultStatuses: [],
  evidenceSupportStatuses: [],
  extractionStatuses: [],
  jurisdictions: [],
  authorityScopes: [],
  sourceAuthorityTiers: [],
  sourceRoles: [],
  canonicalSourceStatuses: [],
  bcProtocolAlignments: [],
  currentnessStatuses: [],
  zoteroStatuses: [],
  receptorGroups: [],
  populationGroups: [],
  speciesGroups: [],
  sourceIds: [],
  parameterValueIds: [],
  candidateGroupIds: [],
  equationIds: [],
};

const substanceLabels = new Map<string, string>(
  SUBSTANCE_LIBRARY.map((substance) => [
    substance.key,
    substance.displayName,
  ]),
);

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function arrayIncludesSelected<T extends string>(
  selected: readonly T[],
  value: T | string,
): boolean {
  return selected.length === 0 || selected.includes(value as T);
}

function arrayIntersectsSelected(
  selected: readonly string[],
  values: readonly string[],
): boolean {
  return selected.length === 0 || values.some((value) => selected.includes(value));
}

function compact<T>(items: Array<T | undefined>): T[] {
  return items.filter((item): item is T => item !== undefined);
}

function uniqueArray<T extends string>(items: T[]): T[] {
  return Array.from(new Set(items.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function sourceRelationshipRole(source: SourceRecord): SourceRelationshipRole {
  if (
    source.file_storage === 'repo_metadata_only' ||
    source.calculator_source_role === 'implementation_scaffold'
  ) {
    return 'implementation_scaffold';
  }
  if (source.calculator_source_role === 'reference_mining') {
    return 'reference_mining';
  }
  if (source.calculator_source_role === 'policy_compilation') {
    return 'policy_compilation';
  }
  return 'canonical_candidate';
}

function buildSourceRelationships(sourceIds: string[]): SourceRelationship[] {
  return sourceIds.map((sourceId) => {
    const source = getSourceRecord(sourceId);
    return {
      source_id: sourceId,
      role: source ? sourceRelationshipRole(source) : 'canonical_candidate',
      note: source?.notes ?? null,
    };
  });
}

function recordSourceRelationships(record: {
  source_ids: string[];
  source_relationships?: SourceRelationship[];
}): SourceRelationship[] {
  return record.source_relationships ?? buildSourceRelationships(record.source_ids);
}

function searchText(parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((part): part is string | number => part !== null && part !== undefined)
    .join(' ')
    .toLowerCase();
}

function matchesSearch(haystack: string, needle: string): boolean {
  return needle.trim() === '' || haystack.includes(needle.trim().toLowerCase());
}

function valueRow(record: ParameterValueRecord): EvidenceLibraryValueRow {
  return {
    record,
    substanceLabel:
      substanceLabels.get(record.substance_key) ?? record.substance_key,
    sources: compact(record.source_ids.map((sourceId) => getSourceRecord(sourceId))),
    equations: compact(
      record.equation_ids.map((equationId) => getEquationRecord(equationId)),
    ),
    sourceRelationships: recordSourceRelationships(record),
    receptorGroups: record.receptor_groups ?? [],
    populationGroups: record.population_groups ?? [],
    speciesGroups: record.species_groups ?? [],
    assumptionTags: record.assumption_tags ?? [],
  };
}

function equationRow(record: EquationRecord): EvidenceLibraryEquationRow {
  return {
    record,
    sources: compact(record.source_ids.map((sourceId) => getSourceRecord(sourceId))),
    sourceRelationships: recordSourceRelationships(record),
    receptorGroups: record.receptor_groups ?? [],
    populationGroups: record.population_groups ?? [],
    speciesGroups: record.species_groups ?? [],
    assumptionTags: record.assumption_tags ?? [],
  };
}

function sourceRow(record: SourceRecord): EvidenceLibrarySourceRow {
  const linkedValues = linkedParameterRecordsForSource(record.source_id);
  const linkedEquations = linkedEquationRecordsForSource(record.source_id);

  return {
    record,
    linkedValueCount: linkedValues.length,
    linkedEquationCount: linkedEquations.length,
  };
}

export function isEvidenceSource(source: SourceRecord): boolean {
  return source.file_storage !== 'repo_metadata_only';
}

export function isCalculatorEvidenceSource(source: SourceRecord): boolean {
  return (
    isEvidenceSource(source) &&
    source.calculator_source_role !== 'reference_mining' &&
    source.calculator_source_role !== 'policy_compilation'
  );
}

function sourceRolesForRecord(source: SourceRecord): CalculatorSourceRole[] {
  return [source.calculator_source_role ?? 'canonical_candidate'];
}

function sourceAuthorityTiersForSources(
  sources: SourceRecord[],
): SourceAuthorityTier[] {
  return uniqueArray(
    sources
      .map((source) => source.source_authority_tier)
      .filter((tier): tier is SourceAuthorityTier => Boolean(tier)),
  );
}

function canonicalStatusesForRecord(
  record: SourceRecord | ParameterValueRecord | EquationRecord,
): CanonicalSourceStatus[] {
  const statuses: CanonicalSourceStatus[] = [];
  if ('canonical_source_status' in record && record.canonical_source_status) {
    statuses.push(record.canonical_source_status);
  }
  return uniqueArray(statuses);
}

function linkedParameterRecordsForSource(sourceId: string): ParameterValueRecord[] {
  return PARAMETER_VALUE_RECORDS.filter((value) =>
    value.source_ids.includes(sourceId),
  );
}

function linkedEquationRecordsForSource(sourceId: string): EquationRecord[] {
  return EQUATION_RECORDS.filter((equation) =>
    equation.source_ids.includes(sourceId),
  );
}

function linkedParameterRecordsForEquation(equationId: string): ParameterValueRecord[] {
  return PARAMETER_VALUE_RECORDS.filter((value) =>
    value.equation_ids.includes(equationId),
  );
}

function sourceMatchesCurrentness(
  sources: SourceRecord[],
  selected: SourceCurrentnessStatus[],
): boolean {
  const evidenceSources = sources.filter(isCalculatorEvidenceSource);
  return (
    selected.length === 0 ||
    evidenceSources.some((source) => selected.includes(source.currentness_status))
  );
}

function matchesSourceFilter(
  selected: readonly string[],
  sources: SourceRecord[],
  hasExplicitRecordFilter: boolean,
): boolean {
  if (selected.length === 0 || hasExplicitRecordFilter) return true;
  return sources
    .filter(isCalculatorEvidenceSource)
    .some((source) => selected.includes(source.source_id));
}

function valueMatchesFilters(
  row: EvidenceLibraryValueRow,
  filters: EvidenceLibraryFilters,
): boolean {
  const { record } = row;
  const evidenceSources = row.sources.filter(isCalculatorEvidenceSource);
  const hasExplicitValueFilter = filters.parameterValueIds.length > 0;
  const searchable = searchText([
    record.parameter_value_id,
    row.substanceLabel,
    record.substance_key,
    record.pathway,
    record.input_key,
    record.display_name,
    record.value,
    record.unit,
    record.value_type,
    record.default_status,
    record.evidence_support_status,
    record.extraction_status,
    record.qa_status,
    record.candidate_group_id,
    record.jurisdiction,
    record.source_authority_tier,
    record.canonical_source_status,
    record.bc_protocol_alignment,
    record.bc_protocol_basis,
    record.source_crystallization_date,
    record.applicability,
    record.uncertainty,
    record.review_notes,
    ...row.receptorGroups,
    ...row.populationGroups,
    ...row.speciesGroups,
    ...row.assumptionTags,
    ...evidenceSources.flatMap((source) => [
      source.short_citation,
      source.title,
      source.publisher,
      source.zotero_item_key,
    ]),
    ...record.evidence_items.flatMap((evidence) => [
      evidence.locator,
      evidence.value_text,
      evidence.extracted_at,
      evidence.qa_status,
      evidence.note,
    ]),
    ...row.sourceRelationships.flatMap((relationship) => [
      relationship.role,
      relationship.note,
    ]),
  ]);

  return (
    matchesSearch(searchable, filters.search) &&
    arrayIncludesSelected(filters.pathways, record.pathway) &&
    arrayIntersectsSelected(filters.substanceKeys, [record.substance_key]) &&
    arrayIntersectsSelected(filters.inputKeys, [record.input_key]) &&
    arrayIncludesSelected(filters.qaStatuses, record.qa_status) &&
    arrayIncludesSelected(filters.defaultStatuses, record.default_status) &&
    arrayIncludesSelected(
      filters.evidenceSupportStatuses,
      record.evidence_support_status,
    ) &&
    arrayIncludesSelected(filters.extractionStatuses, record.extraction_status) &&
    arrayIntersectsSelected(filters.jurisdictions, [record.jurisdiction]) &&
    matchesSourceFilter(filters.sourceIds, row.sources, hasExplicitValueFilter) &&
    arrayIntersectsSelected(filters.parameterValueIds, [
      record.parameter_value_id,
    ]) &&
    arrayIntersectsSelected(filters.candidateGroupIds, [
      record.candidate_group_id,
    ]) &&
    arrayIntersectsSelected(filters.receptorGroups, row.receptorGroups) &&
    arrayIntersectsSelected(filters.populationGroups, row.populationGroups) &&
    arrayIntersectsSelected(filters.speciesGroups, row.speciesGroups) &&
    sourceMatchesCurrentness(row.sources, filters.currentnessStatuses) &&
    (filters.authorityScopes.length === 0 ||
      evidenceSources.some((source) =>
        filters.authorityScopes.includes(source.authority_scope),
      )) &&
    (filters.sourceAuthorityTiers.length === 0 ||
      sourceAuthorityTiersForSources(row.sources).some((tier) =>
        filters.sourceAuthorityTiers.includes(tier),
      ) ||
      (record.source_authority_tier
        ? filters.sourceAuthorityTiers.includes(record.source_authority_tier)
        : false)) &&
    (filters.sourceRoles.length === 0 ||
      row.sources.some((source) =>
        sourceRolesForRecord(source).some((role) =>
          filters.sourceRoles.includes(role),
        ),
      )) &&
    (filters.canonicalSourceStatuses.length === 0 ||
      canonicalStatusesForRecord(record).some((status) =>
        filters.canonicalSourceStatuses.includes(status),
      ) ||
      row.sources.some((source) =>
        canonicalStatusesForRecord(source).some((status) =>
          filters.canonicalSourceStatuses.includes(status),
        ),
      )) &&
    (filters.bcProtocolAlignments.length === 0 ||
      (record.bc_protocol_alignment
        ? filters.bcProtocolAlignments.includes(record.bc_protocol_alignment)
        : false) ||
      row.sources.some(
        (source) =>
          source.bc_protocol_alignment !== undefined &&
          source.bc_protocol_alignment !== null &&
          filters.bcProtocolAlignments.includes(source.bc_protocol_alignment),
      )) &&
    (filters.zoteroStatuses.length === 0 ||
      evidenceSources.some((source) =>
        filters.zoteroStatuses.includes(source.zotero_status),
      ))
  );
}

function equationMatchesFilters(
  row: EvidenceLibraryEquationRow,
  filters: EvidenceLibraryFilters,
): boolean {
  const { record } = row;
  const linkedValues = linkedParameterRecordsForEquation(record.equation_id);
  const evidenceSources = row.sources.filter(isCalculatorEvidenceSource);
  const hasExplicitEquationFilter = filters.equationIds.length > 0;
  const searchable = searchText([
    record.equation_id,
    record.pathway,
    record.display_name,
    record.equation_latex,
    record.plain_language,
    record.unit_notes,
    record.applicability,
    record.qa_status,
    record.evidence_support_status,
    record.review_notes,
    ...record.input_keys,
    ...record.output_keys,
    ...row.receptorGroups,
    ...row.populationGroups,
    ...row.speciesGroups,
    ...row.assumptionTags,
    ...evidenceSources.flatMap((source) => [
      source.short_citation,
      source.title,
      source.publisher,
      source.zotero_item_key,
    ]),
    ...linkedValues.flatMap((value) => [
      value.parameter_value_id,
      value.display_name,
      value.substance_key,
      value.input_key,
      value.default_status,
      value.extraction_status,
      value.jurisdiction,
      value.applicability,
      value.review_notes,
    ]),
    ...record.evidence_items.flatMap((evidence) => [
      evidence.locator,
      evidence.value_text,
      evidence.qa_status,
      evidence.note,
    ]),
    ...row.sourceRelationships.flatMap((relationship) => [
      relationship.role,
      relationship.note,
    ]),
  ]);

  return (
    matchesSearch(searchable, filters.search) &&
    arrayIncludesSelected(filters.pathways, record.pathway) &&
    arrayIncludesSelected(filters.qaStatuses, record.qa_status) &&
    arrayIncludesSelected(
      filters.evidenceSupportStatuses,
      record.evidence_support_status,
    ) &&
    matchesSourceFilter(filters.sourceIds, row.sources, hasExplicitEquationFilter) &&
    arrayIntersectsSelected(filters.equationIds, [record.equation_id]) &&
    arrayIntersectsSelected(
      filters.substanceKeys,
      linkedValues.map((value) => value.substance_key),
    ) &&
    arrayIntersectsSelected(
      filters.defaultStatuses,
      linkedValues.map((value) => value.default_status),
    ) &&
    arrayIntersectsSelected(
      filters.extractionStatuses,
      linkedValues.map((value) => value.extraction_status),
    ) &&
    arrayIntersectsSelected(
      filters.jurisdictions,
      linkedValues.map((value) => value.jurisdiction),
    ) &&
    arrayIntersectsSelected(filters.receptorGroups, row.receptorGroups) &&
    arrayIntersectsSelected(filters.populationGroups, row.populationGroups) &&
    arrayIntersectsSelected(filters.speciesGroups, row.speciesGroups) &&
    sourceMatchesCurrentness(row.sources, filters.currentnessStatuses) &&
    (filters.authorityScopes.length === 0 ||
      evidenceSources.some((source) =>
        filters.authorityScopes.includes(source.authority_scope),
      )) &&
    (filters.sourceAuthorityTiers.length === 0 ||
      sourceAuthorityTiersForSources(row.sources).some((tier) =>
        filters.sourceAuthorityTiers.includes(tier),
      )) &&
    (filters.sourceRoles.length === 0 ||
      row.sources.some((source) =>
        sourceRolesForRecord(source).some((role) =>
          filters.sourceRoles.includes(role),
        ),
      )) &&
    (filters.canonicalSourceStatuses.length === 0 ||
      canonicalStatusesForRecord(record).some((status) =>
        filters.canonicalSourceStatuses.includes(status),
      ) ||
      row.sources.some((source) =>
        canonicalStatusesForRecord(source).some((status) =>
          filters.canonicalSourceStatuses.includes(status),
        ),
      )) &&
    (filters.bcProtocolAlignments.length === 0 ||
      row.sources.some(
        (source) =>
          source.bc_protocol_alignment !== undefined &&
          source.bc_protocol_alignment !== null &&
          filters.bcProtocolAlignments.includes(source.bc_protocol_alignment),
      )) &&
    (filters.zoteroStatuses.length === 0 ||
      evidenceSources.some((source) =>
        filters.zoteroStatuses.includes(source.zotero_status),
      ))
  );
}

function sourceMatchesFilters(
  row: EvidenceLibrarySourceRow,
  filters: EvidenceLibraryFilters,
): boolean {
  const { record } = row;
  const linkedValues = linkedParameterRecordsForSource(record.source_id);
  const linkedEquations = linkedEquationRecordsForSource(record.source_id);
  const linkedPathways = [
    ...linkedValues.map((value) => value.pathway),
    ...linkedEquations.map((equation) => equation.pathway),
  ];
  const linkedQaStatuses = [
    ...linkedValues.map((value) => value.qa_status),
    ...linkedEquations.map((equation) => equation.qa_status),
  ];
  const linkedEvidenceSupportStatuses = [
    ...linkedValues.map((value) => value.evidence_support_status),
    ...linkedEquations.map((equation) => equation.evidence_support_status),
  ];
  const linkedValueIds = linkedValues.map((value) => value.parameter_value_id);
  const linkedCandidateGroupIds = linkedValues.map(
    (value) => value.candidate_group_id,
  );
  const linkedEquationIds = linkedEquations.map((equation) => equation.equation_id);
  const hasLinkedRecordIdFilter =
    filters.parameterValueIds.length > 0 || filters.equationIds.length > 0;
  const matchesLinkedRecordIdFilter =
    !hasLinkedRecordIdFilter ||
    linkedValueIds.some((valueId) => filters.parameterValueIds.includes(valueId)) ||
    linkedEquationIds.some((equationId) => filters.equationIds.includes(equationId));
  const searchable = searchText([
    record.source_id,
    record.short_citation,
    record.title,
    record.year,
    record.publisher,
    record.doi,
    record.url,
    record.zotero_item_key,
    record.zotero_collection_path,
    record.external_file_hint,
    record.notes,
    record.authority_scope,
    record.source_authority_tier,
    record.calculator_source_role,
    record.canonical_source_status,
    record.bc_protocol_alignment,
    record.bc_protocol_basis,
    record.source_crystallization_date,
    record.currentness_status,
    record.version,
    record.page_last_modified,
    record.checked_at,
    record.conflict_rule,
    ...linkedValues.flatMap((value) => [
      value.parameter_value_id,
      value.display_name,
      value.substance_key,
      value.pathway,
      value.input_key,
      value.candidate_group_id,
      value.evidence_support_status,
      value.applicability,
      value.review_notes,
      ...(value.receptor_groups ?? []),
      ...(value.population_groups ?? []),
      ...(value.species_groups ?? []),
      ...(value.assumption_tags ?? []),
    ]),
    ...linkedEquations.flatMap((equation) => [
      equation.equation_id,
      equation.display_name,
      equation.pathway,
      equation.equation_latex,
      equation.evidence_support_status,
      equation.plain_language,
      equation.applicability,
      equation.review_notes,
      ...(equation.receptor_groups ?? []),
      ...(equation.population_groups ?? []),
      ...(equation.species_groups ?? []),
      ...(equation.assumption_tags ?? []),
    ]),
  ]);

  return (
    matchesSearch(searchable, filters.search) &&
    arrayIncludesSelected(filters.authorityScopes, record.authority_scope) &&
    arrayIntersectsSelected(
      filters.sourceAuthorityTiers,
      record.source_authority_tier ? [record.source_authority_tier] : [],
    ) &&
    arrayIntersectsSelected(filters.sourceRoles, sourceRolesForRecord(record)) &&
    arrayIntersectsSelected(
      filters.canonicalSourceStatuses,
      canonicalStatusesForRecord(record),
    ) &&
    arrayIntersectsSelected(
      filters.bcProtocolAlignments,
      record.bc_protocol_alignment ? [record.bc_protocol_alignment] : [],
    ) &&
    arrayIncludesSelected(filters.currentnessStatuses, record.currentness_status) &&
    arrayIncludesSelected(filters.zoteroStatuses, record.zotero_status) &&
    arrayIntersectsSelected(filters.sourceIds, [record.source_id]) &&
    arrayIntersectsSelected(filters.pathways, linkedPathways) &&
    arrayIntersectsSelected(
      filters.substanceKeys,
      linkedValues.map((value) => value.substance_key),
    ) &&
    arrayIntersectsSelected(
      filters.inputKeys,
      linkedValues.map((value) => value.input_key),
    ) &&
    arrayIntersectsSelected(filters.qaStatuses, linkedQaStatuses) &&
    arrayIntersectsSelected(
      filters.evidenceSupportStatuses,
      linkedEvidenceSupportStatuses,
    ) &&
    arrayIntersectsSelected(
      filters.defaultStatuses,
      linkedValues.map((value) => value.default_status),
    ) &&
    arrayIntersectsSelected(
      filters.extractionStatuses,
      linkedValues.map((value) => value.extraction_status),
    ) &&
    arrayIntersectsSelected(
      filters.jurisdictions,
      linkedValues.map((value) => value.jurisdiction),
    ) &&
    matchesLinkedRecordIdFilter &&
    arrayIntersectsSelected(filters.candidateGroupIds, linkedCandidateGroupIds) &&
    arrayIntersectsSelected(
      filters.receptorGroups,
      [
        ...linkedValues.flatMap((value) => value.receptor_groups ?? []),
        ...linkedEquations.flatMap((equation) => equation.receptor_groups ?? []),
      ],
    ) &&
    arrayIntersectsSelected(
      filters.populationGroups,
      [
        ...linkedValues.flatMap((value) => value.population_groups ?? []),
        ...linkedEquations.flatMap((equation) => equation.population_groups ?? []),
      ],
    ) &&
    arrayIntersectsSelected(
      filters.speciesGroups,
      [
        ...linkedValues.flatMap((value) => value.species_groups ?? []),
        ...linkedEquations.flatMap((equation) => equation.species_groups ?? []),
      ],
    )
  );
}

function facet(values: string[], labeler = humanizeCatalogLabel): EvidenceLibraryFacetOption[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({
      value,
      label: labeler(value),
      count,
    }));
}

export function emptyEvidenceLibraryFilters(): EvidenceLibraryFilters {
  return {
    ...EMPTY_FILTERS,
    pathways: [],
    substanceKeys: [],
    inputKeys: [],
    qaStatuses: [],
    defaultStatuses: [],
    evidenceSupportStatuses: [],
    extractionStatuses: [],
    jurisdictions: [],
    authorityScopes: [],
    sourceAuthorityTiers: [],
    sourceRoles: [],
    canonicalSourceStatuses: [],
    bcProtocolAlignments: [],
    currentnessStatuses: [],
    zoteroStatuses: [],
    receptorGroups: [],
    populationGroups: [],
    speciesGroups: [],
    sourceIds: [],
    parameterValueIds: [],
    candidateGroupIds: [],
    equationIds: [],
  };
}

export function createEvidenceLibraryFilters(
  request: EvidenceLibraryFilterRequest = {},
): EvidenceLibraryFilters {
  return {
    ...emptyEvidenceLibraryFilters(),
    ...request,
    search: request.search ?? '',
    pathways: request.pathways ?? [],
    substanceKeys: request.substanceKeys ?? [],
    inputKeys: request.inputKeys ?? [],
    qaStatuses: request.qaStatuses ?? [],
    defaultStatuses: request.defaultStatuses ?? [],
    evidenceSupportStatuses: request.evidenceSupportStatuses ?? [],
    extractionStatuses: request.extractionStatuses ?? [],
    jurisdictions: request.jurisdictions ?? [],
    authorityScopes: request.authorityScopes ?? [],
    sourceAuthorityTiers: request.sourceAuthorityTiers ?? [],
    sourceRoles: request.sourceRoles ?? [],
    canonicalSourceStatuses: request.canonicalSourceStatuses ?? [],
    bcProtocolAlignments: request.bcProtocolAlignments ?? [],
    currentnessStatuses: request.currentnessStatuses ?? [],
    zoteroStatuses: request.zoteroStatuses ?? [],
    receptorGroups: request.receptorGroups ?? [],
    populationGroups: request.populationGroups ?? [],
    speciesGroups: request.speciesGroups ?? [],
    sourceIds: request.sourceIds ?? [],
    parameterValueIds: request.parameterValueIds ?? [],
    candidateGroupIds: request.candidateGroupIds ?? [],
    equationIds: request.equationIds ?? [],
  };
}

export function humanizeCatalogLabel(value: string): string {
  const labels: Record<string, string> = {
    pending_owner_export: 'Zotero link pending',
    current_default: 'current default',
    approved_source_backed: 'approved source-backed',
    pending_source_locator: 'pending source locator',
    current_calculator_scaffold: 'current calculator scaffold',
    reference_mining_lead: 'reference-mining lead',
    user_entered_or_derived: 'user-entered or derived',
    canonical_candidate: 'canonical candidate',
    supporting_context: 'supporting context',
    policy_compilation: 'policy compilation',
    implementation_scaffold: 'implementation scaffold',
    tier_1_government_or_regulatory: 'Tier 1 government or regulatory',
    tier_2_peer_reviewed_literature: 'Tier 2 peer-reviewed literature',
    tier_3_supporting_science: 'Tier 3 supporting science',
    direct_source_verified: 'direct source verified',
    needs_direct_source_check: 'needs direct source check',
    needs_exact_source_locator: 'needs exact source locator',
    protocol_1_v5_0_effective_2027_01_15:
      'Protocol 1 v5.0 effective 2027-01-15',
    protocol_1_v5_0_tier_1_government_source:
      'Protocol 1 v5.0 Tier 1 government source',
    protocol_28_v3_0_policy_compilation:
      'Protocol 28 v3.0 policy compilation',
    Canada_federal: 'Canada federal',
    US_federal: 'US federal',
    // Catalog evidence-category pathways (canonical extraction registry). Calculator
    // pathway strings are intentionally absent here so their existing badge text is
    // unchanged; these 6 give the evidence categories readable badges.
    'hh-toxicity-value': 'HH toxicity value',
    'hh-toxicity-weighting': 'HH toxicity weighting',
    'hh-exposure-parameter': 'HH exposure parameter',
    'eco-soil': 'eco soil (TRV)',
    'eco-soil-screening': 'eco soil screening',
    'reference-background': 'reference/background',
  };
  if (labels[value]) return labels[value];
  return value.replaceAll('_', ' ').replaceAll('-', ' ');
}

function hasReviewBlockingSourceRole(
  record: ParameterValueRecord,
  sources: SourceRecord[],
): boolean {
  const sourceRoles = [
    ...sources.map((source) => source.calculator_source_role),
    ...(record.source_relationships?.map((relationship) => relationship.role) ??
      []),
  ];
  return sourceRoles.some(
    (role) => role === 'policy_compilation' || role === 'reference_mining',
  );
}

function hasReviewBlockingCanonicalStatus(record: ParameterValueRecord): boolean {
  return (
    record.canonical_source_status === 'needs_direct_source_check' ||
    record.canonical_source_status === 'needs_exact_source_locator'
  );
}

export function getParameterValueReviewDisposition(
  record: ParameterValueRecord,
  sources: SourceRecord[] = [],
): EvidenceReviewDisposition {
  if (record.evidence_support_status === 'user_entered_or_derived') {
    return {
      label: 'Derived preview only',
      detail:
        'User-entered or model-derived values are read-only until separate method parity, source review, QA, and owner approval are complete.',
      blocksCalculatorDefault: true,
      tone: 'derived',
    };
  }

  if (record.evidence_support_status === 'approved_source_backed') {
    if (record.default_status === 'available_option') {
      return {
        label: 'Approved alternative',
        detail:
          'Direct source evidence is approved, but this value is an alternative and does not replace the current calculator default.',
        blocksCalculatorDefault: true,
        tone: 'approved',
      };
    }
    return {
      label: 'Approved source-backed value',
      detail:
        'Direct source evidence is approved. Phase 1 displays this status only and does not change calculator defaults.',
      blocksCalculatorDefault: record.default_status !== 'current_default',
      tone: 'approved',
    };
  }

  if (
    record.evidence_support_status === 'pending_source_locator' ||
    record.evidence_support_status === 'reference_mining_lead' ||
    hasReviewBlockingSourceRole(record, sources) ||
    hasReviewBlockingCanonicalStatus(record)
  ) {
    return {
      label: 'Needs original-source verification',
      detail:
        'Read-only candidate until the original source, exact locator, currentness, applicability, QA, and owner or delegated approval are complete.',
      blocksCalculatorDefault: true,
      tone: 'blocked',
    };
  }

  if (record.evidence_support_status === 'current_calculator_scaffold') {
    return {
      label: 'Current calculator scaffold',
      detail:
        'This records the current UI value for audit only; it is not source-approved evidence.',
      blocksCalculatorDefault: true,
      tone: 'scaffold',
    };
  }

  return {
    label: 'Review required',
    detail:
      'This value remains read-only until source evidence, QA, and approval are explicit.',
    blocksCalculatorDefault: true,
    tone: 'blocked',
  };
}

export function getSourceLeadReviewDisposition(
  lead: EvidenceLibrarySourceLeadSummary,
): EvidenceReviewDisposition {
  if (
    lead.status.includes('needs') ||
    lead.primarySourceRole === 'policy_compilation' ||
    lead.primarySourceRole === 'reference_mining'
  ) {
    return {
      label: 'Needs original-source verification',
      detail:
        'Source-of-sources lead only; promote the underlying original source after exact locator, currentness, applicability, QA, and approval.',
      blocksCalculatorDefault: true,
      tone: 'blocked',
    };
  }

  return {
    label: 'Review required',
    detail:
      'Lead records are not calculator evidence until promoted through the source review workflow.',
    blocksCalculatorDefault: true,
    tone: 'blocked',
  };
}

function countByStatus<T extends object>(
  records: readonly T[],
  key: keyof T,
  status: unknown,
): number {
  return records.filter((record) => record[key] === status).length;
}

function leadArray(raw: unknown, key: string): unknown[] {
  if (!raw || typeof raw !== 'object') return [];
  const value = (raw as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : [];
}

function sourceLeadSummary(raw: unknown): EvidenceLibrarySourceLeadSummary {
  const record = raw as Record<string, unknown>;
  const primary =
    (record.primary_document as Record<string, unknown> | undefined) ??
    (record.primary_source as Record<string, unknown> | undefined) ??
    null;
  const nextActions = [
    ...leadArray(raw, 'next_actions'),
    ...leadArray(raw, 'next_steps'),
  ].filter((item): item is string => typeof item === 'string');

  const primarySourceId =
    typeof primary?.source_id === 'string' ? primary.source_id : null;
  const primarySourceRole =
    typeof primary?.calculator_source_role === 'string'
      ? (primary.calculator_source_role as CalculatorSourceRole)
      : primarySourceId
        ? getSourceRecord(primarySourceId)?.calculator_source_role ?? null
        : null;

  return {
    leadSetId: String(record.lead_set_id ?? 'source-leads'),
    label: String(
      primary?.short_citation ??
        primary?.title ??
        record.lead_set_id ??
        'Source leads',
    ),
    status: String(record.status ?? 'needs_review'),
    rule:
      typeof record.source_of_sources_rule === 'string'
        ? record.source_of_sources_rule
        : null,
    primarySourceId,
    primarySourceRole,
    counts: {
      equationLeads: leadArray(raw, 'equation_leads').length,
      parameterValueLeads: leadArray(raw, 'parameter_value_leads').length,
      canonicalSourceLeads: leadArray(raw, 'canonical_source_leads').length,
      documentLeads: leadArray(raw, 'document_leads').length,
      hubPages: leadArray(raw, 'hub_pages').length,
    },
    nextActions,
  };
}

function buildSourceLeadSummaries(): EvidenceLibrarySourceLeadSummary[] {
  return SOURCE_LEAD_SETS.map(sourceLeadSummary);
}

function isProtocol28ValueRecord(record: ParameterValueRecord): boolean {
  return (
    record.bc_protocol_alignment === PROTOCOL28_POLICY_ALIGNMENT ||
    record.bc_protocol_alignment === PROTOCOL28_JAN2021_ALIGNMENT ||
    record.source_ids.includes(PROTOCOL28_SOURCE_ID) ||
    record.source_ids.includes(PROTOCOL28_JAN2021_SOURCE_ID) ||
    record.compilation_source_ids?.includes(PROTOCOL28_SOURCE_ID) === true ||
    record.compilation_source_ids?.includes(PROTOCOL28_JAN2021_SOURCE_ID) === true
  );
}

function isProtocol28SourceLead(lead: EvidenceLibrarySourceLeadSummary): boolean {
  return (
    lead.primarySourceId === PROTOCOL28_SOURCE_ID ||
    lead.leadSetId.toLowerCase().includes('protocol28') ||
    lead.label.toLowerCase().includes('protocol 28')
  );
}

export function buildProtocol28ReviewSummary(): EvidenceLibraryProtocol28ReviewSummary {
  const protocol28Records = PARAMETER_VALUE_RECORDS.filter(
    isProtocol28ValueRecord,
  );
  const protocol28Leads = buildSourceLeadSummaries().filter(
    isProtocol28SourceLead,
  );
  const blockedCandidateCount = protocol28Records.filter((record) =>
    getParameterValueReviewDisposition(
      record,
      compact(record.source_ids.map((sourceId) => getSourceRecord(sourceId))),
    ).blocksCalculatorDefault,
  ).length;
  const nextActions = unique(
    protocol28Leads.flatMap((lead) => lead.nextActions),
  ).slice(0, 4);

  return {
    candidateValueCount: protocol28Records.length,
    blockedCandidateCount,
    currentDefaultCount: protocol28Records.filter(
      (record) => record.default_status === 'current_default',
    ).length,
    sourceLeadSetCount: protocol28Leads.length,
    nextActions,
    canDriveCalculatorDefaults: false,
  };
}

function sourceLeadMatchesFilters(
  lead: EvidenceLibrarySourceLeadSummary,
  filters: EvidenceLibraryFilters,
): boolean {
  const searchable = searchText([
    lead.leadSetId,
    lead.label,
    lead.status,
    lead.rule,
    lead.primarySourceId,
    lead.primarySourceRole,
    ...lead.nextActions,
  ]);

  return (
    matchesSearch(searchable, filters.search) &&
    (filters.sourceIds.length === 0 ||
      (lead.primarySourceId !== null &&
        filters.sourceIds.includes(lead.primarySourceId))) &&
    (filters.evidenceSupportStatuses.length === 0 ||
      filters.evidenceSupportStatuses.includes('reference_mining_lead')) &&
    (filters.sourceRoles.length === 0 ||
      (lead.primarySourceRole !== null &&
        filters.sourceRoles.includes(lead.primarySourceRole)))
  );
}

function sourceLeadMatchesGroup(
  lead: EvidenceLibrarySourceLeadSummary,
  group: Omit<EvidenceLibraryValueGroup, 'relatedSourceLeads'>,
): boolean {
  const sourceIds = new Set(
    group.sourceRelationships
      .map((relationship) => relationship.source_id)
      .filter((sourceId): sourceId is string => Boolean(sourceId)),
  );
  if (lead.primarySourceId && sourceIds.has(lead.primarySourceId)) return true;
  if (lead.leadSetId.includes('erdc') && group.inputKey.toLowerCase().includes('bsaf')) {
    return true;
  }
  if (
    lead.leadSetId.includes('epa-ecossl') &&
    [...sourceIds].some((sourceId) => sourceId.includes('eco-ssl'))
  ) {
    return true;
  }
  return false;
}

function buildValueGroups(
  rows: EvidenceLibraryValueRow[],
  sourceLeads: EvidenceLibrarySourceLeadSummary[],
): EvidenceLibraryValueGroup[] {
  const groups = new Map<string, EvidenceLibraryValueRow[]>();
  for (const row of rows) {
    const groupRows = groups.get(row.record.candidate_group_id) ?? [];
    groupRows.push(row);
    groups.set(row.record.candidate_group_id, groupRows);
  }

  return Array.from(groups.entries())
    .map(([groupId, records]) => {
      const first = records[0];
      const currentDefault =
        records.find((row) => row.record.default_status === 'current_default') ??
        null;
      const base = {
        groupId,
        pathway: first.record.pathway,
        substanceKey: first.record.substance_key,
        substanceLabel: first.substanceLabel,
        inputKey: first.record.input_key,
        jurisdictions: uniqueArray(records.map((row) => row.record.jurisdiction)),
        records,
        currentDefault,
        evidenceSupportStatuses: uniqueArray(
          records.map((row) => row.record.evidence_support_status),
        ),
        qaStatuses: uniqueArray(records.map((row) => row.record.qa_status)),
        sourceRelationships: records.flatMap((row) => row.sourceRelationships),
        unitConsistency: assessSlotUnitConsistency(
          records.map((row) => ({
            value: row.record.value,
            unit: row.record.unit,
            input_key: row.record.input_key,
          })),
        ),
      };
      return {
        ...base,
        relatedSourceLeads: sourceLeads.filter((lead) =>
          sourceLeadMatchesGroup(lead, base),
        ),
      };
    })
    .sort((a, b) =>
      `${a.pathway} ${a.substanceLabel} ${a.inputKey}`.localeCompare(
        `${b.pathway} ${b.substanceLabel} ${b.inputKey}`,
      ),
    );
}

function buildAudit(
  sourceLeads: EvidenceLibrarySourceLeadSummary[],
  valueRecords: readonly ParameterValueRecord[] = PARAMETER_VALUE_RECORDS,
): EvidenceLibraryAudit {
  const evidenceSourceRecords = SOURCE_RECORDS.filter(isEvidenceSource);
  return {
    values: {
      total: valueRecords.length,
      approvedSourceBacked: countByStatus(
        valueRecords,
        'evidence_support_status',
        'approved_source_backed',
      ),
      pendingSourceLocator: countByStatus(
        valueRecords,
        'evidence_support_status',
        'pending_source_locator',
      ),
      currentCalculatorScaffold: countByStatus(
        valueRecords,
        'evidence_support_status',
        'current_calculator_scaffold',
      ),
      referenceMiningLead: countByStatus(
        valueRecords,
        'evidence_support_status',
        'reference_mining_lead',
      ),
      currentDefaults: countByStatus(
        valueRecords,
        'default_status',
        'current_default',
      ),
      availableOptions: countByStatus(
        valueRecords,
        'default_status',
        'available_option',
      ),
      notDefaults: countByStatus(
        valueRecords,
        'default_status',
        'not_default',
      ),
    },
    equations: {
      total: EQUATION_RECORDS.length,
      pendingReview: EQUATION_RECORDS.filter(
        (record) => record.qa_status === 'needs_review',
      ).length,
      approvedSourceBacked: countByStatus(
        EQUATION_RECORDS,
        'evidence_support_status',
        'approved_source_backed',
      ),
      pendingSourceLocator: countByStatus(
        EQUATION_RECORDS,
        'evidence_support_status',
        'pending_source_locator',
      ),
      currentCalculatorScaffold: countByStatus(
        EQUATION_RECORDS,
        'evidence_support_status',
        'current_calculator_scaffold',
      ),
    },
    sources: {
      total: evidenceSourceRecords.length,
      zoteroLinked: evidenceSourceRecords.filter(
        (record) => record.zotero_status === 'linked',
      ).length,
      zoteroPending: evidenceSourceRecords.filter(
        (record) => record.zotero_status === 'pending_owner_export',
      ).length,
      referenceMining: evidenceSourceRecords.filter(
        (record) => record.calculator_source_role === 'reference_mining',
      ).length,
      policyCompilations: evidenceSourceRecords.filter(
        (record) => record.calculator_source_role === 'policy_compilation',
      ).length,
      implementationScaffold: SOURCE_RECORDS.filter(
        (record) => record.calculator_source_role === 'implementation_scaffold',
      ).length,
    },
    sourceLeads: {
      leadSets: sourceLeads.length,
      equationLeads: sourceLeads.reduce(
        (total, lead) => total + lead.counts.equationLeads,
        0,
      ),
      parameterValueLeads: sourceLeads.reduce(
        (total, lead) => total + lead.counts.parameterValueLeads,
        0,
      ),
      canonicalSourceLeads: sourceLeads.reduce(
        (total, lead) => total + lead.counts.canonicalSourceLeads,
        0,
      ),
      documentLeads: sourceLeads.reduce(
        (total, lead) => total + lead.counts.documentLeads,
        0,
      ),
    },
  };
}

// Merge the static seed catalog with promoted/extra parameter-value records,
// deduped by parameter_value_id. On a collision the extra (promoted) record wins,
// because promoted rows are the latest HITL-approved canonical data. Returns the
// seed unchanged when there are no extra records.
function mergeParameterValueRecords(
  base: readonly ParameterValueRecord[],
  extra: readonly ParameterValueRecord[],
): ParameterValueRecord[] {
  if (extra.length === 0) return [...base];
  const byId = new Map<string, ParameterValueRecord>();
  for (const record of base) byId.set(record.parameter_value_id, record);
  for (const record of extra) byId.set(record.parameter_value_id, record);
  return [...byId.values()];
}

export function buildEvidenceLibraryView(
  filters: EvidenceLibraryFilters = emptyEvidenceLibraryFilters(),
  extraRecords: readonly ParameterValueRecord[] = [],
): EvidenceLibraryView {
  const workingRecords = mergeParameterValueRecords(
    PARAMETER_VALUE_RECORDS,
    extraRecords,
  );
  const valueRows = workingRecords.map(valueRow);
  const equationRows = EQUATION_RECORDS.map(equationRow);
  const evidenceSourceRecords = SOURCE_RECORDS.filter(isEvidenceSource);
  const sourceRows = evidenceSourceRecords.map(sourceRow);
  const allSourceLeads = buildSourceLeadSummaries();
  const filteredSourceLeads = allSourceLeads.filter((lead) =>
    sourceLeadMatchesFilters(lead, filters),
  );
  const filteredValueRows = valueRows.filter((row) =>
    valueMatchesFilters(row, filters),
  );
  const filteredEquationRows = equationRows.filter((row) =>
    equationMatchesFilters(row, filters),
  );
  const filteredSourceRows = sourceRows.filter((row) =>
    sourceMatchesFilters(row, filters),
  );
  const valueGroups = buildValueGroups(filteredValueRows, allSourceLeads);

  // Contextual (faceted) counts: each filter dimension's option counts reflect the records
  // matching all OTHER active filters (its own selection cleared). This way combining filters
  // shows the real impact, and an option never advertises a count that the current filters
  // would exclude (no "5 in the dropdown -> 0 in the results").
  type ValueFacetKey = 'pathways' | 'substanceKeys' | 'inputKeys' | 'jurisdictions';
  type SourceFacetKey = 'authorityScopes' | 'sourceRoles' | 'currentnessStatuses';
  const valueRowsExcept = (key: ValueFacetKey): EvidenceLibraryValueRow[] =>
    valueRows.filter((row) => valueMatchesFilters(row, { ...filters, [key]: [] }));
  const sourceRowsExcept = (key: SourceFacetKey): EvidenceLibrarySourceRow[] =>
    sourceRows.filter((row) => sourceMatchesFilters(row, { ...filters, [key]: [] }));

  return {
    values: filteredValueRows,
    valueGroups,
    equations: filteredEquationRows,
    sources: filteredSourceRows,
    sourceLeads: filteredSourceLeads,
    facets: {
      pathways: facet(
        valueRowsExcept('pathways').map((row) => row.record.pathway),
      ),
      substances: facet(
        valueRowsExcept('substanceKeys').map((row) => row.record.substance_key),
        (value) => substanceLabels.get(value) ?? value,
      ),
      inputKeys: facet(
        valueRowsExcept('inputKeys').map((row) => row.record.input_key),
      ),
      qaStatuses: facet([
        ...workingRecords.map((record) => record.qa_status),
        ...EQUATION_RECORDS.map((record) => record.qa_status),
      ]),
      defaultStatuses: facet(
        workingRecords.map((record) => record.default_status),
      ),
      evidenceSupportStatuses: facet([
        ...workingRecords.map(
          (record) => record.evidence_support_status,
        ),
        ...EQUATION_RECORDS.map((record) => record.evidence_support_status),
      ]),
      extractionStatuses: facet(
        workingRecords.map((record) => record.extraction_status),
      ),
      jurisdictions: facet(
        valueRowsExcept('jurisdictions').map((row) => row.record.jurisdiction),
      ),
      authorityScopes: facet(
        sourceRowsExcept('authorityScopes').map((row) => row.record.authority_scope),
      ),
      sourceAuthorityTiers: facet(
        evidenceSourceRecords
          .map((record) => record.source_authority_tier)
          .filter((tier): tier is SourceAuthorityTier => Boolean(tier)),
      ),
      sourceRoles: facet(
        sourceRowsExcept('sourceRoles').flatMap((row) =>
          sourceRolesForRecord(row.record),
        ),
      ),
      canonicalSourceStatuses: facet(
        evidenceSourceRecords
          .flatMap((record) => canonicalStatusesForRecord(record))
          .concat(
            workingRecords.flatMap((record) =>
              canonicalStatusesForRecord(record),
            ),
          ),
      ),
      bcProtocolAlignments: facet(
        [
          ...evidenceSourceRecords.map((record) => record.bc_protocol_alignment),
          ...workingRecords.map(
            (record) => record.bc_protocol_alignment,
          ),
        ].filter((alignment): alignment is string => Boolean(alignment)),
      ),
      currentnessStatuses: facet(
        sourceRowsExcept('currentnessStatuses').map(
          (row) => row.record.currentness_status,
        ),
      ),
      zoteroStatuses: facet(
        evidenceSourceRecords.map((record) => record.zotero_status),
      ),
      receptorGroups: facet(
        workingRecords.flatMap((record) => record.receptor_groups ?? []),
      ),
      populationGroups: facet(
        workingRecords.flatMap((record) => record.population_groups ?? []),
      ),
      speciesGroups: facet(
        workingRecords.flatMap((record) => record.species_groups ?? []),
      ),
    },
    audit: buildAudit(allSourceLeads, workingRecords),
    totalCounts: {
      values: workingRecords.length,
      equations: EQUATION_RECORDS.length,
      sources: evidenceSourceRecords.length,
      sourceLeads: allSourceLeads.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Cross-pathway consistency audit
// ---------------------------------------------------------------------------

export interface CrossPathwayAuditEntry {
  pathway: ProvenancePathway;
  pathway_label: string;
  parameter_value_id: string;
  value: string;
  unit: string;
  default_status: string;
  qa_status: string;
  evidence_support_status: string;
}

export interface CrossPathwayAuditRow {
  substance_key: string;
  input_key: string;
  input_label: string;
  substance_label: string;
  values_by_pathway: Map<ProvenancePathway, CrossPathwayAuditEntry>;
  is_inconsistent: boolean;
  inconsistency_severity: 'none' | 'minor' | 'major';
}

export interface CrossPathwayAuditSummary {
  rows: CrossPathwayAuditRow[];
  totalParameters: number;
  consistentCount: number;
  minorIssuesCount: number;
  majorIssuesCount: number;
}

const PATHWAY_LABELS: Record<ProvenancePathway, string> = {
  'eco-direct-eqp': 'Eco Direct (EqP)',
  'eco-food-bsaf': 'Eco Food (BSAF)',
  'background-adjustment': 'Background Adjustment',
  'human-health-direct': 'Human Health Direct',
  'human-health-food': 'Human Health Food',
};

/**
 * Normalize a value string for equality comparison.
 * Trims whitespace, lowercases, and collapses trailing decimal zeros so that
 * "0.50" and "0.5" compare as equal.
 */
function normalizeValueString(raw: string | number): string {
  const s = String(raw).trim().toLowerCase();
  // If the string looks like a number, parse and re-stringify to collapse
  // leading/trailing zeros (e.g. "0.50" -> "0.5", "1.000" -> "1").
  const n = Number(s);
  if (!Number.isNaN(n) && s !== '') {
    return String(n);
  }
  return s;
}

export function buildCrossPathwayAudit(): CrossPathwayAuditSummary {
  // Group PARAMETER_VALUE_RECORDS by composite key substance_key + input_key.
  const groups = new Map<string, ParameterValueRecord[]>();
  for (const record of PARAMETER_VALUE_RECORDS) {
    // Calculator pathways only: the 2+ pathway gate below must count derivation pathways,
    // not evidence categories, or a substance with one calculator value plus several
    // evidence rows would be falsely surfaced as a cross-pathway comparison.
    if (!isProvenancePathway(record.pathway)) continue;
    const key = `${record.substance_key}__${record.input_key}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(record);
    } else {
      groups.set(key, [record]);
    }
  }

  const rows: CrossPathwayAuditRow[] = [];

  for (const [, records] of groups) {
    // Only audit parameters that appear in 2+ pathways.
    if (records.length < 2) continue;

    const first = records[0];
    const substanceLabel =
      substanceLabels.get(first.substance_key) ?? first.substance_key;
    const inputLabel = humanizeCatalogLabel(first.input_key);

    const valuesByPathway = new Map<ProvenancePathway, CrossPathwayAuditEntry>();
    for (const record of records) {
      // Cross-pathway CONSISTENCY only compares calculator derivation pathways. Catalog
      // evidence categories (toxicity values, weighting modifiers, exposure parameters,
      // eco-soil/screening, reference/background) are not derivation pathways, so they are
      // excluded here -- mixing them into a "cross-pathway" audit would be a category error.
      const pathway = record.pathway;
      if (!isProvenancePathway(pathway)) continue;
      const entry: CrossPathwayAuditEntry = {
        pathway,
        pathway_label: PATHWAY_LABELS[pathway] ?? pathway,
        parameter_value_id: record.parameter_value_id,
        value: String(record.value),
        unit: record.unit,
        default_status: record.default_status,
        qa_status: record.qa_status,
        evidence_support_status: record.evidence_support_status,
      };
      const existing = valuesByPathway.get(pathway);
      if (existing) {
        // Prefer current_default; otherwise keep the first record seen.
        if (existing.default_status === 'current_default') {
          // Keep existing -- skip this record.
          continue;
        }
        if (record.default_status === 'current_default') {
          // New record is current_default; replace.
          valuesByPathway.set(pathway, entry);
        }
        // Neither is current_default -- keep existing (first-wins).
        continue;
      }
      valuesByPathway.set(pathway, entry);
    }

    // Collect normalized values and units for comparison.
    const normalizedValues = Array.from(valuesByPathway.values()).map((e) =>
      normalizeValueString(e.value),
    );
    const normalizedUnits = Array.from(valuesByPathway.values()).map((e) =>
      e.unit.trim().toLowerCase(),
    );

    const allValuesEqual = normalizedValues.every((v) => v === normalizedValues[0]);
    const allUnitsEqual = normalizedUnits.every((u) => u === normalizedUnits[0]);

    // Check for empty value in one pathway while others have a value.
    const hasEmptyValue = normalizedValues.some((v) => v === '');
    const hasNonEmptyValue = normalizedValues.some((v) => v !== '');
    const mixedEmptyNonEmpty = hasEmptyValue && hasNonEmptyValue;

    // Unit equality is checked first: a unit mismatch is always major,
    // even if the numeric values happen to normalize to the same string
    // (e.g. "1 mg/kg" vs "1 ug/kg" would otherwise be masked as 'none').
    let inconsistency_severity: 'none' | 'minor' | 'major';
    if (!allUnitsEqual || mixedEmptyNonEmpty) {
      inconsistency_severity = 'major';
    } else if (!allValuesEqual) {
      inconsistency_severity = 'minor';
    } else {
      inconsistency_severity = 'none';
    }
    const is_inconsistent = inconsistency_severity !== 'none';

    rows.push({
      substance_key: first.substance_key,
      input_key: first.input_key,
      input_label: inputLabel,
      substance_label: substanceLabel,
      values_by_pathway: valuesByPathway,
      is_inconsistent,
      inconsistency_severity,
    });
  }

  // Sort: major first, then minor, then none; within each group sort
  // alphabetically by substance_label then input_key.
  const severityOrder: Record<'none' | 'minor' | 'major', number> = {
    major: 0,
    minor: 1,
    none: 2,
  };
  rows.sort((a, b) => {
    const severityDiff =
      severityOrder[a.inconsistency_severity] -
      severityOrder[b.inconsistency_severity];
    if (severityDiff !== 0) return severityDiff;
    const substanceDiff = a.substance_label.localeCompare(b.substance_label);
    if (substanceDiff !== 0) return substanceDiff;
    return a.input_key.localeCompare(b.input_key);
  });

  const majorIssuesCount = rows.filter(
    (r) => r.inconsistency_severity === 'major',
  ).length;
  const minorIssuesCount = rows.filter(
    (r) => r.inconsistency_severity === 'minor',
  ).length;
  const consistentCount = rows.filter(
    (r) => r.inconsistency_severity === 'none',
  ).length;

  return {
    rows,
    totalParameters: rows.length,
    consistentCount,
    minorIssuesCount,
    majorIssuesCount,
  };
}

/**
 * Returns the cross-pathway audit row for a single (substance_key, input_key)
 * pair, or null if the parameter appears in fewer than 2 pathways.
 */
export function getCrossPathwayValueComparison(
  substanceKey: string,
  inputKey: string,
): CrossPathwayAuditRow | null {
  const matching = PARAMETER_VALUE_RECORDS.filter(
    (r) => r.substance_key === substanceKey && r.input_key === inputKey,
  );
  if (matching.length < 2) return null;

  // Build a minimal audit for just this parameter by reusing the audit logic.
  const summary = buildCrossPathwayAudit();
  return (
    summary.rows.find(
      (row) =>
        row.substance_key === substanceKey && row.input_key === inputKey,
    ) ?? null
  );
}

export function buildCalculatorEvidenceRequest(
  pathway: ProvenancePathway,
  rows: Array<{
    catalog_record: ParameterValueRecord | null;
    sources: SourceRecord[];
  }>,
  equationIds: string[],
): EvidenceLibraryFilterRequest {
  return {
    pathways: [pathway],
    parameterValueIds: rows
      .map((row) => row.catalog_record?.parameter_value_id)
      .filter((valueId): valueId is string => Boolean(valueId)),
    candidateGroupIds: rows
      .map((row) => row.catalog_record?.candidate_group_id)
      .filter((groupId): groupId is string => Boolean(groupId)),
    equationIds,
    sourceIds: unique(
      [
        ...rows.flatMap((row) =>
          row.sources
            .filter(isCalculatorEvidenceSource)
            .map((source) => source.source_id),
        ),
        ...equationIds.flatMap(
          (equationId) =>
            (getEquationRecord(equationId)?.source_ids ?? []).filter(
              (sourceId) => {
                const source = getSourceRecord(sourceId);
                return source ? isCalculatorEvidenceSource(source) : false;
              },
            ),
        ),
      ],
    ),
  };
}
