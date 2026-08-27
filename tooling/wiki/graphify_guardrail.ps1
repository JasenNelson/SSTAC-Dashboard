# graphify_guardrail.ps1 -- run graphify (or any exe) with a hard timeout.
# Cleanup terminates only the exact retained root Process object. Descendant cleanup is deliberately
# unproven without a Windows Job Object, so Killed remains false and OrphanRisk carries uncertainty.

function Get-GuardedArgList {
    param([string[]]$GraphifyArgs)
    # Windows PowerShell 5.1 Start-Process flattens -ArgumentList. Quote whitespace-bearing elements
    # for the NIGHTLY's controlled arguments. Embedded quotes and trailing backslashes are out of scope.
    return @($GraphifyArgs | ForEach-Object {
        if ($_ -match '\s') { '"' + $_ + '"' } else { $_ }
    })
}

function Join-GuardedError {
    param([string]$Existing, [string]$Message)
    if ([string]::IsNullOrWhiteSpace($Existing)) { return $Message }
    if ([string]::IsNullOrWhiteSpace($Message)) { return $Existing }
    return "$Existing; $Message"
}

function Resolve-GuardedFaultMessage {
    # Windows PowerShell 5.1 wraps a failed method call in MethodInvocationException, and a faulted
    # Task wraps its cause in AggregateException. Either wrapper on its own yields the content-free
    # "One or more errors occurred.", so unwrap both before reporting. Checking only for
    # AggregateException is dead code here: the 5.1 catch sees MethodInvocationException.
    param($Fault)
    if ($null -eq $Fault) { return '' }
    $current = $Fault
    if ($current -is [System.Management.Automation.MethodInvocationException] -and
        $null -ne $current.InnerException) {
        $current = $current.InnerException
    }
    if ($current -is [System.AggregateException]) { $current = $current.GetBaseException() }
    return [string]$current.Message
}

function New-GuardedResult {
    param(
        [bool]$TimedOut,
        [int]$ExitCode,
        [Nullable[int]]$ProcId,
        [bool]$RootTerminated,
        [string]$CleanupStatus,
        [string]$CleanupError,
        [bool]$GuardrailFailed,
        [bool]$OrphanRisk,
        [string]$GuardrailError
    )
    return [pscustomobject]@{
        TimedOut = $TimedOut
        ExitCode = $ExitCode
        ProcId = if ($null -eq $ProcId) { $null } else { [int]$ProcId }
        Killed = $false
        RootTerminated = $RootTerminated
        CleanupStatus = $CleanupStatus
        CleanupError = $CleanupError
        GuardrailFailed = $GuardrailFailed
        OrphanRisk = $OrphanRisk
        GuardrailError = $GuardrailError
        ProcessDisposeError = $null
        ExecutablePath = $null
        ArgumentSnapshot = @()
        EnvironmentMode = 'INHERITED'
        LaunchEnvironment = $null
        LaunchEnvironmentSource = 'INHERITED_PARENT_BLOCK_NOT_CAPTURED'
        LaunchWorkingDirectory = $null
        EnvironmentValidationError = $null
        StartUtc = $null
        EndUtc = $null
        DurationMs = $null
    }
}

function New-GuardedCaptureResult {
    param(
        [bool]$TimedOut,
        [int]$ExitCode,
        [Nullable[int]]$ProcId,
        [bool]$RootTerminated,
        [string]$CleanupStatus,
        [string]$CleanupError,
        [bool]$GuardrailFailed,
        [bool]$OrphanRisk,
        [string]$GuardrailError
    )
    $result = New-GuardedResult @PSBoundParameters
    $result | Add-Member NoteProperty OutputReadError $null
    $result | Add-Member NoteProperty TempCleanupStatus 'PENDING'
    $result | Add-Member NoteProperty TempCleanupError $null
    $result | Add-Member NoteProperty OutputLines @()
    $result | Add-Member NoteProperty StdOutLines @()
    $result | Add-Member NoteProperty StdErrLines @()
    $result | Add-Member NoteProperty StdOutText $null
    $result | Add-Member NoteProperty StdErrText $null
    return $result
}

function New-GuardedTempFile {
    return [System.IO.Path]::GetTempFileName()
}

