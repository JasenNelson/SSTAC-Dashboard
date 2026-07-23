[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$TaskName = 'SSTAC-Wiki-Nightly',

    [Parameter(Mandatory = $false)]
    [string]$StartTime = '05:30',

    [Parameter(Mandatory = $false)]
    [switch]$Unregister,

    [Parameter(Mandatory = $false)]
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'

$ScriptDir = $PSScriptRoot
$Wrapper = (Resolve-Path (Join-Path $ScriptDir 'nightly_wiki_sync.ps1')).Path

if ($Unregister) {
    Write-Host "Unregistering scheduled task: $TaskName"
    if ($Apply) {
        schtasks /Delete /TN $TaskName /F
        Write-Host "Done."
    } else {
        Write-Host "DRY RUN: would run schtasks /Delete /TN $TaskName /F"
    }
    exit 0
}

if (-not (Test-Path $Wrapper)) {
    throw "Wrapper not found at $Wrapper"
}

$TaskRun = ('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $Wrapper)

if ($TaskRun.Length -gt 250) {
    throw "Task action exceeds safe length (got $($TaskRun.Length) chars; schtasks /TR limit is 261)."
}

$StartDate = (Get-Date).AddDays(1).ToString('yyyy/MM/dd')

Write-Host "Task Registration Details:"
Write-Host "  TaskName : $TaskName"
Write-Host "  Schedule : Daily at $StartTime PT starting $StartDate"
Write-Host "  Action   : $TaskRun"
Write-Host ""
Write-Host "Exact schtasks command:"
Write-Host "schtasks /Create /TN `"$TaskName`" /SC DAILY /SD $StartDate /ST $StartTime /TR `"$TaskRun`" /RL LIMITED /F"
Write-Host ""

if (-not $Apply) {
    Write-Host "DRY RUN ONLY. Run with -Apply to execute registration."
    exit 0
}

Write-Host "Registering task..."
schtasks /Create `
    /TN $TaskName `
    /SC DAILY `
    /SD $StartDate `
    /ST $StartTime `
    /TR $TaskRun `
    /RL LIMITED `
    /F | Out-Null

$status = schtasks /Query /TN $TaskName /FO LIST 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Task registration appeared to succeed but verification query failed: $status"
}

Write-Host "Task registered successfully."
