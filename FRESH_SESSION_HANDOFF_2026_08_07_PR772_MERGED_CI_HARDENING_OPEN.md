# FRESH SESSION HANDOFF -- 2026-08-07 (session close)

Status: PR #772 MERGED. PR #773 and PR #774 are OPEN and parked pending quota reset.

Start from `C:\Projects\sstac-dashboard` (exact lowercase casing -- session memory lives under that
project key). Read `CLAUDE.md`, then read this file in full. Every fact below was derived from a
live probe (`gh api`, `git`, receipt JSON) at session close, not transcribed from memory or an
earlier doc. Reverify anything you are about to act on.

---

## 1. Shipped / in flight

- **PR #772 MERGED** 2026-08-07T16:07:20Z as `86d88dd9d52648ed94e28fefaefa5bf902ff83ee`. 6 files, all
  under `docs/**`, +632/-15. Merged under a pure-docs OWNER WAIVER + admin merge
  (`enforce_admins: false`), recorded in the PR body. All four waived required contexts then PASSED
  on `main` (run `31196028417`, 8/8 jobs), so the waiver carried no residual risk.
- **PR #773 OPEN.** Branch `fix/ci-hardening-20260807`, tip `8c3ef4b8`, base `main` @ `86d88dd9`.
  Worktree: `C:\Projects\SSTAC-Dashboard-worktrees\ci-hardening-20260807`.
  Contains: a `concurrency` block on `ci.yml` (PR runs grouped by PR number with
  `cancel-in-progress: true`; non-PR runs keyed on `format('{0}-{1}', github.run_id,
  github.run_attempt)`), an ASCII cleanup of 6 characters, and a `docs/NEXT_STEPS.md` record of the
  stuck run (section 4 below). `workflow_dispatch` was proposed and then REMOVED.
- **PR #774 OPEN.** Branch `docs/session-handoff-20260806`, carries this handoff file.

---

## 2. PR #773 review record -- six independent rounds

| Round | Reviewer | Verdict | Notes |
|---|---|---|---|
| 1 | Opus Leg 1a, round 1 | RED | 1 P1: original `github.ref` key would have amplified the failure it memorializes |
| 2 | Opus Leg 1a, round 2 | GREEN | fix applied |
| 3 | Cursor auto (light framing) | GREEN | NOW KNOWN UNRELIABLE -- see section 5 |
| 4 | Codex comprehensive | RED | P1 `workflow_dispatch` secret exposure, P2 `run_id` stable across reruns -- both fixed |
| 5 | AGY Gemini 3.1 Pro High | RED | 2 P2 |
| 6 | Opus comprehensive, 4-level | GREEN | 0 P0, 0 P1, 2 P2 |
| 7 | Cursor auto (heavy framing) | RED | confirmed the already-fixed defects |

Bottom line: the code is clean -- 0 P0 and 0 P1 on the current tip across all six rounds. What
remains is documentation-text quality, not code correctness.

---

## 3. Four outstanding documentation defects on PR #773 (text only, none block merge)

1. The `run_attempt` justification in `ci.yml` and `NEXT_STEPS.md` misdescribes concurrency locks.
   Locks are held only by non-terminal runs, and a non-terminal run cannot be rerun (GitHub requires
   a completed state), so "re-running a stuck push run re-enters the same group and can be blocked"
   cannot happen. KEEP the `run_attempt` key (harmless, defence in depth); FIX the reasoning text.
2. The "secret exposure" argument against `workflow_dispatch` is misleading: same-repo
   `pull_request` events already run branch-controlled code against real secrets before review, so
   dispatch adds no new secret exposure. The honest and sufficient reason is GATE BYPASS, not secret
   exposure.
3. `NEXT_STEPS.md` item 2 says "there is no in-repo escape hatch" -- false and self-contradicting.
   `enforce_admins: false`, so admin merge is available, and it is exactly what was used for PR #772
   one day earlier (cited in item 1 of the same entry).
4. `NEXT_STEPS.md` item 3 lists only the `paths:` filter as a prerequisite for making `Run docs gate`
   required. It also needs: `docs-gate.yml` keys its own concurrency group on `github.ref` with
   unconditional `cancel-in-progress: true` -- exactly the pattern `ci.yml` now argues is unsafe.
   Making it required without re-keying would inherit that failure mode on a REQUIRED check.
   `docs-archive-investigation.yml` has the same pattern.

Open question, not yet resolved: one reviewer rated the PR-path residual hazard (PR-keyed group plus
`cancel-in-progress` amplifying an uncancellable run) higher than the current docs admit.

---

## 4. The permanently stuck run -- do not "fix"

Run `31123692717`: `status: queued`, `run_attempt: 1`, frozen 2026-08-06T19:10:52Z; `/attempts/1` =
`completed`/`failure`; `/attempts/2` = 404; `jobs?filter=latest` = 0, `filter=all` = 8; check-suite
`84431969145` queued with 0 check runs. Both `POST .../cancel` and `POST .../force-cancel` return
HTTP 409 -- verified. It cannot be cancelled.

