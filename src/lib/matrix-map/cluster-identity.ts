/**
 * F2 -- coordinate-cluster identity, as seen from TypeScript.
 *
 * Plan: `f2-cluster-identity-single-authority-2026-07-29-v6.md` section 10.
 *
 * THE AUTHORITY RULE, STATED EXACTLY.
 *
 *   No TypeScript-derived identity determines persistence. TypeScript may
 *   transport server-returned assertion and locator values; SQL independently
 *   derives, compares and selects the authoritative identity.
 *
 * There are therefore TWO cluster-key types, and they are deliberately NOT
 * interchangeable:
 *
 *   `CanonicalClusterId` -- a value the SERVER produced, via
 *     `matrix_map.canonical_five_decimal_cluster`. This is the only kind of key
 *     that may be asserted on a write path. Its ONLY sanctioned construction
 *     path is `parseServerClusterIdentity` below, which reads a server response.
 *
 *   `DisplayClusterKey`  -- a value TYPESCRIPT computed, by
 *     `coordinateClusterId` in `siteAggregates.ts`. It exists to group and
 *     de-duplicate markers on a map. It must never reach a persistence API.
 *
 * WHAT THIS IS NOT. These brands are not cryptographic provenance. An explicit
 * cast (`x as CanonicalClusterId`) and a maliciously-shaped JSON body both
 * remain possible, and nothing here would detect either. The guarantee is
 * narrower and is stated honestly: under ORDINARY type checking, a
 * `DisplayClusterKey` cannot be passed where a `CanonicalClusterId` is required,
 * so the substitution cannot happen by accident or by refactor. The real
 * enforcement is in SQL, which re-derives the key from the representative pair
 * and raises `UE412` on disagreement no matter what any client asserts.
 *
 * The brand symbols are MODULE-PRIVATE. Nothing outside this file can name them,
 * so nothing outside this file can construct a branded value structurally.
 *
 * This module performs NO I/O.
 */

declare const CanonicalClusterIdBrand: unique symbol;
declare const DisplayClusterKeyBrand: unique symbol;

/**
 * A cluster id the SERVER derived. Safe to assert on a write path.
 * Construct ONLY via `parseServerClusterIdentity`.
 */
export type CanonicalClusterId = string & { readonly [CanonicalClusterIdBrand]: true };

/**
 * A cluster key TYPESCRIPT computed, for display and client-side grouping only.
 * Structurally incompatible with `CanonicalClusterId`, on purpose.
 */
export type DisplayClusterKey = string & { readonly [DisplayClusterKeyBrand]: true };

/**
 * The upper bound the SQL side enforces on a cursor
 * (`c_max_cursor_len constant integer := 32`). A canonical id is two
 * `'FM9990.00000'` renderings joined by a comma -- at most 11 characters per
 * axis plus the separator, so 23. Mirrored here so an over-length value is
 * rejected before it is ever sent, not only after a round trip.
 */
export const MAX_CANONICAL_CLUSTER_ID_LENGTH = 32;

/**
 * The exact shape `matrix_map.canonical_five_decimal_cluster` emits:
 * `trim(to_char(round(x::numeric, 5), 'FM9990.00000'))` per axis, joined by a
 * comma. `FM9990` yields one to four integer digits with no padding and no
 * thousands separator, and the five decimals are always present.
 *
 * This is a SHAPE check, not a re-derivation. TypeScript deliberately does not
 * recompute the key from coordinates here -- doing so would make this module a
 * second identity authority, which is precisely what F2 exists to remove.
 *
 * NO LEADING ZEROS, which `\d{1,4}` used to allow while the paragraph above
 * already said `FM9990` emits none. The gap was reachable: a malformed
 * `049.28270,-123.12070` whose representative pair matches NUMERICALLY passed the
 * shape check, so the row parsed and the lifecycle actions stayed enabled -- and
 * the write then failed `UE412`, because the server derives `49.28270` from those
 * same coordinates and the two spellings are not equal as strings. Accepting a
 * spelling SQL cannot emit turns a readable evidence gap into a failed write.
 */
const CANONICAL_CLUSTER_ID_RE =
  /^-?(?:0|[1-9]\d{0,3})\.\d{5},-?(?:0|[1-9]\d{0,3})\.\d{5}$/;

// THERE IS DELIBERATELY NO ROUNDING TOLERANCE HERE.
//
// A revision of this module carried `CANONICAL_ROUNDING_TOLERANCE = 5e-6 + 1e-9`,
// justified by "the representative pair carries digits the key rounds away". A
// review disproved the premise from the SQL: BOTH producers return the
// already-rounded coordinate, so the key and the pair agree EXACTLY and the
// tolerance only widened the parser to accept half-step pairings the server
// cannot emit. The comparison is now exact -- see `parseServerClusterIdentity`.

