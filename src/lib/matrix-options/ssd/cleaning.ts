import {
  type RawEcotoxRecord,
  type SsdCleanedRecord,
  type SsdExcludedRecord,
  type SsdMedium,
  type SsdMediumCode,
} from './types';
import { mapTaxonomicGroup } from './taxonomy';

const INVALID_VALUE_MARKERS = new Set([
  '',
  'na',
  'n/a',
  'nan',
  'nr',
  'not reported',
  'none',
  'null',
  '--',
]);

export function mediumToCode(medium: SsdMedium): SsdMediumCode {
  return medium === 'freshwater' ? 'FW' : 'MW';
}

export function parseEndpointValue(
  rawValue: RawEcotoxRecord['conc1_mean'],
): number | null {
  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) ? rawValue : null;
  }
  if (typeof rawValue !== 'string') return null;

  const normalized = rawValue.trim().toLowerCase();
  if (INVALID_VALUE_MARKERS.has(normalized)) return null;
  if (/^[<>]=?/.test(normalized)) return null;

  const cleaned = normalized.replace(/,/g, '');
  const match = cleaned.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function endpointMatches(endpoint: string, filters: string[]): boolean {
  if (filters.length === 0) return true;
  const normalizedEndpoint = endpoint.trim().toLowerCase();
  return filters.some((filter) =>
    normalizedEndpoint.includes(filter.trim().toLowerCase()),
  );
}

function toStringOrNull(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

export function prepareSsdRecords(
  rows: RawEcotoxRecord[],
  options: {
    chemicalNames?: string[];
    medium: SsdMedium;
    endpointFilters?: string[];
  },
): {
  cleanedRecords: SsdCleanedRecord[];
  excludedRecords: SsdExcludedRecord[];
} {
  const cleanedRecords: SsdCleanedRecord[] = [];
  const excludedRecords: SsdExcludedRecord[] = [];
  const expectedMedium = mediumToCode(options.medium);
  const endpointFilters = options.endpointFilters ?? [];
  const selectedChemicals = new Set(
    (options.chemicalNames ?? [])
      .map((chemicalName) => chemicalName.trim().toLowerCase())
      .filter(Boolean),
  );

  for (const row of rows) {
    const chemicalName = row.chemical_name?.trim() || 'Unknown chemical';
    if (
      selectedChemicals.size > 0 &&
      !selectedChemicals.has(chemicalName.toLowerCase())
    ) {
      excludedRecords.push({
        reason: 'chemical_mismatch',
        detail: `Chemical '${chemicalName}' did not match selected chemicals.`,
        raw: row,
      });
      continue;
    }

    const mediaType = row.media_type?.trim() as SsdMediumCode | undefined;
    if (mediaType !== expectedMedium) {
      excludedRecords.push({
        reason: 'medium_mismatch',
        detail: `Expected ${expectedMedium}; got ${row.media_type ?? 'blank'}.`,
        raw: row,
      });
      continue;
    }

    const endpoint = row.endpoint?.trim() || 'Unspecified endpoint';
    if (!endpointMatches(endpoint, endpointFilters)) {
      excludedRecords.push({
        reason: 'endpoint_mismatch',
        detail: `Endpoint '${endpoint}' did not match selected filters.`,
        raw: row,
      });
      continue;
    }

    const speciesScientificName = row.species_scientific_name?.trim();
    if (!speciesScientificName) {
      excludedRecords.push({
        reason: 'missing_species',
        detail: 'Missing species_scientific_name.',
        raw: row,
      });
      continue;
    }

    const concentration = parseEndpointValue(row.conc1_mean);
    if (concentration === null) {
      excludedRecords.push({
        reason: 'invalid_endpoint_value',
        detail: `Invalid conc1_mean '${row.conc1_mean ?? 'blank'}'.`,
        raw: row,
      });
      continue;
    }

    if (concentration <= 0) {
      excludedRecords.push({
        reason: 'non_positive_endpoint_value',
        detail: `Endpoint value must be positive; got ${concentration}.`,
        raw: row,
      });
      continue;
    }

    const speciesGroup = row.species_group?.trim() || 'Other';
    cleanedRecords.push({
      chemicalName,
      speciesScientificName,
      concentration,
      speciesGroup,
      broadGroup: mapTaxonomicGroup(speciesGroup),
      mediaType,
      endpoint,
      referenceNumber: toStringOrNull(row.reference_number),
      testId: toStringOrNull(row.test_id),
      raw: row,
    });
  }

  return { cleanedRecords, excludedRecords };
}
