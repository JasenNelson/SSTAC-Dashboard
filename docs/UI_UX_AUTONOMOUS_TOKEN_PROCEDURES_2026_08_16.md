# Token-efficiency procedures -- adopted mid-run 2026-08-16 (owner-directed)

Owner intervention during the autonomous run: "we need to implement token efficiency
procedures", then "use subagents to protect this session's context", then "have subagents and
workflows save outputs to file instead of dumping it into this session's context which
requires this session to subsequently process and save it".

That last one is the important correction, and it generalises past this run. Delegating work
to a subagent saves nothing if the subagent hands its output back as prose: the orchestrator
still pays to read it, still pays to hold it, and then pays a THIRD time to write it to disk.
The saving only lands when the artifact never enters the orchestrator's context at all.

## The rules, in force from 2026-08-16 05:50 UTC

**1. Subagents write deliverables to FILES. They return a receipt, not content.**
Every delegation brief must name an explicit output path and end with a return contract of the
form:

```
Write your output to <absolute path>.
Then reply with ONLY: WROTE <path> | <n> items | <one-line status>
Do not paste the content into your reply.
```

The orchestrator reads the file only if it needs to act on a specific part of it, and reads
that part surgically rather than the whole file.

**2. No polling of background tasks.** The harness sends a completion notification. Re-reading
a gate log that has not changed costs tokens and buys nothing. Before this rule landed, this
session polled two gate logs roughly eight times with no state change between most of them.
Poll only when a notification has not arrived and the elapsed time is implausible (per L0 1.13,
past ~10 minutes with no breadcrumb).

**3. Big logs are read by a subagent, never by the orchestrator.** Gate suites emit lint,
tsc, unit, build and e2e logs totalling tens of thousands of tokens. A verification subagent
reads them, corroborates each exit code against a pass COUNT (never an exit code alone), greps
for `chromium-auth`, and returns a compact block. The orchestrator sees the block.

**4. Reviewer output is read surgically.** Verdict, blocker list, file:line. Not the transcript.

**5. Batch irreversible-free operations.** One call to push and open a PR, not four round-trips.

**6. No re-reading.** A file already in context is not read again. Line numbers drift, so
re-read the SPECIFIC region before editing -- that is not the same as re-reading the file.

**7. What stays with the orchestrator.** Merge order and stacking decisions, the retarget list,
judgment on review findings, anything touching a regulatory value, and the final report. These
need the whole run in view and cannot be delegated without losing the thread.

## Applies to this project generally, not just this run

L0 CLAUDE.md 1.19 already required delegating mechanical production. What it did not say --
and what this run demonstrated -- is that the delegation must be **file-terminated**. A brief
that ends "report your findings back to me" re-imports the entire cost of the work it was
supposed to offload.
