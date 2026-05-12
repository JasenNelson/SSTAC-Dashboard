"use client";

// engine_v2 frontend Lane 2a / Module L2a-4: EvaluateTriggerButton client component.
//
// Renders the "Run evaluation" button (or an appropriately disabled variant) and
// POSTs /api/engine-v2/projects/<id>/evaluate to trigger an evaluation. Mirrors
// the Lane 1 ExtractTriggerButton pattern. Rules:
//   - Enabled only when no non-terminal evaluation exists AND a completed
//     extraction is available.
//   - Disabled "Evaluation in progress (eval_id=<short>)" when a non-terminal
//     evaluation exists.
//   - Disabled "Run extraction first" when no completed extraction.
//   - On 200 -> onTriggerStart(response.evaluation_id).
//   - On 409 -> onTriggerStart(response.evaluation_id) (switch panel to it).
//   - On 400 {error:'no_completed_extraction'} -> inline non-fatal message.
//   - On 503 (LOCAL_ENGINE_ENABLED=false) -> inline "Engine disabled" message.

import { useCallback, useState } from "react";
import type { V2Evaluation } from "@/lib/engine-v2/types_lane2";
import { TERMINAL_EVALUATION_STATUSES } from "@/lib/engine-v2/types_lane2";

interface EvaluateTriggerButtonProps {
  projectId: string;
  currentEvaluation: V2Evaluation | null;
  hasCompletedExtraction: boolean;
  onTriggerStart: (evaluationId: string) => void;
}

interface EvaluateStartResponse {
  evaluation_id: string;
  status?: string;
}

interface EvaluateErrorResponse {
  error?: string;
  message?: string;
  ollama_url?: string;
}

function isTerminal(evaluation: V2Evaluation | null): boolean {
  if (!evaluation) return true;
  return (TERMINAL_EVALUATION_STATUSES as readonly string[]).includes(
    evaluation.status,
  );
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function EvaluateTriggerButton(
  props: EvaluateTriggerButtonProps,
): React.ReactElement {
  const { projectId, currentEvaluation, hasCompletedExtraction, onTriggerStart } =
    props;

  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<{
    kind: "info" | "warn" | "error";
    text: string;
  } | null>(null);
  // Live is the only user-facing backend. Stub mode existed only as a wiring
  // placeholder during development; reviewers should always see real verdicts.
  // To force stub for a single trigger (debugging), append `?evalBackend=stub`
  // to the URL.
  const [selectedBackend] = useState<"stub" | "live">(() => {
    if (typeof window === "undefined") return "live";
    try {
      const qp = new URLSearchParams(window.location.search).get("evalBackend");
      return qp === "stub" ? "stub" : "live";
    } catch {
      return "live";
    }
  });

  const hasNonTerminalEval =
    currentEvaluation !== null && !isTerminal(currentEvaluation);
  const disabled = busy || hasNonTerminalEval || !hasCompletedExtraction;

  let label: string;
  if (hasNonTerminalEval && currentEvaluation) {
    label = `Evaluation in progress (eval_id=${shortId(currentEvaluation.id)})`;
  } else if (!hasCompletedExtraction) {
    label = "Run extraction first";
  } else if (busy) {
    label = "Starting evaluation...";
  } else {
    label = "Run evaluation";
  }

  const onClick = useCallback(async () => {
    if (disabled) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/engine-v2/projects/${encodeURIComponent(projectId)}/evaluate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evaluation_backend: selectedBackend }),
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
        const ok = body as EvaluateStartResponse | null;
        if (ok && typeof ok.evaluation_id === "string" && ok.evaluation_id.length > 0) {
          onTriggerStart(ok.evaluation_id);
          setMessage({ kind: "info", text: "Evaluation started." });
        } else {
          setMessage({
            kind: "error",
            text: "Evaluation started but server response was malformed.",
          });
        }
        return;
      }

      if (res.status === 409) {
        // Existing non-terminal evaluation; switch panel to it.
        const conflict = body as EvaluateStartResponse | null;
        if (
          conflict &&
          typeof conflict.evaluation_id === "string" &&
          conflict.evaluation_id.length > 0
        ) {
          onTriggerStart(conflict.evaluation_id);
          setMessage({
            kind: "info",
            text: `An evaluation is already in progress (eval_id=${shortId(
              conflict.evaluation_id,
            )}).`,
          });
          return;
        }
        setMessage({
          kind: "warn",
          text: "An evaluation is already in progress.",
        });
        return;
      }

      const errBody = body as EvaluateErrorResponse | null;
      const errCode = errBody?.error ?? "";

      if (res.status === 400 && errCode === "no_completed_extraction") {
        setMessage({
          kind: "warn",
          text: "Complete an extraction first.",
        });
        return;
      }

      if (res.status === 400 && errCode === "invalid_payload") {
        setMessage({
          kind: "error",
          text: errBody?.message ?? "Invalid payload.",
        });
        return;
      }

      if (res.status === 503) {
        if (errCode === "ollama_unreachable") {
          const url = errBody?.ollama_url ?? "the configured URL";
          setMessage({
            kind: "error",
            text: `Ollama not reachable at ${url}. Start it with \`ollama serve\` and pull qwen2.5:14b-instruct-q4_K_M.`,
          });
          return;
        }
        setMessage({
          kind: "warn",
          text:
            errBody?.message ??
            "Engine is disabled on this server (LOCAL_ENGINE_ENABLED=false).",
        });
        return;
      }

      const detail = errBody?.message ?? errCode ?? "";
      setMessage({
        kind: "error",
        text: detail
          ? `Trigger failed: ${detail}`
          : `Trigger failed (HTTP ${res.status}).`,
      });
    } catch (err) {
      setMessage({
        kind: "error",
        text: `Could not reach server: ${(err as Error).message}`,
      });
    } finally {
      setBusy(false);
    }
  }, [disabled, projectId, onTriggerStart, selectedBackend]);

  return (
    <div data-testid="evaluate-trigger" className="space-y-2">
      {selectedBackend === "stub" ? (
        <div
          data-testid="evaluate-backend-debug-note"
          className="text-xs text-amber-700 dark:text-amber-300"
        >
          Debug mode: stub backend (no real verdicts). Remove
          <code>?evalBackend=stub</code> from the URL to use live.
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Real evaluation against the BC contaminated sites policy KB (43
          policies). Takes 30-90 seconds with local Ollama.
        </p>
      )}
      <button
        type="button"
        data-testid="evaluate-trigger-button"
        data-disabled={disabled ? "true" : "false"}
        disabled={disabled}
        onClick={onClick}
        className={
          disabled
            ? "inline-flex items-center px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-sm font-medium cursor-not-allowed"
            : "inline-flex items-center px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors"
        }
      >
        {label}
      </button>
      {message ? (
        <div
          data-testid="evaluate-trigger-message"
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

export default EvaluateTriggerButton;
