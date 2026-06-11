import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/MathRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="math-renderer-mock">{content}</div>
  ),
}));

// Mock ONLY the active-default resolver so the calculator's frame-seeding is
// deterministic (and decoupled from the live catalog). Default: no active default
// (the calculator opens on the unsourced baseline), preserving the pre-C-BC tests.
// The C-BC block below overrides it with an active 0.111 seed.
vi.mock('@/lib/matrix-options/frameDefaults', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/matrix-options/frameDefaults')>();
  return { ...actual, getActiveFrameDefaults: vi.fn(() => []) };
});

import HHFoodWebCalculator from '../HHFoodWebCalculator';
import {
  REGULATORY_FRAME_IDS,
  type RegulatoryFrameId,
} from '@/lib/matrix-options/regulatoryFrames';
import { getActiveFrameDefaults } from '@/lib/matrix-options/frameDefaults';

const mockGetActiveFrameDefaults = vi.mocked(getActiveFrameDefaults);

// Build an active WLRS IR frame default (what getActiveFrameDefaults returns once
// the BC frame is selected and the WLRS recreational value is promoted).
function activeWlrsIr() {
  return [
    {
      inputKey: 'IR_food_kg_per_day',
      parameterValueId: 'pv-wlrs-2023-ir-food-recreational-bc',
      candidateGroupId: 'human-health-food__generic__IR_food_kg_per_day__BC',
      label: 'BC WLRS 2023, recreational',
      status: 'active' as const,
      value: 0.111,
      unit: 'kg/day',
      qaStatus: 'approved' as const,
      reason: 'ok',
    },
  ];
}

// Build an active US EPA IR frame default (C-nonBC: us-epa-usace-sediment frame, once the EPA
// general-population value is promoted). A DIFFERENT receptor + label than the BC frame.
function activeEpaIr() {
  return [
    {
      inputKey: 'IR_food_kg_per_day',
      parameterValueId: 'pv-epa-2000-ir-food-general-us',
      candidateGroupId: 'human-health-food__generic__IR_food_kg_per_day__US_federal',
      label: 'US EPA 2000 AWQC, general adult population',
      status: 'active' as const,
      value: 0.0175,
      unit: 'kg/day',
      qaStatus: 'approved' as const,
      reason: 'ok',
    },
  ];
}

// Build the C-3 BC frame defaults: the WLRS IR seed PLUS the adult body-weight seed
// (once promoted). The BW seed carries its OWN per-seed label (the general adult value,
// not the row's "recreational" descriptor).
function activeWlrsIrAndBw() {
  return [
    ...activeWlrsIr(),
    {
      inputKey: 'BW_kg',
      parameterValueId: 'pv-wlrs-2023-bw-adult-bc',
      candidateGroupId: 'human-health-food__generic__BW_kg__BC',
      label: 'BC WLRS 2023, adult 70.7 kg (Table 1)',
      status: 'active' as const,
      value: 70.7,
      unit: 'kg',
      qaStatus: 'approved' as const,
      reason: 'ok',
    },
  ];
}

describe('HHFoodWebCalculator', () => {
  beforeEach(() => {
    mockGetActiveFrameDefaults.mockReturnValue([]);
  });

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

describe('HHFoodWebCalculator C-BC frame default (IR seed)', () => {
  beforeEach(() => {
    mockGetActiveFrameDefaults.mockImplementation((frameId) =>
      frameId === 'bc-protocol1-v5-dra' ? activeWlrsIr() : [],
    );
  });

  function renderBc(
    jurisdiction: RegulatoryFrameId = 'bc-protocol1-v5-dra',
  ) {
    return render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction={jurisdiction}
      />,
    );
  }

  it('opens on the seeded 0.111 (lazy seed, no 0.142 flash) with the frame-default label', () => {
    renderBc();
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    expect(input.value).toBe('0.111');
    const label = screen.getByTestId('hh-food-ir-frame-default-label');
    expect(label).toHaveTextContent(/Frame default 0\.111 kg\/day/);
    // The per-frame source descriptor must render byte-identical to pre-PR2 (C-BC behavior).
    expect(label).toHaveTextContent('(BC WLRS 2023, recreational)');
  });

  it('attributes the seeded IR to the WLRS source in the provenance panel', () => {
    renderBc();
    const panel = screen.getByTestId('calculator-provenance-panel');
    // The IR value is now an approved source-backed default (not a scaffold):
    // at least one approved value appears once the WLRS IR is attributed.
    expect(panel).not.toHaveTextContent(/0 approved/);
  });

  it('a user edit drops the attribution and shows the reset button', () => {
    renderBc();
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    expect(screen.queryByTestId('hh-food-ir-reset-to-frame-default')).toBeNull();
    fireEvent.change(input, { target: { value: '0.2' } });
    expect(input.value).toBe('0.2');
    expect(
      screen.getByTestId('hh-food-ir-reset-to-frame-default'),
    ).toBeInTheDocument();
  });

  it('reset-to-frame-default restores 0.111 and hides the button', () => {
    renderBc();
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.388' } });
    fireEvent.click(screen.getByTestId('hh-food-ir-reset-to-frame-default'));
    expect(input.value).toBe('0.111');
    expect(screen.queryByTestId('hh-food-ir-reset-to-frame-default')).toBeNull();
  });

  it('hand-typing 0.111 attributes (value match) and shows no reset button', () => {
    renderBc();
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.2' } });
    expect(
      screen.getByTestId('hh-food-ir-reset-to-frame-default'),
    ).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '0.111' } });
    expect(screen.queryByTestId('hh-food-ir-reset-to-frame-default')).toBeNull();
  });

  it('a no-default frame seeds nothing (baseline 0.142, no label)', () => {
    // ccme-sediment-quality has no frame default (the mock returns [] for it). Note: this stand-in
    // changed from us-epa-usace-sediment, which now HAS a default (C-nonBC) and is covered below.
    renderBc('ccme-sediment-quality');
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    expect(input.value).toBe('0.142');
    expect(screen.queryByTestId('hh-food-ir-frame-default-label')).toBeNull();
  });

  it('switching BC -> a no-default frame resets the seed to 0.142', () => {
    const { rerender } = renderBc();
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.111');
    rerender(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="ccme-sediment-quality"
      />,
    );
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.142');
  });

  it('a deliberate off-default edit survives a frame switch (do not clobber)', () => {
    const { rerender } = renderBc();
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.25' } });
    rerender(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="ccme-sediment-quality"
      />,
    );
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.25');
  });
});

