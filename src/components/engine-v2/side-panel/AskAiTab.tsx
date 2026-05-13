// engine_v2 frontend Lane 2d / Phase D: Ask AI tab.
//
// Live SSE chat over the structured submission. Two modes (fast /
// thinking) drive the system prompt + Ollama model via the
// chat-prompts.ts and chat-model-registry.ts scaffolding files. The
// route is /api/engine-v2/evaluations/[evalId]/chat (POST, SSE).
//
// State machine on mount (same pattern as Phase C SubmissionSearchTab):
//   - loading -> probing /indexing-status.
//   - ready (status='complete') -> input enabled, can chat.
//   - indexing (status='pending'|'running') -> placeholder, input
//     disabled.
//   - error (status='error') -> retry CTA that POSTs /reindex.
//   - absent (status='absent') -> "no chunks indexed yet" hint.
//   - load-failed -> retry the status fetch.
//
// SCOPE LOCK (feedback_no_tier_judgment_for_ai, 2026-05-12, HIGH
// AUTHORITY): the chat surface is an evidence-finder for the human
// reviewer. Indigenous-flagged citations render a NEUTRAL content-type
// badge "Indigenous uses content" (pathway-relevance signal); the chat
// itself proceeds normally for all queries. No hard-stop, no
// procedural-gate language, no client-side output filter.
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
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  Send,
  StopCircle,
} from "lucide-react";

import { useSidePanel } from "./SidePanelContext";
import { useSidePanelState } from "./useSidePanelState";

export interface AskAiTabProps {
  evaluationId: string;
}

const MIN_QUERY_LEN = 1;
const MAX_QUERY_LEN = 4_000;

type IndexingStatus =
  | "pending"
  | "running"
  | "complete"
  | "error"
  | "absent";

interface IndexingStatusResponse {
  status: IndexingStatus;
  error_message?: string | null;
}

interface IndexingStateView {
  kind: "loading" | "ready" | "indexing" | "error" | "absent" | "load-failed";
  errorMessage?: string;
  loadFailure?: string;
}

interface ChunkCitation {
  type: "chunk";
  evidence_item_id: string;
  source_chunk_id: string | null;
  section: string;
  page: number | null;
  snippet: string;
  indigenous_flagged: boolean;
  rank?: number;
}

interface PolicyCitation {
  type: "policy";
  policy_id: string;
  excerpt: string;
  source: string | null;
}

type Citation = ChunkCitation | PolicyCitation;

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  error?: string | null;
  isStreaming?: boolean;
}

interface ModelStatusEntry {
  model_id: string;
  available: boolean;
}

interface ModelStatusResponse {
  fast: ModelStatusEntry;
  thinking: ModelStatusEntry;
}

function csrfHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" };
}

