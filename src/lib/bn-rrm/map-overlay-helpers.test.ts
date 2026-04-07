/**
 * map-overlay-helpers tests
 *
 * Covers popup formatters for representative layer types and the
 * packHasMapArtifacts gate helper used to hide the Jermilova overlay UI
 * when the selected pack has no map block.
 *
 * Plain ASCII only.
 */

import { describe, expect, it } from 'vitest';
import {
  formatFeaturePopup,
  packHasMapArtifacts,
  CATEGORY_STYLES,
  HEAVY_LAYERS,
  getStyleForKey,
  type GeoJsonFeature,
} from './map-overlay-helpers';

function makeFeature(props: Record<string, unknown>): GeoJsonFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: props,
  };
}

describe('map-overlay-helpers - popup formatters', () => {
  it('formats basins_gsl popup with region and area', () => {
    const html = formatFeaturePopup(
      'basins_gsl',
      makeFeature({ region: 'Outlet', area_km2: 12345 }),
    );
    expect(html).toContain('GSL Region: Outlet');
    expect(html).toContain('Area');
    expect(html).toContain('km^2');
  });

  it('formats advisory_lakes popup with all advisory categories', () => {
    const html = formatFeaturePopup(
      'advisory_lakes',
      makeFeature({
        location: 'Test Lake',
        species: 'Lake Trout',
        advisory_adult: '4',
        advisory_pregnant_servings_per_wk: '1',
        advisory_child_5_11: '2',
        advisory_child_1_4: '1',
        fish_size_cm: 45.5,
        serving_size_g: 75,
      }),
    );
    expect(html).toContain('Test Lake');
    expect(html).toContain('Lake Trout');
    expect(html).toContain('Adults');
    expect(html).toContain('Pregnant women');
    expect(html).toContain('Children 5-11');
    expect(html).toContain('Children 1-4');
    expect(html).toContain('servings/wk');
  });

  it('formats commercial_fisheries popup with species array', () => {
    const html = formatFeaturePopup(
      'commercial_fisheries',
      makeFeature({
        name: 'Station A',
        location: 'Hay River',
        species: ['Lake Whitefish', 'Lake Trout', null, ''],
        quota_kg: 5000,
        quota_category: 'Commercial',
        subbasin: 'West',
      }),
    );
    expect(html).toContain('Station A');
    expect(html).toContain('Lake Whitefish, Lake Trout');
    expect(html).toContain('5,000');
    expect(html).toContain('kg');
  });

  it('formats communities popup with Indigenous breakdown', () => {
    const html = formatFeaturePopup(
      'communities',
      makeFeature({
        community: 'Yellowknife',
        population_total: 20000,
        pop_dene: 2000,
        pop_metis: 1500,
        pop_inuit: 300,
        pop_non_indigenous: 16200,
        ratio_indigenous_to_non: 0.23,
      }),
    );
    expect(html).toContain('Yellowknife');
    expect(html).toContain('Dene');
    expect(html).toContain('Metis');
    expect(html).toContain('Inuit');
    expect(html).toContain('Non-Indigenous');
  });

  it('escapes HTML in property strings to prevent injection', () => {
    const html = formatFeaturePopup(
      'large_mines',
      makeFeature({ name: '<script>alert(1)</script>', metal: 'Au' }),
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('handles missing properties gracefully', () => {
    const html = formatFeaturePopup(
      'historic_mines',
      makeFeature({}),
    );
    expect(html).toContain('Historic mine');
    expect(html).toContain('N/A');
  });
});

describe('map-overlay-helpers - packHasMapArtifacts', () => {
  it('returns false for null artifacts', () => {
    expect(packHasMapArtifacts(null)).toBe(false);
    expect(packHasMapArtifacts(undefined)).toBe(false);
  });

  it('returns false when map block is missing', () => {
    expect(packHasMapArtifacts({})).toBe(false);
  });

  it('returns false when map block is empty', () => {
    expect(packHasMapArtifacts({ map: {} })).toBe(false);
  });

  it('returns false when map block has only empty-string values', () => {
    expect(packHasMapArtifacts({ map: { basins_gsl: '' } })).toBe(false);
  });

  it('returns true when at least one map artifact path is present', () => {
    expect(
      packHasMapArtifacts({ map: { basins_gsl: 'map/gsl.geojson' } }),
    ).toBe(true);
  });
});

describe('map-overlay-helpers - palette and lazy-load', () => {
  it('exports a style for every category referenced by the schema', () => {
    expect(CATEGORY_STYLES.basins).toBeDefined();
    expect(CATEGORY_STYLES.mining).toBeDefined();
    expect(CATEGORY_STYLES.energy).toBeDefined();
    expect(CATEGORY_STYLES.permafrost).toBeDefined();
  });

  it('marks heavy layers for lazy loading', () => {
    expect(HEAVY_LAYERS.has('mineral_claims')).toBe(true);
    expect(HEAVY_LAYERS.has('oil_gas_claims')).toBe(true);
    expect(HEAVY_LAYERS.has('thaw_slumps')).toBe(true);
    expect(HEAVY_LAYERS.has('basins_gsl')).toBe(false);
  });

  it('resolves a style for every artifact key via getStyleForKey', () => {
    const basinsStyle = getStyleForKey('basins_gsl');
    expect(basinsStyle.color).toBe('#3b82f6');
    const miningStyle = getStyleForKey('mineral_claims');
    expect(miningStyle.color).toBe('#f59e0b');
  });
});
