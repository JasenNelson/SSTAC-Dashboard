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

// Tight, defensive shape. Action is a literal string matched against the
// command-templates allowlist server-side (launch-validator.ts).
//
// .strict() rejects unknown keys so a sloppy / hostile client cannot smuggle
// extra fields past the schema. The route only reads `project` + `action`,
// but strict-rejection makes any future field additions a deliberate change.
export const LaunchRequestSchema = z
  .object({
    project: z.string().min(1).max(120),
    action: z.string().min(1).max(60),
  })
  .strict();

export type LaunchRequest = z.infer<typeof LaunchRequestSchema>;
