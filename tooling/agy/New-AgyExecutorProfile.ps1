<#
.SYNOPSIS
    Generates a fail-closed AGY 1.1.8 executor profile for SSTAC-Dashboard.
.DESCRIPTION
    Creates an isolated AGY profile directory containing settings.json and
    PROFILE_MANIFEST.json with fail-closed default permissions, mandatory protected
    paths, reparse-point validation, and caller-specified exact command rules.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$WorkspaceRoot,
    [Parameter(Mandatory = $true)][string]$ProfileRoot,
    [Parameter(Mandatory = $true)][string[]]$WritablePaths,
    [Parameter(Mandatory = $false)][string]$ExpectedAgyVersion = '1.1.8',
    [Parameter(Mandatory = $false)][string]$ExpectedModel = 'gemini-3.1-pro-high',
    [Parameter(Mandatory = $false)][string]$ExpectedEffort = 'high',
    [Parameter(Mandatory = $false)][string[]]$AllowedCommands = @(),
    [Parameter(Mandatory = $false)][string[]]$ProtectedPaths = @(),
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

# 1. Resolve and validate WorkspaceRoot
$resolvedWorkspace = Resolve-AbsolutePath -Path $WorkspaceRoot
$normWorkspace = $resolvedWorkspace.TrimEnd('\', '/')

if (-not (Test-Path -LiteralPath $resolvedWorkspace -PathType Container)) {
    throw "WorkspaceRoot '$resolvedWorkspace' must exist and be a directory."
}

# Walk from drive root through every component of WorkspaceRoot to check reparse points
$wsDriveRoot = [System.IO.Path]::GetPathRoot($resolvedWorkspace).TrimEnd('\', '/')
$wsRel = $resolvedWorkspace.Substring($wsDriveRoot.Length).TrimStart('\', '/')
$wsParts = $wsRel.Split([char[]]@('\', '/'), [System.StringSplitOptions]::RemoveEmptyEntries)
$currentWSPath = $wsDriveRoot
foreach ($part in $wsParts) {
    if ([string]::IsNullOrWhiteSpace($part)) { continue }
    $currentWSPath = Join-Path $currentWSPath $part
    if (Test-Path -LiteralPath $currentWSPath) {
        $item = Get-Item -LiteralPath $currentWSPath -Force
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            throw "WorkspaceRoot component '$currentWSPath' is a reparse point (junction/symlink)."
        }
    } else {
        break
    }
}

# Forbidden workspace roots check
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
$pathRoot = [System.IO.Path]::GetPathRoot($resolvedWorkspace).TrimEnd('\', '/')
if ($normWorkspace -ieq $pathRoot -or [string]::IsNullOrWhiteSpace($normWorkspace)) {
    throw "WorkspaceRoot '$WorkspaceRoot' cannot be a filesystem root."
}

# 2. Resolve and validate ProfileRoot
$resolvedProfile = Resolve-AbsolutePath -Path $ProfileRoot

# Walk from drive root through every component of ProfileRoot to check reparse points
$profDriveRoot = [System.IO.Path]::GetPathRoot($resolvedProfile).TrimEnd('\', '/')
$profRel = $resolvedProfile.Substring($profDriveRoot.Length).TrimStart('\', '/')
$profParts = $profRel.Split([char[]]@('\', '/'), [System.StringSplitOptions]::RemoveEmptyEntries)
$currentProfPath = $profDriveRoot
foreach ($part in $profParts) {
    if ([string]::IsNullOrWhiteSpace($part)) { continue }
    $currentProfPath = Join-Path $currentProfPath $part
    if (Test-Path -LiteralPath $currentProfPath) {
        $item = Get-Item -LiteralPath $currentProfPath -Force
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            throw "ProfileRoot component '$currentProfPath' is a reparse point (junction/symlink)."
        }
    } else {
        break
    }
}

if (Test-PathEqualsOrDescends -ChildPath $resolvedProfile -ParentPath $resolvedWorkspace) {
    throw "ProfileRoot '$resolvedProfile' cannot equal or descend from WorkspaceRoot '$resolvedWorkspace'."
}

# Check ProfileRoot contents if it exists
if (Test-Path -LiteralPath $resolvedProfile) {
    $existingItems = Get-ChildItem -LiteralPath $resolvedProfile -Recurse -Force
    if ($existingItems.Count -gt 0) {
        foreach ($item in $existingItems) {
            if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
                throw "ProfileRoot item '$($item.FullName)' inside '$resolvedProfile' is a reparse point (junction/symlink)."
            }
        }
        if (-not $ReplaceEmptyGeneratedProfile) {
            throw "ProfileRoot '$resolvedProfile' is nonempty. Use -ReplaceEmptyGeneratedProfile to replace if it only contains generated profile files."
        }
        $allowedRelativePaths = @(
            '.gemini',
            '.gemini\antigravity-cli',
            '.gemini\antigravity-cli\settings.json',
            '.gemini\antigravity-cli\PROFILE_MANIFEST.json'
        )
        foreach ($item in $existingItems) {
            $relPath = $item.FullName.Substring($resolvedProfile.Length).TrimStart('\', '/')
            if ($allowedRelativePaths -notcontains $relPath) {
                throw "ProfileRoot '$resolvedProfile' contains non-generated item '$relPath'."
            }
        }
    }
} else {
    New-Item -ItemType Directory -Path $resolvedProfile -Force | Out-Null
}

# 3. Resolve, validate, and check reparse points for WritablePaths
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

    # Walk from WorkspaceRoot through every existing path component to check reparse points
    $rel = $resWP.Substring($normWorkspace.Length).TrimStart('\', '/')
    $parts = $rel.Split([char[]]@('\', '/'), [System.StringSplitOptions]::RemoveEmptyEntries)
    $currentPath = $normWorkspace
    $nearestExistingAncestor = $normWorkspace

    foreach ($part in $parts) {
        if ([string]::IsNullOrWhiteSpace($part)) { continue }
        $currentPath = Join-Path $currentPath $part
        if (Test-Path -LiteralPath $currentPath) {
            $item = Get-Item -LiteralPath $currentPath -Force
            if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
                throw "WritablePath component '$currentPath' is a reparse point (junction/symlink)."
            }
            $nearestExistingAncestor = $currentPath
        } else {
            break
        }
    }

    if (-not (Test-Path -LiteralPath $resWP)) {
        $ancItem = Get-Item -LiteralPath $nearestExistingAncestor -Force
        if (-not $ancItem.PSIsContainer) {
            throw "Nearest existing ancestor '$nearestExistingAncestor' for WritablePath '$resWP' must be a directory."
        }
        if ($ancItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            throw "Nearest existing ancestor '$nearestExistingAncestor' for WritablePath '$resWP' cannot be a reparse point."
        }
        if (-not (Test-PathEqualsOrDescends -ChildPath $nearestExistingAncestor -ParentPath $resolvedWorkspace)) {
            throw "Nearest existing ancestor '$nearestExistingAncestor' must equal or descend from WorkspaceRoot '$resolvedWorkspace'."
        }
    }

    if ($resolvedWritablePaths -notcontains $resWP) {
        $resolvedWritablePaths += $resWP
    }
}
if ($resolvedWritablePaths.Count -eq 0) {
    throw "At least one valid WritablePath is required."
}

# 4. Mandatory Protected Paths Resolution (R2-2 & R3-3)
$mandatoryReadWriteRelPaths = @(
    '.git',
    'node_modules',
    'src/data',
    'supabase/migrations'
)

$mandatoryWriteOnlyRelPaths = @(
    'AGENTS.md',
    'CLAUDE.md',
    '.agents',
    '.claude',
    '.codex',
    '.gemini',
    '.mcp.json',
    'opencode.json',
    'package.json',
    'package-lock.json'
)

$mandatoryReadWritePaths = @()

# Dynamically enumerate every existing immediate child of WorkspaceRoot matching .env*
$envItems = Get-ChildItem -LiteralPath $resolvedWorkspace -Filter '.env*' -Force -ErrorAction SilentlyContinue
if ($envItems) {
    foreach ($item in $envItems) {
        $resFull = Resolve-AbsolutePath -Path $item.FullName
        if ($mandatoryReadWritePaths -notcontains $resFull) {
            $mandatoryReadWritePaths += $resFull
        }
    }
}

foreach ($rel in $mandatoryReadWriteRelPaths) {
    $full = Join-Path $resolvedWorkspace $rel
    if (Test-Path -LiteralPath $full) {
        $resFull = Resolve-AbsolutePath -Path $full
        if ($mandatoryReadWritePaths -notcontains $resFull) {
            $mandatoryReadWritePaths += $resFull
        }
    }
}

$mandatoryWriteOnlyPaths = @()
foreach ($rel in $mandatoryWriteOnlyRelPaths) {
    $full = Join-Path $resolvedWorkspace $rel
    if (Test-Path -LiteralPath $full) {
        $resFull = Resolve-AbsolutePath -Path $full
        if ($mandatoryWriteOnlyPaths -notcontains $resFull) {
            $mandatoryWriteOnlyPaths += $resFull
        }
    }
}

# 5. Caller ProtectedPaths Resolution
$resolvedCallerProtectedPaths = @()
foreach ($pp in $ProtectedPaths) {
    if ([string]::IsNullOrWhiteSpace($pp)) { continue }
    $resPP = Resolve-AbsolutePath -Path $pp
    if (-not (Test-Path -LiteralPath $resPP)) {
        throw "ProtectedPath '$resPP' must exist before emitting deny rules."
    }
    if ($resolvedCallerProtectedPaths -notcontains $resPP) {
        $resolvedCallerProtectedPaths += $resPP
    }
}

# 6. Overlap check between WritablePaths and all protected paths (mandatory + caller)
$allProtectedPathsForOverlap = @() + $mandatoryReadWritePaths + $mandatoryWriteOnlyPaths + $resolvedCallerProtectedPaths
foreach ($w in $resolvedWritablePaths) {
    foreach ($p in $allProtectedPathsForOverlap) {
        if ((Test-PathEqualsOrDescends -ChildPath $w -ParentPath $p) -or (Test-PathEqualsOrDescends -ChildPath $p -ParentPath $w)) {
            throw "Overlap detected: WritablePath '$w' and protected path '$p' conflict."
        }
    }
}

# 7. Validate caller-supplied AllowedCommands
$validatedAllows = @()
foreach ($cmd in $AllowedCommands) {
    if ([string]::IsNullOrWhiteSpace($cmd)) { continue }

    if ($cmd -match '[\*\?\&\|\<\>\;\%\$\`\r\n]') {
        throw "Allowed command '$cmd' contains forbidden characters (wildcards, shell operators, redirection, variables, or newlines)."
    }

    $isMatch = $false
    if ($cmd -eq 'npx --no-install tsc --noEmit') {
        $isMatch = $true
    } elseif ($cmd -match '^cmd /d /c echo [A-Za-z0-9_\-]+$') {
        $isMatch = $true
    } elseif ($cmd -match '^node (?:\./)?(?:[A-Za-z0-9_\-\.]+/)*[A-Za-z0-9_\-\.]+\.mjs(?: [A-Za-z0-9_\-\./:\\]+)*$') {
        if ($cmd -notmatch '\.\.') {
            $isMatch = $true
        }
    } elseif ($cmd -match '^npm run [A-Za-z0-9_\-:]+(?: [A-Za-z0-9_\-\./:\\]+)*$') {
        $isMatch = $true
    }

    if (-not $isMatch) {
        throw "Allowed command '$cmd' does not conform to the permitted grammar."
    }

    $validatedAllows += $cmd
}

# 8. Build permissions allow array (strings)
$allowRules = @()
$allowRules += "read_file($resolvedWorkspace)"

foreach ($w in $resolvedWritablePaths) {
    $allowRules += "write_file($w)"
}

foreach ($cmd in $validatedAllows) {
    $allowRules += "command($cmd)"
}

# 9. Build permissions deny array (strings)
$mandatoryDenyCommands = @(
    'git', 'gh', 'supabase', 'psql', 'vercel', 'docker', 'agy', 'claude', 'codex',
    'agent', 'opencode', 'ollama', 'Remove-Item', 'rm', 'rmdir', 'del', 'erase',
    'robocopy', 'rimraf', 'taskkill', 'Stop-Process', 'Start-Process', 'Start-Job',
    'format', 'diskpart', 'shutdown', 'Restart-Computer', 'reg', 'schtasks', 'sc',
    'icacls', 'takeown', 'curl', 'wget', 'Invoke-WebRequest', 'Invoke-RestMethod',
    'ssh', 'scp', 'sftp', 'npm install', 'npm ci', 'npm publish', 'pnpm install',
    'pnpm add', 'yarn install', 'yarn add', 'pip install', 'winget', 'choco', 'scoop'
)

$denyRules = @()
foreach ($denyCmd in $mandatoryDenyCommands) {
    $denyRules += "command($denyCmd)"
}

$denyRules += 'read_url(*)'
$denyRules += 'execute_url(*)'
$denyRules += 'mcp(*)'

if ($validatedAllows.Count -eq 0) {
    $denyRules += 'command(*)'
}

# Add mandatory read-and-write deny paths
foreach ($p in $mandatoryReadWritePaths) {
    $denyRules += "read_file($p)"
    $denyRules += "write_file($p)"
}

# Add mandatory write-deny-only paths
foreach ($p in $mandatoryWriteOnlyPaths) {
    $denyRules += "write_file($p)"
}

# Add caller protected paths (read-and-write deny)
foreach ($p in $resolvedCallerProtectedPaths) {
    $denyRules += "read_file($p)"
    $denyRules += "write_file($p)"
}

# Ensure deny rules are unique
$denyRules = $denyRules | Select-Object -Unique

# 10. Build settings object
$settingsObj = [ordered]@{
    artifactReviewPolicy    = 'always-proceed'
    enableTelemetry         = $false
    permissions             = [ordered]@{
        allow = $allowRules
        deny  = $denyRules
    }
}

# Convert settings to deterministic UTF-8 JSON with LF endings
$settingsJson = ConvertTo-Json -InputObject $settingsObj -Depth 10
$settingsJsonLF = $settingsJson.Replace("`r`n", "`n") + "`n"

# Compute SHA-256 of settings JSON
$settingsBytes = [System.Text.Encoding]::UTF8.GetBytes($settingsJsonLF)
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$hashBytes = $sha256.ComputeHash($settingsBytes)
$settingsSha256 = ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()

# Write settings.json
$targetDir = Join-Path $resolvedProfile '.gemini\antigravity-cli'
if (-not (Test-Path -LiteralPath $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}
$settingsPath = Join-Path $targetDir 'settings.json'
[System.IO.File]::WriteAllText($settingsPath, $settingsJsonLF, [System.Text.UTF8Encoding]::new($false))

# 11. Build and write PROFILE_MANIFEST.json
$mandatoryManifestEntries = @()
foreach ($p in $mandatoryReadWritePaths) {
    $mandatoryManifestEntries += [ordered]@{
        path = $p
        mode = 'read_write'
    }
}
foreach ($p in $mandatoryWriteOnlyPaths) {
    $mandatoryManifestEntries += [ordered]@{
        path = $p
        mode = 'write_only'
    }
}

$manifestObj = [ordered]@{
    schema_version             = '1.0.0'
    generation_timestamp       = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.FFFFFFFZ")
    generator_version          = '1.1.8-bootstrap'
    expected_agy_version       = $ExpectedAgyVersion
    expected_model             = $ExpectedModel
    expected_effort            = $ExpectedEffort
    workspace_root             = $resolvedWorkspace
    profile_root               = $resolvedProfile
    writable_paths             = @($resolvedWritablePaths)
    allowed_commands           = @($validatedAllows)
    protected_paths            = @($resolvedCallerProtectedPaths)
    mandatory_protected_paths  = @($mandatoryManifestEntries)
    settings_sha256            = $settingsSha256
    not_os_level_containment   = $true
}

$manifestJson = ConvertTo-Json -InputObject $manifestObj -Depth 10
$manifestJsonLF = $manifestJson.Replace("`r`n", "`n") + "`n"
$manifestPath = Join-Path $targetDir 'PROFILE_MANIFEST.json'
[System.IO.File]::WriteAllText($manifestPath, $manifestJsonLF, [System.Text.UTF8Encoding]::new($false))

Write-Host "AGY executor profile successfully created at $resolvedProfile"
