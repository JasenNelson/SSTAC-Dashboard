<#
.SYNOPSIS
    Fail-closed AGY 1.1.8 autonomous worker controller wrapper for SSTAC-Dashboard.
.DESCRIPTION
    Executes a tracked foreground AGY 1.1.8 worker session with isolated profile,
    strict receipt validation, environment protection, and durable continuity logs.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$WorkspaceRoot,
    [Parameter(Mandatory = $true)][string]$PromptFile,
    [Parameter(Mandatory = $true)][string]$ExpectedPromptSha256,
    [Parameter(Mandatory = $true)][string]$ProfileRoot,
    [Parameter(Mandatory = $true)][string]$ReceiptRoot,
    [Parameter(Mandatory = $true)][string[]]$WritablePaths,
    [Parameter(Mandatory = $false)][string[]]$ProtectedPaths = @(),
    [Parameter(Mandatory = $false)][string[]]$ExpectedTrackedDirtyPaths = @(),
    [Parameter(Mandatory = $false)][string[]]$ExpectedTrackedDirtySha256 = @(),
    [Parameter(Mandatory = $true)][string]$ExpectedBaselineHead,
    [Parameter(Mandatory = $true)][string]$ExpectedBranch,
    [Parameter(Mandatory = $false)][string]$ExpectedAgyVersion = '1.1.8',
    [Parameter(Mandatory = $false)][string]$ExpectedModel = 'gemini-3.1-pro-high',
    [Parameter(Mandatory = $false)][string]$ExpectedEffort = 'high',
    [Parameter(Mandatory = $false)][string]$PrintTimeout = '10m',
    [Parameter(Mandatory = $false)][string[]]$AllowedCommands = @(),
    [Parameter(Mandatory = $false)][string]$AgyExecutable = 'agy',
    [Parameter(Mandatory = $false)][string]$NodeExecutable = 'node',
    [Parameter(Mandatory = $false)][switch]$ReplaceEmptyGeneratedProfile
)

$ErrorActionPreference = 'Stop'

function Resolve-AbsolutePath {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "Path cannot be empty."
    }
    if (-not [System.IO.Path]::IsPathRooted($Path)) {
        throw "Path '$Path' must be an absolute path."
    }
    return [System.IO.Path]::GetFullPath($Path)
}

