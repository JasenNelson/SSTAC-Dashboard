/**
 * Wrapper for optional better-sqlite3 dependency.
 * Centralises the CJS require so it can be cleanly mocked in tests.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Database: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Database = require('better-sqlite3');
} catch {
  // better-sqlite3 not available (Vercel deployment)
}

export { Database };
