/**
 * F2 -- cluster identity: type-level fixture PLUS behavioural tests.
 *
 * Plan: `f2-cluster-identity-single-authority-2026-07-29-v6.md` section 10.
 *
 * TWO KINDS OF EVIDENCE, DELIBERATELY BOTH.
 *
 * 1. The TYPE-LEVEL fixture below uses `@ts-expect-error`. It is not a runtime
 *    assertion and vitest cannot fail on it -- `npx tsc --noEmit` does, because
 *    an `@ts-expect-error` on a line that stops erroring IS ITSELF an error
 *    (TS2578, "Unused '@ts-expect-error' directive"). So if the two cluster-key
 *    types ever became mutually assignable, the TypeScript gate goes red. That
 *    is the mechanism; it is stated here so nobody later "cleans up" the
 *    directives believing them decorative.
 *
 * 2. The BEHAVIOURAL tests exercise the parser, which is the only sanctioned
 *    construction path for a `CanonicalClusterId`.
 *
 * WHAT IS DELIBERATELY NOT DONE HERE. No source-text scan, no regex over the
 * repository, no token-window match, no AST walk. V6 section 10 forbids all of
 * them, and for a reason the repository has already been burned by: a text scan
 * proves a string exists, not that a program behaves. The guarantee is carried
 * by the type checker and by execution, or it is not carried.
 */
import { describe, it, expect } from 'vitest';
import type { ComponentProps } from 'react';

import { SiteAggregateAdminActions } from '@/app/(dashboard)/admin/matrix-map/site-aggregates/SiteAggregateAdminActions';

import {
  asDisplayClusterKey,
  isEligibleRepresentativeCoordinate,
  parseServerClusterIdentity,
  MAX_CANONICAL_CLUSTER_ID_LENGTH,
  type CanonicalClusterId,
  type DisplayClusterKey,
} from '../cluster-identity';
import { coordinateClusterId } from '../siteAggregates';

// ---------------------------------------------------------------------------
// TYPE-LEVEL FIXTURE -- enforced by `tsc --noEmit`, not by vitest.
// ---------------------------------------------------------------------------

/**
 * THE REAL WRITE BOUNDARY, not a stand-in.
 *
 * A review pointed out that testing only a local `requiresCanonical(id:
 * CanonicalClusterId)` proves nothing about production: if
 * `SiteAggregateAdminActions`'s `identity` prop were later widened to an
 * unbranded string or object, every `@ts-expect-error` below would still be
 * "used" and `tsc` would stay green while the actual write path had started
 * accepting display keys.
 *
 * So the fixture is anchored to the type the COMPONENT actually declares. Widen
 * that prop and this alias widens with it, the directives below stop erroring,
 * and TS2578 fails the typecheck.
 */
type WriteBoundaryIdentity = NonNullable<
  ComponentProps<typeof SiteAggregateAdminActions>['identity']
>;

/** Stands in for any persistence-facing API that demands a server-derived key. */
function requiresCanonical(_id: CanonicalClusterId): void {
  /* the signature is the whole point; there is nothing to run */
}

/** The production write boundary, reached through the component's own prop type. */
function requiresWriteBoundaryIdentity(_identity: WriteBoundaryIdentity): void {
  /* as above */
}

/** Stands in for a display-only sink. */
function requiresDisplay(_key: DisplayClusterKey): void {
  /* as above */
}

