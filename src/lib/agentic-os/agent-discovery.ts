// Server-only agent discovery for the Agentic OS admin page (step 10 / Pattern D).
//
// Discovers Claude Code agents from TWO scopes:
//   1. Project-scoped: <projectPath>/.claude/agents/<slug>.md
//   2. Global / user-scoped: ~/.claude/agents/<slug>.md
//
// Agents differ structurally from skills: a skill is a folder with SKILL.md
// inside it (`.claude/skills/<slug>/SKILL.md`); an agent is a single .md file
// directly under `.claude/agents/<slug>.md`. The slug is the filename without
// its `.md` extension.
//
// Each file's YAML frontmatter is parsed via gray-matter for `name` +
// `description` fields. The slug (filename) is the canonical handle the
// launch route uses to build the `claude --agent <slug> --bg "<prompt>"`
// invocation.
//
// Design notes (mirrors skill-discovery.ts):
//   - NEVER throws. Per-scope failures populate the result's `error` field
//     so a single broken `.claude/agents` directory does not poison the
//     entire admin page render.
//   - Hard limits bound DoS surface: at most AGENT_MAX_COUNT files are read
//     per scope (additional ones set `truncated: true`), and any single
//     file exceeding AGENT_FILE_MAX_BYTES is skipped with a console.warn.
//   - Path safety: project paths are plausibility-checked (absolute, no NUL,
//     no leading dash). Global agents resolve from os.homedir() which is
//     the canonical single-machine boundary.
//   - We only READ frontmatter (gray-matter handles untrusted markdown
//     safely as plain text; YAML parsing uses js-yaml's safe schema). We
//     NEVER execute or evaluate agent file content -- it is for display only.
//   - We do not recurse into subdirectories inside `.claude/agents/`. Only
//     files (or symlinks to files) directly under it are considered.
//   - Slug validation: the slug regex must match. This is BOTH a sanity
//     filter AND a defense against weird filenames (`..foo.md`, names with
//     shell metachars, etc) -- even though such filenames typically can't
//     exist on Windows, we filter explicitly so the slug can be embedded
//     into argv without further escaping later.
//
// Architecture spec: .tmp_presentation/master/AGENTIC_OS_HANDOFF.md §8
// (Pattern D - agent discovery + spawn).

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import matter from 'gray-matter';

/** Maximum number of agent files read per scope. Additional ones set truncated. */
const AGENT_MAX_COUNT = 50;
/** Maximum agent .md file size in bytes. Larger files are skipped with a warning. */
const AGENT_FILE_MAX_BYTES = 64 * 1024; // 64 KiB

/** Slug pattern for agent filenames (without .md extension). Kept in lockstep
 *  with AGENT_SLUG_PATTERN in launch-schemas.ts; if you change one, change both.
 *  Matches the same shape as the skill slug pattern: [a-z0-9-] case-insensitive,
 *  starts with alphanumeric, length 1-41. */
export const AGENT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,40}$/i;

export interface AgentEntry {
  /** Slug = filename without `.md`, used as the launch action argument. */
  slug: string;
  /** Human-friendly name from frontmatter, or slug if absent. */
  name: string;
  /** One-line description from frontmatter. */
  description?: string;
  /** Where it was discovered. */
  scope: 'project' | 'global';
}

export interface ProjectAgents {
  /** Mirrors the input projectName so callers can key by name. */
  projectName: string;
  /** Project-scoped agents from <project>/.claude/agents/*.md */
  projectAgents: AgentEntry[];
  /** Global agents from ~/.claude/agents/*.md (same list for every project). */
  globalAgents: AgentEntry[];
  /** Populated when project-scoped discovery hit a per-project failure. */
  error?: string;
  /** True when the project-scoped directory contained more files than the cap. */
  truncated?: boolean;
}

/**
 * Reject paths that would be unsafe to pass to filesystem APIs. Mirrors the
 * helper in skill-discovery.ts (locally duplicated to keep this module
 * dependency-light and self-contained).
 */
