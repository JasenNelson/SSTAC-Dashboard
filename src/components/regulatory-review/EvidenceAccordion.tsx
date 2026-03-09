'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Flag } from 'lucide-react';
import ConfidenceMeter, { ConfidenceLevel } from './ConfidenceMeter';

export interface EvidenceItem {
  specId: string;
  location: string;
  excerpt: string;
  confidence: ConfidenceLevel;
  matchReasons: string[];
  // Additional fields for better display
  pageReference?: string;
  specDescription?: string;
  evidenceType?: string;
  // Phase 4 (PIV-EVIDENCE-FIDELITY-001): Fidelity and ranking fields
  excerptFidelity?: string;
  confidenceScope?: string;
  fidelityReason?: string;
  sourcePath?: string;
  evidenceTextRaw?: string;
  evidenceTextDisplay?: string;
  rankScore?: number;
  rankReason?: string[];
}

export interface EvidenceAccordionProps {
  evidenceItems: EvidenceItem[];
  className?: string;
  onOpenSource?: (item: EvidenceItem) => void;
  onFlagEvidence?: (item: EvidenceItem) => void;
}

interface AccordionItemProps {
  item: EvidenceItem;
  isOpen: boolean;
  onToggle: () => void;
  onOpenSource?: (item: EvidenceItem) => void;
  onFlagEvidence?: (item: EvidenceItem) => void;
}

/**
 * Check if an evidence item is AI-generated reasoning (not a verbatim submission excerpt)
 */
function isAiReasoningItem(item: EvidenceItem): boolean {
  return (
    item.specId.includes('AI-REASONING') ||
    item.evidenceType === 'AI_REASONING'
  );
}

/**
 * Phase 4 (PIV-EVIDENCE-FIDELITY-001): Get truthful fidelity label.
 * Maps excerpt_fidelity to UI label. Falls back to legacy binary check for old sessions.
 */
function getFidelityLabel(item: EvidenceItem): { label: string; isAi: boolean } {
  const fidelity = item.excerptFidelity;
  if (fidelity === 'verbatim') return { label: 'Verbatim Excerpt', isAi: false };
  if (fidelity === 'normalized') return { label: 'Extracted Excerpt', isAi: false };
  if (fidelity === 'structured') return { label: 'Structured Data', isAi: false };
  if (fidelity === 'ai') return { label: 'AI Analysis', isAi: true };
  // Legacy fallback: use binary AI check, but label non-AI honestly
  const isAi = isAiReasoningItem(item);
  return { label: isAi ? 'AI Analysis' : 'Extracted Excerpt', isAi };
}

/** Fidelity badge color classes */
function getFidelityBadgeClass(fidelity: string | undefined): string {
  switch (fidelity) {
    case 'verbatim': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
    case 'normalized': return 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300';
    case 'structured': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
    case 'ai': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
    default: return 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300';
  }
}

