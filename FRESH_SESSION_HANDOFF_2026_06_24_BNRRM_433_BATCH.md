# Fresh-Session Handoff -- BN-RRM 433-doc multimodal batch + downstream finish (2026-06-24)

Migrate the remaining BN-RRM enrichment work to a fresh, focused session. Plain ASCII.
Read first: `docs/design/matrix-map/BNRRM_EXTRACTION_QUALITY_STRATEGY_2026_06_24.md` (strategy +
systems + production pipeline + runbook) and `BNRRM_DATE_DEPTH_ENRICHMENT_PLAN_2026_06_24.md`.
Memory (HIGH AUTHORITY): `feedback_bnrrm_dataset_additive_only_and_lane_takeover`,
`feedback_bnrrm_extraction_quality_systems_2026_06_24`.

## Goal
Produce an ENHANCED BN-RRM database (strict superset, same schema, BN-RRM-adoptable by copy):
all current data PRESERVED + recaptured dates/depths/metadata for the bulk docs, extracted CLEANLY
via the validated multimodal engine. Then load it to the matrix-map live Supabase (snapshot-gated).
Additive-only; keep ALL fields; quarantine never discard; flag any scope reduction for owner.

## What is DONE + on main (this session: PRs #412-#415)
- Diagnosis: bulk extraction was junk (criteria cols as stations, dates/depth dropped); a filter
  nearly discarded ~2,600-3,100 REAL stations whose cells were MERGED (codex-confirmed). Strategy +
  5 systems captured.
- 132 VERBATIM docs REBUILT + SALVAGED (clean): dates 304 -> 5,051; golden-set SITE0141 SED11-137A
  = 2011-06-16/0-30cm PASS; 0 junk; ~37k quarantined-for-review (not discarded).
- Multimodal engine VALIDATED + tooling complete: render (PyMuPDF, installed in .venv) -> AGY/Gemini
  3.1 Pro vision transcription -> gated normalized load (stations/events/sediment_chemistry, ASCII
  units, name+plausibility gates, quarantine). It recovers data text-layer parsing misses entirely
  (site 10: text=0 -> multimodal=4 dated). Proven on 4 docs.
- Resilient batch runner (`scripts/matrix-map/mm_batch_runner.py`) built + RESUME-TEST PASSED:
  per-doc `mm_batch_progress` ledger, idempotent, crash-safe, retry/backoff (max-attempts 3),
  heartbeat. Self-test (`--crash-after 2` then resume): crashed at 2 done / rest pending; resume
  SKIPPED the 2 done + finished the rest; NO duplicate stations (exactly 1/doc) despite the hard
  kill. API outage = subprocess error -> ledger 'failed' + attempts++ -> CONTINUES, retried next
  sweep. NOTE: self-test used `--mock-agy` (resilience/ledger proven); before the full run do a
  SMALL REAL run (`--limit 3`, no mock) to confirm the live AGY-vision per-doc integration end-to-
  end (vision itself validated in Phase 5).
- Live Supabase UNTOUCHED. Snapshot `matrix_map_backup_20260624` (13 tables) in place. Schema
  migrations 20260620000001 + 20260622000001 applied + verified. Map FE ready (bbox #413).

## Tooling (scripts/matrix-map/, all on main via #415)
- `rebuild_clean_db_from_verbatim.py` -- VERBATIM->clean normalized rebuild + gates (132 docs).
- `salvage_merged_stations.py` -- de-concatenation/salvage layer (System #2); quarantine.
- `mm_extract_render.py` -- PyMuPDF render candidate table pages -> PNG.
- `mm_db_load.py` -- gated normalized loader (ASCII units, name gate, quarantine).
- `mm_batch_runner.py` -- the resilient orchestrator (render -> AGY vision -> load, ledgered).
Working DBs/artifacts in `scripts/matrix-map/_enrichment_working/` (gitignored):
`bnrrm_clean_rebuild.db` (132-doc enhanced base), `bnrrm_multimodal_validation.db` (4-doc proof),
quarantine.json, rejected_stations.json.

## THE 433-DOC PLAN (next session)
1. **Set the enhanced base**: copy `bnrrm_clean_rebuild.db` -> `bnrrm_enhanced.db` (the run target;
   it already holds the 9 seed sites + 132 rebuilt+salvaged docs). Point the runner `--db` at THIS
   (the Phase-6 closeout example targeted the 4-doc validation DB -- use `bnrrm_enhanced.db` for the
   real run). First do `--limit 3` (no `--mock-agy`) to confirm live AGY-vision, THEN the full run.
2. **Build the work-list**: docs in `ra_documents` with an existing PDF that are NOT a seed site and
   NOT already loaded (the ~433 with no clean data). The runner does this + ledgers each as pending.
3. **Launch the batch DETACHED + MONITORED** (L0 1.8: harness bg processes die on session exit ->
   use schtasks / Win32_Process.Create for a multi-hour run, NOT plain run_in_background). Command in
   the Phase 6 closeout. The runner: per doc render -> AGY vision -> gated load -> ledger; failures
   isolated + retried; heartbeat to `mm_batch_heartbeat.json`.
4. **Monitor** (per Systems #1+#5): poll the heartbeat + ledger; ACCEPTANCE GATE per doc -- flag docs
   with 0 accepted stations / high quarantine for review (don't silently accept). Re-probe stalls
   (L0 1.13). Expect API hiccups -> the runner resumes; if the whole backend is down, pause + resume.
5. **Re-audit when done**: golden-set SITE0141 still PASS; station-name quality (0 criteria/QA/lab-id
   /fragment); coverage (docs with data vs no_tables); compare dated-event count vs the 5,051 base.
6. **Review the quarantine** (the ~37k + batch quarantine): a second salvage sweep for any further
   recoverable real stations before declaring done -- investigate, don't discard.

## DOWNSTREAM FINISH -- GATED on /codex-review (do NOT run un-reviewed)
NOT yet built or reviewed. Before loading to live Supabase:
1. Build the matrix-map LOAD from the enhanced DB (the ETL `etl_bnrrm_to_supabase.py` reads a DB2-
   shaped source; the enhanced DB has the SAME schema -> point the ETL at it or adapt) WITH the
   ARTIFACT-FILTER (exclude the ~192 regulatory-criteria/QA "stations" -- "BC Standard"/"CSR *"/
   "QA/QC *"/"RPD *"; ideally already absent from the enhanced DB given the gates, but verify).
2. **/codex-review the load SQL + the artifact-filter HARD** (SECDEF/data-write surface; the spatial-
   oracle + RLS posture from PRs #407/#409/#410 must hold). Mutual-agreement GREEN required.
3. Apply via project-scoped Supabase MCP, owner-gated, with a pre/post snapshot diff (the
   `matrix_map_backup_20260624` snapshot + a fresh one is the rollback). Then the bbox-bounded map
   (#413) renders the now-dated, auditable dataset.

## Open items / decisions for the fresh session
- Detached-run mechanism (schtasks vs WMI) for the multi-hour batch; confirm AGY subprocess survives.
- Budget/time: 433 docs x vision is multi-hour; run overnight/monitored.
- After the batch: deliver the enhanced `bnrrm_enhanced.db` for the BN-RRM project to copy forward.

## Gate cheatsheet (docs/GATE_MODE_SOP.md)
ETL/tooling scripts (scripts/matrix-map/*.py) are dev-only, not app code -> codex considered-exception
on commit, CI validates app unaffected. The live-Supabase LOAD is NOT exempt -> full /codex-review.
