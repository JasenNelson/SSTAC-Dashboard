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
// MatrixDashboard tests; the Interactive Map tab is not exercised by
// this suite (Calculator + Guide + TWG-tab assertions only).
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
  const tabBtn = screen.getByRole('button', { name: /^Calculator$/ });
  fireEvent.click(tabBtn);
}

describe('MatrixDashboard -- Matrix Options guide copy', () => {
  it('keeps the v1 guide focused on workflow instead of placeholder status copy', () => {
    expect(GUIDE_MARKDOWN).toMatch(/## 1\. How to Use This Workspace/);
    expect(GUIDE_MARKDOWN).toMatch(/\*\s+\*\*The Guide\*\*/);
    expect(GUIDE_MARKDOWN).toMatch(/## 3\. Reviewer Checklist/);
    expect(GUIDE_MARKDOWN).toMatch(/Scientific Literature Search/);
    expect(GUIDE_MARKDOWN).toMatch(/Jurisdictional Scan/);
    expect(GUIDE_MARKDOWN).toMatch(/\*\s+\*\*AVS\/SEM\*\*/);
    expect(GUIDE_MARKDOWN).toMatch(/\*\s+\*\*TRV\*\*/);
    expect(GUIDE_MARKDOWN).not.toMatch(/Coming Soon/i);
    expect(GUIDE_MARKDOWN).not.toMatch(/placeholder/i);
    expect(GUIDE_MARKDOWN).not.toMatch(/What Is Working Now/i);
  });

  it('renders the v1 guide workflow copy in the Guide tab', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} guideContent={GUIDE_MARKDOWN} />);

    expect(screen.getByTestId('math-renderer-mock')).toHaveTextContent(
      /How to Use This Workspace/,
    );
    expect(screen.getByTestId('math-renderer-mock')).toHaveTextContent(
      /Reviewer Checklist/,
    );
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
    // Default substance = B[a]P.
    expect(
      screen.getByTestId('eqp-substance-summary').textContent,
    ).toMatch(/Benzo\[a\]pyrene/);
    // Change substance to PCBs.
    fireEvent.change(screen.getByTestId('shared-substance-select'), {
      target: { value: 'total_pcbs_aroclor_1254' },
    });
    expect(
      screen.getByTestId('eqp-substance-summary').textContent,
    ).toMatch(/PCBs/);
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
  });

  it('persists activeCategory + substanceKey on change', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    fireEvent.click(screen.getByTestId('category-selector-eco-food'));
    expect(window.localStorage.getItem(LS_CATEGORY)).toBe('eco-food');
    fireEvent.change(screen.getByTestId('shared-substance-select'), {
      target: { value: 'total_pcbs_aroclor_1254' },
    });
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
      (screen.getByTestId('shared-substance-select') as HTMLSelectElement)
        .value,
    ).toBe('total_pcbs_aroclor_1254');
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
    // Substance dropdown shows the default EqP-capable row.
    expect(
      (screen.getByTestId('shared-substance-select') as HTMLSelectElement)
        .value,
    ).toBe('benzo_a_pyrene');
    expect(window.localStorage.getItem(LS_SUBSTANCE)).toBe('benzo_a_pyrene');
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

    const panel = screen.getByTestId('calculator-value-search-panel');
    expect(panel).toHaveTextContent(/Value lookup/i);
    expect(panel).toHaveTextContent(/Benzo\[a\]pyrene/i);
    expect(panel).toHaveTextContent(/Ecological Direct Contact/i);
    expect(panel).toHaveTextContent(/Choose the substance of interest/i);
    expect(
      within(panel).getByRole('button', { name: /^FCV$/ }),
    ).toBeInTheDocument();
    expect(panel).toHaveTextContent(/Needs locator/i);
    expect(panel).toHaveTextContent(/US EPA ESB Tier 2 values/i);
    expect(panel).not.toHaveTextContent(/US EPA IRIS/i);
    expect(screen.queryByText(/Calculator Quick Reference/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Active Poll/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/will dynamically appear/i)).not.toBeInTheDocument();
  });

  it('shows expanded human-health substances and suggested value filters', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();

    const substanceSelect = screen.getByTestId('shared-substance-select');
    expect(
      within(substanceSelect).getByRole('option', { name: /^Benzene$/ }),
    ).toBeInTheDocument();
    expect(
      within(substanceSelect).getByRole('option', {
        name: /^Trichloroethylene$/,
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('category-selector-hh-direct'));
    fireEvent.change(substanceSelect, {
      target: { value: 'benzene' },
    });

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
    fireEvent.change(screen.getByTestId('shared-substance-select'), {
      target: { value: 'arsenic_inorganic' },
    });
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
    fireEvent.click(screen.getByRole('button', { name: /^References & Values$/ }));

    expect(screen.getByTestId('references-values-tab')).toBeInTheDocument();
    expect(screen.getByTestId('evidence-library-value-groups')).toHaveTextContent(
      /Benzo\[a\]pyrene/,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Benzo\[a\]pyrene log Kow/,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Equations$/ }));
    expect(screen.getByTestId('evidence-library-equations')).toHaveTextContent(
      /Human Health Direct Contact sediment screen/,
    );
  });

  it('opens References & Values from a calculator provenance receipt', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();

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
    expect(screen.getByText(/Value: pv bap fcv/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Values$/ }));
    expect(screen.getByTestId('evidence-library-values')).toHaveTextContent(
      /Benzo\[a\]pyrene FCV/,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Equations$/ }));
    expect(screen.getByTestId('evidence-library-equations')).toHaveTextContent(
      /Eco-Direct EqP sediment benchmark/,
    );
  });

  it('opens read-only alternatives from a calculator receipt row', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    fireEvent.change(screen.getByTestId('shared-substance-select'), {
      target: { value: 'arsenic_inorganic' },
    });
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
    expect(screen.getByTestId('evidence-library-value-groups')).toHaveTextContent(
      /Arsenic \(inorganic\): rfd oral mg per kg bw day/,
    );
    expect(screen.getByTestId('evidence-library-value-groups')).toHaveTextContent(
      /Protocol 28/,
    );
  });

  it('shows jurisdictional quick-reference copy on Jurisdictional Frameworks', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    fireEvent.click(
      screen.getByRole('button', { name: /^Jurisdictional Frameworks$/ }),
    );

    expect(screen.getByTestId('matrix-options-right-reference')).toHaveTextContent(
      /Jurisdictional Quick Reference/i,
    );
    expect(screen.getByText(/Start with the selected pathway group/i)).toHaveTextContent(
      /Ecological: EqP & AVS/i,
    );
    expect(screen.queryByText(/Active Poll/i)).not.toBeInTheDocument();
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

  it('does NOT apply print:hidden on the left sidebar when on Jurisdictional Frameworks tab', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    const jurisTab = screen.getByRole('button', {
      name: /^Jurisdictional Frameworks$/,
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
    fireEvent.click(screen.getByRole('button', { name: /^Interactive Map$/ }));

    const wrapper = screen.getByTestId('matrix-map-right-panel-wrapper');
    expect(wrapper).toHaveStyle({ width: '480px' });
    expect(screen.getByRole('separator', { name: /Resize measurement workbench/i })).toBeInTheDocument();
  });

  it('renders the SSD Workbench as a Matrix Options top-level tab', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: /^SSD Workbench$/ }));

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
    fireEvent.click(screen.getByRole('button', { name: /^Interactive Map$/ }));

    const wrapper = screen.getByTestId('matrix-map-right-panel-wrapper');
    fireEvent.click(screen.getByRole('button', { name: /Focus measurement workbench/i }));
    await waitFor(() => {
      expect(wrapper.className).toContain('absolute');
      expect(
        screen.getByRole('button', { name: /Collapse measurement workbench focus/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Collapse measurement workbench focus/i }));
    await waitFor(() => {
      expect(wrapper.className).not.toContain('absolute');
      expect(wrapper).toHaveStyle({ width: '480px' });
    });
  });
});
