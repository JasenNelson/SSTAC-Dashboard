# Sentry CI-secrets wiring packet (Top-50 row 6)

Status: OWNER-ACTION PACKET (design/guidance only). 2026-07-21.

This packet documents exactly which Sentry secrets/vars to set, where each is read in the code,
and how to verify Sentry works after setting them. **AI does not inspect, set, print, or require any
secret value** -- the owner sets them in GitHub / Vercel. This is a docs-only artifact; it makes no
code change.

## TL;DR

The Sentry CI plumbing is **already wired** (`ci.yml` references the secrets; `next.config.ts` wraps
the build with `withSentryConfig`; the runtime config files call `Sentry.init`). What is missing is
the **values**: no `SENTRY_*` repo secret and no `NEXT_PUBLIC_SENTRY_DSN` are set, so (a) production
errors are not captured at all, and (b) even if they were, stack traces would be minified because no
source maps / release are uploaded. Setting four values closes both gaps.

## Current state (verified read-only against origin/main = 46c6d0eb)

- Package: `@sentry/nextjs ^10.22.0` (`package.json`).
- Build wrapper: `next.config.ts:48-54` -- `withSentryConfig(nextConfig, { org: SENTRY_ORG, project:
  SENTRY_PROJECT, silent: !SENTRY_DSN })`. The webpack plugin uploads source maps + creates a release
  when `SENTRY_AUTH_TOKEN` (read by the plugin from the env), `org`, and `project` are present.
- Runtime init (error capture) reads **`NEXT_PUBLIC_SENTRY_DSN`**:
  - `sentry.server.config.ts:8`
  - `sentry.edge.config.ts:9`
  - `src/instrumentation-client.ts:22`
- CI already passes the upload secrets into the build step (and a second job):
  - `.github/workflows/ci.yml:139-141` (Build application step) and `:278-280`:
    `SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN: ${{ secrets.* }}` (commented "optional - build will
    work without them").
- Env reference already documents the DSN: `.env.example:49-50`,
  `docs/ENVIRONMENT_REFERENCE.md:112-117` (Public; DSNs are public per Sentry's threat model; unset ->
  Sentry effectively disabled).

## What the owner sets (four values, two purposes)

### A. Runtime error capture -- `NEXT_PUBLIC_SENTRY_DSN`
- **What:** the project's Sentry DSN (Sentry: Project Settings -> Client Keys (DSN)).
- **Where to set:** Vercel Project -> Settings -> Environment Variables, as `NEXT_PUBLIC_SENTRY_DSN`
  for the Production (and optionally Preview) environment. It is a `NEXT_PUBLIC_*` value (baked into
  the client bundle) and is safe to expose per Sentry's threat model (`.env.example:49`).
- **Effect:** without it, `Sentry.init({ dsn: undefined })` is a no-op -- zero errors captured. This is
  the single most important value; source-map upload is worthless if nothing is captured.

### B. Source-map + release upload (build-time) -- three GitHub Actions repo secrets
CI already references these; set the values under GitHub -> repo Settings -> Secrets and variables ->
Actions -> New repository secret:
- `SENTRY_ORG` -- the Sentry org slug.
- `SENTRY_PROJECT` -- the Sentry project slug.
- `SENTRY_AUTH_TOKEN` -- a Sentry **internal integration / auth token** scoped to `project:releases`
  (+ `org:read`). This is the sensitive one; treat like any deploy token. The `@sentry/nextjs`
  webpack plugin needs it to upload source maps and create a release during `npm run build`.
- **Effect:** without `SENTRY_AUTH_TOKEN`, the build still succeeds (the plugin is non-fatal) but
  uploads nothing, so production stack traces show minified frames.

> Note: the production deploy runs on **Vercel**, not (only) GitHub Actions. If source-map upload
> must happen on the deploying build, the same three values (`SENTRY_ORG`, `SENTRY_PROJECT`,
> `SENTRY_AUTH_TOKEN`) must also be set as **Vercel** build-time environment variables, not only as
> GitHub Actions secrets. Decide where the release-bearing production build actually runs and set the
> upload creds there. (GitHub Actions' `Production Build` job validates the build; Vercel produces the
> deployed artifact.)

## Known gotcha to decide on (do NOT auto-fix -- `next.config.ts` is Tier-1 protected)

`next.config.ts:53` sets `silent: !process.env.SENTRY_DSN`, but **bare `SENTRY_DSN` is referenced
nowhere else in the repo** (runtime uses `NEXT_PUBLIC_SENTRY_DSN`; there is no bare `SENTRY_DSN`
consumer). So `silent` is effectively always `true` unless someone sets an otherwise-unused
`SENTRY_DSN`. This only controls the Sentry build plugin's log verbosity (not whether upload happens),
so it is cosmetic -- but it is misleading. Options for the owner:
- (a) Leave as-is (harmless; upload is gated by `SENTRY_AUTH_TOKEN`, not `silent`).
- (b) Change the gate to something real, e.g. `silent: !process.env.SENTRY_AUTH_TOKEN` (log only when
  uploads are actually configured). This is a one-line edit to a **Tier-1 protected file**
  (`next.config.ts`) and needs explicit owner authorization + its own reviewed PR.

## Verification after the owner sets the values

1. **Capture works:** with `NEXT_PUBLIC_SENTRY_DSN` set in production, trigger a benign test error
   (e.g. a throwaway route or the existing error boundary path) and confirm the event appears in the
   Sentry project within ~1 min.
2. **Source maps + release:** on the release-bearing build (Vercel, and/or the GH Actions build once
   creds are present), confirm the build log shows the Sentry plugin uploading source maps + creating
   a release, and that the captured event in step 1 shows **un-minified** stack frames tagged with a
   release/commit.
3. **No secret leakage:** confirm `NEXT_PUBLIC_SENTRY_DSN` is the only Sentry value exposed to the
   client bundle; `SENTRY_AUTH_TOKEN` must never be `NEXT_PUBLIC_*` and must not appear in client JS.

## Owner decision (for the batched packet)

- **D1:** Set `NEXT_PUBLIC_SENTRY_DSN` (Vercel prod) -- yes/no. (Recommended yes; nothing is captured
  otherwise.)
- **D2:** Set `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` -- as GitHub secrets and/or Vercel
  build env, depending on where the release build runs.
- **D3:** The `silent: !SENTRY_DSN` cleanup -- leave, or authorize a one-line `next.config.ts` PR.

Forbidden-scope confirmation for this lane: no secret was inspected, set, printed, or required; no
code changed; `next.config.ts` (Tier-1) was read only.
