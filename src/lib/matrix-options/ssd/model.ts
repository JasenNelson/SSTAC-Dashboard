import type {
  SsdDistribution,
  SsdFittedCurvePoint,
  SsdModelParameter,
  SpeciesAggregate,
} from './types';

export interface SsdDistributionFit {
  distribution: SsdDistribution;
  hcp: number;
  aic: number;
  aicc: number;
  deltaAicc: number | null;
  weight: number;
  logLikelihood: number;
  parameters: SsdModelParameter[];
  curvePoints: SsdFittedCurvePoint[];
  cdf: (value: number) => number;
}

interface CandidateFitInput {
  distribution: SsdDistribution;
  values: number[];
  pValue: number;
}

interface UnweightedCandidateFit {
  distribution: SsdDistribution;
  hcp: number;
  aic: number;
  aicc: number;
  logLikelihood: number;
  parameters: SsdModelParameter[];
  cdf: (value: number) => number;
}

interface OptimizerResult {
  parameters: number[];
  score: number;
}

interface LogNormalMixtureFit {
  meanlog1: number;
  sdlog1: number;
  meanlog2: number;
  sdlog2: number;
  pmix: number;
  logLikelihood: number;
}

export interface SsdModelAverageFit {
  hcp: number;
  curvePoints: SsdFittedCurvePoint[];
  fits: SsdDistributionFit[];
  activeFits: SsdDistributionFit[];
}

export const SSDTOOLS_DISTRIBUTIONS: SsdDistribution[] = [
  'Gamma',
  'Log-Gumbel',
  'Log-Logistic',
  'Log-Normal',
  'Log-Normal Mixture',
  'Weibull',
];

export const SSDTOOLS_DISTRIBUTION_CODES: Record<SsdDistribution, string> = {
  Gamma: 'gamma',
  'Log-Gumbel': 'lgumbel',
  'Log-Logistic': 'llogis',
  'Log-Normal': 'lnorm',
  'Log-Normal Mixture': 'lnorm_lnorm',
  Weibull: 'weibull',
};

export const DEFAULT_SSDTOOLS_HCP_DELTA_CUTOFF = 9.21;
export const MIN_SPECIES_FOR_SSDTOOLS_FIT = 6;

const SQRT_TWO_PI = Math.sqrt(2 * Math.PI);
const TWO_PARAMETER_COUNT = 2;
const MIXTURE_PARAMETER_COUNT = 5;
const DEFAULT_CURVE_POINT_COUNT = 80;
const MIN_OPTIMIZER_SCALE = 1e-6;
const MIN_MIXTURE_SDLOG = 0.05;
const LANCZOS_COEFFICIENTS = [
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
];

export function standardNormalCdf(z: number): number {
  if (!Number.isFinite(z)) return Number.NaN;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x));
  return 0.5 * (1 + sign * erf);
}

export function inverseStandardNormal(p: number): number {
  assertProbability(p);

  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.38357751867269e2,
    -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
  ];

  const lower = 0.02425;
  const upper = 1 - lower;

  if (p < lower) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q +
        c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }

  if (p > upper) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q +
        c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }

  const q = p - 0.5;
  const r = q * q;
  return (
    (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r +
      a[5]) *
    q
  ) / (
    ((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r +
    1
  );
}

function assertProbability(p: number): void {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) {
    throw new RangeError('Probability must be between 0 and 1.');
  }
}

function getPositiveValues(speciesAggregates: SpeciesAggregate[]): number[] {
  return speciesAggregates
    .map((aggregate) => aggregate.value)
    .filter((value) => Number.isFinite(value) && value > 0);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function populationVariance(values: number[]): number {
  const average = mean(values);
  return (
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    values.length
  );
}

function standardDeviation(values: number[]): number {
  return Math.sqrt(populationVariance(values));
}

function sampleVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  return (
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    (values.length - 1)
  );
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value));
}

function logSumExp(first: number, second: number): number {
  const maxValue = Math.max(first, second);
  if (!Number.isFinite(maxValue)) return maxValue;
  return (
    maxValue +
    Math.log(Math.exp(first - maxValue) + Math.exp(second - maxValue))
  );
}

