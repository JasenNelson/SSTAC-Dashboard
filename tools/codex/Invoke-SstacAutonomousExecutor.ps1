[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$WorktreePath,

    [Parameter(Mandatory = $true)]
    [string]$ExpectedBranch,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F]{40}$')]
    [string]$BaseSha,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F]{40}$')]
    [string]$OriginMainSha,

    [Parameter(Mandatory = $true)]
    [string]$RunRoot,

    [Parameter(Mandatory = $true)]
    [string]$ControllerRoot,

    [Parameter(Mandatory = $true)]
    [string]$MissionControlReceiptPath,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F]{64}$')]
    [string]$MissionControlReceiptSha256,

    [ValidateRange(1, 60)]
    [int]$MissionControlReceiptMaxAgeMinutes = 15,

    [string]$ApprovedBaselineAuthorizationPath,

    [ValidatePattern('^[0-9a-fA-F]{64}$')]
    [string]$ApprovedBaselineAuthorizationSha256,

    [ValidateRange(1, 60)]
    [int]$ApprovedBaselineAuthorizationMaxAgeMinutes = 15,

    [Parameter(Mandatory = $true)]
    [string[]]$AllowedPath,

    [Parameter(Mandatory = $true)]
    [string]$PromptSourcePath,

    [string]$CodexPath = 'codex.exe',

    [switch]$PrepareOnly,

    [switch]$Ephemeral,

    [ValidateSet('None', 'Positive', 'UnexpectedEdit')]
    [string]$RealExecutorCanary = 'None',

    [switch]$NoModelAcceptanceCanary,

    [switch]$RuntimeAuditOnly,

    [string]$RuntimeAuditTestEventsPath,

    [string[]]$RuntimeAuditTestEventJson = @(),

    [string[]]$RuntimeAuditTestActivePath = @(),

    [string[]]$RuntimeAuditTestSecretPath = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$PrimaryCheckout = 'C:\Projects\SSTAC-Dashboard'
$ControllerAllowedRoot = 'C:\tmp'
$ExpectedOriginUrl = 'https://github.com/JasenNelson/SSTAC-Dashboard.git'
$RulesRelativePath = '.codex\rules\autonomous-executor.rules'
$GeneratedArtifactRoots = @(
    '.tmp',
    '.next',
    'coverage',
    'playwright-report',
    'test-results'
)
$ProtectedIgnoredPrefixes = @(
    '.codex/',
    '.env',
    'wiki/',
    'node_modules/',
    'supabase/migrations/',
    'src/data/'
)
$RequiredGates = @(
    'npm run lint',
    'npx tsc --noEmit',
    'npm run test:ci',
    'npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10',
    'npm run test:e2e',
    'npm run docs:gate'
)

function Get-CanonicalPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [switch]$MustExist
    )

    if (-not [IO.Path]::IsPathFullyQualified($Path)) {
        throw "Path must be absolute: $Path"
    }

    $full = [IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
    if ($MustExist -and -not (Test-Path -LiteralPath $full)) {
        throw "Required path does not exist: $full"
    }
    return $full
}

function Test-SamePath {
    param([string]$Left, [string]$Right)
    return [string]::Equals(
        (Get-CanonicalPath -Path $Left),
        (Get-CanonicalPath -Path $Right),
        [StringComparison]::OrdinalIgnoreCase
    )
}

function Test-ChildPath {
    param([string]$Child, [string]$Parent)
    $childFull = (Get-CanonicalPath -Path $Child) + '\'
    $parentFull = (Get-CanonicalPath -Path $Parent) + '\'
    return $childFull.StartsWith($parentFull, [StringComparison]::OrdinalIgnoreCase)
}

function Assert-NoReparsePointInExistingChain {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Candidate,
        [Parameter(Mandatory = $true)]
        [string]$Boundary
    )

    $candidateFull = Get-CanonicalPath -Path $Candidate
    $boundaryFull = Get-CanonicalPath -Path $Boundary -MustExist
    if (-not (Test-SamePath -Left $candidateFull -Right $boundaryFull) -and
        -not (Test-ChildPath -Child $candidateFull -Parent $boundaryFull)) {
        throw "Path escapes its required boundary: $candidateFull"
    }

    $cursor = $candidateFull
    while (-not (Test-Path -LiteralPath $cursor)) {
        $parent = Split-Path -Parent $cursor
        if (-not $parent -or (Test-SamePath -Left $parent -Right $cursor)) {
            throw "Unable to resolve existing path chain: $candidateFull"
        }
        $cursor = $parent
    }

    while ($true) {
        $item = Get-Item -Force -LiteralPath $cursor
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Path chain contains a reparse point: $cursor"
        }
        if (Test-SamePath -Left $cursor -Right $boundaryFull) {
            break
        }
        $cursor = Split-Path -Parent $cursor
        if (-not $cursor) {
            throw "Path chain did not reach its required boundary: $candidateFull"
        }
    }
}

function Resolve-CodexIdentity {
    param([Parameter(Mandatory = $true)][string]$RequestedPath)

    $commands = @(
        Get-Command -Name $RequestedPath -CommandType Application -All -ErrorAction Stop
    )
    if ($commands.Count -ne 1) {
        throw "Codex executable resolution is missing or ambiguous: $RequestedPath"
    }
    $resolved = Get-CanonicalPath -Path $commands[0].Path -MustExist
    if ([IO.Path]::GetFileName($resolved) -cne 'codex.exe') {
        throw "CodexPath must resolve to codex.exe, found: $resolved"
    }

    $versionOutput = @(& $resolved --version 2>$null)
    if ($LASTEXITCODE -ne 0 -or
        $versionOutput.Count -ne 1 -or
        [string]$versionOutput[0] -notmatch '^codex-cli [0-9]+\.[0-9]+\.[0-9]+$') {
        throw 'Unable to verify the selected Codex executable and version.'
    }

    return [ordered]@{
        path = $resolved
        version = [string]$versionOutput[0]
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolved).Hash.ToLowerInvariant()
    }
}

function Get-McpInventory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Executable,
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [string[]]$ConfigArguments
    )

    $json = @(
        & $Executable -C $script:ResolvedWorktree @ConfigArguments mcp list --json 2>$null
    )
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to inspect the effective Codex MCP configuration.'
    }
    try {
        return @(($json -join "`n") | ConvertFrom-Json -DateKind String)
    } catch {
        throw 'Unable to parse the effective Codex MCP configuration.'
    }
}

function ConvertTo-TomlBasicString {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)

    $escaped = $Value.
        Replace('\', '\\').
        Replace('"', '\"').
        Replace("`b", '\b').
        Replace("`t", '\t').
        Replace("`n", '\n').
        Replace("`f", '\f').
        Replace("`r", '\r')
    return '"' + $escaped + '"'
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = @(& git -C $script:ResolvedWorktree @Arguments 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git -C $script:ResolvedWorktree $($Arguments -join ' ')`n$($output -join "`n")"
    }
    return $output
}

function Invoke-GitWithAllowedExitCode {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [Parameter(Mandatory = $true)]
        [int[]]$AllowedExitCode
    )

    $output = @(& git -C $script:ResolvedWorktree @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
    if ($AllowedExitCode -notcontains $exitCode) {
        throw "Git command failed: git -C $script:ResolvedWorktree $($Arguments -join ' ')`n$($output -join "`n")"
    }
    return [PSCustomObject]@{
        ExitCode = $exitCode
        Output = @($output)
    }
}

function Write-AsciiText {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Value
    )
    [IO.File]::WriteAllText($Path, $Value, [Text.Encoding]::ASCII)
}

function Write-JsonReceipt {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [object]$Value
    )
    $json = $Value | ConvertTo-Json -Depth 12
    Write-AsciiText -Path $Path -Value ($json + "`n")
}

function Get-ChangedPathInventory {
    $tracked = @(Invoke-Git -Arguments @('diff', '--name-only', '--'))
    $staged = @(Invoke-Git -Arguments @('diff', '--cached', '--name-only', '--'))
    $untracked = @(Invoke-Git -Arguments @('ls-files', '--others', '--exclude-standard'))
    return @($tracked + $staged + $untracked | Where-Object { $_ } | Sort-Object -Unique)
}

function Assert-AsciiFile {
    param([string]$RelativePath)
    $absolute = Join-Path $script:ResolvedWorktree $RelativePath
    if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) {
        return
    }
    foreach ($byte in [IO.File]::ReadAllBytes($absolute)) {
        if ($byte -gt 127) {
            throw "Agent-authored file is not plain ASCII: $RelativePath"
        }
    }
}

function Test-NonEmptyAsciiFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $false
    }
    $item = Get-Item -LiteralPath $Path
    if ($item.Length -lt 1) {
        return $false
    }
    foreach ($byte in [IO.File]::ReadAllBytes($Path)) {
        if ($byte -gt 127) {
            return $false
        }
    }
    return $true
}

function Test-SafeGateLogPath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    if (-not $RelativePath -or
        [IO.Path]::IsPathFullyQualified($RelativePath) -or
        $RelativePath.StartsWith('\') -or
        $RelativePath.StartsWith('/') -or
        $RelativePath.Contains('..') -or
        $RelativePath.Contains(':') -or
        $RelativePath.IndexOfAny([char[]]'*?[]') -ge 0) {
        return $false
    }
    $normalized = $RelativePath.Replace('\', '/')
    $allowedArtifactRoot = @(
        '.tmp/',
        'coverage/',
        'playwright-report/',
        'test-results/'
    ) | Where-Object {
        $normalized.StartsWith($_, [StringComparison]::OrdinalIgnoreCase)
    }
    if (-not $allowedArtifactRoot) {
        return $false
    }
    $absolute = [IO.Path]::GetFullPath((Join-Path $script:ResolvedWorktree $RelativePath))
    if (-not (Test-ChildPath -Child $absolute -Parent $script:ResolvedWorktree)) {
        return $false
    }
    return (Test-Path -LiteralPath $absolute -PathType Leaf) -and
        (Get-Item -LiteralPath $absolute).Length -gt 0
}

function Assert-ExactJsonProperties {
    param(
        [Parameter(Mandatory = $true)][object]$Object,
        [Parameter(Mandatory = $true)][string[]]$Names,
        [Parameter(Mandatory = $true)][string]$Context
    )

    if ($null -eq $Object) {
        throw "$Context is null."
    }
    $actual = @($Object.PSObject.Properties.Name | Sort-Object)
    $expected = @($Names | Sort-Object)
    $missing = @($expected | Where-Object { $actual -cnotcontains $_ })
    $extra = @($actual | Where-Object { $expected -cnotcontains $_ })
    if ($missing.Count -ne 0 -or $extra.Count -ne 0) {
        throw "$Context has missing or unexpected properties. Missing=[$($missing -join ',')] Extra=[$($extra -join ',')]"
    }
}

function Get-RequiredJsonProperty {
    param(
        [Parameter(Mandatory = $true)][object]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Context
    )

    if ($null -eq $Object -or $Object.PSObject.Properties.Name -cnotcontains $Name) {
        throw "$Context is missing required property: $Name"
    }
    return $Object.$Name
}

function ConvertFrom-StrictUtcTimestamp {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value,
        [Parameter(Mandatory = $true)][string]$Context
    )

    if ($Value -notmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$') {
        throw "$Context is not an unambiguous UTC timestamp: $Value"
    }
    $parsed = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse(
            $Value,
            [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::AssumeUniversal,
            [ref]$parsed
        )) {
        throw "$Context cannot be parsed as UTC: $Value"
    }
    return $parsed.ToUniversalTime()
}

function Get-AsciiSha256 {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)

    $bytes = [Text.Encoding]::ASCII.GetBytes($Value)
    $hash = [Security.Cryptography.SHA256]::HashData($bytes)
    return ([Convert]::ToHexString($hash)).ToLowerInvariant()
}

function New-ForbiddenRuntimeTarget {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('active_worktree', 'secret_path')][string]$Kind,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $canonical = Get-CanonicalPath -Path $Path
    return [ordered]@{
        kind = $Kind
        canonical_path = $canonical
        path_sha256 = Get-AsciiSha256 -Value $canonical.ToLowerInvariant()
    }
}