function ConvertTo-GuardedExactEnvironment {
    # Validate a caller-declared exact environment and return it as a case-insensitive string
    # map. Callers must compare it by KEY: the read-back is enumerated from the underlying
    # StringDictionary, whose order is hash order rather than declaration order.
    # Throws BEFORE any process is started. Windows environment keys are case-insensitive, so a
    # case-colliding declaration is ambiguous about which value would win and is rejected.
    param($ExactEnvironment)
    if ($null -eq $ExactEnvironment) { throw 'exact environment declaration is null' }
    if (-not ($ExactEnvironment -is [System.Collections.IDictionary])) {
        throw 'exact environment declaration must be a dictionary'
    }
    $comparer = [System.StringComparer]::OrdinalIgnoreCase
    $validated = New-Object 'System.Collections.Specialized.OrderedDictionary' $comparer
    foreach ($entry in $ExactEnvironment.GetEnumerator()) {
        if ($null -eq $entry.Key) { throw 'exact environment declares a null key' }
        if (-not ($entry.Key -is [string] -or $entry.Key -is [System.ValueType])) {
            throw 'exact environment declares a key with no unambiguous string conversion'
        }
        $key = [string]$entry.Key
        if ([string]::IsNullOrWhiteSpace($key)) { throw 'exact environment declares an empty key' }
        if ($key.Contains('=')) { throw "exact environment key contains an equals sign: $key" }
        # CreateProcess builds the block by concatenating "key=value" separated by NUL, so an
        # embedded NUL SPLITS the entry and injects an undeclared variable the ProcessStartInfo
        # read-back structurally cannot see: it stores the string intact and reports one key.
        # This is the only input class that can make PROCESS_START_INFO_READBACK a false claim,
        # so it is rejected here, before the read-back can vouch for it.
        if ($key.IndexOf([char]0) -ge 0) { throw "exact environment key contains a NUL character" }
        if ($validated.Contains($key)) {
            throw "exact environment declares a case-colliding duplicate key: $key"
        }
        $rawValue = $entry.Value
        if ($null -eq $rawValue) { throw "exact environment declares a null value for key: $key" }
        # Allow only values with one obvious string form. An allow-list is used because a
        # deny-list of [Array] and [IDictionary] silently stringified an ArrayList, a
        # List[string] or a pscustomobject into "System.Collections.ArrayList" or "@{a=1}".
        # This also refuses reference types that DO have a sensible ToString ([Version], [Uri],
        # [FileInfo]): cast those at the call site, so the declared value is the caller's choice
        # rather than a formatting accident. The [string] cast is culture-invariant, so a declared
        # number or date renders the same under any locale.
        if (-not ($rawValue -is [string] -or $rawValue -is [System.ValueType])) {
            throw "exact environment value for key $key has no unambiguous string conversion"
        }
        $stringValue = [string]$rawValue
        if ($stringValue.IndexOf([char]0) -ge 0) {
            throw "exact environment value for key $key contains a NUL character"
        }
        $validated[$key] = $stringValue
    }
    if ($validated.Count -eq 0) { throw 'exact environment declaration is empty' }
    return $validated
}

function New-GuardedExactStartInfo {
    # Build a ProcessStartInfo whose environment block is constructed FROM EMPTY and holds exactly
    # the validated declaration. The populated collection is read back immediately before the caller
    # starts the process; any drift throws BEFORE launch, so a process is never started under an
    # environment the guardrail cannot vouch for. The read-back describes the CONFIGURED LAUNCH
    # BLOCK only. A child may add variables to itself after start, which no launcher can observe.
    #
    # The read-back is defence in depth, not a falsifiable claim: after Clear() plus a repopulate
    # from $Validated no input that survives ConvertTo-GuardedExactEnvironment can make it throw.
    # It exists to catch a future collection-semantics change, not a caller mistake.
    #
    # SECRETS: the validated declaration is returned verbatim as LaunchEnvironment and therefore
    # lands in the result object. A declaration must contain everything the child needs, so a
    # caller that declares a token or key is putting that value into any receipt, log line or
    # ConvertTo-Json dump of the result. Redact at the serialisation boundary; this function
    # deliberately does not, because value equality is the evidence.
    param(
        [Parameter(Mandatory=$true)][string]$Exe,
        [Parameter(Mandatory=$true)][AllowEmptyCollection()][string[]]$SafeArgs,
        [Parameter(Mandatory=$true)]$Validated,
        [bool]$Capture
    )
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $Exe
    $startInfo.Arguments = ($SafeArgs -join ' ')
    $startInfo.UseShellExecute = $false
    # MEASURED, not assumed, and reproduced independently twice: Start-Process -NoNewWindow gives
    # the child the PARENT's console -- same window handle, and the parent's console process list --
    # which is exactly CreateNoWindow = $false. CreateNoWindow = $true instead allocates a fresh
    # private console (process list of 1). So $false is what keeps the two launch paths at parity.
    # Two earlier revisions got this backwards in both directions; it is settled by measurement now.
    # A child in a private console was ALSO observed encoding a non-ASCII character differently
    # from the inherited path, which is why exact mode had been silently degrading child output;
    # that secondary effect did not reproduce on every machine, so parity, not encoding, is the
    # load-bearing reason for $false.
    # Note for a console-less parent (a scheduled task): $false is still the conservative choice
    # here, because the inherited path this must match already behaves this way in that context.
    $startInfo.CreateNoWindow = $false
    if ($Capture) {
        $startInfo.RedirectStandardOutput = $true
        $startInfo.RedirectStandardError = $true
    }
    # Start-Process launches at the PowerShell session location, but a bare ProcessStartInfo
    # inherits [Environment]::CurrentDirectory, which Set-Location does NOT update. Without this
    # the two launch paths resolve relative arguments against different directories.
    $sessionLocation = Get-Location -PSProvider FileSystem -ErrorAction SilentlyContinue
    if ($null -ne $sessionLocation) { $startInfo.WorkingDirectory = $sessionLocation.ProviderPath }
    $startInfo.EnvironmentVariables.Clear()
    if ($startInfo.EnvironmentVariables.Count -ne 0) {
        throw 'process environment block did not clear'
    }
    foreach ($key in $Validated.Keys) {
        $startInfo.EnvironmentVariables[[string]$key] = [string]$Validated[$key]
    }
    $comparer = [System.StringComparer]::OrdinalIgnoreCase
    $readBack = New-Object 'System.Collections.Specialized.OrderedDictionary' $comparer
    foreach ($key in $startInfo.EnvironmentVariables.Keys) {
        $readBack[[string]$key] = [string]$startInfo.EnvironmentVariables[[string]$key]
    }
    if ($readBack.Count -ne $Validated.Count) {
        throw "configured environment holds $($readBack.Count) keys but $($Validated.Count) were declared"
    }
    foreach ($key in $Validated.Keys) {
        if (-not $readBack.Contains([string]$key)) {
            throw "declared environment key is absent from the configured block: $key"
        }
        if (([string]$readBack[[string]$key]) -cne ([string]$Validated[$key])) {
            throw "configured environment value differs from the declaration for key: $key"
        }
    }
    foreach ($key in $readBack.Keys) {
        if (-not $Validated.Contains([string]$key)) {
            throw "configured environment holds an undeclared key: $key"
        }
    }
    return [pscustomobject]@{
        StartInfo = $startInfo
        LaunchEnvironment = $readBack
        WorkingDirectory = $(
            if ([string]::IsNullOrEmpty($startInfo.WorkingDirectory)) { $null }
            else { $startInfo.WorkingDirectory }
        )
    }
}