function normalLogDensity(value: number, average: number, sd: number): number {
  if (!Number.isFinite(sd) || sd <= 0) return Number.NEGATIVE_INFINITY;
  const z = (value - average) / sd;
  return -Math.log(sd * SQRT_TWO_PI) - (z * z) / 2;
}

function logNormalCdf(value: number, meanlog: number, sdlog: number): number {
  return value <= 0
    ? 0
    : standardNormalCdf((Math.log(value) - meanlog) / sdlog);
}

function logNormalLogDensity(
  value: number,
  meanlog: number,
  sdlog: number,
): number {
  if (value <= 0) return Number.NEGATIVE_INFINITY;
  return normalLogDensity(Math.log(value), meanlog, sdlog) - Math.log(value);
}

function logGamma(value: number): number {
  if (value < 0.5) {
    return (
      Math.log(Math.PI) -
      Math.log(Math.sin(Math.PI * value)) -
      logGamma(1 - value)
    );
  }

  let x = 0.99999999999980993;
  const shifted = value - 1;
  for (let index = 0; index < LANCZOS_COEFFICIENTS.length; index += 1) {
    x += LANCZOS_COEFFICIENTS[index] / (shifted + index + 1);
  }
  const t = shifted + LANCZOS_COEFFICIENTS.length - 0.5;
  return (
    0.5 * Math.log(2 * Math.PI) +
    (shifted + 0.5) * Math.log(t) -
    t +
    Math.log(x)
  );
}

function regularizedGammaP(shape: number, x: number): number {
  if (!Number.isFinite(shape) || !Number.isFinite(x) || shape <= 0) {
    return Number.NaN;
  }
  if (x <= 0) return 0;
  if (x < shape + 1) {
    let ap = shape;
    let del = 1 / shape;
    let sum = del;
    for (let index = 0; index < 100; index += 1) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-12) {
        return clamp(
          sum * Math.exp(-x + shape * Math.log(x) - logGamma(shape)),
          0,
          1,
        );
      }
    }
  }

  let b = x + 1 - shape;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let index = 1; index <= 100; index += 1) {
    const an = -index * (index - shape);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return clamp(
    1 - Math.exp(-x + shape * Math.log(x) - logGamma(shape)) * h,
    0,
    1,
  );
}

function logisticCdf(z: number): number {
  if (z >= 0) {
    return 1 / (1 + Math.exp(-z));
  }
  const expZ = Math.exp(z);
  return expZ / (1 + expZ);
}

function logisticQuantile(p: number): number {
  assertProbability(p);
  return Math.log(p / (1 - p));
}

function gumbelCdf(z: number): number {
  return Math.exp(-Math.exp(-z));
}

function gumbelQuantile(p: number): number {
  assertProbability(p);
  return -Math.log(-Math.log(p));
}

function aicFromLogLikelihood(logLikelihood: number, k: number): number {
  return 2 * k - 2 * logLikelihood;
}

function aiccFromAic(aic: number, k: number, n: number): number {
  if (n <= k + 1) return Number.POSITIVE_INFINITY;
  return aic + (2 * k * (k + 1)) / (n - k - 1);
}

function minMixtureProportion(n: number): number {
  return Math.max(Math.min(3 / n, 0.5), 0.1);
}

