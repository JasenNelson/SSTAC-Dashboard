/**
 * Option C -- admin site-aggregate preview and candidate lifecycle surface.
 *
 * Design: docs/design/matrix-map/OPTION_C_SITE_AGGREGATE_DESIGN_2026-07-20.md
 *
 * WHAT THIS IS
 * The table, map and summary are a MEDIUM-TIER preview of the centroid sites. The Actions
 * column drives the candidate lifecycle: Create/Refresh capture an ALL-TIER candidate through
 * audited SECURITY DEFINER RPCs, and Publish/Unpublish change site-aggregate publication state.
 *
 * The two populations differ on purpose and must not be conflated: the medium-tier rows are the
 * operator PREVIEW, while the candidate the actions persist -- and which becomes member-visible --
 * spans every tier in the cluster. The action cell therefore displays the persisted all-tier
 * candidate alongside the medium-tier row.
 *
 * This SERVER COMPONENT performs no writes of its own; every mutation goes through the audited
 * RPCs behind the Actions column. It never flips DRA or sample visibility -- `matrix_map.dras.public`
 * and `matrix_map.samples.public` are untouched by anything on this page.
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
import { summariseSiteAggregates } from '@/lib/matrix-map/siteAggregates';
import { toAggregateMarkers } from '@/lib/matrix-map/siteAggregateMarkers';
import {
  classifyLifecycleRows,
  deriveLifecycleEvidenceAxes,
} from '@/lib/matrix-map/site-aggregate-lifecycle-rows';
import { COORD_TIER_LABEL, COORD_TIER_CAPTION } from '@/lib/matrix-map/coordinate-provenance';
import {
  loadSiteAggregateLiveAdminSurface,
  sortPreviewRowsForDisplay,
} from '@/lib/matrix-map/site-aggregate-live-preview';
import { parseServerClusterIdentity } from '@/lib/matrix-map/cluster-identity';
// Used ONLY to render the page-ceiling message. Offsets are never computed
// here -- see site-aggregate-pagination.siteAggregatePageArgs.
import { PAGE_SIZE, MAX_PAGES } from '@/lib/matrix-map/site-aggregate-pagination';
import { SiteAggregateMapLoader } from './SiteAggregateMapLoader';
import { SiteAggregateAdminActions, type SiteAggregateCandidate } from './SiteAggregateAdminActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_ROLES = ['admin', 'matrix_admin'];

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
  // F2: THE PAGE NO LONGER READS SAMPLES OR DRAs.
  //
  // It used to page `matrix_map.samples` and `matrix_map.dras` and cluster them
  // here with `computeSiteAggregates(samples, dras, { tier: 'medium' })`. That
  // made TypeScript a second implementation of an identity SQL already owns, and
  // the operator then asserted that TypeScript-derived key on the write path --
  // so the server had nothing independent to check it against. The live-preview
  // RPC now does the grouping, the DRA join and the medium-tier row scope
  // server-side and returns the canonical key it derived, which this page only
  // transports.
  //
  // Containment improves as a side effect: with no sample projection on this
  // surface, there is no column list here that could later widen.
  //
  // ONE orchestration call, in site-aggregate-live-preview.ts, so that "the page
  // actually invokes the loader" stays provable by execution rather than by
  // scanning source text. Error routing is unchanged in principle: the preview
  // error and the candidate error stay on separate axes.
  const { preview, candidates, candidatesTruncated, candidateError } =
    await loadSiteAggregateLiveAdminSurface<SiteAggregateCandidate>(supabase as never);
  const {
    rows: previewRows,
    truncated,
    unparsableRowCount,
    loadError,
  } = preview;

  /**
   * Neutral seed for a MEMBER-VISIBLE label.
   *
   * This must NEVER be seeded from `a.display_name`. That value is
   * `dra?.title ?? a.source_dra_id` (siteAggregates.ts), i.e. the PRIVATE DRA
   * title, or the raw DRA UUID when no title resolves. Pre-filling the member
   * label with it means an admin who accepts the default and enters only a
   * reason publishes raw DRA provenance to members, since the database stores
   * and serves `member_display_label` verbatim.
   *
   * An existing candidate's own stored label is reused (it was already curated);
   * otherwise the operator gets a neutral placeholder they must consciously
   * replace.
   */
  const neutralDefaultLabel = (index: number) => `Site aggregate ${index + 1}`;

  // TWO AXES, derived by a pure tested helper. `previewRenderable` depends on
  // the PREVIEW axis alone, so a candidate-side failure can never blank the
  // medium-tier table, summary or map.
  const { previewIncomplete, candidateIncomplete, previewRenderable } =
    deriveLifecycleEvidenceAxes({
      previewLoadError: loadError,
      previewTruncated: truncated,
      // Feeds the PREVIEW axis, not the candidate axis: a row the server sent
      // that this build could not parse is simply MISSING from the table, which
      // corrupts the rendered population exactly as a truncated read does.
      previewRowsUnreadable: unparsableRowCount > 0,
      candidateLoadError: candidateError,
      candidateTruncated: candidatesTruncated,
    });

  /**
   * The rendered preview rows.
   *
   * `preview_*` fields are the MEDIUM-TIER population, which is what this table,
   * summary and map have always shown. `lifecycle_*` fields are the ALL-TIER
   * population the candidate lifecycle acts on, and they are deliberately NOT
   * mixed into the display: on a mixed-tier cluster the two legitimately differ,
   * and the operator must be able to see which is which.
   */
  const aggregates = previewRenderable ? sortPreviewRowsForDisplay(previewRows) : [];

  // The roll-up and the markers read only the PREVIEW block, so they render the
  // same population as before F2 -- now grouped by the server instead of here.
  const summary = summariseSiteAggregates(
    aggregates.map((r) => ({
      coordinate_cluster_id: r.canonical_cluster_id,
      sample_count_total: r.preview_sample_count_total,
      sample_count_high: r.preview_sample_count_high,
      sample_count_medium: r.preview_sample_count_medium,
      sample_count_low: r.preview_sample_count_low,
    })),
  );
  // Markers are derived SERVER-SIDE and only the marker projection crosses to the client map.
  // The client receives no sample rows and no aggregate fields beyond what a marker needs.
  const markers = toAggregateMarkers(
    aggregates.map((r) => ({
      aggregate_id: r.aggregate_id,
      source_dra_id: r.source_dra_id,
      display_name: r.source_dra_title ?? r.source_dra_id,
      representative_latitude: r.preview_representative_latitude,
      representative_longitude: r.preview_representative_longitude,
      coordinate_quality_tier: r.preview_coordinate_quality_tier,
      sample_count_total: r.preview_sample_count_total,
      sample_count_high: r.preview_sample_count_high,
      sample_count_medium: r.preview_sample_count_medium,
    })),
  );

  // ORPHANED PUBLICATIONS. Rows below are driven by LIVE aggregates, but a
  // publication persists independently of them. If a published candidate's
  // samples are removed, re-clustered, or drop below the medium-tier threshold,
  // the aggregate disappears from `aggregates` while the publication remains
  // member-visible -- and with it the only Unpublish control. That is a stuck
  // published aggregate with no operator route to retract it.
  // Render the UNION so candidate-only rows stay reachable.
  // FAIL CLOSED. The warnings above surface an errored/truncated sample load or
  // a truncated candidate load, but the table and its lifecycle controls kept
  // rendering from whatever partial data DID come back. That is unsafe: an
  // OMITTED candidate then looks "safely absent" (offering "Create Candidate",
  // which upserts and can overwrite a curated label) rather than "unknown
  // because the read was incomplete", and an omitted orphaned publication stays
  // unreachable for Unpublish. When the evidence is known incomplete, keep the
  // warning and the read-only table for operator visibility, and gate the
  // WRITE and VISIBILITY-INCREASING controls -- Create, Refresh and Publish --
  // until a clean reload is possible.
  //
  // UNPUBLISH STAYS AVAILABLE, deliberately: it REDUCES visibility and needs
  // nothing from the preview, so gating it would strand the only retraction
  // path precisely when a persistent load failure could leave stale
  // member-visible data unretractable. It remains gated by the in-flight and
  // non-retryable latches.
  //
  // NO ORPHAN INFERENCE IS MADE HERE, and none may be added. `match` or `drift`
  // can prove a publication HAS a live aggregate; absence from the available
  // preview proves nothing, because `unknown` is overloaded server-side (it
  // covers both "no snapshot" and "DRA soft-deleted") and the preview may
  // itself be incomplete. Every unmatched or overloaded state is therefore
  // reported as status-unavailable, and the page makes no absence-based orphan
  // claim under any completeness condition. See site-aggregate-lifecycle-rows.ts.

  // ONE implementation, in a pure module, because this page is an async server
  // component that jsdom cannot render -- inline, its behaviour could only be
  // asserted by matching source strings. See site-aggregate-lifecycle-rows.ts.
  const {
    candidateByKey,
    duplicateCandidateKeys,
    hasDuplicateCandidates,
    lifecycleBlocked,
    unmatchedCandidates,
    outsidePreviewTier,
    liveUnclassified,
    unknownStatusCandidates,
  } = classifyLifecycleRows({
    // The classifier matches on the PUBLICATION IDENTITY -- source DRA plus
    // coordinate cluster. The cluster key it must match against is the one the
    // database persisted, so the SERVER-derived `canonical_cluster_id` is what
    // goes in. Before F2 this was the TypeScript-derived key, which is the same
    // conflation the whole change removes.
    aggregates: aggregates.map((r) => ({
      source_dra_id: r.source_dra_id,
      coordinate_cluster_id: r.canonical_cluster_id,
    })),
    candidates,
    previewIncomplete,
    candidateIncomplete,
  });

  /**
   * The identity a persisted candidate carries, for rows that have no live
   * preview row of their own (outside-preview-tier, unclassified, and
   * status-unavailable rows).
   *
   * Parsed rather than trusted: `coordinate_cluster_id` and the representative
   * pair both come back over PostgREST, and a row whose stored key or locator
   * does not parse yields `null`, which disables Create/Refresh for that row
   * while leaving Unpublish reachable.
   *
   * These two persisted values DO re-derive to each other by construction: the
   * upsert writes `coordinate_cluster_id = v_derived_cluster` together with the
   * representative pair `current_site_aggregate_snapshot` selected from the very
   * samples that render to that key. The invariant is pinned by executed test
   * rather than assumed here.
   */
  const candidateIdentity = (c: SiteAggregateCandidate) =>
    parseServerClusterIdentity(
      c.coordinate_cluster_id,
      c.representative_latitude,
      c.representative_longitude,
    );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Matrix Map -- Site Aggregate Preview (Option C)
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Preview of what centroid-tier data would look like as one marker per site instead of
            one pin per sample, together with the admin controls for the site aggregate candidate
            lifecycle. Creating, refreshing, publishing or unpublishing a candidate here changes
            only the <strong>site aggregate publication</strong> state.{' '}
            <strong>DRA visibility is never changed by this page</strong>, and publishing an
            aggregate exposes no individual sample or DRA record.
          </p>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            {COORD_TIER_CAPTION.medium}
          </p>
        </header>

        {loadError ? <InlineError message={`Failed to load aggregate preview: ${loadError}`} /> : null}
        {truncated ? (
          <InlineError
            message={`Live preview hit the ${MAX_PAGES * PAGE_SIZE}-row page ceiling. Rows below are INCOMPLETE and must not be used for a publication decision.`}
          />
        ) : null}
        {unparsableRowCount > 0 ? (
          // Reported as loudly as a truncated read, and for the same reason: a
          // row the server returned but this build could not read is simply
          // ABSENT from the table below, and nothing else on the page would say
          // so. Silence here would let a short table read as a complete one.
          <InlineError
            message={`The live preview returned ${unparsableRowCount} row${unparsableRowCount === 1 ? '' : 's'} this application could not read, so ${unparsableRowCount === 1 ? 'it is' : 'they are'} missing below. The list is INCOMPLETE and must not be used for a publication decision.`}
          />
        ) : null}
        {candidateError ? (
          <InlineError
            message={`Candidate lifecycle data is unavailable: ${candidateError}. The medium-tier preview below is UNAFFECTED and still reflects the samples that loaded successfully. Create, Refresh and Publish are disabled until the lifecycle read succeeds; already-loaded published rows keep their Unpublish control.`}
          />
        ) : null}
        {hasDuplicateCandidates ? (
          <InlineError
            message={`Candidate load returned ${duplicateCandidateKeys.length} duplicated publication identit${duplicateCandidateKeys.length === 1 ? 'y' : 'ies'} (source DRA + coordinate cluster). The read is INCONSISTENT, so lifecycle controls are disabled and live-aggregate status is reported as unavailable rather than guessed.`}
          />
        ) : null}
        {candidatesTruncated ? (
          <InlineError
            message={`Candidate load hit the ${MAX_PAGES * PAGE_SIZE}-row page ceiling. The candidate list below is INCOMPLETE -- some published or orphaned rows may be missing their Unpublish control.`}
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
            {/* The "Orphans excluded" count is GONE, deliberately. It was
                computed by counting `source_dra_id IS NULL` over raw sample rows
                this page fetched -- and F2 removes that fetch entirely, because
                clustering samples client-side is what made TypeScript a second
                identity authority. Orphans are still excluded, now by the RPC's
                inner join to `matrix_map.dras`, and that exclusion is pinned by
                executed test. Reporting a count would require re-introducing the
                sample read for a statistic, which is not a trade worth making;
                inventing one from the aggregates would be worse, because the
                aggregates no longer contain the orphan rows to count. */}
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
          {/* EVERY rendered bucket counts. Quarantined duplicates are excluded
              from `unmatchedCandidates` by design, so testing that alone hid the
              whole table -- and every Unpublish control with it -- when all
              candidates were quarantined and no medium-tier aggregate existed. */}
          {aggregates.length === 0 &&
          unknownStatusCandidates.length === 0 &&
          outsidePreviewTier.length === 0 &&
          liveUnclassified.length === 0 &&
          !loadError ? (
            // Every candidate bucket is part of the emptiness test on purpose:
            // if any were omitted, a published publication with no medium-tier
            // aggregate would be hidden behind "no sites found" and left
            // unretractable.
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
                    <th className="py-2 pr-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregates.map((a, index) => {
                    const candidate = candidateByKey.get(
                      `${a.source_dra_id ?? ''}::${a.canonical_cluster_id}`,
                    );
                    return (
                      <tr
                        key={a.aggregate_id}
                        className="border-b border-slate-100 align-top dark:border-slate-800"
                      >
                      <td className="py-2 pr-4">
                        <div className="text-slate-900 dark:text-slate-100">
                          {a.source_dra_title ?? a.source_dra_id}
                        </div>
                        <div className="font-mono text-xs text-slate-400">{a.source_dra_id}</div>
                      </td>
                      <td className="py-2 pr-4">
                        {COORD_TIER_LABEL[a.preview_coordinate_quality_tier]}
                      </td>
                      <td className="py-2 pr-4 text-right font-semibold">
                        {a.preview_sample_count_total}
                      </td>
                      <td className="py-2 pr-4 text-right">{a.preview_sample_count_high}</td>
                      <td className="py-2 pr-4 text-right">{a.preview_sample_count_medium}</td>
                      <td className="py-2 pr-4 text-right">{a.preview_distinct_point_count}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {a.preview_representative_latitude}, {a.preview_representative_longitude}
                      </td>
                      <td className="py-2 pr-4">
                        <SiteAggregateAdminActions
                          source_dra_id={a.source_dra_id || ''}
                          // THE LIFECYCLE PAIR, not the preview one. The upsert
                          // persists the ALL-TIER aggregate, so the locator it is
                          // asked to derive from must be the ALL-TIER
                          // representative. (Under the current construction the
                          // two coincide -- both are the canonical rounded pair of
                          // the same grouping key -- but sending the preview pair
                          // would be correct only by coincidence, and a future
                          // change to either population would silently break it.)
                          identity={{
                            canonicalClusterId: a.canonical_cluster_id,
                            representative: a.lifecycle_representative,
                          }}
                          // THE ALL-TIER VALUES CREATE WOULD PERSIST. The RPC
                          // already returns them; a holistic review caught that
                          // they were being dropped, so on a mixed-tier cluster the
                          // operator saw medium-only counts, clicked Create, and
                          // only learned the persisted all-tier values afterwards.
                          // A preview that cannot show what will be written is not
                          // a preview.
                          lifecyclePreview={{
                            total: a.lifecycle_sample_count_total,
                            high: a.lifecycle_sample_count_high,
                            medium: a.lifecycle_sample_count_medium,
                            low: a.lifecycle_sample_count_low,
                            tier: a.lifecycle_coordinate_quality_tier,
                            source: a.lifecycle_coordinate_source,
                            distinctPoints: a.lifecycle_distinct_point_count,
                          }}
                          defaultLabel={candidate?.member_display_label ?? neutralDefaultLabel(index)}
                          candidate={candidate}
                          disabled={lifecycleBlocked}
                        />
                      </td>
                    </tr>
                  );
                })}
                {outsidePreviewTier.map((c) => (
                  // ALIVE per the server, just not in this MEDIUM-TIER preview:
                  // the cluster kept high- or low-tier samples but lost its last
                  // medium one. Saying "no live aggregate" here would contradict
                  // the drift badge derived from that very aggregate.
                  <tr
                    key={`tier-${c.publication_id ?? `${c.source_dra_id}:${c.coordinate_cluster_id}`}`}
                    className="border-b border-sky-200 bg-sky-50 align-top dark:border-sky-900 dark:bg-sky-950/30"
                  >
                    <td className="py-2 pr-4">
                      <div className="text-slate-900 dark:text-slate-100">
                        {c.member_display_label}
                      </div>
                      <div className="font-mono text-xs text-slate-400">{c.source_dra_id}</div>
                      <div className="mt-1 text-xs font-semibold text-sky-700 dark:text-sky-400">
                        Live, but outside this medium-tier preview
                      </div>
                    </td>
                    <td className="py-2 pr-4">--</td>
                    <td className="py-2 pr-4 text-right">--</td>
                    <td className="py-2 pr-4 text-right">--</td>
                    <td className="py-2 pr-4 text-right">--</td>
                    <td className="py-2 pr-4 text-right">--</td>
                    <td className="py-2 pr-4 font-mono text-xs">--</td>
                    <td className="py-2 pr-4">
                      <SiteAggregateAdminActions
                        source_dra_id={c.source_dra_id}
                        identity={candidateIdentity(c)}
                        defaultLabel={c.member_display_label}
                        candidate={c}
                        disabled={lifecycleBlocked}
                      />
                    </td>
                  </tr>
                ))}
                {liveUnclassified.map((c) => (
                  // LIVE per the server, but the preview evidence is INCOMPLETE,
                  // so why it is missing locally cannot be classified: it may be
                  // outside the medium-tier preview, or it may simply not have
                  // been read. State exactly that, and no more.
                  <tr
                    key={`liveunclassified-${c.publication_id ?? `${c.source_dra_id}:${c.coordinate_cluster_id}`}`}
                    className="border-b border-sky-200 bg-sky-50 align-top dark:border-sky-900 dark:bg-sky-950/30"
                  >
                    <td className="py-2 pr-4">
                      <div className="text-slate-900 dark:text-slate-100">
                        {c.member_display_label}
                      </div>
                      <div className="font-mono text-xs text-slate-400">{c.source_dra_id}</div>
                      <div className="mt-1 text-xs font-semibold text-sky-700 dark:text-sky-400">
                        Live aggregate confirmed; preview incomplete, so its local
                        omission cannot be classified
                      </div>
                    </td>
                    <td className="py-2 pr-4">--</td>
                    <td className="py-2 pr-4 text-right">--</td>
                    <td className="py-2 pr-4 text-right">--</td>
                    <td className="py-2 pr-4 text-right">--</td>
                    <td className="py-2 pr-4 text-right">--</td>
                    <td className="py-2 pr-4 font-mono text-xs">--</td>
                    <td className="py-2 pr-4">
                      <SiteAggregateAdminActions
                        source_dra_id={c.source_dra_id}
                        identity={candidateIdentity(c)}
                        defaultLabel={c.member_display_label}
                        candidate={c}
                        disabled={lifecycleBlocked}
                      />
                    </td>
                  </tr>
                ))}
                {unknownStatusCandidates.map((c) => (
                  // STATUS UNAVAILABLE, never "orphaned". Any of several causes:
                  // an errored or truncated read, a duplicated publication
                  // identity, a soft-deleted DRA (which the server also reports
                  // as `unknown`), or a drift state this build does not
                  // recognise. NOTHING in the RPC contract distinguishes "gone"
                  // from those, so the row states only what is true -- the
                  // status is unavailable -- while staying visible so the
                  // Unpublish escape hatch is never stranded.
                  <tr
                    key={`unknown-${c.publication_id ?? `${c.source_dra_id}:${c.coordinate_cluster_id}`}`}
                    className="border-b border-slate-200 bg-slate-50 align-top dark:border-slate-700 dark:bg-slate-800/40"
                  >
                    <td className="py-2 pr-4">
                      <div className="text-slate-900 dark:text-slate-100">
                        {c.member_display_label}
                      </div>
                      <div className="font-mono text-xs text-slate-400">{c.source_dra_id}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Live aggregate status unavailable
                      </div>
                    </td>
                    <td className="py-2 pr-4">--</td>
                    <td className="py-2 pr-4 text-right">--</td>
                    <td className="py-2 pr-4 text-right">--</td>
                    <td className="py-2 pr-4 text-right">--</td>
                    <td className="py-2 pr-4 text-right">--</td>
                    <td className="py-2 pr-4 font-mono text-xs">--</td>
                    <td className="py-2 pr-4">
                      <SiteAggregateAdminActions
                        source_dra_id={c.source_dra_id}
                        identity={candidateIdentity(c)}
                        defaultLabel={c.member_display_label}
                        candidate={c}
                        disabled={lifecycleBlocked}
                      />
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="What this preview does not do">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>
              This page itself performs no writes: every candidate and publication action is
              carried out by the audited RPCs behind the buttons in the Actions column, never by
              this view. It does not change DRA or sample visibility.
            </li>
            <li>
              It exposes no per-sample identifier, station id, or measurement value. Only site-level
              counts and a representative coordinate are computed.
            </li>
            <li>
              It does not flip DRA or sample visibility. Publish and Unpublish change
              SITE-AGGREGATE publication state only; <code>dras.public</code> and{' '}
              <code>samples.public</code> are never written by this page or its actions.
            </li>
            <li>
              The table, map and summary show the MEDIUM-TIER preview only. Create and Refresh
              capture an ALL-TIER candidate, so a cluster containing high- or low-tier samples
              will show larger counts in the Actions column than in this table. Review the
              all-tier candidate before publishing -- that is what members would see.
            </li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
