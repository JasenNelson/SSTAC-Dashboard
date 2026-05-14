# Lane 2 End-to-End Dogfood Walkthrough

**Purpose:** Production-readiness acceptance gate. Owner runs all 10 steps end-to-end against a real submission, records PASS/FAIL per step, signs off. Per the comprehensive plan (Phase 6) at `C:\Users\jasen\.claude\plans\dynamic-shimmying-glacier.md`.

**Owner:** Jasen Nelson (sole reviewer).

**Prerequisites before running:**

- Engine Commit 2 + 3 + 4 landed on engine-v2 worktree master AND pushed to origin.
- Dashboard Phase 5 (memo verbatim integration) landed on SSTAC-Dashboard main AND pushed to origin.
- Owner-driven canary gate PASSED (3 entries in `engine_v2/docs/CANARY_LOG.md`).
- `RRAA_V2_SUBMISSION_RETRIEVAL_ENABLED` defaults to ON (post-Commit-4).
- Ollama running locally with the policy-evaluation model available.
- SSTAC-Dashboard dev server runnable (`npm run dev` from `C:\Projects\SSTAC-Dashboard`).

**Time estimate:** 30-60 min (depends on submission size and Ollama throughput).

---

## Steps

### Step 1: Upload a real submission `.pdf`

1.1. From `C:\Projects\SSTAC-Dashboard`, run `npm run dev`. Open `http://localhost:3000`. Log in as the owner (admin role).

1.2. Navigate to the engine-v2 project page. Create a new project OR open an existing one.

1.3. Click "Upload submission" (or equivalent). Select a real submission `.pdf` (PSI / DSI / RP).

1.4. Verify the upload progress indicator reaches 100% and the submission appears in the project's submissions list.

**PASS criteria:**
- [ ] Upload UI rendered without errors.
- [ ] File reached the server (no network errors in browser DevTools).
- [ ] Submission appears in the list with a non-empty filename.

**FAIL action:** Capture browser console + network tab; investigate; do NOT proceed.

---

### Step 2: Trigger extraction; verify blocks render with anchors

2.1. Click the new submission's "Extract" button (or equivalent).

2.2. Wait for extraction completion (status polling indicator). Typical: 30-120s depending on PDF size.

2.3. Open the extraction result view. Verify the text blocks render with page numbers AND section anchors.

**PASS criteria:**
- [ ] Extraction completed without errors.
- [ ] Blocks have non-null `page` for at least one block.
- [ ] Blocks have non-null `section` for at least one block.
- [ ] Verbatim text matches the source PDF for a spot-checked block (open the PDF in a viewer and compare).

**FAIL action:** Check Lane 1 logs; the L1-6 streaming fix should have shipped in Phase 7. If extraction OOMs on large PDFs, that fix may have regressed.

---

### Step 3: Trigger evaluation; wait for completion

3.1. Click "Run evaluation" (or equivalent) on the extracted submission.

3.2. Wait for evaluation completion. Typical: 5-30 min depending on cohort size + Ollama throughput.

3.3. Status indicator should poll and update; final status: `completed` (or `completed_with_errors`).

**PASS criteria:**
- [ ] Evaluation completed (status = `completed` or `completed_with_errors`).
- [ ] No `error` status terminal state.
- [ ] Spot-check: Ollama process was active during evaluation (`tasklist /FI "IMAGENAME eq ollama.exe"` or similar).

**FAIL action:** Check evaluator logs (`engine_v2/...` or whatever path the dashboard uses); if `RRAA_V2_SUBMISSION_RETRIEVAL_ENABLED` isn't reading as truthy, check the env var.

---

### Step 4: Open the evaluation page; per-policy rows render with ai_suggestion

4.1. Navigate to the completed evaluation's page in the dashboard.

4.2. Verify per-policy results table renders with rows for each policy in the cohort.

4.3. Each row shows: policy_id, tier, ai_suggestion (PASS / FAIL / NOT_FOUND / ESCALATE / OBSERVATION_ONLY), confidence, summary preview.

