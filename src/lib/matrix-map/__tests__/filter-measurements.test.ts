// Characterisation tests for filterMeasurementRows.
// Locks every filter branch including lexical date comparison and the
// row.medium cast.  Any future refactor that changes observable behaviour
// will break these tests first.
//
// Plain ASCII only (code point <= 127).

import { describe, it, expect } from 'vitest';
import { filterMeasurementRows } from '../filter-measurements';
import type { MatrixMapMeasurementRow } from '@/stores/matrix-map/measurementStore';
import type { MatrixMapFilterState } from '@/stores/matrix-map/filterStore';
import { DEFAULT_MATRIX_MAP_FILTER_STATE } from '@/stores/matrix-map/filterStore';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRow(over: Partial<MatrixMapMeasurementRow> = {}): MatrixMapMeasurementRow {
  return {
    sample_id: 'sample-a',
    sample_display_name: 'Station 1',
    sample_station_id: 'STA-1',
    sample_event_id: 'event-a',
    event_date: '2024-06-15',
    date_precision: 'exact',
    measurement_id: 'meas-a',
    medium: 'sediment',
    substance_id: 'sub-copper',
    substance_key: 'copper',
    substance_display_name: 'Copper',
    value: 12.5,
    unit: 'mg/kg',
    detection_limit: null,
    qualifier: null,
    censored: false,
    coordinate_quality_tier: 'high',
    classification: 'reference',
    source_dra_id: 'dra-1',
    source_dra_title: 'Source DRA',
    source_dra_citation: null,
    ...over,
  };
}

