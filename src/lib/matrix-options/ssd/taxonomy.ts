import type { SsdBroadTaxonomicGroup } from './types';

const TAXONOMIC_MAPPING: Record<SsdBroadTaxonomicGroup, string[]> = {
  Fish: ['Fish'],
  Invertebrate: [
    'Invertebrate',
    'Aquatic Invertebrates',
    'Invertebrates',
    'Crustaceans',
    'Crustacean',
    'Insects',
    'Molluscs',
    'Mollusc',
    'Worms',
    'Zooplankton',
  ],
  Plant: [
    'Plant',
    'Algae',
    'Aquatic Plants',
    'Plants (Seedlings)',
    'Plants',
    'Algae/Plants',
  ],
  Amphibian: ['Amphibian', 'Amphibians'],
  Other: [],
};

export function mapTaxonomicGroup(
  ecotoxGroup: string | null | undefined,
): SsdBroadTaxonomicGroup {
  if (!ecotoxGroup) return 'Other';
  const trimmed = ecotoxGroup.trim();
  for (const [broadGroup, values] of Object.entries(TAXONOMIC_MAPPING)) {
    if (values.includes(trimmed)) return broadGroup as SsdBroadTaxonomicGroup;
  }
  return 'Other';
}
