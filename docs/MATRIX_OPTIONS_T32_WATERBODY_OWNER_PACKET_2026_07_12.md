# Matrix Map -- T32 waterbody_type Normalization: Owner Approval Packet (2026-07-12)

> **STATUS: APPLIED 2026-07-13** (owner-approved). The exact id-keyed, `LOCK`+`lock_timeout`,
> rowcount-asserted, full-distribution-postcondition, fail-closed DO block (with `updated_at = now()`)
> was executed via the owner-approved project-scoped MCP path. codex-reviewed to GREEN (7 rounds).
> **Postflight evidence:** Marine **268**, Freshwater **22**, lowercase `marine`/`freshwater` **0**,
> `(empty)` **4204**, total samples **4494** (unchanged). Rows changed: +25 Marine, +14 Freshwater (39).
> No other production mutation. An exact id-keyed fail-closed ROLLBACK DO block is on file if needed.
> The prep-only text below is retained as the pre-apply record.

## OPERATION AS APPLIED 2026-07-13 (committed source of truth -- EXACT SQL that ran)

```sql
DO $$
DECLARE
  n_marine int; n_fresh int; final_marine int; final_fresh int; n_lower int; n_empty int; n_total int;
  marine_ids uuid[] := ARRAY[
    '0013d855-21ff-489d-848e-cd681e223477','1038151f-9bf5-459c-8444-ee9229d9889c',
    '20558c7f-6b16-4a49-a718-7a0b49f2834e','2bcaab87-c817-4ffc-9756-0627cd9367f8',
    '355ba375-1d79-4e1a-be66-0aa82b96fad3','36c914f6-7f74-4fe3-9201-f7ea52d83d47',
    '41e2a499-9d19-43f6-9d51-7815a8a5c82d','4fb09f67-d0a8-4193-a40c-9d8679df9698',
    '651a8736-1d96-4280-b4d1-db574bcb5c46','6e2fb6e8-f07e-493d-aea0-42d25378b38f',
    '7d89687d-2794-42cc-99b1-2494ea9276da','7e172507-8c5c-4bd9-b071-55f15defdb5a',
    '8edd01cf-6524-42b5-b0fc-d2b433e4fd28','9260a887-c95b-4703-bcc7-7dc699e3f535',
    '92a67265-45ae-4831-b060-122092290439','9378109d-e7af-494a-aa76-21a595c018a8',
    '997fb5f9-f496-441d-9813-250f1fb67949','becd34d7-d6d3-4ab5-806b-12589454fc8f',
    'bf96fb94-0c36-4b0b-afb2-a995dee190b4','de2f1e16-a56c-4c11-8d3c-a7603812083b',
    'e44787f7-778f-4631-ba65-385ce7ed1997','e50e930f-75af-4f3c-9657-6570808acc26',
    'f073b997-5a38-4831-a317-09dda9948b12','f7fbe42c-a2ae-42c8-a366-4a800dbdce6e',
    'fcd3e70a-8773-4a50-a8b0-57a985d62371']::uuid[];
  fresh_ids uuid[] := ARRAY[
    '00302925-ec4d-49e1-864a-3d3cc8a60102','24a1a858-e24b-4f82-a4cc-bc55be016af1',
    '2b8987ed-b40f-4cb3-a49a-58d7e5c38536','43105bc9-fafb-4948-9624-22f2a9e20300',
    '563b9a04-8959-46af-803c-c2cd545a5af3','7408b0ae-2107-4dcc-995e-e69122f782a6',
    '8c67ce9c-bdab-41dc-9dfe-e468d50d9410','95bec797-839e-4b41-b1f9-6e40845d3c15',
    '97101f68-ba9b-4662-a308-3b81a0724b3d','d7fd417a-3bc0-4526-864d-a2577524b6d6',
    'dfc74f2e-a110-4f31-95b0-356ef57ea57b','f5441342-a90c-45c3-a046-30f859be85f9',
    'f84fe496-5d29-4804-b249-635cef5f6457','fc0fcbd6-2e15-4801-a263-2216ac5bd10a']::uuid[];
BEGIN
  SET LOCAL lock_timeout = '3s';  -- fail fast on a busy table instead of queueing app writes (availability guard)
  LOCK TABLE matrix_map.samples IN SHARE ROW EXCLUSIVE MODE;

  -- updated_at = now() is REQUIRED: fetch_samples_with_hidden_summary derives snapshot_version from
  -- MAX(samples.updated_at); without it the map freshness/integrity token stays stale after the change.
  UPDATE matrix_map.samples SET waterbody_type = 'Marine', updated_at = now()
    WHERE id = ANY(marine_ids) AND waterbody_type = 'marine';
  GET DIAGNOSTICS n_marine = ROW_COUNT;
  UPDATE matrix_map.samples SET waterbody_type = 'Freshwater', updated_at = now()
    WHERE id = ANY(fresh_ids) AND waterbody_type = 'freshwater';
  GET DIAGNOSTICS n_fresh = ROW_COUNT;

  IF n_marine <> 25 OR n_fresh <> 14 THEN
    RAISE EXCEPTION 'T32 scope: marine changed=% (exp 25), freshwater changed=% (exp 14). Aborted, no change.', n_marine, n_fresh;
  END IF;

  SELECT count(*) FILTER (WHERE waterbody_type = 'Marine'),
         count(*) FILTER (WHERE waterbody_type = 'Freshwater'),
         count(*) FILTER (WHERE waterbody_type IN ('marine','freshwater')),
         count(*) FILTER (WHERE waterbody_type IS NULL OR waterbody_type = ''),
         count(*)
    INTO final_marine, final_fresh, n_lower, n_empty, n_total FROM matrix_map.samples;
  -- FULL reviewed distribution asserted (incl empty + total) so a concurrent insert/other change since
  -- the read-only preflight cannot pass while the reviewed distribution is no longer true.
  IF final_marine <> 268 OR final_fresh <> 22 OR n_lower <> 0 OR n_empty <> 4204 OR n_total <> 4494 THEN
    RAISE EXCEPTION 'T32 postcondition: Marine=% (exp 268), Freshwater=% (exp 22), lowercase=% (exp 0), empty=% (exp 4204), total=% (exp 4494). Aborted, no change.', final_marine, final_fresh, n_lower, n_empty, n_total;
  END IF;

  RAISE NOTICE 'T32 OK: % marine + % freshwater normalized; final Marine 268 / Freshwater 22.', n_marine, n_fresh;
END $$;
```

