param(
    [string]$RepoRoot,
    [guid]$TaskDefinitionId = [guid]::Empty,
    [switch]$SkipLabeling,
    [switch]$SkipSemantic
)
if (-not $RepoRoot) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}
$stamp = (Get-Date -Format 'yyyy-MM-dd')
$logDir = Join-Path $RepoRoot ".tmp_wiki_nightly"
if (-not (Test-Path $logDir)) {
    $null = New-Item -ItemType Directory -Force -Path $logDir
}
$runId = [guid]::NewGuid().ToString('D').ToLowerInvariant()
$startedAtUtc = [datetime]::UtcNow
$terminalReceiptPath = Join-Path $logDir "terminal-receipt-$runId.json"
$custodyBaselinePath = Join-Path $logDir "process-custody-baseline-$runId.json"
$custodyTerminalPath = Join-Path $logDir "process-custody-terminal-$runId.json"
$terminalGuardPath = Join-Path $logDir "terminal-guard-$runId.lock"
$checkOrphansPath = Join-Path $RepoRoot 'tooling\wiki\check_orphans.ps1'
$terminalizerPath = Join-Path $RepoRoot 'tooling\wiki\nightly_terminalizer.ps1'

$transcriptPath = Join-Path $logDir "transcript-$stamp.log"
Start-Transcript -Path $transcriptPath -Append

function Exit-NightlyTerminalFailure([string]$Message) {
    [Console]::Error.WriteLine("NIGHTLY_TERMINAL_FAILURE: $Message")
    try { Stop-Transcript | Out-Null } catch {}
    exit 1
}

