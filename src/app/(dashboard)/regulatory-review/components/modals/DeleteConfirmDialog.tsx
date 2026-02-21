'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface DeleteConfirmDialogProps {
  project: {
    id: string;
    siteId: string;
    siteName: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

// =============================================================================
// Component
// =============================================================================

export default function DeleteConfirmDialog({
  project,
  isOpen,
  onClose,
  onDeleted,
}: DeleteConfirmDialogProps) {
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/regulatory-review/projects/${project.id}?deleteFiles=${deleteFiles}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete project');
      }

      onDeleted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete project'
      );
      setDeleting(false);
    }
  };

  const displayName = project.siteName
    ? `${project.siteId} - ${project.siteName}`
    : project.siteId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-description"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <h3
              id="delete-title"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              Delete Project
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <p id="delete-description" className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete project{' '}
            <span className="font-semibold text-gray-900 dark:text-white">{displayName}</span>?
            This action cannot be undone.
          </p>

          <label className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={deleteFiles}
              onChange={(e) => setDeleteFiles(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500 dark:bg-gray-800"
            />
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Also delete source files and extractions from disk
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Uploaded PDFs and extraction output will be permanently removed.
              </p>
            </div>
          </label>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 dark:bg-red-500 rounded-lg hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Delete Project
          </button>
        </div>
      </div>
    </div>
  );
}