function randomId(): string {
  // Stable enough for React keys in this surface; not security-sensitive.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AskAiTab(props: AskAiTabProps): ReactElement {
  const { evaluationId } = props;
  const sidePanel = useSidePanel();
  const panelState = useSidePanelState(evaluationId);
  const { chatMode, setChatMode } = panelState;

  const [indexingState, setIndexingState] = useState<IndexingStateView>({
    kind: "loading",
  });
  const [reindexing, setReindexing] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatusResponse | null>(
    null,
  );
  const [modelStatusError, setModelStatusError] = useState<string | null>(
    null,
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // --- indexing-status probe ---

  const fetchIndexingStatus = useCallback(async (): Promise<void> => {
    setIndexingState({ kind: "loading" });
    try {
      const res = await fetch(
        `/api/engine-v2/evaluations/${encodeURIComponent(evaluationId)}/indexing-status`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
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
        loadFailure: err instanceof Error ? err.message : "network_error",
      });
    }
  }, [evaluationId]);

  useEffect(() => {
    void fetchIndexingStatus();
  }, [fetchIndexingStatus]);

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
      await fetchIndexingStatus();
    } catch {
      await fetchIndexingStatus();
    } finally {
      setReindexing(false);
    }
  }, [evaluationId, fetchIndexingStatus, reindexing]);

  // --- model status probe ---

  const fetchModelStatus = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(
        `/api/engine-v2/evaluations/${encodeURIComponent(evaluationId)}/chat/models`,
      );
      if (!res.ok) {
        setModelStatusError(`models_http_${res.status}`);
        return;
      }
      const body = (await res.json()) as ModelStatusResponse;
      setModelStatus(body);
      setModelStatusError(null);
    } catch (err) {
      setModelStatusError(err instanceof Error ? err.message : "models_failed");
    }
  }, [evaluationId]);

  useEffect(() => {
    void fetchModelStatus();
  }, [fetchModelStatus]);

  // --- send / streaming ---

  const cancelStreaming = useCallback((): void => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const send = useCallback(
    async (raw: string): Promise<void> => {
      const trimmed = raw.trim();
      if (trimmed.length < MIN_QUERY_LEN) return;
      if (indexingState.kind !== "ready") return;
      if (isStreaming) return;

      // Snapshot history BEFORE adding the new user turn so we send the
      // prior turns only.
      const historyPayload = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-10);

      const userTurn: ChatMessage = {
        id: randomId(),
        role: "user",
        content: trimmed,
      };
      const assistantTurn: ChatMessage = {
        id: randomId(),
        role: "assistant",
        content: "",
        citations: [],
        isStreaming: true,
      };
      setMessages((prev) => [...prev, userTurn, assistantTurn]);
      setInput("");
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/engine-v2/evaluations/${encodeURIComponent(evaluationId)}/chat`,
          {
            method: "POST",
            headers: csrfHeaders(),
            body: JSON.stringify({
              query: trimmed.slice(0, MAX_QUERY_LEN),
              mode: chatMode,
              history: historyPayload,
            }),
            signal: controller.signal,
          },
        );
        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantTurn.id
                ? {
                    ...m,
                    isStreaming: false,
                    error: `chat_http_${res.status}: ${text || res.statusText}`,
                  }
                : m,
            ),
          );
          return;
        }

        await readSseStream(res.body, (event, data) => {
          if (event === "citation") {
            const cit = data as Citation;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantTurn.id
                  ? { ...m, citations: [...(m.citations ?? []), cit] }
                  : m,
              ),
            );
          } else if (event === "delta") {
            const text = (data as { text?: string }).text ?? "";
            if (text.length > 0) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantTurn.id
                    ? { ...m, content: m.content + text }
                    : m,
                ),
              );
            }
          } else if (event === "error") {
            const msg =
              (data as { message?: string }).message ?? "stream_error";
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantTurn.id
                  ? { ...m, error: msg, isStreaming: false }
                  : m,
              ),
            );
          }
        });
      } catch (err) {
        const aborted = (err as { name?: string }).name === "AbortError";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantTurn.id
              ? {
                  ...m,
                  isStreaming: false,
                  error: aborted
                    ? "Cancelled."
                    : err instanceof Error
                      ? err.message
                      : "chat_failed",
                }
              : m,
          ),
        );
      } finally {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantTurn.id
              ? { ...m, isStreaming: false }
              : m,
          ),
        );
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsStreaming(false);
      }
    },
    [evaluationId, chatMode, indexingState.kind, isStreaming, messages],
  );

  const onSubmit = useCallback(
    (e: React.FormEvent): void => {
      e.preventDefault();
      void send(input);
    },
    [input, send],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void send(input);
      }
    },
    [input, send],
  );

  const onCitationClick = useCallback(
    (cit: Citation): void => {
      if (cit.type !== "chunk") return;
      if (!sidePanel) return;
      sidePanel.openPeek({
        evidenceItemId: cit.evidence_item_id,
        sourceChunkId: cit.source_chunk_id,
        docSection: cit.section,
        pageNum: cit.page,
        content: null,
      });
    },
    [sidePanel],
  );

  // Auto-scroll on new content. Guarded for jsdom (no scrollIntoView).
  useEffect(() => {
    const el = messagesEndRef.current;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  const inputDisabled =
    indexingState.kind !== "ready" || isStreaming;

  return (
    <div
      data-testid="ask-ai-tab"
      data-chat-mode={chatMode}
      className="flex h-full flex-col"
    >
      <AskAiHeader
        chatMode={chatMode}
        onChangeMode={(m) => setChatMode(m)}
        modelStatus={modelStatus}
        modelStatusError={modelStatusError}
        disabled={isStreaming}
      />

      <div className="flex-1 overflow-y-auto">
        {indexingState.kind === "loading" && (
          <div
            data-testid="ask-ai-status-loading"
            className="p-4 text-sm text-slate-500 dark:text-slate-400"
          >
            <Loader2 className="w-4 h-4 inline-block animate-spin mr-2" />
            Checking submission index...
          </div>
        )}

        {indexingState.kind === "load-failed" && (
          <div
            data-testid="ask-ai-status-load-failed"
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
            data-testid="ask-ai-status-indexing"
            className="p-4 text-sm text-slate-500 dark:text-slate-400"
          >
            <Loader2 className="w-4 h-4 inline-block animate-spin mr-2" />
            Indexing submission for search...
          </div>
        )}

        {indexingState.kind === "absent" && (
          <div
            data-testid="ask-ai-status-absent"
            className="p-4 text-xs text-slate-500 dark:text-slate-400"
          >
            No chunks indexed yet -- re-evaluate to enable chat.
          </div>
        )}

        {indexingState.kind === "error" && (
          <div
            data-testid="ask-ai-status-error"
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
                  Chat unavailable: indexing failed
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
                  data-testid="ask-ai-retry-button"
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
          <AskAiMessages
            messages={messages}
            onCitationClick={onCitationClick}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-slate-200 dark:border-slate-700 p-2"
        aria-label="Ask AI input"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) =>
              setInput(e.target.value.slice(0, MAX_QUERY_LEN))
            }
            onKeyDown={onKeyDown}
            disabled={inputDisabled}
            placeholder={
              indexingState.kind === "ready"
                ? "Ask about evidence in the submission..."
                : "Submission not ready for chat yet."
            }
            rows={2}
            aria-label="Ask AI question"
            data-testid="ask-ai-input"
            className="flex-1 resize-none bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 border border-slate-200 dark:border-slate-700 rounded p-2"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={cancelStreaming}
              data-testid="ask-ai-cancel-button"
              aria-label="Cancel response"
              className="flex-shrink-0 p-2 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <StopCircle className="w-5 h-5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={inputDisabled || input.trim().length === 0}
              data-testid="ask-ai-send-button"
              aria-label="Send"
              className="flex-shrink-0 p-2 rounded text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Send className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// --- subcomponents ---

interface AskAiHeaderProps {
  chatMode: "fast" | "thinking";
  onChangeMode: (mode: "fast" | "thinking") => void;
  modelStatus: ModelStatusResponse | null;
  modelStatusError: string | null;
  disabled: boolean;
}

function AskAiHeader(props: AskAiHeaderProps): ReactElement {
  const { chatMode, onChangeMode, modelStatus, modelStatusError, disabled } =
    props;
  return (
    <div className="border-b border-slate-200 dark:border-slate-700 p-2 space-y-2">
      <div
        role="radiogroup"
        aria-label="Chat mode"
        data-testid="ask-ai-mode-selector"
        className="inline-flex rounded border border-slate-200 dark:border-slate-700 overflow-hidden"
      >
        <ModeButton
          mode="fast"
          active={chatMode === "fast"}
          onClick={() => onChangeMode("fast")}
          disabled={disabled}
        />
        <ModeButton
          mode="thinking"
          active={chatMode === "thinking"}
          onClick={() => onChangeMode("thinking")}
          disabled={disabled}
        />
      </div>

      <div
        data-testid="ask-ai-model-status"
        className="flex flex-wrap items-center gap-2 text-[10px]"
      >
        {modelStatusError !== null && (
          <span
            data-testid="ask-ai-model-status-error"
            className="text-rose-600 dark:text-rose-400"
          >
            Model status unavailable ({modelStatusError}).
          </span>
        )}
        {modelStatus && (
          <>
            <ModelChip label="Fast" entry={modelStatus.fast} testid="fast" />
            <ModelChip
              label="Thinking"
              entry={modelStatus.thinking}
              testid="thinking"
            />
          </>
        )}
      </div>
    </div>
  );
}

interface ModeButtonProps {
  mode: "fast" | "thinking";
  active: boolean;
  onClick: () => void;
  disabled: boolean;
}

function ModeButton(props: ModeButtonProps): ReactElement {
  const { mode, active, onClick, disabled } = props;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      disabled={disabled}
      data-testid={`ask-ai-mode-${mode}`}
      className={
        "px-3 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
        (active
          ? "bg-indigo-600 text-white"
          : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800")
      }
    >
      {mode === "fast" ? "Fast" : "Thinking"}
    </button>
  );
}

interface ModelChipProps {
  label: string;
  entry: ModelStatusEntry;
  testid: string;
}

function ModelChip(props: ModelChipProps): ReactElement {
  const { label, entry, testid } = props;
  return (
    <span
      data-testid={`ask-ai-model-chip-${testid}`}
      data-available={entry.available ? "true" : "false"}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
    >
      <span
        aria-hidden="true"
        className={
          "inline-block w-2 h-2 rounded-full " +
          (entry.available ? "bg-emerald-500" : "bg-rose-500")
        }
      />
      <span>
        {label}: {entry.model_id}
      </span>
    </span>
  );
}

interface AskAiMessagesProps {
  messages: ChatMessage[];
  onCitationClick: (cit: Citation) => void;
}

function AskAiMessages(props: AskAiMessagesProps): ReactElement {
  const { messages, onCitationClick } = props;
  if (messages.length === 0) {
    return (
      <div className="p-4 text-xs text-slate-500 dark:text-slate-400">
        Ask the assistant to find evidence in the submission. The reviewer
        makes the final call; the assistant cites what the submission says.
      </div>
    );
  }
  return (
    <ul
      data-testid="ask-ai-messages"
      className="divide-y divide-slate-100 dark:divide-slate-800"
    >
      {messages.map((m) => (
        <AskAiMessageRow
          key={m.id}
          message={m}
          onCitationClick={onCitationClick}
        />
      ))}
    </ul>
  );
}

interface AskAiMessageRowProps {
  message: ChatMessage;
  onCitationClick: (cit: Citation) => void;
}

function AskAiMessageRow(props: AskAiMessageRowProps): ReactElement {
  const { message, onCitationClick } = props;
  const isUser = message.role === "user";
  return (
    <li
      data-testid={`ask-ai-message-${message.role}`}
      className={
        "px-3 py-2 " + (isUser ? "text-right" : "text-left")
      }
    >
      <div
        className={
          "inline-block max-w-[90%] rounded px-2 py-1 text-sm " +
          (isUser
            ? "bg-indigo-50 dark:bg-indigo-900/30 text-slate-800 dark:text-slate-100"
            : "bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100")
        }
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.isStreaming && (
          <span
            data-testid="ask-ai-streaming-cursor"
            aria-hidden="true"
            className="inline-block w-1 h-3 ml-1 bg-slate-400 dark:bg-slate-500 animate-pulse"
          />
        )}
        {message.error && (
          <p
            data-testid="ask-ai-message-error"
            className="mt-1 text-xs text-rose-600 dark:text-rose-400"
            role="alert"
          >
            {message.error}
          </p>
        )}
        {!isUser && message.citations && message.citations.length > 0 && (
          <CitationPills
            citations={message.citations}
            onClick={onCitationClick}
          />
        )}
      </div>
    </li>
  );
}

interface CitationPillsProps {
  citations: Citation[];
  onClick: (cit: Citation) => void;
}

function CitationPills(props: CitationPillsProps): ReactElement {
  const { citations, onClick } = props;
  const chunks = useMemo(
    () => citations.filter((c): c is ChunkCitation => c.type === "chunk"),
    [citations],
  );
  const policies = useMemo(
    () => citations.filter((c): c is PolicyCitation => c.type === "policy"),
    [citations],
  );
  return (
    <div
      data-testid="ask-ai-citations"
      className="mt-2 flex flex-wrap gap-1"
    >
      {chunks.map((c, i) => (
        <button
          key={`chunk-${c.evidence_item_id}-${i}`}
          type="button"
          onClick={() => onClick(c)}
          data-testid="ask-ai-citation-chunk"
          data-evidence-item-id={c.evidence_item_id}
          title={`${c.section}${c.page !== null ? " - p." + c.page : ""}`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span>S{i + 1}</span>
          <span className="text-slate-500 dark:text-slate-400">
            {c.section}
            {c.page !== null ? ` p.${c.page}` : ""}
          </span>
          {c.indigenous_flagged && (
            <span
              data-testid="ask-ai-citation-indigenous-badge"
              className="ml-1 px-1 rounded bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300"
              title="Content references Indigenous uses (gardens, hunting, fishing, medicines)"
            >
              Indigenous uses content
            </span>
          )}
        </button>
      ))}
      {policies.map((p, i) => (
        <span
          key={`policy-${p.policy_id}-${i}`}
          data-testid="ask-ai-citation-policy"
          data-policy-id={p.policy_id}
          title={p.source ?? "source unknown"}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
        >
          P{i + 1} {p.policy_id}
        </span>
      ))}
    </div>
  );
}

// --- SSE reader ---

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: unknown) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE frames are separated by a blank line.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const trimmed = frame.trim();
        if (!trimmed) continue;
        let eventName = "message";
        let dataLine = "";
        for (const line of trimmed.split("\n")) {
          if (line.startsWith("event:")) {
            eventName = line.slice("event:".length).trim();
          } else if (line.startsWith("data:")) {
            dataLine += line.slice("data:".length).trim();
          }
        }
        if (!dataLine) continue;
        try {
          const data = JSON.parse(dataLine) as unknown;
          onEvent(eventName, data);
        } catch {
          // Skip malformed SSE frame.
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

export default AskAiTab;
