// Integration tests for MatrixDashboard (PR-A2 commit 6 wire-up).
// Covers: Calculator-tab render branch, lifted-state wiring,
// localStorage hydrate + persist round-trip, validate-on-load coercion,
// print:hidden on left sidebar, legacy DerivationSimulator retirement.
// Plain ASCII only.

import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { findSubstance } from '@/lib/matrix-options/substanceLibrary';

// Mock heavy children we do not need full coverage of in this integration
// suite. The Calculator-tab assertions exercise the real CategorySelector
// + SharedGlobalInputs + Eco* calculators + BackgroundAdjustment so the
// wire-up is end-to-end tested at that layer.

// Mock next/navigation router because MatrixDashboard now calls useRouter
// (PR-MAP-9 banner Refresh callback). Tests do not render an App Router.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/components/MathRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="math-renderer-mock">{content}</div>
  ),
}));
vi.mock('../ConceptualMatrix', () => ({
  default: () => <div data-testid="conceptual-matrix-mock" />,
}));
vi.mock('../TWGReviewPortal', () => ({
  default: () => <div data-testid="twg-review-portal-mock" />,
}));
vi.mock('../matrix-options/SsdWorkbench', () => ({
  default: () => <div data-testid="ssd-workbench-mock" />,
}));
// MatrixMapLoader statically imports leaflet + markercluster CSS;
// Vite's CSS pipeline cannot load the project's .mjs PostCSS config in
// the vitest worker. Mock the loader + its CSS dependencies for the
// MatrixDashboard tests. The Interactive Map tab IS exercised by the
// drag-handler + focus-toggle tests at the bottom of this suite (the
// stale comment here claimed it was not -- fixed in Phase 0 redesign
// 2026-06-05). Calculator + Guide + TWG-tab assertions run in the upper
// describe blocks.
// Same pattern as MatrixMap.test.tsx (2026-05-20 fork commit 89eee3f).
vi.mock('@/app/(dashboard)/matrix-map/MatrixMapLoader', () => ({
  default: () => <div data-testid="matrix-map-loader-mock" />,
}));
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet.markercluster/dist/MarkerCluster.css', () => ({}));
vi.mock('leaflet.markercluster/dist/MarkerCluster.Default.css', () => ({}));
vi.mock('@/lib/admin-utils', () => ({
  checkCurrentUserAdminStatus: vi.fn(() => new Promise<boolean>(() => {})),
}));

import MatrixDashboard from '../MatrixDashboard';

const DEFAULT_PROPS = {
  eqpCaseStudyContent: '',
  bsafCaseStudyContent: '',
  humanHealthContent: '',
  guideContent: '',
  finalDraftContent: '',
};

const LS_CATEGORY = 'matrix-options-active-category-v1';
const LS_TIER = 'matrix-options-guide-tier-v1';
const LS_SUBSTANCE = 'matrix-options-substance-v1';
const LS_JURISDICTION = 'matrix-options-jurisdiction-v1';
const GUIDE_MARKDOWN = fs.readFileSync(
  path.join(process.cwd(), 'matrix_research', 'content_drafts', 'The_Guide.md'),
  'utf8',
);

function clickCalculatorTab() {
  // The Calculator top-tab nav button.
  const tabBtn = screen.getByRole('tab', { name: /^Calculator$/ });
  fireEvent.click(tabBtn);
}

// Substance selection is a type-to-search combobox (item 1b), not a native select:
// open it and click the target option.
function selectSubstance(key: string) {
  fireEvent.click(screen.getByTestId('substance-combobox-input'));
  fireEvent.click(screen.getByTestId(`substance-option-${key}`));
}

describe('MatrixDashboard -- Matrix Options guide copy', () => {
  it('keeps the v1 guide focused on workflow instead of placeholder status copy', () => {
    expect(GUIDE_MARKDOWN).toMatch(/## 1\. How to Use This Workspace/);
    expect(GUIDE_MARKDOWN).toMatch(/\*\s+\*\*The Guide\*\*/);
    expect(GUIDE_MARKDOWN).toMatch(/## 2\. Project Roadmap/);
    expect(GUIDE_MARKDOWN).toMatch(/Scientific Literature Search/);
    expect(GUIDE_MARKDOWN).toMatch(/Jurisdictional Scan/);
    expect(GUIDE_MARKDOWN).not.toMatch(/Coming Soon/i);
    expect(GUIDE_MARKDOWN).not.toMatch(/placeholder/i);
    expect(GUIDE_MARKDOWN).not.toMatch(/What Is Working Now/i);
  });

  it('renders the v1 guide workflow copy in the Guide tab', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} guideContent={GUIDE_MARKDOWN} />);

    const renderers = screen.getAllByTestId('math-renderer-mock');
    expect(renderers).toHaveLength(1);
    expect(renderers[0]).toHaveTextContent(/The Guide: Matrix Options Workspace/);
    expect(renderers[0]).toHaveTextContent(/How to Use This Workspace/);
    expect(renderers[0]).toHaveTextContent(/Project Roadmap/);
    expect(screen.queryByText(/Coming Soon/i)).not.toBeInTheDocument();
  });
});

