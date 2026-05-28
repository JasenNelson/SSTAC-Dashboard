# Stream D HITL Owner Checklist -- 2026-05-28

**What this is:** a ready-to-act summary of the 6 owner-action items left by
the Stream D autonomous session after completing the Catalog Extraction Agent
scaffold.

**Where this file lives:** `C:\Projects\SSTAC-Dashboard-worktree-stream-a\`
(Stream A worktree). It was authored here -- not in the shared
`C:\Projects\SSTAC-Dashboard\` checkout -- because the Stream D session is
still active in that shared tree and must not be disturbed.

**Primary source artifacts** (all in `C:\Projects\SSTAC-Dashboard\`, read-only):
- `STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md` (SQL output already populated)
- `STREAM_D_PROGRESS_2026_05_27.md` (commit log + session-end summary)
- `docs/STREAM_D_AUTONOMOUS_AGENT.md` (end-to-end architecture spec)
- `supabase/migrations/20260527000004_catalog_extraction_staging.sql`
- `supabase/migrations/20260527000005_catalog_approve_staging_rpc.sql`

---

## Summary

Branch `feat/stream-d-catalog-agent-scaffold` (base `origin/main 9465013`),
final tip per memory anchor `e953df4`. **NOTE: the memory anchor records the
tip as `e953df4`. The caller context says the final pushed tip is `3c0823c`
with 11 commits. The memory anchor (authored mid-session) may have been
superseded by additional commits; verify with `git log --oneline -12
origin/feat/stream-d-catalog-agent-scaffold` before acting.**

**Delivered:**
- 2 Supabase migrations applied to production (confirmed 2026-05-28).
- `catalog_extraction_staging` HITL queue table (20 columns, 5 CHECK
  constraints, partial index on pending rows, admin-only RLS).
- `catalog_approve_staging_row(UUID, TEXT)` SECURITY DEFINER RPC
  (FOR UPDATE lock, dynamic INSERT column list, full denylist of
  workflow/provenance/status fields).
- `src/lib/catalog/staging.ts` -- 4 server actions for the HITL approval
  surface.
- `src/components/matrix-options/CatalogStagingReview.tsx` -- 3-column HITL
  approval pane (filters / list / detail+actions; admin-gated).
- `scripts/catalog-overnight/` -- Docling -> Ollama -> psycopg scaffold +
  PowerShell harness + 16 pytest unit tests + README.
- `docs/STREAM_D_AUTONOMOUS_AGENT.md` -- end-to-end architecture spec.

**4 gates on final tip:** lint GREEN, unit 2571 pass (32 net new), build
GREEN, playwright e2e 135 pass.

**6 owner-action items remain.** Recommended sequence: H1 -> H2 -> H3 -> H4
-> H5 -> H6 (H1 through H4 are sequential; H5 and H6 can be deferred to
first-real-run day).

---

## CRITICAL -- Cross-stream discovery: 3 missing catalog tables

The exploratory SQL block (Q1..Q10) in
`STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md` has been run and the OUTPUT
is populated. The output confirmed a critical finding:

**Only 2 of the 5 expected catalog tables exist in Supabase:**

| Table | Exists? | On-disk migration? |
|---|---|---|
| `public.promoted_parameter_values` | YES | YES (`20260527000003`) |
| `public.parameter_value_reviews` | YES | NO (applied via SQL Editor; shape confirmed in Q2 output) |
| `public.catalog_evidence_items` | **NO** | NO |
| `public.catalog_sources` | **NO** | NO |
| `public.source_lead_triage` | **NO** | NO |

**Confirmed definitively:** pg_class direct lookup returned exactly 2 rows.
UNION ALL COUNT(*) aborted at the catalog_evidence_items branch with
SQLSTATE 42P01 "relation does not exist".

**Affected TypeScript helpers (silent no-ops today):**

- `src/lib/matrix-options/provenance/evidence-sync.ts` -- all
  insert/select/delete calls against `catalog_evidence_items` silently
  return false/[] via safe-fallback pattern. No data has ever been
  persisted via this helper.
- `src/lib/matrix-options/provenance/source-sync.ts` -- all calls against
  `catalog_sources` silently no-op.
- `src/lib/matrix-options/provenance/triage-sync.ts` -- all calls against
  `source_lead_triage` silently no-op.

**Workflows silently no-op-ing today:** any Evidence Library flow that
calls evidence-sync.ts, source-sync.ts, or triage-sync.ts. The calls never
error visibly -- they return empty results and the UI surfaces nothing.

**Stream D RPC impact:** `catalog_approve_staging_row()` works end-to-end
for `proposed_kind = 'parameter_value'` today. The `evidence_item` and
`source_lead` CASE branches raise SQLSTATE 42P01 at INSERT time until
migrations for those tables are authored and applied. The UI surfaces the
error in the red action-error banner; the staging row stays in `pending`
state (the FOR UPDATE lock is released on rollback).

**This is being flagged here** as a cross-stream impact. A separate
Stream-A-follow-up commit will add a caveat comment to the affected
TypeScript files pointing at the missing-tables decision. The fix (authoring
migrations) is an owner judgment call -- see the decision callout at the
end of this doc.

---

## The 6 HITL action items

### H1 -- Confirm the SQL output is acceptable (DONE -- no action needed)

**Title:** Verify exploratory SQL output in pause artifact.

**What needs to happen:** The OUTPUT section of
`STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md` has been filled in by the
owner. The autonomous session has already updated the design doc and progress
log with the findings. No further owner action required on this item.

**Status:** RESOLVED 2026-05-28.

**Blocking:** H2 depended on this; it is now unblocked.

**Sequence position:** Done (was 1st).

---

### H2 -- Apply both Supabase migrations (if not yet applied)

**Title:** Apply `20260527000004_catalog_extraction_staging.sql` then
`20260527000005_catalog_approve_staging_rpc.sql` via Supabase Studio SQL
Editor.

**What needs to happen:**

1. Open Supabase Studio for the SSTAC Dashboard project -> SQL Editor.
2. Paste the full contents of
   `supabase/migrations/20260527000004_catalog_extraction_staging.sql` and
   run it.
3. Paste the full contents of
   `supabase/migrations/20260527000005_catalog_approve_staging_rpc.sql` and
   run it.
4. Confirm both succeed (each returns "Success. No rows returned" or similar).

Order matters. The RPC (file 5) references the staging table (file 4) by
name; applying 5 before 4 will fail.

**NOTE:** The caller context states "Two Supabase migrations applied to
production (verified 2026-05-28)." If this is accurate, H2 is already done.
Confirm by running:

```sql
SELECT table_name FROM information_schema.tables
  WHERE table_name = 'catalog_extraction_staging';
