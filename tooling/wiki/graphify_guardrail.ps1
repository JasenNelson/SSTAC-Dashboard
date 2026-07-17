# graphify_guardrail.ps1 -- run graphify (or any exe) with a hard timeout + tree-kill-by-PID.
# Ported/improved from the oc-worker.ps1 timeout pattern: uses Start-Process -PassThru to get the
# EXACT child PID and taskkill /T /F to kill the whole tree by PID on timeout -- this is more robust
# than filtering Win32_Process by name + CommandLine (it also kills the `graphify query` case, whose
# command line does not contain the repo root). FAIL CLOSED: a timeout is a failure (ExitCode 124),
# never a silent success.

function Get-GuardedArgList {
    param([string[]]$GraphifyArgs)
    # INPUT CONTRACT: this guardrail is for the NIGHTLY's controlled graphify calls -- a subcommand
    # (update/cluster-only/label), the repo root path, and simple flags. Those may contain SPACES
    # (e.g. a spaced install path) but NOT embedded double-quotes or trailing backslashes. Whitespace
    # quoting below preserves spaced elements; fully general Windows command-line escaping (embedded
    # quotes, trailing-backslash-before-quote per CommandLineToArgvW) is deliberately OUT OF SCOPE --
    # a caller needing arbitrary `query "..."` text must escape it itself.
    #
    # Windows PowerShell 5.1 Start-Process -ArgumentList flattens a string array into one command line
    # WITHOUT preserving element boundaries or quoting, so a multi-word element (a `query` question, or
    # a path containing spaces) would be split and reach graphify as the wrong argument (fail-open).
    # Quote any element containing whitespace so its boundary survives.
    return @($GraphifyArgs | ForEach-Object {
        if ($_ -match '\s') { '"' + $_ + '"' } else { $_ }
    })
}

function Get-ProcessTreeIds {
    param([Parameter(Mandatory=$true)][int]$RootId)
    # Return the root PID plus ALL descendant PIDs, discovered via Win32_Process ParentProcessId (BFS).
    # This MUST be called BEFORE any kill: once a parent dies, its children are reparented and the
    # ParentProcessId links break, so post-kill discovery would miss survivors. The caller kills the
    # returned snapshot unconditionally (a partial taskkill can kill the wrapper but miss a GPU child).
    $all = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
    $ids = New-Object System.Collections.Generic.List[int]
    $queue = New-Object System.Collections.Generic.Queue[int]
    $queue.Enqueue($RootId)
    while ($queue.Count -gt 0) {
        $id = $queue.Dequeue()
        if (-not $ids.Contains($id)) {
            $ids.Add($id)
            foreach ($c in ($all | Where-Object { $_.ParentProcessId -eq $id })) {
                $cid = [int]$c.ProcessId
                if (-not $ids.Contains($cid)) { $queue.Enqueue($cid) }
            }
        }
    }
    return ,$ids.ToArray()
}