function AccordionItem({ item, isOpen, onToggle, onOpenSource, onFlagEvidence }: AccordionItemProps) {
  const { label: fidelityLabel, isAi: isAiItem } = getFidelityLabel(item);
  const displayText = item.evidenceTextDisplay || item.excerpt;

  // Build the reference string (location + page if available)
  const pageLabel = item.pageReference
    ? item.pageReference.toString()
    : '';
  const pageReference = pageLabel
    ? (pageLabel.toLowerCase().includes('p') ? pageLabel : `p. ${pageLabel}`)
    : '';
  const referenceInfo = pageReference
    ? `${item.location} (${pageReference})`
    : item.location;

  // Generate a brief summary for the collapsed header
  // Use specDescription if available, otherwise generate from display text
  const headerSummary = item.specDescription
    ? item.specDescription
    : displayText.length > 80
      ? displayText.slice(0, 80).trim() + '...'
      : displayText;

  const methodLabel = item.evidenceType || 'Unknown method';
  const canOpenSource = Boolean(onOpenSource);
  const canFlagEvidence = Boolean(onFlagEvidence);

  // Styling varies for AI reasoning items vs verbatim evidence
  const headerBgClass = isAiItem
    ? 'bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-800/30'
    : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700';

  return (
    <div className={`border rounded-lg overflow-hidden ${isAiItem ? 'border-purple-200 dark:border-purple-700' : 'border-slate-200 dark:border-slate-700'}`}>
      {/* Header - High-level summary with reference info */}
      <button
        onClick={onToggle}
        className={`w-full flex flex-col gap-2 p-4 ${headerBgClass} transition-colors text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500`}
        type="button"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="font-mono text-xs font-semibold text-sky-600 dark:text-sky-400 shrink-0">
              {item.specId}
            </span>
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded shrink-0 ${getFidelityBadgeClass(item.excerptFidelity)}`}>
              {fidelityLabel}
            </span>
            {item.confidenceScope === 'policy' && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded shrink-0" title="Confidence derived from policy-level score, not excerpt-level relevance">
                Policy conf.
              </span>
            )}
            <ConfidenceMeter confidence={item.confidence} showLabel={false} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            )}
          </div>
        </div>
        {/* Reference info row */}
        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
          <span>{referenceInfo}</span>
          <span className="text-slate-300 dark:text-slate-500">|</span>
          <span>Method: {methodLabel}</span>
        </div>
        {/* Brief summary - only shown when collapsed */}
        {!isOpen && (
          <p className="text-sm text-slate-500 dark:text-slate-300 line-clamp-2">
            {headerSummary}
          </p>
        )}
      </button>

      {/* Expanded Content - Full excerpt (NEVER truncated) */}
      {isOpen && (
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
          {/* Full Excerpt */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              {fidelityLabel}
            </h4>
            {isAiItem && (
              <p className="text-xs italic text-purple-600 dark:text-purple-400 mb-2">
                This content was generated by Claude AI reasoning, not extracted verbatim from the submission.
              </p>
            )}
            <p className={`text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap p-3 rounded-lg border ${
              isAiItem
                ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
            }`}>
              {displayText}
            </p>
            {/* Raw text detail — shown when raw differs from display */}
            {item.evidenceTextRaw && item.evidenceTextRaw !== displayText && (
              <details className="mt-2">
                <summary className="text-xs text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-500 dark:hover:text-slate-300">
                  Raw source text
                </summary>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 whitespace-pre-wrap">
                  {item.evidenceTextRaw}
                </p>
              </details>
            )}
          </div>

          {/* Reference Details */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Location
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">{item.location}</p>
            </div>
            {item.pageReference && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                  Page Reference
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-300">{item.pageReference}</p>
              </div>
            )}
          </div>

          {/* Confidence */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Confidence{item.confidenceScope ? ` (${item.confidenceScope}-level)` : ''}
            </h4>
            <ConfidenceMeter confidence={item.confidence} showLabel={true} />
          </div>

          {/* Method */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Extraction Method
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-300">{methodLabel}</p>
          </div>

          {/* Match Reasons */}
          {item.matchReasons.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Match Reasons
              </h4>
              <div className="flex flex-wrap gap-2">
                {item.matchReasons.map((reason, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {(canOpenSource || canFlagEvidence) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenSource?.(item)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Source ({referenceInfo})
              </button>
              <button
                type="button"
                onClick={() => onFlagEvidence?.(item)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              >
                <Flag className="w-3.5 h-3.5" />
                Flag as Weak/Irrelevant
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EvidenceAccordion({
  evidenceItems,
  className = '',
  onOpenSource,
  onFlagEvidence,
}: EvidenceAccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (specId: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(specId)) {
        next.delete(specId);
      } else {
        next.add(specId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenItems(new Set(evidenceItems.map((item) => item.specId)));
  };

  const collapseAll = () => {
    setOpenItems(new Set());
  };

  if (evidenceItems.length === 0) {
    return (
      <div className={`text-sm text-slate-500 dark:text-slate-400 italic ${className}`}>
        No evidence items available.
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Controls */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
          {evidenceItems.length} Evidence Item{evidenceItems.length !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
          >
            Expand All
          </button>
          <span className="text-slate-300 dark:text-slate-500">|</span>
          <button
            onClick={collapseAll}
            className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Accordion Items */}
      <div className="space-y-2">
        {evidenceItems.map((item) => (
          <AccordionItem
            key={item.specId}
            item={item}
            isOpen={openItems.has(item.specId)}
            onToggle={() => toggleItem(item.specId)}
            onOpenSource={onOpenSource}
            onFlagEvidence={onFlagEvidence}
          />
        ))}
      </div>
    </div>
  );
}
