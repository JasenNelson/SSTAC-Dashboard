# PCB HH RfD default -> Health Canada 1.0e-5 -- APPLY PREP (owner-gated, 2026-07-16)

STATUS: PREPPED + STOPPED. Nothing applied. Owner runs the one `--apply`; AI never does.
Branch `feat/pcb-hh-default-2026-07-16` off `origin/main` c21ab08.

## Decision (owner/QP, 2026-07-16)
Make the **Health Canada non-dioxin-like PCB oral RfD (1.0e-5 mg/kg-bw/day)** the human-health
`current_default` for `total_pcbs_aroclor_1254`, replacing the legacy unsourced scaffold default (2.0e-5).

Basis (all verified):
- More conservative (half the RfD).
- **Newer:** HC TRVs v4.0 crystallized 2025-10-15; the IRIS Aroclor-1254 RfD (2e-5) was **last updated
  1994-10-01** (confirmed on iris.epa.gov). The Protocol-1 "EPA when newer/more-defensible" exception
  does NOT apply -- EPA is 31 years older.
- Higher source tier (HC > US EPA in Protocol 1).
- Intended-application check FAVORS it: HC is scoped to **non-dioxin-like** PCBs and dl-PCBs route
  through the separate **TEQ pathway (row #23)** -- so HC-non-coplanar-as-Total-PCBs-default is the
  non-double-counting decomposition (the IRIS Aroclor-1254 total-surrogate would risk double-counting
  the dioxin-like fraction against TEQ).

DEPENDENCY TO CARRY FORWARD: because the non-coplanar RfD excludes dioxin-like toxicity, the dl-PCB TEQ
pathway (**row #23**) becomes load-bearing for completeness of PCB HH assessment. (HC labels its value
"provisional".)

## What the `--apply` does (ONE atomic, fail-closed operation across two catalog files)
- PROMOTE `pv-hc-pcb-hh-direct-rfd-nondioxin` + `pv-hc-pcb-hh-food-rfd-nondioxin`:
  `available_option -> current_default` (value 1e-5 unchanged), in `human_health_trv_values.json`.
- DISPOSE the 2 legacy scaffolds `pv-pcb-hh-direct-rfd` + `pv-pcb-hh-food-rfd` (the unsourced 2e-5
  `src-current-calculator-design-v1` rows that currently hold `current_default`):
  `current_default -> available_option` AND `qa_status needs_review -> superseded` (top-level + nested),
  in `parameter_values.json`. (Mirrors the copper-#18 scaffold disposal you approved.)
- Result: exactly one `current_default` per (substance,input,pathway) tuple = the HC row. IRIS
  Aroclor-1254 rows stay `available_option` (unchanged).

## OWNER COMMAND (run in this worktree)
```
cd C:\Projects\SSTAC-Dashboard-worktrees\pcb-hh-default-2026-07-16
node scripts/matrix-options/promote-pcb-hc-nondioxin-default.mjs --reviewer "J. Nelson" --date 2026-07-16 --apply
```
The script is dry-run verified + codex-GREEN (grind + gpt-5.5 xhigh). Fail-closed, idempotent,
all-or-nothing two-file write with rollback.

## Coupled code edits (bundle with `--apply` in the SAME PR)
Held (unapplied, verified `git apply --check` clean) in:
`docs/apply-drafts/PCB_HH_DEFAULT_COUPLED_EDITS_2026-07-16.patch`
- `substanceLibrary.ts`: `total_pcbs_aroclor_1254` `rfd_oral_mg_per_kg_bw_per_day` `2.0e-5 -> 1.0e-5`.
- `catalog.test.ts`: `APPROVED_CURRENT_DEFAULT_IDS` += the 2 HC pvids, size `41 -> 43`; PCB-mapping test
  split (HC -> current_default, IRIS -> available_option).
- `library.test.ts`: `DISPOSED_PCB_IDS` exclusions (mirrors `DISPOSED_COPPER_IDS`) for the 2 scaffold
  guard tests; audit counts stay `currentDefaults 84` + `availableOptions 1678` (NET ZERO -- verified by
  live simulation of the script's `applyPromotion` against in-memory clones; promote-2 offsets dispose-2,
  and disposed scaffolds re-enter available_option since `countByStatus` is qa_status-agnostic). No
  superseded counter exists.

These edits assert the POST-apply state (`current_default`), so they CANNOT be green until `--apply`
lands (pre-apply, 4 assertions fail by design: divergence, the pinned-default pin, PCB-mapping, and the
scaffold-sync integrity guard). That is why they are held in the patch, not committed standalone.

## Apply sequence (after the owner runs `--apply`)
1. Owner runs the `--apply` command above (mutates the 2 catalog JSONs).
2. AI: `git apply docs/apply-drafts/PCB_HH_DEFAULT_COUPLED_EDITS_2026-07-16.patch`.
3. AI: verify diff scope; run full gates (tsc/lint/test:ci -- bump any count to the FAILING assertion,
   do not hard-set; monitored build; e2e->CI); `/codex-review` the full consistent change to GREEN.
4. AI: commit catalog JSON + library + tests together, path-scoped; open PR; monitor CI.
5. Owner merges (fresh authorization required per PR).
