# SSTAC-Dashboard Lessons Learned

**Document Purpose:** Capture reusable patterns, architectural decisions, and challenges discovered during development. These lessons apply beyond individual tasks and save time for future work.

**Quality Filter:** Only lessons that:
- Apply to future work in this project or similar projects
- Would save significant time if known earlier
- Represent patterns or architectural principles
- Involve multiple files or cross-system concerns

---

## 2026-07-09 - PL/pgSQL RETURNS TABLE column name shadows an identically-named table column [HIGH]

**Area:** Supabase RPC / PL/pgSQL / engine-v2 submission search
**Impact:** HIGH (silently broke the "Search submission" feature for every evaluation with indexed
chunks, undetected until exercised live against real data)

`search_submission_chunks` (`supabase/migrations/20260513_v2_submission_chunks_search_rpc.sql`)
declared `RETURNS TABLE (... evidence_item_id text ...)`. In PL/pgSQL, every column named in a
function's `RETURNS TABLE` clause is implicitly declared as a block-scoped variable for the ENTIRE
function body -- not just the final `RETURN QUERY` statement. An inner correlated subquery over
`v2_chunk_policy_citations` (which also has an `evidence_item_id` column) referenced the column
name UNQUALIFIED in its `SELECT` and `GROUP BY` clauses. Postgres could not resolve whether that
name meant the table column or the function's own output variable, and raised "column reference
\"evidence_item_id\" is ambiguous" -- a RUNTIME error, not a parse-time one, so `CREATE OR REPLACE
FUNCTION` succeeded silently and the bug was invisible until the RPC was actually called.

**Fix pattern:** whenever a PL/pgSQL function's `RETURNS TABLE` column list shares a name with a
column in a table the function body queries, qualify EVERY reference to that name inside the body
with a table alias, including inside inner subqueries -- do not rely on the outer query's own
`c.*`/`cc.*` aliasing style being "obviously" enough; each nested `SELECT`/`GROUP BY` needs its own
alias applied explicitly. See the fix:
`supabase/migrations/20260709_v2_submission_chunks_search_rpc_fix_ambiguous_evidence_item_id.sql`.

**Detection gap:** this repo has no live-Postgres test harness for RPC function bodies, so no
automated test could have caught this before it shipped. The fix's companion test
(`src/lib/engine-v2/__tests__/search_submission_chunks_rpc_migration.test.ts`) is a STATIC
text-safeguard only (asserts no unqualified reference to the shadowed name survives outside the
`RETURNS TABLE` declaration) -- it guards against regression, not the original class of bug in a
brand-new function. When authoring a NEW `RETURNS TABLE` function, manually check every column name
in that list against every table the body queries before shipping.

### File References
- Bug: `supabase/migrations/20260513_v2_submission_chunks_search_rpc.sql:97-102`
- Fix: `supabase/migrations/20260709_v2_submission_chunks_search_rpc_fix_ambiguous_evidence_item_id.sql`
- Safeguard test: `src/lib/engine-v2/__tests__/search_submission_chunks_rpc_migration.test.ts`

### Key Takeaway
A PL/pgSQL `RETURNS TABLE` column name is a live variable for the whole function body -- if any
table the body queries has a column of the same name, every reference to it in every nested
subquery must be explicitly table-aliased, or Postgres will raise an "ambiguous" error at call time
that no static analysis or `CREATE OR REPLACE FUNCTION` will catch in advance.

---

## 2026-07-08 - CI Unit Tests EPIPE/ForksPoolWorker flake: pin the job to Node 22 [MEDIUM]

**Area:** CI infra / vitest / coverage memory
**Impact:** MEDIUM (recurring non-content CI flake that blocked merges until an SOP rerun each time)

The GitHub "Unit Tests" job repeatedly flaked with `Error: write EPIPE` -> `ForksPoolWorker.send` ->
`ChildProcess.emitWorkerError` (`code: 'EPIPE'`) on #542, #543, and #546 -- each cleared by a single
rerun, so environmental/resource-related, not content. Root cause is the known Node-24 v8-coverage
memory regression: the forked coverage worker OOMs under the end-of-run remap (memory scales with
modules-covered-per-shard) and the main process loses the IPC pipe (EPIPE). The 6-sequential-shard
split (a prior STOPGAP) is no longer enough as the suite grew.

FIX: pin ONLY the Unit Tests job to Node 22 (`.github/workflows/ci.yml` setup-node 24 -> 22). The job
was the outlier -- `engines.node` is "22.x" and the Build/Perf jobs + Vercel production already run
Node 22; Node 24 was the memory-regressed runtime. Node 22 has materially more coverage headroom (it
tolerated maxWorkers=2 historically). `maxWorkers=1`, the 6 shards, and the 8GB heap were all RETAINED
(change one variable at a time). Fallback if it recurs on Node 22: escalate to 8 shards, never
maxWorkers=2. "Fixed" requires 3-5 consecutive Unit Tests runs with zero EPIPE, not one green run --
the flake was intermittent.

---

## 2026-07-06 - Re-ground stale plans against live state; verify the RIGHT output stream [HIGH]

**Area:** matrix-options / planning / verification discipline
**Impact:** HIGH (nearly re-did completed work; nearly reported a false "0 findings")

### Discovery 1 -- planning docs drift; RE-GROUND before acting on them
The 2026-07-01 HITL-decisions doc and the 2026-07-05 recency proposal both framed large lanes as
pending (add `'inorganic'` enum + wire ~37 substances; apply 20 current_defaults). Checking the LIVE
catalog showed intervening sessions had already done ~90%: `'inorganic'` was long in the union with 25
wired substances, and 18/20 current_defaults were already applied. A plan built from those docs would
have re-done finished work and asked the owner to re-decide settled questions. LESSON: before drafting
an owner packet or starting a "pending" lane, grep the CURRENT code/catalog for the end-state; a
planning doc is a point-in-time snapshot, not live status. (An Opus plan review caught this for one
lane; it generalized to all three.)

### Discovery 2 -- a "0 findings" grep can be a measurement error, not a real zero
`node audit-library-provenance.mjs | grep CROSS_SOURCE` returned 0, which looked like the extended
divergence check found nothing. In fact the CLI writes findings to a `.tmp` JSON file + stderr, and
stdout was empty -- the grep was reading the wrong stream. A direct `runAuditOnLibrary(...)` import
showed 8 findings. LESSON: when a detection tool reports "nothing," confirm HOW it emits results
(stdout vs stderr vs a file) before concluding zero; re-verify via the function's real return value.

### Bonus -- durable tooling capture
The cursor-agent codex-backup recipe (used when codex weekly quota ~99%) is documented in
`C:\Projects\TOOLING_SETUP_FOR_NEW_PROJECT.md` B.5 (single source of truth), pointed to from the
`/codex-review` skill -- not buried in memory, which truncates/recall-misses.

---

## 2026-07-04 - A "HH oral RfD" can be a mis-filed inhalation TC; HC v4.0 (2025) trumps HC 2010; add provenance guards [HIGH]

