[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$TaskName = '\SSTAC-Wiki-Nightly',

    [Parameter(Mandatory = $false)]
    [string]$StartTime = '05:30',

    [Parameter(Mandatory = $false)]
    [switch]$Unregister,

    [Parameter(Mandatory = $false)]
    [switch]$Apply,

    [Parameter(Mandatory = $false)]
    [string]$SchedulerContract = '',

    [Parameter(Mandatory = $false)]
    [string]$RuntimeRoot = '',

    [Parameter(Mandatory = $false)]
    [string]$RegistrationDate = '',

    [Parameter(Mandatory = $false)]
    [string]$StartBoundary = '',

    [Parameter(Mandatory = $false)]
    [string]$TaskDefinitionId = '',

    [Parameter(Mandatory = $false)]
    [string]$OutputXmlPath = ''
)

$ErrorActionPreference = 'Stop'

if ($SchedulerContract -cnotin @('', 'Legacy', 'A', 'D')) {
    throw "Unsupported SchedulerContract: $SchedulerContract. Values are exact and case-sensitive: empty, Legacy, A, or D."
}

$ScriptDir = $PSScriptRoot
$Wrapper = (Resolve-Path -LiteralPath (Join-Path $ScriptDir 'nightly_wiki_sync.ps1')).Path

