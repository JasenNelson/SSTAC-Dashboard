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
// (the calculator opens on the fail-closed empty baseline).
// The C-BC block below overrides it with active seeds.
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

// Build an active WLRS IR frame-default entry (recreational-fisher scenario).
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

// Build an active WLRS IR + BW frame-default for the subsistence-fisher scenario.
function activeWlrsIrAndBwSubsistence() {
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

// Build an active ACFN community-specific IR + BW frame-default (388 g/day, 70.7 kg).
function activeWlrsIrAndBwAcfn() {
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

// Build an active TWN toddler subsistence IR + BW frame-default (94 g/day, 16.5 kg).
function activeWlrsIrAndBwTwn() {
  return [
    {
      inputKey: 'IR_food_kg_per_day',
      parameterValueId: 'pv-twn-biwqo-2021-ir-food-toddler-bc',
      candidateGroupId: 'human-health-food__generic__IR_food_kg_per_day__BC',
      label: 'TWN BIWQO 2021, toddler subsistence',
      status: 'active' as const,
      value: 0.094,
      unit: 'kg/day',
      qaStatus: 'approved' as const,
      reason: 'ok',
    },
    {
      inputKey: 'BW_kg',
      parameterValueId: 'pv-hc-pqra-v4-2024-bw-toddler-food-bc',
      candidateGroupId: 'human-health-food__generic__BW_kg__BC',
      label: 'HC PQRA v4.0, toddler 16.5 kg (Appendix E)',
      status: 'active' as const,
      value: 16.5,
      unit: 'kg',
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

// Build the BC recreational frame defaults: IR seed 0.111 + adult body-weight seed 70.7.
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

// Selectable-scenario options for the BC food-web frame (recreational + subsistence + ACFN + TWN toddler).
function bcFoodWebScenarios() {
  return [
    { scenarioId: 'recreational-fisher', scenarioLabel: 'Recreational fisher', isDefault: true },
    { scenarioId: 'subsistence-fisher', scenarioLabel: 'Subsistence fisher', isDefault: false },
    { scenarioId: 'acfn-community-specific', scenarioLabel: 'ACFN subsistence (Lower Athabasca)', isDefault: false },
    { scenarioId: 'twn-toddler-subsistence', scenarioLabel: 'TWN toddler subsistence (Burrard Inlet)', isDefault: false },
  ];
}

describe('HHFoodWebCalculator core and fail-closed behaviors', () => {
  beforeEach(() => {
    mockGetActiveScenarioFrameDefaults.mockReturnValue([]);
    mockGetSelectableFrameScenarios.mockReturnValue([]);
  });

  it('renders a functioning Human Health food-web calculator', () => {
    mockGetActiveScenarioFrameDefaults.mockReturnValue(activeWlrsIrRecreational());
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

  it('fails closed when no active default exists and input is empty', () => {
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    expect(input.value).toBe('');
    const standard = screen.getByTestId('hh-food-preliminary-standard');
    expect(standard).toHaveTextContent(/--\s*mg\/kg/);
  });

  it('proves complete absence of 32, 142, and 388 quick-set buttons', () => {
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect(screen.queryByRole('button', { name: /32 g\/day/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /142 g\/day/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /388 g\/day/i })).toBeNull();
  });

  it('allows manual screening assumption entry with appropriate provenance role scoped to table row', () => {
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    const irInput = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    fireEvent.change(irInput, { target: { value: '0.150' } });
    expect(irInput.value).toBe('0.150');

    // Standard computes
    const standard = screen.getByTestId('hh-food-preliminary-standard');
    expect(standard).not.toHaveTextContent(/--\s*mg\/kg/);

    // Provenance panel marks Food ingestion row itself as screening assumption
    const panel = screen.getByTestId('calculator-provenance-panel');
    const rows = Array.from(panel.querySelectorAll('tbody tr'));
    const foodIrRow = rows.find((r) => r.textContent?.includes('Food ingestion'));
    expect(foodIrRow).toBeDefined();
    expect(foodIrRow).toHaveTextContent(/screening assumption/i);
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

    // Press ArrowRight
    fireEvent.keyDown(freshwaterBtn, { key: 'ArrowRight' });
    expect(freshwaterBtn).toHaveAttribute('aria-checked', 'false');
    expect(estuarineBtn).toHaveAttribute('aria-checked', 'true');

    // Press ArrowLeft
    fireEvent.keyDown(estuarineBtn, { key: 'ArrowLeft' });
    expect(freshwaterBtn).toHaveAttribute('aria-checked', 'true');
    expect(estuarineBtn).toHaveAttribute('aria-checked', 'false');
  });

  it('allows site-specific BSAF entry when the selected substance lacks a default BSAF', () => {
    mockGetActiveScenarioFrameDefaults.mockReturnValue(activeWlrsIrRecreational());
    render(
      <HHFoodWebCalculator
        substanceKey="lead"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect(screen.getByTestId('hh-food-error')).toHaveTextContent(
      /BSAF_loc must be a positive/i,
    );
    const standard = screen.getByTestId('hh-food-preliminary-standard');
    expect(standard).toHaveTextContent(/--\s*mg\/kg/);
    fireEvent.change(screen.getByTestId('hh-food-bsaf-input'), {
      target: { value: '0.25' },
    });
    expect(screen.queryByTestId('hh-food-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('hh-food-preliminary-standard')).not.toHaveTextContent(
      /--\s*mg\/kg/,
    );
  });

  it('BLOCKS the standard (fail-closed render) when foc is outside the EqP validity window', () => {
    mockGetActiveScenarioFrameDefaults.mockReturnValue(activeWlrsIrRecreational());
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    const focSlider = screen.getByLabelText(/Sediment f_oc/i) as HTMLInputElement;
    fireEvent.change(focSlider, { target: { value: '0.1' } }); // 0.1% < FOC_MIN (0.2%)
    expect(screen.getByTestId('hh-food-blocked-notice')).toBeInTheDocument();
    const standard = screen.getByTestId('hh-food-preliminary-standard');
    expect(standard).toHaveTextContent(/--\s*mg\/kg/);
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
    expect(panel).toHaveTextContent(/1 approved/);
    expect(panel).toHaveTextContent(/current calculator scaffold only/i);
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
      const text = notice.textContent ?? '';
      expect(text).toMatch(/No specialized equation is defined for frame/);
      unmount();
    }
  });

  it('does not render the non-BC receptor-scenario select when scenarios < 2', () => {
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="canada-fcsap-aquatic"
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

  function renderBc(jurisdiction: RegulatoryFrameId = 'bc-protocol1-v5-dra') {
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
    expect(label).toHaveTextContent('(BC WLRS 2023, recreational)');
  });

  it('attributes the seeded IR to the WLRS source in the provenance panel', () => {
    renderBc();
    const panel = screen.getByTestId('calculator-provenance-panel');
    expect(panel).not.toHaveTextContent(/0 approved/);
    const rows = Array.from(panel.querySelectorAll('tbody tr'));
    const foodIrRow = rows.find((r) => r.textContent?.includes('Food ingestion'));
    expect(foodIrRow).toBeDefined();
    expect(foodIrRow).toHaveTextContent(/source-backed default/i);
    expect(foodIrRow).toHaveTextContent(/BC WLRS/i);
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

  it('a no-default frame seeds nothing (fail-closed empty input, no label)', () => {
    renderBc('ccme-sediment-quality');
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.queryByTestId('hh-food-ir-frame-default-label')).toBeNull();
  });

  it('switching BC -> a no-default frame resets unedited seed to empty string', () => {
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
    ).toBe('');
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

  function renderBc(jurisdiction: RegulatoryFrameId = 'bc-protocol1-v5-dra') {
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

  it('switching BC -> a no-default frame resets unedited seeds (IR 0.111 -> empty, BW 70.7 -> 70)', () => {
    const { rerender } = renderBc();
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.111');
    expect(
      (screen.getByTestId('hh-food-bw-input') as HTMLInputElement).value,
    ).toBe('70.7');

    rerender(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="ccme-sediment-quality"
      />,
    );
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('');
    expect(screen.queryByTestId('hh-food-ir-frame-default-label')).toBeNull();

    expect(
      (screen.getByTestId('hh-food-bw-input') as HTMLInputElement).value,
    ).toBe('70');
    expect(screen.queryByTestId('hh-food-bw-frame-default-label')).toBeNull();
  });
});

describe('HHFoodWebCalculator B.C. Sediment Use Navigator & Scenarios', () => {
  beforeEach(() => {
    mockGetActiveScenarioFrameDefaults.mockImplementation(
      (frameId, _pathway, scenarioId) => {
        if (frameId !== 'bc-protocol1-v5-dra') return [];
        if (scenarioId === 'subsistence-fisher') return activeWlrsIrAndBwSubsistence();
        if (scenarioId === 'acfn-community-specific') return activeWlrsIrAndBwAcfn();
        if (scenarioId === 'twn-toddler-subsistence') return activeWlrsIrAndBwTwn();
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

  it('renders SedimentUseNavigator under bc-protocol1-v5-dra with all 4 categories', () => {
    renderBc();
    expect(screen.getByTestId('sediment-use-navigator')).toBeInTheDocument();
    expect(screen.getByTestId('sediment-use-category-aw')).toBeInTheDocument();
    expect(screen.getByTestId('sediment-use-category-arth')).toBeInTheDocument();
    expect(screen.getByTestId('sediment-use-category-ca')).toBeInTheDocument();
    expect(screen.getByTestId('sediment-use-category-ia')).toBeInTheDocument();
  });

  it('defaults to recreational fisher and seeds IR 0.111 and BW 70.7', () => {
    renderBc();
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.111');
    expect(
      (screen.getByTestId('hh-food-bw-input') as HTMLInputElement).value,
    ).toBe('70.7');
  });

  it('switching to subsistence-fisher reseeds IR to 0.22 and BW stays 70.7', () => {
    renderBc();
    const subBtn = screen.getByTestId('sediment-use-scenario-btn-subsistence-fisher');
    fireEvent.click(subBtn);
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.22');
    expect(
      (screen.getByTestId('hh-food-bw-input') as HTMLInputElement).value,
    ).toBe('70.7');
  });

  it('switching back from subsistence to recreational reseeds IR 0.22 -> 0.111 and BW remains 70.7', () => {
    renderBc();
    const subBtn = screen.getByTestId('sediment-use-scenario-btn-subsistence-fisher');
    fireEvent.click(subBtn);
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.22');
    expect(
      (screen.getByTestId('hh-food-bw-input') as HTMLInputElement).value,
    ).toBe('70.7');

    const recBtn = screen.getByTestId('sediment-use-scenario-btn-recreational-fisher');
    fireEvent.click(recBtn);
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.111');
    expect(
      (screen.getByTestId('hh-food-bw-input') as HTMLInputElement).value,
    ).toBe('70.7');
  });

  it('switching to ACFN community-specific reseeds IR to 0.388 and BW stays 70.7', () => {
    renderBc();
    const acfnBtn = screen.getByTestId('sediment-use-scenario-btn-acfn-community-specific');
    expect(acfnBtn).toHaveTextContent('ACFN subsistence (Lower Athabasca)');
    expect(acfnBtn).toHaveTextContent(/Community-specific/i);
    fireEvent.click(acfnBtn);
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.388');
    expect(
      (screen.getByTestId('hh-food-bw-input') as HTMLInputElement).value,
    ).toBe('70.7');
  });

  it('switching to TWN toddler subsistence reseeds IR to 0.094, BW to 16.5, and surfaces caveat with exact phrase', () => {
    renderBc();
    const twnBtn = screen.getByTestId('sediment-use-scenario-btn-twn-toddler-subsistence');
    expect(twnBtn).toHaveTextContent('TWN toddler subsistence (Burrard Inlet)');
    expect(twnBtn).toHaveTextContent(/Toddler receptor/i);

    fireEvent.click(twnBtn);
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.094');
    expect(
      (screen.getByTestId('hh-food-bw-input') as HTMLInputElement).value,
    ).toBe('16.5');

    // Caveat is visible with exact authoritative phrase
    const caveat = screen.getByTestId('sediment-use-twn-caveat');
    expect(caveat).toBeInTheDocument();
    expect(caveat).toHaveTextContent(/ambient water quality objectives/i);
    expect(caveat).toHaveTextContent('must not be used to derive remediation or CSR guidelines');
    expect(caveat).toHaveTextContent(/0\.094 kg\/day/i);
  });

  it('switching back from TWN toddler to recreational reseeds IR 0.111, BW 70.7, and hides caveat', () => {
    renderBc();
    const twnBtn = screen.getByTestId('sediment-use-scenario-btn-twn-toddler-subsistence');
    fireEvent.click(twnBtn);
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.094');
    expect(screen.getByTestId('sediment-use-twn-caveat')).toBeInTheDocument();

    const recBtn = screen.getByTestId('sediment-use-scenario-btn-recreational-fisher');
    fireEvent.click(recBtn);
    expect(
      (screen.getByTestId('hh-food-ir-input') as HTMLInputElement).value,
    ).toBe('0.111');
    expect(
      (screen.getByTestId('hh-food-bw-input') as HTMLInputElement).value,
    ).toBe('70.7');
    expect(screen.queryByTestId('sediment-use-twn-caveat')).toBeNull();
  });

  it('a user IR edit is preserved when switching scenarios (does not clobber an off-default value)', () => {
    renderBc();
    const irInput = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    fireEvent.change(irInput, { target: { value: '0.3' } });
    expect(irInput.value).toBe('0.3');
    const subBtn = screen.getByTestId('sediment-use-scenario-btn-subsistence-fisher');
    fireEvent.click(subBtn);
    expect(irInput.value).toBe('0.3');
  });

  it('does NOT render SedimentUseNavigator for non-BC frames', () => {
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="us-epa-usace-sediment"
      />,
    );
    expect(screen.queryByTestId('sediment-use-navigator')).toBeNull();
  });
});
