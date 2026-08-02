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
    return $result
}

function New-GuardedTempFile {
    return [System.IO.Path]::GetTempFileName()
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
        [int]$TimeoutSec = 600
    )
    $safeArgs = Get-GuardedArgList $GraphifyArgs
    $p = $null
    $procId = $null
    $result = $null
    $timedOut = $false
    $exitCode = 0
    try {
        try {
            $p = Start-Process -FilePath $GraphifyExe -ArgumentList $safeArgs -PassThru -NoNewWindow
        } catch {
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
    }
    return $result
}

function Invoke-GraphifyGuardedCapture {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$GraphifyExe,
        [Parameter(Mandatory=$true)][string[]]$GraphifyArgs,
        [int]$TimeoutSec = 1800
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
    try {
        try {
            $so = New-GuardedTempFile
            if ([string]::IsNullOrWhiteSpace($so)) { throw 'stdout temp allocation returned no path' }
            $allocatedTempPaths += $so
            $se = New-GuardedTempFile
            if ([string]::IsNullOrWhiteSpace($se)) { throw 'stderr temp allocation returned no path' }
            $allocatedTempPaths += $se
            $p = Start-Process -FilePath $GraphifyExe -ArgumentList $safeArgs -PassThru -NoNewWindow `
                -RedirectStandardOutput $so -RedirectStandardError $se
        } catch {
            $result = New-GuardedCaptureResult -TimedOut $false -ExitCode 1 -ProcId $null `
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
                $lines = @()
                if (Test-Path -LiteralPath $so -ErrorAction Stop) {
                    $lines += Get-Content -LiteralPath $so -ErrorAction Stop
                }
                if (Test-Path -LiteralPath $se -ErrorAction Stop) {
                    $lines += Get-Content -LiteralPath $se -ErrorAction Stop
                }
                $result.OutputLines = $lines
            } catch {
                $result.OutputReadError = $_.Exception.Message
                $result = Set-GuardedAuxiliaryFailure -Result $result `
                    -Message "redirected output read failed: $($_.Exception.Message)"
            }
        }
    } finally {
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
    }
    return $result
}
