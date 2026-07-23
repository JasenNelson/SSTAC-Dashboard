param(
    [string]$RuntimeRoot,
    [string]$ConfigPath,
    [string]$TaskQueryOutputPath,
    [string]$McpStatusOutputPath,
    [string]$GraphifyVersionOverride,
    [int]$CommandTimeoutSeconds = 10
)

# Read-only owner preflight: no fetch, registration, MCP mutation, Ollama call, lock mutation, or repo write.
$ErrorActionPreference = 'Stop'
$script:Failed = $false
$script:Actions = New-Object System.Collections.Generic.List[string]

function Check([string]$state, [string]$name, [string]$detail, [bool]$required = $false) {
    Write-Output ("{0,-7} {1}: {2}" -f $state, $name, $detail)
    if ($required -and $state -ne 'PASS') { $script:Failed = $true }
}

function Action([string]$text) {
    if (-not $script:Actions.Contains($text)) { [void]$script:Actions.Add($text) }
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

if (-not $RuntimeRoot) { $RuntimeRoot = $env:SSTAC_WIKI_RUNTIME_ROOT }
if (-not $RuntimeRoot) { $RuntimeRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
try {
    $RuntimeRoot = (Resolve-Path -LiteralPath $RuntimeRoot).Path
} catch {
    Check FAIL 'runtime-root' "unavailable: $RuntimeRoot" $true
    Action 'Select an existing canonical runtime root and rerun.'
    Write-Output 'RESULT NOT_READY'
    exit 1
}
Check PASS 'runtime-root' $RuntimeRoot $true

if (-not $ConfigPath) { $ConfigPath = Join-Path $RuntimeRoot 'tooling\wiki\wiki_nightly_config.json' }
$config = $null
try {
    $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    if (-not $config.serve_gate.remote -or -not $config.serve_gate.branch) { throw 'serve_gate remote/branch missing' }
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

try {
    $graph = Get-Content -LiteralPath (Join-Path $RuntimeRoot 'wiki\.graph\graph.json') -Raw | ConvertFrom-Json
    $nodeCount = @($graph.nodes).Count
    $linkCount = @($graph.links).Count
    if ($nodeCount -lt 1 -or $linkCount -lt 1) { throw 'nodes/links missing or empty' }
    Check PASS 'served-graph' "$nodeCount nodes, $linkCount links" $true
} catch {
    Check FAIL 'served-graph' 'missing, invalid, or empty graph.json' $true
    Action 'Run the deterministic wiki build in this runtime.'
}

$headStatus = Invoke-GitReadOnly @('rev-parse', 'HEAD')
$head = Get-TrimmedText $headStatus
$stampPath = Join-Path $RuntimeRoot 'wiki\.build-stamp'
try {
    $stamp = (Get-Content -LiteralPath $stampPath -Raw).Trim()
    if ($head -and $stamp -match [regex]::Escape($head)) { Check PASS 'build-stamp' 'matches HEAD' $true }
    else { throw 'stamp mismatch' }
} catch {
    Check FAIL 'build-stamp' 'missing HEAD OID or does not match HEAD' $true
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

$receipt = Get-ChildItem -LiteralPath (Join-Path $RuntimeRoot '.tmp_wiki_nightly') -Filter 'receipt-*.md' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$task = Status $TaskQueryOutputPath 'schtasks.exe' @('/Query', '/TN', 'SSTAC-Wiki-Nightly', '/FO', 'LIST', '/V')
$taskPresent = $false
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

if (Test-Path -LiteralPath 'C:\Projects\OLLAMA_STANDING_BLOCK_SSTAC_WIKI.md') { Check INFO 'standing-block' 'present' }
else { Check INFO 'standing-block' 'absent; semantic tier owner-gated' }
if (Test-Path -LiteralPath 'C:\Projects\OLLAMA_ACTIVE.lock') { Check INFO 'active-lock' 'present; do not delete' }
else { Check INFO 'active-lock' 'absent' }

if ($script:Failed) {
    Write-Output 'RESULT NOT_READY'
    if ($script:Actions.Count) {
        Write-Output 'NEXT OWNER ACTIONS:'
        $script:Actions | ForEach-Object { Write-Output "- $_" }
    }
    exit 1
}
Write-Output 'RESULT READY'
if ($script:Actions.Count) {
    Write-Output 'NEXT OWNER ACTIONS:'
    $script:Actions | ForEach-Object { Write-Output "- $_" }
}
exit 0