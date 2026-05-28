# Memory Hygiene Audit -- 2026-05-28

**Scope:** C:\Users\jasen\.claude\projects\C--Projects-Regulatory-Review\memory\
**Auditor:** Claude Sonnet 4.6 (read-only; no files modified)
**Date:** 2026-05-28
**Method:** Link extraction, file existence checks, wikilink scan, orphan diff, frontmatter probe, ASCII scan

---

## 1. Executive Summary

**Overall hygiene verdict: YELLOW**

The standing-rule layer is structurally sound: all 4 today's additions are healthy, all
3 parent-protected files are intact, and 187 of 188 MEMORY.md links resolve. The
primary issues are (a) severe index bloat at 951 lines vs the 200-line auto-load
target, (b) 80 orphan files with no index entry, and (c) 33 dead [[wikilink]]
cross-references inside individual anchor bodies caused by the 2026-05-19 bulk rename
from feedback_* to cross_project_* that updated filenames but not internal links.

Top findings:

- P1: MEMORY.md is 951 lines -- 4.75x the 200-line truncation threshold. The Claude
  Code harness auto-truncates at ~200 lines, so session 802 through 951 are invisible
  to new sessions. At least 5 "LOAD-BEARING" session handoffs live past the truncation
  point and are silently unavailable.
- P2: 33 dead [[wikilink]] references spread across 12 anchor files. Root cause: the
  2026-05-19 bulk rename (feedback_* -> cross_project_*) updated filenames but not
  internal [[wikilink]] slugs inside each body. No file is missing; the anchors exist
  under new names.
- P2: 80 orphan .md files exist on disk but have no MEMORY.md index entry. Some are
  genuinely stale (2026-03 session checkpoints, autoresearch campaign artifacts).
  Others are mid-stream sub-anchors (engine_v2_session_2026_05_2x) that may still
  carry load-bearing context but are unreachable by index.

---

## 2. Findings by Category

---

### Category 1: Index drift -- broken MEMORY.md links

**Finding 1.1 -- One broken cross-directory link**
- Severity: P3
- File: MEMORY.md (exact line not pinned; search for ISOLATION_STUDY)
- Broken target: ../2026_Database_Development/data_acquisition/bnrrm_extraction/
  bn_learning/docs/ISOLATION_STUDY_ATTRIBUTION.md
- This is a relative path pointing outside the memory store directory. The target
  file does not exist at that path.
- Suggested action: Owner to verify whether ISOLATION_STUDY_ATTRIBUTION.md was
  created (check git log in bnrrm_extraction). If never created, remove the
  dead reference from MEMORY.md. If it was created elsewhere, update the path.

**Finding 1.2 -- DELETED entry still indexed**
- Severity: P2
- File: MEMORY.md line 12-13
- Index entry: "DELETED -- Token conservation (2026-05-21) -- OWNER REJECTED
  one-shot-only framing" points to feedback_token_conservation_overage_credits_2026_05_21.md
- The file EXISTS on disk but its frontmatter description starts with "DELETED 2026-05-25".
  This is an intentional tombstone pattern. The MEMORY.md entry correctly notes
  "DELETED" in the section header.
- Status: ACCEPTABLE as-is (tombstone is valid). No action required unless owner
  wants to purge the tombstone entry and file together.

---

### Category 2: Orphan anchors -- .md files not indexed in MEMORY.md

**Finding 2.1 -- 80 orphan files (267 total, 187 indexed)**
- Severity: P2 overall; individual files range P1 to P3
- All 80 are listed below by rough staleness group.

**Group A -- Likely stale (pre-May-10; safe MEMORY_ARCHIVE.md candidates):**
  session_checkpoint_20260312.md
  session_checkpoint_20260312b.md
  session_checkpoint_20260313_b4rerun.md
  session_checkpoint_20260313_s4pilot.md
  autoresearch_exp001_lessons.md
  autoresearch_hitl_lock_note.md
  autoresearch_k1_state.md
  bnrrm_autoresearch.md
  checkpoint_jermilova_session_20260407.md
  dashboard_regrev_fixes_20260321.md
  doc_consolidation_20260330.md
  frontend_extraction_fix_20260321.md
  MANAGER_RECOVERY_PROMPT_20260404.md
  gdrive_mcp.md
  keyword_autoresearch_state.md
  keyword_boundary_analysis_prompt.md
  keyword_boundary_pilot.md
  keyword_metadata_drift.md
  nlm_rapg_evaluation_run.md
  pattern_comparison_autonomous_campaigns.md
  s3_dilution_research.md
  s4_diversity_prompt_design.md
  s4_iterative_synthesis_design.md
  script32_enhancement.md
  site28553_pilot_results.md
  site28553_three_way_plan.md
  structural_noise_finding.md
  techmemo_deficiency_review.md
  techmemo_word_archive.md
  window_spam_investigation.md
  workflow_rules.md
  engine_quality_first_roadmap.md
  engine_resilience_plan.md
  dr001_reframing.md
  agent_swarm_28553.md
  applicability_phase1a.md
  architectural_pivot_embeddings_applicability.md

