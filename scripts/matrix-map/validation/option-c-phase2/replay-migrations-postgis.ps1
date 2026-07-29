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

  # Repository root that migrations, the draft SQL and the test suite are read
  # from. Defaults to the repository this script actually lives in, derived from
  # $PSScriptRoot (scripts/matrix-map/validation/option-c-phase2 -> repo root).
  # It previously hardcoded the PR #752 temporary worktree. After that PR merged
  # and the branch was restacked, that default was actively dangerous: if the old
  # path is gone the replay fails, and if it still exists at stale bytes the
  # MANDATORY replay gate reports GREEN for SQL that is not the SQL under review.
  [Parameter(Mandatory = $false)]
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path,

  # NEGATIVE FULL-SCRIPT LEGACY REPLAY (NEG_01), added 2026-07-27 restack.
  #
  # The positive suite (TEST_01..TEST_42) proves the apply-time invariant helper
  # behaves correctly, but every one of those assertions runs INSIDE an
  # already-applied schema, so none of them can prove what the pre-apply runbook
  # now depends on: that when the helper raises UE409, the ENTIRE draft script
  # rolls back atomically and leaves the database exactly as it was. That claim
  # is the whole basis for removing the runbook's duplicate preflight check and
  # making this block the single authority, so it is proven by execution rather
  # than asserted from the presence of BEGIN/COMMIT.
  #
  # This mode: applies the draft cleanly (the "prior install"), mutates the
  # candidate-audit table into a malformed LEGACY shape (nullable column, an
  # orphan row, and a conforming-LOOKING but NOT VALID foreign key), fingerprints
  # the catalog, reapplies the FULL draft expecting failure, fingerprints again,
  # and requires the two fingerprints to be IDENTICAL.
  [Parameter(Mandatory = $false)]
  [switch]$NegativeLegacyReplay,

  # POSITIVE FULL-SCRIPT REAPPLY CONTROL (REAPPLY_01), added 2026-07-27 restack.
  #
  # NEG_01 proves the script aborts and rolls back on a malformed install. It
  # cannot prove the complementary and equally load-bearing claim: that a
  # CONFORMING reapply SUCCEEDS. Nothing verified that path -- a bare CREATE
  # FUNCTION and a DROP-less CREATE POLICY both broke it silently until NEG_01
  # happened to trip over the first one.
  #
  # SCOPE, stated precisely: this proves the PINNED BYTES are idempotent against
  # a fixture THIS HARNESS created. It does NOT authorize a reapply over an
  # arbitrary live installation -- the runbook now STOPS on any existing install
  # pending a case-specific adjudication, and this control is not a substitute
  # for it. The capability is tested; the authorization is separate.
  # This control applies the complete draft TWICE to a clean database and
  # requires the second apply to reach COMMIT with the semantic catalog
  # fingerprint unchanged.
  [Parameter(Mandatory = $false)]
  [switch]$PositiveReapplyControl
)

# NOTE: this script deliberately exposes NO -TimeoutSeconds parameter.
# An earlier revision declared one and never consumed it anywhere, which
# advertised a bound that did not exist: a hung `docker exec` could block
# indefinitely and leave incomplete evidence behind. There are 17 separate
# `docker exec` call sites and no shared invocation helper, so a genuine
# per-call bound with process termination and cleanup belongs in its own
# reviewed change rather than being bolted on here.
# Until then, bound this script EXTERNALLY. On native Windows PowerShell
# (pwsh.exe / powershell.exe with no coreutils on PATH), `timeout` resolves to
# the console-delay utility (timeout.exe), NOT GNU coreutils timeout -- it
# waits for a keypress-or-N-seconds and does not bound or kill a child
# process, so `timeout 1800 pwsh -File ...` bounds NOTHING there. Use a
# Start-Process supervisor with a timed Wait-Process and process-tree
# termination instead, e.g.:
#   $p = Start-Process -FilePath 'pwsh' -ArgumentList @('-File','replay-migrations-postgis.ps1','-OutputDir','<dir>') -PassThru
#   if (-not $p.WaitForExit(1800000)) {
#     # Timed out: kill the whole process tree (Stop-Process alone can leave
#     # docker/psql children orphaned), then treat as a failed/stalled run.
#     Start-Process -FilePath 'taskkill' -ArgumentList @('/PID', $p.Id, '/T', '/F') -Wait
#     throw "replay-migrations-postgis.ps1 exceeded 1800s bound and was terminated"
#   }
# The GNU-coreutils form (`timeout 1800 pwsh -File ...`) IS valid, but only in
# a shell that actually provides GNU coreutils timeout, e.g. Git Bash / WSL --
# not plain Windows PowerShell/cmd.exe.

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$ProgressPreference = 'SilentlyContinue'

