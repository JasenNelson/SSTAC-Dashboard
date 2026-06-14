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
  type SsdBootstrapInterval,
  type SsdCleanedRecord,
  type SsdWorkbenchSettings,
  type SpeciesAggregate,
} from './types';

const MIN_SPECIES_FOR_PREVIEW = 5;
const RECOMMENDED_SPECIES_COUNT = 8;
const BOOTSTRAP_CONFIDENCE_LEVEL = 0.95;

const MIXED_UNIT_BLOCK_REASON =
  'SSD requires a single consistent concentration unit. Convert all source records to ' +
  'one unit before computing the SSD/HCp.';

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
): {
  unit: string;
  warning: string | null;
  blocked: boolean;
  blockReason: string | null;
} {
  const units = Array.from(
    new Set(
      cleanedRecords
        .map((record) => normalizeReportedUnit(record.raw.unit))
        .filter((unit): unit is string => unit !== null),
    ),
  );

  if (units.length === 1) {
    return { unit: units[0], warning: null, blocked: false, blockReason: null };
  }
  if (units.length > 1) {
    return {
      unit: 'mixed reported units',
      warning:
        'Multiple concentration units are present in the selected SSD records; convert units before interpreting the HCp candidate.',
      blocked: true,
      blockReason: MIXED_UNIT_BLOCK_REASON,
    };
  }

  // units.length === 0: no record carried a reported unit. SCOPE LIMITATION (codex review
  // 2026-06-14): this is the case for the LIVE ecotox_mirror source -- ECOTOX_OPERATIONAL_COLUMNS
  // in ssd/supabase.ts does NOT select a unit column, so live rows have raw.unit === undefined and
  // reach here regardless of their true underlying units. The mixed-unit fail-closed guard above
  // therefore only protects UPLOADED CSV input (which carries per-row units); it does NOT yet protect
  // the live mirror path, where mixed underlying units could still be blended silently.
  // KNOWN FOLLOW-UP (owner-filed, AUTONOMOUS_APPROVAL_QUEUE_2026_06_14.md): fetch the mirror's unit
  // column into RawEcotoxRecord.unit so this guard covers the live route too. Until then, do NOT rely
  // on the absence of a block to mean "units are consistent" for live ecotox_mirror analyses.
  return {
    unit: settings.mediaFilter === 'sediment' ? 'reported unit' : 'mg/L',
    warning: null,
    blocked: false,
    blockReason: null,
  };
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sortedValues: number[], probability: number): number {
  if (sortedValues.length === 0) return Number.NaN;
  if (sortedValues.length === 1) return sortedValues[0];
  const position = (sortedValues.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const fraction = position - lowerIndex;
  return (
    sortedValues[lowerIndex] +
    (sortedValues[upperIndex] - sortedValues[lowerIndex]) * fraction
  );
}

function resampleSpeciesAggregates(
  speciesAggregates: SpeciesAggregate[],
  random: () => number,
): SpeciesAggregate[] {
  return speciesAggregates.map((_, index) => {
    const source =
      speciesAggregates[
        Math.min(
          speciesAggregates.length - 1,
          Math.floor(random() * speciesAggregates.length),
        )
      ];
    return {
      ...source,
      speciesScientificName: `${source.speciesScientificName} bootstrap ${index + 1}`,
    };
  });
}

function calculateModeHcp(
  speciesAggregates: SpeciesAggregate[],
  settings: SsdWorkbenchSettings,
): number {
  if (speciesAggregates.length < MIN_SPECIES_FOR_PREVIEW) return Number.NaN;
  if (settings.analysisMode === 'model_averaging') {
    return buildModelAveragedFit(speciesAggregates, settings.pValue)?.hcp ?? Number.NaN;
  }
  if (settings.analysisMode === 'single_distribution') {
    const selectedDistribution = settings.selectedDistribution ?? 'Log-Normal';
    return (
      fitSsdDistributions(speciesAggregates, settings.pValue).find(
        (fit) => fit.distribution === selectedDistribution,
      )?.hcp ?? Number.NaN
    );
  }
  return calculateEmpiricalHcp(speciesAggregates, settings.pValue);
}

function buildBootstrapInterval(
  speciesAggregates: SpeciesAggregate[],
  settings: SsdWorkbenchSettings,
): SsdBootstrapInterval | null {
  const iterations = Math.floor(settings.bootstrapIterations);
  if (iterations <= 0 || speciesAggregates.length < MIN_SPECIES_FOR_PREVIEW) {
    return null;
  }
  if (
    settings.analysisMode !== 'empirical_preview' &&
    speciesAggregates.length < MIN_SPECIES_FOR_SSDTOOLS_FIT
  ) {
    return null;
  }

  const random = seededRandom(settings.randomSeed);
  const hcps: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const sample = resampleSpeciesAggregates(speciesAggregates, random);
    const hcp = calculateModeHcp(sample, settings);
    if (Number.isFinite(hcp)) hcps.push(hcp);
  }

  if (hcps.length < Math.max(10, Math.ceil(iterations * 0.5))) return null;
  hcps.sort((a, b) => a - b);
  const alpha = 1 - BOOTSTRAP_CONFIDENCE_LEVEL;
  return {
    lower: quantile(hcps, alpha / 2),
    upper: quantile(hcps, 1 - alpha / 2),
    confidenceLevel: BOOTSTRAP_CONFIDENCE_LEVEL,
    iterations,
    successfulIterations: hcps.length,
    failedIterations: iterations - hcps.length,
    method: 'percentile_resampling',
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
  const warnings: string[] = [];
  const inferredUnit = inferAnalysisUnit(cleanedRecords, settings);

  if (inferredUnit.warning) warnings.push(inferredUnit.warning);

  // FAIL-CLOSED DATA-LAYER BLOCK: when source records carry more than one
  // distinct concentration unit, the aggregation step would silently blend
  // values across scales (e.g. mg/L + ng/L are 1e6 apart) and every per-species
  // value / HCp would be unit-ambiguous and wrong. Rather than trust the UI to
  // hide those numbers, we remove them at the source: an empty species set means
  // no finite HCp, no aggregates, no curve points, no bootstrap interval, and
  // empty CSV/JSON exports -- there is no plausible-but-wrong number left to leak.
  const isBlocked = inferredUnit.blocked;
  if (isBlocked && inferredUnit.blockReason) {
    warnings.push(inferredUnit.blockReason);
  }
  const speciesAggregates = isBlocked
    ? []
    : aggregateSpeciesValues(cleanedRecords, settings.aggregationMethod);

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
  }
  if (settings.bootstrapIterations > 0) {
    warnings.push(
      'Bootstrap confidence intervals use deterministic TypeScript percentile resampling; compare against official R ssdtools bootstrap output before regulatory use.',
    );
  } else if (settings.analysisMode !== 'empirical_preview') {
    warnings.push(
      'Point estimates are shown without bootstrap confidence intervals; ssdtools bootstrap CI parity is still pending.',
    );
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
  const bootstrapInterval = buildBootstrapInterval(speciesAggregates, settings);
  if (settings.bootstrapIterations > 0 && bootstrapInterval === null) {
    warnings.push(
      'Bootstrap confidence interval could not be calculated for the current filters and model settings.',
    );
  }
  const activeDistributionNames =
    modelAveragedFit?.activeFits
      .map(
        (fit) =>
          `${fit.distribution} (${SSDTOOLS_DISTRIBUTION_CODES[fit.distribution]})`,
      )
      .join(', ') ?? 'n/a';

  return {
    hcp,
    isBlocked,
    blockReason: isBlocked ? inferredUnit.blockReason : null,
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
    bootstrapInterval,
    excludedRecords,
    warnings,
    derivedCandidate: {
      label: `${percentileLabel} SSD-derived candidate`,
      inputKey: `ssd_${percentileLabel.toLowerCase()}_candidate`,
      value: hcp,
      unit,
      confidenceInterval: bootstrapInterval ?? undefined,
      evidenceSupportStatus: 'user_entered_or_derived',
      qaStatus: 'needs_review',
      canDriveCalculations: false,
      provenanceNote:
        'Derived from selected ECOTOX mirror records and workbench assumptions. Review source records, filters, model method, and QA before using in any calculator.',
    },
  };
}
