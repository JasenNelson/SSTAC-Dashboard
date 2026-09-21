/**
 * Session-teardown contract shared by e2e/matrix-options-paper.spec.ts and the Playwright configs.
 *
 * The app's Logout calls supabase.auth.signOut() with the default GLOBAL scope, which revokes every
 * session of the signed-in user. All authenticated E2E tests share ONE stored session (the setup
 * project's e2e/.auth/user.json), so a test that logs out part-way through a run sends every later
 * (and, under fullyParallel, every concurrent) authenticated test to /login.
 *
 * Tests that end the shared session carry SESSION_TEARDOWN_TAG in their title. The chromium-auth
 * projects grepInvert that tag, and SESSION_TEARDOWN_PROJECT - chromium-auth's Playwright "teardown" project,
 * so it starts only after chromium-auth has finished and is selected whenever chromium-auth is - is the
 * only project that greps for it.
 *
 * Ordering only protects tests inside ONE Playwright invocation. A real global logout would still
 * revoke sessions held by any OTHER run using the same E2E account at the same time (another local
 * run, a concurrent CI workflow). The session-teardown test therefore intercepts the GoTrue logout
 * request itself and asserts the app asked for it (once, scope=global): the app's logout path is
 * exercised end to end without revoking anyone's session. The ordering is kept as defense in depth.
 */
export const SESSION_TEARDOWN_TAG = '@session-teardown';
export const SESSION_TEARDOWN_PROJECT = 'chromium-auth-session-teardown';
export const SESSION_TEARDOWN_GREP = /@session-teardown/;
