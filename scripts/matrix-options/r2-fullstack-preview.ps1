<#
Matrix R2 DISPOSABLE local full-stack preview (executor subcommands). LOCAL ONLY; never touches the
provider, never reads .env.local or any real or test-account credential.

  up        Prove and bind the local Docker Desktop engine, require Docker to publish on 127.0.0.1,
            create a NEW run (unique run id, its own Supabase project id, port block, run directory),
            bind every input to the candidate (path, bytes, SHA-256), prove that nothing of the run
            pre-exists, start that run's local stack from the hash-pinned manifest, verify loopback
            bindings and fingerprint parity with the pinned production baseline. Prints
            R2_PREVIEW_RUN_ID=<id>. If anything of the run's project or ports pre-exists, the run is
            persisted as refused (never started), only its reservation is released, and nothing
            pre-existing is stopped, reset or removed.
  seed      Seed the run's three fresh disposable accounts (reviewer A, reviewer B, administrator),
            legacy 2/12 history, the five hash-verified R2 objects; enable the run's LOCAL activation row.
  build     Monitored clean build of the candidate in the run's own preview worktree (no .env.local).
  start     Serve the run's build on its loopback port, record the app process, prove the listener,
            then print the run's disposable local sign-ins.
  status    Read-only state of the run (also of a closed or refused run, with its evidence).
  reconcile Record what is known about a run that needs reconciliation; changes nothing else.
  down      Stop exactly what this run proved it created, and release its port block only after
            verified teardown. A run that never started only gives back its reservation; anything
            whose ownership is not proven is never stopped.
  accept    Run the local reviewer -> administrator journey and write the tree-bound receipt.

Run token: every command except `up` requires -RunId <the id this session's up printed>. Authority
is that explicit id + this worktree + this candidate (custody.mjs proveRun); no file is read to
obtain it.

Lock: one live wrapper acts on a run at a time. The wrapper holds an OS lock (an exclusive handle on
the run's wrapper.lock that the OS releases if this process dies) and custody records it as the run's
active holder (pid and creation time). The handle is closed only after the run state no longer names
this wrapper. A run whose earlier wrapper died mid-command enters needs-reconcile: then only status,
reconcile and down are accepted, and up refuses to create another run in this worktree.

Isolation (custody.mjs): every resource is derived from the run id: project id (so containers and
volumes are new and named after the run), port block, run directory (config, logs, process
records, build stamp, sign-ins), preview worktree. The only machine-wide state is the port-block
slot file, claimed exclusively and released only by the run's terminal release transition.

Process safety: every long child command runs bounded (launch intent recorded before the launch,
then pid, creation time and command-line digest, heartbeats, a hard timeout). A timeout kills that
child's tree and KEEPS the run for reconciliation (`down -RunId`); nothing is released on an unknown
outcome. Teardown is verified from the run's own records: no container, volume, listener or recorded
process of the run remains, and no recorded launch has an unknown identity. A launched child whose
bookkeeping fails moves the run to needs-reconcile with its launch identity and is never torn down
automatically. Destructive CLI calls (db reset, stop) are re-verified immediately before use (custody
cli-guarded). Listener inventory covers IPv4 and IPv6 strictly; an unknown inventory fails closed.

Owner launcher contract (the launcher lives OUTSIDE this repository; after a reviewed commit it must
be regenerated from this contract, independently reviewed and hash-pinned; until then the owner
preview is NOT ready):
  * never call `down` (or any stop) automatically, at start or otherwise;
  * call `up` once, capture the R2_PREVIEW_RUN_ID=<id> line, and pass that exact id as -RunId to every
    later seed, build, start, accept, status and down call of the same session;
  * never read run ids from files and never reuse another session's id;
  * show the owner only the disposable local sign-ins that `start` prints.
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet('up', 'seed', 'build', 'start', 'status', 'reconcile', 'down', 'accept')][string]$Command,
  [string]$CandidateSha = '',
  [string]$RunId = '',
  [string]$SourceRoot = '',
  # Inner loop only (pre-commit executor testing): an executor-prepared preview worktree; accept refuses.
  [switch]$InnerLoop,
  [string]$PreviewWorktree = '',
  [ValidateRange(120, 3600)][int]$TimeoutSeconds = 900
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$bootstrap = Join-Path $PSScriptRoot 'r2-fullstack-bootstrap\bootstrap.mjs'
$custody = Join-Path $PSScriptRoot 'r2-fullstack-bootstrap\custody.mjs'
$cli = 'supabase@2.122.1'
$owner = if ($InnerLoop -or $CandidateSha -notmatch '^[0-9a-f]{40}$') { 'inner-loop' } else { $CandidateSha }
$script:run = $null
$script:locked = $false
$script:lockStream = $null
$script:terminal = $false
$script:lastLaunch = ''
# Set when a launched child could not be recorded and custody could not mark the run either: the
# holder record is then kept (never cleared), so the next command finds this command interrupted.
$script:keepHolder = $false

function Write-Heartbeat([string]$Status, [string]$Step) {
  if ($script:run) {
    [ordered]@{ run_id = $script:run.run_id; status = $Status; step = $Step; last_progress_at = (Get-Date).ToUniversalTime().ToString('o') } |
      ConvertTo-Json | Set-Content -LiteralPath (Join-Path $script:run.run_dir 'status.json') -Encoding ascii
  }
  Write-Host "[r2-preview] $((Get-Date).ToString('HH:mm:ss')) $Status $Step"
}
function Stop-WithError([string]$Message) { Write-Heartbeat 'failed' $Message; throw "[r2-preview] FAIL: $Message" }

