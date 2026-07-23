$ErrorActionPreference = 'SilentlyContinue'
$orphansFound = $false
$allProcs = Get-CimInstance Win32_Process
$targetProcs = $allProcs | Where-Object { ($_.Name -match 'graphify\.exe|python\.exe') -and ($_.CommandLine -match 'SSTAC-Dashboard') }

$results = @()

foreach ($p in $targetProcs) {
    $status = "UNKNOWN"
    $parentPid = $p.ParentProcessId
    
    if (-not $parentPid) {
        $status = "SUSPICIOUS (Parent PID Null)"
    } else {
        $parent = Get-Process -Id $parentPid -ErrorAction SilentlyContinue
        if ($parent) {
            $status = "ALIVE"
        } else {
            $status = "ORPHANED"
            $orphansFound = $true
        }
    }
    
    $results += [PSCustomObject]@{
        PID = $p.ProcessId
        Name = $p.Name
        ParentPID = $parentPid
        Status = $status
        CommandLine = $p.CommandLine
    }
}

if ($results.Count -gt 0) {
    $results | Format-Table -AutoSize | Out-String | Write-Host
} else {
    Write-Host "No orphan candidates found."
}

if ($orphansFound) { exit 1 } else { exit 0 }
