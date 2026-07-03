import {
  getEquationRecord,
  getParameterValueRecordById,
  getParameterValueRecordsForSubstance,
  getPathwayEquationRecords,
  getSourceRecord,
} from './catalog';
import type {
  CalculatorUsedValue,
  CalculatorValueRole,
  EvidenceSupportStatus,
  EquationRecord,
  ParameterValueRecord,
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

// True only when the catalog value and the used value are the SAME magnitude (unit-aware). Provenance
// passes used values as strings or numbers; compare numerically when both parse, else string-equal.
// Used to disambiguate multi-source candidate rows without mis-attributing a library-seeded value.
function valuesMatch(
  catalogValue: number | string,
  usedValue: number | string | null,
  catalogUnit?: string,
  usedUnit?: string,
): boolean {
  if (usedValue === null || usedValue === '') return false;
  if (usedUnit && catalogUnit && usedUnit !== catalogUnit) return false;
  const a = Number(catalogValue);
  const b = Number(usedValue);
  if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
  return String(catalogValue) === String(usedValue);
}

// Tuple (substance, pathway, input) fallback when the used value cites no exact parameter_value_id.
// VALUE-AWARE for every candidate count: a catalog row is attributed to the used value ONLY when its
// value matches (unit-aware). This is the safety contract wiring needs_review rows depends on -- a row
// is NEVER attributed to a not-provided or non-matching value, even when it is the only candidate for
// the tuple. Resolution: the single value-matching candidate; else (on a value tie) the current_default
// among the matches; else null (no attribution). NOTE: HH-direct TRV rows (rfd/sf/abs/ba) flow through
// here without an id and seed from the substanceLibrary -- their default-load value matches the
// current_default row, and the tie-break keeps that attribution when a same-valued IRIS/P28 sibling
// also shares the tuple.
function resolveTupleRecord(
  usedValue: CalculatorUsedValue,
): ParameterValueRecord | null {
  const substanceKey = usedValue.substance_key;
  const pathway = usedValue.pathway;
  if (!substanceKey || !pathway) return null;
  const candidates = getParameterValueRecordsForSubstance(
    substanceKey,
    pathway,
  ).filter((r) => r.input_key === usedValue.input_key);
  if (candidates.length === 0) return null;
  const matches = candidates.filter((c) =>
    valuesMatch(c.value, usedValue.value, c.unit, usedValue.unit),
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    // Several candidates share the used value (e.g. a wired current_default scaffold + a same-valued
    // IRIS/P28 sibling, as for HH-direct arsenic/zinc/cadmium/methylmercury). Prefer the
    // current_default so HH default-load rows keep their catalog attribution; give up (null) only when
    // the tie cannot be broken that way. Eco rows are all available_option, so this never resurrects
    // an eco mis-attribution.
    const currentDefaults = matches.filter(
      (c) => c.default_status === 'current_default',
    );
    if (currentDefaults.length === 1) return currentDefaults[0];
    // Fallback (2026-07-03): no current_default broke the tie. If exactly one match is
    // qa_status='approved' (the common shape: one approved IRIS/HC row + a same-valued
    // needs_review BC Protocol 28 sibling), prefer the approved row. Scoped as a fallback
    // AFTER the current_default check -- never a pre-filter -- so a curated current_default
    // scaffold is never reattributed away from its row (a pre-filter regresses
    // arsenic/zinc/cadmium/methylmercury/etc.; see resolver.integration.test). Genuinely
    // dual-approved ties (e.g. IRIS + HC both approved at the same value) stay null, awaiting
    // a current_default row.
    const approved = matches.filter((c) => c.qa_status === 'approved');
    if (approved.length === 1) return approved[0];
  }
  return null;
}

export function resolveProvenanceRows(
  usedValues: CalculatorUsedValue[],
): ResolvedProvenanceRow[] {
  return usedValues.map((usedValue) => {
    const catalogRecord = usedValue.parameter_value_id
      ? getParameterValueRecordById(usedValue.parameter_value_id) ?? null
      : resolveTupleRecord(usedValue);
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
