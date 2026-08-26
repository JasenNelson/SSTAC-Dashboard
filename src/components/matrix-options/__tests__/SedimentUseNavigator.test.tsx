import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SedimentUseNavigator from '../SedimentUseNavigator';

describe('SedimentUseNavigator', () => {
  const mockScenarios = [
    {
      scenarioId: 'recreational-fisher',
      scenarioLabel: 'Recreational fisher',
      isDefault: true,
    },
    {
      scenarioId: 'subsistence-fisher',
      scenarioLabel: 'Subsistence fisher',
      isDefault: false,
    },
    {
      scenarioId: 'acfn-community-specific',
      scenarioLabel: 'ACFN subsistence (Lower Athabasca)',
      isDefault: false,
    },
    {
      scenarioId: 'twn-toddler-subsistence',
      scenarioLabel: 'TWN toddler subsistence (Burrard Inlet)',
      isDefault: false,
    },
  ];

  function StatefulNavigator({
    initialScenarioId = 'recreational-fisher',
    scenarios = mockScenarios,
  }: {
    initialScenarioId?: string;
    scenarios?: typeof mockScenarios;
  }) {
    const [selected, setSelected] = React.useState<string | undefined>(
      initialScenarioId,
    );
    return (
      <SedimentUseNavigator
        selectedScenarioId={selected}
        selectableScenarios={scenarios}
        onSelectScenario={setSelected}
      />
    );
  }

  it('renders all four sediment-use categories with contract-bounded wording', () => {
    render(
      <SedimentUseNavigator
        selectedScenarioId="recreational-fisher"
        selectableScenarios={mockScenarios}
        onSelectScenario={vi.fn()}
      />,
    );

    expect(screen.getByTestId('sediment-use-navigator')).toBeInTheDocument();
    expect(screen.getByTestId('sediment-use-category-aw')).toBeInTheDocument();
    expect(screen.getByTestId('sediment-use-category-arth')).toBeInTheDocument();
    expect(screen.getByTestId('sediment-use-category-ca')).toBeInTheDocument();
    expect(screen.getByTestId('sediment-use-category-ia')).toBeInTheDocument();

    // Verify bounded wording
    expect(screen.getByTestId('sediment-use-navigator')).toHaveTextContent(
      /B\.C\. Sediment-Use Categories \(Phase 2\)/i,
    );
    expect(screen.getByTestId('sediment-use-navigator')).toHaveTextContent(
      /Values for AW, CA, and IA are proposed\/pending and do not change calculator inputs/i,
    );
  });

  it('renders AW, CA, and IA as proposed/pending non-actionable categories without inputs', () => {
    render(
      <SedimentUseNavigator
        selectedScenarioId="recreational-fisher"
        selectableScenarios={mockScenarios}
        onSelectScenario={vi.fn()}
      />,
    );

    expect(screen.getByTestId('sediment-use-pending-badge-aw')).toHaveTextContent(
      /Proposed \/ Pending/i,
    );
    expect(screen.getByTestId('sediment-use-pending-badge-ca')).toHaveTextContent(
      /Proposed \/ Pending/i,
    );
    expect(screen.getByTestId('sediment-use-pending-badge-ia')).toHaveTextContent(
      /Proposed \/ Pending/i,
    );

    const awCategory = screen.getByTestId('sediment-use-category-aw');
    expect(awCategory).toHaveTextContent(/Proposed\/pending: does not change calculator inputs/i);
    expect(awCategory.querySelectorAll('button')).toHaveLength(0);
    expect(awCategory.querySelectorAll('input')).toHaveLength(0);

    const caCategory = screen.getByTestId('sediment-use-category-ca');
    expect(caCategory).toHaveTextContent(/Proposed\/pending: does not change calculator inputs/i);
    expect(caCategory.querySelectorAll('button')).toHaveLength(0);
    expect(caCategory.querySelectorAll('input')).toHaveLength(0);

    const iaCategory = screen.getByTestId('sediment-use-category-ia');
    expect(iaCategory).toHaveTextContent(/Proposed\/pending: does not change calculator inputs/i);
    expect(iaCategory.querySelectorAll('button')).toHaveLength(0);
    expect(iaCategory.querySelectorAll('input')).toHaveLength(0);
  });

  it('renders AR/TH as an accessible radiogroup with at least 44px touch targets and programmatic selection', () => {
    const onSelect = vi.fn();
    render(
      <SedimentUseNavigator
        selectedScenarioId="recreational-fisher"
        selectableScenarios={mockScenarios}
        onSelectScenario={onSelect}
      />,
    );

    expect(screen.getByTestId('sediment-use-active-badge-arth')).toBeInTheDocument();

    const radiogroup = screen.getByRole('radiogroup', {
      name: /Aquatic Recreational \/ Traditional Harvest scenarios/i,
    });
    expect(radiogroup).toBeInTheDocument();

    const recRadio = screen.getByRole('radio', { name: /Recreational fisher/i });
    const subRadio = screen.getByRole('radio', { name: /Subsistence fisher/i });
    expect(recRadio).toBeInTheDocument();
    expect(subRadio).toBeInTheDocument();
    expect(recRadio).toHaveTextContent('Recreational fisher');
    expect(subRadio).toHaveTextContent('Subsistence fisher');

    const recBtn = screen.getByTestId('sediment-use-scenario-btn-recreational-fisher');
    const subBtn = screen.getByTestId('sediment-use-scenario-btn-subsistence-fisher');
    const acfnBtn = screen.getByTestId('sediment-use-scenario-btn-acfn-community-specific');
    const twnBtn = screen.getByTestId('sediment-use-scenario-btn-twn-toddler-subsistence');

    expect(recBtn).toHaveAttribute('role', 'radio');
    expect(recBtn).toHaveAttribute('aria-checked', 'true');
    expect(recBtn).toHaveAttribute('tabIndex', '0');
    expect(recBtn.className).toContain('min-h-[44px]');

    expect(subBtn).toHaveAttribute('role', 'radio');
    expect(subBtn).toHaveAttribute('aria-checked', 'false');
    expect(subBtn).toHaveAttribute('tabIndex', '-1');
    expect(subBtn.className).toContain('min-h-[44px]');

    expect(acfnBtn).toHaveAttribute('role', 'radio');
    expect(acfnBtn).toHaveAttribute('aria-checked', 'false');
    expect(acfnBtn).toHaveAttribute('tabIndex', '-1');
    expect(acfnBtn).toHaveTextContent(/Community-specific/i);

    expect(twnBtn).toHaveAttribute('role', 'radio');
    expect(twnBtn).toHaveAttribute('aria-checked', 'false');
    expect(twnBtn).toHaveAttribute('tabIndex', '-1');
    expect(twnBtn).toHaveTextContent(/Toddler receptor/i);

    fireEvent.click(subBtn);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('subsistence-fisher');
  });

  it('stateful harness proves ArrowRight, ArrowLeft, ArrowDown, ArrowUp, Home, End move focus and selection, update aria-checked, and leave exactly one tabIndex=0', () => {
    render(<StatefulNavigator initialScenarioId="recreational-fisher" />);

    const getButtons = () => {
      const rec = screen.getByTestId('sediment-use-scenario-btn-recreational-fisher');
      const sub = screen.getByTestId('sediment-use-scenario-btn-subsistence-fisher');
      const acfn = screen.getByTestId('sediment-use-scenario-btn-acfn-community-specific');
      const twn = screen.getByTestId('sediment-use-scenario-btn-twn-toddler-subsistence');
      const all = [rec, sub, acfn, twn];
      return { rec, sub, acfn, twn, all };
    };

    const assertOnlyOneTabIndexZero = (target: HTMLElement) => {
      const { all } = getButtons();
      const tabZeroCount = all.filter((b) => b.getAttribute('tabIndex') === '0').length;
      expect(tabZeroCount).toBe(1);
      expect(target).toHaveAttribute('tabIndex', '0');
      expect(target).toHaveAttribute('aria-checked', 'true');
    };

    // Initial state: rec selected
    const initial = getButtons();
    assertOnlyOneTabIndexZero(initial.rec);
    expect(initial.sub).toHaveAttribute('aria-checked', 'false');

    // 1. ArrowRight on rec -> moves to sub
    fireEvent.keyDown(initial.rec, { key: 'ArrowRight' });
    const afterArrowRight = getButtons();
    expect(document.activeElement).toBe(afterArrowRight.sub);
    assertOnlyOneTabIndexZero(afterArrowRight.sub);

    // 2. ArrowDown on sub -> moves to acfn
    fireEvent.keyDown(afterArrowRight.sub, { key: 'ArrowDown' });
    const afterArrowDown = getButtons();
    expect(document.activeElement).toBe(afterArrowDown.acfn);
    assertOnlyOneTabIndexZero(afterArrowDown.acfn);

    // 3. ArrowDown on acfn -> moves to twn
    fireEvent.keyDown(afterArrowDown.acfn, { key: 'ArrowDown' });
    const afterArrowDown2 = getButtons();
    expect(document.activeElement).toBe(afterArrowDown2.twn);
    assertOnlyOneTabIndexZero(afterArrowDown2.twn);

    // 4. ArrowUp on twn -> moves back to acfn
    fireEvent.keyDown(afterArrowDown2.twn, { key: 'ArrowUp' });
    const afterArrowUp = getButtons();
    expect(document.activeElement).toBe(afterArrowUp.acfn);
    assertOnlyOneTabIndexZero(afterArrowUp.acfn);

    // 5. ArrowLeft on acfn -> moves back to sub
    fireEvent.keyDown(afterArrowUp.acfn, { key: 'ArrowLeft' });
    const afterArrowLeft = getButtons();
    expect(document.activeElement).toBe(afterArrowLeft.sub);
    assertOnlyOneTabIndexZero(afterArrowLeft.sub);

    // 6. End on sub -> moves to last (twn)
    fireEvent.keyDown(afterArrowLeft.sub, { key: 'End' });
    const afterEnd = getButtons();
    expect(document.activeElement).toBe(afterEnd.twn);
    assertOnlyOneTabIndexZero(afterEnd.twn);

    // 7. Home on twn -> moves to first (rec)
    fireEvent.keyDown(afterEnd.twn, { key: 'Home' });
    const afterHome = getButtons();
    expect(document.activeElement).toBe(afterHome.rec);
    assertOnlyOneTabIndexZero(afterHome.rec);
  });

  it('surfaces the exact TWN ambient-WQO caveat phrase when twn-toddler-subsistence is selected', () => {
    const { rerender } = render(
      <SedimentUseNavigator
        selectedScenarioId="recreational-fisher"
        selectableScenarios={mockScenarios}
        onSelectScenario={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('sediment-use-twn-caveat')).toBeNull();

    rerender(
      <SedimentUseNavigator
        selectedScenarioId="twn-toddler-subsistence"
        selectableScenarios={mockScenarios}
        onSelectScenario={vi.fn()}
      />,
    );

    const caveat = screen.getByTestId('sediment-use-twn-caveat');
    expect(caveat).toBeInTheDocument();
    expect(caveat).toHaveTextContent(/CAVEAT/i);
    expect(caveat).toHaveTextContent(/ambient water quality objectives/i);
    expect(caveat).toHaveTextContent('must not be used to derive remediation or CSR guidelines');
    expect(caveat).toHaveTextContent(/0\.094 kg\/day/i);
  });

  it('renders empty fallback message when no scenarios are selectable in AR/TH', () => {
    render(
      <SedimentUseNavigator
        selectableScenarios={[]}
        onSelectScenario={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/No selectable scenarios available under current frame/i),
    ).toBeInTheDocument();
  });
});