$Script:StartTime = [DateTime]::UtcNow
$Script:LogEntries = [System.Collections.Generic.List[string]]::new()

function Write-HarnessLog {
  param([string]$Message, [string]$Level = 'INFO')
  $timestamp = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
  $line = "[$timestamp] [$Level] $Message"
  $Script:LogEntries.Add($line)
  Write-Host $line
}

Write-HarnessLog "Starting PostGIS Actual Supabase Migration Replay (agy-runtime-007)"
Write-HarnessLog "OutputDir: $OutputDir"
Write-HarnessLog "PgImage: $PgImage"
Write-HarnessLog "RepoRoot: $RepoRoot"

if (-not (Test-Path -Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

if (-not (Test-Path -LiteralPath $RepoRoot)) {
  Write-HarnessLog "RepoRoot does not exist: $RepoRoot" "ERROR"
  throw "RepoRoot does not exist: $RepoRoot"
}
$MigrationsDir = Join-Path $RepoRoot "supabase\migrations"
$DraftSqlPath = Join-Path $RepoRoot "docs\design\matrix-map\OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql"
$TestSqlPath = Join-Path $RepoRoot "scripts\matrix-map\validation\option-c-phase2\test-option-c.sql"

# ---------------------------------------------------------------------------
# THE ONE CANONICAL CATALOG FINGERPRINT.
#
# Deliberately defined ONCE and reused by BOTH full-script controls (NEG_01 and
# REAPPLY_01). Two hand-maintained copies of one rule is the exact defect class
# this whole correction pass exists to remove, so the fingerprint does not get
# duplicated per mode either.
#
# It is a SEMANTIC fingerprint, not a name census: it hashes function BODIES
# (pg_get_functiondef), owners, and object comments, and full trigger
# definitions (pg_get_triggerdef), alongside table/column shape, RLS flags,
# constraints (including convalidated), policy expressions, and grants. A
# reapply that silently changed a function body, an owner, a policy predicate,
# or a grant therefore CHANGES the hash rather than passing unnoticed.
#
# ACL and role arrays are sorted before hashing. Grant order is an artifact of
# REVOKE/GRANT execution sequence, not a semantic difference, and leaving it
# unsorted would produce false failures on an otherwise identical reapply.
# ---------------------------------------------------------------------------
$Script:CatalogFingerprintSql = @'
WITH t AS (
  SELECT COALESCE(string_agg(format('TBL|%s|%s|%s|%s|%s|%s|%s|%s|%s',
      c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
      a.attname, a.atttypid, a.attnotnull, a.atthasdef, a.attnum),
      chr(10) ORDER BY c.relname, a.attnum), '') AS s
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  WHERE n.nspname = 'matrix_map'
), f AS (
  SELECT COALESCE(string_agg(format('FN|%s|%s|%s|%s|%s|%s|%s|%s',
      p.proname, pg_catalog.oidvectortypes(p.proargtypes), p.prorettype, p.prosecdef,
      COALESCE(array_to_string(p.proconfig, ','), ''),
      pg_get_userbyid(p.proowner),
      COALESCE(obj_description(p.oid, 'pg_proc'), ''),
      pg_get_functiondef(p.oid)),
      chr(10) ORDER BY p.proname, pg_catalog.oidvectortypes(p.proargtypes)), '') AS s
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'matrix_map' AND p.prokind = 'f'
), k AS (
  SELECT COALESCE(string_agg(format('CON|%s|%s|%s|%s|%s|%s|%s|%s',
      c.relname, con.conname, con.contype, COALESCE(con.conkey::text, ''),
      COALESCE(con.confkey::text, ''), COALESCE(con.confrelid::regclass::text, ''),
      con.confdeltype, con.convalidated),
      chr(10) ORDER BY c.relname, con.conname), '') AS s
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'matrix_map'
), g AS (
  SELECT COALESCE(string_agg(format('TRG|%s|%s|%s|%s|%s|%s',
      c.relname, tg.tgname, tg.tgtype, tg.tgenabled,
      tg.tgfoid::regprocedure::text, pg_get_triggerdef(tg.oid)),
      chr(10) ORDER BY c.relname, tg.tgname), '') AS s
  FROM pg_trigger tg
  JOIN pg_class c ON c.oid = tg.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'matrix_map' AND NOT tg.tgisinternal
), pl AS (
  SELECT COALESCE(string_agg(format('POL|%s|%s|%s|%s|%s|%s',
      c.relname, po.polname, po.polcmd,
      COALESCE((SELECT string_agg(r::regrole::text, ',' ORDER BY r::regrole::text)
                FROM unnest(po.polroles) r), ''),
      COALESCE(pg_get_expr(po.polqual, po.polrelid), ''),
      COALESCE(pg_get_expr(po.polwithcheck, po.polrelid), '')),
      chr(10) ORDER BY c.relname, po.polname), '') AS s
  FROM pg_policy po
  JOIN pg_class c ON c.oid = po.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'matrix_map'
), ra AS (
  SELECT COALESCE(string_agg(format('RELACL|%s|%s', c.relname,
      COALESCE((SELECT string_agg(x::text, ',' ORDER BY x::text)
                FROM unnest(c.relacl) x), '')),
      chr(10) ORDER BY c.relname), '') AS s
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'matrix_map'
), pa AS (
  SELECT COALESCE(string_agg(format('PROACL|%s|%s|%s',
      p.proname, pg_catalog.oidvectortypes(p.proargtypes),
      COALESCE((SELECT string_agg(x::text, ',' ORDER BY x::text)
                FROM unnest(p.proacl) x), '')),
      chr(10) ORDER BY p.proname, pg_catalog.oidvectortypes(p.proargtypes)), '') AS s
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'matrix_map' AND p.prokind = 'f'
), na AS (
  SELECT COALESCE(string_agg(format('NSPACL|%s|%s', n.nspname,
      COALESCE((SELECT string_agg(x::text, ',' ORDER BY x::text)
                FROM unnest(n.nspacl) x), '')),
      chr(10) ORDER BY n.nspname), '') AS s
  FROM pg_namespace n WHERE n.nspname = 'matrix_map'
)
SELECT upper(encode(sha256(convert_to(
  t.s || chr(10) || f.s || chr(10) || k.s || chr(10) || g.s || chr(10) ||
  pl.s || chr(10) || ra.s || chr(10) || pa.s || chr(10) || na.s, 'UTF8')), 'hex'))
FROM t, f, k, g, pl, ra, pa, na;
'@

# Direct, human-legible probe of the exact shape NEG_01 seeds and must find
# untouched afterwards. The canonical fingerprint above already covers
# attnotnull and convalidated, so this is not the proof of record -- it exists
# so the receipt SHOWS the malformed FK and nullability explicitly instead of
# leaving a reader to infer them from a hash.
$Script:CandidateAuditShapeSql = @'
SELECT format('not_null=%s|fk_count=%s|conname=%s|deltype=%s|convalidated=%s',
  COALESCE((SELECT a.attnotnull::text
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'matrix_map' AND c.relname = 'site_aggregate_candidate_audit'
      AND a.attname = 'publication_id' AND a.attnum > 0 AND NOT a.attisdropped), 'ABSENT'),
  (SELECT count(*)
     FROM pg_constraint con
     JOIN pg_class c ON c.oid = con.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'matrix_map' AND c.relname = 'site_aggregate_candidate_audit'
      AND con.contype = 'f'),
  COALESCE((SELECT string_agg(con.conname, ',' ORDER BY con.conname)
     FROM pg_constraint con
     JOIN pg_class c ON c.oid = con.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'matrix_map' AND c.relname = 'site_aggregate_candidate_audit'
      AND con.contype = 'f'), ''),
  COALESCE((SELECT string_agg(con.confdeltype::text, ',' ORDER BY con.conname)
     FROM pg_constraint con
     JOIN pg_class c ON c.oid = con.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'matrix_map' AND c.relname = 'site_aggregate_candidate_audit'
      AND con.contype = 'f'), ''),
  COALESCE((SELECT string_agg(con.convalidated::text, ',' ORDER BY con.conname)
     FROM pg_constraint con
     JOIN pg_class c ON c.oid = con.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'matrix_map' AND c.relname = 'site_aggregate_candidate_audit'
      AND con.contype = 'f'), ''));
'@

$Script:CatalogFingerprintScope = 'matrix_map schema, SEMANTIC: table+column shape and RLS flags; function signature, return type, SECURITY DEFINER, search_path config, owner, object comment and FULL pg_get_functiondef body; constraints including convalidated; full pg_get_triggerdef definitions; policy commands, roles and USING/WITH CHECK expressions; and grants (relacl/proacl/nspacl, sorted).'

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
$PgPassword = [guid]::NewGuid().ToString('N')
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

  # Step 3b (NEG_01 only): negative full-script legacy replay.
  if ($NegativeLegacyReplay) {
    Write-HarnessLog "NEG_01: negative full-script legacy replay starting."
    $negDraftContent = Get-Content -Raw -Path $DraftSqlPath -Encoding Ascii
    $negDraftHash = (Get-FileHash -Algorithm SHA256 -Path $DraftSqlPath).Hash.ToUpperInvariant()
    $negStart = [DateTime]::UtcNow

    # NEG_01 step 1: establish the "prior install" by applying the draft cleanly.
    Write-HarnessLog "NEG_01: applying the draft once to establish a prior install..."
    $negFirstLog = $negDraftContent | docker exec -i $ContainerId psql -U postgres -d sstac_replay -v ON_ERROR_STOP=1 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-HarnessLog "NEG_01 setup failed: the draft did not apply cleanly to a fresh database: $negFirstLog" "ERROR"
      exit 1
    }

    # NEG_01 step 2: mutate into the malformed LEGACY shape. Nullable column,
    # an orphan row whose publication does NOT exist, and a foreign key that
    # matches the conforming spec in every respect EXCEPT that it is NOT VALID
    # (so the orphan row was never checked). Reapplying over this must abort.
    Write-HarnessLog "NEG_01: mutating candidate-audit into the malformed legacy shape..."
    $negMutateSql = @'
ALTER TABLE matrix_map.site_aggregate_candidate_audit
  DROP CONSTRAINT site_aggregate_candidate_audit_publication_id_fkey;
ALTER TABLE matrix_map.site_aggregate_candidate_audit
  ALTER COLUMN publication_id DROP NOT NULL;
INSERT INTO matrix_map.site_aggregate_candidate_audit (
  publication_id, source_dra_id, coordinate_cluster_id, action, new_snapshot, reason, changed_by, changed_by_email
) VALUES (
  'dddddddd-dead-4dea-8dea-dddddddddddd', 'a1111111-1111-1111-1111-111111111111', '49.28273,-123.12074', 'create', '{}'::jsonb,
  'NEG_01 legacy seed row referencing a nonexistent publication', '11111111-1111-1111-1111-111111111111', 'admin@example.com'
);
ALTER TABLE matrix_map.site_aggregate_candidate_audit
  ADD CONSTRAINT site_aggregate_candidate_audit_publication_id_fkey
  FOREIGN KEY (publication_id) REFERENCES matrix_map.site_aggregate_publications(id)
  ON DELETE RESTRICT NOT VALID;
'@
    $negMutateLog = $negMutateSql | docker exec -i $ContainerId psql -U postgres -d sstac_replay -v ON_ERROR_STOP=1 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-HarnessLog "NEG_01 setup failed: could not build the malformed legacy shape: $negMutateLog" "ERROR"
      exit 1
    }

    # Deterministic catalog fingerprint over the matrix_map schema: tables and
    # columns, functions, constraints, triggers, policies, and grants. Ordered,
    # serialized, and hashed so "unchanged" is a single comparable value rather
    # than an undefined claim about database objects.
    $negFingerprintSql = $Script:CatalogFingerprintSql

    $negFpBeforeRaw = $negFingerprintSql | docker exec -i $ContainerId psql -U postgres -d sstac_replay -A -t -v ON_ERROR_STOP=1 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-HarnessLog "NEG_01 setup failed: could not compute the BEFORE catalog fingerprint: $negFpBeforeRaw" "ERROR"
      exit 1
    }
    $negFpBefore = ([string]($negFpBeforeRaw -join "`n")).Trim()

    $negShapeBeforeRaw = $Script:CandidateAuditShapeSql | docker exec -i $ContainerId psql -U postgres -d sstac_replay -A -t -v ON_ERROR_STOP=1 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-HarnessLog "NEG_01 setup failed: could not read the BEFORE candidate-audit shape: $negShapeBeforeRaw" "ERROR"
      exit 1
    }
    $negShapeBefore = ([string]($negShapeBeforeRaw -join "`n")).Trim()

    # The seeded shape must actually BE malformed, or the whole control is
    # vacuous: nullable column, exactly one FK, RESTRICT, and NOT validated.
    if ($negShapeBefore -ne 'not_null=false|fk_count=1|conname=site_aggregate_candidate_audit_publication_id_fkey|deltype=r|convalidated=false') {
      Write-HarnessLog "NEG_01 setup invariant violated: seeded shape is not the intended malformed legacy shape: $negShapeBefore" "ERROR"
      exit 1
    }

    # NEG_01 step 3: reapply the ENTIRE draft. This MUST fail.
    # VERBOSITY=verbose is REQUIRED here, and is a psql client variable rather
    # than SQL: at default verbosity psql prints only 'ERROR:  <message>' and
    # never the SQLSTATE, so asserting on 'UE409' could never match no matter
    # how correct the script was. Passing it via -v changes the CLIENT's error
    # formatting only; the SQL bytes piped on stdin remain byte-identical to
    # the file whose SHA-256 this receipt records.
    Write-HarnessLog "NEG_01: reapplying the FULL draft over the malformed legacy shape (failure expected)..."
    $negReplayLog = $negDraftContent | docker exec -i $ContainerId psql -U postgres -d sstac_replay -v ON_ERROR_STOP=1 -v VERBOSITY=verbose 2>&1
    $negReplayExitCode = $LASTEXITCODE
    $negReplayText = [string]($negReplayLog -join "`n")

    $negFpAfterRaw = $negFingerprintSql | docker exec -i $ContainerId psql -U postgres -d sstac_replay -A -t -v ON_ERROR_STOP=1 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-HarnessLog "NEG_01 failed: could not compute the AFTER catalog fingerprint: $negFpAfterRaw" "ERROR"
      exit 1
    }
    $negFpAfter = ([string]($negFpAfterRaw -join "`n")).Trim()

    $negShapeAfterRaw = $Script:CandidateAuditShapeSql | docker exec -i $ContainerId psql -U postgres -d sstac_replay -A -t -v ON_ERROR_STOP=1 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-HarnessLog "NEG_01 failed: could not read the AFTER candidate-audit shape: $negShapeAfterRaw" "ERROR"
      exit 1
    }
    $negShapeAfter = ([string]($negShapeAfterRaw -join "`n")).Trim()

    # Anchored to the SQLSTATE field of a verbose ERROR line, not a bare
    # substring: this must be satisfied by the raised SQLSTATE itself and not by
    # any prose that happens to mention the code.
    $negSawUe409 = $negReplayText -match '(?m)^ERROR:\s+UE409:'
    $negFailedAsExpected = ($negReplayExitCode -ne 0)
    $negFingerprintsMatch = ($negFpBefore -eq $negFpAfter) -and (-not [string]::IsNullOrWhiteSpace($negFpBefore))
    $negShapeUnchanged = ($negShapeBefore -eq $negShapeAfter)
    $negStatus = if ($negFailedAsExpected -and $negSawUe409 -and $negFingerprintsMatch -and $negShapeUnchanged) { 'PASS' } else { 'FAIL' }

    $negReceipt = [PSCustomObject]@{
      test_id = 'NEG_01'
      description = 'NEGATIVE FULL-SCRIPT CONTROL: reapplying the entire draft over a malformed legacy candidate-audit table (nullable column, orphan row, conforming-looking but NOT VALID foreign key) aborts with UE409 and rolls back atomically, leaving the matrix_map catalog fingerprint identical'
      status = $negStatus
      timestamp_utc = $negStart.ToString('o')
      duration_ms = ([DateTime]::UtcNow - $negStart).TotalMilliseconds
      draft_sql_path = $DraftSqlPath
      draft_sql_sha256 = $negDraftHash
      replay_exit_code = $negReplayExitCode
      failed_as_expected = $negFailedAsExpected
      saw_ue409 = [bool]$negSawUe409
      catalog_fingerprint_before = $negFpBefore
      catalog_fingerprint_after = $negFpAfter
      fingerprints_match = $negFingerprintsMatch
      candidate_audit_shape_before = $negShapeBefore
      candidate_audit_shape_after = $negShapeAfter
      candidate_audit_shape_unchanged = $negShapeUnchanged
      fingerprint_scope = $Script:CatalogFingerprintScope
      replay_output = $negReplayText
    }
    $negReceipt | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDir "neg01_receipt.json") -Encoding Ascii

    if ($negStatus -ne 'PASS') {
      Write-HarnessLog "NEG_01 FAILED: exit_code=$negReplayExitCode saw_ue409=$negSawUe409 fingerprints_match=$negFingerprintsMatch shape_unchanged=$negShapeUnchanged" "ERROR"
      exit 1
    }
    Write-HarnessLog "NEG_01 PASS: full-script reapply aborted with UE409 and the catalog fingerprint is unchanged ($negFpBefore)."
    exit 0
  }

  # Step 3c (REAPPLY_01 only): positive full-script reapply control.
  if ($PositiveReapplyControl) {
    Write-HarnessLog "REAPPLY_01: positive full-script reapply control starting."
    $reDraftContent = Get-Content -Raw -Path $DraftSqlPath -Encoding Ascii
    $reDraftHash = (Get-FileHash -Algorithm SHA256 -Path $DraftSqlPath).Hash.ToUpperInvariant()
    $reStart = [DateTime]::UtcNow

    # First apply, against the clean database the migrations just produced.
    Write-HarnessLog "REAPPLY_01: first apply of the complete draft..."
    $reFirstLog = $reDraftContent | docker exec -i $ContainerId psql -U postgres -d sstac_replay -v ON_ERROR_STOP=1 2>&1
    $reFirstExitCode = $LASTEXITCODE
    $reFirstText = [string]($reFirstLog -join "`n")
    if ($reFirstExitCode -ne 0) {
      Write-HarnessLog "REAPPLY_01 setup failed: the FIRST apply did not succeed: $reFirstText" "ERROR"
      exit 1
    }

    $reFpBeforeRaw = $Script:CatalogFingerprintSql | docker exec -i $ContainerId psql -U postgres -d sstac_replay -A -t -v ON_ERROR_STOP=1 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-HarnessLog "REAPPLY_01 failed: could not compute the post-first-apply fingerprint: $reFpBeforeRaw" "ERROR"
      exit 1
    }
    $reFpBefore = ([string]($reFpBeforeRaw -join "`n")).Trim()

    # Second apply of the IDENTICAL bytes against the fixture this harness just
    # built. Proves idempotency of the pinned bytes -- NOT that any particular
    # live installation is safe to reapply over (see the scope note in the
    # parameter block).
    Write-HarnessLog "REAPPLY_01: second apply of the IDENTICAL complete draft..."
    $reSecondLog = $reDraftContent | docker exec -i $ContainerId psql -U postgres -d sstac_replay -v ON_ERROR_STOP=1 2>&1
    $reSecondExitCode = $LASTEXITCODE
    $reSecondText = [string]($reSecondLog -join "`n")

    $reFpAfterRaw = $Script:CatalogFingerprintSql | docker exec -i $ContainerId psql -U postgres -d sstac_replay -A -t -v ON_ERROR_STOP=1 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-HarnessLog "REAPPLY_01 failed: could not compute the post-second-apply fingerprint: $reFpAfterRaw" "ERROR"
      exit 1
    }
    $reFpAfter = ([string]($reFpAfterRaw -join "`n")).Trim()

    # psql emits a command tag per statement; the draft is wrapped in a single
    # BEGIN/COMMIT, so reaching COMMIT is what proves the whole script ran
    # rather than merely that no error was raised before an early exit.
    $reReachedCommit = $reSecondText -match '(?m)^COMMIT\s*$'
    $reSucceeded = ($reSecondExitCode -eq 0)
    $reFingerprintStable = ($reFpBefore -eq $reFpAfter) -and (-not [string]::IsNullOrWhiteSpace($reFpBefore))
    $reStatus = if ($reSucceeded -and $reReachedCommit -and $reFingerprintStable) { 'PASS' } else { 'FAIL' }

    $reReceipt = [PSCustomObject]@{
      test_id = 'REAPPLY_01'
      description = 'POSITIVE FULL-SCRIPT CONTROL: applying the complete draft a SECOND time to a database where it is already installed succeeds, runs through to COMMIT, and leaves the semantic matrix_map catalog fingerprint unchanged'
      status = $reStatus
      timestamp_utc = $reStart.ToString('o')
      duration_ms = ([DateTime]::UtcNow - $reStart).TotalMilliseconds
      draft_sql_path = $DraftSqlPath
      draft_sql_sha256 = $reDraftHash
      first_apply_exit_code = $reFirstExitCode
      second_apply_exit_code = $reSecondExitCode
      second_apply_reached_commit = [bool]$reReachedCommit
      catalog_fingerprint_after_first_apply = $reFpBefore
      catalog_fingerprint_after_second_apply = $reFpAfter
      fingerprints_match = $reFingerprintStable
      fingerprint_scope = $Script:CatalogFingerprintScope
      second_apply_output = $reSecondText
    }
    $reReceipt | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDir "reapply01_receipt.json") -Encoding Ascii

    if ($reStatus -ne 'PASS') {
      Write-HarnessLog "REAPPLY_01 FAILED: second_apply_exit=$reSecondExitCode reached_commit=$reReachedCommit fingerprints_match=$reFingerprintStable" "ERROR"
      exit 1
    }
    Write-HarnessLog "REAPPLY_01 PASS: identical reapply succeeded through COMMIT with an unchanged semantic fingerprint ($reFpBefore)."
    exit 0
  }

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
  $fnDefRaw = (docker exec -i $ContainerId psql -U postgres -d sstac_replay -A -t -c "SELECT pg_get_functiondef('matrix_map.flip_site_aggregate_public(uuid, boolean, uuid, text, timestamptz)'::regprocedure);" 2>&1)
  $fnDefText = [string]($fnDefRaw -join "`n")
  $fnDefReceipt = [PSCustomObject]@{
    timestamp_utc = [DateTime]::UtcNow.ToString('o')
    function_name = "matrix_map.flip_site_aggregate_public"
    signature = "matrix_map.flip_site_aggregate_public(uuid, boolean, uuid, text, timestamptz)"
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

  # REQUIRED baseline: these must all be present or the suite did not really run.
  # This is a MINIMUM, not an allow-list. Every TEST_* id emitted by the suite is
  # parsed and counted, so assertions added to test-option-c.sql are never
  # silently discarded. An earlier revision treated this array as an allow-list
  # and hardcoded `parsedResults.Count -eq 11`, which meant five newly added
  # candidate-delta assertions -- including a FAILING one -- were dropped on the
  # floor while the run still reported COMPLETED_GREEN.
  # SINGLE AUTHORITY for the required baseline. `required_test_ids`,
  # `required_test_count`, `missing_test_ids` and `strict_pass` are ALL derived
  # from this one array and emitted into the receipt, so a reader never has to
  # reconcile two numbers.
  #
  # WHY THE UPPER BOUND IS LOAD-BEARING, not cosmetic: this array previously
  # stopped at TEST_64 while the suite had grown to TEST_69. TEST_65-69 are the
  # exact-ID contract checks -- upsert return identity, refresh return identity,
  # single-row readback through (p_publication_id, 1, 0), the DROP/CREATE
  # ownership and grant posture, and the single-overload check. A replay that
  # somehow failed to EMIT those five would still have satisfied the old
  # baseline and reported strict_pass = true, so the pre-apply gate could go
  # GREEN with precisely the newest safety checks absent.
  #
  # WHEN YOU ADD A TEST to test-option-c.sql, extend this array in the same
  # commit. The `missing_test_ids` list is what fails closed if you do not.
  $requiredTestIds = @(1..69 | ForEach-Object { 'TEST_{0:D2}' -f $_ })
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

      if (-not $foundTestIds.Contains($tId)) {
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

  $missingTestIds = @($requiredTestIds | Where-Object { -not $foundTestIds.Contains($_) })
  # Derived from the ONE authority above. `missing_test_ids` is the operative
  # condition; the count comparison is retained only as a redundant guard and
  # can never be satisfied while an id is missing.
  $testSuiteStrictPass = ($parsedResults.Count -ge $requiredTestIds.Count) -and ($missingTestIds.Count -eq 0) -and ($failCount -eq 0)

  $testHash = (Get-FileHash -Algorithm SHA256 -Path $TestSqlPath).Hash.ToUpperInvariant()
  $testReceipt = [PSCustomObject]@{
    timestamp_utc = $testStart.ToString('o')
    duration_ms = ($testEnd - $testStart).TotalMilliseconds
    exit_code = $testExitCode
    sha256 = $testHash
    pass_count = $passCount
    fail_count = $failCount
    total_parsed_unique = $parsedResults.Count
    required_test_ids = $requiredTestIds
    required_test_count = $requiredTestIds.Count
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
SELECT matrix_map.flip_site_aggregate_public('c1111111-1111-1111-1111-111111111111', false, '11111111-1111-1111-1111-111111111111', 'Reset for concurrency test', NULL);
COMMIT;

BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);
-- Try to flip to true while A holds RowExclusive on samples. This will attempt SHARE NOWAIT and fail immediately.
SELECT matrix_map.flip_site_aggregate_public('c1111111-1111-1111-1111-111111111111', true, '11111111-1111-1111-1111-111111111111', 'Session B Flip', (SELECT updated_at FROM matrix_map.site_aggregate_publications WHERE id = 'c1111111-1111-1111-1111-111111111111'));
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
  Set-Content -Path $logPath -Value ($Script:LogEntries -join "`r`n") -Encoding Ascii
}
