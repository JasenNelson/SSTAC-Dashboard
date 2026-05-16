// Zod schemas for the Agentic OS launch route (step 6a).
//
// The launch route accepts a small, defensive payload: a project name and
// an action name. Both are validated as bounded strings here; the actual
// semantic allowlist (project membership + command template lookup) lives
// in launch-validator.ts. This split keeps zod's job narrow (shape + bounds)
// and lets the validator perform constant-time Set / object lookups against
// hardcoded allowlists.
//
// Bounds rationale:
//   - project max 120 chars: longest current entry is ~40 chars
//     ("Regulatory-Review-worktrees/engine-v2"); 120 leaves headroom while
//     bounding worst-case argv length.
//   - action max 60 chars: action keys are short snake_case identifiers
//     ("run_safe_exit"); 60 is more than enough.
//
// Architecture spec: .tmp_presentation/master/AGENTIC_OS_ARCHITECTURE.md
// section 5 (gate 5).

import { z } from 'zod';

// Skill-slug pattern (step 8 / Pattern C). MUST stay in lockstep with
// SKILL_SLUG_RE in skill-discovery.ts. Locks to [a-z0-9-] (case-insensitive),
// starts with an alphanumeric, length 1-41. Strict enough that no shell
// metachar, path traversal token, dot, slash, or whitespace can appear --
// so the slug can be embedded inside argv (`/<slug>`) without escaping.
export const SKILL_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,40}$/i;

// Agent-slug pattern (step 10 / Pattern D). MUST stay in lockstep with
// AGENT_SLUG_PATTERN in agent-discovery.ts. Same shape as the skill slug
// (filename minus `.md` for an agent .md file under `.claude/agents/`).
// Locked here as a separate constant -- if/when the two patterns diverge
// (e.g. agents grow underscores), this single source of truth flips
// without touching the skill side.
export const AGENT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,40}$/i;

// Tight, defensive shape. Action is a literal string matched against the
// command-templates allowlist server-side (launch-validator.ts).
//
// .strict() rejects unknown keys so a sloppy / hostile client cannot smuggle
// extra fields past the schema. The route only reads `project` + `action`
// (+ optional `skillSlug` for run_skill, step 8; + optional `agentSlug`
// for run_agent, step 10); strict-rejection makes any future field
// additions a deliberate change.
//
// Step 8 (Pattern C): a single generic `run_skill` template handles all
// discovered skills via a `skillSlug` argument. Step 10 (Pattern D): a
// single generic `run_agent` template handles all discovered agents via
// an `agentSlug` argument. We did NOT add per-skill or per-agent entries
// to COMMAND_TEMPLATES because that would dynamically expand the
// allowlist at runtime, which is exactly the kind of widening that broke
// the allowlist-only invariant. The slug regexes above are the security
// boundary; the validator re-checks them before building argv.
export const LaunchRequestSchema = z
  .object({
    project: z.string().min(1).max(120),
    action: z.string().min(1).max(60),
    skillSlug: z.string().regex(SKILL_SLUG_PATTERN).optional(),
    agentSlug: z.string().regex(AGENT_SLUG_PATTERN).optional(),
  })
  .strict();

export type LaunchRequest = z.infer<typeof LaunchRequestSchema>;

// Step 9 (Pattern E): the PTY token-mint route reuses the project + action
// pair from LaunchRequestSchema but limits action to the single
// `open_embedded` literal. We keep a tighter schema here so the token-mint
// route cannot be tricked into minting a token for a Pattern A skill or
// the wt.exe pop-out action -- both have separate, already-shipped
// HTTP entrypoints that should remain the only way to spawn them.
//
// The schema also adds defensive bounds on `cols` / `rows` that the
// browser may send to seed the initial PTY window size. Both are
// optional; if absent, the PTY server uses 80x24. Bounds prevent a
// degenerate caller from requesting a 1x1000000 PTY that would explode
// xterm.js memory before the WS even connects.
export const PtyTokenRequestSchema = z
  .object({
    project: z.string().min(1).max(120),
    action: z.literal('open_embedded'),
    cols: z.number().int().min(1).max(1000).optional(),
    rows: z.number().int().min(1).max(1000).optional(),
  })
  .strict();

export type PtyTokenRequest = z.infer<typeof PtyTokenRequestSchema>;
