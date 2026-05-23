import { SUBSTANCE_LIBRARY } from '../substanceLibrary';
import {
  EQUATION_RECORDS,
  PARAMETER_VALUE_RECORDS,
  SOURCE_RECORDS,
  getEquationRecord,
  getSourceRecord,
} from './catalog';
import type {
  EquationRecord,
  EvidenceLibraryFilterRequest,
  EvidenceLibraryFilters,
  ParameterValueRecord,
  ProvenancePathway,
  SourceCurrentnessStatus,
  SourceRecord,
} from './types';

export interface EvidenceLibraryValueRow {
  record: ParameterValueRecord;
  substanceLabel: string;
  sources: SourceRecord[];
  equations: EquationRecord[];
  receptorGroups: string[];
  populationGroups: string[];
  speciesGroups: string[];
  assumptionTags: string[];
}

export interface EvidenceLibraryEquationRow {
  record: EquationRecord;
  sources: SourceRecord[];
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
  qaStatuses: EvidenceLibraryFacetOption[];
  defaultStatuses: EvidenceLibraryFacetOption[];
  extractionStatuses: EvidenceLibraryFacetOption[];
  jurisdictions: EvidenceLibraryFacetOption[];
  authorityScopes: EvidenceLibraryFacetOption[];
  currentnessStatuses: EvidenceLibraryFacetOption[];
  zoteroStatuses: EvidenceLibraryFacetOption[];
  receptorGroups: EvidenceLibraryFacetOption[];
  populationGroups: EvidenceLibraryFacetOption[];
  speciesGroups: EvidenceLibraryFacetOption[];
}

export interface EvidenceLibraryView {
  values: EvidenceLibraryValueRow[];
  equations: EvidenceLibraryEquationRow[];
  sources: EvidenceLibrarySourceRow[];
  facets: EvidenceLibraryFacetOptions;
  totalCounts: {
    values: number;
    equations: number;
    sources: number;
  };
}

const EMPTY_FILTERS: EvidenceLibraryFilters = {
  search: '',
  pathways: [],
  substanceKeys: [],
  qaStatuses: [],
  defaultStatuses: [],
  extractionStatuses: [],
  jurisdictions: [],
  authorityScopes: [],
  currentnessStatuses: [],
  zoteroStatuses: [],
  receptorGroups: [],
  populationGroups: [],
  speciesGroups: [],
  sourceIds: [],
  parameterValueIds: [],
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
    source.calculator_source_role !== 'reference_mining'
  );
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
    record.extraction_status,
    record.qa_status,
    record.jurisdiction,
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
      evidence.qa_status,
      evidence.note,
    ]),
  ]);

  return (
    matchesSearch(searchable, filters.search) &&
    arrayIncludesSelected(filters.pathways, record.pathway) &&
    arrayIntersectsSelected(filters.substanceKeys, [record.substance_key]) &&
    arrayIncludesSelected(filters.qaStatuses, record.qa_status) &&
    arrayIncludesSelected(filters.defaultStatuses, record.default_status) &&
    arrayIncludesSelected(filters.extractionStatuses, record.extraction_status) &&
    arrayIntersectsSelected(filters.jurisdictions, [record.jurisdiction]) &&
    matchesSourceFilter(filters.sourceIds, row.sources, hasExplicitValueFilter) &&
    arrayIntersectsSelected(filters.parameterValueIds, [
      record.parameter_value_id,
    ]) &&
    arrayIntersectsSelected(filters.receptorGroups, row.receptorGroups) &&
    arrayIntersectsSelected(filters.populationGroups, row.populationGroups) &&
    arrayIntersectsSelected(filters.speciesGroups, row.speciesGroups) &&
    sourceMatchesCurrentness(row.sources, filters.currentnessStatuses) &&
    (filters.authorityScopes.length === 0 ||
      evidenceSources.some((source) =>
        filters.authorityScopes.includes(source.authority_scope),
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
  ]);

  return (
    matchesSearch(searchable, filters.search) &&
    arrayIncludesSelected(filters.pathways, record.pathway) &&
    arrayIncludesSelected(filters.qaStatuses, record.qa_status) &&
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
  const linkedValueIds = linkedValues.map((value) => value.parameter_value_id);
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
    arrayIncludesSelected(filters.currentnessStatuses, record.currentness_status) &&
    arrayIncludesSelected(filters.zoteroStatuses, record.zotero_status) &&
    arrayIntersectsSelected(filters.sourceIds, [record.source_id]) &&
    arrayIntersectsSelected(filters.pathways, linkedPathways) &&
    arrayIntersectsSelected(
      filters.substanceKeys,
      linkedValues.map((value) => value.substance_key),
    ) &&
    arrayIntersectsSelected(filters.qaStatuses, linkedQaStatuses) &&
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
    qaStatuses: [],
    defaultStatuses: [],
    extractionStatuses: [],
    jurisdictions: [],
    authorityScopes: [],
    currentnessStatuses: [],
    zoteroStatuses: [],
    receptorGroups: [],
    populationGroups: [],
    speciesGroups: [],
    sourceIds: [],
    parameterValueIds: [],
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
    qaStatuses: request.qaStatuses ?? [],
    defaultStatuses: request.defaultStatuses ?? [],
    extractionStatuses: request.extractionStatuses ?? [],
    jurisdictions: request.jurisdictions ?? [],
    authorityScopes: request.authorityScopes ?? [],
    currentnessStatuses: request.currentnessStatuses ?? [],
    zoteroStatuses: request.zoteroStatuses ?? [],
    receptorGroups: request.receptorGroups ?? [],
    populationGroups: request.populationGroups ?? [],
    speciesGroups: request.speciesGroups ?? [],
    sourceIds: request.sourceIds ?? [],
    parameterValueIds: request.parameterValueIds ?? [],
    equationIds: request.equationIds ?? [],
  };
}

