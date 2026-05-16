'use client';

// Convergence graph for the Agentic OS admin page. Step 5 of the MVP.
//
// Renders the `edges` parsed from PROJECTS_MAP.md as an interactive
// node-and-edge diagram using @xyflow/react + @dagrejs/dagre for auto-layout.
// Dagre produces a clean directed-acyclic-graph layout (left-to-right) that
// respects edge direction and avoids the spaghetti of a hand-rolled radial
// layout.
//
// Visual design (Gemini design consult, 2026-05-15):
//   - Nodes are pill-shaped containers (see ConvergenceNode.tsx) with subtle
//     borders + status indicator dots for projects, dashed borders for externs.
//   - Edges are bezier curves (React Flow `type: 'default'`); non-future edges
//     get React Flow's built-in marching-ants animation (`animated: true`).
//   - Dashed (future) edges keep the static look + a 6,5 stroke-dasharray
//     to distinguish "planned" from "live data flow".
//
// Read-only: dragging, connecting, and selecting are all disabled. The graph
// is a visualization of a static markdown file -- mutations live in the human
// edit cycle on PROJECTS_MAP.md, not in the UI.
//
// Accessibility: React Flow's SVG is opaque to screen readers, so we
// duplicate the edge list under a sr-only <ul> below the canvas. The canvas
// itself gets a role="img" + aria-label summarizing the counts.

import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Position,
  type Node,
  type Edge as RFEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import type {
  ConvergenceEdge,
  Project,
} from '@/lib/agentic-os/parse-projects-map';
import { inferStatus } from '@/lib/agentic-os/status-helpers';
import ConvergenceNode, {
  type ConvergenceNodeData,
} from './ConvergenceNode';

interface Props {
  edges: ConvergenceEdge[];
  /**
   * Full Project objects (not just names) so the graph can render each
   * project node's status indicator. Externs (edge endpoints not in this
   * list) get rendered with a dashed border and no status dot.
   */
  projects: Project[];
}

const CANVAS_H = 480;
// Pill height is fixed by the font + padding combo in ConvergenceNode.tsx:
//   project: text-[13px] + py-1.5 -> ~30px tall
//   extern:  text-[12px] + py-1   -> ~26px tall
// These values feed dagre's per-node `height`; the rendered pill auto-sizes
// but dagre needs a number so node bounding boxes don't overlap.
const PROJECT_H = 30;
const EXTERN_H = 26;
// Per-node width is computed from label character count -- pills size to
// their content, so feeding dagre a constant width would either oversize
// short pills (gap-y inflation) or clip long ones. The constants below
// approximate average glyph width + horizontal padding + (for project) the
// 6px status dot + 6px gap-1.5. Slight overestimation is preferable to
// underestimation because dagre lays out non-overlapping boxes.
const PROJECT_CHAR_PX = 7; // mid-weight 13px sans-serif glyph
const PROJECT_PAD_PX = 24 + 12; // px-3 (24) + dot (6) + gap-1.5 (6)
const PROJECT_MIN_W = 120;
const EXTERN_CHAR_PX = 6.5; // 12px sans-serif glyph
const EXTERN_PAD_PX = 20; // px-2.5
const EXTERN_MIN_W = 110;

function projectWidth(label: string): number {
  return Math.max(PROJECT_MIN_W, label.length * PROJECT_CHAR_PX + PROJECT_PAD_PX);
}

