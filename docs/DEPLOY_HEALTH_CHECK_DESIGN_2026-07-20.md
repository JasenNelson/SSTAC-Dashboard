# Deploy-Health Check -- Design and Owner Decision (2026-07-20)

Status: DESIGN ONLY. Nothing here is implemented. Both viable designs require an owner action, which
is why this is a decision doc rather than a PR that builds it.

## The problem, with evidence

Production can silently fall behind `main`, and nothing detects it.

Observed on 2026-07-20 (Vercel project `sstac-dashboard`):

| Merge batch | Interval | Production deploy outcome |
|---|---|---|
| #700, #701, #702 | within 6 seconds | **all three CANCELED**, including the newest. Production stranded at #699 |
| #703, #704 | 4 seconds apart | both READY. Production advanced normally |

Vercel cancels superseded builds by design, and normally the newest of a rapid batch survives. In the
first batch it did not, so `main` moved to `c1e79be4` while production kept serving `9b6116f1`.

Impact in that instance was nil -- the three stranded commits were docs, a manifest refresh, and a
generator sync. Production later caught up unaided when #703/#704 merged, and it is current as of this
writing (`dddbe0f4`, READY). Runtime health is good: zero runtime errors in the preceding 24 hours.

**The defect is not the cancellation. It is that nobody would have known.** The same pattern applied
to a batch containing a user-facing fix would ship nothing and report success. The failure is silent,
and it self-heals only by luck -- the next merge that happens to deploy cleanly.

## Why this is not autonomous-safe to build

There is currently no `/api/health` or `/api/version` route, and `VERCEL_GIT_COMMIT_SHA` is not read
anywhere in the codebase. So a check has to obtain the deployed SHA by one of two routes, and both
need an owner decision.

### Design A -- app self-reports its build SHA

Add a minimal public route (for example `/api/version`) returning `VERCEL_GIT_COMMIT_SHA`, then have
CI (or an uptime check) fetch it from production and compare against `origin/main`.

- Pro: no new secret; works from anywhere; the deployed artifact reports its own identity, which is
  the most direct possible evidence.
- Pro: cheap to extend later (build time, region, runtime health).
- **Con, and the blocker:** the route must be reachable unauthenticated, which means editing
  `src/middleware.ts`. That file is Tier 1 protected in `CLAUDE.md` and gates every protected route.
  A mistake in its matcher is an auth-exposure bug, not a monitoring bug.
- Disclosure note: a commit SHA for a public repository is not sensitive. The risk here is entirely
  in touching the auth matcher, not in the value exposed.

### Design B -- CI queries the Vercel API

A scheduled workflow reads the current production deployment's `githubCommitSha` from the Vercel API
and compares it to `origin/main`.

- Pro: touches no application code and no auth surface at all.
- Pro: can also surface `state` (READY / ERROR / CANCELED), so it catches the ERROR case too -- #698's
  production deploy errored, which Design A would only see as a stale SHA.
- **Con, and the blocker:** requires a `VERCEL_TOKEN` repo secret that does not exist today. That is a
  credential the owner must mint and scope.

## Recommendation

**Design B.** It detects strictly more failure modes than A (CANCELED and ERROR states, not just SHA
drift), and it keeps the auth surface untouched. Editing a Tier 1 auth file to gain a monitoring
signal is a poor risk trade when an equivalent signal is available from outside the application.

If the owner prefers to avoid minting a token, Design A is acceptable, but the middleware change
should be reviewed on its own, in isolation from any other work.

## Exact owner action

Pick one:

1. **Design B (recommended)** -- create a `VERCEL_TOKEN` repo secret with read access to the
   `sstac-dashboard` project. Implementation then proceeds autonomously: a scheduled workflow plus a
   script, no application code touched.
2. **Design A** -- approve an isolated, single-purpose edit to `src/middleware.ts` adding one public
   route. That PR would contain nothing else.
3. **Neither** -- accept the risk. Reasonable while merges are infrequent and mostly docs; revisit
   before any release cadence where a stranded user-facing commit would matter.

## Scope note

Re-deploying a stranded commit is a production action and stays owner-gated regardless of which
design is chosen. Any check built from this doc reports only; it never triggers a deploy.
