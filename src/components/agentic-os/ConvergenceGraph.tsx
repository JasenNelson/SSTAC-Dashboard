'use client';

// Convergence graph for the Agentic OS admin page. Step 5 of the MVP.
//
// Renders the `edges` parsed from PROJECTS_MAP.md as an interactive node-and-
// edge diagram using @xyflow/react + @dagrejs/dagre for auto-layout. Dagre
// produces a clean directed-acyclic-graph layout (left-to-right by default)
// that respects edge direction and avoids the spaghetti of a hand-rolled
// radial layout. Owner feedback on step 5 v1 (radial): "chaos"; the rewrite
// uses dagre to find the most logical arrangement.
//
// Read-only: dragging, connecting, and selecting are all disabled. The
// graph is a visualization of a static markdown file -- mutations live in
// the human edit cycle on PROJECTS_MAP.md, not in the UI.
//
// Accessibility: React Flow's SVG is opaque to screen readers, so we
// duplicate the edge list under a sr-only <ul> below the canvas. The
// canvas itself gets a role="img" + aria-label summarizing the counts.

import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Position,
  type Node,
  type Edge as RFEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import type { ConvergenceEdge } from '@/lib/agentic-os/parse-projects-map';

interface Props {
  edges: ConvergenceEdge[];
  projectNames: string[];
}

const CANVAS_H = 480;
// PROJECT_W is wide enough for the longest current project name
// (`Regulatory-Review-worktrees/engine-v2`, 37 chars) at 12px font without
// truncating. If a future name is longer the CSS ellipses still kick in.
const PROJECT_W = 250;
const PROJECT_H = 40;
const EXTERN_W = 180;
const EXTERN_H = 32;

interface LaidOutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'project' | 'extern';
}

/**
 * Run dagre layout over the project + extern nodes plus the parsed edges.
 * dagre returns center-coordinates; React Flow expects top-left, so we
 * subtract half the width/height. rankdir='LR' produces a left-to-right
 * flow which reads naturally for the "data sources feed into sinks"
 * convergence semantics of PROJECTS_MAP.md.
 */
function computeLayout(
  projectNames: string[],
  externNames: string[],
  edges: ConvergenceEdge[]
): LaidOutNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',
    nodesep: 24,
    ranksep: 80,
    marginx: 16,
    marginy: 16,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const name of projectNames) {
    g.setNode(name, { width: PROJECT_W, height: PROJECT_H, kind: 'project' });
  }
  for (const name of externNames) {
    g.setNode(name, { width: EXTERN_W, height: EXTERN_H, kind: 'extern' });
  }
  for (const e of edges) {
    // dagre skips edges whose endpoints don't have nodes; we ensured every
    // endpoint is added above so this is safe.
    if (g.hasNode(e.from) && g.hasNode(e.to)) {
      g.setEdge(e.from, e.to);
    }
  }

  dagre.layout(g);

  return g.nodes().map((id) => {
    const n = g.node(id);
    return {
      id,
      x: n.x - n.width / 2,
      y: n.y - n.height / 2,
      width: n.width,
      height: n.height,
      kind: (n as { kind?: 'project' | 'extern' }).kind ?? 'extern',
    };
  });
}

