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
as well as `EXTRACTED` links.

CORRECTED 2026-08-09 -- THIS IS NORMAL, NOT A DEFECT AND NOT INELIGIBILITY. Graphify legitimately
emits `INFERRED` links; a canonical graph containing them is the expected steady state, not a
degraded one. An earlier revision of this packet treated the presence of `INFERRED` links as
disqualifying and required an all-`EXTRACTED` graph before seeding. That requirement is WITHDRAWN in
full. It was unsatisfiable without falsifying the graph, and the only ways to "satisfy" it would
have been to relabel inferred links or to reset the graph until they disappeared -- i.e. to
manufacture a seed by destroying real information.

**NEVER relabel, rewrite, downgrade, or reset the canonical graph, or any candidate graph, to
manufacture an all-`EXTRACTED` seed.** The seed must describe the graph as it actually is. The
corrected seed contract below is built on inferred-edge IDENTITY, not on inferred-edge absence.

The two owner-coordination files were also absent in the snapshot. Correction Round 2 already
updated the operations runbook to record the named HITL request as absent; this packet does not
claim that the corrected runbook still says it exists. No semantic run may treat this frozen
absence as current authority without reverification.

## 2. Accepted-plan reconciliation

The accepted plan requires a one-time Phase 3 promotion baseline before semantic promotion, and
successful semantic execution in at least 5 of the latest 10 counted, freshness-eligible nightly
runs before Phase 7 graduation.

CORRECTED 2026-08-09: the baseline is NOT an all-`EXTRACTED` baseline. It is a full, exact
enumeration of the graph's inferred-edge identity set (section 3). The canonical state satisfies
neither condition based on this frozen evidence snapshot:

- the snapshot contained no `promotion.json` proving the Phase 3 seed;
- the snapshot contained no `contradictions.json` preserving or auditing contradiction state;
- counted-window status is intentionally not duplicated here; the canonical live value and receipt
  provenance are at `facts.wiki_runtime.counted_window` in the docs manifest; and
- the 2026-08-08 snapshot contained no standing-block or third-lane owner authorization file.

Consequently, semantic readiness and Phase 7 graduation are both blocked pending explicit owner
decisions and fresh evidence. Artifact absence must not be converted into an assumed empty baseline
by an unattended run.

## 3. Exact inferred-identity seed preconditions

WITHDRAWN, in full, 2026-08-09: every all-`EXTRACTED`, zero-`INFERRED`, and empty-ledger
prerequisite that previously appeared in this section. No operative requirement anywhere in this
packet may demand a graph with zero inferred links, nor an empty `entries` object, nor
`coverage_baseline.inferred_edge_count: 0`. Any residual sentence implying otherwise is superseded
by this section.

### Inferred-edge identity (normative definition)

An inferred edge's identity is exactly the tuple:

    (source, target, relation)

The UNIQUE INFERRED IDENTITY SET is the set of distinct such tuples over all links whose confidence
is `INFERRED`. Two links with the same tuple are the SAME identity and collapse to one member; the
difference between the raw count and the unique count is the DUPLICATE COUNT, which must be
reported, never silently discarded.

#### Canonical encoding, ordering, and hashing (exact)

A tuple set cannot be hashed reproducibly without pinning the encoding to the byte. Naive joining
with a separator is NOT acceptable: with a plain `|` join, `("a|b", "c", "r")` and
`("a", "b|c", "r")` produce identical bytes, so two distinct edges would silently collapse into one
identity. The procedure is exactly:

1. **Input domain.** Operate on JSON-DECODED Unicode scalar strings -- the values as produced by a
   conforming JSON parser, not the raw escaped source text. A field written in the ledger as
   `"a\/b"` and one written as `"a/b"` both decode to the three-character string `a/b` and are
   therefore the SAME field value, which is correct. Hashing the raw source text instead would make
   two identical strings hash differently purely because of escaping.
2. **Encoding.** Encode each field with STRICT UTF-8 (no surrogate passthrough, no
   `surrogateescape`, no replacement characters). An unencodable value fails closed.
3. **No normalization.** Apply NO trimming, case-folding, Unicode NFC/NFD normalization, or path
   separator rewriting. Bytes are taken as they are.
