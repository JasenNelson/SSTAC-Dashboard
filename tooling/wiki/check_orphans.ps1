[CmdletBinding()]
param(
    [ValidateSet('CaptureBaseline', 'EvaluateTerminal')][string]$Mode,
    [string]$RunId,
    [string]$RuntimeRoot,
    [int]$RunParentPid,
    [string]$OutputPath,
    [string]$BaselinePath,
    [string]$ExpectedBaselineSha256,
    [string]$ProcessSnapshotPath,
    [int]$FixtureCheckerPid
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$identityCap = 16
$script:enumerationSucceeded = $false
$script:classificationSucceeded = $false
$script:identityOverflow = $false

function Get-Sha256Bytes([byte[]]$Bytes) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Get-Sha256Text([string]$Text) {
    Get-Sha256Bytes ([Text.Encoding]::UTF8.GetBytes($Text))
}

function Write-AtomicJson([object]$Data, [string]$Path) {
    $parent = Split-Path -Parent $Path
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $parent -PathType Container)) {
        throw 'OutputPath parent does not exist'
    }
    if (Test-Path -LiteralPath $Path) { throw 'OutputPath already exists' }
    $temporary = "$Path.tmp-$PID-$([guid]::NewGuid().ToString('N'))"
    $json = (($Data | ConvertTo-Json -Depth 12) -replace "`r`n", "`n") + "`n"
    [IO.File]::WriteAllText($temporary, $json, (New-Object Text.UTF8Encoding($false)))
    [IO.File]::Move($temporary, $Path)
}

function Get-Field([object]$Object, [string]$Name) {
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    $property.Value
}

function Get-StrictNonnegativeInteger([object]$Value, [string]$Name) {
    $integerTypes = @([byte], [sbyte], [int16], [uint16], [int32], [uint32], [int64])
    if ($null -eq $Value -or $integerTypes -notcontains $Value.GetType()) { throw "invalid integer type $Name" }
    $parsed = [int64]$Value
    if ($parsed -lt 0 -or $parsed -gt [int]::MaxValue) { throw "invalid integer range $Name" }
    return [int]$parsed
}

