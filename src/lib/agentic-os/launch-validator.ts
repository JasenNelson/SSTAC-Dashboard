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
import type { StdioOptions } from 'child_process';
import type { LaunchRequest } from './launch-schemas';
import { SKILL_SLUG_PATTERN, AGENT_SLUG_PATTERN } from './launch-schemas';

/**
 * Optional per-template overrides for child_process.spawn options. Most
 * templates (Pattern A skill, Pattern C run_skill, Pattern D run_agent)
 * inherit the launch route's defaults (windowsHide: true, piped stdio).
 *
 * Pattern B (open_session / wt.exe) is the one place where the defaults
 * are wrong: wt.exe IS the user-visible window we want shown, so the
 * defaults must be inverted. Holding piped stdio also prevents wt.exe
 * from cleanly detaching from the parent on Windows. The overrides let
 * the validator declare these per-template needs without leaking spawn
 * concerns into the route handler.
 *
 * The route handler reads spawnOverrides AFTER applying its defaults so
 * the override values win on conflict, and unref()s the child when
 * `detached: true` is requested (Node docs: child.unref() is required
 * for a detached child to survive parent exit on Windows).
 */
export interface SpawnOverrides {
  readonly windowsHide?: boolean;
  readonly detached?: boolean;
  readonly stdio?: StdioOptions;
}

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
  // Optional spawn-option overrides applied by the launch route on top of
  // its defaults. Absent means "use the route's defaults verbatim" -- the
  // case for every Pattern A/C/D template. Pattern B (open_session)
  // declares { windowsHide: false, detached: true, stdio: 'ignore' } so
  // wt.exe pops up its window and survives without holding our pipes.
  readonly spawnOverrides?: SpawnOverrides;
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
    // Pattern B owner-bug fix (2026-05-16): with the route's default
    //   { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
    // wt.exe either failed to show its window or got immediately
    // collected when the parent's pipes drained. wt.exe is the visible
    // window we WANT shown, so:
    //   - windowsHide:false  -> let the new Terminal window appear,
    //   - detached:true       -> let wt.exe survive parent exit /
    //                            detach from our process group on Win32,
    //   - stdio:'ignore'      -> drop the pipes wt.exe doesn't use; the
    //                            log-card UX already handles the empty-
    //                            output case ("External terminal opened
    //                            on your desktop"), and there's no SSE
    //                            value to subscribers anyway.
    // The route handler also calls child.unref() when detached:true is
    // set; per Node docs the unref()+detached pair is required on
    // Windows for wt.exe to outlive the dashboard process.
    spawnOverrides: {
      windowsHide: false,
      detached: true,
      stdio: 'ignore',
    },
  },
  // Pattern C (step 8): generic skill launcher. The slug arrives via the
  // optional `skillSlug` field on LaunchRequest. The slug is re-validated
  // against SKILL_SLUG_PATTERN inside validateLaunchRequest (defense in
  // depth -- zod already validated it at the schema layer) BEFORE this
  // closure runs. We keep the argv pattern identical to the other Pattern A
  // templates so the SSE/audit/run-card wiring needs no special-case.
  //
  // This is the ONLY template that depends on the optional skillSlug field.
  // The validator binds the slug into the closure via a fresh per-request
  // entry rather than reading it through some mutable field on the template
  // registry, so the static COMMAND_TEMPLATES remains immutable.
  //
  // We do NOT add per-skill entries to COMMAND_TEMPLATES. The allowlist-only
  // invariant is preserved by ONE generic template + a strict slug regex.
  run_skill: {
    exe: 'claude',
    // Placeholder closure -- the validator overrides this with a slug-bound
    // version at request time. If something reaches this default path the
    // result will produce argv `['-p', '/']` which the CLI will reject; the
    // validator's pre-check is still the real guarantee.
    args: (_project: string, _cwd: string) => ['-p', '/'],
  },
  // Pattern D (step 10): generic agent launcher. The slug arrives via the
  // optional `agentSlug` field on LaunchRequest. Mirrors the run_skill
  // template architecture exactly: ONE generic entry + strict slug regex
  // re-validated by validateLaunchRequest below. We do NOT add per-agent
  // entries to COMMAND_TEMPLATES.
  //
  // Invocation shape per AGENTIC_OS_HANDOFF.md §8:
  //   claude --agent <slug> --bg "<initial prompt>"
  // The --bg flag runs the agent in background mode; SSE/audit/run-card
  // plumbing handles the streamed output. The initial prompt is FIXED for
  // step 10 (Pattern D MVP); a customizable prompt is post-MVP.
  //
  // The fixed prompt is "Begin working on <project name>." with the project
  // name embedded inline. The project name has ALREADY cleared the strict
  // ALLOWED_PROJECTS allowlist before this closure runs, so no untrusted
  // tokens can reach the prompt string. The prompt is passed as a single
  // argv element via spawn (not exec), so even if a future regression
  // widened the project allowlist, no shell interpretation occurs.
  run_agent: {
    exe: 'claude',
    args: (_project: string, _cwd: string) => ['--agent', '', '--bg', ''],
  },
  // Pattern E (step 9): embedded xterm.js modal via node-pty WebSocket.
  // Same shape as Pattern B's open_session (claude --resume in the project
  // cwd) but consumed by the PTY sidecar server (scripts/agentic-os-pty-server.mjs)
  // rather than child_process.spawn at HTTP-route time. The /api/agentic-os/pty-token
  // route mints a short-lived JWT bound to this {exe, args, cwd} triple and
  // hands it to the browser, which connects to ws://localhost:3101/pty.
  //
  // The /launch route DOES NOT spawn for this action -- the
  // launch-route handler must guard against open_embedded and 400 it.
  // Defense in depth: a request reaching this template via /launch is
  // a regression, so the template still produces a structurally-valid
  // command (claude --resume) rather than something nonsensical, but the
  // launch route's open_embedded guard is the real protection.
  open_embedded: {
    exe: 'claude',
    args: (_project: string, _cwd: string) => ['--resume'],
  },
};