/**
 * True when `T` contains `DisplayClusterKey` ANYWHERE, including as one member of
 * a union.
 *
 * The inner conditional deliberately DISTRIBUTES over `T` so each union member is
 * tested separately; the result is then compared against `never` OUTSIDE that
 * distribution, which is what turns "any member matched" into a single boolean.
 * Writing the test inline instead let `DisplayClusterKey | null` collapse to
 * `unknown` and slip through.
 */
type ContainsDisplayClusterKey<T> = [T extends DisplayClusterKey ? true : never] extends [never]
  ? false
  : true;

/**
 * The server-derived locator that accompanies a canonical id.
 *
 * These are the ALL-TIER (lifecycle) representative coordinates returned by
 * `matrix_map.fetch_admin_site_aggregate_live_preview`. They are transported
 * back to the upsert unchanged, where SQL re-derives the cluster id from them
 * and compares it against the asserted `CanonicalClusterId`. The pair is the
 * INDEPENDENT locator that makes the comparison non-circular.
 */
export interface ClusterRepresentativePair {
  readonly latitude: number;
  readonly longitude: number;
}

/** A server-derived cluster identity: the key plus the locator it renders from. */
export interface ServerClusterIdentity {
  readonly canonicalClusterId: CanonicalClusterId;
  readonly representative: ClusterRepresentativePair;
}

/**
 * Coordinate eligibility, mirroring the SQL predicate in V6 section 7.2:
 * non-null, not NaN, latitude in [-90, 90], longitude in [-180, 180].
 *
 * NOTE the deliberate divergence from `hasUsableCoordinate` in
 * `siteAggregates.ts`, which checks `Number.isFinite` with NO range check and
 * would therefore accept latitude 500. SQL is stricter and SQL is the authority.
 * This function matches SQL rather than the older display-side helper, so a pair
 * that SQL would reject with `UE422` is not sent in the first place.
 *
 * `Number.isFinite` covers NaN and both infinities in one test; the range bounds
 * then do the rest. The inclusive bounds are intentional -- -90, 90, -180 and
 * 180 are all valid coordinates and MUST be accepted.
 */
