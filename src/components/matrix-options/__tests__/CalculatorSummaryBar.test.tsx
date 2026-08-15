import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import CalculatorSummaryBar, { type SummaryBarSlot } from '../CalculatorSummaryBar';
import { ANNOUNCEMENT_DEBOUNCE_MS } from '../CalculatorStage';

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

  describe('default value formatting (P1-1)', () => {
    it('uses the shared magnitude-aware formatter when no formatValue is supplied, never rendering a real sub-5e-5 value as zero', () => {
      render(
        <CalculatorSummaryBar
          pathwayLabel="HH Direct Contact"
          preliminary={slot({ label: 'Preliminary standard', state: 'pending' })}
          utl={slot({ label: 'Background UTL 95/95', state: 'pending' })}
          adjusted={slot({
            label: 'Adjusted standard',
            state: 'computed',
            value: 0.000098592,
            unit: 'mg/kg dry',
          })}
        />,
      );
      const value = screen.getByTestId('calculator-summary-bar-adjusted-value');
      expect(value.textContent).toBe('0.00009859');
      expect(value.textContent).not.toBe('0.0000');
    });
  });

  describe('live-region announcements (P2-6)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not announce the initial state on mount', () => {
      render(
        <CalculatorSummaryBar
          pathwayLabel="HH Direct Contact"
          preliminary={slot({ label: 'Preliminary standard', state: 'pending' })}
          utl={slot({ label: 'Background UTL 95/95', state: 'pending' })}
          adjusted={slot({ label: 'Adjusted standard', state: 'pending' })}
        />,
      );
      act(() => {
        vi.advanceTimersByTime(ANNOUNCEMENT_DEBOUNCE_MS + 100);
      });
      expect(screen.getByTestId('calculator-summary-bar-live-region')).toHaveTextContent('');
    });

    it('announces all three slots through a polite live region, after the debounce delay, and updates it when a value changes', () => {
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
      expect(region).toHaveAttribute('aria-atomic', 'true');

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

      // Not announced yet -- still inside the debounce window.
      expect(screen.getByTestId('calculator-summary-bar-live-region')).toHaveTextContent('');

      act(() => {
        vi.advanceTimersByTime(ANNOUNCEMENT_DEBOUNCE_MS);
      });

      // formatMagnitude(5) === '5.0000' (P1-1b fix, 2026-08-14): 5 is
      // above the 0.1 fixed-vs-significant-figure threshold, so the
      // toFixed(4)-identical display is used, not the truncated 4-sig-fig
      // '5.000'.
      expect(screen.getByTestId('calculator-summary-bar-live-region')).toHaveTextContent(
        'Preliminary standard: COMPUTED, 5.0000 mg/kg',
      );
    });

    it('collapses a rapid sequence of slot-value changes into a single announcement of the final state', () => {
      const { rerender } = render(
        <CalculatorSummaryBar
          pathwayLabel="HH Direct Contact"
          preliminary={slot({ label: 'Preliminary standard', state: 'pending' })}
          utl={slot({ label: 'Background UTL 95/95', state: 'pending' })}
          adjusted={slot({ label: 'Adjusted standard', state: 'pending' })}
        />,
      );

      for (const value of [7, 70, 70.5]) {
        rerender(
          <CalculatorSummaryBar
            pathwayLabel="HH Direct Contact"
            preliminary={slot({
              label: 'Preliminary standard',
              state: 'computed',
              value,
              unit: 'mg/kg',
            })}
            utl={slot({ label: 'Background UTL 95/95', state: 'pending' })}
            adjusted={slot({ label: 'Adjusted standard', state: 'pending' })}
          />,
        );
        act(() => {
          vi.advanceTimersByTime(ANNOUNCEMENT_DEBOUNCE_MS / 2);
        });
      }

      expect(screen.getByTestId('calculator-summary-bar-live-region')).toHaveTextContent('');

      act(() => {
        vi.advanceTimersByTime(ANNOUNCEMENT_DEBOUNCE_MS);
      });

      // formatMagnitude(70.5) === '70.5000' (P1-1b fix, 2026-08-14): same
      // threshold reasoning as the '5.0000' case above.
      expect(screen.getByTestId('calculator-summary-bar-live-region')).toHaveTextContent(
        'Preliminary standard: COMPUTED, 70.5000 mg/kg',
      );
    });
  });
});
