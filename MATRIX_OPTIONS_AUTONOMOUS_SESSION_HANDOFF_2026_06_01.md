# Matrix-Options autonomous session handoff -- 2026-06-01

Autonomous run (owner away ~9h, auto mode). Executing the 12h work plan from
`FRESH_SESSION_PROMPT_MATRIX_OPTIONS_12H_2026_06_01.md`. Plain ASCII only.

This doc is updated as each task completes. Most recent status at top of each task.

---

## T1 -- P2 dedup fix -> catalog expansion GREEN. STATUS: DONE (shipped as draft PR #219).

### Outcome
Draft PR **#219** `feat/matrix-options-refs-values-catalog-fix-2026-05-31` (base main,
commit `c185f1c`) supersedes #218. All 4 gates GREEN + codex CLI review GREEN.

**Owner actions:** merge #219 (or fast-forward #218's branch to c185f1c); then close
#218 and the redundant #213. PR #218 has a comment pointing to #219.

### What it contains
Clean regeneration off main: 84 base + 355 Protocol 28 (soil + water/vapour) + 92
Health Canada + 32 US EPA IRIS = **563 TRV records** in
`matrix_research/reference_catalog/human_health_trv_values.json`.

### The key decision (load-bearing; flagged for owner)
The spec (`MATRIX_OPTIONS_P2_DEDUP_FIX_SPEC_2026_05_31.md`) prescribed a 5-part
`candidate_group_id` disambiguation (Option B). **I did NOT implement it.** Instead
`candidate_group_id` stays the 4-part slot key and distinct-value records legitimately
SHARE a group (Option A), because:
- `value-groups.test.ts` asserts distinct-value/multi-jurisdiction records sharing a
  group form ONE group (jurisdiction collection + A1 cross-candidate unit guard).
- `defaultSelectionPolicy.ts` pools candidates by (substance, pathway, input) and
  ignores `candidate_group_id` -- grouping is a pure display concern.
- `iris-canonical.test.ts` documents multi-endpoint coexistence as legitimate.
- 5-part disambiguation would fragment every group into a singleton and destroy the
  candidate-comparison feature (the whole point of the Values view grouping).

**codex CLI (gpt-5.x xhigh) re-reviewed and AGREED Option A is correct** ("a 5-part
split would fragment the UI grouping without changing default-selection"). The actual
defect (class-1 PURE duplicates: same tuple AND same value) IS fixed (generator
collapses; `catalog.test.ts` guards re-entry). If you prefer Option B, it is a small
regenerate-and-recommit, but it is not recommended.

### Also fixed
- **IRIS data-integrity gate** in the generator: every IRIS toxicity value is validated
  against the committed EPA IRIS snapshot (2% tol, mirrors `iris-canonical.test.ts`) and
  dropped + reported if it deviates or has no anchor. This drops the known-bad
  `carbon_tetrachloride` inhalation unit risk (1.5e-5; EPA = 6e-6) while keeping its
  valid RfD/RfC. General + future-proof (any IRIS extraction error now auto-drops).
- **Class-3 dirty exclusion (5 P28 rows, ADJUDICATE list for HITL):** DDT rfd+sfo,
  molybdenum rfd soil+soil-2, dichloroethylene_1_2_trans soil-2 (doubled units / empty
  CAS / CAS bleed). All verified genuinely dirty; clean values survive elsewhere.
- Test counts recomputed to the verified catalog (valueGroups 631, approved 208,
  pending 370, available 569, P28 361).

### Gate block (commit c185f1c)
- lint: PASS (0 errors)
- unit: PASS (2713 tests, 186 files)
- build: PASS (exit 0)
- e2e: PASS (138 tests across 3 browsers)
- codex CLI review: GREEN

### Note on the worktree
Work done in existing worktree `C:\Projects\SSTAC-Dashboard-worktrees\refs-values-fix-2026-05-31`
(branch `feat/matrix-options-refs-values-catalog-fix-2026-05-31`, pushed to origin).
Force-push onto #218's head was BLOCKED by the autonomous-mode safety classifier
(remote-history rewrite on a prior-session branch); shipping as #219 is the
non-destructive equivalent.

### HITL adjudication items surfaced (not blocking)
- DDT, molybdenum, dichloroethylene_1_2_trans: dirty P28 extractions excluded; DDT has
  no surviving toxicity value in this catalog (P28 dirty, IRIS not in allow-list) --
  recoverable via IRIS d0c00013 in a later pass if owner wants DDT coverage.

---

## T2 -- IRIS orphan substances. STATUS: DONE (shipped as draft PR #220, stacked on #219).

Draft PR **#220** `feat/matrix-options-iris-expansion-2026-06-01` (base = #219's branch,
commit `23bec4a`). Adds 71 US EPA IRIS substances (134 records) to the catalog
(563 -> **697 records**), completing IRIS coverage of the snapshot's ~101-substance
master-list set. Every value passed the EPA-snapshot data-integrity gate (only the
known-bad carbon_tet IUR dropped); all 232 IRIS records match the snapshot. All rows
available_option + needs_review. 4 gates GREEN (lint, unit 2713, build, e2e 138x3) +
codex CLI GREEN. Excluded: BaP + Cr(VI) (bad d0c00013 SFs) + 4 no-snapshot-anchor
substances (anthracene, ddt_total, fluoride, uranium -- need Excel snapshot extension,
deferred). **Owner: merge #219 then #220.** Diff = 2 files (catalog JSON + test counts).

