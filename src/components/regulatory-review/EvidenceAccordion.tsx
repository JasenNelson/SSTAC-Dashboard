'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
}

export interface EvidenceAccordionProps {
  evidenceItems: EvidenceItem[];
  className?: string;
}

interface AccordionItemProps {
  item: EvidenceItem;
  isOpen: boolean;
  onToggle: () => void;
}

function AccordionItem({ item, isOpen, onToggle }: AccordionItemProps) {
  // Build the reference string (location + page if available)
  const referenceInfo = item.pageReference
    ? `${item.location} (${item.pageReference})`
    : item.location;

  // Generate a brief summary for the collapsed header
  // Use specDescription if available, otherwise generate from excerpt
  const headerSummary = item.specDescription
    ? item.specDescription
    : item.excerpt.length > 80
      ? item.excerpt.slice(0, 80).trim() + '...'
      : item.excerpt;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header - High-level summary with reference info */}
      <button
        onClick={onToggle}
        className="w-full flex flex-col gap-2 p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
              {item.specId}
            </span>
            {item.evidenceType && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded shrink-0">
                {item.evidenceType}
              </span>
            )}
            <ConfidenceMeter confidence={item.confidence} showLabel={false} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            )}
          </div>
        </div>
        {/* Reference info row */}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {referenceInfo}
        </div>
        {/* Brief summary - only shown when collapsed */}
        {!isOpen && (
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
            {headerSummary}
          </p>
        )}
      </button>

      {/* Expanded Content - Full verbatim excerpt (NEVER truncated) */}
      {isOpen && (
        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          {/* Full Verbatim Excerpt */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              Verbatim Excerpt
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              {item.excerpt}
            </p>
          </div>

          {/* Reference Details */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                Location
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">{item.location}</p>
            </div>
            {item.pageReference && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  Page Reference
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">{item.pageReference}</p>
              </div>
            )}
          </div>

          {/* Confidence */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              Confidence
            </h4>
            <ConfidenceMeter confidence={item.confidence} showLabel={true} />
          </div>

          {/* Match Reasons */}
          {item.matchReasons.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                Match Reasons
              </h4>
              <div className="flex flex-wrap gap-2">
                {item.matchReasons.map((reason, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  >
                    {reason}
                  </span>
                ))}
              </div>
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
      <div className={`text-sm text-gray-500 dark:text-gray-400 italic ${className}`}>
        No evidence items available.
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Controls */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {evidenceItems.length} Evidence Item{evidenceItems.length !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            Expand All
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button
            onClick={collapseAll}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
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
          />
        ))}
      </div>
    </div>
  );
}
