'use client';

// =====================================================================
// Matrix Interactive Map -- partial-visibility banner (PR-MAP-3a + 3c)
// =====================================================================
//
// Lane:   Matrix Interactive Map
// Branch: feat/matrix-map-pr-map-3c-banner-refinements
// Plan:   docs/design/matrix-map/PR_MAP_3_PLAN.md sections 5.2 + 5.3 + 5.4
//
// Renders ONLY when hidden_sample_count > 0 (Q-8 suppression rule). The
// reviewer sees an honest aggregate count of samples in private DRAs
// they do NOT have grants for, with a mailto link to request access.
//
// Privacy contract (grants v2.3 D-1 / R-10):
//   - The RPC returns hidden_dra_ids as opaque UUIDs ONLY.
//   - NO titles / citations / agencies are EVER projected for hidden
//     DRAs. The mailto body is the ONLY place those UUIDs surface, and
//     they go to a trusted admin mailbox.
//
// Dismiss state (PR-MAP-3c refinement; design 5.3):
//   - Per-session only (useState). NOT persisted to LocalStorage.
//     Design 5.3 verbatim: "the banner dismisses for the current
//     session (non-persistent; reappears on reload). This is
//     intentional -- we want the reviewer to be reminded of the hidden
//     samples on each session, not to suppress them permanently."
//   - HOWEVER: dismissal is scoped to the `dataSnapshotVersion`. If the
//     server returns a new snapshot (e.g. an admin granted access mid-
//     session and the user clicked [Refresh], OR the ETL re-ran), the
//     prior dismissal does NOT carry forward -- the banner re-appears
//     with the fresh counts. This matches the design intent (remind on
//     each meaningful state change) without persisting across reloads.
//
// Refresh trigger (PR-MAP-3c; design 5.4):
//   - Explicit [Refresh] button next to [X]. One supabase_reads
//     increment per click. Auto-refresh-on-focus is EXPLICITLY out of
//     scope per design 5.4 ("adds an event hook + a budget-breaker
//     cost every time the user alt-tabs back to the dashboard").
//
// Learn-more link (PR-MAP-3c; design 5.3 mock):
//   - [Learn about DRA confidentiality] link, target = internal
//     methodology-appendix anchor (plan v3 section 5 item 8 -- EMA
//     s.43). Configurable via NEXT_PUBLIC_MATRIX_DRA_LEARN_MORE_URL;
//     defaults to an in-page anchor placeholder until the methodology
//     appendix route lands in a later PR.
//
// Plain ASCII only. Per L0 CLAUDE.md section 1.1.
// =====================================================================

import { useEffect, useState } from 'react';
import { Info, RefreshCw, X } from 'lucide-react';

import type { Classification } from './types';

export interface ClassificationCounts {
  reference: number;
  impacted: number;
  unknown: number;
}

interface PartialVisibilityBannerProps {
  visibleCount: number;
  hiddenSampleCount: number;
  hiddenDraCount: number;
  hiddenDraIds: string[];
  /**
   * Snapshot token returned by `fetch_samples_with_hidden_summary`. Used
   * to scope the session dismissal so a fresh snapshot (post-refresh or
   * post-ETL) re-shows the banner without the user having to reload.
   */
  dataSnapshotVersion: string;
  /**
   * Per-classification breakdown of the visible-samples line. Computed
   * client-side in MatrixMap.tsx from the same visible_samples array
   * the markers render, so it is deterministic + matches what the user
   * sees on the map. Per design 5.3.
   */
  classificationCounts: ClassificationCounts;
  /**
   * Optional [Refresh] callback. When provided, the banner renders a
   * Refresh button next to [X]. The parent owns the actual RPC re-call
   * + state update so the banner stays purely presentational. Per
   * design 5.4.
   */
  onRefresh?: () => void | Promise<void>;
  /**
   * When true, the [Refresh] button is shown in a busy state + the
   * click is suppressed. Drives the aria-busy attribute on the banner.
   */
  isRefreshing?: boolean;
}

const DEFAULT_ADMIN_EMAIL = 'jasen.nelson@gmail.com';
const DEFAULT_LEARN_MORE_URL = '#methodology-dra-confidentiality';

/**
 * Resolve the contact email. Reads `NEXT_PUBLIC_MATRIX_ADMIN_EMAIL` at
 * build time; falls back to a sensible default. Documented as
 * configurable per the task brief (PR-MAP-3a deliverable 4).
 */
function getAdminEmail(): string {
  const fromEnv =
    typeof process !== 'undefined' && process.env
      ? process.env.NEXT_PUBLIC_MATRIX_ADMIN_EMAIL
      : undefined;
  return fromEnv && fromEnv.trim().length > 0
    ? fromEnv
    : DEFAULT_ADMIN_EMAIL;
}

/**
 * Resolve the [Learn about DRA confidentiality] link target. Per
 * design 5.3 the link points at the methodology-appendix EMA s.43
 * anchor; until that route lands, an in-page anchor placeholder is
 * acceptable + configurable via env.
 */
