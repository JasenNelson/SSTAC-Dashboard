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
  it('renders the References & Values overview and conservative scaffolds', () => {
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
    expect(screen.getByTestId('evidence-library-audit-strip')).toHaveTextContent(
      /Current defaults/,
    );
    expect(screen.getByTestId('evidence-library-audit-strip')).toHaveTextContent(
      /Zotero linked/,
    );
    expect(screen.getByTestId('evidence-library-audit-strip')).toHaveTextContent(
      /Blocked sources/,
    );
    expect(screen.getByTestId('evidence-library-audit-strip')).not.toHaveTextContent(
      /pending owner export/i,
    );
    expect(screen.getByTestId('evidence-library-quick-filters')).toHaveTextContent(
      /Protocol 28/,
    );
    expect(screen.getByTestId('evidence-library-quick-filters')).toHaveTextContent(
      /Derived preview only/,
    );
    expect(screen.getByTestId('protocol28-review-panel')).toHaveTextContent(
      /Policy compilation leads stay blocked from defaults/,
    );
    expect(screen.getByTestId('protocol28-review-panel')).toHaveTextContent(
      /Calculation defaults\s*0/,
    );
    expect(screen.getByTestId('evidence-library-value-groups')).toHaveTextContent(
      /Needs original-source verification/,
    );
  });

  it('renders value and equation database views', () => {
    renderControlled();

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
  });

  it('renders source and source-lead views without promoting scaffolds', () => {
    renderControlled();

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
      screen.getByRole('button', { name: /^Review Protocol 28 queue$/ }),
    );
    expect(screen.getByText(/Policy alignment: Protocol 28/i)).toBeInTheDocument();

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

  it('opens a selected value detail panel from the values database view', () => {
    renderControlled();

    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    fireEvent.click(screen.getAllByTestId('evidence-library-inspect-value')[0]);

    expect(screen.getByTestId('evidence-library-value-detail')).toHaveTextContent(
      /Selected value/,
    );
    expect(screen.getByTestId('evidence-library-value-detail')).toHaveTextContent(
      /Provenance chain/,
    );
    expect(screen.getByTestId('evidence-library-value-detail')).toHaveTextContent(
      /Applicability/,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Close$/ }));
    expect(
      screen.queryByTestId('evidence-library-value-detail'),
    ).not.toBeInTheDocument();
  });

  it('opens a selected source detail panel from the sources database view', () => {
    renderControlled();

    fireEvent.click(screen.getByRole('button', { name: /^Sources$/ }));
    fireEvent.click(screen.getAllByTestId('evidence-library-inspect-source')[0]);

    const panel = screen.getByTestId('evidence-library-source-detail');
    expect(panel).toHaveTextContent(/Selected source/);
    expect(panel).toHaveTextContent(/Locator and catalog links/);
    expect(panel).toHaveTextContent(/calculator defaults/i);
    expect(panel).toHaveTextContent(/File storage/);

    fireEvent.click(screen.getByRole('button', { name: /^Close$/ }));
    expect(
      screen.queryByTestId('evidence-library-source-detail'),
    ).not.toBeInTheDocument();
  });

  it('keeps Protocol 28 source detail blocked from calculator defaults', () => {
    renderControlled();

    fireEvent.click(screen.getByRole('button', { name: /^Sources$/ }));
    fireEvent.click(
      screen.getByRole('button', {
        name: /Inspect BC Protocol 28 v3\.0, 2024/,
      }),
    );

    const panel = screen.getByTestId('evidence-library-source-detail');
    expect(panel).toHaveTextContent(/BC Protocol 28 v3\.0, 2024/);
    expect(panel).toHaveTextContent(/policy compilation/i);
    expect(panel).toHaveTextContent(/Blocked from calculator defaults/);
    expect(panel).toHaveTextContent(/Do not treat Protocol 28/i);
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
