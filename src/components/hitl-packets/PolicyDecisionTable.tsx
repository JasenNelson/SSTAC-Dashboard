'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, Filter } from 'lucide-react';
import type { FlatRecord } from '@/lib/hitl-packets/types';

interface PolicyDecisionTableProps {
  records: FlatRecord[];
}

type SortField = 'policy_id' | 'decision_score' | 'tier' | 'status' | 'confidence';
type SortDir = 'asc' | 'desc';

export default function PolicyDecisionTable({ records }: PolicyDecisionTableProps) {
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<string>('');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('');
  const [flagFilter, setFlagFilter] = useState<string>('');

  // Sort state
  const [sortField, setSortField] = useState<SortField>('policy_id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Extract unique values for filter dropdowns
  const uniqueStatuses = useMemo(
    () => [...new Set(records.map((r) => r.status))].sort(),
    [records]
  );
  const uniqueTiers = useMemo(
    () => [...new Set(records.map((r) => r.tier))].sort(),
    [records]
  );
  const uniqueConfidences = useMemo(
    () => [...new Set(records.map((r) => r.confidence))].sort(),
    [records]
  );
  const uniqueFlags = useMemo(() => {
    const flags = new Set<string>();
    for (const r of records) {
      if (r.quality_flags) {
        for (const f of r.quality_flags.split(',')) {
          if (f.trim()) flags.add(f.trim());
        }
      }
    }
    return [...flags].sort();
  }, [records]);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = records;

    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (tierFilter) {
      result = result.filter((r) => r.tier === tierFilter);
    }
    if (confidenceFilter) {
      result = result.filter((r) => r.confidence === confidenceFilter);
    }
    if (flagFilter) {
      result = result.filter((r) => r.quality_flags.includes(flagFilter));
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'decision_score') {
        cmp = (a.decision_score ?? 0) - (b.decision_score ?? 0);
      } else {
        const aVal = a[sortField] ?? '';
        const bVal = b[sortField] ?? '';
        cmp = String(aVal).localeCompare(String(bVal));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [records, statusFilter, tierFilter, confidenceFilter, flagFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function SortHeader({ field, label }: { field: SortField; label: string }) {
    return (
      <th
        className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
        onClick={() => toggleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <ArrowUpDown className="h-3 w-3" />
        </span>
      </th>
    );
  }

  // Status badge color
  function statusColor(status: string): string {
    switch (status) {
      case 'PASS':
        return 'bg-green-100 text-green-800';
      case 'FAIL':
        return 'bg-red-100 text-red-800';
      case 'NOT_FOUND':
        return 'bg-gray-100 text-gray-800';
      case 'ESCALATE':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="h-4 w-4 text-gray-400" />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1"
        >
          <option value="">All statuses</option>
          {uniqueStatuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1"
        >
          <option value="">All tiers</option>
          {uniqueTiers.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          value={confidenceFilter}
          onChange={(e) => setConfidenceFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1"
        >
          <option value="">All confidence</option>
          {uniqueConfidences.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {uniqueFlags.length > 0 && (
          <select
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
          >
            <option value="">All flags</option>
            {uniqueFlags.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        )}

        <span className="text-sm text-gray-500">
          {filtered.length} of {records.length} records
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader field="policy_id" label="Policy ID" />
              <SortHeader field="tier" label="Tier" />
              <SortHeader field="status" label="Status" />
              <SortHeader field="confidence" label="Confidence" />
              <SortHeader field="decision_score" label="Score" />
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                AI Reason
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Evidence
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.map((rec) => (
              <tr key={rec.policy_id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-sm font-mono">{rec.policy_id}</td>
                <td className="px-3 py-2 text-sm">{rec.tier}</td>
                <td className="px-3 py-2 text-sm">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColor(rec.status)}`}>
                    {rec.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm">{rec.confidence}</td>
                <td className="px-3 py-2 text-sm font-mono">
                  {rec.decision_score !== null ? rec.decision_score.toFixed(2) : '-'}
                </td>
                <td className="px-3 py-2 text-sm text-gray-600">{rec.ai_invocation_reason}</td>
                <td className="px-3 py-2 text-sm text-gray-600 max-w-xs truncate">
                  {rec.best_evidence_location || '-'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                  No records match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
