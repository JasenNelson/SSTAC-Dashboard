import {
  getEquationRecord,
  getParameterValueRecord,
  getParameterValueRecordById,
  getPathwayEquationRecords,
  getSourceRecord,
} from './catalog';
import type {
  CalculatorUsedValue,
  CalculatorValueRole,
  EvidenceSupportStatus,
  EquationRecord,
  ProvenancePathway,
  ResolvedProvenanceRow,
  SourceRecord,
} from './types';

function compact<T>(items: Array<T | undefined>): T[] {
  return items.filter((item): item is T => item !== undefined);
}

function formatValue(
  value: CalculatorUsedValue['value'],
  unit: string | undefined,
): string {
  if (value === null || value === '') return 'Not provided';
  const suffix = unit && unit !== 'unitless' ? ` ${unit}` : '';
  return `${value}${suffix}`;
}

function resolveRole(
  usedValue: CalculatorUsedValue,
  catalogRecord: ResolvedProvenanceRow['catalog_record'],
): CalculatorValueRole {
  if (
    usedValue.role === 'source-backed default' &&
    catalogRecord?.evidence_support_status !== 'approved_source_backed'
  ) {
    return catalogRecord?.default_status === 'current_default'
      ? 'current calculator default'
      : 'placeholder default';
  }
  return usedValue.role;
}

function resolveEvidenceSupportStatus(
  usedValue: CalculatorUsedValue,
  catalogRecord: ResolvedProvenanceRow['catalog_record'],
): EvidenceSupportStatus {
  if (catalogRecord) return catalogRecord.evidence_support_status;
  if (
    usedValue.role === 'user-entered value' ||
    usedValue.role === 'derived value' ||
    usedValue.role === 'screening assumption'
  ) {
    return 'user_entered_or_derived';
  }
  return 'current_calculator_scaffold';
}

export function resolveSourceRecords(sourceIds: string[]): SourceRecord[] {
  return compact(sourceIds.map((sourceId) => getSourceRecord(sourceId)));
}

export function resolveEquationRecords(
  equationIds: string[],
): EquationRecord[] {
  return compact(equationIds.map((equationId) => getEquationRecord(equationId)));
}

export function resolveEquationsForPathway(
  pathway: ProvenancePathway,
): EquationRecord[] {
  return getPathwayEquationRecords(pathway);
}

export function resolveProvenanceRows(
  usedValues: CalculatorUsedValue[],
): ResolvedProvenanceRow[] {
  return usedValues.map((usedValue) => {
    const catalogRecord = usedValue.parameter_value_id
      ? getParameterValueRecordById(usedValue.parameter_value_id) ?? null
      : usedValue.substance_key && usedValue.pathway
        ? getParameterValueRecord(
            usedValue.substance_key,
            usedValue.pathway,
            usedValue.input_key,
          ) ?? null
        : null;
    const unit = usedValue.unit ?? catalogRecord?.unit;

    return {
      input_key: usedValue.input_key,
      label: usedValue.label || catalogRecord?.display_name || usedValue.input_key,
      current_value: formatValue(usedValue.value, unit),
      role: resolveRole(usedValue, catalogRecord),
      catalog_record: catalogRecord,
      sources: catalogRecord
        ? resolveSourceRecords(catalogRecord.source_ids)
        : [],
      evidence_items: catalogRecord?.evidence_items ?? [],
      evidence_support_status: resolveEvidenceSupportStatus(
        usedValue,
        catalogRecord,
      ),
      qa_status: catalogRecord?.qa_status ?? 'not_cataloged',
      default_status: catalogRecord?.default_status ?? 'not_cataloged',
      candidate_group_id: catalogRecord?.candidate_group_id ?? null,
      note: usedValue.note ?? catalogRecord?.review_notes ?? null,
    };
  });
}
