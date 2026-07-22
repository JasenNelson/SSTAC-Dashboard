# Port brief: build an SSTAC /sessionstart skill (2026-07-06)

> PROVENANCE ONLY (added 2026-07-22): the skill this brief specifies was already built --
> see .claude/skills/sessionstart/SKILL.md. Do NOT execute this brief as current
> instructions.

Handed off from the OpenHarness-dev session that built the original. Plain ASCII.

## Why you are getting this
OpenHarness-dev built a `/sessionstart` fresh-session ritual + wired a GLOBAL SessionStart hook
(`~/.claude/settings.json`) to auto-perform it. A side effect: a fresh SSTAC session CROSS-READ OHD's
skill and started performing it -- orienting to OHD's docs/tooling, which is WRONG for SSTAC. You got
the ritual SKELETON but with OHD's project-specific content. The owner is making the global hook
project-conditional (so a project without its own skill falls back cleanly to the plain codex/AGY
opt-in). Your job when you have bandwidth: give SSTAC its OWN /sessionstart skill so it auto-fires
correctly for THIS project.

## What the ritual is (the reusable skeleton -- copy from OHD)
Reference skeleton: `C:\Projects\OpenHarness-dev\.claude\skills\sessionstart\SKILL.md` (+ design
rationale in `C:\Projects\OpenHarness-dev\docs\SESSION_FRAMEWORK_AND_DECISIONS_2026_07_06.md` Part 1).
The PROJECT-AGNOSTIC skeleton (reuse as-is): active orientation -> a verify-before-assert HANDOFF
SMELL-TEST -> GATE 1 (review DEPTH: Quick/Standard/Deep/Exhaustive, budget-aware) -> GATE 2 (DELEGATION
+ codex posture, kept a SEPARATE question to avoid accidental consent) -> a printed SESSION CONTRACT
(depth, trusted-vs-unverified handoff claims WITH evidence, protected paths, review loop, stop
conditions). disable-model-invocation: true; the global hook triggers it by read-and-perform.

## What YOU must supply (the SSTAC-specific content layer)
Replace OHD's specifics with SSTAC's:
- **Read-first stack:** `SSTAC-Dashboard/CLAUDE.md` (L1), `docs/GATE_MODE_SOP.md` (gate authority),
  the current SSTAC plan/handoff docs, and the L0 `C:/Projects/CLAUDE.md` routing row for SSTAC.
- **Delegation targets in GATE 2:** SSTAC's actual tooling -- its Supabase workflow (see the /supabase
  skill), its deploy/gate-mode process -- NOT OHD's oc-worker/AGY paths (unless SSTAC uses AGY; check
  your CLAUDE.md). Keep the codex-gate mandatory.
- **Canonical anchors / protected paths:** SSTAC's (e.g. its archive/, migration/matrix_map rules).
- **Depth default:** SSTAC is a LIVE website. Bias the depth recommendation HIGHER -- default to
  Exhaustive (Deep + Plan agent + codex holistic on the plan) for ANYTHING touching the live site,
  schema, or migrations. Reliability must be proven before autonomous work on production.

## Steps
1. Copy OHD's SKILL.md to `SSTAC-Dashboard/.claude/skills/sessionstart/SKILL.md`.
2. Rewrite Step 0 (read-first stack), Step 4 GATE 2 (delegation targets), and the depth signals for
   SSTAC per above. Keep the skeleton (gates, smell-test, contract) intact.
3. Gate it with codex/cursor to GREEN; commit path-scoped in the SSTAC repo (owner-gated per your SOP).
4. Once the global hook is conditional AND this skill exists, SSTAC fresh sessions auto-fire ITS ritual.

Adapt-then-port; do not copy OHD content verbatim. Full design context in the OHD FOLLOWUP_PLAN sec 7.
