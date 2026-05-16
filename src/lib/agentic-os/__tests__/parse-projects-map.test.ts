import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

import {
  parseProjectsMap,
  readProjectsMap,
  resolveProjectsMapPath,
} from '../parse-projects-map';

// Inline fixtures keep each test self-contained and deterministic.
// Use small but realistic snippets that mirror the real PROJECTS_MAP.md shape.

const HAPPY_PATH = `---
title: Projects Map
type: index
---

# Projects Map

intro text

---

## Active Projects

### \`Regulatory-Review\`

**Path:** \`C:\\Projects\\Regulatory-Review\\\`
**Purpose:** RRAA evaluation engine.
**Status:** Active review mode.
**Key handoff:** \`engine/docs/EMA_MANAGER_HANDOFF.md\`
**Resume prompt:** "Continue Regulatory Review work."
**Activity signal:** \`git log --since='7 days ago'\` on \`master\`.
**Tags:** evidence-finder, HITL, RRAA

### \`SSTAC-Dashboard\`

**Path:** \`C:\\Projects\\SSTAC-Dashboard\\\`
**Purpose:** Next.js stakeholder dashboard.
**Status:** Deployed.
**Resume prompt:** "Continue SSTAC-Dashboard development."
**Activity signal:** \`git log --since='7 days ago'\`.
**Tags:** dashboard, frontend, next.js

---

## Convergence Edges (Mermaid graph data)

\`\`\`
Regulatory-Review --feeds engine--> engine-v2
SSTAC-Dashboard --reads--> PROJECTS_MAP.md
Site3250-KB --will be subsumed by--> DRA-KB (future)
\`\`\`
`;

describe('parseProjectsMap', () => {
  it('parses the happy-path frontmatter + 2 projects + 3 edges', () => {
    const { projects, edges } = parseProjectsMap(HAPPY_PATH);

    expect(projects).toHaveLength(2);

    const rr = projects[0];
    expect(rr.name).toBe('Regulatory-Review');
    expect(rr.path).toBe('C:\\Projects\\Regulatory-Review\\');
    expect(rr.purpose).toBe('RRAA evaluation engine.');
    expect(rr.status).toBe('Active review mode.');
    expect(rr.keyHandoff).toBe('engine/docs/EMA_MANAGER_HANDOFF.md');
    expect(rr.resumePrompt).toBe('Continue Regulatory Review work.');
    // Activity signal contains inline code -- wrapping backticks must NOT be stripped.
    expect(rr.activitySignal).toContain('git log');
    expect(rr.activitySignal).toContain('master');
    expect(rr.tags).toEqual(['evidence-finder', 'HITL', 'RRAA']);
    expect(rr.extras).toEqual({});

    const dash = projects[1];
    expect(dash.name).toBe('SSTAC-Dashboard');
    expect(dash.path).toBe('C:\\Projects\\SSTAC-Dashboard\\');
    expect(dash.tags).toEqual(['dashboard', 'frontend', 'next.js']);

    expect(edges).toHaveLength(3);
    expect(edges[0]).toEqual({
      from: 'Regulatory-Review',
      to: 'engine-v2',
      label: 'feeds engine',
    });
    expect(edges[1]).toEqual({
      from: 'SSTAC-Dashboard',
      to: 'PROJECTS_MAP.md',
      label: 'reads',
    });
    // (future) annotation -> dashed=true, to is cleaned of the suffix.
    expect(edges[2]).toEqual({
      from: 'Site3250-KB',
      to: 'DRA-KB',
      label: 'will be subsumed by',
      dashed: true,
    });
  });

  it('parses markdown with NO frontmatter', () => {
    const md = `## Active Projects

### \`OnlyOne\`

**Path:** /tmp/x
**Purpose:** test
**Status:** active
**Tags:** a, b
`;
    const { projects } = parseProjectsMap(md);
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('OnlyOne');
    expect(projects[0].tags).toEqual(['a', 'b']);
  });

  it('returns empty projects when "## Active Projects" heading is missing', () => {
    const md = `---
title: stub
---

# Something Else

## Other Section

### \`NotAProject\`
**Path:** ignored
`;
    const { projects, edges } = parseProjectsMap(md);
    expect(projects).toEqual([]);
    expect(edges).toEqual([]);
  });

  it('returns empty edges when "## Convergence Edges" is missing', () => {
    const md = `## Active Projects

### \`P1\`
**Path:** /p1
**Purpose:** x
**Status:** y
**Tags:** t
`;
    const { projects, edges } = parseProjectsMap(md);
    expect(projects).toHaveLength(1);
    expect(edges).toEqual([]);
  });

  it('includes projects that are missing the **Path:** field (path becomes empty string)', () => {
    const md = `## Active Projects

### \`PathlessProject\`

**Purpose:** has no path
**Status:** experimental
**Tags:** orphan
`;
    const { projects } = parseProjectsMap(md);
    expect(projects).toHaveLength(1);
    expect(projects[0].path).toBe('');
    expect(projects[0].purpose).toBe('has no path');
    // optional fields stay undefined when omitted
    expect(projects[0].keyHandoff).toBeUndefined();
    expect(projects[0].resumePrompt).toBeUndefined();
    expect(projects[0].activitySignal).toBeUndefined();
  });

  it('handles edges in tag values gracefully (empty tags, whitespace, single tag)', () => {
    const md = `## Active Projects

### \`NoTags\`
**Path:** /x
**Purpose:** p
**Status:** s
**Tags:**

### \`OneTag\`
**Path:** /y
**Purpose:** p
**Status:** s
**Tags:** solo

### \`SpacedTags\`
**Path:** /z
**Purpose:** p
**Status:** s
**Tags:**    a  ,   b ,c
`;
    const { projects } = parseProjectsMap(md);
    expect(projects).toHaveLength(3);
    expect(projects[0].tags).toEqual([]);
    expect(projects[1].tags).toEqual(['solo']);
    expect(projects[2].tags).toEqual(['a', 'b', 'c']);
  });

  it('drops malformed edge lines and keeps valid ones', () => {
    const md = `## Convergence Edges

\`\`\`
A --label--> B
not an edge line at all
C -broken arrow- D
E --x--> F
\`\`\`
`;
    const { edges } = parseProjectsMap(md);
    expect(edges).toHaveLength(2);
    expect(edges[0]).toEqual({ from: 'A', to: 'B', label: 'label' });
    expect(edges[1]).toEqual({ from: 'E', to: 'F', label: 'x' });
  });

  it('normalizes CRLF line endings the way Windows commits typically arrive', () => {
    const crlf = HAPPY_PATH.replace(/\n/g, '\r\n');
    const { projects, edges } = parseProjectsMap(crlf);
    expect(projects).toHaveLength(2);
    expect(edges).toHaveLength(3);
  });

  it('does NOT leak typed field keys into extras under case/whitespace drift (holistic IMPORTANT-2)', () => {
    // Owner authors PROJECTS_MAP.md by hand. Case/whitespace variants of
    // a typed field key must land in the typed slot (last-write-wins is
    // fine; the file is hand-edited), and must NEVER duplicate into
    // extras where they would render as confusing "Notes" headers.
    const md = `## Active Projects

### \`Driftful\`

**Path:** /x
**Purpose:** y
**Status:** z
**  PATH  :** /case-drift
**KEY HANDOFF:** docs/upper.md
**Resume Prompt:** "case-drifted prompt"
**Tags:** drift
`;
    const { projects } = parseProjectsMap(md);
    expect(projects).toHaveLength(1);
    const p = projects[0];
    // Typed slots accept every case-drifted variant; last write wins.
    expect(p.path).toBe('/case-drift');
    expect(p.keyHandoff).toBe('docs/upper.md');
    expect(p.resumePrompt).toBe('case-drifted prompt');
    // No case-variant of any typed key ever lands in extras.
    for (const key of Object.keys(p.extras)) {
      const normalized = key.toLowerCase().trim();
      expect(normalized).not.toBe('path');
      expect(normalized).not.toBe('purpose');
      expect(normalized).not.toBe('status');
      expect(normalized).not.toBe('key handoff');
      expect(normalized).not.toBe('resume prompt');
      expect(normalized).not.toBe('activity signal');
      expect(normalized).not.toBe('tags');
    }
  });

  it('captures unknown bold fields in extras with original key casing preserved', () => {
    const md = `## Active Projects

### \`Sediment-DRA-Pipeline\`

**Path:** /x
**Purpose:** y
**Status:** active
**Hard-won lessons:** gemma4 silent-fails at smoke.
**Convergence:** Will subsume Site3250-KB.
**Tags:** dra
`;
    const { projects } = parseProjectsMap(md);
    expect(projects).toHaveLength(1);
    expect(projects[0].extras).toEqual({
      'Hard-won lessons': 'gemma4 silent-fails at smoke.',
      Convergence: 'Will subsume Site3250-KB.',
    });
  });

  it('strips a BOM at the start of the file', () => {
    const md = '﻿## Active Projects\n\n### `X`\n**Path:** /x\n**Purpose:** p\n**Status:** s\n**Tags:** t\n';
    const { projects } = parseProjectsMap(md);
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('X');
  });

  it('parses an edge with no label and skips it (parser requires --label--> form)', () => {
    // The mermaid-flavored "A --> B" plain-arrow form is intentionally NOT
    // accepted; the data layer uses --label--> consistently. This locks the
    // contract: if someone adds a plain arrow it falls through silently.
    const md = `## Convergence Edges

\`\`\`
A --> B
C --has--> D
\`\`\`
`;
    const { edges } = parseProjectsMap(md);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual({ from: 'C', to: 'D', label: 'has' });
  });
});

