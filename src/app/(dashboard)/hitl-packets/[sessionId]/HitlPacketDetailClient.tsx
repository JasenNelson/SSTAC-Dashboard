'use client';

import Link from 'next/link';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import ValidationBadge from '@/components/hitl-packets/ValidationBadge';
import PolicyDecisionTable from '@/components/hitl-packets/PolicyDecisionTable';
import type { PacketMetadata, FlatRecord, ValidationResult } from '@/lib/hitl-packets/types';

interface HitlPacketDetailClientProps {
  sessionId: string;
  metadata: PacketMetadata;
  validation: ValidationResult;
  flatRecords: FlatRecord[];
}

export default function HitlPacketDetailClient({
  sessionId,
  metadata,
  validation,
  flatRecords,
}: HitlPacketDetailClientProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/hitl-packets"
            className="text-slate-400 hover:text-slate-500 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Packet Review</h1>
            <p className="text-sm font-mono text-slate-500 dark:text-slate-400">{sessionId}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/hitl-packets/${sessionId}/csv`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <Download className="h-4 w-4" />
            CSV
          </a>
          <a
            href={`/api/hitl-packets/${sessionId}/md`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <FileText className="h-4 w-4" />
            MD
          </a>
        </div>
      </div>

      {/* Metadata + Validation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metadata Card */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">
            Packet Metadata
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Session</dt>
              <dd className="font-mono">{metadata.session_id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Generated</dt>
              <dd>{metadata.generated_at}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Schema</dt>
              <dd className="font-mono">{metadata.schema_version}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Records</dt>
              <dd className="font-medium">{metadata.record_count}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Policies Evaluated</dt>
              <dd>{metadata.policies_evaluated ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Policies in KB</dt>
              <dd>{metadata.policies_in_kb ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Policies Filtered</dt>
              <dd>{metadata.policies_filtered ?? '-'}</dd>
            </div>
          </dl>
        </div>

        {/* Validation Card */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">
            Validation
          </h2>
          <ValidationBadge validation={validation} />
        </div>
      </div>

      {/* Decision Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-4">
          Policy Decisions
        </h2>
        <PolicyDecisionTable records={flatRecords} />
      </div>
    </div>
  );
}
