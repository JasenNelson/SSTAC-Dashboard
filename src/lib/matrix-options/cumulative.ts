// cumulative.ts
// Standalone headless reducers for CUMULATIVE / additive toxicity methods:
//   - computeTEQ:    dioxin-like TEF/TEQ  -- TEQ  = sum(C_i * TEF_i) over congeners.
//   - computeBaPeq:  carcinogenic-PAH RPF -- BaPeq = sum(C_i * RPF_i) over PAHs.
//   - compareEquivalentToStandard: compares a summed equivalent CONCENTRATION to a screening STANDARD.
//
// These are STANDALONE pure utilities, following the utl9595 / avsSemCheck precedent in derivations.ts:
// they are NOT registered in equationDispatch.ts / BASELINE_FUNCTIONS and do NOT extend the
// ProvenancePathway union or any Record<ProvenancePathway,...> map (decision D0 -- zero policy mutation).
// This module is NOT re-exported from derivations.ts (that would edit an existing file and break the
// D0 git-diff proof); consumers import from cumulative.ts directly.
//
// UNIT CONTRACT (load-bearing): TEF/RPF/ADAF are UNITLESS scalars. Every concentration carries its own
// mass/mass unit; the reducer normalizes ALL entries to mg/kg BEFORE summing. Volume-based units
// (ug/L, ...) are BLOCKED (mass/mass media only). The equivalent is reported in mg/kg.
//
// DIMENSIONAL CONTRACT for the compare step: the `standard` MUST be a derived screening standard in a
// mass/mass unit (e.g. the mg/kg `sedS` from humanHealthDirectContact) -- NEVER a raw dose TDI
// (mg/kg-bw/day) or a slope factor. compareEquivalentToStandard rejects a non-mass/mass standard.
//
// Plain ASCII only.

import { lookupTef, type TefEdition, TEF_EDITION_QA } from './tefTable';
import { lookupRpf, type RpfScheme, RPF_SCHEME_NOTES } from './rpfTable';
import { lookupAdaf, ADAF_TABLE } from './adafTable';
import type { RegulatoryFrameId } from './regulatoryFrames';

// ---------------------------------------------------------------------------
// Authority + receptor vocabularies (NEW, cumulative-lane-local -- NOT RegulatoryFrameId, which is a
// set of sediment-comparison frames with no HC / EPA / Ontario authority granularity).
// ---------------------------------------------------------------------------

export const CUMULATIVE_AUTHORITIES = [
  'hc',
  'bc-csr',
  'ccme',
  'us-epa',
  'ontario',
  'fcsap',
] as const;
export type CumulativeAuthority = (typeof CUMULATIVE_AUTHORITIES)[number];

// RPF is human-health-carcinogenic only; fcsap (eco) has no RPF scheme, so it is excluded here.
export type RpfAuthority = Exclude<CumulativeAuthority, 'fcsap'>;

export type CumulativeReceptor = 'mammal' | 'avian' | 'fish' | 'human-health';

/**
 * Best-effort bridge from an existing sediment-comparison RegulatoryFrameId to a cumulative
 * authority. Read-only lookup (no union change). Returns null where a frame has no clean authority
 * mapping (site-specific) -- the caller then selects an authority directly.
 */
export function authorityForFrame(
  frameId: RegulatoryFrameId,
): CumulativeAuthority | null {
  switch (frameId) {
    case 'us-epa-usace-sediment':
      return 'us-epa';
    case 'ccme-sediment-quality':
      return 'ccme';
    case 'bc-protocol1-v5-dra':
    case 'bc-csr-sediment-numerical':
      return 'bc-csr';
    case 'canada-fcsap-aquatic':
      return 'fcsap';
    case 'site-specific':
      return null;
    default: {
      // Exhaustiveness guard: a new frame id must be mapped explicitly.
      const _never: never = frameId;
      return _never;
    }
  }
}

