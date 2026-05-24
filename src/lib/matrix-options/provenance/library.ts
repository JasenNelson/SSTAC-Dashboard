import { SUBSTANCE_LIBRARY } from '../substanceLibrary';
import {
  EQUATION_RECORDS,
  PARAMETER_VALUE_RECORDS,
  SOURCE_LEAD_SETS,
  SOURCE_RECORDS,
  getEquationRecord,
  getSourceRecord,
} from './catalog';
import type {
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

export interface EvidenceLibraryValueGroup {
  groupId: string;
  pathway: ProvenancePathway;
  substanceKey: string;
  substanceLabel: string;
  inputKey: string;
  jurisdiction: string;
  records: EvidenceLibraryValueRow[];
  currentDefault: EvidenceLibraryValueRow | null;
  evidenceSupportStatuses: EvidenceSupportStatus[];
  qaStatuses: string[];
  sourceRelationships: SourceRelationship[];
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
  };
  if (labels[value]) return labels[value];
  return value.replaceAll('_', ' ').replaceAll('-', ' ');
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
        jurisdiction: first.record.jurisdiction,
        records,
        currentDefault,
        evidenceSupportStatuses: uniqueArray(
          records.map((row) => row.record.evidence_support_status),
        ),
        qaStatuses: uniqueArray(records.map((row) => row.record.qa_status)),
        sourceRelationships: records.flatMap((row) => row.sourceRelationships),
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
): EvidenceLibraryAudit {
  const evidenceSourceRecords = SOURCE_RECORDS.filter(isEvidenceSource);
  return {
    values: {
      total: PARAMETER_VALUE_RECORDS.length,
      approvedSourceBacked: countByStatus(
        PARAMETER_VALUE_RECORDS,
        'evidence_support_status',
        'approved_source_backed',
      ),
      pendingSourceLocator: countByStatus(
        PARAMETER_VALUE_RECORDS,
        'evidence_support_status',
        'pending_source_locator',
      ),
      currentCalculatorScaffold: countByStatus(
        PARAMETER_VALUE_RECORDS,
        'evidence_support_status',
        'current_calculator_scaffold',
      ),
      referenceMiningLead: countByStatus(
        PARAMETER_VALUE_RECORDS,
        'evidence_support_status',
        'reference_mining_lead',
      ),
      currentDefaults: countByStatus(
        PARAMETER_VALUE_RECORDS,
        'default_status',
        'current_default',
      ),
      availableOptions: countByStatus(
        PARAMETER_VALUE_RECORDS,
        'default_status',
        'available_option',
      ),
      notDefaults: countByStatus(
        PARAMETER_VALUE_RECORDS,
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

export function buildEvidenceLibraryView(
  filters: EvidenceLibraryFilters = emptyEvidenceLibraryFilters(),
): EvidenceLibraryView {
  const valueRows = PARAMETER_VALUE_RECORDS.map(valueRow);
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

  return {
    values: filteredValueRows,
    valueGroups,
    equations: filteredEquationRows,
    sources: filteredSourceRows,
    sourceLeads: filteredSourceLeads,
    facets: {
      pathways: facet([
        ...PARAMETER_VALUE_RECORDS.map((record) => record.pathway),
        ...EQUATION_RECORDS.map((record) => record.pathway),
      ]),
      substances: facet(
        PARAMETER_VALUE_RECORDS.map((record) => record.substance_key),
        (value) => substanceLabels.get(value) ?? value,
      ),
      inputKeys: facet(PARAMETER_VALUE_RECORDS.map((record) => record.input_key)),
      qaStatuses: facet([
        ...PARAMETER_VALUE_RECORDS.map((record) => record.qa_status),
        ...EQUATION_RECORDS.map((record) => record.qa_status),
      ]),
      defaultStatuses: facet(
        PARAMETER_VALUE_RECORDS.map((record) => record.default_status),
      ),
      evidenceSupportStatuses: facet([
        ...PARAMETER_VALUE_RECORDS.map(
          (record) => record.evidence_support_status,
        ),
        ...EQUATION_RECORDS.map((record) => record.evidence_support_status),
      ]),
      extractionStatuses: facet(
        PARAMETER_VALUE_RECORDS.map((record) => record.extraction_status),
      ),
      jurisdictions: facet(
        PARAMETER_VALUE_RECORDS.map((record) => record.jurisdiction),
      ),
      authorityScopes: facet(
        evidenceSourceRecords.map((record) => record.authority_scope),
      ),
      sourceAuthorityTiers: facet(
        evidenceSourceRecords
          .map((record) => record.source_authority_tier)
          .filter((tier): tier is SourceAuthorityTier => Boolean(tier)),
      ),
      sourceRoles: facet(
        evidenceSourceRecords.flatMap((record) => sourceRolesForRecord(record)),
      ),
      canonicalSourceStatuses: facet(
        evidenceSourceRecords
          .flatMap((record) => canonicalStatusesForRecord(record))
          .concat(
            PARAMETER_VALUE_RECORDS.flatMap((record) =>
              canonicalStatusesForRecord(record),
            ),
          ),
      ),
      bcProtocolAlignments: facet(
        [
          ...evidenceSourceRecords.map((record) => record.bc_protocol_alignment),
          ...PARAMETER_VALUE_RECORDS.map(
            (record) => record.bc_protocol_alignment,
          ),
        ].filter((alignment): alignment is string => Boolean(alignment)),
      ),
      currentnessStatuses: facet(
        evidenceSourceRecords.map((record) => record.currentness_status),
      ),
      zoteroStatuses: facet(
        evidenceSourceRecords.map((record) => record.zotero_status),
      ),
      receptorGroups: facet(
        PARAMETER_VALUE_RECORDS.flatMap((record) => record.receptor_groups ?? []),
      ),
      populationGroups: facet(
        PARAMETER_VALUE_RECORDS.flatMap((record) => record.population_groups ?? []),
      ),
      speciesGroups: facet(
        PARAMETER_VALUE_RECORDS.flatMap((record) => record.species_groups ?? []),
      ),
    },
    audit: buildAudit(allSourceLeads),
    totalCounts: {
      values: PARAMETER_VALUE_RECORDS.length,
      equations: EQUATION_RECORDS.length,
      sources: evidenceSourceRecords.length,
      sourceLeads: allSourceLeads.length,
    },
  };
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
