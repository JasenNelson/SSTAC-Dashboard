param(
    [string]$RuntimeRoot,
    [string]$ConfigPath,
    [ValidateSet('Live', 'Fixture')]
    [string]$EvidenceMode = 'Live',
    [string]$TaskQueryOutputPath,
    [string]$TaskXmlOutputPath,
    [ValidateSet('Legacy', 'A', 'D')]
    [string]$ExpectedSchedulerContract = 'Legacy',
    [ValidateSet('Any', 'StagedAwaitingManual', 'StagedManualProven', 'ActiveAwaitingNatural', 'Active0530Correlated', 'Disabled')]
    [string]$ExpectedSchedulerPhase = 'Any',
    [string]$ExpectedStartBoundary,
    [string]$ExpectedRegistrationDate,
    [string]$ExpectedTaskDefinitionId,
    [string]$ProofNotBeforeUtc,
    [string]$ActiveTransitionReceiptPath,
    [string]$ExpectedActiveTransitionReceiptSha256,
    [string]$McpStatusOutputPath,
    [string]$GraphifyVersionOverride,
    [string]$StandingBlockEvidencePath,
    [string]$ActiveLockEvidencePath,
    [int]$CommandTimeoutSeconds = 10
)

# Read-only owner preflight: no fetch, registration, MCP mutation, Ollama call, lock mutation, or repo write.
$ErrorActionPreference = 'Stop'

if ($EvidenceMode -cnotin @('Live', 'Fixture')) {
    throw 'EvidenceMode must be exact and case-sensitive: Live or Fixture'
}
if ($ExpectedSchedulerContract -cnotin @('Legacy', 'A', 'D')) {
    throw 'ExpectedSchedulerContract must be exact and case-sensitive: Legacy, A, or D'
}
if ($ExpectedSchedulerPhase -cnotin @('Any', 'StagedAwaitingManual', 'StagedManualProven', 'ActiveAwaitingNatural', 'Active0530Correlated', 'Disabled')) {
    throw 'ExpectedSchedulerPhase must use an exact documented case-sensitive spelling'
}

$script:Failed = $false
$script:Actions = New-Object System.Collections.Generic.List[string]

function Check([string]$state, [string]$name, [string]$detail, [bool]$required = $false) {
    Write-Output ("{0,-7} {1}: {2}" -f $state, $name, $detail)
    if ($required -and $state -ne 'PASS') { $script:Failed = $true }
}

function Action([string]$text) {
    if (-not $script:Actions.Contains($text)) { [void]$script:Actions.Add($text) }
}

function Exit-PreflightNotReady {
    if ($script:Actions.Count) {
        Write-Output 'NEXT OWNER ACTIONS:'
        $script:Actions | ForEach-Object { Write-Output "- $_" }
    }
    Write-Output 'RESULT NOT_READY'
    exit 1
}

function Get-SchedulerTerminalClassification([string]$Contract, [string]$Phase) {
    $table = @{
        'A/Disabled' = @('READY_FOR_REPLACEMENT_REVIEW', 0)
        'A/StagedAwaitingManual' = @('READY_FOR_MANUAL_RUN_REVIEW', 0)
        'A/StagedManualProven' = @('READY_FOR_TRIGGER_ENABLE_REVIEW', 0)
        'A/ActiveAwaitingNatural' = @('NOT_READY_AWAITING_NATURAL_RUN', 1)
        'A/Active0530Correlated' = @('READY_FOR_OWNER_NATURAL_PROVENANCE_MCP_AND_LOGGED_OUT_GATES', 0)
        'D/Disabled' = @('READY_FOR_DETERMINISTIC_REPLACEMENT_REVIEW', 0)
        'D/StagedAwaitingManual' = @('READY_FOR_DETERMINISTIC_MANUAL_RUN_REVIEW', 0)
        'D/StagedManualProven' = @('READY_FOR_DETERMINISTIC_TRIGGER_ENABLE_REVIEW', 0)
        'D/ActiveAwaitingNatural' = @('NOT_READY_DETERMINISTIC_AWAITING_NATURAL_RUN', 1)
        'D/Active0530Correlated' = @('READY_FOR_OWNER_DETERMINISTIC_NATURAL_PROVENANCE_REVIEW', 0)
    }
    $key = "$Contract/$Phase"
    if (-not $table.ContainsKey($key)) {
        return [pscustomobject][ordered]@{ result = 'NOT_READY'; exit_code = 1 }
    }
    return [pscustomobject][ordered]@{ result = [string]$table[$key][0]; exit_code = [int]$table[$key][1] }
}

function Join-ProcessArguments([string[]]$arguments) {
    $quoted = foreach ($arg in $arguments) {
        if ($null -eq $arg) { '""' }
        elseif ($arg -match '[\s"]') { '"' + ($arg -replace '"', '\"') + '"' }
        else { $arg }
    }
    return ($quoted -join ' ')
}

function Invoke-ReadOnlyStatus([string]$fileName, [string[]]$arguments) {
    try {
        $info = New-Object System.Diagnostics.ProcessStartInfo
        $info.FileName = $fileName
        $info.Arguments = Join-ProcessArguments $arguments
        $info.UseShellExecute = $false
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        $info.CreateNoWindow = $true
        if ($RuntimeRoot) { $info.WorkingDirectory = $RuntimeRoot }
        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $info
        [void]$process.Start()
        $outTask = $process.StandardOutput.ReadToEndAsync()
        $errTask = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit($CommandTimeoutSeconds * 1000)) {
            try { $process.Kill() } catch {}
            $process.WaitForExit()
            return @{ State = 'UNKNOWN'; Text = "timed out after $CommandTimeoutSeconds seconds" }
        }
        [System.Threading.Tasks.Task]::WaitAll(@($outTask, $errTask), 1000)
        return @{ State = 'DONE'; ExitCode = $process.ExitCode; Text = (($outTask.Result + "`n" + $errTask.Result).Trim()) }
    } catch {
        return @{ State = 'UNKNOWN'; Text = $_.Exception.Message }
    }
}

function Invoke-GitReadOnly([string[]]$arguments) {
    $oldOptionalLocks = $env:GIT_OPTIONAL_LOCKS
    try {
        $env:GIT_OPTIONAL_LOCKS = '0'
        return Invoke-ReadOnlyStatus 'git.exe' (@('--no-optional-locks', '-C', $RuntimeRoot) + $arguments)
    } finally {
        if ($null -eq $oldOptionalLocks) { Remove-Item Env:GIT_OPTIONAL_LOCKS -ErrorAction SilentlyContinue }
        else { $env:GIT_OPTIONAL_LOCKS = $oldOptionalLocks }
    }
}

function Get-TrimmedText($status) {
    if ($status -and $status.State -eq 'DONE' -and $status.ExitCode -eq 0 -and $status.Text) {
        return $status.Text.Trim()
    }
    return $null
}

function Status([string]$fixture, [string]$fileName, [string[]]$arguments) {
    if ($fixture) {
        if (Test-Path -LiteralPath $fixture) { return @{ State = 'DONE'; ExitCode = 0; Text = (Get-Content -LiteralPath $fixture -Raw) } }
        return @{ State = 'UNKNOWN'; Text = "fixture missing: $fixture" }
    }
    if (-not (Get-Command $fileName -ErrorAction SilentlyContinue)) { return @{ State = 'UNKNOWN'; Text = "$fileName is unavailable" } }
    return Invoke-ReadOnlyStatus $fileName $arguments
}

function Get-ElementChildren($node) {
    if ($null -eq $node) { return @() }
    return @($node.ChildNodes | Where-Object { $_.NodeType -eq [System.Xml.XmlNodeType]::Element })
}

function Get-NamedChildren($node, [string]$name, [string]$namespaceUri) {
    return @(Get-ElementChildren $node | Where-Object { $_.LocalName -ceq $name -and $_.NamespaceURI -ceq $namespaceUri })
}

function Add-AllowedChildIssues($node, [string[]]$allowed, [string]$namespaceUri, [string]$label, $issues) {
    foreach ($child in @(Get-ElementChildren $node)) {
        if ($child.NamespaceURI -cne $namespaceUri -or $child.LocalName -notin $allowed) {
            [void]$issues.Add("unexpected $label child $($child.LocalName)")
        }
    }
}

function Add-AllowedAttributeIssues($node, [string[]]$allowed, [string]$label, $issues) {
    if ($null -eq $node -or $null -eq $node.Attributes) { return }
    foreach ($attribute in @($node.Attributes)) {
        if ($attribute.NamespaceURI -ceq 'http://www.w3.org/2000/xmlns/') { continue }
        if ($attribute.NamespaceURI -or $attribute.LocalName -notin $allowed) {
            [void]$issues.Add("unexpected $label attribute $($attribute.Name)")
        }
    }
}

function Get-UniqueChild($node, [string]$name, [string]$namespaceUri, [bool]$required, [string]$label, $issues) {
    $matches = @(Get-NamedChildren $node $name $namespaceUri)
    if ($matches.Count -gt 1) {
        [void]$issues.Add("$label cardinality $($matches.Count), expected one")
        return $null
    }
    if ($matches.Count -eq 0) {
        if ($required) { [void]$issues.Add("$label missing") }
        return $null
    }
    return $matches[0]
}

function Get-SemanticText($node, [string]$name, [string]$namespaceUri, [bool]$required, [string]$defaultValue, [bool]$hasDefault, [string]$label, $issues) {
    $child = Get-UniqueChild $node $name $namespaceUri $required $label $issues
    if ($null -eq $child) {
        if ($hasDefault) { return $defaultValue }
        return $null
    }
    return ([string]$child.InnerText).Trim()
}

function Get-SemanticBoolean($node, [string]$name, [string]$namespaceUri, [bool]$required, [bool]$defaultValue, [bool]$hasDefault, [string]$label, $issues) {
    $value = Get-SemanticText $node $name $namespaceUri $required '' $false $label $issues
    if ($null -eq $value) {
        if ($hasDefault) { return $defaultValue }
        return $null
    }
    if ($value -ceq 'true') { return $true }
    if ($value -ceq 'false') { return $false }
    [void]$issues.Add("$label must be true or false")
    return $null
}

function Resolve-AccountSid([string]$account) {
    try {
        if ($account -match '^S-\d(?:-\d+)+$') {
            return (New-Object System.Security.Principal.SecurityIdentifier($account)).Value
        }
        $name = New-Object System.Security.Principal.NTAccount($account)
        return $name.Translate([System.Security.Principal.SecurityIdentifier]).Value
    } catch {
        return $null
    }
}

function Get-TaskField([string]$text, [string]$name, $issues) {
    $matches = [regex]::Matches([string]$text, '(?m)^' + [regex]::Escape($name) + ':\s*(.*?)\s*$')
    if ($matches.Count -ne 1) {
        [void]$issues.Add("verbose field $name cardinality $($matches.Count), expected one")
        return $null
    }
    return $matches[0].Groups[1].Value.Trim()
}

function Get-ExactReceiptValue([string]$text, [string]$label, $issues) {
    $matches = [regex]::Matches($text, '(?m)^' + [regex]::Escape($label) + ':\s*(.*?)\s*$')
    if ($matches.Count -ne 1) {
        [void]$issues.Add("receipt field $label cardinality $($matches.Count), expected one")
        return $null
    }
    return $matches[0].Groups[1].Value.Trim()
}

function Try-GetUtcReceiptTimestamp($value, [ref]$result) {
    if ($value -is [datetime]) {
        if ($value.Kind -ne [System.DateTimeKind]::Utc) { return $false }
        $result.Value = [datetimeoffset]$value
        return $true
    }
    $text = [string]$value
    $parsed = [datetimeoffset]::MinValue
    if ($text -notmatch 'Z$' -or -not [datetimeoffset]::TryParse($text, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::RoundtripKind, [ref]$parsed) -or $parsed.Offset -ne [timespan]::Zero) { return $false }
    $result.Value = $parsed
    return $true
}

function Try-GetFiniteDouble($value, [ref]$result) {
    $parsed = 0.0
    if (-not [double]::TryParse([string]$value, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) { return $false }
    if ([double]::IsNaN($parsed) -or [double]::IsInfinity($parsed)) { return $false }
    $result.Value = $parsed
    return $true
}

function Try-GetFiniteJsonNumber($value, [ref]$result) {
    if ($null -eq $value) { return $false }
    $numericTypes = @(
        [byte], [sbyte], [int16], [uint16], [int32], [uint32], [int64], [uint64],
        [single], [double], [decimal]
    )
    if ($numericTypes -notcontains $value.GetType()) { return $false }
    try { $parsed = [double]$value } catch { return $false }
    if ([double]::IsNaN($parsed) -or [double]::IsInfinity($parsed)) { return $false }
    $result.Value = $parsed
    return $true
}

function Get-CustodySha256Text([string]$Text) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Get-PreflightFileSha256([string]$Path) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash([IO.File]::ReadAllBytes($Path)))).Replace('-', '').ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

function Get-CustodyIdentitySetHash([object[]]$Identities) {
    return (Get-CustodySha256Text ((@($Identities | ForEach-Object { [string]$_.identity_sha256 } | Sort-Object)) -join "`n"))
}

function Get-CustodyNonnegativeInteger([object]$Value, [string]$Name) {
    $integerTypes = @([byte], [sbyte], [int16], [uint16], [int32], [uint32], [int64])
    if ($null -eq $Value -or $integerTypes -notcontains $Value.GetType()) { throw "invalid custody integer type $Name" }
    $parsed = [int64]$Value
    if ($parsed -lt 0 -or $parsed -gt [int]::MaxValue) { throw "invalid custody integer range $Name" }
    return [int]$parsed
}

function Assert-CustodyBoolean([object]$Object, [string]$Name, [bool]$Expected) {
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property -or $property.Value -isnot [bool] -or $property.Value -ne $Expected) {
        throw "invalid custody boolean $Name"
    }
}

