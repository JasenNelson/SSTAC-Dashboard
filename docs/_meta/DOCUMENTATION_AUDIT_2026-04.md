# Documentation Audit — 2026-04

**Date drafted:** 2026-04-19
**Audit lifecycle:** REFERENCE
**Scope:** `C:\Projects\SSTAC-Dashboard` (dashboard) + dashboard↔`C:\Projects\Regulatory-Review` (Regulatory Review, hereafter **RR**) integration boundary.
**Out of scope:** RR engine internals (MASTER_PRD_v4, ARCHITECTURE_v74); restructuring the gate/manifest system; any code changes.

**Source-of-truth rule (binding):** every finding below carries a `Source:` line citing the file path(s) or command(s) that verified it. Claims sourced only from historical/archived/AI-summary content are flagged `[unverified]` and listed as deferred. Items sourced from current production code, current scripts, or current manifest/index entries are stated as findings.

**Convention:** a finding is **VERIFIED** when at least one source citation comes from current production code (`src/**`, `public/**`, `scripts/**`), the current manifest/index, or an explicitly-read current cross-repo contract file. Claims sourced only from a historical doc are flagged `[unverified]` even if cited.

---

## 1.1 Inventory snapshot

Total Markdown files inventoried: ~130 across the repo. Grouping below; dates are last-modified per `git log -1 --format=%cs --follow -- <path>`.

Source: doc inventory pass over `docs/**`, `.github/**`, `.claude/**`, and root, with `git log -1 --format=%cs --follow` per file.

### Repo root (governance, strategy, status)
- `README.md` — 2025-11-03 — Project overview.
- `CONTRIBUTING.md` — 2025-11-02 — Contribution guidelines.
- `MULTI_PROJECT_COORDINATION.md` — 2026-01-28 — Three-project coordination (registered in INDEX L117–123).
- `ROADMAP.md`, `EXECUTIVE_SUMMARY.md`, `UPGRADE_PLAN_A_GRADE.md`, `UPGRADE_QUICK_START.md`, `STATUS_REVIEW_2026-01-25.md`, `IMPLEMENTATION_LOG.md` — all 2026-01-25/26 — A+ upgrade strategy docs (registered in INDEX L93–102).

**Governance escape note:** all root-level strategy docs are *outside* `docs/` but *inside* INDEX.md's enumerated set, so they live in a hybrid register: linked from INDEX but not all in `documents[]`. See §1.2.

### `docs/` root
- `docs/INDEX.md` — 2026-01-28 — AUTHORITATIVE canonical entrypoint.
- `docs/README.md` — 2026-01-25 — explicitly flagged legacy by INDEX L125–127.
- `docs/AGENTS.md` — 2026-01-28 — AUTHORITATIVE for the API gate.
- `docs/ARCHIVE_POLICY.md` — 2026-01-28 — AUTHORITATIVE archive governance.
- `docs/API_REFERENCE.md` — 2026-01-26 — REFERENCE; describes "28 endpoints" (drift verified, see §1.3).
- `docs/ARCHITECTURE_DECISIONS.md`, `docs/DATABASE_SCHEMA.md`, `docs/DEVELOPER_QUICKSTART.md`, `docs/LESSONS.md`, `docs/NEXT_STEPS.md`, `docs/OPERATIONS_RUNBOOK.md`, `docs/PERFORMANCE_TUNING_GUIDE.md`, `docs/PROJECT_STATUS.md`, `docs/SECURITY_BEST_PRACTICES.md`, `docs/TROUBLESHOOTING_GUIDE.md` — all 2026-01-26.
- `docs/PERFORMANCE_TESTING.md`, `docs/PHASE3_TESTING_REPORT.md`, `docs/QUICK_START_TEMPLATES.md`, `docs/SECURITY_TESTING.md` — 2026-01-25.

### `docs/operations/`
- `docs/operations/MONITORING_GUIDE.md` — 2026-01-25.
- `docs/operations/VERCEL_SETUP.md` — 2026-01-25.

### `docs/poll-system/` (strict governance — out of scope unless audit reveals defect)
- `README.md`, `POLL_SYSTEM_COMPLETE_GUIDE.md`, `POLL_SYSTEM_DEBUGGING_GUIDE.md`, `CEW_DATA_FLOW.md`, `SAFE_POLL_UPDATE_PROTOCOL.md` — dates range 2025-11-08 → 2026-01-25.

### `docs/regulatory-review/`
- `REGULATORY_REVIEW_UX_PROPOSAL.md`, `REGULATORY_REVIEW_MOCKUPS.md`, `REGULATORY_REVIEW_UX_PROPOSAL_REVIEW.md`, `REGULATORY_REVIEW_UX_PROPOSAL_CORRECTIONS_APPLIED.md` — 2026-01-28 — registered in INDEX L111–115 and manifest `documents[]`.
- **Orphans not in INDEX or manifest** (verified by `Grep` for ids `regulatory.phase1_pyramid_nav`, `regulatory.local_engine_routing`, `regulatory.chat_and_search_enhancement`, `regulatory.codex_review_prompt` in `docs/_meta/docs-manifest.json` — none present):
  - `PHASE1_PYRAMID_NAVIGATION_IMPLEMENTATION.md` — 2026-01-28 — Implementation guide for pyramid nav, references `src/app/(dashboard)/regulatory-review/[submissionId]/ReviewDashboardClient.tsx` lines 109–119, 183–229, 494–699. **Status:** active implementation guide.
  - `LOCAL_ENGINE_ROUTING_PLAN.md` — 2026-02-21 — DRAFT v3.1.1; defines `LOCAL_ENGINE_ENABLED` / `NEXT_PUBLIC_LOCAL_ENGINE` env vars and `src/lib/feature-flags.ts` interface. **Status:** substantially implemented (env vars in `.env.example` lines 7–9; `feature-flags.ts` exists per env-var search).
  - `CHAT_AND_SEARCH_ENHANCEMENT_PLAN.md` — 2026-02-21 — v1.1; describes `/assistant/*` routes and `requireAdmin()` + `requireLocalEngine()` gating. **Status:** partially implemented (`src/app/api/regulatory-review/assistant/chat/route.ts` and `.../assistant/models/route.ts` exist with `requireAdmin + requireLocalEngine` per route inventory).
  - `CODEX_REVIEW_PROMPT.md` — 2026-02-21 — Codex review prompt template; ancillary, not a feature spec.
- `docs/regulatory-review/archive/` — `REGULATORY_REVIEW_MOCKUPS_PRE_CORRECTIONS.md`, `REGULATORY_REVIEW_UX_PROPOSAL_PRE_CORRECTIONS.md` — 2026-01-28; registered in manifest as `regulatory.ux_proposal_pre_corrections` / `regulatory.ux_mockups_pre_corrections`.

Source: file inventory + `Grep -n '"id":' docs/_meta/docs-manifest.json`.