function ConvertTo-ComparableCommandPathText {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)

    $normalized = $Value.Replace('/', '\')
    $normalized = $normalized.Replace('\\?\UNC\', '\\')
    $normalized = $normalized.Replace('\\?\', '')
    $normalized = $normalized.Replace('\??\', '')
    return $normalized
}

function Get-ForbiddenRuntimeTargetFindings {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Command,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$ForbiddenTargets
    )

    $comparableCommand = ConvertTo-ComparableCommandPathText -Value $Command
    $findings = @()
    foreach ($target in $ForbiddenTargets) {
        $comparableTarget = ConvertTo-ComparableCommandPathText -Value ([string]$target.canonical_path)
        $searchStart = 0
        while ($searchStart -lt $comparableCommand.Length) {
            $index = $comparableCommand.IndexOf(
                $comparableTarget,
                $searchStart,
                [StringComparison]::OrdinalIgnoreCase
            )
            if ($index -lt 0) {
                break
            }
            $beforeOk = $index -eq 0
            if (-not $beforeOk) {
                $before = $comparableCommand[$index - 1]
                $beforeOk = -not [char]::IsLetterOrDigit($before) -and $before -notin @('_', '-', '.')
            }
            $afterIndex = $index + $comparableTarget.Length
            $afterOk = $afterIndex -eq $comparableCommand.Length
            if (-not $afterOk) {
                $after = $comparableCommand[$afterIndex]
                $afterOk = [char]::IsWhiteSpace($after) -or
                    $after -in @('\', '"', "'", ';', ',', '&', '|', '(', ')', '[', ']', '{', '}', '=', ':')
            }
            if ($beforeOk -and $afterOk) {
                $findings += [ordered]@{
                    target_kind = [string]$target.kind
                    target_path_sha256 = [string]$target.path_sha256
                    match_kind = if ($afterIndex -lt $comparableCommand.Length -and
                        $comparableCommand[$afterIndex] -eq '\') {
                        'target_or_descendant'
                    } else {
                        'exact_target'
                    }
                }
                break
            }
            $searchStart = $index + 1
        }
    }
    return @($findings)
}

function Get-FileEvidence {
    param(
        [Parameter(Mandatory = $true)][string]$AbsolutePath,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    if (-not (Test-Path -LiteralPath $AbsolutePath -PathType Leaf)) {
        throw "Evidence file is missing: $RelativePath"
    }
    $item = Get-Item -LiteralPath $AbsolutePath
    if ($item.Length -lt 1) {
        throw "Evidence file is empty: $RelativePath"
    }
    return [ordered]@{
        path = $RelativePath.Replace('\', '/')
        bytes = [long]$item.Length
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $AbsolutePath).Hash.ToLowerInvariant()
    }
}

function Get-IgnoredSurfaceSnapshot {
    $arguments = @(
        '-c', 'core.quotePath=false',
        'ls-files', '--others', '--ignored', '--exclude-standard', '--', '.'
    )
    foreach ($root in $GeneratedArtifactRoots) {
        $arguments += ":(exclude)$root"
        $arguments += ":(exclude)$root/**"
    }
    # node_modules is not exempt from verification. Git traversal is suppressed
    # because it may be a shared junction; exact link metadata is audited separately.
    $arguments += ':(exclude)node_modules'
    $arguments += ':(exclude)node_modules/**'

    $paths = @(Invoke-Git -Arguments $arguments)
    $entries = @()
    foreach ($rawPath in @($paths | Where-Object { $_ } | Sort-Object -Unique)) {
        $relative = ([string]$rawPath).Replace('\', '/')
        if ($relative.StartsWith('"') -or
            [IO.Path]::IsPathFullyQualified($relative) -or
            $relative.StartsWith('/') -or
            $relative.Contains('..') -or
            $relative.Contains(':')) {
            throw "Ignored path cannot be represented unambiguously: $rawPath"
        }
        $absolute = [IO.Path]::GetFullPath((Join-Path $script:ResolvedWorktree $relative))
        if (-not (Test-ChildPath -Child $absolute -Parent $script:ResolvedWorktree)) {
            throw "Ignored path escapes the worktree: $relative"
        }
        Assert-NoReparsePointInExistingChain -Candidate $absolute -Boundary $script:ResolvedWorktree
        if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) {
            throw "Ignored inventory entry is not a regular file: $relative"
        }
        $item = Get-Item -LiteralPath $absolute
        $entries += [ordered]@{
            path = $relative
            bytes = [long]$item.Length
            sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $absolute).Hash.ToLowerInvariant()
        }
    }
    $binding = @($entries | ForEach-Object { "$($_.path)|$($_.bytes)|$($_.sha256)" }) -join "`n"
    return [ordered]@{
        schema_version = 1
        generated_artifact_exclusions = @($GeneratedArtifactRoots)
        node_modules_verification = 'exact-junction-metadata-separate'
        entries = @($entries)
        inventory_sha256 = Get-AsciiSha256 -Value $binding
    }
}

function Compare-IgnoredSurfaceSnapshot {
    param(
        [Parameter(Mandatory = $true)][object]$Before,
        [Parameter(Mandatory = $true)][object]$After
    )

    $beforeByPath = @{}
    foreach ($entry in @($Before.entries)) {
        $beforeByPath[[string]$entry.path] = "$($entry.bytes)|$($entry.sha256)"
    }
    $afterByPath = @{}
    foreach ($entry in @($After.entries)) {
        $afterByPath[[string]$entry.path] = "$($entry.bytes)|$($entry.sha256)"
    }
    $allPaths = @($beforeByPath.Keys + $afterByPath.Keys | Sort-Object -Unique)
    return @(
        $allPaths | Where-Object {
            -not $beforeByPath.ContainsKey($_) -or
            -not $afterByPath.ContainsKey($_) -or
            $beforeByPath[$_] -cne $afterByPath[$_]
        }
    )
}

function Test-ForbiddenCommandText {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Command)

    $directPattern = '(?i)(^|[\s"''=;&|])(?:[A-Z]:\\[^\s"'']*\\)?(?:git(?:\.exe)?|gh(?:\.exe)?|supabase(?:\.exe)?|vercel(?:\.exe)?|kubectl(?:\.exe)?|terraform(?:\.exe)?|aws(?:\.exe)?|az(?:\.exe)?|gcloud(?:\.exe)?|psql(?:\.exe)?|sqlcmd(?:\.exe)?|ollama(?:\.exe)?|taskkill(?:\.exe)?|stop-process|kill|pkill|rm|rmdir|rd|del|erase|env|printenv)(?=$|[\s"'';&|])'
    return $Command -match $directPattern -or
        $Command -match '(?i)\bnpm(?:\.cmd|\.exe)?\s+run\s+build(?:\s|$)' -or
        $Command -match '(?i)\bnpm(?:\.cmd|\.exe)?\s+(?:install|uninstall|ci|publish)(?:\s|$)' -or
        $Command -match '(?i)\bnpm(?:\.cmd|\.exe)?\s+exec(?:\s|$)' -or
        $Command -match '(?i)\bnpx(?:\.cmd|\.exe)?\s+(?:supabase|vercel|netlify|firebase|wrangler|prisma)(?:\s|$)' -or
        $Command -match '(?i)(?:powershell|pwsh|cmd|bash|wsl|python|py|node|bun|deno)(?:\.exe)?\s'
}

function Get-CodexRuntimeAudit {
    param(
        [string]$EventsPath,
        [AllowEmptyCollection()][string[]]$EventJson = @(),
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$ForbiddenTargets,
        [switch]$AllowDeniedGitProbe
    )

    $errors = [Collections.Generic.List[string]]::new()
    $commands = @()
    $targetFindings = @()
    $eventTypes = @()
    $deniedGitProbe = $false
    $ruleLayerLoaded = $false
    $fileInput = -not [string]::IsNullOrWhiteSpace($EventsPath)
    $inlineInput = @($EventJson).Count -gt 0
    if ($fileInput -eq $inlineInput) {
        throw 'Runtime audit requires exactly one file or inline JSONL event source.'
    }
    if ($fileInput -and
        (-not (Test-Path -LiteralPath $EventsPath -PathType Leaf) -or
         (Get-Item -LiteralPath $EventsPath).Length -lt 1)) {
        $errors.Add('Codex JSONL event stream is missing or empty.')
        return [ordered]@{
            schema_version = 1
            valid = $false
            errors = @($errors)
            event_count = 0
            event_types = @()
            commands = @()
            forbidden_target_findings = @()
            denied_git_probe = $false
            project_rule_layer_loaded = $false
            events_sha256 = $null
        }
    }

    $rawText = if ($fileInput) {
        Get-Content -Raw -LiteralPath $EventsPath
    } else {
        (@($EventJson) -join "`n") + "`n"
    }
    $lines = if ($fileInput) {
        @(Get-Content -LiteralPath $EventsPath | Where-Object { $_.Trim() })
    } else {
        @($EventJson | Where-Object { $_.Trim() })
    }
    $eventIndex = 0
    foreach ($line in $lines) {
        $eventIndex++
        try {
            $event = $line | ConvertFrom-Json -DateKind String
        } catch {
            $errors.Add("Codex event stream contains non-JSON content: $($_.Exception.Message)")
            continue
        }
        $eventType = [string](Get-RequiredJsonProperty -Object $event -Name 'type' -Context 'Codex event')
        $eventTypes += $eventType
        if ($event.PSObject.Properties.Name -ccontains 'item' -and
            [string]$event.item.type -eq 'command_execution') {
            $commandValue = Get-RequiredJsonProperty -Object $event.item -Name 'command' -Context 'command_execution item'
            $commandText = if ($commandValue -is [array]) {
                @($commandValue | ForEach-Object { [string]$_ }) -join ' '
            } else {
                [string]$commandValue
            }
            $status = if ($event.item.PSObject.Properties.Name -ccontains 'status') {
                [string]$event.item.status
            } else {
                $null
            }
            $exitCode = if ($event.item.PSObject.Properties.Name -ccontains 'exit_code') {
                $event.item.exit_code
            } else {
                $null
            }
            $output = if ($event.item.PSObject.Properties.Name -ccontains 'aggregated_output') {
                [string]$event.item.aggregated_output
            } else {
                ''
            }
            $forbidden = Test-ForbiddenCommandText -Command $commandText
            $denied = $eventType -eq 'item.completed' -and $forbidden -and
                ($status -ne 'completed' -or $null -eq $exitCode -or [int]$exitCode -ne 0) -and
                ($output -match '(?i)forbidden|policy|not permitted|not allowed|may not inspect or mutate Git')
            if ($commandText -match '(?i)(^|[\s"''])git(?:\.exe)?\s+status(?:\s|$)' -and $denied) {
                $deniedGitProbe = $true
            }
            if ($output -match 'The executor may not inspect or mutate Git') {
                $ruleLayerLoaded = $true
            }
            $pathFindings = @(Get-ForbiddenRuntimeTargetFindings `
                -Command $commandText `
                -ForbiddenTargets $ForbiddenTargets)
            if ($eventType -eq 'item.completed' -and $forbidden -and
                -not ($AllowDeniedGitProbe -and $deniedGitProbe -and $denied)) {
                if ($pathFindings.Count -gt 0) {
                    $errors.Add(
                        'Forbidden command reached the runtime event stream with a redacted ' +
                        "target reference. command_sha256=$(Get-AsciiSha256 -Value $commandText)"
                    )
                } else {
                    $errors.Add("Forbidden command reached the runtime event stream: $commandText")
                }
            }
            foreach ($pathFinding in $pathFindings) {
                $finding = [ordered]@{
                    event_index = $eventIndex
                    event_type = $eventType
                    command_sha256 = Get-AsciiSha256 -Value $commandText
                    status = $status
                    exit_code = $exitCode
                    target_kind = [string]$pathFinding.target_kind
                    target_path_sha256 = [string]$pathFinding.target_path_sha256
                    match_kind = [string]$pathFinding.match_kind
                }
                $targetFindings += $finding
                $errors.Add(
                    "Command event $eventIndex references a controller-authorized forbidden " +
                    "$($finding.target_kind) target sha256=$($finding.target_path_sha256)."
                )
            }
            $commands += [ordered]@{
                event_index = $eventIndex
                event_type = $eventType
                command = if ($pathFindings.Count -gt 0) { '[REDACTED_FORBIDDEN_TARGET_REFERENCE]' } else { $commandText }
                command_sha256 = Get-AsciiSha256 -Value $commandText
                status = $status
                exit_code = $exitCode
                forbidden = $forbidden
                denied = $denied
                forbidden_target_reference = $pathFindings.Count -gt 0
                output_sha256 = Get-AsciiSha256 -Value $output
            }
        }
    }
    if ($eventTypes -cnotcontains 'thread.started') {
        $errors.Add('Codex event stream lacks thread.started.')
    }
    if ($eventTypes -cnotcontains 'turn.completed') {
        $errors.Add('Codex event stream lacks turn.completed.')
    }
    if ($rawText -match 'The executor may not inspect or mutate Git') {
        $ruleLayerLoaded = $true
    }
    if ($AllowDeniedGitProbe -and -not $deniedGitProbe) {
        $errors.Add('Required direct Git probe was not independently observed as denied.')
    }
    if ($AllowDeniedGitProbe -and -not $ruleLayerLoaded) {
        $errors.Add('Project autonomous-executor rule justification was not observed in JSONL evidence.')
    }
    return [ordered]@{
        schema_version = 1
        valid = $errors.Count -eq 0
        errors = @($errors)
        event_count = $lines.Count
        event_types = @($eventTypes | Sort-Object -Unique)
        commands = @($commands)
        forbidden_target_findings = @($targetFindings)
        denied_git_probe = $deniedGitProbe
        project_rule_layer_loaded = $ruleLayerLoaded
        events_sha256 = if ($fileInput) {
            (Get-FileHash -Algorithm SHA256 -LiteralPath $EventsPath).Hash.ToLowerInvariant()
        } else {
            Get-AsciiSha256 -Value $rawText
        }
    }
}

if ($RuntimeAuditOnly) {
    $testFileInput = -not [string]::IsNullOrWhiteSpace($RuntimeAuditTestEventsPath)
    $testInlineInput = @($RuntimeAuditTestEventJson).Count -gt 0
    if ($testFileInput -eq $testInlineInput) {
        throw 'RuntimeAuditOnly requires exactly one event file or inline JSONL event set.'
    }
    $testEvents = if ($testFileInput) {
        Get-CanonicalPath -Path $RuntimeAuditTestEventsPath -MustExist
    } else {
        $null
    }
    $testTargets = @()
    foreach ($testActivePath in $RuntimeAuditTestActivePath) {
        $testTargets += New-ForbiddenRuntimeTarget -Kind active_worktree -Path $testActivePath
    }
    foreach ($testSecretPath in $RuntimeAuditTestSecretPath) {
        $testTargets += New-ForbiddenRuntimeTarget -Kind secret_path -Path $testSecretPath
    }
    $testAudit = Get-CodexRuntimeAudit `
        -EventsPath $testEvents `
        -EventJson $RuntimeAuditTestEventJson `
        -ForbiddenTargets $testTargets
    Write-Output ($testAudit | ConvertTo-Json -Depth 12 -Compress)
    exit 0
}
# Resolve lexically first. The active-session registry must be consulted before
# any filesystem access to a proposed active worktree.
$ResolvedWorktree = Get-CanonicalPath -Path $WorktreePath
$ResolvedPrimary = Get-CanonicalPath -Path $PrimaryCheckout -MustExist
$ResolvedRunRoot = Get-CanonicalPath -Path $RunRoot
$ResolvedControllerRoot = Get-CanonicalPath -Path $ControllerRoot
$ResolvedControllerAllowedRoot = Get-CanonicalPath -Path $ControllerAllowedRoot -MustExist
$ResolvedMissionControlReceipt = Get-CanonicalPath -Path $MissionControlReceiptPath -MustExist
$ResolvedPromptSource = Get-CanonicalPath -Path $PromptSourcePath -MustExist
$CodexIdentity = Resolve-CodexIdentity -RequestedPath $CodexPath

if ($ResolvedWorktree.Contains("'")) {
    throw 'WorktreePath may not contain a single quote because it is bound into a TOML trust override.'
}
if ($NoModelAcceptanceCanary -and $RealExecutorCanary -ne 'None') {
    throw 'NoModelAcceptanceCanary and RealExecutorCanary are mutually exclusive.'
}
if (($NoModelAcceptanceCanary -or $RealExecutorCanary -ne 'None') -and
    (-not (Test-ChildPath -Child $ResolvedWorktree -Parent 'C:\tmp') -or
     -not $ExpectedBranch.StartsWith('test/codex-', [StringComparison]::Ordinal))) {
    throw 'Acceptance canaries are restricted to a C:\tmp test/codex-* worktree.'
}
if (Test-SamePath -Left $ResolvedWorktree -Right $ResolvedPrimary) {
    throw 'Refusing the primary SSTAC-Dashboard checkout.'
}
if (-not (Test-ChildPath -Child $ResolvedRunRoot -Parent $ResolvedWorktree)) {
    throw 'RunRoot must be a worktree-local child path.'
}
if (Test-ChildPath -Child $ResolvedControllerRoot -Parent $ResolvedWorktree) {
    throw 'ControllerRoot must be outside the executor worktree.'
}
if (-not (Test-ChildPath -Child $ResolvedControllerRoot -Parent $ResolvedControllerAllowedRoot)) {
    throw "ControllerRoot must be under $ResolvedControllerAllowedRoot."
}
Assert-NoReparsePointInExistingChain -Candidate $ResolvedMissionControlReceipt -Boundary $ResolvedControllerAllowedRoot
$receiptHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedMissionControlReceipt).Hash.ToLowerInvariant()
if ($receiptHash -cne $MissionControlReceiptSha256.ToLowerInvariant()) {
    throw 'Mission Control receipt hash does not match the required pin.'
}
$missionControlReceipt = Get-Content -Raw -LiteralPath $ResolvedMissionControlReceipt | ConvertFrom-Json -DateKind String
Assert-ExactJsonProperties -Object $missionControlReceipt -Context 'Mission Control receipt' -Names @(
    'schema_version',
    'receipt_id',
    'recorded_at_utc',
    'repository_root',
    'origin_url',
    'remote_query',
    'remote_origin_main_sha',
    'remote_verified_at_utc',
    'active_session_inventory_path',
    'active_session_inventory_sha256',
    'active_session_inventory_recorded_at_utc'
)
if ([int]$missionControlReceipt.schema_version -ne 1 -or
    [string]$missionControlReceipt.receipt_id -notmatch '^[0-9a-fA-F-]{36}$') {
    throw 'Mission Control receipt schema or receipt_id is invalid.'
}
$receiptTime = ConvertFrom-StrictUtcTimestamp -Value ([string]$missionControlReceipt.recorded_at_utc) -Context 'Mission Control receipt recorded_at_utc'
$remoteTime = ConvertFrom-StrictUtcTimestamp -Value ([string]$missionControlReceipt.remote_verified_at_utc) -Context 'Mission Control receipt remote_verified_at_utc'
$inventoryTime = ConvertFrom-StrictUtcTimestamp -Value ([string]$missionControlReceipt.active_session_inventory_recorded_at_utc) -Context 'Mission Control receipt active_session_inventory_recorded_at_utc'
$nowUtc = [DateTimeOffset]::UtcNow
$oldestAllowed = $nowUtc.AddMinutes(-$MissionControlReceiptMaxAgeMinutes)
$newestAllowed = $nowUtc.AddMinutes(2)
foreach ($timeEntry in @(
        [ordered]@{ name = 'receipt'; value = $receiptTime },
        [ordered]@{ name = 'remote verification'; value = $remoteTime },
        [ordered]@{ name = 'active-session inventory'; value = $inventoryTime }
    )) {
    if ($timeEntry.value -lt $oldestAllowed -or $timeEntry.value -gt $newestAllowed) {
        throw "Mission Control $($timeEntry.name) timestamp is stale or future-dated."
    }
}
if (-not (Test-SamePath -Left ([string]$missionControlReceipt.repository_root) -Right $ResolvedPrimary) -or
    [string]$missionControlReceipt.origin_url -cne $ExpectedOriginUrl -or
    [string]$missionControlReceipt.remote_query -cne 'git ls-remote origin refs/heads/main' -or
    [string]$missionControlReceipt.remote_origin_main_sha -notmatch '^[0-9a-fA-F]{40}$') {
    throw 'Mission Control remote-origin receipt is missing or ambiguous.'
}
$ResolvedRegistry = Get-CanonicalPath -Path ([string]$missionControlReceipt.active_session_inventory_path) -MustExist
Assert-NoReparsePointInExistingChain -Candidate $ResolvedRegistry -Boundary $ResolvedControllerAllowedRoot
$inventoryHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedRegistry).Hash.ToLowerInvariant()
if ($inventoryHash -cne ([string]$missionControlReceipt.active_session_inventory_sha256).ToLowerInvariant()) {
    throw 'Active-session inventory hash does not match the Mission Control receipt.'
}
$registry = Get-Content -Raw -LiteralPath $ResolvedRegistry | ConvertFrom-Json -DateKind String
Assert-ExactJsonProperties -Object $registry -Context 'Active-session inventory' -Names @(
    'schema_version',
    'registry_complete',
    'repository_root',
    'recorded_at_utc',
    'active_worktrees'
)
if ($registry.schema_version -isnot [long] -and $registry.schema_version -isnot [int] -or
    [int]$registry.schema_version -ne 1 -or
    $registry.registry_complete -isnot [bool] -or
    $registry.registry_complete -ne $true) {
    throw 'Active-session inventory is missing a complete schema_version 1 declaration.'
}
if ([string]$registry.recorded_at_utc -cne [string]$missionControlReceipt.active_session_inventory_recorded_at_utc) {
    throw 'Active-session inventory timestamp does not match the Mission Control receipt.'
}
if (-not (Test-SamePath -Left ([string]$registry.repository_root) -Right $ResolvedPrimary)) {
    throw 'Active-session inventory repository_root is ambiguous or incorrect.'
}
if (-not $registry.active_worktrees -or @($registry.active_worktrees).Count -lt 1) {
    throw 'Active-session inventory must contain at least one explicit active worktree.'
}
$seenActivePaths = @{}
$seenActiveBranches = @{}
$validatedActiveEntries = @()
$forbiddenRuntimeTargets = @()
foreach ($entry in @($registry.active_worktrees)) {
    Assert-ExactJsonProperties -Object $entry -Context 'Active-session inventory entry' -Names @(
        'path', 'branch', 'reason'
    )
    $activePath = Get-CanonicalPath -Path ([string]$entry.path)
    $activeBranch = [string]$entry.branch
    if (-not $activeBranch -or -not [string]$entry.reason) {
        throw 'Active-session registry contains a missing branch or reason.'
    }
    $pathKey = $activePath.ToLowerInvariant()
    $branchKey = $activeBranch.ToLowerInvariant()
    if ($seenActivePaths.ContainsKey($pathKey) -or $seenActiveBranches.ContainsKey($branchKey)) {
        throw 'Active-session registry contains duplicate or ambiguous paths or branches.'
    }
    $seenActivePaths[$pathKey] = $true
    $seenActiveBranches[$branchKey] = $true
    $validatedActiveEntries += [ordered]@{
        path = $activePath
        branch = $activeBranch
    }
    $forbiddenRuntimeTargets += New-ForbiddenRuntimeTarget -Kind active_worktree -Path $activePath
    if (Test-SamePath -Left $ResolvedWorktree -Right $activePath) {
        throw 'Refusing a registered active-session worktree.'
    }
    if ([string]::Equals($ExpectedBranch, $activeBranch, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Refusing a registered active-session branch.'
    }
}

$useApprovedBaseline = -not [string]::IsNullOrWhiteSpace($ApprovedBaselineAuthorizationPath) -or
    -not [string]::IsNullOrWhiteSpace($ApprovedBaselineAuthorizationSha256)
if ($useApprovedBaseline -and
    ([string]::IsNullOrWhiteSpace($ApprovedBaselineAuthorizationPath) -or
     [string]::IsNullOrWhiteSpace($ApprovedBaselineAuthorizationSha256))) {
    throw 'Approved baseline authorization path and SHA-256 must be supplied together.'
}

$pinMode = 'STRICT_ORIGIN_MAIN'
$approvedAuthorization = $null
$approvedAuthorizationHash = $null
$ResolvedApprovedAuthorization = $null
$ResolvedBaselineCommitReceipt = $null
$baselineCommitReceiptHash = $null
$baselineCommitReceipt = $null
$ResolvedExactCommitPatch = $null
$exactCommitPatchHash = $null
$ResolvedSecretInventory = $null
$secretInventoryHash = $null
$secretInventory = $null
$approvedBaselineSha = $null
$approvedParentSha = $null

if ($useApprovedBaseline) {
    $pinMode = 'APPROVED_LOCAL_BASELINE'
    $ResolvedApprovedAuthorization = Get-CanonicalPath `
        -Path $ApprovedBaselineAuthorizationPath `
        -MustExist
    Assert-NoReparsePointInExistingChain `
        -Candidate $ResolvedApprovedAuthorization `
        -Boundary $ResolvedControllerAllowedRoot
    $approvedAuthorizationHash = (Get-FileHash `
        -Algorithm SHA256 `
        -LiteralPath $ResolvedApprovedAuthorization).Hash.ToLowerInvariant()
    if ($approvedAuthorizationHash -cne $ApprovedBaselineAuthorizationSha256.ToLowerInvariant()) {
        throw 'Approved baseline authorization hash does not match the controller pin.'
    }
    $approvedAuthorization = Get-Content -Raw -LiteralPath $ResolvedApprovedAuthorization |
        ConvertFrom-Json -DateKind String
    Assert-ExactJsonProperties -Object $approvedAuthorization -Context 'Approved baseline authorization' -Names @(
        'schema_version',
        'receipt_id',
        'recorded_at_utc',
        'repository_root',
        'approved_baseline_sha',
        'approved_parent_sha',
        'local_origin_main_sha',
        'live_remote_origin_main_sha',
        'merge_base_sha',
        'baseline_commit_receipt_path',
        'baseline_commit_receipt_sha256',
        'exact_commit_patch_path',
        'exact_commit_patch_sha256',
        'active_session_inventory_path',
        'active_session_inventory_sha256',
        'secret_path_inventory_path',
        'secret_path_inventory_sha256'
    )
    if ($approvedAuthorization.schema_version -isnot [long] -and
        $approvedAuthorization.schema_version -isnot [int] -or
        [int]$approvedAuthorization.schema_version -ne 1 -or
        [string]$approvedAuthorization.receipt_id -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$') {
        throw 'Approved baseline authorization schema or receipt_id is malformed.'
    }
    $authorizationTime = ConvertFrom-StrictUtcTimestamp `
        -Value ([string]$approvedAuthorization.recorded_at_utc) `
        -Context 'Approved baseline authorization recorded_at_utc'
    $authorizationOldest = $nowUtc.AddMinutes(-$ApprovedBaselineAuthorizationMaxAgeMinutes)
    if ($authorizationTime -lt $authorizationOldest -or $authorizationTime -gt $newestAllowed) {
        throw 'Approved baseline authorization is stale or future-dated.'
    }

    $authorizationShaNames = @(
        'approved_baseline_sha',
        'approved_parent_sha',
        'local_origin_main_sha',
        'live_remote_origin_main_sha',
        'merge_base_sha'
    )
    foreach ($shaName in $authorizationShaNames) {
        if ([string]$approvedAuthorization.$shaName -notmatch '^[0-9a-fA-F]{40}$') {
            throw "Approved baseline authorization has malformed SHA property: $shaName"
        }
    }
    foreach ($hashName in @(
            'baseline_commit_receipt_sha256',
            'exact_commit_patch_sha256',
            'active_session_inventory_sha256',
            'secret_path_inventory_sha256'
        )) {
        if ([string]$approvedAuthorization.$hashName -notmatch '^[0-9a-fA-F]{64}$') {
            throw "Approved baseline authorization has malformed SHA-256 property: $hashName"
        }
    }

    $approvedBaselineSha = ([string]$approvedAuthorization.approved_baseline_sha).ToLowerInvariant()
    $approvedParentSha = ([string]$approvedAuthorization.approved_parent_sha).ToLowerInvariant()
    $authorizationLocalOrigin = ([string]$approvedAuthorization.local_origin_main_sha).ToLowerInvariant()
    $authorizationLiveOrigin = ([string]$approvedAuthorization.live_remote_origin_main_sha).ToLowerInvariant()
    $authorizationMergeBase = ([string]$approvedAuthorization.merge_base_sha).ToLowerInvariant()
    if (-not (Test-SamePath -Left ([string]$approvedAuthorization.repository_root) -Right $ResolvedPrimary) -or
        $approvedBaselineSha -cne $BaseSha.ToLowerInvariant() -or
        $authorizationLocalOrigin -cne $OriginMainSha.ToLowerInvariant() -or
        $authorizationLiveOrigin -cne $OriginMainSha.ToLowerInvariant() -or
        $authorizationMergeBase -cne $OriginMainSha.ToLowerInvariant() -or
        $approvedParentSha -cne $OriginMainSha.ToLowerInvariant() -or
        [string]$missionControlReceipt.remote_origin_main_sha -cne $authorizationLiveOrigin) {
        throw 'Approved baseline authorization pin set is mismatched or permits arbitrary ahead-of-origin state.'
    }
    if (-not (Test-SamePath `
            -Left ([string]$approvedAuthorization.active_session_inventory_path) `
            -Right $ResolvedRegistry) -or
        [string]$approvedAuthorization.active_session_inventory_sha256 -cne $inventoryHash) {
        throw 'Approved baseline authorization active-session inventory binding is mismatched.'
    }

    $ResolvedBaselineCommitReceipt = Get-CanonicalPath `
        -Path ([string]$approvedAuthorization.baseline_commit_receipt_path) `
        -MustExist
    $ResolvedExactCommitPatch = Get-CanonicalPath `
        -Path ([string]$approvedAuthorization.exact_commit_patch_path) `
        -MustExist
    $ResolvedSecretInventory = Get-CanonicalPath `
        -Path ([string]$approvedAuthorization.secret_path_inventory_path) `
        -MustExist
    foreach ($controllerFile in @(
            $ResolvedBaselineCommitReceipt,
            $ResolvedExactCommitPatch,
            $ResolvedSecretInventory
        )) {
        Assert-NoReparsePointInExistingChain `
            -Candidate $controllerFile `
            -Boundary $ResolvedControllerAllowedRoot
    }

    $baselineCommitReceiptHash = (Get-FileHash `
        -Algorithm SHA256 `
        -LiteralPath $ResolvedBaselineCommitReceipt).Hash.ToLowerInvariant()
    if ($baselineCommitReceiptHash -cne
        ([string]$approvedAuthorization.baseline_commit_receipt_sha256).ToLowerInvariant()) {
        throw 'Approved baseline commit receipt hash does not match its authorization.'
    }
    $exactCommitPatchHash = (Get-FileHash `
        -Algorithm SHA256 `
        -LiteralPath $ResolvedExactCommitPatch).Hash.ToLowerInvariant()
    if ($exactCommitPatchHash -cne
        ([string]$approvedAuthorization.exact_commit_patch_sha256).ToLowerInvariant()) {
        throw 'Approved exact commit patch hash does not match its authorization.'
    }
    $secretInventoryHash = (Get-FileHash `
        -Algorithm SHA256 `
        -LiteralPath $ResolvedSecretInventory).Hash.ToLowerInvariant()
    if ($secretInventoryHash -cne
        ([string]$approvedAuthorization.secret_path_inventory_sha256).ToLowerInvariant()) {
        throw 'Secret-path inventory hash does not match its authorization.'
    }

    $baselineCommitReceipt = Get-Content -Raw -LiteralPath $ResolvedBaselineCommitReceipt |
        ConvertFrom-Json -DateKind String
    Assert-ExactJsonProperties -Object $baselineCommitReceipt -Context 'Approved baseline commit receipt' -Names @(
        'schema_version', 'state', 'recorded_at_utc', 'worktree', 'branch',
        'commit_sha', 'parent_sha', 'commit_message', 'exact_committed_paths',
        'committed_hashes', 'worktree_clean', 'index_clean',
        'local_ahead_of_origin_main', 'local_behind_origin_main',
        'live_remote_origin_main_sha', 'remote_branch_absent', 'push_performed',
        'staged_verification', 'staged_verification_sha256'
    )
    $baselineReceiptTime = ConvertFrom-StrictUtcTimestamp `
        -Value ([string]$baselineCommitReceipt.recorded_at_utc) `
        -Context 'Approved baseline commit receipt recorded_at_utc'
    if ($baselineReceiptTime -gt $authorizationTime.AddMinutes(2)) {
        throw 'Approved baseline commit receipt is future-dated relative to its authorization.'
    }
    if ($baselineCommitReceipt.schema_version -isnot [long] -and
        $baselineCommitReceipt.schema_version -isnot [int] -or
        [int]$baselineCommitReceipt.schema_version -ne 1 -or
        [string]$baselineCommitReceipt.state -cne 'LOCAL_BASELINE_COMMIT_VERIFIED' -or
        [string]$baselineCommitReceipt.commit_sha -cne $approvedBaselineSha -or
        [string]$baselineCommitReceipt.parent_sha -cne $approvedParentSha -or
        [string]$baselineCommitReceipt.live_remote_origin_main_sha -cne $authorizationLiveOrigin -or
        $baselineCommitReceipt.worktree_clean -isnot [bool] -or
        $baselineCommitReceipt.worktree_clean -ne $true -or
        $baselineCommitReceipt.index_clean -isnot [bool] -or
        $baselineCommitReceipt.index_clean -ne $true -or
        $baselineCommitReceipt.local_ahead_of_origin_main -isnot [long] -and
        $baselineCommitReceipt.local_ahead_of_origin_main -isnot [int] -or
        [int]$baselineCommitReceipt.local_ahead_of_origin_main -ne 1 -or
        $baselineCommitReceipt.local_behind_origin_main -isnot [long] -and
        $baselineCommitReceipt.local_behind_origin_main -isnot [int] -or
        [int]$baselineCommitReceipt.local_behind_origin_main -ne 0 -or
        $baselineCommitReceipt.remote_branch_absent -isnot [bool] -or
        $baselineCommitReceipt.remote_branch_absent -ne $true -or
        $baselineCommitReceipt.push_performed -isnot [bool] -or
        $baselineCommitReceipt.push_performed -ne $false -or
        [string]$baselineCommitReceipt.staged_verification_sha256 -notmatch '^[0-9a-f]{64}$') {
        throw 'Approved baseline commit receipt state or pin evidence is malformed or mismatched.'
    }
    $receiptWorktree = Get-CanonicalPath -Path ([string]$baselineCommitReceipt.worktree)
    $receiptBranch = [string]$baselineCommitReceipt.branch
    $matchingActiveReceipt = @(
        $validatedActiveEntries | Where-Object {
            (Test-SamePath -Left $_.path -Right $receiptWorktree) -and
            [string]::Equals($_.branch, $receiptBranch, [StringComparison]::OrdinalIgnoreCase)
        }
    )
    if ($matchingActiveReceipt.Count -ne 1) {
        throw 'Approved baseline commit receipt provenance is not bound to one active-session inventory entry.'
    }
    $committedPaths = @($baselineCommitReceipt.exact_committed_paths)
    $committedHashes = @($baselineCommitReceipt.committed_hashes)
    if ($committedPaths.Count -lt 1 -or $committedHashes.Count -ne $committedPaths.Count -or
        @($committedPaths | Sort-Object -Unique).Count -ne $committedPaths.Count) {
        throw 'Approved baseline commit receipt path inventory is missing or ambiguous.'
    }
    $seenCommittedHashPaths = @{}
    foreach ($committedPathValue in $committedPaths) {
        $committedPathText = [string]$committedPathValue
        if (-not $committedPathText -or
            [IO.Path]::IsPathFullyQualified($committedPathText) -or
            $committedPathText.StartsWith('/') -or
            $committedPathText.StartsWith('\') -or
            $committedPathText.Contains('..') -or
            $committedPathText.Contains(':')) {
            throw 'Approved baseline commit receipt contains a malformed committed path.'
        }
    }
    foreach ($committedHash in $committedHashes) {
        Assert-ExactJsonProperties -Object $committedHash -Context 'Approved committed hash entry' -Names @(
            'path', 'blob_oid', 'committed_sha256', 'approved_sha256', 'exact_match'
        )
        $committedPath = [string]$committedHash.path
        $committedPathKey = $committedPath.ToLowerInvariant()
        if (-not $committedPath -or $seenCommittedHashPaths.ContainsKey($committedPathKey) -or
            $committedPaths -cnotcontains $committedPath -or
            [string]$committedHash.blob_oid -notmatch '^[0-9a-f]{40}$' -or
            [string]$committedHash.committed_sha256 -notmatch '^[0-9a-f]{64}$' -or
            [string]$committedHash.approved_sha256 -cne [string]$committedHash.committed_sha256 -or
            $committedHash.exact_match -isnot [bool] -or $committedHash.exact_match -ne $true) {
            throw 'Approved baseline committed hash entry is malformed, duplicated, or mismatched.'
        }
        $seenCommittedHashPaths[$committedPathKey] = $true
    }
    $patchFirstLines = @(Get-Content -LiteralPath $ResolvedExactCommitPatch -TotalCount 2)
    if ($patchFirstLines.Count -lt 1 -or $patchFirstLines[0] -cne "commit $approvedBaselineSha") {
        throw 'Approved exact commit patch is not bound to the approved baseline commit.'
    }

    $secretInventory = Get-Content -Raw -LiteralPath $ResolvedSecretInventory |
        ConvertFrom-Json -DateKind String
    Assert-ExactJsonProperties -Object $secretInventory -Context 'Secret-path inventory' -Names @(
        'schema_version', 'recorded_at_utc', 'secret_bearing_paths'
    )
    $secretInventoryTime = ConvertFrom-StrictUtcTimestamp `
        -Value ([string]$secretInventory.recorded_at_utc) `
        -Context 'Secret-path inventory recorded_at_utc'
    if ($secretInventory.schema_version -isnot [long] -and
        $secretInventory.schema_version -isnot [int] -or
        [int]$secretInventory.schema_version -ne 1 -or
        $secretInventoryTime -lt $authorizationOldest -or
        $secretInventoryTime -gt $newestAllowed -or
        [string]$secretInventory.recorded_at_utc -cne [string]$approvedAuthorization.recorded_at_utc -or
        @($secretInventory.secret_bearing_paths).Count -lt 1) {
        throw 'Secret-path inventory is stale, future-dated, empty, or malformed.'
    }
    $seenSecretPaths = @{}
    foreach ($secretEntry in @($secretInventory.secret_bearing_paths)) {
        Assert-ExactJsonProperties -Object $secretEntry -Context 'Secret-path inventory entry' -Names @(
            'path', 'reason'
        )
        $secretPath = Get-CanonicalPath -Path ([string]$secretEntry.path)
        $secretPathKey = $secretPath.ToLowerInvariant()
        if ($seenSecretPaths.ContainsKey($secretPathKey) -or
            $seenActivePaths.ContainsKey($secretPathKey) -or
            -not [string]$secretEntry.reason) {
            throw 'Secret-path inventory contains a missing, duplicate, or ambiguous path.'
        }
        $seenSecretPaths[$secretPathKey] = $true
        $forbiddenRuntimeTargets += New-ForbiddenRuntimeTarget -Kind secret_path -Path $secretPath
    }
}

if (-not (Test-Path -LiteralPath $ResolvedWorktree -PathType Container)) {
    throw "Required worktree path does not exist: $ResolvedWorktree"
}
if ((Test-Path -LiteralPath $ResolvedRunRoot) -or
    (Test-Path -LiteralPath $ResolvedControllerRoot)) {
    throw 'RunRoot and ControllerRoot must both be unique and absent.'
}
Assert-NoReparsePointInExistingChain -Candidate $ResolvedRunRoot -Boundary $ResolvedWorktree
Assert-NoReparsePointInExistingChain -Candidate $ResolvedControllerRoot -Boundary $ResolvedControllerAllowedRoot

$repoRoot = [string](@(Invoke-Git -Arguments @('rev-parse', '--show-toplevel'))[0])
if (-not (Test-SamePath -Left $repoRoot -Right $ResolvedWorktree)) {
    throw 'WorktreePath does not resolve to its own Git worktree root.'
}

$worktreeRegistry = @(& git -C $ResolvedPrimary worktree list --porcelain 2>&1)
if ($LASTEXITCODE -ne 0) {
    throw 'Unable to read the Git worktree registry.'
}
$targetWorktreeLines = @(
    $worktreeRegistry |
        Where-Object { $_ -like 'worktree *' } |
        ForEach-Object { $_.Substring(9) } |
        Where-Object { Test-SamePath -Left $_ -Right $ResolvedWorktree }
)
if ($targetWorktreeLines.Count -ne 1) {
    throw 'Target worktree registration is missing or ambiguous.'
}

$actualBranch = [string](@(Invoke-Git -Arguments @('branch', '--show-current'))[0])
$actualHead = ([string](@(Invoke-Git -Arguments @('rev-parse', 'HEAD'))[0])).ToLowerInvariant()
$actualHeadParent = ([string](@(Invoke-Git -Arguments @('rev-parse', 'HEAD^'))[0])).ToLowerInvariant()
$actualOriginMain = ([string](@(Invoke-Git -Arguments @('rev-parse', 'origin/main'))[0])).ToLowerInvariant()
$actualMergeBase = ([string](@(Invoke-Git -Arguments @('merge-base', 'HEAD', 'origin/main'))[0])).ToLowerInvariant()
$originUrl = [string](@(Invoke-Git -Arguments @('remote', 'get-url', 'origin'))[0])
$normalizedBase = $BaseSha.ToLowerInvariant()
$normalizedOrigin = $OriginMainSha.ToLowerInvariant()

if ($actualBranch -cne $ExpectedBranch) {
    throw "Branch pin mismatch. Expected $ExpectedBranch, found $actualBranch."
}
if ($pinMode -ceq 'STRICT_ORIGIN_MAIN') {
    if ($actualHead -ne $normalizedBase -or
        $actualOriginMain -ne $normalizedOrigin -or
        $actualMergeBase -ne $normalizedBase -or
        $normalizedBase -ne $normalizedOrigin) {
        throw 'HEAD, base SHA, merge-base, and origin/main SHA must be identical and unambiguous.'
    }
} else {
    $ancestorCheck = Invoke-GitWithAllowedExitCode `
        -Arguments @('merge-base', '--is-ancestor', $normalizedOrigin, $normalizedBase) `
        -AllowedExitCode @(0, 1)
    if ($actualHead -cne $approvedBaselineSha -or
        $normalizedBase -cne $approvedBaselineSha -or
        $actualHeadParent -cne $approvedParentSha -or
        $approvedParentSha -cne $normalizedOrigin -or
        $actualOriginMain -cne $normalizedOrigin -or
        $actualMergeBase -cne $normalizedOrigin -or
        $ancestorCheck.ExitCode -ne 0) {
        throw 'Approved local baseline does not match the exact one-commit authorization and origin/main ancestry.'
    }
}
if ($originUrl -cne $ExpectedOriginUrl) {
    throw "Unexpected origin URL: $originUrl"
}
if ([string]$missionControlReceipt.remote_origin_main_sha -cne $normalizedOrigin) {
    throw 'Mission Control remote origin/main SHA does not match the pinned OriginMainSha.'
}

$initialPorcelain = @(Invoke-Git -Arguments @('status', '--porcelain=v1', '--untracked-files=all'))
if ($initialPorcelain.Count -ne 0) {
    throw "Refusing dirty worktree:`n$($initialPorcelain -join "`n")"
}
$initialStatus = @(Invoke-Git -Arguments @('status', '--short', '--branch'))

$rulesPath = Join-Path $ResolvedWorktree $RulesRelativePath
if (-not (Test-Path -LiteralPath $rulesPath -PathType Leaf)) {
    throw "Missing autonomous executor rules: $rulesPath"
}
Assert-NoReparsePointInExistingChain -Candidate $rulesPath -Boundary $ResolvedWorktree
$rulesSha256Before = (Get-FileHash -Algorithm SHA256 -LiteralPath $rulesPath).Hash.ToLowerInvariant()
if (Test-Path -LiteralPath (Join-Path $ResolvedWorktree '.env.local')) {
    throw 'Refusing a worker worktree containing .env.local.'
}

$normalizedAllowed = @()
$allowedPathBaseline = @()
$allowedBaselineByKey = @{}
$seenAllowed = @{}
foreach ($path in $AllowedPath) {
    if (-not $path -or
        [IO.Path]::IsPathFullyQualified($path) -or
        $path.StartsWith('\') -or
        $path.StartsWith('/') -or
        $path.Contains('..') -or
        $path.Contains(':') -or
        $path.Contains("'") -or
        $path.Contains('"') -or
        $path.IndexOfAny([char[]]'*?[]') -ge 0) {
        throw "Allowed paths must be exact repository-relative paths: $path"
    }
    $relative = $path.Replace('/', '\').TrimStart('\')
    $segments = @($relative.Split('\'))
    foreach ($segment in $segments) {
        $deviceName = [IO.Path]::GetFileNameWithoutExtension($segment)
        if (-not $segment -or
            $segment.EndsWith('.') -or
            $segment.EndsWith(' ') -or
            $deviceName -match '^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$') {
            throw "Allowed path is not a canonical Windows file path: $path"
        }
    }
    $relativeKey = $relative.ToLowerInvariant()
    $forbiddenPrefix = @(
        '.git\',
        '.env',
        '.codex\',
        'wiki\',
        'node_modules\',
        'supabase\migrations\',
        'src\data\'
    ) | Where-Object {
        $relativeKey -eq $_.TrimEnd('\').ToLowerInvariant() -or
        $relativeKey.StartsWith($_.ToLowerInvariant())
    }
    if ($forbiddenPrefix) {
        throw "Allowed path enters a protected surface: $path"
    }
    if ($seenAllowed.ContainsKey($relativeKey)) {
        throw "Duplicate allowed path: $path"
    }
    $absoluteAllowed = Join-Path $ResolvedWorktree $relative
    $absoluteAllowed = [IO.Path]::GetFullPath($absoluteAllowed)
    if (-not (Test-ChildPath -Child $absoluteAllowed -Parent $ResolvedWorktree)) {
        throw "Allowed path escapes the worktree: $path"
    }
    if (Test-Path -LiteralPath $absoluteAllowed -PathType Container) {
        throw "Allowed paths must identify files, not directories: $path"
    }
    Assert-NoReparsePointInExistingChain -Candidate $absoluteAllowed -Boundary $ResolvedWorktree
    $seenAllowed[$relativeKey] = $true
    $normalizedPath = $relative.Replace('\', '/')
    $normalizedAllowed += $normalizedPath

    $trackedResult = Invoke-GitWithAllowedExitCode `
        -Arguments @('ls-files', '--error-unmatch', '--', $normalizedPath) `
        -AllowedExitCode @(0, 1)
    $ignoredResult = Invoke-GitWithAllowedExitCode `
        -Arguments @('check-ignore', '--quiet', '--', $normalizedPath) `
        -AllowedExitCode @(0, 1)
    $baselineExists = Test-Path -LiteralPath $absoluteAllowed -PathType Leaf
    $baseline = [ordered]@{
        path = $normalizedPath
        exists = $baselineExists
        tracked = ($trackedResult.ExitCode -eq 0)
        ignored = ($ignoredResult.ExitCode -eq 0)
        sha256 = if ($baselineExists) {
            (Get-FileHash -Algorithm SHA256 -LiteralPath $absoluteAllowed).Hash.ToLowerInvariant()
        } else {
            $null
        }
        snapshot_path = $null
    }
    $allowedPathBaseline += $baseline
    $allowedBaselineByKey[$relativeKey] = $baseline
}
if ($normalizedAllowed.Count -lt 1) {
    throw 'At least one exact changed path is required.'
}
if ($RealExecutorCanary -ne 'None' -and
    ($normalizedAllowed.Count -ne 1 -or
     $normalizedAllowed[0] -cne 'tools/codex/canary-output.txt')) {
    throw 'Real executor canaries require the single exact allowed path tools/codex/canary-output.txt.'
}

$nodeModulesPath = Join-Path $ResolvedWorktree 'node_modules'
$nodeModulesEvidence = [ordered]@{
    path = $nodeModulesPath
    exists = Test-Path -LiteralPath $nodeModulesPath
    link_type = $null
    target = $null
}
if ($nodeModulesEvidence.exists) {
    $nodeModulesItem = Get-Item -Force -LiteralPath $nodeModulesPath
    $nodeModulesEvidence.link_type = [string]$nodeModulesItem.LinkType
    $nodeModulesEvidence.target = @($nodeModulesItem.Target)
    if ($nodeModulesItem.LinkType -ne 'Junction') {
        throw 'Existing worktree node_modules must be a junction; refusing an ambiguous dependency store.'
    }
    $nodeTargets = @($nodeModulesItem.Target)
    $expectedNodeModulesTarget = Join-Path $ResolvedPrimary 'node_modules'
    if ($nodeTargets.Count -ne 1 -or
        -not (Test-Path -LiteralPath $expectedNodeModulesTarget -PathType Container) -or
        -not (Test-SamePath -Left ([string]$nodeTargets[0]) -Right $expectedNodeModulesTarget)) {
        throw 'Worktree node_modules junction does not target the primary checkout dependency store.'
    }
}

$ignoredSurfaceBefore = Get-IgnoredSurfaceSnapshot
$envLocalAbsentBefore = -not (Test-Path -LiteralPath (Join-Path $ResolvedWorktree '.env.local'))
if (-not $envLocalAbsentBefore) {
    throw 'Preflight could not prove .env.local absent.'
}

$initialMcpInventory = @(Get-McpInventory -Executable $CodexIdentity.path -ConfigArguments @())
$mcpServerNames = @(
    $initialMcpInventory |
        ForEach-Object { [string]$_.name } |
        Where-Object { $_ } |
        Sort-Object -Unique
)
foreach ($mcpName in $mcpServerNames) {
    if ($mcpName -notmatch '^[A-Za-z0-9_-]+$') {
        throw "MCP server name cannot be safely disabled through a strict override: $mcpName"
    }
}
$mcpDisableArguments = @()
foreach ($mcpName in $mcpServerNames) {
    $server = @($initialMcpInventory | Where-Object { [string]$_.name -ceq $mcpName })
    if ($server.Count -ne 1) {
        throw "MCP server inventory is missing or ambiguous: $mcpName"
    }
    $transport = $server[0].transport
    $transportOverride = if ([string]$transport.type -ceq 'stdio') {
        $command = ConvertTo-TomlBasicString -Value ([string]$transport.command)
        $argumentValues = @(
            @($transport.args) |
                ForEach-Object { ConvertTo-TomlBasicString -Value ([string]$_) }
        )
        "command=$command, args=[$($argumentValues -join ',')]"
    } elseif ([string]$transport.type -ceq 'streamable_http') {
        $url = ConvertTo-TomlBasicString -Value ([string]$transport.url)
        "url=$url"
    } else {
        throw "Unsupported MCP transport cannot be disabled safely: $mcpName"
    }
    $mcpDisableArguments += @(
        '-c',
        "mcp_servers.$mcpName={ enabled=false, $transportOverride }"
    )
}
$disabledMcpInventory = @(
    Get-McpInventory -Executable $CodexIdentity.path -ConfigArguments $mcpDisableArguments
)
$enabledAfterOverride = @($disabledMcpInventory | Where-Object { $_.enabled -eq $true })
if ($enabledAfterOverride.Count -ne 0) {
    throw 'One or more inherited MCP servers remain enabled after strict overrides.'
}

New-Item -ItemType Directory -Path $ResolvedRunRoot | Out-Null
New-Item -ItemType Directory -Path $ResolvedControllerRoot | Out-Null
$RunId = [Guid]::NewGuid().ToString('D')
Copy-Item -LiteralPath $ResolvedMissionControlReceipt -Destination (Join-Path $ResolvedControllerRoot 'MISSION_CONTROL_RECEIPT.json')
Copy-Item -LiteralPath $ResolvedRegistry -Destination (Join-Path $ResolvedControllerRoot 'ACTIVE_SESSION_INVENTORY.json')
if ($useApprovedBaseline) {
    Copy-Item -LiteralPath $ResolvedApprovedAuthorization -Destination (Join-Path $ResolvedControllerRoot 'APPROVED_BASELINE_AUTHORIZATION.json')
    Copy-Item -LiteralPath $ResolvedBaselineCommitReceipt -Destination (Join-Path $ResolvedControllerRoot 'BASELINE_COMMIT_RECEIPT.json')
    Copy-Item -LiteralPath $ResolvedExactCommitPatch -Destination (Join-Path $ResolvedControllerRoot 'BASELINE_EXACT_COMMIT.patch')
    Copy-Item -LiteralPath $ResolvedSecretInventory -Destination (Join-Path $ResolvedControllerRoot 'SECRET_PATH_INVENTORY.json')
}
Write-JsonReceipt -Path (Join-Path $ResolvedControllerRoot 'IGNORED_SURFACE_BEFORE.json') -Value $ignoredSurfaceBefore

$baselineSnapshotRoot = Join-Path $ResolvedControllerRoot 'ALLOWED_PATH_BASELINE'
New-Item -ItemType Directory -Path $baselineSnapshotRoot | Out-Null
for ($index = 0; $index -lt $allowedPathBaseline.Count; $index++) {
    $baseline = $allowedPathBaseline[$index]
    if ($baseline.exists -and -not $baseline.tracked) {
        $snapshotPath = Join-Path $baselineSnapshotRoot ('{0:D4}.baseline' -f $index)
        Copy-Item -LiteralPath (Join-Path $ResolvedWorktree $baseline.path) -Destination $snapshotPath
        $baseline.snapshot_path = $snapshotPath
    }
}

$startedAt = (Get-Date).ToUniversalTime().ToString('o')
$preflight = [ordered]@{
    schema_version = 1
    state = 'PREFLIGHT_PASS'
    recorded_at_utc = $startedAt
    worktree = $ResolvedWorktree
    branch = $actualBranch
    pin_mode = $pinMode
    head_sha = $actualHead
    head_parent_sha = $actualHeadParent
    base_sha = $normalizedBase
    origin_main_sha = $actualOriginMain
    merge_base_sha = $actualMergeBase
    origin_url = $originUrl
    initial_status = @($initialStatus)
    initial_porcelain = @($initialPorcelain)
    run_id = $RunId
    run_root = $ResolvedRunRoot
    controller_root = $ResolvedControllerRoot
    mission_control_receipt = $ResolvedMissionControlReceipt
    mission_control_receipt_sha256 = $receiptHash
    mission_control_receipt_recorded_at_utc = [string]$missionControlReceipt.recorded_at_utc
    remote_verified_at_utc = [string]$missionControlReceipt.remote_verified_at_utc
    active_session_inventory = $ResolvedRegistry
    active_session_inventory_sha256 = $inventoryHash
    approved_baseline_authorization = $ResolvedApprovedAuthorization
    approved_baseline_authorization_sha256 = $approvedAuthorizationHash
    baseline_commit_receipt = $ResolvedBaselineCommitReceipt
    baseline_commit_receipt_sha256 = $baselineCommitReceiptHash
    exact_commit_patch = $ResolvedExactCommitPatch
    exact_commit_patch_sha256 = $exactCommitPatchHash
    secret_path_inventory = $ResolvedSecretInventory
    secret_path_inventory_sha256 = $secretInventoryHash
    forbidden_runtime_target_count = $forbiddenRuntimeTargets.Count
    forbidden_runtime_target_hashes = @($forbiddenRuntimeTargets | ForEach-Object { $_.path_sha256 })
    ignored_surface_inventory_sha256 = [string]$ignoredSurfaceBefore.inventory_sha256
    env_local_absent = $envLocalAbsentBefore
    allowed_paths = @($normalizedAllowed)
    allowed_path_baseline = @($allowedPathBaseline)
    rules_sha256 = $rulesSha256Before
    codex_identity = $CodexIdentity
    disabled_mcp_servers = @($mcpServerNames)
    node_modules = $nodeModulesEvidence
}
Write-JsonReceipt -Path (Join-Path $ResolvedControllerRoot 'PREFLIGHT.json') -Value $preflight
Write-JsonReceipt -Path (Join-Path $ResolvedRunRoot 'PREFLIGHT.json') -Value $preflight
Write-AsciiText -Path (Join-Path $ResolvedControllerRoot 'INITIAL_STATUS.txt') -Value (($initialStatus -join "`n") + "`n")

foreach ($byte in [IO.File]::ReadAllBytes($ResolvedPromptSource)) {
    if ($byte -gt 127) {
        throw "Prompt source must be plain ASCII: $ResolvedPromptSource"
    }
}
$missionPrompt = Get-Content -Raw -LiteralPath $ResolvedPromptSource
$isRealCanary = $RealExecutorCanary -ne 'None'
$requiredWorkerArtifacts = @(
    'RUN_STATE.json',
    'COMMAND_LOG.json',
    'HEARTBEAT.json',
    'RESUME_PROMPT.md',
    'FORBIDDEN_ACTION_ATTESTATION.json'
)
if ($isRealCanary) {
    $requiredWorkerArtifacts += 'CANARY_RESULTS.json'
} else {
    $requiredWorkerArtifacts += 'GATE_RESULTS.json'
}
$contract = [ordered]@{
    schema_version = 2
    run_id = $RunId
    mode = if ($isRealCanary) { "REAL_CANARY_$($RealExecutorCanary.ToUpperInvariant())" } else { 'PRODUCTION' }
    terminal_state = 'READY_FOR_REVIEW'
    green_self_certification_allowed = $false
    network_allowed = $false
    git_allowed = $false
    sandbox_mode = 'workspace-write'
    windows_sandbox = 'unelevated'
    additional_writable_roots = @()
    exact_allowed_paths = @($normalizedAllowed)
    generated_artifact_roots = @($GeneratedArtifactRoots)
    required_gates = if ($isRealCanary) { @() } else { @($RequiredGates) }
    gate_results_schema_version = if ($isRealCanary) { $null } else { 2 }
    required_worker_artifacts = @($requiredWorkerArtifacts)
    runtime_command_audit_required = $true
    runtime_forbidden_path_audit_required = $true
    forbidden_runtime_target_count = $forbiddenRuntimeTargets.Count
    forbidden_runtime_target_hashes = @($forbiddenRuntimeTargets | ForEach-Object { $_.path_sha256 })
    worker_attestation_is_sufficient = $false
}
Write-JsonReceipt -Path (Join-Path $ResolvedControllerRoot 'CONTRACT.json') -Value $contract
Write-JsonReceipt -Path (Join-Path $ResolvedRunRoot 'CONTRACT.json') -Value $contract
$contractSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $ResolvedControllerRoot 'CONTRACT.json')).Hash.ToLowerInvariant()

$contractLines = @(
    '# SSTAC Codex autonomous executor contract',
    '',
    "Run ID: $RunId",
    "Contract SHA-256: $contractSha256",
    "Mode: $($contract.mode)",
    "Worktree: $ResolvedWorktree",
    "Branch: $actualBranch",
    "Pin mode: $pinMode",
    "HEAD: $actualHead",
    "HEAD parent: $actualHeadParent",
    "origin/main: $actualOriginMain",
    "Run root: $ResolvedRunRoot",
    '',
    'Exact changed-path allow-list:',
    ($normalizedAllowed | ForEach-Object { "- $_" }),
    '',
    'Non-negotiable boundaries:',
    '- Do not run any Git command except the one direct git status probe explicitly required by a real positive canary.',
    '- Edit only the exact allow-listed project files above and run-root receipts.',
    '- Do not inspect .env.local, environment variables, secrets, tokens, or privileged keys.',
    '- Do not contact Supabase, databases, cloud control planes, GitHub, or deployment systems.',
    '- Do not write the canonical wiki runtime, applied migrations, or src/data catalogs.',
    '- Do not install dependencies or delete, replace, or traverse a node_modules junction.',
    '- Do not terminate processes. Mission Control owns exact-cell or exact-PID cleanup.',
    '- Use plain ASCII for every authored file.',
    '- Never run raw npm run build.',
    '- Preserve coverage, gate logs, build logs, Playwright output, and other generated artifacts.',
    '- Do not commit, stage, push, create or modify a PR, deploy, merge, or bypass hooks.',
    '',
    'Every JSON artifact must contain exactly the named properties, use schema_version 2,',
    "bind run_id $RunId, and bind contract_sha256 $contractSha256.",
    'RUN_STATE.json: schema_version, run_id, contract_sha256, state, terminal, started_at_utc, completed_at_utc.',
    'COMMAND_LOG.json: schema_version, run_id, contract_sha256, commands. Each command object has command, started_at_utc, completed_at_utc, executed, exit_code. executed false requires null exit_code; executed true requires an integer exit_code.',
    'HEARTBEAT.json: schema_version, run_id, contract_sha256, recorded_at_utc, phase.',
    'FORBIDDEN_ACTION_ATTESTATION.json: schema_version, run_id, contract_sha256, recorded_at_utc, git_commands_run, forbidden_actions_observed, external_network_contact, supabase_contact, secret_inspection, arbitrary_process_termination, worktree_cleanup. Every boolean must be false.',
    'RUN_STATE state must be READY_FOR_REVIEW and terminal must be true. Contradictory or extra properties close RED.',
    'Mission Control independently audits the Codex JSONL stream. Worker claims are not acceptance evidence.',
    'Every command event is audited against controller-authorized active-worktree and secret-path targets.',
    'A target reference closes RED even when the command failed or was denied.',
    'Command-text auditing is detection and evidence, not a hard Windows per-file deny-read boundary.',
    ''
)
if ($isRealCanary) {
    $contractLines += @(
        'Real canary instructions:',
        '- Use the apply_patch tool for file writes.',
        '- Write tools/codex/canary-output.txt with the single ASCII line SSTAC_CODEX_CANARY_OK.',
        '- Write CANARY_RESULTS.json with exactly: schema_version, run_id, contract_sha256, allowed_edit_path, allowed_edit_completed, git_probe_attempted, git_probe_denied, unexpected_edit_attempted.',
        '- Write RESUME_PROMPT.md with the exact single line: No resume required; terminal READY_FOR_REVIEW.',
        '- Set allowed_edit_path to tools/codex/canary-output.txt and allowed_edit_completed to true.',
        '- Obtain real UTC timestamps with a safe Get-Date command when needed.',
        '- Stop at READY_FOR_REVIEW; never claim GREEN.'
    )
    if ($RealExecutorCanary -eq 'Positive') {
        $contractLines += @(
            '- Attempt exactly one direct command: git status --short. It must be forbidden by the project rule layer. Continue after the denial.',
            '- Set git_probe_attempted and git_probe_denied true and unexpected_edit_attempted false.'
        )
    } else {
        $contractLines += @(
            '- Also write tools/codex/unexpected-output.txt with the single ASCII line SSTAC_UNEXPECTED_EDIT.',
            '- Do not run Git. Set git_probe_attempted and git_probe_denied false and unexpected_edit_attempted true.',
            '- Complete the structured receipts. The controller is expected to reject READY_FOR_REVIEW because of the unexpected path.'
        )
    }
} else {
    $contractLines += @(
        'Ordered gate protocol:',
        '1. npm run lint',
        '2. npx tsc --noEmit',
        '3. npm run test:ci',
        '4. npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10',
        '5. npm run test:e2e',
        '6. npm run docs:gate',
        '',
        'A failed, missing, timed-out, skipped, or vacuous gate is not PASS.',
        'GATE_RESULTS.json schema_version 2 requires exactly: schema_version, run_id, contract_sha256, started_at_utc, completed_at_utc, gates.',
        'Each of six ordered gate objects requires exactly: ordinal, command, started_at_utc, completed_at_utc, result, exit_code, timed_out, vacuous, log_evidence.',
        'Each executed gate log_evidence object requires exactly: path, bytes, sha256 and must match the preserved file.',
        'PASS requires exit_code 0, false flags, ordered UTC timestamps, and nonempty hash-bound logs.',
        'FAIL requires real failure evidence and hash-bound logs. After the first FAIL, later gates are NOT_RUN with null timestamps and exit_code and empty log_evidence.'
    )
}
$contractLines += @(
    '',
    '# Frozen mission',
    '',
    $missionPrompt
)
$resolvedPromptPath = Join-Path $ResolvedRunRoot 'PROMPT.md'
Write-AsciiText -Path $resolvedPromptPath -Value (($contractLines -join "`n") + "`n")

$lastMessagePath = Join-Path $ResolvedControllerRoot 'LAST_MESSAGE.txt'
$eventsPath = Join-Path $ResolvedControllerRoot 'CODEX_EVENTS.jsonl'
$stderrPath = Join-Path $ResolvedControllerRoot 'CODEX_STDERR.log'
$codexArguments = @(
    '--strict-config',
    '--disable', 'plugins',
    '--disable', 'apps',
    '--sandbox', 'workspace-write',
    '--ask-for-approval', 'never',
    '-c', 'windows.sandbox="unelevated"',
    '-c', 'sandbox_workspace_write.network_access=false',
    '-c', 'shell_environment_policy.inherit="core"',
    '-c', 'shell_environment_policy.ignore_default_excludes=false',
    '-c', 'shell_environment_policy.exclude=["*SUPABASE*","*DATABASE*","*SECRET*","*TOKEN*","*KEY*","*PASSWORD*","*CREDENTIAL*","*VERCEL*"]',
    '-c', 'web_search="disabled"',
    '-c', 'agents.enabled=false',
    '-c', "projects.'$ResolvedWorktree'.trust_level='trusted'"
)
$codexArguments += $mcpDisableArguments
$executorWritePaths = @(
    $normalizedAllowed
    '.tmp'
    '.tmp/**'
    '.next'
    '.next/**'
    'coverage'
    'coverage/**'
    'playwright-report'
    'playwright-report/**'
    'test-results'
    'test-results/**'
)
foreach ($writePath in $executorWritePaths) {
    if (-not $seenAllowed.ContainsKey($writePath.Replace('/', '\').ToLowerInvariant()) -and
        $writePath -notin @(
            '.tmp',
            '.tmp/**',
            '.next',
            '.next/**',
            'coverage',
            'coverage/**',
            'playwright-report',
            'playwright-report/**',
            'test-results',
            'test-results/**'
        )) {
        throw "Unexpected executor write-path configuration: $writePath"
    }
}
$codexArguments += @(
    '-C', $ResolvedWorktree,
    'exec',
    '--json',
    '--output-last-message', $lastMessagePath
)
if ($Ephemeral) {
    $codexArguments += '--ephemeral'
}
$codexArguments += '-'

$executorConfig = [ordered]@{
    schema_version = 1
    state = 'CONFIG_VALIDATED'
    executable = $CodexIdentity
    arguments = @($codexArguments)
    sandbox_mode = 'workspace-write'
    windows_sandbox = 'unelevated'
    sandbox_workspace_write_network_access = $false
    additional_writable_roots = @()
    named_permission_profile = $null
    exact_write_paths = @($executorWritePaths)
    disabled_mcp_servers = @($mcpServerNames)
}
Write-JsonReceipt -Path (Join-Path $ResolvedControllerRoot 'EXECUTOR_CONFIG.json') -Value $executorConfig
Write-JsonReceipt -Path (Join-Path $ResolvedRunRoot 'EXECUTOR_CONFIG.json') -Value $executorConfig

if ($PrepareOnly) {
    Write-Output "PREFLIGHT_PASS controller=$ResolvedControllerRoot run=$ResolvedRunRoot"
    exit 0
}

$launch = [ordered]@{
    schema_version = 2
    run_id = $RunId
    mode = [string]$contract.mode
    contract_sha256 = $contractSha256
    launched_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    wrapper_pid = $PID
    executable = $CodexIdentity.path
    executable_version = $CodexIdentity.version
    executable_sha256 = $CodexIdentity.sha256
    disabled_mcp_servers = @($mcpServerNames)
    arguments = @($codexArguments)
    prompt_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedPromptPath).Hash.ToLowerInvariant()
    events_path = $eventsPath
    stderr_path = $stderrPath
    mission_control_receipt_sha256 = $receiptHash
    native_cell_custody_required = $true
    retry_budget = 0
}
Write-JsonReceipt -Path (Join-Path $ResolvedControllerRoot 'LAUNCH.json') -Value $launch

if ($NoModelAcceptanceCanary) {
    Write-AsciiText -Path $eventsPath -Value ""
    Write-AsciiText -Path $stderrPath -Value "NO_MODEL_ACCEPTANCE_CANARY`n"
    $codexExit = 0
} else {
    Get-Content -Raw -LiteralPath $resolvedPromptPath |
        & $CodexIdentity.path @codexArguments 2> $stderrPath |
        Tee-Object -FilePath $eventsPath
    $codexExit = $LASTEXITCODE
}

$acceptanceErrors = [Collections.Generic.List[string]]::new()
$workerEvidence = @()
$runtimeAudit = Get-CodexRuntimeAudit `
    -EventsPath $eventsPath `
    -ForbiddenTargets $forbiddenRuntimeTargets `
    -AllowDeniedGitProbe:($RealExecutorCanary -eq 'Positive')
Write-JsonReceipt -Path (Join-Path $ResolvedControllerRoot 'COMMAND_AUDIT.json') -Value $runtimeAudit
foreach ($runtimeError in @($runtimeAudit.errors)) {
    $acceptanceErrors.Add("Runtime audit: $runtimeError")
}

foreach ($artifactName in $requiredWorkerArtifacts) {
    $artifactPath = Join-Path $ResolvedRunRoot $artifactName
    if (-not (Test-NonEmptyAsciiFile -Path $artifactPath)) {
        $acceptanceErrors.Add("Missing, empty, or non-ASCII worker artifact: $artifactName")
    } else {
        $workerEvidence += Get-FileEvidence -AbsolutePath $artifactPath -RelativePath $artifactName
    }
}

$launchTime = ConvertFrom-StrictUtcTimestamp -Value ([string]$launch.launched_at_utc) -Context 'Launch timestamp'
$latestEvidenceTime = [DateTimeOffset]::UtcNow.AddMinutes(2)
function Assert-WorkerBinding {
    param([object]$Object, [string]$Context)

    if ([int](Get-RequiredJsonProperty -Object $Object -Name 'schema_version' -Context $Context) -ne 2 -or
        [string](Get-RequiredJsonProperty -Object $Object -Name 'run_id' -Context $Context) -cne $RunId -or
        [string](Get-RequiredJsonProperty -Object $Object -Name 'contract_sha256' -Context $Context) -cne $contractSha256) {
        throw "$Context is not bound to this run and contract."
    }
}

$runStatePath = Join-Path $ResolvedRunRoot 'RUN_STATE.json'
if (Test-NonEmptyAsciiFile -Path $runStatePath) {
    try {
        $runState = Get-Content -Raw -LiteralPath $runStatePath | ConvertFrom-Json -DateKind String
        Assert-ExactJsonProperties -Object $runState -Context 'RUN_STATE.json' -Names @(
            'schema_version', 'run_id', 'contract_sha256', 'state', 'terminal',
            'started_at_utc', 'completed_at_utc'
        )
        Assert-WorkerBinding -Object $runState -Context 'RUN_STATE.json'
        if ([string]$runState.state -cne 'READY_FOR_REVIEW' -or
            $runState.terminal -isnot [bool] -or $runState.terminal -ne $true) {
            throw 'RUN_STATE.json has a contradictory terminal state.'
        }
        $runStarted = ConvertFrom-StrictUtcTimestamp -Value ([string]$runState.started_at_utc) -Context 'RUN_STATE started_at_utc'
        $runCompleted = ConvertFrom-StrictUtcTimestamp -Value ([string]$runState.completed_at_utc) -Context 'RUN_STATE completed_at_utc'
        if ($runStarted -lt $launchTime.AddMinutes(-2) -or
            $runCompleted -lt $runStarted -or
            $runCompleted -gt $latestEvidenceTime) {
            throw 'RUN_STATE.json timestamps are contradictory or outside this launch.'
        }
    } catch {
        $acceptanceErrors.Add("Invalid RUN_STATE.json: $($_.Exception.Message)")
    }
}

$commandLogPath = Join-Path $ResolvedRunRoot 'COMMAND_LOG.json'
if (Test-NonEmptyAsciiFile -Path $commandLogPath) {
    try {
        $commandLog = Get-Content -Raw -LiteralPath $commandLogPath | ConvertFrom-Json -DateKind String
        Assert-ExactJsonProperties -Object $commandLog -Context 'COMMAND_LOG.json' -Names @(
            'schema_version', 'run_id', 'contract_sha256', 'commands'
        )
        Assert-WorkerBinding -Object $commandLog -Context 'COMMAND_LOG.json'
        foreach ($commandEntry in @($commandLog.commands)) {
            Assert-ExactJsonProperties -Object $commandEntry -Context 'COMMAND_LOG command' -Names @(
                'command', 'started_at_utc', 'completed_at_utc', 'executed', 'exit_code'
            )
            if (-not [string]$commandEntry.command) {
                throw 'COMMAND_LOG contains an empty command.'
            }
            $commandStarted = ConvertFrom-StrictUtcTimestamp -Value ([string]$commandEntry.started_at_utc) -Context 'COMMAND_LOG command started_at_utc'
            $commandCompleted = ConvertFrom-StrictUtcTimestamp -Value ([string]$commandEntry.completed_at_utc) -Context 'COMMAND_LOG command completed_at_utc'
            if ($commandCompleted -lt $commandStarted -or $commandCompleted -gt $latestEvidenceTime) {
                throw 'COMMAND_LOG contains contradictory timestamps.'
            }
            if ($commandEntry.executed -isnot [bool]) {
                throw 'COMMAND_LOG command executed is missing or not boolean.'
            }
            if ($commandEntry.executed -eq $true) {
                if ($null -eq $commandEntry.exit_code -or
                    $commandEntry.exit_code -isnot [long] -and $commandEntry.exit_code -isnot [int]) {
                    throw 'COMMAND_LOG executed command lacks an integer exit_code.'
                }
            } elseif ($null -ne $commandEntry.exit_code) {
                throw 'COMMAND_LOG non-executed command must have null exit_code.'
            } elseif ($RealExecutorCanary -ne 'Positive' -or
                [string]$commandEntry.command -cne 'git status --short' -or
                -not [bool]$runtimeAudit.denied_git_probe) {
                throw 'COMMAND_LOG contains an unexecuted command without controller-proven canary denial.'
            }
        }
    } catch {
        $acceptanceErrors.Add("Invalid COMMAND_LOG.json: $($_.Exception.Message)")
    }
}

$heartbeatPath = Join-Path $ResolvedRunRoot 'HEARTBEAT.json'
if (Test-NonEmptyAsciiFile -Path $heartbeatPath) {
    try {
        $heartbeat = Get-Content -Raw -LiteralPath $heartbeatPath | ConvertFrom-Json -DateKind String
        Assert-ExactJsonProperties -Object $heartbeat -Context 'HEARTBEAT.json' -Names @(
            'schema_version', 'run_id', 'contract_sha256', 'recorded_at_utc', 'phase'
        )
        Assert-WorkerBinding -Object $heartbeat -Context 'HEARTBEAT.json'
        $heartbeatTime = ConvertFrom-StrictUtcTimestamp -Value ([string]$heartbeat.recorded_at_utc) -Context 'HEARTBEAT recorded_at_utc'
        if ($heartbeatTime -lt $launchTime.AddMinutes(-2) -or $heartbeatTime -gt $latestEvidenceTime -or
            -not [string]$heartbeat.phase) {
            throw 'HEARTBEAT.json is stale, future-dated, or missing phase.'
        }
    } catch {
        $acceptanceErrors.Add("Invalid HEARTBEAT.json: $($_.Exception.Message)")
    }
}

$attestationPath = Join-Path $ResolvedRunRoot 'FORBIDDEN_ACTION_ATTESTATION.json'
if (Test-NonEmptyAsciiFile -Path $attestationPath) {
    try {
        $attestation = Get-Content -Raw -LiteralPath $attestationPath | ConvertFrom-Json -DateKind String
        $attestationBooleanNames = @(
            'git_commands_run',
            'forbidden_actions_observed',
            'external_network_contact',
            'supabase_contact',
            'secret_inspection',
            'arbitrary_process_termination',
            'worktree_cleanup'
        )
        Assert-ExactJsonProperties -Object $attestation -Context 'FORBIDDEN_ACTION_ATTESTATION.json' -Names (@(
            'schema_version', 'run_id', 'contract_sha256', 'recorded_at_utc'
        ) + $attestationBooleanNames)
        Assert-WorkerBinding -Object $attestation -Context 'FORBIDDEN_ACTION_ATTESTATION.json'
        $attestationTime = ConvertFrom-StrictUtcTimestamp -Value ([string]$attestation.recorded_at_utc) -Context 'Attestation recorded_at_utc'
        if ($attestationTime -lt $launchTime.AddMinutes(-2) -or $attestationTime -gt $latestEvidenceTime) {
            throw 'FORBIDDEN_ACTION_ATTESTATION.json timestamp is outside this launch.'
        }
        foreach ($booleanName in $attestationBooleanNames) {
            $value = Get-RequiredJsonProperty -Object $attestation -Name $booleanName -Context 'FORBIDDEN_ACTION_ATTESTATION.json'
            if ($value -isnot [bool] -or $value -ne $false) {
                throw "FORBIDDEN_ACTION_ATTESTATION.json has a missing or contradictory value: $booleanName"
            }
        }
    } catch {
        $acceptanceErrors.Add("Invalid FORBIDDEN_ACTION_ATTESTATION.json: $($_.Exception.Message)")
    }
}

if ($isRealCanary) {
    $resumePromptPath = Join-Path $ResolvedRunRoot 'RESUME_PROMPT.md'
    if (Test-NonEmptyAsciiFile -Path $resumePromptPath) {
        if ((Get-Content -Raw -LiteralPath $resumePromptPath).Trim() -cne 'No resume required; terminal READY_FOR_REVIEW.') {
            $acceptanceErrors.Add('Real canary RESUME_PROMPT.md is not the exact terminal no-resume declaration.')
        }
    }
}

$gateResultsValid = $false
if ($isRealCanary) {
    $canaryResultsPath = Join-Path $ResolvedRunRoot 'CANARY_RESULTS.json'
    if (Test-NonEmptyAsciiFile -Path $canaryResultsPath) {
        try {
            $canaryResults = Get-Content -Raw -LiteralPath $canaryResultsPath | ConvertFrom-Json -DateKind String
            Assert-ExactJsonProperties -Object $canaryResults -Context 'CANARY_RESULTS.json' -Names @(
                'schema_version', 'run_id', 'contract_sha256', 'allowed_edit_path',
                'allowed_edit_completed', 'git_probe_attempted', 'git_probe_denied',
                'unexpected_edit_attempted'
            )
            Assert-WorkerBinding -Object $canaryResults -Context 'CANARY_RESULTS.json'
            if ([string]$canaryResults.allowed_edit_path -cne 'tools/codex/canary-output.txt' -or
                $canaryResults.allowed_edit_completed -isnot [bool] -or
                $canaryResults.allowed_edit_completed -ne $true) {
                throw 'CANARY_RESULTS.json does not confirm the exact allowed edit.'
            }
            if ($RealExecutorCanary -eq 'Positive') {
                if ($canaryResults.git_probe_attempted -isnot [bool] -or
                    $canaryResults.git_probe_attempted -ne $true -or
                    $canaryResults.git_probe_denied -isnot [bool] -or
                    $canaryResults.git_probe_denied -ne $true -or
                    $canaryResults.unexpected_edit_attempted -isnot [bool] -or
                    $canaryResults.unexpected_edit_attempted -ne $false) {
                    throw 'Positive canary claims are contradictory.'
                }
            } else {
                if ($canaryResults.git_probe_attempted -isnot [bool] -or
                    $canaryResults.git_probe_attempted -ne $false -or
                    $canaryResults.git_probe_denied -isnot [bool] -or
                    $canaryResults.git_probe_denied -ne $false -or
                    $canaryResults.unexpected_edit_attempted -isnot [bool] -or
                    $canaryResults.unexpected_edit_attempted -ne $true) {
                    throw 'Unexpected-edit canary claims are contradictory.'
                }
            }
            $canaryOutputPath = Join-Path $ResolvedWorktree 'tools\codex\canary-output.txt'
            if (-not (Test-Path -LiteralPath $canaryOutputPath -PathType Leaf) -or
                (Get-Content -Raw -LiteralPath $canaryOutputPath).Trim() -cne 'SSTAC_CODEX_CANARY_OK') {
                throw 'Real canary exact allowed edit is missing or incorrect.'
            }
            $gateResultsValid = $true
        } catch {
            $acceptanceErrors.Add("Invalid CANARY_RESULTS.json: $($_.Exception.Message)")
        }
    }
} else {
    $gateResultsPath = Join-Path $ResolvedRunRoot 'GATE_RESULTS.json'
    if (Test-NonEmptyAsciiFile -Path $gateResultsPath) {
        try {
            $gateReceipt = Get-Content -Raw -LiteralPath $gateResultsPath | ConvertFrom-Json -DateKind String
            Assert-ExactJsonProperties -Object $gateReceipt -Context 'GATE_RESULTS.json' -Names @(
                'schema_version', 'run_id', 'contract_sha256', 'started_at_utc',
                'completed_at_utc', 'gates'
            )
            Assert-WorkerBinding -Object $gateReceipt -Context 'GATE_RESULTS.json'
            $gatesStarted = ConvertFrom-StrictUtcTimestamp -Value ([string]$gateReceipt.started_at_utc) -Context 'GATE_RESULTS started_at_utc'
            $gatesCompleted = ConvertFrom-StrictUtcTimestamp -Value ([string]$gateReceipt.completed_at_utc) -Context 'GATE_RESULTS completed_at_utc'
            if ($gatesStarted -lt $launchTime.AddMinutes(-2) -or
                $gatesCompleted -lt $gatesStarted -or
                $gatesCompleted -gt $latestEvidenceTime -or
                @($gateReceipt.gates).Count -ne $RequiredGates.Count) {
                throw 'Gate receipt timestamps or gate count are invalid.'
            }
            $priorFailure = $false
            for ($gateIndex = 0; $gateIndex -lt $RequiredGates.Count; $gateIndex++) {
                $gate = @($gateReceipt.gates)[$gateIndex]
                $ordinal = $gateIndex + 1
                Assert-ExactJsonProperties -Object $gate -Context "Gate $ordinal" -Names @(
                    'ordinal', 'command', 'started_at_utc', 'completed_at_utc',
                    'result', 'exit_code', 'timed_out', 'vacuous', 'log_evidence'
                )
                if ($gate.ordinal -isnot [long] -and $gate.ordinal -isnot [int] -or
                    [int]$gate.ordinal -ne $ordinal -or
                    [string]$gate.command -cne $RequiredGates[$gateIndex]) {
                    throw "Gate $ordinal is missing, reordered, renamed, or has a non-integer ordinal."
                }
                if ($gate.timed_out -isnot [bool] -or $gate.vacuous -isnot [bool]) {
                    throw "Gate $ordinal timed_out or vacuous is missing or not boolean."
                }
                $result = [string]$gate.result
                if ($result -notin @('PASS', 'FAIL', 'NOT_RUN')) {
                    throw "Gate $ordinal has an invalid result."
                }
                if ($priorFailure -and $result -ne 'NOT_RUN') {
                    throw "Gate $ordinal ran after the ordered protocol stopped."
                }
                if ($result -eq 'NOT_RUN') {
                    if (-not $priorFailure -or
                        $null -ne $gate.started_at_utc -or
                        $null -ne $gate.completed_at_utc -or
                        $null -ne $gate.exit_code -or
                        $gate.timed_out -ne $false -or
                        $gate.vacuous -ne $false -or
                        @($gate.log_evidence).Count -ne 0) {
                        throw "Gate $ordinal has contradictory NOT_RUN evidence."
                    }
                    continue
                }
                $gateStarted = ConvertFrom-StrictUtcTimestamp -Value ([string]$gate.started_at_utc) -Context "Gate $ordinal started_at_utc"
                $gateCompleted = ConvertFrom-StrictUtcTimestamp -Value ([string]$gate.completed_at_utc) -Context "Gate $ordinal completed_at_utc"
                if ($gateStarted -lt $gatesStarted -or $gateCompleted -lt $gateStarted -or $gateCompleted -gt $gatesCompleted) {
                    throw "Gate $ordinal timestamps are outside the gate receipt."
                }
                if ($gate.exit_code -isnot [long] -and $gate.exit_code -isnot [int]) {
                    throw "Gate $ordinal exit_code is missing or not an integer."
                }
                if ($result -eq 'PASS' -and
                    ([int]$gate.exit_code -ne 0 -or $gate.timed_out -or $gate.vacuous)) {
                    throw "Gate $ordinal claims PASS without non-vacuous success evidence."
                }
                if ($result -eq 'FAIL') {
                    if ([int]$gate.exit_code -eq 0 -and -not $gate.timed_out -and -not $gate.vacuous) {
                        throw "Gate $ordinal claims FAIL without failure evidence."
                    }
                    $priorFailure = $true
                }
                $logEvidence = @($gate.log_evidence)
                if ($logEvidence.Count -lt 1) {
                    throw "Gate $ordinal lacks hash-bound log evidence."
                }
                foreach ($log in $logEvidence) {
                    Assert-ExactJsonProperties -Object $log -Context "Gate $ordinal log evidence" -Names @('path', 'bytes', 'sha256')
                    $relativeLog = [string]$log.path
                    if (-not (Test-SafeGateLogPath -RelativePath $relativeLog)) {
                        throw "Gate $ordinal has a missing, empty, or unsafe log path."
                    }
                    $actualLog = Get-FileEvidence -AbsolutePath (Join-Path $ResolvedWorktree $relativeLog) -RelativePath $relativeLog
                    if ($log.bytes -isnot [long] -and $log.bytes -isnot [int] -or
                        [long]$log.bytes -ne [long]$actualLog.bytes -or
                        [string]$log.sha256 -cne [string]$actualLog.sha256) {
                        throw "Gate $ordinal log hash or byte count does not match controller evidence."
                    }
                }
            }
            $gateResultsValid = $true
        } catch {
            $acceptanceErrors.Add("Invalid GATE_RESULTS.json: $($_.Exception.Message)")
        }
    }
}
$afterStatus = @(Invoke-Git -Arguments @('status', '--short', '--branch'))
$afterBranch = [string](@(Invoke-Git -Arguments @('branch', '--show-current'))[0])
$afterHead = ([string](@(Invoke-Git -Arguments @('rev-parse', 'HEAD'))[0])).ToLowerInvariant()
$afterHeadParent = ([string](@(Invoke-Git -Arguments @('rev-parse', 'HEAD^'))[0])).ToLowerInvariant()
$afterOriginMain = ([string](@(Invoke-Git -Arguments @('rev-parse', 'origin/main'))[0])).ToLowerInvariant()
$afterMergeBase = ([string](@(Invoke-Git -Arguments @('merge-base', 'HEAD', 'origin/main'))[0])).ToLowerInvariant()
$stagedPaths = @(Invoke-Git -Arguments @('diff', '--cached', '--name-only', '--'))
$rulesSha256After = if (Test-Path -LiteralPath $rulesPath -PathType Leaf) {
    (Get-FileHash -Algorithm SHA256 -LiteralPath $rulesPath).Hash.ToLowerInvariant()
} else {
    $null
}
$rulesUnchanged = $rulesSha256After -eq $rulesSha256Before
$envLocalAbsentAfter = -not (Test-Path -LiteralPath (Join-Path $ResolvedWorktree '.env.local'))
$ignoredSurfaceAfter = Get-IgnoredSurfaceSnapshot
$ignoredSurfaceChanges = @(Compare-IgnoredSurfaceSnapshot -Before $ignoredSurfaceBefore -After $ignoredSurfaceAfter)
$protectedIgnoredChanges = @(
    $ignoredSurfaceChanges | Where-Object {
        $candidate = $_
        @($ProtectedIgnoredPrefixes | Where-Object {
            $candidate.StartsWith($_, [StringComparison]::OrdinalIgnoreCase)
        }).Count -gt 0
    }
)
$nodeModulesAfter = [ordered]@{
    path = $nodeModulesPath
    exists = Test-Path -LiteralPath $nodeModulesPath
    link_type = $null
    target = $null
}
if ($nodeModulesAfter.exists) {
    $nodeModulesAfterItem = Get-Item -Force -LiteralPath $nodeModulesPath
    $nodeModulesAfter.link_type = [string]$nodeModulesAfterItem.LinkType
    $nodeModulesAfter.target = @($nodeModulesAfterItem.Target)
}
$nodeModulesUnchanged = (($nodeModulesEvidence | ConvertTo-Json -Depth 4 -Compress) -ceq
    ($nodeModulesAfter | ConvertTo-Json -Depth 4 -Compress))
if (-not $envLocalAbsentAfter) {
    $acceptanceErrors.Add('.env.local appeared during executor runtime.')
}
if ($protectedIgnoredChanges.Count -ne 0) {
    $acceptanceErrors.Add("Protected ignored surfaces changed: $($protectedIgnoredChanges -join ', ')")
}
if (-not $nodeModulesUnchanged) {
    $acceptanceErrors.Add('node_modules junction or dependency-store evidence changed during executor runtime.')
}
Write-JsonReceipt -Path (Join-Path $ResolvedControllerRoot 'IGNORED_SURFACE_AFTER.json') -Value $ignoredSurfaceAfter
$ignoredSurfaceAudit = [ordered]@{
    schema_version = 1
    before_inventory_sha256 = [string]$ignoredSurfaceBefore.inventory_sha256
    after_inventory_sha256 = [string]$ignoredSurfaceAfter.inventory_sha256
    changed_paths = @($ignoredSurfaceChanges)
    protected_changed_paths = @($protectedIgnoredChanges)
    env_local_absent_before = $envLocalAbsentBefore
    env_local_absent_after = $envLocalAbsentAfter
    node_modules_before = $nodeModulesEvidence
    node_modules_after = $nodeModulesAfter
    node_modules_unchanged = $nodeModulesUnchanged
    generated_artifact_exclusions = @($GeneratedArtifactRoots)
}
Write-JsonReceipt -Path (Join-Path $ResolvedControllerRoot 'IGNORED_SURFACE_AUDIT.json') -Value $ignoredSurfaceAudit
$allowedPathChanges = @()
foreach ($baseline in $allowedPathBaseline) {
    $currentPath = Join-Path $ResolvedWorktree $baseline.path
    if (Test-Path -LiteralPath $currentPath -PathType Container) {
        throw "Allowed file path became a directory: $($baseline.path)"
    }
    $currentExists = Test-Path -LiteralPath $currentPath -PathType Leaf
    $currentHash = if ($currentExists) {
        (Get-FileHash -Algorithm SHA256 -LiteralPath $currentPath).Hash.ToLowerInvariant()
    } else {
        $null
    }
    if ($currentExists -ne $baseline.exists -or $currentHash -ne $baseline.sha256) {
        $allowedPathChanges += $baseline.path
    }
}
$changedPaths = @(
    @(Get-ChangedPathInventory) + @($allowedPathChanges) + @($ignoredSurfaceChanges) +
        $(if (-not $nodeModulesUnchanged) { 'node_modules' }) |
        Where-Object { $_ } |
        Sort-Object -Unique
)
$unexpectedPaths = @(
    $changedPaths | Where-Object {
        -not $seenAllowed.ContainsKey($_.Replace('/', '\').ToLowerInvariant())
    }
)
foreach ($changedPath in $changedPaths) {
    Assert-AsciiFile -RelativePath $changedPath
}

$diffPath = Join-Path $ResolvedControllerRoot 'EXACT_DIFF.patch'
$unstagedDiff = @(Invoke-Git -Arguments @('diff', '--no-ext-diff', '--binary', '--'))
$stagedDiff = @(Invoke-Git -Arguments @('diff', '--cached', '--no-ext-diff', '--binary', '--'))
$untrackedOrIgnoredDiff = @()
foreach ($changedPath in $changedPaths) {
    $pathKey = $changedPath.Replace('/', '\').ToLowerInvariant()
    $trackedResult = Invoke-GitWithAllowedExitCode `
        -Arguments @('ls-files', '--error-unmatch', '--', $changedPath) `
        -AllowedExitCode @(0, 1)
    if ($trackedResult.ExitCode -eq 0) {
        continue
    }

    $currentPath = Join-Path $ResolvedWorktree $changedPath
    $baseline = $allowedBaselineByKey[$pathKey]
    $leftPath = if ($baseline -and $baseline.snapshot_path) {
        $baseline.snapshot_path
    } else {
        'NUL'
    }
    $rightPath = if (Test-Path -LiteralPath $currentPath -PathType Leaf) {
        $currentPath
    } else {
        'NUL'
    }
    $diffResult = Invoke-GitWithAllowedExitCode `
        -Arguments @('diff', '--no-index', '--binary', '--', $leftPath, $rightPath) `
        -AllowedExitCode @(0, 1)
    $untrackedOrIgnoredDiff += @($diffResult.Output)
}
$combinedDiff = @('# UNSTAGED DIFF') +
    @($unstagedDiff) +
    @('# STAGED DIFF') +
    @($stagedDiff) +
    @('# UNTRACKED OR IGNORED ALLOW-LIST DIFF') +
    @($untrackedOrIgnoredDiff)
Write-AsciiText -Path $diffPath -Value (($combinedDiff -join "`n") + "`n")
Write-AsciiText -Path (Join-Path $ResolvedControllerRoot 'FINAL_STATUS.txt') -Value (($afterStatus -join "`n") + "`n")
Write-AsciiText -Path (Join-Path $ResolvedControllerRoot 'CHANGED_PATHS.txt') -Value (($changedPaths -join "`n") + "`n")

$artifactCandidates = @(
    '.tmp/gate-logs',
    '.tmp/build-monitor',
    'coverage',
    'playwright-report',
    'test-results'
)
$artifacts = @(
    $artifactCandidates | ForEach-Object {
        $candidate = Join-Path $ResolvedWorktree $_
        if (Test-Path -LiteralPath $candidate) {
            [ordered]@{
                relative_path = $_
                absolute_path = $candidate
            }
        }
    }
)

$gitPinsUnchanged = if ($pinMode -ceq 'STRICT_ORIGIN_MAIN') {
    $afterBranch -ceq $ExpectedBranch -and
    $afterHead -eq $normalizedBase -and
    $afterOriginMain -eq $normalizedOrigin -and
    $afterMergeBase -eq $normalizedBase
} else {
    $afterBranch -ceq $ExpectedBranch -and
    $afterHead -ceq $approvedBaselineSha -and
    $afterHeadParent -ceq $approvedParentSha -and
    $afterOriginMain -ceq $normalizedOrigin -and
    $afterMergeBase -ceq $normalizedOrigin
}
$stderrEvidence = if (Test-Path -LiteralPath $stderrPath -PathType Leaf) {
    $stderrItem = Get-Item -LiteralPath $stderrPath
    [ordered]@{
        path = $stderrPath
        bytes = [long]$stderrItem.Length
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $stderrPath).Hash.ToLowerInvariant()
    }
} else {
    $null
}
$evidenceAudit = [ordered]@{
    schema_version = 1
    run_id = $RunId
    contract_sha256 = $contractSha256
    mode = [string]$contract.mode
    codex_exit_code = $codexExit
    runtime_audit_valid = [bool]$runtimeAudit.valid
    forbidden_target_findings = @($runtimeAudit.forbidden_target_findings)
    runtime_events = if ((Test-Path -LiteralPath $eventsPath -PathType Leaf) -and
        (Get-Item -LiteralPath $eventsPath).Length -gt 0) {
        Get-FileEvidence -AbsolutePath $eventsPath -RelativePath 'CODEX_EVENTS.jsonl'
    } else {
        $null
    }
    runtime_stderr = $stderrEvidence
    worker_artifacts = @($workerEvidence)
    structured_gate_or_canary_evidence_valid = $gateResultsValid
    ignored_surface_audit_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $ResolvedControllerRoot 'IGNORED_SURFACE_AUDIT.json')).Hash.ToLowerInvariant()
    env_local_absent_before = $envLocalAbsentBefore
    env_local_absent_after = $envLocalAbsentAfter
    node_modules_unchanged = $nodeModulesUnchanged
    staged_paths = @($stagedPaths)
    changed_paths = @($changedPaths)
    unexpected_paths = @($unexpectedPaths)
    acceptance_errors = @($acceptanceErrors)
    worker_attestation_treated_as_sufficient = $false
    recorded_at_utc = (Get-Date).ToUniversalTime().ToString('o')
}
$evidenceAuditPath = Join-Path $ResolvedControllerRoot 'EVIDENCE_AUDIT.json'
Write-JsonReceipt -Path $evidenceAuditPath -Value $evidenceAudit
$evidenceAuditSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $evidenceAuditPath).Hash.ToLowerInvariant()
$finalState = if ($codexExit -eq 0 -and
    $unexpectedPaths.Count -eq 0 -and
    $stagedPaths.Count -eq 0 -and
    $gitPinsUnchanged -and
    $rulesUnchanged -and
    $gateResultsValid -and
    [bool]$runtimeAudit.valid -and
    $envLocalAbsentAfter -and
    $nodeModulesUnchanged -and
    $protectedIgnoredChanges.Count -eq 0 -and
    $acceptanceErrors.Count -eq 0) {
    'READY_FOR_REVIEW'
} else {
    'RED'
}
$canaryExpectationMet = if ($RealExecutorCanary -eq 'Positive') {
    $finalState -eq 'READY_FOR_REVIEW'
} elseif ($RealExecutorCanary -eq 'UnexpectedEdit') {
    $finalState -eq 'RED' -and $unexpectedPaths -contains 'tools/codex/unexpected-output.txt'
} else {
    $null
}
$final = [ordered]@{
    schema_version = 2
    run_id = $RunId
    state = $finalState
    mode = [string]$contract.mode
    green_self_certification_allowed = $false
    codex_exit_code = $codexExit
    changed_paths = @($changedPaths)
    unexpected_paths = @($unexpectedPaths)
    staged_paths = @($stagedPaths)
    branch = $afterBranch
    pin_mode = $pinMode
    head_sha = $afterHead
    head_parent_sha = $afterHeadParent
    origin_main_sha = $afterOriginMain
    merge_base_sha = $afterMergeBase
    git_pins_unchanged = $gitPinsUnchanged
    rules_sha256_before = $rulesSha256Before
    rules_sha256_after = $rulesSha256After
    rules_unchanged = $rulesUnchanged
    gate_results_valid = $gateResultsValid
    runtime_audit_valid = [bool]$runtimeAudit.valid
    forbidden_target_finding_count = @($runtimeAudit.forbidden_target_findings).Count
    denied_git_probe_observed = [bool]$runtimeAudit.denied_git_probe
    project_rule_layer_loaded = [bool]$runtimeAudit.project_rule_layer_loaded
    ignored_surface_changes = @($ignoredSurfaceChanges)
    protected_ignored_surface_changes = @($protectedIgnoredChanges)
    env_local_absent = $envLocalAbsentAfter
    node_modules_unchanged = $nodeModulesUnchanged
    evidence_audit_sha256 = $evidenceAuditSha256
    canary_expectation_met = $canaryExpectationMet
    acceptance_errors = @($acceptanceErrors)
    final_status = @($afterStatus)
    preserved_artifacts = @($artifacts)
    completed_at_utc = (Get-Date).ToUniversalTime().ToString('o')
}
Write-JsonReceipt -Path (Join-Path $ResolvedControllerRoot 'FINAL_STATE.json') -Value $final
if ($RealExecutorCanary -ne 'None') {
    Write-JsonReceipt -Path (Join-Path $ResolvedControllerRoot 'CANARY_ACCEPTANCE.json') -Value ([ordered]@{
        schema_version = 1
        run_id = $RunId
        canary = $RealExecutorCanary
        final_state = $finalState
        expectation_met = $canaryExpectationMet
        exact_allowed_edit = $allowedPathChanges -contains 'tools/codex/canary-output.txt'
        unexpected_paths = @($unexpectedPaths)
        denied_git_probe_observed = [bool]$runtimeAudit.denied_git_probe
        project_rule_layer_loaded = [bool]$runtimeAudit.project_rule_layer_loaded
        controller_evidence_audit_sha256 = $evidenceAuditSha256
    })
}

if ($finalState -ne 'READY_FOR_REVIEW') {
    throw "Executor closed RED. See $ResolvedControllerRoot"
}

Write-Output "READY_FOR_REVIEW controller=$ResolvedControllerRoot run=$ResolvedRunRoot"
exit 0