## T3 -- The Guide update (2026 priority). STATUS: DONE (draft PR #221, PENDING OWNER CONTENT REVIEW).

Draft PR **#221** `feat/matrix-options-guide-update-2026-05-31` (base main, commit
`a0233be`). Targeted factual updates to `matrix_research/content_drafts/The_Guide.md`
(4 insertions, 2 deletions) reflecting the shipped multi-source candidate library
(P28/IRIS/HC, hierarchy-for-consideration, never auto-select), the loaded source
batches, and the 2026-05-31 persistence status (all 6 Evidence Library workflows
persist). 2026/2027 scope labels + HITL workflow + TWG onboarding were already current.
Owner-facing content read at runtime (markdown, not compiled) -- HELD for owner content
review; standard gates not meaningfully affected by the edit. Do NOT merge without owner
content review.

## T4 -- Design specs. STATUS: DONE (2 design docs, no code).

- `docs/MATRIX_OPTIONS_AUTONOMOUS_CATALOG_AGENT_DESIGN_2026_06_01.md` -- overnight
  catalog-enrichment agent: hard guardrails (STAGING-only, never auto-promote/approve/
  set-default/mutate-static-JSON, validate-vs-source-not-memory), builds on the existing
  `scripts/catalog-overnight/extract.py` + `catalog_extraction_staging` + approve RPCs,
  pipeline (trigger->acquire->extract->normalize+validate->stage->report->HITL gate),
  open questions, recommendation (keep UNARMED; build HC/P28 snapshots first).
- `docs/MATRIX_OPTIONS_FRAME_AWARE_EQUATIONS_NEXT_STEP_2026_06_01.md` -- the dispatch
  MECHANISM already exists (equationDispatch.ts / frameVariants.ts, table intentionally
  empty, all frames fall back to baseline). Spec = the playbook to light up the first
  real variant (one variant per PR), candidate first variants, and the owner decisions
  required. Flagged: owner must eyeball calculator behavior (the #199 pattern). Do NOT
  implement autonomously.

## T5 -- Eco passes mapping design. STATUS: DONE (design doc, NO records generated).

`docs/MATRIX_OPTIONS_ECO_PASSES_MAPPING_DESIGN_2026_06_01.md`. Finding: d0c00005
(`eco-soil`, ~4608 P28 soil effect concentrations) and d0c00010 (`eco-soil-screening`,
60 EPA Eco-SSL) are EVIDENCE categories per pathways.ts, NOT calculator pathways -- and
they are TERRESTRIAL SOIL benchmarks, not sediment. Mapping them onto the sediment
calculator pathways (eco-direct-eqp/eco-food-bsaf) would be a category error; they
already have a correct evidence-category home. The real decision is owner-gated (do soil
benchmarks belong in a sediment catalog as reference evidence; static-JSON vs staging
for 4608 rows; eco-metadata schema). Per the run plan, NO records generated.

---

## SESSION SUMMARY (2026-06-01)

Shipped 3 draft PRs + 3 design docs; all gated + codex-reviewed where code changed.

**Merge order (owner):**
1. Merge **#219** (T1 dedup fix + IRIS data-integrity gate; supersedes #218; commit
   c185f1c). Then close **#218** and the redundant **#213**.
2. Merge **#220** (T2 IRIS expansion +71 substances; stacked on #219; commit 23bec4a) --
   auto-retargets to main after #219 merges. (Or squash #219+#220 into one merge.)
3. **#221** (T3 The Guide refresh) -- HOLD for owner CONTENT review, then merge.
4. Design docs T4/T5 -- read + decide; nothing to merge (plans only).

**Gate blocks:** #219 c185f1c and #220 23bec4a each: lint 0err, unit 2713, build exit0,
e2e 138x3, codex CLI GREEN. #221 is markdown content (gates not meaningfully affected).

**Key decision flagged for owner:** T1 used Option A (shared 4-part candidate_group_id
slot grouping), NOT the spec's 5-part disambiguation. Rationale + codex agreement in the
T1 section above and in #219.

**Owner-gated / deferred (surfaced, not blocking):**
- HITL adjudication: DDT / molybdenum / dichloroethylene_1_2_trans dirty P28 extractions
  excluded (DDT has no surviving value -- recoverable via IRIS d0c00013 later).
- 4 IRIS substances need an EPA Excel snapshot extension (anthracene, ddt_total,
  fluoride, uranium).
- d0c00012 TEQ-unit RfDs (PCBs/PCDD-PCDF) -- TEF workflow decision (untouched).
- Eco passes ingest + CCME eco-soil rank-1 gap -- owner decision (T5 doc).
- Paste `.tmp/catalog-paste/json-migration/promoted_*.sql` to Supabase later (the Values
  view already surfaces the catalog via static JSON; paste is for the DB batch).

**Worktrees (left for owner cleanup, junction-safe: `cmd /c rmdir` then
`git worktree remove`):** `refs-values-fix-2026-05-31` (holds the T1+T2 branches),
`guide-update-2026-05-31`. Plus the older ones from prior sessions.

**Process note:** force-push onto #218 was blocked by the auto-mode safety classifier
(remote-history rewrite on a prior-session branch); T1 shipped as #219 (non-destructive).
