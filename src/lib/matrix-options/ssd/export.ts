import type { SsdAnalysisResult } from './types';

function escapeCsvValue(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildSsdSpeciesCsv(result: SsdAnalysisResult): string {
  const header = [
    'species_scientific_name',
    'broad_group',
    'ssd_value',
    'unit',
    'value_count',
    'source_record_count',
    'min_value',
    'max_value',
  ];
  const rows = result.speciesAggregates.map((aggregate) => [
    aggregate.speciesScientificName,
    aggregate.broadGroup,
    aggregate.value,
    result.unit,
    aggregate.valueCount,
    aggregate.sourceRecordCount,
    aggregate.minValue,
    aggregate.maxValue,
  ]);

  return [header, ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n');
}

export function buildSsdReceiptJson(result: SsdAnalysisResult): string {
  return JSON.stringify(
    {
      hcp: Number.isFinite(result.hcp) ? result.hcp : null,
      pValue: result.pValue,
      unit: result.unit,
      speciesCount: result.speciesCount,
      cleanedRecordCount: result.cleanedRecordCount,
      excludedRecordCount: result.excludedRecordCount,
      settings: result.settings,
      derivedCandidate: result.derivedCandidate,
      diagnostics: result.diagnostics,
      warnings: result.warnings,
      speciesAggregates: result.speciesAggregates,
      excludedRecords: result.excludedRecords.map((record) => ({
        reason: record.reason,
        detail: record.detail,
      })),
    },
    null,
    2,
  );
}
