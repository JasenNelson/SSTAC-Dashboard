# Graphify MCP Repair Packet - 2026-08-08

Status: CANDIDATE_UNVERIFIED / NON-AUTHORITATIVE

ADDENDUM 2026-08-10: sections 9 and 10 were appended after a compatibility-proof attempt (R13)
failed BEFORE it reached Graphify or MCP. Section 9 records that attempt; section 10 drafts a
materially simpler replacement contract. Neither section grants execution authority, and
Graphify/MCP compatibility remains UNKNOWN. Sections 1 through 8 are unchanged 2026-08-08 content.

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

## 9. R13 attempt, 2026-08-10 -- PRE-MCP CONTROLLER-PREFLIGHT FAILURE

This section is an immutable record of one attempt. It is not a compatibility result.

**Do not describe R13 as a Graphify failure or an MCP failure.** It never reached Graphify and never
reached MCP. It terminated inside its own controller's preflight, before package installation, so it
produced no evidence whatsoever about the candidate pin.

### 9.1 What was run

| Item | Value |
| :--- | :--- |
| Date | 2026-08-10 |
| Disposable evidence root | `C:\tmp\sstac-graphify-mcp-compat-r13-20260810` |
| Controller exit code | 5 |
| Terminal phase | Phase/Step 5, before package installation and before MCP |
| Retry | None occurred |

Exact source paths and SHA-256 of the three authority artifacts. All three live in the R13 working
directory `C:\Projects\SSTAC-Dashboard-worktrees\wiki-mcp-harness-20260809\.tmp_ai_worker_wiki_mcp_r7_overnight_20260809\`
(untracked in that worktree, branch `feat/wiki-mcp-harness-20260809`), and each hash below was
recomputed read-only on 2026-08-10 against the file at that path:

| Artifact | Path (basename under the directory above) | SHA-256 |
| :--- | :--- | :--- |
| Controller | `ROUTE_B_NETWORK_CONTROLLER.ps1` | `9d67db0fc2692d70ad2c96e8681216016a87c2200e02d083a1c41ffede4f624a` |
| Authority packet | `DISPOSABLE_COMPATIBILITY_RUN_PACKET.md` | `4f27e5e51379ac9f0b6c24aee50a02b980befc059e79920b9ea28e9e225476b0` |
| OWNER_DECISIONS | `OWNER_DECISIONS.md` | `f99869b942fd4d80ef14805da5591e651e895565a7f003669d02ecf27a83e39b` |

### 9.1.1 The literal invocation that ran once

This is the exact PowerShell invocation and argv. It was run ONCE and never retried:

```powershell
& 'C:\Program Files\PowerShell\7\pwsh.exe' -NoProfile -File `
  'C:\Projects\SSTAC-Dashboard-worktrees\wiki-mcp-harness-20260809\.tmp_ai_worker_wiki_mcp_r7_overnight_20260809\ROUTE_B_NETWORK_CONTROLLER.ps1' `
  -Execute `
  -ApprovedControllerSha256 '9d67db0fc2692d70ad2c96e8681216016a87c2200e02d083a1c41ffede4f624a' `
  -DisposableRoot 'C:\tmp\sstac-graphify-mcp-compat-r13-20260810'
