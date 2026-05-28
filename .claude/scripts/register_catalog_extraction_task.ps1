# =============================================================================
# register_catalog_extraction_task.ps1 -- one-shot Stream D task registration
# =============================================================================
#
# Purpose: register the Windows scheduled task "SSTAC-StreamD-CatalogExtract"
# that fires `.claude/scripts/launch_catalog_extraction.ps1` nightly at 23:30
# Pacific time per design lock #3.
#
# Run this ONCE by the owner. Subsequent runs of the wrapper happen via the
# scheduled task firing automatically.
#
# Per BN-RRM commit 403fcfb1 lessons learned (April 2026 autonomous run):
#   - schtasks /TR has a 261-char limit on the task action; we keep the action
#     short by pointing at a fixed wrapper path (no inline -EncodedCommand).
#   - Date format is yyyy/MM/dd, not MM/dd/yyyy.
#   - /ST may be in the past by the time schtasks /Create returns; we do NOT
#     call /Run explicitly here because we want the FIRST fire to be 23:30 PT
#     on a future day, not right now.
#
# Design reference: STREAM_D_REDESIGN_2026_05_28.md v0.3.1.
#
# Author: Stream D autonomous session (Opus 4.7), 2026-05-28.
#
# Usage:
#   .\register_catalog_extraction_task.ps1
#   .\register_catalog_extraction_task.ps1 -StartTime "23:30" -TaskName "SSTAC-StreamD-CatalogExtract"
#   .\register_catalog_extraction_task.ps1 -Unregister   # to delete
#
# =============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$TaskName = 'SSTAC-StreamD-CatalogExtract',

    [Parameter(Mandatory = $false)]
    [string]$StartTime = '23:30',

    [Parameter(Mandatory = $false)]
    [switch]$Unregister
)

$ErrorActionPreference = 'Stop'

$ScriptDir = $PSScriptRoot
$Wrapper = Join-Path $ScriptDir 'launch_catalog_extraction.ps1'

if ($Unregister) {
    Write-Host "Unregistering scheduled task: $TaskName"
    schtasks /Delete /TN $TaskName /F
    Write-Host "Done."
    exit 0
}

if (-not (Test-Path $Wrapper)) {
    throw "Wrapper not found at $Wrapper. Ensure Phase 3 commit 1 has landed."
}

# Build the task action: powershell.exe -File <wrapper>
# Keep the action SHORT to stay under the 261-char /TR limit.
$TaskRun = ('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $Wrapper)

if ($TaskRun.Length -gt 250) {
    throw "Task action exceeds safe length (got $($TaskRun.Length) chars; schtasks /TR limit is 261). Move the wrapper to a shorter path."
}

# Start date: tomorrow, in yyyy/MM/dd format (per April 2026 schtasks fix)
$StartDate = (Get-Date).AddDays(1).ToString('yyyy/MM/dd')

Write-Host "Registering scheduled task:"
Write-Host "  TaskName : $TaskName"
Write-Host "  Schedule : Daily at $StartTime starting $StartDate"
Write-Host "  Action   : $TaskRun"
Write-Host ""
Write-Host "Note: machine must be awake at $StartTime PT for the task to fire."
Write-Host "Per design lock #3, owner leaves the machine awake overnight (no BIOS wake-on-timer)."
Write-Host ""

# Register the task
schtasks /Create `
    /TN $TaskName `
    /SC DAILY `
    /SD $StartDate `
    /ST $StartTime `
    /TR $TaskRun `
    /RL LIMITED `
    /F | Out-Null

# Verify registration
$status = schtasks /Query /TN $TaskName /FO LIST 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Task registration appeared to succeed but verification query failed: $status"
}

Write-Host "Task registered successfully. To enable / disable / trigger manually:"
Write-Host "  schtasks /Run     /TN `"$TaskName`"      # trigger now (smoke test)"
Write-Host "  schtasks /Change  /TN `"$TaskName`" /DISABLE   # pause"
Write-Host "  schtasks /Change  /TN `"$TaskName`" /ENABLE    # resume"
Write-Host "  schtasks /Delete  /TN `"$TaskName`" /F         # remove"
Write-Host ""
Write-Host "Per design, the first real run should be triggered MANUALLY via"
Write-Host "schtasks /Run after the smoke-test manifest is populated."
