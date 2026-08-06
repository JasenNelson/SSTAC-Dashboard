# Wiki Runtime Auto-Follow Bootstrap Test Specification (2026-08-05)

## 1. Test Suite Overview and Harness Integration Strategy

### 1.1 Purpose and Scope
This test specification defines the automated test suite for the in-wrapper auto-follow repin mechanism executed at step N0 inside `tooling/wiki/nightly_wiki_sync.ps1`.

### 1.2 Test Harness Integration
- **Suite Locations:** Contract and gate assertions are implemented in `tooling/wiki/tests/test_wrapper_contracts.py` and `tooling/wiki/tests/test_activation_preflight.py` (lines 660, 1263).
- **Process Custody Harness:** Process custody scenarios use the existing fixture harness in `check_orphans.ps1` (`Read-Rows:324-347`) via `-ProcessSnapshotPath` and `-FixtureCheckerPid` with JSON process snapshots.
- **No Production Backdoors:** No `-TestInjectFault` parameter or test backdoor exists in production scripts. All test conditions are driven by temporary git repository fixtures and environment snapshots.
- **Repository Isolation:** All tests run inside isolated temporary git repositories created under `$env:TEMP\wiki_autofollow_test_<id>`.
- **Path Normalization:** Every path input is normalized using `[IO.Path]::GetFullPath($Path).TrimEnd('\','/')`.

## 2. Pre-Checkout Refusal Gate Tests (Early Termination Exit Code 1)

Pre-checkout refusal gate tests verify that when a precondition fails BEFORE `git checkout` is attempted:
1. The repin is refused.
2. The tree state and `HEAD` OID remain completely unchanged (`post_repin_head == pre_repin_head`).
3. The wrapper **TERMINATES EARLY BEFORE N1** via `Complete-NightlyRun 1 'FAILED'`, emitting a valid FAILED terminal receipt with native exit code 1.

| Test ID | Gate Under Test | Setup / Preconditions | Action | Expected Decision Enum | Expected Exit Code | Expected Terminal Receipt Fields & Invariants | Isolation & Invariants |
|---|---|---|---|---|---|---|---|
| NEG-01 | Detached HEAD Gate (Gate 1) | Isolated git repo with active branch `main` checked out (HEAD attached). Target OID ahead of HEAD. | Execute N0 autofollow evaluation. | `REFUSED_ATTACHED` | 1 | `autofollow_decision: "REFUSED_ATTACHED"`, `autofollow_attempted: false`, `autofollow_result: "SKIP"`, `terminal_state: "FAILED"`, `HEAD` unchanged. | Isolated temp repo. Early exit code 1. |
| NEG-02 | Clean Working Tree & Gitdir Gate (Gate 2) | Isolated git worktree on detached HEAD with 1 dirty file OR `$gitDir/MERGE_HEAD` present. | Execute N0 autofollow evaluation. | `REFUSED_DIRTY` | 1 | `autofollow_decision: "REFUSED_DIRTY"`, `autofollow_attempted: false`, `autofollow_result: "SKIP"`, `terminal_state: "FAILED"`, `HEAD` unchanged. | Isolated temp worktree. Verifies gitdir resolution via `rev-parse --git-dir`. Early exit code 1. |
| NEG-03 | Single Fetch / Target Resolution Gate (Gate 3) | Isolated git repo configured with unreachable remote URL or invalid remote ref. Verify StrictMode 2.0 compliance when payload lacks `fetched_oid`. | Execute N0 autofollow evaluation. | `REFUSED_FETCH_FAIL` | 1 | `autofollow_decision: "REFUSED_FETCH_FAIL"`, `autofollow_attempted: false`, `autofollow_result: "SKIP"`, `terminal_state: "FAILED"`, `HEAD` unchanged. No StrictMode property exception thrown. | Isolated temp repo with dummy remote. Early exit code 1. |
| NEG-04 | Fast-Forward Descendant Gate - Divergent (Gate 4) | Isolated git repo where target OID is on a divergent branch (not a descendant of HEAD). | Execute N0 autofollow evaluation. | `REFUSED_DIVERGENT` | 1 | `autofollow_decision: "REFUSED_DIVERGENT"`, `autofollow_attempted: false`, `autofollow_result: "SKIP"`, `terminal_state: "FAILED"`, `HEAD` unchanged. | Isolated temp repo with branched commits. Early exit code 1. |
| NEG-05 | Fast-Forward Descendant Gate - Rewind (Gate 4) | Isolated git repo where target OID is an ancestor of current HEAD (backwards direction). | Execute N0 autofollow evaluation. | `REFUSED_DIVERGENT` | 1 | `autofollow_decision: "REFUSED_DIVERGENT"`, `autofollow_attempted: false`, `autofollow_result: "SKIP"`, `terminal_state: "FAILED"`, `HEAD` unchanged. | Isolated temp repo with historical commits. Early exit code 1. |
| NEG-06 | Tooling & Protected Pathspec Gate (Gate 5) | Isolated git repo where target OID modifies `tooling/wiki/serve_gate.py`, `.gitignore`, `.graphifyignore`, or `AGENTS.md`. | Execute N0 autofollow evaluation. | `REFUSED_TOOLING_CHANGE` | 1 | `autofollow_decision: "REFUSED_TOOLING_CHANGE"`, `autofollow_attempted: false`, `autofollow_result: "SKIP"`, `terminal_state: "FAILED"`, `HEAD` unchanged. | Isolated temp repo. Tests protected pathspec diff (`wiki/**`, `tooling/wiki/**`, `.gitignore`, `.graphifyignore`, `AGENTS.md`, `.gitattributes`, `tooling/.gitattributes`). Early exit code 1. |
| NEG-07 | Zero-Tracked-Wiki Invariant Gate (Gate 5) | Isolated git repo where target OID adds a tracked file under `wiki/`. | Execute N0 autofollow evaluation. | `REFUSED_TOOLING_CHANGE` | 1 | `autofollow_decision: "REFUSED_TOOLING_CHANGE"`, `autofollow_attempted: false`, `autofollow_result: "SKIP"`, `terminal_state: "FAILED"`, `HEAD` unchanged. | Isolated temp repo. Asserts `wiki/**` is in protected pathspec, repin REFUSED. Early exit code 1. |
| NEG-08 | Protected `.gitattributes` Gate (Gate 5) | Isolated git repo where target OID modifies root `.gitattributes` or `tooling/.gitattributes`. | Execute N0 autofollow evaluation. | `REFUSED_TOOLING_CHANGE` | 1 | `autofollow_decision: "REFUSED_TOOLING_CHANGE"`, `autofollow_attempted: false`, `autofollow_result: "SKIP"`, `terminal_state: "FAILED"`, `HEAD` unchanged. | Isolated temp repo. Asserts root `.gitattributes` and `tooling/.gitattributes` are in protected pathspec. Early exit code 1. |
| GIT-01 | Git Unexpected Exit (Shim) | Parameterized TEST-ONLY git shim injecting unexpected exit codes for `symbolic-ref`, `rev-parse`, `merge-base`, `checkout`. | Execute N0 autofollow evaluation. | Varies by command step | 1 | Repin is refused (`autofollow_attempted: false` or fail-closed), `HEAD` unchanged. | Isolated temp repo. Shim must not appear in production path. Early exit 1. |
| GIT-02 | Git Empty Stdout (Shim) | Parameterized TEST-ONLY git shim injecting exit 0 but empty stdout for value-returning `symbolic-ref`, `rev-parse`. | Execute N0 autofollow evaluation. | Varies by command step | 1 | Repin is refused, `HEAD` unchanged. | Isolated temp repo. Verifies empty stdout with exit 0 is a hard failure. Early exit 1. |

