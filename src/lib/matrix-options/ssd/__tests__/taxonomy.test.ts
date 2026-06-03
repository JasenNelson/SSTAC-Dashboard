import { describe, expect, it } from 'vitest';
import { mapTaxonomicGroup } from '../taxonomy';
import type { SsdBroadTaxonomicGroup } from '../types';

describe('mapTaxonomicGroup', () => {
  it('maps the canonical broad-group names to themselves', () => {
    expect(mapTaxonomicGroup('Fish')).toBe('Fish');
    expect(mapTaxonomicGroup('Invertebrate')).toBe('Invertebrate');
    expect(mapTaxonomicGroup('Plant')).toBe('Plant');
    expect(mapTaxonomicGroup('Amphibian')).toBe('Amphibian');
  });

  it('maps known invertebrate ECOTOX synonyms to Invertebrate', () => {
    for (const g of [
      'Aquatic Invertebrates', 'Invertebrates', 'Crustaceans', 'Crustacean',
      'Insects', 'Molluscs', 'Mollusc', 'Worms', 'Zooplankton',
    ]) {
      expect(mapTaxonomicGroup(g), g).toBe('Invertebrate');
    }
  });

  it('maps known plant/algae synonyms to Plant', () => {
    for (const g of ['Algae', 'Aquatic Plants', 'Plants (Seedlings)', 'Plants', 'Algae/Plants']) {
      expect(mapTaxonomicGroup(g), g).toBe('Plant');
    }
  });

  it('maps amphibian synonyms to Amphibian', () => {
    expect(mapTaxonomicGroup('Amphibians')).toBe('Amphibian');
  });

  it('trims surrounding whitespace before matching', () => {
    expect(mapTaxonomicGroup('  Fish  ')).toBe('Fish');
    expect(mapTaxonomicGroup('\tCrustaceans\n')).toBe('Invertebrate');
  });

  it('returns Other for null, undefined, and empty/whitespace input', () => {
    expect(mapTaxonomicGroup(null)).toBe('Other');
    expect(mapTaxonomicGroup(undefined)).toBe('Other');
    expect(mapTaxonomicGroup('')).toBe('Other');
    expect(mapTaxonomicGroup('   ')).toBe('Other');
  });

  it('returns Other for unrecognized groups (match is case-sensitive)', () => {
    expect(mapTaxonomicGroup('Mammal')).toBe('Other');
    expect(mapTaxonomicGroup('Bird')).toBe('Other');
    // Case-sensitive: lowercase is not in the mapping tables.
    expect(mapTaxonomicGroup('fish')).toBe('Other');
    expect(mapTaxonomicGroup('FISH')).toBe('Other');
  });

  it('only ever returns a valid broad-group literal', () => {
    const valid: SsdBroadTaxonomicGroup[] = ['Fish', 'Invertebrate', 'Plant', 'Amphibian', 'Other'];
    for (const input of ['Fish', 'Crustacean', 'Algae', 'Amphibians', 'nonsense', null, '']) {
      expect(valid).toContain(mapTaxonomicGroup(input as string | null));
    }
  });
});
