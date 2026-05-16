// Server-only skill discovery for the Agentic OS admin page (step 8 / Pattern C).
//
// Discovers project-local skills by reading `<projectPath>/.claude/skills/*/SKILL.md`.
// Each subdirectory is treated as a candidate skill; if it contains a SKILL.md
// (any reasonable size, see SKILL_FILE_MAX_BYTES), its YAML frontmatter is
// parsed via gray-matter for the `name` + `description` fields. Folder name
// (slug) is the canonical handle the launch route uses to build `claude -p /<slug>`.
//
// Design notes:
//   - NEVER throws. Per-project failures are isolated into a populated `error`
//     field so one broken `.claude/skills` directory does not poison the entire
//     admin page render.
//   - Hard limits to bound DoS surface: at most SKILL_MAX_COUNT skill folders
//     are read per project (additional ones set `truncated: true` on the
//     result), and SKILL.md files larger than SKILL_FILE_MAX_BYTES are skipped
//     with a console.warn (no parse, no entry).
//   - Path safety: we hardcode the `.claude/skills` suffix and join via
//     path.join. No user input flows into filesystem paths; the only "input"
//     is the owner-curated project path from PROJECTS_MAP.md, which is plausibility
//     -checked here (absolute, no NUL, doesn't start with `-`).
//   - We only READ frontmatter (gray-matter handles untrusted markdown safely
//     as plain text; YAML parsing uses js-yaml's safe schema). We NEVER execute
//     or evaluate SKILL.md content -- it is for display only.
//   - We follow at most one level of directory descent (children of
//     `.claude/skills/`). Symlinks inside that directory ARE followed by
//     fs.stat / fs.readFile per Node's default behavior; we accept that for
//     parity with how Claude Code itself resolves SKILL.md files, but we use
//     the lexical child name as the slug rather than the symlink target so a
//     malicious symlink can't claim a different display slug. We also do not
//     recurse into nested skill folders.
//
// Architecture spec: .tmp_presentation/master/AGENTIC_OS_ARCHITECTURE.md §6
// (Pattern C - skill-targeted discovery).

import { promises as fs } from 'fs';
import path from 'path';
import matter from 'gray-matter';

/** Maximum number of skill folders read per project. Additional ones set truncated. */
const SKILL_MAX_COUNT = 50;
/** Maximum SKILL.md file size in bytes. Larger files are skipped with a warning. */
const SKILL_FILE_MAX_BYTES = 64 * 1024; // 64 KiB

/** Slug pattern used by the launch route to assemble `/<slug>`. Kept in
 *  sync with the regex in launch-schemas.ts; if you change one, change both. */
const SKILL_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,40}$/i;

export interface SkillEntry {
  /** Slug (folder name). Used as the launch action key. */
  slug: string;
  /** Human-friendly name from frontmatter, or slug if absent. */
  name: string;
  /** One-line description from frontmatter. */
  description?: string;
}

export interface ProjectSkills {
  /** Mirrors the input projectName so callers can key by name. */
  projectName: string;
  /** Discovered skills, in directory-listing order (typically lexical). */
  skills: SkillEntry[];
  /** Populated when discovery hit a per-project failure -- e.g. EACCES. */
  error?: string;
  /** True when the directory contained more than SKILL_MAX_COUNT folders;
   *  the slice was capped and we stopped reading. */
  truncated?: boolean;
}

/**
 * Reject paths that would be unsafe to pass to filesystem APIs. Matches the
 * intent of git-activity.ts::isPlausibleProjectPath but locally duplicated to
 * avoid importing the git-activity module (and its child_process surface)
 * just for one helper.
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
 * Read one SKILL.md file and produce a SkillEntry. Returns null on any
 * recoverable failure (missing file, too large, malformed frontmatter, etc.)
 * so the caller can simply skip the entry.
 */
