import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';

import { PrivateReleaseUnavailableError, type PrivateAssetSource } from './private-release-assets';

/*
 * A local directory standing in for the private bucket, IN A DEVELOPMENT OR TEST
 * PROCESS ONLY.
 *
 * private-release-assets.ts imports this module dynamically and only inside its
 * development-or-test branch, so a production build never loads it, and neither
 * does a process that states no mode. It exists so the browser tests can run on a developer machine before
 * storage is provisioned. It weakens nothing: the caller has already checked the
 * reader, asks only for allowlisted objects, and verifies length, hash and
 * content form of whatever is returned here exactly as it does for the bucket.
 *
 * A file has no stored media type, so the object's declared type is reported
 * back: the bucket's own Content-Type is not exercised through this source.
 */

function unavailable(): never {
  throw new PrivateReleaseUnavailableError('LOCAL_SOURCE');
}

export function localDirectorySource(directory: string): PrivateAssetSource {
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') unavailable();
  if (!path.isAbsolute(directory)) unavailable();
  const root = path.resolve(directory);
  /** The file an allowlisted object path names under the root, never anything outside it. */
  const fileOf = (objectPath: string): string => {
    const segments = objectPath.split('/');
    if (segments.some((segment) => segment === '' || segment === '.' || segment === '..' || segment.includes('\\') || segment.includes(':'))) unavailable();
    const file = path.resolve(root, ...segments);
    if (!file.startsWith(`${root}${path.sep}`)) unavailable();
    return file;
  };
  return {
    async admits(object, signal) {
      // A directory has no readers to tell apart: the object must simply be there, whole.
      let stat: Awaited<ReturnType<typeof fs.stat>>;
      try {
        stat = await fs.stat(fileOf(object.path));
      } catch (error) {
        if (error instanceof PrivateReleaseUnavailableError) throw error;
        unavailable();
      }
      if (!stat.isFile() || stat.size !== object.bytes || signal.aborted) unavailable();
    },
    async read(object, signal) {
      const file = fileOf(object.path);
      let handle: fs.FileHandle | undefined;
      try {
        handle = await fs.open(file, 'r');
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size !== object.bytes) unavailable();
        const bytes = Buffer.allocUnsafeSlow(object.bytes);
        const { bytesRead } = await handle.read(bytes, 0, object.bytes, 0);
        if (bytesRead !== object.bytes || signal.aborted) unavailable();
        return { bytes, mediaType: object.mediaType };
      } catch (error) {
        if (error instanceof PrivateReleaseUnavailableError) throw error;
        unavailable();
      } finally {
        await handle?.close();
      }
    },
  };
}