function typeLevelFixture(): void {
  const display: DisplayClusterKey = coordinateClusterId(49.2827, -123.1207);
  const canonical = parseServerClusterIdentity('49.28270,-123.12070', 49.2827, -123.1207);

  // THE LOAD-BEARING ONE. A TypeScript-derived display key must not be usable
  // where a server-derived canonical key is required. If this ever compiles,
  // the branding has failed and the tsc gate reports the unused directive.
  // @ts-expect-error DisplayClusterKey must not satisfy CanonicalClusterId
  requiresCanonical(display);

  // A bare string must not satisfy it either -- otherwise any JSON field would.
  // @ts-expect-error a plain string must not satisfy CanonicalClusterId
  requiresCanonical('49.28270,-123.12070');

  // THE PRODUCTION WRITE BOUNDARY. These are the assertions that actually bind:
  // they fail if the component's `identity` prop is ever widened.
  // @ts-expect-error the write boundary must not accept a display key as its id
  requiresWriteBoundaryIdentity({ canonicalClusterId: display, representative: { latitude: 49.2827, longitude: -123.1207 } });
  // @ts-expect-error the write boundary must not accept a plain string as its id
  requiresWriteBoundaryIdentity({ canonicalClusterId: '49.28270,-123.12070', representative: { latitude: 49.2827, longitude: -123.1207 } });
  // ...and the DISPLAY KEY ITSELF, directly. A review showed the two object
  // literals above are not sufficient: if `identity` were widened to
  // `ServerClusterIdentity | string | null`, both literals would still error --
  // they match neither the string branch nor the branded-object branch -- so the
  // directives would stay "used" while a bare DisplayClusterKey became assignable
  // to the new string branch. This assertion fails the moment that happens.
  // @ts-expect-error the write boundary must not accept a display key directly
  requiresWriteBoundaryIdentity(display);

  // THE PARSER MUST NOT LAUNDER. Passing a display key selects the refusing
  // overload; without it the parser returned a real CanonicalClusterId with no
  // cast, which defeated the whole barrier.
  // @ts-expect-error a DisplayClusterKey must not be accepted by the parser
  parseServerClusterIdentity(display, 49.2827, -123.1207);

  // UNION AND NULLABLE FORMS. These are the cases the first exclusion missed: a
  // conditional over a naked type parameter DISTRIBUTES, so
  // `DisplayClusterKey | null` became `never | unknown` = `unknown` and sailed
  // through. A nullable display key is not hypothetical -- an optional field or a
  // `?.` access produces exactly this type.
  const maybeDisplay = (Math.random() > 0.5 ? display : null) as DisplayClusterKey | null;
  // @ts-expect-error DisplayClusterKey | null must not be accepted either
  parseServerClusterIdentity(maybeDisplay, 49.2827, -123.1207);

  const displayOrString = display as DisplayClusterKey | string;
  // @ts-expect-error a union merely CONTAINING DisplayClusterKey must be refused
  parseServerClusterIdentity(displayOrString, 49.2827, -123.1207);

  // ...while the shapes real callers actually pass must still compile. Without
  // these the exclusion could pass by rejecting everything.
  parseServerClusterIdentity(JSON.parse('{}') as unknown, 49.2827, -123.1207);
  parseServerClusterIdentity('49.28270,-123.12070' as string, 49.2827, -123.1207);
  parseServerClusterIdentity(null as string | null, 49.2827, -123.1207);

  // And the reverse direction, so the two are genuinely disjoint rather than
  // one being a subtype of the other.
  if (canonical !== null) {
    // @ts-expect-error CanonicalClusterId must not satisfy DisplayClusterKey
    requiresDisplay(canonical.canonicalClusterId);

    // The POSITIVE case must still compile. Without this the fixture could pass
    // by making the canonical type unusable rather than merely un-substitutable.
    requiresCanonical(canonical.canonicalClusterId);
    // ...and the real write boundary must still accept a genuine parsed identity.
    requiresWriteBoundaryIdentity(canonical);
  }

  // Display sinks still accept display keys.
  requiresDisplay(display);

  // Both remain readable AS strings -- rendering, template literals and Set keys
  // must keep working, or the brand would have broken the map layer.
  const rendered: string = display;
  expect(typeof rendered).toBe('string');
}

// ---------------------------------------------------------------------------
// BEHAVIOURAL TESTS
// ---------------------------------------------------------------------------

