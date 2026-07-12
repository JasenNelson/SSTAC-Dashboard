import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CalculatorProvenancePanel from '../CalculatorProvenancePanel';
import type { ResolvedProvenanceRow, EquationRecord, SourceRecord } from '@/lib/matrix-options/provenance/types';

vi.mock('@/lib/matrix-options/provenance/resolver', () => ({
  resolveProvenanceRows: vi.fn(() => []),
  resolveEquationRecords: vi.fn(() => []),
  resolveEquationsForPathway: vi.fn(() => []),
  resolveSourceRecords: vi.fn(() => []),
}));

import {
  resolveProvenanceRows,
  resolveEquationRecords,
  resolveEquationsForPathway,
  resolveSourceRecords,
} from '@/lib/matrix-options/provenance/resolver';

const mockResolveProvenanceRows = vi.mocked(resolveProvenanceRows);
const mockResolveEquationRecords = vi.mocked(resolveEquationRecords);
const mockResolveEquationsForPathway = vi.mocked(resolveEquationsForPathway);
const mockResolveSourceRecords = vi.mocked(resolveSourceRecords);

function makeSourceRecord(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    source_id: 'src-test-001',
    short_citation: 'US EPA IRIS (2017)',
    title: 'US EPA IRIS Toxicological Profile',
    year: 2017,
    publisher: 'US EPA',
    doi: null,
    url: 'https://www.epa.gov/iris',
    zotero_item_key: null,
    zotero_collection_path: null,
    zotero_attachment_keys: [],
    zotero_status: 'linked',
    external_file_hint: null,
    file_storage: 'zotero_or_external',
    notes: null,
    authority_scope: 'federal-guidance',
    currentness_status: 'current',
    version: null,
    page_last_modified: null,
    checked_at: null,
    conflict_rule: null,
    supersedes_source_ids: [],
    calculator_source_role: 'canonical_candidate',
    canonical_source_status: 'direct_source_verified',
    ...overrides,
  };
}

function makeProvenanceRow(
  overrides: Partial<ResolvedProvenanceRow> = {},
): ResolvedProvenanceRow {
  return {
    input_key: 'sf_oral',
    label: 'Oral slope factor',
    current_value: '1.0 per mg/kg/day',
    role: 'current calculator default',
    catalog_record: null,
    sources: [],
    evidence_items: [],
    evidence_support_status: 'current_calculator_scaffold',
    qa_status: 'needs_review',
    default_status: 'current_default',
    candidate_group_id: null,
    note: null,
    ...overrides,
  };
}

function makeEquationRecord(overrides: Partial<EquationRecord> = {}): EquationRecord {
  return {
    equation_id: 'eq-hh-direct-001',
    pathway: 'eco-direct-eqp',
    display_name: 'EqP FCV derivation',
    equation_latex: 'FCV = Kow \\times C_{ss}',
    plain_language: 'FCV derived from organic carbon partitioning',
    input_keys: ['fcv_ug_per_L', 'kow'],
    output_keys: ['fcv_ug_per_L'],
    unit_notes: 'ug/L',
    source_ids: [],
    applicability: 'Applicable to non-ionic organic compounds',
    qa_status: 'approved',
    evidence_items: [],
    review_notes: '',
    evidence_support_status: 'approved_source_backed',
    ...overrides,
  };
}