function externWidth(label: string): number {
  return Math.max(EXTERN_MIN_W, label.length * EXTERN_CHAR_PX + EXTERN_PAD_PX);
}

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
    g.setNode(name, {
      width: projectWidth(name),
      height: PROJECT_H,
      kind: 'project',
    });
  }
  for (const name of externNames) {
    g.setNode(name, {
      width: externWidth(name),
      height: EXTERN_H,
      kind: 'extern',
    });
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

// React Flow's nodeTypes map. Declared at module scope so the object
// identity is stable across renders -- otherwise React Flow warns and
// re-creates the node renderer on every render (perf + flicker hazard).
const nodeTypes = { convergence: ConvergenceNode };

export default function ConvergenceGraph({ edges, projects }: Props) {
  const projectNames = useMemo(() => projects.map((p) => p.name), [projects]);
  // Project name -> {statusColor, statusLabel} lookup so per-node data can
  // be populated without re-running inferStatus on every render.
  const statusByName = useMemo(() => {
    const m = new Map<string, { color: string; label: string }>();
    for (const p of projects) m.set(p.name, inferStatus(p.status));
    return m;
  }, [projects]);

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
      laidOut.map((n) => {
        const isProject = n.kind === 'project';
        const status = isProject ? statusByName.get(n.id) : undefined;
        const data: ConvergenceNodeData = isProject
          ? {
              label: n.id,
              kind: 'project',
              statusColor: status?.color,
              statusLabel: status?.label,
            }
          : { label: n.id, kind: 'extern' };
        return {
          id: n.id,
          type: 'convergence',
          position: { x: n.x, y: n.y },
          data,
          draggable: false,
          selectable: false,
          connectable: false,
          // rankdir='LR' lays nodes out left-to-right. Pin source=Right,
          // target=Left so edges flow naturally with the layout.
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          // No inline width/height/border/background -- the pill is sized
          // by its own CSS and React Flow wraps it transparently. Setting
          // a fixed width here would clip the pill or leave dead space.
          style: { background: 'transparent', border: 'none', padding: 0 },
        };
      }),
    [laidOut, statusByName]
  );

  const rfEdges: RFEdge[] = useMemo(
    () =>
      edges.map((e, i) => {
        // Color is shared between stroke and arrowhead so they read as a
        // single visual unit.
        const stroke = e.dashed ? '#94a3b8' : '#0ea5e9'; // slate-400 / sky-500
        const strokeWidth = e.dashed ? 1.5 : 2;
        return {
          id: `e-${i}-${e.from}-${e.to}`,
          source: e.from,
          target: e.to,
          label: e.label,
          // Non-future edges get React Flow's marching-ants animation
          // (Gemini's "agentic activity" suggestion). Future edges stay
          // static + dashed to signal "planned, not live yet".
          animated: !e.dashed,
          style: e.dashed
            ? { strokeDasharray: '6,5', stroke, strokeWidth }
            : { stroke, strokeWidth },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: stroke,
            width: 18,
            height: 18,
          },
          // labelStyle.fill and labelBgStyle.fill are intentionally NOT set
          // here because React Flow renders them as inline style attributes
          // which beat dark-mode CSS overrides regardless of selector
          // specificity. Colors live in the styled-jsx block below.
          labelStyle: {
            fontSize: 11,
            fontWeight: 500,
          },
          labelBgStyle: {
            fillOpacity: 0.92,
          },
          labelBgPadding: [4, 6] as [number, number],
          // 'default' = bezier curves (owner explicitly likes the curves).
          type: 'default',
        };
      }),
    [edges]
  );

  const totalNodes = projectNames.length + externNames.length;
  if (totalNodes === 0) {
    return (
      <div className="text-xs text-slate-500 dark:text-slate-400 italic">
        No graph to render -- PROJECTS_MAP.md returned no nodes or edges.
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
          nodeTypes={nodeTypes}
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

      {/* Edge-label dark-mode overrides + handle invisibility. The pill node
          itself is styled by Tailwind classes inside ConvergenceNode.tsx;
          this block only carries CSS that can't be expressed there:
            1. SVG <text>/<rect> fills for edge labels (dark-mode flip).
            2. Hiding React Flow's default handle dots (the floating-glyph
               artifact from prior passes). Handles must exist for edges to
               connect; we just make them invisible + un-clickable. */}
      <style jsx global>{`
        /* Default (light) edge label colors. */
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
        /* Hide the default handle dots permanently. They are the source of
           the "floating arrowhead glyph" the owner has called out before. */
        .agentic-graph-canvas .react-flow__handle {
          opacity: 0;
          pointer-events: none;
          width: 1px;
          height: 1px;
          min-width: 0;
          min-height: 0;
          border: none;
          background: transparent;
        }
      `}</style>

      {/* Screen-reader-only edge list -- React Flow's SVG is opaque to AT. */}
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
