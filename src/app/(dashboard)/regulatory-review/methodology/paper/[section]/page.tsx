// Regulatory Review methodology -- single-section paper viewer (server entry).
//
// Server component responsibilities:
//   1. PAGE-LEVEL auth + admin-role guard (defense in depth alongside
//      regulatory-review/layout.tsx -- codex 2026-05-16 P2 pattern).
//   2. Load the requested section's markdown via the server-only
//      methodology-paper-loader (which 404s on invalid slugs OR file
//      read failure).
//   3. Pass the loaded content + nav metadata to MarkdownPaperView
//      ('use client') which renders the markdown with prose styling +
//      sticky-sidebar TOC.

import type { Metadata } from 'next';
import {
  ALL_SECTIONS,
  getSectionMeta,
  loadMethodologyPaperSection,
} from '@/lib/regulatory-review/methodology-paper-loader';
import { requireMethodologyPageAccess } from '@/lib/regulatory-review/methodology-page-auth-guard';
import { MarkdownPaperView } from '@/components/regulatory-review/methodology/MarkdownPaperView';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ section: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { section } = await params;
  const meta = getSectionMeta(section);
  if (!meta) {
    return {
      title: 'Methodology Paper | Regulatory Review',
    };
  }
  return {
    title: `${meta.title} | Methodology Paper`,
    description: `Full methodology paper section: ${meta.title}.`,
  };
}

export default async function MethodologyPaperSectionPage({
  params,
}: PageProps) {
  await requireMethodologyPageAccess();

  const { section } = await params;
  const loaded = await loadMethodologyPaperSection(section);

  const allSections = ALL_SECTIONS.map((s) => ({
    slug: s.slug,
    title: s.shortLabel,
  }));

  return (
    <MarkdownPaperView
      content={loaded.content}
      title={loaded.title}
      sourcePath={loaded.sourcePath}
      summaryRoute={loaded.meta.summaryRoute}
      slug={loaded.meta.slug}
      allSections={allSections}
    />
  );
}
