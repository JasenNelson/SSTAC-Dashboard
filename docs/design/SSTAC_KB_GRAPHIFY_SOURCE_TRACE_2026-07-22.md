# SSTAC-Dashboard Graphify / KB-wiki -- source trace + instruction lineage (2026-07-22)

Status: EVIDENCE PACKET (docs-only). Answers the owner's reframed question: "find the original
instructions for SSTAC's KB-wiki/Graphify setup; do not reason post-hoc; compare to OpenHarness-dev
(OHD); what is actually left." Grounded in a read-only trace of SSTAC (`origin/main` + the full
untracked local file set + git history) and OHD, carried out by a dedicated discovery subagent
2026-07-22, plus a follow-up cross-check pass in this worktree.

Scope: **SSTAC-Dashboard's own** `tooling/wiki` Graphify/LLM-wiki pilot. This is a companion to
`docs/design/GRAPHIFY_KB_WIKI_PHASE_STATE_AUDIT_2026-07-22.md` (phase-by-phase landed/unlanded state)
and `docs/design/GRAPHIFY_KB_ROW10_BUILD_RECEIPT_2026-07-22.md` (the guarded-build run evidence). Those
two docs establish WHAT is landed; this doc establishes WHERE the instructions that define "complete"
came from and confirms nothing fuller is missing.

## 1. Headline

There is **no separate, undiscovered, fuller SSTAC KB/Graphify instruction document**. A discovery
subagent grepped `origin/main` and all locally-present untracked files for every relevant keyword
(graphify, wiki, KB, sync-wiki, session_bootstrap, promotion, ledger, and related terms). The result:
**`~/.claude/plans/jolly-marinating-piglet.md` (698 lines) IS the complete, authoritative SSTAC
instruction set.** It is not a stub or a partial artifact -- it contains:

- Section 5: all 8 phases (0 through 7), each with goal, concrete steps, and acceptance thresholds.
- Section 6: a file-by-file OHD -> SSTAC port map (`tooling/wiki/` script correspondence).
- Section 7: config artifacts reproduced verbatim (the exact `.graphifyignore` content, the exact
  `requirements-graphify.txt` pin, the exact `.claude/settings.json` hook JSON planned for Phase 6, and
  the exact `claude mcp add ... graphify` command planned for Phase 6).
- Section 10A: execution operating mode + resilience artifacts, added specifically to comply with the
  cross-project L0 sections 1.20/1.21 autonomy-mode rules.

The phase-state audit (`GRAPHIFY_KB_WIKI_PHASE_STATE_AUDIT_2026-07-22.md`) reconciled the landed code
against this plan phase-by-phase and found the plan's own file-by-file port map and config artifacts
match the shipped commits line-for-line (`.graphifyignore`/`.gitignore` match plan section 7;
`requirements-graphify.txt` pins the plan's exact `graphifyy[sql,mcp]==0.9.17`). That reconciliation was
possible only because the plan already contains the full target state -- it was not post-hoc guessing
against a partial document.

## 2. Origin chain (the real instruction lineage)

All ancestor documents live in `C:\Projects\OpenHarness-dev` (OHD), which is the canonical origin
project for this framework (see section 3 for why RR is not an ancestor). The lineage, in order:

1. `docs/design/PHASE_D_KNOWLEDGE_BASE_SPEC_2026_07_04.md` -- the root spec: hybrid LLM-wiki + Graphify
   + a self-learning extension for autonomous graph-based agent learning.
2. `docs/GRAPHIFY_TOOLCHAIN_REPORT_2026_07_04.md` -- the toolchain dry-run, validated against a scratch
   clone of SSTAC's own `src/` (i.e. OHD's own validation pass already used SSTAC as its proving
   ground, which is why the port back to SSTAC was low-friction).
3. `docs/FOLLOWUP_PLAN_2026_07_06.md` section 7, Decision B -- the explicit decision to **port the
   proven mechanics to SSTAC and Regulatory-Review** rather than keep investing further in OHD's own
   in-repo KB.
4. `docs/RELIABILITY_REVIEW_2026_07_10.md` -- the "porting checklist for SSTAC + RR" section: a
   DO-NOT-PORT-UNTIL gate (watchdog, timeouts, and a safe-rebuild runbook must exist first). The port
   proceeded later per an explicit owner go-ahead on 2026-07-16.
5. `docs/SESSION_FRAMEWORK_AND_DECISIONS_2026_07_06.md` -- the sessionstart-ritual rationale that later
   became the SSTAC `/sessionstart` skill's design basis.

These five documents were synthesized directly into SSTAC's `~/.claude/plans/jolly-marinating-piglet.md`,
which is therefore a derived-but-complete artifact, not a truncated one. No SSTAC-side "early
instructions" document was found that is fuller than, or an ancestor to, this plan -- the plan itself
is the terminus of the lineage, one level removed from the OHD origin docs.

## 3. Regulatory-Review comparator