```

No compatibility receipt was produced by this invocation and none is claimed to exist.

### 9.2 What did NOT happen

- No package was downloaded or installed.
- No Graphify server was launched.
- No MCP session was launched.
- No compatibility receipt exists.
- No package was reviewed, installed, or tested.
- No canonical runtime, venv, requirements file, MCP registration, or user configuration changed.

**Compatibility between `graphifyy[sql,mcp]==0.9.17` and `mcp==1.28.1` therefore remains UNKNOWN.**
It is not verified, not refuted, and not pending-with-partial-evidence. There is no evidence.

### 9.3 Custody

- Pip debug custody: `JOB_CLEAN`, root reaped, zero active descendants.
- Final custody: 420 processes inspected, zero offenders, zero indeterminate entries, nothing
  terminated.

### 9.4 Root cause

The controller's own preflight parser rejected a correct environment:

1. The minimal child environment contained only `PIP_CONFIG_FILE=nul` among `PIP_*` variables.
2. The reviewed pip argv included `--isolated` and `--no-input`.
3. Pip ITSELF sets `PIP_NO_INPUT=1` when it processes `--no-input`, so that variable appears in
   `pip config debug` output as a pip-created artifact of the reviewed argv, not as ambient host
   leakage.
4. Pip explicitly recognizes `PIP_CONFIG_FILE == os.devnull` and skips loading configuration files.
   On Windows that value is the string `nul`, which `pip config debug` reports as `exists: True`.
5. R13's parser incorrectly rejected the pip-created `PIP_NO_INPUT`, and separately treated Windows
   `nul` as an unknown effective configuration source.
6. The offline self-test that passed 29 of 29 used a synthetic "good" fixture that omitted BOTH of
   those real pip behaviours, so the defect could not be caught before first contact.

No ambient host pip index, proxy, credential, or configuration leaked. The environment was correct;
the assertion about it was wrong.

The reusable lesson is recorded in `docs/LESSONS.md`: a synthetic contract fixture must reproduce
the real tool's SELF-GENERATED state, not merely the expected ideal output.

### 9.5 Disposition

- The disposable evidence root is PRESERVED. No cleanup and no reuse is authorized.
- The R13 authorization is CONSUMED. It does not carry to any further run.
- There is no R14, and no patch to the R13 controller or its parser is authorized by this record.
- Any further attempt requires the separate owner gate described in section 10, item 12.

## 10. Simplified proof contract -- DRAFT ONLY, NOT AUTHORIZED, NOT EXECUTED

DRAFT. This section proposes a materially simpler replacement for the section 4 protocol. It is
written, not approved. Nothing here has been run, and nothing here authorizes a run. Section 4
remains the 2026-08-08 historical text and is superseded only if and when this draft is accepted.

The simplification is deliberate: R13 died in bespoke preflight-parsing infrastructure that existed
only to prove an environment property the environment already guaranteed by construction. This draft
deletes that layer instead of repairing it. **It introduces no new script, no new controller, no new
harness, and no new design-document family.**

1. **New disposable root.** A fresh ordinary directory outside both runtime venvs. NEVER reuse and
   NEVER clean the R13 root at `C:\tmp\sstac-graphify-mcp-compat-r13-20260810`.
2. **Exact direct requirements**, and only these two:

   ```text
   graphifyy[sql,mcp]==0.9.17
   mcp==1.28.1
   ```

3. **Closed child environment plus explicit pip flags.** The child process receives a closed
   allowlist environment with `PIP_CONFIG_FILE` set to the interpreter's own `os.devnull`, and pip
   is invoked with `--isolated`, `--no-input`, `--no-cache-dir`, `--disable-pip-version-check`,
   `--only-binary=:all:`, the single explicit index bound in section 10.1, and a mandatory install
   report.
4. **Do NOT run or parse `pip config debug`.** The closed environment and
   `PIP_CONFIG_FILE=os.devnull` ARE the preflight evidence. This is the single change that removes
   the R13 failure class: there is no parser to be wrong, because there is nothing to parse.
5. **Artifact validation retained, at the strength the frozen bytes actually provide.**
   Final-download-URL validation and DECLARED-hash validation of every resolved artifact from the
   preserved raw install report, adjudicated against the allowlist and the narrowed receipt fields
   in section 10.1, plus `pip freeze` and an exact-zero `python -m pip check`. No redirect-chain
   evidence and no independent byte rehash are claimed -- see RESIDUAL 1 and RESIDUAL 2.
6. **Process custody retained**, using the exact frozen R13 candidate bytes bound in section 10.2.
   Windows Job Object custody with `KILL_ON_JOB_CLOSE`, the Job created and configured BEFORE the
   child exists and the child created suspended and assigned before it can execute one instruction.
   Algorithm ids `sstac-wiki/contained-run/v1` and `sstac-wiki/job-containment/v1`, as recorded in
   the R13 evidence receipts.
7. **Read-only canonical graph copy.** Copy the canonical served graph into the disposable root and
   require the source hash and the copy hash to be equal. The canonical graph is never opened for
   write and never mutated.
8. **Run the existing real-profile harness** -- the exact frozen R13 candidate bytes bound in
   section 10.2, entrypoint `real_profile_entry.py` -- directly against the disposable environment.
   Do not author a replacement harness.
9. **External adjudication.** The receipt is adjudicated externally, not self-graded, and must carry
   the exact `tools/list` result, the exact `resources/list` result, and the exact canonical
   graph-query result.
10. **Containment scope stated honestly.** The run executes as an ordinary UNELEVATED user. The Job
    Object provides PROCESS custody only. It is NOT filesystem isolation, NOT credential isolation,
    NOT registry isolation, and NOT network isolation, and the receipt must say so rather than imply
    a sandbox.
11. **Out of scope, absolutely.** No MCP registration, no activation, no mutation of
    `tooling/wiki/requirements-graphify.txt`, no canonical-runtime writes, no semantic work, no
    scheduler action, and no publication.
12. **Execution gate.** Any future execution requires new exact bytes, a comprehensive and
    adversarial GREEN review of those bytes, and a separate explicit owner approval. Neither the R13
    authorization nor this draft supplies it.

**Simplification status: SUCCEEDED**, and it is retained ONLY on the narrowed terms below. Every
evidence requirement in this contract is now matched to what the frozen existing bytes can actually
produce: items 6 and 8 reuse the exact frozen R13 candidate bytes bound in section 10.2, item 4
removes infrastructure rather than adding it, and section 10.1 was narrowed (2026-08-10, R3) so that
no requirement demands a new controller, parser, script, or harness. Two evidence limits that would
have required new infrastructure are recorded as NAMED RESIDUALS in section 10.1 rather than
designed around; each needs explicit owner acceptance before any execution. Had the contract instead
kept requirements the frozen bytes cannot satisfy, this section would report that simplification
failed.

### 10.1 Package-source route (BOUND, network-backed) -- DRAFT CHOICE, NOT EXECUTION APPROVAL

This draft SELECTS the network-backed route and closes the offline-wheelhouse-versus-network
question for THIS proposed simplified experiment only. **If this draft is later accepted, it
supersedes the section 4 step 3 package-source choice for this experiment alone. Section 4 remains
historical text and is not otherwise amended.** Selecting a route is a drafting decision. **It is
not execution approval**, and it does not satisfy or pre-empt owner gate 2 in section 8.

**Allowlist (exact, closed).**

| Role | Bound value |
| :--- | :--- |
| Index (metadata resolution) | `https://pypi.org/simple` -- the single `--index-url`, exact, no trailing variation |
| Artifact host (wheel bytes) | `files.pythonhosted.org` -- the only permitted download host |
| Scheme | `https` only; enforced and PROVEN on the final artifact URL, and required but not independently proven for intermediate hops (RESIDUAL 1) |

