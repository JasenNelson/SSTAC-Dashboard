import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

import { getGuidedR2Manifest } from '@/lib/matrix-options/paper/guided-r2-manifest';
import { GUIDED_R2_TARGETS } from '@/lib/matrix-options/paper/guided-r2-contract';
import { POST } from '../route';

const manifest = getGuidedR2Manifest();
const identity = { documentVersion: manifest.documentVersion,
  guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256 };
const endpoint = 'http://127.0.0.1:49232/api/matrix-options/paper/preview-r2';

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(endpoint, { method: 'POST', body: JSON.stringify(body), headers: {
    host: '127.0.0.1:49232', origin: 'http://127.0.0.1:49232', 'content-type': 'application/json', ...headers,
  } });
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('rejects disabled, forwarded and cross-origin requests before any session or production fetch', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const body = { operation: 'state', identity };
  expect((await POST(request(body))).status).toBe(404);
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('MATRIX_R2_REVIEW_PREVIEW', '1');
  const rejectedHeaders: Record<string, string>[] = [
    { host: 'localhost:49232' },
    { 'x-forwarded-host': 'example.test' },
    { 'x-original-host': '127.0.0.1:49232' },
  ];
  for (const headers of rejectedHeaders) {
    const response = await POST(request(body, headers));
    expect(response.status).toBe(404);
    expect(response.cookies.get('matrix-r2-preview-session')).toBeUndefined();
  }
  const wrongOrigin = await POST(request(body, { origin: 'http://example.test' }));
  expect(wrongOrigin.status).toBe(403);
  expect(wrongOrigin.cookies.get('matrix-r2-preview-session')).toBeUndefined();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('keeps one opaque process-memory session across state, save and reload', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('MATRIX_R2_REVIEW_PREVIEW', '1');
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const first = await POST(request({ operation: 'state', identity }));
  expect(first.status).toBe(200);
  const token = first.cookies.get('matrix-r2-preview-session')?.value;
  expect(token).toMatch(/^[0-9a-f-]{36}$/);
  const state = await first.json();
  const choice = GUIDED_R2_TARGETS.find((target) => target.kind === 'choice-prompt')!;
  const saved = await POST(request({ operation: 'save', targetId: choice.id, body: {
    ...identity, targetKind: choice.kind, expectedRevision: 0, expectedUserId: state.userKey,
    draft: { choiceId: choice.options[0], rationale: 'Preview only' },
  } }, { cookie: `matrix-r2-preview-session=${token}` }));
  expect(saved.status).toBe(200);
  const reload = await POST(request({ operation: 'state', identity }, { cookie: `matrix-r2-preview-session=${token}` }));
  expect((await reload.json()).entries).toHaveLength(1);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('overwrites a stale cookie with a fresh process-memory session on state bootstrap', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('MATRIX_R2_REVIEW_PREVIEW', '1');
  const response = await POST(request({ operation: 'state', identity }, {
    cookie: 'matrix-r2-preview-session=unknown-stale-process-token',
  }));
  expect(response.status).toBe(200);
  expect(response.cookies.get('matrix-r2-preview-session')?.value).toMatch(/^[0-9a-f-]{36}$/);
  expect(response.cookies.get('matrix-r2-preview-session')?.value).not.toBe('unknown-stale-process-token');
});
