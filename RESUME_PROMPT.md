# RESUME PROMPT -- autonomous UI/UX run 2026-08-16

Paste this into a fresh session if the run was interrupted. Rewritten whenever run status
changes materially. Governing contract: `docs/AUTONOMOUS_RUN_CONTRACT_2026_08_16.md`.

## Where things stand

`origin/main` = `120c6f9a` (merge commit of PR #781; PR #780 merged before it as `a7ec047e`).
Both of those are the OWNER's merges and are DONE. **Do not merge anything. The owner merges.**

Four branches exist, all rebased onto `120c6f9a`, all with clean trees:

| Branch | Worktree | Tip | Base | Pushed? |
|---|---|---|---|---|
| `feat/section-b-wave0-20260815` | `../section-b-wave0-20260815` | `d6d4fa0f` | `main` | NO |
| `feat/mo-batch2-20260816` | `../batch2-20260816` | `6612fe6b` | `main` | NO |
| `feat/section-b-wavea-20260816` | `../wavea-20260816` | `24f90c9d` | batch2 | NO |
| `feat/deferred-triage-20260816` | `../triage-20260816` | `bfbab1c9` | waveA | NO |

They form a linear stack: batch2 -> waveA -> triage. Merge order is fixed by that.
Full detail: `docs/UI_UX_AUTONOMOUS_PR_MANIFEST_2026_08_16.md`.

## What is DONE

- U0 live-state inventory.
- U1 B14 (44px ThemeToggle), U2 B11 (theme-flash bootstrap) -- Leg 1a GREEN, 2 review fixes applied.
- U3 batch 2 -- all five items (#16, #18, P1, P2, #20). Leg 1a RED, all findings fixed.
- U4 Section B Wave A -- B1, B2, B3, B6, B7a, B9. B8 verified as needing no change. Leg 1a RED,
  all findings fixed including two VACUOUS tests that were replaced.
- U5 deferred triage -- systemic print-safety in ScrollFadeRegion, 1px caption honesty, WebKit
  disclosure-marker sweep (8 sites, not the 6 the doc claimed).

## What is NOT done -- pick up here

1. **Gates.** Full suites were running on wave0 (port 3100) and batch2 (port 3120) when this
   was written. Wave A and triage still need gate runs. Every branch needs a FULL suite on its
   final tip before push. `E2E_AUTH_ENABLED=true` is REQUIRED or the authenticated project
   silently runs zero tests -- grep the log for `chromium-auth` before quoting a pass count.
   Gate script: `<scratchpad>/gates.sh <worktree> <logdir> <playwright-port>`.
2. **Nothing is pushed. No PRs exist yet.** Push and open PRs after gates are green.
   Wave A and triage are stacked and get ZERO CI -- their PR bodies must carry local numbers
   and say so, and they must be RETARGETED to `main` after the PR below them merges.
3. **U6 audit round 2** -- findings go in `docs/UI_AUDIT_ROUND2_2026_08_16.md`. Two subagents
   were auditing six views (References & Values, SSD Workbench, Interactive Map, The Guide,
   Methodology by pathway, TWG Review). FINDINGS ONLY -- do not implement.
4. **The decision artifact** -- the owner's main deliverable. One HTML artifact, published via
   the Artifact tool, with rendered options and measured evidence. Contract section 4.

## Traps this run actually hit -- do not repeat

- **Python's `open(path,'w')` on Windows rewrites LF to CRLF.** This silently converted whole
  files and turned a 73-line change into a 2335-line diff. Use binary IO. And the repo is
  genuinely MIXED with no `.gitattributes`, so the rule is MATCH THE BASELINE per file, not
  "always LF" -- normalising everything to LF is the same mistake inverted.
  Helper: `<scratchpad>/match_eol.py <baseline-rev> <files...>`.
- **A literal backspace byte (0x08) got baked into a test regex** by shell escaping, making it
  permanently unmatchable. Scan added lines for bytes >127 or <32.
- **Gate evidence goes stale when `main` moves.** Two full green suites were discarded this run
  for exactly that reason. Re-gate after any rebase; do not reuse the numbers.
- **Never pipe a gate through `tail`** -- `$?` becomes tail's status.
- Falsify every test before believing it. Two tests written this run passed on first write and
  were later PROVEN unable to fail (the B3 heading walk, the B9 link check) -- both replaced.
- When mutating code to falsify, keep the mutation BALANCED. An unbalanced JSX edit collects
  zero tests, which proves nothing but looks like a pass.

## Owner instructions standing for this run

- Do not merge. Do not hand the owner micro-prompts. Batch every judgment call into the ONE
  decision artifact.
- Never recursively delete a worktree: `node_modules` is a junction into the main checkout and
  a recursive delete empties the shared store. Verify `LinkType` per item first.
