# Semantic and Promotion Readiness Packet - 2026-08-08

Status: CANDIDATE_UNVERIFIED / NOT_READY_FOR_SEMANTIC_OR_GRADUATION

This packet is non-authoritative. Use `docs/INDEX.md` for canonical navigation and
`docs/_meta/docs-manifest.json` for registered lifecycle and current-fact authority.

This packet is decision evidence only. It authorizes no Ollama invocation, lock creation or
deletion, promotion-state seed, semantic extraction, scheduled-task change, or canonical served
runtime mutation.

## Evidence snapshot boundary

Every filesystem, graph-content, and nightly-receipt observation in this packet is frozen to the
read-only evidence inspected on 2026-08-08. These observations are not live probes and must be
reverified against the selected runtime before any decision or operation. Current counted-window
and first-REPINNED status, when needed, must be read from the provenance-bearing
`facts.wiki_runtime` entries in `docs/_meta/docs-manifest.json`, not from this packet or
`facts_history`.

## 1. Frozen 2026-08-08 canonical-state snapshot

On 2026-08-08, read-only `Test-Path -LiteralPath` checks returned `False` for all four expected
artifacts:

- `C:\Projects\SSTAC-Dashboard-worktrees\wiki-runtime-9af819a-20260804\wiki\.graph\promotion.json`
- `C:\Projects\SSTAC-Dashboard-worktrees\wiki-runtime-9af819a-20260804\wiki\.graph\contradictions.json`
- `C:\Projects\OLLAMA_STANDING_BLOCK_SSTAC_WIKI.md`
- `C:\Projects\HITL_OLLAMA_THIRD_LANE_REQUEST_2026-07-22.md`

At that snapshot, the first two absences established that the inspected canonical runtime had no
promotion ledger or contradiction ledger. They did not establish why those files were absent.
There was no accepted receipt in the inspected material proving that the one-time Phase 3 baseline
was created and then lost, or that it was ever created for this runtime. The reason remains
`UNVERIFIED` until reverified evidence resolves it.

The canonical `wiki/.graph/graph.json` inspected on 2026-08-08 contained explicit `INFERRED` links
as well as `EXTRACTED` links. Those frozen bytes were not eligible for the all-`EXTRACTED` Phase 3
seed. A future seed requires a separately reviewed isolated graph-construction or reset path that
produces new candidate bytes satisfying every condition below. Never relabel or reset the
canonical graph in place to manufacture seed eligibility.

The two owner-coordination files were also absent in the snapshot. Correction Round 2 already
updated the operations runbook to record the named HITL request as absent; this packet does not
claim that the corrected runbook still says it exists. No semantic run may treat this frozen
absence as current authority without reverification.

## 2. Accepted-plan reconciliation

The accepted plan requires a Phase 3 one-time, all-`EXTRACTED` baseline before semantic promotion.
It also requires successful semantic execution in at least 5 of the latest 10 counted,
freshness-eligible nightly runs before Phase 7 graduation. The canonical state satisfies neither
condition based on this frozen evidence snapshot:

- the snapshot contained no `promotion.json` proving the Phase 3 seed;
- the snapshot contained no `contradictions.json` preserving or auditing contradiction state;
- counted-window status is intentionally not duplicated here; the canonical live value and receipt
  provenance are at `facts.wiki_runtime.counted_window` in the docs manifest; and
- the 2026-08-08 snapshot contained no standing-block or third-lane owner authorization file.

Consequently, semantic readiness and Phase 7 graduation are both blocked pending explicit owner
decisions and fresh evidence. Artifact absence must not be converted into an assumed empty baseline
by an unattended run.

## 3. Exact all-EXTRACTED seed preconditions

A future seed is eligible only when a reviewed, owner-approved harness proves all of the following
against the exact candidate graph bytes:

1. The worktree and graph source are pinned to an exact commit and are tracked-clean, unless the
   owner records a candidate-scoped exception.
