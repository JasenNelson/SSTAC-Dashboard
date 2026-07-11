
# T16: Matrix Map coordinate/sediment provenance QA (READ-ONLY)

Date: 2026-07-11
Project: qyrhsieynzfgyuqzznap (matrix_map schema, live Supabase)
Method: SELECT-only queries via `mcp__supabase-project-scoped__execute_sql`. No writes were
performed. All numbers below are direct query results, not estimates.

## 1. Schema used (from `list_tables` on schema `matrix_map`)

- `matrix_map.dras` (574 rows) -- DRA source documents. `public` boolean (default false),
  `is_deleted` soft-delete flag.
- `matrix_map.samples` (4494 rows) -- sampling stations. Key columns:
  `geometry` (geography point), `longitude`/`latitude` (durable float8 mirrors),
  `coordinate_quality_tier` (check: high/medium/low), `coordinate_source` (free text:
  surveyed / bc_csr_centroid / manual_steward / waterbody_derived / other),
  `classification` (reference/impacted/unknown), `waterbody_type` (free text, nullable),
  `source_dra_id` (FK to dras), `public` boolean (denormalized from source DRA).
- `matrix_map.sample_events` (559 rows) -- one row per sampling visit, FK `sample_id`.
- `matrix_map.measurements` (13631 rows) -- per-analyte measurements, FK `sample_event_id`,
  column `medium` (check: sediment/water/tissue/toxicity/community).
- `matrix_map.private_data_grants` (0 rows) -- per-user per-DRA access grants.
- `matrix_map.dra_visibility_audit`, `service_role_audit`, `export_audit`,
  `budget_dimension`, `budget_caps`, `layers` (18, seeded for UI, not queried further here),
  `classification_overrides` (0 rows) -- not central to this QA.

Note: `medium` lives on `measurements`, not on `samples` directly -- a sample's "medium" is
derived by joining through `sample_events -> measurements`.

## 2. Totals

- Total samples: **4494**
- Total DRAs: **574**
- Samples with non-null latitude AND longitude: **4494** (100%)
- Samples with non-null `geometry`: **4494** (100%)
- Samples with zero measurement rows at all (no sample_event->measurement chain): **3982**
  of 4494 (88.6%) -- i.e. most mapped points carry a station record with coordinates but no
  attached chemistry/toxicity/community measurement in the current load.

## 3. Coordinate quality tier / coordinate source

`coordinate_quality_tier`:
| tier | n | pct |
|---|---|---|
| medium | 4426 | 98.49% |
| high | 68 | 1.51% |
| low | 0 | 0.00% |

`coordinate_source`:
| source | n | pct |
|---|---|---|
| bc_csr_centroid | 4426 | 98.49% |
| surveyed | 68 | 1.51% |

These two breakdowns are 1:1 (bc_csr_centroid <-> medium tier; surveyed <-> high tier). No
`low` / `manual_steward` / `waterbody_derived` / `other` rows exist in the live table.
Prior finding of "~98.5% may be upland/centroid" is CONFIRMED at the DB level: 98.49% of all
4494 mapped samples carry BC Contaminated Sites Registry (CSR) centroid coordinates, not
surveyed field coordinates. Only 68 samples (1.51%) have a `surveyed` coordinate_source.

## 4. Medium and waterbody_type

Medium (distinct samples reachable via sample_events -> measurements, by medium):
| medium | distinct_samples | measurement_rows |
|---|---|---|
| sediment | 503 | 13122 |
| toxicity | 97 | 334 |
| community | 60 | 175 |
| water | 0 | 0 |
| tissue | 0 | 0 |

(A sample can appear in more than one medium bucket, so these do not sum to 4494; total
distinct samples with ANY measurement = 4494 - 3982 = 512.)

`waterbody_type` (raw values, casing preserved as stored):
| waterbody_type | n | pct |
|---|---|---|
| '' (empty string) | 4204 | 93.55% |
| Marine | 243 | 5.41% |
| marine | 25 | 0.56% |
| freshwater | 14 | 0.31% |
| Freshwater | 8 | 0.18% |

Confirmed empty/blank rate: **93.55%** (4204/4494) -- matches prior finding of ~93.5% empty.
Note the stored empty value is an empty string `''`, not SQL NULL (a combined NULL-or-blank
check returns the same 4204/4494 = 93.55%, so there is no separate population of NULL rows
distinct from blank-string rows). Casing is inconsistent: "Marine" (243) vs "marine" (25) are
stored as distinct string values, and "Freshwater" (8) vs "freshwater" (14) likewise -- any
consumer filtering on `waterbody_type = 'Marine'` will silently miss the lowercase rows unless
it normalizes case first.

## 5. Cross-tab: coordinate tier x medium, sediment only

Restricting to samples that have at least one `medium = 'sediment'` measurement (503 distinct
samples, per section 4):

