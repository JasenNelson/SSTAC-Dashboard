# T18: matrix_map.samples.waterbody_type Normalization Report

Report only. No data was modified. All queries below are SELECT-only, run live
against Supabase project qyrhsieynzfgyuqzznap, schema matrix_map, table samples,
column waterbody_type, on 2026-07-11.

## 1. Total rows and empty rate

- Total rows in matrix_map.samples: 4494
- Rows with waterbody_type = '' (empty string): 4204
- Percent empty: 4204 / 4494 = 93.55%
- Rows with waterbody_type IS NULL: 0 (the empty values are all empty string '',
  not SQL NULL)
- Rows with leading/trailing whitespace variants (value <> trim(value)): 0
  (no whitespace-only duplicates beyond casing)

## 2. Full distinct-value distribution (exact counts, live query)

Query:
```sql
SELECT waterbody_type, count(*) AS n
FROM matrix_map.samples
GROUP BY waterbody_type
ORDER BY n DESC;
```

Result:

| waterbody_type (raw) | count |
|---|---|
| '' (empty string) | 4204 |
| Marine | 243 |
| marine | 25 |
| freshwater | 14 |
| Freshwater | 8 |

Total: 4204 + 243 + 25 + 14 + 8 = 4494 (matches total row count). Only 5 distinct
raw values exist. No estuarine, brackish, saline, tidal, or other synonym values
were found in the live data -- the variant space is limited to casing differences
on "Marine" and "Freshwater" plus the empty string.

Distinct non-empty canonical values (case/whitespace-folded via lower(trim(...))):
2 (marine, freshwater). Confirmed by live query
(`count(DISTINCT lower(trim(waterbody_type))) FILTER (WHERE ... <> '')` = 2).

## 3. Proposed canonical mapping (PROPOSAL ONLY -- not applied)

| Variant (raw value) | Proposed canonical |
|---|---|
| Marine | Marine |
| marine | Marine |
| Freshwater | Freshwater |
| freshwater | Freshwater |
| '' (empty) | left as-is (out of scope -- see section 5) |

No other variants (e.g. "MARINE", "Estuarine", "salt water", trailing-space
duplicates) were found in the live data as of this report. If future data entry
introduces new casing or synonym variants, this mapping table should be
re-derived from a fresh live query rather than assumed static.

## 4. Post-normalization bucket sizes (if the mapping in section 3 were applied)

Query:
```sql
SELECT
  CASE
    WHEN waterbody_type = '' THEN '(empty)'
    WHEN lower(trim(waterbody_type)) = 'marine' THEN 'Marine'
    WHEN lower(trim(waterbody_type)) = 'freshwater' THEN 'Freshwater'
    ELSE 'OTHER_UNMAPPED'
  END AS canonical_bucket,
  count(*) AS n
FROM matrix_map.samples
GROUP BY 1
ORDER BY n DESC;
```

Result:

| Canonical bucket | Row count after normalization |
|---|---|
| (empty) | 4204 |
| Marine | 268 (243 + 25) |
| Freshwater | 22 (14 + 8) |

No rows fall into an OTHER_UNMAPPED bucket -- the mapping in section 3 is
exhaustive for the current live data (4204 + 268 + 22 = 4494, matches total).

## 5. Two separate problems -- do not conflate

### (a) Casing/whitespace normalization -- small, safe, deterministic, but a DATA WRITE

Collapsing "marine" -> "Marine" (25 rows) and "freshwater" -> "Freshwater" (8 rows)
would touch 33 rows total (0.73% of the table). The mapping is deterministic and
low-risk (no ambiguous variants, no NULLs, no whitespace-only dupes to worry
about). However, per the SSTAC-Dashboard "no catalog mutation" / write-path rules
and this task's HARD RULE, this report proposes the mapping only. Any actual
UPDATE must be:
- authored as owner-run SQL (per `dashboard_supabase_project_scoped_mcp_live.md` --
  writes are owner-OK and scoped, this report does not attempt one), or
- run by the owner directly in Supabase Studio SQL Editor per the repo's
  documented Supabase write protocol.

No UPDATE was proposed as executable SQL in a form intended for AI self-execution;
if the owner wants ready-to-run SQL for this specific normalization, that is a
follow-up ask, not something this report performs.

### (b) The 93.55%-empty problem -- separate, larger, out of scope here

4204 of 4494 rows (93.55%) have no waterbody_type value at all. This is not a
casing problem -- there is no variant to normalize, the field was simply never
populated for these rows. Fixing this requires either:
- a source/derivation lane (e.g. spatial join against a waterbody boundary layer,
  or backfill from the original BN-RRM source records if the attribute exists
  upstream), or
- an owner decision on whether/how to backfill at all.

This is explicit-scope-deferred: a separate future decision, not something this
report attempts to size, design, or fix. This report only characterizes the
magnitude (93.55% empty, 4204 rows) so the owner has the number when scoping that
future lane.

## Summary

- Total rows: 4494
- Empty (''): 4204 (93.55%)
- Populated: 290 rows across 4 raw casing variants collapsing to 2 canonical
  values: Marine (268 after normalization: 243 "Marine" + 25 "marine")
  and Freshwater (22 after normalization: 14 "freshwater" + 8 "Freshwater")
- Casing normalization affects only 33 rows (25 marine + 8 Freshwater lowercase/
  mixed-case rows), is deterministic and low-risk, but remains a DATA WRITE --
  owner-gated, not an AI write, per repo protocol.
- The 93.55% empty problem is a separate, larger, out-of-scope issue needing a
  future source/derivation lane and owner decision.
