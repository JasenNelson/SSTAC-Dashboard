// Shared magnitude-aware number formatter for the Matrix Options
// calculator UI. Plain ASCII only.
//
// Why this exists (P1-1, adversarial UI QA audit 2026-08-14): the adjusted
// standard was formatted with .toFixed(4) in some slots and
// .toPrecision(4) in others, for THE SAME value. Real screening standards
// in this codebase live well below 1 (the repo's own derivation tests
// assert values like 0.000098592, 0.0001337, 0.000243 mg/kg dry), so the
// two approaches disagreed: the same governing value rendered as
// "0.00009859" in one slot and "0.0001" in the adjacent one, and any value
// below 5e-5 rendered as "0.0000" under .toFixed(4) -- a real, non-zero
// screening standard displayed as zero.
//
// The first fix moved everything to .toPrecision(4) (4 significant
// figures) everywhere. That solved the "displays as zero" bug, but it
// introduced a SECOND, opposite regression (P1-1b, same audit pass): for
// normal-magnitude values, 4 significant figures is LESS precise than the
// 4 decimal places .toFixed(4) used to give. 5.7516 (5 sig figs under
// toFixed(4)) rendered as "5.752" -- a real digit of a displayed
// regulatory number silently dropped. 10 rendered as "10.00" instead of
// "10.0000". Raising the significant-figure count is not the fix either:
// it would reintroduce trailing-zero artefacts on genuinely small values
// (0.00003 -> "0.00003000" already carries the "right" number of
// trailing zeros for 4 sig figs; a higher count just moves the artefact
// around) and still would not reproduce toFixed(4)'s exact string for
// 5.7516 without coincidence.
//
// The actual fix: pick the format per value, by whichever one is at least
// as precise as the historical .toFixed(4) display, and never let a
// nonzero value collapse to zero.
//
//   - .toFixed(LEGACY_DECIMAL_PLACES) is used whenever it is guaranteed to
//     carry AT LEAST `significantFigures` significant digits. For the
//     default (4 decimal places, 4 significant figures) that holds for any
//     |value| >= 0.1: at 0.1 and above, the first nonzero digit lands at
//     the tenths place or higher, so 4 decimal places always keep 4+
//     significant digits (0.1000 -> 4; 5.7516 -> 5; 10.0000 -> 6;
//     1234567.0000 -> 11). In this branch the output is BYTE-IDENTICAL to
//     the pre-toPrecision display -- nothing about the "normal magnitude"
//     case regresses.
//   - .toPrecision(significantFigures) is used below that threshold, where
//     .toFixed(4) would have started dropping significant digits (0.01234
//     -> "0.0123", losing the trailing 4 -- 3 sig figs, not 4) or, further
//     down, collapsing to "0.0000" entirely. toPrecision is magnitude-
//     aware by construction: its digit budget always attaches to the
//     first significant digit, wherever it falls, so a nonzero input can
//     never round to "0" or "0.0000" through this path. For VERY SMALL
//     magnitudes this branch does fall back to exponential notation on its
//     own (ECMA-262 defines toPrecision that way once the exponent drops
//     below -6, e.g. 0.0000001 -> "1.000e-7", while 0.000001 still prints
//     as "0.000001000") -- but this is a property of the small-value
//     branch only. It does NOT extend to large magnitudes: values at or
//     above fixedDecimalThreshold take the .toFixed(4) branch above, and
//     toFixed never produces exponential notation below 1e21 -- see the
//     UPPER_EXPONENTIAL_THRESHOLD note below for how very large magnitudes
//     are handled instead.
//
//   - A THIRD branch, above UPPER_EXPONENTIAL_THRESHOLD (1e9), returns
//     .toExponential(significantFigures - 1). Real screening standards,
//     UTLs, and cumulative-effects equivalents in this codebase are
//     mg/kg-scale values well under 1e6 (see the derivation tests and
//     cumulative.ts); 1e9 is chosen to sit far above any plausible real
//     value so this branch never fires for genuine regulatory numbers --
//     it exists only to keep a pathological/mistyped input (e.g. a stray
//     extra digit in a concentration field) from rendering as a
//     20+-character run of digits in a fixed-width UI cell.
//
// Boundary check (both directions of the threshold, so there is no visible
// jump in digit count at the seam): at exactly the threshold (0.1),
// toFixed(4) gives "0.1000". Just below it (0.099999), toPrecision(4)
// rounds to the same string, "0.1000" -- the two branches agree at the
// seam. One decade further out (0.0999, safely below threshold),
// toPrecision(4) gives "0.09990": still 4 significant digits, still reads
// as one continuous digit budget, no sudden gain or loss of precision.
//
// The threshold generalises to a caller-chosen `significantFigures` via
// FIXED_DECIMAL_THRESHOLD = 10 ** -(LEGACY_DECIMAL_PLACES - significantFigures + 1):
// asking for fewer significant figures widens the range where the exact
// legacy .toFixed(4) string is reproduced (fewer digits are needed to hit
// the requested precision); asking for more narrows it. At the default
// significantFigures = LEGACY_DECIMAL_PLACES = 4, this reduces to 0.1.

