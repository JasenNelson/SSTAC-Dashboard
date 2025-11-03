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
};

// Wrap the Next.js config with Sentry configuration
// This will only activate if SENTRY_DSN is configured
export default withSentryConfig(nextConfig, {
  // Sentry options - only active if DSN is provided
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
