import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as savedViewsSync from '@/lib/matrix-options/provenance/saved-views-sync';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import EvidenceLibrary, { ValuesPagination } from '../EvidenceLibrary';
import {
  createEvidenceLibraryFilters,
} from '@/lib/matrix-options/provenance/library';
import type { EvidenceLibraryFilters } from '@/lib/matrix-options/provenance/types';
import type { RegulatoryFrameId } from '@/lib/matrix-options/regulatoryFrames';
import { submitReview, fetchAllReviews } from '@/lib/matrix-options/provenance/qa-review-sync';

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
  fetchAllReviews: vi.fn().mockResolvedValue([]),
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

// ---------------------------------------------------------------------------
// Compact catalog fixture (performance). EvidenceLibrary reads the reference catalog
// INDIRECTLY: it imports SOURCE_RECORDS from this module and buildEvidenceLibraryView from
// library.ts, and library.ts reads the catalog's exports internally. Mocking the catalog
// module therefore bounds the data the whole render tree sees. The live catalog grew to
// ~1700 parameter-value rows; rendering it on all 58 tests pushed this file to ~10.7 min
// locally / ~20 min on CI (one test tripping the 60s CI per-test cap). The fixture replaces
// ONLY the data with a small representative set (see evidenceLibraryFixture.ts) -- the real
// audit / filter / default-selection-policy / saved-views logic is untouched. The factory
// mirrors the real catalog helpers (filters over the fixture arrays) so getter behavior is
// identical. Async factory so it can import the fixture module after hoisting.
vi.mock('@/lib/matrix-options/provenance/catalog', async () => {
  const {
    FIXTURE_PARAMETER_VALUE_RECORDS,
    FIXTURE_SOURCE_RECORDS,
    FIXTURE_EQUATION_RECORDS,
    FIXTURE_SOURCE_LEAD_SETS,
  } = await import('./evidenceLibraryFixture');

  const SOURCE_RECORDS = FIXTURE_SOURCE_RECORDS;
  const EQUATION_RECORDS = FIXTURE_EQUATION_RECORDS;
  const PARAMETER_VALUE_RECORDS = FIXTURE_PARAMETER_VALUE_RECORDS;
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
    getParameterValueRecordsForSubstance: (
      substanceKey: string,
      pathway: string,
    ) =>
      PARAMETER_VALUE_RECORDS.filter(
        (record) =>
          record.substance_key === substanceKey && record.pathway === pathway,
      ),
  };
});

