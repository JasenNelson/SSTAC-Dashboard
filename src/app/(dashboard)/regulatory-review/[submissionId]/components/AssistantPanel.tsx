'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Loader2,
  AlertCircle,
  Wifi,
  WifiOff,
  Trash2,
  Zap,
  Brain,
  Database,
  FileText,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Citation {
  type: 'policy' | 'submission';
  id: string;
  text: string;
  source?: string;
}

interface MessageMeta {
  model: string;
  mode: string;
  retrievalCount: number;
  durationMs: number;
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  meta?: MessageMeta;
}

interface AssistantPanelProps {
  submissionId?: string;
}

type Scope = 'policy' | 'submission' | 'hybrid';
type Mode = 'fast' | 'deep';
type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

// ============================================================================
// Citation list sub-component
// ============================================================================

function CitationList({ citations }: { citations: Citation[] }) {
  const [expanded, setExpanded] = useState(false);

  if (citations.length === 0) return null;

  return (
    <div className="mt-1.5 border-t border-gray-100 dark:border-gray-700 pt-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {citations.length} source{citations.length !== 1 ? 's' : ''} cited
      </button>
      {expanded && (
        <div className="mt-1 space-y-1">
          {citations.map((c, i) => (
            <div
              key={`${c.id}-${i}`}
              className="flex items-start gap-1.5 text-[10px] p-1.5 bg-gray-50 dark:bg-gray-800 rounded"
            >
              {c.type === 'policy' ? (
                <Database className="w-3 h-3 text-indigo-500 mt-0.5 flex-shrink-0" />
              ) : (
                <FileText className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {c.id}
                </span>
                {c.source && (
                  <span className="text-gray-400 dark:text-gray-500 ml-1">
                    ({c.source})
                  </span>
                )}
                <p className="text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                  {c.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

let nextMsgId = 0;

export default function AssistantPanel({ submissionId }: AssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('fast');
  const [scope, setScope] = useState<Scope>('hybrid');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('checking');
  const [modelInfo, setModelInfo] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Check Ollama connection on mount
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const resp = await fetch('/api/regulatory-review/assistant/models');
        if (cancelled) return;

        if (!resp.ok) {
          setConnectionStatus('disconnected');
          if (resp.status === 401) setError('Authentication required');
          else if (resp.status === 403) setError('Admin access required');
          else if (resp.status === 503) setError('Local engine not enabled');
          return;
        }

        const data = await resp.json();
        if (cancelled) return;

        if (data.error || !data.models?.length) {
          setConnectionStatus('disconnected');
          setError(data.error || 'No Ollama models available');
        } else {
          setConnectionStatus('connected');
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setConnectionStatus('disconnected');
          setError('Failed to check connection');
        }
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  // Abort in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Auto-scroll on new content
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    if (!submissionId) {
      setError('No submission selected');
      return;
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: ++nextMsgId,
      role: 'user',
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);
    setError(null);

    // Build history from existing messages (last 10 turns)
    const history = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Add placeholder assistant message for streaming
    const assistantId = ++nextMsgId;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', citations: [] },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch('/api/regulatory-review/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          query: trimmed,
          scope,
          mode,
          history,
        }),
        signal: controller.signal,
      });

      // HTTP-level errors (guards: 401, 403, 503; validation: 400)
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.error || `Request failed (${resp.status})`);
      }

      if (!resp.body) {
        throw new Error('No response stream');
      }

      // Parse SSE stream
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const citations: Citation[] = [];

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.trim()) continue;

          let eventType = '';
          let eventData = '';

          for (const line of part.split('\n')) {
            if (line.startsWith('event: ')) eventType = line.slice(7);
            if (line.startsWith('data: ')) eventData = line.slice(6);
          }

          if (!eventType || !eventData) continue;

          try {
            const parsed = JSON.parse(eventData);

            switch (eventType) {
              case 'delta':
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + parsed.text,
                    };
                  }
                  return updated;
                });
                break;

              case 'citation':
                citations.push(parsed as Citation);
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      citations: [...citations],
                    };
                  }
                  return updated;
                });
                break;

              case 'meta':
                setModelInfo(
                  `${parsed.model} · ${(parsed.durationMs / 1000).toFixed(1)}s`
                );
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, meta: parsed };
                  }
                  return updated;
                });
                break;

              case 'error':
                setError(parsed.message);
                break;

              case 'done':
                break;
            }
          } catch {
            // Skip malformed SSE events
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg =
          err instanceof Error ? err.message : 'Failed to send message';
        setError(msg);
        // Remove empty placeholder assistant message on failure
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && !last.content) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, messages, mode, scope, submissionId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const inputDisabled =
    connectionStatus === 'disconnected' || isStreaming;

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="space-y-2 mb-3">
        {/* Connection status + clear button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs">
            {connectionStatus === 'checking' ? (
              <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
            ) : connectionStatus === 'connected' ? (
              <Wifi className="w-3 h-3 text-green-500" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-500" />
            )}
            <span
              className={
                connectionStatus === 'connected'
                  ? 'text-green-600 dark:text-green-400'
                  : connectionStatus === 'checking'
                    ? 'text-gray-400'
                    : 'text-red-600 dark:text-red-400'
              }
            >
              {connectionStatus === 'connected'
                ? 'Ollama connected'
                : connectionStatus === 'checking'
                  ? 'Checking...'
                  : 'Ollama not connected'}
            </span>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 transition-colors"
              title="Clear conversation"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {/* Mode toggle: fast / deep */}
        <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-md">
          <button
            onClick={() => setMode('fast')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
              mode === 'fast'
                ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Zap className="w-3 h-3" />
            Fast
          </button>
          <button
            onClick={() => setMode('deep')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
              mode === 'deep'
                ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            title="Uses a larger model for more thorough analysis"
          >
            <Brain className="w-3 h-3" />
            Deep
          </button>
        </div>

        {/* Scope selector */}
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as Scope)}
          aria-label="Search scope"
          className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <option value="hybrid">Both: Policy + Submission</option>
          <option value="policy">Policy Database Only</option>
          <option value="submission">Submission Evidence Only</option>
        </select>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 p-2 mb-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Chat thread */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {messages.length === 0 && !error && (
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-2 py-4">
            <p className="font-medium text-gray-600 dark:text-gray-300">
              Ask the assistant about:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Policy requirements for this submission</li>
              <li>What evidence is needed for a specific topic</li>
              <li>How submission findings relate to regulations</li>
              <li>Gaps between evidence and requirements</li>
            </ul>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-3 italic">
              The assistant retrieves and summarizes — it does not make adequacy
              determinations.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-xs rounded-lg p-2.5 ${
              msg.role === 'user'
                ? 'bg-indigo-50 dark:bg-indigo-900/20'
                : 'bg-gray-50 dark:bg-gray-800/50'
            }`}
          >
            {/* Role label + meta */}
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide ${
                  msg.role === 'user'
                    ? 'text-indigo-500 dark:text-indigo-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {msg.role === 'user' ? 'You' : 'Assistant'}
              </span>
              {msg.meta && (
                <span className="text-[9px] text-gray-400 dark:text-gray-500">
                  {msg.meta.model} · {(msg.meta.durationMs / 1000).toFixed(1)}s
                  · {msg.meta.retrievalCount} sources
                </span>
              )}
            </div>

            {/* Content */}
            <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {msg.content}
              {/* Thinking indicator (empty assistant message) */}
              {isStreaming &&
                msg.role === 'assistant' &&
                msg.id === messages[messages.length - 1]?.id &&
                !msg.content && (
                  <span className="inline-flex items-center gap-1 text-gray-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Thinking...
                  </span>
                )}
              {/* Streaming cursor */}
              {isStreaming &&
                msg.role === 'assistant' &&
                msg.id === messages[messages.length - 1]?.id &&
                msg.content && (
                  <span className="inline-block w-1.5 h-3.5 bg-emerald-500 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                )}
            </div>

            {/* Citations */}
            {msg.citations && msg.citations.length > 0 && (
              <CitationList citations={msg.citations} />
            )}
          </div>
        ))}

        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <label htmlFor="assistant-input" className="sr-only">
            Ask the assistant
          </label>
          <textarea
            id="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              connectionStatus === 'disconnected'
                ? 'Ollama required — not connected'
                : 'Ask about policies or submission evidence...'
            }
            disabled={inputDisabled}
            rows={1}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          />
          <button
            onClick={sendMessage}
            disabled={inputDisabled || !input.trim()}
            className="px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            title="Send message"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        {modelInfo && (
          <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1 text-right">
            {modelInfo}
          </p>
        )}
      </div>
    </div>
  );
}
