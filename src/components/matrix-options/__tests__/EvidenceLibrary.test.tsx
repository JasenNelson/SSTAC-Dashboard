import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as savedViewsSync from '@/lib/matrix-options/provenance/saved-views-sync';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import EvidenceLibrary from '../EvidenceLibrary';
import {
  createEvidenceLibraryFilters,
} from '@/lib/matrix-options/provenance/library';
import type { EvidenceLibraryFilters } from '@/lib/matrix-options/provenance/types';
import type { RegulatoryFrameId } from '@/lib/matrix-options/regulatoryFrames';

// ---------------------------------------------------------------------------
// Module mocks for admin-gated evidence locator tests
// ---------------------------------------------------------------------------

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
  const actual = await importOriginal<typeof import('@/lib/matrix-options/provenance/promotion')>();
  return {
    ...actual,
    promoteSourceLead: vi.fn().mockResolvedValue(null),
  };
});

// Saved-views Supabase sync (P2-3). Default to signed-out/local mode so existing tests
// exercise the localStorage fallback path deterministically; individual tests override.
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

// Filters now live behind a "Filters" popover button. These helpers open it (idempotently)
// before poking a dropdown, and clear via the popover's "Clear all".
function ensureFiltersOpen() {
  if (!screen.queryByTestId('evidence-library-filter-popover')) {
    fireEvent.click(screen.getByTestId('evidence-library-filter-button'));
  }
}
function clearAllFilters() {
  ensureFiltersOpen();
  fireEvent.click(screen.getByRole('button', { name: /Clear all/ }));
}

