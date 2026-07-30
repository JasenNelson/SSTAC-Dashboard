/**
 * F2 -- the admin live-preview consumer for
 * `matrix_map.fetch_admin_site_aggregate_live_preview`.
 *
 * Plan: `f2-cluster-identity-single-authority-2026-07-29-v6.md` sections 5 and 8.6.
 *
 * WHY THIS REPLACES CLIENT-SIDE CLUSTERING. The admin page used to fetch raw
 * medium-tier samples and cluster them in TypeScript with `computeSiteAggregates`
 * (`page.tsx:194` before F2). That made TypeScript a SECOND implementation of the
 * cluster identity SQL already owns, and the operator then asserted that
 * TypeScript-derived key on the write path -- the circularity F2 removes. The
 * server now does the grouping and returns the key it derived, so the page
 * transports an identity it did not compute.
 *
 * TWO POPULATIONS PER ROW, and they are not interchangeable:
 *   - the PREVIEW block is MEDIUM-TIER only. It is what the table, map and
 *     summary render, and it reproduces exactly what `{ tier: 'medium' }`
 *     produced client-side.
 *   - the LIFECYCLE block is ALL-TIER. It is what the upsert would persist and
 *     what members would eventually see, and its representative pair is the
 *     locator posted back on Create/Refresh.
 *
 * PAGINATION IS KEYSET, not OFFSET. The cursor is the last row's
 * `(source_dra_id, canonical_cluster_id)`. Fewer than `p_limit` rows means the
 * traversal is complete. Unlike the OFFSET loaders in
 * `site-aggregate-admin-loaders.ts`, a keyset cursor cannot skip or repeat a row
 * when a concurrent write shifts the population.
 *
 * This module performs NO writes.
 */

// `isEligibleRepresentativeCoordinate` is deliberately NOT imported here any
// more. This module no longer performs any coordinate judgement of its own: both
// representative pairs go through `parseServerClusterIdentity`, which applies
// eligibility itself. Importing it again would be the first step back toward a
// second comparison site.
import {
  parseServerClusterIdentity,
  type CanonicalClusterId,
  type ClusterRepresentativePair,
} from './cluster-identity';
import type { CoordinateTier } from './siteAggregates';
import { MAX_PAGES, PAGE_SIZE } from './site-aggregate-pagination';
import { loadAdminCandidates, type AdminLoaderClient } from './site-aggregate-admin-loaders';

/** The RPC's own name, in one place so the loader test and the page agree. */
export const LIVE_PREVIEW_RPC = 'fetch_admin_site_aggregate_live_preview';

/**
 * One parsed live-preview row.
 *
 * `canonical_cluster_id` is BRANDED: it is a server-derived key, and the brand
 * is what stops it being confused with the display key `computeSiteAggregates`
 * produces. `lifecycle_representative` is the independent locator that travels
 * with it.
 */
export interface LivePreviewRow {
  /** Stable React key: `${source_dra_id}:${canonical_cluster_id}`. */
  readonly aggregate_id: string;
  readonly source_dra_id: string;
  readonly source_dra_title: string | null;
  readonly canonical_cluster_id: CanonicalClusterId;

  /** MEDIUM-TIER population -- what the table, map and summary render. */
  readonly preview_representative_latitude: number;
  readonly preview_representative_longitude: number;
  /**
   * The LITERAL `'medium'`, not the tier enum. The preview population is
   * medium-only by construction and the SQL emits a constant here, so typing it
   * as the full enum described a value the producer cannot send.
   */
  readonly preview_coordinate_quality_tier: 'medium';
  /**
   * DISPLAY ONLY. A lossy rendering of `preview_coordinate_sources`; it has been
   * verified to equal that array joined by '; ', but it must never be split back
   * into a set, because a source value may itself contain the separator.
   */
  readonly preview_coordinate_source: string | null;
  /** THE AUTHORITATIVE SET: sorted, DISTINCT, non-blank. NULL, never empty. */
  readonly preview_coordinate_sources: readonly string[] | null;
  readonly preview_sample_count_total: number;
  readonly preview_sample_count_high: number;
  readonly preview_sample_count_medium: number;
  readonly preview_sample_count_low: number;
  readonly preview_distinct_point_count: number;

  /** ALL-TIER population -- what the upsert would persist. */
  readonly lifecycle_representative: ClusterRepresentativePair;
  /**
   * NOT `string | null`. The SQL's dominant-tier CASE emits one of the three
   * tier literals and cannot reach its `ELSE NULL` branch, because the HAVING
   * clause guarantees a non-zero medium count. Typing it wider than the producer
   * invited a consumer to handle a state the server never sends.
   */
  readonly lifecycle_coordinate_quality_tier: CoordinateTier;
  /** DISPLAY ONLY. Same contract as `preview_coordinate_source`. */
  readonly lifecycle_coordinate_source: string | null;
  /** THE AUTHORITATIVE ALL-TIER SET. The preview set is a subset of this one. */
  readonly lifecycle_coordinate_sources: readonly string[] | null;
  readonly lifecycle_sample_count_total: number;
  readonly lifecycle_sample_count_high: number;
  readonly lifecycle_sample_count_medium: number;
  readonly lifecycle_sample_count_low: number;
  readonly lifecycle_distinct_point_count: number;
}

// The tier-membership list is deliberately GONE. The preview tier is checked
// against the literal the SQL emits, and the lifecycle tier is checked against the
// value DERIVED from its own counts -- neither needs a membership test, and
// keeping one would leave a branch no test could pin.

