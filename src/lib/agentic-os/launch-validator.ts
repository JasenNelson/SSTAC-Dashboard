// Agentic OS launch validator (step 6a).
//
// Validates a parsed LaunchRequest against two hardcoded allowlists:
//   1. ALLOWED_PROJECTS  -- the 8 projects from Knowledge-Base/PROJECTS_MAP.md
//   2. COMMAND_TEMPLATES -- the launchable actions for step 6a
//
// Produces a ValidatedLaunch { exe, args[], cwd } that the launch route
// passes to spawnAwaitingReady. NO shell strings are ever constructed --
// args is always an array and is consumed by child_process.spawn (not exec),
// which means zero shell interpretation occurs. The only "user input" that
// reaches the subprocess is the project name, and even that only flows into
// the cwd path (joined with path.join, which normalizes separators) AFTER
// the project name has been confirmed present in ALLOWED_PROJECTS.
//
// Why projects are hardcoded (not derived from PROJECTS_MAP.md at runtime):
// reading the markdown file at request time would create an arbitrary-file-read
// primitive against the dashboard process's cwd-relative path. We trade a
// small duplication for an explicit, audit-able allowlist; if/when projects
// change, this constant is the single source of truth for the launch route.
//
// Architecture spec: .tmp_presentation/master/AGENTIC_OS_ARCHITECTURE.md
// section 5 (lines 231-277, "Launch validator (project + command allowlists)").

import path from 'path';
import type { LaunchRequest } from './launch-schemas';

// The 8 projects from PROJECTS_MAP.md. Matches the arch spec's allowlist verbatim.
const ALLOWED_PROJECTS: ReadonlySet<string> = new Set<string>([
  'Regulatory-Review',
  'Regulatory-Review-worktrees/engine-v2',
  'SSTAC-Dashboard',
  'Site3250-KB',
  'TechMemo-KB',
  'Sediment-DRA-Pipeline',
  'Knowledge-Base',
  'EnquiryMgt',
]);

// Root under which every project lives. Single-machine local-only by design
// (handoff section 14: "PROJECTS_MAP.md path resolution" -- we pin to
// C:\Projects until proven otherwise).
const PROJECTS_ROOT = 'C:\\Projects';

// Command template registry. Each entry produces a typed {exe, args[]} shape
// from the (already-validated) project name. NO user input flows into exe or
// args strings; the project name is captured only in args closures that wrap
// it inside hardcoded literals.
//
// Step 6a shipped three headless one-shots (Pattern A in the arch spec).
// Step 7 adds Pattern B (Windows Terminal external pop-out) -- a single
// `open_session` template whose exe is wt.exe and whose argv asks Windows
// Terminal to open a new tab in the project's cwd running `claude --resume`.
// Pattern C/D (skill dropdown beyond the current three, agents) are scheduled
// for steps 8/10 and intentionally NOT in this registry yet.
//
// The current set of Pattern A skill names ('safe-exit', 'update-docs',
// 'doc-navigator') matches the skills documented in CLAUDE.md /
// .claude/skills/_shared. Each spawns `claude -p '/<skill>'` with cwd set
// to the project's absolute path so the CLI picks up the project's
// .claude/settings.local.json.
//
// Pattern B (open_session) builds argv as the four-element array
// ['-d', '<absolute project path>', 'claude', '--resume']. wt.exe interprets
// -d as the inner shell's working directory; the subsequent positional tokens
// become the command line wt.exe runs in the new tab. wt.exe itself spawns a
// new desktop window and exits within milliseconds (exit code 0). The launch
// route's audit + SSE wiring still applies -- the run-registry entry will
// show empty stdout and a clean exit shortly after launch. That's expected;
// the user-visible artifact is the new Windows Terminal tab on their desktop.
interface CommandTemplate {
  readonly exe: string;
  // Pure function: project -> args. Must not consult any external state.
  // The closure receives the (already-allowlisted) project name; for
  // open_session it also receives the resolved absolute cwd so the -d
  // argument can be wired without re-deriving the path inside the closure.
  readonly args: (project: string, cwd: string) => readonly string[];
}

const COMMAND_TEMPLATES: Readonly<Record<string, CommandTemplate>> = {
  run_safe_exit: {
    exe: 'claude',
    args: (_project: string, _cwd: string) => ['-p', '/safe-exit'],
  },
  run_update_docs: {
    exe: 'claude',
    args: (_project: string, _cwd: string) => ['-p', '/update-docs'],
  },
  run_doc_navigator: {
    exe: 'claude',
    args: (_project: string, _cwd: string) => ['-p', '/doc-navigator'],
  },
  // Pattern B (step 7): Windows Terminal external pop-out. wt.exe spawns a
  // new desktop tab whose inner shell runs `claude --resume` in the project
  // cwd. The -d flag is wt.exe's "starting directory" switch (verified vs
  // Microsoft Terminal command-line reference). argv contains NO user input
  // beyond the project-derived cwd (which has already cleared the project
  // allowlist before this closure runs); the literals '-d', 'claude', and
  // '--resume' are hardcoded.
  open_session: {
    exe: 'wt.exe',
    args: (_project: string, cwd: string) => ['-d', cwd, 'claude', '--resume'],
  },
};

export interface ValidatedLaunch {
  readonly exe: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

export type LaunchValidatorResult =
  | { ok: true; value: ValidatedLaunch }
  | { ok: false; reason: 'unknown_project' | 'unknown_action' };

/**
 * Validate a parsed LaunchRequest against the project + command allowlists.
 * Returns a ValidatedLaunch on success, or a structured failure reason.
 *
 * Both lookups are constant-time (Set.has / object-key access). No user
 * input is interpolated into any string before allowlist membership has
 * been confirmed.
 */
export function validateLaunchRequest(req: LaunchRequest): LaunchValidatorResult {
  // Project allowlist check FIRST. Any non-allowlisted project (including
  // shell metachars, path-traversal attempts, empty strings that somehow
  // bypass zod, etc.) gets rejected here with no string interpolation.
  if (!ALLOWED_PROJECTS.has(req.project)) {
    return { ok: false, reason: 'unknown_project' };
  }

  const template = Object.prototype.hasOwnProperty.call(COMMAND_TEMPLATES, req.action)
    ? COMMAND_TEMPLATES[req.action]
    : undefined;
  if (!template) {
    return { ok: false, reason: 'unknown_action' };
  }

  // Build cwd from path.join so separators normalize correctly on Windows
  // ("C:\\Projects" + "Regulatory-Review-worktrees/engine-v2" becomes
  //  "C:\\Projects\\Regulatory-Review-worktrees\\engine-v2" on win32). The
  // project name has already been confirmed to be a member of the allowlist
  // so there is no traversal surface here.
  const cwd = path.join(PROJECTS_ROOT, req.project);

  // args is computed by the template closure; copied into a fresh array so
  // the caller cannot mutate the registry. The cwd is passed in so Pattern B
  // (open_session) can embed it as wt.exe's -d argument without re-deriving
  // the path inside the closure.
  const args = Array.from(template.args(req.project, cwd));

  return {
    ok: true,
    value: {
      exe: template.exe,
      args,
      cwd,
    },
  };
}

// Exported for tests + audit visibility. Callers MUST NOT mutate.
export const __ALLOWED_PROJECTS_FOR_TEST: ReadonlySet<string> = ALLOWED_PROJECTS;
export const __ALLOWED_ACTIONS_FOR_TEST: ReadonlyArray<string> = Object.freeze(
  Object.keys(COMMAND_TEMPLATES),
);
