#!/bin/bash
# Code Change Verification Script
# Verifies that code changes don't break existing functionality

echo "🔍 Code Change Verification Process"
echo "===================================="
echo ""

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
        echo -e "${GREEN}✅ $message${NC}"
        return 0
    else
        echo -e "${RED}❌ $message${NC}"
        FAILURES=$((FAILURES + 1))
        return 1
    fi
}

# 1. Build Verification
run_command "1️⃣  Build verification" npm run build

# 2. Type Checking
run_command "2️⃣  Type checking" npx tsc --noEmit

# 3. Linting
run_command "3️⃣  Linting check" npm run lint

# 4. Unit Tests
run_command "4️⃣  Unit tests" npm run test:unit

# 5. Check for poll-related files in changes
echo "5️⃣  Checking for poll-related file changes..."
if git diff --name-only HEAD | grep -E "(poll|Poll|POLL|survey-results|cew-polls|matrix)" > /dev/null; then
    echo -e "${YELLOW}⚠️  WARNING: Poll-related files detected in changes${NC}"
    echo "   Please verify these changes are intentional and poll-safe"
    git diff --name-only HEAD | grep -E "(poll|Poll|POLL|survey-results|cew-polls|matrix)"
else
    echo -e "${GREEN}✅ No poll-related files in changes${NC}"
fi

# Summary
echo ""
echo "===================================="
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✅ All automated checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review the change impact matrix"
    echo "2. Perform manual testing for affected features"
    echo "3. Complete the post-change verification checklist"
    exit 0
else
    echo -e "${RED}❌ $FAILURES check(s) failed${NC}"
    echo ""
    echo "Please fix the issues above before proceeding"
    exit 1
fi

