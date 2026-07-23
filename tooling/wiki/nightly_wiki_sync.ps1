param(
    [string]$RepoRoot,
    [switch]$SkipLabeling,
    [switch]$SkipSemantic
)
if (-not $RepoRoot) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}
$stamp = (Get-Date -Format 'yyyy-MM-dd')
$logDir = Join-Path $RepoRoot ".tmp_wiki_nightly"
if (-not (Test-Path $logDir)) {
    $null = New-Item -ItemType Directory -Force -Path $logDir
}

$transcriptPath = Join-Path $logDir "transcript-$stamp.log"
Start-Transcript -Path $transcriptPath -Append

. (Join-Path $RepoRoot "tooling\wiki\graphify_guardrail.ps1")
. (Join-Path $RepoRoot "tooling\wiki\ollama_lock.ps1")

# Config
$configFile = Join-Path $RepoRoot "tooling\wiki\wiki_nightly_config.json"
$cfgModel = 'qwen3:14b'
$cfgTimeoutUpdateInc = 2700
$cfgTimeoutUpdateFull = 7200
$cfgTimeoutCluster = 1800
$cfgTimeoutLabel = 3600
$cfgTimeoutSemOuter = 3600
$cfgTimeoutSemInner = 3000
$cfgExpiryLabelOnly = 60
$cfgExpiryLabelSem = 150
if (Test-Path $configFile) {
    try {
        $cfg = Get-Content $configFile -Raw | ConvertFrom-Json
        if ($cfg.model) { $cfgModel = $cfg.model }
        if ($cfg.timeouts_sec.update_incremental) { $cfgTimeoutUpdateInc = $cfg.timeouts_sec.update_incremental }
        if ($cfg.timeouts_sec.update_full) { $cfgTimeoutUpdateFull = $cfg.timeouts_sec.update_full }
        if ($cfg.timeouts_sec.cluster) { $cfgTimeoutCluster = $cfg.timeouts_sec.cluster }
        if ($cfg.timeouts_sec.label) { $cfgTimeoutLabel = $cfg.timeouts_sec.label }
        if ($cfg.timeouts_sec.semantic_outer) { $cfgTimeoutSemOuter = $cfg.timeouts_sec.semantic_outer }
        if ($cfg.timeouts_sec.semantic_inner) { $cfgTimeoutSemInner = $cfg.timeouts_sec.semantic_inner }
        if ($cfg.lock_expiry_minutes.label_only) { $cfgExpiryLabelOnly = $cfg.lock_expiry_minutes.label_only }
        if ($cfg.lock_expiry_minutes.label_plus_semantic) { $cfgExpiryLabelSem = $cfg.lock_expiry_minutes.label_plus_semantic }
    } catch {}
}

$graphifyExe = Join-Path $RepoRoot ".venv-graphify\Scripts\graphify.exe"
$pythonExe = Join-Path $RepoRoot ".venv-graphify\Scripts\python.exe"

$step1Status = "SKIPPED"
$step2Status = "SKIPPED"
$step5Status = "SKIPPED"
$promStatus = "SKIPPED"
$step6Status = "SKIPPED"
$wikiServedStatus = "SKIPPED"
$promotionCandidateReady = $false
$n0Head = ""
$n0PorcelainLines = 0
$graphOrphanRisk = $false
$gpuOrphanRisk = $false
$secretHit = $false
$serveGateSummary = "not evaluated"
$serveGateRequiredRef = "refs/remotes/origin/main"

Write-Host "--- N0 PREFLIGHT ---"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "tooling\wiki\check_orphans.ps1")
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: ORPHANS DETECTED"
    "SKIPPED_ORPHANS" | Set-Content (Join-Path $logDir "receipt-$stamp.md")
    exit 1
}

$commonDir = (git -C $RepoRoot rev-parse --git-common-dir).Trim()
$hookDrift = $false
$hookPath = Join-Path $RepoRoot "$commonDir\hooks"
if (Test-Path $hookPath) {
    Get-ChildItem -Path $hookPath -File -ErrorAction SilentlyContinue | ForEach-Object {
        if ((Get-Content $_.FullName -Raw) -match 'graphify-hook-start') {
            $hookDrift = $true
        }
    }
}
if ($hookDrift) {
    Write-Host "FAIL: HOOK_DRIFT"
    "HOOK_DRIFT" | Set-Content (Join-Path $logDir "receipt-$stamp.md")
    exit 1
}