/**
 * The `source_dra_id` spelling this module accepts: PostgreSQL's CANONICAL uuid
 * output form -- 8-4-4-4-12 lowercase hex, with NO restriction on the version or
 * variant nibbles.
 *
 * WHY THIS IS NOT THE ROUTE'S `UUID_RE`, in both directions.
 *
 * STRICTER on case: the route validates a CLIENT payload, so it accepts
 * uppercase and lowercases it -- its own comment explains that PostgreSQL accepts
 * uppercase but SERIALISES uuid values back in lowercase. This module reads SQL
 * OUTPUT, where lowercase is the only spelling that can occur. Rejecting rather
 * than normalising is deliberate: `lifecycleRowKey` matches on EXACT string
 * equality while the route lowercases, so an uppercase id makes an existing
 * candidate look ABSENT and the page offers "Create" for a write that would
 * actually REFRESH it. Normalising would paper over a response the server cannot
 * send; rejecting surfaces it through `previewRowsUnreadable`.
 *
 * LOOSER on version and variant, and this half was a REGRESSION worth recording.
 * An earlier revision copied the route's `[1-5]` version and `[89ab]` variant
 * classes wholesale, reasoning that the two ends of the seam should stay
 * byte-identical. That is wrong for a validator reading DATABASE OUTPUT: the
 * PostgreSQL `uuid` type stores any 128-bit value and does not require RFC 4122
 * conformance, so the RPC can legitimately return ids those classes reject. A
 * review caught it against this repository's own fixtures --
 * `a1111111-1111-1111-1111-111111111111`, `11111111-...` and
 * `00000000-...` all failed -- which would have marked real rows unreadable and
 * DISABLED Create, Refresh and Publish for legitimate DRAs.
 *
 * The general rule this encodes: a parser may be stricter than its producer about
 * SPELLING, but never about the producer's VALUE DOMAIN.
 */
const SOURCE_DRA_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The maximum a PostgreSQL `integer` can hold. Every count column in the RPC's
 * RETURNS TABLE is declared `integer`, so a larger value cannot have come from
 * this function.
 */
const PG_INT4_MAX = 2147483647;

/**
 * A COUNT: an integer within the PostgreSQL `integer` domain the SQL declares.
 *
 * This used to accept any finite number, which a review showed was too loose for
 * a trust boundary. A malformed or version-skewed successful response carrying a
 * FRACTIONAL or NEGATIVE count parsed cleanly, so the row did not increment
 * `unparsableRowCount`, the page treated the evidence as complete, and it rendered
 * an impossible summary with the lifecycle write controls enabled.
 *
 * THE UPPER BOUND IS NOT COSMETIC, and `Number.isInteger` alone does not provide
 * it. `Number.isInteger(9007199254740992)` is true, and at that magnitude IEEE-754
 * addition is no longer exact: `9007199254740992 + 1 + 0` evaluates to
 * `9007199254740992`, so a partition check on those values PASSES while the
 * mathematical sum differs. A review demonstrated exactly that row. Bounding to
 * the declared `integer` domain removes the whole class, because every value the
 * arithmetic below operates on is then far inside the exactly-representable range.
 */
function asCount(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= PG_INT4_MAX
    ? value
    : null;
}

/**
 * The dominant-tier CASE from the SQL, reproduced EXACTLY.
 *
 * The lifecycle tier is not independent data -- it is a FUNCTION of the three
 * lifecycle counts. Validating it only as an enum member accepted rows the SQL
 * could never emit (a review found the module's own control fixture was one:
 * counts 3/6/1 with tier `high`, where the CASE necessarily yields `medium`).
 *
 * Ties break high > medium > low, matching `current_site_aggregate_snapshot` and
 * the client's severity-ordered scan. `null` is returned only when all three
 * counts are zero, which the SQL's `HAVING count(*) FILTER (medium) > 0` makes
 * unreachable -- so a row reaching that case is itself malformed.
 */
function dominantLifecycleTier(
  high: number,
  medium: number,
  low: number,
): CoordinateTier | null {
  if (high >= medium && high >= low && high > 0) return 'high';
  if (medium >= low && medium > 0) return 'medium';
  if (low > 0) return 'low';
  return null;
}

/** Returned when a nullable-text field carries a type the SQL cannot emit. */
const INVALID_TEXT = Symbol('invalid nullable text');

/** Returned when a source ARRAY is absent, misshapen, or misordered. */
const INVALID_SOURCES = Symbol('invalid source array');

/** The separator `string_agg` uses to flatten a source set for display. */
const SOURCE_TEXT_SEPARATOR = '; ';

/**
 * A string made ENTIRELY of ASCII spaces (U+0020), which is what PostgreSQL's
 * one-argument `trim()` strips and therefore what `length(trim(x)) > 0` excludes.
 *
 * Written as an explicit ` ` class rather than `\s` ON PURPOSE. `\s` matches
 * JavaScript's whole notion of whitespace -- tabs, newlines, U+00A0, and more --
 * which is a WIDER set than PostgreSQL strips, and using it here would re-create
 * the over-rejection this pattern exists to avoid.
 */
const SPACES_ONLY_RE = /^ +$/;

/** The RPC's total-order key, taken from a RAW row. */
type KeysetKey = readonly [sourceDraId: string, canonicalClusterId: string];

/**
 * The ordering key of a raw response row, or `null` when either half is missing.
 *
 * Read from the RAW row rather than a parsed one on purpose: the order is a
 * property of the RESPONSE, so a row this build cannot otherwise read must still
 * participate in the check.
 */
