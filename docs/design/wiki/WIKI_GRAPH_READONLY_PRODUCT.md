# Read-only wiki_graph product

Lifecycle: AUTHORITATIVE (manifest id `wiki.wiki_graph_readonly_product`).
Status: INACTIVE and UNREGISTERED. This page is the product contract only; current
project status lives in `docs/INDEX.md` and `docs/_meta/docs-manifest.json`.

## Scope

`tooling/wiki/wiki_graph_core.py` and `tooling/wiki/wiki_graph_mcp.py` form a
repository-owned, model-free MCP stdio process that serves one explicitly supplied,
hash-pinned Graphify-derived JSON graph through exactly seven deterministic, read-only
tools. It is not registered with any MCP client, scheduler, hook, or runtime, and
nothing in the repository starts it.

Acceptance is synthetic conformance only. Passing the product tests makes no claim
about usefulness, adoption, real-data quality, provider neutrality, production
safety, or model benefit. Any dogfood disclosure, runtime integration,
registration, or activation requires a later, separate owner gate.

## Startup envelope

The adapter is started as:

`<python-3.11> -I -B tooling/wiki/wiki_graph_mcp.py --graph <absolute path> --graph-sha256 <64 lowercase hex> --source-oid <40 lowercase hex>`

These three caller-supplied pins are the startup envelope. The adapter reads the
graph once, refuses it unless its exact bytes hash to the pinned SHA-256, and
accepts the source OID as the caller's assertion. It has no project-path argument.

`graph_stats` reports `source_oid_basis: controller_envelope`. The value keeps its
historical field name for backward compatibility; it means only this
caller-supplied startup envelope (graph path, expected graph SHA-256, and source
OID). It does not refer to, or depend on, any external controller process,
launcher, or receipt. Renaming the field requires a separate contract review.

A refused startup exits with code 2 before any request is read, writes nothing to
stdout, and writes exactly `GRAPH_INPUT_REFUSED:<reason_code>` plus LF to stderr.

## Graph normalization

The raw graph keeps `directed:false`, empty graph metadata, node and link
provenance fields, and no source identity or evidence hashes. The normalizer is
all-or-nothing and maps those fields to stable node and edge records without
fabricating source files, source locations, source OIDs, or evidence. Traversal
uses the raw source-to-target link orientation while preserving the producer's
directed-false declaration.

Input ceilings are enforced before indexing: 67,108,864 raw bytes, 250,000 nodes,
and 1,000,000 links. Duplicate keys, non-finite numbers, invalid UTF-8, duplicate
or NFC-colliding node IDs, dangling or duplicate links, and malformed provenance
are refused.

## Tools

The seven tools are `graph_stats`, `query_graph`, `get_node`, `get_neighbors`,
`shortest_path`, `get_community`, and `god_nodes`. Requests reject unknown
properties, and bounded values are deterministic, including not-found, ambiguous,
truncated, directed, undirected, depth-bounded, self-loop, and tie cases. Query
text is NFC-normalized before its one-to-256 Unicode-scalar bound is measured; a
violation is the JSON-RPC error `-32602 INVALID_query`.

`get_neighbors` returns the root record, the neighbor records (up to `limit`), and
every edge whose endpoints are both in the returned set including the root, so
relationships incident to the root are part of the result. When the neighbor list is
truncated, root edges to neighbors that were not returned are omitted with them.

## Result shapes

`initialize`, `tools/list`, `resources/list`, `resources/templates/list`, and
`prompts/list` return direct, method-specific JSON-RPC result objects:
`{protocolVersion, serverInfo, capabilities}`, `{tools}`, `{resources}`,
`{resourceTemplates}`, and `{prompts}` respectively; the three list methods other
than `tools/list` return empty lists. Only `tools/call` wraps its value: the result
is `{content, structuredContent}`, where `structuredContent` is the tool value and
`content` is a single text item holding its RFC 8785 canonical bytes.

## Limits and I/O

Stdout carries only newline-delimited JSON-RPC frames. A `tools/call` value over
32,000 canonical UTF-8 bytes is replaced, as the `structuredContent`, by the complete
refusal
`{code:RESULT_TOO_LARGE, message:"result exceeds 32000 UTF-8 bytes", status:refused}`
rather than a partial result. A frame over 1,048,576 bytes (excluding its LF and one
optional trailing CR) returns
`FRAME_TOO_LARGE`, after which the adapter exits with code 0. At end of input the
adapter exits with code 0 and empty stderr.

## Side-effect refusal diagnostics

The adapter installs one audit hook before it opens the graph. It raises
`RuntimeError` with exactly one of three normative diagnostics; no other
diagnostic exists:

- `SIDE_EFFECT_REFUSED`: the audit events `socket.__new__`, `socket.getaddrinfo`,
  `socket.gethostbyname`, `socket.gethostbyname_ex`, `socket.getnameinfo`, every
  `subprocess.*` event, `os.system`, `os.spawn`, `os.posix_spawn`, `os.remove`,
  `os.unlink`, `os.rename`, `os.replace`, `os.mkdir`, `os.rmdir`, `os.makedirs`,
  `shutil.copyfile`, `shutil.copytree`, and `shutil.move`.
- `WRITE_REFUSED`: an `open` event that would write. CPython raises `open` for
  both `builtins.open` and `os.open`, so the hook dispatches on argument
  shape: a string mode (builtins.open) is refused when it contains `w`, `a`,
  `x`, or `+`; a `None` mode with integer flags at `args[2]` (os.open) is
  refused when the flags include write, read-write, create, truncate, or
  append bits.
- `AUDIT_AMBIGUOUS_FLAGS`: an `open` event whose shape is neither of those.

## Product tests

Two ordinary test files are the product acceptance. Each is run separately:

- `<python-3.11> -I -B tooling/wiki/tests/test_wiki_graph_core.py`
- `<python-3.11> -I -B tooling/wiki/tests/test_wiki_graph_mcp.py`

The core file covers the envelope, ceilings, malformed-graph refusals,
normalization, query bounds, all seven operations (including root-incident
`get_neighbors` edges), and canonical JSON. The MCP file also asserts the exact
top-level result keys of every method, so a content + structuredContent wrapper on
any method other than `tools/call` fails. The MCP
file launches the real adapter over stdio for the 26 case IDs held in the compact
literal fixture `tooling/wiki/tests/fixtures/wiki_graph_product_cases_v1.json`,
including seven side-effect cases run in isolated children that execute the
adapter's real startup before attempting the operation. Expected values are
hand-written literals derived from `wiki_graph_synthetic_v1.json`; they are never
generated or refreshed by the code under test. The required case-ID set is a
literal in the test file, and the run fails unless the required, fixture, and
executed IDs are identical and all seven tools executed. Tests write only inside
one fresh test-owned temporary directory, and every child has a bounded timeout
with teardown through its own process handle.

Each file prints one `WIKI_GRAPH_PRODUCT_SUMMARY` JSON line and exits nonzero on
any failure, error, skip, or zero-test run. The CI job `Wiki Graph Product Tests`
(`wiki-graph-product-tests-windows`, Windows, Python 3.11) runs both files,
re-checks both summaries and the fixture IDs, and is required by the aggregate
`CI Status Check`.

## Non-goals

No network, Git, subprocess, source-tree, write, cache, prompt, resource, logging,
learning, autolearning, registration, promotion, activation, or runtime behavior,
and no real-data access. No graph build.

## Historical note

The retired Q0 control-plane experiment evidence is preserved outside the
shipping feature. It is not product acceptance, and the product and its tests do
not depend on it.