describe('HHFoodWebCalculator C-nonBC frame default (US EPA IR seed)', () => {
  beforeEach(() => {
    mockGetActiveFrameDefaults.mockImplementation((frameId) => {
      if (frameId === 'bc-protocol1-v5-dra') return activeWlrsIr();
      if (frameId === 'us-epa-usace-sediment') return activeEpaIr();
      return [];
    });
  });

  function renderFrame(jurisdiction: RegulatoryFrameId) {
    return render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction={jurisdiction}
      />,
    );
  }

  it('US EPA frame seeds 0.0175 and labels the EPA source (NOT BC WLRS)', () => {
    renderFrame('us-epa-usace-sediment');
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    expect(input.value).toBe('0.0175');
    const label = screen.getByTestId('hh-food-ir-frame-default-label');
    expect(label).toHaveTextContent(/Frame default 0\.0175 kg\/day/);
    expect(label).toHaveTextContent('(US EPA 2000 AWQC, general adult population)');
    expect(label).not.toHaveTextContent('BC WLRS');
  });

  it('switching US EPA -> BC reseeds 0.0175 -> 0.111 and swaps the label', () => {
    const { rerender } = renderFrame('us-epa-usace-sediment');
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.0175');
    rerender(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.111');
    expect(
      screen.getByTestId('hh-food-ir-frame-default-label'),
    ).toHaveTextContent('(BC WLRS 2023, recreational)');
  });

  it('switching BC -> US EPA reseeds 0.111 -> 0.0175', () => {
    const { rerender } = renderFrame('bc-protocol1-v5-dra');
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.111');
    rerender(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="us-epa-usace-sediment"
      />,
    );
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.0175');
  });

  it('a deliberate off-default edit survives the BC -> US EPA switch (do not clobber)', () => {
    const { rerender } = renderFrame('bc-protocol1-v5-dra');
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.3' } });
    rerender(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="us-epa-usace-sediment"
      />,
    );
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.3');
  });
});

describe('HHFoodWebCalculator C-3 frame default (BW seed)', () => {
  beforeEach(() => {
    mockGetActiveFrameDefaults.mockImplementation((frameId) =>
      frameId === 'bc-protocol1-v5-dra' ? activeWlrsIrAndBw() : [],
    );
  });

  function renderBc(
    jurisdiction: RegulatoryFrameId = 'bc-protocol1-v5-dra',
  ) {
    return render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction={jurisdiction}
      />,
    );
  }

  it('opens on the seeded 70.7 BW with the per-seed frame-default label', () => {
    renderBc();
    const input = screen.getByTestId('hh-food-bw-input') as HTMLInputElement;
    expect(input.value).toBe('70.7');
    const label = screen.getByTestId('hh-food-bw-frame-default-label');
    expect(label).toHaveTextContent(/Frame default 70\.7 kg/);
    // The BW seed renders its OWN label override, NOT the row "recreational" descriptor.
    expect(label).toHaveTextContent('(BC WLRS 2023, adult 70.7 kg (Table 1))');
  });

  it('a user edit shows the BW reset button; reset restores 70.7', () => {
    renderBc();
    const input = screen.getByTestId('hh-food-bw-input') as HTMLInputElement;
    expect(screen.queryByTestId('hh-food-bw-reset-to-frame-default')).toBeNull();
    fireEvent.change(input, { target: { value: '80' } });
    expect(input.value).toBe('80');
    expect(
      screen.getByTestId('hh-food-bw-reset-to-frame-default'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('hh-food-bw-reset-to-frame-default'));
    expect(input.value).toBe('70.7');
    expect(screen.queryByTestId('hh-food-bw-reset-to-frame-default')).toBeNull();
  });

  it('a no-default frame leaves BW at baseline 70 with no label', () => {
    renderBc('ccme-sediment-quality');
    const input = screen.getByTestId('hh-food-bw-input') as HTMLInputElement;
    expect(input.value).toBe('70');
    expect(screen.queryByTestId('hh-food-bw-frame-default-label')).toBeNull();
  });
});
