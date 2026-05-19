// Component tests for EcoDirectEqPCalculator.
// Plain ASCII only.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock MathRenderer to avoid katex CSS import in jsdom; same pattern as
// TWGReviewPortal.test.tsx / JermilovaReviewPortal.test.tsx.
vi.mock('@/components/MathRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="math-renderer-mock">{content}</div>
  ),
}));

import EcoDirectEqPCalculator from '../EcoDirectEqPCalculator';
import { SUBSTANCE_LIBRARY } from '@/lib/matrix-options/substanceLibrary';

describe('EcoDirectEqPCalculator', () => {
  it('renders with the starter substance dropdown populated', () => {
    render(<EcoDirectEqPCalculator />);
    expect(
      screen.getByRole('heading', { name: /Eco-Direct/i }),
    ).toBeInTheDocument();
    // All 8 starter library entries appear as options.
    const substanceSelect = screen.getByLabelText(
      /Substance/i,
    ) as HTMLSelectElement;
    expect(substanceSelect.options).toHaveLength(SUBSTANCE_LIBRARY.length);
  });

  it('updates the displayed SedS when the foc slider changes', () => {
    render(<EcoDirectEqPCalculator />);
    const focSlider = screen.getByLabelText(
      /Fraction Organic Carbon/i,
    ) as HTMLInputElement;
    // Default foc = 2.0 %. Move to 5.0 % and confirm the slider value
    // updates (the SedS hero card should also update).
    fireEvent.change(focSlider, { target: { value: '5' } });
    expect(screen.getByText(/5\.00 %/)).toBeInTheDocument();
  });

  it('surfaces a warning AND suppresses the verdict when foc drops below 0.2 percent', () => {
    // Opus adversarial review P3 2026-05-18: the EqP component must
    // assert verdict suppression on blocked state, mirroring Tier0Screen
    // coverage. Round 2 fix could regress silently without this guard.
    render(<EcoDirectEqPCalculator />);
    const focSlider = screen.getByLabelText(
      /Fraction Organic Carbon/i,
    ) as HTMLInputElement;
    fireEvent.change(focSlider, { target: { value: '0.1' } });
    const warnings = screen.getByTestId('eqp-warnings');
    expect(warnings).toHaveTextContent(/below/i);
    expect(screen.queryByTestId('eqp-verdict')).not.toBeInTheDocument();
  });

  // Hex-like Cs (e.g., '0x10') would silently parse to 16 via bare Number()
  // if it reached parseDecimalInput's input. jsdom's <input type="number">
  // filter strips this at the UI level before our regex sees it, so this
  // path is unit-tested in parseDecimal.test.ts rather than at the UI level.
  // The regex defense in parseDecimal.ts is defense-in-depth for
  // programmatic state injection (Cursor CLI secondary review 2026-05-18).

  it('rejects negative Cs with a clear error', () => {
    // Cursor CLI secondary review P3 2026-05-18: symmetric with Tier 0
    // negative-Cs handling. The derivation function also blocks negatives
    // (codex round 2) for defense-in-depth.
    render(<EcoDirectEqPCalculator />);
    const csInput = screen.getByLabelText(
      /Measured C/i,
    ) as HTMLInputElement;
    fireEvent.change(csInput, { target: { value: '-1' } });
    const errorBox = screen.getByTestId('eqp-error');
    expect(errorBox).toHaveTextContent(/greater than or equal to zero/i);
  });
});