# custody.mjs prints one JSON line on success; exit 2 = unknown inventory, 4 = listener not proven,
# 5 = teardown not verified, 6 = refused (terminal), anything else = refused. Raw returns the code.
function Invoke-CustodyRaw([string[]]$CustodyArgs) {
  $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { $lines = @(& node $custody @CustodyArgs 2>&1 | ForEach-Object { "$_" }); $code = $LASTEXITCODE } finally { $ErrorActionPreference = $previous }
  $json = $lines | Where-Object { $_ -match '^[\[\{]' } | Select-Object -Last 1
  $why = ($lines | Where-Object { $_ -match '\[r2-custody\]' } | Select-Object -Last 1)
  if (-not $why) { $why = "custody $($CustodyArgs[0]) exited with $code $json" }
  $value = $null
  # Malformed JSON is no result (callers refuse it), never an unhandled parse error.
  if ($json) { try { $value = $json | ConvertFrom-Json } catch { $value = $null } }
  return [pscustomobject]@{ code = $code; value = $value; why = $why }
}
function Invoke-Custody([string[]]$CustodyArgs) {
  $result = Invoke-CustodyRaw $CustodyArgs
  if ($result.code -ne 0) { Stop-WithError $result.why }
  if ($null -eq $result.value) { Stop-WithError "custody $($CustodyArgs[0]) printed no result" }
  return $result.value
}
function Get-OwnerArgs { return @('--worktree', $repoRoot, '--sha', $owner, '--run', $script:run.run_id, '--pid', "$PID") }

<#
Listener inventory across the custody boundary (custody.mjs listenerInventoryResult): exactly one JSON
object {schema, ports, count, listeners}. Zero listeners decodes as count 0 with an empty listener
array, never as null, an absent field, a scalar or an empty pipeline; one listener as count 1 with one
entry. Anything else (a bare array, another schema, missing or extra fields, a count that differs from
the entries, a port that was not asked for, a malformed entry) is refused: the inventory is UNKNOWN.
#>
function Read-ListenerInventory($Value, [int[]]$Ports) {
  if ($Value -isnot [System.Management.Automation.PSCustomObject]) { throw 'the listener inventory is not one object' }
  $fields = @($Value.PSObject.Properties | ForEach-Object { $_.Name } | Sort-Object) -join ','
  if ($fields -cne 'count,listeners,ports,schema') { throw 'the listener inventory has missing or extra fields' }
  if ($Value.schema -cne 'r2-listener-inventory/1') { throw 'the listener inventory schema is not recognized' }
  if (-not (Test-JsonInteger $Value.count 0 65535)) { throw 'the listener count is malformed' }
  if ($Value.ports -isnot [System.Array] -or $Value.listeners -isnot [System.Array]) { throw 'the listener inventory fields are not lists' }
  foreach ($port in $Value.ports) { if (-not (Test-JsonInteger $port 1 65535)) { throw 'the listener inventory answers a malformed port' } }
  $asked = @($Ports | Sort-Object -Unique)
  if ($asked.Count -eq 0 -or $Value.ports.Count -ne $asked.Count -or ((@($Value.ports | ForEach-Object { [long]$_ } | Sort-Object -Unique) -join ',') -cne ($asked -join ','))) { throw 'the listener inventory answers other ports' }
  if ($Value.listeners.Count -ne [long]$Value.count) { throw 'the listener count does not match its entries' }
  $entries = New-Object System.Collections.Generic.List[object]
  foreach ($entry in $Value.listeners) {
    if ($entry -isnot [System.Management.Automation.PSCustomObject]) { throw 'a listener entry is not an object' }
    if ((@($entry.PSObject.Properties | ForEach-Object { $_.Name } | Sort-Object) -join ',') -cne 'address,family,pid,port') { throw 'a listener entry has missing or extra fields' }
    if ($entry.address -isnot [string] -or $entry.address -cnotmatch '^[0-9A-Fa-f:.%]{2,64}$') { throw 'a listener address is malformed' }
    if ($entry.family -isnot [string] -or @('ipv4', 'ipv6') -cnotcontains $entry.family) { throw 'a listener family is malformed' }
    if (-not (Test-JsonInteger $entry.port 1 65535) -or $asked -notcontains [int]$entry.port) { throw 'a listener port was not asked for' }
    if (-not (Test-JsonInteger $entry.pid 0 4294967295)) { throw 'a listener pid is malformed' }
    $entries.Add([pscustomobject]@{ address = $entry.address; port = [int]$entry.port; pid = [long]$entry.pid; family = $entry.family })
  }
  return [pscustomobject]@{ count = [int]$Value.count; listeners = $entries.ToArray() }
}
<#
A JSON integer as ConvertFrom-Json decodes it: Int32 or Int64 (Windows PowerShell 5.1 decodes small
integers as Int32, PowerShell 7 as Int64), within [Min, Max]. Everything else is refused: a fraction or
exponent form (Double or Decimal, also 1.0), a non-finite or overflowing number (Double, Decimal or
BigInteger), a string, a boolean, null, an array or an object.
#>
function Test-JsonInteger($Number, [long]$Min, [long]$Max) {
  if ($null -eq $Number) { return $false }
  if ($Number -isnot [int] -and $Number -isnot [long]) { return $false }
  $integral = [long]$Number
  return ($integral -ge $Min -and $integral -le $Max)
}
function Get-ListenerInventory([int[]]$Ports) {
  $result = Invoke-CustodyRaw @('listeners', '--ports', ($Ports -join ','))
  if ($result.code -ne 0) { Stop-WithError "the listener inventory is unknown ($($result.why)); nothing was started" }
  try { $inventory = Read-ListenerInventory $result.value $Ports } catch { Stop-WithError "the listener inventory is malformed ($($_.Exception.Message)); nothing was started" }
  return $inventory
}

# The full identity of a just-launched child, read from the source custody's process table uses
# (Win32_Process: UTC round-trip creation time, SHA-256 of the command line). Never throws; what
# cannot be read stays empty and custody completes it if it can.
function Get-ChildIdentity([int]$ChildPid) {
  $identity = [pscustomobject]@{ pid = $ChildPid; created = ''; command_sha256 = '' }
  try {
    $row = Get-CimInstance Win32_Process -Filter "ProcessId = $ChildPid" -ErrorAction Stop
    if ($row -and $row.CreationDate) { $identity.created = $row.CreationDate.ToUniversalTime().ToString('o') }
    if ($row -and $row.CommandLine) {
      $hash = [System.Security.Cryptography.SHA256]::Create()
      try { $identity.command_sha256 = ([System.BitConverter]::ToString($hash.ComputeHash([System.Text.Encoding]::UTF8.GetBytes([string]$row.CommandLine))) -replace '-', '').ToLowerInvariant() } finally { $hash.Dispose() }
    }
  } catch { }
  return $identity
}