The index host and the artifact host are DIFFERENT by design: pip's simple index resolves metadata
on `pypi.org` and serves wheel bytes from `files.pythonhosted.org`. Both, and only both, are
permitted.

**Forbidden as a command-line package source, without exception:** `--extra-index-url`,
`--find-links`, `--no-index` with any local directory, dependency-links, any alternate or mirror
index, any credential-bearing source URL (userinfo, token, or query-string secret), any `http://`
URL, and any host not named above.

**Exact reviewed pip argv (flag set bound).** The install runs exactly this flag set, with only the
disposable-root interpreter path and the report output path supplied at execution time:

```text
<disposable-root>\.venv\Scripts\python.exe -m pip install
  --isolated
  --no-input
  --no-cache-dir
  --disable-pip-version-check
  --only-binary=:all:
  --index-url https://pypi.org/simple
  --report <disposable-root>\evidence\pip-install-report.json
  graphifyy[sql,mcp]==0.9.17
  mcp==1.28.1
```

**What the frozen candidate actually validates.** `contained_run.py::validate_pip_report()` parses
every `install[]` entry's `download_info.url` as a URI (never a string-prefix test) and requires:
scheme exactly `https`; no URL userinfo; hostname canonicalized to lowercase exactly equal to
`files.pythonhosted.org`; a non-empty path; and a declared SHA-256 in `archive_info` that is exactly
64 lowercase hex characters. Any absence or malformation is a hard failure
(`PIP_REPORT_ABSENT` / `PIP_REPORT_MALFORMED` / `PIP_REPORT_EMPTY` / `PIP_REPORT_INVALID`). On
success it returns `artifact_count` plus, per artifact, the final URL and the declared SHA-256. That
is the complete set of package-source assurances this contract may claim.