function nelderMead(
  objective: (parameters: number[]) => number,
  initial: number[],
  steps: number[],
  maxIterations = 240,
): OptimizerResult | null {
  const n = initial.length;
  const simplex = [initial];
  for (let index = 0; index < n; index += 1) {
    const point = [...initial];
    point[index] += steps[index] || 0.1;
    simplex.push(point);
  }

  let scored = simplex.map((parameters) => ({
    parameters,
    score: objective(parameters),
  }));
  if (scored.every((point) => !Number.isFinite(point.score))) return null;

  const alpha = 1;
  const gamma = 2;
  const rho = 0.5;
  const sigma = 0.5;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    scored = scored
      .filter((point) => Number.isFinite(point.score))
      .sort((a, b) => a.score - b.score);
    if (scored.length < n + 1) {
      const best = scored[0];
      if (!best) return null;
      while (scored.length < n + 1) {
        const point = best.parameters.map(
          (value, index) =>
            value +
            (scored.length % 2 === 0 ? 0.5 : -0.5) *
              (steps[index] || 0.1),
        );
        scored.push({ parameters: point, score: objective(point) });
      }
      scored.sort((a, b) => a.score - b.score);
    }

    const best = scored[0];
    const worst = scored[n];
    const secondWorst = scored[n - 1];
    const scoreRange = worst.score - best.score;
    if (scoreRange < 1e-9) return best;

    const centroid = Array.from({ length: n }, (_, dim) =>
      scored
        .slice(0, n)
        .reduce((sum, point) => sum + point.parameters[dim], 0) / n,
    );

    const reflected = centroid.map(
      (value, dim) => value + alpha * (value - worst.parameters[dim]),
    );
    const reflectedScore = objective(reflected);

    if (reflectedScore < best.score) {
      const expanded = centroid.map(
        (value, dim) => value + gamma * (reflected[dim] - value),
      );
      const expandedScore = objective(expanded);
      scored[n] =
        expandedScore < reflectedScore
          ? { parameters: expanded, score: expandedScore }
          : { parameters: reflected, score: reflectedScore };
      continue;
    }

    if (reflectedScore < secondWorst.score) {
      scored[n] = { parameters: reflected, score: reflectedScore };
      continue;
    }

    const contracted = centroid.map(
      (value, dim) => value + rho * (worst.parameters[dim] - value),
    );
    const contractedScore = objective(contracted);
    if (contractedScore < worst.score) {
      scored[n] = { parameters: contracted, score: contractedScore };
      continue;
    }

    for (let index = 1; index < scored.length; index += 1) {
      const shrunk = best.parameters.map(
        (value, dim) => value + sigma * (scored[index].parameters[dim] - value),
      );
      scored[index] = { parameters: shrunk, score: objective(shrunk) };
    }
  }

  scored.sort((a, b) => a.score - b.score);
  return scored[0] ?? null;
}

function optimizeBest(
  objective: (parameters: number[]) => number,
  starts: number[][],
  steps: number[],
): OptimizerResult | null {
  const results = starts
    .map((start) => nelderMead(objective, start, steps))
    .filter((result): result is OptimizerResult => result !== null)
    .sort((a, b) => a.score - b.score);
  return results[0] ?? null;
}

function solveMonotoneRoot(
  cdf: (value: number) => number,
  pValue: number,
  minValue: number,
  maxValue: number,
): number {
  assertProbability(pValue);
  let lower = Math.max(Number.MIN_VALUE, minValue / 1_000_000);
  let upper = maxValue * 1_000_000;

  for (let index = 0; index < 80 && cdf(lower) > pValue; index += 1) {
    lower /= 10;
  }
  for (let index = 0; index < 80 && cdf(upper) < pValue; index += 1) {
    upper *= 10;
  }

  for (let index = 0; index < 120; index += 1) {
    const middle = Math.sqrt(lower * upper);
    const probability = cdf(middle);
    if (!Number.isFinite(probability)) break;
    if (probability < pValue) {
      lower = middle;
    } else {
      upper = middle;
    }
  }

  return Math.sqrt(lower * upper);
}

function linearRegression(xs: number[], ys: number[]): {
  intercept: number;
  slope: number;
} {
  const xMean = mean(xs);
  const yMean = mean(ys);
  const denominator = xs.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
  if (denominator <= 0) return { intercept: 0, slope: 1 };
  const slope =
    ys.reduce(
      (sum, value, index) => sum + (xs[index] - xMean) * (value - yMean),
      0,
    ) / denominator;
  return { intercept: yMean - slope * xMean, slope };
}

function buildCurvePoints(
  values: number[],
  distribution: SsdFittedCurvePoint['distribution'],
  cdf: (value: number) => number,
  extraValues: number[] = [],
): SsdFittedCurvePoint[] {
  const sortedValues = [...values, ...extraValues]
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const minLog = Math.log(sortedValues[0]);
  const maxLog = Math.log(sortedValues[sortedValues.length - 1]);

  if (minLog === maxLog) return [];

  const padding = Math.max((maxLog - minLog) * 0.08, 0.15);
  return Array.from({ length: DEFAULT_CURVE_POINT_COUNT }, (_, index) => {
    const fraction = index / (DEFAULT_CURVE_POINT_COUNT - 1);
    const logValue = minLog - padding + (maxLog - minLog + padding * 2) * fraction;
    const value = Math.exp(logValue);
    return {
      distribution,
      value,
      percentAffected: clamp(cdf(value) * 100, 0, 100),
    };
  });
}

