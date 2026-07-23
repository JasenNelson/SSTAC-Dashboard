$ScriptDir = $PSScriptRoot
. "$ScriptDir\graphify_guardrail.ps1"

$allPass = $true

Write-Host "Test 1: Fast payload (should pass through exit 0)"
$res1 = Invoke-GraphifyGuarded -GraphifyExe 'powershell' -GraphifyArgs @('-NoProfile', '-Command', 'Write-Host ok') -TimeoutSec 5
if ($res1.ExitCode -eq 0 -and -not $res1.TimedOut -and -not $res1.Killed) {
    Write-Host "PASS: Fast payload exit 0"
} else {
    Write-Host "FAIL: Fast payload returned TimedOut=$($res1.TimedOut), ExitCode=$($res1.ExitCode), Killed=$($res1.Killed)"
    $allPass = $false
}

Write-Host "Test 2: Deliberate hang (should be killed, exit 124)"
$res2 = Invoke-GraphifyGuarded -GraphifyExe 'powershell' -GraphifyArgs @('-NoProfile', '-Command', 'Start-Sleep 600') -TimeoutSec 5
if ($res2.ExitCode -eq 124 -and $res2.TimedOut -and $res2.Killed) {
    $pidDead = $true
    try {
        $null = Get-Process -Id $res2.ProcId -ErrorAction Stop
        $pidDead = $false
    } catch {}
    
    if ($pidDead) {
        Write-Host "PASS: Deliberate hang was killed, PID $($res2.ProcId) is dead, exit 124"
    } else {
        Write-Host "FAIL: Deliberate hang returned 124 but PID $($res2.ProcId) is still alive!"
        $allPass = $false
    }
} else {
    Write-Host "FAIL: Deliberate hang returned TimedOut=$($res2.TimedOut), ExitCode=$($res2.ExitCode), Killed=$($res2.Killed)"
    $allPass = $false
}

if ($allPass) {
    exit 0
} else {
    exit 1
}
