# L3 MVP -- Status, Operations and Known Limitations

Date: 2026-09-10
Author: Claude Opus 5, acting as L3 Mission Control under the owner handoff of 2026-09-10.
Scope: Wiki-KB compilation, Graphify serving, developer retrieval, freshness, nightly operation,
rollback, and the state of milestones M3 through M6.
Run evidence root: `C:\Users\jasen\.codex\p\L3-AUTONOMOUS-RUN-20260910`

**This document states what is true, including where the MVP does not work. Nothing here claims a
quantitative efficiency benefit from Graphify; no such claim is supported by any evidence in this
run.**

---

## 1. Executive status

| Milestone | State | One-line reason |
|---|---|---|
| M2 / MVP2 | ACCEPTED (pre-existing) | Not reopened by this run. |
| M3 usefulness | **NOT ACCEPTED** | The frozen A/B is VOID (treatment never administered); the replacement capability demonstration passed on one task of two. |
| M4 semantic canary | **BLOCKED** | No reserved GPU window, Ollama not running, two contract-specified owner approvals outstanding, and a frozen sampling stratum is empty. |
| M5 observation | **BLOCKED, and the nightly is BROKEN** | The unattended nightly has failed two consecutive nights; root cause identified below. |
| M6 documentation | This document, plus the run evidence index. | |

**The single most important operational fact in this document is in section 5: using the Graphify
MCP capability in an interactive session currently prevents the nightly refresh from running.**

---

## 2. Architecture, as it actually runs

- **Accepted graph**: `C:\Projects\SSTAC-Dashboard-worktrees\wiki-runtime-9af819a-20260804\wiki\.graph\graph.json`
  - SHA-256 `40DAB025C918F235E390FBC2C94B5FBD2358AE902D5A62040D27EB6C6253AE5A`
  - `built_at_commit` `3600a18fb6b9944368c45ce1843245df2e508abb`
  - 12464 nodes / 24548 edges / 706 communities; 99% EXTRACTED, 1% INFERRED (323 inferred edges)
  - (Identity as measured 2026-09-10 -- the state the L3-M2 acceptance bound. The nightly
    republished the served graph on 09-11 and 09-12; the graph.json at this path as of
    2026-09-12 hashes to sha16 `8626515afac16da950fb` (mtime 2026-09-12 05:30:37). The
    40DAB025 identity above is the accepted-snapshot record, not the current served bytes.)
- **Server**: exactly one `graphify` MCP registration exists, under project key
  `C:/Projects/SSTAC-Dashboard` in `~/.claude.json`, launching
  `<runtime>\.venv-graphify\Scripts\python.exe -m graphify.serve <accepted graph> --transport stdio`.
- **Runtime ownership**: the served runtime worktree above is the operational root. The repository
  worktree is the source of truth for `tooling/wiki`. They are different trees; do not confuse them.

### Node and edge composition (measured)

| node file_type | count |
|---|---|
| code | 9392 |
| document | 2467 |
| concept | 407 |
| rationale | 198 |

INFERRED (semantic) edge endpoints are ONLY `(code, code)` 284 and `(code, concept)` 39.
**Zero inferred edges touch a `document` node or a `.md` source file.**

---

## 3. Developer workflow: how to actually get value from the graph

The graph is genuinely useful for locating structure, and the demonstration proved it: one query
returned the entire `publish_wiki.py` call structure with exact line numbers, every one of which
verified against source, and the resulting answer scored 6 of 6 on the frozen rubric from only 6
source reads with zero invented paths.

**The rule that decides whether it helps you:**

> `query_graph` seeds its traversal from node LABELS. Seed it with an IDENTIFIER -- a file name, a
> function name, a class name. Prose does not work.

- `query_graph("swap_staging")` -> 9 nodes and 8 edges, placing the function at
  `tooling/wiki/publish_wiki.py L155` with everything it calls.
- `query_graph("protected path refusal")` -> one node named `Path`, no source, no edges. Useless.

Both queries are about the same codebase. The difference is entirely the seed.

Recommended loop: **locate with the graph, then read the source to confirm.** Use `god_nodes()` or
`get_node(<label>)` to find real anchors when you do not yet know an identifier.

### `tooling/wiki/graph_query_assist.py`

A transparent MCP relay that fronts the same upstream server and APPENDS an explicit diagnostic when
a `query_graph` result is degenerate (every returned node has an empty `src`). Healthy responses pass
through byte-identical; tool names and schemas are untouched; all other tools are unaffected.

