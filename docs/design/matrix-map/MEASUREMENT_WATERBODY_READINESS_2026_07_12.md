# Measurement-Load (T31) + Waterbody (T32) Readiness Packet -- 2026-07-12

Status: READ-ONLY report. No Supabase writes were made producing this packet. All numbers below are
from live SELECT-only queries against Supabase project qyrhsieynzfgyuqzznap, schema matrix_map, run
2026-07-12, or from repo docs read at origin/main (589deaf). Both approval packets in Section 3 are
OWNER-GATED and were NOT executed.

---

## 1. Live DB inventory (2026-07-12, SELECT-only)

| Metric | Value |
|---|---|
| matrix_map.samples | 4494 |
| matrix_map.measurements | 13631 (sediment 13107 live-load manifest historically; current medium mix not re-split here, see status doc: sediment 13122 / toxicity 334 / community 175 as of 2026-07-11) |
| matrix_map.sample_events | 559 |
| samples with ZERO attached measurements (via sample_events -> measurements join) | 3982 |
| orphan samples (source_dra_id IS NULL) | 8 |
| dras total | 574 |
| dras public = true | 3 |
| dras public = false (private) | 571 |
| active private_data_grants (revoked_at IS NULL) | 0 |
| member-visible samples, uncapped (join samples -> dras WHERE dras.public = true) | 34 |
| admin-visible samples, uncapped (join samples -> dras WHERE dras.is_deleted = false) | 4486 |
| sample_events with date_precision = 'undated' (live, currently loaded) | 0 |
| sample_events with event_date IS NULL (live, currently loaded) | 0 |

### waterbody_type distribution (live, matches the T18 doc exactly)

```sql
SELECT waterbody_type, count(*) FROM matrix_map.samples GROUP BY waterbody_type ORDER BY 2 DESC;
```

| waterbody_type (raw) | count |
|---|---|
| '' (empty string) | 4204 |
| Marine | 243 |
| marine | 25 |
| freshwater | 14 |
| Freshwater | 8 |

No casing/whitespace drift since the T18 doc was written on 2026-07-11 -- these five rows and counts
are identical.

---

## 2. Reconciliation with prior docs (read from origin/main)

### 2a. DRA publication state -- DELTA (real change, not doc drift)

