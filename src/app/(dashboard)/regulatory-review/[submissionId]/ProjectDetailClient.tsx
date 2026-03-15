'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  Clock,
  Upload,
  Loader2,
  MapPin,
  User,
  Calendar,
  Building2,
  StickyNote,
  RefreshCw,
  AlertCircle,
  Search,
} from 'lucide-react';
import { getServiceById } from '@/lib/regulatory-review/schedule3';

// =============================================================================
// Types
// =============================================================================

interface ProjectDetail {
  id: string;
  siteId: string;
  siteName: string | null;
  applicantName: string | null;
  applicantCompany: string | null;
  applicationTypes: string[];
  selectedServices: string[];
  submissionDate: string | null;
  siteAddress: string | null;
  siteRegion: string | null;
  folderPath: string;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectFile {
  id: number;
  filename: string;
  fileSize: number | null;
  fileType: string | null;
  processed: boolean;
  uploadedAt: string;
  processedAt: string | null;
}

interface ProjectDetailClientProps {
  project: ProjectDetail;
  files: ProjectFile[];
}

// =============================================================================
// Helpers
// =============================================================================

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  created: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-200',
    label: 'Created',
  },
  extracting: {
    bg: 'bg-sky-100 dark:bg-sky-900/30',
    text: 'text-sky-800 dark:text-sky-200',
    label: 'Extracting',
  },
  extracted: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-800 dark:text-emerald-200',
    label: 'Extracted',
  },
  active: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-200',
    label: 'Active',
  },
  evaluating: {
    bg: 'bg-sky-100 dark:bg-sky-900/30',
    text: 'text-sky-800 dark:text-sky-200',
    label: 'Evaluating',
  },
  evaluated: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-800 dark:text-emerald-200',
    label: 'Evaluated',
  },
  eval_failed: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-200',
    label: 'Evaluation Failed',
  },
  archived: {
    bg: 'bg-slate-100 dark:bg-slate-700',
    text: 'text-slate-500 dark:text-slate-400',
    label: 'Archived',
  },
};

function fileTypeIcon(fileType: string | null) {
  if (!fileType) return 'file';
  if (fileType.includes('pdf')) return 'pdf';
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) return 'xls';
  if (fileType.includes('word') || fileType.includes('document')) return 'doc';
  if (fileType.includes('image')) return 'img';
  return 'file';
}

// =============================================================================
// Component
// =============================================================================