function Get-NightlyFileSha256([string]$Path) {
    $bytes = [IO.File]::ReadAllBytes($Path)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Get-NightlyExactNonnegativeInteger([object]$Object, [string]$PropertyName, [int]$Maximum) {
    if ($null -eq $Object) { throw "missing object for $PropertyName" }
    $property = $Object.PSObject.Properties[$PropertyName]
    $integerTypes = @([byte], [sbyte], [int16], [uint16], [int32], [uint32], [int64])
    if ($null -eq $property -or $null -eq $property.Value -or $integerTypes -notcontains $property.Value.GetType()) { throw "invalid integer type $PropertyName" }
    $value = [int64]$property.Value
    if ($value -lt 0 -or $value -gt $Maximum) { throw "invalid integer range $PropertyName" }
    return [int]$value
}

function Test-NightlyGraphSha256([string]$Path, [string]$ExpectedSha256) {
    if ($ExpectedSha256 -cnotmatch '^[0-9a-f]{64}$' -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    try { return (Get-NightlyFileSha256 $Path) -ceq $ExpectedSha256 }
    catch { return $false }
}

function Test-NightlyExactZero([object]$ExitCode) {
    if ($null -eq $ExitCode) { return $false }
    $integerTypes = @([byte], [sbyte], [int16], [uint16], [int32], [uint32], [int64])
    return ($integerTypes -contains $ExitCode.GetType() -and [int64]$ExitCode -eq 0)
}

function Get-NightlyN5Plan(
    [bool]$SkipLabeling,
    [bool]$SkipSemantic,
    [int]$LabelOnlyExpiryMinutes,
    [int]$LabelAndSemanticExpiryMinutes
) {
    $skipAll = ($SkipLabeling -and $SkipSemantic)
    $runLabel = -not $SkipLabeling
    $runSemantic = -not $SkipSemantic
    $mode = if ($skipAll) {
        'SKIP_ALL'
    } elseif ($runLabel -and $runSemantic) {
        'LABEL_AND_SEMANTIC'
    } elseif ($runLabel) {
        'LABEL_ONLY'
    } else {
        'SEMANTIC_ONLY'
    }
    $lockExpiryMinutes = if ($skipAll) {
        0
    } elseif ($runSemantic) {
        $LabelAndSemanticExpiryMinutes
    } else {
        $LabelOnlyExpiryMinutes
    }
    return [pscustomobject]@{
        Mode = $mode
        SkipAll = $skipAll
        RunLabel = $runLabel
        RunSemantic = $runSemantic
        LockExpiryMinutes = $lockExpiryMinutes
    }
}

function Get-NightlyN5ReleaseMode(
    [bool]$GpuOrphanRisk,
    [bool]$Step5Fail,
    [bool]$UnexpectedException
) {
    if ($GpuOrphanRisk) { return 'MANUAL_HOLD' }
    if ($Step5Fail -or $UnexpectedException) { return 'COMPLETED_RED' }
    return 'COMPLETED_GREEN'
}

function Invoke-NightlyN5Release {
    param(
        [Parameter(Mandatory=$true)]$Handle,
        [bool]$GpuOrphanRisk,
        [bool]$Step5Fail,
        [bool]$UnexpectedException
    )
    $releaseMode = Get-NightlyN5ReleaseMode -GpuOrphanRisk $GpuOrphanRisk `
        -Step5Fail $Step5Fail -UnexpectedException $UnexpectedException
    $releaseArgs = @{ Handle = $Handle }
    if ($releaseMode -eq 'MANUAL_HOLD') {
        $releaseArgs.GpuOrphanRisk = $true
    } else {
        $releaseArgs.Status = $releaseMode
    }
    try {
        $observed = Invoke-OllamaLockRelease @releaseArgs
        if ($null -eq $observed) {
            $observed = New-OllamaReleaseResult -RequestedMode $releaseMode `
                -Error 'release helper returned no evidence'
        }
    } catch {
        $observed = New-OllamaReleaseResult -RequestedMode $releaseMode `
            -Error "release helper threw: $($_.Exception.Message)"
    }
    $passed = Test-OllamaReleaseResult -Result $observed -ExpectedRequestedMode $releaseMode
    return [pscustomobject][ordered]@{
        required = $true
        status = if ($passed) { 'PASS' } else { 'FAIL' }
        selected_mode = $releaseMode
        observed = $observed
        error = if ($passed) { '' } else { [string]$observed.error }
        GraphOrphanRisk = $GpuOrphanRisk
    }
}

function Test-NightlyN5ReleaseEvidence {
    param(
        $Evidence,
        [bool]$ExpectedRequired,
        [bool]$ExpectedGraphOrphanRisk
    )
    if ($null -eq $Evidence -or $Evidence -is [array]) { return $false }
    $expectedProperties = @(
        'required', 'status', 'selected_mode', 'observed', 'error', 'GraphOrphanRisk'
    )
    $actualProperties = @($Evidence.PSObject.Properties.Name)
    if ($actualProperties.Count -ne $expectedProperties.Count -or
        @($expectedProperties | Where-Object { $actualProperties -cnotcontains $_ }).Count -ne 0) {
        return $false
    }
    if ($Evidence.required -isnot [bool] -or
        $Evidence.GraphOrphanRisk -isnot [bool] -or
        $Evidence.status -isnot [string] -or
        $Evidence.error -isnot [string] -or
        $Evidence.required -ne $ExpectedRequired -or
        $Evidence.GraphOrphanRisk -ne $ExpectedGraphOrphanRisk) {
        return $false
    }
    if (-not $ExpectedRequired) {
        return (-not $ExpectedGraphOrphanRisk -and
            [string]$Evidence.status -ceq 'NOT_REQUIRED' -and
            $null -eq $Evidence.selected_mode -and $null -eq $Evidence.observed -and
            [string]::IsNullOrEmpty($Evidence.error))
    }
    if ($Evidence.selected_mode -isnot [string] -or
        $null -eq $Evidence.observed -or $Evidence.observed -is [array]) {
        return $false
    }
    $allowedModes = @(
        'COMPLETED_GREEN', 'COMPLETED_RED', 'COMPLETED_YELLOW',
        'EARLY_RELEASE', 'OVERRUN_CONTAINED', 'MANUAL_HOLD'
    )
    if ($allowedModes -cnotcontains [string]$Evidence.selected_mode -or
        ($ExpectedGraphOrphanRisk -and [string]$Evidence.selected_mode -cne 'MANUAL_HOLD') -or
        (-not $ExpectedGraphOrphanRisk -and [string]$Evidence.selected_mode -ceq 'MANUAL_HOLD')) {
        return $false
    }
    $observedValid = Test-OllamaReleaseResult -Result $Evidence.observed `
        -ExpectedRequestedMode ([string]$Evidence.selected_mode)
    return ($observedValid -and [string]$Evidence.status -ceq 'PASS' -and
        [string]::IsNullOrEmpty($Evidence.error))
}

function Test-NightlySemanticEvidenceSuccess {
    param(
        [Parameter(Mandatory=$true)]$Evidence,
        [Parameter(Mandatory=$true)][string]$ExpectedRunId
    )
    if ($null -eq $Evidence) { return $false }
    $integerTypes = @([byte], [sbyte], [int16], [uint16], [int32], [uint32], [int64])
    if ($null -eq $Evidence.PSObject.Properties['observed_wrapper_exit_code'] -or
        $null -eq $Evidence.observed_wrapper_exit_code -or
        $null -eq $Evidence.PSObject.Properties['graphify_exit_code'] -or
        $null -eq $Evidence.graphify_exit_code) {
        return $false
    }
    return ([string]$Evidence.status -ceq 'PASS' -and
        [string]$Evidence.schema_version -ceq '1.0' -and
        [string]$Evidence.run_id -ceq $ExpectedRunId -and
        $Evidence.source_property_schema_valid -is [bool] -and
        $Evidence.source_property_schema_valid -and
        $integerTypes -contains $Evidence.observed_wrapper_exit_code.GetType() -and
        [int64]$Evidence.observed_wrapper_exit_code -eq 0 -and
        $integerTypes -contains $Evidence.graphify_exit_code.GetType() -and
        [int64]$Evidence.graphify_exit_code -eq 0 -and
        [string]$Evidence.graphify_status -ceq 'OK' -and
        $Evidence.timed_out -is [bool] -and -not $Evidence.timed_out -and
        $Evidence.guardrail_failed -is [bool] -and -not $Evidence.guardrail_failed -and
        $Evidence.orphan_risk -is [bool] -and -not $Evidence.orphan_risk -and
        [string]$Evidence.temp_cleanup_status -ceq 'REMOVED' -and
        $Evidence.temp_cleanup_error -is [string] -and
        [string]::IsNullOrEmpty($Evidence.temp_cleanup_error))
}

function Get-NightlyValidatedSemanticEvidence {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$ExpectedRunId,
        [Parameter(Mandatory=$true)][object]$ObservedWrapperExitCode
    )
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw 'semantic evidence is missing'
    }
    $data = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    $expectedProperties = @(
        'schema_version',
        'run_id',
        'graphify_exit_code',
        'graphify_status',
        'timed_out',
        'guardrail_failed',
        'orphan_risk',
        'temp_cleanup_status',
        'temp_cleanup_error'
    )
    $actualProperties = @($data.PSObject.Properties.Name)
    if ($actualProperties.Count -ne $expectedProperties.Count -or
        @($expectedProperties | Where-Object { $actualProperties -cnotcontains $_ }).Count -ne 0) {
        throw 'semantic evidence property schema is invalid'
    }
    if ([string]$data.schema_version -cne '1.0') { throw 'semantic evidence schema_version is invalid' }
    if ([string]$data.run_id -cne $ExpectedRunId) { throw 'semantic evidence run_id is invalid' }
    $integerTypes = @([byte], [sbyte], [int16], [uint16], [int32], [uint32], [int64])
    if ($null -eq $data.PSObject.Properties['graphify_exit_code'] -or
        $integerTypes -notcontains $data.graphify_exit_code.GetType()) {
        throw 'semantic evidence graphify_exit_code type is invalid'
    }
    if (@('OK', 'FAIL') -cnotcontains [string]$data.graphify_status) {
        throw 'semantic evidence graphify_status is invalid'
    }
    foreach ($name in @('timed_out', 'guardrail_failed', 'orphan_risk')) {
        if ($null -eq $data.PSObject.Properties[$name] -or $data.$name -isnot [bool]) {
            throw "semantic evidence $name type is invalid"
        }
    }
    $allowedCleanup = @(
        'NOT_RUN',
        'NOT_CREATED',
        'PARTIAL_REMOVED',
        'PARTIAL_REMOVAL_FAILED',
        'REMOVED',
        'REMOVAL_FAILED'
    )
    if ($allowedCleanup -cnotcontains [string]$data.temp_cleanup_status) {
        throw 'semantic evidence temp_cleanup_status is invalid'
    }
    if ($null -eq $data.PSObject.Properties['temp_cleanup_error'] -or
        $data.temp_cleanup_error -isnot [string]) {
        throw 'semantic evidence temp_cleanup_error type is invalid'
    }
    if ($null -eq $ObservedWrapperExitCode -or
        $integerTypes -notcontains $ObservedWrapperExitCode.GetType()) {
        throw 'semantic evidence observed wrapper exit type is invalid'
    }
    $validated = [pscustomobject][ordered]@{
        status = 'PASS'
        schema_version = '1.0'
        run_id = [string]$data.run_id
        source_property_schema_valid = $true
        receipt_name = Split-Path -Leaf $Path
        sha256 = Get-NightlyFileSha256 $Path
        observed_wrapper_exit_code = $ObservedWrapperExitCode
        graphify_exit_code = [int]$data.graphify_exit_code
        graphify_status = [string]$data.graphify_status
        timed_out = [bool]$data.timed_out
        guardrail_failed = [bool]$data.guardrail_failed
        orphan_risk = [bool]$data.orphan_risk
        temp_cleanup_status = [string]$data.temp_cleanup_status
        temp_cleanup_error = [string]$data.temp_cleanup_error
    }
    if (-not (Test-NightlySemanticEvidenceSuccess -Evidence $validated `
        -ExpectedRunId $ExpectedRunId)) {
        throw 'semantic evidence success fields are contradictory'
    }
    return $validated
}

function Test-NightlyN5PostMutationScanEvidence {
    param(
        $Evidence,
        [bool]$ExpectedMutationAttempted
    )
    if ($null -eq $Evidence -or $Evidence -is [array]) { return $false }
    $expectedProperties = @('status', 'mutation_attempted', 'exit_code', 'error')
    $actualProperties = @($Evidence.PSObject.Properties.Name)
    if ($actualProperties.Count -ne $expectedProperties.Count -or
        @($expectedProperties | Where-Object { $actualProperties -cnotcontains $_ }).Count -ne 0 -or
        $Evidence.status -isnot [string] -or
        $Evidence.mutation_attempted -isnot [bool] -or
        $Evidence.error -isnot [string] -or
        $Evidence.mutation_attempted -ne $ExpectedMutationAttempted) {
        return $false
    }
    if (-not $ExpectedMutationAttempted) {
        return ([string]$Evidence.status -ceq 'NOT_REQUIRED' -and
            $null -eq $Evidence.exit_code -and [string]::IsNullOrEmpty($Evidence.error))
    }
    $integerTypes = @([byte], [sbyte], [int16], [uint16], [int32], [uint32], [int64])
    return ([string]$Evidence.status -ceq 'PASS' -and
        $null -ne $Evidence.exit_code -and
        $integerTypes -contains $Evidence.exit_code.GetType() -and
        [int64]$Evidence.exit_code -eq 0 -and [string]::IsNullOrEmpty($Evidence.error))
}

function Invoke-NightlyN5PostMutationScan {
    param(
        [bool]$MutationAttempted,
        [Parameter(Mandatory=$true)][string]$PythonExe,
        [Parameter(Mandatory=$true)][string]$RepoRoot
    )
    if (-not $MutationAttempted) {
        return [pscustomobject][ordered]@{
            status = 'NOT_REQUIRED'
            mutation_attempted = $false
            exit_code = $null
            error = ''
        }
    }
    $targetDirectory = Join-Path $RepoRoot 'graphify-out'
    $graphPath = Join-Path $targetDirectory 'graph.json'
    try {
        if (-not (Test-Path -LiteralPath $targetDirectory -PathType Container -ErrorAction Stop)) {
            return [pscustomobject][ordered]@{
                status = 'FAIL'
                mutation_attempted = $true
                exit_code = $null
                error = 'post-mutation secrets scan target directory is missing'
            }
        }
        if (-not (Test-Path -LiteralPath $graphPath -PathType Leaf -ErrorAction Stop)) {
            return [pscustomobject][ordered]@{
                status = 'FAIL'
                mutation_attempted = $true
                exit_code = $null
                error = 'post-mutation secrets scan graph.json is missing'
            }
        }
    } catch {
        return [pscustomobject][ordered]@{
            status = 'FAIL'
            mutation_attempted = $true
            exit_code = $null
            error = "post-mutation secrets scan target preflight failed: $($_.Exception.Message)"
        }
    }
    try {
        $scanOutput = @(& $PythonExe (Join-Path $RepoRoot 'tooling\wiki\scan_secrets.py') --repo-root $RepoRoot --target graphify-out 2>&1)
        $scanExit = $LASTEXITCODE
        if ($scanOutput.Count -gt 0) {
            $boundedOutput = (($scanOutput | ForEach-Object { "$_" }) -join "`n")
            if ($boundedOutput.Length -gt 4096) { $boundedOutput = $boundedOutput.Substring(0, 4096) }
            Write-Host "N5 post-mutation secrets scan output:`n$boundedOutput"
        }
        if (-not (Test-NightlyExactZero $scanExit)) {
            return [pscustomobject][ordered]@{
                status = 'FAIL'
                mutation_attempted = $true
                exit_code = $scanExit
                error = 'post-mutation secrets scan returned nonzero or malformed exit'
            }
        }
        return [pscustomobject][ordered]@{
            status = 'PASS'
            mutation_attempted = $true
            exit_code = $scanExit
            error = ''
        }
    } catch {
        return [pscustomobject][ordered]@{
            status = 'FAIL'
            mutation_attempted = $true
            exit_code = $null
            error = "post-mutation secrets scan threw: $($_.Exception.Message)"
        }
    }
}

