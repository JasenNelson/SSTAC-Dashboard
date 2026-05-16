import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import {
  discoverProjectAgents,
  discoverGlobalAgents,
  discoverAllProjectAgents,
  __AGENT_MAX_COUNT_FOR_TEST,
  __AGENT_FILE_MAX_BYTES_FOR_TEST,
  __AGENT_SLUG_PATTERN_FOR_TEST,
} from '../agent-discovery';

// Each filesystem test materializes a fresh temp project + fake "home" under
//   <os.tmpdir>/agent-discovery-XXXX/...
// and tears it down in afterEach. The "global" agent location (~/.claude/agents)
// is redirected by spying on os.homedir() so we NEVER touch the real ~/.claude.

let tmpRoot: string;
let projectDir: string;
let fakeHome: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-discovery-'));
  projectDir = path.join(tmpRoot, 'fake-project');
  fakeHome = path.join(tmpRoot, 'fake-home');
  await fs.mkdir(projectDir, { recursive: true });
  await fs.mkdir(fakeHome, { recursive: true });
  // Spy on os.homedir so discoverGlobalAgents reads our fake home, NOT the
  // real ~/.claude. vitest's spyOn typing prefers the loose form here
  // (os.homedir is a plain function, not a class constructor).
  vi.spyOn(os, 'homedir').mockImplementation(() => fakeHome);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function writeProjectAgent(slug: string, body: string): Promise<void> {
  const dir = path.join(projectDir, '.claude', 'agents');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${slug}.md`), body, 'utf-8');
}

async function writeGlobalAgent(slug: string, body: string): Promise<void> {
  const dir = path.join(fakeHome, '.claude', 'agents');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${slug}.md`), body, 'utf-8');
}

describe('discoverProjectAgents (happy paths)', () => {
  it('returns project agents + global agents with frontmatter name + description', async () => {
    await writeProjectAgent(
      'proj-a',
      `---\nname: Project Agent A\ndescription: Project A description.\n---\n# body`,
    );
    await writeProjectAgent(
      'proj-b',
      `---\nname: Project Agent B\ndescription: Project B description.\n---\n# body`,
    );
    await writeGlobalAgent(
      'glob-x',
      `---\nname: Global Agent X\ndescription: Global X description.\n---\n# body`,
    );

    const globals = await discoverGlobalAgents();
    const result = await discoverProjectAgents(projectDir, 'fake-project', globals);

    expect(result.error).toBeUndefined();
    expect(result.projectAgents.map((a) => a.slug).sort()).toEqual(['proj-a', 'proj-b']);
    expect(result.globalAgents.map((a) => a.slug).sort()).toEqual(['glob-x']);

    const projA = result.projectAgents.find((a) => a.slug === 'proj-a');
    expect(projA?.name).toBe('Project Agent A');
    expect(projA?.description).toBe('Project A description.');
    expect(projA?.scope).toBe('project');

    const globX = result.globalAgents.find((a) => a.slug === 'glob-x');
    expect(globX?.scope).toBe('global');
  });

  it('returns empty results (no error) when neither .claude/agents exists', async () => {
    const globals = await discoverGlobalAgents();
    const result = await discoverProjectAgents(projectDir, 'fake-project', globals);
    expect(result.projectAgents).toEqual([]);
    expect(result.globalAgents).toEqual([]);
    expect(result.error).toBeUndefined();
    expect(result.truncated).toBeUndefined();
  });

  it('returns global-only when project has no .claude/agents but home does', async () => {
    await writeGlobalAgent('only-global', '---\nname: Only Global\n---\n');
    const globals = await discoverGlobalAgents();
    const result = await discoverProjectAgents(projectDir, 'fake-project', globals);
    expect(result.projectAgents).toEqual([]);
    expect(result.globalAgents).toHaveLength(1);
    expect(result.globalAgents[0].slug).toBe('only-global');
    expect(result.globalAgents[0].scope).toBe('global');
  });

  it('returns project-only when project has agents but home does not', async () => {
    await writeProjectAgent('only-proj', '---\nname: Only Project\n---\n');
    const globals = await discoverGlobalAgents();
    const result = await discoverProjectAgents(projectDir, 'fake-project', globals);
    expect(result.projectAgents).toHaveLength(1);
    expect(result.projectAgents[0].slug).toBe('only-proj');
    expect(result.projectAgents[0].scope).toBe('project');
    expect(result.globalAgents).toEqual([]);
  });

  it('falls back to slug when frontmatter name is missing', async () => {
    await writeProjectAgent('no-name', `---\ndescription: Only desc.\n---\nbody`);
    const result = await discoverProjectAgents(projectDir, 'fake-project', []);
    expect(result.projectAgents).toHaveLength(1);
    expect(result.projectAgents[0].name).toBe('no-name');
    expect(result.projectAgents[0].description).toBe('Only desc.');
  });

  it('omits description when frontmatter description is missing', async () => {
    await writeProjectAgent('no-desc', `---\nname: Only Name\n---\nbody`);
    const result = await discoverProjectAgents(projectDir, 'fake-project', []);
    expect(result.projectAgents).toHaveLength(1);
    expect(result.projectAgents[0].name).toBe('Only Name');
    expect(result.projectAgents[0].description).toBeUndefined();
  });
});