async function readOneSkill(
  skillDirAbs: string,
  slug: string,
): Promise<SkillEntry | null> {
  const skillMdAbs = path.join(skillDirAbs, 'SKILL.md');

  // stat first so we can enforce the size cap BEFORE reading. fs.stat follows
  // symlinks by default which matches the behavior we want (a symlinked
  // SKILL.md inside an allowlisted project should still resolve).
  let st;
  try {
    st = await fs.stat(skillMdAbs);
  } catch {
    return null; // ENOENT or permission denied -- treat as "no skill here".
  }
  if (!st.isFile()) return null;
  if (st.size > SKILL_FILE_MAX_BYTES) {
    console.warn(
      `[skill-discovery] skipping oversized SKILL.md (${st.size} bytes) at ${skillMdAbs}`,
    );
    return null;
  }

  let raw: string;
  try {
    raw = await fs.readFile(skillMdAbs, 'utf-8');
  } catch {
    return null;
  }

  let fm: Record<string, unknown> = {};
  try {
    // gray-matter returns { data, content }. We only use data (the YAML
    // frontmatter). If frontmatter is absent, data is an empty object.
    const parsed = matter(raw);
    if (parsed.data && typeof parsed.data === 'object') {
      fm = parsed.data as Record<string, unknown>;
    }
  } catch {
    // Malformed YAML -- treat as "no usable frontmatter" rather than fail.
    fm = {};
  }

  // `name` falls back to the slug if frontmatter is missing or non-string.
  // `description` stays absent when missing so the UI can render the empty
  // state cleanly.
  const nameRaw = coerceFrontmatterString(fm.name, 120);
  const descRaw = coerceFrontmatterString(fm.description, 400);

  const entry: SkillEntry = {
    slug,
    name: nameRaw ?? slug,
  };
  if (descRaw) entry.description = descRaw;
  return entry;
}

/**
 * Discover skills for a single project. Reads each
 * `<projectPath>/.claude/skills/<slug>/SKILL.md` and returns a ProjectSkills bundle.
 *
 * Never throws. Failures populate the `error` field instead.
 */
export async function discoverProjectSkills(
  projectPath: string,
  projectName: string,
): Promise<ProjectSkills> {
  if (!isPlausibleProjectPath(projectPath)) {
    return {
      projectName,
      skills: [],
      error: 'invalid_or_missing_path',
    };
  }

  const skillsRoot = path.join(projectPath, '.claude', 'skills');

  let entries;
  try {
    entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    // ENOENT is the common "this project has no .claude/skills folder" case;
    // it is NOT an error -- return an empty list with no error field so the
    // UI shows the "no skills discovered" placeholder instead of a red note.
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return { projectName, skills: [] };
    }
    return {
      projectName,
      skills: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Filter to plausible skill folders: directories (or symlinks that resolve
  // to directories), non-dotfiles, slug matches the lock regex.
  // We do NOT pre-resolve symlinks because Dirent.isDirectory() returns false
  // for symlinks -- we use isDirectory() || isSymbolicLink() and let the
  // subsequent readOneSkill::fs.stat resolve symlink targets. This matches
  // the policy "follow symlinks for SKILL.md content, but use the lexical
  // child name as the slug".
  const candidateNames: string[] = [];
  for (const e of entries) {
    const name = e.name;
    if (!name || name.startsWith('.')) continue; // dotfiles + ".", "..", ".cache"
    if (!SKILL_SLUG_RE.test(name)) continue;
    if (!e.isDirectory() && !e.isSymbolicLink()) continue;
    candidateNames.push(name);
  }

  // Cap before doing any I/O so a directory with thousands of folders cannot
  // cause us to issue thousands of stat calls.
  let truncated = false;
  let names = candidateNames;
  if (names.length > SKILL_MAX_COUNT) {
    names = names.slice(0, SKILL_MAX_COUNT);
    truncated = true;
  }

  const settled = await Promise.all(
    names.map((name) => readOneSkill(path.join(skillsRoot, name), name)),
  );

  const skills: SkillEntry[] = [];
  for (const s of settled) {
    if (s) skills.push(s);
  }

  const result: ProjectSkills = { projectName, skills };
  if (truncated) result.truncated = true;
  return result;
}

/**
 * Parallel fan-out for all projects, mirroring getAllProjectsActivity's API.
 * Per-project failures are isolated to that project's `error` field; the
 * overall promise always resolves.
 */
export async function discoverAllProjectSkills(
  projects: ReadonlyArray<{ name: string; path: string }>,
): Promise<Record<string, ProjectSkills>> {
  const results = await Promise.all(
    projects.map((p) => discoverProjectSkills(p.path, p.name)),
  );
  return Object.fromEntries(results.map((r) => [r.projectName, r]));
}

// Exported for tests + future cross-module slug validation. Callers MUST NOT mutate.
export const __SKILL_SLUG_RE_FOR_TEST = SKILL_SLUG_RE;
export const __SKILL_MAX_COUNT_FOR_TEST = SKILL_MAX_COUNT;
export const __SKILL_FILE_MAX_BYTES_FOR_TEST = SKILL_FILE_MAX_BYTES;