<#
A child exists but its bookkeeping failed (pid/identity record, heartbeat, outcome record): the run is
moved to needs-reconcile BEFORE the wrapper returns, with the child's identity (custody
run-unaccounted). If custody cannot record even that, the holder record is kept (never cleared), so
the next command finds this one interrupted and the run enters needs-reconcile. The child is never
stopped and never declared absent here. Returns whether custody recorded the mark.
#>
function Set-RunUnaccounted([string]$Launch, [string]$Role, $Identity, [string]$Reason) {
  $markArgs = @('run-unaccounted') + (Get-OwnerArgs) + @('--launch', $Launch, '--role', $Role, '--reason', $Reason, '--child', "$($Identity.pid)")
  if ($Identity.created) { $markArgs += @('--created', $Identity.created) }
  if ($Identity.command_sha256) { $markArgs += @('--command-sha256', $Identity.command_sha256) }
  $marked = $false
  try { $marked = ((Invoke-CustodyRaw $markArgs).code -eq 0) } catch { $marked = $false }
  if (-not $marked) { $script:keepHolder = $true }
  return $marked
}
function Get-UnaccountedMessage([string]$Role, [int]$ChildPid, [string]$Stage, [string]$Why, [bool]$Marked) {
  $where = if ($Marked) { 'the run is marked needs-reconcile' } else { 'custody could not mark it, so the run keeps this wrapper as its holder and the next command finds it interrupted (needs-reconcile)' }
  return "UNACCOUNTED: $Role (pid $ChildPid) was launched but its $Stage bookkeeping failed ($Why); $where; the child was not stopped; only status, reconcile and down -RunId $($script:run.run_id) are accepted"
}

# Prove the local Docker Desktop engine and bind it for this process and every child before any
# docker or Supabase CLI operation.
function Use-DockerBinding {
  $binding = Invoke-Custody @('docker-bind')
  foreach ($name in 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'DOCKER_TLS') {
    if (Test-Path -LiteralPath "Env:$name") { Remove-Item -LiteralPath "Env:$name" }
  }
  $env:DOCKER_HOST = $binding.host
}

# The OS lock: an exclusive (no sharing) handle on the run's wrapper.lock, held for this process's
# lifetime. The OS releases it if this process dies, so a stale lock never needs to be broken.
function Lock-RunHandle {
  $path = Join-Path $script:run.run_dir 'wrapper.lock'
  try { $script:lockStream = [System.IO.File]::Open($path, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None) }
  catch { $script:lockStream = $null; Stop-WithError "run $($script:run.run_id) is held by another live wrapper (OS lock); nothing was done" }
}
function Unlock-RunHandle { if ($script:lockStream) { $script:lockStream.Dispose(); $script:lockStream = $null } }

# Every command after up: the explicit run token, proven, OS-locked and recorded as this wrapper.
function Enter-Run([string]$Name) {
  if ($RunId -notmatch '^r2pv-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$') { Stop-WithError "-RunId (the exact id printed by this session's up) is required for $Name; nothing was touched" }
  $script:run = Invoke-Custody @('run-verify', '--worktree', $repoRoot, '--sha', $owner, '--run', $RunId)
  Lock-RunHandle
  try { $script:run = Invoke-Custody (@('run-lock') + (Get-OwnerArgs) + @('--command', $Name)) } catch { Unlock-RunHandle; throw }
  $script:locked = $true
  $env:R2_PREVIEW_RUN_ID = $script:run.run_id; $env:R2_PREVIEW_CANDIDATE = $owner
}
# The state stops naming this wrapper FIRST; only then is the OS handle closed. If clearing fails the
# handle stays open (this process then exits with it), so the run is never unlocked while its state
# claims this wrapper. A terminal transition already cleared the holder in its own final write.
function Exit-Run {
  if (-not $script:locked) { Unlock-RunHandle; return }
  $script:locked = $false
  if (-not $script:terminal -and -not $script:keepHolder) { $null = Invoke-Custody (@('run-unlock') + (Get-OwnerArgs)) }
  Unlock-RunHandle
}
function Set-RunTerminal { $script:terminal = $true }

function ConvertTo-ArgString([string[]]$List) {
  return ($List | ForEach-Object { if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ } }) -join ' '
}
function Protect-Log([string]$Path) {
  # Local stack keys printed by the CLI never stay in a log.
  if (Test-Path -LiteralPath $Path) {
    $kept = @(Get-Content -LiteralPath $Path | Where-Object { $_ -notmatch '(?i)key|secret|jwt|token|password|eyJ|sb_secret|sb_publishable' })
    Set-Content -LiteralPath $Path -Value $kept -Encoding ascii
  }
}

