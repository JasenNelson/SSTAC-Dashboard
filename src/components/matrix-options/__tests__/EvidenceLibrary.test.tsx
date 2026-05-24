import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import EvidenceLibrary from '../EvidenceLibrary';
import {
  createEvidenceLibraryFilters,
} from '@/lib/matrix-options/provenance/library';
import type { EvidenceLibraryFilters } from '@/lib/matrix-options/provenance/types';

function renderControlled(initialFilters = createEvidenceLibraryFilters()) {
  let currentFilters: EvidenceLibraryFilters = initialFilters;
  const handleChange = vi.fn((nextFilters: EvidenceLibraryFilters) => {
    currentFilters = nextFilters;
    rerender(
      <EvidenceLibrary
        filters={currentFilters}
        onFiltersChange={handleChange}
      />,
    );
  });
  const { rerender } = render(
    <EvidenceLibrary filters={currentFilters} onFiltersChange={handleChange} />,
  );
  return { handleChange };
}

describe('EvidenceLibrary', () => {
  it('renders sources, values, equations, and conservative HH scaffolds', () => {
    renderControlled();

    expect(screen.getByTestId('references-values-tab')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^All$/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('evidence-library-value-groups')).toHaveTextContent(
      /Candidate values are read-only/,
    );
    expect(screen.getByTestId('evidence-library-value-groups')).toHaveTextContent(
      /Protocol 28/,
    );
    expect(screen.getByText(/Approved values/)).toBeInTheDocument();
    expect(screen.getByText(/Pending locators/)).toBeInTheDocument();
    expect(screen.getByTestId('evidence-library-quick-filters')).toHaveTextContent(
      /Protocol 28/,
    );
    expect(screen.getByTestId('evidence-library-quick-filters')).toHaveTextContent(
      /Derived preview only/,
    );
    expect(screen.getByTestId('evidence-library-value-groups')).toHaveTextContent(
      /Needs original-source verification/,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Benzo\[a\]pyrene log Kow/,
    );
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Review status/,
    );
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Current calculator scaffold only/,
    );
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /original source pending/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Equations$/ }));
    expect(screen.getByTestId('evidence-library-equations')).toHaveTextContent(
      /Human Health Direct Contact sediment screen/,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Sources$/ }));
    expect(screen.getByTestId('evidence-library-sources')).not.toHaveTextContent(
      /calculator scaffold/i,
    );
    expect(screen.getByTestId('evidence-library-sources')).toHaveTextContent(
      /Zotero link pending/,
    );
    expect(screen.getByTestId('evidence-library-sources')).toHaveTextContent(
      /policy compilation/i,
    );
    expect(screen.getByTestId('references-values-tab')).not.toHaveTextContent(
      /pending owner export/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getAllByText(/Arsenic oral RfD/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/current calculator scaffold/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /^Source Leads$/ }));
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /Source-of-sources or policy-compilation context only/i,
    );
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /Needs original-source verification/,
    );
  });

  it('applies source-review quick filters without promoting values', () => {
    renderControlled();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Health Canada: Approved alternatives/i,
      }),
    );

    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Health Canada/,
    );
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Approved alternative/,
    );
    expect(screen.getByText(/Evidence: approved source-backed/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Protocol 28: Policy compilation/i,
      }),
    );

    expect(screen.getByTestId('evidence-library-value-groups')).toHaveTextContent(
      /Protocol 28/,
    );
    expect(screen.getByTestId('evidence-library-value-groups')).toHaveTextContent(
      /Needs original-source verification/,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Eco-SSL: Screening\/source leads/i,
      }),
    );

    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /Eco-SSL/,
    );
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /Needs original-source verification/,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /SSD-derived: Derived preview/i,
      }),
    );

    expect(screen.getByText(/search: SSD/)).toBeInTheDocument();
    expect(screen.getByText(/Evidence: user-entered or derived/)).toBeInTheDocument();
    expect(screen.getByTestId('derived-preview-empty-state')).toHaveTextContent(
      /SSD-derived candidates are generated in the SSD Workbench receipt/i,
    );
  });

  it('filters to the human-health-food pathway', () => {
    const { handleChange } = renderControlled();

    fireEvent.change(screen.getByLabelText(/^Pathway$/), {
      target: { value: 'human-health-food' },
    });

    expect(handleChange).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getByText(/Aroclor 1254 freshwater BSAF for human food web/)).toBeInTheDocument();
    expect(screen.queryByText(/Benzo\[a\]pyrene log Kow/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Equations$/ }));
    expect(screen.getByTestId('evidence-library-equations')).toHaveTextContent(
      /Human Health Food Web sediment screen/,
    );
  });

  it('filters by species and jurisdiction, and keeps authority filters to evidence sources', () => {
    renderControlled();

    fireEvent.change(screen.getByLabelText(/^Species$/), {
      target: { value: 'fish or shellfish' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getAllByText(/Aroclor 1254 oral RfD/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Benzo\[a\]pyrene log Kow/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Jurisdiction$/), {
      target: { value: 'general' },
    });
    expect(screen.getAllByText(/Jurisdiction: general/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Current calculator scaffold only/,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Clear$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Sources$/ }));
    fireEvent.change(screen.getByLabelText(/^Authority$/), {
      target: { value: 'federal-guidance' },
    });
    expect(screen.getByText(/Authority: federal guidance/)).toBeInTheDocument();
    expect(screen.getByTestId('evidence-library-sources')).toHaveTextContent(
      /Health Canada|FCSAP|CCME/,
    );
  });

  it('shows extraction dates for source-backed Health Canada and IRIS TRVs', () => {
    renderControlled(
      createEvidenceLibraryFilters({
        pathways: ['human-health-food'],
        substanceKeys: ['benzo_a_pyrene'],
        evidenceSupportStatuses: ['approved_source_backed'],
      }),
    );

    expect(screen.getByTestId('evidence-library-value-groups')).toHaveTextContent(
      /Extracted/,
    );
    expect(screen.getByTestId('evidence-library-value-groups')).toHaveTextContent(
      /2026-05-23/,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Health Canada/,
    );
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /US EPA IRIS/,
    );
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Extracted 2026-05-23/,
    );
  });

  it('searches and clears active filters', () => {
    renderControlled();

    fireEvent.click(screen.getByRole('button', { name: /^Sources$/ }));
    fireEvent.change(screen.getByLabelText(/^Search$/), {
      target: { value: 'NIST' },
    });

    expect(screen.getByTestId('evidence-library-sources')).toHaveTextContent(
      /NIST\/SEMATECH e-Handbook/,
    );
    expect(screen.getByText(/search: NIST/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Clear$/ }));
    expect(screen.queryByText(/search: NIST/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getByText(/Benzo\[a\]pyrene log Kow/)).toBeInTheDocument();
  });

  it('shows assumption/default rows in the assumptions view', () => {
    renderControlled();

    fireEvent.click(screen.getByRole('button', { name: /^Assumptions$/ }));

    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Aroclor 1254 FCV/,
    );
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /current default/,
    );
  });

  it('shows grouped parameter candidates and source leads as read-only context', () => {
    renderControlled();

    fireEvent.click(screen.getByRole('button', { name: /^By Parameter$/ }));

    expect(screen.getByTestId('evidence-library-value-groups')).toHaveTextContent(
      /Candidate values are read-only/,
    );
    expect(screen.getByTestId('evidence-library-value-groups')).toHaveTextContent(
      /pending source locator/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Source Leads$/ }));

    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /ACFN WQCIU report/,
    );
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /BC Protocol 28 v3\.0/,
    );
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /policy compilation/i,
    );
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /underlying cited source as canonical/i,
    );
  });
});
