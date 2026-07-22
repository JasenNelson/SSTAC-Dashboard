// Guards for classify-drift-paths.mjs (prod-health docs-only-drift classification). Plain ASCII.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isDeployIgnored,
  classifyDrift,
  VERCEL_IGNORE_RULES,
} from '../classify-drift-paths.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('isDeployIgnored', () => {
  it('ignores *.md at any depth', () => {
    expect(isDeployIgnored('README.md')).toBe(true);
    expect(isDeployIgnored('docs/x.md')).toBe(true);
    expect(isDeployIgnored('src/components/notes.md')).toBe(true);
  });

  it('ignores the docs/, supabase/, scripts/, e2e/ subtrees', () => {
    expect(isDeployIgnored('docs/design/x.txt')).toBe(true);
    expect(isDeployIgnored('supabase/migrations/001.sql')).toBe(true);
    expect(isDeployIgnored('scripts/verify/foo.mjs')).toBe(true);
    expect(isDeployIgnored('e2e/login.spec.ts')).toBe(true);
  });

  it('does NOT ignore app/runtime paths', () => {
    expect(isDeployIgnored('src/app/page.tsx')).toBe(false);
    expect(isDeployIgnored('src/lib/matrix-options/derivations.ts')).toBe(false);
    expect(isDeployIgnored('next.config.ts')).toBe(false);
    expect(isDeployIgnored('package.json')).toBe(false);
    expect(isDeployIgnored('public/logo.png')).toBe(false);
    expect(isDeployIgnored('.github/workflows/prod-health.yml')).toBe(false);
  });

  it('does not treat a similarly-named non-subtree path as ignored', () => {
    // "documentation.ts" starts with "doc" but is not under "docs/"; a file literally named
    // "scripts" (no trailing slash prefix) is not the scripts/ subtree.
    expect(isDeployIgnored('src/documentation.ts')).toBe(false);
    expect(isDeployIgnored('src/scripts-helper.ts')).toBe(false);
    expect(isDeployIgnored('')).toBe(false);
    expect(isDeployIgnored(null)).toBe(false);
  });
});

describe('classifyDrift', () => {
  it('docs-only drift: every changed path is Vercel-ignored', () => {
    const r = classifyDrift(['docs/a.md', 'README.md', 'scripts/x.mjs', 'supabase/m.sql', 'e2e/t.ts']);
    expect(r.docsOnly).toBe(true);
    expect(r.deployWorthy).toEqual([]);
  });

  it('app-affecting drift: at least one deploy-worthy path', () => {
    const r = classifyDrift(['src/app/page.tsx']);
    expect(r.docsOnly).toBe(false);
    expect(r.deployWorthy).toEqual(['src/app/page.tsx']);
  });

  it('mixed drift is app-affecting (one app path among docs)', () => {
    const r = classifyDrift(['docs/a.md', 'scripts/x.mjs', 'src/lib/foo.ts']);
    expect(r.docsOnly).toBe(false);
    expect(r.deployWorthy).toEqual(['src/lib/foo.ts']);
  });

  it('an empty change list is NOT docs-only (fail safe)', () => {
    const r = classifyDrift([]);
    expect(r.docsOnly).toBe(false);
    expect(r.deployWorthy).toEqual([]);
  });

  it('does NOT normalize whitespace-padded paths (a padded path is deploy-worthy, never false-green)', () => {
    // A git-tracked path with leading/trailing whitespace is a distinct, deploy-worthy path under
    // git's pathspec; it must not be trimmed onto an ignored path (that would silently green
    // app-affecting drift -- the exact failure this feature must never produce).
    // Leading space -> not under scripts/; trailing space -> does not end in .md. Both are
    // deploy-worthy under git's pathspec, so drift containing them is app-affecting.
    expect(classifyDrift([' scripts/foo.ts']).docsOnly).toBe(false);
    expect(classifyDrift(['src/foo.md ']).docsOnly).toBe(false);
    expect(isDeployIgnored(' scripts/foo.ts')).toBe(false);
    expect(isDeployIgnored('src/foo.md ')).toBe(false);
    // A leading space before docs/ does NOT save a .md file: it still ends in .md, so git's
    // `:!*.md` ignores it -- correctly docs-only. (Only the non-.md padded cases are deploy-worthy.)
    expect(isDeployIgnored(' docs/a.md')).toBe(true);
  });

  it('drops only the empty NUL-split sentinel, not real padded paths', () => {
    // The empty string (trailing NUL sentinel) is dropped; the two real paths are both ignored.
    const r = classifyDrift(['docs/a.md', '', 'scripts/x.mjs']);
    expect(r.docsOnly).toBe(true);
    expect(r.deployWorthy).toEqual([]);
  });
});

describe('drift-detection: ignore rules stay in sync with vercel.json', () => {
  it('every rule token appears in the vercel.json ignoreCommand pathspec, and vice versa', () => {
    const vercel = JSON.parse(readFileSync(path.join(REPO_ROOT, 'vercel.json'), 'utf8'));
    const ignoreCommand = String(vercel.ignoreCommand || '');
    expect(ignoreCommand).toContain('git diff --quiet');

    // Extract the pathspec tokens after the `--` separator (each looks like ':!<glob>').
    const pathspecTokens = (ignoreCommand.match(/':![^']+'/g) || []).map((t) => t.replace(/'/g, ''));
    const ruleTokens = VERCEL_IGNORE_RULES.map(([token]) => token);

    // Neither set may drift from the other -- if vercel.json's ignore policy changes, this
    // classifier's rules must be updated in the same PR (and vice versa).
    expect([...ruleTokens].sort()).toEqual([...pathspecTokens].sort());
  });
});
