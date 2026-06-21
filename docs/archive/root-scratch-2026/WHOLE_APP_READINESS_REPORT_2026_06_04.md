# Whole-app demo-readiness report -- SSTAC Dashboard -- 2026-06-04

Plain ASCII. Read-only assessment (the #1 deliverable of this session). Answers the owner's
question: "how close is the WHOLE regulatory-review app (with engine-v2 powering it) to fully
functional?" Produced by a 9-surface parallel readiness Workflow + synthesis, then orchestrator-
corrected for stale-branch artifacts and verified against origin/main.

---

## TL;DR (the honest answer)

**Original assessment AT origin/main tip `a6f617a` (#252): roughly 75-80% demo-functional, GATED
ALMOST ENTIRELY on two owner-only unknowns, not on missing code:** (rev7 2026-06-05 per codex Leg-2
round 6 -- baseline pinned + amendments separated below so the audit is reproducible.)

1. **Which environment hosts the demo** -- a local dev box (`npm run dev:all`) vs a Vercel/cloud
   deploy. Two real, high-value surfaces are LOCAL-DEV-ONLY BY DESIGN and fail gracefully (not
   crash) on Vercel: regulatory-review **engine v1** (better-sqlite3, webpack-externalized) and
   the **Agentic OS terminal** (node-pty sidecar, no serverless story). Engine-v2 is the cloud
   path; v1 is legacy.
2. **Which Supabase migrations are applied to the target project** -- I cannot query Supabase
   (MCP dead). Several tables the app uses are NOT in `supabase/migrations/` and so were never
   auto-applied; they ALL live in ONE authoritative file, `database_schema.sql` (root): the admin
   tables (announcements, milestones, discussions, discussion_replies, tags, likes, user_roles)
   PLUS `review_submissions` + `review_files` for the TWG portal -- all with `CREATE TABLE IF NOT
   EXISTS`. They are almost certainly ALREADY applied on the long-running production project, but
   on a FRESH project they would 500. The `database_schema.sql` check is the LARGEST single gate but
   NOT the only one (rev11 2026-06-05 per codex Leg-2 round 10): beyond the schema-file app tables,
   SEPARATE database gates exist that `database_schema.sql` does NOT cover and that the same kit
   probes -- `matrix_reviews`/`document_tags` (code-derived, NO DDL anywhere in the repo; probes
   1j/1l), the Matrix Options catalog RUNTIME tables + approve RPCs (probe 1m), the Admin -> Users
   role-change RPCs (probe 1n), the storage bucket policy (Remedy F), and matrix-map DATA / ETL
   (probe 1k). So the DB risk is NOT cleared by the one schema-file check alone. The authoritative
   owner check is `DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md` STEP 1 -- paste the read-only pre-flight
   SQL through probe 1n (the full matrix), not just the single `database_schema.sql` question.

If the demo runs on the existing local/production environment that has been live for months, the
app is closer to **~85%**. If it runs on a fresh Supabase project or a bare Vercel deploy without
the local sidecar/sqlite, several surfaces degrade. **Nothing here is a missing-code blocker on
main** -- the gaps are environment + migration-applied confirmations (owner-only) plus polish.

### AMENDMENTS since the `a6f617a` baseline (rev7 2026-06-05 per codex Leg-2 round 6)
The original assessment above was taken AT `a6f617a`. `origin/main` has since advanced; this session
verified the current tip is **`a210844`** (git fetch + rev-parse, 2026-06-05). Later sections of this
report already fold in the following post-`a6f617a` facts -- each is listed here with its source
commit/PR so the mixed baseline is explicit and the audit stays reproducible:
- **#251 (`8a59ed2`)** -- engine-v2 M1a Phase 2: `v2_projects.applicable_policy_ids` + `V2Project`
  type (the column/type "mismatch" that the raw synthesis miscalled the #1 blocker is synced here).
- **#253 (`6094013`)** -- engine-v2 M1b `ApplicablePolicyStep` + M1c evaluate cutover, including the
  proposer env wiring referenced in the engine-v2 detail.
- **#254 (`8dc6224`)** -- manifest `vitest_test_count` refreshed 481 -> **2992** (+ stripAnsi fix);
  this closes backlog item #5 below.
- **#256 (`aa69796`)** -- siteDataStore + sqlite/queries coverage to ~100% (pure test additions).
- **#255 (`a210844`, current tip)** -- review_submissions status literals aligned with the DB CHECK
  (`IN_PROGRESS`|`SUBMITTED`).
None of these change the headline 75-80% rating or the two owner-only gates; they retire two of the
listed polish items (manifest count, coverage) and confirm the engine-v2 cutover storyline on main.

### The single most important correction vs the raw assessment
The automated synthesis named an engine-v2 `applicable_policy_ids` column/type MISMATCH as the
"#1 demo-blocker." **That is a STALE-BRANCH ARTIFACT, not a main-branch reality.** The working
tree is on `docs/matrix-options-session-2026-05-31` (36 commits behind). On origin/main, #251
already synced everything:
- `src/lib/engine-v2/types.ts:38` -> `applicable_policy_ids: unknown[];` PRESENT.
- engine-v2 `[projectId]/page.tsx:35` -> SELECT list INCLUDES `applicable_policy_ids`.
- `supabase/migrations/20260604_v2_projects_applicable_policy_ids.sql` PRESENT (idempotent ALTER).

So the only engine-v2 action is ordering: **apply the 20260604 migration to the target Supabase
project BEFORE/with deploying main** (patched code + unpatched schema = column-not-found). The
"current branch removes Jurisdictional Frameworks Quick Reference equations" finding is likewise a
stale-branch artifact -- those equations are present on main (#210).

---

## Methodology + caveats

- Assessed against **origin/main a6f617a** (not the stale working tree). Where a reader cited the
  working tree for engine-v2 / matrix-options / supabase files, I re-verified via
  `git show origin/main:<path>` and corrected.
- I **cannot** verify which migrations are applied to the live Supabase project; every such item
  is tagged "owner to confirm applied."
- Read-only: no code changed during the assessment.
- **Kit coverage is matrix-complete (rev6 2026-06-05 per codex Leg-2 round 6; +1 rev5 2026-06-05 per Opus matrix verify).** The companion
  `DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md` now carries a DEMO-SURFACE DEPENDENCY MATRIX appendix
  that is the AUTHORITY for coverage: one row per rated surface below, auditing six dependency
  classes each (tables+columns / constraints+RLS / functions+RPCs / storage buckets / data rows /
  env vars), with every cell either probe+remedy-covered or explicitly DEFER/OUT-OF-SCOPE. That
  audit surfaced seven previously-uncovered dependencies -- the four round-4 Supabase gaps (the CEW
  poll submit RPCs, the `matrix_reviews` table with no DDL anywhere in the repo, a partially-repaired
  `review_files` legacy NOT-NULL false-clear, and empty `matrix_map` data despite live RPCs, all
  closed in STEP 1 probes 1c-2 / 1h legacy-NOT-NULL / 1j / 1k and remedies E rev4 functions / G / B
  relax / D + ETL note) plus the `document_tags` JOIN table (read by `/twg/documents` + written by
  the document-edit tag API, also NO DDL anywhere in the repo -- same no-CREATE-source class as
  `matrix_reviews`; closed by STEP 1 probe 1l + new Remedy H, rev5 per Opus matrix verify) plus two
  local-filesystem standalone-route gaps that had been falsely described as inheriting Working/Partial
  from Supabase data deps: `/hitl-packets` (local packet files + `HITL_PACKET_DIR`, round 5, matrix
  row #11) and the Agentic OS admin pages
  `/admin/agentic-os` + `/admin/agentic-os/subscriptions` (local `PROJECTS_MAP.md` /
  `AI_SUBSCRIPTIONS.md` + `KNOWLEDGE_BASE_PATH`, round 6, matrix row #12), both now marked
  OUT-OF-SCOPE (local-only by design) with their env vars in the STEP 3 ENV CHECKLIST. No
  demo-surface dependency is left silently absent from the kit.

---

## Per-surface readiness

| Surface | Rating (on main) | Demo-ready? | Conflict lane | Real gating item |
|---|---|---|---|---|
| Auth + middleware + RBAC | **Working** | Yes | none | none (env + admin row owner-confirm) |
| Matrix Options (8 tabs) | **Working** (one Partial sub-route) | Yes | none | Calculators have NO DB dep; Evidence Library review/admin runtime needs the 1m catalog tables + approve RPCs (rev9 -- probe 1m + named migrations); Interactive Map needs matrix_map RPC live (owner-confirm); `/matrix-options/private-data-access` is a "Documentation forthcoming" stub linked from PartialVisibilityBanner (rev7, polish -- see detail + backlog #9) |
| BN-RRM (maps, HITL, canvas) | **Working** | Yes | none | static pack JSON under public/ must ship (it does) |
| Regulatory-review engine v1 | **Partial** | Local only | engine-v2 | better-sqlite3 + local engine; dead on Vercel BY DESIGN |
| Engine-v2 views (cutover) | **Working on main** | Yes* | engine-v2 | *apply 20260604 migration; subprocess paths env-dependent |
| Dashboard shell + nav | **Working** | Yes | none | none |
| Admin feature pages | **Partial** | Conditional | none | admin tables only in database_schema.sql (owner-confirm applied) |
| CEW polls / TWG review / SSD | **Partial** | Conditional | none | `review_submissions`/`matrix_reviews` + CEW submit RPCs have no migration (owner-confirm); no standalone SSD route |
| Agentic OS terminal | **Partial** | Local only | other | node-pty sidecar; no serverless story; gated, fails gracefully |
| Data / infra / deploy posture | **Partial** | n/a | none | migration-applied + env confirmations |

### Detail + evidence (only the load-bearing points)

**Auth (Working).** Middleware protects 6 prefixes (`/dashboard`,`/twg`,`/survey-results`,
`/cew-2025`,`/regulatory-review`,`/bn-rrm`); `src/middleware.ts:128-137`. Login/signup call
Supabase auth correctly; admin gated via `user_roles` (`src/app/(dashboard)/admin/page.tsx:38-49`).
13/13 auth tests pass. Polish only: no password-reset / email-verification / admin-bootstrap UI.
Owner-confirm: at least one `user_roles(role='admin')` row exists for the demo account.

**Matrix Options (Working).** All 8 tabs render; 4 calculators compute; catalog (~1.6k records --
1573 are the human-health TRV file; total bundled PARAMETER_VALUE_RECORDS ~1653) is
bundled via static import (`src/lib/matrix-options/provenance/catalog.ts`) with NO runtime Supabase
dependency FOR THE CALCULATOR HAPPY PATH. (rev9 2026-06-05 per codex Leg-2 round 8) GATING
CORRECTION -- the EVIDENCE LIBRARY review/admin runtime IS Supabase-backed and was understated here:
if the demo exercises the Evidence Library promote / qa-review / evidence / source / triage / staging
workflows, those read AND write the 1m catalog tables `promoted_parameter_values`,
`parameter_value_reviews` (Studio-applied, NO migration on disk), `catalog_evidence_items`,
`catalog_sources`, `source_lead_triage`, and (admin Catalog Staging Review) `catalog_extraction_staging`,
plus the `catalog_approve_staging_row` / `catalog_approve_staging_rows_bulk` approve RPCs. Reads fail
soft (helpers return []/{} -> the library shows empty, not a 500), but every WRITE 500s until the table
exists, so a target can be marked demo-ready while those writes fail or reads silently empty. Gate the
Evidence Library on kit probe `1m` + the named catalog migrations (`20260527000003/_000004/_000005/
_000006/_000007/_000008`, `20260530000001`, `20260602000001`; `parameter_value_reviews` is the lone
Studio-applied exception with no migration on disk), NOT just the static catalog. Interactive Map tab
needs `matrix_map.fetch_samples_with_hidden_summary` RPC +
allowlist live for authenticated users (owner-confirm); anon correctly sees the empty-data
fallback (not an error). Guide/markdown read server-side from `matrix_research/` (present).
KNOWN STUB (Partial; rev7 2026-06-05 per codex Leg-2 round 6): the matrix-map "partial visibility"
banner links to a real route that renders only a placeholder. Verified on origin/main:
`src/app/(dashboard)/matrix-map/PartialVisibilityBanner.tsx:96` sets
`href="/matrix-options/private-data-access"`, and
`src/app/(dashboard)/matrix-options/private-data-access/page.tsx:10` renders "Documentation
forthcoming. Some matrix-map samples are behind private DRAs..." (no functional content). If the
demo shows hidden/private DRA data and the CEO clicks through, this is a VISIBLE stub. It is the only
Partial item inside Matrix Options; it does not block the 8 tabs or the calculators. Remedy is polish
-- write the page content or unlink the banner (tracked on the roadmap polish list; see backlog #9).

**BN-RRM (Working).** Maps, learned-model, peer-review artifacts load from static JSON under
`public/bn-rrm/` (pack-registry.json + learned-model.json 523KB + review/*.json). Ships with the
build. validateChemistry covers 8 params (quality, not a blocker).

**Engine v1 (Partial, local-only by design).** Reads SQLite via better-sqlite3 (externalized from
webpack). On Vercel: routes throw a graceful "SQLite database is not available." Evaluation/extract
flows shell out to the sibling `C:/Projects/Regulatory-Review` repo + Python (hardcoded paths).
`src/data/regulatory-review.db` is a LOCAL-DISK artifact (~166MB, not git-tracked) -- present on
the owner's box, not in the repo. This is intentionally superseded by v2.

**Engine v2 (Working on main; the cutover storyline).** Code synced on main (see TL;DR). Real
actions: (a) apply `20260604_v2_projects_applicable_policy_ids.sql` to target Supabase BEFORE
deploy; (b) confirm earlier lane-2a/2b patches in `supabase/engine_v2/` were applied; (c) the
evaluate/extract subprocess paths (`REG_REVIEW_ENGINE_V2_SCRIPT_PATH`,
`REG_REVIEW_ENGINE_V2_ADAPTER_PATH`) must be reachable in the demo environment; (d) (rev10
2026-06-05 per codex round 9) the POLICY-PROPOSER paths fail closed independently -- creating a v2
project or running the wizard's policy-proposal step needs `LOCAL_ENGINE_ENABLED` plus
`REG_REVIEW_PYTHON_PATH` and `REG_REVIEW_ENGINE_V2_PROPOSE_CLI_PATH` (propose-policies/route.ts:81-86
returns 503; projects/route.ts:104-130 returns 502 `proposer_unavailable` and refuses the insert).
See the kit STEP 3 ENV CHECKLIST. ACTIVE PARALLEL LANE -> I did not and will not edit engine-v2
code this session.

**Dashboard shell (Working) + Admin pages (Partial).** Shell, nav (`menuConfig.ts`), and
`/admin` render with 12 quick-action cards. BUT the 7 core admin tables (announcements, milestones,
discussions, discussion_replies, tags, likes, plus user_roles RLS) are defined ONLY in
`database_schema.sql` at repo root -- NOT in `supabase/migrations/`. If the target project lacks
them, clicking a card 500s with "relation does not exist." Almost certainly already applied on the
long-running project (the public dashboard renders announcements/milestones today). Owner-confirm
applied; on a fresh project, needs a dated migration.

**CEW / TWG / SSD (Partial).** (rev3 2026-06-05 per codex Leg-2 round 3) CEW polls + TWG results +
document nav work. The TWG **review portal** (`/twg/review`, `/api/review/save|submit|upload`)
writes to `review_submissions` + `review_files`, which ARE defined in `database_schema.sql`
(lines 449, 480) -- the SAME single, not-auto-applied source as the admin tables (they are not under
`supabase/migrations/`; the separate `document_reviews` table, used by the Jermilova portal, DOES
have a migration). The save/submit path is the same one owner-confirm as the admin tables. BUT the
UPLOAD path has two extra gates beyond table PRESENCE, so do not call it ready on presence alone:
(1) COLUMN CONTRACT -- the `database_schema.sql` `review_files` DDL is STALE (it defines
`file_name`/`mime_type`/`created_at` as `NOT NULL`, but the live upload route
`src/app/api/review/upload/route.ts:105-111` inserts `filename`/`mimetype`/`file_size`/`uploaded_at`).
A project carrying the stale schema has the table PRESENT yet `/api/review/upload` 500s on the wrong
(and legacy-NOT-NULL) columns. The kit's STEP 1 now adds a read-only column-contract probe and Remedy
B relaxes the legacy NOT NULL columns -- gate on the CONTRACT, not presence.
(2) STORAGE BUCKET -- the route writes the file to Supabase Storage bucket `documents`
(`route.ts:97`: `supabase.storage.from('documents')`) BEFORE inserting the row, and NO repo
SQL/migration creates that bucket or its storage policies. The kit's STEP 1 now probes
`storage.buckets` and a new mini-remedy creates the bucket (or the owner marks TWG uploads
out-of-demo-scope). So TWG upload readiness = `review_submissions`/`review_files` CONTRACT +
`documents` bucket, NOT table presence.
(3) CEW POLL SUBMIT RPCs (rev4 2026-06-05 per codex Leg-2 round 4) -- the three poll-submit routes
call `get_or_create_poll`/`_ranking_poll`/`_wordcloud_poll_fixed` (helper functions only in
`database_schema.sql`, not migrations), so a project with all six poll TABLES present can STILL 500
on every submit. The kit's probe 1c-2 + Remedy E rev4 function block close this.
(4) MATRIX-OPTIONS "TWG Review" TAB (rev4) -- distinct from `/twg/review`: the Matrix Options TWG
Review tab writes `matrix_reviews` (TWGReviewPortal.tsx) and `/admin/matrix-review` reads it, but NO
CREATE TABLE for `matrix_reviews` exists anywhere in the repo (only the security-audit migration
assumes it). The kit's probe 1j + new Remedy G (code-derived contract, verify-against-live) close it,
with a follow-up backlog to land canonical DDL. (Code note RESOLVED rev11 2026-06-05 per codex Leg-2
round 10: the prior `queries.ts createReviewSubmission` `draft`-status defect is fixed on current
origin/main -- `src/lib/db/queries.ts:482` now writes `status: 'IN_PROGRESS' satisfies
ReviewSubmissionStatus`, aligned with the CHECK(IN_PROGRESS|SUBMITTED), landed in #255 (`a210844`,
current tip). No follow-up cleanup remains.) No standalone interactive SSD route exists (SSD lives inside Matrix Options' SSD
Workbench tab); if the CEO expects a separate SSD tool, that is a scope gap.

**Agentic OS terminal (Partial, demo-sensitive).** xterm.js modal -> node-pty sidecar
(`scripts/agentic-os-pty-server.mjs`, port 3101). Requires `npm run dev:all`; no serverless
deployment. THREE-GATE (rev2 2026-06-05 per codex Leg-2 round 2 -- the prior "dual-flag" missed the
PTY secret; this mirrors the kit's STEP 3 three-gate checklist): (1) `NEXT_PUBLIC_AGENTIC_OS_ENABLED=true`
only renders the card/page; (2) the pty SPAWN additionally needs `NODE_ENV=development` OR
`AGENTIC_OS_LOCAL=true` (so a PRODUCTION build on the local box must set BOTH this and gate 1); (3)
`AGENTIC_OS_PTY_SECRET` MUST be set and be at least 32 chars (`MIN_PTY_SECRET_LENGTH = 32`), or
`isAgenticOsPtyEnabled()` returns false (`src/lib/agentic-os/feature-flag-server.ts:90-97`, secret
length check at 93-94), the pty-token route returns `pty_disabled`, and the sidecar refuses to start.
Set only gates 1-2 and the card may render but the terminal will NOT connect. On Vercel it shows a
friendly local-only message and the WebSocket fails. ASSET if demoed on the local box with all three
gates; otherwise hide the card to avoid a non-functional surface. Security: it exposes a shell --
keep admin-only. (Note: engine-v2 LIVE evaluate/extract is a separate local-only gate --
`LOCAL_ENGINE_ENABLED=true` via `requireLocalEngine()` in `src/lib/api-guards.ts`, plus the
`REG_REVIEW_ENGINE_V2_SCRIPT_PATH`/`_ADAPTER_PATH` subprocess paths; engine-v2 READ views are
Supabase-backed and do not need it. See the kit STEP 3 ENV CHECKLIST.)

**Data/infra (Partial).** 32 migrations on main. Required env: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (build+runtime); Sentry vars optional. Biggest infra truth: the
app's full functionality depends on migration-applied state that only the owner can confirm.

**Additional standalone routes (completeness; folded above, no separate rating).** Verified on
origin/main, all gate on auth (redirect to /login when no session) using the same pattern as the
rated surfaces. MOST add NO new failure mode beyond the already-covered table set:
`/matrix-map` (full standalone map, reviewer-allowlist gated -- distinct from the Matrix Options
"Interactive Map" tab; same matrix_map RPC dep as Remedy D), `/hitl-packets` + `[sessionId]`,
`/wiks`, `/cew-results`, `/twg-results`, the survey-results sub-pages, and the admin sub-pages
(cew-stats, matrix-map/health, agentic-os/subscriptions). `/demo-matrix-graph` has no
auth gate (a public demo page). PUBLIC CEW WIKS QR STUB (Partial; rev11 2026-06-05 per codex Leg-2
round 10): `/cew-polls/wiks` is a SEPARATE PUBLIC code-entry route (WIKS = "Weaving Indigenous
Knowledge & Science") reached via `public/qr-codes/wiks-QR.png` -- distinct from the authenticated
`/wiks` route above and from the generic CEW poll-submit RPCs. After code entry it renders only a
"Coming Soon" placeholder (`src/app/cew-polls/wiks/page.tsx:55`, verified on origin/main), so if the
CEO demo scans the WIKS QR it lands on a visible public STUB, not interactive polling. Treat as a
KNOWN PUBLIC STUB / Partial: either omit the WIKS QR from the demo or set expectations that this one
CEW path is under development. RESET VOTES IS NOT IN THIS "no new failure mode" group (rev9
2026-06-05 per codex Leg-2 round 8): `/admin/reset-votes` is OWNER-GATED / OUT-OF-DEMO-SCOPE. It does
NOT merely inherit the covered poll-table deps -- `src/app/(dashboard)/admin/reset-votes/ResetVotesClient.tsx:20`
calls `rpc('create_vote_backup')`, a function that is NOT defined anywhere under `database_schema.sql`
or `supabase/migrations/` (verified: the ONLY occurrence of `create_vote_backup` on origin/main is that
single call site -- no DDL), so the "with backup" path 500s on a fresh/clean project; and the page also
exposes PERMANENT vote-deletion buttons (`poll_votes`/`ranking_votes` `.delete()`, ResetVotesClient.tsx:27/33).
HAZARD: do not click it during a demo -- it can irreversibly wipe live poll/ranking votes. The kit does
NOT provide a probe or remedy for `create_vote_backup` BY DESIGN (the function would need a code-derived
reconstruction with no repo source; DEFER recommended). See the kit DEMO-SURFACE DEPENDENCY MATRIX row
#13 + the STEP 1 reset-votes note. EXCEPTIONS that do NOT inherit from a Supabase table (rev6
2026-06-05 per codex Leg-2 round 6): `/hitl-packets` (+`[sessionId]`) reads packet files from a
LOCAL filesystem dir gated on env `HITL_PACKET_DIR`, and the Agentic OS admin pages
(`/admin/agentic-os` projects + `/admin/agentic-os/subscriptions`) read local files
`PROJECTS_MAP.md` / `AI_SUBSCRIPTIONS.md` via `fs.readFile` gated on env `KNOWLEDGE_BASE_PATH`
(`src/lib/agentic-os/parse-projects-map.ts`, `parse-ai-subscriptions.ts`) -- their data source is a
local file + env var, NOT a covered Supabase table, so they do NOT inherit Working/Partial from a
table set. Both wrap the read in try/catch and render an admin-friendly load-error envelope (NOT a
500) when the file is absent. See the kit's DEMO-SURFACE DEPENDENCY MATRIX appendix rows #11 and
#12 for their explicit OUT-OF-SCOPE (local-only by design) treatment + the STEP 3 ENV CHECKLIST
entries (`HITL_PACKET_DIR`, `KNOWLEDGE_BASE_PATH`; both optional, default path if unset). The
remaining routes inherit Working/Partial from their data deps.

---

## Honest overall readiness

- **Code completeness on origin/main: ~85%.** Auth, Matrix Options, BN-RRM, dashboard shell, and
  engine-v2 code are complete and tested (~2992 unit tests pass; rev 2026-06-05 per codex Leg-2 --
  the prior "2696+" was the dirty primary-checkout count, and the committed origin/main manifest
  baseline was 481; 2992 is the refreshed count, manifest PR pending). The remaining ~15% of CODE is
  genuine polish/scope (password reset, standalone SSD, equation-coverage breadth).
- **End-to-end demo readiness: ~75-80%, environment-dependent.** Subtract for: (a) the
  local-dev-only surfaces (v1, Agentic OS) if demoed on Vercel; (b) admin pages + TWG review if
  their tables are not applied to the target project. Add back to ~85% if demoed on the existing
  local/production environment with all migrations applied.
- **Basis for the number:** the foundation (auth) is unbreakable; the two largest demo surfaces
  (Matrix Options, BN-RRM) are fully working with no Supabase-write dependency on the happy path;
  engine-v2 (the headline storyline) is code-complete on main and gated only on a migration-apply
  + env-path confirmation; the drag comes from migration-applied UNCERTAINTY and deployment-context
  features, both owner-resolvable in well under a day. This is a "confirm-and-configure" gap, not a
  "build-more-code" gap.

**Path to 90%+ (mostly owner actions, each small):** apply 20260604 engine-v2 migration; confirm/
apply admin tables + `review_submissions`; pick + lock the demo environment; seed a little sample
data for non-zero admin metrics.

---

## Prioritized demo-readiness backlog

Tags: [priority] (autonomy, lane, conflict, effort).

### Demo-blockers (resolve before the demo)
1. **Apply engine-v2 migration `20260604_v2_projects_applicable_policy_ids.sql` to target
   Supabase, then deploy main.** [demo-blocker] (owner-gated, engine-v2, conflict=engine-v2, S).
   Code is already on main; this is apply-then-deploy ordering.
2. **Confirm the admin + TWG-portal tables are applied** to the target project (rev2 2026-06-05 per
   codex Leg-2 round 2). These tables (admin pages + `review_submissions`/`review_files`) are
   DEFINED in `database_schema.sql`, but DO NOT remedy a "missing table" result by pasting that whole
   file. Pasting `database_schema.sql` wholesale is UNSAFE on a live or partially-applied project:
   its `CREATE POLICY` statements are NOT idempotent (error "policy already exists" on re-run and
   abort the rest of the paste), it re-INSERTs sample announcements/milestones that DUPLICATE visible
   demo content (no unique key for ON CONFLICT to catch), and `database_schema.sql:904` runs
   `GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated`, broadening write
   privileges on every unrelated table. [demo-blocker] (owner-gated, none, conflict=none, S).
   Remedy = run STEP 1 pre-flight then paste ONLY the guarded, idempotent Remedy B (app tables) /
   Remedy E (CEW poll tables) blocks for whatever STEP 1 reports missing -- the kit deliberately
   EXCLUDES the sample-data INSERTs and the broad GRANT, and the Remedy B `review_files`/`documents`
   blocks use the verified LIVE-CODE column contract (the schema-doc DDL for those two is stale).
   NO new migration needed for these repo-backed tables. Pre-flight SQL + guarded remedies + exact
   line ranges in `DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md`.
   IMPORTANT -- two probes route ELSEWHERE, NOT to Remedy B/E (rev7 2026-06-05 per codex Leg-2 round
   6): if STEP **1j** reports `matrix_reviews_present = false` (Matrix Options "TWG Review" tab /
   `/admin/matrix-review`) or STEP **1l** reports `document_tags_present = false` (TWG Documents tags
   at `/twg/documents` + admin tag editing), these two tables have NO `CREATE TABLE` DDL anywhere in
   `database_schema.sql` OR `supabase/migrations/` on origin/main. Remedy B/E do NOT cover them. The
   first-class outcomes for a `false` here are: (a) **Remedy G** (`matrix_reviews`) or **Remedy H**
   (`document_tags`) -- code-derived contracts RECONSTRUCTED FROM LIVE CODE, the ONLY DDL in the kit
   NOT traceable to a repo source, so NOT repo-backed; the owner MUST verify the reconstructed
   column/RLS contract against the LIVE project before running, since applying it mutates production
   schema from a code inference, not an approved migration; OR (b) **EXPLICIT DEFER** -- if that
   surface is NOT in the demo, skip the table entirely (do not run G/H). Do NOT fall back to Remedy
   B/E for 1j/1l. Full Remedy G/H DDL + the "IMPORTANT -- READ BEFORE RUNNING" caveats are in
   `DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md`.
3. (folded into #2 -- `review_submissions` is in the same `database_schema.sql` source.)
4. **Lock the demo environment** (local `dev:all` vs Vercel) and confirm env vars + subprocess
   paths for that target. [demo-blocker] (owner-gated, none, conflict=none, S).

### High-value polish (autonomous-safe -- candidates for THIS session)
5. **Manifest `vitest_test_count` refresh** -- DONE: merged to main via PR #254 on 2026-06-05
   (count now 2992 + stripAnsi extractor fix). Retired from the backlog (rev10; see AMENDMENTS).
6. **Conditionally hide the Agentic OS admin card on non-local deploys** so the CEO dashboard has
   no non-functional card. [polish] (autonomous-safe, none, conflict=none, S). Behavior change ->
   PR-open for owner review (not auto-merged). NOTE the correct gate is the SERVER spawn flag
   (`AGENTIC_OS_LOCAL` / `NODE_ENV`), not just `NEXT_PUBLIC_AGENTIC_OS_ENABLED` -- a hide should key
   off real connectability, and you may instead WANT the card visible to discuss the capability
   (your call).
7. **Admin "system status" honesty** -- the dashboard hardcodes "All Systems Operational"; make it
   reflect actual readiness. [polish] (autonomous-safe, none, conflict=none, M). PR-open.
8. matrix-options / bn-rrm test-coverage additions (e.g. validateChemistry breadth). [polish]
   (autonomous-safe, none, conflict=none, M). AI-merge eligible if pure test additions.
9. **`/matrix-options/private-data-access` stub** (rev7 2026-06-05 per codex Leg-2 round 6) -- the
   route linked from `PartialVisibilityBanner.tsx:96` renders only "Documentation forthcoming"
   (`private-data-access/page.tsx:10`). Write the page content OR unlink the banner so the CEO does
   not click into an empty stub. [polish] (autonomous-safe, matrix-options, conflict=none, S).

### Owner-gated / parked (the matrix-options lane backlog, unchanged)
- MO qa-promotion FLIP (owner runs the tool); frame-aware variant (Type-A/B + data); eco-passes
  SQL paste. See `MATRIX_OPTIONS_OWNER_GATED_PREP_2026_06_04.md`.

### Nice-to-have
- Standalone SSD route (if the CEO expects a separate SSD tool); CEW/TWG chart drill-down;
  confidence-aware memo redaction; password-reset / email-verification flows.

---

## What I will do autonomously now (Phase 2), and what I will not

WILL (safe, non-conflicting, not owner-facing-prose, not in a parallel lane): item 5 (manifest
refresh, AI-merge eligible) first; then evaluate items 6/7/8 as PR-open (behavior changes are not
auto-merged per the tightened plan). Each: own worktree off origin/main, full gates + docs-gate,
codex-family re-probe per PR.

WILL NOT (owner-gated or conflict): apply any migration / paste any SQL (owner only); edit
engine-v2 or regulatory-review-FE code (active parallel lanes); flip qa_status or mutate the
catalog; touch other sessions' worktrees or kill any process.
