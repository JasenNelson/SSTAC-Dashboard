import { describe, it, expect } from 'vitest';
import path from 'path';

import {
  validateLaunchRequest,
  __ALLOWED_PROJECTS_FOR_TEST,
  __ALLOWED_ACTIONS_FOR_TEST,
} from '../launch-validator';
import type { LaunchRequest } from '../launch-schemas';

const ALL_PROJECTS = Array.from(__ALLOWED_PROJECTS_FOR_TEST);
const ALL_ACTIONS = Array.from(__ALLOWED_ACTIONS_FOR_TEST);

// The three Pattern A skill actions; Pattern B (open_session) is asserted
// separately below since its exe + argv shape differs.
const PATTERN_A_ACTIONS = ['run_safe_exit', 'run_update_docs', 'run_doc_navigator'];

describe('validateLaunchRequest', () => {
  it('produces a ValidatedLaunch for every (project, Pattern-A action) combination in the allowlist', () => {
    for (const project of ALL_PROJECTS) {
      for (const action of PATTERN_A_ACTIONS) {
        const req: LaunchRequest = { project, action };
        const result = validateLaunchRequest(req);
        expect(result.ok, `expected ok for ${project}/${action}`).toBe(true);
        if (result.ok) {
          expect(result.value.exe).toBe('claude');
          expect(result.value.args.length).toBeGreaterThanOrEqual(2);
          expect(result.value.args[0]).toBe('-p');
          // cwd must use path.join semantics for the running platform.
          expect(result.value.cwd).toBe(path.join('C:\\Projects', project));
        }
      }
    }
  });

  it('returns the right slash command for each step-6a Pattern-A action', () => {
    const expected: Record<string, string> = {
      run_safe_exit: '/safe-exit',
      run_update_docs: '/update-docs',
      run_doc_navigator: '/doc-navigator',
    };
    for (const action of PATTERN_A_ACTIONS) {
      const result = validateLaunchRequest({ project: 'SSTAC-Dashboard', action });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.args[1]).toBe(expected[action]);
      }
    }
  });

  it('ships the three Pattern-A actions plus open_session (Pattern B) plus run_skill (Pattern C) plus run_agent (Pattern D) plus open_embedded (Pattern E); no per-skill / per-agent templates', () => {
    expect(new Set(ALL_ACTIONS)).toEqual(
      new Set([
        'run_safe_exit',
        'run_update_docs',
        'run_doc_navigator',
        'open_session',
        'run_skill',
        'run_agent',
        'open_embedded',
      ]),
    );
  });

  // ---------------------------------------------------------------------------
  // Step 7: Pattern B (Windows Terminal external pop-out).
  // ---------------------------------------------------------------------------

  describe('open_session (Pattern B, step 7)', () => {
    it('produces {exe: "wt.exe", args: ["-d", <cwd>, "claude", "--resume"]} for every allowed project', () => {
      for (const project of ALL_PROJECTS) {
        const result = validateLaunchRequest({ project, action: 'open_session' });
        expect(result.ok, `expected ok for ${project}/open_session`).toBe(true);
        if (result.ok) {
          const expectedCwd = path.join('C:\\Projects', project);
          expect(result.value.exe).toBe('wt.exe');
          // argv is EXACTLY four elements -- no shell, no string concat. The
          // -d flag is wt.exe's starting-directory switch; subsequent
          // positional tokens become the command wt.exe runs in the new tab.
          expect(result.value.args).toEqual([
            '-d',
            expectedCwd,
            'claude',
            '--resume',
          ]);
          expect(result.value.cwd).toBe(expectedCwd);
        }
      }
    });

    it('argv is an array of exactly four hardcoded-shaped tokens (no shell-string concatenation)', () => {
      const result = validateLaunchRequest({
        project: 'Regulatory-Review',
        action: 'open_session',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Array.isArray(result.value.args)).toBe(true);
        expect(result.value.args).toHaveLength(4);
        expect(result.value.args[0]).toBe('-d');
        // args[1] = cwd (project-derived, already past the allowlist).
        expect(result.value.args[2]).toBe('claude');
        expect(result.value.args[3]).toBe('--resume');
      }
    });

    it('rejects open_session against an unknown project (allowlist runs first)', () => {
      const result = validateLaunchRequest({
        project: 'NotAProject',
        action: 'open_session',
      });
      expect(result).toEqual({ ok: false, reason: 'unknown_project' });
    });

    it('rejects open_session against shell-metachar project names', () => {
      const hostile = [
        'SSTAC-Dashboard; rm -rf /',
        'SSTAC-Dashboard && start calc',
        '`whoami`',
        '$(echo pwned)',
      ];
      for (const project of hostile) {
        const result = validateLaunchRequest({ project, action: 'open_session' });
        expect(result).toEqual({ ok: false, reason: 'unknown_project' });
      }
    });

    it('declares spawnOverrides so wt.exe pops out (windowsHide:false, detached:true, stdio:"ignore")', () => {
      // Owner-bug fix 2026-05-16: with the route's default windowsHide:true +
      // piped stdio, wt.exe never showed its window. The validator must
      // therefore declare per-template overrides on open_session that the
      // route applies on top of its defaults. This locks the exact shape
      // the route reads so a future regression that silently drops the
      // overrides is caught at the unit layer.
      const result = validateLaunchRequest({
        project: 'SSTAC-Dashboard',
        action: 'open_session',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.spawnOverrides).toEqual({
          windowsHide: false,
          detached: true,
          stdio: 'ignore',
        });
      }
    });

    it('handles the worktree project with a forward slash in its name', () => {
      const result = validateLaunchRequest({
        project: 'Regulatory-Review-worktrees/engine-v2',
        action: 'open_session',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        // path.join normalizes the slash for the running platform; the SAME
        // joined cwd appears both as args[1] (wt -d) and as the spawn cwd.
        const expected = path.join(
          'C:\\Projects',
          'Regulatory-Review-worktrees/engine-v2',
        );
        expect(result.value.cwd).toBe(expected);
        expect(result.value.args[1]).toBe(expected);
      }
    });
  });

  it('ships exactly the 8 PROJECTS_MAP.md projects', () => {
    expect(new Set(ALL_PROJECTS)).toEqual(
      new Set([
        'Regulatory-Review',
        'Regulatory-Review-worktrees/engine-v2',
        'SSTAC-Dashboard',
        'Site3250-KB',
        'TechMemo-KB',
        'Sediment-DRA-Pipeline',
        'Knowledge-Base',
        'EnquiryMgt',
      ]),
    );
  });

  it('rejects an unknown project', () => {
    const result = validateLaunchRequest({
      project: 'NotAProject',
      action: 'run_safe_exit',
    });
    expect(result).toEqual({ ok: false, reason: 'unknown_project' });
  });

  it('rejects an unknown action even if the project is allowlisted', () => {
    const result = validateLaunchRequest({
      project: 'SSTAC-Dashboard',
      action: 'rm_rf_slash',
    });
    expect(result).toEqual({ ok: false, reason: 'unknown_action' });
  });

  it('rejects shell-metachar project names via the allowlist', () => {
    const hostile = [
      'SSTAC-Dashboard; rm -rf /',
      'SSTAC-Dashboard && echo pwned',
      'SSTAC-Dashboard | curl evil',
      '`echo pwned`',
      '$(echo pwned)',
    ];
    for (const project of hostile) {
      const result = validateLaunchRequest({
        project,
        action: 'run_safe_exit',
      });
      expect(result).toEqual({ ok: false, reason: 'unknown_project' });
    }
  });

  it('rejects path-traversal attempts in project names', () => {
    const hostile = [
      '../etc/passwd',
      '..\\Windows\\System32',
      'SSTAC-Dashboard/../../../etc',
      'SSTAC-Dashboard\\..\\..',
      './SSTAC-Dashboard',
    ];
    for (const project of hostile) {
      const result = validateLaunchRequest({
        project,
        action: 'run_safe_exit',
      });
      expect(result).toEqual({ ok: false, reason: 'unknown_project' });
    }
  });

  it('rejects empty project / empty action', () => {
    expect(
      validateLaunchRequest({ project: '', action: 'run_safe_exit' }),
    ).toEqual({ ok: false, reason: 'unknown_project' });
    expect(
      validateLaunchRequest({ project: 'SSTAC-Dashboard', action: '' }),
    ).toEqual({ ok: false, reason: 'unknown_action' });
  });

  it('rejects prototype-pollution keys masquerading as action names', () => {
    // hasOwnProperty guard prevents __proto__ / constructor / toString from
    // resolving to inherited Object members.
    const hostile = ['__proto__', 'constructor', 'toString', 'hasOwnProperty'];
    for (const action of hostile) {
      const result = validateLaunchRequest({
        project: 'SSTAC-Dashboard',
        action,
      });
      expect(result).toEqual({ ok: false, reason: 'unknown_action' });
    }
  });

  it('cwd uses path.join (Windows separators on win32, POSIX elsewhere)', () => {
    const result = validateLaunchRequest({
      project: 'Site3250-KB',
      action: 'run_safe_exit',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cwd).toBe(path.join('C:\\Projects', 'Site3250-KB'));
    }
  });

  it('cwd correctly handles the worktree project that contains a forward slash', () => {
    const result = validateLaunchRequest({
      project: 'Regulatory-Review-worktrees/engine-v2',
      action: 'run_safe_exit',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // path.join normalizes the forward slash in the project name with the
      // platform's separator after joining to C:\Projects.
      expect(result.value.cwd).toBe(
        path.join('C:\\Projects', 'Regulatory-Review-worktrees/engine-v2'),
      );
    }
  });

  // ---------------------------------------------------------------------------
  // Step 8: Pattern C (run_skill generic launcher).
  // ---------------------------------------------------------------------------

  describe('run_skill (Pattern C, step 8)', () => {
    it('produces {exe: "claude", args: ["-p", "/<slug>"]} for every allowed project + a valid slug', () => {
      for (const project of ALL_PROJECTS) {
        const result = validateLaunchRequest({
          project,
          action: 'run_skill',
          skillSlug: 'safe-exit',
        });
        expect(result.ok, `expected ok for ${project}/run_skill/safe-exit`).toBe(true);
        if (result.ok) {
          expect(result.value.exe).toBe('claude');
          expect(result.value.args).toEqual(['-p', '/safe-exit']);
          expect(result.value.cwd).toBe(path.join('C:\\Projects', project));
        }
      }
    });

    it('accepts mixed-case slug, slug with digits, slug with hyphens', () => {
      const valid = ['Foo', 'foo-bar', 'a1', 'doc-navigator', 'update-docs', 'foo123bar'];
      for (const slug of valid) {
        const result = validateLaunchRequest({
          project: 'SSTAC-Dashboard',
          action: 'run_skill',
          skillSlug: slug,
        });
        expect(result.ok, `expected ok for slug "${slug}"`).toBe(true);
        if (result.ok) {
          expect(result.value.args).toEqual(['-p', `/${slug}`]);
        }
      }
    });

    it('rejects run_skill when skillSlug is missing', () => {
      const result = validateLaunchRequest({
        project: 'SSTAC-Dashboard',
        action: 'run_skill',
      });
      expect(result).toEqual({ ok: false, reason: 'missing_skill_slug' });
    });

    it('rejects run_skill when skillSlug is empty string (defense in depth past zod)', () => {
      // zod min(1) catches this at the schema layer in real life, but the
      // validator is the security boundary -- it must reject empty regardless.
      const result = validateLaunchRequest({
        project: 'SSTAC-Dashboard',
        action: 'run_skill',
        skillSlug: '',
      });
      expect(result).toEqual({ ok: false, reason: 'missing_skill_slug' });
    });

    it('rejects slugs containing path traversal / shell metachars / unicode tokens', () => {
      // 8+ invalid slug forms covering the categories called out in the spec.
      const hostile = [
        '..',
        '../etc/passwd',
        '../../foo',
        '..\\windows',
        '/etc/passwd',
        '\\windows',
        'foo/bar',
        'foo\\bar',
        '.dotleading',
        '-leadingdash',
        'foo.bar',
        'foo bar',
        'foo;bar',
        'foo`bar',
        'foo$(echo pwned)',
        'foo&&bar',
        'foo|bar',
        'foo>out',
        '$ENV',
        'foo\nbar',
        'foo\rbar',
        'foo\tbar',
        // Non-ASCII / unicode -- slug regex is [a-z0-9-] case-insensitive only.
        'foo bar',
        'foo‮bar', // RTL override
        'café',
        // Length: regex caps at 41 chars (1 + 40); 42 chars must fail.
        'a'.repeat(42),
      ];
      for (const slug of hostile) {
        const result = validateLaunchRequest({
          project: 'SSTAC-Dashboard',
          action: 'run_skill',
          skillSlug: slug,
        });
        expect(result, `expected reject for slug "${JSON.stringify(slug)}"`).toEqual({
          ok: false,
          reason: 'invalid_skill_slug',
        });
      }
    });

    it('rejects run_skill against an unknown project (allowlist runs first, ahead of slug check)', () => {
      const result = validateLaunchRequest({
        project: 'NotAProject',
        action: 'run_skill',
        skillSlug: 'safe-exit',
      });
      expect(result).toEqual({ ok: false, reason: 'unknown_project' });
    });

    it('rejects run_skill against an unknown project even when slug is itself invalid (project check is first)', () => {
      // Confirms the cheap allowlist check runs ahead of the slug regex,
      // matching the existing layering between project/action/template.
      const result = validateLaunchRequest({
        project: '`whoami`',
        action: 'run_skill',
        skillSlug: '../etc/passwd',
      });
      expect(result).toEqual({ ok: false, reason: 'unknown_project' });
    });

    it('cwd is set normally for run_skill (same path.join semantics)', () => {
      const result = validateLaunchRequest({
        project: 'Regulatory-Review-worktrees/engine-v2',
        action: 'run_skill',
        skillSlug: 'doc-navigator',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.cwd).toBe(
          path.join('C:\\Projects', 'Regulatory-Review-worktrees/engine-v2'),
        );
      }
    });

    it('args for run_skill is a defensive copy (caller mutation cannot leak into next call)', () => {
      const r1 = validateLaunchRequest({
        project: 'SSTAC-Dashboard',
        action: 'run_skill',
        skillSlug: 'foo',
      });
      expect(r1.ok).toBe(true);
      if (r1.ok) {
        // Try to mutate (TS readonly cast).
        (r1.value.args as string[])[1] = '/pwned';
      }
      const r2 = validateLaunchRequest({
        project: 'SSTAC-Dashboard',
        action: 'run_skill',
        skillSlug: 'foo',
      });
      expect(r2.ok).toBe(true);
      if (r2.ok) {
        expect(r2.value.args).toEqual(['-p', '/foo']);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Step 10: Pattern D (run_agent generic launcher).
  // ---------------------------------------------------------------------------

  describe('run_agent (Pattern D, step 10)', () => {
    it('produces {exe: "claude", args: ["--agent", <slug>, "--bg", <prompt>]} for every allowed project + a valid slug', () => {
      for (const project of ALL_PROJECTS) {
        const result = validateLaunchRequest({
          project,
          action: 'run_agent',
          agentSlug: 'chunk-processor',
        });
        expect(result.ok, `expected ok for ${project}/run_agent/chunk-processor`).toBe(true);
        if (result.ok) {
          expect(result.value.exe).toBe('claude');
          expect(result.value.args).toEqual([
            '--agent',
            'chunk-processor',
            '--bg',
            `Begin working on ${project}.`,
          ]);
          expect(result.value.cwd).toBe(path.join('C:\\Projects', project));
        }
      }
    });

    it('accepts mixed-case slug, slug with digits, slug with hyphens', () => {
      const valid = ['Foo', 'foo-bar', 'a1', 'subagent-watchdog', 'extraction-orchestrator', 'foo123bar'];
      for (const slug of valid) {
        const result = validateLaunchRequest({
          project: 'SSTAC-Dashboard',
          action: 'run_agent',
          agentSlug: slug,
        });
        expect(result.ok, `expected ok for slug "${slug}"`).toBe(true);
        if (result.ok) {
          expect(result.value.args).toEqual([
            '--agent',
            slug,
            '--bg',
            'Begin working on SSTAC-Dashboard.',
          ]);
        }
      }
    });

    it('rejects run_agent when agentSlug is missing', () => {
      const result = validateLaunchRequest({
        project: 'SSTAC-Dashboard',
        action: 'run_agent',
      });
      expect(result).toEqual({ ok: false, reason: 'missing_agent_slug' });
    });

    it('rejects run_agent when agentSlug is empty string (defense in depth past zod)', () => {
      const result = validateLaunchRequest({
        project: 'SSTAC-Dashboard',
        action: 'run_agent',
        agentSlug: '',
      });
      expect(result).toEqual({ ok: false, reason: 'missing_agent_slug' });
    });

    it('rejects slugs containing path traversal / shell metachars / unicode tokens', () => {
      const hostile = [
        '..',
        '../etc/passwd',
        '../../foo',
        '..\\windows',
        '/etc/passwd',
        '\\windows',
        'foo/bar',
        'foo\\bar',
        '.dotleading',
        '-leadingdash',
        'foo.bar',
        'foo bar',
        'foo;bar',
        'foo`bar',
        'foo$(echo pwned)',
        'foo&&bar',
        'foo|bar',
        'foo>out',
        '$ENV',
        'foo\nbar',
        'foo\rbar',
        'foo\tbar',
        'foo‮bar', // RTL override
        'café',
        'a'.repeat(42),
      ];
      for (const slug of hostile) {
        const result = validateLaunchRequest({
          project: 'SSTAC-Dashboard',
          action: 'run_agent',
          agentSlug: slug,
        });
        expect(result, `expected reject for slug "${JSON.stringify(slug)}"`).toEqual({
          ok: false,
          reason: 'invalid_agent_slug',
        });
      }
    });

    it('rejects run_agent against an unknown project (allowlist runs first, ahead of slug check)', () => {
      const result = validateLaunchRequest({
        project: 'NotAProject',
        action: 'run_agent',
        agentSlug: 'chunk-processor',
      });
      expect(result).toEqual({ ok: false, reason: 'unknown_project' });
    });

    it('rejects run_agent against an unknown project even when slug is itself invalid (project check is first)', () => {
      const result = validateLaunchRequest({
        project: '`whoami`',
        action: 'run_agent',
        agentSlug: '../etc/passwd',
      });
      expect(result).toEqual({ ok: false, reason: 'unknown_project' });
    });

    it('cwd is set normally for run_agent (same path.join semantics)', () => {
      const result = validateLaunchRequest({
        project: 'Regulatory-Review-worktrees/engine-v2',
        action: 'run_agent',
        agentSlug: 'subagent-watchdog',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.cwd).toBe(
          path.join('C:\\Projects', 'Regulatory-Review-worktrees/engine-v2'),
        );
      }
    });

    it('args for run_agent is a defensive copy (caller mutation cannot leak into next call)', () => {
      const r1 = validateLaunchRequest({
        project: 'SSTAC-Dashboard',
        action: 'run_agent',
        agentSlug: 'foo',
      });
      expect(r1.ok).toBe(true);
      if (r1.ok) {
        (r1.value.args as string[])[1] = 'pwned';
      }
      const r2 = validateLaunchRequest({
        project: 'SSTAC-Dashboard',
        action: 'run_agent',
        agentSlug: 'foo',
      });
      expect(r2.ok).toBe(true);
      if (r2.ok) {
        expect(r2.value.args).toEqual([
          '--agent',
          'foo',
          '--bg',
          'Begin working on SSTAC-Dashboard.',
        ]);
      }
    });

    it('prompt embeds project name verbatim (project has already cleared allowlist)', () => {
      const result = validateLaunchRequest({
        project: 'Regulatory-Review-worktrees/engine-v2',
        action: 'run_agent',
        agentSlug: 'subagent-watchdog',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Prompt is a single argv element (no shell interpretation).
        expect(result.value.args[3]).toBe(
          'Begin working on Regulatory-Review-worktrees/engine-v2.',
        );
      }
    });
  });

  describe('open_embedded (step 9 / Pattern E)', () => {
    it('accepts open_embedded and returns claude --resume command shape', () => {
      const result = validateLaunchRequest({
        project: 'SSTAC-Dashboard',
        action: 'open_embedded',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.exe).toBe('claude');
        expect(result.value.args).toEqual(['--resume']);
        expect(result.value.cwd).toMatch(/SSTAC-Dashboard$/);
      }
    });

    it('still enforces project allowlist for open_embedded', () => {
      const result = validateLaunchRequest({
        project: 'Not-A-Real-Project',
        action: 'open_embedded',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('unknown_project');
    });

    it('cwd uses path.join(PROJECTS_ROOT, project) for open_embedded', () => {
      const result = validateLaunchRequest({
        project: 'Regulatory-Review-worktrees/engine-v2',
        action: 'open_embedded',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.cwd).toBe(
          path.join('C:\\Projects', 'Regulatory-Review-worktrees/engine-v2'),
        );
      }
    });

    it('open_embedded is exposed in the action allowlist', () => {
      expect(ALL_ACTIONS).toContain('open_embedded');
    });
  });

  it('non-open_session actions have NO spawnOverrides (route uses its defaults)', () => {
    // Sibling guarantee to the open_session spawnOverrides test: only Pattern B
    // needs its windowsHide / detached / stdio defaults inverted. Pattern A/C/D
    // actions MUST inherit the route's piped-stdio defaults so SSE / run-card
    // wiring keeps working unchanged. A future regression that broadens
    // spawnOverrides to other templates would break log capture silently;
    // assert undefined here so that regression is caught at the unit layer.
    const cases: Array<LaunchRequest> = [
      { project: 'SSTAC-Dashboard', action: 'run_safe_exit' },
      { project: 'SSTAC-Dashboard', action: 'run_update_docs' },
      { project: 'SSTAC-Dashboard', action: 'run_doc_navigator' },
      { project: 'SSTAC-Dashboard', action: 'run_skill', skillSlug: 'safe-exit' },
      { project: 'SSTAC-Dashboard', action: 'run_agent', agentSlug: 'chunk-processor' },
      { project: 'SSTAC-Dashboard', action: 'open_embedded' },
    ];
    for (const req of cases) {
      const result = validateLaunchRequest(req);
      expect(result.ok, `expected ok for ${req.action}`).toBe(true);
      if (result.ok) {
        expect(
          result.value.spawnOverrides,
          `${req.action} should NOT declare spawnOverrides`,
        ).toBeUndefined();
      }
    }
  });

  it('args is a defensive copy (caller cannot mutate the registry)', () => {
    const r1 = validateLaunchRequest({
      project: 'SSTAC-Dashboard',
      action: 'run_safe_exit',
    });
    const r2 = validateLaunchRequest({
      project: 'SSTAC-Dashboard',
      action: 'run_safe_exit',
    });
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      // Each call returns a fresh array.
      expect(r1.value.args).not.toBe(r2.value.args);
      expect(r1.value.args).toEqual(r2.value.args);
    }
  });
});
