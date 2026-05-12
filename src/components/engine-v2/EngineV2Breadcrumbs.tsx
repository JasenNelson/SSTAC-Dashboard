// engine_v2 frontend navigation parity: shared breadcrumbs for the Engine v2
// sub-pages so reviewers can navigate back to the landing page from /new,
// /<projectId>, and /<projectId>/evaluation/<evalId>.
//
// Server Component (no "use client"). Plain ASCII only. Pattern mirrors the
// regulatory-review back-link affordance but renders as a breadcrumb trail so
// intermediate segments (e.g. project name) are also clickable.

import Link from "next/link";

export interface EngineV2BreadcrumbSegment {
  // Display label for the segment. Always rendered as text.
  label: string;
  // When provided, the segment renders as a Link to this href. The final
  // (current page) segment should omit href so it renders as plain text.
  href?: string;
}

interface EngineV2BreadcrumbsProps {
  // Ordered list of segments from root to current page. The first segment
  // should typically be { label: "Engine v2", href: "/dashboard/engine-v2" }.
  segments: EngineV2BreadcrumbSegment[];
}

export function EngineV2Breadcrumbs({
  segments,
}: EngineV2BreadcrumbsProps): React.ReactElement | null {
  if (segments.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      data-testid="engine-v2-breadcrumbs"
      className="mb-4"
    >
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
        {segments.map((segment, idx) => {
          const isLast = idx === segments.length - 1;
          return (
            <li key={`${idx}:${segment.label}`} className="flex items-center gap-1">
              {segment.href && !isLast ? (
                <Link
                  href={segment.href}
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:underline transition-colors"
                >
                  {segment.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={
                    isLast
                      ? "text-slate-900 dark:text-slate-100 font-medium"
                      : "text-slate-600 dark:text-slate-400"
                  }
                >
                  {segment.label}
                </span>
              )}
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className="text-slate-400 dark:text-slate-600 px-1"
                >
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
