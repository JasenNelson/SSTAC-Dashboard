# Grade Analysis Metrics Script
# Gathers key metrics for conducting a grade analysis
# Usage: .\scripts\analyze-grade.ps1

Write-Host "=== Grade Analysis Metrics ===" -ForegroundColor Cyan
Write-Host "Project: SSTAC Dashboard" -ForegroundColor Gray
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" -ForegroundColor Gray

# Change to project root
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# 1. Linting Analysis
Write-Host "1. Linting Analysis:" -ForegroundColor Yellow
try {
    $lintOutput = npm run lint 2>&1 | Out-String
    $lintWarnings = ($lintOutput | Select-String -Pattern "Warning:" | Measure-Object).Count
    $lintErrors = ($lintOutput | Select-String -Pattern "Error:" | Measure-Object).Count
    $anyTypes = ($lintOutput | Select-String -Pattern "@typescript-eslint/no-explicit-any" | Measure-Object).Count
    $unusedVars = ($lintOutput | Select-String -Pattern "@typescript-eslint/no-unused-vars" | Measure-Object).Count
    
    Write-Host "   Total Warnings: $lintWarnings" -ForegroundColor $(if ($lintWarnings -eq 0) { "Green" } else { "Yellow" })
    Write-Host "   Total Errors: $lintErrors" -ForegroundColor $(if ($lintErrors -eq 0) { "Green" } else { "Red" })
    Write-Host "   'any' Type Warnings: $anyTypes" -ForegroundColor $(if ($anyTypes -eq 0) { "Green" } else { "Yellow" })
    Write-Host "   Unused Variable Warnings: $unusedVars" -ForegroundColor $(if ($unusedVars -eq 0) { "Green" } else { "Yellow" })
} catch {
    Write-Host "   Error running lint: $_" -ForegroundColor Red
}

# 2. TypeScript Analysis
Write-Host "`n2. TypeScript Analysis:" -ForegroundColor Yellow
try {
    $tsOutput = npx tsc --noEmit 2>&1 | Out-String
    $tsErrors = ($tsOutput | Select-String -Pattern "error TS" | Measure-Object).Count
    
    Write-Host "   TypeScript Errors: $tsErrors" -ForegroundColor $(if ($tsErrors -eq 0) { "Green" } else { "Red" })
} catch {
    Write-Host "   Error running TypeScript check: $_" -ForegroundColor Red
}

# 3. Testing Analysis
Write-Host "`n3. Testing Analysis:" -ForegroundColor Yellow
try {
    # Count test files
    $testFiles = (Get-ChildItem -Path tests -Recurse -Filter "*.test.{ts,tsx}" -File -ErrorAction SilentlyContinue | Measure-Object).Count
    $testFiles += (Get-ChildItem -Path src -Recurse -Filter "*.test.{ts,tsx}" -File -ErrorAction SilentlyContinue | Measure-Object).Count
    
    # Count k6 tests
    $k6Tests = (Get-ChildItem -Path tests -Filter "k6-*.js" -File -ErrorAction SilentlyContinue | Measure-Object).Count
    
    # Count Playwright tests
    $playwrightTests = (Get-ChildItem -Path e2e -Recurse -Filter "*.spec.ts" -File -ErrorAction SilentlyContinue | Measure-Object).Count
    
    Write-Host "   Unit Test Files: $testFiles"
    Write-Host "   k6 Load Tests: $k6Tests"
    Write-Host "   Playwright E2E Tests: $playwrightTests"
} catch {
    Write-Host "   Error analyzing tests: $_" -ForegroundColor Red
}