$treeDirty = $false
if (Test-Path (Join-Path $RepoRoot "$commonDir\rebase-merge")) { $treeDirty = $true }
if (Test-Path (Join-Path $RepoRoot "$commonDir\rebase-apply")) { $treeDirty = $true }
if (Test-Path (Join-Path $RepoRoot "$commonDir\MERGE_HEAD")) { $treeDirty = $true }
if ($treeDirty) {
    Write-Host "SKIP: SKIPPED_DIRTY_TREE"
    "SKIPPED_DIRTY_TREE" | Set-Content (Join-Path $logDir "receipt-$stamp.md")
    exit 0
}
$n0PorcelainLines = @(git -C $RepoRoot status --porcelain).Count
$n0Head = (git -C $RepoRoot rev-parse HEAD).Trim()

Write-Host "--- N1 FETCH+SCOPE+HASH ---"
$serveGateRunId = [guid]::NewGuid().ToString('N')
$serveGateFetchReceipt = Join-Path $logDir "serve-gate-fetch-$stamp-$serveGateRunId.json"
$promotionCandidate = Join-Path $logDir "promotion-candidate-$stamp-$serveGateRunId.json"
$serveGateFetchRaw = (& $pythonExe (Join-Path $RepoRoot "tooling\wiki\serve_gate.py") --repo-root $RepoRoot --config $configFile fetch --receipt $serveGateFetchReceipt) -join "`n"
$fetchOk = ($LASTEXITCODE -eq 0)
try {
    $serveGateFetchResult = $serveGateFetchRaw | ConvertFrom-Json
    if ($serveGateFetchResult.required_ref) {
        $serveGateRequiredRef = $serveGateFetchResult.required_ref
    }
} catch {
    $fetchOk = $false
}

# --emit-overlay is REQUIRED here (codex P2): without regenerating the docs-trust
# negation overlay the root *.md blanket excludes every registered doc from N1 build.
& $pythonExe (Join-Path $RepoRoot "tooling\wiki\gen_docs_scope.py") --repo-root $RepoRoot --out (Join-Path $RepoRoot "graphify-out\docs_scope.json") --emit-overlay
if ($LASTEXITCODE -eq 2) {
    Write-Host "FAIL: DOCS_SCOPE_FAIL"
    "DOCS_SCOPE_FAIL" | Set-Content (Join-Path $logDir "receipt-$stamp.md")
    exit 1
}

$hashBytes = New-Object System.Collections.Generic.List[byte]
$gi = Join-Path $RepoRoot ".graphifyignore"
if (Test-Path $gi) { $hashBytes.AddRange([System.IO.File]::ReadAllBytes($gi)) }
$giti = Join-Path $RepoRoot ".gitignore"
if (Test-Path $giti) { $hashBytes.AddRange([System.IO.File]::ReadAllBytes($giti)) }
$ds = Join-Path $RepoRoot "graphify-out\docs_scope.json"
if (Test-Path $ds) { $hashBytes.AddRange([System.IO.File]::ReadAllBytes($ds)) }

$graphifyVer = & $graphifyExe --version
$hashBytes.AddRange([System.Text.Encoding]::UTF8.GetBytes("$graphifyVer"))
$hashBytes.AddRange([System.Text.Encoding]::UTF8.GetBytes("$RepoRoot"))

$sha256 = [System.Security.Cryptography.SHA256]::Create()
$hashString = [BitConverter]::ToString($sha256.ComputeHash($hashBytes.ToArray())).Replace("-", "").ToLower()

$forceFull = $true
$hashFile = Join-Path $RepoRoot "graphify-out\.scan_config_hash"
if (Test-Path $hashFile) {
    $existingHash = (Get-Content $hashFile -Raw).Trim()
    if ($existingHash -eq $hashString) {
        $forceFull = $false
    }
}

