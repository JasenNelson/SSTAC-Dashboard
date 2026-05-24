import { describe, expect, it } from 'vitest';
import { parseEndpointValue, prepareSsdRecords } from '../cleaning';
import type { RawEcotoxRecord } from '../types';

describe('SSD endpoint cleaning', () => {
  it('parses finite numeric endpoint values and rejects invalid markers', () => {
    expect(parseEndpointValue(0.12)).toBe(0.12);
    expect(parseEndpointValue('1,234.5 mg/L')).toBe(1234.5);
    expect(parseEndpointValue('NR')).toBeNull();
    expect(parseEndpointValue('Not Reported')).toBeNull();
    expect(parseEndpointValue('<0.05')).toBeNull();
    expect(parseEndpointValue(null)).toBeNull();
  });

  it('filters by chemical, medium, endpoint, species, and positive values with reasons', () => {
    const rows: RawEcotoxRecord[] = [
      {
        chemical_name: 'Copper',
        species_scientific_name: 'Daphnia magna',
        conc1_mean: 0.1,
        species_group: 'Crustacean',
        media_type: 'FW',
        endpoint: 'Mortality',
      },
      {
        chemical_name: 'Zinc',
        species_scientific_name: 'Zinc species',
        conc1_mean: 0.15,
        species_group: 'Fish',
        media_type: 'FW',
        endpoint: 'Mortality',
      },
      {
        chemical_name: 'Copper',
        species_scientific_name: 'Sediment species',
        conc1_mean: 0.18,
        species_group: 'Invertebrate',
        media_type: 'sediment',
        endpoint: 'Mortality',
      },
      {
        chemical_name: 'Copper',
        species_scientific_name: 'Marine species',
        conc1_mean: 0.2,
        species_group: 'Fish',
        media_type: 'MW',
        endpoint: 'Mortality',
      },
      {
        chemical_name: 'Copper',
        species_scientific_name: null,
        conc1_mean: 0.2,
        species_group: 'Fish',
        media_type: 'FW',
        endpoint: 'Mortality',
      },
      {
        chemical_name: 'Copper',
        species_scientific_name: 'Bad value',
        conc1_mean: 'NR',
        species_group: 'Fish',
        media_type: 'FW',
        endpoint: 'Mortality',
      },
      {
        chemical_name: 'Copper',
        species_scientific_name: 'Wrong endpoint',
        conc1_mean: 0.3,
        species_group: 'Fish',
        media_type: 'FW',
        endpoint: 'Growth',
      },
    ];

    const { cleanedRecords, excludedRecords } = prepareSsdRecords(rows, {
      chemicalNames: ['Copper'],
      mediaFilter: 'water',
      environmentFilter: 'freshwater',
      endpointFilters: ['Mortality'],
    });

    expect(cleanedRecords).toHaveLength(1);
    expect(cleanedRecords[0].broadGroup).toBe('Invertebrate');
    expect(excludedRecords.map((record) => record.reason)).toEqual([
      'chemical_mismatch',
      'media_mismatch',
      'medium_mismatch',
      'missing_species',
      'invalid_endpoint_value',
      'endpoint_mismatch',
    ]);
  });

  it('classifies mixed freshwater sediment media as sediment', () => {
    const { cleanedRecords } = prepareSsdRecords(
      [
        {
          chemical_name: 'Copper',
          species_scientific_name: 'Hyalella azteca',
          conc1_mean: 12,
          species_group: 'Invertebrate',
          media_type: 'freshwater sediment',
          endpoint: 'Growth',
        },
      ],
      {
        chemicalNames: ['Copper'],
        mediaFilter: 'sediment',
        environmentFilter: 'all',
        endpointFilters: [],
      },
    );

    expect(cleanedRecords).toHaveLength(1);
    expect(cleanedRecords[0].mediaType).toBe('freshwater sediment');
  });
});
