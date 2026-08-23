# Matrix Options and Matrix Map -- Current Lane Status

**Lifecycle:** AUTHORITATIVE
**Scope:** the Matrix Options and Matrix Map / Option C lane ONLY. This file does NOT claim global
project status; that stays in `docs/INDEX.md`. One bounded exception, flagged here so it does not
read as scope creep: section 5 is a COORDINATION RECORD for the adjacent Wiki-KB / Graphify lane. It
makes no status claim about that lane on this file's own authority -- it relays that lane's supplied
wording, chiefly to record which adjacent claims must NOT be made -- and that lane's authority
remains `docs/WIKI_KB_OPERATIONS_2026_07.md`.

**Declared deviation from `current_status_claims_policy`, stated plainly rather than
reinterpreted.** That policy reads: "Only docs/INDEX.md may claim global 'current project status'
or host volatile metrics." This file complies with the first clause -- it makes no global
current-status claim -- but it DOES deviate from the second: sections 1.1, 2 and 2.1 host volatile
lane metrics. The deviation is deliberate, because a lane status document that cannot state its own
figures is not usable. It is bounded by three conditions: the manifest `facts` block remains the
CANONICAL store and this file defers to it on any disagreement; every figure here carries a
verification date; and the co-update rule in item 4 below names every site that must move together.
If the owner prefers, the durable fix is a lane-scoped carve-out added to
`current_status_claims_policy` itself -- that is a manifest policy change and was not made
unilaterally here.
**Verified against:** `origin/main` `1602652be817ae78feeb37af380a2d4aa80f5e2f`
**Verification date:** 2026-08-23
**Supersedes for CURRENT status:** the dated Matrix Options status snapshots listed in section 6.

---

## 0. How to use this file

This is the SINGLE current-status entrypoint for the Matrix Options lane. It exists because the
lane had accumulated many dated snapshots whose claims had drifted apart and, in several cases,
had been overtaken by shipped code.

Rules:

1. This file states CURRENT lane state, re-verified against source and evidence on the date above.
2. The dated snapshots in section 6 remain valid as HISTORICAL claim lists tied to their own dates.
   Where they contradict this file, THIS file is current and they are not.
3. Every claim below was verified either from source code at the pinned SHA, from a recomputation
   over the actual catalog files, or from a named evidence artifact. Claims that could not be
   verified are marked as such rather than repeated from prior prose.
4. Do not add volatile project-wide metrics here. Lane facts are recorded CANONICALLY in the
   manifest under `facts.matrix_options_catalog` and `facts.option_c_d2_apply`, with provenance.
   This file states those numerals in its section 1 and section 2 tables and, where a passage
   exists to EXPLAIN a figure, in that passage too (sections 1.1, 1.2, 1.3, 1.4, 2, 2.1, 7.2 and
   7.4 -- note section 2 carries the pathway record split in PROSE as well as in its table, and
   7.2 item 2 names the superseded-source count).
   Section 1.4's migration-count denominator is the most volatile figure in this document -- it
   moves on the very next migration added -- so treat it as the first thing to re-derive. That is
   deliberate
   but it means the numerals are NOT single-occurrence within this file: **when a catalog or Option
   C figure changes, update the manifest AND every table and passage here together.** Do not add new
   restatements of LIVE-STATUS figures, and do not copy live figures into other markdown files, per
   the manifest `facts_policy` ban on hardcoding volatile counts across multiple markdown files.

   Two deliberate exceptions:
   - **`docs/INDEX.md`** may carry these figures. The manifest `current_status_claims_policy`
     names it as the ONE file permitted to claim current status and host volatile metrics, so its
     restatement is sanctioned by policy rather than excused by this rule.
   - **Dated historical restatements of a past event** -- the 2026-08-01 acceptance figures
     recounted in the `docs/LESSONS.md` entry, and the counts named in the supersession banners on
     the dated snapshots and in the pre-apply runbook banner -- are permitted, because they record
     what was measured on a specific date and do NOT purport to track current state. They must stay
     date-pinned and must NEVER be updated to track live values; if a figure changes, the historical
     restatement stays exactly as it was.

**Evidence-path caveat (important).** The mission-control evidence artifacts cited below live under
`.tmp/`, which is git-ignored (`/.tmp/` in `.gitignore`) and exists only in the PRIMARY checkout
`C:\Projects\SSTAC-Dashboard`, not in a fresh clone and not in this or any other worktree. They are
untracked local scratch. The durable, in-repository record of the figures they support is the
manifest `facts.option_c_d2_apply` block, which is what survives scratch cleanup. Treat the `.tmp/`
paths as provenance pointers for as long as that scratch exists, not as permanently retrievable
citations.

---

## 1. Matrix Map / Option C -- database and lifecycle state

### 1.1 What is done

The Option C "D2" schema WAS APPLIED SUCCESSFULLY to the live project on 2026-08-01.

**Naming collision, read this first.** "D2" in this section means the Option C LIVE SQL APPLY owner
decision. It is UNRELATED to the catalog owner-decision series D1-D4 (dioxin TEQ promote, BaP
anchor, PCB Option A, BC remap) that appears in the 2026-07 Matrix Options documents. Resolving
Option C D2 resolved NOTHING in the catalog series. Do not restate the catalog series' status here:
its per-item OPEN/CLOSED state, with merge SHAs and per-item verification markers, is the register
in section 8.1. Read that register rather than any prose summary.

