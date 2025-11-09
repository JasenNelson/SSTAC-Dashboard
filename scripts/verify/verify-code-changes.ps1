# Code Change Verification Script (PowerShell)
# Verifies that code changes don't break existing functionality

Write-Host "🔍 Code Change Verification Process" -ForegroundColor Cyan
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
        Write-Host "✅ $Message" -ForegroundColor Green
    } else {
        Write-Host "❌ $Message" -ForegroundColor Red
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
        # If exit code is null, check output for error patterns
        $outputString = $output | Out-String
        $hasErrors = $outputString -match "(npm ERR|error TS|✖|×|Error:|Failed|FAILED)"
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

# 1. Build Verification
Run-Command @("npm", "run", "build") "1️⃣  Build verification"

# 2. Type Checking
Run-Command @("npx", "tsc", "--noEmit") "2️⃣  Type checking"

# 3. Linting
Run-Command @("npm", "run", "lint") "3️⃣  Linting check"

# 4. Unit Tests
Run-Command @("npm", "run", "test:unit") "4️⃣  Unit tests"

# 5. Check for poll-related files in changes
Write-Host "5️⃣  Checking for poll-related file changes..." -ForegroundColor Yellow
try {
    $changedFiles = git diff --name-only HEAD
    $pollFiles = $changedFiles | Select-String -Pattern "(poll|Poll|POLL|survey-results|cew-polls|matrix)"
    
    if ($pollFiles) {
        Write-Host "⚠️  WARNING: Poll-related files detected in changes" -ForegroundColor Yellow
        Write-Host "   Please verify these changes are intentional and poll-safe" -ForegroundColor Yellow
        $pollFiles | ForEach-Object { Write-Host "   $_" -ForegroundColor Yellow }
    } else {
        Write-Host "✅ No poll-related files in changes" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Could not check for poll-related files" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
if ($Failures -eq 0) {
    Write-Host "✅ All automated checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "1. Review the change impact matrix"
    Write-Host "2. Perform manual testing for affected features"
    Write-Host "3. Complete the post-change verification checklist"
    exit 0
} else {
    Write-Host "❌ $Failures check(s) failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix the issues above before proceeding"
    exit 1
}

