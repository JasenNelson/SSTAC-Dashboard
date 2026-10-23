// Anonymous, read-only Jermilova viewer mounted on the main deployment.
//
// The viewer (viewers/jermilova-public) is a separate static export built with
// basePath '/Jermilova'. Its exact, reviewed output is committed as a mirror under
// public/Jermilova/ (see viewers/jermilova-public/scripts/publish-root-mirror.mjs and
// published-mirror.json), so the root app serves it as public files:
//   - /Jermilova/_next/** and /Jermilova/bn-rrm/** are plain public files;
//   - /Jermilova/ is 308-redirected to /Jermilova by Next (trailingSlash is false here),
//     and /Jermilova is rewritten to the export's index.html below.
// src/middleware.ts never matches /Jermilova/** (no login, no Supabase call), so the
// security headers the middleware applies elsewhere are set here instead, with a CSP
// scoped to what the viewer actually loads.
//
// Same origin as the authenticated app: script-src therefore allows exactly the page's
// own inline scripts by SHA-256 (recorded at publish time in published-mirror.json and
// re-checked against the committed index.html by the required unit test), never
// 'unsafe-inline'.
//
// The viewer's client router would fetch its RSC payload at '/Jermilova.txt' (export built
// with trailingSlash). The page has no client navigation (no next/link, router or
// prefetch), so nothing requests it; a request would 404 and the router falls back to a
// full page load.
import publishedMirror from '../../../viewers/jermilova-public/published-mirror.json';

export const JERMILOVA_PUBLIC_MOUNT = '/Jermilova';

export const JERMILOVA_INLINE_SCRIPT_HASHES: readonly string[] = publishedMirror.index_inline_script_sha256;

// Hosts the viewer's map loads images from (the original SiteMap basemaps and the BC WMS).
export const JERMILOVA_MAP_IMAGE_HOSTS = [
  'https://*.tile.openstreetmap.org',
  'https://server.arcgisonline.com',
  'https://*.tile.opentopomap.org',
  'https://stamen-tiles.a.ssl.fastly.net',
  'https://openmaps.gov.bc.ca',
] as const;

export const JERMILOVA_PUBLIC_CSP = [
  "default-src 'self'",
  // Next's static export bootstraps with inline scripts: allow exactly those, by hash.
  `script-src 'self' ${JERMILOVA_INLINE_SCRIPT_HASHES.map((hash) => `'${hash}'`).join(' ')}`,
  // Tailwind/styled-jsx and Leaflet set inline styles.
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${JERMILOVA_MAP_IMAGE_HOSTS.join(' ')}`,
  "font-src 'self' data:",
  "connect-src 'self' https://openmaps.gov.bc.ca",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: JERMILOVA_PUBLIC_CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  },
  // Same HSTS value the middleware sets in production on the routes it matches (the guard test
  // reads it from src/middleware.ts). The mount sets it in every environment; browsers ignore
  // it on http.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  // Conservative default: public but not indexed by search engines (the pack data includes
  // claim-owner and company names). Removing this is an explicit owner decision.
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

export const jermilovaPublicRewrites = [
  { source: JERMILOVA_PUBLIC_MOUNT, destination: `${JERMILOVA_PUBLIC_MOUNT}/index.html` },
];

// The page is revalidated on every load (no-cache), so a fresh load always gets the current
// index.html, whose framework files have content-hashed names, together with the current pack
// files. A page already open during a republish can still fetch new pack bytes with its old
// code; the integrity check then fails closed and a reload recovers.
const pageCache = { key: 'Cache-Control', value: 'no-cache' };

export const jermilovaPublicHeaders = [
  { source: JERMILOVA_PUBLIC_MOUNT, headers: [...securityHeaders, pageCache] },
  { source: `${JERMILOVA_PUBLIC_MOUNT}/:path*`, headers: securityHeaders },
  { source: `${JERMILOVA_PUBLIC_MOUNT}/index.html`, headers: [pageCache] },
  // Pack files have stable, unhashed URLs and the viewer reads some with
  // cache: 'force-cache'. no-store keeps a browser from reusing old bytes after a
  // republish (which the integrity check would otherwise turn into the error page).
  { source: `${JERMILOVA_PUBLIC_MOUNT}/bn-rrm/:path*`, headers: [{ key: 'Cache-Control', value: 'no-store' }] },
];
