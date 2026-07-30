<#
.SYNOPSIS
  F2 PERF -- Measurements A, B and C for
  matrix_map.fetch_admin_site_aggregate_live_preview (V6 plan section 8).

.DESCRIPTION
  Invoked BY replay-migrations-postgis.ps1, against the container that
  invocation created and identity-verified. It is not a standalone entry point:
  the custody model requires the run-owned container, and this script has no way
  to establish that on its own.

  WHY THREE MEASUREMENTS. An ordinary EXPLAIN of a PL/pgSQL function call yields
  a `Function Scan` and proves NOTHING about the loop behaviour inside the
  function body. So:

    A -- EXPLAIN (ANALYZE, BUFFERS) of the EXACT inner aggregate SELECT, with the
         cursor and limit bound as literals. Carries the two STRUCTURAL
         assertions, which are not budget-dependent.
    B -- wall-clock timing of the actual RPC call, client side, in both cache
         postures. The MAXIMUM is what the budget is applied to.
    C -- FIVE complete first-page-to-exhaustion traversals (the slowest is what
         the budget is applied to), plus a SEPARATE buffer-accounting pass that
         EXPLAINs every cursor position. The pass is separate so that EXPLAIN
         overhead is never folded into a reported traversal time.

  THE BUDGETS ARE A PROVISIONAL RELEASE REGRESSION BUDGET, not a permanent
  product SLO: Measurement B maximum <= 250 ms in both postures, Measurement C
  maximum <= 8000 ms across the five traversals, exactly 25000 rows and 26 calls
  per traversal. Cumulative buffers are recorded as an initial baseline with NO
  numeric block threshold asserted.

  MEASUREMENT A DOES NOT USE A HAND-COPIED QUERY. The inner SELECT is extracted
  from `pg_get_functiondef` at run time and the three parameters are replaced
  with literals. A pasted copy would drift from the function the moment either
  changed, and a measurement of a query the server does not run is worthless.
#>
#Requires -Version 7.0
# ^ ProcessStartInfo.ArgumentList (used by the persistent warm session) does NOT
# exist on .NET Framework, so this script cannot run under Windows PowerShell 5.1.
# Declared rather than discovered: without this the PERF gate fails with an opaque
# null-method error instead of a clear version refusal.

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ContainerId,
  [Parameter(Mandatory = $true)][string]$OutputDir,
  [Parameter(Mandatory = $true)][string]$RepoRoot,
  # V6 8.5.1: page size 1000 over 25000 preview-eligible clusters -> exactly 25
  # full pages, then a 26th call returning 0 rows. No partial page, by
  # construction.
  [int]$PageSize = 1000,
  [int]$ExpectedFullPages = 25,
  [int]$Repeats = 5,
  # V6 8.4 requires FIVE complete traversals, and the MAXIMUM -- not the median,
  # not the mean -- is what the threshold is applied to. A median hides the worst
  # page-load an operator actually waits through.
  [int]$TraversalRuns = 5,
  # PROVISIONAL RELEASE REGRESSION BUDGET, not a permanent product SLO. Set by
  # mission control for this PR so a regression is detectable at all; revisit
  # before treating either number as a service commitment.
  [int]$MeasBMaxMs = 250,
  [int]$MeasCMaxMs = 8000
)

$ErrorActionPreference = 'Stop'

function Invoke-ReplayPsql {
  param([string]$Sql, [switch]$Tuples)
  $args = @('exec', '-i', $ContainerId, 'psql', '-U', 'postgres', '-d', 'sstac_replay', '-v', 'ON_ERROR_STOP=1')
  if ($Tuples) { $args += @('-A', '-t') }
  $out = $Sql | & docker @args 2>&1
  if ($LASTEXITCODE -ne 0) { throw "psql failed: $($out | Out-String)" }
  return ($out | Out-String)
}

$adminClaims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}'
$results = @()
$failures = @()

function Add-Result {
  param([string]$Id, [bool]$Ok, [string]$Details)
  $script:results += [PSCustomObject]@{ id = $Id; status = $(if ($Ok) { 'PASS' } else { 'FAIL' }); details = $Details }
  if (-not $Ok) { $script:failures += "$Id : $Details" }
}

# ---------------------------------------------------------------------------
# Extract the inner aggregate SELECT from the live function definition.
# ---------------------------------------------------------------------------
$fnDef = Invoke-ReplayPsql -Tuples -Sql @"
SELECT pg_get_functiondef('matrix_map.fetch_admin_site_aggregate_live_preview(uuid, text, integer)'::regprocedure);
"@

$marker = 'RETURN QUERY'
$startIdx = $fnDef.IndexOf($marker)
if ($startIdx -lt 0) { throw "could not locate RETURN QUERY in the function definition" }
$body = $fnDef.Substring($startIdx + $marker.Length)
# The inner SELECT ends at the LIMIT clause's terminating semicolon, which is the
# last one before the trailing END.
$endIdx = $body.LastIndexOf('LIMIT p_limit;')
if ($endIdx -lt 0) { throw "could not locate the terminating 'LIMIT p_limit;' in the function body" }
$innerSelect = $body.Substring(0, $endIdx + 'LIMIT p_limit;'.Length).Trim()

Set-Content -Path (Join-Path $OutputDir "measurement_a_inner_select_extracted.sql") -Value $innerSelect -Encoding Ascii

function New-BoundSelect {
  # AllowEmptyString + an IsNullOrEmpty test, NOT `$null -eq $AfterDra`.
  # PowerShell coerces $null to '' when binding to a [string] parameter, so the
  # null test silently failed and the first-page query was built as
  # `''::uuid IS NULL`, which is not a null cursor -- it is an invalid uuid
  # literal. That surfaced as a psql error the timeout handler then reported as
  # a timeout, which is exactly the kind of misattribution that turns a script
  # bug into a phantom finding about the SQL.
  param(
    [AllowEmptyString()][AllowNull()][string]$AfterDra,
    [AllowEmptyString()][AllowNull()][string]$AfterCluster,
    [int]$Limit
  )
  $s = $innerSelect
  if ([string]::IsNullOrEmpty($AfterDra)) {
    $s = $s.Replace('p_after_source_dra_id', 'NULL::uuid')
    $s = $s.Replace('p_after_canonical_cluster', 'NULL::text')
  } else {
    $s = $s.Replace('p_after_source_dra_id', "'$AfterDra'::uuid")
    $s = $s.Replace('p_after_canonical_cluster', "'$AfterCluster'::text")
  }
  $s = $s.Replace('p_limit', "$Limit")
  return $s
}

# ---------------------------------------------------------------------------
# MEASUREMENT A -- inner aggregate plan, at the FIRST page and at the MAXIMUM
# page. The maximum page is where cursor pruning has the most to remove, which
# is where the "Rows Removed by Filter > 0" assertion is meaningful.
# ---------------------------------------------------------------------------
# The MAXIMUM page's cursor is found by KEYSET-WALKING to it, exactly as a
# client would. An OFFSET over a single RPC call cannot reach it: the function
# caps p_limit at 1000, so `OFFSET 24999` would run past the end of a 1000-row
# result and return nothing, silently skipping the max-page plan capture -- the
# one position where the pruning assertion is meaningful.
$maxPageCursor = $null
$walkDra = $null
$walkCluster = $null
for ($p = 1; $p -lt $ExpectedFullPages; $p++) {
  $cur = if ($null -eq $walkDra) { "NULL, NULL" } else { "'$walkDra'::uuid, '$walkCluster'::text" }
  $walkOut = Invoke-ReplayPsql -Tuples -Sql @"
SET statement_timeout = '120s';
SELECT set_config('request.jwt.claims', '$adminClaims', false);
SELECT r.source_dra_id || '|' || r.canonical_cluster_id
FROM matrix_map.fetch_admin_site_aggregate_live_preview($cur, $PageSize) r;
"@
  $walkLines = @($walkOut.Trim().Split("`n") | Where-Object { $_ -match '\|' })
  if ($walkLines.Count -eq 0) { break }
  $last = $walkLines[-1].Trim().Split('|', 2)
  $walkDra = $last[0]; $walkCluster = $last[1]
  if ($walkLines.Count -lt $PageSize) { break }
}
if ($null -ne $walkDra) {
  $maxPageCursor = @{ dra = $walkDra; cluster = $walkCluster }
}

