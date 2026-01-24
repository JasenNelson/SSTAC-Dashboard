import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Reduce preload warnings by optimizing resource hints
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  webpack: (config: any) => {
    // Mark better-sqlite3 as external to prevent webpack from trying to bundle it
    // This is a native module that only works in local development, not in serverless
    config.externals = config.externals || [];
    config.externals.push('better-sqlite3');
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
