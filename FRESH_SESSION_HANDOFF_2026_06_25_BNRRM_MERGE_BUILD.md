# Fresh-Session Handoff -- BN-RRM additive merge build (2026-06-25)

## >>> RUN COMPLETE (2026-06-25) -- deliverable durably checkpointed to G: <<<
The 48-doc vision run FINISHED 48/48 (0 failed). Results in bnrrm_subset.db:
- 7 docs yielded sediment [28,53,263,264,315,362,497]; 39 review_zero (soil/GW, gated); 2 no_tables
  (image-only). +171 stations, dated events 304 -> 499 (+195), chemistry +2,438. 100% sediment media
  (gate held); golden SED11-137A=2011-06-16/0-30 PRESENT. Residual: ~2% garbage params (49/2438) +
  ~8% unknown-unit (190) -- flagged, not lost; candidates for a param-quality quarantine pass later.
- DURABLE CHECKPOINT (protected): `G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data\
  bnrrm_enhanced_2026-06-25_960a8b31.db` (+ .ops.db sidecar + mm_sediment_targets json).

REMAINING (defer to Sunday post-reset; fresh Claude budget):
1. FORMAL `verify_merge.py --enhanced bnrrm_subset.db` (full EXCEPT/FK/no-dup gate) -- the quick
   audit passed; this is the rigorous confirmation.
2. (optional) param-quality quarantine pass for the ~2% garbage + decide unknown-unit handling.
3. The codex-gated LIVE Supabase load (the only true HITL) -- build ETL from the enhanced DB with the
   artifact filter, /codex-review HARD, apply via MCP with pre/post snapshot.

## >>> (historical) 48-DOC VISION RUN IN PROGRESS <<<
A DETACHED multimodal vision run is processing the 48 sediment-targeted docs into a COPY of the base.
- Target DB: `scripts/matrix-map/_enrichment_working/bnrrm_subset.db` (copy of sha256-verified DB2).
- Ledger/sidecar: `_enrichment_working/bnrrm_subset_ops.db` (per-doc status + quarantine).
- Heartbeat: `_enrichment_working/mm_batch_heartbeat.json`; log: scratchpad/subset_run.log.
- Command (3 passes, 48 likely-sediment doc_ids): see `scratchpad/run_subset.ps1`; launched detached
  via WMI `Win32_Process.Create` (PID was 44136 this session). ETA ~12-15h; resumable.

**RESUME (if PID dead / after reboot / fresh session) -- just re-launch; it skips `done` docs via the ledger:**
```
powershell -NoProfile -ExecutionPolicy Bypass -File <scratchpad>/run_subset.ps1
```
(or re-run mm_batch_runner.py --db bnrrm_subset.db --ledger bnrrm_subset_ops.db --doc-ids <48 ids
 from mm_sediment_targets.json likely_sediment_doc_ids> --passes 3). Verified crash-resume: done docs
skipped, no dupes (loader dedups station+ISO-date+depth). `review_zero`/`failed` re-attempt up to 3x.

**ON COMPLETION (all 48 terminal, no pending/in_progress) -- do this:**
1. `python scripts/matrix-map/verify_merge.py --enhanced .../bnrrm_subset.db` (same-schema,
   existing-rows-unchanged EXCEPT diff, FK=0, golden SED11-137A=2011-06-16/0-30, no-dup).
2. Audit yield: ledger done/review_zero/no_tables/failed; new stations/events/dated/chem; 0 garbage;
   units captured. Expect MODEST yield (corpus is 78% HHERA; ~5-10% docs are sediment).
3. **Part D durable checkpoint:** copy bnrrm_subset.db -> `G:\My Drive\SABCS - Sediment Project\
   Dashboard\matrix-map-data\bnrrm_enhanced_2026-06-25_<shortsha>.db` (DATED, never the DB2 basename)
   + the sidecar + mm_sediment_targets.json; record sha256.
4. The codex-gated LIVE Supabase load is the only remaining HITL (NOT done; see Downstream section).

## STRATEGY (final, this session): TEXT-PARSE MERGE SCRAPPED -> TARGETED MULTIMODAL VISION
The text-layer VERBATIM parse was structurally unreliable (14-18% garbage chemistry in BOTH the AGY
merge AND the original rebuild). codex AGREE-B -> use the validated VISION pipeline. Real-AGY testing
then showed: (a) corpus is 78% HHERA/soil-GW -> built a TARGETING scanner (scan_sediment_docs.py):
555 -> 48 likely-sediment docs (mm_sediment_targets.json); (b) vision is non-deterministic (drops
samples; golden missed in one run) -> added MULTI-PASS UNION (--passes N; loader dedups -> union
recovers missed samples; validated doc28 x3 recovers golden). Sediment-only MEDIA GATE quarantines
soil/GW. Units + full-station-code prompt fixes landed. Commits: f62e736, fac42a3, 161a382, 28d953c,
19bfa28. The OLD "locked merge design" + merge_verbatim_additive.py below are SUPERSEDED/obsolete.

