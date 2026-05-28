# =============================================================================
# Catalog Extraction Agent -- PowerShell harness
# =============================================================================
#
# Author:   Stream D autonomous session (Opus 4.7), 2026-05-27.
# Plan:     C:\Users\jasen\.claude\plans\lively-stargazing-meadow.md (Stream D sub-track D.2).
# Design:   docs/STREAM_D_AUTONOMOUS_AGENT.md (Sub-task 7 deliverable).
#
# Purpose: launches extract.py with breadcrumb emission and stall watchdog,
# implementing L0 standing rule 1.13 (External CLI subagent monitoring -
# breadcrumb discipline).
#
# Breadcrumb contract:
#   - Emit one JSON file per heartbeat to
#     C:\Projects\SSTAC-Dashboard\.tmp\catalog-overnight-breadcrumbs\<pass-id>-<ts>.json
#   - Shape: {status, last_progress_at, output_artifacts, current_zotero_key, pass_id}
#   - status enum: STARTED | IN_PROGRESS | COMPLETED_GREEN | COMPLETED_RED | STALLED | SILENT_BAIL
#   - Cadence: every 60 seconds while the python subprocess is alive.
#
# Stall watchdog:
#   - If the python subprocess writes no new heartbeat for $StallSeconds (default 600s),
#     terminate the python tree and emit a final STALLED breadcrumb.
#
# Long-running safety:
#   - Per cross_project_harness_background_processes_die_on_exit.md, do NOT spawn
#     this script via Bash run_in_background. Owner schedules it via Task Scheduler
#     using the schtasks recipe documented in README.md.
#
# Usage (interactive smoke test):
#   .\run.ps1 -ZoteroCollection <key> -Model gemma3:12b -DryRun
#
# Usage (Task Scheduler):
#   See README.md "Scheduling" section for the schtasks .ps1 launcher recipe.
#
# =============================================================================

[CmdletBinding()]
param(
    # Zotero collection key or saved-search id (passed through to extract.py).
    [Parameter(Mandatory = $true)]
    [string]$ZoteroCollection,

    # Ollama model name (default per LOCKED Path Y v3).
    [Parameter(Mandatory = $false)]
    [string]$Model = 'gemma3:12b',

    # Skip Supabase writes; useful for smoke tests + first-run validation.
    [Parameter(Mandatory = $false)]
    [switch]$DryRun,

    # psycopg DSN for service-role Supabase connection. Required unless -DryRun.
    [Parameter(Mandatory = $false)]
    [string]$Dsn,

    # Breadcrumb cadence (seconds between heartbeats).
    [Parameter(Mandatory = $false)]
    [int]$HeartbeatSeconds = 60,

    # Stall watchdog timeout (seconds without progress before STALLED + kill).
    [Parameter(Mandatory = $false)]
    [int]$StallSeconds = 600,

    # Path to the .venv python interpreter. Defaults to the convention next to this script.
    [Parameter(Mandatory = $false)]
    [string]$VenvPython = (Join-Path -Path $PSScriptRoot -ChildPath '.venv\Scripts\python.exe')
)

$ErrorActionPreference = 'Stop'

# ----- Resolve paths ---------------------------------------------------------

$ScriptDir = $PSScriptRoot
$RepoRoot = (Resolve-Path -Path (Join-Path $ScriptDir '..\..')).Path
$ExtractPy = Join-Path $ScriptDir 'extract.py'
$BreadcrumbDir = Join-Path $RepoRoot '.tmp\catalog-overnight-breadcrumbs'
$PassId = [Guid]::NewGuid().ToString()
$StartIso = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')

if (-not (Test-Path $BreadcrumbDir)) {
    New-Item -ItemType Directory -Path $BreadcrumbDir -Force | Out-Null
}

# ----- Sanity checks ---------------------------------------------------------

if (-not (Test-Path $ExtractPy)) {
    throw "extract.py not found at $ExtractPy"
}

if (-not $DryRun -and [string]::IsNullOrWhiteSpace($Dsn)) {
    throw '-Dsn is required unless -DryRun is set.'
}

if (-not (Test-Path $VenvPython)) {
    throw @"
Python venv not found at $VenvPython.
Per cross_project_use_venv_python_not_system_python.md, the agent must run
under a project-local venv. From this directory:

  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  pip install -r requirements.txt

Then re-run this harness.
"@
}

# ----- Breadcrumb helpers ----------------------------------------------------

function Write-Breadcrumb {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Status,
        [Parameter(Mandatory = $false)]
        [string]$CurrentZoteroKey = '',
        [Parameter(Mandatory = $false)]
        [string[]]$OutputArtifacts = @(),
        [Parameter(Mandatory = $false)]
        [string]$Note = ''
    )
    $nowIso = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    # Replace ':' in the timestamp BEFORE joining to the breadcrumb directory.
    # Sanitizing the full path would corrupt the 'C:' drive prefix.
    $safeIso = $nowIso -replace ':', '-'
    $crumb = [ordered]@{
        pass_id           = $PassId
        status            = $Status
        last_progress_at  = $nowIso
        started_at        = $StartIso
        current_zotero_key = $CurrentZoteroKey
        output_artifacts  = $OutputArtifacts
        note              = $Note
        host              = $env:COMPUTERNAME
        model             = $Model
        dry_run           = [bool]$DryRun
        source            = 'run.ps1'
    }
    $crumbFile = Join-Path $BreadcrumbDir "$PassId-$safeIso-ps.json"
    $crumb | ConvertTo-Json -Depth 6 | Set-Content -Path $crumbFile -Encoding utf8
    return $crumbFile
}

