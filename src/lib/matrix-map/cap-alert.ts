// =====================================================================
// Matrix Map -- cap-headroom threshold alert (pure logic)
// =====================================================================
//
// Delta on top of PR #606 (deployed-cap-aware pagination-readiness
// observability, health page section 10). That panel surfaces the
// RPC's own truncated/returned/total-in-bbox signal AFTER the cap has
// already been crossed. This helper adds a BEFORE-the-fact threshold
// alert: warn admins once the live sample count is closing in on the
// deployed cap, so pagination/cap-raise can be planned ahead of an
// actual truncation event.
//
// Kept as a standalone pure function (no Supabase/JSX) so it is
// trivially unit-testable per repo convention (see src/lib/matrix-map/
// bbox.ts + __tests__/bbox.test.ts for the pattern).
//
// Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
// Per L0 CLAUDE.md section 1.1.
// =====================================================================

/** Fraction of the deployed cap at/above which the alert fires. */
export const CAP_ALERT_THRESHOLD = 0.9;

export type CapAlertLevel = 'ok' | 'warning' | 'indeterminate';

export type CapAlertResult = {
  /** 'warning' at/above CAP_ALERT_THRESHOLD, 'ok' below it, 'indeterminate' on missing/invalid input. */
  level: CapAlertLevel;
  /** sampleCount / deployedCap, or null when indeterminate. Not clamped -- can exceed 1 once over cap. */
  pct: number | null;
};

/**
 * Compute the cap-headroom alert level for the admin health page.
 *
 * Fail-closed: any missing/non-finite/non-positive input yields
 * 'indeterminate' (never a false 'ok'). Callers should render an
 * indeterminate/warning-styled state for 'indeterminate', not treat
 * it as healthy.
 *
 * `rpcTruncated`, when provided, is the DEPLOYED RPC's own `truncated`
 * flag (see section 10 / migration 20260711000001). It is authoritative
 * over the DEPLOYED_MAP_CAP-based pct estimate: DEPLOYED_MAP_CAP is a
 * documented constant that can drift from the live RPC's v_cap (e.g. an
 * environment still running the pre-2026-07-11 2500 cap). If the RPC
 * itself already reports truncation, the alert always fires 'warning'
 * regardless of what the pct calculation says, so this threshold alert
 * can never report a healthy state that contradicts the RPC's own
 * truncated flag in section 10 above it.
 */
export function computeCapAlert(
  sampleCount: number | null | undefined,
  deployedCap: number | null | undefined,
  rpcTruncated?: boolean | null,
): CapAlertResult {
  if (
    typeof sampleCount !== 'number' ||
    typeof deployedCap !== 'number' ||
    !Number.isFinite(sampleCount) ||
    !Number.isFinite(deployedCap) ||
    deployedCap <= 0 ||
    sampleCount < 0
  ) {
    return { level: 'indeterminate', pct: null };
  }

  const pct = sampleCount / deployedCap;
  if (rpcTruncated === true) {
    return { level: 'warning', pct };
  }
  return { level: pct >= CAP_ALERT_THRESHOLD ? 'warning' : 'ok', pct };
}
