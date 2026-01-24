# /safe-exit - Pre-Exit Safety Check (Enhanced)

Run this skill before `/exit` to prevent corruption and post-exit crashes.

## Usage

```
/safe-exit
```

## What This Skill Does

1. Check system memory pressure
2. Check Claude temp directory size
3. Check task output file count
4. Check database lock state
5. Check ralph_semantic folder health (size + stale requests)
6. Check Python/Node processes (with memory totals)
7. Report a strict status (safe, warn, or block) and offer cleanup

## Instructions for Claude

**IMPORTANT: Use the production script, not inline PowerShell commands.**

Inline PowerShell commands will fail due to bash variable escaping issues.
Always run the production script:

```bash
powershell -ExecutionPolicy Bypass -File "F:\Regulatory-Review\.claude\scripts\safe-exit-check.ps1"
```

With cleanup option (prompts for confirmation):
```bash
powershell -ExecutionPolicy Bypass -File "F:\Regulatory-Review\.claude\scripts\safe-exit-check.ps1" -Cleanup
```

Force cleanup (no prompts):
```bash
powershell -ExecutionPolicy Bypass -File "F:\Regulatory-Review\.claude\scripts\safe-exit-check.ps1" -Cleanup -Force
```

Exit codes:
- 0 = SAFE TO EXIT
- 1 = EXIT WITH CAUTION (warnings)
- 2 = NOT SAFE TO EXIT (blocking issues)

The script automatically logs results to `F:\Regulatory-Review\.claude\logs\safe-exit_YYYYMMDD_HHMMSS.log`.

---

## Reference: Check Details

The following documents what each check does. The production script implements all of these.

### Step 1: System Memory Pressure
```powershell
$mem = Get-CimInstance Win32_OperatingSystem
$usedPercent = [math]::Round((($mem.TotalVisibleMemorySize - $mem.FreePhysicalMemory) / $mem.TotalVisibleMemorySize) * 100, 1)
```

Thresholds:
- <70%: OK
- 70-85%: WARNING (recommend closing apps)
- >85%: BLOCK (must resolve before exit)

### Step 2: Claude Temp Directory Size
```powershell
$tempPath = "$env:LOCALAPPDATA\Temp\claude"
$sizeMB = [math]::Round((Get-ChildItem -Path $tempPath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
```

Thresholds:
- <500MB: OK
- 500MB-1GB: WARNING (recommend cleanup)
- >1GB: BLOCK (cleanup required)

Auto-clean command (ask permission first):
```powershell
Remove-Item -Path "$env:LOCALAPPDATA\Temp\claude\*\tasks\*.output" -Force -ErrorAction SilentlyContinue
```

### Step 3: Task Output File Count
```powershell
$taskFiles = (Get-ChildItem -Path "$env:LOCALAPPDATA\Temp\claude" -Filter "*.output" -Recurse -ErrorAction SilentlyContinue).Count
```

Thresholds:
- <50: OK
- 50-100: WARNING (recommend cleanup)
- >100: BLOCK (cleanup required)

### Step 4: Database Lock Check
```powershell
$dbPath = "F:\Regulatory-Review\engine\data\rraa_v3_2.db"
try {
    $stream = [IO.File]::Open($dbPath, 'Open', 'ReadWrite', 'None')
    $stream.Close()
    "UNLOCKED"
} catch {
    "LOCKED - $($_.Exception.Message)"
}
```

Status:
- UNLOCKED: OK
- LOCKED: BLOCK (identify locking process and terminate)

### Step 5: Ralph Semantic Folder Health
```powershell
$ralphPath = "F:\Regulatory-Review\ralph_semantic"
$sizeMB = [math]::Round((Get-ChildItem -Path $ralphPath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
$pendingRequests = (Get-ChildItem -Path "$ralphPath\requests\*.json" -ErrorAction SilentlyContinue).Count
```

