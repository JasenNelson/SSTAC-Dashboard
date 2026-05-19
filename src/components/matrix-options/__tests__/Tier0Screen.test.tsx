// Component tests for Tier0Screen.
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

import Tier0Screen from '../Tier0Screen';

describe('Tier0Screen', () => {
  it('renders with default samples and shows the UTL block', () => {
    render(<Tier0Screen />);
    expect(
      screen.getByRole('heading', { name: /Tier 0/i }),
    ).toBeInTheDocument();
    // Default sample set has n = 10; the n indicator below the textarea
    // should reflect that. (Multiple elements mention n = 10 -- the
    // K factor card and the sample-count line -- so use getAllByText.)
    expect(screen.getAllByText(/n = 10/).length).toBeGreaterThan(0);
  });

  it('shows PASS when Cs is at or below the UTL', () => {
    render(<Tier0Screen />);

    // Set Cs to a very low number guaranteed to be at or below UTL of the
    // default sample set (mean ~ 5, sd small, UTL well below 4 is impossible
    // for the default mean; use 0.1 to be safe).
    const csInput = screen.getByLabelText(/Measured site concentration/i);
    fireEvent.change(csInput, { target: { value: '0.1' } });

    const verdict = screen.getByTestId('tier0-verdict');
    expect(verdict).toHaveTextContent(/PASS/);
  });

  it('shows FAIL when Cs is well above the UTL', () => {
    render(<Tier0Screen />);

    const csInput = screen.getByLabelText(/Measured site concentration/i);
    fireEvent.change(csInput, { target: { value: '1000' } });

    const verdict = screen.getByTestId('tier0-verdict');
    expect(verdict).toHaveTextContent(/FAIL/);
  });

  it('suppresses the verdict when Cs is blank (does not show PASS on cleared input)', () => {
    // Codex P2 finding 2026-05-18 round 1: Number('') is 0, which is finite,
    // so the earlier implementation showed PASS for any positive UTL when
    // the user cleared the field mid-edit. Clearing must suppress the verdict.
    render(<Tier0Screen />);

    const csInput = screen.getByLabelText(/Measured site concentration/i);
    fireEvent.change(csInput, { target: { value: '' } });

    expect(screen.queryByTestId('tier0-verdict')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Enter a measured concentration/i),
    ).toBeInTheDocument();
  });

  it('suppresses the verdict and shows an error when Cs is negative', () => {
    // Codex P2 finding 2026-05-18 round 2: -1 is finite and trivially less
    // than a positive UTL, so the prior code showed PASS. Site analytical
    // concentrations must be >= 0.
    render(<Tier0Screen />);

    const csInput = screen.getByLabelText(/Measured site concentration/i);
    fireEvent.change(csInput, { target: { value: '-1' } });

    expect(screen.queryByTestId('tier0-verdict')).not.toBeInTheDocument();
    expect(
      screen.getByText(/greater than or equal to zero/i),
    ).toBeInTheDocument();
  });

  it('rejects negative reference samples (asymmetry with site Cs guard)', () => {
    // Cursor CLI secondary review P3 2026-05-18: site Cs is constrained
    // >= 0 by the codex-round-2 fix; reference samples must follow the
    // same asymmetry. Negative samples would silently distort mean/sd/UTL.
    render(<Tier0Screen />);

    const samplesInput = screen.getByLabelText(/Reference samples/i);
    fireEvent.change(samplesInput, {
      target: { value: '4.8, -0.5, 5.1, 4.9, 5.3, 4.7, 5.0, 5.2, 4.6, 5.4' },
    });

    expect(screen.getByText(/rejected non-numeric tokens.*-0\.5/i))
      .toBeInTheDocument();
  });

  // NOTE: a UI-level test that types '0x10' into the Cs <input type="number">
  // would not exercise the parseDecimalInput regex defense because jsdom's
  // type="number" filter strips the value at the input level before our
  // regex ever sees it. The regex IS still meaningful as defense-in-depth
  // for programmatic state injection / future paste-handler paths, but
  // is unit-tested in parseDecimal.test.ts rather than at the UI level.

  it('rejects hex-like tokens (e.g., 0x10) rather than silently parsing as 16', () => {
    // Opus adversarial review P3 2026-05-18: Number('0x10') returns 16 in
    // JavaScript, which would silently inject a sample value when a user
    // pastes hex from a clipboard. The regex whitelist blocks this.
    render(<Tier0Screen />);

    const samplesInput = screen.getByLabelText(/Reference samples/i);
    fireEvent.change(samplesInput, {
      target: { value: '4.8, 0x10, 5.1, 4.9, 5.3, 4.7, 5.0, 5.2, 4.6, 5.4' },
    });

    expect(screen.getByText(/rejected non-numeric tokens.*0x10/i))
      .toBeInTheDocument();
  });

  it('shows a K-factor clamp warning and screening-only qualifier for n < 5', () => {
    // Codex P2 finding 2026-05-18: utl9595 must propagate clamp warnings
    // and the UI must qualify the verdict when K was approximated.
    render(<Tier0Screen />);

    const samplesInput = screen.getByLabelText(/Reference samples/i);
    fireEvent.change(samplesInput, { target: { value: '4.8, 5.1, 5.3' } });

    expect(
      screen.getByTestId('tier0-k-clamp-warning'),
    ).toBeInTheDocument();
    // Verdict still renders (screening-only is qualified, not blocked).
    const csInput = screen.getByLabelText(/Measured site concentration/i);
    fireEvent.change(csInput, { target: { value: '0.1' } });
    const verdict = screen.getByTestId('tier0-verdict');
    expect(verdict).toHaveTextContent(/PASS/);
    expect(verdict).toHaveTextContent(/screening-only/);
  });
});
