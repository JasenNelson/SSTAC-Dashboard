# Matrix Options Autonomous Docs PR Manifest - 2026-07-08

## Purpose

Preserve the autonomous Matrix Options run artifacts in a docs-only PR without touching the dirty
primary checkout or any protected worklane.

## Source Worktree

```text
C:\tmp\sstac-mo-overnight-20260708
```

Expected base:

```text
3285998
```

## Files To Stage

Stage exactly these files, path-scoped:

```text
docs/AGY_MATRIX_OPTIONS_12H_EXECUTION_PLAN_2026_07_08.md
docs/AGY_MATRIX_OPTIONS_NATIVE_PROMPT_2026_07_08.md
docs/MATRIX_OPTIONS_AUTONOMOUS_CLOSEOUT_2026_07_08.md
docs/MATRIX_OPTIONS_AUTONOMOUS_DOCS_PR_MANIFEST_2026_07_08.md
docs/MATRIX_OPTIONS_AUTONOMOUS_RUN_STATUS_2026_07_08.md
docs/MATRIX_OPTIONS_BACKLOG_EXECUTION_MAP_2026_07_08.md
docs/MATRIX_OPTIONS_CANDIDATE_CODE_PR_MANIFEST_2026_07_08.md
docs/MATRIX_OPTIONS_CYANIDE_SPECIATION_PACKET_2026_07_08.md
docs/MATRIX_OPTIONS_DIOXIN_TDI_PROBE_PORTABILITY_PACKET_2026_07_08.md
docs/MATRIX_OPTIONS_E2E_AUTH_VISIBILITY_PACKET_2026_07_08.md
docs/MATRIX_OPTIONS_E2E_ASSESSMENT_2026_07_08.md
docs/MATRIX_OPTIONS_HC_TRV_PROMOTION_HELPERS_PACKET_2026_07_08.md
docs/MATRIX_OPTIONS_HC_TRV_EXTRACTOR_PORTABILITY_PACKET_2026_07_08.md
docs/MATRIX_OPTIONS_INHALATION_SCHEMA_PACKET_2026_07_08.md
docs/MATRIX_OPTIONS_NATIVE_AGY_COMMIT_PROMPT_2026_07_08.md
docs/MATRIX_OPTIONS_ONTARIO_MECP_INGESTION_PACKET_2026_07_08.md
docs/MATRIX_OPTIONS_ORGANOMERCURY_PACKET_2026_07_08.md
docs/MATRIX_OPTIONS_OVERNIGHT_STATUS_2026_07_08.md
docs/MATRIX_OPTIONS_PCB_ALIAS_PACKET_2026_07_08.md
docs/MATRIX_OPTIONS_PHASE_C_SOURCE_PREFLIGHT_2026_07_08.md
docs/MATRIX_OPTIONS_PR545_READINESS_2026_07_08.md
docs/MATRIX_OPTIONS_UI_RUNTIME_BACKLOG_PACKET_2026_07_08.md
docs/_meta/docs-manifest.json
```

Do not stage any other file.

## Suggested Branch

```text
docs/matrix-options-autonomous-run-2026-07-08
```

## Suggested Commit

```text
Document Matrix Options autonomous run status
```

## Suggested PR Title

```text
Document Matrix Options autonomous run status
```

## Suggested PR Body

```text
## Summary

- Adds the Matrix Options autonomous execution plan and native AGY prompt.
- Captures #545 readiness, Phase C source preflight, HC TRV helper/extractor mapping, organomercury decision packet, UI/runtime backlog, E2E assessment/auth-visibility findings, and backlog execution map.
- Records that Codex-sandbox AGY launch is blocked by OAuth/proxy behavior, while native AGY can continue from the included prompts and Codex can use Spark/mini workhorse fallback.

## Scope

Docs only. No code, catalog, Supabase, Gate2B, engine-v2, qa_status, default_status, or review-status changes.

## Verification

- ASCII check passed for all authored files.
- Path list verified before staging.
- docs/_meta/docs-manifest.json registers the new docs as reference artifacts.
```

