'use client';

/**
 * AddSourceForm -- standalone form for registering a new canonical source.
 *
 * Infrastructure-only component (Phase 4b). NOT yet imported anywhere in
 * EvidenceLibrary.tsx -- integration is a serial follow-up task.
 *
 * Requires admin or matrix_admin role (enforced server-side via submitSource).
 */

import React, { useState } from 'react';
import { submitSource } from '@/lib/matrix-options/provenance/source-sync';
import type { SubmitSourceRequest } from '@/lib/matrix-options/provenance/source-sync';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddSourceFormProps {
  onAdded?: (sourceId: string) => void;
  onCancel?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Option lists
// ---------------------------------------------------------------------------

const AUTHORITY_SCOPES = [
  { value: 'BC', label: 'BC' },
  { value: 'Canada_federal', label: 'Canada federal' },
  { value: 'US_federal', label: 'US federal' },
  { value: 'general', label: 'General' },
];

const AUTHORITY_TIERS = [
  { value: 'tier_1_government_or_regulatory', label: 'Tier 1 -- Government / regulatory' },
  { value: 'tier_2_peer_reviewed_literature', label: 'Tier 2 -- Peer-reviewed literature' },
  { value: 'tier_3_supporting_science', label: 'Tier 3 -- Supporting science' },
  { value: 'implementation_scaffold', label: 'Implementation scaffold' },
];

const CANONICAL_STATUSES = [
  { value: 'direct_source_verified', label: 'Direct source verified' },
  { value: 'needs_direct_source_check', label: 'Needs direct source check' },
  { value: 'needs_exact_source_locator', label: 'Needs exact source locator' },
  { value: 'not_applicable', label: 'Not applicable' },
];

const SOURCE_ROLES = [
  { value: 'canonical_candidate', label: 'Canonical candidate' },
  { value: 'reference_mining', label: 'Reference mining' },
  { value: 'policy_compilation', label: 'Policy compilation' },
  { value: 'implementation_scaffold', label: 'Implementation scaffold' },
];

// ---------------------------------------------------------------------------
// Shared input / label styles
// ---------------------------------------------------------------------------

const labelCls =
  'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5';

const inputCls =
  'w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 ' +
  'focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 ' +
  'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 ' +
  'dark:focus:border-emerald-500 dark:focus:ring-emerald-500';

const selectCls =
  'w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 ' +
  'focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 ' +
  'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 ' +
  'dark:focus:border-emerald-500 dark:focus:ring-emerald-500';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddSourceForm({ onAdded, onCancel, className }: AddSourceFormProps) {
  const [shortCitation, setShortCitation] = useState('');
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [publisher, setPublisher] = useState('');
  const [doi, setDoi] = useState('');
  const [url, setUrl] = useState('');
  const [zoteroKey, setZoteroKey] = useState('');
  const [authorityScope, setAuthorityScope] = useState('BC');
  const [authorityTier, setAuthorityTier] = useState('tier_1_government_or_regulatory');
  const [canonicalStatus, setCanonicalStatus] = useState('needs_direct_source_check');
  const [role, setRole] = useState('canonical_candidate');
  const [sourceId, setSourceId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = shortCitation.trim().length > 0 && title.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const yearTrimmed = year.trim();
    const yearNum = yearTrimmed ? parseInt(yearTrimmed, 10) : null;

    const request: SubmitSourceRequest = {
      source_id: sourceId.trim(),
      short_citation: shortCitation.trim(),
      title: title.trim(),
      year: yearTrimmed && !isNaN(yearNum as number) ? yearNum : null,
      publisher: publisher.trim(),
      doi: doi.trim() || null,
      url: url.trim() || null,
      zotero_key: zoteroKey.trim() || null,
      authority_scope: authorityScope,
      authority_tier: authorityTier,
      canonical_source_status: canonicalStatus,
      role,
    };

    const result = await submitSource(request);
    setSubmitting(false);

    if (result.success && result.source_id) {
      onAdded?.(result.source_id);
    } else {
      setError(result.error ?? 'unknown');
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30',
        className,
      )}
      data-testid="add-source-form"
    >
      <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
        Add new source
      </h3>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* short_citation -- required */}
        <div className="lg:col-span-2">
          <label htmlFor="add-source-short-citation" className={labelCls}>
            Short citation <span className="text-red-500">*</span>
          </label>
          <input
            id="add-source-short-citation"
            type="text"
            value={shortCitation}
            onChange={(e) => setShortCitation(e.target.value)}
            placeholder="e.g. Health Canada (2024)"
            className={inputCls}
            data-testid="source-short-citation"
          />
        </div>

        {/* title -- required */}
        <div className="lg:col-span-2">
          <label htmlFor="add-source-title" className={labelCls}>
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="add-source-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Full document title"
            className={inputCls}
            data-testid="source-title"
          />
        </div>

        {/* year */}
        <div>
          <label htmlFor="add-source-year" className={labelCls}>
            Year
          </label>
          <input
            id="add-source-year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g. 2024"
            min="1900"
            max="2100"
            className={inputCls}
            data-testid="source-year"
          />
        </div>

        {/* publisher */}
        <div>
          <label htmlFor="add-source-publisher" className={labelCls}>
            Publisher
          </label>
          <input
            id="add-source-publisher"
            type="text"
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
            placeholder="e.g. Health Canada"
            className={inputCls}
            data-testid="source-publisher"
          />
        </div>

        {/* doi */}
        <div>
          <label htmlFor="add-source-doi" className={labelCls}>
            DOI
          </label>
          <input
            id="add-source-doi"
            type="text"
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            placeholder="e.g. 10.1234/abc"
            className={inputCls}
            data-testid="source-doi"
          />
        </div>

        {/* url */}
        <div>
          <label htmlFor="add-source-url" className={labelCls}>
            URL
          </label>
          <input
            id="add-source-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            className={inputCls}
            data-testid="source-url"
          />
        </div>

        {/* zotero_key */}
        <div>
          <label htmlFor="add-source-zotero-key" className={labelCls}>
            Zotero key
          </label>
          <input
            id="add-source-zotero-key"
            type="text"
            value={zoteroKey}
            onChange={(e) => setZoteroKey(e.target.value)}
            placeholder="e.g. ABCD1234"
            className={inputCls}
            data-testid="source-zotero-key"
          />
        </div>

        {/* source_id (optional manual override) */}
        <div>
          <label htmlFor="add-source-id" className={labelCls}>
            Source ID <span className="text-xs font-normal text-slate-500">(auto-generated if blank)</span>
          </label>
          <input
            id="add-source-id"
            type="text"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            placeholder="src-org-name-year"
            className={inputCls}
            data-testid="source-id-input"
          />
        </div>

        {/* authority_scope */}
        <div>
          <label htmlFor="add-source-authority-scope" className={labelCls}>
            Authority scope
          </label>
          <select
            id="add-source-authority-scope"
            value={authorityScope}
            onChange={(e) => setAuthorityScope(e.target.value)}
            className={selectCls}
            data-testid="source-authority-scope"
          >
            {AUTHORITY_SCOPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* authority_tier */}
        <div className="lg:col-span-2">
          <label htmlFor="add-source-authority-tier" className={labelCls}>
            Authority tier
          </label>
          <select
            id="add-source-authority-tier"
            value={authorityTier}
            onChange={(e) => setAuthorityTier(e.target.value)}
            className={selectCls}
            data-testid="source-authority-tier"
          >
            {AUTHORITY_TIERS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* canonical_source_status */}
        <div>
          <label htmlFor="add-source-canonical-status" className={labelCls}>
            Canonical source status
          </label>
          <select
            id="add-source-canonical-status"
            value={canonicalStatus}
            onChange={(e) => setCanonicalStatus(e.target.value)}
            className={selectCls}
            data-testid="source-canonical-status"
          >
            {CANONICAL_STATUSES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* role */}
        <div>
          <label htmlFor="add-source-role" className={labelCls}>
            Source role
          </label>
          <select
            id="add-source-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={selectCls}
            data-testid="source-role"
          >
            {SOURCE_ROLES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div
          className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
          data-testid="add-source-error"
        >
          {error === 'duplicate_source_id'
            ? 'A source with that ID already exists.'
            : error === 'admin_required'
            ? 'Admin access required.'
            : 'Failed to add source. Try again.'}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
          data-testid="source-submit"
        >
          {submitting ? 'Saving...' : 'Save source'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
