# Next Session Handoff -- 2026-05-28 evening (Stream C merge + Vercel + Catalog robot)

**Plain ASCII only (code point <= 127).** Authored end of a long session covering: Stream C/D merges, Vercel cost mitigation, and a catalog-robot redesign.

---

## TL;DR

- **Stream C (#189) + Stream D catalog (#188) MERGED to origin/main.** Plus `vercel.json` (deploy-cost control).
- **Vercel spend mitigated:** duplicate project disconnected, `vercel.json` added, `$20` spend pause set by owner.
- **Catalog robot REDESIGNED** (owner-directed): writes a local JSON file, **no Supabase / no DSN / no password**. Committed LOCALLY on the stream-d branch (`a2afbf8`, `8fba56c`), NOT pushed.
- **Catalog core extraction PROVEN** (Docling: 7 tables from Protocol 1, 60s). **One remaining blocker:** the autonomous `claude -p` worker won't auto-execute headlessly (2 wrapper config gaps).

---

## Git state -- READ CAREFULLY

- **origin/main** tip `91b2c18` -- contains Stream C (#189 merge), Stream D catalog (#188 merge), and `vercel.json`.
- **This worktree** `C:\Projects\SSTAC-Dashboard-worktree-stream-a` -- on `main`, clean (plus this handoff).
- **Primary/shared checkout** `C:\Projects\SSTAC-Dashboard` -- on `feat/stream-d-catalog-agent-scaffold` with **TWO LOCAL UNPUSHED commits**:
  - `a2afbf8` -- catalog robot rewire (JSON file; removes Supabase/DSN/psycopg).
  - `8fba56c` -- wrapper `-WorkingDirectory` fix.
  - **DO NOT push this branch as-is** -- it predates `vercel.json`, so a push triggers a Vercel **preview deploy** (cost). To land on main: cherry-pick these 2 commits onto a branch that has `vercel.json` (or onto main) and PR.
  - This checkout also has MANY untracked Stream D `*.md` handoff files (pre-existing clutter; not from this session).
- **PR #187** (B1+B3 UI polish) still **OPEN** -- owner merge pending.

---

## Vercel cost mitigation (DONE)

Root cause of the `$15/$20` burn: the repo was connected to **two** Vercel projects (`sstac-dashboard` + `sstac-dashboard-fkdt`) -> every push **double-deployed**; plus docs-only `main` commits each triggered a full production build; plus feature-branch previews.

Fixes applied:
- Owner **disconnected Git** on `sstac-dashboard-fkdt` (now a frozen backup; no more double builds).
- `vercel.json` on main: `git.deploymentEnabled` disables `feat/*` + `fix/*` preview deploys; `ignoreCommand` skips builds when only `*.md` / `docs/` / `supabase/` / `scripts/` / `e2e/` changed.
- Owner set a **$20 Spend Management pause** (hard cap).

Result: only meaningful `main` changes build, once. (A handoff `*.md` push like this one is build-free.)

---

## Catalog robot -- the main work + the one remaining blocker

**Owner decision:** the robot writes proposed catalog rows to a **local JSON file**; the owner imports approved rows to Supabase via the **SQL Editor**. The robot has **zero Supabase connection** (no DSN, no password, no psycopg). This deliberately killed the brutal Supabase-password setup.

**Done + verified:**
- `extract.py` rewired: `StagingWriter`/`_INSERT_SQL`/psycopg removed; added `StagingRow.to_dict()` + `save_proposals(rows, out_path)` (atomic JSON append). **34 pytest pass.**
- Starter prompt + wrapper updated: writes `scripts/catalog-overnight/proposals/<PassId>.json`; no DSN; `-DryRun` now skips the file write.
- Wrapper `-WorkingDirectory $RepoRoot` fix (worker was inheriting the wrong worktree's CWD).
- venv at `scripts/catalog-overnight/.venv` (docling, pymupdf, pillow, pytest; psycopg dropped). Docling models cached (~40MB rapidocr).
- Manifest seeded: Protocol 1 -> `G:\My Drive\Google AI Studio\protocol01.pdf`.
- **Core extraction PROVEN:** Docling pulled 7 tables from Protocol 1 (32 pages, 60s) reading straight from the `G:` path.

**REMAINING BLOCKER -- the autonomous `claude -p` worker will not auto-execute headlessly.** Two config gaps in the Stream D wrapper (it was unit-tested but never live-run end-to-end). Both real runs hit `SILENT_BAIL` (exit 2); the worker's stdout showed it *narrating* instead of acting:
1. **No permission-skip flag** -- the wrapper launches `claude -p` without `--dangerously-skip-permissions` (or an allowed-tools/permission-mode), so the headless worker cannot run its tools (Bash/extract.py/file writes) with no approver. It describes what it would do and exits with no code.
2. **SessionStart `/codex-review` hook fires** inside the headless session and the worker treats it as a blocking gate.

**Two resume paths (pick one):**
- **(a) Fix the headless worker:** add `--dangerously-skip-permissions` (+ likely `--permission-mode` / allowed tools) to the wrapper's `claude -p` ArgumentList; make the SessionStart hook skip in `-p`/headless mode (or invoke `claude -p` with a settings file that omits it). Then live-test `-DryRun -MaxItems 1`, then a real run. Focused ~30-min task.
- **(b) Skip the overnight headless robot entirely (RECOMMENDED if (a) is fiddly):** the "robot" is just *a Claude session running Docling extract + reasoning + `save_proposals`*. A Claude session (interactive, on demand) does the extraction directly -- no headless plumbing. Same JSON output -> same SQL import.

---

## Supabase (catalog DB layer EXISTS + verified, but robot no longer writes to it)

- Tables `catalog_extraction_staging`, `catalog_sources`, `catalog_evidence_items`, `source_lead_triage` + RPC `catalog_approve_staging_row` ALL **exist and are verified** (3 admins in `user_roles`, RLS on, 7 policies, RPC signature correct). Migrations already applied -- do NOT re-paste them.
- Per the rewire, the robot does **not** write here; the owner imports via SQL paste from the JSON proposals.
- The Windows Credential Manager entry `SSTAC_CATALOG_DSN` is now **UNUSED** (the DSN/password ordeal is moot). It can be ignored or deleted. NOTE: the DB password was reset several times and briefly visible in-terminal during the saga; an optional final reset is fine since nothing uses it.
- Supabase Session-pooler conn string shape (for reference): `postgresql://postgres.qyrhsieynzfgyuqzznap:<pw>@aws-1-ca-central-1.pooler.supabase.com:5432/postgres`.

---

## Corpus (what to extract)

- **Protocol 1:** FOUND -- `G:\My Drive\Google AI Studio\protocol01.pdf` (v4.0, 32 pages). In the manifest.
- **Protocol 28:** NOT in Google Drive. Owner must upload the official `p28...pdf` from gov.bc.ca (site-remediation -> guidance-resources -> regulated-standards) into `G:\My Drive\Google AI Studio\` (or the SABCS References folder), then add a manifest row.
- **TRV references cited in Protocol 1 sections 4.4.1.2 / 4.4.2.1 / 4.4.2.2:** NOT yet read/identified -- these define which TRVs BC accepts (govern catalog inclusion). The section numbers appear in NO local file yet; read Protocol 1 to enumerate the cited references.
- **Prior research:** `C:\Projects\SSTAC-Dashboard\matrix_research\reference_catalog\` -- Protocol 28 has 4 TRV values extracted (benzo[a]pyrene, arsenic, PCBs, zinc), all flagged DISCREPANCY/NO_PROMOTION (need owner judgment); TRV sources logged (Health Canada TRVs v4, US EPA IRIS, FCSAP ERA Modules 2 & 7). Owner found this scattered/unsystematic; the manifest -> JSON -> SQL flow is the systematic replacement.

---

## Codex re-review queue

- Stream C: GREEN (native desktop codex holistic), resolved.
- Stream D: entries logged. **Codex CLI backend was DOWN the whole session** (stream-disconnect outage); fell back to cursor-agent `gpt-5.3-codex-xhigh` + owner-run desktop codex.
- Queue: `~/.claude/projects/C--Projects-Regulatory-Review/memory/codex_rereview_queue_2026_05_17.md`.

---

## Next-session first actions

1. Read this handoff.
2. Choose the catalog path: **(a)** fix the headless worker, or **(b)** inline extraction by a Claude session. (b) is recommended for fastest data.
3. If (b): read Protocol 1 sections 4.4.x, reconcile with `matrix_research/reference_catalog`, draft proposed catalog rows, write the proposals JSON + paste-ready SQL for the owner to review and paste into the Supabase SQL Editor.
4. Land the 2 local catalog commits (`a2afbf8`, `8fba56c`) onto `main` properly (cherry-pick onto a `vercel.json`-bearing branch + PR; do NOT push the stream-d branch raw -- preview-deploy cost).
5. Merge PR #187 if desired.
6. Upload Protocol 28 to Drive for the full corpus.

---

## Durable gotchas (worth remembering)

- **Supabase DB password:** never shown again (reset-only). A clipboard/password-manager tool replaced the word "Password" in pasted PowerShell commands (and likely corrupted pasted passwords). Use the `Get-Credential` dialog or **type, don't paste**; use `New-StoredCredential -Credentials <pscredential>` (NOT `-Password`/`-SecurePassword`) to dodge the param-set ambiguity + the "Password"-word swap. Special chars in a URI password need percent-encoding (`&` -> `%26`).
- **Claude-Code-as-worker (`claude -p`)** needs `--dangerously-skip-permissions` (or allowed-tools) AND non-blocking SessionStart hooks, or it narrates instead of acting and the wrapper records SILENT_BAIL.
- **Vercel:** one Git repo connected to multiple projects multiplies deploys; control spend with a single connected project + `vercel.json` `git.deploymentEnabled` + `ignoreCommand` + a Spend Management cap.

---

## Catalog rewire -- independent review findings (Opus adversarial, 2026-05-28). VERDICT: YELLOW

Core rewire sound (DB path cleanly removed; `save_proposals` atomic; `to_dict` serializes all 11 staging columns JSON-safely; tests real; `-WorkingDirectory` fix correct). Fix these before an autonomous run:

- **BLOCKER B1 -- `-DryRun` is a silent no-op.** The DSN-load gate was removed but `$DryRun` is no longer passed to the worker (no `$DryRun` prompt marker, no no-write branch). So `-DryRun -MaxItems 1` (the documented smoke recipe) would WRITE real proposals. Fix: wire a `$DryRun` marker into the starter prompt with an explicit no-write branch, or remove `-DryRun`.
- **I1 -- provenance dropped.** Starter prompt asks the agent for `source_excerpt` (verbatim grounding) + `source_doc_id`, but `build_staging_row` reads only proposed_kind/payload/confidence/extraction_notes -- those fields are discarded unless nested in `proposed_payload`. The HITL review needs the excerpt; reconcile prompt<->library.
- **I2 -- corrupt-file path.** `save_proposals` does `json.loads(existing)` with no try/except; a malformed/truncated file raises uncaught (the non-array case IS handled -- inconsistent). Add handling + test.
- **I3 -- README stale.** `scripts/catalog-overnight/README.md` still documents the Supabase/DSN/StagingWriter/Credential-Manager flow + "24 tests" -- now wrong; update in the same change that lands the rewire.
- **MINORs:** `proposals/` not gitignored (the run's only output is never version-controlled; `.tmp` clutter); `extraction_model` value is never specified to the agent (migration comment still says "Ollama"); manifest points Docling at a `G:\` path (read-only input, acceptable).

**Headless blockers CONFIRMED + scoped:** (1) wrapper lacks `--dangerously-skip-permissions` (primary -- worker can't run tools headlessly -> narrates -> SILENT_BAIL); (2) the SessionStart `/codex-review` hook in `C:\Users\jasen\.claude\settings.json` (matcher `startup|resume`) injects a BLOCKING "ask the user first" instruction that paralyzes a no-human `-p` session. **Fix-path (a) is NECESSARY BUT NOT SUFFICIENT.**

**Full list to make the robot run autonomously + safely (do all before relying on it):**
1. Add `--dangerously-skip-permissions` (or a curated `--allowedTools` allowlist -- safer) to the wrapper's `claude -p` ArgumentList.
2. Bypass the SessionStart codex-review hook for `-p`/headless sessions.
3. Make `-DryRun` actually skip the write (B1).
4. Reconcile `source_excerpt`/`source_doc_id` between prompt and `build_staging_row` (I1).
5. Handle a corrupt pre-existing proposals file + test (I2).
6. Update README + the migration "Ollama" comment + the DryRun docstring (I3, M2).
7. Add a venv pre-flight to the wrapper (does `.venv/Scripts/python.exe` with docling exist?) before spawn.
8. Run the worker in a DEDICATED worktree per L0 1.15 (it currently commits in the shared checkout -- the exact hazard the rule guards against). Note `--dangerously-skip-permissions` WIDENS the no-commit-to-main/path-scoped risk, which is currently only instructed, not enforced.
9. Decide gitignore policy for `proposals/` (M1).

(The same review brief is also captured for the owner to run in the Codex desktop app; reconcile the two verdicts next session.)

---

*Authored 2026-05-28 ~end of session (continued past 00:00 UTC 2026-05-29). Process check: 0 orphaned catalog workers. origin/main @ 91b2c18 (handoff push -> 189ec3b); catalog rewire local on feat/stream-d-catalog-agent-scaffold @ 8fba56c. Opus adversarial review of the rewire: YELLOW (findings above).*
