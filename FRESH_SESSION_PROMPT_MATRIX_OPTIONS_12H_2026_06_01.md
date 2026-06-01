# Fresh-session takeover prompt -- Matrix-Options work lane (12h autonomous)

Paste the section below the line as the first message of a FRESH session. Owner will grant
plan mode + ultracode effort. The owner is away for ~12 hours; you run autonomously.

---

## PROMPT (paste below this line)

You are taking over the Matrix-Options work lane on the SSTAC Dashboard
(`C:\Projects\SSTAC-Dashboard`) for a ~12-hour autonomous run. Owner is away. Start in PLAN
MODE: read the orientation docs, build a prioritized 12h plan, then execute as much as you
can autonomously. Ship DRAFT PRs only; never merge; never paste to Supabase (owner actions).

### READ FIRST (orientation -- in this order)
1. `MATRIX_OPTIONS_PROGRAM_PLAN_REBASELINED_2026_05_31.md` -- the current program map (4 streams,
   8 tabs, 2026-vs-2027 scope, what shipped, what is next). THIS IS THE STEERING DOC.
2. `MATRIX_OPTIONS_REFS_VALUES_JSON_HANDOFF_2026_05_31.md` -- catalog state, the generator, the
   IRIS allow-list, deferred items, per-PR detail.
3. `MATRIX_OPTIONS_P2_DEDUP_FIX_SPEC_2026_05_31.md` -- the one open code task (executable spec).
4. L0 `C:\Projects\CLAUDE.md` (esp. rules 1.1 ASCII, 1.15 worktree-not-checkout-b, 1.16
   tool-batch anti-cascade), L1 `C:\Projects\SSTAC-Dashboard\CLAUDE.md`, `docs/GATE_MODE_SOP.md`.
5. Memory `MEMORY.md` + the dashboard memories it links (IRIS-validate-vs-EPA, always-normalize-
   units, tool-batch-anti-cascade, always-show-consolidated-gate-block).

### LIVE STATE AT HANDOFF (verify with `gh pr list` + `git worktree list` before trusting)
- main tip `a2b009b`. Draft PRs on origin (References & Values catalog expansion, JSON-first):
  - #214 PR1 (generator + new source record + 213 P28 HH-soil TRVs), base main.
  - #217 PR2 (34 validated IRIS TRVs + expanded EPA snapshot), base PR1.
  - #215 PR3 (107 Health Canada TRVs), base PR1.
  - #216 PR4 (124 P28 water/vapour TRVs), base PR1.
  - #218 integrated single-merge (586 records), base main. Codex holistic = YELLOW (the P2 below).
  - #213 (expanded IRIS snapshot) is REDUNDANT -- #218 absorbed it.
- The generator `scripts/matrix-options/generate-catalog-records.mjs` is on the PR branches
  (not yet on main). Extracted payloads are in the SHARED checkout `.tmp/catalog-paste/`.
- Uncommitted on the main checkout (intentional handoff artifacts, NOT yet committed): the four
  root docs above + `docs/LESSONS.md` + `docs/_meta/docs-manifest.json`. Decide whether to commit
  them (docs-only) early in your run so they are durable; path-scoped staging only, and note
  `docs/LESSONS.md` also carried a PRIOR session's lessons -- inspect its diff before staging.
- The Guide has 2 factual edits on branch `feat/matrix-options-guide-update-2026-05-31` (worktree
  `guide-update-2026-05-31`) HELD for owner content review -- do NOT merge; you may extend the
  draft but it stays pending owner sign-off.

### TASK PRIORITY (do in order; each is independent enough to skip if blocked)

**T1 (DO FIRST) -- P2 dedup fix -> take #218 from YELLOW to GREEN.**
Execute `MATRIX_OPTIONS_P2_DEDUP_FIX_SPEC_2026_05_31.md` exactly. Summary: 25 duplicate
candidate-tuple groups -> 15 collapse (same value), 8 keep with a basis-disambiguated 5-part
candidate_group_id (BaP endpoints / cadmium media / methylmercury populations + food pairs), 2
exclude as dirty extractions and report for HITL adjudication. Add a guard test. Fix the 2 stale
P3 test comments. Regenerate the catalog clean off main, 4 gates GREEN, ITERATIVE codex review to
GREEN, force-push onto #218's head in place. JUDGMENT BOUNDARY: AI never picks which regulatory
value wins; collapse only identical values; exclude only provably-dirty rows; when unsure, KEEP
the candidate. This is the highest-value task: it makes the whole catalog expansion mergeable.

**T2 -- IRIS orphan substances (extend coverage without the owner).**
Per the handoff, several IRIS substances are deferred because they were not in the EPA snapshot or
not in the d0c00011/d0c00013 passes. Extend the EPA canonical snapshot
(`src/lib/matrix-options/provenance/__tests__/epa_iris_canonical_snapshot.json`) from the owner's
EPA Excel `C:\Users\jasen\Downloads\Chemicals_Details (1).xlsx` (CAS-matched, units carried), then
re-run the generator with the newly-covered substances added to the IRIS allow-list. Every added
IRIS value must pass the unit-aware guardrail (within 2% of the snapshot). Ship as a draft PR
stacked appropriately. Do NOT add the known-bad d0c00013 values (BaP SF=1, Cr(VI) SF=0.16,
carbon_tetrachloride IUR=1.5e-5) -- those need the extraction-source fix, not a snapshot change.