try { . $terminalizerPath }
catch { Exit-NightlyTerminalFailure "terminalizer load failed: $($_.Exception.Message)" }

$baselineExit = 1
try {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $checkOrphansPath -Mode CaptureBaseline -RunId $runId -RuntimeRoot $RepoRoot -RunParentPid $PID -OutputPath $custodyBaselinePath
    $baselineExit = $LASTEXITCODE
} catch {
    Exit-NightlyTerminalFailure "process custody baseline invocation failed: $($_.Exception.Message)"
}
if ($baselineExit -ne 0 -or -not (Test-Path -LiteralPath $custodyBaselinePath -PathType Leaf)) {
    Exit-NightlyTerminalFailure 'process custody baseline did not produce PASS evidence'
}
try { $custodyBaselineSha256 = Get-NightlyFileSha256 $custodyBaselinePath }
catch { Exit-NightlyTerminalFailure "process custody baseline hashing failed: $($_.Exception.Message)" }
if ($custodyBaselineSha256 -cnotmatch '^[0-9a-f]{64}$') {
    Exit-NightlyTerminalFailure 'process custody baseline hash is invalid'
}

. (Join-Path $RepoRoot "tooling\wiki\graphify_guardrail.ps1")
. (Join-Path $RepoRoot "tooling\wiki\ollama_lock.ps1")

# Config
$configFile = Join-Path $RepoRoot "tooling\wiki\wiki_nightly_config.json"
$cfgModel = 'qwen3:14b'
$cfgTimeoutUpdateInc = 2700
$cfgTimeoutUpdateFull = 7200
$cfgTimeoutCluster = 1800
$cfgTimeoutLabel = 3600
$cfgTimeoutSemOuter = 3600
$cfgTimeoutSemInner = 3000
$cfgExpiryLabelOnly = 60
$cfgExpiryLabelSem = 150
if (Test-Path $configFile) {
    try {
        $cfg = Get-Content $configFile -Raw | ConvertFrom-Json
        if ($cfg.model) { $cfgModel = $cfg.model }
        if ($cfg.timeouts_sec.update_incremental) { $cfgTimeoutUpdateInc = $cfg.timeouts_sec.update_incremental }
        if ($cfg.timeouts_sec.update_full) { $cfgTimeoutUpdateFull = $cfg.timeouts_sec.update_full }
        if ($cfg.timeouts_sec.cluster) { $cfgTimeoutCluster = $cfg.timeouts_sec.cluster }
        if ($cfg.timeouts_sec.label) { $cfgTimeoutLabel = $cfg.timeouts_sec.label }
        if ($cfg.timeouts_sec.semantic_outer) { $cfgTimeoutSemOuter = $cfg.timeouts_sec.semantic_outer }
        if ($cfg.timeouts_sec.semantic_inner) { $cfgTimeoutSemInner = $cfg.timeouts_sec.semantic_inner }
        if ($cfg.lock_expiry_minutes.label_only) { $cfgExpiryLabelOnly = $cfg.lock_expiry_minutes.label_only }
        if ($cfg.lock_expiry_minutes.label_plus_semantic) { $cfgExpiryLabelSem = $cfg.lock_expiry_minutes.label_plus_semantic }
    } catch {}
}

$graphifyExe = Join-Path $RepoRoot ".venv-graphify\Scripts\graphify.exe"
$pythonExe = Join-Path $RepoRoot ".venv-graphify\Scripts\python.exe"

$step1Status = "SKIPPED"
$step2Status = "SKIPPED"
$step5Status = "SKIPPED"
$promStatus = "SKIPPED"
$step6Status = "SKIPPED"
$wikiServedStatus = "SKIPPED"
$promotionCandidateReady = $false
$n0Head = ""
$n0PorcelainLines = 0
$graphOrphanRisk = $false
$gpuOrphanRisk = $false
$secretHit = $false
$serveGateSummary = "not evaluated"
$serveGateRequiredRef = "refs/remotes/origin/main"
$n0OrphanStatus = "OK"
$servedGraphHashStatus = 'NOT_RUN'
$servedGraphSha256 = $null
$finalCanonicalizationEvidence = [ordered]@{
    status = 'NOT_RUN'
    receipt_name = $null
    receipt_sha256 = $null
    node_count = 0
    link_count = 0
    materialized_endpoint_node_count = 0
    removed_prior_materialized_endpoint_node_count = 0
}
$finalGraphSmokeEvidence = [ordered]@{
    status = 'NOT_RUN'
    receipt_name = $null
    receipt_sha256 = $null
    node_count = 0
    link_count = 0
    distinct_community_count = 0
    graph_sha256 = $null
}
$semanticExecutionAttempted = $false
$semanticEvidencePath = Join-Path $logDir "semantic-evidence-$runId.json"
$semanticEvidence = [pscustomobject][ordered]@{
    status = 'NOT_RUN'
    schema_version = '1.0'
    run_id = $runId
    source_property_schema_valid = $false
    receipt_name = $null
    sha256 = $null
    observed_wrapper_exit_code = $null
    graphify_exit_code = $null
    graphify_status = 'NOT_RUN'
    timed_out = $false
    guardrail_failed = $false
    orphan_risk = $false
    temp_cleanup_status = 'NOT_RUN'
    temp_cleanup_error = ''
}
$n5MutationAttempted = $false
$n5PostMutationScan = [pscustomobject][ordered]@{
    status = 'NOT_REQUIRED'
    mutation_attempted = $false
    exit_code = $null
    error = ''
}
$n5ReleaseRequired = $false
$n5ReleaseExpectedGraphOrphanRisk = $false
$n5ReleaseEvidence = [pscustomobject][ordered]@{
    required = $false
    status = 'NOT_REQUIRED'
    selected_mode = $null
    observed = $null
    error = ''
    GraphOrphanRisk = $false
}

