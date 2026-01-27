// This file configures the initialization of Sentry on the client.
// Next.js 15+ pattern: Client-side Sentry configuration moved here from sentry.client.config.ts
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#instrumentation-client

import * as Sentry from '@sentry/nextjs';

// Suppress noisy console messages from Sentry initialization
// This intercepts console.log before Sentry initializes to filter unwanted messages
if (typeof window !== 'undefined') {
  const originalConsoleLog = console.log;
  console.log = (...args: unknown[]) => {
    const message = args.join(' ');
    // Filter out Sentry version/compatibility check messages
    if (message.includes('>=116') || message.includes('PGRST116')) {
      return; // Suppress this message
    }
    originalConsoleLog.apply(console, args);
  };
}

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
  
  // Suppress console noise from Sentry
  beforeSend(event, _hint) {
    // Filter out noisy console messages that don't provide value
    if (event.message && (
      event.message.includes('>=116') ||
      event.message.includes('PGRST116')
    )) {
      return null; // Don't send these events
    }
    return event;
  },
  
  // Suppress console logging for non-critical messages
  ignoreErrors: [
    // Suppress version/compatibility checks that log to console
    />=116/,
  ],
  
  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
    // Note: consoleIntegration is not available in @sentry/nextjs
    // Console filtering is handled via the console.log interceptor above
    // and the beforeSend/ignoreErrors configuration below
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

