'use client';

import React, { useState, useCallback } from 'react';
import { Search, ChevronDown, ChevronRight, FileText, Loader2, MapPin } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SearchResult {
  assessmentId: number;
  csapId: string;
  location: string;
  sourcePath: string | null;
  pageReference: string | null;
  excerpt: string;
  evidenceType: string;
  confidence: string;
  specDescription: string;
  matchReasons: string[];
}

interface SearchResponse {
  query: string;
  count: number;
  results: SearchResult[];
  filters: {
    locations: string[];
  };
}

interface SubmissionSearchProps {
  submissionId?: string;
}

// ============================================================================
// Helper function to highlight search terms
// ============================================================================

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
  if (terms.length === 0) return text;

  // Create regex to match any term
  const regex = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isMatch = terms.some(t => part.toLowerCase() === t);
    return isMatch ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    );
  });
}

// ============================================================================
// Result Card Component
// ============================================================================

function ResultCard({ result, query, isExpanded, onToggle }: {
  result: SearchResult;
  query: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const confidenceColors: Record<string, string> = {
    HIGH: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
    MEDIUM: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
    LOW: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
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
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
              <MapPin className="w-3 h-3" />
              {result.location}
            </span>
            {result.pageReference && (
              <span className="text-[10px] text-gray-400">p. {result.pageReference}</span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${confidenceColors[result.confidence] || confidenceColors.MEDIUM}`}>
              {result.confidence}
            </span>
            {result.sourcePath && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[200px]" title={result.sourcePath}>
                {result.sourcePath}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
            {highlightText(result.excerpt.substring(0, 200), query)}
            {result.excerpt.length > 200 && '...'}
          </p>
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-2">
          {/* Spec description */}
          {result.specDescription && (
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              <strong>Spec:</strong> {result.specDescription}
            </div>
          )}

          {/* Full excerpt */}
          <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700">
            {highlightText(result.excerpt, query)}
          </div>

          {/* Related CSAP ID */}
          <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
            <span>Found in assessment:</span>
            <span className="font-mono text-indigo-600 dark:text-indigo-400">{result.csapId}</span>
          </div>

          {/* Match reasons if available */}
          {result.matchReasons && result.matchReasons.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.matchReasons.slice(0, 5).map((reason, i) => (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                >
                  {reason}
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

export default function SubmissionSearch({ submissionId }: SubmissionSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
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
        limit: '20',
      });
      if (submissionId) {
        params.set('submissionId', submissionId);
      }
      if (locationFilter !== 'all') {
        params.set('location', locationFilter);
      }

      const response = await fetch(`/api/regulatory-review/submission-search?${params}`);
      const data: SearchResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.query || 'Search failed');
      }

      setResults(data.results);
      if (data.filters?.locations) {
        setLocations(data.filters.locations);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, submissionId, locationFilter]);

  const toggleExpanded = useCallback((id: number) => {
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
        className="w-full flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Search Submission Content
          </span>
          <span className="text-xs text-gray-400">
            ({results.length > 0 ? `${results.length} results` : '841 excerpts'})
          </span>
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
              <label htmlFor="submission-search-input" className="sr-only">Search submission evidence</label>
              <input
                id="submission-search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search HHRA, WARP, MHO content..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </div>

          {/* Location filter */}
          {locations.length > 0 && (
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              aria-label="Filter by location"
              className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <option value="all">All Documents ({locations.length})</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          )}

          {/* Error message */}
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Results */}
          {hasSearched && (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {results.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                  No content found matching your search.
                </p>
              ) : (
                results.map((result, idx) => (
                  <ResultCard
                    key={`${result.assessmentId}-${idx}`}
                    result={result}
                    query={query}
                    isExpanded={expandedIds.has(result.assessmentId * 1000 + idx)}
                    onToggle={() => toggleExpanded(result.assessmentId * 1000 + idx)}
                  />
                ))
              )}
            </div>
          )}

          {/* Helpful hints when not searched yet */}
          {!hasSearched && (
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p>Search through the submission documents:</p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-400">
                <li>HHRA - Human Health Risk Assessment</li>
                <li>WARP - Work Plan narrative</li>
                <li>MHO - Medical Health Officer report</li>
                <li>TAB_SO - Standards and objectives</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