| coordinate_quality_tier | n_sediment_samples |
|---|---|
| medium (bc_csr_centroid) | 463 |
| high (surveyed) | 40 |

So of the 503 samples carrying real sediment chemistry data, only 40 (7.95%) have surveyed
field coordinates; the remaining 463 (92.05%) are plotted at a BC CSR site centroid, not the
actual sediment sampling location. Every "high" (surveyed) sample in the whole table (68 of
them) is disproportionately concentrated toward sediment-bearing samples relative to the
overall population, but centroid approximation is still the overwhelming majority even within
the subset that has real sediment measurements.

## 6. Classification (context, not requested but relevant to interpreting the map)

| classification | n |
|---|---|
| unknown | 4380 |
| impacted | 99 |
| reference | 15 |

The large "unknown" bucket is consistent with section 2's finding that ~88.6% of samples have
no attached measurement chain at all (DRA-silent or sampling-type stations per the classification_source
semantics documented on the `samples` table).

## 7. DRA visibility / non-admin visibility

- DRAs by `public`: **false = 574**, true = 0. **All 574 DRAs are private** (0 public).
- Samples by `public`: **false = 4494**, true = 0. **All 4494 samples are private.**
- `is_deleted = true` DRAs: 0.
- Active (non-revoked) rows in `private_data_grants`: **0**.

Per the documented RLS contract on `matrix_map.samples` (denormalized `public` gated by
`dras.public OR has_private_grant`), and given public=false on every DRA and every sample, and
zero active grants, a non-admin/non-privileged authenticated user (or anonymous user) would see
**0 mapped samples** under the standard RLS policy. This matches the prior finding referenced
in the task brief.

## 8. What the mapped points represent (characterization, no fixes proposed)

- The Matrix Map currently plots 4494 station records across 574 source DRAs, and every single
  one has a non-null lat/lng, so "100% mapped" is true at the coordinate-presence level.
- However, the overwhelming majority of those coordinates (98.49% overall; 92.05% within the
  sediment-bearing subset) are **BC Contaminated Sites Registry site centroids**
  (`coordinate_source = 'bc_csr_centroid'`), not surveyed field sampling positions. A centroid
  point represents "somewhere on this DRA's registered site," not the actual location where
  sediment (or any other medium) was collected. Only 68 of 4494 samples (1.51%) carry a
  `surveyed` coordinate_source, and only 40 of those are sediment-bearing.
- Most mapped points (3982 of 4494, 88.6%) have no attached measurement at all in the current
  live load -- they are station/geometry records only, with no sediment chemistry, toxicity, or
  community data behind them yet. Of the samples that DO carry real data, sediment chemistry
  dominates (503 samples / 13122 measurement rows) versus toxicity (97 samples) and community
  (60 samples); water and tissue media have zero rows loaded.
- `waterbody_type` is populated on only 6.45% of samples (290/4494) and even that minority has
  inconsistent casing ("Marine" vs "marine", "Freshwater" vs "freshwater"), which limits any
  filter or legend built on that field without a normalization step first.
- All DRAs and all samples are currently private (public=false) with zero active data grants,
  so a non-admin viewer of the live Matrix Map currently sees 0 points under RLS; only an
  admin/service-role context sees the full 4494.

## 9. Queries that could NOT be run read-only / need owner or admin context

- Determining exactly which samples a SPECIFIC non-admin authenticated user (as opposed to the
  generic "any non-privileged user" case) would see requires impersonating that user's JWT/role
  inside a policy-evaluation context (e.g. `SET ROLE` to `authenticated` plus a specific
  `auth.uid()`), which this read-only SQL-editor-style connection does not do -- it executes as
  a privileged role that bypasses RLS, so the numbers above are DERIVED from the raw `public`/
  grant columns and the documented RLS contract in the table comments, not from an actual RLS
  policy evaluation. If the owner wants a literal "run the query as user X" verification, that
  needs either a signed-in browser session test or an admin-run `SET ROLE authenticated; SET
  request.jwt.claims = ...` probe, which is out of scope for a SELECT-only MCP connection.
- No write/UPDATE/DELETE/DDL was attempted or needed; no blocked write-class questions arose
  in this task.

## Summary of headline numbers (verified live, 2026-07-11)

- Total samples: 4494 | Total DRAs: 574
- Samples with lat/lng: 4494 / 4494 (100%)
- Coordinate tier: medium (bc_csr_centroid) 4426 (98.49%) vs high (surveyed) 68 (1.51%); low = 0
- Sediment-bearing samples (503): centroid 463 (92.05%) vs surveyed 40 (7.95%)
- waterbody_type empty/blank: 4204 / 4494 (93.55%); populated values have casing inconsistencies
  (Marine/marine, Freshwater/freshwater)
- Samples with zero attached measurements: 3982 / 4494 (88.6%)
- DRA visibility: 0 public / 574 private; samples: 0 public / 4494 private; 0 active grants ->
  0 samples visible to a non-admin user under RLS
