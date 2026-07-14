# SSTAC-Dashboard -- Top 50 Priority Tasks Toward Completion (2026-07-14 refresh)

Refresh of `docs/MATRIX_OPTIONS_TOP50_PRIORITY_TASKS_2026_07_13.md` (base) cross-checked against
`docs/TOP50_PROGRESS_2026_07_13.md` (2026-07-13d progress ledger) and today's 2026-07-14 merges.
Same schema, same tiers, same gate legend, same PRODUCTION-WRITE GUARD banner as the 2026-07-13 doc.

## Changes since 2026-07-13 (this refresh) -- summary

**New baseline: `origin/main` = a3d9110** (was df7db68 at the 2026-07-13 doc's writing; the
2026-07-13d progress-ledger run advanced it through f3868ee via PRs #631/#628/#630/#632/#633/#634/#635
before today's 5 additional merges landed).

Five PRs merged 2026-07-14:
- **#641** -- T40 admin-tier authenticated E2E scaffolding (skip-safe: skips unless
  `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` + `E2E_AUTH_ENABLED` are set; admin-auth project FAILS on
  login bounce without them). Still needs owner to CREATE an admin test user + set the
  `E2E_ADMIN_*` secrets to activate.
- **#642** -- DRA publish post-write read-back (read-only) + IOCO Shoreline publish INVESTIGATION
  packet. IOCO publish itself remains owner-gated (in-app admin JWT retry); the read-back now
  surfaces a non-persist loudly instead of silently.
- **#643** -- docs: sodium route-specific design packet + PCB value-migration evidence packet.
- **#644** -- opt-in ADAF-adjusted BaP-eq helper (NON-default, single-bin, behind tests; NOT
  registered in `equationDispatch`; the BaP default stays EPA 2.0).
- **#645** -- DRA coordinate dry-run diagnostics scripts + candidate-1 (Howe Sound) BLOCKER packet
  (1234pg AES-encrypted PDF, coordinate table on image pages). Extraction still needs an attended
  targeted-page-range docling-OCR session.