4. **Length prefix.** Emit the field's UTF-8 BYTE LENGTH as MINIMAL ASCII DECIMAL -- digits `0`-`9`
   only, NO leading zeros, with the single exception that a zero-length field is exactly `0` --
   followed by one ASCII colon `0x3A`, followed by the raw UTF-8 bytes:

       encode(field) = minimal_ascii_decimal(utf8_len(field)) + ":" + utf8_bytes(field)
       encode(edge)  = encode(source) + encode(target) + encode(relation)

   Length prefixing makes the encoding injective: no combination of field contents can produce the
   same byte string as a different triple.
5. **Ordering.** Sort the encoded edge records by RAW BYTE sequence ascending (`bytes` comparison).
   Not by locale, not by code point of the decoded string, not by any language's default collation.
6. **Set hash.** Concatenate the sorted records, each terminated by exactly one `0x0A` byte, and
   take SHA-256 over the resulting byte stream. Record the digest as LOWERCASE hex.

**Algorithm identifier (stable).** This procedure is
`sstac-wiki/inferred-identity/v1` (length-prefixed strict-UTF-8 triple records, raw-byte sort,
`0x0A` terminator, lowercase SHA-256). Any future change to encoding, ordering, terminator, or
digest MUST take a new identifier; receipts record the identifier they were produced under so two
digests are never compared across versions.

**Empty set.** Zero records means zero bytes hashed, so the digest is literally:

    e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

**Test vectors** (a conforming implementation must reproduce all of these):

| Case | Input triple(s) | Encoded bytes (record, before the `0x0A`) |
| :--- | :--- | :--- |
| ASCII | `("a", "b", "references")` | `1:a1:b10:references` |
| Empty-length field | `("", "b", "r")` | `0:1:b1:r` |
| Separator safety A | `("a|b", "c", "r")` | `3:a|b1:c1:r` |
| Separator safety B | `("a", "b|c", "r")` | `1:a3:b|c1:r` |
| Non-ASCII (2-byte) | `("\u00E6", "b", "r")` as written in JSON | `2:` + `0xC3 0xA6` + `1:b1:r` |
| Non-ASCII (4-byte) | `("\uD83D\uDE00", "b", "r")` as written in JSON | `4:` + `0xF0 0x9F 0x98 0x80` + `1:b1:r` |

The two non-ASCII inputs are given as LITERAL ASCII JSON ESCAPES so this document has no ambiguous
bytes of its own. **JSON DECODING PRECEDES HASHING.** `"\u00E6"` decodes to the single scalar
U+00E6 and `"\uD83D\uDE00"` decodes -- via surrogate-pair combination -- to the single scalar
U+1F600. It is those DECODED scalars that are UTF-8 encoded and length-prefixed. Never hash the
escape text itself, and never treat an unpaired surrogate as a scalar: that fails closed under the
strict-UTF-8 rule above.

Separator-safety A and B MUST produce different bytes (a naive `|` join makes them identical). The
non-ASCII vectors confirm the prefix counts UTF-8 BYTES of the DECODED scalar, not characters and
not escape-text length: U+00E6 is length `2` and U+1F600 is length `4`, never `1` and never `6`.

The same procedure over the same graph bytes must reproduce the same digest on any machine.

#### GRAPH extraction: missing, empty, and non-string fields

Silently defaulting a field is how two different edges become one identity, so each case is decided
explicitly. For links read FROM THE GRAPH:

- `relation` KEY ABSENT: substitute the literal string `references`, matching Graphify's current
  behaviour for an unlabelled link. Every such substitution increments
  `graph_relation_defaulted_count`, which is recorded in the receipt and is visible in the identity
  set. If the owner prefers that the code emit the relation explicitly instead, that is an
  OWNER-GATED code correction and the seed must not proceed on the defaulting path.
- `relation` present but `null`, EMPTY, or NON-STRING: fail closed (`INVALID_RELATION`). These are
  NOT the same as an absent key and must never be promoted to `references`.
- `source` or `target` absent, `null`, empty, or non-string: fail closed (`INVALID_ENDPOINT`).
  There is no defensible default for an endpoint; inventing one fabricates graph structure.
