// Component tests for EcoDirectEqPCalculator (PR-A2 commit 4 refactor).
// substance + jurisdiction are now props lifted from SharedGlobalInputs;
// FCV reset contract per plan v3 section 4.6 is exercised directly.
// Plain ASCII only.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock MathRenderer to avoid katex CSS import in jsdom; same pattern as
// the prior version of this file.
vi.mock('@/components/MathRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="math-renderer-mock">{content}</div>
  ),
}));

import EcoDirectEqPCalculator from '../EcoDirectEqPCalculator';
import { SUBSTANCE_LIBRARY } from '@/lib/matrix-options/substanceLibrary';
import { REGULATORY_FRAME_IDS } from '@/lib/matrix-options/regulatoryFrames';

const DEFAULT_PROPS = {
  substanceKey: 'benzo_a_pyrene',
  jurisdiction: 'bc-protocol1-v5-dra' as const,
};

describe('EcoDirectEqPCalculator (PR-A2 commit 4, prop-driven)', () => {
  it('renders the active substance summary from the substanceKey prop', () => {
    render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    const summary = screen.getByTestId('eqp-substance-summary');
    expect(summary.textContent).toMatch(/Benzo\[a\]pyrene/);
    expect(summary.textContent).toMatch(/organic-PAH/);
    expect(summary.textContent).toMatch(/6\.13/);
  });

  it('seeds FCV from the substance library on initial render', () => {
    render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    // Benzo[a]pyrene library FCV = 0.014 ug/L.
    const fcv = screen.getByTestId('eqp-fcv-input') as HTMLInputElement;
    expect(fcv.value).toBe('0.014');
    // No override badge on the initial seed.
    expect(
      screen.queryByTestId('eqp-fcv-override-badge'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('eqp-fcv-reset')).not.toBeInTheDocument();
  });

  it('updates the displayed foc value when the foc slider changes', () => {
    render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    const focSlider = screen.getByLabelText(
      /Fraction Organic Carbon/i,
    ) as HTMLInputElement;
    fireEvent.change(focSlider, { target: { value: '5' } });
    expect(screen.getAllByText(/5\.00 %/).length).toBeGreaterThan(0);
  });

  it('surfaces warning AND suppresses verdict when foc drops below 0.2 percent', () => {
    render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    const focSlider = screen.getByLabelText(
      /Fraction Organic Carbon/i,
    ) as HTMLInputElement;
    fireEvent.change(focSlider, { target: { value: '0.1' } });
    const warnings = screen.getByTestId('eqp-warnings');
    expect(warnings).toHaveTextContent(/below/i);
    expect(screen.queryByTestId('eqp-verdict')).not.toBeInTheDocument();
  });

  it('rejects negative Cs with a clear error', () => {
    render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    const csInput = screen.getByLabelText(/Measured C/i) as HTMLInputElement;
    fireEvent.change(csInput, { target: { value: '-1' } });
    const errorBox = screen.getByTestId('eqp-error');
    expect(errorBox).toHaveTextContent(/greater than or equal to zero/i);
  });

  // Plan v3 section 4.6 + v6: substance-change re-seed contract.
  it('re-seeds FCV when substanceKey prop changes and override is OFF', () => {
    const { rerender } = render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    // Initial: B[a]P, FCV = 0.014.
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('0.014');
    // Switch to Total PCBs (Aroclor 1254), library FCV also 0.014 (substance
    // library row 2). Use a substance with a DIFFERENT FCV would be more
    // discriminating; the library currently only has 2 EqP-capable rows
    // and both happen to use 0.014. Test the path with a substance whose
    // FCV is null (MeHg) to prove the re-seed clears the prior value.
    rerender(
      <EcoDirectEqPCalculator
        substanceKey="methylmercury"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    const fcvAfter = screen.getByTestId('eqp-fcv-input') as HTMLInputElement;
    // MeHg has fcv_ug_per_L = null in the library, so re-seed empties the
    // input -- the downstream validator surfaces "FCV must be a positive
    // number" until the HITL supplies one.
    expect(fcvAfter.value).toBe('');
  });

  it('promotes FCV to override mode and shows the badge + Reset when the user edits it', () => {
    render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    // No override on initial render.
    expect(
      screen.queryByTestId('eqp-fcv-override-badge'),
    ).not.toBeInTheDocument();
    // User edits FCV.
    const fcv = screen.getByTestId('eqp-fcv-input');
    fireEvent.change(fcv, { target: { value: '0.025' } });
    expect((fcv as HTMLInputElement).value).toBe('0.025');
    // Badge + Reset button now visible.
    expect(
      screen.getByTestId('eqp-fcv-override-badge'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('eqp-fcv-reset')).toBeInTheDocument();
  });

  it('does NOT clobber an override FCV when substanceKey prop changes', () => {
    const { rerender } = render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    // User edits FCV to a non-library value.
    fireEvent.change(screen.getByTestId('eqp-fcv-input'), {
      target: { value: '0.099' },
    });
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('0.099');
    // Change substance via prop.
    rerender(
      <EcoDirectEqPCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    // FCV stays at the user's value; override badge persists.
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('0.099');
    expect(screen.getByTestId('eqp-fcv-override-badge')).toBeInTheDocument();
  });

  it('Reset button clears the override and re-seeds FCV from current substance library', () => {
    render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    // Promote to override.
    fireEvent.change(screen.getByTestId('eqp-fcv-input'), {
      target: { value: '0.5' },
    });
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('0.5');
    // Click Reset.
    fireEvent.click(screen.getByTestId('eqp-fcv-reset'));
    // FCV returns to library default (0.014 for B[a]P); badge + button hide.
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('0.014');
    expect(
      screen.queryByTestId('eqp-fcv-override-badge'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('eqp-fcv-reset')).not.toBeInTheDocument();
  });

  it('uses the selected regulatory frame without crashing', () => {
    for (const j of REGULATORY_FRAME_IDS) {
      const { unmount } = render(
        <EcoDirectEqPCalculator substanceKey="benzo_a_pyrene" jurisdiction={j} />,
      );
      expect(
        screen.getByTestId('eco-direct-eqp-calculator'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('regulatory-frame-notice-eco-direct-eqp'),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it('suppresses the frame-variant fallback notice for the default baseline frame', () => {
    // The baseline frame using the baseline equation is the expected state,
    // so the notice is suppressed even though FRAME_VARIANTS is empty and
    // usedBaselineFallback is true under the hood.
    render(
      <EcoDirectEqPCalculator
        substanceKey="benzo_a_pyrene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect(
      screen.queryByTestId('frame-variant-fallback-notice'),
    ).not.toBeInTheDocument();
  });

  it('renders the frame-variant fallback notice for non-default frames that fall back to baseline', () => {
    // With FRAME_VARIANTS empty, getEquation falls back to the BC Protocol 1
    // v5 DRA baseline for every NON-default frame (usedBaselineFallback true),
    // so the notice renders for all of them. When a frame-specific variant
    // ships, the notice must stop rendering for that frame.
    for (const j of REGULATORY_FRAME_IDS) {
      if (j === 'bc-protocol1-v5-dra') continue;
      const { unmount } = render(
        <EcoDirectEqPCalculator substanceKey="benzo_a_pyrene" jurisdiction={j} />,
      );
      const notice = screen.getByTestId('frame-variant-fallback-notice');
      expect(notice).toBeInTheDocument();
      // The notice text must include the dispatch-provided reason, which proves
      // getEquation(jurisdiction, 'eco-direct-eqp') was actually called and its
      // fallbackReason flowed through (rather than a hardcoded fallback).
      const text = notice.textContent ?? '';
      expect(text).toMatch(/No specialized equation is defined for frame/);
      // The baseline phrase must appear exactly once (regression guard against
      // the component lead sentence and the reason both stating it).
      const baselineMentions =
        text.split('Using BC Protocol 1 v5 DRA baseline').length - 1;
      expect(baselineMentions).toBe(1);
      unmount();
    }
  });

  // Cursor-agent review on Commit 4 (P3): chained state-machine test
  // covering the full override -> substance change -> reset transition,
  // not just the two halves in isolation.
  it('full state-machine: override -> substance change -> reset re-seeds from current substance', () => {
    const { rerender } = render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    // Start: B[a]P, FCV = 0.014, no override.
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('0.014');

    // 1. User edits FCV -> override engaged.
    fireEvent.change(screen.getByTestId('eqp-fcv-input'), {
      target: { value: '0.077' },
    });
    expect(screen.getByTestId('eqp-fcv-override-badge')).toBeInTheDocument();

    // 2. Switch substance to Total PCBs (Aroclor 1254). Override-protected:
    //    FCV must NOT auto-reseed to library value.
    rerender(
      <EcoDirectEqPCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('0.077');
    expect(screen.getByTestId('eqp-fcv-override-badge')).toBeInTheDocument();

    // 3. Click Reset. Override clears AND FCV re-seeds from PCBs library
    //    default (0.014 -- happens to match B[a]P; both are 0.014 in the
    //    current library). The discriminating check is that the override
    //    badge is GONE.
    fireEvent.click(screen.getByTestId('eqp-fcv-reset'));
    expect(
      screen.queryByTestId('eqp-fcv-override-badge'),
    ).not.toBeInTheDocument();
    // FCV is now sourced from total_pcbs_aroclor_1254 library FCV.
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('0.014');
  });

  // Cursor-agent review on Commit 4 (P3): negative test for the edge
  // where the user clears FCV to empty after editing. Override stays
  // engaged; the downstream validator surfaces the missing-value error.
  it('clearing FCV to empty after edit keeps override engaged + surfaces validator error', () => {
    render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    const fcv = screen.getByTestId('eqp-fcv-input') as HTMLInputElement;
    // Edit to something non-empty first so override engages.
    fireEvent.change(fcv, { target: { value: '0.099' } });
    expect(screen.getByTestId('eqp-fcv-override-badge')).toBeInTheDocument();
    // Now clear.
    fireEvent.change(fcv, { target: { value: '' } });
    expect(fcv.value).toBe('');
    // Override still engaged -- the user is in the middle of editing.
    expect(screen.getByTestId('eqp-fcv-override-badge')).toBeInTheDocument();
    // The downstream FCV validator at EcoDirectEqPCalculator.tsx ~L99
    // surfaces the missing-value error.
    expect(screen.getByTestId('eqp-error')).toHaveTextContent(
      /FCV must be a positive decimal number/,
    );
  });

  it('does not render the embedded substance dropdown (substance lifted in PR-A2)', () => {
    // Regression: PR-A2 commit 2 removed the per-calculator substance
    // dropdown. The substance is now controlled by SharedGlobalInputs at
    // the parent level. The label "Substance" should NOT exist in this
    // component anymore.
    render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    expect(screen.queryByLabelText(/^Substance$/i)).not.toBeInTheDocument();
    // SUBSTANCE_LIBRARY entries should not appear as <option> nodes here.
    SUBSTANCE_LIBRARY.forEach((s) => {
      expect(
        // Escape regex metacharacters in displayName (e.g. "Benzo[a]anthracene",
        // "DDT (p,p-)") so the match is literal and never throws SyntaxError.
        screen.queryByRole('option', {
          name: new RegExp(s.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        }),
      ).not.toBeInTheDocument();
    });
  });

  // Plan v3 section 1 + section 2: vertical layout order. Inputs FIRST,
  // then the prominent "Preliminary Toxicity-Based Standard" hero, then
  // a collapsed Technical-details disclosure. Hero is renamed from
  // "SedS" to match plan v3 wording.
  it('renders sections in vertical order: inputs -> hero -> technical details', () => {
    const container = render(
      <EcoDirectEqPCalculator {...DEFAULT_PROPS} />,
    ).container;
    const inputs = container.querySelector(
      '[data-testid="eqp-inputs-section"]',
    );
    const hero = container.querySelector(
      '[data-testid="eqp-preliminary-standard"]',
    );
    const details = container.querySelector(
      '[data-testid="eqp-technical-details"]',
    );
    expect(inputs).not.toBeNull();
    expect(hero).not.toBeNull();
    expect(details).not.toBeNull();
    // DOM order assertion: each subsequent element follows the previous in
    // document order (compareDocumentPosition returns DOCUMENT_POSITION_FOLLOWING
    // = 4 when the argument follows the node).
    expect(
      inputs!.compareDocumentPosition(hero!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      hero!.compareDocumentPosition(details!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('hero is labeled "Preliminary Toxicity-Based Standard" (not "SedS")', () => {
    render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    const hero = screen.getByTestId('eqp-preliminary-standard');
    expect(hero.textContent).toMatch(/Preliminary Toxicity-Based Standard/);
    // The bare token "SedS" should not appear inside the hero card --
    // the hero uses the canonical regulatory phrasing instead.
    expect(hero.textContent).not.toMatch(/\bSedS\b/);
  });

  it('Technical details section starts COLLAPSED (details/summary disclosure)', () => {
    render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    const details = screen.getByTestId(
      'eqp-technical-details',
    ) as HTMLDetailsElement;
    expect(details.tagName).toBe('DETAILS');
    expect(details.open).toBe(false);
  });

  it('renders the calculator provenance panel with current EqP values', () => {
    render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    const panel = screen.getByTestId('calculator-provenance-panel');
    expect(panel).toHaveTextContent(/References and provenance/);
    expect(panel).toHaveTextContent(/Final Chronic Value/);
    expect(panel).toHaveTextContent(/0\.014 ug\/L/);
    expect(panel).toHaveTextContent(/US EPA ESB Tier 2 values for nonionic organics/);
    expect(panel).toHaveTextContent(
      /pending exact source locator/i,
    );
    expect(panel).toHaveTextContent(/current default/);
    expect(panel).toHaveTextContent(/pending source locator/);
    expect(panel).toHaveTextContent(/0 approved/);
    expect(screen.queryByTestId('provenance-catalog-values')).not.toBeInTheDocument();
    expect(screen.queryByTestId('provenance-equation-records')).not.toBeInTheDocument();
    expect(screen.queryByTestId('provenance-source-records')).not.toBeInTheDocument();
  });

  it('labels scaffold FCV defaults as current calculator defaults, not approved source-backed', () => {
    render(
      <EcoDirectEqPCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    const panel = screen.getByTestId('calculator-provenance-panel');
    expect(panel).toHaveTextContent(/Final Chronic Value/);
    expect(panel).toHaveTextContent(/current default/);
    expect(panel).toHaveTextContent(/current calculator scaffold/);
    expect(panel).toHaveTextContent(/0 approved/);
  });

  // Codex review on Commit 4 (P3): the optional-props bridge keeps
  // MatrixDashboard's existing `<EcoDirectEqPCalculator />` call site
  // build-green between commits 4 and 6. Lock the bridge behavior at
  // runtime so a future "tighten props to required" cleanup cannot
  // silently break the intermediate-commit invariant.
  it('renders successfully with NO props (defaults bridge to commit 6 wire-up)', () => {
    render(<EcoDirectEqPCalculator />);
    expect(
      screen.getByTestId('eco-direct-eqp-calculator'),
    ).toBeInTheDocument();
    // Default substance is the first EqP-capable library row (B[a]P).
    const summary = screen.getByTestId('eqp-substance-summary');
    expect(summary.textContent).toMatch(/Benzo\[a\]pyrene/);
    // FCV seeded from B[a]P library default = 0.014.
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('0.014');
  });

  // Eco-wiring Step 4 + Step 6 promote: FCV seeds from the eco References & Values catalog
  // (frame-aware) before the substance library. benzene has NO library FCV (null) but an ESB
  // eco-direct catalog row (130 ug/L, approved after Step-6 4B) eligible under bc-protocol1-v5-dra.
  // The seed is approved (provisional=false) so NO provisional badge renders.
  it('seeds FCV from the approved eco catalog when the library has none (benzene)', () => {
    render(
      <EcoDirectEqPCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('130');
    // Approved seed: provisional badge must NOT be present.
    expect(
      screen.queryByTestId('eqp-fcv-provisional-badge'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('eqp-fcv-override-badge'),
    ).not.toBeInTheDocument();
  });

  it('attributes the provisional eco catalog row in the provenance panel (benzene ESB)', () => {
    render(
      <EcoDirectEqPCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    const panel = screen.getByTestId('calculator-provenance-panel');
    expect(panel).toHaveTextContent(/130 ug\/L/);
    expect(panel).toHaveTextContent(/ESB/i);
  });

  it('does NOT seed the eco catalog value under a reference_only frame (falls back; benzene)', () => {
    // canada-fcsap-aquatic marks eco-direct reference_only -> resolveEcoSeed returns null ->
    // fallback to the (null) benzene library FCV -> empty input, no provisional badge.
    render(
      <EcoDirectEqPCalculator
        substanceKey="benzene"
        jurisdiction="canada-fcsap-aquatic"
      />,
    );
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('');
    expect(
      screen.queryByTestId('eqp-fcv-provisional-badge'),
    ).not.toBeInTheDocument();
  });

  it('re-seeds FCV when the regulatory frame changes (eco catalog -> reference_only fallback)', () => {
    const { rerender } = render(
      <EcoDirectEqPCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('130');
    rerender(
      <EcoDirectEqPCalculator
        substanceKey="benzene"
        jurisdiction="canada-fcsap-aquatic"
      />,
    );
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('');
  });

  // After Step-6 4B promotion the benzene ESB seed is approved (provisional=false), so no provisional
  // badge is present at any point. The test verifies that a user edit still shows the override badge.
  it('shows the override badge when the user edits FCV (benzene, approved seed)', () => {
    render(
      <EcoDirectEqPCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    // No provisional badge on an approved seed -- before or after the user edit.
    expect(
      screen.queryByTestId('eqp-fcv-provisional-badge'),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('eqp-fcv-input'), {
      target: { value: '0.5' },
    });
    expect(
      screen.queryByTestId('eqp-fcv-provisional-badge'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('eqp-fcv-override-badge')).toBeInTheDocument();
  });

  it('does NOT clobber an override FCV when the regulatory frame changes (benzene)', () => {
    const { rerender } = render(
      <EcoDirectEqPCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    fireEvent.change(screen.getByTestId('eqp-fcv-input'), {
      target: { value: '0.077' },
    });
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('0.077');
    // Frame change must NOT reseed an overridden FCV (the override guard applies to frame changes
    // exactly as it does to substance changes).
    rerender(
      <EcoDirectEqPCalculator
        substanceKey="benzene"
        jurisdiction="canada-fcsap-aquatic"
      />,
    );
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('0.077');
    expect(screen.getByTestId('eqp-fcv-override-badge')).toBeInTheDocument();
  });

  it('does NOT show the provisional badge for a current_default scaffold substance (benzo_a_pyrene)', () => {
    // benzo_a_pyrene eco-direct catalog row is current_default -> excluded from provisional eligibility
    // -> resolveEcoSeed returns null -> library fallback (0.014), no provisional badge. Regression
    // guard that wiring did not change the current_default-backed substances.
    render(<EcoDirectEqPCalculator {...DEFAULT_PROPS} />);
    expect(
      (screen.getByTestId('eqp-fcv-input') as HTMLInputElement).value,
    ).toBe('0.014');
    expect(
      screen.queryByTestId('eqp-fcv-provisional-badge'),
    ).not.toBeInTheDocument();
  });
});
