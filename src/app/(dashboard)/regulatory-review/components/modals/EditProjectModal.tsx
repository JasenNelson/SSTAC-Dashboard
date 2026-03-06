'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { ReviewProjectDisplay } from '../LandingPageClient';

// =============================================================================
// Types
// =============================================================================

interface EditProjectModalProps {
  project: ReviewProjectDisplay;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

// =============================================================================
// Component
// =============================================================================

export default function EditProjectModal({
  project,
  isOpen,
  onClose,
  onSave,
}: EditProjectModalProps) {
  const [siteId, setSiteId] = useState(project.siteId);
  const [siteName, setSiteName] = useState(project.siteName ?? '');
  const [applicantName, setApplicantName] = useState(
    project.applicantName ?? ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/regulatory-review/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          siteName: siteName || null,
          applicantName: applicantName || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save changes');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-project-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3
            id="edit-project-title"
            className="text-lg font-semibold text-slate-900 dark:text-white"
          >
            Edit Project
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label
              htmlFor="edit-siteId"
              className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1"
            >
              Site ID *
            </label>
            <input
              id="edit-siteId"
              type="text"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>

          <div>
            <label
              htmlFor="edit-siteName"
              className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1"
            >
              Site Name
            </label>
            <input
              id="edit-siteName"
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>

          <div>
            <label
              htmlFor="edit-applicant"
              className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1"
            >
              Applicant Name
            </label>
            <input
              id="edit-applicant"
              type="text"
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !siteId.trim()}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-sky-600 dark:bg-sky-500 rounded-lg hover:bg-sky-700 dark:hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