describe('discoverProjectAgents (defensive paths)', () => {
  it('skips and warns when an agent .md exceeds the byte cap', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await writeProjectAgent('huge', 'x'.repeat(__AGENT_FILE_MAX_BYTES_FOR_TEST + 1));
    await writeProjectAgent('small', '---\nname: Small\n---\nok\n');
    const result = await discoverProjectAgents(projectDir, 'fake-project', []);
    expect(result.projectAgents.map((a) => a.slug)).toEqual(['small']);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('caps the agent count and sets truncated=true', async () => {
    const total = __AGENT_MAX_COUNT_FOR_TEST + 10;
    for (let i = 0; i < total; i++) {
      const slug = `agent-${String(i).padStart(3, '0')}`;
      await writeProjectAgent(slug, `---\nname: Agent ${i}\n---\n`);
    }
    const result = await discoverProjectAgents(projectDir, 'fake-project', []);
    expect(result.truncated).toBe(true);
    expect(result.projectAgents.length).toBe(__AGENT_MAX_COUNT_FOR_TEST);
  });

  it('handles malformed frontmatter (gracefully fall back to slug)', async () => {
    await writeProjectAgent(
      'broken',
      `---\nname: ok\n  bad: : indent : ::\n---\nbody\n`,
    );
    const result = await discoverProjectAgents(projectDir, 'fake-project', []);
    expect(result.projectAgents).toHaveLength(1);
    expect(result.projectAgents[0].slug).toBe('broken');
    expect(['ok', 'broken']).toContain(result.projectAgents[0].name);
  });

  it('rejects non-absolute / leading-dash project paths', async () => {
    const r1 = await discoverProjectAgents('relative/path', 'fake', []);
    expect(r1.error).toBe('invalid_or_missing_path');
    expect(r1.projectAgents).toEqual([]);

    const r2 = await discoverProjectAgents('-rf', 'fake', []);
    expect(r2.error).toBe('invalid_or_missing_path');

    const r3 = await discoverProjectAgents('', 'fake', []);
    expect(r3.error).toBe('invalid_or_missing_path');
  });

  it('skips dotfile children, non-.md children, and rejects invalid slugs', async () => {
    const dir = path.join(projectDir, '.claude', 'agents');
    await fs.mkdir(dir, { recursive: true });
    // .hidden.md -- dotfile, must be skipped
    await fs.writeFile(path.join(dir, '.hidden.md'), '---\nname: Hidden\n---\n');
    // README.txt -- not .md
    await fs.writeFile(path.join(dir, 'README.txt'), 'just a readme\n');
    // README (no extension)
    await fs.writeFile(path.join(dir, 'README'), 'no ext\n');
    // has space.md -- slug regex rejects whitespace
    await fs.writeFile(path.join(dir, 'has space.md'), '---\nname: Bad\n---\n');
    // foo.bar.md -- slug regex rejects dots in the body
    await fs.writeFile(path.join(dir, 'foo.bar.md'), '---\nname: Bad\n---\n');
    // -leading-dash.md -- slug regex rejects leading dash
    await fs.writeFile(path.join(dir, '-leading-dash.md'), '---\nname: Bad\n---\n');
    // A subdirectory inside agents/ should be ignored (we don't recurse).
    await fs.mkdir(path.join(dir, 'subdir'), { recursive: true });
    await fs.writeFile(path.join(dir, 'subdir', 'nested.md'), '---\nname: Nested\n---\n');
    // Valid agent.
    await writeProjectAgent('good', '---\nname: Good\n---\n');

    const result = await discoverProjectAgents(projectDir, 'fake-project', []);
    expect(result.projectAgents.map((a) => a.slug)).toEqual(['good']);
  });

  it('project + global double-naming surfaces distinct entries with correct scope', async () => {
    await writeProjectAgent('foo', '---\nname: Project Foo\n---\n');
    await writeGlobalAgent('foo', '---\nname: Global Foo\n---\n');
    const globals = await discoverGlobalAgents();
    const result = await discoverProjectAgents(projectDir, 'fake-project', globals);

    expect(result.projectAgents).toHaveLength(1);
    expect(result.projectAgents[0]).toMatchObject({
      slug: 'foo',
      name: 'Project Foo',
      scope: 'project',
    });
    expect(result.globalAgents).toHaveLength(1);
    expect(result.globalAgents[0]).toMatchObject({
      slug: 'foo',
      name: 'Global Foo',
      scope: 'global',
    });
  });

  it('caps project + global independently (each scope gets its own 50-cap budget)', async () => {
    const total = __AGENT_MAX_COUNT_FOR_TEST + 5;
    for (let i = 0; i < total; i++) {
      const slug = `p-${String(i).padStart(3, '0')}`;
      await writeProjectAgent(slug, `---\nname: P ${i}\n---\n`);
    }
    for (let i = 0; i < total; i++) {
      const slug = `g-${String(i).padStart(3, '0')}`;
      await writeGlobalAgent(slug, `---\nname: G ${i}\n---\n`);
    }
    const globals = await discoverGlobalAgents();
    const result = await discoverProjectAgents(projectDir, 'fake-project', globals);
    expect(result.projectAgents.length).toBe(__AGENT_MAX_COUNT_FOR_TEST);
    expect(result.globalAgents.length).toBe(__AGENT_MAX_COUNT_FOR_TEST);
    expect(result.truncated).toBe(true);
  });
});

describe('discoverAllProjectAgents (fan-out)', () => {
  it('isolates per-project failures + shares global list across projects', async () => {
    const projectA = path.join(tmpRoot, 'project-a');
    const projectB = path.join(tmpRoot, 'project-b');
    await fs.mkdir(path.join(projectA, '.claude', 'agents'), { recursive: true });
    await fs.writeFile(
      path.join(projectA, '.claude', 'agents', 'alpha.md'),
      '---\nname: Alpha\n---\n',
    );
    await fs.mkdir(path.join(projectB, '.claude', 'agents'), { recursive: true });
    await fs.writeFile(
      path.join(projectB, '.claude', 'agents', 'beta.md'),
      '---\nname: Beta\n---\n',
    );
    await writeGlobalAgent('shared', '---\nname: Shared Global\n---\n');

    const all = await discoverAllProjectAgents([
      { name: 'a', path: projectA },
      { name: 'b', path: projectB },
      { name: 'bad', path: 'relative/no-good' },
    ]);

    expect(all.a.projectAgents).toHaveLength(1);
    expect(all.a.projectAgents[0].slug).toBe('alpha');
    expect(all.b.projectAgents).toHaveLength(1);
    expect(all.b.projectAgents[0].slug).toBe('beta');
    expect(all.bad.error).toBe('invalid_or_missing_path');
    expect(all.bad.projectAgents).toEqual([]);
    // Global list is shared across every project entry (including the bad one).
    for (const key of ['a', 'b', 'bad']) {
      expect(all[key].globalAgents).toHaveLength(1);
      expect(all[key].globalAgents[0].slug).toBe('shared');
      expect(all[key].globalAgents[0].scope).toBe('global');
    }
  });
});

describe('AGENT_SLUG_PATTERN (hostile slug gauntlet)', () => {
  // The OS filesystem can't really hold names like ".." or "foo/bar.md"; the
  // regex is still our defense-in-depth boundary. Verify each rejected form.
  it.each([
    '..',
    '.foo',
    'foo.bar',
    'foo/bar',
    'foo\\bar',
    '-leading-dash',
    'foo bar',
    'foo;bar',
    'foo`bar',
    '$(echo pwned)',
    'foo&&bar',
    'foo|bar',
    'foo>out',
    'foo\nbar',
    'foo\tbar',
    'café', // non-ASCII
    'a'.repeat(42), // 42 chars > 41 cap
  ])('rejects hostile slug %j', (slug: string) => {
    expect(__AGENT_SLUG_PATTERN_FOR_TEST.test(slug)).toBe(false);
  });

  it.each(['foo', 'foo-bar', 'foo123', 'Foo', 'a1', 'a'.repeat(41)])(
    'accepts valid slug %j',
    (slug: string) => {
      expect(__AGENT_SLUG_PATTERN_FOR_TEST.test(slug)).toBe(true);
    },
  );
});
