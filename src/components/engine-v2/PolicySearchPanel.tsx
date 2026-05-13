// engine_v2 frontend Lane 2d / Module L2d-1: Policy FTS5 search panel.
//
// Mounted on the project detail page (`/dashboard/engine-v2/[projectId]`).
// Ports the v1 PolicySearch component shape onto the engine_v2 search route
// at `/api/engine-v2/policies/search`. Re-uses the existing dashboard
// TierBadge so styling stays consistent.
//
// Behavior:
//   - Debounced input (250 ms) -- avoids hammering the route on every
//     keystroke, per the codex pre-emption checklist.
//   - Controlled text input + tier select + optional topic select.
//   - Result list of expandable PolicyResultCards.
//   - "View details" is a noop placeholder for Lane 2e (deep-link parked
//     per owner Q4 lock 2026-05-13).
//   - ASCII-only.

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
  Loader2,
  Search,
} from "lucide-react";
import TierBadge from "@/components/regulatory-review/TierBadge";

interface PolicyResult {
  id: string;
  originalText: string | null;
  plainLanguage: string | null;
  discretionTier: string | null;
  topicCategory: string | null;
  subCategory: string | null;
  sourceDocument: string | null;
  sourceSection: string | null;
  sourcePage: string | null;
  keywords: string | null;
  reviewQuestion: string | null;
  matchExplanation: string | null;
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

export interface PolicySearchPanelProps {
  projectId: string;
  defaultQuery?: string;
}

type KnownTier =
  | "TIER_1_BINARY"
  | "TIER_2_PROFESSIONAL"
  | "TIER_3_STATUTORY";

const TIER_DISPLAY: Record<KnownTier, KnownTier> = {
  TIER_1_BINARY: "TIER_1_BINARY",
  TIER_2_PROFESSIONAL: "TIER_2_PROFESSIONAL",
  TIER_3_STATUTORY: "TIER_3_STATUTORY",
};

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 15;

function PolicyResultCard({
  policy,
  isExpanded,
  onToggle,
}: {
  policy: PolicyResult;
  isExpanded: boolean;
  onToggle: () => void;
}): React.ReactElement {
  const knownTier =
    policy.discretionTier &&
    (policy.discretionTier in TIER_DISPLAY)
      ? (policy.discretionTier as KnownTier)
      : null;

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-2 p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <span className="mt-0.5 text-slate-400">
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-sky-600 dark:text-sky-400 truncate">
              {policy.id}
            </span>
            {knownTier && <TierBadge tier={knownTier} />}
            {policy.matchExplanation && (
              <span
                className={
                  "text-[10px] px-1.5 py-0.5 rounded font-medium " +
                  (policy.matchExplanation === "High"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    : policy.matchExplanation === "Medium"
                      ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400")
                }
              >
                {policy.matchExplanation}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
            {policy.plainLanguage ||
              (policy.originalText
                ? policy.originalText.substring(0, 150)
                : "No description")}
          </p>
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex flex-wrap gap-2 mb-2 text-[10px] text-slate-500 dark:text-slate-400">
            {policy.sourceDocument && (
              <span className="flex items-center gap-1">
                <ExternalLink className="w-2.5 h-2.5" />
                {policy.sourceDocument}
              </span>
            )}
            {policy.sourceSection && (
              <span>Section: {policy.sourceSection}</span>
            )}
            {policy.sourcePage && <span>Page: {policy.sourcePage}</span>}
          </div>

          {policy.topicCategory && (
            <div className="mb-2">
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">
                {policy.topicCategory}
                {policy.subCategory ? ` / ${policy.subCategory}` : ""}
              </span>
            </div>
          )}

          <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
            {policy.originalText || "No text available"}
          </div>

          {policy.reviewQuestion && (
            <div className="mt-2 p-2 bg-sky-50 dark:bg-sky-900/20 rounded text-xs text-sky-700 dark:text-sky-300">
              <strong>Review Question:</strong> {policy.reviewQuestion}
            </div>
          )}

          {policy.keywords && (
            <div className="mt-2 flex flex-wrap gap-1">
              {policy.keywords
                .split(",")
                .slice(0, 5)
                .map((kw, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded"
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

export function PolicySearchPanel({
  projectId,
  defaultQuery,
}: PolicySearchPanelProps): React.ReactElement {
  // projectId is reserved for Lane 2e deep-linking; tracked so eslint
  // does not flag the prop as unused.
  void projectId;

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>(defaultQuery ?? "");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [topics, setTopics] = useState<string[]>([]);
  const [results, setResults] = useState<PolicyResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set<string>(),
  );

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string, tier: string, topic: string): Promise<void> => {
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setResults([]);
        setError(null);
        setHasSearched(false);
        return;
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setIsSearching(true);
      setError(null);
      setHasSearched(true);

      try {
        const params = new URLSearchParams({
          q: trimmed,
          limit: String(RESULT_LIMIT),
        });
        if (tier !== "all") params.set("tier", tier);
        if (topic !== "all") params.set("topic", topic);

        const res = await fetch(
          `/api/engine-v2/policies/search?${params.toString()}`,
          { signal: controller.signal },
        );
        const data = (await res.json()) as
          | SearchResponse
          | { error: string };
        if (!res.ok) {
          const msg =
            "error" in data && typeof data.error === "string"
              ? data.error
              : "search_failed";
          throw new Error(msg);
        }
        const ok = data as SearchResponse;
        setResults(ok.results);
        if (Array.isArray(ok.filters?.topics)) {
          setTopics(ok.filters.topics);
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "search_failed");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [],
  );

  // Debounce on query change.
  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query, tierFilter, topicFilter);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, tierFilter, topicFilter, isOpen, runSearch]);

  // Cleanup any in-flight fetch on unmount.
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        void runSearch(query, tierFilter, topicFilter);
      }
    },
    [query, tierFilter, topicFilter, runSearch],
  );

  const resultCountLabel = useMemo(() => {
    if (results.length > 0) return `${results.length} results`;
    return "Search policy KB";
  }, [results.length]);

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-sky-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Policy KB search
          </span>
          <span className="text-xs text-slate-400">({resultCountLabel})</span>
        </div>
        <span className="text-slate-400">
          {isOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>
      </button>

      {isOpen && (
        <div className="p-3 space-y-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <label
                htmlFor="engine-v2-policy-search-input"
                className="sr-only"
              >
                Search policy KB
              </label>
              <input
                id="engine-v2-policy-search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search policies, keywords, topics..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              />
            </div>
            {isSearching && (
              <span
                className="self-center text-slate-400"
                aria-label="Searching"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              aria-label="Filter by tier"
              className="flex-1 text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              <option value="all">All tiers</option>
              <option value="TIER_1_BINARY">Tier 1 - Binary</option>
              <option value="TIER_2_PROFESSIONAL">
                Tier 2 - Professional
              </option>
              <option value="TIER_3_STATUTORY">Tier 3 - Statutory</option>
            </select>
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              aria-label="Filter by topic"
              className="flex-1 text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              <option value="all">All topics</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          {hasSearched && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.length === 0 && !isSearching ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
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

          {!hasSearched && (
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p>Search the RRAA knowledge base for:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                <li>Related regulatory policies</li>
                <li>Evidence requirements</li>
                <li>Tier 1 / 2 / 3 discretion gating</li>
                <li>Source document references</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default PolicySearchPanel;
