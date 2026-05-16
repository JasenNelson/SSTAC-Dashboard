// In-memory audit log for the Agentic OS launch route (step 6a).
//
// Lives outside the route file because Next.js App Router constrains
// `route.ts` files to export only HTTP-verb handlers + a small allowlist
// of config exports; any other export triggers a type error at build time
// (".next/types/app/.../route.ts" constraint check). Keeping the audit log
// in this sibling module lets the route, tests, and any future inspection
// helpers share it without violating the route-export constraint.
//
// Step 6b will replace this in-memory log with a persisted writer to
// `logs/agentic-os-launches.log` per the arch spec's directory structure
// (AGENTIC_OS_ARCHITECTURE.md section 12).

export interface AuditEntry {
  /** ISO 8601 timestamp of the spawn. */
  ts: string;
  /** Authenticated admin user's email; may be undefined if Supabase returns no email. */
  user_email: string | undefined;
  /** Child process PID; may be undefined if spawn returned without a pid. */
  pid: number | undefined;
  /** Validated executable name (always a hardcoded literal from launch-validator). */
  exe: string;
  /** Validated argument vector (always derived from a hardcoded template). */
  args: readonly string[];
  /** Validated working directory (path.join(PROJECTS_ROOT, allowlisted-project)). */
  cwd: string;
}

// Cap to prevent unbounded memory growth on a long-running dev server. 500
// entries at ~250 bytes each is ~125 KB; well under any realistic budget.
const AUDIT_LOG_CAP = 500;

const launchAuditLog: AuditEntry[] = [];

export function appendLaunchAudit(entry: AuditEntry): void {
  launchAuditLog.push(entry);
  if (launchAuditLog.length > AUDIT_LOG_CAP) {
    launchAuditLog.splice(0, launchAuditLog.length - AUDIT_LOG_CAP);
  }
}

/**
 * Snapshot accessor. Returns a defensive copy; mutations to the returned
 * array do not affect the underlying store.
 */
export function getLaunchAuditLog(): readonly AuditEntry[] {
  return launchAuditLog.slice();
}

/**
 * Test-only reset. Lets unit + integration tests start from a clean log
 * without leaking state between cases.
 */
export function __resetLaunchAuditLogForTest(): void {
  launchAuditLog.length = 0;
}

export const __AUDIT_LOG_CAP_FOR_TEST = AUDIT_LOG_CAP;
