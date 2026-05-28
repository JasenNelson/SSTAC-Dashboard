# Stream D Pivot Notice -- 2026-05-28

**Status:** ACTIVE -- Stream D autonomous session is rebuilding its extraction-pipeline architecture as of 2026-05-28. This notice exists so readers of 3 already-pushed docs do not act on stale references to Ollama-based extraction.

## What's changing

Stream D session disclosed 2026-05-28 that it made incorrect assumptions in its earlier scaffold and is currently rebuilding the catalog extraction pipeline architecture. Concrete change:

- **Old architecture (now superseded):** `scripts/catalog-overnight/extract.py` used a Docling + Ollama LLM client + psycopg writer stack, triggered overnight by a Windows Task Scheduler PowerShell harness (`run.ps1`). The harness emitted breadcrumb JSON for stall-watchdog monitoring.

- **New architecture (in progress, design-locking in Stream D's Phase 2 with owner):** Docling helpers + psycopg writer become a Python LIBRARY (no Ollama dependency). A Claude Code session itself is the orchestrator -- it reads the manifest, calls the library helpers, reasons about extraction results, writes proposed staging rows. Scheduling via Claude Code's autonomous mechanisms (`/schedule`, `ScheduleWakeup`, `CronCreate`, `claude -p` headless, etc.). Owner picks the exact mechanism in Stream D's Phase 2 design locks.

Stream D session is in its Phase 1 (3 parallel Explore subagents surveying Regulatory-Review autonomous patterns + Claude Code scheduling surface + BN-RRM lift) ahead of design-lock decisions. Phase 5 push (the new architecture on origin) lands when their Phases 1-4 complete.

## Affected docs already on origin/main

3 docs were pushed BEFORE the pivot was disclosed and reference the old Ollama-based architecture. They are snapshots-in-time:

1. **`PHASE_3_TRANSITION_DRAFT_2026_05_28.md`** (commit `f970064`).
   - Section 3(f) says "Implement Zotero query layer + real OllamaLlmClient in extract.py" -- stale.
   - Phase 3 close criteria H6 will be reframed once Stream D's new design locks.

2. **`STREAM_D_HITL_OWNER_CHECKLIST_2026_05_28.md`** (commit `a8bdde3`).
   - H6 references Ollama wiring as the first-real-run gate -- stale.
   - H3 (Python venv setup for the OLD extract.py) -- may be partially relevant for the new library refactor; verify against the new architecture when it lands.

3. **`STREAM_D_MERGE_READINESS_2026_05_28.md`** (commit `16b8706`).
   - Section 5 lists H6 as "first-real-run with Zotero + Ollama" -- stale.
   - Stream D's actual branch tip referenced as `02dcc2d` is also pre-pivot; the new tip will land further commits with the refactor.

## What is NOT changing in those 3 docs

The structural framing in each doc remains valid:
- Phase 3 completion criteria are still a meaningful 7-item dependency graph.
- HITL checklist sequencing (H1 resolved -> H2 verify -> H3..H6 sequence) is still the right shape.
- Merge-readiness conflict analysis was CLEAN at the time of analysis; the new Stream D commits will re-trigger conflict re-check before any merge.

The Ollama-specific text in each doc will be updated to reference the new Claude-Code-orchestrator architecture once Stream D's Phase 5 push lands.

## Update plan when Stream D's new architecture lands

Single follow-up commit on `main` (content-only per Q1.a) updates:
- PHASE_3_TRANSITION_DRAFT Section 3(f) -> new orchestrator wiring + manifest source language.
- STREAM_D_HITL_OWNER_CHECKLIST H3, H5, H6 -> new design locks (cadence, manifest source, scheduling mechanism).
- STREAM_D_MERGE_READINESS Section 5 + Section 9 -> new gate re-confirmation set + new merge command if branch structure changes.

This notice itself is also updated then (or marked CLOSED if the pivot has fully landed).

## Why this notice exists (vs editing the 3 docs in place)

A single new doc at repo root is lower-intrusion than editing each affected doc. The 3 docs were authored as authoritative snapshots; editing them mid-pivot risks compounding stale text with partial corrections. This notice keeps the 3 docs intact as snapshots-in-time and routes readers to the right interpretation lens.

When Stream D's new architecture is locked + landed, this notice becomes the change-log entry that points readers at the specific updates applied.

## What to do if you're reading the 3 affected docs right now

1. Read this notice first.
2. Treat any reference to `OllamaLlmClient`, `extract.py` (old Python script), or `run.ps1` as stale.
3. The 6 HITL action items in `STREAM_D_HITL_OWNER_CHECKLIST_2026_05_28.md` mostly survive the pivot in spirit; the specific implementation referenced in each item will be reframed.
4. Do not author code that depends on the old Ollama-based architecture. Wait for Stream D's Phase 5 push.

## Cross-references

- L0 1.12 (Ollama Schedule Protocol) -- still applicable for any work that DOES use Ollama (which Stream D no longer does, but other lanes might).
- `cross_project_local_ollama_only_for_ingestion_pipelines.md` -- still applicable. Stream D removing Ollama means they are no longer in the ingestion pipelines that rule scopes; not a violation. (The new Claude Code orchestrator is a different category.)
- Stream D's session is doing its own Phase 4 adversarial review via cursor-agent CLI. Per `cross_project_cursor_agent_codex_or_composer_not_opus_for_adversarial_review.md` (HIGH AUTHORITY 2026-05-28): the cursor-agent invocation must select `gpt-5.3-codex-xhigh` (xhigh thinking) or `composer-2.5` (medium thinking), NOT `claude-opus-4-7-thinking-xhigh`. Stream D's plan as disclosed referenced an Opus-thinking model inside cursor-agent -- that selection needs the same correction so the adversarial review actually comes from a different AI system family than the Opus orchestrator session.

---

*Authored autonomously 2026-05-28 by parent Opus 4.7 session. Read-only on Stream D's tree throughout authoring. Single short notice at repo root; intentionally minimal to avoid mid-pivot drift.*
