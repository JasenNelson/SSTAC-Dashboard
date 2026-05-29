# =============================================================================
# launch_catalog_extraction.ps1 -- Stream D overnight wrapper
# =============================================================================
#
# Purpose: schtasks-invoked wrapper that orchestrates an overnight Stream D
# catalog-extraction pass. Spawns a `claude -p` headless session as the
# autonomous worker. The wrapper itself handles:
#
#   1. Pre-flight sentinel checks (STOP / PAUSE / PRIORITY_BOOST) under .tmp/.
#   2. Archive-before-edit on CATALOG_EXTRACTION_HANDOFF.md (per L0 1.2;
#      slash commands like /handoff-update don't fire in `claude -p` mode
#      per src/lib/agentic-os/launch-validator.ts empirical verification).
#   3. Post-archive sentinel re-check (closes the archive-window race).
#   4. Starter prompt substitution ($PassId / $YYYYMMDDTHHMMSSZ / $N markers).
#   5. STARTED breadcrumb emission to .tmp/catalog-overnight-breadcrumbs/.
#   6. Spawn claude -p subprocess with the inlined starter prompt.
#   7. Stall watchdog loop (pass-scoped *-py.json filter; 600s default
#      threshold; taskkill /T /F + STALLED breadcrumb on stall).
#   8. Final breadcrumb based on exit code (0 = COMPLETED_GREEN,
#      124 = STALLED, else = COMPLETED_RED, no exit code = SILENT_BAIL).
#
# Design reference: STREAM_D_REDESIGN_2026_05_28.md v0.3.1
#   (cursor-agent claude-opus-4-7-thinking-xhigh and gpt-5.3-codex-xhigh
#    GREEN at round 5 with mutual agreement methodology).
# Watchdog parity reference: scripts/catalog-overnight/run.ps1:170-216
#   (port preserves 600s threshold, pass-scoped filter, exit code 124,
#    bounded WaitForExit, post-sleep HasExited re-check).
#
# Author: Stream D autonomous session (Opus 4.7), 2026-05-28.
#
# Usage (smoke test):
#   .\launch_catalog_extraction.ps1 -DryRun -MaxItems 1
#
# Usage (scheduled task):
#   .\register_catalog_extraction_task.ps1   # one-shot registration
#   then daily at 23:30 PT the task fires this script with no args.
#
# =============================================================================

[CmdletBinding()]
param(
    # Skip writing the proposals file (wrapper smoke test); the session still runs Docling.
    [Parameter(Mandatory = $false)]
    [switch]$DryRun,

    # Maximum items the session should process this pass. Default 3 for smoke
    # phase per design lock #2.
    [Parameter(Mandatory = $false)]
    [int]$MaxItems = 3,

    # Stall watchdog threshold in seconds. Parity with run.ps1:61 default 600s.
    [Parameter(Mandatory = $false)]
    [int]$StallSeconds = 600,

    # Watchdog polling cadence in seconds. Parity with run.ps1.
    [Parameter(Mandatory = $false)]
    [int]$HeartbeatSeconds = 60,

    # Bounded wait after taskkill (ms). Defends against hung taskkill.
    [Parameter(Mandatory = $false)]
    [int]$KillWaitMs = 30000,

    # Path to `claude` CLI. Defaults to the standard install location.
    [Parameter(Mandatory = $false)]
    [string]$ClaudeExe = "$env:USERPROFILE\.local\bin\claude.exe"
)

$ErrorActionPreference = 'Stop'

# ----- Resolve paths ---------------------------------------------------------

$ScriptDir = $PSScriptRoot
$RepoRoot = (Resolve-Path -Path (Join-Path $ScriptDir '..\..')).Path
$TmpDir = Join-Path $RepoRoot '.tmp'
$BreadcrumbDir = Join-Path $TmpDir 'catalog-overnight-breadcrumbs'
$SentinelStop = Join-Path $TmpDir 'CATALOG_EXTRACTION_STOP'
$SentinelPause = Join-Path $TmpDir 'CATALOG_EXTRACTION_PAUSE'
$SentinelBoost = Join-Path $TmpDir 'CATALOG_EXTRACTION_PRIORITY_BOOST'
$HandoffFile = Join-Path $RepoRoot 'CATALOG_EXTRACTION_HANDOFF.md'
$StarterPromptFile = Join-Path $RepoRoot 'scripts\catalog-overnight\CATALOG_EXTRACTION_STARTER_PROMPT.md'
$ManifestFile = Join-Path $RepoRoot 'scripts\catalog-overnight\catalog_manifest.csv'
$ProgressFile = Join-Path $RepoRoot 'scripts\catalog-overnight\catalog_extraction_progress.json'

# Pass id + Windows-safe basic ISO timestamp (no colons; colons invalid in
# Windows filenames per round 4 P2 fix).
$PassId = [Guid]::NewGuid().ToString()
$StartIsoSafe = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')

# ----- Ensure dirs ----------------------------------------------------------