function rawKeysetKey(raw: unknown): KeysetKey | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const dra = row.source_dra_id;
  const cluster = row.canonical_cluster_id;
  if (typeof dra !== 'string' || typeof cluster !== 'string') return null;
  return [dra, cluster];
}

/**
 * Compare two keys in the RPC's own order: `source_dra_id`, then
 * `canonical_cluster_id COLLATE "C"`.
 *
 * Both halves go through `compareUtf8` because the second one MUST -- the SQL
 * collates it as bytes. The uuid half is fixed-width lowercase hex, where byte
 * order and code-unit order agree, so using the same comparator costs nothing and
 * removes a reason for the two halves to drift apart.
 */
function compareKeyset(a: KeysetKey, b: KeysetKey): number {
  const byDra = compareUtf8(a[0], b[0]);
  return byDra !== 0 ? byDra : compareUtf8(a[1], b[1]);
}

const UTF8 = new TextEncoder();

/**
 * Byte-order comparison, which is what `COLLATE "C"` means.
 *
 * NOT `a < b`. JavaScript compares strings by UTF-16 code unit, and that is a
 * DIFFERENT order from UTF-8 byte order once you leave ASCII -- most visibly for
 * anything outside the BMP, where a surrogate pair sorts below U+E000..U+FFFF in
 * UTF-16 but above them in UTF-8. `coordinate_source` is free-form text, so
 * non-ASCII is not hypothetical.
 *
 * The SQL orders by a column carrying `COLLATE "C"`, i.e. `memcmp` over the
 * encoded bytes. This reproduces that exactly rather than approximating it, so
 * the ordering assertion cannot pass in the test suite and fail against the
 * database.
 */
function compareUtf8(a: string, b: string): number {
  const x = UTF8.encode(a);
  const y = UTF8.encode(b);
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i += 1) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return x.length - y.length;
}

/**
 * One `text[]` provenance column: NULL, or a sorted array of DISTINCT non-blank
 * strings.
 *
 * THIS IS THE AUTHORITATIVE SET. The flattened `..._coordinate_source` text is a
 * LOSSY serialization of it, because `coordinate_source` is free-form and may
 * contain the '; ' separator, so splitting the text can neither recover the set
 * nor be trusted to reject a bad one. Validating the array and treating the text
 * as a rendering of it is the only sound direction.
 *
 * Every property checked here is one the SQL guarantees:
 *   - NULL when the FILTER matched nothing (`array_agg` behaves like
 *     `string_agg` there), so an EMPTY array is impossible and is rejected;
 *   - elements non-blank, from `length(trim(b_source)) > 0`;
 *   - elements DISTINCT;
 *   - ascending byte order, from `ORDER BY b_source` where the column carries
 *     `COLLATE "C"`.
 */
function asSourceArray(value: unknown): readonly string[] | null | typeof INVALID_SOURCES {
  if (value === null) return null;
  if (!Array.isArray(value)) return INVALID_SOURCES;
  // An empty array is NOT the empty set here: the SQL emits NULL for that, so
  // `[]` is a response shape the producer cannot generate.
  if (value.length === 0) return INVALID_SOURCES;
  for (let i = 0; i < value.length; i += 1) {
    const element = value[i];
    // THE SQL FILTER, REPRODUCED EXACTLY -- neither stricter nor weaker.
    //
    // The filter is `length(trim(b_source)) > 0`. PostgreSQL's one-argument
    // `trim()` is `btrim(x, ' ')`: it strips U+0020 and NOTHING ELSE. So the
    // values SQL excludes are precisely the empty string and strings made
    // entirely of ASCII spaces.
    //
    // Both wrong answers were tried before this one:
    //   - `element.trim().length === 0` is TOO STRICT, because JavaScript's
    //     `String.prototype.trim` strips ALL Unicode whitespace. A U+00A0 source
    //     SURVIVES the SQL filter and reaches the client, so a JS-trim check
    //     rejects a row the server can really send. A contract test in this
    //     repository forbids `.trim().length` for exactly this reason.
    //   - emptiness alone is TOO WEAK. It can never falsely reject, which is why
    //     it was chosen as the safe fallback -- but a review pointed out that
    //     settling for weaker was unnecessary when EXACT was available: a
    //     space-only source is a row the SQL cannot emit, and accepting it leaves
    //     Create/Refresh enabled over provenance the upsert would recompute
    //     differently.
    //
    // `SPACES_ONLY_RE` is the exact predicate, and it deliberately names U+0020
    // rather than using a whitespace class, so it cannot silently widen to
    // JavaScript's notion of whitespace the way `\s` would.
    if (typeof element !== 'string') return INVALID_SOURCES;
    if (element.length === 0 || SPACES_ONLY_RE.test(element)) return INVALID_SOURCES;
    if (i > 0) {
      // STRICTLY ascending: this single test carries both the ordering and the
      // DISTINCT guarantee, since equal neighbours compare 0 and sort order
      // makes non-adjacent duplicates impossible.
      if (compareUtf8(value[i - 1] as string, element) >= 0) return INVALID_SOURCES;
    }
  }
  return value as readonly string[];
}

