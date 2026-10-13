import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { SupabaseClient } from '@supabase/supabase-js';
import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import { getReviewManifest } from '../review-manifest';
import { loadTrustedDownloadContext, loadTrustedDownloadReleaseContext } from '../download-manifest-server';
import { resetPrivateReleaseCacheForTests } from '../private-release-assets';
import { getPaperRelease, V0991_PAPER_VERSION } from '../releases';
import { describePrivateV0991 } from './private-fixture';

function sessionClient(initialUser: unknown) {
  let currentUser = initialUser;
  const getUser = vi.fn(async () => ({ data: { user: currentUser }, error: null }));
  const getSession = vi.fn(async () => ({ data: { session: { access_token: 'synthetic-session-token' } }, error: null }));
  const client = { auth: { getUser, getSession } } as unknown as SupabaseClient;
  return { client, getUser, setUser: (user: unknown) => { currentUser = user; } };
}

describePrivateV0991('real v0.9.91 download release context on the private fixture', () => {
  const fetchStub = vi.fn(async () => { throw new Error('provider fetch is forbidden in this fixture test'); });

  beforeEach(() => {
    resetPrivateReleaseCacheForTests();
    fetchStub.mockClear();
    vi.stubGlobal('fetch', fetchStub);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('authenticates the real source, guide, cohort and review-manifest bindings', async () => {
    const reader = sessionClient({ id: 'fixture-reader', is_anonymous: false });
    const release = getPaperRelease(V0991_PAPER_VERSION)!;
    const review = getReviewManifest(V0991_PAPER_VERSION);
    const cohorts = getCohortManifest(V0991_PAPER_VERSION);
    const context = await loadTrustedDownloadReleaseContext(V0991_PAPER_VERSION, reader.client);
    expect(context).toMatchObject({
      documentVersion: V0991_PAPER_VERSION,
      paperSha256: release.sha256,
      manifestSha256: review.sha256,
      paperReleaseIdentity: expect.any(String),
    });
    expect(Object.keys(context.cohortQuestionIds).sort()).toEqual(cohorts.cohorts.map((cohort) => cohort.id).sort());
    expect(context.reviewManifest).toStrictEqual(review);
    expect(reader.getUser).toHaveBeenCalledTimes(1);
    expect(fetchStub).not.toHaveBeenCalled();
  }, 60_000);

  it('rejects a wrong manifest identity after real private-source authentication', async () => {
    const reader = sessionClient({ id: 'fixture-reader', is_anonymous: false });
    await expect(loadTrustedDownloadContext({
      documentVersion: V0991_PAPER_VERSION,
      manifestSha256: '0'.repeat(64),
      cohortId: 'categories',
    }, reader.client)).rejects.toMatchObject({ code: 'RELEASE_IDENTITY_MISMATCH' });
    expect(reader.getUser).toHaveBeenCalledTimes(1);
    expect(fetchStub).not.toHaveBeenCalled();
  }, 60_000);

  it('denies anonymous and changed sessions even after a warm verified source', async () => {
    const reader = sessionClient({ id: 'fixture-reader', is_anonymous: false });
    await loadTrustedDownloadReleaseContext(V0991_PAPER_VERSION, reader.client);
    reader.setUser({ id: 'fixture-reader', is_anonymous: true });
    await expect(loadTrustedDownloadReleaseContext(V0991_PAPER_VERSION, reader.client)).rejects.toMatchObject({ code: 'TRUSTED_RELEASE_UNAVAILABLE' });
    reader.setUser(null);
    await expect(loadTrustedDownloadReleaseContext(V0991_PAPER_VERSION, reader.client)).rejects.toMatchObject({ code: 'TRUSTED_RELEASE_UNAVAILABLE' });
    expect(fetchStub).not.toHaveBeenCalled();
  }, 60_000);
});