if ($SchedulerContract -in @('A', 'D')) {
    if ($Apply) {
        throw "Contract $SchedulerContract generation must never install the task. Owner must manually import the XML in Task Scheduler and enter credentials."
    }
    if ($Unregister) {
        throw "Contract $SchedulerContract does not support -Unregister."
    }
    if ($TaskName -cne '\SSTAC-Wiki-Nightly') {
        throw "Contract $SchedulerContract task name must be exactly \SSTAC-Wiki-Nightly"
    }
    if ($StartTime -ne '05:30') {
        throw "Contract $SchedulerContract does not support arbitrary StartTime."
    }

    if (-not $RuntimeRoot -or -not (Test-Path -LiteralPath $RuntimeRoot -PathType Container)) {
        throw "RuntimeRoot is required and must be an existing directory."
    }
    $resolvedRuntimeRoot = (Resolve-Path -LiteralPath $RuntimeRoot).Path

    if (-not $TaskDefinitionId -or ($TaskDefinitionId -notmatch '^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}\z')) {
        throw "TaskDefinitionId is required and must be a canonical nonempty GUID."
    }
    $TaskDefinitionId = $TaskDefinitionId.ToLowerInvariant()
    $parsedGuid = [guid]::Empty
    if (-not [guid]::TryParse($TaskDefinitionId, [ref]$parsedGuid) -or $parsedGuid -eq [guid]::Empty) {
        throw "TaskDefinitionId cannot be the empty GUID."
    }

    if (-not $StartBoundary -or $StartBoundary -notmatch '^\d{4}-\d{2}-\d{2}T05:30:00$') {
        throw "StartBoundary is required and must be exactly timezone-less local YYYY-MM-DDT05:30:00."
    }
    $parsedDate = [datetime]::MinValue
    if (-not [datetime]::TryParseExact($StartBoundary, "yyyy-MM-ddTHH:mm:ss", [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::None, [ref]$parsedDate)) {
        throw "StartBoundary must be a valid datetime."
    }

    if (-not $RegistrationDate) {
        throw "RegistrationDate is required."
    }
    if ($RegistrationDate -notmatch 'T') {
        throw "RegistrationDate must be a valid XML dateTime including time (e.g., ISO 8601 with T separator)."
    }
    try {
        [void][System.Xml.XmlConvert]::ToDateTime($RegistrationDate, [System.Xml.XmlDateTimeSerializationMode]::RoundtripKind)
    } catch {
        throw "RegistrationDate must be a valid XML dateTime (e.g., ISO 8601)."
    }

    if (-not $OutputXmlPath) {
        throw "OutputXmlPath is required."
    }

    $outParent = Split-Path $OutputXmlPath -Parent
    if (-not (Test-Path -LiteralPath $outParent -PathType Container)) {
        throw "OutputXmlPath parent directory does not exist."
    }
    # Overwrite check shifted to atomic file creation below

    $psExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    $scriptPath = Join-Path $resolvedRuntimeRoot "tooling\wiki\nightly_wiki_sync.ps1"
    if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
        throw "Wrapper script not found in RuntimeRoot: $scriptPath"
    }
    $argsStr = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`" -RepoRoot `"$resolvedRuntimeRoot`" -TaskDefinitionId `"$TaskDefinitionId`""
    if ($SchedulerContract -ceq 'D') { $argsStr += ' -SkipLabeling -SkipSemantic' }
    $description = if ($SchedulerContract -ceq 'D') {
        'SSTAC Wiki nightly candidate D: deterministic-only network-capable run; label and semantic disabled. Staged with the daily trigger disabled.'
    } else {
        'SSTAC Wiki nightly candidate A: true unattended network-capable run. Staged with the daily trigger disabled.'
    }

    $xml = @"
<?xml version="1.0" encoding="UTF-8"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Date>$RegistrationDate</Date>
    <Author>DINGAPC\jasen</Author>
    <Description>$description</Description>
    <URI>$TaskName</URI>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>$StartBoundary</StartBoundary>
      <Enabled>false</Enabled>
      <ScheduleByDay>
        <DaysInterval>1</DaysInterval>
      </ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-21-3955207682-4123833406-3144668342-1002</UserId>
      <LogonType>Password</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>true</WakeToRun>
    <ExecutionTimeLimit>PT6H</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$psExe</Command>
      <Arguments>$($argsStr.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;').Replace("'", '&apos;'))</Arguments>
      <WorkingDirectory>$($resolvedRuntimeRoot.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;').Replace("'", '&apos;'))</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

    # Save ASCII atomically and strictly reject non-ASCII
    try {
        $encoder = [System.Text.Encoding]::GetEncoding('us-ascii', [System.Text.EncoderFallback]::ExceptionFallback, [System.Text.DecoderFallback]::ExceptionFallback)
        $bytesToWrite = $encoder.GetBytes($xml)
    } catch [System.Text.EncoderFallbackException] {
        throw "Generated XML contains non-ASCII characters, which cannot be safely written."
    }

    try {
        $fs = [System.IO.FileStream]::new($OutputXmlPath, [System.IO.FileMode]::CreateNew)
        try {
            $fs.Write($bytesToWrite, 0, $bytesToWrite.Length)
        } finally {
            $fs.Dispose()
        }
    } catch [System.IO.IOException] {
        throw "OutputXmlPath already exists or cannot be created. Refusing to overwrite."
    }

    $fi = Get-Item -LiteralPath $OutputXmlPath
    $bytes = $fi.Length
    $bytesForHash = [IO.File]::ReadAllBytes($OutputXmlPath)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $hashBytes = $sha256.ComputeHash($bytesForHash)
    $hash = [BitConverter]::ToString($hashBytes).Replace('-', '').ToLowerInvariant()

    Write-Host "Contract $SchedulerContract generated successfully."
    Write-Host "Path: $OutputXmlPath"
    Write-Host "Bytes: $bytes"
    Write-Host "SHA-256: $hash"
    if ($SchedulerContract -ceq 'D') {
        Write-Host "Semantic summary: Enabled deterministic-only task with label and semantic disabled; daily trigger disabled for manual owner import."
    } else {
        Write-Host "Semantic summary: Enabled task with its daily trigger disabled for manual owner import."
    }
    Write-Host "Note: No task was installed."
    exit 0
}

if ($SchedulerContract -ne '' -and $SchedulerContract -ne 'Legacy' -and $SchedulerContract -ne 'A' -and $SchedulerContract -ne 'D') {
    throw "Unsupported SchedulerContract: $SchedulerContract"
}

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

if (-not (Test-Path -LiteralPath $Wrapper)) {
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
