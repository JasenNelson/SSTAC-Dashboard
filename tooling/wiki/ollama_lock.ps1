# ollama_lock.ps1 -- shared Ollama hard-lock helper for the SSTAC wiki lane (Phase 4-7).
#
# Implements the FULL C:\Projects\OLLAMA_SCHEDULE_PROTOCOL.md v0.5 discipline that the OHD
# reference scripts skip (OHD uses a bare CreateNew with no preflight -- a known reliability
# finding). Every SSTAC ollama-bound step MUST go through these functions; no bare CreateNew
# anywhere else in tooling/wiki/. Dot-source this file; plain ASCII.
#
# Load-bearing rules implemented here (do not weaken):
#   1. STANDING BLOCK gate: without C:\Projects\OLLAMA_STANDING_BLOCK_SSTAC_WIKI.md the lane is
#      NOT authorized -- every acquire fails closed and the caller skips its ollama step.
#   2. 4-clause preflight (protocol 4.6.2): standing block, drift-log scan, peer-lock liveness
#      (liveness FIRST, then expiry; MANUAL_HOLD never auto-reclaimed), /api/ps probe
#      (fail-closed on timeout/non-2xx/non-JSON; one retry after 30s).
#   3. Declare-BEFORE-call: the drift-log row is appended immediately after acquisition and
#      before any subprocess that will touch ollama.
#   4. Release-immediately + actual_end row; gpuOrphanRisk rewrites the lock to MANUAL_HOLD
#      (+24h, non-numeric process_id) and drops an SSTAC-suffixed HITL marker instead of
#      releasing onto a possibly-live GPU process.

$script:OllamaControlRoot = 'C:\Projects'
$script:LaneId = 'sstac-wiki'

function Get-OllamaControlPath {
    param([Parameter(Mandatory)][string]$ChildPath)
    return Join-Path $script:OllamaControlRoot $ChildPath
}

function Get-OllamaLockPath {
    return Get-OllamaControlPath 'OLLAMA_ACTIVE.lock'
}

function Get-OllamaStandingBlockPath {
    return Get-OllamaControlPath 'OLLAMA_STANDING_BLOCK_SSTAC_WIKI.md'
}

function Get-OllamaSchedulePath {
    $date = Get-Date -Format 'yyyy-MM-dd'
    return Get-OllamaControlPath "OLLAMA_SCHEDULE_$date.md"
}

function Write-OllamaDriftLogRow {
    # Appends one drift-log line under the per-day file's schedule-edit lock (protocol 4.6.6).
    # Append-only usage: IN_FLIGHT rows and closeout rows are separate appended lines keyed by
    # block_id, so no existing row is ever rewritten (the sha256 rewrite dance is not needed
    # for pure appends; the editlock still serializes concurrent appenders).
    param([Parameter(Mandatory)][string]$Line)
    $sched = Get-OllamaSchedulePath
    $editLock = "$sched.editlock"
    $fs = $null
    $acquired = $false
    for ($i = 0; $i -lt 10 -and -not $acquired; $i++) {
        try {
            $fs = [System.IO.File]::Open($editLock, [System.IO.FileMode]::CreateNew)
            $acquired = $true
        } catch {
            Start-Sleep -Milliseconds (200 * ($i + 1))
        }
    }
    if (-not $acquired) {
        # NEVER write without owning the editlock (codex P2, 2026-07-22): an unserialized
        # append violates the protocol's schedule-mutex; the caller treats $false as
        # declaration-failure and rolls back its acquisition.
        Write-Warning "ollama_lock: could not acquire schedule editlock; drift-log row NOT written: $Line"
        return $false
    }
    $written = $false
    try {
        if (-not (Test-Path $sched)) {
            "# OLLAMA per-day schedule $(Get-Date -Format 'yyyy-MM-dd') (auto-created by sstac-wiki lane)" |
                Out-File -FilePath $sched -Encoding ascii -ErrorAction Stop
        }
        # -ErrorAction Stop + catch (codex P2, 2026-07-22): an ACL/read-only/disk-full append
        # failure must return $false through the normal path, never fall through as success
        # nor unwind past the caller's retry/marker/release handling.
        Add-Content -Path $sched -Value $Line -Encoding ascii -ErrorAction Stop
        $written = $true
    } catch {
        Write-Warning "ollama_lock: drift-log append FAILED: $($_.Exception.Message)"
    } finally {
        if ($fs) { $fs.Close() }
        Remove-Item -Path $editLock -Force -ErrorAction SilentlyContinue
    }
    return $written
}

