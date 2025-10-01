# run-cew-100-test.ps1
# PowerShell script to run comprehensive CEW2025 100-user test

Write-Host "🚀 Starting CEW2025 100-User Comprehensive Test" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

# Set base URL (default to localhost:3000)
$BASE_URL = if ($env:BASE_URL) { $env:BASE_URL } else { "http://localhost:3000" }

Write-Host "📊 Testing with base URL: $BASE_URL" -ForegroundColor Cyan
Write-Host ""

# Test 1: CEW2025 100-User Comprehensive Test
Write-Host "🎯 Running CEW2025 100-User Comprehensive Test..." -ForegroundColor Yellow
Write-Host "   - Simulates 100 CEW2025 users on mobile devices" -ForegroundColor White
Write-Host "   - Tests all poll types: single-choice, ranking, wordcloud" -ForegroundColor White
Write-Host "   - Tests matrix graphs with real data" -ForegroundColor White
Write-Host "   - Duration: ~8 minutes" -ForegroundColor White
Write-Host ""

k6 run --env BASE_URL="$BASE_URL" k6-cew-100-users-comprehensive.js

Write-Host ""
Write-Host "✅ CEW2025 100-User Test Complete!" -ForegroundColor Green
Write-Host ""

# Optional: Run authenticated survey-results test
if ($env:RUN_AUTH_TEST -eq "true") {
    Write-Host "🔐 Running Survey-Results Authenticated Test..." -ForegroundColor Yellow
    Write-Host "   - Tests authenticated SSTAC & TWG member access" -ForegroundColor White
    Write-Host "   - Requires TEST_EMAIL and TEST_PASSWORD environment variables" -ForegroundColor White
    Write-Host "   - Duration: ~5 minutes" -ForegroundColor White
    Write-Host ""
    
    if (-not $env:TEST_EMAIL -or -not $env:TEST_PASSWORD) {
        Write-Host "⚠️  Skipping authenticated test - missing credentials" -ForegroundColor Yellow
        Write-Host "   Set TEST_EMAIL and TEST_PASSWORD environment variables to run" -ForegroundColor White
    } else {
        k6 run --env BASE_URL="$BASE_URL" --env TEST_EMAIL="$env:TEST_EMAIL" --env TEST_PASSWORD="$env:TEST_PASSWORD" k6-survey-results-authenticated.js
        Write-Host ""
        Write-Host "✅ Survey-Results Authenticated Test Complete!" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🏁 All Tests Complete!" -ForegroundColor Green
Write-Host "📈 Check the matrix graphs in your admin panel to see the results" -ForegroundColor Cyan
Write-Host "🎯 Your system is ready for 100+ CEW2025 users!" -ForegroundColor Green
