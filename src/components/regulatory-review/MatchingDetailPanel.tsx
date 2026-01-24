'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Sparkles,
  Link2,
  FileText,
  Tag,
  BarChart3,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { MatchingDetail } from '@/lib/regulatory-review/types';

interface MatchingDetailPanelProps {
  detail: MatchingDetail;
  isExpanded?: boolean;
  onToggle?: () => void;
}

// Score bar component
function ScoreBar({
  label,
  score,
  weight,
  color,
}: {
  label: string;
  score: number;
  weight?: number;
  color: string;
}) {
  const percentage = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-gray-500 dark:text-gray-400">{label}</span>
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-10 text-right font-mono text-gray-700 dark:text-gray-300">
        {percentage}%
      </span>
      {weight !== undefined && (
        <span className="w-12 text-right text-gray-400">
          (×{weight.toFixed(1)})
        </span>
      )}
    </div>
  );
}

// Keyword tag component
function KeywordTag({
  keyword,
  found,
}: {
  keyword: string;
  found: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        found
          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
          : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 line-through'
      }`}
    >
      {found ? (
        <CheckCircle2 className="w-3 h-3 mr-1" />
      ) : (
        <XCircle className="w-3 h-3 mr-1" />
      )}
      {keyword}
    </span>
  );
}

// Section component for collapsible sections
function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <Icon className="w-4 h-4" />
        {title}
      </button>
      {isOpen && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

export default function MatchingDetailPanel({
  detail,
  isExpanded = false,
  onToggle,
}: MatchingDetailPanelProps) {
  const { matchingRationale, policyContext } = detail;

  const methodLabels = {
    hybrid: 'Hybrid Search',
    keyword: 'Keyword Only',
    ai_fallback: 'AI Fallback',
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Search className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Matching Details
          </span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              matchingRationale.method === 'ai_fallback'
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
                : matchingRationale.method === 'hybrid'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}
          >
            {methodLabels[matchingRationale.method]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            Score: {Math.round(matchingRationale.scores.combined * 100)}%
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {/* Score Breakdown */}
          <Section title="Score Breakdown" icon={BarChart3}>
            <div className="space-y-2">
              <ScoreBar
                label="Keyword"
                score={matchingRationale.scores.keyword}
                weight={0.4}
                color="bg-blue-500"
              />
              <ScoreBar
                label="Semantic"
                score={matchingRationale.scores.semantic}
                weight={0.4}
                color="bg-purple-500"
              />
              <ScoreBar
                label="Structural"
                score={matchingRationale.scores.structural}
                weight={0.2}
                color="bg-amber-500"
              />
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <ScoreBar
                  label="Combined"
                  score={matchingRationale.scores.combined}
                  color="bg-green-500"
                />
              </div>
            </div>
            {matchingRationale.scoreBreakdown.length > 0 && (
              <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
                {matchingRationale.scoreBreakdown.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
          </Section>

          {/* Keywords Analysis */}
          <Section title="Keywords Analysis" icon={Tag}>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">
                  Policy Keywords ({matchingRationale.policyKeywords.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {matchingRationale.policyKeywords.map((kw, i) => (
                    <KeywordTag
                      key={i}
                      keyword={kw}
                      found={matchingRationale.keywordsFound.includes(kw)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-3 h-3" />
                  {matchingRationale.keywordsFound.length} found
                </div>
                <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <XCircle className="w-3 h-3" />
                  {matchingRationale.keywordsMissing.length} missing
                </div>
                <div className="text-gray-500">
                  Source: {matchingRationale.keywordsSource}
                </div>
              </div>
            </div>
          </Section>

          {/* AI Details (if triggered) */}
          {matchingRationale.aiDetails?.triggered && (
            <Section title="AI Assistance" icon={Sparkles}>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Trigger Reason:</span>
                  <span className="text-purple-600 dark:text-purple-400">
                    {matchingRationale.aiDetails.triggerReason || 'Low keyword score'}
                  </span>
                </div>
                {matchingRationale.aiDetails.model && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Model:</span>
                    <span className="font-mono text-gray-700 dark:text-gray-300">
                      {matchingRationale.aiDetails.model}
                    </span>
                  </div>
                )}
                {matchingRationale.aiDetails.reasoning && (
                  <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                    <div className="text-gray-500 mb-1">AI Reasoning:</div>
                    <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {matchingRationale.aiDetails.reasoning}
                    </div>
                  </div>
                )}
                {matchingRationale.aiDetails.confidence !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Confidence:</span>
                    <span className="font-mono">
                      {Math.round(matchingRationale.aiDetails.confidence * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Cross-Reference Details */}
          {matchingRationale.crossRefDetails?.boostApplied && (
            <Section title="Cross-Reference Boost" icon={Link2}>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Boost Applied:</span>
                  <span className="text-green-600 dark:text-green-400 font-mono">
                    +{(matchingRationale.crossRefDetails.boostAmount * 100).toFixed(0)}%
                  </span>
                </div>
                {matchingRationale.crossRefDetails.relatedPolicies.length > 0 && (
                  <div>
                    <div className="text-gray-500 mb-1">Related Policies:</div>
                    <div className="flex flex-wrap gap-1">
                      {matchingRationale.crossRefDetails.relatedPolicies.map((p, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-xs font-mono"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Search Statistics */}
          <Section title="Search Statistics" icon={Search} defaultOpen={false}>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-gray-500">Sections Searched</div>
                <div className="font-mono text-lg text-gray-700 dark:text-gray-300">
                  {matchingRationale.searchStats.sectionsSearched}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Best Match Score</div>
                <div className="font-mono text-lg text-green-600 dark:text-green-400">
                  {Math.round(matchingRationale.searchStats.bestScore * 100)}%
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-gray-500">Best Section</div>
                <div className="font-mono text-gray-700 dark:text-gray-300 truncate">
                  {matchingRationale.searchStats.bestSection}
                </div>
              </div>
              {matchingRationale.searchStats.runnerUpScore !== undefined && (
                <div className="col-span-2">
                  <div className="text-gray-500">Runner-up Score</div>
                  <div className="font-mono text-gray-600 dark:text-gray-400">
                    {Math.round(matchingRationale.searchStats.runnerUpScore * 100)}%
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Policy Context */}
          <Section title="Policy Context" icon={FileText} defaultOpen={false}>
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Policy ID:</span>
                <span className="font-mono text-gray-700 dark:text-gray-300">
                  {policyContext.policyId}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Tier:</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    policyContext.discretionTier === 'TIER_1_BINARY'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                      : policyContext.discretionTier === 'TIER_2_PROFESSIONAL'
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                  }`}
                >
                  {policyContext.discretionTier.replace('_', ' ')}
                </span>
              </div>
              <div>
                <div className="text-gray-500 mb-1">5-Sentence Framework:</div>
                <div className="space-y-1 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                  {Object.entries(policyContext.semanticSentences).map(([key, val]) => (
                    <div key={key} className="flex gap-2">
                      <span className="w-20 text-gray-400 uppercase text-[10px]">{key}</span>
                      <span className="text-gray-700 dark:text-gray-300 flex-1">
                        {val || <span className="italic text-gray-400">(not defined)</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
