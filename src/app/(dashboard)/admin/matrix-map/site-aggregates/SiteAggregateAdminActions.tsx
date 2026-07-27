'use client';

import { useState } from 'react';

export interface SiteAggregateCandidate {
  publication_id?: string;
  source_dra_id: string;
  coordinate_cluster_id: string;
  member_display_label: string;
  is_published: boolean;
  sample_count_total: number;
  sample_count_high?: number;
  sample_count_medium?: number;
  sample_count_low?: number;
  distinct_point_count?: number;
  representative_latitude?: number;
  representative_longitude?: number;
  coordinate_quality_tier?: string;
  data_snapshot_version?: string;
  /**
   * Persisted by the DB (site_aggregate_publications.source_sample_hash). Kept on
   * the type because the admin RPC returns it, but NOT usable for drift detection
   * here -- see the comment on `computeSnapshotDrift`.
   */
  source_sample_hash?: string;
}

/**
 * The live-side snapshot the candidate is compared against. Every field is
 * already present on the computed `SiteAggregate` row the admin page renders.
 */
export interface LiveAggregateSnapshot {
  sample_count_total: number;
  sample_count_high: number;
  sample_count_medium: number;
  sample_count_low: number;
  distinct_point_count: number;
  representative_latitude: number;
  representative_longitude: number;
  coordinate_quality_tier: string;
}

/** Coordinates are stored round(...,5) by the DB; round both sides before comparing. */
function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

/**
 * Drift = the candidate's persisted snapshot no longer matches live source data.
 *
 * WHY NOT A HASH COMPARISON. The workplan (section 5) describes comparing the
 * candidate hash against "the live hash", and the DB does persist
 * `source_sample_hash`. But the live hash is produced ONLY by
 * `matrix_map.current_site_aggregate_snapshot`, whose EXECUTE is REVOKED from
 * PUBLIC, anon, authenticated and service_role (draft SQL line 587) -- it is
 * reachable only from inside SECURITY DEFINER functions. The admin page uses the
 * caller's authenticated client, so it cannot obtain a live hash at all.
 * Reimplementing that md5 over Postgres `jsonb_build_array(...)::text` in
 * TypeScript would duplicate a SQL definition and silently drift from it.
 *
 * So this compares the full persisted snapshot TUPLE against the live computed
 * aggregate. Both sides already carry every field. That is strictly stronger
 * than the previous `sample_count_total`-only check: it also catches tier
 * redistribution, changes in distinct point count, and moved representative
 * coordinates that leave the total unchanged. The one case it cannot see is a
 * substitution that preserves every aggregate field but changes sample identity;
 * closing that needs an admin-callable snapshot RPC, which is new DDL and out of
 * scope here.
 *
 * Returns false when the candidate carries no comparable snapshot fields, so an
 * unknown state is never reported to the operator as drift.
 */
export type SnapshotDriftState = 'match' | 'drift' | 'unknown';

export function computeSnapshotDrift(
  candidate: SiteAggregateCandidate | undefined,
  live: LiveAggregateSnapshot | undefined,
): SnapshotDriftState {
  if (!candidate) return 'match';
  // No live aggregate (an orphaned publication) means drift is UNKNOWABLE, not
  // absent. Returning the same value as a confirmed match would leave Publish
  // available while silently hiding that the comparison never happened.
  if (!live) return 'unknown';

  // Every field of the comparison tuple must be present on the candidate. A
  // partial or version-skewed admin row previously had its absent fields
  // silently skipped, so an incomplete snapshot was indistinguishable from a
  // confirmed match.
  const requiredPresent =
    typeof candidate.sample_count_total === 'number' &&
    typeof candidate.sample_count_high === 'number' &&
    typeof candidate.sample_count_medium === 'number' &&
    typeof candidate.sample_count_low === 'number' &&
    typeof candidate.distinct_point_count === 'number' &&
    typeof candidate.representative_latitude === 'number' &&
    typeof candidate.representative_longitude === 'number' &&
    typeof candidate.coordinate_quality_tier === 'string';
  if (!requiredPresent) return 'unknown';

  const comparisons: Array<[unknown, unknown]> = [
    [candidate.sample_count_total, live.sample_count_total],
    [candidate.sample_count_high, live.sample_count_high],
    [candidate.sample_count_medium, live.sample_count_medium],
    [candidate.sample_count_low, live.sample_count_low],
    [candidate.distinct_point_count, live.distinct_point_count],
    [candidate.coordinate_quality_tier, live.coordinate_quality_tier],
    [
      typeof candidate.representative_latitude === 'number'
        ? round5(candidate.representative_latitude)
        : undefined,
      round5(live.representative_latitude),
    ],
    [
      typeof candidate.representative_longitude === 'number'
        ? round5(candidate.representative_longitude)
        : undefined,
      round5(live.representative_longitude),
    ],
  ];

  return comparisons.some(([candidateValue, liveValue]) => candidateValue !== liveValue)
    ? 'drift'
    : 'match';
}

