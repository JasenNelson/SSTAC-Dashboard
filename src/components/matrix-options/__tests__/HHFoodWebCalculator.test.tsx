import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/MathRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="math-renderer-mock">{content}</div>
  ),
}));

// Mock the scenario-aware active-default resolver so the calculator's frame-seeding is
// deterministic (and decoupled from the live catalog). Default: no active default
// (the calculator opens on the unsourced baseline), preserving the pre-C-BC tests.
// The C-BC block below overrides it with an active 0.111 (recreational) seed.
// Also mock getSelectableFrameScenarios so selector visibility is test-controlled.
// getReceptorScenarioFrame and getDefaultSelectableScenarioId use the real module.
vi.mock('@/lib/matrix-options/frameDefaults', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/matrix-options/frameDefaults')>();
  return {
    ...actual,
    getActiveScenarioFrameDefaults: vi.fn(() => []),
    getSelectableFrameScenarios: vi.fn(() => []),
  };
});

import HHFoodWebCalculator from '../HHFoodWebCalculator';
import {
  REGULATORY_FRAME_IDS,
  type RegulatoryFrameId,
} from '@/lib/matrix-options/regulatoryFrames';
import {
  getActiveScenarioFrameDefaults,
  getSelectableFrameScenarios,
} from '@/lib/matrix-options/frameDefaults';

const mockGetActiveScenarioFrameDefaults = vi.mocked(getActiveScenarioFrameDefaults);
const mockGetSelectableFrameScenarios = vi.mocked(getSelectableFrameScenarios);