The owner flagged that "RR KB-wiki instructions" also exist and asked whether they might be a source
of additional, interchangeable instructions for SSTAC. A read-only comparator survey of
`C:\Projects\Regulatory-Review` (and its ~100 worktrees) found:

- RR has landed **nothing** graphify/KB-wiki related: no `tooling/wiki/` directory, no `.graphifyignore`,
  no wiki-related skills, hooks, or scripts, and zero graphify-related commits across `git log --all`
  in the RR repo or any of its worktrees.
- RR's entire footprint on this topic is **one off-repo instruction document**:
  `~/.claude/plans/rr-kb-wiki-adoption-plan.md` (v2.0 FINAL, dated 2026-07-17, codex-GREEN, Phases
  0-3.5 approved, kickoff pending).
- That RR plan is itself a **fork of SSTAC's own plan** (`jolly-marinating-piglet.md` v1.19), adapted
  for the RR project. RR is at Phase -1 (pre-kickoff) -- strictly earlier in the lifecycle than SSTAC,
  which has landed through Phase 3 code (see the phase-state audit).

**Conclusion:** there is nothing to port FROM RR into SSTAC. The direction of derivation runs the
other way (SSTAC -> RR), so RR cannot hold a fuller or earlier version of the SSTAC instructions. RR's
plan is useful only as a **later-vintage adversarial review** of the same underlying design -- its
authors ran a fresh round of scrutiny against the forked plan on 2026-07-17 and surfaced a set of
candidate hardening findings. Those findings are independent of instruction lineage (they are review
findings, not instructions) and are cross-checked against SSTAC's current landed state in the companion
gap-analysis doc (`OPENHARNESS_TO_SSTAC_KB_GAP_ANALYSIS_2026-07-22.md`, section on later-vintage
RR-plan findings), not here.

## 4. What SSTAC's "incompleteness" actually is

Given the instruction lineage above is complete and was followed faithfully through Phase 3, the
remaining gap is fully accounted for by the plan's own design, not by drift:

- **(a) The Phase 3.5 go/no-go decision was never recorded.** Section 267 of the plan
  (`### Phase 3.5 -- MID-PILOT GO/NO-GO (hard owner gate; STOP-HERE IS THE DEFAULT)`) requires an
  explicit owner decision before any Phase 4+ work proceeds. No commit or file in the repo records
  that decision having been made either way.
- **(b) Phases 4 through 7 are correctly, deliberately gated behind (a).** The plan's own text makes
  STOP-HERE the default outcome absent an affirmative owner override on three simultaneous conditions
  (healthy graph-quality metrics, demonstrated real-task usefulness of the Phase 3 wiki, and an owner
  re-affirmation of priority versus the Matrix Options flagship lane). None of Phases 4-7 being unlanded
  is evidence of drift, lost instructions, or an incomplete port -- it is the plan working as designed.

Nothing was dropped, forgotten, or lost between the OHD origin docs and the current SSTAC state. On
the instruction-lineage / phase-gate question this trace answers, the only genuinely outstanding item
is the Phase 3.5 owner decision itself, which this trace does not attempt to resolve (see the
companion gap-analysis doc's Phase 3.5 section, and the phase-state audit's section 5 owner decision
packet, for that decision's inputs). Separately, the gap-analysis doc's cross-check identifies two
Phase-0-3.5-safe HARDENING gaps in already-landed config (findings 1 and 2: json-as-code exclusion
and full doc-extension blanket exclude in `.graphifyignore`) -- those are candidate follow-up work
within the approved scope, not lost instructions, and do not depend on the Phase 3.5 gate.

## 5. References

- `docs/design/GRAPHIFY_KB_WIKI_PHASE_STATE_AUDIT_2026-07-22.md` -- phase-by-phase landed/unlanded
  state, drift findings D1-D3, and the Phase 3.5 owner decision packet.
- `docs/design/GRAPHIFY_KB_ROW10_BUILD_RECEIPT_2026-07-22.md` -- guarded graph build + wiki compile +
  ledger seed run receipt (resolves "did it actually build" independent of instruction lineage).
- `docs/design/OPENHARNESS_TO_SSTAC_KB_GAP_ANALYSIS_2026-07-22.md` -- companion doc: OHD component
  inventory, the SSTAC gap table, and the later-vintage RR-plan findings cross-check.
- `docs/SESSIONSTART_PORT_BRIEF_2026_07_06.md` -- the one OHD -> SSTAC correspondence artifact that
  survives verbatim, scoped to the `/sessionstart` skill port specifically. NOTE: at the time of this
  doc it is a local-only untracked file being committed as durable provenance by a SEPARATE in-flight
  PR (`docs/sessionstart-port-brief-provenance-2026-07-22`); it is not on this branch.
- `~/.claude/plans/jolly-marinating-piglet.md` -- the authoritative SSTAC plan (outside this repo, per
  the L0 AGY-workplan convention of keeping autonomous-run plans off-repo).
- PR #731 (`/sync-wiki` skill), #732 (phase-state audit), #733 (D1 guardrail fix), #734 (Row 10 build
  receipt) -- the commit chain this trace reconciles against.
