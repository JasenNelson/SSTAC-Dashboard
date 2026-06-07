// Tests for MatrixMapSelectionStats (Phase 1).
// Covers: loading / error / empty states, two-bucket render, caution chips,
// DL/2 basis label, excluded-count footer.
//
// Plain ASCII only (code point <= 127).

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatrixMapSelectionStats } from '../MatrixMapSelectionStats';
import type { MatrixMapMeasurementRow } from '@/stores/matrix-map/measurementStore';
import { DEFAULT_MATRIX_MAP_FILTER_STATE } from '@/stores/matrix-map/filterStore';
import type { MatrixMapFilterState } from '@/stores/matrix-map/filterStore';

const EMPTY_FILTER: MatrixMapFilterState = DEFAULT_MATRIX_MAP_FILTER_STATE;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeRow(over: Partial<MatrixMapMeasurementRow> = {}): MatrixMapMeasurementRow {
  return {
    sample_id: 'sample-a',
    sample_display_name: 'Station 1',
    sample_station_id: 'STA-1',
    sample_event_id: 'event-a',
    event_date: '2024-06-15',
    measurement_id: 'meas-a',
    medium: 'sediment',
    substance_id: 'sub-copper',
    substance_key: 'copper',
    substance_display_name: 'Copper',
    value: 5.0,
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

// Helper: render the component with defaults.
function renderStats(props: Partial<React.ComponentProps<typeof MatrixMapSelectionStats>> = {}) {
  return render(
    <MatrixMapSelectionStats
      rows={[]}
      filterState={EMPTY_FILTER}
      isLoading={false}
      errorMessage={null}
      ready={true}
      {...props}
    />,
  );
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('MatrixMapSelectionStats -- loading state', () => {
  it('shows loading copy when isLoading=true', () => {
    renderStats({ isLoading: true, ready: false });
    expect(screen.getByTestId('matrix-map-stats-loading')).toBeInTheDocument();
    expect(screen.getByText(/Computing selection statistics/)).toBeInTheDocument();
  });

  it('shows loading copy when ready=false (not yet fetched)', () => {
    renderStats({ isLoading: false, ready: false });
    expect(screen.getByTestId('matrix-map-stats-loading')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe('MatrixMapSelectionStats -- error state', () => {
  it('shows error message in amber box', () => {
    renderStats({ errorMessage: 'RPC failed: connection refused', ready: true });
    expect(screen.getByTestId('matrix-map-stats-error')).toBeInTheDocument();
    expect(screen.getByText(/RPC failed: connection refused/)).toBeInTheDocument();
  });

  it('does NOT show loading testid when there is an error', () => {
    renderStats({ errorMessage: 'Some error', ready: true });
    expect(screen.queryByTestId('matrix-map-stats-loading')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty state (no rows match filters)
// ---------------------------------------------------------------------------

describe('MatrixMapSelectionStats -- empty state', () => {
  it('shows "No measurements match" copy when rows is empty and ready', () => {
    renderStats({ rows: [], ready: true });
    expect(screen.getByTestId('matrix-map-stats-empty')).toBeInTheDocument();
    expect(screen.getByText(/No measurements match the current filters/)).toBeInTheDocument();
  });

  it('empty state is not shown when loading', () => {
    renderStats({ rows: [], isLoading: true, ready: false });
    expect(screen.queryByTestId('matrix-map-stats-empty')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Two-bucket render
// ---------------------------------------------------------------------------

describe('MatrixMapSelectionStats -- two-bucket render', () => {
  // Build rows for Copper (mg/kg) and Lead (mg/kg) -- two different substances,
  // same unit: two distinct buckets because substance_id differs.
  const copperRows = Array.from({ length: 5 }, (_, i) =>
    makeRow({
      sample_id: 'copper-' + String(i),
      substance_id: 'sub-copper',
      substance_display_name: 'Copper',
      unit: 'mg/kg',
      value: i + 1,
    }),
  );
  const leadRows = Array.from({ length: 5 }, (_, i) =>
    makeRow({
      sample_id: 'lead-' + String(i),
      substance_id: 'sub-lead',
      substance_display_name: 'Lead',
      unit: 'mg/kg',
      value: (i + 1) * 2,
    }),
  );
  const rows = [...copperRows, ...leadRows];

  it('renders two bucket cards', () => {
    renderStats({ rows, ready: true });
    const bucketHeaders = screen.getAllByTestId('matrix-map-stats-bucket-header');
    expect(bucketHeaders).toHaveLength(2);
  });

  it('each bucket header shows substance name and unit', () => {
    renderStats({ rows, ready: true });
    const copperCard = screen.getByTestId('matrix-map-stats-bucket-id:sub-copper__mg/kg');
    expect(copperCard).toHaveTextContent(/Copper/i);
    expect(copperCard).toHaveTextContent(/mg\/kg/i);

    const leadCard = screen.getByTestId('matrix-map-stats-bucket-id:sub-lead__mg/kg');
    expect(leadCard).toHaveTextContent(/Lead/i);
    expect(leadCard).toHaveTextContent(/mg\/kg/i);
  });

  it('each bucket shows descriptive stats', () => {
    renderStats({ rows, ready: true });
    const descriptiveBlocks = screen.getAllByTestId('matrix-map-stats-descriptive');
    expect(descriptiveBlocks).toHaveLength(2);
  });

  it('each bucket shows UCL block (n=5 >= 2)', () => {
    renderStats({ rows, ready: true });
    const uclBlocks = screen.getAllByTestId('matrix-map-stats-ucl');
    expect(uclBlocks).toHaveLength(2);
  });

  it('large round integers render with their significant zeros (100000, not 1)', () => {
    // codex 5.5 P2 regression lock: the formatter must trim zeros only after
    // a decimal point -- toPrecision(6) of 100000 is "100000" and stripping
    // its trailing zeros displayed it as "1".
    renderStats({
      rows: [
        makeRow({ value: 100000, unit: 'mg/kg' }),
        makeRow({ value: 100000, unit: 'mg/kg' }),
      ],
    });
    // min/max/mean all equal 100000 -- the rendered card must contain the
    // full figure and must not have collapsed it to a bare "1".
    expect(screen.getAllByText('100000').length).toBeGreaterThan(0);
    expect(screen.queryByText(/^1$/)).not.toBeInTheDocument();
  });

  it('buckets container testid is present', () => {
    renderStats({ rows, ready: true });
    expect(screen.getByTestId('matrix-map-stats-buckets')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Caution chips
// ---------------------------------------------------------------------------

describe('MatrixMapSelectionStats -- caution chips', () => {
  it('small_n chip shown when n=3 (< 10)', () => {
    const rows = [
      makeRow({ sample_id: 'a', value: 1.0 }),
      makeRow({ sample_id: 'b', value: 2.0 }),
      makeRow({ sample_id: 'c', value: 3.0 }),
    ];
    renderStats({ rows, ready: true });
    expect(screen.getByTestId('matrix-map-stats-flag-small_n')).toBeInTheDocument();
  });

  it('high_skew chip shown for highly skewed data', () => {
    // Use a very right-skewed dataset: logs span a wide range -> sigmaHat > 1.
    // Values: 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000 (8 values)
    // log-spacings are uniform on log scale so sigma-hat should be high.
    const vals = [0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000];
    const rows = vals.map((v, i) =>
      makeRow({ sample_id: String(i), value: v }),
    );
    renderStats({ rows, ready: true });
    expect(screen.getByTestId('matrix-map-stats-flag-high_skew')).toBeInTheDocument();
  });

  it('insufficient_n chip shown for n=1', () => {
    const rows = [makeRow({ value: 5.0 })];
    renderStats({ rows, ready: true });
    expect(screen.getByTestId('matrix-map-stats-flag-insufficient_n')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DL/2 basis label
// ---------------------------------------------------------------------------

describe('MatrixMapSelectionStats -- DL/2 basis label', () => {
  it('shows DL/2 label in UCL basis when censored rows are present', () => {
    const rows = [
      makeRow({ sample_id: 'a', value: null, censored: true, detection_limit: 10.0 }),
      makeRow({ sample_id: 'b', value: null, censored: true, detection_limit: 20.0 }),
    ];
    renderStats({ rows, ready: true });
    const basisEl = screen.getByTestId('matrix-map-stats-ucl-basis');
    expect(basisEl.textContent).toContain('DL/2 substitution');
  });
});

// ---------------------------------------------------------------------------
// Excluded-count footer
// ---------------------------------------------------------------------------

describe('MatrixMapSelectionStats -- excluded-count footer', () => {
  it('shows excluded count when rows could not be parsed', () => {
    const rows = [
      makeRow({ sample_id: 'a', value: 5.0 }),         // accepted
      makeRow({ sample_id: 'b', value: 'ND' as unknown as number }),  // excluded
    ];
    renderStats({ rows, ready: true });
    const excluded = screen.getByTestId('matrix-map-stats-excluded');
    expect(excluded.textContent).toMatch(/1 row.* excluded/);
  });

  it('does not show excluded footer when excludedCount=0', () => {
    const rows = [makeRow({ value: 5.0 })];
    renderStats({ rows, ready: true });
    expect(screen.queryByTestId('matrix-map-stats-excluded')).not.toBeInTheDocument();
  });
});
