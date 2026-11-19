import { NextRequest, NextResponse } from 'next/server';

import { createPreviewR2Service } from '@/lib/matrix-options/paper/guided-r2-preview-service';
import { isLocalR2PreviewRequest } from '@/lib/matrix-options/paper/r2-review-preview-source';
import { getGuidedR2Manifest } from '@/lib/matrix-options/paper/guided-r2-manifest';
import { buildGuidedAdminCsv, normalizeGuidedAdminRows } from '@/lib/matrix-options/paper/guided-r2-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cookieName = 'matrix-r2-preview-session';
const noStore = { 'Cache-Control': 'no-store' };
const previewGlobal = globalThis as typeof globalThis & { matrixR2PreviewService?: ReturnType<typeof createPreviewR2Service> };
const service = previewGlobal.matrixR2PreviewService ??= createPreviewR2Service();

export async function GET(request: NextRequest) {
  if (!isLocalR2PreviewRequest(request.headers)) return NextResponse.json({ outcome: 'not_found' }, { status: 404, headers: noStore });
  const mode = request.nextUrl.searchParams.get('admin');
  if (mode !== '1' && mode !== 'csv') return NextResponse.json({ outcome: 'not_found' }, { status: 404, headers: noStore });
  const manifest = getGuidedR2Manifest();
  const identity = { documentVersion: manifest.documentVersion, guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256 };
  const snapshot = service.adminSnapshot();
  const rows = normalizeGuidedAdminRows(snapshot.entries, snapshot.completions, identity);
  if (rows === null) return NextResponse.json({ outcome: 'integrity_error' }, { status: 500, headers: noStore });
  if (mode === 'csv') return new Response(buildGuidedAdminCsv(rows, identity), { headers: {
    ...noStore, 'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="matrix-guided-r2-preview.csv"',
  } });
  return NextResponse.json({ identity, rows }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  if (!isLocalR2PreviewRequest(request.headers)) {
    return NextResponse.json({ outcome: 'not_found' }, { status: 404, headers: noStore });
  }
  const host = request.headers.get('host');
  if (!host || request.headers.get('origin') !== `http://${host}`) {
    return NextResponse.json({ outcome: 'origin_denied' }, { status: 403, headers: noStore });
  }
  if (Number(request.headers.get('content-length') ?? 0) > 80000) {
    return NextResponse.json({ outcome: 'too_large' }, { status: 413, headers: noStore });
  }
  let raw: unknown;
  try {
    const body = await request.text();
    if (body.length > 80000) return NextResponse.json({ outcome: 'too_large' }, { status: 413, headers: noStore });
    raw = JSON.parse(body);
  } catch {
    return NextResponse.json({ outcome: 'invalid_payload' }, { status: 422, headers: noStore });
  }
  const token = request.cookies.get(cookieName)?.value;
  const reply = await service.handle(raw, token);
  const response = NextResponse.json(reply.body, { status: reply.status, headers: noStore });
  if (reply.sessionToken) {
    response.cookies.set(cookieName, reply.sessionToken, {
      httpOnly: true, sameSite: 'strict', secure: false,
      path: '/api/matrix-options/paper/preview-r2', maxAge: 3600,
    });
  }
  return response;
}