## Commands For Unrestricted Shell Or Native AGY

Run from `C:\tmp\sstac-mo-overnight-20260708`:

```powershell
git status --short
git add -- `
  docs/AGY_MATRIX_OPTIONS_12H_EXECUTION_PLAN_2026_07_08.md `
  docs/AGY_MATRIX_OPTIONS_NATIVE_PROMPT_2026_07_08.md `
  docs/MATRIX_OPTIONS_AUTONOMOUS_CLOSEOUT_2026_07_08.md `
  docs/MATRIX_OPTIONS_AUTONOMOUS_DOCS_PR_MANIFEST_2026_07_08.md `
  docs/MATRIX_OPTIONS_AUTONOMOUS_RUN_STATUS_2026_07_08.md `
  docs/MATRIX_OPTIONS_BACKLOG_EXECUTION_MAP_2026_07_08.md `
  docs/MATRIX_OPTIONS_CANDIDATE_CODE_PR_MANIFEST_2026_07_08.md `
  docs/MATRIX_OPTIONS_CYANIDE_SPECIATION_PACKET_2026_07_08.md `
  docs/MATRIX_OPTIONS_DIOXIN_TDI_PROBE_PORTABILITY_PACKET_2026_07_08.md `
  docs/MATRIX_OPTIONS_E2E_AUTH_VISIBILITY_PACKET_2026_07_08.md `
  docs/MATRIX_OPTIONS_E2E_ASSESSMENT_2026_07_08.md `
  docs/MATRIX_OPTIONS_HC_TRV_PROMOTION_HELPERS_PACKET_2026_07_08.md `
  docs/MATRIX_OPTIONS_HC_TRV_EXTRACTOR_PORTABILITY_PACKET_2026_07_08.md `
  docs/MATRIX_OPTIONS_INHALATION_SCHEMA_PACKET_2026_07_08.md `
  docs/MATRIX_OPTIONS_NATIVE_AGY_COMMIT_PROMPT_2026_07_08.md `
  docs/MATRIX_OPTIONS_ONTARIO_MECP_INGESTION_PACKET_2026_07_08.md `
  docs/MATRIX_OPTIONS_ORGANOMERCURY_PACKET_2026_07_08.md `
  docs/MATRIX_OPTIONS_OVERNIGHT_STATUS_2026_07_08.md `
  docs/MATRIX_OPTIONS_PCB_ALIAS_PACKET_2026_07_08.md `
  docs/MATRIX_OPTIONS_PHASE_C_SOURCE_PREFLIGHT_2026_07_08.md `
  docs/MATRIX_OPTIONS_PR545_READINESS_2026_07_08.md `
  docs/MATRIX_OPTIONS_UI_RUNTIME_BACKLOG_PACKET_2026_07_08.md `
  docs/_meta/docs-manifest.json
git diff --cached --name-only
git commit -m "Document Matrix Options autonomous run status"
git push -u origin docs/matrix-options-autonomous-run-2026-07-08
gh pr create --title "Document Matrix Options autonomous run status" --body-file .tmp/pr-body-matrix-options-autonomous-run-2026-07-08.md
```

If `gh pr create --body-file` is used, create `.tmp/pr-body-matrix-options-autonomous-run-2026-07-08.md`
from the suggested PR body above. Do not commit that `.tmp` file.

## Gate Decision

Docs-only. No build/test gates are required unless repository policy changes. If CI runs on the PR,
wait for green. If Unit Tests flakes with the known EPIPE/ForksPoolWorker signature, use the existing
single-rerun SOP.

## Safety Checks

Before commit, verify:

```powershell
git diff --cached --name-only
```

returns only the twenty-three files listed above.

Also verify no forbidden paths:

```powershell
git diff --cached --name-only | rg "^(\\.mcp\\.json|supabase/|src/lib/engine-v2/|src/app/api/engine-v2/|src/data/)"
```

Expected result: no output.