**RESIDUAL 1 -- redirect hops are NOT proven.** Pip's report exposes the FINAL
`download_info.url`, not the redirect chain that produced it. The frozen candidate validates that
final parsed URL only. **Intermediate redirect hops are not captured, not recorded, and not
independently proven, and no receipt produced under this contract may claim redirect-chain
validation.** Capturing hops would require new or modified execution infrastructure, which this
draft deliberately refuses. Residual id: `redirect_chain_unproven`. Future execution requires the
owner to accept THIS NAMED RESIDUAL explicitly, for the exact candidate hash and for that one
experiment, evidenced by the bound Group B receipt below -- never by an executor-set Boolean.

**RESIDUAL 2 -- the artifact hash is DECLARED, not independently observed.** The SHA-256 validated
above is the hash pip records in its own report. Because the argv includes `--no-cache-dir`, the
wheel archives are NOT retained after installation, so there is no on-disk artifact left to hash a
second time. **This contract therefore performs no independent byte rehash, and the declared report
hash must never be described as an independently observed hash, nor compared against one.** Adding
retention plus rehashing would require new or modified execution infrastructure, which this draft
deliberately refuses. Residual id: `no_independent_artifact_rehash`. Future execution requires the
owner to accept THIS NAMED RESIDUAL explicitly, for the exact candidate hash and for that one
experiment, evidenced by the bound Group B receipt below -- never by an executor-set Boolean.

**Install report requirement (narrowed to what exists).** The install is run with a mandatory
machine-readable report, the COMPLETE RAW report is preserved as evidence, and every `install[]`
entry must carry `download_info.url` and a declared SHA-256 in `archive_info`. An entry missing
either fails closed through the validator above.

**Adjudication lifecycle -- POST-INSTALL, PRE-CANDIDATE-EXECUTION.** This is not a pre-install
supply-chain gate and must not be described as one. The order is exact:

1. Pip completes installation into the disposable root and writes its report.
2. `validate_pip_report()` runs over that report; `pip freeze` and `python -m pip check` are
   captured.
3. The RAW report and the frozen validator's output are adjudicated EXTERNALLY, by Mission Control,
   not self-graded.
4. Only after Mission Control accepts the evidence AND the owner has accepted the named residuals
   may the real-profile compatibility harness execute.

**The barrier, stated precisely.** "Nothing runs before adjudication" would be false, because the
installer itself is installed tooling. The boundary is therefore drawn by operation, not by the word
"installed":

- **Permitted before external adjudication:** ONLY the installer and metadata-validation operations
  explicitly listed in lifecycle steps 1 and 2 -- `pip install`, production and preservation of the
  pip report, `validate_pip_report()`, `pip freeze`, and `pip check`. Nothing else.
- **Forbidden before acceptance:** importing or executing Graphify, MCP, or any code, console
  script, module, or entrypoint originating from ANY resolved candidate or transitive distribution.
  Installing a distribution is not permission to run one line of it.
- **Permitted only after acceptance:** execution of the real-profile compatibility harness bound in
  section 10.2, which is what actually exercises Graphify and MCP.

**On adjudication failure:** preserve the disposable root, execute NOTHING further from it, perform
NO retry, and return to Mission Control. There is no warn-and-continue path and no in-session
repair.