function isPlausibleProjectPath(p: string): boolean {
  if (!p || typeof p !== 'string') return false;
  if (p.startsWith('-')) return false;
  if (p.includes('\0')) return false;
  return path.isAbsolute(p);
}

/**
 * Coerce a frontmatter value into a trimmed string suitable for display.
 * Anything non-string (number, array, object, null, undefined) returns null.
 * Bounded length so a hostile frontmatter cannot inflate page payload.
 */
function coerceFrontmatterString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

/**
 * Read one agent .md file and produce an AgentEntry. Returns null on any
 * recoverable failure (missing file, too large, not a regular file, etc.)
 * so the caller can simply skip the entry.
 */
async function readOneAgent(
  agentFileAbs: string,
  slug: string,
  scope: 'project' | 'global',
): Promise<AgentEntry | null> {
  // stat first so we can enforce the size cap BEFORE reading. fs.stat follows
  // symlinks by default which matches the behavior we want (a symlinked
  // agent .md inside an allowlisted directory should still resolve).
  let st;
  try {
    st = await fs.stat(agentFileAbs);
  } catch {
    return null; // ENOENT or permission denied -- treat as "no agent here".
  }
  if (!st.isFile()) return null;
  if (st.size > AGENT_FILE_MAX_BYTES) {
    console.warn(
      `[agent-discovery] skipping oversized agent file (${st.size} bytes) at ${agentFileAbs}`,
    );
    return null;
  }

  let raw: string;
  try {
    raw = await fs.readFile(agentFileAbs, 'utf-8');
  } catch {
    return null;
  }

  let fm: Record<string, unknown> = {};
  try {
    const parsed = matter(raw);
    if (parsed.data && typeof parsed.data === 'object') {
      fm = parsed.data as Record<string, unknown>;
    }
  } catch {
    // Malformed YAML -- treat as "no usable frontmatter" rather than fail.
    fm = {};
  }

  const nameRaw = coerceFrontmatterString(fm.name, 120);
  const descRaw = coerceFrontmatterString(fm.description, 400);

  const entry: AgentEntry = {
    slug,
    name: nameRaw ?? slug,
    scope,
  };
  if (descRaw) entry.description = descRaw;
  return entry;
}

/**
 * Internal helper: discover agents under a specific `.claude/agents/`
 * directory. Returns a triple of {entries, truncated, error} so the two
 * call sites (project + global) can wire the result into their respective
 * shapes.
 *
 * Filters directory entries to:
 *   - Files (or symlinks; resolved by readOneAgent::fs.stat).
 *   - Names ending in `.md` (case-insensitive).
 *   - Slug (filename minus `.md`) matching AGENT_SLUG_PATTERN.
 *
 * Caps at AGENT_MAX_COUNT BEFORE doing per-file I/O so a directory with
 * thousands of files cannot cause us to issue thousands of stat calls.
 */