function Set-GuardedLaunchEvidence {
    # Attach truthful launch evidence to a result. Every value here is either the exact input the
    # guardrail configured or an observation the guardrail itself made. LaunchEnvironment is the
    # block read back from ProcessStartInfo, never a restatement of caller intent, and it is null
    # whenever no exact environment was configured.
    #
    # Precision limits, stated so no reader over-reads these fields:
    #   ExecutablePath    the caller's UNRESOLVED spec. A bare name is resolved by CreateProcess
    #                     against the PARENT's PATH, not the declared one, so an exact environment
    #                     does NOT determine which binary runs and nothing records the resolved
    #                     path. Pass a full path when the identity of the binary matters.
    #   ArgumentSnapshot  the flattened, quoted arg LIST; exact mode launches with those elements
    #                     joined by single spaces.
    #   DurationMs        guardrail launch-to-cleanup span, NOT child runtime. It is null on the
    #                     paths where no launch was attempted (declaration rejected, temp
    #                     allocation failed) because StartUtc is never stamped there.
    #   LaunchWorkingDirectory  what exact mode configured; null on the inherited path, where
    #                     Start-Process uses the session location without the guardrail observing it.
    #   LaunchEnvironment caller-declared VALUES verbatim -- see the secrets note on
    #                     New-GuardedExactStartInfo before serialising a result.
    param(
        $Result,
        [string]$Exe,
        [AllowEmptyCollection()][string[]]$SafeArgs,
        [string]$EnvironmentMode,
        $LaunchEnvironment,
        [string]$LaunchEnvironmentSource,
        $LaunchWorkingDirectory,
        $EnvironmentValidationError,
        $StartUtc,
        $EndUtc
    )
    if ($null -eq $Result) { return $Result }
    $Result.ExecutablePath = $Exe
    $Result.ArgumentSnapshot = @($SafeArgs)
    $Result.EnvironmentMode = $EnvironmentMode
    $Result.LaunchEnvironment = $LaunchEnvironment
    $Result.LaunchEnvironmentSource = $LaunchEnvironmentSource
    $Result.LaunchWorkingDirectory = $LaunchWorkingDirectory
    $Result.EnvironmentValidationError = $EnvironmentValidationError
    if ($null -ne $StartUtc) { $Result.StartUtc = $StartUtc.ToString('o') }
    if ($null -ne $EndUtc) { $Result.EndUtc = $EndUtc.ToString('o') }
    if ($null -ne $StartUtc -and $null -ne $EndUtc) {
        $Result.DurationMs = [int]([Math]::Round(($EndUtc - $StartUtc).TotalMilliseconds))
    }
    return $Result
}

function Stop-GuardedRootProcess {
    param([Parameter(Mandatory=$true)]$Process)
    $errors = @()
    $rootTerminated = $false
    try {
        if ($Process.HasExited) { $rootTerminated = $true } else { $Process.Kill() }
    } catch { $errors += "root Kill failed: $($_.Exception.Message)" }
    try {
        $waited = $Process.WaitForExit(5000)
        if (-not $waited) {
            $errors += "root WaitForExit timed out after 5000 ms"
        } elseif ($Process.HasExited) {
            $rootTerminated = $true
        } else {
            $errors += "root WaitForExit returned without a terminated root"
        }
    } catch { $errors += "root WaitForExit failed: $($_.Exception.Message)" }
    if (-not $rootTerminated) {
        try { if ($Process.HasExited) { $rootTerminated = $true } }
        catch { $errors += "root termination state check failed: $($_.Exception.Message)" }
    }
    if ($errors.Count -gt 0 -or -not $rootTerminated) {
        return [pscustomobject]@{
            RootTerminated = $rootTerminated
            Status = 'ROOT_TERMINATION_FAILED'
            Error = ($errors -join '; ')
        }
    }
    return [pscustomobject]@{
        RootTerminated = $true
        Status = 'ROOT_TERMINATED_TREE_UNPROVEN'
        Error = $null
    }
}

function Set-GuardedCustodyFailure {
    param(
        [Parameter(Mandatory=$true)]$Result,
        [Parameter(Mandatory=$true)]$Process,
        [Parameter(Mandatory=$true)][string]$Message
    )
    $Result.GuardrailFailed = $true
    $Result.OrphanRisk = $true
    $Result.GuardrailError = Join-GuardedError $Result.GuardrailError $Message
    if (-not $Result.TimedOut -and $Result.ExitCode -eq 0) { $Result.ExitCode = 1 }
    try {
        $cleanup = Stop-GuardedRootProcess -Process $Process
        $Result.RootTerminated = $cleanup.RootTerminated
        $Result.CleanupStatus = $cleanup.Status
        $Result.CleanupError = $cleanup.Error
    } catch {
        $Result.RootTerminated = $false
        $Result.CleanupStatus = 'ROOT_TERMINATION_FAILED'
        $Result.CleanupError = Join-GuardedError $Result.CleanupError $_.Exception.Message
    }
    return $Result
}