Write-Host "--- N1 BUILD ---"
$n1BuildOk = $false
if ($forceFull) {
    $gj = Join-Path $RepoRoot "graphify-out\graph.json"
    if (Test-Path $gj) { Remove-Item $gj -Force }
    $gr = Invoke-GraphifyGuarded -GraphifyExe $graphifyExe -GraphifyArgs @('update', $RepoRoot, '--no-cluster') -TimeoutSec $cfgTimeoutUpdateFull
} else {
    $gr = Invoke-GraphifyGuarded -GraphifyExe $graphifyExe -GraphifyArgs @('update', $RepoRoot, '--no-cluster') -TimeoutSec $cfgTimeoutUpdateInc
}

if ($gr.TimedOut -or $gr.ExitCode -ne 0) {
    Write-Host "FAIL: graphify update"
    $step1Status = "FAIL"
    if ($gr.TimedOut -and -not $gr.Killed) { $graphOrphanRisk = $true }
} else {
    $step1Status = "OK"
    $n1BuildOk = $true
    Set-Content -Path $hashFile -Value $hashString
}

Write-Host "--- N2 CLUSTER ---"
if ($graphOrphanRisk) {
    Write-Host "SKIP: graphOrphanRisk"
    $step2Status = "SKIPPED_ORPHAN_RISK"
} else {
    $gr = Invoke-GraphifyGuarded -GraphifyExe $graphifyExe -GraphifyArgs @('cluster-only', $RepoRoot, '--no-label', '--no-viz') -TimeoutSec $cfgTimeoutCluster
    if ($gr.TimedOut -or $gr.ExitCode -ne 0) {
        Write-Host "FAIL: graphify cluster-only"
        $step2Status = "FAIL"
        if ($gr.TimedOut -and -not $gr.Killed) { $graphOrphanRisk = $true }
    } else {
        $step2Status = "OK"
    }
}

if (-not (Test-Path (Join-Path $RepoRoot "graphify-out\graph.json"))) {
    Write-Host "WARN: graph.json missing"
}

Write-Host "--- N3 SECRETS ---"
& $pythonExe (Join-Path $RepoRoot "tooling\wiki\scan_secrets.py") --repo-root $RepoRoot --target graphify-out
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: SECRET_HIT"
    "SECRET_HIT" | Set-Content (Join-Path $logDir "receipt-$stamp.md")
    exit 1
}

Write-Host "--- N4 SMOKE ---"
& $pythonExe (Join-Path $RepoRoot "tooling\wiki\graph_smoke.py") --graph (Join-Path $RepoRoot "graphify-out\graph.json") --repo-root $RepoRoot --receipt (Join-Path $logDir "smoke-$stamp.json")
if ($LASTEXITCODE -eq 1) {
    Write-Host "FAIL: SMOKE_FAIL"
    "SMOKE_FAIL" | Set-Content (Join-Path $logDir "receipt-$stamp.md")
    exit 1
}

Write-Host "--- N5 SEMANTIC ---"
$semanticSkippedReason = ""
if ($graphOrphanRisk) {
    $semanticSkippedReason = "graphOrphanRisk"
} elseif ($SkipSemantic -or ($SkipLabeling -and $SkipSemantic)) {
    $semanticSkippedReason = "SkipFlags"
}