function Assert-CustodyIdentity([object]$Identity, [string]$Name, [bool]$RequireGraphifyClass) {
    if ($null -eq $Identity) { throw "missing custody identity $Name" }
    $processId = Get-CustodyNonnegativeInteger $Identity.process_id "$Name.process_id"
    $null = Get-CustodyNonnegativeInteger $Identity.parent_process_id "$Name.parent_process_id"
    if ($processId -le 0 -or [string]::IsNullOrWhiteSpace([string]$Identity.name)) { throw "invalid custody identity $Name" }
    $created = [datetimeoffset]::MinValue
    if (-not (Try-GetUtcReceiptTimestamp $Identity.creation_utc ([ref]$created))) { throw "invalid custody creation time $Name" }
    foreach ($field in @('command_line_sha256', 'executable_path_sha256', 'identity_sha256')) {
        if ([string]$Identity.$field -cnotmatch '^[0-9a-f]{64}$') { throw "invalid custody hash $Name.$field" }
    }
    if ($null -ne $Identity.PSObject.Properties['command_line'] -or $null -ne $Identity.PSObject.Properties['executable_path']) {
        throw "raw custody process field in $Name"
    }
    foreach ($field in @('runtime_reference', 'attributable_descendant')) {
        if ($null -eq $Identity.PSObject.Properties[$field] -or $Identity.$field -isnot [bool]) { throw "invalid custody classification flag $Name.$field" }
    }
    if ($RequireGraphifyClass -and [string]$Identity.process_class -cne 'PREEXISTING_GRAPHIFY_MCP') {
        throw "invalid custody process class $Name"
    }
}

