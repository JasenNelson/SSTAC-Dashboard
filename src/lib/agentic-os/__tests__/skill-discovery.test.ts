import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import {
  discoverProjectSkills,
  discoverAllProjectSkills,
  __SKILL_MAX_COUNT_FOR_TEST,
  __SKILL_FILE_MAX_BYTES_FOR_TEST,
  __SKILL_SLUG_RE_FOR_TEST,
} from '../skill-discovery';

// Each filesystem test materializes a fresh temp project under
//   <os.tmpdir>/skill-discovery-XXXX/<project>/.claude/skills/<slug>/SKILL.md
// and tears it down in afterEach. The tests NEVER touch the real repo .claude.

let tmpRoot: string;
let projectDir: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-discovery-'));
  projectDir = path.join(tmpRoot, 'fake-project');
  await fs.mkdir(projectDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function writeSkill(
  slug: string,
  body: string,
): Promise<void> {
  const dir = path.join(projectDir, '.claude', 'skills', slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'SKILL.md'), body, 'utf-8');
}

describe('discoverProjectSkills', () => {
  it('returns skills with frontmatter name + description (happy path)', async () => {
    await writeSkill(
      'foo',
      `---\nname: Foo Skill\ndescription: Does foo things.\n---\n# body`,
    );
    await writeSkill(
      'bar',
      `---\nname: Bar\ndescription: Does bar things.\n---\n# body`,
    );
    const result = await discoverProjectSkills(projectDir, 'fake-project');
    expect(result.error).toBeUndefined();
    expect(result.skills).toHaveLength(2);
    const slugs = result.skills.map((s) => s.slug).sort();
    expect(slugs).toEqual(['bar', 'foo']);
    const foo = result.skills.find((s) => s.slug === 'foo');
    expect(foo?.name).toBe('Foo Skill');
    expect(foo?.description).toBe('Does foo things.');
  });

  it('returns empty skills (no error) when .claude/skills does not exist', async () => {
    const result = await discoverProjectSkills(projectDir, 'fake-project');
    expect(result.skills).toEqual([]);
    expect(result.error).toBeUndefined();
    expect(result.truncated).toBeUndefined();
  });

  it('skips a candidate folder when SKILL.md is missing', async () => {
    // Create empty skill dir (no SKILL.md inside).
    await fs.mkdir(path.join(projectDir, '.claude', 'skills', 'empty-dir'), { recursive: true });
    // And one valid skill alongside.
    await writeSkill('foo', '---\nname: Foo\n---\n');
    const result = await discoverProjectSkills(projectDir, 'fake-project');
    expect(result.skills.map((s) => s.slug)).toEqual(['foo']);
  });

  it('skips and warns when SKILL.md exceeds the byte cap', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Write a SKILL.md just over the cap.
    const body = 'x'.repeat(__SKILL_FILE_MAX_BYTES_FOR_TEST + 1);
    await writeSkill('huge', body);
    await writeSkill('small', '---\nname: Small\n---\nok\n');
    const result = await discoverProjectSkills(projectDir, 'fake-project');
    expect(result.skills.map((s) => s.slug)).toEqual(['small']);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('caps the skill count at SKILL_MAX_COUNT and sets truncated', async () => {
    const total = __SKILL_MAX_COUNT_FOR_TEST + 5;
    for (let i = 0; i < total; i++) {
      // 3-digit zero-padded to keep folder names valid against the slug regex.
      const slug = `skill-${String(i).padStart(3, '0')}`;
      await writeSkill(slug, `---\nname: Skill ${i}\n---\n`);
    }
    const result = await discoverProjectSkills(projectDir, 'fake-project');
    expect(result.truncated).toBe(true);
    expect(result.skills.length).toBe(__SKILL_MAX_COUNT_FOR_TEST);
  });

  it('handles malformed frontmatter (gray-matter throws -> skip data, keep entry)', async () => {
    // YAML with a bad indent / colon. gray-matter throws on parse; our code
    // catches and treats data as empty, so the slug becomes the name.
    await writeSkill(
      'broken',
      `---\nname: ok\n  bad: : indent : ::\n---\nbody\n`,
    );
    const result = await discoverProjectSkills(projectDir, 'fake-project');
    // Should still produce an entry (name falls back to slug if frontmatter unusable).
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].slug).toBe('broken');
    // Either the YAML parsed (name preserved) or fell back to slug -- both acceptable.
    expect(['ok', 'broken']).toContain(result.skills[0].name);
  });

  it('rejects non-absolute / leading-dash project paths', async () => {
    const r1 = await discoverProjectSkills('relative/path', 'fake');
    expect(r1.error).toBe('invalid_or_missing_path');
    expect(r1.skills).toEqual([]);

    const r2 = await discoverProjectSkills('-rf', 'fake');
    expect(r2.error).toBe('invalid_or_missing_path');

    const r3 = await discoverProjectSkills('', 'fake');
    expect(r3.error).toBe('invalid_or_missing_path');
  });

  it('falls back to slug when frontmatter name is missing', async () => {
    await writeSkill('no-name', `---\ndescription: Only desc.\n---\nbody`);
    const result = await discoverProjectSkills(projectDir, 'fake-project');
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].name).toBe('no-name');
    expect(result.skills[0].description).toBe('Only desc.');
  });

  it('omits description field when frontmatter description is missing', async () => {
    await writeSkill('no-desc', `---\nname: Only Name\n---\nbody`);
    const result = await discoverProjectSkills(projectDir, 'fake-project');
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].name).toBe('Only Name');
    expect(result.skills[0].description).toBeUndefined();
  });

  it('skips dotfile/dotfolder children and rejects slugs with invalid characters', async () => {
    // .hidden -- dotfolder, must be skipped
    await fs.mkdir(path.join(projectDir, '.claude', 'skills', '.hidden'), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, '.claude', 'skills', '.hidden', 'SKILL.md'),
      '---\nname: Hidden\n---\n',
    );
    // Invalid slug characters
    await fs.mkdir(path.join(projectDir, '.claude', 'skills', 'has space'), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, '.claude', 'skills', 'has space', 'SKILL.md'),
      '---\nname: Bad\n---\n',
    );
    // A flat file (not a directory) at skills/ root must be ignored too.
    await fs.writeFile(
      path.join(projectDir, '.claude', 'skills', 'README.md'),
      '# top-level readme, not a skill\n',
    );
    // A valid skill so the test confirms filtering, not just emptiness.
    await writeSkill('good', '---\nname: Good\n---\n');
    const result = await discoverProjectSkills(projectDir, 'fake-project');
    expect(result.skills.map((s) => s.slug)).toEqual(['good']);
  });

  it('isolates per-project failures in discoverAllProjectSkills (no project poisons others)', async () => {
    // Set up two valid projects + one with an invalid path
    const projectA = path.join(tmpRoot, 'project-a');
    const projectB = path.join(tmpRoot, 'project-b');
    await fs.mkdir(path.join(projectA, '.claude', 'skills', 'alpha'), { recursive: true });
    await fs.writeFile(
      path.join(projectA, '.claude', 'skills', 'alpha', 'SKILL.md'),
      '---\nname: Alpha\n---\n',
    );
    await fs.mkdir(path.join(projectB, '.claude', 'skills', 'beta'), { recursive: true });
    await fs.writeFile(
      path.join(projectB, '.claude', 'skills', 'beta', 'SKILL.md'),
      '---\nname: Beta\n---\n',
    );

    const all = await discoverAllProjectSkills([
      { name: 'a', path: projectA },
      { name: 'b', path: projectB },
      { name: 'bad', path: 'relative/no-good' },
    ]);

    expect(all.a.skills).toHaveLength(1);
    expect(all.a.skills[0].slug).toBe('alpha');
    expect(all.b.skills).toHaveLength(1);
    expect(all.b.skills[0].slug).toBe('beta');
    expect(all.bad.error).toBe('invalid_or_missing_path');
    expect(all.bad.skills).toEqual([]);
  });

  it('does not throw on a hostile slug-shaped directory (slug regex filters .. and path tokens)', async () => {
    // The OS won't let us name a folder "..", but we CAN create one with a dot.
    // The slug regex rejects '.foo', 'foo.bar', and 'foo/bar' (the latter
    // can't exist as a single dirent anyway). Verify defense in depth.
    expect(__SKILL_SLUG_RE_FOR_TEST.test('..')).toBe(false);
    expect(__SKILL_SLUG_RE_FOR_TEST.test('.foo')).toBe(false);
    expect(__SKILL_SLUG_RE_FOR_TEST.test('foo.bar')).toBe(false);
    expect(__SKILL_SLUG_RE_FOR_TEST.test('foo/bar')).toBe(false);
    expect(__SKILL_SLUG_RE_FOR_TEST.test('foo\\bar')).toBe(false);
    expect(__SKILL_SLUG_RE_FOR_TEST.test('-leading-dash')).toBe(false);
    expect(__SKILL_SLUG_RE_FOR_TEST.test('foo bar')).toBe(false);
    expect(__SKILL_SLUG_RE_FOR_TEST.test('$(echo pwned)')).toBe(false);
    // Valid forms:
    expect(__SKILL_SLUG_RE_FOR_TEST.test('foo')).toBe(true);
    expect(__SKILL_SLUG_RE_FOR_TEST.test('foo-bar')).toBe(true);
    expect(__SKILL_SLUG_RE_FOR_TEST.test('foo123')).toBe(true);
  });
});
