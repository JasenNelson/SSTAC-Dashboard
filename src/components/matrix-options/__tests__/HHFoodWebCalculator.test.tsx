import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/MathRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="math-renderer-mock">{content}</div>
  ),
}));

import HHFoodWebCalculator from '../HHFoodWebCalculator';
import { REGULATORY_FRAME_IDS } from '@/lib/matrix-options/regulatoryFrames';

describe('HHFoodWebCalculator', () => {
  it('renders a functioning Human Health food-web calculator', () => {
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
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
        jurisdiction="bc-protocol1-v5-dra"
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
        jurisdiction="bc-protocol1-v5-dra"
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
    expect(
      screen.getByTestId('regulatory-frame-notice-human-health-food'),
    ).toHaveTextContent(/BC Protocol 1 v5 DRA/);
  });

  it('renders conservative provenance scaffolds for HH food-web inputs', () => {
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );

    const panel = screen.getByTestId('calculator-provenance-panel');
    expect(panel).toHaveTextContent(/References and provenance/);
    expect(panel).toHaveTextContent(/11 used values/);
    expect(panel).toHaveTextContent(/Local BSAF/);
    expect(panel).toHaveTextContent(/Target risk/);
    expect(panel).toHaveTextContent(/Hazard quotient/);
    expect(panel).toHaveTextContent(/current default/);
    expect(panel).toHaveTextContent(/needs review/);
    expect(panel).toHaveTextContent(/0 approved/);
    expect(panel).toHaveTextContent(
      /current calculator scaffold only/i,
    );
  });

  it('renders the frame-variant fallback notice for every frame (empty FRAME_VARIANTS, Week 8)', () => {
    for (const j of REGULATORY_FRAME_IDS) {
      const { unmount } = render(
        <HHFoodWebCalculator substanceKey="total_pcbs_aroclor_1254" jurisdiction={j} />,
      );
      const notice = screen.getByTestId('frame-variant-fallback-notice');
      expect(notice).toBeInTheDocument();
      // Proves getEquation(jurisdiction, 'human-health-food') was called and
      // its fallbackReason flowed through (not a hardcoded fallback).
      const text = notice.textContent ?? '';
      expect(text).toMatch(/No specialized equation is defined for frame/);
      const baselineMentions =
        text.split('Using BC Protocol 1 v5 DRA baseline').length - 1;
      expect(baselineMentions).toBe(1);
      unmount();
    }
  });
});
