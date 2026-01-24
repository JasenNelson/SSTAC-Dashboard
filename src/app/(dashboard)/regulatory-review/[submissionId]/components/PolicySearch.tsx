'use client';

import React, { useState, useCallback } from 'react';
import { Search, ChevronDown, ChevronRight, ExternalLink, Loader2, Database } from 'lucide-react';
import TierBadge from '@/components/regulatory-review/TierBadge';

// ============================================================================
// Types
// ============================================================================

interface PolicyResult {
  id: string;
  originalText: string;
  plainLanguage: string | null;
  discretionTier: string;
  topicCategory: string | null;
  subCategory: string | null;
  sourceDocument: string | null;
  sourceSection: string | null;
  sourcePage: string | null;
  keywords: string | null;
  reviewQuestion: string | null;
}

interface SearchResponse {
  query: string;
  count: number;
  results: PolicyResult[];
  filters: {
    topics: string[];
    tiers: string[];
  };
}

interface PolicySearchProps {
  initialQuery?: string;
  csapId?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

function PolicyResultCard({ policy, isExpanded, onToggle }: {
  policy: PolicyResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const tierMap: Record<string, 'TIER_1_BINARY' | 'TIER_2_PROFESSIONAL' | 'TIER_3_STATUTORY'> = {
    'TIER_1_BINARY': 'TIER_1_BINARY',
    'TIER_2_PROFESSIONAL': 'TIER_2_PROFESSIONAL',
    'TIER_3_STATUTORY': 'TIER_3_STATUTORY',
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-2 p-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="mt-0.5 text-gray-400">
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 truncate">
              {policy.id}
            </span>
            {policy.discretionTier && tierMap[policy.discretionTier] && (
              <TierBadge tier={tierMap[policy.discretionTier]} />
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
            {policy.plainLanguage || policy.originalText?.substring(0, 150) || 'No description'}
          </p>
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {/* Source info */}
          <div className="flex flex-wrap gap-2 mb-2 text-[10px] text-gray-500 dark:text-gray-400">
            {policy.sourceDocument && (
              <span className="flex items-center gap-1">
                <ExternalLink className="w-2.5 h-2.5" />
                {policy.sourceDocument}
              </span>
            )}
            {policy.sourceSection && (
              <span>Section: {policy.sourceSection}</span>
            )}
            {policy.sourcePage && (
              <span>Page: {policy.sourcePage}</span>
            )}
          </div>

          {/* Topic */}
          {policy.topicCategory && (
            <div className="mb-2">
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                {policy.topicCategory}
                {policy.subCategory && ` / ${policy.subCategory}`}
              </span>
            </div>
          )}

          {/* Full text */}
          <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
            {policy.originalText || 'No text available'}
          </div>

          {/* Review question */}
          {policy.reviewQuestion && (
            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
              <strong>Review Question:</strong> {policy.reviewQuestion}
            </div>
          )}

          {/* Keywords */}
          {policy.keywords && (
            <div className="mt-2 flex flex-wrap gap-1">
              {policy.keywords.split(',').slice(0, 5).map((kw, i) => (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded"
                >
                  {kw.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function PolicySearch({ initialQuery = '', csapId }: PolicySearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [results, setResults] = useState<PolicyResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || query.trim().length < 2) {
      setError('Enter at least 2 characters');
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        limit: '15',
      });
      if (tierFilter !== 'all') {
        params.set('tier', tierFilter);
      }

      const response = await fetch(`/api/regulatory-review/search?${params}`);
      const data: SearchResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.query || 'Search failed');
      }

      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, tierFilter]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  }, [handleSearch]);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Search Policy Database
          </span>
          <span className="text-xs text-gray-400">({results.length > 0 ? `${results.length} results` : '6,036 policies'})</span>
        </div>
        <span className="text-gray-400">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      {/* Expandable content */}
      {isOpen && (
        <div className="p-3 space-y-3 border-t border-gray-200 dark:border-gray-700">
          {/* Search input */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search policies, keywords, topics..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </div>

          {/* Tier filter */}
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Tiers</option>
            <option value="TIER_1_BINARY">Tier 1 - Binary</option>
            <option value="TIER_2_PROFESSIONAL">Tier 2 - Professional</option>
            <option value="TIER_3_STATUTORY">Tier 3 - Statutory</option>
          </select>

          {/* Error message */}
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Results */}
          {hasSearched && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                  No policies found matching your search.
                </p>
              ) : (
                results.map((policy) => (
                  <PolicyResultCard
                    key={policy.id}
                    policy={policy}
                    isExpanded={expandedIds.has(policy.id)}
                    onToggle={() => toggleExpanded(policy.id)}
                  />
                ))
              )}
            </div>
          )}

          {/* Helpful hints when not searched yet */}
          {!hasSearched && (
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p>Search the RRAA knowledge base for:</p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-400">
                <li>Related regulatory policies</li>
                <li>Evidence requirements</li>
                <li>Similar CSAP questions</li>
                <li>Source document references</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