/**
 * A NULLABLE TEXT column: a string, or a genuine SQL NULL. Nothing else.
 *
 * This used to be `typeof value === 'string' ? value : null`, which COLLAPSED
 * three different situations into one: a real NULL, an ABSENT key, and a
 * WRONG-TYPED value (a number, an object) all became `null`. A review showed why
 * that matters here rather than being a tidiness point -- the affected columns are
 * `preview_coordinate_source`, `lifecycle_coordinate_source` and
 * `source_dra_title`, and the coordinate sources are PROVENANCE. A malformed
 * response could drop the provenance the upsert may persist, the row would still
 * parse, `unparsableRowCount` would stay zero, and Create/Refresh would remain
 * enabled on a lifecycle preview that silently understated what it was about to
 * write.
 *
 * `undefined` (an absent key) is INVALID, not NULL: PostgREST emits every declared
 * column, so a missing one is version skew rather than an empty value.
 */
function asNullableText(value: unknown): string | null | typeof INVALID_TEXT {
  if (value === null) return null;
  return typeof value === 'string' ? value : INVALID_TEXT;
}

/**
 * Parse one RPC row. Returns `null` when ANY load-bearing field is missing or
 * malformed -- there is no partial row and no defaulted count.
 *
 * FAIL CLOSED, and note what that means here: a `null` is not silently dropped
 * by the caller. `loadAdminLivePreview` counts unparsable rows and reports them,
 * because a row the server sent but this build could not read is an evidence
 * gap, not an absence.
 */
