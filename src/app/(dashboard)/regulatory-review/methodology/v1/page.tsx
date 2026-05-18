// Regulatory Review methodology -- engine v1 deep-dive (server entry).
//
// Server component responsibilities:
//   1. PAGE-LEVEL auth + admin-role guard (defense in depth alongside
//      regulatory-review/layout.tsx).
//   2. Render MethodologyView in 'v1' scenario, which renders the
//      V1Content client component (curated summary of the methodology
//      paper sections covering engine v1's keyword-heavy 4-stage
//      shadow-additive pipeline, source of truth at
//      Regulatory-Review/engine/docs/active/methodology/body/
//      parts_I_II_III.md + parts_IV_V.md).

import type { Metadata } from 'next';
import { requireMethodologyPageAccess } from '@/lib/regulatory-review/methodology-page-auth-guard';
import { MethodologyView } from '@/components/regulatory-review/methodology/MethodologyView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Methodology v1 | Regulatory Review',
  description:
    'Engine v1 methodology deep-dive: keyword-heavy 4-stage shadow-additive ' +
    'pipeline (legacy operational, retirement path).',
};

export default async function MethodologyV1Page() {
  await requireMethodologyPageAccess();

  return <MethodologyView scenario="v1" />;
}
