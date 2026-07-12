'use client';

import { useCallback, useState } from 'react';
import { ChevronRight } from 'lucide-react';

export interface DraRow {
  id: string;
  title: string;
  agency: string | null;
  year: number | null;
  public: boolean;
}

export interface DraAuditRow {
  id: string;
  dra_id: string;
  prior_value: boolean;
  new_value: boolean;
  changed_at: string;
  changed_by_email: string;
  reason: string;
}

export interface DraPublishControlProps {
  initialDras: DraRow[];
  isAdmin: boolean;
  // Read-only history of flip_dra_public visibility changes across all
  // DRAs (bounded by the caller; see publish/page.tsx). Optional so
  // existing callers/tests that do not pass it keep working -- absence
  // renders no audit-history panel rather than throwing.
  auditHistory?: DraAuditRow[];
}

function fmtAuditTs(ts: string): string {
  try {
    return new Date(ts).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  } catch {
    return ts;
  }
}

export function DraPublishControl({ initialDras, isAdmin, auditHistory = [] }: DraPublishControlProps) {
  const [dras, setDras] = useState<DraRow[]>(initialDras);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Action state
  const [actionMode, setActionMode] = useState<'publish' | 'unpublish' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<
    | { kind: 'ok'; text: string }
    | { kind: 'err'; text: string }
    | null
  >(null);

  const selectedRow = dras.find((r) => r.id === selectedRowId) ?? null;

  const handleStartAction = useCallback((mode: 'publish' | 'unpublish') => {
    setActionMode(mode);
    setActionReason('');
    setActionMessage(null);
  }, []);

  const handleCancelAction = useCallback(() => {
    setActionMode(null);
    setActionReason('');
  }, []);

  const handleSubmitAction = useCallback(async () => {
    if (!selectedRow || !actionMode) return;
    const nextValue = actionMode === 'publish';
    const reason = actionReason.trim();
    if (!reason) return;

    setActionSubmitting(true);
    setActionMessage(null);

    try {
      const response = await fetch('/api/matrix-map/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dra_id: selectedRow.id,
          public: nextValue,
          reason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Failed to update publication status');
      }

      setDras((current) =>
        current.map((dra) =>
          dra.id === selectedRow.id ? { ...dra, public: nextValue } : dra
        )
      );

      setActionMessage({
        kind: 'ok',
        text: `Successfully ${actionMode === 'publish' ? 'published' : 'unpublished'} DRA.`,
      });
      setActionMode(null);
      setActionReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ kind: 'err', text: msg });
    } finally {
      setActionSubmitting(false);
    }
  }, [actionMode, actionReason, selectedRow]);

  return (
    <div
      className="flex h-full w-full flex-col gap-4 md:flex-row"
      data-testid="dra-publish-control"
      aria-label="DRA publish control panel"
    >
      {/* Main panel: list */}
      <section
        className="flex-1 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        aria-label="DRA list"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Data Request Applications
          </h2>
        </div>

        {dras.length === 0 && (
          <div
            className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
            role="status"
          >
            No DRAs found.
          </div>
        )}

        {dras.length > 0 && (
          <ol
            className="flex flex-col gap-1.5"
            aria-label="DRAs"
          >
            {dras.map((row) => {
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
                    aria-label={`Select DRA ${row.title}`}
                    className={
                      'group relative flex w-full cursor-pointer flex-col gap-1 rounded-md border px-3 py-2 pr-8 text-left text-xs transition-colors ' +
                      (isSelected
                        ? 'border-sky-400 bg-sky-50 ring-1 ring-sky-200 dark:border-sky-600 dark:bg-sky-950/30 dark:ring-sky-800'
                        : 'border-transparent hover:border-sky-300 hover:bg-slate-50 dark:hover:border-sky-700 dark:hover:bg-slate-800')
                    }
                    data-testid={`dra-row-${row.id}`}
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
                        {row.title}
                      </span>
                      <span
                        className={
                          'rounded px-1.5 py-0.5 text-[11px] font-mono ' +
                          (row.public
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200')
                        }
                      >
                        {row.public ? 'Public' : 'Private'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {row.agency ? `${row.agency}` : 'No agency'} {row.year ? `(${row.year})` : ''}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Right panel: detail */}
      <aside
        className="w-full shrink-0 rounded-lg border border-slate-200 bg-white p-4 md:w-96 dark:border-slate-700 dark:bg-slate-900"
        aria-label="Selected DRA actions"
      >
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-3">
          Detail
        </h2>

        {!isAdmin && (
          <div className="mb-4 text-xs text-amber-700 dark:text-amber-300" role="status">
            Read-only view: admin role required to publish or unpublish DRAs.
          </div>
        )}

        {!selectedRow && (
          <div className="text-xs text-slate-500 dark:text-slate-400" role="status">
            Select a DRA from the list to manage its publication status.
          </div>
        )}

        {actionMessage && (
          <div
            className={
              'mb-3 rounded border px-3 py-2 text-xs ' +
              (actionMessage.kind === 'ok'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300')
            }
            role="status"
          >
            {actionMessage.text}
          </div>
        )}

        {selectedRow && (
          <div className="space-y-3 text-xs">
            <div>
              <div className="font-bold uppercase text-slate-500 dark:text-slate-400">
                DRA ID
              </div>
              <div className="font-mono text-[11px] break-all text-slate-700 dark:text-slate-200">
                {selectedRow.id}
              </div>
            </div>
            <div>
              <div className="font-bold uppercase text-slate-500 dark:text-slate-400">
                Title
              </div>
              <div className="text-slate-700 dark:text-slate-200">
                {selectedRow.title}
              </div>
            </div>
            <div>
              <div className="font-bold uppercase text-slate-500 dark:text-slate-400">
                Status
              </div>
              <div className="text-slate-700 dark:text-slate-200">
                {selectedRow.public ? 'Public' : 'Private'}
              </div>
            </div>

            <div>
              <div className="font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                Recent visibility changes
              </div>
              {(() => {
                const rowHistory = auditHistory
                  .filter((a) => a.dra_id === selectedRow.id)
                  .slice(0, 5);
                if (rowHistory.length === 0) {
                  return (
                    <div
                      className="text-[11px] text-slate-500 dark:text-slate-400"
                      role="status"
                      data-testid="dra-audit-history-empty"
                    >
                      No recorded visibility changes for this DRA.
                    </div>
                  );
                }
                return (
                  <ul
                    className="space-y-1.5"
                    data-testid="dra-audit-history-list"
                    aria-label="Recent visibility changes"
                  >
                    {rowHistory.map((a) => (
                      <li
                        key={a.id}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                      >
                        <div className="font-mono">
                          {fmtAuditTs(a.changed_at)} -- {String(a.prior_value)} {'->'} {String(a.new_value)}
                        </div>
                        <div>
                          {a.changed_by_email}: {a.reason}
                        </div>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>

            {isAdmin && actionMode === null && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleStartAction(selectedRow.public ? 'unpublish' : 'publish')}
                  className={
                    'rounded-md border px-3 py-1.5 text-xs font-semibold ' +
                    (selectedRow.public
                      ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300')
                  }
                >
                  {selectedRow.public ? 'Unpublish' : 'Publish'}
                </button>
              </div>
            )}

            {isAdmin && actionMode !== null && (
              <div className="rounded-md border border-sky-200 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-950/30">
                <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                  {actionMode === 'publish' ? 'Publish' : 'Unpublish'} DRA
                </p>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Reason for visibility change (required)"
                  rows={3}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  aria-label="Reason for visibility change"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSubmitAction}
                    disabled={actionSubmitting || actionReason.trim().length === 0}
                    className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 dark:bg-sky-500"
                  >
                    {actionSubmitting ? 'Submitting...' : `Confirm ${actionMode}`}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAction}
                    disabled={actionSubmitting}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
