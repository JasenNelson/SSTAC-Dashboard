// Component tests for CumulativeEffectsCalculator (Stage 2 Lane A2, base row #22).
// Calls computeTEQ/computeBaPeq/computeBaPeqLifetime directly (decision D0 -- standalone, not
// registered in equationDispatch.ts / ProvenancePathway). Keep this focused: render, a happy-path
// numeric equivalent, and a blocked/invalid path that withholds the total.
// Plain ASCII only.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import CumulativeEffectsCalculator from '../CumulativeEffectsCalculator';

describe('CumulativeEffectsCalculator', () => {
  it('renders without crashing, with both sub-tool sections present', () => {
    render(<CumulativeEffectsCalculator />);
    expect(
      screen.getByTestId('cumulative-effects-calculator'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('cum-bapeq-section')).toBeInTheDocument();
    expect(screen.getByTestId('cum-teq-section')).toBeInTheDocument();
  });

  it('happy path: default BaP-eq PAH cohort under ccme-2010 shows a numeric equivalent', () => {
    render(<CumulativeEffectsCalculator />);
    // Default scheme is ccme-2010 (verified, not blocked) with a cohort of 4 PAHs all defined
    // under that scheme -- the initial render must show a real computed equivalent, not a
    // blocked/withheld state.
    expect(screen.queryByTestId('cum-bapeq-blocked')).not.toBeInTheDocument();
    const equivalent = screen.getByTestId('cum-bapeq-value');
    expect(equivalent).toHaveTextContent(/[0-9]/);
    expect(equivalent).toHaveTextContent(/mg\/kg/);
  });

  it('happy path: default TEQ congener cohort under who-2022-devito-2024 shows a numeric equivalent', () => {
    render(<CumulativeEffectsCalculator />);
    expect(screen.queryByTestId('cum-teq-blocked')).not.toBeInTheDocument();
    const equivalent = screen.getByTestId('cum-teq-value');
    expect(equivalent).toHaveTextContent(/[0-9]/);
    expect(equivalent).toHaveTextContent(/mg\/kg/);
  });

  it('blocked path: selecting the not-yet-verified who-1998-pah RPF scheme blocks BaP-eq and withholds the total', () => {
    render(<CumulativeEffectsCalculator />);
    fireEvent.change(screen.getByTestId('cum-bapeq-scheme'), {
      target: { value: 'who-1998-pah' },
    });
    // Blocked box present, warnings visible.
    const blocked = screen.getByTestId('cum-bapeq-blocked');
    expect(blocked).toHaveTextContent(/not verified for scoring/i);
    expect(blocked).toHaveTextContent(/fail-closed/i);
    // No bogus total is shown as if valid -- the equivalent card must not render at all.
    expect(screen.queryByTestId('cum-bapeq-equivalent')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cum-bapeq-value')).not.toBeInTheDocument();
  });

  it('blocked path: emptying all TEQ congener rows blocks the result and withholds the total', () => {
    render(<CumulativeEffectsCalculator />);
    // Remove the 3 default congener rows one at a time via the per-row remove button.
    for (let i = 0; i < 3; i++) {
      const removeButtons = screen.getAllByLabelText(/Remove congener row/i);
      fireEvent.click(removeButtons[0]);
    }
    expect(screen.queryByLabelText(/Remove congener row/i)).not.toBeInTheDocument();
    const blocked = screen.getByTestId('cum-teq-blocked');
    expect(blocked).toHaveTextContent(/No congener entries supplied/i);
    expect(screen.queryByTestId('cum-teq-value')).not.toBeInTheDocument();
  });

  it('fail-closed: an out-of-range non-detect fraction (>1) withholds the TEQ total', () => {
    render(<CumulativeEffectsCalculator />);
    // computeTEQ does not range-check the substitution fraction, so the component must -- a value
    // above 1 would otherwise scale non-detects above the MDL and surface a valid-looking total.
    fireEvent.change(screen.getByTestId('cum-teq-nd-fraction'), {
      target: { value: '2' },
    });
    const err = screen.getByTestId('cum-teq-error');
    expect(err).toHaveTextContent(/invalid/i);
    expect(err).toHaveTextContent(/fail-closed/i);
    expect(screen.queryByTestId('cum-teq-value')).not.toBeInTheDocument();
  });

  it('lifetime ADAF toggle reveals age-bin fraction inputs and still renders a result without crashing', () => {
    render(<CumulativeEffectsCalculator />);
    expect(screen.queryByTestId('cum-bapeq-agebins')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cum-bapeq-lifetime-toggle'));
    expect(screen.getByTestId('cum-bapeq-agebins')).toBeInTheDocument();
    // Default fractions sum to 1.0 -- a real (non-blocked) lifetime-weighted equivalent renders.
    expect(screen.queryByTestId('cum-bapeq-blocked')).not.toBeInTheDocument();
    expect(screen.getByTestId('cum-bapeq-value')).toHaveTextContent(/[0-9]/);
  });

  it('adding a PAH row and a congener row does not crash the calculator', () => {
    render(<CumulativeEffectsCalculator />);
    fireEvent.click(screen.getByTestId('cum-bapeq-add-row'));
    fireEvent.click(screen.getByTestId('cum-teq-add-row'));
    expect(
      screen.getByTestId('cumulative-effects-calculator'),
    ).toBeInTheDocument();
  });
});
