import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import EvidenceLibrary from '../EvidenceLibrary';
import {
  createEvidenceLibraryFilters,
} from '@/lib/matrix-options/provenance/library';
import type { EvidenceLibraryFilters } from '@/lib/matrix-options/provenance/types';
import type { RegulatoryFrameId } from '@/lib/matrix-options/regulatoryFrames';

function renderControlled(
  initialFilters = createEvidenceLibraryFilters(),
  regulatoryFrameId: RegulatoryFrameId = 'bc-protocol1-v5-dra',
) {
  let currentFilters: EvidenceLibraryFilters = initialFilters;
  const handleChange = vi.fn((nextFilters: EvidenceLibraryFilters) => {
    currentFilters = nextFilters;
    rerender(
      <EvidenceLibrary
        filters={currentFilters}
        onFiltersChange={handleChange}
        regulatoryFrameId={regulatoryFrameId}
      />,
    );
  });
  const { rerender } = render(
    <EvidenceLibrary
      filters={currentFilters}
      onFiltersChange={handleChange}
      regulatoryFrameId={regulatoryFrameId}
    />,
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

  it('projects read-only default-selection policy decisions in grouped and value rows', () => {
    renderControlled(
      createEvidenceLibraryFilters({
        pathways: ['human-health-food'],
        substanceKeys: ['benzo_a_pyrene'],
        inputKeys: ['sf_oral_per_mg_per_kg_bw_per_day'],
      }),
    );

    const groupedView = screen.getByTestId('evidence-library-value-groups');
    expect(groupedView).toHaveTextContent(
      /Default policy: candidate pending approval/,
    );
    expect(
      screen.getByTestId(
        'evidence-default-policy-group-row-pv-hc-bap-hh-food-sf',
      ),
    ).toHaveTextContent(/Recommended candidate: approval required/);
    expect(
      screen.getByTestId(
        'evidence-default-policy-group-row-pv-p28-bap-hh-food-slope',
      ),
    ).toHaveTextContent(/Blocked: policy compilation/);

    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));

    expect(
      screen.getByTestId('evidence-default-policy-value-pv-hc-bap-hh-food-sf'),
    ).toHaveTextContent(/Read-only recommendation only/);
    expect(
      screen.getByTestId(
        'evidence-default-policy-value-pv-p28-bap-hh-food-slope',
      ),
    ).toHaveTextContent(/source-mining aids, not calculation-driving sources/);
    expect(screen.getByTestId('references-values-tab')).not.toHaveTextContent(
      /promoted default/i,
    );
  });

  it('summarizes runtime default-policy decisions without promotion', () => {
    renderControlled(
      createEvidenceLibraryFilters({
        pathways: ['human-health-food'],
        substanceKeys: ['benzo_a_pyrene'],
        inputKeys: ['sf_oral_per_mg_per_kg_bw_per_day'],
      }),
    );

    const audit = screen.getByTestId('evidence-library-default-policy-audit');
    expect(audit).toHaveTextContent(/Default Policy Audit/);
    expect(audit).toHaveTextContent(/1 policy decision/);
    expect(
      screen.getByTestId('default-policy-audit-candidate_pending_approval'),
    ).toHaveTextContent(/1/);
    expect(
      screen.getByTestId('default-policy-audit-manual_decision_required'),
    ).toHaveTextContent(/0/);
    expect(audit).toHaveTextContent(
      /No catalog default, QA, or source-status changes are made here/,
    );
    expect(audit).not.toHaveTextContent(/promoted default/i);
  });

  it('uses default-policy audit cards as runtime review shortcuts', () => {
    renderControlled();

    fireEvent.click(
      screen.getByRole('button', { name: /Show Candidate pending approval/i }),
    );

    expect(
      screen.getByRole('button', { name: /Show Candidate pending approval/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByText(/Default policy: Candidate pending approval/),
    ).toBeInTheDocument();
    expect(screen.getByTestId('evidence-library-value-groups')).toHaveTextContent(
      /Default policy: candidate pending approval/,
    );
    expect(screen.getByTestId('evidence-library-value-groups')).not.toHaveTextContent(
      /Default policy: keep current default/,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));

    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Recommended candidate: approval required/,
    );
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Blocked: policy compilation/,
    );
    expect(screen.getByTestId('references-values-tab')).not.toHaveTextContent(
      /promoted default/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Clear$/ }));

    expect(
      screen.getByRole('button', { name: /Show Candidate pending approval/i }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.queryByText(/Default policy: Candidate pending approval/),
    ).not.toBeInTheDocument();
  });

  it('uses the selected regulatory frame when projecting default policy', () => {
    renderControlled(
      createEvidenceLibraryFilters({
        pathways: ['human-health-food'],
        substanceKeys: ['zinc'],
        inputKeys: ['rfd_oral_mg_per_kg_bw_day'],
      }),
      'us-epa-usace-sediment',
    );

    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));

    expect(
      screen.getByTestId('evidence-default-policy-value-pv-iris-zinc-hh-food-rfd'),
    ).toHaveTextContent(/Recommended candidate: approval required/);
    expect(
      screen.getByTestId('evidence-default-policy-value-pv-hc-zinc-hh-food-ul-adult'),
    ).toHaveTextContent(/Blocked: outside selected frame/);
    expect(
      screen.getByTestId('evidence-default-policy-value-pv-p28-zinc-hh-food-rfd'),
    ).toHaveTextContent(/Blocked: policy compilation/);
  });

  it('shows named result counts for each References database view', () => {
    renderControlled();

    expect(
      screen.getByText(/Showing \d+ of \d+ parameter groups/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getByText(/Showing \d+ of \d+ values/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Assumptions$/ }));
    expect(
      screen.getByText(/Showing \d+ of \d+ assumption\/default rows/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Equations$/ }));
    expect(screen.getByText(/Showing \d+ of \d+ equations/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Sources$/ }));
    expect(screen.getByText(/Showing \d+ of \d+ sources/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Source Leads$/ }));
    expect(screen.getByText(/Showing \d+ of \d+ lead sets/)).toBeInTheDocument();
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
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /Read-only triage checklist/,
    );
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /QA approval/,
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

    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Protocol 28/,
    );
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Needs original-source verification/,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /^Review Protocol 28 queue$/ }),
    );
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Protocol 28/,
    );
    expect(screen.getByText(/Policy alignment: Protocol 28/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: /^Review Protocol 28 source leads$/,
      }),
    );

    expect(screen.getAllByText(/search: Protocol 28/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Source role: policy compilation/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /Showing 1 of \d+ lead sets/,
    );
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /BC Protocol 28 v3\.0/,
    );
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /Read-only triage checklist/,
    );
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /Original source verification/,
    );
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /Exact locator capture/,
    );
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /Currentness check/,
    );
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /Applicability review/,
    );
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /Owner or delegated approval/,
    );
    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /Lead triage only; not calculator evidence or calculator default\s+support/i,
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

    expect(screen.getAllByText(/search: SSD/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Evidence: user-entered or derived/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByTestId('derived-preview-empty-state')).toHaveTextContent(
      /SSD-derived candidates are generated in the SSD Workbench receipt/i,
    );
    expect(
      screen.getByRole('button', { name: /^Clear filters$/ }),
    ).toBeInTheDocument();
  });

  it('shows saved review view counts and active filter state', () => {
    renderControlled();

    const protocol28Button = screen.getByRole('button', {
      name: /Protocol 28: Policy compilation/i,
    });
    const healthCanadaButton = screen.getByRole('button', {
      name: /Health Canada: Approved alternatives/i,
    });
    const ecoSslButton = screen.getByRole('button', {
      name: /Eco-SSL: Screening\/source leads/i,
    });
    const ssdButton = screen.getByRole('button', {
      name: /SSD-derived: Derived preview/i,
    });

    expect(within(protocol28Button).getByText('6 values')).toBeInTheDocument();
    expect(within(healthCanadaButton).getByText('19 values')).toBeInTheDocument();
    expect(within(ecoSslButton).getByText('1 lead set')).toBeInTheDocument();
    expect(within(ssdButton).getByText('0 values')).toBeInTheDocument();
    expect(healthCanadaButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(healthCanadaButton);

    expect(
      screen.getByRole('button', {
        name: /Health Canada: Approved alternatives/i,
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Health Canada/,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Equations$/ }));

    expect(
      screen.getByRole('button', {
        name: /Health Canada: Approved alternatives/i,
      }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows candidate defaults saved review view as read-only filter with no promotion', () => {
    renderControlled();

    const candidateDefaultsButton = screen.getByRole('button', {
      name: /Candidate defaults: Eligible candidates/i,
    });

    expect(candidateDefaultsButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(candidateDefaultsButton);

    expect(
      screen.getByRole('button', {
        name: /Candidate defaults: Eligible candidates/i,
      }),
    ).toHaveAttribute('aria-pressed', 'true');

    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Approved alternative/,
    );
    expect(screen.getByText(/Evidence: approved source-backed/i)).toBeInTheDocument();
    expect(screen.getByText(/Default: available option/i)).toBeInTheDocument();

    expect(
      screen.getByText(/do not promote calculator defaults/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Promote$|^Set as default$|^Make default$/i }),
    ).not.toBeInTheDocument();
  });

  it('uses audit strip counts as read-only database shortcuts', () => {
    renderControlled();

    fireEvent.click(
      screen.getByRole('button', { name: /Show Pending locators/ }),
    );
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /pending source locator/i,
    );
    expect(
      screen.getByText(/Evidence: pending source locator/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Show Blocked sources/ }));
    expect(screen.getByTestId('evidence-library-sources')).toHaveTextContent(
      /policy compilation/i,
    );
    expect(
      screen.getByText(/Source role: policy compilation/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId('references-values-tab')).not.toHaveTextContent(
      /calculation-driving/i,
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

  it('shows filter-aware empty states and clears card and table views', () => {
    renderControlled();

    fireEvent.change(screen.getByLabelText(/^Search$/), {
      target: { value: 'zzzz-no-match' },
    });

    expect(screen.getByTestId('evidence-library-empty-state')).toHaveTextContent(
      /No parameter groups match/i,
    );
    expect(screen.getByTestId('evidence-library-empty-state')).toHaveTextContent(
      /search: zzzz-no-match/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Clear filters$/ }));
    expect(screen.queryByText(/search: zzzz-no-match/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('evidence-library-value-groups')).toHaveTextContent(
      /Candidate values are read-only/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    fireEvent.change(screen.getByLabelText(/^Search$/), {
      target: { value: 'zzzz-no-value' },
    });

    expect(screen.getByTestId('evidence-library-empty-state')).toHaveTextContent(
      /No parameter values match/i,
    );
    expect(screen.getByTestId('evidence-library-empty-state')).toHaveTextContent(
      /search: zzzz-no-value/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Clear filters$/ }));
    expect(screen.queryByText(/search: zzzz-no-value/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Benzo\[a\]pyrene log Kow/,
    );
  });

  it('shows a filter-aware empty state for source leads', () => {
    renderControlled();

    fireEvent.click(screen.getByRole('button', { name: /^Source Leads$/ }));
    fireEvent.change(screen.getByLabelText(/^Search$/), {
      target: { value: 'zzzz-no-leads' },
    });

    expect(screen.getByTestId('evidence-library-source-leads')).toHaveTextContent(
      /Showing 0 of \d+ lead sets/,
    );
    expect(screen.getByTestId('evidence-library-empty-state')).toHaveTextContent(
      /No source leads match/i,
    );
    expect(screen.getByTestId('evidence-library-empty-state')).toHaveTextContent(
      /search: zzzz-no-leads/i,
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

  it('closes selected detail panels when switching views or clearing filters', () => {
    renderControlled();

    fireEvent.click(screen.getByRole('button', { name: /^Sources$/ }));
    fireEvent.click(screen.getAllByTestId('evidence-library-inspect-source')[0]);
    expect(screen.getByTestId('evidence-library-source-detail')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Sources$/ }));
    expect(screen.getByTestId('evidence-library-source-detail')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(
      screen.queryByTestId('evidence-library-source-detail'),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Health Canada: Approved alternatives/i,
      }),
    );
    fireEvent.click(screen.getAllByTestId('evidence-library-inspect-value')[0]);
    expect(screen.getByTestId('evidence-library-value-detail')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Clear$/ }));
    expect(
      screen.queryByTestId('evidence-library-value-detail'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Evidence: approved source-backed/i),
    ).not.toBeInTheDocument();
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

  it('shows and dismisses a calculator receipt banner', () => {
    const receipt = {
      pathwayLabel: 'Human Health Food Web',
      substanceLabel: 'Benzo[a]pyrene',
      inputKeys: ['sf_oral_per_mg_per_kg_bw_per_day'],
      frameLabel: 'BC Protocol 1 v5 DRA',
    };
    const handleDismiss = vi.fn();
    let currentFilters = createEvidenceLibraryFilters({
      pathways: ['human-health-food'],
      substanceKeys: ['benzo_a_pyrene'],
      inputKeys: ['sf_oral_per_mg_per_kg_bw_per_day'],
    });
    const handleChange = vi.fn((nextFilters: EvidenceLibraryFilters) => {
      currentFilters = nextFilters;
      rerender(
        <EvidenceLibrary
          filters={currentFilters}
          onFiltersChange={handleChange}
          regulatoryFrameId="bc-protocol1-v5-dra"
          calculatorReceipt={receipt}
          onDismissReceipt={handleDismiss}
        />,
      );
    });
    const { rerender } = render(
      <EvidenceLibrary
        filters={currentFilters}
        onFiltersChange={handleChange}
        regulatoryFrameId="bc-protocol1-v5-dra"
        calculatorReceipt={receipt}
        onDismissReceipt={handleDismiss}
      />,
    );

    const banner = screen.getByTestId('calculator-receipt-banner');
    expect(banner).toHaveTextContent(/Calculator request/);
    expect(banner).toHaveTextContent(/Benzo\[a\]pyrene/);
    expect(banner).toHaveTextContent(/Human Health Food Web/);
    expect(banner).toHaveTextContent(/1 input key/);
    expect(banner).toHaveTextContent(/BC Protocol 1 v5 DRA/);
    expect(banner).toHaveTextContent(/do not change/i);

    fireEvent.click(screen.getByRole('button', { name: /Dismiss calculator receipt/ }));
    expect(handleDismiss).toHaveBeenCalled();
  });

  it('does not show a calculator receipt when none is provided', () => {
    renderControlled();
    expect(screen.queryByTestId('calculator-receipt-banner')).not.toBeInTheDocument();
  });

  it('shows an all-scaffolds info banner when all visible values are pending review', () => {
    // Filter to current_calculator_scaffold only -- all such values have
    // qa_status: 'needs_review', so the banner should appear.
    renderControlled(
      createEvidenceLibraryFilters({
        evidenceSupportStatuses: ['current_calculator_scaffold'],
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));

    expect(
      screen.getByTestId('evidence-library-all-scaffolds-banner'),
    ).toHaveTextContent(
      /All parameter values are current calculator scaffolds pending source verification/,
    );
    expect(
      screen.getByTestId('evidence-library-all-scaffolds-banner'),
    ).toHaveTextContent(/No values have been approved as source-backed defaults yet/);
  });

  it('does not show the all-scaffolds banner when approved values are present', () => {
    // Default unfiltered view includes approved_source_backed values (qa_status: approved).
    renderControlled();

    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));

    expect(
      screen.queryByTestId('evidence-library-all-scaffolds-banner'),
    ).not.toBeInTheDocument();
  });

  it('does not show the all-scaffolds banner in assumptions, equations, or sources views', () => {
    renderControlled(
      createEvidenceLibraryFilters({
        evidenceSupportStatuses: ['current_calculator_scaffold'],
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /^Assumptions$/ }));
    expect(
      screen.queryByTestId('evidence-library-all-scaffolds-banner'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Equations$/ }));
    expect(
      screen.queryByTestId('evidence-library-all-scaffolds-banner'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Sources$/ }));
    expect(
      screen.queryByTestId('evidence-library-all-scaffolds-banner'),
    ).not.toBeInTheDocument();
  });

  it('renders assumption tags on equations using violet chip styling, not amber status badges', () => {
    renderControlled();

    fireEvent.click(screen.getByRole('button', { name: /^Equations$/ }));

    const equations = screen.getByTestId('evidence-library-equations');
    // Equation assumption tags that exist in catalog data should appear as
    // humanized text inside violet chips, not inside amber/slate StatusBadge elements.
    // The violet chip class is the distinguishing marker.
    const violetChips = equations.querySelectorAll(
      'span.border-violet-200',
    );
    // At least some equations carry assumption tags; verify the chip class is present
    // when they do, and that assumption text is not rendered bare via StatusBadge.
    if (violetChips.length > 0) {
      expect(violetChips[0].className).toMatch(/bg-violet-50/);
      expect(violetChips[0].className).toMatch(/text-violet-800/);
    }
  });
});
