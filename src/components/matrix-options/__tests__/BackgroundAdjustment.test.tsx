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
    expect(
      screen.getByTestId('regulatory-frame-notice-background-adjustment'),
    ).toHaveTextContent(/BC Protocol 1 v5 DRA/);
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

  it('renders the calculator provenance panel with the UTL equation source', () => {
    render(<BackgroundAdjustment />);
    const panel = screen.getByTestId('calculator-provenance-panel');
    expect(panel).toHaveTextContent(/References and provenance/);
    expect(panel).toHaveTextContent(/Provincial reference samples/);
    expect(panel).toHaveTextContent(/UTL 95\/95/);
    expect(panel).toHaveTextContent(/1 equation, 1 source/);
    expect(panel.textContent?.match(/not cataloged/g)?.length).toBe(4);
    expect(screen.queryByTestId('provenance-equation-records')).not.toBeInTheDocument();
    expect(screen.queryByTestId('provenance-source-records')).not.toBeInTheDocument();
  });

  // Step 4 of the redesign: Stage 4 (Adjusted Standard) = max(preliminary,
  // UTL). The default Provincial reference set (n = 10) computes to
  // UTL = 5.7516 (5.0000 + 2.8393 x 0.2582), unchanged from before this
  // step -- these tests only cover the NEW max() presentation layered on
  // top of that pre-existing, unchanged UTL.
  describe('Stage 4 -- Adjusted Standard (max(preliminary, UTL))', () => {
    it('is WAITING when no preliminaryStandard prop is supplied (operand unavailable)', () => {
      render(<BackgroundAdjustment />);
      expect(screen.getByTestId('bg-adjust-stage-4-chip')).toHaveTextContent('WAITING');
      expect(screen.getByTestId('bg-adjust-result-waiting')).toBeInTheDocument();
      expect(screen.queryByTestId('bg-adjust-result')).not.toBeInTheDocument();
    });

    it('is WAITING when preliminaryStandard is present but not yet computed (blocked upstream)', () => {
      render(
        <BackgroundAdjustment
          preliminaryStandard={{ value: null, unit: 'mg/kg dry', state: 'blocked' }}
        />,
      );
      expect(screen.getByTestId('bg-adjust-stage-4-chip')).toHaveTextContent('WAITING');
      expect(screen.getByTestId('bg-adjust-result-waiting')).toHaveTextContent(
        /preliminary standard \(currently BLOCKED\)/i,
      );
    });

    it('is WAITING when the background UTL is not yet computable (fewer than 2 samples), even with a valid preliminary standard', () => {
      render(
        <BackgroundAdjustment
          preliminaryStandard={{ value: 1.5, unit: 'mg/kg dry', state: 'computed' }}
        />,
      );
      const samplesInput = screen.getByLabelText(/Provincial reference samples/i);
      fireEvent.change(samplesInput, { target: { value: '4.8' } });

      expect(screen.getByTestId('bg-adjust-stage-3-chip')).toHaveTextContent('PENDING');
      expect(screen.getByTestId('bg-adjust-stage-4-chip')).toHaveTextContent('WAITING');
      expect(screen.getByTestId('bg-adjust-result-waiting')).toHaveTextContent(
        /background UTL 95\/95 from Stage 3/i,
      );
    });

    it('governs on the BACKGROUND UTL when it exceeds the preliminary standard, and reports it to onAdjustedStandardChange', () => {
      const onAdjustedStandardChange = vi.fn();
      // Default Provincial UTL = 5.7516; a tiny risk-based preliminary
      // standard (0.0001136, matching the mockup's HH Food Web example)
      // sits well below it, so background governs.
      render(
        <BackgroundAdjustment
          preliminaryStandard={{ value: 0.0001136, unit: 'mg/kg dry', state: 'computed' }}
          onAdjustedStandardChange={onAdjustedStandardChange}
        />,
      );

      expect(screen.getByTestId('bg-adjust-stage-4-chip')).toHaveTextContent('COMPUTED');
      const result = screen.getByTestId('bg-adjust-result');
      // Fix 1 (P1-1) displayed via the shared formatMagnitude formatter;
      // Fix 1b (P1-1b, 2026-08-14) corrected a precision regression the
      // first fix introduced -- formatMagnitude now reproduces the
      // toFixed(4) string exactly for "normal magnitude" values like this
      // one (>= 0.1), so the display is 5.7516, not the truncated 5.752.
      // The underlying computed value (~5.7516) is unchanged either way.
      expect(result).toHaveTextContent('5.7516');
      const governingSentence = screen.getByTestId('bg-adjust-governing-sentence');
      expect(governingSentence).toHaveTextContent(/background UTL 95\/95.*governs/i);
      expect(governingSentence).toHaveTextContent(/naturally/i);

      expect(onAdjustedStandardChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          value: expect.closeTo(5.7516, 4),
          unit: 'mg/kg dry',
          state: 'computed',
          governedBy: 'background',
        }),
      );
    });

    it('governs on the PRELIMINARY standard when it is at or above the background UTL, and reports it to onAdjustedStandardChange', () => {
      const onAdjustedStandardChange = vi.fn();
      // Preliminary standard (10) is above the default Provincial UTL
      // (5.7516), so the preliminary standard governs.
      render(
        <BackgroundAdjustment
          preliminaryStandard={{ value: 10, unit: 'mg/kg dry', state: 'computed' }}
          onAdjustedStandardChange={onAdjustedStandardChange}
        />,
      );

      expect(screen.getByTestId('bg-adjust-stage-4-chip')).toHaveTextContent('COMPUTED');
      const result = screen.getByTestId('bg-adjust-result');
      // Fix 1b (P1-1b, 2026-08-14): formatMagnitude(10) === '10.0000',
      // reproducing the original toFixed(4) display exactly (10 is well
      // above the 0.1 fixed-vs-significant-figure threshold). Computed
      // value unchanged.
      expect(result).toHaveTextContent('10.0000');
      const governingSentence = screen.getByTestId('bg-adjust-governing-sentence');
      expect(governingSentence).toHaveTextContent(/preliminary standard.*governs/i);

      expect(onAdjustedStandardChange).toHaveBeenLastCalledWith({
        value: 10,
        unit: 'mg/kg dry',
        state: 'computed',
        governedBy: 'preliminary',
      });
    });

    it('reports the background UTL to onUtlChange independently of the preliminary standard prop', () => {
      const onUtlChange = vi.fn();
      render(<BackgroundAdjustment onUtlChange={onUtlChange} />);
      expect(onUtlChange).toHaveBeenLastCalledWith({
        value: expect.closeTo(5.7516, 4),
        // Fix 2 (P2-1): 'mg/kg dry' now, reconciled with the preliminary/
        // adjusted slots' unit so the same physical quantity is not shown
        // with two different unit strings across the summary bar.
        unit: 'mg/kg dry',
        state: 'computed',
        scope: 'provincial',
        n: 10,
      });
    });
  });

  // Fix 2 (P2-1): guard against Stage 4 taking max() across mismatched
  // units. Every real caller today passes 'mg/kg dry' for both operands
  // (see the other Stage 4 tests above), so this only exercises the
  // future-mismatch REFUSAL path.
  describe('Stage 4 -- unit mismatch guard (P2-1)', () => {
    it('blocks Stage 4 and refuses to compute an adjusted standard when the preliminary standard unit does not match the UTL unit', () => {
      const onAdjustedStandardChange = vi.fn();
      render(
        <BackgroundAdjustment
          preliminaryStandard={{ value: 10, unit: 'ug/kg dry', state: 'computed' }}
          onAdjustedStandardChange={onAdjustedStandardChange}
        />,
      );

      expect(screen.getByTestId('bg-adjust-stage-4-chip')).toHaveTextContent('BLOCKED');
      const blocked = screen.getByTestId('bg-adjust-result-blocked');
      expect(blocked).toHaveTextContent(/unit mismatch/i);
      expect(blocked).toHaveTextContent(/ug\/kg dry/);
      expect(blocked).toHaveTextContent(/mg\/kg dry/);
      expect(screen.queryByTestId('bg-adjust-result')).not.toBeInTheDocument();
      expect(screen.queryByTestId('bg-adjust-result-waiting')).not.toBeInTheDocument();

      expect(onAdjustedStandardChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          value: null,
          state: 'blocked',
          governedBy: null,
        }),
      );
    });

    it('is unaffected (still computes) when the preliminary standard unit matches the UTL unit, case- and whitespace-insensitively', () => {
      render(
        <BackgroundAdjustment
          preliminaryStandard={{ value: 10, unit: ' MG/KG DRY ', state: 'computed' }}
        />,
      );
      expect(screen.getByTestId('bg-adjust-stage-4-chip')).toHaveTextContent('COMPUTED');
      expect(screen.getByTestId('bg-adjust-result')).toBeInTheDocument();
    });
  });
});
