// Integration tests for MatrixDashboard (PR-A2 commit 6 wire-up).
// Covers: Calculator-tab render branch, lifted-state wiring,
// localStorage hydrate + persist round-trip, validate-on-load coercion,
// print:hidden on left sidebar, legacy DerivationSimulator retirement.
// Plain ASCII only.

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock heavy children we do not need full coverage of in this integration
// suite. The Calculator-tab assertions exercise the real CategorySelector
// + SharedGlobalInputs + Eco* calculators + BackgroundAdjustment so the
// wire-up is end-to-end tested at that layer.
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

function clickCalculatorTab() {
  // The Calculator top-tab nav button.
  const tabBtn = screen.getByRole('button', { name: /^Calculator$/ });
  fireEvent.click(tabBtn);
}

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
    // Default activeCategory = 'eco-direct' -> Eco-Direct calculator renders.
    expect(
      screen.getByTestId('eco-direct-eqp-calculator'),
    ).toBeInTheDocument();
    // Eco-Food NOT rendered when activeCategory = 'eco-direct'.
    expect(
      screen.queryByTestId('eco-food-bsaf-calculator'),
    ).not.toBeInTheDocument();
    // BackgroundAdjustment panel still appears at the bottom.
    expect(screen.getByRole('heading', { name: /Background Adjustment/i })).toBeInTheDocument();
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
      target: { value: 'federal-ccme' },
    });
    expect(window.localStorage.getItem(LS_JURISDICTION)).toBe('federal-ccme');
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
    window.localStorage.setItem(LS_JURISDICTION, 'federal-ccme');
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
    ).toBe('federal-ccme');
  });

  // Validate-on-load clears the stale entry inside restoreX(); the persist
  // effect then immediately re-writes the default value. The end-state
  // invariant we care about is "user no longer sees the stale value":
  // both the rendered state AND the persisted value reflect the default,
  // NOT the stale input.
  it('falls back to default activeCategory when a disabled HH category is persisted (e.g., hh-direct)', () => {
    window.localStorage.setItem(LS_CATEGORY, 'hh-direct');
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    // HH categories disabled in PR-A2 -> fall back to default 'eco-direct'.
    expect(
      screen.getByTestId('eco-direct-eqp-calculator'),
    ).toBeInTheDocument();
    // After hydrate clear + persist re-write, the entry holds the default
    // (NOT the stale 'hh-direct' value the test seeded).
    expect(window.localStorage.getItem(LS_CATEGORY)).toBe('eco-direct');
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
    ).toBe('bc-csr');
    expect(window.localStorage.getItem(LS_JURISDICTION)).toBe('bc-csr');
  });

  it('falls back to default audience-tier when an unknown tier is persisted', () => {
    window.localStorage.setItem(LS_TIER, 'expert-mode');
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    // activeTier is not rendered yet (PR-A3 wires the sidebar guide), so
    // we observe via localStorage end-state only.
    expect(window.localStorage.getItem(LS_TIER)).toBe('general');
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

  it('per-calculator local state is preserved across category swap', () => {
    render(<MatrixDashboard {...DEFAULT_PROPS} />);
    clickCalculatorTab();
    // Adjust Eco-Direct foc to 5%.
    fireEvent.change(screen.getByLabelText(/Fraction Organic Carbon/i), {
      target: { value: '5' },
    });
    expect(screen.getByText(/5\.00 %/)).toBeInTheDocument();
    // Switch to Eco-Food (unmounts EcoDirect).
    fireEvent.click(screen.getByTestId('category-selector-eco-food'));
    expect(
      screen.queryByTestId('eco-direct-eqp-calculator'),
    ).not.toBeInTheDocument();
    // Switch back to Eco-Direct: foc resets to default 2% because the
    // component unmounted and lost local state (foc is NOT lifted -- it
    // is a per-pathway input per plan v3 section 4.3, "Per-calculator
    // pathway-specific inputs ... stay LOCAL to each calculator").
    // This test documents the lift contract: only substance + jurisdiction
    // are global; per-pathway inputs are unmount-fresh.
    fireEvent.click(screen.getByTestId('category-selector-eco-direct'));
    expect(screen.getByText(/2\.00 %/)).toBeInTheDocument();
  });
});
