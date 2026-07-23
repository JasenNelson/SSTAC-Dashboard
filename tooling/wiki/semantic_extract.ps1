param(
    [string]$Model,
    [switch]$DryRun,
    [switch]$SkipLock,
    [string]$GraphifyExe,
    [int]$TimeoutSec = 3000,
    [int]$LockExpiryMinutes = 120
)

$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location -Path $repoRoot

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

    Write-Log "Running graphify extract (guarded: ${TimeoutSec}s hard timeout + tree-kill)..."
    $gr = Invoke-GraphifyGuardedCapture -GraphifyExe $GraphifyExe -GraphifyArgs @('extract', $repoRoot, '--backend', 'ollama', '--model', $Model) -TimeoutSec $TimeoutSec
    $graphifyExitCode = $gr.ExitCode

    foreach ($line in $gr.OutputLines) {
        $str = "$line"
        Write-Log $str
        if ($str -match "nodes?:\s*(\d+)") { $parsedNodes = $matches[1] }
        if ($str -match "links?:\s*(\d+)") { $parsedLinks = $matches[1] }
    }

    if ($gr.TimedOut) {
        $timedOut = $true
        Write-Log "FAIL: graphify extract TIMED OUT after ${TimeoutSec}s (exit 124); killed=$($gr.Killed)."
        if (-not $gr.Killed) {
            $gpuOrphanRisk = $true
            Write-Log "WARNING: a graphify/GPU child survived the tree-kill (GPU-orphan risk)."
        }
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
        if ($gpuOrphanRisk) {
            Invoke-OllamaLockRelease -Handle $lockRes -GpuOrphanRisk
            Write-Log "Lock rewritten to MANUAL_HOLD (GPU orphan risk); HITL marker dropped."
        } else {
            $relStatus = if ($graphifyStatus -eq 'OK') { 'COMPLETED_GREEN' } else { 'COMPLETED_RED' }
            Invoke-OllamaLockRelease -Handle $lockRes -Status $relStatus
            Write-Log "Lock released ($relStatus)."
        }
    }
}

$endIso = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssK")

$receiptLines = @(
    "# Semantic Extraction Receipt"
    "Model: $Model"
    "Start: $startIso"
    "End: $endIso"
    "Graphify Exit Code: $graphifyExitCode"
    "Nodes Extracted: $parsedNodes"
    "Links Extracted: $parsedLinks"
    "Graphify Step: $graphifyStatus"
    "Promotion Step: $promotionStatus"
)

$receiptLines | Set-Content -Path $receiptPath

Write-Log "--- END SEMANTIC EXTRACT ---"

# Exit contract (codex P2, 2026-07-22): 124 = ANY hard timeout (killed-clean OR orphan risk --
# callers distinguish via the receipt/orphan marker), 3 = lock unavailable (emitted earlier),
# 0 = success, 1 = non-timeout failure.
if ($timedOut -or $gpuOrphanRisk) {
    exit 124
} elseif ($graphifyStatus -eq "OK") {
    exit 0
} else {
    exit 1
}