## ROLLBACK (exact, id-keyed, reviewed -- reverts precisely the 39 rows above)

```sql
DO $$
DECLARE
  n_marine int; n_fresh int; final_marine int; final_fresh int; n_lower int; n_empty int; n_total int;
  marine_ids uuid[] := ARRAY[
    '0013d855-21ff-489d-848e-cd681e223477','1038151f-9bf5-459c-8444-ee9229d9889c',
    '20558c7f-6b16-4a49-a718-7a0b49f2834e','2bcaab87-c817-4ffc-9756-0627cd9367f8',
    '355ba375-1d79-4e1a-be66-0aa82b96fad3','36c914f6-7f74-4fe3-9201-f7ea52d83d47',
    '41e2a499-9d19-43f6-9d51-7815a8a5c82d','4fb09f67-d0a8-4193-a40c-9d8679df9698',
    '651a8736-1d96-4280-b4d1-db574bcb5c46','6e2fb6e8-f07e-493d-aea0-42d25378b38f',
    '7d89687d-2794-42cc-99b1-2494ea9276da','7e172507-8c5c-4bd9-b071-55f15defdb5a',
    '8edd01cf-6524-42b5-b0fc-d2b433e4fd28','9260a887-c95b-4703-bcc7-7dc699e3f535',
    '92a67265-45ae-4831-b060-122092290439','9378109d-e7af-494a-aa76-21a595c018a8',
    '997fb5f9-f496-441d-9813-250f1fb67949','becd34d7-d6d3-4ab5-806b-12589454fc8f',
    'bf96fb94-0c36-4b0b-afb2-a995dee190b4','de2f1e16-a56c-4c11-8d3c-a7603812083b',
    'e44787f7-778f-4631-ba65-385ce7ed1997','e50e930f-75af-4f3c-9657-6570808acc26',
    'f073b997-5a38-4831-a317-09dda9948b12','f7fbe42c-a2ae-42c8-a366-4a800dbdce6e',
    'fcd3e70a-8773-4a50-a8b0-57a985d62371']::uuid[];
  fresh_ids uuid[] := ARRAY[
    '00302925-ec4d-49e1-864a-3d3cc8a60102','24a1a858-e24b-4f82-a4cc-bc55be016af1',
    '2b8987ed-b40f-4cb3-a49a-58d7e5c38536','43105bc9-fafb-4948-9624-22f2a9e20300',
    '563b9a04-8959-46af-803c-c2cd545a5af3','7408b0ae-2107-4dcc-995e-e69122f782a6',
    '8c67ce9c-bdab-41dc-9dfe-e468d50d9410','95bec797-839e-4b41-b1f9-6e40845d3c15',
    '97101f68-ba9b-4662-a308-3b81a0724b3d','d7fd417a-3bc0-4526-864d-a2577524b6d6',
    'dfc74f2e-a110-4f31-95b0-356ef57ea57b','f5441342-a90c-45c3-a046-30f859be85f9',
    'f84fe496-5d29-4804-b249-635cef5f6457','fc0fcbd6-2e15-4801-a263-2216ac5bd10a']::uuid[];
BEGIN
  SET LOCAL lock_timeout = '3s';
  LOCK TABLE matrix_map.samples IN SHARE ROW EXCLUSIVE MODE;
  UPDATE matrix_map.samples SET waterbody_type = 'marine', updated_at = now()
    WHERE id = ANY(marine_ids) AND waterbody_type = 'Marine';
  GET DIAGNOSTICS n_marine = ROW_COUNT;
  UPDATE matrix_map.samples SET waterbody_type = 'freshwater', updated_at = now()
    WHERE id = ANY(fresh_ids) AND waterbody_type = 'Freshwater';
  GET DIAGNOSTICS n_fresh = ROW_COUNT;
  IF n_marine <> 25 OR n_fresh <> 14 THEN
    RAISE EXCEPTION 'T32 rollback scope: marine reverted=% (exp 25), freshwater reverted=% (exp 14). Aborted, no change.', n_marine, n_fresh;
  END IF;
  SELECT count(*) FILTER (WHERE waterbody_type = 'Marine'),
         count(*) FILTER (WHERE waterbody_type = 'Freshwater'),
         count(*) FILTER (WHERE waterbody_type IN ('marine','freshwater')),
         count(*) FILTER (WHERE waterbody_type IS NULL OR waterbody_type = ''),
         count(*)
    INTO final_marine, final_fresh, n_lower, n_empty, n_total FROM matrix_map.samples;
  -- rollback postcondition: back to the pre-apply distribution.
  IF final_marine <> 243 OR final_fresh <> 8 OR n_lower <> 39 OR n_empty <> 4204 OR n_total <> 4494 THEN
    RAISE EXCEPTION 'T32 rollback postcondition: Marine=% (exp 243), Freshwater=% (exp 8), lowercase=% (exp 39), empty=% (exp 4204), total=% (exp 4494). Aborted, no change.', final_marine, final_fresh, n_lower, n_empty, n_total;
  END IF;
  RAISE NOTICE 'T32 ROLLBACK OK: reverted % marine + % freshwater to lowercase.', n_marine, n_fresh;
END $$;
```

---

# SUPERSEDED PRE-APPLY HISTORY BELOW -- DO NOT EXECUTE

Everything from here to the end of the document is the ORIGINAL pre-apply draft (prep-only two-step
STEP A/STEP B runbook, preflight, and old rollback note), retained only as the historical record of
what was proposed BEFORE approval. T32 has ALREADY been applied (2026-07-13) via the id-keyed DO block
in "OPERATION AS APPLIED" above. Do NOT run any SQL in this historical section -- the "PREP-ONLY",
"No write was executed", and "Only then may the exact UPDATE be applied" statements below reflect the
pre-apply state and are no longer true. For the actual applied SQL and the rollback, use the two
sections above.

---

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
