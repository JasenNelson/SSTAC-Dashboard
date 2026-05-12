"use client";

// engine_v2 frontend Lane 2b / Module L2b-6: ExportMemoButton.
//
// Two-step download:
//   1. POST  /api/engine-v2/projects/<id>/evaluation/<evalId>/memo
//      -> {memo_id, content_sha256, byte_size, cached}.
//   2. GET   /api/.../memo?memo_id=<id> via a hidden anchor click.
//
// Disabled when the evaluation is not terminal (memo data is incomplete
// until S4 has written all per-policy rows and judgments may still be
// arriving).

import { useCallback, useRef, useState } from "react";

import {
  TERMINAL_EVALUATION_STATUSES,
  type EvaluationStatus,
} from "@/lib/engine-v2/types_lane2";

interface ExportMemoButtonProps {
  projectId: string;
  evaluationId: string;
  evaluationStatus: EvaluationStatus;
}

interface MemoTriggerResponse {
  memo_id: string;
  content_sha256: string;
  byte_size: number;
  cached: boolean;
}

interface MemoErrorResponse {
  error?: string;
  detail?: string;
}

type ButtonState =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "downloaded"; memoId: string; cached: boolean }
  | { kind: "error"; message: string };

function isTerminalStatus(status: EvaluationStatus): boolean {
  return (TERMINAL_EVALUATION_STATUSES as readonly string[]).includes(status);
}

export function ExportMemoButton(
  props: ExportMemoButtonProps,
): React.ReactElement {
  const { projectId, evaluationId, evaluationStatus } = props;
  const [state, setState] = useState<ButtonState>({ kind: "idle" });
  const anchorRef = useRef<HTMLAnchorElement | null>(null);

  const terminal = isTerminalStatus(evaluationStatus);

  const triggerDownload = useCallback(
    (memoId: string) => {
      const url = `/api/engine-v2/projects/${encodeURIComponent(projectId)}/evaluation/${encodeURIComponent(evaluationId)}/memo?memo_id=${encodeURIComponent(memoId)}`;
      const a = anchorRef.current;
      if (a) {
        a.href = url;
        a.click();
      } else {
        // Fallback: open in a new tab.
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    [projectId, evaluationId],
  );

  const handleClick = useCallback(async () => {
    if (!terminal) return;
    setState({ kind: "generating" });
    try {
      const resp = await fetch(
        `/api/engine-v2/projects/${encodeURIComponent(projectId)}/evaluation/${encodeURIComponent(evaluationId)}/memo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          credentials: "same-origin",
        },
      );
      if (!resp.ok) {
        let detail = `HTTP ${resp.status}`;
        try {
          const errBody = (await resp.json()) as MemoErrorResponse;
          if (errBody?.error) detail = errBody.error;
          if (errBody?.detail) detail = `${detail}: ${errBody.detail}`;
        } catch {
          // Non-JSON error body; keep status-only message.
        }
        setState({ kind: "error", message: detail });
        return;
      }
      const body = (await resp.json()) as MemoTriggerResponse;
      if (!body?.memo_id) {
        setState({ kind: "error", message: "missing_memo_id_in_response" });
        return;
      }
      triggerDownload(body.memo_id);
      setState({ kind: "downloaded", memoId: body.memo_id, cached: Boolean(body.cached) });
    } catch (err) {
      setState({
        kind: "error",
        message: (err as Error).message || "network_error",
      });
    }
  }, [projectId, evaluationId, terminal, triggerDownload]);

  if (!terminal) {
    return (
      <div
        data-testid="export-memo-button-wrapper"
        className="inline-flex flex-col gap-1"
      >
        <button
          type="button"
          disabled
          data-testid="export-memo-button"
          className="inline-flex items-center rounded-md border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-400 dark:text-slate-500 cursor-not-allowed"
        >
          Export memo (.docx)
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Memo available after evaluation completes.
        </p>
      </div>
    );
  }

  const busy = state.kind === "generating";
  let label = "Export memo (.docx)";
  if (state.kind === "generating") label = "Generating...";
  else if (state.kind === "downloaded") {
    label = state.cached
      ? "Downloaded (cached)"
      : "Downloaded";
  }

  return (
    <div
      data-testid="export-memo-button-wrapper"
      className="inline-flex flex-col gap-1"
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        data-testid="export-memo-button"
        data-state={state.kind}
        className="inline-flex items-center rounded-md border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {label}
      </button>
      {state.kind === "error" ? (
        <p
          data-testid="export-memo-error"
          className="text-xs text-red-700 dark:text-red-300"
        >
          Export failed: {state.message}
        </p>
      ) : null}
      {/* Hidden anchor used to trigger the browser download for the GET endpoint. */}
      <a
        ref={anchorRef}
        href="#"
        download
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
