# Memory Dead Wikilink Patch -- 2026-05-28

**Scope:** C:\Users\jasen\.claude\projects\C--Projects-Regulatory-Review\memory\
**Author:** Claude Sonnet 4.6 (read-only audit; no files modified)
**Date:** 2026-05-28
**Source audit:** docs/MEMORY_HYGIENE_AUDIT_2026_05_28.md (Finding 3.1)

---

## 1. Executive Summary

| Class | Count | Description |
|-------|-------|-------------|
| A (mechanical rename -- feedback- -> cross-project-) | 24 | Old feedback-X hyphen slug; target now lives at cross_project_X.md |
| B (target still under feedback_ namespace -- parent-protected) | 5 | Slug uses cross-project- prefix but file is feedback_X.md; fix: revert slug to feedback- |
| C (no known target -- dead) | 4 | No matching file found; links to dashboard-pr2-plan, dashboard-agentic-os-*, dra_kb_family_alignment (wrong prefix), and one codex-rereview-queue variant |
| D (valid -- no action) | 0 | All parent-protected feedback_ links that were already correct confirmed intact |
| **Total dead** | **33** | Across 12 files |

Class A patches are safe to apply as a batch. Class B patches require slug reversion (not
progression). Class C patches require individual line edits to remove or replace the link.

---

## 2. Class A Patches (mechanical rename -- feedback-X -> cross-project-X)

These slugs use the hyphenated wikilink form (hyphens, not underscores). The file was
renamed from feedback_X.md to cross_project_X.md on 2026-05-19, but the internal link
slugs were not updated. Replacement rule: drop "feedback-" prefix; prepend "cross-project-".

| # | File (short name) | Line | Current slug | Replacement slug |
|---|---|---|---|---|
| 1 | codex_review_mutual_agreement_methodology_2026_05_16.md | 68 | feedback-codex-review-targeted-vs-holistic-2026-05-13 | cross-project-codex-review-targeted-vs-holistic-2026-05-13 |
| 2 | codex_review_mutual_agreement_methodology_2026_05_16.md | 69 | feedback-codex-review-pre-commit-loop | cross-project-codex-review-pre-commit-loop |
| 3 | codex_review_mutual_agreement_methodology_2026_05_16.md | 70 | feedback-codex-review-loop | cross-project-codex-review-loop |
| 4 | codex_review_mutual_agreement_methodology_2026_05_16.md | 71 | feedback-quality-first-no-speed-shortcuts | cross-project-quality-first-no-speed-shortcuts |
| 5 | feedback_dra_kb_family_pattern_adoption_required.md | 45 | feedback_quality_first_no_speed_shortcuts | cross_project_quality_first_no_speed_shortcuts |
| 6 | feedback_dra_kb_family_pattern_adoption_required.md | 46 | feedback_workstream_conflict_check_before_pivot | cross_project_workstream_conflict_check_before_pivot |
| 7 | dashboard_pr121_eod_2026_05_17.md | 126 | feedback-codex-iterate-to-green-before-commit-plus-4-gates-before-push | cross-project-codex-iterate-to-green-before-commit-plus-4-gates-before-push |
| 8 | dashboard_pr121_eod_2026_05_17.md | 127 | feedback-full-4-gates-before-every-push | cross-project-full-4-gates-before-every-push |
| 9 | dashboard_pr121_eod_2026_05_17.md | 128 | feedback-smoke-test-before-splitting-branches | cross-project-smoke-test-before-splitting-branches |
| 10 | dashboard_pr121_eod_2026_05_17.md | 129 | feedback-quality-first-no-speed-shortcuts | cross-project-quality-first-no-speed-shortcuts |
| 11 | dashboard_pr121_eod_2026_05_17.md | 131 | feedback-workstream-conflict-check-before-pivot | cross-project-workstream-conflict-check-before-pivot |
| 12 | codex_rereview_queue_2026_05_17.md | 68 | feedback_codex_review_targeted_vs_holistic_2026_05_13 | cross_project_codex_review_targeted_vs_holistic_2026_05_13 |
| 13 | codex_rereview_queue_2026_05_17.md | 210 | feedback-subagent-tool-unavailable-claims-need-verification | cross-project-subagent-tool-unavailable-claims-need-verification |
| 14 | cross_project_supabase_protocol_explore_before_assume.md | 97 | feedback_no_autofill_authorization_slots | cross_project_no_autofill_authorization_slots |
| 15 | project_site3250_kb_embed_model_v2_validated_2026_05_18.md | 69 | feedback-ollama-truncate-parameter-not-honored-v021 | cross-project-ollama-truncate-parameter-not-honored-v021 |
| 16 | project_site3250_kb_embed_model_v2_validated_2026_05_18.md | 78 | feedback-harness-background-processes-die-on-exit | cross-project-harness-background-processes-die-on-exit |
| 17 | project_site3250_kb_embed_model_v2_validated_2026_05_18.md | 82 | feedback-ollama-truncate-parameter-not-honored-v021 | cross-project-ollama-truncate-parameter-not-honored-v021 |
| 18 | project_site3250_kb_embed_model_v2_validated_2026_05_18.md | 84 | feedback-harness-background-processes-die-on-exit | cross-project-harness-background-processes-die-on-exit |
| 19 | project_site3250_kb_embed_model_v2_validated_2026_05_18.md | 85 | feedback-codex-review-targeted-vs-holistic-2026-05-13 | cross-project-codex-review-targeted-vs-holistic-2026-05-13 |
| 20 | project_site3250_kb_embed_model_v2_validated_2026_05_18.md | 86 | feedback-monitoring-as-baseline-for-all-wrappers | cross-project-monitoring-as-baseline-for-all-wrappers |
| 21 | project_site3250_kb_ingest_detach_poc_plan_2026_05_17.md | 108 | feedback-codex-review-targeted-vs-holistic-2026-05-13 | cross-project-codex-review-targeted-vs-holistic-2026-05-13 |
| 22 | env_rust_clients_cloudflare_ipv6_stall.md | 49 | feedback_no_image_name_kill_mcp | cross_project_no_image_name_kill_mcp |
| 23 | env_codex_cli_sandbox_blat_orphans.md | 36 | feedback_codex_review_targeted_vs_holistic_2026_05_13 | cross_project_codex_review_targeted_vs_holistic_2026_05_13 |
| 24 | site3250_kb_phase_5a_closed_2026_05_18_eos.md | 67 | feedback_ollama_truncate_parameter_not_honored_v021 | cross_project_ollama_truncate_parameter_not_honored_v021 |