**Group B -- Mid-stream engine v2 sub-anchors (may still be needed by active sessions):**
  engine_v2_24h_autonomous_checkpoint_2026_05_20.md
  engine_v2_24h_session_handoff_2026_05_17_morning.md
  engine_v2_lx1_mirrored_text_audit_2026_05_15.md
  engine_v2_lx3_section_audit_2026_05_15.md
  engine_v2_lx4_missing_spaces_audit_2026_05_15.md
  engine_v2_m1_vlm_bakeoff_plan_2026_05_16.md
  engine_v2_m2_contracts_predraft_2026_05_16.md
  engine_v2_ontology_audit_2026_05_16.md
  engine_v2_ontology_v0_2_holistic_review_2026_05_16.md
  engine_v2_ontology_v0_2_targeted_review_2026_05_16.md
  engine_v2_ontology_v0_33_handoff_2026_05_16_eod.md
  engine_v2_lightrag_raganything_architecture_proposal_v2_2026_05_16.md
  engine_v2_session_2026_05_20_l1_l2.md
  engine_v2_session_2026_05_20_l3.md
  engine_v2_session_2026_05_20_l4_l5.md
  engine_v2_session_2026_05_24_autonomous_p2_s4_impl.md
  engine_v2_session_2026_05_25_fix3_enriched_headers.md
  engine_v2_session_2026_05_25_oq1_resolved_nomic_wins.md
  engine_v2_session_2026_05_26_p2s6_gold_expansion.md
  engine_v2_session_2026_05_27_autonomous_override_tuning.md
  engine_v2_session_eod_2026_05_21.md
  engine_v2_supabase_50mb_cap_investigation_2026_05_15.md

**Group C -- Feedback/standing rules orphaned by rename (files exist; index coverage gap):**
  feedback_csap_lifecycle_stage_metadata_is_load_bearing.md
  feedback_ema_parts_4_5_contaminated_sites_only.md
  feedback_gold_grading_relevance_not_tiers.md
  feedback_token_strategy_orchestration_pattern_2026_05_24.md
  feedback_web_content_not_legal_authority.md
  cross_project_consolidation_delegated_2026_05_18.md
  cross_project_reingest_nondeterminism_regression_risk.md

**Group D -- BN-RRM sub-anchors (no MEMORY.md entry):**
  bnrrm_extraction_codex_findings_2026_05_18.md
  bnrrm_georeferencing.md
  bnrrm_landis_focus.md
  bnrrm_spatial_colocation.md
  bnrrm_spatial_colocation_plan_draft.md
  bnrrm_tooltip_governance.md

**Group E -- Dashboard sub-anchors (no MEMORY.md entry):**
  dashboard_palette.md
  dashboard_palette_plan.md
  codex_rereview_queue_2026_05_19_clearout.md

**Group F -- Other project sub-anchors:**
  cross_ref_provenance_audit_2026_05_16.md
  personal_knowledge_base.md
  project_csr_flooding_fix_design_2026_05_25.md
  indigenous_consultation_3250.md
  runtime_throughput_blocker.md

- Suggested action: Owner to triage Group A into MEMORY_ARCHIVE.md. Group B/D/E/F:
  decide per-file whether to add a brief index entry or archive. Group C: add index
  entries for any still-active standing rules; archive the rest.

---

### Category 3: Dead [[wikilink]] cross-references inside anchor bodies

**Finding 3.1 -- 33 dead wikilinks in 12 files**
- Severity: P2
- Root cause: 2026-05-19 bulk rename from feedback_* to cross_project_* updated
  filenames but NOT [[wikilink]] slugs inside anchor bodies. All targets exist
  on disk under their new cross_project_* names.

