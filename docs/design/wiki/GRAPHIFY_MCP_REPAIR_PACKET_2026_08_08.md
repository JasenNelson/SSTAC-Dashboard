# Graphify MCP Repair Packet - 2026-08-08

Status: CANDIDATE_UNVERIFIED / NON-AUTHORITATIVE

Use `docs/INDEX.md` for canonical navigation and `docs/_meta/docs-manifest.json` for registered
lifecycle and current-fact authority.

This packet is decision evidence only. It authorizes no package install, venv change, MCP
registration change, user-config write, network access, scheduler action, or canonical-runtime
mutation.

## Evidence snapshot boundary

Every environment, installed-package, source-file, and user-configuration observation below is a
frozen read-only snapshot from 2026-08-08. It is not a live probe. Reverify the exact runtime files,
package metadata, graph bytes, and `C:\Users\jasen\.claude.json` semantic and byte state before
selecting a dependency, approving replacement bytes, or performing any operation.

## 1. Frozen 2026-08-08 read-only findings

The following snapshot observations were collected without executing Python or changing either
runtime:

1. `tooling/wiki/requirements-graphify.txt` contains one install requirement,
   `graphifyy[sql,mcp]==0.9.17`. Its own TODO says transitive dependencies were not frozen.
2. Canonical installed metadata identified `mcp` version `2.0.0`.
3. Graphify 0.9.17 imports `AnyUrl` inside `_build_server` with
   `from mcp.types import AnyUrl`. The canonical `mcp/types/__init__.py` contains no `AnyUrl`
   export.
4. Graphify 0.9.17 metadata declares unconstrained `Requires-Dist: mcp` for the `mcp` extra.
5. The superseded runtime snapshot had `mcp` 1.28.1, and its `mcp/types.py` imported `AnyUrl` from
   `pydantic.networks`. This proves the symbol is present there, not full server compatibility.
6. The `C:\Users\jasen\.claude.json` snapshot contained exactly one textual `"graphify": {`
   registration. It was under project key `C:/Projects/SSTAC-Dashboard` and pointed both Python and
   graph arguments at `kb-runtime-6bb43b-2026-07-23`, not the canonical runtime.

Python execution was denied by project policy. No import, server construction, MCP initialize,
tool call, resource call, or graph-query test was executed in this lane.

## 2. Candidate dependency constraint

The narrow candidate is:

```text
graphifyy[sql,mcp]==0.9.17
mcp==1.28.1
```

An exact 1.28.1 pin is preferred over broad `mcp<2` because the repository requires reproducible
dependencies and the frozen installed-source snapshot showed 1.28.1 exporting the required symbol.
That observation must be reverified in the disposable candidate. The pin remains
`CANDIDATE_UNVERIFIED` until every disposable test below passes. This packet does not change the
requirements file.

## 3. Evidence required before selecting the pin

Selection requires one immutable receipt bundle containing:

- Python version and architecture;
- exact input requirement bytes and SHA-256;
- installer version, install source, and full install command;
- resolved `pip freeze` bytes and SHA-256;
- installed `graphifyy` and `mcp` distribution versions, plus direct evidence showing the import
  origin and export behavior of `mcp.types`;
- installed `pydantic` version and direct `AnyUrl` import provenance;
- installed versions and import evidence for every resolved MCP transport dependency used by the
  candidate, including the stdio transport dependency set reported by installed metadata;
- exact-zero `python -m pip check`;
- exit code plus stdout and stderr hashes for every section 4 check;
- disposable graph source hash and proof the canonical graph bytes did not change;
- process closeout with no surviving disposable server or client; and
- overall `PASS` only when every assertion passes.

A clean `from mcp.types import AnyUrl` is necessary but not sufficient.

## 4. Disposable-environment protocol

Mission Control should first review and bind a small MCP-client harness. The owner then chooses a
complete offline wheelhouse or separately authorizes network access. Use a new ordinary directory
outside both runtime venvs, such as `C:\tmp\sstac-graphify-mcp-compat-20260808`.

