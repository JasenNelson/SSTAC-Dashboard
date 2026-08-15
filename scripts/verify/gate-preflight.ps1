# Gate preflight. Run this BEFORE any gate invocation that includes e2e.
#
# WHY THIS EXISTS
# Three times in one session the e2e gate failed because a dev server that same
# session had started was still holding the Playwright port. Each time it was
# diagnosed only AFTER the failure, and each time the correction was described
# rather than implemented. This is the implementation.
#
# playwright.config.ts sets reuseExistingServer:false, so ANY listener on the
# port fails the run before a single test executes. The failure message points
# at the port, not at the cause, so it reads like an environment problem rather
# than leftover state from your own session.
#
# USAGE
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify/gate-preflight.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify/gate-preflight.ps1 -Kill
#
# Without -Kill it reports and exits non-zero, so a gate script can stop early
# rather than burning a full suite run on a port conflict:
#
#   powershell -File scripts/verify/gate-preflight.ps1 -Port 3100 -Kill
#   if ($LASTEXITCODE -ne 0) { "preflight failed"; exit 1 }
#   npx playwright test --project=chromium-auth
#
# SAFETY
# Two conditions must BOTH hold before anything is killed:
#   1. the process is node, and
#   2. its command line references THIS worktree root.
# Condition 2 is the actual ownership proof. An earlier version had only
# condition 1 while its comment claimed parallel sessions were protected -- they
# were not: a sibling worktree's dev server is also "a node process". The owner
# runs parallel sessions, so the guard is scoped to the protected RESOURCE (this
# runtime root) rather than to an image name, per the L0 rule that a process
# census is never a gate and foreign processes are never killed by name.
# Anything indeterminate (WMI failure, empty command line) is reported, never killed.

param(
    [int]$Port = 0,
    [switch]$Kill
)

# Default MUST track playwright.config.ts, which reads
# `process.env.PLAYWRIGHT_TEST_PORT || 3100`. Hardcoding 3100 here meant that
# with the env var set, this script cheerfully reported "port 3100 is free"
# while the port actually under test was held -- a preflight that passes for the
# wrong port is worse than no preflight, because it reads as evidence.
if ($Port -eq 0) {
    $Port = if ($env:PLAYWRIGHT_TEST_PORT) { [int]$env:PLAYWRIGHT_TEST_PORT } else { 3100 }
}

$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $conn) {
    Write-Output "PREFLIGHT OK: port $Port is free"
    exit 0
}

$procId = $conn.OwningProcess | Select-Object -First 1
$proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
$name = if ($proc) { $proc.ProcessName } else { "unknown" }
$started = if ($proc) { $proc.StartTime } else { "unknown" }

Write-Output "PREFLIGHT BLOCKED: port $Port held by PID $procId ($name, started $started)"

if (-not $Kill) {
    Write-Output "Re-run with -Kill to free it, or stop the process yourself."
    exit 1
}

if ($name -ne "node") {
    Write-Output "REFUSING to kill a non-node process. Free port $Port manually."
    exit 1
}

# Being a node process is NOT ownership. The owner runs parallel sessions in
# sibling worktrees, and any of them may hold a dev server on this port; killing
# one because it is "a node" would terminate another session's in-flight work.
# The protected resource is THIS worktree, so require the process command line to
# reference THIS repo root before terminating it. An indeterminate lookup (WMI
# error, access denied, empty command line) fails SAFE: reported, never killed.
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$cmdLine = $null
try {
    $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $procId" -ErrorAction Stop).CommandLine
} catch {
    Write-Output "REFUSING to kill PID ${procId}: could not read its command line ($($_.Exception.Message))."
    Write-Output "Cannot establish ownership. Free port $Port manually."
    exit 1
}

if ([string]::IsNullOrWhiteSpace($cmdLine)) {
    Write-Output "REFUSING to kill PID ${procId}: empty command line, ownership indeterminate."
    exit 1
}

if ($cmdLine -notlike "*$repoRoot*") {
    Write-Output "REFUSING to kill PID ${procId}: it does not reference this worktree."
    Write-Output "  this worktree: $repoRoot"
    Write-Output "  process cmd:   $cmdLine"
    Write-Output "This is most likely a parallel session. Free port $Port manually, or stop that session yourself."
    exit 1
}

Write-Output "Ownership established: PID $procId references $repoRoot"
Stop-Process -Id $procId -Force
Start-Sleep -Seconds 2

if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    Write-Output "PREFLIGHT FAILED: port $Port still held after kill"
    exit 1
}

Write-Output "PREFLIGHT OK: freed port $Port (killed PID $procId)"
exit 0
