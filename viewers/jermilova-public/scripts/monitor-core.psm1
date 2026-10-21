Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:R7RepoRoot = 'C:\Users\jasen\.codex\worktrees\17c2\SSTAC-Dashboard'
$script:R7ViewerRoot = Join-Path $script:R7RepoRoot 'viewers\jermilova-public'
$script:R7UnitRoot = Join-Path $script:R7RepoRoot '.tmp\bnrrm-public-viewer\validation-offline-r1'
$script:R7Pwsh = 'C:\Program Files\PowerShell\7\pwsh.exe'
$script:R7PwshSha256 = 'bfb46af89433268872ddb43d1ca7a3f433452ee91ed356a9786940f90118e285'
$script:R7NodeRoot = Join-Path $script:R7RepoRoot '.tmp\bnrrm-public-viewer\codex-overnight-r1\runtime\node-v22.23.3-win-x64\node-v22.23.3-win-x64'
$script:R7Node = Join-Path $script:R7NodeRoot 'node.exe'
$script:R7Npm = Join-Path $script:R7NodeRoot 'node_modules\npm\bin\npm-cli.js'
$script:R7NodeSha256 = '9c9245166b4a8e182e0b797da9c20136117ff24368eaff1fec8343a123c8db0e'
$script:R7NpmSha256 = '3ce7cba6f5128dd5f54c98b6a5036b0f850496878cc2e21044b675fe3c594e3e'
$script:R7HardDeadline = [DateTime]::Parse('2026-10-20T14:08:17Z').ToUniversalTime()
$script:R7Nonce = 'BNRRM-U3A-R7-SRC-20261020-01'
$script:R7InventoryPath = Join-Path $script:R7UnitRoot 'VIEWER_CANDIDATE_INVENTORY_R7.json'
$script:R7PredecessorR6Hash = 'L2_MUST_SUPPLY_EXACT_R6_INVENTORY_SHA256'
$script:R7EmptySha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

function Get-R7Hash([string] $Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
}

