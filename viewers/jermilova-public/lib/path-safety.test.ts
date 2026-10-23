import { link, mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureSafeDirectory, inspectSafeFileTarget } from '../scripts/path-safety.mjs';

const temporaryRoots: string[] = [];

async function makeRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jermilova-path-safety-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('viewer destination path safety', () => {
  it('rejects a linked destination parent before creating a child outside the root', async () => {
    const root = await makeRoot();
    const outsideRoot = await makeRoot();
    const publicDirectory = path.join(root, 'public');
    await mkdir(publicDirectory);
    const linkedParent = path.join(publicDirectory, 'bn-rrm');
    await symlink(outsideRoot, linkedParent, process.platform === 'win32' ? 'junction' : 'dir');

    await expect(ensureSafeDirectory(root, path.join(linkedParent, 'packs'))).rejects.toThrow(
      /linked or non-directory/,
    );
    await expect(stat(path.join(outsideRoot, 'packs'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects a hard-linked file destination without changing its outside target', async () => {
    const root = await makeRoot();
    const outsideRoot = await makeRoot();
    const outside = path.join(outsideRoot, 'outside.json');
    const destination = path.join(root, 'public', 'pack-registry.json');
    await writeFile(outside, 'preserve me', 'utf8');
    await mkdir(path.dirname(destination), { recursive: true });
    await link(outside, destination);

    await expect(inspectSafeFileTarget(root, destination)).rejects.toThrow(
      /linked or non-regular file/,
    );
    await expect(readFile(outside, 'utf8')).resolves.toBe('preserve me');
  });
});