- Apply path: one-shot fail-closed pooler controller against the session pooler
  (`aws-1-ca-central-1.pooler.supabase.com:5432`), project `qyrhsieynzfgyuqzznap`.
- Apply receipt status: `GREEN_APPLIED_AND_POSTFLIGHT_VERIFIED`, advisory lock acquired, apply
  attempted once and returned successfully. No retry, no remediation, no migration-history action.
- Evidence:
  `.tmp/mission-control/option-c-d2-readiness-20260731/D2_POOLER_CONTROLLER/receipts/option-c-d2-live-20260801-01.json`
  and `.../D2_POOLER_CONTROLLER/D2_FINAL_ACCEPTANCE_20260801.md`.

**Three lifecycle tables** exist and passed postflight, in schema `matrix_map`:

1. `matrix_map.site_aggregate_publications`
2. `matrix_map.site_aggregate_publication_audit`
3. `matrix_map.site_aggregate_candidate_audit`

**All 15 required function signatures** passed postflight: `expected_signatures: 15`,
`matching_signatures: 15`, `missing: []`, `unexpected_overloads: []`. Note that these 15 are the
full set of required functions, not 15 client-callable RPCs: several are internal helpers and
trigger functions. The 15, all in schema `matrix_map`:

`apply_candidate_audit_publication_id_invariant(text, text)`,
`assert_conforming_dra_cluster_index(text, text, regclass)`,
`blank_trim(text)`,
`canonical_five_decimal_cluster(double precision, double precision)`,
`current_site_aggregate_snapshot(uuid, text)`,
`enforce_site_aggregate_publication_via_rpc()`,
`fetch_admin_site_aggregate_live_preview(uuid, text, integer)`,
`fetch_admin_site_aggregate_publications(uuid, integer, integer)`,
`fetch_published_site_aggregates(integer, integer)`,
`fetch_site_aggregate_candidate_audit(uuid)`,
`fetch_site_aggregate_publication_audit(uuid)`,
`flip_site_aggregate_public(uuid, boolean, uuid, text, timestamp with time zone)`,
`lock_site_aggregate_publication_sources()`,
`site_aggregate_count_bucket(integer)`,
`upsert_site_aggregate_candidate(uuid, text, double precision, double precision, text, uuid, text)`.

**Production admin preview** (admin-shaped projection) showed:

| Measure | Value |
|---|---|
| Aggregate sites | 118 |
| Samples represented | 4418 |
| Distinct coordinates | 118 |
| Map markers | 118 |
| Aggregate-table rows | 118 |

Evidence:
`.tmp/mission-control/option-c-d2-readiness-20260731/D2_POOLER_CONTROLLER/EXECUTOR_TO_MC/0009-final-independent-census.md`.

### 1.2 What has NOT happened

- **Member aggregate publication remains ZERO.** Member-facing evidence recorded published
  aggregate markers 0, Site Aggregates legend count 0, and aggregate-summary match count 0.
- **No candidate has been created and no publication has occurred.** Postflight publications:
  `published: 0, total: 0`. No lifecycle control (create / refresh / publish / unpublish) has been
  invoked against production.
- Schema application is NOT publication. The apply grants no lifecycle-write authority; candidate
  creation, refresh, publish, and unpublish each remain separately owner-gated.

### 1.2a Publication-semantics decision status

The two Option C owner sub-decisions are NOT in the same state, and documentation must not treat
them as a single open question:

- **Publication semantics: RESOLVED IN IMPLEMENTATION.** Shape (b) -- independent aggregate
  publication WITHOUT exposing samples -- is implemented and DEPLOYED as part of the 2026-08-01 D2
  apply. The deployed member path serves published aggregates from
  `site_aggregate_publications` and never touches `dras.public` or `samples.public`. However, shape
  (b) has NOT been EXERCISED: no candidate has been created and no publication has occurred, so
  the deployed path has never actually served a published aggregate.
- **`matrix_map.samples.public` disposition: REMAINS OPEN.** Deploying shape (b) did not decide it.
  Shape (b) is specifically the design that makes aggregate publication independent of that
  disposition, which is why the disposition can still be settled separately.

The dated packet `docs/MATRIX_MAP_OPTION_C_OWNER_DECISION_PACKET_2026-07-20.md` describes both as
open. That is correct FOR ITS DATE and the packet has deliberately not been edited; this section is
the current position.

### 1.3 Why the member aggregate layer is empty

Two independent reasons, and it is important not to confuse them:

1. **By design and currently operative:** the member path calls
   `matrix_map.fetch_published_site_aggregates`, which filters `WHERE is_published = true`.
   `site_aggregate_publications.is_published` defaults to `false` and there are zero publication
   rows, so the member layer returns nothing.
2. **Fail-closed fallback (not currently triggered):** if the member RPC were absent, the loader
   detects PostgREST `PGRST202` and fails closed, returning empty plus a `member_rpc_unavailable`
   error kind rather than dropping back to the wider legacy RLS computation. See the block marked
   "D1(c) FAIL_CLOSED - owner-approved 2026-07-27" in
   `src/lib/matrix-map/fetch-site-aggregates-server.ts`. Because postflight confirmed all 15
   required function signatures are live, this fallback is NOT the current cause of emptiness.

### 1.4 Repository-versus-database drift (IMPORTANT, unresolved)

