# FRESH SESSION HANDOFF -- 2026-08-06, UPDATED 2026-08-07

**Status: RESOLVED. PR #772 MERGED. PR #773 open and green. Nothing is blocked.**

Start from `C:\Projects\sstac-dashboard` (exact lowercase casing -- session memory lives under that
project key). Read `CLAUDE.md`, then this file.

Every fact below was derived from a live probe (`gh api`, `git`, receipt JSON) during the session
that wrote it, not transcribed from a prior summary. That distinction is the subject of item 6.
Reverify anything you intend to act on: this file is a point-in-time observation, not an invariant.

---

## 1. What shipped

| | |
|---|---|
| **PR #772** (docs) | **MERGED** 2026-08-07T16:07:20Z as `86d88dd9d52648ed94e28fefaefa5bf902ff83ee`. 6 files, all `docs/**`, +632/-15 |
| **PR #773** (CI hardening) | OPEN, `mergeStateStatus: CLEAN`, all 11 checks green including the 4 required |
| Post-merge CI on `main` | run `31196028417`, **8/8 jobs success** on `86d88dd9` |

**PR #772 was merged under a pure-docs OWNER WAIVER + admin merge** (`enforce_admins: false`),
granted 2026-08-07 and recorded in the PR body with its exact scope and basis. All four waived
required contexts subsequently PASSED on `main` against the merged tree, so the waiver carried no
residual risk. See the PR body for the full record; it is the system of record, not this file.

## 2. The corrupted workflow run -- DO NOT "FIX" IT

Run `31123692717` is permanently `queued` and **cannot be cancelled or deleted**:

- `/attempts/1` = `completed`/`failure`; `/attempts/2` = **404**; `jobs?filter=latest` = 0,
  `filter=all` = 8; check-suite `84431969145` = `queued`, 0 check runs.
- `POST .../cancel` -> **HTTP 409**. `POST .../force-cancel` -> **HTTP 409**. Verified 2026-08-07.
- **It must NOT be deleted.** `gh run delete` would succeed but would destroy the only surviving
  record of `Lint & TypeScript Check`, `Unit Tests` and `Security Scan` passing on `ea073364`, which
  PR #772 cites as the judgment evidence for the waiver under which it merged.
- It is harmless: check runs are commit-scoped and it is bound to a superseded, merged SHA.

**Full diagnosis is a comment on PR #772.** Do not re-derive it -- a prior session lost most of a day
doing exactly that.

Cause: a `gh run rerun --failed` issued 2026-08-06T19:10:52Z, inside an active GitHub Actions
incident (impact Critical, 15:22:49Z to 2026-08-07T02:04:44Z). It reset the run and detached three
passing check runs, leaving 0 of 4 required contexts reporting on `ea073364`.

## 3. Nightly / wiki runtime

- Nightly ran 2026-08-07 05:30, `LastTaskResult 0`, **counted streak DAY 2 of 10**. Receipt
  `3646680a-5dc5-4e0b-b332-ab52d847e874`: `SUCCESS`, `serve_gate=PASS`, custody PASS / 0 survivors,
  `SERVED_WIKI_SWAPPED`, all OIDs `a821e519`. Task XML still `484f7914...`, 0 missed runs.
- **The 2026-08-08 05:30 run should produce the FIRST GENUINE `REPINNED` receipt.** `main` advanced
  `a821e519` -> `86d88dd9` and the merge touched nothing in the protected pathspec, so auto-follow
  should fetch and repin. Neither prior run exercised that path (`65672054` had no `autofollow_*`
  fields at all; `14459a28` was `ALREADY_CURRENT` / `attempted=false`). **Capture that receipt -- it
  is the end-to-end proof of PR #771's feature and the highest-value observation outstanding.**
- Standing hazard unchanged: the task runs as `LogonType=InteractiveToken`, not Contract D's
  mandated `Password`, so it only fires while someone is signed in. The owner elected to keep a
  session signed in rather than change the task.
- Custody check trap: build the search pattern at runtime from parts. A literal query for the
  runtime path matches ITSELF and reports a false positive (observed twice).

## 4. Next work, in priority order

1. **Merge PR #773** once the owner confirms (it touches `.github/`, config class, so no docs waiver
   applies; all four required contexts are green on its tip).
2. **Capture the 2026-08-08 `REPINNED` receipt** (item 3). Cheap, highest value.
3. **Audit the two stray scheduled tasks** (`SSTAC-Wiki-FirstNightly-Verify-20260724`,
   `SSTAC-Wiki-Nightly-Streak-Verify`, both `Ready`, scripts under
   `C:\tmp\sstac-kb-post750-20260723\`). Read-only. A daily 06:15 trigger 45 min after the nightly
   would trip the custody baseline if it ever fired. Task changes are owner-gated.
4. **OWNER-GATED, not to be started unprompted:** graphify (TWO independent defects -- canonical venv
   cannot start on `mcp==2.0.0`, AND the only registration targets the superseded
   `kb-runtime-6bb43b-2026-07-23` serving a stale graph; fixing one does nothing for the other);
   the semantic tier (Phase 7 criterion 2, which Contract D cannot satisfy, needs an Ollama standing
   block); committed wiki output vs auto-follow (design conflict, `wiki` is in the protected
   pathspec).

Details for all of these live in `docs/NEXT_STEPS.md` and
`docs/WIKI_KB_OPERATIONS_2026_07.md` -- deliberately NOT restated here. See item 6.

## 5. Decisions taken 2026-08-07 (do not relitigate)

- **`Run docs gate` stays NON-required.** Requiring it as-is would deadlock permanently: it carries a
  `paths:` filter, and a required workflow filtered out by paths never reports. Handoff-only PRs
  (which this repo's own close-out protocol mandates) fall outside its paths. The correct fix is an
  always-run job that skips work internally -- a design change, deferred. `Unit Tests` stays globally
  required; it is the only required check with docs-manifest sensitivity.
- **ship-protocols 3b is NOT amended.** Two amendments were proposed and both rejected on evidence:
  "more retries for never-dispatched failures" is falsified (two runs that day had the identical
  never-dispatched signature and opposite outcomes), and "forbid re-runs during an active Actions
  incident" is ALSO falsified -- the docs-gate re-run that SUCCEEDED at 18:00Z was issued during the
  incident window. The one-re-run budget stands as written.

## 6. Why this file is short, and the standing defect it reflects

A root-cause review on 2026-08-06 found the driver behind five review rounds on PR #772: each
live-state fact was hand-restated in **7-12 places** across four files with no single source of
truth, while reviews are scoped to changed lines and cannot see stale copies in untouched text. One
correction therefore needed an 11-way edit.

`/update-docs` is implicated -- it transcribes live state into prose rather than deriving it from
probes. It was deliberately NOT run for this session. This file was written by hand from live probes
instead, and cross-references rather than restates.

**The fix, recorded and not built (`docs/NEXT_STEPS.md` item 7):** emit live-state facts from a probe
script into ONE dated generated block (`schtasks /Query /XML` for task state and LogonType,
`~/.claude.json` for registrations, `pip show mcp` per venv, `git ls-files` for the pathspec,
receipts for streak/auto-follow) and have prose cross-reference it. Every fact that cost those five
rounds is machine-checkable in seconds. Do this before running `/update-docs` again.