describe('EvidenceLibrary', () => {
  it('renders the References & Values overview defaulting to the Values table', () => {
    renderControlled();

    expect(screen.getByTestId('references-values-tab')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^All$/ }),
    ).not.toBeInTheDocument();
    // By Parameter / Equations / Source Leads / Assumptions tabs were retired; only the
    // Values (default) and Sources tabs remain.
    expect(screen.queryByRole('button', { name: /^By Parameter$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Equations$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Source Leads$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Assumptions$/ })).not.toBeInTheDocument();
    // Defaults to the Values table.
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Benzo\[a\]pyrene log Kow/,
    );
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Needs original-source verification/,
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
    // The hardcoded seed-era quick filters were replaced by user-saved views.
    expect(screen.getByTestId('evidence-library-saved-views')).toHaveTextContent(
      /Saved views/,
    );
    expect(screen.getByTestId('evidence-library-saved-views')).toHaveTextContent(
      /No saved views yet/,
    );
    expect(screen.getByTestId('protocol28-review-panel')).toHaveTextContent(
      /Policy compilation leads stay blocked from defaults/,
    );
    expect(screen.getByTestId('protocol28-review-panel')).toHaveTextContent(
      /Calculation defaults\s*0/,
    );
  });

  it('renders the values database view by default', () => {
    renderControlled();

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
  });

  it('projects read-only default-selection policy decisions in value rows', () => {
    renderControlled(
      createEvidenceLibraryFilters({
        pathways: ['human-health-food'],
        substanceKeys: ['benzo_a_pyrene'],
        inputKeys: ['sf_oral_per_mg_per_kg_bw_per_day'],
      }),
    );

    // Values is the default view; the read-only policy dispositions render per value row.
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
    // The audit card filters the Values table (the default view) -- no grouped view anymore.
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Recommended candidate: approval required/,
    );
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Blocked: policy compilation/,
    );
    expect(screen.getByTestId('references-values-tab')).not.toHaveTextContent(
      /promoted default/i,
    );

    clearAllFilters();

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

  it('shows named result counts for the Values and Sources views', () => {
    renderControlled();

    // Defaults to Values.
    expect(screen.getByText(/Showing \d+ of \d+ values/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^References$/ }));
    expect(screen.getByText(/Showing \d+ of \d+ sources/)).toBeInTheDocument();
    // Source leads now fold into the Sources view, so their lead-set count shows here too.
    expect(screen.getByText(/Showing \d+ of \d+ lead sets/)).toBeInTheDocument();
  });

  it('renders sources with folded-in source leads, without promoting scaffolds', () => {
    renderControlled();

    fireEvent.click(screen.getByRole('button', { name: /^References$/ }));
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

    // Source-of-sources leads now fold into the Sources view (no standalone tab).
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

    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getAllByText(/Arsenic oral RfD/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/current calculator scaffold/i).length).toBeGreaterThan(0);
  });

  it('opens the Protocol 28 review queue and source leads without promoting values', () => {
    renderControlled();

    // The Protocol 28 review-queue buttons live in the demoted "Catalog status & admin"
    // section of the right panel (still in the DOM in jsdom).
    fireEvent.click(
      screen.getByRole('button', { name: /^Review Protocol 28 queue$/ }),
    );
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Protocol 28/,
    );
    expect(screen.getByText(/Policy alignment: Protocol 28/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /^Review Protocol 28 source leads$/ }),
    );
    expect(screen.getAllByText(/search: Protocol 28/i).length).toBeGreaterThan(0);
    const leads = screen.getByTestId('evidence-library-source-leads');
    expect(leads).toHaveTextContent(/Showing 1 of \d+ lead sets/);
    expect(leads).toHaveTextContent(/BC Protocol 28 v3\.0/);
    expect(leads).toHaveTextContent(/Read-only triage checklist/);
    expect(leads).toHaveTextContent(/Original source verification/);
    expect(leads).toHaveTextContent(/Owner or delegated approval/);
  });

  it('saves the current filters as a named view, then deletes it', () => {
    // Start from a clean saved-views store so the assertions are deterministic.
    window.localStorage.clear();
    renderControlled();

    expect(screen.getByTestId('evidence-library-saved-views')).toHaveTextContent(
      /No saved views yet/,
    );

    // Set a filter, then save the current view under a name.
    ensureFiltersOpen();
    fireEvent.change(screen.getByLabelText(/^Substance$/), {
      target: { value: 'benzo_a_pyrene' },
    });
    fireEvent.click(screen.getByTestId('evidence-library-save-view-button'));
    fireEvent.change(screen.getByTestId('evidence-library-save-view-input'), {
      target: { value: 'My BaP view' },
    });
    fireEvent.click(screen.getByTestId('evidence-library-save-view-confirm'));

    const saved = screen.getByTestId('evidence-library-saved-views');
    expect(saved).toHaveTextContent(/My BaP view/);
    expect(saved).not.toHaveTextContent(/No saved views yet/);

    // Delete it -> back to the empty state.
    fireEvent.click(
      screen.getByRole('button', { name: /Delete saved view My BaP view/ }),
    );
    expect(screen.getByTestId('evidence-library-saved-views')).toHaveTextContent(
      /No saved views yet/,
    );
    window.localStorage.clear();
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

    ensureFiltersOpen();
    fireEvent.change(screen.getByLabelText(/^Pathway$/), {
      target: { value: 'human-health-food' },
    });

    expect(handleChange).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getByText(/Aroclor 1254 freshwater BSAF for human food web/)).toBeInTheDocument();
    expect(screen.queryByText(/Benzo\[a\]pyrene log Kow/)).not.toBeInTheDocument();
  });

  it('filters by jurisdiction, and keeps authority filters to evidence sources', () => {
    renderControlled();

    ensureFiltersOpen();
    fireEvent.change(screen.getByLabelText(/^Jurisdiction$/), {
      target: { value: 'general' },
    });
    expect(screen.getAllByText(/Jurisdiction: general/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Current calculator scaffold only/,
    );

    clearAllFilters();
    fireEvent.click(screen.getByRole('button', { name: /^References$/ }));
    // Switching to the References (sources) view keeps the popover open; its filter set is
    // now the source filters, so the Authority dropdown is present.
    ensureFiltersOpen();
    fireEvent.change(screen.getByLabelText(/^Authority$/), {
      target: { value: 'federal-guidance' },
    });
    expect(screen.getByText(/Authority: federal guidance/)).toBeInTheDocument();
    expect(screen.getByTestId('evidence-library-sources')).toHaveTextContent(
      /Health Canada|FCSAP|CCME/,
    );
  });

  it('shows a filter-aware empty state and clears the Values table', () => {
    renderControlled();

    // Defaults to the Values table.
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

  it('shows a filter-aware empty state for source leads within the Sources view', () => {
    renderControlled();

    fireEvent.click(screen.getByRole('button', { name: /^References$/ }));
    fireEvent.change(screen.getByLabelText(/^Search$/), {
      target: { value: 'zzzz-no-leads' },
    });

    const leads = screen.getByTestId('evidence-library-source-leads');
    expect(leads).toHaveTextContent(/Showing 0 of \d+ lead sets/);
    expect(leads).toHaveTextContent(/No source leads match/i);
    expect(leads).toHaveTextContent(/search: zzzz-no-leads/i);
  });

  it('shows extraction dates for source-backed Health Canada and IRIS TRVs', () => {
    renderControlled(
      createEvidenceLibraryFilters({
        pathways: ['human-health-food'],
        substanceKeys: ['benzo_a_pyrene'],
        evidenceSupportStatuses: ['approved_source_backed'],
      }),
    );

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

    fireEvent.click(screen.getByRole('button', { name: /^References$/ }));
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

    fireEvent.click(screen.getByRole('button', { name: /^References$/ }));
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

    fireEvent.click(screen.getByRole('button', { name: /^References$/ }));
    fireEvent.click(screen.getAllByTestId('evidence-library-inspect-source')[0]);
    expect(screen.getByTestId('evidence-library-source-detail')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^References$/ }));
    expect(screen.getByTestId('evidence-library-source-detail')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(
      screen.queryByTestId('evidence-library-source-detail'),
    ).not.toBeInTheDocument();

    // Inspecting a value then clearing the filters should also close the detail panel.
    fireEvent.click(screen.getAllByTestId('evidence-library-inspect-value')[0]);
    expect(screen.getByTestId('evidence-library-value-detail')).toBeInTheDocument();

    clearAllFilters();
    expect(
      screen.queryByTestId('evidence-library-value-detail'),
    ).not.toBeInTheDocument();
  });

  it('searches and clears active filters', () => {
    renderControlled();

    fireEvent.click(screen.getByRole('button', { name: /^References$/ }));
    fireEvent.change(screen.getByLabelText(/^Search$/), {
      target: { value: 'NIST' },
    });

    expect(screen.getByTestId('evidence-library-sources')).toHaveTextContent(
      /NIST\/SEMATECH e-Handbook/,
    );
    // The active "search: NIST" label can appear in more than one folded sub-section
    // (sources + source-leads) under the Sources view.
    expect(screen.getAllByText(/search: NIST/).length).toBeGreaterThan(0);

    clearAllFilters();
    expect(screen.queryAllByText(/search: NIST/)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getByText(/Benzo\[a\]pyrene log Kow/)).toBeInTheDocument();
  });

  it('shows source leads as read-only context within the Sources view', () => {
    renderControlled();

    fireEvent.click(screen.getByRole('button', { name: /^References$/ }));

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
      /All visible parameter values are current calculator scaffolds pending/,
    );
    expect(
      screen.getByTestId('evidence-library-all-scaffolds-banner'),
    ).toHaveTextContent(/Adjust filters to check for approved source-backed defaults/);
  });

  it('does not show the all-scaffolds banner when approved values are present', () => {
    // Default unfiltered view includes approved_source_backed values (qa_status: approved).
    renderControlled();

    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));

    expect(
      screen.queryByTestId('evidence-library-all-scaffolds-banner'),
    ).not.toBeInTheDocument();
  });

  it('does not show the all-scaffolds banner in the Sources view', () => {
    renderControlled(
      createEvidenceLibraryFilters({
        evidenceSupportStatuses: ['current_calculator_scaffold'],
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /^References$/ }));
    expect(
      screen.queryByTestId('evidence-library-all-scaffolds-banner'),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Evidence locator UI tests (Phase 4a)
// ---------------------------------------------------------------------------

describe('EvidenceLibrary -- AddEvidenceLocatorForm', () => {
  it('does not show add-evidence-locator button in detail panel for non-admin users', async () => {
    // Mock returns false by default -- non-admin
    const { checkCurrentUserAdminStatus } = await import('@/lib/admin-utils');
    vi.mocked(checkCurrentUserAdminStatus).mockResolvedValue(false);

    renderControlled();
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    fireEvent.click(screen.getAllByTestId('evidence-library-inspect-value')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('evidence-library-value-detail')).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId('add-evidence-locator-button'),
    ).not.toBeInTheDocument();
  });

  it('shows add-evidence-locator button in detail panel for admin users', async () => {
    const { checkCurrentUserAdminStatus } = await import('@/lib/admin-utils');
    vi.mocked(checkCurrentUserAdminStatus).mockResolvedValue(true);

    renderControlled();
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    fireEvent.click(screen.getAllByTestId('evidence-library-inspect-value')[0]);

    await waitFor(() => {
      expect(screen.queryByTestId('add-evidence-locator-button')).toBeInTheDocument();
    });

    // Cleanup: restore to non-admin for subsequent tests
    vi.mocked(checkCurrentUserAdminStatus).mockResolvedValue(false);
  });

  it('shows and hides the evidence locator form', async () => {
    const { checkCurrentUserAdminStatus } = await import('@/lib/admin-utils');
    vi.mocked(checkCurrentUserAdminStatus).mockResolvedValue(true);

    renderControlled();
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    fireEvent.click(screen.getAllByTestId('evidence-library-inspect-value')[0]);

    await waitFor(() => {
      expect(screen.queryByTestId('add-evidence-locator-button')).toBeInTheDocument();
    });

    // Open the form
    fireEvent.click(screen.getByTestId('add-evidence-locator-button'));
    expect(screen.getByTestId('add-evidence-locator-form')).toBeInTheDocument();
    expect(screen.getByTestId('evidence-source-select')).toBeInTheDocument();
    expect(screen.getByTestId('evidence-locator-input')).toBeInTheDocument();
    expect(screen.getByTestId('evidence-locator-submit')).toBeInTheDocument();

    // Submit button disabled when fields empty
    expect(screen.getByTestId('evidence-locator-submit')).toBeDisabled();

    // Cancel hides the form
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(
      screen.queryByTestId('add-evidence-locator-form'),
    ).not.toBeInTheDocument();

    vi.mocked(checkCurrentUserAdminStatus).mockResolvedValue(false);
  });

  it('enables submit button when source and locator are filled', async () => {
    const { checkCurrentUserAdminStatus } = await import('@/lib/admin-utils');
    vi.mocked(checkCurrentUserAdminStatus).mockResolvedValue(true);

    renderControlled();
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    fireEvent.click(screen.getAllByTestId('evidence-library-inspect-value')[0]);

    await waitFor(() => {
      expect(screen.queryByTestId('add-evidence-locator-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-evidence-locator-button'));

    // Source select and locator input are empty -- submit disabled
    expect(screen.getByTestId('evidence-locator-submit')).toBeDisabled();

    // Fill in the locator field only -- still disabled (no source)
    fireEvent.change(screen.getByTestId('evidence-locator-input'), {
      target: { value: 'Table 3-1, p. 45' },
    });
    expect(screen.getByTestId('evidence-locator-submit')).toBeDisabled();

    // Select a source from the dropdown (first non-empty option)
    const sourceSelect = screen.getByTestId('evidence-source-select');
    const options = within(sourceSelect).getAllByRole('option');
    // options[0] is the empty placeholder; pick the first real source
    const firstSourceOption = options.find((o) => (o as HTMLOptionElement).value !== '');
    if (firstSourceOption) {
      fireEvent.change(sourceSelect, {
        target: { value: (firstSourceOption as HTMLOptionElement).value },
      });
    }

    // Both filled -- submit enabled
    expect(screen.getByTestId('evidence-locator-submit')).not.toBeDisabled();

    vi.mocked(checkCurrentUserAdminStatus).mockResolvedValue(false);
  });

  it('calls submitEvidenceItem and hides form on successful save', async () => {
    const { checkCurrentUserAdminStatus } = await import('@/lib/admin-utils');
    const { submitEvidenceItem } = await import('@/lib/matrix-options/provenance/evidence-sync');
    vi.mocked(checkCurrentUserAdminStatus).mockResolvedValue(true);
    vi.mocked(submitEvidenceItem).mockResolvedValue(true);

    renderControlled();
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    fireEvent.click(screen.getAllByTestId('evidence-library-inspect-value')[0]);

    await waitFor(() => {
      expect(screen.queryByTestId('add-evidence-locator-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-evidence-locator-button'));

    // Fill required fields
    fireEvent.change(screen.getByTestId('evidence-locator-input'), {
      target: { value: 'p. 12' },
    });
    const sourceSelect = screen.getByTestId('evidence-source-select');
    const options = within(sourceSelect).getAllByRole('option');
    const firstSource = options.find((o) => (o as HTMLOptionElement).value !== '');
    if (firstSource) {
      fireEvent.change(sourceSelect, {
        target: { value: (firstSource as HTMLOptionElement).value },
      });
    }

    fireEvent.click(screen.getByTestId('evidence-locator-submit'));

    await waitFor(() => {
      expect(submitEvidenceItem).toHaveBeenCalled();
      expect(
        screen.queryByTestId('add-evidence-locator-form'),
      ).not.toBeInTheDocument();
    });

    // Restore
    vi.mocked(checkCurrentUserAdminStatus).mockResolvedValue(false);
    vi.mocked(submitEvidenceItem).mockResolvedValue(false);
  });

  it('shows HITL-added evidence items from Supabase in the detail panel', async () => {
    const { checkCurrentUserAdminStatus } = await import('@/lib/admin-utils');
    const { fetchEvidenceItems } = await import('@/lib/matrix-options/provenance/evidence-sync');
    vi.mocked(checkCurrentUserAdminStatus).mockResolvedValue(true);
    vi.mocked(fetchEvidenceItems).mockResolvedValue([
      {
        id: 'ei-test-1',
        parameter_value_id: 'pv-test',
        source_id: 'src-test',
        locator: 'Table A-5, p. 88',
        locator_type: 'source_table',
        value_text: '0.014 ug/L',
        extraction_method: 'hitl_manual',
        extracted_by: 'user-id-1',
        qa_status: 'needs_review',
        note: 'cross-checked with appendix',
        created_at: '2026-05-27T10:00:00Z',
        created_by: 'user-id-1',
        updated_at: '2026-05-27T10:00:00Z',
      },
    ]);

    renderControlled();
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    fireEvent.click(screen.getAllByTestId('evidence-library-inspect-value')[0]);

    await waitFor(() => {
      expect(screen.queryByTestId('supabase-evidence-items')).toBeInTheDocument();
    });

    const hitlItems = screen.getByTestId('supabase-evidence-items');
    expect(hitlItems).toHaveTextContent(/Table A-5, p. 88/);
    expect(hitlItems).toHaveTextContent(/0.014 ug\/L/);
    expect(hitlItems).toHaveTextContent(/HITL-added locators/);

    // Restore
    vi.mocked(checkCurrentUserAdminStatus).mockResolvedValue(false);
    vi.mocked(fetchEvidenceItems).mockResolvedValue([]);
  });
});

describe('EvidenceLibrary panel rebalance', () => {
  it('puts the filter grid in the left panel and the status dashboard in the right panel at rest', () => {
    renderControlled();

    expect(screen.getByTestId('evidence-library-filters')).toBeInTheDocument();
    // Filters live behind the popover button now; open it to reach the Pathway dropdown.
    expect(screen.getByTestId('evidence-library-filter-button')).toBeInTheDocument();
    ensureFiltersOpen();
    expect(screen.getByLabelText(/^Pathway$/)).toBeInTheDocument();

    expect(screen.getByTestId('evidence-library-right-mode')).toHaveTextContent(
      'Catalog Dashboard',
    );
    const dashboard = screen.getByTestId('evidence-library-right-dashboard');
    expect(
      within(dashboard).getByTestId('evidence-library-audit-strip'),
    ).toBeInTheDocument();
    expect(
      within(dashboard).getByTestId('protocol28-review-panel'),
    ).toBeInTheDocument();
  });

  it('swaps the right dashboard for the inspector on row select and returns via Dashboard', () => {
    renderControlled();

    fireEvent.click(screen.getAllByTestId('evidence-library-inspect-value')[0]);

    expect(
      screen.queryByTestId('evidence-library-right-dashboard'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('evidence-library-right-mode')).toHaveTextContent(
      'Inspecting value',
    );
    expect(screen.getByTestId('evidence-library-value-detail')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Back to catalog dashboard/ }),
    );
    expect(
      screen.getByTestId('evidence-library-right-dashboard'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('evidence-library-value-detail'),
    ).not.toBeInTheDocument();
  });
});

describe('EvidenceLibrary filter popover + inventory', () => {
  it('collapses filters behind a button; primary filters shown when open, removed ones absent', () => {
    renderControlled();

    // Dropdowns are hidden until the popover is opened.
    expect(screen.queryByLabelText(/^Substance$/)).not.toBeInTheDocument();
    expect(screen.getByTestId('evidence-library-filter-button')).toBeInTheDocument();

    ensureFiltersOpen();
    expect(screen.getByLabelText(/^Substance$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Pathway$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Parameter$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Jurisdiction$/)).toBeInTheDocument();

    // The retired workflow/scaffold filters (and the old "Input" label) are gone.
    expect(screen.queryByLabelText(/^Evidence$/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^QA$/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Species$/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Input$/)).not.toBeInTheDocument();
  });

  it('shows the catalog inventory at rest with status/admin demoted to a collapsed section', () => {
    renderControlled();

    const inventory = screen.getByTestId('evidence-library-inventory');
    expect(inventory).toHaveTextContent(/Catalog inventory/);
    expect(inventory).toHaveTextContent(/Substances/);
    expect(inventory).toHaveTextContent(/Values/);

    // The audit/QA/admin panels are preserved but demoted into a collapsed section.
    expect(
      screen.getByTestId('evidence-library-status-admin'),
    ).toBeInTheDocument();
  });
});

describe('EvidenceLibrary right-panel resize', () => {
  const RIGHT_WIDTH_KEY = 'matrix-options-references-right-width-v1';

  beforeEach(() => {
    window.localStorage.clear();
    // jsdom defaults innerWidth to 1024, which would clamp the 384 default down to 344
    // (1024 - 320 left rail - 360 min center). Widen the viewport so the budget does not
    // shrink the panel and the drag/clamp assertions are deterministic.
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1600,
    });
  });

  function renderLibrary(
    props: Partial<React.ComponentProps<typeof EvidenceLibrary>> = {},
  ) {
    return render(
      <EvidenceLibrary
        filters={createEvidenceLibraryFilters()}
        onFiltersChange={vi.fn()}
        regulatoryFrameId={'bc-protocol1-v5-dra'}
        {...props}
      />,
    );
  }

  it('renders a resize handle when the right panel is open', () => {
    renderLibrary();
    const handle = screen.getByTestId(
      'references-values-right-panel-resize-handle',
    );
    expect(handle).toBeInTheDocument();
    expect(handle).toHaveAttribute('role', 'separator');
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('hides the handle and collapses width when the right panel is closed', () => {
    renderLibrary({ showRightPanel: false });
    expect(
      screen.queryByTestId('references-values-right-panel-resize-handle'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('references-values-right-panel-wrapper'),
    ).toHaveStyle({ width: '0px' });
  });

  it('applies the default width with empty storage', async () => {
    renderLibrary();
    const wrapper = screen.getByTestId('references-values-right-panel-wrapper');
    await waitFor(() => expect(wrapper).toHaveStyle({ width: '384px' }));
  });

  it('widens the panel on drag and clamps to the maximum', async () => {
    renderLibrary();
    const wrapper = screen.getByTestId('references-values-right-panel-wrapper');
    const handle = screen.getByTestId(
      'references-values-right-panel-resize-handle',
    );
    await waitFor(() => expect(wrapper).toHaveStyle({ width: '384px' }));

    // Handle is on the LEFT edge; dragging to a smaller clientX widens the panel.
    fireEvent.pointerDown(handle, { clientX: 800 });
    fireEvent(window, new MouseEvent('pointermove', { clientX: 700 }));
    fireEvent(window, new MouseEvent('pointerup', {}));
    expect(wrapper).toHaveStyle({ width: '484px' });

    fireEvent.pointerDown(handle, { clientX: 800 });
    fireEvent(window, new MouseEvent('pointermove', { clientX: 0 }));
    fireEvent(window, new MouseEvent('pointerup', {}));
    expect(wrapper).toHaveStyle({ width: '720px' });
  });

  it('clamps to the minimum width on a large rightward drag', () => {
    renderLibrary();
    const wrapper = screen.getByTestId('references-values-right-panel-wrapper');
    const handle = screen.getByTestId(
      'references-values-right-panel-resize-handle',
    );
    fireEvent.pointerDown(handle, { clientX: 800 });
    fireEvent(window, new MouseEvent('pointermove', { clientX: 1700 }));
    fireEvent(window, new MouseEvent('pointerup', {}));
    expect(wrapper).toHaveStyle({ width: '320px' });
  });

  it('persists the dragged width to localStorage', () => {
    renderLibrary();
    const handle = screen.getByTestId(
      'references-values-right-panel-resize-handle',
    );
    fireEvent.pointerDown(handle, { clientX: 800 });
    fireEvent(window, new MouseEvent('pointermove', { clientX: 700 }));
    fireEvent(window, new MouseEvent('pointerup', {}));
    expect(window.localStorage.getItem(RIGHT_WIDTH_KEY)).toBe('484');
  });

  it('restores a valid persisted width on mount', async () => {
    window.localStorage.setItem(RIGHT_WIDTH_KEY, '500');
    renderLibrary();
    const wrapper = screen.getByTestId('references-values-right-panel-wrapper');
    await waitFor(() => expect(wrapper).toHaveStyle({ width: '500px' }));
  });

  it('rejects a non-numeric persisted width and falls back to the default', async () => {
    window.localStorage.setItem(RIGHT_WIDTH_KEY, 'abc');
    renderLibrary();
    const wrapper = screen.getByTestId('references-values-right-panel-wrapper');
    // restore() rejects 'abc' and falls back to 384; the persist effect then re-writes
    // the corrected value, so the key holds '384' (not the rejected 'abc').
    await waitFor(() => expect(wrapper).toHaveStyle({ width: '384px' }));
    expect(window.localStorage.getItem(RIGHT_WIDTH_KEY)).toBe('384');
  });

  it('rejects an out-of-range persisted width and falls back to the default', async () => {
    window.localStorage.setItem(RIGHT_WIDTH_KEY, '99999');
    renderLibrary();
    const wrapper = screen.getByTestId('references-values-right-panel-wrapper');
    await waitFor(() => expect(wrapper).toHaveStyle({ width: '384px' }));
    expect(window.localStorage.getItem(RIGHT_WIDTH_KEY)).toBe('384');
  });

  // Viewport-budget path: on a narrower desktop the [320,720] absolute range is
  // capped by (innerWidth - 320 left rail - 360 min center). These exercise the
  // budget that the 1600px beforeEach masks.
  it('clamps a restored width to the viewport budget on mount (protects the center column)', async () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1280,
    });
    window.localStorage.setItem(RIGHT_WIDTH_KEY, '700');
    renderLibrary();
    const wrapper = screen.getByTestId('references-values-right-panel-wrapper');
    // viewportMax = 1280 - 320 (left rail) - 360 (min center) = 600; 700 -> 600.
    await waitFor(() => expect(wrapper).toHaveStyle({ width: '600px' }));
  });

  it('clamps a drag to the viewport budget, not the absolute max, on a narrow desktop', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1280,
    });
    window.localStorage.clear();
    renderLibrary();
    const wrapper = screen.getByTestId('references-values-right-panel-wrapper');
    const handle = screen.getByTestId(
      'references-values-right-panel-resize-handle',
    );
    fireEvent.pointerDown(handle, { clientX: 800 });
    fireEvent(window, new MouseEvent('pointermove', { clientX: 0 }));
    fireEvent(window, new MouseEvent('pointerup', {}));
    // Budget caps at 600 here, below the absolute 720 max.
    expect(wrapper).toHaveStyle({ width: '600px' });
  });
});

describe('EvidenceLibrary saved views (Supabase)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(savedViewsSync.fetchSavedViews).mockResolvedValue([]);
    vi.mocked(savedViewsSync.createSavedView).mockResolvedValue({
      success: false,
      view: null,
      error: 'unauthenticated',
    });
    vi.mocked(savedViewsSync.deleteSavedView).mockResolvedValue(false);
    vi.mocked(savedViewsSync.importLegacySavedViews).mockResolvedValue({
      success: false,
      imported: 0,
    });
    vi.mocked(savedViewsSync.fetchSavedViewsResult).mockResolvedValue({
      signedIn: false,
      error: false,
      views: [],
    });
  });

  const SAVED_VIEWS_KEY = 'matrix-options-saved-views-v1';
  const MIGRATED_KEY = 'matrix-options-saved-views-migrated-v1';

  it('clears a stale local mirror when a signed-in account has no remote views', async () => {
    // Stale local entry from a prior account/session + sentinel already done; remote empty;
    // signed in. The authenticated-empty state is authoritative -> the stale view must not show.
    window.localStorage.setItem(
      SAVED_VIEWS_KEY,
      JSON.stringify([
        { id: 'stale-1', name: 'Other account view', filters: {}, viewMode: 'values' },
      ]),
    );
    window.localStorage.setItem(MIGRATED_KEY, 'done');
    vi.mocked(savedViewsSync.fetchSavedViewsResult).mockResolvedValue({
      signedIn: true,
      error: false,
      views: [],
    });

    renderControlled();
    await waitFor(() =>
      expect(
        screen.getByTestId('evidence-library-saved-views'),
      ).toHaveTextContent(/No saved views yet/),
    );
    expect(
      screen.getByTestId('evidence-library-saved-views'),
    ).not.toHaveTextContent(/Other account view/);
    expect(window.localStorage.getItem(SAVED_VIEWS_KEY)).toBe('[]');
  });

  it('keeps the local mirror when signed out (no remote, not authenticated)', async () => {
    window.localStorage.setItem(
      SAVED_VIEWS_KEY,
      JSON.stringify([
        { id: 'local-1', name: 'My local view', filters: {}, viewMode: 'values' },
      ]),
    );
    window.localStorage.setItem(MIGRATED_KEY, 'done');
    vi.mocked(savedViewsSync.fetchSavedViewsResult).mockResolvedValue({
      signedIn: false,
      error: false,
      views: [],
    });

    renderControlled();
    expect(
      await screen.findByRole('button', { name: /^My local view/ }),
    ).toBeInTheDocument();
  });

  it('keeps the local mirror on a remote read ERROR (does not erase the fallback)', async () => {
    // The codex re-review P2: an empty result from a read FAILURE (missing table / RLS /
    // outage) must NOT be treated as authoritative-empty and must not delete local views.
    window.localStorage.setItem(
      SAVED_VIEWS_KEY,
      JSON.stringify([
        { id: 'local-2', name: 'Survives the outage', filters: {}, viewMode: 'values' },
      ]),
    );
    window.localStorage.setItem(MIGRATED_KEY, 'done');
    vi.mocked(savedViewsSync.fetchSavedViewsResult).mockResolvedValue({
      signedIn: true,
      error: true,
      views: [],
    });

    renderControlled();
    expect(
      await screen.findByRole('button', { name: /^Survives the outage/ }),
    ).toBeInTheDocument();
    // localStorage fallback is preserved, not wiped to '[]'.
    expect(window.localStorage.getItem(SAVED_VIEWS_KEY)).toContain('Survives the outage');
  });

  it('persists the reconciled server id to localStorage after a successful save', async () => {
    vi.mocked(savedViewsSync.createSavedView).mockResolvedValueOnce({
      success: true,
      view: {
        id: 'srv-persist-1',
        name: 'Persisted view',
        filters: createEvidenceLibraryFilters(),
        view_mode: 'values',
        created_at: 't',
        updated_at: 't',
      },
      error: null,
    });
    renderControlled();
    fireEvent.click(screen.getByTestId('evidence-library-save-view-button'));
    fireEvent.change(screen.getByTestId('evidence-library-save-view-input'), {
      target: { value: 'Persisted view' },
    });
    fireEvent.click(screen.getByTestId('evidence-library-save-view-confirm'));
    await waitFor(() => {
      const raw = window.localStorage.getItem(SAVED_VIEWS_KEY) ?? '[]';
      expect(raw).toContain('srv-persist-1'); // server id, not the optimistic id
    });
  });

  it('renders saved views fetched from Supabase on mount', async () => {
    vi.mocked(savedViewsSync.fetchSavedViewsResult).mockResolvedValueOnce({
      signedIn: true,
      error: false,
      views: [
        {
          id: 'srv-1',
          name: 'Server view A',
          filters: createEvidenceLibraryFilters({ substanceKeys: ['lead'] }),
          view_mode: 'values',
          created_at: 't',
          updated_at: 't',
        },
      ],
    });
    renderControlled();
    // Anchor to the start so we hit the apply button, not the "Delete saved view ..." button.
    expect(
      await screen.findByRole('button', { name: /^Server view A/ }),
    ).toBeInTheDocument();
  });

  it('keeps an optimistic save after the server reconciles its id', async () => {
    vi.mocked(savedViewsSync.createSavedView).mockResolvedValueOnce({
      success: true,
      view: {
        id: 'srv-99',
        name: 'Persisted view',
        filters: createEvidenceLibraryFilters(),
        view_mode: 'values',
        created_at: 't',
        updated_at: 't',
      },
      error: null,
    });
    renderControlled();
    fireEvent.click(screen.getByTestId('evidence-library-save-view-button'));
    fireEvent.change(screen.getByTestId('evidence-library-save-view-input'), {
      target: { value: 'Persisted view' },
    });
    fireEvent.click(screen.getByTestId('evidence-library-save-view-confirm'));
    // Optimistic row appears immediately; after the server resolves it remains (id reconciled).
    await waitFor(() =>
      expect(
        screen.getByTestId('evidence-library-saved-views'),
      ).toHaveTextContent(/Persisted view/),
    );
  });
});