---

Continue the BN-RRM date/depth enrichment. Plain ASCII. (Historical sections below predate the
vision pivot -- the CURRENT STATE block above is authoritative.)

Read first: this file; `C:\Users\jasen\.claude\plans\explore-code-base-and-piped-pond.md` (the
5-round-codex-GREEN plan); memory `feedback_bnrrm_dataset_additive_only_and_lane_takeover` +
`feedback_bnrrm_extraction_quality_systems_2026_06_24` (HIGH AUTHORITY).

## DONE + committed this session (branch docs/bnrrm-433-batch-handoff-2026-06-24)
- **f62e736** Part B0 + Part C runner: `mm_loader_common.py` (null-safe 0cm dedup; no silent
  null-unit/conflict chemistry drop; single lastrowid allocation; row-level quarantine; blank-date
  -> NULL) + 18 unit tests; `mm_batch_runner.py` rewired (SIDECAR ops ledger so the deliverable
  stays SAME-SCHEMA; manifest-driven exclusion + refuse-full-run-without-manifest; per-doc
  acceptance gate; stale-JSON guard; case/realpath-safe ledger!=db guard); `mm_db_load.py` rewired;
  `test_golden.py`/`validate_db.py`/`audit_script.py` got `--db`. codex 5.5-xhigh GREEN.
- **fac42a3** Part B manifest + probes (AGY-authored): `build_verbatim_manifest.py`,
  `probe_partb.py`.
- **Base built + sha256-verified:** `scripts/matrix-map/_enrichment_working/bnrrm_enhanced.db` ==
  canonical DB2 (sha256 73a4aa9c..., 65,466,368 bytes; 7815 stations/166 sites/8354 events,304
  dated/14583 chemistry). _enrichment_working/ is gitignored.
- **Manifest built:** `_enrichment_working/mm_exclusion_manifest.json` = seed_site_docs[19] +
  verbatim_docs (129) + verbatim_map. 3 unresolved (SITE1419 x2 -> site_id 11; SITE8859 ->
  site_id 10) lack an ra_documents row.
- **Quantified:** junk = 3478/7815 (1958 analyte-names-as-stations + 944 numeric + ~192 criteria/QA;
  false-positive risk only 4). All verbatim sites have 0 dated events in DB2; VERBATIM stations are
  NET-NEW -> duplication risk. (`_enrichment_working/mm_probe_report.json`.)

## !! STRATEGY PIVOT 2026-06-25 (codex AGREE-B + owner) -- text-parse merge SCRAPPED
The text-layer VERBATIM parse is STRUCTURALLY UNRELIABLE: 14-18% garbage chemistry (numeric/
concatenated-merged-cell param names, "Lab Report"/"Sample Depth" as params) in BOTH the AGY merge
AND the original rebuild_clean_db_from_verbatim.py output; column-misalignment also threatens
clean-named rows' values. codex agreed (VERDICT AGREE-B). DECISION: ABANDON the text-parse merge;
route the 132 VERBATIM docs through the MULTIMODAL VISION pipeline too -> one uniform, gated
**565-doc** (132 + 433, minus 19 seed) vision-extracted dataset via mm_batch_runner. The
merge_verbatim_additive.py adapter + bnrrm_clean_rebuild.db are OBSOLETE. bnrrm_enhanced.db has been
RESET to pristine DB2 (sha256-verified). The "LOCKED MERGE DESIGN" below is SUPERSEDED for chemistry
(its junk-sidecar + INSERT-only + manifest principles still hold for the vision run).

Real-AGY smoke (FINALLY validated the vision path): vision chemistry is CLEAN (0 garbage params),
real dated stations + depths. BUT smoke docs 25/30 (HHERAs) were 100% SOIL+GROUNDWATER, not sediment
-> owner decision: **SEDIMENT-ONLY**. Fixes applied this session: (1) media gate in
mm_loader_common.is_sediment() + load_single_doc (quarantine non-sediment); (2) vision prompt now
captures UNITS + requests sediment-only + media_type (the old prompt said "skip units columns" --
that was why units were missing). Re-smoke (docs 28,22 sediment + 30 soil) in progress to confirm.
NEXT after re-smoke GREEN: owner greenlights the multi-hour 565-doc detached/monitored vision run.

## LOCKED MERGE DESIGN (SUPERSEDED for chemistry by the pivot above; principles still apply)
1. **3478 junk is correct** (not the ~192 we assumed) -- real artifact classes; not a stop.
2. **Junk handling = SIDECAR quarantine.** Record the 3478 junk station_ids (+reason) in a SIDECAR
   store (e.g. `bnrrm_enhanced.ops.db` or a json), NOT in the deliverable. Deliverable stays
   byte-additive + same-schema. The downstream map ETL must treat the sidecar as the authoritative
   exclusion list (extends the old ~192 artifact-filter to the full 3478).
