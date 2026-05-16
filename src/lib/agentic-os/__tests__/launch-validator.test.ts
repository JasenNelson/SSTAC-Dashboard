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

  it('ships the three Pattern-A actions plus the step-7 open_session, and no Pattern-C/D templates yet', () => {
    expect(new Set(ALL_ACTIONS)).toEqual(
      new Set([
        'run_safe_exit',
        'run_update_docs',
        'run_doc_navigator',
        'open_session',
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