function Set-GuardedAuxiliaryFailure {
    param(
        [Parameter(Mandatory=$true)]$Result,
        [Parameter(Mandatory=$true)][string]$Message
    )
    $Result.GuardrailFailed = $true
    $Result.GuardrailError = Join-GuardedError $Result.GuardrailError $Message
    if (-not $Result.TimedOut -and $Result.ExitCode -eq 0) { $Result.ExitCode = 1 }
    return $Result
}

function Invoke-GraphifyGuarded {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$GraphifyExe,
        [Parameter(Mandatory=$true)][string[]]$GraphifyArgs,
        [int]$TimeoutSec = 600,
        [System.Collections.IDictionary]$ExactEnvironment
    )
    $safeArgs = Get-GuardedArgList $GraphifyArgs
    $p = $null
    $procId = $null
    $result = $null
    $timedOut = $false
    $exitCode = 0
    $launchEnv = $null
    $launchWorkDir = $null
    # Keyed on whether the parameter was BOUND, not on whether it is non-null, so an explicitly
    # passed $null is a rejected declaration rather than a silent downgrade to an inherited launch.
    # Derived from the parameter, never from reaching a branch: a failure BEFORE the exact-mode
    # branch must not report the run as an inherited-environment run.
    $exactRequested = $PSBoundParameters.ContainsKey('ExactEnvironment')
    $envMode = if ($exactRequested) { 'EXACT' } else { 'INHERITED' }
    $envSource = if ($exactRequested) { 'EXACT_ENVIRONMENT_NOT_CONFIGURED' }
        else { 'INHERITED_PARENT_BLOCK_NOT_CAPTURED' }
    $envError = $null
    $startUtc = $null
    $endUtc = $null
    try {
        try {
            if ($exactRequested) {
                $envSource = 'EXACT_ENVIRONMENT_REJECTED_BEFORE_LAUNCH'
                $validated = ConvertTo-GuardedExactEnvironment $ExactEnvironment
                $prepared = New-GuardedExactStartInfo -Exe $GraphifyExe -SafeArgs $safeArgs `
                    -Validated $validated -Capture $false
                $launchEnv = $prepared.LaunchEnvironment
                $launchWorkDir = $prepared.WorkingDirectory
                $envSource = 'PROCESS_START_INFO_READBACK'
                $startUtc = [DateTime]::UtcNow
                $p = [System.Diagnostics.Process]::Start($prepared.StartInfo)
            } else {
                $startUtc = [DateTime]::UtcNow
                $p = Start-Process -FilePath $GraphifyExe -ArgumentList $safeArgs -PassThru -NoNewWindow
            }
        } catch {
            # Only a throw from the environment-configuration step is an environment validation
            # error. An unrelated pre-branch failure (temp allocation) must not be recorded here.
            if ($envSource -eq 'EXACT_ENVIRONMENT_REJECTED_BEFORE_LAUNCH') {
                $envError = $_.Exception.Message
            }
            $result = New-GuardedResult -TimedOut $false -ExitCode 1 -ProcId $null `
                -RootTerminated $false -CleanupStatus 'START_FAILED' -CleanupError $null `
                -GuardrailFailed $true -OrphanRisk $false -GuardrailError $_.Exception.Message
        }

        if ($null -ne $p -and $null -eq $result) {
            try {
                $procId = [int]$p.Id
                $null = $p.Handle
                $waited = $p.WaitForExit($TimeoutSec * 1000)
                if (-not $waited) {
                    $timedOut = $true
                    $exitCode = 124
                    $cleanup = Stop-GuardedRootProcess -Process $p
                    $cleanupFailed = (-not $cleanup.RootTerminated -or
                        $cleanup.Status -eq 'ROOT_TERMINATION_FAILED')
                    $result = New-GuardedResult -TimedOut $true -ExitCode 124 -ProcId $procId `
                        -RootTerminated $cleanup.RootTerminated -CleanupStatus $cleanup.Status `
                        -CleanupError $cleanup.Error -GuardrailFailed $cleanupFailed -OrphanRisk $true `
                        -GuardrailError $null
                } else {
                    $p.WaitForExit()
                    $exitCode = [int]$p.ExitCode
                    $result = New-GuardedResult -TimedOut $false -ExitCode $exitCode -ProcId $procId `
                        -RootTerminated $false -CleanupStatus 'NOT_REQUIRED' -CleanupError $null `
                        -GuardrailFailed $false -OrphanRisk $false -GuardrailError $null
                }
            } catch {
                $failureExit = if ($timedOut) { 124 } elseif ($exitCode -ne 0) { $exitCode } else { 1 }
                $result = New-GuardedResult -TimedOut $timedOut -ExitCode $failureExit -ProcId $procId `
                    -RootTerminated $false -CleanupStatus 'POST_START_FAILURE' -CleanupError $null `
                    -GuardrailFailed $true -OrphanRisk $true -GuardrailError $null
                $result = Set-GuardedCustodyFailure -Result $result -Process $p -Message $_.Exception.Message
            }
        }
    } finally {
        if ($null -ne $p) {
            if ($null -eq $result) {
                $result = New-GuardedResult -TimedOut $timedOut `
                    -ExitCode $(if ($timedOut) { 124 } else { 1 }) -ProcId $procId `
                    -RootTerminated $false -CleanupStatus 'POST_START_FAILURE' `
                    -CleanupError $null -GuardrailFailed $true -OrphanRisk $true `
                    -GuardrailError $null
                $result = Set-GuardedCustodyFailure -Result $result -Process $p `
                    -Message 'guardrail produced no result after process start'
            }
            try { $p.Dispose() }
            catch {
                $result.ProcessDisposeError = $_.Exception.Message
                $result = Set-GuardedAuxiliaryFailure -Result $result `
                    -Message "process Dispose failed: $($_.Exception.Message)"
            }
        }
        $endUtc = [DateTime]::UtcNow
        $result = Set-GuardedLaunchEvidence -Result $result -Exe $GraphifyExe -SafeArgs $safeArgs `
            -EnvironmentMode $envMode -LaunchEnvironment $launchEnv -LaunchEnvironmentSource $envSource `
            -LaunchWorkingDirectory $launchWorkDir `
            -EnvironmentValidationError $envError -StartUtc $startUtc -EndUtc $endUtc
    }
    return $result
}

function Invoke-GraphifyGuardedCapture {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$GraphifyExe,
        [Parameter(Mandatory=$true)][string[]]$GraphifyArgs,
        [int]$TimeoutSec = 1800,
        [System.Collections.IDictionary]$ExactEnvironment
    )
    $safeArgs = Get-GuardedArgList $GraphifyArgs
    $so = $null
    $se = $null
    $p = $null
    $procId = $null
    $result = $null
    $timedOut = $false
    $exitCode = 0
    $tempCleanupErrors = @()
    $allocatedTempPaths = @()
    $launchEnv = $null
    # Keyed on whether the parameter was BOUND, not on whether it is non-null, so an explicitly
    # passed $null is a rejected declaration rather than a silent downgrade to an inherited launch.
    # Derived from the parameter, never from reaching a branch: temp allocation runs BEFORE the
    # exact-mode branch, so a temp failure must not report the run as an inherited-environment run.
    $exactRequested = $PSBoundParameters.ContainsKey('ExactEnvironment')
    $envMode = if ($exactRequested) { 'EXACT' } else { 'INHERITED' }
    $envSource = if ($exactRequested) { 'EXACT_ENVIRONMENT_NOT_CONFIGURED' }
        else { 'INHERITED_PARENT_BLOCK_NOT_CAPTURED' }
    $launchWorkDir = $null
    $drainError = $null
    $drainFaults = @()
    $drainHandleHeld = $false
    $envError = $null
    $startUtc = $null
    $endUtc = $null
    $stdOutTask = $null
    $stdErrTask = $null
    $streamAcquireError = $null
    $outStream = $null
    $errStream = $null
    try {
        try {
            $so = New-GuardedTempFile
            if ([string]::IsNullOrWhiteSpace($so)) { throw 'stdout temp allocation returned no path' }
            $allocatedTempPaths += $so
            $se = New-GuardedTempFile
            if ([string]::IsNullOrWhiteSpace($se)) { throw 'stderr temp allocation returned no path' }
            $allocatedTempPaths += $se
            if ($exactRequested) {
                $envSource = 'EXACT_ENVIRONMENT_REJECTED_BEFORE_LAUNCH'
                $validated = ConvertTo-GuardedExactEnvironment $ExactEnvironment
                $prepared = New-GuardedExactStartInfo -Exe $GraphifyExe -SafeArgs $safeArgs `
                    -Validated $validated -Capture $true
                $launchEnv = $prepared.LaunchEnvironment
                $launchWorkDir = $prepared.WorkingDirectory
                $envSource = 'PROCESS_START_INFO_READBACK'
                $startUtc = [DateTime]::UtcNow
                $p = [System.Diagnostics.Process]::Start($prepared.StartInfo)
                # Drain both pipes concurrently. A synchronous read of one stream while the child
                # fills the other deadlocks once a pipe buffer is full.
                #
                # STREAM to the same temp files the inherited path writes, rather than reading the
                # pipes into strings. ReadToEndAsync buffered BOTH COMPLETE streams in memory, and
                # the drain bound below caps how long the guardrail WAITS, not how much it HOLDS --
                # so a chatty child could exhaust memory on this path while the file-backed
                # inherited path stayed flat. Copying from BaseStream also puts the child's RAW
                # BYTES on disk exactly as the inherited path does, which removes the
                # decode-then-re-encode step entirely.
                #
                # This acquisition is caught SEPARATELY: the child is already running, so it must
                # never reach the start catch and be reported as START_FAILED with OrphanRisk
                # false and no recorded identity. Custody stays with the wait/timeout block below.
                try {
                    $outStream = [System.IO.File]::Create($so)
                    $errStream = [System.IO.File]::Create($se)
                    $stdOutTask = $p.StandardOutput.BaseStream.CopyToAsync($outStream)
                    $stdErrTask = $p.StandardError.BaseStream.CopyToAsync($errStream)
                } catch {
                    $streamAcquireError = $_.Exception.Message
                }
            } else {
                $startUtc = [DateTime]::UtcNow
                $p = Start-Process -FilePath $GraphifyExe -ArgumentList $safeArgs -PassThru -NoNewWindow `
                    -RedirectStandardOutput $so -RedirectStandardError $se
            }
        } catch {
            # Only a throw from the environment-configuration step is an environment validation
            # error. An unrelated pre-branch failure (temp allocation) must not be recorded here.
            if ($envSource -eq 'EXACT_ENVIRONMENT_REJECTED_BEFORE_LAUNCH') {
                $envError = $_.Exception.Message
            }
            $result = New-GuardedCaptureResult -TimedOut $false -ExitCode 1 -ProcId $null `
                -RootTerminated $false -CleanupStatus 'START_FAILED' -CleanupError $null `
                -GuardrailFailed $true -OrphanRisk $false -GuardrailError $_.Exception.Message
        }

        if ($null -ne $p -and $null -eq $result) {
            try {
                $procId = [int]$p.Id
                $null = $p.Handle
                if ($null -ne $streamAcquireError) {
                    # POST-START STREAM-ACQUISITION FAILURE -- FAIL FAST.
                    #
                    # One redirected stream was acquired and the other was not, so NO copy task
                    # exists for the unacquired side. The child then blocks once its 64 KB pipe
                    # buffer fills, and the ordinary WaitForExit below would wait the FULL
                    # TimeoutSec before doing anything: 3000 s for the nightly, which
                    # semantic_extract.ps1 passes explicitly, double-bounded by the outer 3600 s
                    # guard. Waiting 50 minutes to discover a failure that is already certain is
                    # the defect this branch removes. The stall is a defect, not a specification.
                    #
                    # The child ALREADY STARTED, so this must never be reported as START_FAILED
                    # with a null identity -- that misclassification is precisely what #793 fixed.
                    # The real ProcId is retained, the pre-seeded classification is
                    # POST_START_FAILURE (the taxonomy the catch block below already uses), and
                    # custody goes through the EXISTING Set-GuardedCustodyFailure surface, which
                    # calls Stop-GuardedRootProcess internally. No parallel kill and no new
                    # controller, launcher, cleanup surface or exception taxonomy is introduced.
                    # The literal-count pins are what enforce that: a hand-rolled $p.Kill() would
                    # fail fast just as convincingly and would also survive falsification.
                    #
                    # Control falls through to the drain/read block below UNCHANGED, so
                    # OutputReadError still names the acquisition failure and TempCleanupStatus is
                    # still computed on the one existing code path.
                    $exitCode = 1
                    $result = New-GuardedCaptureResult -TimedOut $false -ExitCode 1 -ProcId $procId `
                        -RootTerminated $false -CleanupStatus 'POST_START_FAILURE' -CleanupError $null `
                        -GuardrailFailed $true -OrphanRisk $true -GuardrailError $null
                    $result = Set-GuardedCustodyFailure -Result $result -Process $p `
                        -Message ("redirected pipe reader could not be acquired: $streamAcquireError")
                } elseif (-not ($waited = $p.WaitForExit($TimeoutSec * 1000))) {
                    $timedOut = $true
                    $exitCode = 124
                    $cleanup = Stop-GuardedRootProcess -Process $p
                    $cleanupFailed = (-not $cleanup.RootTerminated -or
                        $cleanup.Status -eq 'ROOT_TERMINATION_FAILED')
                    # Build timeout evidence before reading redirected output so it cannot be lost.
                    $result = New-GuardedCaptureResult -TimedOut $true -ExitCode 124 -ProcId $procId `
                        -RootTerminated $cleanup.RootTerminated -CleanupStatus $cleanup.Status `
                        -CleanupError $cleanup.Error -GuardrailFailed $cleanupFailed -OrphanRisk $true `
                        -GuardrailError $null
                } else {
                    $p.WaitForExit()
                    $exitCode = [int]$p.ExitCode
                    $result = New-GuardedCaptureResult -TimedOut $false -ExitCode $exitCode -ProcId $procId `
                        -RootTerminated $false -CleanupStatus 'NOT_REQUIRED' -CleanupError $null `
                        -GuardrailFailed $false -OrphanRisk $false -GuardrailError $null
                }
            } catch {
                $failureExit = if ($timedOut) { 124 } elseif ($exitCode -ne 0) { $exitCode } else { 1 }
                $result = New-GuardedCaptureResult -TimedOut $timedOut -ExitCode $failureExit -ProcId $procId `
                    -RootTerminated $false -CleanupStatus 'POST_START_FAILURE' -CleanupError $null `
                    -GuardrailFailed $true -OrphanRisk $true -GuardrailError $null
                $result = Set-GuardedCustodyFailure -Result $result -Process $p -Message $_.Exception.Message
            }

            try {
                if ($null -ne $streamAcquireError) {
                    # Recorded rather than thrown: bytes already copied are on disk, and throwing
                    # here would skip both the disposal below and the read, discarding them.
                    $drainError = Join-GuardedError $drainError `
                        ("redirected pipe reader could not be acquired: $streamAcquireError")
                }
                if ($null -ne $stdOutTask -or $null -ne $stdErrTask) {
                    # Exact-environment launches redirect to pipes, which are STREAMED into the
                    # same temp files the inherited path writes directly, keeping OutputLines,
                    # OutputReadError and TempCleanupStatus on one code path. Whatever copied
                    # before the bound expired is ALREADY on disk, so partial output survives
                    # without any special handling.
                    #
                    # The drain is BOUNDED. A redirected pipe stays open while ANY process holding
                    # the inherited write handle lives, and this guardrail deliberately does not
                    # prove descendant termination, so an unbounded wait would let a surviving
                    # descendant defeat the hard timeout: the timeout evidence would be built and
                    # then never returned. The wait is not a substitute for the timeout; it only
                    # bounds the read.
                    #
                    # Encoding is not this code's concern any more: the child's raw bytes reach
                    # disk untouched and Get-Content decodes them exactly as it does for the
                    # inherited path, so the two paths produce byte-identical files. Whatever the
                    # CHILD's own encoder chose still governs, and it governs both paths alike.
                    # ONE budget for the whole drain, not one per stream: waiting each stream
                    # separately would let two streams cost twice the bound, and the bound exists
                    # to cap how long a surviving descendant can hold the guardrail open.
                    $drainTimeoutMs = 5000
                    $drainClock = [System.Diagnostics.Stopwatch]::StartNew()
                    $drainIncomplete = @()
                    $pendingReads = @(
                        [pscustomobject]@{ Label = 'stdout'; Task = $stdOutTask },
                        [pscustomobject]@{ Label = 'stderr'; Task = $stdErrTask }
                    )
                    foreach ($pending in $pendingReads) {
                        if ($null -eq $pending.Task) { continue }
                        $remainingMs = $drainTimeoutMs - [int]$drainClock.ElapsedMilliseconds
                        if ($remainingMs -lt 0) { $remainingMs = 0 }
                        $completed = $false
                        try { $completed = $pending.Task.Wait($remainingMs) }
                        catch {
                            # A FAULTED read must not discard the other stream either: record it
                            # and keep going, exactly as an expired one is handled.
                            $drainFaults += ($pending.Label + ': ' +
                                (Resolve-GuardedFaultMessage $_.Exception))
                            continue
                        }
                        if (-not $completed) { $drainIncomplete += $pending.Label }
                    }
                    $drainClock.Stop()
                    if ($drainIncomplete.Count -gt 0) {
                        $drainHandleHeld = $true
                        $drainError = ("redirected pipe drain did not complete within " +
                            "$drainTimeoutMs ms for: " + ($drainIncomplete -join ', ') +
                            "; a surviving descendant may still hold the write handle")
                    }
                    if ($drainFaults.Count -gt 0) {
                        $drainError = Join-GuardedError $drainError `
                            ("redirected pipe read faulted for: " + ($drainFaults -join '; '))
                    }
                }
                # Release the destination FILE handles before the files are read back -- these are
                # ours, not the pipe write handles the child and any descendant hold -- and do it
                # even when the drain expired, so a still-running copy is abandoned deliberately
                # and the bytes it already wrote can still be reported. File::Create opens with
                # FileShare.None, so leaving a handle open would fail both the read below and the
                # temp cleanup in the finally.
                #
                # Dispose is also the FLUSH point for the last buffered bytes, so its failure means
                # the file on disk is SHORT. Swallowing it would hand the caller truncated output
                # reported as complete and error-free, which is exactly what the pre-streaming
                # WriteAllText could not do because its failure reached the catch below.
                # Close the SOURCE pipes FIRST. Disposing only the destination leaves an
                # abandoned CopyToAsync blocked in a synchronous read of the child's pipe, which
                # on this runtime holds a ThreadPool thread and a pipe handle until whatever owns
                # the write end finally exits -- and after an expired drain that is precisely a
                # descendant we could not prove dead, so it could be a long time. Closing the
                # source forces the pending read to fail so the task terminates now. Any fault it
                # then raises is deliberately left unobserved: nothing downstream reads it, and an
                # unobserved task fault does not tear down the host on .NET Framework 4.5+.
                # Ordering matters: source first to unblock, destination second to flush.
                if ($null -ne $p) {
                    foreach ($sourceReader in @($p.StandardOutput, $p.StandardError)) {
                        if ($null -ne $sourceReader) {
                            try { $sourceReader.Dispose() } catch { }
                        }
                    }
                }
                $flushFailures = @()
                foreach ($openStream in @($outStream, $errStream)) {
                    if ($null -ne $openStream) {
                        try { $openStream.Dispose() }
                        catch { $flushFailures += (Resolve-GuardedFaultMessage $_.Exception) }
                    }
                }
                $outStream = $null
                $errStream = $null
                if ($flushFailures.Count -gt 0) {
                    # NOT drainHandleHeld: a failed flush is not evidence that anything is alive.
                    $drainError = Join-GuardedError $drainError `
                        ("redirected output flush failed: " + ($flushFailures -join '; '))
                }
                $outLines = @()
                $errLines = @()
                if (Test-Path -LiteralPath $so -ErrorAction Stop) {
                    $outLines = @(Get-Content -LiteralPath $so -ErrorAction Stop |
                        ForEach-Object { [string]$_ })
                }
                if (Test-Path -LiteralPath $se -ErrorAction Stop) {
                    $errLines = @(Get-Content -LiteralPath $se -ErrorAction Stop |
                        ForEach-Object { [string]$_ })
                }
                $result.StdOutLines = $outLines
                $result.StdErrLines = $errLines
                $result.StdOutText = ($outLines -join [Environment]::NewLine)
                $result.StdErrText = ($errLines -join [Environment]::NewLine)
                $result.OutputLines = @($outLines + $errLines)
                if ($null -ne $drainError) {
                    # Reported AFTER the read so any stream that did drain is still surfaced.
                    $result.OutputReadError = $drainError
                    if ($drainHandleHeld) {
                        # An EXPIRED drain is positive evidence that some process still holds the
                        # inherited write handle: the child is gone yet the pipe is not at EOF.
                        # Reporting OrphanRisk = $false beside that message would contradict the
                        # guardrail's own finding. On the timeout path OrphanRisk is already true;
                        # this covers the case where the child exited cleanly and a descendant
                        # survived it. semantic_extract.ps1 keys its GPU-orphan handling and its
                        # evidence receipt off this flag. No production caller passes
                        # -ExactEnvironment yet, so this is a contract for the first adopter
                        # rather than a live path -- but the flag must be truthful before one
                        # exists, not after.
                        # UNMEASURED, and it must be measured before any SCHEDULED-TASK caller
                        # adopts exact mode: a console-less parent makes CreateNoWindow = $false
                        # allocate a console plus a conhost.exe for the child, and if that conhost
                        # holds a duplicate of the redirected write handle the drain would expire
                        # on every run and report an orphan risk with nothing actually alive.
                        # A FAULTED read is deliberately excluded: a broken pipe is not evidence
                        # that anything is still alive.
                        # The two launch paths are deliberately NOT symmetric here. On the
                        # inherited path a surviving descendant holds the temp FILE, so the read
                        # silently returns a partial file and the removal fails with a sharing
                        # violation instead; exact mode holds the file itself and therefore
                        # notices. Exact mode is strictly stricter, which is the intended
                        # direction for evidence.
                        $result.OrphanRisk = $true
                    }
                    $result = Set-GuardedAuxiliaryFailure -Result $result `
                        -Message "redirected output read failed: $drainError"
                }
            } catch {
                $readMessage = Resolve-GuardedFaultMessage $_.Exception
                # Do NOT discard evidence recorded BEFORE the read. A drain expiry or a flush
                # failure is still true even though the readback then failed too, and the orphan
                # finding an expiry implies must survive: the branch that raises OrphanRisk sits
                # after the read inside the try, so a throw there used to skip it and hand back
                # OrphanRisk = $false next to a lost "surviving descendant" message.
                $result.OutputReadError = Join-GuardedError $drainError $readMessage
                if ($drainHandleHeld) { $result.OrphanRisk = $true }
                $result = Set-GuardedAuxiliaryFailure -Result $result `
                    -Message "redirected output read failed: $readMessage"
            }
        }
    } finally {
        foreach ($openStream in @($outStream, $errStream)) {
            if ($null -ne $openStream) {
                try { $openStream.Dispose() } catch { }
            }
        }
        $outStream = $null
        $errStream = $null
        if ($null -ne $p) {
            if ($null -eq $result) {
                $result = New-GuardedCaptureResult -TimedOut $timedOut `
                    -ExitCode $(if ($timedOut) { 124 } else { 1 }) -ProcId $procId `
                    -RootTerminated $false -CleanupStatus 'POST_START_FAILURE' -CleanupError $null `
                    -GuardrailFailed $true -OrphanRisk $true -GuardrailError $null
                $result = Set-GuardedCustodyFailure -Result $result -Process $p `
                    -Message 'guardrail produced no result after process start'
            }
            try { $p.Dispose() }
            catch {
                $result.ProcessDisposeError = $_.Exception.Message
                $result = Set-GuardedAuxiliaryFailure -Result $result `
                    -Message "process Dispose failed: $($_.Exception.Message)"
            }
        }
        foreach ($tempPath in $allocatedTempPaths) {
            if (-not [string]::IsNullOrWhiteSpace($tempPath)) {
                try {
                    Remove-Item -LiteralPath $tempPath -Force -ErrorAction Stop
                    if (Test-Path -LiteralPath $tempPath -ErrorAction Stop) {
                        throw 'redirected temp path survived terminating removal'
                    }
                }
                catch { $tempCleanupErrors += "$tempPath`: $($_.Exception.Message)" }
            }
        }
        if ($null -ne $result) {
            if ($allocatedTempPaths.Count -eq 0) {
                $result.TempCleanupStatus = 'NOT_CREATED'
            } elseif ($tempCleanupErrors.Count -gt 0 -and $allocatedTempPaths.Count -lt 2) {
                $result.TempCleanupStatus = 'PARTIAL_REMOVAL_FAILED'
                $result.TempCleanupError = ($tempCleanupErrors -join '; ')
            } elseif ($tempCleanupErrors.Count -gt 0) {
                $result.TempCleanupStatus = 'REMOVAL_FAILED'
                $result.TempCleanupError = ($tempCleanupErrors -join '; ')
            } elseif ($allocatedTempPaths.Count -lt 2) {
                $result.TempCleanupStatus = 'PARTIAL_REMOVED'
            } else {
                $result.TempCleanupStatus = 'REMOVED'
            }
            if ($result.TempCleanupStatus -in @('PARTIAL_REMOVAL_FAILED', 'REMOVAL_FAILED')) {
                $result = Set-GuardedAuxiliaryFailure -Result $result `
                    -Message "redirected temp cleanup failed: $($result.TempCleanupError)"
            }
        }
        $endUtc = [DateTime]::UtcNow
        $result = Set-GuardedLaunchEvidence -Result $result -Exe $GraphifyExe -SafeArgs $safeArgs `
            -EnvironmentMode $envMode -LaunchEnvironment $launchEnv -LaunchEnvironmentSource $envSource `
            -LaunchWorkingDirectory $launchWorkDir `
            -EnvironmentValidationError $envError -StartUtc $startUtc -EndUtc $endUtc
    }
    return $result
}