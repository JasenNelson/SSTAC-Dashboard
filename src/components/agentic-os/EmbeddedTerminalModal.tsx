'use client';

// Step 9 / Pattern E: embedded xterm.js modal.
//
// Lifecycle (per open):
//   1. POST /api/agentic-os/pty-token { project, action: 'open_embedded' }
//   2. On 200 -> open ws://localhost:<port>/pty?token=<jwt>
//   3. Initialize xterm.js + fit/web-links addons. WS messages -> term.write,
//      term.onData -> ws.send. Resize observer sends {type:'resize',cols,rows}
//      JSON envelopes through the WS.
//   4. On WS close or {type:'exit'} envelope -> footer shows "session ended".
//      Modal stays open until the user dismisses; no auto-close so the user
//      can read the final output.
//
// xterm.js is dynamically imported inside useEffect so the SSR pass and the
// initial client bundle stay lean (xterm + addons add ~300KB ungzipped).
// node-pty is NEVER imported here -- the browser never touches native code.
//
// Mockup reference: .tmp_presentation/design_mockups/style1_linear_terminals.html
// (search for id="terminal-modal" -- macOS traffic-light chrome on the left,
// footer with session id + connection state + line/byte counts).

import { useEffect, useRef, useState, useCallback } from 'react';
// Bundle xterm's default stylesheet at module load. Next.js handles CSS
// imports from node_modules through its global CSS pipeline. The styles
// are only pulled into the page where this component is imported (the
// modal is mounted conditionally, so the cost is paid only when used).
import '@xterm/xterm/css/xterm.css';

export interface EmbeddedTerminalModalProps {
  /** Allowlisted project name -- passed straight through to /api/agentic-os/pty-token. */
  project: string;
  /** Close handler -- parent removes the modal from the tree. */
  onClose: () => void;
}

type ConnectionState =
  | 'minting_token'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'failed';

interface TokenMintResponse {
  runId: string;
  token: string;
  port: number;
  status: string;
}

