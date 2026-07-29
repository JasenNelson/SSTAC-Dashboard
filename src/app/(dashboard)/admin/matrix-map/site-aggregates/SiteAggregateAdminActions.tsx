'use client';

import { useRef, useState } from 'react';

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
  /**
   * Returned by the admin RPC (site_aggregate_count_bucket over the persisted
   * total). Displayed so the operator sees the member-facing bucket the
   * candidate would publish as, not one derived from the medium-tier preview.
   */
  count_bucket?: string;
  /**
   * OPTIMISTIC-CONCURRENCY TOKEN from the admin RPC, transmitted back verbatim
   * on Publish. Kept as the exact PostgREST string -- never parsed into a Date
   * and re-serialised, because a round trip through Date loses sub-millisecond
   * precision and would make every publish look like a conflict.
   */
  updated_at?: string;
  /**
   * Returned by the admin RPC for display/provenance. NOT used for drift -- the
   * server decides that (see `resolveSnapshotDriftState`).
   */
  coordinate_source?: string | null;
  data_snapshot_version?: string;
  /**
   * Persisted by the DB. The SERVER compares this against the freshly recomputed
   * hash and returns the verdict in `snapshot_drift_state`; the client never
   * recomputes or compares it.
   */
  source_sample_hash?: string;
  /**
   * 'match' | 'drift' | 'unknown', decided by
   * matrix_map.fetch_admin_site_aggregate_publications. Optional on the type so
   * a response from an older RPC deserialises; `resolveSnapshotDriftState` maps
   * absent or unrecognised values to `unknown`, never `match`.
   */
  snapshot_drift_state?: string;
}

/**
 * Drift = the candidate's persisted snapshot no longer matches live source data.
 *
 * THE SERVER DECIDES. `matrix_map.fetch_admin_site_aggregate_publications`
 * returns `snapshot_drift_state` per candidate, derived by comparing the
 * persisted `source_sample_hash` against the one recomputed by
 * `matrix_map.current_site_aggregate_snapshot` through a LEFT LATERAL join.
 * This module now only READS that value.
 *
 * WHY THE CLIENT NO LONGER COMPUTES IT. An earlier revision recomputed the live
 * aggregate in TypeScript and compared it field-by-field. That made the client a
 * second implementation of a PostgreSQL aggregate, and the two could not be
 * reconciled over an unconstrained `text` column: the sample population differed
 * (medium-only vs all-tier), blank handling differed (JS truthiness vs
 * `length(trim(...)) > 0`), trim semantics differed (PostgreSQL `trim` strips
 * U+0020 only, JS `.trim()` strips all ECMAScript whitespace), and sort order
 * differed (`COLLATE "C"` compares UTF-8 bytes, JS compares UTF-16 code units).
 * Every one of those produced PERMANENT drift no refresh could clear. Hash
 * equality on the server retires that entire class, and additionally catches a
 * sample-identity substitution that leaves every visible field unchanged --
 * which no field-by-field comparison could ever see.
 */
export type SnapshotDriftState = 'match' | 'drift' | 'unknown';

const DRIFT_STATES: readonly string[] = ['match', 'drift', 'unknown'];

/**
 * Statuses on which a mutation provably did NOT commit: the server rejected the
 * request before executing it. Only these may re-enable submission without the
 * server stating retry semantics explicitly.
 *
 * Anything else -- notably 409 and any 5xx -- may have committed, so an error
 * body carrying no `retry_safe` leaves the outcome UNKNOWN and must latch.
 * Accepting such a body merely because it parsed was how a post-commit failure
 * with missing contract fields could still re-enable the control.
 */
const PRE_COMMIT_STATUSES: readonly number[] = [400, 401, 403, 404, 415, 422];

/**
 * Read the server's verdict. Anything absent, malformed, or unrecognised is
 * `unknown` -- never `match`. An unrecognised value means this client is older
 * than the RPC, and silently reporting "no drift" in that case is exactly the
 * failure mode the whole correction removed.
 */
