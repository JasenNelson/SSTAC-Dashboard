# SSTAC Full-Corpus BN-RRM Run Readme

## Resume Command
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\matrix-map\run_fullcorpus.ps1

## Monitoring Progress
- Heartbeat: Read `scripts/matrix-map/_enrichment_working/mm_batch_heartbeat.json`
- Logs: Tail the latest `scripts/matrix-map/_enrichment_working/mm_fullrun_*.log`
- Ledger: Query status counts from `scripts/matrix-map/_enrichment_working/bnrrm_fullrun_ops.db`

## STOP - Database Load Policy
DO NOT run any direct live Supabase data loads or upload scripts manually.
Claude/agent runs verification gates (verify_merge + test_golden + codex) and loads the delta on return.
