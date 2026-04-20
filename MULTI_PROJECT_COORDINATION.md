# Multi-Project Coordination: SSTAC Dashboard + Regulatory Review + Database Cleanup

**Lifecycle:** REFERENCE (dated coordination snapshot)
**Last reframed:** 2026-04-20
**Purpose:** Coordination reference for three concurrent workstreams that share code, data, or deployment surface.

---

## About this document

This file has two jobs:

1. **Structural reference** — data-ownership rules, synchronization points, session-resumption instructions, risk assessment across the three workstreams. These are stable and should be kept current.
2. **Dated status snapshots** — point-in-time narrative about what each workstream was doing. Snapshots are preserved with their original dates and should not be treated as current truth without re-verification (`git log`, the current state of each repo, or the dashboard's `docs/_meta/docs-manifest.json`).

Canonical workspace paths used in this document:

- SSTAC Dashboard: `C:/Projects/SSTAC-Dashboard`
- Regulatory-Review: `C:/Projects/Regulatory-Review` *(flagged; cross-repo path, verify casing on each operator's machine)*

If a path in a dated snapshot references `F:\sstac-dashboard` or any other legacy drive/case variant, treat it as historical evidence of where a file *was* said to be at the time the snapshot was written — not as a current location.

---

## Workstream summaries (structural)

### Workstream 1 — SSTAC Dashboard (this repo)

- **Primary repo:** `C:/Projects/SSTAC-Dashboard`
- **Data ownership:** Supabase (polls, discussions, announcements, tags, milestones, documents metadata, review submissions, user roles) and a local SQLite database at `src/data/regulatory-review.db` (regulatory-review feature only — present in local dev, intentionally absent in Vercel builds; see `docs/OPERATIONS_RUNBOOK.md` "Local-Engine SQLite Fallback").
- **Deployment:** Vercel. Regulatory-review features gated by `LOCAL_ENGINE_ENABLED` (server) and `NEXT_PUBLIC_LOCAL_ENGINE` (client); see `docs/ENVIRONMENT_REFERENCE.md`.
- **Canonical entrypoint:** `docs/INDEX.md`.
- **Status/metrics:** do not embed here — route to `docs/INDEX.md` (narrative) and `docs/_meta/docs-manifest.json` `facts` (numbers).

### Workstream 2 — Regulatory-Review (sibling repo)

- **Primary repo:** `C:/Projects/Regulatory-Review` (separate git repo, not a submodule).
- **What it owns:** the evaluation engine (Python + docling + embeddings + Ollama), the policy knowledge base (`engine/data/rraa_v3_2.db` — opened by the dashboard at `{cwd}/../Regulatory-Review/engine/data/rraa_v3_2.db`), submission source documents (`1_Active_Reviews/<project>/0_Source_Documents/`), extractions (`1_Extractions/`), evaluation outputs (`2_Evaluation_Output/`), HITL packets.
- **Dashboard's view of it:** read-only at runtime. The dashboard reads the engine DB (via `better-sqlite3`) and the RR folder tree (via filesystem reads in engine-gated API routes). The dashboard **launches** extract/evaluate subprocesses via `src/lib/regulatory-review/launch-evaluation.ts` when `LOCAL_ENGINE_ENABLED=true`.
- **Contract files to read before making cross-repo claims:**
  - `C:/Projects/Regulatory-Review/CLAUDE.md`
  - `C:/Projects/Regulatory-Review/engine/docs/_INDEX.md`
  - `C:/Projects/Regulatory-Review/engine/docs/active/development/ACTIVE_DOCS.md`
  - Topology / BN-RRM handoff files — locate with `rg --files C:/Projects/Regulatory-Review` before referencing; names and locations have shifted between revisions.
- **RR-side stale paths / internal contradictions:** flagged in the 2026-04 dashboard audit (`docs/_meta/DOCUMENTATION_AUDIT_2026-04.md` §1.4). Do **not** cite stale RR `F:\` paths or RR `_INDEX.md` content that was superseded by `engine/docs/_INDEX.md` without re-reading the current file.

### Workstream 3 — Database Cleanup (sibling initiative)

- Ongoing cleanup of historical poll/survey and assessment data. Not currently reflected in a dedicated repo path; coordination happens primarily in Supabase migrations and ad-hoc scripts under `C:/Projects/SSTAC-Dashboard/scripts/`.
- **Dependency:** most cleanup steps want the Regulatory-Review evaluation engine to be quiescent (no partially-written tier results). Schedule accordingly.

---

## Shared-state boundaries

| Boundary | Owner | Consumer | Notes |
|---|---|---|---|
| Supabase tables (polls, discussions, review submissions, documents metadata, user roles) | Dashboard | Dashboard | RLS enforces access; see `docs/DATABASE_SCHEMA.md`. |
| Engine SQLite DB (`rraa_v3_2.db`) | Regulatory-Review | Dashboard (read) via `src/lib/sqlite/queries/**` | Lazy-loaded; absent in serverless. |
| Submission SQLite DB (`src/data/regulatory-review.db`) | Dashboard | Dashboard (read/write); RR may sync into it | Not in serverless. |
| Evaluation output folder (`2_Evaluation_Output/<project>/<session>/`) | Regulatory-Review (engine process) | Dashboard HITL packet routes; dashboard auto-import on completion | Path-traversal guard enforced in `src/lib/hitl-packets/discovery.ts`. |
| Source documents (`0_Source_Documents/`) | User (uploads via dashboard) | Regulatory-Review engine | Upload goes through `projects/[id]/files` route (engine-gated). |
| Ollama model server | Operator's machine | Dashboard assistant routes (`/api/regulatory-review/assistant/*`) | Base URL configurable via `OLLAMA_BASE_URL`; see `docs/ENVIRONMENT_REFERENCE.md`. |

---

## Session resumption (how to pick up across all three)

1. **Confirm which repo you are in** (`git rev-parse --show-toplevel`) — prompts and paths differ across dashboard vs RR vs cleanup.
2. **Read the canonical entrypoint for that repo first.** Dashboard: `docs/INDEX.md`. RR: `CLAUDE.md` + `engine/docs/_INDEX.md`.
3. **Re-verify any dated claim before acting on it.** Snapshots in this file, in PROJECT_STATUS.md, and in archived docs are evidence of past state, not current truth. Use `git log` and current code as authority.
4. **Before touching cross-repo contract surfaces** (engine DB schema, pack artifact contract, HITL packet layout, Python subprocess invocation), read the corresponding RR contract file explicitly — do not rely on dashboard-side summaries.
5. **Pre-existing dirty files** such as `.claude/settings.local.json` (modified) and `.claude/pending-commit-message.txt` (untracked) in the dashboard repo are developer scratch. Do not stage or commit them unless that is the actual task.

---

## Risks at the boundary

| Risk | Blast radius | Mitigation |
|---|---|---|
| Engine DB schema change | Breaks dashboard read queries | Coordinate via `C:/Projects/Regulatory-Review/engine/docs/active/development/ACTIVE_DOCS.md`; dashboard tests include schema expectations in `src/lib/sqlite/queries/__tests__/`. |
| Folder structure change in `1_Active_Reviews/` | Breaks HITL discovery and extract/evaluate subprocess launch | `HITL_PACKET_DIR` env var can relocate discovery root; subprocess launch path is hardcoded in `src/lib/regulatory-review/launch-evaluation.ts` (deferred item — see NEXT_STEPS.md). |
| BN-RRM pack contract change | Breaks dashboard `public/bn-rrm/packs/` readers | Pack contract documented in `docs/bn-rrm/README.md`; changes require a dashboard-side version bump. |
| Python interpreter not found | Extract/evaluate subprocess launch fails at runtime | `REG_REVIEW_PYTHON_PATH` env var must point at a full `python.exe` path; see `docs/ENVIRONMENT_REFERENCE.md`. |
| Ollama not running | Assistant chat returns SSE error; `/assistant/models` returns empty list with error string | UI surfaces connection status; no silent degradation. |
| Vercel build fails because of `better-sqlite3` | Dashboard cannot deploy | `next.config.ts` marks module external; lazy-load pattern in `src/lib/sqlite/client.ts`; see `docs/OPERATIONS_RUNBOOK.md` "Local-Engine SQLite Fallback". |
| Shared Supabase project misconfiguration | All dashboard reads/writes fail | Supabase env vars documented in `docs/ENVIRONMENT_REFERENCE.md`; middleware handles expired tokens gracefully per `docs/operations/MIDDLEWARE_GUIDE.md`. |

---

## Dated coordination snapshots (historical)

The entries below are preserved point-in-time descriptions. Dates are verbatim from when each snapshot was written. Verify with `git log` and current code state before acting on anything here.

### 2026-01-27 — Coordination snapshot (verbatim from v1.3 of this file)

*Preserved for audit-trail continuity. Numbers and "complete" claims below reflect state at the time of writing, not current truth.*

- **SSTAC Dashboard:** 7 phases reported complete; UI/UX corrections for regulatory-review reported complete at commit `afc0eff`. Regulatory-review UI/UX proposal stored at `docs/regulatory-review/REGULATORY_REVIEW_UX_PROPOSAL.md` and mockups at `docs/regulatory-review/REGULATORY_REVIEW_MOCKUPS.md` (both still present as of 2026-04-20).
- **Regulatory-Review:** Tier 2 rerun reported at 467 of 598 batches (~78%). Verify against the engine's current progress tracker before citing.
- **Database Cleanup:** On hold pending Tier 2 rerun completion.
- **Source path for this snapshot:** v1.3 of this file, January 27, 2026. Legacy `F:\sstac-dashboard` and `F:\Regulatory-Review` paths that appeared in v1.3 have been rewritten to canonical `C:/Projects/...` paths in the structural sections above; the snapshot itself is preserved in prose.

### 2026-04-20 — Coordination snapshot (documentation audit pass)

- **SSTAC Dashboard:** documentation audit (`docs/_meta/DOCUMENTATION_AUDIT_2026-04.md`) completed. Phases 1–3 of the doc pass landed (audit + registration, new-doc additions, authoritative + reference cleanup). Code unchanged. Pre-existing dirty files (`.claude/settings.local.json`, `.claude/pending-commit-message.txt`) preserved untouched throughout the pass.
- **Regulatory-Review:** no dashboard-side changes to the cross-repo contract. RR-side stale paths and internal contradictions flagged in audit §1.4 remain deferred (see `docs/NEXT_STEPS.md`).
- **Database Cleanup:** no change in status captured during the doc pass.

---

## How to update this file

- **Structural sections** (workstream summaries, shared-state boundaries, session resumption, risks) should be kept current by editing in place. Changes land in the next commit that touches this file.
- **Dated snapshots** are append-only — add a new `### YYYY-MM-DD — …` section at the bottom of the snapshots list. Do not rewrite older snapshots; mark claims as historical if they become stale.
- Do not embed grades, "production ready" claims, or rolling test counts here. Route metrics to `docs/_meta/docs-manifest.json` `facts` and narrative to `docs/INDEX.md`.
