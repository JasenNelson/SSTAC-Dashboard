# SSTAC-Dashboard -- Top 50 Priority Tasks Reconciled (2026-07-17)

Baseline: origin/main = 74900bf

This doc supersedes the 2026-07-15 reconciliation; it folds in the 2026-07-16/17 catalog
apply lanes (#666-#669) and the 2026-07-17 session (PR #670 + rulings).

This document reconciles rather than re-ranks the priority list.

> STAGE-1 RULINGS CARRIED FORWARD (per `STAGE1_DECISION_LOG_2026_07_15.md`, still current, no
> further supersession found): #9 (cadmium/methylmercury current_default) RULED confirm-only,
> no write needed. #12 (D2 benzo_a_pyrene anchor) RULED keep EPA 2.0 anchor, no write needed.
> #19 (catalog-count reconciliation) RULED adopt live-verified count, no write needed. #15 (PCB
> re-key QP protectiveness check) RULED packet-draft authorized but migration still BLOCKED
> pending the QP packet -- see Tier 2 #13 below for the current framing (deferred on
> owner-sourced site logKow data).

## NEWLY DONE / RECLASSIFIED since 2026-07-15

| Base Row | Task | New Status | Evidence |
|---|---|---|---|
| #16 | Multi-bin ADAF lifetime BaP-eq function | DONE | PR #661 |
| #17 | IRIS 41 needs_review alternates disposition | DONE | PR #668 (superseded all 41) |
| #18 | Copper Protocol-28 route-split disposition | DONE | PR #667 (disposed 6 redundant rows) |
| #22 | Cumulative TEQ/BaP-eq UI | DONE | PR #662 -- NOTE: permanently card-only BY DESIGN (decision D0); intentionally NOT registered in equationDispatch. The old row-#22 wording ("register in equationDispatch") is SUPERSEDED by the shipped design. |
| #26 | Extend post-write read-back to other DRA publish paths | DONE/N-A | The app has only ONE DRA write surface (matrix-map admin publish route), which already has the #642 read-back; nothing to extend. |
| #27 | RLS flip-only trigger (dras_admin_all hardening) | DONE + live-verified 2026-07-12 | migration `20260712164723_matrix_map_flip_dra_public_trigger.sql`. Only an OPTIONAL defense-in-depth REVOKE remains. |
| #32 | Approve 'inorganic' ContaminantClass | DONE | added 2026-07-02, commit e488239 |
| #33 | PHC/lmw_pahs bundle | IN PROGRESS | lmw_pahs SHIPPED this session (PR #670, eco-food-web-only, contaminantClass organic, bsaf 1.5, trv_eco null via resolveEcoSeed). The other 5 keys (phc_f1..f4, total_phcs) remain BLOCKED (not in ERDC BSAF DB + unresolved aggregate double-counting policy). |
| #34 | HITL Group 1 (value corrections) | DONE/superseded | 0 open items |
| #43 | Remove deprecated run-engine 501 route + ripple | DONE | PR #663 |
| #44 | Agentic OS Agents-tab placeholder copy | DONE | PR #664 |
| #48 | Subscriptions PR-2 NotebookLM scope | DONE/superseded | strings gone; only inert routing stubs remain |
| #49 | AGENTS.md vs CLAUDE.md Supabase-protocol contradiction | DONE/verified | no contradiction on origin/main; both state current MCP-allowed policy, "MCP fails 100%" quoted only as superseded history |
| #50 | Sub-count re-verify | DONE | PR #664 |

### Catalog apply lanes since 2026-07-15

| Item | Status | Evidence |
|---|---|---|
| Copper #18 apply | DONE | PR #667 |
| IRIS #17 apply | DONE | PR #668 |
| PCB HH RfD default -> HC 1.0e-5 | DONE (owner-applied) | PR #669 |
| #35 abs_dermal corrections (pyridine 0.03->0.1; 11 PAH-cohort 0.13->0.148) + #36 cross-ref notes | IN PROGRESS this session | owner-approved, apply PR opening |

## LIVE REMAINING (tiered sections, with true gate per item)

### Tier 1 -- inhalation (owner ruled this session)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 30/31 | Inhalation: owner RULED 2026-07-17 = Option B (user-supplied VF/PEF, fail-closed) PLUS a source-backed default-input catalog lane (EPA RSL/SSG PEF+VF equations verified; HC PQRA/SVI still to be sourced). #31 calculator BUILD IN PROGRESS this session; no VF/PEF default promoted to current_default. | matrix-options calc | CODE(in progress)+OWNER(catalog sourcing) | L | 2026-07-17 session ruling |

### Tier 2 -- catalog arbitration + cumulative-effects UI (buildable this session)
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 23 | dl-PCB TEQ full HH Direct Contact integration: BUILDABLE (owner accepted PCB Option A dual-screen as final); design = 3-way MIN-selection (RfD / SF / dl-PCB TEQ), non-double-counting by construction; build QUEUED this session. | matrix-options calc | CODE(queued) | M | PCB Option A ruling |
| 13 | Cosmetic aroclor_1254 -> "Total PCBs" re-key/relabel -- stays DEFERRED (needs owner-sourced site logKow data; does not block #23 math) | catalog | OWNER(data) | S | PCB Option A ruling |
| 35/36 | HITL Group 2/5 catalog corrections (see catalog apply lanes above) | catalog | OWNER-approved+CODE | S-M | this session |

### Tier 3 -- owner in-app actions
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 7 | IOCO Shoreline publish -- OWNER in-app admin-JWT flip PENDING (AI cannot do it); ruled YES | matrix-map/DRA | OWNER(in-app action) | S | 2026-07-15 ruling |
| 29 | T40 admin-tier E2E -- owner-gated: create admin test user + set E2E_ADMIN_* secrets | infra | OWNER(create/verify user + secrets) | S | PR #641 |

### Tier 4 -- deferred / owner-only
| # | Task | Lane | Gate | Size | Source |
|---|---|---|---|---|---|
| 10/11 | DRA publish policy (expansion tier/criteria) | matrix-map/DRA | OWNER(policy) | L | prior reconciliation |
| 20 | P28 verify sweep | catalog | OWNER+VERIFY | L | prior reconciliation |
| 24/25 | Attended OCR (DRA coordinate extraction) | matrix-map data | CODE+OWNER(attend) | L | prior reconciliation |
| 37 | T39 worked example | matrix-options verify | OWNER(provide example) | M | prior reconciliation |
| 38 | T20 stats-tier design ruling | matrix-map | OWNER | S | prior reconciliation |
| 39/40 | Reg-review verify (Ollama) | reg-review | VERIFY+Ollama-schedule | S | prior reconciliation |
| 41 | Pyramid-nav status-probe needed (may be abandoned) | reg-review | CODE(uncertain) | L | prior reconciliation |
| 42 | Submission-search FTS (deferred >1K assessments) | reg-review | CODE(deferred) | M | prior reconciliation |
| 45/46/47 | Hygiene (worktrees / dirty checkout / root scratch) | infra hygiene | OWNER+careful | M | prior reconciliation |

## Suggested near-term sequence

1. Merge the report-ready PRs (#670 + the #35/#36 apply PR).
2. Finish #31 inhalation build + #23 dl-PCB build.
3. Owner actions #7 (IOCO Shoreline in-app flip) and #29 (admin E2E user/secrets).
4. The VF/PEF default-catalog packet (owner batched decision) + HC source sourcing (PQRA/SVI).