`docs/MATRIX_MAP_STATUS_2026_07_11.md` (authored 2026-07-11) states **0 public DRAs, 574 private, 0
active grants** and frames publication as an outstanding owner decision. The LIVE state today
(2026-07-12) is **3 public DRAs, 571 private**. This is consistent with repo history, not a stale-doc
error: commits merged since the status doc was written include `feat/mo-publish-ui-2026-07-11` (PR
#612), `feat/mo-testflag-2026-07-11` (PR #613), `docs/mo-rls-hardening-design-2026-07-11` (PR #615),
and `chore/mo-rls-trigger-migration-file-2026-07-12` (PR #616, migration
`20260712164723_matrix_map_flip_dra_public_trigger.sql`). The owner has begun exercising the
publish-DRA path. Consequence: member-visible samples moved from 0 (doc) to 34 (live, uncapped) --
still far short of the 4486 admin-visible total, but no longer zero.

### 2b. The 2500-row map cap -- ALREADY RESOLVED since the status doc

The status doc listed "approve the 2500->5000 cap migration" as outstanding owner decision #2. Git
history shows `chore/mo-map-cap-alert-2026-07-11` (PR #614) and a re-home commit
`a7b9e04 chore(matrix-map): re-home applied cap migration (v_cap 2500->5000) to repo history` --
the cap is already live at 5000. This decision is CLOSED, not open. (Not independently re-verified
by direct RPC introspection in this READ-ONLY packet beyond the commit trail; flagged for owner
confirmation but not expected to need action.)

### 2c. Undated-measurement app-layer contract -- ALREADY SHIPPED (this is new, good news for T31)

`docs/MATRIX_MAP_UNDATED_CONSUMER_DESIGN_2026_06_21.md` scoped an app-layer change (RPC + store type +
filter null-guard + export route + RightPanel badge/normalizer) as a prerequisite for safely consuming
undated measurements once loaded. Live verification this run:
- `sample_events.date_precision` column exists live (`exact`/`undated` CHECK), migration
  `20260620000001_matrix_map_event_date_nullable.sql` is applied.
- The `fetch_measurements_for_samples` RPC's live definition (via `pg_get_functiondef`) already
  contains `date_precision` -- migration `20260622000001_matrix_map_fetch_measurements_date_precision.sql`
  is applied, not just authored.
- The app-layer files named in the design doc's consumer-contract table
  (`src/stores/matrix-map/measurementStore.ts`, `src/lib/matrix-map/filter-measurements.ts` (+ test),
  `src/app/api/matrix-map/export/route.ts` (+ test), `src/components/matrix-options/MatrixMapRightPanel.tsx`)
  all reference `date_precision` in the current repo tree.

**Net effect: the schema + RPC + app-layer consumer contract for undated measurements is DONE.** The
only missing piece for T31 is the DATA LOAD itself (the fresh `--allow-undated` ETL run + apply). This
is a meaningfully lower-risk starting point than the design doc implied when it was written (section 4
of that doc: "Status 2026-06-22: TEED UP, not started" -- that status is now stale; the app layer has
since shipped).

### 2d. The ~6742-undated-measurement figure -- ESTIMATE, not a verified exact count

`docs/MATRIX_MAP_STATUS_2026_07_11.md` section 3 lists "Deliberate exclusions (manifest-side, not in
DB): undated events (~6742 measurements)" as a manifest-side figure, not a fresh live count. The
undated-consumer design doc confirms why: "PATH_B was generated BEFORE `--allow-undated`, so it loads
0 undated rows. Loading the undated measurements requires a fresh
`etl_bnrrm_to_supabase.py --allow-undated` run." No committed `mm_live_load_batch_*` artifact in the
current repo tree contains undated rows (live DB confirms 0 undated sample_events). **The exact count
loadable today is NOT yet known precisely** -- it depends on a fresh ETL dry-run against the enriched
source DB (`G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data\bnrrm_enhanced_*.db`) with
the current junk-filter (`mm_loader_common.passes_name_gate`) applied. ~6742 is the best available
estimate; the T31 packet below treats it as an estimate pending a fresh dry-run count.

### 2e. WATERBODY_TYPE_NORMALIZATION doc -- arithmetic inconsistency flagged (not propagated)

`docs/design/matrix-map/WATERBODY_TYPE_NORMALIZATION_2026_07_11.md` section 5(a) states: "Collapsing
'marine' -> 'Marine' (25 rows) and 'freshwater' -> 'Freshwater' (8 rows) would touch 33 rows total."
This is INTERNALLY INCONSISTENT with the same doc's own section 2 distribution table, which lists the
lowercase-raw-value count as **14** for `freshwater` (not 8 -- 8 is the count of already-correctly-cased
`Freshwater`, which needs no UPDATE). The doc's own section 4 post-normalization totals (Marine 268,
Freshwater 22) are correct and match `243+25=268` and `14+8=22`. So the row-count that actually
requires an UPDATE is **39** (25 `marine`->`Marine` + 14 `freshwater`->`Freshwater`), not 33. Applying
only 33 rows (e.g. by literally updating "8 Freshwater rows", which are already correctly cased and
would be a no-op) would silently fail to normalize the 14 lowercase `freshwater` rows and would NOT
reach the doc's own stated target distribution (Marine 268 / Freshwater 22). The exact UPDATE SQL in
Section 3 below is written to hit the doc's stated TARGET distribution (Marine 268, Freshwater 22),
which requires updating 39 rows, not 33. **This discrepancy is flagged for owner awareness, not
silently corrected past this note** -- see "ambiguous" callout at the end of this packet.

---

## 3. Approval packets (OWNER-GATED -- NOT EXECUTED)

### PACKET A -- T31 MEASUREMENT-LOAD (undated BN-RRM measurements)