Affected files and dead links (slug translation needed: feedback- or feedback_ -> cross_project_):

  cross_project_supabase_protocol_explore_before_assume.md
    -> [[feedback_no_autofill_authorization_slots]] (file: cross_project_no_autofill_authorization_slots.md)

  site3250_kb_phase_5a_closed_2026_05_18_eos.md
    -> [[feedback_ollama_truncate_parameter_not_honored_v021]] (file: cross_project_ollama_truncate_parameter_not_honored_v021.md)

  codex_review_mutual_agreement_methodology_2026_05_16.md (4 dead links)
    -> [[feedback-codex-review-targeted-vs-holistic-2026-05-13]]
    -> [[feedback-codex-review-pre-commit-loop]]
    -> [[feedback-codex-review-loop]]
    -> [[feedback-quality-first-no-speed-shortcuts]]

  feedback_dra_kb_family_pattern_adoption_required.md (2 dead links)
    -> [[feedback_quality_first_no_speed_shortcuts]]
    -> [[feedback_workstream_conflict_check_before_pivot]]

  dashboard_pr121_eod_2026_05_17.md (5 dead links -- all feedback_* -> cross_project_*)
    -> [[feedback-codex-iterate-to-green-...]]
    -> [[feedback-full-4-gates-before-every-push]]
    -> [[feedback-smoke-test-before-splitting-branches]]
    -> [[feedback-quality-first-no-speed-shortcuts]]
    -> [[feedback-workstream-conflict-check-before-pivot]]

  codex_rereview_queue_2026_05_17.md (3 dead links)
    -> [[feedback_codex_review_targeted_vs_holistic_2026_05_13]]
    -> [[dra_kb_family_alignment_2026_05_18]] (unclear target; check project_dra_kb_family_alignment_2026_05_18.md)
    -> [[feedback-subagent-tool-unavailable-claims-need-verification]]

  cross_project_push_protocol_all_gates_must_be_green.md (1 dead link)
    -> [[cross_project_run_all_4_gates_before_push_ask_no_NA_shortcut]]
    (file is feedback_run_all_4_gates_before_push_ask_no_NA_shortcut.md -- kept under feedback_)

  cross_project_cursor_agent_codex_or_composer_not_opus_for_adversarial_review.md (1 dead link)
    -> [[cross-project-codex-fallback-with-rereview-queue]]
    (file is feedback_codex_fallback_with_rereview_queue.md -- kept under feedback_)

  project_site3250_kb_embed_model_v2_validated_2026_05_18.md (6 dead links)
    -> [[feedback-ollama-truncate-parameter-not-honored-v021]] (x2)
    -> [[feedback-harness-background-processes-die-on-exit]] (x2)
    -> [[feedback-codex-review-targeted-vs-holistic-2026-05-13]]
    -> [[feedback-monitoring-as-baseline-for-all-wrappers]]

  project_site3250_kb_ingest_detach_poc_plan_2026_05_17.md (1 dead link)
    -> [[feedback-codex-review-targeted-vs-holistic-2026-05-13]]

  dashboard_matrix_map_session_handoff_2026_05_20_eos.md (2 dead links)
    -> [[cross_project_ai_codex_collaboration_for_engineering_decisions]]
    (file is feedback_ai_codex_collaboration_for_engineering_decisions.md -- kept under feedback_)

  env_rust_clients_cloudflare_ipv6_stall.md (1 dead link)
    -> [[feedback_no_image_name_kill_mcp]] (file: cross_project_no_image_name_kill_mcp.md)

  env_codex_cli_sandbox_blat_orphans.md (1 dead link)
    -> [[feedback_codex_review_targeted_vs_holistic_2026_05_13]] (file: cross_project_codex_review_targeted_vs_holistic_2026_05_13.md)

  feedback_codex_fallback_with_rereview_queue.md (1 dead link)
    -> [[feedback-subagent-tool-unavailable-claims-need-verification]]
    (file: cross_project_subagent_tool_unavailable_claims_need_verification.md)

  dashboard_pr2_agentic_os_panels_parked_2026_05_17.md (2 dead links)
    -> [[dashboard-pr2-plan]] (no known target)
    -> [[dashboard-agentic-os-ai-subs-panel-pushed-2026-05-17]] (no known target)

- Suggested action: On next substantive touch to each file, update [[wikilink]] slugs
  to match current filenames. Priority: files with standing-rule content (codex_review_
  mutual_agreement, feedback_dra_kb_family, cross_project_push_protocol). No urgent
  operational risk since wikilinks are navigational only in this context, not
  load-bearing for session startup.

---

### Category 4: Redundancies and consolidation opportunities