export function isEligibleRepresentativeCoordinate(
  latitude: unknown,
  longitude: unknown,
): latitude is number {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * THE ONLY SANCTIONED CONSTRUCTION PATH for `CanonicalClusterId`.
 *
 * Reads a row that came back from the server and, if the key has the canonical
 * shape and the locator is coordinate-eligible, returns both as a branded
 * identity. Returns `null` otherwise -- callers fail closed by omitting the row
 * rather than by fabricating a key.
 *
 * Every field arrives as `unknown` because the row crosses a trust boundary
 * (PostgREST JSON). Nothing here is assumed from a declared type.
 */
/**
 * The key parameter EXCLUDES `DisplayClusterKey` at the type level.
 *
 * WHY THIS IS NEEDED. A review found a hole in the barrier: the parameter was
 * plain `unknown`, every type is assignable to `unknown`, and a
 * TypeScript-derived display key renders in exactly the canonical five-decimal
 * shape. So `parseServerClusterIdentity(displayKey, lat, lng)` returned a genuine
 * `CanonicalClusterId` with NO cast anywhere -- laundering the display key onto
 * the write path through the very function that is supposed to be its only
 * sanctioned construction path.
 *
 * `TKey & (ContainsDisplayClusterKey<TKey> extends true ? never : unknown)`
 * resolves to `never` when the argument type CONTAINS a display key anywhere, so
 * the call does not type-check. For `unknown`, `string`, or any PostgREST field it
 * resolves to the argument type unchanged, so every real caller is unaffected.
 *
 * THE `Contains` INDIRECTION IS LOAD-BEARING, and a review caught why. The first
 * version wrote the conditional inline as `TKey extends DisplayClusterKey ? never
 * : unknown`. A conditional over a NAKED type parameter DISTRIBUTES across
 * unions, so for `TKey = DisplayClusterKey | null` it became `never | unknown`,
 * which simplifies to `unknown` -- and the union sailed straight through. A
 * nullable display key is not a hypothetical shape; it is what an optional field
 * or a `?.` access produces.
 *
 * OVERLOADS DO NOT WORK HERE, and were tried first: a refusing overload with
 * `never[]` rest parameters simply fails to MATCH a three-argument call, so
 * resolution falls through to the permissive signature and nothing errors. `tsc`
 * reported the `@ts-expect-error` guarding it as UNUSED, which is how the failed
 * attempt was caught. The exclusion has to live in the parameter type itself.
 *
 * The hole is CLOSED, not sealed. Widening to `string` first, or casting, still
 * gets through -- as it always would, since TypeScript has no negative types and
 * this was never provenance. What this removes is the ACCIDENTAL path, which is
 * the one refactors actually take.
 */
export function parseServerClusterIdentity<TKey>(
  canonicalClusterId: TKey & (ContainsDisplayClusterKey<TKey> extends true ? never : unknown),
  representativeLatitude: unknown,
  representativeLongitude: unknown,
): ServerClusterIdentity | null {
  if (typeof canonicalClusterId !== 'string') return null;
  if (canonicalClusterId.length > MAX_CANONICAL_CLUSTER_ID_LENGTH) return null;
  if (!CANONICAL_CLUSTER_ID_RE.test(canonicalClusterId)) return null;
  if (!isEligibleRepresentativeCoordinate(representativeLatitude, representativeLongitude)) {
    return null;
  }

  // THE KEY AND ITS PAIR MUST BE CONSISTENT WITH EACH OTHER.
  //
  // The SQL DERIVES the key FROM this pair -- `canonical_five_decimal_cluster` is
  // applied to the same rounded grouping coordinates it returns -- so a key that
  // does not correspond to its representative pair is a row the server cannot
  // emit. Checking only the SHAPE of each half separately accepted, for example,
  // the key `50.00000,-123.12070` alongside latitude `49.2827`: both halves were
  // individually well-formed, so the row parsed, the loader called it clean, the
  // page could associate it with a candidate under the WRONG key, and Create and
  // Refresh stayed enabled on a request the upsert must reject with `UE412`.
  //
  // THIS IS NOT A RE-DERIVATION, and the distinction is the whole reason F2
  // exists. TypeScript still cannot PRODUCE a key: nothing here rounds, formats,
  // or constructs a canonical id, and this function remains incapable of
  // answering "what is the key for this pair?". It answers only "can these two
  // transported values have come from the same row?", which is a consistency
  // check on a payload, not a second identity authority.
  //
  // EXACT EQUALITY, not a rounding tolerance. An earlier revision allowed half a
  // unit in the fifth decimal, reasoning that the pair carries digits the key
  // rounds away. THAT PREMISE IS FALSE FOR BOTH PRODUCERS: each returns the
  // ALREADY-ROUNDED coordinate --
  // `current_site_aggregate_snapshot` selects `round(latitude::numeric, 5)::double
  // precision` as its representative, and the live-preview RPC returns the same
  // `lat5`/`lng5` it derives the key from. Rounding an already-rounded value is
  // idempotent, so the key text is exactly the representative's rendering and the
  // two must compare equal. The tolerance was pure slack, and it accepted
  // half-step pairs the server cannot emit while leaving the write controls live
  // until SQL rejected them with `UE412`.
  //
  // Being exactly as strict as the producer, no more: this is not the U1 error
  // repeated. A decimal-to-double conversion is correctly rounded and
  // deterministic, so `Number('49.28270')` and `round(49.2827::numeric, 5)::double
  // precision` are the same double, and a legitimate row always compares equal.
  const [keyLatText, keyLngText] = canonicalClusterId.split(',');
  const keyLatitude = Number(keyLatText);
  const keyLongitude = Number(keyLngText);

  // NEGATIVE ZERO IS NOT IN THE PRODUCER'S DOMAIN -- checked on the KEY ALONE,
  // BEFORE any comparison against the representative.
  //
  // PostgreSQL `numeric` has no signed zero, so `round(x::numeric, 5)` yields `0`
  // and `to_char` renders `0.00000`. The spelling `-0.00000` is therefore
  // unreachable, whatever the representative happens to be.
  //
  // THIS CANNOT BE FOLDED INTO THE EQUALITY CHECK, and an earlier revision that
  // tried to was wrong in a way worth recording. `Object.is` rejects `-0` against
  // `+0`, so it appeared to cover this -- but `Object.is(-0, -0)` is TRUE, so a
  // response carrying negative zero in BOTH the key and the representative sailed
  // straight through. The equality check can only ever compare the two halves
  // against each other; it cannot police the DOMAIN either half must lie in. That
  // needs its own test, and this is it.
  if (Object.is(keyLatitude, -0) || Object.is(keyLongitude, -0)) return null;

  // `Object.is` RATHER THAN `!==` for the comparison itself, for the remaining
  // signed-zero case the guard above does not reach: a legitimate `0.00000` key
  // paired with a `-0` representative. `0 !== -0` is FALSE in JavaScript, so a
  // plain comparison would accept that mismatch.
  if (!Object.is(keyLatitude, representativeLatitude as number)) return null;
  if (!Object.is(keyLongitude, representativeLongitude as number)) return null;

  return {
    // Through `unknown` because the parameter type is now a generic intersection
    // (see the exclusion above), which does not directly overlap the branded
    // type. This is THE one sanctioned mint of a `CanonicalClusterId`, reached
    // only after the shape and eligibility checks above have passed.
    canonicalClusterId: canonicalClusterId as unknown as CanonicalClusterId,
    representative: {
      latitude: representativeLatitude as number,
      longitude: representativeLongitude as number,
    },
  };
}

/**
 * Construct a DISPLAY-ONLY cluster key. Used by `coordinateClusterId` for map
 * grouping. There is no path from this function to a persistence API, and the
 * type system is what keeps it that way.
 */
export function asDisplayClusterKey(value: string): DisplayClusterKey {
  return value as DisplayClusterKey;
}
