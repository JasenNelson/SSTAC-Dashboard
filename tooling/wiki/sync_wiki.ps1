param (
    [switch]$SkipGraph,
    [Parameter(Mandatory=$true)]
    [string]$Stamp,
    [string]$GraphifyExe = 'graphify',
    # Hard timeout (seconds) for the guarded `graphify update` graph build. graphify has no
    # timeout/memory cap on Windows, so the build MUST go through Invoke-GraphifyGuarded, which
    # fails closed (exit 124 + tree-kill-by-PID) if the build hangs past this. Generous default
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

# Dot-source the graphify guardrail (hard timeout + fail-closed snapshot-then-tree-kill-by-PID).
# The graph build in step 1 MUST go through Invoke-GraphifyGuarded -- graphify has no timeout /
# memory cap on Windows, so an unguarded graph-build invocation could hang unbounded (D1 fix
# 2026-07-22; plan section 7 requires zero bare graphify calls outside Invoke-GraphifyGuarded).
. (Join-Path $PSScriptRoot 'graphify_guardrail.ps1')

# Both Python call sites below deliberately use the pinned .venv-graphify interpreter, not
# a bare `python` on PATH -- the pilot's graphifyy[sql,mcp]==0.9.17 pin (and its transitive
# deps) live ONLY in that venv (see requirements-graphify.txt); a bare `python` call would
# silently run against whatever interpreter happens to be first on PATH.
$venvPython = Join-Path $repoRoot '.venv-graphify\Scripts\python.exe'

Write-Host "--- 0. Docs scope + trust overlay (Phase 4) ---"
# The docs-trust negation overlay (docs\.graphifyignore) is untracked and MUST be
# regenerated before any build (codex P2, 2026-07-22): on a clean checkout the root *.md
# blanket would otherwise silently exclude every registered doc from the graph while this
# script appeared to succeed. Fail-closed on scope errors.
& $venvPython tooling\wiki\gen_docs_scope.py --repo-root . --out graphify-out\docs_scope.json --emit-overlay
if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: docs scope/overlay generation'; exit 1 }

Write-Host "--- 1. Graph Generation ---"
if (-not $SkipGraph) {
    # Guarded build: fail closed on hang (timeout -> exit 124 + tree-kill) AND on a non-zero
    # graphify exit. Never a silent success. (D1 fix: replaces the former unguarded graph-build call.)
    $graphResult = Invoke-GraphifyGuarded -GraphifyExe $GraphifyExe -GraphifyArgs @('update', '.', '--no-cluster') -TimeoutSec $GraphTimeoutSec
    if ($graphResult.TimedOut) {
        Write-Host "FAIL: graph generation TIMED OUT after ${GraphTimeoutSec}s (guarded; tree fully killed=$($graphResult.Killed))"
        exit 1
    }
    if ($graphResult.ExitCode -ne 0) {
        Write-Host "FAIL: graph generation (graphify exit $($graphResult.ExitCode))"
        exit 1
    }
}

Write-Host "--- 1b. Graph smoke + secrets scan (Phase 4 gates) ---"
& $venvPython tooling\wiki\graph_smoke.py --graph graphify-out\graph.json --repo-root .
if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: graph smoke (hard abort)'; exit 1 }
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
& $venvPython $publishHelper --repo-root $repoRoot finalize --staging $stagingWiki --graph (Join-Path $repoRoot 'graphify-out\graph.json') --graph-report (Join-Path $repoRoot 'graphify-out\GRAPH_REPORT.md') --stamp $Stamp --head $syncHead
if ((-not $?) -or ($LASTEXITCODE -ne 0)) { Write-Host 'FAIL: staging package finalization'; exit 1 }
& $venvPython $publishHelper --repo-root $repoRoot swap --served $servedWiki --staging $stagingWiki --backup $publishBackup
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