Thresholds:
- Folder size >100MB: WARNING
- Folder size >500MB: BLOCK (cleanup required)
- Pending requests >0: WARNING (check for matching responses)
- Pending requests >10: BLOCK (processing incomplete)

Stale request detection:
```powershell
Get-ChildItem "$ralphPath\requests\request_*.json" -File -ErrorAction SilentlyContinue | Where-Object {
    Test-Path (Join-Path "$ralphPath\responses" ($_.Name -replace '^request_','response_'))
} | Select-Object FullName, LastWriteTime, Length
```

Stale request auto-clean (ask permission first):
```powershell
Get-ChildItem "$ralphPath\requests\request_*.json" -File -ErrorAction SilentlyContinue | Where-Object {
    Test-Path (Join-Path "$ralphPath\responses" ($_.Name -replace '^request_','response_'))
} | ForEach-Object { Remove-Item $_.FullName -Force }
```

### Step 6: Python/Node Processes (Enhanced)
```powershell
$pythonProcs = Get-Process python -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, @{N='MB';E={[math]::Round($_.WorkingSet/1MB,1)}}
$totalPythonMB = ($pythonProcs | Measure-Object -Property MB -Sum).Sum

$nodeProcs = Get-Process node -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -eq ''} | Select-Object Id, ProcessName, @{N='MB';E={[math]::Round($_.WorkingSet/1MB,1)}}
$totalNodeMB = ($nodeProcs | Measure-Object -Property MB -Sum).Sum
```

Thresholds (per process type):
- 0 processes: OK
- Any process: WARNING (list and offer cleanup)
- Total >500MB: BLOCK (must terminate)

## Step 7: Report Status (Strict)

Exit decision matrix:
- ALL checks OK -> SAFE TO EXIT
- ANY WARNING -> EXIT WITH CAUTION
- ANY BLOCK -> NOT SAFE TO EXIT

Never report "Safe to exit" if any issue (warning or block) is identified.

### Output Format

All clear:
```
SAFE TO EXIT

System Health:
- Memory: 45% used (OK)
- Claude temp: 127 MB (OK)
- Task files: 12 (OK)
- Database: UNLOCKED (OK)
- Ralph folder: 23 MB (OK)
- Pending requests: 0 (OK)
- Python processes: 0 (OK)
- Node processes: 0 (OK)

You can now run /exit
```

Warnings present:
```
EXIT WITH CAUTION

Issues detected:
- Memory: 72% used (WARNING - close unnecessary apps)
- Task files: 67 (WARNING - recommend cleanup)

All other checks: OK

Recommended: Run cleanup before exit
Command: [cleanup command]

Proceed with exit? (not recommended)
```

Blocked:
```
NOT SAFE TO EXIT

Critical issues:
- Memory: 89% used (CRITICAL - system unstable)
- Claude temp: 1.3 GB (CRITICAL - will cause launch failure)
- Database: LOCKED (CRITICAL - corruption risk)

Required actions:
1. [specific action for each critical issue]
2. [specific action]

After resolving, run /safe-exit again.
```

## Implementation Notes

1. Order of checks: memory first, then temp files, then database
2. Auto-clean requires explicit user confirmation
3. Timeout after 5 seconds per check; on timeout, mark WARNING and continue
4. Log results to a timestamped file for crash diagnostics
5. Include recovery commands when relevant

## Recovery Commands (if Claude won't launch)

```powershell
Remove-Item -Path "$env:LOCALAPPDATA\Temp\claude" -Recurse -Force
Remove-Item -Path "$env:LOCALAPPDATA\Claude" -Recurse -Force
Get-Process | Where-Object {$_.ProcessName -match 'claude|node|python'} | Stop-Process -Force
```

---

## Production Script Location

**Script:** `F:\Regulatory-Review\.claude\scripts\safe-exit-check.ps1`

This script implements all checks with proper error handling, colored output,
exit codes, and logging. Always use this script rather than inline commands.

---
Created: 2026-01-23
Updated: 2026-01-23 (added production script reference)
Purpose: Prevent corruption and crashes after exit