**Date:** July 4, 2026 (Discovery 1 CORRECTED 2026-07-06 -- see below; it was itself wrong)
**Area:** matrix-options / substance data provenance / QA guards
**Impact:** HIGH (data correctness; #513 believed to be a fix, later found itself to be an error)
**Status:** #512/#514 stand; #513 corrected 2026-07-06 (was based on an unverified theory); #516 closed unmerged as wrong
**Session:** MO current_default selection + provenance-guard lane

### Discovery 1 -- CORRECTED 2026-07-06: chlorobenzene's 0.43 was NEVER actually wrong; PR #513 was the error
Original (now-superseded) claim: chlorobenzene's stored HC oral RfD of 0.43 was believed to be a
mis-filed HC inhalation TC (tolerable concentration), fixed in #513 by quarantining it and defaulting
to EPA IRIS 0.02. **This was wrong.** The real HC TRV v4.0 (2025) source PDF -- which turned out to
still exist in the owner's Downloads folder (see Discovery 2 correction below) -- was read directly on
2026-07-06 (independently, twice: once via a codex holistic review with file tool-use, once via this
session's own PyMuPDF extraction of page 25) and shows TWO separate, legitimate, correctly-labeled HC
study derivations for chlorobenzene: `Oral TDI = 4.3E-01 mg/kgBW-day` (chronic rat/mouse study) and
`Inhalation TC (provisional) = 1.0E-02 mg/m3` (subchronic study) -- exactly matching what the ORIGINAL
May 2026 catalog extraction had already recorded. 0.43 was never mis-filed. #513's theory (cross-source
corroboration with EPA/BC P28 both at 0.02) was asserted without ever checking HC's own primary
document. **LESSON (corrected): a magnitude that "looks implausible" plus cross-source corroboration is
suggestive, not proof -- always verify against the primary source document directly before quarantining
a value, especially before merging a fix that changes a regulatory default.**

### Discovery 2 -- HC v4.0 (2025) supersedes HC 2010; do not quarantine a live value against a superseded source; CORRECTION 2026-07-06: the v4.0 source was never actually unobtainable
PR #516 quarantined 1,2-DCB and added an "HC-2010-Part-II cross-check" tool -- but the quarantine
was justified against the SUPERSEDED HC 2010 value. Owner: "HC v4.0 (2025) trumps 2010." The PR was
CLOSED UNMERGED. LESSON: before quarantining/flagging a value by cross-checking a secondary HC table,
confirm that table is the CURRENT edition; an older HC edition is not evidence a v4.0 value is wrong.
**Correction (2026-07-06):** the follow-on framing that the real HC TRV v4.0 (2025) document was
"order-a-copy / not web-published / unavailable" was ALSO wrong -- it was a false negative from an
incomplete search. The actual source PDF (`C:\Users\jasen\Downloads\HC 2025 - Toxicological Reference
Values TRV.pdf`) had been used to build the catalog's HC v4.0 rows back on 2026-05-29
(`pass_d0c00012_hc_trv_v4.py`, commit `9f1ef98`); its existence/role was never written into a memory or
doc, only buried in a May commit message, so this later search had no way to find it. **LESSON: before
concluding a source document is unavailable, grep the relevant extraction pass script/review note for a
hardcoded local file path -- it may already have been used to build the very data you're trying to
verify.**

### Discovery 3 -- provenance guards as reusable tests (#514)
Two guards shipped: (a) a cross-source >=10x divergence AUDIT that flags any substance whose values
disagree by an order of magnitude across sources (would have surfaced the chlorobenzene mis-file), and
(b) a library-seed == current_default CONSISTENCY test so a promoted current_default can never silently
diverge from what the library seeds. LESSON: encode "the number that made it wrong" as a standing guard,
not a one-off check -- divergence audits + seed/default consistency catch the whole bug class.

### Recency policy applied (#512)
current_default selection rule across the 18 multi-option substances + 5 library reseeds: prefer the
HC value by default, but take EPA when it is the newer/more-recent authority. Document the picked
source per key; never template pvid/source across substances (per-key exact provenance).

### Key Takeaway
Route/endpoint mis-mapping and superseded-source cross-checks are the two provenance failure modes this
lane keeps hitting; guard both with automated divergence audits + edition-aware source checks.

---

## 2026-06-24 - Multimodal vision beats text-layer for PDF tables; investigate "junk", don't discard [CRITICAL]

**Date:** June 24, 2026
**Area:** data extraction / BN-RRM enrichment / quality systems
**Impact:** CRITICAL (data integrity; nearly discarded ~2,600-3,100 real samples)
**Status:** Strategy + tooling shipped (#415); 433-doc batch handed off
**Session:** BN-RRM date/depth enrichment (sstac temporarily owns the BN-RRM lane)

### Discovery 1 -- multimodal vision >> text-layer for borderless environmental tables
Text-layer PDF extraction (Docling, pdfplumber) FRAGMENTS borderless/merged tables -- it loses the
visual grid, so depth values like `0.3`/`1.6` get misattributed as station IDs and regulatory-criteria
columns get parsed as sampling stations. Gemini 3.1 Pro multimodal (via AGY's `view_file` image
rendering) READS the table as an image, keeps station-id/date/depth correctly associated, and recovers
data the text path misses entirely (one doc: text=0 stations -> multimodal=clean dated stations).
Pipeline: PyMuPDF renders candidate pages -> Gemini vision transcribes -> gated normalized load.

### Discovery 2 -- "junk" is often recoverable; quality-gate autonomous extraction
A bulk extraction ran AUTONOMOUSLY WITH NO QUALITY GATE -> mis-parsed criteria cols as stations + a
junk filter then nearly DISCARDED ~2,600-3,100 REAL stations whose cells were MERGED
(`SEDIMENT 16-JUN-11 SED11-100A L1020263-1`). codex independently confirmed the loss. Owner: "investigate,
don't throw out the baby with the bath water." Fix = a SALVAGE layer (de-concatenation) + QUARANTINE
(never delete) + acceptance gates + golden-set regression. See
`docs/design/matrix-map/BNRRM_EXTRACTION_QUALITY_STRATEGY_2026_06_24.md` (5 systems).

### Discovery 3 -- verify subagent/AGY extraction against golden-set ground truth, NOT self-report
AGY's first parser produced garbage (chemistry values as station ids, depths of 200000cm); its salvage
"no junk" claim was false (7 lab-ids slipped through). Every AGY round was gated against an independent
ground-truth check (SITE0141 SED11-137A=2011-06-16/0-30cm) + a station-name quality audit -- which caught
each error for a few Claude tokens while AGY (unlimited tokens) did the heavy lifting.

### File References
- Strategy + 5 systems: `docs/design/matrix-map/BNRRM_EXTRACTION_QUALITY_STRATEGY_2026_06_24.md`
- Tooling: `scripts/matrix-map/{rebuild_clean_db_from_verbatim,salvage_merged_stations,mm_extract_render,mm_db_load,mm_batch_runner}.py`
- Handoff: `FRESH_SESSION_HANDOFF_2026_06_24_BNRRM_433_BATCH.md`

### Key Takeaway
For PDF table extraction prefer multimodal vision over text-layer; never auto-load extraction output
without quality gates + golden-set regression; quarantine + investigate anomalies, never silently discard;
verify autonomous-agent output against independent ground truth.

---

## 2026-06-15 - Auth gating + access-control corrections (matrix-options lane) [HIGH]

**Date:** June 15, 2026
**Area:** auth / access control / matrix-options / review process
**Impact:** HIGH (access-control posture + review discipline for security code)
**Status:** Shipped (#320, #328, #329, #330)
**Session:** MO activations + auth investigation/hardening

### 1. Never present a codex-review decision baked into a code comment as "owner-approved"
A `// Codex P1 (2026-05-20)` comment in `matrix-options/page.tsx` declared the route "public by design."
That was a codex-review decision, NOT owner approval. The intended design is that the `(dashboard)`
route group is authenticated-only. When fixing access-control anomalies, use the EXISTING gating pattern
-- the middleware `config.matcher` (`src/middleware.ts`) and/or per-page `supabase.auth.getUser()` +
`redirect('/login')` -- do NOT invent a new gating mechanism. #330 gated /matrix-options by adding
`'/matrix-options/:path*'` to the matcher (covers the page + its `/private-data-access` child). Public
routes are ONLY `/`, `/login`, `/signup`, `/cew-polls` (anonymous conference voting). An access audit
that flags middleware-gated routes (bn-rrm, twg/*, survey-results/*) as "anomalies" for lacking a
redundant per-page check is over-flagging -- the matcher already gates them.

### 2. Subagent-authored auth/security code needs the FULL Opus + codex pipeline
On #329 (auth middleware refactor) Opus Leg-1 returned GREEN but codex took 4 rounds to catch 3 real
bugs: (a) the terminal-error check was case-sensitive and missed Supabase's lowercase
`Invalid refresh token` variant; (b) `signOut()` cookie expirations were dropped on the terminal redirect
(it returned a fresh `NextResponse.redirect` instead of the setAll-mutated `response`) -- a pre-existing
stuck-logout bug; (c) the client set `authUnverified` with no prior session to preserve. Never ship
subagent-authored security code on a single green review. Files: `src/middleware.ts`
(getAll/setAll + isRetryableAuthError/isTerminalAuthError + redirectToLogin), `src/contexts/AuthContext.tsx`,
`src/components/Header.tsx`.

### 3. Promoting a record into a candidate_group_id slot can flip defaultSelectionPolicy
On #320, promoting the TWN toddler BW (16.5 kg) into the `human-health-food__generic__BW_kg__BC` slot
(already holding the adult 70.7 kg) created a top-rank TIE, flipping the slot's suppression from the
"A1 unit guard" path to "multiple top-ranked". Static review (Opus, codex) CANNOT see this -- only the
live-catalog `test:ci` caught it (`defaultSelectionPolicy.test.ts`). Expect live-catalog policy tests to
shift when promoting into an occupied slot; bump BOTH frameDefaults.test + integration.test on a new scenario.

### 4. Gating a route breaks e2e specs that navigated it anonymously
#330 broke `e2e/matrix-options.spec.ts` + `e2e/ssd-workbench.spec.ts`, which did
`page.goto('/matrix-options')` without auth (exploiting the public access). Fix: switch them to the
existing skip-if-redirected convention (`if (page.url().includes('/login')) test.skip(...)`, per
`e2e/admin-agentic-os.spec.ts`) so they run locally-with-auth and skip in CI (no shared auth fixture).

### 5. Reference-only source rows: do not stamp site-specific assumptions as source-backed
On #328 (HC 2017 sediment, Option B), HC 2017 gives only the 72 mg/hr ingestion rate + the mg/hr-times-
hours/day formula + body weights; the hours/day, AF, EF, ED are SITE-SPECIFIC per HC (not HC defaults).
Stamping them `approved_source_backed` citing HC 2017 would be a source-fidelity violation. Option B keeps
HC 2017 as a documented reference source row (currentness -> current, owner-attested) with NO
parameter_value records / scenario / promote script.

### Key Takeaway
Access control: intended design is (dashboard)=authenticated; fix anomalies with the existing matcher /
per-page pattern, never new mechanisms, and never treat a codex-in-comment decision as owner-approved.
Security code gets the full Opus+codex pipeline. Catalog promotions + route gating ripple into
live-catalog tests and e2e -- run the full gates.

---

## 2026-06-14 - Per-seed mixed-source frame-default rows: provenance is per-seed, not per-row [HIGH]

**Date:** June 14, 2026
**Area:** matrix-options / frameDefaults contract / provenance
**Impact:** HIGH (the reusable template for any frame-default row that cites different sources for different seeds)
**Status:** Shipped (#317 -- ACFN food-web receptor)
**Session:** Matrix-options ACFN receptor + M3 closeout

### Problem or Discovery

Prior to PR #317, every `FrameDefaultProfileRow` carried a single `sourceIds` array that applied
uniformly to all of its seeds. The ACFN receptor row was the first to need DIFFERENT sources per seed:
the ACFN individual fish-intake rate (IR) is sourced to WQCIU 2023, while the body-weight (BW) seed
reuses the shared BC WLRS 2023 70.7 kg record whose source is already on that catalog row.

### Solution or Pattern

PR #317 added an optional `sourceIds` field directly on each `FrameDefaultSeed` object. The
`validateFrameDefaultProfiles` function (and the UI provenance label resolver) now resolve provenance
as `seed.sourceIds ?? row.sourceIds` -- the seed-level override wins; if absent, the row-level
fallback applies. The first mixed-source row (ACFN: IR -> WQCIU 2023, BW -> WLRS 2023) is the
canonical template.

### Key Takeaway

Frame-default rows are no longer single-source. Provenance is per-seed when sources differ across
seeds in the same row. Use `seed.sourceIds ?? row.sourceIds` as the resolver pattern; document the
first mixed-source row (ACFN) as the template for future receptors that reuse shared catalog records
alongside receptor-specific evidence.

---

## 2026-06-14 - Hydrate a cloud-placeholder Zotero attachment via the publisher URL [MEDIUM]

**Date:** June 14, 2026
**Area:** Reference sourcing / Zotero / verification
**Impact:** MEDIUM (unblocks value verification when a Zotero attachment is offline or a cloud placeholder)
**Status:** Documented (used to verify the ACFN WQCIU 2023 consumption rate)
**Session:** Matrix-options ACFN receptor

### Problem or Discovery

A Zotero reference showed as a linked attachment with no locally accessible file -- a "cloud
placeholder" not present on disk. Without the actual document, the ACFN individual fish-intake
rate (388 g/day from WQCIU 2023) could not be verified against the primary source.

### Solution or Pattern

Do not treat a cloud-placeholder attachment as an unverifiable source. Instead, hydrate the document
by fetching its publisher or canonical URL directly (obtained from the Zotero item metadata: `url`,
`DOI`, or the `attachment.url` field). Fetch it with a browser User-Agent where needed, read the
relevant section, and verify the value against the primary text. This was used successfully to verify
the ACFN 388 g/day consumption rate against the WQCIU 2023 document before promotion.

### Key Takeaway

A cloud-placeholder Zotero attachment is not an unverifiable source -- it has a publisher URL in its
metadata. Fetch the publisher URL directly, verify the value in the primary text, and treat the
verified value as source-confirmed. Only escalate to HITL if the document is genuinely inaccessible
after the URL fetch.

---

## 2026-06-14 - `codex review -` under-emits a verdict on a non-diff .md; use the diff gate [HIGH]

**Date:** June 14, 2026
**Area:** tooling / codex-review / gates
**Impact:** HIGH (saves a wasted long-running review loop when reviewing plan/design docs)
**Status:** Documented (#317 plan review session)
**Session:** Matrix-options M3 closeout

### Problem or Discovery

Pointing `codex review -` at a plan or design .md that is NOT in the git diff tends to (i) not emit
an explicit `VERDICT:` line at the tail of its output, and (ii) run away on exhaustive tool-use --
a ~50-minute run was observed because the checkout was behind origin and codex ran `git show` on
every referenced commit to satisfy itself. The CLI is diff-oriented; piping a non-diff artifact
through stdin bypasses its native diff-parsing path and it has no built-in depth bound.

### Solution or Pattern

The binding codex gate must be the per-commit DIFF review (`codex review --uncommitted` or
`--commit`). This reads the diff natively, stays bounded, and emits a clean `VERDICT:` line. For a
non-diff artifact (a plan, design doc, or spec), bound the prompt hard: name the exact files to
read, set an explicit time budget, and treat the result as advisory -- not a gate-quality verdict.
The codex MCP session (`mcp__codex__codex`) is an alternative for non-diff reviews: it operates
in read-only sandbox mode with the repo as cwd and returns its conclusion as the tool result (a
capturable verdict). See the 2026-06-13 lesson on codex MCP session vs CLI for non-diff artifacts.

### Key Takeaway

`codex review -` is diff-oriented. On a non-diff .md it may not emit `VERDICT:` and may run
unboundedly via `git show` tool-use. The gate must be the diff review. For advisory non-diff
reviews, bound the prompt hard or use the codex MCP session.

---

## 2026-06-14 - The promote-script nested-source-guard class (PR #318): distinguish co-located guards [HIGH]

**Date:** June 14, 2026
**Area:** matrix-options / promote scripts / defensive programming
**Impact:** HIGH (avoids a near-no-op backport; generalizes a guard correctly before shipping it to 8 scripts)
**Status:** Shipped (#318 -- generic nested-source provenance guard across all 8 owner-run promote scripts)
**Session:** Matrix-options M3 closeout

### Problem or Discovery

After PR #317 shipped the ACFN receptor, the plan called for backporting the "#317 guard" to the
other 8 promote scripts. The #317 guard checked that every `evidence_items[*].source_id` and
`source_relationships[*].source_id` in the row being promoted matched the ACFN script's expected
source_id (`src-acfn-wqciu-2023`, the value of `ACFN_FOODWEB_PROMOTION_SOURCE_ID` -- a `source_id`,
not the `parameter_value_id`). Literally backporting that guard to scripts whose rows have a
DIFFERENT source shape -- a single module-level `_SOURCE_ID`, no per-seed mixed sources -- would
have been a near-no-op: the ACFN-specific check would never fire against those rows.

### Solution or Pattern

Before backporting, verify WHAT the guard generalizes to in the target context. The correct
generalization for single-source scripts is: every nested reference in the row (in
`evidence_items`, `source_relationships`, or analogous nested arrays) must resolve to the
script's own module-level `_SOURCE_ID`. This is a generic anti-copy-paste-drift check (ensures
a row pasted from a different script does not carry a foreign source reference) that has real
defensive value for all 8 scripts. PR #318 shipped this generalized form. The ACFN per-seed
mixed-source guard and the #318 single-source nested-ref guard are DISTINCT, co-located guards
that look similar but protect against different failure modes.

### Key Takeaway

Before backporting a guard, ask: what does this guard generalize to in the target context? Two
co-located guards that look similar (both check `source_id` on nested objects) can protect against
entirely different failure modes. Distinguish them, then write the target-context form rather than
copy-pasting the source-context literal.

---

## 2026-06-13 - Correcting a published regulatory value: HITL-attested, evidence-backed, note-superseding [HIGH]

**Date:** June 13, 2026
**Area:** matrix-options / reference catalog / data integrity
**Impact:** HIGH (the discipline for ever changing a primary-source-as-printed value)
**Status:** Shipped (#313 -- HC PQRA v4.0 worker SA 1640 -> 16640)
**Session:** Matrix-options worker receptor

### Problem or Discovery
The HC PQRA v4.0 Appendix E table prints "1 640" cm2 for the construction/utility worker total-body
skin surface area. That value is physically impossible: the worker shares the adult 70.7 kg body, whose
own Appendix E regional rows (hands ~890 + arms ~2500 + legs ~5720) already total ~9110 cm2 -- a total
body cannot be smaller than three of its own regions. It is an apparent typesetting error for 16,640
(which sits just below the adult 17,640). A prior PR (#302) had rationalized 1,640 as an intentional
PPE/limited-skin value -- an over-interpretation not grounded in Appendix E.

### Solution or Pattern
Overriding a primary-source-as-printed Government-of-Canada figure is a HITL data-integrity decision,
not an AI one. The discipline that shipped it:
- AI FINDS + VERIFIES first: searched Zotero (localhost), G:\References, and the web for an HC erratum or
  the Richardson (1997) primary; none accessible -> the correction rests on a physical/internal-
  consistency inference, which AI SURFACES but does not act on unilaterally.
- HITL ATTESTS inline: the owner's explicit "correct to 16640" is the attestation (per
  feedback_inline_approval_is_the_attestation). A re-confirm immediately before the edit is the gate.
- The record note must EXPLICITLY SUPERSEDE the prior interpretation (not silently overwrite it), label
  any derived figure (the 9110 sum) as domain reasoning rather than a catalog-sourced value, and update
  EVERY field carrying the number (value, value_text, applicability, uncertainty, review_notes) so the
  record is not internally contradictory (codex caught the value_text omission).
- The promote script's identity check expects the CORRECTED value, so the value edit must precede promotion.

### Key Takeaway
Never let AI flip a published regulatory figure on its own judgment. AI surfaces the impossibility with
evidence and verifies the alternative is not findable; the HITL attests; the record note documents the
override AND supersedes the prior reading; update every field that carries the value.

---

## 2026-06-13 - codex review of a NON-diff artifact: use the codex MCP session, not the `codex review` CLI [MEDIUM]

**Date:** June 13, 2026
**Area:** tooling / codex-review / gates
**Impact:** MEDIUM (saves a wasted review loop when reviewing plans/design docs)
**Status:** Observed (#313 plan + diff reviews)
**Session:** Matrix-options worker receptor

### Problem or Discovery
`codex review -` (the shimmed CLI) reviewing a NON-diff target -- a plan/design .md not in the git diff --
streams the file/context it reads to stdout but does NOT land a capturable VERDICT line at the tail
(exit 0, no backend error, but the synthesized verdict never appears in the piped capture). Three CLI
attempts on a plan, plus one on a clean staged diff, all hit this; cursor-agent was out of usage.

### Solution or Pattern
Use the codex MCP session (mcp__codex__codex) for the gate verdict: sandbox read-only + cwd = repo so it
inspects the diff/files itself (e.g. `git diff --cached`) and RETURNS its final message as the tool
result -- a clean, captured VERDICT every time. Embed the already-verified facts (from the Leg-1 Opus
pass) so the one-shot MCP review is grounded. Continue the same thread (mcp__codex__codex-reply) for
adversarial argue-back rounds to mutual agreement.

### Key Takeaway
The `codex review` CLI is diff-oriented and its stdout capture is unreliable for non-diff artifacts (and
even some clean diffs) in this environment. For a captured, gate-quality codex verdict, prefer the codex
MCP session (read-only, repo cwd, facts embedded); it returns the verdict as the tool result.

---

## 2026-06-13 - Multi-receptor scenario contract: backward-compatible + fail-closed [HIGH]

**Date:** June 13, 2026
**Area:** matrix-options / frameDefaults contract / calculator seeding
**Impact:** HIGH (the reusable mechanism for adding receptor/age/land-use variants to a calculator)
**Status:** Shipped (#308 adult; the contract)
**Session:** Matrix-options Phase D receptor scenarios

### Problem or Discovery
A calculator frame default (`FRAME_DEFAULT_PROFILES`) was one row per `(frameId, pathway)`. Real
HHRAs need MULTIPLE receptors (toddler, adult, worker) sharing a frame -- a second dimension.

### Solution or Pattern
Add an OPTIONAL scenario dimension to `FrameDefaultProfileRow` so existing single-profile rows
(and all existing callers) are unchanged:
- `receptorScenarioId?` + `scenarioLabel?` + `isDefaultScenario?`. No-scenario lookup returns the
  sole row, else the `isDefaultScenario` one -> every existing caller keeps its behavior.
- `getSelectableFrameScenarios` is a COMPLETENESS GATE: a scenario is offered ONLY if EVERY one of
  its seeds resolves `active`. An incomplete scenario (e.g. before its records are promoted, or if a
  seed is later superseded) is structurally unreachable -> never a HYBRID calc (some seeds
  source-backed, some falling back to baselines).
- `getActiveScenarioFrameDefaults` is the calculator's FAIL-CLOSED resolver: a named-scenario frame
  with no selected/selectable scenario seeds NOTHING (baselines), never a partial-active default.
- `validateFrameDefaultProfiles`: a multi-profile `(frameId,pathway)` group must be all-named with
  EXACTLY ONE `isDefaultScenario`. Fails closed.

### Key Takeaway
Add a new dimension to a curated contract as OPTIONAL fields + a "no-dimension" default path, and gate
selection on COMPLETENESS so a half-built variant can never partially drive a calculation. codex caught
both the hybrid-calc risk (design holistic) and a residual fail-closed gap (impl targeted) -- the gate
must hold at BOTH the selector and the resolver.

---

## 2026-06-13 - Frame-independent provider: a property orthogonal to the keyed dimension [MEDIUM]

**Date:** June 13, 2026
**Area:** matrix-options / frameDefaults / calculator UX
**Impact:** MEDIUM (when a default belongs to a different axis than the table is keyed on)
**Status:** Shipped (#309)
**Session:** Matrix-options receptor selector (owner feedback: "can't change age")

### Problem or Discovery
The receptor/age selector only showed under the one frame that stored the HC PQRA profiles
(`canada-fcsap-aquatic`), but the calculator defaults to BC Protocol 1 -- so users never saw it. The
receptor's exposure factors (BW/IR/SA/...) are a property of the RECEPTOR, not the regulatory FRAME.

### Solution or Pattern
Introduce a PROVIDER indirection: `RECEPTOR_SCENARIO_PROVIDER_FRAME[pathway]` + `getReceptorScenarioFrame
(frameId, pathway)` -> the selected frame if it has its OWN scenarios, else the pathway's provider
frame. The calculator resolves the selector + seeds under the PROVIDER (so they appear under EVERY
frame), while `jurisdiction` still drives the equation, the frame notices, and the provenance frame.
Resolving under the provider is also REQUIRED for eligibility (the HC PQRA records are jurisdiction
`general`, eligible under the provider frame; resolving under a frame that does not list `general`
would block them).

### Key Takeaway
When a default is orthogonal to the dimension your table is keyed on, do not duplicate it across keys
or change the default key -- add a provider indirection so the orthogonal property is resolved from its
source-of-record regardless of the key, and keep the key governing only what it actually owns.

---

## 2026-06-13 - Regulatory values: dual-verify, then BANK (do not flip) a source-vs-reality conflict [HIGH]

**Date:** June 13, 2026
**Area:** Catalog data integrity / HITL boundary / verification
**Impact:** HIGH (prevents silently overriding a published regulatory figure)
**Status:** Documented (worker-SA banked for owner)
**Session:** Worker receptor verification

### Problem or Discovery
Verifying the HC PQRA v4.0 worker total-body skin surface area: the PRIMARY PDF literally prints
"1 640", but that is internally impossible (the worker is a 70.7 kg adult; its own hands+arms+legs sum
to 9110 > 1640; total body must be the largest figure). It is almost certainly an HC typesetting error
for 16,640 -- but that is physical INFERENCE, with no erratum to cite.

### Solution or Pattern
- DUAL-VERIFY regulatory values: a subagent reads the PRIMARY source + codex independently confirms;
  when both are clean, the value is confirmed and AI proceeds (owner delegated value-finding).
- But when the primary-AS-PRINTED contradicts physical reality, OVERRIDING a published figure (1640 ->
  16640) is a HITL call, not an AI one -- even when the correct value is "obvious." BANK it with the
  evidence (a dedicated BANKED_HITL doc), do NOT flip it autonomously, and pivot to other work. Do not
  block the whole session on it either.

### Key Takeaway
"AI finds + verifies values" has a ceiling: a value that fails verification because the SOURCE ITSELF
is wrong is a judgment call the human owns. Verify rigorously, surface the evidence, bank the decision.

---

## 2026-06-13 - PDF table extraction mangles spaced-thousands; cross-check against internal consistency [MEDIUM]

**Date:** June 13, 2026
**Area:** Source extraction / verification tooling
**Impact:** MEDIUM (avoids trusting a mis-extracted tabular number)
**Status:** Documented
**Session:** Worker receptor verification

### Problem or Discovery
HC PQRA tables use a SPACE thousands-separator ("17 640", "10 140"). pypdf text extraction can split or
drop a leading group, so a cell can read "1 640" (whether that is the true source content or an artifact
is itself ambiguous). Trusting the raw extracted number alone is unsafe. Also: pypdf parsing of large
gov PDFs can segfault a python.exe (native fault) -- avoid python-heavy subagents when avoidable.

### Solution or Pattern
Cross-check any extracted tabular figure against INTERNAL CONSISTENCY before trusting it: a total must
exceed the sum of its own parts; a column should be the expected magnitude vs adjacent columns (worker
total-body SA ~ adult 17,640, not 1/10 of it). Use layout-mode extraction to confirm column alignment.
Fetch GoC archived PDFs from publications.gc.ca with a browser User-Agent + a gc.ca referer; read to
TEMP and delete (never commit the PDF).

### Key Takeaway
A tabular number from PDF text extraction is a hypothesis, not a fact -- validate it against the table's
own arithmetic/magnitude relationships before recording or promoting it.

---

## 2026-06-12 - CI v8-coverage OOM is STRUCTURAL: shard, do not raise the heap [CRITICAL]

**Date:** June 12, 2026
**Area:** CI / Node runtime / vitest / coverage
**Impact:** CRITICAL (intermittently blocks the CI Unit Tests job with write EPIPE; survives heap bumps)
**Status:** Fixed (#306)
**Session:** Matrix-options Phase D direct-contact closeout (#300-#306)

### Problem or Discovery

After the 2026-06-10 heap bump to `--max-old-space-size=8192`, the Unit Tests job STILL
intermittently OOM-killed with `write EPIPE` near the END of the run as the suite + reference
catalog kept growing across #294-#305. Raising the heap had only bought time, not a fix.

### Root Cause or Context

`maxWorkers=1` runs ALL test files in ONE process. v8 coverage accumulates an END-OF-RUN remap
spike proportional to the TOTAL number of modules loaded -- this is NOT a per-file leak (with
`isolate:true` each file's memory is reclaimed; the spike is the final whole-run remap). The 8 GB
heap and `maxWorkers=1` were both ceiling-raises against a RISING floor (suite + catalog grow every
PR), so each was eventually re-crossed. It presents as intermittent because v8 GC timing varies run
to run.

### Solution or Pattern

#306 runs vitest in 4 SEQUENTIAL shards -- a FRESH node process per shard
(`npm run test:ci -- --shard=$i/4 --coverage.reportsDirectory=coverage/shard-$i`), so each process
retains ~1/4 of the modules and frees it on exit. Key constraints:
- MUST stay ONE "Unit Tests" job. Branch protection requires that check BY NAME; a CI matrix would
  rename the check and block every PR until the owner edits branch protection.
- Coverage = per-shard `coverage/shard-N/coverage-final.json` -> ONE multi-file Codecov upload.
  Do NOT use `blob` + `--merge-reports` (that yields EMPTY coverage in vitest 4).
- `NODE_OPTIONS=--max-old-space-size=8192` is RETAINED per shard (belt-and-suspenders), but the
  sharding is what actually bounds retention.
- Shard-by-FILE is imbalanced (shard 4 took ~19 of ~24 min) -- a future balance/tuning item, not
  required for correctness.

### File References
- `.github/workflows/ci.yml` -- the sharded Unit Tests job (4x `--shard=$i/4`, per-shard coverage dir,
  single Codecov upload of the 4 files).
- `vitest.config.ts` -- `maxWorkers: 1` (CI path).

### Key Takeaway

A `maxWorkers=1` coverage run OOMs on TOTAL-module retention, not a leak; raising the heap chases a
rising floor. Shard into fresh processes to bound retention, and keep the single "Unit Tests" check
name. A RED unit job with `write EPIPE` and no test summary is this OOM near the ceiling, not a code
failure -> `gh run rerun <id> --failed`.

---

## 2026-06-12 - ff-pull collision: use plain `git restore`, not `--source=origin/main` [HIGH]

**Date:** June 12, 2026
**Area:** git / working-tree hygiene / parallel sessions
**Impact:** HIGH (a wrong restore leaves the primary checkout permanently unable to ff-pull)
**Status:** Documented (codex/Opus sandbox-proved the mechanics)
**Session:** Matrix-options Phase D closeout (#303)

### Problem or Discovery

The primary checkout could not fast-forward `git pull` because tracked docs were dirty locally AND
the incoming origin/main commits had changed those same files. There was also net-new local work in
those files that must not be lost.

### Root Cause or Context

`git restore --source=origin/main -- <files>` writes the origin/main version into the WORKING TREE
but does not touch HEAD/index, so the files end up dirty-vs-HEAD again -- and the ff-pull STILL
aborts. It feels like it should clean the collision, but it just swaps which version is "dirty."

### Solution or Pattern

1. Preserve net-new local work by RE-AUTHORING it in a worktree + gated PR (NOT `git stash`/`pop` on
   a shared main -- a parallel session may be mid-edit there).
2. Confirm nothing is staged: `git diff --cached --quiet`.
3. Discard the now-redundant dirty tracked files with PLAIN `git restore -- <files>` (restores from
   HEAD/index -> clean vs HEAD).
4. `git pull` now fast-forwards.
READ THE WHOLE DIFF before discarding -- this collision hid 4 stranded lessons, not 1.

### Key Takeaway

Plain `git restore -- <f>` restores from HEAD/index (clean vs HEAD, ff-pull proceeds);
`--source=origin/main` does NOT (still dirty vs HEAD). Re-author net-new work through a PR; never
stash/pop on a shared main.

---

## 2026-06-12 - Never batch-remove git worktrees (node_modules junction trap) [HIGH]

**Date:** June 12, 2026
**Area:** git worktrees / Windows junctions / process hygiene
**Impact:** HIGH (empties the SHARED node_modules store; every other worktree + the primary lose deps)
**Status:** Documented (recovered via `npm ci`)
**Session:** Matrix-options Phase D closeout

### Problem or Discovery

`git worktree remove` run WITHOUT first deleting the worktree's `node_modules` JUNCTION causes git to
FOLLOW the junction and EMPTY the shared store. This recurred during a batch cleanup -- even
immediately after a sibling worktree had been removed safely.

### Root Cause or Context

A recursive delete (`git worktree remove`, `Remove-Item -Recurse`, `rm -rf`) that encounters a
directory junction follows it and deletes the TARGET's contents. The shared `node_modules` is a
single store that every worktree junctions to; emptying it breaks them all.

### Solution or Pattern

EVERY worktree removal must, on its OWN:
1. Delete that worktree's `node_modules` junction FIRST (PowerShell `Remove-Item` the junction link,
   or `fsutil reparsepoint delete`).
2. VERIFY the junction is gone AND the shared target dir count is unchanged.
3. THEN `git worktree remove` + `git worktree prune`.
Do NOT batch-remove worktrees -- the junction-delete-first step is per-worktree and cannot be
amortized across a batch. Recovery if the store is emptied: `npm ci` in the primary checkout. (L0 1.15.)

### Key Takeaway

A recursive delete that hits a junction follows it. Junction-delete-first is per-worktree, never
shared across a batch removal.

---

## 2026-06-12 - Fetching GoC-archived PDFs: bypass the publications.gc.ca interstitial [MEDIUM]

**Date:** June 12, 2026
**Area:** Reference sourcing / government PDFs
**Impact:** MEDIUM (reusable for any Health Canada / GoC archived-doc retrieval)
**Status:** Documented
**Session:** Matrix-options Phase D HC PQRA v4.0 sourcing

### Problem or Discovery

canada.ca 403s an automated fetch of the HC PQRA v4.0 guidance, and the publications.gc.ca copy
returns the "Information Archived on the Web" interstitial to bare automated requests, so neither
yields the PDF directly.

### Solution or Pattern

Fetch the publications.gc.ca DIRECT PDF with a browser `User-Agent` plus an
`-e https://publications.gc.ca/` referer to bypass the archival interstitial. PQRA v4.0 =
`publications.gc.ca/collections/collection_2024/sc-hc/H129-114-2023-eng.pdf` (Cat. H129-114/2023E-PDF).
Do NOT copy source PDFs into the repo (L0 1.14) -- fetch to TEMP, read, delete; the repo stores
locators + structured data only.

### Key Takeaway

GoC archived docs need a browser User-Agent + a gc.ca referer; canada.ca 403s automated fetches.
Keep the PDFs out of the repo -- locator + extracted data only.

---

## 2026-06-11 - Never run the monitored build and e2e concurrently in one worktree [CRITICAL]

**Date:** June 11, 2026
**Area:** Testing / Gate execution
**Impact:** CRITICAL (false-RED build gate; wastes a ~3-5 min build + can mask a real green)
**Status:** Documented
**Session:** Matrix-options C-nonBC (PR #294/#295)

### Problem or Discovery

Launching `npm run build:monitored:clean` and `npm run test:e2e` at the same time in the SAME
worktree made the build die almost immediately with:

```
unhandledRejection [Error [PageNotFoundError]: Cannot find module for page: /_document]
```

and the monitored-build wrapper reported `root_alive=False` at the very first tick (`exit=1`). A clean
re-run of the build ALONE was GREEN. The e2e run itself passed.

### Root Cause or Context

Playwright's config starts its own Next webServer, and `build:monitored:clean` first wipes and rebuilds
`.next`. Run concurrently in one worktree they collide on `.next` (and the dev-server port): the e2e
server is reading/writing `.next` while the clean build deletes + regenerates it, so the build's
"Collecting page data" step cannot resolve `/_document`. The Supabase Edge-Runtime `process.versions`
warnings in the same log are PRE-EXISTING noise, not the failure.

### Solution or Pattern

SERIALIZE the gates: run the monitored build to completion, THEN run e2e (or vice versa). Do not fan
them out as parallel background tasks against the same worktree. (Different worktrees that share the
node_modules junction are fine because each has its own `.next`.)

### File References

- Gate sequence authority: `C:/Projects/SSTAC-Dashboard/docs/GATE_MODE_SOP.md`
- Build wrapper: `C:/Projects/SSTAC-Dashboard/scripts/verify/monitored-build.ps1`

### Key Takeaway

`.next` is a single shared build dir per worktree; the monitored build and Playwright's webServer both
own it, so they must run one-at-a-time within a worktree. A `/_document` PageNotFoundError +
`root_alive=False` on first tick is the signature of this collision, not a code defect.

---

## 2026-06-11 - A pending_owner_export catalog source means the primary may not be filed yet [MEDIUM]

**Date:** June 11, 2026
**Area:** Reference-catalog provenance / source location
**Impact:** MEDIUM (avoids a stalled promotion + avoids asking the owner to "remember" a source)
**Status:** Documented
**Session:** Matrix-options C-nonBC (PR #294)

### Problem or Discovery

A catalog source row whose `zotero_status` is `pending_owner_export` with `url: null` was authored by a
prior session as a SECONDARY citation -- the canonical value was recorded from knowledge, but the
PRIMARY document was never filed in Zotero or the reference library. The owner's promotion `--apply`
correctly fails closed (provenance guard) until a durable locator is supplied.

### Solution or Pattern

When a source is `pending_owner_export` / url=null, the AI should LOCATE the primary itself rather than
ask the owner to recall it:
1. Query the Zotero local API (`http://localhost:23119/api/users/0/items?q=...`).
2. Search the reference library on disk (`G:\My Drive\SABCS - Sediment Project\References`).
3. If not filed, WebSearch the document NUMBER/title (restrict to the publisher domain) and verify the
   URL resolves (`curl -sIL` -> HTTP 200, `Content-Type: application/pdf`).

EPA-822-B-00-004 ("Methodology for Deriving Ambient Water Quality Criteria for the Protection of Human
Health, 2000") was found at epa.gov this way and HTTP-verified, then the owner re-ran `--apply` with it.

### Key Takeaway

`pending_owner_export` is a signal that the primary PDF is probably NOT in the library yet -- search
Zotero + the Drive References folder, then WebSearch the doc number; do not block on owner recall.

## 2026-06-10 - Node-24 CI vitest v8-coverage worker OOM: heap bump required [CRITICAL]

**Date:** June 10, 2026
**Area:** CI / Node runtime / vitest
**Impact:** CRITICAL (blocks CI Unit Tests job with write EPIPE crashes; not reproducible locally)
**Status:** Fixed (#291, owner-authorized). SUPERSEDED by the 2026-06-12 "CI v8-coverage OOM is
STRUCTURAL: shard, do not raise the heap [CRITICAL]" lesson above -- the heap bump was a ceiling-raise
that the growing suite re-crossed; #306 shards into fresh processes as the durable fix. Retained as
the audit trail of why heap-bump-alone was insufficient.

### Problem or Discovery

On Node 24 CI, the vitest v8-coverage worker OOM-kills with `write EPIPE` errors even with
`maxWorkers=1` already set in vitest.config. The default V8 heap ceiling (~1.4 GB) is too low
for the full serial coverage run once the test suite is large enough. PRs #285-289 passed by
luck (suite size below the ceiling); #290 hit it twice.

### Root Cause or Context

v8 coverage instrumentation multiplies per-module heap use. With maxWorkers=1 the suite runs
serially (reducing peak parallelism) but each worker still operates at the full V8 default heap.
Local `npm run test:ci` did NOT reproduce in the 2026-06-10 environment because local Node was
not Node 24; local-GREEN does not guarantee CI-GREEN after the heap ceiling is hit. (Check
`node --version` first: if your LOCAL Node is also 24, local test:ci CAN reproduce the OOM, and
local-GREEN is then meaningful evidence -- do not blanket-dismiss local reproduction.)

### Solution or Pattern

Add `NODE_OPTIONS=--max-old-space-size=8192` to the Unit Tests `test:ci` step in
`.github/workflows/ci.yml`. This was the only safe fix; reducing coverage scope would hide real
failures.

> SUPERSEDED 2026-06-12: the heap bump alone did NOT durably fix this -- the growing suite re-crossed
> the raised ceiling. Do NOT re-apply heap-bump-alone. The durable fix (#306) is to SHARD the Unit
> Tests job into 4 sequential fresh-process runs; the heap option is retained per shard but the
> sharding is what bounds retention. See the 2026-06-12 structural-OOM lesson above.

CONSEQUENCE: the Unit Tests CI job now takes ~30 min (suite completes serially to completion
instead of crashing at ~17 min). This is EXPECTED, not a hang. Pace PR merges ~one per ~30-min
CI cycle while the suite is this large.

### File References
- `.github/workflows/ci.yml` -- Unit Tests job step: `NODE_OPTIONS=--max-old-space-size=8192`
- `vitest.config.ts` -- `maxWorkers: 1` (CI path; necessary but not sufficient alone)

### Key Takeaway
On Node 24 CI with v8 coverage, `maxWorkers=1` alone is not enough once the suite hits the
default heap ceiling. Add `NODE_OPTIONS=--max-old-space-size=8192` and expect ~30-min CI runs.
Local test:ci will NOT reproduce the OOM -- do not use local-GREEN as proof.

---

## 2026-06-10 - C-BC frame-default SEED pattern: exact pv-id attribution + render-phase reseed [HIGH]

**Date:** June 10, 2026
**Area:** Matrix Options / frame-default architecture / React
**Impact:** HIGH (reusable for every future C-* frame; avoids stale-frame flash + mis-citation)
**Status:** Implemented + dogfood-confirmed (#286)

### Problem or Discovery

Frame defaults that seed user-editable inputs need to: (1) attribute by exact parameter_value_id
so the panel never mis-cites a value to the wrong source, (2) run during render
(adjust-state-on-prop-change) not in a post-render effect, and (3) use per-frame labels not
hardcoded text.

### Root Cause or Context

Three failure modes if the pattern is done incorrectly:
1. Seeding by substance/pathway/input lookup is ambiguous when multiple catalog rows share those
   keys; exact `parameter_value_id` removes ambiguity and provides a direct audit trail.
2. Seeding in a `useEffect` fires AFTER render, causing a one-render stale-frame flash visible to
   the user (old frame's seed briefly shows for the new frame).
3. Hardcoding a label string (e.g. "(BC WLRS 2023, recreational)") in the component means a
   second frame (US EPA) would show the wrong source text. codex caught this as a P2 on the
   C-nonBC prep review -- it must be fixed before shipping a second frame default.

### Solution or Pattern

`frameDefaults.ts` SEED layer: keyed rows with `{ frameId, calc, parameterValueId, value,
label }`. The panel calls `setState` during render (prop-change guard) using the active frame's
row. `getEquation` never invokes the seed layer. `label` is derived per-frame from the cited
source's `short_citation`, not hardcoded.

### File References
- `src/lib/matrix-options/frameDefaults.ts` -- seed layer (the FRAME_DEFAULT_PROFILES
  table + getActiveFrameDefaults helper). (Corrected 2026-06-12: the module is under `src/lib/`,
  not `src/components/`.)
- `src/components/matrix-options/HHFoodWebCalculator.tsx` -- the frame-default label render (search
  the `hh-food-...-frame-default-label` data-testid; ~lines 466-482 as of #302, not ~414) -- derive
  per-frame before adding any second frame default.
- C-nonBC prep spec: `docs/MATRIX_OPTIONS_C_NONBC_PREP_2026_06_10.md`

### Key Takeaway
Frame-default seeds: exact pv-id, per-frame label, adjust-state-on-prop-change (not useEffect).
All three must hold before shipping a second frame's default.

---

## 2026-06-10 - gh API 401 mid-session = token propagation lag, not auth failure [LOW]

**Date:** June 10, 2026
**Area:** gh CLI / GitHub API
**Impact:** LOW (causes unnecessary re-auth loops if misdiagnosed)
**Status:** Documented

### Problem or Discovery

`gh api` returned 401 mid-session during normal PR workflow (not at session start). The token
was valid; the issue was propagation lag after a recent auth refresh.

### Solution or Pattern

Probe with `gh api user` and wait ~30 s before concluding auth is broken. Do not re-auth-loop
or switch tokens. A fresh probe returning 200 confirms the token is fine.

### Key Takeaway
gh API 401 mid-session is usually propagation lag. Probe `gh api user` once and retry; do not
trigger a re-auth flow on a single 401.

---

## 2026-06-09 - Multi-source reference research: Zotero/Drive/WebFetch + process-hygiene pitfalls [MEDIUM]

**Date:** June 9, 2026
**Area:** Research tooling / Subagents / Process hygiene
**Impact:** MEDIUM (reusable for any reference-sourcing or library-inventory work; avoids token + zombie-process waste)
**Status:** Documented

### Discoveries (reusable patterns + pitfalls)
1. **Zotero LOCAL API** (no key, desktop app must be open): `http://localhost:23119/api/users/0/items` with `?q=<enc>&qmode=everything&format=json`; `/<key>/children` for attachments. Call it with `curl.exe` and a PRE-BUILT URL string -- PowerShell `Invoke-RestMethod` mis-parsed the hostname, and inline backtick-escaping of `&` produced a malformed URL (curl exit 3). Imported attachments live at `<Zotero data dir>\storage\<key>\<filename>` with a `.zotero-ft-cache` (grep-able fulltext) alongside.
2. **WebFetch can't parse binary gov PDFs**, but it SAVES the file locally (under the session `tool-results\` dir) and returns the path -- then use the Read tool for proper PDF rendering. Good for gov.bc.ca / canada.ca PDFs.
3. **Subagent 1M-context tier needs `/usage-credits`.** A large-folder inventory agent died immediately with "Usage credits required for 1M context" (145 tokens, 6 tool-uses). Re-launch on the INHERITED standard-context model with filename-first + capped PDF reads, or enable credits.
4. **Do NOT use `until <grep>; do sleep N; done` wait-loops in the Bash tool.** If they poll for a string that never appears (e.g. a literal `VERDICT:` that codex did not print), they background-zombie and `sleep` forever. 8 accumulated this session; killed by CommandLine match (`bash|sleep` + `until|do sleep`). Rely on background-task completion notifications instead.

### File / artifact references
- Reference-library inventory + HH-food consumption-rate sourcing: `matrix_research/reference_catalog/reference_library_inventory_2026_06_09.md` + `matrix_research/reference_catalog/library_inventory_2026_06_09/` (per-folder manifests).
- Zotero scripts: `scripts/matrix-options/zotero-api-smoke.mjs` (read, web API+key), `scripts/matrix-options/zotero-write-queue.mjs` (write, web API+key, metadata-only, dry-run + dedup).

### Key Takeaway
For reference research: curl.exe (pre-built URL) for the Zotero local API; WebFetch to capture binary PDFs to disk then Read them; standard-context subagents for big-folder inventory; never `until/sleep` wait-loops -- use completion notifications.

---

## 2026-01-26 - Advanced Lazy Loading with Suspense for Performance Optimization [HIGH]

**Date:** January 26, 2026
**Area:** Performance Optimization / Component Architecture
**Impact:** HIGH (100-250ms performance improvement across Core Web Vitals, reusable for all future React component optimization)
**Status:** Implemented & Validated
**Session:** Phase 4: Performance Optimization - Lazy Loading Implementation

### Problem or Discovery

React applications can suffer significant performance degradation when:
1. All components load synchronously on initial page render
2. Heavy components (charts, wordclouds, modals) load upfront even if user never accesses them
3. Time to Interactive (TTI) increases as main thread is blocked by non-critical rendering

**Observed Impact Before Lazy Loading:**
- LCP: 2.5-3s (too slow)
- INP: 150-200ms (sluggish interactions)
- TTI: Delayed by 200-300ms due to chart/wordcloud rendering

**Problem Pattern Identified:**
- `QRCodeModal` was imported statically even when `qrCodeExpanded={false}`
- Chart components (`InteractivePieChart`, `InteractiveBarChart`) loaded for all tabs, not just active tab
- Custom wordcloud component re-rendered for every poll result change

### Root Cause or Context

JavaScript bundlers (webpack/Next.js) by default include all statically imported components in the initial bundle. This means:

1. **Static Import Problem:**
   ```typescript
   // BEFORE: Forces QRCodeModal into main chunk
   import QRCodeModal from './QRCodeModal';

   // Component still imports even if qrCodeExpanded={false}
   {qrCodeExpanded && <QRCodeModal />}  // Only renders conditionally, but already in bundle!
   ```

2. **Tab-Based Loading Problem:**
   - Three tabs (Demographics, Effectiveness, Solutions) each have separate chart components
   - All chart libraries (recharts, custom rendering) loaded for all three tabs
   - Only one tab active at a time → 67% of chart code wasted on initial page load

3. **Suspense Boundary Necessity:**
   - Lazy-loaded components split into separate chunks
   - Need Suspense boundary to show loading fallback during chunk load
   - Test expectations must account for async loading behavior

### Solution or Pattern

**Three-Step Lazy Loading Implementation:**

**Step 1: Replace Static Imports with React.lazy()**
```typescript
// BEFORE
import QRCodeModal from './QRCodeModal';

// AFTER
const QRCodeModal = lazy(() => import('./QRCodeModal'));
```

**Step 2: Wrap with Suspense Boundary**
```typescript
{qrCodeExpanded && (
  <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="text-white">Loading QR Code...</div>
  </div>}>
    <QRCodeModal isOpen={qrCodeExpanded} onClose={...} />
  </Suspense>
)}
```

**Step 3: Update Tests for Async Behavior**
```typescript
// BEFORE: Expects synchronous DOM
expect(screen.getByTestId('qr-code-modal')).toBeInTheDocument();

// AFTER: Accounts for Suspense fallback during load
const loadingText = screen.queryByText('Loading QR Code...');
expect(loadingText || screen.queryByTestId('qr-code-modal')).toBeInTheDocument();
```

**Application Pattern for Tab-Based Components:**
```typescript
const InteractivePieChart = lazy(() => import('@/components/dashboard/InteractivePieChart'));
const InteractiveBarChart = lazy(() => import('@/components/dashboard/InteractiveBarChart'));

// In Demographics tab content:
<Suspense fallback={<SkeletonLoader />}>
  {activeTab === 'demographics' && (
    <>
      <InteractivePieChart {...props} />
      <InteractiveBarChart {...props} />
    </>
  )}
</Suspense>
```

### File References
- Lazy loading implementation: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\components\ResultsDisplay.tsx:10-12` (QRCodeModal lazy import)
- Tab-based charts: `F:\sstac-dashboard\src\app\(dashboard)\survey-results\detailed-findings\page.tsx:1-20` (chart lazy imports)
- Test update for async: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\components\__tests__\ResultsDisplay.test.tsx:410-418`
- Performance validation: `F:\sstac-dashboard\src\__tests__\performance.test.ts` (Core Web Vitals assertions)

### Performance Impact Metrics

**Measured Improvements (Phase 4 Validation):**
- Initial bundle load: 100-150ms faster (lazy components not in critical path)
- LCP (Largest Contentful Paint): 2.5-3s → 1.5-2s ✅
- INP (Interaction to Next Paint): 150-200ms → 50-100ms ✅
- TTI (Time to Interactive): 200-300ms improvement ✅
- Number of new Suspense boundaries: 3 (QRCodeModal, Demographics charts, Effectiveness charts, Solutions charts)

**Bundle Impact:**
- Initial chunk reduced by lazy loading
- Chart libraries split into separate chunks
- Shared JS remained at 219KB (no growth from splitting)

### Key Takeaway

**Lazy loading with Suspense + code-splitting is the proven pattern for performance optimization in React SPA applications.** Apply whenever:
1. Component loads conditionally based on user action (modals, expanded sections)
2. Component heavy (100+ lines, external libraries like recharts, wordcloud-js)
3. Component only needed on specific tab/route (defer until that tab/route becomes active)
4. Tests need updating to account for async Suspense fallback behavior

**Implementation Steps:**
1. Identify conditionally-rendered or tab-specific heavy components
2. Replace `import X from` with `const X = lazy(() => import(...))`
3. Wrap render with `<Suspense fallback={<SkeletonLoader />}>`
4. Update tests: check for fallback text OR component test ID
5. Validate bundle size doesn't grow (should shrink or stay same)
6. Measure Core Web Vitals: should see 100-250ms improvement

---

## 2026-01-26 - E2E Test Port Conflicts in Local Development [MEDIUM]

**Date:** January 26, 2026
**Area:** Testing / CI-CD / Local Development
**Impact:** MEDIUM (blocks E2E test execution until resolved, affects development workflow)
**Status:** Documented (workaround exists)
**Session:** Phase 7: Comprehensive System Review & Validation

### Problem or Discovery

When running E2E tests (Playwright) in a development environment where a Next.js dev server was previously running, the test runner times out waiting for the webServer to start. The issue occurs because:

1. Process from previous session still holds port 3000
2. Playwright's `webServer` config tries to start dev server on same port
3. New server fails to bind, causing 120-second timeout
4. Test suite never starts because webServer never becomes available

**Observable Symptoms:**
- `npm run test:e2e` times out with: "Timed out waiting 120000ms from config.webServer"
- `netstat` shows process holding port 3000 (e.g., process 28548 running `next/dist/server/lib/start-server.js`)
- Port 3001, 3002 appear in warning messages as fallback attempts

### Root Cause or Context

**Why This Happens:**
- Next.js dev server (`npm run dev`) runs in background and may not terminate cleanly
- Git Bash environment in Windows doesn't properly handle process termination commands
- Bash `pkill` and `kill` commands fail silently or fail with syntax errors when invoked from within Bash session
- Windows `taskkill` command with `/F` flag encounters path parsing issues in Git Bash
- Previous session's process remains orphaned, blocking port 3000

**Git Bash / Windows Incompatibility:**
```bash
# These fail in Git Bash:
taskkill /PID 28548 /F
# Error: Invalid argument/option - 'F:/Program Files/Git/PID'

pkill -f "node"
# Either fails silently or with cryptic error

wmic process where processid=28548 delete
# Syntax issues with path execution
```

### Solution or Pattern

**Working Workaround:**
Use `cmd.exe` directly instead of relying on Bash wrappers:

```bash
# CORRECT: Use cmd.exe for Windows process management
cmd /c "taskkill /PID <pid> /F"

# VERIFY: Check port is freed
netstat -ano 2>/dev/null | grep ":3000 " || echo "Port 3000 is free"

# THEN: Run tests
npm run test:e2e
```

**Alternative: Preventive Approaches**
1. **Force CI mode for E2E tests** - Tells Playwright to start fresh server:
   ```bash
   CI=true npm run test:e2e
   ```

2. **Use alternative port** - Modify playwright.config.ts to use different port:
   ```typescript
   webServer: {
     url: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
     // ... existing config
   }
   ```

3. **Clean session start** - Kill all node processes before running:
   ```bash
   # For next session: truly kill all node processes
   Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
   npm run test:e2e
   ```

### File References
- Playwright config: `F:\sstac-dashboard\playwright.config.ts:29-34` (webServer configuration)
- Test execution: `F:\sstac-dashboard\package.json` (test:e2e script)
- Windows process management: Git Bash interactive shell environment

### Performance Impact Metrics

**Development Impact:**
- Test blocking time: 120 seconds (timeout duration)
- Manual fix time: 2-5 minutes
- Affects: E2E testing in local development
- Frequency: Occurs when dev server not cleanly terminated

### Key Takeaway

**For CI/CD environments and local development:**
1. **In Git Bash on Windows:** Use `cmd /c "taskkill /PID <pid> /F"` for process termination, not pure Bash commands
2. **For E2E tests:** Either (a) ensure clean process termination before running, or (b) use `CI=true` flag to bypass port check
3. **Prevention:** Always stop dev server cleanly (`Ctrl+C` in original terminal) rather than terminating the shell
4. **Debugging:** Use `netstat -ano | grep :3000` to identify orphaned processes before running tests

**Recommended Pattern for CI/CD:**
```bash
# Kill any lingering processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Sleep 2  # Brief pause for OS to release port

# Run E2E tests
npm run test:e2e
```

---

## 2026-01-25 - GitHub-Based A+ Grade Upgrade Tracking Framework [HIGH]

**Date:** January 25, 2026
**Area:** Project Management / Multi-Phase Upgrade Execution
**Impact:** HIGH (enables parallel execution of 7-phase, 20-week upgrade with clear progress tracking)
**Status:** Implemented & Operational
**Session:** Phase 0 Infrastructure Update - Comprehensive GitHub Integration

### Problem or Discovery

Complex, multi-phase software upgrades require coordination across:
- 7 interconnected phases (0-7 over 20 weeks)
- 2-3 engineers working in parallel
- Clear progress tracking and context persistence
- Ability to resume work across multiple sessions without losing context
- Grade/quality metric progression that's visible to stakeholders

Managing this with just commit history and manual documentation creates:
- Unclear phase dependencies
- Lost context between sessions
- Difficulty parallelizing work
- No single source of truth for phase status
- Inefficient context switching

### Solution or Pattern

**Five-Layer GitHub-Based Tracking System:**

**Layer 1: GitHub Project Board**
- Location: https://github.com/users/JasenNelson/projects/2/views/1
- Columns: Backlog | Ready | In Progress | In Review | Testing | Complete | Blocked
- Purpose: Visual workflow management per phase

**Layer 2: GitHub Issues (100+ issues)**
- Structure: One issue per task (Phase X.Y format)
- Labels: 8 phase labels (phase-0 through phase-7) + security-critical
- Milestones: One per phase for deadline tracking
- Template: Each issue includes estimated hours, success criteria, related files, dependencies

**Layer 3: Local Documentation (4 files)**
1. `.github/PHASE_CHECKLIST.md` - Detailed completion criteria for all 7 phases
2. `.github/UPGRADE_TRACKING.md` - Weekly progress reports + metrics
3. `IMPLEMENTATION_LOG.md` - Session-by-session work log
4. `ROADMAP.md` - 20-week visual timeline

**Layer 4: Status Review Documents**
- `STATUS_REVIEW_2026-01-25.md` - Comprehensive current state snapshot
- Updated each session to capture progress

**Layer 5: Manifest Facts (docs/_meta/docs-manifest.json)**
- Canonical store of numeric metrics (tests, grade, commits)
- Provenance tracking (source, last_verified dates)
- Prevents metric drift across documentation

### File References
- GitHub Project: https://github.com/users/JasenNelson/projects/2/views/1
- `.github/PHASE_CHECKLIST.md:all` - 7 phases with 40+ tasks total
- `.github/UPGRADE_TRACKING.md:Weekly Reports` - Progress tracking template
- `IMPLEMENTATION_LOG.md:Session tracking` - Session-by-session history
- `ROADMAP.md:Executive Timeline` - Visual 20-week progression
- `STATUS_REVIEW_2026-01-25.md:entire file` - Current state snapshot
- `docs/_meta/docs-manifest.json:facts` - Canonical metric store

### Implementation Details

**Phase Completion Pattern:**
```markdown
## Phase X: Phase Name [Status Emoji]

**Status:** [✅ Complete | ⏳ Pending | 🟡 In Progress]
**Target Weeks:** [Week range]
**Actual Weeks:** [Week range]
**Team:** [Who worked on it]
**Grade Impact:** [+N points]

### Task X.1-X.6: Detailed subtasks
- [x] Completed subtask 1
- [x] Completed subtask 2
  - [x] Specific deliverable
  - [x] Specific deliverable

### Success Criteria
- ✅ Metric 1 achieved
- ✅ Metric 2 achieved

### Phase Sign-Off
- [x] All tasks complete
- [x] Code review approved
- [x] Tests passing
- [x] Ready for next phase
```

**Weekly Progress Template:**
```markdown
### Week N: Phase Name
**Dates:** 2026-01-XX to 2026-01-YY
**Status:** [✅ Complete | 🟡 In Progress]
**Grade Impact:** Starting → Ending (Δ points)

#### Planned Work
- [x] Task 1
- [x] Task 2

#### Metrics
- Tests: X passing, Y failing
- Coverage: Z%
- Commits: N

#### Next Week Focus
- [What to work on next]
```

**Issue Template (GitHub):**
```markdown
# Phase X.Y: Task Name

**Estimated Hours:** N hours
**Grade Impact:** +X points
**Prerequisites:** Phase X-1 complete

## Success Criteria
- [ ] Specific deliverable 1
- [ ] Specific deliverable 2
- [ ] Test coverage verified
- [ ] Documentation updated

## Related Files
- `src/file1.ts` - Primary implementation
- `src/file2.tsx` - Secondary implementation
- `tests/file.test.ts` - Test coverage

## Dependencies
- Blocks: Phase X+1
- Depends on: Phase X-1 completion
```

### Key Takeaway

**For any multi-phase, multi-week upgrade:**
1. Create GitHub Project with visual workflow columns
2. Generate issues from phase breakdown (one per task)
3. Use local markdown docs for detailed phase specs
4. Track metrics in manifest (single source of truth)
5. Update status documents each session
6. Use labels and milestones for cross-filtering and dependency tracking

This approach enables:
- Parallel work without context loss
- Clear phase dependencies
- Session continuity without rework
- Stakeholder visibility into progress
- Easy context switching between team members

---

## 2026-01-25 - Comprehensive Multi-Category Testing Strategy [HIGH]

**Date:** January 25, 2026
**Area:** Testing / Quality Assurance
**Impact:** HIGH (validates all Phase 2 security fixes, establishes performance baselines)
**Status:** Implemented & Validated
**Session:** Phase 3 Comprehensive Testing - 6 major categories

### Problem or Discovery

Production applications require testing across multiple dimensions simultaneously: unit behavior, component integration, end-to-end user workflows, performance under load, security vulnerabilities, and performance budgets. Testing only one dimension leaves the application vulnerable in others.

Phase 3 implemented a comprehensive 6-category testing strategy that validates all previous work and establishes baselines for future optimization.

### Root Cause or Context

Previous testing focused on unit tests for individual functions (246 tests). However, unit tests alone don't catch:
- **Integration issues**: How hooks and components work together with data flow
- **User workflows**: Complete end-to-end scenarios from login through data submission
- **Performance degradation**: Behavior under concurrent load, API response times
- **Security vulnerabilities**: Penetration testing, OWASP compliance, specific attack vectors
- **Performance budgets**: Bundle size creep, Core Web Vitals degradation, memory leaks
- **Load testing**: Rate limiting effectiveness, multi-instance synchronization

Phase 3 addressed these gaps with a systematic 6-category approach.

### Solution or Pattern

**Phase 3 Comprehensive Testing (6 Categories):**

**Task 3.1: Unit Test Expansion**
- Expand beyond existing 246 tests
- Add 218 new unit tests focused on:
  - Regulatory-review tier logic (94 tests) - discretion tier model, Section 35 Indigenous content detection
  - Rate limiting (in-memory: 48 tests + Redis: 43 tests) - distributed state synchronization
- Result: 464 total unit tests

**Files Created:**
- `F:\sstac-dashboard\src\lib\regulatory-review\tier-logic.test.ts` (94 tests, 1,200+ lines)
- `F:\sstac-dashboard\src\lib\rate-limit.test.ts` (48 tests, 600+ lines)
- `F:\sstac-dashboard\src\lib\rate-limit-redis.test.ts` (43 tests, 550+ lines)

**Task 3.2: Integration Test Coverage**
- Test component interactions, hook integration, data flow
- Add 50 integration tests covering:
  - usePollData hook integration with components
  - useMatrixDataCache with data processing
  - FilterSidebar component interactions
  - ResultsDisplay component data flow
  - Hook-to-component data transformations

**File Created:**
- `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\components\__tests__\integration.test.tsx` (50 tests, 1,687 lines)

**Task 3.3: End-to-End Testing**
- Test complete user workflows with Playwright
- Add 37 E2E tests covering:
  - Authentication flows (11 tests) - login, credential validation, session management
  - Admin dashboard navigation (12 tests) - access control, menu navigation, page routing
  - Poll submission workflows (14 tests) - voting, results viewing, chart visualization

**Files Created:**
- `e2e/authentication.spec.ts` (11 tests)
- `e2e/admin-dashboard.spec.ts` (12 tests)
- `e2e/poll-submission.spec.ts` (14 tests)

**Task 3.4: Load Testing**
- Test performance under concurrent traffic with K6
- 14 scenarios covering:
  - API endpoint load: GET /api/announcements, poll results endpoints
  - Poll submission load: POST /api/polls/submit, ranking-polls, wordcloud-polls
  - Admin operations load: Full CRUD on /api/announcements with auth
- Load pattern: Ramp 0→50 over 30s, sustain 50 for 120s, spike to 100 for 30s
- Thresholds: p95 < 500ms, p99 < 1000ms, error rate < 1%

**Files Created:**
- `k6/api-load.js` (148 lines)
- `k6/poll-submission-load.js` (241 lines)
- `k6/admin-operations-load.js` (271 lines)
- `k6/README.md` (206 lines - usage guide)

**Task 3.5: Security Testing**
- Penetration testing and vulnerability scanning
- 55 tests covering:
  - npm audit validation (0 vulnerabilities)
  - Security header verification (6 headers)
  - Rate limit enforcement (7 tests for rate limiting rules)
  - CEW User ID cryptographic security (6 tests for crypto.randomBytes)
  - Authentication/Authorization (8 tests)
  - File upload validation (8 tests)
  - OWASP Top 10: SQL injection, XSS, CSRF prevention

**Files Created:**
- `docs/archive/2026-04-20_phase3-session-reports/SECURITY_TESTING.md` (1,100+ lines — archived 2026-04-20, superseded by `docs/SECURITY_BEST_PRACTICES.md`)
- `src/__tests__/security-validation.test.ts` (55 tests, 500+ lines)

**Task 3.6: Performance Testing**
- Bundle analysis and Core Web Vitals validation
- 33 tests covering:
  - Production build verification
  - Bundle size assertions (main shared JS 219KB, max page 330KB, middleware 78.5KB)
  - Code splitting effectiveness
  - Page load time estimates
  - Data fetch optimization
  - Memory usage patterns
  - Image optimization opportunities

**Files Created:**
- `docs/archive/2026-04-20_phase3-session-reports/PERFORMANCE_TESTING.md` (1,200+ lines with bundle analysis and optimization recommendations — archived 2026-04-20, superseded by `docs/PERFORMANCE_TUNING_GUIDE.md`)
- `src/__tests__/performance.test.ts` (33 tests, 500+ lines)

### File References

**Unit Tests:**
- `F:\sstac-dashboard\src\lib\regulatory-review\tier-logic.test.ts:1-1200` - 94 tests
- `F:\sstac-dashboard\src\lib\rate-limit.test.ts:1-600` - 48 tests
- `F:\sstac-dashboard\src\lib\rate-limit-redis.test.ts:1-550` - 43 tests

**Integration Tests:**
- `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\components\__tests__\integration.test.tsx:1-1687` - 50 tests

**E2E Tests:**
- `e2e/authentication.spec.ts` - 11 tests
- `e2e/admin-dashboard.spec.ts` - 12 tests
- `e2e/poll-submission.spec.ts` - 14 tests

**Load Tests:**
- `k6/api-load.js` - 4 API endpoint scenarios
- `k6/poll-submission-load.js` - 5 submission scenarios
- `k6/admin-operations-load.js` - 5 admin CRUD scenarios

**Security Tests:**
- `src/__tests__/security-validation.test.ts:1-500` - 55 tests
- `docs/archive/2026-04-20_phase3-session-reports/SECURITY_TESTING.md:1-1100` - Full security audit report (archived; current guidance in `docs/SECURITY_BEST_PRACTICES.md`)

**Performance Tests:**
- `src/__tests__/performance.test.ts:1-500` - 33 tests
- `docs/archive/2026-04-20_phase3-session-reports/PERFORMANCE_TESTING.md:1-1200` - Bundle analysis and optimization plan (archived; current guidance in `docs/PERFORMANCE_TUNING_GUIDE.md`)

**Test Execution Results:**
- Total new tests created: 305+
- Total tests now passing: 481 (up from 176 original dashboard tests)
- Test files: 22 (up from 10 original)
- All tests passing: ✅ 100%
- Build status: ✅ SUCCESS
- npm audit: 0 HIGH/CRITICAL vulnerabilities

### Key Takeaway

**Comprehensive multi-category testing catches issues single-category testing misses.**

Each category addresses different quality dimensions:
1. **Unit tests** - Function-level correctness
2. **Integration tests** - Component interaction correctness
3. **E2E tests** - User workflow correctness
4. **Load tests** - Performance under stress
5. **Security tests** - Vulnerability and compliance
6. **Performance tests** - Bundle size and Core Web Vitals

All 6 categories should run in CI/CD pipeline to catch regressions in any dimension.

### Related Patterns

- **Test-Driven Quality**: Tests in all categories should be written before code changes
- **Progressive Validation**: Run category tests in order: unit → integration → E2E → load → security → performance
- **Fail Early**: Catch issues at unit level; prevent them from reaching integration/E2E
- **Performance Budgets**: Establish baselines (Core Web Vitals, bundle size) and enforce limits

---

## 2026-01-25 - Multi-Database Synchronization Strategy for Cross-Project Workflows [MEDIUM]

**Date:** January 25, 2026
**Area:** Data Architecture / System Integration
**Impact:** MEDIUM (enables regulatory-review feature access, improves data consistency)
**Status:** Implemented & Validated
**Session:** Phase 3 Testing - Regulatory-Review Data Sync

### Problem or Discovery

When working with multiple concurrent projects that share data, keeping data consistent across separate databases becomes critical. The SSTAC-Dashboard project needed Tier 2 evaluation results from the regulatory-review engine (separate project), but the data wasn't automatically synchronized, causing the regulatory-review feature to appear "missing" with no data to display.

### Root Cause or Context

Three independent systems were running concurrently:
1. **Dashboard** - Main web application with SQLite database at `src/data/regulatory-review.db`
2. **Regulatory-Review Engine** - Separate Python project that runs evaluation pipeline and stores results
3. **Database Sync** - No automatic synchronization between the two

When the regulatory-review engine completed Tier 2 simulations and saved 5,809 evaluation records, the Dashboard database wasn't updated, causing the regulatory-review page to show "No submissions" despite data being available in the regulatory-review project.

### Solution or Pattern

**Three-Step Multi-Database Synchronization:**

**Step 1: Identify Data Ownership**
Document which system owns each data type:
- **Regulatory-Review Engine** (source of truth):
  - Tier 2 evaluations
  - Assessment results
  - Semantic matches
- **Dashboard** (consumer):
  - Displays regulatory-review data via API
  - Syncs from regulatory-review

**Step 2: Create Sync Script (F:\Regulatory-Review\engine\sync_tier2_to_dashboard.py)**

```python
#!/usr/bin/env python3
"""Sync Tier 2 evaluation results from regulatory-review to dashboard."""

import sqlite3
import json
from datetime import datetime

# Source: regulatory-review database with Tier 2 results
# Destination: dashboard's regulatory-review.db

source_db = f"{PROJECT_ROOT}\\engine\\sqlite\\tier2_sim_20250125.db"
dest_db = f"{DASHBOARD_ROOT}\\src\\data\\regulatory-review.db"

def sync_tier2_evaluations():
    """Sync Tier 2 semantic matches and assessments."""
    source_conn = sqlite3.connect(source_db)
    dest_conn = sqlite3.connect(dest_db)

    # Read all Tier 2 records from source
    cursor = source_conn.cursor()
    cursor.execute("SELECT policy_id, assessment, score FROM tier2_assessments")
    records = cursor.fetchall()  # 5,809 records

    # Insert into destination with transformation
    dest_cursor = dest_conn.cursor()
    for policy_id, assessment, score in records:
        dest_cursor.execute("""
            INSERT INTO regulatory_review_submissions
            (submission_id, tier, policy_id, assessment, evaluation_score)
            VALUES (?, ?, ?, ?, ?)
        """, (
            "TIER2_SIM_20260125",
            "TIER 2",
            policy_id,
            assessment,
            score
        ))

    dest_conn.commit()
    print(f"✓ Synced {len(records)} Tier 2 assessments")
    return len(records)

# Run sync
count = sync_tier2_evaluations()
# Result: "Successfully inserted 5809 assessments for TIER2_SIM_20260125"
```

**Step 3: Verify Sync Completion**

After running the sync script, verify data is accessible from Dashboard API:

```bash
# Test API endpoint
curl http://localhost:3000/api/regulatory-review/submissions?limit=3
# Response: 3 submissions with 5809 total items in TIER2_SIM_20260125
```

### File References

**Sync Script:**
- `F:\Regulatory-Review\engine\sync_tier2_to_dashboard.py` - Tier 2 → Dashboard synchronization

**Dashboard Database:**
- `F:\sstac-dashboard\src\data\regulatory-review.db` (7.1MB post-sync)

**Dashboard API Endpoints:**
- `F:\sstac-dashboard\src\app\api\regulatory-review\submissions\route.ts` - Returns synced submissions
- `F:\sstac-dashboard\src\app\(dashboard)\regulatory-review\page.tsx` - Displays synced data

**Test Results:**
- Pre-sync: regulatory-review page shows "No submissions"
- Post-sync: Page displays "TIER2_SIM_20260125" with 5,809 items
- Data accuracy: ✓ All 5,809 Tier 2 records successfully synced
- API response time: < 100ms for submissions list

### Key Takeaway

**For multi-system workflows, establish clear data ownership and automated sync processes:**

1. **Document data ownership** - Which system is authoritative for which data
2. **Create sync scripts** - Automate data transfer between systems
3. **Version sync outputs** - Include date in submission IDs (TIER2_SIM_20260125) to track sync source
4. **Test sync completion** - Verify data is accessible from consuming system
5. **Handle failures gracefully** - Log detailed sync results for debugging

### Prevention Checklist

- [ ] Identify source of truth for each data type across systems
- [ ] Create sync script for each data type requiring synchronization
- [ ] Run sync script and verify data appears in consuming system
- [ ] Test API endpoints return synced data
- [ ] Document sync schedule (manual, scheduled, or event-triggered)
- [ ] Add sync results to session documentation

---

## 2026-01-25 - Test Expectations Must Track Implementation Changes [HIGH]

**Date:** January 25, 2026
**Area:** Testing / Quality Assurance
**Impact:** HIGH (blocked CI/CD pipeline and deployment verification)
**Status:** Implemented & Validated
**Session:** Phase 2 test fix and validation

### Problem or Discovery

After Phase 2 security hardening was implemented (3 vulnerability fixes, 6 security headers, cryptographic ID generation), unit tests failed in the CI/CD pipeline because test expectations didn't match the actual implementation changes. Two separate issues cascaded:

1. **CEW User ID Format Mismatch**: Tests expected timestamp-based format (`CEW2025_session_1234567890_abc`) but Phase 2 Task 2.5 changed to cryptographically secure format (`CEW2025_a3681a8bb4f83d6cf9f11868cc01d2b6`)
2. **Invalid Vitest Matchers**: Tests used `toStartWith()` method which doesn't exist in Vitest/Chai, causing test execution failures

### Root Cause or Context

Three cascading issues:

1. **Test Expectations Decay**: When implementation changes (especially in fundamental functions like ID generation), all test files that depend on that function must be updated. Phase 2 refactored `generateCEWUserId()` but tests weren't systematically updated.

2. **Incomplete Matcher Knowledge**: Test files used `toStartWith()` assuming Vitest supports all string methods. Vitest/Chai only supports specific matchers; arbitrary method names fail silently until test execution.

3. **Security Changes Have Cascading Effects**: Phase 2 Task 2.1 removed localStorage fallback for admin status. Tests expected localStorage to be checked as backup - these expectations needed updating too.

### Solution or Pattern

**Three-Pronged Test Update Pattern:**

**1. Update Implementation-Dependent Format Expectations (Line Changes)**
```typescript
// BEFORE - Phase 2 hadn't been applied yet:
expect(userId).toMatch(/^CEW2025_session_\d+_[a-z0-9]+$/);

// AFTER - Matches new crypto format:
expect(userId).toMatch(/^CEW2025_[a-f0-9]{32}$/);
expect(userId).toHaveLength(37); // 8 + 1 + 32 = 37
```

**2. Replace Invalid Matchers with Valid Vitest Methods**
```typescript
// INVALID:
expect(userId).toStartWith('CEW2025_');  // ❌ Chai doesn't support toStartWith()

// VALID:
// Use regex matching instead (already covers prefix validation)
expect(userId).toMatch(/^CEW2025_/);
// Or use substring comparison:
expect(userId.substring(0, 8)).toBe('CEW2025_');
```

**3. Remove/Update Security Fallback Expectations**
```typescript
// BEFORE - Expected localStorage backup:
if (databaseError) {
  expect(result).toBe(localStorage.getItem('admin_status_user-123'));
}

// AFTER - Phase 2 security fix removed fallback:
if (databaseError) {
  expect(result).toBe(false); // Always fail safely, never use localStorage
}
```

### File References

**Files Updated for Format Changes:**
- `F:\sstac-dashboard\src\lib\supabase-auth.test.ts:313-340` - CEW user ID generation format expectations
- `F:\sstac-dashboard\src\lib\__tests__\auth-flow.test.ts:182-184` - Format consistency checks
- `F:\sstac-dashboard\src\app\api\polls\submit\__tests__\route.test.ts:152` - Generation fallback format

**Files Updated for Security Changes:**
- `F:\sstac-dashboard\src\lib\admin-utils.test.ts:80-347` - Removed localStorage expectations, removed invalid syntax

**Test Execution Results:**
- Before fixes: 2 failed, 227 passed (invalid matcher error, syntax errors)
- After fixes: 0 failed, 246 passed ✅
- Build status: Success
- CI/CD pipeline: All gates passing

### Key Takeaway

**When implementation changes occur, systematically update all dependent tests:** (1) Identify which tests depend on changed code, (2) Run tests to identify mismatches, (3) Update format expectations first, (4) Replace invalid matchers with valid alternatives, (5) Remove/update fallback/backup expectations that relied on old behavior.

---

## 2026-01-24 - Native Modules in Serverless Environments [CRITICAL]

**Date:** January 24, 2026
**Area:** Deployment / Environment Compatibility
**Impact:** CRITICAL (blocked production deployment)
**Status:** Implemented & Validated
**Session:** Vercel deployment failure resolution

### Problem or Discovery

`better-sqlite3` native C++ module caused webpack compilation failure in Vercel's serverless environment. The module requires native compilation which is not possible in Vercel's build environment, but the application needed to support both local development (with SQLite) and serverless deployment (without SQLite).

### Root Cause or Context

Three cascading issues created the deployment failure:

1. **Webpack Static Analysis Issue**: Webpack statically analyzes all imports during build time, even if they're only used conditionally at runtime. When code directly imports `better-sqlite3`, webpack attempts to resolve and bundle the module.

2. **Native Module Incompatibility**: Vercel's serverless environment cannot compile native C++ modules because:
   - No C++ compiler available in build environment
   - No Python build tools available
   - No persistence between build steps for pre-compiled binaries

3. **Direct Imports in Routes**: Multiple API routes had direct imports at the module level:
   ```typescript
   // This causes webpack to try resolving better-sqlite3 even if it's never called
   import Database from 'better-sqlite3';
   ```

### Solution or Pattern

**Three-Pronged Approach for Multi-Environment Support:**

**1. Webpack Configuration (next.config.ts:12-18)**
```typescript
webpack: (config: any) => {
  // Mark better-sqlite3 as external to prevent webpack from trying to bundle it
  // This is a native module that only works in local development, not in serverless
  config.externals = config.externals || [];
  config.externals.push('better-sqlite3');
  return config;
}
```
This tells webpack: "Don't try to resolve or bundle this module; it's an external dependency."

**2. Lazy Loading in Core Client (src/lib/sqlite/client.ts:25-36)**
```typescript
let Database: any = undefined;

function loadDatabase() {
  if (Database === undefined) {
    try {
      // Only require at runtime when actually needed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Database = require('better-sqlite3');
    } catch {
      // better-sqlite3 not available (expected in serverless)
      Database = null;
    }
  }
  return Database;
}

export function getDatabase(): any {
  const DatabaseModule = loadDatabase();
  if (!DatabaseModule) {
    throw new Error(
      'SQLite database is not available in this environment. ' +
      'better-sqlite3 is required for local development only. ' +
      'This feature is not supported in serverless/Vercel deployments.'
    );
  }
  // ... rest of implementation
}
```
This delays module loading until runtime and gracefully handles missing modules.

**3. Conditional Imports in API Routes (e.g., src/app/api/regulatory-review/search/route.ts:14-19)**
```typescript
let Database: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Database = require('better-sqlite3');
} catch {
  // better-sqlite3 not available
}

export async function GET(request: NextRequest) {
  if (!Database) {
    return NextResponse.json(
      { error: 'Policy search is only available in local development' },
      { status: 503 }
    );
  }
  // ... rest of implementation
}
```
This prevents TypeScript from trying to statically analyze the import and returns a helpful error if called in serverless.

### File References

**Configuration Files:**
- `F:\sstac-dashboard\next.config.ts:12-18` - Webpack externals configuration
- `.claude/skills/update-docs/SKILL.md` - Documentation system for this project

**Core SQLite Client:**
- `F:\sstac-dashboard\src\lib\sqlite\client.ts:25-36` - Lazy loading implementation
- `F:\sstac-dashboard\src\lib\sqlite\client.ts:50-85` - Database initialization with error handling

**API Routes Using Pattern:**
- `F:\sstac-dashboard\src\app\api\regulatory-review\search\route.ts:14-19` - Policy search API
- `F:\sstac-dashboard\src\app\api\regulatory-review\submission-search\route.ts:14-19` - Submission search API

**Related Infrastructure (31 files added in this session):**
- Entire `src/lib/sqlite/` directory - Database utilities
- Entire `src/app/api/regulatory-review/` directory - API routes
- Entire `src/components/regulatory-review/` directory - UI components
- Entire `src/lib/regulatory-review/` directory - Utility functions

### Key Takeaway

**For any feature requiring native modules, use lazy loading + webpack externals to support both local development (with module) and serverless deployment (without module).**

This pattern allows gradual feature development in local environments without blocking production deployments. The feature works fully in local development while gracefully degrading in serverless environments.

### Related Patterns

- **Lazy Loading vs Direct Imports**: Direct imports force static analysis; lazy loading with try-catch allows runtime resolution
- **Webpack Externals**: Essential for any native module; prevents webpack from attempting resolution
- **Error Handling Strategy**: Return 503 Service Unavailable instead of failing the entire build; allows deployed application to function for other features

### Prevention Checklist

- [ ] For any native module dependency, mark it as external in webpack config
- [ ] Use lazy loading with try-catch for module imports
- [ ] Test locally with module installed
- [ ] Test production build without installing native modules (simulate serverless)
- [ ] Ensure API routes return helpful error messages instead of crashing
- [ ] Document which features require native modules and why

---

## 2026-01-24 - Incremental Component Extraction Pattern [MEDIUM]

**Date:** January 24, 2026
**Area:** Component Architecture / Refactoring
**Impact:** HIGH (enables 1500+ line reductions with 51 new tests)
**Status:** Completed Phases 2-5, Verified Phase 6
**Session:** PollResultsClient refactoring Phases 2-6 (6-part comprehensive refactoring)

### Problem or Discovery

Large monolithic components (1,000+ lines) become increasingly difficult to maintain, test, and reason about. Refactoring them all-at-once is risky and can introduce regressions. The challenge is how to decompose them safely while maintaining functionality and test coverage.

### Root Cause or Context

The PollResultsClient.tsx component had grown to 1,898 lines, mixing:
- Data fetching logic (Supabase queries)
- Data processing and combining
- UI state management
- Rendering and display logic
- Export functionality

This mix of concerns made it hard to:
- Test individual concerns in isolation
- Reuse data fetching logic in other components
- Modify rendering without affecting data layer
- Understand component flow

### Solution or Pattern

**Incremental Extraction Strategy (Test-First Approach):**

**Phase 1: Foundation & Instrumentation**
- Create test directory structure (`__tests__/`)
- Establish baseline (all tests passing)
- Document current component state (line count, responsibilities)

**Phase 2: Extract Data Fetching Layer**
1. **Write tests first** (`usePollData.test.ts`):
   - Test hook initialization
   - Test data fetching behavior
   - Test error handling
   - Test state updates

2. **Create hook** (`usePollData.ts`):
   - Move Supabase query logic
   - Move data processing functions
   - Extract state management for data
   - Return clean interface: `{ pollResults, loading, error, matrixData, fetchPollResults, setMatrixData }`

3. **Update component**:
   - Replace inline logic with hook
   - Remove Supabase client creation
   - Import and use hook

4. **Verify quality**:
   - `npm run lint -- --fix` (auto-fix issues)
   - `npx tsc --noEmit` (type check)
   - `npm run test` (all tests pass)
   - `npm run build` (production build succeeds)
   - `npm run docs:gate` (gate requirements satisfied)

5. **Document pattern**:
   - Use `/update-docs` to capture the extraction pattern
   - Update LESSONS.md with reusable insights
   - Update manifest facts with refactoring progress

6. **Commit**:
   - Focused commit with clear message
   - Include metrics in commit message (line reduction, test additions)
   - Reference gate requirements

**Phase 3: Extract Display Logic → `ResultsDisplay.tsx`**
1. Created 1,084-line component with all poll rendering logic (wordcloud, ranking, single-choice)
2. Added 23 new tests covering all poll types and rendering scenarios
3. Reduced PollResultsClient: 1,178 → 403 lines (775 line reduction, 66%)
4. Test suite: 148 → 171 tests (0 regressions)

**Phase 4: Extract Matrix Graphs → `MatrixGraphRenderer.tsx`**
1. Created 155-line component for prioritization and holistic matrix graph rendering
2. Added 10 new tests with 100% conditional coverage
3. Reduced ResultsDisplay: 1,084 → 902 lines (182 line reduction)
4. Test suite: 171 → 181 tests (0 regressions)

**Phase 5: Extract UI State → `useResultsState.ts`**
1. Created 50-line hook managing 11 UI state variables and toggle function
2. Added 12 new comprehensive tests covering all state transitions
3. Centralized state management, improved component clarity
4. Test suite: 181 → 193 tests (0 regressions)

**Phase 6: Final Integration & Verification**
- ✓ Full test suite: 193 tests passing (100%)
- ✓ TypeScript: 0 compilation errors
- ✓ Build: Production build successful
- ✓ Gates: POLLING_GATE verified PASS
- ✓ All quality checks passed

### File References

**Phase 2: Data Fetching Layer**
- Hook: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\hooks\usePollData.ts` (323 lines)
- Tests: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\hooks\__tests__\usePollData.test.ts`
- Usage: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\PollResultsClient.tsx:12`

**Phase 3: Display Logic**
- Component: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\components\ResultsDisplay.tsx` (1,084 lines)
- Tests: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\components\__tests__\ResultsDisplay.test.tsx` (433 lines, 31 tests)

**Phase 4: Matrix Graphs**
- Component: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\components\MatrixGraphRenderer.tsx` (155 lines)
- Tests: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\components\__tests__\MatrixGraphRenderer.test.tsx` (263 lines, 10 tests)

**Phase 5: UI State Management**
- Hook: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\hooks\useResultsState.ts` (50 lines)
- Tests: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\hooks\__tests__\useResultsState.test.ts` (12 tests)
- Usage: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\PollResultsClient.tsx:14-32`

**Related Commits:**
- Phase 1: `90e7404` - test: setup test infrastructure
- Phase 2: `51f59e4` - refactor: extract data fetching into usePollData hook
- Phase 3: `5ca6a04` - refactor: extract poll results display logic into ResultsDisplay component
- Phase 4: `a9a2ada` - refactor: extract matrix graph rendering into MatrixGraphRenderer component
- Phase 5: `594cb68` - refactor: extract UI state management into useResultsState hook

**Test Progression:**
- Baseline: 142 tests (10 test files)
- After Phase 2: 148 tests (+6)
- After Phase 3: 171 tests (+23)
- After Phase 4: 181 tests (+10)
- After Phase 5: 193 tests (+12)

### Key Takeaway

**Incremental, test-first extraction of concerns into smaller, focused components/hooks is the safest way to refactor large monolithic components. Each phase should:**
- Write tests before extracting
- Extract 100-500 lines at a time
- Verify quality after each step
- Document patterns using `/update-docs`

This approach eliminates regression risk, maintains test coverage, and builds reusable patterns.

### Related Patterns

- **Test-First Development**: Writing tests before code ensures behavior is well-defined
- **Separation of Concerns**: Each extracted component/hook has single responsibility
- **Incremental Delivery**: Small focused commits are easier to review and revert if needed
- **Pattern Documentation**: Using `/update-docs` captures knowledge for future work

### Complete Metrics (Phases 2-5)

**Line Reduction Progress:**
- Baseline: 1,898 lines (PollResultsClient monolithic)
- After Phase 2: 1,178 lines (distributed) - 720 line reduction (38%)
- After Phase 3: 403 lines (PollResultsClient) - 775 line reduction (66%)
- After Phase 4: 902 lines (ResultsDisplay) - 182 line reduction in ResultsDisplay
- After Phase 5: 403 lines (PollResultsClient) - Improved clarity, state management centralized

**Final Component Architecture:**
- PollResultsClient: 403 lines (orchestration)
- ResultsDisplay: 902 lines (rendering)
- MatrixGraphRenderer: 155 lines (matrix graphs)
- usePollData: 323 lines (data fetching)
- useResultsState: 50 lines (UI state)
- Total: 1,833 lines distributed across focused files

**Test Coverage Expansion:**
- Baseline: 142 tests (10 files)
- Final: 193 tests (14 files, +51 new tests)
- Breakdown: Phase 2: +6, Phase 3: +23, Phase 4: +10, Phase 5: +12
- Health: 193/193 passing (100% pass rate, 0 regressions)

**Quality Assurance:**
- TypeScript: 0 compilation errors
- ESLint: 0 errors in new/modified files
- Build: Successful production build
- Gates: POLLING_GATE verified PASS
- Architecture: Clear separation of concerns
- Maintainability: Each component/hook has single responsibility

### Prevention Checklist

- [ ] Write tests BEFORE extracting code
- [ ] Extract ~100-500 lines per phase
- [ ] Run lint + type check + test after each extraction
- [ ] Verify full build succeeds
- [ ] Check gate requirements still satisfied
- [ ] Use `/update-docs` to capture pattern
- [ ] Create focused commit with metrics
- [ ] Continue with next phase only after validation

---

## Adding New Lessons

When adding lessons to this document:

1. **Use the template above** with all sections (Problem, Root Cause, Solution, File References, Key Takeaway)
2. **Include specific file paths with line numbers** for code examples
3. **Make it reusable** - would this help someone solving a similar problem?
4. **Focus on patterns** - not one-off fixes, but patterns that apply broadly
5. **Link to related files** - docs/NEXT_STEPS.md, docs/ARCHITECTURE.md, etc.

**To add a new lesson, use `/update-docs` skill at end of session.**

---

## 2026-01-24 - Python Gitignore Rules Interfering with JavaScript Projects [MEDIUM]

**Date:** January 24, 2026
**Area:** Git / DevOps Configuration
**Impact:** MEDIUM (caused Vercel build failure, required force-push to fix)
**Status:** Resolved
**Session:** TWGReviewClient Phase 2 refactoring deployment

### Problem or Discovery

Created 12 new component files in `src/app/(dashboard)/twg/review/parts/` directory. All files were present locally and built successfully. However, after pushing to remote, Vercel build failed with "Module not found" errors for all Part components. Investigation revealed the files were never committed to Git due to `.gitignore` rules.

**Root Cause:** The `.gitignore` file inherited Python packaging rules that ignored `/parts/` directories globally (line 64: `parts/`), originally intended for Python `setuptools` but applying to all `parts/` directories in the repo, including JavaScript component directories.

### Root Cause or Context

The `.gitignore` file at repository root contains comprehensive Python development exclusions copied from Python templates. One rule:

```
# Python Distribution / packaging
.Python
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib64/
parts/           # ← This line causes the issue
sdist/
```

This rule prevents Git from tracking ANY directory named `parts/` anywhere in the repo. When we created `src/app/(dashboard)/twg/review/parts/`, Git ignored all files in it automatically, but:

1. Local build succeeded (files existed on disk)
2. `git status` showed only new files outside the ignored `parts/` directory
3. `git add` silently skipped the ignored `parts/` directory
4. `git push` sent incomplete code to remote
5. Vercel build cloned incomplete code and failed on missing imports

The error was silent - Git didn't warn that files were being ignored; they just weren't staged.

### Solution or Pattern

**Three-step fix for language-template gitignore conflicts:**

**1. Add .gitignore exception for project-specific directories (before other rules)**

Edit `.gitignore` to add exceptions BEFORE the conflicting rule:

```gitignore
*.pem

# Exception for Next.js component parts directory
!src/app/**/parts/

# Log files
npm-debug.log*
```

The `!` prefix means "don't ignore these". Placement matters - exceptions must come before the rule they override.

**2. Force-add ignored files to staging**

```bash
git add -f src/app/(dashboard)/twg/review/parts/
```

The `-f` (force) flag stages files even if they're in `.gitignore`.

**3. Amend previous commit or create new commit**

```bash
# If commit not yet pushed:
git commit --amend --no-edit

# If already pushed, amend then force-push:
git push --force-with-lease
```

### File References

- `.gitignore` line 20-21: Added exception rule
- Commit: `2f42ae5` - Shows 12 Part components added after amendment
- Related files:
  - `src/app/(dashboard)/twg/review/parts/Part1ReviewerInformation.tsx` (and 11 others)
  - `src/app/(dashboard)/twg/review/components/TWGReviewFormContainer.tsx:4-15` (imports Part components)

### Key Takeaway

**When creating new directories in language-specific projects:**

1. **Check .gitignore for conflicting rules** - Search for your directory name in all .gitignore files
2. **Add exceptions for project-specific paths** - Use `!pattern/` to override global ignore rules
3. **Verify with `git status -u`** - Shows untracked files; empty means something is being ignored
4. **Force-add if needed** - Use `git add -f` to stage ignored files
5. **Test before pushing** - Build locally with `npm run build` to catch import errors

### Prevention Checklist

- [ ] Search .gitignore for any patterns matching your new directory names
- [ ] Add exceptions for new component directories at top of .gitignore
- [ ] After creating new files, run `git status` and verify they appear as untracked
- [ ] Run `git add .` and check status again - files should move to staged
- [ ] Run local build (`npm run build`) before pushing to catch import errors
- [ ] Test Vercel preview build - catches what CI will see
- [ ] Use `git diff --cached` to review all changes before committing

---

## 2026-01-25 - Multi-Layer Security Hardening Pattern [HIGH]

**Date:** January 25, 2026
**Area:** Security / API Protection
**Impact:** HIGH (fixes 3 critical vulnerabilities, adds 6 security headers)
**Status:** Implemented & Verified
**Session:** Phase 2 Security Hardening (Tasks 2.1-2.5)

### Problem or Discovery

Production applications face multiple independent security threats that require a coordinated defense strategy:
1. Authentication bypass vulnerabilities (localStorage fallbacks)
2. Unprotected public endpoints allowing unauthorized access
3. Missing security headers leaving application vulnerable to MIME sniffing, clickjacking, XSS
4. Rate limiting only working per-instance (not across distributed deployments)
5. Weak user ID generation allowing predictable identifiers
6. File uploads without validation enabling malicious file execution

A piecemeal approach fixing one vulnerability at a time leaves application exposed to others. Phase 2 demonstrated the value of a coordinated security hardening strategy.

### Root Cause or Context

Security vulnerabilities accumulate over time as features are added without comprehensive security review:

1. **Admin Bypass Issue**: Early implementation cached admin status in localStorage for performance. When database was slow or unavailable, fallback to localStorage allowed unauthenticated users to gain admin privileges by setting `localStorage.admin_status = true` in browser console.

2. **Public Endpoint Issue**: Announcements endpoint was initially public to allow all users to see notifications. However, without authentication, it exposed user data to external attackers.

3. **Missing Security Headers**: Headers like Content-Security-Policy, X-Frame-Options, and X-Content-Type-Options are not added by default by Next.js. Without them, browsers apply minimal protection, leaving application vulnerable to:
   - MIME sniffing attacks (content treated as wrong type)
   - Clickjacking (app loaded in invisible iframe and user tricked into clicking)
   - XSS attacks (inline scripts executed without restriction)

4. **Rate Limiting per Instance**: In-memory rate limiting only works on single server. In production with load balancing across multiple instances, each instance maintains separate rate limit counters. Attacker hitting different instances can exceed rate limits.

5. **Timestamp-based User IDs**: CEW polls generate user IDs using `${timestamp}_${Math.random()}`. Timestamp is predictable, Math.random() is not cryptographically secure. Attacker can guess valid user IDs and impersonate other voters.

6. **Unvalidated File Uploads**: File upload endpoint accepted any file type and size, enabling:
   - Malicious executable uploads
   - Server storage exhaustion (large file bombs)
   - Type confusion (upload executable with .pdf extension)

### Solution or Pattern

**Coordinated Multi-Layer Security Strategy (Defense in Depth):**

**1. Authentication & Authorization - Server-Side Only (src/lib/admin-utils.ts)**
```typescript
// REMOVE all localStorage fallbacks
// Admin status ALWAYS verified server-side
export async function isUserAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .single();

  const isAdmin = !!roleData;
  return isAdmin; // Always return server-verified result, never fallback
}
```

**Pattern:** Never trust client-side caches for security-sensitive data. Always verify server-side. Fail secure (return false) on any error.

**2. Protect Public Endpoints (src/app/api/announcements/route.ts)**
```typescript
export async function GET(request: NextRequest) {
  const supabase = await createAuthenticatedClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized: Authentication required' },
      { status: 401 }
    );
  }

  // Only authenticated users can see announcements
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  return NextResponse.json(announcements);
}
```

**Pattern:** Default to "require authentication". Only make endpoints truly public if explicitly required (and document why). Use explicit user auth check at start of route.

**3. Comprehensive Security Headers (src/middleware.ts)**

```typescript
// Content-Security-Policy: Restrict resource loading sources
response.headers.set(
  'Content-Security-Policy',
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
  "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; " +
  "font-src 'self' data:; " +
  "connect-src 'self' https://*.supabase.co"
)

// X-Content-Type-Options: Prevent MIME type sniffing
response.headers.set('X-Content-Type-Options', 'nosniff')

// X-Frame-Options: Prevent clickjacking
response.headers.set('X-Frame-Options', 'DENY')

// X-XSS-Protection: Enable browser XSS protection
response.headers.set('X-XSS-Protection', '1; mode=block')

// Referrer-Policy: Don't leak referrer info to third-party
response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

// Permissions-Policy: Disable unnecessary browser features
response.headers.set(
  'Permissions-Policy',
  'geolocation=(), microphone=(), camera=(), payment=()'
)

// Strict-Transport-Security: Force HTTPS (production only)
if (process.env.NODE_ENV === 'production') {
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )
}
```

**Pattern:** Add security headers in middleware (applies to all responses). Set in middleware instead of individual routes for consistency.

**4. Distributed Rate Limiting (src/lib/rate-limit-redis.ts)**

```typescript
export async function checkRateLimitRedis(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const isRedisAvailable = await initializeRedis();

  if (!isRedisAvailable) {
    // Fallback to in-memory for development
    return checkRateLimitInMemory(identifier, options);
  }

  // Use Redis for production (works across multiple instances)
  const key = `rl:${identifier}`;
  const entry = await redisClient.get(key);

  if (!entry) {
    // New window - increment from 1
    const data = { count: 1, resetTime: Date.now() + options.windowMs };
    await redisClient.setex(key, Math.ceil(options.windowMs / 1000), JSON.stringify(data));
    return { success: true, remaining: options.max - 1, resetTime: data.resetTime };
  }

  // Existing window - check if limit exceeded
  const data = JSON.parse(entry);
  if (data.count >= options.max) {
    return { success: false, remaining: 0, resetTime: data.resetTime };
  }

  // Increment counter
  data.count++;
  await redisClient.setex(key, Math.ceil(options.windowMs / 1000), JSON.stringify(data));
  return { success: true, remaining: options.max - data.count, resetTime: data.resetTime };
}
```

**Pattern:** Redis for production (distributed state), in-memory fallback for development. Test rate limiting works across multiple server instances.

**5. Cryptographically Secure User ID Generation (src/lib/supabase-auth.ts)**

```typescript
import { randomBytes } from 'crypto';

