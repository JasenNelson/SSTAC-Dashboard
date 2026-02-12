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
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Packet Review</h1>
            <p className="text-sm font-mono text-gray-500">{sessionId}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/hitl-packets/${sessionId}/csv`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            CSV
          </a>
          <a
            href={`/api/hitl-packets/${sessionId}/md`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <FileText className="h-4 w-4" />
            MD
          </a>
        </div>
      </div>

      {/* Metadata + Validation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metadata Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
            Packet Metadata
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Session</dt>
              <dd className="font-mono">{metadata.session_id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Generated</dt>
              <dd>{metadata.generated_at}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Schema</dt>
              <dd className="font-mono">{metadata.schema_version}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Records</dt>
              <dd className="font-medium">{metadata.record_count}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Policies Evaluated</dt>
              <dd>{metadata.policies_evaluated ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Policies in KB</dt>
              <dd>{metadata.policies_in_kb ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Policies Filtered</dt>
              <dd>{metadata.policies_filtered ?? '-'}</dd>
            </div>
          </dl>
        </div>

        {/* Validation Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
            Validation
          </h2>
          <ValidationBadge validation={validation} />
        </div>
      </div>

      {/* Decision Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
          Policy Decisions
        </h2>
        <PolicyDecisionTable records={flatRecords} />
      </div>
    </div>
  );
}