## 3. Post-Checkout Verification Failure Tests (FAIL-CLOSED Exit Code 1)

Post-checkout verification tests verify that if a failure occurs during or after `git checkout`:
1. The repin attempt is flagged (`autofollow_attempted: true`).
2. The wrapper **TERMINATES IMMEDIATELY FAIL-CLOSED** with exit code 1.
3. No N1 build or publication occurs.

| Test ID | Gate Under Test | Setup / Preconditions | Action | Expected Decision Enum | Expected Exit Code | Expected Terminal Receipt Fields & Invariants | Isolation & Safety |
| NEG-09 | Checkout Hook Suppression & Override Gate | Isolated git repo with active checkout hook configured under git hooks directory. | Execute checkout with `-c "core.hooksPath=$EmptyHooksPath"`. | `REPINNED` | 0 | `autofollow_decision: "REPINNED"`, `autofollow_attempted: true`, `autofollow_result: "PASS"`, exit code 0. Hook sentinels ABSENT. | Isolated temp repo. Verifies checkout hooks are suppressed and cannot execute or mutate files. |
| NEG-09b | Checkout Hook Setup Failure | Isolated git repo. `$EmptyHooksPath` is missing, non-empty, or not creatable exclusively. | Execute N0 autofollow evaluation. | `REFUSED_HOOK_SETUP_FAILED` | 1 | `autofollow_decision: "REFUSED_HOOK_SETUP_FAILED"`, `autofollow_attempted: false`, `terminal_state: "FAILED"`, `HEAD` unchanged. | Isolated temp repo. Fail-closed on hook suppression setup failure. |
| NEG-10 | On-Disk Manifest Equality Gate (Gate 7) | Isolated git repo where a post-checkout filter or disk mutation produces an on-disk SHA-256 digest mismatch. Terminalization closure is TRUSTED. | Execute N0 autofollow evaluation and checkout. | `REFUSED_REPIN_VERIFY_FAILED` | 1 | `autofollow_decision: "REFUSED_REPIN_VERIFY_FAILED"`, `autofollow_attempted: true`, `autofollow_result: "FAIL"`, `terminal_state: "FAILED"`, exit code 1. | Isolated temp repo. Trusted closure writes valid FAILED receipt. |
| NEG-11 | Unprovable Terminalization Closure | Isolated git repo. Post-checkout validation fails, AND terminalization closure hash is MISMATCHED. | Execute N0 autofollow evaluation and checkout. | `REFUSED_REPIN_VERIFY_FAILED` | 1 | NO terminal receipt claimed or written. Wrapper calls `Exit-NightlyTerminalFailure` which performs native `exit 1`. | Isolated temp repo. Proves unprovable closure bails cleanly without forging receipt. |

