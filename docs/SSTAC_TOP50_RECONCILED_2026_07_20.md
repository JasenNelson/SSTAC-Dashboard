# SSTAC-Dashboard -- Top 50 Priority Tasks, Reconciled and Re-Ranked (2026-07-20)

## Context

The existing Top-50 lineage (`docs/SSTAC_TOP50_*` 07-13, 07-14, 07-15, 07-17) has degraded from a
priority queue into a status ledger. The 07-17 doc says so itself: "This document reconciles rather
than re-ranks." Roughly 30 of the base 50 rows are now DONE, and the 07-17 doc is itself stale on
four items that shipped after it was written.

This plan rebuilds the list as a genuine priority queue: it retires closed rows, carries forward the
genuinely-open ones, and adds newly-discovered completion gaps that no prior doc tracks. Ranking is
driven by the owner's stated completion goal, which is all four lanes: a useful sediment map, a
complete Matrix Options suite, a production-hardened app, and the KB/wiki automation lane.

Intended outcome: a list where every row is live work, each lane can progress while other lanes sit
owner-gated, and owner decisions are batched into one packet instead of drip-fed.

---

## 1. Verified state (live at publication)

Verified 2026-07-20 against `origin/main` = `dddbe0f4`. Every metric below is still a point-in-time
reading: section 10 carries the re-runnable queries, and the execution session MUST re-derive rather
than inherit them. The live database figures were last confirmed unchanged at publication time.

