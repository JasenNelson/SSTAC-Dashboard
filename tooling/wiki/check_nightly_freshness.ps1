param(
    [string]$RepoRoot,
    [int]$MaxAgeHours
)
if (-not $RepoRoot) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

$configFile = Join-Path $RepoRoot "tooling\wiki\wiki_nightly_config.json"
if (-not $MaxAgeHours) {
    $MaxAgeHours = 48
    if (Test-Path $configFile) {
        try {
            $cfg = Get-Content $configFile -Raw | ConvertFrom-Json
            if ($cfg.freshness_max_age_hours) {
                $MaxAgeHours = [int]$cfg.freshness_max_age_hours
            }
        } catch {}
    }
}

$receiptDir = Join-Path $RepoRoot ".tmp_wiki_nightly"
if (-not (Test-Path $receiptDir)) {
    Write-Host "NIGHTLY WATCHDOG: STALE -- receipt directory absent ($receiptDir)"
    exit 1
}
$latest = Get-ChildItem -Path $receiptDir -Filter "receipt-*.md" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($null -eq $latest) {
    Write-Host "NIGHTLY WATCHDOG: STALE -- no receipt files found in $receiptDir"
    exit 1
}
$ageRaw = ((Get-Date) - $latest.LastWriteTime).TotalHours
$ageHours = [math]::Round($ageRaw, 1)
if ($ageRaw -le $MaxAgeHours) {
    Write-Host "NIGHTLY WATCHDOG: FRESH -- latest receipt $($latest.Name) is $ageHours h old (<= $MaxAgeHours h)"
    exit 0
} else {
    Write-Host "NIGHTLY WATCHDOG: STALE -- latest receipt $($latest.Name) is $ageHours h old (> $MaxAgeHours h); the unattended nightly likely is not running -- check the scheduled task and logs."
    exit 1
}
