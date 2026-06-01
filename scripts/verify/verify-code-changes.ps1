# Code Change Verification Script (PowerShell)
# Verifies that code changes don't break existing functionality

Write-Host "Code Change Verification Process" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Track failures
$Failures = 0

# Function to check command result
function Check-Result {
    param(
        [string]$Message,
        [bool]$Success
    )

    if ($Success) {
        Write-Host "[PASS] $Message" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $Message" -ForegroundColor Red
        $script:Failures++
    }
}

# Function to run command and check exit code
function Run-Command {
    param(
        [string[]]$CommandParts,
        [string]$Message
    )

    Write-Host "$Message..." -ForegroundColor Yellow

    # Temporarily disable error action to capture output
    $oldErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"

    # Run the command
    $output = & $CommandParts[0] $CommandParts[1..($CommandParts.Length-1)] 2>&1

    # Check exit code
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $oldErrorAction

    # Determine success
    if ($exitCode -ne $null -and $exitCode -ne 0) {
        $success = $false
    } elseif ($exitCode -eq 0) {
        $success = $true
    } else {
        # Fallback only when the exit code is null: scan output for common failure strings.
        # (The exit code is the primary signal; this just guards null-exit-code edge cases.)
        $outputString = $output | Out-String
        $hasErrors = $outputString -match "(npm ERR|error TS|Error:|Failed|FAILED)"
        $success = -not $hasErrors
    }

    Check-Result $Message $success
    if (-not $success) {
        $outputString = $output | Out-String
        if ($outputString.Trim().Length -gt 0) {
            Write-Host "   Output: $outputString" -ForegroundColor Gray
        }
    }
    return $success
}

# 1. Build Verification (monitored build -- never raw `npm run build`, which has no quarantine/
# timeout and causes Access Denied stalls on Windows; see docs/GATE_MODE_SOP.md section 10)
Run-Command @("npm", "run", "build:monitored:clean", "--", "-TimeoutSeconds", "360", "-PollSeconds", "10") "1. Build verification"

# 2. Type Checking
Run-Command @("npx", "tsc", "--noEmit") "2. Type checking"

# 3. Linting
Run-Command @("npm", "run", "lint") "3. Linting check"

# 4. Unit Tests (CI-faithful: coverage + CI env, matches the GitHub Actions Unit Tests job)
Run-Command @("npm", "run", "test:ci") "4. Unit tests (CI-faithful)"

# 5. Check for poll-related files in changes
Write-Host "5. Checking for poll-related file changes..." -ForegroundColor Yellow
try {
    $changedFiles = git diff --name-only HEAD
    $pollFiles = $changedFiles | Select-String -Pattern "(poll|Poll|POLL|survey-results|cew-polls|matrix)"

    if ($pollFiles) {
        Write-Host "WARNING: Poll-related files detected in changes" -ForegroundColor Yellow
        Write-Host "   Please verify these changes are intentional and poll-safe" -ForegroundColor Yellow
        $pollFiles | ForEach-Object { Write-Host "   $_" -ForegroundColor Yellow }
    } else {
        Write-Host "[PASS] No poll-related files in changes" -ForegroundColor Green
    }
} catch {
    Write-Host "WARNING: Could not check for poll-related files" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
if ($Failures -eq 0) {
    Write-Host "[PASS] All automated checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "1. Review the change impact matrix"
    Write-Host "2. Perform manual testing for affected features"
    Write-Host "3. Complete the post-change verification checklist"
    exit 0
} else {
    Write-Host "[FAIL] $Failures check(s) failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix the issues above before proceeding"
    exit 1
}
