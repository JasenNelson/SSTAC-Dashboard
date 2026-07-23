$ScriptDir = $PSScriptRoot
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$receiptDir = Join-Path $RepoRoot ".tmp_wiki_nightly"
$stamp = (Get-Date -Format 'yyyyMMdd_HHmmss')

Write-Host "--- WIKI WATCHDOG ---"

Write-Host "1. Freshness Check:"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir 'check_nightly_freshness.ps1') -RepoRoot $RepoRoot

Write-Host "2. Orphan Check:"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir 'check_orphans.ps1')

Write-Host "3. Starvation Checks:"
if (Test-Path $receiptDir) {
    $receipts = @(Get-ChildItem -Path $receiptDir -Filter "receipt-*.md" -File | Sort-Object LastWriteTime -Descending)
    
    if ($receipts.Count -ge 4) {
        $semStarved = $true
        for ($i = 0; $i -lt 4; $i++) {
            $content = Get-Content $receipts[$i].FullName -Raw
            if ($content -notmatch 'SEMANTIC_SKIPPED_LOCK') {
                $semStarved = $false
                break
            }
        }
        if ($semStarved) {
            $outPath = "C:\Projects\HITL_SSTAC_WIKI_SEMANTIC_STARVED_$stamp.md"
            "Semantic starvation: last 4+ receipts all contain SEMANTIC_SKIPPED_LOCK." | Set-Content $outPath
            Write-Host "Detected semantic starvation -> $outPath"
        }
    }

    if ($receipts.Count -ge 7) {
        $promoStarved = $true
        for ($i = 0; $i -lt 7; $i++) {
            $content = Get-Content $receipts[$i].FullName -Raw
            if ($content -notmatch 'PROMOTION_SKIPPED') {
                $promoStarved = $false
                break
            }
        }
        if ($promoStarved) {
            $outPath = "C:\Projects\HITL_SSTAC_WIKI_PROMOTION_STARVED_$stamp.md"
            "Promotion starvation: last 7+ receipts all contain PROMOTION_SKIPPED." | Set-Content $outPath
            Write-Host "Detected promotion starvation -> $outPath"
        }
        
        $freshStalled = $true
        for ($i = 0; $i -lt 7; $i++) {
            $content = Get-Content $receipts[$i].FullName -Raw
            if ($content -notmatch 'freshness_unknown' -and $content -notmatch '\[FLAGGED\]') {
                $freshStalled = $false
                break
            }
        }
        if ($freshStalled) {
            $outPath = "C:\Projects\HITL_SSTAC_WIKI_FRESHNESS_STALLED_$stamp.md"
            "Persistent staleness: last 7+ receipts all freshness-flagged/unknown." | Set-Content $outPath
            Write-Host "Detected persistent staleness -> $outPath"
        }
    }
}
Write-Host "Done."
exit 0