export function parseLivePreviewRow(value: unknown): LivePreviewRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;

  // A UUID, not merely a non-empty string.
  //
  // The RPC declares `source_dra_id uuid`, so a non-UUID cannot come from it.
  // Accepting one opened a SEAM MISMATCH rather than a cosmetic looseness: the
  // row parsed, recorded no unreadable evidence and left Create enabled, but the
  // candidate route rejects the resulting request outright with "source_dra_id
  // must be a UUID string" -- so the operator met a failure only after clicking a
  // control this module had told the page was safe to offer. The pattern is the
  // same one the route enforces, deliberately, so the two ends of the seam agree.
  const sourceDraId = row.source_dra_id;
  if (typeof sourceDraId !== 'string' || !SOURCE_DRA_ID_RE.test(sourceDraId)) return null;

  // THE ONLY construction path for the branded key. Both the key's shape and the
  // lifecycle locator's eligibility must hold, or the row does not parse.
  // BOTH REPRESENTATIVE PAIRS GO THROUGH THE ONE SANCTIONED PARSER, against the
  // SAME server-returned key.
  //
  // The row carries two coordinate pairs, and each is an IDENTITY ASSERTION by the
  // server: the SQL projects the same `g_lat5`/`g_lng5` into both blocks, and
  // derives `canonical_cluster_id` from exactly those values. So each pair must
  // stand on its own against that key, and `parseServerClusterIdentity` is the
  // only place allowed to make that judgement.
  //
  // WHY THIS REPLACED A DIRECT COMPARISON, and why the seam is now gone rather
  // than patched. Previously only the LIFECYCLE pair was parsed; the preview pair
  // got a bare eligibility check and then a `previewLat !== identity...` test.
  // That hand-rolled comparison was a SECOND, WEAKER copy of a rule the parser
  // already owns, and it drifted from it in the predictable way -- `-0 !== 0` is
  // FALSE, so a `-0` preview latitude against a `+0` lifecycle latitude compared
  // EQUAL and the row was accepted. Three separate signed-zero defects were found
  // at three separate seams before it became clear the problem was having more
  // than one comparison site at all.
  //
  // EQUALITY IS NOW TRANSITIVE, not asserted. `parseServerClusterIdentity`
  // requires each pair to match the key EXACTLY (`Object.is`, with a negative-zero
  // domain guard on the key). Both pairs are parsed against the SAME key, so
  // `preview === key === lifecycle` follows, signed zero included. There is
  // nothing left to compare directly, which is why the direct comparison is gone
  // rather than upgraded -- keeping it would restore the second site this change
  // exists to remove.
  //
  // The eligibility check the preview pair used to get separately is subsumed:
  // `parseServerClusterIdentity` applies `isEligibleRepresentativeCoordinate`
  // itself, so a preview latitude of 500 still fails, now by the same route as
  // every other producer-domain rule.
  const identity = parseServerClusterIdentity(
    row.canonical_cluster_id,
    row.lifecycle_representative_latitude,
    row.lifecycle_representative_longitude,
  );
  if (identity === null) return null;

  const previewIdentity = parseServerClusterIdentity(
    row.canonical_cluster_id,
    row.preview_representative_latitude,
    row.preview_representative_longitude,
  );
  if (previewIdentity === null) return null;

  // THE PARSED VALUES, never the raw row fields. Validating one value and then
  // returning another is how a check becomes decorative; these are the numbers the
  // parser actually vetted.
  const previewLat = previewIdentity.representative.latitude;
  const previewLng = previewIdentity.representative.longitude;

  // THE PREVIEW TIER IS THE LITERAL 'medium', not any tier.
  //
  // The preview population is medium-only BY CONSTRUCTION, so the SQL emits
  // `'medium'::text` -- a constant, not a computed value. Accepting the whole enum
  // let a malformed response render an impossible tier in both the table and the
  // map marker without incrementing `unparsableRowCount`.
  const previewTier = row.preview_coordinate_quality_tier;
  if (previewTier !== 'medium') return null;

  const counts = {
    preview_sample_count_total: asCount(row.preview_sample_count_total),
    preview_sample_count_high: asCount(row.preview_sample_count_high),
    preview_sample_count_medium: asCount(row.preview_sample_count_medium),
    preview_sample_count_low: asCount(row.preview_sample_count_low),
    preview_distinct_point_count: asCount(row.preview_distinct_point_count),
    lifecycle_sample_count_total: asCount(row.lifecycle_sample_count_total),
    lifecycle_sample_count_high: asCount(row.lifecycle_sample_count_high),
    lifecycle_sample_count_medium: asCount(row.lifecycle_sample_count_medium),
    lifecycle_sample_count_low: asCount(row.lifecycle_sample_count_low),
    lifecycle_distinct_point_count: asCount(row.lifecycle_distinct_point_count),
  };
  for (const n of Object.values(counts)) {
    if (n === null) return null;
  }
  const c = counts as { readonly [K in keyof typeof counts]: number };

  // CROSS-FIELD INVARIANTS.
  //
  // Each count is individually a non-negative integer by this point, which a
  // holistic review showed is still too loose for a trust boundary: the SQL emits
  // these fields in FIXED RELATIONSHIPS, so a malformed or version-skewed
  // SUCCESSFUL response can satisfy every per-field check and still describe a row
  // this function's own producer could never emit. Such a row looks COMPLETE -- it
  // does not increment `unparsableRowCount` -- so the page renders a snapshot SQL
  // would never produce and leaves the lifecycle write controls enabled on it.
  //
  // Every check below is pinned to a specific emission in
  // `fetch_admin_site_aggregate_live_preview`:
  //   - preview high and low are the LITERALS `0::integer`;
  //   - preview total and preview medium are the SAME filtered count expression;
  //   - both distinct-point counts are the LITERAL `1::integer`;
  //   - lifecycle total is `count(*)` over a population whose
  //     `coordinate_quality_tier` is `NOT NULL CHECK IN ('high','medium','low')`,
  //     so the three filtered counts PARTITION it exactly.
  if (c.preview_sample_count_high !== 0) return null;
  if (c.preview_sample_count_low !== 0) return null;
  if (c.preview_sample_count_medium !== c.preview_sample_count_total) return null;
  //
  // "PREVIEW TOTAL EQUALS HIGH + MEDIUM + LOW" IS ENFORCED HERE, by the three
  // checks above, and is deliberately NOT written as a fourth branch.
  //
  // PROOF that it is enforced: every count has already passed `asCount`, so all
  // are non-negative integers. A row surviving the three checks has `high = 0`,
  // `low = 0` and `medium = total`, hence `high + medium + low = total`
  // unconditionally. Contrapositive: any row whose preview counts do not sum to
  // the total must violate at least one of the three, so it is rejected.
  //
  // WHY NOT ALSO ASSERT THE SUM. The four statements have rank 2, not 4: adding
  // the sum as its own branch makes each of the three above individually
  // UNFALSIFIABLE, because every single-field mutation that breaks one also
  // breaks the sum, so reverting any one check on its own would leave the suite
  // green. Enforcing the same invariant through the three checks the SQL
  // literally emits keeps each one pinned by a mutation only it rejects -- which
  // is the property that makes these tests worth having. The lifecycle sum below
  // IS a separate branch, because there the three tier counts are genuinely
  // independent aggregates and no other check implies their partition.
  if (c.preview_distinct_point_count !== 1) return null;
  if (c.lifecycle_distinct_point_count !== 1) return null;
  // INDEPENDENT, unlike the preview sum: the three lifecycle tier counts are
  // genuinely separate filtered aggregates, so a skewed response can break this
  // partition without violating any other check here.
  if (
    c.lifecycle_sample_count_total !==
    c.lifecycle_sample_count_high + c.lifecycle_sample_count_medium + c.lifecycle_sample_count_low
  ) {
    return null;
  }
  // THE TWO MEDIUM COUNTS ARE THE SAME AGGREGATE. `g_prev_medium` and
  // `g_life_medium` are both `count(*) FILTER (WHERE b_tier = 'medium')` over the
  // same GROUP BY, so they cannot differ. This one was not in the review's list;
  // it is the same class as the others and is included because the rule is "every
  // relationship the SQL emits", not "every relationship someone happened to name".
  if (c.preview_sample_count_medium !== c.lifecycle_sample_count_medium) return null;
  // A PREVIEW ROW HAS AT LEAST ONE MEDIUM SAMPLE, by the SQL's row scope:
  // `HAVING count(*) FILTER (WHERE b_tier = 'medium') > 0`. A cluster with none
  // is not previewable and cannot appear. Zero here passed every other check
  // (high and low are zero, medium equals total, the tier still derives from the
  // lifecycle counts) while naming an action the upsert's own medium-sample
  // guard is guaranteed to reject -- so the operator would be offered a write
  // that cannot succeed, and no unreadable evidence would be recorded.
  if (c.preview_sample_count_medium < 1) return null;

  // THE LIFECYCLE TIER MUST BE THE ONE THE COUNTS IMPLY.
  //
  // This field was originally read with `asNullableText`, which accepted any
  // string. Tightening it to enum MEMBERSHIP was still too weak, because the tier
  // is not independent data -- the SQL computes it from the three lifecycle counts
  // in this same row. A review showed this module's own control fixture violated
  // it (counts 3/6/1 with tier `high`, where the CASE necessarily yields
  // `medium`), so a malformed response could display a lifecycle snapshot SQL
  // never produced while the write controls stayed enabled.
  //
  // ONE CHECK, NOT THREE. A separate `typeof` test and a separate enum-membership
  // test would both be unfalsifiable next to this one: a non-string and a
  // non-member alike fail the equality below, so neither could be pinned by a test
  // that this check does not already catch. The comparison also does the narrowing
  // that the enum test used to justify, which is why no cast is needed.
  const expectedTier = dominantLifecycleTier(
    c.lifecycle_sample_count_high,
    c.lifecycle_sample_count_medium,
    c.lifecycle_sample_count_low,
  );
  // Unreachable via the SQL -- `HAVING count(*) FILTER (medium) > 0` guarantees a
  // non-zero medium count -- so a row landing here is malformed. Fail closed.
  if (expectedTier === null) return null;
  if (row.lifecycle_coordinate_quality_tier !== expectedTier) return null;

  // NULLABLE TEXT: validated BEFORE the row is built, so a wrong-typed value
  // cannot reach the return as a silent `null`. The coordinate sources are
  // provenance for what the upsert would persist.
  const sourceDraTitle = asNullableText(row.source_dra_title);
  const previewSource = asNullableText(row.preview_coordinate_source);
  const lifecycleSource = asNullableText(row.lifecycle_coordinate_source);
  if (
    sourceDraTitle === INVALID_TEXT ||
    previewSource === INVALID_TEXT ||
    lifecycleSource === INVALID_TEXT
  ) {
    return null;
  }
  // A NON-NULL PREVIEW SOURCE IMPLIES A NON-NULL LIFECYCLE SOURCE.
  //
  // The two are the same `string_agg` over the same group, except that the
  // preview's filter adds `b_tier = 'medium'` -- a strict SUBSET of the
  // lifecycle's filter. So any row contributing a preview source also
  // contributes a lifecycle source, and the reverse pairing is unreachable.
  // Accepting it left the actions enabled while the proposal omitted provenance
  // the upsert would go on to recompute and persist as non-null.
  // ---------------------------------------------------------------------
  // PROVENANCE, validated as SETS rather than as flattened text.
  //
  // The earlier revision compared only the text fields, and could not do better:
  // `coordinate_source` is free-form and may contain the '; ' separator, so the
  // flattened string is a LOSSY serialization that cannot be split back into the
  // set that produced it. A split-based subset test would have been able to
  // reject legitimate database output -- the same class of error as validating
  // uuids more strictly than PostgreSQL does. The RPC now returns the sets
  // themselves, and the text is demoted to a rendering of them.
  // ---------------------------------------------------------------------
  const previewSources = asSourceArray(row.preview_coordinate_sources);
  const lifecycleSources = asSourceArray(row.lifecycle_coordinate_sources);
  if (previewSources === INVALID_SOURCES || lifecycleSources === INVALID_SOURCES) return null;

  // NULLABILITY IS A BICONDITIONAL. Both columns come from the same FILTER over
  // the same population, so the text and the array are null together or neither
  // is. One without the other is a version-skewed response.
  if ((previewSource === null) !== (previewSources === null)) return null;
  if ((lifecycleSource === null) !== (lifecycleSources === null)) return null;

  // THE TEXT MUST BE A FAITHFUL RENDERING OF THE ARRAY -- checked in the safe
  // direction. Joining the array and comparing is exact even when an element
  // contains the separator; splitting the text and comparing sets would not be.
  if (previewSources !== null && previewSource !== previewSources.join(SOURCE_TEXT_SEPARATOR)) {
    return null;
  }
  if (
    lifecycleSources !== null &&
    lifecycleSource !== lifecycleSources.join(SOURCE_TEXT_SEPARATOR)
  ) {
    return null;
  }

  // THE PREVIEW SET IS A SUBSET OF THE LIFECYCLE SET, because the preview
  // population is the medium-tier subset of the lifecycle population and both
  // aggregates apply the same non-blank filter. A preview source absent from the
  // lifecycle set means the panel is showing provenance the upsert would not
  // persist.
  //
  // This also SUBSUMES the previous "non-null preview source implies a non-null
  // lifecycle source" check, which is why that check is gone rather than kept
  // alongside: a non-null preview array is non-empty, so a null lifecycle array
  // cannot contain its elements. Keeping both would leave a branch no test could
  // fail on its own.
  if (previewSources !== null) {
    const lifecycleSet = new Set(lifecycleSources ?? []);
    for (const source of previewSources) {
      if (!lifecycleSet.has(source)) return null;
    }
  }

  // WHEN THE TWO POPULATIONS COINCIDE, THE SETS ARE EQUAL, not merely nested.
  //
  // The lifecycle counts have already been proven to partition the lifecycle
  // total, so `high === 0 && low === 0` means every lifecycle row is medium-tier
  // -- the SAME rows the preview aggregates. Subset alone would still admit a
  // lifecycle set with extra members, which that population cannot produce.
  if (c.lifecycle_sample_count_high === 0 && c.lifecycle_sample_count_low === 0) {
    const previewLen = previewSources?.length ?? -1;
    const lifecycleLen = lifecycleSources?.length ?? -1;
    if (previewLen !== lifecycleLen) return null;
  }

  return {
    aggregate_id: `${sourceDraId}:${identity.canonicalClusterId}`,
    source_dra_id: sourceDraId,
    source_dra_title: sourceDraTitle,
    canonical_cluster_id: identity.canonicalClusterId,

    preview_representative_latitude: previewLat,
    preview_representative_longitude: previewLng,
    // No cast: the `!== 'medium'` guard above narrows this to the literal type.
    preview_coordinate_quality_tier: previewTier,
    preview_coordinate_source: previewSource,
    preview_coordinate_sources: previewSources,
    preview_sample_count_total: c.preview_sample_count_total,
    preview_sample_count_high: c.preview_sample_count_high,
    preview_sample_count_medium: c.preview_sample_count_medium,
    preview_sample_count_low: c.preview_sample_count_low,
    preview_distinct_point_count: c.preview_distinct_point_count,

    lifecycle_representative: identity.representative,
    // The DERIVED value, not the transmitted one -- they were just proven equal,
    // and returning the derived one makes the SQL the authority here too.
    lifecycle_coordinate_quality_tier: expectedTier,
    lifecycle_coordinate_source: lifecycleSource,
    lifecycle_coordinate_sources: lifecycleSources,
    lifecycle_sample_count_total: c.lifecycle_sample_count_total,
    lifecycle_sample_count_high: c.lifecycle_sample_count_high,
    lifecycle_sample_count_medium: c.lifecycle_sample_count_medium,
    lifecycle_sample_count_low: c.lifecycle_sample_count_low,
    lifecycle_distinct_point_count: c.lifecycle_distinct_point_count,
  };
}

