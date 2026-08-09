param (
    [switch]$SkipGraph,
    [Parameter(Mandatory=$true)]
    [string]$Stamp,
    [string]$GraphifyExe = '',
    # Hard timeout (seconds) for the guarded `graphify update` graph build. graphify has no
    # timeout/memory cap on Windows, so the build MUST go through Invoke-GraphifyGuarded, which
    # fails closed (exit 124 + exact-root termination; descendant tree unproven) if the build hangs
    # past this. Generous default
    # for a full first build; override for a large graph.
    [int]$GraphTimeoutSec = 1800,
    [switch]$AutoCommit
)

# NOTE (pilot, Phase 0-3.5): -AutoCommit is implemented below for parity with the OHD
# reference (and for graduation-time reuse per the plan's Phase 7), but it is NEVER passed
# during the pilot -- wiki/ is gitignored/untracked (see .gitignore + .graphifyignore), so
# there is nothing here that should ever be committed from this script while the pilot is
# in effect. If you find yourself passing -AutoCommit before Phase 7 graduation, stop.

$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location -Path $repoRoot

# Dot-source the graphify guardrail (hard timeout + fail-closed exact-root termination).
# The graph build in step 1 MUST go through Invoke-GraphifyGuarded -- graphify has no timeout /
# memory cap on Windows, so an unguarded graph-build invocation could hang unbounded (D1 fix
# 2026-07-22; plan section 7 requires zero bare graphify calls outside Invoke-GraphifyGuarded).
. (Join-Path $PSScriptRoot 'graphify_guardrail.ps1')

function Get-WikiSyncGraphifyExitCode {
    param([Parameter(Mandatory=$true)]$Result)
    if ($Result.TimedOut -or $Result.OrphanRisk) { return 124 }
    if ($Result.GuardrailFailed -or $Result.ExitCode -ne 0) { return 1 }
    return 0
}

function Get-WikiSyncExactNonnegativeInteger {
    param(
        [Parameter(Mandatory=$true)]$Object,
        [Parameter(Mandatory=$true)][string]$PropertyName,
        [Parameter(Mandatory=$true)][int]$Maximum
    )
    $property = $Object.PSObject.Properties[$PropertyName]
    $integerTypes = @([byte], [sbyte], [int16], [uint16], [int32], [uint32], [int64])
    if ($null -eq $property -or $null -eq $property.Value -or
        $integerTypes -notcontains $property.Value.GetType()) {
        throw "invalid integer type $PropertyName"
    }
    $value = [int64]$property.Value
    if ($value -lt 0 -or $value -gt $Maximum) {
        throw "invalid integer range $PropertyName"
    }
    return [int]$value
}

function Resolve-WikiSyncExecutable {
    param(
        [string]$Candidate,
        [Parameter(Mandatory=$true)][string]$DefaultPath,
        [Parameter(Mandatory=$true)][string]$Label
    )
    $requested = if ([string]::IsNullOrWhiteSpace($Candidate)) { $DefaultPath } else { $Candidate }
    if (-not [System.IO.Path]::IsPathRooted($requested)) {
        throw "$Label must be an exact absolute path: $requested"
    }
    if (-not (Test-Path -LiteralPath $requested -PathType Leaf)) {
        throw "$Label is missing or is not a file: $requested"
    }
    return (Resolve-Path -LiteralPath $requested -ErrorAction Stop).Path
}

# Every Python call deliberately uses the selected runtime's pinned .venv-graphify
# interpreter. A full graph rebuild also defaults to that same venv's graphify.exe.
# Bare PATH resolution is rejected so an incomplete runtime cannot silently publish a
# graph built by a different Graphify installation.
$venvPythonDefault = Join-Path $repoRoot '.venv-graphify\Scripts\python.exe'
$graphifyDefault = Join-Path $repoRoot '.venv-graphify\Scripts\graphify.exe'
try {
    $venvPython = Resolve-WikiSyncExecutable -Candidate $venvPythonDefault -DefaultPath $venvPythonDefault -Label 'Pinned Python executable'
    if (-not $SkipGraph) {
        $GraphifyExe = Resolve-WikiSyncExecutable -Candidate $GraphifyExe -DefaultPath $graphifyDefault -Label 'Graphify executable'
    }
} catch {
    Write-Host "FAIL: executable resolution: $($_.Exception.Message)"
    exit 1
}

$graphPath = Join-Path $repoRoot 'graphify-out\graph.json'

Write-Host "--- 0. Docs scope + trust overlay (Phase 4) ---"
# The docs-trust negation overlay (docs\.graphifyignore) is untracked and MUST be
# regenerated before any build (codex P2, 2026-07-22): on a clean checkout the root *.md
# blanket would otherwise silently exclude every registered doc from the graph while this
# script appeared to succeed. Fail-closed on scope errors.
& $venvPython tooling\wiki\gen_docs_scope.py --repo-root . --out graphify-out\docs_scope.json --emit-overlay
if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: docs scope/overlay generation'; exit 1 }

