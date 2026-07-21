# Top-50 Continuation -- Status + Owner Packet (2026-07-21)

Autonomous continuation from `origin/main = 7614d81b` (through PR #720). Live facts were re-derived;
the `SSTAC_TOP50_RECONCILED_2026_07_20.md` queue was treated as a starting point, not current truth.
This run made **no** data write, publication, `flip_dra_public`, migration, catalog change, OCR/vision
run, deploy, or secret change. It stops every gated item at an owner decision below.

## 1. Row disposition this run

**Executed:**
- **Row 2 (PROD deploy-health check)** -- shipped as PR #721 (`feat/prod-deploy-health-check-2026-07-21`):
  a read-only `GET /api/health` SHA/env probe + `scripts/verify/check-prod-sha-drift.mjs` that flags
  production-tip-vs-`origin/main` drift. Build-only; CI wiring + alerting is row 2b (owner).
- **Row 36 (refresh `docs/LESSONS.md`)** -- added a 2026-07-21 HIGH lesson (read-only premise-first
  extraction discipline from the Option D arc). This PR.
- **Row 17 (public DRA contributing 0 samples)** -- read-only investigation complete (section 2).

**Verified ALREADY-DONE (no-op; retire from the queue):**
- Rows 35 (2 broken `file:///` links) + 37 (non-ASCII in `docs/INDEX.md`) -- both landed via PR #706.
- Row 43 (pyramid-navigation "unresolved" framing in `NEXT_STEPS.md`) -- already corrected to
  "RESOLVED: superseded (shipped inline in `ReviewDashboardClient.tsx`)."

**Retired -- closed by owner ruling / prior PRs (no longer autonomous work):**
- Rows 1, 3, 4, 5, 25 (publication / centroid decision) -- owner ruling 2026-07-20/21: no centroid
  publication now; Option C site aggregates are the map-honesty path.
- Rows 13, 14, 15, 46 (coordinate extraction / OCR / source hunts) -- **Option D closed** by owner
  ruling 2026-07-21 (accept centroid medium tier). See `OPTION_D_*` evidence packets (#715-#720).
- Row 28 (`equationDispatch.test.ts` `it.todo`) -- retracted 2026-07-20 (deliberate forward-declares).

**Out of scope for a repo docs PR:**
- Row 8 (KB plan "not started" framing) -- the stale text lives in `~/.claude/plans/jolly-marinating-piglet.md`
  (a personal plan file OUTSIDE this repo). The three cited commits (`fb4f7d9c`, `4811fef9`, `ae8d48db`)
  confirm Phases 2-3 shipped, so the plan doc's "not started" line is stale -- but it cannot be fixed
  by a SSTAC-Dashboard docs PR. Owner edits the plan file directly.

## 2. Row 17 -- read-only evidence: the public DRA with 0 samples

The public DRA contributing 0 samples is **`c2284286-0cc8-4385-84bc-12f1b97f98dc`** -- "Data Report for
Sediment 2009-2012 at IOCO T1 Shoreline - Technical Memorandum" (`site_id 5`, `bnrrm_doc_id 7`,
`public = true`, `is_deleted = false`, `sample_count = 0`).

It is a **companion document to the same site's IOCO Shoreline ERA** (`ea15e94a`, `site_id 5`,
`bnrrm_doc_id 6`), which holds the site's 6 samples (all high-tier/surveyed). The IOCO shoreline
sediment data is attributed to the ERA DRA (doc 6), so the data-report DRA (doc 7) legitimately has
zero samples. This is a data-attribution artifact, **not a data error and not false data** -- the
empty DRA simply renders no markers on the map. All read-only (five public DRAs; `dras_public = 5`,
`samples_public = 0`, last visibility change 2026-07-18 22:00, unchanged).

## 3. Owner decision packet (batched -- no drip-feed)

1. **Row 17 disposition (the empty IOCO data-report DRA `c2284286`).** Options: (a) leave published
   (harmless companion doc; renders nothing); (b) unpublish it via `matrix_map.flip_dra_public`
   (owner-only admin action; keeps the map's published set to DRAs that actually show data); (c)
   re-attribute -- NOT recommended (a data write; the ERA attribution is correct). Recommended: (b) if
   the owner wants the published set to be markers-only, else (a). AI does not flip.
2. **Row 2b (deploy-health wiring).** PR #721 ships the check only. Decide: wire
   `check-prod-sha-drift.mjs` into a scheduled CI job / cron, and the alerting behavior (fail the job /
   Slack notice). Separately, re-deploying the current tip to production is an owner action.
3. **Row 8 (external KB plan doc).** Update the "Implementation NOT started" line in
   `~/.claude/plans/jolly-marinating-piglet.md` to reflect merged Phases 2-3 -- owner-side, outside this repo.

## 4. Forbidden-scope confirmation

No Supabase/`execute_sql` write, no migration/RLS/schema/catalog change, no `current_default`
promotion, no coordinate write, no publication or `flip_dra_public`; no OCR/vision/georeferencing/
source hunt; no production deploy, Vercel mutation, or secret inspection/setting; no Ollama/nightly/
hooks; no destructive cleanup, branch pruning, root `.tmp` deletion, or worktree deletion; no
`gh pr merge`; no adoption of the stale draft PR branches (#108-#187).
