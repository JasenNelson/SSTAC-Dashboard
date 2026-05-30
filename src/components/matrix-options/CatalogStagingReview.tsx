'use client';

/**
 * CatalogStagingReview -- HITL approval pane for catalog_extraction_staging rows.
 *
 * Architecture:
 *   - 3-column layout matching the Evidence Library Phase 0.5 split (commit 0225a53):
 *       Left panel  (w-80): filter controls + pass-id input + pending counts.
 *       Main panel  (flex): pending staging row list, sorted by confidence DESC.
 *       Right panel (w-96): detail inspector for selected row + approve/reject form
 *                            (admin / matrix_admin gated).
 *   - Forks the QA review pattern from EvidenceLibrary.tsx::QaReviewActions
 *     (commit 2112733): admin-only action buttons + confirmation form with notes
 *     textarea + collapsible review/history surface.
 *
 * Scope (Sub-task 6 deliverable):
 *   - READ-ONLY display of pending staging rows, sortable by confidence.
 *   - Filter by extraction_pass_id.
 *   - Promote / Reject buttons wired through src/lib/catalog/staging.ts helpers;
 *     visible only when isAdmin=true.
 *
 * Accessibility:
 *   - Every interactive element has aria-label or explicit text content.
 *   - Selected row exposes aria-selected on the list-item button.
 *   - Status messages use role="status" so screen readers announce them.
 *
 * Server actions injected via prop so tests can pass mocks. Default values
 * delegate to src/lib/catalog/staging.ts.
 *
 * Authored 2026-05-27 by Stream D autonomous session (Opus 4.7).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';

import {
  listPendingStagingRows as defaultListPendingStagingRows,
  approveStagingRow as defaultApproveStagingRow,
  rejectStagingRow as defaultRejectStagingRow,
  type CatalogStagingRow,
} from '@/lib/catalog/staging';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CatalogStagingReviewProps {
  /** Whether the current user has admin / matrix_admin role.
   *  When false, the approve / reject form is hidden. */
  isAdmin: boolean;
  /** Optional default extraction_pass_id to filter by. */
  initialExtractionPassId?: string;
  /** Optional override for listPendingStagingRows (tests). */
  listPendingStagingRowsFn?: typeof defaultListPendingStagingRows;
  /** Optional override for approveStagingRow (tests). */
  approveStagingRowFn?: typeof defaultApproveStagingRow;
  /** Optional override for rejectStagingRow (tests). */
  rejectStagingRowFn?: typeof defaultRejectStagingRow;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function humanizeKind(kind: CatalogStagingRow['proposed_kind']): string {
  switch (kind) {
    case 'parameter_value':
      return 'Parameter value';
    case 'evidence_item':
      return 'Evidence item';
    case 'source_lead':
      return 'Source lead';
    default:
      return String(kind);
  }
}

function formatConfidence(c: number | null): string {
  if (c === null) return '-';
  return `${Math.round(c * 100)}%`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function payloadSnippet(payload: Record<string, unknown>): string {
  const entries = Object.entries(payload).slice(0, 3);
  if (entries.length === 0) return '(empty payload)';
  return entries
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' / ');
}

// source_excerpt_fidelity (R1 contract): does the staging row's source_excerpt quote the
// source verbatim, or was it reconstructed/normalized from the source? The extraction agent
// emits this in the proposed_payload. Absent => fidelity not declared (older rows): we render
// a neutral "unspecified" badge rather than asserting verbatim, so a reviewer is never falsely
// told an excerpt is verbatim. Mirrors the regulatory-review EvidenceAccordion fidelity badge.
type SourceExcerptFidelity = 'verbatim' | 'reconstructed';

function sourceExcerptFidelity(
  payload: Record<string, unknown>,
): SourceExcerptFidelity | null {
  const raw = payload['source_excerpt_fidelity'];
  if (raw === 'verbatim' || raw === 'reconstructed') return raw;
  return null;
}

function fidelityLabel(fidelity: SourceExcerptFidelity | null): string {
  if (fidelity === 'verbatim') return 'Verbatim excerpt';
  if (fidelity === 'reconstructed') return 'Reconstructed excerpt';
  return 'Fidelity unspecified';
}