**Receipt fields required for external adjudication.** Two GROUPS, kept strictly apart. Group A is
what the tools themselves produce. Group B is what other parties decide, and no Group B value may be
manufactured by the executor. Adjudication happens after installation and before any candidate or
transitive code executes.

**GROUP A -- tool-derived evidence.** Every row below, and ONLY these rows, may be described as
present in or directly derivable from the reviewed pip argv, the raw pip report,
`validate_pip_report()` output, `pip freeze`, or `pip check`:

| Field | Purpose |
| :--- | :--- |
| `pip_argv` | The exact reviewed argv as executed, verbatim |
| `index_url` | `https://pypi.org/simple`, derived from `pip_argv`; proves the single index used |
| `approved_artifact_host` | `files.pythonhosted.org`, the value passed to the validator |
| `raw_pip_report_path`, `raw_pip_report_sha256` | The COMPLETE raw report, preserved verbatim as the primary evidence |
| `validate_pip_report_result` | `success` or `failure`; success means every entry passed the scheme, no-userinfo, exact-host, non-empty-path, and 64-hex-declared-SHA-256 checks |
| `validator_error_code` | `null` on success; otherwise the exact `PIP_REPORT_*` code raised |
| `artifact_count` | The validator's returned count |
| `artifacts[].url` | The FINAL `download_info.url` retained by the validator |
| `artifacts[].declared_sha256` | The SHA-256 as DECLARED in `archive_info` -- explicitly not an observed hash |
| `pip_freeze_path`, `pip_freeze_sha256` | The resolved environment as installed |
| `pip_check_exit_code` | `python -m pip check`; must be exactly 0 |

**No Group A field asserting redirect-chain evidence, an independently observed artifact hash, or a
declared-versus-observed hash comparison may appear**, because the frozen bytes cannot produce any
of them.

**GROUP B -- external disposition.** These fields BIND external decisions by receipt path, hash, and
identifier; they do not assert them. **A Boolean set by the executor cannot prove owner acceptance**,
which is precisely why the R3 self-asserting `residual_*` Booleans are replaced here:

| Field | Purpose |
| :--- | :--- |
| `owner_residual_acceptance_receipt_path` | Path to the owner's acceptance receipt |
| `owner_residual_acceptance_receipt_sha256` | SHA-256 of that receipt, bound so the accepted text cannot drift |
| `owner_residual_acceptance_decision_id` | The owner's identifier for that specific decision |
| `accepted_residual_ids` | Exactly `redirect_chain_unproven` and `no_independent_artifact_rehash` -- both, or the run is forbidden |
| `accepted_candidate_hash` | The exact future candidate hash the owner accepted the residuals FOR |
| `mission_control_adjudication_receipt_path` | Path to Mission Control's adjudication output |
| `mission_control_adjudication_receipt_sha256` | SHA-256 of that adjudication receipt |
| `mission_control_checkpoint_id` | The external checkpoint under which adjudication occurred |
| `mission_control_verdict` | Mission Control's verdict, as issued externally |
| `post_install_pre_candidate_execution_adjudication` | Marker that both external acceptances completed BEFORE any candidate or transitive code executed |

Stated explicitly, so none of it can be read as self-granted:

- A Boolean set by the executor cannot prove owner acceptance. Only a bound external receipt can.
- The owner receipt must explicitly accept BOTH named residuals, for the EXACT future candidate
  hash, and for ONE experiment only. A general or undated acceptance does not satisfy this.
- Mission Control's adjudication is an EXTERNAL output. It is not tool-derived evidence and is never
  self-granted by the harness or by this session.
- **These are schema requirements for a FUTURE run. No owner receipt, no Mission Control receipt, no
  execution approval, and no filled disposition value exists now.** Every Group B field is currently
  unpopulated by construction.
- If either external receipt is absent, hash-mismatched, candidate-mismatched, or does not accept
  both residuals, **Graphify and MCP execution is FORBIDDEN.** There is no partial-acceptance path.