if ($semanticSkippedReason) {
    $step5Status = "SEMANTIC_SKIPPED_$semanticSkippedReason"
} else {
    $lockMins = if ($SkipSemantic) { $cfgExpiryLabelOnly } else { $cfgExpiryLabelSem }
    $h = Invoke-OllamaLockAcquire -BlockId 'SSTAC-NIGHTLY' -Purpose 'nightly label+semantic' -ExpiryMinutes $lockMins -Model $cfgModel
    if ($null -eq $h) {
        $step5Status = "SEMANTIC_SKIPPED_LOCK"
    } else {
        # Exit codes are CHECKED (codex P2, 2026-07-22): a red label/semantic run must never
        # release COMPLETED_GREEN, never promote, and never let the receipt read OK. Single
        # release site (the finally) -- no branch releases early (no double-release).
        $step5Fail = $false
        $secretHitPost = $false
        try {
            if (-not $SkipLabeling) {
                $gr = Invoke-GraphifyGuarded -GraphifyExe $graphifyExe -GraphifyArgs @('label', $RepoRoot, '--backend=ollama', "--model=$cfgModel", '--max-concurrency=1') -TimeoutSec $cfgTimeoutLabel
                if ($gr.TimedOut -and -not $gr.Killed) { $gpuOrphanRisk = $true }
                if ($gr.TimedOut -or $gr.ExitCode -ne 0) { $step5Fail = $true }
            }
            if (-not $gpuOrphanRisk -and -not $step5Fail) {
                $semArgs = @('-NoProfile','-ExecutionPolicy','Bypass','-File', (Join-Path $RepoRoot "tooling\wiki\semantic_extract.ps1"), '-SkipLock', '-TimeoutSec', $cfgTimeoutSemInner)
                $sr = Invoke-GraphifyGuarded -GraphifyExe 'powershell' -GraphifyArgs $semArgs -TimeoutSec $cfgTimeoutSemOuter
                if ($sr.TimedOut -and -not $sr.Killed) { $gpuOrphanRisk = $true }
                if ($sr.TimedOut -or $sr.ExitCode -ne 0) { $step5Fail = $true }

                # POST-SEMANTIC RE-SCAN (no early release/exit here -- flag and fall through
                # so the single finally-release runs; receipt + exit happen after).
                & $pythonExe (Join-Path $RepoRoot "tooling\wiki\scan_secrets.py") --repo-root $RepoRoot --target graphify-out
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "FAIL: SECRET_HIT_POST"
                    $secretHitPost = $true
                    $step5Fail = $true
                }

                # PROMOTION (THE ONLY invocation; skipped on any semantic-step failure --
                # promotion over a red/partial extract is exactly what the coverage guard
                # + this skip both exist to prevent).
                if ($step5Fail) {
                    $promStatus = "PROMOTION_SKIPPED_SEMANTIC_FAIL"
                } else {
                    $currHead = (git -C $RepoRoot rev-parse HEAD).Trim()
                    $currPorcelain = @(git -C $RepoRoot status --porcelain --untracked-files=no)
                    if ($currPorcelain.Count -ne 0) {
                        $promStatus = "PROMOTION_SKIPPED_DIRTY_TREE"
                    } elseif ($currHead -ne $n0Head) {
                        $promStatus = "PROMOTION_SKIPPED_HEAD_MOVED"
                    } else {
                        $servedPromotion = Join-Path $RepoRoot "wiki\.graph\promotion.json"
                        try {
                            if (Test-Path -LiteralPath $servedPromotion) {
                                Copy-Item -LiteralPath $servedPromotion -Destination $promotionCandidate -Force -ErrorAction Stop
                            }
                            $promArgs = @((Join-Path $RepoRoot "tooling\wiki\promotion.py"), '--graph', (Join-Path $RepoRoot "graphify-out\graph.json"), '--state', $promotionCandidate, '--commit', (git -C $RepoRoot rev-parse --short HEAD).Trim(), '--report')
                            & $pythonExe @promArgs
                            if ($LASTEXITCODE -ne 0) {
                                $promStatus = "PROMOTION_FAILED"
                                $step5Fail = $true
                            } else {
                                $promotionCandidateReady = Test-Path -LiteralPath $promotionCandidate
                                $promStatus = "PROMOTION_DONE"
                            }
                        } catch {
                            Write-Host "FAIL: promotion candidate preparation: $($_.Exception.Message)"
                            $promStatus = "PROMOTION_FAILED"
                            $step5Fail = $true
                        }
                    }
                }
            }
            $step5Status = if ($step5Fail) { "FAIL" } else { "OK" }
        } finally {
            if ($gpuOrphanRisk) {
                Invoke-OllamaLockRelease -Handle $h -GpuOrphanRisk
                $graphOrphanRisk = $true
            } elseif ($step5Fail) {
                Invoke-OllamaLockRelease -Handle $h -Status 'COMPLETED_RED'
            } else {
                Invoke-OllamaLockRelease -Handle $h -Status 'COMPLETED_GREEN'
            }
        }
        if ($secretHitPost) {
            "SECRET_HIT_POST" | Set-Content (Join-Path $logDir "receipt-$stamp.md")
            Stop-Transcript | Out-Null
            exit 1
        }
    }
}

