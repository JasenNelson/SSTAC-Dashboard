# ============================================================================
# DATABASE INSPECTION SCRIPT RUNNER
# Purpose: Run database inspection scripts to check actual vote data
# ============================================================================

Write-Host "🔍 SSTAC Dashboard - Database Vote Data Inspection" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# Check if we have the SQL files
$sqlFiles = @(
    "scripts/debug/check-actual-vote-data.sql",
    "scripts/debug/check-matrix-graph-data.sql", 
    "scripts/debug/check-user-id-generation.sql"
)

foreach ($file in $sqlFiles) {
    if (Test-Path $file) {
        Write-Host "✅ Found: $file" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $file" -ForegroundColor Red
    }
}

Write-Host "`n📋 INSTRUCTIONS:" -ForegroundColor Yellow
Write-Host "1. Open your database management tool (pgAdmin, DBeaver, etc.)" -ForegroundColor White
Write-Host "2. Connect to your SSTAC database" -ForegroundColor White
Write-Host "3. Run each SQL file in this order:" -ForegroundColor White
Write-Host "   a) check-actual-vote-data.sql" -ForegroundColor Cyan
Write-Host "   b) check-matrix-graph-data.sql" -ForegroundColor Cyan
Write-Host "   c) check-user-id-generation.sql" -ForegroundColor Cyan

Write-Host "`n🎯 WHAT TO LOOK FOR:" -ForegroundColor Yellow
Write-Host "• User ID patterns (CEW2025_CEW2025-VU-ITERATION-TIMESTAMP-RANDOM)" -ForegroundColor White
Write-Host "• Vote counts per user per question" -ForegroundColor White
Write-Host "• Multiple votes from same user (should see >1 vote per question)" -ForegroundColor White
Write-Host "• Vote pairing potential (users with both importance AND feasibility votes)" -ForegroundColor White
Write-Host "• Timestamp patterns (votes submitted close together)" -ForegroundColor White

Write-Host "`n⚠️  IMPORTANT:" -ForegroundColor Red
Write-Host "• Run these queries AFTER running the K6 test" -ForegroundColor White
Write-Host "• Look for recent votes (last hour)" -ForegroundColor White
Write-Host "• Check if user IDs match the expected pattern from K6 tests" -ForegroundColor White

Write-Host "`n📊 EXPECTED RESULTS:" -ForegroundColor Yellow
Write-Host "• Each K6 virtual user should have a unique user_id" -ForegroundColor White
Write-Host "• Each user should have votes for multiple questions" -ForegroundColor White
Write-Host "• Matrix pairs should show users with both importance + feasibility votes" -ForegroundColor White
Write-Host "• Vote combinations should create multiple data points per user" -ForegroundColor White

Write-Host "`n🔧 ALTERNATIVE: If you can't run SQL directly:" -ForegroundColor Yellow
Write-Host "• Copy the SQL content and run in your database tool" -ForegroundColor White
Write-Host "• Or export the poll_votes table to CSV for analysis" -ForegroundColor White

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "Run the queries and share the results to verify the actual data!" -ForegroundColor Green
