'use client';

import { useState } from 'react';
import { usePackArtifact } from '@/hooks/bn-rrm/usePackArtifact';
import { normalizeDecisions } from '@/lib/bn-rrm/normalize-artifacts';

type DecisionRecord = {
  id: string;
  title: string;
  status: string;
  date: string;
  severity: string;
  summary: string;
  rationale: string;
  impact: string;
  reopen_criteria: string;
  related_issues: string[];
};

type Limitation = {
  id: string;
  title: string;
  severity: string;
  category: string;
  description: string;
  mitigation: string;
  related: string;
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
  MEDIUM: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  LOW: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'ACTIVE LIMITATION': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
  ACTIVE: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  APPLIED: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
};

function DecisionCard({ decision }: { decision: DecisionRecord }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = STATUS_COLORS[decision.status] ?? STATUS_COLORS.ACTIVE;
  const sevColor = SEVERITY_COLORS[decision.severity] ?? SEVERITY_COLORS.MEDIUM;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="w-16 shrink-0">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{decision.id}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-800 dark:text-slate-100">{decision.title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{decision.date}</div>
        </div>
        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${sevColor.bg} ${sevColor.text}`}>
          {decision.severity}
        </span>
        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusColor.bg} ${statusColor.text}`}>
          {decision.status}
        </span>
        <span className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>&#x25BE;</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700 pt-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Summary</div>
            <p className="text-sm text-slate-700 dark:text-slate-300">{decision.summary}</p>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Rationale</div>
            <p className="text-sm text-slate-700 dark:text-slate-300">{decision.rationale}</p>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Impact</div>
            <p className="text-sm text-slate-700 dark:text-slate-300">{decision.impact}</p>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Re-open Criteria</div>
            <p className="text-sm text-slate-700 dark:text-slate-300">{decision.reopen_criteria}</p>
          </div>
          {(decision.related_issues ?? []).length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Related:</span>
              {(decision.related_issues ?? []).map((issue) => (
                <span key={issue} className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">{issue}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LimitationCard({ limitation }: { limitation: Limitation }) {
  const sevColor = SEVERITY_COLORS[limitation.severity] ?? SEVERITY_COLORS.MEDIUM;

  const categoryLabels: Record<string, string> = {
    structural: 'Structural',
    data_gap: 'Data Gap',
    model_behavior: 'Model Behavior',
    data_saturation: 'Data Saturation',
    generalizability: 'Generalizability',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-start gap-3">
        <div className="w-12 shrink-0">
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{limitation.id}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-slate-800 dark:text-slate-100">{limitation.title}</span>
            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${sevColor.bg} ${sevColor.text}`}>
              {limitation.severity}
            </span>
            <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">
              {categoryLabels[limitation.category] ?? limitation.category}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{limitation.description}</p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Mitigation: </span>
            <span className="text-xs text-blue-700 dark:text-blue-300">{limitation.mitigation}</span>
          </div>
          {limitation.related && (
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">Related: {limitation.related}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExportButton({ data, filename }: { data: unknown; filename: string }) {
  const handleCSV = () => {
    if (!Array.isArray(data) || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map((row: Record<string, unknown>) =>
        headers.map((h) => {
          const v = row[h];
          return JSON.stringify(Array.isArray(v) ? v.join('; ') : (v ?? ''));
        }).join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleJSON = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace('.csv', '.json');
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-1">
      <button onClick={handleCSV} className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
        CSV
      </button>
      <button onClick={handleJSON} className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
        JSON
      </button>
    </div>
  );
}

export function DecisionsAndLimitations() {
  const { data: rawData, loading, error } = usePackArtifact<any>('decisions');

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  const data = rawData ? normalizeDecisions(rawData) : null;

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-red-500 text-sm">{error ?? 'Failed to load data'}</div>
      </div>
    );
  }

  const decisions = data.decision_records as DecisionRecord[];
  const limitations = data.known_limitations as Limitation[];
  const specs = data.spec_versions;
  const issueSummary = data.issue_summary;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">Decisions & Limitations</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Formal decision records, known limitations, and specification versions for the frozen BN-RRM dataset.
        </p>
      </div>

      {/* Known Limitations (Lead with these per risk mitigation) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Known Limitations ({limitations.length})</h3>
          <ExportButton data={limitations} filename="bnrrm_limitations.csv" />
        </div>
        <div className="space-y-3">
          {limitations.map((l) => (
            <LimitationCard key={l.id} limitation={l} />
          ))}
        </div>
      </div>

      {/* Decision Records */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Decision Records ({decisions.length})</h3>
          <ExportButton data={decisions} filename="bnrrm_decisions.csv" />
        </div>
        <div className="space-y-3">
          {decisions.map((d) => (
            <DecisionCard key={d.id} decision={d} />
          ))}
        </div>
      </div>

      {/* Issue Summary */}
      {issueSummary && (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Issue Tracker Summary</h3>
        <div className="grid grid-cols-4 gap-3 mb-3">
          <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{issueSummary.total_issues}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Total</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{issueSummary.fixed}</div>
            <div className="text-xs text-green-600 dark:text-green-400">Fixed</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{issueSummary.active_limitations}</div>
            <div className="text-xs text-amber-600 dark:text-amber-400">Active</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
            <div className="text-2xl font-bold text-slate-600 dark:text-slate-300">{issueSummary.accepted}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Accepted</div>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{issueSummary.note}</p>
      </div>
      )}

      {/* Specification Versions */}
      {Object.keys(specs).length > 0 && (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Specification Versions</h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(specs).map(([doc, version]) => (
            <div key={doc} className="flex items-center justify-between py-1.5 px-3 rounded bg-slate-50 dark:bg-slate-700/50">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{doc.replace(/_/g, ' ')}</span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">v{String(version)}</span>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Export Metadata */}
      <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-4">
        Source: {data.meta.source_docs.join(' | ')} &middot; Export: {data.meta.export_date}
      </div>
    </div>
  );
}
