param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = 'C:\Users\jasen\.codex\worktrees\17c2\SSTAC-Dashboard'
$viewerRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot 'viewers\jermilova-public'))
$runnerPath = [IO.Path]::GetFullPath((Join-Path $viewerRoot 'scripts\build-monitored.ps1'))
$unitRoot = Join-Path $repoRoot '.tmp\bnrrm-public-viewer\validation-offline-r1'
$evidenceRoot = Join-Path $unitRoot 'MONITORED_BUILD_R1'
$claimPath = Join-Path $evidenceRoot 'ONE_SHOT_CLAIM'
$statusPath = Join-Path $evidenceRoot 'STATUS.json'
$heartbeatPath = Join-Path $evidenceRoot 'HEARTBEAT.log'
$stdoutPath = Join-Path $evidenceRoot 'BUILD.stdout.log'
$stderrPath = Join-Path $evidenceRoot 'BUILD.stderr.log'
$inventoryPath = Join-Path $unitRoot 'VIEWER_CANDIDATE_INVENTORY_R6.json'
$dependencyInventoryPath = Join-Path $unitRoot 'SOURCE_NODE_MODULES_INVENTORY.json'
$copyReceiptPath = Join-Path $unitRoot 'DEPENDENCY_COPY_RECEIPT_R1.json'
$destinationInventoryPath = Join-Path $unitRoot 'DESTINATION_NODE_MODULES_INVENTORY.json'
$npmUserConfig = Join-Path $unitRoot 'empty-user.npmrc'
$npmGlobalConfig = Join-Path $unitRoot 'empty-global.npmrc'
$runtimeRoot = Join-Path $repoRoot '.tmp\bnrrm-public-viewer\codex-overnight-r1\runtime\node-v22.23.3-win-x64\node-v22.23.3-win-x64'
$nodeExe = Join-Path $runtimeRoot 'node.exe'
$npmCli = Join-Path $runtimeRoot 'node_modules\npm\bin\npm-cli.js'
$nodeSha256 = '9c9245166b4a8e182e0b797da9c20136117ff24368eaff1fec8343a123c8db0e'
$npmCliSha256 = '3ce7cba6f5128dd5f54c98b6a5036b0f850496878cc2e21044b675fe3c594e3e'
$emptySha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
$nonce = 'BNRRM-U3A-VAL-OFFLINE-R1-5A7C6E92'
$deadlineUtc = [DateTime]::Parse('2026-10-20T14:08:17Z').ToUniversalTime()
$permitPath = 'C:\Projects\MC\bn-rrm\reviews\__GOVERNANCE_SUPPLIED_EXACT_RECEIPT_PATH_REQUIRED__'
$permitRoot = [IO.Path]::GetFullPath('C:\Projects\MC\bn-rrm\reviews')
$claimStream = $null
$claimOwned = $false
$evidenceAvailable = $false
$script:status = $null
$script:owned = @{}
$script:viewerInventory = $null
$script:viewerInventoryHash = $null
$script:dependencyMarkers = @()
$script:outputStream = $null
$script:errorStream = $null