export interface LivePreviewLoad {
  rows: LivePreviewRow[];
  /** True when the page ceiling was reached with a full final page. */
  truncated: boolean;
  /**
   * Rows the server returned that this build could not parse. NON-ZERO IS AN
   * EVIDENCE GAP, not an absence: the page must degrade exactly as it does for a
   * truncated read rather than render a silently short table.
   */
  unparsableRowCount: number;
  loadError: string | null;
}

/**
 * Keyset traversal of the live-preview RPC.
 *
 * The cursor advances by the LAST RETURNED ROW's `(source_dra_id,
 * canonical_cluster_id)` -- taken from the RAW row, deliberately, so a row this
 * build cannot parse still advances the cursor correctly and cannot cause an
 * infinite loop on the same page.
 */
export async function loadAdminLivePreview(
  client: AdminLoaderClient,
): Promise<LivePreviewLoad> {
  const rows: LivePreviewRow[] = [];
  let truncated = false;
  let unparsableRowCount = 0;
  let loadError: string | null = null;

  let afterSourceDraId: string | null = null;
  let afterCanonicalCluster: string | null = null;
  // Carried ACROSS pages, not reset per page: a duplicate that straddles a page
  // boundary is the same defect as one inside a page.
  let lastKey: KeysetKey | null = null;
  let orderViolated = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await client
      .schema('matrix_map')
      .rpc(LIVE_PREVIEW_RPC, {
        // BOTH cursor fields or NEITHER. The SQL raises UE422 on a half-supplied
        // cursor rather than coercing it into a first page, so the two are
        // always advanced together.
        p_after_source_dra_id: afterSourceDraId,
        p_after_canonical_cluster: afterCanonicalCluster,
        p_limit: PAGE_SIZE,
      });

    if (error) {
      loadError = error.message ?? 'live preview load failed';
      break;
    }

    // FAIL CLOSED on a payload shape that is neither an array nor absent.
    //
    // This used to be `Array.isArray(data) ? data : []`, which FAILED OPEN: a
    // successful call returning a malformed or version-skewed non-array payload
    // -- an object, a string, a number -- became an empty page with no error and
    // no unreadable count, so the page reported a COMPLETE preview of zero rows
    // and would have re-enabled the lifecycle write controls on it. An empty
    // complete preview and an unreadable response must never look the same.
    //
    // AN ABSENT PAYLOAD IS ALSO A FAILURE, and this REVERSES an earlier decision
    // in this same module, so the reasoning is recorded rather than just the
    // outcome. `null`/`undefined` used to be accepted as an empty page, justified
    // by matching `loadAdminCandidates`'s `(data ?? [])` and by the claim that
    // this is "the shape PostgREST produces for an empty set". That claim is
    // WRONG for this call: a SET-RETURNING function's empty result is `[]`, an
    // empty JSON array, and PostgREST emits it as such. `null` from the client
    // accompanies an ERROR, and the error branch above has already handled that.
    //
    // So an absent payload on an otherwise successful call has no legitimate
    // meaning here, and accepting it as a COMPLETE page of zero rows was
    // fail-open on the one surface that gates writes: no error, no truncation, no
    // unreadable count, and the lifecycle controls re-enabled on evidence never
    // received. The consistency argument was the weaker one -- agreeing with a
    // looser sibling loader is not a safety property.
    //
    // `loadAdminCandidates` CARRIES THE SAME FIX, and an earlier version of this
    // comment was wrong to say otherwise. It claimed the candidate loader "does
    // not gate the write path", so widening the fix into it was out of scope. A
    // review disproved that from this repository's own code: an omitted candidate
    // looks "safely absent", so the page offers Create, which upserts and can
    // overwrite a curated label, and an omitted orphaned publication loses its
    // only Unpublish control. Both loaders now fail closed, each reporting on its
    // OWN error axis so a candidate failure still cannot blank a good preview.
    if (!Array.isArray(data)) {
      loadError =
        data === null || data === undefined
          ? 'live preview returned no payload where a row array was expected'
          : `live preview returned a ${typeof data} payload where a row array was expected`;
      break;
    }
    const rawRows: unknown[] = data;
    for (const raw of rawRows) {
      // THE KEYSET ORDER IS PART OF THE CONTRACT, so it is CHECKED.
      //
      // The RPC promises a strict total order on
      // `(source_dra_id, canonical_cluster_id COLLATE "C")`. This loop used to
      // append every row and decide completeness from PAGE LENGTH alone, which
      // trusted that promise without verifying it. A version-skewed or hostile
      // response that REPEATED or REORDERED rows was therefore accepted as
      // COMPLETE: the summary and map double-counted the duplicate, and the
      // table rendered two independent Create/Refresh controls pointing at the
      // SAME SQL identity -- two write paths for one cluster, from a read the
      // page reported as clean.
      //
      // Checked on the RAW row, deliberately, and BEFORE parsing: the ordering
      // is a property of the response, not of the rows this build can read, so
      // an unparsable row must not create a gap in the check.
      const keys = rawKeysetKey(raw);
      if (keys === null) {
        // Missing either cursor half: the row is both UNREADABLE and
        // UNORDERABLE. Counted ONCE here -- `parseLivePreviewRow` would also
        // reject it, and an earlier revision of this loop double-counted exactly
        // this row -- then the traversal stops, because a key-less row cannot be
        // ordered against and the cursor cannot advance past it.
        unparsableRowCount += 1;
        orderViolated = true;
        break;
      }
      if (lastKey !== null && compareKeyset(lastKey, keys) >= 0) {
        // FAIL CLOSED as INCOMPLETE rather than dropping the row. The traversal
        // genuinely cannot be trusted past this point, and `truncated` is the
        // existing signal the page already degrades on.
        orderViolated = true;
        break;
      }
      lastKey = keys;

      const parsed = parseLivePreviewRow(raw);
      if (parsed === null) {
        unparsableRowCount += 1;
        continue;
      }
      rows.push(parsed);
    }
    if (orderViolated) {
      truncated = true;
      break;
    }

    // TRUNCATION IS EXPLICIT: a short page means the traversal is complete.
    if (rawRows.length < PAGE_SIZE) break;

    const last = rawRows[rawRows.length - 1] as Record<string, unknown> | undefined;
    const nextDraId = last && typeof last.source_dra_id === 'string' ? last.source_dra_id : null;
    const nextCluster =
      last && typeof last.canonical_cluster_id === 'string' ? last.canonical_cluster_id : null;
    if (nextDraId === null || nextCluster === null) {
      // A full page whose last row carries no usable cursor cannot be advanced
      // past. Stop and report the read as incomplete rather than re-requesting
      // the same page forever.
      //
      // NO increment here. `parseLivePreviewRow` REQUIRES both cursor fields, so
      // a last row missing either has already failed to parse and has already
      // been counted in the loop above. Incrementing again reported two
      // unreadable rows for a page containing one -- a review caught it, and the
      // test that covered this path masked it by asserting only `> 0`.
      truncated = true;
      break;
    }
    afterSourceDraId = nextDraId;
    afterCanonicalCluster = nextCluster;

    if (page === MAX_PAGES - 1) truncated = true;
  }

  return { rows, truncated, unparsableRowCount, loadError };
}

