import {
  type SsdCleanedRecord,
  type SpeciesAggregate,
  type SpeciesAggregationMethod,
} from './types';

function geometricMean(values: number[]): number {
  const meanLog =
    values.reduce((sum, value) => sum + Math.log(value), 0) / values.length;
  return Math.exp(meanLog);
}

export function aggregateSpeciesValues(
  records: SsdCleanedRecord[],
  method: SpeciesAggregationMethod,
): SpeciesAggregate[] {
  const bySpecies = new Map<string, SsdCleanedRecord[]>();
  for (const record of records) {
    const current = bySpecies.get(record.speciesScientificName) ?? [];
    current.push(record);
    bySpecies.set(record.speciesScientificName, current);
  }

  return Array.from(bySpecies.entries())
    .map(([speciesScientificName, speciesRecords]) => {
      const values = speciesRecords.map((record) => record.concentration);
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      const value =
        method === 'geometric_mean' ? geometricMean(values) : minValue;

      return {
        speciesScientificName,
        broadGroup: speciesRecords[0].broadGroup,
        value,
        valueCount: values.length,
        sourceRecordCount: speciesRecords.length,
        minValue,
        maxValue,
      };
    })
    .sort((a, b) => a.value - b.value);
}