The Option C tables and RPCs are LIVE in the database but have NO committed migration in the
repository. Zero of the 48 files under `supabase/migrations/` reference `site_aggregate`. The
schema exists in the repo only as draft SQL at
`docs/design/matrix-map/OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql`.

Consequence: a fresh environment provisioned from `supabase/migrations/` alone would NOT have the
Option C lifecycle schema, and the repository does not by itself record what is deployed. This is a
real drift between deployed state and version-controlled state. Reconciling it is an OWNER decision
(section 8.2, item 1) because writing a migration file that claims to create already-existing objects
has its own migration-history implications, and `supabase/migrations/` is append-only and
protected.

### 1.5 R20/R20-C1 controller workstream -- FROZEN, NOT A PRODUCTION PREREQUISITE

The R20 and R20-C1 evidence roots are frozen. No C2, R21, READY marker, or accepted-review receipt
is authorized.

- The final R20-C1 comprehensive review is RED with P0=0, P1=1, P2=0.
- Two AGY process-capable receipts report mechanically consistent 308/308 runs, but they do not
  record the controller or suite hashes at execution time.
- Exact-R20-byte execution provenance is therefore **UNPROVEN**. Post-hoc co-binding does not repair
  that causal gap.
- R20 is not a production prerequisite, is not canary authority, and must not be used in place of
  the attended application path.

Historical R16-R20 artifacts remain evidence for their own bounded runs, not production authority.

---

## 2. Input catalog

The Matrix Options input catalog is **repository-local structured JSON**, NOT a Supabase-backed
catalog. It is imported statically at build time by
`src/lib/matrix-options/provenance/catalog.ts` from `matrix_research/reference_catalog/`
(`parameter_values.json`, `human_health_trv_values.json`, `eco_values.json`, `sources.json`,
`equations.json`). No database client, fetch, or Supabase table is involved on the read path.

Metrics recomputed from the actual catalog files at the pinned SHA on 2026-08-03 (canonical store:
manifest `facts.matrix_options_catalog`):

| Measure | Value |
|---|---|
| Parameter records (total) | 1783 |
| Distinct substances | 561 |
| Pathways | 4 |
| `qa_status` approved | 1312 |
| `qa_status` needs_review | 422 |
| `qa_status` superseded | 49 |
| Current defaults (`default_status = current_default`) | 84 |
| Sources (total) | 43 |
| Sources current | 27 |
| Sources needing currentness review | 15 |
| Sources superseded | 1 |
| Equation records | 5 |
| Equation records still `needs_review` | 5 (all) |

The four pathway identifiers are `human-health-direct` (988 records), `human-health-food` (690),
`eco-direct-eqp` (55), and `eco-food-bsaf` (50).

Every one of these figures was independently recomputed rather than copied forward, and each
matched the previously reported value.

### 2.1 Default coverage (use these figures, not a record-to-substance comparison)

The 84 `current_default` RECORDS must not be compared directly against the 561 distinct substances:
those are different units and the comparison overstates the gap. A default is designated per
substance/pathway/input slot, so the slot count is the correct denominator.

| Granularity | Total | With a current default | Without |
|---|---|---|---|
| Distinct (substance, pathway) pairs | 1104 | 47 | 1057 |
| Distinct (substance, pathway, input_key) slots | 1386 | 84 | 1302 |

**Coverage claim:** 84 of 1386 substance/pathway/input slots (about 6 percent) have a designated
current default; 1302 do not. `input_key` is present on all 1783 records. Both figures were
independently recomputed, and the identities 47 + 1057 = 1104 and 84 + 1302 = 1386 were verified.
Canonical store: manifest `facts.matrix_options_catalog.default_coverage_input_slots`.

---

## 3. Calculators

All nine calculator and evidence surfaces below EXIST in source and are WIRED into the UI at the
pinned SHA. The Matrix Options route is `src/app/(dashboard)/matrix-options/page.tsx`, rendering
`src/components/MatrixDashboard.tsx`, which owns the tab registry.

| Surface | State | Primary implementation |
|---|---|---|
| Eco-Direct EqP | Implemented, wired | `src/components/matrix-options/EcoDirectEqPCalculator.tsx` |
| Eco-Food BSAF | Implemented, wired | `src/components/matrix-options/EcoFoodBSAFCalculator.tsx` |
| Human Health Direct Contact | Implemented, wired | `src/components/matrix-options/HHDirectContactCalculator.tsx` |
| Human Health Food Web | Implemented, wired | `src/components/matrix-options/HHFoodWebCalculator.tsx` |
| Human Health Inhalation | Implemented, wired, fail-closed by design | `src/components/matrix-options/HHInhalationCalculator.tsx` + `src/lib/matrix-options/inhalation/calculator.ts` |
| Cumulative TEQ / BaP-equivalent | Implemented, wired, standalone | `src/components/matrix-options/CumulativeEffectsCalculator.tsx` + `src/lib/matrix-options/cumulative.ts` |
| Background adjustment | Implemented, wired | `src/components/matrix-options/BackgroundAdjustment.tsx` |
| Provenance / value search; References and Values | Implemented, wired | `CalculatorValueSearchPanel.tsx`, `EvidenceLibrary.tsx`, `CalculatorProvenancePanel.tsx` |
| SSD Workbench | Implemented, wired (own top-level tab) | `src/components/matrix-options/SsdWorkbench.tsx` |