function buildFitResult(
  fit: UnweightedCandidateFit,
  values: number[],
): SsdDistributionFit {
  return {
    ...fit,
    deltaAicc: null,
    weight: 0,
    curvePoints: buildCurvePoints(values, fit.distribution, fit.cdf, [fit.hcp]),
  };
}

function fitLogNormal({
  distribution,
  values,
  pValue,
}: CandidateFitInput): UnweightedCandidateFit | null {
  const logValues = values.map((value) => Math.log(value));
  const meanlog = mean(logValues);
  const sdlog = standardDeviation(logValues);
  if (!Number.isFinite(sdlog) || sdlog <= 0) return null;

  const logLikelihood = values.reduce(
    (sum, value) => sum + logNormalLogDensity(value, meanlog, sdlog),
    0,
  );
  const aic = aicFromLogLikelihood(logLikelihood, TWO_PARAMETER_COUNT);
  const cdf = (value: number) => logNormalCdf(value, meanlog, sdlog);

  return {
    distribution,
    hcp: Math.exp(meanlog + sdlog * inverseStandardNormal(pValue)),
    aic,
    aicc: aiccFromAic(aic, TWO_PARAMETER_COUNT, values.length),
    logLikelihood,
    parameters: [
      { name: 'meanlog', value: meanlog },
      { name: 'sdlog', value: sdlog },
    ],
    cdf,
  };
}

function fitLogLogistic({
  distribution,
  values,
  pValue,
}: CandidateFitInput): UnweightedCandidateFit | null {
  const logValues = values.map((value) => Math.log(value));
  const initialLocation = mean(logValues);
  const initialScale = Math.max(
    MIN_OPTIMIZER_SCALE,
    (standardDeviation(logValues) * Math.sqrt(3)) / Math.PI,
  );
  const objective = ([locationlog, logScalelog]: number[]) => {
    const scalelog = Math.exp(logScalelog);
    const logLikelihood = values.reduce((sum, value, index) => {
      const z = (logValues[index] - locationlog) / scalelog;
      return (
        sum -
        Math.log(value) -
        Math.log(scalelog) -
        z -
        2 * Math.log1p(Math.exp(-z))
      );
    }, 0);
    return -logLikelihood;
  };
  const optimized = optimizeBest(
    objective,
    [
      [initialLocation, Math.log(initialScale)],
      [initialLocation - initialScale, Math.log(initialScale)],
      [initialLocation + initialScale, Math.log(initialScale)],
    ],
    [Math.max(0.5, Math.abs(initialLocation) * 0.1), 0.25],
  );
  if (!optimized) return null;

  const [locationlog, logScalelog] = optimized.parameters;
  const scalelog = Math.exp(logScalelog);
  if (!Number.isFinite(scalelog) || scalelog <= 0) return null;

  const logLikelihood = -optimized.score;
  const aic = aicFromLogLikelihood(logLikelihood, TWO_PARAMETER_COUNT);
  const cdf = (value: number) =>
    value <= 0 ? 0 : logisticCdf((Math.log(value) - locationlog) / scalelog);

  return {
    distribution,
    hcp: Math.exp(locationlog + scalelog * logisticQuantile(pValue)),
    aic,
    aicc: aiccFromAic(aic, TWO_PARAMETER_COUNT, values.length),
    logLikelihood,
    parameters: [
      { name: 'locationlog', value: locationlog },
      { name: 'scalelog', value: scalelog },
    ],
    cdf,
  };
}

