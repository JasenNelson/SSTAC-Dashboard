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

Write-Host "Test 3: Exact environment (child receives only the declared launch block)"
$env:GUARDRAIL_SMOKE_SENTINEL = 'smoke-sentinel'
$probeDir = Join-Path ([System.IO.Path]::GetTempPath()) ('guardrail_smoke_' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $probeDir -Force | Out-Null
try {
    $envProbe = Join-Path $probeDir 'env_probe.ps1'
    $envProbeBody = @'
$m = @{}
foreach ($e in [System.Environment]::GetEnvironmentVariables().GetEnumerator()) {
    $m[[string]$e.Key] = [string]$e.Value
}
[pscustomobject]@{ Env = $m } | ConvertTo-Json -Depth 5 -Compress
'@
    [System.IO.File]::WriteAllText($envProbe, $envProbeBody)

    # PSModulePath and PSExecutionPolicyPreference are declared because a powershell child
    # injects them into itself after start. LaunchEnvironment is the block the guardrail
    # CONFIGURED, never a claim about the effective child environment.
    # Case-INSENSITIVE, matching Windows environment-key semantics and the guardrail's own
    # comparison rule. A bare OrderedDictionary is ordinal, so a child reporting a declared
    # key under different casing would be scored as an extra key and fail this smoke test.
    $decl = New-Object 'System.Collections.Specialized.OrderedDictionary' ([System.StringComparer]::OrdinalIgnoreCase)
    $decl['SystemRoot'] = $env:SystemRoot
    $decl['PATH'] = $env:PATH
    $decl['PATHEXT'] = $env:PATHEXT
    $decl['TEMP'] = $probeDir
    $decl['TMP'] = $probeDir
    $decl['EMPTYVAL'] = ''
    $decl['PSModulePath'] = 'C:\NoSuchModules'
    $decl['PSExecutionPolicyPreference'] = 'Bypass'

    $childExe = (Get-Command powershell).Source
    $envProbeArgs = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $envProbe)
    $res3 = Invoke-GraphifyGuardedCapture -GraphifyExe $childExe -GraphifyArgs $envProbeArgs `
        -TimeoutSec 120 -ExactEnvironment $decl

    $extraKeys = @()
    $missingKeys = @()
    $changedKeys = @()
    $sentinelLeaked = $true
    $parsedChild = $false
    # Parsing is guarded so that a malformed child stdout FAILS Test 3 without unwinding past
    # Test 4; sharing one try meant a throw here silently reduced coverage instead of reporting it.
    $observedMap = $null
    try {
        if (-not [string]::IsNullOrWhiteSpace($res3.StdOutText)) {
            $observedMap = @{}
            foreach ($prop in (($res3.StdOutText | ConvertFrom-Json).Env).PSObject.Properties) {
                $observedMap[$prop.Name] = [string]$prop.Value
            }
        }
    }
    catch {
        Write-Host "FAIL: Exact environment child stdout could not be parsed: $($_.Exception.Message)"
        $observedMap = $null
    }
    if ($null -ne $observedMap) {
        foreach ($k in $observedMap.Keys) {
            if (-not $decl.Contains($k)) { $extraKeys += $k }
            elseif (([string]$observedMap[$k]) -cne ([string]$decl[$k])) { $changedKeys += $k }
        }
        foreach ($k in $decl.Keys) { if (-not $observedMap.ContainsKey($k)) { $missingKeys += $k } }
        $sentinelLeaked = $observedMap.ContainsKey('GUARDRAIL_SMOKE_SENTINEL')
        $parsedChild = $true
    }

    if ($parsedChild -and $res3.ExitCode -eq 0 -and -not $res3.TimedOut -and
        -not $res3.GuardrailFailed -and -not $res3.OrphanRisk -and
        $res3.EnvironmentMode -eq 'EXACT' -and
        $res3.LaunchEnvironmentSource -eq 'PROCESS_START_INFO_READBACK' -and
        $null -eq $res3.EnvironmentValidationError -and
        $null -eq $res3.OutputReadError -and
        $res3.TempCleanupStatus -eq 'REMOVED' -and
        $extraKeys.Count -eq 0 -and $missingKeys.Count -eq 0 -and $changedKeys.Count -eq 0 -and
        -not $sentinelLeaked) {
        Write-Host "PASS: Exact environment child received exactly the declared block; parent sentinel absent"
    } else {
        Write-Host "FAIL: Exact environment returned ExitCode=$($res3.ExitCode), GuardrailFailed=$($res3.GuardrailFailed), EnvironmentMode=$($res3.EnvironmentMode), LaunchEnvironmentSource=$($res3.LaunchEnvironmentSource), EnvironmentValidationError=$($res3.EnvironmentValidationError), TempCleanupStatus=$($res3.TempCleanupStatus), ParsedChild=$parsedChild, Extra=$($extraKeys -join ','), Missing=$($missingKeys -join ','), Changed=$($changedKeys -join ','), SentinelLeaked=$sentinelLeaked"
        $allPass = $false
    }

    Write-Host "Test 4: Invalid exact environment (rejected before any process starts)"
    $markerProbe = Join-Path $probeDir 'marker_probe.ps1'
    $markerProbeBody = @'
param([string]$MarkerPath)
[System.IO.File]::WriteAllText($MarkerPath, 'started')
'@
    [System.IO.File]::WriteAllText($markerProbe, $markerProbeBody)
    $marker = Join-Path $probeDir 'never_started.marker'
    $bad = New-Object 'System.Collections.Specialized.OrderedDictionary'
    $bad['ALPHA=BETA'] = 'value'
    $markerArgs = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $markerProbe, $marker)
    $res4 = Invoke-GraphifyGuarded -GraphifyExe $childExe -GraphifyArgs $markerArgs `
        -TimeoutSec 30 -ExactEnvironment $bad

    if ($res4.GuardrailFailed -and -not $res4.OrphanRisk -and -not $res4.TimedOut -and
        $null -eq $res4.ProcId -and $res4.CleanupStatus -eq 'START_FAILED' -and
        $res4.EnvironmentMode -eq 'EXACT' -and
        $res4.LaunchEnvironmentSource -eq 'EXACT_ENVIRONMENT_REJECTED_BEFORE_LAUNCH' -and
        $null -eq $res4.LaunchEnvironment -and
        $res4.EnvironmentValidationError -like '*equals sign*' -and
        -not (Test-Path -LiteralPath $marker)) {
        Write-Host "PASS: Invalid exact environment rejected before launch; child never started"
    } else {
        Write-Host "FAIL: Invalid exact environment returned GuardrailFailed=$($res4.GuardrailFailed), OrphanRisk=$($res4.OrphanRisk), ProcId=$($res4.ProcId), CleanupStatus=$($res4.CleanupStatus), LaunchEnvironmentSource=$($res4.LaunchEnvironmentSource), EnvironmentValidationError=$($res4.EnvironmentValidationError), MarkerExists=$(Test-Path -LiteralPath $marker)"
        $allPass = $false
    }

    # Test 5 is the FALSIFICATION PAIR for Test 4. Without it, a typo in the probe path or a probe
    # that simply cannot write would leave the marker absent for the wrong reason and Test 4 would
    # pass vacuously. Same executable, same arguments, same marker probe -- only the declaration
    # differs, so the marker MUST appear.
    Write-Host "Test 5: Valid exact environment starts the same child Test 4 blocked"
    $liveMarker = Join-Path $probeDir 'did_start.marker'
    $liveArgs = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $markerProbe, $liveMarker)
    $res5 = Invoke-GraphifyGuarded -GraphifyExe $childExe -GraphifyArgs $liveArgs `
        -TimeoutSec 60 -ExactEnvironment $decl

    if ($res5.ExitCode -eq 0 -and -not $res5.GuardrailFailed -and -not $res5.TimedOut -and
        $res5.CleanupStatus -eq 'NOT_REQUIRED' -and
        $res5.LaunchEnvironmentSource -eq 'PROCESS_START_INFO_READBACK' -and
        (Test-Path -LiteralPath $liveMarker)) {
        Write-Host "PASS: Valid exact environment started the child and the marker was written"
    } else {
        Write-Host "FAIL: Valid exact environment returned ExitCode=$($res5.ExitCode), GuardrailFailed=$($res5.GuardrailFailed), CleanupStatus=$($res5.CleanupStatus), LaunchEnvironmentSource=$($res5.LaunchEnvironmentSource), MarkerExists=$(Test-Path -LiteralPath $liveMarker)"
        $allPass = $false
    }
}
catch {
    # Any throw outside the guarded parse used to unwind straight to finally, skipping the
    # remaining tests silently and never reaching the $allPass-based exit.
    Write-Host "FAIL: Exact-environment smoke threw before completing: $($_.Exception.Message)"
    $allPass = $false
}
finally {
    Remove-Item -LiteralPath $probeDir -Recurse -Force -ErrorAction SilentlyContinue
    # The sentinel exists only to prove it does NOT reach the child; it must not outlive
    # this script in the invoking session.
    [System.Environment]::SetEnvironmentVariable('GUARDRAIL_SMOKE_SENTINEL', $null)
}

if ($allPass) {
    exit 0
} else {
    exit 1
}
