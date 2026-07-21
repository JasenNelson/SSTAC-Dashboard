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

---

## How to add a new deferred item

Append under a new `### YYYY-MM-DD — Source/session` subheading. Each item should include:

1. A one-line title.
2. 1–3 sentences explaining what is deferred and why.
3. A **Source:** line identifying the document, audit, or session that surfaced the item.

Do not delete historical entries — they are the audit trail. When an item is resolved, move it under a `### Resolved` subheading in the same dated section with the resolving commit SHA or date, but leave the original description intact.
