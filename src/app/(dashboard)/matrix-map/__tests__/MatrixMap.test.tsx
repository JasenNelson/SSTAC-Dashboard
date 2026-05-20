/**
 * Smoke tests for the Matrix Interactive Map client component (PR-MAP-2).
 *
 * Scope:
 *   - The component renders without crashing in jsdom (react-leaflet
 *     normally needs a real browser; we stub it).
 *   - The 4 base-layer radio inputs are present.
 *   - All 14 BC WMS overlay checkboxes are present (after the R-11
 *     Jermilova exclusion filter).
 *   - Clicking an overlay checkbox toggles its checked state.
 *   - Clicking a base-layer radio switches the active selection.
 *
 * react-leaflet and leaflet both touch `window` at module load and
 * expect a real DOM, so we mock them out. The mocks render simple
 * `<div>`s that mirror the props as data attributes -- enough for the
 * smoke assertions without booting Leaflet.
 *
 * Plain ASCII only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// NOTE: MatrixMap.tsx intentionally does NOT import leaflet's CSS;
// the CSS is loaded by MatrixMapLoader.tsx in production. That keeps
// the vitest transform free of Vite's PostCSS host (which can't load
// the project's .mjs PostCSS config), so no leaflet.css stub is needed
// in this spec.

// Stub react-leaflet. We never want a real Leaflet map booting in
// jsdom; the smoke test only cares about the surrounding chrome +
// state wiring.
vi.mock('react-leaflet', () => {
  // Only forward DOM-safe props (className, style, data-*) into the
  // stub divs so React doesn't warn about react-leaflet-specific
  // props like minZoom / scrollWheelZoom landing on real DOM nodes.
  const pickDomProps = (
    props: Record<string, unknown>,
  ): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (
        k === 'className' ||
        k === 'style' ||
        k === 'id' ||
        k === 'role' ||
        k.startsWith('data-') ||
        k.startsWith('aria-')
      ) {
        out[k] = v;
      }
    }
    return out;
  };
  return {
    MapContainer: ({
      children,
      ...rest
    }: {
      children?: React.ReactNode;
      [k: string]: unknown;
    }) =>
      React.createElement(
        'div',
        { 'data-stub': 'MapContainer', ...pickDomProps(rest) },
        children,
      ),
    TileLayer: (props: Record<string, unknown>) =>
      React.createElement('div', {
        'data-stub': 'TileLayer',
        'data-url': props.url as string,
      }),
    WMSTileLayer: (props: Record<string, unknown>) =>
      React.createElement('div', {
        'data-stub': 'WMSTileLayer',
        'data-layers': props.layers as string,
      }),
    ZoomControl: () =>
      React.createElement('div', { 'data-stub': 'ZoomControl' }),
  };
});

// Import AFTER the mocks so the component picks up the stubs.
import { MatrixMap, __TESTING__ } from '../MatrixMap';

describe('MatrixMap (PR-MAP-2 smoke)', () => {
  beforeEach(() => {
    // Defensive: reset DOM between tests is done by setup.ts cleanup.
  });

  it('renders without crashing', () => {
    render(<MatrixMap />);
    expect(screen.getByTestId('matrix-map-root')).toBeInTheDocument();
    expect(screen.getByTestId('matrix-map-container')).toBeInTheDocument();
  });

  it('renders 4 base-layer radio inputs', () => {
    render(<MatrixMap />);
    for (const key of __TESTING__.BASE_LAYER_ORDER) {
      const el = screen.getByTestId(`matrix-map-base-${key}`);
      expect(el).toBeInTheDocument();
      expect((el as HTMLInputElement).type).toBe('radio');
    }
    expect(__TESTING__.BASE_LAYER_ORDER).toHaveLength(4);
  });

  it('renders 14 BC WMS overlay checkboxes (R-11 Jermilova filter applied)', () => {
    render(<MatrixMap />);
    const keys = __TESTING__.OVERLAY_KEY_ORDER;
    expect(keys.length).toBe(14);
    // No Jermilova entries survive the R-11 guard.
    for (const k of keys) {
      expect(/jermilova/i.test(k)).toBe(false);
    }
    for (const key of keys) {
      const el = screen.getByTestId(`matrix-map-overlay-${key}`);
      expect(el).toBeInTheDocument();
      expect((el as HTMLInputElement).type).toBe('checkbox');
      // Default visibility = false for every overlay in v1.
      expect((el as HTMLInputElement).checked).toBe(false);
    }
  });

  it('toggles overlay visibility when its checkbox is clicked', () => {
    render(<MatrixMap />);
    const cb = screen.getByTestId(
      'matrix-map-overlay-csrSites',
    ) as HTMLInputElement;
    expect(cb.checked).toBe(false);
    fireEvent.click(cb);
    expect(cb.checked).toBe(true);
    fireEvent.click(cb);
    expect(cb.checked).toBe(false);
  });

  // Per codex PR-MAP-2 R1 P3-1: assert the checkbox toggle actually
  // mounts and unmounts a WMSTileLayer for csrSites with the expected
  // layers value (not just flips the checkbox-state UI).
  it('mounts and unmounts the csrSites WMSTileLayer when its checkbox toggles', () => {
    const expectedLayer = __TESTING__.OVERLAY_LAYERS.csrSites.layer;
    expect(expectedLayer).toBeTruthy();
    render(<MatrixMap />);
    const findCsrSitesWms = () =>
      document.querySelector(
        `[data-stub="WMSTileLayer"][data-layers="${expectedLayer}"]`,
      );
    // Initially csrSites overlay is hidden; no matching WMSTileLayer mount.
    expect(findCsrSitesWms()).toBeNull();
    const cb = screen.getByTestId(
      'matrix-map-overlay-csrSites',
    ) as HTMLInputElement;
    fireEvent.click(cb);
    expect(findCsrSitesWms()).not.toBeNull();
    fireEvent.click(cb);
    expect(findCsrSitesWms()).toBeNull();
  });

  it('switches the active base layer when a different radio is clicked', () => {
    render(<MatrixMap />);
    const streets = screen.getByTestId(
      'matrix-map-base-streets',
    ) as HTMLInputElement;
    const satellite = screen.getByTestId(
      'matrix-map-base-satellite',
    ) as HTMLInputElement;
    expect(streets.checked).toBe(true);
    expect(satellite.checked).toBe(false);
    fireEvent.click(satellite);
    expect(streets.checked).toBe(false);
    expect(satellite.checked).toBe(true);
  });

  it('collapses and expands the overlay panel via the toggle button', () => {
    render(<MatrixMap />);
    const toggle = screen.getByTestId('matrix-map-overlay-toggle');
    // List is visible by default.
    expect(
      document.getElementById('matrix-map-overlay-list'),
    ).not.toBeNull();
    fireEvent.click(toggle);
    expect(
      document.getElementById('matrix-map-overlay-list'),
    ).toBeNull();
    fireEvent.click(toggle);
    expect(
      document.getElementById('matrix-map-overlay-list'),
    ).not.toBeNull();
  });
});