Write-Host "--- 1. Graph Generation ---"
if (-not $SkipGraph) {
    # Guarded build: fail closed on hang (timeout -> exit 124; descendant tree unproven) AND on a non-zero
    # graphify exit. Never a silent success. (D1 fix: replaces the former unguarded graph-build call.)
    $graphResult = Invoke-GraphifyGuarded -GraphifyExe $GraphifyExe -GraphifyArgs @('update', '.', '--no-cluster') -TimeoutSec $GraphTimeoutSec
    $graphDecisionExit = Get-WikiSyncGraphifyExitCode -Result $graphResult
    if ($graphDecisionExit -eq 124) {
        Write-Host "FAIL: graph generation timeout or explicit orphan/custody risk (exit 124; timed out=$($graphResult.TimedOut); guardrail failed=$($graphResult.GuardrailFailed); orphan risk=$($graphResult.OrphanRisk); root terminated=$($graphResult.RootTerminated); cleanup=$($graphResult.CleanupStatus); error=$($graphResult.CleanupError); descendant tree unproven)"
        exit 124
    }
    if ($graphDecisionExit -ne 0) {
        Write-Host "FAIL: graph generation guardrail/nonzero failure (graphify exit=$($graphResult.ExitCode); guardrail failed=$($graphResult.GuardrailFailed); error=$($graphResult.GuardrailError))"
        exit 1
    }

    Write-Host "--- 1a. Deterministic pre-cluster canonicalization + smoke ---"
    & $venvPython tooling\wiki\canonicalize_graph.py --graph $graphPath --repo-root . --receipt graphify-out\canonicalization-precluster-sync.json
    if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: pre-cluster graph canonicalization'; exit 1 }
    & $venvPython tooling\wiki\graph_smoke.py --graph $graphPath --repo-root . --receipt graphify-out\smoke-precluster-sync.json
    if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: deterministic pre-cluster graph smoke'; exit 1 }

    Write-Host "--- 1b. Deterministic clustering ---"
    $clusterResult = Invoke-GraphifyGuarded -GraphifyExe $GraphifyExe -GraphifyArgs @('cluster-only', $repoRoot, '--no-label', '--no-viz') -TimeoutSec $GraphTimeoutSec
    $clusterDecisionExit = Get-WikiSyncGraphifyExitCode -Result $clusterResult
    if ($clusterDecisionExit -eq 124) {
        Write-Host "FAIL: graph clustering timeout or explicit orphan/custody risk (exit 124; timed out=$($clusterResult.TimedOut); guardrail failed=$($clusterResult.GuardrailFailed); orphan risk=$($clusterResult.OrphanRisk); root terminated=$($clusterResult.RootTerminated); cleanup=$($clusterResult.CleanupStatus); error=$($clusterResult.CleanupError); descendant tree unproven)"
        exit 124
    }
    if ($clusterDecisionExit -ne 0) {
        Write-Host "FAIL: graph clustering guardrail/nonzero failure (graphify exit=$($clusterResult.ExitCode); guardrail failed=$($clusterResult.GuardrailFailed); error=$($clusterResult.GuardrailError))"
        exit 1
    }
} else {
    Write-Host "SKIP: graph update and clustering disabled; validating the existing clustered graph before publication"
    if (-not (Test-Path -LiteralPath $graphPath -PathType Leaf)) {
        Write-Host 'FAIL: -SkipGraph requires an existing graphify-out\graph.json'
        exit 1
    }
}

Write-Host "--- 1c. Final canonicalization ---"
& $venvPython tooling\wiki\canonicalize_graph.py --graph $graphPath --repo-root . --receipt graphify-out\canonicalization-sync-final.json
if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: final graph canonicalization'; exit 1 }