$planCaptures = @{}
foreach ($pos in @('first', 'max')) {
  if ($pos -eq 'first') {
    $bound = New-BoundSelect -AfterDra $null -AfterCluster $null -Limit $PageSize
  } else {
    if ($null -eq $maxPageCursor) { continue }
    $bound = New-BoundSelect -AfterDra $maxPageCursor.dra -AfterCluster $maxPageCursor.cluster -Limit $PageSize
  }
  # BOUNDED, deliberately. The first version of this measurement had no timeout,
  # and a first-page EXPLAIN ANALYZE ran for over ten minutes without returning
  # because the inner SELECT then carried three CORRELATED SUBQUERIES executed
  # once per group. An unbounded measurement turns a structural defect into a
  # hang, which reads as an environment problem instead of the finding it is.
  # With the timeout, the same defect surfaces as a fast, attributable failure.
  #
  # 120s is far above any acceptable single-page cost and far below "hung".
  $explainSql = "SET statement_timeout = '120s';`nSET search_path = pg_catalog, matrix_map, pg_temp;`nEXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`n$bound"
  $planText = $null
  try {
    $planText = Invoke-ReplayPsql -Tuples -Sql $explainSql
  } catch {
    # DISTINGUISH a timeout from any other error. Reporting every psql failure as
    # "did not complete in 120s" once turned a malformed literal in this very
    # script into an apparent finding about the query's cost.
    $errText = ($_ | Out-String)
    $timedOut = $errText -match 'canceling statement due to statement timeout|57014'
    $detail = if ($timedOut) {
      "the inner aggregate SELECT did not complete within the 120s statement_timeout at the '$pos' page. A single page that cannot be planned and executed in two minutes IS the structural finding, not an environment fault."
    } else {
      "the inner aggregate SELECT FAILED at the '$pos' page for a reason OTHER than the timeout -- this is a harness or extraction fault, not a cost finding. See measurement_a_plan_$pos.error.txt."
    }
    Add-Result -Id "MEAS_A_COMPLETES_$pos" -Ok $false -Details $detail
    Set-Content -Path (Join-Path $OutputDir "measurement_a_plan_$pos.error.txt") -Value $errText -Encoding Ascii
    continue
  }
  Add-Result -Id "MEAS_A_COMPLETES_$pos" -Ok $true -Details "inner aggregate SELECT completed within the 120s bound"
  Set-Content -Path (Join-Path $OutputDir "measurement_a_plan_$pos.json") -Value $planText -Encoding Ascii
  $planCaptures[$pos] = $planText
}

# PLAN NODES ARE HETEROGENEOUS. Only some carry `Parent Relationship`, only some
# carry `Relation Name`, only scans carry `Rows Removed by Filter`. Under
# `$ErrorActionPreference = 'Stop'` a bare `$node.'Parent Relationship'` on a node
# that lacks it is a TERMINATING error, which is how the whole measurement died
# on the plan's root node. Every optional property goes through this.
function Get-NodeProp {
  param($Node, [string]$Name, $Default = $null)
  if ($null -eq $Node) { return $Default }
  if ($Node.PSObject.Properties.Name -contains $Name) { return $Node.$Name }
  return $Default
}

function Get-PlanNodes {
  param($Node)
  $out = @($Node)
  foreach ($key in @('Plans')) {
    if ($Node.PSObject.Properties.Name -contains $key -and $null -ne $Node.$key) {
      foreach ($child in $Node.$key) { $out += Get-PlanNodes -Node $child }
    }
  }
  return $out
}