function fitLogGumbel({
  distribution,
  values,
  pValue,
}: CandidateFitInput): UnweightedCandidateFit | null {
  const logValues = values.map((value) => Math.log(value));
  const initialLocation = mean(logValues);
  const initialScale = Math.max(
    MIN_OPTIMIZER_SCALE,
    (standardDeviation(logValues) * Math.sqrt(6)) / Math.PI,
  );
  const objective = ([locationlog, logScalelog]: number[]) => {
    const scalelog = Math.exp(logScalelog);
    const logLikelihood = values.reduce((sum, value, index) => {
      const z = (logValues[index] - locationlog) / scalelog;
      return sum - Math.log(value) - Math.log(scalelog) - z - Math.exp(-z);
    }, 0);
    return -logLikelihood;
  };
  const optimized = optimizeBest(
    objective,
    [
      [initialLocation, Math.log(initialScale)],
      [initialLocation - initialScale, Math.log(initialScale)],
      [initialLocation + initialScale, Math.log(initialScale)],
    ],
    [Math.max(0.5, Math.abs(initialLocation) * 0.1), 0.25],
  );
  if (!optimized) return null;

  const [locationlog, logScalelog] = optimized.parameters;
  const scalelog = Math.exp(logScalelog);
  if (!Number.isFinite(scalelog) || scalelog <= 0) return null;

  const logLikelihood = -optimized.score;
  const aic = aicFromLogLikelihood(logLikelihood, TWO_PARAMETER_COUNT);
  const cdf = (value: number) =>
    value <= 0 ? 0 : gumbelCdf((Math.log(value) - locationlog) / scalelog);

  return {
    distribution,
    hcp: Math.exp(locationlog + scalelog * gumbelQuantile(pValue)),
    aic,
    aicc: aiccFromAic(aic, TWO_PARAMETER_COUNT, values.length),
    logLikelihood,
    parameters: [
      { name: 'locationlog', value: locationlog },
      { name: 'scalelog', value: scalelog },
    ],
    cdf,
  };
}

function initialWeibull(values: number[]): { shape: number; scale: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const p = (index + 1 - 0.3) / (sorted.length + 0.4);
    xs.push(Math.log(sorted[index]));
    ys.push(Math.log(-Math.log(1 - p)));
  }
  const regression = linearRegression(xs, ys);
  const shape = Math.max(MIN_OPTIMIZER_SCALE, regression.slope);
  return {
    shape,
    scale: Math.exp(-regression.intercept / shape),
  };
}

function fitWeibull({
  distribution,
  values,
  pValue,
}: CandidateFitInput): UnweightedCandidateFit | null {
  const start = initialWeibull(values);
  const objective = ([logShape, logScale]: number[]) => {
    const shape = Math.exp(logShape);
    const scale = Math.exp(logScale);
    const logLikelihood = values.reduce((sum, value) => {
      const logRatio = Math.log(value) - Math.log(scale);
      return (
        sum +
        Math.log(shape) -
        Math.log(scale) +
        (shape - 1) * logRatio -
        Math.exp(shape * logRatio)
      );
    }, 0);
    return -logLikelihood;
  };
  const optimized = optimizeBest(
    objective,
    [
      [Math.log(start.shape), Math.log(start.scale)],
      [Math.log(Math.max(start.shape * 0.5, MIN_OPTIMIZER_SCALE)), Math.log(start.scale)],
      [Math.log(start.shape * 1.5), Math.log(start.scale)],
    ],
    [0.25, 0.25],
  );
  if (!optimized) return null;

  const shape = Math.exp(optimized.parameters[0]);
  const scale = Math.exp(optimized.parameters[1]);
  if (shape <= 0 || scale <= 0) return null;

  const logLikelihood = -optimized.score;
  const aic = aicFromLogLikelihood(logLikelihood, TWO_PARAMETER_COUNT);
  const cdf = (value: number) =>
    value <= 0 ? 0 : 1 - Math.exp(-((value / scale) ** shape));

  return {
    distribution,
    hcp: scale * (-Math.log(1 - pValue)) ** (1 / shape),
    aic,
    aicc: aiccFromAic(aic, TWO_PARAMETER_COUNT, values.length),
    logLikelihood,
    parameters: [
      { name: 'scale', value: scale },
      { name: 'shape', value: shape },
    ],
    cdf,
  };
}