2. The seed operates in an isolated candidate runtime, not the canonical served runtime.
3. The graph file exists, parses, and passes the normal graph integrity, hash-binding, and secrets
   gates.
4. Every link has an explicit confidence value equal to `EXTRACTED`.
5. There are zero links with missing confidence and zero `INFERRED`, `AMBIGUOUS`, or unknown
   confidence values.
6. The target `promotion.json` is absent. Any existing state requires a separate preservation or
   migration decision, not overwrite-by-seed.
7. The exact `promotion.py` bytes and command are independently reviewed before execution.
8. The owner approves the exact graph hash, commit, target runtime, command, and rollback packet.
9. A separately reviewed isolated graph-construction or reset path produced the eligible graph;
   it did not relabel, rewrite, or reset the canonical graph in place.

For an all-`EXTRACTED` graph, the expected seeded state is schema `v: 1`, an empty `entries` object,
and `coverage_baseline.inferred_edge_count: 0` bound to the exact commit. That expected shape is a
review criterion, not authority to create it in this lane.

### Required seed receipt schema

The seed harness must emit one immutable JSON receipt containing at least:

```json
{
  "schema_version": 1,
  "operation": "promotion_baseline_seed",
  "run_id": "unique-id",
  "started_at_utc": "RFC3339 timestamp",
  "finished_at_utc": "RFC3339 timestamp",
  "runtime_root": "absolute isolated runtime path",
  "head_sha": "40-character commit",
  "tracked_clean": true,
  "owner_exception": null,
  "graph_path": "absolute graph path",
  "graph_sha256": "64 lowercase hex characters",
  "node_count": 2,
  "link_count": 1,
  "confidence_counts": {
    "EXTRACTED": 1,
    "INFERRED": 0,
    "AMBIGUOUS": 0,
    "MISSING_OR_OTHER": 0
  },
  "all_extracted": true,
  "preseed_promotion_absent": true,
  "command_argv": ["exact", "argument", "list"],
  "exit_code": 0,
  "promotion_path": "absolute promotion path",
  "promotion_sha256": "64 lowercase hex characters",
  "promotion_schema_version": 1,
  "promotion_entry_count": 0,
  "coverage_baseline_inferred_edge_count": 0,
  "coverage_baseline_commit": "40-character commit",
  "secrets_scan_exit_code": 0,
  "result": "PASS"
}
```

The graph counts shown are a minimal illustrative eligible graph, not the graph inspected in the
2026-08-08 snapshot. Acceptance
requires `node_count > 0`, `link_count > 0`, `confidence_counts.EXTRACTED == link_count`, each of
`INFERRED`, `AMBIGUOUS`, and `MISSING_OR_OTHER` exactly zero, and the exact sum of all confidence
counts equal to `link_count`. `promotion_entry_count` and
`coverage_baseline_inferred_edge_count` must both remain exactly zero. The receipt must be rejected
if any required field is absent, any count invariant fails, any hash or commit differs, or the
on-disk file does not reproduce its recorded hash.

## 4. First semantic run without prior coverage state

The promotion implementation inspected on 2026-08-08 initialized missing state as
`{"v": 1, "entries": {}}`. Its coverage comparison used the prior inferred-edge count when
present. If that count was absent or zero, the ratio guard was inactive. Reverify those source bytes
before use. Under that inspected behavior:

- a first successful `GREEN` semantic run can create inferred entries and establish the first
  nonzero coverage baseline without a meaningful prior-coverage regression comparison;
- an explicit Phase 3 seed with inferred-edge count zero has the same first-run limitation;
- a `PARTIAL` run skips promotion and does not write the ledger, so a missing ledger remains
  missing; and
- a failed run must preserve the prior graph, promotion ledger, and contradiction ledger bytes.

The first successful semantic run is thus a bootstrap event, not ordinary steady-state evidence.
It requires attended observation, pre/post hashes, exact receipts, and a rollback decision before it
can contribute to a graduation window.

## 5. Attended semantic-canary option

