param(
  [Parameter(Mandatory = $true)][string]$SourceRoot,
  [ValidateRange(1024, 65535)][int]$Port = 49232
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$resolvedSource = (Resolve-Path -LiteralPath $SourceRoot).Path
if (-not [System.IO.Path]::IsPathRooted($resolvedSource)) { throw 'Preview source must be absolute.' }
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw 'Preview port is occupied.' }
$next = Join-Path $repoRoot 'node_modules\next\dist\bin\next'
if (-not (Test-Path -LiteralPath $next -PathType Leaf)) { throw 'Next.js CLI is unavailable.' }

Get-ChildItem Env: | Where-Object { $_.Name -match 'SUPABASE|^E2E_' } | ForEach-Object { Remove-Item -LiteralPath ('Env:' + $_.Name) }
$env:NODE_ENV = 'development'
$env:MATRIX_R2_REVIEW_PREVIEW = '1'
$env:MATRIX_R2_PREVIEW_BROWSER_TEST = '0'
$env:MATRIX_R2_REVIEW_PREVIEW_SOURCE_ROOT = $resolvedSource
$env:MATRIX_R2_GUIDED_REVIEW_UI = 'false'
$env:MATRIX_R2_GUIDED_REVIEW_WRITES = 'false'
$env:MATRIX_OPTIONS_PAPER_WORKSPACE = 'false'
$env:MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'false'
$env:NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = 'local-preview-no-provider'

Set-Location -LiteralPath $repoRoot
node $next dev --hostname 127.0.0.1 --port $Port
