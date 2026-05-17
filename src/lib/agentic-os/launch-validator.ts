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
 * Pattern B (open_session) goes through cmd.exe /c start so wt.exe is
 * activated by the shell (see the open_session template below for why
 * direct-spawn does not work on the AppExecutionAlias stub). cmd.exe
 * itself is a console subsystem process we want hidden; wt.exe creates
 * its own desktop window via the AppX activation that start triggers,
 * so the parent cmd.exe never needs a console of its own. detached:true
 * + stdio:'ignore' let the parent cmd.exe exit cleanly without holding
 * pipes the started process never uses.
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
// `open_session` template that activates wt.exe via cmd.exe /c start so a
// new Windows Terminal tab opens in the project's cwd running `claude
// --resume`. Pattern C/D (skill dropdown beyond the current three, agents)
// are scheduled for steps 8/10 and intentionally NOT in this registry yet.
//
// The current set of Pattern A skill names ('safe-exit', 'update-docs',
// 'doc-navigator') matches the skills documented in CLAUDE.md /
// .claude/skills/_shared. Each spawns `claude -p '/<skill>'` with cwd set
// to the project's absolute path so the CLI picks up the project's
// .claude/settings.local.json.
//
// Pattern B (open_session) goes through cmd.exe /c start instead of
// spawning wt.exe directly. Reason (BUG-3 fix, 2026-05-16): wt.exe at
// %LOCALAPPDATA%\Microsoft\WindowsApps\wt.exe is an AppExecutionAlias
// stub -- not a real PE binary. A direct child_process.spawn('wt.exe', ...)
// with detached:true + stdio:'ignore' invokes the stub, the stub forwards
// the request to the Windows Terminal AppX background service, then the
// stub exits cleanly with code 0; but the AppX activation context Node
// hands the stub is wrong for that detached + stdio:'ignore' shape, so
// the activation message either never lands or lands in a context that
// silently drops it -- empirically NO Terminal window appears. The shell
// builtin `start` handles AppExecutionAlias activation correctly: it
// fires the AppX activation in the user's interactive shell context and
// returns immediately. So we spawn cmd.exe (a real PE) which runs
// `start wt.exe -d <cwd> claude --resume` and exits; wt.exe gets
// activated SEPARATELY via the AppX service and creates its own Terminal
// window on the user's desktop. The audit + SSE wiring still applies --
// the cmd.exe registry entry shows empty stdout and a clean exit within
// milliseconds. That's expected; the user-visible artifact is the new
// Windows Terminal tab on their desktop, owned by a different process
// tree than the dashboard's.
//
// NO empty-title `""` sentinel between `start` and `wt.exe`. An earlier
// iteration of this fix included one defensively (start interprets a
// quoted first token as the new window's title), but Node-on-Windows
// uses MSVCRT-style argv-to-cmdline quoting that escapes inner quotes
// as backslash-quote (`\"\"`), and cmd.exe's tokenizer does NOT speak
// backslash escapes -- start receives `\"\"` and reads it as a literal
// title token, then misreads `wt.exe` as the program-with-quoted-title
// payload and the activation never fires. Removing the sentinel keeps
// the argv all-unquoted, which both Node and cmd.exe agree on. wt.exe
// is a bare unquoted token here, so start's first-positional-as-title
// rule never triggers.
//
// ALTERNATIVE ARCHITECTURE (codex 2026-05-16 holistic observation, not
// implemented): resolve wt.exe's absolute path at runtime via
// `spawnSync('where', ['wt'])` and then `child_process.spawn(absPath,
// args, { detached: false, stdio: 'pipe', windowsHide: false })`. This
// sidesteps BOTH the AppExecutionAlias activation context issue AND
// the cmd-vs-Node tokenizer issue at the cost of one extra spawn per
// request and a runtime dependency on `where` working. NOT adopted
// today because the current cmd.exe shim is owner-runtime-validated
// and works. Revisit if BUG-3 ever regresses or if a future Windows /
// Node / Terminal version surfaces a new failure mode in the cmd.exe
// -> start -> AppX chain.
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
  // declares { windowsHide: true, detached: true, stdio: 'ignore' } so
  // the transient cmd.exe console stays hidden while the start-activated
  // wt.exe creates its own desktop Terminal window via AppX in a
  // separate process tree.
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
  // AI Subscriptions panel (2026-05-16): live auth-status / login-status checks
  // for providers that expose a CLI subcommand returning useful data WITHOUT
  // consuming subscription tokens. Project cwd is ignored at the semantic
  // layer (these are system-level checks, not project-local actions), but
  // path.join still produces a real cwd from the allowlisted-project name
  // for spawn-options compliance.
  //
  // IMPORTANT: only add a check_* template here when the underlying CLI
  // subcommand (a) returns useful data and (b) does NOT consume tokens.
  // Slash commands like `claude -p /cost` / `/status` / `/usage` DO consume
  // tokens AND don't actually invoke the slash command (verified 2026-05-16
  // empirical test: -p mode does not process slash commands). Stick to real
  // subcommands like `auth status` / `login status` / `list`.
  // claude + ollama distribute as real PE .exe binaries reachable on PATH,
  // so child_process.spawn invokes them directly without a shell wrapper.
  // codex + agent (cursor) ship as Windows .cmd shims, which CreateProcess
  // cannot execute directly -- spawn returns ENOENT. Wrap those two in
  // cmd.exe /c (same fix shape as BUG-3 wt.exe -- see commits 85e069c,
  // 3df94ab on this branch's main-merged history) so the shim runs through
  // the shell. Codex 2026-05-16 caught the missing wrapper on the per-
  // commit review of 8d35d31; verified empirically: spawn('codex',...)
  // and spawn('agent',...) both fail ENOENT today.
  check_claude_auth: {
    exe: 'claude',
    args: (_project: string, _cwd: string) => ['auth', 'status'],
  },
  check_codex_login: {
    exe: 'cmd.exe',
    args: (_project: string, _cwd: string) => ['/c', 'codex', 'login', 'status'],
  },
  // Cursor's agent CLI lives at C:\Users\jasen\AppData\Local\cursor-agent\agent.cmd
  // (PATHEXT-resolved by shells but NOT by child_process.spawn on Windows).
  // `agent about` returns multiline output with Subscription Tier, Model,
  // CLI Version, Terminal, Shell, User Email -- richest live-check output
  // of the supported providers. Empirically confirmed 2026-05-16: no token
  // cost. Wrapped via cmd.exe per the shim-spawn discussion above.
  check_cursor_about: {
    exe: 'cmd.exe',
    args: (_project: string, _cwd: string) => ['/c', 'agent', 'about'],
  },
  check_ollama_models: {
    exe: 'ollama',
    args: (_project: string, _cwd: string) => ['list'],
  },
  // Pattern B (step 7): Windows Terminal external pop-out. cmd.exe runs
  // `start wt.exe -d <cwd> claude --resume`, which fires the wt.exe
  // AppExecutionAlias activation via the shell and exits; the activated
  // Terminal opens its tab in the project cwd running `claude --resume`.
  // The -d flag is wt.exe's "starting directory" switch (verified vs
  // Microsoft Terminal command-line reference). The diag-wt.mjs probe
  // confirmed wt.exe is reachable on PATH from Node, so the cmd.exe shim
  // is solely to get the AppX activation context right; see the long
  // BUG-3 explanation in the COMMAND_TEMPLATES header above.
  //
  // argv contains NO user input beyond the project-derived cwd (which
  // has already cleared the project allowlist before this closure runs);
  // every other token ('/c', 'start', 'wt.exe', '-d', 'claude',
  // '--resume') is hardcoded. spawn (not exec) consumes the array, so
  // cmd.exe's own arg-parsing never interprets any token as a metachar
  // -- Node passes them through to cmd.exe's CommandLineToArgvW
  // tokenization with conservative quoting around any element that
  // contains a space (e.g. a cwd with spaces in the path).
  open_session: {
    exe: 'cmd.exe',
    args: (_project: string, cwd: string) => [
      '/c',
      'start',
      'wt.exe',
      '-d',
      cwd,
      'claude',
      '--resume',
    ],
    // Pattern B BUG-3 fix (2026-05-16, post-probe):
    //   - windowsHide:true   -> hide the transient cmd.exe console; the
    //                           started wt.exe creates its own visible
    //                           Terminal window in a separate process
    //                           tree via AppX activation,
    //   - detached:true       -> let the cmd.exe child survive parent
    //                           exit / detach from our process group on
    //                           Win32 (cmd.exe exits in ms but the
    //                           detach is belt-and-suspenders against
    //                           any pre-exit termination),
    //   - stdio:'ignore'      -> drop the pipes; cmd.exe + start don't
    //                           produce meaningful stdout for the UI,
    //                           and the log-card UX already renders an
    //                           "External terminal opened on your
    //                           desktop; no inline output expected"
    //                           empty-state keyed on action === 'open_session'.
    // The route handler also calls child.unref() when detached:true is
    // set; per Node docs the unref()+detached pair is required on
    // Windows for the child to outlive the dashboard process.
    spawnOverrides: {
      windowsHide: true,
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