<#
Reads the bootstrap's dedicated env result (bootstrap.mjs writeEnvResult): exactly three LF-terminated
ASCII lines, the schema line naming this run, then API_URL and ANON_KEY once each. Missing, duplicate,
malformed, unexpected or extra fields, another run, a redirected API URL (not this run's loopback API
port) and a redirected file (a reparse point) are all refused. Messages never carry a value.
#>
function Read-BootstrapResult([string]$Path, [string]$ExpectedRunId, [int]$ExpectedApiPort) {
  $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
  if (-not $item -or $item.PSIsContainer) { throw 'the bootstrap result is missing' }
  if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'the bootstrap result is redirected (a link)' }
  if ($item.Length -gt 8192) { throw 'the bootstrap result is too large' }
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  foreach ($byte in $bytes) { if ($byte -gt 126 -or ($byte -lt 32 -and $byte -ne 10)) { throw 'the bootstrap result is malformed' } }
  $text = [System.Text.Encoding]::ASCII.GetString($bytes)
  if (-not $text.EndsWith("`n")) { throw 'the bootstrap result is malformed' }
  $lines = $text.Substring(0, $text.Length - 1).Split("`n")
  if ($lines.Count -ne 3) { throw 'the bootstrap result has missing or extra fields' }
  if ($lines[0] -cne "R2_PREVIEW_RESULT=r2-preview-env-result/1 $ExpectedRunId") { throw 'the bootstrap result is not this run''s result' }
  $values = @{}
  foreach ($line in $lines[1..2]) {
    if ($line -cnotmatch '^(API_URL|ANON_KEY)=(.+)$') { throw 'the bootstrap result has an unexpected field' }
    $name = $Matches[1]
    if ($values.ContainsKey($name)) { throw 'the bootstrap result has a duplicate field' }
    $values[$name] = $Matches[2]
  }
  if ($values.Count -ne 2) { throw 'the bootstrap result has missing fields' }
  if ($values['API_URL'] -cne "http://127.0.0.1:$ExpectedApiPort") { throw 'the bootstrap result API URL is redirected away from this run''s loopback API' }
  if ($values['ANON_KEY'] -cnotmatch '^[A-Za-z0-9_.-]{20,4096}$') { throw 'the bootstrap result anon key is malformed' }
  return [pscustomobject]@{ API_URL = $values['API_URL']; ANON_KEY = $values['ANON_KEY'] }
}

<#
Runs one child command bounded: the launch intent is recorded BEFORE the child exists, then its pid,
creation time and command-line digest, a heartbeat every 5 seconds, and a hard timeout. On timeout
the child's process tree is killed, the outcome is recorded as `timeout` and the run is KEPT (never
released) for reconciliation. Once the child exists, any failure of its bookkeeping (the pid/identity
record, a heartbeat, the timeout or exit record) moves the run to needs-reconcile with the identity
captured at launch (Set-RunUnaccounted) and throws UNACCOUNTED; the child is left alone. Returns the
exit code.
#>
function Invoke-Bounded([string]$Role, [string]$File, [string[]]$Arguments, [int]$Timeout, [string]$Cwd = $repoRoot) {
  $out = Join-Path $script:run.run_dir "$Role.out.log"
  $err = Join-Path $script:run.run_dir "$Role.err.log"
  $launch = [guid]::NewGuid().ToString('N')
  $script:lastLaunch = $launch
  $null = Invoke-Custody (@('run-record') + (Get-OwnerArgs) + @('--launch', $launch, '--role', $Role, '--outcome', 'intent', '--timeout', "$Timeout"))
  $env:R2_PREVIEW_LAUNCH_ID = $launch
  try { $process = Start-Process -FilePath $File -ArgumentList (ConvertTo-ArgString $Arguments) -WorkingDirectory $Cwd -RedirectStandardOutput $out -RedirectStandardError $err -NoNewWindow -PassThru }
  catch {
    $null = Invoke-Custody (@('run-record') + (Get-OwnerArgs) + @('--launch', $launch, '--role', $Role, '--outcome', 'launch-failed'))
    throw "$Role could not be launched"
  }
  # The child exists from here on. Its handle is taken FIRST (Start-Process -PassThru reports no exit
  # code for a child that exits before its handle was taken), then its identity is captured, before
  # any bookkeeping can fail.
  $identity = [pscustomobject]@{ pid = $process.Id; created = ''; command_sha256 = '' }
  $stage = 'handle'
  $timedOut = $false
  try {
    $null = $process.Handle
    $identity = Get-ChildIdentity $process.Id
    $stage = 'pid-record'
    $null = Invoke-Custody (@('run-record') + (Get-OwnerArgs) + @('--launch', $launch, '--role', $Role, '--child', "$($process.Id)", '--outcome', 'running', '--timeout', "$Timeout"))
    $stage = 'heartbeat'
    $deadline = (Get-Date).AddSeconds($Timeout)
    while (-not $process.WaitForExit(5000)) {
      Write-Heartbeat 'running' "$Role (pid $($process.Id))"
      if ((Get-Date) -gt $deadline) {
        & taskkill /PID $process.Id /T /F | Out-Null
        $stage = 'timeout-record'
        $null = Invoke-Custody (@('run-record') + (Get-OwnerArgs) + @('--launch', $launch, '--role', $Role, '--child', "$($process.Id)", '--outcome', 'timeout', '--timeout', "$Timeout"))
        $timedOut = $true
        break
      }
    }
    if (-not $timedOut) {
      $process.WaitForExit()
      $code = $process.ExitCode
      $stage = 'exit-record'
      Protect-Log $out; Protect-Log $err
      $null = Invoke-Custody (@('run-record') + (Get-OwnerArgs) + @('--launch', $launch, '--role', $Role, '--child', "$($process.Id)", '--outcome', 'exited', '--exit-code', "$code"))
    }
  } catch {
    $why = $_.Exception.Message -replace '^\[r2-preview\] FAIL: ', ''
    $marked = Set-RunUnaccounted $launch $Role $identity $stage
    throw (Get-UnaccountedMessage $Role $process.Id $stage $why $marked)
  }
  if ($timedOut) { throw "TIMEOUT: $Role exceeded $Timeout s; its outcome is unknown, so the run is kept for reconciliation (down -RunId $($script:run.run_id))" }
  return $code
}
function Invoke-Node([string]$Role, [string[]]$Arguments, [int]$Timeout = 600) {
  $code = Invoke-Bounded $Role 'node' (@($bootstrap) + $Arguments) $Timeout
  if ($code -ne 0) { Stop-WithError "$Role exited with $code (see $Role.err.log in the run directory)" }
}
# Non-destructive CLI calls only (start); the destructive ones go through Invoke-DestructiveCli.
function Invoke-SupabaseCli([string]$Role, [string[]]$Arguments, [int]$Timeout) {
  if ($Role -ne 'supabase-start') { Stop-WithError "$Role is not a non-destructive Supabase CLI call; nothing was invoked" }
  return Invoke-Bounded $Role 'cmd.exe' (@('/d', '/c', 'npx', '--yes', $cli) + $Arguments + @('--workdir', $script:run.run_dir)) $Timeout $script:run.run_dir
}
<#
Every destructive local Supabase CLI call (db reset, stop) runs through custody cli-guarded, which, in
the bounded child itself and immediately before invoking the CLI, re-proves the run, re-reads the
run's config bytes and digest against the bound template, re-checks the project id, re-verifies the
migrations a reset consumes, confirms the workdir is the run's own directory, and refuses (never
invoking the CLI) on any change. The CLI arguments are fixed by custody per role.
#>
function Invoke-DestructiveCli([string]$Role, [int]$Timeout) {
  return Invoke-Bounded $Role 'node' (@($custody, 'cli-guarded') + (Get-OwnerArgs) + @('--role', $Role)) $Timeout $script:run.run_dir
}
function Get-RunPreviewWorktree {
  if ($InnerLoop) {
    if (-not $PreviewWorktree) { Stop-WithError '-InnerLoop needs -PreviewWorktree (an executor-prepared worktree)' }
    return $PreviewWorktree
  }
  return "C:\Projects\SSTAC-Dashboard-worktrees\matrix-r2-preview-$($script:run.run_id.Substring($script:run.run_id.Length - 8))"
}

