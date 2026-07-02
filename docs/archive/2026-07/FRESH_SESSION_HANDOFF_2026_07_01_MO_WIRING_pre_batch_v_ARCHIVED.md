# FRESH SESSION HANDOFF -- Matrix-Options Substance-Wiring Lane
Date: 2026-07-01

## STATUS

MO substance-wiring lane: 15 batches (G through U) merged to main. 249 substances wired.
`SUBSTANCE_LIBRARY` count 119 -> 368. Manifest `vitest_test_count` -> 4802. PRs #418-#432.

BN-RRM lane is CLOSED (separate lane; see memory anchor
`[[dashboard_bnrrm_fullcorpus_loaded_2026_06_30]]`). Do not resume BN-RRM work from this
handoff -- it is a different lane with its own memory anchor.

## SOURCE OF TRUTH

Read the memory anchor `dashboard_mo_wiring_lane_2026_06_30` FIRST:
`C:\Users\jasen\.claude\projects\C--Projects-sstac-dashboard\memory\dashboard_mo_wiring_lane_2026_06_30.md`

It has the full method (recon source, per-batch AGY brief pattern, entry conventions,
key lessons, efficient division of labor, roadmap). This handoff is the quick-start
pointer, not a replacement.

## NEXT ACTION (copy-paste ready)

Dispatch a SELF-DIRECTED SONNET ship-agent for "Batch V". Set `model: "sonnet"`
EXPLICITLY on the dispatch -- it does not inherit Opus by default and this is
mechanical, budget-sensitive work.

Batch V scope: continue ~20 clean unwired candidates, alphabetically AFTER
`strychnine` (the last key wired in Batch U), sourced from
`scripts/matrix-options/_recon/wire_candidates.json`. Base state to verify before
starting: current main `SUBSTANCE_LIBRARY` count and manifest `vitest_test_count`
(expected 368 / 4802 when V starts -- re-read both from main if this handoff is stale).
Follow the memory anchor's PER-BATCH METHOD, ENTRY CONVENTIONS, and KEY LESSONS
sections exactly: author the 3-file diff via AGY (Gemini 3.1 Pro High) -> verify
inline against the catalog (git diff scope, grep each rfd/sf back to
`_recon/wire_candidates.json`, `tsc --noEmit`, `CI=true npm run test:ci`) -> codex
gpt-5.5 xhigh gate to mutual-agreement GREEN -> path-scoped commit -> all 4 push
gates (lint / test:ci / monitored build / e2e) run FOREGROUND -> push -> open PR ->
hand back the PR# and STOP. Do not poll CI and do not merge -- the dispatching
session does the cheap CI-poll+merge (including the `write EPIPE` self-healing
rerun if it hits).

Example dispatch: "You are a self-directed Sonnet ship-agent continuing the
matrix-options substance-wiring lane. Read the memory anchor
`dashboard_mo_wiring_lane_2026_06_30` for full method and conventions. Branch off
updated main as `feat/mo-batch-v-<name>`. Select ~20 clean candidates from
`scripts/matrix-options/_recon/wire_candidates.json` alphabetically after
`strychnine`, applying the EXCLUDE/WATCH rules below. Brief AGY to author the
substanceLibrary.ts entries + Batch-V describe-block + manifest vitest-count bump,
verify against the catalog, run the codex gate to GREEN, commit, run all 4 push
gates in the foreground, push, and open the PR. Hand back only the PR number and
stop -- do not poll CI or merge."

## EXCLUDE / WATCH

- Exclude inorganic / elemental / metal-salt / oxide / cyanide-salt /
  phosphine-phosphide / oxyanion DBP ions (chlorite, bromate, nitrate, etc.).
- Exclude inhalation-only candidates UNLESS they have a genuine oral RfD row
  (some display_names say "inhalation" but do carry an oral RfD -- e.g.
  `1_1_1_trichloroethane` -- keep those; verify the input_key, don't go by name).
- Dual-source substances (SF source_id differs from RfD source_id): cite BOTH
  source_ids in the `sources` string, per endpoint.
- PAH-class candidates: `abs_dermal` 0.13, `contaminantClass` organic-PAH
  (not the 0.1 generic default).
- Salt-counterion halogen compounds (e.g. mepiquat, paraquat precedent): class
  as `organic`, not `organic-halogenated`, when the halogen is a counterion salt
  rather than a ring/chain substituent.

## HITL-DEFERRED (owner judgment needed before wiring)

- PCBs: `pcbs_non_coplanar` / `polychlorinated_biphenyls_pcbs` -- overlaps with
  the existing `total_pcbs_aroclor_1254` entry; needs owner call on how to
  differentiate or whether to skip.
- `phenylmercuric_acetate` -- organomercury class; confirm handling before wiring.
- `diquat` and `fosetyl_al` -- class calls kept as `organic`; confirm.

## PROCESS LESSONS

- (a) Always set `model: "sonnet"` explicitly on ship-agent dispatches. Omitting
  it inherits Opus and burns the wrong budget.
- (b) Sonnet ship-agents sometimes stall right after `git commit` -- the turn
  ends before push/PR runs. When this happens, verify the commit is real, run
  the remaining gates and push/PR yourself. Do NOT start a parallel takeover
  agent -- it races against the stalled one (this happened on Batch S).
- (c) CI E2E spawns late (after the build check) and occasionally hits the
  vitest sharded-coverage `write EPIPE` flake (OOM class). Fix:
  `gh run rerun <run-id> --failed` (re-triggers downstream checks too).

## REMAINING

Roughly 80-100 clean candidates left in the recon set -- about 4-5 more ~20-item
batches (Batch V onward) to finish the lane.
