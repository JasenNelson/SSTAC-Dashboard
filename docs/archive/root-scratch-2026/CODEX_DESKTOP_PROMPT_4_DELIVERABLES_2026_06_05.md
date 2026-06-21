# Codex desktop prompt -- holistic review of 4 demo-readiness deliverables (2026-06-05)

Paste everything below this line into the codex desktop app (repo workspace: SSTAC-Dashboard).

---

HOLISTIC ADVERSARIAL REVIEW of four session deliverables (markdown docs, NOT a code diff).

CONTEXT: An autonomous Claude session assessed "how close is the whole SSTAC Dashboard app to
fully functional for a CEO demo in ~2 weeks?" and produced these UNTRACKED working-tree files:
1. WHOLE_APP_READINESS_REPORT_2026_06_04.md  (repo root) -- per-surface ratings
   (Working/Partial/Stub/Broken) + an honest %-to-functional + a prioritized, tagged backlog.
2. DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md (repo root) -- owner-run READ-ONLY pre-flight SQL +
   conditional remedies that point ONLY at files already in the repo (database_schema.sql, two
   migrations); the AI authored no schema and pasted nothing.
3. WHOLE_APP_DEMO_READINESS_PROGRESS_2026_06_04.md (repo root) -- session checkpoint / owner
   return list (status doc derived from 1+2).
4. .tmp/plan-review/PLAN_v2.md -- the session workplan the above executed.

CRITICAL METHOD NOTE: the local working tree sits on a STALE branch
(docs/matrix-options-session-2026-05-31), 36 commits BEHIND origin/main (tip a6f617a). The
deliverables claim to assess ORIGIN/MAIN. Verify their claims with `git show origin/main:<path>`
/ `git log origin/main`, NOT the stale working tree (except the four deliverable files themselves,
which exist only in the working tree). A prior automated pass already FALSE-flagged an engine-v2
"applicable_policy_ids mismatch" by reading the stale tree; the report claims main is synced
(#251). Hunt for any REMAINING stale-tree contamination in either direction.

PRIOR REVIEW LEGS (you are Leg 2, the ship gate): Leg-1 Opus adversarial loop ran twice on the
plan (YELLOW -> 6 IMPORTANTs folded -> GREEN) and an Opus fact-checker verified the report + kit
against origin/main (YELLOW -> 3 corrections folded: Agentic OS dual-flag NEXT_PUBLIC_* vs
AGENTIC_OS_LOCAL; catalog ~1.6k not 1573; regulatory-review.db is local-disk-only).

PROBE HOLISTICALLY:
1. ACCURACY: spot-verify the load-bearing claims against origin/main -- engine-v2
   src/lib/engine-v2/types.ts has applicable_policy_ids and the
   dashboard/engine-v2/[projectId]/page.tsx SELECT includes it; middleware matcher = 6 prefixes;
   matrix-options catalog is static-import (no runtime Supabase); better-sqlite3 + node-pty are
   webpack-externalized; database_schema.sql defines user_roles/tags/documents/announcements/
   milestones/discussions/discussion_replies/review_submissions/review_files/likes with
   IF NOT EXISTS; migrations 20260604_v2_projects_applicable_policy_ids.sql,
   20260520000001_matrix_map_fetch_samples_rpc.sql, 20260519000002_matrix_map_rls.sql exist.
2. SQL SAFETY: is the kit's STEP 1 SQL truly read-only and correct? Are the conditional remedies
   safe as written (idempotent; no destructive paths; correct ordering of apply-migration vs
   deploy)? Would an owner following the kit verbatim ever damage a live project?
3. JUDGMENT HONESTY: is the ~75-80% (to ~85% local) readiness claim defensible from the evidence
   presented, or inflated/deflated? Is anything rated Working that the code says is Partial/Broken
   (or vice versa)?
4. COMPLETENESS: any demo-relevant surface or operational risk (env, deploy, data) the report
   misses that would embarrass a CEO demo?
5. ACTIONABILITY: are the owner actions unambiguous and minimal? Any step that is owner-gated but
   mislabeled autonomous-safe (the AI must never write qa_status, mutate the catalog, paste SQL,
   or merge without a codex-family GREEN)?

RETURN: BLOCKERs / IMPORTANTs / MINORs with file+line evidence, then a one-paragraph holistic
assessment. END WITH A SINGLE LINE: VERDICT: GREEN  or  VERDICT: RED