export function generateCEWUserId(authCode: string = 'CEW2025', sessionId?: string | null): string {
  if (sessionId) {
    return `${authCode}_${sessionId}`;
  }

  // Use crypto.randomBytes instead of timestamp + Math.random()
  // randomBytes is cryptographically secure and unpredictable
  try {
    const randomHex = randomBytes(16).toString('hex');
    return `${authCode}_${randomHex}`;
  } catch {
    // Fallback (should never happen in production)
    const fallbackRandom = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    return `${authCode}_${fallbackRandom}`;
  }
}
```

**Pattern:** Use `crypto.randomBytes` for any security-sensitive randomness (user IDs, tokens, nonces). Never use `Math.random()` or timestamps.

**6. File Upload Validation (src/app/api/review/upload/route.ts)**

```typescript
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt'];

export async function POST(request: NextRequest) {
  const file = formData.get('file') as File;

  // Whitelist validation - only allow specific types
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
      { status: 400 }
    );
  }

  // Size validation - prevent storage exhaustion
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Max: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 413 }
    );
  }

  // Extension validation - prevent type confusion
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
    return NextResponse.json(
      { error: `Invalid extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
      { status: 400 }
    );
  }

  // Upload only after all validation passes
  const { data, error } = await supabase.storage.from('documents').upload(filePath, file);
}
```

**Pattern:** Whitelist-based validation (specify what's allowed), not blacklist (specify what's forbidden). Validate at 3 levels: MIME type, extension, size.

### File References

**Critical Vulnerabilities Fixed:**
- `F:\sstac-dashboard\src\lib\admin-utils.ts:90-100` - Removed localStorage fallback
- `F:\sstac-dashboard\src\app\api\announcements\route.ts:1-30` - Added auth check
- `F:\sstac-dashboard\package.json` - Updated tar >= 7.6.0 (npm audit fix)

**Security Headers:**
- `F:\sstac-dashboard\src\middleware.ts:9-54` - 6 security headers + HSTS (production)

**Rate Limiting:**
- `F:\sstac-dashboard\src\lib\rate-limit-redis.ts:79-161` - Redis-based rate limiting
- `F:\sstac-dashboard\src\app\api\_helpers\rate-limit-wrapper.ts:19-56` - Rate limit integration

**User ID Generation:**
- `F:\sstac-dashboard\src\lib\supabase-auth.ts:18` - Import crypto.randomBytes
- `F:\sstac-dashboard\src\lib\supabase-auth.ts:224-252` - generateCEWUserId with crypto

**File Upload Validation:**
- `F:\sstac-dashboard\src\app\api\review\upload\route.ts:8-17` - MIME types whitelist
- `F:\sstac-dashboard\src\app\api\review\upload\route.ts:41-72` - Validation checks

**Related Commits:**
- `2ed8a18` - Task 2.1: Fix 3 critical vulnerabilities
- `39afcb2` - Task 2.2: Add security headers middleware
- `d90e504` - Task 2.3: File upload validation
- `bb2f8ee` - Task 2.4: Redis rate limiting
- `8b4ff31` - Task 2.5: CEW ID crypto fix

### Key Takeaway

**Security requires coordinated defense across multiple layers:**
1. **Authentication**: Never trust client-side verification; always verify server-side
2. **Authorization**: Require auth by default; only allow public access when explicitly needed
3. **Headers**: Add comprehensive security headers in middleware for all responses
4. **Rate Limiting**: Use distributed storage (Redis) for multi-instance deployments
5. **Cryptography**: Use crypto.randomBytes for security-sensitive randomness
6. **Input Validation**: Whitelist allowed values; validate at multiple levels (type, extension, size)

Implementing all 6 layers together is more effective than any single layer alone. Each layer catches different attack vectors.

### Related Patterns

- **Server-Side Verification**: Never trust client claims about security-sensitive data
- **Fail Secure**: When in doubt, return false/deny rather than true/allow
- **Defense in Depth**: Multiple overlapping protections catch different attacks
- **Distributed State**: For stateful features (rate limiting), use Redis in production
- **Cryptographic Randomness**: Use crypto module, never Math.random or timestamps
- **Whitelist Validation**: Specify what's allowed, not what's forbidden
- **Middleware for Cross-Cutting Concerns**: Security headers belong in middleware, not individual routes

### Prevention Checklist

- [ ] All security-sensitive data verified server-side (never client-side fallback)
- [ ] All endpoints require authentication by default (explicitly allow public endpoints)
- [ ] Security headers set in middleware for all responses
- [ ] Rate limiting uses distributed storage in production (Redis or similar)
- [ ] All random values use crypto.randomBytes (never Math.random or timestamps)
- [ ] All file uploads validated at 3+ levels (type, extension, size)
- [ ] npm audit shows 0 HIGH/CRITICAL vulnerabilities
- [ ] Security headers verified with curl -I http://localhost:3000
- [ ] Rate limiting tested across multiple server instances
- [ ] File upload tested with invalid types (should reject)

---

## Table of Contents

1. [2026-01-24 - Native Modules in Serverless Environments](#2026-01-24---native-modules-in-serverless-environments-critical) [CRITICAL]
2. [2026-01-24 - Incremental Component Extraction Pattern](#2026-01-24---incremental-component-extraction-pattern-high) [HIGH - Phases 2-5 Complete]
3. [2026-01-24 - Python Gitignore Rules Interfering with JavaScript Projects](#2026-01-24---python-gitignore-rules-interfering-with-javascript-projects-medium) [MEDIUM]
4. [2026-01-25 - Multi-Layer Security Hardening Pattern](#2026-01-25---multi-layer-security-hardening-pattern-high) [HIGH]
5. [2026-05-29 - Cross-Source Unit Normalization Fail-Closed Guard](#2026-05-29---cross-source-unit-normalization-fail-closed-guard-high) [HIGH]

---

## 2026-05-29 - Cross-Source Unit Normalization Fail-Closed Guard [HIGH]

**Date:** May 29, 2026
**Area:** Architecture / Data Integrity (matrix-options TRV selection)
**Impact:** HIGH (latent 1000x mis-selection)
**Status:** Implemented (PR #191)

### Problem or Discovery
The Matrix Options catalog groups candidate TRVs per substance + pathway + input_key across
sources (Protocol 1 sec 4.4 cross-source comparison). Different sources express the SAME quantity
in different units: an inhalation RfC is "2e-05 mg/m3" from one source and "2E-2 ug/m3" from
another (numerically identical, 1000x apart in raw magnitude); an inhalation unit risk (IUR) is
"per ug/m3" vs "(mg/m3)-1" (a RECIPROCAL basis). Any value-based comparison (a future
most-stringent / min / max default pick) across such a group would mis-rank by up to 1000x or
invert a carcinogenic slope.

### Root Cause or Context
buildDefaultSelectionPolicyDecision currently ranks candidates ONLY by jurisdiction hierarchyRank
(no value comparison yet), so the hazard is latent, not live -- but the catalog data deliberately
co-groups incommensurate units (that grouping is correct for cross-source comparison). The risk is
that a future value comparator runs on raw values without converting units first.

### Solution or Pattern
Fail-closed unit normalization at the single comparison boundary:
1. normalizeToBase(value, unit) classifies dimension (air / dose / dimensionless) and forward vs
   reciprocal FROM THE UNIT STRING (robust across legacy and canonical input_key vocab), converts
   the mass prefix to a canonical base (mg), and INVERTS the factor for reciprocal quantities.
   Returns null on any unrecognized/blank unit -- never guesses.
2. Token-safe parsing: take the numerator only (before the first '/'), strip a leading 'per',
   require an EXACT mass token -- so the 'g' inside a denominator 'kg' is never matched.
3. assessSlotUnitConsistency reports comparable=true only when every unit is recognized AND all
   share one base. The selection withholds its auto-recommendation (manual_decision_required)
   when 2 or more eligible candidates are not provably comparable. Single-candidate and
   already-comparable slots are never blocked (no over-reach).

Related data-integrity gotcha found the same session: PDF/Docling/Excel extraction coerced CAS
numbers into DATES (e.g. CAS 75-01-4 stored as "1975-01-04"). Detect malformed CAS by validating
against the strict CAS regex (2-7 digits, hyphen, 2 digits, hyphen, 1 check digit), not by eyeballing.

### File References
- `C:/Projects/SSTAC-Dashboard/src/lib/matrix-options/unitNormalization.ts` (normalizeToBase,
  assessSlotUnitConsistency)
- `C:/Projects/SSTAC-Dashboard/src/lib/matrix-options/defaultSelectionPolicy.ts` (isUnitBlocked
  predicate + unitConsistency on the decision)
- Tests: `src/lib/matrix-options/__tests__/unitNormalization.test.ts`,
  `src/lib/matrix-options/__tests__/defaultSelectionPolicy.test.ts`

### Key Takeaway
When a feature deliberately co-groups values in heterogeneous units for comparison, put a single
fail-closed normalization boundary in front of any numeric comparison: normalize-or-refuse, never
compare raw. Parse units token-safely (numerator-only, exact mass token) and treat blank/unknown
units as not-comparable.

---

## 2026-06-02 - Trimming UI Tabs Can Silently Orphan a Shipped Feature [HIGH]

**Date:** June 2, 2026
**Area:** Architecture / UI State (matrix-options Evidence Library)
**Impact:** HIGH (a shipped, tested feature became unreachable in production with no error)
**Status:** Implemented (PR #232)

### Problem or Discovery
The Evidence Library "By Parameter" (value-groups) view -- which renders PR #206's
incommensurate-unit badge -- silently disappeared from the UI. The render branch and its tests
still existed and still passed; the view was simply unreachable because no tab in the trimmed
tab list selected it. A later session "discovered" a feature was missing that had in fact shipped
and was still fully tested.

### Root Cause or Context
PR #210 trimmed the Evidence Library tab list (it retired the dead "equations" view and
reorganized tabs). It removed the tab that selected the value-groups view but LEFT the render
branch in place. The render branch became reachable only via a legacy saved view whose stored
view_mode still pointed at it -- so on a clean session with no such saved state, the feature was
dead code from the user's perspective. Unit tests render the branch directly, so they kept
passing and gave false confidence the feature was live.

### Solution or Pattern
Re-expose the value-groups view by restoring its tab entry (PR #232). The reusable discipline:
when removing or reordering UI tabs, audit for render branches that are now reachable ONLY via
legacy persisted state (saved views, localStorage, URL params). A render branch with no live
entry point is orphaned even though it compiles and its unit tests pass. Tests that mount a
component branch directly do NOT prove the branch is reachable through the real navigation.

### File References
- `C:/Projects/SSTAC-Dashboard/src/components/matrix-options/EvidenceLibrary.tsx`
  (value-groups / By Parameter tab + render branch)
- Related origin: PR #206 (incommensurate-unit badge), PR #210 (tab-list trim that orphaned it)

### Key Takeaway
Removing a UI tab does not remove the render code behind it. When trimming tabs, grep for every
render branch and confirm each still has a live entry point; a branch reachable only through
legacy saved state is orphaned. Unit tests that render a branch directly will not catch this --
verify reachability through the actual navigation.

---

## 2026-06-02 - Saved-View Coercion Must Be Identical on Both Hydration Paths [MEDIUM]

**Date:** June 2, 2026
**Area:** Architecture / State Hydration (matrix-options saved views)
**Impact:** MEDIUM (same saved view behaves differently depending on where it loads from)
**Status:** Implemented (PR #232)

### Problem or Discovery
A saved view's view_mode is normalized (coerced) in TWO places: the localStorage loader and the
Supabase coerceViewMode path. The two policies had drifted apart, so the SAME logical saved view
behaved differently by source: a "source-leads" view rendered blank when hydrated from Supabase,
and a "by-parameter" view reset to "Values" when hydrated from localStorage.

### Root Cause or Context
When a feature persists a discriminated value (here view_mode) in more than one store, each store
needs its own deserialize/coerce step. Those steps were written and edited independently over
several PRs, so the localStorage path and the Supabase path applied different remap rules for the
same legacy values. There was no single shared coercion function, so they fell out of lockstep.

### Solution or Pattern
Unify the coercion policy across both hydration paths (PR #232): source-leads -> sources;
preserve by-parameter / sources / values / assumptions; map equations and any unknown value ->
values. Apply the identical mapping in the localStorage loader and in Supabase coerceViewMode.
Best practice: factor the mapping into ONE shared function both paths call, so they cannot drift.

### File References
- `C:/Projects/SSTAC-Dashboard/src/components/matrix-options/EvidenceLibrary.tsx`
  (localStorage saved-view loader + Supabase coerceViewMode)

### Key Takeaway
When the same persisted value is hydrated from more than one store (localStorage AND Supabase),
the coercion/normalization policy must be identical on every path -- ideally one shared function.
If the policies drift, the same saved view behaves differently by source (blank, or reset to a
default).

---

## 2026-06-02 - eslint . Lints Build-Quarantine Artifacts Unless .tmp Is Ignored [MEDIUM]

**Date:** June 2, 2026
**Area:** Tooling / Lint Gate (local dev workflow)
**Impact:** MEDIUM (false local lint failures AFTER a monitored build; CI unaffected)
**Status:** Implemented (PR #233)

### Problem or Discovery
Running `eslint .` locally fails with false `no-require-imports` errors -- but only AFTER running
`npm run build:monitored:clean`. The errors come from compiled JS, not from source.

### Root Cause or Context
build:monitored:clean quarantines the `.next` build output by moving it to
`.tmp/next-quarantine-*` (to avoid the Windows Access-Denied / EPERM .next stalls). That
quarantined output is compiled JavaScript full of legitimate `require()` calls. Because
`.tmp/**` was not in the ESLint ignore list, `eslint .` walked into the quarantine folder and
flagged those compiled `require()` calls as `no-require-imports` violations. CI never sees this
because it lints a clean checkout that has never run a monitored build, so `.tmp/` does not exist
there.

### Solution or Pattern
Add `.tmp/**` to the ignores in `eslint.config.mjs` (PR #233). General principle: any directory
the build/gate tooling writes generated or quarantined artifacts into must be in the linter's
ignore list, or `eslint .` will lint build output and produce failures that exist only on
machines that have run the build.

### File References
- `C:/Projects/SSTAC-Dashboard/eslint.config.mjs` (added `.tmp/**` to ignores)
- Producer of the quarantine dir: `scripts/verify/monitored-build.ps1` (moves .next to
  `.tmp/next-quarantine-*`)

### Key Takeaway
`eslint .` lints everything not explicitly ignored, including build-quarantine artifacts. If a
gate script moves compiled output into a working dir (here `.tmp/next-quarantine-*`), add that
dir to the ESLint ignores or you get false `no-require-imports` failures locally that never
appear in CI's clean checkout.

---

## 2026-06-02 - codex CLI and Phone App Can Both Be Down; cursor-agent Is the Working Fallback [MEDIUM]

**Date:** June 2, 2026
**Area:** Process / Review Tooling (codex review fallback ladder)
**Impact:** MEDIUM (avoids blocking the commit gate when the primary reviewer is unreachable)
**Status:** Documented

### Problem or Discovery
The codex iterate-to-GREEN-before-commit gate (L0 rule 1.3) depends on codex review. This session
hit a state where BOTH codex CLI (the chatgpt.com backend) AND the codex iPhone app were down at
the same time -- so the usual rung 1 (CLI) and the usual owner-run rung 2 (phone) were both
unavailable.

### Root Cause or Context
The codex CLI and the phone app share the same chatgpt.com backend, so a backend outage takes out
both at once. Treating the phone as an independent fallback for the CLI is therefore unreliable
during a backend outage -- they fail together.

### Solution or Pattern
Drop to fallback ladder rung 4, cursor-agent, which uses a different backend:
```
& 'C:\Users\jasen\AppData\Local\cursor-agent\agent.ps1' --print --mode ask -f --model gpt-5.3-codex-xhigh "<prompt>"
```
The `-f` flag trusts the current worktree directory (needed so it can read the diff). After ANY
non-CLI fallback (cursor-agent or Opus adversarial), still append the artifact + verdict +
disposition to the codex re-review queue and re-confirm with codex CLI once the backend recovers
(per L0 rule 1.3 codex-fallback ladder).

### File References
- L0 rule 1.3 (codex-fallback ladder) in `C:/Projects/CLAUDE.md`
- Re-review queue: `C:/Users/jasen/.claude/projects/C--Projects-Regulatory-Review/memory/codex_rereview_queue_2026_05_17.md`

### Key Takeaway
codex CLI and the codex phone app share a backend and can be down simultaneously -- they are not
independent fallbacks. cursor-agent (ladder rung 4, different backend) is the working fallback:
`& 'agent.ps1' --print --mode ask -f --model gpt-5.3-codex-xhigh "<prompt>"`. Always queue the
fallback verdict for codex re-confirm when the CLI recovers.

---

## 2026-06-04 - Promoting a Catalog qa_status Is Coupled; the Supabase Review Path Is Audit-Only [HIGH]

**Date:** June 4, 2026
**Area:** Matrix Options catalog / QA-review provenance
**Impact:** HIGH (a naive qa_status edit RED's CI; the "approve in the UI" path does not actually promote)
**Status:** Documented (apply tool + structural test shipped; the flip itself is owner-gated)

### Problem or Discovery
The #249 packet listed 20 EPA-IRIS rows to consider promoting from `qa_status=needs_review` to
`approved` in `human_health_trv_values.json`. A bare find-replace of `qa_status` is unsafe two ways:
it turns CI RED, and the dashboard's "approve" button does not make the promotion take effect.

### Root Cause or Context
1. `catalog.test.ts` couples `qa_status`: it asserts every `evidence_items[].qa_status` equals the
   record's, AND that any `approved` evidence has a truthy `reviewed_by` + a dated `reviewed_at`
   (and a non-pending locator, non-scaffold method). So a flip must also flip evidence qa and add
   reviewer attestation.
2. The "catalogs ... TRVs" test froze the verified batch as a hardcoded `toHaveLength(84)` + fixed
   substance set + a property loop requiring `canonical_source_status === 'direct_source_verified'`
   and evidence `extracted_at === '2026-05-23'`. The 20 candidates are TRV-tagged human-health
   `approved_source_backed` rows extracted later and still `needs_direct_source_check`, so promoting
   them joined that filter and broke it on count, substances, canonical status, and dates.
3. The Supabase `parameter_value_reviews` path (`qa-review-sync.ts submitReview`) writes a review
   HISTORY row only -- there is no overlay that reflects the latest review's `qa_status` onto the
   displayed/effective value, and the table is not created by any committed migration. So the repo
   JSON is the effective source of truth; clicking "approve" records an audit row but does not promote.

### Solution or Pattern
- Replace the brittle frozen-count assertion with a STRUCTURAL invariant: identify the original batch
  by a stable predicate (`direct_source_verified` AND every evidence `extracted_at === '2026-05-23'`)
  and keep its exact 84-count/substance/provenance checks; in a second test, constrain ANY approved
  TRV beyond that batch to be a well-formed, source-backed, HITL-attested IRIS row whose
  `canonical_source_status` is in `{direct_source_verified, needs_direct_source_check}`. This is green
  before the promotion (empty set) and after (the 20), in either canonical variant.
- Apply the coupled edit with a deterministic, fail-closed, idempotent OWNER-run tool
  (`scripts/matrix-options/apply-qa-promotion.mjs`) that touches only the 20 ids, re-checks each value
  against the EPA snapshot, and stamps the owner's reviewer id + date. AI never writes `qa_status`.

### File References
- `src/lib/matrix-options/provenance/__tests__/catalog.test.ts` (frozen-batch + promoted-constraint tests)
- `scripts/matrix-options/apply-qa-promotion.mjs` + `scripts/matrix-options/__tests__/apply-qa-promotion.test.mjs`
- `matrix_research/reference_catalog/iris_qa_promotion_apply_sheet_2026_06_04.md` (the apply sheet)
- `src/lib/matrix-options/provenance/qa-review-sync.ts` (audit-only review history)

### Key Takeaway
A catalog `qa_status` promotion is not a find-replace: flip evidence qa in lockstep, add reviewer
attestation, and replace any frozen-count test with a structural invariant that tolerates the
sanctioned change. And know your write surface: the Supabase review path here is audit-only, so the
repo JSON is the effective source of truth for `qa_status`.

---

## 2026-06-08 - AGY Autonomous Subagent: Settings, Permissions, and Orchestration Pattern [HIGH]

**Date:** June 8, 2026
**Area:** Agentic OS / autonomous subagent orchestration
**Impact:** HIGH (defines the safe, reproducible pattern for unattended AGY runs; avoids stalls and off-script subagent behavior)
**Status:** Documented

### Problem or Discovery

Running AGY (Antigravity CLI) as an autonomous subagent requires several non-obvious setup and
orchestration steps. Getting any of them wrong causes either a silent stall or off-script behavior
(e.g., the subagent running gates or opening PRs instead of just committing).

### Root Cause or Context

1. AGY reads settings.json exactly once at launch. A running session never reloads it.
   Changing the file while AGY is running has no effect.
2. Headless `agy -p` is the only mode with no interactive plan-approval gate and no
   per-command prompts. Other invocation modes block waiting for user input.
3. Sonnet ship-subagents scope-crept twice: they ran gates and codex review instead of
   just "edit + commit", and left work committed-but-unpushed. Subagent claims about push
   and PR state must always be verified directly.

### Solution or Pattern

**AGY safe-autonomous permission pattern:**
- Allow all commands with `command(*)`.
- Deny list in `~/.gemini/antigravity-cli/settings.json`: force/mirror push, `gh pr merge`,
  `gh api`, `git worktree remove`, `fsutil`, `mklink`, `npm ci`, `npm install`, recursive
  deleters, and system-admin commands.
- Orchestrator PRE-CREATES the worktree and node_modules junction (`mklink`) before handing
  off to AGY (both are on the deny list for the subagent).
- Deliver task briefs to AGY via `.tmp` files; never rely on inline long prompts.
- After any AGY closeout, verify every claim directly (grep the files; never trust the
  subagent's self-report). Finish push/PR/merge in the main orchestrator session.

**Ship-subagent scope rule:** scope ship-subagents to "edit + commit only". Push, PR, and
merge always happen in the main session so the orchestrator can verify gate status and
push/PR state before proceeding.

### Key Takeaway

Restart AGY after every settings.json change (it reads once at launch). Use `agy -p` for
unattended runs. Pre-create worktrees and junctions before the subagent starts. Scope
ship-subagents to commit-only; do push/PR/merge in the main session after direct verification.

---

## 2026-06-08 - Vercel OOM: engines.node Range Causes Vercel to Pick Node 24, Causing SIGKILL [HIGH]

**Date:** June 8, 2026
**Area:** Deployment / Vercel / CI-CD environment mismatch
**Impact:** HIGH (deploy fails silently with SIGKILL on Vercel 8 GB machine; push-protocol
Production Build gate on GitHub Actions 16 GB cannot catch it)
**Status:** Fixed (PR #270 verified READY on Vercel)

### Problem or Discovery

A Vercel production deploy OOMed (SIGKILL) during next build lint+typecheck phase. The push-
protocol Production Build gate had passed (GitHub Actions, ~16 GB) and the local build had passed,
so the failure was invisible until the deploy itself ran.

### Root Cause or Context

Two compounding issues:

1. `package.json` `engines.node` was `">=20.0.0"` (a version range). Vercel reads this field and
   picks the newest available major matching the range. With Node 24 available, Vercel overrode
   the project's configured "22.x" Node version and ran the build on Node 24.
2. Node 24 increased memory footprint in `next build` lint+typecheck phase exceeded Vercel's
   8 GB build machine limit, producing a SIGKILL.

The GitHub Actions build machine has ~16 GB; our gate runs there. Vercel deploy machines have
8 GB. This environment mismatch means the gate CANNOT catch Vercel-only OOM failures.

### Solution or Pattern

Two changes, both verified with a deploy READY result:

1. Pin `engines.node` to `"22.x"` (exact major, not a range). Vercel picks the pinned major and
   does not escalate to a newer Node version.
2. Set `eslint.ignoreDuringBuilds: true` in `next.config.ts`. This removes the lint phase from
   `next build`, reducing peak memory. The `eslint .` step in CI still runs lint on every PR.

**Do NOT disable TypeScript build checks.** `next typegen` + CI `tsc --noEmit` do NOT generate
the per-page `.next/types/app` route guards that a full `next build` does. Disabling the
typecheck opens a real type-safety gap that tsc alone cannot catch.

**Fallback if OOM recurs:** Vercel Enhanced Builds (larger machine), not disabling the typecheck.

### File References
- `package.json` (`engines.node`)
- `next.config.ts` (`eslint.ignoreDuringBuilds`)

### Key Takeaway

Pin `engines.node` to a specific major (`"22.x"`) not a floor range (`">=20.0.0"`). A range lets
Vercel pick the newest available Node, which can OOM on the 8 GB build machine. Add
`eslint.ignoreDuringBuilds: true` to reduce build memory; CI `eslint .` covers the gap. Never
disable the TypeScript build check: `tsc --noEmit` misses per-page route type guards that only
`next build` generates.

---

## 2026-06-08 - codex-review Discipline: Opus Adversarial Leg-1 Always First [MEDIUM]

**Date:** June 8, 2026
**Area:** Process / codex-review discipline (L0 rule 1.3)
**Impact:** MEDIUM (prevents whack-a-mole codex loops; surfaces holistic issues earlier)
**Status:** Documented (updated review discipline added to L0 1.3)

### Problem or Discovery

After ~5 rounds of targeted codex review on a single PR, the session was still finding and fixing
individual findings without converging. Codex was acting as a whack-a-mole linter rather than a
holistic reviewer.

### Root Cause or Context

The review sequence was codex-first, Opus-second. Codex in targeted mode finds specific line-level
issues well but can miss systemic or architectural patterns. Running codex first means the first
~5 rounds are often fixing individual symptoms rather than understanding the design.

### Solution or Pattern

Updated codex-review discipline (2026-06-08):

1. **Leg-1 always first:** Opus reviewer subagent adversarial loop (3 lenses: correctness,
   architecture, security). Run this BEFORE any codex round.
2. **Leg-2 after Leg-1:** codex Spark grind until Spark GREEN, then gpt-5.5 xhigh ship gate.
3. **Three modes:** targeted (specific change), strategic (PR-level), holistic (branch audit).
4. **Escalation trigger:** after ~5 whack-a-mole codex rounds with no convergence, escalate to
   an informed Opus holistic pass (show Opus the diff AND prior codex findings).
5. **Skip rubric:** skip Leg-1 only per the explicit rubric (docs-only, trivial mechanical fix)
   and state the reason.

### Key Takeaway

Run Opus adversarial Leg-1 BEFORE codex Leg-2 on any substantive change. ~5 whack-a-mole codex
rounds without convergence is the escalation trigger for an informed Opus holistic pass.

---

## 2026-06-08 - Junction-Safe Worktree Teardown: Verify Count Before and After [HIGH]

**Date:** June 8, 2026
**Area:** Git worktree / node_modules junction cleanup (L0 rule 1.15)
**Impact:** HIGH (recursive delete on a junction empties the shared node_modules store; this guard
prevented data loss and correctly identified one real-copy worktree)
**Status:** Documented

### Problem or Discovery

Worktree teardown with a node_modules junction requires explicit junction removal before any
recursive delete. Getting the sequence wrong empties the shared node_modules store for the entire
project (happened twice on 2026-05-30 and 2026-06-01).

### Root Cause or Context

- Junctions (Windows reparse points) are followed by recursive deleters. `Remove-Item -Recurse`,
  `rm -rf`, and `git worktree remove` all follow the junction and delete the shared target.
- One worktree (m1b-wizard) had a REAL node_modules directory (not a junction). Running
  `fsutil reparsepoint delete` on a real directory errors "not empty". The guard must detect
  this case and skip fsutil, removing the real copy via `git worktree remove` instead.

### Solution or Pattern

Junction-safe teardown sequence (per L0 rule 1.15):

1. Capture shared node_modules dir count: `(Get-ChildItem <shared>/node_modules).Count`.
2. For each worktree to remove:
   a. Attempt `fsutil reparsepoint delete "<wt>\node_modules"`.
   b. If it errors "not empty" -> real copy (not a junction); skip fsutil, proceed to step c.
   c. Verify the shared node_modules count is UNCHANGED. ABORT if count changed.
   d. `git worktree remove <wt>` (now safe; junction already gone or real copy will be removed).
3. After all removals: `git worktree prune`.

Never run `Remove-Item -Recurse` or `git worktree remove` before the junction is confirmed deleted.

### File References
- L0 rule 1.15 (`C:/Projects/CLAUDE.md`)
- `[[feedback-never-remove-item-recurse-on-junction]]`

### Key Takeaway

Capture the shared node_modules count BEFORE, delete each junction with fsutil, re-verify the
count is UNCHANGED (abort if changed), THEN git worktree remove. If fsutil errors "not empty",
the entry is a real copy; skip fsutil and remove directly.

---

**Last Updated:** June 8, 2026 (AGY autonomy pattern, Vercel OOM fix, Opus-first review discipline, junction-safe teardown)
**Lesson Count:** 2026-06-08 added 4 (3 HIGH, 1 MEDIUM); prior totals not re-tallied.
**Security Status:** Phase 2 COMPLETE - All 5 tasks done, 3 critical vulnerabilities fixed, 6 security headers added
**Refactoring Status:** TWGReviewClient Phase 2 COMPLETE (deployed, enables Phase 3 lazy loading)
**Maintained By:** Claude Sessions with /update-docs skill
