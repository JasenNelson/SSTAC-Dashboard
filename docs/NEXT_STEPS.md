# Next Steps — Deferred Items

**Lifecycle:** REFERENCE (append-only deferred items; date every entry)
**Last reframed:** 2026-04-20

---

## How to use this file

This document is a **dated, append-only list of deferred items** — things identified during a past session that were scoped out, not shipped, or left for a later pass. It is not a status dashboard and it does not claim to describe the current state of the project.

- **Where current status lives:** `docs/INDEX.md` (narrative) and `docs/_meta/docs-manifest.json` `facts` (metrics).
- **Where recent commit history lives:** `git log` — authoritative.
- **Where audit findings live:** `docs/_meta/DOCUMENTATION_AUDIT_2026-04.md` (and successor audits).

Each deferred item must include: the date it was deferred, why it was deferred, and the source document / session that surfaced it. Do **not** add "ALL PHASES COMPLETE," "Final Grade," or production-ready framing to this file.

---

## Deferred items

### 2026-07-30 -- Two remaining UNGUARDED Supabase cookie adapters (same class as the PR #758 crash)

Deferred because PR #758 was an emergency hotfix deliberately scoped to the one page that was
crashing in production; widening it would have delayed the fix and enlarged the reviewed surface.
Source: the PR #758 adversarial review plus a direct re-verification during the 2026-07-30 docs
closeout.

Both carry the same legacy `get`/`set`/`remove` adapter with an **unguarded** `cookieStore.set`,
which is exactly the shape that took `/admin/matrix-map/site-aggregates` to the global error
boundary when a token refresh landed mid-render (see `docs/LESSONS.md`, 2026-07-30):

- `src/app/(dashboard)/admin/announcements/page.tsx:17-19`
- `src/app/(dashboard)/admin/milestones/page.tsx:17-19`

**COUNT CORRECTED.** The PR #758 review reported THREE such pages, naming
`src/app/(dashboard)/regulatory-review/[submissionId]/page.tsx` as the third. Direct inspection at
`79e9353d` shows that file's adapter at `:281-287` **is** already wrapped in `try/catch`, so it is
NOT in this class. The verified count is TWO. Recorded rather than inheriting the reviewer's number.

Secondary, lower priority: roughly nineteen further pages still use the legacy adapter SHAPE but ARE
guarded, so they cannot crash this way. The residual concern is that the legacy `get` path probes
only about five chunk indices per key and can silently truncate very large sessions. Migrating them
to `getAll`/`setAll` is hygiene, not an incident.

### 2026-07-30 -- Should `/admin/:path*` be in the middleware matcher?

Deferred because it would change behaviour for EVERY admin route and is out of scope for a hotfix.
Source: PR #758 root-cause analysis.

`src/middleware.ts:155-165` matches `/dashboard`, `/twg`, `/survey-results`, `/cew-2025`,
`/regulatory-review`, `/bn-rrm`, `/demo-matrix-graph`, `/matrix-options` -- **not `/admin`**. So no
middleware session refresh runs on admin routes, which is why the refresh happens during render at
all. The guarded `setAll` prevents the crash but does NOT persist a rotated refresh token, and
`@supabase/ssr` warns that this can cause random logouts or early session termination. Adding
`/admin` would address the cause rather than the symptom, and needs its own design and review.

### 2026-07-30 -- AGY runbook is stale for AGY 1.1.8; workflow rewrite BLOCKED on canary receipts

Deferred because the replacement workflow is not yet proven. Source: 2026-07-30 docs closeout.

`docs/AGY_USAGE.md` was verified against AGY 1.1.7 (2026-07-25). AGY is now 1.1.8, and at least
model slugs and Go-duration syntax have drifted. A drift banner was added to that file; the
invocation and workflow sections were deliberately NOT rewritten.

**Do not document a replacement AGY-first workflow as proven until Mission Control's containment and
review canaries have produced receipts.** Re-probe `agy --version`, `agy --help`, the model menu and
the duration/timeout flag syntax against the installed CLI, capture the receipts, then update.

### 2026-07-22 -- KB/Graphify source-trace + gap analysis formalized

Formalized the KB-wiki/Graphify instruction lineage and OHD-vs-SSTAC gap as committed docs (companions
to the 2026-07-22 phase-state audit and Row 10 build receipt):
`docs/design/SSTAC_KB_GRAPHIFY_SOURCE_TRACE_2026-07-22.md` and
`docs/design/OPENHARNESS_TO_SSTAC_KB_GAP_ANALYSIS_2026-07-22.md`.

- Confirmed `~/.claude/plans/jolly-marinating-piglet.md` (698 lines) is the complete, authoritative
  SSTAC instruction set -- no fuller undiscovered instruction doc exists; nothing was lost to drift.
- Regulatory-Review comparator conclusion: RR has landed nothing graphify/KB-wiki (Phase -1,
  pre-kickoff); its plan is itself a fork of SSTAC's own plan, so there is nothing to port FROM RR
  into SSTAC.
- Cross-checked nine later-vintage RR-plan adversarial findings against SSTAC's current landed state:
  two (json-as-code exclusion, full doc-extension blanket exclude) are real outstanding gaps in the
  already-landed `.graphifyignore`; the rest are either already absorbed or not yet applicable pending
  Phase 4-6 work.
- **On the phase-gate question, the outstanding action is the Phase 3.5 owner go/no-go decision** -- a
  dedicated decision packet PR is the recommended next step; no Phase 4-7 work proceeds without it.
  Independently of that gate, the two hardening gaps above (json-as-code exclusion, full doc-extension
  blanket exclude) are Phase-0-3.5-safe candidate follow-up PRs (owner-scoped).

### 2026-07-09 -- E-58 live review surface: RPC fix merged, production deploy still owner-gated

Session merged PRs #559 (Search submission RPC ambiguous-column fix), #560 (Index-submission-
evidence CTA for absent indexing state), #561 (E-58 provenance safeguard), and #562 (Supabase
protocol reconciliation to an owner-approved gated-write workflow -- see CLAUDE.md's Supabase
Protocol section for the current policy). Real E-58 evaluation confirmed live and working:
`project_id 11111111-1111-1111-1111-111111111111`, `evaluation_id
33333333-3333-3333-3333-333333333333`, `completed`/`live`, 42 per-policy rows, 420 submission
chunks, 420 citation rows, indexing status `complete`, 0 `v2_judgments` rows.

