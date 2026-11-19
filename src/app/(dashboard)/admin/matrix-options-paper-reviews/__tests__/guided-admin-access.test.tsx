import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  access: { allowed: true, user: { id: '99999999-9999-4999-8999-999999999999' }, role: 'admin' } as unknown,
  reads: 0,
}));
const shaA = 'a'.repeat(64);
const shaB = 'b'.repeat(64);
const identity = { documentVersion: 'phase2-review-2026-11-fa356b89', guidedManifestSha256: shaA, reviewManifestSha256: shaB };
const userId = '11111111-1111-4111-8111-111111111111';
const entry = { user_id: userId, document_version: identity.documentVersion,
  guided_manifest_sha256: identity.guidedManifestSha256, review_manifest_sha256: identity.reviewManifestSha256,
  target_kind: 'text-prompt', target_id: 'site-assignment', revision: 1, draft_choice_id: null,
  draft_rationale: null, draft_text: 'Guided answer', submitted_choice_id: null, submitted_rationale: null,
  submitted_text: 'Guided answer', submitted_revision: 1, submitted_at: '2026-11-19T01:00:00Z', updated_at: '2026-11-19T00:00:00Z' };
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock('next/navigation', () => ({ redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }), usePathname: vi.fn(() => '/admin/matrix-options-paper-reviews') }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: vi.fn() })) }));
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn(() => ({})) }));
vi.mock('@/lib/matrix-options/paper-admin-guard', () => ({ getPaperAdminAccess: vi.fn(async () => state.access) }));
vi.mock('@/lib/matrix-options/paper/guided-r2-manifest', () => ({ getGuidedR2Manifest: vi.fn(() => identity) }));
vi.mock('@/lib/matrix-options/paper/guided-r2-admin-query', () => ({ fetchGuidedAdminState: vi.fn(async () => { state.reads += 1; return { entries: [entry], completions: [] }; }) }));

import MatrixOptionsPaperReviewsPage from '../page';
import { GET as exportGuided } from '@/app/api/matrix-options/paper/guided-r2/export/route';

beforeEach(() => { state.access = { allowed: true, user: { id: '99999999-9999-4999-8999-999999999999' }, role: 'admin' }; state.reads = 0; });

it('denies guided page and CSV before any guided data query', async () => {
  state.access = { allowed: false, status: 403, reason: 'forbidden' };
  await expect(MatrixOptionsPaperReviewsPage({ searchParams: Promise.resolve({ view: 'guided' }) })).rejects.toThrow('REDIRECT:/dashboard');
  const forbidden = await exportGuided(new Request('http://localhost/api/matrix-options/paper/guided-r2/export'));
  expect(forbidden.status).toBe(403);
  expect(state.reads).toBe(0);
  state.access = { allowed: false, status: 401, reason: 'unauthenticated' };
  await expect(MatrixOptionsPaperReviewsPage({ searchParams: Promise.resolve({ view: 'guided' }) })).rejects.toThrow('REDIRECT:/login');
  const unauthorized = await exportGuided(new Request('http://localhost/api/matrix-options/paper/guided-r2/export'));
  expect(unauthorized.status).toBe(401);
  expect(state.reads).toBe(0);
});

it('shows and exports the same structured response only for an authorized administrator', async () => {
  const page = await MatrixOptionsPaperReviewsPage({ searchParams: Promise.resolve({ view: 'guided' }) });
  render(page);
  expect(screen.getByRole('table', { name: 'Guided R2 review responses' })).toHaveTextContent('Guided answer');
  expect(screen.getByRole('link', { name: 'Legacy v0.9.91' })).toHaveAttribute('href', '/admin/matrix-options-paper-reviews?view=legacy');
  const csv = await exportGuided(new Request('http://localhost/api/matrix-options/paper/guided-r2/export'));
  expect(csv.status).toBe(200);
  expect(await csv.text()).toContain('"Guided answer"');
  expect(state.reads).toBe(2);
});