**What would be loaded:** an estimated ~6742 undated sediment/toxicity/community measurement rows
(exact count TBD by a fresh ETL dry-run), each attached to a `sample_events` row with
`event_date = NULL` and `date_precision = 'undated'`, sourced from the enriched BN-RRM DB via
`etl_bnrrm_to_supabase.py --allow-undated`, same junk-filter (`passes_name_gate`, ~3478 stations
excluded) and idempotency keys (`bnrrm_chemistry_id` / `bnrrm_toxicity_id` / `bnrrm_community_id`)
as the prior live load. This is an ADDITIVE-only load onto EXISTING samples/sample_events where
possible, or new sample_events for existing samples -- no destructive change to any existing row.

**Exact mechanism (per `/supabase` skill, CONFIRMED-METHOD 2026-06-26):**
1. Run `etl_bnrrm_to_supabase.py --source-db <enriched DB> --allow-undated --out-sql <dry-run>` to
   produce fresh FK-ordered, idempotent SQL batches (this is a NEW artifact -- the currently-committed
   `mm_live_load_batch_*.sql` files loaded 0 undated rows and must NOT be re-run expecting undated
   data; a fresh generation step is required first).
2. codex-review the new batches (targeted: junk-filter completeness on this run; idempotency;
   FK order; no schema/RLS/RPC changes) to mutual-agreement GREEN, per L0 section 1.3.
3. Apply via `scripts/matrix-map/apply_live_load.py` (reads `DATABASE_URL` from `.env.local`, session
   pooler, server-side psycopg2 execution) -- NOT via MCP `execute_sql` for the bulk batches (token-
   fatal per skill: ~112k tokens per 450 KB batch). **CRITICAL apply-input caveat (verified by reading
   the script 2026-07-12):** `apply_live_load.py` as committed does NOT take a `--manifest`/`--out-sql`/
   `--scripts-dir` argument. It reads a HARDCODED manifest at
   `C:/Projects/sstac-dashboard/scripts/matrix-map/mm_live_load_manifest.json`, takes that manifest's
   `apply_order` array, and resolves each named batch file from the HARDCODED directory
   `C:/Projects/sstac-dashboard/scripts/matrix-map/`. It will therefore apply the batches that manifest
   currently points at -- i.e. the prior dated live-load batches (which loaded 0 undated rows) -- NOT
   the fresh `--out-sql` undated artifact, unless one of these is done first: EITHER (a) write the
   Step-1 generated undated batch `.sql` files into that hardcoded directory AND overwrite
   `mm_live_load_manifest.json` so its `apply_order` lists EXACTLY those fresh undated batch files
   (then codex-review the updated manifest + the new batch files together, so the reviewed artifact IS
   the apply input); OR (b) update `apply_live_load.py` to accept an explicit
   `--manifest <fresh-manifest>` / `--scripts-dir <dir>` argument pointing at the fresh generated
   artifact (a code change that is itself codex-gated). Do NOT run `apply_live_load.py` against the
   stale hardcoded manifest expecting the undated rows to load -- that would re-apply the already-loaded
   dated batches as idempotent no-ops and load ZERO undated rows.
4. Post-load verification via MCP `execute_sql` (cheap, small reads only).

**Preflight SELECTs (current counts, already captured above in Section 1):**
```sql
SELECT 'samples', count(*) FROM matrix_map.samples
UNION ALL SELECT 'sample_events', count(*) FROM matrix_map.sample_events
UNION ALL SELECT 'measurements', count(*) FROM matrix_map.measurements
UNION ALL SELECT 'undated_events', count(*) FROM matrix_map.sample_events WHERE date_precision = 'undated'
UNION ALL SELECT 'medium_sediment', count(*) FROM matrix_map.measurements WHERE medium = 'sediment'
UNION ALL SELECT 'medium_toxicity', count(*) FROM matrix_map.measurements WHERE medium = 'toxicity'
UNION ALL SELECT 'medium_community', count(*) FROM matrix_map.measurements WHERE medium = 'community';
```
Baseline: samples 4494, sample_events 559, measurements 13631, undated_events 0.

**Expected postflight counts:** measurements +~6742 (estimate, confirm via the fresh dry-run manifest
before applying); sample_events increases by however many NEW undated events the dry-run manifest
reports (existing dated events are untouched); `undated_events` count goes from 0 to the loaded count;
samples count should NOT increase materially if undated measurements attach to already-loaded stations
(verify against the dry-run manifest -- if the enriched DB includes new stations not in the current
4494, that would also raise the samples count and should be called out explicitly at apply time).

