'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';

export interface DraRow {
  id: string;
  title: string;
  agency: string | null;
  year: number | null;
  public: boolean;
  site_id?: string | null;
  site_name?: string | null;
  site_registry_id?: string | null;
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
}

function fmtAuditTs(ts: string): string {
  try {
    return new Date(ts).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  } catch {
    return ts;
  }
}

type DraGroup = {
  key: string;
  label: string;
  secondary: string | null;
  publicCount: number;
  privateCount: number;
  rows: DraRow[];
};

function compact(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function buildSiteLabel(row: DraRow): string {
  const siteId = compact(row.site_id);
  const siteName = compact(row.site_name);

  if (siteId && siteName) return `Site ${siteId} - ${siteName}`;
  if (siteName) return siteName;
  if (siteId) return `Site ${siteId}`;
  return 'Site not assigned';
}

function buildSiteSecondary(row: DraRow): string | null {
  const registryId = compact(row.site_registry_id);
  if (!registryId) return null;
  return `Registry ${registryId}`;
}

function siteSortValue(row: DraRow): number {
  const siteIdStr = compact(row.site_id);
  if (siteIdStr === '') return Number.MAX_SAFE_INTEGER;
  const siteId = Number(siteIdStr);
  return Number.isFinite(siteId) ? siteId : Number.MAX_SAFE_INTEGER;
}

function compareRows(a: DraRow, b: DraRow): number {
  const yearCompare = (b.year ?? -1) - (a.year ?? -1);
  if (yearCompare !== 0) return yearCompare;
  return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
}

function groupDrasBySite(rows: DraRow[]): DraGroup[] {
  const groups = new Map<string, DraGroup>();

  for (const row of rows) {
    const idVal = compact(row.site_id);
    const nameVal = compact(row.site_name);
    const key = idVal ? `id:${idVal}` : nameVal ? `name:${nameVal}` : 'unassigned';
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
      if (row.public) existing.publicCount += 1;
      else existing.privateCount += 1;
      continue;
    }

    groups.set(key, {
      key,
      label: buildSiteLabel(row),
      secondary: buildSiteSecondary(row),
      publicCount: row.public ? 1 : 0,
      privateCount: row.public ? 0 : 1,
      rows: [row],
    });
  }

  return Array.from(groups.values()).sort((a, b) => {
    const aSort = siteSortValue(a.rows[0]);
    const bSort = siteSortValue(b.rows[0]);
    if (aSort !== bSort) return aSort - bSort;
    return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
  }).map((group) => ({
    ...group,
    rows: [...group.rows].sort(compareRows),
  }));
}

