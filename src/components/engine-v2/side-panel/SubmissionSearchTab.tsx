// engine_v2 frontend Lane 2d / Phase C: Submission Search tab.
//
// Live UI for FTS over v2_submission_chunks. Consumes:
//   - GET /api/engine-v2/evaluations/[evalId]/indexing-status (on mount)
//   - GET /api/engine-v2/evaluations/[evalId]/submission/search (on submit)
//   - POST /api/engine-v2/evaluations/[evalId]/reindex (retry CTA when
//     indexing-status returns status='error')
//
// State machine on mount (per plan v0.5 IMPORTANT 3):
//   - status='complete' -> enable search input.
//   - status='pending' | 'running' -> show a "Indexing in progress..."
//     placeholder; input disabled.
//   - status='error' -> show "Search unavailable: indexing failed
//     (<error_message>); retry" CTA; clicking retry POSTs to the
//     reindex route and re-fetches status on response.
//   - status='absent' -> backwards-compat path: smaller hint "No
//     indexed chunks yet -- re-evaluate to enable search".
//
// Result list:
//   - Snippet rendered as HTML (server-side <mark>-only highlighted on an
//     HTML-escaped haystack). Sanitized with a local allowlist that
//     permits ONLY <mark> and </mark> tags as defense-in-depth.
//   - "Indigenous uses content" badge -- NEUTRAL content-type label per
//     feedback_no_tier_judgment_for_ai (2026-05-12, HIGH AUTHORITY).
//     The badge signals pathway-relevant Indigenous-uses content. It
//     is NOT a procedural / consultation gate; consultation handling is
//     out of scope for this app.
//   - Cited-by count badge.
//   - Click row -> openPeek({ evidenceItemId, ... }) via SidePanelContext.
//
// Tab state shares the localStorage-backed lastQueryPerTab map via the
// useSidePanelState hook. Calling that hook here is intentional even
// though EvaluationSidePanel also calls it -- they read/write the same
// per-eval key, so values stay consistent after the hydration pass.
// Phase A's mount contract sealed the SubmissionSearchTab prop surface
// at { evaluationId }; sharing the hook is the available path.
//
// ASCII only.

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { Loader2, RefreshCw, Search, AlertTriangle } from "lucide-react";

import { useSidePanel } from "./SidePanelContext";
import { useSidePanelState } from "./useSidePanelState";

export interface SubmissionSearchTabProps {
  evaluationId: string;
}

const DEBOUNCE_MS = 250;
const MIN_QUERY_LEN = 2;
const MAX_QUERY_LEN = 200;
const RESULT_LIMIT = 20;

type IndexingStatus =
  | "pending"
  | "running"
  | "complete"
  | "error"
  | "absent";

interface IndexingStatusResponse {
  status: IndexingStatus;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
}

interface SearchResultRow {
  evidence_item_id: string;
  snippet: string;
  section: string;
  page: number | null;
  indigenous_flagged: boolean;
  cited_by_count: number;
}

interface SearchResponse {
  query: string;
  count: number;
  results: SearchResultRow[];
}

// Defense-in-depth snippet sanitizer. The server already emits HTML-
// escaped content with only <mark> tags wrapped around tokens, so this
// is a redundant final filter: escape everything, then re-enable the
// two tags we accept. No regex needed for the unescape pass because we
// only re-enable the exact ASCII tag strings.
function sanitizeSnippetToAllowedMarks(html: string): string {
  if (!html) return "";
  const escaped = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Re-enable <mark> and </mark> ONLY. Note: server side already wrote
  // <mark>...</mark>, which became &lt;mark&gt;...&lt;/mark&gt; after
  // the escape pass; we convert THOSE specific token strings back into
  // real tags. Any other escaped tag (e.g., a literal "<script>" that
  // somehow appeared in chunk content) stays escaped and renders as
  // visible text -- the goal.
  return escaped
    .replace(/&lt;mark&gt;/g, "<mark>")
    .replace(/&lt;\/mark&gt;/g, "</mark>");
}

function csrfHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" };
}

interface IndexingStateView {
  kind: "loading" | "ready" | "indexing" | "error" | "absent" | "load-failed";
  errorMessage?: string;
  loadFailure?: string;
}

export function SubmissionSearchTab(
  props: SubmissionSearchTabProps,
): ReactElement {
  const { evaluationId } = props;
  const sidePanel = useSidePanel();
  const panelState = useSidePanelState(evaluationId);

  // Destructure the stable fields off panelState so downstream effects
  // and callbacks can depend on those references directly rather than
  // the whole `panelState` object (which is a fresh object identity each
  // render). This is the Round 2 BLOCKER fix: previously runSearch
  // depended on `panelState`, debounce effect depended on `runSearch`,
  // and the per-render object churn could reschedule the debounce in a
  // loop -- with a valid query, re-firing /submission/search; with an
  // empty query, churning setResults([]).
  //
  // setLastQuery is memoized inside useSidePanelState (see useCallback
  // there); hydrated + lastQueryPerTab are value types so they only
  // change when the underlying state actually changes.
  const { setLastQuery, hydrated, lastQueryPerTab } = panelState;
  const persistedLastSearchQuery = lastQueryPerTab["search-sub"] ?? "";

  // Indexing status state.
  const [indexingState, setIndexingState] = useState<IndexingStateView>({
    kind: "loading",
  });

  // Search controls + results.
  const [query, setQuery] = useState<string>(persistedLastSearchQuery);
  const [results, setResults] = useState<SearchResultRow[]>([]);
  const [uncitedOnly, setUncitedOnly] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [reindexing, setReindexing] = useState<boolean>(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync query when the per-eval persisted last query hydrates from
  // localStorage after mount (panelState.hydrated). We only adopt the
  // hydrated value when the local component state is empty so a user
  // mid-typing is not clobbered.
  useEffect(() => {
    if (!hydrated) return;
    const persisted = lastQueryPerTab["search-sub"] ?? "";
    if (persisted && persisted !== query && !hasSearched) {
      setQuery(persisted);
    }
    // Run only on the hydration edge. lastQueryPerTab + query +
    // hasSearched are intentionally not deps; we only want the hydration
    // boundary, not every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const fetchIndexingStatus = useCallback(async (): Promise<void> => {
    setIndexingState({ kind: "loading" });
    try {
      const res = await fetch(
        `/api/engine-v2/evaluations/${encodeURIComponent(evaluationId)}/indexing-status`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setIndexingState({
          kind: "load-failed",
          loadFailure: body.error ?? `http_${res.status}`,
        });
        return;
      }
      const body = (await res.json()) as IndexingStatusResponse;
      switch (body.status) {
        case "complete":
          setIndexingState({ kind: "ready" });
          return;
        case "pending":
        case "running":
          setIndexingState({ kind: "indexing" });
          return;
        case "error":
          setIndexingState({
            kind: "error",
            errorMessage: body.error_message ?? "unknown_error",
          });
          return;
        case "absent":
          setIndexingState({ kind: "absent" });
          return;
        default:
          setIndexingState({
            kind: "load-failed",
            loadFailure: `unknown_status_${body.status}`,
          });
      }
    } catch (err) {
      setIndexingState({
        kind: "load-failed",
        loadFailure:
          err instanceof Error ? err.message : "network_error",
      });
    }
  }, [evaluationId]);

  useEffect(() => {
    void fetchIndexingStatus();
  }, [fetchIndexingStatus]);

  const runSearch = useCallback(
    async (q: string): Promise<void> => {
      const trimmed = q.trim();
      if (trimmed.length < MIN_QUERY_LEN) {
        // Abort any in-flight valid search and reset the flight state so
        // a stale response can't pass the controller guard below and
        // overwrite the cleared results. Without this, typing back to
        // empty during a search lands the prior valid response.
        if (abortRef.current) {
          abortRef.current.abort();
          abortRef.current = null;
        }
        setIsSearching(false);
        setResults([]);
        setSearchError(null);
        setHasSearched(false);
        return;
      }
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsSearching(true);
      setSearchError(null);
      setHasSearched(true);

      try {
        const params = new URLSearchParams({
          q: trimmed,
          limit: String(RESULT_LIMIT),
        });
        const res = await fetch(
          `/api/engine-v2/evaluations/${encodeURIComponent(evaluationId)}/submission/search?${params.toString()}`,
          { signal: controller.signal },
        );
        const data = (await res.json()) as
          | SearchResponse
          | { error: string };
        // Guard against stale controllers: a newer search may have
        // aborted this one between the await and now. Only mutate
        // state if we are still the most-recent controller.
        if (abortRef.current !== controller) return;
        if (!res.ok) {
          const msg =
            "error" in data && typeof data.error === "string"
              ? data.error
              : "search_failed";
          throw new Error(msg);
        }
        const ok = data as SearchResponse;
        setResults(ok.results);
        // Persist the most recent successful query for cross-tab restore.
        setLastQuery("search-sub", trimmed);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        if (abortRef.current !== controller) return;
        setSearchError(
          err instanceof Error ? err.message : "search_failed",
        );
        setResults([]);
      } finally {
        if (abortRef.current === controller) {
          setIsSearching(false);
        }
      }
    },
    // Stable deps only: evaluationId (string) and setLastQuery
    // (memoized in useSidePanelState). NEVER include the whole
    // panelState object here -- it has a fresh identity every render
    // and that was the Round 2 BLOCKER root cause.
    [evaluationId, setLastQuery],
  );

  // Debounced search-on-change. Only runs when the indexing path is
  // ready (status='complete'); other states keep the input disabled
  // and the debounce timer never fires.
  useEffect(() => {
    if (indexingState.kind !== "ready") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, indexingState.kind, runSearch]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const onSubmit = useCallback(
    (e: React.FormEvent): void => {
      e.preventDefault();
      if (indexingState.kind !== "ready") return;
      // Clear any pending debounce so submit runs exactly once, not
      // once for submit + once for the in-flight debounce tail.
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      void runSearch(query);
    },
    [indexingState.kind, query, runSearch],
  );

  const onRetryReindex = useCallback(async (): Promise<void> => {
    if (reindexing) return;
    setReindexing(true);
    try {
      await fetch(
        `/api/engine-v2/evaluations/${encodeURIComponent(evaluationId)}/reindex`,
        {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify({}),
        },
      );
      // Always re-fetch status regardless of result; the status route
      // is the source of truth and surfaces both success + failure.
      await fetchIndexingStatus();
    } catch {
      // Network failure: re-fetch status anyway so the UI reflects
      // whatever the server last wrote.
      await fetchIndexingStatus();
    } finally {
      setReindexing(false);
    }
  }, [evaluationId, fetchIndexingStatus, reindexing]);

  const onResultClick = useCallback(
    (r: SearchResultRow): void => {
      // The peek panel rendering lives in Phase A scaffolding + Phase E.
      // Phase C wires the call shape; the panel reflects state via the
      // useSidePanel hook downstream.
      if (sidePanel) {
        sidePanel.openPeek({
          evidenceItemId: r.evidence_item_id,
          docSection: r.section,
          pageNum: r.page,
          // content is intentionally null here -- Phase E hydrates
          // from the chunk detail endpoint when the peek panel opens.
          content: null,
        });
        // Lane 2d / Phase E: also fire pendingHighlight so the per-
        // policy results table scrolls + pulses the matching row(s).
        sidePanel.setPendingHighlight({
          evidenceItemId: r.evidence_item_id,
        });
      }
    },
    [sidePanel],
  );

  const inputDisabled = indexingState.kind !== "ready";

  return (
    <div
      data-testid="submission-search-tab"
      className="flex h-full flex-col"
    >
      <form
        onSubmit={onSubmit}
        className="border-b border-slate-200 dark:border-slate-700 p-2"
        aria-label="Submission search"
      >
        <div className="flex items-center gap-2">
          <Search
            className="w-4 h-4 text-slate-400 flex-shrink-0"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) =>
              setQuery(e.target.value.slice(0, MAX_QUERY_LEN))
            }
            disabled={inputDisabled}
            placeholder="Search submission..."
            aria-label="Search submission text"
            data-testid="submission-search-input"
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
          />
          {isSearching && (
            <Loader2
              data-testid="submission-search-spinner"
              className="w-4 h-4 animate-spin text-slate-400"
              aria-hidden="true"
            />
          )}
        </div>
        {indexingState.kind === "ready" && (
          <label
            className="mt-1.5 flex items-center gap-1.5 cursor-pointer select-none"
            data-testid="submission-search-uncited-toggle-label"
          >
            <input
              type="checkbox"
              checked={uncitedOnly}
              onChange={(e) => setUncitedOnly(e.target.checked)}
              data-testid="submission-search-uncited-toggle"
              className="w-3 h-3 rounded accent-indigo-600"
              aria-label="Show uncited chunks only"
            />
            <span className="text-[10px] text-slate-600 dark:text-slate-400">
              Uncited chunks only
            </span>
          </label>
        )}
      </form>

      <div className="flex-1 overflow-y-auto">
        {indexingState.kind === "loading" && (
          <div
            data-testid="submission-search-status-loading"
            className="p-4 text-sm text-slate-500 dark:text-slate-400"
          >
            <Loader2 className="w-4 h-4 inline-block animate-spin mr-2" />
            Checking submission index...
          </div>
        )}

        {indexingState.kind === "load-failed" && (
          <div
            data-testid="submission-search-status-load-failed"
            className="p-4 text-sm text-rose-600 dark:text-rose-400"
            role="alert"
          >
            <AlertTriangle className="w-4 h-4 inline-block mr-2" />
            Could not load indexing status (
            {indexingState.loadFailure ?? "unknown"}).
            <button
              type="button"
              onClick={() => void fetchIndexingStatus()}
              className="ml-2 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Retry
            </button>
          </div>
        )}

        {indexingState.kind === "indexing" && (
          <div
            data-testid="submission-search-status-indexing"
            className="p-4 text-sm text-slate-500 dark:text-slate-400"
          >
            <Loader2 className="w-4 h-4 inline-block animate-spin mr-2" />
            Indexing submission for search...
          </div>
        )}

        {indexingState.kind === "absent" && (
          <div
            data-testid="submission-search-status-absent"
            className="p-4 text-xs text-slate-500 dark:text-slate-400"
          >
            No indexed chunks yet -- re-evaluate to enable search.
          </div>
        )}

        {indexingState.kind === "error" && (
          <div
            data-testid="submission-search-status-error"
            className="p-4 text-sm"
            role="alert"
          >
            <div className="flex items-start gap-2 text-rose-700 dark:text-rose-400">
              <AlertTriangle
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="font-medium">
                  Search unavailable: indexing failed
                </p>
                {indexingState.errorMessage && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {indexingState.errorMessage}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void onRetryReindex()}
                  disabled={reindexing}
                  data-testid="submission-search-retry-button"
                  className="mt-2 inline-flex items-center gap-1 rounded border border-rose-300 dark:border-rose-700 px-2 py-1 text-xs font-medium hover:bg-rose-50 dark:hover:bg-rose-900/30 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <RefreshCw
                    className={
                      "w-3 h-3 " + (reindexing ? "animate-spin" : "")
                    }
                    aria-hidden="true"
                  />
                  {reindexing ? "Retrying..." : "Retry indexing"}
                </button>
              </div>
            </div>
          </div>
        )}

        {indexingState.kind === "ready" && (
          <SubmissionSearchResults
            results={results}
            uncitedOnly={uncitedOnly}
            isSearching={isSearching}
            hasSearched={hasSearched}
            searchError={searchError}
            onResultClick={onResultClick}
          />
        )}
      </div>
    </div>
  );
}

