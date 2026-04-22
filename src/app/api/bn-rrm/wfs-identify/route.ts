import { NextRequest, NextResponse } from 'next/server';

const OPENMAPS_WFS_URL = 'https://openmaps.gov.bc.ca/geo/pub/ows';

export async function GET(request: NextRequest) {
  const params = new URLSearchParams(request.nextUrl.search);
  const service = (params.get('service') ?? '').toUpperCase();
  const operation = (params.get('request') ?? '').toUpperCase();

  if (service !== 'WFS' || operation !== 'GETFEATURE') {
    return NextResponse.json(
      { error: 'Only WFS GetFeature requests are supported.' },
      { status: 400 },
    );
  }

  const upstreamUrl = `${OPENMAPS_WFS_URL}?${params.toString()}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      cache: 'no-store',
    });
    const body = await upstream.text();

    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to reach the BC OpenMaps WFS GetFeature service.' },
      { status: 502 },
    );
  }
}