describe('resolveProjectsMapPath', () => {
  const ORIGINAL_ENV = process.env.KNOWLEDGE_BASE_PATH;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.KNOWLEDGE_BASE_PATH;
    } else {
      process.env.KNOWLEDGE_BASE_PATH = ORIGINAL_ENV;
    }
  });

  it('uses KNOWLEDGE_BASE_PATH env var when set', () => {
    process.env.KNOWLEDGE_BASE_PATH = path.join(os.tmpdir(), 'fake-kb');
    const resolved = resolveProjectsMapPath();
    expect(resolved).toBe(path.join(os.tmpdir(), 'fake-kb', 'PROJECTS_MAP.md'));
  });

  it('falls back to cwd-relative ../Knowledge-Base/ when env var is unset', () => {
    delete process.env.KNOWLEDGE_BASE_PATH;
    const resolved = resolveProjectsMapPath();
    expect(resolved).toBe(
      path.join(process.cwd(), '..', 'Knowledge-Base', 'PROJECTS_MAP.md')
    );
  });
});

describe('readProjectsMap', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'projects-map-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('reads and parses a real file from disk', async () => {
    const file = path.join(tmpDir, 'PROJECTS_MAP.md');
    await fs.writeFile(file, HAPPY_PATH, 'utf-8');
    const result = await readProjectsMap(file);
    expect(result.projects).toHaveLength(2);
    expect(result.edges).toHaveLength(3);
  });

  it('throws ENOENT when the file does not exist', async () => {
    const missing = path.join(tmpDir, 'does-not-exist.md');
    await expect(readProjectsMap(missing)).rejects.toThrow(/ENOENT/);
  });
});
