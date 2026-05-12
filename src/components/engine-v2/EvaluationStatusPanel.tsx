"use client";

// engine_v2 frontend Lane 2a / Module L2a-4: EvaluationStatusPanel client component.
//
// Renders the latest v2_evaluations row state and polls
// POST /api/engine-v2/projects/<projectId>/evaluation-status with
// {evaluation_id} body at 3s intervals while the status is non-terminal.
// Stops polling once a terminal status is observed
// (TERMINAL_EVALUATION_STATUSES).
//
// Single-flight polling (inFlightRef) + useRef-pinned interval handle prevents
// overlapping polls (NON-DROPPABLE per codex amendments). All date formatting
// is locale-locked to "en-US" to avoid SSR/client hydration mismatch
// (NON-DROPPABLE per codex amendments).

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  EvaluationStatus,
  V2Evaluation,
} from "@/lib/engine-v2/types_lane2";
import { TERMINAL_EVALUATION_STATUSES } from "@/lib/engine-v2/types_lane2";

interface EvaluationStatusPanelProps {
  projectId: string;
  evaluation: V2Evaluation | null;
  onPoll?: (updated: V2Evaluation) => void;
}

const POLL_INTERVAL_MS = 3000;

function isTerminalStatus(status: EvaluationStatus): boolean {
  return (TERMINAL_EVALUATION_STATUSES as readonly string[]).includes(status);
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

function statusBadgeClass(status: EvaluationStatus): string {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
    case "completed_with_errors":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    case "error":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
    case "running":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
    case "pending":
    default:
      return "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
  }
}

function readCoverageNumber(
  coverage: Record<string, unknown>,
  key: string,
): number | null {
  const raw = coverage[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

function formatCoverageCount(value: number | null): string {
  return value === null ? "?" : String(value);
}

function errorToString(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    try {
      return JSON.stringify(e);
    } catch {
      return "[unserializable error]";
    }
  }
  return String(e);
}

export function EvaluationStatusPanel(
  props: EvaluationStatusPanelProps,
): React.ReactElement {
  const { projectId, evaluation, onPoll } = props;

  const [latest, setLatest] = useState<V2Evaluation | null>(evaluation);
  const [pollError, setPollError] = useState<string | null>(null);

  // Single-flight poll guard: ensures we never have two interval loops alive
  // and never two in-flight requests overlapping (NON-DROPPABLE).
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const onPollRef = useRef<typeof onPoll>(onPoll);
  // Keep latest onPoll without re-triggering the effect on parent re-renders.
  useEffect(() => {
    onPollRef.current = onPoll;
  }, [onPoll]);

  // Sync local state if parent swaps the evaluation (e.g., new eval started).
  useEffect(() => {
    setLatest(evaluation);
    setPollError(null);
  }, [evaluation]);

  const pollOnce = useCallback(
    async (evaluationId: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const res = await fetch(
          `/api/engine-v2/projects/${encodeURIComponent(
            projectId,
          )}/evaluation-status`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ evaluation_id: evaluationId }),
          },
        );
        if (!res.ok) {
          setPollError(`Status fetch failed (HTTP ${res.status}).`);
          return;
        }
        const body = (await res.json()) as V2Evaluation;
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

    const evaluationId = latest.id;
    // Kick off the first poll immediately so the UI doesn't wait the full
    // poll interval before surfacing progress, then continue at cadence.
    void pollOnce(evaluationId);

    const handle = setInterval(() => {
      void pollOnce(evaluationId);
    }, POLL_INTERVAL_MS);
    intervalRef.current = handle;

    return () => {
      clearInterval(handle);
      if (intervalRef.current === handle) {
        intervalRef.current = null;
      }
    };
    // We intentionally only depend on the evaluation id + terminal-ness, not
    // every mutation of `latest`, to avoid restarting the interval each poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.id, latest?.status, pollOnce]);

  if (!latest) {
    return (
      <div
        data-testid="evaluation-status-panel-empty"
        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-sm text-slate-500 dark:text-slate-400"
      >
        No evaluation started yet.
      </div>
    );
  }

  const terminal = isTerminalStatus(latest.status);
  const coverage = latest.coverage_statement ?? {};
  const evaluatedCount = readCoverageNumber(coverage, "evaluated");
  const totalCount = readCoverageNumber(coverage, "total_policies");
  const deferredCount = readCoverageNumber(coverage, "deferred");
  const errorCount = readCoverageNumber(coverage, "error");
  const showResultsLink =
    terminal &&
    (latest.status === "completed" || latest.status === "completed_with_errors");

  const errorList: string[] = Array.isArray(latest.errors)
    ? latest.errors.map(errorToString)
    : [];

  return (
    <div
      data-testid="evaluation-status-panel"
      data-status={latest.status}
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span
          data-testid="evaluation-status-badge"
          className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${statusBadgeClass(
            latest.status,
          )}`}
        >
          {latest.status}
        </span>
        <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
          eval_id {latest.id.slice(0, 8)}
        </span>
      </div>

      <div
        data-testid="evaluation-status-coverage"
        className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-xs text-slate-700 dark:text-slate-200"
      >
        Evaluated {formatCoverageCount(evaluatedCount)} of{" "}
        {formatCoverageCount(totalCount)} policies.{" "}
        {formatCoverageCount(deferredCount)} deferred.{" "}
        {formatCoverageCount(errorCount)} errored.
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Started at</dt>
          <dd className="text-slate-800 dark:text-slate-200">
            {formatTs(latest.started_at)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Completed at</dt>
          <dd className="text-slate-800 dark:text-slate-200">
            {terminal ? formatTs(latest.completed_at) : "-"}
          </dd>
        </div>
      </dl>

      {errorList.length > 0 ? (
        <div
          data-testid="evaluation-status-errors"
          className="rounded-md border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-2"
        >
          <div className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">
            Errors
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-xs text-red-700 dark:text-red-200">
            {errorList.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {showResultsLink ? (
        <div>
          <a
            data-testid="evaluation-status-results-link"
            href={`/dashboard/engine-v2/${encodeURIComponent(
              projectId,
            )}/evaluation/${encodeURIComponent(latest.id)}`}
            className="text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline"
          >
            View results
          </a>
        </div>
      ) : null}

      {pollError ? (
        <div
          data-testid="evaluation-status-poll-error"
          className="text-xs text-amber-700 dark:text-amber-300"
        >
          {pollError}
        </div>
      ) : null}
    </div>
  );
}

export default EvaluationStatusPanel;
