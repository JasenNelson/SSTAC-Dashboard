param(
    [string]$Model,
    [switch]$DryRun,
    [switch]$SkipLock,
    [string]$GraphifyExe,
    [int]$TimeoutSec = 3000,
    [int]$LockExpiryMinutes = 120,
    [string]$EvidencePath,
    [string]$EvidenceRunId
)

$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location -Path $repoRoot

$hasEvidencePath = -not [string]::IsNullOrWhiteSpace($EvidencePath)
$hasEvidenceRunId = -not [string]::IsNullOrWhiteSpace($EvidenceRunId)
if ($hasEvidencePath -ne $hasEvidenceRunId) {
    [Console]::Error.WriteLine('EvidencePath and EvidenceRunId must be provided together')
    exit 1
}
if ($hasEvidencePath) {
    if (-not $SkipLock) {
        [Console]::Error.WriteLine('nightly evidence requires SkipLock')
        exit 1
    }
    $parsedEvidenceRunId = [guid]::Empty
    if (-not [guid]::TryParse($EvidenceRunId, [ref]$parsedEvidenceRunId) -or
        $parsedEvidenceRunId.ToString('D').ToLowerInvariant() -cne $EvidenceRunId) {
        [Console]::Error.WriteLine('EvidenceRunId must be a canonical lowercase GUID')
        exit 1
    }
    if ($DryRun) {
        [Console]::Error.WriteLine('nightly evidence is not available in DryRun mode')
        exit 1
    }
    if (Test-Path -LiteralPath $EvidencePath) {
        [Console]::Error.WriteLine('EvidencePath already exists')
        exit 1
    }
}

$configPath = "$PSScriptRoot\wiki_nightly_config.json"
if (-not $Model) {
    if (Test-Path $configPath) {
        try {
            $config = Get-Content -Path $configPath -Raw | ConvertFrom-Json
            if ($config.model) {
                $Model = $config.model
            } else {
                $Model = 'qwen3:14b'
            }
        } catch {
            $Model = 'qwen3:14b'
        }
    } else {
        $Model = 'qwen3:14b'
    }
}

if (-not $GraphifyExe) { $GraphifyExe = "$repoRoot\.venv-graphify\Scripts\graphify.exe" }
. "$PSScriptRoot\graphify_guardrail.ps1"
. "$PSScriptRoot\ollama_lock.ps1"

$stamp = (Get-Date -Format 'yyyy-MM-dd')
$logDir = "$repoRoot\.tmp_wiki_nightly"
if (-not (Test-Path $logDir)) {
    $null = New-Item -ItemType Directory -Force -Path $logDir
}

$transcriptPath = "$logDir\sstac-semantic-transcript-$stamp.log"
$receiptPath = "$logDir\sstac-semantic-receipt-$stamp.md"

function Write-Log {
    param([string]$Text)
    Write-Host $Text
    $maxAttempts = 3
    for ($i = 1; $i -le $maxAttempts; $i++) {
        try {
            Add-Content -Path $transcriptPath -Value $Text -ErrorAction Stop
            break
        } catch {
            if ($i -eq $maxAttempts) { throw }
            Start-Sleep -Milliseconds 200
        }
    }
}

function Write-SemanticEvidenceFile {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)]$Evidence
    )
    $json = $Evidence | ConvertTo-Json -Depth 5
    $encoding = New-Object System.Text.UTF8Encoding($false)
    $stream = [System.IO.File]::Open(
        $Path,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::None
    )
    try {
        $writer = New-Object System.IO.StreamWriter($stream, $encoding)
        try { $writer.Write($json) }
        finally { $writer.Dispose() }
    } finally {
        $stream.Dispose()
    }
}

