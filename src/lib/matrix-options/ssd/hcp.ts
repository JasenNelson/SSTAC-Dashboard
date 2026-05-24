import { aggregateSpeciesValues } from './aggregation';
import { prepareSsdRecords } from './cleaning';
import {
  buildModelAveragedFit,
  DEFAULT_SSDTOOLS_HCP_DELTA_CUTOFF,
  fitSsdDistributions,
  MIN_SPECIES_FOR_SSDTOOLS_FIT,
  SSDTOOLS_DISTRIBUTION_CODES,
} from './model';
import {
  type EmpiricalSsdPoint,
  type RawEcotoxRecord,
  type SsdAnalysisResult,
  type SsdCleanedRecord,
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

function normalizeReportedUnit(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function inferAnalysisUnit(
  cleanedRecords: SsdCleanedRecord[],
  settings: SsdWorkbenchSettings,
): { unit: string; warning: string | null } {
  const units = Array.from(
    new Set(
      cleanedRecords
        .map((record) => normalizeReportedUnit(record.raw.unit))
        .filter((unit): unit is string => unit !== null),
    ),
  );

  if (units.length === 1) return { unit: units[0], warning: null };
  if (units.length > 1) {
    return {
      unit: 'mixed reported units',
      warning:
        'Multiple concentration units are present in the selected SSD records; convert units before interpreting the HCp candidate.',
    };
  }

  return {
    unit: settings.mediaFilter === 'sediment' ? 'reported unit' : 'mg/L',
    warning: null,
  };
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
  const inferredUnit = inferAnalysisUnit(cleanedRecords, settings);

  if (inferredUnit.warning) warnings.push(inferredUnit.warning);

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
      'SSD model fitting is a TypeScript parity candidate aligned to BC Gov ssdtools distribution names and model-averaged CDF inversion. Validate against official R ssdtools snapshots before regulatory use.',
    );
    if (speciesAggregates.length < MIN_SPECIES_FOR_SSDTOOLS_FIT) {
      warnings.push(
        `BC Gov ssdtools distribution fitting requires at least ${MIN_SPECIES_FOR_SSDTOOLS_FIT} species; empirical HCp preview is shown until more species are available.`,
      );
    }
    if (settings.bootstrapIterations <= 0) {
      warnings.push(
        'Point estimates are shown without bootstrap confidence intervals; ssdtools bootstrap CI parity is still pending.',
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
  const distributionFits = hasMinimumSpecies
    ? fitSsdDistributions(speciesAggregates, settings.pValue)
    : [];
  const selectedDistribution = settings.selectedDistribution ?? 'Log-Normal';
  const selectedFit =
    distributionFits.find(
      (fit) => fit.distribution === selectedDistribution,
    ) ?? null;
  const modelAveragedFit =
    hasMinimumSpecies && settings.analysisMode === 'model_averaging'
      ? buildModelAveragedFit(speciesAggregates, settings.pValue)
      : null;

  if (
    settings.analysisMode === 'single_distribution' &&
    hasMinimumSpecies &&
    selectedFit === null
  ) {
    warnings.push(
      `${selectedDistribution} did not produce a valid fit for the current species set.`,
    );
  }
  if (
    settings.analysisMode === 'model_averaging' &&
    modelAveragedFit !== null &&
    modelAveragedFit.activeFits.length < distributionFits.length
  ) {
    warnings.push(
      `Model averaging excludes distributions with information-criterion delta above ${DEFAULT_SSDTOOLS_HCP_DELTA_CUTOFF}.`,
    );
  }
  if (
    settings.analysisMode === 'model_averaging' &&
    speciesAggregates.length < 26
  ) {
    warnings.push(
      'Mixture models are included for ssdtools parity, but the ssdtools model-averaging article notes two-component mixture models are better supported around 26+ species.',
    );
  }

  const shouldUseModelAverage =
    settings.analysisMode === 'model_averaging' && modelAveragedFit !== null;
  const shouldUseSingleDistribution =
    settings.analysisMode === 'single_distribution' && selectedFit !== null;
  const hcp = shouldUseModelAverage
    ? modelAveragedFit.hcp
    : shouldUseSingleDistribution
      ? selectedFit.hcp
      : empiricalHcp;
  const displayedFit = shouldUseModelAverage
    ? modelAveragedFit
    : selectedFit ?? distributionFits.find((fit) => fit.distribution === 'Log-Normal');
  const percentileLabel = `HC${Math.round(settings.pValue * 100)}`;
  const unit = inferredUnit.unit;
  const activeDistributionNames =
    modelAveragedFit?.activeFits
      .map(
        (fit) =>
          `${fit.distribution} (${SSDTOOLS_DISTRIBUTION_CODES[fit.distribution]})`,
      )
      .join(', ') ?? 'n/a';

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
    fittedCurvePoints: displayedFit?.curvePoints ?? [],
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
      ...(modelAveragedFit
        ? [
            {
              name: 'ssdtools model average',
              mode: 'model_averaging' as const,
              hcp: modelAveragedFit.hcp,
              weight: 1,
              aic: null,
              aicc: null,
              deltaAicc: null,
              parameters: [],
              note: `Weighted CDF inversion over active fits: ${activeDistributionNames}.`,
            },
          ]
        : []),
      ...distributionFits.map((fit) => ({
        name: `${fit.distribution} (${SSDTOOLS_DISTRIBUTION_CODES[fit.distribution]})`,
        distribution: fit.distribution,
        mode: 'single_distribution' as const,
        hcp: fit.hcp,
        weight: fit.weight,
        aic: fit.aic,
        aicc: fit.aicc,
        deltaAicc: fit.deltaAicc,
        parameters: fit.parameters,
        note:
          fit.deltaAicc !== null &&
          fit.deltaAicc > DEFAULT_SSDTOOLS_HCP_DELTA_CUTOFF
            ? `Fitted but excluded from model-averaged HCp by the ssdtools delta ${DEFAULT_SSDTOOLS_HCP_DELTA_CUTOFF} cutoff.`
            : 'BCANZ ssdtools candidate distribution fitted in the TypeScript parity path.',
      })),
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
