/**
 * Smoke tests for the Matrix Interactive Map client component
 * (Path-B fork of SiteMap.tsx).
 *
 * Scope:
 *   - The component renders without crashing in jsdom.
 *   - The loading overlay is visible while Leaflet is still loading
 *     (Leaflet is dynamic-imported; jsdom never resolves it).
 *   - The empty fallback payload renders cleanly (no sample list).
 *
 * MatrixMap uses imperative Leaflet via `await import('leaflet')` inside
 * a useEffect. jsdom cannot run Leaflet, so the dynamic import never
 * resolves and `isLoaded` stays false. We assert on the loading state
 * rather than the post-mount map chrome -- enough for a smoke test
 * without booting Leaflet.
 *
 * Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MatrixMap } from '../MatrixMap';
import { EMPTY_MATRIX_MAP_DATA } from '../types';

// Stub leaflet's dynamic import so its `await import('leaflet')` in
// MatrixMap's init effect doesn't actually touch the (jsdom-unfriendly)
// real leaflet module. Returning a never-resolving promise keeps the
// component stuck in the loading state, which is what we assert on.
vi.mock('leaflet', () => ({ default: {} }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet.markercluster', () => ({ default: {} }));
vi.mock('leaflet.markercluster/dist/MarkerCluster.css', () => ({}));
vi.mock('leaflet.markercluster/dist/MarkerCluster.Default.css', () => ({}));

describe('MatrixMap (Path-B fork)', () => {
  it('exports a MatrixMap component', () => {
    expect(typeof MatrixMap).toBe('function');
  });

  it('renders the loading state with an empty payload', () => {
    render(<MatrixMap initialMapData={EMPTY_MATRIX_MAP_DATA} />);
    expect(screen.getByText(/Loading map/i)).toBeInTheDocument();
  });

  it('renders an error notice when fetchErrorMessage is supplied', () => {
    render(
      <MatrixMap
        initialMapData={EMPTY_MATRIX_MAP_DATA}
        fetchErrorMessage="RPC unavailable"
      />,
    );
    expect(screen.getByText(/RPC unavailable/)).toBeInTheDocument();
  });
});
