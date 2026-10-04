import { notFound, redirect } from 'next/navigation';

import {
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from '@/lib/matrix-options/navigation';
import { getPaperRelease, PAPER_WITHHELD_NOTICE_ID } from '@/lib/matrix-options/paper/releases';
import type { PaperRelease } from '@/lib/matrix-options/paper/releases';
import { paperWorkspaceHref } from '@/lib/matrix-options/paper/url-state';
import {
  REVISED_PAPER_ROUTE,
  REVISED_PAPER_VERSION,
} from '@/lib/matrix-options/revised-paper';
import { resolveLegacySectionAnchor } from '@/components/matrix-options/paper/PaperDocument';
import { loadPaperStructureForPage } from '@/app/(dashboard)/matrix-options/paper/request-structure';

/**
 * Whether the route segment names the section this release withholds: the raw
 * segment or its percent-decoded form equals the withheld stable id. Read from
 * the release entry alone.
 */
function namesWithheldSection(release: PaperRelease, rawId: string): boolean {
  if (!release.withheld) return false;
  if (rawId === release.withheld.stableSectionId) return true;
  try {
    return decodeURIComponent(rawId) === release.withheld.stableSectionId;
  } catch {
    return false;
  }
}

/**
 * Legacy section deep link. Flags off: the unchanged legacy/resolver
 * destinations, before any paper structure is loaded. Flags on (M1-07): the
 * canonical Working Draft, keeping the section identity as `section=` when the
 * id is a heading anchor or a legacy section-anchor id of this release; any
 * other id lands on the Working Draft without a section.
 *
 * The version must be a bound release. A successor release also accepts the
 * predecessor's retired section ids, which land on the section that replaced
 * them. The stable id of a section the release withholds opens no section: it
 * lands on the Working Draft's withheld notice. That is decided from the release
 * entry as soon as the route parameters are known, so it needs no session, no
 * reader and no load, and answers the same whether or not the release can be
 * read. The legacy and resolver destinations exist for the default release only,
 * so any other release is not found there.
 */
export default async function PaperSectionPage({ params }: { params: Promise<{ documentVersion: string; stableSectionId: string }> }) {
  const { documentVersion, stableSectionId } = await params;
  const release = getPaperRelease(documentVersion);
  if (!release) notFound();
  const withheld = namesWithheldSection(release, stableSectionId);

  const gate = resolveMatrixOptionsPaperReviewNavigationGate(
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE,
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION,
  );
  if (gate !== 'REVIEW_NAVIGATION' && release.documentVersion !== REVISED_PAPER_VERSION) notFound();
  if (gate === 'LEGACY_TWG_REVIEW') redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  if (gate === 'PAPER_RESOLVER') redirect(REVISED_PAPER_ROUTE);
  if (withheld) redirect(`${paperWorkspaceHref(release.documentVersion, { mode: 'working-draft', cohort: null, q: null, section: null })}#${PAPER_WITHHELD_NOTICE_ID}`);
  // A private-storage release resolves a section only for its allowed reader (request-structure.ts).
  const { structure } = await loadPaperStructureForPage(release.documentVersion);
  const section = resolveLegacySectionAnchor(structure, stableSectionId, release.retiredSectionAnchors);
  redirect(paperWorkspaceHref(release.documentVersion, { mode: 'working-draft', cohort: null, q: null, section }));
}