### 3.0 PR #791 Frontend Enablement Event (COMPLETE, 2026-08-23)

On 2026-08-23, PR #791 merged into `main` (`1602652be817ae78feeb37af380a2d4aa80f5e2f`, final reviewed
head `af930c2ca6d4be4b9ccd8dc03f9c2a8d0abb3bd2`) delivering an accepted frontend enablement event
supporting Phase 2 / L2 across 50 tracked paths.

Delivered frontend features and polish:
- **Restored full 8-tab top-level registry** in `MatrixDashboard.tsx`: Guide, Modernizing Schedule 3.4,
  Methodology by pathway (`Jurisdictional Frameworks`), TWG Review, Database (`Interactive Map`),
  Calculator, SSD Workbench, and Catalogue (`References & Values`).
- **Restored Methodology by pathway vertical side tabs**: EqP & AVS, Food Web (BSAF), and Human
  Health Pathways, with automatic keyboard activation and `demoteLeadingH1(...)` case-study rendering.
- **Full-fidelity print stylesheets**: Unclipped printing across prose and calculator tabs.
- **Evidence Library QA/QC & Candidate defaults control**: Restored the `Candidate defaults` quick
  review button with explicit `>=44px` two-axis touch targets (`min-h-[44px] min-w-[44px] justify-center`),
  and hardened QA/QC review persistence and deterministic state reduction.
- **Catalogue left-panel toggle**: Corrected toggle logic to evaluate `catalogLeftRailOverride` against
  `prev ?? showLeftPanel` with `showLeftPanel` in the dependency list.
- **A11y and code quality**: Minimum 44px touch targets, verified contrast, pure ASCII character sets,
  and complete six-gate verification suite.

Full continuity record: `docs/continuity/qaqc-polish-pr791/PR791_FRONTEND_COMPLETION_2026_08_23.md`.

### 3.1 Human Health Inhalation is NOT scaffold-only and NOT parked

This corrects a claim repeated across several dated snapshots. `HHInhalationCalculator.tsx` is a
full calculator backed by `deriveInhalationStandards` in
`src/lib/matrix-options/inhalation/calculator.ts`, implementing the EPA/540/R-96/018 Eq. 5/8
VF+PEF combined-transport-factor approach with non-cancer (RfC / HQ) and cancer (IUR / target-risk)
derivation, and provenance wiring to exact catalog `parameter_value_id`s. It renders
unconditionally in the Calculator tab: no disabled state, no placeholder, no feature flag.

What IS true, and is a deliberate design contract rather than an unfinished implementation: per an
owner ruling dated 2026-07-17, VF (volatilization factor) and PEF (particulate emission factor) are
ALWAYS user-supplied and are never seeded, defaulted, or hardcoded. The pathway returns a blocked
state until a required transport factor is provided. Describe this as "implemented, fail-closed
pending user-supplied VF/PEF" -- never as "scaffold" or "parked".

### 3.2 The cumulative TEQ / BaP-equivalent UI IS implemented

This corrects the "A3b cumulative UI unimplemented / blocked" claim.
`CumulativeEffectsCalculator.tsx` is a rendered UI card in the Calculator tab with two sub-tools:
carcinogenic PAHs / BaP-equivalent (`computeBaPeq`, `computeBaPeqLifetime`, with an optional
lifetime ADAF-weighting toggle) and dioxin-like congener TEQ (`computeTEQ`). It provides the
per-congener and per-PAH INPUT GRIDS that A3b was scoped to deliver, including add-row and
remove-row controls and a selectable TEF edition.

The remaining half of the old A3b description is superseded rather than outstanding: registering
`computeTEQ` / `computeBaPeq` in `equationDispatch.ts` was deliberately NOT done. Per the recorded
"Decision D0", these reducers are intentionally not registered in the dispatch table and do not
extend the `ProvenancePathway` union; the component calls them directly. Verified: no reference to
either reducer exists in `src/lib/matrix-options/equationDispatch.ts`.

Consequence to document accurately: the cumulative tool is a STANDALONE screening tool. It does not
participate in the shared `CalculatorProvenancePanel` / frame-variant wiring that the other
calculators use. That is a design choice, not a gap.

### 3.3 Screening-only qualification (PRESERVE THIS)

Calculator outputs are screening-level and this qualification is rendered in the UI at two levels.
Both must be preserved in any documentation:

- Tab-level guide copy in `src/components/MatrixDashboard.tsx`, including
  "Calculator outputs remain screening-only until the full methodology package and validation gates
  are complete" and "Screening-only outputs still require professional judgment".
- Per-calculator result-panel copy, for example "Screening-grade value for options analysis" in
  `HHDirectContactCalculator.tsx` and `HHInhalationCalculator.tsx`.

Implementation completeness of a calculator does NOT imply methodology completeness. See section 7
for the methodology, default, and equation-validation work that remains.

### 3.4 Owner-approved v1 release boundary

The owner approved the following v1 definition on 2026-08-04:

- existing baseline screening calculators only; frame-specific calculator parity is not promised;
- desktop/tablet support at 768px or wider;
- PR-MAP-6, PR-MAP-7, and the mobile read-only summary deferred but retained after v1;
- aggregate publication excluded from v1; and
- any future publication blocked until repository-versus-database migration reconciliation and a
  separate owner-gated publication sequence are complete.

