// Component tests for BackgroundAdjustment.
// Reframed from Tier0Screen tests 2026-05-19; PASS/FAIL verdict assertions
// replaced with at-or-below / exceeds comparison assertions per the new
// post-derivation framing.
// Plain ASCII only.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock MathRenderer to avoid katex CSS import in jsdom; the existing test
// suite uses the same pattern (TWGReviewPortal.test.tsx,
// JermilovaReviewPortal.test.tsx).
vi.mock('@/components/MathRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="math-renderer-mock">{content}</div>
  ),
}));

import BackgroundAdjustment from '../BackgroundAdjustment';

describe('BackgroundAdjustment', () => {
  it('renders with the Background Adjustment heading + Provincial scope default + the UTL hero', () => {
    render(<BackgroundAdjustment />);
    expect(
      screen.getByRole('heading', { name: /Background Adjustment/i }),
    ).toBeInTheDocument();
    // Default Provincial sample set has n = 10; the n indicator below the
    // textarea + the K-factor card both mention it.
    expect(screen.getAllByText(/n = 10/).length).toBeGreaterThan(0);
    // UTL hero card shows the Provincial label by default.
    const hero = screen.getByTestId('bg-adjust-utl-hero');
    expect(hero).toHaveTextContent(/Provincial UTL 95\/95/);
  });

  it('flips the scope radio to Regional and updates the active textarea + UTL label', () => {
    render(<BackgroundAdjustment />);

    // Initially Provincial textarea content shown.
    const provincialInitial = screen.getByLabelText(
      /Provincial reference samples/i,
    ) as HTMLTextAreaElement;
    expect(provincialInitial.value).toMatch(/4\.8.*5\.1.*4\.9/);

    // Click the Regional radio.
    const regionalRadio = screen.getByRole('radio', { name: /Regional/i });
    fireEvent.click(regionalRadio);

    // Active textarea label switches to Regional and content is the regional
    // default (different numbers than the provincial default).
    const regional = screen.getByLabelText(
      /Regional reference samples/i,
    ) as HTMLTextAreaElement;
    expect(regional.value).toMatch(/5\.7.*5\.9.*5\.5/);

    // UTL hero now reads Regional.
    const hero = screen.getByTestId('bg-adjust-utl-hero');
    expect(hero).toHaveTextContent(/Regional UTL 95\/95/);
  });

  it('preserves both Provincial and Regional textareas when flipping scope (no data loss)', () => {
    // UX requirement 2026-05-19: scope-radio flip must NOT lose either
    // textarea's contents. State persistence is internal to the component.
    render(<BackgroundAdjustment />);

    // Edit Provincial textarea.
    const provincial = screen.getByLabelText(
      /Provincial reference samples/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(provincial, {
      target: { value: '1.1, 2.2, 3.3, 4.4, 5.5' },
    });
    expect(provincial.value).toBe('1.1, 2.2, 3.3, 4.4, 5.5');

    // Switch to Regional.
    fireEvent.click(screen.getByRole('radio', { name: /Regional/i }));

    // Edit Regional textarea.
    const regional = screen.getByLabelText(
      /Regional reference samples/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(regional, {
      target: { value: '9.9, 8.8, 7.7, 6.6' },
    });
    expect(regional.value).toBe('9.9, 8.8, 7.7, 6.6');

    // Flip back to Provincial -- the edited value must still be there.
    fireEvent.click(screen.getByRole('radio', { name: /Provincial/i }));
    const provincialAfter = screen.getByLabelText(
      /Provincial reference samples/i,
    ) as HTMLTextAreaElement;
    expect(provincialAfter.value).toBe('1.1, 2.2, 3.3, 4.4, 5.5');

    // And forward again to Regional -- the regional edit is preserved.
    fireEvent.click(screen.getByRole('radio', { name: /Regional/i }));
    const regionalAfter = screen.getByLabelText(
      /Regional reference samples/i,
    ) as HTMLTextAreaElement;
    expect(regionalAfter.value).toBe('9.9, 8.8, 7.7, 6.6');
  });

  it('shows an "at or below" comparison when measured Cs is below the UTL', () => {
    // Reframed from the prior PASS verdict: BC CSR Background Adjustment is
    // not a pre-screen pass/fail. The comparison is diagnostic only and the
    // operative compliance test is against max(Tier 1 generic, UTL) elsewhere.
    render(<BackgroundAdjustment />);

    const csInput = screen.getByLabelText(/Measured site concentration/i);
    fireEvent.change(csInput, { target: { value: '0.1' } });

    const comparison = screen.getByTestId('bg-adjust-cs-comparison');
    expect(comparison).toHaveTextContent(/at or below the provincial background UTL/i);
    expect(comparison).toHaveTextContent(/may apply/i);
  });

  it('shows an "exceeds" comparison when measured Cs is well above the UTL', () => {
    render(<BackgroundAdjustment />);

    const csInput = screen.getByLabelText(/Measured site concentration/i);
    fireEvent.change(csInput, { target: { value: '1000' } });

    const comparison = screen.getByTestId('bg-adjust-cs-comparison');
    expect(comparison).toHaveTextContent(/exceeds the provincial background UTL/i);
    expect(comparison).toHaveTextContent(/will not relax your Tier 1/i);
  });

  it('suppresses the Cs comparison when Cs is blank', () => {
    render(<BackgroundAdjustment />);

    const csInput = screen.getByLabelText(/Measured site concentration/i);
    fireEvent.change(csInput, { target: { value: '' } });

    expect(screen.queryByTestId('bg-adjust-cs-comparison')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Optional: enter a measured site concentration/i),
    ).toBeInTheDocument();
  });

  it('suppresses the Cs comparison and shows an error when Cs is negative', () => {
    render(<BackgroundAdjustment />);

    const csInput = screen.getByLabelText(/Measured site concentration/i);
    fireEvent.change(csInput, { target: { value: '-1' } });

    expect(screen.queryByTestId('bg-adjust-cs-comparison')).not.toBeInTheDocument();
    expect(
      screen.getByText(/greater than or equal to zero/i),
    ).toBeInTheDocument();
  });

  it('rejects negative reference samples (asymmetry with site Cs guard)', () => {
    render(<BackgroundAdjustment />);

    const samplesInput = screen.getByLabelText(/Provincial reference samples/i);
    fireEvent.change(samplesInput, {
      target: { value: '4.8, -0.5, 5.1, 4.9, 5.3, 4.7, 5.0, 5.2, 4.6, 5.4' },
    });

    expect(screen.getByText(/rejected non-numeric tokens.*-0\.5/i))
      .toBeInTheDocument();
  });

  it('rejects hex-like tokens (e.g., 0x10) rather than silently parsing as 16', () => {
    render(<BackgroundAdjustment />);

    const samplesInput = screen.getByLabelText(/Provincial reference samples/i);
    fireEvent.change(samplesInput, {
      target: { value: '4.8, 0x10, 5.1, 4.9, 5.3, 4.7, 5.0, 5.2, 4.6, 5.4' },
    });

    expect(screen.getByText(/rejected non-numeric tokens.*0x10/i))
      .toBeInTheDocument();
  });

  it('shows the K-factor clamp warning for n < 5', () => {
    render(<BackgroundAdjustment />);

    const samplesInput = screen.getByLabelText(/Provincial reference samples/i);
    fireEvent.change(samplesInput, { target: { value: '4.8, 5.1, 5.3' } });

    expect(
      screen.getByTestId('bg-adjust-k-clamp-warning'),
    ).toBeInTheDocument();

    // Cs comparison still computes; the screening-only qualifier is on the
    // K-factor card, not on the Cs comparison anymore.
    const csInput = screen.getByLabelText(/Measured site concentration/i);
    fireEvent.change(csInput, { target: { value: '0.1' } });
    expect(
      screen.getByTestId('bg-adjust-cs-comparison'),
    ).toBeInTheDocument();
  });
});
