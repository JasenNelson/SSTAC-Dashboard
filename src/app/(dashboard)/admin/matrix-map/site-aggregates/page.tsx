/**
 * Option C -- READ-ONLY admin preview of site-level centroid aggregates.
 *
 * Design: docs/design/matrix-map/OPTION_C_SITE_AGGREGATE_DESIGN_2026-07-20.md
 *
 * WHAT THIS IS
 * A preview so the owner can inspect the centroid sites BEFORE ruling on publication policy.
 * It publishes nothing, writes nothing, and adds no publication primitive. Current stance is
 * unchanged: no DRA publication.
 *
 * WHY A SERVER COMPONENT AND NOT AN API ROUTE
 * The existing admin matrix-map pages (health, publish) fetch direct-Supabase server-side, so
 * this matches the established pattern. It is also the stronger posture for the oracle
 * constraint (design s6.3): with no HTTP endpoint there is no surface that could ever accept a
 * caller-supplied bbox, radius, or filter to narrow counts over hidden rows. The Leaflet map is
 * a CLIENT child, but it receives only a server-derived `AggregateMarker[]` snapshot as a prop
 * -- it makes no fetch of its own, so it introduces no queryable surface either. If a future
 * client-rendered map needs these aggregates over HTTP, that route is a separate, reviewable
 * change -- and it must carry the same no-parameter rule.
 *
 * CACHING: `dynamic = 'force-dynamic'` + `revalidate = 0` means the payload is computed per
 * request and never cached, which is the server-component equivalent of the
 * `Cache-Control: private, no-store` used by the samples route.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  computeSiteAggregates,
  summariseSiteAggregates,
  type AggregateInputSample,
  type AggregateInputDra,
} from '@/lib/matrix-map/siteAggregates';
import { toAggregateMarkers } from '@/lib/matrix-map/siteAggregateMarkers';
import { COORD_TIER_LABEL, COORD_TIER_CAPTION } from '@/lib/matrix-map/coordinate-provenance';
import { SiteAggregateMapLoader } from './SiteAggregateMapLoader';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_ROLES = ['admin', 'matrix_admin'];
const PAGE_SIZE = 1000;
/** Hard ceiling so a data explosion cannot spin this page forever. */
const MAX_PAGES = 25;

async function createAuthenticatedClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}

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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
      {message}
    </div>
  );
}

