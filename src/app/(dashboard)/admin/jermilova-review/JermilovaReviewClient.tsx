'use client';

// Admin client for the Jermilova collaborative-review pool.
//
// Renders a filterable list of every user's document_reviews row where
// document_id='jermilova_bnrrm'. Forks the structure of MatrixReviewClient
// (filters, status counts, per-row comment table) but trims the
// quantitative-charts column (the matrix-review pattern had mock poll
// charts that were never populated; the Jermilova review surfaces only
// qualitative section comments + status).
//
// Server component does the auth + admin-role gate + RLS-safe fetch;
// this client component renders the result + handles client-side
// filtering.

import { useEffect, useMemo, useState } from 'react';
import AdminFunctionsNav from '@/components/dashboard/AdminFunctionsNav';

// Reserved JS prototype-pollution keys; filtered out before mapping JSONB
// payloads into JSX so a tampered row can't render under these section
// names. Mirrors MatrixReviewClient guard.
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Normalize an arbitrary JSONB value into a string for safe rendering.
// React auto-escapes the resulting string, so this guards against
// '[object Object]' rendering when a payload value is non-string.
function renderJsonValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return '';
  }
}

export interface JermilovaReview {
  id: string;
  user_id: string;
  email: string;
  status: 'IN_PROGRESS' | 'SUBMITTED';
  comments_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface Props {
  reviews: JermilovaReview[];
  /** Server-side fetch error message, if the document_reviews SELECT
   *  failed. When set, the page renders an explicit error banner
   *  instead of an empty pool that admins could mistake for "no
   *  submissions yet." Codex 2026-05-17 P2. */
  fetchError?: string | null;
}

type StatusFilter = 'ALL' | 'IN_PROGRESS' | 'SUBMITTED';

export default function JermilovaReviewClient({ reviews, fetchError = null }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [filteredReviews, setFilteredReviews] =
    useState<JermilovaReview[]>(reviews);

  useEffect(() => {
    let filtered = reviews;
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((rev) => rev.status === statusFilter);
    }
    if (searchTerm) {
      const needle = searchTerm.toLowerCase();
      filtered = filtered.filter((rev) =>
        rev.email.toLowerCase().includes(needle),
      );
    }
    setFilteredReviews(filtered);
  }, [reviews, searchTerm, statusFilter]);

  const totalSubmissions = reviews.length;
  const submittedCount = reviews.filter((r) => r.status === 'SUBMITTED').length;
  const inProgressCount = reviews.filter((r) => r.status === 'IN_PROGRESS').length;

  const totalCommentsByReview = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of reviews) {
      out[r.id] = Object.keys(r.comments_data || {}).filter(
        (k) => !RESERVED_KEYS.has(k),
      ).length;
    }
    return out;
  }, [reviews]);

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Jermilova BN-RRM Review Admin Pool
        </h1>
        <p className="text-slate-600 dark:text-slate-300">
          Section-by-section feedback from collaborative reviewers of the
          Jermilova BN-RRM construction methodology paper.
          {' '}<span className="text-slate-500 dark:text-slate-400">
            (Save status = work in progress; Submit status = reviewer
            flagged a complete pass for your attention. Reviewers can keep
            editing after submission.)
          </span>
        </p>
      </div>

      <AdminFunctionsNav />

      {/* Server-side fetch failure banner (codex 2026-05-17 P2). If
          document_reviews SELECT errored, we surface it explicitly
          rather than silently rendering an empty pool. */}
      {fetchError && (
        <div
          className="mb-6 p-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800"
          data-testid="jermilova-admin-fetch-error"
        >
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            Could not load review submissions.
          </p>
          <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
            {fetchError}
          </p>
          <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
            The page is rendering an empty pool below; treat the zero
            counts as a load failure, not as &quot;no submissions yet.&quot;
            Check Supabase status, the document_reviews table, and RLS
            policies. Re-load to retry.
          </p>
        </div>
      )}

      {/* Status counts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            Total Reviews
          </h3>
          <p className="text-3xl font-bold text-sky-700 dark:text-sky-300">
            {totalSubmissions}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            Submitted
          </h3>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            {submittedCount}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            In Progress
          </h3>
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {inProgressCount}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-8">
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
          Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Search reviewer email
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by email..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
              data-testid="jermilova-admin-search"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              data-testid="jermilova-admin-status-filter"
            >
              <option value="ALL">All status</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="IN_PROGRESS">In progress</option>
            </select>
          </div>
        </div>
      </div>

      {/* Comment table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
          Review Submissions
        </h3>
        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
          {filteredReviews.length === 0 && (
            <p className="text-slate-500 dark:text-slate-400">
              No reviews match the current filters.
            </p>
          )}
          {filteredReviews.map((review) => {
            const commentCount = totalCommentsByReview[review.id] ?? 0;
            return (
              <div
                key={review.id}
                className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50"
                data-testid="jermilova-admin-review-row"
              >
                <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      {review.email}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {commentCount} comment{commentCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        review.status === 'SUBMITTED'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}
                    >
                      {review.status}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Last updated {formatDate(review.updated_at)}
                    </p>
                  </div>
                </div>

                {commentCount === 0 ? (
                  <p className="text-sm text-slate-500 italic">
                    No comments provided.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(review.comments_data)
                      .filter(([section]) => !RESERVED_KEYS.has(section))
                      .map(([section, comment]) => {
                        const rendered = renderJsonValue(comment);
                        if (!rendered) return null;
                        return (
                          <div
                            key={section}
                            className="bg-white dark:bg-slate-800 rounded p-3 border border-slate-200 dark:border-slate-700"
                          >
                            <h5 className="font-medium text-slate-900 dark:text-white mb-1 text-sm">
                              {section}
                            </h5>
                            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                              {rendered}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