**PASS criteria:**
- [ ] All policies in the cohort appear as rows.
- [ ] `ai_suggestion` distribution shows a MIX (not 100% NOT_FOUND, not 100% ESCALATE).
- [ ] Tier badges render correctly (TIER_1_BINARY / TIER_2_PROFESSIONAL / TIER_3_STATUTORY).

**FAIL action:** If 100% NOT_FOUND / ESCALATE, the engine retriever is not finding submission-side evidence -- check that Commit 4 landed and the flag is ON. If verdict distribution looks wrong for the submission type, investigate the eval_result.json's `evidence_slices` content.

---

### Step 5: Click evidence citation pill; peek panel opens with verbatim excerpt

5.1. Find a per-policy row with `ai_suggestion = PASS` AND a non-empty evidence_packet.

5.2. Click the row to expand it; locate the evidence citation pills.

5.3. Click an evidence citation pill.

5.4. The side panel (Peek tab) should open AND display the verbatim submission excerpt with page + section labels.

**PASS criteria:**
- [ ] Pill click triggers peek panel open.
- [ ] Peek panel shows verbatim text (NOT empty, NOT a placeholder).
- [ ] `source.page` is rendered AND not "null" / empty.
- [ ] `source.section` is rendered AND not "null" / empty.
- [ ] The per-policy row pulses briefly (1.5s animation) to confirm the bidirectional link.
- [ ] The "cited by" cross-reference shows the originating policy.

**FAIL action:** If peek panel opens but content is empty / "no submission evidence cited", the engine emitted policy-self-reference slices. Re-check Commit 4 + canary log + `RRAA_V2_SUBMISSION_RETRIEVAL_ENABLED` flag state.

---

### Step 6: Search submission tab returns real chunks with highlights

6.1. Open the Search submission tab in the side panel.

6.2. Search for a known phrase from the submission (e.g., a chemical name, a site identifier).

6.3. Results should return chunks with `<mark>` highlights around the search term.

**PASS criteria:**
- [ ] Search returns >= 1 hit for a phrase known to be in the submission.
- [ ] Hits include page + section anchors.
- [ ] `<mark>` highlights render correctly around the search term.
- [ ] Search latency under 2 seconds for typical queries.

**FAIL action:** Check `v2_submission_chunks` table in Supabase (post-eval indexer should have populated it). Check FTS5 RPC `search_submission_chunks`.

---

### Step 7: Ask AI tab returns citations linking to real chunks

7.1. Open the Ask AI tab in the side panel.

7.2. Ask a natural-language question: "What does this submission say about [topic from the submission]?"

7.3. Wait for the SSE stream to complete (response renders progressively).

7.4. Response should include citation pills linking to real submission chunks.

7.5. Click one of the citations. Peek panel should open with the cited chunk's verbatim text.

**PASS criteria:**
- [ ] AI response renders progressively (SSE working).
- [ ] Response is grounded in the submission (mentions specific details from the submission, not policy-generic answers).
- [ ] Response includes >= 1 citation pill.
- [ ] Citation pill click opens peek panel with verbatim chunk text.
- [ ] Ollama process active during chat (load on `tasklist`).

**FAIL action:** Check Ollama is reachable from the dashboard's API route; check the chat route's RAG retrieval is fetching from `v2_submission_chunks` (not the policy corpus).

---

### Step 8: Record HITL judgment

8.1. On the per-policy results table, find a row with a non-trivial AI suggestion.

8.2. Click the row's judgment editor (or expand the row to access it).

8.3. Select a verdict that respects the tier rules:
- TIER_1_BINARY: ADEQUATE / INADEQUATE / DEFICIENT / REQUIRES_REVIEW.
- TIER_2_PROFESSIONAL: DEFICIENT / REQUIRES_REVIEW (NOT ADEQUATE).
- TIER_3_STATUTORY: OBSERVATION_ONLY only.

8.4. Enter a rationale (free text).

8.5. Click Save. Verify success indicator.