Write-Host "--- 1d. Community-required final smoke + secrets scan (Phase 4 gates) ---"
$plainSyncSmokeReceipt = Join-Path $repoRoot 'graphify-out\smoke-sync.json'
& $venvPython tooling\wiki\graph_smoke.py --graph $graphPath --repo-root . --require-communities --receipt $plainSyncSmokeReceipt
if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: graph smoke (hard abort)'; exit 1 }
try {
    $plainSyncSmokeEvidence = Get-Content -LiteralPath $plainSyncSmokeReceipt -Raw | ConvertFrom-Json
    $publishedGraphSha256 = [string]$plainSyncSmokeEvidence.graph_sha256
    $smokeNodeCount = Get-WikiSyncExactNonnegativeInteger -Object $plainSyncSmokeEvidence.graph_integrity -PropertyName 'node_count' -Maximum 10000000
    $smokePopulatedNodeCount = Get-WikiSyncExactNonnegativeInteger -Object $plainSyncSmokeEvidence.community_contract -PropertyName 'populated_node_count' -Maximum 10000000
    $smokeCommunityCount = Get-WikiSyncExactNonnegativeInteger -Object $plainSyncSmokeEvidence.community_contract -PropertyName 'distinct_community_count' -Maximum 10000000
} catch {
    Write-Host "FAIL: graph smoke receipt is missing or malformed: $($_.Exception.Message)"
    exit 1
}
if ($publishedGraphSha256 -cnotmatch '^[0-9a-f]{64}$' -or
    $plainSyncSmokeEvidence.hard_abort -isnot [bool] -or
    $plainSyncSmokeEvidence.hard_abort -or
    [string]$plainSyncSmokeEvidence.graph_integrity.status -cne 'PASS' -or
    [string]$plainSyncSmokeEvidence.community_contract.status -cne 'PASS' -or
    $smokePopulatedNodeCount -ne $smokeNodeCount -or
    $smokeCommunityCount -lt 1 -or $smokeCommunityCount -gt $smokeNodeCount) {
    Write-Host 'FAIL: graph smoke receipt is not successful, community-complete, or hash-bound'
    exit 1
}
$publishedGraphPath = $graphPath
& $venvPython tooling\wiki\scan_secrets.py --repo-root . --target graphify-out
if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: secrets scan on graphify-out'; exit 1 }

$servedWiki = Join-Path $repoRoot 'wiki'
$stagingWiki = Join-Path $repoRoot 'wiki.staging'
$publishHelper = Join-Path $repoRoot 'tooling\wiki\publish_wiki.py'
$publishBackup = Join-Path $repoRoot ".tmp\wiki-publish-backup-$PID"

Write-Host "--- 2. Prepare + Compile Staging Wiki ---"
& $venvPython $publishHelper --repo-root $repoRoot prepare --served $servedWiki --staging $stagingWiki
if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: staging preparation'; exit 1 }
& $venvPython tooling\wiki\wiki_compile.py --graph graphify-out\graph.json --repo-root . --out $stagingWiki --stamp $Stamp
if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: step (launch or exit failure)'; exit 1 }

Write-Host "--- 3. Staging Wiki Gates ---"
& $venvPython tooling\wiki\wiki_lint.py --wiki $stagingWiki
if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: step (launch or exit failure)'; exit 1 }
& $venvPython tooling\wiki\scan_secrets.py --repo-root . --target wiki.staging
if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: secrets scan on staging wiki'; exit 1 }

# NOTE: the OHD reference invokes promotion.py here (unconditionally, every sync). This
# SSTAC port deliberately DROPS that call -- the single-invocation rule (conventions.md
# section 4.1): promotion.py runs ONLY from the coverage-guarded semantic step (Phase 4/5,
# contingent) or a one-time manual ledger seed (Phase 3). An unguarded promotion pass
# wired into every plain sync_wiki.ps1 run would apply demotion/churn logic over a graph
# that may lack cached doc edges (or reflect a lock-busy/partial night), mass-demoting the
# ledger for reasons that have nothing to do with the code actually changing. To seed or
# refresh the ledger, invoke tooling\wiki\promotion.py directly (see conventions.md).

Write-Host "--- 4. Finalize + Publish Served Package ---"
$syncHead = (git rev-parse HEAD).Trim()
if ((-not $?) -or ($LASTEXITCODE -ne 0) -or (-not $syncHead)) {
    Write-Host 'FAIL: could not resolve HEAD for build stamp'
    exit 1
}
& $venvPython $publishHelper --repo-root $repoRoot finalize --staging $stagingWiki --graph $publishedGraphPath --graph-report (Join-Path $repoRoot 'graphify-out\GRAPH_REPORT.md') --stamp $Stamp --head $syncHead --expected-graph-sha256 $publishedGraphSha256
if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: staging package finalization'; exit 1 }
& $venvPython $publishHelper --repo-root $repoRoot swap --served $servedWiki --staging $stagingWiki --backup $publishBackup --expected-graph-sha256 $publishedGraphSha256
if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: served wiki swap'; exit 1 }

Write-Host "--- 5. Changed Files ---"
# wiki\ is gitignored during the pilot (see .gitignore); this reports the untracked diff
# for operator visibility only -- it is NOT evidence of anything stageable.
git status --porcelain -- wiki\
if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: step (launch or exit failure)'; exit 1 }

if ($AutoCommit) {
    $wikiChanges = (git status --porcelain -- wiki\)
    if ($wikiChanges) {
        git add -f -- wiki\
        # PATHSPEC-SCOPED commit: 'git commit ... -- wiki' commits ONLY wiki paths even
        # when unrelated files sit staged in the index (never sweeps pre-staged owner work).
        git commit -m "chore(wiki): sync-wiki recompile $Stamp (trivial-skip: pure regeneration, lint clean, deterministic pipeline)" -- wiki
        if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host "FAIL: commit failed"; exit 1 }
    } else {
        Write-Host "No wiki changes; nothing to commit."
        exit 0
    }
}

exit 0