export interface ValidatedLaunch {
  readonly exe: string;
  readonly args: readonly string[];
  readonly cwd: string;
  /** Optional spawn-option overrides for this action; see SpawnOverrides. */
  readonly spawnOverrides?: SpawnOverrides;
}

export type LaunchValidatorResult =
  | { ok: true; value: ValidatedLaunch }
  | {
      ok: false;
      reason:
        | 'unknown_project'
        | 'unknown_action'
        | 'missing_skill_slug'
        | 'invalid_skill_slug'
        | 'missing_agent_slug'
        | 'invalid_agent_slug';
    };

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

  // Step 8 (Pattern C): the generic `run_skill` template needs the slug
  // argument BOTH to be present and to re-pass the strict regex even though
  // zod already validated it at the schema layer. Belt + suspenders -- this
  // module is the security boundary; a regression in the schema must NOT
  // widen what the spawn step accepts. Slug is the only field that flows
  // into argv beyond the hardcoded literals (-p) and the (allowlisted)
  // project-derived cwd; the strict regex prevents any shell metachar /
  // path-traversal / dot / slash / whitespace / unicode token.
  let args: string[];
  if (req.action === 'run_skill') {
    if (typeof req.skillSlug !== 'string' || req.skillSlug.length === 0) {
      return { ok: false, reason: 'missing_skill_slug' };
    }
    if (!SKILL_SLUG_PATTERN.test(req.skillSlug)) {
      return { ok: false, reason: 'invalid_skill_slug' };
    }
    args = ['-p', `/${req.skillSlug}`];
  } else if (req.action === 'run_agent') {
    // Step 10 (Pattern D): generic agent launcher. The slug is re-validated
    // against AGENT_SLUG_PATTERN here even though zod already did so at the
    // schema layer -- belt + suspenders, this module is the security boundary.
    // The fixed step-10 prompt embeds the (already-allowlisted) project name.
    // Argv is a 4-element array consumed by child_process.spawn (not exec),
    // so NO shell interpretation occurs even on the prompt string.
    if (typeof req.agentSlug !== 'string' || req.agentSlug.length === 0) {
      return { ok: false, reason: 'missing_agent_slug' };
    }
    if (!AGENT_SLUG_PATTERN.test(req.agentSlug)) {
      return { ok: false, reason: 'invalid_agent_slug' };
    }
    args = ['--agent', req.agentSlug, '--bg', `Begin working on ${req.project}.`];
  } else {
    // args is computed by the template closure; copied into a fresh array so
    // the caller cannot mutate the registry. The cwd is passed in so Pattern B
    // (open_session) can embed it as wt.exe's -d argument without re-deriving
    // the path inside the closure.
    args = Array.from(template.args(req.project, cwd));
  }

  return {
    ok: true,
    value: {
      exe: template.exe,
      args,
      cwd,
      // Propagate spawn-option overrides verbatim when the template defines
      // them. Omitted (undefined) means the route uses its plain defaults.
      ...(template.spawnOverrides ? { spawnOverrides: template.spawnOverrides } : {}),
    },
  };
}

// Exported for tests + audit visibility. Callers MUST NOT mutate.
export const __ALLOWED_PROJECTS_FOR_TEST: ReadonlySet<string> = ALLOWED_PROJECTS;
export const __ALLOWED_ACTIONS_FOR_TEST: ReadonlyArray<string> = Object.freeze(
  Object.keys(COMMAND_TEMPLATES),
);
