param(
  [int]$TimeoutSeconds = 900,
  [int]$PollSeconds = 10,
  [string]$LogDir = "",
  [string]$Label = "sstac-build",
  [string]$CommandText = "npm run build",
  [switch]$CleanNext,
  [switch]$KillBuildEraProcesses,
  [int]$RetentionCount = 3
)

$ErrorActionPreference = "Stop"

function Write-Log {
  param([string]$Path, [string]$Message)
  Add-Content -LiteralPath $Path -Value $Message
}

function Get-CandidateProcesses {
  Get-Process node,cmd,npm,npx,next,ping,timeout -ErrorAction SilentlyContinue |
    Select-Object Id, ProcessName, CPU, StartTime, Path
}

function Get-DescendantProcessIds {
  param([int]$RootPid)

  try {
    $all = @(Get-CimInstance Win32_Process -ErrorAction Stop |
      Select-Object ProcessId, ParentProcessId)
  } catch {
    return @()
  }

  $frontier = @($RootPid)
  $found = New-Object System.Collections.Generic.List[int]
  while ($frontier.Count -gt 0) {
    $next = @(
      $all | Where-Object {
        $frontier -contains $_.ParentProcessId -and
        -not $found.Contains([int]$_.ProcessId)
      } | Select-Object -ExpandProperty ProcessId
    )
    if ($next.Count -eq 0) {
      break
    }
    foreach ($processId in $next) {
      [void]$found.Add([int]$processId)
    }
    $frontier = $next
  }

  return @($found)
}

function Write-Tail {
  param([string]$Path)
  if (Test-Path -LiteralPath $Path) {
    Get-Content -LiteralPath $Path -Tail 80
  }
}

function Test-PathWithinDirectory {
  param([string]$ChildPath, [string]$ParentPath)

  $resolvedChild = [System.IO.Path]::GetFullPath($ChildPath)
  $resolvedParent = [System.IO.Path]::GetFullPath($ParentPath)
  if (-not $resolvedParent.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
    $resolvedParent += [System.IO.Path]::DirectorySeparatorChar
  }

  return $resolvedChild.StartsWith(
    $resolvedParent,
    [System.StringComparison]::OrdinalIgnoreCase
  )
}

