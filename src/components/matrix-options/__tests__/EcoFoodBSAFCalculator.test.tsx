// Component tests for EcoFoodBSAFCalculator (PR-A2 commit 5 refactor).
// substance + jurisdiction are now props lifted from SharedGlobalInputs;
// TRV + BSAF_loc reset contracts mirror EcoDirect's FCV contract per
// plan v3 section 4.6; vertical layout per plan v3 section 1.
// Plain ASCII only.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// Mock MathRenderer to avoid katex CSS import in jsdom.
vi.mock('@/components/MathRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="math-renderer-mock">{content}</div>
  ),
}));

import EcoFoodBSAFCalculator from '../EcoFoodBSAFCalculator';
import { SUBSTANCE_LIBRARY } from '@/lib/matrix-options/substanceLibrary';
import { REGULATORY_FRAME_IDS } from '@/lib/matrix-options/regulatoryFrames';

const DEFAULT_PROPS = {
  substanceKey: 'benzo_a_pyrene',
  jurisdiction: 'bc-protocol1-v5-dra' as const,
};

describe('EcoFoodBSAFCalculator (PR-A2 commit 5, prop-driven)', () => {
  it('renders the active substance summary from the substanceKey prop', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    const summary = screen.getByTestId('ecofood-substance-summary');
    expect(summary.textContent).toMatch(/Benzo\[a\]pyrene/);
    expect(summary.textContent).toMatch(/organic-PAH/);
  });

  it('seeds TRV and BSAF_loc from the substance library on initial render', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    // B[a]P library TRV = 0.0025 mg/kg-bw/day; BSAF_loc_freshwater = 0.5.
    const trv = screen.getByTestId('ecofood-trv-input') as HTMLInputElement;
    const bsaf = screen.getByTestId('ecofood-bsaf-input') as HTMLInputElement;
    expect(trv.value).toBe('0.0025');
    expect(bsaf.value).toBe('0.5');
    // No override badges or Reset buttons on initial render.
    expect(
      screen.queryByTestId('ecofood-trv-override-badge'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ecofood-bsaf-override-badge'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('ecofood-trv-reset')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ecofood-bsaf-reset')).not.toBeInTheDocument();
  });

  it('defaults to freshwater ecosystem and shows M_eco = 1', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    const group = screen.getByTestId('ecofood-ecosystem');
    const freshwaterButton = within(group).getByRole('radio', {
      name: /Freshwater/i,
    });
    expect(freshwaterButton).toHaveAttribute('aria-checked', 'true');
    // Technical details has M_eco intermediate; need to open the details
    // to read it (collapsed by default per plan v3 section 1 layout).
    const details = screen.getByTestId(
      'ecofood-technical-details',
    ) as HTMLDetailsElement;
    details.open = true;
    expect(screen.getByTestId('ecofood-meco')).toHaveTextContent('1');
  });

  it('applies the x15 BSAF multiplier when ecosystem switches to coastal-marine for a PAH', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    // Open Technical details to read intermediates.
    const details = screen.getByTestId(
      'ecofood-technical-details',
    ) as HTMLDetailsElement;
    details.open = true;
    // Capture the freshwater BSAF_effective for B[a]P (default substance).
    const initialBSAFEffective = parseFloat(
      screen.getByTestId('ecofood-bsaf-effective').textContent ?? '0',
    );
    // Switch to coastal-marine.
    const group = screen.getByTestId('ecofood-ecosystem');
    const coastalButton = within(group).getByRole('radio', {
      name: /Coastal-Marine/i,
    });
    fireEvent.click(coastalButton);
    expect(screen.getByTestId('ecofood-meco')).toHaveTextContent('15');
    const coastalBSAFEffective = parseFloat(
      screen.getByTestId('ecofood-bsaf-effective').textContent ?? '0',
    );
    expect(coastalBSAFEffective / initialBSAFEffective).toBeCloseTo(15, 3);
  });

  it('anadromous quick-set updates F_site to 0.2; resident quick-set restores 1.0', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    const fsiteInput = screen.getByLabelText(/F_site/i) as HTMLInputElement;
    expect(fsiteInput.value).toBe('1.0');
    fireEvent.click(screen.getByTestId('ecofood-fsite-anadromous'));
    expect(fsiteInput.value).toBe('0.2');
    fireEvent.click(screen.getByTestId('ecofood-fsite-resident'));
    expect(fsiteInput.value).toBe('1.0');
  });

  it('blocks the SedS display (diagnostic-only badge) when foc drops below 0.2 percent', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    const focSlider = screen.getByLabelText(/Sediment f/i) as HTMLInputElement;
    fireEvent.change(focSlider, { target: { value: '0.1' } });
    expect(screen.getByTestId('ecofood-blocked')).toBeInTheDocument();
    // Open Technical details to see warnings.
    const details = screen.getByTestId(
      'ecofood-technical-details',
    ) as HTMLDetailsElement;
    details.open = true;
    const warnings = screen.getByTestId('ecofood-warnings');
    expect(warnings).toHaveTextContent(/below/i);
  });

  it('rejects a non-positive BSAF_loc with a clear error', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    const bsafInput = screen.getByTestId(
      'ecofood-bsaf-input',
    ) as HTMLInputElement;
    fireEvent.change(bsafInput, { target: { value: '0' } });
    const errorBox = screen.getByTestId('ecofood-error');
    expect(errorBox).toHaveTextContent(/BSAF_loc must be a positive/i);
  });

  it('rejects negative BW with a clear error', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    const bwInput = screen.getByLabelText(/BW_eco/i) as HTMLInputElement;
    fireEvent.change(bwInput, { target: { value: '-1' } });
    expect(screen.getByTestId('ecofood-error')).toHaveTextContent(
      /Body weight must be a positive decimal number/,
    );
  });

  // Plan v3 section 4.6 reset contract for TRV.
  it('re-seeds TRV when substanceKey prop changes (override OFF)', () => {
    const { rerender } = render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    expect(
      (screen.getByTestId('ecofood-trv-input') as HTMLInputElement).value,
    ).toBe('0.0025');
    rerender(
      <EcoFoodBSAFCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    // Total PCBs library TRV = 0.00012.
    expect(
      (screen.getByTestId('ecofood-trv-input') as HTMLInputElement).value,
    ).toBe('0.00012');
    // BSAF re-seeds too (PCBs library = 2.0).
    expect(
      (screen.getByTestId('ecofood-bsaf-input') as HTMLInputElement).value,
    ).toBe('2');
  });

  it('promotes TRV to override + shows badge + Reset when user edits it', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    fireEvent.change(screen.getByTestId('ecofood-trv-input'), {
      target: { value: '0.005' },
    });
    expect(
      screen.getByTestId('ecofood-trv-override-badge'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('ecofood-trv-reset')).toBeInTheDocument();
  });

  it('promotes BSAF to override + shows badge + Reset when user edits it', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    fireEvent.change(screen.getByTestId('ecofood-bsaf-input'), {
      target: { value: '1.25' },
    });
    expect(
      screen.getByTestId('ecofood-bsaf-override-badge'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('ecofood-bsaf-reset')).toBeInTheDocument();
  });

  it('does NOT clobber an override TRV when substanceKey prop changes', () => {
    const { rerender } = render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    fireEvent.change(screen.getByTestId('ecofood-trv-input'), {
      target: { value: '0.077' },
    });
    rerender(
      <EcoFoodBSAFCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect(
      (screen.getByTestId('ecofood-trv-input') as HTMLInputElement).value,
    ).toBe('0.077');
    expect(
      screen.getByTestId('ecofood-trv-override-badge'),
    ).toBeInTheDocument();
  });

  it('Reset TRV button clears override + re-seeds from current substance', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    fireEvent.change(screen.getByTestId('ecofood-trv-input'), {
      target: { value: '0.5' },
    });
    fireEvent.click(screen.getByTestId('ecofood-trv-reset'));
    expect(
      (screen.getByTestId('ecofood-trv-input') as HTMLInputElement).value,
    ).toBe('0.0025');
    expect(
      screen.queryByTestId('ecofood-trv-override-badge'),
    ).not.toBeInTheDocument();
  });

  it('Reset BSAF button clears override + re-seeds from current substance', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    fireEvent.change(screen.getByTestId('ecofood-bsaf-input'), {
      target: { value: '5.5' },
    });
    fireEvent.click(screen.getByTestId('ecofood-bsaf-reset'));
    expect(
      (screen.getByTestId('ecofood-bsaf-input') as HTMLInputElement).value,
    ).toBe('0.5');
    expect(
      screen.queryByTestId('ecofood-bsaf-override-badge'),
    ).not.toBeInTheDocument();
  });

  it('TRV and BSAF override flags are independent (mixed override + substance change)', () => {
    const { rerender } = render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    // Override TRV only.
    fireEvent.change(screen.getByTestId('ecofood-trv-input'), {
      target: { value: '0.077' },
    });
    expect(
      screen.getByTestId('ecofood-trv-override-badge'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ecofood-bsaf-override-badge'),
    ).not.toBeInTheDocument();
    // Substance change: TRV preserved (override active); BSAF re-seeds.
    rerender(
      <EcoFoodBSAFCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect(
      (screen.getByTestId('ecofood-trv-input') as HTMLInputElement).value,
    ).toBe('0.077');
    expect(
      (screen.getByTestId('ecofood-bsaf-input') as HTMLInputElement).value,
    ).toBe('2');
  });

  it('uses the selected regulatory frame without crashing', () => {
    for (const j of REGULATORY_FRAME_IDS) {
      const { unmount } = render(
        <EcoFoodBSAFCalculator
          substanceKey="benzo_a_pyrene"
          jurisdiction={j}
        />,
      );
      expect(
        screen.getByTestId('eco-food-bsaf-calculator'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('regulatory-frame-notice-eco-food-bsaf'),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it('renders the frame-variant fallback notice for every frame (empty FRAME_VARIANTS, Week 8)', () => {
    for (const j of REGULATORY_FRAME_IDS) {
      const { unmount } = render(
        <EcoFoodBSAFCalculator substanceKey="benzo_a_pyrene" jurisdiction={j} />,
      );
      const notice = screen.getByTestId('frame-variant-fallback-notice');
      expect(notice).toBeInTheDocument();
      // Proves getEquation(jurisdiction, 'eco-food-bsaf') was called and its
      // fallbackReason flowed through (not a hardcoded fallback).
      const text = notice.textContent ?? '';
      expect(text).toMatch(/No specialized equation is defined for frame/);
      const baselineMentions =
        text.split('Using BC Protocol 1 v5 DRA baseline').length - 1;
      expect(baselineMentions).toBe(1);
      unmount();
    }
  });

  it('does NOT render the embedded substance dropdown (substance lifted in PR-A2)', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    expect(screen.queryByLabelText(/^Substance$/i)).not.toBeInTheDocument();
    SUBSTANCE_LIBRARY.forEach((s) => {
      expect(
        screen.queryByRole('option', { name: new RegExp(s.displayName, 'i') }),
      ).not.toBeInTheDocument();
    });
  });

  // Plan v3 section 1 vertical layout regression coverage.
  it('renders sections in vertical order: inputs -> hero -> technical details', () => {
    const container = render(
      <EcoFoodBSAFCalculator {...DEFAULT_PROPS} />,
    ).container;
    const inputs = container.querySelector(
      '[data-testid="ecofood-inputs-section"]',
    );
    const hero = container.querySelector(
      '[data-testid="ecofood-preliminary-standard"]',
    );
    const details = container.querySelector(
      '[data-testid="ecofood-technical-details"]',
    );
    expect(inputs).not.toBeNull();
    expect(hero).not.toBeNull();
    expect(details).not.toBeNull();
    expect(
      inputs!.compareDocumentPosition(hero!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      hero!.compareDocumentPosition(details!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('hero is labeled "Preliminary Toxicity-Based Standard" (not "SedS")', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    const hero = screen.getByTestId('ecofood-preliminary-standard');
    expect(hero.textContent).toMatch(/Preliminary Toxicity-Based Standard/);
    expect(hero.textContent).not.toMatch(/\bSedS\b/);
  });

  it('Technical details section starts COLLAPSED (details/summary disclosure)', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    const details = screen.getByTestId(
      'ecofood-technical-details',
    ) as HTMLDetailsElement;
    expect(details.tagName).toBe('DETAILS');
    expect(details.open).toBe(false);
  });

  it('renders the calculator provenance panel with current BSAF values', () => {
    render(<EcoFoodBSAFCalculator {...DEFAULT_PROPS} />);
    const panel = screen.getByTestId('calculator-provenance-panel');
    expect(panel).toHaveTextContent(/References and provenance/);
    expect(panel).toHaveTextContent(/Ecological TRV/);
    expect(panel).toHaveTextContent(/0\.0025 mg\/kg-bw\/day/);
    expect(panel).toHaveTextContent(/US EPA Eco-SSL, PAHs/);
    expect(panel).toHaveTextContent(/current default/);
    expect(panel).toHaveTextContent(/pending source locator/);
    expect(panel).toHaveTextContent(/0 approved/);
  });

  it('renders successfully with NO props (defaults bridge to commit 6 wire-up)', () => {
    render(<EcoFoodBSAFCalculator />);
    expect(
      screen.getByTestId('eco-food-bsaf-calculator'),
    ).toBeInTheDocument();
    const summary = screen.getByTestId('ecofood-substance-summary');
    expect(summary.textContent).toMatch(/Benzo\[a\]pyrene/);
  });
});
