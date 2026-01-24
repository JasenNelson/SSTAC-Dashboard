'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { X, Download, Copy, FileText, FileCode, Check, FileSpreadsheet, File } from 'lucide-react';
import type { Assessment } from '../page';
import {
  generateMarkdown,
  generateHTML,
  generateCSV,
  generateWordHTML,
  generatePreview,
  calculateStats,
  downloadContent,
  copyToClipboard,
  type LocalAssessment,
  type LocalJudgment,
  type ExportOptions,
  type MemoData,
} from '@/lib/regulatory-review/memo-generator';

// ============================================================================
// Types
// ============================================================================

export interface ExportPanelProps {
  submissionId: string;
  siteId?: string;
  assessments: Assessment[];
  judgments: Map<string, LocalJudgment>;
  onClose: () => void;
  isOpen: boolean;
}

type ExportFormat = 'markdown' | 'html' | 'csv' | 'word';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert page Assessment type to LocalAssessment for memo generator
 */
function convertAssessment(assessment: Assessment): LocalAssessment {
  return {
    id: assessment.id,
    policyId: assessment.policyId,
    policyTitle: assessment.policyTitle,
    section: assessment.section,
    tier: assessment.tier,
    status: assessment.status,
    evidence: assessment.evidence,
    notes: assessment.notes,
    reviewedAt: assessment.reviewedAt,
    reviewedBy: assessment.reviewedBy,
  };
}

// ============================================================================
// ExportPanel Component
// ============================================================================

export default function ExportPanel({
  submissionId,
  siteId,
  assessments,
  judgments,
  onClose,
  isOpen,
}: ExportPanelProps) {
  // Export options state
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [includePending, setIncludePending] = useState(true);
  const [twoColumnFormat, setTwoColumnFormat] = useState(true);
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [onlyNeedsAttention, setOnlyNeedsAttention] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // UI state
  const [copySuccess, setCopySuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Convert assessments to local format
  const localAssessments = useMemo(
    () => assessments.map(convertAssessment),
    [assessments]
  );

  // Build export options object
  const exportOptions: ExportOptions = useMemo(
    () => ({
      format,
      includePending,
      twoColumnFormat,
      includeEvidence,
      onlyNeedsAttention,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    }),
    [format, includePending, twoColumnFormat, includeEvidence, onlyNeedsAttention, dateFrom, dateTo]
  );

  // Build memo data object
  const memoData: MemoData = useMemo(
    () => ({
      submissionId,
      siteId,
      assessments: localAssessments,
      judgments,
    }),
    [submissionId, siteId, localAssessments, judgments]
  );

  // Calculate statistics
  const stats = useMemo(
    () => calculateStats(localAssessments, judgments),
    [localAssessments, judgments]
  );

  // Generate preview content
  const previewContent = useMemo(
    () => generatePreview(memoData, exportOptions, 3),
    [memoData, exportOptions]
  );

  // Handle download
  const handleDownload = useCallback(() => {
    let content: string;
    switch (format) {
      case 'csv':
        content = generateCSV(memoData, exportOptions);
        break;
      case 'word':
        content = generateWordHTML(memoData, exportOptions);
        break;
      case 'html':
        content = generateHTML(memoData, exportOptions);
        break;
      default:
        content = generateMarkdown(memoData, exportOptions);
    }

    const filename = `interim-memo-${submissionId}-${new Date().toISOString().split('T')[0]}`;
    downloadContent(content, filename, format);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  }, [format, memoData, exportOptions, submissionId]);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    let content: string;
    switch (format) {
      case 'csv':
        content = generateCSV(memoData, exportOptions);
        break;
      case 'word':
        content = generateWordHTML(memoData, exportOptions);
        break;
      case 'html':
        content = generateHTML(memoData, exportOptions);
        break;
      default:
        content = generateMarkdown(memoData, exportOptions);
    }

    const success = await copyToClipboard(content);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }, [format, memoData, exportOptions]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Export Interim Tech Memo
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Format Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('csv')}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg border transition-colors ${
                  format === 'csv'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <FileSpreadsheet className="h-5 w-5" />
                <span className="font-medium">Excel (CSV)</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Opens in Excel</span>
              </button>
              <button
                onClick={() => setFormat('word')}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg border transition-colors ${
                  format === 'word'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <File className="h-5 w-5" />
                <span className="font-medium">Word (.doc)</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Formatted memo</span>
              </button>
              <button
                onClick={() => setFormat('markdown')}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg border transition-colors ${
                  format === 'markdown'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <FileText className="h-5 w-5" />
                <span className="font-medium">Markdown</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Plain text</span>
              </button>
              <button
                onClick={() => setFormat('html')}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg border transition-colors ${
                  format === 'html'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <FileCode className="h-5 w-5" />
                <span className="font-medium">HTML</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Web page</span>
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="mb-6 space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Content Options
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includePending}
                onChange={(e) => setIncludePending(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Include pending items (not yet reviewed)
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={twoColumnFormat}
                onChange={(e) => setTwoColumnFormat(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Two-column format (AI | Human side-by-side)
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeEvidence}
                onChange={(e) => setIncludeEvidence(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Include evidence excerpts
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyNeedsAttention}
                onChange={(e) => setOnlyNeedsAttention(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Include only items needing attention (FAIL, REQUIRES_JUDGMENT)
              </span>
            </label>
          </div>

          {/* Date Range Filter */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date Range Filter (optional)
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Export Summary
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.total}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Items</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.reviewed}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Reviewed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {stats.pending}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Pending</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-around text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-green-600 dark:text-green-400">{stats.pass}</span> Pass
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-red-600 dark:text-red-400">{stats.fail}</span> Fail
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-yellow-600 dark:text-yellow-400">{stats.requiresJudgment}</span> Requires Judgment
                </span>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Preview (First 3 Items)
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {format === 'csv' && 'CSV Preview'}
                {format === 'word' && 'Word Preview'}
                {format === 'html' && 'HTML Preview'}
                {format === 'markdown' && 'Markdown Preview'}
              </span>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {(format === 'html' || format === 'word') ? (
                <iframe
                  srcDoc={previewContent}
                  className="w-full h-[200px] bg-white"
                  title="Export Preview"
                  sandbox="allow-same-origin"
                />
              ) : (
                <pre className="p-4 bg-gray-50 dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-[200px] whitespace-pre-wrap font-mono">
                  {previewContent}
                </pre>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                copySuccess
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              {copySuccess ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy to Clipboard
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                downloadSuccess
                  ? 'bg-green-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {downloadSuccess ? (
                <>
                  <Check className="h-4 w-4" />
                  Downloaded!
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