function fitGamma({
  distribution,
  values,
  pValue,
}: CandidateFitInput): UnweightedCandidateFit | null {
  const sampleMean = mean(values);
  const variance = sampleVariance(values);
  if (variance <= 0 || sampleMean <= 0) return null;

  const shapeStart = Math.max(
    MIN_OPTIMIZER_SCALE,
    (sampleMean * sampleMean) / variance,
  );
  const scaleStart = Math.max(MIN_OPTIMIZER_SCALE, variance / sampleMean);
  const objective = ([logShape, logScale]: number[]) => {
    const shape = Math.exp(logShape);
    const scale = Math.exp(logScale);
    const logLikelihood = values.reduce(
      (sum, value) =>
        sum +
        (shape - 1) * Math.log(value) -
        value / scale -
        logGamma(shape) -
        shape * Math.log(scale),
      0,
    );
    return -logLikelihood;
  };
  const optimized = optimizeBest(
    objective,
    [
      [Math.log(shapeStart), Math.log(scaleStart)],
      [Math.log(Math.max(shapeStart * 0.5, MIN_OPTIMIZER_SCALE)), Math.log(scaleStart * 2)],
      [Math.log(shapeStart * 2), Math.log(Math.max(scaleStart * 0.5, MIN_OPTIMIZER_SCALE))],
    ],
    [0.25, 0.25],
  );
  if (!optimized) return null;

  const shape = Math.exp(optimized.parameters[0]);
  const scale = Math.exp(optimized.parameters[1]);
  if (shape <= 0 || scale <= 0) return null;

  const logLikelihood = -optimized.score;
  const aic = aicFromLogLikelihood(logLikelihood, TWO_PARAMETER_COUNT);
  const cdf = (value: number) =>
    value <= 0 ? 0 : regularizedGammaP(shape, value / scale);
  const hcp = solveMonotoneRoot(
    cdf,
    pValue,
    Math.min(...values),
    Math.max(...values),
  );

  return {
    distribution,
    hcp,
    aic,
    aicc: aiccFromAic(aic, TWO_PARAMETER_COUNT, values.length),
    logLikelihood,
    parameters: [
      { name: 'scale', value: scale },
      { name: 'shape', value: shape },
    ],
    cdf,
  };
}

function fitLogNormalMixture({
  distribution,
  values,
  pValue,
}: CandidateFitInput): UnweightedCandidateFit | null {
  const logValues = values.map((value) => Math.log(value)).sort((a, b) => a - b);
  const minPmix = minMixtureProportion(values.length);
  const splitIndex = Math.max(2, Math.floor(logValues.length / 2));
  const lower = logValues.slice(0, splitIndex);
  const upper = logValues.slice(splitIndex);
  if (lower.length < 2 || upper.length < 2) return null;

  const starts = [
    {
      meanlog1: mean(lower),
      sdlog1: Math.max(standardDeviation(lower), MIN_MIXTURE_SDLOG),
      meanlog2: mean(upper),
      sdlog2: Math.max(standardDeviation(upper), MIN_MIXTURE_SDLOG),
      pmix: 0.5,
    },
    {
      meanlog1: logValues[Math.floor(logValues.length * 0.25)],
      sdlog1: Math.max(standardDeviation(logValues) * 0.6, MIN_MIXTURE_SDLOG),
      meanlog2: logValues[Math.floor(logValues.length * 0.75)],
      sdlog2: Math.max(standardDeviation(logValues) * 0.6, MIN_MIXTURE_SDLOG),
      pmix: 0.5,
    },
  ];

  const candidates = starts
    .map((start) => runLogNormalMixtureEm(logValues, start, minPmix))
    .filter((candidate): candidate is LogNormalMixtureFit => candidate !== null)
    .sort((a, b) => b.logLikelihood - a.logLikelihood);
  const best = candidates[0];
  if (!best) return null;

  const cdf = (value: number) =>
    best.pmix * logNormalCdf(value, best.meanlog1, best.sdlog1) +
    (1 - best.pmix) * logNormalCdf(value, best.meanlog2, best.sdlog2);
  const hcp = solveMonotoneRoot(
    cdf,
    pValue,
    Math.min(...values),
    Math.max(...values),
  );
  const aic = aicFromLogLikelihood(best.logLikelihood, MIXTURE_PARAMETER_COUNT);

  return {
    distribution,
    hcp,
    aic,
    aicc: aiccFromAic(aic, MIXTURE_PARAMETER_COUNT, values.length),
    logLikelihood: best.logLikelihood,
    parameters: [
      { name: 'meanlog1', value: best.meanlog1 },
      { name: 'sdlog1', value: best.sdlog1 },
      { name: 'meanlog2', value: best.meanlog2 },
      { name: 'sdlog2', value: best.sdlog2 },
      { name: 'pmix', value: best.pmix },
    ],
    cdf,
  };
}

