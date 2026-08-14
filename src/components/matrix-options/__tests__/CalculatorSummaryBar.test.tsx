import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CalculatorSummaryBar, { type SummaryBarSlot } from '../CalculatorSummaryBar';

function slot(overrides: Partial<SummaryBarSlot> = {}): SummaryBarSlot {
  return {
    label: 'Slot',
    value: null,
    unit: 'mg/kg',
    state: 'pending',
    ...overrides,
  };
}

describe('CalculatorSummaryBar', () => {
  it('renders all three slots and reflects the computed/pending/waiting states with text labels', () => {
    render(
      <CalculatorSummaryBar
        pathwayLabel="Human Health Direct Contact"
        preliminary={slot({
          label: 'Preliminary standard',
          value: 0.0001136,
          unit: 'mg/kg dry',
          state: 'computed',
          formatValue: (v) => v.toPrecision(4),
        })}
        utl={slot({ label: 'Background UTL 95/95', state: 'pending' })}
        adjusted={slot({ label: 'Adjusted standard', state: 'waiting' })}
      />,
    );

    expect(screen.getByTestId('calculator-summary-bar-preliminary-chip')).toHaveTextContent(
      'COMPUTED',
    );
    expect(screen.getByTestId('calculator-summary-bar-preliminary-value')).toHaveTextContent(
      '0.0001136',
    );
    expect(screen.getByTestId('calculator-summary-bar-utl-chip')).toHaveTextContent('PENDING');
    expect(screen.getByTestId('calculator-summary-bar-utl-value')).toHaveTextContent('--');
    expect(screen.getByTestId('calculator-summary-bar-adjusted-chip')).toHaveTextContent(
      'WAITING',
    );
    expect(screen.getByTestId('calculator-summary-bar-progress')).toHaveTextContent(
      '1 of 3 numbers computed',
    );
  });

  it('shows a BLOCKED slot with a real text label', () => {
    render(
      <CalculatorSummaryBar
        pathwayLabel="Human Health Direct Contact"
        preliminary={slot({ label: 'Preliminary standard', state: 'blocked' })}
        utl={slot({ label: 'Background UTL 95/95', state: 'pending' })}
        adjusted={slot({ label: 'Adjusted standard', state: 'waiting' })}
      />,
    );
    expect(screen.getByTestId('calculator-summary-bar-preliminary-chip')).toHaveTextContent(
      'BLOCKED',
    );
  });

  it('shows the governing-value note only when provided', () => {
    const { rerender } = render(
      <CalculatorSummaryBar
        pathwayLabel="HH Food Web"
        preliminary={slot({ state: 'computed', value: 1 })}
        utl={slot({ state: 'computed', value: 2 })}
        adjusted={slot({ state: 'computed', value: 2 })}
      />,
    );
    expect(screen.queryByTestId('calculator-summary-bar-governing')).not.toBeInTheDocument();

    rerender(
      <CalculatorSummaryBar
        pathwayLabel="HH Food Web"
        preliminary={slot({ state: 'computed', value: 1 })}
        utl={slot({ state: 'computed', value: 2 })}
        adjusted={slot({ state: 'computed', value: 2 })}
        governingLabel="background UTL 95/95 (2 mg/kg)"
        governingNote="it exceeds the preliminary standard"
      />,
    );
    const governing = screen.getByTestId('calculator-summary-bar-governing');
    expect(governing).toHaveTextContent('background UTL 95/95 (2 mg/kg)');
    expect(governing).toHaveTextContent('it exceeds the preliminary standard');
  });

  it('announces all three slots through a polite live region and updates it when a value changes', () => {
    const { rerender } = render(
      <CalculatorSummaryBar
        pathwayLabel="HH Direct Contact"
        preliminary={slot({ label: 'Preliminary standard', state: 'pending' })}
        utl={slot({ label: 'Background UTL 95/95', state: 'pending' })}
        adjusted={slot({ label: 'Adjusted standard', state: 'pending' })}
      />,
    );
    const region = screen.getByTestId('calculator-summary-bar-live-region');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Preliminary standard: PENDING, no value yet');

    rerender(
      <CalculatorSummaryBar
        pathwayLabel="HH Direct Contact"
        preliminary={slot({
          label: 'Preliminary standard',
          state: 'computed',
          value: 5,
          unit: 'mg/kg',
        })}
        utl={slot({ label: 'Background UTL 95/95', state: 'pending' })}
        adjusted={slot({ label: 'Adjusted standard', state: 'pending' })}
      />,
    );
    expect(screen.getByTestId('calculator-summary-bar-live-region')).toHaveTextContent(
      'Preliminary standard: COMPUTED, 5 mg/kg',
    );
  });
});