It could be deleted but MUST NOT be: it holds the only surviving record that Lint & TypeScript
Check, Unit Tests, and Security Scan ran green on `ea073364` (now only as job history on the run
object), which PR #772 cites as its waiver evidence. It is harmless: check runs are commit-scoped
and it is bound to a superseded, merged SHA. Full diagnosis is a comment on PR #772.

Cause: a `gh run rerun --failed` issued 2026-08-06T19:10:52Z inside an active Critical Actions
incident (15:22:49Z to 2026-08-07T02:04:44Z).

---

## 5. Review tooling -- quota state and a validated free workaround

Quota state as of session close: codex weekly ~98% used; Claude weekly ~95% used; Cursor PREMIUM
models out of usage (`ActionRequiredError: switch to Auto`); AGY available (separate quota).

Validated finding: Cursor `--model auto` is FREE and routes by task difficulty based on the
POSITIONAL prompt -- not on a file the prompt points to. A/B on the same account and the same
defective content: light framing produced GREEN and missed two planted defects; heavy framing
produced 1156 thinking events, verdict RED, and found both -- matching a comprehensive codex gate
review and prescribing the identical fix. A second run naming the levels explicitly
(TARGETED/STRATEGIC/HOLISTIC) produced 855 thinking events, a 9680-char structured review, and rated
the dispatch defects P0.

Recipe: put difficulty framing in the POSITIONAL prompt (exhaustive, COMPREHENSIVE, DETAILED,
adversarial; name the three levels; say it is a pure reasoning task and NOT a coding task; name the
hard domains; say expert reviewers already missed real defects); keep the detail in a brief file
inside the trusted worktree; the positional must be flag-free (any ` -<digit>` token is
word-split); run foreground with `2>&1 | Out-File` or via a `.ps1` under `run_in_background`.

Caveat: the router MASKS the model (`"model":"Auto"`), so `"type":"thinking"` event count is the
only routing proxy, and a LIGHT-framed cursor GREEN must never be counted as an independent strong
review.

Memory anchor: `cursor_auto_heavy_framing_routes_to_thinking_model`.

---

## 6. Nightly / wiki runtime

Nightly ran 2026-08-07 05:30, `LastTaskResult` 0, counted streak day 2 of 10. Receipt
`3646680a-5dc5-4e0b-b332-ab52d847e874`: SUCCESS, `serve_gate` PASS, custody PASS / 0 survivors,
`SERVED_WIKI_SWAPPED`, all OIDs `a821e519`. Task XML still `484f7914...`, 0 missed runs.

Highest-value cheap item for the next session: the 2026-08-08 05:30 run should produce the FIRST
genuine `REPINNED` receipt, because `main` advanced `a821e519` -> `86d88dd9` and the merge touched
nothing in the protected pathspec. Neither prior run exercised that path (`65672054` had no
`autofollow_*` fields at all; `14459a28` was `ALREADY_CURRENT` with `attempted=false`). Capture it --
it is the end-to-end proof of PR #771's feature.

Standing hazards: the task runs as `LogonType=InteractiveToken`, not Contract D's mandated
`Password`, so it only fires while someone is signed in (owner elected to keep a session signed in).
Custody check trap: build the search pattern at runtime from parts -- a literal query for the
runtime path matches ITSELF and reports a false positive.

---

## 7. Decisions taken 2026-08-07 -- do not relitigate

- `Run docs gate` stays NON-required. Requiring it as-is deadlocks permanently via its `paths:`
  filter; the correct pattern is an always-run job that skips work internally. See defect 4 in
  section 3 for the second prerequisite.
- ship-protocols 3b is NOT amended. Both proposed amendments were falsified on evidence: "more
  retries for never-dispatched failures" (two runs that day had the identical never-dispatched
  signature and opposite outcomes) and "forbid re-runs during an active Actions incident" (the
  docs-gate re-run that SUCCEEDED at 18:00Z was issued inside the incident window).

---

## 8. Owner-gated queue -- do not start unprompted

- Stray scheduled-task audit (`SSTAC-Wiki-FirstNightly-Verify-20260724`,
  `SSTAC-Wiki-Nightly-Streak-Verify`, both Ready, scripts under
  `C:\tmp\sstac-kb-post750-20260723\`).
- graphify -- TWO independent defects: the canonical venv cannot start on `mcp==2.0.0`, AND the only
  registration targets the superseded `kb-runtime-6bb43b-2026-07-23` serving a stale graph; fixing
  one does nothing for the other.
- The semantic tier (Phase 7 criterion 2, which Contract D cannot satisfy) needs an Ollama standing
  block.
- Committed wiki output vs auto-follow is a design conflict: `wiki` is in the protected pathspec.

Details live in `docs/NEXT_STEPS.md` and `docs/WIKI_KB_OPERATIONS_2026_07.md`.

---

## 9. Why /update-docs was not run

A root-cause review found each live-state fact was hand-restated in 7-12 places across four files
with no single source of truth, so one correction needed an 11-way edit -- the driver behind five
review rounds on PR #772. `/update-docs` is implicated: it transcribes live state rather than
deriving it from probes. The structural fix -- emit live-state facts from a probe script into ONE
dated generated block -- is recorded and NOT built (`docs/NEXT_STEPS.md` item 7) and should land
before `/update-docs` runs again.
