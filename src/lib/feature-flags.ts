/**
 * Server-side: is the local engine available?
 * Uses LOCAL_ENGINE_ENABLED (not NEXT_PUBLIC_) for runtime flexibility.
 * Use in API routes and server components.
 */
export function isLocalEngineServer(): boolean {
  return process.env.LOCAL_ENGINE_ENABLED === 'true'
}

/**
 * Client-side: is the local engine available?
 * Uses NEXT_PUBLIC_LOCAL_ENGINE (build-time inlined).
 * Use in client components for conditional UI rendering.
 */
export function isLocalEngineClient(): boolean {
  return process.env.NEXT_PUBLIC_LOCAL_ENGINE === 'true'
}
