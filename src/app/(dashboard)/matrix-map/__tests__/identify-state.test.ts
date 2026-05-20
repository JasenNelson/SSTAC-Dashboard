/**
 * Unit tests for the PR-MAP-3b identify-state pure helpers.
 *
 * Scope:
 *   - findSampleNearLatLng -- container-pixel proximity hit-test (Q-7).
 *
 * The mock map projects lat/lng -> pixels at a deterministic 100x
 * scale (lat-deg * 100 = y, lng-deg * 100 = x). This makes the test
 * assertions about "within 10 pixels" trivial to verify by hand.
 *
 * Plain ASCII only.
 */

import { describe, expect, it } from 'vitest';

import { findSampleNearLatLng } from '../identify-state';
import type { MatrixSample } from '../types';

const makeSample = (
  id: string,
  lat: number,
  lng: number,
  overrides?: Partial<MatrixSample>,
): MatrixSample => ({
  id,
  bnrrm_station_id: parseInt(id.replace(/[^0-9]/g, ''), 10) || 1,
  station_id: id,
  display_name: `Station ${id}`,
  geometry: { type: 'Point', coordinates: [lng, lat] },
  coordinate_quality_tier: 'high',
  coordinate_source: 'surveyed',
  classification: 'reference',
  classification_source: 'station_type',
  classification_rationale: null,
  classification_confidence: null,
  source_dra_id: 'dra-test',
  public: true,
  bc_region: null,
  waterbody: null,
  waterbody_type: null,
  ...overrides,
});

const linearMap = {
  latLngToContainerPoint: (ll: { lat: number; lng: number }) => ({
    x: ll.lng * 100,
    y: ll.lat * 100,
  }),
};

describe('findSampleNearLatLng', () => {
  it('returns the sample when the click is within pxRadius', () => {
    const samples = [makeSample('s1', 49.0, -123.0)];
    // Click projects to (-12300, 4900); sample projects to (-12300, 4900);
    // distance = 0; well within 10.
    const hit = findSampleNearLatLng(samples, 49.0, -123.0, 10, linearMap);
    expect(hit?.id).toBe('s1');
  });

  it('returns null when no sample is within pxRadius', () => {
    const samples = [makeSample('s1', 49.0, -123.0)];
    // Click 0.5 lng away = 50 pixels off in x; outside 10-px radius.
    const hit = findSampleNearLatLng(samples, 49.0, -122.5, 10, linearMap);
    expect(hit).toBeNull();
  });

  it('returns the CLOSEST sample when multiple are within pxRadius', () => {
    const samples = [
      makeSample('s1', 49.0, -123.0), // 0 px from click
      makeSample('s2', 49.05, -123.05), // 5 lng + 5 lat = ~7px diag
    ];
    // Click at (49.0, -123.0) -- s1 is exactly there; s2 is ~7px away.
    const hit = findSampleNearLatLng(samples, 49.0, -123.0, 10, linearMap);
    expect(hit?.id).toBe('s1');
  });

  it('respects the pxRadius boundary at exactly its edge', () => {
    const samples = [makeSample('s1', 49.0, -123.0)];
    // Click 0.1 lng away = exactly 10 pixels off. Should hit (<=).
    const hit = findSampleNearLatLng(samples, 49.0, -122.9, 10, linearMap);
    expect(hit?.id).toBe('s1');
  });

  it('returns null just outside the pxRadius boundary', () => {
    const samples = [makeSample('s1', 49.0, -123.0)];
    // Click 0.101 lng away = 10.1 pixels off; just past boundary.
    const hit = findSampleNearLatLng(
      samples,
      49.0,
      -122.899,
      10,
      linearMap,
    );
    expect(hit).toBeNull();
  });

  it('skips samples whose geometry coordinates are missing or malformed', () => {
    const bad: MatrixSample = {
      ...makeSample('bad', 49.0, -123.0),
      // Force malformed coords via cast; real RPC payload would never
      // emit this but defensive code keeps the hit-test robust.
      geometry: {
        type: 'Point',
        coordinates: [Number.NaN, Number.NaN] as [number, number],
      },
    };
    const good = makeSample('good', 49.0, -123.0);
    const hit = findSampleNearLatLng(
      [bad, good],
      49.0,
      -123.0,
      10,
      linearMap,
    );
    expect(hit?.id).toBe('good');
  });

  it('returns null for an empty samples list', () => {
    const hit = findSampleNearLatLng([], 49.0, -123.0, 10, linearMap);
    expect(hit).toBeNull();
  });

  it('returns null when pxRadius is non-positive', () => {
    const samples = [makeSample('s1', 49.0, -123.0)];
    expect(
      findSampleNearLatLng(samples, 49.0, -123.0, 0, linearMap),
    ).toBeNull();
    expect(
      findSampleNearLatLng(samples, 49.0, -123.0, -1, linearMap),
    ).toBeNull();
  });

  it('returns null when click lat/lng is non-finite', () => {
    const samples = [makeSample('s1', 49.0, -123.0)];
    expect(
      findSampleNearLatLng(samples, Number.NaN, -123.0, 10, linearMap),
    ).toBeNull();
    expect(
      findSampleNearLatLng(samples, 49.0, Number.NaN, 10, linearMap),
    ).toBeNull();
  });
});