It exists because the degenerate case previously returned nothing useful **while still reporting
success**, so a caller could not distinguish "no such structure exists" from "you seeded badly".

Run it as:

```
python tooling/wiki/graph_query_assist.py --graph <graph.json> [--upstream-python <exe>]
```

**Measured behaviour**: 0 false positives across 571 real upstream results. It is deliberately
narrow -- it fires only when nothing returned can be opened or cited.

**Honest limitation**: it makes the failure VISIBLE; it does not make retrieval succeed. In the
final demonstration the diagnostic fired correctly and the session did not act on it.

---

## 4. Wiki-KB build and refresh

The nightly pipeline is `tooling/wiki/nightly_wiki_sync.ps1`, run by scheduled task
`SSTAC-Wiki-Nightly` at 05:30 daily, in stages N0 through N6 (preflight, scope+hash and build,
cluster, secrets scan, smoke, semantic, publish). On-demand recompilation is `/sync-wiki`.

A healthy run writes, under `<runtime>\.tmp_wiki_nightly\`: a ~2148-byte transcript, a process
custody baseline AND terminal record, a prepublish smoke, a canonicalization record, a terminal
receipt, and `receipt-<date>.md`.

---

## 5. THE NIGHTLY IS CURRENTLY BROKEN -- root cause and recommended fix

**Symptom (as measured 2026-09-10; historical -- receipts for 09-11 and 09-12 now exist via
the no-MCP-at-05:30 mitigation, not the fix; see the SESSION-3 block below).** Receipts
stopped at `receipt-2026-09-08.md` through that morning. The freshness watchdog reports a
stale receipt and infers the nightly "is not running". That inference is wrong.

**What is actually happening.** The task runs exactly on schedule and FAILS.
`SSTAC-Wiki-Nightly` last ran 2026-09-10 05:30:01 with `LastResult = 1`. The 09-09 and 09-10
transcripts are 1704 bytes instead of 2148 and stop at N0:

```
check_orphans.ps1 : Baseline contains non-Graphify relevant identity
```

`tooling/wiki/check_orphans.ps1:582` refuses and exits 1 whenever the process custody baseline
contains a "relevant" process that is not on the Graphify allowlist. (Line reference corrected
2026-09-12: the refusal sits at :473 on main, sat at :578 in this delta before the session-3
comment correction, and sits at :582 in the branch as of 2026-09-12.)

**Root cause, identified to the process.** The 2026-09-10 baseline records 4 relevant identities,
2 of them disallowed. Resolved against the live process table:

| PID | Command | Classed |
|---|---|---|
| 11416 | `<runtime>\.venv-graphify\Scripts\python.exe -m graphify.serve <accepted graph>` | allowed |
| 38980 | `...\Programs\Python\Python311\python.exe -m graphify.serve <same graph> --transport stdio` | **disallowed** |

PID 38980's parent is PID 11416. **The disallowed process is a child spawned by the allowed
Graphify server**, running the same module under the SYSTEM interpreter rather than the runtime
venv interpreter. PID 11416's own parent is `claude.exe` -- an interactive Claude Code session.

**Consequence, and why this is the headline issue.** Any interactive session holding the Graphify
MCP server open at 05:30 causes the nightly to abort at N0. That is precisely what the capability
is FOR. Two consecutive nights have already been lost this way, silently.

**STATUS (as reviewed 2026-09-10): NOT SHIPPABLE AS IT STANDS. DO NOT MERGE THIS CHANGE YET.**
(The session-3 block below records what has since been completed on this branch; the merge
and the runtime repin remain owner-gated regardless.)

A second adversarial review found that the fix is INCOMPLETE in a way that makes the outcome WORSE,
not better. `check_orphans.ps1` is not the only consumer of the process classification:
`tooling/wiki/nightly_terminalizer.ps1:40` and `tooling/wiki/activation_preflight.ps1:317` both
assert `$RequireGraphifyClass = $true` over every baseline, terminal and departed identity, and
both REJECT the new `PREEXISTING_GRAPHIFY_MCP_CHILD` class.

Consequence on exactly the night this fix targets: the run would clear N0, execute the ENTIRE
pipeline, and then die at `nightly_wiki_sync.ps1:682` with no terminal receipt and no
`receipt-<date>.md` -- strictly worse than today's fast N0 abort, because it burns the whole run and
leaves less evidence. The in-code comment claiming "three call sites" is also wrong; there are five.

Completing this fix means teaching all five consumers the new class, with tests driving each of the
two additional consumers. That work is NOT done and is NOT in this change.

### SESSION-3 CORRECTION COMPLETED (2026-09-12)

The completion this section demanded is now DONE on this branch (owner decision "RESUME
SESSION 3 NOW", 2026-09-12):

- All FIVE consumers now gate on the same two-value allowlist: the three call sites inside
  `check_orphans.ps1` (which share `$script:allowedProcessClasses`), plus
  `nightly_terminalizer.ps1` `Assert-SstacIdentitySummary` and `activation_preflight.ps1`
  `Assert-CustodyIdentity`, which each carry their own copy of the allowlist. The false
  "three call sites" comment now names all five.
- Both external consumers are driven by new tests that publish/verify a receipt whose
  baseline and terminal identities carry `PREEXISTING_GRAPHIFY_MCP_CHILD`:
  `test_terminalizer_accepts_promoted_graphify_child_class` (wrapper contracts) and
  `test_execution_proof_accepts_promoted_graphify_child_class` (activation preflight).
  Both were RED against the unpatched consumers, are GREEN against the patched ones, and
  removing the child class from either consumer's allowlist in a scratch mutant kills its
  named test (U1a, U1b).
- The two `doc_code` exclusions (`CASE_MISMATCH`, `TARGET_HAS_NO_SOURCE_FILE`) are now
  falsifiable: `TestExclusionGrounding` kills the three round-2 surviving mutants (D1,
  D2, D3) by name.
- Suites after the correction: wrapper contracts 110/110, activation preflight 77/77,
  doc_code 18/18, all with PYTHONDONTWRITEBYTECODE=1. The pre-existing unrelated
  SyntaxWarning at `test_activation_preflight.py:389` is unchanged.
- The two-sided operational proof was re-run against the 9ce0917c session-3 artifact (the
  landing-prep delta is comment-only; the classified behavior is unchanged) -- see the
  CORRECTION note under the repin section below.
- Six-gate and adversarial-review status for the session-3 correction is recorded in the
  session-3 evidence file in the run evidence root, not here.

The runtime REPIN (decision D2) remains owner-gated: the installed runtime still runs the
7b2bed3dc5c6d733 checker, so merging alone still does not recover the nightly. The 09-11 and
09-12 receipts came from the mitigation (no interactive Graphify MCP session open at 05:30),
not from any fix landing.

One post-repin case is costlier than before the correction, stated for completeness: a child
legitimately promoted at baseline whose owning server exits DURING the run is no longer
caught at N0 -- it fails at terminalization after the full pipeline has run, leaving the
T3-covered terminal_disallowed evidence but no receipt-<date>.md (the same degraded-child
path test_terminal_degradation_of_a_previously_promoted_child_fails_even_without_a_new_survivor
pins). Every other observed case is unchanged or improved.

**Everything below describes the fix as designed and as far as it was verified. It remains accurate
about `check_orphans.ps1` itself, and it is NOT sufficient to ship.**

`check_orphans.ps1` now classifies a
`graphify.serve` helper as `PREEXISTING_GRAPHIFY_MCP_CHILD` -- but ONLY when all three hold: it is
not already allowed; it satisfies the exact module / accepted-graph / transport invariant
(`python.exe`, exactly one `-m graphify.serve`, exactly one `-m` total, exactly one
`--transport stdio`, exactly one `--transport` total, and an exact argument token for THIS
runtime's `wiki/.graph/graph.json`); and its ancestry provably reaches a process classified
`PREEXISTING_GRAPHIFY_MCP` in the SAME snapshot.

This does NOT broadly allow `python.exe`. A process with no `graphify.serve`, a different graph, an
extra `-m`, a non-python image, or no ancestry to a real server all remain DISALLOWED.

**Operational proof, two-sided, on LIVE process data -- AS MEASURED 2026-09-10, SUPERSEDED.**
A fixture built from the real process table (525 rows, including the two standing venv -> SYSTEM
Graphify pairs) was run through the ORIGINAL checker and the fixed one (SUPERSEDED 2026-09-12 by
the re-run against the FINAL artifact recorded in the CORRECTION note below, which measured the
same two-sided outcome on one live pair -- ORIGINAL allowed=1 disallowed=1 vs FIXED allowed=2
disallowed=0. The figures below are the 09-10 two-pair measurement and are NOT current):

    ORIGINAL  exit=1  result=FAIL  allowed=2  disallowed=2   <- exactly the 09-09 / 09-10 failure
    FIXED     exit=0  result=PASS  allowed=4  disallowed=0   <- the nightly proceeds past N0

**KNOWN LIMITATION, deliberate:** a `graphify.serve` spawned DIRECTLY under the system interpreter
by a session -- not descended from a venv server -- is still DISALLOWED and will still block a
nightly. That is the conservative reading: such a process is an ad-hoc, unmanaged consumer of the
runtime graph. Both real failures were the descendant pattern.

### THE FIX DOES NOT TAKE EFFECT UNTIL THE RUNTIME IS REPINNED

The scheduled task executes the RUNTIME worktree's OWN copy of the pipeline, and that runtime is
pinned -- N0 records `PINNED_INSTALLED_RUNTIME (3600a18f...)` every run. Measured:

    runtime tooling/wiki/check_orphans.ps1   sha16 7b2bed3dc5c6d733   HEAD 3600a18f
    main    tooling/wiki/check_orphans.ps1   sha16 7b2bed3dc5c6d733   identical
    fixed   tooling/wiki/check_orphans.ps1   sha16 8d1b1d251fcbb226   (landing-prep final, 2026-09-12; was 9ce0917c0cefb70c before the comment correction)
    occurrences of the fix in the runtime copy: 0

CORRECTION (2026-09-12, session 3): this block previously recorded the fixed checker as
sha16 b83d7bb9eab9f7b7 -- the pre-T1/T3 artifact, superseded before the branch was pushed.
The shipped pre-session-3 file hashed 0a93c93988c983a71b92; after the session-3 completion
it hashed 9ce0917c0cefb70c, and after the landing-prep comment correction (2026-09-12) it
hashes 8d1b1d251fcbb226. The two-sided operational proof above was originally run against
the superseded b83d7bb artifact; it was re-run on 2026-09-12 against the 9ce0917c artifact
(comment-only edits followed; the classified behavior the proof exercised is unchanged), on
live process data (the standing venv server and its system-interpreter child captured from
the running machine, full command lines, no truncation; the snapshot's two Graphify rows are
live-captured, while its wrapper parent and checker rows follow the synthetic fixture shape
the wrapper-contract tests use):

    ORIGINAL  exit=1  result=FAIL  allowed=1  disallowed=1   <- child classed DISALLOWED_RELEVANT_PROCESS
    FIXED     exit=0  result=PASS  allowed=2  disallowed=0   <- child promoted to PREEXISTING_GRAPHIFY_MCP_CHILD

**Merging the fix to `main` leaves the runtime running the OLD checker and the nightly keeps
failing.** Recovering it operationally requires REPINNING the installed runtime to a commit that
contains the fix -- an activation-class mutation and an owner decision.

**Interim mitigation, still valid until the repin:** ensure no interactive session is holding a
Graphify MCP server open against the runtime graph at 05:30.

---

## 6. Rollback

Publish and rollback live in `tooling/wiki/publish_wiki.py` as the `prepare`, `finalize` and `swap`
subcommands. There is no `publish()` or `rollback()` function. Rollback is inline inside
`swap_staging()` with two triggers: the staging-to-served rename failing, and post-swap
verification of the served `graph.json` SHA-256 failing. On rollback the previously served tree is
restored from backup and the rejected candidate is retained at staging for inspection. The swap is
a directory RENAME gated on the staged `graph.json` matching an expected SHA-256, plus a
no-symlink/junction validation of the tree.

**This run performed no publish, no swap, and no rollback. The served package was not modified.**

---

## 7. Monitoring and failure recovery

- **Freshness watchdog**: reports receipt age (48h default). It correctly detects staleness but
  cannot tell "not running" from "running and failing" -- see section 5. When it fires, check
  `Get-ScheduledTaskInfo SSTAC-Wiki-Nightly` (`LastResult`) and the newest transcript in
  `<runtime>\.tmp_wiki_nightly\` BEFORE concluding the scheduler is at fault.
- **Diagnosing a failed nightly**: compare transcript sizes. A short transcript with only a
  `process-custody-baseline-*.json` and no `terminal-receipt-*.json` means the run aborted in N0.
- **Other scheduled tasks**: `SSTAC-Wiki-FirstNightly-Verify-20260724` last ran 2026-07-30 with a
  non-zero result and `SSTAC-Wiki-Nightly-Streak-Verify` has never run. Both look vestigial and
  should be reviewed or removed.

---

## 8. Semantic layer (M4) -- status and a blocking finding

M4 requires at least 60 eligible inferred edges (**323 available -- satisfied**) sampled across
three frozen strata with **ten each**: DOC_CODE, CROSS_COMMUNITY, CROSS_FILE_CODE_CODE.

Measured against the accepted graph:

| stratum | available | required |
|---|---|---|
| DOC_CODE | **0** | 10 |
| CROSS_COMMUNITY | 70 | 10 |
| CROSS_FILE_CODE_CODE | 174 | 10 |

**M4's sampling design could not be satisfied as written.** Verified two ways: inferred edge endpoint
`file_type` pairs are only `(code,code)` and `(code,concept)`, and zero inferred edges have even one
endpoint whose `source_file` ends in `.md`.

Sharper still, and worse than first stated: there are **zero `(code, document)` edges in EITHER
layer**. The EXTRACTED layer contains 2411 `(document, document)` edges and 22 `(concept, document)`,
but not one document-to-code edge. Documentation is a well-connected island that never touches code.
For a Wiki-KB whose purpose is connecting documentation to the code it describes, the most valuable
edge type is structurally absent.

### RESOLVED (2026-09-10, second session) -- and without a GPU

`tooling/wiki/doc_code_candidates.py` mines the bridge signal that already exists in the corpus:
documentation cites code in BACKTICKS, the same convention the docs-trust mechanism already relies
on. A cited span becomes a candidate only when it resolves EXACTLY to an existing code node -- by
that file's FILE-LEVEL node, or by an unambiguous label -- and each citation is attributed to the
enclosing document section.

    581 candidates | 270 distinct code targets | 480 distinct (doc section -> code file) pairs
    independent audit: quoted text present at the cited line 60/60; every sampled target file
    exists on disk (193 distinct target files across the pool)
    top targets: database_schema.sql 67, api-guards.ts 36, pack-types.ts 25, route.ts 21

CORRECTION, recorded rather than quietly edited: this block previously read 591 / 277 / 489 and
"target files on disk 297/297". Those were the figures from BEFORE the resolver was tightened for
case-sensitivity and empty target files, and the 297 was internally impossible -- it exceeded the
pool's own distinct-target count. An independent review caught all of it. The figures above are the
shipped generator's own output.

FALSE-POSITIVE ESTIMATE, from independent audit: roughly 3% on endpoint identity (upper bound ~5%).
The wrong ones are an output label resolving to a same-named function, and about eight database
object names resolving to a validation query or a draft .sql under docs/ rather than the defining
migration. The RELATION-level rate is materially higher than that: much of the pool is changelog or
status prose that merely MENTIONS a file rather than documenting it. Treat these as candidates for
review, which is what they are, and not as established edges.

Properties that matter: it needs **no model, no Ollama and no GPU**, so it runs outside the shared-GPU
schedule entirely; the canonical served graph is opened READ-ONLY and verified byte-identical before
and after every run; nothing is promoted; and an ambiguous label is EXCLUDED rather than guessed.

Grounding is what makes this usable without weakening M4: its support rubric holds that an edge is
supported only when grounded in exact cited content from the authenticated source snapshot, and a
backtick citation IS exact cited content.

**The DOC_CODE stratum is no longer the blocker.** M4 still requires the owner-gated model, lock,
GPU window, seed and disposable root, plus canary and promotion approvals.

M4 additionally requires a reserved GPU window and explicit owner approval for model, lock, window,
seed and disposable root, plus separate approval for the canary and for promotion.

CORRECTION: an earlier revision of this line claimed "none exists; per-day schedule files end
2026-07-27". That was FALSE and an independent review caught it. There are 51 `OLLAMA_SCHEDULE_*`
files including one for TODAY, and today's drift log records real runs completing this morning
(openharness-dev labeling COMPLETED_GREEN 03:30, semantic extract COMPLETED_RED 03:37). The
protocol is live and in daily use, and `C:\Projects\OLLAMA_ACTIVE.lock` is currently free.

So the accurate constraint is NOT "no schedule exists". It is that SSTAC must negotiate a block
under `OLLAMA_SCHEDULE_PROTOCOL.md` (two active lanes maximum; a third writes a HITL request), and
that the owner-gated model, lock, seed and disposable-root approvals are still outstanding. Ollama
was not running when checked, which is a startup step rather than a blocker.

---

## 9. Known limitations, stated plainly

0. **THE EXACT M3 LIMITATION, as recorded by independent verification.** Graphify retrieval returns
   correct, citable structure when seeded with an IDENTIFIER (file, function or class name), and
   nothing usable when seeded with a prose description. Across three rounds on the live graph the
   consuming agent could not be induced to switch -- not by an in-prompt explanation of the seeding
   mechanic, not by an in-band diagnostic naming the correction. **Treat identifier-seeded query as
   the only supported usage, and treat an empty or single-generic-node result as UNKNOWN, never as
   evidence the structure is absent.** No efficiency, speed or operation-count benefit has been
   established; none may be claimed from the M3 evidence, which is a capability demonstration only.

0a. **`src_grep` LIED ON DIRECTORY PATHS -- NOW REPAIRED, and the conclusion it corrupted has been
   re-established.** In the M3 sealed-snapshot source proxy, `src_grep` given a DIRECTORY path
   silently returned success with NO results instead of searching it or refusing. In the final
   demonstration a session issued seven such non-searches and then wrote "I searched the entire
   snapshot ... found no matches" -- a false statement produced by a tool reporting success for work
   it never did.

   REPAIRED in sealed successor packet `L3-M3-PRE-ARM-PACKET-R5-R4`
   (`E6F08DC5CAEAB500EAA91A965764AE497C42F0E5A556B62DB3216D5176CD5D2D`, 63 members): a directory now
   expands recursively within the allowlist-bounded root and is searched; a non-existent path and an
   empty expansion both FAIL LOUDLY. Predecessors R5-R3 and R5-R2 verified unmodified.

   RE-ESTABLISHED, and it revises the M3 reading: a working search WOULD have returned
   `is_untrusted_source_path` (must-have **M5.5**, 1 file) and `_is_link_or_junction` (must-have
   **M5.4**, 2 files) -- precisely the two enforced-guard facts task_5 missed. The defect
   **materially caused** task_5's 1/6; it was not merely a contributing factor. M5.2 and M5.3 were
   independently confirmed correct in the same pass (`REFUSED_TOOLING_CHANGE` occurs **0** times in
   `nightly_wiki_sync.ps1`, and `WIKI_KB_OPERATIONS_2026_07.md:674` does assert it is "LIVE today").

1. **Retrieval is seed-dependent.** Identifier seeds retrieve precisely; prose seeds collapse. The
   assist wrapper makes that visible but does not fix retrieval. Independent verification of the
   final round classified the fix's effect as **IMPROVED_OBSERVABILITY_ONLY**: the diagnostic fired
   correctly on the degenerate result and stayed silent on the good one, and the session made zero
   further graph calls in response.
2. **A degenerate query still reports success at the protocol level.** Only the appended diagnostic
   distinguishes it.
3. **Only `query_graph` has been exercised end to end.** `get_node`, `get_neighbors`,
   `get_community`, `shortest_path`, `god_nodes` and `graph_stats` respond correctly to direct
   probes but have not been demonstrated in a task setting.
4. **No efficiency claim is supported.** The A/B that would have measured it is void.
5. **Upstream NODE/EDGE ordering is non-deterministic across process launches** (hash-seed
   dependent). Any comparison of graph output must pin `PYTHONHASHSEED` or compare as sets.
6. **The nightly is broken** (section 5).
7. **No document-to-code semantic edges exist** (section 8).

---

## 10. Next-session recovery

Read, in order:
1. `C:\Users\jasen\.codex\p\L3-AUTONOMOUS-RUN-20260910\RUN_STATE.md` -- full chronological state.
2. `...\EVIDENCE_INDEX.jsonl` -- every claim with its verification verdict.
3. `...\OWNER_DECISIONS.md` -- the two owner decisions governing this run.
4. This document.

Open owner decisions are listed in `OWNER_DECISIONS.md`. The powered n=3 usefulness study is
POST-MVP BACKLOG: its design and the measured A/A noise baseline (spread -0.148 to +0.667, which
brackets the 0.20 and 0.30 acceptance floors at n=1 per cell) are preserved in the run root and must
not be re-executed as part of the MVP.
