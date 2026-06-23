# AGY (Google Antigravity CLI) usage -- CANONICAL (SSTAC-Dashboard)

Last updated 2026-06-23. This is the CURRENT, authoritative guide for using AGY as a workhorse from a
Claude session in this repo. It supersedes all earlier AGY / "catalog robot" / headless-worker
orchestration notes (those are archived under `docs/archive/` and carry a SUPERSEDED banner). The
cross-session anchor is memory `agy_antigravity_cli_usage`. Plain ASCII.

## TL;DR role split
- **Claude = thin orchestrator.** Writes a tight task brief to a file, hands AGY one line, then VERIFIES
  AGY's output with cheap tool calls (`git diff`, targeted greps, re-running the gate). Never trusts
  AGY's self-report; never writes the feature code itself when AGY can.
- **AGY = mechanical workhorse** (Gemini; unlimited tokens). Writes code/tests over a fully-specified
  brief; can run a free read-only self pre-review. **No confirmed web access** -- do NOT use AGY as a
  live-source verifier (that stays on Claude WebFetch).
- **codex = ship gate** (Spark grind -> gpt-5.5 xhigh), unchanged.

## NEVER use --dangerously-skip-permissions (the trap that misled a prior session)
`agy --dangerously-skip-permissions` BYPASSES the settings.json deny-list (rm / fsutil / mklink /
git push --force / git worktree remove / npm install / gh pr merge / taskkill ...). The default
permissions already let AGY edit files + run node/python/git/`codex review` non-interactively with the
deny-list intact. Do NOT pass it. (The old catalog-robot docs recommended `--dangerously-skip-permissions`
for a `claude -p` headless worker -- a DIFFERENT, abandoned workflow; that guidance does NOT apply to AGY.)

## Invocation (verified agy v1.0.6)
Binary: `C:\Users\jasen\AppData\Local\agy\bin\agy` (on PATH as `agy`). Run from the repo root:
```
agy --model "Gemini 3.1 Pro (High)" --add-dir "C:\Projects\sstac-dashboard" --print-timeout 9m \
    -p "Read <abs path to brief>.md and execute it. Touch only the files it names; no git add/commit."
```
- Models (parenthetical, exact): `"Gemini 3.1 Pro (High)"` = reasoning/numerical/regulatory; `"Gemini
  3.5 Flash (High)"` = fast/mechanical (settings default). `agy models` prints nothing non-interactively.
- `--print-timeout 9m` (default 5m is too short). First-run can cold-start hang; the retry works. Keep
  each invocation SMALL (foreground Bash has a ~10-min cap; AGY children die on session exit per L0 1.8).
- Print mode emits 0 bytes when piped/redirected -- the deliverable is the FILE EDITS + the closeout
  file AGY writes; `git diff` is your source of truth. `--output-format json` does NOT exist in v1.0.6.
- Permissions live in `~/.gemini/antigravity-cli/settings.json` (Deny > Ask > Allow). Logs:
  `~/.gemini/antigravity-cli/log/cli-*.log`.

## File-based brief protocol (proven; 4 merged PRs incl. #402/#403, 2026-06-22/23)
1. Brief -> `.tmp_agy_brief_<n>.md`: exact files to touch, embedded content/values, format TEMPLATES to
   mirror ("read <existing file> and match its field set EXACTLY"), hard limits ("touch ONLY x; no git;
   no ollama"), the acceptance checks to run, and a CLOSEOUT to write to `.tmp_agy_closeout_<n>.md`.
   CAP exploration explicitly (AGY will rabbit-hole otherwise).
2. Hand AGY one line: `Read <abs path> and execute it`.
3. VERIFY independently: `git diff`, greps for the intended change + stray leftovers, re-run the gate.
4. Gate with codex (Spark grind -> 5.5 xhigh). Then ship per the normal SSTAC gate suite
   (`docs/GATE_MODE_SOP.md`: lint / test:ci / monitored build / e2e).

## Driving AGY headless FROM Claude vs the owner's terminal
Driving `agy -p` headless from Claude's Bash works for file-editing tasks (proven). If your harness's
auto-mode classifier BLOCKS the headless `agy` call, that is expected -- run AGY in the owner's terminal
instead and relay the closeout file path; Claude stays thin either way. Do NOT reach for
`--dangerously-skip-permissions` to get around a classifier block.

Reference: memory `agy_antigravity_cli_usage`; the engine-v2 sibling guide lives at
`C:\Projects\Regulatory-Review\AGY_USAGE_FOR_PARALLEL_SESSION_2026_06_23.md`.