describe('type-level cluster identity fixture', () => {
  it('compiles only while the two key types stay mutually unassignable', () => {
    // Executing it proves the positive branches are reachable and that the
    // fixture is real code the bundler keeps, not an unreferenced function that
    // could be deleted without anyone noticing.
    expect(() => typeLevelFixture()).not.toThrow();
  });
});

describe('parseServerClusterIdentity', () => {
  it('accepts a canonical rendering with an eligible pair', () => {
    const parsed = parseServerClusterIdentity('49.28270,-123.12070', 49.2827, -123.1207);
    expect(parsed).not.toBeNull();
    expect(parsed?.canonicalClusterId).toBe('49.28270,-123.12070');
    expect(parsed?.representative).toEqual({ latitude: 49.2827, longitude: -123.1207 });
  });

  it('accepts the inclusive coordinate boundaries', () => {
    expect(parseServerClusterIdentity('-90.00000,-180.00000', -90, -180)).not.toBeNull();
    expect(parseServerClusterIdentity('90.00000,180.00000', 90, 180)).not.toBeNull();
  });

  /**
   * THIS ASSERTION IS REVERSED, and its old comment was factually wrong.
   *
   * It used to ACCEPT `-0.00000` on the reasoning that "the SHAPE check governs
   * the key, and `-0.00000` is a rendering PostgreSQL can emit". It is not:
   * PostgreSQL `numeric` has no signed zero, so `round(x::numeric, 5)` yields `0`
   * and `to_char` renders `0.00000`. The spelling is unreachable.
   *
   * The middle case is the one that matters. A later revision claimed `Object.is`
   * alone closed this, which is FALSE -- `Object.is(-0, -0)` is TRUE, so a
   * response carrying negative zero in BOTH halves passed the equality check
   * untouched. Only a DOMAIN guard on the key itself rejects it.
   */
  it.each([
    ['a negative-zero key against a positive-zero representative', '-0.00000,0.00000', -0, 0],
    // ONLY the domain guard catches this one, and BOTH axes must carry the
    // negative zero for that to be true. An earlier version wrote the key as
    // `-0.00000,0.00000` while passing `-0` for the longitude, so the LONGITUDE
    // disagreed (`Object.is(+0, -0)` is false) and the equality check caught it --
    // the case did not test what its label claimed. With both axes negative zero
    // the two halves genuinely AGREE, `Object.is(-0, -0)` is true on each, and the
    // domain guard is the only thing left rejecting it.
    ['a negative-zero key against a negative-zero representative', '-0.00000,-0.00000', -0, -0],
    ['a negative-zero LONGITUDE axis', '0.00000,-0.00000', 0, -0],
  ])('REJECTS %s', (_label, key, lat, lng) => {
    expect(parseServerClusterIdentity(key, lat, lng)).toBeNull();
  });

  it('REJECTS a positive-zero key against a NEGATIVE-ZERO representative', () => {
    // ONLY the `Object.is` comparison catches this one: the key spelling is
    // legitimate, so the domain guard passes, and `0 !== -0` is FALSE so a plain
    // equality test would accept the mismatch.
    expect(parseServerClusterIdentity('0.00000,0.00000', -0, 0)).toBeNull();
    expect(parseServerClusterIdentity('0.00000,0.00000', 0, -0)).toBeNull();
  });

  it('ACCEPTS a genuine positive zero on both axes', () => {
    // DISCRIMINATING: the rejections above must not take the reachable value with
    // them. `0.00000,0.00000` with `+0` is exactly what the producer emits at the
    // origin.
    expect(parseServerClusterIdentity('0.00000,0.00000', 0, 0)).not.toBeNull();
  });

  it('ACCEPTS ordinary NEGATIVE NONZERO coordinates', () => {
    // The domain guard targets signed ZERO only. A negative coordinate is the
    // common case for this dataset's longitudes and must be unaffected.
    expect(
      parseServerClusterIdentity('-49.28270,-123.12070', -49.2827, -123.1207),
    ).not.toBeNull();
  });

  it.each([
    ['a non-string key', 12345],
    ['an empty key', ''],
    ['a placeholder key', 'cluster-alpha'],
    ['too few decimals', '49.2827,-123.1207'],
    ['too many decimals', '49.282700,-123.120700'],
    ['a missing axis', '49.28270'],
    ['a trailing separator', '49.28270,'],
    ['leading whitespace', ' 49.28270,-123.12070'],
    ['trailing whitespace', '49.28270,-123.12070 '],
    ['a space after the comma', '49.28270, -123.12070'],
    ['three axes', '49.28270,-123.12070,0.00000'],
    ['too many integer digits', '49999.28270,-123.12070'],
  ])('rejects %s', (_label, key) => {
    expect(parseServerClusterIdentity(key, 49.2827, -123.1207)).toBeNull();
  });

  it('rejects a key longer than the SQL cursor ceiling', () => {
    const overLong = `${'9'.repeat(MAX_CANONICAL_CLUSTER_ID_LENGTH)}.00000,0.00000`;
    expect(overLong.length).toBeGreaterThan(MAX_CANONICAL_CLUSTER_ID_LENGTH);
    expect(parseServerClusterIdentity(overLong, 49.2827, -123.1207)).toBeNull();
  });

  it.each([
    ['a null latitude', null, -123.1207],
    ['a null longitude', 49.2827, null],
    ['a NaN latitude', Number.NaN, -123.1207],
    ['a NaN longitude', 49.2827, Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY, -123.1207],
    ['negative infinity', Number.NEGATIVE_INFINITY, -123.1207],
    ['a latitude just above 90', 90.00001, -123.1207],
    ['a latitude just below -90', -90.00001, -123.1207],
    ['a longitude just above 180', 49.2827, 180.00001],
    ['a longitude just below -180', 49.2827, -180.00001],
    ['a string latitude', '49.2827', -123.1207],
  ])('rejects %s', (_label, lat, lng) => {
    expect(parseServerClusterIdentity('49.28270,-123.12070', lat, lng)).toBeNull();
  });

  it('rejects the out-of-range latitude the display-side helper would accept', () => {
    // `hasUsableCoordinate` in siteAggregates.ts checks Number.isFinite with NO
    // range check, so it accepts latitude 500. SQL is stricter and SQL is the
    // authority; this pins that the write path follows SQL, not the older helper.
    expect(Number.isFinite(500)).toBe(true);
    expect(parseServerClusterIdentity('500.00000,0.00000', 500, 0)).toBeNull();
  });
});