// ---------------------------------------------------------------------------
// Edition / scheme selection.
// ---------------------------------------------------------------------------

/**
 * RECEPTOR-AWARE TEF edition selection. TEF editions are taxa-specific, so a frame-only map cannot
 * work (CCME/FCSAP need mammal/avian/fish simultaneously by receptor).
 * NOTE: only the HC (DeVito-2024) edition is primary-verified; the other mappings are research-
 * derived and pending framework-A2 verification (the tefTable qa flags carry this).
 */
export function resolveTefEdition(
  authority: CumulativeAuthority,
  receptor: CumulativeReceptor,
): TefEdition {
  if (authority === 'hc' && receptor === 'human-health') {
    return 'who-2022-devito-2024';
  }
  if (receptor === 'human-health') {
    // hc handled above; bc-csr / us-epa / ontario human-health -> WHO-2005;
    // ccme / fcsap human-health -> WHO-1998 mammalian.
    if (authority === 'ccme' || authority === 'fcsap') return 'who-1998-mammal';
    return 'who-2005';
  }
  // Eco receptors (ccme / fcsap and any eco use): taxa-specific WHO-1998.
  switch (receptor) {
    case 'mammal':
      return 'who-1998-mammal';
    case 'avian':
      return 'who-1998-avian';
    case 'fish':
      return 'who-1998-fish';
    default:
      return 'who-2005';
  }
}

// RPF scheme by authority (frame-only; human-health-carcinogenic only). fcsap excluded by type.
// D4 (owner-approved, 2026-07-07): BC TG-7 (2017) remap -- bc-csr now maps to ccme-2010 (the
// verified 8-PAH CCME scheme), NOT who-1998-pah. who-1998-pah is DEPRECATED-BUT-UNUSED: its type
// and RPF table row are kept (other code/tests may reference it) but no authority maps to it
// anymore. It remains in RPF_SCHEME_SCORING_BLOCKED below as inert safety (harmless now that
// nothing scores against it) -- this is a deliberate leave-in-place, not an oversight.
export const RPF_SCHEME_BY_AUTHORITY: Record<RpfAuthority, RpfScheme> = {
  hc: 'hc-pqra-v3',
  'bc-csr': 'ccme-2010',
  ccme: 'ccme-2010',
  'us-epa': 'epa-2010-draft',
  ontario: 'ccme-2010',
};

// Schemes that are NOT safe to score yet (a warning is not enough for a screening tool -- a caller
// that ignores warnings would over/under-sum). computeBaPeq BLOCKS these. who-1998-pah is retained
// here as inert safety even though it is now unused by RPF_SCHEME_BY_AUTHORITY (D4 remap, BC TG-7
// 2017); its 5-PAH subset was never verified (framework-A2) so it must never be scored if some
// future caller reintroduces it. Remove a scheme from this set only after its data is verified.
export const RPF_SCHEME_SCORING_BLOCKED: ReadonlySet<RpfScheme> = new Set<RpfScheme>([
  'who-1998-pah',
]);

// ---------------------------------------------------------------------------
// Unit normalization -- mass/mass only, canonical mg/kg. (Deliberately NOT reusing
// unitNormalization.ts::normalizeToBase, which is dose/air-oriented and fails closed on mg/kg + has
// no pg prefix.)
// ---------------------------------------------------------------------------

export const CANONICAL_UNIT = 'mg/kg';

// numerator prefix -> mg; denominator prefix -> kg.
const NUM_TO_MG: Record<string, number> = {
  pg: 1e-9,
  ng: 1e-6,
  ug: 1e-3,
  mcg: 1e-3,
  mg: 1,
  g: 1e3,
};
const DEN_TO_KG: Record<string, number> = {
  g: 1e-3,
  kg: 1,
};
const VOLUME_DENOMINATORS = new Set(['l', 'ml', 'dl', 'm3', 'l-1']);

