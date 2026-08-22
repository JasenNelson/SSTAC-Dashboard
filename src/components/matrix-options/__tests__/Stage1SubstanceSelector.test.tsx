// Component tests for Stage1SubstanceSelector.
// Plain ASCII only.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';

import { Stage1SubstanceSelector } from '../Stage1SubstanceSelector';
import {
  SUBSTANCE_LIBRARY,
} from '@/lib/matrix-options/substanceLibrary';
import { DEFAULT_SUBSTANCE_KEY } from '../SharedGlobalInputs';

describe('Stage1SubstanceSelector', () => {
  it('renders the substance combobox and details', () => {
    render(
      <Stage1SubstanceSelector
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction="bc-protocol1-v5-dra"
        pathwayId="eco-direct-eqp"
        onSubstanceKeyChange={() => {}}
      />,
    );
    expect(screen.getByTestId('substance-combobox-input')).toBeInTheDocument();
    expect(screen.getByTestId('stage1-substance-description')).toBeInTheDocument();
  });

  it('offers every SUBSTANCE_LIBRARY entry in the combobox listbox when opened', () => {
    render(
      <Stage1SubstanceSelector
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction="bc-protocol1-v5-dra"
        pathwayId="eco-direct-eqp"
        onSubstanceKeyChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('substance-combobox-input'));
    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(SUBSTANCE_LIBRARY.length);
  });

  it('emits onSubstanceKeyChange with the new key when a combobox option is chosen', () => {
    const onSubstanceKeyChange = vi.fn();
    render(
      <Stage1SubstanceSelector
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction="bc-protocol1-v5-dra"
        pathwayId="eco-direct-eqp"
        onSubstanceKeyChange={onSubstanceKeyChange}
      />,
    );
    const otherKey =
      SUBSTANCE_LIBRARY.find((s) => s.key !== DEFAULT_SUBSTANCE_KEY)?.key ??
      SUBSTANCE_LIBRARY[0].key;
    fireEvent.click(screen.getByTestId('substance-combobox-input'));
    fireEvent.click(screen.getByTestId(`substance-option-${otherKey}`));
    expect(onSubstanceKeyChange).toHaveBeenCalledWith(otherKey);
  });

  it('displays the cyanide guidance warning for cyanide-family keys', () => {
    const equivalentKeys = ['cyanide_free', 'hydrogen_cyanide_and_cyanide_salts'];
    const complexSaltKeys = ['copper_cyanide', 'silver_cyanide', 'potassium_silver_cyanide'];

    const { rerender } = render(
      <Stage1SubstanceSelector
        substanceKey={equivalentKeys[0]}
        jurisdiction="bc-protocol1-v5-dra"
        pathwayId="human-health-direct"
        onSubstanceKeyChange={() => {}}
      />,
    );

    for (const key of equivalentKeys) {
      rerender(
        <Stage1SubstanceSelector
          substanceKey={key}
          jurisdiction="bc-protocol1-v5-dra"
          pathwayId="human-health-direct"
          onSubstanceKeyChange={() => {}}
        />,
      );
      const warning = screen.getByTestId('cyanide-guidance-warning');
      expect(warning).toHaveTextContent(/Caution: These endpoints represent equivalent cyanide exposure/);
      expect(warning).toHaveAttribute('role', 'alert');
    }

    for (const key of complexSaltKeys) {
      rerender(
        <Stage1SubstanceSelector
          substanceKey={key}
          jurisdiction="bc-protocol1-v5-dra"
          pathwayId="human-health-direct"
          onSubstanceKeyChange={() => {}}
        />,
      );
      const warning = screen.getByTestId('cyanide-guidance-warning');
      expect(warning).toHaveTextContent(/Complex Salt: Represents a metal-cyanide compound\/salt/);
      expect(warning).toHaveAttribute('role', 'alert');
    }
  });

  it('does not display the cyanide guidance warning for unrelated substances', () => {
    render(
      <Stage1SubstanceSelector
        substanceKey={DEFAULT_SUBSTANCE_KEY}
        jurisdiction="bc-protocol1-v5-dra"
        pathwayId="eco-direct-eqp"
        onSubstanceKeyChange={() => {}}
      />,
    );
    expect(screen.queryByTestId('cyanide-guidance-warning')).not.toBeInTheDocument();
  });
});
