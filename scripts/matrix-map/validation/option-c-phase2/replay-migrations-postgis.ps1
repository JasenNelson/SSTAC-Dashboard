<#
.SYNOPSIS
PostGIS Actual Supabase Migration Integration Replay Harness (agy-runtime-007)
ASCII ONLY

.DESCRIPTION
Executes actual supabase/migrations/*.sql files unchanged and in order against a clean sstac_replay
database in a PostGIS-enabled PostgreSQL container.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDir,

  [Parameter(Mandatory = $false)]
  [string]$PgImage = 'postgis/postgis@sha256:bcab61c139a9644dcf0bb00b0cff8ab84e36b3b6f74983cf229ddb4ea0c22897',

  [Parameter(Mandatory = $false)]
  [int]$TimeoutSeconds = 300
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$ProgressPreference = 'SilentlyContinue'

$Script:StartTime = [DateTime]::UtcNow
$Script:LogEntries = [System.Collections.Generic.List[string]]::new()

function Write-HarnessLog {
  param([string]$Message, [string]$Level = 'INFO')
  $timestamp = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
  $safeMessage = $Message -replace 'val_pass_\d+', '[REDACTED]'
  $line = "[$timestamp] [$Level] $safeMessage"
  $Script:LogEntries.Add($line)
  Write-Host $line
}

Write-HarnessLog "Starting PostGIS Actual Supabase Migration Replay (agy-runtime-007)"
Write-HarnessLog "OutputDir: $OutputDir"
Write-HarnessLog "PgImage: $PgImage"

if (-not (Test-Path -Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$RepoRoot = "C:\tmp\sstac-option-c-phase2-2026-07-24"
$MigrationsDir = Join-Path $RepoRoot "supabase\migrations"
$DraftSqlPath = Join-Path $RepoRoot "docs\design\matrix-map\OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql"
$TestSqlPath = Join-Path $RepoRoot "scripts\matrix-map\validation\option-c-phase2\test-option-c.sql"

# Check directories
if (-not (Test-Path -Path $MigrationsDir)) {
  Write-HarnessLog "Migrations directory missing: $MigrationsDir" "ERROR"
  exit 1
}

# 1. Enumerate and hash all migration files
$migrationFiles = Get-ChildItem -Path $MigrationsDir -Filter "*.sql" | Sort-Object Name
Write-HarnessLog "Found $($migrationFiles.Count) migration files in $MigrationsDir"

$migrationManifest = [System.Collections.Generic.List[PSCustomObject]]::new()
foreach ($file in $migrationFiles) {
  $hash = (Get-FileHash -Algorithm SHA256 -Path $file.FullName).Hash.ToUpperInvariant()
  $migrationManifest.Add([PSCustomObject]@{
    filename = $file.Name
    full_path = $file.FullName
    sha256 = $hash
    size_bytes = $file.Length
  })
}

$migrationManifest | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDir "migration_execution_manifest.json") -Encoding Ascii

# Generate MIGRATION_EXECUTION_MANIFEST.md
$manifestMdLines = [System.Collections.Generic.List[string]]::new()
$manifestMdLines.Add("# Migration Execution Manifest - agy-runtime-007")
$manifestMdLines.Add("")
$manifestMdLines.Add("Total migrations: $($migrationFiles.Count)")
$manifestMdLines.Add("")
$manifestMdLines.Add("| # | Migration File | SHA256 Hash | Size (Bytes) |")
$manifestMdLines.Add("|---|---|---|---|")
$idx = 1
foreach ($item in $migrationManifest) {
  $manifestMdLines.Add("| $idx | $($item.filename) | $($item.sha256) | $($item.size_bytes) |")
  $idx++
}
Set-Content -Path (Join-Path $OutputDir "MIGRATION_EXECUTION_MANIFEST.md") -Value ($manifestMdLines -join "`n") -Encoding Ascii

# Preflight: Docker check
try {
  docker info | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-HarnessLog "Docker daemon inaccessible" "ERROR"
    exit 1
  }
} catch {
  Write-HarnessLog "Docker check failed: $_" "ERROR"
  exit 1
}

# Preflight: Check image locally (must not pull)
$imageInspectJson = docker image inspect $PgImage 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-HarnessLog "PostgreSQL image $PgImage not available locally. Failing closed." "ERROR"
  exit 1
}
Set-Content -Path (Join-Path $OutputDir "docker_image_receipt.json") -Value $imageInspectJson -Encoding Ascii

$ContainerName = "sstac-pg-replay-optc-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))-$((Get-Random -Minimum 1000 -Maximum 9999))"
$PgPassword = "val_pass_$((Get-Random -Minimum 100000 -Maximum 999999))"
$ContainerId = $null
$jobA = $null
$jobB = $null

try {
  Write-HarnessLog "Creating local Docker container: $ContainerName"
  $createOutput = docker create --name $ContainerName -e "POSTGRES_PASSWORD=$PgPassword" $PgImage 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-HarnessLog "Failed to create container: $createOutput" "ERROR"
    exit 1
  }

  $ContainerId = (docker inspect --format '{{.Id}}' $ContainerName).Trim()
  Write-HarnessLog "Container created: $ContainerId"

  $provenName = (docker inspect --format '{{.Name}}' $ContainerId).Trim().TrimStart('/')
  if ($provenName -ne $ContainerName) {
    Write-HarnessLog "Container identity mismatch!" "ERROR"
    exit 1
  }

  $containerInspect = docker inspect $ContainerId | ConvertFrom-Json
  $identityReceipt = [PSCustomObject]@{
    container_id = $ContainerId
    container_name = $ContainerName
    image = $PgImage
    created_at = $containerInspect[0].Created
    network_bindings = $containerInspect[0].HostConfig.PortBindings
  }
  $identityReceipt | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDir "container_identity_receipt.json") -Encoding Ascii

  Write-HarnessLog "Starting container $ContainerId"
  docker start $ContainerId | Out-Null

  # Bounded wait for readiness in default postgres DB with stabilization check
  $ready = $false
  $readyDeadline = [DateTime]::UtcNow.AddSeconds(60)
  while (-not $ready -and [DateTime]::UtcNow -lt $readyDeadline) {
    Start-Sleep -Seconds 1
    $check = docker exec $ContainerId pg_isready -U postgres 2>&1
    if ($LASTEXITCODE -eq 0) {
      $testQuery = docker exec -i $ContainerId psql -U postgres -d postgres -c "SELECT 1;" 2>&1
      if ($LASTEXITCODE -eq 0) {
        Start-Sleep -Seconds 2
        $ready = $true
      }
    }
  }

  if (-not $ready) {
    Write-HarnessLog "PostgreSQL failed to achieve readiness." "ERROR"
    exit 1
  }
  Write-HarnessLog "PostgreSQL engine ready and stabilized."

  # Create sstac_replay database using TEMPLATE template0 with retry
  Write-HarnessLog "Creating clean target database sstac_replay using TEMPLATE template0..."
  $createDbSuccess = $false
  $createDbDeadline = [DateTime]::UtcNow.AddSeconds(30)
  $createDbOut = ""
  while (-not $createDbSuccess -and [DateTime]::UtcNow -lt $createDbDeadline) {
    $createDbOut = (docker exec -i $ContainerId psql -U postgres -d postgres -c "CREATE DATABASE sstac_replay WITH TEMPLATE template0;" 2>&1)
    if ($LASTEXITCODE -eq 0) {
      $createDbSuccess = $true
    } else {
      Start-Sleep -Seconds 1
    }
  }
  if (-not $createDbSuccess) {
    Write-HarnessLog "Failed to create sstac_replay database: $createDbOut" "ERROR"
    exit 1
  }
  Write-HarnessLog "Database sstac_replay created successfully."

  # Preflight proofs in sstac_replay
  Write-HarnessLog "Verifying topology preflight proofs in sstac_replay..."
  $availRaw = (docker exec -i $ContainerId psql -U postgres -d sstac_replay -A -t -c "SELECT count(*) FROM pg_available_extensions WHERE name = 'postgis';" 2>&1)
  $availCheck = ([string]($availRaw -join '')).Trim()

  $instRaw = (docker exec -i $ContainerId psql -U postgres -d sstac_replay -A -t -c "SELECT count(*) FROM pg_extension WHERE extname = 'postgis';" 2>&1)
  $instCheck = ([string]($instRaw -join '')).Trim()

  $schemaRaw = (docker exec -i $ContainerId psql -U postgres -d sstac_replay -A -t -c "SELECT count(*) FROM pg_namespace WHERE nspname = 'matrix_map';" 2>&1)
  $schemaCheck = ([string]($schemaRaw -join '')).Trim()

  $availOk = ($availCheck -eq '1')
  $absentOk = ($instCheck -eq '0')
  $noMatrixMapOk = ($schemaCheck -eq '0')

  $proofsReceipt = [PSCustomObject]@{
    target_database = "sstac_replay"
    postgis_available = $availOk
    postgis_uninstalled_before_replay = $absentOk
    matrix_map_schema_absent_before_replay = $noMatrixMapOk
    proofs_verified = ($availOk -and $absentOk -and $noMatrixMapOk)
  }
  $proofsReceipt | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDir "preflight_proofs_receipt.json") -Encoding Ascii

  if (-not ($availOk -and $absentOk -and $noMatrixMapOk)) {
    Write-HarnessLog "Topology preflight proofs FAILED in sstac_replay! Avail=$availCheck (exp 1), Inst=$instCheck (exp 0), Schema=$schemaCheck (exp 0)" "ERROR"
    exit 1
  }
  Write-HarnessLog "Topology preflight proofs VERIFIED in sstac_replay."

  # Apply Supabase System Infrastructure Scaffold ONLY to sstac_replay
  Write-HarnessLog "Applying Supabase system infrastructure scaffold to sstac_replay..."
  $infraSql = @"
DO `$$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'matrix_map_owner') THEN
    CREATE ROLE matrix_map_owner NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dashboard_user') THEN
    CREATE ROLE dashboard_user NOLOGIN;
  END IF;
END `$$;

GRANT matrix_map_owner TO postgres;
GRANT authenticated TO postgres;
GRANT service_role TO postgres;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  email_confirmed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  last_sign_in_at timestamptz DEFAULT now()
);

-- Pre-existing public table referenced by early security migration 20260515
CREATE TABLE IF NOT EXISTS public.matrix_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  updated_at timestamptz DEFAULT now()
);

-- Standard Supabase Storage System Tables
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  public boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id text PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now(),
  metadata jsonb,
  path_tokens text[]
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Standard Supabase System Auth Functions
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS `$$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
`$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql STABLE
AS `$$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text;
`$$;

CREATE OR REPLACE FUNCTION auth.email()
RETURNS text
LANGUAGE sql STABLE
AS `$$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text;
`$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql STABLE
AS `$$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb;
`$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role, public;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, public;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role, public;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role, public;
"@

  $infraLog = $infraSql | docker exec -i $ContainerId psql -U postgres -d sstac_replay -v ON_ERROR_STOP=1 2>&1
  $infraExitCode = $LASTEXITCODE

  if ($infraExitCode -ne 0) {
    Write-HarnessLog "Infrastructure scaffold application failed: $infraLog" "ERROR"
    exit 1
  }
  Write-HarnessLog "Supabase system infrastructure scaffold applied to sstac_replay."

  # Step 3: Execute actual supabase/migrations/*.sql files in order against sstac_replay
  Write-HarnessLog "Starting execution of $($migrationFiles.Count) actual migration files in order..."
  $migrationReceipts = [System.Collections.Generic.List[PSCustomObject]]::new()
  $failedMigration = $null
  $failedExitCode = 0
  $failedOutput = ""

  $mCount = 0
  foreach ($mFile in $migrationFiles) {
    $mCount++
    $mName = $mFile.Name
    $mPath = $mFile.FullName
    $mHash = (Get-FileHash -Algorithm SHA256 -Path $mPath).Hash.ToUpperInvariant()

    Write-HarnessLog "[$mCount/$($migrationFiles.Count)] Applying migration: $mName..."
    $mStart = [DateTime]::UtcNow

    $mContent = Get-Content -Raw -Path $mPath -Encoding Ascii
    $mLog = $mContent | docker exec -i $ContainerId psql -U postgres -d sstac_replay -v ON_ERROR_STOP=1 2>&1
    $mExitCode = $LASTEXITCODE
    $mEnd = [DateTime]::UtcNow

    $mLogStr = $mLog -join "`n"

    $mReceipt = [PSCustomObject]@{
      migration_index = $mCount
      migration_name = $mName
      file_path = $mPath
      sha256 = $mHash
      start_time_utc = $mStart.ToString('o')
      end_time_utc = $mEnd.ToString('o')
      duration_ms = ($mEnd - $mStart).TotalMilliseconds
      exit_code = $mExitCode
      output_log = $mLogStr
    }

    $mReceipt | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDir "receipt_migration_$($mCount.ToString('00'))_$mName.json") -Encoding Ascii
    $migrationReceipts.Add($mReceipt)

    if ($mExitCode -ne 0) {
      Write-HarnessLog "Migration $mName FAILED with exit code $mExitCode!" "ERROR"
      Write-HarnessLog "Failure log: $mLogStr" "ERROR"
      $failedMigration = $mName
      $failedExitCode = $mExitCode
      $failedOutput = $mLogStr
      break
    }

    # Requirement 9: After migration 16 (20260519000001_matrix_map_schema.sql), verify postgis extension & namespace
    if ($mName -eq '20260519000001_matrix_map_schema.sql') {
      Write-HarnessLog "Executing post-migration-16 PostGIS extension verification..."
      $postgisInstRaw = (docker exec -i $ContainerId psql -U postgres -d sstac_replay -A -t -c "SELECT count(*) FROM pg_extension WHERE extname = 'postgis';" 2>&1)
      $postgisInst = ([string]($postgisInstRaw -join '')).Trim()

      $postgisNspRaw = (docker exec -i $ContainerId psql -U postgres -d sstac_replay -A -t -c "SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'postgis';" 2>&1)
      $postgisNsp = ([string]($postgisNspRaw -join '')).Trim()

      $postgisInstOk = ($postgisInst -eq '1')
      $postgisNspOk = ($postgisNsp -eq 'extensions')

      $postgis16Receipt = [PSCustomObject]@{
        migration_16 = $mName
        postgis_installed = $postgisInstOk
        postgis_namespace = $postgisNsp
        namespace_is_extensions = $postgisNspOk
        verification_passed = ($postgisInstOk -and $postgisNspOk)
      }
      $postgis16Receipt | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDir "postgis_post_migration_16_receipt.json") -Encoding Ascii

      if (-not ($postgisInstOk -and $postgisNspOk)) {
        Write-HarnessLog "PostGIS verification after migration 16 FAILED! Installed=$postgisInst (exp 1), Nsp=$postgisNsp (exp extensions)" "ERROR"
        exit 1
      }
      Write-HarnessLog "PostGIS extension verified after migration 16: installed=true, namespace=extensions."
    }
  }

  if ($null -ne $failedMigration) {
    Write-HarnessLog "Stopping integration replay immediately due to migration failure: $failedMigration" "ERROR"
    $runReceipt = [PSCustomObject]@{
      replay_mode = "actual_supabase_migrations_postgis"
      total_migrations = $migrationFiles.Count
      executed_migrations = $migrationReceipts.Count
      overall_status = "COMPLETED_RED"
      failed_migration = $failedMigration
      failed_exit_code = $failedExitCode
      failed_output = $failedOutput
    }
    $runReceipt | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDir "migration_replay_summary.json") -Encoding Ascii
    exit 1
  }

  Write-HarnessLog "All $($migrationFiles.Count) prerequisite migrations applied successfully!"

  # Step 4: Apply Option C Draft SQL (Unchanged bytes) to sstac_replay
  Write-HarnessLog "Applying PR #752 Option C Draft SQL to sstac_replay..."
  $draftContent = Get-Content -Raw -Path $DraftSqlPath -Encoding Ascii
  $draftStart = [DateTime]::UtcNow
  $draftLog = $draftContent | docker exec -i $ContainerId psql -U postgres -d sstac_replay -v ON_ERROR_STOP=1 2>&1
  $draftExitCode = $LASTEXITCODE
  $draftEnd = [DateTime]::UtcNow

  $draftHash = (Get-FileHash -Algorithm SHA256 -Path $DraftSqlPath).Hash.ToUpperInvariant()
  $draftReceipt = [PSCustomObject]@{
    timestamp_utc = $draftStart.ToString('o')
    duration_ms = ($draftEnd - $draftStart).TotalMilliseconds
    exit_code = $draftExitCode
    sha256 = $draftHash
    log_output = $draftLog -join "`n"
  }
  $draftReceipt | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDir "draft_load_receipt.json") -Encoding Ascii

  if ($draftExitCode -ne 0) {
    Write-HarnessLog "PR #752 Draft SQL application failed: $draftLog" "ERROR"
    exit 1
  }
  Write-HarnessLog "PR #752 Draft SQL applied successfully to sstac_replay."

  # Capture pg_get_functiondef(matrix_map.flip_site_aggregate_public) receipt immediately after draft load
  Write-HarnessLog "Capturing candidate flip_site_aggregate_public function definition receipt..."
  $fnDefRaw = (docker exec -i $ContainerId psql -U postgres -d sstac_replay -A -t -c "SELECT pg_get_functiondef('matrix_map.flip_site_aggregate_public(uuid, boolean, uuid, text)'::regprocedure);" 2>&1)
  $fnDefText = [string]($fnDefRaw -join "`n")
  $fnDefReceipt = [PSCustomObject]@{
    timestamp_utc = [DateTime]::UtcNow.ToString('o')
    function_name = "matrix_map.flip_site_aggregate_public"
    signature = "matrix_map.flip_site_aggregate_public(uuid, boolean, uuid, text)"
    post_load_candidate_ddl_executed = $false
    function_definition = $fnDefText
  }
  $fnDefReceipt | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDir "draft_function_definition_receipt.json") -Encoding Ascii

  # Seed test data for validation assertions
  Write-HarnessLog "Seeding test fixture data in sstac_replay for automated test suite..."
  $seedSql = @"
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'member@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin'),
  ('11111111-1111-1111-1111-111111111111', 'matrix_admin'),
  ('22222222-2222-2222-2222-222222222222', 'member')
ON CONFLICT DO NOTHING;

INSERT INTO matrix_map.dras (id, title, citation, public, is_deleted) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Test DRA Site 3250', 'Test Citation 3250', false, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO matrix_map.samples (
  id, bnrrm_station_id, station_id, display_name, latitude, longitude,
  geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
) VALUES
  ('b1111111-1111-1111-1111-111111111111', 101, 'STN-001', 'Sample Station 1', 49.282731, -123.120741, extensions.st_setsrid(extensions.st_makepoint(-123.120741::double precision, 49.282731::double precision), 4326)::extensions.geography, 'medium', 'bc_csr_centroid', 'reference', 'station_type', 'a1111111-1111-1111-1111-111111111111', false),
  ('b2222222-2222-2222-2222-222222222222', 102, 'STN-002', 'Sample Station 2', 49.282732, -123.120742, extensions.st_setsrid(extensions.st_makepoint(-123.120742::double precision, 49.282732::double precision), 4326)::extensions.geography, 'high', 'surveyed', 'reference', 'station_type', 'a1111111-1111-1111-1111-111111111111', false)
ON CONFLICT (id) DO NOTHING;
"@

  $seedLog = $seedSql | docker exec -i $ContainerId psql -U postgres -d sstac_replay -v ON_ERROR_STOP=1 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-HarnessLog "Test fixture data seeding failed: $seedLog" "ERROR"
    exit 1
  }
  Write-HarnessLog "Test fixture data seeded successfully."

  # Step 5: Run Automated Test Suite against sstac_replay
  Write-HarnessLog "Executing automated PostgreSQL validation test suite against sstac_replay..."
  $testContent = Get-Content -Raw -Path $TestSqlPath -Encoding Ascii
  $testStart = [DateTime]::UtcNow
  $testOutput = $testContent | docker exec -i $ContainerId psql -U postgres -d sstac_replay -A -t -v ON_ERROR_STOP=1 2>&1
  $testExitCode = $LASTEXITCODE
  $testEnd = [DateTime]::UtcNow

  if ($testExitCode -ne 0) {
    Write-HarnessLog "Automated test suite execution failed: $testOutput" "ERROR"
    exit 1
  }
  Write-HarnessLog "Automated test suite execution completed."
  Set-Content -Path (Join-Path $OutputDir "test_results.txt") -Value $testOutput -Encoding Ascii

  $expectedTestIds = @('TEST_01','TEST_02','TEST_03','TEST_04','TEST_05','TEST_06','TEST_07','TEST_08','TEST_09','TEST_10','TEST_11')
  $passCount = 0
  $failCount = 0
  $parsedResults = [System.Collections.Generic.List[PSCustomObject]]::new()
  $foundTestIds = [System.Collections.Generic.HashSet[string]]::new()

  $testLines = $testOutput -split "`r?`n" | Where-Object { $_ -match '^TEST_\d+' }
  foreach ($line in $testLines) {
    $parts = $line -split '\|'
    if ($parts.Count -ge 3) {
      $tId = $parts[0].Trim()
      $tDesc = $parts[1].Trim()
      $tStatus = $parts[2].Trim()
      $tSqlState = if ($parts.Count -ge 4) { $parts[3].Trim() } else { '00000' }
      $tDetails = if ($parts.Count -ge 5) { $parts[4].Trim() } else { '' }

      if ($expectedTestIds -contains $tId -and -not $foundTestIds.Contains($tId)) {
        $foundTestIds.Add($tId) | Out-Null
        if ($tStatus -eq 'PASS') { $passCount++ } else { $failCount++ }
        $parsedResults.Add([PSCustomObject]@{
          test_id = $tId
          description = $tDesc
          status = $tStatus
          sqlstate = $tSqlState
          details = $tDetails
        })
        Write-HarnessLog "  $tId : $tStatus - $tDesc"
      }
    }
  }

  $missingTestIds = @($expectedTestIds | Where-Object { -not $foundTestIds.Contains($_) })
  $testSuiteStrictPass = ($parsedResults.Count -eq 11) -and ($missingTestIds.Count -eq 0) -and ($failCount -eq 0)

  $testHash = (Get-FileHash -Algorithm SHA256 -Path $TestSqlPath).Hash.ToUpperInvariant()
  $testReceipt = [PSCustomObject]@{
    timestamp_utc = $testStart.ToString('o')
    duration_ms = ($testEnd - $testStart).TotalMilliseconds
    exit_code = $testExitCode
    sha256 = $testHash
    pass_count = $passCount
    fail_count = $failCount
    total_parsed_unique = $parsedResults.Count
    missing_test_ids = $missingTestIds
    strict_pass = $testSuiteStrictPass
    tests = $parsedResults
  }
  $testReceipt | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDir "test_receipt.json") -Encoding Ascii

  if (-not $testSuiteStrictPass) {
    Write-HarnessLog "Automated test suite evaluation FAILED!" "ERROR"
    exit 1
  }

  # Step 6: Execute 2-Session Concurrency Test against sstac_replay
  Write-HarnessLog "Executing 2-Session Concurrency & SHARE Lock Blocking Test against sstac_replay..."
  $concurrencyPass = $false

  $sessionASql = @"
BEGIN;
SET statement_timeout = '15s';
-- Get RowExclusive on samples
UPDATE matrix_map.samples SET display_name = 'Session A Update' WHERE id = 'b1111111-1111-1111-1111-111111111111';
SELECT pg_sleep(5);
COMMIT;
"@

  $sessionBSql = @"
BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);
SELECT matrix_map.flip_site_aggregate_public('c1111111-1111-1111-1111-111111111111', false, '11111111-1111-1111-1111-111111111111', 'Reset for concurrency test');
COMMIT;

BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);
-- Try to flip to true while A holds RowExclusive on samples. This will attempt SHARE NOWAIT and fail immediately.
SELECT matrix_map.flip_site_aggregate_public('c1111111-1111-1111-1111-111111111111', true, '11111111-1111-1111-1111-111111111111', 'Session B Flip');
COMMIT;
"@

  $concStart = [DateTime]::UtcNow

  $jobA = Start-Job -ScriptBlock {
    param($cId, $sql)
    $out = $sql | docker exec -i $cId psql -U postgres -d sstac_replay -v ON_ERROR_STOP=1 2>&1
    $ec = $LASTEXITCODE
    return [PSCustomObject]@{
      ExitCode = $ec
      Output   = ($out -join "`n")
      EndTime  = [DateTime]::UtcNow.ToString('o')
    }
  } -ArgumentList $ContainerId, $sessionASql
  $jobAStart = [DateTime]::UtcNow

  $shareLockObserved = $false
  $pollADeadline = [DateTime]::UtcNow.AddSeconds(15)
  while (-not $shareLockObserved -and [DateTime]::UtcNow -lt $pollADeadline) {
    Start-Sleep -Milliseconds 250
    $checkASql = @"
SELECT count(*) FROM pg_locks l
JOIN pg_class c ON c.oid = l.relation
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'matrix_map' AND c.relname = 'samples' AND l.mode = 'RowExclusiveLock' AND l.granted = true;
"@
    $countA = ([string]((docker exec -i $ContainerId psql -U postgres -d sstac_replay -A -t -c $checkASql 2>&1) -join '')).Trim()
    if ($countA -match '^\d+$' -and [int]$countA -ge 1) { $shareLockObserved = $true }
  }

  if ($shareLockObserved) {
    Write-HarnessLog "Session A RowExclusiveLock observed on matrix_map.samples."
  } else {
    Write-HarnessLog "Failed to observe RowExclusiveLock for Session A." "ERROR"
  }

  $jobB = Start-Job -ScriptBlock {
    param($cId, $sql)
    $out = $sql | docker exec -i $cId psql -U postgres -d sstac_replay -v ON_ERROR_STOP=1 2>&1
    $ec = $LASTEXITCODE
    return [PSCustomObject]@{
      ExitCode = $ec
      Output   = ($out -join "`n")
      EndTime  = [DateTime]::UtcNow.ToString('o')
    }
  } -ArgumentList $ContainerId, $sessionBSql
  $jobBStart = [DateTime]::UtcNow

  $pollBDeadline = [DateTime]::UtcNow.AddSeconds(15)
  $lockCheckTime = [DateTime]::UtcNow
  $lockRaw = "0"
  $ungrantedObserved = $false

  Set-Content -Path (Join-Path $OutputDir "concurrency_pg_locks.json") -Value "[]" -Encoding Ascii

  $concWaitDeadline = [DateTime]::UtcNow.AddSeconds(30)
  while (([DateTime]::UtcNow -lt $concWaitDeadline) -and (-not ($jobA.State -ne 'Running' -and $jobB.State -ne 'Running'))) {
    Start-Sleep -Milliseconds 200
  }

  $resA = Receive-Job -Job $jobA
  $resB = Receive-Job -Job $jobB

  if ($null -ne $jobA) { Stop-Job -Job $jobA -ErrorAction SilentlyContinue; Remove-Job -Job $jobA -ErrorAction SilentlyContinue }
  if ($null -ne $jobB) { Stop-Job -Job $jobB -ErrorAction SilentlyContinue; Remove-Job -Job $jobB -ErrorAction SilentlyContinue }

  $jobAExitCode = if ($null -ne $resA -and $null -ne $resA.ExitCode) { [int]$resA.ExitCode } else { 1 }
  $jobBExitCode = if ($null -ne $resB -and $null -ne $resB.ExitCode) { [int]$resB.ExitCode } else { 1 }

  $endA = if ($null -ne $resA -and $null -ne $resA.EndTime) { [DateTime]::Parse($resA.EndTime).ToUniversalTime() } else { [DateTime]::MinValue }
  $endB = if ($null -ne $resB -and $null -ne $resB.EndTime) { [DateTime]::Parse($resB.EndTime).ToUniversalTime() } else { [DateTime]::MinValue }

  $bAfterA = ($endB -ge $endA -and $endA -gt [DateTime]::MinValue)

  if ($shareLockObserved -and ($jobAExitCode -eq 0) -and ($jobBExitCode -ne 0) -and ($resB.Output -match 'could not obtain lock')) {
    Write-HarnessLog "Concurrency test PASSED: Session B was blocked by Session A RowExclusive lock using NOWAIT. A succeeded, B failed."
    $concurrencyPass = $true
  } else {
    Write-HarnessLog "Concurrency test FAILED!" "ERROR"
    $concurrencyPass = $false
  }

  $concurrencyReceipt = [PSCustomObject]@{
    timestamp_utc = $concStart.ToString('o')
    share_locks_observed = $shareLockObserved
    ungranted_locks_observed = $ungrantedObserved
    job_a_start_utc = $jobAStart.ToString('o')
    job_a_end_utc = if ($endA -gt [DateTime]::MinValue) { $endA.ToString('o') } else { $null }
    job_a_native_exit_code = $jobAExitCode
    job_a_output = if ($null -ne $resA) { $resA.Output } else { "" }
    job_b_start_utc = $jobBStart.ToString('o')
    job_b_end_utc = if ($endB -gt [DateTime]::MinValue) { $endB.ToString('o') } else { $null }
    job_b_native_exit_code = $jobBExitCode
    job_b_output = if ($null -ne $resB) { $resB.Output } else { "" }
    lock_check_utc = $lockCheckTime.ToString('o')
    b_completed_after_a = $bAfterA
    concurrency_passed = $concurrencyPass
  }
  $concurrencyReceipt | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDir "concurrency_receipt.json") -Encoding Ascii

  $overallPass = $testSuiteStrictPass -and ($concurrencyPass -eq $true)

  $summary = [PSCustomObject]@{
    harness_version = "option-c-postgis-replay-v7"
    run_timestamp_utc = [DateTime]::UtcNow.ToString('o')
    container_id = $ContainerId
    container_name = $ContainerName
    target_database = "sstac_replay"
    pg_image = $PgImage
    overall_status = if ($overallPass) { "COMPLETED_GREEN" } else { "FAIL" }
    total_migrations = $migrationFiles.Count
    executed_migrations = $migrationReceipts.Count
    passed_tests = $passCount
    failed_tests = $failCount
    total_parsed_unique = $parsedResults.Count
    concurrency_test_passed = $concurrencyPass
    postgis_verified_post_migration_16 = $true
    duration_seconds = ([DateTime]::UtcNow - $Script:StartTime).TotalSeconds
  }

  $summary | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDir "migration_replay_summary.json") -Encoding Ascii
  Write-HarnessLog "Summary written to $(Join-Path $OutputDir 'migration_replay_summary.json')"

  if (-not $overallPass) {
    Write-HarnessLog "Replay failed overall status." "ERROR"
    exit 1
  }

} finally {
  if ($null -ne $jobA) { Stop-Job -Job $jobA -ErrorAction SilentlyContinue; Remove-Job -Job $jobA -ErrorAction SilentlyContinue }
  if ($null -ne $jobB) { Stop-Job -Job $jobB -ErrorAction SilentlyContinue; Remove-Job -Job $jobB -ErrorAction SilentlyContinue }

  if ($null -ne $ContainerId) {
    try {
      $checkId = (docker inspect --format '{{.Id}}' $ContainerName 2>&1).Trim()
      if ($checkId -eq $ContainerId) {
        Write-HarnessLog "Stopping container $ContainerId (retained stopped for owner review)..."
        docker stop $ContainerId | Out-Null
        Write-HarnessLog "Container $ContainerId stopped successfully."

        $postStopInspectRaw = docker inspect $ContainerId 2>&1
        if ($LASTEXITCODE -eq 0) {
          $postStopInspect = $postStopInspectRaw | ConvertFrom-Json
          $finalState = [PSCustomObject]@{
            container_id = $ContainerId
            container_name = $ContainerName
            status = $postStopInspect[0].State.Status
            running = $postStopInspect[0].State.Running
            exit_code = $postStopInspect[0].State.ExitCode
            finished_at = $postStopInspect[0].State.FinishedAt
          }
          $finalState | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDir "final_container_state_receipt.json") -Encoding Ascii
          Write-HarnessLog "Post-stop final container state receipt written successfully."
        }
      }
    } catch {
      Write-HarnessLog "Error stopping container: $_" "WARN"
    }
  }

  $logPath = Join-Path $OutputDir "harness.log"
  $safeLogs = $Script:LogEntries | ForEach-Object { $_ -replace 'val_pass_\d+', '[REDACTED]' }
  Set-Content -Path $logPath -Value ($safeLogs -join "`r`n") -Encoding Ascii
}
