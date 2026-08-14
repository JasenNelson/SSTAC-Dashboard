import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CalculatorStage, { StageStateChip, type StageState } from '../CalculatorStage';

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

  it('announces the state and detail through a polite live region', () => {
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
    expect(screen.getByTestId('stage-1-live-region')).toHaveTextContent(
      'Exposure Factors: PENDING',
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
    expect(screen.getByTestId('stage-1-live-region')).toHaveTextContent(
      'Exposure Factors: COMPUTED. All seven exposure-factor inputs are valid.',
    );
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
