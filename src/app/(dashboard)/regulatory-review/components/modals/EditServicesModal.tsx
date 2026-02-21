'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import {
  SERVICES,
  LIFECYCLE_STAGES,
  type LifecycleStage,
} from '@/lib/regulatory-review/schedule3';
import type { ReviewProjectDisplay } from '../LandingPageClient';

// =============================================================================
// Types
// =============================================================================

interface EditServicesModalProps {
  project: ReviewProjectDisplay;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

// =============================================================================
// Component
// =============================================================================

export default function EditServicesModal({
  project,
  isOpen,
  onClose,
  onSave,
}: EditServicesModalProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(project.selectedServices)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/regulatory-review/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_services: JSON.stringify(Array.from(selected)),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save services');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save services');
    } finally {
      setSaving(false);
    }
  };

  // Group services by lifecycle stage
  const servicesByStage = LIFECYCLE_STAGES.map((stage) => ({
    stage,
    services: SERVICES.filter((s) => s.lifecycleStage === stage.id),
  })).filter((group) => group.services.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-services-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h3
              id="edit-services-title"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              Edit Services
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {selected.size} service{selected.size !== 1 ? 's' : ''} selected
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Service List */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          <div className="space-y-6">
            {servicesByStage.map(({ stage, services }) => (
              <div key={stage.id}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  {stage.name}
                </h4>
                <div className="space-y-1">
                  {services.map((svc) => (
                    <label
                      key={svc.id}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(svc.id)}
                        onChange={() => toggle(svc.id)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 dark:bg-gray-800"
                      />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {svc.name}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {svc.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-lg flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Services
          </button>
        </div>
      </div>
    </div>
  );
}
