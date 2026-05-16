'use client';

// Pill-shaped custom node for the Agentic OS convergence graph.
//
// Owner direction (Gemini design consult, 2026-05-15): containerize the node
// labels into pill-shaped containers with subtle borders so the graph reads
// more like a system architecture diagram than a network of free-floating
// strings. Project nodes carry a status indicator dot; extern nodes (DRA-KB,
// Telegram, ...) use a dashed border to signal "not a project we drive".
//
// Width is intentionally NOT fixed -- the pill sizes to its content via
// `white-space: nowrap` + natural shrink-to-fit. The parent ConvergenceGraph
// estimates per-node width from label length and feeds that to dagre so the
// auto-layout knows the actual footprint. Estimate + render must agree on
// padding contribution, hence the constants commented in ConvergenceGraph.
//
// Handles: React Flow requires <Handle> components on a custom node for
// edges to connect. Their default rendering produces the floating-glyph
// artifacts the owner has been complaining about, so we hide them visually
// (opacity 0 + pointer-events none, applied via a CSS rule scoped to
// `.agentic-graph-canvas` in ConvergenceGraph.tsx). Edges still connect to
// the handles' coordinates -- visibility and connectivity are orthogonal.

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface ConvergenceNodeData extends Record<string, unknown> {
  /** Display label -- the node id (project or extern name). */
  label: string;
  /** Project nodes get a status dot; externs do not. */
  kind: 'project' | 'extern';
  /**
   * Tailwind bg-* class for the status dot (e.g. 'bg-emerald-400').
   * Only consumed when kind === 'project'.
   */
  statusColor?: string;
  /** Human-readable status label, e.g. 'active' / 'blocked'. Tooltip only. */
  statusLabel?: string;
}

function ConvergenceNodeImpl({ data }: NodeProps) {
  const d = data as ConvergenceNodeData;
  const isProject = d.kind === 'project';

  // Light mode: pale slate background, slate border, slate-700 text.
  // Dark mode: translucent slate-800 background, slate-700 border, slate-200 text.
  // Extern: dashed border instead of solid to signal "external endpoint".
  const base =
    'inline-flex items-center gap-1.5 rounded-full whitespace-nowrap leading-tight';
  const projectClasses =
    'px-3 py-1.5 text-[13px] font-medium bg-slate-50 text-slate-700 border border-solid border-slate-300 ' +
    'dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700';
  const externClasses =
    'px-2.5 py-1 text-[12px] bg-slate-50 text-slate-600 border border-dashed border-slate-300 ' +
    'dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-600';

  return (
    <div
      className={`${base} ${isProject ? projectClasses : externClasses}`}
      title={
        isProject && d.statusLabel
          ? `${d.label} - ${d.statusLabel}`
          : d.label
      }
    >
      {/* Source + target handles. Visually hidden via CSS rule in parent
          (`.agentic-graph-canvas .react-flow__handle`); still functionally
          connected so edges anchor to the node centers. Without these, edges
          would not render at all on a custom node. */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
      />
      {isProject && (
        // Status dot on the LEFT side, INSIDE the pill. shrink-0 prevents
        // it from being squashed when the label is long.
        <span
          aria-hidden="true"
          className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
            d.statusColor ?? 'bg-emerald-400'
          }`}
        />
      )}
      <span>{d.label}</span>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
      />
    </div>
  );
}

export const ConvergenceNode = memo(ConvergenceNodeImpl);
export default ConvergenceNode;