export interface NormalizedConcentration {
  valueMgPerKg: number | null;
  blocked: boolean;
  warning: string | null;
}

function canon(u: string): string {
  return (u ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Normalize a mass/mass concentration to mg/kg. Blocks (never silently coerces) on: a missing /
 * unrecognized unit, a volume-based denominator (mass/mass media only), or a non-finite value.
 */
export function normalizeConcentration(
  value: number,
  fromUnit: string,
): NormalizedConcentration {
  if (!Number.isFinite(value)) {
    return { valueMgPerKg: null, blocked: true, warning: `Non-finite concentration ${value}.` };
  }
  if (value < 0) {
    // Concentrations (and non-detect substitutions) are non-negative; a negative row would offset
    // valid positive contributions and understate the equivalent. Fail closed.
    return { valueMgPerKg: null, blocked: true, warning: `Negative concentration ${value} not allowed.` };
  }
  const u = canon(fromUnit);
  if (!u) {
    return { valueMgPerKg: null, blocked: true, warning: 'Missing concentration unit.' };
  }
  const parts = u.split('/');
  if (parts.length !== 2) {
    return {
      valueMgPerKg: null,
      blocked: true,
      warning: `Unrecognized unit "${fromUnit}" (expected mass/mass like mg/kg, ug/kg, pg/g).`,
    };
  }
  const [num, den] = parts;
  if (VOLUME_DENOMINATORS.has(den)) {
    return {
      valueMgPerKg: null,
      blocked: true,
      warning: `Volume-based unit "${fromUnit}" not supported; mass/mass media only.`,
    };
  }
  const numFactor = NUM_TO_MG[num];
  const denFactor = DEN_TO_KG[den];
  if (numFactor === undefined || denFactor === undefined) {
    return {
      valueMgPerKg: null,
      blocked: true,
      warning: `Unrecognized mass/mass unit "${fromUnit}".`,
    };
  }
  return {
    valueMgPerKg: value * (numFactor / denFactor),
    blocked: false,
    warning: null,
  };
}

function isMassPerMassUnit(unit: string): boolean {
  const u = canon(unit);
  const parts = u.split('/');
  if (parts.length !== 2) return false;
  const [num, den] = parts;
  return NUM_TO_MG[num] !== undefined && DEN_TO_KG[den] !== undefined;
}

// ---------------------------------------------------------------------------
// Shared contribution + result shapes (D2 provenance-contribution row).
// ---------------------------------------------------------------------------

export interface CumulativeContributionRow {
  componentId: string; // congenerId or pahKey
  concentration: number; // as entered
  unit: string; // as entered
  concentrationNorm: number | null; // mg/kg
  factor: number | null; // TEF or RPF
  factorBound: 'exact' | 'upper' | null; // censored-< qualifier (TEF only; null for RPF)
  scheme: string; // TefEdition or RpfScheme
  contribution: number | null; // concentrationNorm * factor, in mg/kg
  contributionUnit: string; // 'mg/kg'
  factorSourceQa: 'verified' | 'needs_review' | null;
}

export interface CumulativeResult {
  equivalent: number; // in mg/kg
  equivalentUnit: string; // 'mg/kg'
  contributions: CumulativeContributionRow[];
  warnings: string[];
  blocked: boolean;
}

export interface TeqEntry {
  congenerId: string;
  concentration: number;
  unit: string;
  isNonDetect?: boolean;
  mdl?: number;
  mdlUnit?: string;
}

export interface TeqOptions {
  // multiplier for non-detects applied to the MDL (default 0.5 = half the detection limit).
  nonDetectFraction?: number;
}

/**
 * TEQ = sum(C_i * TEF_i). Normalizes each congener concentration to mg/kg, applies the edition's TEF,
 * and sums. Non-detects are substituted with nonDetectFraction * MDL (default 0.5). Unknown congeners,
 * unknown editions, blocked units, and censored (upper-bound) TEFs are surfaced via warnings; a
 * component is never silently dropped or coerced to 0.
 */
export function computeTEQ(
  entries: readonly TeqEntry[],
  edition: TefEdition,
  opts: TeqOptions = {},
): CumulativeResult {
  const warnings: string[] = [];
  const contributions: CumulativeContributionRow[] = [];
  const ndFraction = opts.nonDetectFraction ?? 0.5;

  // Surface the edition's QA level in warnings (parallels the RPF needs_review warning) so a caller
  // that only reads `equivalent` + `warnings` (not each contribution row's qa) still sees that a
  // non-primary-verified TEF edition was used.
  if (TEF_EDITION_QA[edition] === 'needs_review') {
    warnings.push(
      `TEF edition ${edition} is needs_review (not primary-source verified; framework-A2 pending).`,
    );
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      equivalent: 0,
      equivalentUnit: CANONICAL_UNIT,
      contributions: [],
      // Preserve any edition-QA warning already pushed (codex): the needs_review guarantee must hold
      // even on the empty-input fail-closed path for callers reading only equivalent + warnings.
      warnings: [...warnings, 'No congener entries supplied; TEQ is 0 by vacuous sum (verify this is intended).'],
      blocked: true,
    };
  }

  let sum = 0;
  for (const e of entries) {
    const look = lookupTef(e.congenerId, edition);
    if (look.warning) warnings.push(look.warning);

    // Resolve the concentration (non-detect substitution first).
    let rawValue = e.concentration;
    let rawUnit = e.unit;
    if (e.isNonDetect) {
      if (e.mdl === undefined || !Number.isFinite(e.mdl)) {
        warnings.push(`Congener "${e.congenerId}" is non-detect but has no MDL; component not scored.`);
        contributions.push(buildRow(e.congenerId, e.concentration, e.unit, null, look.factor, look.bound, edition, look.qa));
        continue;
      }
      rawValue = ndFraction * e.mdl;
      rawUnit = e.mdlUnit ?? e.unit;
    }

    const norm = normalizeConcentration(rawValue, rawUnit);
    if (norm.warning) warnings.push(`Congener "${e.congenerId}": ${norm.warning}`);

    if (norm.blocked || norm.valueMgPerKg === null || look.factor === null) {
      // Fail closed: record the row but do not add to the sum.
      contributions.push(buildRow(e.congenerId, e.concentration, e.unit, norm.valueMgPerKg, look.factor, look.bound, edition, look.qa));
      continue;
    }

    const contribution = norm.valueMgPerKg * look.factor;
    sum += contribution;
    contributions.push({
      componentId: e.congenerId,
      concentration: e.concentration,
      unit: e.unit,
      concentrationNorm: norm.valueMgPerKg,
      factor: look.factor,
      factorBound: look.bound,
      scheme: edition,
      contribution,
      contributionUnit: CANONICAL_UNIT,
      factorSourceQa: look.qa,
    });
  }

  // A component with contribution === null could NOT be scored (unknown congener, blocked/negative
  // unit, or non-detect without an MDL). Any such skip makes the TEQ an UNDERESTIMATE, so the result
  // is blocked (fail closed) -- downstream must not treat an incomplete TEQ as a complete standard.
  const skipped = contributions.filter((c) => c.contribution === null);
  if (skipped.length > 0) {
    warnings.push(
      `${skipped.length} of ${contributions.length} congener(s) could not be scored; TEQ is an ` +
        `underestimate and is blocked (fail-closed).`,
    );
  }
  return {
    equivalent: sum,
    equivalentUnit: CANONICAL_UNIT,
    contributions,
    warnings,
    blocked: skipped.length > 0,
  };
}

export interface BaPeqEntry {
  pahKey: string;
  concentration: number;
  unit: string;
}

export interface BaPeqOptions {
  // Optional ADAF (Age-Dependent Adjustment Factor) application for a mutagenic-MoA carcinogen
  // (benzo[a]pyrene). ADAF ANCHOR-PAIRING CONTRACT (load-bearing -- a mispairing is a 3x-10x error for
  // a child-exposure window):
  //   - HC v4.0 SF 1.289 and EPA IRIS adult SF 1.0 are ADULT-based, NON-ADAF-embedded -> ADAF is
  //     applied ON TOP (applyAdaf: true). (HC v4.0, 2025, added an ADAF-application note; HC gives no
  //     pre-baked lifetime equivalent.)
  //   - EPA IRIS lifetime SF 2.0 already has ADAFs BAKED IN (0-70yr exposure-duration-weighted) ->
  //     applyAdaf MUST be false, or you double-count.
  //   The caller (UI/anchor selector) owns pairing the chosen anchor with the correct applyAdaf value.
  // SINGLE-BIN SCOPE (not lifetime weighting): this applies ONE age bin's ADAF factor
  // (ageYears -> 10 / 3 / 1) as a scalar. It does NOT perform the lifetime multi-window,
  // exposure-duration-weighted averaging that a full 0-70yr scenario requires -- a caller that needs a
  // lifetime-integrated estimate must weight the per-age-window results itself (e.g. call per bin and
  // duration-weight), NOT call this once for a multi-decade exposure. See
  // docs/MATRIX_OPTIONS_ADAF_BAP_EXPLAINER_2026_07_07.md.
  applyAdaf?: boolean;
  ageYears?: number;
}

/**
 * BaPeq = sum(C_i * RPF_i), optionally x ADAF (age-binned). Dermal RAF is NOT applied here -- dermal
 * absorption belongs to the exposure/standard derivation (humanHealthDirectContact abs_dermal), and
 * applying it to both the concentration and the standard would double-count. Excluded PAHs contribute
 * 0 with an informational warning; not-defined PAHs fail closed (not scored, not coerced to 0).
 */
export function computeBaPeq(
  entries: readonly BaPeqEntry[],
  scheme: RpfScheme,
  opts: BaPeqOptions = {},
): CumulativeResult {
  const warnings: string[] = [];
  const contributions: CumulativeContributionRow[] = [];

  const schemeNote = RPF_SCHEME_NOTES[scheme];
  if (schemeNote) warnings.push(`Scheme ${scheme}: ${schemeNote}`);

  // Fail closed for schemes not yet safe to score (e.g. the BC who-1998-pah placeholder whose 5-PAH
  // subset is unverified). A warning alone is not enough for a screening tool -- BLOCK so a caller
  // that ignores warnings cannot ship an over-summed BaP-eq.
  if (RPF_SCHEME_SCORING_BLOCKED.has(scheme)) {
    return {
      equivalent: 0,
      equivalentUnit: CANONICAL_UNIT,
      contributions: [],
      warnings: [
        ...warnings,
        `Scheme ${scheme} is not verified for scoring yet (framework-A2 pending); BaP-eq is blocked (fail-closed).`,
      ],
      blocked: true,
    };
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      equivalent: 0,
      equivalentUnit: CANONICAL_UNIT,
      contributions: [],
      warnings: [...warnings, 'No PAH entries supplied; BaPeq is 0 by vacuous sum (verify intended).'],
      blocked: true,
    };
  }

  let adaf = 1;
  let adafBlocked = false;
  if (opts.applyAdaf) {
    const a = lookupAdaf(opts.ageYears ?? Number.NaN);
    if (a.adaf === null) {
      // The caller explicitly requested age-binned ADAF but the age is missing/invalid. Silently
      // using 1 would UNDERWEIGHT a child exposure by 3x-10x; fail closed instead.
      adafBlocked = true;
      warnings.push(`ADAF requested but ${a.warning}; BaP-eq is blocked (fail-closed) rather than applying ADAF = 1.`);
    } else {
      adaf = a.adaf;
      warnings.push(
        `ADAF ${a.adaf} applied for a SINGLE age bin (${a.ageBin}). Ensure the anchor SF is NOT already ` +
          `ADAF-adjusted (do NOT use with EPA lifetime 2.0). A lifetime (0-70yr) estimate needs ` +
          `per-age-window duration-weighting by the caller -- this call does not lifetime-weight.`,
      );
    }
  }

  let sum = 0;
  for (const e of entries) {
    const look = lookupRpf(e.pahKey, scheme);
    if (look.warning) warnings.push(look.warning);

    const norm = normalizeConcentration(e.concentration, e.unit);
    if (norm.warning) warnings.push(`PAH "${e.pahKey}": ${norm.warning}`);

    // 'excluded' -> rpf 0 (contributes 0, intentional). 'not-defined' / unknown -> rpf null (skip).
    if (norm.blocked || norm.valueMgPerKg === null || look.rpf === null) {
      contributions.push(buildRow(e.pahKey, e.concentration, e.unit, norm.valueMgPerKg, look.rpf, null, scheme, look.qa));
      continue;
    }

    const contribution = norm.valueMgPerKg * look.rpf * adaf;
    sum += contribution;
    contributions.push({
      componentId: e.pahKey,
      concentration: e.concentration,
      unit: e.unit,
      concentrationNorm: norm.valueMgPerKg,
      factor: look.rpf,
      factorBound: null,
      scheme,
      contribution,
      contributionUnit: CANONICAL_UNIT,
      factorSourceQa: look.qa,
    });
  }

  // Distinguish SKIPPED (contribution === null: unknown/not-defined PAH, blocked/negative unit) from
  // valid ZERO (an excluded non-carcinogenic PAH has contribution 0, which is a correct 0). A dataset
  // of only excluded PAHs is a valid BaP-eq of 0, NOT blocked. Any skipped component makes the sum an
  // underestimate -> blocked. An unresolved ADAF request also blocks.
  const skipped = contributions.filter((c) => c.contribution === null);
  if (skipped.length > 0) {
    warnings.push(
      `${skipped.length} of ${contributions.length} PAH(s) could not be scored; BaP-eq is an ` +
        `underestimate and is blocked (fail-closed).`,
    );
  }
  return {
    equivalent: sum,
    equivalentUnit: CANONICAL_UNIT,
    contributions,
    warnings,
    blocked: adafBlocked || skipped.length > 0,
  };
}

