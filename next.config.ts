import { withSentryConfig } from '@sentry/nextjs';

const MATRIX_OPTIONS_PAPER_TRACE_FILES = [
  './candidate/paper/BC_Matrix_Options_Paper_v1.0.11-remediated-7-8-successor-20260918-D.md',
  './candidate/paper/BC_Matrix_Options_Paper_v1.0.11-remediated-7-8-successor-20260918-D.md.sha256',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Runtime fs reads of the authenticated revised paper and its sha256 sidecar
  // (src/lib/matrix-options/revised-paper.ts REVISED_PAPER_RELATIVE_PATH and
  // REVISED_PAPER_SIDECAR_RELATIVE_PATH) are invisible to the bundler, so Vercel
  // omits them from the serverless function unless listed here. Next 15 matches
  // these keys against each route with picomatch `contains: true` (a SUBSTRING
  // match, not a prefix): '/matrix-options' therefore also reaches /api/... and
  // /admin/... routes containing it. Every route that reads the paper is still
  // listed explicitly so narrowing a key cannot silently drop one.
  // scripts/verify/verify-matrix-options-paper-trace.mjs proves the built
  // .nft.json traces contain both files for each of those routes.
  outputFileTracingIncludes: {
    '/matrix-options': MATRIX_OPTIONS_PAPER_TRACE_FILES,
    '/api/matrix-options/paper': MATRIX_OPTIONS_PAPER_TRACE_FILES,
    '/admin/matrix-options-paper-reviews': MATRIX_OPTIONS_PAPER_TRACE_FILES,
  },

  // Skip ONLY the redundant in-build ESLint pass: CI's `eslint .` gate is a
  // superset, so re-linting inside `next build` adds no coverage and wastes
  // build memory. The in-build TypeScript check is KEPT -- it validates the
  // per-page `.next/types/app/**` route guards that `next typegen` + CI
  // `tsc --noEmit` do NOT generate (codex 2026-06-08), so disabling it would
  // open a real coverage gap. The Vercel 8GB OOM (2026-06-08, commit 3ba0b7a)
  // is instead mitigated by pinning the build to Node 22 (package.json engines)
  // rather than the heavier forced Node 24 -- confirmed by the resulting Vercel
  // deploy; if it still OOMs, the fallback is Vercel Enhanced Builds (larger
  // machine), NOT disabling this typecheck.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Reduce preload warnings by optimizing resource hints
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
    // Next 15.5.9 intermittently crashes while prerendering "/" when
    // server code mangling is enabled in this worktree. The equivalent
    // `next build --no-mangling` path is green; make the monitored build
    // deterministic without changing application runtime behavior.
    serverMinification: false,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpack: (config: any) => {
    // Mark native-binary modules as external so webpack does not try to bundle
    // them. These are local-dev-only modules; production (Vercel) serves no
    // surface that references them, and the Next.js build trace would
    // otherwise fail trying to follow the .node binary loader path.
    //   - better-sqlite3: engine-v2 local-dev DB.
    //   - node-pty: Agentic OS embedded terminal modal (step 9 / Pattern E).
    //     Required at runtime ONLY by scripts/agentic-os-pty-server.mjs (a
    //     sidecar process), never by Next route handlers. The
    //     isAgenticOsPtyEnabled() feature flag wraps the require in try/catch,
    //     so externalizing it here keeps the build clean even when node-pty
    //     is absent.
    config.externals = config.externals || [];
    config.externals.push('better-sqlite3', 'node-pty');
    return config;
  },
};

// Wrap the Next.js config with Sentry configuration
// This will only activate if SENTRY_DSN is configured
export default withSentryConfig(nextConfig, {
  // Sentry options - only active if DSN is provided
  org: process.env.SENTRY_ORG || undefined,
  project: process.env.SENTRY_PROJECT || undefined,
  // Don't fail build if Sentry is not configured
  silent: !process.env.SENTRY_DSN,
});
