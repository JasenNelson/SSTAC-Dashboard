import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';
import { JERMILOVA_PUBLIC_BASE_PATH, JERMILOVA_PUBLIC_BUILD_ID } from './lib/publicBasePath';

// The aliases below resolve from the build's working directory, so the build must
// run from this viewer package; fail closed otherwise instead of aliasing elsewhere.
const viewerRoot = process.cwd();
if (
  path.basename(viewerRoot) !== 'jermilova-public' ||
  !fs.existsSync(path.join(viewerRoot, 'forked', 'networkStore.ts')) ||
  !fs.existsSync(path.join(viewerRoot, '..', '..', 'src', 'stores', 'bn-rrm'))
) {
  throw new Error(`Jermilova viewer must be built from viewers/jermilova-public (cwd: ${viewerRoot}).`);
}

const nextConfig: NextConfig = {
  output: 'export',
  // Served at /Jermilova/ (preview server and the root deployment's public/Jermilova/).
  basePath: JERMILOVA_PUBLIC_BASE_PATH,
  generateBuildId: async () => JERMILOVA_PUBLIC_BUILD_ID,
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: { externalDir: true },
  webpack(config) {
    // Exact-module aliases first: every importer of these original stores gets the
    // viewer's deletion-only fork (no browser storage; no non-Jermilova fallback model).
    config.resolve.alias = {
      '@/stores/bn-rrm/siteDataStore$': path.resolve(viewerRoot, 'forked/siteDataStore.ts'),
      '@/stores/bn-rrm/networkStore$': path.resolve(viewerRoot, 'forked/networkStore.ts'),
      ...config.resolve.alias,
      '@': path.resolve(viewerRoot, '../../src'),
    };
    return config;
  },
};

export default nextConfig;