The Cohort 0 baseline-v1 reachability census is recorded in
`docs/design/matrix-options/COHORT0_BASELINE_V1_REACHABILITY_CENSUS_2026_08_04.md`. It covers all
426 selectable substances because no smaller v1 substance set has been selected. It performs no
regulatory-value selection or promotion.

---

## 4. Interactive map

| Surface | State | Evidence |
|---|---|---|
| Standalone desktop map | Exists | `src/app/(dashboard)/matrix-map/page.tsx` -> `MatrixMapLoader.tsx` -> `MatrixMap.tsx` |
| Embedded map in Matrix Options | Exists (Interactive Map tab, server-fetched initial data) | `src/app/(dashboard)/matrix-options/page.tsx` |
| Filters | substance_ids, mediums, qa, date_from / date_to, classification, plus a view-only surveyed_only toggle | `src/stores/matrix-map/filterStore.ts`, `MatrixMapRightPanel.tsx` |
| Selection statistics | Exists | `MatrixMapStatsShell.tsx` -> `MatrixMapSelectionStats.tsx` |
| Measurement workbench | Exists (right panel) | `MatrixDashboard.tsx`, `MatrixMapRightPanel.tsx` |
| Overlays | Base: streets, satellite, topo, terrain. Overlay: parks, conservancy, watersheds, wetlands, ecoregions, bec | `MatrixMap.tsx` `OVERLAY_LAYERS` |
| Option C preview | Exists, admin-gated to roles `admin` and `matrix_admin`, fail-closed on role-query error | `src/app/(dashboard)/admin/matrix-map/site-aggregates/page.tsx` |

### 4.1 Admin preview versus member aggregate layer

These are two different projections and must not be conflated in documentation:

- **Admin preview** exposes raw DRA ids and titles and exact per-tier counts, plus the candidate
  lifecycle controls, through audited SECURITY DEFINER RPCs. It never touches `dras.public` or
  `samples.public`. Its wider admin-shaped projection must never be served to members.
- **Member path** calls `fetch_published_site_aggregates`, which returns opaque ids, neutral
  labels, BUCKETED sample counts (`1`, `2-9`, `10-99`, `100+`), and coordinates rounded to three
  decimals. This bucketing and rounding is the aggregate-oracle mitigation and must be preserved.

### 4.2 Known limitations

- **The member aggregate layer is empty until publication occurs.** See section 1.3. Nothing is
  broken; there are zero publication rows by design.
- **The mobile Matrix Options map still uses a fallback banner, not a map.** Below a 768px
  breakpoint, `MatrixMapMobileFallback.tsx` renders in place of the map with the text
  "Interactive Map needs a wider viewport" / "Use a desktop or tablet (768px or wider) for the full
  interactive map", noting that the other Matrix Options tabs remain fully usable. The component
  documents itself as a temporary shim (PR-MAP-17a), explicitly not the planned mobile experience.
- **The planned read-only mobile summary remains unfinished.** It is specified in
  `docs/design/matrix-map/PLAN_V3_4_2.md` ("Mobile: read-only summary view below 768px viewport")
  and deferred in code to "PR-MAP-17b". A repository-wide search found NO implementation file: it
  does not exist even partially.

---

## 5. Wiki-KB / Graphify

**What this section is, and is not.** It is a COORDINATION RECORD, not a status claim about the
Wiki-KB / Graphify lane. This file does not own, verify, or govern that lane; its authority is
`docs/WIKI_KB_OPERATIONS_2026_07.md`, which this docs lane does not edit. The section exists so that
a reader of the Matrix Options lane knows which adjacent claims are NOT safe to make, and it is
bounded to the four "must NOT be claimed" items below plus the merged-state quotation.

**Source and its durability limit.** The statements below come from that lane's own documentation
handoff, received and integrity-verified on 2026-08-03: SHA-256
`2c93c44fc57f7427eadebadc915c34070645e404884bd56ab9313f00274310c4`, at
`.tmp/mission-control/cross-lane-update-docs-20260803/WIKI_TO_MATRIX_OPTIONS/0002-wiki-response.md`.
That path is UNTRACKED scratch under the git-ignored `/.tmp/` and exists only in the primary
checkout, so the hash is verifiable only for as long as that scratch survives -- the same limitation
recorded for the Option C evidence in section 0. Nothing in this section is load-bearing for the
Matrix Options lane's own status; if the source becomes unavailable, treat this section as expired
and re-request a handoff rather than trusting it. The wording is that lane's own, not a paraphrase.

**Merged state:**

> Wiki-KB/Graphify production hardening through PRs #765 and #766 is merged. It adds exact-root
> process-identity safety, fail-red release/readback and residue evidence, bounded wrapper
> regressions, and documentation-governance coverage. These merged safeguards do not themselves
> rebuild or admit a canonical runtime, enable the nightly scheduler, start a reliability streak, or
> authorize AutoCommit.

Per that lane, relayed and NOT independently verified here: Phase 4-7 Wiki/Graphify infrastructure,
activation-readiness preflight, runtime activation fail-closed checks, Contract A registration
controls, and stale-graph rebuild controls are on `main`; and PRs #765 and #766 each passed the
complete final-tip six-gate suite and GitHub CI before merge. The verification performed here was
of the handoff document's INTEGRITY (SHA-256, encoding), which establishes that the wording is
theirs -- not that the claims are true.

**Unmerged and owner-gated:**

