// Component tests for SharedGlobalInputs (PR-A2 commit 2).
// Plain ASCII only.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';

import SharedGlobalInputs, {
  DEFAULT_SUBSTANCE_KEY,
} from '../SharedGlobalInputs';
import {
  SUBSTANCE_LIBRARY,
  findSubstance,
} from '@/lib/matrix-options/substanceLibrary';
import {
  ALL_JURISDICTIONS,
  DEFAULT_JURISDICTION,
  JURISDICTION_OPTIONS,
  coerceJurisdiction,
  isJurisdiction,
} from '../guide/content/jurisdictions';

describe('SharedGlobalInputs (PR-A2 commit 2)', () => {
  it('renders the substance combobox + jurisdiction select inside the shared-global-inputs section', () => {
    render(
      <SharedGlobalInputs
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={() => {}}
      />,
    );
    expect(screen.getByTestId('shared-global-inputs')).toBeInTheDocument();
    // Substance selection is now a type-to-search combobox (item 1b) not a native select.
    expect(screen.getByTestId('substance-combobox-input')).toBeInTheDocument();
    expect(
      screen.getByTestId('shared-jurisdiction-select'),
    ).toBeInTheDocument();
  });

  it('offers every SUBSTANCE_LIBRARY entry in the combobox listbox when opened', () => {
    render(
      <SharedGlobalInputs
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={() => {}}
      />,
    );
    // Opening with an empty query lists all library rows (the combobox filters as you type).
    fireEvent.click(screen.getByTestId('substance-combobox-input'));
    // Scope to the combobox listbox so the jurisdiction native <select>'s
    // <option> elements (also role="option") are not counted.
    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(SUBSTANCE_LIBRARY.length);
    // Defense-in-depth: every offered option resolves to a real library row.
    expect(
      screen.getByTestId(`substance-option-${SUBSTANCE_LIBRARY[0].key}`),
    ).toBeInTheDocument();
  });

  it('populates the jurisdiction dropdown with all regulatory frame options', () => {
    render(
      <SharedGlobalInputs
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={() => {}}
      />,
    );
    const select = screen.getByTestId(
      'shared-jurisdiction-select',
    ) as HTMLSelectElement;
    expect(select.options).toHaveLength(ALL_JURISDICTIONS.length);
    expect(DEFAULT_JURISDICTION).toBe('bc-protocol1-v5-dra');
    expect(select.value).toBe('bc-protocol1-v5-dra');
  });

  it('emits onSubstanceKeyChange with the new key when a combobox option is chosen', () => {
    const onSubstanceKeyChange = vi.fn();
    render(
      <SharedGlobalInputs
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={onSubstanceKeyChange}
        onJurisdictionChange={() => {}}
      />,
    );
    // Pick a substance that is NOT the default (any other library row works).
    const otherKey =
      SUBSTANCE_LIBRARY.find((s) => s.key !== DEFAULT_SUBSTANCE_KEY)?.key ??
      SUBSTANCE_LIBRARY[0].key;
    // Open the combobox, then click the target option.
    fireEvent.click(screen.getByTestId('substance-combobox-input'));
    fireEvent.click(screen.getByTestId(`substance-option-${otherKey}`));
    expect(onSubstanceKeyChange).toHaveBeenCalledWith(otherKey);
  });

  it('emits onJurisdictionChange with the new id when the jurisdiction dropdown changes', () => {
    const onJurisdictionChange = vi.fn();
    render(
      <SharedGlobalInputs
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={onJurisdictionChange}
      />,
    );
    const select = screen.getByTestId('shared-jurisdiction-select');
    fireEvent.change(select, { target: { value: 'ccme-sediment-quality' } });
    expect(onJurisdictionChange).toHaveBeenCalledWith(
      'ccme-sediment-quality',
    );
  });

  it('renders the active substance description (class + log K_ow) below the dropdown', () => {
    render(
      <SharedGlobalInputs
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={() => {}}
      />,
    );
    const desc = screen.getByTestId('shared-substance-description');
    expect(desc.textContent).toMatch(/Class:/);
    expect(desc.textContent).toMatch(/log K_ow:/);
  });

  it('renders the active jurisdiction description below the dropdown', () => {
    render(
      <SharedGlobalInputs
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction="ccme-sediment-quality"
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={() => {}}
      />,
    );
    const desc = screen.getByTestId('shared-jurisdiction-description');
    const expected = JURISDICTION_OPTIONS.find(
      (j) => j.id === 'ccme-sediment-quality',
    )?.description;
    expect(desc.textContent).toBe(expected ?? '');
  });

  it('isJurisdiction rejects unknown and legacy strings and accepts the known set', () => {
    expect(isJurisdiction('bc-protocol1-v5-dra')).toBe(true);
    expect(isJurisdiction('ccme-sediment-quality')).toBe(true);
    expect(isJurisdiction('site-specific')).toBe(true);
    expect(isJurisdiction('bc-csr')).toBe(false);
    expect(isJurisdiction('federal-ccme')).toBe(false);
    expect(isJurisdiction('made-up')).toBe(false);
    expect(isJurisdiction(null)).toBe(false);
    expect(isJurisdiction(undefined)).toBe(false);
    expect(isJurisdiction(42)).toBe(false);
  });

  it('coerceJurisdiction maps legacy localStorage ids to frame ids', () => {
    expect(coerceJurisdiction('bc-csr')).toBe('bc-protocol1-v5-dra');
    expect(coerceJurisdiction('federal-ccme')).toBe('ccme-sediment-quality');
    expect(coerceJurisdiction('made-up')).toBeNull();
  });

  // Cursor-agent review on Commit 2 (2026-05-19, P2): the change handlers
  // silently drop events whose target.value does not resolve to a valid
  // library entry / Jurisdiction. The dropdowns themselves source their
  // options from canonical arrays so this should never fire in normal UI
  // flow, but tests should prove the defensive guard works in case future
  // localStorage hydration or a schema migration ever injects an unknown.
  it('substance combobox only offers real library keys (defense-in-depth; guard still wraps onChange)', () => {
    // The substance selector is now a combobox that surfaces ONLY canonical
    // SUBSTANCE_LIBRARY keys, so an unknown key cannot be chosen through the UI.
    // The handleSubstanceKeySelect wrapper still applies the findSubstance guard
    // (in case a future caller ever passes a bad key), but structurally every
    // rendered option resolves to a real row -- assert that invariant.
    render(
      <SharedGlobalInputs
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('substance-combobox-input'));
    const listbox = screen.getByRole('listbox');
    const optionKeys = within(listbox)
      .getAllByRole('option')
      .map((el) => el.getAttribute('data-testid')?.replace('substance-option-', ''));
    expect(optionKeys.length).toBeGreaterThan(0);
    for (const key of optionKeys) {
      expect(findSubstance(key as string)).toBeDefined();
    }
  });

  it('silently drops jurisdiction change events when the new id is unknown', () => {
    const onJurisdictionChange = vi.fn();
    render(
      <SharedGlobalInputs
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={onJurisdictionChange}
      />,
    );
    const select = screen.getByTestId('shared-jurisdiction-select');
    fireEvent.change(select, { target: { value: 'made-up-frame' } });
    expect(onJurisdictionChange).not.toHaveBeenCalled();
  });

  // Cursor-agent review on Commit 2: the substance description text is
  // derived from substanceKey via findSubstance() on each render. Prove the
  // description actually updates when the prop changes -- the current
  // tests only assert the initial render value.
  it('updates the substance description when substanceKey prop changes', () => {
    const { rerender } = render(
      <SharedGlobalInputs
        substanceKey="benzo_a_pyrene"
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={() => {}}
      />,
    );
    const initial = screen.getByTestId(
      'shared-substance-description',
    ).textContent;
    // organic-PAH class with logKow 6.13.
    expect(initial).toMatch(/organic-PAH/);
    expect(initial).toMatch(/6\.13/);

    rerender(
      <SharedGlobalInputs
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={() => {}}
      />,
    );
    const after = screen.getByTestId(
      'shared-substance-description',
    ).textContent;
    // organic-halogenated class with logKow 6.50.
    expect(after).toMatch(/organic-halogenated/);
    expect(after).toMatch(/6\.5/);
    expect(after).not.toBe(initial);
  });

  it('DEFAULT_SUBSTANCE_KEY resolves to a real library row with EqP-applicable fields', () => {
    // Mirrors the prior EcoDirectEqPCalculator default. Locks the contract
    // so a future library reordering does not silently break the lift.
    const found = SUBSTANCE_LIBRARY.find(
      (s) => s.key === DEFAULT_SUBSTANCE_KEY,
    );
    expect(found).toBeDefined();
    expect(found?.logKow).not.toBeNull();
    expect(found?.fcv_ug_per_L).not.toBeNull();
  });

  it('displays the cyanide guidance warning for cyanide-family keys', () => {
    const equivalentKeys = ['cyanide_free', 'hydrogen_cyanide_and_cyanide_salts'];
    const complexSaltKeys = ['copper_cyanide', 'silver_cyanide', 'potassium_silver_cyanide'];

    const { rerender } = render(
      <SharedGlobalInputs
        substanceKey={equivalentKeys[0]}
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={() => {}}
      />,
    );

    for (const key of equivalentKeys) {
      rerender(
        <SharedGlobalInputs
          substanceKey={key}
          jurisdiction={DEFAULT_JURISDICTION}
          onSubstanceKeyChange={() => {}}
          onJurisdictionChange={() => {}}
        />,
      );
      const warning = screen.getByTestId('cyanide-guidance-warning');
      expect(warning).toHaveTextContent(/Caution: These endpoints represent equivalent cyanide exposure/);
      expect(warning).toHaveAttribute('role', 'alert');
    }

    for (const key of complexSaltKeys) {
      rerender(
        <SharedGlobalInputs
          substanceKey={key}
          jurisdiction={DEFAULT_JURISDICTION}
          onSubstanceKeyChange={() => {}}
          onJurisdictionChange={() => {}}
        />,
      );
      const warning = screen.getByTestId('cyanide-guidance-warning');
      expect(warning).toHaveTextContent(/Complex Salt: Represents a metal-cyanide compound\/salt/);
      expect(warning).toHaveAttribute('role', 'alert');
    }
  });

  it('does not display the cyanide guidance warning for unrelated substances', () => {
    render(
      <SharedGlobalInputs
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={() => {}}
      />,
    );
    expect(screen.queryByTestId('cyanide-guidance-warning')).not.toBeInTheDocument();
  });
});

describe('SharedGlobalInputs cyanide non-mutation', () => {
  it('cyanide selectability/non-mutation: cyanide family keys are distinct and selectable', () => {
    const cyanideKeys = [
      { key: 'cyanide_free', expected: 'Cyanide, free' },
      { key: 'hydrogen_cyanide_and_cyanide_salts', expected: 'Hydrogen cyanide and cyanide salts' },
      { key: 'copper_cyanide', expected: 'Copper cyanide' },
      { key: 'silver_cyanide', expected: 'Silver cyanide' },
      { key: 'potassium_silver_cyanide', expected: 'Potassium silver cyanide' }
    ];

    const { rerender } = render(
      <SharedGlobalInputs
        substanceKey="cyanide_free"
        jurisdiction="bc-protocol1-v5-dra"
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={() => {}}
      />
    );

    cyanideKeys.forEach(({ key, expected }) => {
      rerender(
        <SharedGlobalInputs
          substanceKey={key}
          jurisdiction="bc-protocol1-v5-dra"
          onSubstanceKeyChange={() => {}}
          onJurisdictionChange={() => {}}
        />
      );
      const input = screen.getByTestId('substance-combobox-input') as HTMLInputElement;
      expect(input.value).toBe(expected);
    });
  });
});