# 4. Code Quality Metrics
Write-Host "`n4. Code Quality Metrics:" -ForegroundColor Yellow
try {
    # Count 'any' types in source
    $anyTypes = (Get-ChildItem -Path src -Recurse -Filter "*.{ts,tsx}" -File -ErrorAction SilentlyContinue | 
        Select-String -Pattern ":\s*any\b" -ErrorAction SilentlyContinue | Measure-Object).Count
    
    # Count console statements
    $consoleLogs = (Get-ChildItem -Path src -Recurse -Filter "*.{ts,tsx}" -File -ErrorAction SilentlyContinue | 
        Select-String -Pattern "console\.(log|warn|error)" -ErrorAction SilentlyContinue | Measure-Object).Count
    
    # Find large files (god components)
    $largeFiles = Get-ChildItem -Path src -Recurse -Filter "*.tsx" -File -ErrorAction SilentlyContinue | 
        Where-Object { 
            try {
                (Get-Content $_.FullName -ErrorAction Stop | Measure-Object -Line).Lines -gt 500
            } catch {
                $false
            }
        } | Select-Object Name, @{Name="Lines";Expression={
            try {
                (Get-Content $_.FullName -ErrorAction Stop | Measure-Object -Line).Lines
            } catch {
                0
            }
        }}
    
    $largeFileCount = ($largeFiles | Measure-Object).Count
    
    Write-Host "   'any' Types in Source: $anyTypes" -ForegroundColor $(if ($anyTypes -eq 0) { "Green" } else { "Yellow" })
    Write-Host "   Console Statements: $consoleLogs" -ForegroundColor $(if ($consoleLogs -eq 0) { "Green" } else { "Yellow" })
    Write-Host "   Large Files (>500 lines): $largeFileCount" -ForegroundColor $(if ($largeFileCount -eq 0) { "Green" } else { "Yellow" })
    
    if ($largeFileCount -gt 0) {
        Write-Host "`n   Large Files:" -ForegroundColor Yellow
        $largeFiles | ForEach-Object {
            Write-Host "     - $($_.Name): $($_.Lines) lines" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "   Error analyzing code quality: $_" -ForegroundColor Red
}

# 5. Documentation Analysis
Write-Host "`n5. Documentation Analysis:" -ForegroundColor Yellow
try {
    $docFiles = (Get-ChildItem -Path docs -Recurse -Filter "*.md" -File -ErrorAction SilentlyContinue | Measure-Object).Count
    $keyDocs = @(
        "docs/README.md",
        "docs/AGENTS.md",
        "docs/PROJECT_STATUS.md",
        "docs/INDEX.md"
    )
    
    Write-Host "   Total Documentation Files: $docFiles"
    Write-Host "   Key Documentation:" -ForegroundColor Gray
    foreach ($doc in $keyDocs) {
        $exists = Test-Path $doc
        $status = if ($exists) { "[OK]" } else { "[MISSING]" }
        $color = if ($exists) { "Green" } else { "Red" }
        Write-Host "     $status $doc" -ForegroundColor $color
    }
} catch {
    Write-Host "   Error analyzing documentation: $_" -ForegroundColor Red
}

# 6. Current Grade from Manifest
Write-Host "`n6. Current Grade (from manifest):" -ForegroundColor Yellow
try {
    $manifestPath = "docs/_meta/docs-manifest.json"
    if (Test-Path $manifestPath) {
        $manifest = Get-Content $manifestPath | ConvertFrom-Json
        if ($manifest.facts.grades) {
            Write-Host "   Starting Grade: $($manifest.facts.grades.starting_grade.value)" -ForegroundColor Gray
            Write-Host "   Current Grade: $($manifest.facts.grades.current_grade.value)" -ForegroundColor Cyan
            Write-Host "   Target Grade: $($manifest.facts.grades.target_grade.value)" -ForegroundColor Gray
            Write-Host "   Last Verified: $($manifest.facts.grades.current_grade.last_verified)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   Manifest not found" -ForegroundColor Red
    }
} catch {
    Write-Host "   Error reading manifest: $_" -ForegroundColor Red
}

Write-Host "`n=== Analysis Complete ===" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. Review metrics above" -ForegroundColor Gray
Write-Host "2. Evaluate each category (see docs/review-analysis/HOW_TO_CONDUCT_GRADE_ANALYSIS.md)" -ForegroundColor Gray
Write-Host "3. Calculate weighted grade" -ForegroundColor Gray
Write-Host "4. Document findings" -ForegroundColor Gray