describe('MatrixDashboard -- Calculator tab wire-up (PR-A2 commit 6)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the Calculator branch with CategorySelector + SharedGlobalInputs + active calculator + BackgroundAdjustment', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    // Wire-up elements present.
    expect(
      screen.getByTestId('calculator-tab-content'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('category-selector')).toBeInTheDocument();
    expect(screen.getByTestId('shared-global-inputs')).toBeInTheDocument();
    expect(screen.getByTestId('calculator-guide-sidebar')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^General$/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    // Default activeCategory = 'eco-direct' -> Eco-Direct calculator renders.
    expect(
      screen.getByTestId('eco-direct-eqp-calculator'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('regulatory-frame-notice-eco-direct-eqp'),
    ).toHaveTextContent(/BC Protocol 1 v5 DRA/);
    // Eco-Food NOT rendered when activeCategory = 'eco-direct'.
    expect(
      screen.queryByTestId('eco-food-bsaf-calculator'),
    ).not.toBeInTheDocument();
    // BackgroundAdjustment panel still appears at the bottom.
    expect(screen.getByRole('heading', { name: /Background Adjustment/i })).toBeInTheDocument();
  });

  it('clicking hh-direct renders the HH Direct Contact calculator and unmounts the eco calculators', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    fireEvent.click(screen.getByTestId('category-selector-hh-direct'));
    expect(
      screen.getByTestId('hh-direct-contact-calculator'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('eco-direct-eqp-calculator'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('eco-food-bsaf-calculator'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('hh-food-web-calculator'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('hh-calculator-unavailable-stub'),
    ).not.toBeInTheDocument();
  });

  it('clicking hh-food renders the HH Food Web calculator and unmounts the eco calculators', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    fireEvent.click(screen.getByTestId('category-selector-hh-food'));
    expect(
      screen.getByTestId('hh-food-web-calculator'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('eco-direct-eqp-calculator'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('eco-food-bsaf-calculator'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('hh-direct-contact-calculator'),
    ).not.toBeInTheDocument();
  });

  it('switching CategorySelector to eco-food re-renders Eco-Food calculator (and unmounts Eco-Direct)', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    expect(
      screen.getByTestId('eco-direct-eqp-calculator'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('category-selector-eco-food'));
    expect(
      screen.queryByTestId('eco-direct-eqp-calculator'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('eco-food-bsaf-calculator'),
    ).toBeInTheDocument();
  });

  it('does NOT render the legacy DerivationSimulator (retired in PR-A2)', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    // The legacy mock-arithmetic panel had distinctive copy referencing
    // jurisdictions like "BC Status Quo". Confirm absence by checking
    // that no element labels itself as the simulator's pathway tabs.
    expect(screen.queryByText(/BC Status Quo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/HumanHealth/)).not.toBeInTheDocument();
  });

  it('substance change in SharedGlobalInputs flows through to the active EcoDirect calculator (substance summary updates)', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    // Default substance = Total PCBs (Aroclor 1254). benzo_a_pyrene's fcv_ug_per_L was nulled
    // 2026-07-02 (fabricated-source demotion -- see substanceLibrary.ts notes), which drops it out of
    // SharedGlobalInputs' EQP_CAPABLE filter (logKow !== null && fcv_ug_per_L !== null); PCBs is the
    // next EqP-capable library row and becomes DEFAULT_SUBSTANCE_KEY.
    expect(
      screen.getByTestId('eqp-substance-summary').textContent,
    ).toMatch(/PCBs/);
    // Change substance to B[a]P.
    selectSubstance('benzo_a_pyrene');
    expect(
      screen.getByTestId('eqp-substance-summary').textContent,
    ).toMatch(/Benzo\[a\]pyrene/);
  });

  it('jurisdiction change in SharedGlobalInputs persists to localStorage', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    fireEvent.change(screen.getByTestId('shared-jurisdiction-select'), {
      target: { value: 'ccme-sediment-quality' },
    });
    expect(window.localStorage.getItem(LS_JURISDICTION)).toBe(
      'ccme-sediment-quality',
    );
    expect(
      screen.getByTestId('regulatory-frame-notice-eco-direct-eqp'),
    ).toHaveTextContent(/CCME SQG/);
    expect(
      screen.getByTestId('regulatory-frame-effect-eco-direct-eqp'),
    ).toHaveTextContent(/suppresses the calculator input default/i);
    expect(screen.getByTestId('calculator-value-search-guidance')).toHaveTextContent(
      /filters lookup to Canada federal, general records/i,
    );
  });

  it('persists activeCategory + substanceKey on change', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    fireEvent.click(screen.getByTestId('category-selector-eco-food'));
    expect(window.localStorage.getItem(LS_CATEGORY)).toBe('eco-food');
    selectSubstance('total_pcbs_aroclor_1254');
    expect(window.localStorage.getItem(LS_SUBSTANCE)).toBe(
      'total_pcbs_aroclor_1254',
    );
  });

  // Plan v5 Delta 1: validate-on-load coercion.
  it('hydrates valid localStorage values on mount (activeCategory + substanceKey + jurisdiction)', () => {
    window.localStorage.setItem(LS_CATEGORY, 'eco-food');
    window.localStorage.setItem(LS_SUBSTANCE, 'total_pcbs_aroclor_1254');
    window.localStorage.setItem(LS_JURISDICTION, 'ccme-sediment-quality');
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    expect(
      screen.getByTestId('eco-food-bsaf-calculator'),
    ).toBeInTheDocument();
    expect(
      (screen.getByTestId('substance-combobox-input') as HTMLInputElement)
        .value,
    ).toBe(findSubstance('total_pcbs_aroclor_1254')?.displayName);
    expect(
      (screen.getByTestId('shared-jurisdiction-select') as HTMLSelectElement)
        .value,
    ).toBe('ccme-sediment-quality');
  });

  it('hydrates legacy jurisdiction ids by migrating them to regulatory frames', () => {
    window.localStorage.setItem(LS_JURISDICTION, 'federal-ccme');
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    expect(
      (screen.getByTestId('shared-jurisdiction-select') as HTMLSelectElement)
        .value,
    ).toBe('ccme-sediment-quality');
    expect(window.localStorage.getItem(LS_JURISDICTION)).toBe(
      'ccme-sediment-quality',
    );
  });

  it('hydrates hh-direct from localStorage and renders the HH Direct calculator', () => {
    window.localStorage.setItem(LS_CATEGORY, 'hh-direct');
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    expect(
      screen.getByTestId('hh-direct-contact-calculator'),
    ).toBeInTheDocument();
    // EcoDirect calculator NOT rendered when on hh-direct.
    expect(
      screen.queryByTestId('eco-direct-eqp-calculator'),
    ).not.toBeInTheDocument();
    // localStorage retains the persisted value (no longer cleared).
    expect(window.localStorage.getItem(LS_CATEGORY)).toBe('hh-direct');
  });

  it('falls back to default substanceKey when an unknown substance is persisted', () => {
    window.localStorage.setItem(LS_SUBSTANCE, 'made_up_substance');
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    // Substance dropdown shows the default EqP-capable row. benzo_a_pyrene's fcv_ug_per_L was nulled
    // 2026-07-02 (fabricated-source demotion), dropping it out of the EQP_CAPABLE filter; Total PCBs
    // (Aroclor 1254) is the next EqP-capable row and is now the default.
    expect(
      (screen.getByTestId('substance-combobox-input') as HTMLInputElement)
        .value,
    ).toBe(findSubstance('total_pcbs_aroclor_1254')?.displayName);
    expect(window.localStorage.getItem(LS_SUBSTANCE)).toBe(
      'total_pcbs_aroclor_1254',
    );
  });

  it('falls back to default jurisdiction when an unknown jurisdiction is persisted', () => {
    window.localStorage.setItem(LS_JURISDICTION, 'eu-reach');
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    expect(
      (screen.getByTestId('shared-jurisdiction-select') as HTMLSelectElement)
        .value,
    ).toBe('bc-protocol1-v5-dra');
    expect(window.localStorage.getItem(LS_JURISDICTION)).toBe(
      'bc-protocol1-v5-dra',
    );
  });

  it('falls back to default audience-tier when an unknown tier is persisted', () => {
    window.localStorage.setItem(LS_TIER, 'expert-mode');
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    expect(
      screen.getByRole('button', { name: /^General$/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem(LS_TIER)).toBe('general');
  });

  it('switches and persists the Calculator sidebar audience guide tier', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();

    fireEvent.click(screen.getByRole('button', { name: /^Technical$/ }));

    expect(window.localStorage.getItem(LS_TIER)).toBe('technical');
    expect(
      screen.getByRole('button', { name: /^Technical$/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Technical notes/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Human Health Direct Contact combines/i),
    ).toBeInTheDocument();
  });

  it('shows active calculator value search instead of quick-reference copy', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    // Explicitly select benzo_a_pyrene: it is no longer the DEFAULT_SUBSTANCE_KEY (its fcv_ug_per_L
    // was nulled 2026-07-02, dropping it out of the EQP_CAPABLE filter -- Total PCBs is now default),
    // but this test's assertions are specifically about B[a]P's needs_review logKow scaffold, so
    // select it explicitly to keep exercising the same content.
    selectSubstance('benzo_a_pyrene');

    const panel = screen.getByTestId('calculator-value-search-panel');
    expect(panel).toHaveTextContent(/Value lookup/i);
    expect(panel).toHaveTextContent(/Benzo\[a\]pyrene/i);
    expect(panel).toHaveTextContent(/Ecological Direct Contact/i);
    expect(panel).toHaveTextContent(/Choose the substance of interest/i);
    // The FCV suggestion no longer matches B[a]P: pv-bap-fcv was DELETED 2026-07-02 (fabricated-
    // source demotion -- see substanceLibrary.ts notes), so no eco-direct-eqp FCV catalog row exists
    // for this substance at all. The remaining catalog row (logKow) still surfaces its own
    // suggestion + needs_review / ESB Tier-2 provenance.
    expect(
      within(panel).getByRole('button', { name: /^Log Kow$/ }),
    ).toBeInTheDocument();
    expect(panel).toHaveTextContent(/Needs original-source verification/i);
    expect(panel).toHaveTextContent(/US EPA ESB Tier 2 values/i);
    expect(panel).not.toHaveTextContent(/US EPA IRIS/i);
    expect(screen.queryByText(/Calculator Quick Reference/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Active Poll/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/will dynamically appear/i)).not.toBeInTheDocument();
  });

  it('shows expanded human-health substances and suggested value filters', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();

    // Open the substance combobox and confirm expanded HH substances are offered.
    fireEvent.click(screen.getByTestId('substance-combobox-input'));
    const substanceListbox = screen.getByRole('listbox');
    expect(
      within(substanceListbox).getByRole('option', { name: /^Benzene$/ }),
    ).toBeInTheDocument();
    expect(
      within(substanceListbox).getByRole('option', {
        name: /^Trichloroethylene$/,
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('category-selector-hh-direct'));
    selectSubstance('benzene');

    const panel = screen.getByTestId('calculator-value-search-panel');
    expect(panel).toHaveTextContent(/Benzene/i);
    expect(panel).toHaveTextContent(/Human Health Direct Contact/i);
    expect(panel).toHaveTextContent(/Choose the substance of interest/i);

    const suggestions = within(panel).getByTestId('value-search-suggestions');
    for (const label of ['RfD', 'Slope factor', 'RfC', 'Unit risk']) {
      expect(
        within(suggestions).getByRole('button', { name: label }),
      ).toBeInTheDocument();
    }

    fireEvent.click(within(suggestions).getByRole('button', { name: 'RfC' }));

    expect(
      within(panel).getByPlaceholderText(/Search parameter or source/i),
    ).toHaveValue('RfC');
    expect(panel).toHaveTextContent(/Benzene inhalation RfC - IRIS/i);
    expect(panel).not.toHaveTextContent(/Benzene oral RfD - IRIS/i);
  });

  it('filters calculator value search and opens exact reference details', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    selectSubstance('arsenic_inorganic');
    fireEvent.click(screen.getByTestId('category-selector-hh-food'));

    const panel = screen.getByTestId('calculator-value-search-panel');
    expect(panel).toHaveTextContent(/Arsenic \(inorganic\)/i);
    expect(panel).toHaveTextContent(/Human Health Food Web/i);
    fireEvent.change(
      within(panel).getByPlaceholderText(/Search parameter or source/i),
      {
        target: { value: 'Protocol 28' },
      },
    );
    expect(panel).toHaveTextContent(/Arsenic oral RfD - Protocol 28 lead/i);
    expect(panel).toHaveTextContent(/BC Protocol 28 v3\.0/i);

    fireEvent.click(
      within(panel).getByRole('button', {
        name: /Open reference details for Arsenic oral RfD/i,
      }),
    );

    expect(screen.getByTestId('references-values-tab')).toBeInTheDocument();
    expect(screen.getByText(/Value: pv p28 arsenic hh food rfd/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Arsenic oral RfD - Protocol 28 lead/,
    );
  });

  it('renders the References & Values tab with the evidence library', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^References & Values$/ }));

    expect(screen.getByTestId('references-values-tab')).toBeInTheDocument();
    // Defaults to the Values table (By Parameter / Equations tabs were retired).
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Benzo\[a\]pyrene log Kow/,
    );
  });

  it('opens References & Values from a calculator provenance receipt', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();

    // Default substance is now Total PCBs (Aroclor 1254): benzo_a_pyrene's fcv_ug_per_L was nulled
    // 2026-07-02 (fabricated-source demotion), dropping it out of the EQP_CAPABLE filter. pv-pcb-fcv
    // is the receipt's FCV row now (re-cited + promoted to approved_source_backed the same day).
    const calculatorPanel = screen.getAllByTestId('calculator-provenance-panel')[0];
    fireEvent.click(
      within(calculatorPanel).getByText(/References and provenance/),
    );
    fireEvent.click(
      within(calculatorPanel).getByRole('button', {
        name: /Open References & Values/i,
      }),
    );

    expect(screen.getByTestId('references-values-tab')).toBeInTheDocument();
    expect(screen.getByText(/Value: pv pcb fcv/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Aroclor 1254 FCV/,
    );
  });

  it('opens read-only alternatives from a calculator receipt row', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    selectSubstance('arsenic_inorganic');
    fireEvent.click(screen.getByTestId('category-selector-hh-food'));

    const calculator = screen.getByTestId('hh-food-web-calculator');
    const calculatorPanel = within(calculator).getByTestId(
      'calculator-provenance-panel',
    );
    fireEvent.click(
      within(calculatorPanel).getByText(/References and provenance/),
    );
    fireEvent.click(
      within(calculatorPanel).getByRole('button', {
        name: /^View alternatives for Oral RfD$/,
      }),
    );

    expect(screen.getByTestId('references-values-tab')).toBeInTheDocument();
    expect(
      screen.getByText(/Input: rfd oral mg per kg bw day/i),
    ).toBeInTheDocument();
    // Alternatives now open in the default Values table (the grouped By Parameter view was retired).
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(/Arsenic/i);
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(/Protocol 28/);
  });

  it('shows methodology quick-reference copy on Methodology by pathway', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(
      screen.getByRole('tab', { name: /^Methodology by pathway$/ }),
    );

    expect(screen.getByTestId('matrix-options-right-reference')).toHaveTextContent(
      /Methodology Quick Reference/i,
    );
    expect(screen.getByText(/Start with the selected pathway group/i)).toHaveTextContent(
      /Ecological: EqP & AVS/i,
    );
    expect(screen.queryByText(/Active Poll/i)).not.toBeInTheDocument();
  });

  // P2-2: retired Equations content now renders in the Methodology by pathway
  // right-drawer Quick Reference, filtered to the active side-tab's pathway(s).
  // The cross-cutting background-adjustment equation is intentionally omitted.
  it('shows pathway-filtered derivation equations in the Methodology by pathway drawer', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(
      screen.getByRole('tab', { name: /^Methodology by pathway$/ }),
    );

    // Default side-tab (Ecological: EqP & AVS) -> one EqP equation.
    const eqpReference = screen.getByTestId('jurisdictional-equation-reference');
    expect(eqpReference).toHaveTextContent(/Eco-Direct EqP sediment benchmark/i);
    expect(within(eqpReference).getAllByRole('group')).toHaveLength(1);
    // Background UTL adjustment equation never appears in the drawer.
    expect(eqpReference).not.toHaveTextContent(/Background UTL/i);

    // Switch to Human Health Pathways -> two equations (direct + food).
    fireEvent.click(screen.getByText('Human Health Pathways'));
    const hhReference = screen.getByTestId('jurisdictional-equation-reference');
    expect(within(hhReference).getAllByRole('group')).toHaveLength(2);
    expect(hhReference).toHaveTextContent(
      /Human Health Direct Contact sediment screen/i,
    );
    expect(hhReference).toHaveTextContent(
      /Human Health Food Web sediment screen/i,
    );
    expect(hhReference).not.toHaveTextContent(/Background UTL/i);
    expect(screen.queryByText(/Eco-Direct EqP sediment benchmark/i)).not.toBeInTheDocument();
  });

  it('hydrates the Calculator sidebar audience guide tier from localStorage', () => {
    window.localStorage.setItem(LS_TIER, 'practitioner');
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();

    expect(
      screen.getByRole('button', { name: /^Practitioner$/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Review workflow/i)).toBeInTheDocument();
  });

  // Plan v3 section 4.2 + section 10: print:hidden on left sidebar when
  // Calculator tab is active. The conditional class is applied as part of
  // the cn(...) call; verify the wrapper element carries it.
  it('applies print:hidden on the left sidebar wrapper when Calculator tab is active', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    const wrapper = screen.getByTestId('left-sidebar-wrapper');
    expect(wrapper.className).toMatch(/\bprint:hidden\b/);
  });

  it('does NOT apply print:hidden on the left sidebar when on Methodology by pathway tab', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    const jurisTab = screen.getByRole('tab', {
      name: /^Methodology by pathway$/,
    });
    fireEvent.click(jurisTab);
    const wrapper = screen.getByTestId('left-sidebar-wrapper');
    expect(wrapper.className).not.toMatch(/\bprint:hidden\b/);
  });

  // Codex holistic review 2026-05-19 P3: the test name and the assertion
  // disagreed in the prior version. Renamed to describe what is actually
  // being verified -- per-calculator local state (foc) is UNMOUNT-FRESH,
  // i.e., it resets to default when the user swaps categories away and
  // back. This is the deliberate lift contract per plan v3 section 4.3:
  // only substance + jurisdiction are lifted; per-pathway inputs stay
  // local to each calculator and are lost on unmount.
  it('per-calculator local state is unmount-fresh on category swap (foc resets when EcoDirect remounts)', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    // Adjust Eco-Direct foc to 5%.
    fireEvent.change(screen.getByLabelText(/Fraction Organic Carbon/i), {
      target: { value: '5' },
    });
    expect(screen.getAllByText(/5\.00 %/).length).toBeGreaterThan(0);
    // Switch to Eco-Food (unmounts EcoDirect).
    fireEvent.click(screen.getByTestId('category-selector-eco-food'));
    expect(
      screen.queryByTestId('eco-direct-eqp-calculator'),
    ).not.toBeInTheDocument();
    // Switch back to Eco-Direct: foc resets to default 2% because the
    // component unmounted and lost local state.
    fireEvent.click(screen.getByTestId('category-selector-eco-direct'));
    expect(screen.getAllByText(/2\.00 %/).length).toBeGreaterThan(0);
  });

  it('renders Matrix Map right drawer at the default resizable width', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    const wrapper = screen.getByTestId('matrix-map-right-panel-wrapper');
    expect(wrapper).toHaveStyle({ width: '480px' });
    expect(screen.getByRole('separator', { name: /Resize measurement workbench/i })).toBeInTheDocument();
  });

  it('renders Matrix Map left wrapper at the default width with a resize separator', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    const leftWrapper = screen.getByTestId('matrix-map-left-panel-wrapper');
    // Default left panel width = 320px (MATRIX_MAP_LEFT_PANEL_DEFAULT_WIDTH).
    expect(leftWrapper).toHaveStyle({ width: '320px' });
    expect(
      screen.getByRole('separator', { name: /Resize selection stats panel/i }),
    ).toBeInTheDocument();
  });

  it('renders the SSD Workbench as a Matrix Options top-level tab', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByRole('tab', { name: /^SSD Workbench$/ }));

    expect(screen.getByTestId('ssd-workbench-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('left-sidebar-wrapper')).not.toBeInTheDocument();
  });

  it('focuses and collapses the Matrix Map workbench without remounting the drawer surface', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    const wrapper = screen.getByTestId('matrix-map-right-panel-wrapper');
    fireEvent.click(screen.getByRole('button', { name: /Focus measurement workbench/i }));
    await waitFor(() => {
      expect(wrapper.className).toContain('absolute');
      expect(
        screen.getByRole('button', { name: /Collapse measurement workbench focus/i }),
      ).toBeInTheDocument();
    });

    // Focused width is calc(100% - 24px) with insets inset-y-2 right-3.
    expect(wrapper).toHaveStyle({ width: 'calc(100% - 24px)' });

    fireEvent.click(screen.getByRole('button', { name: /Collapse measurement workbench focus/i }));
    await waitFor(() => {
      expect(wrapper.className).not.toContain('absolute');
      expect(wrapper).toHaveStyle({ width: '480px' });
    });
  });

  it('suppresses BOTH resize handles while the workbench is focused', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    // Both handles present before focusing.
    expect(
      screen.getByRole('separator', { name: /Resize measurement workbench/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('separator', { name: /Resize selection stats panel/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Focus measurement workbench/i }));

    await waitFor(() => {
      // Both handles suppressed in focus mode.
      expect(
        screen.queryByRole('separator', { name: /Resize measurement workbench/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('separator', { name: /Resize selection stats panel/i }),
      ).not.toBeInTheDocument();
    });
  });

  it('right drag handler widens the right panel when dragging left', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    const wrapper = screen.getByTestId('matrix-map-right-panel-wrapper');
    // Initial width = 480px.
    expect(wrapper).toHaveStyle({ width: '480px' });

    const sep = screen.getByRole('separator', { name: /Resize measurement workbench/i });
    // Simulate drag: pointerdown at x=200, then pointermove to x=150 (left = wider right).
    fireEvent.pointerDown(sep, { clientX: 200 });
    fireEvent(window, new PointerEvent('pointermove', { clientX: 150, bubbles: true }));

    // Width should increase by 50 from initial 480 -> 530.
    // clamp: max = 1280 - 320 - 48 = 912; min = 360. 530 is within range.
    expect(wrapper).toHaveStyle({ width: '530px' });

    fireEvent(window, new PointerEvent('pointerup', { bubbles: true }));
  });

  it('right drag handler narrows the right panel when dragging right', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    const wrapper = screen.getByTestId('matrix-map-right-panel-wrapper');
    const sep = screen.getByRole('separator', { name: /Resize measurement workbench/i });
    // pointerdown at x=200, pointermove to x=250 (right = narrower right panel).
    fireEvent.pointerDown(sep, { clientX: 200 });
    fireEvent(window, new PointerEvent('pointermove', { clientX: 250, bubbles: true }));

    // Width should decrease by 50 from 480 -> 430; but min = 360, so 430 > 360.
    expect(wrapper).toHaveStyle({ width: '430px' });

    fireEvent(window, new PointerEvent('pointerup', { bubbles: true }));
  });

  it('right drag handler clamps against min width', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    const wrapper = screen.getByTestId('matrix-map-right-panel-wrapper');
    const sep = screen.getByRole('separator', { name: /Resize measurement workbench/i });
    // Drag far right -- desired = 480 - 200 = 280 which is below min 360.
    fireEvent.pointerDown(sep, { clientX: 200 });
    fireEvent(window, new PointerEvent('pointermove', { clientX: 400, bubbles: true }));

    expect(wrapper).toHaveStyle({ width: '360px' });

    fireEvent(window, new PointerEvent('pointerup', { bubbles: true }));
  });

  it('left drag handler widens the left panel when dragging right', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    const leftWrapper = screen.getByTestId('matrix-map-left-panel-wrapper');
    // Initial width = 320px.
    expect(leftWrapper).toHaveStyle({ width: '320px' });

    const leftSep = screen.getByRole('separator', { name: /Resize selection stats panel/i });
    // pointerdown at x=320, pointermove to x=370 (right = wider left panel).
    fireEvent.pointerDown(leftSep, { clientX: 320 });
    fireEvent(window, new PointerEvent('pointermove', { clientX: 370, bubbles: true }));

    // Width increases by 50: 320 + 50 = 370.
    expect(leftWrapper).toHaveStyle({ width: '370px' });

    fireEvent(window, new PointerEvent('pointerup', { bubbles: true }));
  });

  it('left drag handler narrows the left panel when dragging left', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    const leftWrapper = screen.getByTestId('matrix-map-left-panel-wrapper');
    const leftSep = screen.getByRole('separator', { name: /Resize selection stats panel/i });
    // pointerdown at x=320, pointermove to x=280 (left = narrower left panel).
    fireEvent.pointerDown(leftSep, { clientX: 320 });
    fireEvent(window, new PointerEvent('pointermove', { clientX: 280, bubbles: true }));

    // Width decreases by 40: 320 - 40 = 280, which equals min (280).
    expect(leftWrapper).toHaveStyle({ width: '280px' });

    fireEvent(window, new PointerEvent('pointerup', { bubbles: true }));
  });

  it('left drag handler clamps against min width', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    const leftWrapper = screen.getByTestId('matrix-map-left-panel-wrapper');
    const leftSep = screen.getByRole('separator', { name: /Resize selection stats panel/i });
    // Drag far left -- desired = 320 - 200 = 120 which is below min 280.
    fireEvent.pointerDown(leftSep, { clientX: 320 });
    fireEvent(window, new PointerEvent('pointermove', { clientX: 120, bubbles: true }));

    expect(leftWrapper).toHaveStyle({ width: '280px' });

    fireEvent(window, new PointerEvent('pointerup', { bubbles: true }));
  });

  // Keyboard nudge tests: ArrowLeft/ArrowRight on each separator.
  // Right handle natural direction: ArrowLeft widens right, ArrowRight narrows.
  it('right handle keyboard ArrowLeft nudges right panel wider by 16px', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    const wrapper = screen.getByTestId('matrix-map-right-panel-wrapper');
    const sep = screen.getByRole('separator', { name: /Resize measurement workbench/i });

    fireEvent.keyDown(sep, { key: 'ArrowLeft' });

    // 480 + 16 = 496
    expect(wrapper).toHaveStyle({ width: '496px' });
  });

  it('right handle keyboard ArrowRight nudges right panel narrower by 16px', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    const wrapper = screen.getByTestId('matrix-map-right-panel-wrapper');
    const sep = screen.getByRole('separator', { name: /Resize measurement workbench/i });

    fireEvent.keyDown(sep, { key: 'ArrowRight' });

    // 480 - 16 = 464
    expect(wrapper).toHaveStyle({ width: '464px' });
  });

  // Left handle natural direction: ArrowRight widens left, ArrowLeft narrows.
  it('left handle keyboard ArrowRight nudges left panel wider by 16px', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    const leftWrapper = screen.getByTestId('matrix-map-left-panel-wrapper');
    const leftSep = screen.getByRole('separator', { name: /Resize selection stats panel/i });

    fireEvent.keyDown(leftSep, { key: 'ArrowRight' });

    // 320 + 16 = 336
    expect(leftWrapper).toHaveStyle({ width: '336px' });
  });

  it('left handle keyboard ArrowLeft nudges left panel narrower by 16px', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    const leftWrapper = screen.getByTestId('matrix-map-left-panel-wrapper');
    const leftSep = screen.getByRole('separator', { name: /Resize selection stats panel/i });

    fireEvent.keyDown(leftSep, { key: 'ArrowLeft' });

    // 320 - 16 = 304
    expect(leftWrapper).toHaveStyle({ width: '304px' });
  });

  it('keyboard nudge clamps at min width', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    const leftWrapper = screen.getByTestId('matrix-map-left-panel-wrapper');
    const leftSep = screen.getByRole('separator', { name: /Resize selection stats panel/i });

    // Nudge down many times -- should floor at 280.
    for (let i = 0; i < 20; i++) {
      fireEvent.keyDown(leftSep, { key: 'ArrowLeft' });
    }

    expect(leftWrapper).toHaveStyle({ width: '280px' });
  });

  // Regression suite: the ASSEMBLED Calculator tab. Both defects below shipped
  // because every component numbered/formatted itself correctly IN ISOLATION;
  // nothing tested the page as a whole. These tests read the whole rendered
  // Calculator tab (CalculatorSummaryBar + the active pathway calculator +
  // CumulativeEffectsCalculator + HHInhalationCalculator + BackgroundAdjustment,
  // all stacked together exactly as MatrixDashboard.tsx composes them) and
  // assert properties of the COMPOSITION, not of any one child.
  describe('MatrixDashboard -- ASSEMBLED Calculator tab coherence', () => {
    beforeEach(() => {
      window.localStorage.clear();
    });

    // Collects every CalculatorStage-wrapped section currently in the
    // document. CalculatorStage (src/components/matrix-options/CalculatorStage.tsx)
    // is the ONLY component that stamps data-stage-state, so this walks the
    // whole assembled page, not any single calculator's subtree.
    interface CollectedStage {
      testId: string;
      label: string;
      number: number;
      total: number;
      current: boolean;
    }

    function collectStages(): CollectedStage[] {
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>('[data-stage-state]'),
      );
      return sections.map((el) => {
        const labelEl = within(el).getByText(/^Stage \d+ of \d+$/);
        const label = labelEl.textContent ?? '';
        const match = label.match(/^Stage (\d+) of (\d+)$/);
        return {
          testId: el.getAttribute('data-testid') ?? '(no testid)',
          label,
          number: match ? Number(match[1]) : NaN,
          total: match ? Number(match[2]) : NaN,
          current: el.getAttribute('data-stage-current') === 'true',
        };
      });
    }

    function describeStages(stages: CollectedStage[]): string {
      if (stages.length === 0) return '(no stages found on the page)';
      return stages
        .map(
          (s) =>
            `  ${s.testId}: "${s.label}"${s.current ? ' [CURRENT]' : ''}`,
        )
        .join('\n');
    }

    it('renders the assembled stage sequence as exactly 1, 2, 3, 4 with no duplicates, no gaps, and one shared denominator', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();

      const stages = collectStages();
      const failureContext = () =>
        `Actual stages rendered on the assembled Calculator tab:\n${describeStages(stages)}`;

      // Regression guard for defect 1: two competing "Stage 1 of 2" blocks
      // followed by a "Stage 3 of 5" (contradictory denominators) is exactly
      // what this assertion set catches. If a calculator or
      // BackgroundAdjustment is ever wired with the wrong `number` or
      // `totalStages` prop, or a duplicate stage 1 reappears, this fails here.
      const numbers = stages.map((s) => s.number).sort((a, b) => a - b);
      expect(numbers, failureContext()).toEqual([1, 2, 3, 4]);

      const totals = new Set(stages.map((s) => s.total));
      expect(
        totals.size,
        `Every stage must report the SAME total ("of N"), but found ${totals.size} distinct totals: ${[...totals].join(', ')}.\n${failureContext()}`,
      ).toBe(1);

      const sharedTotal = [...totals][0];
      for (const s of stages) {
        expect(
          s.number <= sharedTotal,
          `Stage "${s.testId}" claims to be stage ${s.number} of ${s.total}, which is beyond the shared total of ${sharedTotal}.\n${failureContext()}`,
        ).toBe(true);
      }
    });

    it('renders the assembled stage sequence in the same 1-4 coherent shape for a different active category (eco-food)', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-eco-food'));

      const stages = collectStages();
      const numbers = stages.map((s) => s.number).sort((a, b) => a - b);
      expect(
        numbers,
        `Actual stages rendered:\n${describeStages(stages)}`,
      ).toEqual([1, 2, 3, 4]);
      const totals = new Set(stages.map((s) => s.total));
      expect(totals).toEqual(new Set([4]));
    });

    it('shows exactly one "current" stage when every upstream input is valid', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-hh-direct'));

      const stages = collectStages();
      const currentStages = stages.filter((s) => s.current);
      expect(
        currentStages.length,
        `Expected exactly one current stage; found ${currentStages.length}: ${currentStages.map((s) => s.testId).join(', ') || '(none)'}.\n${describeStages(stages)}`,
      ).toBe(1);
    });

    it('shows exactly one "current" stage when an upstream input is invalid (never zero, never more than one)', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-hh-direct'));

      // Break Stage 1 (exposure factors) with an invalid body weight. This
      // flips hh-direct-stage-1 to blocked/current and hh-direct-stage-2 to
      // waiting/not-current (see HHDirectContactCalculator.tsx stage1Blocked).
      fireEvent.change(screen.getByTestId('hh-direct-bw-input'), {
        target: { value: '-1' },
      });

      const stages = collectStages();
      const currentStages = stages.filter((s) => s.current);
      expect(
        currentStages.length,
        `Expected exactly one current stage after an upstream input went invalid; found ${currentStages.length}: ${currentStages.map((s) => s.testId).join(', ') || '(none)'}.\n${describeStages(stages)}`,
      ).toBe(1);
      // The current stage must be the one that is actually broken (Stage 1),
      // not the one waiting on it (Stage 2) -- a test that only counted
      // "exactly one" without checking WHICH one would pass even if the
      // current marker pointed at the wrong stage.
      expect(currentStages[0].testId).toBe('hh-direct-stage-1');
    });

    // Regression guard for defect 2: the same preliminary standard rendered
    // as "5.7516" in the summary bar and "5.752" in the calculator hero
    // because the two components used different formatters
    // (toFixed(4) vs toPrecision(4)). Both now default to the shared
        // formatMagnitude() (src/lib/matrix-options/formatMagnitude.ts), but a
    // regression could reintroduce a divergent formatter (e.g. a
    // `formatValue` override on the summary-bar slot, or a hardcoded
    // toPrecision/toFixed call in the calculator hero) without either
    // component's own isolated test catching it, because each would still
    // render internally consistently -- only comparing the two rendered
    // STRINGS side by side catches this.
    it('renders the SAME preliminary-standard string in the summary bar and the calculator hero', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-hh-direct'));

      // Push body weight way up (the preliminary standard scales with BW in
      // the numerator -- see humanHealthDirectContact) so the preliminary
      // standard's magnitude lands comfortably at or above 0.1 --
      // formatMagnitude's two branches (toFixed(4) vs toPrecision(4)) only
      // actually diverge from each other at/above that threshold (see
      // formatMagnitude.ts's doc comment: below 0.1, toPrecision(4) is used
      // on both sides of any hypothetical divergence and would
      // coincidentally agree). A value below 0.1 would pass under both the
      // old broken formatting and the current fixed formatting, proving
      // nothing.
      fireEvent.change(screen.getByTestId('hh-direct-bw-input'), {
        target: { value: '100000000' },
      });

      const summaryValueEl = screen.getByTestId(
        'calculator-summary-bar-preliminary-value',
      );
      const heroEl = screen.getByTestId('hh-direct-preliminary-standard');

      const summaryText = summaryValueEl.textContent?.trim() ?? '';
      // The hero renders "<value> mg/kg dry" inside one text node run;
      // pull out just the numeric token for a like-for-like comparison
      // with the summary bar's isolated value slot.
      const heroMatch = heroEl.textContent?.match(/([\d.]+)\s*mg\/kg dry/);
      const heroValueText = heroMatch ? heroMatch[1] : '(no numeric value found)';

      const parsedMagnitude = Number(summaryText);
      expect(
        Number.isFinite(parsedMagnitude) && parsedMagnitude >= 0.1,
        `Test setup did not reach the >= 0.1 magnitude range needed to distinguish the two formatMagnitude branches (summary bar showed "${summaryText}"). Adjust the hh-direct-ir-sed-input value above.`,
      ).toBe(true);

      expect(
        summaryText,
        `Summary bar preliminary value ("${summaryText}") and calculator hero preliminary value ("${heroValueText}") disagree. This is exactly the "5.7516 vs 5.752" defect: two different formatters were applied to the same number in two different components.`,
      ).toBe(heroValueText);
    });

    // Fix 1 (P1, third adversarial round, 2026-08-14): the formatter-agreement
    // test above only ever exercised hh-direct's preliminary-standard hero. It
    // could not have caught (and did not catch) HHInhalationCalculator's
    // sedS/nonCancerSedS/cancerSedS, which rendered with a raw .toPrecision(4)
    // call instead of the shared formatMagnitude(). Generalized here to every
    // OTHER component on the assembled Calculator tab that renders a derived
    // standard, or a value directly compared against one: HHInhalationCalculator
    // (a distinct pathway stacked unconditionally below the active category,
    // per MatrixDashboard.tsx) and CumulativeEffectsCalculator (its "equivalent
    // concentration" is compared to a screening standard via
    // compareEquivalentToStandard() in cumulative.ts). Both are pushed to a
    // magnitude >= 0.1 -- formatMagnitude's toFixed(4) branch, which is the
    // ONLY regime where it disagrees with a raw toPrecision(4) call (below
    // 0.1 the two happen to produce identical output; see
    // formatMagnitude.ts's doc comment) -- and asserted to show exactly 4
    // digits after the decimal point. A regression that reintroduces
    // toPrecision(4) on either value would print FEWER than 4 decimal digits
    // at this magnitude (e.g. "15.21" or "312.9" instead of "15.2076" /
    // "312.8571") and fail this test.
    function assertFourDecimalDigits(text: string, label: string): void {
      const match = text.match(/(\d+)\.(\d+)/);
      expect(
        match,
        `${label}: expected a decimal number with at least 4 fractional digits in "${text}", found none.`,
      ).not.toBeNull();
      const [, wholePart, fractionPart] = match as RegExpMatchArray;
      const magnitude = Number(`${wholePart}.${fractionPart}`);
      expect(
        magnitude >= 0.1,
        `${label}: test setup did not reach the >= 0.1 magnitude range needed to distinguish formatMagnitude's two branches (rendered "${text}").`,
      ).toBe(true);
      expect(
        fractionPart.length,
        `${label}: rendered "${text}" with ${fractionPart.length} fractional digit(s) at magnitude >= 0.1 -- formatMagnitude's toFixed(4) branch always emits exactly 4. A shorter count (e.g. 3, as in the historical "5.752" defect) means a raw .toPrecision(4) call (or similar) reappeared instead of the shared formatter.`,
      ).toBe(4);
    }

    it('HHInhalationCalculator renders its preliminary standard through the shared 4-decimal formatter, not a raw toPrecision(4)', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      selectSubstance('benzene');

      // Same VF/PEF pair used by HHInhalationCalculator.test.tsx's own
      // "unblocks and shows a computed screening value" case; with benzene's
      // catalog RfC (0.03 mg/m3) and IUR (0.016 per mg/m3), both the
      // non-cancer and cancer derivations land well above the 0.1 threshold
      // (cancer ~15.2, non-cancer ~312.9 mg/kg dry -- the lower, more
      // protective cancer value governs).
      fireEvent.change(screen.getByTestId('hh-inhalation-vf-input'), {
        target: { value: '10000' },
      });
      fireEvent.change(screen.getByTestId('hh-inhalation-pef-input'), {
        target: { value: '1.36e9' },
      });

      const standard = screen.getByTestId('hh-inhalation-preliminary-standard');
      assertFourDecimalDigits(standard.textContent ?? '', 'HH Inhalation preliminary standard');
    });

    it('CumulativeEffectsCalculator renders its equivalent concentration through the shared 4-decimal formatter, not a raw toPrecision(4)', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();

      // Push the reference PAH (benzo_a_pyrene, RPF = 1 under the default
      // ccme-2010 scheme) concentration up so the summed BaP-eq clears 0.1
      // regardless of the other default rows' contributions.
      fireEvent.change(screen.getByTestId('cum-bapeq-conc-0'), {
        target: { value: '50' },
      });

      const value = screen.getByTestId('cum-bapeq-value');
      assertFourDecimalDigits(value.textContent ?? '', 'Cumulative Effects BaP-eq equivalent');
    });

    // Fix 3 (P2, third adversarial round, 2026-08-14): the two "exactly one
    // current" tests above only cover Stage 1 breaking. They cannot catch
    // (and did not catch) two stages being current at once when Stage 1/2
    // are both fine but the DOWNSTREAM Background Adjustment Stage 3 needs
    // attention -- the sample set is seeded by default (n=10, valid), so
    // Stage 3 computes immediately and this state is never reached by
    // those tests. Reproduction: clear the reference-samples textarea so
    // n drops below 2 -- Stage 3 flips back to pending/current while the
    // active pathway calculator's Stage 2 (self-contained rule:
    // `!stage1Blocked`, no awareness of BackgroundAdjustment) stays current
    // too. A regression that drops either half of the Fix 3 shared-state
    // wiring (BackgroundAdjustment.tsx's `preliminaryAvailable &&
    // stage3State !== 'computed'`, or the active calculator's
    // `!stage1Blocked && !backgroundReferenceNeedsAttention`) reintroduces
    // two lit stages here.
    it('shows exactly one "current" stage after the background reference samples are cleared (Stage 3 needs attention, not Stage 2)', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-hh-direct'));

      const samplesInput = screen.getByLabelText(/reference samples/i);
      fireEvent.change(samplesInput, { target: { value: '' } });

      const stages = collectStages();
      const currentStages = stages.filter((s) => s.current);
      expect(
        currentStages.length,
        `Expected exactly one current stage after clearing the background reference samples; found ${currentStages.length}: ${currentStages.map((s) => s.testId).join(', ') || '(none)'}.\n${describeStages(stages)}`,
      ).toBe(1);
      // The current stage must be the one that actually needs the user's
      // attention now (Stage 3, background reference), not the pathway
      // calculator's Stage 2, which has already produced its preliminary
      // standard and has nothing further for the user to do.
      expect(currentStages[0].testId).toBe('bg-adjust-stage-3');
    });

    it('does not render any stage number inside Cumulative Effects, HH Inhalation, or the Background Adjustment Site Comparison block', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();

      // These three surfaces are tools, not steps in the derivation
      // sequence (DESIGN.md: Cumulative Effects and HH Inhalation are
      // orthogonal to the 4-stage pathway; the Background Adjustment
      // "Site Comparison" block is explicitly NOT part of the derivation --
      // see BackgroundAdjustment.tsx's file-header comment). None of the
      // three should carry a data-stage-state marker or a "Stage N of M"
      // label; if a future edit wraps one in CalculatorStage without an
      // owner decision to make it a real derivation step, this fails.
      const cumulativeEffects = screen.getByTestId('cumulative-effects-calculator');
      expect(
        cumulativeEffects.querySelector('[data-stage-state]'),
      ).toBeNull();
      expect(within(cumulativeEffects).queryByText(/^Stage \d+ of \d+$/)).not.toBeInTheDocument();

      const hhInhalation = screen.getByTestId('hh-inhalation-calculator');
      expect(hhInhalation.querySelector('[data-stage-state]')).toBeNull();
      expect(within(hhInhalation).queryByText(/^Stage \d+ of \d+$/)).not.toBeInTheDocument();

      const siteComparison = screen.getByTestId('bg-adjust-site-comparison');
      expect(siteComparison.querySelector('[data-stage-state]')).toBeNull();
      expect(within(siteComparison).queryByText(/^Stage \d+ of \d+$/)).not.toBeInTheDocument();
    });
  });

  // The six ASSEMBLED-coherence tests above cover STRUCTURE (sequence
  // numbering, one-current, formatter agreement, unnumbered tools). None of
  // them drives a derivation to completion: BackgroundAdjustment.test.tsx
  // exercises Stage 4's max() logic thoroughly, but every one of those
  // cases passes preliminaryStandard directly as a prop -- the actual
  // wiring (pathway calculator -> onPreliminaryStandardChange ->
  // MatrixDashboard state -> preliminarySlot -> BackgroundAdjustment prop
  // -> Stage 4 max(preliminary, UTL) -> onAdjustedStandardChange ->
  // adjustedSlot -> summary bar) is never exercised. This describe block
  // drives that full chain through the real, rendered UI -- no direct
  // BackgroundAdjustment render, no stubbed callbacks.
  describe('MatrixDashboard -- full derivation wiring (pathway -> Stage 4 -> summary bar)', () => {
    beforeEach(() => {
      window.localStorage.clear();
    });

    // Reference-sample sets chosen so the UTL lands FAR outside any
    // plausible preliminary-standard magnitude for hh-direct's default
    // substance (Total PCBs (Aroclor 1254)) -- these tests do not need to
    // know that baseline number, only its relative position to the UTL,
    // because the BW/IR_sed levers below are pushed by ~13 orders of
    // magnitude, far past any plausible baseline. Values carry a small
    // spread (not identical) so utl9595's std-dev computation runs
    // normally, not degenerate at sd = 0.
    const HUGE_SAMPLES =
      '1000000, 999998, 1000002, 999999, 1000001, 1000000, 999997, 1000003, 999999, 1000001';
    const TINY_SAMPLES =
      '0.0010, 0.0012, 0.0009, 0.0011, 0.0008, 0.0013, 0.0010, 0.0009, 0.0011, 0.0010';

    function setReferenceSamples(value: string) {
      fireEvent.change(screen.getByLabelText(/reference samples/i), {
        target: { value },
      });
    }

    // Pulls the numeric token out of bg-adjust-result's "<value> mg/kg dry"
    // text run for a like-for-like comparison against the summary bar's
    // isolated value slot (same extraction pattern as the formatter-
    // agreement test above, generalized to Stage 4's own result block).
    function stage4ResultValueText(): string {
      const result = screen.getByTestId('bg-adjust-result');
      const match = result.textContent?.match(/([\d.]+(?:e[+-]?\d+)?)\s*mg\/kg dry/i);
      if (!match) {
        throw new Error(
          `bg-adjust-result did not contain a "<value> mg/kg dry" run: "${result.textContent}"`,
        );
      }
      return match[1];
    }

    // Fix 4 (P3, 2026-08-14 UI QA audit): extracts the SAME numeric-token
    // pattern from an operand row (bg-adjust-operand-preliminary /
    // bg-adjust-operand-utl) so the governing-operand assertions below
    // compare exact numeric tokens, not `toContain` substrings. Under the
    // levers used in these tests the two operands differ by ~13 orders of
    // magnitude so a substring collision cannot currently happen, but
    // `toContain` would also pass if, say, the preliminary operand were
    // "5.0000" and the UTL were "15.0000" (a false pass on a substring
    // match). Exact-token comparison closes that gap regardless of lever
    // values.
    function operandValueText(testId: string): string {
      const el = screen.getByTestId(testId);
      const match = el.textContent?.match(/([\d.]+(?:e[+-]?\d+)?)\s*mg\/kg dry/i);
      if (!match) {
        throw new Error(
          `${testId} did not contain a "<value> mg/kg dry" run: "${el.textContent}"`,
        );
      }
      return match[1];
    }

    // CASE 1: BACKGROUND GOVERNS -- the case the adjustment exists for.
    // Lever 1 (reference samples -> HUGE_SAMPLES) pushes the UTL to
    // ~1,000,000 mg/kg dry. Lever 2 (IR_sed -> 1e13) pushes the preliminary
    // standard toward zero: IR_sed sits in the DENOMINATOR of the Cs-solve
    // (Dose = Cs * CF * EF * ED * (IR_sed * BA_o + SA * AF_sed * ABS_d) /
    // (BW * AT)), so raising it LOWERS the resulting preliminary standard --
    // the opposite of BW (a previous test author got this backwards; see
    // the formatter-agreement test above, which raises BW instead).
    // Fails if: BackgroundAdjustment's Stage 4 max() picks the wrong
    // operand, or the preliminary/UTL wiring path drops a hop (e.g. Stage 4
    // reads a stale preliminaryStandard prop, or the summary bar's adjusted
    // slot is built from a different value than Stage 4's own result).
    it('drives a background-governs derivation end to end: pathway -> Stage 4 max() -> summary bar all agree on the UTL', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-hh-direct'));

      setReferenceSamples(HUGE_SAMPLES);
      fireEvent.change(screen.getByTestId('hh-direct-ir-sed-input'), {
        target: { value: '1e13' },
      });

      // The pathway calculator's own Stage 2 actually produced a
      // preliminary standard (the wiring's first hop).
      expect(screen.getByTestId('hh-direct-stage-2')).toHaveAttribute(
        'data-stage-state',
        'computed',
      );

      // Stage 4 computed and names the background UTL as governing, in
      // words, not just a number.
      expect(screen.getByTestId('bg-adjust-stage-4')).toHaveAttribute(
        'data-stage-state',
        'computed',
      );
      const governingSentence =
        screen.getByTestId('bg-adjust-governing-sentence').textContent ?? '';
      expect(governingSentence).toMatch(/background UTL 95\/95/);
      expect(governingSentence).toMatch(
        /governs, because it exceeds the preliminary standard/,
      );
      expect(governingSentence).toMatch(/naturally occurring background/i);

      // The adjusted value equals the UTL operand, not the preliminary
      // operand -- read from Stage 4's own two operand rows, not
      // recomputed here.
      const preliminaryOperandValue = operandValueText('bg-adjust-operand-preliminary');
      const utlOperandValue = operandValueText('bg-adjust-operand-utl');
      const stage4ValueText = stage4ResultValueText();
      expect(utlOperandValue).toBe(stage4ValueText);
      expect(preliminaryOperandValue).not.toBe(stage4ValueText);

      // The SAME adjusted-value STRING (not just the same number) appears
      // in the summary bar's adjusted slot -- this is the formatter-
      // divergence defect class the file header describes: two components
      // agreeing on the number but disagreeing on the rendered string.
      const summaryAdjustedValue = screen
        .getByTestId('calculator-summary-bar-adjusted-value')
        .textContent?.trim() ?? '';
      expect(summaryAdjustedValue).toBe(stage4ValueText);
      expect(screen.getByTestId('calculator-summary-bar-adjusted-chip')).toHaveTextContent(
        /computed/i,
      );

      // The summary bar's governing indication agrees with Stage 4's: both
      // name the background UTL, and the summary bar cites the same figure.
      const summaryGoverning =
        screen.getByTestId('calculator-summary-bar-governing').textContent ?? '';
      expect(summaryGoverning).toMatch(/background UTL 95\/95/);
      expect(summaryGoverning).toContain(stage4ValueText);
    });

    // CASE 2: PRELIMINARY GOVERNS -- the mirror-image case.
    // Lever 1 (reference samples -> TINY_SAMPLES) pushes the UTL toward
    // ~0.001 mg/kg dry. Lever 2 (BW -> 1e13) pushes the preliminary
    // standard up: BW sits in the NUMERATOR of the Cs-solve, so raising it
    // RAISES the resulting preliminary standard (same direction, same
    // input, as the formatter-agreement test above).
    // Fails if: Stage 4's max() ever prefers the smaller operand, or the
    // governedBy label disagrees with which value was actually used.
    it('drives a preliminary-governs derivation end to end: pathway -> Stage 4 max() -> summary bar all agree on the preliminary standard', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-hh-direct'));

      setReferenceSamples(TINY_SAMPLES);
      fireEvent.change(screen.getByTestId('hh-direct-bw-input'), {
        target: { value: '1e13' },
      });

      expect(screen.getByTestId('bg-adjust-stage-4')).toHaveAttribute(
        'data-stage-state',
        'computed',
      );
      const governingSentence =
        screen.getByTestId('bg-adjust-governing-sentence').textContent ?? '';
      expect(governingSentence).toMatch(/preliminary standard \(/);
      expect(governingSentence).toMatch(
        /governs, because it is at or above the background UTL 95\/95/,
      );

      const preliminaryOperandValue = operandValueText('bg-adjust-operand-preliminary');
      const utlOperandValue = operandValueText('bg-adjust-operand-utl');
      const stage4ValueText = stage4ResultValueText();
      expect(preliminaryOperandValue).toBe(stage4ValueText);
      expect(utlOperandValue).not.toBe(stage4ValueText);

      const summaryAdjustedValue = screen
        .getByTestId('calculator-summary-bar-adjusted-value')
        .textContent?.trim() ?? '';
      expect(summaryAdjustedValue).toBe(stage4ValueText);

      const summaryGoverning =
        screen.getByTestId('calculator-summary-bar-governing').textContent ?? '';
      expect(summaryGoverning).toMatch(/preliminary standard/);
      expect(summaryGoverning).toContain(stage4ValueText);
    });

    // CASE 3: THE CHAIN BREAKS CORRECTLY. First drive a real successful
    // derivation (same levers as case 2, so there IS a previously-computed
    // adjusted value that could go stale), then make body weight invalid.
    // Fails if: the summary bar's adjusted slot keeps showing the old
    // computed value/chip after the upstream input breaks (a stale value
    // surviving an upstream break -- the exact failure this test exists
    // to catch), or if Stage 4 does not fall back to WAITING and name the
    // missing preliminary standard.
    it('breaks the chain correctly: an upstream input going invalid after a successful derivation blocks Stage 1, sends Stage 4 back to WAITING naming the missing preliminary standard, and the summary bar drops the stale adjusted value', async () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-hh-direct'));

      setReferenceSamples(TINY_SAMPLES);
      fireEvent.change(screen.getByTestId('hh-direct-bw-input'), {
        target: { value: '1e13' },
      });
      expect(screen.getByTestId('bg-adjust-stage-4')).toHaveAttribute(
        'data-stage-state',
        'computed',
      );
      const staleAdjustedValueText = stage4ResultValueText();

      // Break Stage 1 with an invalid body weight (same input used by the
      // existing "exactly one current stage" invalid-input test above).
      fireEvent.change(screen.getByTestId('hh-direct-bw-input'), {
        target: { value: '-1' },
      });

      // Stage 1 (exposure factors, which feeds the preliminary standard)
      // is BLOCKED.
      expect(screen.getByTestId('hh-direct-stage-1')).toHaveAttribute(
        'data-stage-state',
        'blocked',
      );

      // Stage 4 falls back to WAITING and names the missing operand.
      expect(screen.getByTestId('bg-adjust-stage-4')).toHaveAttribute(
        'data-stage-state',
        'waiting',
      );
      expect(screen.queryByTestId('bg-adjust-result')).not.toBeInTheDocument();
      expect(screen.getByTestId('bg-adjust-result-waiting')).toHaveTextContent(
        /preliminary standard/i,
      );

      // The summary bar does not retain the previously computed adjusted
      // value as though it were still current. The reporting chain runs
      // through nested effects (BackgroundAdjustment's own effect ->
      // MatrixDashboard's onAdjustedStandardChange state update ->
      // CalculatorSummaryBar's props), so settle with waitFor rather than
      // assuming a single synchronous flush.
      await waitFor(() => {
        expect(
          screen.getByTestId('calculator-summary-bar-adjusted-value').textContent?.trim(),
        ).toBe('--');
      });
      expect(screen.getByTestId('calculator-summary-bar-adjusted-chip')).toHaveTextContent(
        /waiting/i,
      );
      expect(
        screen.getByTestId('calculator-summary-bar-adjusted-value').textContent?.trim(),
      ).not.toBe(staleAdjustedValueText);
    });

    // ------------------------------------------------------------------
    // Regression coverage for the state-machine defect an external reviewer
    // found after six prior review rounds missed it: onPreliminaryStandardChange
    // carried a VALUE, not a STATE, so MatrixDashboard.tsx inferred the summary
    // bar's preliminary-standard chip purely from "is value null" -- every null
    // became PENDING regardless of cause. A Stage-2-only error and a
    // Stage-1-blocked pathway both report null, so both used to be
    // indistinguishable from "nothing entered yet". The fix threads each
    // calculator's own stage2State through the report; these three tests drive
    // the assembled page to each of the three non-COMPUTED states and assert
    // the summary bar's chip names the RIGHT one, not just "not PENDING".
    // ------------------------------------------------------------------

    it('a Stage-2-only invalid input (target risk) blocks the preliminary standard without touching Stage 1, and the summary bar shows BLOCKED, not PENDING', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-hh-direct'));

      // Baseline: both stages start healthy with the seeded defaults.
      expect(screen.getByTestId('hh-direct-stage-1')).toHaveAttribute(
        'data-stage-state',
        'computed',
      );
      expect(screen.getByTestId('hh-direct-stage-2')).toHaveAttribute(
        'data-stage-state',
        'computed',
      );
      expect(screen.getByTestId('calculator-summary-bar-preliminary-chip')).toHaveTextContent(
        /computed/i,
      );

      // Target risk is valid for STAGE 1 -- HHDirectContactCalculator's
      // stage1FieldError list is exactly the seven exposure-factor fields (body
      // weight, exposure duration/frequency, cancer averaging time, sediment
      // ingestion rate, skin area, adherence factor); target risk and hazard
      // quotient are not among them. It feeds Stage 2's own calculation only.
      // This is exactly the "Stage-2-only" case the external reviewer called
      // for: an input that is fine for Stage 1 but breaks the calculation.
      // Scoped to this calculator's own container -- HHInhalationCalculator
      // (always stacked below, regardless of active category) renders its own
      // "Target risk" field and would otherwise collide.
      const hhDirect = screen.getByTestId('hh-direct-contact-calculator');
      fireEvent.change(within(hhDirect).getByLabelText(/target risk/i), {
        target: { value: '-1' },
      });

      // Stage 1 is UNAFFECTED -- the invalid field is not one of its seven.
      expect(screen.getByTestId('hh-direct-stage-1')).toHaveAttribute(
        'data-stage-state',
        'computed',
      );
      // Stage 2 is BLOCKED -- the error is here (DESIGN.md "Four states, not two").
      expect(screen.getByTestId('hh-direct-stage-2')).toHaveAttribute(
        'data-stage-state',
        'blocked',
      );

      // Before the fix, this would have shown PENDING: onPreliminaryStandardChange
      // reported null (no way to distinguish WHY), and the parent inferred
      // "no value -> PENDING" regardless of cause.
      expect(screen.getByTestId('calculator-summary-bar-preliminary-chip')).toHaveTextContent(
        /blocked/i,
      );
      expect(
        screen.getByTestId('calculator-summary-bar-preliminary-chip'),
      ).not.toHaveTextContent(/pending/i);
    });

    it('Stage 1 blocked sends the preliminary standard summary slot to WAITING, not PENDING', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-hh-direct'));

      expect(screen.getByTestId('calculator-summary-bar-preliminary-chip')).toHaveTextContent(
        /computed/i,
      );

      // Break Stage 1 with an invalid body weight.
      fireEvent.change(screen.getByTestId('hh-direct-bw-input'), {
        target: { value: '-1' },
      });

      expect(screen.getByTestId('hh-direct-stage-1')).toHaveAttribute(
        'data-stage-state',
        'blocked',
      );
      // Stage 2 defers to Stage 1: it is blocked by something upstream, not by
      // itself, so it reports WAITING (not BLOCKED, not PENDING).
      expect(screen.getByTestId('hh-direct-stage-2')).toHaveAttribute(
        'data-stage-state',
        'waiting',
      );

      // Before the fix, this also collapsed to PENDING -- indistinguishable
      // from the BLOCKED case above and from "nothing entered yet".
      expect(screen.getByTestId('calculator-summary-bar-preliminary-chip')).toHaveTextContent(
        /waiting/i,
      );
      expect(
        screen.getByTestId('calculator-summary-bar-preliminary-chip'),
      ).not.toHaveTextContent(/pending/i);
    });

    it('a genuinely-nothing-entered input (fewer than 2 background reference samples) shows PENDING, completing the three-way distinction from BLOCKED and WAITING above', () => {
      // The preliminary-standard slot itself cannot reach a genuine "nothing
      // entered yet" PENDING on the assembled page: all five calculators seed
      // their required inputs with a valid default, and blanking a required
      // field turns it into an explicit error (positiveInput) rather than an
      // idle blank -- so every reachable non-computed state for that slot is
      // either BLOCKED or WAITING, both covered above. PENDING is real and
      // reachable on Stage 3 (Background UTL): fewer than 2 reference samples
      // is genuinely "not entered yet, no error" -- exactly PENDING's
      // definition (DESIGN.md "Four states, not two") -- and it shares the
      // same reporting contract (state carried explicitly via
      // BackgroundUtlReport, not inferred from value presence) as the
      // preliminary slot's own fix. This closes the three-way distinction the
      // two tests above start: BLOCKED, WAITING, and PENDING are three
      // different chip states, not one bare null collapsed into PENDING.
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-hh-direct'));

      // The preliminary standard is healthy throughout -- this isolates Stage
      // 3/the UTL slot, proving the three states are tracked independently
      // rather than conflated into one shared flag.
      expect(screen.getByTestId('calculator-summary-bar-preliminary-chip')).toHaveTextContent(
        /computed/i,
      );

      setReferenceSamples('0.001');

      expect(screen.getByTestId('bg-adjust-stage-3')).toHaveAttribute(
        'data-stage-state',
        'pending',
      );
      expect(screen.getByTestId('calculator-summary-bar-utl-chip')).toHaveTextContent(
        /pending/i,
      );
      expect(screen.getByTestId('calculator-summary-bar-utl-chip')).not.toHaveTextContent(
        /blocked/i,
      );
      expect(screen.getByTestId('calculator-summary-bar-utl-chip')).not.toHaveTextContent(
        /waiting/i,
      );

      // The preliminary slot (a different state, tracked independently) is
      // unaffected by the UTL slot going PENDING.
      expect(screen.getByTestId('calculator-summary-bar-preliminary-chip')).toHaveTextContent(
        /computed/i,
      );
    });
  });

  // Owner 2026-08-14: "reference only shown when working in stage 3" -- the
  // right rail (data-testid calculator-reference-rail) now follows
  // backgroundReferenceNeedsAttention instead of defaulting open. These
  // three tests drive the same preliminary/UTL state machine the
  // "genuinely-nothing-entered" test above already exercises, but assert
  // the RAIL's open/closed state rather than the summary-bar chips. Two
  // independent signals per assertion: the toggle button's aria-label
  // (Hide/Show right panel, unaffected by any styling refactor) and the
  // rail wrapper's `inert` attribute (the actual a11y mechanism that keeps
  // a collapsed rail out of the focus/tab order -- see the wrapper's own
  // comment in MatrixDashboard.tsx).
  describe('MatrixDashboard -- Calculator reference rail follows Stage 3 (2026-08-14)', () => {
    function expectRailOpen() {
      expect(
        screen.getByRole('button', { name: /^Hide right panel$/ }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('calculator-reference-rail')).not.toHaveAttribute('inert');
    }

    function expectRailClosed() {
      expect(
        screen.getByRole('button', { name: /^Show right panel$/ }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('calculator-reference-rail')).toHaveAttribute('inert');
    }

    it('is CLOSED when the preliminary standard is not yet computed', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-hh-direct'));

      // Every seeded default computes immediately (both the preliminary
      // standard and the UTL), so the rail starts closed too -- confirm that
      // baseline first, then break ONLY the preliminary standard using the
      // same Stage-2-only lever ("a Stage-2-only invalid input" test above):
      // target risk is not one of Stage 1's seven fields, so Stage 1 (and
      // therefore the UTL, which does not depend on it) stay untouched while
      // Stage 2 goes BLOCKED. backgroundReferenceNeedsAttention requires
      // preliminarySlot.state === 'computed', so a BLOCKED preliminary keeps
      // the rail shut for the same reason a not-yet-computed one would.
      expect(screen.getByTestId('calculator-summary-bar-preliminary-chip')).toHaveTextContent(
        /computed/i,
      );
      const hhDirect = screen.getByTestId('hh-direct-contact-calculator');
      fireEvent.change(within(hhDirect).getByLabelText(/target risk/i), {
        target: { value: '-1' },
      });
      expect(screen.getByTestId('calculator-summary-bar-preliminary-chip')).not.toHaveTextContent(
        /computed/i,
      );

      expectRailClosed();
    });

    it('OPENS when the preliminary standard is computed but the UTL is not (Stage 3 actionable)', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-hh-direct'));

      // hh-direct's preliminary standard computes immediately from its seeded
      // defaults (same baseline the "genuinely-nothing-entered" test above
      // relies on).
      expect(screen.getByTestId('calculator-summary-bar-preliminary-chip')).toHaveTextContent(
        /computed/i,
      );

      // Drop the reference-sample count below 2 -- the UTL slot falls back
      // to 'pending' (same lever as the "genuinely-nothing-entered" test).
      fireEvent.change(screen.getByLabelText(/reference samples/i), {
        target: { value: '0.001' },
      });
      expect(screen.getByTestId('calculator-summary-bar-utl-chip')).toHaveTextContent(/pending/i);

      expectRailOpen();
    });

    it('CLOSES again once the UTL is computed', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-hh-direct'));

      fireEvent.change(screen.getByLabelText(/reference samples/i), {
        target: { value: '0.001' },
      });
      expect(screen.getByTestId('calculator-summary-bar-utl-chip')).toHaveTextContent(/pending/i);
      expectRailOpen();

      // Restore a valid reference-sample set (n = 10, same set used
      // elsewhere in this file) -- Stage 3 recomputes the UTL and the rail
      // follows it back shut.
      fireEvent.change(screen.getByLabelText(/reference samples/i), {
        target: {
          value:
            '1000000, 999998, 1000002, 999999, 1000001, 1000000, 999997, 1000003, 999999, 1000001',
        },
      });
      expect(screen.getByTestId('calculator-summary-bar-utl-chip')).toHaveTextContent(
        /computed/i,
      );

      expectRailClosed();
    });

    // Defect fix 2026-08-14: the rail's open state is DERIVED
    // (calcRailOverride ?? backgroundReferenceNeedsAttention), not written by
    // an effect. These three tests cover the override mechanism itself.
    it('manual close STICKS across an unrelated re-render while the stage is unchanged', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-hh-direct'));

      // Reach Stage-3-actionable so the rail auto-opens (same lever as the
      // "OPENS when..." test above).
      fireEvent.change(screen.getByLabelText(/reference samples/i), {
        target: { value: '0.001' },
      });
      expect(screen.getByTestId('calculator-summary-bar-utl-chip')).toHaveTextContent(/pending/i);
      expectRailOpen();

      // Manual close.
      fireEvent.click(screen.getByRole('button', { name: /^Hide right panel$/ }));
      expectRailClosed();

      // An unrelated re-render: change a Stage 1 input that does not flip
      // either chip's state (cancer averaging time stays a valid positive
      // number, so the preliminary standard remains 'computed' and the UTL
      // slot -- driven only by the reference-sample field -- is untouched).
      fireEvent.change(screen.getByTestId('hh-direct-at-cancer-input'), {
        target: { value: '80' },
      });
      expect(screen.getByTestId('calculator-summary-bar-preliminary-chip')).toHaveTextContent(
        /computed/i,
      );
      expect(screen.getByTestId('calculator-summary-bar-utl-chip')).toHaveTextContent(/pending/i);

      // The manual close must still hold -- neither chip's state changed, so
      // nothing should have cleared the override.
      expectRailClosed();
    });

    it('manual open is CLEARED by a pathway switch, even though Stage 3 stays non-actionable throughout', () => {
      render(<MatrixDashboard {...DEFAULT_PROPS} />);
      clickCalculatorTab();
      fireEvent.click(screen.getByTestId('category-selector-hh-direct'));

      // Baseline: seeded defaults compute both the preliminary standard and
      // the UTL immediately, so backgroundReferenceNeedsAttention is false
      // and the rail starts closed (same baseline the "is CLOSED when..."
      // test above starts from).
      expect(screen.getByTestId('calculator-summary-bar-preliminary-chip')).toHaveTextContent(
        /computed/i,
      );
      expect(screen.getByTestId('calculator-summary-bar-utl-chip')).toHaveTextContent(
        /computed/i,
      );
      expectRailClosed();

      // Manual open, while Stage 3 is NOT actionable -- this only exercises
      // the override, not the derived value.
      fireEvent.click(screen.getByRole('button', { name: /^Show right panel$/ }));
      expectRailOpen();

      // Switch pathway. hh-direct unmounts (its preliminary report briefly
      // clears to 'pending' during the transition) and eco-direct mounts
      // with its own seeded defaults, which also compute both slots
      // immediately -- so backgroundReferenceNeedsAttention is false both
      // before AND after the switch, with no transient change of VALUE in
      // between (pending && anything is already false, same as computed &&
      // computed). A dependency-array fix keyed only on
      // backgroundReferenceNeedsAttention would therefore NOT re-fire here;
      // only a fix that also keys on activeCategory clears the override on
      // this switch. Assert the manual OPEN is gone and the rail follows
      // Stage 3 (closed) for the new pathway.
      fireEvent.click(screen.getByTestId('category-selector-eco-direct'));
      expect(screen.getByTestId('calculator-summary-bar-preliminary-chip')).toHaveTextContent(
        /computed/i,
      );
      expect(screen.getByTestId('calculator-summary-bar-utl-chip')).toHaveTextContent(
        /computed/i,
      );
      expectRailClosed();
    });

    it('does not flash open-then-closed on Calculator entry when defaults are already fully computed', () => {
      // A plain before/after DOM assertion cannot distinguish "closed from
      // the first commit" (derived value) from "opened, then an effect
      // corrected it to closed" (the flash) -- @testing-library/react's
      // fireEvent flushes passive effects synchronously via act(), so both
      // implementations read identically AFTER the click settles. A
      // MutationObserver watching the toggle button's aria-label makes the
      // extra corrective render visible: the derived fix inserts the button
      // already reading "Show right panel" (one childList insertion, zero
      // attribute mutations); an effect-writer inserts it open, then
      // mutates the SAME node's aria-label once the effect fires.
      render(<MatrixDashboard {...DEFAULT_PROPS} />);

      // MutationObserver callbacks fire as a microtask; disconnect() alone
      // discards any queued-but-undelivered records, so pull them
      // synchronously with takeRecords() before disconnecting -- otherwise
      // this assertion would silently pass regardless of the flash (the
      // callback array would still be empty at assertion time even though a
      // real mutation happened).
      const observer = new MutationObserver(() => {});
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['aria-label'],
        subtree: true,
      });

      clickCalculatorTab();

      const mutations = observer.takeRecords();
      observer.disconnect();

      const toggleButton = screen.getByRole('button', { name: /^Show right panel$/ });
      const flashMutation = mutations.find(
        (record) => record.type === 'attributes' && record.target === toggleButton,
      );
      expect(flashMutation).toBeUndefined();
      expect(screen.getByTestId('calculator-reference-rail')).toHaveAttribute('inert');
    });
  });

  // FIX 1: pointercancel must restore cursor/userSelect the same as pointerup.
  it('pointercancel restores body cursor and userSelect (drag cleanup on cancel)', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Interactive Map$/ }));

    const sep = screen.getByRole('separator', { name: /Resize measurement workbench/i });
    // Start a drag -- body cursor should be col-resize.
    fireEvent.pointerDown(sep, { clientX: 200 });
    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');

    // Cancel the drag -- cleanup must run the same as pointerup.
    fireEvent(window, new PointerEvent('pointermove', { clientX: 150, bubbles: true }));
    fireEvent(window, new PointerEvent('pointercancel', { bubbles: true }));

    expect(document.body.style.cursor).not.toBe('col-resize');
    expect(document.body.style.userSelect).not.toBe('none');
  });
});

