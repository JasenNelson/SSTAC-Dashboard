Set-StrictMode -Version 2.0
$script:SstacTerminalizerEntered = $false
$script:SstacTerminalizerPublished = $false
function Get-SstacSha256Text([string]$Text) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function Get-SstacIdentitySetHash([object[]]$Identities) { Get-SstacSha256Text ((@($Identities | ForEach-Object { [string]$_.identity_sha256 } | Sort-Object)) -join "`n") }
function Get-SstacNonnegativeInteger([object]$Value, [string]$Name) {
    $integerTypes = @([byte], [sbyte], [int16], [uint16], [int32], [uint32], [int64])
    if ($null -eq $Value -or $integerTypes -notcontains $Value.GetType()) { throw "Invalid custody integer type $Name" }
    $parsed = [int64]$Value
    if ($parsed -lt 0 -or $parsed -gt [int]::MaxValue) { throw "Invalid custody integer range $Name" }
    return [int]$parsed
}
function Convert-SstacStrictUtc([object]$Value, [string]$Name) {
    if ($Value -is [datetime]) {
        $dateTimeValue = [datetime]$Value
        if ($dateTimeValue.Kind -ne [DateTimeKind]::Utc) { throw "Invalid UTC timestamp $Name" }
        return [datetimeoffset]$dateTimeValue
    }
    if ($Value -is [datetimeoffset]) {
        $dateTimeOffsetValue = [datetimeoffset]$Value
        if ($dateTimeOffsetValue.Offset -ne [timespan]::Zero) { throw "Invalid UTC timestamp $Name" }
        return $dateTimeOffsetValue.ToUniversalTime()
    }
    $parsed=[datetimeoffset]::MinValue;$text=[string]$Value
    if($text-cnotmatch'Z$'-or-not[datetimeoffset]::TryParse($text,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind,[ref]$parsed)-or$parsed.Offset-ne[timespan]::Zero){throw "Invalid UTC timestamp $Name"}
    $parsed.ToUniversalTime()
}
function Test-SstacCanonicalRunId([string]$Value) { $Value-cmatch'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' }
function Assert-SstacIdentitySummary([object]$Identity, [string]$Name, [bool]$RequireGraphifyClass=$false) {
    if ($null -eq $Identity) { throw "Missing custody identity $Name" }
    $identityProcessId=Get-SstacNonnegativeInteger $Identity.process_id "$Name.process_id";$parent=Get-SstacNonnegativeInteger $Identity.parent_process_id "$Name.parent_process_id"
    if($identityProcessId-le 0-or[string]::IsNullOrWhiteSpace([string]$Identity.name)){throw "Invalid custody identity $Name"};$null=Convert-SstacStrictUtc $Identity.creation_utc "$Name.creation_utc"
    foreach($field in @('command_line_sha256','executable_path_sha256','identity_sha256')){if([string]$Identity.$field-cnotmatch'^[0-9a-f]{64}$'){throw "Invalid custody hash $Name.$field"}}
    if($null-ne$Identity.PSObject.Properties['command_line']-or$null-ne$Identity.PSObject.Properties['executable_path']){throw "Raw custody process field in $Name"}
    foreach($field in @('runtime_reference','attributable_descendant')){if($null-eq$Identity.PSObject.Properties[$field]-or$Identity.$field-isnot[bool]){throw "Invalid custody classification flag $Name.$field"}}
    if($RequireGraphifyClass-and[string]$Identity.process_class-cne'PREEXISTING_GRAPHIFY_MCP'){throw "Invalid custody process class $Name"}
}
function Test-SstacUniqueHashes([object[]]$Items) { $hashes=@($Items|ForEach-Object{[string]$_.identity_sha256});$hashes.Count-eq@($hashes|Select-Object -Unique).Count-and@($hashes|Where-Object{$_-cnotmatch'^[0-9a-f]{64}$'}).Count-eq0 }
function Assert-SstacSuccessCustody([object]$Custody, [object]$Receipt) {
    if($null-eq$Custody-or[string]$Custody.schema_version-cne'1.0'-or[string]$Custody.evidence_type-cne'PROCESS_CUSTODY_TERMINAL'-or[string]$Custody.result-cne'PASS'-or[string]$Custody.baseline_result-cne'PASS'){throw 'SUCCESS requires successful nested process custody'}
    foreach($field in @('enumeration_succeeded','classification_succeeded','run_parent_identity_match','checker_parent_match','identity_overflow')){if($null-eq$Custody.PSObject.Properties[$field]-or$Custody.$field-isnot[bool]){throw "Invalid custody boolean type $field"}}
    if($Custody.enumeration_succeeded-ne$true-or$Custody.classification_succeeded-ne$true-or$Custody.run_parent_identity_match-ne$true-or$Custody.checker_parent_match-ne$true-or$Custody.identity_overflow-ne$false){throw 'Custody status boolean contradiction'}
    if([string]$Custody.expected_baseline_sha256-cnotmatch'^[0-9a-f]{64}$'-or[string]$Custody.expected_baseline_sha256-cne[string]$Custody.observed_baseline_sha256){throw 'Custody baseline SHA-256 contradiction'}
    if(-not(Test-SstacCanonicalRunId ([string]$Receipt.run_id))-or-not(Test-SstacCanonicalRunId ([string]$Custody.run_id))-or[string]$Custody.run_id-cne[string]$Receipt.run_id){throw 'Custody run_id binding contradiction'}
    $started=Convert-SstacStrictUtc $Receipt.started_at_utc 'receipt.started_at_utc';$completed=Convert-SstacStrictUtc $Receipt.completed_at_utc 'receipt.completed_at_utc';$baselineCaptured=Convert-SstacStrictUtc $Custody.baseline_captured_at_utc 'custody.baseline_captured_at_utc';$evaluated=Convert-SstacStrictUtc $Custody.evaluated_at_utc 'custody.evaluated_at_utc'
    if($started-gt$baselineCaptured-or$baselineCaptured-gt$evaluated-or$evaluated-gt$completed){throw 'Custody timestamp ordering contradiction'}
    $runParentPid=Get-SstacNonnegativeInteger $Custody.run_parent_pid 'run_parent_pid';Assert-SstacIdentitySummary $Custody.run_parent_identity 'run_parent_identity';Assert-SstacIdentitySummary $Custody.checker_identity 'checker_identity'
    if([int]$Custody.run_parent_identity.process_id-ne$runParentPid-or[int]$Custody.checker_identity.parent_process_id-ne$runParentPid-or[int]$Custody.checker_identity.process_id-eq$runParentPid-or[string]$Custody.run_parent_identity.name-notmatch'(?i)^(powershell|pwsh)(\.exe)?$'-or[string]$Custody.checker_identity.name-notmatch'(?i)^(powershell|pwsh)(\.exe)?$'-or$Custody.run_parent_identity.runtime_reference-ne$false-or$Custody.run_parent_identity.attributable_descendant-ne$false-or$Custody.checker_identity.runtime_reference-ne$false-or$Custody.checker_identity.attributable_descendant-ne$false){throw 'Custody parent/checker identity binding contradiction'}
    $cap=Get-SstacNonnegativeInteger $Custody.identity_cap 'identity_cap';$baselineCount=Get-SstacNonnegativeInteger $Custody.baseline_relevant_count 'baseline_relevant_count';$terminalCount=Get-SstacNonnegativeInteger $Custody.terminal_relevant_count 'terminal_relevant_count';$allowed=Get-SstacNonnegativeInteger $Custody.allowed_preexisting_graphify_count 'allowed_preexisting_graphify_count';$survivorCount=Get-SstacNonnegativeInteger $Custody.survivor_count 'survivor_count';$departedCount=Get-SstacNonnegativeInteger $Custody.departed_baseline_count 'departed_baseline_count'
    $baseline=@($Custody.baseline_relevant_identities);$terminal=@($Custody.terminal_relevant_identities);$survivors=@($Custody.survivor_identities);$departed=@($Custody.departed_baseline_identities)
    foreach($item in $baseline){Assert-SstacIdentitySummary $item 'baseline_identity' $true};foreach($item in $terminal){Assert-SstacIdentitySummary $item 'terminal_identity' $true};foreach($item in $departed){Assert-SstacIdentitySummary $item 'departed_identity' $true}
    foreach($item in @($baseline+$terminal+$departed)){if($item.runtime_reference-ne$true-or$item.attributable_descendant-ne$false){throw 'Custody Graphify classification contradiction'}}
    if((Convert-SstacStrictUtc $Custody.run_parent_identity.creation_utc 'run_parent_identity.creation_utc')-gt$started){throw 'Run parent creation postdates receipt start'}
    if((Convert-SstacStrictUtc $Custody.checker_identity.creation_utc 'checker_identity.creation_utc')-gt$evaluated){throw 'Checker creation postdates terminal evaluation'}
    foreach($item in $baseline){if((Convert-SstacStrictUtc $item.creation_utc 'baseline_identity.creation_utc')-gt$baselineCaptured){throw 'Baseline identity postdates capture'}}
    foreach($item in $departed){if((Convert-SstacStrictUtc $item.creation_utc 'departed_identity.creation_utc')-gt$baselineCaptured){throw 'Departed identity postdates capture'}}
    foreach($item in $terminal){if((Convert-SstacStrictUtc $item.creation_utc 'terminal_identity.creation_utc')-gt$evaluated){throw 'Terminal identity postdates evaluation'}}
    if($cap-ne16-or$baselineCount-gt$cap-or$terminalCount-gt$cap-or$baselineCount-ne$baseline.Count-or$terminalCount-ne$terminal.Count-or$allowed-ne$baselineCount-or$survivorCount-ne0-or$survivors.Count-ne0-or$departedCount-ne$departed.Count-or$terminalCount+$departedCount-ne$baselineCount){throw 'Custody cardinality contradiction'}
    if(-not(Test-SstacUniqueHashes $baseline)-or-not(Test-SstacUniqueHashes $terminal)-or-not(Test-SstacUniqueHashes $departed)){throw 'Custody hash uniqueness contradiction'}
    $baselineHashes=@($baseline|ForEach-Object{[string]$_.identity_sha256});$terminalHashes=@($terminal|ForEach-Object{[string]$_.identity_sha256});$departedHashes=@($departed|ForEach-Object{[string]$_.identity_sha256})
    if(@($terminalHashes|Where-Object{$baselineHashes-notcontains$_}).Count-ne0-or@($departedHashes|Where-Object{$baselineHashes-notcontains$_}).Count-ne0-or@($baselineHashes|Where-Object{$terminalHashes-notcontains$_-and$departedHashes-notcontains$_}).Count-ne0){throw 'Custody subset/departure contradiction'}
    if([string]$Custody.baseline_identity_set_sha256-cne(Get-SstacIdentitySetHash $baseline)-or[string]$Custody.terminal_identity_set_sha256-cne(Get-SstacIdentitySetHash $terminal)){throw 'Custody set hash contradiction'}
}
function Enter-NightlyTerminalization {
    param([Parameter(Mandatory=$true)][string]$GuardPath)
    if($script:SstacTerminalizerEntered){throw 'TERMINALIZER_REENTRY'}
    if([string]::IsNullOrWhiteSpace($GuardPath)-or-not[IO.Path]::IsPathRooted($GuardPath)){throw 'GuardPath must be absolute'}
    $parent=Split-Path -Parent $GuardPath;if(-not(Test-Path -LiteralPath $parent -PathType Container)){throw 'Guard parent does not exist'}
    $guard=New-Object IO.FileStream($GuardPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try{$marker=[Text.Encoding]::ASCII.GetBytes("entered`n");$guard.Write($marker,0,$marker.Length);$guard.Flush($true)}finally{$guard.Dispose()}
    $script:SstacTerminalizerEntered=$true
}
function Publish-NightlyTerminalReceipt {
    param([Parameter(Mandatory=$true)][object]$Receipt,[Parameter(Mandatory=$true)][string]$ReceiptPath)
    if(-not$script:SstacTerminalizerEntered){throw 'Terminalizer was not entered'};if($script:SstacTerminalizerPublished){throw 'TERMINALIZER_REENTRY'}
    if([string]::IsNullOrWhiteSpace($ReceiptPath)-or-not[IO.Path]::IsPathRooted($ReceiptPath)){throw 'ReceiptPath must be absolute'};$parent=Split-Path -Parent $ReceiptPath;if(-not(Test-Path -LiteralPath $parent -PathType Container)){throw 'Receipt parent does not exist'};if(Test-Path -LiteralPath $ReceiptPath){throw 'Terminal receipt already exists'}
    $state=[string]$Receipt.terminal_state;$exitProperty=$Receipt.PSObject.Properties['native_exit_code'];if($state-notin@('SUCCESS','FAILED','SKIPPED')-or$null-eq$exitProperty){throw 'Invalid terminal state or exit'};try{$nativeExit=Get-SstacNonnegativeInteger $exitProperty.Value 'native_exit_code'}catch{throw 'Invalid terminal state or exit'};if($state-eq'SUCCESS'-and$nativeExit-ne0){throw 'SUCCESS contradicts native exit'};if($state-eq'FAILED'-and$nativeExit-eq0){throw 'FAILED contradicts native exit'}
    $custodyLabel=[string]$Receipt.terminal_process_custody;$custodyProperty=$Receipt.PSObject.Properties['terminal_process_custody_evidence'];$custodyEvidence=if($null-eq$custodyProperty){$null}else{$custodyProperty.Value}
    if($custodyLabel-ceq'PASS'-and$null-eq$custodyEvidence){throw 'terminal_process_custody PASS requires nested evidence'}
    if($null-ne$custodyEvidence-and[string]$custodyEvidence.result-cne$custodyLabel){throw 'Top-level and nested custody contradiction'}
    if($state-eq'SUCCESS'){if($custodyLabel-cne'PASS'){throw 'SUCCESS requires terminal_process_custody PASS'};Assert-SstacSuccessCustody $custodyEvidence $Receipt}
    $temporary="$ReceiptPath.tmp-$PID-$([guid]::NewGuid().ToString('N'))";$json=(($Receipt|ConvertTo-Json -Depth 12)-replace"`r`n","`n")+"`n";$stream=New-Object IO.FileStream($temporary,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try{$bytes=(New-Object Text.UTF8Encoding($false)).GetBytes($json);$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
    [IO.File]::Move($temporary,$ReceiptPath);if(-not(Test-Path -LiteralPath $ReceiptPath -PathType Leaf)-or(Test-Path -LiteralPath $temporary)){throw 'Atomic move postcondition failed'};$script:SstacTerminalizerPublished=$true
}