if (-not (Test-Path $BreadcrumbDir)) {
    New-Item -ItemType Directory -Path $BreadcrumbDir -Force | Out-Null
}
if (-not (Test-Path $TmpDir)) {
    New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null
}

# ----- Breadcrumb helper ----------------------------------------------------

function Write-PsBreadcrumb {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Status,
        [Parameter(Mandatory = $false)]
        [string]$Note = '',
        [Parameter(Mandatory = $false)]
        [string[]]$OutputArtifacts = @()
    )
    $nowSafe = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
    $crumb = [ordered]@{
        pass_id          = $PassId
        status           = $Status
        last_progress_at = (Get-Date).ToUniversalTime().ToString('o')
        started_at       = (Get-Date).ToUniversalTime().ToString('o')
        note             = $Note
        output_artifacts = $OutputArtifacts
        host             = $env:COMPUTERNAME
        source           = 'launch_catalog_extraction.ps1'
        dry_run          = [bool]$DryRun
    }
    $crumbFile = Join-Path $BreadcrumbDir "$PassId-$nowSafe-ps.json"
    $crumb | ConvertTo-Json -Depth 6 | Set-Content -Path $crumbFile -Encoding utf8
    return $crumbFile
}

# ----- Pre-flight (round 1) -------------------------------------------------

if (Test-Path $SentinelStop) {
    Write-PsBreadcrumb -Status 'COMPLETED_GREEN' -Note "STOP sentinel present at pre-flight; exiting without launch" | Out-Null
    exit 0
}
if (Test-Path $SentinelPause) {
    Write-PsBreadcrumb -Status 'COMPLETED_GREEN' -Note "PAUSE sentinel present at pre-flight; exiting without launch" | Out-Null
    exit 0
}

$priorityBoost = Test-Path $SentinelBoost

# Sanity check required artifacts
if (-not (Test-Path $HandoffFile)) {
    Write-PsBreadcrumb -Status 'COMPLETED_RED' -Note "CATALOG_EXTRACTION_HANDOFF.md missing at $HandoffFile" | Out-Null
    exit 1
}
if (-not (Test-Path $StarterPromptFile)) {
    Write-PsBreadcrumb -Status 'COMPLETED_RED' -Note "Starter prompt missing at $StarterPromptFile" | Out-Null
    exit 1
}
if (-not (Test-Path $ClaudeExe)) {
    Write-PsBreadcrumb -Status 'COMPLETED_RED' -Note "claude CLI not found at $ClaudeExe" | Out-Null
    exit 1
}

# ----- Archive-before-edit on handoff doc -----------------------------------

# Extract version from handoff doc header (line like "**Version:** 1.0")
$handoffContent = Get-Content -Raw -LiteralPath $HandoffFile
$versionMatch = [regex]::Match($handoffContent, '(?m)^\*\*Version:\*\*\s+(?<v>[0-9]+\.[0-9]+)')
$currentVersion = if ($versionMatch.Success) { $versionMatch.Groups['v'].Value } else { '1.0' }