function Test-OllamaPreflight {
    # Protocol 4.6.2 4-clause preflight. Returns $true only if ALL clauses pass.
    # Callers treat $false as SKIP-tonight (fail-soft for the nightly; fail-closed for standalone).

    # Clause 1: standing block (lane authorization). Absent -> not authorized, ever.
    $standingBlockPath = Get-OllamaStandingBlockPath
    if (-not (Test-Path $standingBlockPath)) {
        Write-Host "ollama_lock preflight: standing block absent ($standingBlockPath) -> SKIP (lane not authorized)"
        return $false
    }

    # Clause 2: today's drift log -- any IN_FLIGHT row from another lane means the GPU is claimed.
    $sched = Get-OllamaSchedulePath
    if (Test-Path $sched) {
        $inflight = Select-String -Path $sched -Pattern 'IN_FLIGHT' -SimpleMatch -ErrorAction SilentlyContinue |
            Where-Object { $_.Line -notmatch [regex]::Escape($script:LaneId) }
        # A foreign IN_FLIGHT row with no matching closeout row (same block id + COMPLETED/RELEASE)
        # is treated as live. Conservative: any foreign IN_FLIGHT line without a later terminal
        # line containing the same block id blocks acquisition.
        foreach ($hit in $inflight) {
            $blockId = if ($hit.Line -match '([A-Za-z0-9\-]+-(?:AH-)?\d+|[A-Z]+-[A-Z]+)') { $Matches[1] } else { $null }
            $closed = $false
            if ($blockId) {
                # Closeout rows count ONLY when they appear AFTER this IN_FLIGHT row
                # (codex P2, 2026-07-22): a lane re-using a block id later the same day
                # must not have its EARLIER completion satisfy the CURRENT claim.
                $closed = (Select-String -Path $sched -SimpleMatch -Pattern $blockId |
                    Where-Object { $_.LineNumber -gt $hit.LineNumber -and
                                   $_.Line -match 'COMPLETED|EARLY_RELEASE|MISSED_WINDOW|OVERRUN_CONTAINED|MANUAL_HOLD' }).Count -gt 0
            }
            if (-not $closed) {
                Write-Host "ollama_lock preflight: foreign IN_FLIGHT drift-log row (no later closeout) -> SKIP: $($hit.Line)"
                return $false
            }
        }
    }

    # Clause 3: peer lock file -- liveness FIRST, then expiry. MANUAL_HOLD is never reclaimed.
    $lockPath = Get-OllamaLockPath
    if (Test-Path $lockPath) {
        $peer = $null
        try { $peer = Get-Content $lockPath -Raw | ConvertFrom-Json } catch {}
        $peerPid = if ($peer) { "$($peer.process_id)" } else { '' }
        if ($peerPid -notmatch '^\d+$') {
            Write-Host "ollama_lock preflight: peer lock is MANUAL_HOLD/non-numeric ($peerPid) -> NEVER reclaimed -> SKIP"
            return $false
        }
        $alive = $false
        try { $alive = $null -ne (Get-Process -Id ([int]$peerPid) -ErrorAction SilentlyContinue) } catch {}
        if ($alive) {
            Write-Host "ollama_lock preflight: peer lock PID $peerPid alive -> holder is honest-but-slow -> SKIP"
            return $false
        }
        # Dead PID: expired -> stale-recovery is a HITL path, not ours; not expired -> HITL signal.
        $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
        $marker = Get-OllamaControlPath "HITL_OLLAMA_STALE_LOCK_$stamp.md"
        "Stale ollama lock observed by lane $script:LaneId at $stamp. Holder PID $peerPid not alive. Lock body follows.`n" +
            (Get-Content $lockPath -Raw -ErrorAction SilentlyContinue) |
            Out-File -FilePath $marker -Encoding ascii
        Write-Host "ollama_lock preflight: peer lock PID dead -> wrote $marker for owner mediation -> SKIP (never self-reclaim)"
        return $false
    }

    # Clause 4: /api/ps probe, fail-closed. 5s timeout; one retry after 30s.
    for ($attempt = 1; $attempt -le 2; $attempt++) {
        try {
            $resp = Invoke-WebRequest -Uri 'http://localhost:11434/api/ps' -UseBasicParsing -TimeoutSec 5
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
                $null = $resp.Content | ConvertFrom-Json  # throws if non-JSON
                return $true
            }
        } catch {}
        if ($attempt -eq 1) { Start-Sleep -Seconds 30 }
    }
    Write-Host "ollama_lock preflight: /api/ps unverified after retry -> FAIL-CLOSED -> SKIP"
    return $false
}

