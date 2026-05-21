import React from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

import MatrixDashboard from '@/components/MatrixDashboard';
import { fetchMatrixMapSamplesServerSide } from '@/lib/matrix-map/fetch-samples-server';
import { EMPTY_MATRIX_MAP_DATA, type MatrixMapData } from '@/app/(dashboard)/matrix-map/types';

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

export default async function MatrixOptionsPage() {
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

  const readFinalPaper = () => {
    try {
      const filePath = path.join(process.cwd(), 'matrix_research', 'options_paper', 'BC_Matrix_Options_Paper_FINAL_DRAFT.md');
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
    } catch (error) {
      console.error('Failed to load final paper', error);
    }
    return 'Error loading final paper.';
  };

  const eqpCaseStudyContent = readDraft('CaseStudy_EqP_AVS.md');
  const bsafCaseStudyContent = readDraft('CaseStudy_BSAF.md');
  const humanHealthContent = readDraft('Framework_HumanHealth.md');
  const guideContent = readDraft('The_Guide.md');
  const finalDraftContent = readFinalPaper();

  // Matrix Interactive Map embed (owner directive 2026-05-20): the
  // /matrix-options 'Interactive Map' tab now hosts the live matrix-map
  // inline (BN-RRM tab pattern) instead of linking out to the standalone
  // /matrix-map route. Server-fetch the RPC payload here so the embedded
  // MatrixMapLoader receives the same initialMapData prop shape it gets
  // on /matrix-map/page.tsx.
  //
  // Codex P1 (2026-05-20): /matrix-options is NOT in src/middleware.ts
  // matcher (only /dashboard, /twg, /survey-results, /cew-2025,
  // /regulatory-review, /bn-rrm are). Historically anon-accessible.
  // We preserve that behavior by gating the RPC call on having an
  // authenticated user; anon callers see the same matrix-options
  // content they always saw, with the Interactive Map tab showing the
  // empty-data fallback (no RPC fetch fires, no log noise, no widened
  // request surface). Authenticated users get the live map data.
  let initialMapData: MatrixMapData = EMPTY_MATRIX_MAP_DATA;
  let fetchErrorMessage: string | null = null;
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
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full overflow-hidden print:block print:h-auto print:overflow-visible">
      <MatrixDashboard
        eqpCaseStudyContent={eqpCaseStudyContent}
        bsafCaseStudyContent={bsafCaseStudyContent}
        humanHealthContent={humanHealthContent}
        guideContent={guideContent}
        finalDraftContent={finalDraftContent}
        initialMapData={initialMapData}
        fetchErrorMessage={fetchErrorMessage}
      />
    </div>
  );
}
