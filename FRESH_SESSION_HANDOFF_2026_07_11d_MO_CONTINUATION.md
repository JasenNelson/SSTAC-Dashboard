# Fresh Session Handoff -- 2026-07-11d (MO completion push: merged + cap applied + publication flow built)

Supersedes the 2026-07-11c handoff. Plain ASCII. Everything below is committed/merged unless marked open.
Next session: ENTER PLAN MODE, build a NEW ~50-task plan for the remaining items (see section 4).

## 0. What shipped this session (all merged to main; final tip after this handoff = origin/main)
12 PRs merged this run + 1 production DB change:
- #595 cap owner packet; #596 RPC/oracle tests; #597 design packets (inhalation model + DRA publication);
  #598 calculator UI/UX polish; #599 status + HITL queue + data-truth QA (T16/T18/T23); #600 surveyed-only
  map filter; #601 health data-freshness; #602 calculator interaction/a11y polish; #603 middleware
  regression tests; #604 cap migration re-homed (1437b77); #605 audited DRA publication flow (cbb9d94);
  #606 cap/pagination readiness health observability (a86414d).
- PROD DB: matrix_map.fetch_samples_with_hidden_summary v_cap 2500 -> 5000 (owner-approved, applied via
  project-scoped /supabase MCP, POST-verified: owner/secdef/signature preserved, 0 DRA-visibility change).

## 1. Current production + code state
- Map cap is 5000 (admins now see the full ~4486 province-wide samples, not 2500).
- Audited DRA publication flow is BUILT + merged (route /api/matrix-map/admin/publish + page
  /admin/matrix-map/publish + DraPublishControl) but NO DRA is published yet. It calls the audited
  flip_dra_public RPC (server-resolved actor, required reason, single-DRA, no bulk, no direct UPDATE).
- Map is still EMPTY for the ~55 members: 0 public DRAs / 574 private / 0 grants. Publishing is now a
  1-click owner action via the new admin page.
- US-EPA IRIS catalog buildout is COMPLETE (0 orphans). Inhalation is scaffold-only (fields + stub exist).

## 2. Supabase write protocol (current, authoritative -- AGENTS.md on main)
Owner-approved MCP writes ARE allowed for an EXACT operation that is: drafted + codex-reviewed GREEN +
flagged to owner + explicitly owner-approved. apply_migration stays disallowed; bulk loads use the pooler
loader (scripts/matrix-map/apply_live_load.py). Reads via MCP are free. (The old "SQL-Editor-only / do NOT
apply via MCP" banners are superseded.)

## 3. Remaining OWNER-GATED HITL queue (canonical: docs/MATRIX_OPTIONS_COMPLETION_STATUS_2026_07_11.md)
1. ENABLE PUBLICATION: owner publishes chosen DRAs via /admin/matrix-map/publish (needs a matrix_admin
   user_roles row). This is what makes the map non-empty for members.
2. RLS-bypass hardening: dras_admin_all permits an admin direct UNAUDITED UPDATE dras SET public -- tighten
   (a follow-up trigger/policy migration = a NEW owner-approved DB write) vs accept the documented gap.
3. Inhalation VF/PEF model decision + T33 unit-basis (packet: MATRIX_OPTIONS_INHALATION_MODEL_DECISION_PACKET).
4. Catalog arbitration: 15 candidate-group conflicts + 20 supersede-or-reject + 351 Protocol-28
   verify-vs-primary sweep -> owner runs promote-*.mjs --apply.
5. SECURITY FLAG (out-of-MO-lane): api/graphs/prioritization-matrix GET publicly leaks authenticated
   user_id + individual poll votes; milestones GET no in-route auth. Poll-gate + owner.
6. Measurement-load gap: 88.6% of mapped samples have no measurements -> decide the ~6742 undated-events load.
7. waterbody_type casing normalization (33-row owner-run UPDATE; proposal in the WATERBODY doc).
8. Cumulative D1-D4 + phenylmercuric_acetate class + confirm cadmium/methylmercury defaults (prior handoff).

## 4. NEXT SESSION -- plan-mode instructions (owner directive)
Enter PLAN MODE. Build a NEW ~50-task plan that:
- Turns the section-3 HITL items into executable units (design/dry-run/gated-write where owner-approval is
  needed; each owner-gated write follows the AGENTS.md gate: draft -> codex GREEN -> flag -> approve -> run).
- Adds a fresh suite of high-value MO tasks to reach ~50 total, drawn from the still-open lanes:
  Phase C follow-ups (wire the publish page into admin nav; unpublish/audit-history view; per-DRA
  visibility from the health page), inhalation calculator (once VF/PEF model decided), cumulative A3b UI
  (once D1-D4 + Phase C verified), catalog promotion batches (owner-attested), coordinate re-enrichment,
  measurement-load lane, and RBAC authenticated-E2E (re-add E2E_TEST_* under an owner-chosen gate model).
- Keep the autonomous-first + batch-HITL-once contract; delegate mechanical work to AGY + Sonnet + workflows.

## 5. Process / continuity
- No orphaned processes from this run (all background gate/AGY/codex/monitor tasks completed).
- Worktrees this run (left intact, hold merged branches): mo-phase0, mo-code, mo-cap-migration,
  mo-dra-publish, mo-cap-headroom. Clean up only with owner approval (junction-hazard rules apply).
- Run scratch (RUN_STATE/PR_MANIFEST/reports) under the session scratchpad; the canonical status +
  HITL queue is the committed docs/MATRIX_OPTIONS_COMPLETION_STATUS_2026_07_11.md.
- Prior plan: ~/.claude/plans/explore-the-code-base-ancient-walrus.md (this session executed + extended it).