/**
 * DISPLAY ORDER, which is NOT the traversal order.
 *
 * The RPC returns rows in its keyset total order `(source_dra_id,
 * canonical_cluster_id COLLATE "C")` -- that ordering is load-bearing for
 * PAGINATION and must not change. But the admin table has always been sorted by
 * SAMPLE COUNT DESCENDING, and its own subtitle says so, because the whole point
 * of the surface is to show the worst-stacking sites first.
 *
 * A review caught that rendering the traversal order directly silently regressed
 * that: the caption still claimed sample-count ordering while the table showed
 * DRA order. The tie-break on `aggregate_id` reproduces
 * `computeSiteAggregates`'s previous behaviour exactly, so repeated renders are
 * byte-identical.
 *
 * Sorting a COPY, deliberately: the caller's array is the traversal result and
 * nothing else should observe a reordered version of it.
 */
export function sortPreviewRowsForDisplay(
  rows: readonly LivePreviewRow[],
): LivePreviewRow[] {
  return [...rows].sort((x, y) =>
    y.preview_sample_count_total !== x.preview_sample_count_total
      ? y.preview_sample_count_total - x.preview_sample_count_total
      : x.aggregate_id.localeCompare(y.aggregate_id),
  );
}

/** Combined read-only evidence the F2 admin surface needs, in one orchestration. */
export interface LiveAdminSurfaceLoad<TCandidate> {
  preview: LivePreviewLoad;
  candidates: TCandidate[];
  candidatesTruncated: boolean;
  /** CANDIDATE-side error, deliberately kept separate from the preview's. */
  candidateError: string | null;
}