> Wiki/Graphify hardening through PRs #765 and #766 is merged, while runtime admission and
> deterministic-nightly enablement remain a separate unmerged and owner-gated lane.

> The intended first scheduled mode is deterministic-only (`-SkipLabeling -SkipSemantic`). Semantic
> labeling/extraction and AutoCommit are separate later decisions.

The seven-path runtime-admission and deterministic-nightly candidate is uncommitted and under
independent correction/review; it is NOT documentation-authoritative production state.

**Claims that must NOT be made** (last sealed operational state per that lane):

- The Wiki nightly schedule is NOT active. It was last sealed as registered but disabled and never
  run; enablement remains an owner gate after merge-pinned runtime admission and attended proof.
- The Phase-7 reliability streak is NOT underway. The counted natural-night streak remains zero.
- The canonical runtime is NOT live or admitted. One merge-pinned runtime rebuild and admission
  remain pending.
- AutoCommit is NOT enabled or approved; it remains separately owner-gated.

As of 2026-08-03 the Wiki runtime-admission branch was UNMERGED, so this section is bound to
`9e501267`: the claims above describe state merged as of that SHA, or are explicitly labelled as
the unmerged candidate. Re-check this section after that branch merges.

---

## 6. Superseded status snapshots

The following dated files remain valid as historical claim lists but are NOT current status. Where
they conflict with this file, this file is current.

- `docs/MATRIX_OPTIONS_FINALIZATION_STATUS_2026_07_10.md` -- calls inhalation a "fail-closed
  scaffold" and the cumulative A3b input UI a gated deliverable. Both are superseded by sections
  3.1 and 3.2.
- `docs/MATRIX_OPTIONS_COMPLETION_STATUS_2026_07_11.md` -- states "Inhalation: still scaffold-only"
  and lists "A3b cumulative UI" as remaining owner-gated work. Superseded by sections 3.1 and 3.2.
- `docs/MATRIX_OPTIONS_LIVE_STATUS_2026_07_13.md` -- marks inhalation PARKED and the cumulative UI
  OWNER-GATED / blocked. Superseded by sections 3.1 and 3.2.
- `docs/MATRIX_MAP_STATUS_2026_07_11.md` -- predates the Option C D2 apply entirely.

**EXACTLY THREE** priority-queue documents rank inhalation in a "Tier 7 -- deprioritized / parked"
bucket, verified 2026-08-03 by grepping for the HEADING `### Tier 7 -- inhalation`. (A bare
`Tier 7` grep also matches `docs/MATRIX_OPTIONS_LIVE_STATUS_2026_07_13.md`, which CITES the Top-50
bucket rather than hosting it, and which is handled separately above with its own banner.) The
three:
`docs/MATRIX_OPTIONS_TOP50_PRIORITY_TASKS_2026_07_13.md`,
`docs/SSTAC_TOP50_PRIORITY_TASKS_2026_07_14.md`, and
`docs/SSTAC_TOP50_RECONCILED_2026_07_15.md`. That RANKING is historical: the work it deferred has
since shipped. Those three were left unedited because they are dated priority snapshots rather than
implementation-status authorities; treat their inhalation rows as closed.

The LATER TOP50 documents do NOT carry that ranking and need no correction:

