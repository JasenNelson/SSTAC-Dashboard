# SSTAC-Dashboard -- Top 50 Priority Tasks Toward Completion (2026-07-13)

Deliverable for the fresh-session mandate in
`FRESH_SESSION_HANDOFF_2026_07_13_MIGRATION_AND_TOP50_MANDATE.md` section 0: a ranked, deduplicated
list of the highest-impact remaining tasks to move SSTAC-Dashboard toward its goal and completion.

## Project goal (per CLAUDE.md L1)

A complete Next.js "Agentic OS" dashboard -- Matrix Options calculators + Matrix Map + BN-RRM + SSD +
CEW/TWG + Agentic OS terminal, backed by VERIFIED regulatory values. "Completion" = owner-gated catalog
arbitration finished, matrix-map data fully loaded + published appropriately, E2E coverage on, and the
remaining feature lanes (inhalation, coordinate extraction) shipped.

## How this list was built

Drawn from source docs (NOT re-derived from memory), gathered by 3 parallel Sonnet Explore agents over
the freshest tree (post-PR#620 `origin/main`), then ranked by Opus:
- `docs/MATRIX_OPTIONS_MO_NEXTRUN_OWNER_DECISIONS_CONSOLIDATED_2026_07_12.md` (15 batched owner-gated items)
- `docs/MATRIX_OPTIONS_COMPLETION_STATUS_2026_07_11.md` (HITL queue + Part-3 unlock map)
- The 2026-07-12 readiness packets (catalog arbitration, T31 STEP-1, T32 waterbody, T40 E2E, DRA/IOCO, Lane-1)
- `docs/MATRIX_OPTIONS_HITL_DECISIONS_CONSOLIDATED_2026_07_01.md` (older backlog; partly superseded)
- Direct code reads (matrix-options calculators, catalog loader, security routes, CI config) + `docs/INDEX.md`.

## Baseline data-truth corrections established this session (supersede stale docs/memory)

- Catalog size is **1779 rows** (parameter_values 106 + human_health_trv 1574 + eco 99), NOT ~5019
  (that was a stale `vitest_test_count`). Live flags: **468 needs_review / 83 current_default**.
- Cumulative-effects math (TEQ/BaP-eq) is COMPLETE and tested but the **UI is unwired**.
- Inhalation `deriveInhalationStandards()` hardcodes `blocked = true`; **no component exists**.
- `/api/hitl-packets/*` is auth-only with **no reviewer/admin role gate** (verified in code).
- DRA publication baseline is **3 public / 571 private** (a surveyed-coordinate pilot), NOT 574 / 0.
  Publication work is pilot EXPANSION; centroid-heavy DRAs need source-coordinate extraction first.
- PR #620 (docs-only, T32-applied source of truth) MERGED 2026-07-13; `origin/main` = df7db68.

## Ranking methodology

Rank = (impact toward completion) x (readiness / cheapness) x (unblocking power), then re-ordered to
the owner priority direction: **inhalation is deprioritized / parked** and ranks below catalog
arbitration, measurement-load / map usefulness, T40 authenticated E2E, DRA source-coordinate
extraction, and security / RBAC. Items 1-24 are the completion-critical path. Note the "50" undercounts
true work: catalog arbitration (#8-#16), Group-3 wiring (#29), and the P28 sweep (#13) each contain
dozens of internal sub-decisions.

Gate legend: OWNER = owner decision/attestation; CODE; DATA = production data write; VERIFY.

> PRODUCTION-WRITE GUARD (applies to every row): this ranking is a priority map, NOT apply authority.
> Every catalog `--apply`, Supabase write, DRA publish/flip, and secret/variable action requires a
> SEPARATE exact-operation owner approval, `/codex-review` GREEN where applicable, and pre/postflight
> reporting (the T32 id-keyed fail-closed DO-block is the template). Being high on this list never
> authorizes a write.

## The Top 50

### Tier 0 -- immediate operational
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 1 | Merge PR #620 (docs-only T32-applied source of truth + 07-13 handoff) -- DONE 2026-07-13, origin/main df7db68 | infra/docs | VERIFY(CI) | S | PR #620 |
| 2 | Work from a fresh worktree off post-#620 origin/main; leave stale+dirty primary checkout untouched (no reset) | infra/hygiene | CODE | S | handoff s1 / L0 1.15 |

### Tier 1 -- cheap, ready, high-value applies (small blast radius)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 3 | D1 dioxin-TEQ promote `--apply` (1 row) + same-commit `sanctionedPromotionIds` tripwire edit in catalog.test.ts | catalog | OWNER(attest locator)+CODE+codex | S | consolidated sA item1 / Lane1 packet item1 |
| 4 | Expand DRA pilot: publish IOCO Shoreline (ea15e94a) via flip_dra_public -- coordinate-safe, +6 samples (4th public DRA) | DRA/map | OWNER+DATA+codex-on-exact-call | S | DRA/IOCO packet s1 / consolidated sD item13 |
| 5 | Confirm cadmium + methylmercury current_default (confirm-only, no value change; HC-policy pref over lower IRIS) | catalog | OWNER | S | consolidated sA item2 / Lane1 item6 |

### Tier 2 -- measurement-load / map usefulness
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 6 | T31 undated-measurement STEP-2 apply (+4178 events / +5752 measurements); regenerate -> codex GREEN -> apply_live_load.py | matrix-map data | OWNER(x2)+DATA+VERIFY | L | T31 STEP-1 report s9 / consolidated sB item9 |
| 7 | DRA publication expansion policy: from 3 public / 571 private -- decide expansion tier/criteria off the surveyed-coordinate pilot (centroid-heavy need extraction first, see #17) | matrix-map/DRA | OWNER(policy) | L | MATRIX_MAP_STATUS item2 / completion-status item2 |

### Tier 3 -- catalog arbitration + cumulative-effects UI (intertwined; D1-D3 unblock the cumulative UI)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 8 | D2 benzo_a_pyrene anchor + ADAF scenario ruling (sf_oral HC1.289 vs IRIS2.0 vs adult1.0; ADAF double-count guard) | catalog | OWNER(tox judgment) | M | consolidated sA item6 / Lane1 item5 |
| 9 | D3 PCB Option A/B/C ruling (closes aroclor_1254 default + pcbs_non_coplanar alias + ~9 conflicting rows) | catalog | OWNER(policy) | M | consolidated sA item5 / Lane1 item4 |
| 10 | 41 IRIS needs_review alternates -- per-group disposition (8 subs / 20 groups); author promote script after ruling | catalog | OWNER(policy) | M | consolidated sA item3 / arbitration preflight s4a |
| 11 | copper + sodium_ion Protocol-28 route-split rows disposition (HC vs P28 vs P28-water) | catalog | OWNER | S-M | consolidated sA item4 / Lane1 item7 |
| 12 | Reconcile catalog-count ambiguity (HH-only 13/31/85 vs full union 33/62/157) + define "20 supersede-or-reject" | catalog | OWNER(clarify) | S | consolidated sA item8 / arbitration preflight s6 |
| 13 | 357 P28 verify-vs-primary sweep (vision-first PDF, one-by-one; own multi-session lane) | catalog | OWNER+VERIFY | L | consolidated sA item7 / P28 worklist |
| 14 | Audit 83 current_default rows for the resolveTupleRecord null->unsourced systemic gap (multi-same-value + no current_default row) | catalog | VERIFY | M | MEMORY mo-overnight-4lane |
| 15 | Wire cumulative TEQ/BaP-eq scoring UI (A3b): register computeTEQ/computeBaPeq in equationDispatch + build component (blocked on D1/D2/D3) | matrix-options calc | CODE(post D1-D3) | M-L | completion-status HITL item7 |
| 16 | Extend dl-PCB TEQ-TDI from screening-only to full HHDirectContact integration once D3 lands | matrix-options calc | OWNER(post-9)+CODE | M | code: dlPcbTeqTdi wired as card only |

### Tier 4 -- DRA source-coordinate extraction (map quality; gates further publication)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 17 | Coordinate-extraction lane for 4 centroid-only DRAs (Howe Sound / r-0074 / Lot C / Site 14764): AGY drafts OCR harness, orchestrator runs, write owner-gated | matrix-map data | CODE+DATA | L | consolidated sD item14 / coordinate lane doc |
| 18 | Surface surveyed-vs-centroid tier (98.5% centroid) in exports/reporting, not just the map legend | matrix-map | CODE | S | COORDINATE_PROVENANCE_QA_2026_07_11 |
| 19 | After extraction, evaluate extracted + other located DRAs for publish-readiness (feeds #7 expansion) | DRA | OWNER | M | DRA/IOCO packet s3 |

### Tier 5 -- security / RBAC hardening
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 20 | Add reviewer/admin role gate to /api/hitl-packets/* (verified auth-only today; any logged-in user passes) | security | OWNER(verify sensitivity)+CODE | S | MO_GUARD_ROLE_MODEL_AUDIT / route.ts verified |
| 21 | Re-verify + close the authed non-CEW voter user_id granularity question on /api/graphs/prioritization-matrix (anon leak fixed #608) | security | OWNER+CODE | S | completion-status item9 / route.ts |
| 22 | Tighten RLS-bypass: dras_admin_all allows un-audited direct UPDATE dras SET public outside flip_dra_public (trigger vs accept-for-v1) | security/db | OWNER+migration | S | completion-status item5 / RLS hardening design |

### Tier 6 -- T40 authenticated E2E
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 23 | Enable authenticated (member-tier) E2E: GH secrets E2E_TEST_EMAIL/PASSWORD (existing user) + var E2E_AUTH_ENABLED=true | infra | OWNER(secrets) | S | T40 admin-tier gate / ci.yml |
| 24 | Admin-tier E2E fixture + specs: new admin test user + storageState + real publish/unpublish click-through against throwaway DRA | infra | OWNER(create user)+CODE | M | T40 readiness s3b |

### Tier 7 -- inhalation (DEPRIORITIZED / parked -- owner direction; ranks below all completion-path lanes above)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 25 | Inhalation VF/PEF model decision (Option A/B/C; eng rec B=user-supplied) + source anchor + T33 unit-basis confirm | matrix-options calc | OWNER(architecture) | L | consolidated sE item15 / inhalation packet |
| 26 | Build inhalation calculator + UI post-decision: wire deriveInhalationStandards, add component+tab, promote 97 RfC/IUR rows behind 5 guard tests | matrix-options calc | CODE(post-25)+OWNER | L | inhalation packet / completion-status s3 |

### Tier 8 -- older 2026-07-01 HITL backlog (re-triage before acting; partly superseded)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 27 | Re-triage 07-01 HITL Groups 1-5 vs current catalog state (wiring/IRIS lanes superseded some) -> reconciled live list | catalog/process | VERIFY+OWNER | M | HITL_DECISIONS_CONSOLIDATED_2026_07_01 |
| 28 | Group 4: approve 'inorganic' ContaminantClass (types.ts one-line union add) -- unblocks 37-substance cohort | matrix-options calc | OWNER(architecture) | S | HITL 07-01 Group4 |
| 29 | Group 3: wire ~90 substance/field gaps post Group-4 (incl. PHC/lmw_pahs 5-substance bundle currently UI-unreachable) | matrix-options calc | OWNER(picks)+CODE | L | HITL 07-01 Group3 |
| 30 | Group 1: 11 value corrections (5 HH + 6 eco receptor picks) | catalog | OWNER | M | HITL 07-01 Group1 |
| 31 | Group 2: abs_dermal anomalies (10 rows / ~24 entries) revert-to-class-default vs confirm RAF | catalog | OWNER(chemistry) | M | HITL 07-01 Group2 |
| 32 | Group 5: provenance/text HITL (~44 entries, zero numeric change -- complete truncated sources, dual-source citations, disclosures) | catalog docs | OWNER(doc-truth) | S | HITL 07-01 Group5 |

### Tier 9 -- verification gaps
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 33 | T39 calculator cross-check vs a PRIMARY worked example (owner provides HC/EPA input->output; verify no fabrication) | matrix-options verify | OWNER(provide example) | M | completion-status s5 |
| 34 | T20 design ruling: exclude medium-tier (BC-CSR centroid, 98.5%) from station UCL/statistics? (likely no) | matrix-map | OWNER | S | MATRIX_MAP_STATUS item5 |
| 35 | SSD workbench: verify end-to-end against a known dataset + cover ssd/hcp.ts fail-closed paths | matrix-options | VERIFY | M | code: SSD under lib |

### Tier 10 -- Regulatory-Review / Engine-V2 (dated 07-09; re-verify against current src before acting)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 36 | Verify Export CSV/MD/HTML + export-memo against real (non-stub) data | reg-review | VERIFY | S-M | NEXT_STEPS 07-09 |
| 37 | One real judgment save + one real "Ask AI" chat query vs live eval 33333333 (needs Ollama under schedule protocol) | reg-review | VERIFY+Ollama-schedule | S | NEXT_STEPS 07-09 |
| 38 | Resolve pyramid-navigation status (target files absent in src/ -- not started or superseded?) | reg-review | CODE(uncertain) | L | PHASE1_PYRAMID doc |
| 39 | Submission-search performance plan (in-memory JSON scan; denormalize/FTS past ~1K assessments) | reg-review | CODE(deferred) | M | CHAT_AND_SEARCH plan Phase B |
| 40 | Remove deprecated /api/regulatory-review/run-engine route (501 stub) once no external callers | reg-review | CODE(cheap) | S | NEXT_STEPS route-inventory |

### Tier 11 -- low-priority / hygiene / test coverage
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 41 | Refresh Agentic OS "Agents" tab placeholder copy (deliberate static; real runs surface in Logs) | agentic-os | CODE(low) | S | code: TerminalPanel.tsx |
| 42 | Worktree cleanup triage: ~50 worktrees, many stale/merged; junction-first prune (L0 1.15) after owner review | infra hygiene | OWNER+careful | M | git worktree list |
| 43 | Resolve primary-checkout dirty state: disposition of 7 uncommitted config/skill edits (.claude/.codex/AGENTS.md) | infra hygiene | OWNER | S | git status |
| 44 | Untracked root-scratch cleanup: move loose .py/.mjs/.txt (dump_data.py, e2e-query.mjs, log.txt, ocr_results.txt...) out of root (no auto-delete) | hygiene | OWNER | S | git status |
| 45 | Re-verify Subscriptions "PR-2" scope (NotebookLM panels) -- strings gone from current SubscriptionsView; confirm superseded | agentic-os | CODE(uncertain) | M | subscriptions handoff 05-16 |
| 46 | Add unit test for MatrixMapStatsShell.tsx (untested store-wiring wrapper) | test | CODE | S | code: matrix-options __tests__ gap |
| 47 | Add direct unit tests for matrix-map ad-table.ts / ks-table.ts lookup tables | test | CODE | S | code: matrix-map lib gap |
| 48 | Refresh docs-manifest live test-count fact (stale 5474@07-09; recompute + record) | docs | CODE | S | docs-manifest.json |
| 49 | Reconcile AGENTS.md Supabase Protocol vs stale CLAUDE.md "MCP fails 100%" text (remove the contradiction) | docs/infra | OWNER(protected CLAUDE.md) | S | handoff s4 / CLAUDE.md L1 |
| 50 | Stand up ONE living "MO completion status" doc that supersedes the scattered 07-11 / 07-12 / this Top-50 status docs | docs/process | CODE | S | multiple status docs |

## Suggested execution sequence (near-term)

1. #620 merge (DONE) -> D1 dioxin-TEQ apply (#3, cheapest scripted catalog write) once owner attests
   the HC v4.0 p.42 locator.
2. IOCO publish (#4) + cadmium/methylmercury confirm (#5) -- both cheap, ready.
3. T31 STEP-2 (#6) -- the single biggest map-data unlock; two-gate owner approval + regenerate + codex.
4. Catalog arbitration D2/D3/IRIS/copper (#8-#11) -- these unblock the cumulative-effects UI (#15).
5. DRA coordinate extraction (#17) -- unblocks publication expansion (#7, #19).
6. Security/RBAC (#20-#22) and T40 E2E (#23-#24) can run in parallel with the catalog lane.
7. Inhalation (#25-#26) is parked until the completion-path lanes above are materially advanced.