export default async function SiteAggregatesPreviewPage() {
  const supabase = await createAuthenticatedClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect('/login');

  const { data: role, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ADMIN_ROLES)
    .limit(1)
    .maybeSingle();
  // Fail closed: a role-query error must not fall through to the page.
  if (roleError || !role) redirect('/dashboard');

  // --- Read-only data load ------------------------------------------------
  // Only the five columns the aggregation helper is permitted to see. No id, no station_id,
  // no measurements. See the containment note in siteAggregates.ts.
  const samples: AggregateInputSample[] = [];
  let loadError: string | null = null;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .schema('matrix_map')
      .from('samples')
      .select('source_dra_id, coordinate_quality_tier, coordinate_source, latitude, longitude')
      .eq('coordinate_quality_tier', 'medium')
      // TOTAL ORDER IS REQUIRED FOR CORRECTNESS, not just tidiness. `source_dra_id` alone is
      // not unique -- a single DRA can hold hundreds of rows, so its ties certainly straddle a
      // 1000-row page boundary. Postgres gives no stable tie order across independent .range()
      // requests, so without a unique tiebreaker rows can be silently skipped or double-counted
      // between pages, corrupting the aggregate counts while `truncated` stays false.
      // `id` is the primary key and is ORDERED BY but never SELECTed, so containment holds:
      // no per-sample identifier reaches the helper, the page, or the rendered output.
      .order('source_dra_id', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      loadError = error.message;
      break;
    }
    const rows = (data ?? []) as AggregateInputSample[];
    samples.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  const { data: draRows, error: draError } = await supabase
    .schema('matrix_map')
    .from('dras')
    .select('id, title, public')
    .eq('is_deleted', false);

  if (draError && !loadError) loadError = draError.message;

  const dras: AggregateInputDra[] = (draRows ?? []) as AggregateInputDra[];
  const aggregates = loadError ? [] : computeSiteAggregates(samples, dras, { tier: 'medium' });
  const summary = summariseSiteAggregates(aggregates);
  const orphanCount = samples.filter((s) => s.source_dra_id === null).length;
  // Markers are derived SERVER-SIDE and only the marker projection crosses to the client map.
  // The client receives no sample rows and no aggregate fields beyond what a marker needs.
  const markers = toAggregateMarkers(aggregates);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Matrix Map -- Site Aggregate Preview (Option C)
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Read-only preview of what centroid-tier data would look like as one marker per site
            instead of one pin per sample. <strong>Nothing here is published.</strong> No DRA
            visibility is changed by viewing this page, and this page provides no way to change it.
          </p>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            {COORD_TIER_CAPTION.medium}
          </p>
        </header>

        {loadError ? <InlineError message={`Failed to load aggregate preview: ${loadError}`} /> : null}
        {truncated ? (
          <InlineError
            message={`Sample load hit the ${MAX_PAGES * PAGE_SIZE}-row page ceiling. Counts below are INCOMPLETE and must not be used for a publication decision.`}
          />
        ) : null}

        <SectionCard
          title="Summary"
          subtitle="Counts are computed over a fixed, caller-independent grouping (the full site). This page accepts no filter, bbox, or radius parameter."
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Aggregate sites" value={summary.site_count} hint="one marker each" />
            <Stat
              label="Samples represented"
              value={summary.sample_count_total}
              hint="collapsed into the sites above"
            />
            <Stat
              label="Distinct coordinates"
              value={summary.distinct_point_count}
              hint="real locations on the map"
            />
            <Stat
              label="Worst stacking"
              value={summary.max_samples_at_one_site}
              hint="samples on a single point"
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Median samples/site" value={summary.median_samples_per_site} />
            <Stat label="Sites with 100+" value={summary.sites_with_100_plus} />
            <Stat label="Sites with exactly 1" value={summary.sites_with_single_sample} />
            <Stat
              label="Orphans excluded"
              value={orphanCount}
              hint="no DRA to attribute them to"
            />
          </div>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Rendering these per-sample would place {summary.sample_count_total} pins on{' '}
            {summary.distinct_point_count} real locations -- up to{' '}
            {summary.max_samples_at_one_site} coincident pins at one site. That overstates both
            spatial precision and sampling density, which is the hazard Option C removes by
            construction.
          </p>
        </SectionCard>

        <SectionCard
          title="Map preview"
          subtitle={`${markers.length} site markers, one per site. A site with many samples is a single larger marker, not many pins -- that is the honest rendering.`}
        >
          {markers.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {loadError ? 'Map unavailable while the sample load is failing.' : 'No centroid-tier sites to plot.'}
            </p>
          ) : (
            <SiteAggregateMapLoader markers={markers} />
          )}
        </SectionCard>

        <SectionCard
          title="Aggregate sites"
          subtitle={`${aggregates.length} rows, sorted by sample count. Tier vocabulary matches the map legend (${COORD_TIER_LABEL.high} / ${COORD_TIER_LABEL.medium} / ${COORD_TIER_LABEL.low}).`}
        >
          {aggregates.length === 0 && !loadError ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No centroid-tier sites found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left dark:border-slate-700">
                    <th className="py-2 pr-4 font-semibold">Site (DRA)</th>
                    <th className="py-2 pr-4 font-semibold">Tier</th>
                    <th className="py-2 pr-4 text-right font-semibold">Samples</th>
                    <th className="py-2 pr-4 text-right font-semibold">Surveyed</th>
                    <th className="py-2 pr-4 text-right font-semibold">Centroid</th>
                    <th className="py-2 pr-4 text-right font-semibold">Points</th>
                    <th className="py-2 pr-4 font-semibold">Representative coordinate</th>
                    <th className="py-2 pr-4 font-semibold">Published</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregates.map((a) => (
                    <tr
                      key={a.aggregate_id}
                      className="border-b border-slate-100 align-top dark:border-slate-800"
                    >
                      <td className="py-2 pr-4">
                        <div className="text-slate-900 dark:text-slate-100">{a.display_name}</div>
                        <div className="font-mono text-xs text-slate-400">{a.source_dra_id}</div>
                      </td>
                      <td className="py-2 pr-4">{COORD_TIER_LABEL[a.coordinate_quality_tier]}</td>
                      <td className="py-2 pr-4 text-right font-semibold">{a.sample_count_total}</td>
                      <td className="py-2 pr-4 text-right">{a.sample_count_high}</td>
                      <td className="py-2 pr-4 text-right">{a.sample_count_medium}</td>
                      <td className="py-2 pr-4 text-right">{a.distinct_point_count}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {a.representative_latitude}, {a.representative_longitude}
                      </td>
                      <td className="py-2 pr-4">{a.dra_public ? 'yes' : 'no'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="What this preview does not do">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>It publishes nothing and cannot publish anything -- there is no write path here.</li>
            <li>
              It exposes no per-sample identifier, station id, or measurement value. Only site-level
              counts and a representative coordinate are computed.
            </li>
            <li>
              It renders no map layer yet. The map render is a documented follow-up; this batch
              ships the table and summary so the shape can be reviewed first.
            </li>
            <li>
              It adds no publication primitive. Making a site visible to members without its samples
              would require a new audited primitive plus RLS work -- an owner decision, not a
              consequence of this page.
            </li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
