param(
    [string]$RepoRoot,
    [int]$MaxAgeHours = 0
)

$ErrorActionPreference = 'Continue'

try {
    if (-not $RepoRoot) {
        $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    }
} catch {
    Write-Host "NIGHTLY WATCHDOG: UNKNOWN -- advisory wrapper could not resolve repo root: $($_.Exception.Message)"
    exit 0
}

$checker = Join-Path $PSScriptRoot 'check_nightly_freshness.ps1'
if (-not (Test-Path -LiteralPath $checker)) {
    Write-Host "NIGHTLY WATCHDOG: UNKNOWN -- checker missing ($checker); cannot verify nightly freshness."
    exit 0
}

try {
    if ($MaxAgeHours -gt 0) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $checker -RepoRoot $RepoRoot -MaxAgeHours $MaxAgeHours
    } else {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $checker -RepoRoot $RepoRoot
    }
} catch {
    Write-Host "NIGHTLY WATCHDOG: UNKNOWN -- advisory wrapper could not run the checker: $($_.Exception.Message)"
}

exit 0
