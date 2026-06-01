#!/bin/bash
# Code Change Verification Script
# Verifies that code changes don't break existing functionality

echo "Code Change Verification Process"
echo "===================================="
echo ""

# Fail closed on Windows (Git Bash / MSYS / Cygwin). The gate requires the monitored build
# (npm run build:monitored:clean), which is a Windows-only PowerShell wrapper
# (scripts/verify/monitored-build.ps1). This bash script would otherwise run a raw
# `npm run build`, which the raw-build ban forbids on Windows (no quarantine/timeout; causes
# Access Denied stalls -- see docs/GATE_MODE_SOP.md section 10). On Windows, use the PowerShell
# verify script instead, which uses the monitored build.
# uname -s reports MINGW*/MSYS*/CYGWIN* under Git Bash, MSYS2, and Cygwin respectively.
case "$(uname -s 2>/dev/null)" in
    MINGW*|MSYS*|CYGWIN*|Windows*)
        echo "ERROR: this bash verify script is for Linux/Mac only."
        echo "On Windows, run the PowerShell verify script (it uses the monitored build):"
        echo "  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify/verify-code-changes.ps1"
        exit 1
        ;;
esac

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILURES=0

# Function to run command and check result
run_command() {
    local message="$1"
    shift
    local command="$@"

    echo -e "${YELLOW}$message...${NC}"
    if $command > /dev/null 2>&1; then
        echo -e "${GREEN}[PASS] $message${NC}"
        return 0
    else
        echo -e "${RED}[FAIL] $message${NC}"
        FAILURES=$((FAILURES + 1))
        return 1
    fi
}

# 1. Build Verification
# NOTE: this branch only runs on Linux/Mac (the Windows guard above exits first). The monitored
# build (npm run build:monitored:clean) is a Windows-only PowerShell wrapper, so a raw
# `npm run build` is the only option here. On Windows, use verify-code-changes.ps1.
run_command "1. Build verification" npm run build

# 2. Type Checking
run_command "2. Type checking" npx tsc --noEmit

# 3. Linting
run_command "3. Linting check" npm run lint

# 4. Unit Tests (CI-faithful: coverage + CI env, matches the GitHub Actions Unit Tests job)
run_command "4. Unit tests (CI-faithful)" npm run test:ci

# 5. Check for poll-related files in changes
echo "5. Checking for poll-related file changes..."
if git diff --name-only HEAD | grep -E "(poll|Poll|POLL|survey-results|cew-polls|matrix)" > /dev/null; then
    echo -e "${YELLOW}WARNING: Poll-related files detected in changes${NC}"
    echo "   Please verify these changes are intentional and poll-safe"
    git diff --name-only HEAD | grep -E "(poll|Poll|POLL|survey-results|cew-polls|matrix)"
else
    echo -e "${GREEN}[PASS] No poll-related files in changes${NC}"
fi

# Summary
echo ""
echo "===================================="
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}[PASS] All automated checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review the change impact matrix"
    echo "2. Perform manual testing for affected features"
    echo "3. Complete the post-change verification checklist"
    exit 0
else
    echo -e "${RED}[FAIL] $FAILURES check(s) failed${NC}"
    echo ""
    echo "Please fix the issues above before proceeding"
    exit 1
fi
