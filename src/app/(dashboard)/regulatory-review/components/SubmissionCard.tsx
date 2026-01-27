'use client';

import Link from 'next/link';
import RunEngineButton from './RunEngineButton';

// ============================================================================
// Types
// ============================================================================

export interface DisplaySubmission {
  id: string;
  siteId: string;
  type: string;
  status: 'pending' | 'in_progress' | 'complete';
  totalItems: number;
  passCount: number;
  failCount: number;
  pendingCount: number;
  submittedAt: string;
  submittedBy: string;
}

// ============================================================================
// Helper Components
// ============================================================================

function ProgressBar({
  passCount,
  failCount,
  pendingCount,
  total,
}: {
  passCount: number;
  failCount: number;
  pendingCount: number;
  total: number;
}) {
  const passPercent = (passCount / total) * 100;
  const failPercent = (failCount / total) * 100;
  const pendingPercent = (pendingCount / total) * 100;

  return (
    <div className="w-full">
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-200">
        <div
          className="bg-green-500 transition-all duration-300"
          style={{ width: `${passPercent}%` }}
        />
        <div
          className="bg-red-500 transition-all duration-300"
          style={{ width: `${failPercent}%` }}
        />
        <div
          className="bg-yellow-400 transition-all duration-300"
          style={{ width: `${pendingPercent}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-500">
        <span className="flex items-center">
          <span className="w-2 h-2 rounded-full bg-green-500 mr-1" />
          Pass: {passCount}
        </span>
        <span className="flex items-center">
          <span className="w-2 h-2 rounded-full bg-red-500 mr-1" />
          Fail: {failCount}
        </span>
        <span className="flex items-center">
          <span className="w-2 h-2 rounded-full bg-yellow-400 mr-1" />
          Pending: {pendingCount}
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Progress' },
    complete: { bg: 'bg-green-100', text: 'text-green-800', label: 'Complete' },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function SubmissionCard({ submission }: { submission: DisplaySubmission }) {
  const formattedDate = new Date(submission.submittedAt).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{submission.siteId}</h3>
          <p className="text-sm text-gray-500 mt-1">{submission.type}</p>
        </div>
        <StatusBadge status={submission.status} />
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center text-sm">
          <svg
            className="h-4 w-4 text-gray-400 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          <span className="text-gray-600">{submission.id}</span>
        </div>
        <div className="flex items-center text-sm">
          <svg
            className="h-4 w-4 text-gray-400 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span className="text-gray-600">{submission.submittedBy}</span>
        </div>
        <div className="flex items-center text-sm">
          <svg
            className="h-4 w-4 text-gray-400 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-gray-600">{formattedDate}</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Review Progress</span>
          <span className="text-sm text-gray-500">{submission.totalItems} items</span>
        </div>
        <ProgressBar
          passCount={submission.passCount}
          failCount={submission.failCount}
          pendingCount={submission.pendingCount}
          total={submission.totalItems}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        <Link
          href={`/regulatory-review/${submission.id}`}
          className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          View Submission
          <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <RunEngineButton
          submissionId={submission.id}
          siteId={submission.siteId}
          variant="secondary"
        />
      </div>
    </div>
  );
}
