import { NextRequest, NextResponse } from 'next/server';

import { isLocalR2PreviewRequest, loadLocalR2PreviewFigure } from '@/lib/matrix-options/paper/r2-review-preview-source';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { readonly params: Promise<{ readonly file: string }> }) {
  if (!isLocalR2PreviewRequest(request.headers)) return new NextResponse(null, { status: 404 });
  const { file } = await params;
  const sha256 = request.nextUrl.searchParams.get('sha256');
  if (!sha256 || !/^[a-f0-9]{64}$/.test(sha256)) return new NextResponse(null, { status: 404 });
  try {
    const bytes = await loadLocalR2PreviewFigure(file, sha256);
    return new NextResponse(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