function Assert-PreviewWorktree([string]$Worktree) {
  if (-not (Test-Path -LiteralPath (Join-Path $Worktree '.git'))) { Stop-WithError "preview worktree $Worktree does not exist" }
  # Next.js also loads .env, .env.production and .env.production.local; refuse every env file.
  $envFiles = @(Get-ChildItem -LiteralPath $Worktree -Force -File -Filter '.env*' | Where-Object { $_.Name -ne '.env.example' })
  if ($envFiles.Count -gt 0) { Stop-WithError "preview worktree contains $($envFiles[0].Name); refusing to build or serve" }
  if (-not $InnerLoop) {
    $head = (& git -C $Worktree rev-parse HEAD).Trim()
    if ($head -ne $CandidateSha) { Stop-WithError "preview worktree HEAD $head is not the candidate $CandidateSha" }
    if (& git -C $Worktree status --porcelain --untracked-files=all) { Stop-WithError 'preview worktree has changes or untracked files' }
  }
}
function Ensure-PreviewWorktree([string]$Worktree) {
  if (-not (Test-Path -LiteralPath $Worktree)) {
    if ($InnerLoop) { Stop-WithError 'inner-loop preview worktree must be prepared by the executor' }
    & git -C $repoRoot worktree add --detach $Worktree $CandidateSha | Out-Null
    if ($LASTEXITCODE -ne 0) { Stop-WithError 'git worktree add failed' }
  }
  $modules = Join-Path $Worktree 'node_modules'
  if (-not (Test-Path -LiteralPath $modules)) {
    # Resolve junction chains to the real shared store, so removing another worktree cannot break this one.
    $store = Join-Path $repoRoot 'node_modules'
    for ($hop = 0; $hop -lt 8; $hop++) { $item = Get-Item -LiteralPath $store; if ($item.LinkType -ne 'Junction') { break }; $store = $item.Target | Select-Object -First 1 }
    if ((Get-Item -LiteralPath $store).LinkType) { Stop-WithError 'could not resolve the shared node_modules store' }
    & cmd /c mklink /J "$modules" "$store" | Out-Null
    if ((Get-Item -LiteralPath $modules).LinkType -ne 'Junction') { Stop-WithError 'node_modules junction was not created' }
  }
  Assert-PreviewWorktree $Worktree
}
function Assert-BuildStamp([string]$Worktree) {
  $stampFile = Join-Path $script:run.run_dir 'build-stamp.json'
  if (-not (Test-Path -LiteralPath $stampFile)) { Stop-WithError 'no build stamp for this run; run build first' }
  $stamp = Get-Content -LiteralPath $stampFile -Raw | ConvertFrom-Json
  $buildId = (Get-Content -LiteralPath (Join-Path $Worktree '.next\BUILD_ID') -Raw).Trim()
  if ($stamp.run_id -ne $script:run.run_id -or $stamp.build_id -ne $buildId -or $stamp.preview_worktree -ne $Worktree) { Stop-WithError 'the built app does not match this run''s build stamp' }
  if (-not $InnerLoop -and ($stamp.inner_loop -or $stamp.candidate_sha -ne $CandidateSha)) { Stop-WithError 'the built app is not the candidate build' }
  return $stamp
}
function Stop-App {
  # Only this run's recorded app process tree, matched by pid AND its own launch script.
  if (-not $script:run.app) { return }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($script:run.app.pid)" -ErrorAction SilentlyContinue
  if ($proc -and $proc.CommandLine -match [regex]::Escape("start-app-$($script:run.run_id).cmd") -and
      $proc.CreationDate.ToUniversalTime().ToString('o') -eq $script:run.app.created) {
    & taskkill /PID $script:run.app.pid /T /F | Out-Null
  }
}
function Close-RunVerified([string]$Reason) {
  # Only a stack this run owns is stopped (custody refuses the stop intent otherwise). Teardown is
  # verified from the run's own records; terminal state, slot release and unlock are one transition.
  $code = Invoke-DestructiveCli 'supabase-stop' 300
  $script:run = Invoke-Custody @('run-verify', '--worktree', $repoRoot, '--sha', $owner, '--run', $script:run.run_id)
  $check = Invoke-CustodyRaw @('teardown-check', '--worktree', $repoRoot, '--sha', $owner, '--run', $script:run.run_id)
  if ($code -ne 0 -or $check.code -ne 0) { Stop-WithError "$Reason; TEARDOWN NOT VERIFIED (supabase stop exit $code; evidence $($check.value | ConvertTo-Json -Compress)); the run and its port block are kept" }
  $final = Invoke-CustodyRaw (@('run-finalize') + (Get-OwnerArgs) + @('--kind', 'released'))
  if ($final.code -ne 0) { Stop-WithError "$Reason; TEARDOWN NOT VERIFIED at release ($($final.why)); the run and its port block are kept" }
  Set-RunTerminal
}
function Close-RunNeverStarted([string]$Reason) {
  # Nothing of this run's stack, data or app was launched: give back only this run's reservation.
  $final = Invoke-CustodyRaw (@('run-finalize') + (Get-OwnerArgs) + @('--kind', 'never-started'))
  if ($final.code -ne 0) { Stop-WithError "$Reason; the reservation is kept ($($final.why))" }
  Set-RunTerminal
}