export default function EmbeddedTerminalModal({
  project,
  onClose,
}: EmbeddedTerminalModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // termRef holds the xterm.js Terminal instance once dynamically imported.
  // Typed loosely because we don't import the type at compile time (the
  // module is lazy-loaded inside useEffect).
  const termRef = useRef<{
    write: (s: string) => void;
    onData: (cb: (data: string) => void) => { dispose: () => void };
    dispose: () => void;
    open: (el: HTMLElement) => void;
    loadAddon: (addon: unknown) => void;
    cols: number;
    rows: number;
  } | null>(null);
  const fitAddonRef = useRef<{ fit: () => void; dispose?: () => void } | null>(null);
  const [state, setState] = useState<ConnectionState>('minting_token');
  const [runId, setRunId] = useState<string | null>(null);
  const [exitInfo, setExitInfo] = useState<{ code: number | null } | null>(null);
  const [lines, setLines] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // Send a resize envelope to the PTY server.
  const sendResize = useCallback(() => {
    const ws = wsRef.current;
    const term = termRef.current;
    if (!ws || !term) return;
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(
        JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }),
      );
    } catch {
      // best effort
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let resizeObs: ResizeObserver | null = null;

    (async () => {
      try {
        // Step 1: mint token.
        const tokenResp = await fetch('/api/agentic-os/pty-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ project, action: 'open_embedded' }),
        });
        if (!tokenResp.ok) {
          let detail = '';
          try {
            const j = await tokenResp.json();
            detail = j.error
              ? `${j.error}${j.detail ? ': ' + j.detail : ''}`
              : '';
          } catch {
            // ignore
          }
          if (!cancelled) {
            setState('failed');
            setErrorDetail(
              `Token mint failed (${tokenResp.status})${detail ? ': ' + detail : ''}`,
            );
          }
          return;
        }
        const body = (await tokenResp.json()) as TokenMintResponse;
        if (cancelled) return;
        setRunId(body.runId);

        // Step 2: dynamic-import xterm.js + addons. Keeps the route-level
        // bundle lean for users who never open the modal.
        const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
          import('@xterm/addon-web-links'),
        ]);
        // xterm.css is imported at module top-level (bundled by Next.js).
        if (!containerRef.current || cancelled) return;
        const term = new Terminal({
          cols: 80,
          rows: 24,
          fontFamily: 'Menlo, Consolas, "Courier New", monospace',
          fontSize: 13,
          theme: {
            background: '#0A0A0A',
            foreground: '#e5e5e5',
            cursor: '#22d3ee',
          },
        });
        const fitAddon = new FitAddon();
        const webLinks = new WebLinksAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(webLinks);
        term.open(containerRef.current);
        try { fitAddon.fit(); } catch { /* ignore */ }
        termRef.current = term as unknown as typeof termRef.current;
        fitAddonRef.current = fitAddon;

        // Step 3: open WS.
        setState('connecting');
        const ws = new WebSocket(
          `ws://localhost:${body.port}/pty?token=${encodeURIComponent(body.token)}`,
        );
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.addEventListener('open', () => {
          setState('connected');
          // Send the initial size as soon as we connect; the PTY server
          // already used the token's cols/rows but those default to 80x24.
          sendResize();
        });
        ws.addEventListener('message', (evt: MessageEvent) => {
          const data = evt.data;
          if (typeof data === 'string') {
            // Could be a control envelope or raw output. Control envelopes
            // start with '{' and parse cleanly. Raw output passes through.
            if (data.length > 0 && data[0] === '{') {
              try {
                const obj = JSON.parse(data);
                if (obj && typeof obj === 'object') {
                  if (obj.type === 'exit') {
                    setExitInfo({ code: typeof obj.exitCode === 'number' ? obj.exitCode : null });
                    setState('ended');
                    return;
                  }
                  if (obj.type === 'ready') {
                    // pid + runId surfaced; no UI update needed beyond runId.
                    return;
                  }
                  if (obj.type === 'error') {
                    setErrorDetail(
                      typeof obj.message === 'string' ? obj.message : 'pty error',
                    );
                    setState('failed');
                    return;
                  }
                }
              } catch {
                // not JSON -- fall through to write
              }
            }
            term.write(data);
            setBytes((b) => b + data.length);
            // Count line breaks for the footer.
            const nl = (data.match(/\n/g) || []).length;
            if (nl > 0) setLines((l) => l + nl);
          } else if (data instanceof ArrayBuffer) {
            const text = new TextDecoder().decode(new Uint8Array(data));
            term.write(text);
            setBytes((b) => b + data.byteLength);
            const nl = (text.match(/\n/g) || []).length;
            if (nl > 0) setLines((l) => l + nl);
          }
        });
        ws.addEventListener('close', (evt: CloseEvent) => {
          // Functional setter form -- avoid stale-closure read of `state`.
          // Only flip to 'ended' if we're not already in a terminal state.
          setState((prev) => (prev === 'ended' || prev === 'failed' ? prev : 'ended'));
          // Distinguish 1000 (normal exit) from other codes for the footer.
          if (evt.code !== 1000) {
            setErrorDetail((prev) =>
              prev ?? `WS closed (${evt.code}${evt.reason ? ': ' + evt.reason : ''})`,
            );
          }
        });
        ws.addEventListener('error', () => {
          // The browser doesn't surface the underlying reason for WS errors
          // (security policy). Map to a generic failure -- the close event
          // that follows usually carries the close code. Functional setter
          // form so we don't read stale `state` from this closure.
          setErrorDetail((prev) =>
            prev ?? 'Could not reach PTY server at the dev port. Is `npm run pty-server` running?',
          );
        });

        // Wire keystrokes to the PTY.
        const onDataDisposable = term.onData((data: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        });

        // Resize observer: fit + push a resize envelope on layout changes.
        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
          resizeObs = new ResizeObserver(() => {
            try {
              fitAddon.fit();
            } catch {
              // ignore
            }
            sendResize();
          });
          resizeObs.observe(containerRef.current);
        }

        // Stash disposers on the term ref so cleanup can reach them.
        (termRef.current as unknown as { _onDataDisposable?: { dispose: () => void } })._onDataDisposable =
          onDataDisposable;
      } catch (err) {
        if (cancelled) return;
        setState('failed');
        setErrorDetail(
          err instanceof Error ? err.message : String(err),
        );
      }
    })();

    return () => {
      cancelled = true;
      try { resizeObs?.disconnect(); } catch { /* ignore */ }
      const ws = wsRef.current;
      if (ws) {
        try {
          ws.close(1000, 'modal_closed');
        } catch { /* ignore */ }
        wsRef.current = null;
      }
      const term = termRef.current as unknown as
        | (typeof termRef.current & { _onDataDisposable?: { dispose: () => void } })
        | null;
      if (term) {
        try { term._onDataDisposable?.dispose(); } catch { /* ignore */ }
        try { term.dispose(); } catch { /* ignore */ }
        termRef.current = null;
      }
      try { fitAddonRef.current?.dispose?.(); } catch { /* ignore */ }
      fitAddonRef.current = null;
    };
    // `sendResize` is stable (useCallback []); state/exitInfo are read via
    // refs and setters and intentionally NOT in the dep list -- this effect
    // is run-once-per-mount and the cleanup tears everything down. Adding
    // state would re-run the effect and re-mint the token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // Connection-state label for the footer.
  const stateLabel = (() => {
    switch (state) {
      case 'minting_token': return 'requesting session token...';
      case 'connecting': return 'connecting to PTY...';
      case 'connected': return 'live';
      case 'ended':
        return exitInfo
          ? `session ended (exit ${exitInfo.code ?? '?'})`
          : 'session ended';
      case 'failed': return 'failed';
    }
  })();
  const stateColor = (() => {
    switch (state) {
      case 'connected': return 'bg-emerald-400';
      case 'connecting':
      case 'minting_token': return 'bg-amber-400';
      case 'ended': return 'bg-slate-400';
      case 'failed': return 'bg-red-400';
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Embedded terminal for ${project}`}
      onClick={(e) => {
        // Click on the backdrop closes; click inside the modal does nothing.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl h-[80vh] bg-[#0A0A0A] border border-slate-700 rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header -- macOS traffic-light chrome on the left to match the mockup. */}
        <div className="h-9 px-3 flex items-center gap-2 border-b border-slate-700 bg-[#1F1F1F]">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Close embedded terminal"
              onClick={onClose}
              className="w-3 h-3 rounded-full bg-red-500 hover:brightness-110 focus:outline-none focus-visible:ring-1 focus-visible:ring-red-300"
              title="Close (modal stays open until you click)"
            />
            <span
              className="w-3 h-3 rounded-full bg-amber-400"
              aria-hidden="true"
            />
            <span
              className="w-3 h-3 rounded-full bg-emerald-500"
              aria-hidden="true"
            />
          </div>
          <div className="flex-1 flex items-center justify-center text-xs font-mono text-slate-300 tracking-tight">
            <span>{project}</span>
            <span className="mx-2 text-slate-500">·</span>
            <span>claude --resume</span>
            <span className="mx-2 text-slate-500">·</span>
            <span className="text-slate-400">xterm.js (real PTY via WebSocket)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 font-mono"
            title="Close"
          >
            close
          </button>
        </div>

        {/* Terminal pane. Fills the modal body. xterm.js is loaded inside the
            effect; the container is sized via flex-1 + min-h-0 so the
            ResizeObserver-driven fit() picks up correct dimensions. */}
        <div
          ref={containerRef}
          className="flex-1 min-h-0 p-2 bg-[#0A0A0A] overflow-hidden"
        />

        {/* Footer -- session id + connection state + line/byte counts.
            Matches the mockup's footer rail. */}
        <div className="h-7 px-3 flex items-center text-[11px] font-mono text-slate-400 border-t border-slate-700 bg-[#141414] gap-3">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${stateColor}`} />
            <span>{stateLabel}</span>
          </span>
          <span className="text-slate-600">·</span>
          <span>
            runId: <span className="text-slate-300">{runId ? runId.slice(0, 8) : '--------'}</span>
          </span>
          <span className="text-slate-600">·</span>
          <span>{lines.toLocaleString()} lines</span>
          <span className="text-slate-600">·</span>
          <span>{bytes.toLocaleString()} bytes</span>
          <div className="flex-1" />
          {errorDetail && (
            <span className="text-red-400 truncate" title={errorDetail}>
              {errorDetail}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