function Invoke-SemanticObservedRelease {
    param(
        [Parameter(Mandatory=$true)]$Handle,
        [Parameter(Mandatory=$true)][string]$RequestedMode,
        [bool]$GpuOrphanRisk
    )
    $releaseArgs = @{ Handle = $Handle }
    if ($GpuOrphanRisk) { $releaseArgs.GpuOrphanRisk = $true }
    else { $releaseArgs.Status = $RequestedMode }
    try {
        $observed = Invoke-OllamaLockRelease @releaseArgs
        if ($null -eq $observed) {
            return (New-OllamaReleaseResult -RequestedMode $RequestedMode `
                -Error 'release helper returned no evidence')
        }
        return $observed
    } catch {
        return (New-OllamaReleaseResult -RequestedMode $RequestedMode `
            -Error "release helper threw: $($_.Exception.Message)")
    }
}

function Get-SemanticSelectedReleaseMode {
    param(
        [bool]$TimedOut,
        [bool]$GpuOrphanRisk,
        [Parameter(Mandatory=$true)][string]$GraphifyStatus
    )
    if ($TimedOut -or $GpuOrphanRisk) { return 'MANUAL_HOLD' }
    if ($GraphifyStatus -ceq 'OK') { return 'COMPLETED_GREEN' }
    return 'COMPLETED_RED'
}

function Get-SemanticTerminalExitCode {
    param(
        [bool]$TimedOut,
        [bool]$GpuOrphanRisk,
        [bool]$EvidenceWriteFailed,
        [bool]$ReleaseFailed,
        [Parameter(Mandatory=$true)][string]$GraphifyStatus
    )
    if ($TimedOut -or $GpuOrphanRisk) { return 124 }
    if ($EvidenceWriteFailed -or $ReleaseFailed) { return 1 }
    if ($GraphifyStatus -ceq 'OK') { return 0 }
    return 1
}

Write-Log "--- START SEMANTIC EXTRACT ($stamp) ---"

if (-not $env:OLLAMA_API_KEY) {
    $env:OLLAMA_API_KEY = "mock_key_for_graphify"
}
$env:OLLAMA_MODEL = $Model

$commit = "unknown"
try {
    $commit = (git rev-parse --short HEAD)
} catch {}

if ($DryRun) {
    Write-Host "DRY RUN MODE"
    Write-Host "Graphify cmd: & `"$GraphifyExe`" extract `"$repoRoot`" --backend ollama --model $Model"
    Write-Host "Note: standalone users invoke tooling\wiki\promotion.py explicitly."
    exit 0
}

$lockAcquired = $false
$startIso = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssK")

if (-not $SkipLock) {
    Write-Log "Acquiring lock..."
    $lockRes = Invoke-OllamaLockAcquire -BlockId 'SSTAC-SEMANTIC' -Purpose 'standalone semantic extract' -ExpiryMinutes $LockExpiryMinutes -Model $Model
    if ($null -eq $lockRes) {
        Write-Log "Lock unavailable (preflight failed, lane unauthorized, or race lost). Exiting."
        exit 3
    }
    $lockAcquired = $true
    Write-Log "Lock acquired."
} else {
    Write-Log "SkipLock mode: Caller holds lock. Skipping acquire/release."
}

$graphifyStatus = "FAIL"
$promotionStatus = "SKIP"
$graphifyExitCode = -1
$gpuOrphanRisk = $false
$timedOut = $false
$guardrailFailed = $false
$tempCleanupStatus = "NOT_RUN"
$tempCleanupError = ""
$evidenceWriteFailed = $false
$releaseRequired = $false
$releaseFailed = $false
$selectedReleaseMode = 'NOT_REQUIRED'
$releaseEvidence = $null

$parsedNodes = "unknown"
$parsedLinks = "unknown"

try {
    # DOCS-SCOPE + OVERLAY REGENERATION (codex P1, 2026-07-22): the docs-trust overlay
    # (docs\.graphifyignore) is intentionally untracked -- a fresh checkout has none, and
    # without it the root *.md blanket silently excludes EVERY doc from this run. Regenerate
    # both artifacts before extraction; a scope failure (exit 2) aborts the run fail-closed.
    Write-Log "Regenerating docs scope + trust overlay..."
    & python (Join-Path $repoRoot "tooling\wiki\gen_docs_scope.py") --repo-root $repoRoot --out (Join-Path $repoRoot "graphify-out\docs_scope.json") --emit-overlay
    if ($LASTEXITCODE -ne 0) {
        Write-Log "FAIL: gen_docs_scope exited $LASTEXITCODE -- aborting before extraction."
        throw "docs-scope generation failed (exit $LASTEXITCODE)"
    }

    Write-Log "Running graphify extract (guarded: ${TimeoutSec}s hard timeout + exact-root termination; descendant tree unproven)..."
    $gr = Invoke-GraphifyGuardedCapture -GraphifyExe $GraphifyExe -GraphifyArgs @('extract', $repoRoot, '--backend', 'ollama', '--model', $Model) -TimeoutSec $TimeoutSec
    $graphifyExitCode = $gr.ExitCode
    $timedOut = $gr.TimedOut
    $guardrailFailed = $gr.GuardrailFailed
    if ($gr.OrphanRisk) { $gpuOrphanRisk = $true }
    $tempCleanupStatus = [string]$gr.TempCleanupStatus
    $tempCleanupError = if ($null -eq $gr.TempCleanupError) { "" } else { [string]$gr.TempCleanupError }
    Write-Log "Graphify temp cleanup evidence: status=$tempCleanupStatus; error=$tempCleanupError"

    if (-not $guardrailFailed) {
        foreach ($line in $gr.OutputLines) {
            $str = "$line"
            Write-Log $str
            if ($str -match "nodes?:\s*(\d+)") { $parsedNodes = $matches[1] }
            if ($str -match "links?:\s*(\d+)") { $parsedLinks = $matches[1] }
        }
    }

    if ($gr.TimedOut) {
        Write-Log "FAIL: graphify extract TIMED OUT after ${TimeoutSec}s (exit 124); guardrail failed=$($gr.GuardrailFailed); orphan risk=$($gr.OrphanRisk); root terminated=$($gr.RootTerminated); cleanup=$($gr.CleanupStatus); error=$($gr.CleanupError); guardrail error=$($gr.GuardrailError); output error=$($gr.OutputReadError); temp cleanup=$($gr.TempCleanupStatus); temp error=$($gr.TempCleanupError)."
        Write-Log "WARNING: descendant cleanup is unproven after root-only termination (GPU-orphan risk)."
    } elseif ($gr.GuardrailFailed) {
        Write-Log "FAIL: graphify guardrail failed before a trustworthy result (exit $graphifyExitCode); orphan risk=$($gr.OrphanRisk); guardrail error=$($gr.GuardrailError)."
    } elseif ($graphifyExitCode -ne 0) {
        Write-Log "FAIL: graphify extract failed with exit code $graphifyExitCode."
    } else {
        $graphifyStatus = "OK"
        # The SSTAC single-invocation rule runs promotion ONLY from the nightly's coverage-guarded step;
        # standalone users invoke tooling\wiki\promotion.py explicitly.
        Write-Log "Promotion step skipped. Run tooling\wiki\promotion.py manually if needed."
    }
} catch {
    Write-Log "Exception occurred: $_"
} finally {
    if ($lockAcquired) {
        $releaseRequired = $true
        $selectedReleaseMode = Get-SemanticSelectedReleaseMode `
            -TimedOut $timedOut -GpuOrphanRisk $gpuOrphanRisk -GraphifyStatus $graphifyStatus
        $releaseEvidence = Invoke-SemanticObservedRelease -Handle $lockRes `
            -RequestedMode $selectedReleaseMode -GpuOrphanRisk $gpuOrphanRisk
        $releaseFailed = -not (Test-OllamaReleaseResult -Result $releaseEvidence `
            -ExpectedRequestedMode $selectedReleaseMode)
        Write-Log "Observed lock disposition: requested=$selectedReleaseMode; outcome=$($releaseEvidence.outcome); evidence_valid=$($releaseEvidence.evidence_valid); error=$($releaseEvidence.error)"
    }
}

$endIso = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssK")

if ($hasEvidencePath) {
    $semanticEvidence = [pscustomobject][ordered]@{
        schema_version = '1.0'
        run_id = $EvidenceRunId
        graphify_exit_code = [int]$graphifyExitCode
        graphify_status = [string]$graphifyStatus
        timed_out = [bool]$timedOut
        guardrail_failed = [bool]$guardrailFailed
        orphan_risk = [bool]$gpuOrphanRisk
        temp_cleanup_status = [string]$tempCleanupStatus
        temp_cleanup_error = [string]$tempCleanupError
    }
    try {
        Write-SemanticEvidenceFile -Path $EvidencePath -Evidence $semanticEvidence
        Write-Log "Semantic evidence written: $EvidencePath"
    } catch {
        $evidenceWriteFailed = $true
        $graphifyStatus = "FAIL"
        Write-Log "FAIL: semantic evidence write failed: $($_.Exception.Message)"
    }
}

$receiptLines = @(
    "# Semantic Extraction Receipt"
    "Model: $Model"
    "Start: $startIso"
    "End: $endIso"
    "Graphify Exit Code: $graphifyExitCode"
    "Nodes Extracted: $parsedNodes"
    "Links Extracted: $parsedLinks"
    "Graphify Step: $graphifyStatus"
    "Temp Cleanup Status: $tempCleanupStatus"
    "Temp Cleanup Error: $tempCleanupError"
    "Release Required: $releaseRequired"
    "Release Requested Mode: $selectedReleaseMode"
    "Release Observed Outcome: $(if ($null -eq $releaseEvidence) { 'NOT_REQUIRED' } else { $releaseEvidence.outcome })"
    "Release Evidence Valid: $(if ($null -eq $releaseEvidence) { 'NOT_REQUIRED' } else { $releaseEvidence.evidence_valid })"
    "Release Error: $(if ($null -eq $releaseEvidence) { '' } else { $releaseEvidence.error })"
    "Promotion Step: $promotionStatus"
)

$receiptLines | Set-Content -Path $receiptPath

Write-Log "--- END SEMANTIC EXTRACT ---"

# Exit contract (codex P2, 2026-07-22): 124 = a hard timeout or explicit GPU-orphan/custody risk.
# Root-only termination never proves descendant cleanup. 3 = lock unavailable (emitted earlier),
# 0 = success, 1 = failure without an orphan/custody-risk claim.
$semanticTerminalExit = Get-SemanticTerminalExitCode -TimedOut $timedOut `
    -GpuOrphanRisk $gpuOrphanRisk -EvidenceWriteFailed $evidenceWriteFailed `
    -ReleaseFailed $releaseFailed -GraphifyStatus $graphifyStatus
exit $semanticTerminalExit