export default function ProjectDetailClient({
  project,
  files,
}: ProjectDetailClientProps) {
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState<string | null>(null);
  const [evalChecking, setEvalChecking] = useState(false);
  const [evalCheckResult, setEvalCheckResult] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(project.status);

  // Probe evaluate-status to recover completed-but-unimported evaluations
  const checkEvalStatus = useCallback(async () => {
    setEvalChecking(true);
    setEvalCheckResult(null);
    try {
      const res = await fetch(
        `/api/regulatory-review/projects/${project.id}/evaluate-status`,
      );
      if (!res.ok) {
        setEvalCheckResult('Failed to check status');
        return;
      }
      const data = await res.json();

      if (data.status === 'completed') {
        // Route auto-imported and set project to 'evaluated'
        setCurrentStatus('evaluated');
        setEvalCheckResult(
          data.importResult
            ? `Imported ${data.importResult.assessmentsImported} assessments`
            : 'Results imported successfully',
        );
      } else if (data.status === 'error' || data.status === 'import_failed') {
        setCurrentStatus('eval_failed');
        setEvalCheckResult(data.error || 'Evaluation failed');
      } else if (data.status === 'not_started') {
        setEvalCheckResult('No evaluation found');
      } else {
        // Still running
        const progress = data.policies_completed != null && data.policies_total != null
          ? ` (${data.policies_completed}/${data.policies_total} policies)`
          : '';
        setEvalCheckResult(`Still running${progress}`);
      }
    } catch {
      setEvalCheckResult('Failed to check status');
    } finally {
      setEvalChecking(false);
    }
  }, [project.id]);

  // Auto-probe on mount when project status hasn't reached a terminal state.
  // Covers 'evaluating' (normal) and 'created'/'extracted' (stale after recovery).
  useEffect(() => {
    const TERMINAL = ['evaluated', 'eval_failed', 'archived'];
    if (!TERMINAL.includes(project.status)) {
      checkEvalStatus();
    }
  }, [project.status, checkEvalStatus]);

  const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.created;
  const processedCount = files.filter((f) => f.processed).length;
  const totalSize = files.reduce((sum, f) => sum + (f.fileSize || 0), 0);

  const appTypeServices = project.applicationTypes
    .map((id) => getServiceById(id))
    .filter(Boolean);

  const additionalServices = project.selectedServices
    .map((id) => getServiceById(id))
    .filter(Boolean);

  const handleReprocess = async (mode: 'new' | 'full') => {
    setReprocessing(true);
    setReprocessError(null);
    try {
      const res = await fetch(`/api/regulatory-review/projects/${project.id}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start extraction');
      }
      window.location.reload();
    } catch (err) {
      setReprocessError(err instanceof Error ? err.message : 'Unexpected error');
      setReprocessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Back link */}
      <Link
        href="/regulatory-review"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Reviews
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {project.siteName || project.siteId}
          </h1>
          {project.siteName && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Site ID: {project.siteId}
            </p>
          )}
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.text}`}>
          {statusConfig.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Project Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Types */}
          <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide mb-4">
              Application Types
            </h2>
            <div className="flex flex-wrap gap-2">
              {appTypeServices.map((s) => (
                <span
                  key={s!.id}
                  className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300"
                >
                  {s!.name}
                </span>
              ))}
            </div>

            {additionalServices.length > 0 && (
              <>
                <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-5 mb-2">
                  Additional Services
                </h3>
                <div className="flex flex-wrap gap-2">
                  {additionalServices.map((s) => (
                    <span
                      key={s!.id}
                      className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    >
                      {s!.name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Files */}
          <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
                Documents ({files.length})
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {processedCount}/{files.length} processed &middot; {formatFileSize(totalSize)} total
              </span>
            </div>

            {files.length === 0 ? (
              <div className="text-center py-8">
                <Upload className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-500" />
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No files uploaded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {files.map((file) => {
                  const _icon = fileTypeIcon(file.fileType);
                  return (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 py-3"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {file.filename}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatFileSize(file.fileSize)}
                          {file.processedAt && ` — Processed ${formatDate(file.processedAt)}`}
                        </p>
                      </div>
                      {file.processed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Re-process buttons */}
            {files.length > 0 && project.status !== 'extracting' && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                {files.some((f) => !f.processed) && (
                  <button
                    onClick={() => handleReprocess('new')}
                    disabled={reprocessing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors disabled:opacity-50"
                  >
                    {reprocessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    Process New Files
                  </button>
                )}
                <button
                  onClick={() => handleReprocess('full')}
                  disabled={reprocessing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  {reprocessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Full Re-extraction
                </button>
              </div>
            )}

            {reprocessError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{reprocessError}</p>
            )}

            {project.status === 'extracting' && (
              <div className="mt-4 flex items-center gap-2 text-sm text-sky-700 dark:text-sky-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Extraction in progress...
              </div>
            )}

            {/* Evaluation status recovery */}
            {currentStatus === 'evaluating' && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm text-sky-700 dark:text-sky-400">
                  {evalChecking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>Evaluation in progress</span>
                  {!evalChecking && (
                    <button
                      onClick={checkEvalStatus}
                      className="ml-2 px-2 py-0.5 text-xs font-medium rounded bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
                    >
                      Check Status
                    </button>
                  )}
                </div>
                {evalCheckResult && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{evalCheckResult}</p>
                )}
              </div>
            )}

            {currentStatus === 'evaluated' && currentStatus !== project.status && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{evalCheckResult || 'Evaluation complete'}</span>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reload to View Results
                </button>
              </div>
            )}

            {currentStatus === 'eval_failed' && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>{evalCheckResult || 'Evaluation failed'}</span>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right column — Site Details */}
        <div className="space-y-6">
          <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide mb-4">
              Site Details
            </h2>
            <dl className="space-y-4">
              {project.applicantName && (
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Applicant</dt>
                    <dd className="text-sm text-slate-900 dark:text-white">
                      {project.applicantName}
                      {project.applicantCompany && (
                        <span className="text-slate-500 dark:text-slate-400"> — {project.applicantCompany}</span>
                      )}
                    </dd>
                  </div>
                </div>
              )}

              {project.siteAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Address</dt>
                    <dd className="text-sm text-slate-900 dark:text-white">{project.siteAddress}</dd>
                  </div>
                </div>
              )}

              {project.siteRegion && (
                <div className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Region</dt>
                    <dd className="text-sm text-slate-900 dark:text-white">{project.siteRegion}</dd>
                  </div>
                </div>
              )}

              {project.submissionDate && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Submission Date</dt>
                    <dd className="text-sm text-slate-900 dark:text-white">{project.submissionDate}</dd>
                  </div>
                </div>
              )}

              {project.notes && (
                <div className="flex items-start gap-3">
                  <StickyNote className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Notes</dt>
                    <dd className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">{project.notes}</dd>
                  </div>
                </div>
              )}
            </dl>
          </section>

          {/* Timestamps */}
          <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide mb-4">
              Timeline
            </h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Created</dt>
                <dd className="text-sm text-slate-900 dark:text-white">{formatDate(project.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Last Updated</dt>
                <dd className="text-sm text-slate-900 dark:text-white">{formatDate(project.updatedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Folder</dt>
                <dd className="text-xs text-slate-500 dark:text-slate-400 font-mono break-all">{project.folderPath}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