-- Expected: 1 row

SELECT proname FROM pg_proc
  WHERE proname = 'catalog_approve_staging_row';
-- Expected: 1 row
```

**Estimated time:** 5 minutes if not yet applied; 2 minutes to verify if
already applied.

**Blocking:** H6 (first-real-run) will fail without these applied. Also
blocks the `approveStagingRow()` approve path in the UI.

**Sequence position:** 2nd (or already done per caller context).

---

### H3 -- Set up the Python venv and verify 16 pytest unit tests pass

**Title:** One-time venv setup under `scripts/catalog-overnight/` + pytest
confirmation.

**What needs to happen:**

1. Open a PowerShell terminal in `C:\Projects\SSTAC-Dashboard\`.
2. Run:
   ```powershell
   python -m venv scripts/catalog-overnight/.venv
   scripts/catalog-overnight/.venv/Scripts/python.exe -m pip install -r scripts/catalog-overnight/requirements.txt
   scripts/catalog-overnight/.venv/Scripts/python.exe -m pytest scripts/catalog-overnight/tests/ -v
   ```
3. All 16 unit tests should pass. The autonomous session validated Python
   syntax only; this is the first live execution.
4. If any test fails: report the failure -- likely a missing package version
   floor or a path assumption. The LlmClient and psycopg interfaces are fully
   mocked so no live Ollama / Supabase connection is required.

**Estimated time:** 10-15 minutes (pip install + test run).

**Blocking:** does not block H2, H4, or H5. Blocks H6 (first-real-run
requires a working venv). Do this before H6.

**Sequence position:** 3rd.

---

### H4 -- Decide cadence and author the credential wrapper script

**Title:** Choose agent run cadence + author
`scripts/catalog-overnight/run-scheduled.ps1` credential wrapper.

**What needs to happen:**

**Step 4a -- Cadence decision:**

| Option | Pro | Con |
|---|---|---|
| Nightly 02:30 | Fresh proposals every morning | Burns Ollama lane nightly even without Zotero changes |
| Weekly Sunday 02:30 | Light Ollama footprint | Backlog can grow mid-week |
| On-demand (manual) | Owner controls Ollama lane; output quality validated before automation | Requires manual trigger |

Stream D recommendation: on-demand for the first month.

**Step 4b -- Credential wrapper:**

Author `scripts/catalog-overnight/run-scheduled.ps1`. The scaffold ships
three documented mechanisms in `scripts/catalog-overnight/README.md`
("Scheduling" section):
- CredentialManager PSGallery module (recommended for shared machines)
- DPAPI vault file (PowerShell SecureString on disk, per-user)
- Plain env var `$env:CATALOG_SUPABASE_DSN` (simplest for dev, least secure)

The wrapper reads the DSN from whichever mechanism the owner chooses and
passes it as `--dsn` to `run.ps1`. Per L0 rule: the DSN must never appear in
breadcrumb JSON or console output (the harness already redacts it; the
wrapper must also not echo it).

**Estimated time:** 15-30 minutes (README documents the pattern; it is
mostly a copy-and-fill exercise).

**Blocking:** scheduling via Task Scheduler depends on this wrapper. Does
not block H5 or the smoke-test portion of H6 (first-real-run can be
triggered manually via `.\run.ps1 --dsn <dsn>` without the wrapper for
initial testing).

**Sequence position:** 4th (can be done in parallel with H3).

---

### H5 -- Answer the 5 open questions in the design doc

**Title:** Resolve open questions for first-real-run in
`docs/STREAM_D_AUTONOMOUS_AGENT.md` "Open questions for owner" section.

**What needs to happen:**

The design doc lists 5 open questions that are owner judgment calls. Answer
them before or during first-real-run day so the wiring session has clear
inputs:

1. **Cadence:** nightly / weekly / on-demand? (Same as H4 step 4a above;
   answering here feeds into the schtasks command.)
2. **Zotero collection or saved-search key:** which one becomes the canonical
   `--zotero-collection` input to `run.ps1`? The linked attachment base dir
   is already fixed at `G:\My Drive\SABCS - Sediment Project\References` per
   L0 rule 1.14.
3. **DSN storage mechanism:** Credential Manager / DPAPI vault / env var?
   (Same as H4 step 4b above.)
4. **Ollama lane allocation:** when should this agent run relative to
   engine-v2 and DRA-KB scheduled runs? If concurrent, a
   `HITL_OLLAMA_THIRD_LANE_REQUEST_<ts>.md` mediation file is required per
   `OLLAMA_SCHEDULE_PROTOCOL.md` v0.5.
5. **First-real-run validation set:** which 3 PDFs from the chosen Zotero
   collection should be the smoke-test input before scaling to the full
   collection?

**Estimated time:** 15-30 minutes of owner thinking + brief edits to the
design doc (or verbally noted in a session and captured by the next session).

**Blocking:** H6 (first-real-run) cannot proceed without at least Q2
(Zotero collection) and Q5 (smoke-test PDF set).

**Sequence position:** 5th (decide before first-real-run day; can overlap
with H3 and H4).

---

### H6 -- First-real-run wiring (Zotero query layer + OllamaLlmClient)

**Title:** Implement the two scaffold-deferred components and run the 3-PDF
smoke test.

**What needs to happen:**

The scaffold exits with code 3 (`SILENT_BAIL`) before invoking Zotero or
Ollama -- both edges are deferred to owner first-real-run. First-real-run
wiring requires:

1. **Zotero query layer:** add a Python function (or call
   `http://localhost:23119/api` directly) that accepts a collection key and
   returns a list of `(zotero_key, attachment_path)` pairs. Reference:
   `src/lib/matrix-options/zotero/client.ts` for the TypeScript API shape.
   This can be a thin wrapper using the `requests` library (already in
   `requirements.txt`).

