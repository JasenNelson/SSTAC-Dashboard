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

$script:OllamaLockPath      = 'C:\Projects\OLLAMA_ACTIVE.lock'
$script:StandingBlockPath   = 'C:\Projects\OLLAMA_STANDING_BLOCK_SSTAC_WIKI.md'
$script:LaneId              = 'sstac-wiki'

function Get-OllamaSchedulePath {
    $date = Get-Date -Format 'yyyy-MM-dd'
    return "C:\Projects\OLLAMA_SCHEDULE_$date.md"
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
    if (-not (Test-Path $script:StandingBlockPath)) {
        Write-Host "ollama_lock preflight: standing block absent ($script:StandingBlockPath) -> SKIP (lane not authorized)"
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
    if (Test-Path $script:OllamaLockPath) {
        $peer = $null
        try { $peer = Get-Content $script:OllamaLockPath -Raw | ConvertFrom-Json } catch {}
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
        $marker = "C:\Projects\HITL_OLLAMA_STALE_LOCK_$stamp.md"
        "Stale ollama lock observed by lane $script:LaneId at $stamp. Holder PID $peerPid not alive. Lock body follows.`n" +
            (Get-Content $script:OllamaLockPath -Raw -ErrorAction SilentlyContinue) |
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

    $fs = $null
    try {
        $fs = [System.IO.File]::Open($script:OllamaLockPath, [System.IO.FileMode]::CreateNew)
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
        Remove-Item -Path $script:OllamaLockPath -Force -ErrorAction SilentlyContinue
        return $null
    }

    return [pscustomobject]@{ BlockId = $BlockId; SessionId = $SessionId; AcquiredAt = $now; OwnerPid = $PID }
}

function Invoke-OllamaLockRelease {
    param(
        [Parameter(Mandatory)]$Handle,
        [ValidateSet('COMPLETED_GREEN','COMPLETED_RED','COMPLETED_YELLOW','EARLY_RELEASE','OVERRUN_CONTAINED')]
        [string]$Status = 'COMPLETED_GREEN',
        [switch]$GpuOrphanRisk
    )
    $now = Get-Date

    # OWNERSHIP CHECK (codex P3, 2026-07-22): never rewrite/delete a lock this handle does not
    # own -- the file may have been replaced by another actor (stale-recovery peer, manual
    # intervention). Mismatch -> leave the file alone, log the anomaly, and return.
    $current = $null
    try { $current = Get-Content $script:OllamaLockPath -Raw -ErrorAction Stop | ConvertFrom-Json } catch {}
    $ownPid = if ($Handle.PSObject.Properties['OwnerPid']) { "$($Handle.OwnerPid)" } else { "$PID" }
    if ($null -eq $current -or "$($current.process_id)" -ne $ownPid -or "$($current.scheduled_block_id)" -ne "$($Handle.BlockId)") {
        Write-Warning "ollama_lock: release skipped -- lock file absent or not owned by this handle (found pid '$($current.process_id)' block '$($current.scheduled_block_id)')"
        Write-OllamaDriftLogRow ("| $($Handle.BlockId) | RELEASE_ANOMALY | $($now.ToString('HH:mm:ss')) | $script:LaneId | $($Handle.SessionId) | lock not owned at release; left untouched |") | Out-Null
        return
    }

    if ($GpuOrphanRisk) {
        # Do NOT release onto a possibly-live GPU process: rewrite to MANUAL_HOLD (+24h),
        # non-numeric process_id so no peer ever auto-reclaims it; drop the SSTAC HITL marker.
        $hold = @{
            lane_id            = $script:LaneId
            session_id         = $Handle.SessionId
            process_id         = 'MANUAL_HOLD'
            scheduled_block_id = $Handle.BlockId
            block_or_adhoc     = 'block'
            purpose            = 'MANUAL_HOLD after gpuOrphanRisk -- owner must clear'
            acquired_at        = $Handle.AcquiredAt.ToString('o')
            expires_at         = $now.AddHours(24).ToString('o')
        } | ConvertTo-Json
        Set-Content -Path $script:OllamaLockPath -Value $hold -Encoding ascii
        $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
        $marker = "C:\Projects\HITL_OLLAMA_GPU_ORPHAN_SSTAC_$stamp.md"
        "GPU orphan risk in lane $script:LaneId block $($Handle.BlockId) at $stamp. Lock rewritten to MANUAL_HOLD (+24h). Owner: verify GPU idle (nvidia-smi / ollama ps), then delete $script:OllamaLockPath." |
            Out-File -FilePath $marker -Encoding ascii
        Write-OllamaDriftLogRow ("| $($Handle.BlockId) | MANUAL_HOLD | actual_end $($now.ToString('HH:mm:ss')) | $script:LaneId | $($Handle.SessionId) | gpuOrphanRisk -> lock held; marker $marker |") | Out-Null
        return
    }
    # Closeout row FIRST (while still holding the mutex-of-record), so the IN_FLIGHT row
    # gets its terminal row before the lock disappears (codex P2, 2026-07-22). If the append
    # fails after a retry, STILL delete the lock (a logging failure must never keep the GPU
    # mutex held) but drop an HITL marker so the dangling IN_FLIGHT row is owner-visible.
    $closeRow = "| $($Handle.BlockId) | $Status | actual_end $($now.ToString('HH:mm:ss')) | $script:LaneId | $($Handle.SessionId) |"
    $wrote = Write-OllamaDriftLogRow $closeRow
    if (-not $wrote) {
        Start-Sleep -Seconds 5
        $wrote = Write-OllamaDriftLogRow $closeRow
    }
    if (-not $wrote) {
        $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
        "Drift-log closeout append FAILED twice for lane $script:LaneId block $($Handle.BlockId) at $stamp. The IN_FLIGHT row in the per-day schedule is DANGLING; treat the block as ended at this timestamp. Lock was released normally." |
            Out-File -FilePath "C:\Projects\HITL_OLLAMA_DRIFTLOG_APPEND_FAILED_$stamp.md" -Encoding ascii
    }
    Remove-Item -Path $script:OllamaLockPath -Force -ErrorAction SilentlyContinue
}
