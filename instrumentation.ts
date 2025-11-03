// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * onRequestError Hook for Server-Side Error Tracking
 * 
 * This hook captures errors from nested React Server Components that
 * aren't caught by ErrorBoundary components. It provides comprehensive
 * server-side error tracking.
 * 
 * This is polling-safe - it only adds error reporting and doesn't
 * change any functionality or affect poll API routes.
 */
export async function onRequestError(
  err: Error,
  request: {
    path: string;
    headers: Headers;
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath?: string;
    routeType?: 'render' | 'route' | 'action';
  }
) {
  // Capture error with additional context
  Sentry.captureException(err, {
    tags: {
      component: 'onRequestError',
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
    },
    extra: {
      path: request.path,
    },
  });
}

