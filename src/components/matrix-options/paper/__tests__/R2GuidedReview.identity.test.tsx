import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const auth = vi.hoisted(() => ({ listeners: new Set<(event: string, session: { user: { id: string } } | null) => void>() }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { onAuthStateChange(callback: (event: string, session: { user: { id: string } } | null) => void) {
  auth.listeners.add(callback);
  return { data: { subscription: { unsubscribe() { auth.listeners.delete(callback); } } } };
} } }) }));

import { R2GuidedReview } from '../R2GuidedReview';
import { getGuidedR2Manifest } from '@/lib/matrix-options/paper/guided-r2-manifest';
import { GUIDED_R2_FOCUS_AREAS } from '@/lib/matrix-options/paper/guided-r2-contract';

const manifest = getGuidedR2Manifest();
const shaA = 'a'.repeat(64);
const oldUser = '11111111-1111-4111-8111-111111111111';
const newUser = '22222222-2222-4222-8222-222222222222';
const stateFor = (user: string, rationale: string) => ({ mode: 'writable', userKey: user,
  documentVersion: manifest.documentVersion, guidedManifestSha256: manifest.guidedManifestSha256,
  reviewManifestSha256: manifest.reviewManifestSha256, completion: null,
  entries: [{ user_id: user, document_version: manifest.documentVersion,
    guided_manifest_sha256: manifest.guidedManifestSha256, review_manifest_sha256: manifest.reviewManifestSha256,
    target_kind: 'choice-prompt', target_id: 'structure-approach', revision: 1,
    draft_choice_id: 'sound', draft_rationale: rationale, draft_text: null,
    submitted_choice_id: null, submitted_rationale: null, submitted_text: null,
    submitted_revision: null, submitted_at: null, updated_at: '2026-11-19T00:00:00Z' }],
});
const props = { documentVersion: manifest.documentVersion, guidedManifestSha256: manifest.guidedManifestSha256,
  reviewManifestSha256: manifest.reviewManifestSha256, outline: [{ anchor: 'sec-phase2-3', label: '3. Framework' }],
  paper: <article><section id="sec-phase2-3">Paper</section></article> };
const fetchMock = vi.fn();
beforeEach(() => { auth.listeners.clear(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); window.localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

it('clears the previous reviewer and bootstraps the new reviewer on an in-place account switch', async () => {
  let reads = 0;
  let feedbackReads = 0;
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?')
    ? stateFor(++reads === 1 ? oldUser : newUser, reads === 1 ? 'Old reviewer text' : 'New reviewer text')
    : { guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256,
      items: [{ areaId: GUIDED_R2_FOCUS_AREAS[0].id, sectionAnchor: 'sec-phase2-1',
        sourceReleaseIdentity: 'historical', sourcePaperSha256: shaA, sourceGuideSha256: shaA,
        sourceManifestSha256: shaA, originalQuestionId: 'question', relationType: 'exact-continuation',
        responseStatus: 'submitted', timestamp: null, displayLabel: 'Earlier feedback',
        text: ++feedbackReads === 1 ? 'Old earlier feedback' : 'New earlier feedback' }] }))));
  render(<R2GuidedReview {...props} />);
  await screen.findAllByDisplayValue('Old reviewer text');
  await screen.findAllByText('Old earlier feedback');
  act(() => { for (const callback of auth.listeners) callback('SIGNED_IN', { user: { id: newUser } }); });
  await waitFor(() => expect(screen.getAllByDisplayValue('New reviewer text').length).toBeGreaterThan(0));
  await screen.findAllByText('New earlier feedback');
  expect(screen.queryByDisplayValue('Old reviewer text')).not.toBeInTheDocument();
  expect(screen.queryAllByText('Old earlier feedback')).toHaveLength(0);
  expect(reads).toBe(2);
  expect(feedbackReads).toBe(2);
});

it('bootstraps again when a reviewer signs out and another signs in on the mounted page', async () => {
  let reads = 0;
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?')
    ? stateFor(++reads === 1 ? oldUser : newUser, reads === 1 ? 'Old reviewer text' : 'New reviewer text')
    : { guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256, items: [] }))));
  render(<R2GuidedReview {...props} />);
  await screen.findAllByDisplayValue('Old reviewer text');
  act(() => { for (const callback of auth.listeners) callback('SIGNED_OUT', null); });
  expect(screen.queryByDisplayValue('Old reviewer text')).not.toBeInTheDocument();
  act(() => { for (const callback of auth.listeners) callback('SIGNED_IN', { user: { id: newUser } }); });
  await waitFor(() => expect(screen.getAllByDisplayValue('New reviewer text').length).toBeGreaterThan(0));
  expect(reads).toBe(2);
});
