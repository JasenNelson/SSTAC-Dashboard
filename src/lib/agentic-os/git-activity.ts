// Server-only utility that reads per-project git activity for the Agentic OS
// admin page. Spawns `git -C <path> log` once per project and aggregates the
// output into a daily-counts series (for the sparkline) plus the N most-recent
// commits (for the right detail panel).
//
// Architecture spec: .tmp_presentation/master/AGENTIC_OS_ARCHITECTURE.md §8.
// Handoff anti-pattern #4: never interpolate user input into shell strings.
// We use spawn (not exec) and pass args as an array; the only "input" is the
// owner-curated project path from PROJECTS_MAP.md, but defense in depth
// matters because the path is later used as a CLI arg to git -- a hostile
// path containing `--upload-pack=...` could otherwise abuse git's behavior.
// (Passing as an array prevents shell interpretation but git itself may still
//  interpret an arg starting with `-` as a flag; the validatePath check below
//  rejects that.)
//
// Process model: short-lived `git log` invocation, captured stdout, 8s timeout,
// killed on timeout via SIGTERM. Never throws to callers -- failures resolve
// as a ProjectActivity with the `error` field populated, so the page can
// render an "activity unavailable" affordance per project instead of
// crashing the whole admin view.

import { spawn } from 'child_process';
import path from 'path';

export interface DailyCommitCount {
  /** ISO YYYY-MM-DD in the local timezone (matches git's %cs format). */
  date: string;
  count: number;
}

export interface RecentCommit {
  /** Short commit SHA (git %h). */
  sha: string;
  /** Strict ISO 8601 timestamp of the commit (git %ci). */
  authoredAt: string;
  /** First line of the commit message (git %s). */
  subject: string;
}

export interface ProjectActivity {
  projectName: string;
  /** Length = `days`. Oldest first, today last. Empty days are { count: 0 }. */
  daily: DailyCommitCount[];
  /** At most `recentCount` entries, most-recent first. */
  recent: RecentCommit[];
  /** Sum of all `daily[i].count` values within the window. */
  totalCommits: number;
  /** ISO 8601 timestamp of the latest commit in the window, or null. */
  lastCommitAt: string | null;
  /** Populated when the lookup failed -- consumers should render a gentle fallback. */
  error?: string;
}

const DEFAULT_DAYS = 14;
const DEFAULT_RECENT_COUNT = 5;
const SPAWN_TIMEOUT_MS = 8_000;

// Build the empty/zero-activity shape we return on error so consumers don't
// have to special-case undefined arrays. The `daily` window is still the
// correct length so sparklines render a flat baseline instead of disappearing.
function makeEmptyActivity(projectName: string, days: number): ProjectActivity {
  return {
    projectName,
    daily: buildDailyWindow(days, new Map()),
    recent: [],
    totalCommits: 0,
    lastCommitAt: null,
  };
}

/**
 * Reject paths that would be interpreted as flags by git, or that are
 * relative/empty. We accept any absolute path that does not start with `-`
 * and does not contain a NUL byte (paranoia for path embedded into argv).
 */
function isPlausibleProjectPath(p: string): boolean {
  if (!p || typeof p !== 'string') return false;
  if (p.startsWith('-')) return false; // would be parsed as a flag
  if (p.includes('\0')) return false;
  // path.isAbsolute handles both POSIX and Windows ("/foo" and "C:\foo").
  return path.isAbsolute(p);
}

/**
 * Build a `days`-long sequence of ISO dates, oldest first, populated from
 * the provided counts map. Today is always the last entry.
 */
function buildDailyWindow(
  days: number,
  counts: Map<string, number>
): DailyCommitCount[] {
  const safeDays = Math.max(1, Math.floor(days));
  const result: DailyCommitCount[] = [];
  // Anchor "today" at midnight local time so the same date-string layout
  // git emits (%cs is local-tz date) lines up with our indexing.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = safeDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    // Format as YYYY-MM-DD using the local timezone to match git's %cs.
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    result.push({ date: iso, count: counts.get(iso) ?? 0 });
  }
  return result;
}

/**
 * Run `git log` in `projectPath` and resolve with stdout. Rejects on
 * spawn-error, non-zero exit, or timeout. Caller is responsible for
 * catching and translating into a ProjectActivity error field.
 */