export default function ConvergenceGraph({ edges, projectNames }: Props) {
  // Partition every node referenced anywhere into "project" (named in
  // PROJECTS_MAP.md's ## Active Projects) and "extern" (an edge endpoint
  // that is NOT itself a project, e.g. DRA-KB, Telegram).
  const externNames = useMemo(() => {
    const projectSet = new Set(projectNames);
    const seen = new Set<string>();
    const externs: string[] = [];
    for (const e of edges) {
      for (const ep of [e.from, e.to]) {
        if (!projectSet.has(ep) && !seen.has(ep)) {
          seen.add(ep);
          externs.push(ep);
        }
      }
    }
    return externs;
  }, [edges, projectNames]);

  const laidOut = useMemo(
    () => computeLayout(projectNames, externNames, edges),
    [projectNames, externNames, edges]
  );

  const nodes: Node[] = useMemo(
    () =>
      laidOut.map((n) => ({
        id: n.id,
        position: { x: n.x, y: n.y },
        data: { label: n.id },
        draggable: false,
        selectable: false,
        connectable: false,
        // rankdir='LR' lays nodes out left-to-right. React Flow's default
        // edge anchors (source=Bottom, target=Top) would still emit edges
        // downward then loop back up -- producing the spaghetti the
        // dagre rewrite is meant to eliminate. Pinning source=Right and
        // target=Left makes edges flow naturally with the layout.
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        title: n.id, // native tooltip for truncated long names
        // Theme-aware styling via Tailwind className so dark mode works.
        // Inline style only carries fixed layout dimensions.
        className:
          n.kind === 'project'
            ? 'agentic-graph-node-project'
            : 'agentic-graph-node-extern',
        style: {
          width: n.width,
          height: n.height,
          padding: 0,
          background: 'transparent',
          border: 'none',
          fontSize: n.kind === 'project' ? 12 : 11,
        },
      })),
    [laidOut]
  );

  const rfEdges: RFEdge[] = useMemo(
    () =>
      edges.map((e, i) => ({
        id: `e-${i}-${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        label: e.label,
        style: e.dashed
          ? { strokeDasharray: '5,5', stroke: '#94a3b8', strokeWidth: 1 } // slate-400
          : { stroke: '#0ea5e9', strokeWidth: 1.5 },                     // sky-500
        // labelStyle.fill and labelBgStyle.fill are intentionally NOT set
        // here because React Flow renders them as inline style attributes
        // which beat dark-mode CSS overrides regardless of selector
        // specificity. Colors live in the styled-jsx block below.
        labelStyle: {
          fontSize: 10,
        },
        labelBgStyle: {
          fillOpacity: 0.9,
        },
        labelBgPadding: [3, 4] as [number, number],
        type: 'default',
      })),
    [edges]
  );

  const totalNodes = projectNames.length + externNames.length;
  if (totalNodes === 0) {
    return (
      <div className="text-xs text-slate-500 dark:text-slate-400 italic">
        No graph to render — PROJECTS_MAP.md returned no nodes or edges.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="w-full border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 overflow-hidden agentic-graph-canvas"
        style={{ height: CANVAS_H }}
        role="img"
        aria-label={`Convergence graph: ${projectNames.length} project nodes, ${externNames.length} external endpoints, ${edges.length} edges (${
          edges.filter((e) => e.dashed).length
        } dashed/future)`}
      >
        <ReactFlow
          nodes={nodes}
          edges={rfEdges}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          minZoom={0.3}
          maxZoom={2.5}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            className="opacity-40"
          />
          <Controls
            showInteractive={false}
            position="bottom-right"
          />
        </ReactFlow>
      </div>

      {/* Theme-aware node styling lives here so dark mode flips colors
          cleanly. React Flow's `className` prop applies to the outer
          .react-flow__node wrapper; we style its label content via
          `.agentic-graph-node-* > .react-flow__node-default` selector. */}
      <style jsx global>{`
        .agentic-graph-node-project {
          background: #e0f2fe;
          color: #0c4a6e;
          border: 1px solid #7dd3fc;
          border-radius: 8px;
          padding: 8px 10px;
          font-weight: 500;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .agentic-graph-node-extern {
          background: #f1f5f9;
          color: #334155;
          border: 1px dashed #cbd5e1;
          border-radius: 6px;
          padding: 6px 8px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dark .agentic-graph-node-project {
          background: rgba(12, 74, 110, 0.4);
          color: #bae6fd;
          border-color: rgba(56, 189, 248, 0.4);
        }
        .dark .agentic-graph-node-extern {
          background: rgba(30, 41, 59, 0.6);
          color: #cbd5e1;
          border-color: rgba(100, 116, 139, 0.5);
        }
        /* Default (light) edge label colors. Set here so the dark
           override below has something with equal specificity to win
           against -- inline style on the <rect> would otherwise still
           dominate, which is why edges no longer carry labelStyle.fill
           or labelBgStyle.fill above. */
        .agentic-graph-canvas .react-flow__edge-text {
          fill: #475569;
        }
        .agentic-graph-canvas .react-flow__edge-textbg {
          fill: #ffffff;
        }
        .dark .agentic-graph-canvas .react-flow__edge-text {
          fill: #cbd5e1;
        }
        .dark .agentic-graph-canvas .react-flow__edge-textbg {
          fill: rgba(15, 23, 42, 0.85);
        }
      `}</style>

      {/* Screen-reader-only edge list — React Flow's SVG is opaque to AT. */}
      <ul
        className="sr-only"
        aria-label="Convergence edges (text equivalent)"
      >
        {edges.map((e, i) => (
          <li key={`sr-${i}`}>
            {e.from} {e.label ?? 'connects to'} {e.to}
            {e.dashed ? ' (planned)' : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