function getLearnMoreUrl(): string {
  const fromEnv =
    typeof process !== 'undefined' && process.env
      ? process.env.NEXT_PUBLIC_MATRIX_DRA_LEARN_MORE_URL
      : undefined;
  return fromEnv && fromEnv.trim().length > 0
    ? fromEnv
    : DEFAULT_LEARN_MORE_URL;
}

function buildMailtoHref(hiddenDraIds: string[]): string {
  const email = getAdminEmail();
  const subject = 'Matrix Map access request';
  const idList =
    hiddenDraIds.length > 0
      ? hiddenDraIds.join('\n')
      : '(no DRA ids surfaced)';
  const body =
    'Hello,\n\n' +
    'I would like to request access to the following private DRAs ' +
    'on the Matrix Interactive Map:\n\n' +
    idList +
    '\n\nThank you.';
  const params = new URLSearchParams({ subject, body });
  return `mailto:${email}?${params.toString()}`;
}

function formatClassificationBreakdown(
  counts: ClassificationCounts,
): string {
  // Per design 5.3 mock: "(15 reference, 99 impacted, 28 unknown)".
  // Stable ordering -- reference, impacted, unknown -- matches the
  // legend card section ordering so the eye sweeps left-to-right.
  const parts: { key: Classification; n: number }[] = [
    { key: 'reference', n: counts.reference },
    { key: 'impacted', n: counts.impacted },
    { key: 'unknown', n: counts.unknown },
  ];
  return parts.map((p) => `${p.n} ${p.key}`).join(', ');
}

export function PartialVisibilityBanner({
  visibleCount,
  hiddenSampleCount,
  hiddenDraCount,
  hiddenDraIds,
  dataSnapshotVersion,
  classificationCounts,
  onRefresh,
  isRefreshing = false,
}: PartialVisibilityBannerProps) {
  // Dismiss state is scoped to the current snapshot version. When the
  // server returns a fresh snapshot (e.g. after [Refresh] or an ETL
  // run) the prior dismissal is cleared so the banner re-appears with
  // the new hidden counts. NOT localStorage (per design 5.3) -- this
  // is still a session-only piece of state, just snapshot-aware.
  const [dismissedSnapshot, setDismissedSnapshot] = useState<string | null>(
    null,
  );

  useEffect(() => {
    // When the snapshot changes, clear stale dismissal so the new
    // snapshot's banner appears. We compare against the dismissed-
    // snapshot rather than overwriting unconditionally so a same-
    // snapshot re-render does not flip dismiss back on.
    if (
      dismissedSnapshot !== null &&
      dismissedSnapshot !== dataSnapshotVersion
    ) {
      setDismissedSnapshot(null);
    }
  }, [dataSnapshotVersion, dismissedSnapshot]);

  // Q-8: suppress when hidden_sample_count == 0. Defensive double-check
  // even though MatrixMap also gates rendering on this -- belt + braces.
  if (hiddenSampleCount <= 0) return null;
  if (dismissedSnapshot === dataSnapshotVersion) return null;

  const draNoun = hiddenDraCount === 1 ? 'private DRA' : 'private DRAs';
  const sampleNoun =
    hiddenSampleCount === 1 ? 'sample' : 'samples';
  const visibleSampleNoun = visibleCount === 1 ? 'sample' : 'samples';

  const mailtoHref = buildMailtoHref(hiddenDraIds);
  const learnMoreHref = getLearnMoreUrl();
  const breakdown = formatClassificationBreakdown(classificationCounts);

  const handleRefresh = () => {
    if (isRefreshing || !onRefresh) return;
    void onRefresh();
  };

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-20 z-[1000] flex w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 justify-center"
      data-testid="matrix-map-banner-wrap"
    >
      <div
        role="status"
        aria-live="polite"
        aria-busy={isRefreshing ? 'true' : 'false'}
        data-testid="matrix-map-partial-visibility-banner"
        data-snapshot-version={dataSnapshotVersion}
        className="pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-md"
      >
        <Info
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600"
        />
        <div className="flex-1 leading-snug">
          <p>
            <span className="font-semibold">
              Visible: {visibleCount} {visibleSampleNoun} ({breakdown}).
            </span>{' '}
            Hidden: {hiddenSampleCount} {sampleNoun} in {hiddenDraCount}{' '}
            {draNoun} you do not have access to.
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <a
              href={mailtoHref}
              className="font-medium underline hover:text-amber-700"
              data-testid="matrix-map-banner-mailto"
            >
              Contact admin to request access
            </a>
            <a
              href={learnMoreHref}
              className="font-medium underline hover:text-amber-700"
              data-testid="matrix-map-banner-learn-more"
            >
              Learn about DRA confidentiality
            </a>
          </p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh hidden-sample counts"
            className="flex-shrink-0 rounded-md p-1 text-amber-700 hover:bg-amber-100 disabled:cursor-wait disabled:opacity-50"
            data-testid="matrix-map-banner-refresh"
          >
            <RefreshCw
              className={
                'h-4 w-4 ' + (isRefreshing ? 'animate-spin' : '')
              }
            />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setDismissedSnapshot(dataSnapshotVersion)}
          aria-label="Dismiss partial-visibility banner"
          className="flex-shrink-0 rounded-md p-1 text-amber-700 hover:bg-amber-100"
          data-testid="matrix-map-banner-dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