/**
 * THE KEY AND ITS PAIR MUST BE CONSISTENT.
 *
 * The SQL derives the cluster key FROM the representative pair, so a response
 * carrying a well-shaped key alongside a pair it could not have come from is
 * impossible. Validating each half separately accepted exactly that, and the
 * consequence reached the write path: the loader called the row clean, the page
 * could match it to a candidate under the WRONG key, and Create/Refresh stayed
 * enabled on a request the upsert must reject with UE412.
 *
 * This is a CONSISTENCY check, not a re-derivation -- nothing here rounds or
 * formats, and the function still cannot answer "what is the key for this pair?".
 * The tolerance is the rounding granularity, and the accepting cases below are
 * what stop it from tightening into a validator stricter than its producer.
 */
describe('parseServerClusterIdentity -- key and representative pair must agree', () => {
  it('REJECTS a key whose latitude does not match the pair', () => {
    expect(parseServerClusterIdentity('50.00000,-123.12070', 49.2827, -123.1207)).toBeNull();
  });

  it('REJECTS a key whose longitude does not match the pair', () => {
    expect(parseServerClusterIdentity('49.28270,-124.12070', 49.2827, -123.1207)).toBeNull();
  });

  it('REJECTS a near-miss beyond the rounding granularity', () => {
    expect(parseServerClusterIdentity('49.28270,-123.12070', 49.2828, -123.1207)).toBeNull();
  });

  it('REJECTS a HALF-STEP pair the key would round differently', () => {
    // 49.2827050005 rounds to 49.28271, not 49.28270. An earlier revision allowed
    // half a unit of slack in the fifth decimal and accepted this, leaving
    // Create/Refresh live until SQL rejected the request with UE412.
    expect(
      parseServerClusterIdentity('49.28270,-123.12070', 49.2827050005, -123.1207),
    ).toBeNull();
  });

  it('REJECTS a NEGATIVE-ZERO axis, which PostgreSQL numeric cannot produce', () => {
    // `Number('-0.00000')` is -0, and `-0 !== 0` is FALSE, so a plain equality
    // comparison would accept this. PostgreSQL numeric has no signed zero, so
    // to_char emits '0.00000' and this spelling is unreachable.
    expect(parseServerClusterIdentity('-0.00000,-123.12070', 0, -123.1207)).toBeNull();
    expect(parseServerClusterIdentity('49.28270,-0.00000', 49.2827, 0)).toBeNull();
  });

  it('ACCEPTS a genuine zero axis', () => {
    // DISCRIMINATING: the negative-zero rejection must not take the legitimate
    // positive zero with it.
    expect(parseServerClusterIdentity('0.00000,-123.12070', 0, -123.1207)).not.toBeNull();
  });

  it('ACCEPTS an exact match', () => {
    expect(parseServerClusterIdentity('49.28270,-123.12070', 49.2827, -123.1207)).not.toBeNull();
  });

  it('ACCEPTS a negative axis whose key and pair agree exactly', () => {
    expect(parseServerClusterIdentity('-49.28270,-123.12070', -49.2827, -123.1207)).not.toBeNull();
  });

  it('ACCEPTS the exact double a rounded numeric serialises to', () => {
    // The comparison is exact, so this is the case that would break if
    // decimal-to-double conversion were not deterministic. Both sides are the
    // nearest double to the same five-decimal value, so they are the same double.
    expect(
      parseServerClusterIdentity('12.34568,-98.76543', Number('12.34568'), Number('-98.76543')),
    ).not.toBeNull();
  });
});

