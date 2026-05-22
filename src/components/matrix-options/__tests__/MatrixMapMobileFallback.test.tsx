// PR-MAP-17a tests: mobile fallback banner. Pure presentational
// snapshot of the spec-mandated banner copy from
// docs/design/matrix-map/PLAN_V3_4_2.md section 3.8.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatrixMapMobileFallback } from '../MatrixMapMobileFallback';

describe('MatrixMapMobileFallback', () => {
  it('renders the spec-mandated banner copy verbatim', () => {
    render(<MatrixMapMobileFallback />);
    expect(
      screen.getByText(/Use a desktop or tablet \(768px or wider\) for the full interactive map\./i),
    ).toBeInTheDocument();
  });

  it('renders the testid hook used by integration tests', () => {
    render(<MatrixMapMobileFallback />);
    expect(screen.getByTestId('matrix-map-mobile-fallback')).toBeInTheDocument();
  });

  it('renders the supporting context line about other tabs remaining usable', () => {
    render(<MatrixMapMobileFallback />);
    expect(
      screen.getByText(/other Matrix Options tabs/i),
    ).toBeInTheDocument();
  });
});
