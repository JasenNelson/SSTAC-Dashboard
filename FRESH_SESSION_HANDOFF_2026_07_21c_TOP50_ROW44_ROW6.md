# FRESH SESSION HANDOFF -- 2026-07-21c (Top-50: row 44 + row 6 design docs; row 19 parked)

BASELINE: `origin/main` = `46c6d0eb` at session start (verified). Bounded-batch continuation after
the merged rows 2b/50/45 batch (#724/#725/#726). All work in fresh worktrees off origin/main; the
stale Row-34 primary checkout was left untouched.

## WHAT THIS BATCH DID

| Lane | Row | Outcome | PR |
|---|---|---|---|
| Design docs | 44 (submission-search FTS perf plan) + 6 (Sentry CI-secrets packet) | SHIPPED | **#727** (`docs/submission-search-fts-design-2026-07-21`) |
| P28 sweep | 19 (357-row verify-vs-primary) | PARKED (forbidden/owner-gated) | none |
| Gate-mode | SOP 4-vs-6-gate reconciliation | OWNER-PACKET (no doc edit; needs auth) | none |

### Row 44 -- submission-search FTS design (docs-only, in #727)
`docs/design/SUBMISSION_SEARCH_FTS_DESIGN_2026-07-21.md`. The task's "Postgres FTS" framing was
imprecise: the real target is the LEGACY `regulatory-review` submission-search route
(`src/app/api/regulatory-review/submission-search/route.ts`) -- a full in-memory JSON scan over
`assessments.evidence_found` in a **local-dev-only SQLite** DB (`better-sqlite3`; 503 on missing
native module, 500 on missing DB file; `requireAdmin()`-gated), NOT Postgres. Design evaluates Option
0 (converge on the already-shipped engine_v2 Postgres FTS `v2_submission_chunks`), Option A
(recommended: SQLite FTS5 external-content excerpt table mirroring the in-repo `policy_statements_fts`
pattern, with `ON DELETE CASCADE`), Option B (Supabase migration). Deferred until >1K assessments
(not yet hit; ~841 excerpts). Design-only, no code.

### Row 6 -- Sentry CI-secrets packet (docs-only, in #727)
`docs/design/SENTRY_CI_SECRETS_WIRING_PACKET_2026-07-21.md`. The CI plumbing is ALREADY wired
(`ci.yml:139-141,278-280` reference `secrets.SENTRY_ORG/PROJECT/AUTH_TOKEN`; `next.config.ts`
`withSentryConfig`; runtime configs `Sentry.init`). Missing = the values. Packet documents what to set
(`NEXT_PUBLIC_SENTRY_DSN` runtime capture; the three build-time secrets for source-map/release upload
-- GitHub and/or Vercel), how to verify, and the `next.config.ts:53 silent:!SENTRY_DSN` gotcha (bare
`SENTRY_DSN` is referenced nowhere else, so `silent` is effectively always true; cosmetic; cleanup is
an owner-gated one-line change to a Tier-1 file). No secret inspected/set/printed.

### Row 19 -- PARKED
The 357-row verify-vs-primary inventory already exists (`docs/MATRIX_OPTIONS_P28_VERIFY_WORKLIST_2026_07_12.md`).
The remaining work is per-value VISION-vs-primary verification (forbidden this run) + owner-gated
promotion. No new safe evidence to produce. Do not run `audit-hc-p28-integrity.mjs` blindly -- it
OVERWRITES the dated `docs/MATRIX_OPTIONS_HC_P28_INTEGRITY_AUDIT_2026_07_04.md` (a different audit).

### Gate-mode reconciliation -- OWNER PACKET
`docs/GATE_MODE_SOP.md` frames the push suite as "4-gate (lint+unit+build+e2e)" (section 3/Phase 4);
the user-level `ship-protocols` skill frames it as 6 (adds docs gate + the commit/push/merge split).
Both describe the same underlying gates; it is a naming/count drift. Recommendation: update
GATE_MODE_SOP to match the live ship-protocols authority -- but editing the SOP (Tier-1) needs owner
authorization, so this is a packet item, not done here.

## OWNER QUEUE (batched)
1. **Merge #727** after CI green (docs-only; owner-only merge).
2. **Row 44 decisions:** D1 -- is the legacy submission-search route reachable in production or
   local-dev/admin only? (drives whether it ever needs implementing). D2 -- Option A (SQLite FTS5) vs
   wait for the engine_v2 port (Option 0). D3 -- relabel row 44 lane `MO -> reg-review`.
3. **Row 6 decisions:** D1 -- set `NEXT_PUBLIC_SENTRY_DSN` (Vercel prod). D2 -- set the three upload
   secrets (GitHub and/or Vercel, per where the release build runs). D3 -- leave or authorize the
   `silent:!SENTRY_DSN` one-line `next.config.ts` cleanup.
4. **Gate-mode:** authorize updating `docs/GATE_MODE_SOP.md` to 6-gate framing, or confirm 4 is canonical.
5. **Row 19:** owner-gated vision-vs-primary sweep (357 rows) -- a multi-session lane needing the
   forbidden-this-run vision/source access.

## PROCESS HYGIENE / WORKTREES
Two new worktrees this batch (junctioned node_modules to the shared store): `row44-fts-2026-07-21`,
`handoff-2026-07-21c`. Plus the prior batch's `top50-row2b-2026-07-21`, `lane-b-anyburndown-2026-07-21`,
`handoff-2026-07-21b`. **NEVER recursive-delete** (junction hazard, L0 1.15) -- owner-gated cleanup
batch. Processes: only transient gate/codex/CI-watch workers (exit on completion); the aged node/python
are MCP infra (gdrive-mcp) -- do not kill.

## FORBIDDEN-SCOPE CONFIRMATION (this batch)
No Supabase write/migration/RLS/schema change, no catalog apply or `current_default` change, no
`src/data` mutation (read-only inspection only), no production deploy / Vercel mutation, no secret
inspection/setting/printing, no OCR/vision/source-hunt, no Zotero write, no `flip_dra_public`, no
`gh pr merge`, no destructive cleanup / branch pruning / root `.tmp` deletion / shared-checkout touch.
`docs/GATE_MODE_SOP.md` not edited (owner-auth pending). `next.config.ts` (Tier-1) read only.

---

Claude-token spend risk for next step: **low** (remaining lanes are owner-gated decisions or a
multi-session vision sweep). AGY delegation opportunity: **yes** -- once the SSTAC worktree
`/permissions` grant is set, design-doc drafting + inventory scripts are clean AGY jobs; this batch
used a Sonnet subagent for the search-surface map (cheap) and inline authoring for the docs.