function buildRow(
  id: string,
  concentration: number,
  unit: string,
  concentrationNorm: number | null,
  factor: number | null,
  factorBound: 'exact' | 'upper' | null,
  scheme: string,
  qa: 'verified' | 'needs_review' | null,
): CumulativeContributionRow {
  return {
    componentId: id,
    concentration,
    unit,
    concentrationNorm,
    factor,
    factorBound,
    scheme,
    contribution: null,
    contributionUnit: CANONICAL_UNIT,
    factorSourceQa: qa,
  };
}

// ---------------------------------------------------------------------------
// Lifetime multi-window ADAF weighting. computeBaPeq (above) applies exactly ONE age bin's ADAF as a
// scalar per call (see BaPeqOptions.applyAdaf SINGLE-BIN SCOPE note). A full lifetime (e.g. 0-70yr)
// scenario instead needs an exposure-duration-weighted average across every age bin the receptor
// passes through. This is standard EPA (2005) lifetime ADAF methodology: effective ADAF =
// sum(ADAF_bin * fraction-of-averaging-period-in-bin), applied ONCE to the no-ADAF (ADAF = 1) BaP-eq.
// ---------------------------------------------------------------------------

// Bin-label union mirroring ADAF_TABLE's row labels. adafTable.ts types AdafRow.ageBin as `string`
// (it exports no literal union for the bin label), so this alias is declared here rather than
// re-derived via typeof, and every value is validated against ADAF_TABLE at runtime (fail-closed on
// an unknown label) inside computeBaPeqLifetime below.
export type AdafBin = '0-<2' | '2-<16' | '16+';

