import type { RawEcotoxRecord } from './types';

type UploadField = keyof RawEcotoxRecord;

const HEADER_ALIASES: Partial<Record<UploadField, string[]>> = {
  chemical_name: [
    'chemical_name',
    'chemical',
    'chemical name',
    'substance',
    'substance_name',
  ],
  species_scientific_name: [
    'species_scientific_name',
    'species',
    'scientific_name',
    'species scientific name',
  ],
  conc1_mean: [
    'conc1_mean',
    'concentration',
    'value',
    'endpoint_value',
    'toxicity_value',
  ],
  unit: ['unit', 'units', 'concentration_unit', 'value_unit'],
  species_group: ['species_group', 'taxonomic_group', 'group'],
  media_type: ['media_type', 'media', 'medium', 'matrix', 'exposure_media'],
  endpoint: ['endpoint', 'effect', 'effect_endpoint'],
  reference_number: ['reference_number', 'reference', 'ref'],
  test_id: ['test_id', 'test', 'record_id'],
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function findField(header: string): UploadField | null {
  const normalized = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.map(normalizeHeader).includes(normalized)) {
      return field as UploadField;
    }
  }
  return null;
}

function normalizeCell(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const stringValue = String(value).trim();
  return stringValue.length > 0 ? stringValue : null;
}

function assignRecordValue(
  record: RawEcotoxRecord,
  field: UploadField,
  value: string | number | null,
): void {
  switch (field) {
    case 'chemical_name':
      record.chemical_name = value === null ? null : String(value);
      break;
    case 'species_scientific_name':
      record.species_scientific_name = value === null ? null : String(value);
      break;
    case 'conc1_mean':
      record.conc1_mean = value;
      break;
    case 'unit':
      record.unit = value === null ? null : String(value);
      break;
    case 'species_group':
      record.species_group = value === null ? null : String(value);
      break;
    case 'media_type':
      record.media_type = value === null ? null : String(value);
      break;
    case 'endpoint':
      record.endpoint = value === null ? null : String(value);
      break;
    case 'reference_number':
      record.reference_number = value;
      break;
    case 'test_id':
      record.test_id = value;
      break;
    default:
      break;
  }
}

function emptyRecord(): RawEcotoxRecord {
  return {
    chemical_name: null,
    species_scientific_name: null,
    conc1_mean: null,
    unit: null,
    species_group: null,
    media_type: null,
    endpoint: null,
    reference_number: null,
    test_id: null,
  };
}

function hasAnyRecordValue(record: RawEcotoxRecord): boolean {
  return Object.values(record).some(
    (value) => value !== null && value !== undefined && String(value).trim() !== '',
  );
}

function normalizeObjectRecord(value: unknown): RawEcotoxRecord | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const normalizedEntries = new Map(
    Object.entries(source).map(([key, entryValue]) => [
      normalizeHeader(key),
      entryValue,
    ]),
  );
  const record = emptyRecord();

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const matchedValue = normalizedEntries.get(normalizeHeader(alias));
      if (matchedValue !== undefined) {
        assignRecordValue(record, field as UploadField, normalizeCell(matchedValue));
        break;
      }
    }
  }

  return hasAnyRecordValue(record) ? record : null;
}

function parseJsonRows(text: string): RawEcotoxRecord[] {
  const parsed = JSON.parse(text) as unknown;
  const rows =
    Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { rows?: unknown }).rows)
        ? (parsed as { rows: unknown[] }).rows
        : null;

  if (!rows) {
    throw new Error('JSON upload must be an array or an object with a rows array.');
  }

  return rows
    .map(normalizeObjectRecord)
    .filter((record): record is RawEcotoxRecord => record !== null);
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
      if (char === '\r' && next === '\n') index += 1;
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  rows.push(row);

  return rows.filter((candidate) =>
    candidate.some((value) => value.trim().length > 0),
  );
}

function parseCsvUpload(text: string): RawEcotoxRecord[] {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    throw new Error('CSV upload must include a header row and at least one data row.');
  }

  const fields = rows[0].map(findField);
  if (!fields.some(Boolean)) {
    throw new Error('CSV upload did not include recognizable SSD columns.');
  }

  return rows
    .slice(1)
    .map((row) => {
      const record = emptyRecord();
      fields.forEach((field, index) => {
        if (field) assignRecordValue(record, field, normalizeCell(row[index]));
      });
      return record;
    })
    .filter(hasAnyRecordValue);
}

export function parseSsdUpload(text: string, fileName: string): RawEcotoxRecord[] {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Upload file is empty.');

  const isJson =
    fileName.toLowerCase().endsWith('.json') ||
    trimmed.startsWith('[') ||
    trimmed.startsWith('{');
  const rows = isJson ? parseJsonRows(trimmed) : parseCsvUpload(trimmed);
  if (rows.length === 0) {
    throw new Error('Upload did not contain any parseable SSD records.');
  }
  return rows;
}
