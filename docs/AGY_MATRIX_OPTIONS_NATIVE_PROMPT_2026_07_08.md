# Native AGY Prompt - Matrix Options 12H Run

Paste this into a native AGY session rooted at:

```text
C:\tmp\sstac-mo-overnight-20260708
```

Prompt:

```text
Read C:\tmp\sstac-mo-overnight-20260708\docs\AGY_MATRIX_OPTIONS_12H_EXECUTION_PLAN_2026_07_08.md and execute it exactly.

You are AGY-primary orchestrator for SSTAC-Dashboard Matrix Options, not just a drafting worker.

Run the plan unattended through Units 0-6.

Choose the next unit yourself. Delegate mechanical edits to Gemini 3.5 Flash (High) when useful. Call codex review yourself when review is required and available. Inspect diffs directly. Run gates. Commit with path-scoped staging. Push if auth/network permits.

Do not use Claude. Do not ask the owner to run routine AGY, Codex, test, git, review, or commit commands. Stop only on the plan's explicit stop conditions or for a genuinely owner-gated action.

Preserve these hard boundaries:
- do not merge
- do not touch Supabase, Gate2B, MCP, or engine-v2
- do not touch .mcp.json
- do not touch src/data catalogs
- do not mutate qa_status, default_status, or review statuses
- do not use the dirty primary checkout
- do not run git add ., git add -A, git add -u, git reset --hard, git clean, git checkout ., or git restore .
- do not run raw npm run build; use npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10

Before doing anything else, read:
- docs\MATRIX_OPTIONS_AUTONOMOUS_RUN_STATUS_2026_07_08.md
- docs\MATRIX_OPTIONS_BACKLOG_EXECUTION_MAP_2026_07_08.md
- docs\MATRIX_OPTIONS_PR545_READINESS_2026_07_08.md
- docs\MATRIX_OPTIONS_ORGANOMERCURY_PACKET_2026_07_08.md
- docs\MATRIX_OPTIONS_E2E_ASSESSMENT_2026_07_08.md
- docs\MATRIX_OPTIONS_PHASE_C_SOURCE_PREFLIGHT_2026_07_08.md
- docs\MATRIX_OPTIONS_OVERNIGHT_STATUS_2026_07_08.md

First concrete action:
1. Refresh GitHub state for PR #545.
2. If #545 is still open/CLEAN/green, do not merge; record that owner merge is the next action.
3. If #545 has merged, refresh origin/main and start the next eligible unit from the backlog map.
4. If #545 is blocked, inspect the failure and produce a fix plan before changing code.

Stop and close out if an action would require owner approval, Supabase/Gate2B coordination, catalog mutation, or a merge.
```

## Why Native AGY Is Required

Codex sandbox launch of AGY is blocked by OAuth/network behavior:

```text
oauth2.googleapis.com/token -> proxyconnect tcp 127.0.0.1:9 refused
```

Native AGY sessions do not appear to hit the same sandbox proxy failure.