- Never coerce with `str()`. Coercion is how `1` and `"1"` become one identity.

#### LEDGER entries: no defaulting, ever

A promotion entry is authored BY THE SEED, so it has no excuse for an absent field. Every ledger
entry MUST carry explicit, nonempty, string `source`, `target`, and `relation`. There is NO
`references` default on the ledger side and no inference from any other field: a missing, null,
empty, or non-string value fails closed (`INVALID_LEDGER_ENTRY`). The graph-side default exists only
to describe what the graph already means; applying it to the ledger would let the ledger invent
identities the graph never asserted.

#### Duplicate-preserving raw inspection (before materialization)

Ordinary JSON parsing SILENTLY DISCARDS duplicate object members -- `{"k":1,"k":2}` materializes as
one key. A ledger containing a repeated key would therefore look clean after parsing while actually
being malformed. Before any ordinary materialization, the raw ledger JSON must be inspected with a
duplicate-PRESERVING parse (for example a hook that receives the member list before dict
construction), and `raw_duplicate_json_member_count` recorded.

#### Counters that must all be zero

- `raw_duplicate_json_member_count` -- repeated JSON object members in the raw ledger.
- `tuple_to_serialized_key_collision_count` -- distinct `(source, target, relation)` triples that
  map to the SAME serialized key string.
- `serialized_key_mismatch_count` -- entries whose stored key differs from the key re-derived from
  that entry's own fields.
- `duplicate_serialized_key_count` -- serialized keys appearing more than once.
- `collision_count` -- distinct triples mapping to one canonical ENCODED record. The encoding is
  injective, so this must be structurally impossible; it is still computed and asserted rather than
  assumed.

**Every one of these must be exactly 0.** Any nonzero value fails the seed closed, and any
migration to repair it is OWNER-GATED. Duplicate LINKS sharing one identical triple are not
collisions -- they are counted in `inferred_identity_duplicate_count`.

A future seed is eligible only when a reviewed, owner-approved harness proves all of the following
against the exact candidate graph bytes:

1. The worktree and graph source are pinned to an exact commit and are tracked-clean, unless the
   owner records a candidate-scoped exception.
2. The seed operates in an isolated candidate runtime, not the canonical served runtime.
3. The graph file exists, parses, and passes the normal graph integrity, hash-binding, and secrets
   gates.
4. Every link carries an explicit, recognized confidence value. Unknown or missing confidence is a
   hard failure. `INFERRED` links are EXPECTED and are not a failure.
5. The inferred-edge identity set is computed exactly as defined above, over a deterministic
   ordering, so the identity-set hash is reproducible from the same graph bytes.
6. The target `promotion.json` is absent. Any existing state requires a separate preservation or
   migration decision, not overwrite-by-seed.
7. The exact `promotion.py` bytes and command are independently reviewed before execution.
8. The owner approves the exact graph hash, commit, target runtime, command, and rollback packet.
9. The candidate graph was produced by a normal, reviewed build path. It was NOT relabeled,
   rewritten, downgraded, or reset -- in the canonical runtime or anywhere else -- to change which
   links count as inferred.

### The binding equalities

The seeded ledger must describe the graph exactly. Both identity hashes below are computed from the
`source`/`target`/`relation` FIELDS via the canonical procedure above -- never from a ledger key
string parsed back into fields, and never from a whole-object JSON dump that would fold in unrelated
attributes.

Acceptance requires ALL of:

1. `collision_count == 0` (above).
2. `graph_inferred_identity_set_sha256` -- computed from the GRAPH's inferred link fields.
3. `ledger_identity_set_sha256` -- computed from each promotion ENTRY's own recorded
   `source`/`target`/`relation` fields, through the identical canonical procedure.
4. `graph_inferred_identity_set_sha256 == ledger_identity_set_sha256`.
5. `promotion_entry_count == inferred_identity_unique_count`.
6. `coverage_baseline.inferred_edge_count == inferred_identity_unique_count`.