switch ($Command) {
  'up' {
    # The first docker operation is the engine proof; then Docker must publish on 127.0.0.1 before
    # anything exists. Only then is a run (and its port block) created.
    Use-DockerBinding
    $null = Invoke-Custody @('daemon-loopback')
    $tree = '-'
    if ($owner -ne 'inner-loop') { $tree = (& git -C $repoRoot rev-parse "$CandidateSha^{tree}").Trim(); if ($tree -notmatch '^[0-9a-f]{40}$') { Stop-WithError 'the candidate commit is not present in this repository' } }
    $script:run = Invoke-Custody @('run-new', '--worktree', $repoRoot, '--sha', $owner, '--tree', $tree, '--pid', "$PID")
    Lock-RunHandle
    try { $script:run = Invoke-Custody (@('run-lock') + (Get-OwnerArgs) + @('--command', 'up')) } catch { Unlock-RunHandle; throw }
    $script:locked = $true
    # The protected failure boundary starts immediately after the run exists.
    try {
      $env:R2_PREVIEW_RUN_ID = $script:run.run_id; $env:R2_PREVIEW_CANDIDATE = $owner
      Write-Host "R2_PREVIEW_RUN_ID=$($script:run.run_id)"
      Write-Heartbeat 'running' "run created (project $($script:run.project_id), ports $($script:run.ports.shadow)-$($script:run.ports.appInner))"
      # Every consumed input is bound to the candidate before anything starts.
      $null = Invoke-Custody (@('run-bind') + (Get-OwnerArgs))
      Invoke-Node 'bootstrap-prepare' @('prepare') 120
      # Nothing of this run may pre-exist: no container, volume or listener. If anything does, custody
      # persists the terminal refusal and releases only this run's reservation (exit 6).
      $pre = Invoke-CustodyRaw (@('preflight') + (Get-OwnerArgs))
      if ($pre.code -eq 6) { Set-RunTerminal; throw "REFUSED: something of run $($script:run.run_id) pre-exists ($($pre.value.evidence | ConvertTo-Json -Compress -Depth 4)); nothing pre-existing was touched, the run is recorded as refused (never started) and only its reservation was released" }
      if ($pre.code -ne 0) { throw "preflight failed: $($pre.why)" }
      $null = Invoke-Custody (@('generated-check') + (Get-OwnerArgs))
      if ((Invoke-SupabaseCli 'supabase-start' @('start') $TimeoutSeconds) -ne 0) { throw 'supabase start failed' }
      # Fail closed on network exposure before any account or private paper object is loaded.
      if ((Invoke-Bounded 'bootstrap-ports' 'node' @($bootstrap, 'ports') 120) -ne 0) { throw 'the run''s stack is published beyond 127.0.0.1; nothing was loaded' }
      if ((Invoke-DestructiveCli 'supabase-db-reset' $TimeoutSeconds) -ne 0) { throw 'supabase db reset failed or was refused (see supabase-db-reset.err.log in the run directory)' }
      Invoke-Node 'bootstrap-post-start' @('post-start')
      Invoke-Node 'bootstrap-verify' @('verify')
      Write-Heartbeat 'ok' "local stack up with production parity (run $($script:run.run_id))"
      Exit-Run
    } catch {
      $original = $_.Exception.Message -replace '^\[r2-preview\] FAIL: ', ''
      # A timeout, a refusal or an unaccounted child is never torn down automatically.
      if ($original -match '^(TIMEOUT|REFUSED|UNACCOUNTED):') { Exit-Run; Stop-WithError $original }
      try {
        $state = Invoke-Custody @('run-verify', '--worktree', $repoRoot, '--sha', $owner, '--run', $script:run.run_id)
        $script:run = $state
        if ($state.ownership.stack -eq 'owned') { Close-RunVerified $original }
        else { Close-RunNeverStarted $original }
      } finally { Exit-Run }
      Stop-WithError "$original (run $($script:run.run_id) closed)"
    }
  }
  'seed' {
    Use-DockerBinding
    Enter-Run 'seed'
    try {
      if (-not $SourceRoot -or -not [System.IO.Path]::IsPathRooted($SourceRoot)) { Stop-WithError '-SourceRoot (absolute) is required' }
      Invoke-Node 'bootstrap-seed' @('seed', $SourceRoot)
      Write-Heartbeat 'ok' 'seeded disposable local accounts and the R2 paper'
    } finally { Exit-Run }
  }
  'build' {
    Use-DockerBinding
    Enter-Run 'build'
    try {
      $worktree = Get-RunPreviewWorktree
      Ensure-PreviewWorktree $worktree
      Invoke-Node 'bootstrap-env' @('env') 120
      # The dedicated result channel (never the scrubbed log): exactly API_URL and ANON_KEY.
      try { $stack = Read-BootstrapResult (Join-Path $script:run.run_dir "results\bootstrap-env-$($script:lastLaunch).result") $script:run.run_id ([int]$script:run.ports.api) }
      catch { Stop-WithError "the bootstrap env result was refused: $($_.Exception.Message)" }
      [ordered]@{ API_URL = $stack.API_URL; ANON_KEY = $stack.ANON_KEY } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $script:run.run_dir 'preview-env.json') -Encoding ascii
      # Build-time values are loopback only; every inherited provider or credential value is cleared.
      Get-ChildItem Env: | Where-Object { $_.Name -match 'SUPABASE|DATABASE_URL|^PG|^E2E_|^CANARY_|ECOTOX|SENTRY|VERCEL|^MATRIX_|REDIS|UPSTASH|OPENAI|ANTHROPIC|SECRET|TOKEN|PASSWORD|_KEY$' } |
        ForEach-Object { Remove-Item -LiteralPath ('Env:' + $_.Name) }
      $env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:$($script:run.ports.app)"
      $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $stack.ANON_KEY
      $env:MATRIX_R2_GUIDED_REVIEW_UI = 'true'
      $env:NEXT_TELEMETRY_DISABLED = '1'
      $env:NODE_ENV = 'production'
      $code = Invoke-Bounded 'monitored-build' 'cmd.exe' @('/d', '/c', 'npm', 'run', 'build:monitored:clean', '--', '-TimeoutSeconds', '360', '-PollSeconds', '10') $TimeoutSeconds $worktree
      if ($code -ne 0) { Stop-WithError "monitored build exited with $code" }
      [ordered]@{
        run_id = $script:run.run_id
        candidate_sha = (& git -C $worktree rev-parse HEAD).Trim(); candidate_tree = (& git -C $worktree rev-parse 'HEAD^{tree}').Trim()
        build_id = (Get-Content -LiteralPath (Join-Path $worktree '.next\BUILD_ID') -Raw).Trim(); preview_worktree = $worktree
        inner_loop = [bool]$InnerLoop; built_at = (Get-Date).ToUniversalTime().ToString('o')
      } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $script:run.run_dir 'build-stamp.json') -Encoding ascii
      Write-Heartbeat 'ok' 'build complete'
    } finally { Exit-Run }
  }
  'start' {
    Use-DockerBinding
    Enter-Run 'start'
    try {
      $worktree = Get-RunPreviewWorktree
      Assert-PreviewWorktree $worktree
      $null = Assert-BuildStamp $worktree
      $ports = $script:run.ports
      if ((Get-ListenerInventory @([int]$ports.app, [int]$ports.appInner)).count -ne 0) { Stop-WithError "port $($ports.app) or $($ports.appInner) is in use; nothing was started" }
      $stack = Get-Content -LiteralPath (Join-Path $script:run.run_dir 'preview-env.json') -Raw | ConvertFrom-Json
      $proxy = Join-Path $PSScriptRoot 'r2-fullstack-bootstrap\same-origin-proxy.mjs'
      # Detached through WMI so the server outlives this shell (L0 1.8); the WMI child does not inherit
      # this environment, so the loopback-only values go into this run's own launch script.
      $launch = Join-Path $script:run.run_dir "start-app-$($script:run.run_id).cmd"
      $lines = @('@echo off', "cd /d `"$worktree`"",
        "set `"NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:$($ports.app)`"", "set `"NEXT_PUBLIC_SUPABASE_ANON_KEY=$($stack.ANON_KEY)`"",
        'set "MATRIX_R2_GUIDED_REVIEW_UI=true"', 'set "NEXT_TELEMETRY_DISABLED=1"', 'set "NODE_ENV=production"',
        "node `"$proxy`" --outer $($ports.app) --inner $($ports.appInner) --supabase $($stack.API_URL) --app `"$worktree`" > `"$(Join-Path $script:run.run_dir 'app.log')`" 2> `"$(Join-Path $script:run.run_dir 'app.err.log')`"")
      Set-Content -LiteralPath $launch -Value $lines -Encoding ascii
      # The app launch intent is recorded before the app exists.
      $appLaunch = [guid]::NewGuid().ToString('N')
      $null = Invoke-Custody (@('run-record') + (Get-OwnerArgs) + @('--launch', $appLaunch, '--role', 'app', '--outcome', 'intent'))
      $created = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = "cmd.exe /d /c `"$launch`""; CurrentDirectory = $worktree }
      if ($created.ReturnValue -ne 0) {
        $null = Invoke-Custody (@('run-record') + (Get-OwnerArgs) + @('--launch', $appLaunch, '--role', 'app', '--outcome', 'launch-failed'))
        Stop-WithError "could not launch the app (WMI $($created.ReturnValue))"
      }
      # The app exists from here on: a failure to record it or to keep its heartbeat moves the run to
      # needs-reconcile with the identity captured now; the app is left alone.
      $appIdentity = Get-ChildIdentity ([int]$created.ProcessId)
      $stage = 'app-record'
      $ready = $false
      $appExited = $false
      try {
        $null = Invoke-Custody (@('run-set-app') + (Get-OwnerArgs) + @('--launch', $appLaunch, '--app-pid', "$($created.ProcessId)"))
        $script:run = Invoke-Custody @('run-verify', '--worktree', $repoRoot, '--sha', $owner, '--run', $script:run.run_id)
        $stage = 'heartbeat'
        $deadline = (Get-Date).AddSeconds(120)
        do {
          Start-Sleep -Seconds 2
          Write-Heartbeat 'running' "waiting for http://127.0.0.1:$($ports.app)"
          try { $ready = (Invoke-WebRequest -Uri "http://127.0.0.1:$($ports.app)/login" -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200 } catch { $ready = $false }
          if (-not (Get-Process -Id $created.ProcessId -ErrorAction SilentlyContinue)) { $appExited = $true; break }
        } until ($ready -or (Get-Date) -gt $deadline)
      } catch {
        $why = $_.Exception.Message -replace '^\[r2-preview\] FAIL: ', ''
        $marked = Set-RunUnaccounted $appLaunch 'app' $appIdentity $stage
        throw "[r2-preview] FAIL: $(Get-UnaccountedMessage 'app' ([int]$created.ProcessId) $stage $why $marked)"
      }
      if ($appExited) { Stop-WithError 'the app exited; see app.err.log in the run directory' }
      if (-not $ready) { Stop-App; Stop-WithError 'the app did not become ready within 120 seconds' }
      # A process answering on the port is not trusted: prove it is this run's app serving this build.
      try { $null = Invoke-Custody @('listener-proof', '--worktree', $repoRoot, '--sha', $owner, '--run', $script:run.run_id) } catch { Stop-App; throw }
      Write-Heartbeat 'ok' "serving http://127.0.0.1:$($ports.app) (listener proven)"
      # Only the disposable local sign-ins of this run are shown.
      $signIns = Get-Content -LiteralPath (Join-Path $script:run.run_dir 'sign-ins.json') -Raw | ConvertFrom-Json
      Write-Host "Local preview: http://127.0.0.1:$($ports.app)/matrix-options/paper/publication/v/phase2-review-2026-11-fa356b89"
      foreach ($user in $signIns.users) { Write-Host ("  {0,-10} {1}  password {2}" -f $user.key, $user.email, $user.password) }
    } finally { Exit-Run }
  }
  'status' {
    # Read-only: shows the run's state (also a closed or refused run, with its evidence); takes no
    # lock and changes nothing.
    if ($RunId -notmatch '^r2pv-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$') { Stop-WithError '-RunId (the exact id printed by this session''s up) is required for status' }
    $state = Invoke-Custody @('run-status', '--worktree', $repoRoot, '--sha', $owner, '--run', $RunId)
    $state | ConvertTo-Json -Depth 8
    $statusFile = Join-Path $state.run_dir 'status.json'
    if (Test-Path -LiteralPath $statusFile) { Get-Content -LiteralPath $statusFile -Raw }
  }
  'reconcile' {
    Use-DockerBinding
    Enter-Run 'reconcile'
    try { Invoke-Custody (@('reconcile') + (Get-OwnerArgs)) | ConvertTo-Json -Depth 8 } finally { Exit-Run }
  }
  'down' {
    Use-DockerBinding
    Enter-Run 'down'
    try {
      # What down may do comes from the run's own ownership records (custody downPlan): a stack is
      # stopped only when this run owns it; a never-started run only gives back its reservation;
      # anything alive or unknown is refused and nothing is stopped.
      $plan = Invoke-Custody (@('down-plan') + (Get-OwnerArgs))
      switch ($plan.action) {
        'resume-release' {
          $final = Invoke-CustodyRaw (@('run-finalize') + (Get-OwnerArgs) + @('--kind', $plan.kind))
          if ($final.code -ne 0) { Stop-WithError "the interrupted release could not be completed ($($final.why))" }
          Set-RunTerminal
        }
        'teardown' {
          if ($plan.app -eq 'stop') { Stop-App }
          Close-RunVerified 'down'
        }
        'release-never-started' { Close-RunNeverStarted 'down' }
        default { Stop-WithError "down refused: unknown plan $($plan.action); nothing was stopped" }
      }
      Write-Heartbeat 'ok' "run $($script:run.run_id) closed ($($plan.action)); port block released"
    } finally { Exit-Run }
  }
  'accept' {
    Use-DockerBinding
    Enter-Run 'accept'
    try {
      if ($InnerLoop) { Stop-WithError 'accept refuses inner-loop runs; a receipt binds only a committed candidate' }
      $worktree = Get-RunPreviewWorktree
      Assert-PreviewWorktree $worktree
      if ((& git -C $repoRoot rev-parse HEAD).Trim() -ne $CandidateSha) { Stop-WithError 'the executor worktree is not at the candidate' }
      if (& git -C $repoRoot status --porcelain --untracked-files=all -- scripts/matrix-options e2e src/lib/matrix-options/paper playwright.r2-fullstack.config.ts) { Stop-WithError 'the executor worktree has changes in rehearsed paths' }
      $stamp = Assert-BuildStamp $worktree
      # The journey's inputs in both trees are the bound inputs (no substitution after the binding).
      $null = Invoke-Custody @('inputs-check', '--worktree', $repoRoot, '--sha', $owner, '--run', $script:run.run_id, '--root', $repoRoot)
      $null = Invoke-Custody @('inputs-check', '--worktree', $repoRoot, '--sha', $owner, '--run', $script:run.run_id, '--root', $worktree)
      Invoke-Node 'bootstrap-verify' @('verify')
      $proof = Invoke-Custody @('listener-proof', '--worktree', $repoRoot, '--sha', $owner, '--run', $script:run.run_id)
      $report = Join-Path $script:run.run_dir 'playwright-report.json'
      $env:R2_FULLSTACK_BASE_URL = "http://127.0.0.1:$($script:run.ports.app)"
      $env:R2_FULLSTACK_REPORT = $report
      $env:R2_FULLSTACK_RUN_DIR = $script:run.run_dir
      $env:R2_FULLSTACK_IMPL_ROOT = $repoRoot
      # Trusted preview: no Playwright error-context (page snapshot) artifacts, also in the workers.
      $env:PLAYWRIGHT_NO_COPY_PROMPT = '1'
      $journeyExit = Invoke-Bounded 'journey' 'cmd.exe' @('/d', '/c', 'npx', 'playwright', 'test', '--config', 'playwright.r2-fullstack.config.ts') 2400 $worktree
      if (-not (Test-Path -LiteralPath $report)) { Stop-WithError 'the journey produced no report' }
      $results = (Get-Content -LiteralPath $report -Raw | ConvertFrom-Json)
      $steps = foreach ($suite in $results.suites) { foreach ($spec in $suite.specs) { [ordered]@{ title = $spec.title; ok = $spec.ok } } }
      # The receipt records the digests actually consumed by this run (custody consumed-report), not
      # digests computed now.
      $consumed = Invoke-Custody @('consumed-report', '--worktree', $repoRoot, '--sha', $owner, '--run', $script:run.run_id)
      $receipt = [ordered]@{
        kind = 'matrix-r2-disposable-preview-acceptance'; created_at = (Get-Date).ToUniversalTime().ToString('o')
        run_id = $script:run.run_id; candidate_sha = $CandidateSha; candidate_tree = (& git -C $worktree rev-parse 'HEAD^{tree}').Trim()
        inputs = $consumed
        build_stamp = $stamp; listener_proof = $proof.checks; accounts = 'disposable-local'
        journey_exit = $journeyExit; steps = @($steps)
      }
      $gateLogs = Join-Path $repoRoot '.tmp\gate-logs'
      New-Item -ItemType Directory -Force -Path $gateLogs | Out-Null
      $receiptPath = Join-Path $gateLogs ("r2-fullstack-accept-{0}.json" -f (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))
      $receipt | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $receiptPath -Encoding ascii
      Write-Heartbeat ($(if ($journeyExit -eq 0) { 'ok' } else { 'failed' })) "receipt $receiptPath"
    } finally { Exit-Run }
    if ($journeyExit -ne 0) { exit 1 }
  }
}