- `docs/SSTAC_TOP50_RECONCILED_2026_07_20.md` contains no "Tier 7" bucket and already records the
  opposite -- "07-17 doc '#31 inhalation calculator BUILD IN PROGRESS' -- shipped in `dc26f858`
  (#673)". Merge `d721ce26` and commit `dc26f858` are both ancestors of the base `9e501267`.
- `docs/TOP50_CONTINUATION_STATUS_2026-07-21.md` and
  `docs/TOP50_CONTINUATION_STATUS_2026-07-22.md` do not mention inhalation at all.

---

## 7. Remaining work

Grouped as requested. Items marked OWNER-GATED are decisions, not tasks this lane may take.

### 7.1 Database

1. Reconcile the repository-versus-database drift in section 1.4 before any publication
   (OWNER-GATED). Publication is excluded from v1.
2. Supabase security and performance advisors were unavailable during the D2 acceptance and were
   NOT substituted; no advisor result is claimed. Advisor collection remains an explicit
   pre-publication follow-up once a project-scoped advisor surface is configured.
3. One attended, unpublished application canary may be considered through a separate exact owner
   gate. Candidate creation, lifecycle Refresh Candidate, publish, and unpublish remain distinct
   actions and must not be combined or pre-authorized.
4. R20/R20-C1 is frozen and is not a production prerequisite or a future live gate (section 1.5).

### 7.2 Catalog

Numerals for all four items are in section 2 and, canonically, in manifest
`facts.matrix_options_catalog`. They are deliberately NOT restated here.

1. A substantial minority of parameter records remain `needs_review`, and a small number are
   `superseded`.
2. A third of sources still need a currentness review, and one is superseded.
3. Every equation record is still `needs_review` -- see 7.4.
4. Default coverage is thin at the substance/pathway/`input_key` slot level (section 2.1).
5. Cohort 0 now narrows the release question to baseline-v1 reachable inputs without selecting or
   promoting values. Its exact counts and Cohort 1 decision inputs are in
   `docs/design/matrix-options/COHORT0_BASELINE_V1_REACHABILITY_CENSUS_2026_08_04.md`.

### 7.3 Map

1. Mobile read-only summary (PR-MAP-17b) is unimplemented; the fallback banner is the accepted v1
   limitation below 768px, not a summary view.
2. PR-MAP-6, PR-MAP-7, and the mobile summary are deferred from v1 by the 2026-08-04 owner decision.
   They remain retained post-v1 roadmap work in the amended
   `docs/design/matrix-map/PLAN_V3_4_2.md`.
3. Member aggregate publication has not occurred, is excluded from v1, and is blocked pending
   migration reconciliation plus a separate owner-gated publication sequence.

### 7.4 Calculator

1. Methodology validation is incomplete. All 5 equation records remaining `needs_review` is ONE
   CONCRETE INDICATOR of that, not the whole of it and not by itself the cause of the screening-only
   contract. The contract stated in the UI is broader and stands independently: outputs remain
   screening-only until the FULL methodology package and validation gates are complete
   (section 3.3). Clearing the 5 equation records would therefore not, on its own, lift it.
2. Default-value coverage is thin at the substance/pathway/`input_key` SLOT level (sections 2.1 and
   7.2 item 4). Never state this coverage against the substance count -- records and substances are
   different units.
3. Methodology completeness, not implementation completeness, is the remaining gap across the
   pathways. Implementation being present must not be documented as methodology being settled.
4. The cumulative tool's deliberate standalone status (Decision D0, section 3.2) should be
   revisited only if the owner wants it inside the shared provenance-dispatch machinery; it is not
   currently a defect.

### 7.5 Documentation

1. The Wiki-KB / Graphify documentation handoff has been RECEIVED, integrity-verified, and
   INCORPORATED into section 5 using that lane's own supplied wording. It is not outstanding. What
   remains is on the Wiki lane's side, not this one: it retains exclusive ownership of its seven
   uncommitted paths, including `docs/WIKI_KB_OPERATIONS_2026_07.md`, and its unmerged
   runtime-admission and deterministic-nightly candidate remains separately owner-gated. A
   post-activation documentation update to that runbook is expected later but is not authorized or
   planned in its current branch.
2. Many Matrix Options documents on disk are unregistered in `docs/_meta/docs-manifest.json`. Only
   a small subset is registered. Bulk registration was NOT attempted here.
3. THREE dated TOP50 priority documents still carry the historical "inhalation parked" Tier 7
   ranking (named and verified in section 6). The later TOP50 documents do not and need no
   correction.
4. Catalog D2 and D3 and calculator T33 and T34 are now re-verified and CLOSED as the original owner
   decisions. Their narrower future follow-ups remain separate and do not reopen them (section 8.1).
5. The repository has NO registered current session-to-session continuity anchor. The prior
   `continuity.current_handoff` entry was reclassified to historical REFERENCE in this pass and no
   successor was registered. Tracked in manifest
   `known_issues.no_registered_current_continuity_anchor`. Separately, the 2026-07-30 root handoff
   FILE still asserts that the Option C SQL is unapplied, that D2 is blocked, and that an
   authenticated retest is outstanding -- all resolved by the 2026-08-01 apply. Correcting that file
   was outside this candidate's reviewed scope.
6. **No docs gate covers the Matrix Options source paths.** `src/app/(dashboard)/matrix-options/**`
   (the lane's entry route), `src/lib/matrix-options/**`, `src/components/matrix-options/**`, and
   `matrix_research/reference_catalog/**` appear in no bundle's triggers, so a calculator or catalog
   change activates no documentation gate. Separately,
   `docs-gate.mjs` only checks that required documents EXIST -- it performs no freshness or content
   check, so registration prevents deletion but not staleness. Tracked in manifest
   `known_issues.matrix_options_paths_have_no_docs_gate` with a proposed fix. Widening gate triggers
   changes what future PRs must satisfy, so it is an owner decision, not a documentation change.

### 7.6 Next L2 backend continuation

The PR #791 frontend enablement event is complete, but the durable Phase 2 / L2 backend-data goal
remains ACTIVE. A future L2 session resuming this workstream must:

1. **Reauthenticate live state:** Read `docs/sediment-standards-phase2/PROJECT_PLAN_PHASE_2.md` and
   this status file to verify the current standing of Phase 2 Task 3 Streams A and B.
2. **Identify the first authorized incomplete backend/data unit:** Inspect Tasks 3.1-3.9 in the Phase 2
   project plan to select the next authorized incomplete unit (e.g., Task 3.1 report identification,
   Task 3.3 database structure review, or Task 3.7 input-parameter scope definition). Do not invent
   which subtask is first if current live evidence does not establish it.
3. **Continue backend/data compilation:** Execute the database schema, data compilation, or input-parameter
   work from that defined starting point.
4. **Preserve frontend deliverables:** Avoid reopening or rewriting PR #791 frontend components or
   selectors unless an explicit, reproducible regression is verified.

---

## 8. Decision register and remaining owner gates

### 8.1 Carried forward from superseded documents -- catalog and calculator lane

This file supersedes the dated snapshots in section 6, which means their open items would otherwise
fall off the queue entirely. They are carried forward here so they stay visible.

**Verification status is per-item and is stated explicitly.** Carrying an item forward is not an
assertion that it is still open: CLOSED rows stay visible so later readers do not reopen stale
snapshot claims.

#### Catalog owner-decision register (CATALOG D-series -- unrelated to the Option C "D2" apply)

Two consecutive reviews of this pass each found one already-CLOSED item being carried forward as
open, because the status was being restated in prose from four dated snapshots. This register
replaces that prose. **Check the named current evidence, do not re-read the snapshots.** The
verification date and basis are stated per row.

| Item | Status | Evidence | Verified |
|---|---|---|---|
| D1 -- dioxin TEQ promote | **CLOSED** | Applied + merged PR #627, merge `e4253693`, ancestor of base. Source records it "DONE". | 2026-08-03 |
| D2 -- BaP anchor | **CLOSED** | `docs/STAGE1_DECISION_LOG_2026_07_15.md` records the owner ruling to keep EPA 2.0 with embedded lifetime ADAF; no value write was needed. HC 1.289 future eligibility under a separately reviewed ADAF contract does not reopen D2. | 2026-08-04 |
| D3 -- PCB Option A | **CLOSED** | The same decision log records Option A plus relabel. Later default and dual-screen/TEQ work shipped. Cosmetic Total-PCBs re-key/catalog-row migration remains separately deferred behind QP and exact-write gates; it does not reopen D3. | 2026-08-04 |
| D4 -- BC PAH scheme remap | **CLOSED** | `docs/MATRIX_OPTIONS_COMPLETION_STATUS_2026_07_11.md` records "RESOLVED 2026-07-11d (verified in code) ... No longer an open owner decision. D1-D3 remain open." Shipped PR #541, merge `96f22648`, ancestor of base. | 2026-08-03 |
| IRIS / copper / Protocol 28 arbitration | OPEN (as recorded 2026-07-13) | Same source sentence as D2/D3: "Remaining: D2/D3/IRIS/copper/P28 arbitration." | NOT re-verified |
| PRs #628, #629, #630 | **CLOSED** | All merged in base history (`16e9dd3e`, `995c5ded`, `a463020e`). Also mislabelled as catalog PRs in the source: #628 is security hardening, #629 a DRA coord-extraction harness draft, #630 DL-PCB card copy. | 2026-08-03 |

CLOSED rows are listed deliberately: they are recorded here so the superseded snapshots' stale
"open" rows are not carried forward as live work by a future reader.

#### Calculator task closures

- **T33 unit-basis settle -- CLOSED in implementation.** The calculator contract consumes IUR per
  mg/m3; catalog per-ug/m3 values are multiplied by 1000 exactly once at data wiring, with
  unit-basis tests. Future catalog additions must preserve that contract.
- **T34 inhalation model decision -- CLOSED as the original architecture decision.** The owner
  selected user-supplied VF/PEF. The shipped calculator never seeds or hardcodes either transport
  factor and fails closed until one is supplied. A future intake-based model is separate scope.

### 8.2 Remaining owner action -- database, catalog, and historical documentation

Grouping label only. Some items were newly surfaced here; others were already recorded elsewhere and
are re-confirmed. Provenance is stated per item.

1. **Repository-versus-database drift for Option C.** The lifecycle schema is live but absent from
   `supabase/migrations/`. Decide how to record deployed state without violating the append-only
   migration contract. This reconciliation is required before publication, which is excluded from
   v1.
2. **The `matrix_map.samples.public` disposition.** Still OPEN. Publication semantics is NOT open in
   the same sense: shape (b) is implemented and deployed, though not yet exercised (section 1.2a).
   The dated packet `docs/MATRIX_MAP_OPTION_C_OWNER_DECISION_PACKET_2026-07-20.md` describes both as
   open, which was correct for its date.
3. **Cohort 1 workflow and substances.** Select one baseline workflow and 3-5 owner/QP-chosen
   substances, then bind receptor, endpoints, primary source/version, units, worked example,
   acceptance tolerance, alternate treatment, and fail-closed behavior. The Cohort 0 census makes
   no regulatory selection.
4. **Whether the historical TOP50 "inhalation parked" Tier 7 ranking should be formally retired**
   in the THREE dated files that actually carry it (named and verified in section 6), or left as a
   historical record. The later TOP50 documents do not carry it and are not affected.

---

## 9. Authorities for this lane

- `docs/design/matrix-map/PLAN_V3_4_2.md` -- owner-amended v1 scope authority; retained roadmap
  details remain locked except where the 2026-08-04 amendment explicitly defers them.
- `docs/design/matrix-options/COHORT0_BASELINE_V1_REACHABILITY_CENSUS_2026_08_04.md` -- frozen
  source-derived release-reachability census; no regulatory-value selection or promotion.
- `docs/design/matrix-map/OPTION_C_SITE_AGGREGATE_DESIGN_2026-07-20.md` -- Option C architecture
  authority, including the aggregate-oracle hazard. Architecture only; not an implementation-status
  page.
- `docs/MATRIX_MAP_OPTION_C_OWNER_DECISION_PACKET_2026-07-20.md` -- dated owner decision packet.
  Of its two sub-decisions, only the `matrix_map.samples.public` disposition is still open
  (section 1.2a).
- `docs/design/matrix-map/OPTION_C_PREAPPLY_RUNBOOK_2026_07_26.md` -- owner-run pre-apply
  procedure. It carries a 2026-08-03 status-update banner recording that the apply it governs
  completed on 2026-08-01; the procedure below that banner is the preserved historical record and
  its "unapplied" / "BLOCKED" / "NOT AUTHORIZED" statements describe the pre-resolution state.
  The procedure still authorizes no lifecycle write.
- This file -- current implementation and deployment status for the lane.