function Complete-NightlyRun([int]$NativeExitCode, [string]$TerminalState) {
    try { Enter-NightlyTerminalization -GuardPath $terminalGuardPath }
    catch { Exit-NightlyTerminalFailure "terminal guard entry failed: $($_.Exception.Message)" }

    try {
        $finalHead = $null
        $requiredRefOid = $null
        try { $finalHead = (git -C $RepoRoot rev-parse HEAD).Trim() } catch {}
        try { $requiredRefOid = (git -C $RepoRoot rev-parse --verify "$serveGateRequiredRef^{commit}").Trim() } catch {}
        $buildStampOid = $null
        try {
            $stampText = Get-Content -LiteralPath (Join-Path $RepoRoot 'wiki\.build-stamp') -Raw
            $stampMatches = [regex]::Matches($stampText, '(?m)^HEAD:\s*([0-9a-f]{40})\s*$')
            if ($stampMatches.Count -eq 1) { $buildStampOid = $stampMatches[0].Groups[1].Value }
        } catch {}
        $serveGateResult = if ($serveGateSummary -match '^allowed=True;' -and $finalHead -and $requiredRefOid -and $finalHead -eq $requiredRefOid) { 'PASS' } else { 'FAIL' }
        $n6Publication = if ($wikiServedStatus -eq 'SERVED_WIKI_SWAPPED') { 'SERVED_WIKI_SWAPPED' } else { [string]$wikiServedStatus }
        $finalState = $TerminalState
        $finalExit = $NativeExitCode
        if ($finalState -eq 'SUCCESS' -and ($finalExit -ne 0 -or $n0OrphanStatus -ne 'OK' -or $step1Status -ne 'OK' -or $step2Status -ne 'OK' -or $step5Status -eq 'FAIL' -or $step6Status -ne 'OK' -or $n6Publication -ne 'SERVED_WIKI_SWAPPED' -or $serveGateResult -ne 'PASS' -or $finalCanonicalizationEvidence.status -ne 'PASS' -or $finalGraphSmokeEvidence.status -ne 'PASS' -or $servedGraphHashStatus -ne 'PASS' -or ($semanticExecutionAttempted -and -not (Test-NightlySemanticEvidenceSuccess -Evidence $semanticEvidence -ExpectedRunId $runId)) -or (-not (Test-NightlyN5PostMutationScanEvidence -Evidence $n5PostMutationScan -ExpectedMutationAttempted $n5MutationAttempted)) -or (-not (Test-NightlyN5ReleaseEvidence -Evidence $n5ReleaseEvidence -ExpectedRequired $n5ReleaseRequired -ExpectedGraphOrphanRisk $n5ReleaseExpectedGraphOrphanRisk)))) {
            $finalState = 'FAILED'
            $finalExit = 1
        }

        # Deliberately the last child process: all other external facts are frozen.
        $custodyExit = 1
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $checkOrphansPath -Mode EvaluateTerminal -RunId $runId -RuntimeRoot $RepoRoot -RunParentPid $PID -OutputPath $custodyTerminalPath -BaselinePath $custodyBaselinePath -ExpectedBaselineSha256 $custodyBaselineSha256
        $custodyExit = $LASTEXITCODE
        if (-not (Test-Path -LiteralPath $custodyTerminalPath -PathType Leaf)) { throw 'terminal process custody evidence is missing' }
        $terminalProcessCustodyEvidence = Get-Content -LiteralPath $custodyTerminalPath -Raw | ConvertFrom-Json
        if ([string]$terminalProcessCustodyEvidence.expected_baseline_sha256 -cne $custodyBaselineSha256 -or
            [string]$terminalProcessCustodyEvidence.observed_baseline_sha256 -cne $custodyBaselineSha256) {
            throw 'terminal process custody baseline hash binding contradiction'
        }
        $custodyEvidencePass = ([string]$terminalProcessCustodyEvidence.result -ceq 'PASS')
        if (($custodyExit -eq 0) -ne $custodyEvidencePass) { throw 'terminal process custody exit/evidence contradiction' }
        $custody = if ($custodyEvidencePass) { 'PASS' } else { 'FAIL' }
        if ($custody -ne 'PASS') { $finalState = 'FAILED'; $finalExit = 1 }

        $completedAtUtc = [datetime]::UtcNow
        $terminalReceipt = [pscustomobject][ordered]@{
            schema_version = '1.0'
            run_id = $runId
            task_definition_id = $TaskDefinitionId.ToString('D').ToLowerInvariant()
            started_at_utc = $startedAtUtc.ToString('o')
            completed_at_utc = $completedAtUtc.ToString('o')
            duration_seconds = [math]::Round(($completedAtUtc - $startedAtUtc).TotalSeconds, 3)
            terminal_state = $finalState
            native_exit_code = $finalExit
            n0_orphan = $n0OrphanStatus
            n1_build = $step1Status
            n2_cluster = $step2Status
            n5_semantic = $step5Status
            n6_wiki = $step6Status
            n6_publication = $n6Publication
            serve_gate = $serveGateResult
            final_canonicalization = $finalCanonicalizationEvidence
            final_graph_smoke = $finalGraphSmokeEvidence
            semantic_evidence = $semanticEvidence
            n5_post_mutation_scan = $n5PostMutationScan
            n5_release = $n5ReleaseEvidence
            served_graph_sha256 = $servedGraphSha256
            required_ref = $serveGateRequiredRef
            head_oid = $finalHead
            required_ref_oid = $requiredRefOid
            build_stamp_oid = $buildStampOid
            terminal_process_custody = $custody
            terminal_process_custody_evidence = $terminalProcessCustodyEvidence
        }
        Publish-NightlyTerminalReceipt -Receipt $terminalReceipt -ReceiptPath $terminalReceiptPath
        try { Stop-Transcript | Out-Null } catch {}
        exit $finalExit
    } catch {
        Exit-NightlyTerminalFailure "post-guard terminalization failed: $($_.Exception.Message)"
    }
}

trap {
    Write-Host "FAIL: UNHANDLED $($_.Exception.Message)"
    Complete-NightlyRun 1 'FAILED'
}

Write-Host "--- N0 PREFLIGHT ---"
Write-Host "PASS: process custody baseline $custodyBaselineSha256"

$commonDir = (git -C $RepoRoot rev-parse --git-common-dir).Trim()
$hookDrift = $false
$hookPath = Join-Path $RepoRoot "$commonDir\hooks"
if (Test-Path $hookPath) {
    Get-ChildItem -Path $hookPath -File -ErrorAction SilentlyContinue | ForEach-Object {
        if ((Get-Content $_.FullName -Raw) -match 'graphify-hook-start') {
            $hookDrift = $true
        }
    }
}
if ($hookDrift) {
    Write-Host "FAIL: HOOK_DRIFT"
    "HOOK_DRIFT" | Set-Content (Join-Path $logDir "receipt-$stamp.md")
    Complete-NightlyRun 1 'FAILED'
}

$treeDirty = $false
if (Test-Path (Join-Path $RepoRoot "$commonDir\rebase-merge")) { $treeDirty = $true }
if (Test-Path (Join-Path $RepoRoot "$commonDir\rebase-apply")) { $treeDirty = $true }
if (Test-Path (Join-Path $RepoRoot "$commonDir\MERGE_HEAD")) { $treeDirty = $true }
if ($treeDirty) {
    Write-Host "SKIP: SKIPPED_DIRTY_TREE"
    "SKIPPED_DIRTY_TREE" | Set-Content (Join-Path $logDir "receipt-$stamp.md")
    Complete-NightlyRun 0 'SKIPPED'
}
$n0PorcelainLines = @(git -C $RepoRoot status --porcelain).Count
$n0Head = (git -C $RepoRoot rev-parse HEAD).Trim()

Write-Host "--- N1 FETCH+SCOPE+HASH ---"
$serveGateRunId = [guid]::NewGuid().ToString('N')
$serveGateFetchReceipt = Join-Path $logDir "serve-gate-fetch-$stamp-$serveGateRunId.json"
$promotionCandidate = Join-Path $logDir "promotion-candidate-$stamp-$serveGateRunId.json"
$serveGateFetchRaw = (& $pythonExe (Join-Path $RepoRoot "tooling\wiki\serve_gate.py") --repo-root $RepoRoot --config $configFile fetch --receipt $serveGateFetchReceipt) -join "`n"
$fetchOk = ($LASTEXITCODE -eq 0)
try {
    $serveGateFetchResult = $serveGateFetchRaw | ConvertFrom-Json
    if ($serveGateFetchResult.required_ref) {
        $serveGateRequiredRef = $serveGateFetchResult.required_ref
    }
} catch {
    $fetchOk = $false
}