**Rollback approach:** additive + idempotent load. To undo: `DELETE FROM matrix_map.measurements WHERE
bnrrm_chemistry_id = ANY(<id range from this load's manifest>)` (repeat for
`bnrrm_toxicity_id`/`bnrrm_community_id`), then `DELETE FROM matrix_map.sample_events WHERE
date_precision = 'undated' AND bnrrm_event_id = ANY(<id range>)`. Falls back to restoring the
`matrix_map_backup_20260624` schema snapshot if id-range deletion is insufficient.

**Risks:**
- R1 (LOW, already mitigated): undated rows lack `event_date`. The app-layer consumer contract
  (Section 2c above) is confirmed SHIPPED and LIVE -- date filters already exclude undated rows via
  the null-guard in `filter-measurements.ts`; the RightPanel badge and export `date_precision` column
  are already in place. No additional app-layer work is a blocker for this load.
- R2 (MEDIUM): the ~6742 figure is an estimate; the real count from a fresh dry-run could differ.
  Mitigate by treating the fresh dry-run manifest's counts as authoritative before applying, not this
  packet's estimate.
- R3 (MEDIUM): Selection Stats / UCL computation was NOT verified in this READ-ONLY pass to confirm it
  correctly treats undated observations (e.g., whether it silently includes or silently excludes them
  from background statistics). This should be explicitly checked before or immediately after the load
  -- flagged as an open item, not resolved here.
- R4 (LOW): junk-filter must be re-applied on the fresh run (the filter code is shared
  `mm_loader_common.passes_name_gate`, unchanged since the prior verified load, so risk is low but
  should still be codex-gated per the mechanism above).
- R5 (LOW): env_modifier measurements load with `medium='sediment'` + `notes='env_modifier'`
  discriminator (resolved finding from the design doc, section 3a) -- no enum change needed.

**Two-step approval (do NOT collapse into one -- the exact SQL batches do not exist until after
the generate/dry-run step, so a single sentence cannot approve applying artifacts that are not yet
generated):**

STEP 1 -- generate + dry-run + codex only (paste-ready; authorizes NO live write):
> "I approve GENERATING the undated-events load batches via a fresh
> `etl_bnrrm_to_supabase.py --allow-undated` run against the enriched BN-RRM DB, performing a dry-run
> to produce the FK-ordered idempotent SQL batches + a manifest of exact counts, and codex-reviewing
> those batches to mutual-agreement GREEN. This does NOT authorize applying anything to the live
> matrix_map schema -- I will re-confirm separately (STEP 2) after seeing the exact generated batch
> files and counts."

STEP 2 -- apply the exact reviewed batches (paste-ready; to be given ONLY after STEP 1's batches
exist, their manifest counts are reported back, codex-review is GREEN, AND the apply-input wiring
from mechanism step 3 is in place -- i.e. the fresh undated batches + a matching `apply_order`
manifest are the input `apply_live_load.py` will actually read, per option (a) or (b) above, NOT the
stale hardcoded dated manifest):
> "I have reviewed the exact generated batch files and their manifest counts (batch files:
> `<list>`; measurements +`<N>`; new undated sample_events +`<M>`; samples delta `<0 or explained>`),
> and codex-review on those exact batches is GREEN. I confirm the apply input is wired so
> `apply_live_load.py` reads THESE fresh undated batches (the `mm_live_load_manifest.json` `apply_order`
> now lists exactly these files, OR the script has been pointed at the fresh manifest/dir via an
> explicit argument -- and that wiring change was itself codex-reviewed). I approve applying THOSE
> SPECIFIC batches via `scripts/matrix-map/apply_live_load.py` to the live matrix_map schema, with
> pre/post count verification and a report back before any further action."

---

### PACKET B -- T32 WATERBODY_TYPE normalization

**Exact preflight SELECT (current casing distribution, already run live above):**
```sql
SELECT waterbody_type, count(*) FROM matrix_map.samples GROUP BY waterbody_type ORDER BY 2 DESC;
```
Current: '' = 4204, Marine = 243, marine = 25, freshwater = 14, Freshwater = 8.

