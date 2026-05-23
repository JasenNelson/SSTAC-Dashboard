# SSTAC-Dashboard Agent Notes

## Build Gate

Do not run raw `npm run build` from Codex/agent shells by default. Stale or interrupted `.next` state has caused Next.js builds to stall at the banner stage in this repo.

Use the monitored clean build gate instead:

```powershell
npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10
```

This quarantines `.next` under `.tmp/next-quarantine-*`, writes logs under `.tmp/build-monitor/`, and times out with process-tree cleanup instead of leaving an unbounded build running. If sandboxing blocks `.next` quarantine, rerun with the required approval/escalation rather than falling back to raw build.

For push protocol, this monitored clean build satisfies the build step; still run the repo's unit tests, e2e tests, and linting as required.
