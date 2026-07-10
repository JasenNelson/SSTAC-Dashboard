"use client";

// engine_v2 frontend Lane 1 / Module L1-5: ExtractTriggerButton client component.
//
// Renders the "Run extraction" button (or an appropriately disabled variant) and
// POSTs /api/engine-v2/projects/<id>/extract to trigger a run. Implements the
// rules from plan v7.19 lines 990-998 (Findings 41, 80):
//   - Enabled only when no non-terminal run exists AND active file count >= 1.
//   - Disabled "Extraction in progress" when a non-terminal run exists.
//   - Disabled "Upload at least one file first" when zero active files.
//   - On 200 -> onTriggerStart(response.run_id).
//   - On 409 -> onTriggerStart(response.run_id) (switch panel to existing run).
//   - On 400 {error:'no_active_files'} -> inline non-fatal message.
//   - On 503 (LOCAL_ENGINE_ENABLED=false) -> inline "Engine disabled" message.

import { useCallback, useState } from "react";
import type { V2ExtractionRun } from "@/lib/engine-v2/types";
import { TERMINAL_EXTRACTION_STATUSES } from "@/lib/engine-v2/types";

interface ExtractTriggerButtonProps {
  projectId: string;
  currentRun: V2ExtractionRun | null;
  activeFileCount: number;
  onTriggerStart: (runId: string) => void;
}

interface ExtractStartResponse {
  run_id: string;
  status?: string;
}

interface ExtractErrorResponse {
  error?: string;
  message?: string;
}

function isTerminal(run: V2ExtractionRun | null): boolean {
  if (!run) return true;
  return (TERMINAL_EXTRACTION_STATUSES as readonly string[]).includes(run.status);
}

function shortRunId(runId: string): string {
  return runId.slice(0, 8);
}

export function ExtractTriggerButton(
  props: ExtractTriggerButtonProps,
): React.ReactElement {
  const { projectId, currentRun, activeFileCount, onTriggerStart } = props;

  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<{
    kind: "info" | "warn" | "error";
    text: string;
  } | null>(null);

  const hasNonTerminalRun = currentRun !== null && !isTerminal(currentRun);
  const hasNoFiles = activeFileCount === 0;
  const disabled = busy || hasNonTerminalRun || hasNoFiles;

  let label: string;
  if (hasNonTerminalRun && currentRun) {
    label = `Extraction in progress (run_id=${shortRunId(currentRun.id)})`;
  } else if (hasNoFiles) {
    label = "Upload at least one file first";
  } else if (busy) {
    label = "Starting extraction...";
  } else {
    label = "Run extraction";
  }

  const onClick = useCallback(async () => {
    if (disabled) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/engine-v2/projects/${encodeURIComponent(projectId)}/extract`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );

      // Parse body defensively.
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      if (res.ok) {
        const ok = body as ExtractStartResponse | null;
        if (ok && typeof ok.run_id === "string" && ok.run_id.length > 0) {
          onTriggerStart(ok.run_id);
          setMessage({ kind: "info", text: "Extraction started." });
        } else {
          setMessage({
            kind: "error",
            text: "Extraction started but server response was malformed.",
          });
        }
        return;
      }

      if (res.status === 409) {
        // Existing non-terminal run; switch panel to it.
        const conflict = body as ExtractStartResponse | null;
        if (conflict && typeof conflict.run_id === "string" && conflict.run_id.length > 0) {
          onTriggerStart(conflict.run_id);
          setMessage({
            kind: "info",
            text: `An extraction run is already in progress (run_id=${shortRunId(
              conflict.run_id,
            )}).`,
          });
          return;
        }
        setMessage({
          kind: "warn",
          text: "An extraction run is already in progress.",
        });
        return;
      }

      const errBody = body as ExtractErrorResponse | null;
      const errCode = errBody?.error ?? "";

      if (res.status === 400 && errCode === "no_active_files") {
        setMessage({
          kind: "warn",
          text: "Upload at least one file before triggering extraction.",
        });
        return;
      }

      if (res.status === 503) {
        setMessage({
          kind: "warn",
          text:
            errBody?.message ??
            "Engine is disabled on this server (LOCAL_ENGINE_ENABLED=false).",
        });
        return;
      }

      setMessage({
        kind: "error",
        text: errBody?.message ?? errCode ?? `Extraction failed (HTTP ${res.status}).`,
      });
    } catch (err) {
      setMessage({
        kind: "error",
        text: `Could not reach server: ${(err as Error).message}`,
      });
    } finally {
      setBusy(false);
    }
  }, [disabled, projectId, onTriggerStart]);

  return (
    <div data-testid="extract-trigger" className="space-y-2">
      <button
        type="button"
        data-testid="extract-trigger-button"
        data-disabled={disabled ? "true" : "false"}
        disabled={disabled}
        onClick={onClick}
        className={
          disabled
            ? "inline-flex items-center px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-sm font-medium cursor-not-allowed"
            : "inline-flex items-center px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 transition-colors"
        }
      >
        {label}
      </button>
      {message ? (
        <div
          data-testid="extract-trigger-message"
          data-kind={message.kind}
          className={
            message.kind === "error"
              ? "text-xs text-red-700 dark:text-red-300"
              : message.kind === "warn"
                ? "text-xs text-amber-700 dark:text-amber-300"
                : "text-xs text-slate-600 dark:text-slate-300"
          }
        >
          {message.text}
        </div>
      ) : null}
    </div>
  );
}

export default ExtractTriggerButton;