const EMPTY_FILTER: MatrixMapFilterState = DEFAULT_MATRIX_MAP_FILTER_STATE;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('filterMeasurementRows', () => {
  it('returns all rows when filters are empty', () => {
    const rows = [makeRow({ sample_id: 'a' }), makeRow({ sample_id: 'b' })];
    expect(filterMeasurementRows(rows, EMPTY_FILTER)).toHaveLength(2);
  });

  it('returns empty array for empty rows', () => {
    expect(filterMeasurementRows([], EMPTY_FILTER)).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Substance filter
  // ---------------------------------------------------------------------------

  it('filters by substance_id when substance_ids is non-empty', () => {
    const rows = [
      makeRow({ substance_id: 'sub-copper' }),
      makeRow({ substance_id: 'sub-lead' }),
    ];
    const filter = { ...EMPTY_FILTER, substance_ids: ['sub-copper'] };
    const result = filterMeasurementRows(rows, filter);
    expect(result).toHaveLength(1);
    expect(result[0].substance_id).toBe('sub-copper');
  });

  it('excludes rows with null substance_id when a substance filter is active', () => {
    const rows = [
      makeRow({ substance_id: null }),
      makeRow({ substance_id: 'sub-copper' }),
    ];
    const filter = { ...EMPTY_FILTER, substance_ids: ['sub-copper'] };
    const result = filterMeasurementRows(rows, filter);
    expect(result).toHaveLength(1);
    expect(result[0].substance_id).toBe('sub-copper');
  });

  it('keeps all rows when substance_ids is empty even if substance_id is null', () => {
    const rows = [makeRow({ substance_id: null }), makeRow({ substance_id: 'sub-copper' })];
    expect(filterMeasurementRows(rows, EMPTY_FILTER)).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // Medium filter
  // ---------------------------------------------------------------------------

  it('filters by medium when mediums is non-empty', () => {
    const rows = [
      makeRow({ medium: 'sediment' }),
      makeRow({ medium: 'water' }),
    ];
    const filter: MatrixMapFilterState = { ...EMPTY_FILTER, mediums: ['sediment'] };
    const result = filterMeasurementRows(rows, filter);
    expect(result).toHaveLength(1);
    expect(result[0].medium).toBe('sediment');
  });

  it('accepts medium cast via MatrixMapMedium -- non-matching string excluded', () => {
    const rows = [makeRow({ medium: 'unknown_medium' })];
    const filter: MatrixMapFilterState = { ...EMPTY_FILTER, mediums: ['sediment'] };
    expect(filterMeasurementRows(rows, filter)).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // QA filter
  // ---------------------------------------------------------------------------

  it('qa=detected keeps only confirmed detects (censored===false); excludes censored AND null', () => {
    const rows = [
      makeRow({ censored: false }),
      makeRow({ censored: true }),
      makeRow({ censored: null }),
    ];
    const filter = { ...EMPTY_FILTER, qa: 'detected' as const };
    const result = filterMeasurementRows(rows, filter);
    // Only the explicit detect passes; an unknown (null) censored status is NOT a detect.
    expect(result).toHaveLength(1);
    expect(result[0].censored).toBe(false);
  });

  it('qa=censored keeps only confirmed censored (censored===true); excludes detected AND null', () => {
    const rows = [
      makeRow({ censored: false }),
      makeRow({ censored: true }),
      makeRow({ censored: null }),
    ];
    const filter = { ...EMPTY_FILTER, qa: 'censored' as const };
    const result = filterMeasurementRows(rows, filter);
    expect(result).toHaveLength(1);
    expect(result[0].censored).toBe(true);
  });

  it('qa=all passes all rows regardless of censored', () => {
    const rows = [
      makeRow({ censored: false }),
      makeRow({ censored: true }),
      makeRow({ censored: null }),
    ];
    expect(filterMeasurementRows(rows, EMPTY_FILTER)).toHaveLength(3);
  });

  // ---------------------------------------------------------------------------
  // Classification filter
  // ---------------------------------------------------------------------------

  it('filters by classification when classification is not "all"', () => {
    const rows = [
      makeRow({ classification: 'reference' }),
      makeRow({ classification: 'impacted' }),
      makeRow({ classification: 'unknown' }),
    ];
    const filter = { ...EMPTY_FILTER, classification: 'reference' as const };
    const result = filterMeasurementRows(rows, filter);
    expect(result).toHaveLength(1);
    expect(result[0].classification).toBe('reference');
  });

  it('classification=all passes all rows', () => {
    const rows = [
      makeRow({ classification: 'reference' }),
      makeRow({ classification: 'impacted' }),
    ];
    expect(filterMeasurementRows(rows, EMPTY_FILTER)).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // Date filter (lexical ISO-8601 string comparison -- VERBATIM from RightPanel)
  // ---------------------------------------------------------------------------

  it('excludes rows before date_from using lexical comparison', () => {
    // '2024-01-01' < '2024-06-15' lexically
    const rows = [
      makeRow({ event_date: '2024-01-01' }),
      makeRow({ event_date: '2024-06-15' }),
      makeRow({ event_date: '2025-01-01' }),
    ];
    const filter = { ...EMPTY_FILTER, date_from: '2024-06-15' };
    const result = filterMeasurementRows(rows, filter);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.event_date)).toEqual(['2024-06-15', '2025-01-01']);
  });

  it('excludes rows after date_to using lexical comparison', () => {
    const rows = [
      makeRow({ event_date: '2024-06-14' }),
      makeRow({ event_date: '2024-06-15' }),
      makeRow({ event_date: '2025-01-01' }),
    ];
    const filter = { ...EMPTY_FILTER, date_to: '2024-06-15' };
    const result = filterMeasurementRows(rows, filter);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.event_date)).toEqual(['2024-06-14', '2024-06-15']);
  });

  it('empty date_from passes all rows (date filter inactive)', () => {
    const rows = [makeRow({ event_date: '2000-01-01' }), makeRow({ event_date: '2099-12-31' })];
    // EMPTY_FILTER has date_from='' which is falsy, so the filter is skipped.
    expect(filterMeasurementRows(rows, EMPTY_FILTER)).toHaveLength(2);
  });

  it('filters by both date_from and date_to simultaneously', () => {
    const rows = [
      makeRow({ event_date: '2023-12-31' }),
      makeRow({ event_date: '2024-03-01' }),
      makeRow({ event_date: '2024-06-15' }),
      makeRow({ event_date: '2025-01-01' }),
    ];
    const filter = { ...EMPTY_FILTER, date_from: '2024-01-01', date_to: '2024-12-31' };
    const result = filterMeasurementRows(rows, filter);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.event_date)).toEqual(['2024-03-01', '2024-06-15']);
  });

  it('excludes undated rows (event_date null) when date_from is active', () => {
    const rows = [
      makeRow({ event_date: null, date_precision: 'undated' }),
      makeRow({ event_date: '2024-06-15' }),
    ];
    const result = filterMeasurementRows(rows, { ...EMPTY_FILTER, date_from: '2024-01-01' });
    expect(result).toHaveLength(1);
    expect(result[0].event_date).toBe('2024-06-15');
  });

  it('excludes undated rows when date_to is active', () => {
    const rows = [
      makeRow({ event_date: null, date_precision: 'undated' }),
      makeRow({ event_date: '2024-06-15' }),
    ];
    const result = filterMeasurementRows(rows, { ...EMPTY_FILTER, date_to: '2024-12-31' });
    expect(result).toHaveLength(1);
    expect(result[0].event_date).toBe('2024-06-15');
  });

  it('INCLUDES undated rows when no date filter is active', () => {
    const rows = [
      makeRow({ event_date: null, date_precision: 'undated' }),
      makeRow({ event_date: '2024-06-15' }),
    ];
    const result = filterMeasurementRows(rows, EMPTY_FILTER);
    expect(result).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // Combined filters
  // ---------------------------------------------------------------------------

  it('applies all active filters conjunctively', () => {
    const rows = [
      makeRow({ substance_id: 'sub-copper', medium: 'sediment', classification: 'reference', censored: false, event_date: '2024-06-15' }),
      makeRow({ substance_id: 'sub-lead',   medium: 'sediment', classification: 'reference', censored: false, event_date: '2024-06-15' }),
      makeRow({ substance_id: 'sub-copper', medium: 'water',    classification: 'reference', censored: false, event_date: '2024-06-15' }),
      makeRow({ substance_id: 'sub-copper', medium: 'sediment', classification: 'impacted',  censored: false, event_date: '2024-06-15' }),
      makeRow({ substance_id: 'sub-copper', medium: 'sediment', classification: 'reference', censored: true,  event_date: '2024-06-15' }),
      makeRow({ substance_id: 'sub-copper', medium: 'sediment', classification: 'reference', censored: false, event_date: '2023-01-01' }),
    ];
    const filter: MatrixMapFilterState = {
      substance_ids: ['sub-copper'],
      mediums: ['sediment'],
      qa: 'detected',
      classification: 'reference',
      date_from: '2024-01-01',
      date_to: '2024-12-31',
    };
    const result = filterMeasurementRows(rows, filter);
    expect(result).toHaveLength(1);
    expect(result[0].substance_id).toBe('sub-copper');
    expect(result[0].medium).toBe('sediment');
    expect(result[0].classification).toBe('reference');
    expect(result[0].censored).toBe(false);
    expect(result[0].event_date).toBe('2024-06-15');
  });
});
