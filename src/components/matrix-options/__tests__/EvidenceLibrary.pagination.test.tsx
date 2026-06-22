import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import EvidenceLibrary from '../EvidenceLibrary';
import { createEvidenceLibraryFilters } from '@/lib/matrix-options/provenance/library';
import type { ParameterValueRecord } from '@/lib/matrix-options/provenance/types';

// Integration guard for the Values-table pagination (companion to evidenceLibraryPagination.test.ts,
// which unit-tests the math). This expands the compact fixture to 60 rows -- above the 50-row page
// size -- and asserts the LIVE table renders only one page at a time and the pager navigates. It is
// the regression guard for the #380 render-volume class: the un-paged table rendered every catalog
// row (1161+), and each logical row emits two <tr>, so the DOM grew unbounded.

// Same module mocks as EvidenceLibrary.test.tsx so the component renders without live Supabase.
vi.mock('@/lib/admin-utils', () => ({
  checkCurrentUserAdminStatus: vi.fn().mockResolvedValue(false),
  refreshGlobalAdminStatus: vi.fn().mockResolvedValue(false),
}));
vi.mock('@/lib/matrix-options/provenance/evidence-sync', () => ({
  submitEvidenceItem: vi.fn().mockResolvedValue(false),
  fetchEvidenceItems: vi.fn().mockResolvedValue([]),
  deleteEvidenceItem: vi.fn().mockResolvedValue(false),
}));
vi.mock('@/lib/matrix-options/provenance/triage-sync', () => ({
  fetchTriageState: vi.fn().mockResolvedValue({}),
  setTriageStatus: vi.fn().mockResolvedValue(false),
}));
vi.mock('@/lib/matrix-options/provenance/qa-review-sync', () => ({
  submitReview: vi.fn().mockResolvedValue(false),
  fetchReviewHistory: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/matrix-options/provenance/promotion', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/matrix-options/provenance/promotion')>();
  return { ...actual, promoteSourceLead: vi.fn().mockResolvedValue(null) };
});
vi.mock('@/lib/matrix-options/provenance/saved-views-sync', () => ({
  fetchSavedViews: vi.fn().mockResolvedValue([]),
  createSavedView: vi
    .fn()
    .mockResolvedValue({ success: false, view: null, error: 'unauthenticated' }),
  deleteSavedView: vi.fn().mockResolvedValue(false),
  importLegacySavedViews: vi.fn().mockResolvedValue({ success: false, imported: 0 }),
  fetchSavedViewsResult: vi
    .fn()
    .mockResolvedValue({ signedIn: false, error: false, views: [] }),
}));

// Catalog mock expanded to 60 DISTINCT rows by cloning the 10-row fixture with unique ids/keys.
vi.mock('@/lib/matrix-options/provenance/catalog', async () => {
  const {
    FIXTURE_PARAMETER_VALUE_RECORDS,
    FIXTURE_SOURCE_RECORDS,
    FIXTURE_EQUATION_RECORDS,
    FIXTURE_SOURCE_LEAD_SETS,
  } = await import('./evidenceLibraryFixture');

  const base = FIXTURE_PARAMETER_VALUE_RECORDS;
  const PARAMETER_VALUE_RECORDS = Array.from({ length: 60 }, (_, i) => {
    const src = base[i % base.length];
    const clone = JSON.parse(JSON.stringify(src)) as ParameterValueRecord;
    clone.parameter_value_id = `${src.parameter_value_id}-pg-${i}`;
    clone.substance_key = `${src.substance_key}-pg-${i}`;
    return clone;
  });
  const SOURCE_RECORDS = FIXTURE_SOURCE_RECORDS;
  const EQUATION_RECORDS = FIXTURE_EQUATION_RECORDS;
  const SOURCE_LEAD_SETS = FIXTURE_SOURCE_LEAD_SETS;

  return {
    SOURCE_RECORDS,
    EQUATION_RECORDS,
    PARAMETER_VALUE_RECORDS,
    SOURCE_LEAD_SETS,
    getSourceRecord: (sourceId: string) =>
      SOURCE_RECORDS.find((source) => source.source_id === sourceId),
    getEquationRecord: (equationId: string) =>
      EQUATION_RECORDS.find((equation) => equation.equation_id === equationId),
    getPathwayEquationRecords: (pathway: string) =>
      EQUATION_RECORDS.filter((equation) => equation.pathway === pathway),
    getParameterValueRecord: (
      substanceKey: string,
      pathway: string,
      inputKey: string,
    ) =>
      PARAMETER_VALUE_RECORDS.find(
        (record) =>
          record.substance_key === substanceKey &&
          record.pathway === pathway &&
          record.input_key === inputKey,
      ),
    getParameterValueRecordById: (parameterValueId: string) =>
      PARAMETER_VALUE_RECORDS.find(
        (record) => record.parameter_value_id === parameterValueId,
      ),
    getParameterValueRecordsForSubstance: (substanceKey: string, pathway: string) =>
      PARAMETER_VALUE_RECORDS.filter(
        (record) => record.substance_key === substanceKey && record.pathway === pathway,
      ),
  };
});

function renderLibrary() {
  return render(
    <EvidenceLibrary
      filters={createEvidenceLibraryFilters()}
      onFiltersChange={vi.fn()}
      regulatoryFrameId="bc-protocol1-v5-dra"
    />,
  );
}

describe('EvidenceLibrary Values-table pagination (integration, 60 rows)', () => {
  it('renders only the first page of rows and a pager when the list exceeds the page size', async () => {
    renderLibrary();
    // Page 1: 50 of 60 rows rendered; ResultCountBadge still reports the true filtered total.
    expect(await screen.findByText(/Page 1 of 2/)).toBeTruthy();
    expect(screen.getByText(/Rows 1-50 of 60/)).toBeTruthy();
    expect(screen.getByText(/Showing 60 of 60 values/)).toBeTruthy();
    expect(screen.getAllByTestId('evidence-library-inspect-value')).toHaveLength(50);
  });

  it('navigates to the last page, rendering only the remaining rows', async () => {
    renderLibrary();
    await screen.findByText(/Page 1 of 2/);
    fireEvent.click(screen.getByRole('button', { name: /^Next$/ }));
    expect(await screen.findByText(/Page 2 of 2/)).toBeTruthy();
    expect(screen.getByText(/Rows 51-60 of 60/)).toBeTruthy();
    // The last page holds the remaining 10 rows -- never the full 60 in the DOM at once.
    expect(screen.getAllByTestId('evidence-library-inspect-value')).toHaveLength(10);
  });

  it('disables Prev on the first page and Next on the last page', async () => {
    renderLibrary();
    await screen.findByText(/Page 1 of 2/);
    const prev = screen.getByRole('button', { name: /^Prev$/ });
    const next = screen.getByRole('button', { name: /^Next$/ });
    expect(prev).toHaveProperty('disabled', true);
    expect(next).toHaveProperty('disabled', false);
    fireEvent.click(next);
    await screen.findByText(/Page 2 of 2/);
    expect(screen.getByRole('button', { name: /^Prev$/ })).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: /^Next$/ })).toHaveProperty('disabled', true);
  });
});