function runLogNormalMixtureEm(
  logValues: number[],
  start: {
    meanlog1: number;
    sdlog1: number;
    meanlog2: number;
    sdlog2: number;
    pmix: number;
  },
  minPmix: number,
): LogNormalMixtureFit | null {
  let { meanlog1, meanlog2 } = start;
  let sdlog1 = start.sdlog1;
  let sdlog2 = start.sdlog2;
  let pmix = clamp(start.pmix, minPmix, 1 - minPmix);
  let previousLogLikelihood = Number.NEGATIVE_INFINITY;

  for (let iteration = 0; iteration < 240; iteration += 1) {
    const responsibilities = logValues.map((value) => {
      const first =
        Math.log(pmix) + normalLogDensity(value, meanlog1, sdlog1);
      const second =
        Math.log(1 - pmix) + normalLogDensity(value, meanlog2, sdlog2);
      const total = logSumExp(first, second);
      return Math.exp(first - total);
    });
    const firstWeight = responsibilities.reduce(
      (sum, value) => sum + value,
      0,
    );
    const secondWeight = logValues.length - firstWeight;
    if (firstWeight <= 0 || secondWeight <= 0) return null;

    pmix = clamp(firstWeight / logValues.length, minPmix, 1 - minPmix);
    meanlog1 =
      responsibilities.reduce(
        (sum, responsibility, index) =>
          sum + responsibility * logValues[index],
        0,
      ) / firstWeight;
    meanlog2 =
      responsibilities.reduce(
        (sum, responsibility, index) =>
          sum + (1 - responsibility) * logValues[index],
        0,
      ) / secondWeight;
    sdlog1 = Math.max(
      Math.sqrt(
        responsibilities.reduce(
          (sum, responsibility, index) =>
            sum + responsibility * (logValues[index] - meanlog1) ** 2,
          0,
        ) / firstWeight,
      ),
      MIN_MIXTURE_SDLOG,
    );
    sdlog2 = Math.max(
      Math.sqrt(
        responsibilities.reduce(
          (sum, responsibility, index) =>
            sum + (1 - responsibility) * (logValues[index] - meanlog2) ** 2,
          0,
        ) / secondWeight,
      ),
      MIN_MIXTURE_SDLOG,
    );

    const logLikelihood = mixtureLogLikelihood(
      logValues,
      meanlog1,
      sdlog1,
      meanlog2,
      sdlog2,
      pmix,
    );
    if (Math.abs(logLikelihood - previousLogLikelihood) < 1e-8) break;
    previousLogLikelihood = logLikelihood;
  }

  if (meanlog1 > meanlog2) {
    [meanlog1, meanlog2] = [meanlog2, meanlog1];
    [sdlog1, sdlog2] = [sdlog2, sdlog1];
    pmix = 1 - pmix;
  }

  const logLikelihood = mixtureLogLikelihood(
    logValues,
    meanlog1,
    sdlog1,
    meanlog2,
    sdlog2,
    pmix,
  );
  if (!Number.isFinite(logLikelihood)) return null;
  return { meanlog1, sdlog1, meanlog2, sdlog2, pmix, logLikelihood };
}

function mixtureLogLikelihood(
  logValues: number[],
  meanlog1: number,
  sdlog1: number,
  meanlog2: number,
  sdlog2: number,
  pmix: number,
): number {
  return logValues.reduce((sum, value) => {
    const first = Math.log(pmix) + normalLogDensity(value, meanlog1, sdlog1);
    const second =
      Math.log(1 - pmix) + normalLogDensity(value, meanlog2, sdlog2);
    return sum + logSumExp(first, second) - value;
  }, 0);
}

function fitCandidate(input: CandidateFitInput): SsdDistributionFit | null {
  const fit =
    input.distribution === 'Gamma'
      ? fitGamma(input)
      : input.distribution === 'Log-Gumbel'
        ? fitLogGumbel(input)
        : input.distribution === 'Log-Logistic'
          ? fitLogLogistic(input)
          : input.distribution === 'Log-Normal'
            ? fitLogNormal(input)
            : input.distribution === 'Log-Normal Mixture'
              ? fitLogNormalMixture(input)
              : fitWeibull(input);
  if (!fit || !Number.isFinite(fit.hcp) || fit.hcp <= 0) return null;
  return buildFitResult(fit, input.values);
}