export interface AgeBinFraction {
  ageBin: AdafBin;
  // Fraction of the averaging period spent in this bin. All fractions across the ageBins array must
  // sum to 1.0 (within epsilon 1e-6).
  exposureFraction: number;
}

function adafForBin(bin: AdafBin): number | null {
  const row = ADAF_TABLE.find((r) => r.ageBin === bin);
  return row ? row.adaf : null;
}

function blockedLifetimeResult(reason: string): CumulativeResult {
  return {
    equivalent: 0,
    equivalentUnit: CANONICAL_UNIT,
    contributions: [],
    warnings: [reason],
    blocked: true,
  };
}

/**
 * Lifetime multi-window ADAF-weighted BaP-eq: sum(C_i * RPF_i) x effective-lifetime-ADAF, where the
 * effective ADAF = sum(ADAF(bin) * bin.exposureFraction) over every age bin the receptor passes
 * through during the averaging period. Unlike computeBaPeq's single-bin applyAdaf (one age -> one
 * scalar), this weights ACROSS bins for a full-lifetime scenario -- same anchor-pairing contract as
 * BaPeqOptions.applyAdaf applies here too: never call this with an anchor SF that already embeds
 * ADAFs (e.g. EPA IRIS lifetime CSF 2.0); pair it only with an adult-only / non-ADAF-embedded anchor.
 *
 * Computes the NO-ADAF base via computeBaPeq(entries, scheme, {}) (ADAF = 1), then scales the total
 * and each scored contribution row by the effective lifetime ADAF -- mirroring exactly how
 * computeBaPeq applies its single scalar (contribution = concentrationNorm * factor * adaf; the
 * `factor` field itself is never scaled, only `contribution` and the summed `equivalent`).
 *
 * Fail-closed (never throws): empty ageBins; any exposureFraction non-finite, negative, or > 1;
 * fractions not summing to 1.0 within epsilon 1e-6; an unknown or duplicate ageBin; or a base BaP-eq
 * that is already blocked (propagated unchanged).
 */