function matchesDraFilter(row: DraRow, query: string): boolean {
  if (!query) return true;
  const haystack = [
    row.title,
    row.agency,
    row.year,
    row.site_id,
    row.site_name,
    row.site_registry_id,
    buildSiteLabel(row), // Match "Site N" labels since names degrade to "Site <id>" without a registry entry
  ].map(compact).join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function DraPublishControl({ initialDras, isAdmin }: DraPublishControlProps) {
  const [dras, setDras] = useState<DraRow[]>(initialDras);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Audit-history state. Codex P2 fix (2026-07-11): fetched PER-DRA,
  // server-side, on selection change -- rather than filtered client-side
  // out of a globally-bounded (top-200) list, which could silently omit a
  // selected DRA's history once the table grew past that bound and this
  // DRA's latest change fell outside the global newest-200 window
  // (a false-negative "no history" result). See
  // src/app/api/matrix-map/admin/audit-history/route.ts.
  const [auditRows, setAuditRows] = useState<DraAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  // Monotonic request counter so a stale in-flight fetch (superseded by a
  // newer selection or an explicit post-publish refresh) never clobbers
  // fresher state when it resolves out of order.
  const auditRequestIdRef = useRef(0);
  // Codex P2 fix (2026-07-11, round 3): a request-id recency guard alone is
  // not enough -- if an admin submits publish/unpublish for DRA A, then
  // switches the selection to DRA B before that POST resolves, the
  // post-success refetch for DRA A becomes the numerically "latest"
  // request and would render DRA A's rows under DRA B's now-selected
  // panel. Track the currently-selected id in a ref and additionally
  // require the resolved fetch's draId to still match it.
  const selectedRowIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRowIdRef.current = selectedRowId;
  }, [selectedRowId]);

  const loadAuditHistory = useCallback(async (draId: string) => {
    // Codex P2 fix (2026-07-11, round 4): a round-3 refetch for a DRA that
    // is no longer selected (e.g. a post-publish refresh for DRA A after
    // the admin has since selected DRA B) correctly discarded its RESULT,
    // but still unconditionally flipped auditLoading -> true up front,
    // which could flicker DRA B's already-correct panel into a loading
    // state -- or leave it stuck loading if that stale DRA-A fetch hangs.
    // Bail out before touching any UI state at all if draId is not the
    // current selection at call time.
    if (selectedRowIdRef.current !== draId) return;

    const requestId = ++auditRequestIdRef.current;
    setAuditLoading(true);
    setAuditError(null);

    const stillCurrent = () =>
      auditRequestIdRef.current === requestId && selectedRowIdRef.current === draId;

    try {
      const response = await fetch(
        `/api/matrix-map/admin/audit-history?dra_id=${encodeURIComponent(draId)}`,
      );
      const data = await response.json();
      if (!stillCurrent()) return; // superseded, or draId no longer selected
      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Failed to load visibility history');
      }
      setAuditRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (err: unknown) {
      if (!stillCurrent()) return; // superseded, or draId no longer selected
      const msg = err instanceof Error ? err.message : String(err);
      setAuditError(msg);
      setAuditRows([]);
    } finally {
      if (stillCurrent()) setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedRowId) {
      auditRequestIdRef.current += 1; // invalidate any in-flight request
      setAuditRows([]);
      setAuditError(null);
      setAuditLoading(false);
      return;
    }
    loadAuditHistory(selectedRowId);
  }, [selectedRowId, loadAuditHistory]);

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
  const normalizedFilter = filterText.trim();
  const filteredDras = useMemo(
    () => dras.filter((row) => matchesDraFilter(row, normalizedFilter)),
    [dras, normalizedFilter],
  );
  const draGroups = useMemo(() => groupDrasBySite(filteredDras), [filteredDras]);

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

      // Codex P2 fix (2026-07-11, round 2): the POST just wrote a new
      // dra_visibility_audit row for this DRA. Refetch its history now so
      // the "Recent visibility changes" panel reflects it immediately,
      // rather than staying stale (or stuck on the empty state) until the
      // row is reselected or the page is reloaded.
      loadAuditHistory(selectedRow.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ kind: 'err', text: msg });
    } finally {
      setActionSubmitting(false);
    }
  }, [actionMode, actionReason, selectedRow, loadAuditHistory]);

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

        <div className="mb-4 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" htmlFor="dra-publish-filter">
            Filter by site or report
          </label>
          <input
            id="dra-publish-filter"
            type="search"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Site, registry, report title, agency, or year"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 dark:focus:ring-sky-900"
          />
          <div className="text-xs text-slate-500 dark:text-slate-400" role="status">
            {filteredDras.length} of {dras.length} reports across {draGroups.length} site clusters
          </div>
        </div>

        {dras.length === 0 && (
          <div
            className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
            role="status"
          >
            No DRAs found.
          </div>
        )}

        {dras.length > 0 && filteredDras.length === 0 && (
          <div
            className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
            role="status"
          >
            No DRAs match the current filter.
          </div>
        )}

        {draGroups.length > 0 && (
          <ol
            className="flex flex-col gap-3"
            aria-label="DRA site clusters"
          >
            {draGroups.map((group) => {
              const reportLabel = group.rows.length === 1 ? 'report' : 'reports';
              const defaultOpen = normalizedFilter.length > 0 ||
                group.rows.some((row) => row.id === selectedRowId) ||
                draGroups.length <= 12;
              const isOpen = openGroups[group.key] ?? defaultOpen;

              return (
                <li key={`${group.key}-${normalizedFilter ? 'filtered' : 'all'}`}>
                  <details
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/40"
                    open={isOpen}
                    onToggle={(e) => {
                      const newOpen = (e.currentTarget as HTMLDetailsElement).open;
                      if (openGroups[group.key] !== newOpen) {
                        setOpenGroups((prev) => ({ ...prev, [group.key]: newOpen }));
                      }
                    }}
                  >
                    <summary className="cursor-pointer list-none rounded-md px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {group.label}
                          </h3>
                          {group.secondary && (
                            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              {group.secondary}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
                          <span className="rounded bg-white px-2 py-0.5 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
                            {group.rows.length} {reportLabel}
                          </span>
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900">
                            {group.publicCount} public
                          </span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                            {group.privateCount} private
                          </span>
                        </div>
                      </div>
                    </summary>

                    <ol
                      className="mt-2 flex flex-col gap-1.5"
                      aria-label={`${group.label} reports`}
                    >
                      {group.rows.map((row) => {
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
                                  : 'border-transparent bg-white hover:border-sky-300 hover:bg-slate-50 dark:bg-slate-900/70 dark:hover:border-sky-700 dark:hover:bg-slate-800')
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
                              <div className="flex items-start justify-between gap-3">
                                <span className="font-semibold text-slate-800 dark:text-slate-100">
                                  {row.title}
                                </span>
                                <span
                                  className={
                                    'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-mono ' +
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
                  </details>
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
            {(selectedRow.site_id || selectedRow.site_name || selectedRow.site_registry_id) && (
              <div>
                <div className="font-bold uppercase text-slate-500 dark:text-slate-400">
                  Site
                </div>
                <div className="text-slate-700 dark:text-slate-200">
                  {buildSiteLabel(selectedRow)}
                </div>
                {selectedRow.site_registry_id && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Registry {selectedRow.site_registry_id}
                  </div>
                )}
              </div>
            )}
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
                if (auditLoading) {
                  return (
                    <div
                      className="text-[11px] text-slate-500 dark:text-slate-400"
                      role="status"
                      data-testid="dra-audit-history-loading"
                    >
                      Loading visibility history...
                    </div>
                  );
                }
                if (auditError) {
                  // Fail-closed: never present a fetch failure as a
                  // definitive "no history" -- that is the exact
                  // false-negative shape codex flagged (P2, 2026-07-11).
                  return (
                    <div
                      className="text-[11px] text-red-600 dark:text-red-400"
                      role="alert"
                      data-testid="dra-audit-history-error"
                    >
                      Unable to load visibility history for this DRA: {auditError}
                    </div>
                  );
                }
                const rowHistory = auditRows.slice(0, 5);
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