export function humanizeCatalogLabel(value: string): string {
  const labels: Record<string, string> = {
    pending_owner_export: 'Zotero link pending',
  };
  if (labels[value]) return labels[value];
  return value.replaceAll('_', ' ').replaceAll('-', ' ');
}

export function buildEvidenceLibraryView(
  filters: EvidenceLibraryFilters = emptyEvidenceLibraryFilters(),
): EvidenceLibraryView {
  const valueRows = PARAMETER_VALUE_RECORDS.map(valueRow);
  const equationRows = EQUATION_RECORDS.map(equationRow);
  const evidenceSourceRecords = SOURCE_RECORDS.filter(isEvidenceSource);
  const sourceRows = evidenceSourceRecords.map(sourceRow);

  return {
    values: valueRows.filter((row) => valueMatchesFilters(row, filters)),
    equations: equationRows.filter((row) => equationMatchesFilters(row, filters)),
    sources: sourceRows.filter((row) => sourceMatchesFilters(row, filters)),
    facets: {
      pathways: facet([
        ...PARAMETER_VALUE_RECORDS.map((record) => record.pathway),
        ...EQUATION_RECORDS.map((record) => record.pathway),
      ]),
      substances: facet(
        PARAMETER_VALUE_RECORDS.map((record) => record.substance_key),
        (value) => substanceLabels.get(value) ?? value,
      ),
      qaStatuses: facet([
        ...PARAMETER_VALUE_RECORDS.map((record) => record.qa_status),
        ...EQUATION_RECORDS.map((record) => record.qa_status),
      ]),
      defaultStatuses: facet(
        PARAMETER_VALUE_RECORDS.map((record) => record.default_status),
      ),
      extractionStatuses: facet(
        PARAMETER_VALUE_RECORDS.map((record) => record.extraction_status),
      ),
      jurisdictions: facet(
        PARAMETER_VALUE_RECORDS.map((record) => record.jurisdiction),
      ),
      authorityScopes: facet(
        evidenceSourceRecords.map((record) => record.authority_scope),
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
    totalCounts: {
      values: PARAMETER_VALUE_RECORDS.length,
      equations: EQUATION_RECORDS.length,
      sources: evidenceSourceRecords.length,
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