### `docs/_meta/`
- `docs/_meta/docs-manifest.json` — AUTHORITATIVE manifest. Verified present (this audit's parent directory).

### `docs/archive/2026-01-27_multi-project-coordination/`
- `README.md` + `MULTI_PROJECT_COORDINATION_v1.0_ARCHIVED.md` through `v1.3_ARCHIVED.md` — all 2026-01-28; registered in manifest with `archive.*` ids.

### `docs/system-design/`, `docs/testing/`, `docs/debugging/`, `docs/review-analysis/`
- `system-design/` — `README.md`, `MATRIX_GRAPH_VISUALIZATION.md`, `DEBUGGING_LESSONS_LEARNED.md`.
- `testing/` — `README.md`, `K6_COMPREHENSIVE_TESTING_PLAN.md`.
- `debugging/` — `COMMIT_PREPARATION.md`, `PRE_COMMIT_CHECKLIST.md`.
- `review-analysis/` — `README.md`, `REVIEW_SUMMARY.md`, `HOW_TO_CONDUCT_GRADE_ANALYSIS.md`, `NEXT_STEPS.md`, plus 60+ files under `archive/`.

### `.github/`
- `PHASE_CHECKLIST.md`, `UPGRADE_TRACKING.md`, `GITHUB_ISSUES_TEMPLATE.md`, `PHASE_6_VALIDATION.md`, `LOG_AGGREGATION_SETUP.md`, `METRICS_DASHBOARD_SETUP.md`, `MONITORING_SETUP.md` — all 2026-01-25/26.

### `.claude/`
- 12 docs (refactoring plans, session checkpoints, session summaries) — dates 2026-01-25 → 2026-01-26.
- `.claude/skills/safe-exit/SKILL.md`, `.claude/skills/update-docs/SKILL.md` — 2026-01-25; both contain stale `F:\` paths (see §1.6).
- **`.claude/README.md` — does NOT exist.** Source: file inventory pass.

### Notable inventory observations
- The bulk of `docs/` was last touched 2026-01-25/26/28; nothing in `docs/` has been touched after 2026-02-21. Recent commit activity (BN-RRM Jermilova, conceptual tiers, FRDR overlays, middleware silencing — all between 2026-01-28 and 2026-04-XX per `git log --oneline -10`) has produced no `docs/` output.
- `docs/bn-rrm/` directory does not exist. Source: doc inventory pass.
- `docs/_meta/` directory exists (this file's location).

---

## 1.2 Gate-aligned coverage matrix

The manifest declares two gates in `bundles` (Source: `Grep '"bundles"' docs/_meta/docs-manifest.json` → L1683; structure visible at L1689 `requires_documents`, L1717 `requires_sections`). INDEX.md L26–44 narrates the same two gates.

| Gate | Triggered by | Required docs | Verified present + dated |
|---|---|---|---|
| **API_GATE (lightweight)** | Any change under `src/app/api/**` | `docs/AGENTS.md` (2026-01-28); `docs/INDEX.md` (2026-01-28) | yes |
| **POLLING_GATE (strict)** | Poll-adjacent changes (poll APIs, poll UI, admin poll results, matrix-graph polling endpoint) | `docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md`; `docs/poll-system/SAFE_POLL_UPDATE_PROTOCOL.md`; `docs/poll-system/POLL_SYSTEM_DEBUGGING_GUIDE.md`; `docs/poll-system/CEW_DATA_FLOW.md` | yes (dates 2025-11-08 → 2026-01-25) |

**Gate scope coverage gaps:**
- `src/app/api/regulatory-review/**` triggers API_GATE → `AGENTS.md` only. There is no regulatory-review-specific gate. Given that 20 RR routes exist (§1.3 G6 — 19 undocumented + 1 valid `regulatory-review/search`), AGENTS.md alone is insufficient context for an RR-route reviewer. Source: route inventory + INDEX.md L26–32.
- `public/bn-rrm/**` and `src/components/bn-rrm/**` are **not gated at all**. BN-RRM frontend changes (recent Jermilova/conceptualTiers/FRDR commits) require no doc review. Source: manifest `bundles` inspection + INDEX.md gate enumeration.
- Middleware (`src/middleware.ts`) is not in any gate. Recent middleware change (commit `66b787a`) had no doc-review trigger. Source: INDEX.md gate enumeration.
- Env-var changes (`.env.example`, `process.env.*` additions) are not gated.

**Note on `docs:gate` semantics:** the gate's path normalization uses `case_sensitive_match: true` (Source: `docs-manifest.json` L36). Combined with the canonical-path issue in §1.6, this is potentially relevant for any future gate added that mentions repo paths.

---

## 1.3 Gap register — findings

Each item below was a [claim] or [verified] entry in the v7 plan; this section records the verification outcome.

### G1. BN-RRM has no `docs/bn-rrm/` directory. **VERIFIED.**
Source: `Glob 'docs/bn-rrm/**'` returns nothing; doc inventory §1.1.
- `src/components/bn-rrm/**` contains **41** component `.tsx` files. **Source (this session):** `Glob 'src/components/bn-rrm/**/*.tsx'` → 41 paths returned (full list: `canvas/BeliefBar.tsx`, `canvas/Canvas.tsx`, `canvas/nodes/{BaseNode,ContainerNode}.tsx`, `casestudies/{CaseStudiesView,ExternalSites,HowItWorksView,MethodComparison,PublishedComparison,TrainingSites}.tsx`, `cpt/CPTExplorer.tsx`, `data/{BenchmarkDataViewer,DataUploader,ExportPanel,ReferenceDataBrowser,ReferenceDataImporter,SiteDataTable,TrainingDataTable}.tsx`, `data/__tests__/{BenchmarkDataViewer,ReferenceDataBrowser}.test.tsx`, `getting-started/GettingStartedView.tsx`, `map/{SiteDetails,SiteMap}.tsx`, `panels/{NodeInspector,ResultsPanel}.tsx`, `review/{CptTransparency,DataProvenance,DecisionsAndLimitations,EvidenceView,GuideView,ModelOverview,ReviewView,RiskComparison,SiteReports,ValidationDashboard}.tsx`, `review/__tests__/semantic-banners.test.tsx`, `shared/{ExpandableSection,InfoTooltip,ModeIndicator,PackBanner,PackSelector}.tsx`).
- `src/data/bn-rrm/transparency/*` holds 11 transparency JSON files. Source: `src/data/bn-rrm/transparency/` directory listing. **`[delegated-evidence]`** (BN-RRM Explore agent file enumeration; not re-verified by direct read this session).
- `src/lib/bn-rrm/pack-types.ts` defines the type contract: `ScopeType`, `RuntimeSchemaVersion`, `ReleaseStage`, `PackManifest`, `PackRegistry`, plus `isReadOnlyPack()` and `validatePackSchema()` helpers; canonical schema constant `CANONICAL_SCHEMA_VERSION = 'canonical-20node-v1'`. Source: `src/lib/bn-rrm/pack-types.ts`. **`[delegated-evidence]`**.
- `public/bn-rrm/pack-registry.json` is the registry; declares `schema_version: "1.0"` plus `default_pack_id` and `packs[]`. Six packs present: `bnrrm-general-v1.0-dev-map`, `bnrrm-site-v0.1-alcan-map`, `bnrrm-site-v0.1-cpnelson-scaffold`, `bnrrm-site-v0.1-toquaht-case-study`, `bnrrm-site-v0.2-cpnelson-prototype`, `bnrrm-casestudy-jermilova2025-mackenzie-hg`. Source: `public/bn-rrm/pack-registry.json`. **`[delegated-evidence]`**.
- Dual `runtime_schema_version` contract: `canonical-20node-v1` (sediment, 20 nodes / 24 edges, schema-enforced exactly) and `generic-bn-rrm-v1` (flexible — used by Jermilova mercury pack, 14 nodes). Source: `src/lib/bn-rrm/pack-types.ts` + Jermilova pack `pack.json`. **`[delegated-evidence]`**.
- Jermilova pack carries 12 GeoJSON map artifacts (`gsl_basins`, `gbs_basins`, `advisory_lakes`, `commercial_fisheries`, `historic_mines`, `large_mines`, `mineral_claims`, `oil_gas_claims`, `hydro_facilities`, `communities`, `climate_stations`, `thaw_slumps`) plus `MAP_LAYERS_MANIFEST.json`. Source: `public/bn-rrm/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/map/` directory listing. **`[delegated-evidence]`**.
- Pack loader entry point: `src/stores/bn-rrm/packStore.ts` (`loadRegistry()`, `selectPack()`, `loadReviewArtifact<T>()`); `src/hooks/bn-rrm/usePackArtifact.ts` and `usePackMapArtifact.ts` for React consumption; `src/app/(dashboard)/bn-rrm/BNRRMClient.tsx` is the entry component. Source: those file paths. **`[delegated-evidence]`**.
- Read-only-pack rule: `isReadOnlyPack(manifest)` returns true when `manifest.scope_type === 'benchmark'`. Source: `src/lib/bn-rrm/pack-types.ts:334`. **`[delegated-evidence]`**. Enforcement is UI-layer only — no TypeScript `readonly` modifier on pack types, no immutable-data wrapper.

### G2. Middleware-auth iteration has no dedicated narrative doc. **VERIFIED.**
Source: `docs/operations/` listing (only `MONITORING_GUIDE.md` and `VERCEL_SETUP.md` present); `Grep 'middleware|Auth session' docs/AGENTS.md` (no narrative section dedicated to the silencing rationale).
- `src/middleware.ts` (lines 1–137) implements security headers, Supabase session validation, "Auth session missing!" silencing (lines 79–90 — explicit comment matching commit `66b787a` `chore(middleware): silence expected "Auth session missing" log noise`), refresh-token error handling with sign-out, login redirect with `redirect=` query param. Matcher: `/dashboard/**`, `/twg/**`, `/survey-results/**`, `/cew-2025/**`, `/regulatory-review/**`, `/bn-rrm/**` (Source: `src/middleware.ts:128-137`).
- Behaviour worth documenting: header set (CSP, X-Content-Type-Options, X-Frame-Options DENY, X-XSS-Protection, Referrer-Policy, Permissions-Policy, conditional HSTS in production), the explicit silencing rationale, and the `redirect=` query-param preservation pattern.

### G3. `.env.example` env-var coverage. **VERIFIED — drift is severe.**

**Sources (this session):**
- `Read .env.example` (21 lines).
- `Grep 'process\.env\.([A-Z_][A-Z0-9_]*)' src/` → multi-page output; specific env-var hits captured at the file:line citations below.
- `Grep 'process\.env\.([A-Z_][A-Z0-9_]*)' scripts/` → no matches.
- Targeted re-grep: `Grep 'HITL_PACKET_DIR|EVAL_STALE_TIMEOUT_MS|EXTRACT_STALE_TIMEOUT_MS|OLLAMA_BASE_URL|OLLAMA_URL|REDIS_URL|REDIS_TOKEN|NEXT_PUBLIC_APP_VERSION|SENTRY_DSN|NEXT_PUBLIC_SENTRY_DSN|SENTRY_ORG|SENTRY_PROJECT|REG_REVIEW_' src/` — confirmed every entry below with explicit file:line.

`.env.example` declares (active, uncommented):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (L2–3)
- `LOCAL_ENGINE_ENABLED`, `NEXT_PUBLIC_LOCAL_ENGINE` (L7, L9)

`.env.example` mentions but leaves commented out:
- `REG_REVIEW_ENGINE_BASE_PATH`, `REG_REVIEW_EXTRACTIONS_PATH`, `REG_REVIEW_OUTPUT_PATH`, `REG_REVIEW_TEMP_UPLOAD_PATH`, `REG_REVIEW_PYTHON_PATH` (L13–19)

**Env vars actually consumed in code but missing entirely from `.env.example`** (each line confirmed by direct grep this session):
- `HITL_PACKET_DIR` — `src/lib/hitl-packets/discovery.ts:27`, `src/app/(dashboard)/hitl-packets/page.tsx:128`.
- `EVAL_STALE_TIMEOUT_MS` — `src/app/api/regulatory-review/projects/[id]/evaluate-status/route.ts:99` (default `DEFAULT_EVAL_STALE_TIMEOUT_MS = 30 * 60 * 1000` at L32).
- `EXTRACT_STALE_TIMEOUT_MS` — `src/app/api/regulatory-review/projects/[id]/extract-status/route.ts:76` (default `DEFAULT_EXTRACT_STALE_TIMEOUT_MS = 30 * 60 * 1000` at L32).
- `OLLAMA_BASE_URL` — `src/lib/ollama/model-registry.ts:57` (default `http://localhost:11434`); also `src/lib/ollama/__tests__/model-registry.test.ts` for test override.
- `OLLAMA_URL` — `src/lib/regulatory-review/launch-evaluation.ts:144` (conditional pass-through to spawned process env).
- `REDIS_URL`, `REDIS_TOKEN` — `src/lib/rate-limit-redis.ts:45,55,56` (no in-memory fallback when both unset; tests at `src/lib/rate-limit-redis.test.ts:41-42`); `REDIS_TOKEN` is **sensitive**.
- `NEXT_PUBLIC_APP_VERSION` — `src/lib/logging.ts:54` (default `'1.0.0'`).
- `NEXT_PUBLIC_SENTRY_DSN` — `src/instrumentation-client.ts:22` (direct grep confirmed; the additional `SENTRY_DSN`/`SENTRY_ORG`/`SENTRY_PROJECT` vars referenced in earlier exploratory output were not re-confirmed by this session's targeted grep — listed as `[unverified]` and deferred per source-of-truth rule).
- `REG_REVIEW_PYTHON_PATH` — `src/lib/regulatory-review/launch-evaluation.ts:160` and `src/app/api/regulatory-review/projects/[id]/extract/route.ts:103` (already commented in `.env.example` L19; counted as "documented in spirit").

System inheritance vars passed through by `src/lib/regulatory-review/launch-evaluation.ts` (variable-allowlist in spawn env): `PATH`, `SYSTEMROOT`, `TEMP`, `TMP`, `COMSPEC` — these do not need `.env.example` entries (delegated-agent line citation L130–135; not re-confirmed by direct read this session).

**Counts (confirmed this session for the named vars only):**
- Vars actively declared in `.env.example`: **4** (Supabase URL/anon, LOCAL_ENGINE_ENABLED, NEXT_PUBLIC_LOCAL_ENGINE).
- Vars commented in `.env.example`: **5** (`REG_REVIEW_*`).
- Vars consumed in code but NOT in `.env.example`: **at least 9 directly verified** (`HITL_PACKET_DIR`, `EVAL_STALE_TIMEOUT_MS`, `EXTRACT_STALE_TIMEOUT_MS`, `OLLAMA_BASE_URL`, `OLLAMA_URL`, `REDIS_URL`, `REDIS_TOKEN`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_SENTRY_DSN`).
- Stale entries (in `.env.example` but unused in code): **none** found in the targeted grep.
- The earlier "24 unique" agent-derived total is treated as evidence-only and is **not** asserted as current truth here; the 9 directly-verified entries above are the in-scope finding for Phase 2.3 ENVIRONMENT_REFERENCE.md.

### G4. `docs/regulatory-review/` orphan files. **VERIFIED.**
Source: `Grep '"id":' docs/_meta/docs-manifest.json | grep regulatory` → six entries: `regulatory.ux_proposal`, `regulatory.ux_mockups`, `regulatory.ux_review`, `regulatory.ux_corrections_log`, `regulatory.ux_proposal_pre_corrections`, `regulatory.ux_mockups_pre_corrections`. None of the four orphans (`PHASE1_PYRAMID_NAVIGATION_IMPLEMENTATION.md`, `LOCAL_ENGINE_ROUTING_PLAN.md`, `CHAT_AND_SEARCH_ENHANCEMENT_PLAN.md`, `CODEX_REVIEW_PROMPT.md`) is registered.

Classification (per file content read in this session):
| File | Date | Status | Note |
|---|---|---|---|
| `PHASE1_PYRAMID_NAVIGATION_IMPLEMENTATION.md` | 2026-01-28 | Active | Implementation guide; cites specific file/line targets in `ReviewDashboardClient.tsx`. May or may not be implemented; defer to code-side check. |
| `LOCAL_ENGINE_ROUTING_PLAN.md` | 2026-02-21 | Substantially implemented | Defines env vars present in `.env.example`; `feature-flags.ts` referenced. Plan still useful as architecture rationale. |
| `CHAT_AND_SEARCH_ENHANCEMENT_PLAN.md` | 2026-02-21 | Partially implemented | `assistant/chat` and `assistant/models` routes exist with stated `requireAdmin + requireLocalEngine` gating (Source: route inventory). |
| `CODEX_REVIEW_PROMPT.md` | 2026-02-21 | Ancillary | Codex prompt template, not a feature spec. Low value; could be archived. |

### G5. Assistant-route doc-vs-code drift. **VERIFIED.**
Source: `CHAT_AND_SEARCH_ENHANCEMENT_PLAN.md` describes `/assistant/*` routes as a forward plan; `src/app/api/regulatory-review/assistant/chat/route.ts` and `.../assistant/models/route.ts` exist with the gating the plan specifies. The plan reads as forward-looking but the routes are real. Either the plan needs a "STATUS: implemented" header or it should move to historical lifecycle.

### G6. `docs/API_REFERENCE.md` drift. **VERIFIED — severe.**

**Sources (this session, direct):**
- `Glob 'src/app/api/**/route.ts'` → **42** route.ts files. Full route paths:
  `announcements`, `auth/callback`, `discussions`, `discussions/[id]`, `discussions/[id]/replies`, `documents/[id]`, `graphs/prioritization-matrix`, `hitl-packets`, `hitl-packets/[sessionId]`, `hitl-packets/[sessionId]/csv`, `hitl-packets/[sessionId]/md`, `milestones`, `polls/results`, `polls/submit`, `ranking-polls/results`, `ranking-polls/submit`, `regulatory-review/assessments`, `regulatory-review/assessments/[csapId]`, `regulatory-review/assistant/chat`, `regulatory-review/assistant/models`, `regulatory-review/judgments`, `regulatory-review/matching-detail`, `regulatory-review/progress`, `regulatory-review/projects`, `regulatory-review/projects/[id]`, `regulatory-review/projects/[id]/evaluate`, `regulatory-review/projects/[id]/evaluate-status`, `regulatory-review/projects/[id]/extract`, `regulatory-review/projects/[id]/extract-status`, `regulatory-review/projects/[id]/files`, `regulatory-review/projects/[id]/files/[fileId]`, `regulatory-review/run-engine`, `regulatory-review/search`, `regulatory-review/submission-search`, `regulatory-review/submissions`, `regulatory-review/validation-stats`, `review/save`, `review/submit`, `review/upload`, `tags`, `wordcloud-polls/results`, `wordcloud-polls/submit`.
- `Grep '^####\s+(GET|POST|PUT|PATCH|DELETE)' docs/API_REFERENCE.md` → **13** H4 endpoint entries:
  L225 `POST /api/auth/login`, L270 `POST /api/auth/logout`, L301 `GET /api/auth/user`, L332 `GET /api/polls`, L377 `GET /api/polls/:id`, L413 `POST /api/polls/:id/vote`, L473 `GET /api/polls/:id/results`, L524 `POST /api/admin/export`, L564 `GET /api/admin/analytics`, L618 `GET /api/prioritization-matrix`, L661 `GET /api/wordcloud/results`, L708 `POST /api/regulatory-review/submission`, L757 `GET /api/regulatory-review/search`.

**Quantified drift (derived from the two lists above):**
- **42 routes in code; 13 documented at H4; 1 currently valid (`GET /api/regulatory-review/search` at L757); 12 stale-or-misnamed (the other 12 H4 entries); 41 undocumented routes.**
- **Stale auth endpoints** (none of these exist as `route.ts` files; only `/api/auth/callback` is in code): `POST /api/auth/login` (L225), `POST /api/auth/logout` (L270), `GET /api/auth/user` (L301).
- **Stale admin endpoints** (no `src/app/api/admin/**` routes exist): `POST /api/admin/export` (L524), `GET /api/admin/analytics` (L564).
- **Polling endpoints with wrong paths or non-existent**:
  - `GET /api/polls` (L332) — no listing route exists.
  - `GET /api/polls/:id` (L377), `POST /api/polls/:id/vote` (L413), `GET /api/polls/:id/results` (L473) — actual routes are `POST /api/polls/submit` and `GET /api/polls/results`.
  - `GET /api/prioritization-matrix` (L618) — actual path is `/api/graphs/prioritization-matrix`.
  - `GET /api/wordcloud/results` (L661) — actual path is `/api/wordcloud-polls/results`.
  - `ranking-polls/*` and `wordcloud-polls/*` (4 routes total) entirely absent from docs.
- **Stale RR endpoint**: `POST /api/regulatory-review/submission` (L708) — no `route.ts` at that path.
- **All 20 `/api/regulatory-review/**` routes** in code are undocumented except for `search` (count derived by direct enumeration of the regulatory-review entries in the L174 route list above: assessments, assessments/[csapId], assistant/chat, assistant/models, judgments, matching-detail, progress, projects, projects/[id], projects/[id]/evaluate, projects/[id]/evaluate-status, projects/[id]/extract, projects/[id]/extract-status, projects/[id]/files, projects/[id]/files/[fileId], run-engine, search, submission-search, submissions, validation-stats = 20).
- **All 4 `/api/hitl-packets/**` routes are undocumented**: `GET /` (list), `GET /[sessionId]`, `GET /[sessionId]/csv`, `GET /[sessionId]/md`.
- **All 3 `/api/review/*` routes are undocumented**: `save`, `submit`, `upload`.
- **Deprecated endpoint correctly returns 501**: `/api/regulatory-review/run-engine` returns 501 with `{success:false, error:'deprecated...'}`. **Source for the 501 behavior:** delegated-agent route inventory; not re-confirmed by direct read of `run-engine/route.ts` this session — listed as `[delegated-evidence]`. Docs do not flag this deprecation.

INDEX.md L82 still claims "Complete API documentation with examples for all 28 endpoints" — that count is itself stale (actual H4 documented count is 13; actual route count is 42).

### G7. SQLite local-engine fallback in LESSONS.md but not OPERATIONS_RUNBOOK.md. **VERIFIED.**
Source: `Grep -i 'SQLite|local-engine|fallback' docs/OPERATIONS_RUNBOOK.md` → no matches. `Grep -i 'SQLite|local-engine|fallback' docs/LESSONS.md` → 30+ matches including the substantive section L818+ on `better-sqlite3` webpack/serverless workaround (`src/lib/sqlite/client.ts:25-36`, lazy-loading pattern, externals config in `next.config.js`). The runbook silently lacks this entire subsystem.

### G8. Dashboard-side hardcoded RR paths in code. **PARTIALLY VERIFIED this session — flagged only (code change is out of scope).**
**Direct verification this session:** `src/lib/regulatory-review/launch-evaluation.ts` defines `REG_REVIEW_ENGINE_BASE_PATH` with fallback `'C:/Projects/Regulatory-Review/engine'` (verified via env-var Grep, see G3). The fallback string `'C:/Projects/Regulatory-Review'` also appears in route handlers per `Grep 'C:/Projects/Regulatory-Review' src/app/api/regulatory-review/`. **`[delegated-evidence]`** for the per-route attribution (POST creates folder in `projects/route.ts`; `extract/route.ts` invokes `dashboard_extract.py`; `[id]/route.ts` DELETE removes folder) — these were originally surfaced by the route inventory agent and have not been re-verified file-by-file in this audit. Phase 3 must re-grep before any factual statement is published. **Defer** the code-side env-var migration to NEXT_STEPS / audit deferred list.

### G9. Stale `F:\` paths across the dashboard repo. **VERIFIED — broader than v7 sample.**
Source: `Grep 'F:[\\/]' C:\Projects\SSTAC-Dashboard` → 18 files containing matches. Categorized:

**AUTHORITATIVE / current-doc files (Phase 3 must fix):**
- `docs/_meta/docs-manifest.json:5` — `"workspace_root": "F:/SSTAC-Dashboard"`. **The manifest itself.**
- `MULTI_PROJECT_COORDINATION.md` — multiple sites (per volatile-claims agent: L30, L59 ×2, L101, L315–334).
- `.claude/skills/update-docs/SKILL.md` — paths in command examples (L84+, L164, L197–201, L221, L254, L299, L302, L310, L426+ per cross-repo agent).
- `.claude/skills/safe-exit/SKILL.md` — paths reference `F:\Regulatory-Review\.claude\scripts\safe-exit-check.ps1`, `F:\Regulatory-Review\engine\data\rraa_v3_2.db`, `F:\Regulatory-Review\ralph_semantic` (L29, L34, L39, L47, L94, L110, L229).

**REFERENCE/operational scripts (separate code-scope decision):**
- `scripts/regulatory-review/validate_policy_urls.py`, `export_taxonomy_mapping.py`, `load_policy_data.py`, `export_policy_sources.py`, `README.md`. **Defer** — touching these is code scope.

**HISTORICAL / archive / session checkpoints (likely OK to leave as evidence):**
- `docs/archive/2026-01-27_multi-project-coordination/MULTI_PROJECT_COORDINATION_v1.0..v1.3_ARCHIVED.md`
- `.claude/SESSION_CHECKPOINT_PHASE_7_FINAL.md`, `.claude/SESSION_SUMMARY.md`
- `docs/regulatory-review/REGULATORY_REVIEW_UX_PROPOSAL_REVIEW.md`, `REGULATORY_REVIEW_UX_PROPOSAL_CORRECTIONS_APPLIED.md`
- `docs/LESSONS.md` (L791 — old test path reference inside a lesson narrative)

### G10. `docs/PROJECT_STATUS.md` volatile claims. **VERIFIED.**

**Sources (this session, direct):**
- `Grep 'production-ready|production ready|ALL PHASES COMPLETE|Final Grade|Remaining Work|Current Grade|✅ COMPLETED|fully functional' docs/PROJECT_STATUS.md` → 60+ matches (head_limit hit at 60), confirming pervasive volatile content.
- `Grep 'A- \(85-89%\)|A\+ \(95\+/100\)|A\+\+\+\+|A\+\+ |A\+\+\+ |grade_achieved' docs/PROJECT_STATUS.md` → grade-assertion sites at L52, L54, L99, L757, L845, L851.

Specific volatile sites confirmed by direct line reads:
- **L9**: "fully functional, production-ready platform with comprehensive features" (top-of-doc framing).
- **L52**: "Achieved A- (85-89%) through TypeScript type safety improvements" (dated 2025).
- **L99**: "Grade Improvement: C (66%) → A- (85-89%) … Phase 3 and TypeScript improvements (Nov 17, 2025)".
- **L757**: "Next Steps: Path to A- (85-89%)" (header).
- **L845**: "professional, production-ready platform … achieved A- (85-89%) grade (November 17, 2025)".
- **L851**: "PRODUCTION READY … Current grade: A- (85-89%)".
- **`✅ COMPLETED` markers**: 50+ instances visible in first 60 grep matches (L37, L51, L59, L69, L77, L85, L95, L107, L115, L124, L136, L144, L154, L165, L173, L182, L189, L198, L217, L227, L239, L252, L265, L273, L282, L288, L296, L303, L312, L321, L328, L335, L341, L361, L367, L373, L379, L385, L402, L424, L457, L524, L529, L530, L531, L538, L539, L540, L571, L595, L609, L643, L726, L732, L740 — more present beyond the 60-line cap).
- **Test count claims**: agent earlier reported counts at L730–745 ("305+ new tests / 481 total / 80%+ coverage"); not re-confirmed by direct read this session — listed as `[delegated-evidence]`. The volatile-content concern is independent of exact numbers.

PROJECT_STATUS.md header at L11 reportedly redirects to manifest for current counts (delegated-evidence; not re-confirmed by direct read this session) — but body L9, L845, L851 directly contradict that redirect.

### G11. `docs/NEXT_STEPS.md` violates manifest current-status policy AND is internally contradictory. **VERIFIED.**

**Sources (this session, direct):**
- `Grep 'production-ready|production ready|ALL PHASES COMPLETE|Final Grade|Remaining Work|Current Grade|fully functional|PROJECT READY FOR PRODUCTION|^## Phase' docs/NEXT_STEPS.md` returned exactly four header-area matches:
  - **L4**: `**Project Status:** ✅ **ALL PHASES COMPLETE** (Phases 0-7)`
  - **L5**: `**Final Grade:** 97.5/100 (A++++) - Exceeds A+ Target (95+/100) ✅`
  - **L6**: `**Remaining Work:** None - PROJECT READY FOR PRODUCTION`
  - **L143**: `**Current Grade:** B+ (87/100)`
- `Read docs/NEXT_STEPS.md offset=140 limit=60` → confirmed L143 grade contradiction; L143–149 enumerate per-phase grade impacts (`Phase 1 Impact: +3 points`, `Phase 2 Impact: +2 points ← JUST COMPLETED`, `Phase 3 Impact: +3 points`, etc.); L151 sets `**Target after Phase 3:** A- (90%+)`; L176 reads `**None** - Phase 2 is complete. Awaiting Vercel deployment confirmation.`

Same file, same date (2026-01-28). Header (L4–6) asserts ALL PHASES COMPLETE / Final Grade A++++ / PROJECT READY FOR PRODUCTION. Body (L143–176) contemporaneously asserts grade B+ (87/100), Phase 2 just completed, Phase 3 pending. **Contradictory completion states and grades within the same document.**

The earlier delegated-agent claim that "L143–196 lists Phase 4 tasks as Not started with hour estimates" was not directly re-confirmed by this session's targeted read (which stopped at L200 — the L199 `## Grade Progress Summary` table header is visible but not the per-phase rows). The Phase 4 "Not started" detail is therefore listed as `[delegated-evidence]`. The header-vs-body grade contradiction (L4-6 vs L143) is **directly verified**.

### G12. `.claude/README.md` does not exist. **VERIFIED.** Source: file inventory.

### G13. `MULTI_PROJECT_COORDINATION.md` currency and stale paths. **VERIFIED.**

**Sources (this session, direct):**
- `Grep 'production-ready|production ready|Final Grade|Current Grade|F:[\\/]|v1\.|January|November|Tier 2 Rerun|fully functional' MULTI_PROJECT_COORDINATION.md` (head_limit 40) → matches at L4, L5, L17, L30, L42, L49, L58, L59, L114, L120, L155, L159, L178, L265, L266, L272, L275, L307, L320, L327, L343, L346, L384, L385.

Specific volatile / stale sites confirmed by direct line reads:
- **L4**: `**Created:** January 25, 2026`
- **L5 / L385**: `**Last Updated:** January 27, 2026 (v1.3 - UI/UX corrections complete, ready for approval)` — but current HEAD is `66b787a` (2026-04-19 baseline date for this audit) with intervening BN-RRM Jermilova/conceptualTiers/FRDR commits not reflected here.
- **L17**: `| **Regulatory-Review** | ⏳ Tier 2 Rerun 78% COMPLETE | 467/598 batches | Complete remaining 131 batches (Sessions A/B/C) |` — temporal counter.
- **L114**: `### Status: ⏳ Tier 2 Rerun 78% COMPLETE (In Progress)`
- **L120**: `### Tier 2 Rerun Status (Updated January 27, 2026 11:10 AM)`
- **L30, L58, L59, L155, L265, L266, L272, L275, L307, L320**: stale `F:\sstac-dashboard\…` and `F:\Regulatory-Review\…` paths (e.g., L30 `F:\sstac-dashboard\.claude\SESSION_CHECKPOINT_2026-01-25-PHASE2-COMPLETE.md`; L155 `F:\Regulatory-Review\engine\data\rraa_v3_2.db`).

**Earlier delegated-agent grade claim** of `A+ (95+/100)` at L29 was not surfaced by this session's targeted grep window (head_limit 40 stopped at L40; L29 fell inside the window but did not match the grep pattern — likely the grade format differs from the regex). Listed as `[delegated-evidence]` pending direct re-read in Phase 3.9. The currency / stale-path findings above are **directly verified**.

### G14. AGENTS.md current-status drift. **VERIFIED — narrower than initially feared.**

**Sources (this session, direct):**
- `Grep 'production-ready|production ready|fully functional|Production Ready|Phase \d|Current Development Phase' docs/AGENTS.md` (head_limit 40) → matches at L8 (archive pointer), L630 (`## 🎯 Current Development Phase`), L633 (Phase 1), L634 (Phase 2 — "mostly complete - 4/5 items"), L636 (Phase 3 — "November 2025"), L640 (`Production Ready: All security, validation, and logging infrastructure complete`), L791 (Phase 3 Achievements heading), L809 (`Remember: This system is production-ready and fully functional. Most "problems" are actually working features.`).

Volatile / current-status claims confirmed by direct line citation:
- **L630**: `## 🎯 Current Development Phase` heading
- **L634**: `**Phase 2**: Admin management system (mostly complete - 4/5 items)` — claim of mostly-complete with implicit current-state.
- **L636**: `**Phase 3**: Validation & Security (November 2025)` — dated phase enumeration.
- **L640**: `**Production Ready**: All security, validation, and logging infrastructure complete` — production-ready assertion.
- **L809**: `**Remember**: This system is **production-ready** and **fully functional**.` — categorical production-ready / fully-functional assertion.

**4–5 narrative volatile sites** (L630, L634, L636, L640, L809) — narrower than the broader "Production Ready / Current Development Phase / success metrics" concern in the v7 plan. The earlier delegated-agent reference to L6 / L638–641 was off by ~few lines vs this session's direct grep at L630/L634/L636/L640 — direct line citations above are authoritative.

Behavioral safety rules (RLS / RPC bridge / gate behavior / API-contract clauses elsewhere in the file) are *not* volatile and must be preserved untouched in Phase 3.3.

### G15. Cross-grade contradictions across governance docs. **VERIFIED — material problem.**

**Sources (this session, direct, except where noted):**
- `PROJECT_STATUS.md:845` → `professional, production-ready platform … achieved A- (85-89%) grade (November 17, 2025)`. **Direct read confirmed.**
- `PROJECT_STATUS.md:851` → `Current grade: A- (85-89%) - Achieved November 17, 2025. Target grade: A (90%+)`. **Direct read confirmed.**
- `NEXT_STEPS.md:5` → `**Final Grade:** 97.5/100 (A++++) - Exceeds A+ Target (95+/100) ✅`. **Direct read confirmed.**
- `NEXT_STEPS.md:143` → `**Current Grade:** B+ (87/100)`. **Direct read confirmed.**
- `MULTI_PROJECT_COORDINATION.md:29` → `A+ (95+/100)`. **`[delegated-evidence]` — not surfaced by this session's targeted grep window; defer direct re-read to Phase 3.9.**
- Manifest `facts` per §1.5 reportedly asserts `A+`, `A++`, `A+++` across phase entries. **`[delegated-evidence]` — phase4/5/6/7 retro-block grade strings not exhaustively re-read this session; phase7_final_validation directly inspected (§1.5) does not contain a `grade_achieved` field but does assert "project ready for production".**

There is no single source of truth for "current grade" in the narrative. Three directly-verified narrative grades simultaneously assert A- (85-89%), A++++ (97.5), and B+ (87) within two files modified on the same date. Per `current_status_claims_policy` and `facts_policy` ban list (delegated-evidence — manifest policy text not re-quoted this session), narrative docs should not be the source. Phase 3 must redirect all narrative grade claims to a single manifest fact, or remove the concept of "current grade" from narrative entirely.

---

## 1.4 Cross-repo integration review

### Files referenced in this session (corrected paths)

**Authority note:** the cross-repo files below were read by a delegated Explore agent, not by direct Claude file reads in this session. Their existence and contents below are therefore **`[delegated-evidence]`** — evidence the audit relies on, but not personally re-verified file-by-file. Where dashboard-side cross-checks were performed directly this session, they are called out explicitly.

- `C:\Projects\Regulatory-Review\CLAUDE.md` — exists. **`[delegated-evidence]`** (cross-repo Explore agent).
- `C:\Projects\Regulatory-Review\engine\docs\_INDEX.md` — exists. **`[delegated-evidence]`**.
- `C:\Projects\Regulatory-Review\engine\docs\active\development\ACTIVE_DOCS.md` — exists. **`[delegated-evidence]`**.
- `C:\Projects\Regulatory-Review\PROJECT_TOPOLOGY_PLAN.md` — reportedly found at repo root via `Glob`. **`[delegated-evidence]`**.
- BN-RRM contract files — reportedly found via `Glob 'bnrrm*'`. **`[delegated-evidence]`**:
  - `C:\Projects\Regulatory-Review\2026_Database_Development\data_acquisition\bnrrm_extraction\BNRRM_HANDOFF.md` (v66.0+)
  - `…\BNRRM_ACTIVE_FILES.md` (v2.1)
  - `…\BNRRM_DEV_PLAN.md` (v3.3)
  - `…\BNRRM_REVIEW_PROCESS_MEMO.md` (v1.0)

Per the source-of-truth rule, claims that depend on these RR files are **not promoted to current truth** in dashboard docs without direct re-read or independent confirmation. They inform open questions (below) and shape the Phase 2.1 BN-RRM contract section (which must be re-grounded in dashboard-side files at Phase 2 time).

### RR contract claims relevant to dashboard
- **Direct DB read.** RR `CLAUDE.md` (L87–93) and `engine/MASTER_PRD_v4.md` (§14.1, L719–727) state: "The SSTAC Dashboard reads the policy database **directly** from `engine/data/rraa_v3_2.db`. There is NO copy in the dashboard folder. Do NOT create one or suggest Copy-Item sync commands. The duplicate was removed in January 2026. The dashboard has its own `regulatory-review.db` for assessment results only — that is separate and uses sync scripts." **`[delegated-evidence]`** per §1.4 intro.
- **Evaluation pipeline claim.** RR `MASTER_PRD_v4.md` (§14.1): "The dashboard triggers evaluation via `POST /api/regulatory-review/projects/[id]/evaluate` → `evaluate/route.ts` → spawns `run_shadow_evaluation.py` → runs `run_shadow_pipeline()` with Role 2 pre-ranking and applicability filtering. Results are written as `EvalResult_{id}_{timestamp}.json` and imported into `regulatory-review.db` via `importResultsToDatabase()`." **`[delegated-evidence]`** for the RR-side claim. **Dashboard-side cross-check (this session, direct):** `evaluate/route.ts` exists; calls `launch-evaluation.ts`; `evaluate-status/route.ts` reads result JSON and calls `importResultsToDatabase`. Spawn target name not directly verified in this audit — defer to a follow-up cross-check.
- **Frontend extraction with manual fallback.** RR `MASTER_PRD_v4.md` (§13.3b, L688–694): "Submission PDFs are extracted to JSON via `dashboard_extract.py`. Manual extraction fallback is available… **Status (March 2026):** Frontend-native extraction has been fixed (proactive chunking, stale timeout handling) but has not been fully revalidated end-to-end on a large submission. Manual extraction remains the validated source for the current Site 28553 evaluation run." **`[delegated-evidence]`** per §1.4 intro. **Dashboard-side cross-check (this session, direct):** `extract/route.ts` spawns `pythonw.exe` with `dashboard_extract.py`; `extract-status/route.ts` honours `EXTRACT_STALE_TIMEOUT_MS` (matches "stale timeout handling" claim).
- **BN-RRM artifact handoff.** `BNRRM_HANDOFF.md` references dashboard files at `C:/Projects/SSTAC-Dashboard/src/components/bn-rrm/`, `src/data/bn-rrm/learned-model.json`, `src/stores/bn-rrm/packStore.ts`, `src/hooks/bn-rrm/usePackArtifact.ts`, with pack output destination `public/bn-rrm/packs/`, schema at `pack_schema/pack.schema.json`, build via `build_pack.py` and `generate_registry.py`. **`[delegated-evidence]`** per §1.4 intro. **Dashboard-side cross-check (this session, direct):** `learned-model.json` exists at `src/data/bn-rrm/learned-model.json` (verified via G1 `Glob 'src/data/bn-rrm/**'`), so the handoff path is current. Other dashboard-side targets (`packStore.ts`, `usePackArtifact.ts`, `public/bn-rrm/packs/`) require Phase 2.1 re-verification before publication.

### Internal contradictions inside RR docs
- **Keyword-harvest cap.** `MASTER_PRD_v4.md` §4.5 (L268–270): `MAX_KEYWORD_ENTRIES = 9999` (effectively uncapped — Decision 13 slot reservation superseded 2026-03-14). `engine/docs/active/development/ENGINE_SPECS.md` §3.4 (L203–209): `MAX_KEYWORD_ENTRIES = 35` … `FROZEN at Decision 13, slots reserved`. PRD says superseded; ENGINE_SPECS not updated. **`[delegated-evidence]`** per §1.4 intro. **Dashboard-side action: do not cite either as current truth in any new dashboard doc.**
- **DB-path skill drift.** `.claude/skills/safe-exit/SKILL.md` (in dashboard repo) hardcodes `F:\Regulatory-Review\engine\data\rraa_v3_2.db` and `F:\Regulatory-Review\ralph_semantic`. Actual dashboard sqlite client at `src/lib/sqlite/client.ts:57` uses `path.join(process.cwd(), 'src', 'data', 'regulatory-review.db')` — relative to CWD. Skill is stale (paths and conceptual model). **Dashboard-side direct verification this session:** `src/lib/sqlite/client.ts:57` re-confirmed via Read; LESSONS.md L818+ for the externals/lazy-load pattern (G7 verified). The skill-file hardcoded paths were originally surfaced by the cross-repo Explore agent and remain **`[delegated-evidence]`** for the exact line numbers; presence of `F:\Regulatory-Review` strings was independently confirmed via G9 `Grep 'F:[\\/]'`.

### Open questions (defer to a future cross-check; do NOT bake into new dashboard docs as current truth)
1. Does the dashboard *actually* read `rraa_v3_2.db` directly, or only `regulatory-review.db`? Cross-repo agent could not confirm a direct read in the dashboard files it sampled (only `regulatory-review.db` reads were visible). The RR-side claim may be aspirational.
2. Are there active sync scripts (`sync_tier2_to_dashboard.py` referenced in RR docs) that keep `regulatory-review.db` in sync? Not located in this audit.
3. Does the dashboard's `evaluate` route spawn `run_shadow_evaluation.py` specifically, or some other entrypoint? `launch-evaluation.ts` was not deep-read in this audit.
4. Who owns BN-RRM pack publishing? `BNRRM_HANDOFF.md` says packs are output to `public/bn-rrm/packs/` in the dashboard repo, but the build scripts (`build_pack.py`, `generate_registry.py`) live in RR. Manual or CI-driven? Not documented dashboard-side.
5. Stage 2.5 pre-ranking and applicability filtering enabled in the deployed adapter? Claimed by RR PRD; not verified dashboard-side this session.

---

## 1.5 Manifest fact provenance check

Source: `Grep '^    "[a-z_]+":\s*\{' docs/_meta/docs-manifest.json` (top-level keys) + `Grep 'last_verified' docs/_meta/docs-manifest.json`. Sampled body content from `Read offset=1 limit=200` and `Read offset=200 limit=200`.

Top-level facts keys present in `facts.*` (partial — full enumeration pending direct structural read):
- `phase4_performance_optimization` — last_verified 2026-01-26 (`[delegated-evidence]`).
- `phase5_documentation_knowledge` — last_verified 2026-01-26 (`[delegated-evidence]`).
- `phase6_devops_monitoring` — last_verified 2026-01-26 (`[delegated-evidence]`); contains `deployment_readiness: "PRODUCTION READY - All monitoring and alerting functional"` at L224, `next_action: "Phase 7: Final Validation…"` at L222, `blockers: "None - Phase 6 complete…"` at L223 (**directly verified this session** via `Read docs/_meta/docs-manifest.json offset=220 limit=60`).
- **`phase7_final_validation`** — **directly verified this session.** Block starts at L227 of `docs/_meta/docs-manifest.json`. Contains:
  - L228: `"status": "COMPLETE"`
  - L230: `"phase": "Phase 7: Comprehensive System Review & Validation"`
  - L231: `"phase_status": "COMPLETE - All validation tasks finished, project ready for production"`
  - L232: `"work_completed"` text stating Task 7.1 (E2E Testing) `IN PROGRESS` with linting PASSED, unit tests PASSED (536 across 23 files in 6.05s, 0 failures), E2E BLOCKED (port 3000 conflict).
  - L262–269: `e2e_tests.status: "BLOCKED"` with root cause "Process 28548 … still holding port 3000".
  - L278: `build_status: "npm run build SUCCESSFUL (13.5s, 0 errors)"`
  - L279: `npm_audit_status: "0 HIGH/CRITICAL vulnerabilities"`
  - Block does **not** contain an explicit `grade_achieved` field (directly verified read of L227–279). The block's text simultaneously asserts `COMPLETE` and `project ready for production` (L228, L231) while recording Task 7.1 E2E as `BLOCKED` — internally inconsistent within the manifest itself.
- `current_session` — last_verified 2026-01-26 (FINAL) (`[delegated-evidence]`).
- `grades` — last_verified 2026-01-25 (`[delegated-evidence]`).
- `testing` — last_verified 2026-01-25 (`[delegated-evidence]`).
- `broken_doc_links_detected` — date varies (`[delegated-evidence]`).

**Classification:**

- **Re-derivable by command in-session (eligible for Phase 3.1 refresh with provenance):** any `testing` count via `npm test` / `vitest run --reporter=json`. None of the other facts (grades, phase status, completion narratives) are command-derivable; they are author-asserted.
- **Historical/dated (eligible to date-stamp without changing value):** `phase4_*`, `phase5_*`, `phase6_*` retros — these are completion snapshots from January 2026. Should remain as historical entries; should not be promoted to "current" anywhere.
- **Stale-and-unverifiable (mark stale or remove; do NOT re-write to current):** anything in `current_session` that asserts state more than ~2 weeks old; reportedly conflicting `grade_achieved` strings inside phase facts (`"A+ threshold (95+/100)"`, `"A++"`, `"A+++"`) — **`[delegated-evidence]`** for the specific strings (only `phase6_devops_monitoring` L222–225 and `phase7_final_validation` L227–279 were directly read this session; neither contains a `grade_achieved` field, so the existence of those exact strings in `phase4_*` / `phase5_*` was not directly re-verified). Treat the conflict claim as evidence-only until Phase 3.1 directly reads those blocks.
- **Action for Phase 3.1:** the only manifest update that can be made *under the source-of-truth rule* in this pass is updating `last_audited` (top-level) and adding `documents[]` entries for new files (Phase 1b/2). Test counts can be refreshed via `npm test` if the user authorizes it; otherwise leave as-is and date-stamp. **No retro/grade transcription.**

---

## 1.6 Path canonicalization + workspace_root consumer search

### Canonical path
- `git rev-parse --show-toplevel` → `C:/Projects/SSTAC-Dashboard` (capital S-S-T-A-C, capital D). Source: Phase 0 capture.

### Path variants in the repo
- `F:/SSTAC-Dashboard` — `docs/_meta/docs-manifest.json:5` (`workspace_root` field).
- `F:\sstac-dashboard\` (lowercase, backslash) — `MULTI_PROJECT_COORDINATION.md` (multiple sites), `.claude/skills/update-docs/SKILL.md` (~10+ sites).
- `F:\Regulatory-Review\…` — `.claude/skills/safe-exit/SKILL.md` (multiple sites), `MULTI_PROJECT_COORDINATION.md` Quick Reference section.
- `C:/Projects/Regulatory-Review/…` — used in actual code (e.g., `launch-evaluation.ts` default; `projects/route.ts` base path).
- `C:/Projects/SSTAC-Dashboard/…` — used in RR's `BNRRM_HANDOFF.md` references.
- Total of 18 files contain `F:[\\/]` matches (Source: `Grep 'F:[\\/]' files_with_matches`).

### `workspace_root` consumer search
- `Grep 'workspace_root' C:\Projects\SSTAC-Dashboard` (output_mode: files_with_matches) returned **2 files**:
  1. `docs/_meta/docs-manifest.json` — the field definition itself at L5.
  2. `docs/_meta/DOCUMENTATION_AUDIT_2026-04.md` — **this audit file**, which discusses the field as a finding (self-match; not a consumer).
- **Excluding the audit file itself, the only match is the manifest definition.** No code consumer in `src/`, `scripts/`, `*.mjs`, `*.json` (other than the manifest), or any other `.md` file references the `workspace_root` key.
- **Conclusion: `workspace_root` is metadata-only.** Phase 3.1 can safely change it to the canonical path without coordinating with any consumer. (Phase 3.1 should re-run the same grep at execution time and re-confirm the audit-file-only self-match still holds.)

### Canonical-path policy proposed for Phase 3
- Use `C:/Projects/SSTAC-Dashboard` (forward slashes, current casing) as the canonical display path.
- Apply only to:
  - `docs/_meta/docs-manifest.json` `workspace_root` (Phase 3.1).
  - `MULTI_PROJECT_COORDINATION.md` (Phase 3.9).
  - `.claude/skills/update-docs/SKILL.md` (Phase 3.10).
- Do NOT apply to (these stay as historical evidence):
  - `docs/archive/**`, `.claude/SESSION_CHECKPOINT_*.md`, `.claude/SESSION_SUMMARY.md` — historical snapshots; rewriting them would falsify the snapshot.
  - `docs/regulatory-review/REGULATORY_REVIEW_UX_PROPOSAL_REVIEW.md`, `…CORRECTIONS_APPLIED.md` — historical/post-correction record.
  - `docs/LESSONS.md` L791 — narrative quote describing a past test failure; rewriting would alter the lesson context.
- Defer (separate code-scope decision): `scripts/regulatory-review/*.py`, `.claude/skills/safe-exit/SKILL.md` — touching these is operational scope, not documentation scope.

### Note on `case_sensitive_match`
The manifest gate-evaluation policy at L36 uses `case_sensitive_match: true` for path normalization. Windows is case-insensitive at the filesystem layer, but the gate matcher is not. No new gates are being introduced in this pass, so this is informational only. If a future gate ever matches on `bn-rrm` vs `BN-RRM`, the case-sensitivity rule will bite.

---

## 1.7 Prioritized fix list (P0 / P1 / P2)

Each item maps to a v7 phase. Effort estimates are rough.

### P0 — Must-fix before considering the doc set governable

| # | Item | Source/§ | Phase target | Effort |
|---|---|---|---|---|
| P0-1 | Create `docs/bn-rrm/README.md` covering the artifact contract (`public/bn-rrm/pack-registry.json`, dual `runtime_schema_version`, Jermilova map artifacts, read-only-pack rule, pack-loader entrypoint). | §1.3 G1 | 2.1 | M |
| P0-2 | Create `docs/operations/MIDDLEWARE_GUIDE.md` covering `src/middleware.ts` flow, "Auth session missing!" silencing rationale, header set, redirect-preserve pattern, matcher scope. | §1.3 G2 | 2.2 | S |
| P0-3 | Create `docs/ENVIRONMENT_REFERENCE.md`. **Verified scope (this audit):** at minimum the 9 directly-confirmed missing env vars per G3 (`HITL_PACKET_DIR`, `EVAL_STALE_TIMEOUT_MS`, `EXTRACT_STALE_TIMEOUT_MS`, `OLLAMA_BASE_URL`, `OLLAMA_URL`, `REDIS_URL`, `REDIS_TOKEN`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_SENTRY_DSN`) plus the 4 active + 5 commented vars already in `.env.example`. Phase 2.3 must re-run a full `process.env.*` sweep at edit time and document whatever it finds; the broader "24 unique" / "14 missing" agent totals are evidence-only and must not be transcribed without re-verification. Update `.env.example` comments for whatever the Phase 2.3 sweep confirms missing. | §1.3 G3 | 2.3 | M |
| P0-4 | Refresh `docs/API_REFERENCE.md` against the current 42-route inventory (per-route schema: method/auth/request/response/backing-store/side-effects). Remove **12** stale-or-misnamed H4 entries (the L225/L270/L301/L332/L377/L413/L473/L524/L564/L618/L661/L708 entries identified in G6); add **41** missing routes (42 in code minus the 1 valid `regulatory-review/search` H4 entry). Note **19** of the missing routes are RR-side per G6 (20 total RR routes exist = 19 missing + 1 already documented). | §1.3 G6 | 3.7 | L |
| P0-5 | Resolve four-way grade contradiction across PROJECT_STATUS.md / NEXT_STEPS.md (×2) / MULTI_PROJECT_COORDINATION.md by removing narrative grade claims and redirecting to manifest. | §1.3 G15 | 3.5 / 3.6 / 3.9 | M |
| P0-6 | Clean up NEXT_STEPS.md internal contradictions: header (L4–6) asserts `ALL PHASES COMPLETE` / `Final Grade 97.5/100 (A++++)` / `PROJECT READY FOR PRODUCTION`, while body L143 simultaneously asserts `Current Grade: B+ (87/100)` and L145 marks Phase 2 as just-completed (per directly verified G11). Decide a single canonical state, redirect grade claims to manifest, and remove or date-stamp the contradictory framing. | §1.3 G11 | 3.6 | M |
| P0-7 | Fix `workspace_root` in `docs/_meta/docs-manifest.json` from `F:/SSTAC-Dashboard` to `C:/Projects/SSTAC-Dashboard` (metadata-only — no consumer). | §1.6 | 3.1 | XS |

### P1 — Should-fix in this pass

| # | Item | Source/§ | Phase target | Effort |
|---|---|---|---|---|
| P1-1 | Register the four `docs/regulatory-review/` orphans in INDEX + manifest with appropriate lifecycle (Active for PHASE1_PYRAMID; Active-with-implementation-status for LOCAL_ENGINE_ROUTING and CHAT_AND_SEARCH; Ancillary for CODEX_REVIEW_PROMPT). Reconcile assistant-route doc-vs-code drift (G5). Archive only after `npm run docs:archive:investigate` passes. | §1.3 G4, G5 | 3.8 | S |
| P1-2 | Add SQLite local-engine fallback section to `docs/OPERATIONS_RUNBOOK.md` (sourced from LESSONS.md L818+ pattern, plus current `src/lib/sqlite/client.ts` lazy-load behaviour). Cross-link to MIDDLEWARE_GUIDE. | §1.3 G7 | 3.4 | S |
| P1-3 | AGENTS.md per-claim cleanup at the directly-verified lines from G14 (`L630` `## 🎯 Current Development Phase` heading, `L634` Phase 2 status, `L636` Phase 3 dated phase, `L640` `Production Ready` assertion, `L809` `production-ready and fully functional` assertion). Date-stamp or redirect each. Phase 3.3 must re-grep at edit time before editing. **Behavioral safety rules elsewhere in the file are untouched** — Phase 3.3 must re-derive the safety-rule line ranges before editing (the v7 plan's reference ranges `L12–112, 130–189, 197–290, 297–457, 529–548, 570–605` were not directly re-verified this session and are evidence-only). | §1.3 G14 | 3.3 | S |
| P1-4 | Refresh `MULTI_PROJECT_COORDINATION.md`: rewrite `F:\` paths (L30, L59 ×2, L101, L315–334) to canonical, replace "v1.3 ready for approval" framing with current state grounded in `git log`, sync RR contract details (env vars, BN-RRM artifact path, Jermilova additions). | §1.3 G13, §1.6 | 3.9 | M |
| P1-5 | Fix `.claude/skills/update-docs/SKILL.md`: rewrite `F:\sstac-dashboard\` paths to canonical; fix existence-check example using `id`/`path` (manifest schema), not `$_.name`. | §1.3 G9, §1.6 | 3.10 | S |
| P1-6 | Create `.claude/README.md` (no manifest entry; brief INDEX.md tooling pointer). Note that until P1-5 lands, SKILL.md command examples are stale. | §1.3 G12 | 2.4 | XS |
| P1-7 | INDEX.md current-status narrative update: brief refresh that LINKS to manifest facts rather than embedding metrics. Remove the "28 endpoints" stale claim at L82. | §1.3 G6 | 3.2 | S |
| P1-8 | PROJECT_STATUS.md: remove or date-stamp the volatile-status claim sites identified in G10 (directly verified: L9, L52, L99, L757, L845, L851 plus 50+ `✅ COMPLETED` markers enumerated in G10 — Phase 3.5 should re-grep at edit time and act on the current set, not transcribe an audit-time count); add header pointer redirecting to INDEX/manifest. | §1.3 G10 | 3.5 | M |

### P2 — Defer to NEXT_STEPS.md (post-cleanup) or a future pass

| # | Item | Source/§ | Notes |
|---|---|---|---|
| P2-1 | Code-side env-var migration for hardcoded RR paths in `src/app/api/regulatory-review/projects/route.ts`, `…/[id]/route.ts`, `…/[id]/extract/route.ts`, `src/lib/regulatory-review/launch-evaluation.ts`. | §1.3 G8 | Code change; out of scope. |
| P2-2 | RR-side fixes (correct PRD↔ENGINE_SPECS keyword-cap contradiction; resolve open questions on direct DB read, sync scripts, evaluate spawn target). | §1.4 | Cross-repo; out of scope for this pass. |
| P2-3 | `.claude/skills/safe-exit/SKILL.md` `F:\Regulatory-Review` paths and conceptual-model drift. | §1.3 G9 | Operational/code scope. |
| P2-4 | `scripts/regulatory-review/*.py` `F:\` paths. | §1.3 G9 | Code scope. |
| P2-5 | `docs/CODEX_REVIEW_PROMPT.md` archival (low-value ancillary file). | §1.3 G4 | Gate on `docs:archive:investigate`. |
| P2-6 | Add a regulatory-review or BN-RRM-specific gate to the manifest so future RR/BN-RRM changes trigger the new docs. | §1.2 | Gate-system change; the v7 plan's non-goals exclude restructuring the gate system. |
| P2-7 | Decide whether `docs/README.md` (legacy) should be archived. | §1.1, §1.3 G14 | Gate on `docs:archive:investigate`. |
| P2-8 | Manifest `facts.phase7_final_validation` (L227–279) simultaneously asserts `status: COMPLETE` / `phase_status: "project ready for production"` while recording E2E tests as `BLOCKED` (L262–269) — internally inconsistent within the same fact block. Phase 3.1 should either date-stamp this entry as a historical retro-snapshot, or correct the contradiction. Other `phase4/5/6_*` blocks have similar production-ready framing (§1.5) and may need the same treatment; defer broader sweep to a separate pass. | §1.5 | Phase 3.1 light-touch. |

---

## Appendix A — Deferred / unverified claims

These items appeared in prior planning but could NOT be verified to current production code in this audit session. Per the source-of-truth rule, they remain **unverified** and must not be cited as current truth in new dashboard docs.

- **A1.** Whether the dashboard reads `engine/data/rraa_v3_2.db` directly. Source: RR `CLAUDE.md` claim; not confirmed by reading dashboard code in this session.
- **A2.** Whether `sync_tier2_to_dashboard.py` is active and currently keeping `regulatory-review.db` in sync. Source: RR doc reference; not located in this audit.
- **A3.** Whether the dashboard `evaluate` flow spawns `run_shadow_evaluation.py` specifically (vs. some other entrypoint). Source: `launch-evaluation.ts` not deep-read.
- **A4.** BN-RRM pack publishing pipeline ownership (manual vs CI). Not documented dashboard-side.
- **A5.** Stage 2.5 pre-ranking + applicability filtering activation status in the deployed adapter. Source: RR PRD only.
- **A6.** ~~Manifest `phase7_*` facts content~~ — **resolved by direct inspection during the revision pass (§1.5).** `phase7_final_validation` block at L227–279 of `docs/_meta/docs-manifest.json` was directly read; findings recorded in §1.5 and §1.7 P2-8. Other `phase4/5/6` blocks remain `[delegated-evidence]` for now and would need a similar direct read in a future pass for full provenance closure.
- **A7.** Whether `PHASE1_PYRAMID_NAVIGATION_IMPLEMENTATION.md` has been implemented (file claims it as a forward plan with line targets in `ReviewDashboardClient.tsx`; code-side check not done).

---

## Appendix B — Sources consulted in this audit

### Direct reads (this session)
- `docs/INDEX.md`
- `docs/_meta/docs-manifest.json` — head L1–200 + targeted greps + **L220–279 directly read during revision pass** (covering phase6 deployment_readiness and full phase7_final_validation block)
- `.env.example` (full, 21 lines)
- `src/middleware.ts` (full, 137 lines)
- `docs/NEXT_STEPS.md` L140–199 (revision pass, confirmed L143 `B+ (87/100)` contradiction)
- `docs/regulatory-review/PHASE1_PYRAMID_NAVIGATION_IMPLEMENTATION.md` (head)
- `docs/regulatory-review/LOCAL_ENGINE_ROUTING_PLAN.md` (head)
- `docs/regulatory-review/CHAT_AND_SEARCH_ENHANCEMENT_PLAN.md` (head)

### Direct greps + globs (this session)
- `Glob 'src/app/api/**/route.ts'` → 42 paths (full list reproduced in G6).
- `Glob 'src/components/bn-rrm/**/*.tsx'` → 41 paths (full list reproduced in G1).
- `Grep '^####\s+(GET|POST|PUT|PATCH|DELETE)' docs/API_REFERENCE.md` → 13 H4 endpoints with line numbers (full list reproduced in G6).
- `Grep 'process\.env\.([A-Z_][A-Z0-9_]*)' src/` (head_limit 500) and `scripts/` (no matches).
- `Grep 'HITL_PACKET_DIR|EVAL_STALE_TIMEOUT_MS|EXTRACT_STALE_TIMEOUT_MS|OLLAMA_BASE_URL|OLLAMA_URL|REDIS_URL|REDIS_TOKEN|NEXT_PUBLIC_APP_VERSION|SENTRY_DSN|NEXT_PUBLIC_SENTRY_DSN|SENTRY_ORG|SENTRY_PROJECT|REG_REVIEW_' src/` — file:line citations recorded inline in G3.
- `Grep 'production-ready|production ready|ALL PHASES COMPLETE|Final Grade|Remaining Work|Current Grade|✅ COMPLETED|fully functional' docs/PROJECT_STATUS.md` (head_limit 60) — 60+ matches with line numbers.
- `Grep 'A- \(85-89%\)|A\+ \(95\+/100\)|A\+\+\+\+|A\+\+ |A\+\+\+ |grade_achieved' docs/PROJECT_STATUS.md` (head_limit 20) — grade-assertion sites at L52, L54, L99, L757, L845, L851.
- `Grep 'production-ready|production ready|ALL PHASES COMPLETE|Final Grade|Remaining Work|Current Grade|fully functional|PROJECT READY FOR PRODUCTION|^## Phase' docs/NEXT_STEPS.md` — confirmed L4–7 + L143.
- `Grep 'production-ready|production ready|fully functional|Production Ready|Phase \d|Current Development Phase' docs/AGENTS.md` (head_limit 40) — confirmed L630, L634, L636, L640, L791, L809.
- `Grep 'production-ready|production ready|Final Grade|Current Grade|F:[\\/]|v1\.|January|November|Tier 2 Rerun|fully functional' MULTI_PROJECT_COORDINATION.md` (head_limit 40) — confirmed L4, L5, L17, L30, L42, L49, L58, L59, L114, L120, L155, etc.
- `Grep 'phase7_' docs/_meta/docs-manifest.json` → confirmed `phase7_final_validation` block at L227.
- `Grep 'workspace_root' C:\Projects\SSTAC-Dashboard` (output_mode files_with_matches) → 2 files (manifest L5 + this audit file).
- `Grep 'F:[\\/]'` across repo (per §1.6 / §1.3 G9; results paraphrased from earlier session).
- `Grep '"id":' docs/_meta/docs-manifest.json` (per §1.3 G4).

### Commands
- `git status --short`, `git rev-parse --show-toplevel`, `git log --oneline -5`.

### Delegated to Explore agents (`[delegated-evidence]` — informs findings; not personally re-verified file-by-file in this session)
- Doc inventory + last-modified dates across `docs/**`, `.github/**`, `.claude/**`, root `.md`.
- API route per-route schema characterization (request/response shapes, auth, side effects) — beyond the route count and documentation comparison verified directly.
- Env-var enumeration `src/**` / `scripts/**` exhaustive sweep — beyond the 9 vars verified directly above.
- BN-RRM artifact contract reads of `public/bn-rrm/pack-registry.json`, `pack.json` schemas, transparency JSON, map artifact filenames, loader entrypoints.
- Cross-repo `C:\Projects\Regulatory-Review` reads (CLAUDE.md, engine/docs/_INDEX.md, engine/docs/active/development/ACTIVE_DOCS.md, PROJECT_TOPOLOGY_PLAN.md, BN-RRM contract files at 2026_Database_Development/data_acquisition/bnrrm_extraction/).
- Volatile-claims sweep beyond what was directly re-confirmed above (e.g., specific test-count line numbers in PROJECT_STATUS.md L730–745; full RR-doc internal contradictions).

### Citation policy
Findings citing a direct read/grep/glob from the lists above are stated as current truth. Findings labeled `[delegated-evidence]` are preserved as evidence the audit relies on for context, but per the source-of-truth rule are **not** to be promoted to current truth in downstream Phase 2/3 docs without independent re-verification at edit time.
