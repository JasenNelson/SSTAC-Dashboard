import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getRateLimitHeaders } from '@/app/api/_helpers/rate-limit-wrapper';
import { resolveMatrixOptionsPaperReviewNavigationGate } from '@/lib/matrix-options/navigation';
import {
  buildPaperSectionContract,
  getPaperSectionWindowModel,
  PAPER_SECTION_WINDOW_FAILURE_PREFIX,
  paperSectionIdentity,
} from '@/lib/matrix-options/paper/section-window';
import type { PaperSectionGroup } from '@/lib/matrix-options/paper/section-window';
import { REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';
import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { RATE_LIMIT_CONFIGS } from '@/lib/rate-limit-redis';
import { createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth';

/*
 * GET /api/matrix-options/paper/v/<version>/sections/<depth-1 anchor>?paper=<sha256>
 *
 * One depth-1 section of the Working Draft as serializable data (S1, authorized
 * by the L2 CP-M1-STRATEGIC-001 decision; PLAN-R4 section 4.4's API row lists
 * only the M3 review routes). The response is the section contract only: never
 * JSX, never HTML, never the whole paper.
 *
 * /api/** is NOT covered by the middleware auth matcher, so this handler checks
 * the feature gate and the session itself, in this order: gate -> session ->
 * rate limit -> version -> paper identity -> section anchor. Every response is
 * JSON and no-store.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOCUMENT_FAILURE_PREFIXES = [PAPER_SECTION_WINDOW_FAILURE_PREFIX, 'Paper full-document model unavailable: '] as const;

function json(body: unknown, status: number, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

/** Same rule as the publication page (M1-05): only known validator failures become a 404. */
function isExpectedPaperFailure(error: unknown): boolean {
  return error instanceof Error
    && Object.getPrototypeOf(error) === Error.prototype
    && DOCUMENT_FAILURE_PREFIXES.some((prefix) => error.message.startsWith(prefix));
}

/** The depth-1 section a route segment names, raw first and percent-decoded second. */
function resolveSectionGroup(groups: readonly PaperSectionGroup[], rawAnchor: string): PaperSectionGroup | null {
  const candidates = [rawAnchor];
  try {
    const decoded = decodeURIComponent(rawAnchor);
    if (decoded !== rawAnchor) candidates.push(decoded);
  } catch {
    // Malformed percent-encoding: only the raw value is considered.
  }
  for (const candidate of candidates) {
    const group = groups.find((entry) => entry.anchor === candidate);
    if (group) return group;
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentVersion: string; sectionAnchor: string }> },
) {
  const gate = resolveMatrixOptionsPaperReviewNavigationGate(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE, process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION);
  if (gate !== 'REVIEW_NAVIGATION') return json({ error: 'Not found' }, 404);

  const supabase = await createAuthenticatedClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { response: rateLimited, headers: rateLimitHeaders } = await getRateLimitHeaders(request, user.id, RATE_LIMIT_CONFIGS.default);
  if (rateLimited) {
    rateLimited.headers.set('Cache-Control', 'no-store');
    return rateLimited;
  }

  const { documentVersion, sectionAnchor } = await params;
  if (documentVersion !== REVISED_PAPER_VERSION) return json({ error: 'Not found' }, 404, rateLimitHeaders);

  const structure = loadRevisedPaperStructure();
  try {
    const { groups } = getPaperSectionWindowModel(structure);
    const identity = paperSectionIdentity(structure, documentVersion);
    if (new URL(request.url).searchParams.get('paper') !== identity.paperSha256) {
      return json({ error: 'Paper release mismatch' }, 409, rateLimitHeaders);
    }
    const group = resolveSectionGroup(groups, sectionAnchor);
    if (!group) return json({ error: 'Not found' }, 404, rateLimitHeaders);
    return json(buildPaperSectionContract(structure, groups, group.index, identity), 200, rateLimitHeaders);
  } catch (error) {
    if (isExpectedPaperFailure(error)) {
      console.error('[matrix-options-paper] section route unavailable: PAPER_SECTION_UNAVAILABLE');
      return json({ error: 'Not found' }, 404, rateLimitHeaders);
    }
    throw error;
  }
}