interface SubmissionSearchResultsProps {
  results: SearchResultRow[];
  uncitedOnly: boolean;
  isSearching: boolean;
  hasSearched: boolean;
  searchError: string | null;
  onResultClick: (r: SearchResultRow) => void;
}

function SubmissionSearchResults(
  props: SubmissionSearchResultsProps,
): ReactElement {
  const { results, uncitedOnly, isSearching, hasSearched, searchError, onResultClick } =
    props;

  // Client-side filter: when uncitedOnly is true, show only chunks not cited
  // by any policy verdict. cited_by_count === 0 means the AI did not reference
  // this chunk in any policy verdict, so the owner can spot missed evidence.
  const displayResults = useMemo(
    () =>
      uncitedOnly ? results.filter((r) => r.cited_by_count === 0) : results,
    [results, uncitedOnly],
  );

  if (searchError) {
    return (
      <div
        data-testid="submission-search-error"
        className="p-4 text-sm text-rose-600 dark:text-rose-400"
        role="alert"
      >
        <AlertTriangle className="w-4 h-4 inline-block mr-2" />
        Search failed: {searchError}
      </div>
    );
  }

  if (isSearching && results.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
        Searching...
      </div>
    );
  }

  if (hasSearched && results.length === 0) {
    return (
      <div
        data-testid="submission-search-empty"
        className="p-4 text-sm text-slate-500 dark:text-slate-400"
      >
        No matches for that query.
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="p-4 text-xs text-slate-500 dark:text-slate-400">
        Enter at least 2 characters to search the submission.
      </div>
    );
  }

  if (displayResults.length === 0) {
    // All results exist but were hidden by the uncited-only filter.
    return (
      <div
        data-testid="submission-search-uncited-empty"
        className="p-4 text-sm text-slate-500 dark:text-slate-400"
      >
        All {results.length} result
        {results.length === 1 ? "" : "s"} already cited by a policy verdict.
      </div>
    );
  }

  return (
    <ul
      data-testid="submission-search-results"
      className="divide-y divide-slate-100 dark:divide-slate-800"
    >
      {displayResults.map((r) => (
        <SubmissionSearchResultRow
          key={r.evidence_item_id}
          row={r}
          onClick={() => onResultClick(r)}
        />
      ))}
    </ul>
  );
}