**Gate-0 truths established today** (verified read-only against a3d9110; these RECLASSIFY three
items rather than close them):
- **Sodium (part of old #11) is ALREADY-SATISFIED, not a gap.** The Evidence Library already
  renders both sodium bases (34.3 + 21.2 mg/kg-bw/day) with an explicit "no current default"
  disposition (`keep_current_default_no_eligible_candidate`). No source gap exists. Only an
  optional lock-in regression test remains. The copper half of old #11 is unaffected and stays
  owner-gated.
- **BaP/ADAF "fuller wiring" (old #8/#15) splits into two distinct decisions.** The remaining
  increment is a multi-bin `{ageBin,exposureFraction}[]` exposure-weighting API -- a methodology
  judgment, owner-gated, separate from the D2 anchor-source ruling. All guards are tested; there is
  no live caller. PR #644's opt-in single-bin helper was the safe increment; UI wiring stays
  blocked on D2/D3.
- **PCB (D3, old #9) re-key is STAGED as a NON-APPLIED dry-run**, not resolved: a docs plan + a
  fixture-only resolver test are pending as `feat/pcb-rekey-dryrun-2026-07-14`. Key new finding:
  re-keying the RfD-food alias (BC 0.00013) would DUPLICATE the existing canonical
  `pv-p28-pcb-hh-food-rfd` row, and the FCV alias (0.014) duplicates the canonical current_default
  -- a merge-vs-coexist question. The actual re-key stays owner-gated on a site-congener QP
  protectiveness check.

**Items newly DONE and removed from the ranked 50** (fully left the critical path; historical, no
further action -- kept only in this changelog, not as rows): merge PR #620 (old #1), fresh
post-#620 worktree (old #2), the resolveTupleRecord current_default audit (old #14), the
hitl-packets role-gate ship + non-CEW voter re-verify (old #20/#21, both closed by PR #628), the
2026-07-01 HITL group re-triage (old #27), the MatrixMapStatsShell unit test (old #46, already
existed), the matrix-map ad-table/ks-table lookup tests (old #47, already existed), and the
docs-manifest test-count refresh (old #48, PR #625).

**Items newly DONE and KEPT as marked-DONE rows at the top (Tier 0)** because they were the
highest-impact completions and remain useful markers of the critical path: D1 dioxin-TEQ promote
(old #3, PR #627), T31 STEP-2 measurement-load apply (old #6), surfacing surveyed-vs-centroid
coordinate provenance in exports (old #18, PR #635 -- the progress-ledger table row lagged its own
addendum, corrected here), SSD workbench end-to-end verify (old #35, lib-level complete; a full
numeric owner-reference-dataset pass remains optional), and the living MO completion-status doc
(old #50, PR #631).

**9 backfill items added** (net: -9 dropped, +9 backfilled, 5 repositioned to Tier 0 -- count
holds at 50) to capture concrete new next-actions spawned by today's 5 merges and the gate-0
findings: activating the #641 admin-E2E secrets, closing the #642 IOCO JWT-retry blocker, merging
the PCB dry-run PR, the PCB site-congener QP check, an optional sodium lock-in test, the ADAF
multi-bin methodology ruling, the Howe Sound attended-OCR session, gating/merging the 5 open PRs
themselves, and extending the read-back pattern to other DRA publish paths.

**Net re-ranking direction unchanged:** inhalation stays parked; catalog arbitration + map/DRA
extraction + T40 E2E + security/RBAC still lead. Nothing today changed the owner's priority
direction -- today's work advanced diagnostics and staged one dry-run PR, but did not resolve any
of the owner-gated catalog rulings (D2, D3, IRIS, copper, RLS, inhalation).

---

## Project goal (per CLAUDE.md L1)

A complete Next.js "Agentic OS" dashboard -- Matrix Options calculators + Matrix Map + BN-RRM + SSD +
CEW/TWG + Agentic OS terminal, backed by VERIFIED regulatory values. "Completion" = owner-gated catalog
arbitration finished, matrix-map data fully loaded + published appropriately, E2E coverage on, and the
remaining feature lanes (inhalation, coordinate extraction) shipped.

## How this list was built

Base: `docs/MATRIX_OPTIONS_TOP50_PRIORITY_TASKS_2026_07_13.md` (3 parallel Sonnet Explore agents +
Opus ranking over the post-PR#620 tree). Updated against:
- `docs/TOP50_PROGRESS_2026_07_13.md` (2026-07-13d progress ledger; 13 done / 1 PR-open / 1
  in-progress / 22 owner-gated / 4 blocked / 9 not-started at that run).
- `docs/MATRIX_OPTIONS_MO_NEXTRUN_OWNER_DECISIONS_CONSOLIDATED_2026_07_12.md` (15 batched
  owner-gated items -- re-skimmed; none resolved today, three reclassified per gate-0 above).
- Owner-supplied ground truth for the 2026-07-14 merges (#641-#645) and gate-0 findings (treated as
  verified, not re-derived).
- `docs/INDEX.md` (skimmed for pointers; no changes affecting this list).

## Baseline data-truth corrections established this session (supersede stale docs/memory)

Carried forward from 2026-07-13 (unchanged unless noted):
- Catalog size is **1779 rows** (parameter_values 106 + human_health_trv 1574 + eco 99). Live flags:
  **468 needs_review / 83 current_default** (as of 2026-07-13; not re-verified today).
- Cumulative-effects math (TEQ/BaP-eq) is COMPLETE and tested; D1 is now APPLIED (PR #627); the UI
  remains unwired pending D2/D3 (see Tier 3).
- Inhalation `deriveInhalationStandards()` still hardcodes `blocked = true`; still no component.
- `/api/hitl-packets/*` now HAS a reviewer/admin role gate (PR #628, DONE -- previously auth-only).
- DRA publication baseline (2026-07-13d verified): **574 dras, 3 public / 571 private**. Publication
  work is pilot EXPANSION; centroid-heavy DRAs need source-coordinate extraction first (advanced by
  PR #645 diagnostics; Howe Sound candidate-1 is still blocked on an attended OCR session).
- **NEW today:** sodium_ion default-policy question has NO source gap -- both bases already render
  in the Evidence Library with an explicit disposition. Treat old #11's sodium half as resolved.
- **NEW today:** PCB re-key (D3) has a non-applied dry-run PR pending
  (`feat/pcb-rekey-dryrun-2026-07-14`); the actual re-key decision is unchanged (owner-gated).
- **NEW today:** the ADAF/BaP multi-bin exposure-weighting API is confirmed to be a SEPARATE
  methodology decision from the D2 anchor-source ruling; PR #644 shipped the safe opt-in
  single-bin helper without touching the default.
- `origin/main` = **a3d9110** (was df7db68 on 2026-07-13; passed through f3868ee via the 07-13d run's
  7 merges before today's 5).

## Ranking methodology

Rank = (impact toward completion) x (readiness / cheapness) x (unblocking power), then re-ordered to
the owner priority direction: **inhalation is deprioritized / parked** and ranks below catalog
arbitration, measurement-load / map usefulness, T40 authenticated E2E, DRA source-coordinate
extraction, and security / RBAC. Items 1-5 are completed-since-last-refresh markers (Tier 0); items
6-~26 are the completion-critical path. Note the "50" undercounts true work: catalog arbitration
(Tier 3), Group-3 wiring, and the P28 sweep each contain dozens of internal sub-decisions.

Gate legend: OWNER = owner decision/attestation; CODE; DATA = production data write; VERIFY.

> PRODUCTION-WRITE GUARD (applies to every row): this ranking is a priority map, NOT apply authority.
> Every catalog `--apply`, Supabase write, DRA publish/flip, and secret/variable action requires a
> SEPARATE exact-operation owner approval, `/codex-review` GREEN where applicable, and pre/postflight
> reporting (the T32 id-keyed fail-closed DO-block is the template). Being high on this list never
> authorizes a write.

## The Top 50

### Tier 0 -- Completed since 2026-07-13 (kept as markers; no further action)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 1 | D1 dioxin-TEQ promote `--apply` (1 row) -- DONE | catalog | VERIFY(codex) | S | PR #627 |
| 2 | T31 undated-measurement STEP-2 apply (+4178 events / +5752 measurements) -- DONE | matrix-map data | VERIFY | L | liveload_apply_closeout.md |
| 3 | Surface surveyed-vs-centroid coordinate tier in exports/reporting -- DONE | matrix-map | VERIFY | S | PR #635 |
| 4 | SSD workbench end-to-end verify -- DONE (lib-level; full numeric owner-dataset pass optional) | matrix-options | VERIFY | M | hcp/aggregation/cleaning/export/model/supabase/taxonomy/upload tests + ssd-workbench e2e |
| 5 | Living "MO completion status" doc stood up -- DONE | docs/process | VERIFY | S | PR #631 |

### Tier 1 -- cheap, ready, high-value applies (small blast radius)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 6 | Gate + merge the 5 2026-07-14 PRs (#641-#645) -- DONE 2026-07-14 (merged #643/#645/#644/#642/#641; origin/main a3d9110) | infra/docs | VERIFY(CI) | S | PRs #641-#645 |
| 7 | Expand DRA pilot: publish IOCO Shoreline (ea15e94a) via flip_dra_public -- coordinate-safe, +6 samples (4th public DRA) | DRA/map | OWNER+DATA+codex-on-exact-call | S | DRA/IOCO packet / PR #642 investigation |
| 8 | Resolve IOCO Shoreline in-app admin-JWT publish-retry blocker surfaced by #642's read-back (distinct from the publish-policy decision at #7/#12) | DRA/map | OWNER+CODE | S | PR #642 |
| 9 | Confirm cadmium + methylmercury current_default (confirm-only, no value change; HC-policy pref over lower IRIS) | catalog | OWNER | S | consolidated sA item2 / Lane1 item6 |

### Tier 2 -- measurement-load / map usefulness
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 10 | DRA publication expansion policy: from 3 public / 571 private -- decide expansion tier/criteria off the surveyed-coordinate pilot (centroid-heavy need extraction first, see Tier 4) | matrix-map/DRA | OWNER(policy) | L | MATRIX_MAP_STATUS item2 / completion-status item2 |
| 11 | Evaluate extracted + other located DRAs for publish-readiness (feeds #10 expansion) | DRA | OWNER | M | DRA/IOCO packet s3 |

### Tier 3 -- catalog arbitration + cumulative-effects UI (intertwined; D2/D3 unblock the cumulative UI)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 12 | D2 benzo_a_pyrene anchor-source ruling (sf_oral HC1.289 vs IRIS2.0 vs adult1.0) -- NOW SCOPED to the anchor decision only; the ADAF exposure-weighting API is a separate item (#16) | catalog | OWNER(tox judgment) | M | consolidated sA item6 / Lane1 item5 |
| 13 | D3 PCB Option A/B/C ruling (closes aroclor_1254 default + pcbs_non_coplanar alias + ~9 conflicting rows) | catalog | OWNER(policy) | M | consolidated sA item5 / Lane1 item4 |
| 14 | Review + merge PR #646 `feat/pcb-rekey-dryrun-2026-07-14` (docs plan + fixture-only resolver test, non-applied; codex-GREEN, gates pass) | catalog/docs | VERIFY(CI) | S | PR #646 |
| 15 | PCB re-key: owner site-congener QP protectiveness check to resolve merge-vs-coexist (RfD-food alias duplicates canonical `pv-p28-pcb-hh-food-rfd`; FCV alias duplicates canonical current_default) | catalog | OWNER(chemistry) | S-M | PR #643 evidence packet / #13 |
| 16 | ADAF multi-bin `{ageBin,exposureFraction}[]` exposure-weighting API -- methodology-package ruling, separate from #12; PR #644's opt-in single-bin helper is the safe interim, no live caller | catalog/calc | OWNER(methodology) | M | PR #644 |
| 17 | 41 IRIS needs_review alternates -- per-group disposition (8 subs / 20 groups); author promote script after ruling | catalog | OWNER(policy) | M | consolidated sA item3 / arbitration preflight s4a |
| 18 | Copper Protocol-28 route-split rows disposition (HC 0.426 vs P28 0.09 vs P28-water 0.141) -- sodium half of the old combined item is RESOLVED (see #21) | catalog | OWNER | S | consolidated sA item4 / Lane1 item7 |
| 19 | Reconcile catalog-count ambiguity (HH-only 13/31/85 vs full union 33/62/157) + define "20 supersede-or-reject" | catalog | OWNER(clarify) | S | consolidated sA item8 / arbitration preflight s6 |
| 20 | 357 P28 verify-vs-primary sweep (vision-first PDF, one-by-one; own multi-session lane) | catalog | OWNER+VERIFY | L | consolidated sA item7 / P28 worklist |
| 21 | Optional: author a lock-in regression test for the sodium_ion "no current default / dual-base" disposition (gate-0 confirms no source gap; cheap, non-blocking) | catalog/test | CODE(low) | S | PR #643 evidence packet |
| 22 | Wire cumulative TEQ/BaP-eq scoring UI (A3b): register computeTEQ/computeBaPeq in equationDispatch + build component (D1 done; now blocked only on D2/D3) | matrix-options calc | CODE(post-12/13) | M-L | completion-status HITL item7 |
| 23 | Extend dl-PCB TEQ-TDI from screening-only to full HHDirectContact integration once D3 (#13) lands | matrix-options calc | OWNER(post-13)+CODE | M | code: dlPcbTeqTdi wired as card only |

### Tier 4 -- DRA source-coordinate extraction (map quality; gates further publication)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 24 | Run an attended targeted-page-range docling-OCR session against the Howe Sound candidate-1 PDF (1234pg, AES-encrypted, coordinate table on image pages) | matrix-map data | CODE+OWNER(attend) | L | PR #645 blocker packet |
| 25 | Coordinate-extraction lane for the remaining centroid-only DRAs (r-0074 / Lot C / Site 14764): apply the #645 diagnostics harness once Howe Sound proves the method | matrix-map data | CODE+DATA | L | PR #629 / PR #645 |
| 26 | Extend the #642 post-write read-back pattern to other DRA publish/flip paths (not just IOCO) so a silent non-persist can't recur elsewhere | matrix-map/security | CODE | S | PR #642 pattern |

### Tier 5 -- security / RBAC hardening
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 27 | Tighten RLS-bypass: dras_admin_all allows un-audited direct UPDATE dras SET public outside flip_dra_public (trigger vs accept-for-v1) | security/db | OWNER+migration | S | completion-status item5 / RLS hardening design |

### Tier 6 -- T40 authenticated E2E
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 28 | Enable authenticated (member-tier) E2E: GH secrets E2E_TEST_EMAIL/PASSWORD (existing user) + var E2E_AUTH_ENABLED=true | infra | OWNER(secrets) | S | T40 admin-tier gate / ci.yml |
| 29 | Create admin test user + set E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD/E2E_AUTH_ENABLED to activate PR #641's admin-tier E2E scaffolding (currently skip-safe; login-bounce until configured) | infra | OWNER(create user + secrets) | S | PR #641 |

### Tier 7 -- inhalation (DEPRIORITIZED / parked -- owner direction; ranks below all completion-path lanes above)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 30 | Inhalation VF/PEF model decision (Option A/B/C; eng rec B=user-supplied) + source anchor + T33 unit-basis confirm | matrix-options calc | OWNER(architecture) | L | consolidated sE item15 / inhalation packet |
| 31 | Build inhalation calculator + UI post-decision: wire deriveInhalationStandards, add component+tab, promote 97 RfC/IUR rows behind 5 guard tests | matrix-options calc | CODE(post-30)+OWNER | L | inhalation packet / completion-status s3 |

### Tier 8 -- older 2026-07-01 HITL backlog (re-triage complete 2026-07-13; live items below)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 32 | Group 4: approve 'inorganic' ContaminantClass (types.ts one-line union add) -- unblocks 37-substance cohort | matrix-options calc | OWNER(architecture) | S | HITL 07-01 Group4 |
| 33 | Group 3: wire ~90 substance/field gaps post Group-4 (incl. PHC/lmw_pahs 5-substance bundle currently UI-unreachable) -- IN PROGRESS | matrix-options calc | OWNER(picks)+CODE | L | HITL 07-01 Group3 |
| 34 | Group 1: 11 value corrections (5 HH + 6 eco receptor picks) | catalog | OWNER | M | HITL 07-01 Group1 |
| 35 | Group 2: abs_dermal anomalies (10 rows / ~24 entries) revert-to-class-default vs confirm RAF | catalog | OWNER(chemistry) | M | HITL 07-01 Group2 |
| 36 | Group 5: provenance/text HITL (~44 entries, zero numeric change -- complete truncated sources, dual-source citations, disclosures) | catalog docs | OWNER(doc-truth) | S | HITL 07-01 Group5 |

### Tier 9 -- verification gaps
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 37 | T39 calculator cross-check vs a PRIMARY worked example (owner provides HC/EPA input->output; verify no fabrication) | matrix-options verify | OWNER(provide example) | M | completion-status s5 |
| 38 | T20 design ruling: exclude medium-tier (BC-CSR centroid, 98.5%) from station UCL/statistics? (likely no) | matrix-map | OWNER | S | MATRIX_MAP_STATUS item5 |

### Tier 10 -- Regulatory-Review / Engine-V2 (dated 07-09; re-verify against current src before acting)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 39 | Verify Export CSV/MD/HTML + export-memo against real (non-stub) data | reg-review | VERIFY | S-M | NEXT_STEPS 07-09 |
| 40 | One real judgment save + one real "Ask AI" chat query vs live eval 33333333 (needs Ollama under schedule protocol) | reg-review | VERIFY+Ollama-schedule | S | NEXT_STEPS 07-09 |
| 41 | Resolve pyramid-navigation status (target files absent in src/ -- not started or superseded?) | reg-review | CODE(uncertain) | L | PHASE1_PYRAMID doc |
| 42 | Submission-search performance plan (in-memory JSON scan; denormalize/FTS past ~1K assessments) | reg-review | CODE(deferred) | M | CHAT_AND_SEARCH plan Phase B |
| 43 | Remove deprecated /api/regulatory-review/run-engine route (501 stub) once no external callers | reg-review | CODE(cheap) | S | NEXT_STEPS route-inventory |

### Tier 11 -- low-priority / hygiene
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 44 | Refresh Agentic OS "Agents" tab placeholder copy (deliberate static; real runs surface in Logs) | agentic-os | CODE(low) | S | code: TerminalPanel.tsx |
| 45 | Worktree cleanup triage: ~50+ worktrees (now +1 for this refresh, +1 gate0-readonly), many stale/merged; junction-first prune (L0 1.15) after owner review | infra hygiene | OWNER+careful | M | git worktree list |
| 46 | Resolve primary-checkout dirty state: disposition of uncommitted config/skill edits (.claude/.codex/AGENTS.md) | infra hygiene | OWNER | S | git status |
| 47 | Untracked root-scratch cleanup: move loose .py/.mjs/.txt scratch files out of root (no auto-delete) | hygiene | OWNER | S | git status |
| 48 | Re-verify Subscriptions "PR-2" scope (NotebookLM panels) -- strings gone from current SubscriptionsView; confirm superseded | agentic-os | CODE(uncertain) | M | subscriptions handoff 05-16 |
| 49 | Reconcile AGENTS.md Supabase Protocol vs stale CLAUDE.md "MCP fails 100%" text (remove the contradiction) | docs/infra | OWNER(protected CLAUDE.md) | S | handoff s4 / CLAUDE.md L1 |
| 50 | Re-verify Group-3 (#33) and P28-sweep (#20) sub-item counts against current catalog state before the next execution session (both contain dozens of internal decisions the flat count undersells) | catalog/process | VERIFY | S | this refresh |

## Suggested execution sequence (near-term)

1. Gate + merge #641-#645 (#6) -- cheap, mechanical, already codex-approved per today's report.
2. IOCO publish (#7) + resolve its JWT-retry blocker (#8) + cadmium/methylmercury confirm (#9) --
   all cheap, ready, small blast radius.
3. Catalog arbitration D2 anchor (#12), D3 PCB (#13, plus its dry-run merge #14 and QP check #15),
   ADAF methodology (#16), IRIS (#17), copper (#18) -- these unblock the cumulative-effects UI (#22).
4. DRA coordinate extraction: attended OCR session for Howe Sound (#24), then apply the harness to
   the remaining 3 centroid-only DRAs (#25) -- unblocks publication expansion (#10, #11).
5. Security/RBAC (#27) and T40 E2E (#28, #29) can run in parallel with the catalog lane.
6. Inhalation (#30-#31) stays parked until the completion-path lanes above are materially advanced.