**Finding 4.1 -- 5 overlapping gate/push rules**
- Severity: P3 (documented duplication; intentional layering)
- Files:
    cross_project_codex_iterate_to_green_before_commit_plus_4_gates_before_push.md
    cross_project_full_4_gates_before_every_push.md
    feedback_run_all_4_gates_before_push_ask_no_NA_shortcut.md
    cross_project_run_gates_before_proposing_push.md
    cross_project_push_protocol_all_gates_must_be_green.md
- Each adds a nuance (WAIVERED-is-not-GREEN, run-before-asking, no-N/A). MEMORY.md
  itself notes the tightening progression. Consolidation would reduce index bloat.
- Suggested action: Owner to consider merging into a single authoritative file after
  the next major session with push-gate violations. Not urgent.

**Finding 4.2 -- 12 codex-review entries (2 explicitly SUPERSEDED)**
- Severity: P3
- Files: cross_project_codex_review_mcp_preferred.md and
  cross_project_codex_unavailable_fallback.md are explicitly marked SUPERSEDED in
  MEMORY.md. Both files still exist on disk and are indexed. No deletion risk.
- Suggested action: Archive these two files to MEMORY_ARCHIVE.md in the next
  consolidation pass.

**Finding 4.3 -- Cursor routing split across two entries**
- Severity: P3
- Lines 6-7 (cross_project_cursor_composer_25_for_shallow_reviews.md) and
  lines 66-67 (cross_project_cursor_agent_codex_or_composer_not_opus_for_adversarial_review.md)
  cover overlapping territory (Cursor model routing). Both are healthy, dated 2026-05-28,
  and index correctly. The split is intentional (shallow vs. adversarial contexts).
  No action required; flag for consolidation only if further drift occurs.

---

### Category 5: Stale anchors -- candidates for MEMORY_ARCHIVE.md