function Invoke-OllamaLockAcquire {
    # Returns a lock handle object on success, $null on failure. Runs the FULL preflight first.
    param(
        [Parameter(Mandatory)][string]$BlockId,          # e.g. SSTAC-SEMANTIC / SSTAC-NIGHTLY
        [Parameter(Mandatory)][string]$Purpose,
        [int]$ExpiryMinutes = 120,
        [string]$SessionId = "sstac-wiki-$(Get-Date -Format 'yyyy-MM-dd')-auto",
        [string]$Model = 'qwen3:14b',
        [string]$LogPath = ''
    )
    if (-not (Test-OllamaPreflight)) { return $null }

    $lockPath = Get-OllamaLockPath
    $fs = $null
    try {
        $fs = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::CreateNew)
    } catch {
        if ($_.Exception.HResult -eq -2147024816) {
            Write-Host "ollama_lock: peer won the CreateNew race -> SKIP"
            Write-OllamaDriftLogRow ("| $BlockId | RACE_LOST | $(Get-Date -Format 'HH:mm:ss') | $script:LaneId | $SessionId | peer won CreateNew; pivoting |") | Out-Null
        } else {
            Write-Warning "ollama_lock: acquisition system error: $($_.Exception.Message)"
        }
        return $null
    }
    $now = Get-Date
    $body = @{
        lane_id            = $script:LaneId
        session_id         = $SessionId
        process_id         = $PID
        scheduled_block_id = $BlockId
        block_or_adhoc     = 'block'
        purpose            = $Purpose
        acquired_at        = $now.ToString('o')
        expires_at         = $now.AddMinutes($ExpiryMinutes).ToString('o')
    } | ConvertTo-Json
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($body)
    $fs.Write($bytes, 0, $bytes.Length)
    $fs.Close()

    # Declare-BEFORE-call drift-log row (protocol 4.5 rule 1). This declaration is MANDATORY:
    # if it cannot be written, other lanes cannot see the claim, so the acquisition is rolled
    # back (lock removed) and the caller must skip its ollama step (codex P2, 2026-07-22).
    $declared = Write-OllamaDriftLogRow ("| $BlockId | IN_FLIGHT | actual_start $($now.ToString('HH:mm:ss')) | $script:LaneId | $SessionId | pid $PID | model $Model | expiry +${ExpiryMinutes}m | log $LogPath | $Purpose |")
    if (-not $declared) {
        Write-Warning "ollama_lock: IN_FLIGHT declaration could not be written -> rolling back acquisition"
        Remove-Item -Path $lockPath -Force -ErrorAction SilentlyContinue
        return $null
    }

    return [pscustomobject]@{
        LaneId = $script:LaneId
        BlockId = $BlockId
        SessionId = $SessionId
        AcquiredAt = $now
        OwnerPid = $PID
    }
}

function New-OllamaReleaseResult {
    param(
        [Parameter(Mandatory)][string]$RequestedMode,
        [ValidateSet('VERIFIED_RELEASED','VERIFIED_MANUAL_HOLD','FAILED')][string]$Outcome = 'FAILED',
        [bool]$EvidenceValid = $false,
        [bool]$OwnershipMatched = $false,
        [bool]$LockAbsent = $false,
        [bool]$ManualHoldVerified = $false,
        [bool]$DriftLogWritten = $false,
        [bool]$MarkerWritten = $false,
        [string]$Error = ''
    )
    return [pscustomobject][ordered]@{
        schema_version = '1.0'
        requested_mode = $RequestedMode
        outcome = $Outcome
        evidence_valid = $EvidenceValid
        ownership_matched = $OwnershipMatched
        lock_absent = $LockAbsent
        manual_hold_verified = $ManualHoldVerified
        drift_log_written = $DriftLogWritten
        marker_written = $MarkerWritten
        error = $Error
    }
}

