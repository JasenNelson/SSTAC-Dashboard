'use client';

// MermaidDiagram -- client-only Mermaid renderer for the methodology view.
//
// Why a dedicated component:
//   - mermaid is a large client-side library; it should not be imported by
//     any SSR / server component.
//   - Each diagram instance must have a stable, unique DOM id so mermaid.run()
//     can target it without collisions when multiple diagrams render on the
//     same page (V1 / V2 / Transition all surface diagrams in the Technical
//     tier).
//   - Dark-mode handling: we read next-themes resolvedTheme and pass mermaid
//     a matching theme ('default' for light, 'dark' for dark). Re-renders on
//     theme change.
//
// Pattern:
//   <MermaidDiagram chart={mermaidSource} ariaLabel="v1 4-stage pipeline" />
//
// The diagram source is Mermaid syntax (flowchart TB / LR + classDef etc.).
// classDef colors should be chosen so they are legible in BOTH light and
// dark mode; mermaid's 'dark' theme provides a dark background under which
// classDef fills must still contrast.

import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

interface MermaidDiagramProps {
  chart: string;
  ariaLabel?: string;
}

export function MermaidDiagram({ chart, ariaLabel }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  // useId() returns values with characters that mermaid does not accept as
  // a DOM id, so derive an ascii-safe slug.
  const diagramId = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { resolvedTheme } = useTheme();
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!containerRef.current) {
        return;
      }
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: resolvedTheme === 'dark' ? 'dark' : 'default',
          securityLevel: 'strict',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          flowchart: {
            htmlLabels: true,
            curve: 'basis',
            useMaxWidth: true,
          },
        });

        const { svg } = await mermaid.render(diagramId, chart);
        if (cancelled) {
          return;
        }
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
        setRenderError(null);
      } catch (err) {
        // Don't crash the page; surface a small error block instead.
        if (cancelled) {
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setRenderError(msg);
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [chart, diagramId, resolvedTheme]);

  if (renderError) {
    return (
      <div
        role="alert"
        className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-3"
      >
        <p className="font-semibold mb-1">Mermaid render error</p>
        <pre className="whitespace-pre-wrap font-mono text-[11px]">
          {renderError}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel ?? 'Mermaid diagram'}
      className="mermaid-diagram w-full overflow-x-auto flex justify-center bg-slate-50 dark:bg-slate-900/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700"
    />
  );
}