## 4. Positive Advance, Process Custody, and Integration Tests

| Test ID | Scenario | Setup / Preconditions | Action | Expected Decision Enum | Expected Exit Code | Expected Terminal Receipt Fields & Invariants | Isolation & Safety |
|---|---|---|---|---|---|---|---|
| POS-01 | Clean Fast-Forward Repin | Isolated git repo on clean detached HEAD. Target OID is a clean fast-forward commit modifying `docs/**` only. | Execute N0 autofollow evaluation. | `REPINNED` | 0 | `autofollow_decision: "REPINNED"`, `autofollow_attempted: true`, `autofollow_result: "PASS"`, `autofollow_starting_head != target_oid`, `autofollow_final_head == target_oid`, N1 build executes on target OID. | Isolated temp repo. Exits code 0 on full successful run. |
| POS-02 | Already-Current No-Op | Isolated git repo on clean detached HEAD where target OID equals current HEAD OID. | Execute N0 autofollow evaluation. | `ALREADY_CURRENT` | 0 | `autofollow_decision: "ALREADY_CURRENT"`, `autofollow_attempted: false`, `autofollow_result: "PASS"`, `autofollow_starting_head == autofollow_final_head`. | Isolated temp repo. Exits code 0 on full successful run. |
| POS-03 | In-Wrapper Custody & Execution Continuity | Isolated git repo. `nightly_wiki_sync.ps1` executes N0 custody baseline, performs autofollow repin, captures `$n0Head`, runs N1-N6, and evaluates terminal custody. | Run full `nightly_wiki_sync.ps1` pipeline. | `REPINNED` | 0 | `autofollow_decision: "REPINNED"`, N0 custody baseline passes, terminal custody passes, `$n0Head == target_oid`. | Isolated temp repo using existing `check_orphans.ps1` fixture snapshot harness. |
| INT-01 | Single-Fetch OID Continuity | Isolated git repo. Relocated `serve_gate.py fetch` runs at N0, producing `fetched_oid`. | Run full wrapper pipeline. | `REPINNED` | 0 | Single `fetched_oid` used for N0 autofollow decision, N1 build, and N6 `serve_gate.py verify`. Exactly ONE fetch executed. | Isolated temp repo. Asserts fetch count == 1. |
| INT-02 | Build-Stamp & Cache Hash Synchronization | Isolated git repo. Repin succeeds at N0, N1-N6 complete. | Run full wrapper pipeline. | `REPINNED` | 0 | `wiki\.build-stamp` contains canonical `HEAD: <target_oid>` line matching final `HEAD`. `$n0Head` inclusion in `$hashBytes` forces `$forceFull = true`. | Isolated temp repo. |
| INT-03 | Terminal Receipt Schema & Field Order Assertion | Full wrapper run completes. Terminal receipt generated. | Parse raw receipt JSON. | `REPINNED` / `ALREADY_CURRENT` | 0 | `top.Count == 43`. Appended `autofollow_*` fields occupy indices 36-42. `top[27]` (`n5_post_mutation_scan`) and `top[28]` (`n5_release`) positionally unchanged. Exit code reflects overall run outcome (0 for successful run). | Validated against `Test-TerminalReceiptRawSchema` in `activation_preflight.ps1`. |
| INT-04 | Preflight Schema & Required Fields Assertion | `test_activation_preflight.py` executes schema validation test suite against receipt fixtures. | Run `python -m unittest` on `test_activation_preflight.py`. | `REPINNED` / `ALREADY_CURRENT` | 0 | Validates `$expectedTop` count 43, exact 7 appended field names, and positional invariance of indices 27 and 28 in `test_activation_preflight.py:660, 1263`. | Unit test assertions in `test_activation_preflight.py`. |

## 5. Catch-All Backstop Exception Test

| Test ID | Scenario | Setup / Preconditions | Action | Expected Decision Enum | Expected Exit Code | Expected Terminal Receipt Fields & Invariants | Isolation & Safety |
|---|---|---|---|---|---|---|---|
| TST-01 | Catch-All Exception Handling | Isolated git repo fixture; wrapper invocation encounters an unhandled I/O exception AFTER receipt/autofollow initialization and AFTER trap arming. | Execute N0 autofollow under mock wrapper harness. | `REFUSED_UNEXPECTED` | 1 | Unhandled exception caught by wrapper `trap` block. `Complete-NightlyRun 1 'FAILED'` executed with native exit code 1. Valid FAILED receipt published. | Isolated temp repo in `test_wrapper_contracts.py`. Deterministic expected decision `REFUSED_UNEXPECTED` and exit code 1. |
