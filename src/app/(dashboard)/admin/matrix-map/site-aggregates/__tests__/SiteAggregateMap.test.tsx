import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SiteAggregateMap } from '../SiteAggregateMap';
import type { AggregateMarker } from '@/lib/matrix-map/siteAggregateMarkers';

// jsdom cannot run real Leaflet, so mock it to an empty module. The component then stays in its
// loading state -- the same convention used by MatrixMap.test.tsx. What is assertable here is the
// pre-Leaflet chrome (loading fallback, legend, static text), not marker/tile behaviour.
vi.mock('leaflet', () => ({ default: {} }));

function marker(over: Partial<AggregateMarker> = {}): AggregateMarker {
  return {
    key: 'dra-1:49.28270,-123.12070',
    source_dra_id: 'dra-1',
    position: [49.2827, -123.1207],
    label: 'Site One',
    coordinate_quality_tier: 'medium',
    sample_count_total: 5,
    sample_count_high: 0,
    sample_count_medium: 5,
    radius: 5,
    ...over,
  };
}

describe('SiteAggregateMap (jsdom, Leaflet mocked)', () => {
  it('renders the loading fallback until Leaflet resolves', () => {
    render(<SiteAggregateMap markers={[marker()]} />);
    expect(screen.getByText(/Loading map/i)).toBeInTheDocument();
  });

  it('always renders the legend, even before the map loads', () => {
    render(<SiteAggregateMap markers={[marker()]} />);
    expect(screen.getByText(/Site aggregates/i)).toBeInTheDocument();
    // The legend must state that a marker is a site location, not a sample position.
    expect(screen.getByText(/one marker per site/i)).toBeInTheDocument();
    expect(screen.getByText(/not a sample position/i)).toBeInTheDocument();
  });

  it('provides the map container element', () => {
    render(<SiteAggregateMap markers={[marker({}), marker({ key: 'b', source_dra_id: 'dra-2' })]} />);
    expect(screen.getByTestId('site-aggregate-map-container')).toBeInTheDocument();
  });

  it('renders without throwing for an empty marker set', () => {
    render(<SiteAggregateMap markers={[]} />);
    expect(screen.getByText(/Loading map/i)).toBeInTheDocument();
  });
});
