# SSTAC-Dashboard -- Session Handoff 2026-06-21d (evidence-note backport)

Supersedes FRESH_SESSION_HANDOFF_2026_06_21c_IRIS_LANDED.md. Plain ASCII. Base main @ 0d349ac.

This session executed the 21c handoff's top-recommended follow-up: the evidence-note backport.

---

## Shipped: PR #384 (feat/mo-evidence-note-backport-2026-06-21, commit 6c70a99)

The 2026-06-21 IRIS scripts (promote-iris-rfd-batch / -chemdetails) stamp a superseding note on
evidence_items[*].note when flipping evidence to approved. This PR backports that to the three
earlier promote scripts and re-applies them (owner-attested) to repair 118 already-approved rows
that still read "pending direct-source verification" while approved + direct_source_verified.

- promote-iris-carcinogen-rfd.mjs (6) + promote-hc-trv-v4-2025.mjs (92): VERBATIM mirror (via AGY)
  of buildEvidenceNoteStamp / stampEvidenceNotes / evidenceNoteRepairNeeded + the approveEvidence
  note-append + the valueAlreadyDone repair branch. Both already had the value-level stamp.
- apply-qa-promotion.mjs (20; HAND-AUTHORED -- the divergent one): added the helpers + a repair pass
  over the already-approved skip-set + a write-guard that writes on repair-only. The repair is
  --canonical-independent and idempotent. Per codex: only stamps rows whose evidence is genuinely
  approved + attested; the EPA-snapshot data-integrity gate now guards BOTH the promote and the
  repair write paths (a drifted already-approved value fails closed).
- Owner-attested --apply (reviewer "J. Nelson", 2026-06-21): 118 rows (20 + 6 + 92). Verified: 0
  approved scoped rows still match /pending/ without the marker; catalog totals UNCHANGED
  (1161 approved / 416 needs_review); diff 118 insertions / 118 deletions (note text only).
- vitest_test_count 4448 -> 4451 (+3 apply-qa tests: repair-only-path under both --canonical
  variants, partial-row fail-safe, drifted-row fail-closed).

Gates GREEN on tip 6c70a99: test:ci 4451, tsc, lint (0 err), docs:gate, build, e2e 117. Codex
two-tier: Spark grind GREEN -> gpt-5.5 xhigh GREEN (2 P2 rounds resolved to mutual agreement).

## Known-deferred (this PR scope = evidence-note ONLY)
apply-qa's 20 rows: their value-level applicability/uncertainty/review_notes fields are NOT stamped
(apply-qa never had the value-level stamp; owner scoped this PR to the evidence note). If any carry
"pending" language there, that remains -- a separate, tracked follow-up. Noted in the PR body.

## Remaining MO follow-ups (unchanged from 21c)
1. EvidenceLibrary live-table virtualization (codex Option 2; UI/perf). The 2026-06-21 fix bounded
   only the TEST. The live Values table still renders every row (1161+) + computes
   defaultPolicyDecisions over the full library. Virtualize/paginate with accurate totals; not a
   blind .slice(0,50).
2. apply-qa value-level stamp (the known-deferred above) -- small; same pattern as the other scripts'
   stampValueProvenance if owner wants it.
3. 61 deferred dupe-candidate_group_id rows (trimethylbenzenes / 1,1,1-TCA / RDX / short-chain PFAS):
   owner picks the canonical IRIS RfD/RfC estimate per substance before promotion.
4. BC Protocol 28 2021-jan (355 needs_review): BLOCKED -- src-bc-protocol-28-2021-jan unpinned. Pin
   the source first.
5. Map-LOAD consumer + load (per #381 design doc): app-layer RPC/TS is autonomous; the Supabase data
   load is owner paste (migration #373 apply + PATH_B chunk paste + --allow-undated ETL).

## Lessons (new this session)
- AGY-as-workhorse: AGY faithfully mirrors a reference pattern (verbatim script + test edits) from a
  tight file brief; verify via git diff + grep, never AGY stdout (suppressed when piped). Hand-author
  the BESPOKE variant (apply-qa) -- that is where AGY drifts.
- A hand-authored variant of a reference pattern needs the SAME fail-closed preconditions on EVERY
  write path. codex 5.5 xhigh caught two apply-qa P2s (evidence-approved gate on repair; EPA-snapshot
  gate ahead of the promote/skip split) that Spark + Opus missed.
- codex `review -` gives NO verdict on a non-diff artifact (a plan .md outside the repo) -- it is
  diff-oriented. For plan review rely on the adversarial subagent/prior-session pass; run codex on the
  real DIFF.

## Gate cheatsheet (per docs/GATE_MODE_SOP.md)
test:ci (4-shard) -> npx next typegen + npx tsc --noEmit -> npm run lint -> npm run docs:gate --
--base main --head HEAD -> npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10 ->
npm run test:e2e -> /codex-review (Spark grind -> 5.5 xhigh) to mutual-agreement GREEN -> push -> PR
-> merge on green. Current vitest_test_count (manifest): 4451.