Write-Host "--- N6 WIKI ---"
$wikiServedStatus = ""
$publishHelper = Join-Path $RepoRoot "tooling\wiki\publish_wiki.py"
$ws = Join-Path $RepoRoot "wiki.staging"
$w = Join-Path $RepoRoot "wiki"
$publishBackup = Join-Path $logDir "wiki-backup-$stamp-$PID"
if ($graphOrphanRisk -or -not $n1BuildOk -or $step2Status -eq "FAIL") {
    # A red cluster step blocks serve too (codex P2): never compile/serve over a graph
    # whose required cluster pass failed, even though the raw build succeeded.
    $step6Status = "SKIPPED_PREV_FAIL"
} else {
    & $pythonExe $publishHelper --repo-root $RepoRoot prepare --served $w --staging $ws
    $prepareExit = $LASTEXITCODE
    $compileExit = 1
    $lintExit = 1
    $secretExit = 1
    if ($prepareExit -eq 0) {
        & $pythonExe (Join-Path $RepoRoot "tooling\wiki\wiki_compile.py") --graph (Join-Path $RepoRoot "graphify-out\graph.json") --repo-root $RepoRoot --out $ws --stamp $stamp
        $compileExit = $LASTEXITCODE
    }
    if ($compileExit -eq 0) {
        & $pythonExe (Join-Path $RepoRoot "tooling\wiki\wiki_lint.py") --wiki $ws
        $lintExit = $LASTEXITCODE
    }
    if ($lintExit -eq 0) {
        & $pythonExe (Join-Path $RepoRoot "tooling\wiki\scan_secrets.py") --repo-root $RepoRoot --target wiki.staging
        $secretExit = $LASTEXITCODE
    }

    $semanticPartial = $false
    $grpt = Join-Path $RepoRoot "graphify-out\GRAPH_REPORT.md"
    if (Test-Path $grpt) {
        if ((Get-Content $grpt -Raw) -match 'SUSPECT_PARTIAL') {
            $semanticPartial = $true
        }
    }
    
    $trackedClean = (@(git -C $RepoRoot status --porcelain --untracked-files=no).Count -eq 0)
    $headUnchanged = ((git -C $RepoRoot rev-parse HEAD).Trim() -eq $n0Head)

    $serveGateRaw = (& $pythonExe (Join-Path $RepoRoot "tooling\wiki\serve_gate.py") --repo-root $RepoRoot --config $configFile verify --receipt $serveGateFetchReceipt) -join "`n"
    $serveGateExit = $LASTEXITCODE
    $serveGateOk = $false
    $serveGateReasons = @()
    try {
        $serveGateResult = $serveGateRaw | ConvertFrom-Json
        $serveGateOk = ($serveGateExit -eq 0 -and $serveGateResult.allowed)
        $serveGateReasons = @($serveGateResult.reasons)
        $serveGateSummary = "allowed=$serveGateOk; required_ref=$($serveGateResult.required_ref); fetched_oid=$($serveGateResult.fetched_oid); head=$($serveGateResult.head); ref_head=$($serveGateResult.required_ref_head)"
    } catch {
        $serveGateReasons = @("Serve gate returned invalid output")
        $serveGateSummary = "allowed=False; invalid evaluator output"
    }
    
    # Freshness of receipt lineage OK
    $freshnessOk = $true
    # Skip clause on first run (if no receipt exists)
    $hasReceipts = (Get-ChildItem -Path $logDir -Filter "receipt-*.md" -File -ErrorAction SilentlyContinue).Count -gt 0
    if ($hasReceipts) {
        if (Test-Path (Join-Path $RepoRoot "tooling\wiki\check_nightly_freshness.ps1")) {
            & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "tooling\wiki\check_nightly_freshness.ps1") -RepoRoot $RepoRoot
            if ($LASTEXITCODE -ne 0) { $freshnessOk = $false }
        }
    }
    
    $artifactsOk = ($prepareExit -eq 0 -and $compileExit -eq 0 -and $lintExit -eq 0 -and $secretExit -eq 0)
    if ($serveGateOk -and $trackedClean -and $headUnchanged -and $artifactsOk -and -not $semanticPartial -and $freshnessOk) {
        $promotionStateArgs = @()
        if ($promotionCandidateReady) {
            $promotionStateArgs = @('--promotion-state', $promotionCandidate)
        }
        & $pythonExe $publishHelper --repo-root $RepoRoot finalize --staging $ws --graph (Join-Path $RepoRoot "graphify-out\graph.json") --graph-report $grpt --stamp $stamp --head $n0Head @promotionStateArgs
        $finalizeExit = $LASTEXITCODE
        if ($finalizeExit -eq 0) {
            & $pythonExe $publishHelper --repo-root $RepoRoot swap --served $w --staging $ws --backup $publishBackup
            $swapExit = $LASTEXITCODE
        } else {
            $swapExit = 1
        }
        if ($finalizeExit -eq 0 -and $swapExit -eq 0) {
            $wikiServedStatus = "SERVED_WIKI_SWAPPED"
            $step6Status = "OK"
        } else {
            $wikiServedStatus = "SERVED_WIKI_KEPT_LAST_GOOD (Publish failed)"
            $step6Status = "FAIL"
        }
    } else {
        $wikiServedStatus = "SERVED_WIKI_KEPT_LAST_GOOD"
        $reasons = @()
        if (-not $serveGateOk) { $reasons += $serveGateReasons }
        if (-not $trackedClean) { $reasons += "Tracked files dirty" }
        if (-not $headUnchanged) { $reasons += "HEAD changed" }
        if ($prepareExit -ne 0) { $reasons += "Staging prepare failed" }
        if ($compileExit -ne 0) { $reasons += "Compile failed" }
        if ($lintExit -ne 0) { $reasons += "Lint Failed" }
        if ($secretExit -ne 0) { $reasons += "Secret Scan Failed" }
        if ($semanticPartial) { $reasons += "Semantic SUSPECT_PARTIAL" }
        if (-not $freshnessOk) { $reasons += "Freshness Failed" }
        $wikiServedStatus += " ($($reasons -join ', '))"
        $step6Status = if ($artifactsOk) { "OK" } else { "FAIL" }
    }
}