**Git / PR state**
- `origin/main` = `dddbe0f4` (PR #704, 2026-07-20). The shared local checkout is at `deede527`,
  **351 commits behind** and dirty; it was never used as a source of truth for this document.
- **7 open PRs**: #705 (`docs/handoff-2026-07-20-session-close`, docs-only continuity handoff) plus
  6 stale bot/UI leftovers from 2026-05-10 to 2026-05-28 (#108, #110, #117, #121, #132, #187).
- PRs #703 and #704 merged 2026-07-20T04:54Z; the earlier seven-file test freeze is LIFTED.
- 591 remote branches; 108 branch-tracked worktrees (111 total). **Cleanup inventory must use PR
  state, not ancestry**: this repo squash-merges, so a merged branch tip is never an ancestor of
  `main`. Verified: `docs/guidance-index-cheap-2026-07-19` and
  `test/mo-phase2tasks-coverage-2026-07-19` both report `ancestor-of-main=NO` despite PRs #692/#693
  being MERGED. By PR state: **84 SAFE-remove (MERGED), 1 KEEP (#705), 10 CLOSED-only (review),
  13 no-PR (review)**.

**Live database (read-only, project-scoped MCP)**

| Metric | Live value | Note |
|---|---|---|
| DRAs total / public | 574 / **5** | but only **122** DRAs actually carry samples |
| Samples total / member-visible | 4494 / **40** | map is **99.1% dark** |
| Samples with measurements | **2521** (56%) | corrects the stale "88.6% have none" doc claim |
| Samples missing coordinates | **0** | data is clean |
| Orphan samples (null DRA) | 8 | invisible to everyone, incl. admins |
| sample_events / measurements | 4737 / 19383 | T31 undated load confirmed applied |

**Coordinate tier split (the decisive finding)**

| Tier | Samples | DRAs | Public |
|---|---|---|---|
| high (surveyed) | 40 | 4 | yes |
| high (surveyed) | **28** | **4** | no -- ~~publishable today under the existing standard~~ **NOT publishable; see below** |
| medium (centroid) | 4418 | 118 | no -- policy-gated |

**CORRECTION 2026-07-20.** This table groups SAMPLES by tier, and reading it as "4 surveyed DRAs"
is the error that produced the retracted row 1. Those 28 surveyed samples live inside 4 DRAs that
ALSO hold **1169 centroid samples** (1197 total). Because `flip_dra_public` publishes at DRA
granularity, there is no way to publish the 28 without the 1169. The 1169 are a subset of the 4418
above, not an addition. **A tier-grouped sample query cannot tell you what a DRA flip will expose --
group by DRA and count both tiers.**

The 4 DRAs formerly labelled "unpublished surveyed" are: `ERA Volume 4 - Mark Creek and Lois Creek`
(20 high / 35 medium), `20240312 LTR Response to ENV comments of DHHERA` (5 / 413), `HHERA_FINAL`
(2 / 245), `Old Slope Place-HHERA` (1 / 476). Note one of the 5 public DRAs contributes 0 samples --
worth a look.

**Production (Vercel, project `prj_pTwrPuPE9QbHxVqC0AmSgq3cFpYC`)**
- Runtime health is good: 3 benign auth-refresh errors in 7 days, none since 2026-07-13.
- **Production is 3 commits behind `main`.** PRs #700/#701/#702 merged within 6 seconds of each other
  and all three production deploys were `CANCELED`; #698's was `ERROR`. Prod serves #699 (`9b6116f1`).
  User impact is low (docs/script-only commits) but there is no deploy-health gate to catch this.

**CI / E2E (live-checked, correcting a subagent inference)**
- Admin-tier E2E **is active**: repo variable `E2E_AUTH_ENABLED=true`, secrets `E2E_ADMIN_EMAIL` and
  `E2E_ADMIN_PASSWORD` set 2026-07-18. The 07-18b handoff claim is TRUE.
- **No `SENTRY_*` secrets exist**, so Sentry release/source-map upload is not wired in CI. (Row 6
  lane PARKED by owner ruling 2026-07-21 -- do not wire unless reopened.)
- 13 e2e spec files, 228 Playwright tests, 5821 vitest tests.

**Corrected stale claims** (do not cite these sources as current)
1. 07-17 doc "#31 inhalation calculator BUILD IN PROGRESS" -- shipped in `dc26f858` (#673).
2. 07-17 doc "#23 dl-PCB TEQ build QUEUED" -- shipped in `670c7417` (#675).
3. 07-17 doc "#35/#36 abs_dermal apply IN PROGRESS" -- shipped in `8fcc30eb`.
4. 07-17 doc "#7 IOCO publish PENDING" -- done; live shows 5 public DRAs.
5. `MATRIX_MAP_STATUS_2026_07_11.md` "0 public DRAs" and "cap fix owner-gated" -- both wrong now;
   cap fix was applied 2026-07-11 (`cap_is_5000=true`).
6. `MATRIX_OPTIONS_COMPLETION_STATUS_2026_07_11.md` "88.6% of samples have no measurements" -- live
   value is 44%, not 88.6%.
7. KB plan (`~/.claude/plans/jolly-marinating-piglet.md`) "Implementation NOT started" -- Phases 2
   and 3 code is merged (`fb4f7d9c`, `4811fef9`, `ae8d48db`).
8. OCR triage doc's Lot C / Howe Sound "prime target" page guesses -- falsified by the actual OCR run.

---

## 2. Active-session conflict map

**RESOLVED 2026-07-20T04:54Z.** PRs **#703** and **#704** are both MERGED (4 seconds apart).
`origin/main` advanced `c1e79be4` -> **`dddbe0f4`**. The 7-file freeze is **lifted**; Lane 5 and
row 50 are unblocked, and future planning need not exclude those files unless a new conflict appears.

**One active-session artifact remains open:** PR **#705** (`docs/handoff-2026-07-20-session-close`),
a docs-only continuity handoff. Low conflict risk, but do not edit that handoff or its branch until
it merges. Open PRs are now 7: #705 plus the same 6 stale leftovers.

Standing rules, unchanged and still load-bearing: no lane branches off the shared local `main` (now
**351 commits behind**); every branch is a worktree created off `origin/main`; never `git checkout -b`
in the shared checkout (L0 1.15).

**Refreshed worktree inventory** (PR-state join, post-merge): 108 branch-tracked worktrees ->
**84 SAFE-remove (MERGED)**, 1 KEEP (#705's branch), 10 CLOSED-only, 13 no-PR. Rows 29-31 use these.

**Live re-check of row 2:** #703/#704 merged seconds apart, the same rapid-merge pattern that
produced the CANCELED deploys for #700-#702. Vercel reports **zero runtime errors in 24h**, so
production is healthy regardless. Re-confirm prod alias SHA vs `dddbe0f4` at execution start; if it
caught up on its own, that supports the "auto-cancel of superseded builds is expected behavior"
reading and row 2 narrows to alerting-only, with row 2b likely moot.

---

## 3. The Top 50, ranked

Status key: `SAFE` = autonomous-safe, `OWNER` = needs an owner action/ruling, `BLOCKED` = external
data or upstream gate, `ATTEND` = needs owner present, `CONFLICT` = active-session lane.
Lane key: MAP, MO (matrix options), PROD, KB, HYG, reg-review (regulatory-review UX/search; row 44 relabeled here 2026-07-21).

### Tier A -- highest leverage, mostly unblocked (1-12)

| # | Task | Lane | Status | Evidence | Why it matters |
|---|---|---|---|---|---|
| 1 | ~~Publish the 4 unpublished surveyed-tier DRAs (+28 samples)~~ | MAP | **BLOCKED** | preflight 2026-07-20; `pg_policies` on `matrix_map.samples` | **RETRACTED.** The 4 DRAs are MIXED-TIER, not surveyed-only: 28 high + **1169 medium** = 1197 samples. `flip_dra_public` is DRA-granularity and RLS `samples_authenticated_select` never consults `samples.public`, so flipping them publishes all 1197 (40 -> 1237 visible), silently enacting Option B on 4 coordinate points. Merged into row 5 |
| 2 | Deploy-health gate: alert when prod SHA != main SHA (build the check only) | PROD | SAFE | Vercel deploy list; prod serves #699 | No alerting exists for prod tip != main tip. New item, untracked anywhere |
| 2b | Re-deploy the 3 stranded commits | PROD | **RESOLVED-BY-DESIGN** | prod-health fix PR #729; owner ruling 2026-07-21 | The stranded commits are docs-only (Vercel-ignored), so no redeploy is needed -- prod legitimately lags and carries forward on the next app deploy. PR #729 stops the scheduled prod-health check from false-alarming on that docs-only lag; it still hard-fails on app-affecting drift. (The drift-check CI wiring itself shipped in #724.) |
| 3 | Centroid-publication decision packet (evidence, risk framing, options) | MAP | SAFE | 4418 samples / 118 DRAs gated | Unblocks the single largest data lever in the project |
| 4 | ~~Coordinate-accuracy tier badge + disclaimer in map UI~~ | MAP | **DONE-ALREADY** | verified on `dddbe0f4` 2026-07-20; PRs #593, #600, #635 | **RETRACTED.** Already shipped: `src/lib/matrix-map/coordinate-provenance.ts` defines the canonical vocabulary (Surveyed / Centroid / Manual) and `MatrixMap.tsx` applies dash-array marker encoding, a popup caption reading "Approximate BC CSR site centroid -- not a surveyed sediment location.", and a 3-entry legend, plus a Surveyed-only filter, a province provenance chip, and CSV/panel columns. No data-layer change was ever needed |
| 5 | **Owner ruling: centroid publication policy (now the ONLY publication decision)** | MAP | OWNER | corrected packet s5/s8 | Absorbs retracted row 1. Options: no publication now (recommended interim) / Option C site-aggregate layer / tier-aware visibility design / Option B accepted knowingly / Option D OCR-first. Gates all **4418** publishable centroid samples across 118 DRAs -- note the 1169 inside the 4 formerly-"surveyed" DRAs are a SUBSET of that 4418 (verified overlap = 1169), not an addition to it |
| 6 | Wire `SENTRY_*` CI secrets + verify release/source-map upload | PROD | **PARKED** | owner ruling 2026-07-21 | PARKED by owner 2026-07-21 -- do NOT set up Sentry (no tokens/secrets/integrations) unless reopened. What-to-set guidance retained in `docs/design/SENTRY_CI_SECRETS_WIRING_PACKET_2026-07-21.md`; see `NEXT_STEPS.md` 2026-07-21e |
| 7 | Reconcile the 6-gate skill vs 4-gate `GATE_MODE_SOP.md` drift | PROD | **DONE** | reconciled 2026-07-21 | RESOLVED 2026-07-21 (owner-authorized): `GATE_MODE_SOP.md` Phase 4 reconciled to the SIX named gates (G1-G6) matching the live `ship-protocols` skill |
| 8 | Correct the KB plan doc's "not started" framing to match merged Phases 2-3 | KB | SAFE | `fb4f7d9c`, `4811fef9`, `ae8d48db` | Plan doc materially misrepresents lane state |
| 9 | Land the `/sync-wiki` skill (in approved 0-3.5 scope, absent from tree) | KB | SAFE | no `.claude/skills/sync-wiki/` | Phase 3's on-demand refresh has no invocation surface |
| 10 | Confirm whether the guarded graph build / wiki compile / ledger seed actually ran | KB | OWNER | artifacts gitignored, unverifiable from git | Phase 3.5 go/no-go needs this evidence |
| 11 | Land this list **into `docs/`** as the successor doc; retire the 07-17 doc | HYG | SAFE | 4 stale claims in s1 | Must live in `docs/`, not `~/.claude/plans/`, or the next session will not treat it as authoritative |
| 12 | Draft a `current_grade` re-analysis **PR** (pinned to `73203c5`, tip is `c1e79be4`) | HYG | SAFE-to-draft / OWNER-to-sanction | `docs-manifest.json` | Owner merge is what makes a computed grade current. Do NOT redo `vitest_test_count`; #701 refreshed it to 5821 today |

### Tier B -- real work, bounded, some gated (13-28)

| # | Task | Lane | Status | Evidence | Why it matters |
|---|---|---|---|---|---|
| 13 | r-0074 text-layer coordinate extraction (no OCR needed, 198/200 text pages) | MAP | SAFE | OCR triage doc | Cheapest coordinate-upgrade win; 24 stations |
| 14 | Verify well-id to sample-row mapping for Site 14764 | MAP | BLOCKED | apply-readiness doc s3 prereq 1 | Blocks every coordinate apply, even the 2 already OCR'd |
| 15 | Locate the real coordinate tables in Lot C and Howe Sound PDFs | MAP | ATTEND | OCR results doc falsified the guesses | 312 of 385 centroid stations sit behind this |
| 16 | Disposition the 8 orphan samples (null `source_dra_id`) | MAP | OWNER | live query | Invisible to everyone including admins |
| 17 | Investigate the public DRA contributing 0 samples | MAP | SAFE | 5 public, 4 with samples | Possible publish or data error |
| 18 | Normalize `waterbody_type` casing (93.5% empty, "Marine"/"marine") | MAP | SAFE | completion-status doc | Map filters/legend quality |
| 19 | P28 verify-vs-primary sweep, 357 rows, vision-first | MO | **PARKED** | owner ruling 2026-07-21 | PARKED by owner 2026-07-21 -- no vision/source-access sweep. 357-row inventory exists (`docs/MATRIX_OPTIONS_P28_VERIFY_WORKLIST_2026_07_12.md`); remaining work is per-value vision-vs-primary + owner-gated. Largest remaining verification backlog by row count |
| 20 | T39 calculator cross-check vs a primary worked example | MO | OWNER | base row #37 | The project's own anti-fabrication check, never executed |
| 21 | Owner ruling: keep or drop the CCME SVI attenuation-factor lane | MO | OWNER | SVI packet; VF/PEF is user-supplied-only by ruling | Risk of sourcing values a binding ruling says will never be consumed |
| 22 | Option B intake-based inhalation model (5 sub-rulings) | MO | OWNER | `OPTION_B_..._PACKET_2026-07-20.md` s6-7 | Owner chose Option A; this is gated future scope, not urgent |
| 23 | PHC bundle: `phc_f1..f4`, `total_phcs` (5 keys) | MO | BLOCKED | base row #33 | Not in ERDC BSAF DB + unresolved double-counting policy |
| 24 | Aroclor 1254 to "Total PCBs" cosmetic re-key | MO | OWNER | base row #13 | Needs owner-sourced site logKow |
| 25 | DRA publication expansion policy beyond the pilot | MAP | OWNER | base rows #10/#11 | Superseded in practice by #5; keep as the formal policy artifact |
| 26 | T20 stats-tier ruling: exclude centroids from station UCLs | MAP | OWNER | base row #38 | Doc's own view is "likely no"; excluding drops 98.5% of chemistry |
| 27 | ProUCL v5.2 parity scaffold (`describe.skip`, owner supplies values) | MO | OWNER | `stats.test.ts` | A real skipped-test backlog item, not principled skip |
| 28 | ~~Close the two `it.todo` entries in `equationDispatch.test.ts`~~ | MO | **RETRACTED** | probed 2026-07-20 | **NOT a coverage gap.** Both are deliberate forward-declarations ("activate in Week 9 when first variant ships") gated on a frame variant that has not shipped; the suite asserts `FRAME_VARIANTS.length === 0` in production. Closing them would require fabricating a variant. Leave parked |

### Tier C -- hygiene, docs, deferred (29-40)

| # | Task | Lane | Status | Evidence | Why it matters |
|---|---|---|---|---|---|
| 29 | Worktree cleanup: **84 of 108** SAFE-remove by PR state | HYG | OWNER | PR-state join, s2 | Junction-delete hazard (L0 1.15). Never a blanket sweep |
| 30 | Triage the **10 CLOSED-only + 13 no-PR** worktrees for unique work | HYG | OWNER | same | Ancestry would have mislabeled squash-merged branches as "unmerged work worth preserving" |
| 31 | Prune merged remote branches **using PR state, not `--merged`** | HYG | OWNER | squash-merge ancestry test in s1 | `git branch -r --merged` undercounts and will skip dozens of dead branches |
| 32 | Root-scratch cleanup: **~61 legacy `.tmp_*`** + loose `.py`/`.mjs`/`.txt` at repo root | HYG | OWNER | `git status`; prior session cleared 43 of its own (104 -> 61) | Remaining files predate the prior session and are not its to remove. No auto-delete; recommend only |
| 33 | Resolve primary-checkout dirty state (`.claude`, `.codex`, `AGENTS.md`) | HYG | OWNER | `git status` | Uncommitted config edits of unclear intent |
| 34 | Update the shared local checkout (**351 behind**, and dirty) | HYG | OWNER | `deede527` vs `dddbe0f4` | Parallel-session hazard; coordinate before touching. Re-count at execution start; it drifts fast |
| 35 | Phase 1 root-organization gate is RED (2 broken `file:///` links) | HYG | SAFE | KB plan Batch 0 | Precise, low-risk fix; unblocks the docs gate |
| 36 | Refresh `docs/LESSONS.md` (last updated 2026-07-13, ~150 commits ago) | HYG | SAFE | `e4f7c898` | Lessons from KB/E2E/CSRF/inhalation work uncaptured |
| 37 | Fix non-ASCII in `docs/INDEX.md` (curly quote, arrow glyph) | HYG | SAFE | direct read | Violates the L0 plain-ASCII rule |
| 38 | Close or triage the 6 stale open PRs (#108-#187, all 2+ months old) | HYG | OWNER | `gh pr list` | Never adopt bot branches; reimplement clean if real |
| 39 | Establish an explicit-any / god-file burn-down doc (51 / 137 snapshot) | HYG | OWNER | manifest `code_quality_15pct` | Currently ad-hoc; formalize only if owner wants tracking |
| 40 | Optional defense-in-depth REVOKE on `dras_admin_all` | PROD | **OWNER** | base row #27 | A database write. Claude drafts and preflights the SQL only; owner applies via SQL Editor |

### Tier D -- reg-review and long-tail (41-50)

| # | Task | Lane | Status | Evidence | Why it matters |
|---|---|---|---|---|---|
| 41 | Verify Export CSV/MD/HTML + export-memo against real data | MO | OWNER | base row #39 | Needs non-stub data |
| 42 | One real judgment save + one "Ask AI" query vs live eval | MO | BLOCKED | base row #40 | Needs Ollama under the L0 1.12 schedule protocol |
| 43 | Correct the pyramid-navigation status in `docs/NEXT_STEPS.md` line 138 | MO | SAFE (docs only) | probed 2026-07-20 | **RESOLVED: superseded, not abandoned.** The concept shipped inline in `ReviewDashboardClient.tsx` as "Stage Group Definitions (Pyramid Navigation)" with a `StageGroup` interface, rather than as the proposed `pyramidHierarchy.ts` / `PyramidNavigation.tsx`. `NEXT_STEPS.md` still calls this "unresolved"; that is now answerable. Remaining work is the one-line docs fix, not code |
| 44 | Submission-search FTS performance plan | reg-review | SAFE | base row #42 | Design DONE 2026-07-21 (`docs/design/SUBMISSION_SEARCH_FTS_DESIGN_2026-07-21.md`, PR #727): SQLite FTS5 near-term, engine_v2 Postgres FTS convergence long-term. Implementation deferred until >1K assessments / reviewer latency (not yet hit). Lane relabeled MO -> reg-review (owner ruling 2026-07-21) |
| 45 | Continue the `curate-bc-protocol-28-dedup.mjs` sweep (output gated) | MO | SAFE | `scripts/matrix-options/` | Script runs autonomously; rulings gate the values |
| 46 | Coordinate remediation lane beyond the 4 named DRAs | MAP | BLOCKED | status doc s4 item 4 | Future; report-only today |
| 47 | `matrix_map_backup_20260624` schema cleanup (13 tables, ~8746 rows) | HYG | OWNER | status doc | Storage hygiene, low priority |
| 48 | KB Phase 3.5 owner go/no-go checkpoint | KB | OWNER | plan Phase 3.5, STOP-default | Gates all of Phases 4-7 |
| 49 | KB Phases 4-7 (Ollama, nightly, hooks, graduation) | KB | BLOCKED | plan s4-8; depends on #48 | Explicitly subordinate to Matrix Options priority |
| 50 | Post-merge follow-up on the #703/#704 lint/type-guard lanes | MO | SAFE | both MERGED 2026-07-20 | Freeze lifted; continue the explicit-any burn-down where those PRs stopped |

---

## 4. First five execution lanes after approval

Each lane is independent, so an owner gate in one never stalls the others.

**Lane 1 -- MAP.** ~~quick win (rows 1, 3, 4, 17): build the tier-badge UI and the centroid decision
packet autonomously; hand the owner the 4-DRA surveyed publish as a single in-app action.~~
**SUPERSEDED 2026-07-20 -- there is no "quick win" here and no publish to hand over.** Rows 3 and 4
are DONE (packet merged; the tier badge was already shipped via #593/#600/#635). Row 1 is CANCELLED:
its preflight failed because the 4 DRAs are mixed-tier, so the flip would publish 1197 samples, not
28. **Do NOT surface a 4-DRA publish action to the owner.** The only remaining item in this lane is
row 5, the centroid-publication policy ruling, which is an owner decision and not an execution task.
Row 17 (the public DRA contributing 0 samples) is unaffected and still autonomous-safe.

**Lane 2 -- PROD hardening (rows 2, 6, 40).** Build a deploy-health check comparing the Vercel
production alias SHA to `origin/main`, surfaced in CI or the admin health page. **Status update
2026-07-21:** the deploy-health check shipped (#724) and its docs-only-drift handling is PR #729;
row 2b (re-deploy) is RESOLVED-BY-DESIGN (stranded commits are docs-only); **row 6 (Sentry) is PARKED
by owner ruling -- do not action**. The REVOKE (row 40) remains an owner action; Claude prepares only. Note the softer diagnosis: Vercel auto-cancels superseded builds, so three CANCELED
deploys from merges seconds apart is expected behavior, not proven deploy loss. The finding that
stands is prod tip != main tip with **no alerting**, and user impact is nil because #700/#701/#702
were docs/manifest/script-only. AGY: high.

**Lane 3 -- KB truth-up (rows 8, 9, 10).** Correct the plan doc, land `/sync-wiki`, and produce a
status probe for whether the Phase 2/3 builds actually ran. Deterministic, no Ollama. AGY: high.

**Lane 4 -- DOCS reconciliation (rows 11, 12, 35, 36, 37).** Publish this list as the successor doc,
refresh the manifest facts, fix the RED docs gate and the non-ASCII. AGY: very high, near-fully
mechanical.

**Lane 5 -- MO bounded coverage (rows 28, 43, 45, 50).** **Unblocked** as of 2026-07-20: #703/#704
merged. Close the two `it.todo` entries in `equationDispatch.test.ts`, run the pyramid-nav probe,
continue the P28 dedup sweep, and pick up the explicit-any burn-down where #703 stopped. AGY: medium.

Deliberately NOT in the first five: the P28 357-row sweep (row 19) -- **PARKED by owner ruling
2026-07-21 (no vision/source-access sweep); do not start** -- is a multi-session vision-first lane;
the coordinate-extraction lane (rows 13-15) needs row 14's mapping verification first.

---

## 5. Owner-gated packet (smallest exact actions)

0. ~~Merge #703 and #704~~ **DONE 2026-07-20T04:54Z.** Remaining: merge **#705** (docs-only handoff)
   when the active session closes.
1. ~~**Publish 4 surveyed DRAs.**~~ **CANCELLED 2026-07-20 -- NOT AN ACTION. DO NOT PERFORM.**
   This item is retained only as an audit trail of a retracted instruction. There is no publication
   to carry out here; the decision was absorbed into the single centroid-publication policy ruling
   (row 5 / corrected packet section 8). Skip to item 2.

   **(a) PREFLIGHT -- ALREADY RUN, AND IT FAILED.** The guard did its job. It required these 4 DRAs
   to be `public=false` and 100% `coordinate_quality_tier = 'high'`, and instructed: "If any row has
   drifted to `medium`, STOP and re-surface." Every one of the 4 contains `medium` rows, so the
   STOP condition fired and no flip was performed.

   **(b) OWNER ACTION -- CANCELLED 2026-07-20. DO NOT PERFORM.** The preflight in (a) was run and it
   **failed**. The 4 DRAs are mixed-tier, not surveyed-only:

   | DRA | high | medium | total |
   |---|---|---|---|
   | `35626cb0-...` ERA Volume 4, Mark Creek and Lois Creek | 20 | 35 | 55 |
   | `c2d6a380-...` LTR Response to ENV comments, DHHERA | 5 | 413 | 418 |
   | `a3b95869-...` HHERA_FINAL | 2 | 245 | 247 |
   | `11f00164-...` Old Slope Place HHERA | 1 | **476** | 477 |
   | **Total** | **28** | **1169** | **1197** |

   `matrix_map.flip_dra_public` updates only `dras.public`; RLS `samples_authenticated_select` gates
   on `d.public = true OR has_private_grant(d.id)` and **never consults `samples.public`**. Visibility
   is therefore DRA-granularity: flipping these 4 publishes **1197** samples (40 -> 1237 visible), of
   which **1169 are centroid-tier sitting on just 4 distinct coordinates**. That silently enacts
   Option B -- the option the packet does not recommend -- and includes Old Slope Place, the DRA
   behind the "476 samples on one coordinate" warning.

   There is **no DRA-granularity path that publishes only the surveyed samples.** This action is
   superseded by the single centroid-publication policy decision (row 5 / corrected packet section 8).

   **(c) POSTFLIGHT -- not applicable; no action to verify.** The original expectation
   (`dras_public` 5 -> 9, `samples_public_visible` 40 -> 68) was wrong: the true outcome would have
   been 40 -> 1237. Retained only to document the error. Any FUTURE publication must run the
   mandatory preflight in the corrected packet's section 9 and confirm the tier mix of every
   candidate DRA before flipping.
2. **Rule on centroid publication** after reading the row-3 packet. Yes/no plus whether a tier badge
   is sufficient mitigation.
3. **Set `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`** as repo secrets (or confirm Sentry is
   intentionally unwired). **[PARKED 2026-07-21: owner ruled Sentry parked -- do not set up; see
   `NEXT_STEPS.md` 2026-07-21e. Reopen to action.]**
3b. **Approve the production re-deploy** of the 3 stranded commits (row 2b), or confirm it can wait
   for the next merge to carry prod forward naturally. **[RESOLVED-BY-DESIGN 2026-07-21: the 3
   stranded commits are docs-only, so no redeploy is needed; PR #729 stops the prod-health false
   alarm on that docs-only lag.]**
3c. **Approve the `dras_admin_all` REVOKE** SQL once drafted (row 40).
4. **Rule on the 4-gate vs 6-gate drift** and authorize the edit to `docs/GATE_MODE_SOP.md`.
   **[DONE 2026-07-21: owner-authorized; `GATE_MODE_SOP.md` Phase 4 reconciled to the six named
   gates G1-G6.]**
5. **Confirm** whether the KB Phase 2 guarded build and Phase 3 wiki compile were ever actually run.
6. **Rule on the CCME SVI attenuation lane**: keep as reference-only rows, or drop.
7. **Authorize** (or decline) worktree/branch cleanup as a separate careful, junction-safe session.
8. Merge **#705** only after its required CI checks are green (Unit Tests have since passed;
   Production Build and E2E were still pending at last check). It carries the codex-probe evidence
   and the squash-merge finding into the repo, so those survive outside `~/.claude/plans/`.
   (#703/#704 are already merged -- see item 0.)

---

## 6. Autonomous execution contract for the next run

- **Mode:** Autonomous Multi-Hour (L0 1.21). Phase transitions are not stop points.
- **Branching:** every lane gets its own worktree off `origin/main` via `git worktree add`. Never
  `git checkout -b` in the shared checkout (L0 1.15). Junction-first cleanup only, never recursive
  delete over `node_modules`.
- **Delegation:** AGY writes, orchestrator runs (L0 1.18/1.19). Sonnet subagents for exploration and
  verification. Opus for sequencing, risk calls, and owner-facing judgment.
- **Review (revised after captured counter-evidence).** Codex CLI is *installed* but its review
  function is **not proven on this repo**. Three binaries coexist and resolve differently per shell:
  `0.144.6` at `AppData/Local/Programs/OpenAI/Codex/bin/`, plus app-local `0.142.5` and
  `0.137.0-alpha.4`. More importantly, resolution is not function: a bounded probe run by the prior
  session (file-based prompt, `codex review -c model_reasoning_effort=xhigh -`, hard timeout) ignored
  the file scope, dumped 1308 lines of repo source, hit 350s, exited 124, and emitted no VERDICT line.
  That is a structural context-dumping failure on a large repo, not an invocation slip.
  **Resolution differs per shell, so the probe must be pinned.**

  **Procedure, not assertion:**
  1. Probe ONCE per session, invoking the **absolute path** to 0.144.6 explicitly:
     `/c/Users/jasen/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe` -- never bare `codex`.
     Bounded: hard timeout, small single-file target. Kill on the dump signature (output past ~200
     lines with no VERDICT).
  2. **Always log the resolved binary path and version**, on success as well as failure, so the next
     session inherits which build was actually exercised.
  3. If the probe passes, use the standard targeted `/codex-review` loop to mutual-agreement GREEN as
     the normal per-commit gate -- this is the `docs/GATE_MODE_SOP.md` preference and it stands.
  4. If it fails, descend the SOP fallback ladder (codex CLI -> Opus adversarial iterative loop ->
     cursor-agent, sparingly) and record the exact command, path, version, stdout/stderr and timeout.
     Both fallbacks are proven working: `cursor-agent` (`gpt-5.3-codex-xhigh`, `--trust`, prompt via
     file) returned a clean ~20-line verdict in one shot; adversarial reviewer subagents caught three
     real defects, including a self-referential test suite that could not detect a dropped roster
     member. After any fallback, append to the codex re-review queue per the SOP.
  5. Do **not** generalize to "codex is broken", do **not** record a memory either way, and do not
     conclude it works from a version string alone. Evidence is a VERDICT line, not a `--version`.
- **Gates before push (local, MANDATORY).** `docs/GATE_MODE_SOP.md` Phase 4 is the authority: run the
  SIX push gates G1-G6 (reconciled 2026-07-21 to match the live `ship-protocols` skill) --
  `npm run lint` (G1) -> `npx tsc --noEmit` (G2) -> `npm run test:ci` (G3) -> `npm run
  build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10` (G4) -> `npm run test:e2e` (G5) ->
  `npm run docs:gate` (G6), in that order, **each GREEN before the next starts**. Never raw
  `npm run build`. `npm run test:unit` is never push-gate evidence.
  **Correction to an earlier draft of this plan:** it proposed preferring CI-as-gate because local
  `test:ci` can exceed the 10-minute Bash ceiling. That under-gates and conflicts with the SOP and
  AGENTS.md. The ceiling is a harness limitation, not a licence to skip a gate: run long gates as
  main-session background tasks and wait for them. CI remains a **confirmation** after push, never a
  substitute for the local suite. Local gates may be waived ONLY by an explicit owner waiver for
  NON-CODE changes (pure docs / generated facts), recorded in the PR body; anything touching `src/`,
  `scripts/`, `supabase/`, or configs gets no waiver (matches `GATE_MODE_SOP.md` Phase 4 + the
  `ship-protocols` skill).
- **Batching:** owner decisions accumulate into one packet; never drip-fed mid-run.
- **Resilience artifacts:** refresh `RUN_STATE.md`, `PR_MANIFEST.md`, `RESUME_PROMPT.md` and the
  dated handoff, and commit them (mandatory close-out).

## 7. Stop conditions

Stop and surface to the owner for: any Supabase or production write not pre-approved; catalog
`--apply` or `current_default` promotion; publish flips; `gh pr merge`; secrets inspection;
destructive cleanup or worktree deletion; a suspected junction hazard; repeated gate failure after
bounded retry; codex oscillation past about 5 rounds (escalate to an informed holistic); or token
budget exhaustion without a checkpoint.

## 8. Re-check after the active session closes

1. ~~Confirm #703/#704 merged~~ **DONE**; tip is now `dddbe0f4`. Re-read `origin/main` again at
   execution start, since #705 may have landed and moved it further.
2. Re-run the section-10 appendix queries; the metrics in section 1 are point-in-time and were taken
   at `c1e79be4`.
3. Confirm the production alias SHA against the then-current `origin/main` (see the row-2 note in
   section 2).
4. ~~Re-check the 7 conflict files~~ **freeze lifted**; verify only that #705, or any newly-opened PR,
   does not introduce a fresh overlap.
5. Re-run the PR-state worktree join; the count moved 82 -> 84 in a single merge cycle, so it drifts
   fast. Never use `git branch -r --merged` for this.

## 8b. Process-hygiene correction (verified 2026-07-20)

Two sessions each got half of this wrong. Recorded in full so the next one does not repeat either.

**The prior session's close-out** flagged "14 python processes... almost certainly the parallel
session that authored the Top-50 plan." Its **recency was right**; its **ownership attribution was
wrong** -- it inferred ownership from start time alone and never read command lines.

**An earlier draft of this section** asserted "none started within the last 6 hours." **That was
wrong, and it was a unit error on my part:** this box is Pacific (UTC-7), `Get-Process` reports
**local** time, and PR timestamps are **UTC**. Comparing 21:56 local against 04:54 UTC produced a
7-hour phantom gap. Verified live: `now_local=2026-07-19 22:04`, `now_utc=2026-07-20 05:04`, and
PID 22356 started 21:56 local = **7.9 minutes** before the check. The processes ARE recent.

**What is actually established, by command-line inspection** (`Get-CimInstance Win32_Process`, the
check that settles ownership -- start time never can):

- All **22** python processes are **MCP servers**: `~/.local/share/mcp-servers/gdrive-mcp/server.py`,
  the Claude Desktop extension `ant.dir.cursortouch.windows-mcp/.venv`, and `hermes-agent/venv`.
  They run in launcher+child pairs, which is what inflated the count.
- **None belong to this planning session.** Its only python use was inline `python -c` in foreground
  Bash, which exits immediately and leaves nothing resident.

These fall in the L0 1.17 spare-active allowlist (MCP servers / Claude Desktop). **Do not kill
them.** Killing by image name would take down Google Drive MCP and Claude Desktop extensions.

**Reconciling the orphan-sweep script:** a SessionStart sweep flags PID 49516 (`hermes-agent`) as
`ORPHANED_PARENT_GONE`. That conflicts with the allowlist above. **The allowlist wins** (L0 1.17),
and the script is DRY-RUN/report-only by design. Resolution: **do not kill; review the report.** Do
not run it with `-Apply` on the strength of that single row.

**Transferable lesson:** never compare a local-time process start against a UTC timestamp, and never
infer process ownership from timing. Read the command line.

## 9. Verification

- **Data claims:** re-run the read-only SQL in section 1 against the project-scoped Supabase MCP.
- **Map UI:** ~~after the row-1 publish, load `/matrix-map` as a member and confirm 68 visible
  samples~~ **N/A -- row 1 is cancelled and no publish will occur.** The 68 figure was wrong anyway
  (the flip would have yielded 1237). Member-visible count stays at 40 until the row-5 policy ruling.
  The tier badge already renders for surveyed points and needs no new verification.
- **Deploy health:** compare the Vercel production alias SHA against `origin/main`; the check added
  in Lane 2 should fail loudly when they diverge.
- **KB:** `tooling/wiki` tests plus `graph_smoke.py` thresholds; no Ollama, no nightly, no hooks.
- **Docs:** `npm run docs:gate -- --base origin/main --head HEAD` must pass, including the row-35 fix.
- **Regression safety:** never delete a regression test to make a gate pass; investigate why it exists.

## 10. Appendix -- exact queries behind the section 1 metrics

Re-runnable read-only via the project-scoped Supabase MCP (`execute_sql`). These drive the top MAP
priorities, so the execution session must re-run rather than trust them.

```sql
-- headline counts
select
  (select count(*) from matrix_map.dras) as dras_total,
  (select count(*) from matrix_map.dras where public) as dras_public,
  (select count(*) from matrix_map.samples) as samples_total,
  (select count(*) from matrix_map.samples s
     join matrix_map.dras d on d.id = s.source_dra_id
   where d.public) as samples_public_visible,
  (select count(*) from matrix_map.samples where source_dra_id is null) as samples_orphan,
  (select count(*) from matrix_map.sample_events) as sample_events_total,
  (select count(*) from matrix_map.measurements) as measurements_total;

-- data quality
select
  (select count(distinct se.sample_id)
     from matrix_map.sample_events se
     join matrix_map.measurements m on m.sample_event_id = se.id) as samples_with_measurements,
  (select count(*) from matrix_map.samples
    where latitude is null or longitude is null) as samples_missing_coords,
  (select count(*) from matrix_map.dras d
    where exists (select 1 from matrix_map.samples s
                   where s.source_dra_id = d.id)) as dras_with_samples;

-- THE decisive query: coordinate tier vs publication
select d.public, s.coordinate_quality_tier, count(*) as samples,
       count(distinct s.source_dra_id) as dras
  from matrix_map.samples s
  left join matrix_map.dras d on d.id = s.source_dra_id
 group by 1,2 order by 1 desc nulls last, 3 desc;

-- the 4 DRAs formerly proposed as publish candidates (row 1, now CANCELLED).
-- WARNING: this query filters to tier='high' and therefore HIDES the 1169 centroid samples in the
-- same DRAs. It is the query that produced the retracted "28 samples / 4 surveyed DRAs" reading.
-- To assess a real flip, use the mandatory preflight in the centroid packet section 9 instead,
-- which groups by DRA and counts BOTH tiers.
select d.id, d.title, d.public, count(*) as samples
  from matrix_map.samples s join matrix_map.dras d on d.id = s.source_dra_id
 where s.coordinate_quality_tier = 'high'
 group by d.id, d.title, d.public order by d.public desc, samples desc;
```

Non-SQL evidence commands:

```bash
git rev-list --count HEAD..origin/main            # 349
gh pr list --state open --json number --jq length # 8
gh variable list; gh secret list                  # E2E active; no SENTRY_*
# worktree cleanup inventory -- PR state, NOT ancestry (repo squash-merges)
gh pr list --state all --limit 1000 --json headRefName,state
git worktree list --porcelain | awk '/^branch /{sub("refs/heads/","",$2); print $2}'
```

## 11. Explicitly out of scope

No catalog applies, no `current_default` promotion, no verdict writes, no default-policy library
mutation, no Supabase writes, no publish flips, no merges, no destructive cleanup, no Ollama /
KB Phase 4+. (The #703/#704 seven-file freeze is **lifted** -- both merged 2026-07-20. Verify only
that #705, or any newly-opened PR, does not introduce a fresh overlap.)