foreach ($pos in $planCaptures.Keys) {
  $parsed = $null
  # psql emits a command tag for each SET before the EXPLAIN output even under
  # -A -t, so the captured text starts with "SET\nSET\n". Trim to the first `[`.
  $jsonText = $planCaptures[$pos]
  $bracket = $jsonText.IndexOf('[')
  if ($bracket -gt 0) { $jsonText = $jsonText.Substring($bracket) }
  try { $parsed = $jsonText | ConvertFrom-Json } catch {
    Add-Result -Id "MEAS_A_PARSE_$pos" -Ok $false -Details "plan JSON could not be parsed"
    continue
  }
  $root = $parsed[0].Plan
  $nodes = Get-PlanNodes -Node $root

  # STRUCTURAL ASSERTION 1 -- no aggregate executes once per returned group.
  $aggNodes = @($nodes | Where-Object { (Get-NodeProp -Node $_ -Name 'Node Type' -Default '') -like '*Aggregate*' })
  $maxAggLoops = 0
  foreach ($n in $aggNodes) {
    $l = [int](Get-NodeProp -Node $n -Name 'Actual Loops' -Default 0)
    if ($l -gt $maxAggLoops) { $maxAggLoops = $l }
  }
  # A handful of loops is a parallel-worker artifact; loops on the ORDER OF
  # RETURNED ROWS is the defect. The page size is the threshold because a
  # per-group aggregate runs at least once per returned row.
  $aggOk = ($aggNodes.Count -gt 0) -and ($maxAggLoops -lt [Math]::Max(16, $PageSize / 100))
  Add-Result -Id "MEAS_A_NO_PER_GROUP_AGGREGATE_$pos" -Ok $aggOk `
    -Details "aggregate nodes=$($aggNodes.Count) max Actual Loops=$maxAggLoops (must not scale with the $PageSize returned rows)"

  # ...and no correlated subquery per output row.
  $subplanNodes = @($nodes | Where-Object { (Get-NodeProp -Node $_ -Name 'Parent Relationship' -Default '') -eq 'SubPlan' })
  $maxSubplanLoops = 0
  foreach ($n in $subplanNodes) {
    $l = [int](Get-NodeProp -Node $n -Name 'Actual Loops' -Default 0)
    if ($l -gt $maxSubplanLoops) { $maxSubplanLoops = $l }
  }
  $subOk = ($subplanNodes.Count -eq 0) -or ($maxSubplanLoops -lt [Math]::Max(16, $PageSize / 100))
  Add-Result -Id "MEAS_A_NO_PER_ROW_SUBPLAN_$pos" -Ok $subOk `
    -Details "SubPlan nodes=$($subplanNodes.Count) max Actual Loops=$maxSubplanLoops (a correlated subquery per output row is forbidden)"

  # STRUCTURAL ASSERTION 2 -- cursor pruning occurs BELOW aggregation.
  if ($pos -eq 'max') {
    $sampleScans = @($nodes | Where-Object {
      (Get-NodeProp -Node $_ -Name 'Relation Name' -Default '') -eq 'samples' -and
      (((Get-NodeProp -Node $_ -Name 'Filter' -Default '') -like '*source_dra_id*') -or
       ((Get-NodeProp -Node $_ -Name 'Index Cond' -Default '') -like '*source_dra_id*') -or
       ((Get-NodeProp -Node $_ -Name 'Recheck Cond' -Default '') -like '*source_dra_id*'))
    })
    $removed = 0
    foreach ($n in $sampleScans) {
      $removed += [int](Get-NodeProp -Node $n -Name 'Rows Removed by Filter' -Default 0)
    }

    # BELOW aggregation, proven by ANCESTRY rather than assumed from the mere
    # presence of a predicate somewhere in the plan. A scan-level filter that sat
    # ABOVE the aggregate would still be "a scan-level source_dra_id predicate"
    # while failing the property the assertion exists for.
    $prunedUnderAggregate = $false
    function Test-HasQualifyingSampleScan {
      param($Node)
      $isScan = ((Get-NodeProp -Node $Node -Name 'Relation Name' -Default '') -eq 'samples') -and
                (((Get-NodeProp -Node $Node -Name 'Filter' -Default '') -like '*source_dra_id*') -or
                 ((Get-NodeProp -Node $Node -Name 'Index Cond' -Default '') -like '*source_dra_id*') -or
                 ((Get-NodeProp -Node $Node -Name 'Recheck Cond' -Default '') -like '*source_dra_id*'))
      if ($isScan) { return $true }
      $kids = Get-NodeProp -Node $Node -Name 'Plans' -Default @()
      foreach ($k in @($kids)) { if (Test-HasQualifyingSampleScan -Node $k) { return $true } }
      return $false
    }
    foreach ($agg in $aggNodes) {
      foreach ($k in @(Get-NodeProp -Node $agg -Name 'Plans' -Default @())) {
        if (Test-HasQualifyingSampleScan -Node $k) { $prunedUnderAggregate = $true }
      }
    }

    # `Rows Removed by Filter > 0` is REQUIRED here, not merely reported. This is
    # the maximum page, so the cursor must actually have excluded rows; a zero
    # would mean the prune is present in the plan but doing nothing, which proves
    # none of what V6 section 8.2 asks for.
    $pruneOk = ($sampleScans.Count -gt 0) -and $prunedUnderAggregate -and ($removed -gt 0)
    Add-Result -Id "MEAS_A_PRUNE_BELOW_AGGREGATION_max" -Ok $pruneOk `
      -Details "scan-level source_dra_id predicates on matrix_map.samples=$($sampleScans.Count), beneath an aggregate node=$prunedUnderAggregate, rows removed by filter=$removed (all three required)"
  }
}

# ---------------------------------------------------------------------------
# MEASUREMENT B -- end-to-end RPC wall clock, client side. EXPLAIN of the RPC
# call is explicitly NOT evidence, so this times the real call.
#
# WHAT THIS REPLACED, AND WHY THE REWRITE IS NOT COSMETIC. The previous version
# distinguished the two postures ONLY by prefixing `DISCARD ALL;` for cold. But
# `Invoke-ReplayPsql` starts a NEW `docker exec ... psql` process, and therefore a
# NEW backend, on EVERY call -- so the "warm" arm was a fresh backend too, and
# `DISCARD ALL` on a brand-new session has nothing to discard. BOTH arms measured
# cold sessions while the receipt reported two postures passing. A codex review
# caught it (2026-07-30). A posture is not warm because it runs after another
# loop; it is warm only if it demonstrably reuses one backend.
#
# SO SESSION CUSTODY IS NOW PROVEN BY EXECUTION, not by a label:
#   cold arm -- five timed calls over five DISTINCT backends. `DISCARD ALL` and
#     the measured call run in the SAME cold session (one psql invocation).
#   warm arm -- ONE persistent backend held open for the whole arm, ONE explicit
#     UNTIMED priming call, then five timed calls in that SAME backend.
# `pg_backend_pid()` is recorded next to every single measurement, and the
# posture contract below requires five distinct cold pids and exactly one warm
# pid. If the harness ever silently reverts to per-call connections, the warm arm
# yields five pids and `strict_pass` goes FALSE instead of quietly lying.
#
# TIMING METHOD, stated because the two arms are deliberately NOT symmetric:
#   cold -- wall clock around the whole `docker exec` (INCLUDES docker exec and
#     backend startup, DISCARD ALL, the pid probe and the measured call). That is
#     inherent to what "cold" means here and is disclosed, not hidden.
#   warm -- wall clock around the measured statement's round trip inside the
#     already-open backend (EXCLUDES process and connection startup). Stopped on
#     receipt of the labelled count row, so the sentinel round trip that follows
#     is not counted.
# The OS page cache and shared buffers are NOT cleared in either arm. That
# limitation is unchanged and is recorded in the receipt.
# ---------------------------------------------------------------------------

# A persistent psql process == a persistent backend. Held open across the whole
# warm arm; that is the entire point.
#
# STDERR IS DRAINED CONTINUOUSLY AND QUOTED BY EVERY THROW BELOW.
#
# WHY THIS MATTERS. An earlier draft redirected stderr and never read it, which
# destroyed the one artifact that distinguishes "the backend died" from "the SQL was
# wrong": under ON_ERROR_STOP=1 psql writes the real diagnostic to stderr and exits,
# stdout closes, ReadLine returns null, and the harness blamed a backend death for
# what may have been a malformed statement. That is the SAME mistake this file
# already condemns for the cold path ("DISTINGUISH a timeout from any other error").
# An undrained redirected pipe is also a deadlock risk once it fills.
#
# WHY ReadToEndAsync AND NOT Register-ObjectEvent. The obvious fix -- an
# ErrorDataReceived handler appending to a script-scope StringBuilder -- DOES NOT
# WORK, and fails SILENTLY: the -Action scriptblock runs in its own runspace, so
# `$script:` inside it resolves to that runspace's variable and the parent's buffer
# stays empty. MEASURED, not assumed: a probe with a process writing a known line to
# stderr collected 0 bytes, which would have made this helper confidently report
# "stderr was empty" for every real failure -- worse than no diagnostic at all.
# ReadToEndAsync hands the draining to .NET, needs no cross-runspace state, and
# keeps the pipe from filling.
$script:warmStderrTask = $null
function New-PersistentPsqlSession {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'docker'
  foreach ($a in @('exec', '-i', $ContainerId, 'psql', '-U', 'postgres', '-d', 'sstac_replay',
      '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-q')) { [void]$psi.ArgumentList.Add($a) }
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  # RESET FIRST. There is one call site today, but if a second session were ever
  # opened, carrying the previous task forward would make Get-WarmStderrTail quote
  # the WRONG process's stderr -- a misattributed diagnostic, which is the failure
  # class this whole helper exists to prevent.
  $script:warmStderrTask = $null
  $proc = [System.Diagnostics.Process]::Start($psi)
  $script:warmStderrTask = $proc.StandardError.ReadToEndAsync()
  return $proc
}

# Quoted by every persistent-session failure so the diagnostic is never lost.
# NEVER blocks indefinitely: ReadToEndAsync completes at EOF, so a bounded wait is
# used and a still-running process is reported as such rather than claimed empty.
function Get-WarmStderrTail {
  if ($null -eq $script:warmStderrTask) { return '(no stderr reader was attached)' }
  try {
    if (-not $script:warmStderrTask.Wait(2000)) {
      return '(psql stderr not yet at EOF, so the process may still be running; no diagnostic available yet)'
    }
    $s = ([string]$script:warmStderrTask.Result).Trim()
  }
  catch {
    return "(could not read psql stderr: $($_.Exception.Message))"
  }
  if ($s.Length -eq 0) { return '(psql stderr was empty)' }
  return "psql stderr follows: $s"
}

# Every exchange is terminated by a unique sentinel SELECT, so a read can never
# run past its own statement's output into the next one.
#
# WHAT BOUNDS THESE READS, stated because the cold path documents its own bound and
# this one should too. `StandardOutput.ReadLine()` has no timeout of its own: it
# returns when a line arrives, or null when stdout closes. Two things bound it.
# (1) Server side: every session runs under `SET statement_timeout = '120s'`, so a
# stalled query is aborted and psql reports the error. (2) Client side: under
# `ON_ERROR_STOP=1` psql EXITS on error, which closes stdout, which makes ReadLine
# return null and raises here with the stderr diagnostic attached. A hang would
# require psql to neither answer, nor error, nor exit -- which the statement timeout
# precludes. This is a real bound, not an assumed one, but it is the SERVER's bound
# rather than a client deadline, and that distinction is worth knowing when reading
# a stuck run.
function Invoke-PersistentPsql {
  param([Parameter(Mandatory = $true)]$Proc, [Parameter(Mandatory = $true)][string]$Sql)
  $sentinel = 'SENTINEL_' + ([guid]::NewGuid().ToString('N'))
  $Proc.StandardInput.WriteLine($Sql)
  $Proc.StandardInput.WriteLine("SELECT 'ZZ$sentinel';")
  $Proc.StandardInput.Flush()
  $lines = @()
  while ($true) {
    $line = $Proc.StandardOutput.ReadLine()
    if ($null -eq $line) { throw "persistent psql stdout closed before sentinel. $(Get-WarmStderrTail)" }
    $t = $line.Trim()
    if ($t -eq "ZZ$sentinel") { break }
    if ($t.Length -gt 0) { $lines += $t }
  }
  # PLAIN `return $lines`, NOT `return , $lines`. The comma form wraps the array,
  # so a caller's `@(...)` sees a NESTED array, `$row[0]` is an ARRAY rather than a
  # string, and `-match` against an array silently performs FILTERING instead of a
  # match -- which never populates `$Matches`. A mechanism smoke test against a
  # real backend caught exactly that before this harness was trusted.
  return $lines
}

# LABELLED-VALUE EXTRACTION VIA EXPLICIT REGEX, deliberately not `-match` plus the
# `$Matches` automatic variable. `$Matches` is scope-sensitive and is not set at all
# when the left operand happens to be an array, which makes a parse failure look
# like a null-index crash rather than a bad line. This form cannot do that.
function Get-LabeledInts {
  param([Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Lines,
        [Parameter(Mandatory = $true)][string]$Label)
  $rx = [regex]('^' + [regex]::Escape($Label) + '=([0-9]+)$')
  $hits = @()
  foreach ($l in @($Lines)) {
    $m = $rx.Match(([string]$l).Trim())
    if ($m.Success) { $hits += [int]$m.Groups[1].Value }
  }
  return $hits
}

# Exactly-one-value accessor, so "no row" and "more than one row" are distinct,
# loud failures rather than a silent first-wins pick.
function Get-SingleLabeledInt {
  param([Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Lines,
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$Context)
  $hits = @(Get-LabeledInts -Lines $Lines -Label $Label)
  if ($hits.Count -ne 1) {
    throw "$Context did not yield exactly one $Label= row (got $($hits.Count))"
  }
  return $hits[0]
}

# The timed warm exchange. The clock stops on the labelled count row, BEFORE the
# sentinel, so sentinel overhead is excluded from the reported figure.
function Measure-PersistentRpcCall {
  param([Parameter(Mandatory = $true)]$Proc)
  $sentinel = 'SENTINEL_' + ([guid]::NewGuid().ToString('N'))
  $sql = "SELECT 'CNT=' || count(*) FROM matrix_map.fetch_admin_site_aggregate_live_preview(NULL, NULL, $PageSize);"
  $elapsedMs = $null
  $rowCount = $null
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $Proc.StandardInput.WriteLine($sql)
  $Proc.StandardInput.WriteLine("SELECT 'ZZ$sentinel';")
  $Proc.StandardInput.Flush()
  $cntRx = [regex]'^CNT=([0-9]+)$'
  while ($true) {
    $line = $Proc.StandardOutput.ReadLine()
    if ($null -eq $line) { throw "persistent psql stdout closed during timed call. $(Get-WarmStderrTail)" }
    $t = $line.Trim()
    if ($null -eq $elapsedMs) {
      $cm = $cntRx.Match($t)
      if ($cm.Success) {
        # CLOCK STOPS HERE, on the count row, so the sentinel round trip that
        # terminates the exchange is excluded from the reported figure.
        $sw.Stop()
        $elapsedMs = [Math]::Round($sw.Elapsed.TotalMilliseconds, 2)
        $rowCount = [int]$cm.Groups[1].Value
        continue
      }
    }
    if ($t -eq "ZZ$sentinel") { break }
  }
  if ($null -eq $elapsedMs) { throw "timed warm call produced no CNT= row" }
  return [PSCustomObject]@{ ms = $elapsedMs; rows = $rowCount }
}

# THE POSTURE CONTRACT, as a pure function so it can be adversarially
# self-checked below rather than only exercised on data that happens to pass.
function Test-MeasBPostureContract {
  param(
    [double[]]$ColdMs, [int[]]$ColdPids,
    [double[]]$WarmMs, [int[]]$WarmPids,
    [bool]$WarmPrimed,
    # The backend the UNTIMED priming call ran in. Required, because "primed" is
    # only meaningful if the priming happened in the SAME backend that was then
    # timed -- otherwise five identical NEW pids plus a successful prime elsewhere
    # would satisfy every other predicate while the measured backend was cold.
    [int]$WarmPrimedBackendPid,
    [int]$Required, [int]$BudgetMs
  )
  # AT LEAST the contract minimum, never fewer. Expressed as `-ge` so raising
  # `-Repeats` STRENGTHENS the evidence instead of breaking the gate, while lowering
  # it cannot weaken the contract. An `-eq` here would make `-Repeats 10` fail for
  # no good reason, and `-Repeats 1` pass for a very bad one.
  $coldCount = (@($ColdMs)).Count
  $warmCount = (@($WarmMs)).Count
  $coldCountOk = ($coldCount -ge $Required)
  $warmCountOk = ($warmCount -ge $Required)
  # EVERY cold call must have had its OWN backend: distinct pids equal to the
  # number of observations, not merely equal to the minimum.
  $coldDistinctOk = $coldCountOk -and
                    (@($ColdPids).Count -eq $coldCount) -and
                    ((@($ColdPids | Sort-Object -Unique)).Count -eq $coldCount)
  # ALL warm calls must have shared ONE backend, over at least the minimum number
  # of observations -- one observation with one pid demonstrates no reuse.
  $warmSingleOk = $warmCountOk -and
                  (@($WarmPids).Count -eq $warmCount) -and
                  ((@($WarmPids | Sort-Object -Unique)).Count -eq 1)
  # Ties the primed backend to the measured backend. Guarded on $warmSingleOk so a
  # multi-pid arm cannot accidentally satisfy this by matching only the first probe.
  $primedIsMeasured = $warmSingleOk -and ($WarmPrimedBackendPid -eq (@($WarmPids))[0])
  $primedOk = $WarmPrimed -and $primedIsMeasured
  $budgetsOk = $false
  if ($coldCountOk -and $warmCountOk) {
    $budgetsOk = ((($ColdMs | Measure-Object -Maximum).Maximum) -le $BudgetMs) -and
                 ((($WarmMs | Measure-Object -Maximum).Maximum) -le $BudgetMs)
  }
  return [PSCustomObject]@{
    pass                                    = ($coldCountOk -and $coldDistinctOk -and $warmCountOk -and $warmSingleOk -and $primedOk -and $budgetsOk)
    cold_count_ok                           = $coldCountOk
    cold_distinct_pids_ok                   = $coldDistinctOk
    warm_count_ok                           = $warmCountOk
    warm_single_backend_ok                  = $warmSingleOk
    warm_primed_ok                          = $primedOk
    warm_primed_call_succeeded               = $WarmPrimed
    warm_primed_backend_is_measured_backend = $primedIsMeasured
    budgets_ok                              = $budgetsOk
  }
}

$measBSetup = "SET statement_timeout = '120s';`nSELECT set_config('request.jwt.claims', '$adminClaims', false);"

# --- COLD ARM: five timed calls, five distinct backends -------------------
$coldMs = @()
$coldPids = @()
for ($i = 1; $i -le $Repeats; $i++) {
  # DISCARD ALL, the pid probe and the measured call are ONE psql invocation, so
  # they are provably the same backend. Labelled outputs make parsing
  # unambiguous: `set_config` also returns a bare string.
  $sql = "DISCARD ALL;`n$measBSetup`nSELECT 'PID=' || pg_backend_pid();`nSELECT 'CNT=' || count(*) FROM matrix_map.fetch_admin_site_aggregate_live_preview(NULL, NULL, $PageSize);"
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $out = Invoke-ReplayPsql -Tuples -Sql $sql
  $sw.Stop()
  $coldMs += [Math]::Round($sw.Elapsed.TotalMilliseconds, 2)
  $coldPids += Get-SingleLabeledInt -Lines @($out.Split("`n")) -Label 'PID' -Context "cold repeat $i"
  # The measured call must actually have returned the whole population; a silently
  # empty result would otherwise time as fast and pass the budget.
  $coldCnt = Get-SingleLabeledInt -Lines @($out.Split("`n")) -Label 'CNT' -Context "cold repeat $i count"
  if ($coldCnt -ne $PageSize) { throw "cold repeat $i returned $coldCnt rows, expected $PageSize" }
}

# --- WARM ARM: one backend, one untimed priming call, five timed calls -----
$warmMs = @()
$warmPids = @()
$warmPrimed = $false
$warmBackendPid = -1
$warmProc = $null
try {
  $warmProc = New-PersistentPsqlSession
  [void](Invoke-PersistentPsql -Proc $warmProc -Sql $measBSetup)
  $warmBackendPid = Get-SingleLabeledInt `
    -Lines @(Invoke-PersistentPsql -Proc $warmProc -Sql "SELECT 'PID=' || pg_backend_pid();") `
    -Label 'PID' -Context 'warm session pid probe'

  # THE PRIMING CALL IS EXPLICIT AND UNTIMED. Without it the first "warm"
  # observation is really a first-touch, which is the defect this rewrite closes.
  $primeCnt = Get-SingleLabeledInt `
    -Lines @(Invoke-PersistentPsql -Proc $warmProc -Sql "SELECT 'CNT=' || count(*) FROM matrix_map.fetch_admin_site_aggregate_live_preview(NULL, NULL, $PageSize);") `
    -Label 'CNT' -Context 'warm priming call'
  # Primed means the priming call actually traversed the whole page, not merely
  # that some row came back.
  $warmPrimed = ($primeCnt -eq $PageSize)

  for ($i = 1; $i -le $Repeats; $i++) {
    $m = Measure-PersistentRpcCall -Proc $warmProc
    if ($m.rows -ne $PageSize) { throw "warm repeat $i returned $($m.rows) rows, expected $PageSize" }
    $warmMs += $m.ms
    # Re-probed EVERY iteration. One probe at the start could not detect a
    # mid-arm reconnect; the contract requires exactly one pid across all five.
    $warmPids += Get-SingleLabeledInt `
      -Lines @(Invoke-PersistentPsql -Proc $warmProc -Sql "SELECT 'PID=' || pg_backend_pid();") `
      -Label 'PID' -Context "warm repeat $i pid probe"
  }
}
finally {
  if ($null -ne $warmProc) {
    try { $warmProc.StandardInput.WriteLine('\q'); $warmProc.StandardInput.Flush() } catch { }
    try { [void]$warmProc.WaitForExit(15000) } catch { }
    try { if (-not $warmProc.HasExited) { $warmProc.Kill() } } catch { }
    try { $warmProc.Dispose() } catch { }
  }
}

$timings = @{ cold = $coldMs; warm = $warmMs }

function Get-Median {
  param([double[]]$Values)
  $s = @($Values | Sort-Object)
  $n = $s.Count
  if ($n -eq 0) { return 0 }
  if ($n % 2 -eq 1) { return $s[[int](($n - 1) / 2)] }
  return [Math]::Round((($s[$n / 2 - 1] + $s[$n / 2]) / 2), 2)
}

# ---------------------------------------------------------------------------
# MEASUREMENT B THRESHOLDS + SESSION-CUSTODY CONTRACT.
#
# The budget is applied to the MAXIMUM of each posture. The custody assertions
# are what make the word "warm" mean something; without them a green budget line
# proves only that some query was fast twice.
#
# THE GATE COMPARES AGAINST A LITERAL, NOT AGAINST $Repeats. This is the SAME fix
# Measurement C already carries at `$c_requiredTraversals` (see its comment), and
# the first draft of this rewrite failed to carry it across: with `-Required
# $Repeats`, a caller passing `-Repeats 1` satisfied every custody predicate
# VACUOUSLY -- one warm observation trivially has "exactly one" pid while
# demonstrating no reuse whatsoever, which is the entire property this arm exists
# to prove. A gate any caller can switch off from the command line is not a gate.
# The required count is a PROPERTY OF THE CONTRACT (V6 requires five), so five is
# what the assertions compare to as a MINIMUM; raising `-Repeats` strengthens the
# evidence, lowering it cannot weaken the contract.
# ---------------------------------------------------------------------------
$b_requiredRepeats = 5

$measBContract = Test-MeasBPostureContract -ColdMs $coldMs -ColdPids $coldPids `
  -WarmMs $warmMs -WarmPids $warmPids -WarmPrimed $warmPrimed `
  -WarmPrimedBackendPid $warmBackendPid `
  -Required $b_requiredRepeats -BudgetMs $MeasBMaxMs

$coldDistinctCount = (@($coldPids | Sort-Object -Unique)).Count
$warmDistinctCount = (@($warmPids | Sort-Object -Unique)).Count

Add-Result -Id 'MEAS_B_COLD_OBSERVATIONS' -Ok $measBContract.cold_count_ok `
  -Details "cold observations=$(@($coldMs).Count), required $b_requiredRepeats (contract literal, not the -Repeats parameter)"
Add-Result -Id 'MEAS_B_COLD_DISTINCT_BACKENDS' -Ok $measBContract.cold_distinct_pids_ok `
  -Details "distinct cold backend pids=$coldDistinctCount of $(@($coldPids).Count) observations, required $b_requiredRepeats distinct (pids: $($coldPids -join ', '))"
Add-Result -Id 'MEAS_B_WARM_OBSERVATIONS' -Ok $measBContract.warm_count_ok `
  -Details "warm observations=$(@($warmMs).Count), required $b_requiredRepeats (contract literal, not the -Repeats parameter)"
Add-Result -Id 'MEAS_B_WARM_SINGLE_BACKEND' -Ok $measBContract.warm_single_backend_ok `
  -Details "distinct warm backend pids=$warmDistinctCount across $(@($warmPids).Count) observations, required EXACTLY 1 across $b_requiredRepeats observations (pids: $($warmPids -join ', ')); a value above 1 means the arm reconnected and is not warm, and fewer than $b_requiredRepeats observations cannot demonstrate reuse at all"
Add-Result -Id 'MEAS_B_WARM_PRIMED' -Ok $measBContract.warm_primed_ok `
  -Details "explicit UNTIMED priming call in the persistent backend (pid $warmBackendPid) returned a FULL page of $PageSize rows: $warmPrimed; and that pid is the SAME backend the timed calls ran in: $($measBContract.warm_primed_backend_is_measured_backend)"

foreach ($posture in @('cold', 'warm')) {
  $obs = @($timings[$posture])
  $maxMs = if ($obs.Count -gt 0) { ($obs | Measure-Object -Maximum).Maximum } else { -1 }
  $bOk = ($obs.Count -ge $b_requiredRepeats) -and ($maxMs -ge 0) -and ($maxMs -le $MeasBMaxMs)
  Add-Result -Id "MEAS_B_MAX_WITHIN_BUDGET_$posture" -Ok $bOk `
    -Details "$posture maximum=${maxMs}ms over $($obs.Count)/$Repeats repeats, budget ${MeasBMaxMs}ms (MAXIMUM, not median -- a median hides the worst load an operator waits through)"
}

# ---------------------------------------------------------------------------
# NEGATIVE SELF-CHECK of the posture contract itself.
#
# WHY THIS EXISTS. Every assertion above is evaluated on data that passed. That
# tells us nothing about whether the predicate can FAIL -- and an always-true
# predicate is exactly the defect this rewrite closes, one layer up. So the
# contract is re-evaluated on synthetic inputs whose ONLY defect is multiple warm
# backends, and it MUST come back false. A harness that cannot demonstrate its own
# gate discriminating is not evidence.
# ---------------------------------------------------------------------------
$selfGoodMs = @(10.0, 11.0, 12.0, 13.0, 14.0)
$selfGoodCold = @(101, 102, 103, 104, 105)
$selfGoodWarm = @(201, 201, 201, 201, 201)
$selfR = $b_requiredRepeats
function Invoke-SelfCase {
  param([double[]]$ColdMs = $selfGoodMs, [int[]]$ColdPids = $selfGoodCold,
        [double[]]$WarmMs = $selfGoodMs, [int[]]$WarmPids = $selfGoodWarm,
        [bool]$WarmPrimed = $true, [int]$PrimedPid = 201)
  return (Test-MeasBPostureContract -ColdMs $ColdMs -ColdPids $ColdPids `
      -WarmMs $WarmMs -WarmPids $WarmPids -WarmPrimed $WarmPrimed `
      -WarmPrimedBackendPid $PrimedPid -Required $selfR -BudgetMs $MeasBMaxMs).pass
}
$selfPosPass = Invoke-SelfCase
# The ONLY difference from the passing case: two distinct warm pids.
$selfMultiWarm = Invoke-SelfCase -WarmPids @(201, 201, 202, 201, 201)
# The mirror defect on the cold side: one backend reused for every "cold" call.
$selfSharedCold = Invoke-SelfCase -ColdPids @(101, 101, 101, 101, 101)
$selfUnprimed = Invoke-SelfCase -WarmPrimed $false
# Primed in a DIFFERENT backend than the one that was timed: every other predicate
# holds, so this is the case a pid-agnostic "primed" flag would have waved through.
$selfPrimedElsewhere = Invoke-SelfCase -PrimedPid 999
# THE CALLER-SWITCHABLE-GATE CASE. A short run must NOT pass: one observation with
# one pid satisfies "exactly one distinct pid" trivially while proving no reuse.
# This is the defect the first draft of this rewrite shipped.
$selfShortRun = Invoke-SelfCase -ColdMs @(10.0) -ColdPids @(101) -WarmMs @(10.0) -WarmPids @(201)
# Budget breaches, one per arm.
$selfColdOverBudget = Invoke-SelfCase -ColdMs @(10.0, 11.0, 12.0, 13.0, ($MeasBMaxMs + 1))
$selfWarmOverBudget = Invoke-SelfCase -WarmMs @(10.0, 11.0, 12.0, 13.0, ($MeasBMaxMs + 1))
$selfNegatives = @{
  'multiple-warm-pids'  = $selfMultiWarm
  'shared-cold-pid'     = $selfSharedCold
  'unprimed'            = $selfUnprimed
  'primed-elsewhere'    = $selfPrimedElsewhere
  'short-run'           = $selfShortRun
  'cold-over-budget'    = $selfColdOverBudget
  'warm-over-budget'    = $selfWarmOverBudget
}
$selfCheckOk = $selfPosPass -and -not ($selfNegatives.Values -contains $true)
Add-Result -Id 'MEAS_B_POSTURE_CONTRACT_SELF_CHECK' -Ok $selfCheckOk `
  -Details ("predicate discriminates: clean=$selfPosPass (expect True); each of the following must be False -- " +
    (($selfNegatives.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ', '))

Add-Result -Id 'MEAS_B_POSTURE_CONTRACT' -Ok $measBContract.pass `
  -Details "session-custody + budget contract over real measurements: $($measBContract | ConvertTo-Json -Compress)"

# ---------------------------------------------------------------------------
# MEASUREMENT C -- FIVE complete first-page-to-exhaustion traversals, then a
# SEPARATE buffer-accounting pass.
#
# WHY FIVE AND WHY THE MAXIMUM. V6 section 8.4 requires five complete
# traversals, and the threshold is applied to the SLOWEST of them. A single
# traversal cannot distinguish a stable cost from a lucky one, and reporting a
# median would hide exactly the run an operator complains about.
#
# WHY THE ACCOUNTING PASS IS SEPARATE, and this is the load-bearing part: an
# EXPLAIN (ANALYZE, BUFFERS) at every cursor position is the only way to sum
# buffer cost across the whole traversal in an image without pg_stat_statements,
# but EXPLAIN overhead is NOT traversal cost. Folding it into the timed loop
# would inflate every reported wall-clock number and make the budget meaningless.
# So the five traversals are timed with NO EXPLAIN in the loop, and the buffer
# accounting re-walks the SAME cursor positions afterwards.
#
# WHAT THIS REPLACED. The previous version ran ONE traversal and emitted a
# receipt claiming the per-page Measurement-A BUFFERS captures substituted for
# cumulative accounting. They did not: Measurement A captures the FIRST and
# MAXIMUM pages only, pg_stat_statements was never installed or sampled, and
# `strict_pass` could still be true while the receipt made that claim. A
# substitution was stated, but not the one the harness actually performed.
# ---------------------------------------------------------------------------
$traversals = @()
$cursorPositions = @()
for ($run = 1; $run -le $TraversalRuns; $run++) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $afterDra = $null; $afterCluster = $null
  $calls = 0; $rowsTotal = 0; $pageSizes = @()
  $runCursors = @()
  while ($true) {
    $calls++
    # RECORDED BEFORE THE CALL, so position N is the cursor page N was fetched
    # with -- including the first page's null cursor, which is a real position
    # the accounting pass must cover.
    $runCursors += [PSCustomObject]@{ dra = $afterDra; cluster = $afterCluster }
    $cur = if ($null -eq $afterDra) { "NULL, NULL" } else { "'$afterDra'::uuid, '$afterCluster'::text" }
    $out = Invoke-ReplayPsql -Tuples -Sql @"
SET statement_timeout = '120s';
SELECT set_config('request.jwt.claims', '$adminClaims', false);
SELECT r.source_dra_id || '|' || r.canonical_cluster_id
FROM matrix_map.fetch_admin_site_aggregate_live_preview($cur, $PageSize) r;
"@
    $lines = @($out.Trim().Split("`n") | Where-Object { $_ -match '\|' })
    $pageSizes += $lines.Count
    $rowsTotal += $lines.Count
    if ($lines.Count -lt $PageSize) { break }
    $last = $lines[-1].Trim().Split('|', 2)
    $afterDra = $last[0]; $afterCluster = $last[1]
    if ($calls -gt ($ExpectedFullPages + 10)) { break }
  }
  $sw.Stop()
  $wallMs = [Math]::Round($sw.Elapsed.TotalMilliseconds, 2)
  $traversals += [PSCustomObject]@{
    run = $run
    wall_ms = $wallMs
    calls = $calls
    rows_total = $rowsTotal
    page_sizes = $pageSizes
  }
  # The cursor sequence is identical across runs on a static fixture; the first
  # run's is kept for the accounting pass.
  if ($run -eq 1) { $cursorPositions = $runCursors }

  # PER TRAVERSAL, not once for the set. A run that silently returned the wrong
  # row count would otherwise be averaged into a passing set.
  $arithOk = ($calls -eq ($ExpectedFullPages + 1)) -and
             ($rowsTotal -eq ($ExpectedFullPages * $PageSize)) -and
             ($pageSizes[-1] -eq 0)
  Add-Result -Id "MEAS_C_PAGE_ARITHMETIC_run$run" -Ok $arithOk `
    -Details "run $run : calls=$calls rows=$rowsTotal final_page=$($pageSizes[-1]) (expected $($ExpectedFullPages + 1) calls, $($ExpectedFullPages * $PageSize) rows, final page 0)"
}

# FIVE RUNS MUST EXIST, AND THE REQUIREMENT IS A LITERAL, NOT THE PARAMETER.
#
# Comparing against `$TraversalRuns` made the gate self-referential: invoking the
# script with `-TraversalRuns 1` satisfied its own check, the buffer pass still
# completed, and `strict_pass` came out TRUE on one traversal -- a gate that any
# caller could switch off from the command line. A review caught it. V6 section
# 8.4 requires FIVE, so five is what the assertion compares to; `$TraversalRuns`
# may raise the count for exploration but can never lower the bar.
$c_requiredTraversals = 5
$runsOk = ($traversals.Count -ge $c_requiredTraversals)
Add-Result -Id 'MEAS_C_FIVE_TRAVERSALS_PRESENT' -Ok $runsOk `
  -Details "completed traversals=$($traversals.Count), required=$c_requiredTraversals by V6 8.4 (literal, NOT the -TraversalRuns parameter, which was requested as $TraversalRuns)"

$traversalMaxMs = if ($traversals.Count -gt 0) { ($traversals.wall_ms | Measure-Object -Maximum).Maximum } else { -1 }
$cOk = $runsOk -and ($traversalMaxMs -ge 0) -and ($traversalMaxMs -le $MeasCMaxMs)
Add-Result -Id 'MEAS_C_MAX_WITHIN_BUDGET' -Ok $cOk `
  -Details "slowest of $($traversals.Count) complete traversals=${traversalMaxMs}ms, budget ${MeasCMaxMs}ms (MAXIMUM across runs, per V6 8.4)"

# ---------------------------------------------------------------------------
# BUFFER ACCOUNTING PASS -- EXPLAIN (ANALYZE, BUFFERS) at EVERY cursor position.
#
# ROOT NODE ONLY, deliberately. PostgreSQL's per-node buffer counters are
# INCLUSIVE of their children, exactly like Actual Total Time, so summing every
# node in the tree would multiply-count the same blocks and inflate the total by
# the plan's depth. The root node's counts ARE the statement's totals.
# ---------------------------------------------------------------------------
$statsAvailable = (Invoke-ReplayPsql -Tuples -Sql "SELECT count(*) FROM pg_available_extensions WHERE name = 'pg_stat_statements';").Trim()
$statsInstalled = (Invoke-ReplayPsql -Tuples -Sql "SELECT count(*) FROM pg_extension WHERE extname = 'pg_stat_statements';").Trim()

$bufferPages = @()
$bufferFailures = 0
$sumHit = 0
$sumRead = 0
for ($i = 0; $i -lt $cursorPositions.Count; $i++) {
  $pos = $cursorPositions[$i]
  $bound = if ($null -eq $pos.dra) {
    New-BoundSelect -AfterDra $null -AfterCluster $null -Limit $PageSize
  } else {
    New-BoundSelect -AfterDra $pos.dra -AfterCluster $pos.cluster -Limit $PageSize
  }
  $sql = "SET statement_timeout = '120s';`nSET search_path = pg_catalog, matrix_map, pg_temp;`nEXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`n$bound"
  try {
    $txt = Invoke-ReplayPsql -Tuples -Sql $sql
    $b = $txt.IndexOf('[')
    if ($b -gt 0) { $txt = $txt.Substring($b) }
    $rootPlan = ($txt | ConvertFrom-Json)[0].Plan
    $hit = [int](Get-NodeProp -Node $rootPlan -Name 'Shared Hit Blocks' -Default 0)
    $read = [int](Get-NodeProp -Node $rootPlan -Name 'Shared Read Blocks' -Default 0)
    $sumHit += $hit
    $sumRead += $read
    $bufferPages += [PSCustomObject]@{
      page = $i + 1
      cursor_dra = $pos.dra
      cursor_cluster = $pos.cluster
      shared_hit_blocks = $hit
      shared_read_blocks = $read
      cumulative_hit_blocks = $sumHit
      cumulative_read_blocks = $sumRead
    }
  } catch {
    $bufferFailures++
    $bufferPages += [PSCustomObject]@{
      page = $i + 1
      cursor_dra = $pos.dra
      cursor_cluster = $pos.cluster
      error = ($_ | Out-String)
    }
  }
}

# BUFFER ACCOUNTING MUST BE PRESENT AND COMPLETE. `strict_pass` must be false
# when it is absent -- the receipt may not imply coverage it lacks.
$expectedPages = $ExpectedFullPages + 1
$bufferOk = ($bufferFailures -eq 0) -and ($bufferPages.Count -eq $expectedPages) -and ($cursorPositions.Count -eq $expectedPages)
Add-Result -Id 'MEAS_C_BUFFER_ACCOUNTING_COMPLETE' -Ok $bufferOk `
  -Details "cursor positions accounted=$($bufferPages.Count)/$expectedPages, capture failures=$bufferFailures, cumulative shared hit=$sumHit read=$sumRead blocks (no numeric block threshold is asserted; this is the initial baseline)"

$receipt = [PSCustomObject]@{
  timestamp_utc = [DateTime]::UtcNow.ToString('o')
  container_id = $ContainerId
  database = 'sstac_replay'
  page_size = $PageSize
  measurement_a = [PSCustomObject]@{
    inner_select_source = 'extracted from pg_get_functiondef at run time, parameters bound as literals'
    plans_captured = @($planCaptures.Keys)
    max_page_cursor = $maxPageCursor
  }
  measurement_b = [PSCustomObject]@{
    # SESSION CUSTODY IS THE HEADLINE FIELD, not a footnote. The previous receipt
    # asserted two cache postures while measuring one, because it labelled a
    # posture instead of proving it. These pid arrays ARE the proof.
    posture_custody_note = ('COLD = five timed calls over five DISTINCT backends; DISCARD ALL and the measured ' +
      'call execute in the SAME cold session (one psql invocation). WARM = ONE persistent backend, ONE explicit ' +
      'UNTIMED priming call, then five timed calls in that SAME backend, with pg_backend_pid() re-probed after ' +
      'every timed call so a mid-arm reconnect cannot pass. A posture is NOT warm merely because it runs after ' +
      'another loop.')
    repeats = $Repeats
    required_repeats = $b_requiredRepeats
    required_repeats_note = ('The gate compares against this CONTRACT LITERAL as a MINIMUM, not against the ' +
      '-Repeats parameter. Raising -Repeats strengthens the evidence; lowering it cannot weaken the contract. An ' +
      'earlier draft compared against -Repeats, which let a caller pass -Repeats 1 and satisfy "exactly one warm ' +
      'backend pid" VACUOUSLY -- one observation cannot demonstrate reuse.')
    # MAXIMUM against MAXIMUM. Contrasting the warm MINIMUM against the cold MAXIMUM
    # would be the most flattering framing available, in a receipt that elsewhere
    # insists the MAXIMUM is the reported figure. The point survives on max-to-max.
    cold_figure_is_startup_dominated = ('READ THE COLD NUMBER WITH THIS IN MIND: the cold wall clock is dominated ' +
      'by harness overhead, not by the query. In this run the same statement cost at most ' +
      "$(($warmMs | Measure-Object -Maximum).Maximum) ms in the warm arm versus a cold maximum of " +
      "$(($coldMs | Measure-Object -Maximum).Maximum) ms (maximum compared against maximum, not against the warm " +
      'minimum), so most of the cold figure is docker exec plus backend startup plus the four extra statements in ' +
      'the same invocation. The remaining margin against the budget is therefore NOT query headroom, and a red ' +
      'cold gate on a slow host may be attributable to Docker rather than to the RPC.')
    timing_method = ('Client-side System.Diagnostics.Stopwatch. COLD wall clock spans the whole docker exec and ' +
      'therefore INCLUDES docker exec plus backend startup, DISCARD ALL, the pid probe and the measured call. ' +
      'WARM wall clock spans only the measured statement round trip inside the already-open backend and ' +
      'therefore EXCLUDES process and connection startup; the clock stops on receipt of the labelled count row, ' +
      'so the terminating sentinel round trip is excluded. THE TWO ARMS ARE DELIBERATELY NOT SYMMETRIC and must ' +
      'not be differenced to infer a connection cost.')
    connection_startup_included_cold = $true
    connection_startup_included_warm = $false
    cache_limitation = ('UNCHANGED LIMITATION: neither the OS page cache nor PostgreSQL shared buffers are ' +
      'cleared in either arm. "Cold" here means a cold SESSION, not a cold cache.')
    threshold_ms = $MeasBMaxMs
    threshold_applied_to = 'MAXIMUM of each posture, not the median -- a median hides the worst load an operator waits through'
    cold_ms_all = @($coldMs)
    cold_ms_median = Get-Median -Values $coldMs
    cold_ms_max = ($coldMs | Measure-Object -Maximum).Maximum
    cold_backend_pids = @($coldPids)
    cold_backend_pids_distinct = (@($coldPids | Sort-Object -Unique)).Count
    warm_ms_all = @($warmMs)
    warm_ms_median = Get-Median -Values $warmMs
    warm_ms_max = ($warmMs | Measure-Object -Maximum).Maximum
    warm_backend_pids = @($warmPids)
    warm_backend_pids_distinct = (@($warmPids | Sort-Object -Unique)).Count
    warm_backend_pid = $warmBackendPid
    warm_priming_call_performed = $warmPrimed
    warm_priming_call_returned_full_page = $warmPrimed
    warm_priming_call_timed = $false
    warm_primed_backend_is_measured_backend = $measBContract.warm_primed_backend_is_measured_backend
    posture_contract = $measBContract
    posture_contract_self_check_passed = $selfCheckOk
    posture_contract_self_check_note = ('The contract predicate is re-evaluated on synthetic inputs to prove it can ' +
      'FAIL: a clean case must pass, and multiple-warm-pids, a shared cold pid, and an unprimed warm arm must each ' +
      'make it false. Asserting only over data that passed would not show the gate discriminates.')
  }
  measurement_c = [PSCustomObject]@{
    # THE LITERAL GATE, not the requested count. Recording `$TraversalRuns` here
    # made the receipt self-contradictory under a non-default invocation: a
    # one-run call produced `traversal_runs_required: 1` while its own result line
    # correctly said five are required and `strict_pass` was false. A receipt that
    # disagrees with itself is worse than a terse one.
    traversal_runs_required = $c_requiredTraversals
    traversal_runs_requested = $TraversalRuns
    traversal_runs_completed = $traversals.Count
    traversals = $traversals
    # THE MAXIMUM IS THE REPORTED FIGURE. The per-run times are all retained so
    # the choice is auditable rather than asserted.
    traversal_wall_ms_all = @($traversals.wall_ms)
    traversal_wall_ms_max = $traversalMaxMs
    traversal_wall_ms_budget = $MeasCMaxMs
    buffer_accounting_method = 'per-page EXPLAIN (ANALYZE, BUFFERS) at every cursor position, root plan node only'
    buffer_pages = $bufferPages
    buffer_capture_failures = $bufferFailures
    cumulative_shared_hit_blocks = $sumHit
    cumulative_shared_read_blocks = $sumRead
    cumulative_shared_blocks_total = ($sumHit + $sumRead)
    block_threshold_asserted = $false
    # THE SUBSTITUTION, STATED AS PERFORMED -- V6 8.4 permits a substitute and
    # requires it to be described exactly. The previous receipt described one the
    # harness did not perform.
    buffer_accounting = ("SUBSTITUTION PERFORMED: pg_stat_statements was NOT sampled for this run " +
      "(available_in_image=$statsAvailable, installed=$statsInstalled), so no real " +
      "shared_blks_hit/shared_blks_read delta was taken. INSTEAD, cumulative buffer cost is the SUM " +
      "over ALL $($bufferPages.Count) cursor positions of the ROOT plan node's 'Shared Hit Blocks' and " +
      "'Shared Read Blocks', captured by re-running the Measurement-A EXPLAIN (ANALYZE, BUFFERS) of the " +
      "extracted inner aggregate SELECT at each position in a SEPARATE accounting pass AFTER the timed " +
      "traversals. THREE LIMITS OF THIS SUBSTITUTE, stated rather than implied: (1) it measures the inner " +
      "aggregate SELECT, not the PL/pgSQL wrapper, so wrapper-side buffer use is not counted; (2) root-node " +
      "counters are used because PostgreSQL's per-node buffer counts are inclusive of children, so summing " +
      "every node would multiply-count the same blocks; (3) THIS IS A WARM-CACHE BASELINE -- the pass runs " +
      "AFTER five full traversals have already touched every page, so shared_read_blocks is expected to be " +
      "at or near ZERO and the hit total is NOT a cold-cache figure. Reading a low read count as evidence of " +
      "cheap I/O would be a misreading of what this measures. EXPLAIN overhead is excluded from every " +
      "reported traversal wall-clock figure. No numeric block threshold is asserted -- the cumulative total " +
      "is recorded as the initial baseline only.")
  }
  results = $results
  strict_pass = ($failures.Count -eq 0)
  failures = $failures
}
# Depth 12: the traversals and per-page buffer arrays are nested two levels
# deeper than the old single-traversal shape. At the previous depth of 8 they
# serialise as type names, which would leave the receipt claiming per-page
# accounting it did not actually contain -- the same class of defect this
# rewrite closes.
$receipt | ConvertTo-Json -Depth 12 | Set-Content -Path (Join-Path $OutputDir "perf_measurement_receipt.json") -Encoding Ascii

foreach ($r in $results) { Write-Host ("  {0} : {1} - {2}" -f $r.id, $r.status, $r.details) }
Write-Host ("  MEAS_B cold max {0} ms over {1} distinct backends, warm max {2} ms on {3} backend(s) (pid {4}), {5} repeats, budget {6} ms" -f `
  ($coldMs | Measure-Object -Maximum).Maximum, (@($coldPids | Sort-Object -Unique)).Count, `
  ($warmMs | Measure-Object -Maximum).Maximum, (@($warmPids | Sort-Object -Unique)).Count, $warmBackendPid, `
  $Repeats, $MeasBMaxMs)
Write-Host ("  MEAS_B custody: cold pids [{0}] warm pids [{1}] primed={2} contract_pass={3} self_check={4}" -f `
  ($coldPids -join ' '), ($warmPids -join ' '), $warmPrimed, $measBContract.pass, $selfCheckOk)
Write-Host ("  MEAS_C {0}/{1} traversals, slowest {2} ms (budget {3} ms); per-run {4}" -f `
  $traversals.Count, $TraversalRuns, $traversalMaxMs, $MeasCMaxMs, (@($traversals.wall_ms) -join ', '))
Write-Host ("  MEAS_C buffers: {0} pages accounted, {1} failures, cumulative hit={2} read={3} blocks" -f `
  $bufferPages.Count, $bufferFailures, $sumHit, $sumRead)

if ($failures.Count -gt 0) { exit 1 }
exit 0