2. **Real OllamaLlmClient:** implement the `LlmClient` protocol defined in
   `scripts/catalog-overnight/extract.py`. The protocol requires:
   ```python
   def extract_proposals(
       *, zotero_key, attachment_path, table_data, model
   ) -> list[dict]
   ```
   Each returned dict: `proposed_kind`, `proposed_payload`, `confidence`,
   `extraction_notes`. The client posts to `http://localhost:11434` (local
   Ollama only per L0 `cross_project_local_ollama_only_for_ingestion_pipelines`).

3. **Smoke test:** run against the 3 PDFs from H5 Q5. Verify:
   - Staging rows land in `catalog_extraction_staging` (check via Supabase
     Studio: `SELECT COUNT(*) FROM public.catalog_extraction_staging;`).
   - `CatalogStagingReview.tsx` shows the pending rows in the UI.
   - Approve one row with `proposed_kind = 'parameter_value'` -- confirm it
     lands in `public.promoted_parameter_values`.
   - Reject one row -- confirm `hitl_status` changes to `'rejected'`.

4. **Ollama lane check:** before running, confirm no other Ollama-bound lane
   is active per `OLLAMA_SCHEDULE_PROTOCOL.md` v0.5. If engine-v2 or DRA-KB
   is running, write `HITL_OLLAMA_THIRD_LANE_REQUEST_<ts>.md` for mediation.

