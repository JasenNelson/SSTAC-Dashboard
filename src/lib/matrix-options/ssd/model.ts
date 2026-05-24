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
  aicc: number | null;
  logLikelihood: number;
  parameters: SsdModelParameter[];
  curvePoints: SsdFittedCurvePoint[];
}

const SQRT_TWO_PI = Math.sqrt(2 * Math.PI);
const LOG_NORMAL_PARAMETER_COUNT = 2;
const DEFAULT_CURVE_POINT_COUNT = 80;

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
  if (!Number.isFinite(p) || p <= 0 || p >= 1) {
    throw new RangeError('Probability must be between 0 and 1.');
  }

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

function buildLogNormalCurve(
  values: number[],
  mu: number,
  sigma: number,
): SsdFittedCurvePoint[] {
  const sortedValues = [...values].sort((a, b) => a - b);
  const minLog = Math.log(sortedValues[0]);
  const maxLog = Math.log(sortedValues[sortedValues.length - 1]);

  if (minLog === maxLog) return [];

  return Array.from({ length: DEFAULT_CURVE_POINT_COUNT }, (_, index) => {
    const fraction = index / (DEFAULT_CURVE_POINT_COUNT - 1);
    const logValue = minLog + (maxLog - minLog) * fraction;
    return {
      distribution: 'Log-Normal' as const,
      value: Math.exp(logValue),
      percentAffected: standardNormalCdf((logValue - mu) / sigma) * 100,
    };
  });
}

export function fitLogNormalDistribution(
  speciesAggregates: SpeciesAggregate[],
  pValue: number,
): SsdDistributionFit | null {
  const values = speciesAggregates
    .map((aggregate) => aggregate.value)
    .filter((value) => Number.isFinite(value) && value > 0);
  if (values.length < LOG_NORMAL_PARAMETER_COUNT + 2) return null;

  const logValues = values.map((value) => Math.log(value));
  const mu =
    logValues.reduce((sum, value) => sum + value, 0) / logValues.length;
  const variance =
    logValues.reduce((sum, value) => sum + (value - mu) ** 2, 0) /
    logValues.length;
  const sigma = Math.sqrt(variance);
  if (!Number.isFinite(sigma) || sigma <= 0) return null;

  const logLikelihood = values.reduce((sum, value, index) => {
    const z = (logValues[index] - mu) / sigma;
    return sum - Math.log(value * sigma * SQRT_TWO_PI) - (z * z) / 2;
  }, 0);
  const aic = 2 * LOG_NORMAL_PARAMETER_COUNT - 2 * logLikelihood;
  const aicc =
    values.length > LOG_NORMAL_PARAMETER_COUNT + 1
      ? aic +
        (2 * LOG_NORMAL_PARAMETER_COUNT * (LOG_NORMAL_PARAMETER_COUNT + 1)) /
          (values.length - LOG_NORMAL_PARAMETER_COUNT - 1)
      : null;
  const hcp = Math.exp(mu + sigma * inverseStandardNormal(pValue));

  return {
    distribution: 'Log-Normal',
    hcp,
    aic,
    aicc,
    logLikelihood,
    parameters: [
      { name: 'meanlog', value: mu },
      { name: 'sdlog', value: sigma },
    ],
    curvePoints: buildLogNormalCurve(values, mu, sigma),
  };
}
