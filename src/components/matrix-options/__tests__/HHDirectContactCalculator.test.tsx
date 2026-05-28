import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/MathRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="math-renderer-mock">{content}</div>
  ),
}));

import HHDirectContactCalculator from '../HHDirectContactCalculator';
import { REGULATORY_FRAME_IDS } from '@/lib/matrix-options/regulatoryFrames';

describe('HHDirectContactCalculator', () => {
  it('renders a functioning Human Health direct-contact calculator', () => {
    render(
      <HHDirectContactCalculator
        substanceKey="arsenic_inorganic"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );

    expect(screen.getByTestId('hh-direct-contact-calculator')).toBeInTheDocument();
    expect(screen.getByTestId('hh-direct-substance-summary')).toHaveTextContent(
      /Arsenic/i,
    );
    expect(screen.getByTestId('hh-direct-preliminary-standard')).toHaveTextContent(
      /Preliminary Human Health Screening Value/i,
    );
    expect(screen.getByTestId('hh-direct-preliminary-standard')).not.toHaveTextContent(
      /--\s*mg\/kg/,
    );
    expect(
      screen.getByTestId('regulatory-frame-notice-human-health-direct'),
    ).toHaveTextContent(/BC Protocol 1 v5 DRA/);
  });

  it('updates the result when exposure frequency changes', () => {
    render(
      <HHDirectContactCalculator
        substanceKey="arsenic_inorganic"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    const before = screen.getByTestId('hh-direct-preliminary-standard').textContent;
    fireEvent.change(screen.getByLabelText(/Exposure frequency/i), {
      target: { value: '100' },
    });
    expect(screen.getByTestId('hh-direct-preliminary-standard').textContent).not.toBe(
      before,
    );
  });

  it('surfaces an error when both toxicology endpoints are blank', () => {
    render(
      <HHDirectContactCalculator
        substanceKey="arsenic_inorganic"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    fireEvent.change(screen.getByTestId('hh-direct-rfd-input'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByTestId('hh-direct-slope-input'), {
      target: { value: '' },
    });
    expect(screen.getByTestId('hh-direct-error')).toHaveTextContent(
      /At least one of RfD or oral slope factor/i,
    );
  });

  it('renders conservative provenance scaffolds for HH direct inputs', () => {
    render(
      <HHDirectContactCalculator
        substanceKey="arsenic_inorganic"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );

    const panel = screen.getByTestId('calculator-provenance-panel');
    expect(panel).toHaveTextContent(/References and provenance/);
    expect(panel).toHaveTextContent(/13 used values/);
    expect(panel).toHaveTextContent(/Oral RfD/);
    expect(panel).toHaveTextContent(/0\.0003 mg\/kg-bw\/day/);
    expect(panel).toHaveTextContent(/Exposure duration/);
    expect(panel).toHaveTextContent(/Cancer averaging time/);
    expect(panel).toHaveTextContent(/Skin surface area/);
    expect(panel).toHaveTextContent(/Sediment adherence/);
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
        <HHDirectContactCalculator substanceKey="arsenic_inorganic" jurisdiction={j} />,
      );
      const notice = screen.getByTestId('frame-variant-fallback-notice');
      expect(notice).toBeInTheDocument();
      // Proves getEquation(jurisdiction, 'human-health-direct') was called and
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
