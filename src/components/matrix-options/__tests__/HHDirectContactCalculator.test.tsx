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
    // Use testid instead of getByLabelText to avoid ambiguity now that the receptor-scenario
    // selector label also contains "exposure frequency" in its descriptive paragraph text.
    fireEvent.change(screen.getByTestId('hh-direct-ef-input'), {
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
    // T43 fail-closed sweep: a blocked (null-toxicology) input must withhold the numeric standard --
    // the hero card shows '--', never a stale or partial number.
    const standard = screen.getByTestId('hh-direct-preliminary-standard');
    expect(standard).toHaveTextContent(/--\s*mg\/kg/);
    expect(standard).not.toHaveTextContent(/[0-9]/);
  });

  // Renamed from "renders conservative provenance scaffolds for HH direct inputs"
  // because the behavior changed: the 7 receptor inputs are now source-backed HC PQRA
  // defaults even under the BC frame (frame-independent receptor provider). The substance
  // toxicity inputs (Oral RfD, slope, abs_dermal, ba_oral) remain calculator defaults.
  it('seeds source-backed HC PQRA receptor defaults under any frame', () => {
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
    // Updated 2026-07-02 for the IRIS 2025 inorganic-arsenic reassessment (RfD 3e-4 -> 6e-5).
    expect(panel).toHaveTextContent(/0\.00006 mg\/kg-bw\/day/);
    expect(panel).toHaveTextContent(/Exposure duration/);
    expect(panel).toHaveTextContent(/Cancer averaging time/);
    expect(panel).toHaveTextContent(/Skin surface area/);
    expect(panel).toHaveTextContent(/Sediment adherence/);
    // The 7 HC PQRA receptor inputs and 1 IRIS sf are now source-backed under any frame, so the
    // audit summary shows non-zero approved count (8 approved) + scaffold count drops.
    // We assert positively rather than guarding exact counts to be tolerant of catalog drift.
    expect(panel).toHaveTextContent(/8 approved/);
    expect(panel).toHaveTextContent(/4 current calculator scaffolds/);
    // The substance toxicity inputs (Oral RfD, slope, abs_dermal, ba_oral) are still
    // calculator scaffolds (needs review) -- confirm the scaffold role is still present.
    expect(panel).toHaveTextContent(/current default/);
    expect(panel).toHaveTextContent(/needs review/);
    // The 7 receptor inputs now carry the source-backed role (not "screening assumption").
    expect(panel).toHaveTextContent(/source-backed default/);
    // Confirm at least one approved source is shown (the HC PQRA source record).
    expect(panel).toHaveTextContent(/Health Canada PQRA/i);
  });

  it('suppresses the frame-variant fallback notice for the default baseline frame', () => {
    render(
      <HHDirectContactCalculator
        substanceKey="arsenic_inorganic"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect(
      screen.queryByTestId('frame-variant-fallback-notice'),
    ).not.toBeInTheDocument();
  });

  it('renders the frame-variant fallback notice for non-default frames that fall back to baseline', () => {
    for (const j of REGULATORY_FRAME_IDS) {
      if (j === 'bc-protocol1-v5-dra') continue;
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

  it('updates the result when targetRisk, hazardQuotient, absDermal, or baOral changes', () => {
    render(
      <HHDirectContactCalculator
        substanceKey="arsenic_inorganic"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    const beforeRisk = screen.getByTestId('hh-direct-preliminary-standard').textContent;
    fireEvent.change(screen.getByLabelText(/Target risk/i), { target: { value: '1e-6' } });
    const afterRisk = screen.getByTestId('hh-direct-preliminary-standard').textContent;
    expect(afterRisk).not.toBe(beforeRisk);

    // Clear slope factor so only non-cancer calculation is active
    fireEvent.change(screen.getByTestId('hh-direct-slope-input'), { target: { value: '' } });
    const afterClearSlope = screen.getByTestId('hh-direct-preliminary-standard').textContent;

    fireEvent.change(screen.getByLabelText(/Hazard quotient/i), { target: { value: '0.2' } });
    const afterHQ = screen.getByTestId('hh-direct-preliminary-standard').textContent;
    expect(afterHQ).not.toBe(afterClearSlope);

    fireEvent.change(screen.getByLabelText(/Dermal absorption/i), { target: { value: '0.05' } });
    const afterDermal = screen.getByTestId('hh-direct-preliminary-standard').textContent;
    expect(afterDermal).not.toBe(afterHQ);

    fireEvent.change(screen.getByLabelText(/Oral bioavailability/i), { target: { value: '0.8' } });
    const afterOral = screen.getByTestId('hh-direct-preliminary-standard').textContent;
    expect(afterOral).not.toBe(afterDermal);
  });
});

// A3 Option A: DL-PCB TEQ parallel screening card. Shown ONLY for total PCBs, alongside
// (never replacing) the mass-based result card above it.
describe('HHDirectContactCalculator DL-PCB TEQ parallel screening card', () => {
  it('renders the DL-PCB TEQ card with an approved provisional badge and a numeric TEQ standard for total PCBs', () => {
    render(
      <HHDirectContactCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    const card = screen.getByTestId('hh-direct-dlpcb-teq-standard');
    expect(card).toHaveTextContent(/DL-PCB TEQ parallel screening standard/i);
    
    const badge = screen.getByTestId('hh-direct-dlpcb-teq-provisional-badge');
    expect(badge).toHaveTextContent(/^Provisional$/);
    expect(badge).not.toHaveTextContent(/needs review/i);
    
    const title = badge.getAttribute('title') || '';
    expect(title).toMatch(/approved/i);
    expect(title).not.toMatch(/needs_review/i);
    expect(title).not.toMatch(/not yet HITL-verified/i);

    expect(screen.queryByTestId('hh-direct-dlpcb-teq-blocked')).not.toBeInTheDocument();
    expect(card).toHaveTextContent(/mg TEQ\/kg dry/i);
    // The mass-based sedS card is still present and unchanged for the PCB case.
    expect(screen.getByTestId('hh-direct-preliminary-standard')).toHaveTextContent(
      /Preliminary Human Health Screening Value/i,
    );
  });

  it('does not render the DL-PCB TEQ card for a non-PCB substance', () => {
    render(
      <HHDirectContactCalculator
        substanceKey="benzo_a_pyrene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect(screen.queryByTestId('hh-direct-dlpcb-teq-standard')).not.toBeInTheDocument();
    // The mass-based card is unaffected.
    expect(screen.getByTestId('hh-direct-preliminary-standard')).toHaveTextContent(
      /Preliminary Human Health Screening Value/i,
    );
  });

  it('blocks the DL-PCB TEQ card when the mass-based calculation itself is blocked (both endpoints blank)', () => {
    render(
      <HHDirectContactCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    fireEvent.change(screen.getByTestId('hh-direct-rfd-input'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('hh-direct-slope-input'), { target: { value: '' } });
    expect(screen.getByTestId('hh-direct-error')).toBeInTheDocument();
    expect(screen.getByTestId('hh-direct-dlpcb-teq-blocked')).toHaveTextContent(
      /DL-PCB TEQ value unavailable/i,
    );
  });
});

// C-HH-direct (2026-06-12): the canada-fcsap-aquatic frame seeds the seven HC PQRA v4.0
// toddler exposure factors. NO frameDefaults mock here -- this exercises the LIVE catalog
// (the cited records are promoted to approved, so they resolve 'active' and seed the
// fields). Mirrors HHFoodWebCalculator's BW frame-default test.
describe('HHDirectContactCalculator C-HH-direct frame default (live catalog)', () => {
  function renderFcsap() {
    return render(
      <HHDirectContactCalculator
        substanceKey="arsenic_inorganic"
        jurisdiction="canada-fcsap-aquatic"
      />,
    );
  }

  it('opens on the seeded toddler exposure factors with frame-default labels', () => {
    renderFcsap();
    // BW seeds 16.5 kg (toddler) with its per-seed source descriptor.
    const bw = screen.getByTestId('hh-direct-bw-input') as HTMLInputElement;
    expect(bw.value).toBe('16.5');
    const bwLabel = screen.getByTestId('hh-direct-bw-frame-default-label');
    expect(bwLabel).toHaveTextContent(/Frame default 16\.5 kg/);
    expect(bwLabel).toHaveTextContent('HC PQRA v4.0 2024');
    // IR_sed seeds 80 mg/day, SA 6130 cm2, AF 0.01 mg/cm2.
    expect(
      (screen.getByTestId('hh-direct-ir-sed-input') as HTMLInputElement).value,
    ).toBe('80');
    expect(
      (screen.getByTestId('hh-direct-sa-input') as HTMLInputElement).value,
    ).toBe('6130');
    expect(
      (screen.getByTestId('hh-direct-af-input') as HTMLInputElement).value,
    ).toBe('0.01');
    expect(
      screen.getByTestId('hh-direct-ir-sed-frame-default-label'),
    ).toBeInTheDocument();
  });

  it('a user edit shows the BW reset button; reset restores 16.5', () => {
    renderFcsap();
    const bw = screen.getByTestId('hh-direct-bw-input') as HTMLInputElement;
    expect(screen.queryByTestId('hh-direct-bw-reset-to-frame-default')).toBeNull();
    fireEvent.change(bw, { target: { value: '70' } });
    expect(bw.value).toBe('70');
    expect(
      screen.getByTestId('hh-direct-bw-reset-to-frame-default'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('hh-direct-bw-reset-to-frame-default'));
    expect(bw.value).toBe('16.5');
    expect(screen.queryByTestId('hh-direct-bw-reset-to-frame-default')).toBeNull();
  });

  it('user edits on other inputs show their reset buttons; resets restore defaults', () => {
    renderFcsap();
    // EF
    const ef = screen.getByTestId('hh-direct-ef-input') as HTMLInputElement;
    expect(screen.queryByTestId('hh-direct-ef-reset-to-frame-default')).toBeNull();
    fireEvent.change(ef, { target: { value: '180' } });
    expect(ef.value).toBe('180');
    expect(screen.getByTestId('hh-direct-ef-reset-to-frame-default')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('hh-direct-ef-reset-to-frame-default'));
    expect(ef.value).toBe('364');

    // AT_cancer
    const at = screen.getByTestId('hh-direct-at-cancer-input') as HTMLInputElement;
    expect(screen.queryByTestId('hh-direct-at-cancer-reset-to-frame-default')).toBeNull();
    fireEvent.change(at, { target: { value: '75' } });
    expect(at.value).toBe('75');
    expect(screen.getByTestId('hh-direct-at-cancer-reset-to-frame-default')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('hh-direct-at-cancer-reset-to-frame-default'));
    expect(at.value).toBe('80');

    // IR_sed
    const ir = screen.getByTestId('hh-direct-ir-sed-input') as HTMLInputElement;
    expect(screen.queryByTestId('hh-direct-ir-sed-reset-to-frame-default')).toBeNull();
    fireEvent.change(ir, { target: { value: '50' } });
    expect(ir.value).toBe('50');
    expect(screen.getByTestId('hh-direct-ir-sed-reset-to-frame-default')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('hh-direct-ir-sed-reset-to-frame-default'));
    expect(ir.value).toBe('80');

    // SA
    const sa = screen.getByTestId('hh-direct-sa-input') as HTMLInputElement;
    expect(screen.queryByTestId('hh-direct-sa-reset-to-frame-default')).toBeNull();
    fireEvent.change(sa, { target: { value: '5000' } });
    expect(sa.value).toBe('5000');
    expect(screen.getByTestId('hh-direct-sa-reset-to-frame-default')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('hh-direct-sa-reset-to-frame-default'));
    expect(sa.value).toBe('6130');

    // AF
    const af = screen.getByTestId('hh-direct-af-input') as HTMLInputElement;
    expect(screen.queryByTestId('hh-direct-af-reset-to-frame-default')).toBeNull();
    fireEvent.change(af, { target: { value: '0.05' } });
    expect(af.value).toBe('0.05');
    expect(screen.getByTestId('hh-direct-af-reset-to-frame-default')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('hh-direct-af-reset-to-frame-default'));
    expect(af.value).toBe('0.01');
  });

  // Renamed from "a no-default frame leaves the inputs at their baselines with no label"
  // because that premise is now obsolete: there is NO "no-default frame" for direct-contact.
  // Every frame falls back to the HC PQRA receptor provider (canada-fcsap-aquatic), so even a
  // frame with no direct-contact profiles of its own (e.g. ccme-sediment-quality) seeds BW=16.5
  // (toddler) via the frame-independent receptor provider.
  it('frame-independence: ccme-sediment-quality still seeds HC PQRA toddler receptor and shows the scenario selector', () => {
    render(
      <HHDirectContactCalculator
        substanceKey="arsenic_inorganic"
        jurisdiction="ccme-sediment-quality"
      />,
    );
    // BW is now 16.5 kg (toddler) even under a frame with no direct-contact profile.
    expect(
      (screen.getByTestId('hh-direct-bw-input') as HTMLInputElement).value,
    ).toBe('16.5');
    // The frame-default label is present (the receptor provider seeded it).
    expect(screen.getByTestId('hh-direct-bw-frame-default-label')).toBeInTheDocument();
    expect(screen.getByTestId('hh-direct-bw-frame-default-label')).toHaveTextContent(
      /Frame default 16\.5 kg/,
    );
    // The receptor-scenario selector is rendered (both scenarios are selectable).
    const select = screen.getByTestId(
      'hh-direct-receptor-scenario-select',
    ) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toContain('Residential toddler');
    expect(labels).toContain('Residential adult');
  });
});

// C-HH-direct receptor scenarios (2026-06-13): canada-fcsap-aquatic now offers THREE SELECTABLE
// receptor scenarios (residential toddler [default] + residential adult + commercial/industrial
// worker). LIVE catalog (all scenarios' seeds are promoted/approved -> selectable). Switching
// reseeds the receptor-specific exposure factors while the shared AT_cancer stays put.
describe('HHDirectContactCalculator receptor-scenario selector (live catalog)', () => {
  function renderFcsap() {
    return render(
      <HHDirectContactCalculator
        substanceKey="arsenic_inorganic"
        jurisdiction="canada-fcsap-aquatic"
      />,
    );
  }

  it('renders the selector defaulting to residential toddler with all three options', () => {
    renderFcsap();
    const select = screen.getByTestId('hh-direct-receptor-scenario-select') as HTMLSelectElement;
    expect(select.value).toBe('residential-toddler');
    const optionLabels = Array.from(select.options).map((o) => o.textContent);
    expect(optionLabels).toContain('Residential toddler');
    expect(optionLabels).toContain('Residential adult');
    expect(optionLabels).toContain('Commercial/industrial worker');
    // Default opens on the toddler receptor values.
    expect((screen.getByTestId('hh-direct-bw-input') as HTMLInputElement).value).toBe('16.5');
  });

  it('switching to Residential adult reseeds BW/IR_sed/SA to the adult values', () => {
    renderFcsap();
    const select = screen.getByTestId('hh-direct-receptor-scenario-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'residential-adult' } });
    expect((screen.getByTestId('hh-direct-bw-input') as HTMLInputElement).value).toBe('70.7');
    expect((screen.getByTestId('hh-direct-ir-sed-input') as HTMLInputElement).value).toBe('20');
    expect((screen.getByTestId('hh-direct-sa-input') as HTMLInputElement).value).toBe('17640');
    // The frame-default label now reflects the adult receptor.
    expect(screen.getByTestId('hh-direct-bw-frame-default-label')).toHaveTextContent(
      /Frame default 70\.7 kg/,
    );
    // Shared receptor-independent factors (EF/ED/AT/AF) are identical across scenarios -> unchanged.
    expect((screen.getByTestId('hh-direct-ef-input') as HTMLInputElement).value).toBe('364');
    expect((screen.getByTestId('hh-direct-af-input') as HTMLInputElement).value).toBe('0.01');
  });

  it('switching to Commercial/industrial worker reseeds BW/IR_sed/EF/ED/SA/AF to the worker values', () => {
    renderFcsap();
    const select = screen.getByTestId('hh-direct-receptor-scenario-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'commercial-industrial-worker' } });
    // BW and AT_cancer are shared with adult scenario (same approved records).
    expect((screen.getByTestId('hh-direct-bw-input') as HTMLInputElement).value).toBe('70.7');
    expect((screen.getByTestId('hh-direct-at-cancer-input') as HTMLInputElement).value).toBe('80');
    // Worker-specific receptor seeds from HC PQRA v4.0.
    expect((screen.getByTestId('hh-direct-ir-sed-input') as HTMLInputElement).value).toBe('100');
    expect((screen.getByTestId('hh-direct-ef-input') as HTMLInputElement).value).toBe('240');
    expect((screen.getByTestId('hh-direct-ed-input') as HTMLInputElement).value).toBe('35');
    expect((screen.getByTestId('hh-direct-sa-input') as HTMLInputElement).value).toBe('16640');
    expect((screen.getByTestId('hh-direct-af-input') as HTMLInputElement).value).toBe('0.1');
    // Frame-default label reflects the worker receptor for BW (which reuses the approved
    // adult 70.7 kg record; the worker-specific seeds carry their own ids).
    expect(screen.getByTestId('hh-direct-bw-frame-default-label')).toHaveTextContent(
      /Frame default 70\.7 kg/,
    );
  });

  it('preserves a user edit when switching scenarios (does not clobber an off-default value)', () => {
    renderFcsap();
    const bw = screen.getByTestId('hh-direct-bw-input') as HTMLInputElement;
    fireEvent.change(bw, { target: { value: '50' } });
    const select = screen.getByTestId('hh-direct-receptor-scenario-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'residential-adult' } });
    // BW was user-edited (off the toddler seed) -> the scenario switch must NOT overwrite it.
    expect(bw.value).toBe('50');
    // An untouched receptor-specific input (IR_sed) still reseeds to the adult value.
    expect((screen.getByTestId('hh-direct-ir-sed-input') as HTMLInputElement).value).toBe('20');
  });
});

describe('HHDirectContactCalculator recent Matrix Options additions', () => {
  it('organomercury entry: phenylmercuric_acetate is selectable and calculates without crashing', () => {
    render(
      <HHDirectContactCalculator
        substanceKey="phenylmercuric_acetate"
        jurisdiction="bc-protocol1-v5-dra"
      />
    );
    expect(screen.getByTestId('hh-direct-preliminary-standard')).toBeInTheDocument();
    const rfd = screen.getByTestId('hh-direct-rfd-input') as HTMLInputElement;
    expect(rfd.value).toBe('0.00008'); // Verifies the RfD resolves correctly
  });
});
