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

---

## PRIOR RUN, PRESERVED BELOW (do not delete)

The Matrix-Options top-50 run's resume prompt follows, verbatim. An earlier version of this
commit REPLACED it, deleting 32 lines that recorded an in-flight lane and a batched owner
packet. Round-2 review caught the same destruction in COMMAND_LOG.md, RUN_STATE.md and
PR_MANIFEST.md and those were fixed -- but the verification that followed was SCOPED to just
those three files, so this one was missed and the fix was reported as "zero deletions" while the
full diff still showed 32. Verify with an unscoped `git diff --shortstat origin/main...<branch>`,
never a path-filtered one.

Status note added 2026-08-16 for accuracy: the PCB HH-default lane described below DID complete
-- PR #669 is MERGED -- and its branch `feat/pcb-hh-default-2026-07-16` is still on origin at
df537ec9. The owner-packet items below have NOT been re-verified by the 2026-08-16 run and may
be stale. They are preserved as a record, not as a live to-do list.

# RESUME PROMPT -- Matrix-Options top-50 autonomous run

Continue Autonomous Multi-Hour. origin/main = c21ab08 (verify live). Do NOT micro-gate; phase
transitions are not stop points. If blocked by a true owner gate, move to the next independent safe
top-50 task rather than idling. Only stop for: exact prod/Supabase writes not pre-approved,
secrets/admin creds, owner-only UI publish flips, per-PR merge authorization, QP/site-data decisions
un-inferable from evidence, destructive/junction hazards, repeated gate failure after bounded retry.

## In-flight lane: PCB HH-default (HC 1.0e-5)
Branch feat/pcb-hh-default-2026-07-16 (prep fc1eff4). Owner ran the --apply + applied the coupled
patch. Working tree = 2 catalog JSON (human_health_trv_values, parameter_values) + 3 code files
(substanceLibrary, catalog.test, library.test) + 2 test-ripple fixes (defaultSelectionPolicy.test,
HHFoodWebCalculator.test). Finish: test:ci green -> monitored build -> e2e (or defer per rule) ->
/codex-review to GREEN -> commit exact paths (no git add .) -> push -> open PR -> monitor CI once.
Do NOT merge without explicit per-PR authorization.

## Next safe top-50 units after PCB HH-default PR is opened (pick independent, non-owner-gated)
- #22 cumulative TEQ/BaP-eq scoring UI (A3b): register computeTEQ/computeBaPeq in equationDispatch +
  build component. Now that D1 done + this HH-default lands; verify current state first.
- #23 dl-PCB TEQ full HHDirectContact integration -- GATED on D3 (#13) which is GATED on PCB #15
  site data (owner). Do NOT start without D3.
- Tier 8 HITL groups #32-36 (owner-gated values) / #37 T39 worked-example (owner provides) -- owner-gated.
- #26 read-back pattern (found comprehensive), #44 Agents tab (done), #50 (done).
- Hygiene: #45 worktree triage (owner+careful), #47 root-scratch cleanup (owner).
Most remaining top-50 are owner-gated; if all safe autonomous units are exhausted, checkpoint + hand
the owner packet.

## Owner packet (batched)
1. Merge PCB HH-default PR (after CI green).
2. PCB #15 EqP/logKow site data (Site 3130 IOCO: EPA 8082 Aroclor mix 1248/1254/1260, no site logKow;
   see .tmp/pcb15-evidence/PCB_15_SITE_EVIDENCE_PACKET_DRAFT.md) -> unblocks #13/#15/#23.
3. IOCO publish flip #7; T40 secrets #29; RLS migration #27.
