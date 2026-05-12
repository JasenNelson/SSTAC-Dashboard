"use client";

// engine_v2 frontend Lane 1 / Module L1-5: FileList client component.
//
// Pure presentational list of v2_submission_files for a project. Receives the
// rows from the parent; no fetches, no state. Renders a table on desktop and a
// stacked card layout on narrow viewports.

import type { V2SubmissionFile } from "@/lib/engine-v2/types";

interface FileListProps {
  files: V2SubmissionFile[];
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
  return d.toLocaleString(undefined, {
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

export function FileList({ files }: FileListProps): React.ReactElement {
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
    <div
      data-testid="file-list"
      className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
    >
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-800/60">
          <tr>
            <th
              scope="col"
              className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              Filename
            </th>
            <th
              scope="col"
              className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              Size
            </th>
            <th
              scope="col"
              className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              Type
            </th>
            <th
              scope="col"
              className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              Uploaded
            </th>
            <th
              scope="col"
              className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              SHA-256
            </th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default FileList;