function Test-OllamaReleaseResult {
    param(
        [Parameter(Mandatory)]$Result,
        [Parameter(Mandatory)][string]$ExpectedRequestedMode
    )
    if ($null -eq $Result) { return $false }
    $expectedProperties = @(
        'schema_version', 'requested_mode', 'outcome', 'evidence_valid',
        'ownership_matched', 'lock_absent', 'manual_hold_verified',
        'drift_log_written', 'marker_written', 'error'
    )
    $actualProperties = @($Result.PSObject.Properties.Name)
    if ($actualProperties.Count -ne $expectedProperties.Count -or
        @($expectedProperties | Where-Object { $actualProperties -cnotcontains $_ }).Count -ne 0) {
        return $false
    }
    if ([string]$Result.schema_version -cne '1.0' -or
        [string]$Result.requested_mode -cne $ExpectedRequestedMode -or
        $Result.error -isnot [string]) {
        return $false
    }
    foreach ($name in @('evidence_valid','ownership_matched','lock_absent','manual_hold_verified','drift_log_written','marker_written')) {
        if ($Result.$name -isnot [bool]) { return $false }
    }
    if ($ExpectedRequestedMode -eq 'MANUAL_HOLD') {
        return ([string]$Result.outcome -ceq 'VERIFIED_MANUAL_HOLD' -and
            $Result.evidence_valid -and $Result.ownership_matched -and
            -not $Result.lock_absent -and $Result.manual_hold_verified -and
            $Result.drift_log_written -and $Result.marker_written -and
            [string]::IsNullOrEmpty($Result.error))
    }
    return ([string]$Result.outcome -ceq 'VERIFIED_RELEASED' -and
        $Result.evidence_valid -and $Result.ownership_matched -and
        $Result.lock_absent -and -not $Result.manual_hold_verified -and
        $Result.drift_log_written -and -not $Result.marker_written -and
        [string]::IsNullOrEmpty($Result.error))
}

function Remove-OllamaOwnedLockFile {
    param([Parameter(Mandatory)][string]$Path)
    Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
}

function Set-OllamaManualHoldContent {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Content
    )
    $temporaryPath = "$Path.hold.$PID.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        [System.IO.File]::WriteAllText($temporaryPath, $Content, [System.Text.Encoding]::ASCII)
        Move-Item -LiteralPath $temporaryPath -Destination $Path -Force -ErrorAction Stop
    } finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Write-OllamaMarkerFile {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Content
    )
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($Content)
    $stream = [System.IO.File]::Open(
        $Path,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::None
    )
    try { $stream.Write($bytes, 0, $bytes.Length) }
    finally { $stream.Dispose() }
}