# --emit-overlay is REQUIRED here (codex P2): without regenerating the docs-trust
# negation overlay the root *.md blanket excludes every registered doc from N1 build.
& $pythonExe (Join-Path $RepoRoot "tooling\wiki\gen_docs_scope.py") --repo-root $RepoRoot --out (Join-Path $RepoRoot "graphify-out\docs_scope.json") --emit-overlay
$docsScopeExit = $LASTEXITCODE
if (-not (Test-NightlyExactZero $docsScopeExit)) {
    Write-Host "FAIL: DOCS_SCOPE_FAIL"
    "DOCS_SCOPE_FAIL" | Set-Content (Join-Path $logDir "receipt-$stamp.md")
    Complete-NightlyRun 1 'FAILED'
}

$hashBytes = New-Object System.Collections.Generic.List[byte]
$gi = Join-Path $RepoRoot ".graphifyignore"
if (Test-Path $gi) { $hashBytes.AddRange([System.IO.File]::ReadAllBytes($gi)) }
$giti = Join-Path $RepoRoot ".gitignore"
if (Test-Path $giti) { $hashBytes.AddRange([System.IO.File]::ReadAllBytes($giti)) }
$ds = Join-Path $RepoRoot "graphify-out\docs_scope.json"
if (Test-Path $ds) { $hashBytes.AddRange([System.IO.File]::ReadAllBytes($ds)) }

$graphifyVer = & $graphifyExe --version
$hashBytes.AddRange([System.Text.Encoding]::UTF8.GetBytes("$graphifyVer"))
$hashBytes.AddRange([System.Text.Encoding]::UTF8.GetBytes("$RepoRoot"))

$sha256 = [System.Security.Cryptography.SHA256]::Create()
$hashString = [BitConverter]::ToString($sha256.ComputeHash($hashBytes.ToArray())).Replace("-", "").ToLower()

$forceFull = $true
$hashFile = Join-Path $RepoRoot "graphify-out\.scan_config_hash"
if (Test-Path $hashFile) {
    $existingHash = (Get-Content $hashFile -Raw).Trim()
    if ($existingHash -eq $hashString) {
        $forceFull = $false
    }
}

Write-Host "--- N1 BUILD ---"
$n1BuildOk = $false
if ($forceFull) {
    $gj = Join-Path $RepoRoot "graphify-out\graph.json"
    if (Test-Path $gj) { Remove-Item $gj -Force }
    $gr = Invoke-GraphifyGuarded -GraphifyExe $graphifyExe -GraphifyArgs @('update', $RepoRoot, '--no-cluster') -TimeoutSec $cfgTimeoutUpdateFull
} else {
    $gr = Invoke-GraphifyGuarded -GraphifyExe $graphifyExe -GraphifyArgs @('update', $RepoRoot, '--no-cluster') -TimeoutSec $cfgTimeoutUpdateInc
}

if ($gr.OrphanRisk) { $graphOrphanRisk = $true }
if ($gr.GuardrailFailed -or $gr.TimedOut -or $gr.ExitCode -ne 0) {
    Write-Host "FAIL: graphify update"
    $step1Status = "FAIL"
} else {
    $canonicalReceipt = Join-Path $logDir "canonicalization-precluster-$stamp.json"
    & $pythonExe (Join-Path $RepoRoot "tooling\wiki\canonicalize_graph.py") --graph (Join-Path $RepoRoot "graphify-out\graph.json") --repo-root $RepoRoot --receipt $canonicalReceipt
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAIL: graph canonicalization"
        $step1Status = "FAIL"
    } else {
        $step1Status = "OK"
        $n1BuildOk = $true
        Set-Content -Path $hashFile -Value $hashString
    }
}

Write-Host "--- N2 CLUSTER ---"
if ($graphOrphanRisk) {
    Write-Host "SKIP: graphOrphanRisk"
    $step2Status = "SKIPPED_ORPHAN_RISK"
} elseif (-not $n1BuildOk) {
    Write-Host "SKIP: graph canonicalization failed"
    $step2Status = "SKIPPED_BUILD_FAIL"
} else {
    $gr = Invoke-GraphifyGuarded -GraphifyExe $graphifyExe -GraphifyArgs @('cluster-only', $RepoRoot, '--no-label', '--no-viz') -TimeoutSec $cfgTimeoutCluster
    if ($gr.OrphanRisk) { $graphOrphanRisk = $true }
    if ($gr.GuardrailFailed -or $gr.TimedOut -or $gr.ExitCode -ne 0) {
        Write-Host "FAIL: graphify cluster-only"
        $step2Status = "FAIL"
    } else {
        $step2Status = "OK"
    }
}

if (-not (Test-Path (Join-Path $RepoRoot "graphify-out\graph.json"))) {
    Write-Host "WARN: graph.json missing"
}

Write-Host "--- N3 SECRETS ---"
if ($graphOrphanRisk -or -not $n1BuildOk -or $step2Status -ne "OK") {
    Write-Host "SKIP: N3 secrets requires proven N1/N2 graph completion without orphan risk"
} else {
    & $pythonExe (Join-Path $RepoRoot "tooling\wiki\scan_secrets.py") --repo-root $RepoRoot --target graphify-out
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAIL: SECRET_HIT"
        "SECRET_HIT" | Set-Content (Join-Path $logDir "receipt-$stamp.md")
        Complete-NightlyRun 1 'FAILED'
    }
}

Write-Host "--- N4 SMOKE ---"
if ($graphOrphanRisk -or -not $n1BuildOk -or $step2Status -ne "OK") {
    Write-Host "SKIP: N4 smoke requires proven N1/N2 graph completion without orphan risk"
} else {
    & $pythonExe (Join-Path $RepoRoot "tooling\wiki\graph_smoke.py") --graph (Join-Path $RepoRoot "graphify-out\graph.json") --repo-root $RepoRoot --require-communities --receipt (Join-Path $logDir "smoke-$stamp.json")
    $n4SmokeExit = $LASTEXITCODE
    if (-not (Test-NightlyExactZero $n4SmokeExit)) {
        Write-Host "FAIL: SMOKE_FAIL"
        "SMOKE_FAIL" | Set-Content (Join-Path $logDir "receipt-$stamp.md")
        Complete-NightlyRun 1 'FAILED'
    }
}