interface SiteAggregateAdminActionsProps {
  source_dra_id: string;
  coordinate_cluster_id: string;
  defaultLabel: string;
  candidate?: SiteAggregateCandidate;
  liveSnapshot?: LiveAggregateSnapshot;
}

export function SiteAggregateAdminActions({
  source_dra_id,
  coordinate_cluster_id,
  defaultLabel,
  candidate,
  liveSnapshot,
}: SiteAggregateAdminActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState(candidate?.member_display_label || defaultLabel);
  const [reason, setReason] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<'create' | 'refresh' | 'publish' | 'unpublish' | null>(null);

  const driftState = computeSnapshotDrift(candidate, liveSnapshot);
  const drift = driftState === 'drift';
  const driftUnknown = driftState === 'unknown';

  const handleAction = async () => {
    if (!actionType) return;
    if (actionType === 'create' || actionType === 'refresh') {
      if (!label.trim() || !reason.trim()) {
        setError('Label and reason are required.');
        return;
      }
    } else {
      if (!reason.trim()) {
        setError('Reason is required.');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      if (actionType === 'create' || actionType === 'refresh') {
        const res = await fetch('/api/matrix-map/admin/site-aggregates/candidate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_dra_id,
            coordinate_cluster_id,
            member_display_label: label,
            reason,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.detail || 'Failed to save candidate');
        }
      } else if (actionType === 'publish' || actionType === 'unpublish') {
        const res = await fetch('/api/matrix-map/admin/site-aggregates/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publication_id: candidate?.publication_id,
            public: actionType === 'publish',
            reason,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.detail || 'Failed to publish/unpublish');
        }
      }
      
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  const openModal = (type: 'create' | 'refresh' | 'publish' | 'unpublish') => {
    setActionType(type);
    setShowModal(true);
    setError(null);
    setReason('');
  };

  return (
    <div>
      <div className="flex flex-col gap-2">
        {!candidate && (
          <button
            onClick={() => openModal('create')}
            className="text-xs rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            Create Candidate
          </button>
        )}
        {candidate && !candidate.is_published && (
          <>
            <button
              onClick={() => openModal('publish')}
              className="text-xs rounded bg-green-600 px-2 py-1 text-white hover:bg-green-700 disabled:opacity-50"
              disabled={loading}
            >
              Publish
            </button>
            <button
              onClick={() => openModal('refresh')}
              className="text-xs rounded bg-slate-600 px-2 py-1 text-white hover:bg-slate-700 disabled:opacity-50"
              disabled={loading}
            >
              Refresh Candidate {drift && <span className="ml-1 text-amber-300" title="The stored candidate snapshot no longer matches live source data.">(Drifted)</span>}
            </button>
          </>
        )}
        {candidate && candidate.is_published && (
          <button
            onClick={() => openModal('unpublish')}
            className="text-xs rounded bg-rose-600 px-2 py-1 text-white hover:bg-rose-700 disabled:opacity-50"
            disabled={loading}
          >
            Unpublish
          </button>
        )}
        {candidate && (
          <div className="text-[10px] text-slate-500">
            {candidate.is_published ? 'Published' : 'Unpublished'}
          </div>
        )}
        {candidate && driftUnknown && (
          // Explicitly distinct from "no drift". The comparison could not be
          // performed -- no live aggregate, or an incomplete snapshot row -- so
          // the operator must not read the absence of a drift badge as a
          // confirmed match.
          <div
            className="text-[10px] font-semibold text-amber-700 dark:text-amber-400"
            title="Drift could not be determined: no live aggregate or an incomplete candidate snapshot."
          >
            Drift unknown
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 capitalize">
              {actionType} Candidate
            </h3>
            
            {(actionType === 'create' || actionType === 'refresh') && (
              <div className="mb-4">
                <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Member Display Label</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full rounded border p-2 text-sm dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                />
              </div>
            )}
            
            <div className="mb-4">
              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded border p-2 text-sm dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                rows={3}
              />
            </div>

            {error && (
              <div className="mb-4 text-sm text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="rounded px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 capitalize"
                disabled={loading}
              >
                {loading ? 'Processing...' : actionType}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
