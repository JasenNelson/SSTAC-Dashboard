// Fork patches: the reviewed `git diff --no-index` of each fork against its
// authenticated original. The fidelity test regenerates every diff and requires it
// to equal the committed patch byte-for-byte.
//
//   node viewers/jermilova-public/scripts/fork-patches.mjs --write
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORK_ORIGINALS, repoRoot, viewerRoot } from './src-closure.mjs';

export const patchDir = path.join(viewerRoot, 'forked', 'FORK_PATCHES');

export function patchName(fork) {
  return path.basename(fork).replace(/\.(tsx?|mjs)$/, '') + '.patch';
}

export function forkDiff(fork) {
  const original = FORK_ORIGINALS[fork];
  const forkPath = 'viewers/jermilova-public/' + fork;
  const result = spawnSync(
    'git',
    ['-C', repoRoot, '-c', 'core.autocrlf=false', '-c', 'diff.noprefix=false', 'diff', '--no-index', '--no-color', '--no-ext-diff', '--', original, forkPath],
    { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 },
  );
  // git diff --no-index exits 1 when the files differ; anything else is an error.
  if (result.status !== 1) {
    throw new Error(`git diff for ${fork} exited ${result.status}: ${result.stderr?.toString()}`);
  }
  return result.stdout;
}

function main() {
  if (process.argv[2] === '--check') {
    const drifted = Object.keys(FORK_ORIGINALS).filter(
      (fork) => !forkDiff(fork).equals(fs.readFileSync(path.join(patchDir, patchName(fork)))),
    );
    console.log(JSON.stringify({ forks: Object.keys(FORK_ORIGINALS).length, drifted }));
    if (drifted.length) process.exitCode = 1;
    return;
  }
  if (process.argv[2] !== '--write') throw new Error('Usage: fork-patches.mjs --write | --check');
  fs.mkdirSync(patchDir, { recursive: true });
  for (const fork of Object.keys(FORK_ORIGINALS)) {
    const out = path.join(patchDir, patchName(fork));
    fs.writeFileSync(out, forkDiff(fork));
    console.log('wrote', path.relative(repoRoot, out).split(path.sep).join('/'), fs.statSync(out).size, 'bytes');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