$archiveDir = Join-Path $RepoRoot ('docs\archive\' + (Get-Date).ToString('yyyy-MM'))
if (-not (Test-Path $archiveDir)) {
    New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
}
$archivePath = Join-Path $archiveDir "CATALOG_EXTRACTION_HANDOFF_v${currentVersion}_ARCHIVED_${StartIsoSafe}.md"
Copy-Item -LiteralPath $HandoffFile -Destination $archivePath -Force

# ----- Pre-flight (round 2 -- post-archive race close) ---------------------

# The archive cp takes non-zero time. If owner dropped a STOP / PAUSE
# sentinel between pre-flight round 1 and now, honor it before spawning.
if (Test-Path $SentinelStop) {
    Write-PsBreadcrumb -Status 'COMPLETED_GREEN' -Note "STOP sentinel appeared during archive; exiting without spawn (archive at $archivePath retained)" | Out-Null
    exit 0
}
if (Test-Path $SentinelPause) {
    Write-PsBreadcrumb -Status 'COMPLETED_GREEN' -Note "PAUSE sentinel appeared during archive; exiting without spawn (archive at $archivePath retained)" | Out-Null
    exit 0
}

# ----- Build starter prompt with marker substitution ------------------------

$promptTemplate = Get-Content -Raw -LiteralPath $StarterPromptFile
$boostNote = if ($priorityBoost) { 'PRIORITY_BOOST sentinel detected; owner has flagged this pass as priority.' } else { '' }

$prompt = $promptTemplate `
    -replace '\$PassId', $PassId `
    -replace '\$YYYYMMDDTHHMMSSZ', $StartIsoSafe `
    -replace '\$N\b', $MaxItems.ToString() `
    -replace '\$PRIORITY_BOOST_NOTE', $boostNote

# ----- STARTED breadcrumb ---------------------------------------------------

Write-PsBreadcrumb -Status 'STARTED' -Note "Spawning claude -p; PassId=$PassId; MaxItems=$MaxItems; DryRun=$DryRun; PriorityBoost=$priorityBoost" | Out-Null

# ----- Spawn claude -p ------------------------------------------------------

$stdoutLog = Join-Path $BreadcrumbDir "$PassId.stdout.log"
$stderrLog = Join-Path $BreadcrumbDir "$PassId.stderr.log"

# Pass the prompt via STDIN, not as a positional `-p` argument. The prompt
# template contains many unescaped double quotes (JSON breadcrumb examples,
# embedded code snippets); passing it through Start-Process -ArgumentList
# would force PowerShell + Windows CreateProcess argv quoting on each of
# those, with brittle escaping at the cmdline serialization boundary.
# stdin sidesteps the entire argv-quoting layer.
#
# `claude -p` (alias for --print, non-interactive mode) reads the prompt
# from stdin when no positional prompt arg is given. Default --input-format
# is "text" (per `claude -p --help`), which consumes the full stdin stream
# as the prompt content.
$tempPromptFile = Join-Path $BreadcrumbDir "$PassId-prompt.txt"
Set-Content -Path $tempPromptFile -Value $prompt -Encoding utf8

$claudeArgs = @(
    '-p',
    '--output-format', 'text'
)

$proc = Start-Process -FilePath $ClaudeExe -ArgumentList $claudeArgs `
    -NoNewWindow -PassThru `
    -RedirectStandardInput $tempPromptFile `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog

# ----- Watchdog loop (port from run.ps1:170-216 with pass-scope) ------------

$lastHeartbeatAt = Get-Date
$exitCode = $null
$watchdogFired = $false

try {
    while (-not $proc.HasExited) {
        Start-Sleep -Seconds $HeartbeatSeconds

        # Re-check HasExited after sleep (handles fast exits during sleep window)
        if ($proc.HasExited) {
            break
        }

        # Pass-scoped breadcrumb filter (PARITY with run.ps1:188-190).
        # The session emits "$PassId-<iso>-py.json" files; the wrapper's own
        # "*-ps.json" files are excluded from the filter so the wrapper does
        # not keep resetting lastHeartbeatAt on its own emissions.
        $latestCrumb = Get-ChildItem -Path $BreadcrumbDir `
            -Filter "$PassId-*-py.json" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1

        if ($null -ne $latestCrumb) {
            $lastHeartbeatAt = $latestCrumb.LastWriteTime
        }

        $stalledFor = [int]((Get-Date) - $lastHeartbeatAt).TotalSeconds
        Write-PsBreadcrumb -Status 'IN_PROGRESS' -Note "stalled_for_seconds=$stalledFor; threshold=$StallSeconds" | Out-Null

        if ($stalledFor -ge $StallSeconds) {
            $watchdogFired = $true
            $taskkillExit = -1
            try {
                & taskkill.exe /PID $proc.Id /T /F 2>&1 | Out-Null
                $taskkillExit = $LASTEXITCODE
            } catch {
                # best-effort; watchdog continues
            }
            # Bounded WaitForExit so a hung taskkill does not block the watchdog
            $proc.WaitForExit([int]([Math]::Min($KillWaitMs, $StallSeconds * 1000))) | Out-Null
            Write-PsBreadcrumb -Status 'STALLED' `
                -OutputArtifacts @($stdoutLog, $stderrLog) `
                -Note "no claude py-breadcrumb update for $stalledFor seconds; taskkill exit=$taskkillExit" | Out-Null
            break
        }
    }

    if (-not $watchdogFired) {
        $proc.WaitForExit()
        $exitCode = $proc.ExitCode

        if ($exitCode -eq 0) {
            Write-PsBreadcrumb -Status 'COMPLETED_GREEN' `
                -OutputArtifacts @($stdoutLog, $stderrLog) `
                -Note "claude session exit=0" | Out-Null
        } else {
            Write-PsBreadcrumb -Status 'COMPLETED_RED' `
                -OutputArtifacts @($stdoutLog, $stderrLog) `
                -Note "claude session exit=$exitCode" | Out-Null
        }
    } else {
        # Watchdog already wrote STALLED. Set exit code to 124 (POSIX timeout convention)
        $exitCode = 124
    }
} catch {
    Write-PsBreadcrumb -Status 'COMPLETED_RED' `
        -OutputArtifacts @($stdoutLog, $stderrLog) `
        -Note ("wrapper error: " + $_.Exception.Message) | Out-Null
    throw
} finally {
    # Clean up the temp prompt file (contains the inlined prompt; no secrets, but tidy)
    if (Test-Path $tempPromptFile) {
        Remove-Item -LiteralPath $tempPromptFile -Force -ErrorAction SilentlyContinue
    }
}

if ($null -eq $exitCode) {
    Write-PsBreadcrumb -Status 'SILENT_BAIL' `
        -OutputArtifacts @($stdoutLog, $stderrLog) `
        -Note "claude session did not report an exit code" | Out-Null
    exit 2
}

exit $exitCode