async function discoverAgentsInDir(
  agentsRoot: string,
  scope: 'project' | 'global',
): Promise<{ entries: AgentEntry[]; truncated: boolean; error?: string }> {
  let dirents;
  try {
    dirents = await fs.readdir(agentsRoot, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    // ENOENT / ENOTDIR is the common "no agents directory here" case;
    // not an error.
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return { entries: [], truncated: false };
    }
    return {
      entries: [],
      truncated: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const candidates: { name: string; slug: string }[] = [];
  for (const e of dirents) {
    const name = e.name;
    if (!name || name.startsWith('.')) continue;
    // Case-insensitive `.md` suffix. We compare lowercase to be tolerant
    // of `Foo.MD` on case-insensitive filesystems (Windows).
    const lower = name.toLowerCase();
    if (!lower.endsWith('.md')) continue;
    // Files or symlinks (resolved later by stat).
    if (!e.isFile() && !e.isSymbolicLink()) continue;
    // Slug = filename without extension, using the ORIGINAL case-preserved
    // basename (slugs are case-insensitive per the regex; preserving case
    // keeps display name consistent with the on-disk filename).
    const slug = name.slice(0, name.length - 3);
    if (!AGENT_SLUG_PATTERN.test(slug)) continue;
    candidates.push({ name, slug });
  }

  // Cap before issuing any I/O.
  let truncated = false;
  let take = candidates;
  if (take.length > AGENT_MAX_COUNT) {
    take = take.slice(0, AGENT_MAX_COUNT);
    truncated = true;
  }

  const settled = await Promise.all(
    take.map((c) => readOneAgent(path.join(agentsRoot, c.name), c.slug, scope)),
  );

  const entries: AgentEntry[] = [];
  for (const a of settled) {
    if (a) entries.push(a);
  }
  return { entries, truncated };
}

/**
 * Discover GLOBAL (user-scoped) agents from `~/.claude/agents/*.md`.
 * Returns an empty list (no error) when the directory is absent. Other
 * failures (e.g. EACCES) surface as a populated error... but since global
 * agents share a single list across all project rows, we log the error and
 * still return an empty list so per-project rendering proceeds normally.
 *
 * Never throws.
 */
export async function discoverGlobalAgents(): Promise<AgentEntry[]> {
  const homeDir = os.homedir();
  if (!homeDir || typeof homeDir !== 'string') {
    // Defensive: os.homedir() is documented to never return null on supported
    // platforms, but if some pathological environment returns falsy, treat
    // as "no global agents".
    return [];
  }
  const agentsRoot = path.join(homeDir, '.claude', 'agents');
  const result = await discoverAgentsInDir(agentsRoot, 'global');
  if (result.error) {
    console.warn(
      `[agent-discovery] global agent discovery failed at ${agentsRoot}: ${result.error}`,
    );
  }
  return result.entries;
}

/**
 * Discover PROJECT-scoped agents AND attach the (caller-provided) global
 * agents list. The global list is identical across every project, so
 * callers using `discoverAllProjectAgents` should resolve it ONCE per page
 * render and pass it in here for each project to avoid N filesystem reads.
 *
 * Never throws. Per-project failures populate the `error` field.
 */
export async function discoverProjectAgents(
  projectPath: string,
  projectName: string,
  globalAgents: AgentEntry[] = [],
): Promise<ProjectAgents> {
  if (!isPlausibleProjectPath(projectPath)) {
    return {
      projectName,
      projectAgents: [],
      globalAgents,
      error: 'invalid_or_missing_path',
    };
  }

  const agentsRoot = path.join(projectPath, '.claude', 'agents');
  const result = await discoverAgentsInDir(agentsRoot, 'project');

  const out: ProjectAgents = {
    projectName,
    projectAgents: result.entries,
    globalAgents,
  };
  if (result.error) out.error = result.error;
  if (result.truncated) out.truncated = true;
  return out;
}

/**
 * Parallel fan-out for all projects. Resolves the global agent list ONCE
 * (re-read fresh on every call -- the page is server-rendered per request
 * via `force-dynamic`; a stale cache is worse than a small re-read), then
 * fans out per-project discovery in parallel.
 *
 * Per-project failures are isolated to that project's `error` field; the
 * overall promise always resolves.
 */
export async function discoverAllProjectAgents(
  projects: ReadonlyArray<{ name: string; path: string }>,
): Promise<Record<string, ProjectAgents>> {
  const globalAgents = await discoverGlobalAgents();
  const results = await Promise.all(
    projects.map((p) => discoverProjectAgents(p.path, p.name, globalAgents)),
  );
  return Object.fromEntries(results.map((r) => [r.projectName, r]));
}

// Exported for tests. Callers MUST NOT mutate.
export const __AGENT_SLUG_PATTERN_FOR_TEST = AGENT_SLUG_PATTERN;
export const __AGENT_MAX_COUNT_FOR_TEST = AGENT_MAX_COUNT;
export const __AGENT_FILE_MAX_BYTES_FOR_TEST = AGENT_FILE_MAX_BYTES;
