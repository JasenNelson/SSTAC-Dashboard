# SSTAC-Dashboard Stream D Catalog Extraction -- Autonomous Session

This is a TEMPLATE. The wrapper substitutes runtime values into placeholder
markers (defined inline below; the literal marker names are not listed in
this header to avoid spurious substitution on the header line itself) before
passing the rendered prompt to claude -p.

---

## Session capsule

1) Objective: process next $N manifest items into a local JSON proposals file at
   scripts/catalog-overnight/proposals/$PassId.json via Docling + Claude-Code reasoning
   (NO database).
2) Active session ID: catalog-extract-$YYYYMMDDTHHMMSSZ-$PassId
3) Active pivots: (read CATALOG_EXTRACTION_HANDOFF.md "Next Session Starter" section)
4) Current blockers: (read CATALOG_EXTRACTION_HANDOFF.md "Open Blockers" section)
5) Next 3 actions: (read CATALOG_EXTRACTION_HANDOFF.md "Immediate Actions" section)
6) Hard constraints (LOAD-BEARING; honor without exception):
   - NEVER connect to any database, and NEVER use psycopg, CATALOG_DSN, or Supabase.
     Write ONLY to the local JSON proposals file. The owner imports approved rows to
     Supabase manually.
   - NEVER mutate src/data/* (Tier 2 protected).
   - NEVER commit to main. Only feat/stream-d-catalog-agent-scaffold.
   - NEVER use `git add .` or `git add -A` or `git add -u`. Path-scoped staging only.
   - Plain ASCII only (code point <= 127). No em-dashes, no smart quotes, no Unicode arrows.
   - Honor sentinels (.tmp/CATALOG_EXTRACTION_STOP, _PAUSE, _PRIORITY_BOOST) between items.
   - No slash commands at end of session. Use plain git commands + exit.

---

## Mandatory reading

Read these files before doing any extraction work. Read them in order.

1. C:/Projects/CLAUDE.md (L0 cross-project rules)
2. C:/Projects/SSTAC-Dashboard/CLAUDE.md (L1 dashboard rules)
3. C:/Projects/SSTAC-Dashboard/CATALOG_EXTRACTION_HANDOFF.md (state + immediate actions)
4. C:/Projects/SSTAC-Dashboard/scripts/catalog-overnight/catalog_extraction_progress.json
   (queue state; which items are completed, errored, or in-progress)
5. C:/Projects/SSTAC-Dashboard/scripts/catalog-overnight/catalog_manifest.csv
   (full work item list; you will filter to pending items)

---

## Session flow

### Step 1 -- Orient and check sentinels

a. Read all 5 mandatory files listed above.
b. Check .tmp/CATALOG_EXTRACTION_STOP sentinel:
   - If present: write a one-line note to CATALOG_EXTRACTION_HANDOFF.md "Prior Sessions"
     section recording that the session was halted by sentinel before doing any work, then
     emit a COMPLETED_GREEN breadcrumb and exit 0.
c. Check .tmp/CATALOG_EXTRACTION_PAUSE sentinel:
   - If present: same as STOP -- note and exit 0.
d. Check .tmp/CATALOG_EXTRACTION_PRIORITY_BOOST sentinel:
   - If present: note the boost and re-order your item queue to front-load priority_tier=1
     items from the manifest.
   - Wrapper-injected status (replaced by wrapper at launch time; empty if no boost):
     $PRIORITY_BOOST_NOTE

### Step 2 -- Build the pending queue

a. Read catalog_extraction_progress.json.
b. Filter catalog_manifest.csv rows to those whose doc_id is NOT present in the
   `completed` or `errors` objects in progress.json.
c. If the pending queue is empty, skip to Step 4 (session-end) and note "no pending items".
d. Cap to $N items per session (smoke phase default: $N = 3).

### Step 3 -- Process each pending item

For each pending item in the queue:

a. Extract tables from the PDF using the extract.py library functions. Invoke via Bash + a
   Python -c or python script call that imports from
   scripts/catalog-overnight/extract.py directly. Do NOT attempt to run extract.py as a
   CLI (it has no main; it is a library). The call should invoke extract_tables_from_pdf()
   with the filepath from the manifest row.

   DURING this step (PDF extraction can be slow for large documents): emit a heartbeat
   breadcrumb to .tmp/catalog-overnight-breadcrumbs/ using the filename format
   "$PassId-$YYYYMMDDTHHMMSSZ-py.json" with status "IN_PROGRESS" and a note field
   saying "heartbeat during item extraction". Emit this heartbeat approximately every
   120 seconds of elapsed real time if the extraction has not yet returned. The watchdog
   in the wrapper polls for pass-scoped -py.json breadcrumbs; if it sees no new one for
   600 seconds (10 minutes) it will kill the session. The 120-second heartbeat cadence
   keeps the watchdog satisfied during long PDF extractions.

   Breadcrumb JSON shape (ASCII only; Windows-safe basic ISO timestamps -- use
   "20260528T230530Z" format, NOT "2026-05-28T23:05:30Z"; colons are invalid in
   Windows filenames and would cause a silent write failure, triggering a false STALLED
   watchdog kill):
   {
     "pass_id": "$PassId",
     "status": "IN_PROGRESS",
     "item": "<doc_id>",
     "note": "heartbeat during item extraction",
     "emitted_at": "$YYYYMMDDTHHMMSSZ"
   }

b. Reason over the extracted tables. Draft 1-N proposed catalog rows. Each row must be
   one of the three allowed kinds: "parameter_value", "evidence_item", or "source_lead".
   For each proposed row, provide:
   - proposed_kind: one of the three kind values above
   - proposed_payload: JSONB object matching the schema for that kind
   - confidence: float in [0.0, 1.0]
   - source_excerpt: the verbatim text or cell value from the PDF that grounds the proposal
   - extraction_pass_id: "$PassId"
   - source_doc_id: the doc_id from the manifest row

c. Validate each proposal before inserting:
   - proposed_kind must be one of the three allowed values.
   - proposed_payload must be non-null and non-empty.
   - confidence must be in [0.0, 1.0].
   - source_excerpt must be non-empty.
   If any proposal fails validation, log it to errors in progress.json under the doc_id
   with a note describing the validation failure; do NOT insert it.

d. Append the validated proposals to scripts/catalog-overnight/proposals/$PassId.json
   by importing save_proposals from extract.py and calling it (or writing the JSON
   directly). Do not connect to any database; there is no DSN. The proposals file is
   a JSON array; save_proposals handles creating the file and appending on subsequent
   calls within the same pass. If the write fails, log the doc_id to errors in
   progress.json with the error message and move on to the next item.

e. Update catalog_extraction_progress.json atomically after each item:
   - On success: add the doc_id to `completed` with value {"pass_id": "$PassId",
     "rows_proposed": <N>, "timestamp": "$YYYYMMDDTHHMMSSZ"}.
   - On error: add the doc_id to `errors` with value {"pass_id": "$PassId",
     "error": "<message>", "timestamp": "$YYYYMMDDTHHMMSSZ"}.
   - Update `last_updated` to the current timestamp in Windows-safe basic ISO format.
   Atomic write: write to a .tmp file first, then rename over the target.

f. Emit a completion breadcrumb to .tmp/catalog-overnight-breadcrumbs/ with filename
   "$PassId-$YYYYMMDDTHHMMSSZ-py.json" and the following shape:
   {
     "pass_id": "$PassId",
     "status": "COMPLETED_GREEN",
     "item": "<doc_id>",
     "rows_proposed": <N>,
     "emitted_at": "$YYYYMMDDTHHMMSSZ"
   }
   On error, use "COMPLETED_RED" in the status field and add an "error" field.

g. Check .tmp/CATALOG_EXTRACTION_STOP and .tmp/CATALOG_EXTRACTION_PAUSE before the next
   item. If either sentinel is present, stop processing items and go to Step 4.

### Step 4 -- End of session (NO slash commands)

Perform all steps below using plain Bash / PowerShell / git commands. Do NOT invoke any
slash command (they do not fire in headless -p mode).

a. Write a one-paragraph summary to CATALOG_EXTRACTION_HANDOFF.md. Move the current
   "Last Session" section text into the "Prior Sessions" section (append as a dated entry).
   Replace "Last Session" with a new entry describing this session: pass ID, items
   attempted, items completed, errors, any notes for the next session.

b. Bump the version field in the handoff doc header from the current value to the next
   integer minor version (e.g., 1.0 -> 1.1 after the first real run).

c. Stage exactly the following files using path-scoped git add (no wildcards, no -A):
     git add CATALOG_EXTRACTION_HANDOFF.md
     git add scripts/catalog-overnight/catalog_extraction_progress.json
   If catalog_manifest.csv was modified during this session (unusual but possible if you
   corrected a bad path), also stage it:
     git add scripts/catalog-overnight/catalog_manifest.csv

d. Try to commit:
     git commit -m "catalog: pass $PassId -- <N> proposed, <M> errors"

   ON COMMIT SUCCESS:
   - Append a memory anchor file at:
       C:/Users/jasen/.claude/projects/C--Projects-SSTAC-Dashboard/memory/
       dashboard_catalog_extraction_pass_<YYYYMMDD>_<first-8-chars-of-PassId>.md
     Content: one-paragraph summary matching what you wrote in the handoff doc.
   - Emit a final COMPLETED_GREEN breadcrumb to
     .tmp/catalog-overnight-breadcrumbs/$PassId-$YYYYMMDDTHHMMSSZ-py.json with:
     {"pass_id": "$PassId", "status": "COMPLETED_GREEN",
      "items_completed": <N>, "items_errored": <M>, "emitted_at": "$YYYYMMDDTHHMMSSZ"}
   - Exit 0.

   ON COMMIT FAILURE (pre-commit hook reject, lint failure, merge conflict, or any
   non-zero exit from git commit):
   - Capture the commit stderr to:
       .tmp/catalog-overnight-breadcrumbs/$PassId-commit-failure.log
   - Run a pathspec-scoped git stash to preserve this session's work without stashing
     unrelated untracked files from concurrent lanes:
       git stash push --include-untracked
                      --message "catalog-pass-$PassId-commit-failure"
                      -- CATALOG_EXTRACTION_HANDOFF.md
                         scripts/catalog-overnight/catalog_extraction_progress.json
                         scripts/catalog-overnight/catalog_manifest.csv
     (Include catalog_manifest.csv in the pathspec even if you did not modify it;
     git stash push with pathspec silently skips unmodified paths.)
   - Capture the stash ref from `git stash list | head -1` output.
   - Write the stash ref into a new "Recovery" section in CATALOG_EXTRACTION_HANDOFF.md
     using: "Stash ref: <ref> (pass $PassId; commit failed; work preserved for next session)".
   - Optionally export a patch for belt-and-braces recovery:
       git stash show -p stash@{0} > .tmp/catalog-overnight-breadcrumbs/$PassId-stash.patch
   - Emit a COMPLETED_RED breadcrumb to
     .tmp/catalog-overnight-breadcrumbs/$PassId-$YYYYMMDDTHHMMSSZ-py.json with:
     {"pass_id": "$PassId", "status": "COMPLETED_RED",
      "note": "commit failed; work stashed",
      "stash_ref": "<ref>", "emitted_at": "$YYYYMMDDTHHMMSSZ"}
   - Exit 1.

The wrapper detects your exit code: 0 = green, 1 = red, 124 = stalled (set by watchdog),
any other non-zero = red with note. Do not attempt to communicate via any other channel.

---

## Notes for wrapper substitution

The wrapper (`.claude/scripts/launch_catalog_extraction.ps1`) performs the following
string replacements in this file before passing it to `claude -p`:

- `$PassId` -> a UUID generated at wrapper startup (e.g., `a3f7c912-...`).
- `$YYYYMMDDTHHMMSSZ` -> the current UTC timestamp in Windows-safe basic ISO format
  (e.g., `20260528T230530Z`). No colons. No hyphens in the time portion. This format
  is safe for use in Windows filenames.
- `$N` -> the per-session item cap (default 3 in smoke phase; tunable via wrapper arg).

Never use extended ISO format timestamps (`2026-05-28T23:05:30Z`) in filenames. Colons
are reserved characters in Windows paths and will cause silent write failures.