**T3 -- Stream A: The Guide update (the 2026 PRIORITY per owner).**
On `feat/matrix-options-guide-update-2026-05-31` (already has 2 factual fixes). Content is
`matrix_research/content_drafts/The_Guide.md`. Refresh it to reflect what shipped (References &
Values now has the multi-source candidate library; scope labels 2026 vs 2027; HITL workflow;
TWG onboarding). Keep it accurate and in the owner's voice. Mark the PR draft + "PENDING OWNER
CONTENT REVIEW" -- do NOT merge (Guide content is owner-facing; the plan's stop-condition forbids
landing Guide changes without owner review). Gate it green so it is merge-ready on approval.

**T4 -- Design specs for the larger deferred work (no code, just plans for owner):**
- Autonomous overnight catalog-enrichment agent (owner-requested): write a design doc -- triggers,
  inputs (Zotero/Docling extraction), STAGING-only output, HITL approval gates, the hard guardrails
  (never auto-promote / auto-approve QA / mutate static JSON). Use the existing extraction pattern
  in `2026_Database_Development/data_acquisition/` as prior art.
- Stream C frame-aware equations: spec how toggling a regulatory frame
  (`src/lib/matrix-options/regulatoryFrames.ts`) should change the calculator math in the four
  `*Calculator.tsx` components. Spec only; flag for owner before implementing (like #199, owner
  wants to eyeball calculator behavior changes).

**T5 -- Eco passes (if time): d0c00005 eco-soil (2305 rows) + d0c00010 EcoSSL (60).**
These map source pathway `eco-soil` to eco calculator pathways non-trivially. Write the mapping
design first; only generate records if the mapping is unambiguous and the eco guardrail story is
clear. If ambiguous, produce the design doc + surface to owner, do not ship records.

DO NOT TOUCH without owner: the d0c00012 TEQ-unit RfD decision; the CCME eco-soil rank-1 source
gap; any Supabase paste; any merge.

### STANDING RULES (load-bearing -- violations caused real waste this session)
- ULTRACODE: author and run workflows / parallel subagents for substantive tasks; be exhaustive;
  adversarially verify. BUT honor the anti-cascade rule: NEVER batch a subagent launch together with
  other tool calls, and never fan out probe fleets -- one failed call in a parallel batch cancels all
  siblings. Serialize uncertain calls. (L0 1.16; this cost many tokens on 2026-05-31.)
- Delegate implementation + verification to Sonnet subagents to protect the orchestrator context;
  Opus orchestrates + synthesizes. ALWAYS pull gate verdicts back and present the consolidated
  4-gate block (lint / unit / build / e2e with pass counts) + commit/push state tied to the pushed
  SHA before calling any PR done -- do not let verdicts stay buried in a subagent transcript.
- codex iterate-to-GREEN before commit (ITERATIVE adversarial loop, argue back with quoted evidence)
  + 4 gates before push (`docs/GATE_MODE_SOP.md`: lint, `test:unit -- --maxWorkers=2`,
  `build:monitored:clean -- -TimeoutSeconds 360`, `test:e2e`). Fallback ladder: codex CLI ->
  cursor-agent (likely out-of-usage until 6/15) -> Opus adversarial subagent + append to the codex
  re-review queue `C:\Users\jasen\.claude\projects\C--Projects-Regulatory-Review\memory\codex_rereview_queue_2026_05_17.md`.
- Worktree, NOT `git checkout -b` in the shared checkout (L0 1.15):
  `git worktree add <path> -b feat/<lane>-<date> origin/<base>`; junction node_modules
  (`cmd /c mklink /J`) + copy `.env.local`. Junction-safe cleanup only (`cmd /c rmdir` then
  `git worktree remove`; NEVER Remove-Item -Recurse a junction).
- Data invariants: units ALWAYS normalized (fail closed); validate regulatory values vs the
  authoritative source (EPA Excel / epa.gov/iris, Protocol 28 PDF, HC TRV v4.0), NEVER AI memory;
  AI NEVER sets a calculator default (`default_status=available_option`, `qa_status=needs_review`);
  JSON-first (no Supabase paste); plain ASCII (<=127); path-scoped git staging only; max 3
  background subagents; detect-orphans before multi-agent ops.

### CADENCE / DONE
- Checkpoint to a dated handoff doc + `MEMORY.md` as you complete each task (not just at the end);
  convert relative dates to absolute. Surface owner-decisions in the handoff -- do not block on them.
- For each shipped draft PR: state the consolidated 4-gate block + codex verdict + commit/push SHA.
- DONE for the run = #218 GREEN and mergeable (T1); plus as many of T2-T5 as cleanly fit, each as a
  gated + codex-reviewed draft PR or a design doc, with a final handoff doc that lists: what shipped,
  what is owner-gated, the merge order, and the next-session priority. Leave the tree clean (no stray
  temp files; worktrees either cleaned junction-safe or listed for owner cleanup).
