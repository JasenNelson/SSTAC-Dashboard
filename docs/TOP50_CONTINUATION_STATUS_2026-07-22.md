# TOP50 CONTINUATION STATUS -- 2026-07-22 (autonomous run, post-KB-lane close-out)

> UPDATE (2026-07-22, later run): rows 40 and 18 are now **RETIRED** -- the owner approved
> confirm-retire contingent on re-verification, and both conditions were RE-VERIFIED live
> (read-only) after the #739/#741/#742 merges: `authenticated` still holds ONLY SELECT on
> `matrix_map.dras` at both table and column level with `trg_dras_public_flip_only` present
> (row 40), and `matrix_map.samples.waterbody_type` still has zero case variants
> (Marine 268 / Freshwater 22 / empty 4204) (row 18). The separate 93.55%-empty
> `waterbody_type` backfill lane is explicitly **PARKED** (owner-scoped; needs a
> source/derivation decision -- see the 2026-07-11 normalization report section 5b).
> Sections 1 and 5 below predate this update; where they say "recommend retire" /
> "confirm retirement", the retirement is now recorded.

Follows `docs/TOP50_CONTINUATION_STATUS_2026-07-21.md` and reconciles the queue against
origin/main f5aa0f56 (#735-#738 merged) plus LIVE read-only Supabase verification performed this
run. Owner rulings in force this run: Phase 3.5 = STOP-HERE (no Phase 4-7 KB work); Sentry PARKED;
Row 12 approved ONLY as a stale-fact/staleness-note fix (no new grade computation).

## 1. Rows resolved or reclassified this run (with evidence)

- **Row 44 (submission-search FTS): D1 RESOLVED.** The legacy route is local-dev/admin-only and not
  production-functional (better-sqlite3 is an optionalDependency + webpack-externalized -> 503 path;
  no `.db` file is git-tracked under `src/data/` -> no deployed data -> 500 path; `requireAdmin()`
  gate). Row stays DEFERRED per the design doc's own recommendation. See
  `docs/design/SUBMISSION_SEARCH_FTS_DESIGN_2026-07-21.md` section 7 (updated this run).
- **Row 40 (optional defense-in-depth REVOKE on `dras_admin_all`): ALREADY-SATISFIED -- no draft
  needed.** Live verification (read-only `pg_policies` / `information_schema` / `pg_proc` queries,
  2026-07-22): role `authenticated` holds ONLY `SELECT` on `matrix_map.dras` -- no table-level or
  column-level UPDATE/INSERT/DELETE privilege exists to revoke, so the privilege layer already
  blocks every direct write regardless of the `dras_admin_all` RLS policy (`cmd ALL`). On top of
  that, `trg_dras_public_flip_only` + `matrix_map.enforce_dras_public_via_flip()` are live and
  raise on ANY `public` change unless made by `matrix_map_owner` inside `flip_dra_public`'s
  audited path (`matrix_map.audited_flip` marker), and `flip_dra_public` is SECURITY DEFINER owned
  by `matrix_map_owner`. Base row #27's R2 gap ("un-audited direct UPDATE dras SET public") is
  closed at three layers: privileges, RLS-independent trigger guard, and the audited RPC. The row
  can be retired; if the owner still wants a belt-and-suspenders artifact, the only remaining
  candidate is a no-op-documenting migration, which is NOT recommended (nothing to revoke).
- **Row 18 (waterbody_type casing normalization): MOOT -- already applied live.** Live distinct
  counts on `matrix_map.samples.waterbody_type` (read-only, 2026-07-22): `''` 4204, `Marine` 268,
  `Freshwater` 22 -- zero lowercase/mixed-case variants remain (the 2026-07-11 report's 25
  `marine` + 8 `freshwater`-class rows are gone; populated total 290 all-canonical). The follow-up
  "ready-to-run UPDATE draft" is unnecessary. The separate 93.55%-empty backfill question
  (report section 5b) remains explicit-scope-deferred / owner-scoped.
- **Row 12 (`current_grade` re-analysis): OWNER-GATED this run by explicit ruling** ("only a
  stale-fact/staleness-note fix, not a new grade calculation"). The ruled scope is ALREADY
  satisfied on origin/main: the manifest's `current_grade` carries a thorough `staleness_note`
  (flagged 2026-07-22) and zero "PROPOSED" wording exists in `docs/_meta/docs-manifest.json`
  (grep-verified; unrelated docs elsewhere legitimately contain the word "PROPOSED" -- the claim
  is scoped to grade/manifest wording only); `docs/INDEX.md` makes no grade claims (verified).
  NOTE: `README.md:109` DOES carry a historical grade statement ("C (66%) -> B+ (83-84%)") in its
  completed-infrastructure narrative -- that is preserved-historical wording of the class
  `docs/NEXT_STEPS.md:155` documents as deliberately retained planning history, and whether to
  refresh it belongs to the owner-gated fresh re-analysis, not the ruled stale-fact scope. A FRESH
  7-category re-analysis remains a real,
  well-defined future task -- batched to the owner (the staleness_note itself requests it).
- **MONITORING_BASELINE broken path (NEXT_STEPS candidate): already RESOLVED 2026-07-20**
  (`docs/NEXT_STEPS.md:157`).

## 2. KB hardening shipped this run (gate-independent, owner-approved)

- `.graphifyignore` json exclusion + full DOC_EXTENSIONS blanket; `graph_smoke.py` zero-tolerance
  DATA-AS-CODE audit + `--data-allowlist`; tests 48 -> 57 + ignore-file regression guard
  (PR #739, gap-analysis findings 1-2).
- `ascii_json.py` disposition recorded: not needed Phase 0-3.5; MANDATORY Phase 7 pre-condition
  (separate docs PR).

## 3. Queue-doc contradictions found (fix when the queue is next reconciled)

1. Row 18: the 2026-07-20 doc tags it SAFE, but its own evidence file says the fix is an
   owner-gated DATA WRITE (and it is now moot anyway -- section 1).
2. Row 39 vs row 50: row 39's "51 explicit-any" premise predates PR #725 (ESLint no-explicit-any
   warnings now 0); the rows were never reconciled against each other.
3. Row 45: 2026-07-20 doc lists it open/SAFE; retired as already-applied in the 2026-07-21
   continuation (46c6d0eb).
4. Row 44: the 2026-07-20 SAFE tag refers to the design (done); the feature itself is DEFERRED by
   owner ruling -- reading the status cell alone misleads.

## 4. Remaining SAFE-autonomous queue after this run

**EMPTY.** Every remaining open Top-50 row is one of: owner-gated (decisions/merges/data writes:
rows 8, 12-reanalysis, 16, 17-disposition, 20-22, 24, 26-27, 29-34, 38-39, 41, 47, 48), blocked on
infrastructure this run may not touch (42 Ollama; 49 Phase 4-7), parked (6 Sentry, 19), or
done/retired (all others). This is the blocker table per the run's stop conditions; no safe work
remains without a new owner ruling.

## 5. Owner decision batch (carried forward + new)

1. Merge this run's PRs (#739 + the docs PRs opened after it).
2. Phase 3.5: STOP-HERE recorded; revisit only on new evidence (a second wiki-helped-real-work
   data point now exists -- see the D1 investigation provenance in the FTS design doc).
3. Row 12: authorize (or defer) the fresh 7-category grade re-analysis.
4. Row 40: confirm retirement (already-satisfied at three layers; recommended: retire).
5. Row 18: confirm retirement (moot; already normalized live); separately scope-or-park the
   93.55%-empty backfill lane.
6. Rows 29-34/38/47: cleanup batch (worktrees, scratch, stale PRs, backup table) -- all owner-run
   or owner-supervised per junction/no-delete rules.
