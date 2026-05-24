import { aggregateSpeciesValues } from './aggregation';
import { prepareSsdRecords } from './cleaning';
import { fitLogNormalDistribution } from './model';
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
    mediaFilter: settings.mediaFilter,
    environmentFilter: settings.environmentFilter,
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
    if (
      settings.analysisMode === 'model_averaging' ||
      settings.selectedDistribution !== 'Log-Normal'
    ) {
      warnings.push(
        'Only Log-Normal single-distribution fitting is enabled in this slice. AICc model averaging and additional distributions remain gated.',
      );
    }
  }
  if (settings.mediaFilter === 'sediment') {
    warnings.push(
      'Sediment SSD inputs are accepted for review, but units and ECOTOX sediment schema mapping still need QA before use.',
    );
  }

  const empiricalPoints = buildEmpiricalPoints(speciesAggregates);
  const hasMinimumSpecies =
    speciesAggregates.length >= MIN_SPECIES_FOR_PREVIEW;
  const empiricalHcp = hasMinimumSpecies
    ? calculateEmpiricalHcp(speciesAggregates, settings.pValue)
    : Number.NaN;
  const logNormalFit = hasMinimumSpecies
    ? fitLogNormalDistribution(speciesAggregates, settings.pValue)
    : null;
  const shouldUseLogNormalHcp =
    settings.analysisMode === 'single_distribution' &&
    (settings.selectedDistribution ?? 'Log-Normal') === 'Log-Normal' &&
    logNormalFit !== null;
  const hcp = shouldUseLogNormalHcp ? logNormalFit.hcp : empiricalHcp;
  const percentileLabel = `HC${Math.round(settings.pValue * 100)}`;
  const unit = settings.mediaFilter === 'sediment' ? 'reported unit' : 'mg/L';

  return {
    hcp,
    pValue: settings.pValue,
    unit,
    speciesCount: speciesAggregates.length,
    cleanedRecordCount: cleanedRecords.length,
    excludedRecordCount: excludedRecords.length,
    settings,
    speciesAggregates,
    empiricalPoints,
    fittedCurvePoints: logNormalFit?.curvePoints ?? [],
    diagnostics: [
      ...(hasMinimumSpecies
        ? [
            {
              name: 'Empirical log-linear preview',
              mode: 'empirical_preview' as const,
              hcp: empiricalHcp,
              weight: 1,
              aic: null,
              aicc: null,
              parameters: [],
              note:
                'Deterministic preview using log-linear interpolation between species aggregate values.',
            },
          ]
        : []),
      ...(logNormalFit
        ? [
            {
              name: 'Log-Normal fit',
              distribution: logNormalFit.distribution,
              mode: 'single_distribution' as const,
              hcp: logNormalFit.hcp,
              weight: 1,
              aic: logNormalFit.aic,
              aicc: logNormalFit.aicc,
              parameters: logNormalFit.parameters,
              note:
                'Fitted in natural-log concentration space using ssdtools/R lnorm parameter names. Additional distributions, model averaging, and bootstrap confidence intervals remain gated.',
            },
          ]
        : []),
    ],
    excludedRecords,
    warnings,
    derivedCandidate: {
      label: `${percentileLabel} SSD-derived candidate`,
      inputKey: `ssd_${percentileLabel.toLowerCase()}_candidate`,
      value: hcp,
      unit,
      evidenceSupportStatus: 'user_entered_or_derived',
      qaStatus: 'needs_review',
      canDriveCalculations: false,
      provenanceNote:
        'Derived from selected ECOTOX mirror records and workbench assumptions. Review source records, filters, model method, and QA before using in any calculator.',
    },
  };
}
