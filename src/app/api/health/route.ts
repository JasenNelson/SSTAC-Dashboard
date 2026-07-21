import { NextResponse } from 'next/server';

// GET /api/health -- read-only liveness + deployed-commit probe.
//
// Purpose (Top-50 row 2): give an external, unauthenticated check a way to read
// the commit SHA the running deployment was built from, so a drift check can
// compare the production tip to `origin/main` and alert when they diverge. No
// alerting / CI wiring is decided here -- that is the owner step (row 2b).
//
// This endpoint exposes only:
//   - status:    always 'ok' (the handler itself is up)
//   - sha:       the FULL build commit, from Vercel's system env var
//                `VERCEL_GIT_COMMIT_SHA` (auto-injected; an opaque hash, not a
//                secret). Falls back to 'unknown' locally / when unset. The full
//                SHA is emitted (not a fixed short prefix) so a drift check can
//                compare against Git's own disambiguating abbreviation of any
//                length without ever capping to an ambiguous prefix.
//   - env:       `VERCEL_ENV` (production | preview | development), or 'unknown'.
//   - timestamp: request time, ISO-8601.
// It reads no database, no secrets, and no request input, so it is safe to serve
// unauthenticated (matching the health-check intent in .github/MONITORING_SETUP.md).

export const dynamic = 'force-dynamic'; // never statically cache -- must reflect the live deployment
export const runtime = 'nodejs';

export function GET() {
  const rawSha = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  const sha = rawSha || 'unknown';
  const env = process.env.VERCEL_ENV ?? 'unknown';

  return NextResponse.json(
    {
      status: 'ok',
      sha,
      env,
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
