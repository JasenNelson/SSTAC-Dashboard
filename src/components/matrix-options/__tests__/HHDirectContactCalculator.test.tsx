import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/MathRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="math-renderer-mock">{content}</div>
  ),
}));

import HHDirectContactCalculator from '../HHDirectContactCalculator';

describe('HHDirectContactCalculator', () => {
  it('renders a functioning Human Health direct-contact calculator', () => {
    render(
      <HHDirectContactCalculator
        substanceKey="arsenic_inorganic"
        jurisdiction="bc-csr"
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
  });

  it('updates the result when exposure frequency changes', () => {
    render(
      <HHDirectContactCalculator
        substanceKey="arsenic_inorganic"
        jurisdiction="bc-csr"
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
        jurisdiction="bc-csr"
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
});
