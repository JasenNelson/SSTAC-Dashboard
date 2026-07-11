# Matrix Map -- Data-Truth Status (2026-07-11)

Purpose: durable record of the Matrix Map data-access / coordinate-provenance / ETL truth,
derived from read-only Supabase diagnostics (project qyrhsieynzfgyuqzznap) verified 2026-07-11
against origin/main = 4506a4e. Supersedes conversational claims; every number here is from raw
SQL. Companion owner-decision detail: the data-truth run artifacts (session scratch) +
`docs/INDEX.md`.

## 1. Is the map showing sediment data? -- YES, but gated + mostly upland centroids

### Access (WHY most reviewers see nothing) -- BY DESIGN, not a bug
- matrix_map.dras: 574 total, **0 public, 574 private**; private_data_grants: **0**.
- The sole read RPC `matrix_map.fetch_samples_with_hidden_summary` (SECURITY DEFINER) shows a
  sample only if `(v_is_admin OR dra.public OR has_private_grant(dra))`.
- Consequence (verified): **55 members see 0 samples**; **4 admins see 2500 of 4486** (the
  province-wide visible list is capped at 2500). 8 samples are orphaned (null source_dra_id) and
  invisible to everyone. 4494 samples total -> 4486 valid (mappable) after the orphan exclusion.
- The lever that makes the map non-empty for members is an OWNER publication decision
  (`flip_dra_public`, audited). This is a real data-visibility change (owner-gated).

### The 2500 cap
- RPC constant `v_cap := 2500`. Admin province-wide total 4486 > 2500 -> **truncated (1986 rows
  dropped)**. Fix drafted (staged migration, owner-gated): raise cap 2500 -> 5000 via CREATE OR
  REPLACE (preserves owner + grants; hidden aggregate stays province-wide). DECOUPLED from
  publication -- proceeds independently once owner approves the SQL path.

### Spatial-oracle safety (verified PASS)
- The RPC's hidden_sample_count / hidden_dra_ids sub-queries are PROVINCE-WIDE and UNBBOXED;
  only the visible-row list is bbox/cap-scoped. Matches the standing rule (no spatial oracle).

## 2. Coordinate provenance -- honest, mostly approximate centroids
- **bc_csr_centroid / medium tier = 4426 (98.5%)** (BC-CSR registry SITE centroids on the upland
  parcel, "approximate -- not surveyed"); **surveyed / high tier = 68 (1.5%)**.
- 4494 samples collapse to only **187 distinct coordinates**; one centroid is shared by **476
  stations**. Surveyed points are 1:1 (68 samples = 68 locations).
- Integrity: 0 null / 0 zero / 0 out-of-BC-bbox / 0 null-geometry. No coordinate is "wrong"; the
  issue is PROVENANCE (centroid vs surveyed) + VISIBILITY, not corruption. Do NOT "fix" centroids.
- waterbody_type empty for ~93.5%; populated values casing-inconsistent (Marine/marine).
- UI already distinguishes tiers (dash markers + legend + popup "Surveyed / Centroid / Manual")
  and shows an honest "Showing N of M -- zoom in" truncation banner + a partial-visibility banner.

## 3. ETL / load -- idempotent; missingness by-design; schema/RLS applied
- measurements 13631 (sediment 13122, toxicity 334, community 175); sample_events 559 (ALL exact-
  dated, 0 undated in DB); 2899 censored (detection-limit) retained; 0 null values.
- FORCE RLS on all 13 matrix_map tables; BYPASSRLS role `matrix_map_owner`; `authenticated` has
  SELECT (+ INSERT on private_data_grants only). Audit tables present (dra_visibility_audit,
  export_audit, service_role_audit); grants have soft-revoke columns.
- Zero duplicate natural keys (samples 4494/4494, measurements 13631/13631 distinct) -> idempotent.
- Deliberate exclusions (manifest-side, not in DB): undated events (~6742 measurements),
  junk-gate (~3478 stations). In-DB: 8 orphan samples / 79 no-DRA measurements (invisible).
- `matrix_map_backup_20260624` schema (13 tables, ~8746 rows) exists (pre-live-load backup).

## 4. Owner decisions outstanding (see session owner-decision packet)
1. Publication scope + path (bulk vs curated; audited admin-JWT path vs SQL-Editor bulk).
2. Approve the 2500->5000 cap migration (SQL-Editor apply).
3. ETL: load undated (~6742)? attach/unhide the 8 orphan samples? drop the backup schema?
4. Coordinate remediation lane (surveyed enrichment) -- future, report-only now.
5. T20 design question: should centroid (medium-tier) rows be excluded from station STATISTICS?
   Note: coordinate accuracy != chemistry validity -- excluding centroids would drop 98.5% of
   valid chemistry from UCLs; likely wrong for concentration stats. Owner to clarify intent.

## 5. What was verified NOT to need work
- Truncation banner (T14): already present (MatrixMap.tsx). Provenance markers/legend (T19):
  already present (tier-based). Spatial-oracle (T16): safe. Schema/RLS/grants (T24): applied.
- Health page NOW surfaces reviewer effective visibility (this run; PR feat/matrix-map-health-
  reviewer-visibility-2026-07-11).
