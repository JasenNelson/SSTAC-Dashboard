// Regulatory Review methodology -- v1 -> v2 transition (server entry).
//
// Server component responsibilities:
//   1. PAGE-LEVEL auth + admin-role guard (defense in depth alongside
//      regulatory-review/layout.tsx).
//   2. Render MethodologyView in 'transition' scenario, which renders
//      the TransitionContent client component (curated summary of the
//      methodology paper sections covering why v1 is being retired and
//      v2 was authorized; source of truth at Regulatory-Review/engine/
//      docs/active/methodology/body/parts_IV_V.md Part V).

import type { Metadata } from 'next';
import { requireMethodologyPageAccess } from '@/lib/regulatory-review/methodology-page-auth-guard';
import { MethodologyView } from '@/components/regulatory-review/methodology/MethodologyView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Methodology v1 -> v2 Transition | Regulatory Review',
  description:
    'The v1 -> v2 transition rationale: what v1 taught us, why v2 was ' +
    'authorized, and how the retirement path is structured.',
};

export default async function MethodologyTransitionPage() {
  await requireMethodologyPageAccess();

  return <MethodologyView scenario="transition" />;
}