interface SubmissionSearchResultRowProps {
  row: SearchResultRow;
  onClick: () => void;
}

function SubmissionSearchResultRow(
  props: SubmissionSearchResultRowProps,
): ReactElement {
  const { row, onClick } = props;
  const sanitized = useMemo(
    () => sanitizeSnippetToAllowedMarks(row.snippet),
    [row.snippet],
  );
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        data-testid="submission-search-result"
        data-evidence-item-id={row.evidence_item_id}
        className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <p
          className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-600/40 [&_mark]:rounded-sm [&_mark]:px-0.5"
          // The snippet is sanitized to an allowlist that permits only
          // <mark> tags; see sanitizeSnippetToAllowedMarks. The server
          // also HTML-escapes the haystack before inserting marks, so
          // the round-trip leaves only the two tags we accept.
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
          <span data-testid="submission-search-result-breadcrumb">
            {row.section}
            {row.page !== null ? ` - p.${row.page}` : ""}
          </span>
          {row.indigenous_flagged && (
            <span
              data-testid="submission-search-indigenous-badge"
              className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 font-medium"
              title="Content references Indigenous uses (gardens, hunting, fishing, medicines)"
            >
              Indigenous uses content
            </span>
          )}
          {row.cited_by_count > 0 && (
            <span
              data-testid="submission-search-cited-by-badge"
              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium"
            >
              Cited by {row.cited_by_count} polic
              {row.cited_by_count === 1 ? "y" : "ies"}
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

export default SubmissionSearchTab;
