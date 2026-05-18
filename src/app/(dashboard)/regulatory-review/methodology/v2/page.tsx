// Regulatory Review methodology -- engine v2 deep-dive (server entry).
//
// Server component responsibilities:
//   1. PAGE-LEVEL auth + admin-role guard (defense in depth alongside
//      regulatory-review/layout.tsx).
//   2. Render MethodologyView in 'v2' scenario, which renders the
//      V2Content client component (curated summary of the methodology
//      paper sections covering engine v2's embeddings+graph primary
//      retrieval, multi-modal Docling, LightRAG/RAG-Anything substrate;
//      source of truth at Regulatory-Review/engine/docs/active/
//      methodology/body/part_VI.md).

import type { Metadata } from 'next';
import { requireMethodologyPageAccess } from '@/lib/regulatory-review/methodology-page-auth-guard';
import { MethodologyView } from '@/components/regulatory-review/methodology/MethodologyView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Methodology v2 | Regulatory Review',
  description:
    'Engine v2 methodology deep-dive: embeddings + graph primary retrieval, ' +
    'multi-modal Docling, LightRAG/RAG-Anything substrate (active development).',
};

export default async function MethodologyV2Page() {
  await requireMethodologyPageAccess();

  return <MethodologyView scenario="v2" />;
}