**Deferred (owner-gated, not started this session):**
- **Export CSV/MD/HTML and Export memo verification against real (non-stub) data** -- flagged in the
  prior overnight closeout as unconfirmed; not revisited this session.
- **One real judgment save + one real "Ask AI" chat query** against evaluation `33333333` --
  remain untested end-to-end; the latter needs a live Ollama session (owner-gated per
  OLLAMA_SCHEDULE_PROTOCOL.md).

### Resolved (2026-07-09, later same-day autonomous run -- see
`FRESH_SESSION_HANDOFF_2026_07_09c_ENGINE_V2_E58_LAUNCH_SUPPORT_RUN.md`)

- **Apply the #559 migration to production.** Merging the PR does not deploy it -- the RPC fix
  (`supabase/migrations/20260709_v2_submission_chunks_search_rpc_fix_ambiguous_evidence_item_id.sql`)
  must be owner-run in Supabase Studio (or via the new PR #562 gated-write path) before Search
  submission works live. Exact SQL, smoke-test steps, and rollback conditions: see the "Remaining
  owner action" section of `FRESH_SESSION_HANDOFF_2026_07_09b_ENGINE_V2_E58_SEARCH_RPC_FIX.md`
  (tracked, not a scratch file).
  **DONE:** applied via owner-approved `mcp__supabase-project-scoped__execute_sql` (not
  `apply_migration`) after byte-diff verification, an Opus adversarial review, and a codex targeted
  review, all GREEN. Preflight confirmed the buggy version was live; postflight confirmed the fix
  (`has_qualified_reference=true`, both buggy flags `false`).
- **Then smoke-test Search submission** on evaluation `33333333-3333-3333-3333-333333333333` (same
  handoff section has the exact steps).
  **DONE, PASS:** 3 queries (contamination, remediation, arsenic), all HTTP 200, real highlighted
  results with citation badges, zero console errors, zero `search_failed` text.

### 2026-07-06 -- MO provenance guards shipped; owner-gated lanes re-grounded

Session shipped PRs #522/#523/#524/#525 (two detection-only provenance guards + zinc/mn tension flags
+ handoff). Re-grounded the three owner-gated lanes from the 2026-07-01/07-05 planning docs against the
current catalog and found them ~90% already executed. Genuinely-open items are captured as an owner
decision packet: `docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md`. Deferred (owner decisions):
- **Lane 2 HC TRV v4.0 re-verification -- RESOLVED 2026-07-06.** Owner supplied the canonical HC 2025
  PDF (`G:\My Drive\SABCS - Sediment Project\References\HC 2025 - Toxicological Reference Values TRV.pdf`).
  Re-extraction is byte-identical to the committed table (0 drift) and the crosscheck found 0 value
  errors across 111 HC rows (107 MATCH / 0 MISMATCH / 4 AMBIGUOUS: 1 benign + the 3 already-flagged
  population/value tensions). See `docs/MATRIX_OPTIONS_HC_V4_REVERIFICATION_LEDGER_2026_07_06.md`.
  Residual (small, non-blocking): parameterize the extractor's hardcoded `pdf_path`; stamp the PDF
  locator into HC rows' evidence items in a later owner-attested pass.
- **`dichlorobenzene_1_2` current_default** is IRIS-1989 0.09 but the recency rule wants HC-2025 0.43 --
  a real inconsistency awaiting an owner newer-vs-more-protective call.
- **PCB policy** (`total_pcbs_aroclor_1254` default + `pcbs_non_coplanar` wiring) and
  **`phenylmercuric_acetate`** ContaminantClass -- policy decisions, not build gaps.
- Confirm-after-fact: cadmium 0.0008 + methylmercury 0.0002 current_defaults (applied despite a hold
  flag; picks defensible). benzo_a_pyrene remains HELD.
- **Future catalog source to ingest (owner-flagged 2026-07-06):** `2026 Ontario MECP TRVs.zip` at
  `G:\My Drive\SABCS - Sediment Project\References\2026 Ontario MECP TRVs.zip` -- add Ontario MECP TRVs
  + other parameters to the catalog in a later lane (per-source provenance, needs_review-then-promote,
  same discipline as HC/EPA). Not started.

### 2026-07-04 -- From the MO current_default / provenance-guard lane