The narrow safe option is an attended canary in a disposable worktree and isolated runtime:

1. Obtain owner approval for an exact, conflict-free Ollama time window and model lane. Do not infer
   authorization from an absent standing-block or request file.
2. Copy the accepted deterministic graph and any accepted seed ledger into an isolated runtime;
   record source and destination hashes.
3. Pin the worktree commit, script hashes, model identity, timeout, and exact target scope in a
   canary contract.
4. Run one bounded semantic target while an operator observes root and descendant processes.
5. Do not publish to or mutate the canonical served runtime.
6. Require a `GREEN` semantic receipt, graph integrity, expected promotion and contradiction deltas,
   hash binding, secrets scan, and explicit descendant-cleanup evidence.
7. On any timeout, partial result, custody uncertainty, or receipt mismatch, classify the canary as
   non-counting and preserve the recovery snapshot.

This option still requires the missing owner decisions below. It is not activation authority.

## 6. Descendant custody on Windows

The preferred correction is a Windows Job Object configured with
`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`. The launcher should create the root process suspended, assign
it to the Job Object before any child can spawn, resume it, retain the Job handle for the whole run,
and close the handle on timeout or cancellation. Acceptance evidence must show that the root and all
descendants exited and that no Ollama lock is released before descendant cleanup completes.

An acceptable containment alternative is a dedicated disposable Windows Sandbox or VM whose
teardown terminates the complete process boundary. If neither mechanism is ready, the only bounded
fallback is a fully attended canary with the owner explicitly accepting residual descendant-custody
risk. Killing only the root PID or relying on a scheduled-task timeout is not sufficient evidence.

## 7. Preservation and rollback checks

Before any future semantic or publication operation:

- hash the served graph, build stamp, `promotion.json`, and `contradictions.json`; record explicit
  `ABSENT` markers for missing files;
- copy the candidate graph and any state files into an ordinary recovery directory outside the
  publish destination, preserving exact bytes and hashes;
- require semantic output to preserve accepted extracted evidence and to change only reviewed
  inferred, promotion, and contradiction state;
- validate promotion schema, contradiction schema, graph integrity, community completeness, hash
  binding, and secrets before publication;
- use the existing prepare/finalize/swap publication contract only after exact receipt validation;
- if any check fails, do not publish, restore every pre-existing file byte-for-byte, and prove the
  restored hashes; and
- where the preflight marker was `ABSENT`, rollback must remove only a newly created candidate file
  inside the isolated candidate runtime. Canonical absence must not be changed without a separately
  approved activation operation.

## 8. Rolling ten-night calculation

Let the evaluation window be the latest 10 nightly runs that are explicitly marked
`freshness_eligible: true` and counted by the accepted nightly contract. Sort them by the contract's
night identity, select the latest 10, and compute:

```text
eligible_nights = count(window)                         # must equal 10
successful_nights = count(exit_code == 0 in window)    # must be at least 9
semantic_nights = count(semantic_ran == true in window) # must be at least 5
```

The single allowed unsuccessful night must be root-caused under the accepted Phase 7 criteria.
Ineligible, skipped, missing-receipt, stale-input, and bootstrap-dry-run nights do not enter the
denominator. A semantic attempt counts toward `semantic_nights` only when the accepted receipt says
semantic actually ran; merely scheduling, reserving a lane, or producing a partial result does not
count. The same selected 10-night window must be used for both thresholds.

This packet does not duplicate a current window value. Read and reverify
`facts.wiki_runtime.counted_window` in `docs/_meta/docs-manifest.json`. Its provenance-bearing live
fact, not this frozen packet and never `facts_history`, is the canonical status source. Regardless
of the current numerator, Phase 7 remains unavailable until one complete accepted ten-night window
satisfies every criterion above.

## 9. Owner decisions required before any operation

The owner must decide and record each of these separately:

1. Whether to recreate the missing Phase 3 all-`EXTRACTED` baseline, and the exact graph hash,
   commit, separately reviewed isolated construction/reset path, isolated runtime, seed command,
   and rollback bytes. The inferred-edge graph in the 2026-08-08 snapshot was ineligible and must
   not be relabeled in place; reverify any future candidate independently.
2. Whether the first semantic bootstrap run will be an attended canary, and its exact scope, model,
   time window, timeout, and counting status.
3. Whether a Job Object launcher is required before the canary or whether a named containment
   alternative and residual risk are accepted.
4. Which standing-block or third-lane coordination document supersedes the two absent files.
5. Whether a new promotion or contradiction ledger may later be activated in the canonical runtime.
6. Which receipt source defines the Phase 7 ten-night window and whether the first successful
   bootstrap run is eligible to count.

Each approval is candidate-scoped. None carries to changed graph bytes, scripts, model identity,
runtime path, or schedule.

## 10. Mission Control-authorized operational-document integration

Correction Round 2 authorized the following documentation integration with this candidate. The
edits were applied without adding activation authority.

### `docs/WIKI_KB_OPERATIONS_2026_07.md`

- Replace the manual `/sync-wiki` Graphify description with the pinned selected-runtime
  `.venv-graphify` executable and Python fail-closed rule.
- Document the full sequence: guarded update `--no-cluster`, deterministic precluster smoke,
  guarded `cluster-only --no-label --no-viz`, final canonicalization, community-required final
  smoke, hash/secrets gates, and rollback-safe publication.
- State that `-SkipGraph` requires an existing graph that passes final community completeness and
  all existing publication gates.
- Record the 2026-08-08 absence of
  `C:\Projects\HITL_OLLAMA_THIRD_LANE_REQUEST_2026-07-22.md` pending an owner-selected superseding
  coordination artifact. Correction Round 2 applied this runbook correction.
- Link both 2026-08-08 design packets and retain their non-activation verdicts.

### `docs/NEXT_STEPS.md`

- Add a dated recovery section identifying Unit A as review-ready but test-execution-blocked in the
  executor surface.
- Add Graphify MCP repair as `CANDIDATE_UNVERIFIED`, with disposable compatibility testing before
  any venv or registration change.
- Add semantic/promotion as `NOT_READY_FOR_SEMANTIC_OR_GRADUATION`, citing missing state and owner
  coordination artifacts.
- Make external Mission Control review, exact Python tests, and owner decisions the next gates.

### `docs/_meta/docs-manifest.json`

- Add manifest entries for
  `docs/design/wiki/GRAPHIFY_MCP_REPAIR_PACKET_2026_08_08.md` and
  `docs/design/wiki/SEMANTIC_PROMOTION_READINESS_PACKET_2026_08_08.md` with lifecycle `REFERENCE`.
- Expand the wiki-governance bundle triggers to include `.claude/skills/sync-wiki/**`, consistent
  with the existing glob convention. The two packet files are registered individually as REFERENCE.
- Do not register untested dependency compatibility, MCP health, semantic readiness, or Phase 7
  graduation as current live facts.

### Superseding handoff

- Not authorized in Correction Round 2 and not created. Proposed future path:
  `FRESH_SESSION_HANDOFF_2026_08_08_WIKI_CORRECTION_RECOVERY.md`.
- Record the supplied but policy-unverified baseline, exact candidate paths, Python and Git policy
  denials, test commands for Mission Control, both packet verdicts, the absence findings, forbidden
  action compliance, and the `READY_FOR_EXTERNAL_MC` ceiling.
- Do not describe MCP repair, semantic seeding, canonical publication, or Phase 7 graduation as
  completed. The handoff must point to an independent review receipt and exact accepted candidate
  hash before any next gate.

## 11. Packet verdict

`SEMANTIC_BASELINE_ABSENT` and `NOT_READY_FOR_SEMANTIC_OR_GRADUATION`.

The deterministic correction can be reviewed independently. Semantic work, promotion seeding,
Graphify MCP activation, and canonical-runtime mutation remain outside this candidate and require
the explicit gates above.