// Build an active WLRS IR frame-default entry (what getActiveScenarioFrameDefaults returns
// under the recreational-fisher scenario once that record is promoted).
function activeWlrsIrRecreational() {
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

// Build an active WLRS IR frame-default for the subsistence-fisher scenario.
function activeWlrsIrSubsistence() {
  return [
    {
      inputKey: 'IR_food_kg_per_day',
      parameterValueId: 'pv-wlrs-2023-ir-food-subsistence-bc',
      candidateGroupId: 'human-health-food__generic__IR_food_kg_per_day__BC',
      label: 'BC WLRS 2023, subsistence',
      status: 'active' as const,
      value: 0.22,
      unit: 'kg/day',
      qaStatus: 'approved' as const,
      reason: 'ok',
    },
  ];
}

// Build an active ACFN community-specific IR frame-default (ACFN Lower Athabasca, 388 g/day).
function activeWlrsIrAcfn() {
  return [
    {
      inputKey: 'IR_food_kg_per_day',
      parameterValueId: 'pv-acfn-wqciu-2023-ir-food-community-specific',
      candidateGroupId: 'human-health-food__generic__IR_food_kg_per_day__general',
      label: 'ACFN WQCIU 2023, community-specific 388 g/day',
      status: 'active' as const,
      value: 0.388,
      unit: 'kg/day',
      qaStatus: 'approved' as const,
      reason: 'ok',
    },
  ];
}

// Build an active US EPA IR frame default (C-nonBC: us-epa-usace-sediment frame).
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
// (for the recreational scenario).
function activeWlrsIrAndBwRecreational() {
  return [
    ...activeWlrsIrRecreational(),
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

// Selectable-scenario options for the BC food-web frame (recreational + subsistence + ACFN).
function bcFoodWebScenarios() {
  return [
    { scenarioId: 'recreational-fisher', scenarioLabel: 'Recreational fisher', isDefault: true },
    { scenarioId: 'subsistence-fisher', scenarioLabel: 'Subsistence fisher', isDefault: false },
    { scenarioId: 'acfn-community-specific', scenarioLabel: 'ACFN subsistence (Lower Athabasca)', isDefault: false },
  ];
}

describe('HHFoodWebCalculator', () => {
  beforeEach(() => {
    mockGetActiveScenarioFrameDefaults.mockReturnValue([]);
    mockGetSelectableFrameScenarios.mockReturnValue([]);
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

  it('Ecosystem radiogroup responds to ArrowRight/ArrowLeft', () => {
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    const freshwaterBtn = screen.getByRole('radio', { name: 'Freshwater' });
    const estuarineBtn = screen.getByRole('radio', { name: 'Estuarine' });

    expect(freshwaterBtn).toHaveAttribute('aria-checked', 'true');
    expect(estuarineBtn).toHaveAttribute('aria-checked', 'false');
    
    // Press ArrowRight on the selected button
    fireEvent.keyDown(freshwaterBtn, { key: 'ArrowRight' });
    expect(freshwaterBtn).toHaveAttribute('aria-checked', 'false');
    expect(estuarineBtn).toHaveAttribute('aria-checked', 'true');

    // Press ArrowLeft
    fireEvent.keyDown(estuarineBtn, { key: 'ArrowLeft' });
    expect(freshwaterBtn).toHaveAttribute('aria-checked', 'true');
    expect(estuarineBtn).toHaveAttribute('aria-checked', 'false');
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

  it('suppresses the frame-variant fallback notice for the default baseline frame', () => {
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
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

  it('does not render the receptor-scenario selector when scenarios < 2', () => {
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect(screen.queryByTestId('hh-food-receptor-scenario-select')).toBeNull();
  });
});

describe('HHFoodWebCalculator C-BC frame default (IR seed)', () => {
  beforeEach(() => {
    mockGetActiveScenarioFrameDefaults.mockImplementation((frameId, _pathway, _scenarioId) =>
      frameId === 'bc-protocol1-v5-dra' ? activeWlrsIrRecreational() : [],
    );
    mockGetSelectableFrameScenarios.mockReturnValue([]);
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
    mockGetActiveScenarioFrameDefaults.mockImplementation((frameId, _pathway, _scenarioId) => {
      if (frameId === 'bc-protocol1-v5-dra') return activeWlrsIrRecreational();
      if (frameId === 'us-epa-usace-sediment') return activeEpaIr();
      return [];
    });
    mockGetSelectableFrameScenarios.mockReturnValue([]);
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
    mockGetActiveScenarioFrameDefaults.mockImplementation((frameId, _pathway, _scenarioId) =>
      frameId === 'bc-protocol1-v5-dra' ? activeWlrsIrAndBwRecreational() : [],
    );
    mockGetSelectableFrameScenarios.mockReturnValue([]);
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

// Phase D receptor-scenario selector (2026-06-13): the BC food-web frame now offers
// TWO selectable receptor scenarios -- recreational-fisher (default, 0.111 kg/day) and
// subsistence-fisher (0.22 kg/day) -- both with the shared adult BW 70.7 kg.
// The selector renders only when scenarios.length >= 2.
describe('HHFoodWebCalculator receptor-scenario selector (BC food-web frame)', () => {
  // The mock returns scenario-specific defaults: recreational gets 0.111, subsistence 0.22.
  // BW 70.7 is shared across both scenarios (same parameterValueId).
  beforeEach(() => {
    mockGetActiveScenarioFrameDefaults.mockImplementation(
      (frameId, _pathway, scenarioId) => {
        if (frameId !== 'bc-protocol1-v5-dra') return [];
        if (scenarioId === 'subsistence-fisher') {
          return [
            ...activeWlrsIrSubsistence(),
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
        if (scenarioId === 'acfn-community-specific') {
          return [
            ...activeWlrsIrAcfn(),
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
        // Default: recreational-fisher (also handles undefined)
        return activeWlrsIrAndBwRecreational();
      },
    );
    mockGetSelectableFrameScenarios.mockImplementation((frameId, _pathway) =>
      frameId === 'bc-protocol1-v5-dra' ? bcFoodWebScenarios() : [],
    );
  });

  function renderBc() {
    return render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
  }

  it('renders the selector with Recreational fisher and Subsistence fisher options', () => {
    renderBc();
    const select = screen.getByTestId(
      'hh-food-receptor-scenario-select',
    ) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toContain('Recreational fisher');
    expect(labels).toContain('Subsistence fisher');
  });

  it('defaults to recreational fisher and seeds IR 0.111', () => {
    renderBc();
    const select = screen.getByTestId(
      'hh-food-receptor-scenario-select',
    ) as HTMLSelectElement;
    expect(select.value).toBe('recreational-fisher');
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.111');
  });

  it('BW defaults to 70.7 under the recreational scenario', () => {
    renderBc();
    expect(
      (screen.getByTestId('hh-food-bw-input') as HTMLInputElement).value,
    ).toBe('70.7');
  });

  it('switching to subsistence-fisher reseeds IR to 0.22 and BW stays 70.7', () => {
    renderBc();
    const select = screen.getByTestId(
      'hh-food-receptor-scenario-select',
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'subsistence-fisher' } });
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.22');
    // BW is the same record under both scenarios (70.7 kg adult).
    expect(
      (screen.getByTestId('hh-food-bw-input') as HTMLInputElement).value,
    ).toBe('70.7');
  });

  it('switching back from subsistence to recreational reseeds IR to 0.111', () => {
    renderBc();
    const select = screen.getByTestId(
      'hh-food-receptor-scenario-select',
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'subsistence-fisher' } });
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.22');
    fireEvent.change(select, { target: { value: 'recreational-fisher' } });
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.111');
  });

  it('a user IR edit is preserved when switching scenarios (does not clobber an off-default value)', () => {
    renderBc();
    const irInput = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    // Edit off the recreational default.
    fireEvent.change(irInput, { target: { value: '0.3' } });
    expect(irInput.value).toBe('0.3');
    const select = screen.getByTestId(
      'hh-food-receptor-scenario-select',
    ) as HTMLSelectElement;
    // Switch to subsistence; the user-edited IR must NOT be overwritten.
    fireEvent.change(select, { target: { value: 'subsistence-fisher' } });
    expect(irInput.value).toBe('0.3');
  });

  it('renders the ACFN subsistence option labeled "ACFN subsistence (Lower Athabasca)"', () => {
    renderBc();
    const select = screen.getByTestId(
      'hh-food-receptor-scenario-select',
    ) as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toContain('ACFN subsistence (Lower Athabasca)');
  });

  it('switching to acfn-community-specific reseeds IR to 0.388 and BW stays 70.7', () => {
    renderBc();
    const select = screen.getByTestId(
      'hh-food-receptor-scenario-select',
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'acfn-community-specific' } });
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.388');
    // BW is the same shared adult record (70.7 kg) across all scenarios.
    expect(
      (screen.getByTestId('hh-food-bw-input') as HTMLInputElement).value,
    ).toBe('70.7');
  });
});