Note on slug format: entries 1-4, 7-11, 13, 15-21 use hyphen-separated slugs (as written
in the files). Entries 5-6, 12, 14, 22-24 use underscore-separated slugs. Both formats
appear in the store; the replacement preserves whichever separator the original used.

---

## 3. Class B Patches (slug uses cross-project- prefix but target is parent-protected feedback_X.md)

These are the inverse of Class A: the link was partially updated to use a cross-project-
prefix, but the actual file stayed under the feedback_ namespace per the parent-protection
rule. The fix is to revert the slug back to the feedback- prefix.

The 3 parent-protected files are:
  feedback_codex_fallback_with_rereview_queue.md
  feedback_dra_kb_family_pattern_adoption_required.md
  feedback_docling_ocr_required.md

Plus 2 files that are under feedback_ because they were not in the 2026-05-19 bulk rename
set (confirmed file exists at feedback_ path, no cross_project_ equivalent exists):
  feedback_run_all_4_gates_before_push_ask_no_NA_shortcut.md
  feedback_ai_codex_collaboration_for_engineering_decisions.md

| # | File (short name) | Line | Current (dead) slug | Correct slug (revert to feedback-) |
|---|---|---|---|---|
| B1 | cross_project_push_protocol_all_gates_must_be_green.md | 35 | cross_project_run_all_4_gates_before_push_ask_no_NA_shortcut | feedback_run_all_4_gates_before_push_ask_no_NA_shortcut |
| B2 | cross_project_cursor_agent_codex_or_composer_not_opus_for_adversarial_review.md | 29 | cross-project-codex-fallback-with-rereview-queue | feedback-codex-fallback-with-rereview-queue |
| B3 | dashboard_matrix_map_session_handoff_2026_05_20_eos.md | 210 | cross_project_ai_codex_collaboration_for_engineering_decisions | feedback_ai_codex_collaboration_for_engineering_decisions |
| B4 | feedback_codex_fallback_with_rereview_queue.md | 46 | feedback-subagent-tool-unavailable-claims-need-verification | cross-project-subagent-tool-unavailable-claims-need-verification |
| B5 | codex_rereview_queue_2026_05_17.md | 207 | dra_kb_family_alignment_2026_05_18 | project_dra_kb_family_alignment_2026_05_18 |

