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
# Only a node process is killed. A port held by anything else is reported and
# the script exits non-zero, because that is someone else's work and the owner
# runs parallel sessions -- see the L0 rule that a process census is never a
# gate and that foreign processes are never killed by name.

param(
    [int]$Port = 3100,
    [switch]$Kill
)

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

Stop-Process -Id $procId -Force
Start-Sleep -Seconds 2

if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    Write-Output "PREFLIGHT FAILED: port $Port still held after kill"
    exit 1
}

Write-Output "PREFLIGHT OK: freed port $Port (killed PID $procId)"
exit 0