export function resolveSnapshotDriftState(
  candidate: SiteAggregateCandidate | undefined,
): SnapshotDriftState {
  if (!candidate) return 'match';
  const state = candidate.snapshot_drift_state;
  if (typeof state !== 'string' || !DRIFT_STATES.includes(state)) return 'unknown';
  return state as SnapshotDriftState;
}

interface SiteAggregateAdminActionsProps {
  source_dra_id: string;
  coordinate_cluster_id: string;
  defaultLabel: string;
  candidate?: SiteAggregateCandidate;
  /**
   * FAIL-CLOSED flag set by the page when the underlying evidence (sample load
   * or candidate load) is known incomplete -- errored or truncated.
   *
   * WHEN TRUE IT GATES **Create, Refresh and Publish** -- and only those. Each
   * renders disabled AND has no click handler wired at all, so a click cannot
   * open the modal or reach `handleAction` even if a disabled-attribute bypass
   * existed. Those three either write from, or increase visibility on the basis
   * of, evidence that is known unreliable.
   *
   * **UNPUBLISH IS DELIBERATELY EXEMPT.** It is the visibility-REDUCING
   * emergency retraction path, and it needs nothing from the preview: the
   * publication id comes from the candidate row and the server revalidates it.
   * Gating it here would disable the only retraction path exactly when a
   * persistent load failure could otherwise leave stale member-visible data
   * unretractable. See the rationale at the Unpublish button itself.
   *
   * Unpublish is still gated by `loading` (no double-submit) and by the
   * non-retryable action latch, matching every other control.
   *
   * Defaults to false so existing callers stay valid.
   */
  disabled?: boolean;
}

