import { aggregateSpeciesValues } from './aggregation';
import { prepareSsdRecords } from './cleaning';
import {
  type EmpiricalSsdPoint,
  type RawEcotoxRecord,
  type SsdAnalysisResult,
  type SsdWorkbenchSettings,
  type SpeciesAggregate,
} from './types';

const MIN_SPECIES_FOR_PREVIEW = 5;
const RECOMMENDED_SPECIES_COUNT = 8;

function assertPValue(pValue: number): void {
  if (!Number.isFinite(pValue) || pValue < 0.01 || pValue > 0.5) {
    throw new RangeError('SSD pValue must be between 0.01 and 0.50.');
  }
}

export function calculateEmpiricalHcp(
  speciesAggregates: SpeciesAggregate[],
  pValue: number,
): number {
  assertPValue(pValue);
  if (speciesAggregates.length < MIN_SPECIES_FOR_PREVIEW) {
    throw new RangeError(
      `SSD preview requires at least ${MIN_SPECIES_FOR_PREVIEW} species.`,
    );
  }

  const sortedValues = speciesAggregates
    .map((aggregate) => aggregate.value)
    .sort((a, b) => a - b);
  const logValues = sortedValues.map((value) => Math.log(value));
  const position = (logValues.length - 1) * pValue;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return Math.exp(logValues[lowerIndex]);
  const fraction = position - lowerIndex;
  const interpolated =
    logValues[lowerIndex] +
    (logValues[upperIndex] - logValues[lowerIndex]) * fraction;
  return Math.exp(interpolated);
}

export function buildEmpiricalPoints(
  speciesAggregates: SpeciesAggregate[],
): EmpiricalSsdPoint[] {
  const sorted = [...speciesAggregates].sort((a, b) => a.value - b.value);
  return sorted.map((aggregate, index) => ({
    speciesScientificName: aggregate.speciesScientificName,
    broadGroup: aggregate.broadGroup,
    value: aggregate.value,
    percentAffected: ((index + 1) / (sorted.length + 1)) * 100,
  }));
}

export function buildSsdAnalysis(
  rawRows: RawEcotoxRecord[],
  settings: SsdWorkbenchSettings,
): SsdAnalysisResult {
  const { cleanedRecords, excludedRecords } = prepareSsdRecords(rawRows, {
    chemicalNames: settings.chemicalNames,
    medium: settings.medium,
    endpointFilters: settings.endpointFilters,
  });
  const speciesAggregates = aggregateSpeciesValues(
    cleanedRecords,
    settings.aggregationMethod,
  );
  const warnings: string[] = [];

  if (speciesAggregates.length < MIN_SPECIES_FOR_PREVIEW) {
    warnings.push(
      `Only ${speciesAggregates.length} species remain after filtering; ` +
        `at least ${MIN_SPECIES_FOR_PREVIEW} are required for a preview.`,
    );
  }
  if (speciesAggregates.length < RECOMMENDED_SPECIES_COUNT) {
    warnings.push(
      `Only ${speciesAggregates.length} species remain after filtering; ` +
        `${RECOMMENDED_SPECIES_COUNT}+ species is a better minimum for SSD review.`,
    );
  }
  if (settings.analysisMode !== 'empirical_preview') {
    warnings.push(
      'Distribution fitting and bootstrap confidence intervals are not enabled in this first slice.',
    );
  }

  const empiricalPoints = buildEmpiricalPoints(speciesAggregates);
  const hasMinimumSpecies =
    speciesAggregates.length >= MIN_SPECIES_FOR_PREVIEW;
  const hcp = hasMinimumSpecies
    ? calculateEmpiricalHcp(speciesAggregates, settings.pValue)
    : Number.NaN;
  const percentileLabel = `HC${Math.round(settings.pValue * 100)}`;

  return {
    hcp,
    pValue: settings.pValue,
    unit: 'mg/L',
    speciesCount: speciesAggregates.length,
    cleanedRecordCount: cleanedRecords.length,
    excludedRecordCount: excludedRecords.length,
    settings,
    speciesAggregates,
    empiricalPoints,
    diagnostics: hasMinimumSpecies
      ? [
          {
            name: 'Empirical log-linear preview',
            mode: 'empirical_preview',
            hcp,
            weight: 1,
            aicc: null,
            note:
              'First-slice deterministic preview. Full Log-Normal, Log-Logistic, Weibull, Gamma, AICc, and bootstrap parity remain gated.',
          },
        ]
      : [],
    excludedRecords,
    warnings,
    derivedCandidate: {
      label: `${percentileLabel} SSD-derived candidate`,
      inputKey: `ssd_${percentileLabel.toLowerCase()}_candidate`,
      value: hcp,
      unit: 'mg/L',
      evidenceSupportStatus: 'user_entered_or_derived',
      qaStatus: 'needs_review',
      canDriveCalculations: false,
      provenanceNote:
        'Derived from selected ECOTOX mirror records and workbench assumptions. Review source records, filters, model method, and QA before using in any calculator.',
    },
  };
}
