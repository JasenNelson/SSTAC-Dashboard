import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { isLocalR2PreviewRequest } from '@/lib/matrix-options/paper/r2-review-preview-source';
import FixtureAdminClient from './FixtureAdminClient';

export const dynamic = 'force-dynamic';

/** Loopback development fixture; provider credentials and production data are never read. */
export default async function R2GuidedAdminFixturePage() {
  if (!isLocalR2PreviewRequest(await headers())) notFound();
  return <FixtureAdminClient />;
}
