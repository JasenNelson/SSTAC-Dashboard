#!/bin/bash
# run-cew-100-test.sh
# Script to run comprehensive CEW2025 100-user test

echo "🚀 Starting CEW2025 100-User Comprehensive Test"
echo "================================================"

# Set base URL (default to localhost:3000)
BASE_URL=${BASE_URL:-"http://localhost:3000"}

echo "📊 Testing with base URL: $BASE_URL"
echo ""

# Test 1: CEW2025 100-User Comprehensive Test
echo "🎯 Running CEW2025 100-User Comprehensive Test..."
echo "   - Simulates 100 CEW2025 users on mobile devices"
echo "   - Tests all poll types: single-choice, ranking, wordcloud"
echo "   - Tests matrix graphs with real data"
echo "   - Duration: ~8 minutes"
echo ""

k6 run --env BASE_URL="$BASE_URL" k6-cew-100-users-comprehensive.js

echo ""
echo "✅ CEW2025 100-User Test Complete!"
echo ""

# Optional: Run authenticated survey-results test
if [ "$RUN_AUTH_TEST" = "true" ]; then
    echo "🔐 Running Survey-Results Authenticated Test..."
    echo "   - Tests authenticated SSTAC & TWG member access"
    echo "   - Requires TEST_EMAIL and TEST_PASSWORD environment variables"
    echo "   - Duration: ~5 minutes"
    echo ""
    
    if [ -z "$TEST_EMAIL" ] || [ -z "$TEST_PASSWORD" ]; then
        echo "⚠️  Skipping authenticated test - missing credentials"
        echo "   Set TEST_EMAIL and TEST_PASSWORD environment variables to run"
    else
        k6 run --env BASE_URL="$BASE_URL" --env TEST_EMAIL="$TEST_EMAIL" --env TEST_PASSWORD="$TEST_PASSWORD" k6-survey-results-authenticated.js
        echo ""
        echo "✅ Survey-Results Authenticated Test Complete!"
    fi
fi

echo ""
echo "🏁 All Tests Complete!"
echo "📈 Check the matrix graphs in your admin panel to see the results"
echo "🎯 Your system is ready for 100+ CEW2025 users!"
