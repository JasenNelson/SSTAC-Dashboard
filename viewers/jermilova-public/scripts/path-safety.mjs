import { lstat, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';

function assertContained(target, root, allowEqual = false) {
  const relative = path.relative(root, target);
  const outside =
    path.isAbsolute(relative) ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`);
  if (outside || (!allowEqual && relative === '')) {
    throw new Error(`Path is outside its approved root: ${target}`);
  }
}

function isMissing(error) {
  return error && typeof error === 'object' && error.code === 'ENOENT';
}

export async function verifyExistingDirectory(rootPath, directoryPath) {
  const root = await realpath(rootPath);
  const target = path.resolve(directoryPath);
  assertContained(target, root, true);
  const relative = path.relative(root, target);
  if (!relative) return root;

  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    const info = await lstat(current);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error(`Refusing linked or non-directory path component: ${current}`);
    }
    const resolved = await realpath(current);
    assertContained(resolved, root, true);
    current = resolved;
  }
  return current;
}

export async function ensureSafeDirectory(rootPath, directoryPath) {
  const root = await realpath(rootPath);
  const target = path.resolve(directoryPath);
  assertContained(target, root, true);
  const relative = path.relative(root, target);
  if (!relative) return root;

  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    try {
      await lstat(current);
    } catch (error) {
      if (!isMissing(error)) throw error;
      try {
        await mkdir(current);
      } catch (mkdirError) {
        if (!mkdirError || typeof mkdirError !== 'object' || mkdirError.code !== 'EEXIST') {
          throw mkdirError;
        }
      }
    }

    const info = await lstat(current);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error(`Refusing linked or non-directory path component: ${current}`);
    }
    const resolved = await realpath(current);
    assertContained(resolved, root, true);
    current = resolved;
  }
  return current;
}

export async function inspectSafeFileTarget(rootPath, filePath) {
  const root = await realpath(rootPath);
  const target = path.resolve(filePath);
  assertContained(target, root);
  const parent = await verifyExistingDirectory(root, path.dirname(target));
  const resolvedTarget = path.join(parent, path.basename(target));
  assertContained(resolvedTarget, root);

  let info;
  try {
    info = await lstat(resolvedTarget);
  } catch (error) {
    if (isMissing(error)) return { path: resolvedTarget, exists: false };
    throw error;
  }

  if (info.isSymbolicLink() || !info.isFile() || info.nlink > 1) {
    throw new Error(`Refusing linked or non-regular file target: ${resolvedTarget}`);
  }
  const resolved = await realpath(resolvedTarget);
  assertContained(resolved, root);
  return { path: resolvedTarget, exists: true };
}
