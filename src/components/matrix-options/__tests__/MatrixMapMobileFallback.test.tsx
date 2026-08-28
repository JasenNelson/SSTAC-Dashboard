// PR-MAP-17a tests: mobile fallback banner. Pure presentational
// snapshot of the spec-mandated banner copy from
// docs/design/matrix-map/PLAN_V3_4_2.md section 3.8.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatrixMapMobileFallback } from '../MatrixMapMobileFallback';

describe('MatrixMapMobileFallback', () => {
  it('renders the current mobile limitation and supporting heading', () => {
    render(<MatrixMapMobileFallback />);
    expect(
      screen.getByRole('heading', { name: 'Interactive Map needs a wider viewport' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Use a desktop or tablet (768px or wider) for the full interactive map.'),
    ).toBeInTheDocument();
  });

  it('renders the testid hook used by integration tests', () => {
    render(<MatrixMapMobileFallback />);
    expect(screen.getByTestId('matrix-map-mobile-fallback')).toBeInTheDocument();
  });

  it('keeps the supporting copy synchronized with the current tab registry', () => {
    render(<MatrixMapMobileFallback />);
    expect(
      screen.getByText('All other Matrix Options tabs remain fully usable on this device.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Methodology by pathway/i)).not.toBeInTheDocument();
  });
});