Write-Host "--- N7 RECEIPT ---"
$nodeCount = 0
$edgeCount = 0
$gj = Join-Path $RepoRoot "graphify-out\graph.json"
if (Test-Path $gj) {
    try {
        $nodeCount = & $pythonExe -c "import sys, json; d=json.load(open(sys.argv[1])); print(len(d.get('nodes',[])))" $gj
        $edgeCount = & $pythonExe -c "import sys, json; d=json.load(open(sys.argv[1])); print(len(d.get('edges',[])))" $gj
    } catch {}
}

$commitsBehind = 0
$ageDays = 0
$freshnessStr = "freshness_unknown"
if ($fetchOk) {
    try {
        $commitsBehind = [int](git -C $RepoRoot rev-list --count "HEAD..$serveGateRequiredRef")
        $headTime = [int](git -C $RepoRoot log -1 --format=%ct HEAD)
        $mainTime = [int](git -C $RepoRoot log -1 --format=%ct $serveGateRequiredRef)
        if ($mainTime -gt $headTime) {
            $ageDays = [math]::Round(($mainTime - $headTime) / 86400, 1)
        }
        $freshnessStr = "commits behind: $commitsBehind, days old: $ageDays"
        if ($commitsBehind -gt 50 -or $ageDays -gt 7) {
            $freshnessStr += " [FLAGGED]"
        }
    } catch {}
}

$receiptBody = @(
    "Date: $stamp"
    "N0 Tree Lines: $n0PorcelainLines"
    "N0 Orphan Result: OK"
    "N1 Build: $step1Status"
    "N2 Cluster: $step2Status"
    "N5 Semantic: $step5Status"
    "Promotion: $promStatus"
    "N6 Wiki: $step6Status / $wikiServedStatus"
    "Serve Gate: $serveGateSummary"
    "Nodes: $nodeCount"
    "Edges: $edgeCount"
    "Freshness: $freshnessStr"
)
$receiptBody | Set-Content (Join-Path $logDir "receipt-$stamp.md")
Stop-Transcript

# Final predicate includes EVERY red step (codex P1): a receipt that records a failed
# cluster/semantic/wiki step must never pair with exit 0.
if ($n1BuildOk -and
    ($step2Status -ne "FAIL") -and
    ($step5Status -ne "FAIL") -and
    ($step6Status -ne "FAIL") -and
    -not $graphOrphanRisk) {
    exit 0
} else {
    exit 1
}
