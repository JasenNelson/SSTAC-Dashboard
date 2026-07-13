# Matrix Map -- T32 waterbody_type Normalization: Owner Approval Packet (2026-07-12)

PREP-ONLY. This is a small (39-row) DATA WRITE to matrix_map.samples -- an owner STOP. No write was
executed to produce this packet. AI ran only the read-only preflight SELECT below (via project-scoped
MCP). TWO preconditions before any apply: (1) **MANDATORY codex gate** -- `/codex-review` GREEN on the
EXACT UPDATE SQL below (L0 1.3 + repo Supabase protocol: every data write is reviewed before an
owner-approved apply; owner approval alone is NOT sufficient); (2) explicit owner approval. Only then
may the exact UPDATE be applied via the project-scoped MCP execute_sql (small write, owner-OK per the
/supabase skill) or the pooler, using the verify-before-commit structure and postflight verification
below.

## Live preflight (SELECT-only, run 2026-07-12 via MCP -- matches the T18 doc exactly)
```sql
SELECT COALESCE(NULLIF(waterbody_type,''),'(empty)') AS waterbody_type, count(*)
FROM matrix_map.samples GROUP BY waterbody_type ORDER BY 2 DESC;
```
| waterbody_type | count |
|---|---|
| (empty) | 4204 |
| Marine | 243 |
| marine | 25 |
| freshwater | 14 |
| Freshwater | 8 |

## DECISION NEEDED
Approve normalizing the lowercase casing variants to Title Case so filtering works:
`marine` -> `Marine`, `freshwater` -> `Freshwater`. The 4204 empty-string rows are OUT OF SCOPE here
(a separate source/derivation lane, HITL item 8b). Target distribution: **Marine 268, Freshwater 22**.

## FLAG (doc arithmetic inconsistency -- surfaced, not silently corrected)
`docs/design/matrix-map/WATERBODY_TYPE_NORMALIZATION_2026_07_11.md` section 5(a) states the change
"would touch 33 rows total" (25 marine + 8 Freshwater). That is internally inconsistent with its own
section 2 table: the rows REQUIRING an UPDATE are the 25 lowercase `marine` + the 14 lowercase
`freshwater` = **39 rows**. The "8 Freshwater" it counted are ALREADY correctly Title-Cased and need
no UPDATE (updating them would be a no-op). Applying only "33 rows" by literally touching the 8
already-correct Freshwater rows would leave the 14 lowercase `freshwater` rows un-normalized and miss
the doc's own stated target (Freshwater 22). The SQL below correctly updates 39 rows to reach the
target. Owner: confirm 39 is the intended scope.

## Exact UPDATE (39 rows -- reaches Marine 268 / Freshwater 22)
VERIFY-BEFORE-COMMIT (the casing collapse is not individually reversible post-commit, so the
verification SELECT MUST run and be reviewed WHILE THE TRANSACTION IS STILL OPEN -- do NOT auto-COMMIT).
Run STEP A as one block; review its SELECT output; only then run STEP B.

STEP A -- apply inside an OPEN transaction + verify (does NOT commit):
```sql
BEGIN;
UPDATE matrix_map.samples SET waterbody_type = 'Marine'     WHERE waterbody_type = 'marine';      -- expect 25 rows
UPDATE matrix_map.samples SET waterbody_type = 'Freshwater' WHERE waterbody_type = 'freshwater';  -- expect 14 rows
-- In-transaction verification (MUST read Marine=268, Freshwater=22, and NO 'marine'/'freshwater' rows):
SELECT COALESCE(NULLIF(waterbody_type,''),'(empty)') AS waterbody_type, count(*)
  FROM matrix_map.samples GROUP BY waterbody_type ORDER BY 2 DESC;
```
STEP B -- ONLY if STEP A's SELECT is correct, commit; otherwise abort:
```sql
COMMIT;   -- (run ROLLBACK; instead if the distribution is wrong)
```
Note on tooling: run STEP A and STEP B as SEPARATE statements/calls in a session that holds the
transaction open between them (psql, or a Studio session). Do NOT paste `BEGIN ... COMMIT` as one
auto-committing block via a fire-and-forget `execute_sql` call, which would commit before the SELECT
can be reviewed. If the tool CANNOT hold an open transaction across calls, the non-transactional
fallback is permitted ONLY with a FRESH exactness check immediately before the UPDATEs (the report-time
preflight can be stale if any samples row changed since): run
`SELECT count(*) FILTER (WHERE waterbody_type='marine') AS marine, count(*) FILTER (WHERE
waterbody_type='freshwater') AS freshwater FROM matrix_map.samples;` and PROCEED ONLY IF it returns
EXACTLY marine=25, freshwater=14 (the approved 39-row scope). If either count differs, STOP and
re-scope -- do not run the UPDATEs, because the write would normalize rows outside the approved scope.
Only after that fresh check passes: apply the two UPDATEs, then the postflight SELECT. (The
transactional STEP A/STEP B path above is preferred precisely because it avoids this stale-preflight
window.)

## Postflight verification (run after COMMIT)
```sql
SELECT COALESCE(NULLIF(waterbody_type,''),'(empty)') AS waterbody_type, count(*)
FROM matrix_map.samples GROUP BY waterbody_type ORDER BY 2 DESC;
-- EXPECT: (empty) 4204, Marine 268, Freshwater 22.  (marine / freshwater rows = 0)
```

## Rollback (if needed)
```sql
-- The lowercase originals are recoverable only if not yet committed (use the BEGIN/COMMIT txn above
-- and verify before COMMIT). Post-commit, casing is not individually reversible by value alone
-- (both 'marine'->'Marine' collapse into the existing Marine set); if a rollback is required after
-- commit, restore from the matrix_map backup snapshot. Recommend verifying inside the transaction
-- BEFORE COMMIT so no post-commit rollback is needed.
```

## owner --apply required: YES (small data write)
## PASTE-READY APPROVAL SENTENCE
"I approve the T32 waterbody normalization: run the two UPDATEs (25 `marine`->`Marine`, 14
`freshwater`->`Freshwater`; 39 rows total) against matrix_map.samples inside a transaction, verify the
postflight distribution reads Marine 268 / Freshwater 22 before COMMIT, and report back. 39 rows is the
intended scope (the doc's '33' is superseded)."