export function computeBaPeqLifetime(
  entries: readonly BaPeqEntry[],
  scheme: RpfScheme,
  ageBins: readonly AgeBinFraction[],
): CumulativeResult {
  const base = computeBaPeq(entries, scheme, {});
  if (base.blocked) return base;

  if (!Array.isArray(ageBins) || ageBins.length === 0) {
    return blockedLifetimeResult('No age bins supplied; lifetime BaP-eq is blocked (fail-closed).');
  }

  const seenBins = new Set<string>();
  let fractionSum = 0;
  for (const b of ageBins) {
    if ((b as unknown) === null || typeof (b as unknown) !== 'object') {
      return blockedLifetimeResult(
        'Malformed age bin entry (null or non-object); lifetime BaP-eq is blocked (fail-closed).',
      );
    }
    if (!Number.isFinite(b.exposureFraction) || b.exposureFraction < 0 || b.exposureFraction > 1) {
      return blockedLifetimeResult(
        `Age bin "${b.ageBin}" has an invalid exposureFraction ${b.exposureFraction} (must be a ` +
          'finite number >= 0 and <= 1); lifetime BaP-eq is blocked (fail-closed).',
      );
    }
    if (seenBins.has(b.ageBin)) {
      return blockedLifetimeResult(
        `Duplicate age bin "${b.ageBin}" supplied; lifetime BaP-eq is blocked (fail-closed).`,
      );
    }
    seenBins.add(b.ageBin);
    fractionSum += b.exposureFraction;
  }

  if (Math.abs(fractionSum - 1.0) > 1e-6) {
    return blockedLifetimeResult(
      `Age bin exposureFractions sum to ${fractionSum}, not 1.0 (epsilon 1e-6); lifetime BaP-eq is ` +
        'blocked (fail-closed).',
    );
  }

  let effectiveAdaf = 0;
  for (const b of ageBins) {
    const adaf = adafForBin(b.ageBin);
    if (adaf === null) {
      return blockedLifetimeResult(
        `Unknown age bin "${b.ageBin}" not found in ADAF_TABLE; lifetime BaP-eq is blocked (fail-closed).`,
      );
    }
    effectiveAdaf += adaf * b.exposureFraction;
  }

  const contributions = base.contributions.map((c) =>
    c.contribution === null ? c : { ...c, contribution: c.contribution * effectiveAdaf },
  );

  return {
    equivalent: base.equivalent * effectiveAdaf,
    equivalentUnit: base.equivalentUnit,
    contributions,
    warnings: [
      ...base.warnings,
      `Lifetime multi-window ADAF ${effectiveAdaf} applied (exposure-duration-weighted sum over ` +
        `${ageBins.length} age bin(s)). Ensure the anchor SF is NOT already ADAF-adjusted (do NOT ` +
        'use with EPA lifetime 2.0).',
    ],
    blocked: false,
  };
}