function renderControlled(
  initialFilters = createEvidenceLibraryFilters(),
  regulatoryFrameId: RegulatoryFrameId = 'bc-protocol1-v5-dra',
  showLeftPanel = true,
) {
  let currentFilters: EvidenceLibraryFilters = initialFilters;
  const handleChange = vi.fn((nextFilters: EvidenceLibraryFilters) => {
    currentFilters = nextFilters;
    rerender(
      <EvidenceLibrary
        filters={currentFilters}
        onFiltersChange={handleChange}
        regulatoryFrameId={regulatoryFrameId}
        showLeftPanel={showLeftPanel}
      />,
    );
  });
  const { rerender } = render(
    <EvidenceLibrary
      filters={currentFilters}
      onFiltersChange={handleChange}
      regulatoryFrameId={regulatoryFrameId}
      showLeftPanel={showLeftPanel}
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

  it('shows named result counts for the Values view', () => {
    renderControlled();

    // Defaults to Values.
    expect(screen.getByText(/Showing \d+ of \d+ values/)).toBeInTheDocument();
  });

  it('renders values without promoting unreviewed scaffolds', () => {
    renderControlled();

    expect(screen.getByTestId('references-values-tab')).not.toHaveTextContent(
      /pending owner export/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Show Approved values$/ }));
    expect(screen.getAllByText(/Benzo\[a\]pyrene oral slope factor/).length).toBeGreaterThan(0);
  });

  it('opens the Protocol 28 review queue without promoting values', () => {
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
    expect(screen.getByTestId('evidence-library-values')).toBeInTheDocument();
    expect(
      screen.getByText(/Source role: policy compilation/i),
    ).toBeInTheDocument();
  });

  it('filters to the human-health-food pathway', () => {
    const { handleChange } = renderControlled();

    ensureFiltersOpen();
    fireEvent.change(screen.getByLabelText(/^Pathway$/), {
      target: { value: 'human-health-food' },
    });

    expect(handleChange).toHaveBeenCalled();
    expect(screen.getByText(/Aroclor 1254 freshwater BSAF for human food web/)).toBeInTheDocument();
    expect(screen.queryByText(/Benzo\[a\]pyrene log Kow/)).not.toBeInTheDocument();
  });

  it('filters by jurisdiction and substance', () => {
    renderControlled();

    ensureFiltersOpen();
    fireEvent.change(screen.getByLabelText(/^Jurisdiction$/), {
      target: { value: 'general' },
    });
    expect(screen.getAllByText(/Jurisdiction: general/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Current calculator scaffold only/,
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

  it('closes selected detail panels when clearing filters', () => {
    renderControlled();

    fireEvent.click(screen.getAllByTestId('evidence-library-inspect-value')[0]);
    expect(screen.getByTestId('evidence-library-value-detail')).toBeInTheDocument();

    clearAllFilters();
    expect(
      screen.queryByTestId('evidence-library-value-detail'),
    ).not.toBeInTheDocument();
  });

  it('searches and clears active filters', () => {
    renderControlled();

    fireEvent.change(screen.getByLabelText(/^Search$/), {
      target: { value: 'Aroclor' },
    });

    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Aroclor 1254/,
    );
    expect(screen.getAllByText(/search: Aroclor/).length).toBeGreaterThan(0);

    clearAllFilters();
    expect(screen.queryAllByText(/search: Aroclor/)).toHaveLength(0);
    expect(screen.getByText(/Benzo\[a\]pyrene log Kow/)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: /^Show Zotero linked$/ }));
    expect(
      screen.queryByTestId('evidence-library-all-scaffolds-banner'),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI batch Group B, 2026-08-15: decisions #2, #5, #6, #1b
// (docs/UI_DECISIONS_2026_08_15.md / docs/UI_BATCH_PLAN_2026_08_15.md)
// ---------------------------------------------------------------------------
describe('EvidenceLibrary -- UI batch Group B (references-and-values)', () => {
  it('#5: sticky-lefts the Parameter column header and cells, and the table can actually overflow', () => {
    renderControlled();

    const headerCell = screen.getByRole('columnheader', { name: 'Parameter' });
    expect(headerCell.className).toMatch(/\bsticky\b/);
    expect(headerCell.className).toMatch(/\bleft-0\b/);

    const row = screen.getByRole('button', {
      name: /Inspect Benzo\[a\]pyrene oral slope factor - Health Canada/,
    });
    const parameterCell = within(row).getByText(
      'Benzo[a]pyrene oral slope factor - Health Canada',
    ).closest('td');
    expect(parameterCell?.className).toMatch(/\bsticky\b/);
    expect(parameterCell?.className).toMatch(/\bleft-0\b/);

    // jsdom cannot measure layout (scrollWidth/clientWidth are always 0), so a passing
    // assertion on those values would be meaningless. Instead assert the STRUCTURAL
    // precondition for overflow: the table carries a min-width floor. Under
    // `table-layout: fixed; width: 100%` alone (no min-width), the table can never exceed
    // its container -- scrollWidth === clientWidth always, and the sticky column plus the
    // ScrollFadeRegion fade would be permanently inert on narrow (phone) viewports. This
    // fails if that min-width regresses back out.
    const table = headerCell.closest('table');
    expect(table?.className).toMatch(/\bmin-w-\[/);
  });

  it('#6: promotes evidence_support_status to the one visible pill, demotes the other three to plain text', () => {
    renderControlled();

    const row = screen.getByRole('button', {
      name: /Inspect Benzo\[a\]pyrene oral slope factor - Health Canada/,
    });
    const cell = within(row).getByTestId('evidence-default-evidence-cell');

    // Exactly one colored StatusBadge pill in the cell (evidence_support_status).
    const pills = within(cell).getAllByText(/approved source-backed/i);
    expect(pills).toHaveLength(1);
    expect(pills[0].className).toMatch(/rounded-full/);

    // The other three statuses fold into one muted plain-text line, not pills.
    expect(cell).toHaveTextContent(
      'available option . approved . extracted from source',
    );
    expect(within(cell).queryByText(/^available option$/i)).not.toBeInTheDocument();
    expect(within(cell).queryByText(/^extracted from source$/i)).not.toBeInTheDocument();
  });

  it('#6: folds a superseded row (qa_status=superseded, approved_source_backed) into plain text too', () => {
    // Two-sided falsification: this fixture row exercises the qa_status=superseded case that
    // the earlier assertion (approved-only fixture) never touched. Positive: "superseded" must
    // appear as plain muted text in the folded line. Negative: it must NOT render as a second
    // colored StatusBadge pill (only evidence_support_status gets a pill per decision #6).
    //
    // P2-1 RESOLVED (owner-decided 2026-08-15) -- this SUPERSEDES the round-2 P3-4
    // "PROVISIONAL ASSERTION" note that previously stood here. The open question was whether a
    // qa_status=superseded row should still show the green "Approved source-backed" pill at all.
    // Decision: YES, the pill stays -- it reports evidence PROVENANCE, which for these 41 rows
    // genuinely is source-backed -- but the qa_status text stops rendering as neutral grey.
    // It now carries the same tone statusTone() gives the pill form of that status (rose for
    // superseded, amber for needs-review), so a superseded row can no longer present two
    // reassuring signals with the warning demoted to 12px grey. This is now an AGREED contract
    // and may be cited as such.
    //
    // Round-2 P3-3: the fixture row is deliberately a SYNTHETIC substance/source; it replaced
    // a fabricated "Zinc oral slope factor - Health Canada" value attributed to a real source.
    renderControlled();

    const row = screen.getByRole('button', {
      name: /Inspect Fixture Substance Alpha oral slope factor \(synthetic, superseded\)/,
    });
    const cell = within(row).getByTestId('evidence-default-evidence-cell');

    const pills = within(cell).getAllByText(/approved source-backed/i);
    expect(pills).toHaveLength(1);
    expect(pills[0].className).toMatch(/rounded-full/);

    expect(cell).toHaveTextContent('not default . superseded . extracted from source');
    // The superseded qa_status text itself must not be a separate pill.
    const supersededMatches = within(cell).getAllByText(/superseded/i);
    supersededMatches.forEach((el) => {
      expect(el.className).not.toMatch(/rounded-full/);
    });

    // P2-1 tone contract. Two-sided falsification:
    //  - Positive: "superseded" is its OWN element carrying the rose text tone. Note this
    //    query is itself discriminating -- before P2-1 the status was a bare text node whose
    //    parent's full text is "not default . superseded . extracted from source", so an
    //    exact getByText('superseded') could not have matched anything. Reverting the fix
    //    fails this line with "unable to find an element", not a silent pass.
    //  - Negative: it must NOT be a pill (decision #6 keeps one pill per cell) and must NOT
    //    carry the amber needs-review tone -- if qaStatusTextTone fell through to the wrong
    //    branch, or lost its 'superseded' case and inherited grey, both halves fail.
    const supersededText = within(cell).getByText('superseded');
    expect(supersededText.className).toMatch(/text-rose-700/);
    expect(supersededText.className).toMatch(/dark:text-rose-300/);
    expect(supersededText.className).not.toMatch(/rounded-full/);
    expect(supersededText.className).not.toMatch(/text-amber-/);
    expect(supersededText.className).not.toMatch(/text-slate-/);
  });

  it('round-4 Leg1a P2-1: every sticky-column background is fully opaque', () => {
    // A sticky cell occludes the columns scrolling beneath it. `z-10` sets paint
    // ORDER, not opacity, so any alpha-suffixed background lets the scrolled cells
    // show through and the parameter name renders superimposed on the Pathway and
    // Current-value text -- two strings drawn on top of each other, neither legible.
    // That is the same failure round-2 P2-5 removed from this table, reintroduced by
    // the sticky column two rounds later.
    //
    // jsdom composites nothing, so the CLASS CONTRACT is the only assertable form.
    //
    // Two-sided falsification:
    //  - Positive: the sticky cell carries opaque backgrounds for base and dark.
    //  - Negative: NO background utility on this cell may carry a Tailwind alpha
    //    suffix (`bg-...-NNN/NN`). Restoring any of the three translucent variants
    //    (`bg-sky-50/60`, `dark:bg-sky-950/30`, `dark:bg-sky-950/40`) fails by name.
    //    Asserting only "has bg-white" would pass against the broken version, since
    //    the opaque base was always present alongside the translucent hover states.
    renderControlled();

    const row = screen.getByRole('button', {
      name: /Inspect Benzo\[a\]pyrene oral slope factor - Health Canada/,
    });
    const stickyCell = within(row)
      .getAllByRole('cell')
      .find((c) => c.className.includes('sticky'));
    expect(stickyCell).toBeDefined();

    const cls = stickyCell!.className;
    expect(cls).toMatch(/\bsticky\b/);
    expect(cls).toMatch(/\bbg-white\b/);
    expect(cls).toMatch(/\bdark:bg-slate-950\b/);

    // Negative half: no alpha-suffixed background anywhere on the sticky cell.
    const alphaBackgrounds = cls.match(/(?:^|\s|:)bg-[a-z]+-\d{2,3}\/\d{1,3}\b/g) ?? [];
    expect(alphaBackgrounds).toEqual([]);
  });

  it('P2-1: tones needs-review qa_status amber and leaves settled statuses untoned', () => {
    // The other two branches of qaStatusTextTone, so the rule is pinned as a CLASS rather
    // than only at the superseded instance that prompted it.
    //
    // Two-sided falsification:
    //  - Positive: a needs_review row's folded qa_status text is its own element carrying
    //    the amber tone. Deleting the 'needs' branch drops the wrapper element entirely and
    //    this getByText fails to find anything.
    //  - Negative: an 'approved' qa_status must have NO toned wrapper at all -- it stays a
    //    bare text node inheriting the muted line colour. If qaStatusTextTone ever returned
    //    a tone for every status (the obvious over-correction), the queryByText below starts
    //    matching an element and this half fails.
    renderControlled();

    const needsReview = screen.getAllByText('needs review');
    expect(needsReview.length).toBeGreaterThan(0);
    needsReview.forEach((el) => {
      expect(el.className).toMatch(/text-amber-700/);
      expect(el.className).toMatch(/dark:text-amber-300/);
      expect(el.className).not.toMatch(/text-rose-/);
    });

    // 'approved' as a folded qa_status is deliberately NOT wrapped, so no element inside the
    // cell has it as its own exact text. Scoped to the cell rather than the whole screen: a
    // global query would start failing spuriously the day someone adds an "approved" filter
    // chip elsewhere in the view, which would be a false alarm, not a regression. (The green
    // pill reads 'approved source-backed', a different exact string, so it cannot satisfy
    // this query and mask the assertion.)
    const approvedRow = screen.getByRole('button', {
      name: /Inspect Benzo\[a\]pyrene oral slope factor - Health Canada/,
    });
    const approvedCell = within(approvedRow).getByTestId('evidence-default-evidence-cell');
    expect(approvedCell).toHaveTextContent('available option . approved . extracted from source');
    expect(within(approvedCell).queryByText('approved')).not.toBeInTheDocument();
  });

  it('round-2 P2-5: the Current value cell wraps instead of overflowing its fixed column', () => {
    // Under `table-layout: fixed` a `whitespace-nowrap` cell overflows VISIBLY rather than
    // widening its column, so a value like "6.0E-05 mg/kg-bw/day" painted over the adjacent
    // evidence-status badge. Horizontal scroll does not fix an overlap.
    //
    // Two-sided falsification:
    //  - Positive: the cell must carry the wrapping classes AND the full value as `title`.
    //  - Negative: restoring `whitespace-nowrap` on the cell fails the second expectation,
    //    and narrowing the column back to w-[9%] fails the third. jsdom has no layout
    //    engine, so the overlap itself cannot be measured here -- these assert the two
    //    mechanisms that prevent it.
    renderControlled();

    const cells = screen.getAllByTestId('evidence-current-value-cell');
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.className).toMatch(/break-words/);
      expect(cell.className).not.toMatch(/whitespace-nowrap/);
      expect(cell).toHaveAttribute('title', cell.textContent ?? '');
    }

    const table = screen.getByRole('table');
    expect(table.className).toMatch(/min-w-\[980px\]/);
  });

  it('#1b: gives the row-expand Details summary a 44px-tall tap target', () => {
    renderControlled();

    const summaries = screen.getAllByText('Details', { selector: 'summary' });
    expect(summaries.length).toBeGreaterThan(0);
    summaries.forEach((summary) => {
      expect(summary.className).toMatch(/min-h-\[44px\]/);
    });
  });

  it('#2: wraps the Parameter Values table in the ScrollFadeRegion affordance, with a table that can overflow it', () => {
    renderControlled();

    const valuesSection = screen.getByTestId('evidence-library-values');
    const region = within(valuesSection).getByTestId('scroll-fade-region');
    expect(region).toBeInTheDocument();

    // A ScrollFadeRegion wrapping a table that can never exceed its own width is a no-op
    // affordance (see #5 above). Assert the table inside the region carries the min-width
    // floor rather than only checking the wrapper exists, so a regression that drops the
    // min-width (making the region permanently inert) fails this test.
    const table = within(region).getByRole('table');
    expect(table.className).toMatch(/\bmin-w-\[/);
  });
});

describe('EvidenceLibrary -- ValuesPagination (decision #1b)', () => {
  it('raises Prev/Next to a 44px-tall floor', () => {
    render(
      <ValuesPagination
        page={1}
        pageCount={3}
        pageSize={50}
        totalRows={120}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );

    const prev = screen.getByRole('button', { name: /^Prev$/ });
    const next = screen.getByRole('button', { name: /^Next$/ });
    expect(prev.className).toMatch(/min-h-\[44px\]/);
    expect(next.className).toMatch(/min-h-\[44px\]/);
  });

  it('still wires Prev/Next click handlers correctly at the new size', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <ValuesPagination
        page={1}
        pageCount={3}
        pageSize={50}
        totalRows={120}
        onPrev={onPrev}
        onNext={onNext}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Prev$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Next$/ }));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
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
        showLeftPanel={true}
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

  it('keeps local views on a signed-in empty read (non-destructive; account-aware clear is a follow-up)', async () => {
    // Signed in, remote empty, sentinel done, local has views. The local cache is NOT
    // deleted -- it may hold legitimate offline/local-only views (saveCurrentView caches
    // them). It is shown as the fallback; a fully account-aware reconcile is a follow-up.
    window.localStorage.setItem(
      SAVED_VIEWS_KEY,
      JSON.stringify([
        { id: 'local-3', name: 'Cached local view', filters: {}, viewMode: 'values' },
      ]),
    );
    window.localStorage.setItem(MIGRATED_KEY, 'done');
    vi.mocked(savedViewsSync.fetchSavedViewsResult).mockResolvedValue({
      signedIn: true,
      error: false,
      views: [],
    });

    renderControlled();
    expect(
      await screen.findByRole('button', { name: /^Cached local view/ }),
    ).toBeInTheDocument();
    // The local cache is preserved, not wiped.
    expect(window.localStorage.getItem(SAVED_VIEWS_KEY)).toContain('Cached local view');
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

  it('preserves a stale localStorage equations saved view, remapped to the Values mode', async () => {
    // Legacy local-only saved view persisted before the Equations view mode was retired.
    // loadSavedViews used to admit only values/sources, so this view would be DROPPED. It must
    // instead be PRESERVED (name + filters) with its mode coerced to 'values', mirroring the
    // Supabase coerceViewMode fallback, so applying it lands on a real view rather than a
    // removed mode.
    window.localStorage.setItem(
      SAVED_VIEWS_KEY,
      JSON.stringify([
        { id: 'local-eq', name: 'Legacy equations view', filters: {}, viewMode: 'equations' },
      ]),
    );
    window.localStorage.setItem(MIGRATED_KEY, 'done');
    vi.mocked(savedViewsSync.fetchSavedViewsResult).mockResolvedValue({
      signedIn: false,
      error: false,
      views: [],
    });

    renderControlled();

    // Preserved, not dropped.
    expect(
      await screen.findByRole('button', { name: /^Legacy equations view/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Legacy equations view/ }));
    expect(screen.getByTestId('evidence-library-values')).toBeInTheDocument();
  });

  it('remaps a stale localStorage source-leads saved view to the Sources view', async () => {
    // Source-of-sources leads were folded into the Sources view, so a legacy 'source-leads'
    // saved view must land on Sources (where that inventory now lives), not the default
    // Values table -- otherwise its source-role filters would evaluate against value rows.
    window.localStorage.setItem(
      SAVED_VIEWS_KEY,
      JSON.stringify([
        { id: 'local-sl', name: 'Legacy leads view', filters: {}, viewMode: 'source-leads' },
      ]),
    );
    window.localStorage.setItem(MIGRATED_KEY, 'done');
    vi.mocked(savedViewsSync.fetchSavedViewsResult).mockResolvedValue({
      signedIn: false,
      error: false,
      views: [],
    });

    renderControlled();
    fireEvent.click(
      await screen.findByRole('button', { name: /^Legacy leads view/ }),
    );
    expect(screen.getByTestId('evidence-library-values')).toBeInTheDocument();
  });

  it('coerces a localStorage by-parameter saved view to the values catalogue', async () => {
    window.localStorage.setItem(
      SAVED_VIEWS_KEY,
      JSON.stringify([
        { id: 'local-bp', name: 'Legacy groups view', filters: {}, viewMode: 'by-parameter' },
      ]),
    );
    window.localStorage.setItem(MIGRATED_KEY, 'done');
    vi.mocked(savedViewsSync.fetchSavedViewsResult).mockResolvedValue({
      signedIn: false,
      error: false,
      views: [],
    });

    renderControlled();
    fireEvent.click(
      await screen.findByRole('button', { name: /^Legacy groups view/ }),
    );
    expect(screen.getByTestId('evidence-library-values')).toBeInTheDocument();
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

// ---------------------------------------------------------------------------
// A5 aria-live outcome channel -- regression coverage for the bug that survived
// three separate fix attempts (see EvidenceLibrary.tsx ROUND-3 REGRESSION FIXED
// comment near the aria-live div). This suite is deliberately about DOM MUTATION
// and NODE IDENTITY, not about text content, because a text-content-only
// assertion passes against all three broken implementations:
//
//   Attempt 1: liveMessage was a plain string. React's Object.is bail-out means
//              an identical repeat setLiveMessage(sameText) call triggers no
//              re-render at all -- no DOM mutation, so the inner node reference
//              (and its content) never changes on a repeat announcement. SILENT.
//   Attempt 2: liveMessage became {text, seq}, defeating the state bail-out, but
//              the div's children were rendered as plain text (no keyed inner
//              element). React's DOM prop diff skips setTextContent when the
//              computed `children` string is unchanged, so a repeat message
//              still produces no DOM mutation. STILL SILENT.
//   Attempt 3: key={seq} was moved onto the aria-live DIV ITSELF, remounting the
//              live region on every announcement. The region's own insertion and
//              its content arrive in the same commit, which the ARIA live-region
//              contract does not announce. WORSE: this breaks even the FIRST
//              announcement, and the container's own DOM node identity changes
//              on every single announce.
//
// The fixed implementation keeps a stable, unkeyed aria-live container and
// swaps a keyed inner <span> on every announce() call, including for a
// byte-identical repeat message.
// ---------------------------------------------------------------------------

describe('EvidenceLibrary -- aria-live outcome channel (A5 regression)', () => {
  // Drives an announce() call through the real "Save current" saved-view flow
  // (see saveCurrentView / the save-view-confirm handler around line ~4090),
  // which is one of the announce() call sites exercised elsewhere in this file
  // (see 'saves the current filters as a named view, then deletes it' above).
  // The default module mock has createSavedView resolve
  // { success: false, error: 'unauthenticated' }, which saveCurrentView treats
  // as signed-out/local-only SUCCESS and announces:
  //   `Saved view "<name>" created in this browser only. Sign in to sync it to
  //   your account.`
  // Calling this helper twice with the SAME name produces a byte-identical
  // repeat announcement, which is exactly the case that killed attempts 1 and 2.
  async function saveViewNamed(name: string) {
    fireEvent.click(screen.getByTestId('evidence-library-save-view-button'));
    fireEvent.change(screen.getByTestId('evidence-library-save-view-input'), {
      target: { value: name },
    });
    fireEvent.click(screen.getByTestId('evidence-library-save-view-confirm'));
  }

  it('exists on first render, keeps a stable container identity, and mutates its inner node on a repeat announcement', async () => {
    window.localStorage.clear();
    renderControlled();

    // (1) The aria-live container exists on FIRST render, before any
    // announcement occurs -- catches any future conditional rendering of the
    // region itself.
    const liveRegion = screen.getByTestId('evidence-library-live-region');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');

    const REPEAT_NAME = 'Repeat announce regression view';

    // First announcement.
    await saveViewNamed(REPEAT_NAME);
    await waitFor(() => {
      expect(liveRegion).toHaveTextContent(
        new RegExp(`Saved view "${REPEAT_NAME}" created in this browser only`),
      );
    });

    // (2) Container DOM node identity is stable across the announcement --
    // re-querying by the same test id must return the SAME element object.
    // This is what kills attempt 3 (keying the outer div itself, which
    // remounts the region -- a fresh node fails this identity check).
    expect(screen.getByTestId('evidence-library-live-region')).toBe(liveRegion);

    const firstInnerNode = liveRegion.firstElementChild;
    expect(firstInnerNode).not.toBeNull();

    // Second announcement with the EXACT SAME message text (not a different
    // string) -- this is deliberately NOT about the text differing.
    await saveViewNamed(REPEAT_NAME);

    // (3) Triggering the SAME message twice must produce an observable DOM
    // mutation the second time: a NEW inner node replaces the old one, even
    // though the rendered text is identical both times. Node-identity
    // comparison (rather than MutationObserver) is used per the task's
    // stated preference. This is what kills attempts 1 and 2:
    //   - Attempt 1 (plain string state): React's Object.is bail-out means the
    //     second identical setState is a no-op -- firstInnerNode would still
    //     be liveRegion.firstElementChild, so `not.toBe` below would fail.
    //   - Attempt 2 ({text, seq} but no keyed inner span): the state DOES
    //     change (seq increments) and a re-render happens, but with no keyed
    //     inner element there is no inner element node to swap -- the DOM
    //     prop diff skips the no-op text update, so the node identity again
    //     does not change (or no element child exists at all), and this
    //     assertion again fails.
    await waitFor(() => {
      expect(liveRegion.firstElementChild).not.toBeNull();
      expect(liveRegion.firstElementChild).not.toBe(firstInnerNode);
    });

    // Container identity is STILL the same node after the second announcement
    // (re-asserted post-mutation; attempt 3 would have swapped this too).
    expect(screen.getByTestId('evidence-library-live-region')).toBe(liveRegion);

    // (4) The announced text is actually present in the container.
    expect(liveRegion).toHaveTextContent(
      new RegExp(`Saved view "${REPEAT_NAME}" created in this browser only`),
    );

    window.localStorage.clear();
  });

  it('renders explicit empty state in QA Hub Stage 2 when source document has no linked values and shows no unrelated rows', async () => {
    renderControlled();

    const openHubBtn = screen.getByTestId('evidence-library-open-qa-hub');
    fireEvent.click(openHubBtn);

    expect(screen.getByText(/Stage 1: Authority Source Documents/i)).toBeInTheDocument();

    // Select the zero-value source fixture deterministically
    const zeroValButtons = screen.getAllByRole('button', { name: /Verify Values \(0\)/i });
    expect(zeroValButtons.length).toBeGreaterThan(0);
    fireEvent.click(zeroValButtons[0]);

    // Stage 2 must render the explicit empty state card with testid evidence-qa-no-values
    expect(screen.getByTestId('evidence-qa-no-values')).toBeInTheDocument();
    expect(
      screen.getByText(/No parameter values are linked to this source document/i),
    ).toBeInTheDocument();
    // Must NOT render any parameter rows or textareas
    expect(screen.queryByPlaceholderText(/Enter toxicologist notes/i)).toBeNull();
  });

  it('blur plus immediate Stage 3 performs one write and then enters Stage 3', async () => {
    vi.mocked(submitReview).mockReset();
    let resolvePromise!: (val: boolean) => void;
    const deferred = new Promise<boolean>((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(submitReview).mockImplementation(() => deferred);

    renderControlled();

    fireEvent.click(screen.getByTestId('evidence-library-open-qa-hub'));
    const verifyButtons = screen.getAllByRole('button', { name: /Verify Values \([1-9]\d*\)/i });
    fireEvent.click(verifyButtons[0]);

    // Stage 2: require textareas with getAllBy... (will throw if absent)
    const textareas = screen.getAllByPlaceholderText(/Enter toxicologist notes/i);
    fireEvent.change(textareas[0], { target: { value: 'Verified precision value' } });

    // Blur triggers write
    fireEvent.blur(textareas[0]);
    // Immediate proceed click while write is in flight
    const proceedBtn = screen.getByRole('button', { name: /Proceed to Stage 3/i });
    fireEvent.click(proceedBtn);

    // Exactly 1 in-flight write triggered
    expect(submitReview).toHaveBeenCalledTimes(1);

    // Still in Stage 2 while promise is pending
    expect(screen.queryByText(/Stage 3: Admin Review & Publication Gate Status/i)).not.toBeInTheDocument();

    // Resolve write
    resolvePromise(true);

    // Enters Stage 3
    await waitFor(() => {
      expect(screen.getByText(/Stage 3: Admin Review & Publication Gate Status/i)).toBeInTheDocument();
    });
    // Exactly 1 write total
    expect(submitReview).toHaveBeenCalledTimes(1);
  });

  it('edit during flight completes both generations, persists the newest payload, and then enters Stage 3', async () => {
    vi.mocked(submitReview).mockReset();
    let resolve1!: (val: boolean) => void;
    let resolve2!: (val: boolean) => void;
    const deferred1 = new Promise<boolean>((resolve) => {
      resolve1 = resolve;
    });
    const deferred2 = new Promise<boolean>((resolve) => {
      resolve2 = resolve;
    });

    let invocation = 0;
    vi.mocked(submitReview).mockImplementation(() => {
      invocation++;
      return invocation === 1 ? deferred1 : deferred2;
    });

    renderControlled();

    fireEvent.click(screen.getByTestId('evidence-library-open-qa-hub'));
    const verifyButtons = screen.getAllByRole('button', { name: /Verify Values \([1-9]\d*\)/i });
    fireEvent.click(verifyButtons[0]);

    const textareas = screen.getAllByPlaceholderText(/Enter toxicologist notes/i);
    // Generation 1 edit
    fireEvent.change(textareas[0], { target: { value: 'Gen 1 Note' } });
    fireEvent.blur(textareas[0]);
    expect(submitReview).toHaveBeenCalledTimes(1);

    // Generation 2 edit while Gen 1 write is in flight
    fireEvent.change(textareas[0], { target: { value: 'Gen 2 Note' } });
    fireEvent.blur(textareas[0]);

    // Click Proceed to Stage 3
    const proceedBtn = screen.getByRole('button', { name: /Proceed to Stage 3/i });
    fireEvent.click(proceedBtn);

    // Complete Generation 1
    resolve1(true);

    // Generation 2 write automatically triggers
    await waitFor(() => {
      expect(submitReview).toHaveBeenCalledTimes(2);
    });

    expect(submitReview).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.stringContaining('Gen 2 Note'),
      expect.anything(),
      undefined,
    );

    // Complete Generation 2
    resolve2(true);

    // Transition succeeds into Stage 3
    await waitFor(() => {
      expect(screen.getByText(/Stage 3: Admin Review & Publication Gate Status/i)).toBeInTheDocument();
    });
  });

  it('direct Stage 2 to Stage 4 obeys the same gate and enters Stage 4 upon resolution', async () => {
    vi.mocked(submitReview).mockReset();
    let resolvePromise!: (val: boolean) => void;
    const deferred = new Promise<boolean>((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(submitReview).mockImplementation(() => deferred);

    renderControlled();

    fireEvent.click(screen.getByTestId('evidence-library-open-qa-hub'));
    const verifyButtons = screen.getAllByRole('button', { name: /Verify Values \([1-9]\d*\)/i });
    fireEvent.click(verifyButtons[0]);

    const textareas = screen.getAllByPlaceholderText(/Enter toxicologist notes/i);
    fireEvent.change(textareas[0], { target: { value: 'Pending Stage 4 note' } });
    fireEvent.blur(textareas[0]);

    // Click Stage 4 in stepper tab navigation
    const stage4Tab = screen.getByRole('button', { name: /4\. Flag Issues/i });
    fireEvent.click(stage4Tab);

    // Blocked from Stage 4 while write is in flight
    expect(screen.queryByTestId('stage-4-heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Stage 4: Flag Potential Issues/i })).not.toBeInTheDocument();

    // Resolve write
    resolvePromise(true);

    // Enters Stage 4
    await waitFor(() => {
      expect(screen.getByTestId('stage-4-heading')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Stage 4: Flag Potential Issues/i })).toBeInTheDocument();
    });
  });

  it('a decision with a blank user comment persists its generated default note and proceeds', async () => {
    vi.mocked(submitReview).mockReset();
    vi.mocked(submitReview).mockResolvedValue(true);

    renderControlled();

    fireEvent.click(screen.getByTestId('evidence-library-open-qa-hub'));
    const verifyButtons = screen.getAllByRole('button', { name: /Verify Values \([1-9]\d*\)/i });
    fireEvent.click(verifyButtons[0]);

    // Click Confirmed on the first parameter without entering any comment
    const confirmButtons = screen.getAllByRole('button', { name: /^Confirm parameter /i });
    fireEvent.click(confirmButtons[0]);

    // Proceed to Stage 3
    const proceedBtn = screen.getByRole('button', { name: /Proceed to Stage 3/i });
    fireEvent.click(proceedBtn);

    await waitFor(() => {
      expect(submitReview).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'approved',
        expect.stringContaining('Verified as confirmed in QA/QC workbench'),
        expect.anything(),
        undefined,
      );
      expect(screen.getByText(/Stage 3: Admin Review & Publication Gate Status/i)).toBeInTheDocument();
    });
  });

  it('blocks Stage 3 transition and remains in Stage 2 when writes fail or reject', async () => {
    vi.mocked(submitReview).mockReset();
    vi.mocked(submitReview).mockResolvedValue(false); // Simulate server rejection

    renderControlled();

    fireEvent.click(screen.getByTestId('evidence-library-open-qa-hub'));
    const verifyButtons = screen.getAllByRole('button', { name: /Verify Values \([1-9]\d*\)/i });
    fireEvent.click(verifyButtons[0]);

    const textareas = screen.getAllByPlaceholderText(/Enter toxicologist notes/i);
    fireEvent.change(textareas[0], { target: { value: 'Attempted note write' } });

    const proceedBtn = screen.getByRole('button', { name: /Proceed to Stage 3/i });
    fireEvent.click(proceedBtn);

    await waitFor(() => {
      // Fail closed: Stage 3 header is NOT rendered
      expect(
        screen.queryByText(/Stage 3: Admin Review & Publication Gate Status/i),
      ).not.toBeInTheDocument();
      // User remains in Stage 2 with explicit error
      expect(
        screen.getByRole('heading', { name: /Extracted Parameter Values/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Cannot proceed: verification write\(s\) pending, unsaved, or failed/i),
      ).toBeInTheDocument();
    });
  });

  it('hydrates a needs_review record with historical [VERIFICATION: confirmed] note as needs_review, not confirmed', async () => {
    vi.mocked(fetchAllReviews).mockResolvedValue([
      {
        id: 'rev-contra-hist',
        parameter_value_id: 'pv-hc-bap-hh-food-sf',
        old_qa_status: 'approved',
        new_qa_status: 'needs_review',
        old_evidence_support_status: null,
        new_evidence_support_status: null,
        reviewer_note: '[VERIFICATION: confirmed] Historical note that was later reverted to needs_review',
        reviewed_by: 'user-1',
        reviewed_at: '2026-08-21T10:00:00Z',
      },
    ]);

    renderControlled();

    fireEvent.click(screen.getByTestId('evidence-library-open-qa-hub'));

    const verifyButtons = screen.getAllByRole('button', { name: /Verify Values \([1-9]\d*\)/i });
    fireEvent.click(verifyButtons[0]);

    await waitFor(() => {
      const textareas = screen.getAllByPlaceholderText(/Enter toxicologist notes/i);
      const values = textareas.map((t) => (t as HTMLTextAreaElement).value);
      expect(values).toContain('Historical note that was later reverted to needs_review');
    });

    const confirmBtn = screen.getByRole('button', {
      name: 'Confirm parameter pv-hc-bap-hh-food-sf',
    });
    const discrepancyBtn = screen.getByRole('button', {
      name: 'Flag discrepancy for parameter pv-hc-bap-hh-food-sf',
    });

    expect(confirmBtn).toBeInTheDocument();
    expect(discrepancyBtn).toBeInTheDocument();
    expect(confirmBtn.className).not.toContain('bg-emerald-100');
    expect(discrepancyBtn.className).not.toContain('bg-amber-100');
  });
});