**Serialized ledger keys are validated SEPARATELY, as a second check, not as the identity itself.**
Whatever string form the ledger uses for its keys, re-derive the expected key string for each entry
from that entry's own fields and require an exact match, and require the key set to be a bijection
onto the entry set (`serialized_key_mismatch_count == 0`, `duplicate_serialized_key_count == 0`).
This separation matters: if identity were taken from the key strings, a lossy or ambiguous key
format would be self-consistent and the check would pass while the ledger silently misdescribed the
graph. If the bijection between serialized keys and entry fields cannot be PROVEN, the seed fails
closed and any key-format migration is OWNER-GATED.

A seed that produces an empty ledger against a graph containing inferred edges is a FAILED seed, not
a clean baseline.

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
  "node_count": 12,
  "link_count": 9,
  "confidence_counts": {
    "EXTRACTED": 5,
    "INFERRED": 4,
    "AMBIGUOUS": 0,
    "MISSING_OR_OTHER": 0
  },
  "inferred_links_raw_count": 4,
  "inferred_identity_unique_count": 3,
  "inferred_identity_duplicate_count": 1,
  "collision_count": 0,
  "graph_relation_defaulted_count": 0,
  "raw_duplicate_json_member_count": 0,
  "tuple_to_serialized_key_collision_count": 0,
  "graph_inferred_identity_set_sha256": "64 lowercase hex characters",
  "ledger_identity_set_sha256": "64 lowercase hex characters",
  "inferred_identity_algorithm_id": "sstac-wiki/inferred-identity/v1",
  "serialized_key_schema_id": "sstac-wiki/serialized-key/v1",
  "serialized_key_set_algorithm_id": "sstac-wiki/serialized-key-set/v1",
  "serialized_key_mismatch_count": 0,
  "duplicate_serialized_key_count": 0,
  "preseed_promotion_absent": true,
  "command_argv": ["exact", "argument", "list"],
  "exit_code": 0,
  "promotion_path": "absolute promotion path",
  "promotion_sha256": "64 lowercase hex characters",
  "promotion_schema_version": 1,
  "serialized_key_set_sha256": "64 lowercase hex characters (secondary evidence only; NOT the identity -- see definition below)",
  "promotion_entry_count": 3,
  "coverage_baseline_inferred_edge_count": 3,
  "coverage_baseline_commit": "40-character commit",
  "secrets_scan_exit_code": 0,
  "result": "PASS"
}
```

The counts shown are a minimal ILLUSTRATIVE example (4 raw inferred links collapsing to 3 unique
identities, so one duplicate). They are not the graph inspected in the 2026-08-08 snapshot and not a
target to reproduce.

Acceptance requires ALL of:

- `node_count > 0` and `link_count > 0`;
- every link classified into exactly one confidence bucket, with the sum of `confidence_counts`
  equal to `link_count`, and `MISSING_OR_OTHER` exactly zero (unknown confidence is a hard failure);
- `confidence_counts.INFERRED == inferred_links_raw_count`;
- `inferred_identity_unique_count + inferred_identity_duplicate_count == inferred_links_raw_count`;
- `collision_count == 0`, `raw_duplicate_json_member_count == 0`,
  `tuple_to_serialized_key_collision_count == 0`;
- `ledger_identity_set_sha256 == graph_inferred_identity_set_sha256` -- both computed from
  source/target/relation FIELDS via the canonical procedure, not from key strings;
- `serialized_key_mismatch_count == 0` and `duplicate_serialized_key_count == 0` -- the separate
  key-bijection check;

#### Serialized-key schema v1 (pinned)

The ledger key format is pinned as `sstac-wiki/serialized-key/v1`:

    key = source + "::" + target + "::" + relation

built from the same JSON-DECODED field values used for identity.

**This format is NOT injective, and that is exactly why it is not the identity.** A field value that
itself contains `::` can produce the same key string as a different triple -- for example
`("a::b", "c", "r")` and `("a", "b::c", "r")` both serialize to `a::b::c::r`. The pinned format is
retained for human readability and backward compatibility, and the hazard is contained by requiring
`tuple_to_serialized_key_collision_count == 0`: if any two distinct triples in the ledger collide
under v1, the seed fails closed and a key-format migration is OWNER-GATED. Identity always comes
from the length-prefixed canonical encoding, never from these strings.

`serialized_key_set_sha256` is DEFINED as follows (`sstac-wiki/serialized-key-set/v1`), or the field
must be omitted entirely rather than left vague. Take each ledger entry's key NAME as a
JSON-DECODED string -- the decoded object member name, not the raw escaped source text, exactly as
for identity fields. Frame each deterministically and collision-free with the same length-prefixed
strict-UTF-8 rule applied to the whole key as one field:

    encode(key) = minimal_ascii_decimal(utf8_len(key)) + ":" + utf8_bytes(key)

Sort those records by raw bytes ascending, concatenate with exactly one `0x0A` terminator each,
SHA-256, lowercase hex. The empty set again yields
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

It is SECONDARY evidence about key serialization only. It is never compared against
`graph_inferred_identity_set_sha256`, and it never substitutes for identity.
- `promotion_entry_count == inferred_identity_unique_count`; and
- `coverage_baseline_inferred_edge_count == inferred_identity_unique_count`.

NO ZERO IS REQUIRED FOR THE INFERRED COUNTS SPECIFICALLY -- that is,
`inferred_links_raw_count`, `inferred_identity_unique_count` and
`inferred_identity_duplicate_count` may each legitimately be large, and
`confidence_counts.INFERRED` may be large. This does NOT extend to the defect counters: all five
of `collision_count`, `raw_duplicate_json_member_count`,
`tuple_to_serialized_key_collision_count`, `serialized_key_mismatch_count` and
`duplicate_serialized_key_count` MUST equal zero. The receipt must be rejected if any required field is absent, any equality above fails, any
hash or commit differs, or the on-disk file does not reproduce its recorded hash.

## 4. First semantic run without prior coverage state

The promotion implementation inspected on 2026-08-08 initialized missing state as
`{"v": 1, "entries": {}}`. Its coverage comparison used the prior inferred-edge count when
present. If that count was absent or zero, the ratio guard was inactive. Reverify those source bytes
before use. Under that inspected behavior:

- a first successful `GREEN` semantic run can create inferred entries and establish the first
  nonzero coverage baseline without a meaningful prior-coverage regression comparison;
- a correctly executed Phase 3 seed under the section 3 contract REMOVES that limitation, because it
  establishes a nonzero coverage baseline equal to the unique inferred identity count before the
  first semantic run, giving the ratio guard a real prior value to compare against. (The withdrawn
  zero-inferred seed would have left the guard inactive, which was one of its concrete harms.);
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

1. Whether to create the missing Phase 3 promotion baseline under the corrected inferred-identity
   contract (section 3), and the exact graph hash, commit, isolated runtime, seed command, and
   rollback bytes. NOTE the 2026-08-09 correction: the presence of inferred links does NOT make a
   graph ineligible, and no graph may be relabeled or reset to remove them. Reverify any future
   candidate independently.
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

## 10a. Unrelated 2026-08-10 event: no semantic effect

On 2026-08-10 a disposable Graphify MCP compatibility-proof attempt (R13) was made and failed inside
its own controller preflight, before package installation and before any Graphify or MCP process
existed. It is recorded in sections 9 and 10 of
`docs/design/wiki/GRAPHIFY_MCP_REPAIR_PACKET_2026_08_08.md`.

It is noted here only to foreclose a misreading. That attempt:

- ran no Ollama, no semantic extraction, no promotion seed, and no contradiction write;
- created, changed, and destroyed no promotion or contradiction state;
- touched no canonical runtime, no graph bytes, and no scheduled task;
- is NOT a deterministic night and NOT semantic progress, and neither advances nor resets any
  counted window; and
- resolves NONE of the section 9 owner decisions.

Every verdict, precondition, and owner gate in this packet is unchanged by it. Deterministic and
semantic counts remain canonical only at `facts.wiki_runtime.counted_window` in
`docs/_meta/docs-manifest.json`; nothing in this packet supplies a current count.

## 11. Packet verdict

`SEMANTIC_BASELINE_ABSENT` and `NOT_READY_FOR_SEMANTIC_OR_GRADUATION`.

The deterministic correction can be reviewed independently. Semantic work, promotion seeding,
Graphify MCP activation, and canonical-runtime mutation remain outside this candidate and require
the explicit gates above.
