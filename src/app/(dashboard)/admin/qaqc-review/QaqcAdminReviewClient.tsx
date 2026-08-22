'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  Download,
  ShieldCheck,
  ChevronLeft,
  RefreshCw,
  Eye,
  Check,
  X,
  ExternalLink,
  MessageSquare,
  ArrowUpDown,
} from 'lucide-react';
import type { ParameterValueReview } from '@/lib/matrix-options/provenance/qa-review-sync';
import { submitReview, fetchAllReviewsResult } from '@/lib/matrix-options/provenance/qa-review-sync';
import type { CurrentVerificationState } from '@/lib/matrix-options/provenance/qa-review-reduction';
import { reduceToCurrentVerificationStates } from '@/lib/matrix-options/provenance/qa-review-reduction';
import { humanizeCatalogLabel } from '@/lib/matrix-options/provenance/library';
import { cn } from '@/utils/cn';

export interface QaqcAdminReviewClientProps {
  initialReviews: ParameterValueReview[];
  isAdmin: boolean;
}

export function QaqcAdminReviewClient({
  initialReviews,
  isAdmin,
}: QaqcAdminReviewClientProps) {
  const [reviews, setReviews] = useState<ParameterValueReview[]>(initialReviews);
  const [activeTab, setActiveTab] = useState<'verifications' | 'flags' | 'ledger'>('verifications');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'discrepancy' | 'needs_review'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const refreshReviews = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchAllReviewsResult();
      if (res.success) {
        setReviews(res.reviews);
        setActionFeedback(`Refreshed verification ledger from database (${res.reviews.length} entries).`);
      } else {
        setActionFeedback(
          res.error === 'unauthorized' || res.error === 'unauthenticated'
            ? 'Cannot refresh: requires active session with admin privileges.'
            : 'Failed to sync with database. Retaining current view.',
        );
      }
    } catch (err) {
      console.error(err);
      setActionFeedback('Unexpected error during database refresh.');
    } finally {
      setIsRefreshing(false);
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
      feedbackTimerRef.current = setTimeout(() => {
        setActionFeedback(null);
      }, 3500);
    }
  };

  // Compute current deterministic verification state per unique parameter
  const currentStatesMap = useMemo(() => {
    return reduceToCurrentVerificationStates(reviews);
  }, [reviews]);

  const currentVerificationList = useMemo(() => {
    return Object.values(currentStatesMap).sort((a, b) =>
      new Date(b.latest_reviewed_at).getTime() - new Date(a.latest_reviewed_at).getTime(),
    );
  }, [currentStatesMap]);

  // Parse issue flags and resolution state
  const flags = useMemo(() => {
    const fls: Array<ParameterValueReview & { category: string; cleanComment: string; suggested?: string; isResolved: boolean }> = [];
    const resolvedFlagIds = new Set<string>();

    for (const r of reviews) {
      if (r.reviewer_note.startsWith('[FLAG_RESOLVED:')) {
        const match = r.reviewer_note.match(/^\[FLAG_RESOLVED:\s*([^\]]+)\]/);
        if (match) {
          resolvedFlagIds.add(match[1].trim());
        }
      }
    }

    for (const r of reviews) {
      if (r.reviewer_note.startsWith('[FLAG:')) {
        const match = r.reviewer_note.match(/^\[FLAG:\s*([^\]]+)\]\s*([\s\S]*)$/);
        const category = match ? match[1].trim() : 'General Issue';
        let noteBody = match ? match[2].trim() : r.reviewer_note;
        let suggested: string | undefined;
        const suggMatch = noteBody.match(/\(Suggested:\s*([^)]+)\)$/);
        if (suggMatch) {
          suggested = suggMatch[1].trim();
          noteBody = noteBody.replace(/\(Suggested:\s*[^)]+\)$/, '').trim();
        }
        const isResolved = resolvedFlagIds.has(r.id);
        fls.push({
          ...r,
          category,
          cleanComment: noteBody,
          suggested,
          isResolved,
        });
      }
    }

    return fls;
  }, [reviews]);

  // Filtered current verifications
  const filteredVerifications = useMemo(() => {
    return currentVerificationList.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.parameter_value_id.toLowerCase().includes(q) ||
        item.latest_reviewer_note.toLowerCase().includes(q) ||
        (item.latest_reviewed_by && item.latest_reviewed_by.toLowerCase().includes(q));

      const isApproved = item.current_qa_status === 'approved';
      const isDiscrepancy =
        item.current_qa_status !== 'approved' &&
        item.latest_reviewer_note.includes('[VERIFICATION: discrepancy]');

      if (statusFilter === 'approved' && !isApproved) return false;
      if (statusFilter === 'discrepancy' && !isDiscrepancy) return false;
      if (statusFilter === 'needs_review' && item.current_qa_status !== 'needs_review') return false;

      return matchesSearch;
    });
  }, [currentVerificationList, searchQuery, statusFilter]);

  // Filtered flags
  const filteredFlags = useMemo(() => {
    return flags.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        item.parameter_value_id.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.cleanComment.toLowerCase().includes(q) ||
        (item.reviewed_by && item.reviewed_by.toLowerCase().includes(q))
      );
    });
  }, [flags, searchQuery]);

  // Stats calculation
  const stats = useMemo(() => {
    const totalAuditEvents = reviews.length;
    const uniqueParameters = currentVerificationList.length;
    const confirmed = currentVerificationList.filter(
      (c) => c.current_qa_status === 'approved',
    ).length;
    const discrepancies = currentVerificationList.filter(
      (c) =>
        c.current_qa_status !== 'approved' &&
        (c.latest_reviewer_note.includes('[VERIFICATION: discrepancy]') ||
          c.current_qa_status === 'discrepancy'),
    ).length;
    const openFlagCount = flags.filter((f) => !f.isResolved).length;

    return { totalAuditEvents, uniqueParameters, confirmed, discrepancies, flagCount: openFlagCount };
  }, [reviews, currentVerificationList, flags]);

  const handleAdminApprove = async (paramId: string, oldQaStatus: string) => {
    const ok = await submitReview(
      paramId,
      oldQaStatus,
      'approved',
      '[ADMIN_SIGN_OFF] Approved by Administrator for publication.',
    );
    if (ok) {
      setActionFeedback(`Parameter ${paramId} signed off & approved.`);
      setTimeout(() => setActionFeedback(null), 4000);
      await refreshReviews();
    }
  };

  const handleResolveFlag = async (
    flagId: string,
    paramId: string,
    oldQaStatus?: string,
    newQaStatus?: string,
  ) => {
    const fromStatus = oldQaStatus ?? 'needs_review';
    const toStatus = newQaStatus ?? 'approved';
    const ok = await submitReview(
      paramId,
      fromStatus,
      toStatus,
      `[FLAG_RESOLVED:${flagId}] Flag resolved and signed off by Administrator.`,
    );
    if (ok) {
      setActionFeedback(`Flag for parameter ${paramId} marked as resolved & signed off.`);
      refreshReviews();
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reviews, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `qaqc_verification_ledger_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 uppercase tracking-wider border border-sky-200 dark:border-sky-800">
              Audit & Governance
            </span>
            <span className="text-xs font-semibold text-slate-500">Live Supabase Sync</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            QA/QC Provenance & Verification Hub
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Consolidated verification ledger of chemical parameter derivations, toxicologist verification reviews, and flagged issues.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={refreshReviews}
            disabled={isRefreshing}
            className="inline-flex min-h-[44px] items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-sky-500 shadow-2xs transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Database'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex min-h-[44px] items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-sky-500 shadow-2xs transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export (JSON)</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div
          role="status"
          className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200 shadow-xs animate-in fade-in flex items-center gap-1.5"
        >
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Parameters Reviewed</span>
            <FileText className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
            {stats.uniqueParameters}
          </div>
          <p className="text-[11px] text-slate-500">{stats.totalAuditEvents} events in audit ledger</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span>Confirmed Parameters</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">
            {stats.confirmed}
          </div>
          <p className="text-[11px] text-slate-500">Verified against authority source citations</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
            <span>Discrepancies Flagged</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-extrabold text-amber-700 dark:text-amber-300 font-mono">
            {stats.discrepancies}
          </div>
          <p className="text-[11px] text-slate-500">Requires review or value reconciliation</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-sky-700 dark:text-sky-400 text-xs font-bold uppercase tracking-wider">
            <span>Potential Issue Flags</span>
            <MessageSquare className="w-4 h-4 text-sky-700 dark:text-sky-400" />
          </div>
          <div className="text-3xl font-extrabold text-sky-800 dark:text-sky-200 font-mono">
            {stats.flagCount}
          </div>
          <p className="text-[11px] text-slate-500">Submissions to Admin Review Queue</p>
        </div>
      </div>

      {/* Tabs Navigation & Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('verifications')}
              className={cn(
                'min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5',
                activeTab === 'verifications'
                  ? 'bg-sky-700 text-white shadow-xs dark:bg-sky-600'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50',
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Current Verifications ({filteredVerifications.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('flags')}
              className={cn(
                'min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5',
                activeTab === 'flags'
                  ? 'bg-sky-700 text-white shadow-xs dark:bg-sky-600'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50',
              )}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Flagged Issue Queue ({filteredFlags.length})</span>
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search parameter, notes, reviewer..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Status Filters Bar */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 flex-wrap">
          {activeTab === 'verifications' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 mr-1">Filter Status:</span>
              {(['all', 'approved', 'discrepancy', 'needs_review'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    'min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-lg border transition-all',
                    statusFilter === st
                      ? 'bg-sky-100 dark:bg-sky-950 border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-300 shadow-2xs'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50',
                  )}
                >
                  {humanizeCatalogLabel(st)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tab 1: Stage 2 Verifications Table */}
        {activeTab === 'verifications' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5 min-w-[200px]">Parameter Value ID</th>
                  <th className="p-3.5 min-w-[130px]">Verification Status</th>
                  <th className="p-3.5 min-w-[260px]">Toxicologist Reviewer Notes</th>
                  <th className="p-3.5 min-w-[130px]">Reviewer</th>
                  <th className="p-3.5 min-w-[130px]">Date &amp; Time</th>
                  {isAdmin && <th className="p-3.5 min-w-[140px] text-right">Admin Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredVerifications.map((item) => {
                  const isConfirmed = item.current_qa_status === 'approved';
                  const isDiscrepant =
                    item.current_qa_status !== 'approved' &&
                    item.latest_reviewer_note.includes('[VERIFICATION: discrepancy]');
                  const cleanNote = item.latest_reviewer_note.replace(/^\[VERIFICATION:\s*[^\]]+\]\s*/, '');

                  return (
                    <tr
                      key={item.parameter_value_id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors align-top"
                    >
                      <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                        <div>{item.parameter_value_id}</div>
                        <div className="text-[10px] font-sans font-normal text-slate-500 mt-0.5">
                          Status: {humanizeCatalogLabel(item.current_qa_status)} ({item.verification_count} verification{item.verification_count === 1 ? '' : 's'}, {item.total_audit_events} audit event{item.total_audit_events === 1 ? '' : 's'})
                        </div>
                      </td>
                      <td className="p-3.5">
                        {isConfirmed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
                            <Check className="w-3 h-3" /> Confirmed
                          </span>
                        ) : isDiscrepant ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Discrepancy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-300 dark:border-slate-700">
                            {humanizeCatalogLabel(item.current_qa_status)}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 leading-relaxed text-slate-700 dark:text-slate-300">
                        {cleanNote || <span className="text-slate-400 italic">No additional reviewer comments entered.</span>}
                      </td>
                      <td className="p-3.5 font-medium text-slate-600 dark:text-slate-400">
                        {item.latest_reviewed_by ? `User: ${item.latest_reviewed_by.slice(0, 8)}...` : 'Unassigned / Anonymous'}
                      </td>
                      <td className="p-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {item.latest_reviewed_at ? item.latest_reviewed_at.replace('T', ' ').slice(0, 16) : 'Just now'}
                      </td>
                      {isAdmin && (
                        <td className="p-3.5 text-right">
                          {item.current_qa_status !== 'approved' ? (
                            <button
                              type="button"
                              onClick={() => handleAdminApprove(item.parameter_value_id, item.current_qa_status)}
                              className="inline-flex min-h-[44px] items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 text-white font-bold shadow-xs transition-colors"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              <span>Sign Off</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              <Check className="w-3 h-3" /> Approved
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredVerifications.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400">
                      No Stage 2 verification records match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Flagged Issues Queue */}
        {activeTab === 'flags' && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {filteredFlags.map((flag) => (
                <div
                  key={flag.id}
                  className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-2.5 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 dark:border-amber-900/40 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-bold text-[10px] uppercase">
                        {flag.category}
                      </span>
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                        {flag.parameter_value_id}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Flagged on {flag.reviewed_at.replace('T', ' ').slice(0, 16)} by {flag.reviewed_by ? `User ${flag.reviewed_by.slice(0, 8)}` : 'Unassigned / Anonymous'}
                    </div>
                  </div>

                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                    {flag.cleanComment}
                  </p>

                  {flag.suggested && (
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-xs">
                      <span className="font-bold text-amber-800 dark:text-amber-300">Suggested Correction: </span>
                      <span className="font-mono text-slate-900 dark:text-white">{flag.suggested}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                    {flag.isResolved ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <Check className="w-3.5 h-3.5" /> Resolved &amp; Signed Off by Admin
                      </span>
                    ) : (
                      <>
                        <span className="text-[10px] text-slate-500">Status: Pending Admin Resolution</span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() =>
                              handleResolveFlag(
                                flag.id,
                                flag.parameter_value_id,
                                flag.old_qa_status,
                                flag.new_qa_status,
                              )
                            }
                            className="inline-flex min-h-[44px] items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs transition-colors"
                          >
                            Resolve &amp; Sign Off
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              {filteredFlags.length === 0 && (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  No open issue flags recorded in the database.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Raw Ledger View */}
        {activeTab === 'ledger' && (
          <div className="p-5 space-y-4">
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 font-mono text-[11px] overflow-x-auto max-h-96 print:max-h-none">
              <pre className="text-slate-800 dark:text-slate-200">
                {JSON.stringify(reviews, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