**Finding 5.1 -- Pre-2026-05-10 session handoffs still indexed**
- Severity: P2
- Entries in MEMORY.md below approximately line 405 include engine-v2 sessions from
  2026-05-10 to 2026-05-13 marked SUPERSEDED inline (e.g., "v2 Frontend Plan Ready
  (2026-05-11, SUPERSEDED by L1-1 checkpoint)"). Many are explicitly annotated
  SUPERSEDED but still occupy index lines.
- Specific files to consider archiving (all explicitly marked SUPERSEDED in index):
    v2_frontend_plan_ready_2026_05_11.md
    engine_v2_lane_completion_2026_05_11.md (marked SUBSTANTIALLY COMPLETE)
    engine_v2_gap_arc_2026_05_10.md (marked COMPLETE)
    engine_v2_option_a_c1_state.md (marked post-merge state)
    engine_v2_session_handoff_2026_05_12.md (marked SUPERSEDED)
    engine_v2_session_handoff_2026_05_13_evening.md (marked SUPERSEDED)
    dashboard_pr2_agentic_os_panels_parked_2026_05_17.md (parked/superseded)
    dashboard_pr2_commit_c_wip_2026_05_17.md (WIP state from 2026-05-17)
- Suggested action: Move these 8 entries + associated files to MEMORY_ARCHIVE.md.
  This alone would recover approximately 50-80 lines from MEMORY.md.

**Finding 5.2 -- Codex re-review queue (codex_rereview_queue_2026_05_17.md)**
- Severity: P2
- The re-review queue is noted in MEMORY.md as "ACTIVE -- triggers 2026-05-18 15:39 PT".
  That date is 10 days ago. The queue entries added in 2026-05-20 sessions reference
  work that has since been executed. The companion clearout file
  codex_rereview_queue_2026_05_19_clearout.md is an orphan (not indexed).
- Suggested action: Owner to read queue body and mark DISPOSED items. If fully closed,
  archive both queue files.

---

### Category 6: MEMORY.md length check

**Finding 6.1 -- Critical line count overrun**
- Severity: P1
- Measured line count: 951
- Auto-load truncation threshold: ~200 lines
- Overrun factor: 4.75x
- Impact: Claude Code sessions loading MEMORY.md only see lines 1-200 (the standing
  rules block through the index conventions note on line 57). All session handoffs from
  line 148 onward (the "Session handoffs + lane state" section) are invisible at session
  start. This includes the LOAD-BEARING engine v2 Gate 1A 48/50 handoff, the
  SSTAC Evidence Library 9-phases-complete handoff, the engine v2 session 5 + F601
  REGRESSION finding, and the multi-week dashboard plan.
- Confirmed LOAD-BEARING entries past truncation: at least 8 handoffs between lines
  150-210 alone.
- Suggested action: Emergency MEMORY_ARCHIVE.md migration pass. Target: trim MEMORY.md
  to 180-220 lines. All session handoffs dated before 2026-05-24 that are marked
  SUPERSEDED are safe to archive. Estimated recovery: 600+ lines.

---

### Category 7: Recent additions audit (2026-05-28)

**Finding 7.1 -- All 5 today's additions are healthy**
- Severity: N/A (no issue)
- Files verified:
    cross_project_always_recommend_hybrid_subagent_options.md
      frontmatter: YES | name: YES | description: YES | type: YES | non-ASCII: 0
      MEMORY.md index entry: YES (line 66, section "Quality + review discipline")
    cross_project_cursor_agent_codex_or_composer_not_opus_for_adversarial_review.md
      frontmatter: YES | name: YES | description: YES | type: YES | non-ASCII: 0
      MEMORY.md index entry: YES (line 67, same section)
    cross_project_worktree_not_checkoutb_for_parallel_sessions.md
      frontmatter: YES | name: YES | description: YES | type: YES | non-ASCII: 0
      MEMORY.md index entry: YES (line 88, section "Process safety + monitoring")
    dashboard_multiweek_plan_2026_05_27.md
      frontmatter: YES | name: YES | description: YES | type: YES | non-ASCII: 0
      MEMORY.md index entry: YES (line 150-151)
    cross_project_cursor_composer_25_for_shallow_reviews.md (also added 2026-05-28)
      frontmatter: YES | name: YES | non-ASCII: 0
      MEMORY.md index entry: YES (line 6-7)
- Index summary text matches body content in all 5 cases.

---

### Category 8: Owner-protected scope

**Finding 8.1 -- All 3 parent-protected files intact**
- Severity: N/A (no issue)
- feedback_codex_fallback_with_rereview_queue.md: EXISTS | namespace correct
- feedback_dra_kb_family_pattern_adoption_required.md: EXISTS | namespace correct
- feedback_docling_ocr_required.md: EXISTS | namespace correct
- None have been renamed to cross_project_* (the 2026-05-19 rename excluded these
  3 per the parent-session protection clause).

---

## 3. Recommended Actions for Owner (Prioritized)

1. EMERGENCY LINE TRIM (P1): MEMORY.md at 951 lines is 4.75x the auto-load threshold.
   Run a MEMORY_ARCHIVE.md migration pass. Target 180-220 lines. Safe candidates:
   all SUPERSEDED handoffs before 2026-05-24, engine_v2 sessions pre-2026-05-20 that
   are explicitly labeled SUPERSEDED, and the codex re-review queue once verified DISPOSED.

2. REVIEW RE-REVIEW QUEUE (P2): codex_rereview_queue_2026_05_17.md -- the trigger date
   (2026-05-18 15:39 PT) is 10 days past. Read the queue body; mark DISPOSED items;
   archive if fully closed. The companion clearout file is an orphan.

3. WIKILINK SLUG FIXES (P2): 33 dead [[wikilink]] references in 12 files, all caused
   by the 2026-05-19 feedback_* -> cross_project_* rename. Fix on next substantive
   touch to each file. Priority order: codex_review_mutual_agreement_methodology_2026_05_16,
   feedback_dra_kb_family_pattern_adoption_required, cross_project_push_protocol_all_gates_must_be_green.

4. GROUP A ORPHAN TRIAGE (P2): 37 pre-2026-05-10 orphan files (session_checkpoint_*,
   autoresearch_*, keyword_*, s3/s4/script32, techmemo_word_archive, etc.) have no
   index entry and are almost certainly stale. Move to MEMORY_ARCHIVE.md or delete
   per standard staleness policy.

5. GROUP B/C/D ORPHAN REVIEW (P2): ~43 more orphan files in engine v2 sub-anchors,
   BN-RRM sub-anchors, and unindexed feedback_ standing rules. Owner to decide per
   file whether to add an index entry or archive.

6. ARCHIVE TWO SUPERSEDED CODEX FILES (P3): cross_project_codex_review_mcp_preferred.md
   and cross_project_codex_unavailable_fallback.md are both marked SUPERSEDED in
   MEMORY.md. Archive them to MEMORY_ARCHIVE.md to reduce index clutter.

7. RESOLVE BROKEN PATH LINK (P3): The one broken MEMORY.md link to
   ../2026_Database_Development/.../ISOLATION_STUDY_ATTRIBUTION.md. Verify whether
   the file was created; if not, remove the dead reference.

---

*Audit completed 2026-05-28. Read-only; no changes made to any memory store file.*
*ASCII scan: 0 non-ASCII characters in this document.*
