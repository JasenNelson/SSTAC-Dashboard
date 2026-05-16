// Server-only parser for Knowledge-Base/PROJECTS_MAP.md.
//
// PROJECTS_MAP.md is the single source of truth for the Agentic OS admin page.
// It is plain markdown with YAML frontmatter. The owner edits it by hand.
// This parser turns it into typed data structures the view layer consumes.
//
// Architecture: see .tmp_presentation/master/AGENTIC_OS_ARCHITECTURE.md (Section 7)
// and AGENTIC_OS_HANDOFF.md (Section 11).
//
// Pure parsing functions are exported for unit testing in isolation. The IO
// wrapper readProjectsMap() handles filesystem access and path resolution.
// Never import this module into a 'use client' file -- it uses node:fs.

import { promises as fs } from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface Project {
  /** Heading text, stripped of wrapping backticks. e.g. "Regulatory-Review" */
  name: string;
  /** Absolute filesystem path from **Path:** field. Empty string if missing. */
  path: string;
  /** Free-text description from **Purpose:** field. Empty string if missing. */
  purpose: string;
  /** Free-text status from **Status:** field. Empty string if missing. */
  status: string;
  /** Optional doc pointer from **Key handoff:** field. */
  keyHandoff?: string;
  /** Optional one-liner to seed a fresh Claude Code session for this project. */
  resumePrompt?: string;
  /** Optional command/branch hint from **Activity signal:** field. */
  activitySignal?: string;
  /** Comma-separated tag list from **Tags:**. Empty array if missing. */
  tags: string[];
  /**
   * Any other **Bold:** field on the project (e.g. "Convergence",
   * "Pending", "Hard-won lessons"). Keys preserve original casing.
   */
  extras: Record<string, string>;
}

export interface ConvergenceEdge {
  /** Source node. */
  from: string;
  /** Target node, with any "(future)" annotation stripped. */
  to: string;
  /** Edge label (the text between -- and -->). Optional. */
  label?: string;
  /** True when the target ended with "(future)" -- render as dashed. */
  dashed?: boolean;
}

export interface ParsedProjectsMap {
  projects: Project[];
  edges: ConvergenceEdge[];
}

// Field key (lowercased) -> Project property mapping. Anything not in this map
// drops into `extras` keyed by the original (un-lowercased, trimmed) heading.
const FIELD_TO_PROPERTY: Record<string, keyof Project> = {
  path: 'path',
  purpose: 'purpose',
  status: 'status',
  'key handoff': 'keyHandoff',
  'resume prompt': 'resumePrompt',
  'activity signal': 'activitySignal',
  tags: 'tags',
};

const RE_SECTION_HEADING = /^##\s+(.+)$/;
const RE_PROJECT_HEADING = /^###\s+(.+)$/;
const RE_BOLD_FIELD = /^\*\*([^:]+):\*\*\s*(.*)$/;
const RE_EDGE = /^(.+?)\s*--(.+?)-->\s*(.+?)$/;
const RE_FUTURE = /^(.+?)\s*\(future\)\s*$/i;
const RE_BOM = /^﻿/;

/**
 * Strip wrapping backticks ONLY when the value is a single backtick-delimited
 * token (e.g. `C:\Projects\X`). Leaves inline-code values alone, since those
 * contain meaningful structure (e.g. `git log --since='7 days ago'` on `master`).
 */
function stripWrappingBackticks(s: string): string {
  const t = s.trim();
  if (
    t.length >= 2 &&
    t.startsWith('`') &&
    t.endsWith('`') &&
    t.indexOf('`', 1) === t.length - 1
  ) {
    return t.slice(1, -1);
  }
  return t;
}