// ---------------------------------------------------------------------------
// Compare step (D1). The standard MUST be a derived screening standard in a mass/mass unit
// (e.g. the mg/kg sedS from humanHealthDirectContact) -- NEVER a raw dose TDI or slope factor.
// ---------------------------------------------------------------------------

export interface QuantityWithUnit {
  value: number;
  unit: string;
}

export interface CompareResult {
  verdict: 'PASS' | 'FAIL' | null;
  marginRatio: number | null; // equivalent / standard (both mg/kg); >1 means exceedance
  blocked: boolean;
  warning: string | null;
}

/**
 * Compare a summed equivalent concentration to a screening standard. Both MUST be mass/mass; the
 * standard MUST NOT be a raw dose (mg/kg-bw/day) or a slope factor -- those are dimensionally
 * incomparable to a concentration and are rejected (blocked). Normalizes both to mg/kg first.
 */
export function compareEquivalentToStandard(
  equivalent: QuantityWithUnit,
  standard: QuantityWithUnit,
): CompareResult {
  // Guard against a raw dose / slope standard slipping in.
  const stdUnitCanon = canon(standard.unit);
  if (stdUnitCanon.includes('day') || stdUnitCanon.includes('-1') || stdUnitCanon.includes(')-1')) {
    return {
      verdict: null,
      marginRatio: null,
      blocked: true,
      warning: `Standard unit "${standard.unit}" looks like a dose/slope factor; the compare step needs a derived mass/mass screening standard (e.g. mg/kg sedS), not a raw TDI/SF.`,
    };
  }
  if (!isMassPerMassUnit(standard.unit)) {
    return {
      verdict: null,
      marginRatio: null,
      blocked: true,
      warning: `Standard unit "${standard.unit}" is not a mass/mass concentration; cannot compare.`,
    };
  }
  const eq = normalizeConcentration(equivalent.value, equivalent.unit);
  const std = normalizeConcentration(standard.value, standard.unit);
  if (eq.blocked || eq.valueMgPerKg === null) {
    return { verdict: null, marginRatio: null, blocked: true, warning: `Equivalent: ${eq.warning}` };
  }
  if (std.blocked || std.valueMgPerKg === null) {
    return { verdict: null, marginRatio: null, blocked: true, warning: `Standard: ${std.warning}` };
  }
  if (std.valueMgPerKg <= 0) {
    return { verdict: null, marginRatio: null, blocked: true, warning: 'Standard must be > 0.' };
  }
  const ratio = eq.valueMgPerKg / std.valueMgPerKg;
  return {
    verdict: eq.valueMgPerKg <= std.valueMgPerKg ? 'PASS' : 'FAIL',
    marginRatio: ratio,
    blocked: false,
    warning: null,
  };
}