Notes on Class B:
- B1: cross_project_run_all_4_gates_before_push_ask_no_NA_shortcut does not exist;
  feedback_run_all_4_gates_before_push_ask_no_NA_shortcut.md DOES exist. This file was
  not included in the 2026-05-19 bulk rename (it stays under feedback_ namespace).
- B2: feedback_codex_fallback_with_rereview_queue.md is one of the 3 parent-protected
  files. The slug cross-project-codex-fallback-with-rereview-queue resolves to nothing.
  Revert to feedback-codex-fallback-with-rereview-queue.
- B3: feedback_ai_codex_collaboration_for_engineering_decisions.md EXISTS (confirmed);
  cross_project_ai_codex_collaboration_for_engineering_decisions.md does NOT exist.
  This file was not renamed on 2026-05-19. Revert to feedback_ slug.
- B4: This link is in feedback_codex_fallback_with_rereview_queue.md (a parent-protected
  file). The slug feedback-subagent-tool-unavailable-claims-need-verification resolves
  to nothing because that file was renamed to cross_project_subagent_tool_unavailable_
  claims_need_verification.md on 2026-05-19. This is the only Class A link that appears
  inside a parent-protected file. The fix is cross-project- not feedback-.
  Reclassified: this is actually a Class A (rename to cross-project-) link that lives
  inside a Class D file. See reclassification note below.
- B5: The slug dra_kb_family_alignment_2026_05_18 (without project_ prefix) matches
  nothing. The correct file is project_dra_kb_family_alignment_2026_05_18.md. This is
  a missing-prefix bug, not a feedback->cross_project rename issue.

Reclassification of B4: feedback_codex_fallback_with_rereview_queue.md line 46 links
[[feedback-subagent-tool-unavailable-claims-need-verification]], which resolves to
feedback_subagent_tool_unavailable_claims_need_verification.md -- a file that does NOT
exist (renamed to cross_project_ on 2026-05-19). Fix: change to
[[cross-project-subagent-tool-unavailable-claims-need-verification]]. This is a Class A
fix inside a parent-protected file. The file body is modified; its filename stays as-is.

---

## 4. Class C Patches (no known target -- link removal or plain-text replacement)

These 4 links have no matching file anywhere in the store. The dead slug cannot be
mechanically resolved to any existing filename.

### C1 -- dashboard_pr2_agentic_os_panels_parked_2026_05_17.md line 71
Current:  see [[dashboard-pr2-plan]] for the full sequence.
Dead slug: dashboard-pr2-plan
Status: No file dashboard_pr2_plan.md exists. This was likely a planned artifact that
was never authored. The surrounding text is a code-comment block (bash script steps).
Proposed fix: replace [[dashboard-pr2-plan]] with plain text "the PR-2 sequence plan"
Full line after fix:
  # Step 4: continue PR-2 lane: Commit B (shared CLI infra) -- see the PR-2 sequence plan for the full sequence.
Risk: Low. The link was navigational only; the content it pointed to was never created.

### C2 -- dashboard_pr2_agentic_os_panels_parked_2026_05_17.md line 88
Current:  See [[dashboard-agentic-os-ai-subs-panel-pushed-2026-05-17]].
Dead slug: dashboard-agentic-os-ai-subs-panel-pushed-2026-05-17
Status: No file dashboard_agentic_os_ai_subs_panel_pushed_2026_05_17.md exists. The
closest candidate is agentic_os_mvp_handoff_2026_05_16.md (which covers the PR #116
Agentic OS subscriptions + IA refactor closed 2026-05-17 at 026eeb0). That file exists
and covers the referenced context.
Proposed fix (option A -- redirect to best match):
  See [[agentic_os_mvp_handoff_2026_05_16]].
Proposed fix (option B -- plain text if owner unsure):
  See the PR-116 Agentic OS subscriptions push on 2026-05-17.
Owner input requested: confirm whether agentic_os_mvp_handoff_2026_05_16 is the intended
target, or whether the anchor was never authored and option B is cleaner.

### C3 -- codex_rereview_queue_2026_05_17.md line 207 (the dra_kb_family_alignment part)
Already classified as B5 above (wrong prefix, not a missing file). See B5.

