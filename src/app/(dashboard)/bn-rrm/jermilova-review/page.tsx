// /bn-rrm/jermilova-review -- standalone collaborative-review page for the
// Jermilova BN-RRM methodology paper.
//
// Server component reads the snapshotted methodology MD from public/ and
// passes it to the client portal. Same shape as /matrix-options (server
// reads, client renders TWG portal). The MD lives at
// public/bn-rrm/jermilova-methodology.md (424 KB; v1.0 snapshot of the
// canonical Regulatory-Review repo doc -- see commit 47d563a for the
// rationale on committing the snapshot rather than build-time copy).
//
// Access: any signed-in user can read and write their own row (RLS-gated
// by document_reviews.user_id). Unsigned users are sent to /login. This
// is NOT an admin-only route; the admin pool lives at
// /admin/jermilova-review.
//
// The same JermilovaReviewPortal also mounts as a 4th tier inside the
// AiAssistedDevelopmentView (Case Studies -> AI-assisted -> TWG Review).
// This standalone route is the alternative deep-link entry point.

import fs from 'fs';
import path from 'path';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import JermilovaReviewPortal from '@/components/document-reviews/JermilovaReviewPortal';

export const metadata = {
  title: 'Jermilova BN-RRM Review | SSTAC Dashboard',
  description:
    'Collaborative section-by-section review of the Jermilova BN-RRM construction methodology paper.',
};

// MD source: public/bn-rrm/jermilova-methodology.md. Read at request time
// so a v1.1 carry-forward resync (one-line commit replacing the MD) does
// not require a code change.
function readMethodologyMd(): string {
  const filePath = path.join(
    process.cwd(),
    'public',
    'bn-rrm',
    'jermilova-methodology.md',
  );
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error('Failed to load jermilova methodology MD', err);
    return '# Error loading methodology paper\n\nThe snapshot at public/bn-rrm/jermilova-methodology.md could not be read. Please contact an administrator.';
  }
}

export default async function JermilovaReviewPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const methodologyContent = readMethodologyMd();

  // Codex P1-2: print:h-auto + print:overflow-visible override the
  // viewport-fixed scroll shell so window.print() emits the full
  // methodology body, not a clipped slice. MDN: overflow:hidden clips
  // at the ancestor's padding box; descendants cannot cancel ancestor
  // clipping, so every fixed-height/overflow-hidden ancestor on the
  // print path needs its own print override.
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full overflow-hidden print:h-auto print:overflow-visible print:block">
      <JermilovaReviewPortal
        methodologyContent={methodologyContent}
        initialShowLeftPanel
        initialShowRightPanel
      />
    </div>
  );
}