function Get-Hash([string] $path) {
    return (Get-FileHash -LiteralPath $path -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
}

function Get-CimStart([object] $row) {
    if ($row.CreationDate -is [DateTime]) { return $row.CreationDate.ToUniversalTime().Ticks }
    return [Management.ManagementDateTimeConverter]::ToDateTime([string] $row.CreationDate).ToUniversalTime().Ticks
}

function Get-Identity([object] $row) {
    if (-not $row.ExecutablePath) { throw 'Process executable identity is unavailable; state is UNKNOWN.' }
    return [pscustomobject]@{
        pid = [int] $row.ProcessId
        parent = [int] $row.ParentProcessId
        created_ticks = [long] (Get-CimStart $row)
        executable = [IO.Path]::GetFullPath([string] $row.ExecutablePath)
    }
}

function Test-SameIdentity([object] $left, [object] $right) {
    return ($left.pid -eq $right.pid -and $left.parent -eq $right.parent -and
        $left.created_ticks -eq $right.created_ticks -and
        $left.executable.Equals($right.executable, [StringComparison]::OrdinalIgnoreCase))
}

function Get-Snapshot {
    $rows = @(Get-CimInstance -ClassName Win32_Process -Property ProcessId,ParentProcessId,CreationDate,ExecutablePath -ErrorAction Stop)
    if ($rows.Count -eq 0) { throw 'Process inspection returned no rows; state is UNKNOWN.' }
    foreach ($row in $rows) {
        if ($null -eq $row.ProcessId -or $null -eq $row.ParentProcessId -or $null -eq $row.CreationDate) {
            throw 'Process inspection omitted identity fields; state is UNKNOWN.'
        }
    }
    return $rows
}

function Get-RowForPid($snapshot, [int] $pidValue) {
    $rows = @($snapshot | Where-Object { [int] $_.ProcessId -eq $pidValue })
    if ($rows.Count -gt 1) { throw "PID $pidValue is ambiguous in process inventory." }
    if ($rows.Count -eq 0) { return $null }
    return Get-Identity $rows[0]
}

function Add-OwnedDescendants($snapshot, [object] $parentIdentity) {
    $queue = [Collections.Generic.Queue[object]]::new()
    $queue.Enqueue($parentIdentity)
    while ($queue.Count -gt 0) {
        $parent = $queue.Dequeue()
        $currentParent = Get-RowForPid $snapshot $parent.pid
        if ($null -eq $currentParent -or -not (Test-SameIdentity $parent $currentParent)) { continue }
        foreach ($row in $snapshot) {
            if ([int] $row.ParentProcessId -ne $parent.pid) { continue }
            $identity = Get-Identity $row
            $key = '{0}|{1}|{2}|{3}' -f $identity.pid,$identity.created_ticks,$identity.executable.ToLowerInvariant(),$identity.parent
            if (-not $script:owned.ContainsKey($key)) {
                $script:owned[$key] = $identity
                $queue.Enqueue($identity)
            }
        }
    }
}

function Get-LiveOwned($snapshot) {
    $live = [Collections.Generic.List[object]]::new()
    foreach ($known in $script:owned.Values) {
        $current = Get-RowForPid $snapshot $known.pid
        if ($null -ne $current -and (Test-SameIdentity $known $current)) { $live.Add($known) }
    }
    return @($live)
}

function Assert-RootIdentity($snapshot, [object] $rootIdentity) {
    $current = Get-RowForPid $snapshot $rootIdentity.pid
    if ($null -eq $current -or -not (Test-SameIdentity $rootIdentity $current)) {
        throw 'Root PID, executable, parent, or exact creation identity changed; state is UNKNOWN.'
    }
}

function Write-Status([string] $state, [string] $stage, [string] $detail) {
    if (-not $script:evidenceAvailable) { throw 'Evidence namespace is not exclusively owned.' }
    $script:status = $state
    $record = [ordered]@{
        schema_version = 'bnrrm-viewer-monitored-build-status-r2'
        preparation_nonce = $nonce
        status = $state
        stage = $stage
        updated_utc = [DateTime]::UtcNow.ToString('o')
        owned_processes = @($script:owned.Values)
        detail = $detail
    }
    [IO.File]::WriteAllText($statusPath, (($record | ConvertTo-Json -Depth 8) + [Environment]::NewLine), [Text.Encoding]::UTF8)
    [IO.File]::AppendAllText($heartbeatPath, ('{0} {1} stage={2} {3}{4}' -f [DateTime]::UtcNow.ToString('o'),$state,$stage,$detail,[Environment]::NewLine), [Text.Encoding]::ASCII)
}

function Assert-ZeroConfig([string] $path) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required npm config is missing: $path" }
    $item = Get-Item -LiteralPath $path -Force
    if ($item.Length -ne 0 -or (Get-Hash $path) -ne $emptySha256) { throw "npm config must be the exact zero-byte file: $path" }
}

