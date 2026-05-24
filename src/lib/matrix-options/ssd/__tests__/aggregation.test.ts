import { describe, expect, it } from 'vitest';
import { aggregateSpeciesValues } from '../aggregation';
import { prepareSsdRecords } from '../cleaning';
import { SSD_FIXTURE_ROWS } from '../fixtures';

describe('SSD species aggregation', () => {
  it('aggregates multiple endpoint values per species by geometric mean', () => {
    const { cleanedRecords } = prepareSsdRecords(SSD_FIXTURE_ROWS, {
      mediaFilter: 'water',
      environmentFilter: 'freshwater',
      endpointFilters: [],
    });

    const aggregates = aggregateSpeciesValues(cleanedRecords, 'geometric_mean');
    const daphnia = aggregates.find(
      (aggregate) => aggregate.speciesScientificName === 'Daphnia magna',
    );

    expect(aggregates).toHaveLength(10);
    expect(daphnia).toBeDefined();
    expect(daphnia?.value).toBeCloseTo(Math.sqrt(0.006 * 0.009), 12);
    expect(daphnia?.sourceRecordCount).toBe(2);
  });

  it('aggregates multiple endpoint values per species by most-sensitive value', () => {
    const { cleanedRecords } = prepareSsdRecords(SSD_FIXTURE_ROWS, {
      mediaFilter: 'water',
      environmentFilter: 'freshwater',
      endpointFilters: [],
    });

    const aggregates = aggregateSpeciesValues(cleanedRecords, 'most_sensitive');
    const daphnia = aggregates.find(
      (aggregate) => aggregate.speciesScientificName === 'Daphnia magna',
    );

    expect(daphnia?.value).toBe(0.006);
    expect(daphnia?.minValue).toBe(0.006);
    expect(daphnia?.maxValue).toBe(0.009);
  });
});
