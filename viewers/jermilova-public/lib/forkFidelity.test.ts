// Fork fidelity: the viewer's src/ dependencies and forks are pinned to the
// authenticated original at the base commit. Any drift fails closed.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { closurePath, compareClosure, FORK_ORIGINALS, repoRoot, resolveClosure } from '../scripts/src-closure.mjs';
import { forkDiff, patchDir, patchName } from '../scripts/fork-patches.mjs';

interface ClosureEntry { path: string; role: string; bytes: number; sha256: string }
interface Closure { base_commit: string; entries: ClosureEntry[]; external_specifiers: string[] }

const pinned = JSON.parse(fs.readFileSync(closurePath, 'utf8')) as Closure;
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

describe('Jermilova viewer fork fidelity', () => {
  it('pins the transitive src closure exactly: no missing, extra or changed entries', () => {
    const live = resolveClosure() as { entries: ClosureEntry[] };
    expect(compareClosure(pinned, live)).toEqual({ missing: [], extra: [], changed: [], externalAdded: [], externalRemoved: [], ok: true });
    const forkOriginals = Object.values(FORK_ORIGINALS as Record<string, string>).sort();
    expect(pinned.entries.filter((e) => e.role === 'fork-original').map((e) => e.path).sort()).toEqual(forkOriginals);
    // The product graph never reaches an original that the viewer forks.
    expect(pinned.entries.filter((e) => e.role === 'module').some((e) => forkOriginals.includes(e.path))).toBe(false);
  });

  it('detects a changed closure entry (two-sided)', () => {
    const live = resolveClosure() as { entries: ClosureEntry[]; external: string[] };
    const tampered = { ...pinned, entries: pinned.entries.map((e, i) => (i === 0 ? { ...e, sha256: '0'.repeat(64) } : e)) };
    expect(compareClosure(tampered, live).changed).toEqual([pinned.entries[0].path]);
    const shorter = { ...pinned, entries: pinned.entries.slice(1) };
    expect(compareClosure(shorter, live).extra).toEqual([pinned.entries[0].path]);
    const newDependency = { ...live, external: [...live.external, 'left-pad'] };
    expect(compareClosure(pinned, newDependency)).toMatchObject({ externalAdded: ['left-pad'], ok: false });
  });

  it('pins every closure entry to the exact Git blob at the base commit', () => {
    expect(pinned.base_commit).toMatch(/^[0-9a-f]{40}$/);
    for (const entry of pinned.entries) {
      const blob = execFileSync('git', ['-C', repoRoot, 'show', `${pinned.base_commit}:${entry.path}`], { maxBuffer: 64 * 1024 * 1024 });
      expect({ path: entry.path, bytes: blob.length, sha256: sha256(blob) }).toEqual({ path: entry.path, bytes: entry.bytes, sha256: entry.sha256 });
    }
  });

  it('makes each fork equal to its original plus exactly the reviewed deletion patch', () => {
    const forks = Object.keys(FORK_ORIGINALS as Record<string, string>);
    expect(forks).toHaveLength(7);
    for (const fork of forks) {
      const expected = fs.readFileSync(path.join(patchDir as string, patchName(fork) as string));
      expect((forkDiff(fork) as Buffer).equals(expected), fork).toBe(true);
    }
  });
});