function fidelityBadgeClass(fidelity: SourceExcerptFidelity | null): string {
  if (fidelity === 'verbatim') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
  }
  if (fidelity === 'reconstructed') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  }
  return 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CatalogStagingReview(props: CatalogStagingReviewProps) {
  const {
    isAdmin,
    initialExtractionPassId,
    listPendingStagingRowsFn = defaultListPendingStagingRows,
    approveStagingRowFn = defaultApproveStagingRow,
    rejectStagingRowFn = defaultRejectStagingRow,
  } = props;

  // Filter state
  const [passIdInput, setPassIdInput] = useState(initialExtractionPassId ?? '');
  const [appliedPassId, setAppliedPassId] = useState(initialExtractionPassId ?? '');

  // Data state
  const [rows, setRows] = useState<CatalogStagingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  // Selection state
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Action state (admin only)
  const [actionMode, setActionMode] = useState<'approve' | 'reject' | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<
    | { kind: 'ok'; text: string }
    | { kind: 'err'; text: string }
    | null
  >(null);

  // Load rows on mount, refreshToken bump, or appliedPassId change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const args = appliedPassId ? { extractionPassId: appliedPassId } : {};
    listPendingStagingRowsFn(args).then(
      (result) => {
        if (cancelled) return;
        setRows(result);
        setLoading(false);
        // Clear selection if the previously-selected row is gone after refresh.
        // Use the functional setState form so we read the CURRENT selectedRowId
        // rather than the value closed over when the effect was scheduled.
        setSelectedRowId((current) =>
          current && !result.some((r) => r.id === current) ? null : current,
        );
      },
      (err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(msg);
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [appliedPassId, refreshToken, listPendingStagingRowsFn]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedRowId) ?? null,
    [rows, selectedRowId],
  );

  const handleApplyFilter = useCallback(() => {
    setAppliedPassId(passIdInput.trim());
    setActionMessage(null);
  }, [passIdInput]);

  const handleClearFilter = useCallback(() => {
    setPassIdInput('');
    setAppliedPassId('');
    setActionMessage(null);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  const handleStartAction = useCallback((mode: 'approve' | 'reject') => {
    setActionMode(mode);
    setActionNotes('');
    setActionMessage(null);
  }, []);

  const handleCancelAction = useCallback(() => {
    setActionMode(null);
    setActionNotes('');
  }, []);

  const handleSubmitAction = useCallback(async () => {
    if (!selectedRow || !actionMode) return;
    setActionSubmitting(true);
    setActionMessage(null);
    try {
      if (actionMode === 'approve') {
        const result = await approveStagingRowFn({
          stagingId: selectedRow.id,
          hitlNotes: actionNotes || undefined,
        });
        setActionMessage({
          kind: 'ok',
          text: `Approved staging row ${selectedRow.id}; promoted to ${result.promotedToId}.`,
        });
      } else {
        await rejectStagingRowFn({
          stagingId: selectedRow.id,
          hitlNotes: actionNotes || undefined,
        });
        setActionMessage({
          kind: 'ok',
          text: `Rejected staging row ${selectedRow.id}.`,
        });
      }
      setActionMode(null);
      setActionNotes('');
      // Refresh the list so the row drops out of pending.
      setRefreshToken((n) => n + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ kind: 'err', text: msg });
    } finally {
      setActionSubmitting(false);
    }
  }, [
    actionMode,
    actionNotes,
    approveStagingRowFn,
    rejectStagingRowFn,
    selectedRow,
  ]);

  return (
    <div
      className="flex h-full w-full flex-col gap-4 md:flex-row"
      data-testid="catalog-staging-review"
      aria-label="Catalog staging review panel"
    >
      {/* --------------------------- Left panel: filters --------------------------- */}
      <aside
        className="w-full shrink-0 rounded-lg border border-slate-200 bg-white p-4 md:w-80 dark:border-slate-700 dark:bg-slate-900"
        aria-label="Filter controls"
      >
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Filters
        </h2>
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-slate-600 dark:text-slate-300">
            Extraction pass id
            <input
              type="text"
              value={passIdInput}
              onChange={(e) => setPassIdInput(e.target.value)}
              placeholder="e.g. 9f7a2b1c-..."
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              data-testid="staging-filter-pass-id"
              aria-label="Filter by extraction pass id"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplyFilter}
              className="rounded-md bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-700 dark:bg-sky-500"
              data-testid="staging-filter-apply"
              aria-label="Apply pass id filter"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleClearFilter}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              data-testid="staging-filter-clear"
              aria-label="Clear pass id filter"
            >
              Clear
            </button>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            data-testid="staging-refresh"
            aria-label="Refresh pending list"
          >
            Refresh
          </button>
        </div>
        <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          <div>
            <span className="font-semibold">Pending rows:</span> {rows.length}
          </div>
          {appliedPassId && (
            <div className="mt-1">
              <span className="font-semibold">Pass filter:</span>{' '}
              <span className="font-mono text-[11px]">{appliedPassId}</span>
            </div>
          )}
          {!isAdmin && (
            <div className="mt-2 text-amber-700 dark:text-amber-300" role="status">
              Read-only view: admin role required to approve or reject rows.
            </div>
          )}
        </div>
      </aside>

      {/* --------------------------- Main panel: list ----------------------------- */}
      <section
        className="flex-1 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        aria-label="Pending staging rows"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Pending staging rows
          </h2>
          {loading && (
            <span className="text-xs text-slate-500" role="status">
              Loading...
            </span>
          )}
        </div>

        {loadError && (
          <div
            className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
            role="status"
            data-testid="staging-load-error"
          >
            Failed to load staging rows: {loadError}
          </div>
        )}

        {actionMessage && (
          <div
            className={
              'mt-3 rounded border px-3 py-2 text-xs ' +
              (actionMessage.kind === 'ok'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300')
            }
            role="status"
            data-testid={
              actionMessage.kind === 'ok'
                ? 'staging-action-success'
                : 'staging-action-error'
            }
          >
            {actionMessage.text}
          </div>
        )}

        {!loading && !loadError && rows.length === 0 && (
          <div
            className="mt-6 rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
            data-testid="staging-empty-state"
            role="status"
          >
            {appliedPassId
              ? `No pending rows for extraction pass ${appliedPassId}.`
              : 'No pending staging rows. The Catalog Extraction Agent has not produced new proposals, or all proposals have been actioned.'}
          </div>
        )}

        {!loading && rows.length > 0 && (
          <p
            className="mt-3 text-[11px] text-slate-500 dark:text-slate-400"
            data-testid="staging-list-hint"
          >
            Click a row to review its proposal, then approve or reject it.
          </p>
        )}

        {!loading && rows.length > 0 && (
          <ol
            className="mt-2 flex flex-col gap-1.5"
            data-testid="staging-row-list"
            aria-label="Staging rows sorted by confidence"
          >
            {rows.map((row) => {
              const isSelected = row.id === selectedRowId;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRowId(row.id);
                      setActionMode(null);
                      setActionMessage(null);
                    }}
                    aria-pressed={isSelected}
                    aria-label={`Select staging row ${row.id} (${humanizeKind(row.proposed_kind)}, confidence ${formatConfidence(row.confidence)})`}
                    className={
                      'group relative flex w-full cursor-pointer flex-col gap-1 rounded-md border px-3 py-2 pr-8 text-left text-xs transition-colors ' +
                      (isSelected
                        ? 'border-sky-400 bg-sky-50 ring-1 ring-sky-200 dark:border-sky-600 dark:bg-sky-950/30 dark:ring-sky-800'
                        : 'border-transparent hover:border-sky-300 hover:bg-slate-50 dark:hover:border-sky-700 dark:hover:bg-slate-800')
                    }
                    data-testid={`staging-row-${row.id}`}
                  >
                    <ChevronRight
                      aria-hidden="true"
                      className={
                        'absolute right-2 top-2.5 h-4 w-4 transition-colors ' +
                        (isSelected
                          ? 'text-sky-500 dark:text-sky-400'
                          : 'text-slate-300 group-hover:text-sky-400 dark:text-slate-600')
                      }
                    />
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {humanizeKind(row.proposed_kind)}
                      </span>
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-mono text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                        {formatConfidence(row.confidence)}
                      </span>
                    </div>
                    <div>
                      <span
                        className={
                          'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ' +
                          fidelityBadgeClass(
                            sourceExcerptFidelity(row.proposed_payload),
                          )
                        }
                        data-testid={`staging-fidelity-badge-${row.id}`}
                      >
                        {fidelityLabel(sourceExcerptFidelity(row.proposed_payload))}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {row.source_zotero_key}
                    </div>
                    <div className="text-slate-600 dark:text-slate-300">
                      {payloadSnippet(row.proposed_payload)}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      Extracted {formatDate(row.extracted_at)}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* --------------------------- Right panel: detail -------------------------- */}
      <aside
        className="w-full shrink-0 rounded-lg border border-slate-200 bg-white p-4 md:w-96 dark:border-slate-700 dark:bg-slate-900"
        aria-label="Selected staging row detail and actions"
      >
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Detail
        </h2>

        {!selectedRow && (
          <div
            className="mt-3 text-xs text-slate-500 dark:text-slate-400"
            role="status"
            data-testid="staging-detail-empty"
          >
            Select a row from the list to see its full payload and reviewer actions.
          </div>
        )}

        {selectedRow && (
          <div className="mt-3 space-y-3 text-xs" data-testid="staging-detail">
            <div>
              <div className="font-bold uppercase text-slate-500 dark:text-slate-400">
                Staging id
              </div>
              <div className="font-mono text-[11px] break-all text-slate-700 dark:text-slate-200">
                {selectedRow.id}
              </div>
            </div>
            <div>
              <div className="font-bold uppercase text-slate-500 dark:text-slate-400">
                Kind / model / confidence
              </div>
              <div className="text-slate-700 dark:text-slate-200">
                {humanizeKind(selectedRow.proposed_kind)}
                {' / '}
                <span className="font-mono">{selectedRow.extraction_model ?? '-'}</span>
                {' / '}
                {formatConfidence(selectedRow.confidence)}
              </div>
            </div>
            <div>
              <div className="font-bold uppercase text-slate-500 dark:text-slate-400">
                Source
              </div>
              <div className="font-mono text-[11px] break-all text-slate-700 dark:text-slate-200">
                {selectedRow.source_zotero_key}
                {selectedRow.source_attachment_path && (
                  <>
                    {' / '}
                    {selectedRow.source_attachment_path}
                  </>
                )}
              </div>
            </div>
            <div>
              <div className="font-bold uppercase text-slate-500 dark:text-slate-400">
                Proposed payload
              </div>
              <pre className="mt-1 max-h-48 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                {JSON.stringify(selectedRow.proposed_payload, null, 2)}
              </pre>
            </div>
            <div>
              <div className="font-bold uppercase text-slate-500 dark:text-slate-400">
                Source excerpt fidelity
              </div>
              <span
                className={
                  'mt-1 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ' +
                  fidelityBadgeClass(
                    sourceExcerptFidelity(selectedRow.proposed_payload),
                  )
                }
                data-testid="staging-detail-fidelity-badge"
              >
                {fidelityLabel(
                  sourceExcerptFidelity(selectedRow.proposed_payload),
                )}
              </span>
            </div>
            {selectedRow.extraction_notes && (
              <div>
                <div className="font-bold uppercase text-slate-500 dark:text-slate-400">
                  Extraction notes
                </div>
                <div className="text-slate-700 dark:text-slate-200">
                  {selectedRow.extraction_notes}
                </div>
              </div>
            )}

            {/* Admin-only action surface */}
            {isAdmin && actionMode === null && (
              <div className="flex gap-2 pt-2" data-testid="staging-action-buttons">
                <button
                  type="button"
                  onClick={() => handleStartAction('approve')}
                  disabled={actionSubmitting}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                  data-testid="staging-action-approve"
                  aria-label="Approve and promote selected staging row"
                >
                  Approve and promote
                </button>
                <button
                  type="button"
                  onClick={() => handleStartAction('reject')}
                  disabled={actionSubmitting}
                  className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
                  data-testid="staging-action-reject"
                  aria-label="Reject selected staging row"
                >
                  Reject
                </button>
              </div>
            )}

            {isAdmin && actionMode !== null && (
              <div
                className="rounded-md border border-sky-200 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-950/30"
                data-testid="staging-action-form"
              >
                <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                  {actionMode === 'approve' ? 'Approve' : 'Reject'} staging row
                </p>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Reviewer notes (optional)"
                  rows={3}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  data-testid="staging-action-notes"
                  aria-label="Reviewer notes"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSubmitAction}
                    disabled={actionSubmitting}
                    className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 dark:bg-sky-500"
                    data-testid="staging-action-submit"
                    aria-label={`Confirm ${actionMode}`}
                  >
                    {actionSubmitting ? 'Submitting...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAction}
                    disabled={actionSubmitting}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    data-testid="staging-action-cancel"
                    aria-label="Cancel action"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* actionMessage is rendered in the main panel (above the list) so it
                stays visible after a successful approve/reject clears the
                selected row from the pending list. */}
          </div>
        )}
      </aside>
    </div>
  );
}

export default CatalogStagingReview;