function applyInformationCriterionWeights(
  fits: SsdDistributionFit[],
): SsdDistributionFit[] {
  if (fits.length === 0) return fits;
  const useAicc = fits.some((fit) => Number.isFinite(fit.aicc));
  const criterion = (fit: SsdDistributionFit) =>
    useAicc && Number.isFinite(fit.aicc) ? fit.aicc : fit.aic;
  const finiteCriteria = fits
    .map(criterion)
    .filter((value) => Number.isFinite(value));
  if (finiteCriteria.length === 0) return fits;

  const minCriterion = Math.min(...finiteCriteria);
  const rawWeights = fits.map((fit) => {
    const value = criterion(fit);
    if (!Number.isFinite(value)) return 0;
    return Math.exp(-0.5 * (value - minCriterion));
  });
  const totalWeight = rawWeights.reduce((sum, weight) => sum + weight, 0);

  return fits.map((fit, index) => {
    const value = criterion(fit);
    if (!Number.isFinite(value) || totalWeight <= 0) {
      return { ...fit, deltaAicc: null, weight: 0 };
    }
    const deltaAicc = value - minCriterion;
    return {
      ...fit,
      deltaAicc,
      weight: rawWeights[index] / totalWeight,
    };
  });
}

function reweightActiveFits(fits: SsdDistributionFit[]): SsdDistributionFit[] {
  const totalWeight = fits.reduce((sum, fit) => sum + fit.weight, 0);
  if (totalWeight <= 0) return [];
  return fits.map((fit) => ({ ...fit, weight: fit.weight / totalWeight }));
}

function buildModelAverageCurve(
  values: number[],
  fits: SsdDistributionFit[],
  hcp: number,
): SsdFittedCurvePoint[] {
  if (fits.length === 0) return [];
  const cdf = (value: number) =>
    fits.reduce((sum, fit) => sum + fit.weight * fit.cdf(value), 0);
  return buildCurvePoints(values, 'Model Average', cdf, [hcp]);
}

export function fitSsdDistributions(
  speciesAggregates: SpeciesAggregate[],
  pValue: number,
  distributions: SsdDistribution[] = SSDTOOLS_DISTRIBUTIONS,
): SsdDistributionFit[] {
  assertProbability(pValue);
  const values = getPositiveValues(speciesAggregates);
  if (values.length < MIN_SPECIES_FOR_SSDTOOLS_FIT) return [];
  return applyInformationCriterionWeights(
    distributions
      .map((distribution) => fitCandidate({ distribution, values, pValue }))
      .filter((fit): fit is SsdDistributionFit => fit !== null),
  ).sort((a, b) => b.weight - a.weight);
}

export function fitLogNormalDistribution(
  speciesAggregates: SpeciesAggregate[],
  pValue: number,
): SsdDistributionFit | null {
  return (
    fitSsdDistributions(speciesAggregates, pValue, ['Log-Normal'])[0] ?? null
  );
}

export function buildModelAveragedFit(
  speciesAggregates: SpeciesAggregate[],
  pValue: number,
  deltaCutoff = DEFAULT_SSDTOOLS_HCP_DELTA_CUTOFF,
): SsdModelAverageFit | null {
  const values = getPositiveValues(speciesAggregates);
  const fits = fitSsdDistributions(speciesAggregates, pValue);
  const activeFits = reweightActiveFits(
    fits.filter(
      (fit) =>
        fit.weight > 0 &&
        (fit.deltaAicc === null || Math.abs(fit.deltaAicc) <= deltaCutoff),
    ),
  );
  if (activeFits.length === 0) return null;

  const cdf = (value: number) =>
    activeFits.reduce((sum, fit) => sum + fit.weight * fit.cdf(value), 0);
  const hcp = solveMonotoneRoot(
    cdf,
    pValue,
    Math.min(...values),
    Math.max(...values),
  );

  return {
    hcp,
    curvePoints: buildModelAverageCurve(values, activeFits, hcp),
    fits,
    activeFits,
  };
}
