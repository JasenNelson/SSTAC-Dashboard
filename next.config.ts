import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
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
