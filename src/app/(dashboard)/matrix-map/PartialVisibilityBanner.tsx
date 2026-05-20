'use client';

// =====================================================================
// Matrix Interactive Map -- partial-visibility banner (PR-MAP-3a)
// =====================================================================
//
// Lane:   Matrix Interactive Map
// Branch: feat/matrix-map-pr-map-3a-samples-symbology
// Plan:   docs/design/matrix-map/PR_MAP_3_PLAN.md section 5
//
// Renders ONLY when hidden_sample_count > 0 (Q-8 suppression rule). The
// reviewer sees an honest aggregate count of samples in private DRAs
// they do NOT have grants for, with a mailto link to request access.
//
// Privacy contract (grants v2.3 D-1 / R-10):
//   - The RPC returns hidden_dra_ids as opaque UUIDs ONLY.
//   - NO titles / citations / agencies are EVER projected for hidden
//     DRAs. The mailto body is the ONLY place those UUIDs surface, and
//     they go to a trusted admin mailbox.
//
// Dismiss state:
//   - Per-session only (useState). NOT persisted to LocalStorage.
//   - Banner re-renders on every page load even after dismissal so the
//     reviewer is always reminded of the missing samples.
//
// Plain ASCII only. Per L0 CLAUDE.md section 1.1.
// =====================================================================

import { useState } from 'react';
import { X } from 'lucide-react';

interface PartialVisibilityBannerProps {
  visibleCount: number;
  hiddenSampleCount: number;
  hiddenDraCount: number;
  hiddenDraIds: string[];
}

const DEFAULT_ADMIN_EMAIL = 'jasen.nelson@gmail.com';

/**
 * Resolve the contact email. Reads `NEXT_PUBLIC_MATRIX_ADMIN_EMAIL` at
 * build time; falls back to a sensible default. Documented as
 * configurable per the task brief (PR-MAP-3a deliverable 4).
 */
function getAdminEmail(): string {
  const fromEnv =
    typeof process !== 'undefined' && process.env
      ? process.env.NEXT_PUBLIC_MATRIX_ADMIN_EMAIL
      : undefined;
  return fromEnv && fromEnv.trim().length > 0
    ? fromEnv
    : DEFAULT_ADMIN_EMAIL;
}

function buildMailtoHref(hiddenDraIds: string[]): string {
  const email = getAdminEmail();
  const subject = 'Matrix Map access request';
  const idList =
    hiddenDraIds.length > 0
      ? hiddenDraIds.join('\n')
      : '(no DRA ids surfaced)';
  const body =
    'Hello,\n\n' +
    'I would like to request access to the following private DRAs ' +
    'on the Matrix Interactive Map:\n\n' +
    idList +
    '\n\nThank you.';
  const params = new URLSearchParams({ subject, body });
  return `mailto:${email}?${params.toString()}`;
}

export function PartialVisibilityBanner({
  visibleCount,
  hiddenSampleCount,
  hiddenDraCount,
  hiddenDraIds,
}: PartialVisibilityBannerProps) {
  const [dismissed, setDismissed] = useState<boolean>(false);

  // Q-8: suppress when hidden_sample_count == 0. Defensive double-check
  // even though MatrixMap also gates rendering on this -- belt + braces.
  if (hiddenSampleCount <= 0) return null;
  if (dismissed) return null;

  const draNoun = hiddenDraCount === 1 ? 'private DRA' : 'private DRAs';
  const sampleNoun =
    hiddenSampleCount === 1 ? 'sample' : 'samples';
  const visibleSampleNoun = visibleCount === 1 ? 'sample' : 'samples';

  const mailtoHref = buildMailtoHref(hiddenDraIds);

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-20 z-[1000] flex w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 justify-center"
      data-testid="matrix-map-banner-wrap"
    >
      <div
        role="status"
        aria-live="polite"
        data-testid="matrix-map-partial-visibility-banner"
        className="pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-md"
      >
        <div className="flex-1 leading-snug">
          <p>
            <span className="font-semibold">
              Visible: {visibleCount} {visibleSampleNoun}.
            </span>{' '}
            Hidden: {hiddenSampleCount} {sampleNoun} in {hiddenDraCount}{' '}
            {draNoun} you do not have access to.
          </p>
          <p className="mt-1 text-xs">
            <a
              href={mailtoHref}
              className="font-medium underline hover:text-amber-700"
              data-testid="matrix-map-banner-mailto"
            >
              Contact admin to request access
            </a>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss partial-visibility banner"
          className="flex-shrink-0 rounded-md p-1 text-amber-700 hover:bg-amber-100"
          data-testid="matrix-map-banner-dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
