// Component tests for EcoFoodBSAFCalculator.
// Plain ASCII only.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// Mock MathRenderer to avoid katex CSS import in jsdom; same pattern as
// EcoDirectEqPCalculator.test.tsx.
vi.mock('@/components/MathRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="math-renderer-mock">{content}</div>
  ),
}));

import EcoFoodBSAFCalculator from '../EcoFoodBSAFCalculator';
import { SUBSTANCE_LIBRARY } from '@/lib/matrix-options/substanceLibrary';

describe('EcoFoodBSAFCalculator', () => {
  it('renders with the Eco-Food capable substance dropdown', () => {
    render(<EcoFoodBSAFCalculator />);
    expect(
      screen.getByRole('heading', { name: /Eco-Food/i }),
    ).toBeInTheDocument();
    // Dropdown only includes substances with a positive freshwater BSAF
    // (B[a]P, total PCBs, methylmercury).
    const substanceSelect = screen.getByLabelText(
      /Substance/i,
    ) as HTMLSelectElement;
    const eligibleCount = SUBSTANCE_LIBRARY.filter(
      (s) => s.bsaf_loc_freshwater !== null && s.bsaf_loc_freshwater > 0,
    ).length;
    expect(substanceSelect.options).toHaveLength(eligibleCount);
    // Confirm the headline trio is present.
    const optionTexts = Array.from(substanceSelect.options).map((o) => o.text);
    expect(optionTexts).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Benzo\[a\]pyrene/),
        expect.stringMatching(/Methylmercury/),
        expect.stringMatching(/PCBs/),
      ]),
    );
  });

  it('defaults to freshwater ecosystem and shows M_eco = 1', () => {
    render(<EcoFoodBSAFCalculator />);
    const group = screen.getByTestId('ecofood-ecosystem');
    const freshwaterButton = within(group).getByRole('radio', {
      name: /Freshwater/i,
    });
    expect(freshwaterButton).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('ecofood-meco')).toHaveTextContent('1');
  });

  it('applies the x15 BSAF multiplier when ecosystem switches to coastal-marine for a PAH', () => {
    render(<EcoFoodBSAFCalculator />);
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
    // Within floating-point tolerance, coastal/freshwater BSAF_effective
    // ratio should be 15.
    expect(coastalBSAFEffective / initialBSAFEffective).toBeCloseTo(15, 3);
  });

  it('anadromous quick-set updates the F_site input to 0.2', () => {
    render(<EcoFoodBSAFCalculator />);
    const fsiteInput = screen.getByLabelText(/F_site/i) as HTMLInputElement;
    expect(fsiteInput.value).toBe('1.0');
    fireEvent.click(screen.getByTestId('ecofood-fsite-anadromous'));
    expect(fsiteInput.value).toBe('0.2');
    // Resident quick-set should restore 1.0.
    fireEvent.click(screen.getByTestId('ecofood-fsite-resident'));
    expect(fsiteInput.value).toBe('1.0');
  });

  it('blocks the SedS display (shows diagnostic-only badge) when foc drops below 0.2 percent', () => {
    render(<EcoFoodBSAFCalculator />);
    const focSlider = screen.getByLabelText(
      /Sediment f/i,
    ) as HTMLInputElement;
    fireEvent.change(focSlider, { target: { value: '0.1' } });
    expect(screen.getByTestId('ecofood-blocked')).toBeInTheDocument();
    const warnings = screen.getByTestId('ecofood-warnings');
    expect(warnings).toHaveTextContent(/below/i);
  });

  it('rejects a non-positive BSAF_loc with a clear error', () => {
    render(<EcoFoodBSAFCalculator />);
    const bsafInput = screen.getByLabelText(/BSAF_loc/i) as HTMLInputElement;
    fireEvent.change(bsafInput, { target: { value: '0' } });
    const errorBox = screen.getByTestId('ecofood-error');
    expect(errorBox).toHaveTextContent(/BSAF_loc must be a positive/i);
  });
});
