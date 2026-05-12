"use client";

// engine_v2 frontend Lane 1 (post-Lane-1 polish): FileList with delete.
//
// Originally pure presentational; extended with optional per-row delete
// button when the parent supplies onDelete. DELETE call is soft (sets
// v2_submission_files.deleted_at server-side); storage object lifecycle
// is owned by the Lane 2 janitor.

import { useState } from "react";
import type { V2SubmissionFile } from "@/lib/engine-v2/types";

interface FileListProps {
  files: V2SubmissionFile[];
  /**
   * Optional. When provided, renders a per-row Delete button that POSTs
   * DELETE /api/engine-v2/files/<id> and awaits the parent's callback
   * to refresh state. Omit to render read-only.
   */
  onDelete?: (fileId: string) => Promise<void>;
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function formatUploadedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Lock the locale to en-US so server-rendered and client-rendered strings
  // match. Without an explicit locale, Node defaults to en-US (`AM`) while
  // Chrome on en-CA renders `a.m.` -> hydration mismatch.
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortSha(sha: string): string {
  if (!sha) return "";
  return sha.slice(0, 8);
}

export function FileList({ files, onDelete }: FileListProps): React.ReactElement {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(fileId: string, filename: string) {
    if (!onDelete) return;
    if (!confirm(`Delete "${filename}"? This cannot be undone from the UI.`)) return;
    setError(null);
    setDeletingId(fileId);
    try {
      await onDelete(fileId);
    } catch (err) {
      setError((err as Error).message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  if (files.length === 0) {
    return (
      <div
        data-testid="file-list-empty"
        className="text-sm text-slate-500 dark:text-slate-400 italic"
      >
        No files uploaded yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <div
          role="alert"
          className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg px-3 py-2"
        >
          {error}
        </div>
      ) : null}
      <div
        data-testid="file-list"
        className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
      >
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Filename</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Size</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Type</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Uploaded</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">SHA-256</th>
              {onDelete ? (
                <th scope="col" className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {files.map((f) => (
              <tr
                key={f.id}
                data-testid="file-list-row"
                data-file-id={f.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td className="px-4 py-2 text-sm text-slate-900 dark:text-white max-w-xs truncate">
                  {f.original_filename}
                </td>
                <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {formatBytes(f.size_bytes)}
                </td>
                <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {f.mime_type}
                </td>
                <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {formatUploadedAt(f.uploaded_at)}
                </td>
                <td className="px-4 py-2 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {shortSha(f.sha256)}
                </td>
                {onDelete ? (
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleDelete(f.id, f.original_filename)}
                      disabled={deletingId === f.id}
                      data-testid="file-list-delete"
                      className="text-xs font-medium text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {deletingId === f.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FileList;