function Invoke-OllamaLockRelease {
    param(
        [Parameter(Mandatory)]$Handle,
        [ValidateSet('COMPLETED_GREEN','COMPLETED_RED','COMPLETED_YELLOW','EARLY_RELEASE','OVERRUN_CONTAINED')]
        [string]$Status = 'COMPLETED_GREEN',
        [switch]$GpuOrphanRisk
    )
    $now = Get-Date
    $requestedMode = if ($GpuOrphanRisk) { 'MANUAL_HOLD' } else { $Status }
    $lockPath = Get-OllamaLockPath

    $current = $null
    try {
        if (-not (Test-Path -LiteralPath $lockPath -PathType Leaf)) { throw 'lock file is missing' }
        $current = Get-Content -LiteralPath $lockPath -Raw -ErrorAction Stop | ConvertFrom-Json
    } catch {
        return (New-OllamaReleaseResult -RequestedMode $requestedMode -Error "release read failed: $($_.Exception.Message)")
    }

    $expectedLane = if ($Handle.PSObject.Properties['LaneId']) { [string]$Handle.LaneId } else { '' }
    $expectedSession = if ($Handle.PSObject.Properties['SessionId']) { [string]$Handle.SessionId } else { '' }
    $expectedPid = if ($Handle.PSObject.Properties['OwnerPid']) { [string]$Handle.OwnerPid } else { '' }
    $expectedBlock = if ($Handle.PSObject.Properties['BlockId']) { [string]$Handle.BlockId } else { '' }
    $ownershipMatched = (-not [string]::IsNullOrWhiteSpace($expectedLane) -and
        -not [string]::IsNullOrWhiteSpace($expectedSession) -and
        -not [string]::IsNullOrWhiteSpace($expectedPid) -and
        -not [string]::IsNullOrWhiteSpace($expectedBlock) -and
        [string]$current.lane_id -ceq $expectedLane -and
        [string]$current.session_id -ceq $expectedSession -and
        [string]$current.process_id -ceq $expectedPid -and
        [string]$current.scheduled_block_id -ceq $expectedBlock)
    if (-not $ownershipMatched) {
        return (New-OllamaReleaseResult -RequestedMode $requestedMode `
            -Error 'release ownership mismatch; lock left untouched')
    }

    if ($GpuOrphanRisk) {
        $holdExpiry = $now.AddHours(24).ToString('o')
        $holdAcquiredAt = ([datetime]$Handle.AcquiredAt).ToString('o')
        $hold = [pscustomobject][ordered]@{
            lane_id            = $expectedLane
            session_id         = $expectedSession
            process_id         = 'MANUAL_HOLD'
            scheduled_block_id = $expectedBlock
            block_or_adhoc     = 'block'
            purpose            = 'MANUAL_HOLD after gpuOrphanRisk -- owner must clear'
            acquired_at        = $holdAcquiredAt
            expires_at         = $holdExpiry
            hold_reason        = 'gpu_orphan_risk'
            hold_hours         = 24
        } | ConvertTo-Json
        try {
            Set-OllamaManualHoldContent -Path $lockPath -Content $hold
        } catch {
            return (New-OllamaReleaseResult -RequestedMode $requestedMode `
                -OwnershipMatched $true -Error "manual hold write failed: $($_.Exception.Message)")
        }
        $holdVerified = $false
        $holdReadbackError = ''
        try {
            $observedHold = Get-Content -LiteralPath $lockPath -Raw -ErrorAction Stop | ConvertFrom-Json
            $expectedAcquiredInstant = [datetimeoffset]::Parse($holdAcquiredAt)
            $observedAcquiredInstant = if ($observedHold.acquired_at -is [datetime]) {
                [datetimeoffset]$observedHold.acquired_at
            } else { [datetimeoffset]::Parse([string]$observedHold.acquired_at) }
            $expectedExpiryInstant = [datetimeoffset]::Parse($holdExpiry)
            $observedExpiryInstant = if ($observedHold.expires_at -is [datetime]) {
                [datetimeoffset]$observedHold.expires_at
            } else { [datetimeoffset]::Parse([string]$observedHold.expires_at) }
            $holdMismatches = @()
            if ([string]$observedHold.lane_id -cne $expectedLane) { $holdMismatches += 'lane_id' }
            if ([string]$observedHold.session_id -cne $expectedSession) { $holdMismatches += 'session_id' }
            if ([string]$observedHold.process_id -cne 'MANUAL_HOLD') { $holdMismatches += 'process_id' }
            if ([string]$observedHold.scheduled_block_id -cne $expectedBlock) { $holdMismatches += 'scheduled_block_id' }
            if ([string]$observedHold.block_or_adhoc -cne 'block') { $holdMismatches += 'block_or_adhoc' }
            if ([string]$observedHold.purpose -cne 'MANUAL_HOLD after gpuOrphanRisk -- owner must clear') { $holdMismatches += 'purpose' }
            if ($observedAcquiredInstant -ne $expectedAcquiredInstant) { $holdMismatches += 'acquired_at' }
            if ($observedExpiryInstant -ne $expectedExpiryInstant) { $holdMismatches += 'expires_at' }
            if ([string]$observedHold.hold_reason -cne 'gpu_orphan_risk') { $holdMismatches += 'hold_reason' }
            if ([int64]$observedHold.hold_hours -ne 24) { $holdMismatches += 'hold_hours' }
            $holdVerified = ($holdMismatches.Count -eq 0)
            if (-not $holdVerified) { $holdReadbackError = $holdMismatches -join ',' }
        } catch { $holdReadbackError = $_.Exception.Message }
        if (-not $holdVerified) {
            return (New-OllamaReleaseResult -RequestedMode $requestedMode `
                -OwnershipMatched $true -Error "manual hold readback contradiction: $holdReadbackError")
        }
        $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
        $marker = Get-OllamaControlPath "HITL_OLLAMA_GPU_ORPHAN_SSTAC_$stamp-$PID.md"
        try {
            Write-OllamaMarkerFile -Path $marker -Content "GPU orphan risk in lane $expectedLane block $expectedBlock at $stamp. Lock verified as MANUAL_HOLD (+24h). Owner must verify GPU idle before clearing $lockPath."
        } catch {
            return (New-OllamaReleaseResult -RequestedMode $requestedMode -OwnershipMatched $true `
                -ManualHoldVerified $true -Error "manual hold marker failed: $($_.Exception.Message)")
        }
        $driftWritten = Write-OllamaDriftLogRow ("| $expectedBlock | MANUAL_HOLD | actual_end $($now.ToString('HH:mm:ss')) | $expectedLane | $expectedSession | gpuOrphanRisk -> lock held; marker $marker |")
        if (-not $driftWritten) {
            return (New-OllamaReleaseResult -RequestedMode $requestedMode -OwnershipMatched $true `
                -ManualHoldVerified $true -MarkerWritten $true -Error 'manual hold drift-log append failed')
        }
        return (New-OllamaReleaseResult -RequestedMode $requestedMode -Outcome 'VERIFIED_MANUAL_HOLD' `
            -EvidenceValid $true -OwnershipMatched $true -ManualHoldVerified $true `
            -DriftLogWritten $true -MarkerWritten $true)
    }

    try {
        Remove-OllamaOwnedLockFile -Path $lockPath
    } catch {
        return (New-OllamaReleaseResult -RequestedMode $requestedMode -OwnershipMatched $true `
            -Error "lock deletion failed: $($_.Exception.Message)")
    }
    $lockAbsent = $false
    try {
        $lockAbsent = -not (Test-Path -LiteralPath $lockPath -ErrorAction Stop)
    } catch {
        return (New-OllamaReleaseResult -RequestedMode $requestedMode -OwnershipMatched $true `
            -Error "lock absence readback failed: $($_.Exception.Message)")
    }
    if (-not $lockAbsent) {
        return (New-OllamaReleaseResult -RequestedMode $requestedMode -OwnershipMatched $true `
            -Error 'lock survived deletion')
    }

    $closeRow = "| $expectedBlock | $Status | actual_end $($now.ToString('HH:mm:ss')) | $expectedLane | $expectedSession |"
    $driftWritten = Write-OllamaDriftLogRow $closeRow
    if (-not $driftWritten) {
        $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
        $marker = Get-OllamaControlPath "HITL_OLLAMA_DRIFTLOG_APPEND_FAILED_$stamp-$PID.md"
        $markerWritten = $false
        $markerError = ''
        try {
            Write-OllamaMarkerFile -Path $marker -Content "Drift-log closeout append failed for lane $expectedLane block $expectedBlock at $stamp. Lock absence was verified, but release evidence is FAILED."
            $markerWritten = $true
        } catch { $markerError = "; marker failed: $($_.Exception.Message)" }
        return (New-OllamaReleaseResult -RequestedMode $requestedMode -OwnershipMatched $true `
            -LockAbsent $true -MarkerWritten $markerWritten `
            -Error "drift-log closeout append failed$markerError")
    }
    return (New-OllamaReleaseResult -RequestedMode $requestedMode -Outcome 'VERIFIED_RELEASED' `
        -EvidenceValid $true -OwnershipMatched $true -LockAbsent $true -DriftLogWritten $true)
}