function Test-PathEqualsOrDescends {
    param([string]$ChildPath, [string]$ParentPath)
    $normChild = ([System.IO.Path]::GetFullPath($ChildPath)).TrimEnd('\', '/')
    $normParent = ([System.IO.Path]::GetFullPath($ParentPath)).TrimEnd('\', '/')

    if ($normChild -ieq $normParent) { return $true }

    $parentWithSep = $normParent + '\'
    if ($normChild.StartsWith($parentWithSep, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }
    return $false
}

function Test-PathOverlap {
    param([string]$PathA, [string]$PathB)
    return (Test-PathEqualsOrDescends -ChildPath $PathA -ParentPath $PathB) -or (Test-PathEqualsOrDescends -ChildPath $PathB -ParentPath $PathA)
}

function Test-ReparsePointPath {
    param([string]$Path)
    $resPath = Resolve-AbsolutePath -Path $Path
    $driveRoot = [System.IO.Path]::GetPathRoot($resPath).TrimEnd('\', '/')
    $rel = $resPath.Substring($driveRoot.Length).TrimStart('\', '/')
    $parts = $rel.Split([char[]]@('\', '/'), [System.StringSplitOptions]::RemoveEmptyEntries)
    $current = $driveRoot
    foreach ($part in $parts) {
        if ([string]::IsNullOrWhiteSpace($part)) { continue }
        $current = Join-Path $current $part
        if (Test-Path -LiteralPath $current) {
            $item = Get-Item -LiteralPath $current -Force
            if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
                return $current
            }
        } else {
            break
        }
    }
    return $null
}

function Write-LfFile {
    param([string]$Path, [string]$Content)
    $lfContent = $Content.Replace("`r`n", "`n")
    if (-not $lfContent.EndsWith("`n")) {
        $lfContent += "`n"
    }
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($Path, $lfContent, $utf8NoBom)
}

function Get-StringSha256 {
    param([string]$Text)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hashBytes = $sha.ComputeHash($bytes)
    return ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
}

function Get-FileSha256 {
    param([string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hashBytes = $sha.ComputeHash($bytes)
    return ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
}

# Determine script directory
$scriptDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptDir)) {
    $scriptDir = [System.IO.Path]::GetDirectoryName($MyInvocation.MyCommand.Definition)
}
if ([string]::IsNullOrWhiteSpace($scriptDir)) {
    $scriptDir = (Get-Location).Path
}

# 1. Pinned Parameters Strict Checks
if ($null -ne $AllowedCommands -and $AllowedCommands.Count -gt 0) {
    throw "Production controller rejects all AllowedCommands until a verifiable real sandbox canary is proven."
}
if ($ExpectedAgyVersion -ne '1.1.8') {
    throw "ExpectedAgyVersion must be exactly '1.1.8'. Got '$ExpectedAgyVersion'."
}
if ($ExpectedModel -ne 'gemini-3.1-pro-high') {
    throw "ExpectedModel must be exactly 'gemini-3.1-pro-high'. Got '$ExpectedModel'."
}
if ($ExpectedEffort -ne 'high') {
    throw "ExpectedEffort must be exactly 'high'. Got '$ExpectedEffort'."
}
if ([string]::IsNullOrWhiteSpace($PrintTimeout) -or $PrintTimeout -notmatch '^(\d+[smh])+$') {
    throw "PrintTimeout '$PrintTimeout' must be a valid Go duration (e.g. 10m, 1h)."
}
if ([string]::IsNullOrWhiteSpace($ExpectedPromptSha256) -or $ExpectedPromptSha256 -notmatch '^[0-9a-fA-F]{64}$') {
    throw "ExpectedPromptSha256 must be exactly 64 hex characters. Got '$ExpectedPromptSha256'."
}
$canonExpectedPromptHash = $ExpectedPromptSha256.ToLowerInvariant()

# 2. Resolve and Validate WorkspaceRoot
$resolvedWorkspace = Resolve-AbsolutePath -Path $WorkspaceRoot
$normWorkspace = $resolvedWorkspace.TrimEnd('\', '/')

if (-not (Test-Path -LiteralPath $resolvedWorkspace -PathType Container)) {
    throw "WorkspaceRoot '$resolvedWorkspace' must exist and be a directory."
}

$reparseWs = Test-ReparsePointPath -Path $resolvedWorkspace
if ($reparseWs) {
    throw "WorkspaceRoot component '$reparseWs' is a reparse point (junction/symlink)."
}

$forbiddenWorkspaces = @(
    'C:\Projects\SSTAC-Dashboard',
    'C:\Projects',
    'C:\Projects\SSTAC-Dashboard-worktrees'
)
foreach ($forbidden in $forbiddenWorkspaces) {
    if ($normWorkspace -ieq $forbidden.TrimEnd('\', '/')) {
        throw "WorkspaceRoot '$WorkspaceRoot' is forbidden ($forbidden)."
    }
}
$wsDrive = [System.IO.Path]::GetPathRoot($resolvedWorkspace).TrimEnd('\', '/')
if ($normWorkspace -ieq $wsDrive -or [string]::IsNullOrWhiteSpace($normWorkspace)) {
    throw "WorkspaceRoot '$WorkspaceRoot' cannot be a filesystem root."
}


function Get-GitCriticalSnapshot {
    param(
        [string]$WsPath,
        [string[]]$ProtectedArr,
        [string]$AbsGit,
        [string]$CommonGit
    )

    $dict = [ordered]@{}
    $state = @{
        FileCount = 0
        TotalBytes = 0
        QueueEntries = 0
        MaxFiles = 1000
        MaxBytes = 10485760
        MaxQueue = 1000
        MaxDepth = 10
        SeenPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
        OrdinalComparer = [System.StringComparer]::OrdinalIgnoreCase
    }

    function Process-Item {
        param($item, $depth)

        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            throw "Reparse point encountered at '$($item.FullName)'."
        }

        $abs = $item.FullName; if ($abs.EndsWith('\') -or $abs.EndsWith('/')) { $abs = $abs.Substring(0, $abs.Length - 1) }
        if ($state.SeenPaths.Add($abs)) {
            if ($item.PSIsContainer) {
                $name = $item.Name
                if ($name -eq '.git' -or $name -eq 'node_modules') { return }

                $state.QueueEntries++
                if ($state.QueueEntries -gt $state.MaxQueue) {
                    throw "exceeds maximum directory queue entries"
                }
                if ($depth -ge $state.MaxDepth) {
                    throw "exceeds maximum depth"
                }

                Get-ChildItem -LiteralPath $abs -Force -ErrorAction Stop | ForEach-Object {
                    Process-Item -item $_ -depth ($depth + 1)
                }
            } else {
                $state.FileCount++
                if ($state.FileCount -gt $state.MaxFiles) {
                    throw "exceeds 1000 file limit"
                }
                $state.TotalBytes += $item.Length
                if ($state.TotalBytes -gt $state.MaxBytes) {
                    throw "exceeded maximum cumulative size"
                }
            }
        }
    }

    $envFiles = Get-ChildItem -LiteralPath $WsPath -Filter ".env*" -Force -File -ErrorAction Stop
    foreach ($env in $envFiles) {
        Process-Item -item $env -depth 0
    }

    if (-not [string]::IsNullOrWhiteSpace($AbsGit) -and (Test-Path -LiteralPath $AbsGit)) {
        $gitConfig = Join-Path $AbsGit 'config'
        if (Test-Path -LiteralPath $gitConfig -PathType Leaf) { Process-Item -item (Get-Item -LiteralPath $gitConfig -Force -ErrorAction Stop) -depth 0 }
        $absHooksDir = Join-Path $AbsGit 'hooks'
        if (Test-Path -LiteralPath $absHooksDir) { Process-Item -item (Get-Item -LiteralPath $absHooksDir -Force -ErrorAction Stop) -depth 0 }
    }

    if (-not [string]::IsNullOrWhiteSpace($CommonGit) -and $CommonGit -ne $AbsGit -and (Test-Path -LiteralPath $CommonGit)) {
        $commonGitConfig = Join-Path $CommonGit 'config'
        if (Test-Path -LiteralPath $commonGitConfig -PathType Leaf) { Process-Item -item (Get-Item -LiteralPath $commonGitConfig -Force -ErrorAction Stop) -depth 0 }
        $commonHooksDir = Join-Path $CommonGit 'hooks'
        if (Test-Path -LiteralPath $commonHooksDir) { Process-Item -item (Get-Item -LiteralPath $commonHooksDir -Force -ErrorAction Stop) -depth 0 }
    }

    foreach ($pp in $ProtectedArr) {
        if (Test-Path -LiteralPath $pp) {
            $ppItem = Get-Item -LiteralPath $pp -Force -ErrorAction Stop
            Process-Item -item $ppItem -depth 0
        }
    }

    $sortedPaths = [System.Collections.Generic.List[string]]::new()
    foreach ($p in $state.SeenPaths) {
        if (Test-Path -LiteralPath $p -PathType Leaf) {
            $sortedPaths.Add($p)
        }
    }
    $sortedPaths.Sort([System.StringComparer]::OrdinalIgnoreCase)

    foreach ($p in $sortedPaths) {
        $dict[$p] = Get-FileSha256 -Path $p
    }

    return $dict
}

# 4. Resolve, Validate, and Hash PromptFile
$resolvedPromptFile = Resolve-AbsolutePath -Path $PromptFile
if (-not (Test-Path -LiteralPath $resolvedPromptFile -PathType Leaf)) {
    throw "PromptFile '$resolvedPromptFile' must exist and be a file."
}
$reparsePrompt = Test-ReparsePointPath -Path $resolvedPromptFile
if ($reparsePrompt) {
    throw "PromptFile component '$reparsePrompt' is a reparse point (junction/symlink)."
}
if (-not (Test-PathEqualsOrDescends -ChildPath $resolvedPromptFile -ParentPath $resolvedWorkspace)) {
    throw "PromptFile '$resolvedPromptFile' must be inside WorkspaceRoot '$resolvedWorkspace'."
}

$actualPromptSha256 = Get-FileSha256 -Path $resolvedPromptFile
if ($actualPromptSha256 -ne $canonExpectedPromptHash) {
    throw "Prompt SHA-256 mismatch. Expected '$canonExpectedPromptHash', got '$actualPromptSha256'."
}

# 5. Resolve Caller ProtectedPaths and Combine with PromptFile
$resolvedCallerProtectedPaths = @()
foreach ($pp in $ProtectedPaths) {
    if ([string]::IsNullOrWhiteSpace($pp)) { continue }
    $resPP = Resolve-AbsolutePath -Path $pp
    if (-not (Test-Path -LiteralPath $resPP)) {
        throw "ProtectedPath '$resPP' must exist."
    }
    $reparsePP = Test-ReparsePointPath -Path $resPP
    if ($reparsePP) {
        throw "ProtectedPath component '$reparsePP' is a reparse point (junction/symlink)."
    }
    if ($resolvedCallerProtectedPaths -notcontains $resPP) {
        $resolvedCallerProtectedPaths += $resPP
    }
}

$combinedProtectedPaths = @($resolvedPromptFile)
foreach ($pp in $resolvedCallerProtectedPaths) {
    if ($combinedProtectedPaths -notcontains $pp) {
        $combinedProtectedPaths += $pp
    }
}


$command_exit_codes = [ordered]@{}

# 3. Git Baseline, Branch, and Dirty State Probe
$oldLocation = Get-Location
try {
    Set-Location -LiteralPath $resolvedWorkspace

    $absGitDirRaw = (git rev-parse --absolute-git-dir 2>&1)
    $absGitDirExit = $LASTEXITCODE
    $command_exit_codes['pre_abs_git_dir'] = $absGitDirExit
    if ($absGitDirExit -ne 0) { throw "git rev-parse --absolute-git-dir failed: $absGitDirRaw" }
    $absGitDir = ($absGitDirRaw | Out-String).Trim()

    $commonGitDirRaw = (git rev-parse --git-common-dir 2>&1)
    $commonGitDirExit = $LASTEXITCODE
    $command_exit_codes['pre_common_git_dir'] = $commonGitDirExit
    if ($commonGitDirExit -ne 0) { throw "git rev-parse --git-common-dir failed: $commonGitDirRaw" }
    $commonGitDir = ($commonGitDirRaw | Out-String).Trim()
    if (-not [System.IO.Path]::IsPathRooted($commonGitDir)) {
        $commonGitDir = Resolve-AbsolutePath -Path (Join-Path $resolvedWorkspace $commonGitDir)
    }

    $preflightSnapshot = Get-GitCriticalSnapshot -WsPath $resolvedWorkspace -ProtectedArr $combinedProtectedPaths -AbsGit $absGitDir -CommonGit $commonGitDir

    $gitHeadRaw = (git rev-parse HEAD 2>&1)
    $gitHeadExit = $LASTEXITCODE
    $command_exit_codes['pre_rev_parse_head'] = $gitHeadExit
    if ($gitHeadExit -ne 0) { throw "git rev-parse HEAD failed: $gitHeadRaw" }
    $gitHead = ($gitHeadRaw | Out-String).Trim()

    $gitBranchRaw = (git rev-parse --abbrev-ref HEAD 2>&1)
    $gitBranchExit = $LASTEXITCODE
    $command_exit_codes['pre_rev_parse_branch'] = $gitBranchExit
    if ($gitBranchExit -ne 0) { throw "git rev-parse --abbrev-ref HEAD failed: $gitBranchRaw" }
    $gitBranch = ($gitBranchRaw | Out-String).Trim()

    $gitStatusRaw = (git status --porcelain -uno 2>&1)
    $gitStatusExit = $LASTEXITCODE
    $command_exit_codes['pre_status_uno'] = $gitStatusExit
    if ($gitStatusExit -ne 0) { throw "git status --porcelain -uno failed: $gitStatusRaw" }
    $gitStatus = ($gitStatusRaw | Out-String).TrimEnd("`r", "`n")

    $gitStatusUallRaw = (git status --porcelain -uall 2>&1)
    $gitStatusUallExit = $LASTEXITCODE
    $command_exit_codes['pre_status_uall'] = $gitStatusUallExit
    if ($gitStatusUallExit -ne 0) { throw "git status --porcelain -uall failed: $gitStatusUallRaw" }
    $gitStatusUall = ($gitStatusUallRaw | Out-String)

    $showRefRaw = (git show-ref 2>&1)
    $showRefExit = $LASTEXITCODE
    $command_exit_codes['pre_show_ref'] = $showRefExit
    if ($showRefExit -ne 0) { throw "git show-ref failed: $showRefRaw" }
    $refsLines = [System.Collections.Generic.List[string]]::new([string[]](($showRefRaw | Out-String) -split "`n" | Where-Object { $_.Trim() -ne '' }))
    $refsLines.Sort([System.StringComparer]::OrdinalIgnoreCase)
    $preflightSnapshot['GIT_REFS_DIGEST'] = Get-StringSha256 -Text ($refsLines -join "`n")

    $preExistingUntracked = @()
    foreach ($line in ($gitStatusUall -split '\r?\n' | Where-Object { $_ -ne "" })) {
        if ($line.StartsWith('?? ')) {
            $rel = $line.Substring(3).Trim()
            $parts = $rel -split '/'
            if ($parts -contains '.git' -or $parts -contains 'node_modules') { continue }
            $preExistingUntracked += $rel
            $abs = (Join-Path $resolvedWorkspace $rel).Replace('/', '\')
            if (Test-Path -LiteralPath $abs -PathType Leaf) {
                $preflightSnapshot[$abs] = (Get-FileSha256 -Path $abs)
            }
        }
    }
} finally {
    Set-Location -LiteralPath $oldLocation
}

if ($gitHead -ine $ExpectedBaselineHead) {
    throw "Git baseline HEAD mismatch. Expected '$ExpectedBaselineHead', got '$gitHead'."
}
if ($gitBranch -ine $ExpectedBranch) {
    throw "Git branch mismatch. Expected '$ExpectedBranch', got '$gitBranch'."
}

# 6. Resolve and Validate ProfileRoot
$resolvedProfileRoot = Resolve-AbsolutePath -Path $ProfileRoot
$reparseProf = Test-ReparsePointPath -Path $resolvedProfileRoot
if ($reparseProf) {
    throw "ProfileRoot component '$reparseProf' is a reparse point (junction/symlink)."
}
if (Test-PathOverlap -PathA $resolvedProfileRoot -PathB $resolvedWorkspace) {
    throw "ProfileRoot '$resolvedProfileRoot' cannot overlap with WorkspaceRoot '$resolvedWorkspace'."
}

if (Test-Path -LiteralPath $resolvedProfileRoot) {
    $existingProfItems = Get-ChildItem -LiteralPath $resolvedProfileRoot -Recurse -Force
    if ($existingProfItems.Count -gt 0) {
        if (-not $ReplaceEmptyGeneratedProfile) {
            throw "ProfileRoot '$resolvedProfileRoot' is nonempty. Use -ReplaceEmptyGeneratedProfile to replace if it only contains generated profile files."
        }
        $allowedProfileRel = @(
            '.gemini',
            '.gemini\antigravity-cli',
            '.gemini\antigravity-cli\settings.json',
            '.gemini\antigravity-cli\PROFILE_MANIFEST.json'
        )
        foreach ($item in $existingProfItems) {
            $relPath = $item.FullName.Substring($resolvedProfileRoot.Length).TrimStart('\', '/')
            if ($allowedProfileRel -notcontains $relPath) {
                throw "ProfileRoot '$resolvedProfileRoot' contains non-generated item '$relPath'."
            }
        }
    }
}

# 7. Resolve and Validate ReceiptRoot
$resolvedReceiptRoot = Resolve-AbsolutePath -Path $ReceiptRoot
$reparseReceipt = Test-ReparsePointPath -Path $resolvedReceiptRoot
if ($reparseReceipt) {
    throw "ReceiptRoot component '$reparseReceipt' is a reparse point (junction/symlink)."
}
if (Test-PathOverlap -PathA $resolvedReceiptRoot -PathB $resolvedWorkspace) {
    throw "ReceiptRoot '$resolvedReceiptRoot' cannot overlap with WorkspaceRoot '$resolvedWorkspace'."
}
if (Test-PathOverlap -PathA $resolvedReceiptRoot -PathB $resolvedProfileRoot) {
    throw "ReceiptRoot '$resolvedReceiptRoot' cannot overlap with ProfileRoot '$resolvedProfileRoot'."
}

if (Test-Path -LiteralPath $resolvedReceiptRoot) {
    $existingReceiptItems = Get-ChildItem -LiteralPath $resolvedReceiptRoot -Recurse -Force
    if ($existingReceiptItems.Count -gt 0) {
        if (-not $ReplaceEmptyGeneratedProfile) {
            throw "ReceiptRoot '$resolvedReceiptRoot' is nonempty."
        }
        $allowedReceiptRel = @(
            'RUN_STATE.md', 'COMMAND_LOG.md', 'HEARTBEAT.log', 'RESUME_PROMPT.md',
            'PR_MANIFEST.md', 'LAUNCH_CONTRACT.json', 'PROMPT.sha256',
            'NATIVE_EXIT.txt', 'VALIDATOR_EXIT.txt', 'MANIFEST.sha256',
            'POSTFLIGHT_SETTINGS_AUTHORITY.json', 'POSTFLIGHT_WORKSPACE_AUTHORITY.json',
            'stream.jsonl', 'stderr.log', 'verdict.json', 'log.txt'
        )
        foreach ($item in $existingReceiptItems) {
            $relPath = $item.FullName.Substring($resolvedReceiptRoot.Length).TrimStart('\', '/')
            if ($allowedReceiptRel -notcontains $relPath) {
                throw "ReceiptRoot '$resolvedReceiptRoot' contains non-receipt item '$relPath'."
            }
        }
    }
}

# 8. Resolve and Validate WritablePaths
if (-not $WritablePaths -or $WritablePaths.Count -eq 0) {
    throw "At least one WritablePath is required."
}
$resolvedWritablePaths = @()
foreach ($wp in $WritablePaths) {
    if ([string]::IsNullOrWhiteSpace($wp)) { continue }
    $resWP = Resolve-AbsolutePath -Path $wp
    if (-not (Test-PathEqualsOrDescends -ChildPath $resWP -ParentPath $resolvedWorkspace)) {
        throw "WritablePath '$resWP' must equal or descend from WorkspaceRoot '$resolvedWorkspace'."
    }
    $reparseWP = Test-ReparsePointPath -Path $resWP
    if ($reparseWP) {
        throw "WritablePath component '$reparseWP' is a reparse point (junction/symlink)."
    }
    if (Test-PathOverlap -PathA $resWP -PathB $resolvedReceiptRoot) {
        throw "WritablePath '$resWP' overlaps with protected ReceiptRoot '$resolvedReceiptRoot'."
    }
    if (Test-PathOverlap -PathA $resWP -PathB $resolvedProfileRoot) {
        throw "WritablePath '$resWP' overlaps with protected ProfileRoot '$resolvedProfileRoot'."
    }
    foreach ($cp in $combinedProtectedPaths) {
        if (Test-PathOverlap -PathA $resWP -PathB $cp) {
            throw "Overlap detected: WritablePath '$resWP' and protected path '$cp' conflict."
        }
    }
    if ($resolvedWritablePaths -notcontains $resWP) {
        $resolvedWritablePaths += $resWP
    }
}

# 8.5. Validate Tracked Dirty Continuation Contract
$isContinuationSupplied = ($null -ne $ExpectedTrackedDirtyPaths -and $ExpectedTrackedDirtyPaths.Count -gt 0) -or `
                          ($null -ne $ExpectedTrackedDirtySha256 -and $ExpectedTrackedDirtySha256.Count -gt 0)

$acceptedTrackedDirtyEntries = @()

if (-not $isContinuationSupplied) {
    if (-not [string]::IsNullOrWhiteSpace($gitStatus)) {
        throw "Workspace '$resolvedWorkspace' contains dirty tracked/staged files."
    }
} else {
    $pathsCount = if ($ExpectedTrackedDirtyPaths) { $ExpectedTrackedDirtyPaths.Count } else { 0 }
    $hashesCount = if ($ExpectedTrackedDirtySha256) { $ExpectedTrackedDirtySha256.Count } else { 0 }

    if ($pathsCount -ne $hashesCount -or $pathsCount -eq 0) {
        throw "Continuation inputs require equal nonzero counts for ExpectedTrackedDirtyPaths and ExpectedTrackedDirtySha256."
    }

    $canonExpectedDirtyHashes = @()
    foreach ($h in $ExpectedTrackedDirtySha256) {
        if ([string]::IsNullOrWhiteSpace($h) -or $h -notmatch '^[0-9a-fA-F]{64}$') {
            throw "Invalid continuation SHA-256 hash '$h'. Must be 64 hex characters."
        }
        $canonExpectedDirtyHashes += $h.ToLowerInvariant()
    }

    $expectedRelPathsMap = [ordered]@{}
    $expectedAbsPathsMap = [ordered]@{}
    $expectedHashMap = [ordered]@{}

    for ($i = 0; $i -lt $pathsCount; $i++) {
        $p = $ExpectedTrackedDirtyPaths[$i]
        $h = $canonExpectedDirtyHashes[$i]

        if ([string]::IsNullOrWhiteSpace($p)) {
            throw "Expected tracked dirty path at index $i cannot be empty."
        }

        $resP = Resolve-AbsolutePath -Path $p

        if (-not (Test-Path -LiteralPath $resP -PathType Leaf)) {
            throw "Expected tracked dirty path '$resP' must exist and be a file."
        }

        $reparseP = Test-ReparsePointPath -Path $resP
        if ($reparseP) {
            throw "Expected tracked dirty path component '$reparseP' is a reparse point (junction/symlink)."
        }

        if (-not (Test-PathEqualsOrDescends -ChildPath $resP -ParentPath $resolvedWorkspace)) {
            throw "Expected tracked dirty path '$resP' must be inside WorkspaceRoot '$resolvedWorkspace'."
        }

        if ($resP.TrimEnd('\', '/') -ieq $normWorkspace) {
            throw "Expected tracked dirty path '$resP' cannot be WorkspaceRoot."
        }

        $relP = $resP.Substring($normWorkspace.Length).TrimStart('\', '/').Replace('\', '/')
        $normKey = $relP.ToLowerInvariant()

        if ($expectedRelPathsMap.Contains($normKey)) {
            throw "Duplicate expected tracked dirty path '$resP' in continuation inputs."
        }

        $insideWritable = $false
        foreach ($wp in $resolvedWritablePaths) {
            if (Test-PathEqualsOrDescends -ChildPath $resP -ParentPath $wp) {
                $insideWritable = $true
                break
            }
        }
        if (-not $insideWritable) {
            throw "Expected tracked dirty path '$resP' is outside all WritablePaths scopes."
        }

        $expectedRelPathsMap[$normKey] = $relP
        $expectedAbsPathsMap[$normKey] = $resP
        $expectedHashMap[$normKey] = $h
    }

    $gitStatusLines = @($gitStatus -split '\r?\n' | Where-Object { $_ -ne "" })
    $liveRelPathsMap = [ordered]@{}

    foreach ($line in $gitStatusLines) {
        for ($c = 0; $c -lt $line.Length; $c++) {
            if ([int]$line[$c] -gt 127) {
                throw "Unexpected non-ASCII character in Git status output: '$line'."
            }
        }

        if ($line.Length -lt 4 -or $line[2] -ne ' ') {
            throw "Unexpected Git status line format: '$line'."
        }

        $idxStatus = $line[0]
        $wtStatus  = $line[1]
        $relPath   = $line.Substring(3).Trim()

        if ($idxStatus -ne ' ') {
            throw "Workspace '$resolvedWorkspace' contains staged changes in index. Staged changes are strictly rejected."
        }

        $allowedStatuses = @('M', 'A', 'D', 'R', 'C', 'U', ' ')
        if ($allowedStatuses -notcontains $idxStatus -or $allowedStatuses -notcontains $wtStatus) {
            throw "Unexpected Git status '$idxStatus$wtStatus' for '$relPath'."
        }

        if ($relPath.StartsWith('"') -or $relPath.EndsWith('"') -or $relPath.Contains(' -> ') -or $relPath.Contains('\')) {
            throw "Unexpected Git path representation in status output: '$relPath'."
        }

        $relPathStd = $relPath.Replace('\', '/')
        $normKey = $relPathStd.ToLowerInvariant()

        if ($liveRelPathsMap.Contains($normKey)) {
            throw "Duplicate live tracked dirty path '$relPath' reported by Git."
        }
        $liveRelPathsMap[$normKey] = $relPathStd
    }

    if ($liveRelPathsMap.Count -ne $expectedRelPathsMap.Count) {
        throw "Tracked dirty file count mismatch. Expected $($expectedRelPathsMap.Count) paths, got $($liveRelPathsMap.Count) live dirty paths."
    }

    foreach ($k in $expectedRelPathsMap.Keys) {
        if (-not $liveRelPathsMap.Contains($k)) {
            $expP = $expectedRelPathsMap[$k]
            throw "Expected tracked dirty path '$expP' was not found in live Git dirty state."
        }
    }

    foreach ($k in $liveRelPathsMap.Keys) {
        if (-not $expectedRelPathsMap.Contains($k)) {
            $liveP = $liveRelPathsMap[$k]
            throw "Live tracked dirty path '$liveP' was not present in expected continuation inputs."
        }
    }

    foreach ($k in $expectedRelPathsMap.Keys) {
        $absP = $expectedAbsPathsMap[$k]
        $expH = $expectedHashMap[$k]
        $actH = Get-FileSha256 -Path $absP
        if ($actH -ne $expH) {
            throw "Tracked dirty file SHA-256 mismatch for '$absP'. Expected '$expH', got '$actH'."
        }
    }

    $sortedKeys = @($expectedRelPathsMap.Keys) | Sort-Object
    foreach ($k in $sortedKeys) {
        $acceptedTrackedDirtyEntries += [ordered]@{
            path   = $expectedRelPathsMap[$k]
            sha256 = $expectedHashMap[$k]
        }
    }
}

# 9. Probe AGY Executable
$resolvedAgyExec = $null
if ([System.IO.Path]::IsPathRooted($AgyExecutable) -or $AgyExecutable.Contains('\') -or $AgyExecutable.Contains('/')) {
    if (Test-Path -LiteralPath $AgyExecutable -PathType Leaf) {
        $resolvedAgyExec = Resolve-AbsolutePath -Path $AgyExecutable
    }
} else {
    $cmd = Get-Command -Name $AgyExecutable -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
        $resolvedAgyExec = Resolve-AbsolutePath -Path $cmd.Source
    } elseif ($cmd -and $cmd.Path) {
        $resolvedAgyExec = Resolve-AbsolutePath -Path $cmd.Path
    }
}
if (-not $resolvedAgyExec -or -not (Test-Path -LiteralPath $resolvedAgyExec -PathType Leaf)) {
    throw "AGY executable '$AgyExecutable' could not be resolved to an existing file."
}

$reparseAgy = Test-ReparsePointPath -Path $resolvedAgyExec
if ($reparseAgy) {
    throw "AGY executable component '$reparseAgy' is a reparse point (junction/symlink)."
}

$versionOutput = & $resolvedAgyExec --version 2>&1
$versionExit = $LASTEXITCODE
if ($versionExit -ne 0) {
    throw "AGY executable version probe returned nonzero exit code '$versionExit'."
}
$versionStr = ($versionOutput | Out-String)
if ([string]::IsNullOrWhiteSpace($versionStr)) {
    throw "AGY version probe output is empty."
}
$versionLines = @($versionStr.Trim() -split '\r?\n' | Where-Object { $_ -ne "" })
if ($versionLines.Count -ne 1) {
    throw "AGY version probe returned multiline output."
}
$trimmedVersion = ([string]$versionLines[0]).Trim()
if ($trimmedVersion -ne $ExpectedAgyVersion) {
    throw "AGY version mismatch. Expected '$ExpectedAgyVersion', got '$trimmedVersion'."
}

# 9.5. Probe Node Executable and Validator Preflight
$resolvedNodeExec = $null
if ([System.IO.Path]::IsPathRooted($NodeExecutable) -or $NodeExecutable.Contains('\') -or $NodeExecutable.Contains('/')) {
    if (Test-Path -LiteralPath $NodeExecutable -PathType Leaf) {
        $resolvedNodeExec = Resolve-AbsolutePath -Path $NodeExecutable
    }
} else {
    $cmd = Get-Command -Name $NodeExecutable -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
        $resolvedNodeExec = Resolve-AbsolutePath -Path $cmd.Source
    } elseif ($cmd -and $cmd.Path) {
        $resolvedNodeExec = Resolve-AbsolutePath -Path $cmd.Path
    }
}
if (-not $resolvedNodeExec -or -not (Test-Path -LiteralPath $resolvedNodeExec -PathType Leaf)) {
    throw "Node executable '$NodeExecutable' could not be resolved to an existing file."
}

$reparseNode = Test-ReparsePointPath -Path $resolvedNodeExec
if ($reparseNode) {
    throw "Node executable component '$reparseNode' is a reparse point (junction/symlink)."
}

$nodeVersionOutput = & $resolvedNodeExec --version 2>&1
$nodeVersionExit = $LASTEXITCODE
if ($nodeVersionExit -ne 0) {
    throw "Node executable version probe returned nonzero exit code '$nodeVersionExit'."
}
$nodeVersionStr = ($nodeVersionOutput | Out-String)
if ([string]::IsNullOrWhiteSpace($nodeVersionStr)) {
    throw "Node version probe output is empty."
}
$nodeVersionLines = @($nodeVersionStr.Trim() -split '\r?\n' | Where-Object { $_ -ne "" })
if ($nodeVersionLines.Count -ne 1) {
    throw "Node version probe returned multiline output."
}
$trimmedNodeVersion = ([string]$nodeVersionLines[0]).Trim()

$validatorScript = Join-Path $scriptDir 'validate-agy-stream.mjs'
$resolvedValidatorScript = Resolve-AbsolutePath -Path $validatorScript
if (-not (Test-Path -LiteralPath $resolvedValidatorScript -PathType Leaf)) {
    throw "Validator script '$resolvedValidatorScript' must exist and be a file."
}
$reparseVal = Test-ReparsePointPath -Path $resolvedValidatorScript
if ($reparseVal) {
    throw "Validator script component '$reparseVal' is a reparse point (junction/symlink)."
}

$preflightOutput = & $resolvedNodeExec --check $resolvedValidatorScript 2>&1
$preflightExit = $LASTEXITCODE
if ($preflightExit -ne 0) {
    $preflightErrStr = ($preflightOutput | Out-String)
    throw "Validator preflight syntax check failed with exit code '$preflightExit'. Output: $preflightErrStr"
}

# 10. Invoke New-AgyExecutorProfile.ps1
$profileGenScript = Join-Path $scriptDir 'New-AgyExecutorProfile.ps1'
if (-not (Test-Path -LiteralPath $profileGenScript)) {
    throw "Generator script '$profileGenScript' not found."
}

$genParams = @{
    WorkspaceRoot      = [string]$resolvedWorkspace
    ProfileRoot        = [string]$resolvedProfileRoot
    WritablePaths      = [string[]]@($resolvedWritablePaths)
    ExpectedAgyVersion = [string]$ExpectedAgyVersion
    ExpectedModel      = [string]$ExpectedModel
    ExpectedEffort     = [string]$ExpectedEffort
    AllowedCommands    = [string[]]@($AllowedCommands)
    ProtectedPaths     = [string[]]@($combinedProtectedPaths)
}
if ($ReplaceEmptyGeneratedProfile) {
    $genParams['ReplaceEmptyGeneratedProfile'] = $true
}

& $profileGenScript @genParams
if ($LASTEXITCODE -ne 0) {
    throw "New-AgyExecutorProfile.ps1 failed to generate profile at '$resolvedProfileRoot'."
}

# 11. Read and Independently Verify PROFILE_MANIFEST.json and settings.json
$manifestPath = Join-Path $resolvedProfileRoot '.gemini\antigravity-cli\PROFILE_MANIFEST.json'
$settingsPath = Join-Path $resolvedProfileRoot '.gemini\antigravity-cli\settings.json'

if (-not (Test-Path -LiteralPath $manifestPath) -or -not (Test-Path -LiteralPath $settingsPath)) {
    throw "Generated profile missing manifest or settings file."
}

$actualSettingsHash = Get-FileSha256 -Path $settingsPath
$actualManifestHash = Get-FileSha256 -Path $manifestPath

$manifestJsonRaw = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8)
$manifestObj = ConvertFrom-Json -InputObject $manifestJsonRaw
if (-not $manifestObj) {
    throw "PROFILE_MANIFEST.json could not be parsed."
}

if ($manifestObj.expected_agy_version -ne $ExpectedAgyVersion) {
    throw "Manifest expected_agy_version mismatch."
}
if ($manifestObj.expected_model -ne $ExpectedModel) {
    throw "Manifest expected_model mismatch."
}
if ($manifestObj.expected_effort -ne $ExpectedEffort) {
    throw "Manifest expected_effort mismatch."
}
if (($manifestObj.workspace_root).TrimEnd('\', '/') -ne $normWorkspace) {
    throw "Manifest workspace_root mismatch."
}
if (($manifestObj.profile_root).TrimEnd('\', '/') -ne $resolvedProfileRoot.TrimEnd('\', '/')) {
    throw "Manifest profile_root mismatch."
}
if ($manifestObj.settings_sha256 -ne $actualSettingsHash) {
    throw "Manifest settings_sha256 mismatch. Expected '$actualSettingsHash', got '$($manifestObj.settings_sha256)'."
}

# Verify writable_paths array
$manifestWp = @($manifestObj.writable_paths)
if ($manifestWp.Count -ne $resolvedWritablePaths.Count) {
    throw "Manifest writable_paths count mismatch."
}
for ($i = 0; $i -lt $resolvedWritablePaths.Count; $i++) {
    if ($manifestWp[$i] -ne $resolvedWritablePaths[$i]) {
        throw "Manifest writable_paths element mismatch at index $i."
    }
}

# Verify allowed_commands array
$expectedCmds = @($AllowedCommands | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
$manifestCmd = @($manifestObj.allowed_commands)
if ($manifestCmd.Count -ne $expectedCmds.Count) {
    throw "Manifest allowed_commands count mismatch."
}
for ($i = 0; $i -lt $expectedCmds.Count; $i++) {
    if ($manifestCmd[$i] -ne $expectedCmds[$i]) {
        throw "Manifest allowed_commands element mismatch at index $i."
    }
}

# Verify protected_paths array
$manifestPp = @($manifestObj.protected_paths)
if ($manifestPp.Count -ne $combinedProtectedPaths.Count) {
    throw "Manifest protected_paths count mismatch."
}
for ($i = 0; $i -lt $combinedProtectedPaths.Count; $i++) {
    if ($manifestPp[$i] -ne $combinedProtectedPaths[$i]) {
        throw "Manifest protected_paths element mismatch at index $i."
    }
}

# Verify mandatory_protected_paths collection
$manifestMandatory = @($manifestObj.mandatory_protected_paths)
$seenMandatoryPaths = @()
foreach ($m in $manifestMandatory) {
    if (-not $m -or -not $m.path -or -not $m.mode) {
        throw "Mandatory protected path entry in manifest is missing path or mode."
    }
    if ([string]::IsNullOrWhiteSpace($m.path) -or -not [System.IO.Path]::IsPathRooted($m.path)) {
        throw "Mandatory protected path '$($m.path)' must be a nonempty absolute path."
    }
    if ($m.mode -ne 'read_write' -and $m.mode -ne 'write_only') {
        throw "Mandatory protected path '$($m.path)' has invalid mode '$($m.mode)'."
    }
    if ($seenMandatoryPaths -contains $m.path) {
        throw "Duplicate mandatory protected path '$($m.path)' found in manifest."
    }
    $seenMandatoryPaths += $m.path
}

# 12. Derive Validator Authority Arguments ONLY from PROFILE_MANIFEST.json
$derivedAllowedReadRoot = $manifestObj.workspace_root
$derivedAllowedWriteRoots = @($manifestObj.writable_paths)
$derivedAllowedCommands = @($manifestObj.allowed_commands)

$derivedDeniedReadRoots = @()
$derivedDeniedWriteRoots = @()

foreach ($pp in $manifestObj.protected_paths) {
    if ($derivedDeniedReadRoots -notcontains $pp) { $derivedDeniedReadRoots += $pp }
    if ($derivedDeniedWriteRoots -notcontains $pp) { $derivedDeniedWriteRoots += $pp }
}

foreach ($m in $manifestObj.mandatory_protected_paths) {
    $mPath = $m.path
    $mMode = $m.mode
    if ($mMode -eq 'read_write') {
        if ($derivedDeniedReadRoots -notcontains $mPath) { $derivedDeniedReadRoots += $mPath }
        if ($derivedDeniedWriteRoots -notcontains $mPath) { $derivedDeniedWriteRoots += $mPath }
    } elseif ($mMode -eq 'write_only') {
        if ($derivedDeniedWriteRoots -notcontains $mPath) { $derivedDeniedWriteRoots += $mPath }
    }
}

# 13. Initialize Receipt Directory and Controller Continuity Records
if (-not (Test-Path -LiteralPath $resolvedReceiptRoot)) {
    New-Item -ItemType Directory -Path $resolvedReceiptRoot -Force | Out-Null
}

Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'PROMPT.sha256') -Content $actualPromptSha256

$nowUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$runStateContent = @"
# AGY Autonomous Run State
- Timestamp: $nowUtc
- Status: INITIALIZING
- WorkspaceRoot: $resolvedWorkspace
- ProfileRoot: $resolvedProfileRoot
- ReceiptRoot: $resolvedReceiptRoot
- ExpectedBaselineHead: $ExpectedBaselineHead
- ExpectedBranch: $ExpectedBranch
- ExpectedAgyVersion: $ExpectedAgyVersion
- ExpectedModel: $ExpectedModel
- ExpectedEffort: $ExpectedEffort
- PromptHash: $actualPromptSha256
"@
Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'RUN_STATE.md') -Content $runStateContent

$cmdLogContent = @"
# AGY Command Log
[$nowUtc] INITIATING AGY WORKER
- Executable: $resolvedAgyExec
- Model: $ExpectedModel
- Effort: $ExpectedEffort
- Timeout: $PrintTimeout
"@
Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'COMMAND_LOG.md') -Content $cmdLogContent

Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'HEARTBEAT.log') -Content "[$nowUtc] INITIALIZING"

$resumePromptContent = @"
# AGY Resume Prompt
To resume or inspect run state:
- Workspace: $resolvedWorkspace
- Receipt Root: $resolvedReceiptRoot
- Prompt Hash: $actualPromptSha256
"@
Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'RESUME_PROMPT.md') -Content $resumePromptContent

Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'PR_MANIFEST.md') -Content "# PR Manifest`nStatus: Pending execution"

$launchContractObj = [ordered]@{
    workspace_root         = $resolvedWorkspace
    prompt_file            = $resolvedPromptFile
    prompt_sha256          = $actualPromptSha256
    profile_root           = $resolvedProfileRoot
    receipt_root           = $resolvedReceiptRoot
    writable_paths         = $resolvedWritablePaths
    protected_paths        = $combinedProtectedPaths
    tracked_dirty_files    = $acceptedTrackedDirtyEntries
    expected_baseline_head = $ExpectedBaselineHead
    expected_branch        = $ExpectedBranch
    expected_agy_version   = $ExpectedAgyVersion
    expected_model         = $ExpectedModel
    expected_effort        = $ExpectedEffort
    print_timeout          = $PrintTimeout
    allowed_commands       = $derivedAllowedCommands
    node_executable        = $resolvedNodeExec
    node_version           = $trimmedNodeVersion
    manifest_sha256        = $actualManifestHash
    settings_sha256        = $actualSettingsHash
}
$launchContractJson = ConvertTo-Json -InputObject $launchContractObj -Depth 10
Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'LAUNCH_CONTRACT.json') -Content $launchContractJson

# 14. Foreground Execution of AGY with Isolated USERPROFILE
$streamPath = Join-Path $resolvedReceiptRoot 'stream.jsonl'
$stderrPath = Join-Path $resolvedReceiptRoot 'stderr.log'
$logPath    = Join-Path $resolvedReceiptRoot 'log.txt'

$promptText = [System.IO.File]::ReadAllText($resolvedPromptFile, [System.Text.Encoding]::UTF8)

$agyArgs = @(
    '--model', $ExpectedModel,
    '--effort', $ExpectedEffort,
    '--mode', 'accept-edits',
    '--sandbox',
    '--output-format', 'stream-json',
    '--log-file', $logPath,
    '--print-timeout', $PrintTimeout,
    '-p', $promptText
)

# Update RUN_STATE to RUNNING before invocation
$runStateContent = $runStateContent.Replace('Status: INITIALIZING', 'Status: RUNNING')
Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'RUN_STATE.md') -Content $runStateContent
Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'HEARTBEAT.log') -Content "[$nowUtc] RUNNING"

$oldUserProfile = $env:USERPROFILE
$nativeExitCode = -1
$oldLocationForAgy = Get-Location
try {
    $env:USERPROFILE = $resolvedProfileRoot
    Set-Location -LiteralPath $resolvedWorkspace
    & $resolvedAgyExec @agyArgs > $streamPath 2> $stderrPath
    $nativeExitCode = $LASTEXITCODE
} finally {
    Set-Location -LiteralPath $oldLocationForAgy
    $env:USERPROFILE = $oldUserProfile
}

# Post-run Settings Authority Verification
$postRunSettingsHash = $null
$postflightStatus = 'MISMATCH'
try {
    if (Test-Path -LiteralPath $settingsPath -PathType Leaf) {
        $postRunSettingsHash = Get-FileSha256 -Path $settingsPath
        if ($postRunSettingsHash -eq $actualSettingsHash) {
            $postflightStatus = 'MATCH'
        }
    }
} catch {
    $postRunSettingsHash = $null
    $postflightStatus = 'MISMATCH'
}

$postflightObj = [ordered]@{
    pre_launch_sha256 = $actualSettingsHash
    post_run_sha256   = $postRunSettingsHash
    status            = $postflightStatus
}
$postflightJson = ConvertTo-Json -InputObject $postflightObj -Depth 10
Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'POSTFLIGHT_SETTINGS_AUTHORITY.json') -Content $postflightJson

if (-not (Test-Path -LiteralPath $streamPath)) {
    Write-LfFile -Path $streamPath -Content ""
}
if (-not (Test-Path -LiteralPath $stderrPath)) {
    Write-LfFile -Path $stderrPath -Content ""
}
if (-not (Test-Path -LiteralPath $logPath)) {
    Write-LfFile -Path $logPath -Content ""
}

Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'NATIVE_EXIT.txt') -Content ([string]$nativeExitCode)

# 15. Execute Receipt Validator
$valCliArgs = @(
    $resolvedValidatorScript,
    '--stream', $streamPath,
    '--stderr', $stderrPath,
    '--exit-code', [string]$nativeExitCode,
    '--expected-model', $manifestObj.expected_model,
    '--expected-cwd', $manifestObj.workspace_root,
    '--expected-status', 'SUCCESS',
    '--allowed-read-root', $derivedAllowedReadRoot
)
foreach ($w in $derivedAllowedWriteRoots) {
    $valCliArgs += @('--allowed-write-root', $w)
}
foreach ($c in $derivedAllowedCommands) {
    $valCliArgs += @('--allowed-command', $c)
}
foreach ($dr in $derivedDeniedReadRoots) {
    $valCliArgs += @('--denied-read-root', $dr)
}
foreach ($dw in $derivedDeniedWriteRoots) {
    $valCliArgs += @('--denied-write-root', $dw)
}

$valOutputRaw = & $resolvedNodeExec @valCliArgs 2>&1
$validatorExitCode = $LASTEXITCODE

Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'VALIDATOR_EXIT.txt') -Content ([string]$validatorExitCode)

$verdictText = ($valOutputRaw | Out-String).Trim()
Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'verdict.json') -Content $verdictText

# Parse Verdict Status
$verdictStatus = 'RED'
try {
    $verdictObj = ConvertFrom-Json -InputObject $verdictText
    if ($verdictObj -and $verdictObj.status) {
        $verdictStatus = $verdictObj.status
    }
} catch {
    $verdictStatus = 'RED'
}


# Post-run Git Integrity Verification
$postflightGitStatus = 'MATCH'
$gitReasonCodes = @()
$oldLocForGit = Get-Location

$postflightSnapshot = @{}
$sortedPreflightSnapshot = [ordered]@{}
$preflightKeys = [System.Collections.Generic.List[string]]::new([string[]]@($preflightSnapshot.Keys))
$preflightKeys.Sort([System.StringComparer]::OrdinalIgnoreCase)
foreach ($k in $preflightKeys) {
    $sortedPreflightSnapshot[$k] = $preflightSnapshot[$k]
}
$preflightSnapshot = $sortedPreflightSnapshot

$clonedExitCodes = [ordered]@{}
foreach ($k in $command_exit_codes.Keys) {
    $clonedExitCodes[$k] = $command_exit_codes[$k]
}

$postflightAuth = [ordered]@{
    pre_expected_head = $ExpectedBaselineHead
    command_exit_codes = $clonedExitCodes
    pre_expected_branch = $ExpectedBranch
    post_actual_head = $null
    post_actual_branch = $null
    worktree_git_dir = $absGitDir
    common_git_dir = $commonGitDir
    reason_codes = $gitReasonCodes
    command_failures = @()
    unauthorized_mutations = @()
    observed_status_paths = @()
    critical_path_hashes_pre = $preflightSnapshot
    critical_path_hashes_post = $null
    status = 'MATCH'
}

try {
    Set-Location -LiteralPath $resolvedWorkspace

    $postHeadRaw = (git rev-parse HEAD 2>&1)
    $postflightAuth.command_exit_codes['post_rev_parse_head'] = $LASTEXITCODE
    if ($LASTEXITCODE -ne 0) {
        $postflightGitStatus = 'MISMATCH_GIT_FAILURE'
        $gitReasonCodes += 'HEAD_PARSE_FAILED'
        $postflightAuth.command_failures += "git rev-parse HEAD failed"
    } else {
        $postHead = ($postHeadRaw | Out-String).Trim()
        $postflightAuth.post_actual_head = $postHead
        if ($postHead -ne $ExpectedBaselineHead) {
            $postflightGitStatus = 'MISMATCH_HEAD'
            $gitReasonCodes += 'MISMATCH_HEAD'
            $postflightAuth.unauthorized_mutations += "HEAD mutated"
        }
    }

    $postBranchRaw = (git rev-parse --abbrev-ref HEAD 2>&1)
    $postflightAuth.command_exit_codes['post_rev_parse_branch'] = $LASTEXITCODE
    if ($LASTEXITCODE -ne 0) {
        $postflightGitStatus = 'MISMATCH_GIT_FAILURE'
        $gitReasonCodes += 'BRANCH_PARSE_FAILED'
        $postflightAuth.command_failures += "git rev-parse --abbrev-ref HEAD failed"
    } else {
        $postBranch = ($postBranchRaw | Out-String).Trim()
        $postflightAuth.post_actual_branch = $postBranch
        if ($postBranch -ne $ExpectedBranch) {
            if ($postflightGitStatus -eq 'MATCH') { $postflightGitStatus = 'MISMATCH_BRANCH' }
            $gitReasonCodes += 'MISMATCH_BRANCH'
            $postflightAuth.unauthorized_mutations += "Branch mutated"
        }
    }

    $postShowRefRaw = (git show-ref 2>&1)
    $postflightAuth.command_exit_codes['post_show_ref'] = $LASTEXITCODE
    if ($LASTEXITCODE -ne 0) {
        $postflightGitStatus = 'MISMATCH_GIT_FAILURE'
        $gitReasonCodes += 'SHOW_REF_FAILED'
        $postflightAuth.command_failures += "git show-ref failed"
    } else {
        $refsLines = [System.Collections.Generic.List[string]]::new([string[]](($postShowRefRaw | Out-String) -split "`n" | Where-Object { $_.Trim() -ne '' }))
        $refsLines.Sort([System.StringComparer]::OrdinalIgnoreCase)
        $postflightSnapshot['GIT_REFS_DIGEST'] = Get-StringSha256 -Text ($refsLines -join "`n")
    }

    $tempSnapshot = Get-GitCriticalSnapshot -WsPath $resolvedWorkspace -ProtectedArr $combinedProtectedPaths -AbsGit $absGitDir -CommonGit $commonGitDir
    foreach ($k in $tempSnapshot.Keys) { $postflightSnapshot[$k] = $tempSnapshot[$k] }
    foreach ($rel in $preExistingUntracked) {
        $abs = (Join-Path $resolvedWorkspace $rel).Replace('/', '\')
        if (Test-Path -LiteralPath $abs -PathType Leaf) {
            $postflightSnapshot[$abs] = (Get-FileSha256 -Path $abs)
        }
    }
    foreach ($k in $preflightSnapshot.Keys) {
        if (-not $postflightSnapshot.Contains($k)) {
            if ($postflightGitStatus -eq 'MATCH') { $postflightGitStatus = 'MISMATCH_PROTECTED_STATE' }
            $gitReasonCodes += 'MISSING_PREFLIGHT_FILE'
            $postflightAuth.unauthorized_mutations += "Deleted: $k"
        } elseif ($preflightSnapshot[$k] -ne $postflightSnapshot[$k]) {
            if ($postflightGitStatus -eq 'MATCH') { $postflightGitStatus = 'MISMATCH_PROTECTED_STATE' }
            $gitReasonCodes += 'MODIFIED_PREFLIGHT_FILE'
            $postflightAuth.unauthorized_mutations += "Modified: $k"
        }
    }
    foreach ($k in $postflightSnapshot.Keys) {
        if (-not $preflightSnapshot.Contains($k)) {
            if ($postflightGitStatus -eq 'MATCH') { $postflightGitStatus = 'MISMATCH_PROTECTED_STATE' }
            $gitReasonCodes += 'NEW_PROTECTED_FILE'
            $postflightAuth.unauthorized_mutations += "Created: $k"
        }
    }

    $postStatusRaw = (git status --porcelain -uall 2>&1)
    $postflightAuth.command_exit_codes['post_status'] = $LASTEXITCODE
    if ($LASTEXITCODE -ne 0) {
        $postflightGitStatus = 'MISMATCH_GIT_FAILURE'
        $gitReasonCodes += 'STATUS_FAILED'
        $postflightAuth.command_failures += "git status failed"
    } else {
        $postStatusLines = ($postStatusRaw | Out-String) -split "`n" | Where-Object { $_.Trim() -ne '' }
        foreach ($line in $postStatusLines) {
            $isInvalid = $false
            for ($c = 0; $c -lt $line.Length; $c++) {
                if ([int]$line[$c] -gt 127) {
                    $isInvalid = $true; break
                }
            }
            if ($isInvalid) {
                if ($postflightGitStatus -eq 'MATCH') { $postflightGitStatus = 'MISMATCH_MODIFIED_PREFLIGHT_FILE' }
                $gitReasonCodes += 'MODIFIED_PREFLIGHT_FILE'
                $postflightAuth.unauthorized_mutations += "Non-ASCII character in Git status output: '$line'"
                continue
            }

            if ($line.Length -lt 4 -or $line[2] -ne ' ') {
                if ($postflightGitStatus -eq 'MATCH') { $postflightGitStatus = 'MISMATCH_MODIFIED_PREFLIGHT_FILE' }
                $gitReasonCodes += 'MODIFIED_PREFLIGHT_FILE'
                $postflightAuth.unauthorized_mutations += "Unexpected Git status line format: '$line'"
                continue
            }

            $idxStatus = $line[0]
            $wtStatus  = $line[1]
            $relPath = $line.Substring(3).Trim()

            $allowedStatuses = @('M', 'A', 'D', 'R', 'C', 'U', ' ', '?')
            if ($allowedStatuses -notcontains $idxStatus -or $allowedStatuses -notcontains $wtStatus) {
                if ($postflightGitStatus -eq 'MATCH') { $postflightGitStatus = 'MISMATCH_MODIFIED_PREFLIGHT_FILE' }
                $gitReasonCodes += 'MODIFIED_PREFLIGHT_FILE'
                $postflightAuth.unauthorized_mutations += "Unexpected Git status '$idxStatus$wtStatus' for '$relPath'"
                continue
            }

            if ($relPath.StartsWith('"') -or $relPath.EndsWith('"') -or $relPath.Contains(' -> ') -or $relPath.Contains('\')) {
                if ($postflightGitStatus -eq 'MATCH') { $postflightGitStatus = 'MISMATCH_MODIFIED_PREFLIGHT_FILE' }
                $gitReasonCodes += 'MODIFIED_PREFLIGHT_FILE'
                $postflightAuth.unauthorized_mutations += "Unexpected path representation: $relPath"
                continue
            }

            if ($idxStatus -ne ' ' -and $idxStatus -ne '?') {
                if ($postflightGitStatus -eq 'MATCH') { $postflightGitStatus = 'MISMATCH_STAGED_CHANGES' }
                $gitReasonCodes += 'STAGED_CHANGES'
                $postflightAuth.unauthorized_mutations += "Staged: $line"
                continue
            }
            $postflightAuth.observed_status_paths += $relPath
            $parts = $relPath -split '/'
            if ($parts -contains '.git' -or $parts -contains 'node_modules') { continue }
            $absPath = (Join-Path $resolvedWorkspace $relPath).Replace('/', '\')

            $wasExpectedDirty = $false
            if ($null -ne $acceptedTrackedDirtyEntries) {
                foreach ($dirty in $acceptedTrackedDirtyEntries) {
                    $dirtyAbs = (Join-Path $resolvedWorkspace $dirty.path).Replace('/', '\')
                    if ($absPath -eq $dirtyAbs) {
                        $wasExpectedDirty = $true
                        break
                    }
                }
            }
            if ($wasExpectedDirty) { continue }

            if ($postflightSnapshot.Contains($absPath)) { continue }

            $isAllowed = $false
            foreach ($w in $derivedAllowedWriteRoots) {
                if (Test-PathEqualsOrDescends -ChildPath $absPath -ParentPath $w) {
                    $isAllowed = $true
                    break
                }
            }

            if ($isAllowed) {
                foreach ($p in $combinedProtectedPaths) {
                    if (Test-PathEqualsOrDescends -ChildPath $absPath -ParentPath $p) {
                        $isAllowed = $false
                        break
                    }
                }
            }

            if (-not $isAllowed) {
                if ($postflightGitStatus -eq 'MATCH') { $postflightGitStatus = 'MISMATCH_DIRTY_OUTOFSCOPE' }
                $gitReasonCodes += 'OUTOFSCOPE_CHANGE'
                $postflightAuth.unauthorized_mutations += "Out of scope: $absPath"
            }
        }
    }
} catch {
    Write-Host "CATCH EXCEPTION: $($_)"
    Write-Host "STACKTRACE: $($_.ScriptStackTrace)"
    $postflightGitStatus = 'MISMATCH_GIT_ERROR'
    $gitReasonCodes += 'UNHANDLED_ERROR'
    $postflightAuth.command_failures += $_.Exception.Message
} finally {
    Set-Location -LiteralPath $oldLocForGit
}

$sortedPostflightSnapshot = [ordered]@{}
$postflightKeys = [System.Collections.Generic.List[string]]::new([string[]]@($postflightSnapshot.Keys))
$postflightKeys.Sort([System.StringComparer]::OrdinalIgnoreCase)
foreach ($k in $postflightKeys) {
    $sortedPostflightSnapshot[$k] = $postflightSnapshot[$k]
}
$postflightSnapshot = $sortedPostflightSnapshot

$postflightAuth.critical_path_hashes_post = $postflightSnapshot
$postflightAuth.reason_codes = $gitReasonCodes

if ($postflightGitStatus -ne 'MATCH') {
    $verdictStatus = 'RED'
    $postflightAuth.status = $postflightGitStatus
}


$postflightAuthJson = ConvertTo-Json -InputObject $postflightAuth -Depth 10
Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'POSTFLIGHT_WORKSPACE_AUTHORITY.json') -Content $postflightAuthJson


$termUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$isSuccess = ($nativeExitCode -eq 0) -and ($validatorExitCode -eq 0) -and ($verdictStatus -eq 'GREEN') -and ($postflightStatus -eq 'MATCH') -and ($postflightGitStatus -eq 'MATCH')

if ($isSuccess) {
    $runStateContent = $runStateContent.Replace('Status: RUNNING', 'Status: COMPLETED_GREEN')
    Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'RUN_STATE.md') -Content $runStateContent
    Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'HEARTBEAT.log') -Content "[$termUtc] COMPLETED_GREEN"
} else {
    $runStateContent = $runStateContent.Replace('Status: RUNNING', 'Status: COMPLETED_RED')
    Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'RUN_STATE.md') -Content $runStateContent
    Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'HEARTBEAT.log') -Content "[$termUtc] COMPLETED_RED"
}

# 16. Build Final MANIFEST.sha256 Receipt
$manifestLines = @()
$receiptFiles = Get-ChildItem -LiteralPath $resolvedReceiptRoot -Recurse -File -Force
foreach ($rf in $receiptFiles) {
    if ($rf.Name -eq 'MANIFEST.sha256') { continue }
    $rfRel = $rf.FullName.Substring($resolvedReceiptRoot.Length).TrimStart('\', '/').Replace('\', '/')
    $rfHash = Get-FileSha256 -Path $rf.FullName
    $manifestLines += "$rfHash  $rfRel"
}
$manifestLinesSorted = $manifestLines | Sort-Object
$manifestShaContent = ($manifestLinesSorted -join "`n") + "`n"
Write-LfFile -Path (Join-Path $resolvedReceiptRoot 'MANIFEST.sha256') -Content $manifestShaContent

if (-not $isSuccess) {
    if ($postflightGitStatus -ne 'MATCH') {
        throw "AGY autonomous worker execution failed closed due to post-run git integrity violation. Status=$postflightGitStatus. NativeExit=$nativeExitCode, ValidatorExit=$validatorExitCode, VerdictStatus=$verdictStatus."
    }
    if ($postflightStatus -ne 'MATCH') {
        throw "AGY autonomous worker execution failed closed due to post-run settings authority mismatch. PreLaunchHash=$actualSettingsHash, PostRunHash=$postRunSettingsHash, PostflightStatus=$postflightStatus. NativeExit=$nativeExitCode, ValidatorExit=$validatorExitCode, VerdictStatus=$verdictStatus."
    }
    throw "AGY autonomous worker execution failed closed. NativeExit=$nativeExitCode, ValidatorExit=$validatorExitCode, VerdictStatus=$verdictStatus."
}

Write-Host "AGY autonomous worker executed GREEN successfully."
