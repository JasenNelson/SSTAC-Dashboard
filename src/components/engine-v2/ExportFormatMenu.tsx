"use client";

// engine_v2 frontend Lane 2d / Module L2d-3: ExportFormatMenu.
//
// Dropdown sibling of ExportMemoButton. Offers three ad-hoc export formats:
// CSV, Markdown, HTML. docx remains the province of ExportMemoButton
// (Lane 2b) -- this menu does NOT offer docx.
//
// Each item POSTs to /api/engine-v2/projects/<id>/evaluation/<evalId>/export
// with ?format=<csv|md|html>, then converts the response body to a blob and
// triggers a browser download via a hidden anchor (same pattern as
// ExportMemoButton).
//
// Disabled when the evaluation is not terminal -- exports against an
// in-flight run would be misleading.

import { useCallback, useRef, useState } from "react";

import {
  TERMINAL_EVALUATION_STATUSES,
  type EvaluationStatus,
} from "@/lib/engine-v2/types_lane2";

interface ExportFormatMenuProps {
  projectId: string;
  evaluationId: string;
  evaluationStatus: EvaluationStatus;
}

type MenuFormat = "csv" | "md" | "html";

interface FormatDescriptor {
  format: MenuFormat;
  label: string;
}

const FORMATS: readonly FormatDescriptor[] = [
  { format: "csv", label: "Export CSV" },
  { format: "md", label: "Export Markdown" },
  { format: "html", label: "Export HTML" },
] as const;

type MenuState =
  | { kind: "idle" }
  | { kind: "downloading"; format: MenuFormat }
  | { kind: "downloaded"; format: MenuFormat }
  | { kind: "error"; format: MenuFormat; message: string };

function isTerminalStatus(status: EvaluationStatus): boolean {
  return (TERMINAL_EVALUATION_STATUSES as readonly string[]).includes(status);
}

function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  // Naive parse of `attachment; filename="..."`. The route always emits an
  // ASCII filename so we do not need RFC 5987 handling here.
  const m = /filename="([^"]+)"/i.exec(header);
  return m ? m[1] : null;
}

export function ExportFormatMenu(
  props: ExportFormatMenuProps,
): React.ReactElement {
  const { projectId, evaluationId, evaluationStatus } = props;
  const [state, setState] = useState<MenuState>({ kind: "idle" });
  const [open, setOpen] = useState<boolean>(false);
  const anchorRef = useRef<HTMLAnchorElement | null>(null);

  const terminal = isTerminalStatus(evaluationStatus);

  const handleExport = useCallback(
    async (format: MenuFormat) => {
      if (!terminal) return;
      setOpen(false);
      setState({ kind: "downloading", format });
      try {
        const url = `/api/engine-v2/projects/${encodeURIComponent(projectId)}/evaluation/${encodeURIComponent(evaluationId)}/export?format=${encodeURIComponent(format)}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          credentials: "same-origin",
        });
        if (!resp.ok) {
          let detail = `HTTP ${resp.status}`;
          try {
            const errBody = (await resp.json()) as {
              error?: string;
              detail?: string;
            };
            if (errBody?.error) detail = errBody.error;
            if (errBody?.detail) detail = `${detail}: ${errBody.detail}`;
          } catch {
            // Non-JSON error body; keep status-only message.
          }
          setState({ kind: "error", format, message: detail });
          return;
        }
        const fallbackName = `evaluation-${evaluationId.slice(0, 8)}.${format}`;
        const filename =
          parseFilenameFromDisposition(
            resp.headers.get("Content-Disposition"),
          ) ?? fallbackName;
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = anchorRef.current;
        if (a) {
          a.href = blobUrl;
          a.download = filename;
          a.click();
        } else {
          window.open(blobUrl, "_blank", "noopener,noreferrer");
        }
        // Defer revoke until after the click handler has executed.
        setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
        setState({ kind: "downloaded", format });
      } catch (err) {
        setState({
          kind: "error",
          format,
          message: (err as Error).message || "network_error",
        });
      }
    },
    [projectId, evaluationId, terminal],
  );

  if (!terminal) {
    return (
      <div
        data-testid="export-format-menu-wrapper"
        className="inline-flex flex-col gap-1"
      >
        <button
          type="button"
          disabled
          data-testid="export-format-menu-button"
          className="inline-flex items-center rounded-md border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-400 dark:text-slate-500 cursor-not-allowed"
        >
          Export (CSV / MD / HTML)
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Export available after evaluation completes.
        </p>
      </div>
    );
  }

  const busy = state.kind === "downloading";

  return (
    <div
      data-testid="export-format-menu-wrapper"
      className="inline-flex flex-col gap-1 relative"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        data-testid="export-format-menu-button"
        data-state={state.kind}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy
          ? `Exporting ${state.format.toUpperCase()}...`
          : "Export (CSV / MD / HTML)"}
      </button>
      {open ? (
        <ul
          role="menu"
          data-testid="export-format-menu-list"
          className="absolute left-0 top-full z-10 mt-1 w-48 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 shadow-md"
        >
          {FORMATS.map((f) => (
            <li key={f.format} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => handleExport(f.format)}
                data-testid={`export-format-menu-item-${f.format}`}
                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {f.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {state.kind === "error" ? (
        <p
          data-testid="export-format-menu-error"
          className="text-xs text-red-700 dark:text-red-300"
        >
          Export failed: {state.message}
        </p>
      ) : null}
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
