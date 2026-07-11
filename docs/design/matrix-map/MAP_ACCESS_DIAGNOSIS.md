# MAP ACCESS DIAGNOSIS

## Diagnosis Justifying the Cap Raise

**PROBLEM:** The province-wide admin view has 4486 valid samples, but the RPC `fetch_samples_with_hidden_summary` caps visible rows at `v_cap = 2500` (LIMIT 2500). As a result, 1986 rows are silently dropped for admins and granted viewers. (Note: Members who are non-allowlisted are governed separately by RLS / DRA visibility, with 0 public DRAs currently available. This is a SEPARATE issue and is not fixed by the cap raise).

**IMPACT:** Admins under-see the dataset. While the honest `truncated` flag and the "Showing N of M -- zoom in to see all" banner already fire, for a province-wide view there is no zoom level that recovers the dropped 1986 samples without paging by geography.

| Metric | Value |
|--------|-------|
| Current Valid Samples (Admin View) | 4486 |
| Current `v_cap` Limit | 2500 |
| Dropped Samples | 1986 |

**ROOT CAUSE:** The `v_cap` constant is simply too low for the current dataset size.

**SCOPE NOTE:** This is a cap-constant change only. Every auth, allowlist, admin, visibility predicate, and the province-wide (spatial-oracle-safe) hidden-summary aggregate are entirely unchanged.

## References
- The fix packet: [CAP_MIGRATION_OWNER_PACKET.md](./CAP_MIGRATION_OWNER_PACKET.md)
- The future-pagination spec: [MAP_CAP_PAGINATION_SPEC.md](./MAP_CAP_PAGINATION_SPEC.md)