Surfaced during the current_default selection + provenance-guard session (PRs #512-#515; #516 closed
unmerged). See docs/LESSONS.md 2026-07-04 entry and the session handoff (#515).

- **HC v4.0 (2025) catalog-wide re-confirmation -- CORRECTED and COMPLETED 2026-07-06.** The original
  framing here (HC values extracted from a now-dead canada.ca page, unverifiable) was WRONG: the real
  source PDF (`C:\Users\jasen\Downloads\HC 2025 - Toxicological Reference Values TRV.pdf`) still exists
  and was the actual source of the original May 2026 extraction. Worse: #513's chlorobenzene "fix,"
  cited here as evidence the mis-file class was real, turned out to be based on an unverified theory --
  direct PDF verification (2026-07-06, confirmed independently twice) shows chlorobenzene's 0.43 Oral
  TDI was never actually wrong. A row-level, type-and-qualifier-aware catalog-wide cross-check of all
  111 HC-v4.0-sourced rows against the real PDF is now COMPLETE -- see
  `docs/MATRIX_OPTIONS_HC_TRV_V4_CROSSCHECK_2026_07_06.md`: **zero confirmed catalog errors found**
  beyond chlorobenzene (already corrected). 6 rows remain AMBIGUOUS (genuine source-document
  population/exposure-scenario variants the catalog doesn't yet disambiguate -- zinc age-stratified UL,
  methylmercury/vinyl_chloride population variants, one benign manganese extractor quirk); none require
  a catalog edit. #513's chlorobenzene review_notes/qa_status are corrected; any `current_default`
  change is deferred to owner sign-off per the no-default-promotion rule.
- **Owner-gated value decisions still open:** benzo_a_pyrene (HELD), phenylmercuric_acetate (organomercury),
  PCBs (overlap w/ total_pcbs_aroclor_1254), and ~22 jurisdiction-conflict current_default picks. These
  need owner judgment (source priority / receptor), not autonomous promotion.
- **1,2-DCB is NOT quarantined.** #516's quarantine was wrong (based on superseded HC 2010); do not
  re-open a 1,2-DCB quarantine without a CURRENT (v4.0) source justification.
- **Manifest vitest fact -- RESOLVED via PR #517 (2026-07-05b).** facts.testing.vitest_test_count is now
  5080 on main, with the prior 5019 snapshot correctly moved to facts_history. No action needed.

### 2026-06-02 -- From the engine_v2 S4 Tier-explainer neutralization pass

Deferred during the memo Tier-explainer neutralization (the pass that reworded the
`src/lib/engine-v2/memo_builder.ts` Tier explainers so no memo claims tier-scaled AI
authority, and made the memo cache regenerate on a generator-version bump). See
`docs/engine_v2_frontend_s4_read_side_handoff_2026_06_02.md`.

- **Legacy memo column-header wording ("AI Suggestion" / "AI Flag") leans determination-voice.**
  For legacy 0.0.1 memos the builder still prints the column headers "AI Suggestion" (Tier 1)
  and "AI Flag" (Tier 2); the 0.1.0 evidence-status path already uses the neutral "AI Evidence
  Signal" header. Relabelling the legacy headers (for example to "AI signal (legacy)") is a
  small, separable cleanup that was deliberately scoped out of the neutralization pass -- that
  pass corrected the explainer prose across both schema versions but left the legacy data-shape
  headers untouched to avoid changing the legacy render path.
  - **Source:** Tier-explainer redesign memo (`engine_v2/docs/MEMO_TIER_EXPLAINER_REDESIGN_2026_06_02.md`) section 4.2; 2026-06-02 S4 lane.

### 2026-04-20 — From documentation audit (Phase 1a) and reference-doc pass (Phase 3b)

Items surfaced by `docs/_meta/DOCUMENTATION_AUDIT_2026-04.md` and the Phase 3b reference-doc survey that were not addressed in the April 2026 documentation pass. These are candidates for a future documentation or code session.

- **Code-side hardcoded Regulatory-Review paths.** `src/app/api/regulatory-review/projects/route.ts`, `.../projects/[id]/extract/route.ts`, `.../search/route.ts`, and `src/lib/regulatory-review/launch-evaluation.ts` embed workspace-relative paths (including a default that points at `C:/Projects/Regulatory-Review/engine`). Audit flagged these; remediation is a code change (likely env-var migration) rather than a documentation change and was kept out of the doc pass.
  - **Source:** audit §1.3 ("Dashboard-side hardcoded RR paths") and §1.7 P1/P2 list.
- **Regulatory-Review repo stale-path and internal-contradiction flags.** Audit enumerated stale `F:\` paths and internal contradictions inside RR's own docs (direct DB read vs. local DB copy claims, etc.). Dashboard-side docs no longer cite stale RR content, but the RR repo has not been updated.
  - **Source:** audit §1.4 cross-repo integration review. Out of scope for the dashboard repo.
- **`docs/README.md` legacy index.** `docs/INDEX.md` already flags `docs/README.md` as legacy. The audit did not decide whether to archive it or re-homogenize its content into INDEX. Decision deferred.
  - **Source:** audit §1.1 inventory and §1.7 P2 list.
- **Upgrade-plan / roadmap planning artifacts at repo root.** `UPGRADE_PLAN_A_GRADE.md`, `UPGRADE_QUICK_START.md`, `EXECUTIVE_SUMMARY.md`, `ROADMAP.md`, `STATUS_REVIEW_2026-01-25.md`, `IMPLEMENTATION_LOG.md`, `.github/PHASE_CHECKLIST.md`, `.github/UPGRADE_TRACKING.md` embed grades and phase-completion claims. They are preserved as historical planning artifacts per INDEX.md but have not been individually date-stamped or archived.
  - **Source:** audit §1.1 inventory. Out-of-scope for the 2026-04 pass.
- ~~**`MONITORING_BASELINE.md` reference from `docs/AGENTS.md`.**~~ RESOLVED 2026-07-20: the reference in `docs/AGENTS.md:55` now points at `docs/review-analysis/archive/MONITORING_BASELINE.md`, which is where the file actually lives.
  - **Source:** Phase 3a codex-review finding.
- ~~**Pyramid-navigation implementation.**~~ RESOLVED 2026-07-20: **superseded, not abandoned.** `docs/regulatory-review/PHASE1_PYRAMID_NAVIGATION_IMPLEMENTATION.md` proposed `pyramidHierarchy.ts` + `PyramidNavigation.tsx`, and those files correctly do not exist -- the concept shipped **inline** instead, in `src/app/(dashboard)/regulatory-review/[submissionId]/ReviewDashboardClient.tsx` under the section header "Stage Group Definitions (Pyramid Navigation)" with a `StageGroup` interface. The proposal doc is retained as historical design context; no code work is outstanding.
  - **Source:** Phase 3b survey, 2026-04-20; resolved by direct probe 2026-07-20.
- **Submission-search performance.** `src/app/api/regulatory-review/submission-search/route.ts` does a full in-memory JSON scan of `assessments.evidence_found`. Acceptable for the current data size; the chat/search enhancement plan notes this becomes a problem past ~1K assessments and suggests a denormalized search table or SQLite FTS index in a later phase.
  - **Source:** `docs/regulatory-review/CHAT_AND_SEARCH_ENHANCEMENT_PLAN.md` Phase B notes.
- **`.env.example` comment-only drift.** `REG_REVIEW_EXTRACTIONS_PATH`, `REG_REVIEW_OUTPUT_PATH`, `REG_REVIEW_TEMP_UPLOAD_PATH` are commented in `.env.example` but are not read by any code in `src/` or `scripts/` (verified 2026-04-20). Either wire them up or remove them.
  - **Source:** `docs/ENVIRONMENT_REFERENCE.md` §"Variables in `.env.example` that are not currently consumed".

### 2026-07-20 -- Matrix Map centroid publication preflight

- **Matrix Map publication is blocked pending a centroid-publication POLICY ruling.** The next owner
  decision here is policy/product, **not** execution. A read-only preflight before any flip found
  that the 4 candidate "surveyed" DRAs are in fact mixed-tier (28 high + 1169 medium = 1197 samples).
  `matrix_map.flip_dra_public` updates only `dras.public`, and RLS `samples_authenticated_select`
  gates on `d.public = true OR has_private_grant(d.id)` without ever consulting `samples.public` --
  so visibility is DRA-granularity and flipping those 4 would publish all 1197 samples (40 -> 1237
  member-visible), including 1169 centroid-tier on just 4 distinct coordinates. No publication was
  performed. Deferred until the owner rules between: no publication now (recommended interim),
  Option C site-level aggregate layer, a tier-aware visibility design, Option B accepted knowingly,
  or Option D OCR-first.
  - **Source:** `docs/MATRIX_MAP_CENTROID_PUBLICATION_DECISION_PACKET_2026-07-20.md` (correction
    banner + corrected sections 5, 8, 9); preflight session 2026-07-20 against `origin/main` b6f0291f.
- **`matrix_map.samples.public` is present but unconsulted.** Neither policy on the table
  (`samples_authenticated_select`, `samples_admin_all`) references it. Whether the column is
  vestigial or intended-but-unwired is unresolved, and it must be settled before any tier-aware
  visibility design is built on top of it.
  - **Source:** same preflight session; `pg_policies` inspection 2026-07-20.
  - **REFINED 2026-07-20 (later session):** "unconsulted" was imprecise and understated the hazard.
    `matrix_map.fetch_samples_with_hidden_summary` DOES reference `s.public` -- but only in a SELECT
    projection list; every gating predicate in that function uses `d.public` or
    `has_private_grant(d.id)`. So the column is **read and returned to clients while having zero
    effect on what is returned.** That is a trap, not merely dead weight: an implementer who sees it
    in the payload may assume writing it restricts visibility. Resolve by either wiring it
    deliberately (policy change + review) or removing it from the projection.

### 2026-07-20b -- Option C site-aggregate design

- **NEXT AUTONOMOUS-SAFE ITEM: Option C design review, not any DRA flip.** A design-only doc for the
  site-level aggregate layer now exists. The next step is a strategic `/codex-review` of that design
  plus an owner ruling -- explicitly NOT an implementation and NOT a publication. No `flip_dra_public`
  call is authorised by anything in this lane.
  - **Source:** `docs/design/matrix-map/OPTION_C_SITE_AGGREGATE_DESIGN_2026-07-20.md`.
- **Owner ruling required on aggregate publication semantics: shape (a) vs shape (b).** Shape (a)
  derives aggregate visibility from existing DRA visibility -- read-side only, no new state, but it
  renders only 4 markers today and does not solve the actual problem. Shape (b) publishes a site
  aggregate independently of its samples -- this is the shape that delivers Option C's value (118
  markers, zero centroid sample rows exposed) but requires a NEW audited publication primitive,
  new RLS, and a new enforcement trigger. Recommended: (b), gated on the reviews below.
  - **Source:** same design doc, section 5.5.
- **Aggregate-oracle hazard must be designed in from the start.** An aggregate over rows the caller
  cannot see is an information channel. Per `feedback_bbox_scoped_private_aggregate_is_a_spatial_oracle`
  (codex P1, 2026-06-23), counts must be computed over a fixed, caller-independent grouping, and the
  endpoint must not accept caller-supplied bbox/radius/filter parameters that scope hidden-row
  counts. This is the item most likely to fail review if retrofitted.
  - **Source:** same design doc, section 6.3.
- ~~**Cheapest useful next deliverable: the admin preview.**~~ **SHIPPED 2026-07-20** as a read-only
  admin page at `/admin/matrix-map/site-aggregates`, backed by the pure helper
  `src/lib/matrix-map/siteAggregates.ts`. Renders the summary + a per-site table over all 118
  centroid sites. Publishes nothing and contains no write path.
  - Built as a **server component, not an API route**: with no HTTP endpoint there is no surface
    that could accept a caller-supplied bbox/radius/filter, so the oracle constraint (design s6.3)
    is satisfied structurally rather than by validation. A route would only be needed if a future
    client-rendered map has to fetch these over HTTP -- and it must carry the same no-parameter rule.
  - ~~**Follow-up still open: the map render.**~~ **SHIPPED 2026-07-20 (PR #712, open).** The Leaflet
    layer now draws the 118 sites as one marker each, with the dash-array centroid encoding, a legend
    entry, per-site popups (tier + counts + the honest caption), and marker size clamped so N=1 stays
    legible and N=476 does not read as area. Markers are derived server-side; the client map receives
    only the marker projection, so no sample row crosses to it.
  - **Admin-tier e2e** for the preview shipped 2026-07-20 (separate PR this session): skip-safe in
    base projects, fail-loud in `chromium-admin-auth`, asserting the read-only guarantee and no
    publish control.
  - **Consolidated owner decision packet:** `docs/MATRIX_MAP_OPTION_C_OWNER_DECISION_PACKET_2026-07-20.md`
    -- one place for the centroid-publication call (no publication now / Option C / B / D), plus the
    two sub-questions Option C forces (shape a vs b; `samples.public` disposition).
  - **Source:** design doc section 5.7; implemented 2026-07-20 across PRs #711, #712, e2e + docs PRs.
- **Resolved for the record:** prior-design risk R2 (direct `UPDATE dras SET public` bypassing the
  audited RPC) is CLOSED -- trigger `trg_dras_public_flip_only` (`enforce_dras_public_via_flip`)
  exists and is enabled. Any new publication primitive needs an equivalent enforcement trigger.
  - **Source:** `pg_trigger` inspection 2026-07-20; supersedes the open framing in
    `docs/design/matrix-map/DRA_PUBLICATION_PATH_DESIGN_2026_07_11.md` R2.

### 2026-07-20c -- Option D coordinate-upgrade design

- **NEXT ITEM (owner-gated, design only): Option D pilot decision.** A design-only doc for the DRA
  coordinate-upgrade lane now exists. The next step is a strategic `/codex-review` of that design
  plus an owner ruling on the pilot gates -- explicitly NOT an extraction, an OCR/vision run, an AGY
  call, a coordinate write, or a publication. The lane stops at a dry-run evidence artifact.
  - **Source:** `docs/design/matrix-map/OPTION_D_COORDINATE_UPGRADE_DESIGN_2026-07-20.md`.
- **Standing blocker to resolve before ANY apply: well-id -> sample-row mapping.** The mapping key is
  `samples.display_name` (the printed label, e.g. `SED11-137A`), NOT `station_id` (the BN-RRM integer
  surrogate). The prior Site 14764 OCR extracted monitoring wells (`MW08-3`), a different feature
  class than the sediment sample rows -- likely why the mapping was "unverified". The pilot must
  extract the same feature class and match on `display_name` under `source_dra_id`.
  - **Source:** same design doc, sections 8 and 10.1; `docs/MATRIX_MAP_DRA_COORD_APPLY_READINESS_2026_07_14.md` s3.
- **Recommended pilot: r-0074 (`90d54294`), one DRA only,** with a Step-3a text-table go/no-go (its
  coordinates may be map-embedded); OCR is a separate owner gate. The obsolete `generate_sql` writer
  in `extract_dra_coordinates.py` is quarantined and out of scope.
  - **Source:** same design doc, sections 6 and 10.1.

### 2026-07-20d -- Option D r-0074 text-first pilot: NO-GO (owner gate pending)

- **The r-0074 text-first pilot ran read-only and returned NO-GO; next step is an owner decision, NOT
  an OCR/vision run.** Two blockers: (A) the source HHERA has no machine-readable coordinate table --
  its coordinate content is map figures ("UTM Zone 10 NAD83" legend only, no textual values); (B) the
  24 `SED11-*` sediment sample stations appear ZERO times in the text layer (its figures show
  boreholes/monitoring wells, a different feature class; text-layer diagnostics only cannot rule out
  raster/vector figure content), so the `SED11-*` coordinates most plausibly live in the original
  2011 sediment report, not `bnrrm_doc_id 351`. No coordinate/Supabase write, no OCR/vision, no
  publication occurred.
  - **Recommended next gate:** confirm the correct source document (cheap, read-only) before any
    OCR/vision spend; r-0074 is not viable text-first from this source.
  - **Source:** `docs/design/matrix-map/OPTION_D_R0074_PILOT_EVIDENCE_2026-07-20.md`.

### 2026-07-21 -- Option D r-0074 source-document check: text-first NO-GO across the site file

- **The source check is complete: `SED11-*` coordinates are NOT text-extractable from any document
  in the r-0074 site file (19661).** A read-only text-layer scan of all candidate source PDFs --
  including the full 2932-page master Stage 1&2 PSI/DSI/COR compilation -- found the `SED11-*` 2011
  sediment labels zero times, with zero `SED11`+UTM co-occurrence. The site's own investigations use
  `BH`/`MW`/`SE` naming (2015-2020, project T17-035) and reclassified its sediment samples
  (`SE19-*`/`SE20-*`) as soil. The `SED11-*` source is therefore raster-only in the HHERA or an
  external 2011 study not filed under site 19661. No OCR/vision/write/publication occurred; AGY not
  invoked (no text table found).
  - **Recommended next gate:** pick a different DRA pilot whose stations appear as a text-layer
    coordinate table, OR accept centroid `medium` tier for r-0074. OCR of this site file has low
    expected yield.
  - **Source:** `docs/design/matrix-map/OPTION_D_R0074_SOURCE_CHECK_2026-07-21.md`.

### 2026-07-21b -- Option D next-pilot selection: no clean text-first GO; the HHERA path is exhausted

- **Ranked the remaining located Option D candidates; none is a clean single-source text-first GO.**
  Read-only text-layer probes: Howe Sound (052c6a9d, 198 stn) NO-GO (HHERA = chemistry + dive
  narrative, no coordinate table); Site 14764 (e6c0df6d, 49 stn) NO-GO (`SED09` sediment labels never
  co-occur with coordinates; the doc's UTM is `MW` wells); Lot C (578bab5d, 114 stn) NO-GO text-first
  but the STRONGEST OCR candidate -- its full borehole-log set (`Appendix G`, 410 pp, 52 `MW*` ids
  incl. MW21/22 matching samples) is mostly RASTER (only 89 pp have text; the `Well location:`
  coordinate field is not text); only one anomalous 2024 log (p28 `MW/SV24-29S`) has text coords.
- **Systemic finding:** the DRA source docs BN-RRM extracted from are HHERA/ERA risk assessments,
  which carry CHEMISTRY tables, not station COORDINATE tables. Coordinates live in companion DSI
  borehole LOGS -- but those are usually RASTER (need OCR of the `Well location` field), not a text
  parse. A crude UTM regex is unreliable here (lab sample IDs false-match).
- **Recommended gate:** if the owner authorizes a bounded OCR run, Lot C `Appendix G` is a
  high-confidence OCR pilot (structured logs, ids already matching `display_name`); else accept
  centroid tier now. No write/OCR/vision/publication occurred; AGY not invoked.
  - **Source:** `docs/design/matrix-map/OPTION_D_NEXT_PILOT_SELECTION_2026-07-21.md`.

### 2026-07-21c -- Option D Lot C OCR pilot: NO-GO, OCR not warranted; text-first + log-OCR exhausted

- **The Lot C Appendix G OCR pilot was NOT run -- its premise was falsified read-only first.** (A) The
  well logs carry no surveyed coordinates: 35/35 ESdat logs with a `COORDINATES` field say "Not
  Surveyed" (p356 MW21-01), and older MW10 logs use a narrative `Well location`. (B) Appendix G is the
  wrong target: 100/114 Lot C samples are `SED*` SEDIMENT stations (mostly `SED11-*`, same 2011 family
  as r-0074), not the 3 monitoring wells the logs cover. OCR would only re-read "Not Surveyed". This CORRECTS the
  PR #718 "best OCR candidate" call. No OCR/write/publication; AGY not invoked.
- **Option D status:** HHERA text-first, next-pilot text-first, and borehole-log OCR are all
  exhausted. `SED11-*` (r-0074 + Lot C) is a shared 2011 sediment dataset with no coordinate source in
  the located corpus.
- **Recommended gate:** accept centroid `medium` tier and close the coordinate-upgrade effort (no
  surveyed coordinate data was found for these stations in the located corpus), unless the owner can
  provide the original 2011 sediment study.
  - **Source:** `docs/design/matrix-map/OPTION_D_LOTC_OCR_PILOT_2026-07-21.md`.

### 2026-07-21d -- Top-50 continuation: deploy-health check shipped + batched owner gates

- **Executed:** Top-50 row 2 (deploy-health) shipped as PR #721 -- read-only `GET /api/health` SHA
  probe + `check-prod-sha-drift.mjs` drift checker (build-only; CI wiring/alerting is owner row 2b).
  Row 36 (`LESSONS.md`) refreshed with the Option D premise-first extraction lesson.
- **Retired/verified:** rows 35/37/43 already fixed via PR #706 (no-op); Option D coordinate rows
  (13,14,15,46) closed by the owner ruling; publication rows (1,3,5,25) owner-ruled (no centroid
  publication now); row 28 retracted 2026-07-20 (deliberate forward-declares, not a coverage gap).
  Row 8's stale text lives in an external `~/.claude/plans/` file.
- **Owner gates (batched):** row 17 -- the public DRA `c2284286` (IOCO T1 data-report, doc 7) has 0
  samples because its samples are on the sibling ERA DRA `ea15e94a` (doc 6); harmless companion doc,
  owner decides leave-published vs unpublish (`flip_dra_public`, owner-only). Plus row 2b (wire the
  drift check + alerting) and row 8 (external plan-doc edit).
  - **Source:** `docs/TOP50_CONTINUATION_STATUS_2026-07-21.md`.

### 2026-07-21e -- Top-50 owner rulings: Sentry parked, Row 44 deferred/relabel, Row 19 parked, prod-health docs-only drift

- **Row 6 / Sentry -- PARKED (owner ruling 2026-07-21).** Do NOT set up Sentry: no tokens/users/
  integrations, no secret inspection/setting, no GitHub/Vercel Sentry values, and no `next.config.ts`
  `silent:!SENTRY_DSN` cleanup PR -- unless the owner explicitly reopens the lane. The wiring facts +
  what-to-set guidance remain captured in `docs/design/SENTRY_CI_SECRETS_WIRING_PACKET_2026-07-21.md`
  for when/if reopened.
- **Row 44 / submission-search FTS -- DEFERRED + RELABELED (owner ruling 2026-07-21).** The prod URL
  space is routable but the feature is admin / local-dev SQLite. Defer FTS implementation until a
  measured >1K assessments or reviewer latency. Prefer engine_v2 Postgres FTS convergence long-term;
  Option A (SQLite FTS5) only if an interim implementation is later triggered. Lane relabeled
  `MO -> reg-review` in `docs/SSTAC_TOP50_RECONCILED_2026_07_20.md`. Design:
  `docs/design/SUBMISSION_SEARCH_FTS_DESIGN_2026-07-21.md` (PR #727).
- **Row 19 / P28 357-row verify-vs-primary sweep -- PARKED (owner ruling 2026-07-21).** No
  vision/source-access sweep. The 357-row inventory already exists
  (`docs/MATRIX_OPTIONS_P28_VERIFY_WORKLIST_2026_07_12.md`); remaining work is per-value
  vision-vs-primary verification + owner-gated promotion.
- **Row 2b / prod-health -- docs-only drift no longer hard-fails (PR #729, pending merge).** The
  scheduled prod-health check (`.github/workflows/prod-health.yml`) is updated so "production behind
  main" is GREEN when every path changed between the deployed SHA and main is Vercel-ignored
  (docs/scripts/supabase/e2e/*.md, per `vercel.json`), classified by a new
  `scripts/verify/classify-drift-paths.mjs`. It still HARD-FAILS on app/runtime-affecting drift (a
  real pending deploy) and on UNREACHABLE. This fixes false alarms after docs-only merges (which
  Vercel intentionally does not deploy). Lands with PR #729; the classifier/workflow support is not on
  `main` until that merges.
  - **Source:** owner rulings 2026-07-21 (Top-50 owner-packet cleanup batch); PR #729.

### 2026-07-22 -- SSTAC Graphify/KB wiki phase-state audit + Phase 3.5 owner gate

- **New Top-50 item: SSTAC Graphify/KB wiki phase-state audit + Phase 3.5 owner packet.** This is
  SSTAC-Dashboard's OWN `tooling/wiki` Graphify/LLM-wiki pilot -- NOT the Regulatory-Review KB.
  Audited 2026-07-22 at `origin/main b493f8c7`: Phases 0-3.5 code/tooling are fully LANDED and match
  the plan EXCEPT for the flagged drift (D1-D3 in the audit; D1 is a safety gap) (all ports + bounded
  enhancements + tests; `/sync-wiki` skill shipped in #731), and the deterministic **test suite passes
  48/48** under plain Python (stdlib-only, no graphify). Phases 4-7 are confirmed fully UNLANDED (no Ollama third-lane, no nightly scripts, no
  `.claude/settings.json` hooks, no graphify MCP, no committed wiki) -- correctly gated behind Phase
  3.5. [SUPERSEDED 2026-08-06 for three of those clauses: nightly scripts, `.claude/settings.json`
  hooks, and a graphify MCP registration all now exist. Only "no Ollama third-lane" and "no
  committed wiki" still hold. See the 2026-08-05 entry below and
  `docs/WIKI_KB_OPERATIONS_2026_07.md` sections 1 and 12.] **Row 9 (land `/sync-wiki`) is DONE (#731).**
- **Phase 3.5 go/no-go is the open owner gate (Top-50 row 48).** Three options: STOP-HERE (default;
  keep only the deterministic on-demand layer), PROCEED to Phases 4-7 (only on affirmative evidence:
  healthy smoke metrics AND the wiki demonstrably helped real work AND priority re-affirmed vs Matrix
  Options), or ABANDON. Recommendation: STOP-HERE unless the evidence conditions are met.
- **Row 10 clarified:** whether SSTAC's guarded first build + ledger seed actually RAN is owner-
  verifiable only from the local untracked `graphify-out/`/`wiki/`/`promotion.json` (gitignored by
  design); the passing tests do not substitute for that.
- **Flagged drift D1 (safety):** `tooling/wiki/sync_wiki.ps1` calls `graphify update` DIRECTLY,
  bypassing the plan-mandated `Invoke-GraphifyGuarded` timeout wrapper -- recommend a small fix PR
  before any Phase 3.5 "proceed" or live graph build. (Code change; owner-authorize separately.)
  - **Source:** `docs/design/GRAPHIFY_KB_WIKI_PHASE_STATE_AUDIT_2026-07-22.md` (this session).

---

### 2026-08-03 -- Matrix Options cross-lane documentation recovery pass

Surfaced while re-verifying the whole Matrix Options / Matrix Map lane against `origin/main`
`9e5012670c5efed942a196aeb71584f7d77a4f1b`. Current lane status is now
`docs/MATRIX_OPTIONS_STATUS.md`; these are the items that pass deferred.
**Source:** the 2026-08-03 cross-lane `/update-docs` run
(`.tmp/mission-control/cross-lane-update-docs-20260803/`).

1. **Option C repository-versus-database drift (OWNER-GATED).** The Option C D2 lifecycle schema is
   LIVE (applied 2026-08-01, tables and required function signatures postflight-verified -- counts
   in manifest `facts.option_c_d2_apply`) but has NO committed migration: no file under
   `supabase/migrations/` references `site_aggregate`. The SQL
   exists in-repo only as draft under `docs/design/matrix-map/`. Deferred because
   `supabase/migrations/` is append-only and protected, and writing a migration that creates
   already-existing objects has migration-history implications the owner must rule on.

2. **Supabase advisors were not collected for the D2 acceptance.** Security and performance
   advisors were unavailable in both executor surfaces and were explicitly NOT substituted; no
   advisor result is claimed. Deferred to an explicit pre-publication follow-up once a
   project-scoped advisor surface is configured.

3. **Mobile read-only summary for the Matrix Map (PR-MAP-17b) is unimplemented.** The current
   sub-768px experience is a fallback banner that documents itself as a temporary shim. A
   repository-wide search found no implementation file. Whether it remains mandatory v1 scope is an
   open owner decision ALREADY recorded in `docs/INDEX.md` ("That scope question is an OPEN owner
   decision", added 2026-07-26) and re-confirmed by the 2026-08-03 pass:
   `docs/design/matrix-map/PLAN_V3_4_2.md` is LOCKED and lists "Mobile: read-only summary view
   below 768px viewport" under v1 INCLUDES, so de-scoping it would require revising a
   decision-locked plan -- an owner call.

4. **Every catalog equation record remains `needs_review`** (count canonically in manifest
   `facts.matrix_options_catalog.equation_counts`). This is ONE CONCRETE INDICATOR of
   incomplete methodology validation. It is not the whole of that validation gap, and it is not by
   itself the reason calculator outputs are documented as screening-only: clearing those equation
   records alone would NOT lift the broader methodology/validation contract, which holds that
   outputs remain screening-only until the full methodology package and validation gates are
   complete. Deferred pending that package.

5. **Catalog default coverage is thin.** Most substance/pathway/`input_key` slots have no
   designated current default. Coverage must be stated per SLOT, never as a record count against a
   substance count -- those are different units. Numerals are canonically in
   `docs/_meta/docs-manifest.json` `facts.matrix_options_catalog.default_coverage_input_slots` and
   are deliberately not restated here. A substantial minority of records also remain
   `needs_review`, and a third of sources need a currentness review.

6. **Most `docs/MATRIX_OPTIONS_*` files remain unregistered in the docs manifest.** Only a small
   subset is registered. Bulk registration was deliberately not attempted in this pass to keep the
   diff reviewable; it would need its own scoped run.

7. **THREE dated TOP50 priority documents still carry the historical "inhalation parked" Tier 7
   ranking** (`MATRIX_OPTIONS_TOP50_PRIORITY_TASKS_2026_07_13.md`,
   `SSTAC_TOP50_PRIORITY_TASKS_2026_07_14.md`, `SSTAC_TOP50_RECONCILED_2026_07_15.md`; verified
   2026-08-03 by grepping the HEADING `### Tier 7 -- inhalation`, not a bare `Tier 7` string, which
   also matches a non-TOP50 file that merely cites the bucket). The work that ranking deferred has
   since shipped.
   The LATER TOP50 documents do NOT carry it: `SSTAC_TOP50_RECONCILED_2026_07_20.md` already records
   the inhalation calculator as shipped, and the two continuation files do not mention inhalation.
   The three were left unedited because they are dated priority snapshots rather than
   implementation-status authorities. Whether to formally retire the ranking in them is an open
   owner decision.