Write-Host "--- N5 SEMANTIC ---"
$semanticSkippedReason = ""
$n5Plan = Get-NightlyN5Plan -SkipLabeling $SkipLabeling -SkipSemantic $SkipSemantic `
    -LabelOnlyExpiryMinutes $cfgExpiryLabelOnly -LabelAndSemanticExpiryMinutes $cfgExpiryLabelSem
Write-Host "N5 plan mode: $($n5Plan.Mode)"
if ($graphOrphanRisk) {
    $semanticSkippedReason = "graphOrphanRisk"
} elseif (-not $n1BuildOk) {
    $semanticSkippedReason = "N1BuildFail"
} elseif ($step2Status -ne "OK") {
    $semanticSkippedReason = "N2ClusterFail"
} elseif ($n5Plan.SkipAll) {
    $semanticSkippedReason = "SkipFlags"
}

if ($semanticSkippedReason) {
    $step5Status = "SEMANTIC_SKIPPED_$semanticSkippedReason"
} else {
    $lockMins = $n5Plan.LockExpiryMinutes
    $h = Invoke-OllamaLockAcquire -BlockId 'SSTAC-NIGHTLY' -Purpose 'nightly label+semantic' -ExpiryMinutes $lockMins -Model $cfgModel
    if ($null -eq $h) {
        $step5Status = "SEMANTIC_SKIPPED_LOCK"
    } else {
        # Exit codes are CHECKED (codex P2, 2026-07-22): a red label/semantic run must never
        # release COMPLETED_GREEN, never promote, and never let the receipt read OK. Single
        # release site (the finally) -- no branch releases early (no double-release).
        $step5Fail = $false
        $secretHitPost = $false
        $n5UnexpectedException = $false
        try {
            if ($n5Plan.RunLabel) {
                $n5MutationAttempted = $true
                $gr = Invoke-GraphifyGuarded -GraphifyExe $graphifyExe -GraphifyArgs @('label', $RepoRoot, '--backend=ollama', "--model=$cfgModel", '--max-concurrency=1') -TimeoutSec $cfgTimeoutLabel
                if ($gr.OrphanRisk) { $gpuOrphanRisk = $true }
                if ($gr.GuardrailFailed -or $gr.TimedOut -or $gr.ExitCode -ne 0) {
                    $step5Fail = $true
                } else {
                    $postLabelCanonicalReceipt = Join-Path $logDir "canonicalization-postlabel-$runId.json"
                    & $pythonExe (Join-Path $RepoRoot "tooling\wiki\canonicalize_graph.py") --graph (Join-Path $RepoRoot "graphify-out\graph.json") --repo-root $RepoRoot --receipt $postLabelCanonicalReceipt
                    if ($LASTEXITCODE -ne 0) {
                        Write-Host "FAIL: post-label graph canonicalization"
                        $step5Fail = $true
                    }
                }
            }
            if ($n5Plan.RunSemantic -and -not $gpuOrphanRisk -and -not $step5Fail) {
                $semanticExecutionAttempted = $true
                $semanticEvidence.receipt_name = Split-Path -Leaf $semanticEvidencePath
                $semArgs = @('-NoProfile','-ExecutionPolicy','Bypass','-File', (Join-Path $RepoRoot "tooling\wiki\semantic_extract.ps1"), '-SkipLock', '-TimeoutSec', $cfgTimeoutSemInner, '-EvidencePath', $semanticEvidencePath, '-EvidenceRunId', $runId)
                $n5MutationAttempted = $true
                $sr = Invoke-GraphifyGuarded -GraphifyExe 'powershell' -GraphifyArgs $semArgs -TimeoutSec $cfgTimeoutSemOuter
                try {
                    $semanticEvidence = Get-NightlyValidatedSemanticEvidence `
                        -Path $semanticEvidencePath -ExpectedRunId $runId `
                        -ObservedWrapperExitCode $sr.ExitCode
                } catch {
                    $semanticEvidence.status = 'FAIL'
                    Write-Host "FAIL: semantic evidence validation: $($_.Exception.Message)"
                    $step5Fail = $true
                }
                if ($sr.OrphanRisk -or ($sr.ExitCode -eq 124)) { $gpuOrphanRisk = $true }
                if ($sr.GuardrailFailed -or $sr.TimedOut -or $sr.ExitCode -ne 0) {
                    $step5Fail = $true
                } elseif (-not $step5Fail) {
                    $postSemanticCanonicalReceipt = Join-Path $logDir "canonicalization-postsemantic-$runId.json"
                    & $pythonExe (Join-Path $RepoRoot "tooling\wiki\canonicalize_graph.py") --graph (Join-Path $RepoRoot "graphify-out\graph.json") --repo-root $RepoRoot --receipt $postSemanticCanonicalReceipt
                    if ($LASTEXITCODE -ne 0) {
                        Write-Host "FAIL: post-semantic graph canonicalization"
                        $step5Fail = $true
                    }
                }

                if (-not $step5Fail) {
                    $n5MutationAttempted = $true
                    $postSemanticCluster = Invoke-GraphifyGuarded -GraphifyExe $graphifyExe -GraphifyArgs @('cluster-only', $RepoRoot, '--no-label', '--no-viz') -TimeoutSec $cfgTimeoutCluster
                    if ($postSemanticCluster.OrphanRisk) { $gpuOrphanRisk = $true }
                    if ($postSemanticCluster.GuardrailFailed -or $postSemanticCluster.TimedOut -or $postSemanticCluster.ExitCode -ne 0) {
                        Write-Host "FAIL: post-semantic graphify cluster-only"
                        $step5Fail = $true
                    } else {
                        $postSemanticSmokeReceipt = Join-Path $logDir "smoke-postsemantic-$runId.json"
                        & $pythonExe (Join-Path $RepoRoot "tooling\wiki\graph_smoke.py") --graph (Join-Path $RepoRoot "graphify-out\graph.json") --repo-root $RepoRoot --require-communities --receipt $postSemanticSmokeReceipt
                        if ($LASTEXITCODE -ne 0) {
                            Write-Host "FAIL: post-semantic clustered graph smoke"
                            $step5Fail = $true
                        }
                    }
                }

            }

            # One common post-mutation secrets scan covers LABEL_ONLY, SEMANTIC_ONLY,
            # and LABEL_AND_SEMANTIC after the final attempted graph mutator.
            $n5PostMutationScan = Invoke-NightlyN5PostMutationScan `
                -MutationAttempted $n5MutationAttempted -PythonExe $pythonExe -RepoRoot $RepoRoot
            if (-not (Test-NightlyN5PostMutationScanEvidence -Evidence $n5PostMutationScan `
                -ExpectedMutationAttempted $n5MutationAttempted)) {
                Write-Host "FAIL: N5 post-mutation secrets scan: $($n5PostMutationScan.error)"
                $secretHitPost = $true
                $step5Fail = $true
            }

            # PROMOTION (THE ONLY invocation; skipped on any semantic-step or scan failure).
            if ($n5Plan.RunSemantic) {
                if ($step5Fail) {
                    $promStatus = "PROMOTION_SKIPPED_SEMANTIC_FAIL"
                } else {
                    $currHead = (git -C $RepoRoot rev-parse HEAD).Trim()
                    $currPorcelain = @(git -C $RepoRoot status --porcelain --untracked-files=no)
                    if ($currPorcelain.Count -ne 0) {
                        $promStatus = "PROMOTION_SKIPPED_DIRTY_TREE"
                    } elseif ($currHead -ne $n0Head) {
                        $promStatus = "PROMOTION_SKIPPED_HEAD_MOVED"
                    } else {
                        $servedPromotion = Join-Path $RepoRoot "wiki\.graph\promotion.json"
                        try {
                            if (Test-Path -LiteralPath $servedPromotion) {
                                Copy-Item -LiteralPath $servedPromotion -Destination $promotionCandidate -Force -ErrorAction Stop
                            }
                            $promArgs = @((Join-Path $RepoRoot "tooling\wiki\promotion.py"), '--graph', (Join-Path $RepoRoot "graphify-out\graph.json"), '--state', $promotionCandidate, '--commit', (git -C $RepoRoot rev-parse --short HEAD).Trim(), '--report')
                            & $pythonExe @promArgs
                            if ($LASTEXITCODE -ne 0) {
                                $promStatus = "PROMOTION_FAILED"
                                $step5Fail = $true
                            } else {
                                $promotionCandidateReady = Test-Path -LiteralPath $promotionCandidate
                                $promStatus = "PROMOTION_DONE"
                            }
                        } catch {
                            Write-Host "FAIL: promotion candidate preparation: $($_.Exception.Message)"
                            $promStatus = "PROMOTION_FAILED"
                            $step5Fail = $true
                        }
                    }
                }
            }
        } catch {
            $step5Fail = $true
            $n5UnexpectedException = $true
            $step5Status = "FAIL"
            Write-Host "FAIL: unexpected N5 exception: $($_.Exception.Message)"
        } finally {
            $n5ReleaseRequired = $true
            $n5ReleaseExpectedGraphOrphanRisk = [bool]$gpuOrphanRisk
            $n5ReleaseEvidence = Invoke-NightlyN5Release -Handle $h -GpuOrphanRisk $gpuOrphanRisk `
                -Step5Fail $step5Fail -UnexpectedException $n5UnexpectedException
            if (-not (Test-NightlyN5ReleaseEvidence -Evidence $n5ReleaseEvidence `
                -ExpectedRequired $true -ExpectedGraphOrphanRisk $n5ReleaseExpectedGraphOrphanRisk)) {
                $step5Fail = $true
            }
            if ($n5ReleaseExpectedGraphOrphanRisk) { $graphOrphanRisk = $true }
        }
        $step5Status = if ($step5Fail) { "FAIL" } else { "OK" }
        if ($secretHitPost) {
            "SECRET_HIT_POST" | Set-Content (Join-Path $logDir "receipt-$stamp.md")
            Complete-NightlyRun 1 'FAILED'
        }
    }
}

Write-Host "--- N5b PRE-PUBLICATION GRAPH INTEGRITY ---"
$prePublishGraphIntegrityOk = $false
if (-not $graphOrphanRisk -and $n1BuildOk -and $step2Status -eq "OK" -and $step5Status -ne "FAIL") {
    $canonicalReceipt = Join-Path $logDir "canonicalization-prepublish-$runId.json"
    $finalCanonicalizationEvidence.status = 'FAIL'
    $finalCanonicalizationEvidence.receipt_name = Split-Path -Leaf $canonicalReceipt
    & $pythonExe (Join-Path $RepoRoot "tooling\wiki\canonicalize_graph.py") --graph (Join-Path $RepoRoot "graphify-out\graph.json") --repo-root $RepoRoot --receipt $canonicalReceipt
    $canonicalExit = $LASTEXITCODE
    if ($canonicalExit -eq 0 -and (Test-Path -LiteralPath $canonicalReceipt -PathType Leaf)) {
        try {
            $canonicalData = Get-Content -LiteralPath $canonicalReceipt -Raw | ConvertFrom-Json
            $canonicalNodeCount = Get-NightlyExactNonnegativeInteger $canonicalData 'node_count' 10000000
            $canonicalLinkCount = Get-NightlyExactNonnegativeInteger $canonicalData 'link_count' 50000000
            $canonicalMaterializedCount = Get-NightlyExactNonnegativeInteger $canonicalData 'materialized_endpoint_node_count' 10000000
            $canonicalRemovedCount = Get-NightlyExactNonnegativeInteger $canonicalData 'removed_prior_materialized_endpoint_node_count' 10000000
            $canonicalUndeclaredEndpointCount = Get-NightlyExactNonnegativeInteger $canonicalData 'undeclared_endpoint_occurrence_count' 50000000
            $canonicalUndeclaredHyperedgeCount = Get-NightlyExactNonnegativeInteger $canonicalData 'undeclared_hyperedge_member_occurrence_count' 50000000
            $canonicalRuntimeRootCount = Get-NightlyExactNonnegativeInteger $canonicalData 'runtime_root_derived_id_occurrence_count' 50000000
            if ($canonicalNodeCount -lt 1 -or $canonicalNodeCount -gt 10000000 -or
                $canonicalLinkCount -lt 1 -or $canonicalLinkCount -gt 50000000 -or
                $canonicalMaterializedCount -lt 0 -or $canonicalMaterializedCount -gt $canonicalNodeCount -or
                $canonicalRemovedCount -lt 0 -or $canonicalRemovedCount -gt 10000000 -or
                $canonicalUndeclaredEndpointCount -ne 0 -or
                $canonicalUndeclaredHyperedgeCount -ne 0 -or
                $canonicalRuntimeRootCount -ne 0) {
                throw 'canonicalization receipt contains unsafe graph counts'
            }
            $finalCanonicalizationEvidence.status = 'PASS'
            $finalCanonicalizationEvidence.receipt_sha256 = Get-NightlyFileSha256 $canonicalReceipt
            $finalCanonicalizationEvidence.node_count = $canonicalNodeCount
            $finalCanonicalizationEvidence.link_count = $canonicalLinkCount
            $finalCanonicalizationEvidence.materialized_endpoint_node_count = $canonicalMaterializedCount
            $finalCanonicalizationEvidence.removed_prior_materialized_endpoint_node_count = $canonicalRemovedCount
        } catch {
            Write-Host "FAIL: final canonicalization receipt validation: $($_.Exception.Message)"
            $finalCanonicalizationEvidence.status = 'FAIL'
        }
    }
    if ($finalCanonicalizationEvidence.status -eq 'PASS') {
        $smokeReceipt = Join-Path $logDir "smoke-prepublish-$runId.json"
        $finalGraphSmokeEvidence.status = 'FAIL'
        $finalGraphSmokeEvidence.receipt_name = Split-Path -Leaf $smokeReceipt
        & $pythonExe (Join-Path $RepoRoot "tooling\wiki\graph_smoke.py") --graph (Join-Path $RepoRoot "graphify-out\graph.json") --repo-root $RepoRoot --require-communities --receipt $smokeReceipt
        $smokeExit = $LASTEXITCODE
        if ($smokeExit -eq 0 -and (Test-Path -LiteralPath $smokeReceipt -PathType Leaf)) {
            try {
                $smokeData = Get-Content -LiteralPath $smokeReceipt -Raw | ConvertFrom-Json
                $smokeNodeCount = Get-NightlyExactNonnegativeInteger $smokeData.graph_integrity 'node_count' 10000000
                $smokeLinkCount = Get-NightlyExactNonnegativeInteger $smokeData.graph_integrity 'link_count' 50000000
                $smokeCommunityCount = Get-NightlyExactNonnegativeInteger $smokeData.community_contract 'distinct_community_count' 10000000
                $smokePopulatedNodeCount = Get-NightlyExactNonnegativeInteger $smokeData.community_contract 'populated_node_count' 10000000
                $smokeGraphSha256 = [string]$smokeData.graph_sha256
                if ($smokeData.hard_abort -isnot [bool] -or $smokeData.hard_abort -or
                    [string]$smokeData.graph_integrity.status -cne 'PASS' -or
                    [string]$smokeData.community_contract.status -cne 'PASS' -or
                    $smokeNodeCount -ne $finalCanonicalizationEvidence.node_count -or
                    $smokeLinkCount -ne $finalCanonicalizationEvidence.link_count -or
                    $smokePopulatedNodeCount -ne $smokeNodeCount -or
                    $smokeCommunityCount -lt 1 -or $smokeCommunityCount -gt $smokeNodeCount -or
                    -not (Test-NightlyGraphSha256 (Join-Path $RepoRoot "graphify-out\graph.json") $smokeGraphSha256)) {
                    throw 'smoke receipt contradicts final canonical graph'
                }
                $finalGraphSmokeEvidence.status = 'PASS'
                $finalGraphSmokeEvidence.receipt_sha256 = Get-NightlyFileSha256 $smokeReceipt
                $finalGraphSmokeEvidence.node_count = $smokeNodeCount
                $finalGraphSmokeEvidence.link_count = $smokeLinkCount
                $finalGraphSmokeEvidence.distinct_community_count = $smokeCommunityCount
                $finalGraphSmokeEvidence.graph_sha256 = $smokeGraphSha256
                $prePublishGraphIntegrityOk = $true
            } catch {
                Write-Host "FAIL: final smoke receipt validation: $($_.Exception.Message)"
                $finalGraphSmokeEvidence.status = 'FAIL'
            }
        }
    }
}
if (-not $prePublishGraphIntegrityOk) {
    Write-Host "FAIL: pre-publication graph integrity"
}

Write-Host "--- N6 WIKI ---"
$wikiServedStatus = ""
$publishHelper = Join-Path $RepoRoot "tooling\wiki\publish_wiki.py"
$ws = Join-Path $RepoRoot "wiki.staging"
$w = Join-Path $RepoRoot "wiki"
$publishBackup = Join-Path $logDir "wiki-backup-$stamp-$PID"
if ($graphOrphanRisk -or -not $n1BuildOk -or $step2Status -ne "OK" -or $step5Status -eq "FAIL" -or -not $prePublishGraphIntegrityOk) {
    # A red cluster step blocks serve too (codex P2): never compile/serve over a graph
    # whose required cluster pass failed, even though the raw build succeeded.
    $step6Status = "SKIPPED_PREV_FAIL"
} else {
    & $pythonExe $publishHelper --repo-root $RepoRoot prepare --served $w --staging $ws
    $prepareExit = $LASTEXITCODE
    $compileExit = 1
    $lintExit = 1
    $secretExit = 1
    if ($prepareExit -eq 0) {
        & $pythonExe (Join-Path $RepoRoot "tooling\wiki\wiki_compile.py") --graph (Join-Path $RepoRoot "graphify-out\graph.json") --repo-root $RepoRoot --out $ws --stamp $stamp
        $compileExit = $LASTEXITCODE
    }
    if ($compileExit -eq 0) {
        & $pythonExe (Join-Path $RepoRoot "tooling\wiki\wiki_lint.py") --wiki $ws
        $lintExit = $LASTEXITCODE
    }
    if ($lintExit -eq 0) {
        & $pythonExe (Join-Path $RepoRoot "tooling\wiki\scan_secrets.py") --repo-root $RepoRoot --target wiki.staging
        $secretExit = $LASTEXITCODE
    }

    $semanticPartial = $false
    $grpt = Join-Path $RepoRoot "graphify-out\GRAPH_REPORT.md"
    if (Test-Path $grpt) {
        if ((Get-Content $grpt -Raw) -match 'SUSPECT_PARTIAL') {
            $semanticPartial = $true
        }
    }
    
    $trackedClean = (@(git -C $RepoRoot status --porcelain --untracked-files=no).Count -eq 0)
    $headUnchanged = ((git -C $RepoRoot rev-parse HEAD).Trim() -eq $n0Head)

    $serveGateRaw = (& $pythonExe (Join-Path $RepoRoot "tooling\wiki\serve_gate.py") --repo-root $RepoRoot --config $configFile verify --receipt $serveGateFetchReceipt) -join "`n"
    $serveGateExit = $LASTEXITCODE
    $serveGateOk = $false
    $serveGateReasons = @()
    try {
        $serveGateResult = $serveGateRaw | ConvertFrom-Json
        $serveGateOk = ($serveGateExit -eq 0 -and $serveGateResult.allowed)
        $serveGateReasons = @($serveGateResult.reasons)
        $serveGateSummary = "allowed=$serveGateOk; required_ref=$($serveGateResult.required_ref); fetched_oid=$($serveGateResult.fetched_oid); head=$($serveGateResult.head); ref_head=$($serveGateResult.required_ref_head)"
    } catch {
        $serveGateReasons = @("Serve gate returned invalid output")
        $serveGateSummary = "allowed=False; invalid evaluator output"
    }
    
    # Freshness of receipt lineage OK
    $freshnessOk = $true
    # Skip clause on first run (if no receipt exists)
    $hasReceipts = @(Get-ChildItem -Path $logDir -Filter "receipt-*.md" -File -ErrorAction SilentlyContinue).Count -gt 0
    if ($hasReceipts) {
        if (Test-Path (Join-Path $RepoRoot "tooling\wiki\check_nightly_freshness.ps1")) {
            & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "tooling\wiki\check_nightly_freshness.ps1") -RepoRoot $RepoRoot
            if ($LASTEXITCODE -ne 0) { $freshnessOk = $false }
        }
    }
    
    $artifactsOk = ($prepareExit -eq 0 -and $compileExit -eq 0 -and $lintExit -eq 0 -and $secretExit -eq 0)
    if ($serveGateOk -and $trackedClean -and $headUnchanged -and $artifactsOk -and -not $semanticPartial -and $freshnessOk) {
        $promotionStateArgs = @()
        if ($promotionCandidateReady) {
            $promotionStateArgs = @('--promotion-state', $promotionCandidate)
        }
        $graphPathForPublication = Join-Path $RepoRoot "graphify-out\graph.json"
        if (-not (Test-NightlyGraphSha256 $graphPathForPublication $finalGraphSmokeEvidence.graph_sha256)) {
            Write-Host "FAIL: graph bytes changed after final smoke and before finalize"
            $finalizeExit = 1
            $swapExit = 1
            $wikiServedStatus = "SERVED_WIKI_KEPT_LAST_GOOD (Graph changed after smoke)"
            $step6Status = "FAIL"
        } else {
            & $pythonExe $publishHelper --repo-root $RepoRoot finalize --staging $ws --graph $graphPathForPublication --graph-report $grpt --stamp $stamp --head $n0Head --expected-graph-sha256 $finalGraphSmokeEvidence.graph_sha256 @promotionStateArgs
            $finalizeExit = $LASTEXITCODE
            if ($finalizeExit -eq 0) {
                & $pythonExe $publishHelper --repo-root $RepoRoot swap --served $w --staging $ws --backup $publishBackup --expected-graph-sha256 $finalGraphSmokeEvidence.graph_sha256
                $swapExit = $LASTEXITCODE
            } else {
                $swapExit = 1
            }
            if ($finalizeExit -eq 0 -and $swapExit -eq 0) {
                $servedGraphPath = Join-Path $w '.graph\graph.json'
                if (Test-NightlyGraphSha256 $servedGraphPath $finalGraphSmokeEvidence.graph_sha256) {
                    $servedGraphSha256 = Get-NightlyFileSha256 $servedGraphPath
                    $servedGraphHashStatus = 'PASS'
                    $wikiServedStatus = "SERVED_WIKI_SWAPPED"
                    $step6Status = "OK"
                } else {
                    $servedGraphHashStatus = 'FAIL'
                    $wikiServedStatus = "SERVED_WIKI_HASH_MISMATCH"
                    $step6Status = "FAIL"
                }
            } else {
                $wikiServedStatus = "SERVED_WIKI_KEPT_LAST_GOOD (Publish failed)"
                $step6Status = "FAIL"
            }
        }
    } else {
        $wikiServedStatus = "SERVED_WIKI_KEPT_LAST_GOOD"
        $reasons = @()
        if (-not $serveGateOk) { $reasons += $serveGateReasons }
        if (-not $trackedClean) { $reasons += "Tracked files dirty" }
        if (-not $headUnchanged) { $reasons += "HEAD changed" }
        if ($prepareExit -ne 0) { $reasons += "Staging prepare failed" }
        if ($compileExit -ne 0) { $reasons += "Compile failed" }
        if ($lintExit -ne 0) { $reasons += "Lint Failed" }
        if ($secretExit -ne 0) { $reasons += "Secret Scan Failed" }
        if ($semanticPartial) { $reasons += "Semantic SUSPECT_PARTIAL" }
        if (-not $freshnessOk) { $reasons += "Freshness Failed" }
        $wikiServedStatus += " ($($reasons -join ', '))"
        $step6Status = if ($artifactsOk) { "OK" } else { "FAIL" }
    }
}

Write-Host "--- N7 RECEIPT ---"
$nodeCount = 0
$linkCount = 0
$gj = Join-Path $RepoRoot "graphify-out\graph.json"
if (Test-Path $gj) {
    try {
        $nodeCount = & $pythonExe -c "import sys, json; d=json.load(open(sys.argv[1], encoding='utf-8')); print(len(d.get('nodes',[])))" $gj
        $linkCount = & $pythonExe -c "import sys, json; d=json.load(open(sys.argv[1], encoding='utf-8')); print(len(d.get('links',[])))" $gj
    } catch {}
}

$commitsBehind = 0
$ageDays = 0
$freshnessStr = "freshness_unknown"
if ($fetchOk) {
    try {
        $commitsBehind = [int](git -C $RepoRoot rev-list --count "HEAD..$serveGateRequiredRef")
        $headTime = [int](git -C $RepoRoot log -1 --format=%ct HEAD)
        $mainTime = [int](git -C $RepoRoot log -1 --format=%ct $serveGateRequiredRef)
        if ($mainTime -gt $headTime) {
            $ageDays = [math]::Round(($mainTime - $headTime) / 86400, 1)
        }
        $freshnessStr = "commits behind: $commitsBehind, days old: $ageDays"
        if ($commitsBehind -gt 50 -or $ageDays -gt 7) {
            $freshnessStr += " [FLAGGED]"
        }
    } catch {}
}

$receiptBody = @(
    "Date: $stamp"
    "N0 Tree Lines: $n0PorcelainLines"
    "N0 Orphan Result: OK"
    "N1 Build: $step1Status"
    "N2 Cluster: $step2Status"
    "N5 Semantic: $step5Status"
    "Promotion: $promStatus"
    "N6 Wiki: $step6Status / $wikiServedStatus"
    "Serve Gate: $serveGateSummary"
    "Final Canonicalization: $($finalCanonicalizationEvidence.status) / $($finalCanonicalizationEvidence.receipt_sha256)"
    "Final Graph Smoke: $($finalGraphSmokeEvidence.status) / $($finalGraphSmokeEvidence.receipt_sha256)"
    "Nodes: $nodeCount"
    "Links: $linkCount"
    "Freshness: $freshnessStr"
)
$receiptBody | Set-Content (Join-Path $logDir "receipt-$stamp.md")

# Final predicate includes EVERY red step (codex P1): a receipt that records a failed
# cluster/semantic/wiki step must never pair with exit 0.
if ($n1BuildOk -and
    ($step2Status -ne "FAIL") -and
    ($step5Status -ne "FAIL") -and
    ($step6Status -ne "FAIL") -and
    -not $graphOrphanRisk) {
    Complete-NightlyRun 0 'SUCCESS'
} else {
    Complete-NightlyRun 1 'FAILED'
}
