"use client";

// engine_v2 frontend Lane 1 / Module L1-5: ExtractionStatusPanel client component.
//
// Renders the latest v2_extraction_runs row state and polls
// POST /api/engine-v2/projects/<projectId>/extract-status (Finding 37 -- POST
// with {run_id} body, not GET) at 2s intervals while the status is non-terminal.
// Stops polling once a terminal status is observed (TERMINAL_EXTRACTION_STATUSES).
//
// The parent owns the canonical V2ExtractionRun for the project; this panel
// reports each successful poll through onPoll so the parent can update its
// store / re-enable downstream UI (e.g., ExtractTriggerButton).

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExtractionStatus, V2ExtractionRun } from "@/lib/engine-v2/types";
import { TERMINAL_EXTRACTION_STATUSES } from "@/lib/engine-v2/types";

interface ExtractionStatusPanelProps {
  projectId: string;
  run: V2ExtractionRun | null;
  onPoll?: (run: V2ExtractionRun) => void;
}

const POLL_INTERVAL_MS = 2000;

function isTerminalStatus(status: ExtractionStatus): boolean {
  return (TERMINAL_EXTRACTION_STATUSES as readonly string[]).includes(status);
}

function formatTs(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Lock locale to en-US to avoid SSR/client hydration mismatch.
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function statusBadgeClass(status: ExtractionStatus): string {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
    case "completed_with_errors":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    case "error":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
    case "extracting":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
    case "pending":
    default:
      return "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
  }
}

export function ExtractionStatusPanel(
  props: ExtractionStatusPanelProps,
): React.ReactElement {
  const { projectId, run, onPoll } = props;

  const [latest, setLatest] = useState<V2ExtractionRun | null>(run);
  const [pollError, setPollError] = useState<string | null>(null);

  // Single-flight poll guard: ensures we never have two interval loops alive.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const onPollRef = useRef<typeof onPoll>(onPoll);
  // Keep latest onPoll without re-triggering the effect on parent re-renders.
  useEffect(() => {
    onPollRef.current = onPoll;
  }, [onPoll]);

  // Sync local state if parent swaps the run (e.g., new run started).
  useEffect(() => {
    setLatest(run);
    setPollError(null);
  }, [run]);

  const pollOnce = useCallback(
    async (runId: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const res = await fetch(
          `/api/engine-v2/projects/${encodeURIComponent(projectId)}/extract-status`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ run_id: runId }),
          },
        );
        if (!res.ok) {
          setPollError(`Status fetch failed (HTTP ${res.status}).`);
          return;
        }
        const body = (await res.json()) as V2ExtractionRun;
        setLatest(body);
        setPollError(null);
        try {
          onPollRef.current?.(body);
        } catch {
          // Caller-supplied callback must not break the poll loop.
        }
      } catch (err) {
        setPollError(`Status fetch error: ${(err as Error).message}`);
      } finally {
        inFlightRef.current = false;
      }
    },
    [projectId],
  );

  useEffect(() => {
    // Tear down any previous loop before deciding whether to start a new one.
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!latest) return;
    if (isTerminalStatus(latest.status)) return;

    const runId = latest.id;
    // Kick off the first poll immediately so the UI doesn't wait 2s before
    // surfacing progress, then continue at the polling cadence.
    void pollOnce(runId);

    const handle = setInterval(() => {
      void pollOnce(runId);
    }, POLL_INTERVAL_MS);
    intervalRef.current = handle;

    return () => {
      clearInterval(handle);
      if (intervalRef.current === handle) {
        intervalRef.current = null;
      }
    };
    // We intentionally only depend on the run id + terminal-ness, not every
    // mutation of `latest`, to avoid restarting the interval each poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.id, latest?.status, pollOnce]);

  if (!latest) {
    return (
      <div
        data-testid="extraction-status-panel-empty"
        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-sm text-slate-500 dark:text-slate-400"
      >
        No extraction started yet.
      </div>
    );
  }

  const progressPct = Math.max(0, Math.min(100, Math.round(latest.progress || 0)));
  const terminal = isTerminalStatus(latest.status);
  // Indeterminate progress: while extracting but progress hasn't crossed the
  // 5% heartbeat threshold, show an animated sliding bar instead of a stuck
  // 0% bar. dashboard_extract.py only updates progress after each file
  // completes (file-count-based), so single-PDF extractions sit at 0%
  // mid-flight; indeterminate is the honest signal there.
  const indeterminate = latest.status === "extracting" && progressPct < 5;

  return (
    <div
      data-testid="extraction-status-panel"
      data-status={latest.status}
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span
          data-testid="extraction-status-badge"
          className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${statusBadgeClass(
            latest.status,
          )}`}
        >
          {latest.status}
        </span>
        <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
          run_id {latest.id.slice(0, 8)}
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
          <span data-testid="extraction-status-progress-label">
            {latest.completed_files} of {latest.total_files} files
          </span>
          <span data-testid="extraction-status-progress-pct">
            {indeterminate ? "working..." : `${progressPct}%`}
          </span>
        </div>
        {indeterminate ? (
          <div
            data-testid="extraction-status-progress-bar"
            data-progress-mode="indeterminate"
            className="relative h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Extraction in progress"
          >
            <style>{`@keyframes ev2-indet { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
            <div
              className="absolute inset-y-0 left-0 h-full w-1/4 rounded-full bg-sky-500"
              style={{ animation: "ev2-indet 1.5s ease-in-out infinite" }}
            />
          </div>
        ) : (
          <div
            data-testid="extraction-status-progress-bar"
            data-progress-mode="determinate"
            className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
          >
            <div
              className="h-full bg-sky-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Current file</dt>
          <dd
            data-testid="extraction-status-current-file"
            className="text-slate-800 dark:text-slate-200 truncate"
            title={latest.current_file ?? ""}
          >
            {latest.current_file ?? "-"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Chunk progress</dt>
          <dd
            data-testid="extraction-status-chunk-progress"
            className="text-slate-800 dark:text-slate-200 truncate"
          >
            {latest.chunk_progress ?? "-"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Updated at</dt>
          <dd className="text-slate-800 dark:text-slate-200">
            {formatTs(latest.updated_at)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Completed at</dt>
          <dd className="text-slate-800 dark:text-slate-200">
            {terminal ? formatTs(latest.completed_at) : "-"}
          </dd>
        </div>
      </dl>

      {latest.errors && latest.errors.length > 0 ? (
        <div
          data-testid="extraction-status-errors"
          className="rounded-md border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-2"
        >
          <div className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">
            Errors
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-xs text-red-700 dark:text-red-200">
            {latest.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {pollError ? (
        <div
          data-testid="extraction-status-poll-error"
          className="text-xs text-amber-700 dark:text-amber-300"
        >
          {pollError}
        </div>
      ) : null}
    </div>
  );
}

export default ExtractionStatusPanel;