---

### 2026-08-05/06 -- Wiki runtime auto-follow shipped; seven items deferred

Surfaced while shipping PR #771 (squash-merged as
`a821e51968982c0b3dfe2b40e910e9aac1c112c6`), which added guarded in-wrapper auto-follow of the
serve-gate branch at N0 so the detached Wiki runtime stops going stale after ELIGIBLE merges to
`main` (those not touching the protected pathspec, when the remaining N0 gates pass); protected-path
merges still refuse and leave the runtime stale until a manual repin.
**Source:** the 2026-08-05 wiki runtime auto-follow / bootstrap session and its `/update-docs` run.

1. **TWO independent graphify MCP defects (DEFERRED; one touches the live nightly venv).**
   (a) The CANONICAL runtime's server cannot START. (b) The only existing registration in
   `~/.claude.json` targets the SUPERSEDED `kb-runtime-6bb43b-2026-07-23` worktree, whose venv has
   `mcp 1.28.1` and starts fine -- so it serves a stale graph (build stamp 2026-07-30 / HEAD
   `d298f548`) rather than failing, which is a false-healthy outcome. Repairing the venv does NOT
   fix the registration and vice versa; they must be fixed separately.
   On (a): the CANONICAL runtime's
   `.venv-graphify` has `mcp==2.0.0`, whose `mcp.types` no longer exports `AnyUrl`; graphify 0.9.17
   `serve.py` requires it, so `python -m graphify.serve` exits 1. Root cause is that
   `tooling/wiki/requirements-graphify.txt` pins only the top-level `graphifyy[sql,mcp]==0.9.17` and
   carries an explicit unresolved TODO that transitive pins were never frozen, so `mcp` drifted to a
   new major. Deferred because the fix means pinning a compatible `mcp` in the LIVE runtime venv that
   the nightly depends on -- that is a scheduled change, not a casual one.