**Exact UPDATE SQL (39 rows; reaches the doc's own stated target Marine=268 / Freshwater=22 -- see
Section 2e for why this is 39 rows, not the doc prose's inconsistent "33"):**
```sql
BEGIN;

UPDATE matrix_map.samples
SET waterbody_type = 'Marine', updated_at = now()
WHERE waterbody_type = 'marine';
-- expected: 25 rows updated

UPDATE matrix_map.samples
SET waterbody_type = 'Freshwater', updated_at = now()
WHERE waterbody_type = 'freshwater';
-- expected: 14 rows updated

COMMIT;
```
This SQL is idempotent by construction: after the first successful run, no row matches
`waterbody_type = 'marine'` or `'freshwater'` (lowercase) anymore, so re-running is a safe no-op
(0 rows affected on the second run).

**Expected postflight distribution:**
```sql
SELECT waterbody_type, count(*) FROM matrix_map.samples GROUP BY waterbody_type ORDER BY 2 DESC;
```
Expected: '' = 4204 (unchanged, out of scope per the doc), Marine = 268, Freshwater = 22. Total
4204 + 268 + 22 = 4494 (matches current total row count -- no rows created or destroyed).

**Rollback SQL:** casing information is destroyed by the UPDATE (cannot distinguish "was originally
lowercase" from "was originally correct casing" by value alone afterward). To roll back exactly,
capture the affected row id sets in the SAME preflight pass, before applying:
```sql
-- run BEFORE the UPDATE and save the two id lists
SELECT id FROM matrix_map.samples WHERE waterbody_type = 'marine';
SELECT id FROM matrix_map.samples WHERE waterbody_type = 'freshwater';
```
Then, if rollback is needed:
```sql
BEGIN;
UPDATE matrix_map.samples SET waterbody_type = 'marine', updated_at = now()
WHERE id = ANY(ARRAY[<captured marine id list>]::uuid[]);
UPDATE matrix_map.samples SET waterbody_type = 'freshwater', updated_at = now()
WHERE id = ANY(ARRAY[<captured freshwater id list>]::uuid[]);
COMMIT;
```

**Required gate before this SQL is applied:** per L0 section 1.3 / repo Supabase protocol, the
exact UPDATE SQL above must go through `/codex-review` to mutual-agreement GREEN BEFORE owner
approval/execution -- the same gate PACKET A requires (Packet A step 2). This packet does not
itself constitute that review; do not apply Packet B on the strength of this document alone.

**Owner approval sentence (paste-ready, to be given only AFTER the codex-review gate above is
GREEN):**
> "I approve normalizing the 39 casing-variant `waterbody_type` rows (25 'marine' -> 'Marine', 14
> 'freshwater' -> 'Freshwater') in matrix_map.samples via the exact UPDATE SQL in Packet B of this
> packet (codex-review GREEN confirmed), applied by Claude via the project-scoped Supabase MCP
> with pre/post verification reported back; I understand the 93.55% empty waterbody_type rows are
> explicitly out of scope for this change."

---

## Ambiguous / needs owner attention

1. **T18 doc arithmetic error (Section 2e):** the WATERBODY_TYPE_NORMALIZATION doc's section 5(a) says
   "33 rows total" for the casing collapse, but its own section 2/4 data implies 39 rows change to
   reach the doc's own stated target distribution (Marine 268, Freshwater 22). Packet B above is built
   to hit the doc's TARGET distribution (39-row UPDATE), not the doc's prose row-count claim (33). If
   the owner intended literally 33 rows for some other reason not evident in the doc, that should be
   clarified before Packet B is run.
2. **Cap migration (2500->5000):** confirmed via commit trail (PR #614 + re-home commit `a7b9e04`) but
   not independently re-verified via direct RPC-definition introspection in this READ-ONLY pass.
   Low-risk to leave as-is; flagged for completeness.
3. **T31 exact undated-measurement count:** ~6742 is a manifest-side estimate from a prior status doc,
   not a live/fresh count. The real number should come from a fresh ETL dry-run manifest before
   Packet A is applied.
4. **Selection Stats treatment of undated observations:** not verified in this pass (R3 in Packet A).
   Worth a quick check before or right after the T31 load lands.