1. Copy exact candidate requirements and the canonical served graph into the disposable root.
   Record source and copy hashes and require equality.
2. Create a fresh Python 3.11 venv in that root.
3. Install exactly Graphify 0.9.17 and MCP 1.28.1. Prefer `--no-index --find-links` against an
   owner-approved complete wheelhouse. A network-backed install needs its own owner gate.
4. Run `python -m pip check` and freeze the complete environment.
5. Run all checks below through one bounded client harness. It must own the stdio child, apply a
   timeout, close stdin, wait for exit, and report any survivor as RED.
6. Preserve the disposable root and receipts for review; remove nothing automatically.

### 4.1 Import and construction

- `from mcp.types import AnyUrl` exits 0.
- `from graphify.serve import _build_server; _build_server(<disposable graph>)` returns a server
  object without traceback.
- Starting `python -m graphify.serve <disposable graph> --transport stdio` under the client does
  not emit the misleading `mcp not installed` traceback.

### 4.2 MCP initialize

The client must complete initialize, receive a nonempty server identity and protocol version, send
the initialized notification, and record the structured response. EOF-only exit is not a health
oracle.

### 4.3 Tool list

`tools/list` must return unique names including all of:

```text
query_graph
get_node
get_neighbors
get_community
god_nodes
graph_stats
shortest_path
list_prs
get_pr_impact
triage_prs
```

Any protocol error, duplicate name, missing tool, or error content is RED.

### 4.4 Resource list

`resources/list` must return unique URIs including all of:

```text
graphify://report
graphify://stats
graphify://god-nodes
graphify://surprises
graphify://audit
graphify://questions
```

### 4.5 Canonical graph-query acceptance

Against the disposable graph copy:

- `graph_stats` returns nonzero node, link, and community counts without error content.
- `get_node` for `tooling_wiki_sync_wiki_ps1` returns that identity or an exact documented
  canonical alias, not a fallback or not-found response.
- `query_graph` for `How does sync_wiki publish a clustered graph?` returns at least one result
  tied to the sync-wiki module and contains no protocol or server error.

Capture structured MCP results. Do not infer success from process liveness.

## 5. Proposed live dependency change

Only after section 4 is PASS and Mission Control accepts its receipt bundle:

1. Choose a maintenance window that cannot overlap the 05:30 nightly.
2. Prove no process uses the canonical venv and capture exact package and runtime hashes.
3. Add `mcp==1.28.1` to the tracked requirements candidate and obtain external review.
4. Obtain owner approval for the exact live-venv install command and expected changes.
5. Apply only the reviewed pin, then rerun section 4 against the canonical served graph before
   touching the registration.

Unexpected resolution, dependency conflicts, graph-hash changes, or surviving processes require
stop and rollback. No command in this section was run here.

## 6. Exact proposed sole-registration replacement

This is a separate owner gate after canonical-runtime MCP acceptance. Do not use bare
`claude mcp add`, because colliding project namespaces can create a second entry.

Atomically replace only these two values inside the sole `graphify` entry under
`C:/Projects/SSTAC-Dashboard`:

```text
command old: C:\Projects\SSTAC-Dashboard-worktrees\kb-runtime-6bb43b-2026-07-23\.venv-graphify\Scripts\python.exe
command new: C:\Projects\SSTAC-Dashboard-worktrees\wiki-runtime-9af819a-20260804\.venv-graphify\Scripts\python.exe

graph old: C:\Projects\SSTAC-Dashboard-worktrees\kb-runtime-6bb43b-2026-07-23\wiki\.graph\graph.json
graph new: C:\Projects\SSTAC-Dashboard-worktrees\wiki-runtime-9af819a-20260804\wiki\.graph\graph.json
```

The reviewed operation contract is exact. If `ConvertFrom-Json -AsHashtable` is used, the host must
be exactly `C:\Program Files\PowerShell\7\pwsh.exe`; Windows PowerShell 5.1 is not an equivalent
host for that parameter.

