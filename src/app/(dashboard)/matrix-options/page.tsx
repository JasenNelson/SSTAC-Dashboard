import React from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import fs from 'fs';
import path from 'path';

import MatrixDashboard from '@/components/MatrixDashboard';
import { fetchMatrixMapSamplesServerSide } from '@/lib/matrix-map/fetch-samples-server';
import { fetchMatrixMapSiteAggregatesServerSide } from '@/lib/matrix-map/fetch-site-aggregates-server';
import {
  EMPTY_MATRIX_MAP_DATA,
  EMPTY_MATRIX_SITE_AGGREGATE_DATA,
  type MatrixMapData,
  type MatrixSiteAggregateData,
} from '@/app/(dashboard)/matrix-map/types';
import {
  isMatrixOptionsPaperWorkspaceEnabled,
  MATRIX_OPTIONS_PAPER_LANDING_PATH,
  parseMatrixOptionsViewParam,
} from '@/lib/matrix-options/navigation';
import {
  loadRevisedPaper,
  REVISED_PAPER_VERSION,
} from '@/lib/matrix-options/revised-paper';

export const metadata = {
  title: 'Matrix Options Analysis | SSTAC Dashboard',
  description: 'Collaborative policy review dashboard for sediment quality standards.',
};

// Route-segment config: this page reads cookies + Supabase per-request
// (server-side matrix-map RPC fetch), so it cannot be statically generated.
// Pattern mirrors /matrix-map/page.tsx.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function buildSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    },
  );
}

interface MatrixOptionsPageProps {
  searchParams: Promise<{ view?: string | string[] }>;
}

export default async function MatrixOptionsPage({ searchParams }: MatrixOptionsPageProps) {
  const { view } = await searchParams;
  const initialViewId = parseMatrixOptionsViewParam(view);
  const paperWorkspaceEnabled = isMatrixOptionsPaperWorkspaceEnabled(
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE,
  );
  const paperRelease = loadRevisedPaper(REVISED_PAPER_VERSION);
  if (paperWorkspaceEnabled && initialViewId === 'TWG Review') {
    redirect(MATRIX_OPTIONS_PAPER_LANDING_PATH);
  }
  const readDraft = (filename: string) => {
    try {
      const filePath = path.join(process.cwd(), 'matrix_research', 'content_drafts', filename);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
    } catch (error) {
      console.error(`Failed to load ${filename}`, error);
    }
    return `Error loading ${filename}.`;
  };

  const guideContent = readDraft('The_Guide.md');

  // Matrix Interactive Map embed (owner directive 2026-05-20): the
  // /matrix-options 'Interactive Map' tab now hosts the live matrix-map
  // inline (BN-RRM tab pattern) instead of linking out to the standalone
  // /matrix-map route. Server-fetch the RPC payload here so the embedded
  // MatrixMapLoader receives the same initialMapData prop shape it gets
  // on /matrix-map/page.tsx.
  //
  // /matrix-options is GATED by the middleware matcher ('/matrix-options/:path*')
  // as of 2026-06-15 (owner directive: the (dashboard) group is authenticated-only;
  // the earlier 2026-05-20 "public by design" decision was NOT owner-approved and
  // was reverted). The getUser() + conditional RPC fetch below is now defense-in-depth:
  // middleware redirects anon to /login before this page renders, so `user` is present
  // here -- but the guard stays so the live-map RPC never fires without an authenticated
  // user. The RPC also enforces matrix_map.is_email_allowlisted (JWT sub).
  let initialMapData: MatrixMapData = EMPTY_MATRIX_MAP_DATA;
  let fetchErrorMessage: string | null = null;
  let siteAggregateData: MatrixSiteAggregateData = EMPTY_MATRIX_SITE_AGGREGATE_DATA;
  let siteAggregateFetchErrorMessage: string | null = null;
  const supabase = await buildSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    // Authenticated: pull the live RPC payload. The RPC itself enforces
    // its own allowlist (matrix_map.is_email_allowlisted via JWT sub
    // since migration 20260520000004); the helper handles error logging
    // + empty-data fallback.
    const result = await fetchMatrixMapSamplesServerSide(supabase);
    initialMapData = result.initialMapData;
    fetchErrorMessage = result.fetchErrorMessage;
    if (fetchErrorMessage === null) {
      const aggregateResult = await fetchMatrixMapSiteAggregatesServerSide(supabase);
      siteAggregateData = aggregateResult.siteAggregateData;
      siteAggregateFetchErrorMessage = aggregateResult.siteAggregateFetchErrorMessage;
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full overflow-hidden print:block print:h-auto print:overflow-visible">
      <MatrixDashboard
        guideContent={guideContent}
        paperRelease={paperRelease}
        initialViewId={initialViewId}
        paperWorkspaceEnabled={paperWorkspaceEnabled}
        initialMapData={initialMapData}
        fetchErrorMessage={fetchErrorMessage}
        siteAggregateData={siteAggregateData}
        siteAggregateFetchErrorMessage={siteAggregateFetchErrorMessage}
      />
    </div>
  );
}