**Transitive disclosure (retained, unchanged).** Only the two direct requirements in item 2 are
pinned. Every transitive dependency is RESOLVER-SELECTED at install time. Transitives are NOT
pre-reviewed and NOT pre-pinned; they are adjudicated AFTER installation from the install report,
by the URL and hash checks above. This experiment does not claim a reproducible transitive closure,
and a future live-runtime change would need its own pinning decision.

### 10.2 Reused execution artifacts (exact provenance, frozen R13 candidate bytes)

Items 6 and 8 reuse four existing Python files. They are **untracked R13 execution candidates living
in another worktree of THIS repository** -- not files absent from this repository, and not an
external third-party bundle. Location, verified read-only on 2026-08-10:

- Worktree: `C:\Projects\SSTAC-Dashboard-worktrees\wiki-mcp-harness-20260809`, branch
  `feat/wiki-mcp-harness-20260809`
- Directory: `tooling/ops/wiki/` (reported by `git status` as untracked in that worktree)

| Repo-relative path | SHA-256 | Bytes |
| :--- | :--- | :--- |
| `tooling/ops/wiki/contained_run.py` | `401840aa72d892b0b05f9671850c080bf9bd4f73b3cf22075d34047d6f99f31f` | 40700 |
| `tooling/ops/wiki/job_containment.py` | `40fde546d5a7a06ae62f6f32b4e36c4b964e3d77162348b7b24b5dbaa7cbe13a` | 20460 |
| `tooling/ops/wiki/real_profile_entry.py` | `57f64ad997845ddff45235f33b1c8728cdee8600e87b9be1a1eba25050c91295` | 34717 |
| `tooling/ops/wiki/mcp_harness.py` | `5b69e2b56cfbdc2bb490da417a384b610850c8235e9fdeffb498b1ba3d813fff` | 60877 |

**Entrypoints and relationships.**

- `real_profile_entry.py` is **the exact direct entrypoint** for the real-profile acceptance run
  referenced by item 8. It exposes `main(argv)` under an `if __name__ == "__main__"` guard, and the
  R13 controller binds it as `$EntryScript`. At startup it hash-pins and loads `job_containment.py`
  and `mcp_harness.py` as in-process modules (compiled and injected into `sys.modules`), declaring
  `EXECUTION_BEARING_MODULES = ("real_profile_entry", "job_containment", "mcp_harness")`. Those two
  are therefore NOT independently invoked on the harness path; they are loaded by this entrypoint,
  and a byte change in either changes what this entrypoint executes.
- `mcp_harness.py` is the bounded MCP client harness. It owns the stdio child, applies the timeout,
  and produces the structured MCP results. It is loaded by `real_profile_entry.py` and uses
  `job_containment.py`.
- `job_containment.py` is the leaf Win32 Job Object primitive (ctypes only, no intra-bundle
  imports). It is used by both `contained_run.py` and the harness path.
- `contained_run.py` is a **separate CLI entrypoint** (`main(argv)` plus `__main__`, argparse). It is
  what item 6 uses to run each native command -- venv creation, pip -- under Job Object containment.
  It uses `job_containment.py` and is NOT on the `real_profile_entry.py` import path.

**Review provenance -- stated honestly, and this is a CORRECTION.** An earlier revision of this
section called these primitives "already-reviewed". **That claim is withdrawn: no exact review
receipt for these four hashes could be identified.** The R13 artifacts that reference these same
four hashes (`DISPOSABLE_COMPATIBILITY_RUN_PACKET.md`, `OWNER_DECISIONS.md`, `FINAL_REPORT.md`,
`RESUME_PROMPT.md`, `RUN_STATE.md`) explicitly state that "No GREEN, compatibility, owner-acceptance,
or Route B authority is claimed." Accordingly these are **frozen R13 candidate bytes**, nothing more.
**Comprehensive and adversarial review of the FUTURE COMPLETE EXECUTION CANDIDATE remains
MANDATORY** and is not discharged, in whole or in part, by their prior existence or by their use in
R13.

**Byte-binding rule.** Reuse is bound to these exact hashes. **Any changed byte in any of the four
files invalidates reuse and requires a new candidate review.** The hashes must be recomputed and
required to match immediately before any future execution; a mismatch fails closed.
