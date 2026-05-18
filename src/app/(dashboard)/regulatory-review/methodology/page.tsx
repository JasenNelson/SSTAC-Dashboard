// Regulatory Review methodology landing page (server entry).
//
// Server component responsibilities:
//   1. PAGE-LEVEL auth + admin-role guard. The parent layout at
//      regulatory-review/layout.tsx ALSO performs the same check;
//      both must pass for the page to render. Defense in depth
//      against stale layout RSC cache on client-side navigation
//      between sibling routes (codex 2026-05-16 P2 pattern).
//   2. Render the MethodologyView client component in 'landing'
//      scenario, which shows a scenario selector (v1 / v2 /
//      transition) + a placeholder for the tier selector + content.
//
// Content for each scenario lives in dedicated *Content.tsx client
// components; this page only wires the route to the view.

import type { Metadata } from 'next';
import { requireMethodologyPageAccess } from '@/lib/regulatory-review/methodology-page-auth-guard';
import { MethodologyView } from '@/components/regulatory-review/methodology/MethodologyView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Methodology | Regulatory Review',
  description:
    'Methodology paper for the Regulatory Review AI Agent (RRAA): ' +
    'engine v1 (legacy operational), engine v2 (active development), ' +
    'and the v1 -> v2 transition rationale.',
};

export default async function MethodologyLandingPage() {
  // Page-level auth guard (defense in depth alongside layout).
  await requireMethodologyPageAccess();

  return <MethodologyView scenario="landing" />;
}