# ----- Spawn extract.py ------------------------------------------------------

Write-Breadcrumb -Status 'STARTED' -Note "Harness pid=$PID launching extract.py via $VenvPython" | Out-Null

$pyArgs = @(
    $ExtractPy,
    '--zotero-collection', $ZoteroCollection,
    '--model', $Model
)
if ($DryRun) {
    $pyArgs += '--dry-run'
} else {
    $pyArgs += @('--dsn', $Dsn)
}
$pyArgs += @('--pass-id', $PassId)
$pyArgs += @('--breadcrumb-dir', $BreadcrumbDir)

$stdoutLog = Join-Path $BreadcrumbDir "$PassId.stdout.log"
$stderrLog = Join-Path $BreadcrumbDir "$PassId.stderr.log"

$proc = Start-Process -FilePath $VenvPython -ArgumentList $pyArgs `
    -NoNewWindow -PassThru `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog

# ----- Watchdog loop ---------------------------------------------------------

$lastHeartbeatAt = Get-Date
$exitCode = $null
$watchdogFired = $false

try {
    while (-not $proc.HasExited) {
        Start-Sleep -Seconds $HeartbeatSeconds

        # Re-check HasExited after sleeping. If the child exited DURING the
        # sleep window, treat this as a normal exit (not a stall) and let
        # the post-loop COMPLETED_GREEN / COMPLETED_RED path run.
        if ($proc.HasExited) {
            break
        }

        # Look for the most recent PYTHON-emitted breadcrumb (extract.py writes
        # `<pass-id>-<ts>-py.json`). Filtering out the harness's own `*-ps.json`
        # crumbs is essential -- otherwise the harness keeps resetting its own
        # lastHeartbeatAt and the stall watchdog never fires.
        $latestCrumb = Get-ChildItem -Path $BreadcrumbDir -Filter "$PassId-*-py.json" `
            -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1

        if ($null -ne $latestCrumb) {
            $lastHeartbeatAt = $latestCrumb.LastWriteTime
        }

        # Emit our own IN_PROGRESS heartbeat (`-ps.json` suffix; not counted by watchdog).
        $stalledFor = [int]((Get-Date) - $lastHeartbeatAt).TotalSeconds
        Write-Breadcrumb -Status 'IN_PROGRESS' -Note "stalled_for_seconds=$stalledFor" | Out-Null

        if ($stalledFor -ge $StallSeconds) {
            $watchdogFired = $true
            try {
                # Kill process tree using taskkill (handles child processes).
                # Capture exit code so we can attach it to the STALLED breadcrumb;
                # taskkill returns 0 on success and 128 on "process not found".
                & taskkill.exe /PID $proc.Id /T /F 2>&1 | Out-Null
                $taskkillExit = $LASTEXITCODE
            } catch {
                $taskkillExit = -1
            }
            # Bounded wait so a hung taskkill cannot block the watchdog forever.
            $proc.WaitForExit([int]([Math]::Min(30000, $StallSeconds * 1000))) | Out-Null
            Write-Breadcrumb -Status 'STALLED' `
                -OutputArtifacts @($stdoutLog, $stderrLog) `
                -Note "no breadcrumb update for $stalledFor seconds; taskkill exit=$taskkillExit" | Out-Null
            break
        }
    }

    # After the loop: either the python process exited on its own, or the
    # watchdog fired (and STALLED is already written). Only write
    # COMPLETED_GREEN / COMPLETED_RED when the watchdog did NOT fire --
    # otherwise the latest breadcrumb would erroneously be COMPLETED_RED
    # instead of STALLED.
    if (-not $watchdogFired) {
        $proc.WaitForExit()
        $exitCode = $proc.ExitCode

        if ($exitCode -eq 0) {
            Write-Breadcrumb -Status 'COMPLETED_GREEN' `
                -OutputArtifacts @($stdoutLog, $stderrLog) `
                -Note "extract.py exit=0" | Out-Null
        } else {
            Write-Breadcrumb -Status 'COMPLETED_RED' `
                -OutputArtifacts @($stdoutLog, $stderrLog) `
                -Note "extract.py exit=$exitCode" | Out-Null
        }
    } else {
        # Watchdog already wrote STALLED. Surface a non-zero exit code so the
        # caller / scheduler sees the failure. 124 mirrors the conventional
        # "command timeout" exit code from coreutils `timeout`.
        $exitCode = 124
    }
} catch {
    Write-Breadcrumb -Status 'COMPLETED_RED' `
        -OutputArtifacts @($stdoutLog, $stderrLog) `
        -Note "harness error: $($_.Exception.Message)" | Out-Null
    throw
}

if ($null -eq $exitCode) {
    Write-Breadcrumb -Status 'SILENT_BAIL' `
        -OutputArtifacts @($stdoutLog, $stderrLog) `
        -Note "process did not report exit code" | Out-Null
    exit 2
}

exit $exitCode