/** Trim wrapping straight/curly quotes from a free-text value. */
function stripWrappingQuotes(s: string): string {
  return s.replace(/^["'“‘]|["'”’]$/g, '');
}

function emptyProject(name: string): Project {
  return {
    name,
    path: '',
    purpose: '',
    status: '',
    tags: [],
    extras: {},
  };
}

/**
 * Parse the body of a PROJECTS_MAP.md file (post-frontmatter) into typed data.
 *
 * Strategy:
 *  - gray-matter strips YAML frontmatter; remaining body is scanned line-by-line.
 *  - `## Active Projects` opens the project section. Each subsequent `### name`
 *    starts a new project; `**Field:**` lines until the next heading populate it.
 *  - `## Convergence Edges` opens the edge section. The first fenced code block
 *    inside it is parsed line-by-line for `from --label--> to` syntax.
 *  - Malformed lines are silently skipped (the data is human-maintained;
 *    forgiveness > strictness).
 */
export function parseProjectsMap(markdown: string): ParsedProjectsMap {
  const stripped = markdown.replace(RE_BOM, '');
  // gray-matter is forgiving when frontmatter is absent; it just returns content.
  const { content } = matter(stripped);
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  const projects: Project[] = [];
  const edges: ConvergenceEdge[] = [];

  let currentSection: string | null = null;
  let currentProject: Project | null = null;
  let inEdgeFence = false;

  const flushProject = () => {
    if (currentProject) {
      projects.push(currentProject);
      currentProject = null;
    }
  };

  for (const line of lines) {
    // Section heading (##) closes any open project and resets section state.
    const sectionMatch = line.match(RE_SECTION_HEADING);
    if (sectionMatch) {
      flushProject();
      inEdgeFence = false;
      currentSection = sectionMatch[1].trim().toLowerCase();
      continue;
    }

    if (currentSection === 'active projects') {
      const projMatch = line.match(RE_PROJECT_HEADING);
      if (projMatch) {
        flushProject();
        const name = stripWrappingBackticks(projMatch[1]).trim();
        if (name) currentProject = emptyProject(name);
        continue;
      }

      if (currentProject) {
        const fieldMatch = line.match(RE_BOLD_FIELD);
        if (!fieldMatch) continue;

        const rawKey = fieldMatch[1].trim();
        const rawValue = fieldMatch[2];
        const value = stripWrappingQuotes(stripWrappingBackticks(rawValue)).trim();
        const prop = FIELD_TO_PROPERTY[rawKey.toLowerCase()];

        if (prop === 'tags') {
          currentProject.tags = value
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
        } else if (prop === 'path' || prop === 'purpose' || prop === 'status') {
          currentProject[prop] = value;
        } else if (
          prop === 'keyHandoff' ||
          prop === 'resumePrompt' ||
          prop === 'activitySignal'
        ) {
          if (value) currentProject[prop] = value;
        } else {
          // Unknown bold field -> extras, preserving the original key casing.
          //
          // Defense in depth (holistic review IMPORTANT-2): if the trimmed
          // key resolves to a typed property, it must NEVER reach extras
          // even if the lookup-key drifted (e.g., owner typed "** path :**"
          // with stray whitespace). The fieldKey normalization already
          // handles common drift; this extra guard catches anything that
          // slipped past it -- preventing a duplicate "Path" notes section
          // showing alongside the typed Path slot in the UI.
          const normalized = rawKey.toLowerCase().trim();
          if (normalized in FIELD_TO_PROPERTY) continue;
          if (rawKey && !(rawKey in currentProject.extras)) {
            currentProject.extras[rawKey] = value;
          }
        }
      }
      continue;
    }

    // Convergence Edges code block parsing.
    if (currentSection?.startsWith('convergence edges')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('```')) {
        inEdgeFence = !inEdgeFence;
        continue;
      }
      if (!inEdgeFence || !trimmed) continue;

      const edgeMatch = trimmed.match(RE_EDGE);
      if (!edgeMatch) continue;

      const from = edgeMatch[1].trim();
      const labelRaw = edgeMatch[2].trim();
      const toRaw = edgeMatch[3].trim();
      if (!from || !toRaw) continue;

      let to = toRaw;
      let dashed = false;
      const futureMatch = toRaw.match(RE_FUTURE);
      if (futureMatch) {
        to = futureMatch[1].trim();
        dashed = true;
      }

      const edge: ConvergenceEdge = { from, to };
      if (labelRaw) edge.label = labelRaw;
      if (dashed) edge.dashed = true;
      edges.push(edge);
    }
  }

  flushProject();

  return { projects, edges };
}

/**
 * Resolve the absolute path to PROJECTS_MAP.md.
 *
 * Order of resolution:
 *   1. If env var KNOWLEDGE_BASE_PATH is set, treat it as the Knowledge-Base
 *      directory and join PROJECTS_MAP.md to it.
 *   2. Otherwise fall back to "../Knowledge-Base/PROJECTS_MAP.md" relative to
 *      the current process cwd (which during `next dev` is the dashboard root).
 *
 * The env var override lets us point at an alternate Knowledge-Base location
 * for tests, CI, or a co-tenanted dev setup without changing code.
 */
export function resolveProjectsMapPath(): string {
  const envBase = process.env.KNOWLEDGE_BASE_PATH;
  if (envBase && envBase.trim()) {
    return path.join(envBase.trim(), 'PROJECTS_MAP.md');
  }
  return path.join(process.cwd(), '..', 'Knowledge-Base', 'PROJECTS_MAP.md');
}

/**
 * Read PROJECTS_MAP.md from disk and parse it.
 *
 * @param absPath Optional explicit absolute path. If omitted, resolveProjectsMapPath() is used.
 * @throws if the file cannot be read (ENOENT, EACCES, etc.) -- caller decides
 *         whether to render an empty state or surface the error.
 */
export async function readProjectsMap(absPath?: string): Promise<ParsedProjectsMap> {
  const target = absPath ?? resolveProjectsMapPath();
  const markdown = await fs.readFile(target, 'utf-8');
  return parseProjectsMap(markdown);
}
