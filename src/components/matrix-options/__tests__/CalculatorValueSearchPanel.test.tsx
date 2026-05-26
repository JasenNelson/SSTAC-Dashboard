import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import CalculatorValueSearchPanel from '../CalculatorValueSearchPanel';

describe('CalculatorValueSearchPanel default policy projection', () => {
  it('shows read-only default-selection policy decisions without promoting candidates', () => {
    const onOpenEvidenceLibrary = vi.fn();

    render(
      <CalculatorValueSearchPanel
        pathway="human-health-food"
        pathwayLabel="Human Health: Food Web"
        substanceKey="benzo_a_pyrene"
        substanceLabel="Benzo[a]pyrene"
        jurisdictionLabel="BC Protocol 1 v5 DRA"
        regulatoryFrameId="bc-protocol1-v5-dra"
        onOpenEvidenceLibrary={onOpenEvidenceLibrary}
      />,
    );

    expect(screen.getByTestId('calculator-default-policy-audit')).toHaveTextContent(
      /Default policy/,
    );
    expect(screen.getByTestId('calculator-default-policy-audit')).toHaveTextContent(
      /pending approval/,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Review candidate defaults/i }),
    );
    expect(onOpenEvidenceLibrary).toHaveBeenCalledWith(
      expect.objectContaining({
        pathways: ['human-health-food'],
        substanceKeys: ['benzo_a_pyrene'],
        inputKeys: expect.arrayContaining([
          'sf_oral_per_mg_per_kg_bw_per_day',
        ]),
      }),
    );

    fireEvent.change(screen.getByPlaceholderText(/Search parameter or source/i), {
      target: { value: 'Health Canada' },
    });

    const healthCanadaPolicy = screen.getByTestId(
      'default-policy-pv-hc-bap-hh-food-sf',
    );
    expect(healthCanadaPolicy).toHaveTextContent(
      /Recommended candidate: approval required/,
    );
    expect(healthCanadaPolicy).toHaveTextContent(
      /Read-only recommendation only/,
    );
    expect(healthCanadaPolicy).toHaveTextContent(
      /no default or QA status changes are made/,
    );

    fireEvent.change(screen.getByPlaceholderText(/Search parameter or source/i), {
      target: { value: 'Protocol 28' },
    });

    const protocol28Policy = screen.getByTestId(
      'default-policy-pv-p28-bap-hh-food-slope',
    );
    expect(protocol28Policy).toHaveTextContent(/Blocked: policy compilation/);
    expect(protocol28Policy).toHaveTextContent(
      /source-mining aids, not calculation-driving sources/,
    );
    expect(screen.getByTestId('calculator-value-search-panel')).not.toHaveTextContent(
      /promoted/i,
    );

    expect(
      screen.getByRole('button', { name: /Re-review candidate defaults/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('calculator-candidate-review-receipt'),
    ).toHaveTextContent(/opened for review/);
    expect(
      screen.getByTestId('calculator-candidate-review-receipt'),
    ).toHaveTextContent(/No defaults changed/);
  });
});
