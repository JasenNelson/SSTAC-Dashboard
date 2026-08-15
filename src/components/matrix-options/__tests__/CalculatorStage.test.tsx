import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import CalculatorStage, {
  ANNOUNCEMENT_DEBOUNCE_MS,
  StageStateChip,
  type StageState,
} from '../CalculatorStage';

describe('CalculatorStage', () => {
  const cases: Array<[StageState, string]> = [
    ['computed', 'COMPUTED'],
    ['pending', 'PENDING'],
    ['waiting', 'WAITING'],
    ['blocked', 'BLOCKED'],
  ];

  it.each(cases)('renders the %s state with a real text label, not colour alone', (state, label) => {
    render(
      <CalculatorStage
        number={1}
        totalStages={2}
        title="Exposure Factors"
        state={state}
        testId="stage-1"
      >
        <p>body</p>
      </CalculatorStage>,
    );
    expect(screen.getByTestId('stage-1')).toHaveAttribute('data-stage-state', state);
    expect(screen.getByTestId('stage-1-chip')).toHaveTextContent(label);
  });

  it('renders the stage number, "Stage N of M" label, title, and body content', () => {
    render(
      <CalculatorStage
        number={2}
        totalStages={5}
        title="Preliminary Standard"
        state="computed"
        testId="stage-2"
      >
        <p data-testid="body-content">child content</p>
      </CalculatorStage>,
    );
    expect(screen.getByText('Stage 2 of 5')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Preliminary Standard' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('body-content')).toBeInTheDocument();
    expect(screen.getByTestId('stage-2-body')).toContainElement(
      screen.getByTestId('body-content'),
    );
  });

  it('shows the receivedFrom line only when provided', () => {
    const { rerender } = render(
      <CalculatorStage
        number={3}
        totalStages={5}
        title="Adjusted Standard"
        state="waiting"
        receivedFrom="Stage 2 preliminary standard"
        testId="stage-3"
      >
        <p>body</p>
      </CalculatorStage>,
    );
    expect(screen.getByTestId('stage-3-received-from')).toHaveTextContent(
      'Stage 2 preliminary standard',
    );

    rerender(
      <CalculatorStage
        number={3}
        totalStages={5}
        title="Adjusted Standard"
        state="computed"
        testId="stage-3"
      >
        <p>body</p>
      </CalculatorStage>,
    );
    expect(screen.queryByTestId('stage-3-received-from')).not.toBeInTheDocument();
  });

  it('shows the stateDetail explanation when provided', () => {
    render(
      <CalculatorStage
        number={1}
        totalStages={2}
        title="Exposure Factors"
        state="blocked"
        stateDetail="Body weight must be positive."
        testId="stage-1"
      >
        <p>body</p>
      </CalculatorStage>,
    );
    expect(screen.getByTestId('stage-1-state-detail')).toHaveTextContent(
      'Body weight must be positive.',
    );
  });

  describe('heading level (P2-5)', () => {
    it('defaults to h4 so the stage title sits below the calculator title (h3) in the outline', () => {
      render(
        <CalculatorStage
          number={1}
          totalStages={2}
          title="Exposure Factors"
          state="pending"
          testId="stage-1"
        >
          <p>body</p>
        </CalculatorStage>,
      );
      const heading = screen.getByRole('heading', { name: 'Exposure Factors' });
      expect(heading.tagName).toBe('H4');
      expect(heading).toHaveProperty('tagName', 'H4');
    });

    it('renders a caller-supplied heading level', () => {
      render(
        <CalculatorStage
          number={1}
          totalStages={2}
          title="Exposure Factors"
          headingLevel="h5"
          state="pending"
          testId="stage-1"
        >
          <p>body</p>
        </CalculatorStage>,
      );
      const heading = screen.getByRole('heading', { name: 'Exposure Factors', level: 5 });
      expect(heading.tagName).toBe('H5');
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
        <CalculatorStage
          number={1}
          totalStages={2}
          title="Exposure Factors"
          state="blocked"
          stateDetail="Body weight must be positive."
          testId="stage-1"
        >
          <p>body</p>
        </CalculatorStage>,
      );
      // Mount should not queue an announcement at all -- advancing time
      // past the debounce window must not produce one either.
      act(() => {
        vi.advanceTimersByTime(ANNOUNCEMENT_DEBOUNCE_MS + 100);
      });
      expect(screen.getByTestId('stage-1-live-region')).toHaveTextContent('');
    });

    it('announces a real state transition, after the debounce delay, through a polite live region', () => {
      const { rerender } = render(
        <CalculatorStage
          number={1}
          totalStages={2}
          title="Exposure Factors"
          state="pending"
          testId="stage-1"
        >
          <p>body</p>
        </CalculatorStage>,
      );

      rerender(
        <CalculatorStage
          number={1}
          totalStages={2}
          title="Exposure Factors"
          state="blocked"
          stateDetail="Body weight must be positive."
          testId="stage-1"
        >
          <p>body</p>
        </CalculatorStage>,
      );

      // Not announced yet -- still inside the debounce window.
      expect(screen.getByTestId('stage-1-live-region')).toHaveTextContent('');

      act(() => {
        vi.advanceTimersByTime(ANNOUNCEMENT_DEBOUNCE_MS);
      });

      const status = screen.getByTestId('stage-1-live-region');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveTextContent(/Exposure Factors: BLOCKED/);
      expect(status).toHaveTextContent(/Body weight must be positive\./);
    });

    it('replaces the live-region text when the state transitions', () => {
      const { rerender } = render(
        <CalculatorStage
          number={1}
          totalStages={2}
          title="Exposure Factors"
          state="pending"
          testId="stage-1"
        >
          <p>body</p>
        </CalculatorStage>,
      );

      rerender(
        <CalculatorStage
          number={1}
          totalStages={2}
          title="Exposure Factors"
          state="computed"
          stateDetail="All seven exposure-factor inputs are valid."
          testId="stage-1"
        >
          <p>body</p>
        </CalculatorStage>,
      );
      act(() => {
        vi.advanceTimersByTime(ANNOUNCEMENT_DEBOUNCE_MS);
      });
      expect(screen.getByTestId('stage-1-live-region')).toHaveTextContent(
        'Exposure Factors: COMPUTED. All seven exposure-factor inputs are valid.',
      );
    });

    it('collapses a rapid sequence of changes into a single announcement of the final state', () => {
      const { rerender } = render(
        <CalculatorStage
          number={1}
          totalStages={2}
          title="Exposure Factors"
          state="pending"
          testId="stage-1"
        >
          <p>body</p>
        </CalculatorStage>,
      );

      // Simulate several rapid keystroke-driven state changes, each well
      // inside the debounce window of the previous one.
      for (const detail of ['7', '70', '70.', '70.5']) {
        rerender(
          <CalculatorStage
            number={1}
            totalStages={2}
            title="Exposure Factors"
            state="blocked"
            stateDetail={`Body weight: ${detail}`}
            testId="stage-1"
          >
            <p>body</p>
          </CalculatorStage>,
        );
        act(() => {
          vi.advanceTimersByTime(ANNOUNCEMENT_DEBOUNCE_MS / 2);
        });
      }

      // None of the intermediate states should have been announced yet.
      expect(screen.getByTestId('stage-1-live-region')).toHaveTextContent('');

      act(() => {
        vi.advanceTimersByTime(ANNOUNCEMENT_DEBOUNCE_MS);
      });

      // Only the final, settled state is announced -- exactly once.
      expect(screen.getByTestId('stage-1-live-region')).toHaveTextContent(
        'Exposure Factors: BLOCKED. Body weight: 70.5',
      );
    });
  });
});

describe('StageStateChip', () => {
  it.each([
    ['computed', 'COMPUTED'],
    ['pending', 'PENDING'],
    ['waiting', 'WAITING'],
    ['blocked', 'BLOCKED'],
  ] as Array<[StageState, string]>)('renders a %s chip with the %s text label', (state, label) => {
    render(<StageStateChip state={state} testId="chip" />);
    expect(screen.getByTestId('chip')).toHaveTextContent(label);
  });
});