function runGitLog(projectPath: string, days: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    // %h short sha | %cs short date (YYYY-MM-DD) | %ci strict ISO | %s subject.
    // Tab-delimited via %x09 -- subjects almost never contain tabs, and the
    // parser uses indexOf so any stray tabs in a subject still land in the
    // subject slice rather than corrupting earlier fields.
    const args = [
      '-C',
      projectPath,
      'log',
      `--since=${days} days ago`,
      '--no-merges',
      '--pretty=format:%h%x09%cs%x09%ci%x09%s',
    ];

    let child;
    try {
      child = spawn('git', args, { windowsHide: true });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const timer = setTimeout(() => {
      try { child.kill('SIGTERM'); } catch { /* already gone */ }
      settle(() => reject(new Error('git_log_timeout')));
    }, SPAWN_TIMEOUT_MS);

    child.stdout?.on('data', (c: Buffer) => stdoutChunks.push(c));
    child.stderr?.on('data', (c: Buffer) => stderrChunks.push(c));

    child.on('error', (err) => {
      clearTimeout(timer);
      settle(() => reject(err));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        settle(() => resolve(Buffer.concat(stdoutChunks).toString('utf-8')));
      } else {
        const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();
        settle(() =>
          reject(
            new Error(
              `git exited ${code}${stderr ? `: ${stderr.slice(0, 200)}` : ''}`
            )
          )
        );
      }
    });
  });
}

/** Parse the tab-delimited git-log stdout into structured fields. */
function parseGitLogOutput(
  projectName: string,
  stdout: string,
  days: number,
  recentCount: number
): ProjectActivity {
  const lines = stdout.split('\n').filter((l) => l.length > 0);
  const counts = new Map<string, number>();
  const recent: RecentCommit[] = [];
  let lastCommitAt: string | null = null;
  let total = 0;

  for (const line of lines) {
    const i1 = line.indexOf('\t');
    const i2 = i1 >= 0 ? line.indexOf('\t', i1 + 1) : -1;
    const i3 = i2 >= 0 ? line.indexOf('\t', i2 + 1) : -1;
    if (i1 < 0 || i2 < 0 || i3 < 0) continue; // malformed -- skip silently

    const sha = line.slice(0, i1);
    const cs = line.slice(i1 + 1, i2);
    const ci = line.slice(i2 + 1, i3);
    const subject = line.slice(i3 + 1);

    if (!sha || !cs) continue;

    counts.set(cs, (counts.get(cs) ?? 0) + 1);
    total += 1;
    if (!lastCommitAt || ci > lastCommitAt) lastCommitAt = ci;
    if (recent.length < recentCount) {
      recent.push({ sha, authoredAt: ci, subject });
    }
  }

  return {
    projectName,
    daily: buildDailyWindow(days, counts),
    recent,
    totalCommits: total,
    lastCommitAt,
  };
}

/**
 * Fetch git activity for a single project. Never throws -- failures resolve
 * with an ProjectActivity whose `error` field is set.
 */
export async function getProjectActivity(
  projectName: string,
  projectPath: string,
  options: { days?: number; recentCount?: number } = {}
): Promise<ProjectActivity> {
  const days = options.days ?? DEFAULT_DAYS;
  const recentCount = options.recentCount ?? DEFAULT_RECENT_COUNT;

  if (!isPlausibleProjectPath(projectPath)) {
    return {
      ...makeEmptyActivity(projectName, days),
      error: 'invalid_or_missing_path',
    };
  }

  try {
    const stdout = await runGitLog(projectPath, days);
    return parseGitLogOutput(projectName, stdout, days, recentCount);
  } catch (err) {
    return {
      ...makeEmptyActivity(projectName, days),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Parallel fan-out for all projects. Each per-project failure is isolated
 * to that project's `error` field; the overall promise always resolves.
 */
export async function getAllProjectsActivity(
  projects: ReadonlyArray<{ name: string; path: string }>,
  options: { days?: number; recentCount?: number } = {}
): Promise<Record<string, ProjectActivity>> {
  const results = await Promise.all(
    projects.map((p) => getProjectActivity(p.name, p.path, options))
  );
  return Object.fromEntries(results.map((r) => [r.projectName, r]));
}