function Invoke-GraphifyGuarded {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$GraphifyExe,
        [Parameter(Mandatory=$true)][string[]]$GraphifyArgs,
        [int]$TimeoutSec = 600
    )
    $safeArgs = Get-GuardedArgList $GraphifyArgs
    $p = Start-Process -FilePath $GraphifyExe -ArgumentList $safeArgs -PassThru -NoNewWindow
    # Cache the process handle immediately: without this, a Start-Process -PassThru object can report
    # a null ExitCode after WaitForExit (well-known PowerShell gotcha) -- the success-path exit code
    # would be lost, so a real graphify failure could be misread as success. Accessing .Handle retains
    # the handle so .ExitCode is reliable.
    $null = $p.Handle
    if (-not $p.WaitForExit($TimeoutSec * 1000)) {
        # Hung -> kill the whole process tree ROBUSTLY. Snapshot every PID in the tree FIRST (before any
        # kill reparents the survivors), then kill the whole snapshot UNCONDITIONALLY by PID -- do NOT
        # gate on the root having exited, because a partial taskkill can terminate the wrapper while a
        # GPU descendant (graphify extract / python promotion) survives and keeps holding the lock.
        $treeIds = Get-ProcessTreeIds -RootId $p.Id
        try { & taskkill /PID $p.Id /T /F 2>$null | Out-Null } catch {}
        Start-Sleep -Milliseconds 300
        foreach ($id in ($treeIds | Sort-Object -Descending)) {
            try { & taskkill /PID $id /F 2>$null | Out-Null } catch {}
            try { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } catch {}
        }
        if (-not $p.HasExited) { try { $p.Kill() } catch {} }
        try { $p.WaitForExit(5000) | Out-Null } catch {}
        # Killed reflects whether EVERY snapshot PID is gone (not just the root) -- the honest signal
        # the nightly needs before it releases the GPU lock.
        $survivors = @($treeIds | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
        return [pscustomobject]@{ TimedOut = $true; ExitCode = 124; ProcId = $p.Id; Killed = ($survivors.Count -eq 0) }
    }
    $p.WaitForExit()  # no-arg flush so ExitCode is fully populated before we read it
    # Killed = $false here: this is the normal-completion path, no tree-kill was performed. Only the
    # timeout branch above sets Killed, and there it means "the kill attempt fully succeeded" (no
    # survivors) -- conflating the two would make a clean run look like a forced-termination event to
    # any caller that checks this flag.
    return [pscustomobject]@{ TimedOut = $false; ExitCode = $p.ExitCode; ProcId = $p.Id; Killed = $false }
}

function Invoke-GraphifyGuardedCapture {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$GraphifyExe,
        [Parameter(Mandatory=$true)][string[]]$GraphifyArgs,
        [int]$TimeoutSec = 1800
    )
    # Like Invoke-GraphifyGuarded (hard timeout + snapshot-then-tree-kill-by-PID, fail-closed exit 124)
    # but captures stdout+stderr to temp files and returns them as OutputLines. Start-Process requires
    # DISTINCT redirect files for stdout and stderr.
    $safeArgs = Get-GuardedArgList $GraphifyArgs
    $so = [System.IO.Path]::GetTempFileName()
    $se = [System.IO.Path]::GetTempFileName()
    try {
        $p = Start-Process -FilePath $GraphifyExe -ArgumentList $safeArgs -PassThru -NoNewWindow -RedirectStandardOutput $so -RedirectStandardError $se
        $null = $p.Handle
        $timedOut = $false
        $exitCode = $null
        # Default $false: the non-timeout ('else') branch below never touches $killed, so this default
        # is what a normal completion reports. Only the timeout branch overwrites it, where $true means
        # "the kill attempt fully succeeded" (no survivors) -- see Invoke-GraphifyGuarded above for why
        # conflating the two is a real bug (codex P2, 2026-07-17).
        $killed = $false
        if (-not $p.WaitForExit($TimeoutSec * 1000)) {
            $timedOut = $true
            $treeIds = Get-ProcessTreeIds -RootId $p.Id
            try { & taskkill /PID $p.Id /T /F 2>$null | Out-Null } catch {}
            Start-Sleep -Milliseconds 300
            foreach ($id in ($treeIds | Sort-Object -Descending)) {
                try { & taskkill /PID $id /F 2>$null | Out-Null } catch {}
                try { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } catch {}
            }
            if (-not $p.HasExited) { try { $p.Kill() } catch {} }
            try { $p.WaitForExit(5000) | Out-Null } catch {}
            $survivors = @($treeIds | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
            $killed = ($survivors.Count -eq 0)
            $exitCode = 124
        } else {
            $p.WaitForExit()
            $exitCode = $p.ExitCode
        }
        $lines = @()
        if (Test-Path $so) { $lines += Get-Content $so }
        if (Test-Path $se) { $lines += Get-Content $se }
        return [pscustomobject]@{ TimedOut = $timedOut; ExitCode = $exitCode; ProcId = $p.Id; Killed = $killed; OutputLines = $lines }
    } finally {
        Remove-Item $so, $se -Force -ErrorAction SilentlyContinue
    }
}
