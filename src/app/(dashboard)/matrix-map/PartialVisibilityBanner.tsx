'use client';

import { EyeOff, RefreshCw } from 'lucide-react';

export interface PartialVisibilityBannerProps {
  hiddenSampleCount: number;
  hiddenDraCount: number;
  hiddenDraIds: string[];
  contactEmail?: string;
  onRefresh: () => void;
}

const DEFAULT_CONTACT_EMAIL = 'jasen.nelson@gmail.com';

function buildMailtoHref(
  contactEmail: string,
  hiddenSampleCount: number,
  hiddenDraCount: number,
  hiddenDraIds: string[],
) {
  const safeContactEmail = contactEmail.replace(/[\r\n]/g, '').trim();
  const subject = 'Matrix map private DRA access request';
  const body = [
    'Please review private DRA access for hidden matrix-map samples.',
    '',
    `Hidden sample count: ${hiddenSampleCount}`,
    `Hidden DRA count: ${hiddenDraCount}`,
    `Hidden DRA UUID count: ${hiddenDraIds.length}`,
  ].join('\n');

  return `mailto:${safeContactEmail}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

export default function PartialVisibilityBanner({
  hiddenSampleCount,
  hiddenDraCount,
  hiddenDraIds,
  contactEmail,
  onRefresh,
}: PartialVisibilityBannerProps) {
  if (hiddenSampleCount <= 0) return null;

  // cross_project_check_before_recreate: no existing matrix admin contact
  // convention was found, so keep the fallback isolated behind this override.
  const resolvedContactEmail = contactEmail?.trim() || DEFAULT_CONTACT_EMAIL;
  const contactHref = buildMailtoHref(
    resolvedContactEmail,
    hiddenSampleCount,
    hiddenDraCount,
    hiddenDraIds,
  );

  return (
    <section
      aria-labelledby="matrix-map-partial-visibility-title"
      className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-800/70 dark:bg-amber-900/20 dark:text-amber-100"
      data-testid="matrix-map-partial-visibility-banner"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2
              id="matrix-map-partial-visibility-title"
              className="text-sm font-semibold"
            >
              Hidden samples behind private DRAs
            </h2>
            <p className="mt-1 text-sm leading-5 text-amber-900 dark:text-amber-100/90">
              {hiddenSampleCount} sample(s) across {hiddenDraCount} data
              review assessment(s) are hidden because access is restricted.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh matrix map samples"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-amber-300 bg-white px-3 text-sm font-medium text-amber-900 shadow-sm transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-amber-900/40 dark:focus:ring-offset-slate-900"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
          <a
            href={contactHref}
            className="inline-flex h-9 items-center rounded-md border border-amber-300 bg-white px-3 text-sm font-medium text-amber-900 shadow-sm transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-amber-900/40 dark:focus:ring-offset-slate-900"
          >
            Contact admin
          </a>
          <a
            href="/matrix-options/private-data-access"
            className="inline-flex h-9 items-center rounded-md border border-transparent px-3 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:text-amber-100 dark:hover:bg-amber-900/40 dark:focus:ring-offset-slate-900"
          >
            Learn more
          </a>
        </div>
      </div>
    </section>
  );
}
