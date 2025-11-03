// This file configures the initialization of Sentry on the client.
// Next.js 15+ pattern: Client-side Sentry configuration moved here from sentry.client.config.ts
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#instrumentation-client

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
  
  replaysOnErrorSampleRate: 1.0,
  
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,
  
  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

/**
 * onRouterTransitionStart Hook for Navigation Tracking
 * 
 * This hook instruments client-side navigation transitions to provide
 * better performance monitoring and error tracking for route changes.
 * 
 * This is polling-safe - it only adds navigation tracking and doesn't
 * change any functionality or affect poll behavior.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

