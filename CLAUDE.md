# SSTAC-Dashboard Claude Notes

Read `AGENTS.md` before running build or verification commands. In particular, use `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10` instead of raw `npm run build` from agent shells.

## Workflow Rhythm

After each completed task, give a recommended next step plus 2-4 options with brief rationale. If the owner approves a closeout or continuation recommendation with "ok", "proceed", or equivalent, create the next-session handoff automatically before ending.
