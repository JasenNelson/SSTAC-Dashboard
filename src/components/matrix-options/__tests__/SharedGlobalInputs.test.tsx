// Component tests for SharedGlobalInputs (PR-A2 commit 2).
// Plain ASCII only.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import SharedGlobalInputs, {
  DEFAULT_SUBSTANCE_KEY,
} from '../SharedGlobalInputs';
import { SUBSTANCE_LIBRARY } from '@/lib/matrix-options/substanceLibrary';
import {
  ALL_JURISDICTIONS,
  DEFAULT_JURISDICTION,
  JURISDICTION_OPTIONS,
  isJurisdiction,
} from '../guide/content/jurisdictions';

describe('SharedGlobalInputs (PR-A2 commit 2)', () => {
  it('renders both selects inside the shared-global-inputs section', () => {
    render(
      <SharedGlobalInputs
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={() => {}}
      />,
    );
    expect(screen.getByTestId('shared-global-inputs')).toBeInTheDocument();
    expect(screen.getByTestId('shared-substance-select')).toBeInTheDocument();
    expect(
      screen.getByTestId('shared-jurisdiction-select'),
    ).toBeInTheDocument();
  });

  it('populates the substance dropdown with every SUBSTANCE_LIBRARY entry', () => {
    render(
      <SharedGlobalInputs
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={() => {}}
      />,
    );
    const select = screen.getByTestId(
      'shared-substance-select',
    ) as HTMLSelectElement;
    expect(select.options).toHaveLength(SUBSTANCE_LIBRARY.length);
    // Spot-check: first option matches first library row.
    expect(select.options[0].value).toBe(SUBSTANCE_LIBRARY[0].key);
  });

  it('populates the jurisdiction dropdown with all 3 starter options', () => {
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
    // Plan v3 section 4.3: default jurisdiction = 'bc-csr'.
    expect(DEFAULT_JURISDICTION).toBe('bc-csr');
    expect(select.value).toBe('bc-csr');
  });

  it('emits onSubstanceKeyChange with the new key when the substance dropdown changes', () => {
    const onSubstanceKeyChange = vi.fn();
    render(
      <SharedGlobalInputs
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={onSubstanceKeyChange}
        onJurisdictionChange={() => {}}
      />,
    );
    const select = screen.getByTestId('shared-substance-select');
    // Pick a substance that is NOT the default (any other library row works).
    const otherKey =
      SUBSTANCE_LIBRARY.find((s) => s.key !== DEFAULT_SUBSTANCE_KEY)?.key ??
      SUBSTANCE_LIBRARY[0].key;
    fireEvent.change(select, { target: { value: otherKey } });
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
    fireEvent.change(select, { target: { value: 'federal-ccme' } });
    expect(onJurisdictionChange).toHaveBeenCalledWith('federal-ccme');
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
        jurisdiction="federal-ccme"
        onSubstanceKeyChange={() => {}}
        onJurisdictionChange={() => {}}
      />,
    );
    const desc = screen.getByTestId('shared-jurisdiction-description');
    const expected = JURISDICTION_OPTIONS.find(
      (j) => j.id === 'federal-ccme',
    )?.description;
    expect(desc.textContent).toBe(expected ?? '');
  });

  it('isJurisdiction rejects unknown strings and accepts the known set', () => {
    expect(isJurisdiction('bc-csr')).toBe(true);
    expect(isJurisdiction('federal-ccme')).toBe(true);
    expect(isJurisdiction('site-specific')).toBe(true);
    expect(isJurisdiction('made-up')).toBe(false);
    expect(isJurisdiction(null)).toBe(false);
    expect(isJurisdiction(undefined)).toBe(false);
    expect(isJurisdiction(42)).toBe(false);
  });

  // Cursor-agent review on Commit 2 (2026-05-19, P2): the change handlers
  // silently drop events whose target.value does not resolve to a valid
  // library entry / Jurisdiction. The dropdowns themselves source their
  // options from canonical arrays so this should never fire in normal UI
  // flow, but tests should prove the defensive guard works in case future
  // localStorage hydration or a schema migration ever injects an unknown.
  it('silently drops substance change events when the new key is unknown (defense-in-depth)', () => {
    const onSubstanceKeyChange = vi.fn();
    render(
      <SharedGlobalInputs
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction={DEFAULT_JURISDICTION}
        onSubstanceKeyChange={onSubstanceKeyChange}
        onJurisdictionChange={() => {}}
      />,
    );
    const select = screen.getByTestId('shared-substance-select');
    fireEvent.change(select, { target: { value: 'nonexistent_substance' } });
    expect(onSubstanceKeyChange).not.toHaveBeenCalled();
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
});
