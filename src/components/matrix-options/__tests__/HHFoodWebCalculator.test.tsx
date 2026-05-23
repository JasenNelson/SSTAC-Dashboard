import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/MathRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="math-renderer-mock">{content}</div>
  ),
}));

import HHFoodWebCalculator from '../HHFoodWebCalculator';

describe('HHFoodWebCalculator', () => {
  it('renders a functioning Human Health food-web calculator', () => {
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-csr"
      />,
    );

    expect(screen.getByTestId('hh-food-web-calculator')).toBeInTheDocument();
    expect(screen.getByTestId('hh-food-substance-summary')).toHaveTextContent(
      /PCBs/i,
    );
    expect(screen.getByTestId('hh-food-preliminary-standard')).toHaveTextContent(
      /Preliminary Human Health Screening Value/i,
    );
    expect(screen.getByTestId('hh-food-preliminary-standard')).not.toHaveTextContent(
      /--\s*mg\/kg/,
    );
  });

  it('quick-set buttons update the food ingestion rate', () => {
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-csr"
      />,
    );
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    expect(input.value).toBe('0.142');
    fireEvent.click(screen.getByRole('button', { name: /388 g\/day/i }));
    expect(input.value).toBe('0.388');
  });

  it('allows site-specific BSAF entry when the selected substance lacks a default BSAF', () => {
    render(
      <HHFoodWebCalculator
        substanceKey="lead"
        jurisdiction="bc-csr"
      />,
    );
    expect(screen.getByTestId('hh-food-error')).toHaveTextContent(
      /BSAF_loc must be a positive/i,
    );
    fireEvent.change(screen.getByTestId('hh-food-bsaf-input'), {
      target: { value: '0.25' },
    });
    expect(screen.queryByTestId('hh-food-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('hh-food-preliminary-standard')).not.toHaveTextContent(
      /--\s*mg\/kg/,
    );
  });

  it('renders conservative provenance scaffolds for HH food-web inputs', () => {
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-csr"
      />,
    );

    const panel = screen.getByTestId('calculator-provenance-panel');
    expect(panel).toHaveTextContent(/References and provenance/);
    expect(panel).toHaveTextContent(/11 used values/);
    expect(panel).toHaveTextContent(/Local BSAF/);
    expect(panel).toHaveTextContent(/Target risk/);
    expect(panel).toHaveTextContent(/Hazard quotient/);
    expect(panel).toHaveTextContent(/placeholder default/);
    expect(panel).toHaveTextContent(/needs review/);
    expect(panel).toHaveTextContent(
      /source review pending; current calculator scaffold only/,
    );
  });
});
