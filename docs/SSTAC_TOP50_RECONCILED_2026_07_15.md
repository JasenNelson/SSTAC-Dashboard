# SSTAC-Dashboard -- Top 50 Priority Tasks Reconciled (2026-07-15)

Baseline: `origin/main` = 09b1686

Changes since 2026-07-14 base doc:
- #648 -> post-merge handoff anchor (process; no ranked row).
- #649 -> CI forwards E2E_ADMIN_* secrets to the E2E job (advances row #29).
- #650 -> NO-WRITE DRA PDF outline/bookmark diagnostic (advances Tier 4 #24/#25).
- #651 -> hitl-packets sub-route role-gate coverage + sodium_ion no-default regression test (closes row #21).
- #652 -> matrix-map /export admin-gate test coverage + guard-audit doc currency (advances row #27).
- #653 -> DRA coordinate dry-run findings + triage (advances Tier 4 #24/#25).
- #654 -> bounded fail-closed DRA OCR dry-run harness + results (advances Tier 4 #24).
- #655 -> DRA well-coordinate parser + structured dry-run extraction review (advances Tier 4 #24/#25).
- #656 -> DRA coordinate apply-readiness packet (NON-WRITING) (advances Tier 4).
- #657 -> FINAL handoff anchor (process; no ranked row).
- #658 -> record authenticated e2e current state (docs) (confirms T40 member-tier row #28 is DONE).
- #659 -> production CSRF same-origin fallback fix (unblocks IOCO Shoreline publish rows #7/#8).

This document reconciles rather than re-ranks the priority list.

## NEWLY DONE / RECLASSIFIED since the base doc

| Base Row | Task | New Status | Evidence |
|---|---|---|---|
| #14 | PCB re-key DRY-RUN plan + fixture-only resolver test | DONE | PR #646 |
| #21 | sodium lock-in test | DONE | PR #651 |
| #28 | T40 member-tier E2E | CORRECTED-DONE | PR #658 / correction |
| #29 | T40 admin-tier E2E | CORRECTED-still-gated | PR #649 / correction |
| #24/#25 | DRA coordinate extraction (Howe Sound / centroid DRAs) | ADVANCED-still-gated | PRs #650, #653, #654, #655, #656 |
| #43 | remove deprecated /api/regulatory-review/run-engine 501 route | CORRECTED-re-scoped | correction |
| N/A | Supabase writes protocol | CORRECTED | correction |
| #7/#8 | IOCO Shoreline publish + JWT-retry blocker | ADVANCED-unblocked | PR #659 |

> RULINGS UPDATE (2026-07-15): rows #7, #8, #9, #12, #13, #15, #16, #17, #18, #19 below were
> subsequently RULED in `STAGE1_DECISION_LOG_2026_07_15.md` -- that log is AUTHORITATIVE for their
> current status. Notably #8 is RESOLVED (read-back shipped in #642 + CSRF fixed by #659) and #7 is
> publish-APPROVED (in-app flip pending). The tables below are the pre-ruling snapshot; where they
> differ from the log, the log governs.

## LIVE REMAINING (still open)

### Tier 1 -- cheap, ready, high-value applies (small blast radius)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 6 | Gate + merge the 5 2026-07-14 PRs (#641-#645) -- DONE 2026-07-14 (merged #643/#645/#644/#642/#641; origin/main a3d9110) | infra/docs | VERIFY(CI) | S | PRs #641-#645 |
| 7 | Expand DRA pilot: publish IOCO Shoreline (ea15e94a) via flip_dra_public -- coordinate-safe, +6 samples (4th public DRA) **[CORRECTED: unblocked by #659 CSRF fix]** | DRA/map | OWNER+DATA+codex-on-exact-call | S | DRA/IOCO packet / PR #642 investigation |
| 8 | Resolve IOCO Shoreline in-app admin-JWT publish-retry blocker surfaced by #642's read-back (distinct from the publish-policy decision at #7) **[RESOLVED 2026-07-15 (decision log ruling 3): read-back shipped in #642 + 403 cleared by #659; remaining action is the #7 in-app flip]** | DRA/map | OWNER+CODE | S | PR #642 |
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
| 15 | PCB re-key: owner site-congener QP protectiveness check to resolve merge-vs-coexist (RfD-food alias duplicates canonical `pv-p28-pcb-hh-food-rfd`; FCV alias duplicates canonical current_default) | catalog | OWNER(chemistry) | S-M | PR #643 evidence packet / #13 |
| 16 | ADAF multi-bin `{ageBin,exposureFraction}[]` exposure-weighting API -- methodology-package ruling, separate from #12; PR #644's opt-in single-bin helper is the safe interim, no live caller | catalog/calc | OWNER(methodology) | M | PR #644 |
| 17 | 41 IRIS needs_review alternates -- per-group disposition (8 subs / 20 groups); author promote script after ruling | catalog | OWNER(policy) | M | consolidated sA item3 / arbitration preflight s4a |
| 18 | Copper Protocol-28 route-split rows disposition (HC 0.426 vs P28 0.09 vs P28-water 0.141) -- sodium half of the old combined item is RESOLVED (see #21) | catalog | OWNER | S | consolidated sA item4 / Lane1 item7 |
| 19 | Reconcile catalog-count ambiguity (HH-only 13/31/85 vs full union 33/62/157) + define "20 supersede-or-reject" | catalog | OWNER(clarify) | S | consolidated sA item8 / arbitration preflight s6 |
| 20 | 357 P28 verify-vs-primary sweep (vision-first PDF, one-by-one; own multi-session lane) | catalog | OWNER+VERIFY | L | consolidated sA item7 / P28 worklist |
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
| 29 | Admin-tier positive E2E remains gated: create or verify admin test user + set E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD to activate PR #641's admin-tier E2E scaffolding (currently skip-safe; login-bounce until configured). Do not confuse this with completed member-tier setup. **[CORRECTED: still OWNER-GATED; #649 wired the CI passthrough]** | infra | OWNER(create/verify user + secrets) | S | PR #641 |

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
| 43 | Remove deprecated /api/regulatory-review/run-engine route (501 stub) once no external callers **[CORRECTED: NOT cheap -- there is a live UI caller `src/app/(dashboard)/regulatory-review/components/RunEngineButton.tsx` plus references in `src/types/api.ts` and `docs/API_REFERENCE.md`. Re-scope it as a caller-removal + type + docs ripple, not a bare route deletion.]** | reg-review | CODE(cheap) | S | NEXT_STEPS route-inventory |

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

## Suggested near-term sequence

1. Gate + merge #641-#645 (#6) -- cheap, mechanical, already codex-approved per today's report.
2. IOCO publish (#7) + resolve its JWT-retry blocker (#8) + cadmium/methylmercury confirm (#9) -- all cheap, ready, small blast radius. (Note: #7/#8 now unblocked by the #659 CSRF fix).
3. Catalog arbitration D2 anchor (#12), D3 PCB (#13, plus its dry-run merge #14 and QP check #15), ADAF methodology (#16), IRIS (#17), copper (#18) -- these unblock the cumulative-effects UI (#22).
4. DRA coordinate extraction: attended OCR session for Howe Sound (#24), then apply the harness to the remaining 3 centroid-only DRAs (#25) -- unblocks publication expansion (#10, #11).
5. Security/RBAC (#27) and T40 E2E (#28, #29) can run in parallel with the catalog lane.
6. Inhalation (#30-#31) stays parked until the completion-path lanes above are materially advanced.
