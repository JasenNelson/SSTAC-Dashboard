# engine_v2 Frontend -- S4 Read-Side + AI-Scope Rename + Tier-Explainer Neutralization Handoff (2026-06-02)

Status: the read-side + AI-scope rename LANDED on `main` (PRs #229 / #231 / #234 -- each
codex-reviewed, 4 gates GREEN at merge, merged). The memo Tier-explainer neutralization +
memo-cache version-invalidation is in THIS PR (branch
`feat/memo-tier-explainer-neutralize-2026-06-02`), which is NOT yet merged: review complete
(codex + Opus ultracode legs; the codex CLI backend was network-flaky this session, so the
codex legs were the first CLI run + an owner-run codex desktop pass), all 4 LOCAL gates
GREEN (lint + unit + build + e2e chromium), PR open, merge owner-gated.

This is the dashboard-side counterpart to the engine S4 tier-decoupling surgery (engine
repo `Regulatory-Review`, master = 197df7b9): the engine is TIER-BLIND and emits
`schema_version` 0.1.0 with tier recorded only as INERT PROVENANCE. The AI surfaces
evidence; it does not determine adequacy / compliance / sufficiency / tier -- that is HITL
professional judgment.

## What the engine changed (upstream context)

The engine 0.1.0 per-policy packet drops `ai_suggestion` / `verdict_suggestion` /
`tier_render_policy` / `adequacy` / `NOT_FOUND` and adds evidence-direction fields:
`evidence_present`, `signal_counts`, `confidence_scope`, `evidence_synthesis_self_score`,
`indigenous_content_signal`. Tier is recorded but never branched on (inert provenance).
Legacy 0.0.1 packets (verdict + ai_suggestion + tier render policy) still exist in
historical eval runs, so the read-side is dual-version: it renders BOTH contracts and never
assumes a single shape.

## PRs (squash-merged onto main, plus this PR)

| Merge SHA | PR | Summary |
|-----------|----|---------|
| 8fb055a | #229 | S4 tier-decoupling read-side: render tier-blind 0.1.0 evidence-status packets (helper + types + importer + table render + memo/export/eval SELECTs + idempotent schema-record migration) |
| 1b79cf3 | #231 | S4 read-side review follow-ups: export Confidence column scope-aware + legacy verdict sort restored |
| 926b631 | #234 | S4 read-side AI-scope rename: "AI Evidence Synthesis" label across table + export + memo (schema-aware/version-aware; legacy 0.0.1 labels preserved) |
| (this PR) | feat/memo-tier-explainer-neutralize-2026-06-02 | Memo Tier-explainer full neutralization (Option A) + memo-cache version-invalidation (see below) |

main tip after #234: 926b631 (base for this PR was current `origin/main`).

## This PR: memo Tier-explainer neutralization (Option A) + cache fix

PR #234 made the memo headers/cells version-aware and added neutralized 0.1.0 explainer
variants for Tier 1 and Tier 2, but Tier 3 had no neutralized variant, so a tier-blind
0.1.0 memo containing any Tier-3-provenance policy still printed "The AI provides
observations only" -- a tier-scaled AI-authority claim the engine no longer makes (and a
false statement on a Crown-facing document). The redesign memo
(`engine_v2/docs/MEMO_TIER_EXPLAINER_REDESIGN_2026_06_02.md`) recommended Option A; the
owner approved it.

Changes in `src/lib/engine-v2/memo_builder.ts`:
- The three `TIER_n_EXPLAINER` constants now use a single, role-framed AI clause that is
  byte-identical across all tiers and contains NO authority verb (no determine / flag /
  observe attributed to the AI): "The AI's role is to surface relevant submission evidence
  with verbatim citations; ...". Only the HITL-gate clause and the deciding-authority noun
  differ per tier (reviewer / QP / SDM-Crown). Role framing (not "the AI surfaced ...") is
  deliberate so the explainer does not over-claim on empty or no-evidence tiers, where the
  per-policy "No verbatim submission evidence cited by AI" line reports the actual outcome.
- The `TIER_1_EXPLAINER_ES` / `TIER_2_EXPLAINER_ES` variants are removed and the
  `memoIsEvidenceStatus(...)` ternary is dropped from the explainer line in
  `buildTier1Section` / `buildTier2Section`. There is now one explainer constant per tier.
- KEPT: header / heading / cell version-awareness ("AI Evidence Signal" vs "AI Suggestion"
  / "AI Flag"; Tier-2 "Items" vs "Flagged Items"; `aiSignalForMemo`) -- those reflect a real
  data-shape difference, not an AI-authority claim.

Changes in the memo route
(`src/app/api/engine-v2/projects/[id]/evaluation/[evalId]/memo/route.ts`):
- The memo cache keyed only on `(evaluation_id, judgment_snapshot_hash)`, which excludes the
  explainer prose, so a prose change alone would never reach an already-cached memo. Fix:
  `MEMO_GENERATOR_VERSION` bumped (`lane2b-memo-v1` -> `lane2b-memo-v2`) and the cache-lookup
  SELECT now filters on `generator_version = MEMO_GENERATOR_VERSION` (a stale-version row is
  a MISS). The `v2_memo_exports` table grants SELECT / INSERT / DELETE but NOT UPDATE, so on
  a `23505` unique collision the route reads the existing row's `generator_version`: a
  same-version row is reused (cache hit); a stale-version row is DELETEd by id and the INSERT
  retried once (bounded). DELETE-by-id (not by eval+snapshot) cannot remove a freshly inserted
  concurrent row.