/**
 * THE ONE ORCHESTRATION the F2 admin page invokes.
 *
 * Replaces `loadSiteAggregateAdminSurface`, which paged `matrix_map.samples` and
 * `matrix_map.dras` so the page could cluster them in TypeScript. Neither read
 * happens any more: the live-preview RPC groups server-side and returns the
 * canonical key, so the admin page never sees a raw sample row at all. That is a
 * containment improvement as well as the F2 correctness fix -- there is no longer
 * a sample projection on this surface that could widen.
 *
 * Extracted for the same reason as its predecessor: so that "the page actually
 * invokes the loaders" is provable by EXECUTION rather than by reading source.
 *
 * ERROR ROUTING IS PRESERVED. The preview error and the candidate error stay on
 * separate axes, because a failing candidate RPC must never blank a preview that
 * loaded fine -- and while the Option C SQL is unapplied, a failing candidate RPC
 * is the DEFAULT state, not an edge case.
 */
export async function loadSiteAggregateLiveAdminSurface<TCandidate>(
  client: AdminLoaderClient,
): Promise<LiveAdminSurfaceLoad<TCandidate>> {
  const preview = await loadAdminLivePreview(client);
  const { candidates, candidatesTruncated, candidateError } =
    await loadAdminCandidates<TCandidate>(client);
  return { preview, candidates, candidatesTruncated, candidateError };
}