function Get-InventoryRows($inventory) {
    $rows = if ($null -ne $inventory.files) { @($inventory.files) } elseif ($null -ne $inventory.entries) { @($inventory.entries) } else { throw 'R6 inventory has no files or entries array.' }
    if ($rows.Count -eq 0) { throw 'R6 candidate inventory is empty.' }
    return $rows
}

function Assert-CandidateBytes($inventory) {
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($entry in (Get-InventoryRows $inventory)) {
        $relative = [string] $(if ($entry.relative_path) { $entry.relative_path } else { $entry.path })
        if (-not $relative -or [IO.Path]::IsPathRooted($relative) -or $relative.Contains('..')) { throw 'Inventory contains an unsafe path.' }
        $full = [IO.Path]::GetFullPath((Join-Path $viewerRoot $relative.Replace('/', '\')))
        if (-not $full.StartsWith($viewerRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { throw "Inventory path escapes the fixed viewer root: $relative" }
        if (-not $seen.Add($relative)) { throw "Inventory path is duplicated: $relative" }
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { throw "Candidate file is missing: $relative" }
        $item = Get-Item -LiteralPath $full -Force
        $expectedBytes = if ($null -ne $entry.bytes) { [long] $entry.bytes } else { [long] $entry.size }
        if ($item.Length -ne $expectedBytes -or (Get-Hash $full) -ne ([string] $entry.sha256).ToLowerInvariant()) {
            throw "Candidate file drifted from frozen inventory: $relative"
        }
    }
}

function Assert-CandidateSnapshot {
    if ((Get-Hash $inventoryPath) -ne $script:viewerInventoryHash) { throw 'Frozen viewer inventory bytes changed during the build.' }
    Assert-CandidateBytes $script:viewerInventory
}

function Assert-DependencyHealth {
    $dependencyRoot = Join-Path $repoRoot 'node_modules'
    $attributes = [IO.File]::GetAttributes($dependencyRoot)
    if (($attributes -band [IO.FileAttributes]::Directory) -eq 0 -or ($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Copied dependency root is not an ordinary directory.'
    }
    foreach ($marker in $script:dependencyMarkers) {
        $markerPath = Join-Path $dependencyRoot $marker.relative_path.Replace('/', '\')
        if ((Get-Hash $markerPath) -ne $marker.sha256) { throw "Copied dependency marker changed: $($marker.relative_path)" }
    }
}

function Assert-PermitPath {
    $full = [IO.Path]::GetFullPath($permitPath)
    if ($permitPath.Contains('__GOVERNANCE_SUPPLIED_EXACT_RECEIPT_PATH_REQUIRED__') -or
        -not $full.StartsWith($permitRoot + '\',[StringComparison]::OrdinalIgnoreCase) -or
        $full.StartsWith($unitRoot,[StringComparison]::OrdinalIgnoreCase)) {
        throw 'Joint permit path is not an exact governance-supplied MC-owned reviews path.'
    }
}

function Stop-OwnedProcesses($snapshot, [object] $rootIdentity) {
    $currentRoot = Get-RowForPid $snapshot $rootIdentity.pid
    $rootReused = ($null -ne $currentRoot -and -not (Test-SameIdentity $rootIdentity $currentRoot))
    Add-OwnedDescendants $snapshot $rootIdentity
    $knownLive = @(Get-LiveOwned $snapshot)
    foreach ($known in @($knownLive | Sort-Object { $_.created_ticks } -Descending)) {
        $fresh = Get-Snapshot
        $current = Get-RowForPid $fresh $known.pid
        if ($null -eq $current) { continue }
        if (-not (Test-SameIdentity $known $current)) { continue }
        $p = [Diagnostics.Process]::GetProcessById($known.pid)
        try {
            $handleStart = $p.StartTime.ToUniversalTime().Ticks
            $handleExe = [IO.Path]::GetFullPath($p.MainModule.FileName)
            if ($handleStart -ne $known.created_ticks -or -not $handleExe.Equals($known.executable,[StringComparison]::OrdinalIgnoreCase)) {
                throw "PID $($known.pid) no longer identifies the exact owned process."
            }
            $p.Kill()
        } finally { $p.Dispose() }
    }
    $stopBy = [DateTime]::UtcNow.AddSeconds(10)
    do {
        $fresh = Get-Snapshot
        $live = @(Get-LiveOwned $fresh)
        if ($live.Count -eq 0) { return }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $stopBy)
    throw ('Known owned descendants remain after bounded stop; count={0}.' -f $live.Count)
}

function Write-OutputLine([string] $streamName, [string] $line) {
    $path = if ($streamName -eq 'OUT') { $stdoutPath } else { $stderrPath }
    $text = '{0} {1}{2}' -f [DateTime]::UtcNow.ToString('o'),$line,[Environment]::NewLine
    [IO.File]::AppendAllText($path,$text,[Text.Encoding]::UTF8)
}

function Invoke-Build {
    Assert-ZeroConfig $npmUserConfig
    Assert-ZeroConfig $npmGlobalConfig
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $nodeExe
    $start.WorkingDirectory = $viewerRoot
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardOutputEncoding = [Text.Encoding]::UTF8
    $start.StandardErrorEncoding = [Text.Encoding]::UTF8
    foreach ($arg in @($npmCli,'run','build')) { $start.ArgumentList.Add($arg) }
    $start.Environment.Clear()
    $start.Environment['PATH'] = "$runtimeRoot;C:\Windows\System32"
    $start.Environment['SystemRoot'] = 'C:\Windows'
    $start.Environment['WINDIR'] = 'C:\Windows'
    $start.Environment['TEMP'] = (Join-Path $unitRoot 'process-temp')
    $start.Environment['TMP'] = (Join-Path $unitRoot 'process-temp')
    $start.Environment['HOME'] = (Join-Path $unitRoot 'process-temp')
    $start.Environment['USERPROFILE'] = (Join-Path $unitRoot 'process-temp')
    $start.Environment['NPM_CONFIG_USERCONFIG'] = $npmUserConfig
    $start.Environment['NPM_CONFIG_GLOBALCONFIG'] = $npmGlobalConfig
    $start.Environment['NPM_CONFIG_CACHE'] = (Join-Path $unitRoot 'npm-cache')
    $start.Environment['NPM_CONFIG_OFFLINE'] = 'true'
    $start.Environment['NPM_CONFIG_AUDIT'] = 'false'
    $start.Environment['NPM_CONFIG_FUND'] = 'false'
    $start.Environment['NEXT_TELEMETRY_DISABLED'] = '1'
    $start.Environment['CI'] = 'true'
    $start.Environment['TZ'] = 'UTC'

    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    if (-not $process.Start()) { throw 'Fixed viewer build process did not start.' }
    $pidValue = $process.Id
    $rootIdentity = $null
    $firstBy = [DateTime]::UtcNow.AddSeconds(5)
    do {
        $snapshot = Get-Snapshot
        $row = Get-RowForPid $snapshot $pidValue
        if ($null -ne $row) { $rootIdentity = $row; break }
        Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $firstBy)
    if ($null -eq $rootIdentity -or -not $rootIdentity.executable.Equals([IO.Path]::GetFullPath($nodeExe),[StringComparison]::OrdinalIgnoreCase) -or
        $rootIdentity.created_ticks -ne $process.StartTime.ToUniversalTime().Ticks) {
        try {
            $process.Kill()
            if (-not $process.WaitForExit(10000)) { throw 'Unproven owned root did not exit within the bounded stop wait.' }
        } catch { }
        throw 'Could not immediately prove the exact fixed Node root identity.'
    }
    $script:owned['{0}|{1}|{2}|{3}' -f $rootIdentity.pid,$rootIdentity.created_ticks,$rootIdentity.executable.ToLowerInvariant(),$rootIdentity.parent] = $rootIdentity
    $stdout = $process.StandardOutput
    $stderr = $process.StandardError
    $stdoutTask = $stdout.ReadLineAsync()
    $stderrTask = $stderr.ReadLineAsync()
    $stdoutEof = $false
    $stderrEof = $false
    $lastProgress = [DateTime]::UtcNow
    $lastBeat = [DateTime]::UtcNow
    $lastDependencyCheck = [DateTime]::UtcNow
    $started = [DateTime]::UtcNow
    $stage = 'build-export'
    $snapshotFresh = $false
    Write-Status 'IN_PROGRESS' $stage 'fixed viewer build/export started with root identity proven'

    while (-not $process.HasExited) {
        if (-not $stdoutEof -and $stdoutTask.IsCompleted) {
            $value = $stdoutTask.GetAwaiter().GetResult()
            if ($null -eq $value) { $stdoutEof = $true } else { Write-OutputLine 'OUT' $value; $lastProgress = [DateTime]::UtcNow; $stdoutTask = $stdout.ReadLineAsync() }
        }
        if (-not $stderrEof -and $stderrTask.IsCompleted) {
            $value = $stderrTask.GetAwaiter().GetResult()
            if ($null -eq $value) { $stderrEof = $true } else { Write-OutputLine 'ERR' $value; $lastProgress = [DateTime]::UtcNow; $stderrTask = $stderr.ReadLineAsync() }
        }
        try {
            $snapshotFresh = $false
            $snapshot = Get-Snapshot
            $snapshotFresh = $true
            Assert-RootIdentity $snapshot $rootIdentity
        }
        catch {
            Write-Status 'UNKNOWN_PROCESS_CUSTODY' $stage $_.Exception.Message
            try {
                if ($snapshotFresh) { Stop-OwnedProcesses $snapshot $rootIdentity }
                else {
                    $process.Kill()
                    if (-not $process.WaitForExit(10000)) { throw 'Owned root did not exit within the bounded stop wait.' }
                }
            }
            catch { Write-Status 'UNKNOWN_PROCESS_CUSTODY' $stage ('root stop uncertain: {0}' -f $_.Exception.Message) }
            throw 'Process identity inspection failed; no further stage will start.'
        }
        Add-OwnedDescendants $snapshot $rootIdentity
        Assert-CandidateSnapshot
        Assert-ZeroConfig $npmUserConfig
        Assert-ZeroConfig $npmGlobalConfig
        if (([DateTime]::UtcNow - $lastDependencyCheck).TotalSeconds -ge 30) {
            Assert-DependencyHealth
            $lastDependencyCheck = [DateTime]::UtcNow
        }
        $age = ([DateTime]::UtcNow - $started).TotalSeconds
        if (([DateTime]::UtcNow - $lastProgress).TotalSeconds -ge 240) {
            Write-Status 'STALLED' $stage 'no stdout/stderr progress for 240 seconds'
            Stop-OwnedProcesses $snapshot $rootIdentity
            throw 'Build stalled; owned process set stopped and verified.'
        }
        if ($age -ge 360 -or [DateTime]::UtcNow -ge $deadlineUtc) {
            Write-Status 'TIMED_OUT' $stage 'fixed stage limit or original deadline reached'
            Stop-OwnedProcesses $snapshot $rootIdentity
            throw 'Build timed out; owned process set stopped and verified.'
        }
        if (([DateTime]::UtcNow - $lastBeat).TotalSeconds -ge 10) {
            Write-Status 'IN_PROGRESS' $stage 'heartbeat; exact root and cumulative descendant identities verified'
            $lastBeat = [DateTime]::UtcNow
        }
        [void] $process.WaitForExit(250)
    }

    if (([DateTime]::UtcNow - $started).TotalSeconds -ge 360 -or [DateTime]::UtcNow -ge $deadlineUtc) {
        Write-Status 'TIMED_OUT' $stage 'fixed stage limit or original deadline reached at process exit'
        throw 'Build reached its fixed timeout or original deadline.'
    }
    if (([DateTime]::UtcNow - $lastProgress).TotalSeconds -ge 240) {
        Write-Status 'STALLED' $stage 'stage exited after the fixed no-progress limit'
        throw 'Build exceeded the fixed stall limit before process exit.'
    }
    $drainBy = [DateTime]::UtcNow.AddSeconds(15)
    while ((-not $stdoutEof -or -not $stderrEof) -and [DateTime]::UtcNow -lt $drainBy) {
        if (-not $stdoutEof -and $stdoutTask.IsCompleted) {
            $value = $stdoutTask.GetAwaiter().GetResult()
            if ($null -eq $value) { $stdoutEof = $true } else { Write-OutputLine 'OUT' $value; $stdoutTask = $stdout.ReadLineAsync() }
        }
        if (-not $stderrEof -and $stderrTask.IsCompleted) {
            $value = $stderrTask.GetAwaiter().GetResult()
            if ($null -eq $value) { $stderrEof = $true } else { Write-OutputLine 'ERR' $value; $stderrTask = $stderr.ReadLineAsync() }
        }
        Start-Sleep -Milliseconds 50
    }
    if (-not $stdoutEof -or -not $stderrEof) {
        $snapshot = Get-Snapshot
        Stop-OwnedProcesses $snapshot $rootIdentity
        throw 'Bounded output drain expired before both stdout and stderr EOF; owned processes were stopped and verified.'
    }
    $snapshot = Get-Snapshot
    Add-OwnedDescendants $snapshot $rootIdentity
    $liveOwned = @(Get-LiveOwned $snapshot)
    if ($liveOwned.Count -gt 0) {
        Write-Status 'CHILD_SURVIVOR' $stage ('owned process identities remain after root exit; count={0}' -f $liveOwned.Count)
        throw 'Known descendant survived root exit; no later stage may start.'
    }
    Assert-CandidateSnapshot
    if ($process.ExitCode -ne 0) { throw ('Fixed viewer build/export exited with code {0}.' -f $process.ExitCode) }
    Write-Status 'COMPLETED_GREEN' $stage 'build and export audit passed; both streams reached EOF; no owned descendants remain'
    $process.Dispose()
}

try {
    if ($PSBoundParameters.Count -ne 0) { throw 'Arguments are prohibited.' }
    if (-not [IO.Path]::GetFullPath((Get-Location).Path).Equals($viewerRoot,[StringComparison]::OrdinalIgnoreCase)) {
        throw 'Invocation cwd must be the exact public viewer root.'
    }
    if (-not [IO.Path]::GetFullPath($PSCommandPath).Equals($runnerPath,[StringComparison]::OrdinalIgnoreCase)) {
        throw 'Invocation path must be the exact fixed monitored runner.'
    }
    if ([DateTime]::UtcNow -ge $deadlineUtc) { throw 'Original execution deadline has elapsed.' }
    if (-not (Test-Path -LiteralPath $inventoryPath -PathType Leaf) -or -not (Test-Path -LiteralPath ($inventoryPath + '.sha256') -PathType Leaf)) {
        throw 'Frozen R6 candidate inventory or sidecar is missing.'
    }
    if (-not (Test-Path -LiteralPath $dependencyInventoryPath -PathType Leaf) -or -not (Test-Path -LiteralPath $copyReceiptPath -PathType Leaf) -or -not (Test-Path -LiteralPath $destinationInventoryPath -PathType Leaf)) {
        throw 'Dependency source/destination inventory or copy receipt is missing.'
    }
    Assert-PermitPath
    if (-not (Test-Path -LiteralPath $permitPath -PathType Leaf) -or -not (Test-Path -LiteralPath ($permitPath + '.sha256') -PathType Leaf)) {
        throw 'The exact MC-owned joint permit and sidecar are absent.'
    }

    [IO.Directory]::CreateDirectory($evidenceRoot) | Out-Null
    $claimStream = [IO.File]::Open($claimPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    $claimOwned = $true
    $claimBytes = [Text.Encoding]::ASCII.GetBytes("$nonce`n$([DateTime]::UtcNow.ToString('o'))`n")
    $claimStream.Write($claimBytes,0,$claimBytes.Length)
    $claimStream.Flush($true)
    foreach ($path in @($statusPath,$heartbeatPath,$stdoutPath,$stderrPath)) {
        if (Test-Path -LiteralPath $path) { throw 'Evidence output exists in the newly claimed one-shot namespace; preserving it without writes.' }
    }
    $evidenceAvailable = $true
    Write-Status 'IN_PROGRESS' 'preflight' 'exclusive one-shot claim acquired; fixed viewer scope verified'

    $permitBytes = [IO.File]::ReadAllBytes($permitPath)
    $permitHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($permitBytes)).ToLowerInvariant()
    $permitSidecar = (Get-Content -LiteralPath ($permitPath + '.sha256') -Raw).Trim().ToLowerInvariant()
    if ($permitHash -ne $permitSidecar) { throw 'MC joint permit sidecar mismatch.' }
    $permit = [Text.Encoding]::UTF8.GetString($permitBytes) | ConvertFrom-Json -ErrorAction Stop
    if ($permit.schema_version -ne 'bnrrm-offline-copy-build-r2' -or $permit.preparation_nonce -ne $nonce -or $permit.mode -ne 'ONE_FIXED_BUILD_EXPORT') {
        throw 'MC permit schema, nonce, or build-only mode mismatch.'
    }
    if (-not [IO.Path]::GetFullPath([string] $permit.path).Equals([IO.Path]::GetFullPath($permitPath),[StringComparison]::OrdinalIgnoreCase)) {
        throw 'MC permit path does not bind this exact configured path.'
    }
    if ($permit.root -ne $repoRoot -or $permit.viewer_root -ne $viewerRoot -or $permit.runner_path -ne $runnerPath -or $permit.deadline_utc -ne '2026-10-20T14:08:17Z') {
        throw 'MC permit does not bind the exact repo, viewer, runner, and original deadline.'
    }
    if ([DateTime]::UtcNow -ge [DateTime]::Parse($permit.deadline_utc).ToUniversalTime()) { throw 'MC permit deadline elapsed.' }
    if (-not $permit.shared_closure_sha256 -or -not $permit.shared_scope_request_sha256 -or $permit.no_shared_write -ne $true) {
        throw 'MC permit must bind the accepted shared closure and explicit no-shared-write disposition.'
    }
    $inventoryHash = Get-Hash $inventoryPath
    if ($inventoryHash -ne $permit.viewer_inventory_sha256) { throw 'MC permit candidate inventory hash mismatch.' }
    $inventory = Get-Content -LiteralPath $inventoryPath -Raw | ConvertFrom-Json -ErrorAction Stop
    $script:viewerInventory = $inventory
    $script:viewerInventoryHash = $inventoryHash
    Assert-CandidateBytes $inventory
    foreach ($bound in @(
        @{ path = $dependencyInventoryPath; hash = $permit.source_inventory_sha256 },
        @{ path = $destinationInventoryPath; hash = $permit.destination_inventory_sha256 },
        @{ path = $copyReceiptPath; hash = $permit.copy_receipt_sha256 }
    )) {
        if (-not $bound.hash -or (Get-Hash $bound.path) -ne $bound.hash) { throw "MC permit binding mismatch: $($bound.path)" }
        $sidecar = (Get-Content -LiteralPath ($bound.path + '.sha256') -Raw).Trim().ToLowerInvariant()
        if ($sidecar -ne $bound.hash) { throw "Inventory/copy receipt sidecar mismatch: $($bound.path)" }
    }
    $sourceTree = Get-Content -LiteralPath $dependencyInventoryPath -Raw | ConvertFrom-Json -ErrorAction Stop
    $destinationTree = Get-Content -LiteralPath $destinationInventoryPath -Raw | ConvertFrom-Json -ErrorAction Stop
    $copyReceipt = Get-Content -LiteralPath $copyReceiptPath -Raw | ConvertFrom-Json -ErrorAction Stop
    if (-not $sourceTree.complete -or -not $destinationTree.complete -or $sourceTree.counts.reparse_points -ne 0 -or $destinationTree.counts.reparse_points -ne 0) {
        throw 'Source or destination dependency inventory is incomplete or contains reparse points.'
    }
    $sourceRows = @($sourceTree.entries | ForEach-Object { '{0}|{1}|{2}|{3}|{4}|{5}' -f $_.relative_path,$_.type,$_.bytes,$_.sha256,$_.empty,$_.reparse_point } | Sort-Object)
    $destinationRows = @($destinationTree.entries | ForEach-Object { '{0}|{1}|{2}|{3}|{4}|{5}' -f $_.relative_path,$_.type,$_.bytes,$_.sha256,$_.empty,$_.reparse_point } | Sort-Object)
    if ($sourceRows.Count -ne $destinationRows.Count -or (Compare-Object $sourceRows $destinationRows).Count -ne 0 -or
        $copyReceipt.status -ne 'COPY_MATCHED' -or $copyReceipt.source_inventory_sha256 -ne $permit.source_inventory_sha256 -or
        $copyReceipt.destination_inventory_sha256 -ne $permit.destination_inventory_sha256 -or
        $copyReceipt.destination -ne (Join-Path $repoRoot 'node_modules')) {
        throw 'Copy receipt or source/destination tree equality check failed.'
    }
    foreach ($markerPath in @('next/package.json','react/package.json','vitest/package.json')) {
        $marker = @($destinationTree.entries | Where-Object { $_.relative_path -eq $markerPath -and $_.type -eq 'file' })
        if ($marker.Count -ne 1 -or -not $marker[0].sha256) { throw "Required dependency health marker is missing: $markerPath" }
        $script:dependencyMarkers += [pscustomobject]@{ relative_path = $markerPath; sha256 = $marker[0].sha256 }
    }
    if ((Get-Hash $nodeExe) -ne $nodeSha256 -or (Get-Hash $npmCli) -ne $npmCliSha256) { throw 'Fixed Node/npm runtime hash mismatch.' }
    if ((Get-Hash (Join-Path $viewerRoot 'package.json')) -ne $permit.viewer_package_sha256) { throw 'Viewer package hash differs from MC permit.' }
    if ((Get-Hash $npmUserConfig) -ne $emptySha256 -or (Get-Hash $npmGlobalConfig) -ne $emptySha256) { throw 'npm config identity is not exact zero-byte SHA-256.' }
    Assert-DependencyHealth
    foreach ($output in @((Join-Path $viewerRoot '.next'),(Join-Path $viewerRoot 'out'))) {
        if (Test-Path -LiteralPath $output) { throw "Viewer output already exists; preserving it: $output" }
    }
    foreach ($output in @((Join-Path $viewerRoot '.next'),(Join-Path $viewerRoot 'out'))) {
        if (Test-Path -LiteralPath $output) { throw "Viewer output already exists; preserving it: $output" }
    }
    $null = Get-Snapshot
    [IO.Directory]::CreateDirectory((Join-Path $unitRoot 'process-temp')) | Out-Null
    [IO.Directory]::CreateDirectory((Join-Path $unitRoot 'npm-cache')) | Out-Null
    Write-Status 'IN_PROGRESS' 'preflight' 'receipt, source inventories, candidate bytes, configs, runtime, output paths, and process inspection verified'
    Invoke-Build
}
catch {
    if ($evidenceAvailable) {
        if ($script:status -notin @('STALLED','TIMED_OUT','UNKNOWN_PROCESS_CUSTODY','CHILD_SURVIVOR','COMPLETED_GREEN')) {
            try { Write-Status 'BLOCKED_OR_FAILED' 'preflight-or-build' $_.Exception.Message } catch { }
        }
        if (-not (Test-Path -LiteralPath $stderrPath)) {
            try { [IO.File]::WriteAllText($stderrPath,('{0} {1}{2}' -f [DateTime]::UtcNow.ToString('o'),$_.Exception.Message,[Environment]::NewLine),[Text.Encoding]::UTF8) } catch { }
        }
    }
    exit 1
}
finally {
    if ($null -ne $claimStream) { $claimStream.Dispose() }
}