describe('CalculatorProvenancePanel', () => {
  beforeEach(() => {
    mockResolveProvenanceRows.mockClear();
    mockResolveEquationsForPathway.mockClear();
    mockResolveEquationRecords.mockClear();
    mockResolveSourceRecords.mockClear();
    mockResolveProvenanceRows.mockReturnValue([]);
    mockResolveEquationsForPathway.mockReturnValue([]);
    mockResolveEquationRecords.mockReturnValue([]);
    mockResolveSourceRecords.mockReturnValue([]);
  });

  describe('renders with empty usedValues', () => {
    it('renders the panel with 0 values, 0 equations, 0 sources in summary', () => {
      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
        />,
      );

      expect(
        screen.getByTestId('calculator-provenance-panel'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/0 used values, 0 equations, 0 sources/),
      ).toBeInTheDocument();
    });

    it('renders the default title "References and provenance"', () => {
      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
        />,
      );

      expect(screen.getByText('References and provenance')).toBeInTheDocument();
    });
  });

  describe('summary counts with resolver data', () => {
    it('renders correct value/equation/source counts when resolvers return data', () => {
      const row = makeProvenanceRow({
        input_key: 'fcv_ug_per_L',
        label: 'FCV',
        sources: [],
      });
      const equation = makeEquationRecord({ source_ids: [] });
      const source = makeSourceRecord({ source_id: 'src-001' });

      mockResolveProvenanceRows.mockReturnValue([row]);
      mockResolveEquationsForPathway.mockReturnValue([equation]);
      mockResolveSourceRecords.mockReturnValue([source]);

      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
        />,
      );

      expect(
        screen.getByText(/1 used values?, 1 equations?, 1 sources?/),
      ).toBeInTheDocument();
    });

    it('shows plural "equations" for multiple equations', () => {
      const eq1 = makeEquationRecord({ equation_id: 'eq-001', source_ids: [] });
      const eq2 = makeEquationRecord({ equation_id: 'eq-002', source_ids: [] });

      mockResolveEquationsForPathway.mockReturnValue([eq1, eq2]);

      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
        />,
      );

      expect(screen.getByText(/0 used values, 2 equations, 0 sources/)).toBeInTheDocument();
    });

    it('shows singular "equation" for exactly one equation', () => {
      const eq = makeEquationRecord({ equation_id: 'eq-001', source_ids: [] });

      mockResolveEquationsForPathway.mockReturnValue([eq]);

      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
        />,
      );

      expect(
        screen.getByText(/0 used values, 1 equation, 0 sources/),
      ).toBeInTheDocument();
    });
  });

  describe('"Open References & Values" button', () => {
    it('calls onOpenEvidenceLibrary when button is clicked', () => {
      const onOpenEvidenceLibrary = vi.fn();

      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
          onOpenEvidenceLibrary={onOpenEvidenceLibrary}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', { name: 'Open References & Values' }),
      );

      expect(onOpenEvidenceLibrary).toHaveBeenCalledOnce();
    });

    it('does not render the button when onOpenEvidenceLibrary is not provided', () => {
      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
        />,
      );

      expect(
        screen.queryByRole('button', { name: 'Open References & Values' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('open/collapsed state', () => {
    it('renders the details element collapsed by default (defaultOpen=false)', () => {
      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
        />,
      );

      const details = screen.getByTestId('calculator-provenance-panel');
      expect(details).not.toHaveAttribute('open');
    });

    it('renders the details element open when defaultOpen=true', () => {
      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
          defaultOpen={true}
        />,
      );

      const details = screen.getByTestId('calculator-provenance-panel');
      expect(details).toHaveAttribute('open');
    });
  });

  describe('custom title', () => {
    it('renders a custom title when provided', () => {
      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
          title="Custom provenance heading"
        />,
      );

      expect(
        screen.getByText('Custom provenance heading'),
      ).toBeInTheDocument();
    });

    it('falls back to default title when title is not provided', () => {
      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
        />,
      );

      expect(
        screen.getByText('References and provenance'),
      ).toBeInTheDocument();
    });
  });

  describe('uses equationIds prop instead of pathway equations when provided', () => {
    it('calls resolveEquationRecords when equationIds is provided', () => {
      const equation = makeEquationRecord({ equation_id: 'eq-custom-001', source_ids: [] });
      mockResolveEquationRecords.mockReturnValue([equation]);

      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
          equationIds={['eq-custom-001']}
        />,
      );

      expect(mockResolveEquationRecords).toHaveBeenCalledWith(['eq-custom-001']);
      expect(mockResolveEquationsForPathway).not.toHaveBeenCalled();
    });

    it('calls resolveEquationsForPathway when equationIds is not provided', () => {
      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
        />,
      );

      expect(mockResolveEquationsForPathway).toHaveBeenCalledWith('eco-direct-eqp');
      expect(mockResolveEquationRecords).not.toHaveBeenCalled();
    });
  });

  describe('audit text', () => {
    it('renders audit text with approved/pending/scaffold/user counts', () => {
      const approvedRow = makeProvenanceRow({
        input_key: 'fcv',
        evidence_support_status: 'approved_source_backed',
      });
      const pendingRow = makeProvenanceRow({
        input_key: 'kow',
        evidence_support_status: 'pending_source_locator',
      });

      mockResolveProvenanceRows.mockReturnValue([approvedRow, pendingRow]);

      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
          defaultOpen={true}
        />,
      );

      expect(
        screen.getByText(/1 approved, 1 pending source locator/),
      ).toBeInTheDocument();
    });
  });

  // T45 (2026-07-11): needs_review honest-flag regression lock. The panel renders a per-row
  // StatusChip for row.qa_status (component source ~L350), which is the mechanism that surfaces a
  // needs_review value's flag to the user in the calculator UI. No prior test in this file asserted
  // the RENDERED TEXT of that chip -- the "audit text" tests above only cover the aggregate counts
  // (keyed on evidence_support_status, a different field). This locks the actual DOM text so a future
  // refactor of StatusChip/humanizeStatus cannot silently drop the "needs review" wording from view.
  describe('per-row qa_status flag surfaces to the user (T45)', () => {
    it('a needs_review row renders a visible "needs review" status chip (never silently presented as verified)', () => {
      const row = makeProvenanceRow({
        input_key: 'sf_oral',
        qa_status: 'needs_review',
      });
      mockResolveProvenanceRows.mockReturnValue([row]);

      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
          defaultOpen={true}
        />,
      );

      expect(screen.getByText(/needs review/i)).toBeInTheDocument();
      // Discriminating contrast: the panel must NOT also claim this row is approved.
      expect(screen.queryByText(/^approved$/i)).not.toBeInTheDocument();
    });

    it('an approved row renders "approved" (not "needs review") -- the chip is status-discriminating, not a static label', () => {
      const row = makeProvenanceRow({
        input_key: 'sf_oral',
        qa_status: 'approved',
      });
      mockResolveProvenanceRows.mockReturnValue([row]);

      render(
        <CalculatorProvenancePanel
          pathway="eco-direct-eqp"
          usedValues={[]}
          defaultOpen={true}
        />,
      );

      expect(screen.getByText(/^approved$/i)).toBeInTheDocument();
      expect(screen.queryByText(/needs review/i)).not.toBeInTheDocument();
    });
  });
});