Tests:
- `src/lib/engine-v2/__tests__/memo_builder.test.ts` -- the legacy assertion was flipped
  (determination-voice must now be ABSENT), and a durable regression test asserts no memo
  (legacy 0.0.1 all-tier, AND a 0.1.0 memo that INCLUDES a Tier-3 policy -- the original leak)
  contains "provided an initial determination" / "can only flag" / "provides observations
  only". A no-over-claim assertion confirms the role-framed explainer renders even on an
  empty / no-evidence tier.
- NEW `src/app/api/engine-v2/projects/[id]/evaluation/[evalId]/memo/__tests__/route.test.ts`
  -- proves the version-gated cache MISS regenerates rather than returning the stale blob (and
  asserts the `generator_version` filter is actually applied and the stale-row DELETE fires).

## Entry points (source files)

Version-resolution + helpers:
- `src/lib/engine-v2/schema_version.ts` -- `resolveS4Version` (per-packet Rule 1b fallback),
  `isEvidenceStatusVersion` (forward-safe, >= 0.1.0), `resolveEvidenceStatus` (column-first
  then `raw_result_json` fallback; banded total-order `sortKey`).
- `src/lib/engine-v2/types_lane2.ts` -- `V2PerPolicyResult` extended with 5 nullable S4 fields.

Import + render:
- `src/lib/engine-v2/eval_result_import.ts` -- `toPerPolicyRow` reads the 5 evidence fields
  from the PER-PACKET `raw.schema_version` (Rule 1: never the `eval_result` envelope).
- `src/components/engine-v2/EvidenceStatusCell.tsx` -- 0.1.0 cell (present/absent, signal
  counts, match-scoped confidence, Indigenous content-type badge).
- `src/components/engine-v2/PerPolicyResultsTable.tsx` -- version-branches the verdict render,
  technical-details disclosure, column header, cross-version sort, and the verdict/evidence
  filter. Tier render/sort/filter + the HITL judgment editor are UNTOUCHED.

Memo + export:
- `src/lib/engine-v2/memo_builder.ts` -- evidence-status summary for 0.1.0 rows; schema-aware
  headers; the neutralized Tier explainers (this PR).
- `src/lib/engine-v2/export_formats.ts` -- CSV/Markdown/HTML "AI Suggestion" header is
  schema-aware; Confidence column is scope-aware.

Route SELECTs (added the 5 S4 columns):
- `src/app/(dashboard)/dashboard/engine-v2/projects/[projectId]/evaluation/[evalId]/page.tsx`
- `src/app/.../evaluation/[evalId]/export/route.ts`
- `src/app/.../evaluation/[evalId]/memo/route.ts`

## Schema (already applied to live DB)

`supabase/.../database_schema_engine_v2_lane2a_s4_expand_record.sql` is an idempotent RECORD
migration (ADD COLUMN IF NOT EXISTS x5 + CREATE INDEX IF NOT EXISTS on `s4_schema_version`)
documenting the 5 nullable `v2_per_policy_results` columns already applied to the live DB on
2026-06-01. Do NOT re-run it as a new change. The memo-cache fix in THIS PR requires no schema
change (DELETE is already granted on `v2_memo_exports`; verify the live grant/RLS has not
diverged from `database_schema_engine_v2_lane2b_patch.sql` before merge per the
explore-before-assume protocol).

## Key invariants (DO NOT regress)

- Per-packet version resolution: ALWAYS resolve the S4 version from the per-packet
  `raw.schema_version`, NEVER from the `eval_result` envelope. A single envelope can carry
  mixed-version packets.
- Legacy preservation: 0.0.1 render is byte-unchanged except for the now-neutralized explainer
  PROSE (the legacy "AI Suggestion" / "AI Flag" / "Flagged Items" data-shape labels are kept;
  only the determination-voice explainer sentence was corrected, across both versions).
- AI-scope wording: no memo, any tier, any version, asserts the AI determined / flagged /
  observed, nor that it cited evidence where none exists. The HITL judgment editor is untouched.
- Memo cache: a `MEMO_GENERATOR_VERSION` bump regenerates existing memos (never serves the
  stale blob); same-version concurrent collisions reuse the existing row.

## Review + gates

- The merged read-side PRs (#229 / #231 / #234) were each codex-reviewed with 4 gates GREEN at
  merge. For THIS (memo Option A) PR the codex + Opus ultracode legs caught complementary
  issues: codex flagged the no-evidence over-claim in the first wording draft (now role-framed);
  the Opus leg + codex flagged that the route test did not actually verify the version-gate /
  DELETE (now hardened, mutation-verified). The codex CLI backend was network-flaky this
  session, so the codex legs were the first CLI run + an owner-run codex desktop pass.
- THIS PR: all 4 LOCAL gates GREEN (lint 0 errors; unit test:ci 190 files passed / 0 failed;
  build:monitored:clean exit 0; e2e chromium 46 passed / 23 auth-skipped / 0 failed). NOT yet
  merged -- merge owner-gated.
- Live canaries GREEN (engine side; the dashboard read-side is verified by unit + e2e).

## Related plan docs

This lane extends the engine_v2 frontend Lane 2 family:
- `docs/engine_v2_frontend_lane2a_plan_2026_05_12.md` (evaluate -> per-policy table).
- `docs/engine_v2_frontend_lane2b_plan_2026_05_12.md` (HITL judgments + memo + export + filter/sort).
- `docs/engine_v2_frontend_lane2d_plan_2026_05_13.md`.
- `engine_v2/docs/MEMO_TIER_EXPLAINER_REDESIGN_2026_06_02.md` (the Option A design memo, engine repo).

---

Last verified: 2026-06-02 (origin/main = 5c2137a, which this PR branched off; the #234
read-side/rename merge was 926b631, an ancestor with only a docs-only delta since).
