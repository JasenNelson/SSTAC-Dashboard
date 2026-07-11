// =====================================================================
// Matrix Map -- Health
// =====================================================================
//
// Route:  /admin/matrix-map/health
// Lane:   Matrix Interactive Map (PR-MAP-1 frontend piece)
// Branch: feat/matrix-map-pr-map-1-schema
// Plan:   .tmp_interactive_map_plan_v3.md section 7 (PR-MAP-1 row).
//
// SERVER COMPONENT (no 'use client'). Read-only operational dashboard
// for matrix_admin / admin. NO interactive elements (no buttons, no
// forms). Page is reloaded manually by the admin -- no auto-refresh
// in v1 (noted in footer).
//
// Auth-gate pattern follows peer admin pages
// (cew-stats / matrix-review / users): createServerClient from
// @supabase/ssr; redirect to /login when no session; redirect to
// /dashboard when the user does not hold an admin / matrix_admin
// role in user_roles. Per task spec the role allowlist is the union
// {'admin', 'matrix_admin'} -- peers only check 'admin' but this lane
// introduces the dedicated matrix_admin role per plan v3 section 4.3.
//
// Display sections (per task spec):
//   1. Schema health (row counts per matrix_map table)
//   2. Sample classification breakdown
//   3. Coordinate quality breakdown
//   4. DRA visibility status
//   5. Budget dimensions (today's UTC) vs daily_cap with pct + colour
//   6. Recent audit trail (dra_visibility_audit last 10)
//   7. Active grants (count + top-5 most-granted DRAs)
//
// Per-section error handling: if a query errors, that section renders
// an inline error card and the rest of the page still loads.
//
// Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
// Literal '->' for arrow text. Per L0 CLAUDE.md section 1.1.
// =====================================================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

const SCHEMA_TABLES = [
  'samples',
  'sample_events',
  'measurements',
  'substances',
  'dras',
  'layers',
  'classification_overrides',
  'private_data_grants',
  'dra_visibility_audit',
  'service_role_audit',
  'export_audit',
] as const;

type SchemaTable = (typeof SCHEMA_TABLES)[number];

const CLASSIFICATION_VALUES = ['reference', 'impacted', 'unknown'] as const;
const CLASSIFICATION_SOURCES = [
  'station_type',
  'steward',
  'data_unknown',
  'bkgd_groundwater',
] as const;
const COORD_QUALITY_TIERS = ['high', 'medium', 'low'] as const;
const BUDGET_DIMENSIONS = [
  'supabase_reads',
  'wms_proxy',
  'etl_runs',
  'egress_gb',
  'csv_exports',
] as const;

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

type CountResult = { count: number | null; error: string | null };

type ClassificationRow = {
  classification: string;
  classification_source: string;
};

type CoordRow = { coordinate_quality_tier: string };

type DraVisibilityRow = { public: boolean };

type BudgetDimRow = {
  dimension: string;
  ymd: string;
  count_value: number;
};

type BudgetCapRow = {
  dimension: string;
  daily_cap: number;
  warning_pct: number;
};

type AuditRow = {
  id: string;
  dra_id: string;
  prior_value: boolean;
  new_value: boolean;
  changed_at: string;
  changed_by_email: string;
  reason: string;
};

type GrantRow = { dra_id: string };

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-';
  return n.toLocaleString('en-CA');
}

function fmtPct(numerator: number, denominator: number): string {
  if (!denominator) return '-';
  return ((numerator / denominator) * 100).toFixed(1) + '%';
}

function fmtTs(ts: string | null | undefined): string {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  } catch {
    return ts;
  }
}

function todayYmdUtc(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

// Build a Supabase server client matching the peer admin pages.
async function buildSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    },
  );
}

// ---------------------------------------------------------------------
// UI primitives
// ---------------------------------------------------------------------

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
      <span className="font-medium">Query error:</span> {message}
    </div>
  );
}

function MutedNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>;
}

function KeyValueRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0 dark:border-slate-800">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span
        className={
          emphasis
            ? 'font-mono text-sm font-semibold text-slate-900 dark:text-white'
            : 'font-mono text-sm text-slate-800 dark:text-slate-100'
        }
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------
// Data fetchers (return { value, error } so per-section failures
// degrade gracefully instead of throwing the whole page)
// ---------------------------------------------------------------------

type Supa = Awaited<ReturnType<typeof buildSupabase>>;

async function fetchTableCount(supa: Supa, table: SchemaTable): Promise<CountResult> {
  try {
    const { count, error } = await supa
      .schema('matrix_map')
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) return { count: null, error: error.message };
    return { count: count ?? 0, error: null };
  } catch (err) {
    return { count: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchClassificationBreakdown(
  supa: Supa,
): Promise<{ rows: ClassificationRow[]; error: string | null }> {
  try {
    const { data, error } = await supa
      .schema('matrix_map')
      .from('samples')
      .select('classification, classification_source');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as ClassificationRow[], error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchCoordBreakdown(
  supa: Supa,
): Promise<{ rows: CoordRow[]; error: string | null }> {
  try {
    const { data, error } = await supa
      .schema('matrix_map')
      .from('samples')
      .select('coordinate_quality_tier');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as CoordRow[], error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchDraVisibility(
  supa: Supa,
): Promise<{ rows: DraVisibilityRow[]; error: string | null }> {
  try {
    const { data, error } = await supa
      .schema('matrix_map')
      .from('dras')
      .select('public')
      .eq('is_deleted', false);
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as DraVisibilityRow[], error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchBudgetDimensions(supa: Supa): Promise<{
  dims: BudgetDimRow[];
  caps: BudgetCapRow[];
  error: string | null;
}> {
  try {
    const today = todayYmdUtc();
    const [dimsRes, capsRes] = await Promise.all([
      supa
        .schema('matrix_map')
        .from('budget_dimension')
        .select('dimension, ymd, count_value')
        .eq('ymd', today),
      supa
        .schema('matrix_map')
        .from('budget_caps')
        .select('dimension, daily_cap, warning_pct'),
    ]);
    if (dimsRes.error) return { dims: [], caps: [], error: dimsRes.error.message };
    if (capsRes.error) return { dims: [], caps: [], error: capsRes.error.message };
    return {
      dims: (dimsRes.data ?? []) as BudgetDimRow[],
      caps: (capsRes.data ?? []) as BudgetCapRow[],
      error: null,
    };
  } catch (err) {
    return {
      dims: [],
      caps: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function fetchRecentAudit(
  supa: Supa,
): Promise<{ rows: AuditRow[]; error: string | null }> {
  try {
    const { data, error } = await supa
      .schema('matrix_map')
      .from('dra_visibility_audit')
      .select('id, dra_id, prior_value, new_value, changed_at, changed_by_email, reason')
      .order('changed_at', { ascending: false })
      .limit(10);
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as AuditRow[], error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchActiveGrants(supa: Supa): Promise<{
  total: number;
  topDras: { dra_id: string; count: number }[];
  error: string | null;
}> {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supa
      .schema('matrix_map')
      .from('private_data_grants')
      .select('dra_id, expires_at, revoked_at')
      .is('revoked_at', null);
    if (error) return { total: 0, topDras: [], error: error.message };
    const active = (data ?? []).filter((row: { expires_at: string | null }) => {
      if (!row.expires_at) return true;
      return row.expires_at > nowIso;
    }) as GrantRow[];
    const tally = new Map<string, number>();
    for (const g of active) {
      tally.set(g.dra_id, (tally.get(g.dra_id) ?? 0) + 1);
    }
    const topDras = Array.from(tally.entries())
      .map(([dra_id, count]) => ({ dra_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return { total: active.length, topDras, error: null };
  } catch (err) {
    return {
      total: 0,
      topDras: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Count matrix_map.samples that are mappable (non-null source_dra_id + lat/lng) and whose
// source_dra_id is in draIds. The .in() list is CHUNKED so a large DRA set (up to all 574,
// e.g. after bulk publication) never overflows the PostgREST request-URL length limit
// (a single .in() over ~574 UUIDs is a ~21KB URL and can 414). Each sample has exactly one
// source_dra_id, so summing counts over disjoint DRA-id batches is exact. Throws on error
// (caught by the caller's try/catch).
async function countMappableSamplesInDras(supa: Supa, draIds: string[]): Promise<number> {
  if (draIds.length === 0) return 0;
  const CHUNK = 150;
  let total = 0;
  for (let i = 0; i < draIds.length; i += CHUNK) {
    const batch = draIds.slice(i, i + CHUNK);
    const { count, error } = await supa
      .schema('matrix_map')
      .from('samples')
      .select('*', { count: 'exact', head: true })
      .not('source_dra_id', 'is', null)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .in('source_dra_id', batch);
    if (error) throw new Error(error.message);
    total += count ?? 0;
  }
  return total;
}

async function fetchReviewerVisibility(supa: Supa): Promise<{
  data: {
    total_valid_samples: number;
    reviewer_visible_samples: number;
    reviewer_hidden_samples: number;
    orphan_samples: number;
    public_dra_count: number;
    has_member_users: boolean;
  } | null;
  error: string | null;
}> {
  try {
    const nowIso = new Date().toISOString();

    const { count: memberCount, error: memberErr } = await supa
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'member');
    if (memberErr) return { data: null, error: memberErr.message };
    const has_member_users = (memberCount ?? 0) > 0;

    const { data: dras, error: drasErr } = await supa
      .schema('matrix_map')
      .from('dras')
      .select('id, public')
      .eq('is_deleted', false);
    if (drasErr) return { data: null, error: drasErr.message };

    const undeletedDraIds = (dras ?? []).map((d: { id: string }) => d.id);
    const publicDraIds = new Set((dras ?? []).filter((d: { public: boolean }) => d.public).map((d: { id: string }) => d.id));
    const public_dra_count = publicDraIds.size;

    const { data: grants, error: grantsErr } = await supa
      .schema('matrix_map')
      .from('private_data_grants')
      .select('dra_id, expires_at')
      .is('revoked_at', null);
    if (grantsErr) return { data: null, error: grantsErr.message };

    const activeGrants = (grants ?? []).filter((g: { expires_at: string | null }) => {
      if (!g.expires_at) return true;
      return g.expires_at > nowIso;
    });
    const grantedDraIds = new Set(activeGrants.map((g: { dra_id: string }) => g.dra_id));

    const visibleDraIds = new Set([...publicDraIds, ...grantedDraIds]);
    const validVisibleDraIds = Array.from(visibleDraIds).filter(id => undeletedDraIds.includes(id));

    const { count: orphanCount, error: orphanErr } = await supa
      .schema('matrix_map')
      .from('samples')
      .select('*', { count: 'exact', head: true })
      .is('source_dra_id', null);
    if (orphanErr) return { data: null, error: orphanErr.message };
    const orphan_samples = orphanCount ?? 0;

    const total_valid_samples = await countMappableSamplesInDras(supa, undeletedDraIds);
    const reviewer_visible_samples = await countMappableSamplesInDras(supa, validVisibleDraIds);

    const reviewer_hidden_samples = total_valid_samples - reviewer_visible_samples;

    return {
      data: {
        total_valid_samples,
        reviewer_visible_samples,
        reviewer_hidden_samples,
        orphan_samples,
        public_dra_count,
        has_member_users,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchDataFreshness(supa: Supa): Promise<{
  data: {
    snapshotVersion: string | null;
    lastEtlAt: string | null;
    lastEtlAffectedRows: number | null;
  } | null;
  error: string | null;
}> {
  try {
    const { data: snapRow, error: snapErr } = await supa
      .schema('matrix_map')
      .from('samples')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snapErr) return { data: null, error: snapErr.message };

    const { data: etlRow, error: etlErr } = await supa
      .schema('matrix_map')
      .from('service_role_audit')
      .select('invoked_at, affected_rows')
      .eq('rpc_name', 'etl_bnrrm_to_supabase')
      .order('invoked_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (etlErr) return { data: null, error: etlErr.message };

    return {
      data: {
        snapshotVersion: snapRow?.updated_at ?? null,
        lastEtlAt: etlRow?.invoked_at ?? null,
        lastEtlAffectedRows: etlRow?.affected_rows ?? null,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------
// Aggregations (pure -- run on the fetched rows; cannot fail)
// ---------------------------------------------------------------------

function aggClassification(rows: ClassificationRow[]) {
  const byClass: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const v of CLASSIFICATION_VALUES) byClass[v] = 0;
  for (const v of CLASSIFICATION_SOURCES) bySource[v] = 0;
  for (const r of rows) {
    if (r.classification in byClass) byClass[r.classification] += 1;
    else byClass[r.classification] = (byClass[r.classification] ?? 0) + 1;
    if (r.classification_source in bySource) bySource[r.classification_source] += 1;
    else
      bySource[r.classification_source] =
        (bySource[r.classification_source] ?? 0) + 1;
  }
  return { byClass, bySource, total: rows.length };
}

function aggCoord(rows: CoordRow[]) {
  const byTier: Record<string, number> = {};
  for (const v of COORD_QUALITY_TIERS) byTier[v] = 0;
  for (const r of rows) {
    if (r.coordinate_quality_tier in byTier)
      byTier[r.coordinate_quality_tier] += 1;
    else
      byTier[r.coordinate_quality_tier] =
        (byTier[r.coordinate_quality_tier] ?? 0) + 1;
  }
  return { byTier, total: rows.length };
}

function aggDraVisibility(rows: DraVisibilityRow[]) {
  let pub = 0;
  let priv = 0;
  for (const r of rows) {
    if (r.public) pub += 1;
    else priv += 1;
  }
  return { public: pub, private: priv, total: rows.length };
}

// ---------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------

export default async function MatrixMapHealthPage() {
  const supabase = await buildSupabase();

  // Auth gate (peer pattern).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Role gate: admin OR matrix_admin (this lane introduces matrix_admin
  // per plan v3 section 4.3). Peers check only 'admin'; this page
  // honours both.
  const { data: roleRows, error: roleErr } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'matrix_admin']);
  if (roleErr) {
    // Fail closed on role lookup error to avoid leaking the page.
    redirect('/dashboard');
  }
  if (!roleRows || roleRows.length === 0) redirect('/dashboard');

  // Parallel fetch of section data.
  const [
    tableCountResults,
    classificationRes,
    coordRes,
    draVisRes,
    budgetRes,
    auditRes,
    grantsRes,
    reviewerVisRes,
    freshnessRes,
  ] = await Promise.all([
    Promise.all(SCHEMA_TABLES.map((t) => fetchTableCount(supabase, t))),
    fetchClassificationBreakdown(supabase),
    fetchCoordBreakdown(supabase),
    fetchDraVisibility(supabase),
    fetchBudgetDimensions(supabase),
    fetchRecentAudit(supabase),
    fetchActiveGrants(supabase),
    fetchReviewerVisibility(supabase),
    fetchDataFreshness(supabase),
  ]);

  const tableCounts: Record<SchemaTable, CountResult> = SCHEMA_TABLES.reduce(
    (acc, name, idx) => {
      acc[name] = tableCountResults[idx];
      return acc;
    },
    {} as Record<SchemaTable, CountResult>,
  );

  const classAgg = aggClassification(classificationRes.rows);
  const coordAgg = aggCoord(coordRes.rows);
  const draAgg = aggDraVisibility(draVisRes.rows);

  // Budget joined view: row per known dimension. Caps without dim
  // rows show count_value = 0 (no traffic yet today).
  const capByDim = new Map<string, BudgetCapRow>();
  for (const c of budgetRes.caps) capByDim.set(c.dimension, c);
  const dimByDim = new Map<string, BudgetDimRow>();
  for (const d of budgetRes.dims) dimByDim.set(d.dimension, d);

  const budgetView = BUDGET_DIMENSIONS.map((d) => {
    const cap = capByDim.get(d);
    const dim = dimByDim.get(d);
    const count = dim?.count_value ?? 0;
    const dailyCap = cap?.daily_cap ?? null;
    const warningPct = cap?.warning_pct ?? 0.8;
    const pct = dailyCap && dailyCap > 0 ? count / dailyCap : null;
    return { dimension: d, count, dailyCap, warningPct, pct };
  });

  const renderedAt = fmtTs(new Date().toISOString());

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Admin / Matrix Map
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            Matrix Map -- Health
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Read-only operational snapshot of the matrix_map schema
            (PR-MAP-1). Counts, classification mix, coordinate quality,
            DRA visibility, daily budget breaker, recent audit trail,
            and active grants. Refresh the browser to re-query.
          </p>
        </header>

        <div className="space-y-6">
          {/* 1. Schema health */}
          <SectionCard
            title="1. Schema health -- row counts per table"
            subtitle="Live SELECT COUNT(*) per matrix_map table."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SCHEMA_TABLES.map((t) => {
                const res = tableCounts[t];
                return (
                  <div
                    key={t}
                    className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      matrix_map.{t}
                    </div>
                    {res.error ? (
                      <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                        error: {res.error}
                      </div>
                    ) : (
                      <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
                        {fmtNum(res.count)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* 2. Sample classification */}
          <SectionCard
            title="2. Sample classification breakdown"
            subtitle="Counts grouped by classification + classification_source (matrix_map.samples)."
          >
            {classificationRes.error ? (
              <InlineError message={classificationRes.error} />
            ) : classAgg.total === 0 ? (
              <MutedNote>No samples rows.</MutedNote>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    By classification
                  </h3>
                  {Object.entries(classAgg.byClass).map(([k, v]) => (
                    <KeyValueRow
                      key={k}
                      label={k}
                      value={`${fmtNum(v)} (${fmtPct(v, classAgg.total)})`}
                    />
                  ))}
                  <KeyValueRow
                    label="Total"
                    value={fmtNum(classAgg.total)}
                    emphasis
                  />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    By classification_source
                  </h3>
                  {Object.entries(classAgg.bySource).map(([k, v]) => (
                    <KeyValueRow
                      key={k}
                      label={k}
                      value={`${fmtNum(v)} (${fmtPct(v, classAgg.total)})`}
                    />
                  ))}
                  <KeyValueRow
                    label="Total"
                    value={fmtNum(classAgg.total)}
                    emphasis
                  />
                </div>
              </div>
            )}
          </SectionCard>

          {/* 3. Coordinate quality */}
          <SectionCard
            title="3. Coordinate quality breakdown"
            subtitle="Counts grouped by coordinate_quality_tier (matrix_map.samples)."
          >
            {coordRes.error ? (
              <InlineError message={coordRes.error} />
            ) : coordAgg.total === 0 ? (
              <MutedNote>No samples rows.</MutedNote>
            ) : (
              <div>
                {Object.entries(coordAgg.byTier).map(([k, v]) => (
                  <KeyValueRow
                    key={k}
                    label={k}
                    value={`${fmtNum(v)} (${fmtPct(v, coordAgg.total)})`}
                  />
                ))}
                <KeyValueRow
                  label="Total"
                  value={fmtNum(coordAgg.total)}
                  emphasis
                />
              </div>
            )}
          </SectionCard>

          {/* 4. DRA visibility */}
          <SectionCard
            title="4. DRA visibility status"
            subtitle="Counts of dras with public=true vs public=false (excluding is_deleted=true)."
          >
            {draVisRes.error ? (
              <InlineError message={draVisRes.error} />
            ) : draAgg.total === 0 ? (
              <MutedNote>No active dras rows.</MutedNote>
            ) : (
              <div>
                <KeyValueRow
                  label="public = true"
                  value={`${fmtNum(draAgg.public)} (${fmtPct(draAgg.public, draAgg.total)})`}
                />
                <KeyValueRow
                  label="public = false"
                  value={`${fmtNum(draAgg.private)} (${fmtPct(draAgg.private, draAgg.total)})`}
                />
                <KeyValueRow
                  label="Total active"
                  value={fmtNum(draAgg.total)}
                  emphasis
                />
              </div>
            )}
          </SectionCard>

          {/* 5. Budget dimensions */}
          <SectionCard
            title="5. Budget dimensions (today, UTC)"
            subtitle={`count_value vs daily_cap for ymd = ${todayYmdUtc()}. Yellow at >= warning_pct; red at >= 100%.`}
          >
            {budgetRes.error ? (
              <InlineError message={budgetRes.error} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      <th className="py-2 pr-4">Dimension</th>
                      <th className="py-2 pr-4 text-right">Count today</th>
                      <th className="py-2 pr-4 text-right">Daily cap</th>
                      <th className="py-2 pr-4 text-right">Pct of cap</th>
                      <th className="py-2 pr-4 text-right">Warning pct</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetView.map((row) => {
                      const pctValue = row.pct;
                      let rowClass = '';
                      if (pctValue !== null) {
                        if (pctValue >= 1.0) {
                          rowClass = 'bg-red-50 dark:bg-red-900/20';
                        } else if (pctValue >= row.warningPct) {
                          rowClass = 'bg-yellow-50 dark:bg-yellow-900/20';
                        }
                      }
                      return (
                        <tr
                          key={row.dimension}
                          className={`border-b border-slate-100 last:border-b-0 dark:border-slate-800 ${rowClass}`}
                        >
                          <td className="py-2 pr-4 font-mono text-xs text-slate-700 dark:text-slate-200">
                            {row.dimension}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono">
                            {fmtNum(row.count)}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono">
                            {row.dailyCap === null
                              ? '(no cap)'
                              : fmtNum(row.dailyCap)}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono">
                            {pctValue === null
                              ? '-'
                              : (pctValue * 100).toFixed(1) + '%'}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono">
                            {(row.warningPct * 100).toFixed(0) + '%'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* 6. Recent audit trail */}
          <SectionCard
            title="6. Recent audit trail (dra_visibility_audit)"
            subtitle="Last 10 rows ordered by changed_at desc."
          >
            {auditRes.error ? (
              <InlineError message={auditRes.error} />
            ) : auditRes.rows.length === 0 ? (
              <MutedNote>No audit rows yet.</MutedNote>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      <th className="py-2 pr-4">Changed at (UTC)</th>
                      <th className="py-2 pr-4">DRA id</th>
                      <th className="py-2 pr-4">Transition</th>
                      <th className="py-2 pr-4">Changed by</th>
                      <th className="py-2 pr-4">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRes.rows.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-slate-100 align-top last:border-b-0 dark:border-slate-800"
                      >
                        <td className="py-2 pr-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                          {fmtTs(r.changed_at)}
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs text-slate-700 dark:text-slate-200">
                          {r.dra_id.slice(0, 8)}...
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {String(r.prior_value)} {'->'} {String(r.new_value)}
                        </td>
                        <td className="py-2 pr-4 text-xs text-slate-700 dark:text-slate-200">
                          {r.changed_by_email}
                        </td>
                        <td className="py-2 pr-4 text-xs text-slate-700 dark:text-slate-200">
                          {r.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* 7. Active grants */}
          <SectionCard
            title="7. Active grants"
            subtitle="COUNT(*) FROM private_data_grants WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()); top 5 most-granted DRAs."
          >
            {grantsRes.error ? (
              <InlineError message={grantsRes.error} />
            ) : (
              <div className="space-y-4">
                <div>
                  <KeyValueRow
                    label="Active grants"
                    value={fmtNum(grantsRes.total)}
                    emphasis
                  />
                </div>
                {grantsRes.topDras.length === 0 ? (
                  <MutedNote>No active grants yet.</MutedNote>
                ) : (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Top 5 most-granted DRAs
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            <th className="py-2 pr-4">DRA id</th>
                            <th className="py-2 pr-4 text-right">
                              Active grant count
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {grantsRes.topDras.map((g) => (
                            <tr
                              key={g.dra_id}
                              className="border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                            >
                              <td className="py-2 pr-4 font-mono text-xs text-slate-700 dark:text-slate-200">
                                {g.dra_id}
                              </td>
                              <td className="py-2 pr-4 text-right font-mono">
                                {fmtNum(g.count)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* 8. Reviewer effective visibility */}
          <SectionCard
            title="8. Reviewer effective visibility"
            subtitle="Derived visibility for non-admin reviewers based on public DRAs and active grants."
          >
            {reviewerVisRes.error ? (
              <InlineError message={reviewerVisRes.error} />
            ) : reviewerVisRes.data ? (
              <div className="space-y-4">
                <div>
                  <KeyValueRow
                    label="Total valid samples (mappable)"
                    value={fmtNum(reviewerVisRes.data.total_valid_samples)}
                  />
                  <KeyValueRow
                    label="Visible to non-admin reviewers"
                    value={fmtNum(reviewerVisRes.data.reviewer_visible_samples)}
                  />
                  <KeyValueRow
                    label="Hidden from reviewers (private DRAs, no grant)"
                    value={fmtNum(reviewerVisRes.data.reviewer_hidden_samples)}
                  />
                  <KeyValueRow
                    label="Orphan samples (no DRA, hidden from everyone)"
                    value={fmtNum(reviewerVisRes.data.orphan_samples)}
                  />
                  <KeyValueRow
                    label="Public DRAs"
                    value={fmtNum(reviewerVisRes.data.public_dra_count)}
                  />
                </div>

                {reviewerVisRes.data.public_dra_count === 0 && reviewerVisRes.data.has_member_users ? (
                  <div role="status" className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                    0 public DRAs: non-admin reviewers see {fmtNum(reviewerVisRes.data.reviewer_visible_samples)} of {fmtNum(reviewerVisRes.data.total_valid_samples)} samples (grant-scoped access only). Publication is the owner lever (flip_dra_public) to broaden visibility.
                  </div>
                ) : reviewerVisRes.data.public_dra_count > 0 ? (
                  <MutedNote>
                    {reviewerVisRes.data.reviewer_visible_samples} of {reviewerVisRes.data.total_valid_samples} samples are reviewer-visible.
                  </MutedNote>
                ) : null}
              </div>
            ) : null}
          </SectionCard>

          {/* 9. Data freshness */}
          <SectionCard
            title="9. Data freshness"
            subtitle="Snapshot version (matrix_map.samples) and last BN-RRM ETL run (matrix_map.service_role_audit)."
          >
            {freshnessRes.error ? (
              <InlineError message={freshnessRes.error} />
            ) : (
              <div>
                <KeyValueRow
                  label="Snapshot version (MAX samples.updated_at)"
                  value={fmtTs(freshnessRes.data?.snapshotVersion ?? null)}
                  emphasis
                />
                <KeyValueRow
                  label="Last ETL run (service_role_audit, rpc_name=etl_bnrrm_to_supabase)"
                  value={fmtTs(freshnessRes.data?.lastEtlAt ?? null)}
                />
                <KeyValueRow
                  label="Last ETL affected_rows"
                  value={fmtNum(freshnessRes.data?.lastEtlAffectedRows ?? null)}
                />
              </div>
            )}
            <div className="mt-4">
              <MutedNote>
                Note: Row-count-drift monitoring is not yet available (no baseline snapshot table exists) so it is intentionally omitted.
              </MutedNote>
            </div>
          </SectionCard>
        </div>

        <footer className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <p>
            Rendered at {renderedAt}. Auto-refresh disabled in v1 -- reload
            the browser to re-query. Source: matrix_map schema (PR-MAP-1).
          </p>
        </footer>
      </div>
    </div>
  );
}