function Convert-StrictUtc([object]$Value, [string]$Name) {
    if ($Value -is [datetime]) {
        $dateTimeValue = [datetime]$Value
        if ($dateTimeValue.Kind -ne [DateTimeKind]::Utc) { throw "invalid UTC timestamp $Name" }
        return [datetimeoffset]$dateTimeValue
    }
    if ($Value -is [datetimeoffset]) {
        $dateTimeOffsetValue = [datetimeoffset]$Value
        if ($dateTimeOffsetValue.Offset -ne [timespan]::Zero) { throw "invalid UTC timestamp $Name" }
        return $dateTimeOffsetValue.ToUniversalTime()
    }
    $parsed = [datetimeoffset]::MinValue
    $text = [string]$Value
    if ($text -cnotmatch 'Z$' -or -not [datetimeoffset]::TryParse(
            $text,
            [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::RoundtripKind,
            [ref]$parsed
        ) -or $parsed.Offset -ne [timespan]::Zero) {
        throw "invalid UTC timestamp $Name"
    }
    $parsed.ToUniversalTime()
}

function Test-CanonicalRunId([string]$Value) {
    $Value -cmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
}

function Convert-Minimal([object]$Process, [bool]$Fixture) {
    if ($Fixture) {
        $pidValue = Get-Field $Process 'process_id'
        $parentValue = Get-Field $Process 'parent_process_id'
        $creation = Get-Field $Process 'creation_utc'
        $name = Get-Field $Process 'name'
        $command = Get-Field $Process 'command_line'
        $executable = Get-Field $Process 'executable_path'
    } else {
        $pidValue = $Process.ProcessId
        $parentValue = $Process.ParentProcessId
        $creation = if ($null -eq $Process.CreationDate) { $null } else { ([datetime]$Process.CreationDate).ToUniversalTime().ToString('o') }
        $name = $Process.Name
        $command = $Process.CommandLine
        $executable = $Process.ExecutablePath
    }
    $processId = Get-StrictNonnegativeInteger $pidValue 'process_id'
    if ($processId -eq 0) { return $null }
    $parentId = Get-StrictNonnegativeInteger $parentValue "parent_process_id for $processId"
    [pscustomobject]@{
        process_id = $processId
        parent_process_id = $parentId
        creation_utc = $creation
        name = if ($null -eq $name) { $null } else { [string]$name }
        command_line = if ($null -eq $command) { $null } else { [string]$command }
        executable_path = if ($null -eq $executable) { $null } else { [string]$executable }
    }
}

function Convert-Full([object]$Row) {
    $creation = Convert-StrictUtc $Row.creation_utc "creation_utc for relevant PID $($Row.process_id)"
    if ([string]::IsNullOrWhiteSpace([string]$Row.name)) { throw "missing name for relevant PID $($Row.process_id)" }
    $command = if ($null -eq $Row.command_line) { '' } else { [string]$Row.command_line }
    $executable = if ($null -eq $Row.executable_path) { '' } else { [string]$Row.executable_path }
    $created = $creation.UtcDateTime.ToString('o')
    $parts = @([string]$Row.process_id, [string]$Row.parent_process_id, $created, [string]$Row.name, $command, $executable)
    $canonical = (($parts | ForEach-Object { "$($_.Length):$_" }) -join '|')
    [pscustomobject][ordered]@{
        process_id = [int]$Row.process_id
        parent_process_id = [int]$Row.parent_process_id
        creation_utc = $created
        name = [string]$Row.name
        command_line = $command
        executable_path = $executable
        identity_sha256 = Get-Sha256Text $canonical
    }
}

function Convert-FullRequiredForBaselinePid([object]$Row) {
    foreach ($field in @('creation_utc', 'name', 'command_line', 'executable_path')) {
        if ($null -eq $Row.PSObject.Properties[$field] -or
            $null -eq $Row.$field -or
            [string]::IsNullOrWhiteSpace([string]$Row.$field)) {
            $script:classificationSucceeded = $false
            throw "missing full current identity field $field for occupied baseline PID $($Row.process_id)"
        }
    }
    Convert-Full $Row
}

function Get-Summary(
    [object]$Identity,
    [bool]$RuntimeReference = $false,
    [bool]$Descendant = $false,
    [string]$ProcessClass = ''
) {
    $summary = [ordered]@{
        process_id = $Identity.process_id
        parent_process_id = $Identity.parent_process_id
        creation_utc = $Identity.creation_utc
        name = $Identity.name
        command_line_sha256 = Get-Sha256Text $Identity.command_line
        executable_path_sha256 = Get-Sha256Text $Identity.executable_path
        identity_sha256 = $Identity.identity_sha256
        runtime_reference = $RuntimeReference
        attributable_descendant = $Descendant
    }
    if (-not [string]::IsNullOrWhiteSpace($ProcessClass)) { $summary.process_class = $ProcessClass }
    [pscustomobject]$summary
}

function Assert-Summary([object]$Identity, [string]$Name, [bool]$RequireGraphifyClass = $false) {
    if ($null -eq $Identity) { throw "missing baseline identity $Name" }
    $identityProcessId = Get-StrictNonnegativeInteger $Identity.process_id "$Name.process_id"
    $parent = Get-StrictNonnegativeInteger $Identity.parent_process_id "$Name.parent_process_id"
    if ($identityProcessId -le 0) {
        throw "invalid baseline PID binding $Name"
    }
    $null = Convert-StrictUtc $Identity.creation_utc "$Name.creation_utc"
    if ([string]::IsNullOrWhiteSpace([string]$Identity.name)) { throw "invalid baseline identity fields $Name" }
    foreach ($field in @('command_line_sha256', 'executable_path_sha256', 'identity_sha256')) {
        if ([string]$Identity.$field -cnotmatch '^[0-9a-f]{64}$') { throw "invalid baseline identity hash $Name.$field" }
    }
    if ($null -ne $Identity.PSObject.Properties['command_line'] -or $null -ne $Identity.PSObject.Properties['executable_path']) {
        throw "unbounded raw process field in $Name"
    }
    foreach ($field in @('runtime_reference', 'attributable_descendant')) {
        if ($null -eq $Identity.PSObject.Properties[$field] -or $Identity.$field -isnot [bool]) {
            throw "invalid baseline classification flag $Name.$field"
        }
    }
    if ($RequireGraphifyClass -and [string]$Identity.process_class -cne 'PREEXISTING_GRAPHIFY_MCP') {
        throw "invalid baseline process classification $Name"
    }
}

function Get-SetHash([object[]]$Summaries) {
    Get-Sha256Text ((@($Summaries | ForEach-Object { $_.identity_sha256 } | Sort-Object)) -join "`n")
}

function Test-PathToken([string]$Text, [string]$ExactPath) {
    if ([string]::IsNullOrEmpty($Text)) { return $false }
    $source = $Text.Replace('/', '\')
    $needle = $ExactPath.Replace('/', '\')
    $index = 0
    while ($index -lt $source.Length) {
        $found = $source.IndexOf($needle, $index, [StringComparison]::OrdinalIgnoreCase)
        if ($found -lt 0) { return $false }
        $beforeOk = ($found -eq 0 -or [char]::IsWhiteSpace($source[$found - 1]) -or $source[$found - 1] -in @('"', "'", '='))
        $after = $found + $needle.Length
        $afterOk = ($after -eq $source.Length -or $source[$after] -in @('\', '/', '"', "'") -or [char]::IsWhiteSpace($source[$after]))
        if ($beforeOk -and $afterOk) { return $true }
        $index = $found + 1
    }
    $false
}

function Test-NamespacePrefixedPathToken([string]$Text, [string]$ExactPath) {
    if ([string]::IsNullOrEmpty($Text)) { return $false }
    foreach ($prefix in @('\\?\', '\??\')) {
        if (Test-PathToken $Text ($prefix + $ExactPath)) { return $true }
    }
    $false
}

function Test-ExactArgumentToken([string]$Text, [string]$ExactValue) {
    if ([string]::IsNullOrEmpty($Text)) { return $false }
    $source = $Text.Replace('/', '\')
    $needle = $ExactValue.Replace('/', '\')
    $index = 0
    while ($index -lt $source.Length) {
        $found = $source.IndexOf($needle, $index, [StringComparison]::OrdinalIgnoreCase)
        if ($found -lt 0) { return $false }
        $beforeOk = ($found -eq 0 -or [char]::IsWhiteSpace($source[$found - 1]) -or $source[$found - 1] -in @('"', "'", '='))
        $after = $found + $needle.Length
        $afterOk = ($after -eq $source.Length -or $source[$after] -in @('"', "'") -or [char]::IsWhiteSpace($source[$after]))
        if ($beforeOk -and $afterOk) { return $true }
        $index = $found + 1
    }
    $false
}

function Test-RuntimeReference([object]$Row, [string]$Runtime) {
    (Test-PathToken ([string]$Row.command_line) $Runtime) -or
        (-not [string]::IsNullOrEmpty([string]$Row.executable_path) -and
            ([string]$Row.executable_path).Replace('/', '\').StartsWith("$Runtime\", [StringComparison]::OrdinalIgnoreCase))
}

function Test-Descendant([int]$ProcessId, [hashtable]$ByPid, [int]$ParentPid) {
    $visited = @{}
    $cursor = $ProcessId
    while ($true) {
        if ($visited.ContainsKey($cursor)) { throw "ancestry cycle at PID $cursor" }
        $visited[$cursor] = $true
        if (-not $ByPid.ContainsKey($cursor)) { return $false }
        $next = [int]$ByPid[$cursor].parent_process_id
        if ($next -eq $ParentPid) { return $true }
        if ($next -le 0 -or $next -eq $cursor) { return $false }
        $cursor = $next
    }
}

function Test-ExpectedRunConsoleHost(
    [object]$Identity,
    [object]$ExpectedParentIdentity,
    [string]$Runtime,
    [bool]$RuntimeReference
) {
    if ([string]::IsNullOrWhiteSpace([string]$Identity.executable_path)) {
        return $false
    }
    try {
        $expectedParentPid = Get-StrictNonnegativeInteger $ExpectedParentIdentity.process_id 'expected parent process_id'
        if ($expectedParentPid -le 0 -or
            [string]$ExpectedParentIdentity.identity_sha256 -cnotmatch '^[0-9a-f]{64}$') {
            return $false
        }
        $identityCreated = Convert-StrictUtc $Identity.creation_utc 'console host creation_utc'
        $parentCreated = Convert-StrictUtc $ExpectedParentIdentity.creation_utc 'expected parent creation_utc'
        $expectedExecutable = [IO.Path]::GetFullPath((Join-Path ([Environment]::SystemDirectory) 'conhost.exe'))
        $observedExecutable = [IO.Path]::GetFullPath([string]$Identity.executable_path)
    } catch {
        return $false
    }
    ($Identity.process_id -gt 0 -and
        $Identity.parent_process_id -eq $ExpectedParentPid -and
        $identityCreated -ge $parentCreated -and
        [string]::Equals([string]$Identity.name, 'conhost.exe', [StringComparison]::OrdinalIgnoreCase) -and
        -not [string]::IsNullOrWhiteSpace([string]$Identity.command_line) -and
        [string]::Equals($observedExecutable, $expectedExecutable, [StringComparison]::OrdinalIgnoreCase) -and
        [string]$Identity.identity_sha256 -cmatch '^[0-9a-f]{64}$' -and
        -not $RuntimeReference -and
        -not (Test-NamespacePrefixedPathToken ([string]$Identity.command_line) $Runtime))
}

function Test-Graphify([object]$Identity, [string]$Runtime) {
    $expectedExecutable = Join-Path $Runtime '.venv-graphify\Scripts\python.exe'
    $graphPath = Join-Path $Runtime 'wiki\.graph\graph.json'
    $moduleMatches = [regex]::Matches($Identity.command_line, '(?i)(?:^|\s)-m\s+graphify\.serve(?:\s|$)')
    $transportMatches = [regex]::Matches($Identity.command_line, '(?i)(?:^|\s)--transport\s+stdio(?:\s|$)')
    $allModuleSwitches = [regex]::Matches($Identity.command_line, '(?i)(?:^|\s)-m(?:\s|$)')
    $allTransportSwitches = [regex]::Matches($Identity.command_line, '(?i)(?:^|\s)--transport(?:\s|$)')
    $command = $Identity.command_line.TrimStart()
    $quotedExecutable = '"' + $expectedExecutable + '"'
    $quotedMatch = $command.StartsWith($quotedExecutable, [StringComparison]::OrdinalIgnoreCase) -and
        ($command.Length -eq $quotedExecutable.Length -or [char]::IsWhiteSpace($command[$quotedExecutable.Length]))
    $commandStartsExpected = $quotedMatch -or
        ($command.StartsWith($expectedExecutable, [StringComparison]::OrdinalIgnoreCase) -and
            ($command.Length -eq $expectedExecutable.Length -or [char]::IsWhiteSpace($command[$expectedExecutable.Length])))
    ([string]::Equals([string]$Identity.name, 'python.exe', [StringComparison]::OrdinalIgnoreCase) -and
        [string]::Equals([string]$Identity.executable_path, $expectedExecutable, [StringComparison]::OrdinalIgnoreCase) -and
        $commandStartsExpected -and
        (Test-ExactArgumentToken $Identity.command_line $graphPath) -and
        $moduleMatches.Count -eq 1 -and $allModuleSwitches.Count -eq 1 -and
        $transportMatches.Count -eq 1 -and $allTransportSwitches.Count -eq 1)
}

function Test-ParentRole([object]$Identity, [string]$Runtime) {
    $Identity.name -match '(?i)^(powershell|pwsh)(\.exe)?$' -and
        (Test-ExactArgumentToken $Identity.command_line (Join-Path $Runtime 'tooling\wiki\nightly_wiki_sync.ps1'))
}

function Test-CheckerRole([object]$Identity, [string]$Runtime) {
    $Identity.name -match '(?i)^(powershell|pwsh)(\.exe)?$' -and
        (Test-ExactArgumentToken $Identity.command_line (Join-Path $Runtime 'tooling\wiki\check_orphans.ps1'))
}

function Read-Rows {
    $fixture = -not [string]::IsNullOrWhiteSpace($ProcessSnapshotPath)
    if (-not $fixture -and $PSBoundParameters.ContainsKey('FixtureCheckerPid')) { throw 'FixtureCheckerPid requires ProcessSnapshotPath' }
    if ($fixture) {
        $snapshot = Get-Content -LiteralPath $ProcessSnapshotPath -Raw | ConvertFrom-Json
        if ([string]$snapshot.schema_version -cne '1.0' -or [string]$snapshot.enumeration_status -cne 'PASS') {
            throw 'process fixture reports enumeration failure or wrong schema'
        }
        $raw = @($snapshot.processes)
    } else {
        $raw = @(Get-CimInstance Win32_Process -ErrorAction Stop)
    }
    $script:enumerationSucceeded = $true
    $rows = @()
    $seen = @{}
    foreach ($item in $raw) {
        $row = Convert-Minimal $item $fixture
        if ($null -eq $row) { continue }
        if ($seen.ContainsKey($row.process_id)) { throw "duplicate process_id $($row.process_id)" }
        $seen[$row.process_id] = $true
        $rows += $row
    }
    return $rows
}

function Get-Relevant([object[]]$Rows, [hashtable]$ByPid, [object]$ParentIdentity, [int]$CheckerPid, [string]$Runtime) {
    $result = @()
    $parentPid = [int]$ParentIdentity.process_id
    foreach ($row in $Rows) {
        if ($row.process_id -eq $ParentPid -or $row.process_id -eq $CheckerPid) { continue }
        $runtimeRef = Test-RuntimeReference $row $Runtime
        $descendant = Test-Descendant $row.process_id $ByPid $ParentPid
        if ($runtimeRef -or $descendant) {
            $full = Convert-Full $row
            if (Test-ExpectedRunConsoleHost $full $ParentIdentity $Runtime $runtimeRef) { continue }
            $class = if ($runtimeRef -and -not $descendant -and (Test-Graphify $full $Runtime)) {
                'PREEXISTING_GRAPHIFY_MCP'
            } else {
                'DISALLOWED_RELEVANT_PROCESS'
            }
            $result += Get-Summary $full $runtimeRef $descendant $class
        }
    }
    if ($result.Count -gt $identityCap) {
        $script:identityOverflow = $true
        throw "relevant identity cap exceeded: $($result.Count) > $identityCap"
    }
    return @($result | Sort-Object identity_sha256)
}

function Invoke-LegacyReportOnly {
    $fixture = -not [string]::IsNullOrWhiteSpace($ProcessSnapshotPath)
    if ($fixture) {
        $snapshot = Get-Content -LiteralPath $ProcessSnapshotPath -Raw | ConvertFrom-Json
        if ([string]$snapshot.schema_version -cne '1.0' -or [string]$snapshot.enumeration_status -cne 'PASS') { throw 'legacy process fixture is invalid' }
        $raw = @($snapshot.processes)
        $parentIds = @{}
        foreach ($item in $raw) {
            $pidValue = 0
            if ([int]::TryParse([string](Get-Field $item 'process_id'), [ref]$pidValue) -and $pidValue -gt 0) { $parentIds[$pidValue] = $true }
        }
    } else {
        $raw = @(Get-CimInstance Win32_Process -ErrorAction Stop)
    }
    $orphansFound = $false
    $results = @()
    foreach ($item in $raw) {
        $nameValue = if ($fixture) { Get-Field $item 'name' } else { $item.Name }
        $commandValue = if ($fixture) { Get-Field $item 'command_line' } else { $item.CommandLine }
        $name = [string]$nameValue
        $command = [string]$commandValue
        if ($name -notmatch '(?i)^(graphify|python)(\.exe)?$' -or $command -notmatch '(?i)SSTAC-Dashboard') { continue }
        $processIdValue = if ($fixture) { Get-Field $item 'process_id' } else { $item.ProcessId }
        $parentProcessIdValue = if ($fixture) { Get-Field $item 'parent_process_id' } else { $item.ParentProcessId }
        $pidValue = [int]$processIdValue
        $parentPid = [int]$parentProcessIdValue
        if ($parentPid -le 0) {
            $status = 'SUSPICIOUS (Parent PID Null)'
        } else {
            $parentAlive = if ($fixture) { $parentIds.ContainsKey($parentPid) } else { $null -ne (Get-Process -Id $parentPid -ErrorAction SilentlyContinue) }
            if ($parentAlive) { $status = 'ALIVE' } else { $status = 'ORPHANED'; $orphansFound = $true }
        }
        $results += [pscustomobject]@{ PID = $pidValue; Name = $name; ParentPID = $parentPid; Status = $status; CommandLine = $command }
    }
    if ($results.Count -gt 0) { $results | Format-Table -AutoSize | Out-String | Write-Host }
    else { Write-Host 'No orphan candidates found.' }
    if ($orphansFound) { return 1 }
    0
}

if ([string]::IsNullOrWhiteSpace($Mode)) {
    try { exit (Invoke-LegacyReportOnly) }
    catch { Write-Error $_.Exception.Message; exit 1 }
}
if (-not (Test-CanonicalRunId $RunId) -or [string]::IsNullOrWhiteSpace($RuntimeRoot) -or
    $RunParentPid -le 0 -or [string]::IsNullOrWhiteSpace($OutputPath)) {
    Write-Error 'Canonical RunId, RuntimeRoot, positive RunParentPid, and OutputPath are required for custody modes'
    exit 1
}

$runtime = [IO.Path]::GetFullPath($RuntimeRoot).TrimEnd('\', '/')
$checkerPid = if ($ProcessSnapshotPath -and $PSBoundParameters.ContainsKey('FixtureCheckerPid')) { $FixtureCheckerPid } else { $PID }

try {
    $rows = @(Read-Rows)
    $byPid = @{}
    foreach ($row in $rows) { $byPid[[int]$row.process_id] = $row }
    if (-not $byPid.ContainsKey($RunParentPid)) { throw 'run parent row is absent' }
    if (-not $byPid.ContainsKey($checkerPid)) { throw 'checker row is absent' }
    $parent = Convert-Full $byPid[$RunParentPid]
    $checker = Convert-Full $byPid[$checkerPid]
    if (-not (Test-ParentRole $parent $runtime)) { throw 'run parent identity is not the exact nightly wrapper' }
    if ($checker.parent_process_id -ne $RunParentPid -or -not (Test-CheckerRole $checker $runtime)) {
        throw 'checker identity or parent is invalid'
    }
    $parentSummary = Get-Summary $parent
    $checkerSummary = Get-Summary $checker
    $relevant = @(Get-Relevant $rows $byPid $parent $checkerPid $runtime)
    $script:classificationSucceeded = $true

    if ($Mode -eq 'CaptureBaseline') {
        $notAllowed = @($relevant | Where-Object { [string]$_.process_class -cne 'PREEXISTING_GRAPHIFY_MCP' })
        $capturedAt = [datetimeoffset]::UtcNow
        $futureIdentity = @($relevant + @($parentSummary, $checkerSummary) | Where-Object { (Convert-StrictUtc $_.creation_utc 'capture identity creation_utc') -gt $capturedAt })
        if ($futureIdentity.Count -ne 0) { throw 'baseline identity creation is after captured_at_utc' }
        $result = if ($notAllowed.Count -eq 0) { 'PASS' } else { 'FAIL' }
        $receipt = [ordered]@{
            schema_version = '1.0'
            evidence_type = 'PROCESS_CUSTODY_BASELINE'
            run_id = $RunId
            captured_at_utc = $capturedAt.UtcDateTime.ToString('o')
            runtime_root = $runtime
            run_parent_pid = $RunParentPid
            run_parent_identity = $parentSummary
            checker_identity = $checkerSummary
            enumeration_succeeded = $true
            classification_succeeded = $true
            identity_cap = $identityCap
            identity_overflow = $false
            relevant_count = $relevant.Count
            allowed_preexisting_graphify_count = ($relevant.Count - $notAllowed.Count)
            disallowed_relevant_count = $notAllowed.Count
            relevant_identity_set_sha256 = Get-SetHash $relevant
            relevant_identities = $relevant
            disallowed_relevant_identities = $notAllowed
            result = $result
        }
        Write-AtomicJson $receipt $OutputPath
        if ($result -ne 'PASS') { Write-Error 'Baseline contains non-Graphify relevant identity'; exit 1 }
        exit 0
    }

    if ([string]::IsNullOrWhiteSpace($BaselinePath) -or $ExpectedBaselineSha256 -cnotmatch '^[0-9a-f]{64}$') {
        throw 'BaselinePath and lowercase ExpectedBaselineSha256 are required'
    }
    $baselineBytes = [IO.File]::ReadAllBytes($BaselinePath)
    $observedBaselineSha256 = Get-Sha256Bytes $baselineBytes
    if ($observedBaselineSha256 -cne $ExpectedBaselineSha256) { throw 'baseline SHA-256 mismatch' }
    $baseline = (New-Object Text.UTF8Encoding($false, $true)).GetString($baselineBytes) | ConvertFrom-Json
    if ([string]$baseline.schema_version -cne '1.0' -or
        [string]$baseline.evidence_type -cne 'PROCESS_CUSTODY_BASELINE' -or
        [string]$baseline.result -cne 'PASS') { throw 'baseline is not successful' }
    if (-not (Test-CanonicalRunId ([string]$baseline.run_id)) -or [string]$baseline.run_id -cne $RunId) {
        throw 'baseline run_id binding mismatch'
    }
    foreach ($field in @('enumeration_succeeded', 'classification_succeeded', 'identity_overflow')) {
        if ($null -eq $baseline.PSObject.Properties[$field] -or $baseline.$field -isnot [bool]) {
            throw "invalid baseline boolean type $field"
        }
    }
    $baselineIdentityCap = Get-StrictNonnegativeInteger $baseline.identity_cap 'baseline.identity_cap'
    if ($baseline.enumeration_succeeded -ne $true -or $baseline.classification_succeeded -ne $true -or
        $baseline.identity_overflow -ne $false -or $baselineIdentityCap -ne $identityCap) {
        throw 'baseline status contradiction'
    }
    $baselineRunParentPid = Get-StrictNonnegativeInteger $baseline.run_parent_pid 'baseline.run_parent_pid'
    if (-not [string]::Equals([string]$baseline.runtime_root, $runtime, [StringComparison]::OrdinalIgnoreCase) -or
        $baselineRunParentPid -ne $RunParentPid) { throw 'baseline binding mismatch' }
    $baselineCaptured = Convert-StrictUtc $baseline.captured_at_utc 'baseline.captured_at_utc'
    Assert-Summary $baseline.run_parent_identity 'run_parent_identity'
    Assert-Summary $baseline.checker_identity 'checker_identity'
    $baselineParentIdentityPid = Get-StrictNonnegativeInteger $baseline.run_parent_identity.process_id 'baseline.run_parent_identity.process_id'
    $baselineCheckerParentPid = Get-StrictNonnegativeInteger $baseline.checker_identity.parent_process_id 'baseline.checker_identity.parent_process_id'
    $baselineCheckerPid = Get-StrictNonnegativeInteger $baseline.checker_identity.process_id 'baseline.checker_identity.process_id'
    if ($baselineParentIdentityPid -ne $RunParentPid -or $baselineCheckerParentPid -ne $RunParentPid -or
        $baselineCheckerPid -eq $RunParentPid) {
        throw 'baseline parent/checker summary contradiction'
    }
    if ($null -eq $baseline.PSObject.Properties['relevant_identities'] -or
        $null -eq $baseline.PSObject.Properties['disallowed_relevant_identities']) {
        throw 'baseline identity arrays are absent'
    }
    $baselineIdentities = @($baseline.relevant_identities)
    $disallowed = @($baseline.disallowed_relevant_identities)
    $baselineRelevantCount = Get-StrictNonnegativeInteger $baseline.relevant_count 'baseline.relevant_count'
    $baselineAllowedCount = Get-StrictNonnegativeInteger $baseline.allowed_preexisting_graphify_count 'baseline.allowed_preexisting_graphify_count'
    $baselineDisallowedCount = Get-StrictNonnegativeInteger $baseline.disallowed_relevant_count 'baseline.disallowed_relevant_count'
    if ($baselineIdentities.Count -gt $identityCap -or
        $baselineRelevantCount -ne $baselineIdentities.Count -or
        $baselineAllowedCount -ne $baselineIdentities.Count -or
        $baselineDisallowedCount -ne 0 -or $disallowed.Count -ne 0) {
        throw 'baseline count or disallowed-identity contradiction'
    }
    foreach ($identity in $baselineIdentities) {
        Assert-Summary $identity 'relevant_identity' $true
        if ($identity.runtime_reference -ne $true -or $identity.attributable_descendant -ne $false) {
            throw 'baseline relevant classification contradiction'
        }
        if ((Convert-StrictUtc $identity.creation_utc 'baseline relevant creation_utc') -gt $baselineCaptured) { throw 'baseline relevant identity postdates capture' }
    }
    if ((Convert-StrictUtc $baseline.run_parent_identity.creation_utc 'baseline parent creation_utc') -gt $baselineCaptured -or
        (Convert-StrictUtc $baseline.checker_identity.creation_utc 'baseline checker creation_utc') -gt $baselineCaptured) { throw 'baseline parent/checker identity postdates capture' }
    $baselineHashes = @($baselineIdentities | ForEach-Object { [string]$_.identity_sha256 })
    if ($baselineHashes.Count -ne @($baselineHashes | Select-Object -Unique).Count) { throw 'baseline duplicate identity hash' }
    $baselinePidSet = @{}
    foreach ($identity in $baselineIdentities) {
        $baselinePid = Get-StrictNonnegativeInteger $identity.process_id 'baseline relevant process_id'
        if ($baselinePidSet.ContainsKey($baselinePid)) { throw "baseline duplicate process_id $baselinePid" }
        $baselinePidSet[$baselinePid] = $true
    }
    $baselineSetHash = Get-SetHash $baselineIdentities
    if ([string]$baseline.relevant_identity_set_sha256 -cnotmatch '^[0-9a-f]{64}$' -or
        $baselineSetHash -cne [string]$baseline.relevant_identity_set_sha256) { throw 'baseline set hash mismatch' }

    $terminalIdentities = @($relevant)
    foreach ($baselineIdentity in $baselineIdentities) {
        $baselinePid = [int]$baselineIdentity.process_id
        if (-not $byPid.ContainsKey($baselinePid)) { continue }
        $currentFull = Convert-FullRequiredForBaselinePid $byPid[$baselinePid]
        $currentRuntimeReference = Test-RuntimeReference $byPid[$baselinePid] $runtime
        $currentDescendant = Test-Descendant $baselinePid $byPid $RunParentPid
        $currentClass = if ($currentRuntimeReference -and -not $currentDescendant -and (Test-Graphify $currentFull $runtime)) {
            'PREEXISTING_GRAPHIFY_MCP'
        } elseif (-not $currentRuntimeReference -and -not $currentDescendant) {
            'BASELINE_PID_REUSE_OUTSIDE_RELEVANT_SCOPE'
        } else {
            'DISALLOWED_RELEVANT_PROCESS'
        }
        $currentSummary = Get-Summary $currentFull $currentRuntimeReference $currentDescendant $currentClass
        $existingCurrentPid = @($terminalIdentities | Where-Object { [int]$_.process_id -eq $baselinePid })
        if ($existingCurrentPid.Count -gt 1) { throw "terminal duplicate process_id $baselinePid" }
        if ($existingCurrentPid.Count -eq 1) {
            if ([string]$existingCurrentPid[0].identity_sha256 -cne [string]$currentSummary.identity_sha256) {
                throw "terminal identity contradiction for baseline PID $baselinePid"
            }
        } elseif ([string]$currentSummary.identity_sha256 -cne [string]$baselineIdentity.identity_sha256) {
            $terminalIdentities += $currentSummary
        } else {
            throw "occupied baseline PID $baselinePid escaped terminal relevance classification"
        }
    }
    if ($terminalIdentities.Count -gt $identityCap) {
        $script:identityOverflow = $true
        $script:classificationSucceeded = $false
        throw "terminal identity cap exceeded: $($terminalIdentities.Count) > $identityCap"
    }
    $terminalIdentities = @($terminalIdentities | Sort-Object identity_sha256)

    $evaluatedAt = [datetimeoffset]::UtcNow
    if ($baselineCaptured -gt $evaluatedAt) { throw 'baseline captured_at_utc is after terminal evaluation' }
    $futureTerminalIdentity = @($terminalIdentities + @($parentSummary, $checkerSummary) | Where-Object { (Convert-StrictUtc $_.creation_utc 'terminal identity creation_utc') -gt $evaluatedAt })
    if ($futureTerminalIdentity.Count -ne 0) { throw 'terminal identity creation is after evaluated_at_utc' }
    $parentMatch = ($parentSummary.identity_sha256 -ceq [string]$baseline.run_parent_identity.identity_sha256)
    $currentHashes = @($terminalIdentities | ForEach-Object { [string]$_.identity_sha256 })
    $survivors = @($terminalIdentities | Where-Object { $baselineHashes -notcontains [string]$_.identity_sha256 })
    $departed = @($baselineIdentities | Where-Object { $currentHashes -notcontains [string]$_.identity_sha256 })
    $result = if ($parentMatch -and $survivors.Count -eq 0) { 'PASS' } else { 'FAIL' }
    $receipt = [ordered]@{
        schema_version = '1.0'
        evidence_type = 'PROCESS_CUSTODY_TERMINAL'
        run_id = $RunId
        baseline_captured_at_utc = $baselineCaptured.UtcDateTime.ToString('o')
        evaluated_at_utc = $evaluatedAt.UtcDateTime.ToString('o')
        runtime_root = $runtime
        run_parent_pid = $RunParentPid
        expected_baseline_sha256 = $ExpectedBaselineSha256
        observed_baseline_sha256 = $observedBaselineSha256
        baseline_result = [string]$baseline.result
        run_parent_identity_match = $parentMatch
        run_parent_identity = $parentSummary
        checker_parent_match = ($checker.parent_process_id -eq $RunParentPid)
        checker_identity = $checkerSummary
        enumeration_succeeded = $true
        classification_succeeded = $true
        identity_cap = $identityCap
        identity_overflow = $false
        baseline_relevant_count = $baselineIdentities.Count
        terminal_relevant_count = $terminalIdentities.Count
        allowed_preexisting_graphify_count = $baselineIdentities.Count
        survivor_count = $survivors.Count
        departed_baseline_count = $departed.Count
        baseline_identity_set_sha256 = $baselineSetHash
        terminal_identity_set_sha256 = Get-SetHash $terminalIdentities
        baseline_relevant_identities = $baselineIdentities
        terminal_relevant_identities = $terminalIdentities
        survivor_identities = $survivors
        departed_baseline_identities = $departed
        result = $result
    }
    Write-AtomicJson $receipt $OutputPath
    if ($result -ne 'PASS') { Write-Error 'New survivor, PID reuse, or run-parent identity change detected'; exit 1 }
    exit 0
} catch {
    $failure = [ordered]@{
        schema_version = '1.0'
        evidence_type = if ($Mode -eq 'CaptureBaseline') { 'PROCESS_CUSTODY_BASELINE' } else { 'PROCESS_CUSTODY_TERMINAL' }
        run_id = $RunId
        recorded_at_utc = [datetime]::UtcNow.ToString('o')
        runtime_root = $runtime
        run_parent_pid = $RunParentPid
        checker_pid = $checkerPid
        enumeration_succeeded = $script:enumerationSucceeded
        classification_succeeded = $script:classificationSucceeded
        identity_cap = $identityCap
        identity_overflow = $script:identityOverflow
        relevant_count = 0
        relevant_identities = @()
        error = $_.Exception.Message
        result = 'FAIL'
    }
    try { Write-AtomicJson $failure $OutputPath } catch {}
    Write-Error $_.Exception.Message
    exit 1
}