2. **Protected-pathspec refusal is LIVE, and committed wiki output would widen it (BLOCKS Phase 7
   graduation).** The pathspec that gates auto-follow is seven paths: `wiki`, `tooling/wiki`,
   `.gitignore`, `.graphifyignore`, `AGENTS.md`, `.gitattributes`, `tooling/.gitattributes`. FOUR
   are tracked today (`tooling/wiki` at 44 files, `.gitignore`, `.graphifyignore`, `AGENTS.md`), so
   any merge touching those already makes auto-follow refuse (`REFUSED_TOOLING_CHANGE`) and
   hard-fail the night until an operator manually repins -- PR #771 itself was such a merge. This is
   a live operational cost, not a future one; plan a bootstrap alongside any such merge. Separately,
   if `wiki/` ever becomes tracked it joins that class, so graduation to committed wiki output must
   resolve the pathspec interaction FIRST.

3. **Two unaudited scheduled tasks are in `Ready` state.**
   `SSTAC-Wiki-FirstNightly-Verify-20260724` (one-time trigger already in the past,
   `LastTaskResult 2147946720`) and `SSTAC-Wiki-Nightly-Streak-Verify` (daily 06:15 trigger, never
   run, empty `NextRunTime`). Both point at scripts under `C:\tmp\sstac-kb-post750-20260723\`, which
   still exist. Deferred because scheduled-task changes are owner-gated; neither was created or
   audited by this session.

4. **Phase 7 needs BOTH 10 counted nights AND semantic having run on at least 5 of 10.**
   Contract D is deterministic-only and cannot satisfy the semantic half, so banking deterministic
   nights alone does not graduate. The counted natural streak is at DAY 1 of 10 as of the
   2026-08-06 05:30 nightly. An owner decision on the semantic/Ollama enablement path is required
   before the window can close.

5. **The installed nightly task is an `InteractiveToken` exception, not strict Contract D -- it only
   fires while someone is signed in.** Verified 2026-08-06: the live task XML has
   `LogonType=InteractiveToken`, while `tooling/wiki/activation_preflight.ps1` requires
   `LogonType must be Password` and the Contract D generator refuses to install otherwise. Two
   consequences: (i) STREAK RISK -- a logout, or a reboot without signing back in before 05:30,
   costs a counted night through no fault of the pipeline, which bears directly on item 4's 10-night
   window; (ii) FALSE-UNHEALTHY RISK -- running the documented Contract D preflight against the live
   task reports NON-CONFORMANT on `LogonType`, which is the accepted exception, not a broken task.
   Deferred: switching to `Password` logon is a separate owner-gated change requiring a new
   `TaskDefinitionId` and a fresh activation-preflight cycle.

7. **Live-state facts in these docs are hand-restated in 7-12 places each, with no single source of
   truth.** A 2026-08-06 root-cause review of this document set found that every state claim
   (`mcp==2.0.0`, the protected pathspec, the stale MCP registration, task/streak state) is written
   out verbatim across `LESSONS.md`, `NEXT_STEPS.md`, `WIKI_KB_OPERATIONS_2026_07.md` and
   `docs/_meta/docs-manifest.json` -- so a single correction needs an 11-way edit, while reviews are
   scoped to changed lines and cannot see stale copies in untouched text. That combination produced
   four review rounds whose later findings were almost entirely incomplete propagation rather than
   new facts. PROPOSED FIX (not yet built): emit the live-state facts from a PROBE script into one
   dated generated block (task XML for state/LogonType, `~/.claude.json` for registrations,
   `pip show mcp` per venv, `git ls-files` for the pathspec, receipts for streak/auto-follow), and
   have the prose cross-reference it rather than restate it. Every fact that cost those four rounds
   is machine-checkable in seconds. Also worth folding in: `/update-docs` should emit
   `UNVERIFIED: <what to probe>` rather than prose whenever it cannot back a state claim with a
   probe.

#### Resolved

6. **The auto-follow `REPINNED` path has never executed in production -- the end-to-end proof is
   still outstanding.** Neither 2026-08-06 run exercised it: run `65672054` has no `autofollow_*`
   fields at all (it ran the pre-#771 wrapper), and run `14459a28` recorded
   `autofollow_attempted=false` / `ALREADY_CURRENT` because an out-of-band `git checkout --detach`
   had already repinned the runtime. The first merge to `main` that avoids the protected pathspec
   SHOULD produce the first genuine `REPINNED` receipt, assuming the remaining N0 gates pass.
   CAPTURE THAT RECEIPT -- it is the highest-value outstanding observation for this lane, and until
   it exists the feature is contract-tested only.

   **Resolved 2026-08-08:** The immutable receipt snapshot is recorded in
   `facts_history.session_2026_08_08_wiki_runtime_first_repinned`. That history entry is not current
   authority. Current status and provenance are canonical only at `facts.wiki_runtime.first_repinned`
   in `docs/_meta/docs-manifest.json` and must be reverified before operational use.

### 2026-08-08 -- Wiki correction and recovery reference packets

- **Current counted-window and first-REPINNED status live only in the canonical manifest.** Use
  `facts.wiki_runtime.counted_window` and `facts.wiki_runtime.first_repinned` in
  `docs/_meta/docs-manifest.json`; do not cite `facts_history` as current authority. Reverify the
  live facts before operational use. Activation remains blocked.

- **Manual `/sync-wiki` correction remains candidate-only pending external review and executable
  tests.** The candidate pins runtime-local executables, restores deterministic clustering and
  community-required publication gates, and adds focused helper/sequence tests. It grants no
  activation or commit authority.
- **Graphify MCP repair remains `CANDIDATE_UNVERIFIED`.** The compatible dependency constraint,
  disposable acceptance protocol, exact two-value registration replacement, and rollback contract
  are in `docs/design/wiki/GRAPHIFY_MCP_REPAIR_PACKET_2026_08_08.md`. No package, venv, MCP, or user
  configuration change is authorized.
- **Semantic/promotion remains `NOT_READY_FOR_SEMANTIC_OR_GRADUATION`.** The August 8 frozen packet
  records an inferred-link graph and absent promotion/contradiction state; those observations require
  reverification. Isolated seed preconditions, attended canary, custody requirement, and 10-night
  math are in
  `docs/design/wiki/SEMANTIC_PROMOTION_READINESS_PACKET_2026_08_08.md`. No Ollama, seed, scheduler,
  or canonical-runtime operation is authorized.
  - **Source:** Mission Control correction checkpoint
    `wiki-codex-recovery-20260808-precommit-r1`; both packets are registered REFERENCE documents in
    `docs/_meta/docs-manifest.json` and are non-authoritative.

---

## How to add a new deferred item

Append under a new `### YYYY-MM-DD — Source/session` subheading. Each item should include:

1. A one-line title.
2. 1–3 sentences explaining what is deferred and why.
3. A **Source:** line identifying the document, audit, or session that surfaced the item.

Do not delete historical entries — they are the audit trail. When an item is resolved, move it under a `### Resolved` subheading in the same dated section with the resolving commit SHA or date, but leave the original description intact.
