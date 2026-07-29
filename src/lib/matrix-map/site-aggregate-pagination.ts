/**
 * THE BOUNDED-PAGINATION AUTHORITY for the site-aggregate RPC consumers.
 *
 * These were module-local constants in three separate consumers. They are shared
 * here so the SQL RPCs' ceilings can be BOUND to them by a contract test rather
 * than restated as unrelated literals that drift apart.
 *
 * `matrix_map.fetch_published_site_aggregates` and
 * `matrix_map.fetch_admin_site_aggregate_publications` both reject
 * `p_limit > PAGE_SIZE` and `p_offset > MAX_PAGE_OFFSET` with UE422. Raising
 * either value here without raising the corresponding SQL ceiling would make the
 * last legitimate page fail closed; the contract test makes that a test failure
 * instead of a runtime one.
 */

/** Rows requested per page. Mirrors the SQL `c_max_limit` ceiling. */
export const PAGE_SIZE = 1000;

/** Hard ceiling so a data explosion cannot spin a consumer forever. */
export const MAX_PAGES = 25;

/**
 * The first row of the LAST legitimate page, and therefore the largest offset
 * any conforming consumer can ask for. The SQL side pins the same value as
 * `c_max_offset`.
 */
export const MAX_PAGE_OFFSET = (MAX_PAGES - 1) * PAGE_SIZE;

/** The exact argument pair every site-aggregate RPC call must be given. */
export interface SiteAggregatePageArgs {
  p_limit: number;
  p_offset: number;
}

/**
 * THE SOLE AUTHORITY for site-aggregate RPC pagination arguments.
 *
 * Every consumer passes this function's RETURN VALUE straight to `.rpc(...)`.
 * None of them may compute `page * PAGE_SIZE` itself or hand-build a
 * `{ p_limit, p_offset }` object -- that is what let three consumers drift apart
 * in the first place, and a contract test that merely looked for local numeric
 * constants could be evaded by renaming them.
 *
 * Consumers keep their own loop TERMINATION and FAILURE semantics: the member
 * loader surfaces a failure at the cap, and the admin loaders flag truncation.
 * Only the ARITHMETIC is centralised.
 *
 * THE CANDIDATE READBACK IS NOT A CONSUMER OF THIS MODULE. Post-commit
 * verification is an exact-ID lookup -- the upsert returns the persisted
 * publication id and the route reads that id back with p_limit 1, p_offset 0 --
 * so it has no page arithmetic, no ceiling, and cannot report
 * `verification_incomplete`, which was removed as unreachable. It paged this
 * collection until 2026-07-28; that was unsound, because OFFSET pages across
 * independent statements are not a snapshot.
 *
 * FAILS CLOSED on any page index that is not an integer in [0, MAX_PAGES - 1],
 * so an off-by-one or a computed index cannot silently produce an offset the SQL
 * ceiling would reject with UE422 at runtime.
 */
export function siteAggregatePageArgs(page: number): SiteAggregatePageArgs {
  if (!Number.isInteger(page)) {
    throw new RangeError(
      `site-aggregate page index must be an integer, got ${String(page)}`,
    );
  }
  if (page < 0 || page > MAX_PAGES - 1) {
    throw new RangeError(
      `site-aggregate page index must be within 0..${MAX_PAGES - 1}, got ${page}`,
    );
  }
  return { p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE };
}

/**
 * Every legal page index, in order. Consumers that want to iterate the whole
 * envelope use this rather than reconstructing the range, so the set of valid
 * indexes also has exactly one definition.
 */
export function siteAggregatePageIndexes(): number[] {
  return Array.from({ length: MAX_PAGES }, (_, page) => page);
}
