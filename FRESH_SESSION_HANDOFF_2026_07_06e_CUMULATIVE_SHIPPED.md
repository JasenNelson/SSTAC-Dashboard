# Fresh Session Handoff -- 2026-07-06e (cumulative-effects lane A1+A3a SHIPPED + /sessionstart skill)

Supersedes `FRESH_SESSION_HANDOFF_2026_07_06d_CUMULATIVE_LANE.md`. Plain ASCII. Autonomous overnight
session: built the cumulative-effects lane from the codex-GREEN plan, plus a redirected /sessionstart
skill port.

## Shipped this session (PRs -- OPEN, awaiting owner merge)

- **#531** -- SSTAC `/sessionstart` fresh-session ritual skill (ported from the OHD skeleton;
  adapt-then-port). Fixes the cross-project leak where fresh SSTAC sessions cross-read OHD's ritual.
  codex-reviewed GREEN. `.claude/skills/sessionstart/SKILL.md`.
- **#532** -- A1 cumulative reference tables (`tefTable.ts` / `rpfTable.ts` / `adafTable.ts` + 289
  tests). Branch `feat/mo-cumulative-a1-2026-07-06` -> main. codex GREEN (zero numeric findings; codex
  ran its own programmatic cross-check).
- **#533** -- A3a cumulative headless reducers (`cumulative.ts` + 29 tests) + the A4 packets doc.
  Branch `feat/mo-cumulative-a3a` -> `feat/mo-cumulative-a1-2026-07-06` (STACKED; merge #532 first).
  codex GREEN after 3 rounds (round 1: 4 fail-closed gaps; self-review: 3 more -- all fixed).

All three: build-first, ZERO policy mutation (D0 -- no ProvenancePathway / dispatch / frame / catalog /
seed edits). No catalog value promoted. A4 is dry-run only.

## Gate + review status

- Both cumulative PRs: 4-gate push suite GREEN on the combined tree -- lint (clean for tracked/PR files;
  the only local eslint errors are untracked `.venv` vendored JS, invisible to CI), test:ci (5414
  passed), monitored build (exit 0), e2e (117 passed). Re-run GREEN after the self-review hardening.
- codex mutual-agreement GREEN on every increment (A1, A3a, the self-review options, and the fixes).

## Key facts established

- **DeVito-2024 TEFs are PRIMARY-VERIFIED** -- all 29 congeners extracted cell-by-cell from the HC v4.0
  PDF Table 4 (pp.54-55) via `scripts/matrix-options/hc_trv_v4_table4_devito_tef_extract.py` ->
  `data/hc_trv_v4_table4_devito_tef_extracted.json`. (Printed pp.54-55 = PDF pages 54-55; printed page
  != PDF page by ~4.) The dioxin/DL-PCB TEQ TDI 2.3e-9 mg TEQ/kgBW-day is also PDF-confirmed (Faqi &
  Chahoud 1998 basis).
- who-2005 / who-1998-* TEF columns + hc-pqra-v3 / epa-2010-draft / who-1998-pah RPF schemes are
  `needs_review` (transcribed from the verified SPEC, not primary-checked). Honestly flagged; usable
  build-first.
- `computeBaPeq` BLOCKS scoring for `who-1998-pah` (BC) -- its 5-PAH subset is unverified and would
  over-sum. Unblock via framework-A2.

## Recommended next steps (from the self-review, codex-agreed -- see the self-review doc)

Priority order (A4 before A3b -- the anchors ARE the A4 values):
1. Owner merges #532 then #533 (after GitHub CI green).
2. **A4 owner decisions** (owner-gated, do first): the 3 dry-run packets in
   `docs/MATRIX_OPTIONS_CUMULATIVE_A4_ATTESTATION_PACKETS_2026_07_06.md` -- dioxin TEQ TDI 2.3e-9
   promotion + representation; benzo_a_pyrene EPA-2.0 scenario tag + current_default pick; PCB Option A.
   AI does not promote.
3. **Framework-A2 verification lane** (highest-value research; can run parallel to A4): pin BC's exact
   5-PAH subset (BC CSR Sched 3.1/3.4 + Protocol 28) -> mark non-BC-5 `excluded` + remove who-1998-pah
   from `RPF_SCHEME_SCORING_BLOCKED`; verify who-2005 (Van den Berg 2006) + who-1998-* (WHO/IPCS 1998)
   -> flip to verified; resolve the CCME "21.5" total-PCB-vs-dioxin-TEQ ambiguity.
4. **A3b UI** (deferred lane): per-congener/PAH input grid consuming `CumulativeContributionRow`; wire
   the compare step to the A4-attested anchors -- ONLY after steps 2+3.
5. **eslint `.venv` ignore** -- trivial hygiene: add `**/.venv/` to `eslint.config.mjs` ignores (48
   local-only lint errors from vendored JS in `scripts/catalog-overnight/.venv/`; CI unaffected).
   Separate small PR.

## Reference docs (all on the branches / main)

- Plan: `docs/MATRIX_OPTIONS_CUMULATIVE_EFFECTS_IMPLEMENTATION_PLAN_2026_07_06.md` (codex-hardened).
- Self-review + options: `docs/MATRIX_OPTIONS_CUMULATIVE_SELF_REVIEW_AND_OPTIONS_2026_07_06.md`.
- A4 packets: `docs/MATRIX_OPTIONS_CUMULATIVE_A4_ATTESTATION_PACKETS_2026_07_06.md`.
- Owner decisions: `docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md`.
- Plan file (session): `~/.claude/plans/everything-the-fresh-session-pure-conway.md`.

## Process / environment notes

- Stacked-PR maintenance: #533 targets #532's branch; when #532 merges, rebase/retarget #533 onto main.
- codex file-capture gotcha (hit + fixed this session): NEVER launch codex with a nested `&` inside a
  run_in_background bash -- the child dies with the parent and truncates the review mid-run. Use a
  single background command. Also: codex reads its own MEMORY.md at startup, so a stray "VERDICT: GREEN"
  can appear in the memory dump -- always read the TRUE last codex turn, not a grep hit.
- The 3 FOREIGN `gold-reliability` pytest processes (parallel Regulatory-Review session) -- leave alone.
- `.gitignore` (+`.gstack/`) uncommitted leftover still follows the tree (not this session's work).
