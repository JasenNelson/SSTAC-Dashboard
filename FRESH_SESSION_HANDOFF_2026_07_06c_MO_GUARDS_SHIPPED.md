# Fresh Session Handoff -- 2026-07-06c (MO provenance guards shipped; owner-gated lanes teed up)

Supersedes `FRESH_SESSION_HANDOFF_2026_07_06b_CONTINUATION.md` (merged via #523). Plain ASCII.

## What shipped this session (all MERGED to main)

| PR | What | Gate status |
|----|------|-------------|
| #524 | Task A: `EVIDENCE_SUBSTANCE_NAME_MISMATCH` guard (evidence locator cites a different substance than its row) | codex mutual-agreement GREEN; 4 local gates GREEN; GitHub CI GREEN |
| #525 | Task B: extend `CROSS_SOURCE_VALUE_DIVERGENCE` to inhalation + eco pathways; pairwise distinct-source test | codex + cursor-agent GREEN; 4 local gates GREEN; GitHub CI GREEN |
| #522 | zinc/mn ambiguity closure + 3 population/value tension flags (text-only, zero value mutation) | 3rd review pass GREEN; 4 local gates GREEN; GitHub CI GREEN |
| #523 | prior-session handoff doc (07-06b) | docs-only |

Both guards are DETECTION-ONLY (`findings.push`; verified zero catalog value changes). Key correctness
catches fixed during review: Task A missed 19/111 HC locators lacking `Type=` (fixed: dual-format
regex) and same-suffix swaps like Vinyl/Nickel chloride (fixed: generic-token stopwords); Task B
mis-flagged same-source mammal-vs-bird eco TRVs as cross-source (fixed: pairwise distinct-source test).

Live audit now surfaces: EVIDENCE_SUBSTANCE_NAME_MISMATCH = 0 on the catalog (guard is forward-looking);
CROSS_SOURCE_VALUE_DIVERGENCE = 6 genuine flags (arsenic sf 18x, chlorobenzene rfd 22x, dce_1_1 17x,
toxaphene fcv 195x, TCE sf 64x, xylenes rfd 15x) -- all `info`-severity, for HITL review, no mutation.

## Cursor-agent codex backup -- SET UP + DOCUMENTED (codex was ~99% weekly, resets ~7:07pm)

The last two Task B gate rounds + the #522 3rd pass ran on cursor-agent (codex model
`gpt-5.3-codex-xhigh`) to conserve the codex weekly quota. The working recipe (and the two
silent-failure traps) is now documented durably in `C:\Projects\TOOLING_SETUP_FOR_NEW_PROJECT.md`
section B.5, with a pointer added from the `/codex-review` skill. Gist: prompt file MUST be inside the
worktree; run FOREGROUND with `2>&1 | Out-File`; embed the diff inline (ask-mode does not run git);
`--trust` mandatory. Verified working -- returned real RED->GREEN verdicts.

## Owner-gated lanes -- teed up (see docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md)

RE-GROUNDING found the 2026-07-01/07-05 planning docs were ~90% already executed by intervening
sessions. The verified genuinely-open items (nothing applied autonomously):
- **Lane 1 (inorganic cohort): DONE.** 25 inorganic-class substances wired; only `pcbs_non_coplanar`
  + `phenylmercuric_acetate` remain, both policy decisions (PCB grouping / organomercury class).
- **Lane 2 (HC v4.0 re-verification): OPEN, correctness-critical.** HC source page is dead; #518's
  extractor + crosscheck tooling exists to close it. Needs owner to supply the canonical HC v4.0 PDF
  source pointer, then run as a focused lane.
- **Lane 3 (current_default): 18/20 applied.** Open: `dichlorobenzene_1_2` default is IRIS-1989 0.09
  but recency rule wants HC-2025 0.43 (REAL inconsistency -- owner call on newer-but-less-protective);
  `total_pcbs_aroclor_1254` (PCB-gated). Confirm-after-fact: cadmium 0.0008 + methylmercury 0.0002
  (applied despite a hold flag; picks look right). HELD: benzo_a_pyrene.

The 5-row "what the owner must decide" table is at the bottom of the decision doc.

## Worktree cleanup (PENDING owner confirm -- junction-first, L0 1.15)

Two now-merged worktrees to clean (remove node_modules JUNCTION FIRST via `fsutil reparsepoint delete`,
verify shared store intact, THEN `git worktree remove` + prune -- NEVER `Remove-Item -Recurse` with the
junction in place):
- `C:\Projects\SSTAC-Dashboard-worktrees\cas-name-guard-2026-07-06` (branch merged via #524)
- `C:\Projects\SSTAC-Dashboard-worktrees\divergence-extend-2026-07-06` (branch merged via #525)
The `ambiguous-metadata-2026-07-06` worktree (#522) is also merged and cleanable.

## Resume pointers

1. If acting on owner decisions: start from `docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md`.
2. Highest-value engineering lane: Lane 2 HC v4.0 re-verification (needs the PDF source pointer first).
3. Local main is current at the #522 merge. A stash `stash@{0}` holds stale pre-pull 07-04
   LESSONS/NEXT_STEPS dup (already on origin) -- safe to drop.
4. codex weekly resets ~7:07pm 2026-07-06; prefer codex CLI again after reset, cursor-agent backup
   otherwise (TOOLING_SETUP B.5).
