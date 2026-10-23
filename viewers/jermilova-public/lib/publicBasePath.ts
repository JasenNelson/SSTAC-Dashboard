// The URL prefix the viewer is served under: by the local preview server and by the root
// SSTAC deployment, which serves the committed export mirror from public/Jermilova/.
// Next's basePath prefixes the page's own assets (/Jermilova/_next/...). The original
// stores fetch '/bn-rrm/...'; verifiedFetch maps those to '/Jermilova/bn-rrm/...' after its
// integrity checks, so no pack read ever reaches the authenticated app's /bn-rrm/ paths.
export const JERMILOVA_PUBLIC_BASE_PATH = '/Jermilova';

// Fixed build id: the export (index.html, index.txt, _next/static/<id>/) carries this id,
// so two builds of the same inputs produce the same bytes.
export const JERMILOVA_PUBLIC_BUILD_ID = 'jermilova-public';