**Estimated time:** 2-4 hours (implementation + smoke test + debugging).

**Blocking:** depends on H2 (migrations applied), H3 (venv + pytest GREEN),
H4 (DSN wrapper and cadence), H5 Q2 + Q5 (collection key + 3 PDFs). This
is the last action in the sequence.

**Sequence position:** 6th (last; do when H2-H5 are resolved).

---

## Optional decision callout: author migrations for the 3 missing tables?

This is a separate owner decision, distinct from the 6 HITL items above. The
Stream D autonomous session did NOT author migrations for
`catalog_evidence_items`, `catalog_sources`, and `source_lead_triage` because:

- The TypeScript type shapes (evidence-sync.ts / source-sync.ts /
  triage-sync.ts) may have drifted from the intended schema.
- RLS policies, CHECK constraints, and indexes are owner judgment calls.
- The scaffold's promote path requires these tables only when `proposed_kind`
  is `'evidence_item'` or `'source_lead'`. The default `'parameter_value'`
  kind works end-to-end today.

**Two options:**

**(A) Author migrations now (recommended if these workflows are near-term):**
The next Stream D session (or a dedicated follow-up session) can author
migrations by reading the TypeScript row shapes from the three sync files:
- `src/lib/matrix-options/provenance/evidence-sync.ts` -> column shape for
  `catalog_evidence_items`.
- `src/lib/matrix-options/provenance/source-sync.ts` -> column shape for
  `catalog_sources`.
- `src/lib/matrix-options/provenance/triage-sync.ts` -> column shape for
  `source_lead_triage`.

Then run the exploratory-SQL pattern again to confirm nothing else references
these table names before creating them.

**(B) Defer until these workflows are actively used:**
The safe-fallback pattern in the TypeScript helpers means nothing is broken
today -- the helpers return empty/false silently. The Evidence Library UI
continues to work for its other features. Deferring is safe.

**Owner judgment call.** If you want to unblock `evidence_item` and
`source_lead` approval paths in the CatalogStagingReview UI, option A is
the path. If you plan to use the agent only for `parameter_value` extraction
for now, option B keeps scope narrow.

---

*Authored 2026-05-28 by Stream-A subagent (Sonnet 4.6).*
*Read-only source: C:\Projects\SSTAC-Dashboard\ (Stream D active tree, not modified).*
*Deliverable location: C:\Projects\SSTAC-Dashboard-worktree-stream-a\STREAM_D_HITL_OWNER_CHECKLIST_2026_05_28.md*