function Assert-R7SafePath([string] $Path, [string] $ExpectedRoot, [switch] $MustExist, [switch] $MustBeFile) {
    if (-not [IO.Path]::IsPathRooted($Path)) { throw "Path is not absolute: $Path" }
    $full = [IO.Path]::GetFullPath($Path)
    $root = [IO.Path]::GetFullPath($ExpectedRoot).TrimEnd('\')
    if (-not $full.StartsWith($root + '\',[StringComparison]::OrdinalIgnoreCase)) { throw "Path is outside its fixed root: $full" }
    $relative = $full.Substring($root.Length).TrimStart('\')
    foreach ($segment in $relative.Split('\')) {
        if (-not $segment -or $segment -in @('.','..') -or $segment.Contains(':')) { throw "Unsafe path segment in: $Path" }
    }
    if ($MustExist) {
        $current = $root
        foreach ($segment in $relative.Split('\')) {
            $current = Join-Path $current $segment
            if (-not (Test-Path -LiteralPath $current)) { throw "Required path segment is missing: $current" }
            $item = Get-Item -LiteralPath $current -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse path is prohibited: $current" }
        }
        if ($MustBeFile -and -not (Test-Path -LiteralPath $full -PathType Leaf)) { throw "Expected an ordinary file: $full" }
    }
    return $full
}

function Assert-R7ZeroConfig([string] $Path) {
    $full = Assert-R7SafePath $Path 'C:\Projects\MC\bn-rrm\reviews' -MustExist -MustBeFile
    $item = Get-Item -LiteralPath $full -Force
    if ($item.Length -ne 0 -or (Get-R7Hash $full) -ne $script:R7EmptySha256) { throw "npm config is not the fixed zero-byte file: $full" }
}

function Get-R7Rows($Inventory) {
    if ($Inventory.schema_version -ne 'bnrrm-viewer-candidate-inventory-r7' -or $Inventory.root -ne $script:R7ViewerRoot -or $Inventory.base -ne 'd9c1bb3106bb901bb7bef75a4aee950409c3ef22' -or $Inventory.nonce -ne $script:R7Nonce -or $Inventory.predecessor_r6_inventory_sha256 -ne $script:R7PredecessorR6Hash) {
        throw 'R7 candidate inventory schema, root, base, nonce, or R6 predecessor binding mismatch.'
    }
    if ($script:R7PredecessorR6Hash -notmatch '^[a-f0-9]{64}$') { throw 'Exact R6 predecessor inventory hash has not been supplied; fail closed.' }
    if ($null -eq $Inventory.files -or @($Inventory.files).Count -eq 0) { throw 'R7 inventory has no candidate files.' }
    return @($Inventory.files)
}

function Assert-R7Candidate([string] $InventoryHash, $Inventory) {
    if ((Get-R7Hash $script:R7InventoryPath) -ne $InventoryHash) { throw 'R7 inventory bytes changed.' }
    $rows = Get-R7Rows $Inventory
    $expected = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $expectedDirs = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($entry in $rows) {
        $relative = [string] $entry.path
        if (-not $relative -or [IO.Path]::IsPathRooted($relative)) { throw 'Inventory contains an absolute or empty path.' }
        $segments = $relative.Replace('/','\').Split('\')
        foreach ($segment in $segments) { if (-not $segment -or $segment -in @('.','..') -or $segment.Contains(':')) { throw "Invalid inventory path segment: $relative" } }
        $full = [IO.Path]::GetFullPath((Join-Path $script:R7ViewerRoot $relative.Replace('/','\')))
        if (-not $full.StartsWith($script:R7ViewerRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { throw "Inventory path escapes viewer root: $relative" }
        if (-not $expected.Add($relative.Replace('/','\'))) { throw "Duplicate inventory path: $relative" }
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { throw "Inventory file is missing: $relative" }
        $item = Get-Item -LiteralPath $full -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $item.Length -ne [long] $entry.bytes -or (Get-R7Hash $full) -ne ([string] $entry.sha256).ToLowerInvariant()) {
            throw "Candidate bytes or file identity changed: $relative"
        }
        $parent = Split-Path -Parent $relative.Replace('/','\')
        while ($parent) { [void] $expectedDirs.Add($parent); $parent = Split-Path -Parent $parent }
    }
    $actualFiles = @(Get-ChildItem -LiteralPath $script:R7ViewerRoot -File -Recurse -Force | Where-Object { $_.FullName -notmatch '[\\](\.next|out)([\\]|$)' })
    if ($actualFiles.Count -ne $expected.Count) { throw 'Viewer has unlisted files or inventory-listed files are missing.' }
    foreach ($file in $actualFiles) {
        $rel = $file.FullName.Substring($script:R7ViewerRoot.Length).TrimStart('\')
        if (-not $expected.Contains($rel)) { throw "Unlisted viewer file: $rel" }
        if (($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Viewer tree contains reparse file: $rel" }
    }
    $actualDirs = @(Get-ChildItem -LiteralPath $script:R7ViewerRoot -Directory -Recurse -Force | Where-Object { $_.FullName -notmatch '[\\](\.next|out)([\\]|$)' })
    foreach ($dir in $actualDirs) {
        $rel = $dir.FullName.Substring($script:R7ViewerRoot.Length).TrimStart('\')
        if (-not $expectedDirs.Contains($rel)) { throw "Unlisted viewer directory: $rel" }
        if (($dir.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Viewer tree contains reparse directory: $rel" }
    }
    foreach ($output in @((Join-Path $script:R7ViewerRoot '.next'),(Join-Path $script:R7ViewerRoot 'out'))) {
        if (Test-Path -LiteralPath $output) { throw "Build output exists before this one-shot run: $output" }
    }
}

function Get-R7ProcessSnapshot {
    $rows = @(Get-CimInstance -ClassName Win32_Process -Property ProcessId,ParentProcessId,CreationDate,ExecutablePath -ErrorAction Stop)
    if (-not $rows.Count) { throw 'CIM returned no process rows; process custody is UNKNOWN.' }
    foreach ($row in $rows) { if ($null -eq $row.ProcessId -or $null -eq $row.ParentProcessId -or $null -eq $row.CreationDate) { throw 'CIM omitted process identity fields.' } }
    return $rows
}

function ConvertTo-R7Identity([object] $Row) {
    if (-not $Row.ExecutablePath) { throw 'Process executable path is unknown.' }
    $created = if ($Row.CreationDate -is [DateTime]) { $Row.CreationDate.ToUniversalTime().ToString('o') } else { [Management.ManagementDateTimeConverter]::ToDateTime([string] $Row.CreationDate).ToUniversalTime().ToString('o') }
    return [pscustomobject]@{ pid=[int]$Row.ProcessId; created=$created; executable=[IO.Path]::GetFullPath([string]$Row.ExecutablePath); parent=[int]$Row.ParentProcessId }
}

function Test-R7Identity([object] $A,[object] $B) {
    return $A.pid -eq $B.pid -and $A.created -ceq $B.created -and $A.parent -eq $B.parent -and $A.executable.Equals($B.executable,[StringComparison]::OrdinalIgnoreCase)
}

function Update-R7Ledger($Snapshot,[hashtable] $Ledger,[object] $RootIdentity) {
    $now = [DateTime]::UtcNow.ToString('o')
    $everPids = @($Ledger.Values | ForEach-Object { [int] $_.pid })
    foreach ($row in $Snapshot) {
        $identity = ConvertTo-R7Identity $row
        if ($identity.pid -eq $RootIdentity.pid -or $identity.parent -in $everPids) {
            if ($Ledger.ContainsKey([string] $identity.pid)) {
                $saved = $Ledger[[string] $identity.pid]
                if (-not (Test-R7Identity $saved $identity)) { throw "PID_REUSE_OR_IDENTITY_CHANGE pid=$($identity.pid)" }
                $saved.last_seen_utc = $now
                $saved.live = $true
            } else {
                $parentKnown = $Ledger[[string] $identity.parent]
                if (-not $parentKnown.live) { throw "AMBIGUOUS_LATE_DESCENDANT pid=$($identity.pid) parent=$($identity.parent)" }
                $Ledger[[string] $identity.pid] = [pscustomobject]@{ pid=$identity.pid; created=$identity.created; executable=$identity.executable; parent=$identity.parent; first_seen_utc=$now; last_seen_utc=$now; live=$true; exited_utc=$null }
            }
        }
    }
    foreach ($key in @($Ledger.Keys)) {
        $saved = $Ledger[$key]
        $rows = @($Snapshot | Where-Object { [int] $_.ProcessId -eq [int] $saved.pid })
        if ($rows.Count -gt 1) { throw "PID_REUSE_OR_IDENTITY_CHANGE ambiguous pid=$($saved.pid)" }
        if ($rows.Count -eq 1) {
            $current = ConvertTo-R7Identity $rows[0]
            if (-not (Test-R7Identity $saved $current)) { throw "PID_REUSE_OR_IDENTITY_CHANGE pid=$($saved.pid)" }
        } elseif ($saved.live) {
            $saved.live = $false
            $saved.exited_utc = $now
        }
    }
}

function Write-R7Status([hashtable] $Run,[string] $State,[string] $Detail) {
    if (-not $Run.evidence_owned) { throw 'One-shot evidence claim is not owned.' }
    $Run.status = $State
    $data = [ordered]@{ schema='bnrrm-monitor-status-r7'; nonce=$script:R7Nonce; mode=$Run.mode; state=$State; at_utc=[DateTime]::UtcNow.ToString('o'); stage=$Run.stage; identities=@($Run.ledger.Values); detail=$Detail }
    [IO.File]::WriteAllText($Run.status_path,(($data | ConvertTo-Json -Depth 12)+[Environment]::NewLine),[Text.Encoding]::UTF8)
    [IO.File]::AppendAllText($Run.heartbeat_path,('{0} {1} stage={2} {3}{4}' -f [DateTime]::UtcNow.ToString('o'),$State,$Run.stage,$Detail,[Environment]::NewLine),[Text.Encoding]::ASCII)
}

function Add-R7Chunk([hashtable] $Run,[string] $Stream,[char[]] $Buffer,[int] $Count) {
    if ($Count -le 0) { return }
    $text = [string]::new($Buffer,0,$Count)
    $bytes = [Text.Encoding]::UTF8.GetBytes($text)
    if ($Run.log_bytes[$Stream] + $bytes.Length -gt 10485760) { throw 'Bounded process log byte limit exceeded.' }
    $Run.log_bytes[$Stream] += $bytes.Length
    $Run.tail[$Stream] += $text
    if ($Run.tail[$Stream].Length -gt 65536) { $Run.tail[$Stream] = $Run.tail[$Stream].Substring($Run.tail[$Stream].Length - 65536) }
    $path = $Run.log_paths[$Stream]
    [IO.File]::AppendAllText($path,$text,[Text.Encoding]::UTF8)
    $Run.last_progress_utc = [DateTime]::UtcNow
}

function Start-R7Reads([hashtable] $Run) {
    if (-not $Run.stdout_eof -and ($null -eq $Run.stdout_task -or $Run.stdout_task.IsCompleted)) {
        if ($null -ne $Run.stdout_task) { $count=$Run.stdout_task.GetAwaiter().GetResult(); if ($count -eq 0) { $Run.stdout_eof=$true } else { Add-R7Chunk $Run 'stdout' $Run.stdout_buffer $count } }
        if (-not $Run.stdout_eof) { $Run.stdout_task=$Run.process.StandardOutput.ReadAsync($Run.stdout_buffer,0,$Run.stdout_buffer.Length) }
    }
    if (-not $Run.stderr_eof -and ($null -eq $Run.stderr_task -or $Run.stderr_task.IsCompleted)) {
        if ($null -ne $Run.stderr_task) { $count=$Run.stderr_task.GetAwaiter().GetResult(); if ($count -eq 0) { $Run.stderr_eof=$true } else { Add-R7Chunk $Run 'stderr' $Run.stderr_buffer $count } }
        if (-not $Run.stderr_eof) { $Run.stderr_task=$Run.process.StandardError.ReadAsync($Run.stderr_buffer,0,$Run.stderr_buffer.Length) }
    }
}

function Stop-AndDrainR7([hashtable] $Run,[string] $Reason) {
    $inspectionOk = $false
    try {
        $snapshot = Get-R7ProcessSnapshot
        Update-R7Ledger $snapshot $Run.ledger $Run.root_identity
        $inspectionOk = $true
    } catch { $Run.stop_unknown = $_.Exception.Message }
    if ($inspectionOk) {
        foreach ($known in @($Run.ledger.Values | Where-Object { $_.live } | Sort-Object { $_.first_seen_utc } -Descending)) {
            try {
                $snapshot = Get-R7ProcessSnapshot
                $rows = @($snapshot | Where-Object { [int] $_.ProcessId -eq [int] $known.pid })
                if ($rows.Count -eq 0) { continue }
                if ($rows.Count -ne 1) { throw 'Ambiguous PID before stop.' }
                $current = ConvertTo-R7Identity $rows[0]
                if (-not (Test-R7Identity $known $current)) { throw "PID_REUSE_OR_IDENTITY_CHANGE before stop pid=$($known.pid)" }
                $p = [Diagnostics.Process]::GetProcessById([int] $known.pid)
                try {
                    if ($p.StartTime.ToUniversalTime().ToString('o') -cne $known.created -or -not [IO.Path]::GetFullPath($p.MainModule.FileName).Equals($known.executable,[StringComparison]::OrdinalIgnoreCase)) { throw 'Process handle identity changed before stop.' }
                    $p.Kill()
                } finally { $p.Dispose() }
            } catch { $Run.stop_unknown = $_.Exception.Message }
        }
    } else {
        try { if (-not $Run.process.HasExited) { $Run.process.Kill() } } catch { $Run.stop_unknown = $_.Exception.Message }
    }
    $drainEnd = [DateTime]::UtcNow.AddSeconds(15)
    if ($Run.stage_deadline -lt $drainEnd) { $drainEnd=$Run.stage_deadline }
    if ($Run.permit_deadline -lt $drainEnd) { $drainEnd=$Run.permit_deadline }
    if ($script:R7HardDeadline -lt $drainEnd) { $drainEnd=$script:R7HardDeadline }
    while ([DateTime]::UtcNow -lt $drainEnd -and (-not $Run.stdout_eof -or -not $Run.stderr_eof)) {
        try { Start-R7Reads $Run } catch { $Run.stop_unknown = $_.Exception.Message; break }
        Start-Sleep -Milliseconds 50
    }
    if (-not $Run.stdout_eof -or -not $Run.stderr_eof -or $Run.stop_unknown) { throw "STOP_UNVERIFIED: $Reason; $($Run.stop_unknown)" }
}

function Assert-R7Permit([hashtable] $Config,[string] $RunnerPath,[string] $CorePath) {
    $permitPath = if ($Config.mode -eq 'test') { 'C:\Projects\MC\bn-rrm\reviews\BNRRM_U3A_R7_TEST_PERMIT.json' } else { 'C:\Projects\MC\bn-rrm\reviews\BNRRM_U3A_R7_BUILD_PERMIT.json' }
    $permitPath = Assert-R7SafePath $permitPath 'C:\Projects\MC\bn-rrm\reviews' -MustExist -MustBeFile
    $sidecarPath = $permitPath + '.sha256'
    $null = Assert-R7SafePath $sidecarPath 'C:\Projects\MC\bn-rrm\reviews' -MustExist -MustBeFile
    $bytes = [IO.File]::ReadAllBytes($permitPath)
    $hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
    if ((Get-Content -LiteralPath $sidecarPath -Raw).Trim().ToLowerInvariant() -ne $hash) { throw 'MC permit sidecar mismatch.' }
    $permit = [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json -ErrorAction Stop
    $schema = if ($Config.mode -eq 'test') { 'bnrrm-offline-test-r7' } else { 'bnrrm-offline-build-r7' }
    if ($permit.schema_version -ne $schema -or $permit.nonce -ne $script:R7Nonce -or $permit.mode -ne $Config.mode) { throw 'MC permit schema, nonce, or mode mismatch.' }
    if ($permit.repo_root -ne $script:R7RepoRoot -or $permit.viewer_root -ne $script:R7ViewerRoot -or $permit.runner_path -ne $RunnerPath -or $permit.core_path -ne $CorePath) { throw 'MC permit root or runner binding mismatch.' }
    if ($permit.deadline_utc -ne '2026-10-20T14:08:17Z' -or [DateTime]::UtcNow -ge [DateTime]::Parse($permit.deadline_utc).ToUniversalTime()) { throw 'MC permit exceeds or has reached the original deadline.' }
    if ($permit.inventory_sha256 -ne $Config.inventory_hash -or $permit.predecessor_r6_inventory_sha256 -ne $script:R7PredecessorR6Hash) { throw 'MC permit inventory or predecessor binding mismatch.' }
    if ($permit.pwsh_path -ne $script:R7Pwsh -or $permit.pwsh_sha256 -ne $script:R7PwshSha256) { throw 'MC permit pwsh binding mismatch.' }
    if ($permit.user_config_path -ne 'C:\Projects\MC\bn-rrm\reviews\BNRRM_U3A_R7_EMPTY_USER.npmrc' -or $permit.global_config_path -ne 'C:\Projects\MC\bn-rrm\reviews\BNRRM_U3A_R7_EMPTY_GLOBAL.npmrc') { throw 'MC permit npm config paths mismatch.' }
    Assert-R7ZeroConfig $permit.user_config_path
    Assert-R7ZeroConfig $permit.global_config_path
    if ($permit.user_config_sha256 -ne $script:R7EmptySha256 -or $permit.global_config_sha256 -ne $script:R7EmptySha256) { throw 'MC permit npm config hash mismatch.' }
    if ($Config.mode -eq 'build') {
        $acceptPath = Assert-R7SafePath 'C:\Projects\MC\bn-rrm\reviews\BNRRM_U3A_R7_TEST_ACCEPTANCE.json' 'C:\Projects\MC\bn-rrm\reviews' -MustExist -MustBeFile
        $acceptSidecar = Assert-R7SafePath ($acceptPath + '.sha256') 'C:\Projects\MC\bn-rrm\reviews' -MustExist -MustBeFile
        $acceptHash = Get-R7Hash $acceptPath
        if ((Get-Content -LiteralPath $acceptSidecar -Raw).Trim().ToLowerInvariant() -ne $acceptHash -or $permit.accepted_test_receipt_sha256 -ne $acceptHash) { throw 'Build permit does not bind exact MC test acceptance receipt.' }
    }
    return @{ object=$permit; path=$permitPath; hash=$hash; deadline=[DateTime]::Parse($permit.deadline_utc).ToUniversalTime() }
}

function Invoke-R7Monitored([hashtable] $Config,[string] $RunnerPath) {
    $runner = Assert-R7SafePath $RunnerPath $script:R7ViewerRoot -MustExist -MustBeFile
    $core = Assert-R7SafePath $PSCommandPath $script:R7ViewerRoot -MustExist -MustBeFile
    if (-not [IO.Path]::GetFullPath((Get-Location).Path).Equals($script:R7ViewerRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Invocation cwd is not the exact viewer root.' }
    if (-not [IO.Path]::GetFullPath($PSHOME + '\pwsh.exe').Equals($script:R7Pwsh,[StringComparison]::OrdinalIgnoreCase) -or (Get-R7Hash $script:R7Pwsh) -ne $script:R7PwshSha256) { throw 'Current PowerShell executable path/hash mismatch.' }
    if ((Get-R7Hash $script:R7Node) -ne $script:R7NodeSha256 -or (Get-R7Hash $script:R7Npm) -ne $script:R7NpmSha256) { throw 'Fixed Node/npm runtime hash mismatch.' }
    $inventoryBytes = [IO.File]::ReadAllBytes($script:R7InventoryPath)
    $inventoryHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($inventoryBytes)).ToLowerInvariant()
    $sidecar = (Get-Content -LiteralPath ($script:R7InventoryPath + '.sha256') -Raw).Trim().ToLowerInvariant()
    if ($inventoryHash -ne $sidecar) { throw 'R7 inventory sidecar mismatch.' }
    $inventory = [Text.Encoding]::UTF8.GetString($inventoryBytes) | ConvertFrom-Json -ErrorAction Stop
    $null = Get-R7Rows $inventory
    $Config.inventory_hash = $inventoryHash
    $permitBundle = Assert-R7Permit $Config $runner $core
    if ($Config.mode -eq 'test') {
        $expected = @($permitBundle.object.expected_test_files | Sort-Object)
        if (-not ($expected -contains 'lib/PackLoadState.test.tsx')) { throw 'Test permit omits required TSX collection file.' }
        $listed = @((Get-R7Rows $inventory | Where-Object { $_.path -match '\.test\.(ts|tsx)$' } | ForEach-Object { $_.path }) | Sort-Object)
        if (Compare-Object $expected $listed) { throw 'Permit expected test set does not equal the complete R7 candidate test set.' }
    }
    Assert-R7Candidate $inventoryHash $inventory
    $phase = if ($Config.mode -eq 'test') { 'TEST_R7' } else { 'BUILD_R7' }
    $claim = Join-Path $script:R7UnitRoot ($phase + '.CLAIM')
    $evidence = Join-Path $script:R7UnitRoot $phase
    $outputs = @((Join-Path $evidence 'STATUS.json'),(Join-Path $evidence 'HEARTBEAT.log'),(Join-Path $evidence 'stdout.log'),(Join-Path $evidence 'stderr.log'),(Join-Path $evidence 'SUMMARY.json'))
    if (Test-Path -LiteralPath $claim) { throw 'One-shot claim already exists; no evidence was changed.' }
    foreach ($path in $outputs) { if (Test-Path -LiteralPath $path) { throw "One-shot phase output already exists: $path" } }
    $claimStream = [IO.File]::Open($claim,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $claimStream.Write([Text.Encoding]::ASCII.GetBytes("$script:R7Nonce`n$phase`n")); $claimStream.Flush($true) } finally { $claimStream.Dispose() }
    [IO.Directory]::CreateDirectory($evidence) | Out-Null
    $Run = @{ mode=$Config.mode; claim=$claim; evidence_owned=$true; evidence=$evidence; status_path=$outputs[0]; heartbeat_path=$outputs[1]; log_paths=@{stdout=$outputs[2];stderr=$outputs[3]}; log_bytes=@{stdout=0;stderr=0}; tail=@{stdout='';stderr=''}; ledger=@{}; status=$null; stage='preflight'; stop_unknown=$null; last_progress_utc=[DateTime]::UtcNow; permit_deadline=$permitBundle.deadline }
    [IO.File]::WriteAllText($Run.status_path,'{}',[Text.Encoding]::UTF8)
    [IO.File]::WriteAllText($Run.heartbeat_path,'',[Text.Encoding]::ASCII)
    [IO.File]::WriteAllText($Run.log_paths.stdout,'',[Text.Encoding]::UTF8)
    [IO.File]::WriteAllText($Run.log_paths.stderr,'',[Text.Encoding]::UTF8)
    $Run.stdout_buffer = [char[]]::new(4096); $Run.stderr_buffer = [char[]]::new(4096)
    $Run.stdout_task=$null; $Run.stderr_task=$null; $Run.stdout_eof=$false; $Run.stderr_eof=$false
    try {
        $stages = if ($Config.mode -eq 'test') { @(@('node-version','--version'),@('npm-version',$script:R7Npm,'--version'),@('test-collect',$script:R7Npm,'run','test:collect'),@('test-ci',$script:R7Npm,'run','test:ci')) } else { @(@('build-frozen',$script:R7Npm,'run','build:frozen')) }
        foreach ($stage in $stages) {
            $Run.stage = $stage[0]
            if ([DateTime]::UtcNow -ge $script:R7HardDeadline -or [DateTime]::UtcNow -ge $Run.permit_deadline) { throw 'Hard or permit deadline reached before stage.' }
            Assert-R7Candidate $inventoryHash $inventory
            Assert-R7ZeroConfig $permitBundle.object.user_config_path
            Assert-R7ZeroConfig $permitBundle.object.global_config_path
            if ((Get-R7Hash $runner) -ne $Config.runner_sha256 -or (Get-R7Hash $core) -ne $Config.core_sha256) { throw 'Runner/core source drift before process launch.' }
            $start = [Diagnostics.ProcessStartInfo]::new(); $start.FileName=$script:R7Node; $start.WorkingDirectory=$script:R7ViewerRoot; $start.UseShellExecute=$false; $start.CreateNoWindow=$true; $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
            foreach ($arg in $stage[1..($stage.Count-1)]) { $start.ArgumentList.Add([string]$arg) }
            $start.Environment.Clear(); $start.Environment['PATH']="$script:R7NodeRoot;C:\Windows\System32"; $start.Environment['SystemRoot']='C:\Windows'; $start.Environment['WINDIR']='C:\Windows'; $start.Environment['TEMP']=(Join-Path $evidence 'temp'); $start.Environment['TMP']=(Join-Path $evidence 'temp'); $start.Environment['HOME']=(Join-Path $evidence 'temp'); $start.Environment['USERPROFILE']=(Join-Path $evidence 'temp'); $start.Environment['NPM_CONFIG_USERCONFIG']=$permitBundle.object.user_config_path; $start.Environment['NPM_CONFIG_GLOBALCONFIG']=$permitBundle.object.global_config_path; $start.Environment['NPM_CONFIG_CACHE']=(Join-Path $evidence 'npm-cache'); $start.Environment['NPM_CONFIG_OFFLINE']='true'; $start.Environment['CI']='true'; $start.Environment['NEXT_TELEMETRY_DISABLED']='1'; $start.Environment['TZ']='UTC'
            [IO.Directory]::CreateDirectory((Join-Path $evidence 'temp')) | Out-Null; [IO.Directory]::CreateDirectory((Join-Path $evidence 'npm-cache')) | Out-Null
            $Run.process=[Diagnostics.Process]::new(); $Run.process.StartInfo=$start; if (-not $Run.process.Start()) { throw "Could not start $($stage[0])." }
            $Run.stage_deadline=[DateTime]::UtcNow.AddSeconds([int]$Config.stage_timeout_seconds)
            if ($Run.stage_deadline -gt $Run.permit_deadline) {$Run.stage_deadline=$Run.permit_deadline}; if ($Run.stage_deadline -gt $script:R7HardDeadline) {$Run.stage_deadline=$script:R7HardDeadline}
            $pidNow=$Run.process.Id; $rootRow=$null; $rootDeadline=[DateTime]::UtcNow.AddSeconds(5)
            do { $snap=Get-R7ProcessSnapshot; $matches=@($snap | Where-Object { [int]$_.ProcessId -eq $pidNow }); if ($matches.Count -eq 1) {$rootRow=ConvertTo-R7Identity $matches[0];break}; Start-Sleep -Milliseconds 50 } while ([DateTime]::UtcNow -lt $rootDeadline)
            if ($null -eq $rootRow -or -not $rootRow.executable.Equals([IO.Path]::GetFullPath($script:R7Node),[StringComparison]::OrdinalIgnoreCase) -or $rootRow.created -cne $Run.process.StartTime.ToUniversalTime().ToString('o')) { throw 'Started Node root identity was not exactly proven.' }
            $Run.root_identity=$rootRow; $Run.ledger[[string]$rootRow.pid]=[pscustomobject]@{pid=$rootRow.pid;created=$rootRow.created;executable=$rootRow.executable;parent=$rootRow.parent;first_seen_utc=[DateTime]::UtcNow.ToString('o');last_seen_utc=[DateTime]::UtcNow.ToString('o');live=$true;exited_utc=$null}
            $Run.stdout_task=$Run.process.StandardOutput.ReadAsync($Run.stdout_buffer,0,$Run.stdout_buffer.Length); $Run.stderr_task=$Run.process.StandardError.ReadAsync($Run.stderr_buffer,0,$Run.stderr_buffer.Length); $Run.stdout_eof=$false; $Run.stderr_eof=$false
            $Run.last_progress_utc=[DateTime]::UtcNow; $lastHeartbeat=[DateTime]::UtcNow
            Write-R7Status $Run 'IN_PROGRESS' 'fixed stage started; exact root identity captured'
            while (-not $Run.process.HasExited) {
                Start-R7Reads $Run
                $snap=Get-R7ProcessSnapshot
                Update-R7Ledger $snap $Run.ledger $Run.root_identity
                Assert-R7Candidate $inventoryHash $inventory
                Assert-R7ZeroConfig $permitBundle.object.user_config_path; Assert-R7ZeroConfig $permitBundle.object.global_config_path
                if (([DateTime]::UtcNow-$Run.last_progress_utc).TotalSeconds -ge 240) { throw 'STALLED: no stdout/stderr progress for 240 seconds.' }
                if ([DateTime]::UtcNow -ge $Run.stage_deadline) { throw 'TIMED_OUT: stage deadline reached.' }
                if (([DateTime]::UtcNow-$lastHeartbeat).TotalSeconds -ge 10) { Write-R7Status $Run 'IN_PROGRESS' 'heartbeat; identity ledger and source/config hashes verified'; $lastHeartbeat=[DateTime]::UtcNow }
                [void]$Run.process.WaitForExit(100)
            }
            $drainEnd=[DateTime]::UtcNow.AddSeconds(15); foreach ($d in @($Run.stage_deadline,$Run.permit_deadline,$script:R7HardDeadline)) {if($d -lt $drainEnd){$drainEnd=$d}}
            while ((!$Run.stdout_eof -or !$Run.stderr_eof) -and [DateTime]::UtcNow -lt $drainEnd) {Start-R7Reads $Run; Start-Sleep -Milliseconds 40}
            if (!$Run.stdout_eof -or !$Run.stderr_eof) { throw 'Inherited pipe did not reach both EOFs within bounded drain.' }
            $snap=Get-R7ProcessSnapshot; Update-R7Ledger $snap $Run.ledger $Run.root_identity
            $everPids=@($Run.ledger.Values | ForEach-Object {[int]$_.pid}); $late=@($snap | Where-Object { [int]$_.ParentProcessId -in $everPids })
            if ($late.Count -gt 0 -or @($Run.ledger.Values | Where-Object {$_.live}).Count -gt 0) { throw 'CHILD_SURVIVOR or AMBIGUOUS_LATE_DESCENDANT remains.' }
            Assert-R7Candidate $inventoryHash $inventory
            if ($Run.process.ExitCode -ne 0) { throw "Stage exited nonzero: $($stage[0]) code=$($Run.process.ExitCode)" }
            Write-R7Status $Run 'STAGE_GREEN' 'stage exited zero; both streams EOF; all known identities absent; no late children'
            $Run.process.Dispose()
        }
        Write-R7Status $Run 'COMPLETED_GREEN' 'all fixed mode stages passed'
    } catch {
        $failure=$_.Exception.Message
        if ($null -ne $Run.process -and -not $Run.process.HasExited) {
            try { Stop-AndDrainR7 $Run $failure } catch { $failure += ' | ' + $_.Exception.Message }
        }
        $state=if($failure -match 'PID_REUSE_OR_IDENTITY_CHANGE'){'PID_REUSE_OR_IDENTITY_CHANGE'}elseif($failure -match 'AMBIGUOUS_LATE_DESCENDANT'){'AMBIGUOUS_LATE_DESCENDANT'}elseif($failure -match 'CIM|UNKNOWN|STOP_UNVERIFIED'){'UNKNOWN_PROCESS_CUSTODY'}elseif($failure -match 'STALLED'){'STALLED'}elseif($failure -match 'TIMED_OUT'){'TIMED_OUT'}else{'COMPLETED_RED'}
        Write-R7Status $Run $state $failure
        throw
    }
}

Export-ModuleMember -Function Get-R7Hash,Assert-R7SafePath,Assert-R7ZeroConfig,Get-R7Rows,Assert-R7Candidate,Get-R7ProcessSnapshot,ConvertTo-R7Identity,Test-R7Identity,Update-R7Ledger,Write-R7Status,Add-R7Chunk,Start-R7Reads,Stop-AndDrainR7,Assert-R7Permit,Invoke-R7Monitored
