$ScriptDir = $PSScriptRoot
. "$ScriptDir\graphify_guardrail.ps1"

$allPass = $true

Write-Host "Test 1: Fast payload (should pass through exit 0)"
$res1 = Invoke-GraphifyGuarded -GraphifyExe 'powershell' -GraphifyArgs @('-NoProfile', '-Command', 'Write-Host ok') -TimeoutSec 5
if ($res1.ExitCode -eq 0 -and -not $res1.TimedOut -and -not $res1.Killed -and
    -not $res1.GuardrailFailed -and -not $res1.OrphanRisk -and $res1.CleanupStatus -eq 'NOT_REQUIRED') {
    Write-Host "PASS: Fast payload exit 0"
} else {
    Write-Host "FAIL: Fast payload returned TimedOut=$($res1.TimedOut), ExitCode=$($res1.ExitCode), Killed=$($res1.Killed)"
    $allPass = $false
}

Write-Host "Test 2: Deliberate hang (root terminated, tree unproven, exit 124)"
$res2 = Invoke-GraphifyGuarded -GraphifyExe 'powershell' -GraphifyArgs @('-NoProfile', '-Command', 'Start-Sleep 600') -TimeoutSec 5
if ($res2.ExitCode -eq 124 -and $res2.TimedOut -and -not $res2.Killed -and
    -not $res2.GuardrailFailed -and $res2.OrphanRisk -and $res2.RootTerminated -and
    $res2.CleanupStatus -eq 'ROOT_TERMINATED_TREE_UNPROVEN') {
    Write-Host "PASS: Deliberate hang root terminated; descendant tree unproven; exit 124"
} else {
    Write-Host "FAIL: Deliberate hang returned TimedOut=$($res2.TimedOut), ExitCode=$($res2.ExitCode), Killed=$($res2.Killed), GuardrailFailed=$($res2.GuardrailFailed), OrphanRisk=$($res2.OrphanRisk), RootTerminated=$($res2.RootTerminated), CleanupStatus=$($res2.CleanupStatus), CleanupError=$($res2.CleanupError)"
    $allPass = $false
}

if ($allPass) {
    exit 0
} else {
    exit 1
}