### C4 -- project_site3250_kb_embed_model_v2_validated_2026_05_18.md line 87
Current:  [[feedback-quality-first-no-speed-shortcuts]]
Dead slug: feedback-quality-first-no-speed-shortcuts
Status: feedback_quality_first_no_speed_shortcuts.md does NOT exist (renamed to
cross_project_quality_first_no_speed_shortcuts.md on 2026-05-19). This is a Class A
fix: change to [[cross-project-quality-first-no-speed-shortcuts]].
Reclassification: This entry belongs in Class A. Added here to document the
re-classification; apply with the Class A batch.

Summary of true Class C entries (no file exists, no clear rename target):
  C1: dashboard_pr2_agentic_os_panels_parked_2026_05_17.md line 71 -- dashboard-pr2-plan
  C2: dashboard_pr2_agentic_os_panels_parked_2026_05_17.md line 88 -- dashboard-agentic-os-ai-subs-panel-pushed-2026-05-17 (owner input on best substitute)

---

## 5. Corrected Class Counts (after reclassifications)

The audit listed 33 dead wikilinks. After reading the actual file content:

| Class | Count | Action |
|-------|-------|--------|
| A (mechanical rename) | 26 | Apply as batch (includes B4-reclassified + C4-reclassified) |
| B (wrong prefix fix; non-rename) | 3 | B1, B2, B3 -- apply per-file |
| C (true dead -- no known target) | 2 | C1 plain text; C2 needs owner input |
| B5 (wrong-prefix bug) | 1 | Apply per-file |
| **Total** | **33** | |

Note: B5 is not a rename issue; it is a missing "project_" prefix. Treat as a standalone
per-file fix: in codex_rereview_queue_2026_05_17.md line 207, change
[[dra_kb_family_alignment_2026_05_18]] to [[project_dra_kb_family_alignment_2026_05_18]].

---

## 6. Apply Commands

### Class A batch (PowerShell)

The Class A pattern covers two sub-patterns:
  (a) hyphen-slug: [[feedback-X]] -> [[cross-project-X]]
  (b) underscore-slug: [[feedback_X]] -> [[cross_project_X]]

PowerShell one-pass for (a) -- hyphen form:
```
$memDir = "C:\Users\jasen\.claude\projects\C--Projects-Regulatory-Review\memory"
$files = @(
  "codex_review_mutual_agreement_methodology_2026_05_16.md",
  "dashboard_pr121_eod_2026_05_17.md",
  "codex_rereview_queue_2026_05_17.md",
  "project_site3250_kb_embed_model_v2_validated_2026_05_18.md",
  "project_site3250_kb_ingest_detach_poc_plan_2026_05_17.md",
  "feedback_codex_fallback_with_rereview_queue.md"
)
foreach ($f in $files) {
  $path = Join-Path $memDir $f
  $content = Get-Content $path -Raw
  $updated = $content -replace '\[\[feedback-', '[[cross-project-'
  if ($updated -ne $content) {
    Set-Content -Path $path -Value $updated -Encoding utf8 -NoNewline
    Write-Output "Updated (hyphen form): $f"
  }
}
```

PowerShell one-pass for (b) -- underscore form:
```
$files2 = @(
  "feedback_dra_kb_family_pattern_adoption_required.md",
  "cross_project_supabase_protocol_explore_before_assume.md",
  "env_rust_clients_cloudflare_ipv6_stall.md",
  "env_codex_cli_sandbox_blat_orphans.md",
  "site3250_kb_phase_5a_closed_2026_05_18_eos.md"
)
foreach ($f in $files2) {
  $path = Join-Path $memDir $f
  $content = Get-Content $path -Raw
  $updated = $content -replace '\[\[feedback_(?!codex_fallback_with_rereview_queue|dra_kb_family_pattern_adoption_required|docling_ocr_required)', '[[cross_project_'
  if ($updated -ne $content) {
    Set-Content -Path $path -Value $updated -Encoding utf8 -NoNewline
    Write-Output "Updated (underscore form): $f"
  }
}
```

WARNING on the underscore regex: the negative lookahead above protects the 3
parent-protected files from accidental rename. Verify the pattern fires correctly
against a test string before running. Alternative: apply edits 5, 6, 14, 22-24
manually using Edit tool with explicit old_string / new_string.

### Class B per-file edits

B1: cross_project_push_protocol_all_gates_must_be_green.md line 35
  Change: [[cross_project_run_all_4_gates_before_push_ask_no_NA_shortcut]]
  To:     [[feedback_run_all_4_gates_before_push_ask_no_NA_shortcut]]