function Remove-OldArtifacts {
  param(
    [string]$RootPath,
    [string]$Filter,
    [int]$KeepCount
  )

  if ($KeepCount -lt 1 -or -not (Test-Path -LiteralPath $RootPath)) {
    return
  }

  Get-ChildItem -LiteralPath $RootPath -Filter $Filter -Force |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $KeepCount |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
if ([string]::IsNullOrWhiteSpace($LogDir)) {
  $LogDir = Join-Path $repoRoot.Path ".tmp\build-monitor"
} elseif (-not [System.IO.Path]::IsPathRooted($LogDir)) {
  $LogDir = Join-Path $repoRoot.Path $LogDir
}
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Remove-OldArtifacts -RootPath $LogDir -Filter "*.log" -KeepCount ($RetentionCount * 3)
Remove-OldArtifacts -RootPath $LogDir -Filter "*.cmd" -KeepCount $RetentionCount

$safeLabel = $Label -replace '[^a-zA-Z0-9_.-]', '-'
$stamp = Get-Date -Format "yyyyMMdd-HHmmss-ffff"
$baseName = "$safeLabel-$stamp-$PID"
$stdoutLog = Join-Path $LogDir "$baseName.out.log"
$stderrLog = Join-Path $LogDir "$baseName.err.log"
$monitorLog = Join-Path $LogDir "$baseName.monitor.log"
$runnerCmd = Join-Path $LogDir "$baseName.runner.cmd"
$quarantinedNext = ""

@(
  "start=$(Get-Date -Format o)",
  "cwd=$($repoRoot.Path)",
  "timeout_seconds=$TimeoutSeconds",
  "poll_seconds=$PollSeconds",
  "command=$CommandText",
  "clean_next=$CleanNext",
  "kill_build_era_processes=$KillBuildEraProcesses",
  "retention_count=$RetentionCount",
  "stdout=$stdoutLog",
  "stderr=$stderrLog",
  "runner=$runnerCmd"
) | Set-Content -LiteralPath $monitorLog

if ($CleanNext) {
  $nextDir = Join-Path $repoRoot.Path ".next"
  if (Test-Path -LiteralPath $nextDir) {
    $resolvedNext = Resolve-Path $nextDir
    if (-not (Test-PathWithinDirectory -ChildPath $resolvedNext.Path -ParentPath $repoRoot.Path)) {
      throw "Refusing to move .next because the resolved path escaped the repo root: $($resolvedNext.Path)"
    }
    $quarantineRoot = Join-Path $repoRoot.Path ".tmp"
    New-Item -ItemType Directory -Force -Path $quarantineRoot | Out-Null
    Remove-OldArtifacts -RootPath $quarantineRoot -Filter "next-quarantine-*" -KeepCount $RetentionCount
    $quarantinedNext = Join-Path $quarantineRoot "next-quarantine-$baseName"
    Write-Log $monitorLog "quarantining_next=$quarantinedNext"
    $moved = $false
    for ($attempt = 1; $attempt -le 3 -and -not $moved; $attempt++) {
      try {
        Move-Item -LiteralPath $resolvedNext.Path -Destination $quarantinedNext -ErrorAction Stop
        $moved = $true
      } catch {
        Write-Log $monitorLog "quarantine_attempt_$attempt=$($_.Exception.Message)"
        if ($attempt -eq 3) {
          throw "Unable to quarantine .next after $attempt attempts: $($_.Exception.Message)"
        }
        Start-Sleep -Milliseconds (250 * $attempt)
      }
    }
  }
}

$baselineIds = @(Get-CandidateProcesses | Select-Object -ExpandProperty Id)

@(
  "@echo off",
  "cd /d ""$($repoRoot.Path)""",
  "$CommandText > ""$stdoutLog"" 2> ""$stderrLog"""
) | Set-Content -LiteralPath $runnerCmd -Encoding ASCII

@(
  "quarantined_next=$quarantinedNext"
) | Add-Content -LiteralPath $monitorLog

$process = Start-Process `
  -FilePath "cmd.exe" `
  -ArgumentList @("/d", "/c", """$runnerCmd""") `
  -WorkingDirectory $repoRoot.Path `
  -WindowStyle Hidden `
  -PassThru

Write-Log $monitorLog "root_pid=$($process.Id)"

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$timedOut = $false

while (-not $process.HasExited) {
  if ((Get-Date) -ge $deadline) {
    $timedOut = $true
    Write-Log $monitorLog "timeout=$(Get-Date -Format o)"
    $taskkill = & taskkill.exe /PID $process.Id /T /F 2>&1
    $taskkillExit = $LASTEXITCODE
    Write-Log $monitorLog "taskkill_exit=$taskkillExit"
    if ($taskkill) {
      Write-Log $monitorLog "taskkill_output=$($taskkill -join ' ')"
    }
    $descendantIds = @()
    if ($taskkillExit -ne 0) {
      $descendantIds = @(Get-DescendantProcessIds -RootPid $process.Id)
    }
    Write-Log $monitorLog "descendant_process_ids=$($descendantIds -join ',')"
    if ($taskkillExit -eq 0) {
      $cleanupIds = @($process.Id)
    } elseif ($descendantIds.Count -gt 0) {
      $cleanupIds = @($process.Id) + $descendantIds
    } elseif ($KillBuildEraProcesses) {
      Write-Log $monitorLog "fallback_cleanup=build-era-processes"
      $cleanupIds = @(
        $process.Id
        Get-CandidateProcesses |
        Where-Object { $baselineIds -notcontains $_.Id } |
        Select-Object -ExpandProperty Id
      )
    } else {
      Write-Log $monitorLog "fallback_cleanup=root-only"
      Write-Log $monitorLog "manual_cleanup_may_be_required=true"
      $cleanupIds = @($process.Id)
    }
    $cleanupIds = @($cleanupIds) | Sort-Object -Unique
    Write-Log $monitorLog "cleanup_candidate_ids=$($cleanupIds -join ',')"
    foreach ($cleanupId in $cleanupIds) {
      Stop-Process -Id $cleanupId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 500
    $remainingIds = @(
      Get-CandidateProcesses |
        Where-Object { $cleanupIds -contains $_.Id } |
        Select-Object -ExpandProperty Id
    )
    Write-Log $monitorLog "remaining_cleanup_candidate_ids=$($remainingIds -join ',')"
    break
  }

  Start-Sleep -Seconds $PollSeconds
  $process.Refresh()
  $rootStats = Get-Process -Id $process.Id -ErrorAction SilentlyContinue |
    Select-Object Id, CPU, StartTime, ProcessName
  Write-Log $monitorLog "tick=$(Get-Date -Format o) root_alive=$(-not $process.HasExited)"
  $rootStats | Format-Table -AutoSize | Out-String | Add-Content -LiteralPath $monitorLog
}

if (-not $timedOut) {
  $process.WaitForExit()
}

$exitCode = if ($timedOut) { 124 } else { $process.ExitCode }
Write-Log $monitorLog "exit=$exitCode end=$(Get-Date -Format o)"

Write-Host "MONITOR_LOG=$monitorLog"
Write-Host "STDOUT_LOG=$stdoutLog"
Write-Host "STDERR_LOG=$stderrLog"
Write-Host "EXIT=$exitCode"
Write-Host "--- stdout tail ---"
Write-Tail $stdoutLog
Write-Host "--- stderr tail ---"
Write-Tail $stderrLog
Write-Host "--- monitor tail ---"
Write-Tail $monitorLog

exit $exitCode