describe('isEligibleRepresentativeCoordinate', () => {
  it('includes the boundary values and excludes everything just outside them', () => {
    expect(isEligibleRepresentativeCoordinate(-90, -180)).toBe(true);
    expect(isEligibleRepresentativeCoordinate(90, 180)).toBe(true);
    expect(isEligibleRepresentativeCoordinate(-90.0000001, 0)).toBe(false);
    expect(isEligibleRepresentativeCoordinate(0, 180.0000001)).toBe(false);
  });
});

describe('display keys are not identity', () => {
  it('produces a five-decimal rendering usable for grouping', () => {
    expect(coordinateClusterId(49.2827, -123.1207)).toBe('49.28270,-123.12070');
  });

  it('DIVERGES from the SQL rendering on negative zero, which is why it is display-only', () => {
    // JavaScript `(-0).toFixed(5)` yields '0.00000' -- the sign is lost. The
    // SQL side renders `round((-0)::numeric, 5)` through 'FM9990.00000'. The two
    // are not guaranteed to agree, and this test exists so the divergence is a
    // RECORDED property of the display key rather than a latent surprise. It is
    // harmless for map grouping and would be a correctness defect on a write
    // path -- which is exactly why the two types are kept distinct.
    expect(coordinateClusterId(-0, 0)).toBe('0.00000,0.00000');
  });

  it('round-trips through the display factory without becoming canonical', () => {
    const key = asDisplayClusterKey('49.28270,-123.12070');
    expect(String(key)).toBe('49.28270,-123.12070');
  });
});