B2: cross_project_cursor_agent_codex_or_composer_not_opus_for_adversarial_review.md line 29
  Change: [[cross-project-codex-fallback-with-rereview-queue]]
  To:     [[feedback-codex-fallback-with-rereview-queue]]

B3: dashboard_matrix_map_session_handoff_2026_05_20_eos.md line 210
  Change: [[cross_project_ai_codex_collaboration_for_engineering_decisions]]
  To:     [[feedback_ai_codex_collaboration_for_engineering_decisions]]

B5: codex_rereview_queue_2026_05_17.md line 207
  Change: [[dra_kb_family_alignment_2026_05_18]]
  To:     [[project_dra_kb_family_alignment_2026_05_18]]

### Class C per-file edits

C1: dashboard_pr2_agentic_os_panels_parked_2026_05_17.md line 71
  Change: see [[dashboard-pr2-plan]] for the full sequence.
  To:     see the PR-2 sequence plan for the full sequence.

C2: dashboard_pr2_agentic_os_panels_parked_2026_05_17.md line 88
  Owner input needed. Options:
    (A) See [[agentic_os_mvp_handoff_2026_05_16]].    (best guess -- same event)
    (B) See the PR-116 Agentic OS subscriptions push on 2026-05-17.  (plain text)

---

## 7. Validation Procedure

After applying all patches, run from the memory store directory:

```powershell
$memDir = "C:\Users\jasen\.claude\projects\C--Projects-Regulatory-Review\memory"
Select-String -Path (Join-Path $memDir "*.md") -Pattern '\[\[feedback-(?!codex-fallback|dra-kb-family|docling-ocr)' | Select-Object Filename, LineNumber, Line
Select-String -Path (Join-Path $memDir "*.md") -Pattern '\[\[feedback_(?!codex_fallback_with_rereview_queue|dra_kb_family_pattern_adoption_required|docling_ocr_required|no_tier_judgment_for_ai|ai_scope_evidence_only|no_eval_without_embeddings|kwgen_priority|run_all_4_gates|ai_codex_collaboration|gold_grading_relevance|csap_lifecycle|ema_parts|web_content|token_strategy|codex_batch)' | Select-Object Filename, LineNumber, Line
```

Both queries should return 0 results when all Class A patches are applied. The negative
lookaheads exempt the known-valid feedback_ namespace entries.

---

## 8. Risk Assessment

| Class | Risk | Notes |
|-------|------|-------|
| A (26 edits) | LOW | Mechanical slug rename; all targets confirmed to exist. The regex applies only to the specific files listed, not the entire store. |
| B1, B2, B3 (3 edits) | LOW | Single-file line edits; targets confirmed to exist. |
| B5 (1 edit) | LOW | Missing prefix fix; target confirmed to exist. |
| C1 (1 edit) | LOW | Plain text replacement; the pointed-to artifact was never authored. |
| C2 (1 edit) | MEDIUM | Best-guess redirect. Owner should confirm whether agentic_os_mvp_handoff_2026_05_16 is the intended target before applying. |
| Regex batch commands | MEDIUM | The negative lookaheads in the underscore-form command must be verified. Safer to apply the underscore group (edits 5, 6, 14, 22-24) as explicit Edit-tool calls rather than regex. |

---

## 9. Owner Sign-Off Blocks

- [ ] Apply all 26 Class A patches (batch PowerShell or explicit Edit calls)
- [ ] Apply B1 per-file edit (cross_project_push_protocol_all_gates_must_be_green.md)
- [ ] Apply B2 per-file edit (cross_project_cursor_agent_codex_or_composer.md)
- [ ] Apply B3 per-file edit (dashboard_matrix_map_session_handoff_2026_05_20_eos.md)
- [ ] Apply B5 per-file edit (codex_rereview_queue_2026_05_17.md line 207 prefix fix)
- [ ] Apply C1 plain text replacement (dashboard_pr2_agentic_os_panels_parked line 71)
- [ ] Decide C2 target (dashboard_pr2_agentic_os_panels_parked line 88) and apply
- [ ] Run validation grep after all edits; confirm 0 remaining dead feedback- slugs

---

*Patch authored 2026-05-28. Read-only; no memory store files were modified.*
*ASCII scan: 0 non-ASCII characters in this document.*