export function SiteAggregateAdminActions({
  source_dra_id,
  coordinate_cluster_id,
  defaultLabel,
  candidate,
  disabled = false,
}: SiteAggregateAdminActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState(candidate?.member_display_label || defaultLabel);
  const [reason, setReason] = useState('');
  const [showModal, setShowModal] = useState(false);
  /**
   * Latched when the server reports a POST-COMMIT outcome (`retry_safe: false`).
   * The mutation already committed, so the submit control must NOT return to a
   * ready state: an identical resubmission writes a second upsert plus another
   * refresh audit entry. Cleared only by reloading the page.
   */
  const [nonRetryable, setNonRetryable] = useState(false);
  const [actionType, setActionType] = useState<'create' | 'refresh' | 'publish' | 'unpublish' | null>(null);
  /**
   * SYNCHRONOUS in-flight lock.
   *
   * `loading` is React STATE, so it is read from the render closure. Two
   * submissions dispatched within a SINGLE tick -- before React has re-rendered
   * with `loading: true` -- both read the same stale `false` and both proceed,
   * producing two upserts and two audit rows. A ref is written and read
   * synchronously, so the second submission in that same tick sees the lock the
   * first one set.
   *
   * The state guard is KEPT alongside it: it is what disables the control across
   * renders and drives the visible "Processing..." affordance. The ref is what
   * closes the same-tick race, and only that.
   */
  const submitLockRef = useRef(false);

  const driftState = resolveSnapshotDriftState(candidate);
  const drift = driftState === 'drift';
  const driftUnknown = driftState === 'unknown';
  // Publishing is permitted only on a confirmed match. `drift` and `unknown`
  // both block it, as does the incomplete-evidence flag.
  const publishBlocked = disabled || driftState !== 'match';

  /**
   * The form's ONLY submission path.
   *
   * `preventDefault` runs before the guards so a blocked submission never falls
   * through to a native navigation, and the guards then decide whether any work
   * happens. Putting them here rather than on a button's onClick is what makes
   * them real: a disabled attribute can be cleared, and Enter-to-submit never
   * consults it at all.
   */
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The synchronous lock is checked FIRST and alongside the two state guards.
    // `nonRetryable` remains an INDEPENDENT condition here (and on the submit
    // button's `disabled`), so releasing the lock below never weakens the
    // post-commit latch.
    if (submitLockRef.current || loading || nonRetryable) return;
    // Taken BEFORE any async work is invoked. This assignment and the check
    // above are the only two points that matter for the same-tick race.
    submitLockRef.current = true;
    void runGuardedAction();
  };

  /**
   * Owns the lifetime of `submitLockRef`. The lock is released in `finally`, so
   * every exit path releases it: an early validation return, a retry-safe
   * server error, an indeterminate transport failure, and an unexpected throw.
   * Releasing it does NOT re-open a latched control -- `nonRetryable` is a
   * separate state guard that outlives the lock.
   */
  const runGuardedAction = async () => {
    try {
      await handleAction();
    } catch (err: unknown) {
      // `handleAction` handles its own failures, so reaching here means an
      // unexpected one escaped. Surface it rather than swallowing it.
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    } finally {
      submitLockRef.current = false;
    }
  };

  const handleAction = async () => {
    if (!actionType) return;
    // The in-flight guard lives in handleSubmit, the SINGLE path that reaches
    // here. Duplicating it in this function would make the guard untestable:
    // a regression in either copy would be masked by the other, which is
    // exactly how a protection ends up defended only by a vacuous test.
    // Refuse outright once a post-commit outcome has been reported, so a
    // second submission cannot be issued even if the control is clicked again.
    if (nonRetryable) return;
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
    // From here on a mutating request is IN FLIGHT. `responseObserved` records
    // whether the server actually ANSWERED. A well-formed answer -- even a 4xx
    // -- means the outcome is known. No answer at all means it is INDETERMINATE.
    let dispatched = false;
    let responseObserved = false;

    try {
      if (actionType === 'create' || actionType === 'refresh') {
        dispatched = true;
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
          // The body must be READABLE before the outcome counts as observed.
          // A truncated or unparseable body means we do not know what the
          // server decided, and the write may already have committed -- so it
          // is INDETERMINATE and must latch, not re-enable.
          let errData: Record<string, unknown>;
          try {
            const parsed: unknown = await res.json();
            // The body must SATISFY THE CONTRACT before the answer counts as
            // authoritative, not merely parse. `null`, an array, and a bare
            // `{}` all parse; none carries `error`/`retry_safe`, so accepting
            // them marked the response observed and then fell through to the
            // generic error path, which re-enabled submission even though the
            // mutation may have committed.
            if (
              parsed === null ||
              typeof parsed !== 'object' ||
              Array.isArray(parsed) ||
              typeof (parsed as Record<string, unknown>).error !== 'string'
            ) {
              throw new Error('body did not satisfy the error-response contract');
            }
            errData = parsed as Record<string, unknown>;
          } catch {
            throw new Error(
              `The server responded ${res.status} but the response body could not be read`,
            );
          }
          // The body must also carry RETRY SEMANTICS unless the status itself
          // proves the mutation never ran.
          // A BOOLEAN is required, not merely "not undefined". `null`, a
          // string, or any other shape is unusable retry semantics, and the
          // later strict `=== false` test would not latch on it -- so the
          // control would re-enable on a possibly-post-commit response.
          if (
            typeof errData.retry_safe !== 'boolean' &&
            !PRE_COMMIT_STATUSES.includes(res.status)
          ) {
            throw new Error(
              `The server responded ${res.status} without usable retry semantics`,
            );
          }
          responseObserved = true;
          // `error` is a machine code; `detail` carries the operator-critical
          // sentence. For POST-COMMIT conditions such as
          // `verification_label_mismatch` the detail is the part that matters --
          // "the upsert already committed. Do not retry blindly." Preferring
          // `error` alone showed the operator only the code, left the modal open
          // and re-enabled, and invited exactly the retry that creates a
          // spurious refresh/audit row. Surface both, detail included.
          const code = typeof errData.error === 'string' ? errData.error : '';
          const detail = typeof errData.detail === 'string' ? errData.detail : '';
          const message =
            code && detail ? `${code}: ${detail}` : detail || code || 'Failed to save candidate';
          // POST-COMMIT outcomes carry `retry_safe: false`. The write ALREADY
          // landed, so re-enabling an identical submission would perform a
          // second upsert and write another refresh audit entry. Latch the
          // control instead and tell the operator to reload and reconcile.
          if (errData.retry_safe === false) {
            setNonRetryable(true);
          }
          throw new Error(message);
        }
      } else if (actionType === 'publish' || actionType === 'unpublish') {
        dispatched = true;
        const res = await fetch('/api/matrix-map/admin/site-aggregates/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publication_id: candidate?.publication_id,
            public: actionType === 'publish',
            reason,
            // The version the operator actually reviewed. Sent verbatim; the
            // SQL compares it under FOR UPDATE and refuses to publish a
            // candidate that changed since it was displayed. Unpublish sends it
            // too when known, but the server tolerates a stale one there
            // because retraction only REDUCES member visibility.
            expected_updated_at: candidate?.updated_at ?? null,
          }),
        });

        if (!res.ok) {
          let errData: Record<string, unknown>;
          try {
            const parsed: unknown = await res.json();
            // The body must SATISFY THE CONTRACT before the answer counts as
            // authoritative, not merely parse. `null`, an array, and a bare
            // `{}` all parse; none carries `error`/`retry_safe`, so accepting
            // them marked the response observed and then fell through to the
            // generic error path, which re-enabled submission even though the
            // mutation may have committed.
            if (
              parsed === null ||
              typeof parsed !== 'object' ||
              Array.isArray(parsed) ||
              typeof (parsed as Record<string, unknown>).error !== 'string'
            ) {
              throw new Error('body did not satisfy the error-response contract');
            }
            errData = parsed as Record<string, unknown>;
          } catch {
            throw new Error(
              `The server responded ${res.status} but the response body could not be read`,
            );
          }
          // The body must also carry RETRY SEMANTICS unless the status itself
          // proves the mutation never ran.
          // A BOOLEAN is required, not merely "not undefined". `null`, a
          // string, or any other shape is unusable retry semantics, and the
          // later strict `=== false` test would not latch on it -- so the
          // control would re-enable on a possibly-post-commit response.
          if (
            typeof errData.retry_safe !== 'boolean' &&
            !PRE_COMMIT_STATUSES.includes(res.status)
          ) {
            throw new Error(
              `The server responded ${res.status} without usable retry semantics`,
            );
          }
          responseObserved = true;
          const code = typeof errData.error === 'string' ? errData.error : '';
          const detail = typeof errData.detail === 'string' ? errData.detail : '';
          const message =
            code && detail ? `${code}: ${detail}` : detail || code || 'Failed to publish/unpublish';
          if (errData.retry_safe === false) {
            setNonRetryable(true);
          }
          throw new Error(message);
        }
      }

      responseObserved = true;
      window.location.reload();
    } catch (err: unknown) {
      // CLIENT-SIDE TRANSPORT LOSS. If the request was dispatched and we then
      // failed to obtain a well-formed answer -- the connection dropped, the
      // tab lost the response, the body could not be read -- the write may
      // ALREADY HAVE COMMITTED. Clearing `loading` alone re-enabled submission
      // and a retry would write a second upsert plus another refresh audit
      // entry, which is exactly what the server-side `retry_safe: false`
      // contract exists to prevent. Treat it as indeterminate and require a
      // reload, the same as an explicit post-commit response.
      //
      // `nonRetryable` may already be set by the `retry_safe: false` branch
      // above; setting it again is harmless and keeps the two paths uniform.
      if (dispatched && !responseObserved) {
        setNonRetryable(true);
        setError(
          (err instanceof Error ? err.message : String(err)) +
            ' -- the request was sent but no usable response was received, so it is UNKNOWN whether it took effect. Do not retry: reload the page and check before acting again.',
        );
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
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
        {disabled && (
          // PRECISE, because Unpublish deliberately ignores `disabled` so a
          // published aggregate is always retractable. A blanket "actions
          // disabled" sat directly above a live Unpublish button and was simply
          // false -- the operator could see the contradiction.
          <div
            className="text-[10px] font-semibold text-amber-700 dark:text-amber-400"
            title="The underlying sample or candidate data load was errored or truncated, so this row's evidence is known incomplete. Create, Refresh and Publish are disabled until a clean reload succeeds. Unpublish stays available on purpose: retracting a published aggregate is always safe, and incomplete evidence must never strand it."
          >
            Create, Refresh and Publish disabled: data incomplete (Unpublish
            remains available)
          </div>
        )}
        {!candidate && (
          <>
            <button
              onClick={disabled ? undefined : () => openModal('create')}
              className="text-xs rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={disabled || loading}
            >
              Create Candidate
            </button>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              Captures ALL tiers, not just the medium-tier preview shown in this
              table. Creating stages a candidate for review; it publishes
              nothing. Review the captured snapshot before Publish.
            </div>
          </>
        )}

        {candidate && (
          // THE AUTHORITATIVE CANDIDATE, exactly as persisted and exactly what
          // becomes member-visible on Publish. These are the values returned by
          // the admin RPC -- NOT recomputed here, and NOT the medium-tier row
          // this table renders. The two legitimately differ on a mixed-tier
          // cluster, and the operator must approve the one that will actually
          // be published.
          <div className="rounded border border-slate-300 p-1 text-[10px] text-slate-600 dark:border-slate-600 dark:text-slate-300">
            <div className="font-semibold">All-tier publication candidate</div>
            {/* THE MEMBER-VISIBLE STRING, verbatim as persisted. The table row
                beside this shows the PRIVATE DRA name, so without this an
                operator could approve a publication having never seen the label
                members will actually be served. */}
            <div className="mt-0.5">
              member label:{' '}
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                {candidate.member_display_label}
              </span>
            </div>
            <div>
              total {candidate.sample_count_total}
              {typeof candidate.sample_count_high === 'number' &&
              typeof candidate.sample_count_medium === 'number' &&
              typeof candidate.sample_count_low === 'number' ? (
                <>
                  {' '}(high {candidate.sample_count_high}, medium{' '}
                  {candidate.sample_count_medium}, low {candidate.sample_count_low})
                </>
              ) : null}
            </div>
            {typeof candidate.distinct_point_count === 'number' ? (
              <div>distinct points {candidate.distinct_point_count}</div>
            ) : null}
            {candidate.coordinate_quality_tier ? (
              <div>dominant tier {candidate.coordinate_quality_tier}</div>
            ) : null}
            {candidate.count_bucket ? <div>bucket {candidate.count_bucket}</div> : null}
          </div>
        )}

        {/*
          DRIFT STATE IS RENDERED OUTSIDE THE BUTTON BRANCHES, deliberately.
          It previously lived inside the unpublished-candidate branch, so a
          PUBLISHED candidate whose source data had changed showed only
          "Published" and "Unpublish" and the operator never learned that the
          member-visible aggregate no longer matched its source.
        */}
        {candidate && drift && (
          <div
            className="text-[10px] font-semibold text-amber-700 dark:text-amber-400"
            title="The persisted candidate snapshot no longer matches live source data. Refresh the candidate before publishing."
          >
            (Drifted)
          </div>
        )}
        {candidate && driftUnknown && (
          // Explicitly distinct from "no drift". The comparison could not be
          // performed -- no live aggregate, or a response from an older RPC --
          // so the operator must not read the absence of a drift badge as a
          // confirmed match.
          <div
            className="text-[10px] font-semibold text-amber-700 dark:text-amber-400"
            title="Drift could not be determined: no live aggregate, or the server returned no recognisable drift state. Publish is disabled because unknown is not safe."
          >
            Drift unknown
          </div>
        )}

        {candidate && !candidate.is_published && (
          <>
            <button
              // FAIL CLOSED: publishing makes the snapshot member-visible, so it
              // is permitted ONLY on a confirmed server-side `match`. `drift`
              // and `unknown` both block it -- unknown is not safe, it is
              // unproven. The handler is gated too, not just the attribute.
              onClick={publishBlocked ? undefined : () => openModal('publish')}
              className="text-xs rounded bg-green-600 px-2 py-1 text-white hover:bg-green-700 disabled:opacity-50"
              disabled={publishBlocked || loading}
              title={
                driftState === 'match'
                  ? undefined
                  : 'Publish is disabled because the candidate snapshot is not a confirmed match with live source data. Refresh the candidate first.'
              }
            >
              Publish
            </button>
            <button
              // Refresh stays available under drift -- it is the remedy.
              onClick={disabled ? undefined : () => openModal('refresh')}
              className="text-xs rounded bg-slate-600 px-2 py-1 text-white hover:bg-slate-700 disabled:opacity-50"
              disabled={disabled || loading}
            >
              Refresh Candidate
            </button>
          </>
        )}
        {candidate && candidate.is_published && (
          <button
            // Unpublish is the visibility-REDUCING safety action and stays
            // available in EVERY state -- under drift, under unknown, AND when
            // the preview evidence is incomplete.
            //
            // It is deliberately EXEMPT from `disabled`. That flag exists to
            // stop an operator INCREASING visibility from an unreliable view;
            // applying it here disabled the only retraction path precisely when
            // a persistent load failure could otherwise leave stale
            // member-visible data unretractable. Unpublish needs nothing from
            // the preview: the publication id comes from the candidate row and
            // the server revalidates it. `loading` and `nonRetryable` still
            // gate it, so it cannot be double-submitted.
            onClick={nonRetryable ? undefined : () => openModal('unpublish')}
            className="text-xs rounded bg-rose-600 px-2 py-1 text-white hover:bg-rose-700 disabled:opacity-50"
            disabled={loading || nonRetryable}
          >
            Unpublish
          </button>
        )}
        {candidate && (
          <div className="text-[10px] text-slate-500">
            {candidate.is_published ? 'Published' : 'Unpublished'}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          {/* A REAL form, not a div with a click handler. Submission is the
              semantic event for this dialog: it makes Enter-to-submit work, it
              gives assistive technology the right role, and it means the guards
              below sit on the actual production submit path rather than on one
              button's onClick. */}
          <form
            aria-label="Site aggregate candidate action"
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 capitalize">
              {actionType} Candidate
            </h3>

            {actionType === 'publish' && candidate?.member_display_label ? (
              // APPROVAL SURFACE. Publish does not send a label -- the database
              // serves the stored one verbatim -- so the operator must see that
              // exact string here, immediately before approving. It is rendered
              // read-only precisely so this confirmation cannot edit, recompute
              // or substitute what will be published.
              <div className="mb-4">
                <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                  Member-visible label to be published
                </label>
                <div
                  data-testid="publish-member-label"
                  className="rounded border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  {candidate.member_display_label}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  This is the exact stored value members will be served. Publishing
                  does not change it.
                </p>
              </div>
            ) : null}

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
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                // type="submit" so the form's onSubmit is the ONE path a
                // submission takes. The disabled attribute still stops the
                // ordinary click, but it is only a hint -- the guard that
                // actually prevents a duplicate write lives in handleSubmit.
                type="submit"
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 capitalize"
                disabled={loading || nonRetryable}
              >
                {loading ? 'Processing...' : nonRetryable ? 'Reload required' : actionType}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