3. **Reconciliation = INSERT-ONLY merge + SIDECAR supersession (codex HARD CONSTRAINT).** The merge
   adapter must NOT mutate or delete any existing DB2 row -- INSERT-only. Add the VERBATIM clean
   DATED stations/events/chemistry as net-new (via `mm_loader_common`). Where a DB2 station matches
   a VERBATIM clean station by NORMALIZED name (same site; normalize spacing/hyphens/case), record
   the superseded DB2 undated station/event id in the SIDECAR (exclusion), do NOT edit it. Value
   conflicts -> quarantine, never overwrite. This keeps the per-table EXCEPT "existing-rows-
   unchanged" proof clean while de-duplicating at the consumer.
4. **3 unresolved docs = ADD the ra_documents rows additively** (doc_date/title/site_id from the
   VERBATIM metadata) then merge -> 132/132.

## NEXT STEPS (fresh session)
1. **AGY authors the merge adapter** (owner: AGY is the Part B workhorse; Claude orchestrates thin;
   codex gates). Brief AGY (file-based, `--model "Gemini 3.1 Pro (High)"`, BOUNDED by `timeout`,
   cap exploration) to write `scripts/matrix-map/merge_verbatim_additive.py`:
   - read the 132 VERBATIM jsons via the manifest (add the 3 ra_documents rows first);
   - INSERT-only into bnrrm_enhanced.db using mm_loader_common (net-new clean dated stations/
     events/chemistry; never overwrite the 304 seed dates);
   - write the SIDECAR: junk-quarantine list (3478) + supersession-exclusion list (matched DB2
     undated copies) + value-conflict quarantine;
   - parse the VERBATIM table structure -- REUSE the proven logic in
     `rebuild_clean_db_from_verbatim.py` (the table/header/depth parsing) but target bnrrm_enhanced
     additively via mm_loader_common, NOT a fresh DB.
2. **Verify (codex-R2/R3/R4 gates):** sqlite_master(enhanced)==DB2; per-table EXCEPT/PK-checksum
   diff proving every existing DB2 row UNCHANGED (INSERT-only => clean); `PRAGMA foreign_key_check`
   = 0; golden SITE0141 SED11-137A=2011-06-16/0-30cm via `test_golden.py --db bnrrm_enhanced.db`;
   date coverage rises ~1,708+; EXHAUSTIVE no-dup scan (no (station,parameter,value) under two
   events). codex-review the adapter to GREEN.
3. **Part C smoke (real AGY, not mock):** build a curated `--doc-ids` set, copy bnrrm_enhanced.db
   -> bnrrm_smoke.db, run `mm_batch_runner.py --db ...smoke.db --doc-ids <curated> --ledger
   <sidecar>` (NO --mock-agy) to prove the live AGY-vision path end-to-end behind the stale-JSON
   guard. (agy.exe at C:\Users\jasen\AppData\Local\agy\bin\agy.exe.)
4. **Part D:** drop operational tables / confirm same-schema; checkpoint bnrrm_enhanced.db + the
   sidecar + manifest to a DURABLE dated non-DB2-basename file under
   `G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data\` (e.g.
   bnrrm_enhanced_2026-06-25_<shortsha>.db); record sha256.
5. Then the full 433-doc run (detached/monitored, REQUIRES --manifest) + the codex-gated live
   Supabase load remain DEFERRED (owner-gated) per the plan.

## DISCIPLINE REMINDERS (learned this session)
- **MONITOR external CLIs properly:** every codex/AGY run is BOUNDED by a hard `timeout` wrapper +
  the 10-min ceiling -- NEVER launch-and-forget (a codex review hung ~2h this session on a Windows
  .pyc rename race before it was caught). Use `PYTHONDONTWRITEBYTECODE=1` for codex tool-use; tell
  codex to review STATICALLY (don't run python that imports the module under review).
- **AGY:** file-based brief (.tmp_agy_brief_*.md) -> "Read <path> and execute it"; closeout
  (.tmp_agy_closeout_*.md); VERIFY outputs yourself (git diff + read), never trust the closeout;
  no --dangerously-skip-permissions; cap exploration (rabbit-hole watch).
- **Decision gates** go to codex (owner workflow): present options+recommendation+rationale, argue
  to mutual agreement, then proceed autonomously. If something looks wrong, ask codex; agree-to-stop
  or agree-on-fix-and-proceed.
- Path-scoped staging only. Working DBs stay in _enrichment_working/ (gitignored); never commit DBs.

## OPEN (owner)
- Orphan PID 41052 (hung engine-v2 pytest, parent-dead) safe to clear:
  `powershell -File C:\Projects\.claude\scripts\safe-cleanup-orphans.ps1 -Apply -SparePids 27988,60712,17552,59524`
  (the 9 GB python 27988 + its tree is a LIVE parallel engine-v2 run -- leave it).