export const DEFAULT_SIGNIFICANT_FIGURES = 4;

/** Decimal places the legacy (pre-P1-1) formatter used. Fixed, not
 * caller-configurable -- it defines what "matches the old display"
 * means, independent of the caller's chosen significant-figure count. */
const LEGACY_DECIMAL_PLACES = 4;

/** Above this magnitude, switch to exponential notation instead of a long
 * toFixed(4) decimal string. Chosen far above any real mg/kg screening
 * standard, UTL, or cumulative-effects equivalent in this codebase (see
 * the module doc comment); it exists only to bound display width for a
 * pathological/mistyped input, never to affect a genuine regulatory
 * value. */
const UPPER_EXPONENTIAL_THRESHOLD = 1e9;

export interface FormatMagnitudeOptions {
  /** Returned as-is for null/undefined/non-finite input. Default "--". */
  placeholder?: string;
  /** Number of significant digits to keep in the small-magnitude branch.
   * Also used to derive the fixed-vs-significant-figure threshold; see
   * the module doc comment. Default 4. */
  significantFigures?: number;
}

/**
 * Format a number for display with magnitude-aware precision.
 *
 * - null / undefined / NaN / +-Infinity -> the caller-supplied placeholder
 *   (default "--"), never the string "NaN" or "0".
 * - 0 -> "0" (toFixed/toPrecision on 0 would print "0.0000" / "0.000",
 *   technically correct but noisy for a value that is exactly, not
 *   approximately, zero).
 * - |value| >= the fixed-decimal threshold (0.1 at the default precision)
 *   -> value.toFixed(4), IDENTICAL to the pre-P1-1 display. This is the
 *   "normal magnitude" case (screening standards, UTLs, and similar
 *   displayed values of 0.1 and up): four decimal places always carries
 *   at least `significantFigures` significant digits here, so nothing is
 *   lost relative to the historical .toFixed(4) behaviour.
 * - |value| below that threshold (and below UPPER_EXPONENTIAL_THRESHOLD,
 *   see next bullet) -> value.toPrecision(significantFigures). This is the
 *   regime where .toFixed(4) used to either lose significant digits or
 *   collapse a real value to "0.0000"; toPrecision keeps the requested
 *   number of significant digits no matter how small the value is, and
 *   for very small magnitudes (below roughly 1e-6) falls back to
 *   exponential notation on its own (ECMA-262 toPrecision behaviour).
 * - |value| >= UPPER_EXPONENTIAL_THRESHOLD (1e9) -> exponential notation
 *   via value.toExponential(significantFigures - 1), REGARDLESS of the
 *   fixed-decimal threshold above. This branch is checked first: without
 *   it, a large magnitude would take the toFixed(4) branch and never
 *   produce exponential notation below 1e21, rendering as a very long
 *   decimal string instead. No real value in this codebase's screening
 *   standards, UTLs, or cumulative-effects equivalents approaches 1e9
 *   (see module doc comment), so this branch is a display-width guard
 *   for pathological input, not a case regulatory numbers hit.
 *
 * Deterministic and locale-independent: toFixed/toPrecision/toExponential
 * are pure numeric operations, unlike toLocaleString (which is locale-
 * and Intl-data-dependent and can vary by machine/runtime).
 */
export function formatMagnitude(
  value: number | null | undefined,
  options: FormatMagnitudeOptions = {},
): string {
  const { placeholder = '--', significantFigures = DEFAULT_SIGNIFICANT_FIGURES } = options;

  if (value === null || value === undefined || !Number.isFinite(value)) {
    return placeholder;
  }
  if (value === 0) {
    return '0';
  }

  if (Math.abs(value) >= UPPER_EXPONENTIAL_THRESHOLD) {
    return value.toExponential(significantFigures - 1);
  }

  const fixedDecimalThreshold = 10 ** -(LEGACY_DECIMAL_PLACES - significantFigures + 1);

  if (Math.abs(value) >= fixedDecimalThreshold) {
    return value.toFixed(LEGACY_DECIMAL_PLACES);
  }
  return value.toPrecision(significantFigures);
}