1. Hash `C:\Users\jasen\.claude.json`; require the owner-approved preflight hash.
2. Read and retain the original raw bytes. Detect and record source encoding, BOM presence, and
   newline convention. Parse those bytes semantically with the exact PowerShell 7 host above and
   `ConvertFrom-Json -AsHashtable`; do not serialize the parsed object back to JSON.
3. Require exactly one project containing a `graphify` key, and require its key to equal
   `C:/Projects/SSTAC-Dashboard`.
4. Require type `stdio`, empty `env`, the exact old command, and args exactly `-m`,
   `graphify.serve`, the exact old graph, `--transport`, `stdio`.
5. Against the original raw bytes, require each complete old JSON-escaped value to occur exactly
   once and each complete new JSON-escaped value zero times. Reject partial-path matching and do not
   perform a root-wide substring replacement. Record the exact byte offset and byte length of each
   complete old sequence.
6. Create exactly two replacement records containing identifier, old offset, old length, old bytes,
   and approved new bytes. Require non-negative offsets, require both old-byte spans to match the
   original bytes exactly, prove the spans do not overlap, and sort the records by ascending byte
   offset. Do not assume whether the command or graph value occurs first.
7. Starting with cursor zero, append each unchanged original slice from cursor to the next sorted
   record offset, append only that record's approved new bytes, and advance cursor past its old-byte
   span. After both records, append the unchanged original tail. Prove in the receipt that every
   unchanged slice hash equals its original slice hash and that the only byte differences are the
   two approved replacement records.
8. Write the constructed bytes to
   `C:\Users\jasen\.claude.json.wiki-graphify-20260808.tmp` while preserving the source encoding,
   BOM presence, and newline bytes exactly. Fail if that path or
   `C:\Users\jasen\.claude.json.pre-wiki-graphify-20260808.bak` already exists.
9. Parse the temp bytes and require exactly one registration, exact new command and args, zero old
   runtime paths in any graphify entry, and the sorted-record and unchanged-slice proof from steps
   6-7. Only then atomically
   call `System.IO.File.Replace(temp, config, backup, $true)`.
10. Re-read and reparse the replaced file, reverify the exact semantic and byte-slice invariants,
   and confirm encoding, BOM, and newline preservation before activation.
11. Hash new config and backup, then rerun initialize, tool-list, resource-list, and all three
   canonical graph-query checks.

Any failed preflight stops before replacement. Any failed postflight triggers rollback; it does
not authorize an add, second entry, or namespace cleanup.

## 7. Rollback operation

Require the recorded pre-change backup hash and post-change config hash. Require current config to
equal the post-change hash. Before any rollback write, require
`C:\Users\jasen\.claude.json.failed-wiki-graphify-20260808.bak` to be absent. If it already exists,
fail closed without overwriting, deleting, renaming, or changing current config, backup, temp, or
failed evidence. Otherwise copy verified backup bytes to a new same-directory temp file, then
atomically replace current config while preserving failed post-change bytes at that exact failed
backup path. Reparse and require the exact sole old registration and original config hash. Delete
no evidence automatically.

Package rollback is separate: restore the reviewed pre-change package set, run `pip check`, and
prove the exact package inventory. Do not point registration to any runtime whose graph freshness
has not been accepted.

## 8. Explicit owner gates

1. Accept or reject `mcp==1.28.1` as the disposable candidate.
2. Authorize an offline wheelhouse or exact network-backed disposable install.
3. Accept the disposable receipt bundle.
4. Choose and approve the exact canonical-venv maintenance operation.
5. Accept canonical-runtime MCP postflight.
6. Approve the exact config preflight hash and two-value atomic replacement.
7. Accept final sole-registration and canonical-query evidence.

Until gates 1-7 complete, verdict remains `CANDIDATE_UNVERIFIED`.