**PASS criteria:**
- [ ] Verdict dropdown enforces tier rules (TIER_2 has no ADEQUATE option; TIER_3 has only OBSERVATION_ONLY).
- [ ] Save succeeds without error.
- [ ] After save, the row reflects the new judgment.
- [ ] Spot-check Supabase: `v2_judgments` table has a new row matching the per_policy_result_id; `v2_judgment_history` has the audit trail row.

**FAIL action:** Check route `/api/engine-v2/per-policy/[id]/judgment` for CSRF / Zod / auth issues. Check RLS owner-AND-admin pattern is matching.

---

### Step 9: Export Memo; download .docx

9.1. Click "Export Memo" button on the evaluation page.

9.2. Wait for build (cached or fresh).

9.3. Download the `.docx`.

**PASS criteria:**
- [ ] Export button is enabled (status is terminal: completed / completed_with_errors / error).
- [ ] Build succeeds (no 500 error).
- [ ] `.docx` downloads via the GET stream.
- [ ] File size > 10 KB (non-trivial content).

**FAIL action:** Check route `/api/engine-v2/projects/[id]/evaluation/[evalId]/memo`; check Phase 5 memo verbatim integration code; check `v2_memo_exports` table.

---

### Step 10: Open .docx; verify per-policy verdict sections contain verbatim excerpts

10.1. Open the downloaded `.docx` in Microsoft Word.

10.2. Scroll through the per-policy verdict sections.

10.3. For each policy with non-empty `evidence_packet`, the memo should include the verbatim submission excerpt(s) the AI cited as evidence, with page + section anchors.

10.4. The HITL judgment + rationale (from step 8) should be embedded for the policies you judged.

**PASS criteria:**
- [ ] Title page renders with project name + completion date (no raw UUIDs visible).
- [ ] At least one policy section contains a verbatim submission excerpt with page + section.
- [ ] The HITL judgment from step 8 is embedded under that policy section.
- [ ] Typography: Times New Roman, 11pt body / 14pt headings / 18pt title (per owner feedback 2026-05-12).
- [ ] Memo does NOT contain "No verbatim submission evidence cited" stubs for policies that have real evidence (only for genuinely empty-evidence policies).

**FAIL action:** Phase 5 memo verbatim integration regression. Check the diff and rebuild.

---

## Sign-off

When all 10 steps PASS:

> **Lane 2 end-to-end dogfood PASSED.** System verified production-ready for the HITL regulatory review use case.
>
> Operator: Jasen Nelson, YYYY-MM-DD HH:MM PDT.
> Submission: `<filename>` (type: __).
> Evaluation eval_id: `<from step 3>`.
> Memo `.docx` SHA-256: `<from download or v2_memo_exports table>`.

This sign-off completes Phase 6 of the production-readiness plan. Phase 10 (Phase 5 A/B rebaseline) and Phase 11 (final acceptance sign-off) become unblocked.

---

## Recording PASS/FAIL per run

Each time this walkthrough is run, append a new "Run YYYY-MM-DD" section below with the step-by-step PASS/FAIL annotations. Multiple runs are valid (rerun after fixing regressions).

### Run YYYY-MM-DD -- TEMPLATE

- Step 1: __PASS__ / __FAIL__ -- notes: `<...>`
- Step 2: __PASS__ / __FAIL__ -- notes: `<...>`
- Step 3: __PASS__ / __FAIL__ -- notes: `<...>`
- Step 4: __PASS__ / __FAIL__ -- notes: `<...>`
- Step 5: __PASS__ / __FAIL__ -- notes: `<...>`
- Step 6: __PASS__ / __FAIL__ -- notes: `<...>`
- Step 7: __PASS__ / __FAIL__ -- notes: `<...>`
- Step 8: __PASS__ / __FAIL__ -- notes: `<...>`
- Step 9: __PASS__ / __FAIL__ -- notes: `<...>`
- Step 10: __PASS__ / __FAIL__ -- notes: `<...>`
- Overall: __PASS__ / __FAIL__