function Assert-TerminalProcessCustody([object]$Custody, [object]$Receipt, [string]$ExpectedRuntimeRoot) {
    if ($null -eq $Custody -or [string]$Custody.schema_version -cne '1.0' -or
        [string]$Custody.evidence_type -cne 'PROCESS_CUSTODY_TERMINAL' -or
        [string]$Custody.result -cne 'PASS' -or [string]$Custody.baseline_result -cne 'PASS') {
        throw 'custody result must be exact terminal PASS'
    }
    foreach ($field in @('enumeration_succeeded', 'classification_succeeded', 'run_parent_identity_match', 'checker_parent_match')) {
        Assert-CustodyBoolean $Custody $field $true
    }
    Assert-CustodyBoolean $Custody 'identity_overflow' $false
    if ([string]$Custody.expected_baseline_sha256 -cnotmatch '^[0-9a-f]{64}$' -or
        [string]$Custody.expected_baseline_sha256 -cne [string]$Custody.observed_baseline_sha256) {
        throw 'custody baseline SHA-256 contradiction'
    }
    $canonicalRunIdPattern = '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    if ([string]$Receipt.run_id -cnotmatch $canonicalRunIdPattern -or
        [string]$Custody.run_id -cnotmatch $canonicalRunIdPattern -or
        [string]$Custody.run_id -cne [string]$Receipt.run_id) {
        throw 'custody run_id binding contradiction'
    }
    try {
        $observedRuntime = [IO.Path]::GetFullPath([string]$Custody.runtime_root).TrimEnd('\', '/')
        $expectedRuntime = [IO.Path]::GetFullPath($ExpectedRuntimeRoot).TrimEnd('\', '/')
    } catch { throw 'custody runtime_root is invalid' }
    if (-not [string]::Equals($observedRuntime, $expectedRuntime, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'custody runtime_root mismatch'
    }
    $started = [datetimeoffset]::MinValue
    $completed = [datetimeoffset]::MinValue
    $baselineCaptured = [datetimeoffset]::MinValue
    $evaluated = [datetimeoffset]::MinValue
    if (-not (Try-GetUtcReceiptTimestamp $Receipt.started_at_utc ([ref]$started)) -or
        -not (Try-GetUtcReceiptTimestamp $Receipt.completed_at_utc ([ref]$completed)) -or
        -not (Try-GetUtcReceiptTimestamp $Custody.baseline_captured_at_utc ([ref]$baselineCaptured)) -or
        -not (Try-GetUtcReceiptTimestamp $Custody.evaluated_at_utc ([ref]$evaluated)) -or
        $started -gt $baselineCaptured -or $baselineCaptured -gt $evaluated -or $evaluated -gt $completed) {
        throw 'custody timestamp ordering contradiction'
    }
    $runParentPid = Get-CustodyNonnegativeInteger $Custody.run_parent_pid 'run_parent_pid'
    Assert-CustodyIdentity $Custody.run_parent_identity 'run_parent_identity' $false
    Assert-CustodyIdentity $Custody.checker_identity 'checker_identity' $false
    if ($runParentPid -le 0 -or [int]$Custody.run_parent_identity.process_id -ne $runParentPid -or
        [int]$Custody.checker_identity.parent_process_id -ne $runParentPid -or
        [int]$Custody.checker_identity.process_id -eq $runParentPid -or
        [string]$Custody.run_parent_identity.name -notmatch '(?i)^(powershell|pwsh)(\.exe)?$' -or
        [string]$Custody.checker_identity.name -notmatch '(?i)^(powershell|pwsh)(\.exe)?$' -or
        $Custody.run_parent_identity.runtime_reference -ne $false -or $Custody.run_parent_identity.attributable_descendant -ne $false -or
        $Custody.checker_identity.runtime_reference -ne $false -or $Custody.checker_identity.attributable_descendant -ne $false) {
        throw 'custody parent/checker identity contradiction'
    }
    $parentCreated = [datetimeoffset]::MinValue
    $checkerCreated = [datetimeoffset]::MinValue
    $null = Try-GetUtcReceiptTimestamp $Custody.run_parent_identity.creation_utc ([ref]$parentCreated)
    $null = Try-GetUtcReceiptTimestamp $Custody.checker_identity.creation_utc ([ref]$checkerCreated)
    if ($parentCreated -gt $started -or $checkerCreated -gt $evaluated) { throw 'custody parent/checker chronology contradiction' }
    foreach ($field in @('baseline_relevant_identities', 'terminal_relevant_identities', 'survivor_identities', 'departed_baseline_identities')) {
        if ($null -eq $Custody.PSObject.Properties[$field]) { throw "custody array $field is missing" }
    }
    $baseline = @($Custody.baseline_relevant_identities)
    $terminal = @($Custody.terminal_relevant_identities)
    $survivors = @($Custody.survivor_identities)
    $departed = @($Custody.departed_baseline_identities)
    foreach ($item in $baseline) { Assert-CustodyIdentity $item 'baseline_identity' $true }
    foreach ($item in $terminal) { Assert-CustodyIdentity $item 'terminal_identity' $true }
    foreach ($item in $departed) { Assert-CustodyIdentity $item 'departed_identity' $true }
    foreach ($item in @($baseline + $terminal + $departed)) {
        if ($item.runtime_reference -ne $true -or $item.attributable_descendant -ne $false) { throw 'custody Graphify classification contradiction' }
    }
    foreach ($item in $baseline) {
        $created = [datetimeoffset]::MinValue; $null = Try-GetUtcReceiptTimestamp $item.creation_utc ([ref]$created)
        if ($created -gt $baselineCaptured) { throw 'baseline identity postdates capture' }
    }
    foreach ($item in $departed) {
        $created = [datetimeoffset]::MinValue; $null = Try-GetUtcReceiptTimestamp $item.creation_utc ([ref]$created)
        if ($created -gt $baselineCaptured) { throw 'departed identity postdates capture' }
    }
    foreach ($item in $terminal) {
        $created = [datetimeoffset]::MinValue; $null = Try-GetUtcReceiptTimestamp $item.creation_utc ([ref]$created)
        if ($created -gt $evaluated) { throw 'terminal identity postdates evaluation' }
    }
    $cap = Get-CustodyNonnegativeInteger $Custody.identity_cap 'identity_cap'
    $baselineCount = Get-CustodyNonnegativeInteger $Custody.baseline_relevant_count 'baseline_relevant_count'
    $terminalCount = Get-CustodyNonnegativeInteger $Custody.terminal_relevant_count 'terminal_relevant_count'
    $allowedCount = Get-CustodyNonnegativeInteger $Custody.allowed_preexisting_graphify_count 'allowed_preexisting_graphify_count'
    $survivorCount = Get-CustodyNonnegativeInteger $Custody.survivor_count 'survivor_count'
    $departedCount = Get-CustodyNonnegativeInteger $Custody.departed_baseline_count 'departed_baseline_count'
    if ($cap -ne 16 -or $baselineCount -gt $cap -or $terminalCount -gt $cap -or
        $baselineCount -ne $baseline.Count -or $terminalCount -ne $terminal.Count -or
        $allowedCount -ne $baselineCount -or $survivorCount -ne 0 -or $survivors.Count -ne 0 -or
        $departedCount -ne $departed.Count -or $terminalCount + $departedCount -ne $baselineCount) {
        throw 'custody count/array contradiction'
    }
    $baselineHashes = @($baseline | ForEach-Object { [string]$_.identity_sha256 })
    $terminalHashes = @($terminal | ForEach-Object { [string]$_.identity_sha256 })
    $departedHashes = @($departed | ForEach-Object { [string]$_.identity_sha256 })
    foreach ($hashes in @($baselineHashes, $terminalHashes, $departedHashes)) {
        if ($hashes.Count -ne @($hashes | Select-Object -Unique).Count) { throw 'custody duplicate identity hash' }
    }
    if (@($terminalHashes | Where-Object { $baselineHashes -notcontains $_ }).Count -ne 0 -or
        @($departedHashes | Where-Object { $baselineHashes -notcontains $_ }).Count -ne 0 -or
        @($baselineHashes | Where-Object { $terminalHashes -notcontains $_ -and $departedHashes -notcontains $_ }).Count -ne 0 -or
        [string]$Custody.baseline_identity_set_sha256 -cne (Get-CustodyIdentitySetHash $baseline) -or
        [string]$Custody.terminal_identity_set_sha256 -cne (Get-CustodyIdentitySetHash $terminal)) {
        throw 'custody identity-set contradiction'
    }
}

function Get-FlatJsonStringField([string]$json, [string]$name, $issues) {
    $pattern = '"' + [regex]::Escape($name) + '"\s*:\s*"((?:\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})|[^"\\])*)"'
    $matches = [regex]::Matches($json, $pattern)
    if ($matches.Count -ne 1) {
        [void]$issues.Add("transition field $name must be exactly one JSON string")
        return $null
    }
    try { return [regex]::Unescape($matches[0].Groups[1].Value) }
    catch { [void]$issues.Add("transition field $name contains invalid escaping"); return $null }
}

function Get-PreflightTextSha256([string]$Text) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function New-ExactPathEvidenceError([string]$LiteralPath, [string]$Diagnostic) {
    $bounded = ([string]$Diagnostic -replace '[\r\n\t]+', ' ').Trim()
    $bounded = -join @($bounded.ToCharArray() | ForEach-Object { if ([int]$_ -le 127) { $_ } else { '?' } })
    if ([string]::IsNullOrWhiteSpace($bounded)) { $bounded = 'exact-path evidence read failed' }
    if ($bounded.Length -gt 512) { $bounded = $bounded.Substring(0, 512) }
    return [pscustomobject][ordered]@{
        schema_version = '1.0'
        evidence_type = 'EXACT_PATH_PRESENCE'
        path = $LiteralPath
        status = 'ERROR'
        present = $null
        error = $bounded
    }
}

function Get-ExactPathEvidence([string]$LiteralPath) {
    try { $canonicalPath = [IO.Path]::GetFullPath($LiteralPath) }
    catch { return New-ExactPathEvidenceError -LiteralPath ([string]$LiteralPath) -Diagnostic "invalid literal path: $($_.Exception.Message)" }
    $readErrors = @()
    try {
        $successValues = @(Test-Path -LiteralPath $canonicalPath -ErrorAction Stop -ErrorVariable +readErrors)
    } catch {
        $readErrors = @($readErrors) + $_
        $successValues = @()
    }
    if (@($readErrors).Count -ne 0) {
        return New-ExactPathEvidenceError -LiteralPath $canonicalPath -Diagnostic ([string]@($readErrors)[0])
    }
    if ($successValues.Count -ne 1 -or $successValues[0] -isnot [bool]) {
        return New-ExactPathEvidenceError -LiteralPath $canonicalPath -Diagnostic "exact-path Test-Path returned $($successValues.Count) success values; expected one boolean"
    }
    return [pscustomobject][ordered]@{
        schema_version = '1.0'
        evidence_type = 'EXACT_PATH_PRESENCE'
        path = $canonicalPath
        status = 'PASS'
        present = [bool]$successValues[0]
        error = $null
    }
}

function Test-ExactPathEvidence(
    $Evidence,
    [string]$ExpectedPath,
    [string]$ExpectedJson,
    [string]$ExpectedSha256
) {
    if ($null -eq $Evidence -or $Evidence -is [array]) { return $false }
    $expectedProperties = @('schema_version', 'evidence_type', 'path', 'status', 'present', 'error')
    $actualProperties = @($Evidence.PSObject.Properties.Name)
    if ($actualProperties.Count -ne $expectedProperties.Count) { return $false }
    for ($index = 0; $index -lt $expectedProperties.Count; $index++) {
        if ($actualProperties[$index] -cne $expectedProperties[$index]) { return $false }
    }
    try { $canonicalPath = [IO.Path]::GetFullPath($ExpectedPath) } catch { return $false }
    if ([string]$Evidence.schema_version -cne '1.0' -or
        [string]$Evidence.evidence_type -cne 'EXACT_PATH_PRESENCE' -or
        -not [string]::Equals([string]$Evidence.path, $canonicalPath, [StringComparison]::OrdinalIgnoreCase) -or
        $Evidence.status -isnot [string]) { return $false }
    if ([string]$Evidence.status -ceq 'PASS') {
        if ($Evidence.present -isnot [bool] -or $null -ne $Evidence.error) { return $false }
    } elseif ([string]$Evidence.status -ceq 'ERROR') {
        if ($null -ne $Evidence.present -or $Evidence.error -isnot [string] -or
            [string]::IsNullOrWhiteSpace([string]$Evidence.error) -or ([string]$Evidence.error).Length -gt 512) { return $false }
    } else { return $false }
    $json = $Evidence | ConvertTo-Json -Compress -Depth 4
    if (@($json.ToCharArray() | Where-Object { [int]$_ -gt 127 }).Count -ne 0) { return $false }
    if ($json -cne $ExpectedJson -or (Get-PreflightTextSha256 $json) -cne $ExpectedSha256) { return $false }
    try {
        $roundTrip = $json | ConvertFrom-Json
        if (($roundTrip | ConvertTo-Json -Compress -Depth 4) -cne $json) { return $false }
    } catch { return $false }
    return $true
}

function Get-FreshExactPathEvidenceBinding(
    [string]$LiteralPath,
    $InitialEvidence,
    [string]$InitialJson,
    [string]$InitialSha256
) {
    $freshEvidence = Get-ExactPathEvidence -LiteralPath $LiteralPath
    $freshJson = $freshEvidence | ConvertTo-Json -Compress -Depth 4
    $freshSha256 = Get-PreflightTextSha256 $freshJson
    $freshEnvelopeValid = Test-ExactPathEvidence $freshEvidence $LiteralPath $freshJson $freshSha256
    $statusMatches = ([string]$freshEvidence.status -ceq [string]$InitialEvidence.status)
    $presenceMatches = [object]::Equals($freshEvidence.present, $InitialEvidence.present)
    $matchesInitial = (
        $freshJson -ceq $InitialJson -and
        $freshSha256 -ceq $InitialSha256 -and
        $statusMatches -and
        $presenceMatches
    )
    return [pscustomobject][ordered]@{
        evidence = $freshEvidence
        canonical_json = $freshJson
        sha256 = $freshSha256
        envelope_valid = [bool]$freshEnvelopeValid
        status_matches = [bool]$statusMatches
        presence_matches = [bool]$presenceMatches
        matches_initial = [bool]$matchesInitial
        binding_valid = [bool]($freshEnvelopeValid -and $matchesInitial)
    }
}

function Resolve-ContainedFixturePath(
    [string]$Candidate,
    [string]$ContainmentRoot,
    [bool]$RequireExisting,
    [bool]$RequireDirectory
) {
    if ([string]::IsNullOrWhiteSpace($Candidate)) { throw 'fixture path is missing' }
    $colonSearchStart = 0
    if ($Candidate.Length -ge 2 -and $Candidate[1] -eq ':' -and [char]::IsLetter($Candidate[0])) {
        $colonSearchStart = 2
    }
    if ($Candidate.IndexOf(':', $colonSearchStart) -ge 0) {
        throw 'fixture path contains an alternate data stream'
    }
    $full = [IO.Path]::GetFullPath($Candidate)
    $prefix = $ContainmentRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "fixture path escapes evidence root: $Candidate" }
    $probe = $full
    if (-not $RequireExisting) {
        try {
            $item = Get-Item -LiteralPath $full -Force -ErrorAction Stop
        } catch [System.Management.Automation.ItemNotFoundException] {
            $probe = Split-Path -Parent $full
            if ([string]::IsNullOrWhiteSpace($probe)) { throw "fixture path has no parent: $Candidate" }
            $item = Get-Item -LiteralPath $probe -Force -ErrorAction Stop
        }
    } else {
        $item = Get-Item -LiteralPath $full -Force -ErrorAction Stop
    }
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "fixture path crosses a reparse point: $($item.FullName)"
    }
    if ($RequireExisting) {
        if ($RequireDirectory -and -not $item.PSIsContainer) { throw "fixture directory is not a directory: $Candidate" }
        if (-not $RequireDirectory -and $item.PSIsContainer) { throw "fixture file is not a file: $Candidate" }
    } elseif ($probe -ceq $full) {
        if ($RequireDirectory -and -not $item.PSIsContainer) { throw "fixture directory is not a directory: $Candidate" }
        if (-not $RequireDirectory -and $item.PSIsContainer) { throw "fixture file is not a file: $Candidate" }
    } elseif (-not $item.PSIsContainer) { throw "fixture parent is not a directory: $Candidate" }
    $cursorPath = $probe
    $reachedContainmentRoot = $false
    while (-not [string]::IsNullOrWhiteSpace($cursorPath)) {
        $cursorItem = Get-Item -LiteralPath $cursorPath -Force -ErrorAction Stop
        if (($cursorItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "fixture path crosses a reparse point: $cursorPath"
        }
        if ([string]::Equals($cursorPath.TrimEnd('\', '/'), $ContainmentRoot.TrimEnd('\', '/'), [StringComparison]::OrdinalIgnoreCase)) {
            $reachedContainmentRoot = $true
            break
        }
        $parentPath = Split-Path -Parent $cursorPath
        if ([string]::IsNullOrWhiteSpace($parentPath) -or [string]::Equals($parentPath, $cursorPath, [StringComparison]::OrdinalIgnoreCase)) {
            break
        }
        $cursorPath = $parentPath
    }
    if (-not $reachedContainmentRoot) { throw "fixture path ancestor chain does not reach containment root: $Candidate" }
    return $full
}

function Resolve-OrdinaryFixtureEvidenceRoot([string]$Candidate) {
    if ([string]::IsNullOrWhiteSpace($Candidate)) { throw 'SSTAC_WIKI_EXECUTOR_EVIDENCE_ROOT is required' }
    $colonSearchStart = 0
    if ($Candidate.Length -ge 2 -and $Candidate[1] -eq ':' -and [char]::IsLetter($Candidate[0])) {
        $colonSearchStart = 2
    }
    if ($Candidate.IndexOf(':', $colonSearchStart) -ge 0) {
        throw 'fixture evidence root contains an alternate data stream'
    }
    $full = [IO.Path]::GetFullPath($Candidate).TrimEnd('\', '/')
    $projectsRoot = [IO.Path]::GetFullPath('C:\Projects').TrimEnd('\', '/')
    $projectsPrefix = $projectsRoot + [IO.Path]::DirectorySeparatorChar
    if ([string]::Equals($full, $projectsRoot, [StringComparison]::OrdinalIgnoreCase) -or
        $full.StartsWith($projectsPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'fixture evidence root must not be a project or runtime root'
    }
    $cursor = $full
    while (-not [string]::IsNullOrWhiteSpace($cursor)) {
        $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
        if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "fixture evidence root ancestor is not an ordinary directory: $cursor"
        }
        $parent = Split-Path -Parent $cursor
        if ([string]::IsNullOrWhiteSpace($parent) -or [string]::Equals($parent, $cursor, [StringComparison]::OrdinalIgnoreCase)) { break }
        $cursor = $parent
    }
    $resolved = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $full -ErrorAction Stop).Path).TrimEnd('\', '/')
    if ([string]::Equals($resolved, $projectsRoot, [StringComparison]::OrdinalIgnoreCase) -or
        $resolved.StartsWith($projectsPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'resolved fixture evidence root must not be a project or runtime root'
    }
    return $resolved
}

function Move-PastJsonWhitespace([string]$Json, [ref]$Index) {
    while ($Index.Value -lt $Json.Length -and [char]::IsWhiteSpace($Json[$Index.Value])) {
        $Index.Value++
    }
}

function Get-JsonStringTokenEnd([string]$Json, [int]$StartIndex) {
    if ($StartIndex -ge $Json.Length -or $Json[$StartIndex] -ne '"') {
        throw 'JSON string token is missing'
    }
    $index = $StartIndex + 1
    while ($index -lt $Json.Length) {
        $character = $Json[$index]
        if ([int]$character -lt 0x20) { throw 'JSON string contains a control character' }
        if ($character -eq '\') {
            $index += 2
            continue
        }
        if ($character -eq '"') { return ($index + 1) }
        $index++
    }
    throw 'JSON string token is unterminated'
}

function Get-JsonValueEnd([string]$Json, [int]$StartIndex) {
    $index = $StartIndex
    Move-PastJsonWhitespace $Json ([ref]$index)
    if ($index -ge $Json.Length) { throw 'JSON value is missing' }
    $first = $Json[$index]
    if ($first -eq '"') { return (Get-JsonStringTokenEnd $Json $index) }
    if ($first -eq '{' -or $first -eq '[') {
        $closers = New-Object 'System.Collections.Generic.Stack[char]'
        $closers.Push($(if ($first -eq '{') { '}' } else { ']' }))
        $index++
        while ($index -lt $Json.Length) {
            $character = $Json[$index]
            if ($character -eq '"') {
                $index = Get-JsonStringTokenEnd $Json $index
                continue
            }
            if ($character -eq '{') { $closers.Push('}'); $index++; continue }
            if ($character -eq '[') { $closers.Push(']'); $index++; continue }
            if ($character -eq '}' -or $character -eq ']') {
                if ($closers.Count -eq 0 -or $closers.Pop() -ne $character) {
                    throw 'JSON nested delimiter mismatch'
                }
                $index++
                if ($closers.Count -eq 0) { return $index }
                continue
            }
            $index++
        }
        throw 'JSON nested value is unterminated'
    }
    $primitiveStart = $index
    while ($index -lt $Json.Length -and
        $Json[$index] -ne ',' -and $Json[$index] -ne '}' -and $Json[$index] -ne ']' -and
        -not [char]::IsWhiteSpace($Json[$index])) {
        $index++
    }
    if ($index -eq $primitiveStart) { throw 'JSON primitive value is missing' }
    return $index
}

function Get-JsonObjectMembers([string]$Json) {
    $index = 0
    Move-PastJsonWhitespace $Json ([ref]$index)
    if ($index -ge $Json.Length -or $Json[$index] -ne '{') { throw 'JSON value must be an object' }
    $index++
    $members = New-Object System.Collections.Generic.List[object]
    while ($true) {
        Move-PastJsonWhitespace $Json ([ref]$index)
        if ($index -ge $Json.Length) { throw 'JSON object is unterminated' }
        if ($Json[$index] -eq '}') {
            $index++
            Move-PastJsonWhitespace $Json ([ref]$index)
            if ($index -ne $Json.Length) { throw 'JSON object has trailing data' }
            return $members.ToArray()
        }
        $nameStart = $index
        $nameEnd = Get-JsonStringTokenEnd $Json $nameStart
        $rawName = $Json.Substring($nameStart, $nameEnd - $nameStart)
        try { $name = $rawName | ConvertFrom-Json } catch { throw 'JSON property name is invalid' }
        if ($name -isnot [string]) { throw 'JSON property name is not a string' }
        $index = $nameEnd
        Move-PastJsonWhitespace $Json ([ref]$index)
        if ($index -ge $Json.Length -or $Json[$index] -ne ':') { throw 'JSON property separator is missing' }
        $index++
        Move-PastJsonWhitespace $Json ([ref]$index)
        $valueStart = $index
        $valueEnd = Get-JsonValueEnd $Json $valueStart
        [void]$members.Add([pscustomobject][ordered]@{
            Name = [string]$name
            RawValue = $Json.Substring($valueStart, $valueEnd - $valueStart)
        })
        $index = $valueEnd
        Move-PastJsonWhitespace $Json ([ref]$index)
        if ($index -ge $Json.Length) { throw 'JSON object is unterminated' }
        if ($Json[$index] -eq ',') { $index++; continue }
        if ($Json[$index] -eq '}') { continue }
        throw 'JSON object delimiter is invalid'
    }
}

function Test-TerminalReceiptRawSchema([string]$RawJson, [ref]$Diagnostic) {
    try {
        $expectedTop = @(
            'schema_version', 'run_id', 'task_definition_id', 'started_at_utc',
            'completed_at_utc', 'duration_seconds', 'terminal_state', 'native_exit_code',
            'n0_orphan', 'n1_build', 'n2_cluster', 'n5_mode', 'n5_skip_labeling',
            'n5_skip_semantic', 'n5_run_label', 'n5_run_semantic',
            'n5_lock_expiry_minutes', 'n5_mutation_attempted',
            'semantic_execution_attempted', 'n5_release_required', 'n5_semantic',
            'n6_wiki', 'n6_publication', 'serve_gate', 'final_canonicalization',
            'final_graph_smoke', 'semantic_evidence', 'n5_post_mutation_scan',
            'n5_release', 'served_graph_sha256', 'required_ref', 'head_oid',
            'required_ref_oid', 'build_stamp_oid', 'terminal_process_custody',
            'terminal_process_custody_evidence', 'autofollow_starting_head',
            'autofollow_fetched_oid', 'autofollow_decision', 'autofollow_attempted',
            'autofollow_result', 'autofollow_final_head', 'autofollow_rejection_reason'
        )
        $top = @(Get-JsonObjectMembers $RawJson)
        if ($top.Count -ne $expectedTop.Count) {
            throw "terminal top-level property count $($top.Count), expected $($expectedTop.Count)"
        }
        for ($index = 0; $index -lt $expectedTop.Count; $index++) {
            if ($top[$index].Name -cne $expectedTop[$index]) {
                throw "terminal top-level property $index is $($top[$index].Name), expected $($expectedTop[$index])"
            }
        }
        $expectedScan = @('status', 'mutation_attempted', 'exit_code', 'error')
        $scan = @(Get-JsonObjectMembers ([string]$top[27].RawValue))
        if ($scan.Count -ne $expectedScan.Count) {
            throw "post-mutation scan property count $($scan.Count), expected $($expectedScan.Count)"
        }
        for ($index = 0; $index -lt $expectedScan.Count; $index++) {
            if ($scan[$index].Name -cne $expectedScan[$index]) {
                throw "post-mutation scan property $index is $($scan[$index].Name), expected $($expectedScan[$index])"
            }
        }
        $expectedRelease = @('required', 'status', 'selected_mode', 'observed', 'error', 'GraphOrphanRisk')
        $release = @(Get-JsonObjectMembers ([string]$top[28].RawValue))
        if ($release.Count -ne $expectedRelease.Count) {
            throw "release property count $($release.Count), expected $($expectedRelease.Count)"
        }
        for ($index = 0; $index -lt $expectedRelease.Count; $index++) {
            if ($release[$index].Name -cne $expectedRelease[$index]) {
                throw "release property $index is $($release[$index].Name), expected $($expectedRelease[$index])"
            }
        }
        $Diagnostic.Value = ''
        return $true
    } catch {
        $Diagnostic.Value = $_.Exception.Message
        return $false
    }
}

$fixtureParameterNames = @(
    'ConfigPath', 'TaskQueryOutputPath', 'TaskXmlOutputPath', 'McpStatusOutputPath',
    'GraphifyVersionOverride', 'StandingBlockEvidencePath', 'ActiveLockEvidencePath'
)
if ($EvidenceMode -ceq 'Live') {
    $suppliedOverrides = @($fixtureParameterNames | Where-Object { $PSBoundParameters.ContainsKey($_) })
    if ($suppliedOverrides.Count -ne 0) {
        Check FAIL 'evidence-mode' ("Live rejects fixture/override parameters: " + ($suppliedOverrides -join ', ')) $true
        Action 'Remove all fixture and override parameters for Live admission.'
        Exit-PreflightNotReady
    }
    $StandingBlockEvidencePath = 'C:\Projects\OLLAMA_STANDING_BLOCK_SSTAC_WIKI.md'
    $ActiveLockEvidencePath = 'C:\Projects\OLLAMA_ACTIVE.lock'
} else {
    $requiredFixtureParameters = @(
        'RuntimeRoot', 'TaskQueryOutputPath', 'TaskXmlOutputPath', 'McpStatusOutputPath',
        'GraphifyVersionOverride', 'StandingBlockEvidencePath', 'ActiveLockEvidencePath'
    )
    $missingFixtureParameters = @($requiredFixtureParameters | Where-Object {
        -not $PSBoundParameters.ContainsKey($_) -or [string]::IsNullOrWhiteSpace([string](Get-Variable -Name $_ -ValueOnly))
    })
    if ($PSBoundParameters.ContainsKey('ConfigPath')) { $missingFixtureParameters += 'ConfigPath is not accepted in Fixture mode' }
    try {
        if ($missingFixtureParameters.Count -ne 0) { throw ("Fixture requires the complete tuple: " + ($missingFixtureParameters -join ', ')) }
        $evidenceRootRaw = [string]$env:SSTAC_WIKI_EXECUTOR_EVIDENCE_ROOT
        if ([string]::IsNullOrWhiteSpace($evidenceRootRaw)) { throw 'SSTAC_WIKI_EXECUTOR_EVIDENCE_ROOT is required' }
        $evidenceRoot = Resolve-OrdinaryFixtureEvidenceRoot $evidenceRootRaw
        $RuntimeRoot = Resolve-ContainedFixturePath $RuntimeRoot $evidenceRoot $true $true
        $activeFixturePhase = $ExpectedSchedulerPhase -in @('ActiveAwaitingNatural', 'Active0530Correlated')
        $transitionPathBound = $PSBoundParameters.ContainsKey('ActiveTransitionReceiptPath')
        $transitionHashBound = $PSBoundParameters.ContainsKey('ExpectedActiveTransitionReceiptSha256')
        $transitionPathSupplied = $transitionPathBound -and -not [string]::IsNullOrWhiteSpace($ActiveTransitionReceiptPath)
        $transitionHashSupplied = $transitionHashBound -and -not [string]::IsNullOrWhiteSpace($ExpectedActiveTransitionReceiptSha256)
        if ($activeFixturePhase) {
            if (-not $transitionPathSupplied -or -not $transitionHashSupplied) {
                throw 'Fixture active phases require ActiveTransitionReceiptPath and ExpectedActiveTransitionReceiptSha256 as one complete pair'
            }
            if ($ExpectedActiveTransitionReceiptSha256 -cnotmatch '^[0-9a-f]{64}$') {
                throw 'ExpectedActiveTransitionReceiptSha256 must be exact lowercase SHA-256'
            }
            $ActiveTransitionReceiptPath = Resolve-ContainedFixturePath $ActiveTransitionReceiptPath $RuntimeRoot $true $false
        } elseif ($transitionPathBound -or $transitionHashBound) {
            throw 'Fixture non-active phases reject active transition receipt parameters'
        }
        foreach ($name in @('TaskQueryOutputPath', 'TaskXmlOutputPath', 'McpStatusOutputPath')) {
            Set-Variable -Name $name -Value (Resolve-ContainedFixturePath ([string](Get-Variable -Name $name -ValueOnly)) $RuntimeRoot $true $false)
        }
        foreach ($name in @('StandingBlockEvidencePath', 'ActiveLockEvidencePath')) {
            Set-Variable -Name $name -Value (Resolve-ContainedFixturePath ([string](Get-Variable -Name $name -ValueOnly)) $RuntimeRoot $false $false)
        }
        $ConfigPath = Resolve-ContainedFixturePath (Join-Path $RuntimeRoot 'tooling\wiki\wiki_nightly_config.json') $RuntimeRoot $true $false
    } catch {
        Check FAIL 'evidence-mode' $_.Exception.Message $true
        Action 'Provide one complete ordinary Fixture tree below the exact executor evidence root.'
        Exit-PreflightNotReady
    }
    Check PASS 'evidence-mode' 'Fixture tuple is complete and contained' $true
}

if (-not $RuntimeRoot) { $RuntimeRoot = $env:SSTAC_WIKI_RUNTIME_ROOT }
if (-not $RuntimeRoot) { $RuntimeRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
try {
    $RuntimeRoot = (Resolve-Path -LiteralPath $RuntimeRoot).Path
} catch {
    Check FAIL 'runtime-root' "unavailable: $RuntimeRoot" $true
    Action 'Select an existing canonical runtime root and rerun.'
    Exit-PreflightNotReady
}
Check PASS 'runtime-root' $RuntimeRoot $true

if (-not $ConfigPath) { $ConfigPath = Join-Path $RuntimeRoot 'tooling\wiki\wiki_nightly_config.json' }
$config = $null
try {
    $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    if (-not $config.serve_gate.remote -or -not $config.serve_gate.branch) { throw 'serve_gate remote/branch missing' }
    $freshnessMaxAgeHours = 48.0
    if ($ExpectedSchedulerContract -in @('A', 'D')) {
        if (-not (Try-GetFiniteJsonNumber $config.freshness_max_age_hours ([ref]$freshnessMaxAgeHours)) -or $freshnessMaxAgeHours -le 0) { throw 'freshness_max_age_hours must be a finite positive JSON number for contract A or D' }
    } elseif ($null -ne $config.freshness_max_age_hours) {
        $candidateFreshness = 0.0
        if ((Try-GetFiniteDouble $config.freshness_max_age_hours ([ref]$candidateFreshness)) -and $candidateFreshness -gt 0) { $freshnessMaxAgeHours = $candidateFreshness }
    }
    $requiredRef = "refs/remotes/$($config.serve_gate.remote)/$($config.serve_gate.branch)"
    Check PASS 'serve-config' $requiredRef $true
} catch {
    $config = $null
    Check FAIL 'serve-config' "invalid or missing: $ConfigPath" $true
    Action 'Restore the configured serve gate.'
}

$dirtyStatus = Invoke-GitReadOnly @('status', '--porcelain', '--untracked-files=no')
if ($dirtyStatus.State -eq 'DONE' -and $dirtyStatus.ExitCode -eq 0 -and -not $dirtyStatus.Text) {
    Check PASS 'tracked-tree' 'clean' $true
} else {
    Check FAIL 'tracked-tree' 'tracked changes or git unavailable' $true
    Action 'Use a clean runtime worktree.'
}

$python = Join-Path $RuntimeRoot '.venv-graphify\Scripts\python.exe'
if ($GraphifyVersionOverride) {
    $version = $GraphifyVersionOverride
} elseif (Test-Path -LiteralPath $python) {
    $versionStatus = Invoke-ReadOnlyStatus $python @('-c', "import importlib.metadata as m; print(m.version('graphifyy'))")
    $version = Get-TrimmedText $versionStatus
} else {
    $version = $null
}
if ($version -and $version.Trim() -eq '0.9.17') {
    Check PASS 'graphify-version' '0.9.17' $true
} else {
    $versionText = if ($version) { $version.Trim() } else { 'unavailable' }
    Check FAIL 'graphify-version' "expected 0.9.17, got $versionText" $true
    Action 'Provision the pinned graphify virtual environment.'
}

function Get-RuntimeRootEncodingHits([string]$CandidateId, [string]$ExpectedRoot) {
    if ($null -eq $CandidateId) { return @() }
    $normalizedRoot = (($ExpectedRoot -replace '\\', '/') -replace '/+', '/').TrimEnd('/').ToLowerInvariant()
    $normalizedId = (($CandidateId -replace '\\', '/') -replace '/+', '/').ToLowerInvariant()
    $sluggedRoot = ([regex]::Replace($normalizedRoot, '[^a-z0-9]+', '_')).Trim('_')
    $hits = New-Object System.Collections.Generic.List[string]
    $literalPattern = '(?<![a-z0-9])' + [regex]::Escape($normalizedRoot) + '(?=$|[/\\:#@|])'
    if ($normalizedRoot -and $normalizedId -match $literalPattern) {
        [void]$hits.Add('normalized')
    }
    if ($CandidateId -cmatch '^[A-Za-z0-9_]+$' -and $sluggedRoot) {
        $slugPattern = '(?:^|_)' + [regex]::Escape($sluggedRoot) + '(?:_|$)'
        if ($CandidateId.ToLowerInvariant() -match $slugPattern) {
            [void]$hits.Add('slugged')
        }
    }
    return @($hits)
}

$servedGraphSha256 = $null
try {
    $servedGraphPath = Join-Path $RuntimeRoot 'wiki\.graph\graph.json'
    if ($EvidenceMode -ceq 'Fixture') {
        $servedGraphPath = Resolve-ContainedFixturePath $servedGraphPath $RuntimeRoot $true $false
    }
    $servedGraphBytes = [IO.File]::ReadAllBytes($servedGraphPath)
    $servedGraphHasher = [Security.Cryptography.SHA256]::Create()
    try { $servedGraphSha256 = ([BitConverter]::ToString($servedGraphHasher.ComputeHash($servedGraphBytes))).Replace('-', '').ToLowerInvariant() }
    finally { $servedGraphHasher.Dispose() }
    $servedGraphText = ([Text.Encoding]::UTF8.GetString($servedGraphBytes)).TrimStart([char]0xFEFF)
    $graph = $servedGraphText | ConvertFrom-Json
    $nodes = @($graph.nodes)
    $links = @($graph.links)
    $nodeCount = $nodes.Count
    $linkCount = $links.Count
    if ($nodeCount -lt 1 -or $linkCount -lt 1) { throw 'nodes/links missing or empty' }

    $provenPhase = $ExpectedSchedulerContract -in @('A', 'D') -and $ExpectedSchedulerPhase -in @('StagedManualProven', 'Active0530Correlated')
    $graphIssues = New-Object System.Collections.Generic.List[string]
    $nodeIds = New-Object System.Collections.Generic.List[string]
    $communityIds = @{}
    $communityPresentCount = 0
    $invalidCommunityCount = 0
    foreach ($node in $nodes) {
        $nodeId = [string]$node.id
        if ([string]::IsNullOrWhiteSpace($nodeId)) {
            [void]$graphIssues.Add('node id missing')
            continue
        }
        [void]$nodeIds.Add($nodeId)
        $communityValue = $node.PSObject.Properties['community']
        if ($null -ne $communityValue -and $null -ne $communityValue.Value) {
            $communityPresentCount++
            try {
                $community = Get-CustodyNonnegativeInteger $communityValue.Value 'community'
                $communityIds[[string]$community] = $true
            } catch {
                $invalidCommunityCount++
            }
        }
    }
    if ($invalidCommunityCount -gt 0) {
        [void]$graphIssues.Add("$invalidCommunityCount community value(s) must be non-negative integers")
    }
    if ($communityPresentCount -gt 0 -and $communityPresentCount -ne $nodeCount) {
        [void]$graphIssues.Add('community population must be all-or-none')
    }
    if ($provenPhase -and $communityPresentCount -ne $nodeCount) {
        [void]$graphIssues.Add('proven manual/nightly graph requires every node community')
    }
    if ($provenPhase -and $communityIds.Count -lt 1) {
        [void]$graphIssues.Add('at least one populated community is required')
    }

    $uniqueNodeIds = @($nodeIds | Sort-Object -Unique)
    if ($uniqueNodeIds.Count -ne $nodeIds.Count) {
        [void]$graphIssues.Add('node IDs must be unique')
    }
    $declared = @{}
    foreach ($nodeId in $uniqueNodeIds) { $declared[$nodeId] = $true }

    $endpoints = New-Object System.Collections.Generic.List[string]
    $undeclaredCount = 0
    $missingEndpointCount = 0
    foreach ($link in $links) {
        foreach ($endpoint in @([string]$link.source, [string]$link.target)) {
            if ([string]::IsNullOrWhiteSpace($endpoint)) {
                $missingEndpointCount++
            } else {
                [void]$endpoints.Add($endpoint)
                if (-not $declared.ContainsKey($endpoint)) { $undeclaredCount++ }
            }
        }
    }
    $hyperedgesProperty = $graph.PSObject.Properties['hyperedges']
    if ($null -ne $hyperedgesProperty) {
        if ($null -eq $hyperedgesProperty.Value -or $hyperedgesProperty.Value -isnot [System.Array]) {
            [void]$graphIssues.Add('hyperedges must be an array when present')
        } else {
            $hyperedgeIndex = 0
            foreach ($hyperedge in @($hyperedgesProperty.Value)) {
                if ($null -eq $hyperedge -or $hyperedge -isnot [pscustomobject]) {
                    [void]$graphIssues.Add("hyperedge $hyperedgeIndex must be an object")
                    $hyperedgeIndex++
                    continue
                }
                if ($null -ne $hyperedge.PSObject.Properties['members'] -or $null -ne $hyperedge.PSObject.Properties['node_ids']) {
                    [void]$graphIssues.Add("hyperedge $hyperedgeIndex uses a noncanonical member alias")
                }
                $membersProperty = $hyperedge.PSObject.Properties['nodes']
                if ($null -eq $membersProperty -or $null -eq $membersProperty.Value -or $membersProperty.Value -isnot [System.Array] -or @($membersProperty.Value).Count -eq 0) {
                    [void]$graphIssues.Add("hyperedge $hyperedgeIndex must have a nonempty nodes array")
                } else {
                    $memberIndex = 0
                    foreach ($memberValue in @($membersProperty.Value)) {
                        if ($memberValue -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$memberValue)) {
                            [void]$graphIssues.Add("hyperedge $hyperedgeIndex nodes[$memberIndex] must be a nonempty string")
                        } else {
                            $member = [string]$memberValue
                            [void]$endpoints.Add($member)
                            if (-not $declared.ContainsKey($member)) {
                                [void]$graphIssues.Add("hyperedge $hyperedgeIndex nodes[$memberIndex] is undeclared")
                            }
                        }
                        $memberIndex++
                    }
                }
                $hyperedgeIndex++
            }
        }
    }
    if ($missingEndpointCount -gt 0) {
        [void]$graphIssues.Add("$missingEndpointCount link endpoint(s) missing")
    }
    if ($undeclaredCount -gt 0) {
        [void]$graphIssues.Add("$undeclaredCount link endpoint occurrence(s) are undeclared")
    }

    $runtimeHitCount = 0
    foreach ($candidateId in @($nodeIds) + @($endpoints)) {
        if (@(Get-RuntimeRootEncodingHits ([string]$candidateId) $RuntimeRoot).Count -gt 0) {
            $runtimeHitCount++
        }
    }
    if ($runtimeHitCount -gt 0) {
        [void]$graphIssues.Add("$runtimeHitCount runtime-root-derived graph ID occurrence(s)")
    }

    if ($graphIssues.Count -gt 0) { throw ($graphIssues -join ', ') }
    $endpointSet = @($endpoints | Sort-Object -Unique)
    $isolatedCount = @($uniqueNodeIds | Where-Object { $_ -notin $endpointSet }).Count
    $communityDetail = if ($communityPresentCount -eq 0) {
        'communities omitted for deterministic graph'
    } else {
        "$($communityIds.Count) populated community label(s)"
    }
    Check PASS 'served-graph' "$nodeCount nodes, $linkCount links; every endpoint declared; $isolatedCount isolated node(s) retained; portable IDs; $communityDetail" $true
} catch {
    Check FAIL 'served-graph' "missing, invalid, or unsafe graph.json: $($_.Exception.Message)" $true
    Action 'Run the deterministic wiki build in this runtime.'
}

$headStatus = Invoke-GitReadOnly @('rev-parse', 'HEAD')
$head = Get-TrimmedText $headStatus
$stampPath = Join-Path $RuntimeRoot 'wiki\.build-stamp'
try {
    if ($EvidenceMode -ceq 'Fixture') {
        $stampPath = Resolve-ContainedFixturePath $stampPath $RuntimeRoot $true $false
    }
    $stamp = Get-Content -LiteralPath $stampPath -Raw
    if ($ExpectedSchedulerContract -in @('A', 'D')) {
        $logicalLines = [regex]::Split($stamp, '\r\n|\r|\n')
        $headBearingLines = @($logicalLines | Where-Object { $_ -imatch 'HEAD[ \t]*:' })
        $canonicalHeadLine = if ($headBearingLines.Count -eq 1) {
            [regex]::Match([string]$headBearingLines[0], '^HEAD: ([0-9a-f]{40})$')
        } else {
            $null
        }
        if (-not $head -or $headBearingLines.Count -ne 1 -or -not $canonicalHeadLine.Success -or $canonicalHeadLine.Groups[1].Value -cne $head) {
            throw 'contract A or D requires exactly one canonical HEAD line equal to live HEAD'
        }
        Check PASS 'build-stamp' 'exact canonical HEAD line matches live HEAD' $true
    } elseif ($head -and $stamp -match [regex]::Escape($head)) {
        Check PASS 'build-stamp' 'matches HEAD' $true
    } else {
        throw 'stamp mismatch'
    }
} catch {
    Check FAIL 'build-stamp' "missing or mismatched HEAD OID: $($_.Exception.Message)" $true
    Action 'Rebuild after pinning the intended runtime commit.'
}

if ($config) {
    $refStatus = Invoke-GitReadOnly @('rev-parse', '--verify', "$requiredRef^{commit}")
    $refHead = Get-TrimmedText $refStatus
    if ($head -and $refHead -and $head -eq $refHead) {
        Check PASS 'runtime-ref' "$head matches $requiredRef" $true
    } elseif (-not $refHead) {
        Check FAIL 'runtime-ref' "$requiredRef absent; no fetch performed" $true
        Action 'Fetch and pin the configured ref manually.'
    } else {
        Check FAIL 'runtime-ref' 'HEAD differs from configured remote-tracking ref' $true
        Action 'Advance detached runtime HEAD to the configured ref.'
    }
}

$receiptDirectory = Join-Path $RuntimeRoot '.tmp_wiki_nightly'
$receiptDirectorySafe = $true
if ($EvidenceMode -ceq 'Fixture') {
    try {
        $receiptDirectory = Resolve-ContainedFixturePath $receiptDirectory $RuntimeRoot $false $true
        Check PASS 'receipt-containment' 'nightly receipt directory is contained' $true
    } catch {
        $receiptDirectorySafe = $false
        Check FAIL 'receipt-containment' "nightly receipt directory is unsafe: $($_.Exception.Message)" $true
        Action 'Replace the fixture receipt path with an ordinary contained directory.'
    }
}
$schtasks = Join-Path $env:SystemRoot 'System32\schtasks.exe'
$taskName = '\SSTAC-Wiki-Nightly'
$task = Status $TaskQueryOutputPath $schtasks @('/Query', '/TN', $taskName, '/FO', 'LIST', '/V')
$taskPresent = $false
if ($ExpectedSchedulerContract -eq 'Legacy') {
    $receipt = if ($receiptDirectorySafe) {
        Get-ChildItem -LiteralPath $receiptDirectory -Filter 'receipt-*.md' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    } else { $null }
    if ($task.State -eq 'UNKNOWN') {
        Check UNKNOWN 'scheduler' $task.Text $true
        Action 'Confirm scheduled-task status manually.'
    } elseif ($task.ExitCode -ne 0 -or $task.Text -match '(?i)cannot find|not exist') {
        Check INFO 'scheduler' 'absent; expected before owner registration'
    } else {
        $taskPresent = $true
        $expectedTaskPath = Join-Path $RuntimeRoot 'tooling\wiki\nightly_wiki_sync.ps1'
        $expectedTaskPattern = '(?i)powershell(\.exe)?\s+-NoProfile\s+-ExecutionPolicy\s+Bypass\s+-File\s+"?' + [regex]::Escape($expectedTaskPath) + '"?'
        if ($task.Text -match $expectedTaskPattern) {
            Check INFO 'scheduler' 'present and matches expected nightly command'
        } else {
            Check FAIL 'scheduler' 'present but action is not the expected nightly command for this runtime' $true
            Action 'Re-register the task from the selected canonical runtime.'
        }
    }
    if ($receipt) {
        Check INFO 'freshness-receipt' $receipt.Name
    } elseif ($taskPresent) {
        Check FAIL 'freshness-receipt' 'absent while scheduler is present' $true
        Action 'Verify the registered nightly has completed successfully.'
    } else {
        Check INFO 'freshness-receipt' 'absent; expected before nightly registration'
    }
} else {
    $contractIssues = New-Object System.Collections.Generic.List[string]
    $taskDefinitionGuid = [guid]::Empty
    $expectedBoundaryLocal = [datetime]::MinValue
    $expectedBoundaryParsed = $false
    $activeTransitionActivatedAt = [datetimeoffset]::MinValue
    if ($ExpectedSchedulerPhase -eq 'Any') { [void]$contractIssues.Add('explicit scheduler phase required') }
    if (-not [guid]::TryParse($ExpectedTaskDefinitionId, [ref]$taskDefinitionGuid) -or $taskDefinitionGuid -eq [guid]::Empty) { [void]$contractIssues.Add('ExpectedTaskDefinitionId must be a non-empty GUID') }
    if ([string]::IsNullOrWhiteSpace($ExpectedRegistrationDate)) { [void]$contractIssues.Add('ExpectedRegistrationDate is required') }
    if ([string]::IsNullOrWhiteSpace($ExpectedStartBoundary)) { [void]$contractIssues.Add('ExpectedStartBoundary is required') }
    if ($task.State -eq 'UNKNOWN') {
        [void]$contractIssues.Add("verbose query unavailable: $($task.Text)")
    } elseif ($task.ExitCode -ne 0 -or $task.Text -match '(?i)cannot find|not exist') {
        [void]$contractIssues.Add('task absent')
    } else {
        $taskPresent = $true
        $expectedVerboseState = if ($ExpectedSchedulerPhase -eq 'Disabled') { 'Disabled' } else { 'Enabled' }
        $observedVerboseState = Get-TaskField $task.Text 'Scheduled Task State' $contractIssues
        if ($observedVerboseState -cne $expectedVerboseState) { [void]$contractIssues.Add("verbose task state expected $expectedVerboseState") }

        $taskXmlStatus = Status $TaskXmlOutputPath $schtasks @('/Query', '/TN', $taskName, '/XML')
        if ($taskXmlStatus.State -ne 'DONE' -or $taskXmlStatus.ExitCode -ne 0 -or -not $taskXmlStatus.Text) {
            [void]$contractIssues.Add('XML definition unavailable')
        } else {
            try {
                [xml]$taskXml = $taskXmlStatus.Text
                $namespaceUri = 'http://schemas.microsoft.com/windows/2004/02/mit/task'
                $taskNode = $taskXml.DocumentElement
                if ($taskNode.LocalName -cne 'Task' -or $taskNode.NamespaceURI -cne $namespaceUri) { throw 'unexpected Task root namespace' }
                Add-AllowedAttributeIssues $taskNode @('version') 'Task' $contractIssues
                $taskVersion = $taskNode.GetAttributeNode('version')
                if ($null -eq $taskVersion -or $taskVersion.NamespaceURI -or $taskVersion.Value -cne '1.4') { [void]$contractIssues.Add('Task version must be exactly 1.4') }
                foreach ($contractNode in @($taskNode.SelectNodes('.//*'))) {
                    if ($contractNode.LocalName -ceq 'Principal') { Add-AllowedAttributeIssues $contractNode @('id') 'Principal' $contractIssues }
                    elseif ($contractNode.LocalName -ceq 'Actions') { Add-AllowedAttributeIssues $contractNode @('Context') 'Actions' $contractIssues }
                    else { Add-AllowedAttributeIssues $contractNode @() $contractNode.LocalName $contractIssues }
                }
                Add-AllowedChildIssues $taskNode @('RegistrationInfo', 'Principals', 'Settings', 'Triggers', 'Actions') $namespaceUri 'Task' $contractIssues
                $registration = Get-UniqueChild $taskNode 'RegistrationInfo' $namespaceUri $true 'RegistrationInfo' $contractIssues
                $principalsNode = Get-UniqueChild $taskNode 'Principals' $namespaceUri $true 'Principals' $contractIssues
                $settings = Get-UniqueChild $taskNode 'Settings' $namespaceUri $true 'Settings' $contractIssues
                $triggersNode = Get-UniqueChild $taskNode 'Triggers' $namespaceUri $true 'Triggers' $contractIssues
                $actionsNode = Get-UniqueChild $taskNode 'Actions' $namespaceUri $true 'Actions' $contractIssues

                if ($registration) {
                    Add-AllowedChildIssues $registration @('Date', 'Author', 'Description', 'URI') $namespaceUri 'RegistrationInfo' $contractIssues
                    $registrationDate = Get-SemanticText $registration 'Date' $namespaceUri $true '' $false 'RegistrationInfo Date' $contractIssues
                    $author = Get-SemanticText $registration 'Author' $namespaceUri $true '' $false 'RegistrationInfo Author' $contractIssues
                    $description = Get-SemanticText $registration 'Description' $namespaceUri $true '' $false 'RegistrationInfo Description' $contractIssues
                    $uri = Get-SemanticText $registration 'URI' $namespaceUri $true '' $false 'task URI' $contractIssues
                    if ($registrationDate -cne $ExpectedRegistrationDate) { [void]$contractIssues.Add('RegistrationInfo Date mismatch') }
                    if ($author -cne 'DINGAPC\jasen') { [void]$contractIssues.Add('RegistrationInfo Author mismatch') }
                    $expectedDescription = if ($ExpectedSchedulerContract -ceq 'D') {
                        'SSTAC Wiki nightly candidate D: deterministic-only network-capable run; label and semantic disabled. Staged with the daily trigger disabled.'
                    } else {
                        'SSTAC Wiki nightly candidate A: true unattended network-capable run. Staged with the daily trigger disabled.'
                    }
                    if ($description -cne $expectedDescription) { [void]$contractIssues.Add('RegistrationInfo Description mismatch') }
                    if ($uri -cne $taskName) { [void]$contractIssues.Add('task URI mismatch') }
                }

                $principal = $null
                if ($principalsNode) {
                    Add-AllowedChildIssues $principalsNode @('Principal') $namespaceUri 'Principals' $contractIssues
                    $principal = Get-UniqueChild $principalsNode 'Principal' $namespaceUri $true 'Principal' $contractIssues
                }
                if ($principal) {
                    Add-AllowedChildIssues $principal @('UserId', 'LogonType', 'RunLevel') $namespaceUri 'Principal' $contractIssues
                    if ([string]$principal.GetAttribute('id') -cne 'Author') { [void]$contractIssues.Add('Principal id must be Author') }
                    $observedUser = Get-SemanticText $principal 'UserId' $namespaceUri $true '' $false 'UserId' $contractIssues
                    $expectedSid = Resolve-AccountSid 'DINGAPC\jasen'
                    $observedSid = Resolve-AccountSid $observedUser
                    if (-not $expectedSid) { [void]$contractIssues.Add('expected account DINGAPC\jasen did not resolve to a SID') }
                    elseif (-not $observedSid) { [void]$contractIssues.Add('observed UserId did not resolve to a SID') }
                    elseif (-not [string]::Equals($expectedSid, $observedSid, [System.StringComparison]::OrdinalIgnoreCase)) { [void]$contractIssues.Add('UserId SID mismatch') }
                    $logonType = Get-SemanticText $principal 'LogonType' $namespaceUri $true '' $false 'LogonType' $contractIssues
                    if ($logonType -cne 'Password') { [void]$contractIssues.Add('LogonType must be Password') }
                    $runLevel = Get-SemanticText $principal 'RunLevel' $namespaceUri $false 'LeastPrivilege' $true 'RunLevel' $contractIssues
                    if ($runLevel -cne 'LeastPrivilege') { [void]$contractIssues.Add('RunLevel must be LeastPrivilege') }
                }

                $trigger = $null
                if ($triggersNode) {
                    Add-AllowedChildIssues $triggersNode @('CalendarTrigger') $namespaceUri 'Triggers' $contractIssues
                    $trigger = Get-UniqueChild $triggersNode 'CalendarTrigger' $namespaceUri $true 'CalendarTrigger' $contractIssues
                }
                if ($trigger) {
                    Add-AllowedChildIssues $trigger @('StartBoundary', 'Enabled', 'ScheduleByDay') $namespaceUri 'CalendarTrigger' $contractIssues
                    $boundary = Get-SemanticText $trigger 'StartBoundary' $namespaceUri $true '' $false 'StartBoundary' $contractIssues
                    $expectedBoundaryParsed = [datetime]::TryParseExact($ExpectedStartBoundary, 'yyyy-MM-ddTHH:mm:ss', [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::None, [ref]$expectedBoundaryLocal)
                    if (-not $expectedBoundaryParsed -or $expectedBoundaryLocal.Hour -ne 5 -or $expectedBoundaryLocal.Minute -ne 30 -or $expectedBoundaryLocal.Second -ne 0) { [void]$contractIssues.Add('ExpectedStartBoundary must be exact timezone-less local daily 05:30') }
                    if ($boundary -cne $ExpectedStartBoundary) { [void]$contractIssues.Add('StartBoundary mismatch') }
                    $schedule = Get-UniqueChild $trigger 'ScheduleByDay' $namespaceUri $true 'ScheduleByDay' $contractIssues
                    if ($schedule) {
                        Add-AllowedChildIssues $schedule @('DaysInterval') $namespaceUri 'ScheduleByDay' $contractIssues
                        $days = Get-SemanticText $schedule 'DaysInterval' $namespaceUri $true '' $false 'DaysInterval' $contractIssues
                        if ($days -cne '1') { [void]$contractIssues.Add('DaysInterval must be 1') }
                    }
                    $triggerEnabled = Get-SemanticBoolean $trigger 'Enabled' $namespaceUri $false $true $true 'trigger Enabled' $contractIssues
                    $expectedTriggerEnabled = ($ExpectedSchedulerPhase -in @('ActiveAwaitingNatural', 'Active0530Correlated'))
                    if ($null -ne $triggerEnabled -and $triggerEnabled -ne $expectedTriggerEnabled) { [void]$contractIssues.Add("trigger Enabled mismatch for $ExpectedSchedulerPhase") }
                }

                if ($settings) {
                    $allowedSettings = @('MultipleInstancesPolicy', 'DisallowStartIfOnBatteries', 'StopIfGoingOnBatteries', 'AllowHardTerminate', 'StartWhenAvailable', 'RunOnlyIfNetworkAvailable', 'IdleSettings', 'AllowStartOnDemand', 'Enabled', 'Hidden', 'RunOnlyIfIdle', 'WakeToRun', 'ExecutionTimeLimit', 'Priority')
                    Add-AllowedChildIssues $settings $allowedSettings $namespaceUri 'Settings' $contractIssues
                    $taskEnabled = Get-SemanticBoolean $settings 'Enabled' $namespaceUri $false $true $true 'task Enabled' $contractIssues
                    $expectedTaskEnabled = ($ExpectedSchedulerPhase -ne 'Disabled')
                    if ($null -ne $taskEnabled -and $taskEnabled -ne $expectedTaskEnabled) { [void]$contractIssues.Add("task Enabled mismatch for $ExpectedSchedulerPhase") }
                    $multiple = Get-SemanticText $settings 'MultipleInstancesPolicy' $namespaceUri $true '' $false 'MultipleInstancesPolicy' $contractIssues
                    if ($multiple -cne 'IgnoreNew') { [void]$contractIssues.Add('MultipleInstancesPolicy must be IgnoreNew') }
                    $batteryStart = Get-SemanticBoolean $settings 'DisallowStartIfOnBatteries' $namespaceUri $true $true $false 'DisallowStartIfOnBatteries' $contractIssues
                    if ($null -ne $batteryStart -and $batteryStart) { [void]$contractIssues.Add('DisallowStartIfOnBatteries must be false') }
                    $batteryStop = Get-SemanticBoolean $settings 'StopIfGoingOnBatteries' $namespaceUri $true $true $false 'StopIfGoingOnBatteries' $contractIssues
                    if ($null -ne $batteryStop -and $batteryStop) { [void]$contractIssues.Add('StopIfGoingOnBatteries must be false') }
                    $hardTerminate = Get-SemanticBoolean $settings 'AllowHardTerminate' $namespaceUri $false $true $true 'AllowHardTerminate' $contractIssues
                    if ($null -ne $hardTerminate -and -not $hardTerminate) { [void]$contractIssues.Add('AllowHardTerminate must be true') }
                    $startAvailable = Get-SemanticBoolean $settings 'StartWhenAvailable' $namespaceUri $true $false $false 'StartWhenAvailable' $contractIssues
                    if ($null -ne $startAvailable -and -not $startAvailable) { [void]$contractIssues.Add('StartWhenAvailable must be true') }
                    $network = Get-SemanticBoolean $settings 'RunOnlyIfNetworkAvailable' $namespaceUri $true $false $false 'RunOnlyIfNetworkAvailable' $contractIssues
                    if ($null -ne $network -and -not $network) { [void]$contractIssues.Add('RunOnlyIfNetworkAvailable must be true') }
                    $onDemand = Get-SemanticBoolean $settings 'AllowStartOnDemand' $namespaceUri $false $true $true 'AllowStartOnDemand' $contractIssues
                    if ($null -ne $onDemand -and -not $onDemand) { [void]$contractIssues.Add('AllowStartOnDemand must be true') }
                    $hidden = Get-SemanticBoolean $settings 'Hidden' $namespaceUri $false $false $true 'Hidden' $contractIssues
                    if ($null -ne $hidden -and $hidden) { [void]$contractIssues.Add('Hidden must be false') }
                    $runOnlyIdle = Get-SemanticBoolean $settings 'RunOnlyIfIdle' $namespaceUri $false $false $true 'RunOnlyIfIdle' $contractIssues
                    if ($null -ne $runOnlyIdle -and $runOnlyIdle) { [void]$contractIssues.Add('RunOnlyIfIdle must be false') }
                    $wake = Get-SemanticBoolean $settings 'WakeToRun' $namespaceUri $true $false $false 'WakeToRun' $contractIssues
                    if ($null -ne $wake -and -not $wake) { [void]$contractIssues.Add('WakeToRun must be true') }
                    $limit = Get-SemanticText $settings 'ExecutionTimeLimit' $namespaceUri $true '' $false 'ExecutionTimeLimit' $contractIssues
                    if ($limit -cne 'PT6H') { [void]$contractIssues.Add('ExecutionTimeLimit must be PT6H') }
                    $priority = Get-SemanticText $settings 'Priority' $namespaceUri $false '7' $true 'Priority' $contractIssues
                    if ($priority -cne '7') { [void]$contractIssues.Add('Priority must be 7') }
                    $idle = Get-UniqueChild $settings 'IdleSettings' $namespaceUri $true 'IdleSettings' $contractIssues
                    if ($idle) {
                        Add-AllowedChildIssues $idle @('Duration', 'WaitTimeout', 'StopOnIdleEnd', 'RestartOnIdle') $namespaceUri 'IdleSettings' $contractIssues
                        $idleDuration = Get-SemanticText $idle 'Duration' $namespaceUri $false 'PT10M' $true 'Idle Duration' $contractIssues
                        if ($idleDuration -cne 'PT10M') { [void]$contractIssues.Add('Idle Duration must be PT10M when emitted') }
                        $idleWait = Get-SemanticText $idle 'WaitTimeout' $namespaceUri $false 'PT1H' $true 'Idle WaitTimeout' $contractIssues
                        if ($idleWait -cne 'PT1H') { [void]$contractIssues.Add('Idle WaitTimeout must be PT1H when emitted') }
                        $stopIdle = Get-SemanticBoolean $idle 'StopOnIdleEnd' $namespaceUri $true $true $false 'StopOnIdleEnd' $contractIssues
                        if ($null -ne $stopIdle -and $stopIdle) { [void]$contractIssues.Add('StopOnIdleEnd must be false') }
                        $restartIdle = Get-SemanticBoolean $idle 'RestartOnIdle' $namespaceUri $false $false $true 'RestartOnIdle' $contractIssues
                        if ($null -ne $restartIdle -and $restartIdle) { [void]$contractIssues.Add('RestartOnIdle must be false') }
                    }
                }

                $exec = $null
                if ($actionsNode) {
                    Add-AllowedChildIssues $actionsNode @('Exec') $namespaceUri 'Actions' $contractIssues
                    if ([string]$actionsNode.GetAttribute('Context') -cne 'Author') { [void]$contractIssues.Add('Actions Context must be Author') }
                    $exec = Get-UniqueChild $actionsNode 'Exec' $namespaceUri $true 'Exec' $contractIssues
                }
                if ($exec) {
                    Add-AllowedChildIssues $exec @('Command', 'Arguments', 'WorkingDirectory') $namespaceUri 'Exec' $contractIssues
                    $expectedPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
                    $expectedScript = Join-Path $RuntimeRoot 'tooling\wiki\nightly_wiki_sync.ps1'
                    $expectedDefinitionId = $taskDefinitionGuid.ToString('D').ToLowerInvariant()
                    $expectedArguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $expectedScript + '" -RepoRoot "' + $RuntimeRoot + '" -TaskDefinitionId "' + $expectedDefinitionId + '"'
                    if ($ExpectedSchedulerContract -ceq 'D') { $expectedArguments += ' -SkipLabeling -SkipSemantic' }
                    $command = Get-SemanticText $exec 'Command' $namespaceUri $true '' $false 'Command' $contractIssues
                    $arguments = Get-SemanticText $exec 'Arguments' $namespaceUri $true '' $false 'Arguments' $contractIssues
                    $working = Get-SemanticText $exec 'WorkingDirectory' $namespaceUri $true '' $false 'WorkingDirectory' $contractIssues
                    if (-not [string]::Equals($command, $expectedPowerShell, [System.StringComparison]::OrdinalIgnoreCase)) { [void]$contractIssues.Add('Command must be the exact absolute Windows PowerShell 5.1 path') }
                    if ($arguments -cne $expectedArguments) { [void]$contractIssues.Add('Arguments mismatch') }
                    if (-not [string]::Equals($working, $RuntimeRoot, [System.StringComparison]::OrdinalIgnoreCase)) { [void]$contractIssues.Add('WorkingDirectory mismatch') }
                    if ($arguments -match '(?i)(^|\s)-AutoCommit(\s|$)') { [void]$contractIssues.Add('AutoCommit must be absent') }
                }
            } catch {
                [void]$contractIssues.Add("XML parse/shape error: $($_.Exception.Message)")
            }
        }
    }

    $activePhase = $ExpectedSchedulerPhase -in @('ActiveAwaitingNatural', 'Active0530Correlated')
    if ($activePhase) {
        $transitionIssues = New-Object System.Collections.Generic.List[string]
        $transitionFile = $null
        if ([string]::IsNullOrWhiteSpace($ActiveTransitionReceiptPath)) {
            [void]$transitionIssues.Add('ActiveTransitionReceiptPath is required for active phases')
        } else {
            try {
                $transitionFile = Get-Item -LiteralPath $ActiveTransitionReceiptPath -ErrorAction Stop
                if ($transitionFile.PSIsContainer) { throw 'path is not a file' }
                if ($transitionFile.Extension -cne '.json') { [void]$transitionIssues.Add('active transition receipt must have a .json extension') }
                if ($ExpectedActiveTransitionReceiptSha256 -cnotmatch '^[0-9a-f]{64}$') { [void]$transitionIssues.Add('ExpectedActiveTransitionReceiptSha256 must be exact lowercase SHA-256') }
                $transitionBytes = [System.IO.File]::ReadAllBytes($transitionFile.FullName)
                $sha256 = [System.Security.Cryptography.SHA256]::Create()
                try { $transitionHash = -join @($sha256.ComputeHash($transitionBytes) | ForEach-Object { $_.ToString('x2') }) }
                finally { $sha256.Dispose() }
                if ($transitionHash -cne $ExpectedActiveTransitionReceiptSha256) { [void]$transitionIssues.Add('active transition receipt SHA-256 mismatch') }
                $transitionRaw = [System.Text.Encoding]::UTF8.GetString($transitionBytes).TrimStart([char]0xFEFF)
                $transition = $transitionRaw | ConvertFrom-Json
                $allowedTransitionFields = @('schema_version', 'terminal_state', 'task_name', 'prior_staged_task_definition_id', 'active_task_definition_id', 'registration_date', 'start_boundary', 'activated_at_utc')
                $observedTransitionFields = @($transition.PSObject.Properties | ForEach-Object { $_.Name })
                foreach ($field in $allowedTransitionFields) {
                    if ($field -notin $observedTransitionFields) { [void]$transitionIssues.Add("transition field $field missing") }
                    if ([regex]::Matches($transitionRaw, '"' + [regex]::Escape($field) + '"\s*:').Count -ne 1) { [void]$transitionIssues.Add("transition field $field must occur exactly once") }
                }
                foreach ($field in $observedTransitionFields) {
                    if ($field -notin $allowedTransitionFields) { [void]$transitionIssues.Add("unexpected transition field $field") }
                }
                $transitionSchema = Get-FlatJsonStringField $transitionRaw 'schema_version' $transitionIssues
                $transitionState = Get-FlatJsonStringField $transitionRaw 'terminal_state' $transitionIssues
                $transitionTaskName = Get-FlatJsonStringField $transitionRaw 'task_name' $transitionIssues
                $priorText = Get-FlatJsonStringField $transitionRaw 'prior_staged_task_definition_id' $transitionIssues
                $activeText = Get-FlatJsonStringField $transitionRaw 'active_task_definition_id' $transitionIssues
                $transitionRegistrationDate = Get-FlatJsonStringField $transitionRaw 'registration_date' $transitionIssues
                $transitionStartBoundary = Get-FlatJsonStringField $transitionRaw 'start_boundary' $transitionIssues
                $transitionActivatedAtText = Get-FlatJsonStringField $transitionRaw 'activated_at_utc' $transitionIssues
                if ($transitionSchema -cne '1.0') { [void]$transitionIssues.Add('transition schema_version must be 1.0') }
                if ($transitionState -cne 'ACTIVE_DEFINITION_ACCEPTED') { [void]$transitionIssues.Add('transition terminal_state must be ACTIVE_DEFINITION_ACCEPTED') }
                if ($transitionTaskName -cne $taskName) { [void]$transitionIssues.Add('transition task_name mismatch') }
                $priorGuid = [guid]::Empty
                $activeGuid = [guid]::Empty
                if (-not [guid]::TryParseExact($priorText, 'D', [ref]$priorGuid) -or $priorGuid -eq [guid]::Empty -or $priorText -cne $priorGuid.ToString('D').ToLowerInvariant()) { [void]$transitionIssues.Add('prior staged task definition ID must be a canonical nonempty GUID') }
                if (-not [guid]::TryParseExact($activeText, 'D', [ref]$activeGuid) -or $activeGuid -eq [guid]::Empty -or $activeText -cne $activeGuid.ToString('D').ToLowerInvariant()) { [void]$transitionIssues.Add('active task definition ID must be a canonical nonempty GUID') }
                if ($priorGuid -ne [guid]::Empty -and $activeGuid -ne [guid]::Empty -and $priorGuid -eq $activeGuid) { [void]$transitionIssues.Add('active task definition ID must differ from prior staged ID') }
                if ($activeGuid -ne $taskDefinitionGuid) { [void]$transitionIssues.Add('transition active task definition ID must equal current action ID') }
                if ($transitionRegistrationDate -cne $ExpectedRegistrationDate) { [void]$transitionIssues.Add('transition registration_date mismatch') }
                if ($transitionStartBoundary -cne $ExpectedStartBoundary) { [void]$transitionIssues.Add('transition start_boundary mismatch') }
                if (-not (Try-GetUtcReceiptTimestamp $transitionActivatedAtText ([ref]$activeTransitionActivatedAt))) { [void]$transitionIssues.Add('transition activated_at_utc must be strict UTC ending in Z') }
                elseif ($activeTransitionActivatedAt -gt [datetimeoffset]::UtcNow) { [void]$transitionIssues.Add('transition activated_at_utc must not be in the future') }
            } catch {
                [void]$transitionIssues.Add("active transition receipt unavailable or malformed: $($_.Exception.Message)")
            }
        }
        if ($transitionIssues.Count -eq 0) { Check PASS 'active-transition' "accepted immutable receipt $($transitionFile.Name)" $true }
        else { Check FAIL 'active-transition' ($transitionIssues -join ', ') $true; Action 'Provide the exact owner-accepted staged-to-active transition receipt.' }
    } else {
        Check INFO 'active-transition' "not required for $ExpectedSchedulerPhase phase"
    }

    if ($contractIssues.Count -eq 0) {
        Check PASS 'scheduler-contract' "contract $ExpectedSchedulerContract/$ExpectedSchedulerPhase matches frozen semantics" $true
    } else {
        Check FAIL 'scheduler-contract' ($contractIssues -join ', ') $true
        Action 'Keep the task disabled and review the exact scheduler XML and verbose readback.'
    }

    $proofRequired = $ExpectedSchedulerPhase -in @('StagedManualProven', 'Active0530Correlated')
    if ($proofRequired) {
        $proofIssues = New-Object System.Collections.Generic.List[string]
        $statusValue = Get-TaskField $task.Text 'Status' $proofIssues
        if ($statusValue -cne 'Ready') { [void]$proofIssues.Add('Status must be exactly Ready') }
        $lastResult = Get-TaskField $task.Text 'Last Result' $proofIssues
        if ($lastResult -cne '0') { [void]$proofIssues.Add('Last Result must be exactly 0') }
        $lastRunText = Get-TaskField $task.Text 'Last Run Time' $proofIssues
        $lastRun = [datetime]::MinValue
        $lastRunParsed = [datetime]::TryParse($lastRunText, [System.Globalization.CultureInfo]::CurrentCulture, [System.Globalization.DateTimeStyles]::AllowWhiteSpaces, [ref]$lastRun)
        if (-not $lastRunParsed) { $lastRunParsed = [datetime]::TryParse($lastRunText, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AllowWhiteSpaces, [ref]$lastRun) }
        $localZone = [System.TimeZoneInfo]::Local
        $lastRunUtc = [datetime]::MinValue
        if (-not $lastRunParsed -or $lastRun.Year -lt 2000) {
            [void]$proofIssues.Add('Last Run Time is missing, invalid, or sentinel')
        } else {
            $lastRun = [datetime]::SpecifyKind($lastRun, [System.DateTimeKind]::Unspecified)
            if ($localZone.IsInvalidTime($lastRun) -or $localZone.IsAmbiguousTime($lastRun)) { [void]$proofIssues.Add('Last Run Time local conversion is invalid or ambiguous') }
            else { $lastRunUtc = [System.TimeZoneInfo]::ConvertTimeToUtc($lastRun, $localZone) }
        }
        $proofNotBefore = [datetimeoffset]::MinValue
        if ([string]::IsNullOrWhiteSpace($ProofNotBeforeUtc) -or $ProofNotBeforeUtc -notmatch 'Z$' -or -not [datetimeoffset]::TryParse($ProofNotBeforeUtc, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::RoundtripKind, [ref]$proofNotBefore) -or $proofNotBefore.Offset -ne [timespan]::Zero) {
            [void]$proofIssues.Add('ProofNotBeforeUtc must be an unambiguous UTC timestamp ending in Z')
        }
        if ($taskDefinitionGuid -eq [guid]::Empty) { [void]$proofIssues.Add('valid task definition identity is required for proof') }
        $nowUtc = [datetimeoffset]::UtcNow
        $allReceipts = if ($receiptDirectorySafe) {
            @(Get-ChildItem -LiteralPath $receiptDirectory -Filter 'terminal-receipt-*.json' -ErrorAction SilentlyContinue)
        } else { @() }
        $definitionReceipts = New-Object System.Collections.Generic.List[object]
        $matchingReceipts = New-Object System.Collections.Generic.List[object]
        if (-not $receiptDirectorySafe) { [void]$proofIssues.Add('terminal receipt directory containment failed') }
        foreach ($receiptFile in $allReceipts) {
            $nameMatch = [regex]::Match($receiptFile.Name, '^terminal-receipt-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.json$')
            if (-not $nameMatch.Success) { [void]$proofIssues.Add("malformed terminal receipt filename $($receiptFile.Name)"); continue }
            try {
                $receiptPath = $receiptFile.FullName
                if ($EvidenceMode -ceq 'Fixture') {
                    $receiptPath = Resolve-ContainedFixturePath $receiptPath $RuntimeRoot $true $false
                }
                $receiptRaw = Get-Content -LiteralPath $receiptPath -Raw
                $rawSchemaDiagnostic = ''
                if (-not (Test-TerminalReceiptRawSchema $receiptRaw ([ref]$rawSchemaDiagnostic))) {
                    throw "raw terminal schema invalid: $rawSchemaDiagnostic"
                }
                $receiptObject = $receiptRaw | ConvertFrom-Json
            } catch {
                [void]$proofIssues.Add("malformed or unsafe terminal receipt JSON $($receiptFile.Name): $($_.Exception.Message)")
                continue
            }
            $bodyRunId = [string]$receiptObject.run_id
            if ($bodyRunId -cne $nameMatch.Groups[1].Value) { [void]$proofIssues.Add("terminal receipt filename/body UUID mismatch $($receiptFile.Name)"); continue }
            $parsedRunId = [guid]::Empty
            if (-not [guid]::TryParseExact($bodyRunId, 'D', [ref]$parsedRunId) -or $bodyRunId -cne $parsedRunId.ToString('D').ToLowerInvariant()) { [void]$proofIssues.Add("terminal receipt UUID is not canonical $($receiptFile.Name)"); continue }
            if ([string]$receiptObject.task_definition_id -cne $taskDefinitionGuid.ToString('D').ToLowerInvariant()) { continue }
            $started = [datetimeoffset]::MinValue
            $completed = [datetimeoffset]::MinValue
            if (-not (Try-GetUtcReceiptTimestamp $receiptObject.started_at_utc ([ref]$started))) { [void]$proofIssues.Add("invalid started_at_utc $($receiptFile.Name)"); continue }
            if (-not (Try-GetUtcReceiptTimestamp $receiptObject.completed_at_utc ([ref]$completed))) { [void]$proofIssues.Add("invalid completed_at_utc $($receiptFile.Name)"); continue }
            $duration = ($completed - $started).TotalSeconds
            if ($duration -lt 0) { [void]$proofIssues.Add("receipt timestamps reversed $($receiptFile.Name)") }
            if ($duration -gt 21600) { [void]$proofIssues.Add("receipt exceeds PT6H $($receiptFile.Name)") }
            $reportedDuration = 0.0
            if (-not (Try-GetFiniteDouble $receiptObject.duration_seconds ([ref]$reportedDuration)) -or $reportedDuration -lt 0 -or $reportedDuration -gt 21600 -or [math]::Abs($reportedDuration - $duration) -gt 2.0) { [void]$proofIssues.Add("receipt duration must be finite, within PT6H, and match timestamps $($receiptFile.Name)") }
            $record = [pscustomobject]@{ File = $receiptFile; Data = $receiptObject; Started = $started; Completed = $completed }
            [void]$definitionReceipts.Add($record)
            if ($lastRunUtc -ne [datetime]::MinValue -and [math]::Abs(($started.UtcDateTime - $lastRunUtc).TotalSeconds) -le 60) { [void]$matchingReceipts.Add($record) }
        }
        if ($allReceipts.Count -eq 0) { [void]$proofIssues.Add('terminal receipt is missing') }
        if ($matchingReceipts.Count -ne 1) { [void]$proofIssues.Add("matching terminal receipt cardinality $($matchingReceipts.Count), expected one") }
        if ($matchingReceipts.Count -eq 1) {
            $receipt = $matchingReceipts[0]
            $data = $receipt.Data
            if ($ExpectedSchedulerPhase -eq 'Active0530Correlated') {
                if ($receipt.Started -le $proofNotBefore) { [void]$proofIssues.Add('05:30-correlated receipt must start after ProofNotBeforeUtc') }
                if ($activeTransitionActivatedAt -eq [datetimeoffset]::MinValue -or $receipt.Started -le $activeTransitionActivatedAt) { [void]$proofIssues.Add('05:30-correlated receipt must start after accepted activation') }
            } elseif ($receipt.Started -lt $proofNotBefore -or $receipt.Completed -lt $proofNotBefore) {
                [void]$proofIssues.Add('receipt predates ProofNotBeforeUtc')
            }
            if ($receipt.Completed -gt $nowUtc.AddMinutes(1)) { [void]$proofIssues.Add('receipt completion is in the future') }
            if (($nowUtc - $receipt.Completed).TotalHours -gt $freshnessMaxAgeHours) { [void]$proofIssues.Add('receipt is outside the freshness interval') }
            if ($definitionReceipts.Count -gt 0) {
                $latest = @($definitionReceipts | Sort-Object Completed -Descending)[0]
                if ($latest.File.FullName -cne $receipt.File.FullName) { [void]$proofIssues.Add('matching receipt is not the latest receipt for this definition') }
            }
            if ([string]$data.schema_version -cne '1.0') { [void]$proofIssues.Add('schema_version must be 1.0') }
            if ([string]$data.terminal_state -cne 'SUCCESS') { [void]$proofIssues.Add('terminal_state must be SUCCESS') }
            $nativeExitProperty = $data.PSObject.Properties['native_exit_code']
            if ($null -eq $nativeExitProperty) {
                [void]$proofIssues.Add('native_exit_code must be exactly numeric 0')
            } else {
                try {
                    $nativeExit = Get-CustodyNonnegativeInteger $nativeExitProperty.Value 'native_exit_code'
                    if ($nativeExit -ne 0) { [void]$proofIssues.Add('native_exit_code must be exactly numeric 0') }
                } catch {
                    [void]$proofIssues.Add('native_exit_code must be exactly numeric 0')
                }
            }
            if ([string]$data.n0_orphan -cne 'OK') { [void]$proofIssues.Add('N0 orphan proof must be OK') }
            if ([string]$data.n1_build -cne 'OK') { [void]$proofIssues.Add('N1 build proof must be OK') }
            if ([string]$data.n2_cluster -cne 'OK') { [void]$proofIssues.Add('N2 cluster proof must be OK') }
            $semanticProof = [string]$data.n5_semantic
            if ($semanticProof -cnotin @('OK', 'SEMANTIC_SKIPPED_SkipFlags', 'SEMANTIC_SKIPPED_LOCK')) { [void]$proofIssues.Add('N5 semantic proof is missing, failed, or not an allowed intentional skip') }
            if ($ExpectedSchedulerContract -ceq 'D') {
                if ($semanticProof -cne 'SEMANTIC_SKIPPED_SkipFlags') { [void]$proofIssues.Add('Contract D N5 semantic proof must be SEMANTIC_SKIPPED_SkipFlags') }
                $modeProperty = $data.PSObject.Properties['n5_mode']
                if ($null -eq $modeProperty -or $modeProperty.Value -isnot [string] -or [string]$modeProperty.Value -cne 'SKIP_ALL') { [void]$proofIssues.Add('Contract D n5_mode must be exact SKIP_ALL string') }
                $dBooleanExpectations = [ordered]@{
                    n5_skip_labeling = $true
                    n5_skip_semantic = $true
                    n5_run_label = $false
                    n5_run_semantic = $false
                    n5_mutation_attempted = $false
                    semantic_execution_attempted = $false
                    n5_release_required = $false
                }
                foreach ($entry in $dBooleanExpectations.GetEnumerator()) {
                    $property = $data.PSObject.Properties[$entry.Key]
                    if ($null -eq $property -or $property.Value -isnot [bool] -or $property.Value -ne $entry.Value) { [void]$proofIssues.Add("Contract D $($entry.Key) type/value mismatch") }
                }
                $lockProperty = $data.PSObject.Properties['n5_lock_expiry_minutes']
                try {
                    if ($null -eq $lockProperty -or (Get-CustodyNonnegativeInteger $lockProperty.Value 'n5_lock_expiry_minutes') -ne 0) { throw 'not zero' }
                } catch { [void]$proofIssues.Add('Contract D n5_lock_expiry_minutes must be exact integer 0') }
                $scanProperty = $data.PSObject.Properties['n5_post_mutation_scan']
                if ($null -eq $scanProperty -or $null -eq $scanProperty.Value -or $scanProperty.Value -is [array] -or
                    [string]$scanProperty.Value.status -cne 'NOT_REQUIRED' -or $scanProperty.Value.mutation_attempted -isnot [bool] -or
                    $scanProperty.Value.mutation_attempted -or $null -ne $scanProperty.Value.exit_code -or
                    $scanProperty.Value.error -isnot [string] -or -not [string]::IsNullOrEmpty([string]$scanProperty.Value.error)) {
                    [void]$proofIssues.Add('Contract D post-mutation scan must be exact NOT_REQUIRED evidence')
                }
                $releaseProperty = $data.PSObject.Properties['n5_release']
                if ($null -eq $releaseProperty -or $null -eq $releaseProperty.Value -or $releaseProperty.Value -is [array] -or
                    $releaseProperty.Value.required -isnot [bool] -or $releaseProperty.Value.required -or
                    [string]$releaseProperty.Value.status -cne 'NOT_REQUIRED' -or $null -ne $releaseProperty.Value.selected_mode -or
                    $null -ne $releaseProperty.Value.observed -or $releaseProperty.Value.error -isnot [string] -or
                    -not [string]::IsNullOrEmpty([string]$releaseProperty.Value.error) -or
                    $releaseProperty.Value.GraphOrphanRisk -isnot [bool] -or $releaseProperty.Value.GraphOrphanRisk) {
                    [void]$proofIssues.Add('Contract D release evidence must be exact not-required evidence')
                }
            }
            if ([string]$data.n6_wiki -cne 'OK' -or [string]$data.n6_publication -cne 'SERVED_WIKI_SWAPPED') { [void]$proofIssues.Add('N6 Wiki publication proof must be successful') }
            if ([string]$data.serve_gate -cne 'PASS') { [void]$proofIssues.Add('serve gate proof must be PASS') }
            try {
                $canonicalEvidence = $data.PSObject.Properties['final_canonicalization'].Value
                $smokeEvidence = $data.PSObject.Properties['final_graph_smoke'].Value
                if ($null -eq $canonicalEvidence -or [string]$canonicalEvidence.status -cne 'PASS') { throw 'final canonicalization evidence must be PASS' }
                if ($null -eq $smokeEvidence -or [string]$smokeEvidence.status -cne 'PASS') { throw 'final graph smoke evidence must be PASS' }

                $expectedCanonicalName = "canonicalization-prepublish-$bodyRunId.json"
                $expectedSmokeName = "smoke-prepublish-$bodyRunId.json"
                if ([string]$canonicalEvidence.receipt_name -cne $expectedCanonicalName) { throw 'final canonicalization receipt name mismatch' }
                if ([string]$smokeEvidence.receipt_name -cne $expectedSmokeName) { throw 'final graph smoke receipt name mismatch' }
                if ([string]$canonicalEvidence.receipt_sha256 -cnotmatch '^[0-9a-f]{64}$' -or [string]$smokeEvidence.receipt_sha256 -cnotmatch '^[0-9a-f]{64}$') { throw 'final graph evidence hash is invalid' }

                $canonicalPath = Join-Path $receiptDirectory $expectedCanonicalName
                $smokePath = Join-Path $receiptDirectory $expectedSmokeName
                if ($EvidenceMode -ceq 'Fixture') {
                    $canonicalPath = Resolve-ContainedFixturePath $canonicalPath $RuntimeRoot $true $false
                    $smokePath = Resolve-ContainedFixturePath $smokePath $RuntimeRoot $true $false
                }
                if (-not (Test-Path -LiteralPath $canonicalPath -PathType Leaf) -or -not (Test-Path -LiteralPath $smokePath -PathType Leaf)) { throw 'final graph evidence file is missing' }
                if ((Get-PreflightFileSha256 $canonicalPath) -cne [string]$canonicalEvidence.receipt_sha256) { throw 'final canonicalization receipt SHA-256 mismatch' }
                if ((Get-PreflightFileSha256 $smokePath) -cne [string]$smokeEvidence.receipt_sha256) { throw 'final graph smoke receipt SHA-256 mismatch' }

                $canonicalNodeCount = Get-CustodyNonnegativeInteger $canonicalEvidence.node_count 'final_canonicalization.node_count'
                $canonicalLinkCount = Get-CustodyNonnegativeInteger $canonicalEvidence.link_count 'final_canonicalization.link_count'
                $canonicalMaterializedCount = Get-CustodyNonnegativeInteger $canonicalEvidence.materialized_endpoint_node_count 'final_canonicalization.materialized_endpoint_node_count'
                $canonicalRemovedCount = Get-CustodyNonnegativeInteger $canonicalEvidence.removed_prior_materialized_endpoint_node_count 'final_canonicalization.removed_prior_materialized_endpoint_node_count'
                if ($canonicalNodeCount -lt 1 -or $canonicalNodeCount -gt 10000000 -or $canonicalLinkCount -lt 1 -or $canonicalLinkCount -gt 50000000 -or $canonicalMaterializedCount -gt $canonicalNodeCount -or $canonicalRemovedCount -gt 10000000) { throw 'final canonicalization counts are out of bounds' }

                $canonicalReceipt = Get-Content -LiteralPath $canonicalPath -Raw | ConvertFrom-Json
                foreach ($field in @('undeclared_endpoint_occurrence_count', 'undeclared_hyperedge_member_occurrence_count', 'runtime_root_derived_id_occurrence_count')) {
                    if ((Get-CustodyNonnegativeInteger $canonicalReceipt.$field "canonical receipt $field") -ne 0) { throw "canonical receipt $field must be zero" }
                }
                if ((Get-CustodyNonnegativeInteger $canonicalReceipt.node_count 'canonical receipt node_count') -ne $canonicalNodeCount -or
                    (Get-CustodyNonnegativeInteger $canonicalReceipt.link_count 'canonical receipt link_count') -ne $canonicalLinkCount -or
                    (Get-CustodyNonnegativeInteger $canonicalReceipt.materialized_endpoint_node_count 'canonical receipt materialized count') -ne $canonicalMaterializedCount -or
                    (Get-CustodyNonnegativeInteger $canonicalReceipt.removed_prior_materialized_endpoint_node_count 'canonical receipt removed count') -ne $canonicalRemovedCount) { throw 'final canonicalization receipt counts mismatch terminal receipt' }

                $smokeNodeCount = Get-CustodyNonnegativeInteger $smokeEvidence.node_count 'final_graph_smoke.node_count'
                $smokeLinkCount = Get-CustodyNonnegativeInteger $smokeEvidence.link_count 'final_graph_smoke.link_count'
                $smokeCommunityCount = Get-CustodyNonnegativeInteger $smokeEvidence.distinct_community_count 'final_graph_smoke.distinct_community_count'
                $smokeGraphSha256 = [string]$smokeEvidence.graph_sha256
                if ($smokeNodeCount -ne $canonicalNodeCount -or $smokeLinkCount -ne $canonicalLinkCount -or $smokeCommunityCount -lt 1 -or $smokeCommunityCount -gt $smokeNodeCount) { throw 'final graph smoke counts contradict canonicalization evidence' }
                if ($smokeGraphSha256 -cnotmatch '^[0-9a-f]{64}$') { throw 'final graph smoke graph SHA-256 is invalid' }
                if ($servedGraphSha256 -cne $smokeGraphSha256) { throw 'served graph SHA-256 differs from final smoke evidence' }
                if ([string]$data.served_graph_sha256 -cne $smokeGraphSha256) { throw 'terminal served graph SHA-256 differs from final smoke evidence' }
                $smokeReceipt = Get-Content -LiteralPath $smokePath -Raw | ConvertFrom-Json
                if ($smokeReceipt.hard_abort -isnot [bool] -or $smokeReceipt.hard_abort -or [string]$smokeReceipt.graph_integrity.status -cne 'PASS' -or [string]$smokeReceipt.community_contract.status -cne 'PASS') { throw 'final graph smoke receipt is not successful' }
                if ([string]$smokeReceipt.graph_sha256 -cne $smokeGraphSha256) { throw 'rehashed smoke receipt graph SHA-256 differs from terminal evidence' }
                if ((Get-CustodyNonnegativeInteger $smokeReceipt.graph_integrity.node_count 'smoke receipt node_count') -ne $smokeNodeCount -or
                    (Get-CustodyNonnegativeInteger $smokeReceipt.graph_integrity.link_count 'smoke receipt link_count') -ne $smokeLinkCount -or
                    (Get-CustodyNonnegativeInteger $smokeReceipt.community_contract.populated_node_count 'smoke receipt populated count') -ne $smokeNodeCount -or
                    (Get-CustodyNonnegativeInteger $smokeReceipt.community_contract.distinct_community_count 'smoke receipt community count') -ne $smokeCommunityCount) { throw 'final graph smoke receipt counts mismatch terminal receipt' }
            } catch {
                [void]$proofIssues.Add("final graph evidence invalid: $($_.Exception.Message)")
            }
            if ([string]$data.required_ref -cne $requiredRef) { [void]$proofIssues.Add('receipt required_ref mismatch') }
            foreach ($oidField in @('head_oid', 'required_ref_oid', 'build_stamp_oid')) { if (-not [string]::Equals([string]$data.$oidField, $head, [System.StringComparison]::OrdinalIgnoreCase)) { [void]$proofIssues.Add("receipt $oidField mismatch") } }
            if ([string]$data.terminal_process_custody -cne 'PASS') {
                [void]$proofIssues.Add('terminal process custody must be PASS')
            } else {
                $custodyProperty = $data.PSObject.Properties['terminal_process_custody_evidence']
                if ($null -eq $custodyProperty -or $null -eq $custodyProperty.Value) {
                    [void]$proofIssues.Add('terminal process custody evidence is missing')
                } else {
                    try { Assert-TerminalProcessCustody $custodyProperty.Value $data $RuntimeRoot }
                    catch { [void]$proofIssues.Add("terminal process custody evidence invalid: $($_.Exception.Message)") }
                }
            }
            if ($ExpectedSchedulerPhase -eq 'Active0530Correlated') {
                if (-not $expectedBoundaryParsed) { [void]$proofIssues.Add('valid ExpectedStartBoundary required for 05:30 correlation') }
                else {
                    if ($localZone.IsInvalidTime($expectedBoundaryLocal) -or $localZone.IsAmbiguousTime($expectedBoundaryLocal)) { [void]$proofIssues.Add('ExpectedStartBoundary local conversion is invalid or ambiguous') }
                    $startLocal = [System.TimeZoneInfo]::ConvertTime($receipt.Started, $localZone).DateTime
                    if ($startLocal -lt $expectedBoundaryLocal) { [void]$proofIssues.Add('05:30-correlated receipt predates ExpectedStartBoundary') }
                    if ($startLocal.Hour -ne 5 -or $startLocal.Minute -ne 30) { [void]$proofIssues.Add('receipt did not start in the local 05:30 minute') }
                }
            }
        }
        if ($proofIssues.Count -eq 0) { Check PASS 'execution-proof' "exact terminal receipt $($matchingReceipts[0].File.Name) proves $ExpectedSchedulerPhase" $true }
        else { Check FAIL 'execution-proof' ($proofIssues -join ', ') $true; Action 'Require one fresh terminal SUCCESS receipt bound to this definition, scheduler run, runtime tip, graph, and phase.' }
    } else {
        Check INFO 'execution-proof' "not required for $ExpectedSchedulerPhase phase"
    }
}
$mcp = Status $McpStatusOutputPath 'claude' @('mcp', 'get', 'graphify')
if ($mcp.State -eq 'UNKNOWN') {
    Check UNKNOWN 'graphify-mcp' $mcp.Text $true
    Action 'Confirm local graphify MCP status manually.'
} elseif ($mcp.ExitCode -ne 0 -or $mcp.Text -match '(?i)not found|no mcp') {
    Check INFO 'graphify-mcp' 'absent; expected before owner registration'
} else {
    $expectedMcpPython = Join-Path $RuntimeRoot '.venv-graphify\Scripts\python.exe'
    $expectedMcpGraph = Join-Path $RuntimeRoot 'wiki\.graph\graph.json'
    $expectedMcpPattern = '(?is)' + [regex]::Escape($expectedMcpPython) + '.*-m\s+graphify\.serve.*' + [regex]::Escape($expectedMcpGraph) + '.*--transport\s+stdio'
    if ($mcp.Text -match $expectedMcpPattern) {
        Check INFO 'graphify-mcp' 'present and matches expected graphify serve command'
    } else {
        Check FAIL 'graphify-mcp' 'present but command is not the expected graphify serve command for this runtime' $true
        Action 'Inspect and correct graphify MCP arguments.'
    }
}

$standingBlockEvidence = Get-ExactPathEvidence -LiteralPath $StandingBlockEvidencePath
$standingBlockEvidenceJson = $standingBlockEvidence | ConvertTo-Json -Compress -Depth 4
$standingBlockEvidenceSha256 = Get-PreflightTextSha256 $standingBlockEvidenceJson
$standingBlockEvidenceValid = Test-ExactPathEvidence $standingBlockEvidence $StandingBlockEvidencePath $standingBlockEvidenceJson $standingBlockEvidenceSha256
if (-not $standingBlockEvidenceValid -or [string]$standingBlockEvidence.status -cne 'PASS') {
    Check FAIL 'standing-block-evidence' "exact-path evidence failed: $($standingBlockEvidence.error)" $true
    Action 'Resolve the standing-block exact-path evidence failure.'
} elseif ($standingBlockEvidence.present) { Check INFO 'standing-block' 'present' }
else { Check INFO 'standing-block' 'absent; semantic tier owner-gated' }

$activeLockEvidence = Get-ExactPathEvidence -LiteralPath $ActiveLockEvidencePath
$activeLockEvidenceJson = $activeLockEvidence | ConvertTo-Json -Compress -Depth 4
$activeLockEvidenceSha256 = Get-PreflightTextSha256 $activeLockEvidenceJson
$activeLockEvidenceValid = Test-ExactPathEvidence $activeLockEvidence $ActiveLockEvidencePath $activeLockEvidenceJson $activeLockEvidenceSha256
if (-not $activeLockEvidenceValid -or [string]$activeLockEvidence.status -cne 'PASS') {
    Check FAIL 'active-lock-evidence' "exact-path evidence failed: $($activeLockEvidence.error)" $true
    Action 'Resolve the active-lock exact-path evidence failure.'
} elseif ($activeLockEvidence.present) { Check INFO 'active-lock' 'present; do not delete' }
else { Check INFO 'active-lock' 'absent' }

$freshStandingBlockBinding = Get-FreshExactPathEvidenceBinding $StandingBlockEvidencePath $standingBlockEvidence $standingBlockEvidenceJson $standingBlockEvidenceSha256
$freshActiveLockBinding = Get-FreshExactPathEvidenceBinding $ActiveLockEvidencePath $activeLockEvidence $activeLockEvidenceJson $activeLockEvidenceSha256
$terminalEvidenceValid = ($freshStandingBlockBinding.binding_valid -and $freshActiveLockBinding.binding_valid)
if (-not $terminalEvidenceValid) {
    Check FAIL 'terminal-path-evidence' 'fresh exact-path evidence differs from the initial object, JSON, SHA-256, status, or presence state' $true
    Action 'Re-establish stable exact-path evidence and rerun.'
} else {
    Check PASS 'terminal-path-evidence' 'fresh exact-path evidence was re-observed and matches the initial binding' $true
}

if ($EvidenceMode -ceq 'Fixture') {
    if ($script:Actions.Count) {
        Write-Output 'NEXT OWNER ACTIONS:'
        $script:Actions | ForEach-Object { Write-Output "- $_" }
    }
    Write-Output 'RESULT FIXTURE_NON_ACTIVATION'
    exit 1
}

if ($script:Failed) {
    Exit-PreflightNotReady
}
if ($ExpectedSchedulerContract -in @('A', 'D')) {
    $classification = Get-SchedulerTerminalClassification $ExpectedSchedulerContract $ExpectedSchedulerPhase
    Write-Output "RESULT $($classification.result)"
    exit $classification.exit_code
}
if ($script:Actions.Count) {
    Write-Output 'NEXT OWNER ACTIONS:'
    $script:Actions | ForEach-Object { Write-Output "- $_" }
}
Write-Output 'RESULT READY'
exit 0
